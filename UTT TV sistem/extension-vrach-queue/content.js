/**
 * UTT VRACH QABULI — KARMED / RADIOLOGIYA AVTOMATIK NAVBATNI O'QISH CONTENT SCRIPTI
 * 
 * 1. Karmed yuqori panelidan tizimga kirgan Vrach F.I.Sh (masalan: Turatov Hojiakbar Shavkat ogli) ni aniqlaydi.
 * 2. Agar vrach Admin ro'yxatida bo'lmasa, "Admindan ruxsat so'rash" holatida turadi va so'rov yuboradi.
 * 3. "Ulangan bo'lim" ustunidan Xona va Vrachni oladi va barcha bemorlarni xotiraga tuzadi.
 * 4. Bemor chaqirilganda 1 daqiqalik (60 soniya) jonli taymer ishlaydi (kelmasa "⚠️ Bemor kelmadi" xabari beriladi).
 * 5. Vrach istagan bemorni ro'yxatdan yoki jadvaldan tanlab chaqirishi mumkin.
 */

let serverUrl = "http://localhost:3000";
let selectedDoctorId = "vrach_utt_10"; // Default
let activeQueue = [];
let isScanning = false;
let widgetEl = null;
let lastSentSignature = "";
let scanDebounceTimer = null;
let searchQuery = "";
let isAccordionOpen = false;

// TIZIMGA KIRGAN VRACH VA RUXSAT HOLATI
let detectedDoctorName = "";
let isDoctorAuthorized = false;
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
  loadCachedQueueFromMemory();
  createFloatingWidget();
  startObservingTable();
  
  // Vrach nomini aniqlash va ruxsatni tekshirish
  setTimeout(checkDoctorAuthorization, 500);
  setInterval(checkDoctorAuthorization, 10000);

  scheduleScan();
  setInterval(scheduleScan, 15000);
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

function loadCachedQueueFromMemory() {
  try {
    const raw = localStorage.getItem("karmed_patients_memory_cache");
    if (raw) {
      activeQueue = JSON.parse(raw);
    }
  } catch (e) {}
}

function scheduleScan() {
  if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
  scanDebounceTimer = setTimeout(scanKarmedTableAndSync, 800);
}

// 2. KARMED YUQORI PANELIDAN TIZIMGA KIRGAN VRACH FISH NI ANIQLASH (MASALAN: "Turatov Hojiakbar Shavkat ogli")
function extractLoggedInDoctorName() {
  // 1. Yuqori panel elementlarini qidirish (top < 80px)
  const topEls = Array.from(document.querySelectorAll("div, span, td, a, b, p, label"))
    .filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.top >= 0 && rect.top < 80 && rect.height > 0 && el.children.length === 0;
    });

  for (let i = 0; i < topEls.length; i++) {
    const txt = topEls[i].innerText.trim();
    if (txt.includes("Haqida")) {
      for (let j = i + 1; j < Math.min(i + 6, topEls.length); j++) {
        const nextTxt = topEls[j].innerText.trim();
        if (nextTxt && !nextTxt.includes("Chiqish") && !nextTxt.includes("v:") && !nextTxt.includes("1.0.") && nextTxt.split(" ").length >= 2) {
          return cleanDoctorName(nextTxt);
        }
      }
    }
  }

  // 2. User / account class yoki id lari
  const userNodes = document.querySelectorAll("[class*='user'], [class*='account'], [class*='profile'], [id*='user'], [id*='doctor']");
  for (const node of userNodes) {
    const txt = node.innerText.trim();
    if (txt && txt.split(" ").length >= 2 && !txt.includes("Chiqish") && !txt.includes("Haqida")) {
      return cleanDoctorName(txt);
    }
  }

  // 3. Umumiy matndan "Turatov Hojiakbar..." kabi F.I.Sh qidirish
  const bodyText = document.body ? document.body.innerText.substring(0, 3000) : "";
  const nameMatch = bodyText.match(/(?:Haqida|Standart printer|👤)\s*[:\-–—]?\s*([A-ZА-ЯЁ][a-zа-яё'\`ʻ]+(?:\s+[A-ZА-ЯЁ][a-zа-яё'\`ʻ]+){1,3}(?:\s+o['`ʻ]g['`ʻ]li|\s+qizi)?)/i);
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

// 3. VRACHNING ADMIN RO'YXATIDAGI RUXSATINI TEKSHIRISH
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

  // 1. Matched doctor qidirish
  let foundDoc = null;
  if (detectedDoctorName) {
    const low = detectedDoctorName.toLowerCase().replace(/['`ʻ]/g, '');
    foundDoc = allServerDoctors.find(d => {
      const dLow = d.name.toLowerCase().replace(/['`ʻ]/g, '');
      return dLow.includes(low) || low.includes(dLow);
    });
  }

  // 2. Agar topilmasa, DOCTOR_MAPPINGS dan tekshirish
  if (!foundDoc && detectedDoctorName) {
    const low = detectedDoctorName.toLowerCase();
    foundDoc = DOCTOR_MAPPINGS.find(d => d.name.toLowerCase().includes(low) || low.includes(d.key));
  }

  if (foundDoc) {
    isDoctorAuthorized = true;
    matchedDoctorObj = foundDoc;
    selectedDoctorId = foundDoc.id;
  } else {
    // Agar vrach nomi aniqlangan bo'lsa-yu, lekin Admin ro'yxatida bo'lmasa -> RUXSAT SO'RASH holati!
    if (detectedDoctorName) {
      isDoctorAuthorized = false;
      matchedDoctorObj = null;
    } else {
      isDoctorAuthorized = true; // Hozircha nom topilmagan bo'lsa default ishlash
    }
  }

  updateWidgetUI();
}

// ADMINGA RUXSAT SO'ROVI YUBORISH
async function sendDoctorAccessRequest() {
  if (!detectedDoctorName) {
    alert("Karmed tizimidagi vrach F.I.Sh aniqlanmadi.");
    return;
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

// 4. "ULANGAN BO'LIM" USTUNIDAN XONA VA VRACHNI ANIQLASH (MASALAN: "Ultratovush-10(Xudayberdiyeva Nigora)")
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

  // 1. Ultratovush raqamini qidirish
  const numMatch = combined.match(/ultratovush\s*[-–—:]*\s*(\d+)/i) || combined.match(/utt\s*[-–—:]*\s*(\d+)/i);
  let uttNumber = numMatch ? parseInt(numMatch[1], 10) : null;

  // 2. Qavs ichidagi ismni olish
  const nameInParenMatch = combined.match(/\(([^)]+)\)/);
  let parsedName = nameInParenMatch ? nameInParenMatch[1].trim() : "";

  // 3. Mapping bilan solishtirish
  let matchedDoc = null;
  if (uttNumber !== null) {
    matchedDoc = DOCTOR_MAPPINGS.find(d => d.uttNum === uttNumber || d.id === `vrach_utt_${uttNumber}`);
  }

  if (!matchedDoc && (parsedName || combined)) {
    const searchTarget = (parsedName || combined).toLowerCase();
    matchedDoc = DOCTOR_MAPPINGS.find(d => searchTarget.includes(d.key) || d.name.toLowerCase().includes(searchTarget));
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
    doctorName: parsedName || fallbackDoctorStr || "UTT Shifokori",
    room: uttNumber ? `UTT ${uttNumber} XONA` : "UTT XONASI",
    roomNum: uttNumber ? String(uttNumber) : "",
    rawBolim: ulanganBolimStr || ""
  };
}

// 5. SANANI UNIX TIMESTAMP GA AYLANTIRISH
function parseDateTimeToTimestamp(str) {
  if (!str) return Date.now();
  const match = str.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    const min = parseInt(match[5], 10);
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }
  return Date.now();
}

// 6. KARMED JADVALINI TO'LIQ O'QISH, VAQTINCHALIK XOTIRAGA SAQLASH VA TARTIBLASH
function scanKarmedTableAndSync() {
  if (isScanning) return;
  isScanning = true;

  try {
    const patients = [];
    const tables = document.querySelectorAll("table");

    tables.forEach(table => {
      const rows = table.querySelectorAll("tr");
      if (rows.length < 2) return;

      // Ustun indekslarini aniqlash
      let colIdx = {
        doctor: -1,
        ulanganBolim: -1,
        patientId: -1,
        lastName: -1,
        firstName: -1,
        middleName: -1,
        priority: -1,
        department: -1,
        sampleNum: -1,
        birthDate: -1,
        pinfl: -1,
        org: -1,
        regTime: -1
      };

      const headerCells = rows[0].querySelectorAll("th, td");
      headerCells.forEach((cell, idx) => {
        const txt = cell.innerText.toLowerCase().trim();
        if (txt.includes("ulangan") && (txt.includes("bo'lim") || txt.includes("bolim"))) colIdx.ulanganBolim = idx;
        else if (txt.includes("shifokor")) colIdx.doctor = idx;
        else if (txt.includes("familiya")) colIdx.lastName = idx;
        else if (txt.includes("ismi") && !txt.includes("ota") && !txt.includes("familiya")) colIdx.firstName = idx;
        else if (txt.includes("ota")) colIdx.middleName = idx;
        else if (txt.includes("bemor id") || (txt.includes("id") && !txt.includes("shifokor"))) colIdx.patientId = idx;
        else if (txt.includes("pinfl") || txt.includes("pnfl")) colIdx.pinfl = idx;
        else if (txt.includes("tug'ilgan") || txt.includes("tugilgan")) colIdx.birthDate = idx;
        else if (txt.includes("bo'lim") || txt.includes("bolim")) colIdx.department = idx;
        else if (txt.includes("ro'yxatga") || txt.includes("royxatga") || txt.includes("vaqt") || txt.includes("sana")) colIdx.regTime = idx;
      });

      // Standart Karmed tartibi bo'yicha zaxira indekslar
      if (colIdx.lastName === -1 && rows.length > 1) {
        colIdx.doctor = 1;
        colIdx.ulanganBolim = 2;
        colIdx.patientId = 3;
        colIdx.lastName = 4;
        colIdx.firstName = 5;
        colIdx.middleName = 6;
        colIdx.department = 8;
        colIdx.birthDate = 10;
        colIdx.pinfl = 11;
        colIdx.regTime = 13;
      }

      // Qatorlarni o'qish
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const cells = r.querySelectorAll("td");
        if (cells.length < 5) continue;

        const doctorCellText = cells[colIdx.doctor] ? cells[colIdx.doctor].innerText.trim() : "";
        const ulanganBolimText = cells[colIdx.ulanganBolim] ? cells[colIdx.ulanganBolim].innerText.trim() : "";
        const patId = cells[colIdx.patientId] ? cells[colIdx.patientId].innerText.trim() : "";
        const lastName = cells[colIdx.lastName] ? cells[colIdx.lastName].innerText.trim() : "";
        const firstName = cells[colIdx.firstName] ? cells[colIdx.firstName].innerText.trim() : "";
        const middleName = cells[colIdx.middleName] ? cells[colIdx.middleName].innerText.trim() : "";
        const department = cells[colIdx.department] ? cells[colIdx.department].innerText.trim() : "UTT";
        const birthDate = cells[colIdx.birthDate] ? cells[colIdx.birthDate].innerText.trim() : "";
        const pinfl = cells[colIdx.pinfl] ? cells[colIdx.pinfl].innerText.trim() : "";
        const regTimeStr = cells[colIdx.regTime] ? cells[colIdx.regTime].innerText.trim() : "";

        if (!lastName && !firstName) continue;

        const fullName = `${lastName} ${firstName} ${middleName}`.replace(/\s+/g, ' ').trim();
        const timestamp = parseDateTimeToTimestamp(regTimeStr);

        // XONA VA VRACH MA'LUMOTINI "ULANGAN BO'LIM" USTUNIDAN OLISH
        const roomInfo = parseUlanganBolimInfo(ulanganBolimText, doctorCellText);

        const oldP = activeQueue.find(p => p.patientId === patId || p.patientName === fullName);
        const curStatus = oldP ? oldP.status : "waiting";

        const patientObj = {
          id: `karmed_${patId || Date.now()}_${i}`,
          patientId: patId,
          patientName: fullName,
          pinfl: pinfl,
          birthDate: birthDate,
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

        patients.push(patientObj);
        attachRowCallButton(r, patientObj);
      }
    });

    if (patients.length > 0) {
      patients.sort((a, b) => a.registeredAtTimestamp - b.registeredAtTimestamp);
      activeQueue = patients;

      window.__karmedPatientsCache = patients;
      try {
        localStorage.setItem("karmed_patients_memory_cache", JSON.stringify(patients));
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ karmed_patients_memory_cache: patients });
        }
      } catch (e) {}

      updateWidgetUI();
      sendQueueToServer(patients);
    }
  } catch (err) {
    console.warn("Karmed scan error:", err);
  } finally {
    isScanning = false;
  }
}

// 7. LOKAL SERVERGA SINXRONLASH
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

// 8. BEMORNI CHAQIRISH (1 DAQIQALIK TAYMER BILAN BIRGA)
async function callPatientDirect(patient) {
  if (!isDoctorAuthorized) {
    alert("⚠️ Ushbu vrach F.I.Sh hali Admin tomonidan tasdiqlanmagan. Avval Admindan ruxsat so'rang.");
    return;
  }

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
  } catch (err) {}

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

// 9. SUZUVCHI BOSHQARUV WIDGETI (KARMED EKRANIDA)
function createFloatingWidget() {
  if (document.getElementById("uttVrachFloatingWidget")) return;

  const firstP = activeQueue[0];
  const currentRoomName = firstP ? firstP.room : "UTT 10 - 51 XONA";
  const currentDocName = firstP ? firstP.doctorName : "Xudayberdiyeva Nigora Nizamovna";

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
      <!-- 0. ADMINDAN RUXSAT SO'RASH BLOKI (AGAR VRACH RO'YXATDA BO'LMASA) -->
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
          <span id="uttAccordionIcon">▼</span>
        </div>
        <div class="utt-accordion-content" id="uttAccordionContent" style="display: none;">
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

  // Accordion ochish/yopish
  document.getElementById("uttAccordionToggle").addEventListener("click", () => {
    isAccordionOpen = !isAccordionOpen;
    const content = document.getElementById("uttAccordionContent");
    const icon = document.getElementById("uttAccordionIcon");
    content.style.display = isAccordionOpen ? "flex" : "none";
    icon.innerText = isAccordionOpen ? "▲" : "▼";
    if (isAccordionOpen) renderAccordionList();
  });

  // Qidiruv
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

  // Ruxsat holatini tekshirish
  if (!isDoctorAuthorized && detectedDoctorName) {
    if (authCard) authCard.style.display = "flex";
    if (authDocName) authDocName.innerText = `👤 ${detectedDoctorName}`;
    if (docInfoBlock) docInfoBlock.style.display = "none";
    if (btnCall) btnCall.disabled = true;
  } else {
    if (authCard) authCard.style.display = "none";
    if (docInfoBlock) docInfoBlock.style.display = "block";
    if (btnCall) btnCall.disabled = false;
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
    if (callingName) callingName.innerText = `${currentCallingPatient.patientName} (${currentCallingPatient.registeredAtStr})`;
    updateCountdownUI();
  } else {
    if (callingCard) callingCard.style.display = "none";
  }

  // 2. Keyingi kutayotgan bemor
  const nextP = activeQueue.find(p => p.status === "waiting");
  if (nextP && nextEl) {
    nextEl.innerText = `${nextP.patientName} (${nextP.registeredAtStr})`;
    if (btnCall && isDoctorAuthorized) btnCall.disabled = false;
  } else if (nextEl) {
    nextEl.innerText = "Kutayotgan bemorlar yo'q";
    if (btnCall) btnCall.disabled = true;
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
      (p.pinfl && p.pinfl.includes(searchQuery)) ||
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
          <div class="utt-pat-meta">ID: ${escapeHtml(p.patientId || '—')} • Vaqt: <b>${escapeHtml(p.registeredAtStr)}</b> • <span style="color:#facc15;">${statusLabel}</span></div>
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

// 10. KARMED JADVAL QATORIGA CHAQIRUV TUGMASINI QO'SHISH
function attachRowCallButton(row, patient) {
  if (row.querySelector(".utt-row-call-btn")) return;

  const firstCell = row.querySelector("td");
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

// 11. SUDRAB YURISH (DRAGGABLE)
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

// 12. DOM O'ZGARISHLARINI KUZATISH (DEBOUNCED)
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
