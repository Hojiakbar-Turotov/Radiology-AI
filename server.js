/**
 * ==============================================================================
 *  🏥 TIBBIYOT / MRT & UTT AQLLI NAVBAT TIZIMI - LOKAL SERVER (server.js)
 * ==============================================================================
 *  - 100% Lokal Intranet / Offline muhitda ishlash
 *  - WebSocket Realtime Hub (TV Tablo, Vrach, Server Dashboard)
 *  - Smart MRT/MSKT Taqsimlash Dvigateli
 *  - Mustaqil Server Monitoring & Trafik Audit Paneli (/server-dashboard)
 *  - Laborantlar Telegram Boti (@bot)
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Lokal kutubxonalar
const db = require('./lib/db');
const auth = require('./lib/auth');
const SmartScheduler = require('./lib/smart-scheduler');
const wsHub = require('./lib/ws');
const LaborantBot = require('./lib/laborant-bot');

const scheduler = new SmartScheduler(db);
const laborantBot = new LaborantBot(db, scheduler);

const PORT = 3000;
const ROOT_DIR = __dirname;

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
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
      if (config.family === 'IPv4' && !config.internal) {
        return config.address;
      }
    }
  }
  return '127.0.0.1';
}

function parseBody(req) {
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

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  });
  res.end(JSON.stringify(data));
}

// -------------------------------------------------------------
// ASOSIY HTTP SERVER
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').replace(/^.*:/, '');

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // -------------------------------------------------------------
  // API YO'NALISHLARI (REST API)
  // -------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    try {
      // 0. AUTH YO'NALISHLARI
      if (req.method === 'POST' && pathname === '/api/auth/login') {
        const body = await parseBody(req);
        const result = auth.authenticate(body.login, body.password);
        if (result.success) {
          logRequest(clientIp, 'POST', pathname, 200, startTime, `Login muvaffaqiyatli: ${result.user.login} (${result.user.role})`);
          return sendJSON(res, result);
        } else {
          logRequest(clientIp, 'POST', pathname, 401, startTime, `Login xatosi: ${body.login || 'noma\'lum'}`);
          return sendJSON(res, result, 401);
        }
      }

      if (req.method === 'GET' && pathname === '/api/auth/me') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = auth.verifySession(token);
        if (user) {
          return sendJSON(res, { success: true, user });
        } else {
          return sendJSON(res, { success: false, error: "Sessiya yaroqsiz" }, 401);
        }
      }

      if (req.method === 'POST' && pathname === '/api/auth/logout') {
        const body = await parseBody(req);
        const token = body.token || (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
        auth.logout(token);
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Chiqish (Logout)`);
        return sendJSON(res, { success: true });
      }

      if (req.method === 'GET' && pathname === '/api/users') {
        return sendJSON(res, { success: true, users: auth.getUsers() });
      }

      // 1. GET /api/queue - Bugungi navbat
      if (req.method === 'GET' && pathname === '/api/queue') {
        const dateFilter = parsedUrl.searchParams.get('date');
        const deviceFilter = parsedUrl.searchParams.get('deviceId');
        let queue = db.getQueue(dateFilter);
        if (deviceFilter) {
          queue = queue.filter(p => p.deviceId === deviceFilter);
        }
        sendJSON(res, { success: true, queue, devices: db.getDevices() });
        logRequest(clientIp, 'GET', pathname, 200, startTime, `Navbat olindi (${queue.length} ta bemor)`);
        return;
      }

      // 2. POST /api/queue/add - Aqlli navbatga qo'shish (Karmed / Registratura)
      if (req.method === 'POST' && pathname === '/api/queue/add') {
        const body = await parseBody(req);
        if (!body.patientName && !body.fullName) {
          return sendJSON(res, { success: false, error: "Bemor ismi kiritilmadi" }, 400);
        }

        // Aqlli rejalashtirish
        const slotAllocation = scheduler.allocateOptimalSlot(body);
        const patientData = {
          ...body,
          ...slotAllocation
        };

        const addedPatient = db.addPatient(patientData);

        // WebSocket orqali barchaga xabar berish
        wsHub.broadcast('queue_updated', {
          action: 'patient_added',
          patient: addedPatient,
          queue: db.getQueue(),
          devices: db.getDevices()
        });

        sendJSON(res, { success: true, patient: addedPatient, message: "Bemor aqlli navbatga muvaffaqiyatli qo'shildi" });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Yangi bemor: ${addedPatient.patientName} (#${addedPatient.ticketNumber}) -> ${addedPatient.deviceId}`);
        return;
      }

      // 3. POST /api/queue/update-status - Bemor holatini yangilash
      if (req.method === 'POST' && pathname === '/api/queue/update-status') {
        const body = await parseBody(req);
        const { id, status, extraData } = body;
        if (!id || !status) {
          return sendJSON(res, { success: false, error: "id va status talab qilinadi" }, 400);
        }

        const updated = db.updatePatientStatus(id, status, extraData);
        if (!updated) {
          return sendJSON(res, { success: false, error: "Bemor topilmadi" }, 404);
        }

        wsHub.broadcast('queue_updated', {
          action: 'status_updated',
          patient: updated,
          queue: db.getQueue(),
          devices: db.getDevices()
        });

        sendJSON(res, { success: true, patient: updated });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Bemor ${updated.ticketNumber} holati: ${status}`);
        return;
      }

      // 4. POST /api/queue/call - Xonaga chaqirish (Ovozli e'lon)
      if (req.method === 'POST' && pathname === '/api/queue/call') {
        const body = await parseBody(req);
        const { id } = body;
        const patient = db.updatePatientStatus(id, 'calling');
        if (!patient) return sendJSON(res, { success: false, error: "Bemor topilmadi" }, 404);

        const dev = db.getDeviceById(patient.deviceId);

        // TV va boshqa ekranlarga ovozli chaqiruv xabari
        wsHub.broadcast('voice_announcement', {
          type: 'call_room',
          patient: patient,
          room: dev ? dev.room : "MRT Xonasi",
          ticketNumber: patient.ticketNumber,
          patientName: patient.patientName
        });

        wsHub.broadcast('queue_updated', {
          action: 'patient_called',
          patient: patient,
          queue: db.getQueue()
        });

        sendJSON(res, { success: true, patient });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Xonaga chaqirildi: ${patient.ticketNumber}`);
        return;
      }

      // 5. POST /api/queue/prep - Tayyorgarlikka chaqirish (Kateter, kiyim)
      if (req.method === 'POST' && pathname === '/api/queue/prep') {
        const body = await parseBody(req);
        const { id } = body;
        const patient = db.updatePatientStatus(id, 'preparing');
        if (!patient) return sendJSON(res, { success: false, error: "Bemor topilmadi" }, 404);

        const dev = db.getDeviceById(patient.deviceId);

        wsHub.broadcast('voice_announcement', {
          type: 'call_prep',
          patient: patient,
          room: dev ? dev.room : "MRT Xonasi",
          ticketNumber: patient.ticketNumber,
          patientName: patient.patientName,
          isContrast: patient.isContrast
        });

        wsHub.broadcast('queue_updated', {
          action: 'patient_prep',
          patient: patient,
          queue: db.getQueue()
        });

        sendJSON(res, { success: true, patient });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Tayyorgarlikka chaqirildi: ${patient.ticketNumber}`);
        return;
      }

      // 6. GET /api/devices - Qurilmalar holati
      if (req.method === 'GET' && pathname === '/api/devices') {
        sendJSON(res, { success: true, devices: db.getDevices() });
        return;
      }

      // 7. GET /api/services - Xizmatlar katalogi
      if (req.method === 'GET' && pathname === '/api/services') {
        sendJSON(res, { success: true, catalog: scheduler.getServicesCatalog() });
        return;
      }

      // 8. GET /api/server-stats - Server monitoring ko'rsatkichlari
      if (req.method === 'GET' && pathname === '/api/server-stats') {
        const mem = process.memoryUsage();
        const stats = {
          uptimeSeconds: Math.floor(process.uptime()),
          uptimeFormatted: formatUptime(process.uptime()),
          memoryRssMb: (mem.rss / (1024 * 1024)).toFixed(1),
          memoryHeapMb: (mem.heapUsed / (1024 * 1024)).toFixed(1),
          connectedClientsCount: wsHub.clients.size,
          connectedClients: wsHub.getClientsList(),
          totalPatientsToday: db.getQueue().length,
          activeDevicesCount: db.getDevices().length,
          serverTime: new Date().toLocaleTimeString('ru-RU'),
          serverDate: new Date().toLocaleDateString('ru-RU'),
          ip: getLocalIP(),
          nodeVersion: process.version
        };
        sendJSON(res, { success: true, stats });
        return;
      }

      // 9. GET /api/server-logs - Audit va trafik loglari
      if (req.method === 'GET' && pathname === '/api/server-logs') {
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '100');
        sendJSON(res, { success: true, logs: db.getLogs(limit) });
        return;
      }

      // 10. POST /api/server-backup - Qo'lda zaxira nusxa yaratish
      if (req.method === 'POST' && pathname === '/api/server-backup') {
        const backupPath = db.createManualBackup();
        sendJSON(res, { success: true, path: path.basename(backupPath), message: "Zaxira nusxa saqlandi" });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Zaxira yaratildi: ${path.basename(backupPath)}`);
        return;
      }

      // 11. POST /api/server-reset-queue - Kunlik navbatni tozalash
      if (req.method === 'POST' && pathname === '/api/server-reset-queue') {
        db.createManualBackup(); // Tozalashdan oldin zaxira
        db.queue = [];
        db.saveQueue();
        wsHub.broadcast('queue_updated', { action: 'queue_reset', queue: [] });
        sendJSON(res, { success: true, message: "Navbat tozalandi" });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Navbat tozalandi`);
        return;
      }

      // 12. GET & POST /api/settings
      if (req.method === 'GET' && pathname === '/api/settings') {
        sendJSON(res, { success: true, settings: db.getSettings() });
        return;
      }
      if (req.method === 'POST' && pathname === '/api/settings') {
        const body = await parseBody(req);
        const updated = db.updateSettings(body);
        wsHub.broadcast('settings_updated', { settings: updated });
        sendJSON(res, { success: true, settings: updated });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Sozlamalar yangilandi`);
        return;
      }

      sendJSON(res, { success: false, error: "Noma'lum API endpoint" }, 404);
    } catch (apiErr) {
      console.error('[API Error]:', apiErr);
      sendJSON(res, { success: false, error: apiErr.message }, 500);
      logRequest(clientIp, req.method, pathname, 500, startTime, `Xato: ${apiErr.message}`);
    }
    return;
  }

  // -------------------------------------------------------------
  // STATIK FAYLLARNI UZATISH (Static File Server)
  // -------------------------------------------------------------
  let reqUrl = decodeURI(pathname);
  if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/navbat-yozish/index.html';
  }

  let filePath = path.join(ROOT_DIR, reqUrl);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>404 - Sahifa topilmadi (${pathname})</h1>`, 'utf-8');
        logRequest(clientIp, req.method, pathname, 404, startTime, "404 Not Found");
      } else {
        res.writeHead(500);
        res.end(`Server xatosi: ${error.code}`, 'utf-8');
        logRequest(clientIp, req.method, pathname, 500, startTime, `Server xatosi: ${error.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
      // Statik resurslar uchun faqat html larni log qilish (ortiqcha log tiqilmasligi uchun)
      if (extname === '.html') {
        logRequest(clientIp, req.method, pathname, 200, startTime, "Sahifa yuklandi");
      }
    }
  });
});

function logRequest(ip, method, path, status, startTime, details = '') {
  const durationMs = Date.now() - startTime;
  db.addLog({
    ip,
    method,
    path,
    status,
    durationMs,
    details
  });
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? d + 'k ' : ''}${h}s ${m}d ${s}son`;
}

// -------------------------------------------------------------
// SERVERNI ISHGA TUSHIRISH
// -------------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();

  // WebSocket Hub ni ulash
  wsHub.init(server, db);

  // Laborantlar Telegram botini ishga tushirish
  laborantBot.start();

  console.log('====================================================');
  console.log('  🏥 TIBBIYOT / MRT & UTT LOKAL SERVERI ISHLAMOQDA');
  console.log('====================================================');
  console.log(`\n[1] Boshqaruv & Ro'yxatga Olish:`);
  console.log(`   - Navbatga Yozish:   http://${ip}:${PORT}/navbat-yozish/`);
  console.log(`   - Server Dashboard:  http://${ip}:${PORT}/server-dashboard/`);
  console.log(`   - Tizimga Kirish:    http://${ip}:${PORT}/login.html`);
  console.log(`\n[2] MRT & UTT Xizmatlari:`);
  console.log(`   - MRT TV Tablo:      http://${ip}:${PORT}/mrt-tv/`);
  console.log(`   - Laborant Portali:  http://${ip}:${PORT}/laborant/`);
  console.log(`   - UTT TV Tablo:      http://${ip}:${PORT}/app3-android-tv/`);
  console.log(`   - Registratura:      http://${ip}:${PORT}/app1-registratura/`);
  console.log(`   - Vrach Xonasi:      http://${ip}:${PORT}/app2-vrach/`);
  console.log(`   - Admin Paneli:      http://${ip}:${PORT}/app4-admin/`);
  console.log(`\n[3] Telegram Bot:`);
  console.log(`   - Holati: 🟢 Faol (Long-polling)`);
  console.log(`====================================================\n`);
});

// Kutilmagan xatoliklarni ushlab qolish (Crash bo'lmasligi uchun)
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]:', err.message);
  db.addLog({
    ip: '127.0.0.1',
    method: 'ERROR',
    path: 'SYSTEM',
    status: 500,
    details: `Uncaught Exception: ${err.message}`
  });
});
