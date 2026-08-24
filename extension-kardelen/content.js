const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

// Standart Operatorlar
const DEFAULT_OPERATORS = [
  { login: "TB1", name: "Turatov Hojiakbar", password: "15420", role: "Operator" },
  { login: "TB2", name: "Saida'loxon Saidaxmadxonov", password: "15420", role: "Operator" },
  { login: "TB3", name: "Isfandiyor Xaydaraliyev", password: "15420", role: "Operator" }
];

// Standart Boshlang'ich Qurilmalar (2 ta MRT va 1 ta MSKT)
const DEFAULT_DEVICES = [
  { id: "mrt1", name: "MRT 1", room: "1-MRT Xonasi", specialty: "Tomografiya (MRT)", type: "MRT", color: "#38bdf8" },
  { id: "mrt2", name: "MRT 2", room: "2-MRT Xonasi", specialty: "Tomografiya (MRT)", type: "MRT", color: "#818cf8" },
  { id: "mskt1", name: "MSKT 1", room: "1-MSKT Xonasi", specialty: "Tomografiya (MSKT)", type: "MSKT", color: "#34d399" }
];

let dynamicDevices = [...DEFAULT_DEVICES];
let currentUser = null;
let operatorsList = [...DEFAULT_OPERATORS];
let selectedPatient = null;
let servicesCatalog = {};
let deviceQueues = {};
let todayOperatorQueueCount = 0;
let lastPatientInfo = null; // Oxirgi tanlangan bemor ma'lumotlari (yuqori jadvaldan)

// 📌 UMUMIY TIBBIY QOIDALAR, QARSHI KO'RSATMALAR VA SAVOLNOMA SHABLONLARI
const DEFAULT_GLOBAL_GUIDELINES = {
  prepTemplates: {
    fasting_4_6: "Kamida 4-6 soat och qoringa kelish (barcha tekshiruvlar hisobga olingan holda).",
    fasting_6_8: "Kamida 6-8 soat och qoringa kelish (barcha tekshiruvlar hisobga olingan holda).",
    fasting_8_10: "Kamida 8-10 soat och qoringa kelish (barcha tekshiruvlar hisobga olingan holda).",
    bloodTest: "Qonda Kreatinin va Mochevina tahlili natijasi (oxirgi 3 kun ichida).",
    metformin: "Qandli diabet bo'lsa: Metformin (Glyukofaj, Siofor v.b.) dori vositasini 48 soat oldin to'xtatish.",
    metalFree: "Barcha ferromagnit metall buyumlar, soat, telefon, bank kartalari, kamar va taqinchoqlarni yechish.",
    hydration: "Tekshiruvdan so'ng ko'p miqdorda suyuqlik (suv) ichish."
  },
  contraTemplates: {
    mrt: "Kardiostimulyator (EKSM), ferromagnit metall implantlar, koxlear implantlar, klavstrofobiya (yopiq joydan qo'rqish).",
    mskt: "Homiladorlik holati (nisbiy), o'ta yuqori tana vazni (150 kg dan ortiq).",
    contrast: "Yodli/gadoliniyli kontrast moddasiga allergiya, og'ir buyrak yetishmovchiligi (kreatinin yuqori), gipertireoz (bo'qoq)."
  },
  questionTemplates: {
    universal: [
      "Tanangizda kardiostimulyator (EKSM), sun'iy yurak klapani, koxlear implant yoki neyrostimulyator bormi?",
      "Tanangizda metall parchalar, ilonlar, temir plastina, klipsa yoki ferromagnit metall implant bormi?",
      "Homiladorlik holati bormi yoki ko'krak suti bilan emizasizmi?",
      "Dori vositalariga, yod preparatlariga yoki kontrast moddalarga allergik reaksiyangiz bo'lganmi?",
      "Surunkali buyrak, jigar yoki yurak-qon tomir kasalliklari mavjudmi?"
    ],
    contrast: [
      "Buyrak yetishmovchiligi, qonda kreatinin yoki mochevina miqdori oshishi kuzatilganmi?",
      "Qandli diabet kasalligi bo'yicha Metformin (Glyukofaj, Siofor v.b.) dori vositasini qabul qilasizmi?",
      "Qalqonsimon bez kasalliklari (toksik bo'qoq / gipertireoz) mavjudmi?"
    ],
    mrt: [
      "Yopiq joydan qo'rqish (klavstrofobiya), hushdan ketish yoki tutqanoq holatlari bo'ladimi?"
    ],
    mskt: [
      "Oldin nur bilan davolanish (radioterapiya) yoki tez-tez rentgen tekshiruvlaridan o'tganmisiz?"
    ]
  },
  referralRules: {
    maxReferralAgeDays: 10,
    expiredReferralMessage: "Sizni qaytadan yo'naltirish kerak, eski so'rov bilan navbatga qo'yib bo'lmaydi. Yangi so'rovni vrachingiz kiritib bersin.",
    blockedKeywords: [
      "ultratovush", "utt", "uzi", "ehokg", "exo", "ekg", "elektrokardiogramma",
      "endoskopiya", "gastroskopiya", "kolonoskopiya", "fgs", "fgds", "bronxoskopiya",
      "mammografiya", "mammograf",
      "rentgen", "rentgenografiya", "rentgenoskopiya", "rentgen scopi", "rentgenskopi", "flyurografiya",
      "laboratoriya", "qon tahlili", "klinik tahlil", "bioximik", "gistologiya", "sitologiya",
      "fizioterapiya", "massaj", "operatsiya", "muolaja"
    ],
    nonMrtMsktMessage: "Faqat MRT va MSKT tekshiruvlariga navbat beriladi ({service} — MRT/MSKT emas).",
    completedRowMessage: "Ushbu tekshiruv o'tkazilgan (Yashil qator) — Navbatga qo'yilmaydi."
  }
};

let globalGuidelines = JSON.parse(JSON.stringify(DEFAULT_GLOBAL_GUIDELINES));

async function loadGeneralGuidelinesFromFirebase() {
  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/settings/general_guidelines.json`);
    if (res && res.ok) {
      const data = await res.json();
      if (data) {
        globalGuidelines = {
          prepTemplates: Object.assign({}, DEFAULT_GLOBAL_GUIDELINES.prepTemplates, data.prepTemplates || {}),
          contraTemplates: Object.assign({}, DEFAULT_GLOBAL_GUIDELINES.contraTemplates, data.contraTemplates || {}),
          questionTemplates: Object.assign({}, DEFAULT_GLOBAL_GUIDELINES.questionTemplates, data.questionTemplates || {}),
          referralRules: Object.assign({}, DEFAULT_GLOBAL_GUIDELINES.referralRules, data.referralRules || {})
        };
      }
    }
  } catch (e) {
    console.warn("loadGeneralGuidelinesFromFirebase error:", e);
  }
}

// 🗓 Sana va so'rov muddatini tekshirish yordamchilari
function parseDateStringToDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const dotMatch = str.match(/^(\d{2})\.(\d{2})\.(\d{4})/);
  if (dotMatch) {
    const day = parseInt(dotMatch[1], 10);
    const month = parseInt(dotMatch[2], 10) - 1;
    const year = parseInt(dotMatch[3], 10);
    return new Date(year, month, day);
  }
  const dashMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dashMatch) {
    const year = parseInt(dashMatch[1], 10);
    const month = parseInt(dashMatch[2], 10) - 1;
    const day = parseInt(dashMatch[3], 10);
    return new Date(year, month, day);
  }
  return null;
}

function checkReferralDateValidity(referralDateStr, targetQueueDateStr = null) {
  const rules = (globalGuidelines && globalGuidelines.referralRules) ? globalGuidelines.referralRules : DEFAULT_GLOBAL_GUIDELINES.referralRules;
  const maxDays = (rules && rules.maxReferralAgeDays !== undefined) ? parseInt(rules.maxReferralAgeDays, 10) : 10;
  if (maxDays <= 0) return { isValid: true, diffDays: 0, maxDays };

  const refDate = parseDateStringToDate(referralDateStr);
  if (!refDate) return { isValid: true, diffDays: 0, maxDays };

  let queueDate = targetQueueDateStr ? parseDateStringToDate(targetQueueDateStr) : null;
  if (!queueDate) {
    const now = new Date();
    queueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const diffTime = queueDate.getTime() - refDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > maxDays) {
    const customMsg = rules.expiredReferralMessage || "Sizni qaytadan yo'naltirish kerak, eski so'rov bilan navbatga qo'yib bo'lmaydi. Yangi so'rovni vrachingiz kiritib bersin.";
    return {
      isValid: false,
      diffDays,
      maxDays,
      referralDateStr,
      message: `⚠️ So'rov muddati o'tgan (${diffDays} kun oldin: ${referralDateStr} | Me'yor: ${maxDays} kun). ${customMsg}`
    };
  }

  return { isValid: true, diffDays, maxDays };
}

const DEFAULT_WORK_SCHEDULE = {
  days: {
    1: { enabled: true, name: "Dushanba", start: "08:00", end: "19:30" },
    2: { enabled: true, name: "Seshanba", start: "08:00", end: "19:30" },
    3: { enabled: true, name: "Chorshanba", start: "08:00", end: "19:30" },
    4: { enabled: true, name: "Payshanba", start: "08:00", end: "19:30" },
    5: { enabled: true, name: "Juma", start: "08:00", end: "19:30" },
    6: { enabled: true, name: "Shanba", start: "08:00", end: "14:00" },
    0: { enabled: false, name: "Yakshanba", start: "08:00", end: "14:00" }
  }
};
let currentWorkSchedule = JSON.parse(JSON.stringify(DEFAULT_WORK_SCHEDULE));
let calendarExceptions = {};

function getDaySchedule(schedule, dayOfWeek) {
  const cfg = schedule || currentWorkSchedule || DEFAULT_WORK_SCHEDULE;
  if (cfg && cfg.days && cfg.days[dayOfWeek]) {
    return cfg.days[dayOfWeek];
  }
  const isEnabled = cfg && cfg.workDays ? cfg.workDays.includes(dayOfWeek) : (dayOfWeek !== 0);
  const start = cfg && cfg.workStart ? cfg.workStart : "08:00";
  const end = (dayOfWeek === 6) ? "14:00" : (cfg && cfg.workEnd ? cfg.workEnd : "19:30");
  const names = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  return { enabled: isEnabled, name: names[dayOfWeek], start, end };
}

function getDayEffectiveSchedule(targetDate, schedule = null, exceptions = null) {
  const excMap = exceptions || calendarExceptions || {};
  const cfg = schedule || currentWorkSchedule || DEFAULT_WORK_SCHEDULE;
  const dateObj = new Date(targetDate + "T00:00:00");
  const dayOfWeek = dateObj.getDay();
  const baseDayCfg = getDaySchedule(cfg, dayOfWeek);

  if (excMap && excMap[targetDate]) {
    const ex = excMap[targetDate];
    if (!ex.isWorking) {
      return {
        enabled: false,
        name: baseDayCfg.name,
        title: ex.title || "Bayram / Dam olish kuni",
        isException: true,
        isHoliday: true,
        start: baseDayCfg.start,
        end: baseDayCfg.end
      };
    } else {
      return {
        enabled: true,
        name: baseDayCfg.name,
        title: ex.title || "Maxsus ish kuni",
        isException: true,
        isSpecialHours: true,
        start: ex.workStart || "08:00",
        end: ex.workEnd || (dayOfWeek === 6 ? "14:00" : "19:30")
      };
    }
  }

  return Object.assign({ title: baseDayCfg.name, isException: false }, baseDayCfg);
}

function isKardelenEnvironment() {
  try {
    const loc = window.location;
    const hostname = (loc.hostname || '').toLowerCase();
    const href = (loc.href || '').toLowerCase();

    // 1. Tizimning o'zining ichki app sahifalari (app1-registratura, app2-vrach, app3-android-tv) bo'lsa kengaytma ISHLAMASIN!
    if (href.includes("app1-registratura") || href.includes("app2-vrach") || href.includes("app3-android-tv")) {
      return false;
    }

    // 2. Karmed / Kardelen rasmiy IP manzillari
    if (hostname === "192.168.150.111" || hostname === "213.230.91.59") {
      return true;
    }

    // 3. Karmed / Kardelen domen nomlari
    if (hostname.includes("karmed") || hostname.includes("kardelen")) {
      return true;
    }

    // 4. Test qilish uchun maxsus parametr (?kardelen=1 yoki ?karmed=1)
    if (loc.search && (loc.search.includes("kardelen=1") || loc.search.includes("karmed=1"))) {
      return true;
    }

    return false;
  } catch (e) {
    return false;
  }
}

// Faqat asosiy oynada (window === window.top) va faqat Karmed hostlarida ishga tushirish
if (window === window.top && isKardelenEnvironment()) {
  initExtension();
}

async function initExtension() {
  try {
    await checkUserAuth();
    loadOperatorsFromFirebase().catch(() => {});
    await loadServicesCatalog();
    await loadGeneralGuidelinesFromFirebase();
    await loadDevicesFromFirebase();
    await loadWorkScheduleFromFirebase();
    await loadCalendarExceptionsFromFirebase();

    createFloatingBar();
    fetchDeviceQueueCounts().catch(() => {});

    // Saytning DOM'iga hech narsa kiritmaymiz, faqat passiv click hodisasini tinglaymiz
    document.addEventListener("click", handlePassiveRowClick, true);
    setupPeriodicSync();

    if (!currentUser) {
      setTimeout(() => {
        try { openLoginModal(); } catch (e) {}
      }, 1000);
    }
  } catch (err) {
    console.warn("RONS Extension init safely caught:", err);
  }
}

let lastObservedPatientId = "";
let lastObservedServicesHash = "";

function syncPatientAndServicesFromDom() {
  try {
    // Agar modal ochiq bo'lsa yoki foydalanuvchi alohida tekshiruv tanlagan bo'lsa, xalaqit bermaymiz
    if (document.querySelector(".utt-modal-overlay") || (selectedPatient && selectedPatient.userSelectedSpecific)) return;

    const activePatient = findActivePatientFromTopTable();
    if (!activePatient) return;

    const currentServices = findAllCurrentServicesPassively();
    const servicesHash = currentServices.map(s => s.code || s.name).join(",");

    if (activePatient.id !== lastObservedPatientId || servicesHash !== lastObservedServicesHash) {
      lastObservedPatientId = activePatient.id;
      lastObservedServicesHash = servicesHash;
      lastPatientInfo = activePatient;
      applyServicesToPatient(activePatient, currentServices);
    }
  } catch (e) {}
}

function setupPeriodicSync() {
  setInterval(syncPatientAndServicesFromDom, 800);
}

async function loadWorkScheduleFromFirebase() {
  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/settings/schedule.json`);
    if (res && res.ok) {
      const data = await res.json();
      if (data) {
        currentWorkSchedule = data;
      }
    }
  } catch (e) {
    console.warn("loadWorkScheduleFromFirebase error:", e);
  }
}

async function loadCalendarExceptionsFromFirebase() {
  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/settings/calendar_exceptions.json`);
    if (res && res.ok) {
      const data = await res.json();
      calendarExceptions = data || {};
    }
  } catch (e) {
    console.warn("loadCalendarExceptionsFromFirebase error:", e);
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

    const currentLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
    const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[currentLang]) 
      ? I18N_TRANSLATIONS.ext[currentLang] 
      : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext) ? I18N_TRANSLATIONS.ext['uz'] : {});

    if (!currentUser) {
      bar.innerHTML = `
        <span class="utt-floating-brand">${dict.mrtMsktBrand || '⚡ MRT & MSKT:'}</span>
        <button class="utt-floating-login-btn" id="uttBtnOpenLogin">
          🔒 ${dict.loginRequired || 'Tizimga Kirish'} (TB1 / TB2 / TB3)
        </button>
        <div style="display:inline-flex; align-items:center; gap:4px; background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:2px 6px; margin-left:6px;">
          <span style="font-size:12px;">🌐</span>
          <select id="uttFloatingLangSelector" style="border:none; outline:none; font-weight:700; font-size:11.5px; background:transparent; cursor:pointer; color:#0f172a;">
            <option value="uz" ${currentLang === 'uz' ? 'selected' : ''}>🇺🇿 UZ</option>
            <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>🇷🇺 RU</option>
            <option value="en" ${currentLang === 'en' ? 'selected' : ''}>🇬🇧 EN</option>
            <option value="kk" ${currentLang === 'kk' ? 'selected' : ''}>🇰🇿 KK</option>
            <option value="tg" ${currentLang === 'tg' ? 'selected' : ''}>🇹🇯 TG</option>
            <option value="tr" ${currentLang === 'tr' ? 'selected' : ''}>🇹🇷 TR</option>
          </select>
        </div>
      `;
      const btn = document.getElementById("uttBtnOpenLogin");
      if (btn) btn.onclick = () => openLoginModal();
      const langSel = document.getElementById("uttFloatingLangSelector");
      if (langSel) {
        langSel.onchange = (e) => {
          const newLang = e.target.value;
          if (typeof setI18nLanguage === 'function') setI18nLanguage(newLang);
          updateFloatingBar();
          const d = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[newLang]) ? I18N_TRANSLATIONS.ext[newLang] : null;
          showToast(d ? d.langSwitched.replace('{lang}', newLang.toUpperCase()) : ("🌐 " + newLang.toUpperCase()));
        };
      }
      return;
    }

    const nameParts = currentUser.name.split(" ");
    const shortName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1][0]}.` : currentUser.name;

    let patientHtml = dict.clickPatientRow || "Jadvaldan bemor qatorini bosing";
    if (selectedPatient) {
      const sName = (typeof formatServiceNameWithOriginal === 'function') 
        ? formatServiceNameWithOriginal(selectedPatient.service, currentLang) 
        : selectedPatient.service;
      patientHtml = `<strong>${escapeHtml(selectedPatient.name)}</strong> (${escapeHtml(sName)}) ${selectedPatient.isContrast ? '💉' : ''}`;
    }

    bar.innerHTML = `
      <button class="utt-floating-user-btn" id="uttBtnOpenProfile" title="${dict.userProfile || "Ro'yxatchi profili"}">
        👤 <strong>${currentUser.login}</strong>: ${shortName} ⚙️
      </button>
      <button class="utt-floating-queue-btn" id="uttBtnOpenQueueList" title="${dict.queueListTitle || "Navbatlar ro'yxati"}">
        ${dict.queueListBtn || "📋 Navbatlar Ro'yxati"}
      </button>
      <div style="display:inline-flex; align-items:center; gap:4px; background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:2px 6px;">
        <span style="font-size:12px;">🌐</span>
        <select id="uttFloatingLangSelector" style="border:none; outline:none; font-weight:700; font-size:11.5px; background:transparent; cursor:pointer; color:#0f172a;">
          <option value="uz" ${currentLang === 'uz' ? 'selected' : ''}>🇺🇿 UZ</option>
          <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>🇷🇺 RU</option>
          <option value="en" ${currentLang === 'en' ? 'selected' : ''}>🇬🇧 EN</option>
          <option value="kk" ${currentLang === 'kk' ? 'selected' : ''}>🇰🇿 KK</option>
          <option value="tg" ${currentLang === 'tg' ? 'selected' : ''}>🇹🇯 TG</option>
          <option value="tr" ${currentLang === 'tr' ? 'selected' : ''}>🇹🇷 TR</option>
        </select>
      </div>
      <span class="utt-floating-brand">${dict.mrtMsktBrand || '⚡ MRT & MSKT:'}</span>
      <span class="utt-floating-patient" id="uttFloatingPatientText">${patientHtml}</span>
      <button class="utt-floating-btn" id="uttFloatingSendBtn" ${selectedPatient ? '' : 'disabled'}>${dict.bookQueueBtn || '➕ Navbatga Yozish'}</button>
    `;

    const profBtn = document.getElementById("uttBtnOpenProfile");
    if (profBtn) profBtn.onclick = () => openProfileModal();

    const queueListBtn = document.getElementById("uttBtnOpenQueueList");
    if (queueListBtn) queueListBtn.onclick = () => openQueueListModal();

    const langSel = document.getElementById("uttFloatingLangSelector");
    if (langSel) {
      langSel.onchange = (e) => {
        const newLang = e.target.value;
        if (typeof setI18nLanguage === 'function') setI18nLanguage(newLang);
        updateFloatingBar();
        // If queue list drawer is open, re-render it
        if (document.getElementById("uttQueueModalBox")) {
          openQueueListModal();
        }
        const d = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[newLang]) ? I18N_TRANSLATIONS.ext[newLang] : null;
        showToast(d ? d.langSwitched.replace('{lang}', newLang.toUpperCase()) : ("🌐 " + newLang.toUpperCase()));
      };
    }

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
    if (!rowText) return;

    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) return;

    // A) AGAR FOYDALANUVCHI PASTKI JADVALDAGI ANIQ BIR TEKSHIRUVGA BOSGAN BO'LSA:
    const hasTransId = cells.some(c => /^\d{6,8}$/.test(c.innerText.trim()));
    const hasTransDate = cells.some(c => /\d{2}\.\d{2}\.\d{4}/.test(c.innerText.trim()));
    const hasServiceCode = cells.some(c => /^R\d{2,5}$/i.test(c.innerText.trim()));

    if (hasTransId && (hasTransDate || hasServiceCode)) {
      handleSpecificBottomServiceClick(row, cells);
      return;
    }

    // B) AGAR YUQORI JADVALDAGI BEMOR QATORI BO'LSA:
    const patient = extractPatientFromRow(row);
    if (patient) {
      if (patient.isGreen) {
        selectedPatient = null;
        const txt = document.getElementById("uttFloatingPatientText");
        const btn = document.getElementById("uttFloatingSendBtn");
        if (txt && btn) {
          txt.innerHTML = `<span style="color:#22c55e; font-weight:700;">🟢 Bemor tekshiruvdan o'tib bo'lgan (Yashil qator) — Navbatga qo'yilmaydi</span>`;
          btn.disabled = true;
        }
        return;
      }

      lastPatientInfo = patient;

      // Pastki jadvaldagi xizmatlarni o'qish va qo'llash
      const servicesList = findAllCurrentServicesPassively();
      applyServicesToPatient(patient, servicesList);

      // Kardelen pastki jadvalni AJAX orqali kechroq yuklaganda avtomatik yangilash:
      [150, 300, 600, 1000].forEach(delay => {
        setTimeout(() => {
          if (lastPatientInfo && lastPatientInfo.id === patient.id && (!selectedPatient || !selectedPatient.userSelectedSpecific)) {
            const freshServices = findAllCurrentServicesPassively();
            if (freshServices.length > 0) {
              applyServicesToPatient(lastPatientInfo, freshServices);
            }
          }
        }, delay);
      });
      return;
    }

  } catch (err) {
    console.warn("Passive click handler caught:", err);
  }
}

// 2.1 PASTKI JADVALDAN ANIQ BOSILGAN TEKSHIRUVNI QABUL QILISH
function handleSpecificBottomServiceClick(row, cells) {
  try {
    // 1. QAT'IY TEKSHIRUV: Agar bosilgan qator YASHIL bo'lsa (o'tkazilgan / yakunlangan):
    if (isRowFinishedOrGreen(row, cells)) {
      selectedPatient = null;
      const txt = document.getElementById("uttFloatingPatientText");
      const btn = document.getElementById("uttFloatingSendBtn");
      if (txt && btn) {
        txt.innerHTML = `<span style="color:#22c55e; font-weight:800; font-size:13px;">🟢 Ushbu tekshiruv o'tkazilgan (Yashil qator) — Navbatga qo'yilmaydi</span>`;
        btn.disabled = true;
      }
      return;
    }

    let candidateCode = cells.find(c => /^R\d{2,5}$/i.test(c.innerText.trim()))?.innerText.trim() || "";
    let candidateName = "";
    let serviceDoctor = "";
    let serviceDate = "";

    for (const cell of cells) {
      const c = cell.innerText.trim();
      if (/^\d+$/.test(c)) continue;
      if (/\d{2}\.\d{2}\.\d{4}/.test(c)) {
        serviceDate = c;
        continue;
      }
      if (/^R\d{2,5}$/i.test(c)) continue;
      if (c === "-" || c === "") continue;
      if (c.includes("To'lanmagan") || c.includes("Tolanmagan") || c.includes("To'langan")) continue;

      if (c.includes("Dr.") || c.includes("Shifokor") || c.includes("ova") || c.includes("yev") || c.includes("yeva") || c.includes("qizi") || c.includes("o'g'li") || c.includes("ovich") || c.includes("ovna")) {
        serviceDoctor = c;
        continue;
      }

      if (c.length >= 4 && !candidateName) {
        candidateName = c;
      }
    }

    // 2. TEKSHIRUV: MRT YOKI MSKT BO'LMASA -> QAT'IYAN RAD ETISH
    if (!isMrtOrMsktService(candidateCode, candidateName, row.innerText)) {
      selectedPatient = null;
      const txt = document.getElementById("uttFloatingPatientText");
      const btn = document.getElementById("uttFloatingSendBtn");
      const rules = (globalGuidelines && globalGuidelines.referralRules) ? globalGuidelines.referralRules : DEFAULT_GLOBAL_GUIDELINES.referralRules;
      const tmpl = rules.nonMrtMsktMessage || "Faqat MRT va MSKT tekshiruvlariga navbat beriladi ({service} — MRT/MSKT emas).";
      const msg = tmpl.replace("{service}", candidateName || candidateCode || 'Tekshiruv');
      if (txt && btn) {
        txt.innerHTML = `<span style="color:#ef4444; font-weight:800; font-size:13px;">⚠️ ${escapeHtml(msg)}</span>`;
        btn.disabled = true;
      }
      return;
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
      type: isMSKT ? "MSKT" : "MRT",
      transactionDate: serviceDate
    };

    // Bemor ma'lumotini aniq topish (shifokor va sana bo'yicha yuqori jadvaldan moslash)
    let pInfo = findActivePatientFromTopTable(serviceDoctor, serviceDate) || lastPatientInfo || selectedPatient;
    if (!pInfo) {
      pInfo = {
        id: "—",
        name: "Tanlangan bemor",
        referringDoctor: serviceDoctor,
        priority: "",
        department: "",
        patientType: "Uyidan qatnaydi",
        isStationary: false,
        rowDate: serviceDate
      };
    }

    if (serviceDoctor && !pInfo.referringDoctor) {
      pInfo.referringDoctor = serviceDoctor;
    }

    lastPatientInfo = pInfo;

    // 3. SO'ROV MUDDATINI TEKSHIRISH
    const refDateStr = pInfo.rowDate || pInfo.referralDate || serviceDate;
    const validity = checkReferralDateValidity(refDateStr);
    if (!validity.isValid) {
      selectedPatient = null;
      const txt = document.getElementById("uttFloatingPatientText");
      const btn = document.getElementById("uttFloatingSendBtn");
      if (txt && btn) {
        txt.innerHTML = `<strong>${escapeHtml(pInfo.id)} - ${escapeHtml(pInfo.name)}</strong>: <span style="color:#ef4444; font-weight:800; font-size:12.5px;">${escapeHtml(validity.message)}</span>`;
        btn.disabled = true;
      }
      return;
    }

    const combo = calculateCombinedProcedureInfo([specificService]);
    const allServices = findAllCurrentServicesPassively();

    selectedPatient = {
      ...pInfo,
      referralDate: refDateStr,
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

  const txt = document.getElementById("uttFloatingPatientText");
  const btn = document.getElementById("uttFloatingSendBtn");
  const rules = (globalGuidelines && globalGuidelines.referralRules) ? globalGuidelines.referralRules : DEFAULT_GLOBAL_GUIDELINES.referralRules;

  // 1. SO'ROV SANASI VA MUDDATINI TEKSHIRISH (10 KUNLIK VA SOZLANGAN MUDDAT):
  const refDateStr = patientInfo.rowDate || patientInfo.referralDate || (servicesList && servicesList.foundTransactionDate);
  const validity = checkReferralDateValidity(refDateStr);

  if (!validity.isValid) {
    selectedPatient = null;
    if (txt && btn) {
      txt.innerHTML = `<strong>${escapeHtml(patientInfo.id)} - ${escapeHtml(patientInfo.name)}</strong>: <span style="color:#ef4444; font-weight:800; font-size:12.5px;">${escapeHtml(validity.message)}</span>`;
      btn.disabled = true;
    }
    return;
  }

  if (!servicesList || servicesList.length === 0) {
    selectedPatient = null;
    if (txt && btn) {
      if (servicesList && servicesList.nonMrtMsktServicesCount > 0) {
        const names = servicesList.nonMrtMsktNames.slice(0, 2).join(", ");
        const tmpl = rules.nonMrtMsktMessage || "Faqat MRT va MSKT tekshiruvlariga navbat beriladi ({service} — MRT/MSKT emas).";
        const msg = tmpl.replace("{service}", names);
        txt.innerHTML = `<strong>${escapeHtml(patientInfo.id)} - ${escapeHtml(patientInfo.name)}</strong>: <span style="color:#ef4444; font-weight:800; font-size:12.5px;">⚠️ ${escapeHtml(msg)}</span>`;
      } else if (servicesList && servicesList.totalServiceRows > 0 && servicesList.totalServiceRows === servicesList.greenServiceRows) {
        const compMsg = rules.completedRowMessage || "Ushbu tekshiruv o'tkazilgan (Yashil qator) — Navbatga qo'yilmaydi.";
        txt.innerHTML = `<strong>${escapeHtml(patientInfo.id)} - ${escapeHtml(patientInfo.name)}</strong>: <span style="color:#22c55e; font-weight:800; font-size:13px;">🟢 ${escapeHtml(compMsg)}</span>`;
      } else {
        txt.innerHTML = `<strong>${escapeHtml(patientInfo.id)} - ${escapeHtml(patientInfo.name)}</strong>: <span style="color:#ef4444; font-weight:700;">⚠️ Registrator ro'yxatida bunday tekshiruv topilmadi</span>`;
      }
      btn.disabled = true;
    }
    return;
  }

  const combo = calculateCombinedProcedureInfo(servicesList);

  selectedPatient = {
    ...patientInfo,
    referralDate: refDateStr,
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

async function updateFloatingBarPatientDisplay() {
  const txt = document.getElementById("uttFloatingPatientText");
  const btn = document.getElementById("uttFloatingSendBtn");
  if (!txt || !btn || !selectedPatient) return;

  const currentLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
  const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[currentLang]) 
    ? I18N_TRANSLATIONS.ext[currentLang] 
    : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext) ? I18N_TRANSLATIONS.ext['uz'] : {});

  const tDict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket && I18N_TRANSLATIONS.ticket[currentLang]) 
    ? I18N_TRANSLATIONS.ticket[currentLang] 
    : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket) ? I18N_TRANSLATIONS.ticket['uz'] : {});

  // 1. ALLAQACHON NAVBATGA QO'YILGANLIGINI TEKSHIRISH (NAMUNA RAQAMI BO'YICHA):
  let existing = null;
  if (selectedPatient.sampleNumber) {
    existing = await checkExistingQueueBySample(selectedPatient.sampleNumber, selectedPatient.id);
  }

  if (existing) {
    selectedPatient.isAlreadyQueued = true;
    selectedPatient.existingQueueData = existing;

    const sampleBadge = selectedPatient.sampleNumber ? ` <span style="background:#e0e7ff; color:#3730a3; padding:1px 5px; border-radius:4px; font-size:10.5px; font-weight:700;">Namuna: №${escapeHtml(selectedPatient.sampleNumber)}</span>` : "";
    const pinflBadge = selectedPatient.pinfl ? ` <span style="background:#f1f5f9; color:#475569; padding:1px 5px; border-radius:4px; font-size:10.5px; font-weight:600;">JSHSHIR: ${escapeHtml(selectedPatient.pinfl)}</span>` : "";

    txt.innerHTML = `<strong>${selectedPatient.id} - ${escapeHtml(selectedPatient.name)}</strong>${sampleBadge}${pinflBadge}: <span style="color:#d97706; font-weight:800;">⚠️ Allaqachon navbatga qo'yilgan!</span> <span style="color:#0284c7; font-weight:700;">(${escapeHtml(existing.doctorName || existing.room)} | ⏱ ${escapeHtml(existing.timeSlot || existing.scheduledTime || existing.time)} | Talon №${escapeHtml(existing.ticketId)})</span>`;
    
    btn.disabled = false;
    btn.style.background = "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)";
    btn.style.boxShadow = "0 2px 8px rgba(217, 119, 6, 0.35)";
    btn.innerHTML = `🖨️ Talonni Chop Etish (№${escapeHtml(existing.ticketId)})`;
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      printThermalTicketDirect(existing, currentLang);
      showToast(`🖨️ Navbat taloni chop etilmoqda (Talon №${existing.ticketId}, Vaqt: ${existing.timeSlot || existing.scheduledTime})...`, "success");
    };
    return;
  }

  // Agar yangi bemor bo'lsa (navbatda yo'q):
  selectedPatient.isAlreadyQueued = false;
  selectedPatient.existingQueueData = null;

  btn.style.background = "";
  btn.style.boxShadow = "";
  btn.onclick = (e) => {
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

  const multiBadge = (selectedPatient.servicesCount > 1) 
    ? ` <span style="background:#0284c7; color:#fff; padding:1px 6px; border-radius:10px; font-size:10px;">${selectedPatient.servicesCount} ${dict.patientsCount || 'ta tekshiruv'}</span>` 
    : (selectedPatient.userSelectedSpecific ? ` <span style="background:#10b981; color:#fff; padding:1px 6px; border-radius:10px; font-size:10px;">${dict.singleService || 'Tanlangan tekshiruv'}</span>` : "");

  const typeBadge = selectedPatient.isStationary
    ? ` <span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${tDict.stationary || "🏥 Bo'limda"}: ${escapeHtml(selectedPatient.department || '')}</span>`
    : ` <span style="background:#e0f2fe; color:#0284c7; padding:2px 6px; border-radius:4px; font-size:11px; font-weight:bold;">${tDict.ambulatory || "🏠 Uyidan qatnaydi"}</span>`;

  const sampleBadge = selectedPatient.sampleNumber ? ` <span style="background:#e0e7ff; color:#3730a3; padding:1px 5px; border-radius:4px; font-size:10.5px; font-weight:700;">№${escapeHtml(selectedPatient.sampleNumber)}</span>` : "";

  const sName = (typeof formatServiceNameWithOriginal === 'function') 
    ? formatServiceNameWithOriginal(selectedPatient.service, currentLang) 
    : selectedPatient.service;

  const roomName = (typeof formatRoomWithOriginal === 'function') 
    ? formatRoomWithOriginal(selectedPatient.autoDeviceRoom, selectedPatient.autoDeviceName, currentLang) 
    : (selectedPatient.autoDeviceName || "");

  txt.innerHTML = `<strong>${selectedPatient.id} - ${escapeHtml(selectedPatient.name)}</strong>${sampleBadge}${typeBadge}: <span style="color:#38bdf8; font-weight:700;">${escapeHtml(sName)}</span>${multiBadge} <span style="color:#f59e0b;">(${escapeHtml(roomName)} | ⏱ ${selectedPatient.duration} ${dict.durationMin || 'daq'} ${selectedPatient.isContrast ? '💉' : ''})</span>`;
  btn.disabled = false;
  btn.innerText = dict.bookQueueBtn || '➕ Navbatga Yozish';
}

// 2.2 BEMOR QATORIDAN ANIQ MA'LUMOTLARNI AJRATIB OLISH
function extractPatientFromRow(row) {
  try {
    if (!row) return null;
    const cells = Array.from(row.querySelectorAll("td"));
    if (cells.length < 3) return null;

    // Agar pastki tranzaksiya jadvali bo'lsa (R kodli yoki 7 xonali trans ID):
    const hasServiceCode = cells.some(c => /^R\d{2,5}$/i.test(c.innerText.trim()));
    const hasTransId = cells.some(c => /^\d{7,8}$/.test(c.innerText.trim()));
    if (hasServiceCode && hasTransId && !cells.some(c => /^\d{14}$/.test(c.innerText.trim()))) return null;

    // 1. Sarlavha ustunlaridan (th / td) aniq xarita tuzish:
    let colMap = {
      doc: -1, id: -1, surname: -1, name: -1, middle: -1,
      priority: -1, dept: -1, regDate: -1, sample: -1, dob: -1, pinfl: -1
    };

    try {
      const table = row.closest("table");
      if (table) {
        const headerRow = table.querySelector("tr");
        if (headerRow) {
          const ths = Array.from(headerRow.querySelectorAll("th, td")).map(th => th.innerText.trim().toLowerCase());
          ths.forEach((h, idx) => {
            if (h.includes("shifokor") || h.includes("fayl")) colMap.doc = idx;
            else if (h.includes("bemor id") || (h.includes("id") && !h.includes("fayl") && !h.includes("namuna"))) colMap.id = idx;
            else if (h.includes("familiya")) colMap.surname = idx;
            else if (h.includes("ota") || h.includes("sharif")) colMap.middle = idx;
            else if (h.includes("ism")) colMap.name = idx;
            else if (h.includes("ustuvorlik") || h.includes("ustun")) colMap.priority = idx;
            else if (h.includes("bo'lim") || h.includes("bolim")) colMap.dept = idx;
            else if (h.includes("namuna")) colMap.sample = idx;
            else if (h.includes("tug'ilgan") || h.includes("tugilgan") || h.includes("t_kuni") || h.includes("t.kuni")) colMap.dob = idx;
            else if (h.includes("pinfl") || h.includes("pnfl") || h.includes("jshshir") || h.includes("inps")) colMap.pinfl = idx;
            else if (h.includes("sana") || h.includes("royxatga")) colMap.regDate = idx;
          });
        }
      }
    } catch (e) {}

    // Bemor ID sini aniqlash
    let idIdx = colMap.id !== -1 ? colMap.id : -1;
    let patientId = "";
    if (idIdx !== -1 && cells[idIdx] && /^\d{1,8}$/.test(cells[idIdx].innerText.trim())) {
      patientId = cells[idIdx].innerText.trim();
    } else {
      for (let i = 0; i < cells.length; i++) {
        const txt = cells[i].innerText.trim();
        if (/^\d{1,8}$/.test(txt) && txt !== "2024" && txt !== "2025" && txt !== "2026" && !/^\d{14}$/.test(txt)) {
          idIdx = i;
          patientId = txt;
          break;
        }
      }
    }

    if (idIdx === -1 || !patientId) return null;

    let referringDoctor = colMap.doc !== -1 && cells[colMap.doc] ? cells[colMap.doc].innerText.trim() : (cells[idIdx - 1] ? cells[idIdx - 1].innerText.trim() : "");
    let surname = colMap.surname !== -1 && cells[colMap.surname] ? cells[colMap.surname].innerText.trim() : (cells[idIdx + 1] ? cells[idIdx + 1].innerText.trim() : "");
    let firstName = colMap.name !== -1 && cells[colMap.name] ? cells[colMap.name].innerText.trim() : (cells[idIdx + 2] ? cells[idIdx + 2].innerText.trim() : "");
    let rawMiddle = colMap.middle !== -1 && cells[colMap.middle] ? cells[colMap.middle].innerText.trim() : (cells[idIdx + 3] ? cells[idIdx + 3].innerText.trim() : "");
    
    // Otasining ismi tekshiruvi: Agar XXX bo'lsa yoki bo'sh bo'lsa -> bo'sh qoldirish
    let middleName = "";
    if (rawMiddle) {
      const cleanMid = rawMiddle.toUpperCase().replace(/\s+/g, "");
      if (cleanMid !== "XXX" && cleanMid !== "X" && cleanMid !== "XX" && cleanMid !== "-" && cleanMid !== "NO" && cleanMid !== "YOQ") {
        middleName = rawMiddle.trim();
      }
    }

    let priority = colMap.priority !== -1 && cells[colMap.priority] ? cells[colMap.priority].innerText.trim() : (cells[idIdx + 4] ? cells[idIdx + 4].innerText.trim() : "");
    let department = colMap.dept !== -1 && cells[colMap.dept] ? cells[colMap.dept].innerText.trim() : (cells[idIdx + 5] ? cells[idIdx + 5].innerText.trim() : "");
    let rowDate = colMap.regDate !== -1 && cells[colMap.regDate] ? cells[colMap.regDate].innerText.trim() : (cells[idIdx + 6] ? cells[idIdx + 6].innerText.trim() : "");
    
    // Namuna raqami (7 xonali son):
    let sampleNumber = colMap.sample !== -1 && cells[colMap.sample] ? cells[colMap.sample].innerText.trim() : "";
    if (!sampleNumber || !/^\d{5,10}$/.test(sampleNumber)) {
      for (const c of cells) {
        const txt = c.innerText.trim();
        if (/^\d{6,8}$/.test(txt) && txt !== patientId && txt !== "2024" && txt !== "2025" && txt !== "2026") {
          sampleNumber = txt;
          break;
        }
      }
    }

    // Tug'ilgan sanasi (DD.MM.YYYY):
    let birthDate = colMap.dob !== -1 && cells[colMap.dob] ? cells[colMap.dob].innerText.trim() : "";
    if (!birthDate || !/^\d{2}\.\d{2}\.\d{4}$/.test(birthDate)) {
      for (const c of cells) {
        const txt = c.innerText.trim();
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(txt)) {
          birthDate = txt;
          break;
        }
      }
    }

    // PINFL / JSHSHIR (14 xonali son):
    let pinfl = colMap.pinfl !== -1 && cells[colMap.pinfl] ? cells[colMap.pinfl].innerText.trim() : "";
    if (!pinfl || !/^\d{14}$/.test(pinfl)) {
      for (const c of cells) {
        const txt = c.innerText.trim();
        if (/^\d{14}$/.test(txt)) {
          pinfl = txt;
          break;
        }
      }
    }

    if (!surname || /^\d+$/.test(surname) || surname.includes(":") || surname.toLowerCase().includes("tranzaksiya") || surname.toLowerCase().includes("kod")) {
      return null;
    }

    // FISH ni to'liq va to'g'ri shakllantirish:
    const fullName = [surname, firstName, middleName].filter(Boolean).join(" ").trim();

    const isStationary = priority.toLowerCase().includes("statsionar") || (department && department.toLowerCase().includes("statsionar"));
    const isGreen = isRowFinishedOrGreen(row, cells);

    return {
      row: row,
      id: patientId,
      name: fullName,
      surname: surname,
      firstName: firstName,
      middleName: middleName,
      sampleNumber: sampleNumber,
      birthDate: birthDate,
      pinfl: pinfl,
      referringDoctor: referringDoctor,
      priority: priority,
      department: isStationary ? department : "",
      patientType: isStationary ? "Bo'limda yotibdi" : "Uyidan qatnaydi",
      isStationary: isStationary,
      isGreen: isGreen,
      rowDate: rowDate
    };
  } catch (e) {
    return null;
  }
}

// 2.2.1 AYNI NAMUNA RAQAMI BILAN OLDINDAN NAVBATGA QO'YILGANLIGINI TEKSHIRISH
async function checkExistingQueueBySample(sampleNumber, patientId) {
  if (!sampleNumber && !patientId) return null;

  try {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 1. Bugungi kundan qidirish:
    const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`);
    if (res && res.ok) {
      const data = await res.json();
      if (data) {
        for (const [key, p] of Object.entries(data)) {
          if (p.status !== "cancelled") {
            if (sampleNumber && p.sampleNumber && String(p.sampleNumber).trim() === String(sampleNumber).trim()) {
              return { ...p, dbKey: key, appointmentDate: p.appointmentDate || todayStr };
            }
          }
        }
      }
    }

    // 2. Ertangi kundan qidirish:
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    const resTom = await safeFetch(`${FIREBASE_DB_URL}/patients/${tomorrowStr}.json`);
    if (resTom && resTom.ok) {
      const dataTom = await resTom.json();
      if (dataTom) {
        for (const [key, p] of Object.entries(dataTom)) {
          if (p.status !== "cancelled") {
            if (sampleNumber && p.sampleNumber && String(p.sampleNumber).trim() === String(sampleNumber).trim()) {
              return { ...p, dbKey: key, appointmentDate: p.appointmentDate || tomorrowStr };
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("checkExistingQueueBySample error:", e);
  }
  return null;
}

// 2.3 PASTKI JADVALDAN SHIFOKOR VA SANANI O'QISH
function parseBottomTableDoctorAndDate() {
  const allRows = Array.from(document.querySelectorAll("tr"));
  let bottomDoctor = "";
  let bottomDate = "";

  for (const r of allRows) {
    const cells = Array.from(r.querySelectorAll("td"));
    if (cells.length >= 4) {
      const hasTransId = cells.some(c => /^\d{6,8}$/.test(c.innerText.trim()));
      const dateCell = cells.find(c => /\d{2}\.\d{2}\.\d{4}/.test(c.innerText.trim()));
      const codeCell = cells.find(c => /^R\d{2,5}$/i.test(c.innerText.trim()));

      if (hasTransId && (dateCell || codeCell)) {
        if (dateCell) bottomDate = dateCell.innerText.trim().substring(0, 16);

        for (const c of cells) {
          const txt = c.innerText.trim();
          if (txt.length >= 4 && !/^\d+$/.test(txt) && !txt.includes(":") && !txt.includes("To'lan") && !txt.includes("Tolan") && txt !== "-") {
            if (txt.includes("Dr.") || txt.includes("Shifokor") || txt.includes("ova") || txt.includes("yev") || txt.includes("yeva") || txt.includes("qizi") || txt.includes("o'g'li") || txt.includes("ovich") || txt.includes("ovna")) {
              bottomDoctor = txt.replace(/^Dr\.\s*/i, '').trim();
              break;
            }
          }
        }
        if (bottomDoctor || bottomDate) break;
      }
    }
  }
  return { bottomDoctor, bottomDate };
}

// 2.4 BARCHA YUQORI JADVALDAGI BEMORLAR RO'YXATINI OLISH
function getAllTopTablePatients() {
  const allRows = Array.from(document.querySelectorAll("tr"));
  const patients = [];
  for (const r of allRows) {
    const p = extractPatientFromRow(r);
    if (p) {
      patients.push(p);
    }
  }
  return patients;
}

// 2.5 YUQORI JADVALDAN HAQIQIY TANLANGAN VA MOS BEMORNI TOPISH
function findActivePatientFromTopTable(specificDoctor = "", specificDate = "") {
  try {
    const patients = getAllTopTablePatients();
    if (patients.length === 0) return null;

    const { bottomDoctor, bottomDate } = parseBottomTableDoctorAndDate();
    const docToMatch = (specificDoctor || bottomDoctor || "").trim();
    const dateToMatch = (specificDate || bottomDate || "").trim();

    // 1. Pastki jadval shifokori VA sanasi bo'yicha aniq moslash:
    if (docToMatch || dateToMatch) {
      if (docToMatch && dateToMatch) {
        const docSurname = docToMatch.replace(/^Dr\.\s*/i, '').split(" ")[0].toLowerCase();
        const datePrefix = dateToMatch.substring(0, 10);
        const matchBoth = patients.find(p => {
          if (p.isGreen) return false;
          const pDoc = p.referringDoctor.toLowerCase();
          const pDate = p.rowDate;
          return pDoc.includes(docSurname) && pDate.includes(datePrefix);
        });
        if (matchBoth) return matchBoth;
      }

      if (docToMatch) {
        const docSurname = docToMatch.replace(/^Dr\.\s*/i, '').split(" ")[0].toLowerCase();
        const matchDoc = patients.find(p => !p.isGreen && p.referringDoctor.toLowerCase().includes(docSurname));
        if (matchDoc) return matchDoc;
      }

      if (dateToMatch) {
        const fullDateMatch = patients.find(p => !p.isGreen && p.rowDate.includes(dateToMatch.substring(0, 16)));
        if (fullDateMatch) return fullDateMatch;
        const datePrefix = dateToMatch.substring(0, 10);
        const dayMatch = patients.find(p => !p.isGreen && p.rowDate.includes(datePrefix));
        if (dayMatch) return dayMatch;
      }
    }

    // 2. Foydalanuvchi oxirgi bosgan bemor (agar ro'yxatda mavjud bo'lsa):
    if (lastPatientInfo && lastPatientInfo.id && lastPatientInfo.id !== "—") {
      const matchLast = patients.find(p => p.id === lastPatientInfo.id && !p.isGreen);
      if (matchLast) return matchLast;
    }

    // 3. Birinchi yashil bo'lmagan bemor:
    const nonGreen = patients.filter(p => !p.isGreen);
    return nonGreen.length > 0 ? nonGreen[0] : patients[0];
  } catch (e) {
    console.warn("findActivePatientFromTopTable error:", e);
  }
  return null;
}

// 3. YASHIL (TUGAGAN/QABUL QILINGAN/O'TKAZILGAN) QATORNI ANIQ TEKSHIRISH
function isRowFinishedOrGreen(row, cells) {
  try {
    if (!row) return false;
    const rowClass = (row.className || "").toLowerCase();
    if (rowClass.includes("green") || rowClass.includes("completed") || rowClass.includes("finished") || rowClass.includes("passed")) {
      return true;
    }

    const elementsToCheck = [row, ...(cells || Array.from(row.querySelectorAll("td")))];
    for (const el of elementsToCheck) {
      if (!el) continue;
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
  const str = s.toLowerCase();
  return str.includes("green") || str.includes("lime") || 
         str.includes("#00ff") || str.includes("#99ff") || str.includes("#c8e") || 
         str.includes("#a5d") || str.includes("#81c") || str.includes("#b9f") || 
         str.includes("#69f") || str.includes("#22c55e") || str.includes("#10b981") || 
         str.includes("#4ade80") || str.includes("#00e") || str.includes("#00c") || 
         str.includes("#00d") || str.includes("#0e0") || str.includes("#0f0") || 
         str.includes("#2e") || str.includes("#3f") || str.includes("#34d399") || 
         str.includes("#86efac") || str.includes("#bbf7d0");
}

function isGreenColorRgb(colorStr) {
  if (!colorStr || colorStr === "rgba(0, 0, 0, 0)" || colorStr === "transparent") return false;
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    // Green dominates:
    if (g >= 120 && g > r + 15 && g > b + 15) return true;
    if (g >= 150 && (g - r > 10 || g - b > 10)) return true;
    if (g >= 180 && r <= 200 && b <= 200) return true;
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

// 3.1 FAQAT MRT VA MSKT TEKSHIRUVI EKANLIGINI TEKSHIRISH (BOSHQALARINI RAD ETISH)
function isMrtOrMsktService(code, name, rawText = "") {
  const fullText = `${code || ''} ${name || ''} ${rawText || ''}`.toLowerCase();

  const rules = (globalGuidelines && globalGuidelines.referralRules) ? globalGuidelines.referralRules : DEFAULT_GLOBAL_GUIDELINES.referralRules;
  const nonMrtKeywords = (rules && rules.blockedKeywords && rules.blockedKeywords.length > 0)
    ? rules.blockedKeywords
    : DEFAULT_GLOBAL_GUIDELINES.referralRules.blockedKeywords;

  for (const kw of nonMrtKeywords) {
    const cleanKw = String(kw).trim().toLowerCase();
    if (cleanKw && fullText.includes(cleanKw)) {
      // Istisno: agar matnda aniq MRT yoki MSKT bo'lmasa -> MRT/MSKT emas:
      if (!fullText.includes("mrt") && !fullText.includes("mskt") && !fullText.includes("msct") && !fullText.includes("tomografiya(msct)")) {
        return false;
      }
    }
  }

  // 2. Agar registratura katalogida (services_catalog) mavjud bo'lsa:
  const catalogEntry = getServiceCatalogEntry(code, name);
  if (catalogEntry) {
    if (catalogEntry.type === "MRT" || catalogEntry.type === "MSKT") {
      return true;
    }
    return false;
  }

  // 3. Kod yoki nom bo'yicha MRT/MSKT tekshiruvi:
  const c = (code || "").toUpperCase();
  const num = parseInt(c.replace(/\D/g, ""), 10);
  if (!isNaN(num) && ((num >= 134 && num <= 155) || (num >= 157 && num <= 200))) {
    return true;
  }

  if (fullText.includes("mrt") || fullText.includes("mri") || fullText.includes("mskt") || fullText.includes("msct") || fullText.includes("tomografiya(msct)")) {
    return true;
  }

  return false;
}

// 4. PASTKI JADVALDAN FAQAT MRT VA MSKT TEKSHIRUVLARINI ANIQ O'QISH
function findAllCurrentServicesPassively() {
  const foundServices = [];
  let totalServiceRows = 0;
  let greenServiceRows = 0;
  let nonMrtMsktServicesCount = 0;
  const nonMrtMsktNames = [];
  let foundTransactionDate = "";

  try {
    const allRows = document.querySelectorAll("tr");
    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const text = (row.innerText || "").trim();
      if (!text || isGroupHeaderOrNavigation(text)) continue;

      if (text.includes("Navbat raqami") || text.includes("Tranzaksiya") || text.includes("Xizmatlar Nomi")) {
        continue;
      }

      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 4) continue;

      // Faqat pastki tranzaksiya jadvalidagi qatorlar (7 xonali Navbat raqami VA Tranzaksiya sanasi bo'lishi shart!)
      const hasTransId = cells.some(c => /^\d{6,8}$/.test(c.innerText.trim()));
      const transDateCell = cells.find(c => /\d{2}\.\d{2}\.\d{4}/.test(c.innerText.trim()));

      if (!hasTransId || !transDateCell) {
        continue;
      }

      const candidateTransDate = transDateCell.innerText.trim();
      if (candidateTransDate && !foundTransactionDate) {
        foundTransactionDate = candidateTransDate;
      }

      totalServiceRows++;

      // AGAR PASTKI QATOR YASHIL BO'LSA (O'TKAZILGAN) -> QAT'IYAN RAD ETAMIZ:
      if (isRowFinishedOrGreen(row, cells)) {
        greenServiceRows++;
        continue; // Faqat o'tkazilmagan (oq yoki boshqa rangdagi) tekshiruvlarni olamiz!
      }

      // 1. Kodni aniqlash (R184, R143, R157 va h.k.)
      let candidateCode = cells.find(c => /^R\d{2,5}$/i.test(c.innerText.trim()))?.innerText.trim() || "";
      
      // 2. Xizmat nomini aniqlash (Raqamlar, sanalar va shifokor nomlari chiqarib tashlanadi)
      let candidateName = "";
      for (const c of cells) {
        const cText = c.innerText.trim();
        if (/^\d+$/.test(cText)) continue; // Har qanday sof raqamlarni (ID, 3998, 0, 1 va h.k.) QAT'IYAN RAD ETISH
        if (/\d{2}\.\d{2}\.\d{4}/.test(cText)) continue;
        if (/^R\d{2,5}$/i.test(cText)) continue;
        if (cText === "-" || cText === "") continue;
        if (cText.includes("Atabekov") || cText.includes("Azimov") || cText.includes("Dr.") || cText.includes("To'lanmagan") || cText.includes("Tolanmagan") || cText.includes("To'langan")) continue;

        if (cText.length >= 4) {
          candidateName = cText;
          break;
        }
      }

      // 3. AGAR BU TEKSHIRUV MRT YOKI MSKT BO'LMASA -> QAT'IYAN RAD ETAMIZ!
      if (!isMrtOrMsktService(candidateCode, candidateName, text)) {
        nonMrtMsktServicesCount++;
        if (candidateName) nonMrtMsktNames.push(candidateName);
        continue; // Faqat MRT va MSKT tekshiruvlarini qabul qilamiz!
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
            type: isMSKT ? "MSKT" : "MRT",
            transactionDate: candidateTransDate
          });
        }
      }
    }
  } catch (e) {
    console.warn("findAllCurrentServicesPassively error:", e);
  }

  // Statistikani biriktirish
  foundServices.totalServiceRows = totalServiceRows;
  foundServices.greenServiceRows = greenServiceRows;
  foundServices.nonMrtMsktServicesCount = nonMrtMsktServicesCount;
  foundServices.nonMrtMsktNames = nonMrtMsktNames;
  foundServices.foundTransactionDate = foundTransactionDate;
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

// ❓ TIBBIY SAVOLLARNI BARCHA TEKSHIRUVLAR UCHUN UMUMIY VA MAXSUS QISMLARNI AQLLI BIRLASHTIRISH
function consolidateQuestionsForServices(servicesList, examType = "MSKT", isContrast = false, fallbackQuestions = "") {
  const gg = (globalGuidelines && globalGuidelines.questionTemplates) ? globalGuidelines.questionTemplates : DEFAULT_GLOBAL_GUIDELINES.questionTemplates;
  const collected = [];
  const seen = new Set();

  function addQuestion(q, prefix = "") {
    if (!q) return;
    const clean = q.replace(/^\d+[\.\)\-]\s*/, '').trim();
    if (clean.length < 5) return;
    const norm = clean.toLowerCase().replace(/[^a-z0-9а-яёўқғҳ]/gi, '');
    if (!seen.has(norm)) {
      seen.add(norm);
      collected.push(prefix ? `${prefix}: ${clean}` : clean);
    }
  }

  // 1. UMUMIY BARCHA TEKSHIRUVLAR UCHUN SAVOLLAR
  (gg.universal || []).forEach(q => addQuestion(q));

  // 2. KONTRASTLI TEKSHIRUVLAR UCHUN SAVOLLAR
  if (isContrast) {
    (gg.contrast || []).forEach(q => addQuestion(q));
  }

  // 3. MRT / MSKT GA XOS UMUMIY SAVOLLAR
  if (examType === "MRT") {
    (gg.mrt || []).forEach(q => addQuestion(q));
  } else {
    (gg.mskt || []).forEach(q => addQuestion(q));
  }

  // 4. HAR BIR TEKSHIRUVNING O'ZIGA XOS ALOHIDA SAVOLLARI
  if (servicesList && servicesList.length > 0) {
    servicesList.forEach(s => {
      const sName = s.fullName || s.name || "";
      const qText = s.specialQuestions || s.questions || "";
      if (qText) {
        const lines = String(qText).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        lines.forEach(l => {
          const norm = l.replace(/^\d+[\.\)\-]\s*/, '').trim().toLowerCase().replace(/[^a-z0-9а-яёўқғҳ]/gi, '');
          if (!seen.has(norm)) {
            addQuestion(l, servicesList.length > 1 ? `[${sName}]` : "");
          }
        });
      }
    });
  } else if (fallbackQuestions) {
    const lines = String(fallbackQuestions).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    lines.forEach(l => addQuestion(l));
  }

  return collected;
}

// 6. BIR NECHTA TEKSHIRUV BO'LGANDA VAQTNI HISOBLASH QOIDASI (MSKT: MAX, MRT: SUM)
// 6. BIR NECHTA TEKSHIRUV BO'LGANDA TAYYORGARLIK VA QARSHI KO'RSATMALARNI AQLI BIRLASHTIRISH VA TAKRORIYLIKNI YO'QOTISH
function consolidatePreparationAndContraindications(servicesList, fallbackPrep = "", fallbackContra = "") {
  const list = (servicesList && servicesList.length > 0) ? servicesList : [{
    name: "Tekshiruv",
    fullName: "Tekshiruv",
    preparation: fallbackPrep,
    contraindications: fallbackContra
  }];

  const prepTpl = (globalGuidelines && globalGuidelines.prepTemplates) ? globalGuidelines.prepTemplates : DEFAULT_GLOBAL_GUIDELINES.prepTemplates;

  if (list.length === 1) {
    const s = list[0];
    return {
      isMultiple: false,
      singlePrep: s.preparation || fallbackPrep || "",
      singleContra: s.contraindications || fallbackContra || "",
      generalPrepList: [],
      specificServicesPrep: [],
      consolidatedContraList: []
    };
  }

  let maxFastingHours = 0;
  let hasFasting = false;
  let hasBloodTest = false;
  let hasMetformin = false;
  let hasPostHydration = false;
  let hasMetalWarning = false;

  const rawContras = [];
  const specificServicesPrep = [];

  list.forEach((s, idx) => {
    const pText = s.preparation || "";
    const cText = s.contraindications || "";

    if (cText) {
      const parts = cText.split(/[,;\n\r\.]+/);
      parts.forEach(p => {
        const clean = p.trim().replace(/^[•\-\*]\s*/, '').trim();
        if (clean.length > 2 && clean !== '—') {
          rawContras.push(clean);
        }
      });
    }

    if (!pText || pText.trim() === '' || pText.trim() === '—') {
      specificServicesPrep.push({
        index: idx + 1,
        name: s.fullName || s.name || `Tekshiruv ${idx + 1}`,
        specificPoints: []
      });
      return;
    }

    // Gaplar bo'yicha ajratish
    const sentences = pText.split(/(?:\.(?!\d)|\;|\r?\n)+/).map(st => st.trim().replace(/^[•\-\*]\s*/, '').trim()).filter(st => st.length > 0);
    const procSpecificPoints = [];

    sentences.forEach(st => {
      const lower = st.toLowerCase();

      // 1. Och qorin tekshiruvi (Och qolish soatlarini solishtirib eng kattasini olish)
      if (lower.includes("och qorin") || lower.includes("och holda") || lower.includes("ovqatlanmasdan") || lower.includes("och qoringa")) {
        hasFasting = true;
        const matchRange = lower.match(/(\d+)\s*[-–—to]\s*(\d+)\s*soat/);
        const matchSingle = lower.match(/(\d+)\s*soat/);
        if (matchRange) {
          const upperHour = parseInt(matchRange[2], 10);
          if (upperHour > maxFastingHours) maxFastingHours = upperHour;
        } else if (matchSingle) {
          const singleHour = parseInt(matchSingle[1], 10);
          if (singleHour > maxFastingHours) maxFastingHours = singleHour;
        } else {
          if (maxFastingHours < 4) maxFastingHours = 4;
        }
        return; // Umumiy qismga ko'chirildi
      }

      // 2. Qon tahlillari (Kreatinin va Mochevina)
      if (lower.includes("kreatinin") || lower.includes("mochevina") || lower.includes("mochivina") || (lower.includes("qon") && lower.includes("tahlil"))) {
        hasBloodTest = true;
        return; // Umumiy qismga ko'chirildi
      }

      // 3. Metformin / Diabet
      if (lower.includes("metformin") || lower.includes("glyukofaj") || lower.includes("siofor") || (lower.includes("qandli diabet") && lower.includes("to'xtatiladi"))) {
        hasMetformin = true;
        return; // Umumiy qismga ko'chirildi
      }

      // 4. Tekshiruvdan so'ng ko'p suyuqlik ichish
      if (lower.includes("ko'p suyuqlik") || lower.includes("kop suyuqlik") || (lower.includes("suyuqlik") && lower.includes("so'ng"))) {
        hasPostHydration = true;
        return; // Umumiy qismga ko'chirildi
      }

      // 5. Metall / ferromagnit buyumlarni yechish
      if ((lower.includes("metall") || lower.includes("ferromagnit") || lower.includes("telefon") || lower.includes("taqinchoq")) && (lower.includes("yechish") || lower.includes("mumkin emas") || lower.includes("olib tashlash"))) {
        hasMetalWarning = true;
        return; // Umumiy qismga ko'chirildi
      }

      // Maxsus tekshiruv ko'rsatmasi (Klizma, No-shpa, 1 litr suv ichish va h.k.)
      let cleanPt = st;
      if (!/[.\?!:;]$/.test(cleanPt)) cleanPt += '.';
      procSpecificPoints.push(cleanPt);
    });

    specificServicesPrep.push({
      index: idx + 1,
      name: s.fullName || s.name || `Tekshiruv ${idx + 1}`,
      specificPoints: procSpecificPoints
    });
  });

  // Umumiy tayyorgarlik ro'yxati (Sozlanadigan shablonlardan)
  const generalPrepList = [];
  if (hasFasting) {
    if (maxFastingHours >= 8) {
      generalPrepList.push(prepTpl.fasting_8_10 || "Kamida 8-10 soat och qoringa kelish (barcha tekshiruvlar hisobga olingan holda).");
    } else if (maxFastingHours >= 6) {
      generalPrepList.push(prepTpl.fasting_6_8 || "Kamida 6-8 soat och qoringa kelish (barcha tekshiruvlar hisobga olingan holda).");
    } else {
      generalPrepList.push(prepTpl.fasting_4_6 || "Kamida 4-6 soat och qoringa kelish (barcha tekshiruvlar hisobga olingan holda).");
    }
  }

  if (hasBloodTest) {
    generalPrepList.push(prepTpl.bloodTest || "Qonda Kreatinin va Mochevina tahlili natijasi (oxirgi 3 kun ichida).");
  }

  if (hasMetformin) {
    generalPrepList.push(prepTpl.metformin || "Qandli diabet bo'lsa: Metformin (Glyukofaj, Siofor v.b.) dori vositasini 48 soat oldin to'xtatish.");
  }

  if (hasMetalWarning) {
    generalPrepList.push(prepTpl.metalFree || "Barcha ferromagnit metall buyumlar, soat, telefon, bank kartalari, kamar va taqinchoqlarni yechish.");
  }

  if (hasPostHydration) {
    generalPrepList.push(prepTpl.hydration || "Tekshiruvdan so'ng ko'p miqdorda suyuqlik (suv) ichish.");
  }

  // Qarshi ko'rsatmalarni takrorlarsiz saralash
  const consolidatedContraList = [];
  const seenContras = new Set();
  rawContras.forEach(c => {
    const norm = c.toLowerCase().replace(/[^a-z0-9а-яёўқғҳ]/gi, '');
    if (!seenContras.has(norm)) {
      seenContras.add(norm);
      let formatted = c.charAt(0).toUpperCase() + c.slice(1);
      if (!/[.\?!:;]$/.test(formatted)) formatted += '.';
      consolidatedContraList.push(formatted);
    }
  });

  return {
    isMultiple: true,
    generalPrepList,
    specificServicesPrep,
    consolidatedContraList
  };
}

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

  // 3. Tayyorgarlik va Qarshi ko'rsatmalarni aqlli birlashtirish
  const consolidated = consolidatePreparationAndContraindications(servicesList);
  let combinedPrepString = "";
  let combinedContraString = "";

  if (consolidated.isMultiple) {
    const parts = [];
    if (consolidated.generalPrepList.length > 0) {
      parts.push(consolidated.generalPrepList.join(" "));
    }
    const specParts = consolidated.specificServicesPrep
      .filter(s => s.specificPoints.length > 0)
      .map(s => `${s.name}: ${s.specificPoints.join(" ")}`);
    if (specParts.length > 0) {
      parts.push(specParts.join(" | "));
    }
    combinedPrepString = parts.join(" ");
    combinedContraString = consolidated.consolidatedContraList.join(" ");
  } else {
    combinedPrepString = consolidated.singlePrep || "";
    combinedContraString = consolidated.singleContra || "";
  }

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
    preparation: combinedPrepString,
    contraindications: combinedContraString,
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

let laborantsCatalog = {};

// 7. TEKSHIRUVLAR VA LABORANTLAR KATALOGINI FIREBASE-DAN YUKLASH
async function loadServicesCatalog() {
  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/services_catalog.json`);
    if (res && res.ok) {
      const data = await res.json();
      if (data) servicesCatalog = data;
    }
  } catch (e) {}
}

async function loadLaborantsCatalog() {
  try {
    const res = await safeFetch(`${FIREBASE_DB_URL}/laborants.json`);
    if (res && res.ok) {
      const data = await res.json();
      if (data) laborantsCatalog = data;
    }
  } catch (e) {}
}

function isLaborantOnDutyExtension(lab, roomId, targetDateStr) {
  const s = lab.schedule;
  if (!s) return false;

  // 1. Oylik aniq sana istisnosi (dateOverrides)
  if (s.dateOverrides && s.dateOverrides[targetDateStr]) {
    const ov = s.dateOverrides[targetDateStr];
    if (ov.enabled === false) return false;
    const targetRoom = ov.roomId || s.roomId;
    return targetRoom === roomId;
  }

  const dObj = new Date(targetDateStr + "T12:00:00");
  const dayOfWeek = dObj.getDay();

  // 2. Kunbay alohida soatlar (dailyHours)
  if (s.dailyHours && s.dailyHours[dayOfWeek]) {
    const dh = s.dailyHours[dayOfWeek];
    if (dh.enabled === false) return false;
    return s.roomId === roomId;
  }

  // 3. Standart kunlar massivi (days)
  if (Array.isArray(s.days) && s.days.includes(dayOfWeek)) {
    return s.roomId === roomId;
  }

  return false;
}

function getResolvedDurationForExtension(deviceId, serviceCode, targetDateStr) {
  const checkDate = targetDateStr || getTodayDateStr();

  const activeLaborants = Object.values(laborantsCatalog || {}).filter(l => 
    isLaborantOnDutyExtension(l, deviceId, checkDate)
  );

  const matchingService = Object.values(servicesCatalog || {}).find(s => (s.code || '').toUpperCase() === (serviceCode || '').toUpperCase());
  const standardDuration = matchingService ? (matchingService.duration || 30) : 30;

  if (activeLaborants.length > 0) {
    const durations = activeLaborants.map(lab => {
      if (lab.customDurations && matchingService && lab.customDurations[matchingService.code]) {
        return parseInt(lab.customDurations[matchingService.code], 10);
      }
      return standardDuration;
    });
    return Math.max(...durations);
  }

  return standardDuration;
}

// 8. TIME-SLOT HISOBLASH (ISh SOATLARI VA AVTOMATIK KUNLAR BO'YICHA)
async function calculateNextAvailableTimeSlot(deviceId, durationMinutes, targetDate = null, serviceCode = null) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const startDate = targetDate || todayStr;

  await loadWorkScheduleFromFirebase();
  await loadLaborantsCatalog();

  // 30 kun ichida eng yaqin bo'sh slotni qidirish
  for (let offset = 0; offset < 30; offset++) {
    const checkObj = new Date(startDate + "T12:00:00");
    checkObj.setDate(checkObj.getDate() + offset);
    const cy = checkObj.getFullYear();
    const cm = String(checkObj.getMonth() + 1).padStart(2, '0');
    const cd = String(checkObj.getDate()).padStart(2, '0');
    const checkDateStr = `${cy}-${cm}-${cd}`;

    const resolvedDuration = serviceCode
      ? getResolvedDurationForExtension(deviceId, serviceCode, checkDateStr)
      : (parseInt(durationMinutes, 10) || 30);

    try {
      const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${checkDateStr}.json`);
      let devPatients = [];
      if (res && res.ok) {
        const data = await res.json();
        if (data) {
          Object.values(data).forEach(p => {
            if (p.doctorId === deviceId && p.status !== "cancelled") {
              devPatients.push(p);
            }
          });
        }
      }

      const slot = findEarliestFreeSlot(devPatients, resolvedDuration, checkDateStr, currentWorkSchedule);
      if (!slot.error && !slot.isFull) {
        return {
          ...slot,
          date: checkDateStr,
          isToday: checkDateStr === todayStr,
          isFutureDay: checkDateStr !== startDate,
          resolvedDuration: resolvedDuration
        };
      }
    } catch (err) {
      // xatolik bo'lsa davom etish
    }
  }

  return { error: "Keyingi 30 kun ichida bo'sh navbat topilmadi!", isFull: true };
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

    const currentLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
    const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[currentLang]) 
      ? I18N_TRANSLATIONS.ext[currentLang] 
      : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext) ? I18N_TRANSLATIONS.ext['uz'] : {});

    const overlay = document.createElement("div");
    overlay.id = "uttLoginModal";
    overlay.className = "utt-modal-overlay";

    overlay.innerHTML = `
      <div class="utt-modal-box">
        <div class="utt-modal-header">
          <h3>🔒 ${dict.loginModalTitle || "Tizimga Kirish (Tibbiy Ro'yxatchi)"}</h3>
          ${currentUser ? '<button class="utt-modal-close" id="uttLoginClose">&times;</button>' : ''}
        </div>

        <form id="uttLoginForm" onsubmit="return false;">
          <div class="utt-form-group">
            <label for="uttLoginSelect">${dict.userProfile || "Tibbiy Ro'yxatchi"}:</label>
            <select id="uttLoginSelect" required>
              ${operatorsList.map(op => `
                <option value="${op.login}">${op.login} — ${op.name}</option>
              `).join("")}
            </select>
          </div>

          <div class="utt-form-group">
            <label for="uttPasswordInput">${dict.passwordLabel || 'Parol:'}</label>
            <input type="password" id="uttPasswordInput" placeholder="${dict.passwordLabel || 'Parol'} (standart: 15420)" required autofocus>
          </div>

          <div id="uttLoginError" style="color:#ef4444; font-size:13px; font-weight:700; margin-bottom:12px; display:none;">
            ${dict.loginError || "❌ Parol noto'g'ri! Iltimos, qayta urinib ko'ring."}
          </div>

          <div class="utt-modal-actions" style="margin-top:20px;">
            ${currentUser ? `<button type="button" class="utt-btn-cancel" id="uttLoginCancel">${dict.cancelBtn || 'Bekor qilish'}</button>` : ''}
            <button type="button" class="utt-btn-submit" id="uttBtnDoLogin" style="width:100%;">
              ${dict.enterBtn || 'Tizimga Kirish'} 🚀
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
          const welcomeMsg = dict.loginSuccess ? dict.loginSuccess.replace('{name}', foundOp.name) : `👋 Xush kelibsiz, ${foundOp.name} (${foundOp.login})!`;
          showToast(welcomeMsg);
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

    const currentLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
    const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[currentLang]) 
      ? I18N_TRANSLATIONS.ext[currentLang] 
      : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext) ? I18N_TRANSLATIONS.ext['uz'] : {});

    const overlay = document.createElement("div");
    overlay.id = "uttProfileModal";
    overlay.className = "utt-modal-overlay";

    overlay.innerHTML = `
      <div class="utt-modal-box">
        <div class="utt-modal-header">
          <h3>👤 ${dict.profileTitle || "Ro'yxatchi Profili"}</h3>
          <button class="utt-modal-close" id="uttProfileClose">&times;</button>
        </div>

        <div class="utt-profile-card">
          <div class="utt-profile-avatar">${currentUser.login}</div>
          <div>
            <div class="utt-profile-name">${escapeHtml(currentUser.name)}</div>
            <div class="utt-profile-sub">${dict.loginLabel || 'Login:'} <strong>${currentUser.login}</strong> | ${dict.userProfile || 'Lavozim'}: ${currentUser.role || 'Ro\'yxatchi'}</div>
          </div>
        </div>

        <div class="utt-stat-pill">
          <span>${dict.todayBtn || 'Bugun'} ${dict.bookQueueBtn || 'navbatga yozgan bemorlaringiz'}:</span>
          <strong id="uttStatCount">${todayOperatorQueueCount} ${dict.patientsCount || 'nafar'}</strong>
        </div>

        <div style="border-top:1px solid #e2e8f0; padding-top:14px; margin-top:10px;">
          <h4 style="font-size:14px; margin-bottom:10px; color:#0f172a;">🔑 ${dict.newPasswordLabel || "Parolni O'zgartirish"}</h4>
          
          <div class="utt-form-group">
            <label for="uttOldPwd">${dict.passwordLabel || 'Eski parol:'}</label>
            <input type="password" id="uttOldPwd" placeholder="Hozirgi parol (15420)">
          </div>

          <div class="utt-form-group">
            <label for="uttNewPwd">${dict.newPasswordLabel || 'Yangi parol:'}</label>
            <input type="password" id="uttNewPwd" placeholder="${dict.newPasswordLabel || 'Yangi parol'}">
          </div>

          <div class="utt-form-group">
            <label for="uttNewPwd2">${dict.newPasswordLabel || 'Yangi parolni takrorlang:'}</label>
            <input type="password" id="uttNewPwd2" placeholder="${dict.newPasswordLabel || 'Yangi parolni tasdiqlang'}">
          </div>

          <div id="uttPwdMsg" style="font-size:12px; font-weight:700; margin-bottom:10px; display:none;"></div>

          <button type="button" class="utt-btn-submit" id="uttBtnSavePwd" style="width:100%; margin-bottom:14px;">
            ${dict.saveBtn || 'Yangi Parolni Saqlash'}
          </button>
        </div>

        <div style="border-top:1px solid #e2e8f0; padding-top:14px; display:flex; justify-content:space-between; align-items:center;">
          <button type="button" class="utt-btn-danger" id="uttBtnLogout">
            🚪 ${dict.logoutBtn || 'Tizimdan Chiqish (Log out)'}
          </button>
          <button type="button" class="utt-btn-cancel" id="uttProfileCancel">
            ${dict.cancelBtn || 'Yopish'}
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

    const currentLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
    const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[currentLang]) 
      ? I18N_TRANSLATIONS.ext[currentLang] 
      : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext) ? I18N_TRANSLATIONS.ext['uz'] : {});
    const tDict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket && I18N_TRANSLATIONS.ticket[currentLang]) 
      ? I18N_TRANSLATIONS.ticket[currentLang] 
      : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket) ? I18N_TRANSLATIONS.ticket['uz'] : {});

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
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h3>${dict.drawerTitle || "📋 MRT & MSKT Navbatdagi Bemorlar Ro'yxati"}</h3>
            <div style="display:flex; align-items:center; gap:5px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:3px 8px;">
              <span style="font-size:12px;">🌐</span>
              <span style="font-size:11px; font-weight:bold; color:#475569;">${dict.docLangTitle ? dict.docLangTitle.replace(/[\(\):]/g, '').trim() : 'Til'}:</span>
              <select id="uttQLPrintLangSelect" style="border:none; background:transparent; font-size:11.5px; font-weight:bold; cursor:pointer; outline:none; color:#0f172a;">
                <option value="uz" ${currentLang === 'uz' ? 'selected' : ''}>🇺🇿 UZ</option>
                <option value="ru" ${currentLang === 'ru' ? 'selected' : ''}>🇷🇺 RU</option>
                <option value="en" ${currentLang === 'en' ? 'selected' : ''}>🇬🇧 EN</option>
                <option value="kk" ${currentLang === 'kk' ? 'selected' : ''}>🇰🇿 KK</option>
                <option value="tg" ${currentLang === 'tg' ? 'selected' : ''}>🇹🇯 TG</option>
                <option value="tr" ${currentLang === 'tr' ? 'selected' : ''}>🇹🇷 TR</option>
              </select>
            </div>
            <button type="button" id="uttBtnRefreshQueue" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; color:#334155; display:inline-flex; align-items:center; gap:4px;">
              🔄 ${currentLang === 'ru' ? 'Обновить' : (currentLang === 'en' ? 'Refresh' : (currentLang === 'tr' ? 'Yenile' : (currentLang === 'kk' ? 'Жаңарту' : (currentLang === 'tg' ? 'Навсозӣ' : 'Yangilash'))))}
            </button>
            <button type="button" id="uttBtnToggleFullscreen" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:5px 12px; border-radius:6px; font-size:12px; font-weight:700; cursor:pointer; color:#0284c7; display:inline-flex; align-items:center; gap:4px;">
              ⛶ ${currentLang === 'ru' ? 'Полный экран' : (currentLang === 'en' ? 'Fullscreen' : (currentLang === 'tr' ? 'Tam Ekran' : (currentLang === 'kk' ? 'Толық экран' : (currentLang === 'tg' ? 'Экрани пурра' : 'Katta Ekran'))))}
            </button>
          </div>
          <button class="utt-modal-close" id="uttQueueListClose" style="font-size:26px;">&times;</button>
        </div>

        <!-- Filter, Search & Density Bar -->
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:10px; flex-wrap:wrap;">
          <!-- Sana Filtrlari -->
          <div style="display:flex; gap:6px; align-items:center;">
            <span style="font-size:12px; font-weight:700; color:#475569;">📅 ${dict.dateTitle ? dict.dateTitle.replace('📅', '').trim() : 'Sana:'}</span>
            <button type="button" class="utt-btn-date" id="uttQLBtnToday" style="padding:5px 12px; border-radius:6px; border:1px solid #0284c7; background:#0284c7; color:#fff; cursor:pointer; font-weight:bold; font-size:12px;">${dict.todayBtn || 'Bugun'}</button>
            <button type="button" class="utt-btn-date" id="uttQLBtnTomorrow" style="padding:5px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; color:#334155; cursor:pointer; font-weight:bold; font-size:12px;">${dict.tomorrowBtn || 'Ertaga'}</button>
            <input type="date" id="uttQLDateInput" value="${todayStr}" style="padding:5px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
          </div>

          <!-- Qator Balandligi (Density) & Qidiruv -->
          <div style="display:flex; gap:10px; align-items:center;">
            <div style="display:flex; align-items:center; gap:4px; font-size:12px; background:#f8fafc; border:1px solid #cbd5e1; padding:2px 6px; border-radius:6px;">
              <span style="font-size:11px; color:#64748b; font-weight:bold;">${currentLang === 'ru' ? 'Строка:' : (currentLang === 'en' ? 'Row:' : (currentLang === 'tr' ? 'Satır:' : (currentLang === 'kk' ? 'Қатар:' : (currentLang === 'tg' ? 'Сатр:' : 'Qator:'))))}</span>
              <button type="button" id="uttBtnDensStandard" style="padding:3px 8px; border:none; background:#0284c7; color:#fff; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">${currentLang === 'ru' ? 'Стандарт' : (currentLang === 'en' ? 'Standard' : (currentLang === 'tr' ? 'Standart' : (currentLang === 'kk' ? 'Стандарт' : (currentLang === 'tg' ? 'Стандартӣ' : 'Standart'))))}</button>
              <button type="button" id="uttBtnDensSpacious" style="padding:3px 8px; border:none; background:transparent; color:#334155; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">${currentLang === 'ru' ? 'Просторный' : (currentLang === 'en' ? 'Spacious' : (currentLang === 'tr' ? 'Geniş' : (currentLang === 'kk' ? 'Кең' : (currentLang === 'tg' ? 'Васеъ' : 'Keng'))))}</button>
              <button type="button" id="uttBtnDensCompact" style="padding:3px 8px; border:none; background:transparent; color:#334155; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">${currentLang === 'ru' ? 'Компактный' : (currentLang === 'en' ? 'Compact' : (currentLang === 'tr' ? 'Kompakt' : (currentLang === 'kk' ? 'Ықшам' : (currentLang === 'tg' ? 'Фишурда' : 'Zich'))))}</button>
            </div>

            <!-- Qidiruv Box -->
            <div style="width:280px;">
              <input type="text" id="uttQLSearchInput" placeholder="${dict.searchDrawerPlaceholder || '🔍 ID, F.I.Sh, Bo\'lim yoki Shifokor...'}" style="width:100%; padding:6px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px; outline:none;">
            </div>
          </div>
        </div>

        <!-- Qurilmalar Bo'yicha Saralash Tablari -->
        <div id="uttDevTabsContainer" style="display:flex; gap:10px; overflow-x:auto; padding:6px 2px 12px 2px; margin-bottom:12px; border-bottom:1px solid #e2e8f0; align-items:center;">
          <!-- Dynamic Device Tabs -->
        </div>

        <!-- Bemorlar Jadvali / Ro'yxati Container -->
        <div id="uttQueueTableWrapper" style="flex-grow:1; overflow-y:auto; overflow-x:auto; border:1px solid #cbd5e1; border-radius:8px; background:#fff;">
          <div style="padding:30px; text-align:center; color:#94a3b8; font-size:13px;">${dict.calculatingSlot || 'Bemorlar yuklanmoqda...'}</div>
        </div>

        <!-- Modal Footer Info -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; padding-top:8px; border-top:1px solid #e2e8f0; font-size:12px; color:#64748b;">
          <div id="uttQLSummaryText">...</div>
          <div style="display:flex; gap:8px; align-items:center;">
            <button type="button" id="uttQLCloseBtn" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:6px 18px; border-radius:8px; font-weight:700; cursor:pointer; color:#334155;">
              ${dict.cancelBtn || 'Yopish'}
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
    const printLangSel = document.getElementById("uttQLPrintLangSelect");

    if (closeBtn) closeBtn.onclick = () => overlay.remove();
    if (bottomCloseBtn) bottomCloseBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    if (printLangSel) {
      printLangSel.onchange = (e) => {
        const newLang = e.target.value;
        setI18nLanguage(newLang);
        updateFloatingBar();
        openQueueListModal();
      };
    }

    if (toggleFsBtn) {
      toggleFsBtn.onclick = () => {
        isFullscreen = !isFullscreen;
        if (isFullscreen) {
          modalBox.classList.add("utt-fullscreen");
          toggleFsBtn.innerText = "🗗 " + (currentLang === 'ru' ? 'Свернуть' : (currentLang === 'en' ? 'Restore' : (currentLang === 'tr' ? 'Küçült' : (currentLang === 'kk' ? 'Кішірейту' : (currentLang === 'tg' ? 'Хурд кардан' : 'Kichraytirish')))));
        } else {
          modalBox.classList.remove("utt-fullscreen");
          toggleFsBtn.innerText = "⛶ " + (currentLang === 'ru' ? 'Полный экран' : (currentLang === 'en' ? 'Fullscreen' : (currentLang === 'tr' ? 'Tam Ekran' : (currentLang === 'kk' ? 'Толық экран' : (currentLang === 'tg' ? 'Экрани пурра' : 'Katta Ekran')))));
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
      if (wrapper) wrapper.innerHTML = `<div style="padding:30px; text-align:center; color:#94a3b8; font-size:13px;">${selectedDate} ...</div>`;

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
          <span style="font-size:14px;">🌐</span> <span>${dict.tabAll || 'Barchasi'}</span> <span class="tab-badge">${totalCount}</span>
        </button>
      `;

      dynamicDevices.forEach(d => {
        const devCount = cachedPatients.filter(p => p.doctorId === d.id && p.status !== "cancelled").length;
        const icon = (d.type === "MSKT") ? "⚡" : "🧲";
        const translatedRoom = (typeof formatRoomWithOriginal === 'function') 
          ? formatRoomWithOriginal(d.room || d.name, d.name, currentLang) 
          : (d.room || d.name);
        html += `
          <button type="button" class="utt-dev-tab-btn ${selectedDevFilter === d.id ? 'active' : ''}" data-dev="${d.id}">
            <span style="font-size:14px;">${icon}</span> <span>${escapeHtml(translatedRoom)}</span> <span class="tab-badge">${devCount}</span>
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
        if (dict.showingSummary) {
          summaryEl.innerText = dict.showingSummary.replace('{total}', filtered.length).replace('{active}', activeCount).replace('{date}', selectedDate);
        } else {
          summaryEl.innerText = `Ko'rsatilmoqda: ${filtered.length} nafar (Faol navbat: ${activeCount} nafar) | Sana: ${selectedDate}`;
        }
      }

      if (filtered.length === 0) {
        wrapper.innerHTML = `
          <div style="padding:40px 20px; text-align:center; color:#94a3b8;">
            <div style="font-size:32px; margin-bottom:8px;">📭</div>
            <div style="font-size:14px; font-weight:700; color:#475569;">${dict.noPatientsFound || 'Bemorlar topilmadi'} (${selectedDate})</div>
            <div style="font-size:12px; margin-top:4px;">${dict.noPatientsSubtitle || 'Ushbu kunga hali hech qanday bemor yozilmagan yoki qidiruvga mos kelmadi.'}</div>
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
          const devColor = dev.color || (dev.type === "MSKT" ? "#10b981" : "#0284c7");
          const translatedRoom = (typeof formatRoomWithOriginal === 'function') 
            ? formatRoomWithOriginal(dev.room || dev.name, dev.name, currentLang) 
            : (dev.room || dev.name);
          contentHtml += `
            <div class="utt-room-group-banner" style="border-top-color:${devColor};">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:16px;">${icon}</span>
                <span style="font-size:14px; font-weight:900; color:#0369a1; letter-spacing:0.3px;">${escapeHtml(translatedRoom)}</span>
              </div>
              <span style="background:#0284c7; color:#ffffff; padding:3px 12px; border-radius:14px; font-size:12px; font-weight:800; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                ${devList.length} ${dict.patientsCount || 'ta bemor'}
              </span>
            </div>
            ${renderPatientsTableHtml(devList)}
          `;
        });

        const unknownList = filtered.filter(p => !dynamicDevices.some(d => d.id === p.doctorId));
        if (unknownList.length > 0) {
          contentHtml += `
            <div class="utt-room-group-banner" style="border-top-color:#64748b;">
              <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-size:16px;">🏢</span>
                <span style="font-size:14px; font-weight:900; color:#334155;">${dict.otherDevices || 'Boshqa qurilmalar'}</span>
              </div>
              <span style="background:#64748b; color:#ffffff; padding:3px 12px; border-radius:14px; font-size:12px; font-weight:800;">
                ${unknownList.length} ${dict.patientsCount || 'ta bemor'}
              </span>
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
          const chosenLang = document.getElementById("uttQLPrintLangSelect")?.value || (typeof getI18nLanguage === 'function' ? getI18nLanguage() : 'uz');
          if (pat) printThermalTicketDirect(pat, chosenLang);
        };
      });

      // Tezkor til bo'yicha talon chop etish (1 click flag)
      wrapper.querySelectorAll(".utt-quick-print-ticket").forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const pId = btn.getAttribute("data-id");
          const lang = btn.getAttribute("data-lang");
          const pat = cachedPatients.find(p => p.id === pId);
          if (pat) printThermalTicketDirect(pat, lang);
        };
      });

      // Rozilik anketasini chop etish tugmalarini ulash
      wrapper.querySelectorAll(".utt-btn-print-consent").forEach(btn => {
        btn.onclick = () => {
          const pId = btn.getAttribute("data-id");
          const pat = cachedPatients.find(p => p.id === pId);
          const chosenLang = document.getElementById("uttQLPrintLangSelect")?.value || (typeof getI18nLanguage === 'function' ? getI18nLanguage() : 'uz');
          if (pat) printConsentFormDirect(pat, chosenLang);
        };
      });

      // Tezkor til bo'yicha rozilik anketasini chop etish (1 click flag)
      wrapper.querySelectorAll(".utt-quick-print-consent").forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          const pId = btn.getAttribute("data-id");
          const lang = btn.getAttribute("data-lang");
          const pat = cachedPatients.find(p => p.id === pId);
          if (pat) printConsentFormDirect(pat, lang);
        };
      });

      // Bemor kelganlik / kutish zalidagi holatini o'zgartirish (Toggle Arrived)
      wrapper.querySelectorAll(".utt-btn-toggle-arrived").forEach(btn => {
        btn.onclick = async () => {
          const pId = btn.getAttribute("data-id");
          const pat = cachedPatients.find(p => p.id === pId);
          if (!pat) return;
          const newStatus = !pat.arrived;
          pat.arrived = newStatus;
          pat.arrivedAt = newStatus ? Date.now() : null;

          // UI ni darhol yangilash
          if (newStatus) {
            btn.className = "utt-btn-toggle-arrived arrived";
            btn.style.background = "#dcfce7";
            btn.style.color = "#15803d";
            btn.style.borderColor = "#86efac";
            btn.innerHTML = dict.btnMarkArrived || "🟢 Zalda";
            btn.title = dict.btnMarkArrivedTitle || "Bemor kutish zalida o'tiribdi (O'zgartirish uchun bosing)";
          } else {
            btn.className = "utt-btn-toggle-arrived not-arrived";
            btn.style.background = "#f1f5f9";
            btn.style.color = "#64748b";
            btn.style.borderColor = "#cbd5e1";
            btn.innerHTML = dict.btnMarkNotArrived || "⏳ Hali kelmadi";
            btn.title = dict.btnMarkNotArrivedTitle || "Bemor hali kelmadi (Kelganini belgilash uchun bosing)";
          }

          try {
            await safeFetch(`${FIREBASE_DB_URL}/patients/${selectedDate}/${pId}.json`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ arrived: newStatus, arrivedAt: pat.arrivedAt })
            });
            showToast(newStatus ? `🟢 ${pat.name} (${dict.btnMarkArrived || 'Zalda'})` : `⏳ ${pat.name} (${dict.btnMarkNotArrived || 'Hali kelmadi'})`);
          } catch (e) {}
        };
      });
    }

    function renderPatientsTableHtml(list) {
      const densityClass = (currentDensity === "spacious") ? "utt-density-spacious" : (currentDensity === "compact" ? "utt-density-compact" : "");
      return `
        <table class="utt-queue-table ${densityClass}">
          <thead>
            <tr>
              <th style="width:100px; min-width:90px;">${dict.colTime || 'Vaqt'}</th>
              <th style="width:60px; min-width:50px;">${dict.colId || 'ID'}</th>
              <th style="width:150px; min-width:130px;">${dict.colPatient || 'Bemor F.I.Sh'}</th>
              <th style="width:135px; min-width:120px;">${dict.colCategory || 'Toifasi / Bo\'lim'}</th>
              <th style="min-width:300px;">${dict.colService || 'Tekshiruv Nomi'}</th>
              <th style="width:140px; min-width:120px;">${dict.colReferring || 'Fayl Shifokori'}</th>
              <th style="width:110px; min-width:100px;">${dict.colOperator || 'Ro\'yxatchi'}</th>
              <th style="width:110px; min-width:100px; text-align:center;">${dict.colWaitingRoom || 'Kutish Zalida'}</th>
              <th style="width:85px; min-width:75px;">${dict.colStatus || 'Holat'}</th>
              <th style="text-align:center; width:45px; min-width:40px;">${dict.colTicket || 'Talon'}</th>
              <th style="text-align:center; width:75px; min-width:65px;">${dict.colConsent || 'Rozilik'}</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(p => {
              const isCancelled = p.status === "cancelled";
              const oldSlot = p.cancelledSlot || p.timeSlot || p.scheduledTime || "-";
              const timeDisplay = isCancelled
                ? `<div style="color:#94a3b8; font-size:11px; text-decoration:line-through;">${escapeHtml(oldSlot)}</div><span style="color:#15803d; font-size:9px; font-weight:bold;">🟢 ${dict.statusCancelled || 'Bo\'shatilgan'}</span>`
                : `<strong style="color:#0284c7; font-size:12px;">${escapeHtml(p.timeSlot || p.scheduledTime || p.time || '-')}</strong>`;

              const typeBadge = p.patientType === "Bo'limda yotibdi"
                ? `<span style="background:#fef3c7; color:#b45309; font-size:11px; font-weight:bold; padding:3px 7px; border-radius:4px; display:inline-block;">${tDict.stationary || "🏥 Bo'limda"} ${p.department ? `(${escapeHtml(p.department)})` : ''}</span>`
                : `<span style="background:#e0f2fe; color:#0284c7; font-size:11px; font-weight:bold; padding:3px 7px; border-radius:4px; display:inline-block;">${tDict.ambulatory || "🏠 Uyidan qatnaydi"}</span>`;

              let statusBadge = `<span style="background:#fef3c7; color:#b45309; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">${dict.statusWaiting || 'Kutmoqda'}</span>`;
              if (p.status === "calling") statusBadge = `<span style="background:#fce7f3; color:#be185d; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">${dict.statusCalling || 'Chaqirilmoqda'}</span>`;
              if (p.status === "in_progress") statusBadge = `<span style="background:#e0e7ff; color:#4338ca; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">${dict.statusInProgress || 'Qabulda'}</span>`;
              if (p.status === "completed") statusBadge = `<span style="background:#dcfce7; color:#15803d; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">${dict.statusCompleted || 'Yakunlandi'}</span>`;
              if (isCancelled) statusBadge = `<span style="background:#fee2e2; color:#dc2626; padding:3px 7px; border-radius:4px; font-size:10.5px; font-weight:bold;">${dict.statusCancelled || 'O\'chirilgan'}</span>`;

              // Tekshiruvlarni chiroyli kartochka ko'rinishida formatlash
              let servicesDisplayHtml = "";
              if (p.servicesList && p.servicesList.length > 0) {
                servicesDisplayHtml = p.servicesList.map(s => {
                  const sTrans = (typeof formatServiceNameWithOriginal === 'function') 
                    ? formatServiceNameWithOriginal(s.name || s.fullName, currentLang) 
                    : (s.name || s.fullName);
                  return `
                    <div class="utt-svc-item ${s.isContrast ? 'contrast' : ''}">
                      <strong style="color:${s.isContrast ? '#b91c1c' : '#0369a1'};">${s.code ? escapeHtml(s.code) + ' - ' : ''}</strong>${escapeHtml(sTrans)}
                      ${s.isContrast ? `<span style="background:#fee2e2; color:#b91c1c; font-size:9px; font-weight:800; padding:1px 5px; border-radius:3px; margin-left:4px;">${tDict.contrastBadge || 'KONTRAST'}</span>` : ''}
                      <span style="color:#64748b; font-size:10px; margin-left:4px;">(⏱ ${s.duration || 30} ${dict.durationMin || 'daq'})</span>
                    </div>
                  `;
                }).join("");
              } else {
                const parts = (p.service || "-").split(" + ");
                servicesDisplayHtml = parts.map(part => {
                  const sTrans = (typeof formatServiceNameWithOriginal === 'function') 
                    ? formatServiceNameWithOriginal(part, currentLang) 
                    : part;
                  return `
                    <div class="utt-svc-item ${p.isContrast ? 'contrast' : ''}">
                      ${escapeHtml(sTrans)}
                      ${p.isContrast ? `<span style="background:#fee2e2; color:#b91c1c; font-size:9px; font-weight:800; padding:1px 5px; border-radius:3px; margin-left:4px;">${tDict.contrastBadge || 'KONTRAST'}</span>` : ''}
                    </div>
                  `;
                }).join("");
              }

              return `
                <tr style="${isCancelled ? 'opacity:0.65; background:#fff5f5;' : ''}">
                  <td>${timeDisplay}</td>
                  <td><span style="background:#f1f5f9; padding:3px 6px; border-radius:4px; font-weight:800; font-size:11px;">${escapeHtml(p.ticketId)}</span></td>
                  <td>
                    <strong style="color:#0f172a; font-size:13px;">${escapeHtml(p.name)}</strong>
                    ${p.rescheduleReason ? `<div style="font-size:10.5px; color:#b45309; margin-top:2px;">⚠️ ${escapeHtml(translateDeferReason(p.rescheduleReason, currentLang))}</div>` : ''}
                  </td>
                  <td>${typeBadge}</td>
                  <td style="padding:6px 10px;">
                    ${servicesDisplayHtml}
                  </td>
                  <td style="color:#334155; font-size:11.5px;">${p.referringDoctor ? `👨‍⚕️ <strong>${escapeHtml(p.referringDoctor)}</strong>` : '-'}</td>
                  <td style="color:#64748b; font-size:11px;">${escapeHtml(p.registeredBy || p.operatorLogin || '-')}</td>
                  <td style="text-align:center;">
                    <button type="button" class="utt-btn-toggle-arrived ${p.arrived ? 'arrived' : 'not-arrived'}" data-id="${p.id}" title="${p.arrived ? (dict.btnMarkArrivedTitle || 'Bemor kutish zalida o\'tiribdi') : (dict.btnMarkNotArrivedTitle || 'Bemor hali kelmadi')}" style="background:${p.arrived ? '#dcfce7' : '#f1f5f9'}; color:${p.arrived ? '#15803d' : '#64748b'}; border:1px solid ${p.arrived ? '#86efac' : '#cbd5e1'}; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:4px; width:94px; justify-content:center;">
                      ${p.arrived ? (dict.btnMarkArrived || '🟢 Zalda') : (dict.btnMarkNotArrived || '⏳ Hali kelmadi')}
                    </button>
                  </td>
                  <td>${statusBadge}</td>
                  <td style="text-align:center;">
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:center;">
                      <button type="button" class="utt-btn-print-ticket" data-id="${p.id}" title="${dict.btnReprintTicket || 'Talonni chop etish'}" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:3px 6px; border-radius:5px; cursor:pointer; font-size:11.5px; font-weight:bold; color:#0369a1; width:100%;">
                        🖨️ ${dict.colTicket || 'Talon'}
                      </button>
                      <div style="display:flex; gap:2px; justify-content:center;">
                        <span class="utt-quick-print-ticket" data-id="${p.id}" data-lang="uz" title="O'zbekcha Talon" style="cursor:pointer; font-size:10px;">🇺🇿</span>
                        <span class="utt-quick-print-ticket" data-id="${p.id}" data-lang="ru" title="Русский Талон" style="cursor:pointer; font-size:10px;">🇷🇺</span>
                        <span class="utt-quick-print-ticket" data-id="${p.id}" data-lang="en" title="English Ticket" style="cursor:pointer; font-size:10px;">🇬🇧</span>
                        <span class="utt-quick-print-ticket" data-id="${p.id}" data-lang="kk" title="Қазақша Талон" style="cursor:pointer; font-size:10px;">🇰🇿</span>
                        <span class="utt-quick-print-ticket" data-id="${p.id}" data-lang="tg" title="Тоҷикӣ Талон" style="cursor:pointer; font-size:10px;">🇹🇯</span>
                        <span class="utt-quick-print-ticket" data-id="${p.id}" data-lang="tr" title="Türkçe Bilet" style="cursor:pointer; font-size:10px;">🇹🇷</span>
                      </div>
                    </div>
                  </td>
                  <td style="text-align:center;">
                    <div style="display:flex; flex-direction:column; gap:2px; align-items:center;">
                      <button type="button" class="utt-btn-print-consent" data-id="${p.id}" title="${dict.btnReprintConsent || 'Rozilik anketasini chop etish'}" style="background:#f0fdf4; border:1px solid #86efac; color:#15803d; padding:3px 6px; border-radius:5px; cursor:pointer; font-size:11px; font-weight:800; width:100%;">
                        📋 ${dict.colConsent || 'Anketa'}
                      </button>
                      <div style="display:flex; gap:2px; justify-content:center;">
                        <span class="utt-quick-print-consent" data-id="${p.id}" data-lang="uz" title="O'zbekcha Anketa" style="cursor:pointer; font-size:10px;">🇺🇿</span>
                        <span class="utt-quick-print-consent" data-id="${p.id}" data-lang="ru" title="Русская Анкета" style="cursor:pointer; font-size:10px;">🇷🇺</span>
                        <span class="utt-quick-print-consent" data-id="${p.id}" data-lang="en" title="English Consent" style="cursor:pointer; font-size:10px;">🇬🇧</span>
                        <span class="utt-quick-print-consent" data-id="${p.id}" data-lang="kk" title="Қазақша Сауалнама" style="cursor:pointer; font-size:10px;">🇰🇿</span>
                        <span class="utt-quick-print-consent" data-id="${p.id}" data-lang="tg" title="Тоҷикӣ Саволнома" style="cursor:pointer; font-size:10px;">🇹🇯</span>
                        <span class="utt-quick-print-consent" data-id="${p.id}" data-lang="tr" title="Türkçe Onam" style="cursor:pointer; font-size:10px;">🇹🇷</span>
                      </div>
                    </div>
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

async function fetchDeviceQueueCounts(targetDate) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const checkDate = targetDate || todayStr;

  try {
    deviceQueues = {};
    dynamicDevices.forEach(dev => {
      deviceQueues[dev.id] = 0;
    });

    const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${checkDate}.json`);
    if (!res || !res.ok) return deviceQueues;
    const data = await res.json();
    
    if (data) {
      Object.values(data).forEach(p => {
        // Navbatda turganlar (kutmoqda, chaqirilmoqda, qabulda) - Faqat o'chirilmagan va yakunlanmaganlar!
        if (p.status !== "cancelled" && p.status !== "completed") {
          const docId = p.doctorId;
          if (docId) {
            deviceQueues[docId] = (deviceQueues[docId] || 0) + 1;
          }
        }
      });
    }
  } catch (e) {
    console.warn("fetchDeviceQueueCounts error:", e);
  }
  return deviceQueues;
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

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let selectedDate = todayStr;

    // Dastlabki navbatdagi bemorlar sonini aniq yuklash:
    await fetchDeviceQueueCounts(selectedDate);

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
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    let selectedMode = "auto";
    let isModalSlotValid = true;
    let currentSlotData = await calculateNextAvailableTimeSlot(activeServiceInfo.autoDeviceId, activeServiceInfo.duration);

    let chosenDocLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
    const langNames = { uz: "🇺🇿 O'zbekcha", ru: "🇷🇺 Русский", en: "🇬🇧 English", kk: "🇰🇿 Қазақша", tg: "🇹🇯 Тоҷикӣ", tr: "🇹🇷 Türkçe" };

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
          <div style="font-size:12px; font-weight:800; color:#0f172a; margin-bottom:8px;" id="uttModalLblSvcChoice">
            📋 Navbatga qo'yiladigan tekshiruvni tanlang:
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:6px; cursor:pointer; background:#fff; padding:6px 10px; border-radius:6px; border:1px solid #cbd5e1;">
            <input type="radio" name="uttModalSvcChoice" value="all" ${!isSpecific ? 'checked' : ''}>
            <div>
              <strong style="color:#0284c7;" id="uttModalLblSvcAll">Barcha tekshiruvlarni birga navbatga qo'yish (Kombinatsiya)</strong>
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
          <h3 id="uttModalHeaderTitle">⚡ MRT & MSKT Navbatiga Yozish</h3>
          <button class="utt-modal-close" id="uttModalClose">&times;</button>
        </div>

        <div class="utt-patient-info-box">
          ${patientData.isAlreadyQueued && patientData.existingQueueData ? `
            <div style="background:#fffbeb; border:2px solid #f59e0b; border-radius:8px; padding:10px 12px; margin-bottom:10px;">
              <div style="color:#b45309; font-weight:900; font-size:13px; margin-bottom:4px;">
                ⚠️ DIQQAT: Ushbu tekshiruv (Namuna №${escapeHtml(patientData.sampleNumber || '')}) allaqachon navbatga qo'yilgan!
              </div>
              <div style="font-size:11.5px; color:#334155; line-height:1.5;">
                <div><strong>Talon raqami:</strong> №${escapeHtml(patientData.existingQueueData.ticketId)}</div>
                <div><strong>Belgilangan vaqt:</strong> ${escapeHtml(patientData.existingQueueData.timeSlot || patientData.existingQueueData.scheduledTime || patientData.existingQueueData.time)} (${escapeHtml(patientData.existingQueueData.appointmentDate || 'Bugun')})</div>
                <div><strong>Qurilma / Xona:</strong> ${escapeHtml(patientData.existingQueueData.doctorName || patientData.existingQueueData.room)}</div>
              </div>
            </div>
          ` : ''}

          <div class="utt-info-row">
            <span class="utt-info-label" id="uttModalLblOperator">Yo'naltirgan Ro'yxatchi:</span>
            <span class="utt-info-val" style="color:#0284c7;">
              👤 <strong>${currentUser.login}</strong> — ${escapeHtml(currentUser.name)}
            </span>
          </div>
          <div class="utt-info-row">
            <span class="utt-info-label" id="uttModalLblPatId">Bemor ID:</span>
            <span class="utt-info-val">${escapeHtml(patientData.id)}</span>
          </div>
          <div class="utt-info-row">
            <span class="utt-info-label" id="uttModalLblPatName">Bemor F.I.Sh:</span>
            <span class="utt-info-val" style="font-weight:900; color:#0f172a;">${escapeHtml(patientData.name)}</span>
          </div>
          ${patientData.sampleNumber ? `
            <div class="utt-info-row">
              <span class="utt-info-label">Namuna raqami:</span>
              <span class="utt-info-val" style="color:#4338ca; font-weight:800;">№ ${escapeHtml(patientData.sampleNumber)}</span>
            </div>
          ` : ''}
          ${patientData.birthDate ? `
            <div class="utt-info-row">
              <span class="utt-info-label">Tug'ilgan sana:</span>
              <span class="utt-info-val">${escapeHtml(patientData.birthDate)}</span>
            </div>
          ` : ''}
          ${patientData.pinfl ? `
            <div class="utt-info-row">
              <span class="utt-info-label">JSHSHIR (PINFL):</span>
              <span class="utt-info-val" style="font-family:monospace; font-weight:700; color:#0f172a;">${escapeHtml(patientData.pinfl)}</span>
            </div>
          ` : ''}

          ${serviceSelectorHtml}

          <div class="utt-info-row" id="uttModalServiceRow">
            <span class="utt-info-label" id="uttModalLblSvcSelected">Tanlangan Tekshiruv:</span>
            <span class="utt-info-val" id="uttModalServiceTitle" style="color:#0284c7; font-weight:700;">${escapeHtml(activeServiceInfo.service)}</span>
          </div>

          <div id="uttModalPrepBox" style="${activeServiceInfo.preparation ? '' : 'display:none;'} background:#f0fdf4; border-left:3px solid #10b981; padding:6px 10px; border-radius:4px; margin-top:6px;">
            <span class="utt-info-label" id="uttModalLblPrep" style="color:#059669; font-weight:700;">📋 Tayyorgarlik:</span>
            <span class="utt-info-val" id="uttModalPrepText" style="color:#065f46; font-size:12px; font-weight:600;">${escapeHtml(activeServiceInfo.preparation)}</span>
          </div>

          <div id="uttModalContraBox" style="${activeServiceInfo.contraindications ? '' : 'display:none;'} background:#fef2f2; border-left:3px solid #ef4444; padding:6px 10px; border-radius:4px; margin-top:6px;">
            <span class="utt-info-label" id="uttModalLblContra" style="color:#dc2626; font-weight:700;">🚫 Qarshi ko'rsatmalar:</span>
            <span class="utt-info-val" id="uttModalContraText" style="color:#991b1b; font-size:12px; font-weight:700;">${escapeHtml(activeServiceInfo.contraindications)}</span>
          </div>

          <div class="utt-info-row">
            <span class="utt-info-label" id="uttModalLblPatType">Bemor Toifasi:</span>
            <span class="utt-info-val" id="uttModalValPatType">
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
              <span class="utt-info-label" id="uttModalLblRefDoc">Fayl Shifokori:</span>
              <span class="utt-info-val" style="color:#0f172a; font-weight:bold;">
                👨‍⚕️ ${escapeHtml(patientData.referringDoctor)}
              </span>
            </div>
          ` : ''}

          <div class="utt-info-row" style="margin-top:6px;">
            <span class="utt-info-label" id="uttModalLblDuration">Ketadigan Vaqt:</span>
            <span class="utt-info-val" id="uttModalDurationVal" style="color:#10b981; font-weight:800;">
              ⏱ ${activeServiceInfo.duration} daqiqa (${activeServiceInfo.contrastLabel}) <small id="uttModalCalcMethod" style="color:#64748b; font-size:11px;">[${activeServiceInfo.calcMethod || ''}]</small>
            </span>
          </div>
        </div>

        <!-- Sana va Qurilma Tanlash -->
        <div class="utt-form-group" style="margin-top:10px;">
          <label style="font-weight:700;" id="uttModalLblDate">📅 Qabul Sanasi:</label>
          <div style="display:flex; gap:6px; align-items:center;">
            <button type="button" class="utt-btn-date" id="uttBtnDateToday" style="padding:6px 12px; border-radius:6px; border:1px solid #0284c7; background:#0284c7; color:#fff; cursor:pointer; font-weight:bold;">Bugun</button>
            <button type="button" class="utt-btn-date" id="uttBtnDateTomorrow" style="padding:6px 12px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; color:#334155; cursor:pointer; font-weight:bold;">Ertaga</button>
            <input type="date" id="uttModalDateInput" value="${todayStr}" style="padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; flex-grow:1;">
          </div>
        </div>

        <div class="utt-form-group">
          <label for="uttDeviceSelect" id="uttModalLblDevice">Qurilma / Xonani tanlang:</label>
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
          <label style="font-size:12px; font-weight:bold; color:#0f172a; display:block; margin-bottom:8px;" id="uttModalLblTimeMode">
            ⏰ Qabul Vaqtini Belgilash:
          </label>
          
          <div style="display:flex; gap:12px; margin-bottom:8px; font-size:12px;">
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-weight:600;">
              <input type="radio" name="uttTimeMode" value="auto" checked id="uttModeAuto">
              <span id="uttModalLblModeAuto">⚡ Eng yaqin avtomatik vaqt</span>
            </label>
            <label style="display:flex; align-items:center; gap:4px; cursor:pointer; font-weight:600;">
              <input type="radio" name="uttTimeMode" value="custom" id="uttModeCustom">
              <span id="uttModalLblModeCustom">🕒 Ixtiyoriy vaqt (Bemor iltimosiga ko'ra)</span>
            </label>
          </div>

          <div id="uttCustomTimeContainer" style="display:none; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:11px; font-weight:bold;" id="uttModalLblStartTime">Boshlanish vaqti:</span>
              <input type="time" id="uttCustomStartTime" value="08:00" style="padding:4px 8px; border:1px solid #cbd5e1; border-radius:4px; font-size:12px;">
              <span style="font-size:11px; color:#64748b;"><span id="uttModalLblInterval">Oraliq:</span> <strong id="uttCustomCalcSlot" style="color:#0284c7;">08:00 - 08:30</strong></span>
            </div>
          </div>

          <div id="uttModalSlotAlert" style="background:#e0f2fe; color:#0369a1; padding:8px 10px; border-radius:6px; font-size:12px; font-weight:bold;">
            Hisoblanmoqda...
          </div>

          <!-- Voz kechish sababi -->
          <div id="uttDeferReasonBox" style="display:none; margin-top:10px; padding-top:8px; border-top:1px dashed #cbd5e1;">
            <label style="font-weight:bold; color:#b45309; font-size:11px; display:block; margin-bottom:4px;" id="uttModalLblDefer">
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

        <!-- Hujjat va Chop Etish Tili Tanlash (6 ta Til) -->
        <div style="background:#f0f9ff; border:1.5px solid #0284c7; border-radius:8px; padding:10px 12px; margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:800; color:#0369a1; display:flex; align-items:center; gap:6px;" id="uttModalLblDocLang">
              🌐 Hujjat / Chop Etish Tili (Language):
            </span>
            <span id="uttSendSelectedLangLabel" style="font-size:11.5px; font-weight:bold; color:#0284c7; background:#e0f2fe; padding:2px 8px; border-radius:10px;">🇺🇿 O'zbekcha</span>
          </div>
          <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:6px;">
            <button type="button" class="utt-btn-send-lang" data-lang="uz" style="padding:6px; font-size:11.5px; font-weight:bold; border-radius:6px; cursor:pointer; border:1.5px solid #0284c7; background:#0284c7; color:#fff; text-align:center;">🇺🇿 O'zbekcha</button>
            <button type="button" class="utt-btn-send-lang" data-lang="ru" style="padding:6px; font-size:11.5px; font-weight:bold; border-radius:6px; cursor:pointer; border:1px solid #cbd5e1; background:#fff; color:#334155; text-align:center;">🇷🇺 Русский</button>
            <button type="button" class="utt-btn-send-lang" data-lang="en" style="padding:6px; font-size:11.5px; font-weight:bold; border-radius:6px; cursor:pointer; border:1px solid #cbd5e1; background:#fff; color:#334155; text-align:center;">🇬🇧 English</button>
            <button type="button" class="utt-btn-send-lang" data-lang="kk" style="padding:6px; font-size:11.5px; font-weight:bold; border-radius:6px; cursor:pointer; border:1px solid #cbd5e1; background:#fff; color:#334155; text-align:center;">🇰🇿 Қазақша</button>
            <button type="button" class="utt-btn-send-lang" data-lang="tg" style="padding:6px; font-size:11.5px; font-weight:bold; border-radius:6px; cursor:pointer; border:1px solid #cbd5e1; background:#fff; color:#334155; text-align:center;">🇹🇯 Тоҷикӣ</button>
            <button type="button" class="utt-btn-send-lang" data-lang="tr" style="padding:6px; font-size:11.5px; font-weight:bold; border-radius:6px; cursor:pointer; border:1px solid #cbd5e1; background:#fff; color:#334155; text-align:center;">🇹🇷 Türkçe</button>
          </div>
          
          <div style="display:flex; gap:16px; margin-top:8px; padding-top:8px; border-top:1px dashed #bae6fd; font-size:11.5px; font-weight:700; color:#0f172a;">
            <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
              <input type="checkbox" id="uttCheckAutoTicket" checked> <span id="uttModalLblTicket">🎫 Talon (80mm)</span>
            </label>
            <label style="display:flex; align-items:center; gap:5px; cursor:pointer;">
              <input type="checkbox" id="uttCheckAutoConsent"> <span id="uttModalLblConsent">📋 Rozilik anketasi (A4)</span>
            </label>
          </div>
        </div>

        <div class="utt-modal-actions">
          <button type="button" class="utt-btn-cancel" id="uttBtnCancel">Bekor qilish</button>
          <button type="button" class="utt-btn-submit" id="uttBtnSend">
            Navbatga Yozish & Chop Etish
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Modal elementlari
    const modalClose = document.getElementById("uttModalClose");
    const btnCancel = document.getElementById("uttBtnCancel");
    const btnSend = document.getElementById("uttBtnSend");
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

    function updateSendModalI18nLabels(lang) {
      const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[lang]) 
        ? I18N_TRANSLATIONS.ext[lang] 
        : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext) ? I18N_TRANSLATIONS.ext['uz'] : {});
      const tDict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket && I18N_TRANSLATIONS.ticket[lang]) 
        ? I18N_TRANSLATIONS.ticket[lang] 
        : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket) ? I18N_TRANSLATIONS.ticket['uz'] : {});

      const lblHeader = document.getElementById("uttModalHeaderTitle");
      if (lblHeader) lblHeader.innerText = "⚡ " + (dict.sendModalTitle || "MRT & MSKT Navbatiga Yozish");

      const lblOp = document.getElementById("uttModalLblOperator");
      if (lblOp) lblOp.innerText = dict.operator || "Yo'naltirgan Ro'yxatchi:";

      const lblPatId = document.getElementById("uttModalLblPatId");
      if (lblPatId) lblPatId.innerText = (dict.colId || "Bemor ID") + ":";

      const lblPatName = document.getElementById("uttModalLblPatName");
      if (lblPatName) lblPatName.innerText = dict.patientName || "Bemor F.I.Sh:";

      const lblSvcChoice = document.getElementById("uttModalLblSvcChoice");
      if (lblSvcChoice) lblSvcChoice.innerText = "📋 " + (dict.serviceChoiceTitle || "Navbatga qo'yiladigan tekshiruvni tanlang:");

      const lblSvcAll = document.getElementById("uttModalLblSvcAll");
      if (lblSvcAll) lblSvcAll.innerText = dict.allServicesTogether || "Barcha tekshiruvlarni birga navbatga qo'yish (Kombinatsiya)";

      const lblSvcSelected = document.getElementById("uttModalLblSvcSelected");
      if (lblSvcSelected) lblSvcSelected.innerText = (dict.colService || "Tanlangan Tekshiruv") + ":";

      const sTitle = document.getElementById("uttModalServiceTitle");
      if (sTitle && activeServiceInfo) {
        sTitle.innerText = (typeof formatServiceNameWithOriginal === 'function') 
          ? formatServiceNameWithOriginal(activeServiceInfo.service, lang) 
          : activeServiceInfo.service;
      }

      const lblPrep = document.getElementById("uttModalLblPrep");
      if (lblPrep) lblPrep.innerText = "📋 " + (dict.singlePrepTitle || "Tayyorgarlik:");

      const lblContra = document.getElementById("uttModalLblContra");
      if (lblContra) lblContra.innerText = "🚫 " + (dict.contraTitle || "Qarshi ko'rsatmalar:");

      const lblPatType = document.getElementById("uttModalLblPatType");
      if (lblPatType) lblPatType.innerText = dict.patientType || "Bemor Toifasi:";

      const valPatType = document.getElementById("uttModalValPatType");
      if (valPatType) {
        valPatType.innerHTML = patientData.isStationary 
          ? `<span style="background:#fef3c7; color:#b45309; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:12px;">${tDict.stationary || "🏥 Bo'limda yotibdi"} ${patientData.department ? `(${escapeHtml(patientData.department)})` : ''}</span>`
          : `<span style="background:#e0f2fe; color:#0369a1; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:12px;">${tDict.ambulatory || "🏠 Uyidan qatnaydi"}</span>`;
      }

      const lblRefDoc = document.getElementById("uttModalLblRefDoc");
      if (lblRefDoc) lblRefDoc.innerText = dict.referringDoc || "Fayl Shifokori:";

      const lblDur = document.getElementById("uttModalLblDuration");
      if (lblDur) lblDur.innerText = dict.durationTime || "Ketadigan Vaqt:";

      const durVal = document.getElementById("uttModalDurationVal");
      if (durVal && activeServiceInfo) {
        durVal.innerHTML = `⏱ ${activeServiceInfo.duration} ${dict.durationMin || 'daqiqa'} (${activeServiceInfo.contrastLabel}) <small style="color:#64748b; font-size:11px;">[${activeServiceInfo.calcMethod || ''}]</small>`;
      }

      const lblDate = document.getElementById("uttModalLblDate");
      if (lblDate) lblDate.innerText = "📅 " + (dict.dateTitle || "Qabul Sanasi:");

      const bToday = document.getElementById("uttBtnDateToday");
      if (bToday) bToday.innerText = dict.todayBtn || "Bugun";

      const bTomorrow = document.getElementById("uttBtnDateTomorrow");
      if (bTomorrow) bTomorrow.innerText = dict.tomorrowBtn || "Ertaga";

      const lblDevice = document.getElementById("uttModalLblDevice");
      if (lblDevice) lblDevice.innerText = dict.deviceTargetTitle || "Qurilma / Xonani tanlang:";

      if (devSelect) {
        const curVal = devSelect.value;
        devSelect.innerHTML = dynamicDevices.map(d => {
          const tRoom = (typeof formatRoomWithOriginal === 'function') ? formatRoomWithOriginal(d.room || d.name, d.name, lang) : (d.room || d.name);
          return `<option value="${d.id}" ${d.id === curVal ? 'selected' : ''}>${escapeHtml(tRoom)} - [${dict.statusWaiting || 'Navbatda'}: ${deviceQueues[d.id] || 0}]</option>`;
        }).join("");
      }

      const lblTimeMode = document.getElementById("uttModalLblTimeMode");
      if (lblTimeMode) lblTimeMode.innerText = "⏰ " + (dict.timeModeTitle || "Qabul Vaqtini Belgilash:");

      const lblModeAuto = document.getElementById("uttModalLblModeAuto");
      if (lblModeAuto) lblModeAuto.innerText = dict.modeAuto || "⚡ Eng yaqin avtomatik vaqt";

      const lblModeCustom = document.getElementById("uttModalLblModeCustom");
      if (lblModeCustom) lblModeCustom.innerText = dict.modeCustom || "🕒 Ixtiyoriy vaqt (Bemor iltimosiga ko'ra)";

      const lblStartTime = document.getElementById("uttModalLblStartTime");
      if (lblStartTime) lblStartTime.innerText = dict.customStartTime || "Boshlanish vaqti:";

      const lblInterval = document.getElementById("uttModalLblInterval");
      if (lblInterval) lblInterval.innerText = dict.customEndTime || "Oraliq:";

      const lblDefer = document.getElementById("uttModalLblDefer");
      if (lblDefer) lblDefer.innerText = dict.deferReasonTitle || "⚠️ Eng yaqin vaqtdan vos kechish sababi:";

      const deferSel = document.getElementById("uttDeferReasonSelect");
      if (deferSel) {
        const curDefer = deferSel.value;
        const origReasons = [
          "Bemorning shaxsiy iltimosi / Vaqti to'g'ri kelmadi",
          "Bemor tayyorgarlik ko'rishga ulgurmaydi (och qorin / tahlillar topshirish)",
          "Uzoqdan / viloyatdan yo'lda kelmoqda",
          "Boshqa shifokor ko'rigi yoki boshqa muolajasi bor",
          "Boshqa sabab"
        ];
        deferSel.innerHTML = origReasons.map(r => {
          const trans = (r === "Boshqa sabab") ? (lang === 'ru' ? 'Другая причина (вручную)...' : (lang === 'en' ? 'Other reason (manual)...' : (lang === 'tr' ? 'Diğer gerekçe (elle)...' : (lang === 'kk' ? 'Басқа себеп...' : (lang === 'tg' ? 'Сабаби дигар...' : "Boshqa sabab (qo'lda yozish)..."))))) : translateDeferReason(r, lang);
          return `<option value="${r}" ${r === curDefer ? 'selected' : ''}>${escapeHtml(trans)}</option>`;
        }).join("");
      }

      const deferOther = document.getElementById("uttDeferReasonOther");
      if (deferOther) deferOther.placeholder = dict.deferReasonOtherPlaceholder || "Sababni batafsil yozing...";

      const lblDocLang = document.getElementById("uttModalLblDocLang");
      if (lblDocLang) lblDocLang.innerText = dict.docLangTitle || "🌐 Hujjat / Chop Etish Tili (Language):";

      const lblTicket = document.getElementById("uttModalLblTicket");
      if (lblTicket) lblTicket.innerText = dict.ticket80mm || "🎫 Talon (80mm)";

      const lblConsent = document.getElementById("uttModalLblConsent");
      if (lblConsent) lblConsent.innerText = dict.consentA4 || "📋 Rozilik anketasi (A4)";

      const bCancel = document.getElementById("uttBtnCancel");
      if (bCancel) bCancel.innerText = dict.cancelBtn || "Bekor qilish";

      const bSend = document.getElementById("uttBtnSend");
      if (bSend) bSend.innerText = dict.submitBtn || "Navbatga Yozish & Chop Etish";
    }

    // Dastlabki tanlangan tilni belgilash va tarjima qilish
    updateSendModalI18nLabels(chosenDocLang);

    overlay.querySelectorAll(".utt-btn-send-lang").forEach(b => {
      if (b.getAttribute("data-lang") === chosenDocLang) {
        b.style.background = "#0284c7";
        b.style.color = "#fff";
        b.style.borderColor = "#0284c7";
      } else {
        b.style.background = "#fff";
        b.style.color = "#334155";
        b.style.borderColor = "#cbd5e1";
      }
      b.onclick = () => {
        chosenDocLang = b.getAttribute("data-lang");
        overlay.querySelectorAll(".utt-btn-send-lang").forEach(other => {
          other.style.background = "#fff";
          other.style.color = "#334155";
          other.style.borderColor = "#cbd5e1";
        });
        b.style.background = "#0284c7";
        b.style.color = "#fff";
        b.style.borderColor = "#0284c7";
        const lbl = document.getElementById("uttSendSelectedLangLabel");
        if (lbl) lbl.innerText = langNames[chosenDocLang] || chosenDocLang;
        updateSendModalI18nLabels(chosenDocLang);
      };
    });

    // Modalni yopish funksiyasi (barcha joyda bir xil ishlaydi)
    function closeModal() {
      document.removeEventListener("keydown", handleModalKeydown);
      if (overlay && overlay.parentNode) {
        overlay.remove();
      }
    }

    function handleModalKeydown(e) {
      if (e.key === "Escape") {
        closeModal();
      }
    }

    document.addEventListener("keydown", handleModalKeydown);

    if (modalClose) modalClose.onclick = closeModal;
    if (btnCancel) btnCancel.onclick = closeModal;
    overlay.onclick = (e) => {
      if (e.target === overlay) closeModal();
    };

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
        const sTitle = document.getElementById("uttModalServiceTitle");
        if (sTitle) {
          sTitle.innerText = (typeof formatServiceNameWithOriginal === 'function')
            ? formatServiceNameWithOriginal(activeServiceInfo.service, chosenDocLang)
            : activeServiceInfo.service;
        }
        const durVal = document.getElementById("uttModalDurationVal");
        if (durVal) {
          const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[chosenDocLang]) ? I18N_TRANSLATIONS.ext[chosenDocLang] : {};
          durVal.innerHTML = `⏱ ${activeServiceInfo.duration} ${dict.durationMin || 'daqiqa'} (${activeServiceInfo.contrastLabel}) <small style="color:#64748b; font-size:11px;">[${activeServiceInfo.calcMethod || ''}]</small>`;
        }

        const prepBox = document.getElementById("uttModalPrepBox");
        const prepText = document.getElementById("uttModalPrepText");
        if (prepBox && prepText) {
          if (activeServiceInfo.preparation) {
            prepText.innerText = activeServiceInfo.preparation;
            prepBox.style.display = "block";
          } else {
            prepBox.style.display = "none";
          }
        }

        const contraBox = document.getElementById("uttModalContraBox");
        const contraText = document.getElementById("uttModalContraText");
        if (contraBox && contraText) {
          if (activeServiceInfo.contraindications) {
            contraText.innerText = activeServiceInfo.contraindications;
            contraBox.style.display = "block";
          } else {
            contraBox.style.display = "none";
          }
        }

        // Qurilma turini moslashtirish (agar MSKT/MRT o'zgarsa)
        const matchingDevices = dynamicDevices.filter(d => d.type === activeServiceInfo.type);
        if (matchingDevices.length > 0 && devSelect) {
          devSelect.value = activeServiceInfo.recommendedDevice.id;
        }

        evaluateModalTimeSlot();
      });
    });

    async function evaluateModalTimeSlot() {
      try {
        selectedDate = dateInput ? (dateInput.value || todayStr) : todayStr;
        selectedMode = (modeCustom && modeCustom.checked) ? "custom" : "auto";
        const currentDur = activeServiceInfo.duration || 30;

        // 1. Dam olish kuni yoki bayram tekshiruvi
        const effDay = getDayEffectiveSchedule(selectedDate, currentWorkSchedule, calendarExceptions);
        if (!effDay.enabled) {
          isModalSlotValid = false;
          if (slotAlert) {
            slotAlert.style.background = "#fee2e2";
            slotAlert.style.color = "#b91c1c";
            slotAlert.innerHTML = `❌ <strong>Dam olish kuni / Bayram!</strong> Tanlangan sana (${selectedDate} - ${effDay.title || effDay.name}) dam olish kuni hisoblanadi. Navbat berish taqiqlangan!`;
          }
          if (btnSend) btnSend.disabled = true;
          return;
        }

        // 2. O'tgan sana tekshiruvi
        if (selectedDate < todayStr) {
          isModalSlotValid = false;
          if (slotAlert) {
            slotAlert.style.background = "#fee2e2";
            slotAlert.style.color = "#b91c1c";
            slotAlert.innerHTML = `❌ <strong>O'tgan sana!</strong> O'tib ketgan kunga (${selectedDate}) navbat yozish mumkin emas!`;
          }
          if (btnSend) btnSend.disabled = true;
          return;
        }

        // 3. So'rov sanasi va muddati tekshiruvi (10 kunlik / sozlangan muddat)
        const refDateStr = patientData.referralDate || patientData.rowDate;
        const refValidity = checkReferralDateValidity(refDateStr, selectedDate);
        if (!refValidity.isValid) {
          isModalSlotValid = false;
          if (slotAlert) {
            slotAlert.style.background = "#fee2e2";
            slotAlert.style.color = "#b91c1c";
            const customExpMsg = (globalGuidelines && globalGuidelines.referralRules && globalGuidelines.referralRules.expiredReferralMessage)
              ? globalGuidelines.referralRules.expiredReferralMessage
              : "Sizni qaytadan yo'naltirish kerak, eski so'rov bilan navbatga qo'yib bo'lmaydi. Yangi so'rovni vrachingiz kiritib bersin.";
            slotAlert.innerHTML = `❌ <strong>So'rov muddati o'tgan!</strong> (${refValidity.diffDays} kun oldin: ${refDateStr} | Me'yor: ${refValidity.maxDays} kun).<br>${escapeHtml(customExpMsg)}`;
          }
          if (btnSend) btnSend.disabled = true;
          return;
        }

        const devId = devSelect ? devSelect.value : (dynamicDevices[0] ? dynamicDevices[0].id : "");

        // Firebase-dan tanlangan sana bemorlarini olish
        let dayPatients = [];
        try {
          const res = await safeFetch(`${FIREBASE_DB_URL}/patients/${selectedDate}.json`, {}, 2500);
          if (res && res.ok) {
            const data = await res.json();
            if (data) {
              dayPatients = Object.keys(data).map(k => ({ id: k, ...data[k] }));
            }
          }
        } catch (e) {}

        const devPatients = dayPatients.filter(p => p.doctorId === devId && p.status !== "cancelled");

        if (selectedMode === "auto") {
          if (customTimeContainer) customTimeContainer.style.display = "none";
          currentSlotData = calculateNextAvailableSlotFromList(devPatients, currentDur, selectedDate, currentWorkSchedule);

          if (currentSlotData.error) {
            isModalSlotValid = false;
            if (slotAlert) {
              slotAlert.style.background = "#fee2e2";
              slotAlert.style.color = "#b91c1c";
              slotAlert.innerHTML = `❌ <strong>DIQQAT:</strong> ${escapeHtml(currentSlotData.error)}`;
            }
            if (btnSend) btnSend.disabled = true;
            return;
          }

          isModalSlotValid = true;

          if (slotAlert) {
            slotAlert.style.background = "#dcfce7";
            slotAlert.style.color = "#15803d";
            slotAlert.innerHTML = `✅ <strong>Eng yaqin bo'sh vaqt:</strong> ${currentSlotData.slotString} (${selectedDate === todayStr ? 'Bugun' : selectedDate} - ${effDay.title || effDay.name})`;
          }
          if (btnSend) btnSend.disabled = false;

          if (deferReasonBox) {
            deferReasonBox.style.display = (selectedDate !== todayStr) ? "block" : "none";
          }
        } else {
          if (customTimeContainer) customTimeContainer.style.display = "block";
          const startTime = customStartTimeInput ? (customStartTimeInput.value || "08:00") : "08:00";
          const startMin = timeToMinutes(startTime);
          const endMin = startMin + currentDur;
          const endTime = addMinutesToTime(startTime, currentDur);
          const slotStr = `${startTime} - ${endTime}`;

          const calcSlotEl = document.getElementById("uttCustomCalcSlot");
          if (calcSlotEl) calcSlotEl.innerText = slotStr;

          // Bugun bo'lsa -> o'tgan vaqt tekshiruvi
          if (selectedDate === todayStr) {
            const now = new Date();
            const curMin = now.getHours() * 60 + now.getMinutes();
            if (startMin < curMin) {
              isModalSlotValid = false;
              if (slotAlert) {
                slotAlert.style.background = "#fee2e2";
                slotAlert.style.color = "#b91c1c";
                slotAlert.innerHTML = `❌ <strong>O'tib ketgan vaqt!</strong> Tanlangan vaqt (${startTime}) joriy vaqtdan (${minutesToTime(curMin)}) oldinda. O'tgan soatlarga navbat yozib bo'lmaydi!`;
              }
              if (btnSend) btnSend.disabled = true;
              return;
            }
          }

          // Ish vaqti doirasi tekshiruvi
          const startWorkMin = timeToMinutes(effDay.start || "08:00");
          const endWorkMin = timeToMinutes(effDay.end || "19:30");
          if (startMin < startWorkMin || endMin > endWorkMin) {
            isModalSlotValid = false;
            if (slotAlert) {
              slotAlert.style.background = "#fee2e2";
              slotAlert.style.color = "#b91c1c";
              slotAlert.innerHTML = `❌ <strong>Ish vaqtidan tashqari!</strong> ${effDay.title || effDay.name} kunida qabul faqat ish soatlari (${effDay.start || '08:00'} - ${effDay.end || '19:30'}) orasida bo'lishi shart!`;
            }
            if (btnSend) btnSend.disabled = true;
            return;
          }

          // To'qnashuvni tekshirish
          const conflict = checkSlotConflict(devPatients, startMin, endMin);
          if (conflict.hasConflict) {
            isModalSlotValid = false;
            if (slotAlert) {
              slotAlert.style.background = "#fee2e2";
              slotAlert.style.color = "#b91c1c";
              slotAlert.innerHTML = `❌ <strong>Bu vaqt BAND:</strong> ${escapeHtml(conflict.conflictingPatient.name || conflict.conflictingPatient.ticketId)} (${escapeHtml(conflict.conflictTime)}). Iltimos, boshqa vaqt tanlang!`;
            }
            if (btnSend) btnSend.disabled = true;
          } else {
            isModalSlotValid = true;
            currentSlotData = { startTime, endTime, slotString: slotStr };
            if (slotAlert) {
              slotAlert.style.background = "#dcfce7";
              slotAlert.style.color = "#15803d";
              slotAlert.innerHTML = `✅ <strong>Ushbu vaqt BO'SH!</strong> (${slotStr} - ${effDay.title || effDay.name})`;
            }
            if (btnSend) btnSend.disabled = false;
          }

          if (deferReasonBox) {
            deferReasonBox.style.display = "block";
          }
        }
      } catch (err) {
        console.error("evaluateModalTimeSlot error:", err);
        if (slotAlert) {
          slotAlert.style.background = "#fee2e2";
          slotAlert.style.color = "#b91c1c";
          slotAlert.innerHTML = `⚠️ Vaqtni hisoblashda xatolik: ${escapeHtml(err.message || String(err))}`;
        }
      }
    }

    if (btnToday) {
      btnToday.onclick = () => {
        if (dateInput) dateInput.value = todayStr;
        btnToday.style.background = "#0284c7";
        btnToday.style.color = "#fff";
        if (btnTomorrow) {
          btnTomorrow.style.background = "#fff";
          btnTomorrow.style.color = "#334155";
        }
        evaluateModalTimeSlot();
      };
    }

    if (btnTomorrow) {
      btnTomorrow.onclick = () => {
        if (dateInput) dateInput.value = tomorrowStr;
        btnTomorrow.style.background = "#0284c7";
        btnTomorrow.style.color = "#fff";
        if (btnToday) {
          btnToday.style.background = "#fff";
          btnToday.style.color = "#334155";
        }
        evaluateModalTimeSlot();
      };
    }

    if (dateInput) {
      dateInput.onchange = () => {
        if (btnToday) {
          btnToday.style.background = dateInput.value === todayStr ? "#0284c7" : "#fff";
          btnToday.style.color = dateInput.value === todayStr ? "#fff" : "#334155";
        }
        if (btnTomorrow) {
          btnTomorrow.style.background = dateInput.value === tomorrowStr ? "#0284c7" : "#fff";
          btnTomorrow.style.color = dateInput.value === tomorrowStr ? "#fff" : "#334155";
        }
        evaluateModalTimeSlot();
      };
    }

    if (devSelect) devSelect.onchange = () => evaluateModalTimeSlot();
    if (modeAuto) modeAuto.onchange = () => evaluateModalTimeSlot();
    if (modeCustom) modeCustom.onchange = () => evaluateModalTimeSlot();
    if (customStartTimeInput) customStartTimeInput.oninput = () => evaluateModalTimeSlot();

    if (deferReasonSelect) {
      deferReasonSelect.onchange = function() {
        if (deferReasonOther) {
          if (this.value === "Boshqa sabab") {
            deferReasonOther.style.display = "block";
            deferReasonOther.focus();
          } else {
            deferReasonOther.style.display = "none";
          }
        }
      };
    }

    // Dastlabki hisoblash
    evaluateModalTimeSlot();

    if (btnSend) {
      btnSend.onclick = () => {
        try {
          if (!isModalSlotValid || !currentSlotData) {
            alert("⚠️ Iltimos, bo'sh va qoidaga mos vaqtni tanlang!");
            return;
          }

          const selectedDevId = devSelect ? devSelect.value : "";
          const selectedDev = dynamicDevices.find(d => d.id === selectedDevId) || dynamicDevices[0] || DEFAULT_DEVICES[0];

          let deferReason = "";
          if (selectedDate !== todayStr || selectedMode === "custom") {
            const rSel = deferReasonSelect ? deferReasonSelect.value : "";
            const rOth = deferReasonOther ? deferReasonOther.value.trim() : "";
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

          const autoTicket = document.getElementById("uttCheckAutoTicket") ? document.getElementById("uttCheckAutoTicket").checked : true;
          const autoConsent = document.getElementById("uttCheckAutoConsent") ? document.getElementById("uttCheckAutoConsent").checked : false;

          sendPatientToFirebase(finalPatientPayload, selectedDev, currentSlotData, selectedDate, deferReason, chosenDocLang, autoTicket, autoConsent);
          closeModal();
        } catch (e) {
          console.error("send error:", e);
        }
      };
    }
  } catch (e) {
    console.error("openSendModal top error:", e);
  }
}

function calculateNextAvailableSlotFromList(devPatients, duration, targetDate = null, schedule = null) {
  return findEarliestFreeSlot(devPatients, duration, targetDate, schedule);
}

// OCHIQ VAQTLAR (GAP) NI TEKSHIRIB ENG YAQUIN BO'SH VAQTNI TOPISH
function findEarliestFreeSlot(devPatients, duration, targetDate = null, schedule = null) {
  const dur = parseInt(duration, 10) || 30;
  const cfg = schedule || currentWorkSchedule || DEFAULT_WORK_SCHEDULE;

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const checkDate = targetDate || todayStr;

  // 1. Tanlangan sananing aniq va amaldagi ish grafigini aniqlash (bayram / maxsus kunlarni hisobga olgan holda)
  const effDay = getDayEffectiveSchedule(checkDate, cfg, calendarExceptions);

  // Dam olish kuni yoki bayram tekshiruvi
  if (!effDay.enabled) {
    return {
      error: `Tanlangan sana (${checkDate} - ${effDay.title || effDay.name}) dam olish kuni hisoblanadi. Navbat berish taqiqlangan!`,
      isOffDay: true
    };
  }

  // 2. O'tgan sana tekshiruvi
  if (checkDate < todayStr) {
    return {
      error: `O'tib ketgan kunga (${checkDate}) navbat yozish mumkin emas!`,
      isPastDate: true
    };
  }

  const startWorkMin = timeToMinutes(effDay.start || "08:00");
  const endWorkMin = timeToMinutes(effDay.end || "19:30");

  // 3. Bugungi kun bo'lsa -> Hozirgi vaqtdan boshlab qidirish
  let searchStartMin = startWorkMin;
  if (checkDate === todayStr) {
    const curNowMin = now.getHours() * 60 + now.getMinutes();
    const roundedNowMin = Math.ceil(curNowMin / 5) * 5;
    searchStartMin = Math.max(startWorkMin, roundedNowMin);
  }

  if (searchStartMin + dur > endWorkMin) {
    return {
      error: `Bugungi ish vaqti (${effDay.title || effDay.name}: ${effDay.end || "19:30"}) tugagan yoki qolgan vaqt yetarli emas! Keyingi ish kunini tanlang.`,
      isWorkEnded: true
    };
  }

  // 4. Faol bemorlarning vaqt oraliqlarini olish
  const activeIntervals = [];
  for (const p of (devPatients || [])) {
    if (p.status === "cancelled" || p.isOutOfQueue || p.isRecheck || (p.scheduledTime && p.scheduledTime.includes("Navbatdan tashqari"))) continue;
    const pStartStr = p.scheduledTime || p.time;
    if (!pStartStr) continue;

    const pStart = timeToMinutes(pStartStr);
    const pDur = parseInt(p.duration, 10) || 30;
    const pEnd = p.endTime ? timeToMinutes(p.endTime) : (pStart + pDur);

    if (pEnd > pStart) {
      activeIntervals.push({ start: pStart, end: pEnd, patient: p });
    }
  }

  // Agar navbatda bemor bo'lmasa -> searchStartMin dan boshlanadi
  if (activeIntervals.length === 0) {
    const endMin = searchStartMin + dur;
    return {
      startTime: minutesToTime(searchStartMin),
      endTime: minutesToTime(endMin),
      slotString: `${minutesToTime(searchStartMin)} - ${minutesToTime(endMin)}`
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

  // 5. searchStartMin dan birinchi band bemorgacha bo'sh oraliqqa sig'adimi?
  if (busyBlocks[0].start - searchStartMin >= dur) {
    const endMin = searchStartMin + dur;
    return {
      startTime: minutesToTime(searchStartMin),
      endTime: minutesToTime(endMin),
      slotString: `${minutesToTime(searchStartMin)} - ${minutesToTime(endMin)}`
    };
  }

  // 6. Oraliqlarda ochiq qolgan (bo'sh) vaqtlarga sig'adimi?
  for (let i = 0; i < busyBlocks.length - 1; i++) {
    const gapStart = Math.max(searchStartMin, busyBlocks[i].end);
    const gapEnd = busyBlocks[i + 1].start;
    if (gapEnd - gapStart >= dur && gapStart + dur <= endWorkMin) {
      const endMin = gapStart + dur;
      return {
        startTime: minutesToTime(gapStart),
        endTime: minutesToTime(endMin),
        slotString: `${minutesToTime(gapStart)} - ${minutesToTime(endMin)}`
      };
    }
  }

  // 7. Oxirgi band oraliqdan keyinga yozish
  const lastBlockEnd = Math.max(searchStartMin, busyBlocks[busyBlocks.length - 1].end);
  const finalEnd = lastBlockEnd + dur;

  if (finalEnd <= endWorkMin) {
    return {
      startTime: minutesToTime(lastBlockEnd),
      endTime: minutesToTime(finalEnd),
      slotString: `${minutesToTime(lastBlockEnd)} - ${minutesToTime(finalEnd)}`
    };
  }

  return {
    error: `Ushbu kunga barcha navbatlar to'lgan (${dayCfg.name} ish soatlari: ${dayCfg.start} - ${dayCfg.end}). Keyingi ish kunini tanlang!`,
    isFull: true
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
async function sendPatientToFirebase(patientData, device, timeSlot, targetDate = null, deferReason = "", printLang = "uz", autoTicket = true, autoConsent = false) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  const saveDate = targetDate || todayStr;
  const chosenLang = printLang || (typeof getI18nLanguage === 'function' ? getI18nLanguage() : 'uz') || 'uz';

  // 1. QAT'IY TAKRORIY NAVBAT TEKSHIRUVI (NAMUNA RAQAMI BO'YICHA):
  if (patientData.sampleNumber) {
    const existing = await checkExistingQueueBySample(patientData.sampleNumber, patientData.id);
    if (existing) {
      showToast(`⚠️ Ushbu namuna (№${patientData.sampleNumber}) allaqachon navbatga qo'yilgan! Talon qayta chop etilmoqda...`, "warning");
      printThermalTicketDirect(existing, chosenLang);
      return;
    }
  }

  const slot = timeSlot || await calculateNextAvailableTimeSlot(device.id, patientData.duration || 30);

  const payload = {
    ticketId: patientData.id,
    name: patientData.name,
    surname: patientData.surname || "",
    firstName: patientData.firstName || "",
    middleName: patientData.middleName || "",
    sampleNumber: patientData.sampleNumber || "",
    birthDate: patientData.birthDate || "",
    pinfl: patientData.pinfl || "",
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
    printLang: chosenLang,
    operatorLogin: currentUser ? currentUser.login : "TB1",
    operatorName: currentUser ? currentUser.name : "Operator",
    registeredBy: currentUser ? `${currentUser.login} - ${currentUser.name}` : "TB1 - Turatov Hojiakbar",
    notes: "Kardelen orqali yozildi" + (deferReason ? ` [Sabab: ${deferReason}]` : "") + (patientData.sampleNumber ? ` [Namuna: ${patientData.sampleNumber}]` : ""),
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
      const extDict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext && I18N_TRANSLATIONS.ext[chosenLang]) 
        ? I18N_TRANSLATIONS.ext[chosenLang] 
        : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ext) ? I18N_TRANSLATIONS.ext['uz'] : {});
      const toastMsg = (extDict.bookingSuccess || "✅ {name} {device}ga soat {slot} ({date}) vaqtiga yozildi!")
        .replace('{name}', patientData.name)
        .replace('{device}', device.name)
        .replace('{slot}', slot.slotString)
        .replace('{date}', saveDate);
      showToast(toastMsg);
      fetchDeviceQueueCounts().catch(() => {});
      calculateTodayOperatorStats().catch(() => {});
      if (autoTicket) {
        printThermalTicketDirect(payload, chosenLang);
      }
      if (autoConsent) {
        setTimeout(() => {
          printConsentFormDirect(payload, chosenLang);
        }, autoTicket ? 900 : 100);
      }
    } else {
      showToast("⚠️ Bemor navbatga olindi.");
      if (autoTicket) printThermalTicketDirect(payload, chosenLang);
    }
  } catch (err) {
    showToast("⚠️ Xatolik yuz berdi: " + err.message);
  }
}

// 13.9 SAVOLLARNI KO'P TILLI TARJIMA QILISH YORDAMCHISI
function translateQuestionsList(questions, lang) {
  if (!questions || !Array.isArray(questions)) return [];
  if (!lang || lang === 'uz') return questions;

  const qMap = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.questions) ? I18N_TRANSLATIONS.questions : {};

  return questions.map(q => {
    const qLower = q.toLowerCase();
    if (qLower.includes("kardiostimulyator") || qLower.includes("yurak stimulyatori") || qLower.includes("defibrillyator")) {
      return (qMap.pacemaker && qMap.pacemaker[lang]) ? qMap.pacemaker[lang] : q;
    }
    if (qLower.includes("metall implant") || qLower.includes("sun‘iy bo‘g‘im") || qLower.includes("plastinka") || qLower.includes("vint")) {
      return (qMap.metalImplants && qMap.metalImplants[lang]) ? qMap.metalImplants[lang] : q;
    }
    if (qLower.includes("klavstrofobiya") || qLower.includes("yopiq fazo")) {
      return (qMap.claustrophobia && qMap.claustrophobia[lang]) ? qMap.claustrophobia[lang] : q;
    }
    if (qLower.includes("homiladorlik") || qLower.includes("emizikli")) {
      return (qMap.pregnancy && qMap.pregnancy[lang]) ? qMap.pregnancy[lang] : q;
    }
    if (qLower.includes("allergiya") || qLower.includes("yodga") || qLower.includes("kontrast modda")) {
      return (qMap.allergy && qMap.allergy[lang]) ? qMap.allergy[lang] : q;
    }
    if (qLower.includes("buyrak yetishmovchiligi") || qLower.includes("gemodializ")) {
      return (qMap.kidney && qMap.kidney[lang]) ? qMap.kidney[lang] : q;
    }
    if (qLower.includes("astma") || qLower.includes("diabet") || qLower.includes("qalqonsimon bez")) {
      return (qMap.asthmaDiabetes && qMap.asthmaDiabetes[lang]) ? qMap.asthmaDiabetes[lang] : q;
    }
    if (qLower.includes("eshitish apparati") || qLower.includes("tish protez") || qLower.includes("tatuirovka")) {
      return (qMap.hearingDental && qMap.hearingDental[lang]) ? qMap.hearingDental[lang] : q;
    }
    if (qLower.includes("och qol") || qLower.includes("och qorin")) {
      return (qMap.abdominalFasting && qMap.abdominalFasting[lang]) ? qMap.abdominalFasting[lang] : q;
    }
    if (qLower.includes("qovuq") || qLower.includes("suv ich")) {
      return (qMap.pelvicBladder && qMap.pelvicBladder[lang]) ? qMap.pelvicBladder[lang] : q;
    }
    return q;
  });
}

// 14. XPRINTER TALONI CHOP ETISH (KO'P TILLI: UZ, RU, EN, KK, TG, TR)
function printThermalTicketDirect(payload, lang) {
  try {
    const L = lang || payload.printLang || (typeof getI18nLanguage === 'function' ? getI18nLanguage() : 'uz') || 'uz';
    const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket && I18N_TRANSLATIONS.ticket[L]) 
      ? I18N_TRANSLATIONS.ticket[L] 
      : (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket ? I18N_TRANSLATIONS.ticket['uz'] : null);

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

    const centerTitle = dict ? dict.centerName : "ONKOLOGIYA VA RADIOLOGIYA MARKAZI";
    const subTitle = dict ? dict.ticketTitle : "Elektron Navbat Taloni";
    const lblPatient = dict ? dict.patient : "Bemor";
    const lblPatientType = dict ? dict.patientType : "Bemor Toifasi";
    const valPatientType = payload.patientType === "Bo'limda yotibdi" 
      ? `${dict ? dict.stationary : "🏥 Bo'limda yotibdi"} ${payload.department ? `(${escapeHtml(payload.department)})` : ''}` 
      : (dict ? dict.ambulatory : "🏠 Uyidan qatnaydi");
    const lblReferringDoc = dict ? dict.referringDoctor : "Fayl Shifokori";
    const lblRoomDevice = dict ? dict.roomDevice : "Qurilma / Xona";
    const lblService = dict ? dict.service : "Tekshiruv";
    const lblBookedTime = dict ? dict.bookedTime : "BAND QILINGAN QABUL VAQTI:";
    const lblAppDate = dict ? dict.appointmentDate : "Qabul Sanasi";
    const lblOperator = dict ? dict.operator : "Ro'yxatga oluvchi";
    const timeNotice = dict ? dict.timeNotice : "Iltimos, 30-40 minut oldin MRT & MSKT kutish joyida bo'ling va kelganingiz haqida ro'yxatchilardan birini ogohlantiring!";
    const footerThanks = dict ? dict.footerThanks : "Salomat bo'ling!";

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Talon - ${payload.ticketId}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, Roboto, sans-serif;
            width: 76mm;
            margin: 0 auto;
            padding: 8px 4px;
            color: #000 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .center { text-align: center; }
          .header { font-size: 16px; font-weight: 900; text-transform: uppercase; margin-bottom: 2px; color: #000 !important; letter-spacing: 0.5px; }
          .sub-header { font-size: 13px; font-weight: 700; margin-bottom: 6px; color: #000 !important; }
          .divider { border-top: 2px dashed #000; margin: 8px 0; }
          .ticket-id { font-size: 38px; font-weight: 900; letter-spacing: 2px; margin: 6px 0; color: #000 !important; border: 2px solid #000; border-radius: 8px; padding: 4px 8px; }
          .row { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; font-weight: 700; margin-bottom: 5px; line-height: 1.3; color: #000 !important; }
          .label { color: #000 !important; font-size: 13px; font-weight: 700; }
          .val { font-weight: 900; text-align: right; max-width: 65%; color: #000 !important; word-break: break-word; }
          .slot-box {
            border: 2px solid #000;
            border-radius: 6px;
            padding: 8px 6px;
            margin: 8px 0;
            text-align: center;
            background: #fff;
          }
          .slot-title { font-size: 12px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; color: #000 !important; }
          .slot-time { font-size: 24px; font-weight: 900; margin-top: 3px; color: #000 !important; }
          .guide-box {
            border: 2px solid #000;
            border-radius: 4px;
            padding: 6px 8px;
            margin-bottom: 6px;
            font-size: 12px;
            font-weight: 700;
            line-height: 1.3;
            text-align: left;
            color: #000 !important;
          }
          .guide-svc-title {
            font-weight: 900;
            border-bottom: 2px dashed #000;
            padding-bottom: 3px;
            margin-bottom: 3px;
            font-size: 12px;
            color: #000 !important;
          }
          .footer { font-size: 12px; font-weight: 700; text-align: center; margin-top: 8px; line-height: 1.35; color: #000 !important; }
        </style>
      </head>
      <body>
        <div class="center header">${escapeHtml(centerTitle)}</div>
        <div class="center sub-header">${escapeHtml(subTitle)}</div>
        <div class="divider"></div>

        <div class="center ticket-id">${escapeHtml(payload.ticketId)}</div>

        <div class="row">
          <span class="label">${escapeHtml(lblPatient)}:</span>
          <span class="val" style="font-size:15px;">${escapeHtml(payload.name)}</span>
        </div>

        ${payload.sampleNumber ? `
          <div class="row">
            <span class="label">Namuna №:</span>
            <span class="val" style="font-size:14px; font-weight:900;">${escapeHtml(payload.sampleNumber)}</span>
          </div>
        ` : ''}

        ${payload.birthDate ? `
          <div class="row">
            <span class="label">Tug'ilgan sana:</span>
            <span class="val">${escapeHtml(payload.birthDate)}</span>
          </div>
        ` : ''}

        ${payload.pinfl ? `
          <div class="row">
            <span class="label">JSHSHIR (PINFL):</span>
            <span class="val" style="font-family:monospace; font-size:13px; font-weight:900;">${escapeHtml(payload.pinfl)}</span>
          </div>
        ` : ''}

        <div class="row">
          <span class="label">${escapeHtml(lblPatientType)}:</span>
          <span class="val">${valPatientType}</span>
        </div>

        ${payload.referringDoctor ? `
          <div class="row">
            <span class="label">${escapeHtml(lblReferringDoc)}:</span>
            <span class="val">${escapeHtml(payload.referringDoctor)}</span>
          </div>
        ` : ''}

        <div class="row">
          <span class="label">${escapeHtml(lblRoomDevice)}:</span>
          <span class="val">${escapeHtml((typeof formatRoomWithOriginal === 'function') ? formatRoomWithOriginal(payload.room, payload.doctorName, L) : `${payload.room || '-'} (${payload.doctorName || '-'})`)}</span>
        </div>

        <div class="row">
          <span class="label">${escapeHtml(lblService)}:</span>
          <span class="val">${escapeHtml((typeof formatServiceNameWithOriginal === 'function') ? formatServiceNameWithOriginal(payload.service, L) : payload.service)} ${payload.isContrast ? (dict ? dict.contrastBadge : '[KONTRASTLI]') : ''}</span>
        </div>

        <div class="slot-box">
          <div class="slot-title">${escapeHtml(lblBookedTime)}</div>
          <div class="slot-time">${escapeHtml(payload.timeSlot || payload.scheduledTime)}</div>
        </div>

        <div class="row">
          <span class="label">${escapeHtml(lblAppDate)}:</span>
          <span class="val" style="color:#000; font-weight:900; font-size:14px;">${escapeHtml(payload.appointmentDate || '')}</span>
        </div>

        <div class="row">
          <span class="label">${escapeHtml(lblOperator)}:</span>
          <span class="val">${escapeHtml(payload.registeredBy || payload.operatorLogin)}</span>
        </div>

        ${payload.rescheduleReason ? `
          <div class="row" style="font-size:12px; font-weight:bold; color:#000;">
            <span class="label">${escapeHtml(dict ? dict.reasonLabel : "Sabab:")}</span>
            <span class="val">${escapeHtml((typeof translateDeferReason === 'function') ? translateDeferReason(payload.rescheduleReason, L) : payload.rescheduleReason)}</span>
          </div>
        ` : ''}

        <!-- TEKSHIRUVLAR UCHUN TAYYORGARLIK VA QARSHI KO'RSATMALAR -->
        ${formatConsolidatedGuidelinesHtml(payload, L) ? `
          <div class="divider"></div>
          ${formatConsolidatedGuidelinesHtml(payload, L)}
        ` : ''}

        <div class="divider"></div>
        <div class="footer">
          ${escapeHtml(timeNotice)}<br>
          <strong style="font-size:13px; margin-top:4px; display:inline-block;">${escapeHtml(footerThanks)}</strong>
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
  } catch (e) {
    console.error("Print thermal ticket error:", e);
  }
}

// 14.1 ROZILIK ANKETASINI CHOP ETISH (KO'P TILLI: UZ, RU, EN, KK, TG, TR - A4 FORMATDA)
function printConsentFormDirect(payload, lang) {
  try {
    const L = lang || payload.printLang || (typeof getI18nLanguage === 'function' ? getI18nLanguage() : 'uz') || 'uz';
    const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.consent && I18N_TRANSLATIONS.consent[L])
      ? I18N_TRANSLATIONS.consent[L]
      : (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.consent ? I18N_TRANSLATIONS.consent['uz'] : null);

    const oldIframe = document.getElementById("uttConsentPrintIframe");
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "uttConsentPrintIframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    
    let servicesTitle = "";
    if (payload.servicesList && payload.servicesList.length > 0) {
      servicesTitle = payload.servicesList.map(s => (s.code ? s.code + ' - ' : '') + (s.name || s.fullName)).join(' + ');
    } else {
      servicesTitle = payload.service || 'Tomografiya';
    }

    let examType = "MSKT / MRT";
    const svcUpper = (payload.service || "").toUpperCase();
    const docUpper = (payload.doctorName || payload.room || payload.deviceType || "").toUpperCase();
    if (svcUpper.includes("MSKT") || docUpper.includes("MSKT") || svcUpper.includes("MSCT") || docUpper.includes("MSCT")) {
      examType = "MSKT";
    } else if (svcUpper.includes("MRT") || docUpper.includes("MRT") || svcUpper.includes("MRI") || docUpper.includes("MRI")) {
      examType = "MRT";
    }

    // Savolnomani aniqlash va tanlangan tilga tarjima qilish
    const rawQuestions = consolidateQuestionsForServices(
      payload.servicesList,
      examType,
      payload.isContrast,
      payload.questions
    );
    const customQuestionsList = translateQuestionsList(rawQuestions, L);

    const questionsRowsHtml = customQuestionsList.map((qText, idx) => {
      const cleanQ = qText.replace(/^\d+[\.\)\-]\s*/, '').trim();
      return `
        <tr>
          <td style="text-align:center; font-weight:bold;">${idx + 1}</td>
          <td>${escapeHtml(cleanQ)}</td>
          <td class="check-col">[ &nbsp; ]</td>
          <td class="check-col">[ &nbsp; ]</td>
        </tr>
      `;
    }).join("");

    const typeText = payload.patientType === "Bo'limda yotibdi"
      ? `${dict ? dict.stationary : "Bo'limda yotibdi"} ${payload.department ? `(${payload.department})` : ''}`
      : (dict ? dict.ambulatory : "Uyidan qatnaydi (Ambulator)");

    // 1. Nashr sanasi
    let rawQueueDate = payload.appointmentDate || payload.date || (typeof selectedDate !== 'undefined' ? selectedDate : '') || '';
    let nashrSanasi = "09.04.2026";
    if (rawQueueDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawQueueDate)) {
        const parts = rawQueueDate.split('-');
        nashrSanasi = `${parts[2]}.${parts[1]}.${parts[0]}`;
      } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawQueueDate)) {
        const parts = rawQueueDate.split('/');
        nashrSanasi = `${parts[1]}.${parts[0]}.${parts[2]}`;
      } else if (/^\d{2}\.\d{2}\.\d{4}$/.test(rawQueueDate)) {
        nashrSanasi = rawQueueDate;
      }
    }

    // 2. Ko'rib chiqish sanasi
    const nowPrint = new Date();
    const koribChiqishSanasi = `${String(nowPrint.getDate()).padStart(2, '0')}.${String(nowPrint.getMonth() + 1).padStart(2, '0')}.${nowPrint.getFullYear()}`;

    // 3. Kod No dinamik raqami
    let kodDigits = "";
    if (payload.servicesList && payload.servicesList.length > 0) {
      const extracted = payload.servicesList.map(s => {
        const codeStr = s.code || s.fullName || s.name || "";
        const m = codeStr.match(/R?(\d{2,4})/i);
        return m ? m[1] : null;
      }).filter(Boolean);
      if (extracted.length > 0) {
        kodDigits = extracted.join('/');
      }
    }
    if (!kodDigits) {
      const svcString = (payload.service || "") + " " + (payload.code || "");
      const match = svcString.match(/R?(\d{2,4})/i);
      if (match) {
        kodDigits = match[1];
      }
    }
    const kodNo = `HD.RB.${kodDigits || '292'}`;

    const ministryTitle = dict ? dict.ministryTitle.replace(/\\n/g, '<br>') : "RESPUBLIKA IXTISOSLASHTIRILGAN<br>ONKOLOGIYA VA RADIOLOGIYA<br>ILMIY-AMALIY TIBBIYOT MARKAZI";
    const docTitle = dict ? dict.docTitle.replace('{examType}', examType) : `${examType} TEKSHIRUVINI O‘TKAZISHGA ROZILIK HUJJATI`;
    const declarationText = dict ? dict.declaration.replace(/{examType}/g, examType) : "";

    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rozilik Hujjati - ${escapeHtml(payload.name)}</title>
        <style>
          @page { size: A4 portrait; margin: 8mm 12mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; }
          body { color: #000; padding: 4px; font-size: 12px; line-height: 1.35; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          /* Rasmiy Titul Box */
          .titul-box { border: 1.5px solid #000; margin-bottom: 8px; }
          .titul-grid { display: flex; align-items: center; justify-content: space-between; border-bottom: 1.5px solid #000; padding: 6px 10px; }
          .titul-logo-box { width: 75px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .titul-text { text-align: center; flex-grow: 1; padding: 0 10px; }
          .titul-text h2 { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3px; line-height: 1.25; margin-bottom: 3px; }
          .titul-text h1 { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
          
          .titul-table { width: 100%; border-collapse: collapse; text-align: center; font-size: 11px; }
          .titul-table td { border-right: 1.5px solid #000; padding: 4px 4px; line-height: 1.2; }
          .titul-table td:last-child { border-right: none; }
          
          .section-title { font-size: 11.5px; font-weight: 900; text-transform: uppercase; background: #f1f5f9; border: 1px solid #000; padding: 3px 6px; margin: 6px 0 4px 0; }
          
          .patient-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11.5px; }
          .patient-table td { border: 1px solid #000; padding: 4px 6px; vertical-align: middle; }
          .patient-table .lbl { font-weight: 700; width: 22%; background: #f8fafc; color: #000; }
          .patient-table .val { font-weight: 800; width: 28%; color: #000; }
          
          .lab-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11.5px; }
          .lab-table td { border: 1px solid #000; padding: 4px 6px; }
          
          .checklist-table { width: 100%; border-collapse: collapse; margin-bottom: 6px; font-size: 11px; }
          .checklist-table th, .checklist-table td { border: 1px solid #000; padding: 3.5px 6px; }
          .checklist-table th { background: #f1f5f9; text-align: left; font-weight: 900; }
          .checklist-table td.check-col { width: 55px; text-align: center; font-weight: 900; font-size: 11.5px; }
          
          .declaration-text { font-size: 10.5px; line-height: 1.35; text-align: justify; margin: 5px 0; border: 1px solid #000; padding: 5px 7px; border-radius: 3px; background: #fafafa; }
          
          .signatures-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11.5px; }
          .signatures-table td { border: none; padding: 3px 4px; vertical-align: top; }
          
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <!-- 1. RASMIY INSTITUTSIONAL TITUL -->
        <div class="titul-box">
          <div class="titul-grid">
            <div class="titul-logo-box">
              <img src="${typeof LOGO_ONKOLOGIYA !== 'undefined' ? LOGO_ONKOLOGIYA : ''}" style="width:72px; height:auto; max-height:72px; object-fit:contain;" alt="Logo">
            </div>
            <div class="titul-text">
              <h2>${ministryTitle}</h2>
              <h1>${escapeHtml(docTitle)}</h1>
            </div>
            <div class="titul-logo-box">
              <img src="${typeof LOGO_SSV !== 'undefined' ? LOGO_SSV : ''}" style="width:72px; height:auto; max-height:72px; object-fit:contain;" alt="Logo">
            </div>
          </div>
          <table class="titul-table">
            <tr>
              <td style="width:20%;"><strong>${escapeHtml(dict ? dict.codeNo : "Kod No:")}</strong><br><strong>${escapeHtml(kodNo)}</strong></td>
              <td style="width:20%;"><strong>${escapeHtml(dict ? dict.publishDate : "Nashr sanasi:")}</strong><br>${escapeHtml(nashrSanasi)}</td>
              <td style="width:20%;"><strong>${escapeHtml(dict ? dict.reviewDate : "Ko‘rib chiqish sanasi:")}</strong><br>${escapeHtml(koribChiqishSanasi)}</td>
              <td style="width:20%;"><strong>${escapeHtml(dict ? dict.examNum : "Tekshiruv raqami:")}</strong><br><strong>${escapeHtml(payload.ticketId || '00000')}</strong></td>
              <td style="width:20%;"><strong>${escapeHtml(dict ? dict.pageCount : "Sahifa/Sahifalar soni:")}</strong><br>1 / 1</td>
            </tr>
          </table>
        </div>

        <!-- 2. BEMOR VA TEKSHIRUV PARAMETRLARI -->
        <table class="patient-table">
          <tr>
            <td class="lbl">${escapeHtml(dict ? dict.patientName : "Bemor F.I.Sh:")}</td>
            <td class="val" colspan="3" style="font-size:13px; font-weight:900;">${escapeHtml(payload.name)}</td>
          </tr>
          <tr>
            <td class="lbl">${escapeHtml(dict ? dict.patientId : "Bemor ID:")}</td>
            <td class="val"><strong>${escapeHtml(payload.ticketId || '-')}</strong></td>
            <td class="lbl">${escapeHtml(dict ? dict.appTime : "Qabul Sanasi & Vaqti:")}</td>
            <td class="val"><strong>${escapeHtml(payload.appointmentDate || '')} | ${escapeHtml(payload.timeSlot || payload.scheduledTime || payload.time || '-')}</strong></td>
          </tr>
          <tr>
            <td class="lbl">${escapeHtml(dict ? dict.patientCategory : "Bemor Toifasi:")}</td>
            <td class="val">${escapeHtml(typeText)}</td>
            <td class="lbl">${escapeHtml(dict ? dict.referringDoc : "Fayl / Yo‘naltirgan shifokor:")}</td>
            <td class="val">${escapeHtml(payload.referringDoctor || '-')}</td>
          </tr>
          <tr>
            <td class="lbl">${escapeHtml(dict ? dict.deviceRoom : "Qurilma / Xona:")}</td>
            <td class="val">${escapeHtml((typeof formatRoomWithOriginal === 'function') ? formatRoomWithOriginal(payload.room, payload.doctorName, L) : `${payload.room || '-'} (${payload.doctorName || '-'})`)}</td>
            <td class="lbl">${escapeHtml(dict ? dict.serviceName : "Tekshiruv Nomi:")}</td>
            <td class="val" style="color:#000;"><strong>${escapeHtml((typeof formatServiceNameWithOriginal === 'function') ? formatServiceNameWithOriginal(servicesTitle, L) : servicesTitle)}</strong> ${payload.isContrast ? `<span style="background:#000; color:#fff; padding:1px 4px; font-size:9.5px; border-radius:3px; margin-left:4px;">${escapeHtml(dict ? dict.contrastTag : "KONTRASTLI")}</span>` : ''}</td>
          </tr>
          <tr>
            <td class="lbl" style="background:#f1f5f9;">${escapeHtml(dict ? dict.height : "Bemor Bo‘yi:")}</td>
            <td class="val" style="font-size:12px;"><strong>________ sm</strong></td>
            <td class="lbl" style="background:#f1f5f9;">${escapeHtml(dict ? dict.weight : "Bemor Vazni:")}</td>
            <td class="val" style="font-size:12px;"><strong>________ kg</strong></td>
          </tr>
        </table>

        <!-- 3. KONTRASTLI TEKSHIRUVLAR UCHUN LABORATORIYA TAHLILLARI -->
        <div class="section-title" style="background:#f8fafc; border:1.5px solid #000;">
          ${escapeHtml(dict ? dict.labTitle : "💉 LABORATORIYA TAHLILLARI (KONTRASTLI TEKSHIRUVLAR UCHUN MAJBURIY):")}
        </div>
        <table class="lab-table">
          <tr>
            <td style="width:34%;"><strong>${escapeHtml(dict ? dict.creatinine : "Qonda Kreatinin miqdori:")}</strong><br><span style="font-size:12.5px; font-weight:900;">________ mkmol/l</span></td>
            <td style="width:33%;"><strong>${escapeHtml(dict ? dict.urea : "Qonda Mochevina (Urea):")}</strong><br><span style="font-size:12.5px; font-weight:900;">________ mmol/l</span></td>
            <td style="width:33%;"><strong>${escapeHtml(dict ? dict.labDate : "Tahlil topshirilgan sana:")}</strong><br><span style="font-size:11.5px; font-weight:700;">«____» ____________ 202__ y.</span></td>
          </tr>
          <tr>
            <td colspan="3" style="font-size:10px; background:#fafafa; line-height:1.25;">
              <em>${escapeHtml(dict ? dict.labNotice : "* Kreatinin normasi: Ayollarda 44–80 mkmol/l, Erkaklarda 62–106 mkmol/l. Qandli diabet bo‘yicha Metformin (Glyukofaj) qabul qiluvchi bemorlar preparatni tekshiruvdan 48 soat oldin to‘xtatishi shart.")}</em>
            </td>
          </tr>
        </table>

        <!-- 4. TIBBIY XAVFSIZLIK SAVOLNOMASI -->
        <div class="section-title">${escapeHtml(dict ? dict.section1 : "I. TIBBIY XAVFSIZLIK VA QARSHI KO‘RSATMALAR SAVOLNOMASI")}</div>
        <table class="checklist-table">
          <thead>
            <tr>
              <th style="width:24px; text-align:center;">№</th>
              <th>${escapeHtml(dict ? dict.criteriaHeader : "Xavfsizlik va tibbiy qarshi ko‘rsatmalar mezoni")}</th>
              <th class="check-col">${escapeHtml(dict ? dict.yes : "HA")}</th>
              <th class="check-col">${escapeHtml(dict ? dict.no : "YO‘Q")}</th>
            </tr>
          </thead>
          <tbody>
            ${questionsRowsHtml}
          </tbody>
        </table>

        <!-- 5. ROZILIK DEKLARATSIYASI -->
        <div class="section-title">${escapeHtml(dict ? dict.section2 : "II. BEMORNING (YOKI QONUNIY VAKILINING) XABARDOR QILINGAN ROZILIGI")}</div>
        <div class="declaration-text">
          ${declarationText}
        </div>

        <!-- 6. IMZOLAR VA TASDIQLASH -->
        <div class="section-title">${escapeHtml(dict ? dict.section3 : "III. TASDIQLASH VA IMZOLAR")}</div>
        <table class="signatures-table" style="width:100%; border-collapse:collapse; margin-top:4px; font-size:11px;">
          <tr>
            <td style="width:50%; border:1px solid #000; padding:4px 6px; vertical-align:top; background:#fff;">
              <strong>${escapeHtml(dict ? dict.sigPatient : "1. Bemor (yoki qonuniy vakili):")}</strong><br>
              ${escapeHtml(dict ? dict.fullName : "F.I.Sh:")} <strong>${escapeHtml(payload.name)}</strong><br><br>
              ${escapeHtml(dict ? dict.signature : "Imzo:")} _____________________ ${escapeHtml(dict ? dict.date : "Sana:")} ______________
            </td>
            <td style="width:50%; border:1px solid #000; padding:4px 6px; vertical-align:top; background:#fff;">
              <strong>${escapeHtml(dict ? dict.sigRegistrar : "2. Ro‘yxatga oluvchi (Registrator):")}</strong><br>
              ${escapeHtml(dict ? dict.fullName : "F.I.Sh:")} <strong>${escapeHtml(payload.registeredBy || payload.operatorLogin || 'Operator')}</strong><br><br>
              ${escapeHtml(dict ? dict.signature : "Imzo:")} _____________________ ${escapeHtml(dict ? dict.date : "Sana:")} ______________
            </td>
          </tr>
          <tr>
            <td style="width:50%; border:1px solid #000; padding:4px 6px; vertical-align:top; background:#fff;">
              <strong>${escapeHtml(dict ? dict.sigLaborant : "3. Rentgen-laborant (Operator):")}</strong><br>
              ${escapeHtml(dict ? dict.fullName : "F.I.Sh:")} _________________________________________<br><br>
              ${escapeHtml(dict ? dict.signature : "Imzo:")} _____________________ ${escapeHtml(dict ? dict.date : "Sana:")} ______________
            </td>
            <td style="width:50%; border:1px solid #000; padding:4px 6px; vertical-align:top; background:#fff;">
              <strong>${escapeHtml(dict ? dict.sigDoctor : "4. Shifokor (Vrach-radiolog):")}</strong><br>
              ${escapeHtml(dict ? dict.fullName : "F.I.Sh:")} _________________________________________<br><br>
              ${escapeHtml(dict ? dict.signature : "Imzo:")} _____________________ ${escapeHtml(dict ? dict.date : "Sana:")} ______________
            </td>
          </tr>
        </table>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error("Iframe print error:", e);
      }
    }, 350);
  } catch (err) {
    console.error("Consent print error:", err);
    showToast("⚠️ Anketa chop etishda xatolik: " + err.message);
  }
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

function formatGuidelineSentencesHtml(rawText) {
  if (!rawText || String(rawText).trim() === '' || String(rawText).trim() === '—') return '';
  const text = String(rawText).trim();
  const rawParts = text.split(/(?:\.(?!\d)|\;|\r?\n)+/);
  const lines = [];
  rawParts.forEach(p => {
    let clean = p.trim().replace(/^[•\-\*]\s*/, '').trim();
    if (clean.length > 0) {
      if (!/[.\?!:;]$/.test(clean)) {
        clean += '.';
      }
      lines.push(clean);
    }
  });
  if (lines.length === 0) return '';
  return lines.map(line => `<div style="margin-top:2px; padding-left:2px;">• ${escapeHtml(line)}</div>`).join('');
}
