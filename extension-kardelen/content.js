/**
 * UTT / MRT & MSKT Navbat Tizimi - Kardelen Read-Only Passive Integration (V12)
 * - Faqat Registratura panelidagi (services_catalog) tekshiruvlargina navbatga qo'yiladi.
 * - ID raqamlar yoki sof sonlar tekshiruv deb olinmaydi.
 * - Yashil rangdagi (ko'rikdan o'tgan) qatorlar qat'iyan navbatga qo'yilmaydi.
 * - MSKT da eng katta vaqt (MAX), MRT da vaqtlar yig'indisi (SUM) hisoblanadi.
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

// Standart Operatorlar
const DEFAULT_OPERATORS = [
  { login: "TB1", name: "Turatov Hojiakbar", password: "15420", role: "Operator" },
  { login: "TB2", name: "Saida'loxon Saidaxmadxonov", password: "15420", role: "Operator" },
  { login: "TB3", name: "Isfandiyor Xaydaraliyev", password: "15420", role: "Operator" }
];

// Standart Boshlang'ich Qurilmalar
const DEFAULT_DEVICES = [
  { id: "mrt1", name: "MRT 1", room: "1-MRT Xonasi", specialty: "Tomografiya (MRT)", type: "MRT", color: "#38bdf8" },
  { id: "mrt2", name: "MRT 2", room: "2-MRT Xonasi", specialty: "Tomografiya (MRT)", type: "MRT", color: "#818cf8" },
  { id: "mskt1", name: "MSKT 1", room: "1-MSKT Xonasi", specialty: "Tomografiya (MSKT)", type: "MSKT", color: "#34d399" },
  { id: "mskt2", name: "MSKT 2", room: "2-MSKT Xonasi", specialty: "Tomografiya (MSKT)", type: "MSKT", color: "#f59e0b" }
];

let dynamicDevices = [...DEFAULT_DEVICES];
let currentUser = null;
let operatorsList = [...DEFAULT_OPERATORS];
let selectedPatient = null;
let servicesCatalog = {};
let deviceQueues = {};
let todayOperatorQueueCount = 0;
let lastPatientInfo = null; // Oxirgi tanlangan bemor ma'lumotlari (yuqori jadvaldan)

// Faqat asosiy oynada (window === window.top) ishga tushirish
if (window === window.top) {
  initExtension();
}

async function initExtension() {
  try {
    await checkUserAuth();
    loadOperatorsFromFirebase().catch(() => {});
    await loadServicesCatalog();
    await loadDevicesFromFirebase();

    createFloatingBar();
    fetchDeviceQueueCounts().catch(() => {});

    // Saytning DOM'iga hech narsa kiritmaymiz, faqat passiv click hodisasini tinglaymiz
    document.addEventListener("click", handlePassiveRowClick, true);

    if (!currentUser) {
      setTimeout(() => {
        try { openLoginModal(); } catch (e) {}
      }, 1000);
    }
  } catch (err) {
    console.warn("UTT Extension init safely caught:", err);
  }
}

// Qurilmalar ro'yxatini Firebase /doctors dan dinamik yuklash
async function loadDevicesFromFirebase() {
  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/doctors.json`);
    if (res && res.ok) {
      const data = await res.json();
      if (data && Object.keys(data).length > 0) {
        dynamicDevices = Object.keys(data).map(key => {
          const d = data[key];
          const spec = (d.specialty || d.type || d.name || "").toUpperCase();
          const type = spec.includes("MSKT") || spec.includes("MSCT") || spec.includes("TOMOGRAFIYA(MSCT)") ? "MSKT" : "MRT";
          return {
            id: key,
            name: d.name || key,
            room: d.room || d.name || "",
            specialty: d.specialty || "",
            type: d.type || type,
            color: d.color || (type === "MRT" ? "#38bdf8" : "#34d399")
          };
        });
      }
    }
  } catch (e) {
    console.warn("loadDevicesFromFirebase error:", e);
  }
}

// Xavfsiz Fetch
async function safeFetch(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    return null;
  }
}

// 1. TEPADAGI ISOLATED FLOATING BAR
function createFloatingBar() {
  try {
    if (document.getElementById("uttFloatingBar")) return;

    const bar = document.createElement("div");
    bar.id = "uttFloatingBar";
    bar.className = "utt-floating-bar";

    document.body.appendChild(bar);
    updateFloatingBar();
  } catch (e) {}
}

function updateFloatingBar() {
  try {
    const bar = document.getElementById("uttFloatingBar");
    if (!bar) return;

    if (!currentUser) {
      bar.innerHTML = `
        <span class="utt-floating-brand">⚡ MRT & MSKT:</span>
        <button class="utt-floating-login-btn" id="uttBtnOpenLogin">
          🔒 Tizimga Kirish (TB1 / TB2 / TB3)
        </button>
      `;
      const btn = document.getElementById("uttBtnOpenLogin");
      if (btn) btn.onclick = () => openLoginModal();
      return;
    }

    const nameParts = currentUser.name.split(" ");
    const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : currentUser.name;

    bar.innerHTML = `
      <button class="utt-floating-user-btn" id="uttBtnOpenProfile" title="Ro'yxatchi profili">
        👤 <strong>${currentUser.login}</strong>: ${shortName} ⚙️
      </button>
      <button class="utt-floating-queue-btn" id="uttBtnOpenQueueList" title="Bugungi va ertangi navbatdagi bemorlar ro'yxatini ko'rish">
        📋 Navbatlar Ro'yxati
      </button>
      <span class="utt-floating-brand">⚡ MRT & MSKT:</span>
      <span class="utt-floating-patient" id="uttFloatingPatientText">Jadvaldan bemor qatorini bosing</span>
      <button class="utt-floating-btn" id="uttFloatingSendBtn" disabled>➕ Navbatga Yozish</button>
    `;

    const profBtn = document.getElementById("uttBtnOpenProfile");
    if (profBtn) profBtn.onclick = () => openProfileModal();

    const queueListBtn = document.getElementById("uttBtnOpenQueueList");
    if (queueListBtn) queueListBtn.onclick = () => openQueueListModal();

    const sendBtn = document.getElementById("uttFloatingSendBtn");
    if (sendBtn) {
      sendBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentUser) {
          openLoginModal();
          return;
        }
        if (selectedPatient) {
          openSendModal(selectedPatient);
        }
      };
    }
  } catch (e) {}
}

// 2. PASSIV CLICK TINGLOVCHI
function handlePassiveRowClick(e) {
  try {
    if (e.target.closest("#uttFloatingBar") || e.target.closest(".utt-modal-overlay")) {
      return;
    }

    const row = e.target.closest("tr");
    if (!row) return;

    const rowText = (row.innerText || "").trim();
    if (!rowText || isGroupHeaderOrNavigation(rowText)) {
      return;
    }

    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) return;

    // A) AGAR FOYDALANUVCHI PASTKI JADVALDAGI ANIQ BIR TEKSHIRUVGA BOSGAN BO'LSA:
    const hasTransId = cells.some(c => /^\d{6,8}$/.test(c.innerText.trim()));
    const hasTransDate = cells.some(c => /\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}/.test(c.innerText.trim()));
    const hasServiceCode = cells.some(c => /^R\d{2,5}$/i.test(c.innerText.trim()));

    if (hasTransId && (hasTransDate || hasServiceCode)) {
      handleSpecificBottomServiceClick(row, cells);
      return;
    }

    // B) AGAR YUQORI JADVALDAGI YASHIL (TUGAGAN) QATOR BO'LSA:
    if (isRowFinishedOrGreen(row, cells)) {
      selectedPatient = null;
      const txt = document.getElementById("uttFloatingPatientText");
      const btn = document.getElementById("uttFloatingSendBtn");
      if (txt && btn) {
        txt.innerHTML = `<span style="color:#22c55e; font-weight:700;">🟢 Bemor tekshiruvdan o'tib bo'lgan (Yashil qator) — Navbatga qo'yilmaydi</span>`;
        btn.disabled = true;
      }
      return;
    }

    // C) Ultratovush, Endoskopiya yoki Rentgen bo'lsa, e'tiborsiz qoldirish
    const lowerText = rowText.toLowerCase();
    if (lowerText.includes("ultratovush") || lowerText.includes("endoskopiya") || lowerText.includes("rentgen")) {
      return;
    }

    // D) YUQORI JADVALDAN BEMOR MA'LUMOTLARINI ANIKLASH:
    let idIdx = -1;
    let patientId = "";

    for (let i = 0; i < cells.length; i++) {
      const cText = cells[i].innerText.trim();
      if (/^\d{3,8}$/.test(cText) && !patientId && cText !== "2025" && cText !== "2026" && cText !== "2024") {
        idIdx = i;
        patientId = cText;
        break;
      }
    }

    if (idIdx === -1) return;

    let referringDoctor = cells[idIdx - 1] ? cells[idIdx - 1].innerText.trim() : "";
    let surname = cells[idIdx + 1] ? cells[idIdx + 1].innerText.trim() : "";
    let name = cells[idIdx + 2] ? cells[idIdx + 2].innerText.trim() : "";
    let priority = cells[idIdx + 3] ? cells[idIdx + 3].innerText.trim() : "";
    let department = cells[idIdx + 4] ? cells[idIdx + 4].innerText.trim() : "";

    // Sarlavhalardan ustun nomlarini aniqroq tekshirish
    try {
      const table = row.closest("table");
      if (table) {
        const headerRow = table.querySelector("tr");
        if (headerRow) {
          const ths = Array.from(headerRow.querySelectorAll("th, td")).map(th => th.innerText.trim().toLowerCase());
          const docIdx = ths.findIndex(h => h.includes("shifokor") || h.includes("fayl"));
          const prioIdx = ths.findIndex(h => h.includes("ustuvorlik") || h.includes("ustun"));
          const deptIdx = ths.findIndex(h => h.includes("bo'lim") || h.includes("bolim") || h.includes("ulangan"));

          if (docIdx !== -1 && cells[docIdx]) referringDoctor = cells[docIdx].innerText.trim();
          if (prioIdx !== -1 && cells[prioIdx]) priority = cells[prioIdx].innerText.trim();
          if (deptIdx !== -1 && cells[deptIdx]) department = cells[deptIdx].innerText.trim();
        }
      }
    } catch (e) {}

    const isStationary = priority.toLowerCase().includes("statsionar");
    const patientType = isStationary ? "Bo'limda yotibdi" : "Uyidan qatnaydi";
    const departmentName = isStationary ? department : "";

    if (!surname || /^\d+$/.test(surname) || surname.includes(":")) return;

    const fullName = `${surname} ${name}`.trim();

    // Bemor ma'lumotlarini eslab qolish
    lastPatientInfo = {
      id: patientId,
      name: fullName,
      referringDoctor: referringDoctor,
      priority: priority,
      department: departmentName,
      patientType: patientType,
      isStationary: isStationary
    };

    // Pastki jadvaldagi xizmatlarni o'qish va qo'llash
    const servicesList = findAllCurrentServicesPassively();
    applyServicesToPatient(lastPatientInfo, servicesList);

    // Kardelen pastki jadvalni AJAX orqali kechroq yuklashi mumkinligi sababli kechiktirilgan qayta tekshiruvlar:
    setTimeout(() => {
      if (lastPatientInfo && lastPatientInfo.id === patientId && (!selectedPatient || !selectedPatient.userSelectedSpecific)) {
        const freshServices = findAllCurrentServicesPassively();
        if (freshServices.length > 0) {
          applyServicesToPatient(lastPatientInfo, freshServices);
        }
      }
    }, 200);

    setTimeout(() => {
      if (lastPatientInfo && lastPatientInfo.id === patientId && (!selectedPatient || !selectedPatient.userSelectedSpecific)) {
        const freshServices = findAllCurrentServicesPassively();
        if (freshServices.length > 0) {
          applyServicesToPatient(lastPatientInfo, freshServices);
        }
      }
    }, 500);

    setTimeout(() => {
      if (lastPatientInfo && lastPatientInfo.id === patientId && (!selectedPatient || !selectedPatient.userSelectedSpecific)) {
        const freshServices = findAllCurrentServicesPassively();
        if (freshServices.length > 0) {
          applyServicesToPatient(lastPatientInfo, freshServices);
        }
      }
    }, 900);

  } catch (err) {
    console.warn("Passive click handler caught:", err);
  }
}

// 2.1 PASTKI JADVALDAN ANIQ BOSILGAN TEKSHIRUVNI QABUL QILISH
function handleSpecificBottomServiceClick(row, cells) {
  try {
    let candidateCode = cells.find(c => /^R\d{2,5}$/i.test(c.innerText.trim()))?.innerText.trim() || "";
    let candidateName = "";
    let serviceDoctor = "";

    for (const cell of cells) {
      const c = cell.innerText.trim();
      if (/^\d+$/.test(c)) continue;
      if (/\d{2}\.\d{2}\.\d{4}/.test(c)) continue;
      if (/^R\d{2,5}$/i.test(c)) continue;
      if (c === "-" || c === "") continue;
      if (c.includes("To'lanmagan") || c.includes("Tolanmagan") || c.includes("To'langan")) continue;

      if (c.includes("Dr.") || c.includes("Shifokor") || c.includes("Muminov") || c.includes("Sobit")) {
        serviceDoctor = c;
        continue;
      }

      if (c.length >= 4 && !candidateName) {
        candidateName = c;
      }
    }

    const catalogEntry = getServiceCatalogEntry(candidateCode, candidateName);
    if (!catalogEntry) return;

    const finalCode = catalogEntry.code || candidateCode;
    const finalName = catalogEntry.name || candidateName;
    const duration = parseInt(catalogEntry.duration, 10) || 30;
    const isContrast = catalogEntry.isContrast !== undefined ? catalogEntry.isContrast : isContrastService(finalName, row.innerText);
    const isMSKT = catalogEntry.type ? catalogEntry.type === "MSKT" : isMsktCheck(finalCode, finalName, row.innerText);
    const fullName = finalCode ? `${finalCode} - ${finalName}` : finalName;

    const specificService = {
      code: finalCode,
      name: finalName,
      fullName: fullName,
      duration: duration,
      preparation: catalogEntry.preparation || "",
      contraindications: catalogEntry.contraindications || "",
      isContrast: isContrast,
      isMSKT: isMSKT,
      type: isMSKT ? "MSKT" : "MRT"
    };

    // Bemor ma'lumotini olish
    let pInfo = lastPatientInfo || findActivePatientFromTopTable() || selectedPatient;
    if (!pInfo) {
      pInfo = {
        id: "—",
        name: "Tanlangan bemor",
        referringDoctor: serviceDoctor,
        priority: "",
        department: "",
        patientType: "Uyidan qatnaydi",
        isStationary: false
      };
    }

    if (serviceDoctor && !pInfo.referringDoctor) {
      pInfo.referringDoctor = serviceDoctor;
    }

    const combo = calculateCombinedProcedureInfo([specificService]);
    const allServices = findAllCurrentServicesPassively();

    selectedPatient = {
      ...pInfo,
      service: combo.service,
      serviceCode: combo.serviceCode,
      duration: combo.duration,
      preparation: combo.preparation,
      contraindications: combo.contraindications,
      type: combo.type,
      isContrast: combo.isContrast,
      contrastLabel: combo.contrastLabel,
      autoDeviceId: combo.recommendedDevice.id,
      autoDeviceName: combo.recommendedDevice.name,
      autoDeviceRoom: combo.recommendedDevice.room,
      servicesCount: 1,
      servicesList: [specificService],
      allPatientServices: allServices.length > 0 ? allServices : [specificService],
      calcMethod: "Foydalanuvchi tanlagan alohida tekshiruv",
      userSelectedSpecific: true
    };

    updateFloatingBarPatientDisplay();
  } catch (e) {
    console.warn("handleSpecificBottomServiceClick error:", e);
  }
}

function applyServicesToPatient(patientInfo, servicesList) {
  if (!patientInfo) return;

  if (!servicesList || servicesList.length === 0) {
    selectedPatient = null;
    const txt = document.getElementById("uttFloatingPatientText");
    const btn = document.getElementById("uttFloatingSendBtn");
    if (txt && btn) {
      txt.innerHTML = `<strong>${patientInfo.id} - ${patientInfo.name}</strong>: <span style="color:#ef4444; font-weight:700;">⚠️ Registrator ro'yxatida bunday tekshiruv topilmadi</span>`;
      btn.disabled = true;
    }
    return;
  }

  const combo = calculateCombinedProcedureInfo(servicesList);

  selectedPatient = {
    ...patientInfo,
    service: combo.service,
    serviceCode: combo.serviceCode,
    duration: combo.duration,
    preparation: combo.preparation,
    contraindications: combo.contraindications,
    type: combo.type,
    isContrast: combo.isContrast,
    contrastLabel: combo.contrastLabel,
    autoDeviceId: combo.recommendedDevice.id,
    autoDeviceName: combo.recommendedDevice.name,
    autoDeviceRoom: combo.recommendedDevice.room,
    servicesCount: combo.servicesCount,
    servicesList: combo.servicesList,
    allPatientServices: servicesList,
    calcMethod: combo.calcMethod,
    userSelectedSpecific: false
  };

  updateFloatingBarPatientDisplay();
}

function updateFloatingBarPatientDisplay() {
  const txt = document.getElementById("uttFloatingPatientText");
  const btn = document.getElementById("uttFloatingSendBtn");
  if (!txt || !btn || !selectedPatient) return;

  const multiBadge = (selectedPatient.servicesCount > 1) 
    ? ` <span style="background:#0284c7; color:#fff; padding:1px 6px; border-radius:10px; font-size:10px;">${selectedPatient.servicesCount} ta tekshiruv</span>` 
    : (selectedPatient.userSelectedSpecific ? ` <span style="background:#10b981; color:#fff; padding:1px 6px; border-radius:10px; font-size:10px;">Tanlangan tekshiruv</span>` : "");

  const typeBadge = selectedPatient.isStationary
    ? ` <span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">🏥 Bo'limda: ${escapeHtml(selectedPatient.department || 'Statsionar')}</span>`
    : ` <span style="background:#e0f2fe; color:#0284c7; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">🏠 Uyidan qatnaydi</span>`;

  txt.innerHTML = `<strong>${selectedPatient.id} - ${selectedPatient.name}</strong>${typeBadge}: <span style="color:#38bdf8; font-weight:700;">${escapeHtml(selectedPatient.service)}</span>${multiBadge} <span style="color:#f59e0b;">(${selectedPatient.autoDeviceName} | ⏱ ${selectedPatient.duration} daq | ${selectedPatient.contrastLabel})</span>`;
  btn.disabled = false;
}

function findActivePatientFromTopTable() {
  try {
    const allRows = document.querySelectorAll("tr");
    for (const r of allRows) {
      const text = (r.innerText || "").trim();
      if (!text || isGroupHeaderOrNavigation(text)) continue;

      const cells = Array.from(r.querySelectorAll("td"));
      if (cells.length < 3) continue;

      if (isRowFinishedOrGreen(r, cells)) continue;

      let idIdx = -1;
      let patientId = "";

      for (let i = 0; i < cells.length; i++) {
        const cText = cells[i].innerText.trim();
        if (/^\d{3,8}$/.test(cText) && cText !== "2024" && cText !== "2025" && cText !== "2026") {
          idIdx = i;
          patientId = cText;
          break;
        }
      }

      if (idIdx === -1) continue;

      let referringDoctor = cells[idIdx - 1] ? cells[idIdx - 1].innerText.trim() : "";
      let surname = cells[idIdx + 1] ? cells[idIdx + 1].innerText.trim() : "";
      let name = cells[idIdx + 2] ? cells[idIdx + 2].innerText.trim() : "";
      let priority = cells[idIdx + 3] ? cells[idIdx + 3].innerText.trim() : "";
      let department = cells[idIdx + 4] ? cells[idIdx + 4].innerText.trim() : "";

      if (!surname || /^\d+$/.test(surname) || surname.includes(":")) continue;

      const isStationary = priority.toLowerCase().includes("statsionar");
      const patientType = isStationary ? "Bo'limda yotibdi" : "Uyidan qatnaydi";

      return {
        id: patientId,
        name: `${surname} ${name}`.trim(),
        referringDoctor: referringDoctor,
        priority: priority,
        department: isStationary ? department : "",
        patientType: patientType,
        isStationary: isStationary
      };
    }
  } catch (e) {}
  return null;
}

// 3. YASHIL (TUGAGAN/QABUL QILINGAN) QATORNI ANIQ TEKSHIRISH
function isRowFinishedOrGreen(row, cells) {
  try {
    const rowClass = (row.className || "").toLowerCase();
    if (rowClass.includes("green") || rowClass.includes("completed") || rowClass.includes("finished")) {
      return true;
    }

    const elementsToCheck = [row, ...cells];
    for (const el of elementsToCheck) {
      const attrStyle = (el.getAttribute("style") || "").toLowerCase();
      if (isGreenColorText(attrStyle)) return true;

      const computedBg = window.getComputedStyle(el).backgroundColor;
      if (isGreenColorRgb(computedBg)) return true;
    }
  } catch (e) {}
  return false;
}

function isGreenColorText(s) {
  if (!s) return false;
  return s.includes("green") || s.includes("lime") || s.includes("#00ff") || s.includes("#99ff") || s.includes("#c8e") || s.includes("#a5d") || s.includes("#81c") || s.includes("#b9f") || s.includes("#69f") || s.includes("#22c55e") || s.includes("#10b981") || s.includes("#4ade80");
}

function isGreenColorRgb(colorStr) {
  if (!colorStr || colorStr === "rgba(0, 0, 0, 0)" || colorStr === "transparent") return false;
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    if (g > 130 && g > r + 15 && g > b + 15) return true;
    if (g > 170 && r < 210 && b < 210 && (g - r > 10 || g - b > 10)) return true;
  }
  return false;
}

function isGroupHeaderOrNavigation(text) {
  const t = (text || "").trim();
  if (/\(\d+\)$/.test(t) || /\b(mrt|mskt|tomografiya|ultratovush|rentgen)\s*\(\d+\)/i.test(t)) {
    return true;
  }
  if (t.includes("Displaying ") || t.includes("Page ") || t.includes("Ko'rsatiladigan") || t.includes("Fayl holati")) {
    return true;
  }
  return false;
}

// 4. PASTKI JADVALDAN FAQAT REGISTRATOR PANELIDA MAVJUD TEKSHIRUVLARNI ANIQ O'QISH
function findAllCurrentServicesPassively() {
  const foundServices = [];
  try {
    const allRows = document.querySelectorAll("tr");
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const text = (row.innerText || "").trim();
      if (!text || isGroupHeaderOrNavigation(text)) continue;

      if (text.includes("Navbat raqami") || text.includes("Tranzaksiya") || text.includes("Xizmatlar Nomi")) {
        continue;
      }

      const cells = Array.from(row.querySelectorAll("td")).map(c => c.innerText.trim());
      if (cells.length < 4) continue;

      // Faqat pastki tranzaksiya jadvalidagi qatorlar (7 xonali Navbat raqami VA Tranzaksiya sanasi bo'lishi shart!)
      const hasTransId = cells.some(c => /^\d{6,8}$/.test(c));
      const hasTransDate = cells.some(c => /\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}/.test(c));

      if (!hasTransId || !hasTransDate) {
        continue;
      }

      // 1. Kodni aniqlash (R184, R143, R157 va h.k.)
      let candidateCode = cells.find(c => /^R\d{2,5}$/i.test(c)) || "";
      
      // 2. Xizmat nomini aniqlash (Raqamlar, sanalar va shifokor nomlari chiqarib tashlanadi)
      let candidateName = "";
      for (const c of cells) {
        if (/^\d+$/.test(c)) continue; // Har qanday sof raqamlarni (ID, 3998, 0, 1 va h.k.) QAT'IYAN RAD ETISH
        if (/\d{2}\.\d{2}\.\d{4}/.test(c)) continue;
        if (/^R\d{2,5}$/i.test(c)) continue;
        if (c === "-" || c === "") continue;
        if (c.includes("Atabekov") || c.includes("Azimov") || c.includes("Dr.") || c.includes("To'lanmagan") || c.includes("Tolanmagan") || c.includes("To'langan")) continue;

        if (c.length >= 4) {
          candidateName = c;
          break;
        }
      }

      if (candidateName || candidateCode) {
        // Registratura katalogi (services_catalog) dan tekshirish
        const catalogEntry = getServiceCatalogEntry(candidateCode, candidateName);
        
        // AGAR REGISTRATOR KATALOGIDA BO'LMASA -> NAVBATGA QO'YILMAYDI!
        if (!catalogEntry) {
          continue;
        }

        const finalCode = catalogEntry.code || candidateCode;
        const finalName = catalogEntry.name || candidateName;
        const duration = parseInt(catalogEntry.duration, 10) || 30;
        const isContrast = catalogEntry.isContrast !== undefined ? catalogEntry.isContrast : isContrastService(finalName, text);
        const isMSKT = catalogEntry.type ? catalogEntry.type === "MSKT" : isMsktCheck(finalCode, finalName, text);

        const fullName = finalCode ? `${finalCode} - ${finalName}` : finalName;

        const existing = foundServices.find(s => s.fullName === fullName || (s.code && s.code === finalCode));
        if (!existing) {
          foundServices.push({
            code: finalCode,
            name: finalName,
            fullName: fullName,
            duration: duration,
            preparation: catalogEntry.preparation || "",
            contraindications: catalogEntry.contraindications || "",
            isContrast: isContrast,
            isMSKT: isMSKT,
            type: isMSKT ? "MSKT" : "MRT"
          });
        }
      }
    }
  } catch (e) {
    console.warn("findAllCurrentServicesPassively error:", e);
  }
  return foundServices;
}

// 5. REGISTRATURA KATALOGI BILAN AQLLI MOSLASHTIRISH
function getServiceCatalogEntry(serviceCode, serviceName) {
  const rawCode = (serviceCode || "").trim().toUpperCase();
  const rawName = (serviceName || "").trim();

  // Agar faqat sonlardan iborat bo'lsa -> rad etish
  if (/^\d+$/.test(rawName) && (!rawCode || rawCode === "0")) {
    return null;
  }

  const cleanName = rawName.toLowerCase()
    .replace(/[^a-z0-9а-яё\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 1. R-kod bo'yicha qidirish (R157, R184, R143 va h.k.)
  if (rawCode && /^R\d{2,5}$/i.test(rawCode)) {
    const key = rawCode.replace(/[^a-zA-Z0-9]/g, "_");
    if (servicesCatalog[key]) return servicesCatalog[key];
    for (const s of Object.values(servicesCatalog)) {
      if (s.code && s.code.toUpperCase() === rawCode) return s;
    }
  }

  // 2. Nomi bo'yicha qidirish
  if (cleanName && cleanName.length > 3) {
    const words = cleanName.split(" ").filter(w => w.length > 2 && w !== "tekshiruvi" && w !== "bilan");
    let bestScore = 0;
    let matched = null;

    for (const s of Object.values(servicesCatalog)) {
      if (!s.name) continue;
      const sNameClean = s.name.toLowerCase()
        .replace(/[^a-z0-9а-яё\s]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (sNameClean === cleanName || sNameClean.includes(cleanName) || cleanName.includes(sNameClean)) {
        return s;
      }

      let score = 0;
      for (const w of words) {
        if (sNameClean.includes(w)) {
          score += (w === "angio" || w === "kontrast" || w === "gipofiz" || w === "umurtqa" || w === "traktografiya" || w === "tos" || w === "kokrak" || w === "kaft" || w === "qol" || w === "tizza") ? 3 : 1;
        }
      }

      if (score > bestScore && score >= 2) {
        bestScore = score;
        matched = s;
      }
    }

    if (matched) return matched;
  }

  return null;
}

// 6. BIR NECHTA TEKSHIRUV BO'LGANDA VAQTNI HISOBLASH QOIDASI (MSKT: MAX, MRT: SUM)
function calculateCombinedProcedureInfo(servicesList) {
  if (!servicesList || servicesList.length === 0) {
    return {
      type: "MSKT",
      service: "MSKT Tekshiruvi",
      serviceCode: "",
      duration: 30,
      preparation: "",
      contraindications: "",
      isContrast: false,
      contrastLabel: "Oddiy (Kontrastsiz)",
      recommendedDevice: DEVICES[2],
      servicesCount: 0,
      servicesList: [],
      calcMethod: "Standart"
    };
  }

  // 1. Qurilma turi
  const isMSKT = servicesList.some(s => s.isMSKT);
  const deviceType = isMSKT ? "MSKT" : "MRT";

  // 2. Kontrast
  const isContrast = servicesList.some(s => s.isContrast);
  const contrastLabel = isContrast ? "💉 Kontrastli" : "Oddiy (Kontrastsiz)";

  // 3. Tayyorgarlik va Qarshi ko'rsatmalarni yig'ish
  const allPreps = servicesList.map(s => s.preparation).filter(Boolean).join("; ");
  const allContras = servicesList.map(s => s.contraindications).filter(Boolean).join("; ");

  // 4. VAQT HISOBLASH (Katalogdagi sozlamalar bo'yicha):
  // - MSKT: Eng kattasi (Math.max)
  // - MRT: Vaqtlar yig'indisi (Sum)
  let finalDuration = 30;
  let calcMethod = "";

  if (isMSKT) {
    const durations = servicesList.map(s => s.duration || 30);
    finalDuration = Math.max(...durations);
    calcMethod = servicesList.length > 1 ? `MSKT: Eng kattasi (${finalDuration} daq)` : `${finalDuration} daq`;
  } else {
    finalDuration = servicesList.reduce((sum, s) => sum + (s.duration || 30), 0);
    const durParts = servicesList.map(s => `${s.duration} daq`).join(" + ");
    calcMethod = servicesList.length > 1 ? `MRT: ${durParts} = ${finalDuration} daq` : `${finalDuration} daq`;
  }

  // 5. Nomlarni birlashtirish
  const serviceTitle = servicesList.map(s => s.fullName || s.name).join(" + ");
  const serviceCodes = servicesList.map(s => s.code).filter(Boolean).join(", ");

  // 6. Qurilma tanlash (Firebase /doctors ro'yxatidagi dinamik qurilmalardan)
  const matchingDevices = dynamicDevices.filter(d => d.type === deviceType);
  const availablePool = matchingDevices.length > 0 ? matchingDevices : dynamicDevices;

  let recommendedDevice = availablePool[0] || DEFAULT_DEVICES[0];
  let minQueue = Infinity;

  for (const dev of availablePool) {
    const qCount = deviceQueues[dev.id] || 0;
    if (qCount < minQueue) {
      minQueue = qCount;
      recommendedDevice = dev;
    }
  }

  return {
    type: deviceType,
    service: serviceTitle,
    serviceCode: serviceCodes,
    duration: finalDuration,
    preparation: allPreps,
    contraindications: allContras,
    isContrast: isContrast,
    contrastLabel: contrastLabel,
    recommendedDevice: recommendedDevice,
    servicesCount: servicesList.length,
    servicesList: servicesList,
    calcMethod: calcMethod
  };
}

function isContrastService(name, rawText) {
  const t = `${name} ${rawText}`.toLowerCase();
  return t.includes("kontrast") || t.includes("injektor") || t.includes("vena ichi") || t.includes("v/v") || t.includes("per os");
}

function isMsktCheck(code, name, rawText) {
  const c = (code || "").toUpperCase();
  const num = parseInt(c.replace(/\D/g, ""), 10);
  if (num >= 134 && num <= 155) return true;
  const t = `${name} ${rawText}`.toLowerCase();
  if (t.includes("mskt") || t.includes("msct") || t.includes("tomografiya(msct)")) return true;
  return false;
}

// 7. TEKSHIRUVLAR KATALOGINI FIREBASE-DAN YUKLASH
async function loadServicesCatalog() {
  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/services_catalog.json`);
    if (res && res.ok) {
      const data = await res.json();
      if (data) servicesCatalog = data;
    }
  } catch (e) {}
}

// 8. TIME-SLOT HISOBLASH (08:00 DAN BOSHLAB OCHIQ VAQTLARNI TEKSHIRISH)
async function calculateNextAvailableTimeSlot(deviceId, durationMinutes) {
  const duration = parseInt(durationMinutes, 10) || 30;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`);
    if (!res || !res.ok) return findEarliestFreeSlot([], duration);

    const data = await res.json();
    let devPatients = [];
    if (data) {
      Object.values(data).forEach(p => {
        if (p.doctorId === deviceId && p.status !== "cancelled") {
          devPatients.push(p);
        }
      });
    }

    return findEarliestFreeSlot(devPatients, duration);
  } catch (err) {
    return findEarliestFreeSlot([], duration);
  }
}

function addMinutesToTime(timeStr, mins) {
  try {
    const parts = (timeStr || "08:00").split(":");
    const h = parseInt(parts[0], 10) || 8;
    const m = parseInt(parts[1], 10) || 0;
    const totalM = h * 60 + m + mins;
    const newH = Math.floor(totalM / 60) % 24;
    const newM = totalM % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
  } catch (e) {
    return "08:30";
  }
}

// 9. AVTORIZATSIYA
async function loadOperatorsFromFirebase() {
  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/operators.json`);
    if (res && res.ok) {
      const data = await res.json();
      if (data) {
        operatorsList = Object.values(data);
      } else {
        const seed = {};
        DEFAULT_OPERATORS.forEach(op => { seed[op.login] = op; });
        safeFetch(`${FIREBASE_DB_URL}/operators.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(seed)
        });
      }
    }
  } catch (e) {}
}

async function checkUserAuth() {
  try {
    if (chrome.storage && chrome.storage.local) {
      const saved = await chrome.storage.local.get("utt_current_user");
      if (saved && saved.utt_current_user) {
        currentUser = saved.utt_current_user;
      }
    }
    if (!currentUser) {
      const local = localStorage.getItem("utt_current_user");
      if (local) currentUser = JSON.parse(local);
    }
  } catch (e) {}

  if (currentUser) {
    calculateTodayOperatorStats().catch(() => {});
  }
}

async function saveUserAuth(user) {
  currentUser = user;
  try {
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ utt_current_user: user });
    }
    localStorage.setItem("utt_current_user", JSON.stringify(user));
  } catch (e) {}
  updateFloatingBar();
  calculateTodayOperatorStats().catch(() => {});
}

async function clearUserAuth() {
  currentUser = null;
  try {
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove("utt_current_user");
    }
    localStorage.removeItem("utt_current_user");
  } catch (e) {}
  updateFloatingBar();
  openLoginModal();
}

// 10. LOGIN MODALI
function openLoginModal() {
  try {
    const oldModal = document.getElementById("uttLoginModal");
    if (oldModal) oldModal.remove();

    const overlay = document.createElement("div");
    overlay.id = "uttLoginModal";
    overlay.className = "utt-modal-overlay";

    overlay.innerHTML = `
      <div class="utt-modal-box">
        <div class="utt-modal-header">
          <h3>🔒 Tizimga Kirish (Tibbiy Ro'yxatchi)</h3>
          ${currentUser ? '<button class="utt-modal-close" id="uttLoginClose">&times;</button>' : ''}
        </div>

        <form id="uttLoginForm" onsubmit="return false;">
          <div class="utt-form-group">
            <label for="uttLoginSelect">Tibbiy Ro'yxatchi:</label>
            <select id="uttLoginSelect" required>
              ${operatorsList.map(op => `
                <option value="${op.login}">${op.login} — ${op.name}</option>
              `).join("")}
            </select>
          </div>

          <div class="utt-form-group">
            <label for="uttPasswordInput">Parol:</label>
            <input type="password" id="uttPasswordInput" placeholder="Parol (standart: 15420)" required autofocus>
          </div>

          <div id="uttLoginError" style="color:#ef4444; font-size:13px; font-weight:700; margin-bottom:12px; display:none;">
            ❌ Parol noto'g'ri! Iltimos, qayta urinib ko'ring.
          </div>

          <div class="utt-modal-actions" style="margin-top:20px;">
            ${currentUser ? '<button type="button" class="utt-btn-cancel" id="uttLoginCancel">Bekor qilish</button>' : ''}
            <button type="button" class="utt-btn-submit" id="uttBtnDoLogin" style="width:100%;">
              Tizimga Kirish 🚀
            </button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const pwdInput = document.getElementById("uttPasswordInput");
    if (pwdInput) {
      pwdInput.focus();
      pwdInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleLoginAction();
      });
    }

    const doLoginBtn = document.getElementById("uttBtnDoLogin");
    if (doLoginBtn) doLoginBtn.onclick = handleLoginAction;

    if (document.getElementById("uttLoginClose")) {
      document.getElementById("uttLoginClose").onclick = () => overlay.remove();
    }
    if (document.getElementById("uttLoginCancel")) {
      document.getElementById("uttLoginCancel").onclick = () => overlay.remove();
    }

    async function handleLoginAction() {
      try {
        const selectedLogin = document.getElementById("uttLoginSelect").value;
        const inputPwd = document.getElementById("uttPasswordInput").value.trim();
        const errEl = document.getElementById("uttLoginError");

        const foundOp = operatorsList.find(o => o.login.toUpperCase() === selectedLogin.toUpperCase());

        if (foundOp && String(foundOp.password) === String(inputPwd)) {
          if (errEl) errEl.style.display = "none";
          await saveUserAuth(foundOp);
          overlay.remove();
          showToast(`👋 Xush kelibsiz, ${foundOp.name} (${foundOp.login})!`);
        } else {
          if (errEl) errEl.style.display = "block";
          const pInput = document.getElementById("uttPasswordInput");
          if (pInput) { pInput.value = ""; pInput.focus(); }
        }
      } catch (e) {}
    }
  } catch (e) {}
}

// 11. PROFILNI BOSHQARISH
function openProfileModal() {
  try {
    if (!currentUser) {
      openLoginModal();
      return;
    }

    const oldModal = document.getElementById("uttProfileModal");
    if (oldModal) oldModal.remove();

    const overlay = document.createElement("div");
    overlay.id = "uttProfileModal";
    overlay.className = "utt-modal-overlay";

    overlay.innerHTML = `
      <div class="utt-modal-box">
        <div class="utt-modal-header">
          <h3>👤 Tibbiy Ro'yxatchi Profili</h3>
          <button class="utt-modal-close" id="uttProfileClose">&times;</button>
        </div>

        <div class="utt-profile-card">
          <div class="utt-profile-avatar">${currentUser.login}</div>
          <div>
            <div class="utt-profile-name">${escapeHtml(currentUser.name)}</div>
            <div class="utt-profile-sub">Logini: <strong>${currentUser.login}</strong> | Lavozim: ${currentUser.role || 'Tibbiy Ro\'yxatchi'}</div>
          </div>
        </div>

        <div class="utt-stat-pill">
          <span>Bugun navbatga yozgan bemorlaringiz:</span>
          <strong id="uttStatCount">${todayOperatorQueueCount} nafar</strong>
        </div>

        <div style="border-top:1px solid #e2e8f0; padding-top:14px; margin-top:10px;">
          <h4 style="font-size:14px; margin-bottom:10px; color:#0f172a;">🔑 Parolni O'zgartirish</h4>
          
          <div class="utt-form-group">
            <label for="uttOldPwd">Eski parol:</label>
            <input type="password" id="uttOldPwd" placeholder="Hozirgi parol (15420)">
          </div>

          <div class="utt-form-group">
            <label for="uttNewPwd">Yangi parol:</label>
            <input type="password" id="uttNewPwd" placeholder="Yangi parol">
          </div>

          <div class="utt-form-group">
            <label for="uttNewPwd2">Yangi parolni takrorlang:</label>
            <input type="password" id="uttNewPwd2" placeholder="Yangi parolni tasdiqlang">
          </div>

          <div id="uttPwdMsg" style="font-size:12px; font-weight:700; margin-bottom:10px; display:none;"></div>

          <button type="button" class="utt-btn-submit" id="uttBtnSavePwd" style="width:100%; margin-bottom:14px;">
            Yangi Parolni Saqlash
          </button>
        </div>

        <div style="border-top:1px solid #e2e8f0; padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
          <button type="button" class="utt-btn-danger" id="uttBtnLogout">
            🚪 Tizimdan Chiqish (Log out)
          </button>
          <button type="button" class="utt-btn-cancel" id="uttProfileCancel">
            Yopish
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("uttProfileClose").onclick = () => overlay.remove();
    document.getElementById("uttProfileCancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    document.getElementById("uttBtnLogout").onclick = () => {
      if (confirm("Tizimdan chiqmoqchimisiz?")) {
        overlay.remove();
        clearUserAuth();
      }
    };

    document.getElementById("uttBtnSavePwd").onclick = async () => {
      try {
        const oldP = document.getElementById("uttOldPwd").value.trim();
        const newP = document.getElementById("uttNewPwd").value.trim();
        const newP2 = document.getElementById("uttNewPwd2").value.trim();
        const msgEl = document.getElementById("uttPwdMsg");

        if (String(currentUser.password) !== String(oldP)) {
          msgEl.style.display = "block";
          msgEl.style.color = "#ef4444";
          msgEl.innerText = "❌ Eski parol noto'g'ri!";
          return;
        }

        if (!newP || newP.length < 3) {
          msgEl.style.display = "block";
          msgEl.style.color = "#ef4444";
          msgEl.innerText = "❌ Yangi parol kamida 3 ta belgidan iborat bo'lsin!";
          return;
        }

        if (newP !== newP2) {
          msgEl.style.display = "block";
          msgEl.style.color = "#ef4444";
          msgEl.innerText = "❌ Yangi parollar bir-biriga mos kelmadi!";
          return;
        }

        currentUser.password = newP;
        await saveUserAuth(currentUser);

        safeFetch(`${FIREBASE_DB_URL}/operators/${currentUser.login}.json`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: newP })
        });

        msgEl.style.display = "block";
        msgEl.style.color = "#10b981";
        msgEl.innerText = "✅ Parol muvaffaqiyatli o'zgartirildi!";
        document.getElementById("uttOldPwd").value = "";
        document.getElementById("uttNewPwd").value = "";
        document.getElementById("uttNewPwd2").value = "";
      } catch (e) {}
    };
  } catch (e) {}
}

async function calculateTodayOperatorStats() {
  if (!currentUser) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`);
    if (!res || !res.ok) return;
    const data = await res.json();
    todayOperatorQueueCount = 0;
    if (data) {
      Object.values(data).forEach(p => {
        if (p.operatorLogin === currentUser.login || (p.operator && p.operator.login === currentUser.login)) {
          todayOperatorQueueCount++;
        }
      });
    }
    const statEl = document.getElementById("uttStatCount");
    if (statEl) statEl.innerText = `${todayOperatorQueueCount} nafar`;
  } catch (e) {}
}

// 11.2 NAVBATDAGI BEMORLAR RO'YXATI MODALI (QURILMALAR BO'YICHA SARALASH)
async function openQueueListModal() {
  try {
    if (!currentUser) {
      openLoginModal();
      return;
    }

    const oldModal = document.getElementById("uttQueueListModal");
    if (oldModal) oldModal.remove();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let selectedDate = todayStr;
    let selectedDevFilter = "all";
    let searchQuery = "";
    let cachedPatients = [];
    let currentDensity = "standard"; // 'standard', 'spacious', 'compact'
    let isFullscreen = false;

    const overlay = document.createElement("div");
    overlay.id = "uttQueueListModal";
    overlay.className = "utt-modal-overlay";

    overlay.innerHTML = `
      <div class="utt-queue-modal-box" id="uttQueueModalBox">
        <!-- Modal Header -->
        <div class="utt-modal-header" style="margin-bottom:10px; padding-bottom:8px;">
          <div style="display:flex; align-items:center; gap:12px;">
            <h3>📋 MRT & MSKT Navbatdagi Bemorlar Ro'yxati</h3>
            <button type="button" id="uttBtnRefreshQueue" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; color:#334155; display:inline-flex; align-items:center; gap:4px;">
              🔄 Yangilash
            </button>
            <button type="button" id="uttBtnToggleFullscreen" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; color:#0284c7; display:inline-flex; align-items:center; gap:4px;">
              ⛶ Katta Ekran
            </button>
          </div>
          <button class="utt-modal-close" id="uttQueueListClose" style="font-size:26px;">&times;</button>
        </div>

        <!-- Filter, Search & Density Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
          <!-- Sana Filtrlari -->
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-size:12px; font-weight:700; color:#475569;">📅 Sana:</span>
            <button type="button" class="utt-btn-date" id="uttQLBtnToday" style="padding:5px 12px; border-radius:6px; border:1px solid #0284c7; background:#0284c7; color:#fff; cursor:pointer; font-weight:bold; font-size:12px;">Bugun</button>
            <button type="button" class="utt-btn-date" id="uttQLBtnTomorrow" style="padding:5px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; color:#334155; cursor:pointer; font-weight:bold; font-size:12px;">Ertaga</button>
            <input type="date" id="uttQLDateInput" value="${todayStr}" style="padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
          </div>

          <!-- Qator Balandligi (Density) & Qidiruv -->
          <div style="display:flex; gap:10px; align-items:center;">
            <div style="display:flex; align-items:center; gap:4px; font-size:12px; background:#f8fafc; border:1px solid #cbd5e1; padding:2px 6px; border-radius:6px;">
              <span style="font-size:11px; color:#64748b; font-weight:bold;">Qator:</span>
              <button type="button" id="uttBtnDensStandard" style="padding:3px 8px; border:none; background:#0284c7; color:#fff; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">Standart</button>
              <button type="button" id="uttBtnDensSpacious" style="padding:3px 8px; border:none; background:transparent; color:#334155; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">Keng</button>
              <button type="button" id="uttBtnDensCompact" style="padding:3px 8px; border:none; background:transparent; color:#334155; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">Zich</button>
            </div>

            <!-- Qidiruv Box -->
            <div style="width:280px;">
              <input type="text" id="uttQLSearchInput" placeholder="🔍 ID, F.I.Sh, Bo'lim yoki Shifokor..." style="width:100%; padding:6px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px; outline:none;">
            </div>
          </div>
        </div>

        <!-- Qurilmalar Bo'yicha Saralash Tablari -->
        <div id="uttDevTabsContainer" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:8px; margin-bottom:10px; border-bottom:1px solid #e2e8f0;">
          <!-- Dynamic Device Tabs -->
        </div>

        <!-- Bemorlar Jadvali / Ro'yxati Container -->
        <div id="uttQueueTableWrapper" style="flex-grow:1; overflow-y:auto; overflow-x:auto; border:1px solid #cbd5e1; border-radius:8px; background:#fff;">
          <div style="padding:30px; text-align:center; color:#94a3b8; font-size:13px;">Bemorlar yuklanmoqda...</div>
        </div>

        <!-- Modal Footer Info -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:12px; color:#64748b;">
          <div id="uttQLSummaryText">Jami: 0 nafar bemor</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <span style="font-size:11px; color:#94a3b8;">💡 Ustun chegarasini sichqoncha bilan tortib kengaytirishingiz mumkin</span>
            <button type="button" id="uttQLCloseBtn" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:6px 18px; border-radius:8px; font-weight:700; cursor:pointer; color:#334155;">
              Yopish
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const modalBox = document.getElementById("uttQueueModalBox");
    const closeBtn = document.getElementById("uttQueueListClose");
    const bottomCloseBtn = document.getElementById("uttQLCloseBtn");
    const toggleFsBtn = document.getElementById("uttBtnToggleFullscreen");

    if (closeBtn) closeBtn.onclick = () => overlay.remove();
    if (bottomCloseBtn) bottomCloseBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    if (toggleFsBtn) {
      toggleFsBtn.onclick = () => {
        isFullscreen = !isFullscreen;
        if (isFullscreen) {
          modalBox.classList.add("utt-fullscreen");
          toggleFsBtn.innerText = "🗗 Kichraytirish";
        } else {
          modalBox.classList.remove("utt-fullscreen");
          toggleFsBtn.innerText = "⛶ Katta Ekran";
        }
      };
    }

    // Density (qator balandligi) boshqaruvi
    const bDensStd = document.getElementById("uttBtnDensStandard");
    const bDensSpc = document.getElementById("uttBtnDensSpacious");
    const bDensCmp = document.getElementById("uttBtnDensCompact");

    function setDensity(dens) {
      currentDensity = dens;
      [bDensStd, bDensSpc, bDensCmp].forEach(b => {
        if (b) {
          b.style.background = "transparent";
          b.style.color = "#334155";
        }
      });
      if (dens === "standard" && bDensStd) { bDensStd.style.background = "#0284c7"; bDensStd.style.color = "#fff"; }
      if (dens === "spacious" && bDensSpc) { bDensSpc.style.background = "#0284c7"; bDensSpc.style.color = "#fff"; }
      if (dens === "compact" && bDensCmp) { bDensCmp.style.background = "#0284c7"; bDensCmp.style.color = "#fff"; }
      renderQueueListUI();
    }

    if (bDensStd) bDensStd.onclick = () => setDensity("standard");
    if (bDensSpc) bDensSpc.onclick = () => setDensity("spacious");
    if (bDensCmp) bDensCmp.onclick = () => setDensity("compact");

    const dateInput = document.getElementById("uttQLDateInput");
    const btnToday = document.getElementById("uttQLBtnToday");
    const btnTomorrow = document.getElementById("uttQLBtnTomorrow");
    const refreshBtn = document.getElementById("uttBtnRefreshQueue");
    const searchInput = document.getElementById("uttQLSearchInput");

    btnToday.onclick = () => {
      selectedDate = todayStr;
      dateInput.value = todayStr;
      btnToday.style.background = "#0284c7";
      btnToday.style.color = "#fff";
      btnToday.style.borderColor = "#0284c7";
      btnTomorrow.style.background = "#fff";
      btnTomorrow.style.color = "#334155";
      btnTomorrow.style.borderColor = "#cbd5e1";
      loadAndRenderQueueData();
    };

    btnTomorrow.onclick = () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
      selectedDate = tomorrowStr;
      dateInput.value = tomorrowStr;
      btnTomorrow.style.background = "#0284c7";
      btnTomorrow.style.color = "#fff";
      btnTomorrow.style.borderColor = "#0284c7";
      btnToday.style.background = "#fff";
      btnToday.style.color = "#334155";
      btnToday.style.borderColor = "#cbd5e1";
      loadAndRenderQueueData();
    };

    dateInput.onchange = () => {
      selectedDate = dateInput.value || todayStr;
      btnToday.style.background = (selectedDate === todayStr) ? "#0284c7" : "#fff";
      btnToday.style.color = (selectedDate === todayStr) ? "#fff" : "#334155";
      btnToday.style.borderColor = (selectedDate === todayStr) ? "#0284c7" : "#cbd5e1";
      loadAndRenderQueueData();
    };

    if (refreshBtn) refreshBtn.onclick = () => loadAndRenderQueueData();

    if (searchInput) {
      searchInput.oninput = () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        renderQueueListUI();
      };
    }

    async function loadAndRenderQueueData() {
      const wrapper = document.getElementById("uttQueueTableWrapper");
      if (wrapper) wrapper.innerHTML = `<div style="padding:30px; text-align:center; color:#94a3b8; font-size:13px;">${selectedDate} sanasi bo'yicha ma'lumotlar yuklanmoqda...</div>`;

      try {
        const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${selectedDate}.json`);
        if (res && res.ok) {
          const data = await res.json();
          cachedPatients = [];
          if (data) {
            Object.keys(data).forEach(k => {
              const p = data[k];
              p.id = k;
              cachedPatients.push(p);
            });
          }
        } else {
          cachedPatients = [];
        }
      } catch (err) {
        cachedPatients = [];
      }

      renderDevTabs();
      renderQueueListUI();
    }

    function renderDevTabs() {
      const tabsContainer = document.getElementById("uttDevTabsContainer");
      if (!tabsContainer) return;

      const totalCount = cachedPatients.filter(p => p.status !== "cancelled").length;

      let html = `
        <button type="button" class="utt-dev-tab-btn ${selectedDevFilter === 'all' ? 'active' : ''}" data-dev="all">
          🌐 Barchasi (${totalCount})
        </button>
      `;

      dynamicDevices.forEach(d => {
        const devCount = cachedPatients.filter(p => p.doctorId === d.id && p.status !== "cancelled").length;
        const icon = (d.type === "MSKT") ? "⚡" : "🧲";
        html += `
          <button type="button" class="utt-dev-tab-btn ${selectedDevFilter === d.id ? 'active' : ''}" data-dev="${d.id}">
            ${icon} ${escapeHtml(d.room || d.name)} (${devCount})
          </button>
        `;
      });

      tabsContainer.innerHTML = html;

      tabsContainer.querySelectorAll(".utt-dev-tab-btn").forEach(btn => {
        btn.onclick = () => {
          selectedDevFilter = btn.getAttribute("data-dev");
          tabsContainer.querySelectorAll(".utt-dev-tab-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          renderQueueListUI();
        };
      });
    }

    function renderQueueListUI() {
      const wrapper = document.getElementById("uttQueueTableWrapper");
      const summaryEl = document.getElementById("uttQLSummaryText");
      if (!wrapper) return;

      // Filtrlash
      let filtered = cachedPatients.filter(p => {
        const matchDev = (selectedDevFilter === "all") || (p.doctorId === selectedDevFilter);
        const q = searchQuery;
        const matchQuery = !q ||
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.ticketId && p.ticketId.toLowerCase().includes(q)) ||
          (p.service && p.service.toLowerCase().includes(q)) ||
          (p.referringDoctor && p.referringDoctor.toLowerCase().includes(q)) ||
          (p.department && p.department.toLowerCase().includes(q));
        return matchDev && matchQuery;
      });

      // Vaqt bo'yicha xronologik saralash (08:00 dan boshlab)
      filtered.sort((a, b) => {
        const timeA = a.scheduledTime || a.time || "08:00";
        const timeB = b.scheduledTime || b.time || "08:00";
        return timeA.localeCompare(timeB);
      });

      if (summaryEl) {
        const activeCount = filtered.filter(p => p.status !== "cancelled").length;
        summaryEl.innerText = `Ko'rsatilmoqda: ${filtered.length} nafar (Faol navbat: ${activeCount} nafar) | Sana: ${selectedDate}`;
      }

      if (filtered.length === 0) {
        wrapper.innerHTML = `
          <div style="padding:40px 20px; text-align:center; color:#94a3b8;">
            <div style="font-size:32px; margin-bottom:8px;">📭</div>
            <div style="font-size:14px; font-weight:700; color:#475569;">${selectedDate} sanasi uchun bemorlar topilmadi</div>
            <div style="font-size:12px; margin-top:4px;">Ushbu kunga hali hech qanday bemor yozilmagan yoki qidiruvga mos kelmadi.</div>
          </div>
        `;
        return;
      }

      // Agar "Barchasi" tanlangan bo'lsa -> Qurilmalar bo'yicha guruhlab ko'rsatish
      let contentHtml = "";

      if (selectedDevFilter === "all") {
        dynamicDevices.forEach(dev => {
          const devList = filtered.filter(p => p.doctorId === dev.id);
          if (devList.length === 0) return;

          const icon = (dev.type === "MSKT") ? "⚡" : "🧲";
          contentHtml += `
            <div style="background:#f8fafc; padding:8px 14px; border-bottom:1px solid #cbd5e1; font-weight:800; font-size:13px; color:#0f172a; display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; z-index:5;">
              <span>${icon} ${escapeHtml(dev.room || dev.name)} (${escapeHtml(dev.name)})</span>
              <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:12px; font-size:11px;">${devList.length} ta bemor</span>
            </div>
            ${renderPatientsTableHtml(devList)}
          `;
        });

        const unknownList = filtered.filter(p => !dynamicDevices.some(d => d.id === p.doctorId));
        if (unknownList.length > 0) {
          contentHtml += `
            <div style="background:#f8fafc; padding:8px 14px; border-bottom:1px solid #cbd5e1; font-weight:800; font-size:13px; color:#0f172a; position:sticky; top:0; z-index:5;">
              Boshqa qurilmalar
            </div>
            ${renderPatientsTableHtml(unknownList)}
          `;
        }
      } else {
        contentHtml = renderPatientsTableHtml(filtered);
      }

      wrapper.innerHTML = contentHtml;

      // Ustunlarni tortib o'lchamini o'zgartirish (Column Resizer) ni faollashtirish
      wrapper.querySelectorAll(".utt-queue-table").forEach(tbl => makeTableResizable(tbl));

      // Talon chop etish tugmalarini ulash
      wrapper.querySelectorAll(".utt-btn-print-ticket").forEach(btn => {
        btn.onclick = () => {
          const pId = btn.getAttribute("data-id");
          const pat = cachedPatients.find(p => p.id === pId);
          if (pat) printThermalTicketDirect(pat);
        };
      });
    }

    function renderPatientsTableHtml(list) {
      const densityClass = (currentDensity === "spacious") ? "utt-density-spacious" : (currentDensity === "compact" ? "utt-density-compact" : "");
      return `
        <table class="utt-queue-table ${densityClass}">
          <thead>
            <tr>
              <th style="width:105px; min-width:95px;">Vaqt</th>
              <th style="width:65px; min-width:55px;">ID</th>
              <th style="width:160px; min-width:140px;">Bemor F.I.Sh</th>
              <th style="width:145px; min-width:130px;">Toifasi / Bo'lim</th>
              <th style="min-width:380px;">Tekshiruv Nomi</th>
              <th style="width:150px; min-width:130px;">Fayl Shifokori</th>
              <th style="width:120px; min-width:110px;">Ro'yxatchi</th>
              <th style="width:90px; min-width:80px;">Holat</th>
              <th style="text-align:center; width:50px; min-width:45px;">Talon</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(p => {
              const isCancelled = p.status === "cancelled";
              const oldSlot = p.cancelledSlot || p.timeSlot || p.scheduledTime || "-";
              const timeDisplay = isCancelled
                ? `<div style="color:#94a3b8; font-size:11px; text-decoration:line-through;">${escapeHtml(oldSlot)}</div><span style="color:#15803d; font-size:9px; font-weight:bold;">🟢 Bo'shatilgan</span>`
                : `<strong style="color:#0284c7; font-size:12px;">${escapeHtml(p.timeSlot || p.scheduledTime || p.time || '-')}</strong>`;

              const typeBadge = p.patientType === "Bo'limda yotibdi"
                ? `<span style="background:#fef3c7; color:#b45309; font-size:11px; font-weight:bold; padding:3px 7px; border-radius:4px; display:inline-block;">🏥 Bo'limda ${p.department ? `(${escapeHtml(p.department)})` : ''}</span>`
                : `<span style="background:#e0f2fe; color:#0284c7; font-size:11px; font-weight:bold; padding:3px 7px; border-radius:4px; display:inline-block;">🏠 Uyidan qatnaydi</span>`;

              let statusBadge = `<span style="background:#fef3c7; color:#b45309; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">Kutmoqda</span>`;
              if (p.status === "calling") statusBadge = `<span style="background:#fce7f3; color:#be185d; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">Chaqirilmoqda</span>`;
              if (p.status === "in_progress") statusBadge = `<span style="background:#e0e7ff; color:#4338ca; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">Qabulda</span>`;
              if (p.status === "completed") statusBadge = `<span style="background:#dcfce7; color:#15803d; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">Yakunlandi</span>`;
              if (isCancelled) statusBadge = `<span style="background:#fee2e2; color:#dc2626; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">O'chirilgan</span>`;

              // Tekshiruvlarni chiroyli kartochka ko'rinishida formatlash
              let servicesDisplayHtml = "";
              if (p.servicesList && p.servicesList.length > 0) {
                servicesDisplayHtml = p.servicesList.map(s => `
                  <div class="utt-svc-item ${s.isContrast ? 'contrast' : ''}">
                    <strong style="color:${s.isContrast ? '#b91c1c' : '#0369a1'};">${s.code ? escapeHtml(s.code) + ' - ' : ''}</strong>${escapeHtml(s.name || s.fullName)}
                    ${s.isContrast ? '<span style="background:#fee2e2; color:#b91c1c; font-size:9px; font-weight:800; padding:1px 5px; border-radius:3px; margin-left:4px;">KONTRAST</span>' : ''}
                    <span style="color:#64748b; font-size:10px; margin-left:4px;">(⏱ ${s.duration || 30} daq)</span>
                  </div>
                `).join("");
              } else {
                const parts = (p.service || "-").split(" + ");
                servicesDisplayHtml = parts.map(part => `
                  <div class="utt-svc-item ${p.isContrast ? 'contrast' : ''}">
                    ${escapeHtml(part)}
                    ${p.isContrast ? '<span style="background:#fee2e2; color:#b91c1c; font-size:9px; font-weight:800; padding:1px 5px; border-radius:3px; margin-left:4px;">KONTRAST</span>' : ''}
                  </div>
                `).join("");
              }

              return `
                <tr style="${isCancelled ? 'opacity:0.65; background:#fff5f5;' : ''}">
                  <td>${timeDisplay}</td>
                  <td><span style="background:#f1f5f9; padding:3px 6px; border-radius:4px; font-weight:800; font-size:11px;">${escapeHtml(p.ticketId)}</span></td>
                  <td>
                    <strong style="color:#0f172a; font-size:13px;">${escapeHtml(p.name)}</strong>
                    ${p.rescheduleReason ? `<div style="font-size:10.5px; color:#b45309; margin-top:2px;">⚠️ ${escapeHtml(p.rescheduleReason)}</div>` : ''}
                  </td>
                  <td>${typeBadge}</td>
                  <td style="padding:6px 10px;">
                    ${servicesDisplayHtml}
                  </td>
                  <td style="color:#334155; font-size:11.5px;">${p.referringDoctor ? `👨‍⚕️ <strong>${escapeHtml(p.referringDoctor)}</strong>` : '-'}</td>
                  <td style="color:#64748b; font-size:11px;">${escapeHtml(p.registeredBy || p.operatorLogin || '-')}</td>
                  <td>${statusBadge}</td>
                  <td style="text-align:center;">
                    <button type="button" class="utt-btn-print-ticket" data-id="${p.id}" title="Talonni chop etish" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:4px 8px; border-radius:6px; cursor:pointer; font-size:13px;">
                      🖨️
                    </button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    }

    // Ustunlarni tortib o'lchamini o'zgartirish funksiyasi (Column Resizer)
    function makeTableResizable(table) {
      if (!table) return;
      const ths = table.querySelectorAll("thead th");
      ths.forEach(th => {
        th.classList.add("col-resizable");
        th.querySelectorAll(".utt-col-resizer").forEach(r => r.remove());

        const resizer = document.createElement("div");
        resizer.className = "utt-col-resizer";
        th.appendChild(resizer);

        let startX, startWidth;

        resizer.addEventListener("mousedown", function(e) {
          e.preventDefault();
          e.stopPropagation();
          startX = e.pageX;
          startWidth = th.offsetWidth;
          document.body.style.cursor = "col-resize";

          function onMouseMove(e) {
            const newWidth = Math.max(45, startWidth + (e.pageX - startX));
            th.style.width = newWidth + "px";
            th.style.minWidth = newWidth + "px";
          }

          function onMouseUp() {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.cursor = "";
          }

          document.addEventListener("mousemove", onMouseMove);
          document.addEventListener("mouseup", onMouseUp);
        });
      });
    }

    // Boshlang'ich yuklash
    loadAndRenderQueueData();
  } catch (e) {}
}

async function fetchDeviceQueueCounts() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`);
    if (!res || !res.ok) return;
    const data = await res.json();
    
    deviceQueues = { mrt1: 0, mrt2: 0, mskt1: 0, mskt2: 0 };
    if (data) {
      Object.values(data).forEach(p => {
        if (p.status === "waiting" && deviceQueues[p.doctorId] !== undefined) {
          deviceQueues[p.doctorId]++;
        }
      });
    }
  } catch (e) {}
}

// 12. QURILMANI TANLASH VA YUBORISH MODALI
async function openSendModal(patientData) {
  try {
    if (!currentUser) {
      openLoginModal();
      return;
    }

    selectedPatient = patientData;

    const oldModal = document.getElementById("uttSendModal");
    if (oldModal) oldModal.remove();

    // Bemorga biriktirilgan barcha xizmatlar (pastki jadvaldan yoki modalga kelgan obyektidan)
    const allAvailableServices = (patientData.allPatientServices && patientData.allPatientServices.length > 0)
      ? patientData.allPatientServices
      : (patientData.servicesList && patientData.servicesList.length > 0 ? patientData.servicesList : []);

    let activeServiceInfo = {
      service: patientData.service,
      serviceCode: patientData.serviceCode || "",
      duration: patientData.duration || 30,
      preparation: patientData.preparation || "",
      contraindications: patientData.contraindications || "",
      type: patientData.type || "MSKT",
      isContrast: patientData.isContrast,
      contrastLabel: patientData.contrastLabel || "Oddiy",
      autoDeviceId: patientData.autoDeviceId || (dynamicDevices[0] ? dynamicDevices[0].id : "mrt1"),
      servicesCount: patientData.servicesCount || 1,
      servicesList: patientData.servicesList || [],
      calcMethod: patientData.calcMethod || ""
    };

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    let selectedDate = todayStr;
    let selectedMode = "auto";
    let isModalSlotValid = true;
    let currentSlotData = await calculateNextAvailableTimeSlot(activeServiceInfo.autoDeviceId, activeServiceInfo.duration);

    const overlay = document.createElement("div");
    overlay.id = "uttSendModal";
    overlay.className = "utt-modal-overlay";

    // Agar 1 dan ko'p xizmat bo'lsa yoki bitta bo'lsa, tanlash interfeysini shakllantirish
    let serviceSelectorHtml = "";
    if (allAvailableServices.length > 1) {
      const isSpecific = patientData.userSelectedSpecific && patientData.servicesList && patientData.servicesList.length === 1;
      const selectedCode = isSpecific ? patientData.servicesList[0].code : "";

      serviceSelectorHtml = `
        <div style="background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin:10px 0;">
          <div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:8px;">
            📋 Navbatga qo'yiladigan tekshiruvni tanlang:
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:6px; cursor:pointer; background:#fff; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1;">
            <input type="radio" name="uttModalSvcChoice" value="all" ${!isSpecific ? 'checked' : ''}>
            <div>
              <strong style="color:#0284c7;">Barcha tekshiruvlarni birga navbatga qo'yish (Kombinatsiya)</strong>
              <div style="color:#64748b; font-size:11px;">Jami ${allAvailableServices.length} ta tekshiruv</div>
            </div>
          </label>
          ${allAvailableServices.map((s, idx) => `
            <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:4px; cursor:pointer; background:#fff; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1;">
              <input type="radio" name="uttModalSvcChoice" value="${idx}" ${(isSpecific && selectedCode === s.code) ? 'checked' : ''}>
              <div>
                <strong style="color:#0f172a;">${idx + 1}. ${escapeHtml(s.fullName || s.name)}</strong>
                <div style="color:#10b981; font-size:11px; font-weight:bold;">⏱ ${s.duration} daqiqa ${s.isContrast ? ' | 💉 Kontrastli' : ''}</div>
              </div>
            </label>
          `).join("")}
        </div>
      `;
    }

    overlay.innerHTML = `
      <div class="utt-modal-box" style="max-height:92vh; overflow-y:auto; max-width:540px;">
        <div class="utt-modal-header">
          <h3>⚡ MRT & MSKT Navbatiga Yozish</h3>
          <button class="utt-modal-close" id="uttModalClose">&times;</button>
        </div>

        <div class="utt-patient-info-box">
          <div class="utt-info-row">
            <span class="utt-info-label">Yo'naltirgan Ro'yxatchi:</span>
            <span class="utt-info-val" style="color:#0284c7;">
              👤 <strong>${currentUser.login}</strong> — ${escapeHtml(currentUser.name)}
            </span>
          </div>
          <div class="utt-info-row">
            <span class="utt-info-label">Bemor ID:</span>
            <span class="utt-info-val">${escapeHtml(patientData.id)}</span>
          </div>
          <div class="utt-info-row">
            <span class="utt-info-label">Bemor F.I.Sh:</span>
            <span class="utt-info-val">${escapeHtml(patientData.name)}</span>
          </div>

          ${serviceSelectorHtml}

          <div class="utt-info-row" id="uttModalServiceRow">
            <span class="utt-info-label">Tanlangan Tekshiruv:</span>
            <span class="utt-info-val" id="uttModalServiceTitle" style="color:#0284c7; font-weight:700;">${escapeHtml(activeServiceInfo.service)}</span>
          </div>

          <div id="uttModalPrepBox" style="${activeServiceInfo.preparation ? '' : 'display:none;'} background:#f0fdf4; border-left:3px solid #10b981; padding:6px 10px; border-radius:4px; margin-top:6px;">
            <span class="utt-info-label" style="color:#059669; font-weight:700;">📋 Tayyorgarlik:</span>
            <span class="utt-info-val" id="uttModalPrepText" style="color:#065f46; font-size:12px; font-weight:600;">${escapeHtml(activeServiceInfo.preparation)}</span>
          </div>

          <div id="uttModalContraBox" style="${activeServiceInfo.contraindications ? '' : 'display:none;'} background:#fef2f2; border-left:3px solid #ef4444; padding:6px 10px; border-radius:4px; margin-top:6px;">
            <span class="utt-info-label" style="color:#dc2626; font-weight:700;">🚫 Qarshi ko'rsatmalar:</span>
            <span class="utt-info-val" id="uttModalContraText" style="color:#991b1b; font-size:12px; font-weight:700;">${escapeHtml(activeServiceInfo.contraindications)}</span>
          </div>

          <div class="utt-info-row">
            <span class="utt-info-label">Bemor Toifasi:</span>
            <span class="utt-info-val">
              ${patientData.isStationary ? `
                <span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:12px;">
                  🏥 Bo'limda yotibdi ${patientData.department ? `(${escapeHtml(patientData.department)})` : ''}
                </span>
              ` : `
                <span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:12px;">
                  🏠 Uyidan qatnaydi
                </span>
              `}
            </span>
          </div>

          ${patientData.referringDoctor ? `
            <div class="utt-info-row">
              <span class="utt-info-label">Fayl Shifokori:</span>
              <span class="utt-info-val" style="color:#0f172a; font-weight:bold;">
                👨‍⚕️ ${escapeHtml(patientData.referringDoctor)}
              </span>
            </div>
          ` : ''}

          <div class="utt-info-row" style="margin-top:6px;">
            <span class="utt-info-label">Ketadigan Vaqt:</span>
            <span class="utt-info-val" id="uttModalDurationVal" style="color:#10b981; font-weight:800;">
              ⏱ ${activeServiceInfo.duration} daqiqa (${activeServiceInfo.contrastLabel}) <small id="uttModalCalcMethod" style="color:#64748b; font-size:11px;">[${activeServiceInfo.calcMethod || ''}]</small>
            </span>
          </div>
        </div>

        <!-- Sana va Qurilma Tanlash -->
        <div class="utt-form-group" style="margin-top:10px;">
          <label style="font-weight:700;">📅 Qabul Sanasi:</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="utt-btn-date" id="uttBtnDateToday" style="padding:6px 12px; border-radius:6px; border:1px solid #0284c7; background:#0284c7; color:#fff; cursor:pointer; font-weight:bold;">Bugun</button>
            <button type="button" class="utt-btn-date" id="uttBtnDateTomorrow" style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; color:#334155; cursor:pointer; font-weight:bold;">Ertaga</button>
            <input type="date" id="uttModalDateInput" value="${todayStr}" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; flex-grow:1;">
          </div>
        </div>

        <div class="utt-form-group">
          <label for="uttDeviceSelect">Qurilma / Xonani tanlang:</label>
          <select id="uttDeviceSelect">
            ${dynamicDevices.map(d => `
              <option value="${d.id}" ${d.id === activeServiceInfo.autoDeviceId ? 'selected' : ''}>
                ${escapeHtml(d.room || d.name)} (${escapeHtml(d.name)}) - [Navbatda: ${deviceQueues[d.id] || 0} nafar]
              </option>
            `).join("")}
          </select>
        </div>

        <!-- Vaqt Rejimi va Tekshiruvi -->
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px; margin-bottom:12px;">
          <label style="font-size:12px; font-weight:bold; color:#0f172a; display:block; margin-bottom:8px;">
            ⏰ Qabul Vaqtini Belgilash:
          </label>
          
          <div style="display:flex; gap:12px; margin-bottom:8px; font-size:12px;">
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-weight:600;">
              <input type="radio" name="uttTimeMode" value="auto" checked id="uttModeAuto">
              <span>⚡ Eng yaqin avtomatik vaqt</span>
            </label>
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-weight:600;">
              <input type="radio" name="uttTimeMode" value="custom" id="uttModeCustom">
              <span>🕒 Ixtiyoriy vaqt (Bemor iltimosiga ko'ra)</span>
            </label>
          </div>

          <div id="uttCustomTimeContainer" style="display:none; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11px; font-weight:bold;">Boshlanish vaqti:</span>
              <input type="time" id="uttCustomStartTime" value="08:00" style="padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px;">
              <span style="font-size:11px; color:#64748b;">Oraliq: <strong id="uttCustomCalcSlot" style="color:#0284c7;">08:00 - 08:30</strong></span>
            </div>
          </div>

          <div id="uttModalSlotAlert" style="background:#e0f2fe; color:#0369a1; padding:8px 10px; border-radius:6px; font-size:12px; font-weight:bold;">
            Hisoblanmoqda...
          </div>

          <!-- Voz kechish sababi -->
          <div id="uttDeferReasonBox" style="display:none; margin-top:10px; padding-top:8px; border-top:1px dashed #cbd5e1;">
            <label style="font-weight:bold; color:#b45309; font-size:11px; display:block; margin-bottom:4px;">
              ⚠️ Eng yaqin vaqtdan vos kechish sababi:
            </label>
            <select id="uttDeferReasonSelect" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px; margin-bottom:4px;">
              <option value="Bemorning shaxsiy iltimosi / Vaqti to'g'ri kelmadi">Bemorning shaxsiy iltimosi / Vaqti to'g'ri kelmadi</option>
              <option value="Bemor tayyorgarlik ko'rishga ulgurmaydi (och qorin / tahlillar topshirish)">Bemor tayyorgarlik ko'rishga ulgurmaydi (och qorin / tahlillar topshirish)</option>
              <option value="Uzoqdan / viloyatdan yo'lda kelmoqda">Uzoqdan / viloyatdan yo'lda kelmoqda</option>
              <option value="Boshqa shifokor ko'rigi yoki boshqa muolajasi bor">Boshqa shifokor ko'rigi yoki boshqa muolajasi bor</option>
              <option value="Boshqa sabab">Boshqa sabab (qo'lda yozish)...</option>
            </select>
            <input type="text" id="uttDeferReasonOther" placeholder="Sababni batafsil yozing..." style="display:none; width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px;">
          </div>
        </div>

        <div class="utt-modal-actions">
          <button type="button" class="utt-btn-cancel" id="uttBtnCancel">Bekor qilish</button>
          <button type="button" class="utt-btn-submit" id="uttBtnSend">
            Navbatga Yozish (OK)
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const devSelect = document.getElementById("uttDeviceSelect");
    const dateInput = document.getElementById("uttModalDateInput");
    const btnToday = document.getElementById("uttBtnDateToday");
    const btnTomorrow = document.getElementById("uttBtnDateTomorrow");
    const modeAuto = document.getElementById("uttModeAuto");
    const modeCustom = document.getElementById("uttModeCustom");
    const customTimeContainer = document.getElementById("uttCustomTimeContainer");
    const customStartTimeInput = document.getElementById("uttCustomStartTime");
    const slotAlert = document.getElementById("uttModalSlotAlert");
    const deferReasonBox = document.getElementById("uttDeferReasonBox");
    const deferReasonSelect = document.getElementById("uttDeferReasonSelect");
    const deferReasonOther = document.getElementById("uttDeferReasonOther");
    const btnSend = document.getElementById("uttBtnSend");

    // Xizmat tanlash radio tinglovchilari
    const svcRadios = overlay.querySelectorAll('input[name="uttModalSvcChoice"]');
    svcRadios.forEach(radio => {
      radio.addEventListener("change", function() {
        if (this.value === "all") {
          activeServiceInfo = calculateCombinedProcedureInfo(allAvailableServices);
        } else {
          const idx = parseInt(this.value, 10);
          if (allAvailableServices[idx]) {
            activeServiceInfo = calculateCombinedProcedureInfo([allAvailableServices[idx]]);
          }
        }

        // Modal matnlarini yangilash
        document.getElementById("uttModalServiceTitle").innerText = activeServiceInfo.service;
        document.getElementById("uttModalDurationVal").innerHTML = `⏱ ${activeServiceInfo.duration} daqiqa (${activeServiceInfo.contrastLabel}) <small style="color:#64748b; font-size:11px;">[${activeServiceInfo.calcMethod || ''}]</small>`;

        const prepBox = document.getElementById("uttModalPrepBox");
        const prepText = document.getElementById("uttModalPrepText");
        if (activeServiceInfo.preparation) {
          prepText.innerText = activeServiceInfo.preparation;
          prepBox.style.display = "block";
        } else {
          prepBox.style.display = "none";
        }

        const contraBox = document.getElementById("uttModalContraBox");
        const contraText = document.getElementById("uttModalContraText");
        if (activeServiceInfo.contraindications) {
          contraText.innerText = activeServiceInfo.contraindications;
          contraBox.style.display = "block";
        } else {
          contraBox.style.display = "none";
        }

        // Qurilma turini moslashtirish (agar MSKT/MRT o'zgarsa)
        const matchingDevices = dynamicDevices.filter(d => d.type === activeServiceInfo.type);
        if (matchingDevices.length > 0) {
          devSelect.value = activeServiceInfo.recommendedDevice.id;
        }

        evaluateModalTimeSlot();
      });
    });

    async function evaluateModalTimeSlot() {
      try {
        const devId = devSelect.value;
        selectedDate = dateInput.value || todayStr;
        selectedMode = modeCustom.checked ? "custom" : "auto";
        const currentDur = activeServiceInfo.duration || 30;

        // Firebase-dan tanlangan sana bemorlarini olish
        let dayPatients = [];
        const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${selectedDate}.json`);
        if (res && res.ok) {
          const data = await res.json();
          if (data) {
            dayPatients = Object.keys(data).map(k => ({ id: k, ...data[k] }));
          }
        }

        const devPatients = dayPatients.filter(p => p.doctorId === devId && p.status !== "cancelled");

        if (selectedMode === "auto") {
          customTimeContainer.style.display = "none";
          currentSlotData = calculateNextAvailableSlotFromList(devPatients, currentDur);
          isModalSlotValid = true;

          slotAlert.style.background = "#dcfce7";
          slotAlert.style.color = "#15803d";
          slotAlert.innerHTML = `✅ <strong>Eng yaqin bo'sh vaqt:</strong> ${currentSlotData.slotString} (${selectedDate === todayStr ? 'Bugun' : selectedDate})`;
          btnSend.disabled = false;

          deferReasonBox.style.display = (selectedDate !== todayStr) ? "block" : "none";
        } else {
          customTimeContainer.style.display = "block";
          const startTime = customStartTimeInput.value || "08:00";
          const startMin = timeToMinutes(startTime);
          const endMin = startMin + currentDur;
          const endTime = addMinutesToTime(startTime, currentDur);
          const slotStr = `${startTime} - ${endTime}`;

          document.getElementById("uttCustomCalcSlot").innerText = slotStr;

          // To'qnashuvni tekshirish
          const conflict = checkSlotConflict(devPatients, startMin, endMin);
          if (conflict.hasConflict) {
            isModalSlotValid = false;
            slotAlert.style.background = "#fee2e2";
            slotAlert.style.color = "#b91c1c";
            slotAlert.innerHTML = `❌ <strong>Bu vaqt BAND:</strong> ${escapeHtml(conflict.conflictingPatient.name || conflict.conflictingPatient.ticketId)} (${escapeHtml(conflict.conflictTime)}). Iltimos, boshqa vaqt tanlang!`;
            btnSend.disabled = true;
          } else {
            isModalSlotValid = true;
            currentSlotData = { startTime, endTime, slotString: slotStr };
            slotAlert.style.background = "#dcfce7";
            slotAlert.style.color = "#15803d";
            slotAlert.innerHTML = `✅ <strong>Ushbu vaqt BO'SH!</strong> (${slotStr})`;
            btnSend.disabled = false;
          }

          deferReasonBox.style.display = "block";
        }
      } catch (e) {}
    }

    btnToday.onclick = () => {
      dateInput.value = todayStr;
      btnToday.style.background = "#0284c7";
      btnToday.style.color = "#fff";
      btnTomorrow.style.background = "#fff";
      btnTomorrow.style.color = "#334155";
      evaluateModalTimeSlot();
    };

    btnTomorrow.onclick = () => {
      dateInput.value = tomorrowStr;
      btnTomorrow.style.background = "#0284c7";
      btnTomorrow.style.color = "#fff";
      btnToday.style.background = "#fff";
      btnToday.style.color = "#334155";
      evaluateModalTimeSlot();
    };

    dateInput.onchange = () => {
      btnToday.style.background = dateInput.value === todayStr ? "#0284c7" : "#fff";
      btnToday.style.color = dateInput.value === todayStr ? "#fff" : "#334155";
      btnTomorrow.style.background = dateInput.value === tomorrowStr ? "#0284c7" : "#fff";
      btnTomorrow.style.color = dateInput.value === tomorrowStr ? "#fff" : "#334155";
      evaluateModalTimeSlot();
    };

    devSelect.onchange = evaluateModalTimeSlot;
    modeAuto.onchange = evaluateModalTimeSlot;
    modeCustom.onchange = evaluateModalTimeSlot;
    customStartTimeInput.onchange = evaluateModalTimeSlot;

    deferReasonSelect.onchange = () => {
      deferReasonOther.style.display = deferReasonSelect.value === "Boshqa sabab" ? "block" : "none";
      if (deferReasonSelect.value === "Boshqa sabab") deferReasonOther.focus();
    };

    // Dastlabki hisoblash
    evaluateModalTimeSlot();

    document.getElementById("uttModalClose").onclick = () => overlay.remove();
    document.getElementById("uttBtnCancel").onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    btnSend.onclick = () => {
      try {
        if (!isModalSlotValid || !currentSlotData) {
          alert("⚠️ Tanlangan vaqt band yoki xato! Iltimos, boshqa bo'sh vaqtni tanlang.");
          return;
        }

        const selectedDevId = devSelect.value;
        const selectedDev = dynamicDevices.find(d => d.id === selectedDevId) || dynamicDevices[0] || DEFAULT_DEVICES[0];

        let deferReason = "";
        if (selectedDate !== todayStr || selectedMode === "custom") {
          const rSel = deferReasonSelect.value;
          const rOth = deferReasonOther.value.trim();
          deferReason = (rSel === "Boshqa sabab" ? (rOth || "Boshqa sabab") : rSel);
        }

        const finalPatientPayload = {
          ...patientData,
          service: activeServiceInfo.service,
          serviceCode: activeServiceInfo.serviceCode,
          duration: activeServiceInfo.duration,
          preparation: activeServiceInfo.preparation,
          contraindications: activeServiceInfo.contraindications,
          isContrast: activeServiceInfo.isContrast,
          contrastLabel: activeServiceInfo.contrastLabel,
          servicesList: activeServiceInfo.servicesList,
          servicesCount: activeServiceInfo.servicesCount
        };

        sendPatientToFirebase(finalPatientPayload, selectedDev, currentSlotData, selectedDate, deferReason);
        overlay.remove();
      } catch (e) {}
    };
  } catch (e) {}
}

function calculateNextAvailableSlotFromList(devPatients, duration) {
  return findEarliestFreeSlot(devPatients, duration);
}

// OCHIQ VAQTLAR (GAP) NI TEKSHIRIB ENG YAQUIN BO'SH VAQTNI TOPISH
function findEarliestFreeSlot(devPatients, duration, workDayStart = "08:00") {
  const dur = parseInt(duration, 10) || 30;
  const startWorkMin = timeToMinutes(workDayStart); // 480 (08:00)

  // 1. Faol bemorlarning vaqt oraliqlarini olish
  const activeIntervals = [];
  for (const p of (devPatients || [])) {
    if (p.status === "cancelled") continue;
    const pStartStr = p.scheduledTime || p.time;
    if (!pStartStr) continue;

    const pStart = timeToMinutes(pStartStr);
    const pDur = parseInt(p.duration, 10) || 30;
    const pEnd = p.endTime ? timeToMinutes(p.endTime) : (pStart + pDur);

    if (pEnd > pStart) {
      activeIntervals.push({ start: pStart, end: pEnd, patient: p });
    }
  }

  // Agar navbatda bemor bo'lmasa -> 08:00 dan boshlanadi
  if (activeIntervals.length === 0) {
    const endMin = startWorkMin + dur;
    return {
      startTime: minutesToTime(startWorkMin),
      endTime: minutesToTime(endMin),
      slotString: `${minutesToTime(startWorkMin)} - ${minutesToTime(endMin)}`
    };
  }

  // Boshlanish vaqti bo'yicha saralash
  activeIntervals.sort((a, b) => a.start - b.start);

  // Bir-biriga tutash yoki ustma-ust tushgan band vaqtlarni birlashtirish
  const busyBlocks = [];
  let currentBlock = { start: activeIntervals[0].start, end: activeIntervals[0].end };

  for (let i = 1; i < activeIntervals.length; i++) {
    const next = activeIntervals[i];
    if (next.start <= currentBlock.end) {
      currentBlock.end = Math.max(currentBlock.end, next.end);
    } else {
      busyBlocks.push(currentBlock);
      currentBlock = { start: next.start, end: next.end };
    }
  }
  busyBlocks.push(currentBlock);

  // 2. 08:00 dan birinchi band bemorgacha bo'sh oraliqqa sig'adimi?
  if (busyBlocks[0].start - startWorkMin >= dur) {
    const endMin = startWorkMin + dur;
    return {
      startTime: minutesToTime(startWorkMin),
      endTime: minutesToTime(endMin),
      slotString: `${minutesToTime(startWorkMin)} - ${minutesToTime(endMin)}`
    };
  }

  // 3. Oraliqlarda ochiq qolgan (bo'sh) vaqtlarga sig'adimi?
  for (let i = 0; i < busyBlocks.length - 1; i++) {
    const gapStart = Math.max(startWorkMin, busyBlocks[i].end);
    const gapEnd = busyBlocks[i + 1].start;
    if (gapEnd - gapStart >= dur) {
      const endMin = gapStart + dur;
      return {
        startTime: minutesToTime(gapStart),
        endTime: minutesToTime(endMin),
        slotString: `${minutesToTime(gapStart)} - ${minutesToTime(endMin)}`
      };
    }
  }

  // 4. Agar oraliqlarga sig'masa -> eng oxirgi band oraliqdan keyinga yozish
  const lastBlockEnd = Math.max(startWorkMin, busyBlocks[busyBlocks.length - 1].end);
  const finalEnd = lastBlockEnd + dur;
  return {
    startTime: minutesToTime(lastBlockEnd),
    endTime: minutesToTime(finalEnd),
    slotString: `${minutesToTime(lastBlockEnd)} - ${minutesToTime(finalEnd)}`
  };
}

function minutesToTime(totalMins) {
  const h = String(Math.floor(totalMins / 60) % 24).padStart(2, "0");
  const m = String(totalMins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function checkSlotConflict(devPatients, newStartMin, newEndMin, excludeTicketId = null) {
  for (const p of devPatients) {
    if (p.status === "cancelled") continue;
    if (excludeTicketId && (p.ticketId === excludeTicketId || p.id === excludeTicketId)) continue;

    const pStartStr = p.scheduledTime || p.time;
    if (!pStartStr) continue;
    const pStart = timeToMinutes(pStartStr);
    const pDur = parseInt(p.duration, 10) || 30;
    const pEnd = p.endTime ? timeToMinutes(p.endTime) : (pStart + pDur);

    if (Math.max(newStartMin, pStart) < Math.min(newEndMin, pEnd)) {
      return {
        hasConflict: true,
        conflictingPatient: p,
        conflictTime: `${pStartStr} - ${p.endTime || addMinutesToTime(pStartStr, pDur)}`
      };
    }
  }
  return { hasConflict: false };
}

function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const parts = tStr.trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

// 13. FIREBASE GA YUBORISH
async function sendPatientToFirebase(patientData, device, timeSlot, targetDate = null, deferReason = "") {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const saveDate = targetDate || todayStr;

  const slot = timeSlot || await calculateNextAvailableTimeSlot(device.id, patientData.duration || 30);

  const payload = {
    ticketId: patientData.id,
    name: patientData.name,
    patientType: patientData.patientType || (patientData.isStationary ? "Bo'limda yotibdi" : "Uyidan qatnaydi"),
    department: patientData.department || "",
    referringDoctor: patientData.referringDoctor || "",
    priority: patientData.priority || "",
    phone: "",
    age: "",
    doctorId: device.id,
    doctorName: device.name,
    room: device.room,
    deviceType: device.type,
    service: patientData.service,
    serviceCode: patientData.serviceCode || "",
    duration: patientData.duration || 30,
    preparation: patientData.preparation || "",
    contraindications: patientData.contraindications || "",
    servicesList: patientData.servicesList || [],
    isContrast: patientData.isContrast,
    contrastLabel: patientData.contrastLabel,
    servicesCount: patientData.servicesCount || 1,
    appointmentDate: saveDate,
    scheduledTime: slot.startTime,
    endTime: slot.endTime,
    timeSlot: slot.slotString,
    rescheduleReason: deferReason || "",
    operatorLogin: currentUser ? currentUser.login : "TB1",
    operatorName: currentUser ? currentUser.name : "Operator",
    registeredBy: currentUser ? `${currentUser.login} - ${currentUser.name}` : "TB1 - Turatov Hojiakbar",
    notes: "Kardelen orqali yozildi" + (deferReason ? ` [Sabab: ${deferReason}]` : ""),
    status: "waiting",
    timestamp: Date.now(),
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  try {
    const url = `${FIREBASE_DB_URL}/patients/${saveDate}.json`;
    const response = await safeFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }, 4000);

    if (response && response.ok) {
      showToast(`✅ ${patientData.name} ${device.name}ga soat ${slot.slotString} (${saveDate}) vaqtiga yozildi!`);
      fetchDeviceQueueCounts().catch(() => {});
      calculateTodayOperatorStats().catch(() => {});
      printThermalTicketDirect(payload);
    } else {
      showToast("⚠️ Bemor navbatga olindi.");
      printThermalTicketDirect(payload);
    }
  } catch (err) {
    showToast("⚠️ Xatolik yuz berdi: " + err.message);
  }
}

// 14. XPRINTER TALONI CHOP ETISH
function printThermalTicketDirect(payload) {
  try {
    const oldIframe = document.getElementById("uttPrintIframe");
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "uttPrintIframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Talon - ${payload.ticketId}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            width: 74mm;
            margin: 0 auto;
            padding: 8px 4px;
            color: #000;
          }
          .center { text-align: center; }
          .header { font-size: 15px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
          .sub-header { font-size: 11px; margin-bottom: 6px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .ticket-id { font-size: 32px; font-weight: 900; letter-spacing: 1px; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; line-height: 1.2; }
          .label { color: #333; font-size: 11px; }
          .val { font-weight: bold; text-align: right; max-width: 65%; }
          .slot-box {
            border: 2px solid #000;
            border-radius: 6px;
            padding: 6px;
            margin: 8px 0;
            text-align: center;
          }
          .slot-title { font-size: 10px; font-weight: bold; letter-spacing: 0.5px; }
          .slot-time { font-size: 20px; font-weight: 900; margin-top: 2px; }
          .guide-box {
            border: 1px solid #000;
            border-radius: 4px;
            padding: 4px 6px;
            margin-bottom: 4px;
            font-size: 11px;
            line-height: 1.25;
            text-align: left;
          }
          .guide-svc-title {
            font-weight: 800;
            border-bottom: 1px dashed #000;
            padding-bottom: 2px;
            margin-bottom: 2px;
          }
          .footer { font-size: 10px; text-align: center; margin-top: 8px; }
        </style>
      </head>
      <body>
        <div class="center header">MRT & MSKT MARKAZI</div>
        <div class="center sub-header">Elektron Navbat Taloni</div>
        <div class="divider"></div>

        <div class="center ticket-id">${escapeHtml(payload.ticketId)}</div>

        <div class="row">
          <span class="label">Bemor:</span>
          <span class="val">${escapeHtml(payload.name)}</span>
        </div>

        <div class="row">
          <span class="label">Bemor Toifasi:</span>
          <span class="val" style="font-weight:bold;">
            ${payload.patientType === "Bo'limda yotibdi" ? `🏥 Bo'limda yotibdi ${payload.department ? `(${escapeHtml(payload.department)})` : ''}` : '🏠 Uyidan qatnaydi'}
          </span>
        </div>

        ${payload.referringDoctor ? `
          <div class="row">
            <span class="label">Fayl Shifokori:</span>
            <span class="val">${escapeHtml(payload.referringDoctor)}</span>
          </div>
        ` : ''}

        <div class="row">
          <span class="label">Qurilma / Xona:</span>
          <span class="val">${escapeHtml(payload.room)} (${escapeHtml(payload.doctorName)})</span>
        </div>

        <div class="row">
          <span class="label">Tekshiruv:</span>
          <span class="val">${escapeHtml(payload.service)}</span>
        </div>

        <div class="slot-box">
          <div class="slot-title">BAND QILINGAN QABUL VAQTI:</div>
          <div class="slot-time">${escapeHtml(payload.timeSlot || payload.scheduledTime)}</div>
        </div>

        <div class="row">
          <span class="label">Qabul Sanasi:</span>
          <span class="val" style="color:#000; font-weight:900; font-size:13px;">${escapeHtml(payload.appointmentDate || '')}</span>
        </div>

        <div class="row">
          <span class="label">Ro'yxatga oluvchi:</span>
          <span class="val">${escapeHtml(payload.registeredBy || payload.operatorLogin)}</span>
        </div>

        <div class="row">
          <span class="label">Rasmiylashtirilgan vaqt:</span>
          <span class="val">${escapeHtml(payload.time)}</span>
        </div>

        ${payload.rescheduleReason ? `
          <div class="row" style="font-size:10px; color:#333;">
            <span class="label">Eslatma / Sabab:</span>
            <span class="val" style="font-weight:bold;">${escapeHtml(payload.rescheduleReason)}</span>
          </div>
        ` : ''}

        <!-- TEKSHIRUVLAR UCHUN TAYYORGARLIK VA QARSHI KO'RSATMALAR -->
        ${payload.servicesList && payload.servicesList.length > 0 ? `
          <div class="divider"></div>
          <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 4px 0; text-align: center;">
            TIBBIY KO'RSATMALAR VA ESLATMA
          </div>
          ${payload.servicesList.map((s, idx) => {
            const hasPrep = (s.preparation && s.preparation.trim().length > 0 && s.preparation.trim() !== '—');
            const hasContra = (s.contraindications && s.contraindications.trim().length > 0 && s.contraindications.trim() !== '—');
            if (!hasPrep && !hasContra) return '';

            return `
              <div class="guide-box">
                <div class="guide-svc-title">
                  ${payload.servicesList.length > 1 ? (idx + 1) + '. ' : ''}${escapeHtml(s.fullName || s.name)}
                </div>
                ${hasPrep ? `
                  <div style="margin-top: 2px;">
                    <strong>📋 Tayyorgarlik:</strong> ${escapeHtml(s.preparation)}
                  </div>
                ` : ''}
                ${hasContra ? `
                  <div style="margin-top: 2px;">
                    <strong>🚫 Qarshi ko'rsatmalar:</strong> ${escapeHtml(s.contraindications)}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        ` : (payload.preparation || payload.contraindications ? `
          <div class="divider"></div>
          <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 4px 0; text-align: center;">
            TIBBIY KO'RSATMALAR VA ESLATMA
          </div>
          <div class="guide-box">
            ${payload.preparation && payload.preparation !== '—' ? `<div><strong>📋 Tayyorgarlik:</strong> ${escapeHtml(payload.preparation)}</div>` : ''}
            ${payload.contraindications && payload.contraindications !== '—' ? `<div style="margin-top: 2px;"><strong>🚫 Qarshi ko'rsatmalar:</strong> ${escapeHtml(payload.contraindications)}</div>` : ''}
          </div>
        ` : '')}

        <div class="divider"></div>
        <div class="footer">
          Iltimos, 30-40 minut oldin MRT & MSKT kutish joyida bo'ling va kelganingiz haqida ro'yxatchilardan birini ogohlantiring!<br>
          Salomat bo'ling!
        </div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {}
    }, 350);
  } catch (e) {}
}

// 15. TOAST XABARNOMA
function showToast(message) {
  try {
    const oldToast = document.querySelector(".utt-toast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.className = "utt-toast";
    toast.innerText = message;

    document.body.appendChild(toast);

    setTimeout(() => {
      try {
        toast.style.transition = "opacity 0.5s ease";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 500);
      } catch (e) {}
    }, 3500);
  } catch (e) {}
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
