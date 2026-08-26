/**
 * Karmed Xulosalar Portali - Injected Content Script
 * 1. Scans Karmed table: F.I.Sh, Yoshi (Tug'ilgan kuni), Bemor ID, PINFL, Fayl shifokori, Hisobot muallifi
 * 2. Handles row selection, onclick/dblclick to open patient files
 * 3. Prepares patient data for inner report capture
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const ADMIN_USER_ID = "5314298089";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Xotiradagi tanlangan bemor
let activePatient = null;

// 1. Popup-dan xabar kelganda javob berish
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GRAB_KARMED_REPORT") {
    const reportData = extractKarmedPageData();
    sendResponse({ success: !!reportData, data: reportData });
    return true;
  }
  if (request.action === "GET_ACTIVE_PATIENT") {
    sendResponse({ success: !!activePatient, data: activePatient });
    return true;
  }
});

// 2. Karmed Jadvalini Kuzatish va Bemor Tanlanganda Ma'lumotlarni Olish
function initTableObserver() {
  document.addEventListener("click", handleTableClickCapture, true);
  document.addEventListener("dblclick", handleTableClickCapture, true);

  // Har 2 soniyada tanlangan qatorni tekshirish
  setInterval(() => {
    checkSelectedRow();
  }, 1500);
}

// Jadval katakchalaridan ustunlar indeksini topish
function getTableColumnIndexes(headerRow) {
  const indexes = {
    fileDoctor: -1,
    patientId: -1,
    lastName: -1,
    firstName: -1,
    middleName: -1,
    birthDate: -1,
    pinfl: -1,
    department: -1,
    sampleNumber: -1,
    regDate: -1
  };

  if (!headerRow) return indexes;

  const ths = Array.from(headerRow.querySelectorAll("th, td"));
  ths.forEach((th, idx) => {
    const txt = th.innerText.toLowerCase().replace(/[\s_\-']/g, "");

    if (txt.includes("faylningshifokori") || txt.includes("faylshifokor")) indexes.fileDoctor = idx;
    else if (txt.includes("bemorid") || txt.includes("patientid")) indexes.patientId = idx;
    else if (txt.includes("familiya") || txt.includes("lastname")) indexes.lastName = idx;
    else if (txt.includes("ismi") && !txt.includes("ota") && !txt.includes("familiya")) indexes.firstName = idx;
    else if (txt.includes("otaismi") || txt.includes("middlename")) indexes.middleName = idx;
    else if (txt.includes("tugilgan") || txt.includes("birthdate") || txt.includes("tugilganjoyi")) indexes.birthDate = idx;
    else if (txt.includes("pinfl") || txt.includes("pnfl") || txt.includes("jshshir")) indexes.pinfl = idx;
    else if (txt.includes("bolim") || txt.includes("ulangan")) indexes.department = idx;
    else if (txt.includes("namuna")) indexes.sampleNumber = idx;
    else if (txt.includes("royxatgaolingan") || txt.includes("regdate")) indexes.regDate = idx;
  });

  return indexes;
}

// Tanlangan yoki bosilgan qatordan bemor ma'lumotlarini ajratish
function parsePatientFromRow(row) {
  if (!row || row.tagName !== "TR") return null;

  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 5) return null;

  // Jadval sarlavhasini topish
  const table = row.closest("table");
  let headerRow = table ? table.querySelector("thead tr, tr:first-child") : null;
  const colIdx = getTableColumnIndexes(headerRow);

  const cellTexts = cells.map(c => c.innerText.trim());

  // 1. PINFL (14 xonali)
  let pinfl = "";
  if (colIdx.pinfl !== -1 && /^\d{14}$/.test(cellTexts[colIdx.pinfl])) {
    pinfl = cellTexts[colIdx.pinfl];
  } else {
    // Katakchalardan 14 xonali sonni topish
    const pCell = cellTexts.find(t => /^[1-6]\d{13}$/.test(t));
    if (pCell) pinfl = pCell;
  }

  // 2. Bemor ID
  let patientId = "";
  if (colIdx.patientId !== -1) {
    patientId = cellTexts[colIdx.patientId];
  } else {
    const idCell = cellTexts.find(t => /^\d{4,7}$/.test(t) && t !== pinfl);
    if (idCell) patientId = idCell;
  }

  // 3. F.I.Sh (Familiya, Ismi, Ota ismi)
  let lastName = colIdx.lastName !== -1 ? cellTexts[colIdx.lastName] : "";
  let firstName = colIdx.firstName !== -1 ? cellTexts[colIdx.firstName] : "";
  let middleName = colIdx.middleName !== -1 ? cellTexts[colIdx.middleName] : "";

  // Agar alohida ustunlar topilmasa, matnlardan ajratish
  if (!lastName || !firstName) {
    const nameCandidates = cellTexts.filter(t => 
      t.length >= 2 && 
      /^[A-ZА-ЯЁ\s'\-]+$/i.test(t) && 
      !t.includes("MRT") && !t.includes("MSKT") && !t.includes("RENTGEN") && !t.includes("SUGURTA") && !t.includes("ORDER")
    );
    if (nameCandidates.length >= 2) {
      lastName = nameCandidates[0] || "";
      firstName = nameCandidates[1] || "";
      middleName = nameCandidates[2] || "";
    }
  }

  const fullName = `${lastName} ${firstName} ${middleName}`.trim();

  // 4. Tug'ilgan kuni va Yoshi
  let birthDate = colIdx.birthDate !== -1 ? cellTexts[colIdx.birthDate] : "";
  if (!birthDate) {
    const bMatch = row.innerText.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (bMatch) birthDate = bMatch[1];
  }

  let age = "";
  if (birthDate) {
    const parts = birthDate.split(".");
    if (parts.length === 3) {
      const birthYear = parseInt(parts[2], 10);
      const currentYear = new Date().getFullYear();
      if (birthYear > 1900 && birthYear <= currentYear) {
        age = `${currentYear - birthYear} yosh`;
      }
    }
  }

  // 5. Fayl Shifokori
  let fileDoctor = colIdx.fileDoctor !== -1 ? cellTexts[colIdx.fileDoctor] : "";
  if (!fileDoctor) {
    const docMatch = row.innerText.match(/(?:Dr\.|Doktor|Vrach)\s+[A-ZА-ЯЁ][a-zа-яё\.\s]+/i);
    if (docMatch) fileDoctor = docMatch[0].trim();
  }

  // 6. Pastki jadvaldan (Sub-table) Tekshiruv Nomi va Hisobot Muallifini olish
  const subTableData = extractSubTableData();

  return {
    patientId: patientId || "Noma'lum",
    pinfl: pinfl || "",
    lastName: lastName || "",
    firstName: firstName || "",
    middleName: middleName || "",
    fullName: fullName || "Bemor",
    birthDate: birthDate || "",
    age: age || "",
    fileDoctor: fileDoctor || "Shifokor",
    serviceName: subTableData.serviceName || "Radiologik Tekshiruv",
    reportAuthor: subTableData.reportAuthor || fileDoctor || "Shifokor-Radiolog",
    transactionDate: subTableData.transactionDate || new Date().toISOString().split("T")[0],
    queueNumber: subTableData.queueNumber || "",
    rowElement: row
  };
}

// Pastki kichik jadvaldan (Tashxislar / Xizmatlar) ma'lumot olish
function extractSubTableData() {
  let serviceName = "";
  let reportAuthor = "";
  let transactionDate = "";
  let queueNumber = "";

  try {
    const subTables = document.querySelectorAll("table");
    subTables.forEach(tbl => {
      const txt = tbl.innerText;
      if (txt.includes("Xizmatlar Nomi") || txt.includes("Hisobot muallifi") || txt.includes("Navbat raqami")) {
        const rows = tbl.querySelectorAll("tbody tr, tr");
        rows.forEach(r => {
          const cells = Array.from(r.querySelectorAll("td")).map(c => c.innerText.trim());
          if (cells.length >= 4) {
            // Xizmat nomi
            const sCell = cells.find(c => c.includes("MRT") || c.includes("MSKT") || c.includes("Rentgen") || c.includes("a'zolari") || c.includes("Bo'g'imi"));
            if (sCell) serviceName = sCell;

            // Muallif
            const aCell = cells.find(c => /^[A-ZА-ЯЁ][a-zа-яё']+\s+[A-ZА-ЯЁ][a-zа-яё']+\s+[A-ZА-ЯЁ]/.test(c));
            if (aCell && aCell !== sCell) reportAuthor = aCell;

            // Navbat raqami (7 xonali)
            const qCell = cells.find(c => /^\d{6,8}$/.test(c));
            if (qCell) queueNumber = qCell;
          }
        });
      }
    });

    if (!serviceName) {
      const pageText = document.body.innerText;
      if (pageText.includes("Kichik chanoq")) serviceName = "Kichik chanoq a'zolari MRT";
      else if (pageText.includes("Qo'l-Kaft")) serviceName = "Qo'l-Kaft Bo'g'imi MRT";
      else if (pageText.includes("Bosh miya") || pageText.includes("Bosh Miya")) serviceName = "Bosh miya MRT";
    }

    if (!reportAuthor) {
      const authorMatch = document.body.innerText.match(/Hisobot\s*muallifi[\s:—–]+([A-ZА-ЯЁ][a-zа-яё'\s]+)/i);
      if (authorMatch) reportAuthor = authorMatch[1].trim();
    }
  } catch (e) {
    console.warn("extractSubTableData error:", e);
  }

  return { serviceName, reportAuthor, transactionDate, queueNumber };
}

// Jadvalda qator bosilganda
function handleTableClickCapture(e) {
  const row = e.target.closest("tr");
  if (!row) return;

  // Jadval qatori ekanligini tekshirish
  const patient = parsePatientFromRow(row);
  if (patient && (patient.pinfl || patient.patientId !== "Noma'lum")) {
    activePatient = patient;
    saveActivePatientToStorage(patient);
    renderPatientBanner(patient);
  }
}

// Yashil yoki tanlangan qatorni avtomatik aniqlash
function checkSelectedRow() {
  const selectedRows = document.querySelectorAll("tr.selected, tr.active, tr.highlight, tr[style*='background']");
  for (const row of selectedRows) {
    const patient = parsePatientFromRow(row);
    if (patient && (patient.pinfl || patient.patientId !== "Noma'lum")) {
      if (!activePatient || activePatient.patientId !== patient.patientId || activePatient.pinfl !== patient.pinfl) {
        activePatient = patient;
        saveActivePatientToStorage(patient);
        renderPatientBanner(patient);
      }
      break;
    }
  }
}

function saveActivePatientToStorage(p) {
  try {
    const safeData = {
      patientId: p.patientId,
      pinfl: p.pinfl,
      fullName: p.fullName,
      lastName: p.lastName,
      firstName: p.firstName,
      middleName: p.middleName,
      birthDate: p.birthDate,
      age: p.age,
      fileDoctor: p.fileDoctor,
      serviceName: p.serviceName,
      reportAuthor: p.reportAuthor,
      transactionDate: p.transactionDate,
      queueNumber: p.queueNumber,
      updatedAt: Date.now()
    };
    chrome.storage.local.set({ lastActivePatient: safeData });
  } catch (e) {}
}

// 3. Ekranda Tanlangan Bemor haqida Chiroyli Suzuvchi Panelni Ko'rsatish
function renderPatientBanner(p) {
  let banner = document.getElementById("karmedPatientInfoBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "karmedPatientInfoBanner";
    banner.className = "karmed-patient-banner";
    document.body.appendChild(banner);
  }

  banner.innerHTML = `
    <div class="karmed-banner-content">
      <div class="karmed-banner-left">
        <div class="karmed-banner-badge"><i class="fa-solid fa-user-check"></i> Tanlangan Bemor</div>
        <div class="karmed-banner-name"><b>${escapeHtml(p.fullName)}</b> <span class="karmed-age-tag">${escapeHtml(p.age || p.birthDate)}</span></div>
        <div class="karmed-banner-meta">
          <span><b>ID:</b> ${escapeHtml(p.patientId)}</span> • 
          <span><b>PNFL:</b> <code class="karmed-pnfl-code">${escapeHtml(p.pinfl || 'Kiritilmagan')}</code></span> • 
          <span><b>Fayl shifokori:</b> ${escapeHtml(p.fileDoctor)}</span> • 
          <span><b>Hisobot muallifi:</b> ${escapeHtml(p.reportAuthor)}</span> • 
          <span><b>Tekshiruv:</b> ${escapeHtml(p.serviceName)}</span>
        </div>
      </div>
      <div class="karmed-banner-actions">
        <button type="button" class="karmed-btn-action karmed-btn-open-files" id="btnBannerOpenFiles">
          <i class="fa-solid fa-folder-open"></i> Bemor Fayllarini Ochish (Onclick)
        </button>
        <button type="button" class="karmed-btn-action karmed-btn-save-report" id="btnBannerSaveReport">
          <i class="fa-solid fa-file-export"></i> Xulosani Saqlash
        </button>
      </div>
    </div>
  `;

  banner.style.display = "block";

  // "Bemor Fayllarini Ochish" bosilganda qatorga ikki marta bosish (dblclick) va ochish
  document.getElementById("btnBannerOpenFiles").onclick = (e) => {
    e.stopPropagation();
    openPatientFilesAction(p);
  };

  // "Xulosani Saqlash" bosilganda
  document.getElementById("btnBannerSaveReport").onclick = (e) => {
    e.stopPropagation();
    handleDirectSaveClick();
  };
}

// Bemor fayllarini ochish hodisasi (dblclick yoki onclick simulyatsiyasi)
function openPatientFilesAction(p) {
  if (p.rowElement) {
    // 1. Qatorga double-click yuborish
    const dblEvent = new MouseEvent("dblclick", {
      bubbles: true,
      cancelable: true,
      view: window
    });
    p.rowElement.dispatchEvent(dblEvent);

    // 2. Qatorga click yuborish
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window
    });
    p.rowElement.dispatchEvent(clickEvent);

    // 3. Agar yuqori paneldagi "Viewer" yoki "Hisobot" tugmasi bo'lsa, uni ham chaqirish
    const viewerBtn = Array.from(document.querySelectorAll("button, a, div, span")).find(el => 
      el.innerText && (el.innerText.trim() === "Viewer" || el.innerText.trim() === "Hisobot" || el.innerText.trim() === "Web Pacs")
    );
    if (viewerBtn) {
      viewerBtn.click();
    }
  }

  showToastNotification(`📂 ${p.fullName} fayllari ochilmoqda...`);
}

// 4. Ichki sahifadan to'liq ma'lumotlarni o'qish
function extractKarmedPageData() {
  let pinfl = activePatient ? activePatient.pinfl : "";
  let patientName = activePatient ? activePatient.fullName : "";
  let serviceName = activePatient ? activePatient.serviceName : "";
  let doctorName = activePatient ? (activePatient.reportAuthor || activePatient.fileDoctor) : "";
  let conclusionText = "";
  let date = new Date().toISOString().split("T")[0];

  try {
    const pageText = document.body.innerText || "";

    // FastReport Export sahifasi
    const pinflMatch = pageText.match(/PINFL\s*[:：]\s*(\d{14})/i);
    if (pinflMatch) pinfl = pinflMatch[1];

    const nameMatch = pageText.match(/Name\s*[:：]\s*([^\n\r\t]+)/i);
    const lastNameMatch = pageText.match(/Last\s*name\s*[:：]\s*([^\n\r\t]+)/i);
    if (nameMatch) {
      patientName = `${nameMatch[1].trim()} ${lastNameMatch ? lastNameMatch[1].trim() : ''}`.trim();
    }

    const repDocMatch = pageText.match(/Reporting\s*Doctor\s*[:：]\s*([^\n\r\t]+)/i);
    if (repDocMatch) doctorName = repDocMatch[1].trim();

    // Matn muharriri yoki xulosani olish
    const textareas = document.querySelectorAll("textarea, [contenteditable='true'], .xulosa-text, .report-content, .conclusion");
    for (const ta of textareas) {
      const val = (ta.value || ta.innerText || "").trim();
      if (val.length > 25) {
        conclusionText = val;
        break;
      }
    }

    if (!conclusionText) {
      const onkoHeaderMatch = pageText.match(/(РЕСПУБЛИКАНСКИЙ[\s\S]{50,3000}?)(?:Врач|Шифокор|$)/i);
      if (onkoHeaderMatch) conclusionText = onkoHeaderMatch[1].trim();
    }

    if (!conclusionText) {
      const zklMatch = pageText.match(/(?:Закл|Заключение|Xulosa)[\s:—–]+([\s\S]{20,2000}?)(?:Врач|Шифокор|$)/i);
      if (zklMatch) conclusionText = zklMatch[1].trim();
    }

  } catch (e) {
    console.warn("extractKarmedPageData error:", e);
  }

  return {
    pinfl,
    patientName,
    serviceName: serviceName || "Radiologik Tekshiruv",
    doctorName: doctorName || "Shifokor-Radiolog",
    conclusionText,
    date
  };
}

// 5. To'g'ridan-to'g'ri saqlash modali
async function handleDirectSaveClick() {
  const data = extractKarmedPageData();

  let oldModal = document.getElementById("karmedDirectSaveModal");
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = "karmedDirectSaveModal";
  modal.className = "karmed-modal-overlay";

  modal.innerHTML = `
    <div class="karmed-modal-box">
      <div class="karmed-modal-header">
        <h3><i class="fa-solid fa-file-circle-check"></i> Xulosani Telegram Bazasiga Saqlash</h3>
        <button type="button" class="karmed-modal-close" id="btnKarmedModalClose">&times;</button>
      </div>

      <div class="karmed-modal-body">
        <div class="karmed-form-row">
          <div class="karmed-form-group flex-2">
            <label><b>JSHSHIR (PNFL - 14 xonali):</b></label>
            <input type="text" id="kModalPinfl" maxlength="14" value="${escapeHtml(data.pinfl || '')}" placeholder="14 ta raqam">
          </div>
          <div class="karmed-form-group flex-1">
            <label><b>Bemor ID:</b></label>
            <input type="text" id="kModalPatientId" readonly value="${escapeHtml(activePatient ? activePatient.patientId : '')}">
          </div>
        </div>

        <div class="karmed-form-group">
          <label><b>Bemor F.I.Sh (va Yoshi):</b></label>
          <input type="text" id="kModalName" value="${escapeHtml(data.patientName || '')} ${activePatient && activePatient.age ? '(' + activePatient.age + ')' : ''}" placeholder="Bemor F.I.Sh">
        </div>

        <div class="karmed-form-row">
          <div class="karmed-form-group flex-1">
            <label><b>Tekshiruv Nomi:</b></label>
            <input type="text" id="kModalService" value="${escapeHtml(data.serviceName || '')}">
          </div>
          <div class="karmed-form-group flex-1">
            <label><b>Hisobot Muallifi / Shifokor:</b></label>
            <input type="text" id="kModalDoctor" value="${escapeHtml(data.doctorName || '')}">
          </div>
        </div>

        <div class="karmed-form-group">
          <label><b>Tibbiy Xulosa Matni:</b></label>
          <textarea id="kModalText" rows="6" placeholder="Karmed-dan olingan to'liq tibbiy xulosa matni...">${escapeHtml(data.conclusionText || '')}</textarea>
        </div>

        <div class="karmed-modal-actions">
          <button type="button" class="karmed-btn karmed-btn-cancel" id="btnKarmedModalCancel">Bekor qilish</button>
          <button type="button" class="karmed-btn karmed-btn-save" id="btnKarmedModalSave">
            <i class="fa-solid fa-paper-plane"></i> Saqlash & Telegramga Jo'natish
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("btnKarmedModalClose").onclick = () => modal.remove();
  document.getElementById("btnKarmedModalCancel").onclick = () => modal.remove();

  document.getElementById("btnKarmedModalSave").onclick = async () => {
    const pinfl = document.getElementById("kModalPinfl").value.replace(/\D/g, "");
    const patientName = document.getElementById("kModalName").value.trim();
    const serviceName = document.getElementById("kModalService").value.trim();
    const doctorName = document.getElementById("kModalDoctor").value.trim();
    const conclusionText = document.getElementById("kModalText").value.trim();

    if (!pinfl || pinfl.length !== 14) {
      alert("Iltimos, 14 xonali PNFL (JSHSHIR) raqamini to'liq kiriting!");
      return;
    }

    if (!patientName || !conclusionText) {
      alert("Bemor ismi va xulosa matnini to'ldiring!");
      return;
    }

    const saveBtn = document.getElementById("btnKarmedModalSave");
    saveBtn.disabled = true;
    saveBtn.innerHTML = "⏳ Saqlanmoqda...";

    const reportId = "rep_" + Date.now();
    const dateStr = new Date().toISOString().split("T")[0];

    const reportData = {
      id: reportId,
      pinfl,
      patientId: activePatient ? activePatient.patientId : "",
      patientName,
      age: activePatient ? activePatient.age : "",
      birthDate: activePatient ? activePatient.birthDate : "",
      serviceName,
      doctorName: doctorName || "Shifokor-Radiolog",
      reportAuthor: activePatient ? activePatient.reportAuthor : doctorName,
      fileDoctor: activePatient ? activePatient.fileDoctor : "",
      reportDate: dateStr,
      conclusionText,
      createdAt: Date.now(),
      source: "Karmed Enhanced Capture"
    };

    try {
      // 1. Firebase-ga yozish
      await fetch(`${FIREBASE_DB_URL}/karmed_reports/${pinfl}/${reportId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData)
      });

      // 2. Telegramga xabar berish
      const tgMsg = 
        `📄 <b>YANGI TIBBIY XULOSA SAQLANDI</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Bemor:</b> ${escapeHtml(patientName)}\n` +
        `🎂 <b>Yoshi:</b> ${escapeHtml(reportData.age || reportData.birthDate || '-')}\n` +
        `🆔 <b>Bemor ID:</b> ${escapeHtml(reportData.patientId || '-')}\n` +
        `🔢 <b>PNFL (JSHSHIR):</b> <code>${pinfl}</code>\n` +
        `🔬 <b>Tekshiruv:</b> ${escapeHtml(serviceName)}\n` +
        `👨‍⚕️ <b>Fayl shifokori:</b> ${escapeHtml(reportData.fileDoctor || '-')}\n` +
        `✍️ <b>Hisobot muallifi:</b> ${escapeHtml(reportData.reportAuthor || '-')}\n` +
        `📅 <b>Sana:</b> ${dateStr}\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <b>Xulosa:</b>\n${escapeHtml(conclusionText)}`;

      // Kanalga yuborish
      fetch(`${TG_API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHANNEL_ID, text: tgMsg, parse_mode: "HTML" })
      }).catch(() => {});

      // Adminga yuborish
      fetch(`${TG_API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_USER_ID, text: tgMsg, parse_mode: "HTML" })
      }).catch(() => {});

      modal.remove();
      showToastNotification(`✅ Xulosa saqlandi: ${patientName} (PNFL: ${pinfl})`);
      alert(`✅ Muvaffaqiyatli saqlandi!\nBemor: ${patientName}\nPNFL: ${pinfl}\n\nKanalga va bazaga uzatildi!`);

    } catch (err) {
      alert("Saqlashda xatolik: " + err.message);
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Saqlash & Telegramga Jo'natish";
    }
  };
}

function showToastNotification(msg) {
  let toast = document.getElementById("karmedFloatingToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "karmedFloatingToast";
    toast.className = "karmed-floating-toast";
    document.body.appendChild(toast);
  }
  toast.innerText = msg;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Suzuvchi tugma
function injectFloatingKarmedButton() {
  if (document.getElementById("karmedReportsFloatingBtn")) return;

  const btn = document.createElement("button");
  btn.id = "karmedReportsFloatingBtn";
  btn.className = "karmed-floating-btn";
  btn.innerHTML = `<i class="fa-solid fa-file-medical"></i> <span>Xulosani Saqlash</span>`;
  btn.title = "Karmed-dagi xulosani Telegram bot bazasiga saqlash";
  btn.addEventListener("click", handleDirectSaveClick);
  document.body.appendChild(btn);
}

// Boshlash
setTimeout(() => {
  initTableObserver();
  injectFloatingKarmedButton();
}, 1000);
