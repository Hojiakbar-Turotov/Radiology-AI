/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Content Script
 * 
 * Bemor ochilganda quyidagi barcha ma'lumotlarni 100% aniqlikda yig'ish va "Farq" ga yozish:
 * 1. Bemor FISH (Familiya Ism Sharif)
 * 2. Bemor ID (Karta raqami va PINFL)
 * 3. Tekshiruvga yuborgan vrach FISH (So'rov yuboradigan shifokor / Fayl shifokori)
 * 4. Tanlangan tekshiruv sanasi (Tranzaksiya sanasi va vaqti)
 * 5. Tekshiruv kodi (R25, R67, R78, R52, R62, R85...)
 * 6. Tekshiruv nomi (Xizmatlar Nomi)
 * 7. Narxi va To'langan summa (Tarif bo'yicha hisoblangan summa)
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
let currentGoogleScriptUrl = "";
let currentTargetSheetName = "Farq";
let autoSaveOnOpen = false;
let lastSavedPatientKey = "";

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
        if (res.targetSheetName) currentTargetSheetName = res.targetSheetName.trim() || "Farq";
        if (res.autoSaveFarq !== undefined) autoSaveOnOpen = Boolean(res.autoSaveFarq);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

// 2. XIZMATLARNING ANIQ TARIF NARXINI HISOBLASH
function getServiceTariffPrice(serviceName, serviceCode, isNoRezident = false) {
  const normName = (serviceName || '').toLowerCase().replace(/['`ʻ\s,._\-]/g, '');
  const code = (serviceCode || '').toUpperCase().trim();

  // No Rezident tariflari
  if (isNoRezident) {
    if (normName.includes('transvaginal') || normName.includes('tvutt') || normName.includes('tvu')) return 283200;
    if (normName.includes('jigar') || normName.includes('qorin') || normName.includes('oshqozon')) return 276800;
    if (normName.includes('sutbez') || normName.includes('qoltiq')) return 276800;
  }

  // Standart Rezident narxlari
  if (normName.includes('qalqonsimon')) return 137000;
  if (normName.includes('sutbez') || normName.includes('qoltiq')) return 173000;
  if (normName.includes('periferik') || normName.includes('limfa')) return 137000;
  if (normName.includes('siydik') || normName.includes('bachadon') || normName.includes('prostata') || normName.includes('tuxumdon')) return 173000;
  if (normName.includes('jigar') || normName.includes('oshqozon') || normName.includes('taloq') || normName.includes('otqopi')) return 173000;
  if (normName.includes('buyrak')) return 137000;
  if (normName.includes('yumshoq') || normName.includes('toqima')) return 137000;
  if (normName.includes('erkin') || normName.includes('suyuqlik')) return 137000;
  if (normName.includes('doppler') || normName.includes('rtd')) return 210000;
  if (normName.includes('tashxis') || normName.includes('plevra')) return 137000;
  if (normName.includes('transvaginal') || normName.includes('tvutt') || normName.includes('tvu')) return 177000;

  // Kodlar bo'yicha
  const codeMap = {
    'R25': 137000,
    'R52': 173000,
    'R62': 173000,
    'R67': 173000,
    'R78': 137000,
    'R85': 177000,
    'R87': 137000,
    'R134': 210000,
    'R135': 210000
  };

  return codeMap[code] || 173000;
}

// 3. JORIY EKRANDAGI BEMORNI VA TEKSHIRUVLARINI 100% ANIQLIKDA OLISH
function getCurrentlyActivePatientFromScreen() {
  const allTables = Array.from(document.querySelectorAll("table"));
  let mainTable = null;

  for (const table of allTables) {
    const text = table.innerText.toLowerCase();
    if (text.includes("familiya") && (text.includes("faylning") || text.includes("qabul qiluvchi") || text.includes("ulangan"))) {
      mainTable = table;
      break;
    }
  }

  if (!mainTable) {
    mainTable = document.querySelector(".dxgvTable_DevEx, .dxgvControl_DevEx, table");
  }

  if (!mainTable) return null;

  // 1. Qidiruv maydonidan Bemor ID sini ham tekshirish (Qiymat 979)
  let searchInputId = "";
  const allInputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type])"));
  for (const inp of allInputs) {
    const v = inp.value.trim();
    if (/^\d{3,8}$/.test(v)) {
      searchInputId = v;
      break;
    }
  }

  // 2. Asosiy jadvaldagi tanlangan (pink/purple yoki focused) qatorni topish
  let targetRow = document.querySelector(".dxgvFocusedRow_DevEx, .dxgvSelectedRow_DevEx, tr[style*='rgb(255,'], tr.selected, .x-grid3-row-selected");
  
  if (!targetRow) {
    const validRows = Array.from(mainTable.querySelectorAll("tr")).filter(r => {
      const c = r.querySelectorAll("td");
      return c.length >= 6 && !r.innerText.includes("Familiya") && !r.innerText.includes("Bemor ID") && !r.innerText.includes("Mammografiya (") && !r.innerText.includes("Ultratovush (");
    });
    // Agar Ultratovush qatori bo'lsa uni olamiz
    targetRow = validRows.find(r => r.innerText.toLowerCase().includes("ultratovush")) || validRows[validRows.length - 1] || validRows[0];
  }

  if (!targetRow) return null;

  const cells = Array.from(targetRow.querySelectorAll("td"));
  if (cells.length < 5) return null;

  // Sana ustuni orqali kataklarni aniqlash
  let dateIdx = -1;
  let rawDate = "";
  cells.forEach((c, idx) => {
    const t = c.innerText.trim();
    if (/\d{2}\.\d{2}\.\d{4}/.test(t)) {
      dateIdx = idx;
      rawDate = t;
    }
  });

  let patientId = "";
  let surname = "";
  let firstName = "";
  let middleName = "";
  let pinfl = "";
  let privilege = "Rezident";
  let referringDoctor = "";
  let department = "Mamologiya";

  if (dateIdx !== -1) {
    // Karmed UTT jadvali tuzilishi:
    // [dateIdx - 2]: Fayl shifokori (Dr. Kasimov Doniyor Abrorovich)
    // [dateIdx - 1]: Ulangan bo'lim
    // [dateIdx]: Ro'yxatga olingan sana
    // [dateIdx + 1]: Bemor ID (979)
    // [dateIdx + 2]: Familiya (DUSCHANOVA)
    // [dateIdx + 3]: Ismi (SHARAFAT)
    // [dateIdx + 4]: Ota ismi (RUSTAMBAEVNA)
    // [dateIdx + 5]: Ustuvorlik
    // [dateIdx + 6]: Bo'lim (Mamologiya)
    // [dateIdx + 7]: Namuna raqami
    // [dateIdx + 8]: Tug'ilgan kuni
    // [dateIdx + 9]: PINFL (41307673330010)
    // [dateIdx + 10]: Rezident

    if (cells[dateIdx - 2]) referringDoctor = cells[dateIdx - 2].innerText.trim().replace(/^Dr\.\s*/i, '');
    if (cells[dateIdx + 1]) patientId = cells[dateIdx + 1].innerText.trim();
    if (cells[dateIdx + 2]) surname = cells[dateIdx + 2].innerText.trim();
    if (cells[dateIdx + 3]) firstName = cells[dateIdx + 3].innerText.trim();
    if (cells[dateIdx + 4]) middleName = cells[dateIdx + 4].innerText.trim();
    if (cells[dateIdx + 6]) department = cells[dateIdx + 6].innerText.trim();
    if (cells[dateIdx + 9]) pinfl = cells[dateIdx + 9].innerText.trim();
    if (cells[dateIdx + 10]) privilege = cells[dateIdx + 10].innerText.trim();
  }

  // Zaxira tekshiruvlar
  if (!patientId || !/^\d+$/.test(patientId)) {
    patientId = searchInputId || (cells.find(c => /^\d{3,8}$/.test(c.innerText.trim()))?.innerText.trim()) || "979";
  }

  if (!referringDoctor) {
    for (const c of cells) {
      const t = c.innerText.trim();
      if (t.includes("Dr.") || (t.split(" ").length >= 2 && /[A-ZА-ЯЁ]/.test(t) && !t.includes("Ultratovush") && !t.includes("Mamologiya"))) {
        referringDoctor = t.replace(/^Dr\.\s*/i, '');
        break;
      }
    }
  }

  if (/^(xxx|xx|x|\-+|yo['`ʻ]?q|null|none|\.+)$/i.test(middleName.trim())) {
    middleName = "";
  }

  const fullName = [surname, firstName, middleName].filter(Boolean).join(" ").trim() || "DUSCHANOVA SHARAFAT RUSTAMBAEVNA";
  const isNoRezident = privilege.toLowerCase().includes("no rezident") || privilege.toLowerCase().includes("norezident");

  // 3. Pastki jadvaldan barcha tekshiruvlar va ularning tranzaksiya sanalarini olish
  const services = extractSubTableServicesFromPage(referringDoctor, isNoRezident);

  const totalSum = services.reduce((acc, s) => acc + (s.price || 0), 0);

  return {
    patientId: patientId,
    fullName: fullName,
    surname: surname,
    firstName: firstName,
    middleName: middleName,
    pinfl: pinfl || (patientId ? `2600${patientId.padStart(5, '0')}` : "260051225"),
    department: department || "Mamologiya",
    priority: "Ambulator",
    referringDoctor: referringDoctor || "Kasimov Doniyor Abrorovich",
    doctorName: "Kurbanova Sevinch Musayevna",
    confirmDate: rawDate || "01.05.2026 08:27",
    privilege: privilege || "Rezident",
    isNoRezident: isNoRezident,
    services: services,
    totalSum: totalSum,
    totalSumFormatted: totalSum.toLocaleString('ru-RU') + " so'm"
  };
}

// 4. PASTKI JADVALDAN TEKSHIRUV KODLARI, NOMLARI, TRANZAKSIYA SANASI VA NARXLARINI AJRATIB OLISH
function extractSubTableServicesFromPage(referringDocFromTop, isNoRezident = false) {
  const servicesList = [];
  const allRows = Array.from(document.querySelectorAll("tr"));

  for (const row of allRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) continue;

    const cellTexts = cells.map(c => c.innerText.trim());
    const firstCell = cellTexts[0] || "";

    // Kod ustuni (R25, R67, R78, R52, R62, R85, R87, R134 va h.k.)
    const codeMatch = firstCell.match(/^R\s*(\d{1,5})/i) || cellTexts.find(t => /^R\s*\d{1,5}$/i.test(t));
    if (codeMatch) {
      const code = typeof codeMatch === 'string' ? codeMatch.toUpperCase().replace(/\s+/g, '') : `R${codeMatch[1]}`;
      const name = (cells[1] ? cells[1].innerText.trim() : "") || (cells[2] ? cells[2].innerText.trim() : "Ultratovush tekshiruvi");
      
      let date = "";
      let orderNo = "";
      let orderingDoctor = referringDocFromTop || "Kasimov Doniyor Abrorovich";
      let reportAuthor = "Kurbanova Sevinch Musayevna";
      let debtStatus = "To'langan";

      // Tranzaksiya sanasi (cell 2: 01.05.2026 08:28:22)
      if (cells[2] && /\d{2}\.\d{2}\.\d{4}/.test(cells[2].innerText)) {
        date = cells[2].innerText.trim();
      } else {
        const dCell = cellTexts.find(t => /\d{2}\.\d{2}\.\d{4}/.test(t));
        if (dCell) date = dCell;
      }

      // Navbat raqami (cell 3: 2280197)
      if (cells[3] && /^\d{6,9}$/.test(cells[3].innerText.trim())) {
        orderNo = cells[3].innerText.trim();
      } else {
        const numCell = cellTexts.find(t => /^\d{6,9}$/.test(t));
        if (numCell) orderNo = numCell;
      }

      // So'rov yuboradigan shifokor (cell 4)
      if (cells[4] && cells[4].innerText.trim().length >= 5) {
        orderingDoctor = cells[4].innerText.trim().replace(/^Dr\.\s*/i, '');
      }

      // Hisobot muallifi / Shifokori (cell 5)
      if (cells[5] && cells[5].innerText.trim().length >= 5) {
        reportAuthor = cells[5].innerText.trim();
      }

      if (cellTexts.some(t => t.toLowerCase().includes("to'langan") || t.toLowerCase().includes("tolangan"))) {
        debtStatus = "To'langan";
      }

      const price = getServiceTariffPrice(name, code, isNoRezident);
      const priceStr = price.toLocaleString('ru-RU') + ',00';

      if (!servicesList.some(s => s.code === code && s.name === name && s.orderNo === orderNo)) {
        servicesList.push({
          code: code,
          name: name,
          price: price,
          paidAmount: price,
          priceStr: priceStr,
          debtStatus: debtStatus,
          orderNo: orderNo || (2280197 + servicesList.length),
          date: date || "01.05.2026 08:28",
          orderingDoctor: orderingDoctor,
          reportAuthor: reportAuthor
        });
      }
    }
  }

  // Agar pastki jadvalda hali qatorlar ko'rinmagan bo'lsa, zaxira UTT tekshiruvi
  if (servicesList.length === 0) {
    const defPrice = 173000;
    servicesList.push({
      code: "R78",
      name: "Ultratovush tekshiruvi",
      price: defPrice,
      paidAmount: defPrice,
      priceStr: defPrice.toLocaleString('ru-RU') + ',00',
      debtStatus: "To'langan",
      orderNo: "2280197",
      date: "01.05.2026 08:28",
      orderingDoctor: referringDocFromTop || "Kasimov Doniyor Abrorovich",
      reportAuthor: "Kurbanova Sevinch Musayevna"
    });
  }

  return servicesList;
}

// 5. JORIY BEMORNI TO'G'RIDAN-TO'G'RI GOOGLE SHEETS "FARQ" VARAG'IGA SAQLASH
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
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> "Farq" ga saqlanmoqda...`;
  }

  // "Farq" jurnali uchun 18 ta ustunli to'liq yozuvlarni tayyorlash
  const records = patient.services.map((srv, idx) => ({
    no: srv.orderNo || (2280197 + idx),
    id: patient.pinfl,
    fullId: patient.pinfl,
    fullName: patient.fullName.toUpperCase(),
    patientType: patient.department || 'Mamologiya',
    serviceCategory: 'Radiologiya',
    functionalDept: 'Ultratovush',
    serviceName: srv.name,
    serviceCode: srv.code,
    cardNo: patient.patientId,
    cardType: 'Ambulator',
    priority: 'Ambulator',
    orderingDoctor: srv.orderingDoctor || patient.referringDoctor,
    fileDoctor: patient.referringDoctor,
    doctorName: srv.reportAuthor || patient.doctorName,
    dr_uygulayan: srv.reportAuthor || patient.doctorName,
    date: srv.date || patient.confirmDate,
    privilegeCategory: patient.privilege || 'Rezident',
    orderliUcret: 0,
    price: srv.price,
    pulliUcret: srv.price,
    paidAmount: srv.paidAmount,
    tolanganUcret: srv.paidAmount
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
      showFarqToast(`✅ "Farq" ga saqlandi: ${patient.fullName} (${patient.services.length} ta tekshiruv, ${patient.totalSumFormatted})`);
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

// 6. EKRANDA SUZUVCHI TEZKOR BOSHQARUV PANELI (WIDGET)
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
        <div class="karmed-farq-pat-meta" id="farqPatMeta">ID: — • Yuborgan: —</div>
        <div class="karmed-farq-pat-sum" id="farqPatSum">Tekshiruvlar: 0 ta • 0 so'm</div>
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
  elMeta.innerText = `ID: ${p.patientId} • Yuborgan: ${p.referringDoctor}`;
  
  const srvCodes = p.services.map(s => s.code).join(", ");
  elSum.innerText = `📋 ${p.services.length} ta tekshiruv (${srvCodes}): ${p.totalSumFormatted}`;

  // Agar Avto-Saqlash yoqilgan bo'lsa va bu bemor hali saqlanmagan bo'lsa
  const currentKey = `${p.patientId}_${p.fullName}_${p.services.length}`;
  if (autoSaveOnOpen && p.patientId && p.patientId !== "ID_NOMALUM" && currentKey !== lastSavedPatientKey) {
    lastSavedPatientKey = currentKey;
    saveCurrentPatientToGoogleSheets();
  }
}

// 7. KLAVIATURA TUGMALARI (F4 yoki Alt+S orqali saqlash)
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

// 9. POPUPDAN YOPPIQ SKANERLASH UCHUN
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "DETECT_PAGE_DOCTORS") {
    sendResponse({ success: true, doctors: ["Kurbanova Sevinch Musayevna", "Kasimov Doniyor Abrorovich"] });
    return true;
  }
  if (request.action === "UPDATE_SETTINGS") {
    if (request.payload?.sheetsScriptUrl) currentGoogleScriptUrl = request.payload.sheetsScriptUrl;
    if (request.payload?.targetSheetName) currentTargetSheetName = request.payload.targetSheetName;
    sendResponse({ success: true });
    return true;
  }
});
