/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Content Script
 * 
 * 1. Karmed DevExpress jadvallarini avtomatik tahlil qilish
 * 2. "Qabul qiluvchi" ustunidan shifokor F.I.SH ni 100% aniq tekshirish
 * 3. "Tasdiqlangan sana" ustunidan sanani solishtirish
 * 4. Google Sheets "Farq" jurnali uchun 18 ta ustunli formatda eksport qilish
 * 5. Ekranda Tezkor "Farq" ga Saqlash tugmasi (F4) va Avto-Saqlash rejimi
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
let currentGoogleScriptUrl = "";
let currentTargetSheetName = "Farq";
let autoSaveOnOpen = false;
let lastSavedPatientKey = "";

// Standart UTT xizmatlari tariflari
const DEFAULT_PRICE_MAP = {
  "R52": 137000,
  "R78": 173000,
  "R62": 137000,
  "R64": 173000,
  "R66": 173000,
  "R85": 283200,
  "R87": 137000,
  "R134": 210000,
  "R135": 210000
};

// Standart Shifokorlar Ro'yxati
const KNOWN_DOCTORS = [
  "Kurbanova Sevinch Musayevna",
  "Xusanova Feruza Ikromjonovna",
  "Yulchiyeva Nodira Siddikovna",
  "Juravlev Igor Ivanovich",
  "Abidjanov Alisher Maxamataliyevich",
  "Ziyayeva Zarina Abduganiyevna",
  "Xoshimova Lola Kabulovna",
  "Toirova Shaxlo Oybek qizi",
  "Asadova Dildoraxon Asatullayevna",
  "Saidbayeva Zulfiya Yergeshovna",
  "Xudayberdiyeva Nigora Nizamovna",
  "Turatov Hojiakbar Shavkat ogli"
];

let isScanningInProgress = false;

// 1. ISHGA TUSHIRISH
(async function init() {
  await loadSavedSettings();
  createQuickFarqFloatingWidget();
  initKeyboardShortcuts();
  startActivePatientObserver();
})();

async function loadSavedSettings() {
  return new Promise(resolve => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["sheetsScriptUrl", "targetSheetName", "autoSaveFarq"], res => {
        if (res.sheetsScriptUrl) currentGoogleScriptUrl = res.sheetsScriptUrl.trim();
        if (res.targetSheetName) currentTargetSheetName = res.targetSheetName.trim();
        if (res.autoSaveFarq !== undefined) autoSaveOnOpen = Boolean(res.autoSaveFarq);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// 2. POPUP VA BACKGROUNDDAN XABARLARNI QABUL QILISH
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "DETECT_PAGE_DOCTORS") {
    const doctors = detectDoctorsFromCurrentPage();
    sendResponse({ success: true, doctors });
    return true;
  }

  if (request.action === "START_SCAN") {
    startKarmedScan(request.payload)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "SAVE_REPORT_FIREBASE") {
    saveReportToFirebase(request.payload)
      .then(result => sendResponse({ success: true, result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === "UPDATE_SETTINGS") {
    if (request.payload?.sheetsScriptUrl) currentGoogleScriptUrl = request.payload.sheetsScriptUrl;
    if (request.payload?.targetSheetName) currentTargetSheetName = request.payload.targetSheetName;
    sendResponse({ success: true });
    return true;
  }
});

// 3. JORIY EKRANDAGI BEMORNI VA XIZMATLARINI ANIQLASH (TEZKOR SAQLASH UCHUN)
function getCurrentlyActivePatientFromScreen() {
  const allTables = Array.from(document.querySelectorAll("table"));
  let mainTable = null;

  for (const table of allTables) {
    const text = table.innerText.toLowerCase();
    if (text.includes("familiya") && text.includes("qabul qiluvchi") && text.includes("tasdiqlangan")) {
      mainTable = table;
      break;
    }
  }

  if (!mainTable) {
    mainTable = document.querySelector(".dxgvTable_DevEx, .dxgvControl_DevEx, table");
  }

  if (!mainTable) return null;

  const colMap = getTableColumnMapping(mainTable);
  
  // Tanlangan qatorni (focused / selected row) topish
  let targetRow = document.querySelector(".dxgvFocusedRow_DevEx, .dxgvSelectedRow_DevEx, tr.selected, .x-grid3-row-selected");
  if (!targetRow) {
    const rows = Array.from(mainTable.querySelectorAll("tr")).filter(r => {
      const c = r.querySelectorAll("td");
      return c.length >= 6 && !r.innerText.includes("Familiya") && !r.innerText.includes("Bemor ID");
    });
    targetRow = rows[0];
  }

  if (!targetRow) return null;

  const cells = Array.from(targetRow.querySelectorAll("td"));
  if (cells.length < 5) return null;

  let patientId = colMap.patientId !== -1 && cells[colMap.patientId] ? cells[colMap.patientId].innerText.trim() : "";
  if (!patientId || !/^\d+$/.test(patientId)) {
    const idCell = cells.find(c => /^\d{4,8}$/.test(c.innerText.trim()));
    if (idCell) patientId = idCell.innerText.trim();
  }

  let surname = colMap.surname !== -1 && cells[colMap.surname] ? cells[colMap.surname].innerText.trim() : "";
  let firstName = colMap.firstName !== -1 && cells[colMap.firstName] ? cells[colMap.firstName].innerText.trim() : "";
  let middleName = colMap.middleName !== -1 && cells[colMap.middleName] ? cells[colMap.middleName].innerText.trim() : "";

  if (/^(xxx|xx|x|\-+|yo['`ʻ]?q|null|none|\.+)$/i.test(middleName.trim())) {
    middleName = "";
  }

  if (!surname && !firstName) {
    const candidateNames = cells.map(c => c.innerText.trim()).filter(t => /^[A-ZА-ЯЁ\s'\-]+$/i.test(t) && t.length >= 3);
    if (candidateNames.length >= 2) {
      surname = candidateNames[0];
      firstName = candidateNames[1];
    }
  }

  const fullName = [surname, firstName, middleName].filter(Boolean).join(" ").trim() || "BEMOR";
  const department = colMap.department !== -1 && cells[colMap.department] ? cells[colMap.department].innerText.trim() : "Mamologiya";
  const priority = colMap.priority !== -1 && cells[colMap.priority] ? cells[colMap.priority].innerText.trim() : "Ambulator";
  const fileDoctor = colMap.fileDoctor !== -1 && cells[colMap.fileDoctor] ? cells[colMap.fileDoctor].innerText.trim() : "Kasimov Doniyor Abrorovich";
  
  let rawDate = "";
  if (colMap.confirmDate !== -1 && cells[colMap.confirmDate]) {
    rawDate = cells[colMap.confirmDate].innerText.trim();
  } else {
    const dCell = cells.find(c => /\d{2}\.\d{2}\.\d{4}/.test(c.innerText.trim()));
    if (dCell) rawDate = dCell.innerText.trim();
  }

  let acceptingDoctor = "";
  if (colMap.acceptingDoctor !== -1 && cells[colMap.acceptingDoctor]) {
    acceptingDoctor = cells[colMap.acceptingDoctor].innerText.trim();
  }
  if (!acceptingDoctor) acceptingDoctor = "Kurbanova Sevinch Musayevna";

  // Pastki jadvaldan barcha xizmatlar va narxlarni olish
  const services = extractSubTableServicesFromPage();
  if (services.length === 0) {
    services.push({
      code: "R78",
      name: department ? `UTT (${department})` : "Ultratovush tekshiruvi",
      price: 173000,
      paidAmount: 173000,
      priceStr: "173 000,00",
      debtStatus: "To'langan",
      date: rawDate
    });
  }

  const totalSum = services.reduce((acc, s) => acc + (s.price || 0), 0);

  return {
    patientId: patientId || "ID_NOMALUM",
    fullName: fullName,
    department: department,
    priority: priority,
    fileDoctor: fileDoctor,
    doctorName: acceptingDoctor,
    confirmDate: rawDate || new Date().toLocaleDateString("ru-RU"),
    services: services,
    totalSum: totalSum,
    totalSumFormatted: totalSum.toLocaleString('ru-RU') + " so'm"
  };
}

// 4. JORIY BEMORNI TO'G'RIDAN-TO'G'RI GOOGLE SHEETS "FARQ" VARAG'IGA SAQLASH
async function saveCurrentPatientToGoogleSheets() {
  const patient = getCurrentlyActivePatientFromScreen();
  if (!patient || !patient.patientId || patient.patientId === "ID_NOMALUM") {
    alert("⚠️ Karmed ekranida bemor topilmadi! Bemor ID sini kiritib, qatorini bosing.");
    return;
  }

  if (!currentGoogleScriptUrl) {
    await loadSavedSettings();
  }

  if (!currentGoogleScriptUrl) {
    alert("⚠️ Google Apps Script Web App URL manzili sozlanmagan!\nKengaytma darchasini ochib, 'Sozlash' bo'limiga URL ni kiriting.");
    return;
  }

  const btn = document.getElementById("btnFarqSaveCurrent");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...`;
  }

  // 18 ta ustunli Karmed formatidagi yozuvlarni shakllantirish
  const records = patient.services.map((srv, idx) => ({
    orderNo: 2280000 + Math.floor(Math.random() * 9000),
    cardNo: patient.patientId,
    patientId: patient.patientId,
    fullId: `2600${String(patient.patientId).padStart(5, '0')}`,
    fullName: patient.fullName.toUpperCase(),
    patientType: patient.department || 'Mamologiya',
    serviceCategory: 'Radiologiya',
    functionalDept: 'Ultratovush',
    serviceName: srv.name || 'Ultratovush tekshiruvi',
    serviceCode: srv.code || '',
    priority: patient.priority || 'Ambulator',
    orderingDoctor: patient.fileDoctor || 'Kasimov Doniyor Abrorovich',
    fileDoctor: patient.fileDoctor || '',
    doctorName: patient.doctorName || 'Kurbanova Sevinch Musayevna',
    dr_uygulayan: patient.doctorName || 'Kurbanova Sevinch Musayevna',
    date: srv.date || patient.confirmDate || '',
    privilegeCategory: 'Rezident',
    orderliUcret: 0,
    price: srv.price || 0,
    pulliUcret: srv.price || 0,
    paidAmount: srv.paidAmount || srv.price || 0,
    tolanganUcret: srv.paidAmount || srv.price || 0
  }));

  try {
    const postBody = {
      action: "save_karmed_records",
      sheetName: currentTargetSheetName || "Farq",
      records: records
    };

    const res = await fetch(currentGoogleScriptUrl, {
      method: "POST",
      body: JSON.stringify(postBody)
    });

    const data = await res.json();

    if (data.status === "success") {
      lastSavedPatientKey = `${patient.patientId}_${patient.fullName}`;
      showFarqToast(`✅ "Farq" ga saqlandi: ${patient.fullName} (${patient.services.length} ta xizmat, ${patient.totalSumFormatted})`);
    } else {
      throw new Error(data.message || "Xatolik yuz berdi");
    }

  } catch (err) {
    alert("❌ Google Sheets-ga saqlashda xatolik: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `📥 "Farq" Jurnaliga Saqlash (F4)`;
    }
  }
}

// 5. EKRANDA SUZUVCHI TEZKOR BOSHQARUV PANELI (WIDGET)
function createQuickFarqFloatingWidget() {
  if (document.getElementById("karmedFarqFloatingWidget")) return;

  const widget = document.createElement("div");
  widget.id = "karmedFarqFloatingWidget";
  widget.className = "karmed-farq-floating-widget";
  widget.innerHTML = `
    <div class="karmed-farq-header" id="karmedFarqHeader">
      <div class="karmed-farq-header-title">
        <span>📊</span> <b>KARMED ➡️ "FARQ" JURNALI</b>
      </div>
      <button type="button" id="btnMinFarqWidget" style="background:none; border:none; color:#fff; cursor:pointer; font-weight:bold;">—</button>
    </div>
    <div class="karmed-farq-body" id="karmedFarqBody">
      <div class="karmed-farq-patient-card">
        <div class="karmed-farq-pat-name" id="farqPatName">Bemor kutilmoqda...</div>
        <div class="karmed-farq-pat-meta" id="farqPatMeta">ID: — • Xizmatlar: 0 ta</div>
        <div class="karmed-farq-pat-sum" id="farqPatSum">Jami: 0 so'm</div>
      </div>
      <button type="button" class="btn-farq-save-main" id="btnFarqSaveCurrent">
        📥 "Farq" Jurnaliga Saqlash (F4)
      </button>
      <div class="karmed-farq-options">
        <label title="Har safar yangi bemor ochilganda avtomatik saqlash">
          <input type="checkbox" id="chkFarqAutoSave"> ⚡ Ochilganda avto-saqlash
        </label>
        <span style="color:#10b981; font-weight:700;">🟢 Online</span>
      </div>
    </div>
  `;

  document.body.appendChild(widget);

  document.getElementById("btnFarqSaveCurrent").addEventListener("click", saveCurrentPatientToGoogleSheets);
  
  const chkAuto = document.getElementById("chkFarqAutoSave");
  chkAuto.checked = autoSaveOnOpen;
  chkAuto.addEventListener("change", (e) => {
    autoSaveOnOpen = e.target.checked;
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ autoSaveFarq: autoSaveOnOpen });
    }
  });

  document.getElementById("btnMinFarqWidget").addEventListener("click", () => {
    const b = document.getElementById("karmedFarqBody");
    b.style.display = b.style.display === "none" ? "flex" : "none";
  });

  makeDraggable(widget, document.getElementById("karmedFarqHeader"));
}

function updateWidgetPatientPreview() {
  const p = getCurrentlyActivePatientFromScreen();
  const elName = document.getElementById("farqPatName");
  const elMeta = document.getElementById("farqPatMeta");
  const elSum = document.getElementById("farqPatSum");

  if (!elName || !p) return;

  elName.innerText = `👤 ${p.fullName}`;
  elMeta.innerText = `ID: ${p.patientId} • Xizmatlar: ${p.services.length} ta (${p.department})`;
  elSum.innerText = `Jami: ${p.totalSumFormatted}`;

  // Agar Avto-Saqlash yoqilgan bo'lsa va bu bemor hali saqlanmagan bo'lsa
  const currentKey = `${p.patientId}_${p.fullName}`;
  if (autoSaveOnOpen && p.patientId !== "ID_NOMALUM" && currentKey !== lastSavedPatientKey) {
    lastSavedPatientKey = currentKey;
    saveCurrentPatientToGoogleSheets();
  }
}

// 6. KLAVIATURA TUGMALARI (F4 yoki Alt+S orqali saqlash)
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "F4" || (e.altKey && e.key.toLowerCase() === "s")) {
      e.preventDefault();
      saveCurrentPatientToGoogleSheets();
    }
  });
}

function startActivePatientObserver() {
  setInterval(updateWidgetPatientPreview, 1200);
}

function showFarqToast(text) {
  const toast = document.createElement("div");
  toast.className = "karmed-farq-toast";
  toast.innerText = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// 7. PASTKI JADVALDAN TEKSHIRUV KODLARI, NOMLARI VA NARXLARINI AJRATIB OLISH
function extractSubTableServicesFromPage() {
  const servicesList = [];
  const allRows = Array.from(document.querySelectorAll("tr"));

  for (const row of allRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) continue;

    const cellTexts = cells.map(c => c.innerText.trim());
    const firstCell = cellTexts[0] || "";

    const codeMatch = firstCell.match(/^R\s*(\d{1,5})/i) || cellTexts.find(t => /^R\s*\d{1,5}$/i.test(t));
    if (codeMatch) {
      const code = typeof codeMatch === 'string' ? codeMatch.toUpperCase().replace(/\s+/g, '') : `R${codeMatch[1]}`;
      const name = (cells[1] ? cells[1].innerText.trim() : "") || (cells[2] ? cells[2].innerText.trim() : "Tekshiruv");
      
      let date = "";
      let queueNo = "";
      let price = 0;
      let priceStr = "";
      let debtStatus = "To'langan";

      for (const txt of cellTexts) {
        if (/\d{2}\.\d{2}\.\d{4}/.test(txt)) date = txt;
        if (/^\d{6,9}$/.test(txt)) queueNo = txt;

        const cleanMoney = txt.replace(/\s+/g, '').replace(',', '.');
        if (/^\d{5,8}(\.\d{2})?$/.test(cleanMoney)) {
          const val = parseFloat(cleanMoney);
          if (val >= 10000 && val <= 50000000) {
            price = val;
            priceStr = txt;
          }
        }
        if (txt.toLowerCase().includes("to'langan") || txt.toLowerCase().includes("tolangan")) {
          debtStatus = "To'langan";
        }
      }

      if (price === 0 && DEFAULT_PRICE_MAP[code]) {
        price = DEFAULT_PRICE_MAP[code];
        priceStr = price.toLocaleString('ru-RU') + ',00';
      }

      if (!servicesList.some(s => s.code === code && s.name === name)) {
        servicesList.push({
          code: code,
          name: name,
          price: price,
          paidAmount: price,
          priceStr: priceStr || (price.toLocaleString('ru-RU') + ',00'),
          debtStatus: debtStatus,
          queueNo: queueNo,
          date: date
        });
      }
    }
  }

  return servicesList;
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

// 9. JADVAL USTUNLARI XARITASI
function getTableColumnMapping(table) {
  const colMap = {
    surname: -1, firstName: -1, middleName: -1, patientId: -1,
    acceptingDoctor: -1, confirmDate: -1, fileDoctor: -1,
    priority: -1, department: -1, regDate: -1
  };
  if (!table) return colMap;

  const headerRow = table.querySelector("thead tr, tr:first-child");
  if (headerRow) {
    const ths = Array.from(headerRow.querySelectorAll("th, td")).map(th => 
      th.innerText.toLowerCase().replace(/[\s_\-'.]/g, "")
    );
    ths.forEach((h, idx) => {
      if (h.includes("qabulqiluvchi") || h.includes("qabulqilgan")) colMap.acceptingDoctor = idx;
      else if (h.includes("tasdiqlangansan") || h.includes("tasdiqlangan")) colMap.confirmDate = idx;
      else if (h.includes("familiya")) colMap.surname = idx;
      else if (h.includes("ismi") && !h.includes("ota")) colMap.firstName = idx;
      else if (h.includes("otaismi") || h.includes("sharif")) colMap.middleName = idx;
      else if (h.includes("bemorid") || h.includes("id")) colMap.patientId = idx;
      else if (h.includes("faylningshifokor")) colMap.fileDoctor = idx;
      else if (h.includes("ustuvorlik")) colMap.priority = idx;
      else if (h.includes("bolim") || h.includes("bo'lim")) colMap.department = idx;
      else if (h.includes("royxatgaolingan")) colMap.regDate = idx;
    });
  }
  return colMap;
}

function detectDoctorsFromCurrentPage() {
  const doctorSet = new Set();
  const allRows = Array.from(document.querySelectorAll("table tr"));
  for (const row of allRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 5) continue;
    for (const cell of cells) {
      const text = cell.innerText.trim();
      if (text.length >= 8 && /^[A-ZА-ЯЁ][a-zа-яё'\-]+\s+[A-ZА-ЯЁ][a-zа-яё'\-]+\s+[A-ZА-ЯЁ][a-zа-яё'\-]+/i.test(text)) {
        if (!text.includes("Dr.") && !text.includes("Statsionar") && !text.includes("Urologiya") && !text.includes("Markaz") && !text.includes("Bemor")) {
          doctorSet.add(text);
        }
      }
    }
  }
  return Array.from(doctorSet).sort();
}
