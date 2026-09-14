const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_DIR = 'c:\\Users\\Rentgen xona\\Desktop\\UTT';
const TARGET_DIR = path.join(WORKSPACE_DIR, 'UTT_TV_MONITOR_PORTABLE');
const DESKTOP_DIR = 'c:\\Users\\Rentgen xona\\Desktop';
const ZIP_OUTPUT = path.join(DESKTOP_DIR, 'UTT_TV_MONITOR_PORTABLE.zip');

console.log('=== 1. PAPKALARNI YARATISH ===');
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

console.log("=== 2. PORTATIV NODE.EXE KO'CHIRISH ===");
const sourceNode = 'C:\\Program Files\\nodejs\\node.exe';
const targetNode = path.join(TARGET_DIR, 'runtime', 'node.exe');
if (fs.existsSync(sourceNode)) {
  fs.copyFileSync(sourceNode, targetNode);
  const mb = Math.round(fs.statSync(targetNode).size / (1024 * 1024));
  console.log(`[OK] node.exe ko'chirildi (${mb} MB)`);
} else {
  console.warn('[OGOHLANTIRISH] Tizim node.exe topilmadi:', sourceNode);
}

console.log("=== 3. FAQAT TV MONITOR FAYLLARINI KO'CHIRISH ===");
const filesToCopy = [
  { from: 'public/index.html', to: 'public/index.html' },
  { from: 'public/app.js', to: 'public/app.js' },
  { from: 'public/styles.css', to: 'public/styles.css' },
  { from: 'public/doctor-completed.html', to: 'public/doctor-completed.html' },
  { from: 'public/chime_engine.js', to: 'public/chime_engine.js' },
  { from: 'public/icons/logo-onko.png', to: 'public/icons/logo-onko.png' }
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

console.log("=== 4. BOSHLANG'ICH MA'LUMOTLARNI KO'CHIRISH ===");
const queueSrc = path.join(WORKSPACE_DIR, 'latest_queue.json');
const queueDst = path.join(TARGET_DIR, 'data', 'latest_queue.json');
if (fs.existsSync(queueSrc)) {
  fs.copyFileSync(queueSrc, queueDst);
  console.log('  + data/latest_queue.json ko\'chirildi');
}

console.log('=== 5. CONFIG.JSON YARATISH ===');
const config = {
  port: 9877,
  main_server_url: "http://10.34.17.210:9877",
  sync_interval_ms: 3000,
  auto_open_browser: true,
  comment: "Boshqa kompyuterda asosiy serverdan navbat ma'lumotlarini olish uchun main_server_url manzilini kiriting. Agar shu kompyuterning o'zida ma'lumotlar bo'lsa, main_server_url ni bo'sh qoldirishingiz mumkin."
};
fs.writeFileSync(path.join(TARGET_DIR, 'config.json'), JSON.stringify(config, null, 2), 'utf8');

console.log('=== 6. MUSTAQIL SERVER.JS YARATISH ===');
const serverJsContent = `/**
 * KARMED UTT TV JONLI MONITOR — STANDALONE PORTATIV SERVER (v7.1.0)
 * 
 * Ushbu server faqat TV monitorini ishga tushirish uchun mo'ljallangan.
 * Hech qanday npm kutubxonalarsiz (Zero-Dependency) istalgan Windows kompyuterida
 * o'rnatilgan yoki portativ node.exe orqali ishlaydi.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const BASE_DIR = __dirname;
const PUBLIC_DIR = path.join(BASE_DIR, 'public');
const DATA_DIR = path.join(BASE_DIR, 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'latest_queue.json');
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');

// Standart konfiguratsiya
let config = {
  port: 9877,
  main_server_url: "http://10.34.17.210:9877",
  sync_interval_ms: 3000,
  auto_open_browser: true
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    config = Object.assign(config, JSON.parse(raw));
  } catch (e) {
    console.warn('[CONFIG] Konfiguratsiyani o\\'qishda xatolik, standart qiymatlar ishlatiladi.');
  }
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : config.port;

// Papkalarni tekshirish
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Xotiradagi jonli navbat ma'lumotlari
let latestQueueData = {
  success: true,
  totalPatients: 0,
  summary: { totalWaiting: 0, totalDone: 0, totalCompleted: 0 },
  doctors: [],
  allPatients: [],
  activeCalls: {},
  timestamp: new Date().toISOString()
};

// Lokal kesh faylidan boshlang'ich yuklash
if (fs.existsSync(QUEUE_FILE)) {
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf8');
    latestQueueData = JSON.parse(raw);
  } catch (e) {}
}

// SSE mijozlari ro'yxati
let sseClients = [];

// MIME turlari
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

// Tarmoq IP manzillarini aniqlash
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

// SSE mijozlariga xabar yuborish
function broadcastSse(data) {
  const payload = 'data: ' + JSON.stringify(data) + '\\n\\n';
  sseClients.forEach(client => {
    try { client.write(payload); } catch (e) {}
  });
}

// Asosiy serverdan ma'lumotlarni sinxronlash
function syncFromMainServer() {
  const mainUrl = config.main_server_url;
  if (!mainUrl || typeof mainUrl !== 'string' || !mainUrl.trim()) return;

  const targetUrl = mainUrl.trim().replace(/\\/+$/, '') + '/api/queue-live?t=' + Date.now();
  const clientLib = targetUrl.startsWith('https') ? https : http;

  try {
    const req = clientLib.get(targetUrl, { timeout: 4000 }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data && (data.doctors || data.summary)) {
              latestQueueData = data;
              try { fs.writeFileSync(QUEUE_FILE, body, 'utf8'); } catch (e) {}
              broadcastSse(data);
            }
          } catch (pe) {}
        });
      }
    });
    req.on('error', () => {});
    req.on('timeout', () => { req.destroy(); });
  } catch (e) {}
}

// Har 3 soniyada asosiy serverdan yangilash
if (config.main_server_url) {
  setInterval(syncFromMainServer, config.sync_interval_ms || 3000);
  syncFromMainServer();
}

// HTTP Server
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

  // CORS sarlavhalari
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Asosiy TV monitor sahifasi (/, /tv, /index.html)
  if (pathname === '/' || pathname === '/tv' || pathname === '/index.html') {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  // 2. Vrach ko'rgan bemorlar ro'yxati iframe sahifasi
  if (pathname === '/doctor-completed' || pathname === '/doctor-completed.html') {
    const docPath = path.join(PUBLIC_DIR, 'doctor-completed.html');
    if (fs.existsSync(docPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(docPath).pipe(res);
      return;
    }
  }

  // 3. Jonli Navbat API (TV poll qilishi uchun)
  if (pathname === '/api/queue-live' || pathname === '/api/queue' || pathname === '/api/queue/latest') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(latestQueueData));
    return;
  }

  // 4. Shifokorning ko'rgan bemorlari API si (/api/doctor-completed-patients)
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

  // 5. Server-Sent Events (SSE) — real vaqtda yangilanishlar
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

  // 6. Status va Versiya
  if (pathname === '/status' || pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'online',
      name: 'Karmed UTT TV Monitor Portable Server',
      version: '7.1.0',
      port: PORT,
      clientsCount: sseClients.length,
      mainServerConnected: !!config.main_server_url,
      uptimeSeconds: Math.floor(process.uptime())
    }));
    return;
  }

  // 7. Statik fayllarni uzatish (public/)
  let safePath = path.normalize(pathname).replace(/^(\\.\\.[\\/\\\\])+/, '');
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

  // 404 — Topilmadi
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 — Sahifa topilmadi');
});

// Serverni ishga tushirish
server.listen(PORT, '0.0.0.0', () => {
  const localIps = getNetworkIps();
  console.log('================================================================================');
  console.log('       RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI');
  console.log('       KARMED UTT TV JONLI MONITORI — STANDALONE PORTATIV (v7.1.0)');
  console.log('================================================================================');
  console.log(' [OK] TV Monitor Serveri muvaffaqiyatli ishga tushdi!');
  console.log(' 📁 Katalog: ' + BASE_DIR);
  console.log(' 🌐 Asosiy server manzilidan yangilanadi: ' + (config.main_server_url || '(Lokal rejim)'));
  console.log('');
  console.log(' 💻 Ushbu kompyuterda TV ekranini ochish:');
  console.log('    http://localhost:' + PORT);
  console.log('');
  console.log(' 📶 Smart TV yoki boshqa kompyuterlardan ulanish:');
  if (localIps.length > 0) {
    localIps.forEach(ip => {
      console.log('    http://' + ip + ':' + PORT);
    });
  } else {
    console.log('    http://127.0.0.1:' + PORT);
  }
  console.log('================================================================================');
  console.log(' [MASLAHAT] Serverni to\\'xtatish uchun STOP_TV_MONITOR.bat ni bosing.');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(\` [XATO] \${PORT}-port band! Boshqa port yoki mavjud serverdan foydalanilmoqda.\`);
  } else {
    console.error(' [XATO] Serverda xatolik:', e.message);
  }
});
`;
fs.writeFileSync(path.join(TARGET_DIR, 'server.js'), serverJsContent, 'utf8');

console.log("=== 7. BAT VA QO'LLANMA FAYLLARINI YARATISH ===");
const startBatContent = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
title KARMED UTT TV JONLI MONITOR (PORTATIV)

set NODE_CMD=node
if exist "%~dp0runtime\\node.exe" (
    set NODE_CMD="%~dp0runtime\\node.exe"
)

echo ===============================================================================
echo       RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI
echo       UTT TV JONLI MONITORI — STANDALONE PORTATIV SERVER (v7.1.0)
echo ===============================================================================
echo.
echo [1/1] TV Monitor Serveri ishga tushirilmoqda...
start "" %NODE_CMD% server.js

timeout /t 2 >nul
echo [OK] TV Monitor Serveri faol!
echo.
echo Brauzerda TV ekrani ochilmoqda: http://localhost:9877
start http://localhost:9877
echo.
echo ===============================================================================
echo Server fonda ishlab turibdi. To'xtatish uchun STOP_TV_MONITOR.bat ni bosing.
echo ===============================================================================
`;
fs.writeFileSync(path.join(TARGET_DIR, 'START_TV_MONITOR.bat'), startBatContent, 'utf8');

const stopBatContent = `@echo off
chcp 65001 >nul
title UTT TV MONITORNI TO'XTATISH
cd /d "%~dp0"

echo TV Monitor serveri to'xtatilmoqda...
powershell -Command "Get-NetTCPConnection -LocalPort 9877 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo [OK] TV Monitor serveri to'xtatildi!
timeout /t 2 >nul
`;
fs.writeFileSync(path.join(TARGET_DIR, 'STOP_TV_MONITOR.bat'), stopBatContent, 'utf8');

const readmeContent = `===============================================================================
       RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI
       UTT TV JONLI MONITORI — STANDALONE PORTATIV VARIANTI (v7.1.0)
===============================================================================

Ushbu portativ paket faqat UTT TV monitorini istalgan kompyuterda (Windows 7/8/10/11)
hech qanday qo'shimcha dastur (Node.js, brauzer plaginlari yoki boshqa narsa)
o'rnatmasdan to'liq mustaqil (portable) ishga tushirish imkoniyatini beradi.

-------------------------------------------------------------------------------
1. ISHGA TUSHIRISH (JUDA ODDIY):
-------------------------------------------------------------------------------
1. Ushbu papkadagi "START_TV_MONITOR.bat" faylini ikki marta bosing.
2. Server avtomatik tarzda o'zining portativ Node.js dvigateli bilan ishga tushadi
   va standart brauzerda http://localhost:9877 manzilini (TV Monitor ekranini) ochadi.
3. TV Monitor to'liq ekranda ochilishi uchun klaviaturadagi F11 tugmasini bosing.

-------------------------------------------------------------------------------
2. SMART TV YOKI BOSHQARUV KOMPYUTERLARIDAN ULASH:
-------------------------------------------------------------------------------
Agar ushbu kompyuter va Smart TV bitta Wi-Fi yoki mahalliy tarmoqda bo'lsa:
1. Ushbu kompyuterning IP manzilini bilib oling (masalan: 10.34.17.210 yoki 192.168.1.50).
2. Smart TV brauzerida quyidagi manzilni oching:
   http://KOMPYUTER_IP:9877
   (Masalan: http://10.34.17.210:9877)
3. Shifokor xonasi bo'yicha yakka TV monitori kerak bo'lsa:
   http://KOMPYUTER_IP:9877/?room=Ultratovush-10 (yoki 1 dan 11 gacha)

-------------------------------------------------------------------------------
3. ASOSIY SERVER BILAN BOG'LASH (config.json):
-------------------------------------------------------------------------------
Papkada "config.json" fayli mavjud:
{
  "port": 9877,
  "main_server_url": "http://10.34.17.210:9877",
  "sync_interval_ms": 3000,
  "auto_open_browser": true
}
Agar ushbu portativ nusxa boshqa kompyuterda turgan bo'lsa, "main_server_url"
maydoniga asosiy kompyuterning IP manzilini kiriting. Portativ server har 3
soniyada asosiy serverdan eng yangi navbat ma'lumotlarini olib, mahalliy
ekranni real-vaqtda yangilab turadi.

-------------------------------------------------------------------------------
4. TO'XTATISH:
-------------------------------------------------------------------------------
Serverni to'xtatish uchun "STOP_TV_MONITOR.bat" faylini ikki marta bosing.
===============================================================================
`;
fs.writeFileSync(path.join(TARGET_DIR, 'QO\'LLANMA.txt'), readmeContent, 'utf8');

console.log('=== 8. ZIP ARXIVINI YARATISH ===');
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
console.log('=== TAYYOR! ===');
