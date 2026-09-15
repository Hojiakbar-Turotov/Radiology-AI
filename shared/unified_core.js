/**
 * ==============================================================================
 *  🏥 KARMED MRT & MSKT YAGONA BAZA VA TIZIM DVIGATELI (shared/unified_core.js)
 * ==============================================================================
 *  - 100% Yagona Ma'lumotlar Bazasi (data/mrt_queue.json, devices.json, schedules.json)
 *  - Birlashtirilgan Karmed Sessiyasi (R5 / 17720) & LBYS Laboratoriya Natijalari
 *  - Barcha Ekranlar (TV, Admin, Registratura) uchun Real-time WebSocket Ko'prigi
 *  - MSKT (30 daqiqa) va MRT (60 daqiqa) Standart Vaqtlari & Birlashtirilgan Qoidalar
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) {}
}

const QUEUE_FILE = path.join(DATA_DIR, 'mrt_queue.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const KARMED_PROFILES_FILE = path.join(DATA_DIR, 'karmed_profiles.json');
const OPERATORS_FILE = path.join(DATA_DIR, 'operators.json');
const PRINTER_SETTINGS_FILE = path.join(DATA_DIR, 'printer_settings.json');
const CONSENT_QUESTIONS_FILE = path.join(DATA_DIR, 'consent_questions.json');
const ALLOWED_IPS_FILE = path.join(DATA_DIR, 'allowed_ips.json');
const USERS_FILE = path.join(DATA_DIR, 'bot_users.json');
const BOT_SETTINGS_FILE = path.join(DATA_DIR, 'bot_settings.json');

const scheduler = require('./scheduler');

const KARMED_USERNAME = 'R5';
const KARMED_PASSWORD = '17720';
const KARMED_HOSTS = ['192.168.150.111', '213.230.91.59'];
const KARMED_PORT = 2025;

const DEFAULT_DEVICES = [
  {
    id: "mrt1",
    name: "1-MRT (1.5 Tesla)",
    room: "1-MRT Xonasi",
    type: "MRT",
    hasInjector: true,
    supportsContrast: true,
    status: "active",
    currentPatientId: null
  },
  {
    id: "mrt2",
    name: "2-MRT (1.5 Tesla)",
    room: "2-MRT Xonasi",
    type: "MRT",
    hasInjector: false,
    supportsContrast: false,
    status: "active",
    currentPatientId: null
  },
  {
    id: "mskt1",
    name: "MSKT 1 (Kompyuter Tomografiyasi)",
    room: "MSKT Xonasi",
    type: "MSKT",
    hasInjector: true,
    supportsContrast: true,
    status: "active",
    currentPatientId: null
  }
];

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

const activeSessions = new Map();

// Karmed sessiyasi keshda
let karmedLiveSession = {
  token: '',
  cookie: '',
  host: KARMED_HOSTS[0],
  lastLogin: null
};

// -------------------------------------------------------------
// WEBSOCKET HUB (REAL-TIME BROADCAST)
// -------------------------------------------------------------
const wsClients = new Set();

function registerWsClient(ws) {
  wsClients.add(ws);
}

function removeWsClient(ws) {
  wsClients.delete(ws);
}

function broadcastWs(type, payload, isLoopback = false) {
  const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of wsClients) {
    if (client && client.readyState === 1) { // OPEN
      try { client.send(msg); } catch (e) {}
    }
  }

  // Agar loopback xabari bo'lsa yoki portlar o'rtasida qayta aylanmasligi uchun to'xtatish
  if (isLoopback) return;

  try {
    const currentPort = parseInt(process.env.PORT || '9890', 10);
    const targetPort = (currentPort === 9890) ? 9891 : 9890;
    const req = http.request({
      hostname: '127.0.0.1',
      port: targetPort,
      path: '/api/internal/ws-sync',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 800
    }, (res) => {
      res.resume(); // Xotirada to'planib qolmasligi uchun oqimni yakunlash
    });
    req.on('error', () => {});
    req.write(JSON.stringify({ type, payload, _isLoopback: true }));
    req.end();
  } catch (e) {}
}

// -------------------------------------------------------------
// FAYL VA TARMOQ YORDAMCHILARI
// -------------------------------------------------------------
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Operator-Token'
  });
  res.end(JSON.stringify(data));
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

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
        const gsmKimlikMatches = [...body.matchAll(/TxtGsmKimlik\.setValue\(\\"([^\\"]*)\\"\)/g)];
        for (const m of gsmKimlikMatches) {
          if (m[1] && m[1].trim() && m[1].trim() !== '000') {
            phone = m[1].trim();
            break;
          }
        }
        if (!phone) {
          const adresMatch = body.match(/frmAdresBilgi\.getForm\(\)\.setValues\((\{.+?\})\);/);
          if (adresMatch) {
            try {
              const unescaped = adresMatch[1].replace(/\\"/g, '"');
              const aJson = JSON.parse(unescaped);
              phone = aJson.Gsm || aJson.Tel || aJson.Telefon || '';
            } catch (e) {}
          }
        }
        if (phone && phone.trim() !== '000' && phone.trim() !== '0') {
          return formatUzbekPhone(phone);
        }
      }
    }
  } catch (err) {
    console.warn(`[Karmed Phone Fetch Warn] ID ${patientId}:`, err.message);
  }
  return '';
}

function extractLabFromTests(tests) {
  if (!Array.isArray(tests)) return null;
  let kreatinin = null;
  let mochevina = null;
  const now = new Date();

  tests.forEach(t => {
    const tName = String(t.TetkikAdi || t.TahlilAdi || t.IslemAdi || t.TestAdi || '').toLowerCase();
    const val = String(t.Sonuc || t.Deger || '').trim();
    if (!val || val === '-' || val === 'null') return;

    let resDate = t.OnayTarihi || t.SonucTarihi || t.KayitTarihi || t.Tarih || '';
    if (typeof resDate === 'string' && resDate.includes('/Date(')) {
      const match = resDate.match(/\/Date\((\d+)\)\//);
      if (match) resDate = new Date(parseInt(match[1], 10)).toISOString().split('T')[0];
    } else if (typeof resDate === 'string' && resDate.includes('T')) {
      resDate = resDate.split('T')[0];
    }

    let daysAgo = null;
    if (resDate) {
      const d = new Date(resDate);
      if (!isNaN(d.getTime())) {
        daysAgo = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const testItem = {
      testName: t.TetkikAdi || t.TahlilAdi || 'Laboratoriya',
      value: val,
      unit: t.Birim || 'mkmol/l',
      reference: t.Referans || t.ReferansAraligi || t.NormalDeger || '53 - 115',
      date: resDate,
      daysAgo: daysAgo !== null ? daysAgo : 0
    };

    if (tName.includes('kreatin') && !kreatinin) {
      kreatinin = testItem;
    } else if ((tName.includes('mochev') || tName.includes('mochevina') || tName.includes('urea') || tName.includes('karbamid')) && !mochevina) {
      mochevina = testItem;
    }
  });

  if (kreatinin || mochevina) {
    return {
      found: true,
      kreatinin: kreatinin,
      mochevina: mochevina,
      hasRecentLab: (kreatinin && kreatinin.daysAgo <= 30) || (mochevina && mochevina.daysAgo <= 30)
    };
  }
  return null;
}

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

async function fetchPatientLabResults(kimlikId, onkayitIds, token, cookie, host) {
  try {
    const trafficLab = searchLabInTrafficLogs(kimlikId);
    if (trafficLab) {
      return trafficLab;
    }

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

      try {
        const dosyaListObj = {
          '__EVENTTARGET': 'ResourceManager1',
          '__EVENTARGUMENT': '-|public|DosyaListele',
          '__VIEWSTATEGENERATOR': 'EB15314C',
          'hdnKrmdLoginBilgi': decodeURIComponent(activeToken || ''),
          'submitDirectEventConfig': JSON.stringify({ config: { extraParams: {} } }),
          'CmbTumDosyalar': 'Barcha fayllar'
        };
        const dData = new URLSearchParams(dosyaListObj).toString();
        const dRes = await karmedRawRequest({
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
            'Referer': `http://${activeHost}:${KARMED_PORT}` + targetPath,
            'Content-Length': Buffer.byteLength(dData),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }, dData, 8000);

        const mDosyaStore = dRes.body.match(/App\.StoreHastaDosyalari\.proxy\.data\s*=\s*(\[.*?\]);/s);
        if (mDosyaStore) {
          const unescapedD = mDosyaStore[1].replace(/\\"/g, '"').replace(/new Date\([^)]+\)/g, '"2026-09-09"');
          const dList = JSON.parse(unescapedD);

          for (const dItem of dList.slice(0, 5)) {
            const dId = dItem.DosyaId || dItem.Id;
            if (!dId) continue;

            const labDetayObj = {
              '__EVENTTARGET': 'ResourceManager1',
              '__EVENTARGUMENT': '-|public|DetayGoster',
              '__VIEWSTATEGENERATOR': 'EB15314C',
              'hdnKrmdLoginBilgi': decodeURIComponent(activeToken || ''),
              'submitDirectEventConfig': JSON.stringify({ config: { extraParams: { aDosyaId: parseInt(dId, 10) } } })
            };
            const ldData = new URLSearchParams(labDetayObj).toString();
            const ldRes = await karmedRawRequest({
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
                'Referer': `http://${activeHost}:${KARMED_PORT}` + targetPath,
                'Content-Length': Buffer.byteLength(ldData),
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            }, ldData, 8000);

            const mTests = ldRes.body.match(/App\.StoreLda\.proxy\.data\s*=\s*(\[.*?\]);/s);
            if (mTests) {
              const unescapedTests = mTests[1].replace(/\\"/g, '"').replace(/new Date\([^)]+\)/g, '"2026-09-09"');
              const tests = JSON.parse(unescapedTests);
              const extracted = extractLabFromTests(tests);
              if (extracted) return extracted;
            }
          }
        }
      } catch (e) {}
    }
  } catch (err) {
    console.warn(`[Karmed Lab Fetch Warn] Kimlik ${kimlikId}:`, err.message);
  }

  return { found: false, kreatinin: null, mochevina: null, hasRecentLab: false };
}

// -------------------------------------------------------------
// BEMORNI KARMEDDAN QIDIRISH (HASTASORGULA)
// -------------------------------------------------------------
async function searchPatientInKarmed(patientId) {
  let session = await getActiveKarmedSession();

  const performSearch = async (token, cookie, host) => {
    const params = new URLSearchParams();
    params.set('submitDirectEventConfig', JSON.stringify({
      config: {
        extraParams: {
          aHastaAramaKriteri: {
            BaslangicTarihi: '2026-01-01T00:00:00',
            BitisTarihi: '2026-12-31T23:59:59',
            HizliAramaTuru: 1,
            HizliAramaDegeri: String(patientId).trim(),
            SorguTuru: 1
          }
        }
      }
    }));
    params.set('HdnBaseYazdirmaTuru', '-1');
    params.set('__VIEWSTATEGENERATOR', '5DE5E74B');
    params.set('hdnKrmdLoginBilgi', decodeURIComponent(token || ''));
    params.set('dfTarihBaslangic', '01.01.2026');
    params.set('dfTarihBitis', '31.12.2026');
    params.set('cmbHizliAramaTuru', 'Kimlik No / Bemor ID');
    params.set('tfHizliAramaDeger', String(patientId).trim());
    params.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
    params.set('__EVENTARGUMENT', 'OrtakDmOrtakSayfalar|public|HastaSorgula');

    const postData = params.toString();
    const res = await karmedRawRequest({
      hostname: host,
      port: KARMED_PORT,
      path: '/Radiology/Rbys.aspx?action=HastaSorgula',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookie,
        'X-Ext-Net': 'delta=true',
        'action': 'HastaSorgula',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, postData);

    const body = res.body || '';
    const match = body.match(/App\.StoreHasta\.proxy\.data\s*=\s*(\[.*?\]);/s);
    if (!match) return null;
    return safeParseExtNetJson(match[1]);
  };

  let pList = null;
  try {
    pList = await performSearch(session.token, session.cookie, session.host);
  } catch (e) {
    pList = null;
  }

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

  const sample = pList[0];
  const isStatsionar = sample.YatPol === 'Y' || sample.NeIcin === 'Yatis' || sample.NeIcin === 3 || 
                       String(sample.OncelikAciklama).toLowerCase().includes('yatan') || 
                       String(sample.OncelikAciklama).toLowerCase().includes('statsionar');

  let patientPhone = '';
  try {
    patientPhone = await fetchPatientPhone(sample.KimlikNo || patientId, session.token, session.cookie, session.host);
  } catch (phErr) {}

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

  if (isStatsionar) {
    requiresPayment = false;
  }

  patientInfo.patientCategory = patientCategory;
  patientInfo.requiresPaymentConfirmation = requiresPayment;

  // Bemorning barcha tekshiruvlarini (Dosyalarini) olish
  const eligibleExams = [];
  const now = new Date();
  const allCurrentQueue = readJson(QUEUE_FILE, []);

  // Laboratoriya tahlillarini olish
  const onkayitList = pList.map(p => p.OnKayitId || p.Id).filter(Boolean);
  let cachedPatientLab = null;
  try {
    cachedPatientLab = await fetchPatientLabResults(sample.KimlikNo || patientId, onkayitList, session.token, session.cookie, session.host);
  } catch (lErr) {
    cachedPatientLab = { found: false };
  }

  patientInfo.labResults = cachedPatientLab;

  for (const dosya of pList) {
    try {
      const sParams = new URLSearchParams();
      sParams.set('submitDirectEventConfig', JSON.stringify({
        config: { extraParams: { aDosyaId: parseInt(dosya.Id, 10), aHastaGelisTipi: 0 } }
      }));
      sParams.set('HdnBaseYazdirmaTuru', '-1');
      sParams.set('__VIEWSTATEGENERATOR', '5DE5E74B');
      sParams.set('hdnKrmdLoginBilgi', decodeURIComponent(session.token || ''));
      sParams.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
      sParams.set('__EVENTARGUMENT', 'OrtakDmOrtakSayfalar|public|DosyaHizmetListele');

      const sPost = sParams.toString();
      const sRes = await karmedRawRequest({
        hostname: session.host,
        port: KARMED_PORT,
        path: '/Radiology/Rbys.aspx?action=DosyaHizmetListele',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Content-Length': Buffer.byteLength(sPost),
          'Cookie': session.cookie,
          'X-Ext-Net': 'delta=true',
          'action': 'DosyaHizmetListele',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, sPost);

      const mS = (sRes.body || '').match(/App\.StoreHizmet\.proxy\.data\s*=\s*(\[.*?\]);/s);
      if (!mS) continue;

      const sList = safeParseExtNetJson(mS[1]);
      if (!Array.isArray(sList)) continue;

      for (const s of sList) {
        const sName = (s.TetkikIsmi || s.HizmetAdi || '').toUpperCase();
        const sCode = (s.TetkikKodu || s.HizmetKodu || '').toUpperCase();
        const isMrt = sCode.startsWith('R0') || sCode.startsWith('R1') || sName.includes('MRT') || sName.includes('MAGNET') || s.Modalite === 'MR';
        const isMskt = sCode.startsWith('R14') || sName.includes('MSKT') || sName.includes(' KT') || sName.includes('KOMPYUTER') || s.Modalite === 'CT';

        if (isMrt || isMskt) {
          const modality = isMskt ? 'MSKT' : 'MRT';
          const isContrast = sName.includes('KONTRAST') || sName.includes('KM') || sName.includes('KONTRASTLI');
          
          let suggestedDevice = 'mrt1';
          let compatibleDevices = ['mrt1'];
          if (modality === 'MSKT') {
            suggestedDevice = 'mskt1';
            compatibleDevices = ['mskt1'];
          } else {
            if (isContrast) {
              suggestedDevice = 'mrt1';
              compatibleDevices = ['mrt1'];
            } else {
              suggestedDevice = 'mrt2';
              compatibleDevices = ['mrt2', 'mrt1'];
            }
          }

          let regDate = new Date();
          if (dosya.DosyaTarihi) {
            regDate = new Date(dosya.DosyaTarihi);
          } else if (dosya.GelisTarihi) {
            regDate = new Date(dosya.GelisTarihi);
          }

          const diffMs = now.getTime() - regDate.getTime();
          const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          const isOlderThan5Days = diffDays >= 5;

          const maxAllowed = new Date(regDate);
          maxAllowed.setDate(maxAllowed.getDate() + 10);
          const maxAllowedDate = maxAllowed.toISOString().split('T')[0];

          const isCompletedInKarmed = Boolean(s.RaporOnayli || s.Durum === 'Rapor Onaylı' || dosya.Durum === 'Rapor Onaylı');
          const isCompletedInLocal = allCurrentQueue.some(q => 
            String(q.serviceId) === String(s.Id) && (q.status === 'completed')
          );
          const isCompleted = isCompletedInKarmed || isCompletedInLocal;

          let isAlreadyQueued = false;
          let existingQueueInfo = null;
          const matchedQueue = allCurrentQueue.find(q => {
            const matchSingle = String(q.serviceId) === String(s.Id);
            const matchCombined = Array.isArray(q.serviceIds) && q.serviceIds.includes(String(s.Id));
            return (matchSingle || matchCombined) && q.status !== 'cancelled';
          });

          if (matchedQueue) {
            isAlreadyQueued = true;
            existingQueueInfo = {
              ticketNumber: matchedQueue.ticketNumber,
              scheduledDate: matchedQueue.scheduledDate || matchedQueue.date,
              scheduledTime: matchedQueue.scheduledTime || matchedQueue.startTime,
              finishTime: matchedQueue.finishTime,
              deviceId: matchedQueue.deviceId,
              status: matchedQueue.status
            };
          }

          let labResults = cachedPatientLab;

          // STANDART VAQTLAR: MSKT = 30 min, MRT = 60 min
          let examDuration = (modality === 'MSKT') ? 30 : 60;
          try {
            const servicesCatalog = readJson(SERVICES_FILE, []);
            const matchedService = servicesCatalog.find(sc => sc.code === sCode);
            if (matchedService && matchedService.duration && matchedService.duration !== 20 && matchedService.duration !== 25 && matchedService.duration !== 35 && matchedService.duration !== 45 && matchedService.duration !== 50) {
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

  return {
    success: true,
    found: true,
    patient: patientInfo,
    eligibleExams: eligibleExams,
    hasEligibleExams: eligibleExams.length > 0
  };
}

// -------------------------------------------------------------
// YAGONA NAVBATGA YOZISH LOGIKASI (UNIFIED BOOKING)
// -------------------------------------------------------------
function bookPatient(body, operatorName = 'Registrator', isAdmin = false) {
  const queue = readJson(QUEUE_FILE, []);
  const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);

  // 1. Duratsiyani aniqlash (MSKT: 30m, MRT: 60m, Combined MSKT: max, Combined MRT: sum)
  let calcDuration = parseInt(body.durationMinutes || 0, 10);
  if (!calcDuration) {
    if (body.isCombined && Array.isArray(body.combinedServices) && body.combinedServices.length > 0) {
      if (body.deviceId === 'mskt1' || body.modality === 'MSKT') {
        const durs = body.combinedServices.map(c => parseInt(c.durationMinutes || 30, 10));
        calcDuration = Math.max(...durs, 30);
      } else {
        const durs = body.combinedServices.map(c => parseInt(c.durationMinutes || 60, 10));
        calcDuration = durs.reduce((a, b) => a + b, 0);
        if (calcDuration < 60) calcDuration = 60;
      }
    } else {
      calcDuration = (body.deviceId === 'mskt1' || body.modality === 'MSKT') ? 30 : 60;
    }
  }

  let slotInfo = {
    date: body.scheduledDate || new Date().toISOString().split('T')[0],
    startTime: body.scheduledTime || body.startTime || '09:00',
    finishTime: body.finishTime || body.endTime || null,
    durationMinutes: calcDuration,
    deviceId: body.deviceId || 'mrt1'
  };

  if (slotInfo.finishTime) {
    const sMin = scheduler.timeToMin(slotInfo.startTime);
    const fMin = scheduler.timeToMin(slotInfo.finishTime);
    if (!isNaN(sMin) && !isNaN(fMin) && fMin > sMin) {
      slotInfo.durationMinutes = fMin - sMin;
    }
  }

  // Avtomatik bo'sh slot tanlash
  if (!body.scheduledTime && !body.startTime) {
    const autoSlot = scheduler.findNextAvailableSmartSlot(body, queue);
    if (autoSlot.success) {
      slotInfo.date = autoSlot.date;
      slotInfo.startTime = autoSlot.startTime;
      slotInfo.finishTime = autoSlot.finishTime;
      slotInfo.durationMinutes = autoSlot.durationMinutes;
      slotInfo.deviceId = autoSlot.deviceId;
    }
  }

  // 10 kundan oshganlik tekshiruvi (Admin majburiy yozish holatidan tashqari)
  if (!body.forceBooking && (body.isOlderThan10Days || (body.diffDays && body.diffDays > 10))) {
    return {
      success: false,
      statusCode: 400,
      error: `⛔ Ushbu tekshiruv so'rovi ro'yxatga olinganiga 10 kundan oshgan (${body.diffDays || 10} kun)! Qoidaga asosan 10 kundan oshgan so'rovlarga navbat berilmaydi.`
    };
  }

  // Registrator o'tgan sanalarga yoza olmaydi
  const todayStr = new Date().toISOString().split('T')[0];
  if (!isAdmin && !body.forceBooking && slotInfo.date < todayStr) {
    return {
      success: false,
      statusCode: 400,
      error: `⛔ Registratura o'tgan sanaga (${slotInfo.date}) navbat yoza olmaydi! Faqat bugun (${todayStr}) va kelgusi sanalarga navbat berish mumkin.`
    };
  }

  // Qurilma mosligi tekshiruvi:
  const targetDevId = slotInfo.deviceId;
  const isContrastExam = Boolean(body.isContrast || (body.serviceName && (body.serviceName.toUpperCase().includes('KONTRAST') || body.serviceName.toUpperCase().includes('KM'))));
  const isMsktExam = (body.modality === 'MSKT') || (body.serviceName && (body.serviceName.toUpperCase().includes('MSKT') || body.serviceName.toUpperCase().includes('KT')));
  
  if (isMsktExam && targetDevId !== 'mskt1') {
    return { success: false, statusCode: 400, error: `MSKT tekshiruvi faqat MSKT 1 apparatida o'tkazilishi mumkin!` };
  }
  if (!isMsktExam && targetDevId === 'mskt1') {
    return { success: false, statusCode: 400, error: `MRT tekshiruvi MSKT apparatiga rejalashtirilmaydi! MRT 1 yoki MRT 2 ni tanlang.` };
  }
  if (!isMsktExam && isContrastExam && targetDevId === 'mrt2') {
    return { success: false, statusCode: 400, error: `MRT 2 apparatida injektor mavjud emas va kontrastli tekshiruvlar o'tkazilmaydi! Kontrastli MRT uchun MRT 1 apparatini tanlang.` };
  }

  // Ish grafigi va to'qnashuv tekshiruvi
  const slotValidation = scheduler.validateBookingSlot(
    slotInfo.date,
    slotInfo.startTime,
    slotInfo.durationMinutes,
    slotInfo.deviceId,
    queue
  );

  if (!slotValidation.valid) {
    if (isAdmin && (body.forceBooking || body.isCustomTimeOverride || body.isAdmin)) {
      const sMin = scheduler.timeToMin(slotInfo.startTime);
      const fMin = slotInfo.finishTime ? scheduler.timeToMin(slotInfo.finishTime) : (sMin + slotInfo.durationMinutes);
      slotInfo.finishTime = scheduler.minToTime(fMin);
    } else {
      return {
        success: false,
        statusCode: 400,
        error: slotValidation.error,
        collision: true,
        canForce: isAdmin
      };
    }
  } else {
    slotInfo.finishTime = slotInfo.finishTime || slotValidation.finishTime;
  }

  // Talon raqami (M-001 yoki K-001)
  const dayPatients = queue.filter(p => (p.date === slotInfo.date || p.scheduledDate === slotInfo.date));
  const prefix = slotInfo.deviceId.includes('mskt') ? 'K' : 'M';
  const seq = dayPatients.length + 1;
  const ticketNumber = body.ticketNumber || `${prefix}-${String(seq).padStart(3, '0')}`;

  const checkServiceIds = [];
  if (body.serviceId) checkServiceIds.push(String(body.serviceId));
  if (Array.isArray(body.serviceIds)) {
    body.serviceIds.forEach(sid => { if (sid && !checkServiceIds.includes(String(sid))) checkServiceIds.push(String(sid)); });
  }
  if (Array.isArray(body.combinedServices)) {
    body.combinedServices.forEach(cs => { if (cs.serviceId && !checkServiceIds.includes(String(cs.serviceId))) checkServiceIds.push(String(cs.serviceId)); });
  }

  const newPatient = {
    id: body.id || `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    ticketNumber: ticketNumber,
    patientName: (body.patientName || body.fullName || 'BEMOR').toUpperCase().trim(),
    patientId: String(body.patientId || '').trim(),
    serviceId: body.serviceId || (body.combinedServices && body.combinedServices[0]?.serviceId) || null,
    serviceIds: checkServiceIds.length > 0 ? checkServiceIds : (body.serviceId ? [String(body.serviceId)] : []),
    dosyaId: body.dosyaId || (body.combinedServices && body.combinedServices[0]?.dosyaId) || null,
    protokolNo: body.protokolNo || (body.combinedServices && body.combinedServices[0]?.protokolNo) || null,
    serviceCode: body.serviceCode || '',
    isCombined: Boolean(body.isCombined),
    combinedServices: body.combinedServices || null,
    phone: body.phone || body.phoneNumber || '',
    birthDate: body.birthDate || '',
    patientType: body.patientType || 'Ambulator',
    department: body.department || '',
    patientCategory: body.patientCategory || '',
    requiresPaymentConfirmation: Boolean(body.requiresPaymentConfirmation),
    paymentConfirmed: Boolean(body.paymentConfirmed),
    labResults: body.labResults || null,
    date: slotInfo.date,
    scheduledDate: slotInfo.date,
    scheduledTime: slotInfo.startTime,
    finishTime: slotInfo.finishTime,
    timeSlot: slotInfo.finishTime ? `${slotInfo.startTime} - ${slotInfo.finishTime}` : `${slotInfo.startTime}`,
    primaryService: body.primaryService || body.serviceName || 'MRT Tekshiruvi',
    isContrast: Boolean(body.isContrast),
    deviceId: slotInfo.deviceId,
    deviceType: slotInfo.deviceId.includes('mskt') ? 'MSKT' : 'MRT',
    status: 'waiting',
    durationMinutes: slotInfo.durationMinutes,
    estimatedDurationMinutes: slotInfo.durationMinutes,
    estimatedStartTime: `${slotInfo.date}T${slotInfo.startTime}:00.000Z`,
    preparation: body.preparation || (body.isContrast ? 'Och qoringa kelish (kamida 4 soat oldin ovqatlanmaslik) va barcha metall buyumlarni yechish.' : 'Barcha metall buyumlar, soat va telefonni yechish.'),
    referringDoctor: body.referringDoctor || '',
    operatorName: operatorName,
    isForceBooked: Boolean(body.forceBooking),
    createdAt: new Date().toISOString()
  };

  queue.push(newPatient);
  writeJson(QUEUE_FILE, queue);

  // Real-time WebSocket orqali zudlik bilan barcha ekranlarga tarqatish
  broadcastWs('queue_updated', {
    queue: queue.filter(p => p.date === slotInfo.date),
    devices: devices
  });

  return {
    success: true,
    patient: newPatient,
    message: `Bemor muvaffaqiyatli navbatga qo'shildi: ${newPatient.ticketNumber} (${newPatient.scheduledDate}, ${newPatient.scheduledTime})`
  };
}

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  QUEUE_FILE,
  DEVICES_FILE,
  SCHEDULES_FILE,
  SERVICES_FILE,
  KARMED_PROFILES_FILE,
  OPERATORS_FILE,
  PRINTER_SETTINGS_FILE,
  CONSENT_QUESTIONS_FILE,
  ALLOWED_IPS_FILE,
  USERS_FILE,
  BOT_SETTINGS_FILE,
  DEFAULT_DEVICES,
  MIME_TYPES,
  OPERATORS,
  activeSessions,
  readJson,
  writeJson,
  readBody,
  sendJson,
  getClientIp,
  isLocalhost,
  checkClientIpPermission,
  karmedRawRequest,
  loginToKarmedLive,
  getActiveKarmedSession,
  fetchPatientPhone,
  fetchPatientLabResults,
  searchPatientInKarmed,
  bookPatient,
  registerWsClient,
  removeWsClient,
  broadcastWs
};
