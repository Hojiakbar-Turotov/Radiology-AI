/**
 * ==============================================================================
 *  🏥 KARMED MRT & MSKT AQLLI NAVBAT VA MONITORING SERVERI (mrt_server.js)
 * ==============================================================================
 *  - Port: 9890 (process.env.PORT || 9890)
 *  - 100% Mustaqil Node.js Server (Nol tashqi og'ir paketlarsiz, faqat ws)
 *  - MRT Kutish Zali TV Tablosi: http://localhost:9890/tv (Ovozsiz vizual chaqiruv)
 *  - MRT Aqlli Navbat & Boshqaruv Portali: http://localhost:9890/control
 *  - Real-time WebSocket Ko'prigi (TV va Boshqaruv o'rtasida 0.01s aloqa)
 *  - Aqlli Navbat Taqsimlash Dvigateli (Kunlik sig'im to'lganda eng yaqin kunga o'tkazish)
 *  - Telegram Bot Foydalanuvchilarini Boshqarish (Laborant roli berish / bekor qilish)
 * ==============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { exec } = require('child_process');
const { WebSocketServer, WebSocket } = require('ws');

const unifiedCore = require('./shared/unified_core');

const PORT = parseInt(process.env.PORT || '9890', 10);
const HOST = '0.0.0.0';

const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const QUEUE_FILE = path.join(DATA_DIR, 'mrt_queue.json');
const DEVICES_FILE = path.join(DATA_DIR, 'devices.json');
const USERS_FILE = path.join(DATA_DIR, 'bot_users.json');
const SERVICES_FILE = path.join(DATA_DIR, 'services.json');
const ALLOWED_IPS_FILE = path.join(DATA_DIR, 'allowed_ips.json');
const CONSENT_QUESTIONS_FILE = path.join(DATA_DIR, 'consent_questions.json');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');
const BOT_SETTINGS_FILE = path.join(DATA_DIR, 'bot_settings.json');
const PRINTER_SETTINGS_FILE = path.join(DATA_DIR, 'printer_settings.json');

const scheduler = require('./shared/scheduler');
const systemMonitor = require('./lib/system_monitor');

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

const DAY_NAMES_UZ = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

// -------------------------------------------------------------
// STANDART MA'LUMOTLAR
// -------------------------------------------------------------
const DEFAULT_DEVICES = [
  {
    id: "mrt1",
    name: "MRT 1 (1.5 Tesla)",
    room: "1-MRT Xonasi",
    type: "MRT",
    specialty: "Tomografiya (MRT)",
    hasInjector: true,
    supportsContrast: true,
    status: "active",
    currentPatientId: null
  },
  {
    id: "mrt2",
    name: "MRT 2 (1.5 Tesla)",
    room: "2-MRT Xonasi",
    type: "MRT",
    specialty: "Tomografiya (MRT)",
    hasInjector: false,
    supportsContrast: false,
    status: "active",
    currentPatientId: null
  },
  {
    id: "mskt1",
    name: "MSKT 1",
    room: "1-MSKT Xonasi",
    type: "MSKT",
    specialty: "Tomografiya (MSKT)",
    hasInjector: true,
    supportsContrast: true,
    status: "active",
    currentPatientId: null
  }
];

// -------------------------------------------------------------
// JSON YORDAMCHI METODLAR
// -------------------------------------------------------------
function readJson(file, fallback = []) {
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
  });
  res.end(JSON.stringify(data));
}

// -------------------------------------------------------------
// AQLLI NAVBAT TAQSIMLASH DVIGATELI (SMART SCHEDULER)
// -------------------------------------------------------------
function findNextAvailableSmartSlot(input) {
  const queue = readJson(QUEUE_FILE, []);
  const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);
  const result = scheduler.findNextAvailableSmartSlot(input, queue);
  if (result.success) {
    const chosenDevice = devices.find(d => d.id === result.deviceId) || devices[0];
    const dParts = result.date.split('-');
    result.dateFormatted = `${dParts[2]}.${dParts[1]}.${dParts[0]}`;
    result.deviceName = chosenDevice.name;
    result.deviceRoom = chosenDevice.room;
    result.timeSlot = `${result.startTime} - ${result.finishTime}`;
  }
  return result;
}

// -------------------------------------------------------------
// WEBSOCKET HUB VA MIJOZLAR (REALTIME)
// -------------------------------------------------------------
const wsClients = new Set();

function broadcastWs(type, payload, isLoopback = false) {
  unifiedCore.broadcastWs(type, payload, isLoopback);
}

// -------------------------------------------------------------
// ASOSIY HTTP SERVER
// -------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.headers['cf-connecting-ip'] || 
                   (req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : null) || 
                   (req.socket.remoteAddress ? req.socket.remoteAddress.replace('::ffff:', '') : 'unknown');
  const userAgent = req.headers['user-agent'] || '';

  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
    });
    return res.end();
  }

  try {
    const parsedUrl = new URL(req.url, 'http://localhost');
    parsedUrl.query = Object.fromEntries(parsedUrl.searchParams);
    const pathname = parsedUrl.pathname;

  // =========================================================================
  // 1. REST API
  // =========================================================================
  if (pathname.startsWith('/api/')) {
    
    // GET /api/status - Server salomatligi
    if (req.method === 'GET' && pathname === '/api/status') {
      return sendJson(res, {
        status: 'active',
        service: 'Karmed MRT & MSKT Smart Queue Server',
        port: PORT,
        timestamp: new Date().toISOString(),
        version: '7.3.0'
      });
    }

    // GET /api/monitor/health - To'liq tizim diagnostikasi va salomatligi
    if (req.method === 'GET' && pathname === '/api/monitor/health') {
      try {
        const report = await systemMonitor.checkSystemHealth();
        return sendJson(res, { success: true, ...report });
      } catch (monErr) {
        return sendJson(res, { success: false, error: monErr.message }, 500);
      }
    }

    // GET /api/monitor/events - So'nggi qayd etilgan xatoliklar va insidentlar
    if (req.method === 'GET' && pathname === '/api/monitor/events') {
      const limit = parseInt(parsedUrl.query.limit || '50', 10);
      const events = systemMonitor.getRecentEvents(limit);
      return sendJson(res, { success: true, count: events.length, events });
    }

    // GET /api/devices - Apparatlar ro'yxati
    if (req.method === 'GET' && pathname === '/api/devices') {
      const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);
      return sendJson(res, { success: true, devices });
    }

    // POST /api/devices - Apparat sozlamalarini yangilash
    if (req.method === 'POST' && pathname === '/api/devices') {
      const body = await readBody(req);
      const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);
      if (Array.isArray(body)) {
        writeJson(DEVICES_FILE, body);
        return sendJson(res, { success: true, devices: body, message: "Apparatlar ro'yxati saqlandi" });
      } else if (body && body.id) {
        const idx = devices.findIndex(d => d.id === body.id);
        if (idx !== -1) {
          devices[idx] = { ...devices[idx], ...body };
        } else {
          devices.push(body);
        }
        writeJson(DEVICES_FILE, devices);
        return sendJson(res, { success: true, device: devices[idx !== -1 ? idx : devices.length - 1], message: "Apparat sozlamalari saqlandi" });
      }
      return sendJson(res, { success: false, error: "Noto'g'ri apparat ma'lumotlari" }, 400);
    }

    // GET /api/services - Xizmatlar ro'yxati
    if (req.method === 'GET' && pathname === '/api/services') {
      const services = readJson(SERVICES_FILE, []);
      const mrtServices = services.filter(s => s.type === 'MRT' || s.type === 'MSKT');
      return sendJson(res, { success: true, services: mrtServices.length > 0 ? mrtServices : services });
    }

    // GET /api/queue - Navbatdagi bemorlar (Bugungi yoki tanlangan sana)
    if (req.method === 'GET' && pathname === '/api/queue') {
      const targetDate = parsedUrl.query.date || new Date().toISOString().split('T')[0];
      const allQueue = readJson(QUEUE_FILE, []);
      const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);

      const dayQueue = allQueue.filter(p => (p.date === targetDate || p.scheduledDate === targetDate));

      return sendJson(res, {
        success: true,
        date: targetDate,
        queue: dayQueue,
        devices: devices
      });
    }

    // POST /api/queue/smart-slot - Eng yaqin bo'sh vaqtni avtomatik aniqlash
    if (req.method === 'POST' && pathname === '/api/queue/smart-slot') {
      const body = await readBody(req);
      const slot = findNextAvailableSmartSlot(body);
      return sendJson(res, slot);
    }

    // POST /api/queue/book - Aqlli navbatga yozish (Yangi bemor)
    if (req.method === 'POST' && pathname === '/api/queue/book') {
      const body = await readBody(req);
      const resData = unifiedCore.bookPatient(body, body.operatorName || 'Admin', true);
      return sendJson(res, resData, resData.statusCode || (resData.success ? 200 : 400));
    }

    // POST /api/queue/call - Bemorni xonaga chaqirish (TV da ovozsiz miltillash)
    if (req.method === 'POST' && pathname === '/api/queue/call') {
      const body = await readBody(req);
      const queue = readJson(QUEUE_FILE, []);
      const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);

      const patient = queue.find(p => p.id === body.id);
      if (!patient) {
        return sendJson(res, { success: false, error: "Bemor topilmadi" }, 404);
      }

      patient.status = 'calling';
      patient.calledAt = new Date().toISOString();
      patient.updatedAt = new Date().toISOString();

      // Apparatga biriktirish
      const dev = devices.find(d => d.id === patient.deviceId);
      if (dev) dev.currentPatientId = patient.id;

      writeJson(QUEUE_FILE, queue);
      writeJson(DEVICES_FILE, devices);

      // WebSocket TV ga chaqiruv signali yuborish (ovozsiz, miltillash uchun)
      broadcastWs('queue_updated', { queue, devices });
      broadcastWs('voice_announcement', {
        patientName: patient.patientName,
        ticketNumber: patient.ticketNumber,
        deviceId: patient.deviceId,
        patient: patient
      });

      return sendJson(res, { success: true, patient, message: `Bemor xonaga chaqirildi (${patient.ticketNumber})` });
    }

    // POST /api/queue/status - Holatni o'zgartirish (in_progress, completed, cancelled)
    if (req.method === 'POST' && pathname === '/api/queue/status') {
      const body = await readBody(req);
      const queue = readJson(QUEUE_FILE, []);
      const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);

      const patient = queue.find(p => p.id === body.id);
      if (!patient) {
        return sendJson(res, { success: false, error: "Bemor topilmadi" }, 404);
      }

      const oldStatus = patient.status;
      patient.status = body.status; // 'in_progress', 'completed', 'cancelled', 'waiting'
      patient.updatedAt = new Date().toISOString();

      const dev = devices.find(d => d.id === patient.deviceId);

      if (body.status === 'in_progress') {
        patient.startedAt = new Date().toISOString();
        if (dev) dev.currentPatientId = patient.id;
      } else if (body.status === 'completed' || body.status === 'cancelled') {
        patient.finishedAt = new Date().toISOString();
        if (dev && dev.currentPatientId === patient.id) {
          dev.currentPatientId = null;
        }
      }

      writeJson(QUEUE_FILE, queue);
      writeJson(DEVICES_FILE, devices);

      broadcastWs('queue_updated', { queue, devices });

      return sendJson(res, { success: true, patient, message: `Holat yangilandi: ${patient.status}` });
    }

    // POST /api/queue/delete - Bemorni o'chirish
    if (req.method === 'POST' && pathname === '/api/queue/delete') {
      const body = await readBody(req);
      let queue = readJson(QUEUE_FILE, []);
      const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);

      const idx = queue.findIndex(p => p.id === body.id);
      if (idx === -1) {
        return sendJson(res, { success: false, error: "Bemor topilmadi" }, 404);
      }

      const deleted = queue.splice(idx, 1)[0];
      const dev = devices.find(d => d.id === deleted.deviceId);
      if (dev && dev.currentPatientId === deleted.id) {
        dev.currentPatientId = null;
        writeJson(DEVICES_FILE, devices);
      }

      writeJson(QUEUE_FILE, queue);
      broadcastWs('queue_updated', { queue, devices });

      return sendJson(res, { success: true, deleted, message: "Bemor navbatdan o'chirildi" });
    }

    // GET /api/bot/users - Bot foydalanuvchilari ro'yxati
    if (req.method === 'GET' && pathname === '/api/bot/users') {
      const users = readJson(USERS_FILE, []);
      return sendJson(res, { success: true, users });
    }

    // POST /api/bot/set-role - Bot foydalanuvchisiga rol berish (admin / laborant / user)
    if (req.method === 'POST' && pathname === '/api/bot/set-role') {
      const body = await readBody(req);
      const users = readJson(USERS_FILE, []);

      const user = users.find(u => String(u.id) === String(body.id));
      if (!user) {
        return sendJson(res, { success: false, error: "Bot foydalanuvchisi topilmadi" }, 404);
      }

      const validRoles = ['admin', 'laborant', 'user'];
      const newRole = validRoles.includes(body.role) ? body.role : 'user';
      user.role = newRole;
      user.updatedAt = new Date().toISOString();
      writeJson(USERS_FILE, users);

      return sendJson(res, {
        success: true,
        user,
        message: `Foydalanuvchi ${user.fullName} roli o'zgartirildi: ${newRole}`
      });
    }

    // GET /api/bot/settings - Bot WebApp va sozlamalari
    if (req.method === 'GET' && pathname === '/api/bot/settings') {
      const settings = readJson(BOT_SETTINGS_FILE, {
        webAppUrl: "https://hojiakbar-turotov.github.io/Radiology-AI/control.html",
        adminPassword: "15420"
      });
      return sendJson(res, { success: true, settings });
    }

    // POST /api/bot/settings - Bot WebApp va sozlamalarini saqlash
    if (req.method === 'POST' && pathname === '/api/bot/settings') {
      const body = await readBody(req);
      const settings = readJson(BOT_SETTINGS_FILE, {
        webAppUrl: "https://hojiakbar-turotov.github.io/Radiology-AI/control.html",
        adminPassword: "15420"
      });
      if (body.webAppUrl !== undefined) settings.webAppUrl = String(body.webAppUrl).trim();
      if (body.adminPassword !== undefined) settings.adminPassword = String(body.adminPassword).trim();
      writeJson(BOT_SETTINGS_FILE, settings);
      return sendJson(res, { success: true, settings, message: "Bot sozlamalari saqlandi" });
    }

    // GET /api/admin/ips - Ruxsat berilgan va kutilayotgan IP lar ro'yxati
    if (req.method === 'GET' && pathname === '/api/admin/ips') {
      const data = readJson(ALLOWED_IPS_FILE, { allowed: [], pending: [] });
      return sendJson(res, { success: true, allowed: data.allowed || [], pending: data.pending || [] });
    }

    // POST /api/admin/ips/approve - IP ga ruxsat berish (full yoki view_only)
    if (req.method === 'POST' && pathname === '/api/admin/ips/approve') {
      const body = await readBody(req);
      const data = readJson(ALLOWED_IPS_FILE, { allowed: [], pending: [] });
      const targetIp = String(body.ip || '').trim();
      if (!targetIp) return sendJson(res, { success: false, error: "IP ko'rsatilmadi" }, 400);

      data.allowed = data.allowed || [];
      data.pending = data.pending || [];

      // Pending dan o'chirish
      data.pending = data.pending.filter(p => p.ip !== targetIp);

      const existingIdx = data.allowed.findIndex(a => a.ip === targetIp);
      const role = body.role === 'view_only' ? 'view_only' : 'full';
      const name = body.name || (existingIdx !== -1 ? data.allowed[existingIdx].name : `Kompyuter (${targetIp})`);

      const entry = {
        ip: targetIp,
        name: name,
        role: role,
        status: 'approved',
        approvedAt: new Date().toISOString()
      };

      if (existingIdx !== -1) {
        data.allowed[existingIdx] = entry;
      } else {
        data.allowed.push(entry);
      }

      writeJson(ALLOWED_IPS_FILE, data);
      return sendJson(res, { success: true, entry, message: `IP ${targetIp} uchun ruxsat berildi (${role})` });
    }

    // POST /api/admin/ips/reject - IP ni rad etish yoki ro'yxatdan o'chirish
    if (req.method === 'POST' && pathname === '/api/admin/ips/reject') {
      const body = await readBody(req);
      const data = readJson(ALLOWED_IPS_FILE, { allowed: [], pending: [] });
      const targetIp = String(body.ip || '').trim();

      data.allowed = (data.allowed || []).filter(a => a.ip !== targetIp);
      data.pending = (data.pending || []).filter(p => p.ip !== targetIp);

      writeJson(ALLOWED_IPS_FILE, data);
      return sendJson(res, { success: true, message: `IP ${targetIp} o'chirildi / rad etildi` });
    }

    // POST /api/admin/ips/request - Masofaviy kompyuterdan kirish ruxsati so'rash
    if (req.method === 'POST' && pathname === '/api/admin/ips/request') {
      const body = await readBody(req);
      const clientIp = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0].trim() : req.socket.remoteAddress.replace('::ffff:', '');
      const targetIp = String(body.ip || clientIp).trim();
      const pcName = String(body.name || 'Lokal Kompyuter').trim();

      const data = readJson(ALLOWED_IPS_FILE, { allowed: [], pending: [] });
      data.allowed = data.allowed || [];
      data.pending = data.pending || [];

      const isAllowed = data.allowed.find(a => a.ip === targetIp);
      if (isAllowed) {
        return sendJson(res, { success: true, status: 'already_approved', entry: isAllowed });
      }

      let pEntry = data.pending.find(p => p.ip === targetIp);
      if (!pEntry) {
        pEntry = {
          ip: targetIp,
          name: pcName,
          requestedAt: new Date().toISOString()
        };
        data.pending.push(pEntry);
        writeJson(ALLOWED_IPS_FILE, data);
      }

      return sendJson(res, { success: true, status: 'pending', entry: pEntry });
    }

    // POST /api/karmed/search - Bemor ID / Talon bo'yicha qidirish (Admin uchun Karmed proxy)
    if (req.method === 'POST' && pathname === '/api/karmed/search') {
      const body = await readBody(req);
      const postData = JSON.stringify(body);
      
      const pReq = http.request({
        hostname: '127.0.0.1',
        port: 9891,
        path: '/api/karmed/search',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 20000
      }, (pRes) => {
        let respData = '';
        pRes.on('data', chunk => { respData += chunk; });
        pRes.on('end', () => {
          res.writeHead(pRes.statusCode, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
          });
          res.end(respData);
        });
      });

      pReq.on('error', (err) => {
        sendJson(res, { success: false, error: 'Karmed qidiruv xizmati (9891) bilan aloqa xatosi: ' + err.message }, 502);
      });
      pReq.on('timeout', () => {
        pReq.destroy();
        sendJson(res, { success: false, error: 'Karmed qidiruv xizmati javob berish vaqti tugadi' }, 504);
      });
      pReq.write(postData);
      pReq.end();
      return;
    }

    // GET /api/admin/exam-configs yoki /api/exam-configs - Barcha tekshiruvlar sozlamalari va anketalari
    if (req.method === 'GET' && (pathname === '/api/admin/exam-configs' || pathname === '/api/exam-configs')) {
      const services = readJson(SERVICES_FILE, []);
      const consentQuestions = readJson(CONSENT_QUESTIONS_FILE, []);
      return sendJson(res, { success: true, services, consentQuestions });
    }

    // POST /api/admin/exam-configs - Tekshiruv vaqti, tayyorgarligi, qarshi ko'rsatma va savollarini saqlash
    if (req.method === 'POST' && pathname === '/api/admin/exam-configs') {
      const body = await readBody(req);
      const code = String(body.code || '').trim().toUpperCase();
      if (!code) return sendJson(res, { success: false, error: "Tekshiruv kodi ko'rsatilmadi" }, 400);

      const services = readJson(SERVICES_FILE, []);
      let svc = services.find(s => s.code === code);
      if (!svc) {
        svc = {
          code: code,
          name: body.name || `Tekshiruv ${code}`,
          type: body.type || 'MRT',
          isContrast: Boolean(body.isContrast),
          isInjector: Boolean(body.isInjector)
        };
        services.push(svc);
      }

      if (body.duration != null) svc.duration = parseInt(body.duration, 10);
      if (body.preparation != null) svc.preparation = String(body.preparation).trim();
      if (body.contraindications != null) svc.contraindications = String(body.contraindications).trim();
      if (Array.isArray(body.consentQuestions)) {
        svc.consentQuestions = body.consentQuestions;
      }
      svc.updatedAt = new Date().toISOString();
      svc.updatedBy = body.updatedBy || 'Admin';

      writeJson(SERVICES_FILE, services);
      return sendJson(res, { success: true, service: svc, message: `[${code}] tekshiruv sozlamalari muvaffaqiyatli saqlandi` });
    }

    // GET /api/schedules - Joriy ish grafiklarini olish
    if (req.method === 'GET' && pathname === '/api/schedules') {
      const schedules = readJson(SCHEDULES_FILE, {});
      return sendJson(res, { success: true, schedules });
    }

    // GET /api/admin/schedules - Admin uchun ish grafiklari
    if (req.method === 'GET' && pathname === '/api/admin/schedules') {
      const schedules = readJson(SCHEDULES_FILE, {});
      return sendJson(res, { success: true, schedules });
    }

    // POST /api/admin/schedules - Ish grafiklarini saqlash
    if (req.method === 'POST' && pathname === '/api/admin/schedules') {
      const body = await readBody(req);
      if (!body || typeof body !== 'object') {
        return sendJson(res, { success: false, error: "Noto'g'ri ma'lumot formati" }, 400);
      }
      writeJson(SCHEDULES_FILE, body);
      return sendJson(res, { success: true, schedules: body, message: "Ish grafiklari muvaffaqiyatli saqlandi!" });
    }

    // POST /api/queue/available-slots - Sana va apparat bo'yicha bo'sh vaqtlar va band oraliqlarni olish
    if (req.method === 'POST' && pathname === '/api/queue/available-slots') {
      const body = await readBody(req);
      const targetDate = body.date || body.scheduledDate;
      const deviceId = body.deviceId || 'mrt1';
      const durationMinutes = parseInt(body.durationMinutes || (deviceId === 'mskt1' ? 30 : 60), 10);
      const queue = readJson(QUEUE_FILE, []);

      const result = scheduler.getAvailableSlotsForDay(targetDate, deviceId, durationMinutes, queue);
      return sendJson(res, result);
    }

    // POST /api/internal/ws-sync - Boshqa jarayonlardan (masalan 9891) kelgan WS sinxronizatsiya
    if (req.method === 'POST' && pathname === '/api/internal/ws-sync') {
      const body = await readBody(req);
      if (body && body.type) {
        broadcastWs(body.type, body.payload, true);
      }
      return sendJson(res, { success: true });
    }

    // POST /api/karmed/search - Karmed bemor qidiruvi (Yagona drayver orqali)
    if (req.method === 'POST' && pathname === '/api/karmed/search') {
      const body = await readBody(req);
      const patientId = String(body.patientId || body.query || '').trim();
      if (!patientId) {
        return sendJson(res, { success: false, error: "Bemor ID kiritilishi shart" }, 400);
      }
      try {
        const result = await unifiedCore.searchPatientInKarmed(patientId);
        return sendJson(res, result);
      } catch (err) {
        console.error("[Karmed Search Error on 9890]:", err.message);
        return sendJson(res, { success: false, error: `Karmed aloqa xatosi: ${err.message}` }, 502);
      }
    }

    // GET /api/exam-configs - Tekshiruvlar sozlamalari va rozilik savollari
    if (req.method === 'GET' && pathname === '/api/exam-configs') {
      const services = readJson(SERVICES_FILE, []);
      const consentQuestions = readJson(CONSENT_QUESTIONS_FILE, []);
      return sendJson(res, { success: true, services, consentQuestions });
    }

    // GET /api/printers - O'rnatilgan printerlar ro'yxati
    if (req.method === 'GET' && pathname === '/api/printers') {
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

    // GET & POST /api/printer-settings
    if (req.method === 'GET' && pathname === '/api/printer-settings') {
      const settings = readJson(PRINTER_SETTINGS_FILE, { ticketPrinter: '', consentPrinter: '', autoPrint: false });
      return sendJson(res, { success: true, settings });
    }
    if (req.method === 'POST' && pathname === '/api/printer-settings') {
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

    // POST /api/print - Talon yoki rozilik varaqasini chop etish
    if (req.method === 'POST' && pathname === '/api/print') {
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
          });
        } catch (pe) {}
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

    return sendJson(res, { success: false, error: "API yo'li topilmadi" }, 404);
  }

  // =========================================================================
  // 2. STATIK FAYLLARNI UZATISH (STATIC FILES)
  // =========================================================================
  let reqPath = decodeURI(pathname);

  // Asosiy sahifa (Root) va Admin boshqaruv portaliga yo'naltirish
  if (reqPath === '/' || reqPath === '/control' || reqPath === '/control/' || reqPath === '/admin' || reqPath === '/doctor') {
    reqPath = '/public/mrt_control.html';
  }

  // Registratura portaliga yo'naltirish
  if (reqPath === '/registration' || reqPath === '/registration/' || reqPath === '/reg' || reqPath === '/registratura') {
    reqPath = '/public/mrt_registration.html';
  }

  // TV Tabloga yo'naltirish
  if (reqPath === '/tv' || reqPath === '/tv/' || reqPath === '/mrt-tv' || reqPath === '/tablo') {
    reqPath = '/mrt-tv/index.html';
  }

  // TV Tablo resurslari fallback (style.css va app.js)
  if (reqPath === '/style.css' && !fs.existsSync(path.join(ROOT_DIR, 'style.css'))) {
    reqPath = '/mrt-tv/style.css';
  }
  if (reqPath === '/app.js' && !fs.existsSync(path.join(ROOT_DIR, 'app.js'))) {
    reqPath = '/mrt-tv/app.js';
  }

  // Favicon so'rovi (404 xatosini oldini olish)
  if (reqPath === '/favicon.ico') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
    return res.end();
  }

  // Fayl manzilini aniqlash
  let filePath = path.join(ROOT_DIR, reqPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      systemMonitor.recordRequestMetric('mrt_server', req.method, reqPath, 404, Date.now() - startTime, clientIp, userAgent);
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(`<h1>404 - Fayl topilmadi (${reqPath})</h1>`, 'utf-8');
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content);
    }
  });
  } catch (uncaughtErr) {
    const duration = Date.now() - startTime;
    systemMonitor.recordRequestMetric('mrt_server', req.method, req.url, 500, duration, clientIp, userAgent);
    systemMonitor.logIncident('mrt_server', 'CRITICAL', `Kutilmagan server xatosi: ${uncaughtErr.message}`, {
      method: req.method,
      url: req.url,
      clientIp,
      userAgent: (userAgent || '').substring(0, 120),
      stack: uncaughtErr.stack
    });
    return sendJson(res, { success: false, error: "Server ichki xatosi: " + uncaughtErr.message }, 500);
  }
});

// -------------------------------------------------------------
// WEBSOCKET SERVERNI ULASH (REALTIME HUB)
// -------------------------------------------------------------
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  wsClients.add(ws);
  unifiedCore.registerWsClient(ws);

  // Boshlang'ich navbatni uzatish
  const todayStr = new Date().toISOString().split('T')[0];
  const queue = readJson(QUEUE_FILE, []);
  const devices = readJson(DEVICES_FILE, DEFAULT_DEVICES);

  ws.send(JSON.stringify({
    type: 'queue_init',
    payload: {
      queue: queue.filter(p => p.date === todayStr),
      devices: devices
    },
    timestamp: Date.now()
  }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.action === 'register') {
        // ro'yxatdan o'tish
      } else if (data.action === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      }
    } catch (e) {}
  });

  ws.on('close', () => {
    wsClients.delete(ws);
    unifiedCore.removeWsClient(ws);
  });
  ws.on('error', () => {
    wsClients.delete(ws);
    unifiedCore.removeWsClient(ws);
  });
});

// -------------------------------------------------------------
// SERVERNI ISHGA TUSHIRISH
// -------------------------------------------------------------
server.listen(PORT, HOST, () => {
  console.log('================================================================================');
  console.log('  🧲 KARMED MRT & MSKT YAGONA SERVER (Port 9890)');
  console.log(`  🌐 Boshqaruv Portali (Admin):     http://localhost:${PORT}/control`);
  console.log(`  📝 Registratura Portali:          http://localhost:${PORT}/registration`);
  console.log(`  📺 Kutish Zali TV Tablosi:        http://localhost:${PORT}/tv`);
  console.log('================================================================================');
});
