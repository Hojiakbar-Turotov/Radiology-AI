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

// 1. MA'LUMOTLARNI YUKLASH VA SAQLASH FUNKSIYALARI
function readJsonFile(filePath, defaultVal) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultVal, null, 2), "utf8");
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
    if (ws.readyState === 1) {
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

  // A) Server Info, Host IPs & Active Clients
  if (pathname === "/api/info" && req.method === "GET") {
    const ips = getLocalIpAddresses();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "online",
      port: PORT,
      hostIps: ips,
      primaryIp: ips.length > 0 ? ips[0].ip : "127.0.0.1",
      serverTime: new Date().toISOString(),
      activeClientsCount: wsClientsMap.size,
      settings: settingsData
    }));
  }

  // B) Ulangan Qurilmalar Ro'yxati (GET /api/clients)
  if (pathname === "/api/clients" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      count: wsClientsMap.size,
      clients: getActiveClientsList()
    }));
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

  // G2) BEMORLARNI RO'YXATGA OLINGAN VAQTI BO'YICHA AVTOMATIK SINXRONIZATSIYA (POST /api/queue/sync)
  if (pathname === "/api/queue/sync" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !Array.isArray(body.patients)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bemorlar ro'yxati (array) talab etiladi" }));
      }

      const scannedPatients = body.patients;
      const targetDoctorId = body.doctorId;

      scannedPatients.forEach(sp => {
        let existing = queueData.patients.find(p => (sp.patientId && p.patientId === sp.patientId) || (sp.patientName && p.patientName.toLowerCase() === sp.patientName.toLowerCase()));

        if (existing) {
          existing.patientName = sp.patientName || existing.patientName;
          existing.registeredAtStr = sp.registeredAtStr || existing.registeredAtStr;
          if (sp.registeredAtTimestamp) existing.registeredAtTimestamp = sp.registeredAtTimestamp;
          if (sp.service) existing.service = sp.service;
          if (sp.pinfl) existing.pinfl = sp.pinfl;
          if (sp.birthDate) existing.birthDate = sp.birthDate;
          if (sp.department) existing.department = sp.department;
          if (sp.doctorId) existing.doctorId = sp.doctorId;
          if (sp.doctorName) existing.doctorName = sp.doctorName;
          if (sp.room) existing.room = sp.room;
        } else {
          const doc = doctorsData.find(d => d.id === sp.doctorId) || (targetDoctorId ? doctorsData.find(d => d.id === targetDoctorId) : null) || {
            id: sp.doctorId || "vrach_utt_1",
            name: sp.doctorName || "Juravlev Igor Ivanovich",
            room: sp.room || "UTT 1 - 53 XONA"
          };

          const newPatient = {
            id: sp.id || `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
            status: sp.status || "waiting",
            createdAt: Date.now(),
            createdAtStr: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
          };
          queueData.patients.push(newPatient);
        }
      });

      // RO'YXATGA OLINGAN VAQTI (REGISTRATION TIME) BO'YICHA XRONOLOGIK TARTIBLASH
      queueData.patients.sort((a, b) => (a.registeredAtTimestamp || a.createdAt || 0) - (b.registeredAtTimestamp || b.createdAt || 0));
      queueData.patients.forEach((p, idx) => { p.orderNumber = idx + 1; });

      writeJsonFile(QUEUE_FILE, queueData);
      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });

      console.log(`🔄 Karmed'dan ${scannedPatients.length} ta bemor vaqti bo'yicha navbatga sinxronlandi`);

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
      if (body.status === "completed" || body.status === "cancelled") {
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

    const clientInfo = {
      id: clientId,
      ip: clientIp,
      type: "tv", // default 'tv', 'admin', 'extension'
      name: `Qurilma (${clientIp})`,
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
        clientId: clientId
      }
    }));

    // Barcha adminlarga ulangan qurilmalar sonini yangilab yuborish
    broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });

    ws.on("message", (rawMsg) => {
      try {
        const msg = JSON.parse(rawMsg);
        if (msg.type === "CLIENT_IDENTIFY") {
          clientInfo.type = msg.data.clientType || clientInfo.type;
          clientInfo.name = msg.data.name || clientInfo.name;
          broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
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
    });

    ws.on("error", () => {
      wsClientsMap.delete(ws);
      broadcastMessage({ type: "CLIENTS_UPDATED", data: getActiveClientsList() });
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
