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
const QUEUE_FILE = path.join(DATA_DIR, "queue.json");
const DOCTORS_FILE = path.join(DATA_DIR, "doctors.json");

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

// 2. LOKAL IP MANZILLARNI ANIQLASH (LAN IPv4)
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // IPv4 va ichki bo'lmagan (127.0.0.1 emas) manzillar
      if (net.family === "IPv4" && !net.internal) {
        addresses.push({ interface: name, ip: net.address });
      }
    }
  }
  return addresses;
}

// 3. WEBSOCKET KLIENTLARI RO'YXATI (REALTIME SYNC)
const wsClients = new Set();

function broadcastMessage(payload) {
  const msgStr = JSON.stringify(payload);
  for (const client of wsClients) {
    try {
      if (client.readyState === 1) { // OPEN
        client.send(msgStr);
      }
    } catch (e) {
      wsClients.delete(client);
    }
  }
}

// 4. HTTP SERVERNI YARATISH
const server = http.createServer((req, res) => {
  // CORS sarlavhalari (barcha lokal mijozlar va Chrome kengaytmalari uchun)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;

  // JSON Body o'quvchi yordamchi funksiya
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

  // A) Server Info & Host IP
  if (pathname === "/api/info" && req.method === "GET") {
    const ips = getLocalIpAddresses();
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      status: "online",
      port: PORT,
      hostIps: ips,
      primaryIp: ips.length > 0 ? ips[0].ip : "127.0.0.1",
      serverTime: new Date().toISOString(),
      activeWsClients: wsClients.size
    }));
  }

  // B) Vrachlar Ro'yxati (GET /api/doctors)
  if (pathname === "/api/doctors" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(doctorsData));
  }

  // C) Vrach Qo'shish / Yangilash (POST /api/doctors)
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

  // D) Navbat Holati (GET /api/queue)
  if (pathname === "/api/queue" && req.method === "GET") {
    const doctorFilter = parsedUrl.searchParams.get("doctorId");
    let resultPatients = queueData.patients || [];
    if (doctorFilter) {
      resultPatients = resultPatients.filter(p => p.doctorId === doctorFilter);
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({
      patients: resultPatients,
      current_announcement: queueData.current_announcement,
      totalCount: queueData.patients.length
    }));
  }

  // E) Bemor Qo'shish (POST /api/queue/add)
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

      // Yangi bemor obyekti
      const newPatient = {
        id: body.id || `pat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        patientId: body.patientId || "",
        patientName: body.patientName.trim(),
        pinfl: body.pinfl || "",
        birthDate: body.birthDate || "",
        service: body.service || "Ko'rik / Tekshiruv",
        doctorId: doctor.id,
        doctorName: doctor.name,
        room: doctor.room,
        isContrast: !!body.isContrast,
        status: body.status || "waiting", // "waiting", "calling", "in_progress", "completed", "cancelled"
        orderNumber: queueData.patients.length + 1,
        createdAt: Date.now(),
        createdAtStr: new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
      };

      queueData.patients.push(newPatient);
      writeJsonFile(QUEUE_FILE, queueData);

      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });
      broadcastMessage({ type: "PATIENT_ADDED", data: newPatient });

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, patient: newPatient, total: queueData.patients.length }));
    });
    return;
  }

  // F) Bemorni Chaqirish (POST /api/queue/call) -> TV ga Ovozli E'lon Yuboradi!
  if (pathname === "/api/queue/call" && req.method === "POST") {
    parseRequestBody((err, body) => {
      if (err || !body.patientId && !body.id) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bemor ID ko'rsatilmagan" }));
      }

      const targetId = body.id || body.patientId;
      const patient = queueData.patients.find(p => p.id === targetId || p.patientId === targetId);

      if (!patient) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Bemor navbatda topilmadi" }));
      }

      // Vrachning oldingi chaqirilayotgan bemorini "in_progress" yoki yakunlangan qilish
      queueData.patients.forEach(p => {
        if (p.doctorId === patient.doctorId && p.id !== patient.id && p.status === "calling") {
          p.status = "in_progress";
        }
      });

      patient.status = "calling";
      patient.calledAt = Date.now();
      patient.calledAtStr = new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
      patient.callCount = (patient.callCount || 0) + 1;

      // E'lon obyekti (TV ushbu signalni olib ovozli o'qiydi)
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

      // Barcha ulangan TV va kompyuterlarga signal tarqatish
      broadcastMessage({ type: "CALL_ANNOUNCEMENT", data: announcement });
      broadcastMessage({ type: "QUEUE_UPDATED", data: queueData });

      console.log(`📢 CHAQIRUV: ${patient.patientName} -> ${patient.room} (${patient.doctorName})`);

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, announcement, patient }));
    });
    return;
  }

  // G) Bemor Holatini O'zgartirish (POST /api/queue/status)
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
        // Agar joriy e'londagi bemor bo'lsa, e'lonni tozalash
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

  // H) 2-KENGAYTMA: Bemor Vrachini O'zgartirish (POST /api/queue/reassign)
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
        // Mavjud bemorning vrachini almashtirish
        const oldDoctorName = patient.doctorName;
        patient.doctorId = targetDoctor.id;
        patient.doctorName = targetDoctor.name;
        patient.room = targetDoctor.room;
        patient.status = "waiting"; // Yangi vrach navbatiga kutish holatida o'tadi
        patient.reassignedAt = Date.now();

        console.log(`🔄 VRACH O'ZGARTIRILDI: ${patient.patientName} (${oldDoctorName} -> ${targetDoctor.name})`);
      } else {
        // Agar bemor hali navbatda bo'lmasa, uni yangi vrachga yangitdan qo'shish
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

  // I) Navbatni Tozalash (POST /api/queue/clear)
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
  // STATIK FAYLLARNI SERVE QILISH (TV & DASHBOARD)
  // ==========================================

  let filePath = "";

  if (pathname === "/" || pathname === "/tv" || pathname === "/tv/") {
    filePath = path.join(PUBLIC_DIR, "tv", "index.html");
  } else if (pathname.startsWith("/tv/")) {
    filePath = path.join(PUBLIC_DIR, "tv", pathname.replace("/tv/", ""));
  } else {
    filePath = path.join(PUBLIC_DIR, pathname);
  }

  // Fayl mavjudligini tekshirish
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".woff2": "font/woff2",
      ".woff": "font/woff",
      ".ttf": "font/ttf"
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    return fs.createReadStream(filePath).pipe(res);
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Sahifa yoki API topilmadi", path: pathname }));
});

// ==========================================
// 5. WEBSOCKET SERVER (Built-in Native WS)
// ==========================================
let WebSocketServer = null;
try {
  const wsPkg = require("ws");
  WebSocketServer = wsPkg.Server;
} catch (e) {
  // Agar 'ws' o'rnatilmagan bo'lsa, xabar berish
  console.log("ℹ️ 'ws' paketi yuklanmadi, oddiy HTTP rejimda ishlaydi.");
}

if (WebSocketServer) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    wsClients.add(ws);
    const clientIp = req.socket.remoteAddress;
    console.log(`🔌 Yangi mijoz ulandi (${clientIp}). Jami ulanganlar: ${wsClients.size}`);

    // Boshlang'ich ma'lumotlarni yuborish
    ws.send(JSON.stringify({
      type: "INITIAL_STATE",
      data: {
        queue: queueData,
        doctors: doctorsData
      }
    }));

    ws.on("close", () => {
      wsClients.delete(ws);
      console.log(`🔌 Mijoz uzildi. Qolganlar: ${wsClients.size}`);
    });

    ws.on("error", () => {
      wsClients.delete(ws);
    });
  });
}

// 6. SERVERNI ISHGA TUSHIRISH
server.listen(PORT, "0.0.0.0", () => {
  const ipList = getLocalIpAddresses();
  const primaryIp = ipList.length > 0 ? ipList[0].ip : "127.0.0.1";

  console.log("\n==================================================================");
  console.log("  🏥 UTT TV SISTEM — 100% LOKAL TARMOQ (LAN) REALTIME SERVERI");
  console.log("==================================================================");
  console.log(`  🚀 Server holati: ISHLAMOQDA (Port: ${PORT})`);
  console.log(`  🌐 Lokal Kompyuterda:   http://localhost:${PORT}/tv`);
  console.log("------------------------------------------------------------------");
  console.log("  📡 LOKAL TARMOQDAGI (LAN) ULANISH MANZILLARI:");
  ipList.forEach(item => {
    console.log(`  📺 [${item.interface}] Android TV:  http://${item.ip}:${PORT}/tv`);
    console.log(`  🔌 [${item.interface}] Kengaytmalar: http://${item.ip}:${PORT}/api`);
  });
  console.log("------------------------------------------------------------------");
  console.log(`  💡 ASOSIY HOST MANZILI: http://${primaryIp}:${PORT}`);
  console.log("==================================================================\n");
});
