/**
 * Karmed Xulosalar Portali - Injected Content Script
 * 1. Aniq jadval tahlili: F.I.Sh, Yoshi, Bemor ID, PNFL, Fayl shifokori, Hisobot muallifi, Tekshiruv nomi
 * 2. Radyoloji Raporu oynasida Printer / Save tugmasini bosib yangi oynada PDF ochish
 * 3. Yangi oynada ochilgan PDF/FastReport sahifasini tutib olib, to'g'ridan-to'g'ri Telegramga uzatish
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const ADMIN_USER_ID = "5314298089";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Xotiradagi tanlangan bemor
let activePatient = null;

// 1. Xotiradan so'nggi bemorni yuklab olish
try {
  chrome.storage.local.get(["lastActivePatient"], (res) => {
    if (res && res.lastActivePatient) {
      activePatient = res.lastActivePatient;
    }
  });
} catch (e) {}

// 2. Background / Popup-dan xabar kelganda javob berish
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
  if (request.action === "CLICK_PRINTER_BTN") {
    const clicked = clickFastReportOrKarmedPrinterButton();
    sendResponse({ success: clicked });
    return true;
  }
  if (request.action === "PDF_TAB_READY") {
    renderPdfCaptureBanner(request.pdfUrl || window.location.href);
    return true;
  }
});

// 3. Karmed Jadvalini va PDF Sahifalarini Kuzatish
function initTableObserver() {
  // Agar bu yangi ochilgan PDF / FastReport Export sahifasi bo'lsa
  const currentUrl = window.location.href.toLowerCase();
  if (currentUrl.includes("fastreport.export") || currentUrl.includes(".pdf") || currentUrl.includes("export.axd") || currentUrl.includes("rapor")) {
    setTimeout(() => {
      renderPdfCaptureBanner(window.location.href);
    }, 600);
  }

  document.addEventListener("click", handleTableClickCapture, true);
  document.addEventListener("dblclick", handleTableClickCapture, true);

  const observer = new MutationObserver(() => {
    refreshActivePatientSubData();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  setInterval(() => {
    checkSelectedRow();
  }, 600);
}

// Asosiy jadval sarlavha ustunlari indekslarini aniqlash
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
    else if (txt.includes("tugilgan") || txt.includes("birthdate")) indexes.birthDate = idx;
    else if (txt.includes("pinfl") || txt.includes("pnfl") || txt.includes("jshshir")) indexes.pinfl = idx;
    else if (txt.includes("bolim") || txt.includes("ulangan")) indexes.department = idx;
    else if (txt.includes("namuna")) indexes.sampleNumber = idx;
    else if (txt.includes("royxatgaolingan") || txt.includes("regdate")) indexes.regDate = idx;
  });

  return indexes;
}

// Qatordan bemor ma'lumotlarini aniq ajratib olish
function parsePatientFromRow(row) {
  if (!row || row.tagName !== "TR") return null;

  if (row.classList.contains("group-header") || (row.children.length <= 2 && row.innerText.includes("("))) {
    return null;
  }

  const cells = Array.from(row.querySelectorAll("td"));
  if (cells.length < 5) return null;

  const firstCellText = cells[0].innerText.trim();
  if (/^R\d+/i.test(firstCellText) || firstCellText.includes("Kod") || firstCellText.includes("Xizmat")) {
    return null;
  }

  const table = row.closest("table");
  let headerRow = table ? table.querySelector("thead tr, tr:first-child") : null;
  const colIdx = getTableColumnIndexes(headerRow);

  const cellTexts = cells.map(c => c.innerText.trim());

  // 1. PINFL (14 xonali JSHSHIR)
  let pinfl = "";
  if (colIdx.pinfl !== -1 && /^\d{14}$/.test(cellTexts[colIdx.pinfl])) {
    pinfl = cellTexts[colIdx.pinfl];
  } else {
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

  if (!lastName || !firstName) {
    const nameCandidates = cellTexts.filter(t => 
      t.length >= 2 && 
      /^[A-ZА-ЯЁ\s'\-]+$/i.test(t) && 
      !t.includes("MRT") && !t.includes("MSKT") && !t.includes("RENTGEN") && !t.includes("SUGURTA") && !t.includes("REZIDENT")
    );
    if (nameCandidates.length >= 2) {
      lastName = nameCandidates[0] || "";
      firstName = nameCandidates[1] || "";
      middleName = nameCandidates[2] || "";
    }
  }

  const fullName = `${lastName} ${firstName} ${middleName}`.trim();

  // 4. Tug'ilgan sana va Yoshi
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

  // 6. Pastki jadvaldan Aniq Tekshiruv Nomi va Hisobot Muallifini olish
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
    serviceName: subTableData.serviceName || "Tibbiy Tekshiruv",
    reportAuthor: subTableData.reportAuthor || "Hali hisobot yozilmagan",
    transactionDate: subTableData.transactionDate || new Date().toISOString().split("T")[0],
    queueNumber: subTableData.queueNumber || "",
    rowElement: row
  };
}

// Pastki jadvaldan (Kod R202, R182, R78...) ANIQ ma'lumotlarni ajratish
function extractSubTableData() {
  let serviceNamesList = [];
  let reportAuthor = "";
  let transactionDate = "";
  let queueNumber = "";

  try {
    const allRows = Array.from(document.querySelectorAll("tr")).filter(r => {
      return r.offsetParent !== null && r.getBoundingClientRect().height > 0;
    });
    
    const serviceRows = allRows.filter(r => {
      const firstCell = r.querySelector("td:first-child");
      if (!firstCell) return false;
      const t = firstCell.innerText.trim();
      return /^R\d{2,4}\b/i.test(t);
    });

    if (serviceRows.length > 0) {
      serviceRows.forEach(r => {
        const cells = Array.from(r.querySelectorAll("td")).map(c => c.innerText.trim());
        if (cells.length >= 3) {
          const sName = cells[1];
          if (sName && !sName.includes("Kod") && !sName.includes("Xizmat") && !serviceNamesList.includes(sName)) {
            serviceNamesList.push(sName);
          }

          if (cells[2] && cells[2].includes(".")) {
            transactionDate = cells[2];
          }

          if (cells[3] && /^\d{5,9}$/.test(cells[3])) {
            queueNumber = cells[3];
          }

          const authorCell = cells.length > 5 ? cells[5].trim() : "";
          if (authorCell && 
              authorCell.length > 3 && 
              /^[A-ZА-ЯЁ][a-zа-яё']+\s+[A-ZА-ЯЁ]/.test(authorCell) && 
              !authorCell.includes("Paket") && 
              !authorCell.includes("Kodi") && 
              !authorCell.includes("Xizmat")) {
            reportAuthor = authorCell;
          }
        }
      });
    }

  } catch (e) {
    console.warn("extractSubTableData error:", e);
  }

  const finalServiceName = serviceNamesList.length > 0 ? serviceNamesList.join(", ") : "Tibbiy Tekshiruv";
  const finalAuthor = reportAuthor ? reportAuthor : "Hali hisobot yozilmagan";

  return {
    serviceName: finalServiceName,
    reportAuthor: finalAuthor,
    transactionDate,
    queueNumber
  };
}

// Tanlangan bemorning sub-ma'lumotlarini yangilash
function refreshActivePatientSubData() {
  if (!activePatient) return;

  const subData = extractSubTableData();
  let changed = false;

  if (subData.serviceName && subData.serviceName !== "Tibbiy Tekshiruv" && activePatient.serviceName !== subData.serviceName) {
    activePatient.serviceName = subData.serviceName;
    changed = true;
  }

  if (activePatient.reportAuthor !== subData.reportAuthor) {
    activePatient.reportAuthor = subData.reportAuthor;
    changed = true;
  }

  if (changed) {
    saveActivePatientToStorage(activePatient);
    renderPatientBanner(activePatient);
  }
}

// Jadvalda qator bosilganda
function handleTableClickCapture(e) {
  const row = e.target.closest("tr");
  if (!row) return;

  const patient = parsePatientFromRow(row);
  if (patient && (patient.pinfl || patient.patientId !== "Noma'lum")) {
    activePatient = patient;
    saveActivePatientToStorage(patient);
    renderPatientBanner(patient);

    [100, 250, 500, 900, 1500].forEach(delay => {
      setTimeout(() => {
        refreshActivePatientSubData();
      }, delay);
    });
  }
}

// Tanlangan qatorni avtomatik aniqlash
function checkSelectedRow() {
  const allRows = Array.from(document.querySelectorAll("tr"));
  
  for (const row of allRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 5) continue;
    
    const firstCell = cells[0].innerText.trim();
    if (/^R\d+/i.test(firstCell) || firstCell.includes("Kod") || firstCell.includes("Xizmat")) continue;

    const isClassSelected = row.className && /selected|active|highlight|current/i.test(row.className);
    const hasStyleBg = row.getAttribute("style") && /background/i.test(row.getAttribute("style"));
    const bgColor = window.getComputedStyle(row).backgroundColor;
    const isColored = bgColor && bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "rgb(255, 255, 255)" && bgColor !== "transparent";

    if (isClassSelected || hasStyleBg || isColored) {
      const patient = parsePatientFromRow(row);
      if (patient && (patient.pinfl || patient.patientId !== "Noma'lum")) {
        if (!activePatient || activePatient.patientId !== patient.patientId || activePatient.pinfl !== patient.pinfl) {
          activePatient = patient;
          saveActivePatientToStorage(patient);
          renderPatientBanner(patient);

          [100, 250, 500, 900, 1500].forEach(delay => {
            setTimeout(() => {
              refreshActivePatientSubData();
            }, delay);
          });
        } else {
          refreshActivePatientSubData();
        }
        break;
      }
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

// 4. YAGONA VA TOZA SUZUVCHI BEMOR PANELI (Printer tugmasi bilan)
function renderPatientBanner(p) {
  let banner = document.getElementById("karmedPatientInfoBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "karmedPatientInfoBanner";
    banner.className = "karmed-patient-banner";
    document.body.appendChild(banner);
  }

  const isPending = p.reportAuthor === "Hali hisobot yozilmagan" || !p.reportAuthor;
  const authorBadgeHtml = isPending 
    ? `<span class="karmed-author-pending"><i class="fa-solid fa-hourglass-half"></i> Hali hisobot yozilmagan</span>`
    : `<b style="color:#0284c7;">${escapeHtml(p.reportAuthor)}</b>`;

  banner.innerHTML = `
    <div class="karmed-banner-content">
      <div class="karmed-banner-left">
        <div class="karmed-banner-badge"><i class="fa-solid fa-user-check"></i> Tanlangan Bemor</div>
        <div class="karmed-banner-name"><b>${escapeHtml(p.fullName)}</b> <span class="karmed-age-tag">${escapeHtml(p.age || p.birthDate)}</span></div>
        <div class="karmed-banner-meta">
          <span><b>ID:</b> ${escapeHtml(p.patientId)}</span> • 
          <span><b>PNFL:</b> <code class="karmed-pnfl-code">${escapeHtml(p.pinfl || 'Kiritilmagan')}</code></span> • 
          <span><b>Fayl shifokori:</b> ${escapeHtml(p.fileDoctor)}</span> • 
          <span><b>Hisobot muallifi:</b> ${authorBadgeHtml}</span>
        </div>
        <div class="karmed-banner-service">
          <i class="fa-solid fa-microscope"></i> <b>Tekshiruv:</b> <span>${escapeHtml(p.serviceName)}</span>
        </div>
      </div>
      <div class="karmed-banner-actions">
        <button type="button" class="karmed-btn-action karmed-btn-printer" id="btnBannerPrinter" title="Printer tugmasini bosib yangi oynada PDF ochish">
          <i class="fa-solid fa-print"></i> Printer (PDF yangi oynada ochish)
        </button>
        <button type="button" class="karmed-btn-action karmed-btn-save-report" id="btnBannerSaveReport" title="Ushbu bemor xulosasini Telegramga saqlash">
          <i class="fa-solid fa-paper-plane"></i> Xulosani Saqlash & Telegram
        </button>
      </div>
    </div>
  `;

  banner.style.display = "block";

  // "Printer" tugmasi bosilganda
  document.getElementById("btnBannerPrinter").onclick = (e) => {
    e.stopPropagation();
    clickFastReportOrKarmedPrinterButton();
  };

  // "Xulosani Saqlash" hodisasi
  document.getElementById("btnBannerSaveReport").onclick = (e) => {
    e.stopPropagation();
    handleDirectSaveClick();
  };
}

// 5. YANGI OYNA (PDF / FASTREPORT EXPORT) UCHUN TO'G'RIDAN-TO'G'RI TUTIB OLISH VA TELEGRAMGA YUBORISH PANELI
function renderPdfCaptureBanner(pdfUrl) {
  let banner = document.getElementById("karmedPdfCaptureBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "karmedPdfCaptureBanner";
    banner.className = "karmed-pdf-banner";
    document.body.appendChild(banner);
  }

  const p = activePatient || {};
  const data = extractKarmedPageData();

  banner.innerHTML = `
    <div class="karmed-pdf-content">
      <div class="karmed-pdf-info">
        <span class="karmed-pdf-badge"><i class="fa-solid fa-file-pdf"></i> PDF Xulosa Tayyor!</span>
        <span class="karmed-pdf-title"><b>${escapeHtml(data.patientName || p.fullName || 'Bemor')}</b> (PNFL: <code>${escapeHtml(data.pinfl || p.pinfl || '-')}</code>)</span>
      </div>
      <div class="karmed-pdf-btns">
        <button type="button" class="karmed-btn-action karmed-btn-send-tg" id="btnPdfSendTelegram">
          <i class="fa-solid fa-paper-plane"></i> 🚀 Telegramga Yuborish & Saqlash
        </button>
      </div>
    </div>
  `;

  banner.style.display = "block";

  document.getElementById("btnPdfSendTelegram").onclick = async () => {
    const btn = document.getElementById("btnPdfSendTelegram");
    btn.disabled = true;
    btn.innerHTML = "⏳ Telegramga yuborilmoqda...";

    await sendCurrentReportToTelegramAndFirebase(data, pdfUrl);
    btn.innerHTML = "✅ Muvaffaqiyatli yuborildi!";
  };
}

// FASTREPORT VA KARMED PRINTER / SAVE TUGMASINI BOSISH
function clickFastReportOrKarmedPrinterButton() {
  try {
    // 1. FastReport WebViewer toolbar (media_1787723249015.png - 3-ikonka Printer, 2-ikonka Save)
    const frIcons = Array.from(document.querySelectorAll("img, a, button, div, span")).filter(el => {
      const src = (el.src || "").toLowerCase();
      const title = (el.title || el.getAttribute("aria-label") || "").toLowerCase();
      return (src.includes("print") || src.includes("save") || src.includes("yazdir") || src.includes("export") ||
              title.includes("print") || title.includes("save") || title.includes("yazdir") || title.includes("kaydet")) &&
              !el.closest("#karmedPatientInfoBanner") && !el.closest("#karmedPdfCaptureBanner");
    });

    if (frIcons.length > 0) {
      // 3-ikonka (Printer) yoki 1-topilgan tugma
      const target = frIcons.find(el => (el.src || "").toLowerCase().includes("print") || (el.title || "").toLowerCase().includes("print")) || frIcons[0];
      const win = target.ownerDocument?.defaultView || window;
      const mouseOpts = { bubbles: true, cancelable: true, view: win };
      
      target.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
      target.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
      target.dispatchEvent(new MouseEvent("click", mouseOpts));
      if (typeof target.click === "function") target.click();

      showToastNotification("🖨️ Printer tugmasi bosildi! PDF yangi oynada ochilmoqda...");
      return true;
    }

    // 2. Karmed umumiy menyusidagi Printer
    const printerTarget = findPrinterElementDeep(document);
    if (printerTarget) {
      const win = printerTarget.ownerDocument?.defaultView || window;
      const mouseOpts = { bubbles: true, cancelable: true, view: win };
      printerTarget.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
      printerTarget.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
      printerTarget.dispatchEvent(new MouseEvent("click", mouseOpts));
      if (typeof printerTarget.click === "function") printerTarget.click();

      showToastNotification("🖨️ Printer tugmasi bosildi! PDF ochilmoqda...");
      return true;
    }

    showToastNotification("⚠️ Yuqori chap burchakdagi Printer (🖨️) belgisini bosing.");
    return false;

  } catch (err) {
    console.warn("clickFastReportOrKarmedPrinterButton error:", err);
    return false;
  }
}

// PRINTER TUGMASINI CHUQUR IZLAB TOPISH
function findPrinterElementDeep(doc = document) {
  if (!doc) return null;

  try {
    const allEls = Array.from(doc.querySelectorAll("*"));

    for (const el of allEls) {
      if (el.id === "karmedPatientInfoBanner" || el.id === "karmedPdfCaptureBanner" || el.closest("#karmedPatientInfoBanner") || el.closest("#karmedPdfCaptureBanner")) continue;
      
      const text = (el.innerText || "").trim().toLowerCase();
      const title = (el.getAttribute("title") || "").trim().toLowerCase();
      const alt = (el.getAttribute("alt") || "").trim().toLowerCase();
      const id = (el.id || "").toLowerCase();
      const cls = (typeof el.className === "string" ? el.className : "").toLowerCase();

      if (text === "printer" || text.startsWith("printer") || text === "yazdır" || text === "yazdir" ||
          title.includes("printer") || title.includes("yazdir") || 
          alt.includes("printer") || alt.includes("yazdir") ||
          id.includes("btnprint") || id.includes("printer") || 
          cls.includes("btn-printer") || cls.includes("icon-print") || cls.includes("fa-print")) {
        return el;
      }
    }

    for (const el of allEls) {
      if (el.tagName === "IMG") {
        const src = (el.src || "").toLowerCase();
        if (src.includes("print") || src.includes("yazdir") || src.includes("printer")) {
          return el.closest("button, a, div, td, table, span") || el;
        }
      }
    }

    const iframes = Array.from(doc.querySelectorAll("iframe, frame"));
    for (const ifr of iframes) {
      try {
        const ifrDoc = ifr.contentDocument || ifr.contentWindow?.document;
        if (ifrDoc) {
          const found = findPrinterElementDeep(ifrDoc);
          if (found) return found;
        }
      } catch (e) {}
    }
  } catch (err) {
    console.warn("findPrinterElementDeep error:", err);
  }

  return null;
}

// 6. FASTREPORT / RADYOLOJI RAPORU SAHIFASIDAN TO'LIQ XULOSA MATNINI AJRATIB OLISH
function extractConclusionTextFromEditor() {
  try {
    const pageText = document.body.innerText || "";

    const protoIndex = pageText.indexOf("ПРОТОКОЛ");
    if (protoIndex !== -1) {
      let sub = pageText.substring(protoIndex).trim();
      const cutEnd = sub.indexOf("Tanlangan Bemor");
      if (cutEnd !== -1) sub = sub.substring(0, cutEnd).trim();
      const cutEnd2 = sub.indexOf("PDF Xulosa Tayyor");
      if (cutEnd2 !== -1) sub = sub.substring(0, cutEnd2).trim();
      return sub;
    }

    const mrtIndex = pageText.indexOf("МРТ ОРГАНОВ");
    if (mrtIndex !== -1) {
      let sub = pageText.substring(mrtIndex).trim();
      const cutEnd = sub.indexOf("Tanlangan Bemor");
      if (cutEnd !== -1) sub = sub.substring(0, cutEnd).trim();
      return sub;
    }

    if (pageText.includes("РЕСПУБЛИКАНСКИЙ") || pageText.includes("Report") || pageText.includes("PINFL :")) {
      const reportContentMatch = pageText.match(/(?:РЕСПУБЛИКАНСКИЙ[\s\S]+?)(?:Врач|Шифокор|Reporting Doctor|$)/i);
      if (reportContentMatch && reportContentMatch[0].length > 50) {
        return reportContentMatch[0].trim();
      }
    }

    const editables = Array.from(document.querySelectorAll("[contenteditable='true'], [contenteditable=''], .dx-htmleditor-content, .k-editor-content, textarea, div[role='textbox'], .report-text"));
    for (const el of editables) {
      const raw = (el.value || el.innerText || "").trim();
      if (raw.length > 30 && (raw.includes("ПРОТОКОЛ") || raw.includes("Техника") || raw.includes("ЗАКЛЮЧЕНИЕ") || raw.includes("МРТ"))) {
        return raw;
      }
    }

  } catch (e) {
    console.warn("extractConclusionTextFromEditor error:", e);
  }

  return "";
}

// 7. Ichki sahifadan to'liq ma'lumotlarni o'qish
function extractKarmedPageData() {
  let pinfl = activePatient ? activePatient.pinfl : "";
  let patientName = activePatient ? activePatient.fullName : "";
  let serviceName = activePatient ? activePatient.serviceName : "";
  let doctorName = activePatient ? (activePatient.reportAuthor !== "Hali hisobot yozilmagan" ? activePatient.reportAuthor : activePatient.fileDoctor) : "";
  let date = new Date().toISOString().split("T")[0];

  try {
    const pageText = document.body.innerText || "";

    const pinflMatch = pageText.match(/PINFL\s*[:：]\s*(\d{14})/i);
    if (pinflMatch) pinfl = pinflMatch[1];

    const repDocMatch = pageText.match(/Reporting\s*Doctor\s*[:：]\s*([^\n\r\t]+)/i);
    if (repDocMatch) doctorName = repDocMatch[1].trim();

    const nameMatch = pageText.match(/Name\s*[:：]\s*([^\n\r\t]+)/i);
    const lastNameMatch = pageText.match(/Last\s*name\s*[:：]\s*([^\n\r\t]+)/i);
    if (nameMatch) {
      patientName = `${nameMatch[1].trim()} ${lastNameMatch ? lastNameMatch[1].trim() : ''}`.trim();
    }

  } catch (e) {
    console.warn("extractKarmedPageData error:", e);
  }

  const conclusionText = extractConclusionTextFromEditor();

  return {
    pinfl,
    patientName,
    serviceName: serviceName || "Tibbiy Tekshiruv",
    doctorName: doctorName || "Shifokor-Radiolog",
    conclusionText,
    date
  };
}

// 8. TELEGRAM VA FIREBASE-GA TO'G'RIDAN-TO'G'RI YUBORISH FUNKSIYASI
async function sendCurrentReportToTelegramAndFirebase(data, pdfUrl = "") {
  const pinfl = data.pinfl || (activePatient ? activePatient.pinfl : "");
  const patientName = data.patientName || (activePatient ? activePatient.fullName : "Bemor");
  const serviceName = data.serviceName || (activePatient ? activePatient.serviceName : "Tibbiy Tekshiruv");
  const doctorName = data.doctorName || (activePatient ? (activePatient.reportAuthor || activePatient.fileDoctor) : "Shifokor-Radiolog");
  const conclusionText = data.conclusionText || "Tibbiy xulosa fayli biriktirildi.";
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
    doctorName,
    reportAuthor: activePatient ? activePatient.reportAuthor : doctorName,
    fileDoctor: activePatient ? activePatient.fileDoctor : "",
    reportDate: dateStr,
    conclusionText,
    pdfUrl: pdfUrl || "",
    createdAt: Date.now(),
    source: "FastReport PDF Capture"
  };

  try {
    // 1. Firebase-ga saqlash
    if (pinfl && pinfl.length === 14) {
      await fetch(`${FIREBASE_DB_URL}/karmed_reports/${pinfl}/${reportId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData)
      });
    }

    // 2. Telegram xabari
    const tgMsg = 
      `📄 <b>YANGI TIBBIY XULOSA (PDF) SAQLANDI</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Bemor:</b> ${escapeHtml(patientName)}\n` +
      `🎂 <b>Yoshi:</b> ${escapeHtml(reportData.age || reportData.birthDate || '-')}\n` +
      `🆔 <b>Bemor ID:</b> ${escapeHtml(reportData.patientId || '-')}\n` +
      `🔢 <b>PNFL (JSHSHIR):</b> <code>${pinfl || 'Noma\'lum'}</code>\n` +
      `🔬 <b>Tekshiruv:</b> ${escapeHtml(serviceName)}\n` +
      `✍️ <b>Hisobot muallifi:</b> ${escapeHtml(doctorName)}\n` +
      `📅 <b>Sana:</b> ${dateStr}\n` +
      (pdfUrl ? `🔗 <b>PDF Havolasi:</b> <a href="${pdfUrl}">Yuklab olish</a>\n` : '') +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📝 <b>Xulosa Matni:</b>\n${escapeHtml(conclusionText.substring(0, 3000))}`;

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

    showToastNotification(`✅ Telegramga yuborildi: ${patientName} (${pinfl})`);
    alert(`✅ Muvaffaqiyatli saqlandi va Telegramga yuborildi!\n\n👤 Bemor: ${patientName}\n🔢 PNFL: ${pinfl}\n📢 Kanalga va bot bazasiga yetkazildi!`);
    return true;

  } catch (err) {
    alert("Yuborishda xatolik: " + err.message);
    return false;
  }
}

// 9. Yagona Saqlash Modali
async function handleDirectSaveClick() {
  const data = extractKarmedPageData();

  if (data.conclusionText && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(data.conclusionText).catch(() => {});
  }

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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <label style="margin:0;"><b>Tibbiy Xulosa Matni:</b></label>
            <div style="display:flex; gap:6px;">
              <button type="button" id="btnKarmedModalPrinter" style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:5px; padding:2px 8px; font-size:11px; font-weight:700; cursor:pointer; color:#065f46;">
                <i class="fa-solid fa-print"></i> Printer bosish
              </button>
              <button type="button" id="btnKarmedModalRefresh" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:5px; padding:2px 8px; font-size:11px; font-weight:700; cursor:pointer; color:#0369a1;">
                <i class="fa-solid fa-arrows-rotate"></i> Qayta o'qish
              </button>
              <button type="button" id="btnKarmedModalCopy" style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:5px; padding:2px 8px; font-size:11px; font-weight:700; cursor:pointer; color:#0369a1;">
                <i class="fa-solid fa-copy"></i> Nusxalash
              </button>
            </div>
          </div>
          <textarea id="kModalText" rows="7" placeholder="Karmed hisobot/PDF sahifasidan nusxalangan xulosa matni...">${escapeHtml(data.conclusionText || '')}</textarea>
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

  document.getElementById("btnKarmedModalPrinter").onclick = () => {
    clickFastReportOrKarmedPrinterButton();
  };

  document.getElementById("btnKarmedModalRefresh").onclick = () => {
    const refreshedText = extractConclusionTextFromEditor();
    if (refreshedText) {
      document.getElementById("kModalText").value = refreshedText;
      showToastNotification("🔄 Matn Karmed-dan qayta o'qildi!");
    } else {
      showToastNotification("⚠️ Xulosa matni topilmadi.");
    }
  };

  document.getElementById("btnKarmedModalCopy").onclick = () => {
    const textVal = document.getElementById("kModalText").value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textVal);
      showToastNotification("📋 Xulosa matni nusxalandi!");
    }
  };

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

    const customData = {
      pinfl,
      patientName,
      serviceName,
      doctorName,
      conclusionText
    };

    await sendCurrentReportToTelegramAndFirebase(customData);
    modal.remove();
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

// Boshlash
setTimeout(() => {
  initTableObserver();
}, 1000);
