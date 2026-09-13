/**
 * ==============================================================================
 *  🏥 MRT & MSKT NAVBATGA QO'YISH VA JONLI MONITORING SERVERI (mrt_reg_server.js)
 * ==============================================================================
 *  - Port: 9891 (process.env.PORT || 9891)
 *  - Host: 0.0.0.0 (Lokal tarmoqdagi barcha kompyuterlar uchun)
 *  - Operatorlar: TB1 (Saida'lo), TB2 (Nigora), TB3 (Isfandiyor) - Parol: 14520
 *  - IP Ruxsat Tekshiruvi: faqat http://localhost:9890/control dan ruxsat olgan IP lar kira oladi
 *  - Karmed Yashirin Integratsiyasi: R5 / 17720 (orqa fonda avtomatik sessiya)
 *  - Qat'iy filtrlash: Faqat MRT va MSKT tekshiruvlarini navbatga qo'yish mumkin
 *  - Tibbiy muddat qoidasi: 5 kundan oshgan tekshiruvlar ogohlantirishi + 10 kundan keyin tekshiruv o'tkazish taqiqlanadi
 *  - To'lov tasdiqlash: Rezident yoki No-rezident bemorlar uchun to'lov tasdiqlanmasa navbatga qo'yilmaydi
 *  - Suzuvchi belgi: "Bu yerda klizma qilinmaydi"
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');

const PORT = parseInt(process.env.PORT || '9891', 10);
const HOST = '0.0.0.0';

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'mrt_queue.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const ALLOWED_IPS_FILE = path.join(DATA_DIR, 'allowed_ips.json');
const KARMED_PROFILES_FILE = path.join(DATA_DIR, 'karmed_profiles.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const CONSENT_QUESTIONS_FILE = path.join(DATA_DIR, 'consent_questions.json');
const OPERATORS_FILE = path.join(DATA_DIR, 'operators.json');
const PRINTER_SETTINGS_FILE = path.join(DATA_DIR, 'printer_settings.json');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');

const scheduler = require('./shared/scheduler');
const unifiedCore = require('./shared/unified_core');

const KARMED_USERNAME = 'R5';
const KARMED_PASSWORD = '17720';
const KARMED_HOSTS = ['192.168.150.111', '213.230.91.59'];
const KARMED_PORT = 2025;

let OPERATORS = {
  'TB1': { username: 'TB1', name: "Saida'lo", pass: '14520' },
  'TB2': { username: 'TB2', name: 'Nigora', pass: '14520' },
  'TB3': { username: 'TB3', name: 'Isfandiyor', pass: '14520' }
};

try {
  if (fs.existsSync(OPERATORS_FILE)) {
    OPERATORS = JSON.parse(fs.readFileSync(OPERATORS_FILE, 'utf8'));
  } else {
    fs.writeFileSync(OPERATORS_FILE, JSON.stringify(OPERATORS, null, 2), 'utf8');
  }
} catch (e) {}

// Faol operator sessiyalari (token -> operator)
const activeSessions = new Map();

// Karmed faol sessiyasi keshda
let karmedLiveSession = {
  token: '',
  cookie: '',
  host: KARMED_HOSTS[0],
  lastLogin: null
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function readJson(file, fallback = {}) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (e) {
    console.error(`[Read Error] ${file}:`, e.message);
  }
  return fallback;
}

function writeJson(file, data) {
  try {
    const tmp = `${file}.tmp_${Date.now()}`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, file);
    return true;
  } catch (e) {
    console.error(`[Write Error] ${file}:`, e.message);
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendJson(res, data, code = 200) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Operator-Token'
  });
  res.end(JSON.stringify(data));
}

function getClientIp(req) {
  let ip = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress;
  if (!ip) ip = '127.0.0.1';
  return ip.replace('::ffff:', '').trim();
}

function isLocalhost(ip) {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || ip === '10.34.14.33';
}

function checkClientIpPermission(req) {
  const ip = getClientIp(req);
  if (isLocalhost(ip)) {
    return { allowed: true, role: 'full', ip, isServer: true };
  }
  const data = readJson(ALLOWED_IPS_FILE, { allowed: [], pending: [] });
  const entry = (data.allowed || []).find(a => a.ip === ip && a.status === 'approved');
  if (entry) {
    return { allowed: true, role: entry.role || 'full', ip, entry };
  }
  return { allowed: false, role: 'none', ip };
}

// -------------------------------------------------------------
// KARMED TARMOQ VA AUTENTIFIKATSIYA (R5 / 17720)
// -------------------------------------------------------------
function karmedRawRequest(options, postData = null, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Timeout ' + timeoutMs + 'ms on ' + options.hostname));
    });
    if (postData) req.write(postData);
    req.end();
  });
}

function extractKarmedLoginBilgi(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/App\.hdnKrmdLoginBilgi\.setValue\([\\\"\']*([A-Za-z0-9%_+\-\/=]{40,})[\\\"\']*\)/);
  if (m && m[1]) return m[1];
  if (str.includes('hdnKrmdLoginBilgi=')) {
    const m2 = str.match(/hdnKrmdLoginBilgi=([^&\"\'\s]+)/);
    if (m2 && m2[1]) return decodeURIComponent(m2[1]);
  }
  const m3 = str.match(/id="hdnKrmdLoginBilgi"[^}]*value="([^"]+)"/);
  if (m3 && m3[1]) return m3[1];
  return null;
}

function safeParseExtNetJson(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch (e) {
    try { return JSON.parse(str.replace(/\\"/g, '"')); } catch (e2) {
      try {
        const clean = str.replace(/new Date\([^)]+\)/g, '"2026-09-10"').replace(/\\"/g, '"');
        return JSON.parse(clean);
      } catch (e3) { return null; }
    }
  }
}

async function loginToKarmedLive() {
  for (const hostname of KARMED_HOSTS) {
    try {
      console.log(`[Karmed Silent Auth] ${KARMED_USERNAME} bilan kirish tekshirilmoqda (${hostname})...`);
      const r1 = await karmedRawRequest({
        hostname,
        port: KARMED_PORT,
        path: `/Login/Login.aspx?returnUrl=http://${hostname}:${KARMED_PORT}/Radiology/Rbys.aspx`,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      const setCookies1 = r1.headers['set-cookie'] || [];
      let cookieStr = setCookies1.map(c => c.split(';')[0]).join('; ');
      const m1 = r1.body.match(/value='([^']+)'/);
      if (!m1) continue;

      const r2 = await karmedRawRequest({
        hostname,
        port: KARMED_PORT,
        path: '/Karmed/Default.aspx',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength('=' + m1[1]),
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, '=' + m1[1]);

      const m2 = r2.body.match(/name='token'\s+value='([^']+)'/);
      if (!m2) continue;
      const tokenVal = m2[1];

      const tokenBody = 'token=' + encodeURIComponent(tokenVal);
      const r3 = await karmedRawRequest({
        hostname,
        port: KARMED_PORT,
        path: `/Login/Login.aspx?returnUrl=http://${hostname}:${KARMED_PORT}/Radiology/Rbys.aspx`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(tokenBody),
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, tokenBody);

      const mDataIndex = r3.body.match(/id="hdnDataIndexInfo"[^>]*value="([^"]+)"/) || 
                         r3.body.match(/hdnDataIndexInfo[\\\"':,=\s]+([^"&'<>]+)/);
      const dataIndexInfo = mDataIndex ? mDataIndex[1] : '';

      const makeLoginParams = new URLSearchParams();
      makeLoginParams.set('submitDirectEventConfig', JSON.stringify({ config: { extraParams: { dataIndex: null } } }));
      makeLoginParams.set('HdnBaseYazdirmaTuru', '-1');
      makeLoginParams.set('__VIEWSTATEGENERATOR', '5E7FB4E4');
      makeLoginParams.set('hdnSmsInfo', '');
      makeLoginParams.set('hdnDataIndexInfo', decodeURIComponent(dataIndexInfo));
      makeLoginParams.set('hdToken', tokenVal);
      makeLoginParams.set('hdReferer', hostname);
      makeLoginParams.set('hdCaptchaVisible', 'False');
      makeLoginParams.set('CmbCulture', 'uz-UZ');
      makeLoginParams.set('txtUsername', KARMED_USERNAME);
      makeLoginParams.set('txtPassword', KARMED_PASSWORD);
      makeLoginParams.set('cmbData', '');
      makeLoginParams.set('_cmbData_state', '');
      makeLoginParams.set('captchaResim_hdnMyCaptcha', '');
      makeLoginParams.set('captchaResim_hdnCaptchaYenile', 'true');
      makeLoginParams.set('captchaResim$txtCaptcha', '');
      makeLoginParams.set('HdnAlanMesaj', "Iltimos, barcha maydonlarni to'ldiring.");
      makeLoginParams.set('__EVENTTARGET', 'ResLogin');
      makeLoginParams.set('__EVENTARGUMENT', '-|public|MakeLogin');

      const pData = makeLoginParams.toString();
      const r4 = await karmedRawRequest({
        hostname,
        port: KARMED_PORT,
        path: `/Login/Login.aspx?returnUrl=http%3a%2f%2f${hostname}%3a${KARMED_PORT}%2fRadiology%2fRbys.aspx&action=MakeLogin`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(pData),
          'Cookie': cookieStr,
          'X-Ext-Net': 'delta=true',
          'action': 'MakeLogin',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, pData);

      if (!r4.body.includes('userInfo')) continue;

      const mUserInfo = r4.body.match(/name='userInfo'\s+value='([^']+)'/);
      const userInfoVal = mUserInfo ? mUserInfo[1] : '';

      const r5Data = 'userInfo=' + encodeURIComponent(userInfoVal);
      const r5 = await karmedRawRequest({
        hostname,
        port: KARMED_PORT,
        path: '/Radiology/Rbys.aspx',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(r5Data),
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, r5Data);

      if (r5.headers['set-cookie']) {
        const newCookies = r5.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
        cookieStr = cookieStr + '; ' + newCookies;
      }

      let loginBilgi = extractKarmedLoginBilgi(r5.body) || '';

      const mInitScript = r5.body.match(/src="(\/Radiology\/extnet\/extnet-init-js\/ext\.axd\?[^"]+)"/);
      if (mInitScript && mInitScript[1]) {
        const r6 = await karmedRawRequest({
          hostname,
          port: KARMED_PORT,
          path: mInitScript[1],
          method: 'GET',
          headers: { 'Cookie': cookieStr, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (r6 && r6.body) {
          const mTok = r6.body.match(/id:"hdnKrmdLoginBilgi"[^}]*value:"([^"]+)"/);
          if (mTok && mTok[1]) loginBilgi = mTok[1];
        }
      }

      karmedLiveSession = {
        token: loginBilgi,
        cookie: cookieStr,
        host: hostname,
        lastLogin: new Date()
      };

      console.log(`[Karmed Silent Auth] Muvaffaqiyatli login: ${KARMED_USERNAME} (${hostname})`);
      return karmedLiveSession;
    } catch (e) {
      console.warn(`[Karmed Silent Auth] ${hostname} xatosi:`, e.message);
    }
  }

  // Agar yangi login bo'lmasa, data/karmed_profiles.json dan keshni olish
  const profiles = readJson(KARMED_PROFILES_FILE, {});
  if (profiles['R5'] && profiles['R5'].loginBilgi) {
    karmedLiveSession = {
      token: profiles['R5'].loginBilgi,
      cookie: profiles['R5'].cookie || '',
      host: KARMED_HOSTS[0],
      lastLogin: new Date()
    };
    return karmedLiveSession;
  }

  throw new Error("Karmed tizimiga ulanib bo'lmadi");
}

// Karmed seansini olish yoki yangilash
async function getActiveKarmedSession() {
  const now = Date.now();
  if (karmedLiveSession.token && karmedLiveSession.cookie && karmedLiveSession.lastLogin && (now - karmedLiveSession.lastLogin.getTime() < 30 * 60 * 1000)) {
    return karmedLiveSession;
  }
  return await loginToKarmedLive();
}

function formatUzbekPhone(raw) {
  if (!raw) return '';
  let clean = String(raw).replace(/[^\d+]/g, '');
  if (clean.startsWith('+')) clean = clean.slice(1);
  if (clean.startsWith('998') && clean.length === 12) {
    clean = clean.slice(3);
  }
  if (clean.length === 9) {
    return `+998 ${clean.slice(0, 2)} ${clean.slice(2, 5)} ${clean.slice(5, 7)} ${clean.slice(7, 9)}`;
  }
  if (raw.trim() === '000' || raw.trim() === '0') return '';
  return raw.trim();
}

// Karmeddan bemor telefon raqamini olish (HastaKayit moduli orqali)
async function fetchPatientPhone(patientId, token, cookie, host) {
  try {
    const profiles = readJson(KARMED_PROFILES_FILE, {});
    const r5Prof = profiles['R5'] || profiles['R18'] || {};

    const candidates = [
      { cookie: r5Prof.cookie, token: r5Prof.loginBilgi, source: 'profile' },
      { cookie: cookie, token: token, source: 'live' }
    ];

    for (const cand of candidates) {
      if (!cand.cookie && !cand.token) continue;

      const postObj = {
        '__EVENTTARGET': 'HbysResource',
        '__EVENTARGUMENT': '-|public|FillHastaBilgileri',
        '__VIEWSTATEGENERATOR': '1740EACF',
        'hdnKrmdLoginBilgi': decodeURIComponent(cand.token || ''),
        'submitDirectEventConfig': JSON.stringify({
          config: {
            extraParams: {
              kimlikNo: parseInt(patientId, 10),
              listeYenile: false
            }
          }
        })
      };
      const postData = new URLSearchParams(postObj).toString();
      const res = await karmedRawRequest({
        hostname: host || KARMED_HOSTS[0],
        port: KARMED_PORT,
        path: '/Karmed/HastaKayit/Default.aspx?action=FillHastaBilgileri',
        method: 'POST',
        headers: {
          'Cookie': cand.cookie || '',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Ext-Net': 'delta=true',
          'action': 'FillHastaBilgileri',
          'Referer': `http://${host || KARMED_HOSTS[0]}:2025/Karmed/HastaKayit/Default.aspx`,
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, postData, 8000);

      const body = res.body || '';

      if (body.length > 3000 && !body.includes('/Login/Login.aspx')) {
        let phone = '';

        // 1. TxtGsmKimlik setValue dan qidirish
        const gsmKimlikMatches = [...body.matchAll(/TxtGsmKimlik\.setValue\(\\"([^\\"]*)\\"\)/g)];
        for (const m of gsmKimlikMatches) {
          if (m[1] && m[1].trim() && m[1].trim() !== '000') {
            phone = m[1].trim();
            break;
          }
        }

        // 2. frmAdresBilgi JSON obyektidan Gsm yoki Tel
        if (!phone) {
          const adresMatch = body.match(/frmAdresBilgi\.getForm\(\)\.setValues\((\{.+?\})\);/);
          if (adresMatch) {
            try {
              const parsed = JSON.parse(adresMatch[1].replace(/\\"/g, '"'));
              phone = parsed.Gsm || parsed.Tel || parsed.TelYakini || '';
            } catch (e) {}
          }
        }

        // 3. Regex orqali qidirish
        if (!phone) {
          const gsmMatch = body.match(/\\?"Gsm\\?":\s*\\?"([^\\"]+)\\?"/i);
          if (gsmMatch && gsmMatch[1] && gsmMatch[1].trim() && gsmMatch[1] !== 'null') {
            phone = gsmMatch[1].trim();
          }
        }
        if (!phone || phone === '000') {
          const telMatch = body.match(/\\?"Tel\\?":\s*\\?"([^\\"]+)\\?"/i);
          if (telMatch && telMatch[1] && telMatch[1].trim() && telMatch[1] !== 'null') {
            phone = telMatch[1].trim();
          }
        }
        if (!phone || phone === '000') {
          const telYakiniMatch = body.match(/\\?"TelYakini\\?":\s*\\?"([^\\"]+)\\?"/i);
          if (telYakiniMatch && telYakiniMatch[1] && telYakiniMatch[1].trim() && telYakiniMatch[1] !== 'null') {
            phone = telYakiniMatch[1].trim();
          }
        }

        const formattedPhone = formatUzbekPhone(phone);
        if (formattedPhone) {
          console.log(`[Karmed Phone] Bemor ID ${patientId}: '${phone}' -> '${formattedPhone}' (${cand.source})`);
          return formattedPhone;
        }
      }
    }

    return '';
  } catch (err) {
    console.warn(`[Karmed Phone Fetch Warn] ID ${patientId}:`, err.message);
    return '';
  }
}

// Tahlillar ro'yxatidan Kreatinin va Mochevinani ajratish
function extractLabFromTests(tests) {
  let kreatinin = null;
  let mochevina = null;

  for (const t of tests) {
    const name = (t.TetkikAdi || '').toLowerCase();
    const testDate = t.OnayTarihi || t.SonucTarihi || t.NumuneAlmaTarihi;
    let daysAgo = null;
    let dateStr = '';
    if (testDate) {
      try {
        const dObj = new Date(testDate);
        dateStr = dObj.toISOString().split('T')[0];
        daysAgo = Math.floor((Date.now() - dObj.getTime()) / (1000 * 60 * 60 * 24));
      } catch (e) {}
    }

    const refStr = (t.TetkikReferansDegeri || '').trim() || (t.RefMin && t.RefMax ? `${t.RefMin} - ${t.RefMax} ${t.Birimi || ''}`.trim() : '');

    if (name.includes('kreatin') && !kreatinin) {
      kreatinin = {
        name: (t.TetkikAdi || 'Qonda Kreatinin Miqdori').trim(),
        value: t.Sonuc || (t.SonucNumber != null ? String(t.SonucNumber) : '-'),
        reference: refStr || '44 - 115 μmol/L',
        warning: t.Uyari || 'Normal',
        date: dateStr,
        daysAgo: daysAgo !== null ? daysAgo : 0,
        isRecent: daysAgo !== null ? daysAgo <= 30 : true
      };
    }
    if ((name.includes('moch') || name.includes('urea') || name.includes('ure')) && !mochevina) {
      mochevina = {
        name: (t.TetkikAdi || 'Qonda Mochevina Miqdori').trim(),
        value: t.Sonuc || (t.SonucNumber != null ? String(t.SonucNumber) : '-'),
        reference: refStr || '2.9 - 8.2 mmol/L',
        warning: t.Uyari || 'Normal',
        date: dateStr,
        daysAgo: daysAgo !== null ? daysAgo : 0,
        isRecent: daysAgo !== null ? daysAgo <= 30 : true
      };
    }
  }

  if (kreatinin || mochevina) {
    return {
      found: true,
      kreatinin: kreatinin,
      mochevina: mochevina,
      hasRecentLab: (kreatinin && kreatinin.isRecent) || (mochevina && mochevina.isRecent)
    };
  }
  return null;
}

// Monitoring eksteshn tutilgan trafikdan qidirish
function searchLabInTrafficLogs(kimlikId) {
  try {
    const logBase = path.join(ROOT_DIR, 'Log');
    if (!fs.existsSync(logBase)) return null;
    const dirs = fs.readdirSync(logBase).filter(d => {
      try { return fs.statSync(path.join(logBase, d)).isDirectory(); } catch(e) { return false; }
    }).sort().reverse();

    for (const d of dirs) {
      const trafficFile = path.join(logBase, d, 'karmed_traffic.json');
      if (fs.existsSync(trafficFile)) {
        const content = fs.readFileSync(trafficFile, 'utf8');
        if (content.includes(String(kimlikId)) && (content.includes('Kreatin') || content.includes('Mochev'))) {
          const data = JSON.parse(content);
          if (data && Array.isArray(data.requests)) {
            for (const r of data.requests) {
              if (r.responseBody && (r.action === 'DetayGoster' || r.url?.includes('action=DetayGoster'))) {
                const str = r.responseBody;
                if (str.includes(String(kimlikId)) && (str.includes('Kreatin') || str.includes('Mochev'))) {
                  const mData = str.match(/App\.StoreLda\.proxy\.data\s*=\s*(\[.*?\]);/s);
                  if (mData) {
                    const unescaped = mData[1].replace(/\\"/g, '"').replace(/new Date\([^)]+\)/g, '"2026-09-09"');
                    const tests = JSON.parse(unescaped);
                    const parsed = extractLabFromTests(tests);
                    if (parsed) return parsed;
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[searchLabInTrafficLogs Error]:', e.message);
  }
  return null;
}

// Karmeddan qon tahlillarini (Kreatinin va Mochevina) olish
async function fetchPatientLabResults(kimlikId, onkayitIds, token, cookie, host) {
  try {
    // 1. Avval monitoring eksteshn tutgan trafikdan tekshirish
    const trafficLab = searchLabInTrafficLogs(kimlikId);
    if (trafficLab) {
      console.log(`[Karmed Lab] Bemor ID ${kimlikId}: monitoring eksteshn logidan topildi (Kreatinin: ${trafficLab.kreatinin?.value}, Mochevina: ${trafficLab.mochevina?.value})`);
      return trafficLab;
    }

    // 2. Karmed jonli LBYS so'rovlar zanjiri
    const profiles = readJson(KARMED_PROFILES_FILE, {});
    const r5Prof = profiles['R5'] || profiles['R18'] || {};
    const activeCookie = r5Prof.cookie || cookie || '';
    const activeToken = r5Prof.loginBilgi || token || '';
    const activeHost = host || KARMED_HOSTS[0];

    const onKayitList = Array.isArray(onkayitIds) ? onkayitIds : [onkayitIds || 0];

    for (const onkId of onKayitList) {
      const pObj = {
        '__EVENTTARGET': 'ctl00$ResourceManagerX',
        '__EVENTARGUMENT': 'OrtakDmOrtakSayfalar|public|LabSonucUrlGetir',
        '__VIEWSTATEGENERATOR': '5DE5E74B',
        'hdnKrmdLoginBilgi': decodeURIComponent(activeToken || ''),
        'submitDirectEventConfig': JSON.stringify({
          config: {
            extraParams: { aOnKayitId: parseInt(onkId, 10) || 0, aKimlikId: parseInt(kimlikId, 10) }
          }
        })
      };
      const pData = new URLSearchParams(pObj).toString();
      const urlRes = await karmedRawRequest({
        hostname: activeHost,
        port: KARMED_PORT,
        path: '/Radiology/Rbys.aspx?action=LabSonucUrlGetir',
        method: 'POST',
        headers: {
          'Cookie': activeCookie,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'X-Ext-Net': 'delta=true',
          'action': 'LabSonucUrlGetir',
          'Referer': `http://${activeHost}:${KARMED_PORT}/Radiology/Rbys.aspx`,
          'Content-Length': Buffer.byteLength(pData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, pData, 8000);

      const m = urlRes.body.match(/\/Lis\/UI\/OrtakFrames\/LBYSOnkayitSonucGosterPage\.aspx\?[^"\']+/);
      if (!m) continue;
      const targetPath = m[0].replace(/&amp;/g, '&');

      // DosyaListele chaqirib barcha laboratoriya fayllari ro'yxatini olish
      try {
        const dosyaListObj = {
          '__EVENTTARGET': 'ResourceManager1',
          '__EVENTARGUMENT': '-|public|DosyaListele',
          '__VIEWSTATEGENERATOR': 'EB15314C',
          'hdnKrmdLoginBilgi': decodeURIComponent(activeToken || ''),
          'submitDirectEventConfig': JSON.stringify({ config: { extraParams: {} } }),
          'CmbTumDosyalar': 'Barcha fayllar'
        };
        const dlData = new URLSearchParams(dosyaListObj).toString();
        const dlRes = await karmedRawRequest({
          hostname: activeHost,
          port: KARMED_PORT,
          path: targetPath + '&action=DosyaListele',
          method: 'POST',
          headers: {
            'Cookie': activeCookie,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Ext-Net': 'delta=true',
            'action': 'DosyaListele',
            'Referer': `http://${activeHost}:${KARMED_PORT}${targetPath}`,
            'Content-Length': Buffer.byteLength(dlData),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }, dlData, 8000);

        const mLabDosya = dlRes.body.match(/App\.StoreLabDosya\.proxy\.data\s*=\s*(\[.*?\]);/s);
        if (mLabDosya) {
          const labFiles = safeParseExtNetJson(mLabDosya[1]) || [];
          // Eng yangi laboratoriya fayllaridan boshlab tekshirish
          labFiles.sort((a, b) => (b.DosyaId || 0) - (a.DosyaId || 0));

          for (const lf of labFiles) {
            if (!lf.DosyaId) continue;
            const dObj = {
              '__EVENTTARGET': 'ResourceManager1',
              '__EVENTARGUMENT': '-|public|DetayGoster',
              '__VIEWSTATEGENERATOR': 'EB15314C',
              'hdnKrmdLoginBilgi': decodeURIComponent(activeToken || ''),
              'submitDirectEventConfig': JSON.stringify({
                config: {
                  extraParams: {
                    aLdSiraNo: lf.DosyaId,
                    aUyusturucuGorunsun: false
                  }
                }
              })
            };
            const dData = new URLSearchParams(dObj).toString();
            const dRes = await karmedRawRequest({
              hostname: activeHost,
              port: KARMED_PORT,
              path: targetPath + '&action=DetayGoster',
              method: 'POST',
              headers: {
                'Cookie': activeCookie,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'X-Ext-Net': 'delta=true',
                'action': 'DetayGoster',
                'Referer': `http://${activeHost}:${KARMED_PORT}${targetPath}`,
                'Content-Length': Buffer.byteLength(dData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            }, dData, 8000);

            const dataMatch = dRes.body.match(/App\.StoreLda\.proxy\.data\s*=\s*(\[.*?\]);/s);
            if (dataMatch) {
              const tests = safeParseExtNetJson(dataMatch[1]);
              if (tests) {
                const resLab = extractLabFromTests(tests);
                if (resLab) {
                  console.log(`[Karmed Lab Live] Bemor ID ${kimlikId}: Kreatinin ${resLab.kreatinin?.value}, Mochevina ${resLab.mochevina?.value} (LabDosya: ${lf.DosyaId})`);
                  return resLab;
                }
              }
            }
          }
        }
      } catch (dlErr) {
        console.warn(`[Karmed Lab File Warn] OnKayitId ${onkId}:`, dlErr.message);
      }
    }

    return { found: false, message: "Karmedda oxirgi 30 kun ichida Kreatinin / Mochevina tahlili topilmadi!" };
  } catch (err) {
    console.warn(`[Karmed Lab Fetch Warn] ID ${kimlikId}:`, err.message);
    return { found: false, message: "Tahlil ma'lumotlarini olishda xatolik: " + err.message };
  }
}

// Bemor ID bo'yicha qidirish va faqat MRT/MSKT ni ajratish
async function searchPatientInKarmed(patientId) {
  let session = await getActiveKarmedSession();

  async function performSearch(tok, cookie, host) {
    const cleanId = String(patientId).trim();
    const isPinfl = /^\d{12,14}$/.test(cleanId);
    const searchTur = isPinfl ? 'PINFL' : 'Bemor ID';
    const searchTurVal = isPinfl ? '1' : '0';
    const currentYear = new Date().getFullYear().toString();
    const params = new URLSearchParams();
    params.set('submitDirectEventConfig', JSON.stringify({ config: { extraParams: { aDosyaDurumu: null, aHizliAra: true } } }));
    params.set('cbYil', currentYear);
    params.set('_cbYil_state', JSON.stringify([{ value: currentYear, text: currentYear, index: 1 }]));
    params.set('cbHizliAramaTur', searchTur);
    params.set('_cbHizliAramaTur_state', JSON.stringify([{ value: searchTurVal, text: searchTur, index: isPinfl ? 1 : 0 }]));
    params.set('tfHizliAramaDeger', cleanId);
    params.set('BaslangicDt', '01.01.2025');
    params.set('BitisDt', '31.12.2026');
    params.set('cbBolum', '');
    params.set('_cbBolum_state', '');
    params.set('cbAltBolum', '(Subbirliklar)');
    params.set('_cbAltBolum_state', JSON.stringify([{ value: '0', text: '(Subbirliklar)', index: 0 }]));
    params.set('cbBolumOda', '(Barcha Xonalar)');
    params.set('_cbBolumOda_state', JSON.stringify([{ value: '0', text: '(Barcha Xonalar)', index: 0 }]));
    params.set('cbBirimTuru', '(Butun Birlik)');
    params.set('_cbBirimTuru_state', JSON.stringify([{ value: '0', text: '(Butun Birlik)', index: 0 }]));
    params.set('cbBina', '(Butun Binolar)');
    params.set('_cbBina_state', JSON.stringify([{ value: '0', text: '(Butun Binolar)', index: 0 }]));
    params.set('cbKayitSayisiSecim', '500');
    params.set('_cbKayitSayisiSecim_state', JSON.stringify([{ value: '500', text: '500', index: 3 }]));
    params.set('hdnDosyaDurumu', '');
    params.set('btnTumu_Pressed', 'true');
    params.set('btnBekleyen_Pressed', '');
    params.set('HdnBaseYazdirmaTuru', '-1');
    params.set('__VIEWSTATEGENERATOR', '5DE5E74B');
    params.set('hdnKrmdLoginBilgi', tok);
    params.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
    params.set('__EVENTARGUMENT', '-|public|HastaSorgula');

    const spData = params.toString();
    const res = await karmedRawRequest({
      hostname: host,
      port: KARMED_PORT,
      path: '/Radiology/Rbys.aspx?action=HastaSorgula',
      method: 'POST',
      headers: {
        'X-Ext-Net': 'delta=true',
        'action': 'HastaSorgula',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': cookie,
        'Content-Length': Buffer.byteLength(spData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, spData);

    const updatedTok = extractKarmedLoginBilgi(res.body);
    if (updatedTok) session.token = updatedTok;

    const dataMatch = res.body.match(/App\.grdHastalarStore\.proxy\.data\s*=\s*(\[.*?\]);/s);
    return dataMatch ? (safeParseExtNetJson(dataMatch[1]) || []) : [];
  }

  let pList = await performSearch(session.token, session.cookie, session.host);

  // Agar sessiya tugagan bo'lsa
  if (!pList || pList.length === 0) {
    session = await loginToKarmedLive();
    pList = await performSearch(session.token, session.cookie, session.host);
  }

  if (!pList || pList.length === 0) {
    return {
      success: false,
      found: false,
      error: `Bemor ID: ${patientId} Karmed tizimida topilmadi`,
      message: `Bemor ID: ${patientId} Karmed tizimida topilmadi`
    };
  }

  // Bemor asosiy ma'lumotlari
  const sample = pList[0];
  const isStatsionar = sample.YatPol === 'Y' || sample.NeIcin === 'Yatis' || sample.NeIcin === 3 || 
                       String(sample.OncelikAciklama).toLowerCase().includes('yatan') || 
                       String(sample.OncelikAciklama).toLowerCase().includes('statsionar');

  // Karmeddan telefon raqamini olish
  let patientPhone = '';
  try {
    patientPhone = await fetchPatientPhone(sample.KimlikNo || patientId, session.token, session.cookie, session.host);
  } catch (phErr) {
    console.warn(`[Karmed Phone Error]:`, phErr.message);
  }

  // F.I.SH: Qoidaga muvofiq oldin Familiya, keyin Ism (Surname first)
  const surName = (sample.Soyadi || '').trim().toUpperCase();
  const firstName = (sample.HastaAdi || '').trim().toUpperCase();
  let formattedFullName = '';
  if (surName && firstName) {
    formattedFullName = `${surName} ${firstName}`;
  } else if (surName) {
    formattedFullName = surName;
  } else if (firstName) {
    formattedFullName = firstName;
  } else {
    formattedFullName = (sample.AdSoyad || '').trim().toUpperCase();
  }

  const patientInfo = {
    patientId: String(sample.KimlikNo || patientId),
    fullName: formattedFullName,
    surname: surName,
    firstName: firstName,
    phone: patientPhone || '',
    birthDate: sample.DogumTarihi ? sample.DogumTarihi.split('T')[0] : '',
    age: sample.Yas || null,
    gender: sample.Cinsiyet === 'E' ? 'Erkak' : 'Ayol',
    kurum: sample.KurumAdi || sample.SosyalGuvence || '',
    patientType: isStatsionar ? 'Statsionar' : 'Ambulator',
    department: sample.ServisAdi || sample.AltServisAdi || ''
  };

  // To'lov turi: Rezident yoki Norezident aniqlash
  const kurumStr = String(patientInfo.kurum).toLowerCase();
  let isNonResident = kurumStr.includes('no rezident') || kurumStr.includes('norezident');
  let isResidentPaid = kurumStr.includes('rezident') || kurumStr.includes('pullik') || sample.Ucretli === true;
  let isInsurance = kurumStr.includes('sugurta') || kurumStr.includes('imtiyoz');

  let patientCategory = "Sug'urta / Imtiyozli";
  let requiresPayment = false;

  if (isNonResident) {
    patientCategory = "No-rezident (Chet el)";
    requiresPayment = true;
  } else if (isResidentPaid || !isInsurance) {
    patientCategory = "Rezident (Pullik)";
    requiresPayment = true;
  }

  // STATSIONAR QOIDASI:
  // Statsionar bemorlarda to'lov haqida so'ralmaydi, tekshiruvdan keyin to'lashi mumkin!
  if (isStatsionar) {
    requiresPayment = false;
  }

  patientInfo.patientCategory = patientCategory;
  patientInfo.requiresPaymentConfirmation = requiresPayment;

  // Qon tahlillari (Kreatinin va Mochevina)ni LBYS laboratoriyadan olish
  const allOnKayitIds = Array.from(new Set(
    pList.map(p => p.OnKayitId).filter(Boolean)
  )).reverse();
  if (allOnKayitIds.length === 0) allOnKayitIds.push(0);

  let cachedPatientLab = null;
  try {
    cachedPatientLab = await fetchPatientLabResults(patientInfo.patientId, allOnKayitIds, session.token, session.cookie, session.host);
  } catch (lbErr) {
    cachedPatientLab = { found: false, message: "Karmedda oxirgi 30 kun ichida Kreatinin / Mochevina tahlili topilmadi!" };
  }
  patientInfo.labResults = cachedPatientLab;

  // Joriy navbat ro'yxatini yuklash (allaqachon navbatga qo'yilgan yoki o'tganligini tekshirish uchun)
  const currentQueue = readJson(QUEUE_FILE, []);

  // Har bir dosyaning xizmatlarini tekshirib, FAQAT MRT va MSKT ni ajratish
  const eligibleExams = [];

  for (const dosya of pList) {
    const dosyaRoom = (dosya.AltBolumAdi || dosya.BolumuAdi || dosya.OdaAdi || '').toUpperCase();
    const dosyaDateStr = dosya.KayitTarihi || dosya.Tarih || '';
    const regDate = dosyaDateStr ? new Date(dosyaDateStr) : new Date();

    // 5 kun va 10 kunlik chegara hisobi
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - regDate.getTime()) / (1000 * 60 * 60 * 24));
    const isOlderThan5Days = diffDays > 5;

    // 10 kunlik maksimal ruxsat etilgan sana
    const maxDateObj = new Date(regDate);
    maxDateObj.setDate(maxDateObj.getDate() + 10);
    const maxAllowedDate = maxDateObj.toISOString().split('T')[0];

    // Xizmatlarni Karmeddan TaniHizmetBilgisiGetir orqali olish
    const tParams = new URLSearchParams();
    tParams.set('submitDirectEventConfig', JSON.stringify({
      config: {
        extraParams: {
          aLabDosyaId: dosya.Id,
          aOnkayitSiraNo: dosya.MuayeneSirano || 0,
          aYatPol: dosya.YatPol || "P",
          aProtokolNo: dosya.ProtokolNo,
          aKimlikId: dosya.KimlikNo,
          aHastaAdi: dosya.AdSoyad || (dosya.HastaAdi + ' ' + dosya.Soyadi),
          aBolumId: dosya.BolumId || 10,
          mrrsProtokolNo: null
        }
      }
    }));
    tParams.set('hdnKrmdLoginBilgi', session.token);
    tParams.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
    tParams.set('__EVENTARGUMENT', '-|public|TaniHizmetBilgisiGetir');

    try {
      const sRes = await karmedRawRequest({
        hostname: session.host,
        port: KARMED_PORT,
        path: '/Radiology/Rbys.aspx?action=TaniHizmetBilgisiGetir',
        method: 'POST',
        headers: {
          'X-Ext-Net': 'delta=true',
          'action': 'TaniHizmetBilgisiGetir',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': session.cookie,
          'Content-Length': Buffer.byteLength(tParams.toString()),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, tParams.toString());

      const updatedTok2 = extractKarmedLoginBilgi(sRes.body);
      if (updatedTok2) session.token = updatedTok2;

      const hizMatch = sRes.body.match(/App\.grdHizmetlerStore\.loadData\((\[.*?\])\);/s);
      let rawServices = [];
      if (hizMatch) {
        rawServices = safeParseExtNetJson(hizMatch[1]) || [];
      }

      // Xizmatlarni filtrlash: FAQAT MRT va MSKT!
      for (const s of rawServices) {
        const sName = (s.TetkikIsmi || s.HizmetAdi || '').toUpperCase();
        const sCode = (s.KodAra || s.HizmetKodu || '').toUpperCase();

        // MRT tekshiruvi ekanligini aniqlash
        const isMrt = sName.includes('MRT') || sName.includes('MR ') || sName.includes('MAGNIT') || dosyaRoom.includes('MR');
        // MSKT tekshiruvi ekanligini aniqlash
        const isMskt = sName.includes('MSKT') || sName.includes(' KT ') || sName.includes('KOMPYUTER') || dosyaRoom.includes('MSKT') || dosyaRoom.includes(' KT');

        // UTT, EKG, Rentgen, Endoskopiya va boshqalarni chiqarib tashlash
        const isExcluded = sName.includes('ULTRATOVUSH') || sName.includes('DOPLER') || sName.includes('EKG') || 
                            sName.includes('RENTGEN') || sName.includes('SKOPIYA') || sName.includes('BIOPSIYA') ||
                            dosyaRoom.includes('ULTRATOVUSH') || dosyaRoom.includes('EKG') || dosyaRoom.includes('RENTGEN');

        if ((isMrt || isMskt) && !isExcluded) {
          const isContrast = sName.includes('KONTRAST') || sName.includes('KM') || sName.includes('INJEKTOR');
          const modality = isMskt ? 'MSKT' : 'MRT';
          const suggestedDevice = isMskt ? 'mskt1' : (isContrast ? 'mrt1' : 'mrt2');
          // Qurilmalarga moslashtirish: MRT 2 da injektor yo'q (faqat kontrastsiz). MSKT faqat mskt1 da.
          const compatibleDevices = isMskt ? ['mskt1'] : (isContrast ? ['mrt1'] : ['mrt2', 'mrt1']);

          // Tekshiruvdan o'tganligini aniqlash (Karmed yoki navbat tizimida)
          const isCompletedInKarmed = Boolean(
            s.RaporOnayli === true ||
            s.RaporYazili === true ||
            s.RowClacss === 'HastaRenk_Onayli' ||
            s.serviceStatus === 'Tasdiqlangan' ||
            s.serviceStatus === 'Yozilgan' ||
            dosya.Durum === 'Rapor Onaylı' ||
            dosya.Durum === 'Tamamlandı' ||
            dosya.Durum === 'Bitti'
          );

          const isCompletedInQueue = currentQueue.some(q => 
            q.status === 'completed' && (
              (q.serviceId && String(q.serviceId) === String(s.Id)) ||
              (Array.isArray(q.serviceIds) && q.serviceIds.map(String).includes(String(s.Id)))
            )
          );

          const isCompleted = isCompletedInKarmed || isCompletedInQueue;

          // Tekshiruv allaqachon navbatga qo'yilganligini tekshirish
          let isAlreadyQueued = false;
          let existingQueueInfo = null;

          if (!isCompleted) {
            const activeQueueEntry = currentQueue.find(q => 
              q.status !== 'cancelled' && q.status !== 'completed' && (
                (q.serviceId && String(q.serviceId) === String(s.Id)) ||
                (Array.isArray(q.serviceIds) && q.serviceIds.map(String).includes(String(s.Id))) ||
                (Array.isArray(q.combinedServices) && q.combinedServices.some(cs => cs.serviceId && String(cs.serviceId) === String(s.Id))) ||
                (String(q.patientId) === String(patientInfo.patientId) && (
                  q.serviceCode === sCode || 
                  (q.serviceCode && q.serviceCode.split('+').map(x => x.trim()).includes(sCode))
                ))
              )
            );

            if (activeQueueEntry) {
              isAlreadyQueued = true;
              existingQueueInfo = {
                id: activeQueueEntry.id,
                ticketNumber: activeQueueEntry.ticketNumber,
                scheduledDate: activeQueueEntry.scheduledDate || activeQueueEntry.date,
                scheduledTime: activeQueueEntry.scheduledTime || '',
                deviceId: activeQueueEntry.deviceId,
                status: activeQueueEntry.status,
                statusText: activeQueueEntry.status === 'waiting' ? 'Kutilmoqda' : (activeQueueEntry.status === 'calling' ? 'Chaqirilgan' : (activeQueueEntry.status === 'in_progress' ? 'Jarayonda' : activeQueueEntry.status)),
                operatorName: activeQueueEntry.operatorName || ''
              };
            }
          }

          let labResults = cachedPatientLab;

          let examDuration = (modality === 'MSKT') ? 30 : 60;
          try {
            const servicesCatalog = readJson(SERVICES_FILE, []);
            const matchedService = servicesCatalog.find(sc => sc.code === sCode);
            if (matchedService && matchedService.duration && matchedService.duration !== 20 && matchedService.duration !== 25 && matchedService.duration !== 35 && matchedService.duration !== 45) {
              examDuration = parseInt(matchedService.duration, 10);
            }
          } catch (e) {}

          const isOlderThan10Days = diffDays > 10;

          eligibleExams.push({
            dosyaId: dosya.Id,
            protokolNo: dosya.ProtokolNo,
            serviceId: s.Id,
            mrrsSiraNo: s.MrrsSiraNo || dosya.MuayeneSirano || null,
            serviceCode: sCode,
            serviceName: s.TetkikIsmi || s.HizmetAdi,
            modality: modality,
            suggestedDevice: suggestedDevice,
            compatibleDevices: compatibleDevices,
            isContrast: isContrast,
            durationMinutes: examDuration,
            labResults: labResults,
            doctorName: s.IDoktorAdSoyad || s.DoktorAdSoyad || dosya.DosyaDoktoru || '',
            roomName: dosya.AltBolumAdi || dosya.OdaAdi || '',
            dosyaStatus: dosya.Durum || 'Bekleyen',
            serviceStatus: (s.RaporOnayli || dosya.Durum === 'Rapor Onaylı') ? 'Tasdiqlangan' : (s.RaporYazili ? 'Yozilgan' : 'Kutilmoqda'),
            isCompleted: isCompleted,
            completedReason: isCompleted ? (isCompletedInKarmed ? 'Karmedda xulosa tasdiqlangan' : 'Tekshiruv o\'tkazilgan') : null,
            isAlreadyQueued: isAlreadyQueued,
            existingQueueInfo: existingQueueInfo,
            canBook: !isCompleted && !isAlreadyQueued && !isOlderThan10Days,
            registrationDate: regDate.toISOString().split('T')[0],
            registrationTime: regDate.toTimeString().substring(0, 5),
            diffDays: diffDays,
            isOlderThan5Days: isOlderThan5Days,
            isOlderThan10Days: isOlderThan10Days,
            maxAllowedDate: maxAllowedDate,
            paymentStatus: s.BorcDurumu || (dosya.Ucretli ? 'ÖDENMEDİ' : 'TO\'LANGAN')
          });
        }
      }
    } catch (e) {
      console.warn(`[Karmed Service Fetch Warning] Dosya ${dosya.Id}:`, e.message);
    }
  }

  // Tartiblash:
  // 1. O'tkazilmagan (kutilayotgan) tekshiruvlar birinchi o'rinda chiqsin
  // 2. O'tkazilgan tekshiruvlar esa keyin chiqsin
  eligibleExams.sort((a, b) => {
    if (!a.isCompleted && b.isCompleted) return -1;
    if (a.isCompleted && !b.isCompleted) return 1;
    return new Date(b.registrationDate) - new Date(a.registrationDate);
  });

  return {
    success: true,
    found: true,
    patient: patientInfo,
    eligibleExams: eligibleExams,
    hasEligibleExams: eligibleExams.length > 0
  };
}

// -------------------------------------------------------------
// AQLLI SLOT HISOBLASH VA NAVBATGA YOZISH
// -------------------------------------------------------------
function findNextAvailableSmartSlot(input) {
  const queue = readJson(QUEUE_FILE, []);
  return scheduler.findNextAvailableSmartSlot(input, queue);
}

// -------------------------------------------------------------
// HTTP SERVER VA ROUTING (PORT: 9891)
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Operator-Token'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // =========================================================================
  // 0. QAT'IY QOIDA: REGISTRATURA FAQAT SHIFOХONA LOKAL TARMOG'IDA (LAN) ISHLAYDI!
  //    Masofaviy Cloudflare tunnel, ngrok yoki public proksilar orqali kirish taqiqlanadi!
  // =========================================================================
  const hostHdr = (req.headers['host'] || '').toLowerCase();
  const isTunnelRequest = Boolean(
    req.headers['cf-connecting-ip'] || 
    req.headers['cf-ray'] || 
    hostHdr.includes('trycloudflare.com') || 
    hostHdr.includes('ngrok') || 
    hostHdr.includes('github.io')
  );

  if (isTunnelRequest) {
    if (pathname.startsWith('/api/')) {
      return sendJson(res, {
        success: false,
        error: "⛔ Registratura agenti faqat shifoxona lokal tarmog'ida (LAN) ishlaydi! Masofaviy tunnel orqali kirish taqiqlangan."
      }, 403);
    }
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(`
      <!DOCTYPE html>
      <html lang="uz">
      <head>
        <meta charset="utf-8">
        <title>403 Taqiqlangan (Faqat Lokal Tarmoq)</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; background:#f8fafc; margin:0; }
          .box { background:#ffffff; border:2px solid #ef4444; border-radius:16px; padding:32px; max-width:480px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.08); }
          h2 { color:#b91c1c; margin-bottom:12px; }
          p { color:#475569; font-size:14px; line-height:1.5; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>⛔ 403: Ruxsat berilmagan</h2>
          <p><b>Registratura Serveri (Port 9891)</b> faqat shifoxona <b>ichki lokal tarmog'ida (LAN)</b> ishlashga ruxsat etilgan.</p>
          <p style="color:#ef4444; font-weight:700; margin-top:12px;">Masofaviy tunnel orqali registratsiya oynasiga kirish qat'iyan taqiqlangan.</p>
          <p style="font-size:12px; color:#94a3b8; margin-top:20px;">Shifoxona ichki tarmog'iga ulanib, <code>http://10.34.14.33:9891</code> orqali kiring.</p>
        </div>
      </body>
      </html>
    `);
  }

  const clientPerm = checkClientIpPermission(req);

  // =========================================================================
  // 1. IP RUXSATINI TEKSHIRISH (ACCESS CONTROL)
  // =========================================================================
  if (!clientPerm.allowed) {
    // Agar IP ga ruxsat berilmagan bo'lsa
    if (pathname === '/api/request-access' && req.method === 'POST') {
      const body = await readBody(req);
      const pcName = body.name || 'Lokal Kompyuter';
      
      const ipData = readJson(ALLOWED_IPS_FILE, { allowed: [], pending: [] });
      ipData.pending = ipData.pending || [];

      let pEntry = ipData.pending.find(p => p.ip === clientPerm.ip);
      if (!pEntry) {
        pEntry = {
          ip: clientPerm.ip,
          name: pcName,
          requestedAt: new Date().toISOString()
        };
        ipData.pending.push(pEntry);
        writeJson(ALLOWED_IPS_FILE, ipData);
      }

      return sendJson(res, { success: true, message: "Ruxsat so'rovi adminga yuborildi", entry: pEntry });
    }

    if (pathname === '/api/check-access') {
      return sendJson(res, { allowed: false, ip: clientPerm.ip });
    }

    // Bloklangan / Ruxsat so'rash sahifasini ko'rsatish
    res.writeHead(403, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(renderAccessDeniedHtml(clientPerm.ip));
    return;
  }

  // =========================================================================
  // 2. REST API ENDPOINTS
  // =========================================================================
  if (pathname.startsWith('/api/')) {

    // GET /api/check-access - IP ruxsat holatini tekshirish
    if (pathname === '/api/check-access') {
      return sendJson(res, { allowed: true, role: clientPerm.role, ip: clientPerm.ip });
    }

    // POST /api/auth/login - Operator autentifikatsiyasi (TB1, TB2, TB3 / 14520)
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readBody(req);
      const username = String(body.username || '').toUpperCase().trim();
      const password = String(body.password || '').trim();

      const op = OPERATORS[username];
      if (!op || op.pass !== password) {
        return sendJson(res, { success: false, error: "Login yoki parol xato!" }, 401);
      }

      const token = `op_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const sessionData = {
        token,
        username: op.username,
        name: op.name,
        loginTime: new Date().toISOString()
      };
      activeSessions.set(token, sessionData);

      return sendJson(res, {
        success: true,
        token,
        operator: { username: op.username, name: op.name }
      });
    }

    // GET /api/auth/me - Joriy operator va IP holati
    if (pathname === '/api/auth/me') {
      const token = req.headers['x-operator-token'];
      const session = activeSessions.get(token);
      return sendJson(res, {
        authenticated: Boolean(session),
        operator: session ? { username: session.username, name: session.name } : null,
        clientIp: clientPerm.ip,
        role: clientPerm.role
      });
    }

    // POST /api/auth/logout - Chiqish
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = req.headers['x-operator-token'];
      if (token) activeSessions.delete(token);
      return sendJson(res, { success: true });
    }

    // POST /api/auth/change-password - Operator parolini o'zgartirish
    if (pathname === '/api/auth/change-password' && req.method === 'POST') {
      const token = req.headers['x-operator-token'];
      const session = activeSessions.get(token);
      if (!session) return sendJson(res, { success: false, error: "Avtorizatsiyadan o'tilmagan" }, 401);

      const body = await readBody(req);
      const currentPass = String(body.currentPassword || body.oldPassword || '').trim();
      const newPass = String(body.newPassword || '').trim();
      const newName = String(body.name || body.newName || '').trim();

      const op = OPERATORS[session.username];
      if (!op || op.pass !== currentPass) {
        return sendJson(res, { success: false, error: "Joriy parol noto'g'ri!" }, 400);
      }
      if (newPass) {
        if (newPass.length < 4) {
          return sendJson(res, { success: false, error: "Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak!" }, 400);
        }
        op.pass = newPass;
      }
      if (newName) {
        op.name = newName;
        session.name = newName;
      }
      writeJson(OPERATORS_FILE, OPERATORS);

      return sendJson(res, { success: true, message: "Profil muvaffaqiyatli yangilandi!" });
    }

    // GET /api/printers - Kompyuterda o'rnatilgan printerlar ro'yxati (Registrator Agenti)
    if (pathname === '/api/printers' && req.method === 'GET') {
      const psCmd = 'powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PortName | ConvertTo-Json"';
      exec(psCmd, { timeout: 8000 }, (err, stdout) => {
        if (err || !stdout) {
          return sendJson(res, { success: true, printers: [{ name: 'Standart Printer (Tizim)', isDefault: true }] });
        }
        try {
          let parsed = JSON.parse(stdout.trim());
          if (!Array.isArray(parsed)) parsed = [parsed];
          const printers = parsed.map(p => ({
            name: p.Name,
            isDefault: Boolean(p.Default),
            port: p.PortName
          }));
          return sendJson(res, { success: true, printers });
        } catch (e) {
          return sendJson(res, { success: true, printers: [{ name: 'Standart Printer (Tizim)', isDefault: true }] });
        }
      });
      return;
    }

    // GET /api/printer-settings - Printer va chop etish sozlamalarini olish
    if (pathname === '/api/printer-settings' && req.method === 'GET') {
      const settings = readJson(PRINTER_SETTINGS_FILE, {
        ticketPrinter: '',
        consentPrinter: '',
        autoPrint: false
      });
      return sendJson(res, { success: true, settings });
    }

    // POST /api/printer-settings - Printer va chop etish sozlamalarini saqlash
    if (pathname === '/api/printer-settings' && req.method === 'POST') {
      const body = await readBody(req);
      const settings = {
        ticketPrinter: String(body.ticketPrinter || '').trim(),
        consentPrinter: String(body.consentPrinter || '').trim(),
        autoPrint: Boolean(body.autoPrint),
        updatedAt: new Date().toISOString()
      };
      writeJson(PRINTER_SETTINGS_FILE, settings);
      return sendJson(res, { success: true, settings, message: "Printer sozlamalari saqlandi" });
    }

    // POST /api/print - Registrator agenti orqali chop etish
    if (pathname === '/api/print' && req.method === 'POST') {
      const body = await readBody(req);
      const printerName = String(body.printerName || '').trim();
      const docType = body.docType || 'ticket';
      const printText = body.text || '';
      const printHtml = body.html || '';

      if (printerName && printText) {
        try {
          const tempTxtFile = path.join(DATA_DIR, `temp_${docType}_${Date.now()}.txt`);
          fs.writeFileSync(tempTxtFile, printText, 'utf8');
          const safePrinter = printerName.replace(/'/g, "''");
          const psPrintCmd = `powershell -NoProfile -Command "Get-Content -Path '${tempTxtFile}' -Encoding UTF8 | Out-Printer -Name '${safePrinter}'"`;
          exec(psPrintCmd, { timeout: 10000 }, (err) => {
            try { if (fs.existsSync(tempTxtFile)) fs.unlinkSync(tempTxtFile); } catch(e) {}
            if (err) console.warn("[Local Print Warn]:", err.message);
          });
        } catch (pe) {
          console.warn("[Local Agent Print Error]:", pe.message);
        }
      }

      if (printHtml) {
        try {
          fs.writeFileSync(path.join(DATA_DIR, `last_${docType}.html`), printHtml, 'utf8');
        } catch (e) {}
      }

      return sendJson(res, {
        success: true,
        printer: printerName || 'Default',
        docType: docType,
        message: printerName ? `Printerga chop etish buyrug'i berildi: ${printerName}` : "Chop etish hujjati tayyorlandi"
      });
    }

    // GET /api/exam-configs - Tekshiruvlar sozlamalari, tayyorgarlik va rozilik savollari
    if (pathname === '/api/exam-configs' && req.method === 'GET') {
      const services = readJson(SERVICES_FILE, []);
      const consentQuestions = readJson(CONSENT_QUESTIONS_FILE, []);
      return sendJson(res, { success: true, services, consentQuestions });
    }

    // POST /api/internal/ws-sync - Boshqa portlardan (masalan 9890) kelgan WS sinxronizatsiya
    if (pathname === '/api/internal/ws-sync' && req.method === 'POST') {
      return sendJson(res, { success: true });
    }

    // POST /api/karmed/search - Bemor ID bo'yicha qidirish (Yagona Karmed drayveri)
    if (pathname === '/api/karmed/search' && req.method === 'POST') {
      const body = await readBody(req);
      const patientId = String(body.patientId || body.query || '').trim();

      if (!patientId) {
        return sendJson(res, { success: false, error: "Bemor ID kiritilishi shart" }, 400);
      }

      try {
        const result = await unifiedCore.searchPatientInKarmed(patientId);
        return sendJson(res, result);
      } catch (err) {
        console.error("[Karmed Search Error on 9891]:", err.message);
        return sendJson(res, { success: false, error: `Karmed aloqa xatosi: ${err.message}` }, 502);
      }
    }

    // GET /api/devices - Apparatlar ro'yxati
    if (pathname === '/api/devices' && req.method === 'GET') {
      const devices = readJson(DEVICES_FILE, unifiedCore.DEFAULT_DEVICES);
      return sendJson(res, { success: true, devices });
    }

    // POST /api/devices - Apparat sozlamalarini saqlash
    if (pathname === '/api/devices' && req.method === 'POST') {
      const body = await readBody(req);
      const devices = readJson(DEVICES_FILE, unifiedCore.DEFAULT_DEVICES);
      if (Array.isArray(body)) {
        writeJson(DEVICES_FILE, body);
        unifiedCore.broadcastWs('devices_updated', body);
        return sendJson(res, { success: true, devices: body, message: "Apparatlar ro'yxati saqlandi" });
      } else if (body && body.id) {
        const idx = devices.findIndex(d => d.id === body.id);
        if (idx !== -1) {
          devices[idx] = { ...devices[idx], ...body };
        } else {
          devices.push(body);
        }
        writeJson(DEVICES_FILE, devices);
        unifiedCore.broadcastWs('devices_updated', devices);
        return sendJson(res, { success: true, device: devices[idx !== -1 ? idx : devices.length - 1], message: "Apparat sozlamalari saqlandi" });
      }
      return sendJson(res, { success: false, error: "Noto'g'ri apparat ma'lumotlari" }, 400);
    }

    // GET & POST /api/admin/schedules
    if (pathname === '/api/admin/schedules' && req.method === 'GET') {
      const schedules = readJson(SCHEDULES_FILE, {});
      return sendJson(res, { success: true, schedules });
    }
    if (pathname === '/api/admin/schedules' && req.method === 'POST') {
      const body = await readBody(req);
      writeJson(SCHEDULES_FILE, body);
      return sendJson(res, { success: true, schedules: body, message: "Ish grafiklari saqlandi!" });
    }

    // GET /api/schedules - Ish grafiklarini olish
    if (pathname === '/api/schedules' && req.method === 'GET') {
      const schedules = readJson(SCHEDULES_FILE, {});
      return sendJson(res, { success: true, schedules });
    }

    // POST /api/schedules - Ish grafiklarini saqlash
    if (pathname === '/api/schedules' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object') {
        return sendJson(res, { success: false, error: "Noto'g'ri ma'lumot formati" }, 400);
      }
      writeJson(SCHEDULES_FILE, body);
      return sendJson(res, { success: true, schedules: body, message: "Ish grafiklari muvaffaqiyatli saqlandi!" });
    }

    // POST /api/queue/available-slots - Sana va apparat bo'yicha bo'sh va band vaqtlarni hisoblash
    if (pathname === '/api/queue/available-slots' && req.method === 'POST') {
      const body = await readBody(req);
      const targetDate = body.date || body.scheduledDate;
      const deviceId = body.deviceId || 'mrt1';
      const durationMinutes = parseInt(body.durationMinutes || (deviceId === 'mskt1' ? 30 : 60), 10);
      const queue = readJson(QUEUE_FILE, []);

      const result = scheduler.getAvailableSlotsForDay(targetDate, deviceId, durationMinutes, queue);
      return sendJson(res, result);
    }

    // POST /api/queue/smart-slot - Eng yaqin bo'sh slotni hisoblash
    if (pathname === '/api/queue/smart-slot' && req.method === 'POST') {
      const body = await readBody(req);
      const queue = readJson(QUEUE_FILE, []);
      const slot = scheduler.findNextAvailableSmartSlot(body, queue);
      return sendJson(res, slot);
    }

    // POST /api/queue/book - Navbatga qo'yish (Yagona drayver)
    if (pathname === '/api/queue/book' && req.method === 'POST') {
      if (clientPerm.role === 'view_only') {
        return sendJson(res, { success: false, error: "Ushbu kompyuterga faqat kuzatish ruxsati berilgan!" }, 403);
      }

      const body = await readBody(req);
      const token = req.headers['x-operator-token'];
      const session = activeSessions.get(token);
      const operatorName = session ? `${session.username} (${session.name})` : 'Registrator';

      // To'lov tasdiqlanishi shart (Statsionar bundan mustasno)
      if (body.patientType !== 'Statsionar' && body.requiresPaymentConfirmation && body.paymentConfirmed !== true) {
        return sendJson(res, {
          success: false,
          error: "To'lov tasdiqlanmagan! Rezident yoki No-rezident bemorlar uchun avval kassada to'lov qilinishi shart."
        }, 400);
      }

      const resData = unifiedCore.bookPatient(body, operatorName, false);
      return sendJson(res, resData, resData.statusCode || (resData.success ? 200 : 400));
    }

    // POST /api/queue/call - Bemorni chaqirish
    if (pathname === '/api/queue/call' && req.method === 'POST') {
      const body = await readBody(req);
      const queue = readJson(QUEUE_FILE, []);
      const patient = queue.find(p => p.id === body.id);
      if (!patient) return sendJson(res, { success: false, error: "Bemor topilmadi" }, 404);

      patient.status = 'calling';
      patient.calledAt = new Date().toISOString();
      writeJson(QUEUE_FILE, queue);
      unifiedCore.broadcastWs('patient_called', { patientId: patient.id, patient });
      return sendJson(res, { success: true, patient, message: `Bemor xonaga chaqirildi (${patient.ticketNumber})` });
    }

    // POST /api/queue/status - Holatni o'zgartirish
    if (pathname === '/api/queue/status' && req.method === 'POST') {
      const body = await readBody(req);
      const queue = readJson(QUEUE_FILE, []);
      const devices = readJson(DEVICES_FILE, unifiedCore.DEFAULT_DEVICES);
      const patient = queue.find(p => p.id === body.id);
      if (!patient) return sendJson(res, { success: false, error: "Bemor topilmadi" }, 404);

      patient.status = body.status;
      patient.updatedAt = new Date().toISOString();
      const dev = devices.find(d => d.id === patient.deviceId);
      if (body.status === 'in_progress') {
        patient.startedAt = new Date().toISOString();
        if (dev) dev.currentPatientId = patient.id;
      } else if (body.status === 'completed' || body.status === 'cancelled') {
        patient.finishedAt = new Date().toISOString();
        if (dev && dev.currentPatientId === patient.id) dev.currentPatientId = null;
      }
      writeJson(QUEUE_FILE, queue);
      writeJson(DEVICES_FILE, devices);
      unifiedCore.broadcastWs('queue_updated', { queue, devices });
      return sendJson(res, { success: true, patient });
    }

    // POST /api/queue/delete - Bemorni o'chirish
    if (pathname === '/api/queue/delete' && req.method === 'POST') {
      const body = await readBody(req);
      let queue = readJson(QUEUE_FILE, []);
      const devices = readJson(DEVICES_FILE, unifiedCore.DEFAULT_DEVICES);
      const idx = queue.findIndex(p => p.id === body.id);
      if (idx === -1) return sendJson(res, { success: false, error: "Bemor topilmadi" }, 404);

      const deleted = queue.splice(idx, 1)[0];
      const dev = devices.find(d => d.id === deleted.deviceId);
      if (dev && dev.currentPatientId === deleted.id) {
        dev.currentPatientId = null;
        writeJson(DEVICES_FILE, devices);
      }
      writeJson(QUEUE_FILE, queue);
      unifiedCore.broadcastWs('queue_updated', { queue, devices });
      return sendJson(res, { success: true, deleted });
    }

    // GET /api/queue - Navbatlarni ko'rish
    if (pathname === '/api/queue') {
      const targetDate = parsedUrl.query.date || new Date().toISOString().split('T')[0];
      const allQueue = readJson(QUEUE_FILE, []);
      const devices = readJson(DEVICES_FILE, unifiedCore.DEFAULT_DEVICES);
      const dayQueue = allQueue.filter(p => (p.date === targetDate || p.scheduledDate === targetDate));

      return sendJson(res, {
        success: true,
        date: targetDate,
        queue: dayQueue,
        devices: devices
      });
    }

    return sendJson(res, { success: false, error: "API topilmadi" }, 404);
  }

  // =========================================================================
  // 3. STATIK INTERFEYS UZATISH (PORTAL UI)
  // =========================================================================
  let reqPath = decodeURI(pathname);
  if (reqPath === '/' || reqPath === '/index.html' || reqPath === '/registration' || reqPath === '/queue') {
    reqPath = '/public/mrt_registration.html';
  } else if (reqPath === '/control' || reqPath === '/admin' || reqPath === '/doctor') {
    reqPath = '/public/mrt_control.html';
  } else if (reqPath === '/tv' || reqPath === '/tv/' || reqPath === '/mrt-tv' || reqPath === '/tablo') {
    reqPath = '/mrt-tv/index.html';
  } else if (reqPath === '/style.css' && !fs.existsSync(path.join(ROOT_DIR, 'style.css'))) {
    reqPath = '/mrt-tv/style.css';
  } else if (reqPath === '/app.js' && !fs.existsSync(path.join(ROOT_DIR, 'app.js'))) {
    reqPath = '/mrt-tv/app.js';
  }

  const filePath = path.join(ROOT_DIR, reqPath);
  const ext = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 - Sahifa topilmadi (${reqPath})</h1>`);
    } else {
      res.writeHead(200, { 'Content-Type': contentType, 'Access-Control-Allow-Origin': '*' });
      res.end(content);
    }
  });
});

// Ruxsati bo'lmagan kompyuterlar uchun sahifa
function renderAccessDeniedHtml(ip) {
  return `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="UTF-8">
  <title>Kirish Cheklangan — MRT & MSKT Navbat Portali</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #fff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 32px; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    .icon { font-size: 54px; color: #ef4444; margin-bottom: 16px; }
    h2 { margin: 0 0 10px 0; font-size: 22px; font-weight: 900; }
    p { color: #64748b; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0; }
    .ip-badge { background: #fee2e2; color: #991b1b; padding: 6px 14px; border-radius: 8px; font-weight: 900; font-family: monospace; font-size: 15px; display: inline-block; margin-bottom: 20px; }
    input { width: 100%; padding: 12px; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 14px; margin-bottom: 12px; box-sizing: border-box; }
    button { width: 100%; padding: 12px; background: #0284c7; color: #fff; border: none; border-radius: 8px; font-size: 15px; font-weight: 800; cursor: pointer; transition: background 0.2s; }
    button:hover { background: #0369a1; }
    .alert-success { background: #dcfce7; color: #166534; padding: 12px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-top: 14px; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon"><i class="fa-solid fa-shield-halved"></i></div>
    <h2>Kirish Cheklangan</h2>
    <p>Ushbu kompyuter uchun Navbat Portali (Port 9891) ga kirish ruxsati hali tasdiqlanmagan.</p>
    <div class="ip-badge">Sizning IP: ${ip}</div>
    
    <div id="requestArea">
      <input type="text" id="pcName" placeholder="Kompyuter nomi (masalan: 1-MRT Laborant xonasi)" required>
      <button onclick="submitAccessRequest()"><i class="fa-solid fa-paper-plane"></i> Admindan Ruxsat So'rash</button>
      <div style="font-size:12px; color:#94a3b8; margin-top:12px;">Ruxsat berilgach, sahifani yangilang yoki avtomatik ochiladi.</div>
    </div>

    <div id="successMsg" class="alert-success">
      ✅ Ruxsat so'rovi yuborildi! Asosiy serverdagi admin (http://localhost:9890/control) ruxsat bergach sahifa avtomatik ochiladi.
    </div>
  </div>

  <script>
    async function submitAccessRequest() {
      const name = document.getElementById("pcName").value.trim() || "Lokal Kompyuter";
      try {
        const res = await fetch("/api/request-access", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name })
        });
        const d = await res.json();
        if (d.success) {
          document.getElementById("requestArea").style.display = "none";
          document.getElementById("successMsg").style.display = "block";
          setInterval(checkAccessPeriodically, 3000);
        }
      } catch (e) {
        alert("Server bilan ulanish xatosi");
      }
    }

    async function checkAccessPeriodically() {
      try {
        const res = await fetch("/api/check-access");
        const d = await res.json();
        if (d.allowed) {
          window.location.reload();
        }
      } catch (e) {}
    }
  </script>
</body>
</html>`;
}

// -------------------------------------------------------------
// SERVERNI ISHGA TUSHIRISH
// -------------------------------------------------------------
server.listen(PORT, HOST, () => {
  console.log('===============================================================');
  console.log(`🏥 MRT & MSKT NAVBATGA QO'YISH PORTALI ISHGA TUSHDI!`);
  console.log(`🌐 Mahalliy manzil: http://localhost:${PORT}`);
  console.log(`🌐 Tarmoq manzili:  http://0.0.0.0:${PORT}`);
  console.log(`🔐 Yashirin Karmed: ${KARMED_USERNAME} (17720)`);
  console.log(`👥 Operatorlar:     TB1 (Saida'lo), TB2 (Nigora), TB3 (Isfandiyor)`);
  console.log(`🛡️ IP Nazorati:     http://localhost:9890/control dan ruxsat`);
  console.log('===============================================================');

  // Server boshlanishi bilan Karmedga yashirin kirishni tayyorlab qo'yish
  loginToKarmedLive().catch(err => {
    console.warn('[Startup Karmed Notice]:', err.message);
  });
});
