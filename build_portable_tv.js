const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_DIR = 'c:\\Users\\Rentgen xona\\Desktop\\UTT';
const TARGET_DIR = path.join(WORKSPACE_DIR, 'UTT_TV_MONITOR_PORTABLE');
const DESKTOP_DIR = 'c:\\Users\\Rentgen xona\\Desktop';
const ZIP_OUTPUT = path.join(DESKTOP_DIR, 'UTT_TV_MONITOR_PORTABLE.zip');

console.log('================================================================================');
console.log('       KARMED UTT TV JONLI MONITOR — PORTATIV PAKET YARATISH (v8.0.0)');
console.log('================================================================================');

// 1. Papkalarni tozalash va yaratish
console.log('=== 1. PAPKALARNI TAYYORLASH ===');
const dirs = [
  TARGET_DIR,
  path.join(TARGET_DIR, 'runtime'),
  path.join(TARGET_DIR, 'data'),
  path.join(TARGET_DIR, 'public'),
  path.join(TARGET_DIR, 'public', 'icons')
];
dirs.forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// 2. Portativ node.exe ko'chirish
console.log("=== 2. PORTATIV NODE.EXE KO'CHIRISH ===");
const sourceNode = 'C:\\Program Files\\nodejs\\node.exe';
const targetNode = path.join(TARGET_DIR, 'runtime', 'node.exe');
if (fs.existsSync(sourceNode)) {
  fs.copyFileSync(sourceNode, targetNode);
  const mb = Math.round(fs.statSync(targetNode).size / (1024 * 1024));
  console.log(`[OK] runtime/node.exe ko'chirildi (${mb} MB)`);
} else {
  console.warn('[OGOHLANTIRISH] Tizim node.exe topilmadi:', sourceNode);
}

// 3. Faqat TV Monitor fayllarini ko'chirish (NO tv-dev, NO admin, NO extra pages)
console.log("=== 3. FAQAT TV MONITOR FAYLLARINI KO'CHIRISH ===");
const filesToCopy = [
  { from: 'public/index.html', to: 'public/index.html' },
  { from: 'public/tv.html', to: 'public/tv.html' },
  { from: 'public/app.js', to: 'public/app.js' },
  { from: 'public/styles.css', to: 'public/styles.css' },
  { from: 'public/doctor-completed.html', to: 'public/doctor-completed.html' },
  { from: 'public/chime_engine.js', to: 'public/chime_engine.js' },
  { from: 'public/icons/logo-onko.png', to: 'public/icons/logo-onko.png' },
  { from: 'data/doctors_auth.json', to: 'data/doctors_auth.json' }
];

filesToCopy.forEach(f => {
  const src = path.join(WORKSPACE_DIR, f.from);
  const dst = path.join(TARGET_DIR, f.to);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log(`  + ${f.to} ko'chirildi`);
  } else {
    console.warn(`  - Fayl topilmadi: ${f.from}`);
  }
});

// 4. Zaxira navbat ma'lumotlarini ko'chirish
console.log("=== 4. ZAXIRA NAVBAT MA'LUMOTLARINI KO'CHIRISH ===");
const queueSrc = path.join(WORKSPACE_DIR, 'latest_queue.json');
const queueDst = path.join(TARGET_DIR, 'data', 'latest_queue.json');
if (fs.existsSync(queueSrc)) {
  fs.copyFileSync(queueSrc, queueDst);
  console.log("  + data/latest_queue.json ko'chirildi");
}

// 5. OPEN_KARMED_KEY.json YARATISH (R5 17720 kirish ma'lumotlari)
console.log('=== 5. OPEN_KARMED_KEY.JSON YARATISH ===');
const karmedKeyData = {
  username: "R5",
  password: "17720",
  karmed_host: "192.168.150.111",
  karmed_port: 2025,
  sync_interval_seconds: 15,
  description: "Karmed tizimiga kirish hisob ma'lumotlari. Agar shifokor yoki xona kodi o'zgarsa, ushbu faylda username va password qiymatlarini tahrirlashingiz mumkin."
};
fs.writeFileSync(path.join(TARGET_DIR, 'OPEN_KARMED_KEY.json'), JSON.stringify(karmedKeyData, null, 2), 'utf8');
console.log("  + OPEN_KARMED_KEY.json yaratildi (username: R5, password: 17720)");

// 6. CONFIG.JSON YARATISH
console.log('=== 6. CONFIG.JSON YARATISH ===');
const configData = {
  port: 9877,
  auto_open_browser: true,
  comment: "TV Monitor porti. Boshqa kompyuterda yoki Smart TV da brauzer orqali ochish: http://KOMPYUTER_IP:9877"
};
fs.writeFileSync(path.join(TARGET_DIR, 'config.json'), JSON.stringify(configData, null, 2), 'utf8');
console.log('  + config.json yaratildi (port: 9877)');

// 7. MUSTAQIL SERVER.JS YARATISH (KARMED BILAN TO'G'RIDAN-TO'G'RI INTEGRATSIYA)
console.log("=== 7. MUSTAQIL SERVER.JS (v8.0.0) YARATISH ===");
const serverSource = `/**
 * KARMED UTT TV JONLI MONITOR — STANDALONE MUSTAQIL SERVER (v8.0.0)
 * 
 * Ushbu server Karmed tizimi (192.168.150.111:2025) bilan to'g'ridan-to'g'ri integratsiya
 * qilib ishlaydi. Hech qanday boshqa oraliq serverga bog'liq emas.
 * Kirish kaliti: OPEN_KARMED_KEY.json faylidan o'qiladi.
 * Nol tashqi kutubxona (Zero-Dependency) — faqat Node.js ichki modullari.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL, URLSearchParams } = require('url');

const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const DATA_DIR = path.join(BASE_DIR, 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'latest_queue.json');
const AUTH_FILE = path.join(DATA_DIR, 'doctors_auth.json');
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');
const KEY_FILE = path.join(BASE_DIR, 'OPEN_KARMED_KEY.json');

// Papkalarni tekshirish
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// 1. Konfiguratsiya va Karmed hisob ma'lumotlari
let config = {
  port: 9877,
  auto_open_browser: true
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    config = Object.assign(config, JSON.parse(raw));
  } catch (e) {}
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;

function getKarmedCredentials() {
  let creds = {
    username: 'R5',
    password: '17720',
    karmed_host: '192.168.150.111',
    karmed_port: 2025,
    sync_interval_seconds: 15
  };
  if (fs.existsSync(KEY_FILE)) {
    try {
      const raw = fs.readFileSync(KEY_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.username) creds.username = String(parsed.username).trim();
      if (parsed.password) creds.password = String(parsed.password).trim();
      if (parsed.karmed_host) creds.karmed_host = String(parsed.karmed_host).trim();
      if (parsed.karmed_port) creds.karmed_port = parseInt(parsed.karmed_port, 10) || 2025;
      if (parsed.sync_interval_seconds) creds.sync_interval_seconds = Math.max(5, parseInt(parsed.sync_interval_seconds, 10) || 15);
    } catch (e) {
      console.warn("[KARMED KEY] OPEN_KARMED_KEY.json xatosi:", e.message);
    }
  }
  return creds;
}

// 2. Shifokorlar xaritasi (doctors_auth.json)
function getDoctorsAuth() {
  if (fs.existsSync(AUTH_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    } catch (e) {}
  }
  return {};
}

// 3. Xotiradagi jonli navbat ma'lumotlari
let activeCalls = {};
let latestQueueData = {
  success: true,
  version: '8.0.0',
  timestamp: new Date().toISOString(),
  totalPatients: 0,
  department: 'Ultratovush',
  summary: { totalWaiting: 0, totalDone: 0, totalCompleted: 0, totalTodayRegistered: 0, totalPatients: 0, totalEarlierRegistered: 0 },
  doctors: [],
  allPatients: [],
  earlierPatients: [],
  activeCalls: {},
  lastKarmedSync: null
};

// Lokal kesh faylidan boshlang'ich yuklash
if (fs.existsSync(QUEUE_FILE)) {
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    latestQueueData = Object.assign(latestQueueData, JSON.parse(raw));
  } catch (e) {}
}

let sseClients = [];

function broadcastSse(data) {
  const payload = 'data: ' + JSON.stringify(data) + '\\n\\n';
  sseClients.forEach(client => {
    try { client.write(payload); } catch (e) {}
  });
}

// 4. Tarmoq IP manzillarini aniqlash (Dynamic IP Detection)
function getNetworkIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// =========================================================================
// 5. KARMED TO'G'RIDAN-TO'G'RI INTEGRATSIYA DVIGATELI (MASTER DIRECT ENGINE)
// =========================================================================

function karmedRawRequest(options, postData = null, timeoutMs = 12000) {
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
      req.destroy(new Error('Karmed server javob bermadi (Timeout ' + timeoutMs + 'ms)'));
    });
    if (postData) req.write(postData);
    req.end();
  });
}

function extractKarmedLoginBilgi(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/App\\.hdnKrmdLoginBilgi\\.setValue\\([\\\\"\\']*([A-Za-z0-9%_+\\-\\/=]{40,})[\\\\"\\']*\\)/);
  if (m && m[1]) return m[1];
  if (str.includes('hdnKrmdLoginBilgi=')) {
    const m2 = str.match(/hdnKrmdLoginBilgi=([^&\\"\\'\\s]+)/);
    if (m2 && m2[1]) return decodeURIComponent(m2[1]);
  }
  return null;
}

function safeParseExtNetJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    try {
      return JSON.parse(str.replace(/\\\\"/g, '"'));
    } catch (e2) {
      try {
        const clean = str.replace(/new Date\\([^)]+\\)/g, '"2026-09-09"').replace(/\\\\"/g, '"');
        return JSON.parse(clean);
      } catch (e3) {
        return null;
      }
    }
  }
}

function formatKarmedTimeString(tStr) {
  if (!tStr) return '';
  if (tStr.includes('T')) {
    const parts = tStr.split('T')[1];
    return parts.substring(0, 5);
  }
  if (tStr.includes(':')) {
    const parts = tStr.split(':');
    return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
  }
  return tStr;
}

function resolveQueuedRoomDoctor(kp, docsAuth) {
  const roomStr = String(kp.AltBolumAdi || kp.OdaAdi || '').trim();
  const doctorKeys = Object.keys(docsAuth || {});

  const m = roomStr.match(/Ultratovush-+(\\d+)/i);
  if (m) {
    const num = m[1];
    const targetRoomId = 'Ultratovush-' + num;
    for (const key of doctorKeys) {
      if (docsAuth[key] && docsAuth[key].roomId === targetRoomId) {
        return docsAuth[key];
      }
    }
  }

  const low = roomStr.toLowerCase().replace(/['\`ʻʼ]/g, '');
  for (const key of doctorKeys) {
    const d = docsAuth[key];
    if (!d) continue;
    const dDocName = (d.doctorName || '').toLowerCase().replace(/['\`ʻʼ]/g, '');
    const dShortName = (d.shortName || '').toLowerCase().replace(/['\`ʻʼ]/g, '');

    if (dShortName && low.includes(dShortName)) return d;
    if (dDocName && low.includes(dDocName)) return d;

    const parts = dDocName.split(' ');
    if (parts.length >= 2 && low.includes(parts[0]) && low.includes(parts[1])) return d;
    if (parts.length >= 1 && parts[0].length >= 4 && low.includes(parts[0])) return d;
  }

  if (kp.OdaId) {
    for (const key of doctorKeys) {
      const d = docsAuth[key];
      if (!d) continue;
      if (String(d.roomNum) === String(kp.OdaId) || String(d.kod) === String(kp.OdaId)) {
        return d;
      }
    }
  }

  return null;
}

function resolveAcceptingDoctor(kp, docsAuth) {
  const docName = String(kp.KabulEden || kp.DoktorAdi || '').trim();
  if (!docName || docName === 'Kiritilmagan' || docName.toLowerCase().includes('kutilmoqda')) {
    return null;
  }

  const doctorKeys = Object.keys(docsAuth || {});
  const low = docName.toLowerCase().replace(/['\`ʻʼ]/g, '');

  for (const key of doctorKeys) {
    const d = docsAuth[key];
    if (!d) continue;
    const dDocName = (d.doctorName || '').toLowerCase().replace(/['\`ʻʼ]/g, '');
    const dShortName = (d.shortName || '').toLowerCase().replace(/['\`ʻʼ]/g, '');

    if (dDocName && low.includes(dDocName)) return d;
    if (dShortName && low.includes(dShortName)) return d;

    const parts = dDocName.split(' ');
    if (parts.length >= 2 && low.includes(parts[0]) && low.includes(parts[1])) return d;
    if (parts.length >= 1 && parts[0].length >= 4 && low.includes(parts[0])) return d;
  }

  return null;
}

function mapKarmedRecordToDoctor(kp, docsAuth) {
  const statusCode = kp.DosyaDurumu || (kp.Durum === 'Bekleyen' ? 1 : (kp.Durum === 'Kabul Edilen' ? 4 : (kp.Durum === 'Rapor Onaylı' ? 8 : 1)));
  const isExamined = statusCode === 4 || statusCode === 8 || (kp.Durum && String(kp.Durum).toLowerCase().includes('onay'));
  if (isExamined) {
    return resolveAcceptingDoctor(kp, docsAuth) || resolveQueuedRoomDoctor(kp, docsAuth);
  }
  return resolveQueuedRoomDoctor(kp, docsAuth) || resolveAcceptingDoctor(kp, docsAuth);
}

// Karmed sessiya holati
let karmedLiveSession = {
  token: null,
  cookie: null,
  fullName: null
};

async function loginToKarmedLive(username, password, host, port) {
  username = String(username).trim().toUpperCase();
  password = String(password).trim();

  const r1 = await karmedRawRequest({
    hostname: host,
    port: port,
    path: '/Login/Login.aspx?returnUrl=http://' + host + ':' + port + '/Radiology/Rbys.aspx',
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
  });

  const setCookies1 = r1.headers['set-cookie'] || [];
  let cookieStr = setCookies1.map(c => c.split(';')[0]).join('; ');

  const m1 = r1.body.match(/value='([^']+)'/);
  if (!m1) throw new Error("Karmed boshlang'ich kaliti topilmadi");

  const r2 = await karmedRawRequest({
    hostname: host,
    port: port,
    path: '/Karmed/Default.aspx',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength('=' + m1[1]),
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0'
    }
  }, '=' + m1[1]);

  const m2 = r2.body.match(/name='token'\\s+value='([^']+)'/);
  if (!m2) throw new Error('Karmed token topilmadi');
  const tokenVal = m2[1];

  const tokenBody = 'token=' + encodeURIComponent(tokenVal);
  const r3 = await karmedRawRequest({
    hostname: host,
    port: port,
    path: '/Login/Login.aspx?returnUrl=http://' + host + ':' + port + '/Radiology/Rbys.aspx',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(tokenBody),
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0'
    }
  }, tokenBody);

  const mDataIndex = r3.body.match(/id="hdnDataIndexInfo"[^>]*value="([^"]+)"/) ||
                     r3.body.match(/hdnDataIndexInfo[\\\\\\"':,=\\s]+([^"&'<>]+)/);
  const dataIndexInfo = mDataIndex ? mDataIndex[1] : '';

  const makeLoginParams = new URLSearchParams();
  makeLoginParams.set('submitDirectEventConfig', JSON.stringify({ config: { extraParams: { dataIndex: null } } }));
  makeLoginParams.set('HdnBaseYazdirmaTuru', '-1');
  makeLoginParams.set('__VIEWSTATEGENERATOR', '5E7FB4E4');
  makeLoginParams.set('hdnSmsInfo', '');
  makeLoginParams.set('hdnDataIndexInfo', decodeURIComponent(dataIndexInfo));
  makeLoginParams.set('hdToken', tokenVal);
  makeLoginParams.set('hdReferer', host);
  makeLoginParams.set('hdCaptchaVisible', 'False');
  makeLoginParams.set('CmbCulture', 'uz-UZ');
  makeLoginParams.set('txtUsername', username);
  makeLoginParams.set('txtPassword', password);
  makeLoginParams.set('__EVENTTARGET', 'ResLogin');
  makeLoginParams.set('__EVENTARGUMENT', '-|public|MakeLogin');

  const pData = makeLoginParams.toString();
  const r4 = await karmedRawRequest({
    hostname: host,
    port: port,
    path: '/Login/Login.aspx?action=MakeLogin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(pData),
      'Cookie': cookieStr,
      'X-Ext-Net': 'delta=true',
      'action': 'MakeLogin',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0'
    }
  }, pData);

  if (!r4.body.includes('userInfo')) {
    throw new Error("Karmed tizimi login yoki parolni qabul qilmadi (Username: " + username + ")");
  }

  const mUserInfo = r4.body.match(/name='userInfo'\\s+value='([^']+)'/);
  const userInfoVal = mUserInfo ? mUserInfo[1] : '';

  const r5Data = 'userInfo=' + encodeURIComponent(userInfoVal);
  const r5 = await karmedRawRequest({
    hostname: host,
    port: port,
    path: '/Radiology/Rbys.aspx',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(r5Data),
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0'
    }
  }, r5Data);

  if (r5.headers['set-cookie']) {
    const newCookies = r5.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    cookieStr = cookieStr + '; ' + newCookies;
  }

  let loginBilgi = extractKarmedLoginBilgi(r5.body) || '';
  return {
    success: true,
    loginBilgi: loginBilgi,
    cookie: cookieStr
  };
}

let isSyncing = false;

async function syncMasterQueueFromKarmed() {
  if (isSyncing) return;
  isSyncing = true;

  const creds = getKarmedCredentials();
  const host = creds.karmed_host;
  const port = creds.karmed_port;

  try {
    const nowObj = new Date();
    const pad2 = (n) => (n < 10 ? '0' : '') + n;
    const todayIso = \`\${nowObj.getFullYear()}-\${pad2(nowObj.getMonth() + 1)}-\${pad2(nowObj.getDate())}\`;
    const todayDmy = \`\${pad2(nowObj.getDate())}.\${pad2(nowObj.getMonth() + 1)}.\${nowObj.getFullYear()}\`;
    const yDateObj = new Date(nowObj.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayIso = \`\${yDateObj.getFullYear()}-\${pad2(yDateObj.getMonth() + 1)}-\${pad2(yDateObj.getDate())}\`;

    function formatIsoToDmy(isoStr) {
      if (!isoStr) return '';
      const parts = isoStr.split('-');
      if (parts.length === 3) return \`\${parts[2]}.\${parts[1]}.\${parts[0]}\`;
      return isoStr;
    }

    if (!karmedLiveSession.token || !karmedLiveSession.cookie) {
      console.log(\`[Karmed Sync] Karmed tizimiga kirilmoqda (\${creds.username}@\${host}:\${port})...\`);
      const authRes = await loginToKarmedLive(creds.username, creds.password, host, port);
      karmedLiveSession.token = authRes.loginBilgi;
      karmedLiveSession.cookie = authRes.cookie;
      console.log('[Karmed Sync] [OK] Karmed tizimiga muvaffaqiyatli kirildi!');
    }

    async function executeQuery(token, cookie) {
      const sParams = new URLSearchParams();
      sParams.set('submitDirectEventConfig', JSON.stringify({
        config: { extraParams: { aDosyaDurumu: null, aHizliAra: false } }
      }));
      sParams.set('cbYil', todayDmy.split('.')[2] || '2026');
      sParams.set('_cbYil_state', JSON.stringify([{ value: sParams.get('cbYil'), text: sParams.get('cbYil'), index: 1 }]));
      sParams.set('cbHizliAramaTur', 'Bemor ID');
      sParams.set('_cbHizliAramaTur_state', JSON.stringify([{ value: '0', text: 'Bemor ID', index: 0 }]));
      sParams.set('tfHizliAramaDeger', '');
      sParams.set('BaslangicDt', todayDmy);
      sParams.set('BitisDt', todayDmy);
      sParams.set('cbBolum', 'Ultratovush, Dopler Ultratovush');
      sParams.set('_cbBolum_state', JSON.stringify([
        { value: '10', text: 'Ultratovush', index: 9 },
        { value: '24', text: 'Dopler Ultratovush', index: 0 }
      ]));
      sParams.set('cbAltBolum', '(Subbirliklar)');
      sParams.set('_cbAltBolum_state', JSON.stringify([{ value: '0', text: '(Subbirliklar)', index: 0 }]));
      sParams.set('cbBolumOda', '(Barcha Xonalar)');
      sParams.set('_cbBolumOda_state', JSON.stringify([{ value: '0', text: '(Barcha Xonalar)', index: 0 }]));
      sParams.set('cbBirimTuru', '(Butun Birlik)');
      sParams.set('_cbBirimTuru_state', JSON.stringify([{ value: '0', text: '(Butun Birlik)', index: 0 }]));
      sParams.set('cbBina', '(Butun Binolar)');
      sParams.set('_cbBina_state', JSON.stringify([{ value: '0', text: '(Butun Binolar)', index: 0 }]));
      sParams.set('cbKayitSayisiSecim', '500');
      sParams.set('_cbKayitSayisiSecim_state', JSON.stringify([{ value: '500', text: '500', index: 3 }]));
      sParams.set('btnTumu_Pressed', 'true');
      sParams.set('HdnBaseYazdirmaTuru', '-1');
      sParams.set('__VIEWSTATEGENERATOR', '5DE5E74B');
      sParams.set('hdnKrmdLoginBilgi', token);
      sParams.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
      sParams.set('__EVENTARGUMENT', '-|public|HastaSorgula');

      const spData = sParams.toString();
      return await karmedRawRequest({
        hostname: host,
        port: port,
        path: '/Radiology/Rbys.aspx?action=HastaSorgula',
        method: 'POST',
        headers: {
          'X-Ext-Net': 'delta=true',
          'action': 'HastaSorgula',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookie,
          'Content-Length': Buffer.byteLength(spData)
        }
      }, spData);
    }

    let qRes = await executeQuery(karmedLiveSession.token, karmedLiveSession.cookie);
    let dataMatch = qRes.body.match(/App\\.grdHastalarStore\\.proxy\\.data\\s*=\\s*(\\[.*?\\]);/s);

    if (!dataMatch) {
      console.log('[Karmed Sync] Sessiya eskirgan, qayta kirilmoqda...');
      const reAuth = await loginToKarmedLive(creds.username, creds.password, host, port);
      karmedLiveSession.token = reAuth.loginBilgi;
      karmedLiveSession.cookie = reAuth.cookie;
      qRes = await executeQuery(karmedLiveSession.token, karmedLiveSession.cookie);
      dataMatch = qRes.body.match(/App\\.grdHastalarStore\\.proxy\\.data\\s*=\\s*(\\[.*?\\]);/s);
    }

    if (!dataMatch) {
      throw new Error('Karmed javobida bemorlar ro\\'yxati topilmadi');
    }

    const rawList = safeParseExtNetJson(dataMatch[1]);
    if (!Array.isArray(rawList)) throw new Error("Bemorlar ma'lumoti noto'g'ri");

    const docsAuth = getDoctorsAuth();
    const doctorKeys = Object.keys(docsAuth || {});
    const doctorMap = {};

    doctorKeys.forEach(key => {
      const d = docsAuth[key] || {};
      const roomId = d.roomId || ('Ultratovush-' + key.replace('U', ''));
      doctorMap[roomId] = {
        id: roomId,
        room: roomId,
        num: key.replace('U', ''),
        shortName: d.shortName || roomId,
        doctorName: d.doctorName || 'Shifokor',
        roomTitle: d.roomTitle || \`\${roomId} XONA\`,
        roomNum: d.roomNum || '',
        kod: d.kod || '',
        soundId: d.soundId || 1,
        patients: [],
        count: 0
      };
    });

    const allPatients = [];
    let totalWaitingCount = 0;

    rawList.forEach((kp, idx) => {
      const queuedDoc = resolveQueuedRoomDoctor(kp, docsAuth);
      const acceptingDoc = resolveAcceptingDoctor(kp, docsAuth);

      const regIso = kp.KayitTarihi ? kp.KayitTarihi.split('T')[0] : '';
      const regTime = formatKarmedTimeString(kp.KayitTarihi || kp.KabulTarihi || kp.Saat);
      const acceptIso = kp.KabulTarihi ? kp.KabulTarihi.split('T')[0] : '';
      const acceptTime = kp.KabulTarihi ? formatKarmedTimeString(kp.KabulTarihi) : '';
      const confirmIso = kp.HakedisTarihi ? kp.HakedisTarihi.split('T')[0] : (kp.KabulTarihi ? kp.KabulTarihi.split('T')[0] : '');
      const confirmTime = kp.HakedisTarihi ? formatKarmedTimeString(kp.HakedisTarihi) : acceptTime;

      const statusCode = kp.DosyaDurumu || (kp.Durum === 'Bekleyen' ? 1 : (kp.Durum === 'Kabul Edilen' ? 4 : (kp.Durum === 'Rapor Onaylı' ? 8 : 1)));
      const isWaiting = statusCode === 1;
      const isAccepted = statusCode === 4;
      const isFinished = statusCode === 8 || (kp.Durum && String(kp.Durum).toLowerCase().includes('onay'));

      const isConfirmedToday = isFinished && (confirmIso === todayIso);
      const isRegToday = (regIso === todayIso);
      const isRegYesterday = (regIso === yesterdayIso);
      const isRegEarlier = (!isRegToday && regIso && regIso < todayIso);

      // Qoidaga binoan:
      // - Kutayotgan: Ulangan bo'lim xonasi navbatida turadi
      // - Qabul qilingan yoki ko'rikdan o'tgan: Tekshiruvni QABUL QILGAN VRACH o'tkazgan
      const activeDoc = (isAccepted || isFinished) ? (acceptingDoc || queuedDoc) : (queuedDoc || acceptingDoc);

      let hasDoctorSwitch = false;
      let switchText = 'Mos keladi';
      if (!isWaiting && queuedDoc && acceptingDoc && queuedDoc.roomId !== acceptingDoc.roomId) {
        hasDoctorSwitch = true;
        switchText = \`Ulangan: \${queuedDoc.shortName} ➔ Qabul: \${acceptingDoc.shortName}\`;
      }

      let dateTag = '';
      let dateTagType = 'today';
      const regPretty = formatIsoToDmy(regIso);
      const confPretty = formatIsoToDmy(confirmIso);

      if (isConfirmedToday) {
        if (isRegToday) {
          dateTag = "Bugun yo'naltirilgan, bugun tekshiruvdan o'tgan";
          dateTagType = "today_done";
        } else if (isRegYesterday) {
          dateTag = "Kecha yo'naltirilgan, bugun tekshiruvdan o'tgan";
          dateTagType = "yesterday_done";
        } else {
          dateTag = \`\${regPretty} da yo'naltirilgan, bugun tekshiruvdan o'tgan\`;
          dateTagType = "earlier_done";
        }
      } else if (isAccepted && (acceptIso === todayIso)) {
        if (isRegToday) {
          dateTag = "Bugun yo'naltirilgan, bugun qabul qilingan";
          dateTagType = "today_accepted";
        } else if (isRegYesterday) {
          dateTag = "Kecha yo'naltirilgan, bugun qabul qilingan";
          dateTagType = "yesterday_accepted";
        } else {
          dateTag = \`\${regPretty} da yo'naltirilgan, bugun qabul qilingan\`;
          dateTagType = "earlier_accepted";
        }
      } else if (isWaiting) {
        if (isRegToday) {
          dateTag = "Bugun ro'yxatga olingan";
          dateTagType = "today_waiting";
        } else if (isRegYesterday) {
          dateTag = "Kecha yo'naltirilgan, navbatda kutmoqda";
          dateTagType = "yesterday_waiting";
        } else {
          dateTag = \`\${regPretty} da yo'naltirilgan, navbatda kutmoqda\`;
          dateTagType = "earlier_waiting";
        }
      } else if (isFinished) {
        dateTag = \`\${confPretty} da tekshiruvdan o'tgan\`;
        dateTagType = "other_done";
      }

      let statusText = kp.Durum || 'Bekleyen';
      if (statusCode === 1) statusText = 'Bekleyen';
      else if (statusCode === 4) statusText = 'Kabul Edilen';
      else if (statusCode === 8) statusText = 'Rapor Onaylı';

      // 4. Toifasi (Sug'urta, Rezident, Order, No-rezident) va Joylashuvi (Bo'limda yotgan / yotmagan)
      const kurumRaw = String(kp.KurumAdi || kp.SosyalGuvence || '').trim();
      const kurumLower = kurumRaw.toLowerCase();
      let patientCategory = 'rezident';
      let categoryTitle = "Rezident (O'zbekiston)";
      let categoryBadge = "🇺🇿 Rezident";

      if (kurumLower.includes('no rezident') || kurumLower.includes('norezident') || kurumLower.includes('no-rezident')) {
        patientCategory = 'norezident';
        categoryTitle = "No-rezident (Chet el fuqarosi)";
        categoryBadge = "🌐 No-rezident";
      } else if (kurumLower.includes('order')) {
        patientCategory = 'order';
        categoryTitle = "Orderli (Davlat orderi)";
        categoryBadge = "📋 Orderli";
      } else if (kurumLower.includes('sugurta')) {
        patientCategory = 'sugurta';
        categoryTitle = "Sug'urta";
        categoryBadge = "🏥 Sug'urta";
      } else if (kurumLower.includes('rezident')) {
        patientCategory = 'rezident';
        categoryTitle = "Rezident (O'zbekiston)";
        categoryBadge = "🇺🇿 Rezident";
      } else if (kurumLower.includes('vaqf') || kurumLower.includes('fond') || kurumLower.includes('hokimiyat')) {
        patientCategory = 'order';
        categoryTitle = "Imtiyozli jamg'arma";
        categoryBadge = "🏛️ Imtiyozli";
      } else if (kurumRaw) {
        patientCategory = 'sugurta';
        categoryTitle = kurumRaw;
        categoryBadge = "🏥 " + kurumRaw;
      }

      // Bo'limda yotgan (Yatan / Statsionar) yoki yotmagan (Ambulator / Poliklinika)
      const yatPolVal = String(kp.YatPol || '').toUpperCase();
      const servisAdi = String(kp.ServisAdi || kp.AltServisAdi || kp.BolumAdi || '').trim();
      const isYatan = (yatPolVal === 'Y') || 
                      servisAdi.toLowerCase().includes('yatan') || 
                      (servisAdi && !servisAdi.toLowerCase().includes('poliklinik') && !servisAdi.toLowerCase().includes('ambulator'));
      const stayType = isYatan ? 'yatan' : 'ambulator';
      const stayTitle = isYatan ? "Bo'limda yotgan (Statsionar)" : "Bo'limda yotmagan (Ambulator)";
      const stayBadge = isYatan ? "🏥 Yotgan bemor" : "🚶 Ambulator";
      const departmentName = servisAdi || (isYatan ? "Statsionar bo'lim" : "Ambulatoriya");

      const patientObj = {
        patientId: String(kp.KimlikNo || kp.Id),
        dosyaNo: kp.ProtokolNo || kp.DosyaNo || '',
        labDosyaId: kp.Id,
        fullName: (kp.AdSoyad || ((kp.HastaAdi || '') + ' ' + (kp.Soyadi || ''))).trim(),
        queueNo: kp.MuayeneSirano || (idx + 1),
        globalQueueNo: idx + 1,
        status: statusText,
        statusCode: statusCode,
        registrationDate: regPretty || todayDmy,
        registrationIso: regIso,
        registrationTime: regTime,
        acceptanceDate: formatIsoToDmy(acceptIso),
        acceptanceTime: acceptTime,
        confirmationDate: formatIsoToDmy(confirmIso),
        confirmationTime: confirmTime,
        confirmationFullTime: kp.HakedisTarihi || kp.KabulTarihi || '',
        isConfirmedToday: isConfirmedToday,
        isRegToday: isRegToday,
        isRegYesterday: isRegYesterday,
        isRegEarlier: isRegEarlier,
        dateTag: dateTag,
        dateTagType: dateTagType,
        room: activeDoc ? activeDoc.roomId : (kp.AltBolumAdi || 'Biriktirilmagan'),
        roomTitle: activeDoc ? activeDoc.roomTitle : 'Umumiy navbat',
        doctorName: activeDoc ? activeDoc.doctorName : (kp.KabulEden || kp.DoktorAdi || 'Navbatchi shifokor'),
        referringDoctor: kp.DosyaDoktoru || '',
        queuedRoom: queuedDoc ? queuedDoc.roomId : (kp.AltBolumAdi || ''),
        queuedDoctorName: queuedDoc ? queuedDoc.doctorName : '',
        queuedRoomTitle: queuedDoc ? queuedDoc.roomTitle : '',
        examiningDoctor: acceptingDoc ? acceptingDoc.doctorName : (kp.KabulEden || ''),
        examiningRoom: acceptingDoc ? acceptingDoc.roomId : '',
        examiningRoomTitle: acceptingDoc ? acceptingDoc.roomTitle : '',
        hasDoctorSwitch: hasDoctorSwitch,
        switchText: switchText,
        kurumAdi: kurumRaw,
        patientCategory: patientCategory,
        categoryTitle: categoryTitle,
        categoryBadge: categoryBadge,
        yatPol: yatPolVal || (isYatan ? 'Y' : 'P'),
        isYatan: isYatan,
        stayType: stayType,
        stayTitle: stayTitle,
        stayBadge: stayBadge,
        department: departmentName,
        karmedIndex: idx
      };

      allPatients.push(patientObj);
      if (isWaiting || isAccepted) totalWaitingCount++;
      if (activeDoc && (isWaiting || isAccepted)) {
        doctorMap[activeDoc.roomId].patients.push(patientObj);
      }
    });

    allPatients.sort((a, b) => {
      const tA = a.registrationTime || '';
      const tB = b.registrationTime || '';
      return tA.localeCompare(tB) || (a.labDosyaId - b.labDosyaId);
    });

    const idToGlobalQueue = new Map();
    allPatients.forEach((p, idx) => {
      const gNo = idx + 1;
      p.queueNo = gNo;
      p.globalQueueNo = gNo;
      idToGlobalQueue.set(String(p.patientId).trim(), gNo);
    });

    let totalTodayRegisteredCount = 0;
    let totalEarlierRegisteredCount = 0;
    let totalCompletedCount = 0;
    let totalCompletedTodayCount = 0;
    let totalCompletedEarlierCount = 0;

    const summaryByDoctor = {};
    const completedByDoctor = {};
    const completedTodayByDoctor = {};
    const completedEarlierByDoctor = {};
    const earlierPatientsList = [];
    const completedPatientsByDoctor = {};

    allPatients.forEach(p => {
      if (p.isRegToday) totalTodayRegisteredCount++;
      else totalEarlierRegisteredCount++;

      if (p.isRegEarlier || p.isRegYesterday) earlierPatientsList.push(p);

      if (p.isConfirmedToday) {
        totalCompletedCount++;
        const rKey = p.room;
        if (rKey && rKey !== 'Biriktirilmagan') {
          completedByDoctor[rKey] = (completedByDoctor[rKey] || 0) + 1;
          completedPatientsByDoctor[rKey] = completedPatientsByDoctor[rKey] || [];
          completedPatientsByDoctor[rKey].push(p);
          if (p.isRegToday) {
            totalCompletedTodayCount++;
            completedTodayByDoctor[rKey] = (completedTodayByDoctor[rKey] || 0) + 1;
          } else {
            totalCompletedEarlierCount++;
            completedEarlierByDoctor[rKey] = (completedEarlierByDoctor[rKey] || 0) + 1;
          }
        }
      }
    });

    Object.values(doctorMap).forEach(doc => {
      doc.patients.forEach(p => {
        const pKey = String(p.patientId).trim();
        if (idToGlobalQueue.has(pKey)) {
          p.queueNo = idToGlobalQueue.get(pKey);
          p.globalQueueNo = idToGlobalQueue.get(pKey);
        }
      });
      doc.patients.sort((a, b) => (a.queueNo || 0) - (b.queueNo || 0));
      doc.count = doc.patients.length;
      doc.waitingCount = doc.patients.filter(p => p.statusCode !== 4).length;
      const rId = doc.room || doc.id;

      doc.completedCount = completedByDoctor[rId] || 0;
      doc.completedTodayCount = completedTodayByDoctor[rId] || 0;
      doc.completedEarlierCount = completedEarlierByDoctor[rId] || 0;

      const docTodayReg = allPatients.filter(p => (p.queuedRoom === rId || p.room === rId) && p.isRegToday).length;
      const docEarlierReg = allPatients.filter(p => (p.queuedRoom === rId || p.room === rId) && (p.isRegYesterday || p.isRegEarlier)).length;

      doc.totalToday = docTodayReg;
      doc.totalEarlier = docEarlierReg;
      doc.totalAll = docTodayReg + docEarlierReg;
      doc.earlierPatients = earlierPatientsList.filter(p => p.room === rId || p.queuedRoom === rId);
      doc.completedPatients = completedPatientsByDoctor[rId] || [];

      summaryByDoctor[rId] = doc.patients.length;
    });

    const acceptedByRoom = {};
    allPatients.forEach(p => {
      if (p.statusCode === 4 && p.room && p.room !== 'Biriktirilmagan') {
        acceptedByRoom[p.room] = p;
      }
    });

    Object.keys(acceptedByRoom).forEach(roomKey => {
      const p = acceptedByRoom[roomKey];
      const doc = doctorMap[roomKey] || {};
      activeCalls[roomKey] = {
        patientId: p.patientId,
        queueNo: p.queueNo,
        globalQueueNo: p.globalQueueNo,
        fullName: p.fullName,
        registrationTime: p.registrationTime,
        roomKey: roomKey,
        roomTitle: doc.roomTitle || p.roomTitle || \`\${roomKey} XONA\`,
        doctorName: doc.doctorName || p.doctorName || 'Shifokor',
        source: 'karmed_accepted',
        status: 'accepted',
        statusText: 'Qabul qilmoqda',
        calledAt: p.registrationTime || new Date().toISOString()
      };
    });

    const switchedPatientsList = allPatients.filter(p => p.hasDoctorSwitch);

    latestQueueData = {
      success: true,
      version: '8.0.0',
      timestamp: new Date().toISOString(),
      date: todayDmy,
      department: "Ultratovush",
      totalPatients: totalTodayRegisteredCount,
      totalAllPatients: allPatients.length,
      summary: {
        totalWaiting: totalWaitingCount,
        totalCompleted: totalCompletedCount,
        totalTodayRegistered: totalTodayRegisteredCount,
        totalPatients: totalTodayRegisteredCount,
        totalEarlierRegistered: totalEarlierRegisteredCount,
        totalCompletedToday: totalCompletedTodayCount,
        totalCompletedEarlier: totalCompletedEarlierCount,
        totalSwitchedDoctorsCount: switchedPatientsList.length,
        totalAll: allPatients.length,
        byDoctor: summaryByDoctor,
        completedByDoctor: completedByDoctor,
        completedPatientsByDoctor: completedPatientsByDoctor,
        switchedPatientsList: switchedPatientsList
      },
      doctors: Object.values(doctorMap),
      allPatients: allPatients,
      earlierPatients: earlierPatientsList,
      switchedPatients: switchedPatientsList,
      activeCalls: activeCalls,
      lastKarmedSync: new Date().toISOString()
    };

    try {
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(latestQueueData), 'utf8');
    } catch (e) {}

    broadcastSse(latestQueueData);
    console.log(\`[Karmed Sync] [OK] Sinxronlandi: Jami \${allPatients.length} bemor (Navbatda: \${totalWaitingCount}, Ko'rilgan: \${totalCompletedCount})\`);
  } catch (err) {
    console.warn(\`[Karmed Sync] Ogohlantirish: \${err.message}. Zaxira kesh ko'rsatilmoqda.\`);
  } finally {
    isSyncing = false;
  }
}

// Karmed sinxronlash davriyligi
const initialCreds = getKarmedCredentials();
setInterval(syncMasterQueueFromKarmed, (initialCreds.sync_interval_seconds || 15) * 1000);
setTimeout(syncMasterQueueFromKarmed, 1000);

// =========================================================================
// 6. HTTP SERVER & STATIK FAYLLAR
// =========================================================================

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost:' + PORT));
  } catch (e) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Asosiy TV ekrani
  if (pathname === '/' || pathname === '/tv' || pathname === '/tv.html' || pathname === '/index.html') {
    let indexPath = path.join(PUBLIC_DIR, 'tv.html');
    if (!fs.existsSync(indexPath)) indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  // 2. Vrach ko'rgan bemorlar ro'yxati
  if (pathname === '/doctor-completed' || pathname === '/doctor-completed.html') {
    const docPath = path.join(PUBLIC_DIR, 'doctor-completed.html');
    if (fs.existsSync(docPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(docPath).pipe(res);
      return;
    }
  }

  // 3. Jonli Navbat API
  if (pathname === '/api/queue-live' || pathname === '/api/queue' || pathname === '/api/queue/latest') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(latestQueueData));
    return;
  }

  // 4. Shifokor ko'rgan bemorlari API si
  if (pathname === '/api/doctor-completed-patients') {
    const qRoom = (parsedUrl.searchParams.get('room') || parsedUrl.searchParams.get('id') || '').trim();
    let docObj = null;
    if (latestQueueData && latestQueueData.doctors) {
      docObj = latestQueueData.doctors.find(d => (d.id === qRoom || d.room === qRoom));
      if (!docObj) {
        docObj = latestQueueData.doctors.find(d =>
          (d.room && d.room.toLowerCase().includes(String(qRoom).toLowerCase())) ||
          String(d.num) === String(qRoom)
        );
      }
    }
    const patients = (docObj && docObj.completedPatients) ? docObj.completedPatients : [];
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      room: docObj ? docObj.room : qRoom,
      doctorName: docObj ? docObj.doctorName : '',
      totalCompleted: patients.length,
      completedTodayCount: docObj ? docObj.completedTodayCount : 0,
      completedEarlierCount: docObj ? docObj.completedEarlierCount : 0,
      patients: patients
    }));
    return;
  }

  // 5. Server-Sent Events (SSE)
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('\\n');
    res.write('data: ' + JSON.stringify(latestQueueData) + '\\n\\n');

    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // 6. Status
  if (pathname === '/status' || pathname === '/api/status') {
    const cCreds = getKarmedCredentials();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      name: 'Karmed UTT TV Monitor Standalone Server',
      version: '8.0.0',
      port: PORT,
      karmedHost: cCreds.karmed_host,
      karmedPort: cCreds.karmed_port,
      karmedUser: cCreds.username,
      clientsCount: sseClients.length,
      lastKarmedSync: latestQueueData.lastKarmedSync,
      uptimeSeconds: Math.floor(process.uptime())
    }));
    return;
  }

  // 7. Statik fayllar
  let safePath = path.normalize(pathname).replace(/^(\\\\.\\\\.[\\\\/\\\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, safePath, 'index.html');
  }

  if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 — Sahifa topilmadi');
});

server.listen(PORT, '0.0.0.0', () => {
  const localIps = getNetworkIps();
  const creds = getKarmedCredentials();
  console.log('================================================================================');
  console.log('       RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI');
  console.log('       UTT TV JONLI MONITORI — STANDALONE MUSTAQIL SERVER (v8.0.0)');
  console.log('================================================================================');
  console.log(' [OK] TV Monitor Serveri muvaffaqiyatli ishga tushdi!');
  console.log(' 📁 Katalog: ' + BASE_DIR);
  console.log(\` 🏥 Karmed Integratsiyasi: http://\${creds.karmed_host}:\${creds.karmed_port} (Foydalanuvchi: \${creds.username})\`);
  console.log(\` 🔑 Kirish ma'lumotlari: OPEN_KARMED_KEY.json faylidan o'qiladi\`);
  console.log('');
  console.log(' 💻 Ushbu kompyuterda TV ekranini ochish:');
  console.log('    http://localhost:' + PORT);
  console.log('');
  console.log(' 📶 Bir xil Wi-Fi dagi Smart TV yoki telefonlardan ulanish:');
  if (localIps.length > 0) {
    localIps.forEach(ip => {
      console.log('    http://' + ip + ':' + PORT);
    });
  } else {
    console.log('    http://127.0.0.1:' + PORT);
  }
  console.log('================================================================================');
  console.log(" [MASLAHAT] Serverni to'xtatish uchun STOP_TV_MONITOR.bat ni bosing.");
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(\` [XATO] \${PORT}-port band! Boshqa dastur ushbu portdan foydalanmoqda.\`);
  } else {
    console.error(' [XATO] Serverda xatolik:', e.message);
  }
});
`;

fs.writeFileSync(path.join(TARGET_DIR, 'server.js'), serverSource, 'utf8');
console.log('  + server.js yaratildi (Direct Karmed Master Engine v8.0.0)');

// 8. C# LAUNCHER VA START_TV_MONITOR.EXE YARATISH
console.log('=== 8. START_TV_MONITOR.EXE KOMPILYATSIYA QILISH ===');
const csSourcePath = 'C:\\Users\\Rentgen xona\\.gemini\\antigravity\\brain\\59a6f7ba-3483-44a3-95bd-dd3888fe4eb7\\scratch\\START_TV_MONITOR.cs';
const targetExePath = path.join(TARGET_DIR, 'START_TV_MONITOR.exe');
const iconPath = path.join(WORKSPACE_DIR, 'build-installer', 'app.ico');

try {
  let cscCmd = `powershell -Command "& 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe' /nologo /target:winexe /r:System.Windows.Forms.dll /r:System.Drawing.dll /out:'${targetExePath}' `;
  if (fs.existsSync(iconPath)) {
    cscCmd += `/win32icon:'${iconPath}' `;
  }
  cscCmd += `'${csSourcePath}'"`;
  
  execSync(cscCmd, { stdio: 'inherit' });
  const exeKb = Math.round(fs.statSync(targetExePath).size / 1024);
  console.log(`[OK] START_TV_MONITOR.exe muvaffaqiyatli kompilyatsiya qilindi (${exeKb} KB)`);
} catch (e) {
  console.error('[XATO] START_TV_MONITOR.exe kompilyatsiya xatosi:', e.message);
}

// 9. STOP_TV_MONITOR.BAT VA QO'LLANMA YARATISH
console.log("=== 9. STOP_TV_MONITOR.BAT VA QO'LLANMA.TXT YARATISH ===");

const stopBatContent = `@echo off
chcp 65001 >nul
title UTT TV MONITORNI TO'XTATISH
cd /d "%~dp0"

echo TV Monitor serveri to'xtatilmoqda...
taskkill /F /IM START_TV_MONITOR.exe >nul 2>&1
powershell -Command "Get-NetTCPConnection -LocalPort 9877 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo [OK] TV Monitor serveri muvaffaqiyatli to'xtatildi!
timeout /t 2 >nul
`;
fs.writeFileSync(path.join(TARGET_DIR, 'STOP_TV_MONITOR.bat'), stopBatContent, 'utf8');
console.log('  + STOP_TV_MONITOR.bat yaratildi');

const readmeContent = `===============================================================================
       RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI
       UTT TV JONLI MONITORI — STANDALONE PORTATIV VARIANTI (v8.0.0)
===============================================================================

Ushbu portativ paket faqat UTT TV monitorini istalgan Windows kompyuterida
(Windows 7/8/10/11) to'liq mustaqil (zero-dependency) ishga tushirish imkonini beradi.
Hech qanday boshqa oraliq serverga bog'liq emas. O'zi to'g'ridan-to'g'ri Karmed
tizimi bilan integratsiya qilib ishlaydi.

Dastur ekranda hech qanday ortiqcha qora konsol oynalarisiz orqa fonda (tizim
patnisi / system tray) jim ishlaydi va brauzerda TV monitor oynasini ochib beradi.

-------------------------------------------------------------------------------
1. BOSHQARUV FAYLLARI (ASOSIY PAPKADA):
-------------------------------------------------------------------------------
1. START_TV_MONITOR.exe   — Serverni orqa fonda ishga tushirish va TV ekranini ochish dasturi.
2. STOP_TV_MONITOR.bat    — Serverni to'xtatish.
3. OPEN_KARMED_KEY.json   — Karmed tizimiga kirish ma'lumotlari (R5 va 17720).
4. config.json            — Port (standart: 9877) sozlamalari.

-------------------------------------------------------------------------------
2. BOSHQA KOMPYUTERDA ISHLATISH TARTIBI:
-------------------------------------------------------------------------------
1. "UTT_TV_MONITOR_PORTABLE.zip" arxivini fleshka orqali boshqa kompyuterga
   o'tkazing va arxivdan chiqaring.
2. Papka ichidagi "START_TV_MONITOR.exe" faylini ikki marta bosing.
   - Hech qanday qora konsol oynasi chiqmaydi!
   - Soat yonida (tizim patnisida) UTT nishonchasi paydo bo'ladi.
   - Brauzerda TV monitori avtomatik ochiladi. To'liq ekranga o'tkazish uchun F11 ni bosing.
3. Ochilgan manzil orqali ushbu kompyuter bilan bitta Wi-Fi tarmog'iga ulangan
   Smart TV yoki telefon brauzerida TV monitorni ko'rish mumkin bo'ladi.
   (Masalan: http://KOMPYUTER_IP:9877)
4. Serverni to'xtatish uchun:
   - Tizim patnisidagi (soat yonidagi) nishonchani o'ng tugma bilan bosib "Chiqish" ni tanlang,
   - Yoki "STOP_TV_MONITOR.bat" ni bosing.

-------------------------------------------------------------------------------
3. KARMED KALITI VA MA'LUMOTLARNI O'ZGARTIRISH (OPEN_KARMED_KEY.json):
-------------------------------------------------------------------------------
Papkada "OPEN_KARMED_KEY.json" fayli mavjud:
{
  "username": "R5",
  "password": "17720",
  "karmed_host": "192.168.150.111",
  "karmed_port": 2025,
  "sync_interval_seconds": 15
}
Agar shifokor yoki xona kodi o'zgarsa, ushbu fayl orqali "username" va "password"
qiymatlarini osongina tahrirlab qo'yishingiz mumkin. Server har 15 soniyada
ushbu hisob orqali eng yangi bemorlar navbatini to'g'ridan-to'g'ri Karmeddan yangilab turadi.
===============================================================================
`;
fs.writeFileSync(path.join(TARGET_DIR, "QO'LLANMA.txt"), readmeContent, 'utf8');
console.log("  + QO'LLANMA.txt yaratildi");

// 10. ZIP ARXIVINI YARATISH
console.log('=== 10. ZIP ARXIVINI YARATISH ===');
if (fs.existsSync(ZIP_OUTPUT)) fs.unlinkSync(ZIP_OUTPUT);

try {
  console.log('ZIP siqilmoqda: ' + ZIP_OUTPUT + ' ...');
  execSync(`powershell -Command "Compress-Archive -Path '${TARGET_DIR}' -DestinationPath '${ZIP_OUTPUT}' -Force"`, { stdio: 'inherit' });
  const zipMb = (fs.statSync(ZIP_OUTPUT).size / (1024 * 1024)).toFixed(1);
  console.log(`[OK] ZIP arxiv muvaffaqiyatli yaratildi! Hajmi: ${zipMb} MB`);
  console.log(`[MANZIL] ${ZIP_OUTPUT}`);
} catch (e) {
  console.error('[XATO] ZIP yaratishda xatolik:', e.message);
}

console.log('================================================================================');
console.log(' [TAYYOR] v8.0.0 PORTATIV PAKET YARATILDI!');
console.log('================================================================================');
