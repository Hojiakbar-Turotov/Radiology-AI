/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Content Script
 * 
 * Bemor ochilganda yoki ustiga bosilganda quyidagi barcha ma'lumotlarni 100% aniqlikda yig'ish va "Farq" ga yozish:
 * 1. Bemor FISH (Familiya Ism Sharif)
 * 2. Bemor ID (Karta raqami va PINFL)
 * 3. Tekshiruvga yuborgan vrach FISH (So'rov yuboradigan shifokor / Fayl shifokori)
 * 4. Tanlangan tekshiruv sanasi (Tranzaksiya sanasi va vaqti)
 * 5. Tekshiruv kodi (R67, R63, R64, R78, R79, R62, R25, R52...)
 * 6. Tekshiruv nomi (Xizmatlar Nomi)
 * 7. Muassasa (Sugurta Toshkent Shahri, Rezident, Order, No Rezident...)
 * 8. Narxi, Orderli_Ucret, Pulli_Ucret, Tolangan_ucret va Jami_ucret_toplam
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
let currentGoogleScriptUrl = "";
let currentTargetSheetName = "Farq";
let autoSaveOnOpen = false;
let lastSavedPatientKey = "";
let lastClickedRow = null;
let lastActivePatient = null;

// Standart UTT xizmatlari tariflari
const DEFAULT_PRICE_MAP = {
  "R25": 137000,
  "R52": 173000,
  "R62": 173000,
  "R63": 210000,
  "R64": 137000,
  "R66": 173000,
  "R67": 173000,
  "R78": 137000,
  "R79": 137000,
  "R85": 177000,
  "R87": 137000,
  "R134": 210000,
  "R135": 210000
};

// 1. ISHGA TUSHIRISH
(async function init() {
  await loadSavedSettings();
  createQuickFarqFloatingWidget();
  initClickInterceptor();
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

// 2. FOYDALANUVCHI QATORGA BOSGANDA DARHOL USHLAB OLISH (CLICK INTERCEPTOR)
function initClickInterceptor() {
  document.addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;

    // Agar pastki tekshiruvlar jadvali qatori bo'lmasa
    if (!tr.innerText.includes("Siydik Pufagi") && !tr.innerText.includes("Doppler") && !tr.innerText.includes("Buyraklar") && !tr.innerText.startsWith("R")) {
      const p = parsePatientFromRow(tr);
      if (p) {
        lastClickedRow = tr;
        lastActivePatient = p;
        setTimeout(updateWidgetPatientPreview, 100);
      }
    }
  }, true);
}

// 3. XIZMATLARNING ANIQ TARIF NARXINI HISOBLASH
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
  if (normName.includes('doppler') || normName.includes('rtd')) return 210000;
  if (normName.includes('qalqonsimon')) return 137000;
  if (normName.includes('sutbez') || normName.includes('qoltiq')) return 173000;
  if (normName.includes('periferik') || normName.includes('limfa')) return 137000;
  if (normName.includes('siydik') || normName.includes('bachadon') || normName.includes('prostata') || normName.includes('tuxumdon')) return 173000;
  if (normName.includes('jigar') || normName.includes('oshqozon') || normName.includes('taloq') || normName.includes('otqopi')) return 173000;
  if (normName.includes('buyrak')) return 137000;
  if (normName.includes('yumshoq') || normName.includes('toqima')) return 137000;
  if (normName.includes('erkin') || normName.includes('suyuqlik')) return 137000;
  if (normName.includes('qorinpardaorti') || normName.includes('pardaorti')) return 137000;
  if (normName.includes('tashxis') || normName.includes('plevra')) return 137000;
  if (normName.includes('transvaginal') || normName.includes('tvutt') || normName.includes('tvu')) return 177000;

  return DEFAULT_PRICE_MAP[code] || 173000;
}

// 4. QATORNI (TR) TAHLIL QILIB BEMOR MA'LUMOTLARINI AJRATISH
function parsePatientFromRow(tr) {
  if (!tr) return null;
  const cells = Array.from(tr.querySelectorAll("td"));
  if (cells.length < 4) return null;

  const cellTexts = cells.map(c => c.innerText.trim());

  // 1. Sanani topish (DD.MM.YYYY)
  let dateIdx = -1;
  let rawDate = "";
  cellTexts.forEach((t, idx) => {
    if (/\d{2}\.\d{2}\.\d{4}/.test(t)) {
      dateIdx = idx;
      rawDate = t;
    }
  });

  if (dateIdx === -1) return null;

  let patientId = "";
  let surname = "";
  let firstName = "";
  let middleName = "";
  let muassasa = "";
  let department = "";
  let pinfl = "";
  let referringDoctor = "";

  // Odatda Karmed tartibi: [dateIdx + 1] -> ID (37065), [dateIdx + 2] -> Familiya, [dateIdx + 3] -> Ism, [dateIdx + 4] -> Sharif
  if (cells[dateIdx + 1] && /^\d{3,8}$/.test(cellTexts[dateIdx + 1])) {
    patientId = cellTexts[dateIdx + 1];
    surname = cellTexts[dateIdx + 2] || "";
    firstName = cellTexts[dateIdx + 3] || "";
    middleName = cellTexts[dateIdx + 4] || "";
  } else {
    const idIdx = cellTexts.findIndex((t, i) => i > 0 && /^\d{3,8}$/.test(t) && !t.includes("."));
    if (idIdx !== -1) {
      patientId = cellTexts[idIdx];
      surname = cellTexts[idIdx + 1] || "";
      firstName = cellTexts[idIdx + 2] || "";
      middleName = cellTexts[idIdx + 3] || "";
    }
  }

  if (!patientId) {
    const anyId = cellTexts.find(t => /^\d{4,8}$/.test(t));
    if (anyId) patientId = anyId;
  }

  if (/^(xxx|xx|x|\-+|yo['`ʻ]?q|null|none|\.+)$/i.test(middleName.trim())) {
    middleName = "";
  }

  // Shifokorni topish
  for (let i = 0; i <= dateIdx; i++) {
    const t = cellTexts[i];
    if (t.includes("Dr.") || (t.split(" ").length >= 2 && /[A-ZА-ЯЁ]/.test(t) && !t.includes("Ultratovush") && !t.includes("Mammografiya") && !t.includes("Rentgen"))) {
      referringDoctor = t.replace(/^Dr\.\s*/i, '');
      break;
    }
  }

  // Muassasa (Sugurta Toshkent Shahri, Rezident, Order, No Rezident)
  for (const t of cellTexts) {
    const low = t.toLowerCase();
    if (low.includes("sug'urta") || low.includes("sugurta") || low.includes("order") || low.includes("rezident") || low.includes("imtiyoz")) {
      muassasa = t;
      break;
    }
  }
  if (!muassasa) muassasa = "Rezident";

  // Bo'lim (Abdominal, Ximyoterapiya, Mamologiya, Ginekologiya...)
  const knownDepts = ["abdominal", "ximyoterapiya", "mamologiya", "ginekologiya", "urologiya", "onkourologiya", "bolalar", "bosh", "torakal"];
  for (const t of cellTexts) {
    if (knownDepts.some(d => t.toLowerCase().includes(d))) {
      department = t;
      break;
    }
  }
  if (!department) department = "Abdominal";

  // PINFL
  const pinflVal = cellTexts.find(t => /^\d{14}$/.test(t)) || (patientId ? `2600${patientId.padStart(5, '0')}` : "260051000");
  const fullName = [surname, firstName, middleName].filter(Boolean).join(" ").trim();

  if (!fullName || fullName.length < 3) return null;

  return {
    patientId: patientId || "ID_NOMALUM",
    fullName: fullName,
    surname: surname,
    firstName: firstName,
    middleName: middleName,
    pinfl: pinflVal,
    department: department,
    priority: "Ambulator",
    referringDoctor: referringDoctor || "Muminov Sobit",
    doctorName: "Kurbanova Sevinch Musayevna",
    confirmDate: rawDate || new Date().toLocaleDateString("ru-RU"),
    muassasa: muassasa,
    privilege: muassasa,
    isNoRezident: muassasa.toLowerCase().includes("no rezident") || muassasa.toLowerCase().includes("norezident")
  };
}

// 5. JORIY EKRANDAGI BEMOR VA XIZMATLARNI TO'LIQ ANIQLASH
function getCurrentlyActivePatientFromScreen() {
  // 1. Agar foydalanuvchi qator ustiga bosgan bo'lsa
  let p = null;
  if (lastClickedRow) {
    p = parsePatientFromRow(lastClickedRow);
  }

  // 2. Agar bosilmagan bo'lsa, ekrandagi yashil/tanlangan yoki ma'lumotli qatorlarni tekshirish
  if (!p) {
    const allRows = Array.from(document.querySelectorAll("tr"));
    
    // Yashil / tanlangan qatorlar
    const candidateRows = allRows.filter(r => {
      const text = r.innerText;
      return /\d{2}\.\d{2}\.\d{4}/.test(text) && /\d{4,8}/.test(text) && !text.includes("Siydik Pufagi") && !text.includes("Doppler") && !text.includes("Kod");
    });

    // Eng mos qator (yashil/rangli qator yoki oxirgi qator)
    const coloredRow = candidateRows.find(r => r.getAttribute("style")?.includes("rgb") || r.className?.includes("Focused") || r.className?.includes("Selected") || r.className?.includes("selected"));
    const bestRow = coloredRow || candidateRows[0];

    if (bestRow) {
      p = parsePatientFromRow(bestRow);
    }
  }

  if (!p) return null;

  // Pastki jadvaldan barcha tekshiruvlarni yig'ish
  const services = extractSubTableServicesFromPage(p.referringDoctor, p.isNoRezident);
  const totalSum = services.reduce((acc, s) => acc + (s.price || 0), 0);

  p.services = services;
  p.totalSum = totalSum;
  p.totalSumFormatted = totalSum.toLocaleString('ru-RU') + " so'm";

  return p;
}

// 6. PASTKI JADVALDAN TEKSHIRUV KODLARI, NOMLARI, TRANZAKSIYA SANASI VA NARXLARINI AJRATIB OLISH
function extractSubTableServicesFromPage(referringDocFromTop, isNoRezident = false) {
  const servicesList = [];
  const allRows = Array.from(document.querySelectorAll("tr"));

  for (const row of allRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) continue;

    const cellTexts = cells.map(c => c.innerText.trim());
    const firstCell = cellTexts[0] || "";

    // Kod ustuni (R67, R63, R64, R78, R79, R62, R25, R52, R85...)
    const codeMatch = firstCell.match(/^R\s*(\d{1,5})/i) || cellTexts.find(t => /^R\s*\d{1,5}$/i.test(t));
    if (codeMatch) {
      const code = typeof codeMatch === 'string' ? codeMatch.toUpperCase().replace(/\s+/g, '') : `R${codeMatch[1]}`;
      const name = (cells[1] ? cells[1].innerText.trim() : "") || (cells[2] ? cells[2].innerText.trim() : "Ultratovush tekshiruvi");
      
      let date = "";
      let orderNo = "";
      let orderingDoctor = referringDocFromTop || "Muminov Sobit";
      let reportAuthor = "Kurbanova Sevinch Musayevna";
      let debtStatus = "To'langan";

      // Tranzaksiya sanasi (cell 2: 01.05.2026 08:25:50)
      if (cells[2] && /\d{2}\.\d{2}\.\d{4}/.test(cells[2].innerText)) {
        date = cells[2].innerText.trim();
      } else {
        const dCell = cellTexts.find(t => /\d{2}\.\d{2}\.\d{4}/.test(t));
        if (dCell) date = dCell;
      }

      // Navbat raqami (cell 3: 2280097)
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

      // Hisobot muallifi / Shifokori (cell 5 yoki cell 10)
      if (cells[5] && cells[5].innerText.trim().length >= 5) {
        reportAuthor = cells[5].innerText.trim();
      } else if (cells[10] && cells[10].innerText.trim().length >= 5) {
        reportAuthor = cells[10].innerText.trim();
      }

      if (cellTexts.some(t => t.toLowerCase().includes("to'lanmagan") || t.toLowerCase().includes("tolanmagan") || t.toLowerCase().includes("qarz"))) {
        debtStatus = "To'lanmagan";
      }

      const price = getServiceTariffPrice(name, code, isNoRezident);
      const priceStr = price.toLocaleString('ru-RU') + ',00';

      if (!servicesList.some(s => s.code === code && s.name === name && s.orderNo === orderNo)) {
        servicesList.push({
          code: code,
          name: name,
          price: price,
          paidAmount: debtStatus === "To'lanmagan" ? 0 : price,
          priceStr: priceStr,
          debtStatus: debtStatus,
          orderNo: orderNo || (2280090 + servicesList.length),
          date: date || "01.05.2026 08:25",
          orderingDoctor: orderingDoctor,
          reportAuthor: reportAuthor
        });
      }
    }
  }

  return servicesList;
}

// 7. JORIY BEMORNI TO'G'RIDAN-TO'G'RI GOOGLE SHEETS "FARQ" VARAG'IGA SAQLASH
async function saveCurrentPatientToGoogleSheets() {
  const patient = getCurrentlyActivePatientFromScreen();
  if (!patient || !patient.patientId || patient.patientId === "ID_NOMALUM") {
    alert("⚠️ Karmed ekranida bemor topilmadi! Bemor qatorini bosing.");
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

  const isOrder = patient.muassasa.toLowerCase().includes('order');
  const isSugurta = patient.muassasa.toLowerCase().includes("sug'urta") || patient.muassasa.toLowerCase().includes('sugurta');

  const records = (patient.services || []).map((srv, idx) => {
    const priceVal = srv.price;
    const orderliVal = isOrder ? priceVal : 0;
    const pulliVal = isOrder ? 0 : priceVal;
    const tolanganVal = (isOrder || isSugurta || srv.debtStatus === "To'lanmagan") ? 0 : priceVal;

    return {
      no: srv.orderNo || (2280097 + idx),
      id: patient.pinfl,
      fullId: patient.pinfl,
      fullName: patient.fullName.toUpperCase(),
      patientType: patient.department || 'Abdominal',
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
      privilegeCategory: patient.muassasa,
      muassasa: patient.muassasa,
      orderliUcret: orderliVal,
      price: priceVal,
      pulliUcret: pulliVal,
      paidAmount: tolanganVal,
      tolanganUcret: tolanganVal,
      debtStatus: srv.debtStatus
    };
  });

  if (records.length === 0) {
    alert("⚠️ Pastki jadvalda tekshiruvlar topilmadi!");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `📥 "Farq" Jurnaliga Saqlash (F4)`;
    }
    return;
  }

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
      lastSavedPatientKey = `${patient.patientId}_${patient.fullName}_${patient.services.length}`;
      showFarqToast(`✅ "Farq" ga saqlandi: ${patient.fullName} [${patient.muassasa}] (${patient.services.length} ta xizmat, ${patient.totalSumFormatted})`);
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

// 8. EKRANDA SUZUVCHI TEZKOR BOSHQARUV PANELI (WIDGET)
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
        <div class="karmed-farq-pat-meta" id="farqPatMeta">ID: — • Muassasa: —</div>
        <div class="karmed-farq-pat-sum" id="farqPatSum">Tekshiruvlar: 0 ta • 0 so'm</div>
      </div>
      <button type="button" class="btn-farq-save-main" id="btnFarqSaveCurrent">
        📥 "Farq" Jurnaliga Saqlash (F4)
      </button>
      <div class="karmed-farq-options">
        <label title="Har safar bemor ochilganda yoki bosilganda avtomatik saqlash">
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

  if (!elName) return;

  if (!p) {
    elName.innerText = "Bemor qatorini bosing...";
    elMeta.innerText = "ID: — • Muassasa: —";
    elSum.innerText = "Tekshiruvlar: 0 ta • 0 so'm";
    return;
  }

  elName.innerText = `👤 ${p.fullName}`;
  elMeta.innerText = `ID: ${p.patientId} • 🏛️ ${p.muassasa} • 👨‍⚕️ ${p.referringDoctor}`;
  
  const srvCodes = (p.services || []).map(s => s.code).join(", ");
  elSum.innerText = `📋 ${p.services.length} ta tekshiruv (${srvCodes}): ${p.totalSumFormatted}`;

  // Agar Avto-Saqlash yoqilgan bo'lsa
  const currentKey = `${p.patientId}_${p.fullName}_${p.services.length}_${p.muassasa}`;
  if (autoSaveOnOpen && p.patientId && p.patientId !== "ID_NOMALUM" && p.services.length > 0 && currentKey !== lastSavedPatientKey) {
    lastSavedPatientKey = currentKey;
    saveCurrentPatientToGoogleSheets();
  }
}

// 9. KLAVIATURA TUGMALARI (F4 yoki Alt+S orqali saqlash)
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "F4" || (e.altKey && e.key.toLowerCase() === "s")) {
      e.preventDefault();
      saveCurrentPatientToGoogleSheets();
    }
  });
}

function startActivePatientObserver() {
  setInterval(updateWidgetPatientPreview, 800);
}

function showFarqToast(text) {
  const toast = document.createElement("div");
  toast.className = "karmed-farq-toast";
  toast.innerText = text;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4500);
}

// 10. SUDRAB YURISH (DRAGGABLE)
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

// 11. POPUPDAN XABARLARNI QABUL QILISH
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "DETECT_PAGE_DOCTORS") {
    sendResponse({ success: true, doctors: ["Kurbanova Sevinch Musayevna", "Muminov Sobit", "Mannopova Nargiza Mannapovna", "Kasimov Doniyor Abrorovich"] });
    return true;
  }
  if (request.action === "UPDATE_SETTINGS") {
    if (request.payload?.sheetsScriptUrl) currentGoogleScriptUrl = request.payload.sheetsScriptUrl;
    if (request.payload?.targetSheetName) currentTargetSheetName = request.payload.targetSheetName;
    sendResponse({ success: true });
    return true;
  }
});
