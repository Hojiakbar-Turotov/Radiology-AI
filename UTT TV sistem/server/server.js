/**
 * UTT TV SISTEM — 100% LOKAL TARMOQ (LAN / OFFLINE) REALTIME SERVERI
 * Shifoxona ichki tarmog'ida (Ethernet kabel / Wi-Fi) internet talab qilmasdan ishlaydi.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
const TV_DIR = path.join(PUBLIC_DIR, "tv");
const ADMIN_DIR = path.join(PUBLIC_DIR, "admin");
const QUEUE_FILE = path.join(DATA_DIR, "queue.json");
const DOCTORS_FILE = path.join(DATA_DIR, "doctors.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const GUIDELINES_FILE = path.join(DATA_DIR, "guidelines.json");
const APPROVED_DEVICES_FILE = path.join(DATA_DIR, "approved_devices.json");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");

// 1. MA'LUMOTLARNI YUKLASH VA SAQLASH FUNKSIYALARI
function readJsonFile(filePath, defaultVal) {
  try {
    if (!fs.existsSync(filePath)) {
      writeJsonFile(filePath, defaultVal);
      return defaultVal;
    }
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Xatolik (${filePath}):`, err.message);
    return defaultVal;
  }
}

function writeJsonFile(filePath, data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error(`Saqlashda xatolik (${filePath}):`, err.message);
  }
}

let queueData = readJsonFile(QUEUE_FILE, { patients: [], current_announcement: null, history: [] });
let doctorsData = readJsonFile(DOCTORS_FILE, []);
let guidelinesData = readJsonFile(GUIDELINES_FILE, []);
let approvedDevices = readJsonFile(APPROVED_DEVICES_FILE, []);
let authData = readJsonFile(AUTH_FILE, {
  username: "R5",
  password: "16520",
  updatedAt: new Date().toISOString()
});
const activeSessions = new Set();
let settingsData = readJsonFile(SETTINGS_FILE, {
  activeLang: "uz",
  activeRoomId: "ALL",
  autoRotate: false,
  rotateIntervalSec: 25,
  tickerText: "Hurmatli bemorlar! Navbatingiz yetganda chaqirilgan xonaga kiring. • Elektron navbat tizimi asosida xizmat ko'rsatiladi. • Favqulodda holatlarda navbatsiz qabul qilinadi."
});

// 2. LOKAL IP MANZILLARNI ANIQLASH (LAN / Wi-Fi / Ethernet)
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === "IPv4" && !net.internal) {
        // Turi: Wi-Fi yoki Ethernet
        let typeName = "Ethernet";
        const lowName = name.toLowerCase();
        if (lowName.includes("wi-fi") || lowName.includes("wireless") || lowName.includes("беспроводная") || net.address.startsWith("192.168.137.")) {
          typeName = "Wi-Fi / Hotspot";
        } else if (lowName.includes("bluetooth")) {
          typeName = "Bluetooth";
        }
        addresses.push({ interface: name, type: typeName, ip: net.address });
      }
    }
  }
  return addresses;
}

// 3. ULANGAN QURILMALAR VA WEBSOCKET KLIENTLARI (ACTIVE DEVICES TRACKER)
const wsClientsMap = new Map(); // ws -> clientInfo

function getActiveClientsList() {
  const list = [];
  for (const [ws, info] of wsClientsMap.entries()) {
    if (ws.readyState === 1 && !info.isPreview && info.status === "approved") {
      list.push(info);
    }
  }
  return list;
}

function getPendingClientsList() {
  const list = [];
  for (const [ws, info] of wsClientsMap.entries()) {
    if (ws.readyState === 1 && !info.isPreview && info.status === "pending") {
      list.push(info);
    }
  }
  return list;
}

function broadcastMessage(payload) {
  const msgStr = JSON.stringify(payload);
  for (const [ws] of wsClientsMap.entries()) {
    try {
      if (ws.readyState === 1) { // OPEN
        ws.send(msgStr);
      }
    } catch (e) {
      wsClientsMap.delete(ws);
    }
  }
}

// 4. HTTP SERVERNI YARATISH
const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  function parseRequestBody(callback) {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const json = body ? JSON.parse(body) : {};
        callback(null, json);
      } catch (err) {
        callback(err, null);
      }
    });
  }

  // ==========================================
  // REST API ENDPOINTS
  // ==========================================

  // AUTH) Login, Parol va Sessiya Boshqaruvi
  if (pathname === "/api/auth/login" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.username || !body.password) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Login va parol kiritilishi shart" }));
      }

      if (body.username.trim() === authData.username && body.password.trim() === authData.password) {
        const token = `adm_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        activeSessions.add(token);
        console.log(`🔓 ADMIN TIZIMGA KINDI: ${authData.username}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          ok: true,
          token: token,
          username: authData.username,
          message: "Muvaffaqiyatli kirildi"
        }));
      } else {
        res.writeHead(401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Login yoki parol noto'g'ri!" }));
      }
    });
    return;
  }

  if (pathname === "/api/auth/check" && req.method === "GET") {
    const authHeader = req.headers["authorization"] || "";
    const token = authHeader.replace(/^Bearer\s+/i, "") || parsedUrl.searchParams.get("token") || "";
    const isValid = activeSessions.has(token);

    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      ok: true,
      authenticated: isValid,
      username: authData.username
    }));
  }

  if (pathname === "/api/auth/change" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.currentPassword) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Joriy parol talab etiladi" }));
      }

      if (body.currentPassword.trim() !== authData.password) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: false, error: "Joriy parol noto'g'ri kiritildi!" }));
      }

      if (body.newUsername && body.newUsername.trim()) {
        authData.username = body.newUsername.trim();
      }
      if (body.newPassword && body.newPassword.trim()) {
        authData.password = body.newPassword.trim();
      }
      authData.updatedAt = new Date().toISOString();
      writeJsonFile(AUTH_FILE, authData);

      console.log(`🔐 ADMIN LOGIN/PAROL O'ZGARTIRILDI: Yangi login=${authData.username}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({
        ok: true,
        username: authData.username,
        message: "Login va parol muvaffaqiyatli saqlandi!"
      }));
    });
    return;
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    parseRequestBody((err, body) => {
      const authHeader = req.headers["authorization"] || "";
      const token = (body && body.token) || authHeader.replace(/^Bearer\s+/i, "") || "";
      activeSessions.delete(token);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, message: "Tizimdan chiqildi" }));
    });
    return;
  }

  // A) Server Holati (GET /api/info)
  if (pathname === "/api/info" && req.method === "GET") {
    const ips = getLocalIpAddresses();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "online",
      port: PORT,
      hostIps: ips,
      primaryIp: ips.length > 0 ? ips[0].ip : "127.0.0.1",
      serverTime: new Date().toISOString(),
      activeClientsCount: getActiveClientsList().length,
      pendingClientsCount: getPendingClientsList().length,
      settings: settingsData
    }));
  }

  // B) Ulangan Qurilmalar Ro'yxati (GET /api/clients)
  if (pathname === "/api/clients" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      count: getActiveClientsList().length,
      clients: getActiveClientsList(),
      pendingCount: getPendingClientsList().length,
      pending: getPendingClientsList()
    }));
  }

  // B1.5) Kutilayotgan Qurilmalar Ro'yxati (GET /api/devices/pending)
  if (pathname === "/api/devices/pending" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      count: getPendingClientsList().length,
      pending: getPendingClientsList()
    }));
  }

  // B1.6) Qurilmaga / Vrachga Ruxsat Berish (POST /api/devices/approve)
  if (pathname === "/api/devices/approve" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.clientId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "clientId talab etiladi" }));
      }

      // Agar vrach nomi bo'lsa
      if (body.doctorName) {
        const targetRoomId = body.roomId || (doctorsData[0] ? doctorsData[0].id : "vrach_utt_1");
        const roomDoc = doctorsData.find(d => d.id === targetRoomId) || { room: targetRoomId, roomNum: targetRoomId.replace(/\D/g, '') };
        const cleanName = body.doctorName.toLowerCase().replace(/[^a-zа-яё]/gi, '');
        
        let existingDoc = doctorsData.find(d => {
          const dClean = d.name.toLowerCase().replace(/[^a-zа-яё]/gi, '');
          return dClean.includes(cleanName) || cleanName.includes(dClean);
        });

        if (existingDoc) {
          existingDoc.room = roomDoc.room;
          existingDoc.roomNum = roomDoc.roomNum;
        } else {
          doctorsData.push({
            id: `vrach_utt_${Date.now()}`,
            name: body.doctorName.trim(),
            specialty: `ULTRATOVUSH`,
            room: roomDoc.room,
            roomNum: roomDoc.roomNum,
            color: "#0284c7"
          });
        }
        writeJsonFile(DOCTORS_FILE, doctorsData);
        broadcastMessage({ type: "DOCTORS_UPDATED", data: doctorsData });
        console.log(`👨‍⚕️ VRACH ADMIN TOMONIDAN TASDIQLANDI: ${body.doctorName} -> ${roomDoc.room}`);
      }

      for (const [ws, info] of wsClientsMap.entries()) {
        if (info.id === body.clientId || info.deviceId === body.clientId || (body.doctorName && info.doctorName === body.doctorName)) {
          info.status = "approved";
          info.isApproved = true;
          if (body.doctorName) info.doctorName = body.doctorName;
          if (body.roomId) info.roomId = body.roomId;
          if (info.deviceId && !approvedDevices.includes(info.deviceId)) {
            approvedDevices.push(info.deviceId);
            writeJsonFile(APPROVED_DEVICES_FILE, approvedDevices);
          }
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: "DEVICE_APPROVED",
              data: { isApproved: true, doctorName: body.doctorName, roomId: body.roomId }
            }));
          }
          console.log(`✅ QURILMAGA/VRACHGA RUXSAT BERILDI: ${info.name} (${info.ip})`);
        }
      }

      broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
      broadcastMessage({ type: "PENDING_DEVICES_UPDATED", data: getPendingClientsList() });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, clients: getActiveClientsList(), pending: getPendingClientsList(), doctors: doctorsData }));
    });
    return;
  }

  // B1.65) Vrach Kengaytmasidan Ruxsat So'rovi (POST /api/doctors/request-access)
  if (pathname === "/api/doctors/request-access" && req.method === "POST") {
    parseRequestBody((err, body) => {
      const clientIp = req.socket.remoteAddress ? req.socket.remoteAddress.replace(/^.*:/, '') : "Local";
      const docName = (body.doctorName || "Shifokor").trim();
      const devId = body.deviceId || `ext_${Date.now()}`;

      // wsClientsMap da ushbu kengaytma bormi?
      let found = false;
      for (const [ws, info] of wsClientsMap.entries()) {
        if (info.deviceId === devId || info.id === body.clientId) {
          info.type = "extension";
          info.name = `💻 Vrach: ${docName}`;
          info.doctorName = docName;
          info.status = "pending";
          info.isApproved = false;
          found = true;
          break;
        }
      }

      if (!found) {
        const dummyId = `ext_${Date.now()}`;
        wsClientsMap.set({ readyState: 1, send: () => {} }, {
          id: dummyId,
          deviceId: devId,
          ip: clientIp,
          type: "extension",
          name: `💻 Vrach: ${docName}`,
          doctorName: docName,
          status: "pending",
          isApproved: false,
          connectedAt: Date.now(),
          connectedAtStr: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
          lastSeen: Date.now()
        });
      }

      broadcastMessage({ type: "PENDING_DEVICES_UPDATED", data: getPendingClientsList() });
      console.log(`🔔 VRACH RUXSAT SO'RADI: ${docName} (${clientIp})`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, message: "Ruxsat so'rovi adminga yuborildi" }));
    });
    return;
  }

  // B1.7) Qurilmani Rad Etish (POST /api/devices/reject)
  if (pathname === "/api/devices/reject" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.clientId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "clientId talab etiladi" }));
      }

      for (const [ws, info] of wsClientsMap.entries()) {
        if (info.id === body.clientId) {
          try {
            ws.send(JSON.stringify({
              type: "DEVICE_REJECTED",
              message: "Administrator ulanish so'rovini rad etdi."
            }));
            ws.close(1000, "Device rejected");
          } catch (e) {}
          wsClientsMap.delete(ws);
          console.log(`🚫 QURILMA RAD ETILDI: ${info.name} (${info.ip})`);
          break;
        }
      }

      broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
      broadcastMessage({ type: "PENDING_DEVICES_UPDATED", data: getPendingClientsList() });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, clients: getActiveClientsList(), pending: getPendingClientsList() }));
    });
    return;
  }

  // B2) Har bir TV Monitorini Alohida Sozlash (POST /api/devices/config)
  if (pathname === "/api/devices/config" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.clientId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "clientId talab etiladi" }));
      }

      for (const [ws, info] of wsClientsMap.entries()) {
        if (info.id === body.clientId || body.clientId === "ALL") {
          if (body.lang) info.lang = body.lang;
          if (body.roomId !== undefined) info.roomId = body.roomId;
          if (body.roomName !== undefined) info.roomName = body.roomName;
          if (body.doctorName !== undefined) info.doctorName = body.doctorName;
          if (body.name !== undefined) info.name = body.name;

          // Shu TV ga yangi konfiguratsiyani yuborish
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              type: "TV_CONFIG_CHANGED",
              data: {
                activeLang: info.lang,
                activeRoomId: info.roomId,
                customRoom: info.roomName,
                customDoctor: info.doctorName
              }
            }));
          }
        }
      }

      broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, clients: getActiveClientsList() }));
    });
    return;
  }

  // B3) Ortiqcha yoki Ruxsatsiz TV Oynasini Masofadan Yopish (POST /api/devices/disconnect)
  if (pathname === "/api/devices/disconnect" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.clientId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "clientId talab etiladi" }));
      }

      let disconnected = false;
      for (const [ws, info] of wsClientsMap.entries()) {
        if (info.id === body.clientId) {
          try {
            ws.send(JSON.stringify({
              type: "FORCE_CLOSE_WINDOW",
              message: "Ushbu TV monitori yoki oyna Admin tomonidan masofadan yopildi."
            }));
            ws.close(1000, "Admin force closed");
          } catch (e) {}
          wsClientsMap.delete(ws);
          disconnected = true;
          console.log(`🚫 ADMIN TOMONIDAN OYNA YOPILDI: ${info.name} (${info.ip})`);
          break;
        }
      }

      broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, disconnected, clients: getActiveClientsList() }));
    });
    return;
  }

  // C) Admin Sozlamalari (GET & POST /api/settings)
  if (pathname === "/api/settings" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(settingsData));
  }

  if (pathname === "/api/settings" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Noto'g'ri ma'lumot" }));
      }
      settingsData = { ...settingsData, ...body };
      writeJsonFile(SETTINGS_FILE, settingsData);

      // Barcha TV monitorlariga sozlamalarni real-time yuborish
      broadcastMessage({ type: "TV_CONFIG_CHANGED", data: settingsData });
      console.log(`⚙️ ADMIN SOZLAMALAR O'ZGARTIRILDI: Til=${settingsData.activeLang}, Xona=${settingsData.activeRoomId}`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, settings: settingsData }));
    });
    return;
  }

  // D) Vrachlar Ro'yxati (GET /api/doctors)
  if (pathname === "/api/doctors" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(doctorsData));
  }

  // E) Vrach Qo'shish / Yangilash (POST /api/doctors)
  if (pathname === "/api/doctors" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.name) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Vrach ma'lumotlari to'liq emas" }));
      }
      const existingIdx = doctorsData.findIndex(d => d.id === body.id);
      if (existingIdx >= 0) {
        doctorsData[existingIdx] = { ...doctorsData[existingIdx], ...body };
      } else {
        const newDoctor = {
          id: body.id || `vrach_${Date.now()}`,
          name: body.name,
          specialty: body.specialty || "Mutaxassis",
          room: body.room || "Qabul xonasi",
          color: body.color || "#0284c7",
          icon: body.icon || "fa-user-doctor"
        };
        doctorsData.push(newDoctor);
      }
      writeJsonFile(DOCTORS_FILE, doctorsData);
      broadcastMessage({ type: "DOCTORS_UPDATED", data: doctorsData });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, doctors: doctorsData }));
    });
    return;
  }

  // E2) TEKSHIRUV TAYYORGARLIKLARI VA MEDIA (GET /api/guidelines)
  if (pathname === "/api/guidelines" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(guidelinesData));
  }

  // E3) TEKSHIRUV TAYYORGARLIGINI QO'SHISH / TAHRIRLASH (POST /api/guidelines)
  if (pathname === "/api/guidelines" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.title) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Tekshiruv sarlavhasi talab etiladi" }));
      }
      const existingIdx = guidelinesData.findIndex(g => g.id === body.id);
      if (existingIdx >= 0) {
        guidelinesData[existingIdx] = { ...guidelinesData[existingIdx], ...body };
      } else {
        const newGuideline = {
          id: body.id || `g_${Date.now()}`,
          code: body.code || "",
          icon: body.icon || "ℹ️",
          image: body.image || "/tv/assets/ultrasound_abdomen.jpg",
          video: body.video || "",
          title: body.title,
          title_ru: body.title_ru || body.title,
          title_en: body.title_en || body.title,
          points: Array.isArray(body.points) ? body.points : (body.points ? body.points.split("\n").filter(Boolean) : []),
          points_ru: Array.isArray(body.points_ru) ? body.points_ru : [],
          points_en: Array.isArray(body.points_en) ? body.points_en : [],
          isActive: body.isActive !== undefined ? body.isActive : true
        };
        guidelinesData.push(newGuideline);
      }
      writeJsonFile(GUIDELINES_FILE, guidelinesData);
      broadcastMessage({ type: "GUIDELINES_UPDATED", data: guidelinesData });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, guidelines: guidelinesData }));
    });
    return;
  }

  // E4) TEKSHIRUV TAYYORGARLIGINI O'CHIRISH (POST /api/guidelines/delete)
  if (pathname === "/api/guidelines/delete" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.id) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "O'chirish uchun ID talab etiladi" }));
      }
      guidelinesData = guidelinesData.filter(g => g.id !== body.id);
      writeJsonFile(GUIDELINES_FILE, guidelinesData);
      broadcastMessage({ type: "GUIDELINES_UPDATED", data: guidelinesData });
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, guidelines: guidelinesData }));
    });
    return;
  }

  // F) Navbat Holati (GET /api/queue)
  if (pathname === "/api/queue" && req.method === "GET") {
    const doctorFilter = parsedUrl.searchParams.get("doctorId");
    let resultPatients = queueData.patients || [];
    if (doctorFilter && doctorFilter !== "ALL") {
      resultPatients = resultPatients.filter(p => p.doctorId === doctorFilter);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      patients: resultPatients,
      current_announcement: queueData.current_announcement,
      totalCount: queueData.patients.length
    }));
  }

  // G) Bemor Qo'shish (POST /api/queue/add)
  if (pathname === "/api/queue/add" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.patientName) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bemor F.I.Sh kiritilishi shart" }));
      }

      const doctor = doctorsData.find(d => d.id === body.doctorId) || {
        id: body.doctorId || "vrach_general",
        name: body.doctorName || "Shifokor",
        room: body.room || "Qabul xonasi"
      };

      const newPatient = {
        id: body.id || `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patientId: body.patientId || "",
        patientName: body.patientName.trim(),
        pinfl: body.pinfl || "",
        birthDate: body.birthDate || "",
        department: body.department || "",
        service: body.service || "Ko'rik / Tekshiruv",
        registeredAtStr: body.registeredAtStr || "",
        registeredAtTimestamp: body.registeredAtTimestamp || Date.now(),
        doctorId: doctor.id,
        doctorName: doctor.name,
        room: doctor.room,
        isContrast: !!body.isContrast,
        status: body.status || "waiting",
        createdAt: Date.now(),
        createdAtStr: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
      };

      queueData.patients.push(newPatient);

      // Ro'yxatga olingan vaqti bo'yicha tartiblash
      queueData.patients.sort((a, b) => (a.registeredAtTimestamp || a.createdAt || 0) - (b.registeredAtTimestamp || b.createdAt || 0));
      queueData.patients.forEach((p, idx) => { p.orderNumber = idx + 1; });

      writeJsonFile(QUEUE_FILE, queueData);

      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });
      broadcastMessage({ type: "PATIENT_ADDED", data: newPatient });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, patient: newPatient, total: queueData.patients.length }));
    });
    return;
  }

  // G2) BEMORLARNI RO'YXATGA OLINGAN VAQTI BO'YICHA TO'G'RIDAN-TO'G'RI SINXRONIZATSIYA (POST /api/queue/sync)
  if (pathname === "/api/queue/sync" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !Array.isArray(body.patients)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bemorlar ro'yxati (array) talab etiladi" }));
      }

      const scannedPatients = body.patients;
      const targetDoctorId = body.doctorId;

      // XOTIRADA ESKI BEMORLAR SAQLANMAYDI: TO'G'RIDAN-TO'G'RI FAQAT EKSTENSHNDAGI BEMORLAR TV GA CHIQAREDILADI
      queueData.patients = scannedPatients.map((sp, idx) => {
        const doc = doctorsData.find(d => d.id === sp.doctorId) || (targetDoctorId ? doctorsData.find(d => d.id === targetDoctorId) : null) || {
          id: sp.doctorId || "vrach_utt_1",
          name: sp.doctorName || "Juravlev Igor Ivanovich",
          room: sp.room || "UTT 1 - 53 XONA"
        };

        return {
          id: sp.id || `pat_${idx}_${Date.now()}`,
          patientId: sp.patientId || "",
          patientName: (sp.patientName || "").trim(),
          pinfl: sp.pinfl || "",
          birthDate: sp.birthDate || "",
          department: sp.department || "",
          service: sp.service || "Ultratovush (UTT)",
          registeredAtStr: sp.registeredAtStr || "",
          registeredAtTimestamp: sp.registeredAtTimestamp || Date.now(),
          doctorId: doc.id,
          doctorName: doc.name,
          room: doc.room,
          isContrast: !!sp.isContrast,
          status: (queueData.current_announcement && queueData.current_announcement.patientName && queueData.current_announcement.patientName.toLowerCase() === (sp.patientName || '').toLowerCase()) ? "calling" : (sp.status || "waiting"),
          orderNumber: idx + 1,
          createdAt: Date.now(),
          createdAtStr: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
        };
      });

      // RO'YXATGA OLINGAN VAQTI (REGISTRATION TIME) BO'YICHA TARTIBLASH
      queueData.patients.sort((a, b) => (a.registeredAtTimestamp || a.createdAt || 0) - (b.registeredAtTimestamp || b.createdAt || 0));
      queueData.patients.forEach((p, idx) => { p.orderNumber = idx + 1; });

      writeJsonFile(QUEUE_FILE, queueData);
      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, total: queueData.patients.length, patients: queueData.patients }));
    });
    return;
  }

  // H) Bemorni Chaqirish (POST /api/queue/call)
  if (pathname === "/api/queue/call" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || (!body.patientId && !body.id && !body.patientName)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bemor ID yoki F.I.Sh ko'rsatilmagan" }));
      }

      const targetId = body.id || body.patientId;
      let patient = queueData.patients.find(p => (targetId && (p.id === targetId || p.patientId === targetId)) || (body.patientName && p.patientName.toLowerCase() === body.patientName.toLowerCase()));

      if (!patient) {
        patient = {
          id: `pat_${Date.now()}`,
          patientId: body.patientId || "",
          patientName: (body.patientName || "Bemor").trim(),
          service: body.service || "Ko'rik",
          doctorId: body.doctorId || (doctorsData[0] ? doctorsData[0].id : "vrach_utt_1"),
          doctorName: body.doctorName || (doctorsData[0] ? doctorsData[0].name : "Shifokor"),
          room: body.room || (doctorsData[0] ? doctorsData[0].room : "101-xona"),
          status: "waiting",
          orderNumber: queueData.patients.length + 1,
          createdAt: Date.now(),
          createdAtStr: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
        };
        queueData.patients.push(patient);
      }

      queueData.patients.forEach(p => {
        if (p.doctorId === patient.doctorId && p.id !== patient.id && p.status === "calling") {
          p.status = "in_progress";
        }
      });

      patient.status = "calling";
      patient.calledAt = Date.now();
      patient.calledAtStr = new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
      patient.callCount = (patient.callCount || 0) + 1;

      const announcement = {
        patientId: patient.id,
        patientName: patient.patientName,
        doctorId: patient.doctorId,
        doctorName: patient.doctorName,
        room: patient.room,
        service: patient.service,
        isContrast: patient.isContrast,
        callCount: patient.callCount,
        timestamp: Date.now()
      };

      queueData.current_announcement = announcement;
      writeJsonFile(QUEUE_FILE, queueData);

      broadcastMessage({ type: "CALL_ANNOUNCEMENT", data: announcement });
      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });

      console.log(`📢 CHAQIRUV: ${patient.patientName} -> ${patient.room} (${patient.doctorName})`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, announcement, patient }));
    });
    return;
  }

  // I) Bemor Holatini O'zgartirish (POST /api/queue/status)
  if (pathname === "/api/queue/status" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || (!body.id && !body.patientId) || !body.status) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "ID va status talab qilinadi" }));
      }

      const targetId = body.id || body.patientId;
      const patient = queueData.patients.find(p => p.id === targetId || p.patientId === targetId);

      if (!patient) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bemor topilmadi" }));
      }

      patient.status = body.status;
      if (body.status === "completed" || body.status === "cancelled" || body.status === "missed") {
        patient.completedAt = Date.now();
        if (queueData.current_announcement && queueData.current_announcement.patientId === patient.id) {
          queueData.current_announcement = null;
        }
      }

      writeJsonFile(QUEUE_FILE, queueData);
      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, patient }));
    });
    return;
  }

  // I2) Bemor Kelmadi Xabari (POST /api/queue/missed)
  if (pathname === "/api/queue/missed" && req.method === "POST") {
    parseRequestBody((err, body) => {
      const targetId = body.id || body.patientId;
      let patient = queueData.patients.find(p => (targetId && (p.id === targetId || p.patientId === targetId)) || (body.patientName && p.patientName.toLowerCase() === body.patientName.toLowerCase()));

      if (patient) {
        patient.status = "missed";
        patient.missedAt = Date.now();
        patient.missedAtStr = new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
      }

      if (queueData.current_announcement && patient && queueData.current_announcement.patientId === patient.id) {
        queueData.current_announcement = null;
      }

      writeJsonFile(QUEUE_FILE, queueData);
      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });
      broadcastMessage({
        type: "PATIENT_MISSED",
        data: {
          patientName: body.patientName || (patient ? patient.patientName : "Bemor"),
          room: body.room || (patient ? patient.room : "Xona"),
          doctorName: body.doctorName || (patient ? patient.doctorName : "")
        }
      });

      console.log(`⚠️ BEMOR KELMADI: ${body.patientName || (patient ? patient.patientName : '')} (1 daqiqa vaqt o'tdi)`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, message: "Bemor kelmadi deb belgilandi", patient }));
    });
    return;
  }

  // J) 2-KENGAYTMA: Bemor Vrachini O'zgartirish (POST /api/queue/reassign)
  if (pathname === "/api/queue/reassign" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || (!body.id && !body.patientId && !body.patientName) || !body.targetDoctorId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bemor va yangi vrach ID ko'rsatilishi shart" }));
      }

      const targetDoctor = doctorsData.find(d => d.id === body.targetDoctorId);
      if (!targetDoctor) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Tanlangan yangi vrach topilmadi" }));
      }

      let patient = queueData.patients.find(p => (body.id && p.id === body.id) || (body.patientId && p.patientId === body.patientId) || (body.patientName && p.patientName.toLowerCase() === body.patientName.toLowerCase()));

      if (patient) {
        const oldDoctorName = patient.doctorName;
        patient.doctorId = targetDoctor.id;
        patient.doctorName = targetDoctor.name;
        patient.room = targetDoctor.room;
        patient.status = "waiting";
        patient.reassignedAt = Date.now();
        console.log(`🔄 VRACH O'ZGARTIRILDI: ${patient.patientName} (${oldDoctorName} -> ${targetDoctor.name})`);
      } else {
        patient = {
          id: body.id || `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          patientId: body.patientId || "",
          patientName: body.patientName.trim(),
          pinfl: body.pinfl || "",
          birthDate: body.birthDate || "",
          service: body.service || targetDoctor.specialty || "Qabul",
          doctorId: targetDoctor.id,
          doctorName: targetDoctor.name,
          room: targetDoctor.room,
          isContrast: !!body.isContrast,
          status: "waiting",
          orderNumber: queueData.patients.length + 1,
          createdAt: Date.now(),
          createdAtStr: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
        };
        queueData.patients.push(patient);
        console.log(`➕ YANGI BEMOR YO'NALTIRILDI: ${patient.patientName} -> ${targetDoctor.name}`);
      }

      writeJsonFile(QUEUE_FILE, queueData);
      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });
      broadcastMessage({ type: "PATIENT_REASSIGNED", data: { patient, targetDoctor } });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, patient, targetDoctor }));
    });
    return;
  }

  // K) Navbatni Tozalash (POST /api/queue/clear)
  if (pathname === "/api/queue/clear" && req.method === "POST") {
    if (queueData.patients.length > 0) {
      queueData.history.push({
        date: new Date().toISOString(),
        patients: [...queueData.patients]
      });
    }
    queueData.patients = [];
    queueData.current_announcement = null;
    writeJsonFile(QUEUE_FILE, queueData);

    broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, message: "Navbat tozalandi" }));
  }

  // ==========================================
  // STATIK FAYLLARNI SERVE QILISH (TV, ADMIN & ASSETS)
  // ==========================================

  let resolvedFile = null;

  if (pathname === "/" || pathname === "/tv" || pathname === "/tv/") {
    resolvedFile = path.join(TV_DIR, "index.html");
  } else if (pathname === "/admin" || pathname === "/admin/") {
    resolvedFile = path.join(ADMIN_DIR, "index.html");
  } else if (pathname.startsWith("/admin/")) {
    const p = path.join(ADMIN_DIR, pathname.replace(/^\/admin\//, ""));
    if (fs.existsSync(p) && fs.statSync(p).isFile()) resolvedFile = p;
  } else {
    const checkTvPath = path.join(TV_DIR, pathname.replace(/^\/tv\//, "").replace(/^\//, ""));
    if (fs.existsSync(checkTvPath) && fs.statSync(checkTvPath).isFile()) {
      resolvedFile = checkTvPath;
    } else {
      const checkPublicPath = path.join(PUBLIC_DIR, pathname.replace(/^\//, ""));
      if (fs.existsSync(checkPublicPath) && fs.statSync(checkPublicPath).isFile()) {
        resolvedFile = checkPublicPath;
      }
    }
  }

  if (resolvedFile && fs.existsSync(resolvedFile) && fs.statSync(resolvedFile).isFile()) {
    const ext = path.extname(resolvedFile).toLowerCase();
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav"
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    return fs.createReadStream(resolvedFile).pipe(res);
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Sahifa topilmadi", path: pathname }));
});

// ==========================================
// 5. WEBSOCKET SERVER (Built-in Native WS + Tracker)
// ==========================================
let WebSocketServer = null;
try {
  const wsPkg = require("ws");
  WebSocketServer = wsPkg.Server;
} catch (e) {
  console.log("ℹ️ 'ws' paketi yuklanmadi, HTTP rejimda ishlaydi.");
}

if (WebSocketServer) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const clientIp = req.socket.remoteAddress ? req.socket.remoteAddress.replace(/^.*:/, '') : "Local";
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const isPreviewReq = req.url && req.url.includes("preview=1");

    const clientInfo = {
      id: clientId,
      deviceId: "",
      ip: clientIp,
      type: "tv", // default 'tv', 'admin', 'extension'
      name: `Qurilma (${clientIp})`,
      status: isPreviewReq ? "approved" : "pending",
      isApproved: isPreviewReq ? true : false,
      isPreview: isPreviewReq,
      connectedAt: Date.now(),
      connectedAtStr: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
      lastSeen: Date.now()
    };

    wsClientsMap.set(ws, clientInfo);

    // Initial state yuborish
    ws.send(JSON.stringify({
      type: "INITIAL_STATE",
      data: {
        queue: queueData,
        doctors: doctorsData,
        guidelines: guidelinesData,
        settings: settingsData,
        clientId: clientId,
        isApproved: clientInfo.isApproved,
        status: clientInfo.status
      }
    }));

    if (!clientInfo.isPreview) {
      broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
      broadcastMessage({ type: "PENDING_DEVICES_UPDATED", data: getPendingClientsList() });
    }

    ws.on("message", (rawMsg) => {
      try {
        const msg = JSON.parse(rawMsg);
        if (msg.type === "CLIENT_IDENTIFY") {
          clientInfo.type = msg.data.clientType || clientInfo.type;
          clientInfo.name = msg.data.name || clientInfo.name;
          clientInfo.deviceId = msg.data.deviceId || clientInfo.deviceId || clientId;
          if (msg.data.isPreview) clientInfo.isPreview = true;

          // Admin panel yoki preview avtomatik tasdiqlangan
          if (clientInfo.type === "admin" || clientInfo.isPreview) {
            clientInfo.status = "approved";
            clientInfo.isApproved = true;
            ws.send(JSON.stringify({
              type: "DEVICE_APPROVED",
              data: { isApproved: true }
            }));
          } else {
            // Tasdiqlangan qurilmalar ro'yxatida bormi?
            if (approvedDevices.includes(clientInfo.deviceId)) {
              clientInfo.status = "approved";
              clientInfo.isApproved = true;
              ws.send(JSON.stringify({
                type: "DEVICE_APPROVED",
                data: { isApproved: true }
              }));
            } else {
              clientInfo.status = "pending";
              clientInfo.isApproved = false;
              ws.send(JSON.stringify({
                type: "DEVICE_PENDING_APPROVAL",
                data: { isApproved: false, deviceId: clientInfo.deviceId }
              }));
            }
          }

          broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
          broadcastMessage({ type: "PENDING_DEVICES_UPDATED", data: getPendingClientsList() });
        } else if (msg.type === "SET_TV_CONFIG") {
          settingsData = { ...settingsData, ...msg.data };
          writeJsonFile(SETTINGS_FILE, settingsData);
          broadcastMessage({ type: "TV_CONFIG_CHANGED", data: settingsData });
        }
      } catch (e) {}
    });

    ws.on("close", () => {
      wsClientsMap.delete(ws);
      broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
      broadcastMessage({ type: "PENDING_DEVICES_UPDATED", data: getPendingClientsList() });
    });

    ws.on("error", () => {
      wsClientsMap.delete(ws);
      broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
      broadcastMessage({ type: "PENDING_DEVICES_UPDATED", data: getPendingClientsList() });
    });
  });
}

// 6. SERVERNI ISHGA TUSHIRISH
server.listen(PORT, "0.0.0.0", () => {
  const ipList = getLocalIpAddresses();
  const primaryIp = ipList.length > 0 ? ipList[0].ip : "127.0.0.1";

  console.log("\n==================================================================");
  console.log("  🏥 UTT TV SISTEM — 100% LOKAL TARMOQ (LAN / WI-FI) SERVERI");
  console.log("==================================================================");
  console.log(`  🚀 Server holati: ISHLAMOQDA (Port: ${PORT})`);
  console.log(`  ⚙️ ADMIN BOSHQARUV PANELI:  http://localhost:${PORT}/admin`);
  console.log(`  📺 TV MONITOR EKRANI:       http://localhost:${PORT}/tv`);
  console.log("------------------------------------------------------------------");
  console.log("  📡 SHIFOXONA ICHKI TARMOG'IDAGI ULANISH MANZILLARI:");
  ipList.forEach(item => {
    console.log(`  📺 [${item.type}] Android TV:  http://${item.ip}:${PORT}/tv`);
    console.log(`  ⚙️ [${item.type}] Admin Panel: http://${item.ip}:${PORT}/admin`);
    console.log(`  🔌 [${item.type}] Kengaytma API: http://${item.ip}:${PORT}/api`);
  });
  console.log("------------------------------------------------------------------");
  console.log(`  💡 ASOSIY HOST MANZILI: http://${primaryIp}:${PORT}`);
  console.log("==================================================================\n");
});
