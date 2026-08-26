/**
 * Karmed Xulosalar Portali - Injected Content Script
 * 1. Aniq jadval tahlili: F.I.Sh, Yoshi, Bemor ID, PNFL, Fayl shifokori, Hisobot muallifi, Tekshiruv nomi
 * 2. Printer tugmasini chuqur (Deep & Iframe) izlab avtomatik bosish
 * 3. FastReport/PDF va Hisobot sahifalaridan to'liq xulosani ajratib olish va Telegramga uzatish
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
  if (request.action === "CLICK_PRINTER_BTN") {
    const clicked = clickKarmedPrinterButton();
    sendResponse({ success: clicked });
    return true;
  }
});

// 2. Karmed Jadvalini Kuzatish
function initTableObserver() {
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

// 3. YAGONA VA TOZA SUZUVCHI BEMOR PANELI (Printer tugmasi bilan)
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
        <button type="button" class="karmed-btn-action karmed-btn-printer" id="btnBannerPrinter" title="Printer tugmasini bosib, PDF hisobotni ochish">
          <i class="fa-solid fa-print"></i> Printer (PDF ochish)
        </button>
        <button type="button" class="karmed-btn-action karmed-btn-open-files" id="btnBannerOpenFiles" title="Bemorning tibbiy xisobot oynasini ochish">
          <i class="fa-solid fa-file-signature"></i> Hisobotni Ochish
        </button>
        <button type="button" class="karmed-btn-action karmed-btn-save-report" id="btnBannerSaveReport" title="Ushbu bemor xulosasini Telegramga saqlash">
          <i class="fa-solid fa-cloud-arrow-up"></i> Xulosani Saqlash
        </button>
      </div>
    </div>
  `;

  banner.style.display = "block";

  document.getElementById("btnBannerPrinter").onclick = (e) => {
    e.stopPropagation();
    clickKarmedPrinterButton();
  };

  document.getElementById("btnBannerOpenFiles").onclick = (e) => {
    e.stopPropagation();
    openPatientFilesAction(p);
  };

  document.getElementById("btnBannerSaveReport").onclick = (e) => {
    e.stopPropagation();
    handleDirectSaveClick();
  };
}

// PRINTER TUGMASINI CHUQUR IZLAB TOPISH (Deep Search across DOM and all Iframes)
function findPrinterElementDeep(doc = document) {
  if (!doc) return null;

  try {
    const allEls = Array.from(doc.querySelectorAll("*"));

    // 1. Text yoki Title "Printer" / "Yazdır" bo'lgan elementni qidirish
    for (const el of allEls) {
      if (el.id === "karmedPatientInfoBanner" || el.closest("#karmedPatientInfoBanner")) continue;
      
      const text = (el.innerText || "").trim().toLowerCase();
      const title = (el.getAttribute("title") || "").trim().toLowerCase();
      const alt = (el.getAttribute("alt") || "").trim().toLowerCase();
      const id = (el.id || "").toLowerCase();
      const cls = (typeof el.className === "string" ? el.className : "").toLowerCase();

      // Tugma yoki ikonka bo'lishi mumkin bo'lgan elementlar
      if (text === "printer" || text.startsWith("printer") || text === "yazdır" || text === "yazdir" ||
          title.includes("printer") || title.includes("yazdir") || 
          alt.includes("printer") || alt.includes("yazdir") ||
          id.includes("btnprint") || id.includes("printer") || 
          cls.includes("btn-printer") || cls.includes("icon-print") || cls.includes("fa-print")) {
        return el;
      }
    }

    // 2. IMG rasmlar ichidan qidirish (src da print / printer / yazdir)
    for (const el of allEls) {
      if (el.tagName === "IMG") {
        const src = (el.src || "").toLowerCase();
        if (src.includes("print") || src.includes("yazdir") || src.includes("printer")) {
          return el.closest("button, a, div, td, table, span") || el;
        }
      }
    }

    // 3. Top Toolbar konteyneri ichidagi 4-element
    for (const el of allEls) {
      const t = (el.innerText || "").toLowerCase();
      if (t.includes("saqlash") && t.includes("bekor qilish") && t.includes("del")) {
        const buttons = Array.from(el.querySelectorAll("button, a, div, td, table, span, img")).filter(b => {
          const bt = (b.innerText || b.getAttribute("title") || "").toLowerCase();
          return bt.includes("printer") || bt.includes("yazdir");
        });
        if (buttons.length > 0) return buttons[0];
      }
    }

    // 4. Barcha IFRAME larni rekursiv qidirish
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

// PRINTER TUGMASINI BOSISH
function clickKarmedPrinterButton() {
  try {
    const printerTarget = findPrinterElementDeep(document);

    if (printerTarget) {
      const win = printerTarget.ownerDocument?.defaultView || window;
      const mouseOpts = { bubbles: true, cancelable: true, view: win };

      printerTarget.dispatchEvent(new MouseEvent("mouseenter", mouseOpts));
      printerTarget.dispatchEvent(new MouseEvent("mouseover", mouseOpts));
      printerTarget.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
      printerTarget.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
      printerTarget.dispatchEvent(new MouseEvent("click", mouseOpts));
      
      if (typeof printerTarget.click === "function") {
        printerTarget.click();
      }

      showToastNotification("🖨️ Printer tugmasi bosildi! PDF sahifasi ochilmoqda...");
      return true;
    } else {
      showToastNotification("⚠️ Printer tugmasi avtomatik topilmadi. Yuqoridagi Printer ikonkasini bosing.");
      return false;
    }
  } catch (err) {
    console.warn("clickKarmedPrinterButton error:", err);
    showToastNotification("⚠️ Xatolik: " + err.message);
    return false;
  }
}

// Bemor xisobot faylini ochish hodisasi
function openPatientFilesAction(p) {
  if (p.rowElement) {
    const targetCell = p.rowElement.querySelector("td:nth-child(3), td:nth-child(4), td:nth-child(2)") || p.rowElement;

    const mouseOpts = { bubbles: true, cancelable: true, view: window };
    targetCell.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
    targetCell.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
    targetCell.dispatchEvent(new MouseEvent("click", mouseOpts));
    targetCell.dispatchEvent(new MouseEvent("mousedown", mouseOpts));
    targetCell.dispatchEvent(new MouseEvent("mouseup", mouseOpts));
    targetCell.dispatchEvent(new MouseEvent("click", mouseOpts));
    targetCell.dispatchEvent(new MouseEvent("dblclick", mouseOpts));

    p.rowElement.dispatchEvent(new MouseEvent("dblclick", mouseOpts));

    setTimeout(() => {
      const hisobotBtns = Array.from(document.querySelectorAll("button, a, div, span, input[type='button']")).filter(el => {
        const t = (el.innerText || el.value || "").trim().toLowerCase();
        return (t === "hisobot" || t === "ris hisobotlari" || t === "natija hisobotlari" || t.startsWith("hisobot bo")) && 
               !t.includes("viewer") && !t.includes("pacs") && !t.includes("dicom");
      });

      if (hisobotBtns.length > 0) {
        hisobotBtns[0].click();
      }
    }, 150);
  }

  showToastNotification(`📄 ${p.fullName} hisobot fayli ochilmoqda...`);
}

// 4. FASTREPORT / PDF VA MUHARRIRDAN TO'LIQ XULOSA MATNINI AJRATIB OLISH
function extractConclusionTextFromEditor() {
  try {
    const pageText = document.body.innerText || "";

    // A) FastReport Export / Print sahifasi
    if (pageText.includes("РЕСПУБЛИКАНСКИЙ") || pageText.includes("Report") || pageText.includes("PINFL :")) {
      const reportContentMatch = pageText.match(/(?:РЕСПУБЛИКАНСКИЙ[\s\S]+?)(?:Врач|Шифокор|Reporting Doctor|$)/i);
      if (reportContentMatch && reportContentMatch[0].length > 50) {
        return reportContentMatch[0].trim();
      }
    }

    // B) Muharrir ichidagi toza matn blokini ajratish
    const editables = Array.from(document.querySelectorAll("[contenteditable='true'], [contenteditable=''], .dx-htmleditor-content, .k-editor-content, textarea, div[role='textbox'], .report-text"));
    for (const el of editables) {
      const raw = (el.value || el.innerText || "").trim();
      if (raw.length > 30 && (raw.includes("ПРОТОКОЛ") || raw.includes("Техника") || raw.includes("ЗАКЛЮЧЕНИЕ") || raw.includes("МРТ"))) {
        return raw;
      }
    }

    // Iframe larni tekshirish
    const iframes = Array.from(document.querySelectorAll("iframe"));
    for (const ifr of iframes) {
      try {
        const doc = ifr.contentDocument || ifr.contentWindow?.document;
        if (doc && doc.body) {
          const iTxt = (doc.body.innerText || "").trim();
          if (iTxt.length > 30 && (iTxt.includes("ПРОТОКОЛ") || iTxt.includes("Техника") || iTxt.includes("ЗАКЛЮЧЕНИЕ") || iTxt.includes("МРТ"))) {
            return iTxt;
          }
        }
      } catch (e) {}
    }

    // Matndan ПРОТОКОЛ dan boshlanuvchi blokni kesib olish
    const protoIndex = pageText.indexOf("ПРОТОКОЛ");
    if (protoIndex !== -1) {
      const sub = pageText.substring(protoIndex);
      const endMatch = sub.match(/ЗАКЛЮЧЕНИЕ[\s\S]+?(?=(?:Natija va tavsiyalar|Tanlangan Bemor|Saqlash \(F3\)|$))/i);
      if (endMatch) {
        return endMatch[0].trim();
      }
      return sub.substring(0, 2500).trim();
    }

    const mrtIndex = pageText.indexOf("МРТ ОРГАНОВ");
    if (mrtIndex !== -1) {
      const sub = pageText.substring(mrtIndex);
      return sub.substring(0, 2500).trim();
    }

  } catch (e) {
    console.warn("extractConclusionTextFromEditor error:", e);
  }

  return "";
}

// 5. Ichki sahifadan to'liq ma'lumotlarni o'qish
function extractKarmedPageData() {
  let pinfl = activePatient ? activePatient.pinfl : "";
  let patientName = activePatient ? activePatient.fullName : "";
  let serviceName = activePatient ? activePatient.serviceName : "";
  let doctorName = activePatient ? (activePatient.reportAuthor !== "Hali hisobot yozilmagan" ? activePatient.reportAuthor : activePatient.fileDoctor) : "";
  let date = new Date().toISOString().split("T")[0];

  try {
    const pageText = document.body.innerText || "";

    const titleMatch = pageText.match(/Radiologiya\s*Hisobot\s*[:：]\s*([^\/]+)\/\s*([^\/]+)\/\s*([^\/]+)\/\s*([^\/]+)/i);
    if (titleMatch) {
      if (!patientName || patientName === "Bemor") {
        patientName = titleMatch[1].trim();
      }
      if (!serviceName || serviceName === "Tibbiy Tekshiruv") {
        serviceName = titleMatch[4].trim();
      }
    }

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

// 6. Yagona Saqlash Modali
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
    clickKarmedPrinterButton();
  };

  document.getElementById("btnKarmedModalRefresh").onclick = () => {
    const refreshedText = extractConclusionTextFromEditor();
    if (refreshedText) {
      document.getElementById("kModalText").value = refreshedText;
      showToastNotification("🔄 Matn Karmed-dan qayta o'qildi!");
    } else {
      showToastNotification("⚠️ Muharrirdan matn topilmadi. Printerni bosing.");
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
      await fetch(`${FIREBASE_DB_URL}/karmed_reports/${pinfl}/${reportId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData)
      });

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

      fetch(`${TG_API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHANNEL_ID, text: tgMsg, parse_mode: "HTML" })
      }).catch(() => {});

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

// Boshlash
setTimeout(() => {
  initTableObserver();
}, 1000);
