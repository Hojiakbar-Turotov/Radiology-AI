/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Content Script
 * 
 * 1. Karmed DevExpress jadvallarini avtomatik tahlil qilish
 * 2. "Qabul qiluvchi" ustunidan shifokor F.I.SH ni 100% aniq tekshirish
 * 3. "Tasdiqlangan sana" ustunidan sanani solishtirish
 * 4. Google Sheets-dagi Bemor ID lari bo'yicha maxsus qidiruv va filtrlash
 * 5. Pastki sub-jadvaldan barcha tekshiruv sohalari (kodlari, nomlari, narxlari va to'langan summasi)ni yig'ish
 * 6. Ko'p sahifali (pagination) jadvallarni avtomatik varaqlash
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

// Standart UTT xizmatlari tariflari (Agar Karmed jadvalida aniq narx ko'rinmasa zaxira)
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

      for (const cell of cells) {
        const text = cell.innerText.trim();
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
  if (!targetDoctor || targetDoctor.trim() === "") return true;
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

  const { targetStartDate, targetEndDate, targetDate, targetDoctorName, targetPatientIds, options } = payload;
  const startNorm = normalizeDate(targetStartDate || targetDate);
  const endNorm = normalizeDate(targetEndDate || targetDate);
  const strictDoc = options?.strictDoctorMatch !== false;
  const autoPage = options?.autoPagination !== false;
  const onlySheetsIds = options?.onlySheetsIds && Array.isArray(targetPatientIds) && targetPatientIds.length > 0;
  const targetIdSet = onlySheetsIds ? new Set(targetPatientIds.map(id => String(id).trim())) : null;

  const collectedPatients = [];
  const allDetailedRecords = []; // Google Sheets "Karmed" varag'i uchun to'liq yozuvlar
  const servicesBreakdown = {};
  const seenPatientKeys = new Set();
  let grandTotalSum = 0;

  try {
    let currentPage = 1;
    let hasNextPage = true;
    let maxPages = autoPage ? 40 : 1;

    while (hasNextPage && currentPage <= maxPages) {
      showScanHUD(`📄 ${currentPage}-sahifa skanerlanmoqda... (Topilgan: ${collectedPatients.length} ta)`, 15 + Math.min(currentPage * 5, 80));

      const pageResults = await scanCurrentPageRows(startNorm, endNorm, targetDoctorName, strictDoc, targetIdSet);

      for (const p of pageResults) {
        const uniqueKey = `${p.patientId}_${p.fullName}_${p.confirmDate}`;
        if (!seenPatientKeys.has(uniqueKey)) {
          seenPatientKeys.add(uniqueKey);
          collectedPatients.push(p);
          grandTotalSum += (p.totalPrice || 0);

          // Xizmatlar statistikasi va Sheets formatidagi qatorlarni tayyorlash
          if (p.services && p.services.length > 0) {
            p.services.forEach(srv => {
              const code = srv.code || "OTHER";
              if (!servicesBreakdown[code]) {
                servicesBreakdown[code] = {
                  code: code,
                  name: srv.name || "Tekshiruv",
                  count: 0
                };
              }
              servicesBreakdown[code].count++;

              // Google Sheets "Karmed" jadvali formati uchun yozuv
              allDetailedRecords.push({
                orderNo: allDetailedRecords.length + 1,
                id: p.patientId,
                patientId: p.patientId,
                fullName: p.fullName,
                patientName: p.fullName,
                patientType: p.department || 'Mamologiya',
                serviceCategory: 'Radiologiya',
                functionalDept: 'Ultratovush',
                serviceName: srv.name || 'Ultratovush tekshiruvi',
                serviceCode: srv.code || '',
                cardNo: p.patientId,
                cardType: p.priority || 'Ambulator',
                priority: p.priority || 'Ambulator',
                orderingDoctor: p.fileDoctor || p.doctorName || '',
                fileDoctor: p.fileDoctor || '',
                doctorName: p.doctorName || targetDoctorName || 'Kurbanova Sevinch Musayevna',
                dr_uygulayan: p.doctorName || targetDoctorName || 'Kurbanova Sevinch Musayevna',
                date: srv.date || p.confirmDate || '',
                confirmDate: p.confirmDate || '',
                privilegeCategory: 'Rezident',
                orderliUcret: 0,
                price: srv.price || 0,
                pulliUcret: srv.price || 0,
                paidAmount: srv.paidAmount || srv.price || 0,
                tolanganUcret: srv.paidAmount || srv.price || 0,
                debtStatus: srv.debtStatus || "To'langan"
              });
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
          await sleep(800);
        } else {
          hasNextPage = false;
        }
      } else {
        hasNextPage = false;
      }
    }

    let totalServicesCount = allDetailedRecords.length;

    const reportData = {
      reportId: `rep_${startNorm || 'all'}_${endNorm || 'all'}_${(targetDoctorName || 'all').toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
      startDate: startNorm,
      endDate: endNorm,
      date: startNorm,
      dateFormatted: (startNorm && endNorm && startNorm !== endNorm) ? `${formatDateToDDMMYYYY(startNorm)} — ${formatDateToDDMMYYYY(endNorm)}` : formatDateToDDMMYYYY(startNorm || endNorm),
      doctorName: targetDoctorName || "Barcha Shifokorlar",
      totalPatientsCount: collectedPatients.length,
      totalServicesCount: totalServicesCount,
      totalSum: grandTotalSum,
      totalSumFormatted: grandTotalSum.toLocaleString('ru-RU') + " so'm",
      servicesBreakdown: servicesBreakdown,
      patientsList: collectedPatients,
      detailedRecords: allDetailedRecords,
      createdAt: new Date().toISOString(),
      createdTimestamp: Date.now()
    };

    showScanHUD(`✅ Yakunlandi! ${collectedPatients.length} ta bemor, ${totalServicesCount} ta tekshiruv, jami: ${reportData.totalSumFormatted}`, 100);
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
async function scanCurrentPageRows(startNorm, endNorm, targetDoctorName, strictDoc, targetIdSet) {
  const matchedPatients = [];
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

  const colMap = getTableColumnMapping(mainTable);
  const rows = Array.from(document.querySelectorAll("tr"));

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 6) continue;

    const rowText = row.innerText.trim();
    if (rowText.includes("Kod") && rowText.includes("Xizmatlar Nomi")) continue;
    if (rowText.includes("Tranzaksiya") && rowText.includes("Navbat raqami")) continue;

    // 1. Qabul qiluvchi shifokorni olish
    let acceptingDoctor = "";
    if (colMap.acceptingDoctor !== -1 && cells[colMap.acceptingDoctor]) {
      acceptingDoctor = cells[colMap.acceptingDoctor].innerText.trim();
    } else {
      for (const c of cells) {
        const t = c.innerText.trim();
        if (KNOWN_DOCTORS.some(doc => isDoctorNameMatch(t, doc))) {
          acceptingDoctor = t;
          break;
        }
      }
    }

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

    if (startNorm && rowDateNorm && rowDateNorm < startNorm) continue;
    if (endNorm && rowDateNorm && rowDateNorm > endNorm) continue;

    // 3. Bemor ID sini olish va Sheets ID filteri bilan tekshirish
    let patientId = colMap.patientId !== -1 && cells[colMap.patientId] ? cells[colMap.patientId].innerText.trim() : "";
    if (!patientId || !/^\d+$/.test(patientId)) {
      const idCell = cells.find(c => /^\d{4,8}$/.test(c.innerText.trim()));
      if (idCell) patientId = idCell.innerText.trim();
    }

    // Agar faqat Sheets-dagi Bemor ID lari tanlangan bo'lsa
    if (targetIdSet && patientId && !targetIdSet.has(patientId)) {
      continue;
    }

    let surname = colMap.surname !== -1 && cells[colMap.surname] ? cells[colMap.surname].innerText.trim() : "";
    let firstName = colMap.firstName !== -1 && cells[colMap.firstName] ? cells[colMap.firstName].innerText.trim() : "";
    let middleName = colMap.middleName !== -1 && cells[colMap.middleName] ? cells[colMap.middleName].innerText.trim() : "";
    
    // Otasining ismini tozalash (XXX, X, - bo'lsa bo'sh qoldirish)
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

    const fullName = [surname, firstName, middleName].filter(Boolean).join(" ").trim() || "Bemor";
    const fileDoctor = colMap.fileDoctor !== -1 && cells[colMap.fileDoctor] ? cells[colMap.fileDoctor].innerText.trim() : "";
    const priority = colMap.priority !== -1 && cells[colMap.priority] ? cells[colMap.priority].innerText.trim() : "Ambulator";
    const department = colMap.department !== -1 && cells[colMap.department] ? cells[colMap.department].innerText.trim() : "";
    const regDate = colMap.regDate !== -1 && cells[colMap.regDate] ? cells[colMap.regDate].innerText.trim() : "";

    // 4. Pastki sub-jadvaldan tekshiruv sohalari va narxlarini olish
    let services = [];
    try {
      row.click();
      await sleep(100);
      services = extractSubTableServicesFromPage();
    } catch (e) {}

    if (services.length === 0) {
      const defPrice = 173000;
      services.push({
        code: "R78",
        name: department ? `UTT (${department})` : "Ultratovush tekshiruvi",
        price: defPrice,
        paidAmount: defPrice,
        priceStr: "173 000,00",
        debtStatus: "To'langan",
        queueNo: "",
        date: rawConfirmDate
      });
    }

    const totalPatPrice = services.reduce((sum, s) => sum + (s.price || 0), 0);

    matchedPatients.push({
      patientId: patientId || "ID_NOMALUM",
      fullName: fullName,
      surname: surname,
      firstName: firstName,
      middleName: middleName,
      doctorName: acceptingDoctor || targetDoctorName || "Kurbanova Sevinch Musayevna",
      confirmDate: rawConfirmDate || formatDateToDDMMYYYY(rowDateNorm),
      confirmDateNorm: rowDateNorm,
      fileDoctor: fileDoctor,
      priority: priority,
      department: department,
      registeredDate: regDate,
      services: services,
      servicesCount: services.length,
      totalPrice: totalPatPrice,
      totalPriceFormatted: totalPatPrice.toLocaleString('ru-RU') + " so'm",
      servicesSummaryStr: services.map(s => s.name).join(", ")
    });
  }

  return matchedPatients;
}

// 8. PASTKI JADVALDAN TEKSHIRUV KODLARI, NOMLARI VA NARXLARINI AJRATIB OLISH
function extractSubTableServicesFromPage() {
  const servicesList = [];
  const allRows = Array.from(document.querySelectorAll("tr"));

  for (const row of allRows) {
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) continue;

    const cellTexts = cells.map(c => c.innerText.trim());
    const firstCell = cellTexts[0] || "";

    // Kod ustuni (R52, R78, R62, R87, R66, R64, R85, R134 va h.k.)
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

  const dateKey = reportData.date.replace(/[^a-zA-Z0-9_-]/g, "_");
  const docKey = (reportData.doctorName || "all").toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "_");
  const reportKey = `${dateKey}__${docKey}`;

  const url = `${FIREBASE_DB_URL}/karmed_doctor_reports/${reportKey}.json`;

  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reportData)
  });

  if (!res.ok) {
    throw new Error(`Firebase xatosi (${res.status}): ${res.statusText}`);
  }

  return { success: true, key: reportKey };
}

// 11. HUD PROGRESS INDICATOR (EKRANDA CHIQUVCHI BANNER)
function showScanHUD(text, percent = 50, isError = false) {
  let hud = document.getElementById("karmedScanHUD");
  if (!hud) {
    hud = document.createElement("div");
    hud.id = "karmedScanHUD";
    hud.style.cssText = `
      position: fixed;
      top: 15px;
      right: 20px;
      z-index: 9999999;
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 18px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      font-family: sans-serif;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 280px;
      max-width: 400px;
      border: 1px solid #334155;
    `;
    document.body.appendChild(hud);
  }

  hud.style.borderColor = isError ? "#ef4444" : "#0284c7";
  hud.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <b style="color:${isError ? '#f87171' : '#38bdf8'}; font-size:12px;">📊 KARMED HISOBCHI PORTALI</b>
      <span style="font-size:11px; color:#94a3b8;">${percent}%</span>
    </div>
    <div style="font-size:12.5px; color:#f1f5f9;">${text}</div>
    <div style="background:#1e293b; height:5px; border-radius:4px; overflow:hidden;">
      <div style="background:${isError ? '#ef4444' : 'linear-gradient(90deg, #0284c7, #10b981)'}; width:${percent}%; height:100%; transition:width 0.3s;"></div>
    </div>
  `;
}

function hideScanHUD() {
  const hud = document.getElementById("karmedScanHUD");
  if (hud) hud.remove();
}
