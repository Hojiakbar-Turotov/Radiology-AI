/**
 * UTT VRACH QABULI — KARMED / RADIOLOGIYA AVTOMATIK NAVBATNI O'QISH CONTENT SCRIPTI
 * Karmed jadvalidan bemorlarni "Ro'yxatga olingan vaqti" (Registration Time) bo'yicha
 * avtomatik o'qiydi, xronologik saralaydi va lokal serverga (TV ga) yuboradi.
 */

let serverUrl = "http://localhost:3000";
let selectedDoctorId = "vrach_utt_1"; // Default
let activeQueue = [];
let isScanning = false;
let widgetEl = null;
let lastSentSignature = "";
let scanDebounceTimer = null;

// Shifokorlar lug'ati (Karmed matnidan aniqlash uchun)
const DOCTOR_MAPPINGS = [
  { id: "vrach_utt_1", key: "juravlev", name: "Juravlev Igor Ivanovich", room: "UTT 1 - 53 XONA", roomNum: "53" },
  { id: "vrach_utt_2", key: "kurbanova", name: "Kurbanova Sevinch Musayevna", room: "UTT 2 - 54 XONA", roomNum: "54" },
  { id: "vrach_utt_3", key: "abidjanov", name: "Abidjanov Alisher Maxamataliyevich", room: "UTT 3 - 46 XONA", roomNum: "46" },
  { id: "vrach_utt_4", key: "ziyayeva", name: "Ziyayeva Zarina Abduganiyevna", room: "UTT 4 - 47 XONA", roomNum: "47" },
  { id: "vrach_utt_5", key: "xoshimova", name: "Xoshimova Lola Kabulovna", room: "UTT 5 - 48 XONA", roomNum: "48" },
  { id: "vrach_utt_6", key: "toirova", name: "Toirova Shaxlo Oybek qizi", room: "UTT 6 - 52 XONA", roomNum: "52" },
  { id: "vrach_utt_7", key: "asadova", name: "Asadova Dildoraxon Asatullayevna", room: "UTT 7 - 45 XONA", roomNum: "45" },
  { id: "vrach_utt_8", key: "saidbayeva", name: "Saidbayeva Zulfiya Yergeshovna", room: "UTT 8 - 49 XONA", roomNum: "49" },
  { id: "vrach_utt_9", key: "xusanova", name: "Xusanova Feruza Ikromjonovna", room: "UTT 9 - 50 XONA", roomNum: "50" },
  { id: "vrach_utt_10", key: "xudayberdiyeva", name: "Xudayberdiyeva Nigora Nizamovna", room: "UTT 10 - 51 XONA", roomNum: "51" }
];

// 1. ISHGA TUSHIRISH
(async function init() {
  await loadSettings();
  createFloatingWidget();
  startObservingTable();
  scheduleScan();
  setInterval(scheduleScan, 20000);
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

function scheduleScan() {
  if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
  scanDebounceTimer = setTimeout(scanKarmedTableAndSync, 1200);
}

// 2. SANANI UNIX TIMESTAMP GA AYLANTIRISH
function parseDateTimeToTimestamp(str) {
  if (!str) return Date.now();
  // Format: "27.08.2026 10:33" yoki "27.08.2026 08:22:15"
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

// 3. KARMED JADVALINI O'QISH VA VAQTI BO'YICHA SARALASH
function scanKarmedTableAndSync() {
  if (isScanning) return;
  isScanning = true;

  try {
    const patients = [];
    const tables = document.querySelectorAll("table");

    tables.forEach(table => {
      const rows = table.querySelectorAll("tr");
      if (rows.length < 2) return;

      // Ustun nomlarini aniqlash
      let colIdx = {
        patientId: -1,
        lastName: -1,
        firstName: -1,
        middleName: -1,
        pinfl: -1,
        birthDate: -1,
        department: -1,
        regTime: -1,
        doctor: -1
      };

      const headerCells = rows[0].querySelectorAll("th, td");
      headerCells.forEach((cell, idx) => {
        const txt = cell.innerText.toLowerCase().trim();
        if (txt.includes("familiya")) colIdx.lastName = idx;
        else if (txt.includes("ismi") && !txt.includes("ota") && !txt.includes("familiya")) colIdx.firstName = idx;
        else if (txt.includes("ota") || txt.includes("otasining")) colIdx.middleName = idx;
        else if (txt.includes("ro'yxatga") || txt.includes("royxatga") || txt.includes("sana") || txt.includes("vaqt")) colIdx.regTime = idx;
        else if (txt.includes("pinfl") || txt.includes("pnfl")) colIdx.pinfl = idx;
        else if (txt.includes("tug'ilgan") || txt.includes("tugilgan")) colIdx.birthDate = idx;
        else if (txt.includes("bo'lim") || txt.includes("bolim")) colIdx.department = idx;
        else if (txt.includes("be") || txt.includes("id") || txt.includes("bemor")) {
          if (colIdx.patientId === -1) colIdx.patientId = idx;
        }
        else if (txt.includes("ulangan") || txt.includes("xona") || txt.includes("shifokor")) colIdx.doctor = idx;
      });

      // Agar sarlavhadan topilmasa, standart Karmed ustun tartibi bo'yicha tekshirish
      if (colIdx.lastName === -1 && rows.length > 1) {
        colIdx.patientId = 1;
        colIdx.lastName = 2;
        colIdx.firstName = 3;
        colIdx.middleName = 4;
        colIdx.department = 6;
        colIdx.birthDate = 8;
        colIdx.pinfl = 9;
        colIdx.regTime = 11;
        colIdx.doctor = 13;
      }

      // Qatorlarni o'qish
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const cells = r.querySelectorAll("td");
        if (cells.length < 5) continue;

        const lastName = cells[colIdx.lastName] ? cells[colIdx.lastName].innerText.trim() : "";
        const firstName = cells[colIdx.firstName] ? cells[colIdx.firstName].innerText.trim() : "";
        const middleName = cells[colIdx.middleName] ? cells[colIdx.middleName].innerText.trim() : "";
        const patId = cells[colIdx.patientId] ? cells[colIdx.patientId].innerText.trim() : "";
        const pinfl = cells[colIdx.pinfl] ? cells[colIdx.pinfl].innerText.trim() : "";
        const birthDate = cells[colIdx.birthDate] ? cells[colIdx.birthDate].innerText.trim() : "";
        const department = cells[colIdx.department] ? cells[colIdx.department].innerText.trim() : "Ultratovush (UTT)";
        const regTimeStr = cells[colIdx.regTime] ? cells[colIdx.regTime].innerText.trim() : "";
        const doctorStr = cells[colIdx.doctor] ? cells[colIdx.doctor].innerText.trim() : "";

        if (!lastName && !firstName) continue;

        const fullName = `${lastName} ${firstName} ${middleName}`.replace(/\s+/g, ' ').trim();
        const timestamp = parseDateTimeToTimestamp(regTimeStr);

        // Vrachni aniqlash
        let docObj = DOCTOR_MAPPINGS.find(d => doctorStr.toLowerCase().includes(d.key)) ||
                     DOCTOR_MAPPINGS.find(d => d.id === selectedDoctorId) ||
                     DOCTOR_MAPPINGS[0];

        const patientObj = {
          id: `karmed_${patId || Date.now()}_${i}`,
          patientId: patId,
          patientName: fullName,
          pinfl: pinfl,
          birthDate: birthDate,
          department: department,
          service: `UTT (${department})`,
          registeredAtStr: regTimeStr || new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" }),
          registeredAtTimestamp: timestamp,
          doctorId: docObj.id,
          doctorName: docObj.name,
          room: docObj.room,
          status: "waiting"
        };

        patients.push(patientObj);
        attachRowCallButton(r, patientObj);
      }
    });

    if (patients.length > 0) {
      // Ro'yxatga olingan vaqti (registration time) bo'yicha xronologik saralash
      patients.sort((a, b) => a.registeredAtTimestamp - b.registeredAtTimestamp);
      activeQueue = patients;
      updateWidgetUI(activeQueue);
      sendQueueToServer(patients);
    }
  } catch (err) {
    console.warn("Karmed scan error:", err);
  } finally {
    isScanning = false;
  }
}

// 4. LOKAL SERVERGA SINXRONLASH (FAQAT O'ZGARISH BO'LGANDA)
async function sendQueueToServer(patients) {
  const currentSig = JSON.stringify(patients.map(p => `${p.patientId}_${p.patientName}_${p.registeredAtStr}`));
  if (currentSig === lastSentSignature) {
    return; // O'zgarish yo'q, serverni bezovta qilmaymiz
  }

  try {
    const res = await fetch(`${serverUrl}/api/queue/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patients: patients, doctorId: selectedDoctorId })
    });
    const data = await res.json();
    if (data.ok) {
      lastSentSignature = currentSig;
      console.log(`✅ ${patients.length} ta bemor Karmed'dan serverga uzatildi`);
    }
  } catch (e) {
    console.warn("Lokal serverga ulanishda xatolik (Host IP tekshiring):", e.message);
  }
}

// 5. BEMORNI CHAQIRISH (TV MONITORIDA OVOZLI CHIQADI)
async function callPatientDirect(patient) {
  try {
    const res = await fetch(`${serverUrl}/api/queue/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: patient.patientName,
        patientId: patient.patientId,
        doctorId: patient.doctorId || selectedDoctorId,
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

// 6. SUZUVCHI BOSHQARUV WIDGETI (KARMED EKRANIDA)
function createFloatingWidget() {
  if (document.getElementById("uttVrachFloatingWidget")) return;

  const doc = DOCTOR_MAPPINGS.find(d => d.id === selectedDoctorId) || DOCTOR_MAPPINGS[0];

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
        <div class="utt-doc-room" id="uttWidgetRoom">${doc.room}</div>
        <div class="utt-doc-name" id="uttWidgetDoc">${doc.name}</div>
      </div>

      <div class="utt-queue-stat">
        <span>Vaqt bo'yicha navbat: <b id="uttQueueCount">0</b> ta</span>
      </div>

      <div class="utt-next-box">
        <div class="utt-next-label">KEYINGI BEMOR (VAQTI BO'YICHA):</div>
        <div class="utt-next-name" id="uttNextPatientName">Yuklanmoqda...</div>
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
  const btnCall = document.getElementById("uttBtnCallMain");

  if (countEl) countEl.innerText = patients.length;

  const nextP = patients.find(p => p.status === "waiting") || patients[0];
  if (nextP && nextEl) {
    nextEl.innerText = `${nextP.patientName} (${nextP.registeredAtStr})`;
    if (btnCall) btnCall.disabled = false;
  } else if (nextEl) {
    nextEl.innerText = "Kutayotgan bemorlar yo'q";
    if (btnCall) btnCall.disabled = true;
  }
}

// 7. KARMED QATORIGA CHAQIRUV TUGMASINI QO'SHISH
function attachRowCallButton(row, patient) {
  if (row.querySelector(".utt-row-call-btn")) return;

  const firstCell = row.querySelector("td");
  if (!firstCell) return;

  const btn = document.createElement("button");
  btn.className = "utt-row-call-btn";
  btn.title = "TV da ovozli chaqirish";
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

// 8. SUDRAB YURISH (DRAGGABLE)
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

// 9. DOM O'ZGARISHLARINI KUZATISH (DEBOUNCED)
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
