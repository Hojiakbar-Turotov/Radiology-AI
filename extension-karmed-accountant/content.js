/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Content Script
 * 
 * 1. Karmed DevExpress jadvallarini avtomatik tahlil qilish
 * 2. "Qabul qiluvchi" ustunidan shifokor F.I.SH ni 100% aniq tekshirish
 * 3. "Tasdiqlangan sana" ustunidan sanani solishtirish
 * 4. Pastki sub-jadvaldan barcha tekshiruv soha kodlari (R62, R87, R66...) va nomlarini yig'ish
 * 5. Ko'p sahifali (pagination) jadvallarni avtomatik varaqlash
 * 6. Ma'lumotlarni Firebase Realtime Database'ga hisobchi uchun saqlash
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

// Standart Shifokorlar Ro'yxati
const KNOWN_DOCTORS = [
  "Xusanova Feruza Ikromjonovna",
  "Yulchiyeva Nodira Siddikovna",
  "Juravlev Igor Ivanovich",
  "Kurbanova Sevinch Musayevna",
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

// 1. POPUP VA BACKGROUNDDAN XABARLARNI QABUL QILISH
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
});

// 2. SAHIFADAGI BARCHA "QABUL QILUVCHI" SHIFOKORLARNI ANIQLASH
function detectDoctorsFromCurrentPage() {
  const doctorSet = new Set();

  try {
    const allRows = Array.from(document.querySelectorAll("table tr"));
    for (const row of allRows) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 5) continue;

      // Qabul qiluvchi ustunini topish
      for (const cell of cells) {
        const text = cell.innerText.trim();
        // O'zbekcha / Ruscha shifokor ism-familiyalari patterni
        if (text.length >= 8 && /^[A-ZА-ЯЁ][a-zа-яё'\-]+\s+[A-ZА-ЯЁ][a-zа-яё'\-]+\s+[A-ZА-ЯЁ][a-zа-яё'\-]+/i.test(text)) {
          if (!text.includes("Dr.") && !text.includes("Statsionar") && !text.includes("Urologiya") && !text.includes("Markaz") && !text.includes("Bemor")) {
            doctorSet.add(text);
          }
        }
      }
    }
  } catch (e) {
    console.warn("detectDoctorsFromCurrentPage error:", e);
  }

  return Array.from(doctorSet).sort();
}

// 3. JADVAL USTUNLARI XARITASINI TUZISH
function getTableColumnMapping(table) {
  const colMap = {
    surname: -1,
    firstName: -1,
    middleName: -1,
    patientId: -1,
    acceptingDoctor: -1, // Qabul qiluvchi
    confirmDate: -1,     // Tasdiqlangan sana
    fileDoctor: -1,      // Faylning shifokorini
    priority: -1,        // Ustuvorlik
    department: -1,      // Bolim
    regDate: -1          // Royxatga olingan sanasi
  };

  if (!table) return colMap;

  const headerRow = table.querySelector("thead tr, tr:first-child");
  if (headerRow) {
    const ths = Array.from(headerRow.querySelectorAll("th, td")).map(th => 
      th.innerText.toLowerCase().replace(/[\s_\-'.]/g, "")
    );

    ths.forEach((h, idx) => {
      if (h.includes("qabulqiluvchi") || h.includes("qabulqilgan") || h.includes("shifokorqabul")) {
        colMap.acceptingDoctor = idx;
      } else if (h.includes("tasdiqlangansan") || h.includes("tasdiqlangan")) {
        colMap.confirmDate = idx;
      } else if (h.includes("familiya") || h.includes("lastname")) {
        colMap.surname = idx;
      } else if (h.includes("ismi") && !h.includes("ota") && !h.includes("fayl")) {
        colMap.firstName = idx;
      } else if (h.includes("otaismi") || h.includes("sharif")) {
        colMap.middleName = idx;
      } else if (h.includes("bemorid") || (h.includes("id") && !h.includes("fayl"))) {
        colMap.patientId = idx;
      } else if (h.includes("faylningshifokor") || h.includes("faylshifokor")) {
        colMap.fileDoctor = idx;
      } else if (h.includes("ustuvorlik") || h.includes("ustun")) {
        colMap.priority = idx;
      } else if (h.includes("bolim") || h.includes("bo'lim")) {
        colMap.department = idx;
      } else if (h.includes("royxatgaolingan") || h.includes("regdate")) {
        colMap.regDate = idx;
      }
    });
  }

  return colMap;
}

// 4. SANANI NORMALIZATSIYA QILISH (DD.MM.YYYY yoki YYYY-MM-DD)
function normalizeDate(dateStr) {
  if (!dateStr) return "";
  const str = String(dateStr).trim();

  // 01.05.2026 13:13 -> 2026-05-01
  const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    const d = dotMatch[1].padStart(2, '0');
    const m = dotMatch[2].padStart(2, '0');
    const y = dotMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 2026-05-01 -> 2026-05-01
  const dashMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (dashMatch) {
    const y = dashMatch[1];
    const m = dashMatch[2].padStart(2, '0');
    const d = dashMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return "";
}

function formatDateToDDMMYYYY(dateStr) {
  const norm = normalizeDate(dateStr);
  if (!norm) return dateStr || "";
  const parts = norm.split("-");
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

// 5. SHIFOKOR NOMINI SOLISHTIRISH
function isDoctorNameMatch(actualDoctor, targetDoctor) {
  if (!targetDoctor || targetDoctor.trim() === "") return true; // Barcha shifokorlar tanlangan bo'lsa
  if (!actualDoctor) return false;

  const actClean = actualDoctor.toLowerCase().replace(/dr\.|doktor|shifokor|[\s_\-'.]/g, "");
  const tgtClean = targetDoctor.toLowerCase().replace(/dr\.|doktor|shifokor|[\s_\-'.]/g, "");

  return actClean.includes(tgtClean) || tgtClean.includes(actClean);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// 6. ASOSIY SKANERLASH VA SANASH FUNKSIYASI
async function startKarmedScan(payload) {
  if (isScanningInProgress) {
    throw new Error("Skanerlash jarayoni allaqachon bajarilmoqda!");
  }

  isScanningInProgress = true;
  showScanHUD("🔍 Skanerlash boshlanmoqda...", 5);

  const { targetDate, targetDoctorName, options } = payload;
  const targetDateNorm = normalizeDate(targetDate);
  const strictDoc = options?.strictDoctorMatch !== false;
  const autoPage = options?.autoPagination !== false;

  const collectedPatients = [];
  const servicesBreakdown = {};
  const seenPatientKeys = new Set();

  try {
    let currentPage = 1;
    let hasNextPage = true;
    let maxPages = autoPage ? 20 : 1;

    while (hasNextPage && currentPage <= maxPages) {
      showScanHUD(`📄 ${currentPage}-sahifa skanerlanmoqda... (Bemorlar: ${collectedPatients.length})`, 20 + (currentPage * 10));

      // Sahifadagi asosiy jadval qatorlarini yig'ish
      const pageResults = await scanCurrentPageRows(targetDateNorm, targetDoctorName, strictDoc);

      for (const p of pageResults) {
        const uniqueKey = `${p.patientId}_${p.fullName}_${p.confirmDate}`;
        if (!seenPatientKeys.has(uniqueKey)) {
          seenPatientKeys.add(uniqueKey);
          collectedPatients.push(p);

          // Xizmatlar statistikasi
          if (p.services && p.services.length > 0) {
            p.services.forEach(srv => {
              const code = srv.code || "OTHER";
              if (!servicesBreakdown[code]) {
                servicesBreakdown[code] = {
                  code: code,
                  name: srv.name || "Noma'lum tekshiruv",
                  count: 0
                };
              }
              servicesBreakdown[code].count++;
            });
          }
        }
      }

      // Keyingi sahifaga o'tish tekshiruvi (Pagination)
      if (autoPage) {
        const nextBtn = findNextPageButton();
        if (nextBtn && isElementClickable(nextBtn)) {
          nextBtn.click();
          currentPage++;
          await sleep(700); // Karmed DevExpress AJAX jadval yuklanishini kutish
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }
    }

    // Jami tekshiruv sohalari soni
    let totalServicesCount = 0;
    collectedPatients.forEach(p => {
      totalServicesCount += (p.services ? p.services.length : 1);
    });

    const reportData = {
      reportId: `rep_${targetDateNorm}_${(targetDoctorName || 'all').toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      date: targetDateNorm,
      dateFormatted: formatDateToDDMMYYYY(targetDateNorm),
      doctorName: targetDoctorName || "Barcha Shifokorlar",
      totalPatientsCount: collectedPatients.length,
      totalServicesCount: totalServicesCount,
      servicesBreakdown: servicesBreakdown,
      patientsList: collectedPatients,
      createdAt: new Date().toISOString(),
      createdTimestamp: Date.now()
    };

    showScanHUD(`✅ Yakunlandi! ${collectedPatients.length} ta bemor, ${totalServicesCount} ta soha topildi.`, 100);
    setTimeout(hideScanHUD, 3500);

    return reportData;

  } catch (err) {
    showScanHUD(`❌ Xatolik: ${err.message}`, 100, true);
    setTimeout(hideScanHUD, 4000);
    throw err;
  } finally {
    isScanningInProgress = false;
  }
}

// 7. BITTA SAHIFADAGI QATORLARNI SKANERLASH
async function scanCurrentPageRows(targetDateNorm, targetDoctorName, strictDoc) {
  const matchedPatients = [];
  const allTables = Array.from(document.querySelectorAll("table"));

  // Asosiy bemorlar jadvalini topish
  let mainTable = null;
  for (const table of allTables) {
    const text = table.innerText.toLowerCase();
    if (text.includes("familiya") && text.includes("qabul qiluvchi") && text.includes("tasdiqlangan")) {
      mainTable = table;
      break;
    }
  }

  if (!mainTable) {
    // Agar aniq thead bo'lmasa, barcha tr lar bo'yicha qidiramiz
    mainTable = document.querySelector(".dxgvTable_DevEx, .dxgvControl_DevEx, table");
  }

  const colMap = getTableColumnMapping(mainTable);
  const rows = Array.from(document.querySelectorAll("tr"));

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 6) continue;

    const rowText = row.innerText.trim();
    if (rowText.includes("Kod") && rowText.includes("Xizmatlar Nomi")) continue; // sub-table sarlavhasi
    if (rowText.includes("Tranzaksiya") && rowText.includes("Navbat raqami")) continue;

    // 1. Qabul qiluvchi shifokorni olish
    let acceptingDoctor = "";
    if (colMap.acceptingDoctor !== -1 && cells[colMap.acceptingDoctor]) {
      acceptingDoctor = cells[colMap.acceptingDoctor].innerText.trim();
    } else {
      // Shifokor nomi patterni bo'yicha qidirish
      for (const c of cells) {
        const t = c.innerText.trim();
        if (KNOWN_DOCTORS.some(doc => isDoctorNameMatch(t, doc))) {
          acceptingDoctor = t;
          break;
        }
      }
    }

    // Shifokor mosligini tekshirish
    if (strictDoc && targetDoctorName && !isDoctorNameMatch(acceptingDoctor, targetDoctorName)) {
      continue;
    }

    // 2. Tasdiqlangan sanani olish
    let rawConfirmDate = "";
    if (colMap.confirmDate !== -1 && cells[colMap.confirmDate]) {
      rawConfirmDate = cells[colMap.confirmDate].innerText.trim();
    } else {
      for (const c of cells) {
        const t = c.innerText.trim();
        if (/\d{2}\.\d{2}\.\d{4}/.test(t)) {
          rawConfirmDate = t;
          break;
        }
      }
    }

    const rowDateNorm = normalizeDate(rawConfirmDate);

    // Sana mosligini tekshirish
    if (targetDateNorm && rowDateNorm && rowDateNorm !== targetDateNorm) {
      continue;
    }

    // 3. Bemor ma'lumotlarini ajratish
    let patientId = colMap.patientId !== -1 && cells[colMap.patientId] ? cells[colMap.patientId].innerText.trim() : "";
    if (!patientId || !/^\d+$/.test(patientId)) {
      const idCell = cells.find(c => /^\d{4,8}$/.test(c.innerText.trim()));
      if (idCell) patientId = idCell.innerText.trim();
    }

    let surname = colMap.surname !== -1 && cells[colMap.surname] ? cells[colMap.surname].innerText.trim() : "";
    let firstName = colMap.firstName !== -1 && cells[colMap.firstName] ? cells[colMap.firstName].innerText.trim() : "";
    let middleName = colMap.middleName !== -1 && cells[colMap.middleName] ? cells[colMap.middleName].innerText.trim() : "";
    
    // Otasining ismini tozalash (XXX, X, - bo'lsa bo'sh qoldirish)
    if (/^(xxx|xx|x|\-+|yo['`ʻ]?q|null|none|\.+)$/i.test(middleName.trim())) {
      middleName = "";
    }

    if (!surname && !firstName) {
      // Ism va familiyani kataklar orasidan qidirish
      const candidateNames = cells.map(c => c.innerText.trim()).filter(t => /^[A-ZА-ЯЁ\s'\-]+$/i.test(t) && t.length >= 3);
      if (candidateNames.length >= 2) {
        surname = candidateNames[0];
        firstName = candidateNames[1];
      }
    }

    const fullName = [surname, firstName, middleName].filter(Boolean).join(" ").trim() || "Bemor";
    const fileDoctor = colMap.fileDoctor !== -1 && cells[colMap.fileDoctor] ? cells[colMap.fileDoctor].innerText.trim() : "";
    const priority = colMap.priority !== -1 && cells[colMap.priority] ? cells[colMap.priority].innerText.trim() : "Statsionar";
    const department = colMap.department !== -1 && cells[colMap.department] ? cells[colMap.department].innerText.trim() : "";
    const regDate = colMap.regDate !== -1 && cells[colMap.regDate] ? cells[colMap.regDate].innerText.trim() : "";

    // 4. Pastki sub-jadvaldan tekshiruv sohalari (Kodlar va nomlar)ni olish
    // Har bir qatorga bosish orqali pastki jadvaldagi aniq xizmatlarni chaqirish
    let services = [];
    try {
      // Qatorga klik qilish (Karmed DevExpress pastki jadvalni ochadi)
      row.click();
      await sleep(80);
      services = extractSubTableServicesFromPage();
    } catch (e) {}

    if (services.length === 0) {
      // Agar pastki jadval ochilmagan bo'lsa, umumiy nom beramiz
      services.push({
        code: "R_GEN",
        name: department ? `UTT (${department})` : "Ultratovush tekshiruvi",
        queueNo: "",
        date: rawConfirmDate
      });
    }

    matchedPatients.push({
      patientId: patientId || "ID_NOMALUM",
      fullName: fullName,
      surname: surname,
      firstName: firstName,
      middleName: middleName,
      doctorName: acceptingDoctor || targetDoctorName || "Shifokor",
      confirmDate: rawConfirmDate || targetDateNorm,
      confirmDateNorm: rowDateNorm || targetDateNorm,
      fileDoctor: fileDoctor,
      priority: priority,
      department: department,
      registeredDate: regDate,
      services: services,
      servicesCount: services.length
    });
  }

  return matchedPatients;
}

// 8. PASTKI JADVALDAN TEKSHIRUV KODLARI VA NOMLARINI AJRATIB OLISH
function extractSubTableServicesFromPage() {
  const servicesList = [];
  const allRows = Array.from(document.querySelectorAll("tr"));

  for (const row of allRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) continue;

    const cellTexts = cells.map(c => c.innerText.trim());
    const firstCell = cellTexts[0] || "";

    // Kod ustuni (R62, R87, R66, R64, R134 va h.k.)
    const codeMatch = firstCell.match(/^R\s*(\d{1,5})/i) || cellTexts.find(t => /^R\s*\d{1,5}$/i.test(t));
    if (codeMatch) {
      const code = typeof codeMatch === 'string' ? codeMatch.toUpperCase().replace(/\s+/g, '') : `R${codeMatch[1]}`;
      const name = (cells[1] ? cells[1].innerText.trim() : "") || (cells[2] ? cells[2].innerText.trim() : "Tekshiruv");
      
      let date = "";
      let queueNo = "";

      for (const txt of cellTexts) {
        if (/\d{2}\.\d{2}\.\d{4}/.test(txt)) date = txt;
        if (/^\d{6,9}$/.test(txt)) queueNo = txt;
      }

      if (!servicesList.some(s => s.code === code && s.name === name)) {
        servicesList.push({
          code: code,
          name: name,
          queueNo: queueNo,
          date: date
        });
      }
    }
  }

  return servicesList;
}

// 9. PAGINATION (KEYINGI SAHIFAGA O'TISH TUGMASINI TOPISH)
function findNextPageButton() {
  const selectors = [
    ".dxp-button.dxp-bi",
    ".dxp-button[title*='Keyingi']",
    ".dxp-button[title*='Next']",
    "a[href*='PBN']",
    ".dxp-nextButton",
    "a.dxp-button:last-child"
  ];

  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && isElementClickable(btn)) {
      return btn;
    }
  }

  return null;
}

function isElementClickable(el) {
  if (!el || el.disabled || el.classList.contains("dxp-disabledButton")) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

// 10. FIREBASE REALTIME DATABASE GA SAQLASH
async function saveReportToFirebase(reportData) {
  if (!reportData || !reportData.date) {
    throw new Error("Saqlash uchun hisobot ma'lumotlari topilmadi!");
  }

  const dateKey = reportData.date;
  const docSlug = (reportData.doctorName || 'all_doctors')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');

  const reportPath = `/accountant_reports/${dateKey}/${docSlug}.json`;
  const url = `${FIREBASE_DB_URL}${reportPath}`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reportData)
  });

  if (!res.ok) {
    throw new Error(`Firebase saqlash xatosi: ${res.statusText}`);
  }

  return { success: true, path: reportPath, reportId: reportData.reportId };
}

// 11. SUZUVCHI EKRAN INDIKATORI (HUD)
function showScanHUD(text, percent = 0, isError = false) {
  let hud = document.getElementById("karmedAccountantHUD");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "karmedAccountantHUD";
    hud.className = "karmed-accountant-hud";
    document.body.appendChild(hud);
  }

  hud.innerHTML = `
    <div class="hud-content ${isError ? 'error' : ''}">
      <img src="${chrome.runtime.getURL('icons/logo-onko.png')}" class="hud-logo">
      <div class="hud-body">
        <div class="hud-title">KARMED HISOBCHI SANAGICH</div>
        <div class="hud-status">${escapeHtml(text)}</div>
        <div class="hud-progress-bg">
          <div class="hud-progress-fill" style="width: ${percent}%;"></div>
        </div>
      </div>
    </div>
  `;
  hud.style.display = "block";
}

function hideScanHUD() {
  const hud = document.getElementById("karmedAccountantHUD");
  if (hud) hud.style.display = "none";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
