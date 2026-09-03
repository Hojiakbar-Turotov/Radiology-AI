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
const cluster = require('./lib/cluster');
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
// KARMED SERVER TEKSHIRUVI VA AVTO-FAILOVER (192.168.150.111 -> 213.230.91.59)
// -------------------------------------------------------------
const KARMED_LOCAL_URL = 'http://192.168.150.111:2025/Radiology/Rbys.aspx';
const KARMED_REMOTE_URL = 'http://213.230.91.59:2025/Radiology/Rbys.aspx';
let cachedKarmedStatus = null;
let lastKarmedCheckTime = 0;

async function checkKarmedActiveUrl(force = false) {
  const now = Date.now();
  if (!force && cachedKarmedStatus && (now - lastKarmedCheckTime < 25000)) {
    return cachedKarmedStatus;
  }

  return new Promise((resolve) => {
    let resolved = false;
    const req = http.get(KARMED_LOCAL_URL, { timeout: 1600 }, (res) => {
      if (!resolved) {
        resolved = true;
        cachedKarmedStatus = {
          url: KARMED_LOCAL_URL,
          host: '192.168.150.111:2025',
          isLocal: true,
          isFallback: false,
          status: 'online',
          message: 'Lokal Karmed serveri (192.168.150.111) faol'
        };
        lastKarmedCheckTime = Date.now();
        resolve(cachedKarmedStatus);
      }
    });

    const fallback = (errReason) => {
      if (!resolved) {
        resolved = true;
        cachedKarmedStatus = {
          url: KARMED_REMOTE_URL,
          host: '213.230.91.59:2025',
          isLocal: false,
          isFallback: true,
          status: 'fallback_online',
          message: `Lokal Karmed (192.168.150.111) aloqa bermadi (${errReason}). Tashqi serverga (213.230.91.59) o'tildi.`
        };
        lastKarmedCheckTime = Date.now();
        resolve(cachedKarmedStatus);
      }
    };

    req.on('error', (e) => fallback(e.message));
    req.on('timeout', () => { req.destroy(); fallback('TIMEOUT'); });
  });
}

// -------------------------------------------------------------
// KARMED TESKARI PROKSI (REVERSE PROXY - BIR XIL ORIGIN MUHITI)
// -------------------------------------------------------------
function isKarmedProxiedPath(pathname) {
  const p = pathname.toLowerCase();

  // Mahalliy server sahifalari va fayllari (Hech qachon Karmed/IIS ga proksi qilinmasligi shart):
  if (
    p === '/login.html' ||
    p.startsWith('/login.html') ||
    p.startsWith('/karmed-workspace') ||
    p.startsWith('/navbat-yozish') ||
    p.startsWith('/laborant') ||
    p.startsWith('/mrt-tv') ||
    p.startsWith('/server-dashboard') ||
    p.startsWith('/app4-admin') ||
    p.startsWith('/shared') ||
    p.startsWith('/data') ||
    p.startsWith('/api')
  ) {
    return false;
  }

  return (
    p.startsWith('/radiology') ||
    p.startsWith('/login/') ||
    p === '/login' ||
    p.startsWith('/login.aspx') ||
    p.includes('.axd') ||
    p.startsWith('/telerik') ||
    p.startsWith('/dxr') ||
    p.startsWith('/app_themes') ||
    p.startsWith('/common/') ||
    p.startsWith('/reports/') ||
    p.startsWith('/karmed-proxy')
  );
}

function proxyToKarmed(req, res, pathname) {
  const isLocal = !(cachedKarmedStatus && cachedKarmedStatus.isFallback);
  const targetHost = isLocal ? '192.168.150.111' : '213.230.91.59';
  const targetPort = 2025;

  let targetPath = req.url;
  if (targetPath.startsWith('/karmed-proxy/')) {
    targetPath = targetPath.replace('/karmed-proxy', '');
  }

  const headers = { ...req.headers };
  headers['host'] = `${targetHost}:${targetPort}`;

  if (headers['referer']) {
    headers['referer'] = headers['referer'].replace(new RegExp(`https?://${req.headers.host}`, 'gi'), `http://${targetHost}:${targetPort}`);
  }
  if (headers['origin']) {
    headers['origin'] = `http://${targetHost}:${targetPort}`;
  }

  const proxy = http.request({
    hostname: targetHost,
    port: targetPort,
    path: targetPath,
    method: req.method,
    headers: headers,
    timeout: 15000
  }, (targetRes) => {
    const resHeaders = { ...targetRes.headers };

    // Redirect bo'lsa localhost ga o'zgartirish
    if (resHeaders['location']) {
      resHeaders['location'] = resHeaders['location'].replace(new RegExp(`https?://${targetHost}:${targetPort}`, 'gi'), `http://${req.headers.host}`);
    }

    // Set-Cookie ni localhost ga moslash (SameSite=Lax birinchi darajali bo'ladi)
    if (resHeaders['set-cookie']) {
      resHeaders['set-cookie'] = resHeaders['set-cookie'].map(c => {
        return c.replace(/domain=[^;]+;?/gi, '').replace(/secure;?/gi, '');
      });
    }

    res.writeHead(targetRes.statusCode, resHeaders);
    targetRes.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error('[Karmed Proxy Error]:', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Karmed Serveriga ulanib bo\'lmadi: ' + err.message);
  });

  req.pipe(proxy);
}

function getAuthUser(req) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  return auth.verifySession(token);
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

  // Karmed yo'llari bo'lsa, to'g'ridan-to'g'ri Karmedga proksi qilish (CORS va kuki to'siqsiz)
  if (isKarmedProxiedPath(pathname)) {
    return proxyToKarmed(req, res, pathname);
  }

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
          return sendJSON(res, { success: false, error: "Avtorizatsiyadan o'tilmagan" }, 401);
        }
      }

      // Shaxsiy profilni yangilash (F.I.SH, Login, Parol, Ish vaqti, h.k.)
      if (req.method === 'POST' && pathname === '/api/auth/profile') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = auth.verifySession(token);
        if (!user) return sendJSON(res, { success: false, error: "Avtorizatsiya talab qilinadi" }, 401);

        const body = await parseBody(req);
        try {
          const updated = auth.updateProfile(user.login, body);
          logRequest(clientIp, 'POST', pathname, 200, startTime, `Profil yangilandi: ${updated.login}`);
          return sendJSON(res, { success: true, user: updated, message: "Profil muvaffaqiyatli saqlandi" });
        } catch (err) {
          return sendJSON(res, { success: false, error: err.message }, 400);
        }
      }

      // Xodimlarni boshqarish: Ro'yxatni olish
      if (req.method === 'GET' && pathname === '/api/auth/staff') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = auth.verifySession(token);
        try {
          const staff = auth.getStaffList(user);
          return sendJSON(res, { success: true, staff });
        } catch (err) {
          return sendJSON(res, { success: false, error: err.message }, 403);
        }
      }

      // Xodimlarni boshqarish: Yangi xodim qo'shish
      if (req.method === 'POST' && pathname === '/api/auth/staff/create') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = auth.verifySession(token);
        const body = await parseBody(req);
        try {
          const newStaff = auth.addStaff(user, body);
          logRequest(clientIp, 'POST', pathname, 200, startTime, `Yangi xodim qo'shildi: ${newStaff.login} (${newStaff.role})`);
          return sendJSON(res, { success: true, staff: newStaff, message: "Xodim muvaffaqiyatli ro'yxatga olindi" });
        } catch (err) {
          return sendJSON(res, { success: false, error: err.message }, 400);
        }
      }

      // Xodimlarni boshqarish: Xodim ma'lumotlari yoki rolini o'zgartirish
      if (req.method === 'POST' && pathname === '/api/auth/staff/update') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = auth.verifySession(token);
        const body = await parseBody(req);
        try {
          const updatedStaff = auth.updateStaff(user, body.login, body);
          logRequest(clientIp, 'POST', pathname, 200, startTime, `Xodim yangilandi: ${updatedStaff.login}`);
          return sendJSON(res, { success: true, staff: updatedStaff, message: "Xodim ma'lumotlari saqlandi" });
        } catch (err) {
          return sendJSON(res, { success: false, error: err.message }, 400);
        }
      }

      // Xodimlarni boshqarish: Parolni tiklash (Reset Password)
      if (req.method === 'POST' && pathname === '/api/auth/staff/reset-password') {
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = auth.verifySession(token);
        const body = await parseBody(req);
        try {
          const resetRes = auth.resetPassword(user, body.login, body.password);
          logRequest(clientIp, 'POST', pathname, 200, startTime, `Parol tiklandi: ${body.login}`);
          return sendJSON(res, { success: true, message: resetRes.message });
        } catch (err) {
          return sendJSON(res, { success: false, error: err.message }, 400);
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
        return sendJSON(res, { success: true, users: auth.users.map(u => auth.sanitizeUser(u)) });
      }

      // KLASTER YO'NALISHLARI (MULTI-SERVER CLUSTER)
      if (req.method === 'GET' && pathname === '/api/cluster/nodes') {
        const nodes = cluster.getAllClusterNodes();
        return sendJSON(res, {
          success: true,
          nodes: nodes,
          activeCount: nodes.length,
          maxNodes: 5
        });
      }

      if (req.method === 'GET' && pathname === '/api/cluster/sync-state') {
        return sendJSON(res, {
          success: true,
          queue: db.getAllQueue(),
          devices: db.getDevices(),
          settings: db.getSettings()
        });
      }

      if (req.method === 'POST' && pathname === '/api/cluster/replicate') {
        const body = await parseBody(req);
        const repRes = cluster.handleIncomingReplication(body.txId, body.action, body.payload);
        return sendJSON(res, { success: true, ...repRes });
      }

      // 0.1 KARMED URL VA FAILOVER TEKSHIRUVI
      if (req.method === 'GET' && pathname === '/api/karmed-url') {
        const forceCheck = parsedUrl.searchParams.get('force') === 'true';
        const karmedInfo = await checkKarmedActiveUrl(forceCheck);
        return sendJSON(res, { success: true, ...karmedInfo });
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

        // Tekshiruv faqat MRT yoki MSKT ekanligini tekshirish (UZI, Rentgen va h.k. navbat berilmaydi)
        if (body.services && !scheduler.isAllowedExam(body.services)) {
          return sendJSON(res, {
            success: false,
            error: "Ushbu tekshiruvga navbat berilmaydi! Elektron navbat faqat MRT va MSKT tekshiruvlari uchun mo'ljallangan."
          }, 400);
        }

        // 10 kundan oldingi tekshiruv bo'lsa - so'rovni yangilash kerak
        if (body.registrationDate) {
          const dateCheck = scheduler.checkRegistrationDate(body.registrationDate);
          if (dateCheck.isExpired) {
            return sendJSON(res, {
              success: false,
              isDateExpired: true,
              error: `Ushbu tekshiruv ro'yxatga olinganiga ${dateCheck.daysDiff} kun bo'lgan (10 kundan oshgan)! So'rovni yangilash kerak.`
            }, 400);
          }
        }

        // Aqlli rejalashtirish (Eng yaqin ish kuni, bo'sh soat, navbatchi laborantlar vaqti)
        const slotAllocation = scheduler.findNextAvailableSlot(body);
        const patientData = {
          ...body,
          ...slotAllocation,
          scheduledDate: slotAllocation.scheduledDate,
          scheduledTime: slotAllocation.startTime,
          finishTime: slotAllocation.finishTime,
          estimatedStartTime: slotAllocation.estimatedStartTime,
          estimatedFinishTime: slotAllocation.estimatedFinishTime,
          estimatedDurationMinutes: slotAllocation.durationMinutes,
          preparation: slotAllocation.preparation || body.preparation || '',
          contraindications: slotAllocation.contraindications || body.contraindications || ''
        };

        const addedPatient = db.addPatient(patientData);

        // Klasterdagi boshqa serverlarga yetkazish (P2P Replication)
        cluster.replicate('patient_added', { patient: addedPatient });

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

        // Klasterdagi boshqa serverlarga yetkazish
        cluster.replicate('status_updated', { id, status, extraData });

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

        // Klasterdagi boshqa serverlarga yetkazish
        cluster.replicate('patient_called', { id });

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

        // Klasterdagi boshqa serverlarga yetkazish
        cluster.replicate('patient_prep', { id });

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

      // 5.1 POST /api/queue/cancel - Laborant tomonidan bemorni sabab bilan bekor qilish
      if (req.method === 'POST' && pathname === '/api/queue/cancel') {
        const body = await parseBody(req);
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = auth.verifySession(token) || { login: 'laborant' };

        const { id, reason, notes } = body;
        if (!id) return sendJSON(res, { success: false, error: "Bemor ID talab qilinadi" }, 400);

        const updated = db.updatePatientStatus(id, 'cancelled', {
          cancelReason: reason || "Sabab ko'rsatilmadi",
          cancelNotes: notes || "",
          cancelledBy: user.login,
          cancelledAt: new Date().toISOString()
        });

        if (!updated) return sendJSON(res, { success: false, error: "Bemor topilmadi" }, 404);

        cluster.replicate('status_updated', { id, status: 'cancelled', extraData: { cancelReason: reason, cancelNotes: notes } });
        wsHub.broadcast('queue_updated', {
          action: 'patient_cancelled',
          patient: updated,
          queue: db.getQueue(),
          devices: db.getDevices()
        });

        sendJSON(res, { success: true, patient: updated, message: "Bemor tekshiruvi bekor qilindi" });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Bemor ${updated.ticketNumber} bekor qilindi: ${reason}`);
        return;
      }

      // 5.2 POST /api/queue/requeue - Laborant tomonidan bemorni qayta navbatga qo'yish
      if (req.method === 'POST' && pathname === '/api/queue/requeue') {
        const body = await parseBody(req);
        const authHeader = req.headers['authorization'] || '';
        const token = authHeader.replace(/^Bearer\s+/i, '');
        const user = auth.verifySession(token) || { login: 'laborant' };

        const { id, notes } = body;
        if (!id) return sendJSON(res, { success: false, error: "Bemor ID talab qilinadi" }, 400);

        const updated = db.updatePatientStatus(id, 'waiting', {
          requeueNotes: notes || "",
          requeuedBy: user.login,
          requeuedAt: new Date().toISOString()
        });

        if (!updated) return sendJSON(res, { success: false, error: "Bemor topilmadi" }, 404);

        cluster.replicate('status_updated', { id, status: 'waiting', extraData: { requeueNotes: notes } });
        wsHub.broadcast('queue_updated', {
          action: 'patient_requeued',
          patient: updated,
          queue: db.getQueue(),
          devices: db.getDevices()
        });

        sendJSON(res, { success: true, patient: updated, message: "Bemor qayta navbatga qo'yildi" });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Bemor ${updated.ticketNumber} qayta navbatga qo'yildi`);
        return;
      }

      // 5.3 POST /api/queue/delete - Admin va Server Nazoratchisi uchun bemorni navbatdan o'chirish
      if (req.method === 'POST' && pathname === '/api/queue/delete') {
        const currentUser = getAuthUser(req);
        if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'server_nazoratchisi' && currentUser.role !== 'admin')) {
          return sendJSON(res, { success: false, error: "Faqat Admin yoki Server Nazoratchisi navbatdagi bemorni o'chirishi mumkin" }, 403);
        }

        const body = await parseBody(req);
        const { id } = body;
        if (!id) return sendJSON(res, { success: false, error: "Bemor ID talab qilinadi" }, 400);

        const deleted = db.deletePatient(id);
        if (!deleted) return sendJSON(res, { success: false, error: "Bemor topilmadi" }, 404);

        cluster.replicate('patient_deleted', { id, deletedBy: currentUser.login || currentUser.name });
        wsHub.broadcast('queue_updated', {
          action: 'patient_deleted',
          patientId: id,
          deletedPatient: deleted,
          queue: db.getQueue(),
          devices: db.getDevices()
        });

        sendJSON(res, { success: true, patient: deleted, message: `Bemor (${deleted.patientName || deleted.ticketNumber}) navbatdan muvaffaqiyatli o'chirildi` });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Bemor navbatdan o'chirildi: ${deleted.ticketNumber} (${deleted.patientName})`);
        return;
      }

      // 6. GET /api/devices - Qurilmalar holati
      if (req.method === 'GET' && pathname === '/api/devices') {
        sendJSON(res, { success: true, devices: db.getDevices() });
        return;
      }

      // 6.1 POST /api/devices/save - Super Admin / Admin uchun qurilma qo'shish yoki nomini tahrirlash
      if (req.method === 'POST' && pathname === '/api/devices/save') {
        const currentUser = getAuthUser(req);
        if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'server_nazoratchisi' && currentUser.role !== 'admin')) {
          return sendJSON(res, { success: false, error: "Faqat Super Admin yoki Administrator qurilmalarni boshqarishi mumkin" }, 403);
        }

        const body = await parseBody(req);
        if (!body.name || !body.name.trim()) {
          return sendJSON(res, { success: false, error: "Qurilma nomi kiritilmadi" }, 400);
        }

        let device = null;
        if (body.id && db.getDeviceById(body.id)) {
          // Tahrirlash (Edit)
          device = db.updateDevice(body.id, {
            name: body.name,
            room: body.room,
            type: body.type,
            specialty: body.specialty,
            hasInjector: body.hasInjector,
            supportsContrast: body.supportsContrast,
            status: body.status
          });
        } else {
          // Yangi qo'shish (Add)
          device = db.addDevice({
            id: body.id,
            name: body.name,
            room: body.room,
            type: body.type,
            specialty: body.specialty,
            hasInjector: body.hasInjector,
            supportsContrast: body.supportsContrast,
            status: body.status || 'active'
          });
        }

        const allDevices = db.getDevices();
        // Barcha mijozlarga WebSocket va Klaster orqali xabar berish
        wsHub.broadcast('devices_updated', { devices: allDevices });
        wsHub.broadcast('devices_status', { devices: allDevices });
        cluster.replicate('devices_updated', { devices: allDevices });

        db.addLog({
          ip: clientIp,
          method: 'POST',
          path: '/api/devices/save',
          status: 200,
          action: 'DEVICE_SAVED',
          details: `Qurilma saqlandi: ${device.name} (${device.id}) [Foydalanuvchi: ${currentUser.name}]`
        });

        sendJSON(res, { success: true, message: "Qurilma muvaffaqiyatli saqlandi", device, devices: allDevices });
        return;
      }

      // 6.2 POST /api/devices/delete - Super Admin / Admin uchun qurilmani o'chirish
      if (req.method === 'POST' && pathname === '/api/devices/delete') {
        const currentUser = getAuthUser(req);
        if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'server_nazoratchisi' && currentUser.role !== 'admin')) {
          return sendJSON(res, { success: false, error: "Faqat Super Admin yoki Administrator qurilmalarni o'chirishi mumkin" }, 403);
        }

        const body = await parseBody(req);
        if (!body.id) {
          return sendJSON(res, { success: false, error: "Qurilma ID kiritilmadi" }, 400);
        }

        const removed = db.deleteDevice(body.id);
        if (!removed) {
          return sendJSON(res, { success: false, error: "Qurilma topilmadi" }, 404);
        }

        const allDevices = db.getDevices();
        wsHub.broadcast('devices_updated', { devices: allDevices });
        wsHub.broadcast('devices_status', { devices: allDevices });
        cluster.replicate('devices_updated', { devices: allDevices });

        db.addLog({
          ip: clientIp,
          method: 'POST',
          path: '/api/devices/delete',
          status: 200,
          action: 'DEVICE_DELETED',
          details: `Qurilma o'chirildi: ${removed.name} (${removed.id}) [Foydalanuvchi: ${currentUser.name}]`
        });

        sendJSON(res, { success: true, message: "Qurilma o'chirildi", devices: allDevices });
        return;
      }

      // 7. GET /api/services - Xizmatlar katalogi
      if (req.method === 'GET' && pathname === '/api/services') {
        sendJSON(res, { success: true, catalog: scheduler.getServicesCatalog() });
        return;
      }

      // 7.1 POST /api/services/save - Super Admin uchun tekshiruv qo'shish yoki tahrirlash
      if (req.method === 'POST' && pathname === '/api/services/save') {
        const currentUser = getAuthUser(req);
        if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'server_nazoratchisi')) {
          return sendJSON(res, { success: false, error: "Faqat Super Admin yoki Server Nazoratchisi tekshiruv vaqtlarini o'zgartirishi mumkin" }, 403);
        }

        const body = await parseBody(req);
        const savedItem = scheduler.upsertService(body, currentUser);
        cluster.replicate('services_updated', { services: scheduler.getServicesCatalog() });
        wsHub.broadcast('services_updated', { services: scheduler.getServicesCatalog() });

        sendJSON(res, { success: true, service: savedItem, message: "Tekshiruv ma'lumotlari muvaffaqiyatli saqlandi" });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Tekshiruv saqlandi: ${savedItem.code} (${savedItem.duration} daqiqa)`);
        return;
      }

      // 7.2 POST /api/services/delete - Super Admin uchun tekshiruvni o'chirish
      if (req.method === 'POST' && pathname === '/api/services/delete') {
        const currentUser = getAuthUser(req);
        if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'server_nazoratchisi')) {
          return sendJSON(res, { success: false, error: "Faqat Super Admin yoki Server Nazoratchisi tekshiruvni o'chirishi mumkin" }, 403);
        }

        const body = await parseBody(req);
        scheduler.deleteService(body.code, currentUser);
        cluster.replicate('services_updated', { services: scheduler.getServicesCatalog() });
        wsHub.broadcast('services_updated', { services: scheduler.getServicesCatalog() });

        sendJSON(res, { success: true, message: "Tekshiruv o'chirildi" });
        logRequest(clientIp, 'POST', pathname, 200, startTime, `Tekshiruv o'chirildi: ${body.code}`);
        return;
      }

      // 7.3 POST /api/queue/smart-slot - Eng yaqin ish kuni va bo'sh soatni oldindan hisoblash (Preview)
      if (req.method === 'POST' && pathname === '/api/queue/smart-slot') {
        const body = await parseBody(req);
        if (body.services && !scheduler.isAllowedExam(body.services)) {
          return sendJSON(res, {
            success: false,
            isAllowed: false,
            error: "Ushbu tekshiruvga navbat berilmaydi! Elektron navbat faqat MRT va MSKT tekshiruvlari uchun mo'ljallangan."
          }, 400);
        }

        if (body.registrationDate) {
          const dateCheck = scheduler.checkRegistrationDate(body.registrationDate);
          if (dateCheck.isExpired) {
            return sendJSON(res, {
              success: false,
              isDateExpired: true,
              error: `Ushbu tekshiruv ro'yxatga olinganiga ${dateCheck.daysDiff} kun bo'lgan (10 kundan oshgan)! So'rovni yangilash kerak.`
            }, 400);
          }
        }
        const slotAllocation = scheduler.findNextAvailableSlot(body);
        sendJSON(res, { success: true, slot: slotAllocation });
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
        cluster.replicate('queue_reset', {});
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

  // Karmedga tezkor yo'naltirish (Redirect)
  if (reqUrl === '/karmed' || reqUrl === '/open-karmed') {
    const karmedInfo = await checkKarmedActiveUrl();
    res.writeHead(302, { 'Location': karmedInfo.url });
    return res.end();
  }

  if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/karmed-workspace/index.html';
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

  // Multi-Server Klasterini ishga tushirish (UDP Discovery & 5-Node Cap)
  cluster.init(db, wsHub);

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
