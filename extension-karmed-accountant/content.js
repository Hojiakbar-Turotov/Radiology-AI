/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Content Script
 * 
 * 33 ta Rasmiy Tarif Narxlari (Rezident, No Rezident, Sug'urta/Order/Vaqf/boshqalar)
 * 1. Rezident -> 1-ustun narxlari
 * 2. No Rezident -> 2-ustun narxlari
 * 3. Boshqa barchasi (Sug'urta, Order, Vaqf, Imtiyoz...) -> 3-ustun narxlari
 * 4. Google Sheets (19hHEtdoLXN7c09xcLoAb13cNkqjNWPt1ovv4Qd8KzA0 - Iyun) va "Farq" jurnali
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
let currentGoogleScriptUrl = "";
let currentSpreadsheetId = "19hHEtdoLXN7c09xcLoAb13cNkqjNWPt1ovv4Qd8KzA0"; // Yangi Iyun jadvali
let currentTargetSheetName = "Farq";
let autoSaveOnOpen = false;
let lastSavedPatientKey = "";
let lastClickedRow = null;
let lastActivePatient = null;

// 33 TA RASMIY TEKSHIRUV TARIFLAR JADVALI
const OFFICIAL_TARIFF_RATES = [
  {
    id: 1,
    name: "JIGAR, O'T QOPI, OSHQOZON OSTI BEZI, TALOQ",
    keywords: ["jigar", "qopi"],
    altKeywords: ["jigar", "taloq"],
    excludeKeywords: ["doppler", "rtd"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 2,
    name: "DOPPLER ( RTD+energetik) JIGAR, O'T QOPI, OSHQOZON OSTI BEZI, TALOQ",
    keywords: ["doppler", "jigar"],
    altKeywords: ["rtd", "jigar"],
    rezident: 192000,
    norezident: 307200,
    sugurta: 188160
  },
  {
    id: 3,
    name: "U T T BUYRAKLAR",
    keywords: ["buyrak"],
    excludeKeywords: ["doppler", "rtd"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 4,
    name: "DOPPLER (RTD + energetik) BUYRAKLAR",
    keywords: ["doppler", "buyrak"],
    altKeywords: ["rtd", "buyrak"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 5,
    name: "SIYDIK PUFAGI",
    keywords: ["siydikpufagi"],
    excludeKeywords: ["bachadon", "tuxumdon", "prostata"],
    rezident: 93000,
    norezident: 148800,
    sugurta: 91140
  },
  {
    id: 6,
    name: "SIYDIK PUFAGI, BACHADON VA TUXUMDONLAR",
    keywords: ["siydik", "bachadon"],
    altKeywords: ["bachadon", "tuxumdon"],
    excludeKeywords: ["doppler", "rtd", "transvaginal", "tvutt", "tvu"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 7,
    name: "DOPPLER (RTD + energetik) BACHADON VA TUXUMDONLAR",
    keywords: ["doppler", "bachadon"],
    altKeywords: ["rtd", "bachadon"],
    excludeKeywords: ["transvaginal", "tvutt"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 8,
    name: "SIYDIK QOPI PROSTATA BEZI, URUG' PUFAKCHALARI",
    keywords: ["prostata", "urug"],
    altKeywords: ["prostata", "pufakcha"],
    excludeKeywords: ["doppler", "rtd", "transrektal"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 9,
    name: "DOPPLER (RTD + energetik) SIYDIK QOPI, PROSTATA BEZI, URUG' PUFAKCHALARI",
    keywords: ["doppler", "prostata"],
    altKeywords: ["rtd", "prostata"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 10,
    name: "YORG'OQ A'ZOLARI",
    keywords: ["yorgoq"],
    altKeywords: ["moshonka"],
    excludeKeywords: ["doppler", "rtd"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 11,
    name: "DOPPLER (RTD + energetik) YORG'OQ A'ZOLARI",
    keywords: ["doppler", "yorgoq"],
    altKeywords: ["rtd", "yorgoq"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 12,
    name: "SUT BEZLARI",
    keywords: ["sutbez"],
    excludeKeywords: ["doppler", "rtd", "sonoelastograf", "qoltiq"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 13,
    name: "DOPPLER (RTD + energetik) SUT BEZLARI",
    keywords: ["doppler", "sutbez"],
    altKeywords: ["rtd", "sutbez"],
    excludeKeywords: ["sonoelastograf"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 14,
    name: "QALQONSIMON BEZI",
    keywords: ["qalqonsimon"],
    excludeKeywords: ["doppler", "rtd", "sonoelastograf"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 15,
    name: "DOPPLER (RTD + energetik) QALQONSIMON BEZI",
    keywords: ["doppler", "qalqonsimon"],
    altKeywords: ["rtd", "qalqonsimon"],
    excludeKeywords: ["sonoelastograf"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 16,
    name: "DOPPLER (RTD + energetik) YUMSHOQ TO'QIMA",
    keywords: ["doppler", "yumshoq"],
    altKeywords: ["rtd", "yumshoq"],
    excludeKeywords: ["sonoelastograf"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 17,
    name: "PERIFERIK LIMFA TUGUNLAR",
    keywords: ["periferik"],
    altKeywords: ["limfa"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 18,
    name: "QORIN PARDA ORTI LIMFA TUGUNLARI",
    keywords: ["qorinpardaorti"],
    altKeywords: ["pardaorti"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 19,
    name: "ORBITA VA KO'Z OLMALARI",
    keywords: ["orbita"],
    altKeywords: ["kozolma"],
    excludeKeywords: ["doppler", "rtd"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 20,
    name: "DOPPLER ( RTD+energetik) ORBITA VA KO'Z OLMALARI",
    keywords: ["doppler", "orbita"],
    altKeywords: ["rtd", "orbita"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 21,
    name: "PLEVRA BO'SHLIQLARI",
    keywords: ["plevra"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 22,
    name: "QORIN BO'SHLIG'I VA KICHIK CHANOQ BO'SHLIG'IDA ERKIN SUYUQLIK MIQDORI",
    keywords: ["erkin", "suyuqlik"],
    altKeywords: ["suyuqlikmiqdori"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 23,
    name: "DOPPLER (CDK + energetik) TRANSVAGINAL TEKSHIRUVI (TV UZI)",
    keywords: ["doppler", "transvaginal"],
    altKeywords: ["cdk", "transvaginal"],
    rezident: 196000,
    norezident: 313600,
    sugurta: 192080
  },
  {
    id: 24,
    name: "TRANSVAGINAL TEKSHIRUVI (TV UTT) Bachadon va tuxumdonlar",
    keywords: ["transvaginal"],
    altKeywords: ["tvutt", "tvuzi"],
    excludeKeywords: ["doppler", "cdk", "rtd"],
    rezident: 163000,
    norezident: 260800,
    sugurta: 159740
  },
  {
    id: 25,
    name: "TRANSREKTAL TEKSHIRUVI (TR UTT) prostata bezi",
    keywords: ["transrektal"],
    altKeywords: ["trutt"],
    rezident: 163000,
    norezident: 260800,
    sugurta: 159740
  },
  {
    id: 26,
    name: "OYOQ QON TOMIRLARDAGI TROMBNI ANIQLASH",
    keywords: ["tromb"],
    altKeywords: ["oyoqqontomir", "venank"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 27,
    name: "KOMPRESSION SONOELASTOGRAFIYA SUT BEZLARI",
    keywords: ["sonoelastograf", "sutbez"],
    altKeywords: ["elastograf", "sutbez"],
    rezident: 192000,
    norezident: 307200,
    sugurta: 188160
  },
  {
    id: 28,
    name: "KOMPRESSION SONOELASTOGRAFIYA QALQONSIMON BEZI",
    keywords: ["sonoelastograf", "qalqonsimon"],
    altKeywords: ["elastograf", "qalqonsimon"],
    rezident: 192000,
    norezident: 307200,
    sugurta: 188160
  },
  {
    id: 29,
    name: "KOMPRESSION SONOELASTOGRAFIYA YUMSHOQ TO'QIMA",
    keywords: ["sonoelastograf", "yumshoq"],
    altKeywords: ["elastograf", "yumshoq"],
    rezident: 192000,
    norezident: 307200,
    sugurta: 188160
  },
  {
    id: 30,
    name: "YUMSHOQ TO'QIMA",
    keywords: ["yumshoq"],
    altKeywords: ["toqima"],
    excludeKeywords: ["doppler", "rtd", "sonoelastograf"],
    rezident: 126000,
    norezident: 201600,
    sugurta: 123480
  },
  {
    id: 31,
    name: "SUT BEZLAR VA QO'LTIQ OSTI LIMFA TUGUNLAR",
    keywords: ["sutbez", "qoltiq"],
    altKeywords: ["qoltiqosti"],
    excludeKeywords: ["sonoelastograf"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  },
  {
    id: 32,
    name: "PUNKTSION BIOPSIYA U T T NAZORATI OSTIDA",
    keywords: ["biopsiya"],
    altKeywords: ["punktsion"],
    rezident: 460000,
    norezident: 736000,
    sugurta: 450800
  },
  {
    id: 33,
    name: "BO'YIN QON TOMIRLARI DOPPLEROGRAFIYASI",
    keywords: ["boyin", "tomir"],
    altKeywords: ["boyindoppler"],
    rezident: 159000,
    norezident: 254400,
    sugurta: 155820
  }
];

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
      chrome.storage.local.get(["sheetsScriptUrl", "spreadsheetId", "targetSheetName", "autoSaveFarq"], res => {
        if (res.sheetsScriptUrl) currentGoogleScriptUrl = res.sheetsScriptUrl.trim();
        if (res.spreadsheetId) currentSpreadsheetId = extractSheetId(res.spreadsheetId);
        if (res.targetSheetName) currentTargetSheetName = res.targetSheetName.trim() || "Farq";
        if (res.autoSaveFarq !== undefined) autoSaveOnOpen = Boolean(res.autoSaveFarq);
        resolve();
      });
    } else {
      resolve();
    }
  });
}

function extractSheetId(inputStr) {
  if (!inputStr) return "19hHEtdoLXN7c09xcLoAb13cNkqjNWPt1ovv4Qd8KzA0";
  const str = inputStr.trim();
  const match = str.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return str;
}

// 2. BEMOR STATUSINI ANIQLASH (rezident / norezident / sugurta)
function getPatientStatusType(muassasaText) {
  if (!muassasaText) return 'rezident';
  const clean = muassasaText.toLowerCase().trim();

  if (clean.includes('no rezident') || clean.includes('norezident') || clean.includes('no-rezident')) {
    return 'norezident';
  }

  if (clean === 'rezident' || (clean.includes('rezident') && !clean.includes('no'))) {
    return 'rezident';
  }

  return 'sugurta';
}

// 3. XIZMATNING ANIQ TARIFINI HISOBLASH
function calculateServiceTariffPrice(serviceName, serviceCode, statusType = 'rezident') {
  const norm = (serviceName || '').toLowerCase().replace(/['`ʻ\s,._\-\(\)]/g, '');
  
  for (const item of OFFICIAL_TARIFF_RATES) {
    const hasKey = item.keywords.every(k => norm.includes(k.replace(/['`ʻ\s,._\-\(\)]/g, '')));
    const hasAlt = item.altKeywords && item.altKeywords.every(k => norm.includes(k.replace(/['`ʻ\s,._\-\(\)]/g, '')));
    const hasEx = item.excludeKeywords && item.excludeKeywords.some(k => norm.includes(k.replace(/['`ʻ\s,._\-\(\)]/g, '')));

    if ((hasKey || hasAlt) && !hasEx) {
      if (statusType === 'norezident') return item.norezident;
      if (statusType === 'sugurta') return item.sugurta;
      return item.rezident;
    }
  }

  const code = (serviceCode || '').toUpperCase().trim();
  const codeDefaults = {
    'R25': { rezident: 126000, norezident: 201600, sugurta: 123480 },
    'R52': { rezident: 159000, norezident: 254400, sugurta: 155820 },
    'R62': { rezident: 159000, norezident: 254400, sugurta: 155820 },
    'R63': { rezident: 192000, norezident: 307200, sugurta: 188160 },
    'R64': { rezident: 126000, norezident: 201600, sugurta: 123480 },
    'R67': { rezident: 159000, norezident: 254400, sugurta: 155820 },
    'R78': { rezident: 126000, norezident: 201600, sugurta: 123480 },
    'R79': { rezident: 126000, norezident: 201600, sugurta: 123480 },
    'R85': { rezident: 163000, norezident: 260800, sugurta: 159740 },
    'R87': { rezident: 126000, norezident: 201600, sugurta: 123480 },
    'R134': { rezident: 192000, norezident: 307200, sugurta: 188160 },
    'R135': { rezident: 192000, norezident: 307200, sugurta: 188160 }
  };

  if (codeDefaults[code]) {
    return codeDefaults[code][statusType] || codeDefaults[code].rezident;
  }

  if (statusType === 'norezident') return 254400;
  if (statusType === 'sugurta') return 155820;
  return 159000;
}

// 4. FOYDALANUVCHI QATORGA BOSGANDA DARHOL USHLAB OLISH (CLICK INTERCEPTOR)
function initClickInterceptor() {
  document.addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr) return;

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

// 5. QATORNI (TR) TAHLIL QILIB BEMOR MA'LUMOTLARINI AJRATISH
function parsePatientFromRow(tr) {
  if (!tr) return null;
  const cells = Array.from(tr.querySelectorAll("td"));
  if (cells.length < 4) return null;

  const cellTexts = cells.map(c => c.innerText.trim());

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

  for (let i = 0; i <= dateIdx; i++) {
    const t = cellTexts[i];
    if (t.includes("Dr.") || (t.split(" ").length >= 2 && /[A-ZА-ЯЁ]/.test(t) && !t.includes("Ultratovush") && !t.includes("Mammografiya") && !t.includes("Rentgen"))) {
      referringDoctor = t.replace(/^Dr\.\s*/i, '');
      break;
    }
  }

  for (const t of cellTexts) {
    const low = t.toLowerCase();
    if (low.includes("sug'urta") || low.includes("sugurta") || low.includes("order") || low.includes("vaqf") || low.includes("rezident") || low.includes("imtiyoz")) {
      muassasa = t;
      break;
    }
  }
  if (!muassasa) muassasa = "Rezident";

  const statusType = getPatientStatusType(muassasa);

  const knownDepts = ["abdominal", "ximyoterapiya", "mamologiya", "ginekologiya", "urologiya", "onkourologiya", "bolalar", "bosh", "torakal"];
  for (const t of cellTexts) {
    if (knownDepts.some(d => t.toLowerCase().includes(d))) {
      department = t;
      break;
    }
  }
  if (!department) department = "Abdominal";

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
    statusType: statusType
  };
}

// 6. JORIY EKRANDAGI BEMOR VA XIZMATLARNI TO'LIQ ANIQLASH
function getCurrentlyActivePatientFromScreen() {
  let p = null;
  if (lastClickedRow) {
    p = parsePatientFromRow(lastClickedRow);
  }

  if (!p) {
    const allRows = Array.from(document.querySelectorAll("tr"));
    const candidateRows = allRows.filter(r => {
      const text = r.innerText;
      return /\d{2}\.\d{2}\.\d{4}/.test(text) && /\d{4,8}/.test(text) && !text.includes("Siydik Pufagi") && !text.includes("Doppler") && !text.includes("Kod");
    });

    const coloredRow = candidateRows.find(r => r.getAttribute("style")?.includes("rgb") || r.className?.includes("Focused") || r.className?.includes("Selected") || r.className?.includes("selected"));
    const bestRow = coloredRow || candidateRows[0];

    if (bestRow) {
      p = parsePatientFromRow(bestRow);
    }
  }

  if (!p) return null;

  const services = extractSubTableServicesFromPage(p.referringDoctor, p.statusType);
  const totalSum = services.reduce((acc, s) => acc + (s.price || 0), 0);

  p.services = services;
  p.totalSum = totalSum;
  p.totalSumFormatted = totalSum.toLocaleString('ru-RU') + " so'm";

  return p;
}

// 7. PASTKI JADVALDAN TEKSHIRUV KODLARI, NOMLARI, TRANZAKSIYA SANASI VA NARXLARINI AJRATIB OLISH
function extractSubTableServicesFromPage(referringDocFromTop, statusType = 'rezident') {
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
      const name = (cells[1] ? cells[1].innerText.trim() : "") || (cells[2] ? cells[2].innerText.trim() : "Ultratovush tekshiruvi");
      
      let date = "";
      let orderNo = "";
      let orderingDoctor = referringDocFromTop || "Muminov Sobit";
      let reportAuthor = "Kurbanova Sevinch Musayevna";
      let debtStatus = "To'langan";

      if (cells[2] && /\d{2}\.\d{2}\.\d{4}/.test(cells[2].innerText)) {
        date = cells[2].innerText.trim();
      } else {
        const dCell = cellTexts.find(t => /\d{2}\.\d{2}\.\d{4}/.test(t));
        if (dCell) date = dCell;
      }

      if (cells[3] && /^\d{6,9}$/.test(cells[3].innerText.trim())) {
        orderNo = cells[3].innerText.trim();
      } else {
        const numCell = cellTexts.find(t => /^\d{6,9}$/.test(t));
        if (numCell) orderNo = numCell;
      }

      if (cells[4] && cells[4].innerText.trim().length >= 5) {
        orderingDoctor = cells[4].innerText.trim().replace(/^Dr\.\s*/i, '');
      }

      if (cells[5] && cells[5].innerText.trim().length >= 5) {
        reportAuthor = cells[5].innerText.trim();
      } else if (cells[10] && cells[10].innerText.trim().length >= 5) {
        reportAuthor = cells[10].innerText.trim();
      }

      if (cellTexts.some(t => t.toLowerCase().includes("to'lanmagan") || t.toLowerCase().includes("tolanmagan") || t.toLowerCase().includes("qarz"))) {
        debtStatus = "To'lanmagan";
      }

      const price = calculateServiceTariffPrice(name, code, statusType);
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

// 8. JORIY BEMORNI TO'G'RIDAN-TO'G'RI GOOGLE SHEETS "FARQ" VARAG'IGA SAQLASH
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
    // Agar sozlanmagan bo'lsa sozlash oynasini ochish
    const panel = document.getElementById("karmedFarqSettingsPanel");
    if (panel) panel.style.display = "flex";
    alert("⚠️ Google Apps Script Web App URL manzili sozlanmagan!\nPanelning ⚙️ tugmasi orqali URL ni kiriting.");
    return;
  }

  const btn = document.getElementById("btnFarqSaveCurrent");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> "Farq" ga saqlanmoqda...`;
  }

  const isOrder = patient.muassasa.toLowerCase().includes('order');
  const isSugurta = patient.statusType === 'sugurta';

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
      spreadsheetId: currentSpreadsheetId || "19hHEtdoLXN7c09xcLoAb13cNkqjNWPt1ovv4Qd8KzA0",
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

// 9. EKRANDA SUZUVCHI TEZKOR BOSHQARUV PANELI (WIDGET)
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
      <div class="karmed-farq-header-btns">
        <button type="button" class="karmed-farq-icon-btn" id="btnToggleFarqSettings" title="Jadvalni sozlash">⚙️</button>
        <button type="button" class="karmed-farq-icon-btn" id="btnMinFarqWidget" title="Kichraytirish">—</button>
      </div>
    </div>
    
    <!-- On-screen Settings Panel -->
    <div class="karmed-farq-settings-panel" id="karmedFarqSettingsPanel" style="display:none;">
      <div style="font-weight:bold; color:#10b981; font-size:12px;">⚙️ Google Sheets Sozlamalari:</div>
      <div>
        <label style="font-size:10.5px; color:#94a3b8;">Apps Script Web App URL:</label>
        <input type="text" id="widgetInputScriptUrl" class="karmed-farq-settings-input" placeholder="https://script.google.com/macros/s/.../exec">
      </div>
      <div>
        <label style="font-size:10.5px; color:#94a3b8;">Google Sheets Havolasi / ID:</label>
        <input type="text" id="widgetInputSpreadsheetId" class="karmed-farq-settings-input" placeholder="19hHEtdoLXN7c09xcLoAb13cNkqjNWPt1ovv4Qd8KzA0">
      </div>
      <div style="display:flex; gap:6px;">
        <div style="flex:1;">
          <label style="font-size:10.5px; color:#94a3b8;">Varaq (Jurnal):</label>
          <input type="text" id="widgetInputSheetName" class="karmed-farq-settings-input" value="Farq" placeholder="Farq">
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button type="button" class="btn-farq-settings-save" id="btnWidgetSaveSettings">💾 Saqlash</button>
        </div>
      </div>
    </div>

    <div class="karmed-farq-body" id="karmedFarqBody">
      <div class="karmed-farq-patient-card">
        <div class="karmed-farq-pat-name" id="farqPatName">Bemor qatorini bosing...</div>
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

  // Settings panel toggle
  const btnSettings = document.getElementById("btnToggleFarqSettings");
  const panelSettings = document.getElementById("karmedFarqSettingsPanel");
  const inpUrl = document.getElementById("widgetInputScriptUrl");
  const inpSheetId = document.getElementById("widgetInputSpreadsheetId");
  const inpSheetName = document.getElementById("widgetInputSheetName");

  btnSettings.addEventListener("click", () => {
    const isHidden = panelSettings.style.display === "none";
    panelSettings.style.display = isHidden ? "flex" : "none";
    if (isHidden) {
      inpUrl.value = currentGoogleScriptUrl || "";
      inpSheetId.value = currentSpreadsheetId || "19hHEtdoLXN7c09xcLoAb13cNkqjNWPt1ovv4Qd8KzA0";
      inpSheetName.value = currentTargetSheetName || "Farq";
    }
  });

  document.getElementById("btnWidgetSaveSettings").addEventListener("click", () => {
    currentGoogleScriptUrl = inpUrl.value.trim();
    currentSpreadsheetId = extractSheetId(inpSheetId.value.trim()) || "19hHEtdoLXN7c09xcLoAb13cNkqjNWPt1ovv4Qd8KzA0";
    currentTargetSheetName = inpSheetName.value.trim() || "Farq";

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        sheetsScriptUrl: currentGoogleScriptUrl,
        spreadsheetId: currentSpreadsheetId,
        targetSheetName: currentTargetSheetName
      });
    }

    panelSettings.style.display = "none";
    showFarqToast(`✅ Sozlamalar saqlandi: ${currentSpreadsheetId} (${currentTargetSheetName})`);
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

  const statusLabel = p.statusType === 'rezident' ? 'Rezident' : (p.statusType === 'norezident' ? 'No Rezident' : `Sug'urta/Order (${p.muassasa})`);
  elName.innerText = `👤 ${p.fullName}`;
  elMeta.innerText = `ID: ${p.patientId} • 🏛️ ${statusLabel} • 👨‍⚕️ ${p.referringDoctor}`;
  
  const srvCodes = (p.services || []).map(s => `${s.code} (${s.priceStr})`).join(", ");
  elSum.innerText = `📋 ${p.services.length} ta tekshiruv: ${p.totalSumFormatted}`;

  const currentKey = `${p.patientId}_${p.fullName}_${p.services.length}_${p.muassasa}`;
  if (autoSaveOnOpen && p.patientId && p.patientId !== "ID_NOMALUM" && p.services.length > 0 && currentKey !== lastSavedPatientKey) {
    lastSavedPatientKey = currentKey;
    saveCurrentPatientToGoogleSheets();
  }
}

// 10. KLAVIATURA TUGMALARI (F4 yoki Alt+S orqali saqlash)
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

// 11. SUDRAB YURISH (DRAGGABLE)
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

// 12. POPUPDAN XABARLARNI QABUL QILISH
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "DETECT_PAGE_DOCTORS") {
    sendResponse({ success: true, doctors: ["Kurbanova Sevinch Musayevna", "Muminov Sobit", "Mannopova Nargiza Mannapovna", "Kasimov Doniyor Abrorovich"] });
    return true;
  }
  if (request.action === "UPDATE_SETTINGS") {
    if (request.payload?.sheetsScriptUrl) currentGoogleScriptUrl = request.payload.sheetsScriptUrl;
    if (request.payload?.spreadsheetId) currentSpreadsheetId = extractSheetId(request.payload.spreadsheetId);
    if (request.payload?.targetSheetName) currentTargetSheetName = request.payload.targetSheetName;
    sendResponse({ success: true });
    return true;
  }
});
