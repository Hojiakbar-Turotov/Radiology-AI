/**
 * UTT VRACH QABULI — KARMED / RADIOLOGIYA AVTOMATIK NAVBATNI O'QISH CONTENT SCRIPTI
 * 
 * 1. Karmed jadvalidan Ro'yxatga olingan vaqt (anchor) orqali:
 *    - Ulangan bo'lim -> Xona raqami va vrach (masalan: Ultratovush-1 -> UTT 1 - 53 XONA, Juravlev)
 *    - Bemor ID -> (masalan: 6685)
 *    - Familiya, Ismi, Ota ismi -> (masalan: NORQUZIYEVA MAXBUBA XXX)
 * 2. Bemor chaqirilganda to'g'ridan-to'g'ri o'sha xonaning TV siga uzatiladi va 60s taymer ishlaydi.
 * 3. Xotirada bemorlar qolmaydi — har safar faqat jonli jadval o'qiladi.
 */

let serverUrl = "http://localhost:3000";
let selectedDoctorId = "vrach_utt_1"; // Default
let activeQueue = [];
let isScanning = false;
let widgetEl = null;
let lastSentSignature = "";
let scanDebounceTimer = null;
let searchQuery = "";
let isAccordionOpen = true;
let ws = null;

// TIZIMGA KIRGAN VRACH VA RUXSAT HOLATI
let detectedDoctorName = "";
let isDoctorAuthorized = true;
let matchedDoctorObj = null;
let allServerDoctors = [];
let myDeviceId = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

// 60-SONIYALIK KUTISH TAYMERI O'ZGARUVCHILARI
let currentCallingPatient = null;
let waitCountdownSec = 60;
let waitCountdownTimer = null;

// 10 ta rasmiy UTT shifokorlari va xonalari mappingi
const DOCTOR_MAPPINGS = [
  { id: "vrach_utt_1", key: "juravlev", uttNum: 1, name: "Juravlev Igor Ivanovich", room: "UTT 1 - 53 XONA", roomNum: "53" },
  { id: "vrach_utt_2", key: "kurbanova", uttNum: 2, name: "Kurbanova Sevinch Musayevna", room: "UTT 2 - 54 XONA", roomNum: "54" },
  { id: "vrach_utt_3", key: "abidjanov", uttNum: 3, name: "Abidjanov Alisher Maxamataliyevich", room: "UTT 3 - 46 XONA", roomNum: "46" },
  { id: "vrach_utt_4", key: "ziyayeva", uttNum: 4, name: "Ziyayeva Zarina Abduganiyevna", room: "UTT 4 - 47 XONA", roomNum: "47" },
  { id: "vrach_utt_5", key: "xoshimova", uttNum: 5, name: "Xoshimova Lola Kabulovna", room: "UTT 5 - 48 XONA", roomNum: "48" },
  { id: "vrach_utt_6", key: "toirova", uttNum: 6, name: "Toirova Shaxlo Oybek qizi", room: "UTT 6 - 52 XONA", roomNum: "52" },
  { id: "vrach_utt_7", key: "asadova", uttNum: 7, name: "Asadova Dildoraxon Asatullayevna", room: "UTT 7 - 45 XONA", roomNum: "45" },
  { id: "vrach_utt_8", key: "saidbayeva", uttNum: 8, name: "Saidbayeva Zulfiya Yergeshovna", room: "UTT 8 - 49 XONA", roomNum: "49" },
  { id: "vrach_utt_9", key: "xusanova", uttNum: 9, name: "Xusanova Feruza Ikromjonovna", room: "UTT 9 - 50 XONA", roomNum: "50" },
  { id: "vrach_utt_10", key: "xudayberdiyeva", uttNum: 10, name: "Xudayberdiyeva Nigora Nizamovna", room: "UTT 10 - 51 XONA", roomNum: "51" }
];

// 1. ISHGA TUSHIRISH
(async function init() {
  await loadSettings();
  createFloatingWidget();
  startObservingTable();
  initWebSocket();
  
  setTimeout(checkDoctorAuthorization, 300);
  setInterval(checkDoctorAuthorization, 4000);

  scheduleScan();
  setInterval(scheduleScan, 5000);
})();

async function loadSettings() {
  return new Promise(resolve => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["serverUrl", "selectedDoctorId", "myDeviceId"], res => {
        if (res.serverUrl) serverUrl = res.serverUrl.replace(/\/+$/, "");
        if (res.selectedDoctorId) selectedDoctorId = res.selectedDoctorId;
        if (res.myDeviceId) myDeviceId = res.myDeviceId;
        else chrome.storage.local.set({ myDeviceId });
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function scheduleScan() {
  if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
  scanDebounceTimer = setTimeout(scanKarmedTableAndSync, 400);
}

// 2. WEBSOCKET SYNC
function initWebSocket() {
  try {
    let wsUrl = serverUrl.replace(/^http/, "ws");
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "CLIENT_IDENTIFY",
        data: {
          clientType: "extension",
          deviceId: myDeviceId,
          doctorName: detectedDoctorName,
          name: `💻 Vrach: ${detectedDoctorName || "Shifokor"}`
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "DEVICE_APPROVED") {
          isDoctorAuthorized = true;
          checkDoctorAuthorization();
        } else if (msg.type === "DOCTORS_UPDATED") {
          allServerDoctors = msg.data || [];
          checkDoctorAuthorization();
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 4000);
    };
  } catch (err) {
    setTimeout(initWebSocket, 5000);
  }
}

// 3. KARMED YUQORI PANELIDAN TIZIMGA KIRGAN VRACH FISH NI ANIQLASH
function extractLoggedInDoctorName() {
  const allLeafEls = Array.from(document.querySelectorAll("div, span, td, a, b, p, label, li, font"))
    .filter(el => el.children.length === 0 && el.innerText && el.innerText.trim().length > 0);

  for (let i = 0; i < allLeafEls.length; i++) {
    const txt = allLeafEls[i].innerText.trim();
    if (txt.includes("Haqida")) {
      for (let j = i + 1; j < Math.min(i + 8, allLeafEls.length); j++) {
        const nextTxt = allLeafEls[j].innerText.trim();
        if (nextTxt.includes("Chiqish")) break;
        if (nextTxt && !nextTxt.includes("v:") && !nextTxt.includes("1.0.") && nextTxt.split(" ").length >= 2) {
          return cleanDoctorName(nextTxt);
        }
      }
    }
  }

  const userNodes = document.querySelectorAll("[class*='user'], [class*='account'], [class*='profile'], [id*='user'], [id*='doctor']");
  for (const node of userNodes) {
    const txt = node.innerText.trim();
    if (txt && txt.split(" ").length >= 2 && !txt.includes("Chiqish") && !txt.includes("Haqida")) {
      return cleanDoctorName(txt);
    }
  }

  const bodyText = document.body ? document.body.innerText.substring(0, 3000) : "";
  const nameMatch = bodyText.match(/(?:Haqida[^\n]*?)\s*(?:👤|[^\w\s])?\s*([A-ZА-ЯЁ][a-zа-яё'\`ʻ]+(?:\s+[A-ZА-ЯЁ][a-zа-яё'\`ʻ]+){1,3}(?:\s+o['`ʻ]g['`ʻ]li|\s+qizi)?)\s*(?:❌|Chiqish)/i)
                 || bodyText.match(/(?:👤|Standart printer[^\n]*?)\s*([A-ZА-ЯЁ][a-zа-яё'\`ʻ]+(?:\s+[A-ZА-ЯЁ][a-zа-яё'\`ʻ]+){1,3}(?:\s+o['`ʻ]g['`ʻ]li|\s+qizi)?)/i);

  if (nameMatch && nameMatch[1]) {
    return cleanDoctorName(nameMatch[1]);
  }

  return "";
}

function cleanDoctorName(str) {
  return str.replace(/^[👤\s\-_:\/|•\d.]+/, '')
            .replace(/[❌\s\-_:\/|•\d.]+$/, '')
            .replace(/\s+/g, ' ')
            .trim();
}

// 4. VRACHNING ADMIN RO'YXATIDAGI RUXSATINI TEKSHIRISH
async function checkDoctorAuthorization() {
  const docName = extractLoggedInDoctorName();
  if (docName) {
    detectedDoctorName = docName;
  }

  try {
    const res = await fetch(`${serverUrl}/api/doctors`);
    if (res.ok) {
      allServerDoctors = await res.json();
    }
  } catch (e) {}

  let foundDoc = null;
  if (detectedDoctorName && allServerDoctors.length > 0) {
    const cleanDetected = detectedDoctorName.toLowerCase().replace(/[^a-zа-яё]/gi, '');
    foundDoc = allServerDoctors.find(d => {
      const cleanDoc = d.name.toLowerCase().replace(/[^a-zа-яё]/gi, '');
      return (cleanDoc && cleanDetected) && (cleanDoc.includes(cleanDetected) || cleanDetected.includes(cleanDoc));
    });
  }

  if (!foundDoc && detectedDoctorName) {
    const cleanDetected = detectedDoctorName.toLowerCase().replace(/[^a-zа-яё]/gi, '');
    foundDoc = DOCTOR_MAPPINGS.find(d => {
      const cleanDoc = d.name.toLowerCase().replace(/[^a-zа-яё]/gi, '');
      return cleanDoc.includes(cleanDetected) || cleanDetected.includes(cleanDoc);
    });
  }

  if (foundDoc) {
    isDoctorAuthorized = true;
    matchedDoctorObj = foundDoc;
    selectedDoctorId = foundDoc.id;
  } else {
    isDoctorAuthorized = true; // Karmed'dagi xonadan avtomatik ishlash
  }

  updateWidgetUI();
}

async function sendDoctorAccessRequest() {
  if (!detectedDoctorName) {
    detectedDoctorName = extractLoggedInDoctorName() || "Turatov Hojiakbar Shavkat ogli";
  }

  try {
    const res = await fetch(`${serverUrl}/api/doctors/request-access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doctorName: detectedDoctorName,
        deviceId: myDeviceId
      })
    });
    const data = await res.json();
    if (data.ok) {
      showCallNotification("Ruxsat so'rovi yuborildi!", "Admin paneli tasdiqlashi kutilmoqda");
    }
  } catch (e) {
    alert("Serverga ulanish xatosi: " + e.message);
  }
}

// 5. "ULANGAN BO'LIM" USTUNIDAN XONA VA VRACHNI ANIQLASH (MASALAN: "Ultratovush-1(Juravlev Igor)")
function parseUlanganBolimInfo(ulanganBolimStr, fallbackDoctorStr = "") {
  const combined = `${ulanganBolimStr || ''} ${fallbackDoctorStr || ''}`.trim();
  if (!combined) {
    const def = matchedDoctorObj || DOCTOR_MAPPINGS.find(d => d.id === selectedDoctorId) || DOCTOR_MAPPINGS[0];
    return {
      doctorId: def.id,
      doctorName: def.name,
      room: def.room,
      roomNum: def.roomNum,
      rawBolim: ulanganBolimStr || ""
    };
  }

  const numMatch = combined.match(/ultratovush\s*[-–—:]*\s*(\d+)/i) || combined.match(/utt\s*[-–—:]*\s*(\d+)/i);
  let uttNumber = numMatch ? parseInt(numMatch[1], 10) : null;

  const nameInParenMatch = combined.match(/\(([^)]+)\)/);
  let parsedName = nameInParenMatch ? nameInParenMatch[1].trim() : "";

  let matchedDoc = null;
  if (uttNumber !== null) {
    matchedDoc = DOCTOR_MAPPINGS.find(d => d.uttNum === uttNumber || d.id === `vrach_utt_${uttNumber}`);
  }

  if (!matchedDoc && (parsedName || combined)) {
    const searchTarget = (parsedName || combined).toLowerCase().replace(/[^a-zа-яё]/gi, '');
    matchedDoc = DOCTOR_MAPPINGS.find(d => {
      const dClean = d.name.toLowerCase().replace(/[^a-zа-яё]/gi, '');
      return dClean.includes(searchTarget) || searchTarget.includes(dClean) || searchTarget.includes(d.key);
    });
  }

  if (matchedDoc) {
    return {
      doctorId: matchedDoc.id,
      doctorName: matchedDoc.name,
      room: matchedDoc.room,
      roomNum: matchedDoc.roomNum,
      rawBolim: ulanganBolimStr || ""
    };
  }

  return {
    doctorId: uttNumber ? `vrach_utt_${uttNumber}` : (selectedDoctorId || "vrach_utt_1"),
    doctorName: parsedName || fallbackDoctorStr || "Juravlev Igor Ivanovich",
    room: uttNumber ? `UTT ${uttNumber} - 53 XONA` : "UTT 1 - 53 XONA",
    roomNum: uttNumber ? String(uttNumber) : "53",
    rawBolim: ulanganBolimStr || ""
  };
}

// 6. SANANI UNIX TIMESTAMP GA AYLANTIRISH
function parseDateTimeToTimestamp(str) {
  if (!str) return Date.now();
  const matchFull = str.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (matchFull) {
    const day = parseInt(matchFull[1], 10);
    const month = parseInt(matchFull[2], 10) - 1;
    const year = parseInt(matchFull[3], 10);
    const hour = parseInt(matchFull[4], 10);
    const min = parseInt(matchFull[5], 10);
    const sec = matchFull[6] ? parseInt(matchFull[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  const matchTimeOnly = str.match(/(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (matchTimeOnly) {
    const now = new Date();
    now.setHours(parseInt(matchTimeOnly[1], 10), parseInt(matchTimeOnly[2], 10), matchTimeOnly[3] ? parseInt(matchTimeOnly[3], 10) : 0, 0);
    return now.getTime();
  }

  return Date.now();
}

// 7. KARMED JADVALINI ANCHOR (SANA/VAQT) ORQALI 100% ANIQ O'QISH
function scanKarmedTableAndSync() {
  if (isScanning) return;
  isScanning = true;

  try {
    const freshPatients = [];
    const seenIds = new Set();

    // Barcha qatorlarni olish
    const allRows = Array.from(document.querySelectorAll("tr, .x-grid3-row"));

    allRows.forEach((r, rowIdx) => {
      const cells = Array.from(r.children).filter(c => c.tagName === "TD");
      if (cells.length < 6) return;

      const cellTexts = cells.map(c => c.innerText.trim());

      // Pastdagi Tashxislar / Xizmatlar jadvali qatorlarini o'tkazib yuborish
      if (cellTexts.some(t => t.includes("Tranzaksiya") || t.includes("So'rov yuboradigan") || t.includes("Periferik Limfa") || t.includes("UTT Buyraklar") || t.startsWith("R52") || t.startsWith("R78") || t.startsWith("R62") || t.includes("To'langan"))) {
        return;
      }

      // Sarlavha yoki guruh qatorini o'tkazib yuborish
      if (cellTexts.some(t => t.toLowerCase() === "familiya" || t.toLowerCase() === "bemor id" || t.toLowerCase() === "kod" || t.startsWith("Ultratovush ("))) {
        return;
      }

      // ANCHOR: Sana va vaqt katagini aniqlash (Masalan: "27.08.2026 08:22")
      const regTimeIdx = cellTexts.findIndex(t => /\d{2}\.\d{2}\.\d{4}/.test(t));
      if (regTimeIdx === -1) return;

      // Karmed asosiy jadvali tartibi (Anchor asosida):
      // [regTimeIdx - 1]: Ulangan bo'lim (masalan: Ultratovush-1(Juravlev Igor Ivanovich))
      // [regTimeIdx]:     Ro'yxatga olingan sana (masalan: 27.08.2026 08:22)
      // [regTimeIdx + 1]: Bemor ID (masalan: 6685, 55594, 17926)
      // [regTimeIdx + 2]: Familiya (masalan: NORQUZIYEVA, NAVRUZOVA, AXMEDOV)
      // [regTimeIdx + 3]: Ismi (masalan: MAXBUBA, BUSABIRA, ASATULLA)
      // [regTimeIdx + 4]: Ota ismi (masalan: XXX, KAMCHIBEKOVNA, BERDALIYEVICH)
      // [regTimeIdx + 5]: Ustuvorlik (masalan: 65 yoshdan oshgan fuqarolar)
      // [regTimeIdx + 6]: Bo'lim (masalan: Ginekologiya, Mammologiya, Urologiya)

      const ulanganBolimText = cellTexts[regTimeIdx - 1] || "";
      const regTimeStr = cellTexts[regTimeIdx] || "";
      const patId = cellTexts[regTimeIdx + 1] || "";
      const lastName = cellTexts[regTimeIdx + 2] || "";
      const firstName = cellTexts[regTimeIdx + 3] || "";
      const middleName = cellTexts[regTimeIdx + 4] || "";
      const department = cellTexts[regTimeIdx + 6] || cellTexts[regTimeIdx + 5] || "UTT";

      if (!lastName && !firstName) return;

      const fullName = `${lastName} ${firstName} ${middleName}`.replace(/\s+/g, ' ').trim();
      const uniqueKey = `${patId}_${fullName}`;
      if (seenIds.has(uniqueKey)) return;
      seenIds.add(uniqueKey);

      const timestamp = parseDateTimeToTimestamp(regTimeStr);

      // ULANGAN BO'LIM USTUNIDAN XONA VA VRACHNI ANIQ OLISH (UTT 1 - 53 XONA)
      const roomInfo = parseUlanganBolimInfo(ulanganBolimText);

      const oldP = activeQueue.find(p => (patId && p.patientId === patId) || p.patientName === fullName);
      const curStatus = oldP ? oldP.status : "waiting";

      const patientObj = {
        id: `karmed_${patId || rowIdx}_${Date.now()}`,
        patientId: patId,
        patientName: fullName,
        pinfl: "",
        birthDate: "",
        department: department,
        service: `UTT (${department})`,
        ulanganBolim: ulanganBolimText,
        registeredAtStr: regTimeStr || new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
        registeredAtTimestamp: timestamp,
        doctorId: roomInfo.doctorId,
        doctorName: roomInfo.doctorName,
        room: roomInfo.room,
        roomNum: roomInfo.roomNum,
        status: curStatus
      };

      freshPatients.push(patientObj);
      attachRowCallButton(r, patientObj);
    });

    if (freshPatients.length > 0) {
      freshPatients.sort((a, b) => a.registeredAtTimestamp - b.registeredAtTimestamp);
      activeQueue = freshPatients;
      updateWidgetUI();
      sendQueueToServer(freshPatients);
    } else {
      activeQueue = [];
      updateWidgetUI();
    }
  } catch (err) {
    console.warn("Karmed scan error:", err);
  } finally {
    isScanning = false;
  }
}

// 8. LOKAL SERVERGA SINXRONLASH
async function sendQueueToServer(patients) {
  const currentSig = JSON.stringify(patients.map(p => `${p.patientId}_${p.patientName}_${p.registeredAtStr}_${p.room}_${p.status}`));
  if (currentSig === lastSentSignature) return;

  const primaryDocId = patients[0] ? patients[0].doctorId : selectedDoctorId;

  try {
    const res = await fetch(`${serverUrl}/api/queue/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patients: patients, doctorId: primaryDocId })
    });
    const data = await res.json();
    if (data.ok) {
      lastSentSignature = currentSig;
    }
  } catch (e) {}
}

// 9. BEMORNI CHAQIRISH (1 DAQIQALIK TAYMER BILAN BIRGA)
async function callPatientDirect(patient) {
  if (!patient) return;

  patient.status = "calling";
  currentCallingPatient = patient;
  waitCountdownSec = 60;

  try {
    const res = await fetch(`${serverUrl}/api/queue/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: patient.patientName,
        patientId: patient.patientId,
        doctorId: patient.doctorId,
        doctorName: patient.doctorName,
        room: patient.room,
        service: patient.service
      })
    });
    const data = await res.json();
    if (data.ok) {
      showCallNotification(patient.patientName, patient.room);
    }
  } catch (err) {
    console.warn("Call error:", err);
  }

  if (ws && ws.readyState === 1) {
    try {
      ws.send(JSON.stringify({
        type: "CALL_PATIENT",
        data: {
          patientName: patient.patientName,
          patientId: patient.patientId,
          doctorId: patient.doctorId,
          doctorName: patient.doctorName,
          room: patient.room,
          service: patient.service
        }
      }));
    } catch (e) {}
  }

  startWaitCountdown(patient);
  updateWidgetUI();
}

function startWaitCountdown(patient) {
  if (waitCountdownTimer) clearInterval(waitCountdownTimer);

  waitCountdownTimer = setInterval(() => {
    waitCountdownSec--;
    updateCountdownUI();

    if (waitCountdownSec <= 0) {
      clearInterval(waitCountdownTimer);
      waitCountdownTimer = null;
      handlePatientMissedTimeout(patient);
    }
  }, 1000);
}

// 1 DAQIQA O'TIB BEMOR KELMAGANDA AVTOMATIK XABAR BERISH
async function handlePatientMissedTimeout(patient) {
  if (!patient || patient.status !== "calling") return;

  patient.status = "missed";
  currentCallingPatient = null;

  showMissedNotification(patient.patientName, patient.room);

  try {
    await fetch(`${serverUrl}/api/queue/missed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: patient.patientId,
        patientName: patient.patientName,
        doctorId: patient.doctorId,
        doctorName: patient.doctorName,
        room: patient.room
      })
    });
  } catch (e) {}

  updateWidgetUI();
}

async function acceptCurrentPatient() {
  if (waitCountdownTimer) clearInterval(waitCountdownTimer);
  waitCountdownTimer = null;

  if (currentCallingPatient) {
    currentCallingPatient.status = "in_progress";
    try {
      await fetch(`${serverUrl}/api/queue/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: currentCallingPatient.patientId, id: currentCallingPatient.id, status: "in_progress" })
      });
    } catch (e) {}
    currentCallingPatient = null;
  }
  updateWidgetUI();
}

async function markCurrentPatientMissed() {
  if (waitCountdownTimer) clearInterval(waitCountdownTimer);
  waitCountdownTimer = null;

  if (currentCallingPatient) {
    handlePatientMissedTimeout(currentCallingPatient);
  }
}

async function recallCurrentPatient() {
  if (currentCallingPatient) {
    callPatientDirect(currentCallingPatient);
  }
}

// 10. SUZUVCHI BOSHQARUV WIDGETI (KARMED EKRANIDA)
function createFloatingWidget() {
  if (document.getElementById("uttVrachFloatingWidget")) return;

  const firstP = activeQueue[0];
  const currentRoomName = firstP ? firstP.room : "UTT 1 - 53 XONA";
  const currentDocName = firstP ? firstP.doctorName : "Juravlev Igor Ivanovich";

  widgetEl = document.createElement("div");
  widgetEl.id = "uttVrachFloatingWidget";
  widgetEl.className = "utt-floating-widget";
  widgetEl.innerHTML = `
    <div class="utt-widget-header" id="uttWidgetHeader">
      <div class="utt-widget-title">
        <span class="utt-pulse-dot"></span>
        <b>🏥 UTT NAVBAT BOSHQARUVI</b>
      </div>
      <div class="utt-header-actions">
        <button class="utt-btn-min" id="uttBtnMin" title="Kichraytirish">—</button>
      </div>
    </div>

    <div class="utt-widget-body" id="uttWidgetBody">
      <!-- 0. ADMINDAN RUXSAT SO'RASH BLOKI -->
      <div class="utt-auth-lock-card" id="uttAuthLockCard" style="display: none;">
        <div class="utt-auth-title">🔒 ADMINDAN RUXSAT SO'RASH</div>
        <div class="utt-auth-desc">Tizimga kirgan shifokor:</div>
        <div class="utt-auth-doc-chip" id="uttAuthDocName">Aniqlanmoqda...</div>
        <div class="utt-auth-desc" style="color:#94a3b8; font-size:11px;">
          Ushbu shifokor Admin panelda ro'yxatga olinmagan yoki xona biriktirilmagan.
        </div>
        <button class="utt-btn-request-auth" id="uttBtnRequestAuth">🔔 Admindan Ruxsat So'rash</button>
        <button class="utt-btn-check-auth" id="uttBtnCheckAuth">🔄 Qayta Tekshirish</button>
      </div>

      <!-- 1. VRACH VA XONA MA'LUMOTI -->
      <div class="utt-doc-info" id="uttDocInfoBlock">
        <div class="utt-doc-room" id="uttWidgetRoom">${currentRoomName}</div>
        <div class="utt-doc-name" id="uttWidgetDoc">${currentDocName}</div>
      </div>

      <!-- 2. CHAQIRILGAN BEMOR VA 1 DAQIQALIK TAYMER BLOKI -->
      <div class="utt-calling-card" id="uttCallingCard" style="display: none;">
        <div class="utt-calling-header">
          <span>📢 HOZIR CHAQIRILGAN BEMOR:</span>
          <span class="utt-timer-badge" id="uttTimerBadge">⏱️ 60s</span>
        </div>
        <div class="utt-calling-name" id="uttCallingName">—</div>
        <div class="utt-timer-bar">
          <div class="utt-timer-fill" id="uttTimerFill"></div>
        </div>
        <div class="utt-calling-actions">
          <button class="utt-btn-accept" id="uttBtnAccept">✅ Qabul</button>
          <button class="utt-btn-recall" id="uttBtnRecall">📢 Qayta</button>
          <button class="utt-btn-missed" id="uttBtnMissed">⚠️ Kelmadi</button>
        </div>
      </div>

      <!-- 3. KEYINGI BEMOR KARTASI (VAQTI BO'YICHA) -->
      <div class="utt-next-box" id="uttNextBox">
        <div class="utt-next-label">KEYINGI BEMOR (VAQTI BO'YICHA):</div>
        <div class="utt-next-name" id="uttNextPatientName">${firstP ? `${firstP.patientName} (${firstP.registeredAtStr})` : 'Kutayotgan bemorlar yo\'q'}</div>
      </div>

      <!-- 4. ASOSIY KEYINGI BEMORNI CHAQIRISH TUGMASI -->
      <button class="utt-btn-call-main" id="uttBtnCallMain">
        📢 KEYINGI BEMORNI CHAQIRISH
      </button>

      <!-- 5. VRACH ISTAGAN BEMORNI TANLASH VA CHAQIRISH RO'YXATI -->
      <div class="utt-patients-accordion">
        <div class="utt-accordion-header" id="uttAccordionToggle">
          <span>📋 Barcha Bemorlar (<b id="uttAccordionCount">0</b> ta)</span>
          <span id="uttAccordionIcon">▲</span>
        </div>
        <div class="utt-accordion-content" id="uttAccordionContent" style="display: flex;">
          <input type="text" class="utt-search-box" id="uttSearchInput" placeholder="🔍 F.I.Sh yoki Bemor ID bo'yicha qidirish..." />
          <div id="uttPatientsListContainer" style="display:flex; flex-direction:column; gap:6px; margin-top:4px;"></div>
        </div>
      </div>

      <!-- 6. FOOTER -->
      <div class="utt-widget-footer">
        <button class="utt-btn-refresh" id="uttBtnRescan">🔄 Qayta O'qish</button>
        <span class="utt-srv-status" id="uttSrvStatus">🟢 Server Online</span>
      </div>
    </div>
  `;

  document.body.appendChild(widgetEl);

  // Hodisalar
  document.getElementById("uttBtnCallMain").addEventListener("click", () => {
    const nextP = activeQueue.find(p => p.status === "waiting") || activeQueue[0];
    if (nextP) {
      callPatientDirect(nextP);
    } else {
      alert("Hozirda navbatda kutayotgan bemorlar yo'q");
    }
  });

  document.getElementById("uttBtnAccept").addEventListener("click", acceptCurrentPatient);
  document.getElementById("uttBtnRecall").addEventListener("click", recallCurrentPatient);
  document.getElementById("uttBtnMissed").addEventListener("click", markCurrentPatientMissed);

  document.getElementById("uttBtnRequestAuth").addEventListener("click", sendDoctorAccessRequest);
  document.getElementById("uttBtnCheckAuth").addEventListener("click", checkDoctorAuthorization);

  document.getElementById("uttBtnRescan").addEventListener("click", () => {
    scanKarmedTableAndSync();
    checkDoctorAuthorization();
  });

  document.getElementById("uttBtnMin").addEventListener("click", () => {
    const body = document.getElementById("uttWidgetBody");
    body.style.display = body.style.display === "none" ? "block" : "none";
  });

  document.getElementById("uttAccordionToggle").addEventListener("click", () => {
    isAccordionOpen = !isAccordionOpen;
    const content = document.getElementById("uttAccordionContent");
    const icon = document.getElementById("uttAccordionIcon");
    content.style.display = isAccordionOpen ? "flex" : "none";
    icon.innerText = isAccordionOpen ? "▲" : "▼";
    if (isAccordionOpen) renderAccordionList();
  });

  document.getElementById("uttSearchInput").addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderAccordionList();
  });

  makeDraggable(widgetEl, document.getElementById("uttWidgetHeader"));
  updateWidgetUI();
}

function updateCountdownUI() {
  const badge = document.getElementById("uttTimerBadge");
  const fill = document.getElementById("uttTimerFill");

  if (badge) {
    badge.innerText = `⏱️ ${waitCountdownSec}s`;
    if (waitCountdownSec <= 15) {
      badge.classList.add("warning");
    } else {
      badge.classList.remove("warning");
    }
  }

  if (fill) {
    const pct = (waitCountdownSec / 60) * 100;
    fill.style.width = `${pct}%`;
  }
}

function updateWidgetUI() {
  const roomEl = document.getElementById("uttWidgetRoom");
  const docEl = document.getElementById("uttWidgetDoc");
  const nextEl = document.getElementById("uttNextPatientName");
  const btnCall = document.getElementById("uttBtnCallMain");
  const callingCard = document.getElementById("uttCallingCard");
  const callingName = document.getElementById("uttCallingName");
  const accCount = document.getElementById("uttAccordionCount");

  const authCard = document.getElementById("uttAuthLockCard");
  const authDocName = document.getElementById("uttAuthDocName");
  const docInfoBlock = document.getElementById("uttDocInfoBlock");

  if (!isDoctorAuthorized && detectedDoctorName) {
    if (authCard) authCard.style.display = "flex";
    if (authDocName) authDocName.innerText = `👤 ${detectedDoctorName}`;
    if (docInfoBlock) docInfoBlock.style.display = "none";
  } else {
    if (authCard) authCard.style.display = "none";
    if (docInfoBlock) docInfoBlock.style.display = "block";
  }

  if (accCount) accCount.innerText = activeQueue.length;

  const firstP = activeQueue[0];
  if (firstP) {
    if (roomEl) roomEl.innerText = firstP.room;
    if (docEl) docEl.innerText = firstP.doctorName;
  }

  // 1. Chaqirilgan bemor bloki
  if (currentCallingPatient) {
    if (callingCard) callingCard.style.display = "flex";
    if (callingName) callingName.innerText = `${currentCallingPatient.patientName} (${currentCallingPatient.room})`;
    updateCountdownUI();
  } else {
    if (callingCard) callingCard.style.display = "none";
  }

  // 2. Navbatdagi birinchi kutayotgan bemor
  const nextP = activeQueue.find(p => p.status === "waiting");
  if (nextP && nextEl) {
    nextEl.innerText = `${nextP.patientName} (${nextP.registeredAtStr})`;
    if (btnCall) btnCall.disabled = false;
  } else if (nextEl) {
    nextEl.innerText = activeQueue.length > 0 ? `${activeQueue[0].patientName}` : "Kutayotgan bemorlar yo'q";
    if (btnCall) btnCall.disabled = false;
  }

  if (isAccordionOpen) {
    renderAccordionList();
  }
}

function renderAccordionList() {
  const container = document.getElementById("uttPatientsListContainer");
  if (!container) return;

  let filtered = activeQueue;
  if (searchQuery) {
    filtered = activeQueue.filter(p => 
      p.patientName.toLowerCase().includes(searchQuery) ||
      (p.patientId && p.patientId.includes(searchQuery)) ||
      (p.department && p.department.toLowerCase().includes(searchQuery))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:#94a3b8; font-size:11px; padding:10px;">Bemorlar topilmadi</div>`;
    return;
  }

  container.innerHTML = filtered.map((p, idx) => {
    let statusClass = "";
    let statusLabel = "⏳ Kutmoqda";

    if (p.status === "calling") {
      statusClass = "is-calling";
      statusLabel = "📢 Chaqirilgan";
    } else if (p.status === "in_progress") {
      statusClass = "is-accepted";
      statusLabel = "✅ Qabulda";
    } else if (p.status === "missed") {
      statusClass = "is-missed";
      statusLabel = "⚠️ Kelmadi";
    }

    return `
      <div class="utt-patient-item ${statusClass}">
        <div class="utt-pat-details">
          <div class="utt-pat-name">${idx + 1}. ${escapeHtml(p.patientName)}</div>
          <div class="utt-pat-meta">ID: <b>${escapeHtml(p.patientId || '—')}</b> • Vaqt: <b>${escapeHtml(p.registeredAtStr)}</b> • <span style="color:#facc15;">${statusLabel}</span></div>
        </div>
        <button class="utt-btn-call-mini" data-id="${p.id}" onclick="window.__callPatientFromList('${p.id}')">📢 Chaqirish</button>
      </div>
    `;
  }).join("");
}

// Global ro'yxatdan chaqirish
window.__callPatientFromList = function(patientId) {
  const p = activeQueue.find(item => item.id === patientId);
  if (p) {
    callPatientDirect(p);
  }
};

// 11. KARMED JADVAL QATORIGA CHAQIRUV TUGMASINI QO'SHISH
function attachRowCallButton(row, patient) {
  if (row.querySelector(".utt-row-call-btn")) return;

  const firstCell = row.querySelector("td, .x-grid3-cell-inner");
  if (!firstCell) return;

  const btn = document.createElement("button");
  btn.className = "utt-row-call-btn";
  btn.title = `TV da chaqirish: ${patient.patientName} (${patient.room})`;
  btn.innerText = "📢";
  btn.onclick = (e) => {
    e.stopPropagation();
    callPatientDirect(patient);
  };

  firstCell.style.position = "relative";
  firstCell.prepend(btn);
}

function showCallNotification(name, room) {
  const toast = document.createElement("div");
  toast.className = "utt-call-toast";
  toast.innerHTML = `📢 <b>TV Monitorida Chaqirildi:</b><br>${escapeHtml(name)} -> <b>${escapeHtml(room)}</b>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function showMissedNotification(name, room) {
  const toast = document.createElement("div");
  toast.className = "utt-call-toast warning";
  toast.innerHTML = `⚠️ <b>Bemor 1 daqiqada kelmadi:</b><br>${escapeHtml(name)} (${escapeHtml(room)})<br><span style="font-size:11.5px; color:#fca5a5;">Holati 'Kelmadi' deb belgilandi.</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// 12. SUDRAB YURISH (DRAGGABLE)
function makeDraggable(el, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    el.style.top = (el.offsetTop - pos2) + "px";
    el.style.left = (el.offsetLeft - pos1) + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// 13. DOM O'ZGARISHLARINI KUZATISH (DEBOUNCED)
function startObservingTable() {
  const observer = new MutationObserver(() => {
    scheduleScan();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
