/**
 * UTT VRACH QABULI — KARMED / RADIOLOGIYA AVTOMATIK NAVBATNI O'QISH CONTENT SCRIPTI
 * Karmed jadvalidan:
 * 1. Xona va Vrach ma'lumotlarini "Ulangan bo'lim" ustunidan (masalan: Ultratovush-10(Xudayberdiyeva Nigora)) oladi.
 * 2. Jadvaldagi barcha bemorlar ro'yxatini vaqtinchalik xotiraga (Memory Cache) tuzib oladi.
 * 3. Ro'yxatga olingan vaqti bo'yicha xronologik saralab, TV monitoriga uzatadi.
 */

let serverUrl = "http://localhost:3000";
let selectedDoctorId = "vrach_utt_10"; // Default fallback
let activeQueue = [];
let isScanning = false;
let widgetEl = null;
let lastSentSignature = "";
let scanDebounceTimer = null;

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
  scheduleScan();
  setInterval(scheduleScan, 15000);
})();

async function loadSettings() {
  return new Promise(resolve => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["serverUrl", "selectedDoctorId"], res => {
        if (res.serverUrl) serverUrl = res.serverUrl.replace(/\/+$/, "");
        if (res.selectedDoctorId) selectedDoctorId = res.selectedDoctorId;
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

// 2. "ULANGAN BO'LIM" USTUNIDAN XONA VA VRACHNI ANIQLASH (MASALAN: "Ultratovush-10(Xudayberdiyeva Nigora)")
function parseUlanganBolimInfo(ulanganBolimStr, fallbackDoctorStr = "") {
  const combined = `${ulanganBolimStr || ''} ${fallbackDoctorStr || ''}`.trim();
  if (!combined) {
    const def = DOCTOR_MAPPINGS.find(d => d.id === selectedDoctorId) || DOCTOR_MAPPINGS[0];
    return {
      doctorId: def.id,
      doctorName: def.name,
      room: def.room,
      roomNum: def.roomNum,
      rawBolim: ulanganBolimStr || ""
    };
  }

  // 1. Ultratovush raqamini qidirish (masalan: "Ultratovush-10", "Ultratovush 5", "UTT-2")
  const numMatch = combined.match(/ultratovush\s*[-–—:]*\s*(\d+)/i) || combined.match(/utt\s*[-–—:]*\s*(\d+)/i);
  let uttNumber = numMatch ? parseInt(numMatch[1], 10) : null;

  // 2. Qavs ichidagi ismni olish (masalan: "(Xudayberdiyeva Nigora Nizamovna)")
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

  // Lug'atda bo'lmasa, o'qilgan matndan to'g'ridan-to'g'ri shakllantirish
  return {
    doctorId: uttNumber ? `vrach_utt_${uttNumber}` : (selectedDoctorId || "vrach_utt_1"),
    doctorName: parsedName || fallbackDoctorStr || "UTT Shifokori",
    room: uttNumber ? `UTT ${uttNumber} XONA` : "UTT XONASI",
    roomNum: uttNumber ? String(uttNumber) : "",
    rawBolim: ulanganBolimStr || ""
  };
}

// 3. SANANI UNIX TIMESTAMP GA AYLANTIRISH
function parseDateTimeToTimestamp(str) {
  if (!str) return Date.now();
  // Format: "27.08.2026 10:54:06" yoki "27.08.2026 10:33"
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

// 4. KARMED JADVALINI TO'LIQ O'QISH, VAQTINCHALIK XOTIRAGA SAQLASH VA TARTIBLASH
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

      // Standart Karmed tartibi bo'yicha zaxira indekslar (Screenshot asosida: 1=Shifokor, 2=Ulangan bo'lim, 3=Bemor ID, 4=Familiya, 5=Ism, 6=Ota ismi, 8=Bo'lim, 10=Tug'ilgan kuni, 11=PINFL, 13=Vaqt)
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
          status: "waiting"
        };

        patients.push(patientObj);
        attachRowCallButton(r, patientObj);
      }
    });

    if (patients.length > 0) {
      // 1. RO'YXATGA OLINGAN VAQTI BO'YICHA XRONOLOGIK SARALASH
      patients.sort((a, b) => a.registeredAtTimestamp - b.registeredAtTimestamp);
      activeQueue = patients;

      // 2. VAQTINCHALIK XOTIRAGA (MEMORY CACHE) TUZIB OLISH
      window.__karmedPatientsCache = patients;
      try {
        localStorage.setItem("karmed_patients_memory_cache", JSON.stringify(patients));
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ karmed_patients_memory_cache: patients });
        }
      } catch (e) {}

      // 3. WIDGET VA SERVERNI YANGILASH
      updateWidgetUI(activeQueue);
      sendQueueToServer(patients);
    }
  } catch (err) {
    console.warn("Karmed scan error:", err);
  } finally {
    isScanning = false;
  }
}

// 5. LOKAL SERVERGA SINXRONLASH (FAQAT O'ZGARISH BO'LGANDA)
async function sendQueueToServer(patients) {
  const currentSig = JSON.stringify(patients.map(p => `${p.patientId}_${p.patientName}_${p.registeredAtStr}_${p.room}`));
  if (currentSig === lastSentSignature) {
    return; // Ma'lumot o'zgarmagan
  }

  // Birinchi bemorning xonasidan vrach ID sini olish
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
      console.log(`✅ ${patients.length} ta bemor "Ulangan bo'lim" xonasi bilan serverga uzatildi`);
    }
  } catch (e) {
    console.warn("Lokal serverga ulanishda xatolik (Host IP tekshiring):", e.message);
  }
}

// 6. BEMORNI CHAQIRISH (TV MONITORIDA OVOZLI CHIQADI)
async function callPatientDirect(patient) {
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
    alert("Serverga chaqiruv yuborishda xatolik: " + err.message);
  }
}

// 7. SUZUVCHI BOSHQARUV WIDGETI (KARMED EKRANIDA)
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
      <button class="utt-btn-min" id="uttBtnMin" title="Kichraytirish">—</button>
    </div>

    <div class="utt-widget-body" id="uttWidgetBody">
      <div class="utt-doc-info">
        <div class="utt-doc-room" id="uttWidgetRoom">${currentRoomName}</div>
        <div class="utt-doc-name" id="uttWidgetDoc">${currentDocName}</div>
      </div>

      <div class="utt-queue-stat">
        <span>Xotiradagi bemorlar: <b id="uttQueueCount">${activeQueue.length}</b> ta</span>
      </div>

      <div class="utt-next-box">
        <div class="utt-next-label">KEYINGI BEMOR (VAQTI BO'YICHA):</div>
        <div class="utt-next-name" id="uttNextPatientName">${firstP ? `${firstP.patientName} (${firstP.registeredAtStr})` : 'Yuklanmoqda...'}</div>
      </div>

      <button class="utt-btn-call-main" id="uttBtnCallMain">
        📢 KEYINGI BEMORNI CHAQIRISH
      </button>

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

  document.getElementById("uttBtnRescan").addEventListener("click", () => {
    scanKarmedTableAndSync();
  });

  document.getElementById("uttBtnMin").addEventListener("click", () => {
    const body = document.getElementById("uttWidgetBody");
    body.style.display = body.style.display === "none" ? "block" : "none";
  });

  makeDraggable(widgetEl, document.getElementById("uttWidgetHeader"));
}

function updateWidgetUI(patients) {
  const countEl = document.getElementById("uttQueueCount");
  const nextEl = document.getElementById("uttNextPatientName");
  const roomEl = document.getElementById("uttWidgetRoom");
  const docEl = document.getElementById("uttWidgetDoc");
  const btnCall = document.getElementById("uttBtnCallMain");

  if (countEl) countEl.innerText = patients.length;

  const nextP = patients.find(p => p.status === "waiting") || patients[0];
  if (nextP) {
    if (nextEl) nextEl.innerText = `${nextP.patientName} (${nextP.registeredAtStr})`;
    if (roomEl) roomEl.innerText = nextP.room;
    if (docEl) docEl.innerText = nextP.doctorName;
    if (btnCall) btnCall.disabled = false;
  } else if (nextEl) {
    nextEl.innerText = "Kutayotgan bemorlar yo'q";
    if (btnCall) btnCall.disabled = true;
  }
}

// 8. KARMED QATORIGA CHAQIRUV TUGMASINI QO'SHISH
function attachRowCallButton(row, patient) {
  if (row.querySelector(".utt-row-call-btn")) return;

  const firstCell = row.querySelector("td");
  if (!firstCell) return;

  const btn = document.createElement("button");
  btn.className = "utt-row-call-btn";
  btn.title = `TV da chaqirish (${patient.room})`;
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

// 9. SUDRAB YURISH (DRAGGABLE)
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

// 10. DOM O'ZGARISHLARINI KUZATISH (DEBOUNCED)
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
