let db = null;
let patientsList = [];
let doctorsList = [];
let todayDateStr = "";
let selectedQueueDate = "";
let currentPatientsRef = null;
let laborantsList = [];
let currentRegistrar = null;

// Standart Operatorlar & Adminlar
const DEFAULT_OPERATORS = [
  { login: "TB1", name: "Turatov Hojiakbar", password: "15420", role: "Operator" },
  { login: "TB2", name: "Saida'loxon Saidaxmadxonov", password: "15420", role: "Operator" },
  { login: "TB3", name: "Isfandiyor Xaydaraliyev", password: "15420", role: "Operator" }
];

const DEFAULT_ADMINS = [
  { login: "ADMIN_SHOXFRUH", name: "Abdurashidov Shoxruh", password: "admin15420", role: "Bosh Administrator" },
  { login: "ADMIN_NODIRBEK", name: "To'xtamishov Nodirbek", password: "admin15420", role: "Bosh Administrator" }
];

let operatorsList = [...DEFAULT_OPERATORS];

// Standart Aqlli Taqsimlash Qoidalari (Admin panel orqali boshqariladi)
const DEFAULT_SCHEDULING_RULES = [
  {
    id: "rule_mrt_contrast",
    name: "MRT Kontrastli tekshiruvlar (Faqat 1-MRT, 08:00 - 14:00)",
    deviceType: "MRT",
    targetDeviceId: "mrt1",
    disallowedDevices: ["mrt2"],
    isContrast: "yes",
    minServicesCount: 1,
    allowedTimeStart: "08:00",
    allowedTimeEnd: "14:00",
    enabled: true
  },
  {
    id: "rule_mskt_multi_contrast",
    name: "MSKT 3 va undan ortiq soha kontrastli (08:00 - 14:00)",
    deviceType: "MSKT",
    targetDeviceId: "mskt1",
    disallowedDevices: [],
    isContrast: "yes",
    minServicesCount: 3,
    allowedTimeStart: "08:00",
    allowedTimeEnd: "14:00",
    enabled: true
  }
];

let dynamicSchedulingRules = [...DEFAULT_SCHEDULING_RULES];

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

function listenToGeneralGuidelines() {
  db.ref("settings/general_guidelines").on("value", snapshot => {
    const val = snapshot.val();
    if (val) {
      globalGuidelines = {
        prepTemplates: Object.assign({}, DEFAULT_GLOBAL_GUIDELINES.prepTemplates, val.prepTemplates || {}),
        contraTemplates: Object.assign({}, DEFAULT_GLOBAL_GUIDELINES.contraTemplates, val.contraTemplates || {}),
        questionTemplates: Object.assign({}, DEFAULT_GLOBAL_GUIDELINES.questionTemplates, val.questionTemplates || {}),
        referralRules: Object.assign({}, DEFAULT_GLOBAL_GUIDELINES.referralRules, val.referralRules || {})
      };
    } else {
      globalGuidelines = JSON.parse(JSON.stringify(DEFAULT_GLOBAL_GUIDELINES));
      db.ref("settings/general_guidelines").set(DEFAULT_GLOBAL_GUIDELINES);
    }
  });
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

let calendarExceptions = {};
let calCurrentMonth = new Date().getMonth();
let calCurrentYear = new Date().getFullYear();

function getDayEffectiveSchedule(targetDate, schedule = null, exceptions = null) {
  const excMap = exceptions || calendarExceptions || {};
  const cfg = schedule || currentWorkSchedule || DEFAULT_WORK_SCHEDULE;
  const dateObj = new Date(targetDate + "T00:00:00");
  const dayOfWeek = dateObj.getDay();
  const baseDayCfg = getDaySchedule(cfg, dayOfWeek);

  // Aniq sana uchun istisno (bayram yoki maxsus ish soati) bormi?
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

// Boshlang'ich yuklash
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  setTodayDate();
  
  // Firebase-ni ishga tushirish
  db = initFirebase();

  if (db) {
    setupConnectionMonitor();
    listenToOperators();
    listenToSchedulingRules();
    listenToDoctors();
    listenToLaborants();
    listenToPatients(todayDateStr);
    listenToServices();
    listenToGeneralGuidelines();
    listenToWorkSchedule();
    listenToCalendarExceptions();
    initI18nSettingsModule();

    // Dastlabki sana qiymatlari
    const qDateEl = document.getElementById("queueDateFilter");
    if (qDateEl) qDateEl.value = todayDateStr;
    const pDateEl = document.getElementById("patientAppDate");
    if (pDateEl) pDateEl.value = todayDateStr;

    checkRegistrarAuth();
  } else {
    updateConnStatus(false, "Firebase sozlanmagan!");
    checkRegistrarAuth();
  }
}

function listenToOperators() {
  if (!db) return;
  db.ref("operators").on("value", snapshot => {
    const val = snapshot.val();
    if (val) {
      operatorsList = Object.values(val);
    } else {
      const seed = {};
      DEFAULT_OPERATORS.forEach(op => { seed[op.login] = op; });
      db.ref("operators").set(seed);
      operatorsList = [...DEFAULT_OPERATORS];
    }
  });
}

function listenToSchedulingRules() {
  if (!db) return;
  db.ref("settings/scheduling_rules").on("value", snapshot => {
    const val = snapshot.val();
    if (val) {
      dynamicSchedulingRules = Array.isArray(val) ? val : Object.values(val);
    } else {
      db.ref("settings/scheduling_rules").set(DEFAULT_SCHEDULING_RULES);
      dynamicSchedulingRules = [...DEFAULT_SCHEDULING_RULES];
    }
  });
}

function getMatchingSchedulingRule(procedureInfo) {
  if (!procedureInfo) return null;
  const isMSKT = procedureInfo.type === "MSKT" || (procedureInfo.service && procedureInfo.service.toUpperCase().includes("MSKT"));
  const devType = isMSKT ? "MSKT" : "MRT";
  const isContrast = Boolean(procedureInfo.isContrast);
  const sCount = procedureInfo.servicesCount || (procedureInfo.servicesList ? procedureInfo.servicesList.length : 1);

  const rules = (dynamicSchedulingRules && dynamicSchedulingRules.length > 0) ? dynamicSchedulingRules : DEFAULT_SCHEDULING_RULES;

  for (const r of rules) {
    if (!r.enabled) continue;
    if (r.deviceType && r.deviceType !== "ALL" && r.deviceType !== devType) continue;
    if (r.isContrast === "yes" && !isContrast) continue;
    if (r.isContrast === "no" && isContrast) continue;
    if (r.minServicesCount && sCount < r.minServicesCount) continue;
    return r;
  }
  return null;
}

// 🔐 REGISTRATURA AUTORIZATSIYA TIZIMI
function checkRegistrarAuth() {
  const params = new URLSearchParams(window.location.search);
  const isAdminFastAuth = params.get("adminAuth") === "1" || sessionStorage.getItem("adminAuthActive") === "1";
  
  if (isAdminFastAuth) {
    currentRegistrar = {
      login: "ADMIN",
      name: "Abdurashidov Shoxruh (Bosh Administrator)",
      role: "Bosh Administrator"
    };
    sessionStorage.setItem("adminAuthActive", "1");
    localStorage.setItem("currentRegistrar", JSON.stringify(currentRegistrar));
    updateRegistrarUI();
    hideRegistrarLoginModal();
    return true;
  }

  const saved = localStorage.getItem("currentRegistrar");
  if (saved) {
    try {
      currentRegistrar = JSON.parse(saved);
      updateRegistrarUI();
      hideRegistrarLoginModal();
      return true;
    } catch (e) {}
  }

  showRegistrarLoginModal();
  return false;
}

function showRegistrarLoginModal() {
  const modal = document.getElementById("registrarLoginModal");
  if (modal) modal.style.display = "flex";
}

function hideRegistrarLoginModal() {
  const modal = document.getElementById("registrarLoginModal");
  if (modal) modal.style.display = "none";
}

function handleRegistrarLoginSubmit(e) {
  if (e) e.preventDefault();
  const uInput = document.getElementById("regLoginUsername");
  const pInput = document.getElementById("regLoginPassword");
  const errBox = document.getElementById("regLoginError");

  const login = uInput ? uInput.value.trim().toUpperCase() : "";
  const pwd = pInput ? pInput.value.trim() : "";

  if (!login || !pwd) {
    if (errBox) {
      errBox.style.display = "block";
      errBox.innerText = "❌ Iltimos, login va parolni kiriting!";
    }
    return;
  }

  // 1. Admin tekshiruvi
  const admin = DEFAULT_ADMINS.find(a => a.login.toUpperCase() === login && a.password === pwd);
  if (admin) {
    currentRegistrar = admin;
    localStorage.setItem("currentRegistrar", JSON.stringify(admin));
    updateRegistrarUI();
    hideRegistrarLoginModal();
    if (errBox) errBox.style.display = "none";
    return;
  }

  // 2. Operator tekshiruvi
  const op = operatorsList.find(o => (o.login || '').toUpperCase() === login && o.password === pwd);
  if (op) {
    currentRegistrar = op;
    localStorage.setItem("currentRegistrar", JSON.stringify(op));
    updateRegistrarUI();
    hideRegistrarLoginModal();
    if (errBox) errBox.style.display = "none";
    return;
  }

  if (errBox) {
    errBox.style.display = "block";
    errBox.innerText = "❌ Login yoki parol noto'g'ri!";
  }
}

function logoutRegistrar() {
  currentRegistrar = null;
  localStorage.removeItem("currentRegistrar");
  sessionStorage.removeItem("adminAuthActive");
  showRegistrarLoginModal();
}

function updateRegistrarUI() {
  const nameEl = document.getElementById("headerOperatorName");
  const roleEl = document.getElementById("headerOperatorRole");
  const boxEl = document.getElementById("headerOperatorBox");

  if (currentRegistrar) {
    if (nameEl) nameEl.innerText = currentRegistrar.name || currentRegistrar.login;
    if (roleEl) roleEl.innerText = `${currentRegistrar.login} (${currentRegistrar.role || 'Operator'})`;
    if (boxEl) boxEl.style.display = "inline-flex";
  } else {
    if (boxEl) boxEl.style.display = "none";
  }
}

function listenToWorkSchedule() {
  db.ref("settings/schedule").on("value", snapshot => {
    const val = snapshot.val();
    if (val) {
      currentWorkSchedule = val;
      updateScheduleUI();
      renderCalendarGrid();
    } else {
      db.ref("settings/schedule").set(DEFAULT_WORK_SCHEDULE);
    }
  });
}

function listenToCalendarExceptions() {
  db.ref("settings/calendar_exceptions").on("value", snapshot => {
    calendarExceptions = snapshot.val() || {};
    renderCalendarGrid();
    renderExceptionsTable();
  });
}

function updateScheduleUI() {
  for (let i = 0; i <= 6; i++) {
    const dayCfg = getDaySchedule(currentWorkSchedule, i);
    const chk = document.getElementById(`workDay${i}`);
    if (chk) chk.checked = dayCfg.enabled;
    const sInput = document.getElementById(`workStart${i}`);
    if (sInput) sInput.value = dayCfg.start || "08:00";
    const eInput = document.getElementById(`workEnd${i}`);
    if (eInput) eInput.value = dayCfg.end || (i === 6 ? "14:00" : "19:30");
    toggleDayRow(i, dayCfg.enabled);
  }
}

function toggleDayRow(dayIdx, isEnabled) {
  const badge = document.getElementById(`badgeDay${dayIdx}`);
  const sInput = document.getElementById(`workStart${dayIdx}`);
  const eInput = document.getElementById(`workEnd${dayIdx}`);
  const row = document.getElementById(`rowDay${dayIdx}`);

  if (badge) {
    badge.style.background = isEnabled ? "#dcfce7" : "#fee2e2";
    badge.style.color = isEnabled ? "#15803d" : "#b91c1c";
    badge.innerHTML = isEnabled ? "🟢 Ish kuni" : "🔴 Dam olish";
  }
  if (sInput) {
    sInput.disabled = !isEnabled;
    sInput.style.opacity = isEnabled ? "1" : "0.5";
  }
  if (eInput) {
    eInput.disabled = !isEnabled;
    eInput.style.opacity = isEnabled ? "1" : "0.5";
  }
  if (row) {
    row.style.background = isEnabled ? "" : "#fef2f2";
  }
}

function applyDefaultSchedulePreset() {
  for (let i = 0; i <= 6; i++) {
    const chk = document.getElementById(`workDay${i}`);
    const sInput = document.getElementById(`workStart${i}`);
    const eInput = document.getElementById(`workEnd${i}`);

    if (i >= 1 && i <= 5) {
      if (chk) chk.checked = true;
      if (sInput) sInput.value = "08:00";
      if (eInput) eInput.value = "19:30";
      toggleDayRow(i, true);
    } else if (i === 6) {
      if (chk) chk.checked = true;
      if (sInput) sInput.value = "08:00";
      if (eInput) eInput.value = "14:00";
      toggleDayRow(i, true);
    } else {
      if (chk) chk.checked = false;
      if (sInput) sInput.value = "08:00";
      if (eInput) eInput.value = "14:00";
      toggleDayRow(i, false);
    }
  }
}

function saveWorkScheduleSettings() {
  const daysObj = {};
  const names = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
  let hasAnyWorkingDay = false;

  for (let i = 0; i <= 6; i++) {
    const chk = document.getElementById(`workDay${i}`);
    const isChecked = chk ? chk.checked : false;
    if (isChecked) hasAnyWorkingDay = true;

    const sInput = document.getElementById(`workStart${i}`);
    const eInput = document.getElementById(`workEnd${i}`);

    daysObj[i] = {
      enabled: isChecked,
      name: names[i],
      start: sInput ? sInput.value : "08:00",
      end: eInput ? eInput.value : (i === 6 ? "14:00" : "19:30")
    };
  }

  if (!hasAnyWorkingDay) {
    alert("⚠️ Kamida 1 ta ish kunini belgilashingiz kerak!");
    return;
  }

  const newConfig = {
    days: daysObj,
    updatedAt: new Date().toISOString()
  };

  db.ref("settings/schedule").set(newConfig).then(() => {
    alert("✅ Markaz ish kunlari va soatlari muvaffaqiyatli saqlandi!");
  }).catch(err => {
    alert("Xatolik yuz berdi: " + err.message);
  });
}

// === TAQVIM & BAYRAMLAR VIZUAL BOSHQARUVI ===
function renderCalendarGrid() {
  const mSelect = document.getElementById("calMonthSelect");
  const ySelect = document.getElementById("calYearSelect");
  if (mSelect) mSelect.value = calCurrentMonth;
  if (ySelect) ySelect.value = calCurrentYear;

  const container = document.getElementById("calGridDays");
  if (!container) return;
  container.innerHTML = "";

  const firstDayOfMonth = new Date(calCurrentYear, calCurrentMonth, 1);
  const lastDayOfMonth = new Date(calCurrentYear, calCurrentMonth + 1, 0);
  const totalDays = lastDayOfMonth.getDate();

  // Dushanbadan boshlash: 1=Mon..7=Sun
  let firstDayIndex = firstDayOfMonth.getDay();
  let paddingDays = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  // Oldingi oy kunlari
  const prevMonthLastDay = new Date(calCurrentYear, calCurrentMonth, 0).getDate();
  for (let i = paddingDays; i > 0; i--) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "cal-day-cell other-month";
    dayDiv.innerHTML = `<span class="cal-day-num" style="opacity:0.4;">${prevMonthLastDay - i + 1}</span>`;
    container.appendChild(dayDiv);
  }

  // Joriy oy kunlari
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  for (let d = 1; d <= totalDays; d++) {
    const dStr = String(d).padStart(2, "0");
    const mStr = String(calCurrentMonth + 1).padStart(2, "0");
    const dateKey = `${calCurrentYear}-${mStr}-${dStr}`;

    const eff = getDayEffectiveSchedule(dateKey);
    const dayDiv = document.createElement("div");
    dayDiv.className = "cal-day-cell";

    if (calCurrentYear === todayY && calCurrentMonth === todayM && d === todayD) {
      dayDiv.classList.add("today");
    }

    let tagHtml = "";
    if (eff.isHoliday) {
      dayDiv.classList.add("holiday");
      tagHtml = `<div class="cal-day-tag" style="background:#fee2e2; color:#b91c1c;">🎉 ${escapeHtml(eff.title)} (Dam)</div>`;
    } else if (eff.isSpecialHours) {
      dayDiv.classList.add("special-hours");
      tagHtml = `<div class="cal-day-tag" style="background:#fef9c3; color:#854d0e;">⏱ ${eff.start}-${eff.end}</div>`;
    } else if (!eff.enabled) {
      dayDiv.classList.add("weekend-off");
      tagHtml = `<div class="cal-day-tag" style="background:#f1f5f9; color:#64748b;">🔴 Dam olish</div>`;
    } else {
      tagHtml = `<div class="cal-day-tag" style="background:#f0fdf4; color:#15803d;">⏱ ${eff.start}-${eff.end}</div>`;
    }

    dayDiv.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span class="cal-day-num">${d}</span>
        ${eff.isException ? '<span style="font-size:10px; font-weight:800; color:#0284c7;">⚡ Maxsus</span>' : ''}
      </div>
      ${tagHtml}
    `;

    dayDiv.onclick = () => openCalendarExceptionModal(dateKey);
    container.appendChild(dayDiv);
  }
}

function prevCalendarMonth() {
  if (calCurrentMonth === 0) {
    calCurrentMonth = 11;
    calCurrentYear--;
  } else {
    calCurrentMonth--;
  }
  renderCalendarGrid();
}

function nextCalendarMonth() {
  if (calCurrentMonth === 11) {
    calCurrentMonth = 0;
    calCurrentYear++;
  } else {
    calCurrentMonth++;
  }
  renderCalendarGrid();
}

function onCalendarMonthYearChange() {
  const mSelect = document.getElementById("calMonthSelect");
  const ySelect = document.getElementById("calYearSelect");
  if (mSelect) calCurrentMonth = parseInt(mSelect.value, 10);
  if (ySelect) calCurrentYear = parseInt(ySelect.value, 10);
  renderCalendarGrid();
}

function renderExceptionsTable() {
  const tbody = document.getElementById("exceptionsTableBody");
  if (!tbody) return;

  const keys = Object.keys(calendarExceptions || {}).sort();
  if (keys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#64748b; padding:16px;">Hozircha maxsus sana yoki bayramlar kiritilmagan. Yuqoridagi taqvimdan istalgan sanani tanlab kiritishingiz mumkin.</td></tr>`;
    return;
  }

  const names = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

  tbody.innerHTML = keys.map(k => {
    const ex = calendarExceptions[k];
    const dObj = new Date(k + "T00:00:00");
    const dayName = names[dObj.getDay()] || "";
    const isHoliday = !ex.isWorking;
    const hours = isHoliday ? "—" : `${ex.workStart || '08:00'} - ${ex.workEnd || '14:00'}`;

    return `
      <tr>
        <td><strong>${k}</strong> <small style="color:#64748b;">(${dayName})</small></td>
        <td><strong>${escapeHtml(ex.title || ex.reason || 'Maxsus sana')}</strong></td>
        <td>
          ${isHoliday 
            ? '<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-weight:700; font-size:12px;">🎉 Bayram / Dam</span>' 
            : '<span style="background:#f0f9ff; color:#0369a1; padding:3px 8px; border-radius:6px; font-weight:700; font-size:12px;">⏱ Maxsus Ish Soati</span>'}
        </td>
        <td style="font-weight:700;">${hours}</td>
        <td style="text-align:center;">
          <div style="display:flex; gap:6px; justify-content:center;">
            <button class="btn btn-secondary btn-small" onclick="openCalendarExceptionModal('${k}')" title="Tahrirlash">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-small" onclick="deleteCalendarExceptionByDate('${k}')" title="O'chirish">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function openCalendarExceptionModal(dateStr = null) {
  const modal = document.getElementById("calendarExceptionModal");
  if (!modal) return;

  const dateInput = document.getElementById("calModalDate");
  const reasonInput = document.getElementById("calModalReason");
  const startInput = document.getElementById("calModalStart");
  const endInput = document.getElementById("calModalEnd");
  const btnDelete = document.getElementById("btnDeleteCalException");
  const form = document.getElementById("calendarExceptionForm");
  form.reset();

  const targetDate = dateStr || todayDateStr;
  if (dateInput) dateInput.value = targetDate;

  if (calendarExceptions && calendarExceptions[targetDate]) {
    const ex = calendarExceptions[targetDate];
    if (reasonInput) reasonInput.value = ex.title || ex.reason || "";
    if (ex.isWorking) {
      document.querySelector('input[name="calModalType"][value="custom_hours"]').checked = true;
      toggleCalModalTypeFields("custom_hours");
      if (startInput) startInput.value = ex.workStart || "08:00";
      if (endInput) endInput.value = ex.workEnd || "14:00";
    } else {
      document.querySelector('input[name="calModalType"][value="holiday"]').checked = true;
      toggleCalModalTypeFields("holiday");
    }
    if (btnDelete) btnDelete.style.display = "inline-block";
  } else {
    document.querySelector('input[name="calModalType"][value="holiday"]').checked = true;
    toggleCalModalTypeFields("holiday");
    if (reasonInput) reasonInput.value = "";
    if (startInput) startInput.value = "08:00";
    if (endInput) endInput.value = "14:00";
    if (btnDelete) btnDelete.style.display = "none";
  }

  modal.classList.add("open");
}

function closeCalendarExceptionModal() {
  const modal = document.getElementById("calendarExceptionModal");
  if (modal) modal.classList.remove("open");
}

function toggleCalModalTypeFields(type) {
  const box = document.getElementById("calModalHoursBox");
  if (box) {
    box.style.display = type === "custom_hours" ? "block" : "none";
  }
}

function handleCalendarExceptionSubmit(e) {
  e.preventDefault();
  const date = document.getElementById("calModalDate").value;
  if (!date) return;

  const type = document.querySelector('input[name="calModalType"]:checked').value;
  const title = document.getElementById("calModalReason").value.trim();
  const isWorking = type === "custom_hours";
  const workStart = isWorking ? (document.getElementById("calModalStart").value || "08:00") : "";
  const workEnd = isWorking ? (document.getElementById("calModalEnd").value || "14:00") : "";

  const payload = {
    date,
    title,
    isWorking,
    workStart,
    workEnd,
    updatedAt: new Date().toISOString()
  };

  db.ref(`settings/calendar_exceptions/${date}`).set(payload).then(() => {
    closeCalendarExceptionModal();
  }).catch(err => {
    alert("Xatolik: " + err.message);
  });
}

function deleteCurrentCalendarException() {
  const date = document.getElementById("calModalDate").value;
  if (!date) return;
  deleteCalendarExceptionByDate(date);
}

function deleteCalendarExceptionByDate(dateStr) {
  if (confirm(`Haqiqatdan ham ${dateStr} sanasidagi maxsus sozlamani o'chirmoqchimisiz? (Standart grafik tiklanadi)`)) {
    db.ref(`settings/calendar_exceptions/${dateStr}`).remove().then(() => {
      closeCalendarExceptionModal();
    });
  }
}

function populateUzbekistanHolidays() {
  const curY = new Date().getFullYear();
  const years = [curY, curY + 1];
  const updates = {};

  years.forEach(y => {
    const list = [
      { date: `${y}-01-01`, title: "Yangi yil bayrami", isWorking: false },
      { date: `${y}-03-08`, title: "Xalqaro xotin-qizlar kuni", isWorking: false },
      { date: `${y}-03-21`, title: "Navro'z umumxalq bayrami", isWorking: false },
      { date: `${y}-05-09`, title: "Xotira va qadrlash kuni", isWorking: false },
      { date: `${y}-09-01`, title: "O'zbekiston Respublikasi Mustaqillik kuni", isWorking: false },
      { date: `${y}-10-01`, title: "O'qituvchi va murabbiylar kuni", isWorking: false },
      { date: `${y}-12-08`, title: "Konstitutsiya kuni", isWorking: false },
      { date: `${y}-12-31`, title: "Yangi yil arafasi (qisqartirilgan ish soatlari)", isWorking: true, workStart: "08:00", workEnd: "14:00" }
    ];

    list.forEach(h => {
      updates[h.date] = h;
    });
  });

  if (confirm(`O'zbekiston rasmiy bayram sanalari (${curY} va ${curY + 1} yillar uchun) taqvimga kiritilsinmi?`)) {
    db.ref("settings/calendar_exceptions").update(updates).then(() => {
      alert("✅ Rasmiy bayram sanalari taqvimga muvaffaqiyatli kiritildi!");
    });
  }
}

// 1. FIREBASE ULANISH MONITORINGI
function setupConnectionMonitor() {
  const connectedRef = db.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    const isOnline = snap.val() === true;
    updateConnStatus(isOnline, isOnline ? "Firebase: Ulangan" : "Firebase: Ulanish uzildi");
  });
}

function updateConnStatus(isOnline, text) {
  const dot = document.getElementById("connDot");
  const txt = document.getElementById("connText");
  if (dot) {
    dot.className = isOnline ? "status-dot connected" : "status-dot disconnected";
  }
  if (txt) {
    txt.innerText = text || (isOnline ? "Firebase: Ulangan" : "Firebase: Ulanish uzildi");
  }
}

// 1.1 VRACHLAR VA QURILMALAR RO'YXATINI TINGLASH
function listenToDoctors() {
  db.ref("doctors").on("value", (snapshot) => {
    doctorsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        doctorsList.push({ id: key, ...data[key] });
      });
    }
    renderDoctors();
    updateDoctorSelectOptions();
  });
}

function listenToLaborants() {
  db.ref("laborants").on("value", (snapshot) => {
    laborantsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        laborantsList.push({ login: key, ...data[key] });
      });
    }
    if (typeof onDateOrDoctorOrTimeChanged === "function") {
      onDateOrDoctorOrTimeChanged();
    }
  });
}

// Bugungi sana
function setTodayDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("currentDate").innerText = now.toLocaleDateString('uz-UZ', options);
  
  // Format: YYYY-MM-DD (Firebase query uchun)
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  todayDateStr = `${y}-${m}-${d}`;
  selectedQueueDate = todayDateStr;
}

function getDateStrWithOffset(offsetDays) {
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const parts = tStr.trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function addMinutesToTime(tStr, mins) {
  if (!tStr) return "08:00";
  const parts = tStr.trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const total = h * 60 + m + parseInt(mins, 10);
  const rH = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const rM = String(total % 60).padStart(2, "0");
  return `${rH}:${rM}`;
}

// 2. BEMORLAR NAVBATINI TINGLASH (Ixtiyoriy sana uchun)
function listenToPatients(targetDate) {
  selectedQueueDate = targetDate || todayDateStr;
  if (currentPatientsRef) {
    currentPatientsRef.off();
  }

  currentPatientsRef = db.ref(`patients/${selectedQueueDate}`);
  currentPatientsRef.on("value", (snapshot) => {
    patientsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        patientsList.push({ id: key, ...data[key] });
      });
    }
    // Vaqt bo'yicha saralash
    patientsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    renderQueueTable();
    updateStats();
  });
}

function changeQueueDate(newDate) {
  if (!newDate) return;
  listenToPatients(newDate);
}

function setQueueDateQuick(offsetDays) {
  const targetDate = getDateStrWithOffset(offsetDays);
  const dateInput = document.getElementById("queueDateFilter");
  if (dateInput) dateInput.value = targetDate;
  listenToPatients(targetDate);
}

function setAppDateOffset(offsetDays) {
  const targetDate = getDateStrWithOffset(offsetDays);
  const dateInput = document.getElementById("patientAppDate");
  if (dateInput) {
    dateInput.value = targetDate;
    onDateOrDoctorOrTimeChanged();
  }
}

function togglePatientDepartment() {
  const type = document.getElementById("patientTypeSelect") ? document.getElementById("patientTypeSelect").value : "Ambulator";
  const deptGroup = document.getElementById("deptInputGroup");
  if (deptGroup) {
    deptGroup.style.display = type === "Bo'limda yotibdi" ? "block" : "none";
    if (type === "Bo'limda yotibdi" && document.getElementById("patientDepartment")) {
      document.getElementById("patientDepartment").focus();
    }
  }
}

// 3. JADVALNI SARALASH VA CHIZISH
let currentSortColumn = "scheduledTime"; // Boshlang'ich saralash: Vaqt bo'yicha
let currentSortOrder = "asc"; // "asc" yoki "desc"

function toggleSort(columnKey) {
  if (currentSortColumn === columnKey) {
    currentSortOrder = (currentSortOrder === "asc") ? "desc" : "asc";
  } else {
    currentSortColumn = columnKey;
    currentSortOrder = "asc";
  }
  updateSortHeaderUI();
  renderQueueTable();
}

function updateSortHeaderUI() {
  const allThs = document.querySelectorAll(".data-table th.sortable");
  allThs.forEach(th => {
    th.classList.remove("sort-active");
    const indicator = th.querySelector(".sort-indicator");
    if (indicator) indicator.innerHTML = '<i class="fa-solid fa-sort"></i>';
  });

  const activeTh = document.getElementById(`th-${currentSortColumn}`);
  if (activeTh) {
    activeTh.classList.add("sort-active");
    const indicator = activeTh.querySelector(".sort-indicator");
    if (indicator) {
      indicator.innerHTML = currentSortOrder === "asc"
        ? '<i class="fa-solid fa-sort-up"></i>'
        : '<i class="fa-solid fa-sort-down"></i>';
    }
  }
}

function renderQueueTable() {
  const tbody = document.getElementById("queueTableBody");
  if (!tbody) return;

  const searchQuery = (document.getElementById("searchInput") ? document.getElementById("searchInput").value : "").toLowerCase();
  const docFilter = document.getElementById("doctorFilter") ? document.getElementById("doctorFilter").value : "all";
  const statusFilter = document.getElementById("statusFilter") ? document.getElementById("statusFilter").value : "all";

  const filtered = patientsList.filter((p) => {
    const matchSearch = (p.name && p.name.toLowerCase().includes(searchQuery)) ||
                        (p.ticketId && p.ticketId.toLowerCase().includes(searchQuery)) ||
                        (p.phone && p.phone.includes(searchQuery)) ||
                        (p.referringDoctor && p.referringDoctor.toLowerCase().includes(searchQuery)) ||
                        (p.department && p.department.toLowerCase().includes(searchQuery));
    const matchDoc = docFilter === "all" || p.doctorId === docFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchDoc && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4" style="text-align:center; color:#94a3b8;">${selectedQueueDate} sanasi uchun bemorlar topilmadi</td></tr>`;
    return;
  }

  // A-Z va Har qanday ustun bo'yicha saralash
  filtered.sort((a, b) => {
    // 1. Qayta tekshiruv (Navbatdan tashqari / 1-o'rin) bemorlar har doim birinchi o'rinda chiqadi
    const aRecheck = !!(a.isOutOfQueue || a.isRecheck);
    const bRecheck = !!(b.isOutOfQueue || b.isRecheck);
    if (aRecheck && !bRecheck) return -1;
    if (!aRecheck && bRecheck) return 1;

    let valA = "";
    let valB = "";

    switch (currentSortColumn) {
      case "ticketId": {
        const numA = parseInt(String(a.ticketId || "").replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(String(b.ticketId || "").replace(/\D/g, ""), 10) || 0;
        return currentSortOrder === "asc" ? numA - numB : numB - numA;
      }
      case "scheduledTime": {
        valA = a.scheduledTime || a.time || "08:00";
        valB = b.scheduledTime || b.time || "08:00";
        return currentSortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      case "name":
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
        break;
      case "patientType":
        valA = `${a.patientType || ''} ${a.department || ''}`.toLowerCase();
        valB = `${b.patientType || ''} ${b.department || ''}`.toLowerCase();
        break;
      case "doctorName":
        valA = `${a.doctorName || ''} ${a.room || ''}`.toLowerCase();
        valB = `${b.doctorName || ''} ${b.room || ''}`.toLowerCase();
        break;
      case "service":
        valA = (a.service || "").toLowerCase();
        valB = (b.service || "").toLowerCase();
        break;
      case "referringDoctor":
        valA = (a.referringDoctor || "").toLowerCase();
        valB = (b.referringDoctor || "").toLowerCase();
        break;
      case "registeredBy":
        valA = (a.registeredBy || a.operatorLogin || "").toLowerCase();
        valB = (b.registeredBy || b.operatorLogin || "").toLowerCase();
        break;
      case "status":
        valA = (a.status || "").toLowerCase();
        valB = (b.status || "").toLowerCase();
        break;
      default:
        valA = (a[currentSortColumn] || "").toString().toLowerCase();
        valB = (b[currentSortColumn] || "").toString().toLowerCase();
        break;
    }

    if (valA < valB) return currentSortOrder === "asc" ? -1 : 1;
    if (valA > valB) return currentSortOrder === "asc" ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = filtered.map((p) => {
    const isCancelled = p.status === "cancelled";
    const isRecheck = !!(p.isOutOfQueue || p.isRecheck);
    const oldSlot = p.cancelledSlot || p.timeSlot || p.scheduledTime || "-";
    const timeDisplay = isCancelled
      ? `<div style="color:#94a3b8; font-size:11.5px; text-decoration:line-through;">${escapeHtml(oldSlot)}</div>
         <span style="background:#dcfce7; color:#15803d; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; display:inline-block; margin-top:2px;">
           🟢 Bo'shatildi
         </span>`
      : (isRecheck
          ? `<span class="badge" style="background:#7c3aed; color:#fff; font-weight:800; font-size:10.5px; padding:3px 7px; border-radius:6px; display:inline-block;">⚡ 1-O'rin (Navbatdan tashqari)</span>`
          : (p.timeSlot ? `<strong style="color:#0284c7;">${escapeHtml(p.timeSlot)}</strong>` : (p.scheduledTime || p.time || '-')));
    const operatorDisplay = p.registeredBy || (p.operatorLogin ? `${p.operatorLogin} - ${p.operatorName || ''}` : '-');
    const statusInfo = getStatusBadge(p.status);
    const dateLabel = (p.appointmentDate && p.appointmentDate !== todayDateStr) ? `<div style="font-size:10px; color:#b45309; font-weight:bold;">📅 ${escapeHtml(p.appointmentDate)}</div>` : '';
    const isStat = p.patientType === "Bo'limda yotibdi" || p.isStationary || (p.priority && String(p.priority).toLowerCase().includes("statsionar"));
    const deptSuffix = p.department ? ` (${escapeHtml(p.department)})` : '';
    const patientTypeBadge = isStat
      ? `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700;">🏥 Bo'limda yotibdi${deptSuffix}</span>`
      : `<span class="badge" style="background:#e0f2fe; color:#0284c7; font-weight:700;">🏠 Ambulator${deptSuffix}</span>`;
    const docDisplay = p.referringDoctor ? `<span style="font-weight:600; color:#0f172a; font-size:12px;">👨‍⚕️ ${escapeHtml(p.referringDoctor)}</span>` : '<span style="color:#94a3b8; font-size:12px;">-</span>';

    let actionsHtml = "";
    if (isCancelled) {
      actionsHtml = `
        <button class="btn btn-secondary btn-small" title="Talonni chop etish" onclick="openPrintModal('${p.id}')">
          <i class="fa-solid fa-print"></i>
        </button>
        <button class="btn btn-secondary btn-small" title="Rozilik anketasini chop etish" style="color:#15803d; margin-left:3px;" onclick="printConsentForm('${p.id}')">
          <i class="fa-solid fa-file-contract"></i> Anketa
        </button>
        <span style="background:#fee2e2; color:#dc2626; font-size:11px; padding:4px 8px; border-radius:6px; font-weight:bold; display:inline-flex; align-items:center; gap:4px; margin-left:3px;" title="Bemor navbati o'chirilgan">
          <i class="fa-solid fa-ban"></i> O'chirilgan
        </span>
        <button class="btn btn-secondary btn-small" title="Qayta tiklash" style="color:#0284c7; margin-left:4px;" onclick="restorePatient('${p.id}')">
          <i class="fa-solid fa-rotate-left"></i>
        </button>
      `;
    } else {
      actionsHtml = `
        <button class="btn btn-secondary btn-small" title="Talonni chop etish" onclick="openPrintModal('${p.id}')">
          <i class="fa-solid fa-print"></i>
        </button>
        <button class="btn btn-secondary btn-small" title="Rozilik anketasini chop etish" style="color:#15803d; margin-left:3px;" onclick="printConsentForm('${p.id}')">
          <i class="fa-solid fa-file-contract"></i> Anketa
        </button>
        <button class="btn btn-secondary btn-small" title="Navbatdan o'chirish / Bekor qilish" style="color:var(--danger); margin-left:3px;" onclick="deletePatient('${p.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    }

    const arrivedBtnHtml = `
      <button type="button" class="btn btn-small" onclick="toggleArrivedStatus('${p.id}')" title="${p.arrived ? 'Bemor kutish zalida o\'tiribdi (O\'zgartirish uchun bosing)' : 'Bemor hali kelmadi (Kelganini belgilash uchun bosing)'}" style="background:${p.arrived ? '#dcfce7' : '#f1f5f9'}; color:${p.arrived ? '#15803d' : '#64748b'}; border:1px solid ${p.arrived ? '#86efac' : '#cbd5e1'}; font-weight:800; font-size:11px; padding:3px 8px; border-radius:6px; cursor:pointer; min-width:86px; display:inline-flex; align-items:center; justify-content:center; gap:4px;">
        ${p.arrived ? '🟢 Zalda' : '⏳ Hali kelmadi'}
      </button>
    `;

    return `
      <tr ${isCancelled ? 'class="row-cancelled"' : ''}>
        <td><span class="ticket-tag" style="${isCancelled ? 'opacity:0.6;' : ''}">${escapeHtml(p.ticketId)}</span></td>
        <td>
          <strong style="${isCancelled ? 'color:#64748b;' : ''}">${escapeHtml(p.name)}</strong>
          ${isCancelled ? '<span style="color:#ef4444; font-size:10px; font-weight:bold; display:block;">[O\'CHIRILGAN]</span>' : ''}
          ${p.sampleNumber ? `<span style="display:inline-block; margin-top:2px; margin-right:3px; background:#e0e7ff; color:#3730a3; border-radius:4px; padding:1px 5px; font-size:10px; font-weight:700;">Namuna: №${escapeHtml(p.sampleNumber)}</span>` : ''}
          ${(p.muassasa || p.senderInstitution) ? `<span style="display:inline-block; margin-top:2px; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; border-radius:4px; padding:1px 5px; font-size:10px; font-weight:700;">🏢 ${escapeHtml(p.muassasa || p.senderInstitution)}</span>` : ''}
          ${dateLabel}
          ${deferNote}
        </td>
        <td>${patientTypeBadge}</td>
        <td><strong>${escapeHtml(p.doctorName || p.room)}</strong> <small style="color:#64748b;">(${escapeHtml(p.room || '')})</small></td>
        <td>${escapeHtml(p.service || '-')} ${p.isContrast ? '<span style="color:#ef4444; font-weight:bold; font-size:10px;">[KONTRAST]</span>' : ''}</td>
        <td>${timeDisplay}</td>
        <td>${docDisplay}</td>
        <td><span style="background:#f1f5f9; padding:3px 8px; border-radius:6px; font-size:11.5px; font-weight:600; color:#334155;">👤 ${escapeHtml(operatorDisplay)}</span></td>
        <td>
          <span class="badge ${statusInfo.cls}">${statusInfo.label}</span>
          ${(p.laborantName || p.calledByLaborant) ? `
            <div style="font-size:11px; color:#0284c7; font-weight:700; margin-top:3px; display:flex; align-items:center; gap:4px;" title="Chaqirgan laborant">
              <i class="fa-solid fa-user-doctor" style="font-size:10px;"></i>
              <span>${escapeHtml(p.calledByLaborant || p.laborantName)}</span>
            </div>
          ` : ''}
        </td>
        <td style="white-space: nowrap; text-align: center;">${actionsHtml}</td>
      </tr>
    `;
  }).join("");
}

function getStatusBadge(status) {
  switch (status) {
    case "waiting": return { label: "Kutmoqda", cls: "badge-waiting" };
    case "calling": return { label: "Chaqirilmoqda", cls: "badge-calling" };
    case "in_progress": return { label: "Qabulda", cls: "badge-in_progress" };
    case "completed": return { label: "Yakunlandi", cls: "badge-completed" };
    case "cancelled": return { label: "O'chirilgan", cls: "badge-cancelled" };
    default: return { label: "Kutmoqda", cls: "badge-waiting" };
  }
}

// 4. STATISTIKANI YANGILASH
function updateStats() {
  document.getElementById("statTotal").innerText = patientsList.length;
  document.getElementById("statWaiting").innerText = patientsList.filter(p => p.status === "waiting").length;
  document.getElementById("statCalling").innerText = patientsList.filter(p => p.status === "calling" || p.status === "in_progress").length;
  document.getElementById("statCompleted").innerText = patientsList.filter(p => p.status === "completed").length;
}

// 5. VAQT REJIMINI ALMASHTIRISH VA BAND/BO'SH TEKSHIRUV MANTIQI
function toggleTimeSlotMode() {
  const mode = document.querySelector('input[name="timeSlotMode"]:checked').value;
  const customBox = document.getElementById("customTimeBox");
  if (customBox) {
    customBox.style.display = mode === "custom" ? "block" : "none";
  }
  onDateOrDoctorOrTimeChanged();
}

function toggleDeferReasonOther() {
  const val = document.getElementById("deferReasonSelect").value;
  const otherInput = document.getElementById("deferReasonOtherText");
  if (otherInput) {
    otherInput.style.display = val === "Boshqa sabab" ? "block" : "none";
    if (val === "Boshqa sabab") otherInput.focus();
  }
}

let lastCalculatedSlot = null;
let isCurrentSlotValid = false;

function isLaborantOnDuty(lab, roomId, targetDateStr) {
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
  const dayOfWeek = dObj.getDay(); // 0-6

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

function getLaborantWorkingHours(lab, targetDateStr) {
  const s = lab.schedule;
  if (!s) return { start: "08:00", end: "19:30", breakStart: "", breakEnd: "" };

  if (s.dateOverrides && s.dateOverrides[targetDateStr]) {
    const ov = s.dateOverrides[targetDateStr];
    return {
      start: ov.start || "08:00",
      end: ov.end || "19:30",
      breakStart: ov.breakStart || "",
      breakEnd: ov.breakEnd || ""
    };
  }

  const dObj = new Date(targetDateStr + "T12:00:00");
  const dayOfWeek = dObj.getDay();

  if (s.dailyHours && s.dailyHours[dayOfWeek]) {
    const dh = s.dailyHours[dayOfWeek];
    return {
      start: dh.start || "08:00",
      end: dh.end || "19:30",
      breakStart: dh.breakStart || "",
      breakEnd: dh.breakEnd || ""
    };
  }

  return {
    start: s.startTime || "08:00",
    end: s.endTime || "19:30",
    breakStart: s.breakStart || "",
    breakEnd: s.breakEnd || ""
  };
}

// Laborant va Xona asosida dinamik vaqtni aniqlash (Kunbay va Oylik jadvallar bilan)
function getResolvedDurationForRoom(docId, serviceText, targetDateStr) {
  if (!targetDateStr) targetDateStr = todayDateStr;

  // Ushbu xonaga shu kunda biriktirilgan laborantlarni topish
  const activeLaborants = laborantsList.filter(l => isLaborantOnDuty(l, docId, targetDateStr));

  // Mos keluvchi tekshiruv katalogini qidirish
  const sText = (serviceText || "").toLowerCase().trim();
  const matchingService = servicesList.find(s => 
    (s.code && sText.includes(s.code.toLowerCase())) ||
    (s.name && (sText.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(sText)))
  );
  const standardDuration = matchingService ? (matchingService.duration || 30) : 30;

  if (activeLaborants.length > 0) {
    // Har bir laborantning ushbu tekshiruv uchun vaqtini olish
    const durations = activeLaborants.map(lab => {
      if (lab.customDurations && matchingService && lab.customDurations[matchingService.code]) {
        return parseInt(lab.customDurations[matchingService.code], 10);
      }
      return standardDuration;
    });
    // Agar bir vaqtda 2 yoki undan ortiq laborant bo'lsa, eng uzoq (maksimal) vaqt olinadi
    return {
      duration: Math.max(...durations),
      laborantNames: activeLaborants.map(l => l.name || l.login),
      hasLaborant: true,
      serviceCode: matchingService ? matchingService.code : null
    };
  }

  // Laborant biriktirilmagan bo'lsa -> admin tasdiqlagan standart vaqt
  return {
    duration: standardDuration,
    laborantNames: [],
    hasLaborant: false,
    serviceCode: matchingService ? matchingService.code : null
  };
}

function getDateStrWithOffsetFrom(baseDateStr, offsetDays) {
  const base = new Date((baseDateStr || todayDateStr) + "T12:00:00");
  base.setDate(base.getDate() + offsetDays);
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const d = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Barcha keyingi kunlar bo'yicha eng yaqin bo'sh slotni avtomatik qidirish
async function findEarliestAvailableSlot(docId, serviceText, startAppDate, maxSearchDays = 30) {
  const startDate = startAppDate || todayDateStr;

  for (let offset = 0; offset < maxSearchDays; offset++) {
    const checkDateStr = getDateStrWithOffsetFrom(startDate, offset);
    const effDay = getDayEffectiveSchedule(checkDateStr, currentWorkSchedule, calendarExceptions);
    if (!effDay.enabled) continue; // Dam olish kuni

    const durInfo = getResolvedDurationForRoom(docId, serviceText, checkDateStr);
    const resolvedDuration = durInfo.duration;

    let dayPatients = [];
    if (checkDateStr === selectedQueueDate) {
      dayPatients = patientsList;
    } else {
      try {
        const snap = await db.ref(`patients/${checkDateStr}`).once("value");
        const val = snap.val();
        if (val) dayPatients = Object.keys(val).map(k => ({ id: k, ...val[k] }));
      } catch (e) {}
    }
    const devPatients = dayPatients.filter(p => p.doctorId === docId && p.status !== "cancelled");

    const slot = calculateSlotFromPatientsList(devPatients, resolvedDuration, checkDateStr, currentWorkSchedule);
    if (!slot.error && !slot.isFull) {
      return {
        date: checkDateStr,
        dayName: effDay.title || effDay.name,
        slot: slot,
        duration: resolvedDuration,
        durInfo: durInfo,
        isToday: checkDateStr === todayDateStr,
        isFutureDay: checkDateStr !== startDate
      };
    }
  }

  return { error: "Keyingi 30 kun ichida bo'sh navbat topilmadi!" };
}

async function onDateOrDoctorOrTimeChanged() {
  const docId = document.getElementById("doctorSelect") ? document.getElementById("doctorSelect").value : "";
  let appDate = document.getElementById("patientAppDate") ? document.getElementById("patientAppDate").value : todayDateStr;
  const serviceText = document.getElementById("serviceType") ? document.getElementById("serviceType").value : "";
  const mode = document.querySelector('input[name="timeSlotMode"]:checked') ? document.querySelector('input[name="timeSlotMode"]:checked').value : "auto";
  const customStartTime = document.getElementById("customStartTime") ? document.getElementById("customStartTime").value : "08:00";
  const alertEl = document.getElementById("slotStatusAlert");
  const deferContainer = document.getElementById("deferReasonContainer");
  const submitBtn = document.getElementById("btnSubmitPatient");

  if (!docId) {
    if (alertEl) {
      alertEl.style.background = "#f1f5f9";
      alertEl.style.color = "#64748b";
      alertEl.innerHTML = "ℹ️ Iltimos, oldin qurilma / xonani tanlang";
    }
    isCurrentSlotValid = false;
    return;
  }

  // Dinamik tekshiruv vaqtini aniqlash (Laborant jadvali va bir nechta laborantning maksimal vaqti bo'yicha)
  const resolvedDurInfo = getResolvedDurationForRoom(docId, serviceText, appDate);
  const durationInput = document.getElementById("patientDuration");
  if (durationInput && (!durationInput.value || durationInput.dataset.userEdited !== "true")) {
    durationInput.value = resolvedDurInfo.duration;
  }
  const duration = parseInt(durationInput ? durationInput.value : resolvedDurInfo.duration, 10) || resolvedDurInfo.duration;

  // Tanlangan sana uchun bemorlarni olish
  let targetPatients = [];
  if (appDate === selectedQueueDate) {
    targetPatients = patientsList;
  } else {
    try {
      const snap = await db.ref(`patients/${appDate}`).once("value");
      const val = snap.val();
      if (val) {
        targetPatients = Object.keys(val).map(k => ({ id: k, ...val[k] }));
      }
    } catch (e) {}
  }

  const devPatients = targetPatients.filter(p => p.doctorId === docId && p.status !== "cancelled");

  // 1. Dam olish kuni yoki bayram tekshiruvi
  const effDay = getDayEffectiveSchedule(appDate, currentWorkSchedule, calendarExceptions);
  if (!effDay.enabled && mode !== "auto") {
    isCurrentSlotValid = false;
    if (alertEl) {
      alertEl.style.background = "#fee2e2";
      alertEl.style.color = "#b91c1c";
      alertEl.innerHTML = `❌ <strong>Dam olish kuni / Bayram!</strong> Tanlangan sana (${appDate} - ${effDay.title || effDay.name}) dam olish kuni hisoblanadi. Navbat berish taqiqlangan!`;
    }
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  // 2. O'tgan sana tekshiruvi
  if (appDate < todayDateStr) {
    isCurrentSlotValid = false;
    if (alertEl) {
      alertEl.style.background = "#fee2e2";
      alertEl.style.color = "#b91c1c";
      alertEl.innerHTML = `❌ <strong>O'tgan sana!</strong> O'tib ketgan kunga (${appDate}) navbat yozish mumkin emas!`;
    }
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  if (mode === "auto") {
    // Eng yaqin bo'sh slotni hisoblash
    let slot = effDay.enabled ? calculateSlotFromPatientsList(devPatients, duration, appDate, currentWorkSchedule) : { error: "Dam olish kuni", isFull: true };
    
    // Agar bugungi kunda navbat to'lgan bo'lsa yoki dam olish kuni bo'lsa -> Avtomatik keyingi kunlardan eng yaqinini qidirish!
    if (slot.error || slot.isFull) {
      const earliest = await findEarliestAvailableSlot(docId, serviceText, appDate);
      if (!earliest.error) {
        appDate = earliest.date;
        const pDateEl = document.getElementById("patientAppDate");
        if (pDateEl) pDateEl.value = appDate;
        slot = earliest.slot;

        lastCalculatedSlot = slot;
        isCurrentSlotValid = true;

        const labInfoStr = earliest.durInfo.laborantNames.length > 0 ? ` (Laborant: ${earliest.durInfo.laborantNames.join(', ')})` : '';

        if (alertEl) {
          alertEl.style.background = "#fef3c7";
          alertEl.style.color = "#92400e";
          alertEl.innerHTML = `⚡ <strong>Eng yaqin bo'sh navbat:</strong> ${slot.slotString} (${appDate} - ${earliest.dayName})<br><small style="color:#b45309;">* Oldingi kunlardagi navbatlar to'lganligi sababli eng yaqin bo'sh kunga belgilandi${labInfoStr}.</small>`;
        }

        if (submitBtn) submitBtn.disabled = false;
        if (deferContainer) deferContainer.style.display = (appDate !== todayDateStr) ? "block" : "none";
        return;
      } else {
        isCurrentSlotValid = false;
        lastCalculatedSlot = null;
        if (alertEl) {
          alertEl.style.background = "#fee2e2";
          alertEl.style.color = "#b91c1c";
          alertEl.innerHTML = `❌ <strong>DIQQAT:</strong> ${escapeHtml(earliest.error || slot.error)}`;
        }
        if (submitBtn) submitBtn.disabled = true;
        return;
      }
    }

    lastCalculatedSlot = slot;
    isCurrentSlotValid = true;

    const labInfoStr = resolvedDurInfo.laborantNames.length > 0 ? ` <span style="font-size:0.8rem; color:#0369a1;">[Laborant: ${resolvedDurInfo.laborantNames.join(', ')}]</span>` : '';

    if (alertEl) {
      alertEl.style.background = "#dcfce7";
      alertEl.style.color = "#15803d";
      alertEl.innerHTML = `✅ <strong>Eng yaqin bo'sh vaqt:</strong> ${slot.slotString} (${appDate === todayDateStr ? 'Bugun' : appDate} - ${effDay.title || effDay.name})${labInfoStr}`;
    }

    if (submitBtn) submitBtn.disabled = false;

    if (deferContainer) {
      deferContainer.style.display = (appDate !== todayDateStr) ? "block" : "none";
    }
  } else {
    // Ixtiyoriy kiritilgan vaqt
    const startMin = timeToMinutes(customStartTime);
    const endMin = startMin + duration;
    const customEndTime = addMinutesToTime(customStartTime, duration);
    const slotStr = `${customStartTime} - ${customEndTime}`;

    const slotCalcEl = document.getElementById("customCalculatedSlot");
    if (slotCalcEl) slotCalcEl.innerText = slotStr;

    // Bugun bo'lsa -> o'tgan vaqt tekshiruvi
    if (appDate === todayDateStr) {
      const now = new Date();
      const curMin = now.getHours() * 60 + now.getMinutes();
      if (startMin < curMin) {
        isCurrentSlotValid = false;
        if (alertEl) {
          alertEl.style.background = "#fee2e2";
          alertEl.style.color = "#b91c1c";
          alertEl.innerHTML = `❌ <strong>O'tib ketgan vaqt!</strong> Tanlangan vaqt (${customStartTime}) joriy vaqtdan (${minutesToTime(curMin)}) oldinda. O'tgan soatlarga navbat yozib bo'lmaydi!`;
        }
        if (submitBtn) submitBtn.disabled = true;
        return;
      }
    }

    // Tanlangan kundagi ish vaqti chegaralari tekshiruvi
    const startWorkMin = timeToMinutes(effDay.start || "08:00");
    const endWorkMin = timeToMinutes(effDay.end || "19:30");
    if (startMin < startWorkMin || endMin > endWorkMin) {
      isCurrentSlotValid = false;
      if (alertEl) {
        alertEl.style.background = "#fee2e2";
        alertEl.style.color = "#b91c1c";
        alertEl.innerHTML = `❌ <strong>Ish vaqtidan tashqari!</strong> ${effDay.title || effDay.name} kunida qabul faqat ish soatlari (${effDay.start || '08:00'} - ${effDay.end || '19:30'}) orasida bo'lishi shart!`;
      }
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    // To'qnashuv (Overlap) tekshiruvi
    const conflict = checkSlotConflict(devPatients, startMin, endMin);

    if (conflict.hasConflict) {
      isCurrentSlotValid = false;
      if (alertEl) {
        alertEl.style.background = "#fee2e2";
        alertEl.style.color = "#b91c1c";
        alertEl.innerHTML = `❌ <strong>DIQQAT! Bu vaqt BAND:</strong> Ushbu vaqtda boshqa bemor bor: <strong>${escapeHtml(conflict.conflictingPatient.name || conflict.conflictingPatient.ticketId)}</strong> (${escapeHtml(conflict.conflictTime)}). Iltimos, boshqa bo'sh vaqt tanlang!`;
      }
      if (submitBtn) submitBtn.disabled = true;
    } else {
      isCurrentSlotValid = true;
      lastCalculatedSlot = { startTime: customStartTime, endTime: customEndTime, slotString: slotStr };
      if (alertEl) {
        alertEl.style.background = "#dcfce7";
        alertEl.style.color = "#15803d";
        alertEl.innerHTML = `✅ <strong>Ushbu vaqt BO'SH!</strong> Qabul vaqti: <strong>${slotStr}</strong> (${appDate === todayDateStr ? 'Bugun' : appDate} - ${effDay.title || effDay.name})`;
      }
      if (submitBtn) submitBtn.disabled = false;
    }

    if (deferContainer) {
      deferContainer.style.display = "block";
    }
  }
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

    // To'qnashuv sharti: Math.max(newStart, pStart) < Math.min(newEnd, pEnd)
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

function calculateSlotFromPatientsList(devPatients, duration, targetDate = null, schedule = null, timeConstraints = null) {
  return findEarliestFreeSlot(devPatients, duration, targetDate, schedule, timeConstraints);
}

// OCHIQ VAQTLAR (GAP) NI TEKSHIRIB ENG YAQUIN BO'SH VAQTNI TOPISH
function findEarliestFreeSlot(devPatients, duration, targetDate = null, schedule = null, timeConstraints = null) {
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
  const dayName = effDay.title || effDay.name || "Ish kuni";

  // Dam olish kuni yoki bayram tekshiruvi
  if (!effDay.enabled) {
    return {
      error: `Tanlangan sana (${checkDate} - ${dayName}) dam olish kuni hisoblanadi. Navbat berish taqiqlangan!`,
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

  let startWorkMin = timeToMinutes(effDay.start || "08:00");
  let endWorkMin = timeToMinutes(effDay.end || "19:30");

  // Agar qoidalar bo'yicha maxsus vaqt chegarasi (masalan: 08:00 - 14:00) bo'lsa:
  if (timeConstraints) {
    if (timeConstraints.allowedTimeStart) {
      startWorkMin = Math.max(startWorkMin, timeToMinutes(timeConstraints.allowedTimeStart));
    }
    if (timeConstraints.allowedTimeEnd) {
      endWorkMin = Math.min(endWorkMin, timeToMinutes(timeConstraints.allowedTimeEnd));
    }
  }

  // 3. Bugungi kun bo'lsa -> Hozirgi vaqtdan boshlab qidirish
  let searchStartMin = startWorkMin;
  if (checkDate === todayStr) {
    const curNowMin = now.getHours() * 60 + now.getMinutes();
    const roundedNowMin = Math.ceil(curNowMin / 5) * 5;
    searchStartMin = Math.max(startWorkMin, roundedNowMin);
  }

  const timeLimitDisplay = timeConstraints ? `${timeConstraints.allowedTimeStart || effDay.start} - ${timeConstraints.allowedTimeEnd || effDay.end}` : `${effDay.start || "08:00"} - ${effDay.end || "19:30"}`;

  if (searchStartMin + dur > endWorkMin) {
    return {
      error: `Ushbu kunda belgilangan qabul vaqti (${dayName}: ${timeLimitDisplay}) tugagan yoki vaqt yetarli emas! Keyingi ish kunini tanlang.`,
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
    error: `Ushbu kunga barcha navbatlar to'lgan (${dayName} ish soatlari: ${timeLimitDisplay}). Keyingi ish kunini tanlang!`,
    isFull: true
  };
}

function minutesToTime(totalMins) {
  const h = String(Math.floor(totalMins / 60) % 24).padStart(2, "0");
  const m = String(totalMins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// 6. BEMOR QO'SHISH (FORM SUBMIT)
async function handlePatientSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("patientName").value.trim();
  const ticketId = document.getElementById("patientId").value.trim();
  const patientType = document.getElementById("patientTypeSelect") ? document.getElementById("patientTypeSelect").value : "Ambulator";
  const department = document.getElementById("patientDepartment") ? document.getElementById("patientDepartment").value.trim() : "";
  const referringDoctor = document.getElementById("patientReferringDoctor") ? document.getElementById("patientReferringDoctor").value.trim() : "";
  const phone = document.getElementById("patientPhone").value.trim();
  const age = document.getElementById("patientAge").value.trim();
  const docId = document.getElementById("doctorSelect").value;
  const appDate = document.getElementById("patientAppDate").value || todayDateStr;
  const duration = parseInt(document.getElementById("patientDuration").value, 10) || 30;
  const service = document.getElementById("serviceType").value.trim() || "MRT / MSKT Tekshiruvi";
  const notes = document.getElementById("patientNotes").value.trim();
  const mode = document.querySelector('input[name="timeSlotMode"]:checked').value;

  if (!ticketId) {
    alert("Iltimos, Bemor ID yoki Talon raqamini kiriting!");
    document.getElementById("patientId").focus();
    return;
  }

  const selectedDoctor = doctorsList.find(d => d.id === docId);
  if (!selectedDoctor) {
    alert("Iltimos, qurilma / xonani tanlang!");
    return;
  }

  await onDateOrDoctorOrTimeChanged();

  if (!isCurrentSlotValid || !lastCalculatedSlot) {
    alert("⚠️ Tanlangan vaqt band yoki xato! Iltimos, boshqa bo'sh vaqtni tanlang.");
    return;
  }

  // Voz kechish sababi
  let deferReason = "";
  if (appDate !== todayDateStr || mode === "custom") {
    const rSelect = document.getElementById("deferReasonSelect").value;
    const rOther = document.getElementById("deferReasonOtherText").value.trim();
    deferReason = (rSelect === "Boshqa sabab" ? (rOther || "Boshqa sabab") : rSelect);
  }

  const newPatient = {
    ticketId: ticketId,
    name: name,
    patientType: patientType,
    department: department,
    referringDoctor: referringDoctor,
    phone: phone,
    age: age,
    doctorId: selectedDoctor.id,
    doctorName: selectedDoctor.name,
    room: selectedDoctor.room,
    deviceType: selectedDoctor.specialty && selectedDoctor.specialty.includes("MSKT") ? "MSKT" : "MRT",
    service: service,
    duration: duration,
    appointmentDate: appDate,
    scheduledTime: lastCalculatedSlot.startTime,
    endTime: lastCalculatedSlot.endTime,
    timeSlot: lastCalculatedSlot.slotString,
    rescheduleReason: deferReason,
    operatorLogin: "TB1",
    operatorName: "Turatov Hojiakbar",
    registeredBy: "TB1 - Turatov Hojiakbar",
    notes: notes + (deferReason ? ` [Sabab: ${deferReason}]` : ""),
    status: "waiting",
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  // Firebase-ga saqlash
  const newRef = db.ref(`patients/${appDate}`).push();
  newRef.set(newPatient).then(() => {
    document.getElementById("patientForm").reset();
    togglePatientDepartment();
    
    // Agar boshqa sana uchun qo'shilgan bo'lsa, o'sha sanaga o'tamiz
    if (selectedQueueDate !== appDate) {
      const qDateEl = document.getElementById("queueDateFilter");
      if (qDateEl) qDateEl.value = appDate;
      listenToPatients(appDate);
    }

    switchTab("queue-tab");

    // Talon chop etish modalini ochish va to'g'ridan-to'g'ri chop etishga yo'naltirish
    openPrintModalDirect(newPatient, true);
  }).catch((err) => {
    alert("Xatolik yuz berdi: " + err.message);
  });
}

let currentPrintPatient = null;
let currentTicketLang = "uz";

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

// 7. TALONNI CHOP ETISH (KO'P TILLI)
function openPrintModal(patientDbId, lang = null) {
  const patient = patientsList.find(p => p.id === patientDbId);
  if (patient) {
    openPrintModalDirect(patient, false, lang || getI18nLanguage());
  }
}

function reprintTicketWithLang(lang) {
  if (currentPrintPatient) {
    openPrintModalDirect(currentPrintPatient, false, lang);
  }
}

function openPrintModalDirect(patient, autoTriggerPrint = false, lang = "uz") {
  currentPrintPatient = patient;
  currentTicketLang = lang || (typeof getI18nLanguage === 'function' ? getI18nLanguage() : 'uz') || 'uz';

  const L = currentTicketLang;
  const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket && I18N_TRANSLATIONS.ticket[L]) 
    ? I18N_TRANSLATIONS.ticket[L] 
    : (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket ? I18N_TRANSLATIONS.ticket['uz'] : null);

  // Til tugmalarining faol holatini yangilash
  document.querySelectorAll("#ticketModal .btn-lang-choice").forEach(btn => {
    if (btn.getAttribute("data-lang") === L) {
      btn.style.border = "1.5px solid #0284c7";
      btn.style.background = "#e0f2fe";
      btn.style.color = "#0369a1";
    } else {
      btn.style.border = "1px solid #cbd5e1";
      btn.style.background = "#ffffff";
      btn.style.color = "#334155";
    }
  });

  // Titul va sarlavhalar
  const headerCenter = document.getElementById("ticketPrintHeaderCenter");
  const headerSub = document.getElementById("ticketPrintHeaderSub");
  if (headerCenter && dict) headerCenter.innerText = dict.centerName;
  if (headerSub && dict) headerSub.innerText = dict.ticketTitle;

  // Statik yorliqlar (Labels)
  if (document.getElementById("ticketPrintLblPatient") && dict) document.getElementById("ticketPrintLblPatient").innerText = dict.patient;
  if (document.getElementById("ticketPrintLblPatientType") && dict) document.getElementById("ticketPrintLblPatientType").innerText = dict.patientType;
  if (document.getElementById("ticketPrintLblReferringDoctor") && dict) document.getElementById("ticketPrintLblReferringDoctor").innerText = dict.referringDoctor;
  if (document.getElementById("ticketPrintLblRoom") && dict) document.getElementById("ticketPrintLblRoom").innerText = dict.roomDevice ? dict.roomDevice.split('/')[0].trim() + ":" : "Xona:";
  if (document.getElementById("ticketPrintLblDoctor") && dict) document.getElementById("ticketPrintLblDoctor").innerText = dict.roomDevice ? (dict.roomDevice.split('/')[1] || dict.roomDevice).trim() + ":" : "Qurilma:";
  if (document.getElementById("ticketPrintLblService") && dict) document.getElementById("ticketPrintLblService").innerText = dict.service;
  if (document.getElementById("ticketPrintLblBookedTime") && dict) document.getElementById("ticketPrintLblBookedTime").innerText = dict.bookedTime;
  if (document.getElementById("ticketPrintLblRegistrar") && dict) document.getElementById("ticketPrintLblRegistrar").innerText = dict.operator;
  if (document.getElementById("ticketPrintLblTime") && dict) document.getElementById("ticketPrintLblTime").innerText = dict.appointmentDate;
  if (document.getElementById("ticketPrintFooterNotice") && dict) document.getElementById("ticketPrintFooterNotice").innerText = dict.timeNotice;
  if (document.getElementById("ticketPrintFooterThanks") && dict) document.getElementById("ticketPrintFooterThanks").innerText = dict.footerThanks;
  if (document.getElementById("ticketPrintLblOnlineResults") && dict) document.getElementById("ticketPrintLblOnlineResults").innerText = dict.onlineResults || "📱 JAVOBLARNI ONLAYN OLISH:";

  document.getElementById("ticketPrintNum").innerText = patient.ticketId || "ID";
  document.getElementById("ticketPrintName").innerText = patient.name || "-";

  const dobRow = document.getElementById("ticketPrintDobRow");
  const dobEl = document.getElementById("ticketPrintBirthDate");
  if (dobRow && dobEl) {
    if (patient.birthDate) {
      dobRow.style.display = "flex";
      dobEl.innerText = patient.birthDate;
    } else {
      dobRow.style.display = "none";
    }
  }
  
  const isStat = patient.patientType === "Bo'limda yotibdi" || patient.isStationary || (patient.priority && String(patient.priority).toLowerCase().includes("statsionar"));
  const deptSuffix = patient.department ? ` (${patient.department})` : '';
  const typeText = isStat
    ? `${dict ? dict.stationary : "🏥 Bo'limda yotibdi"}${deptSuffix}`
    : `${dict ? dict.ambulatory : "🏠 Ambulator"}${deptSuffix}`;
  const typeEl = document.getElementById("ticketPrintPatientType");
  if (typeEl) typeEl.innerText = typeText;

  const docRow = document.getElementById("ticketPrintDocRow");
  const docEl = document.getElementById("ticketPrintReferringDoctor");
  if (docRow && docEl) {
    if (patient.referringDoctor) {
      docRow.style.display = "flex";
      docEl.innerText = patient.referringDoctor;
    } else {
      docRow.style.display = "none";
    }
  }

  document.getElementById("ticketPrintRoom").innerText = (typeof formatRoomWithOriginal === 'function') ? formatRoomWithOriginal(patient.room, patient.doctorName, L) : (patient.room || "-");
  document.getElementById("ticketPrintDoctor").innerText = patient.doctorName || "-";
  document.getElementById("ticketPrintService").innerText = ((typeof formatServiceNameWithOriginal === 'function') ? formatServiceNameWithOriginal(patient.service, L) : (patient.service || "Tomografiya")) + (patient.isContrast ? ` ${dict ? dict.contrastBadge : '[KONTRASTLI]'}` : "");
  document.getElementById("ticketPrintTimeSlot").innerText = patient.timeSlot || patient.scheduledTime || (patient.time || "-");
  document.getElementById("ticketPrintRegistrar").innerText = patient.registeredBy || (patient.operatorLogin ? `${patient.operatorLogin} - ${patient.operatorName || ''}` : "TB1 - Turatov Hojiakbar");
  const appDateDisplay = patient.appointmentDate || selectedQueueDate || todayDateStr;
  document.getElementById("ticketPrintTime").innerText = (patient.time || "") + " | " + appDateDisplay;

  const guideEl = document.getElementById("ticketPrintGuidelines");
  if (guideEl) {
    let guidelinesHtml = "";
    if (patient.rescheduleReason) {
      const translatedReason = (typeof translateDeferReason === 'function') ? translateDeferReason(patient.rescheduleReason, L) : patient.rescheduleReason;
      guidelinesHtml += `<div style="margin-bottom:6px; font-size:12px; font-weight:bold; color:#000;"><strong>${escapeHtml(dict ? dict.reasonLabel : "Sabab:")}</strong> ${escapeHtml(translatedReason)}</div>`;
    }
    const guideBoxHtml = formatConsolidatedGuidelinesHtml(patient, L);
    if (guideBoxHtml) {
      guidelinesHtml += guideBoxHtml;
    }

    if (guidelinesHtml) {
      guideEl.style.display = "block";
      guideEl.innerHTML = guidelinesHtml;
    } else {
      guideEl.style.display = "none";
      guideEl.innerHTML = "";
    }
  }

  document.getElementById("ticketModal").classList.add("open");

  if (autoTriggerPrint) {
    setTimeout(() => {
      window.print();
    }, 250);
  }
}

function closeTicketModal() {
  document.getElementById("ticketModal").classList.remove("open");
}

function toggleArrivedStatus(patientDbId) {
  const patient = patientsList.find(p => p.id === patientDbId);
  if (!patient) return;
  const targetDate = (patient.appointmentDate) ? patient.appointmentDate : (selectedQueueDate || todayDateStr);
  const newStatus = !patient.arrived;
  
  db.ref(`patients/${targetDate}/${patientDbId}`).update({
    arrived: newStatus,
    arrivedAt: newStatus ? firebase.database.ServerValue.TIMESTAMP : null
  });
}

function printConsentForm(patientDbId, lang = null) {
  const patient = patientsList.find(p => p.id === patientDbId);
  if (patient) {
    printConsentFormDirect(patient, lang || getI18nLanguage());
  }
}

function printConsentFormDirect(payload, lang = null) {
  try {
    const L = lang || payload.printLang || getI18nLanguage() || 'uz';
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

    // Savolnomani ko'p tilli tarjima qilish
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

    const isStat = payload.patientType === "Bo'limda yotibdi" || payload.isStationary || (payload.priority && String(payload.priority).toLowerCase().includes("statsionar"));
    const deptSuffix = payload.department ? ` (${payload.department})` : '';
    const typeText = isStat
      ? `${dict ? dict.stationary : "Bo'limda yotibdi"}${deptSuffix}`
      : `${dict ? dict.ambulatory : "Ambulator"}${deptSuffix}`;

    // 1. Nashr sanasi
    let rawQueueDate = payload.appointmentDate || payload.date || (typeof selectedQueueDate !== 'undefined' ? selectedQueueDate : '') || (typeof todayDateStr !== 'undefined' ? todayDateStr : '') || '';
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
    alert("Anketa chop etishda xatolik: " + err.message);
  }
}

function changeSystemLanguage(langCode) {
  if (typeof setI18nLanguage === 'function') {
    setI18nLanguage(langCode);
  }
  const sel = document.getElementById("globalLangSelector");
  if (sel) sel.value = langCode;

  renderQueueTable();
}

function deletePatient(patientDbId) {
  const patient = patientsList.find(p => p.id === patientDbId);
  const pName = patient ? patient.name : "bemor";
  const oldSlot = patient ? (patient.timeSlot || patient.scheduledTime || "") : "";
  if (confirm(`Haqiqatdan ham "${pName}"ni navbatdan o'chirmoqchimisiz?\n\n(Bemor ma'lumotlari saqlanadi, egallagan vaqti [${oldSlot}] esa boshqa bemorlar uchun to'liq bo'shatiladi)`)) {
    const targetDate = (patient && patient.appointmentDate) ? patient.appointmentDate : (selectedQueueDate || todayDateStr);
    db.ref(`patients/${targetDate}/${patientDbId}`).update({
      status: "cancelled",
      cancelledSlot: oldSlot,
      cancelledScheduledTime: patient.scheduledTime || "",
      cancelledEndTime: patient.endTime || "",
      scheduledTime: "",
      endTime: "",
      timeSlot: "",
      cancelledAt: firebase.database.ServerValue.TIMESTAMP,
      cancelledBy: "TB1 - Turatov Hojiakbar"
    });
  }
}

async function restorePatient(patientDbId) {
  const patient = patientsList.find(p => p.id === patientDbId);
  if (!patient) return;
  const pName = patient.name || "Bemor";
  const targetDate = (patient.appointmentDate) ? patient.appointmentDate : (selectedQueueDate || todayDateStr);
  const duration = parseInt(patient.duration, 10) || 30;

  // 1. Shu kungi ushbu qurilmadagi barcha faol (band) bemorlarni olish
  let devPatients = [];
  try {
    const snap = await db.ref(`patients/${targetDate}`).once("value");
    const data = snap.val();
    if (data) {
      Object.keys(data).forEach(k => {
        const item = data[k];
        item.id = k;
        if (item.doctorId === patient.doctorId && item.status !== "cancelled" && k !== patientDbId) {
          devPatients.push(item);
        }
      });
    }
  } catch (e) {
    devPatients = patientsList.filter(p => p.doctorId === patient.doctorId && p.status !== "cancelled" && p.id !== patientDbId);
  }

  // 2. Eng birinchi bo'sh vaqt oralig'ini topish
  const newSlot = findEarliestFreeSlot(devPatients, duration);

  const confirmMsg = `"${pName}"ni navbatga qayta tiklash:\n\n` +
                     `🏥 Qurilma: ${patient.doctorName || patient.room}\n` +
                     `⏱ Tekshiruv vaqti: ${duration} daqiqa\n` +
                     `🕒 Yangi ajratilgan bo'sh vaqt: ${newSlot.slotString}\n\n` +
                     `Ushbu yangi bo'sh vaqt bilan navbatga qo'yishni tasdiqlaysizmi?`;

  if (confirm(confirmMsg)) {
    db.ref(`patients/${targetDate}/${patientDbId}`).update({
      status: "waiting",
      scheduledTime: newSlot.startTime,
      endTime: newSlot.endTime,
      timeSlot: newSlot.slotString,
      cancelledSlot: null,
      restoredAt: firebase.database.ServerValue.TIMESTAMP,
      notes: (patient.notes || "") + ` [Qayta tiklandi: yangi vaqt ${newSlot.slotString}]`
    }).then(() => {
      openPrintModalDirect({
        ...patient,
        status: "waiting",
        scheduledTime: newSlot.startTime,
        endTime: newSlot.endTime,
        timeSlot: newSlot.slotString
      }, false);
    });
  }
}

// 8. EXCEL (CSV) YUKLAB OLISH
function exportToCSV() {
  if (patientsList.length === 0) {
    alert("Yuklab olish uchun bemorlar mavjud emas!");
    return;
  }

  let csvContent = "\uFEFF"; // UTF-8 BOM o'zbek harflari to'g'ri chiqishi uchun
  csvContent += "Talon ID,F.I.Sh,Telefon,Yoshi,Vrach,Xona,Xizmat,Holat,Vaqt,Sana\n";

  patientsList.forEach((p) => {
    const statusText = getStatusBadge(p.status).label;
    const row = [
      `"${p.ticketId || ''}"`,
      `"${p.name || ''}"`,
      `"${p.phone || ''}"`,
      `"${p.age || ''}"`,
      `"${p.doctorName || ''}"`,
      `"${p.room || ''}"`,
      `"${p.service || ''}"`,
      `"${statusText}"`,
      `"${p.time || ''}"`,
      `"${todayDateStr}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `UTT_Navbat_${todayDateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 9. VRACHLARNI BOSHQARISH
function renderDoctors() {
  const container = document.getElementById("doctorsContainer");
  if (!container) return;

  container.innerHTML = doctorsList.map(doc => `
    <div class="doctor-card">
      <span class="room-badge">${escapeHtml(doc.room)}</span>
      <h3>${escapeHtml(doc.name)}</h3>
      <p><i class="fa-solid fa-stethoscope"></i> ${escapeHtml(doc.specialty || "Shifokor")}</p>
      <div style="margin-top:auto; display:flex; gap:8px;">
        <button class="btn btn-secondary btn-small" onclick="openEditDoctorModal('${doc.id}')">
          <i class="fa-solid fa-pen"></i> Tahrirlash
        </button>
        <button class="btn btn-secondary btn-small" style="color:var(--danger);" onclick="deleteDoctor('${doc.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join("");
}

function updateDoctorSelectOptions() {
  const select = document.getElementById("doctorSelect");
  const filter = document.getElementById("doctorFilter");
  
  if (select) {
    select.innerHTML = `<option value="">-- Tanlang --</option>` + doctorsList.map(d => `
      <option value="${d.id}">${escapeHtml(d.room)}: ${escapeHtml(d.name)} (${escapeHtml(d.specialty || '')})</option>
    `).join("");
  }

  if (filter) {
    filter.innerHTML = `<option value="all">Barcha Vrachlar / Xonalar</option>` + doctorsList.map(d => `
      <option value="${d.id}">${escapeHtml(d.room)} - ${escapeHtml(d.name)}</option>
    `).join("");
  }
}

function openAddDoctorModal() {
  document.getElementById("doctorModalTitle").innerText = "Yangi Vrach Qo'shish";
  document.getElementById("doctorId").value = "";
  document.getElementById("doctorForm").reset();
  document.getElementById("doctorModal").classList.add("open");
}

function openEditDoctorModal(docId) {
  const doc = doctorsList.find(d => d.id === docId);
  if (!doc) return;
  document.getElementById("doctorModalTitle").innerText = "Vrachni Tahrirlash";
  document.getElementById("doctorId").value = doc.id;
  document.getElementById("docName").value = doc.name;
  document.getElementById("docRoom").value = doc.room;
  document.getElementById("docSpecialty").value = doc.specialty || "";
  document.getElementById("doctorModal").classList.add("open");
}

function closeDoctorModal() {
  document.getElementById("doctorModal").classList.remove("open");
}

function handleDoctorSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("doctorId").value;
  const name = document.getElementById("docName").value.trim();
  const room = document.getElementById("docRoom").value.trim();
  const specialty = document.getElementById("docSpecialty").value.trim();

  const data = { name, room, specialty };

  if (id) {
    // Tahrirlash
    db.ref(`doctors/${id}`).update(data).then(() => closeDoctorModal());
  } else {
    // Yangi qo'shish
    db.ref("doctors").push(data).then(() => closeDoctorModal());
  }
}

function deleteDoctor(docId) {
  if (confirm("Ushbu vrachni ro'yxatdan o'chirmoqchimisiz?")) {
    db.ref(`doctors/${docId}`).remove();
  }
}

// 10. TEKSHIRUVLAR KATALOGI VA VAQTLARINI BOSHQARISH
let servicesList = [];

// Boshlang'ich barcha MRT va MSKT tekshiruvlari ro'yxati (standart 30 daqiqadan)
const RAW_DEFAULT_SERVICES = [
  // MSKT Xizmatlari
  { code: "R134", name: "Bosh Miya MSKT Tekshiruvi (Kontrast Moddasiz)", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R135", name: "Bosh Miya Mskt Tekshiruvi (Vena ichi Kontrast Modda Bilan)", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R138", name: "Bosh-Boyin Kontrast Moddasiz MSKT Tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R139", name: "Bosh-Boyin Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R136", name: "Gipofiz bezining kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R137", name: "Gipofiz bezining vena ichi kontrast moddasi bilan MSKT tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R151", name: "Umurtqa pogonasi (1-bolimi)ni kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R152", name: "Umurtqa Pogonasi (1-Bolimi) ni Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R140", name: "Kokrak qafasi organlarini kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R142", name: "Kokrak qafasi organlarini vena ichi Kontrast Moddasi Bilan MSKT Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R141", name: "Kokrak qafasi organlarini kontrast moddasi bilan MSKT tekshiruvi PER OS", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R143", name: "Qorin boshligi va qorin Pardaorti Azolarini Kontrast Moddasiz Mskt Tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R144", name: "Qorin Boshligi Va Qorin Pardaorti Azolarini Kontrast Moddasi Bilan Mskt Tekshiruvi Per Os", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R145", name: "Qorin Boshligi Va Qorin Pardaorti Azolarini Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R149", name: "Buyrak Usti Bezini Kontrast Moddasiz Mskt Tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R150", name: "Buyrak Usti Bezini Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R146", name: "Kichik tos azolarini kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R148", name: "Kichik Tos Azolarini Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R147", name: "Kichik Tos Azolarini Kontrast Moddasi Bilan Mskt Tekshiruvi Per Os", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R153", name: "Bogimlar Mskt Tekshiruvi (1 Soha)", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R154", name: "Qol Va Oyoqlarning Kontrast Moddasiz Mskt Tekshiruvi (1 Soha)", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R155", name: "Qol Va Oyoqlarning Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi (1 Soha)", type: "MSKT", isContrast: true, duration: 30 },

  // MRT Xizmatlari
  { code: "R157", name: "Bosh Miya Mrt Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R159", name: "Bosh Miya Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R158", name: "Bosh Miya Mrt Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R163", name: "Bosh Miya Angiografiya Mrt MPA/MPB", type: "MRT", isContrast: false, duration: 30 },
  { code: "R162", name: "Bosh Miya Angiografiya Mrt (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R160", name: "Bosh Miya Mrt + Trayektografiya Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R212", name: "Mrt bosh miya+ kontrastsiz Mr-Arterio I Venografiya", type: "MRT", isContrast: false, duration: 30 },
  { code: "R211", name: "Mrt bosh miya I Bosh miya yumshoq toqima T1 + Contrast", type: "MRT", isContrast: true, duration: 30 },
  { code: "R214", name: "Bosh miyaning MRT si+DTI", type: "MRT", isContrast: false, duration: 30 },
  { code: "R213", name: "Bosh miyaning MRT si+FIESTA rejimida", type: "MRT", isContrast: false, duration: 30 },
  { code: "R209", name: "Bosh miyaning va bosh sohasidagi yumshoq to`qimalarning MRT si", type: "MRT", isContrast: false, duration: 30 },
  { code: "R210", name: "Bosh miyaning va bosh sohasidagi yumshoq to`qimalarning MRTsi, T1 rejimida", type: "MRT", isContrast: false, duration: 30 },
  { code: "R161", name: "Gipofiz MRT + kontrast", type: "MRT", isContrast: true, duration: 30 },
  { code: "R164", name: "Koz va orbita MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R165", name: "Yestaxeviy nay va Ichki quloq Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R199", name: "Sinusit Va Burun boshliqlari MRT (Yuz-Jag Bogimlari)", type: "MRT", isContrast: false, duration: 30 },
  { code: "R166", name: "Boyin Umurtqalari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R200", name: "Boyin Limfa Tugunlari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R172", name: "Boyin qon Tomirlari Angiografiya Mrt", type: "MRT", isContrast: true, duration: 30 },
  { code: "R171", name: "Boyin qon Tomirlari Angiografiya Mrt (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R167", name: "Kokrak umurtqalari MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R191", name: "Sut Bezlari MRT Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R193", name: "Sut Bezlari Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R192", name: "Sut Bezlari Mrt Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R173", name: "Yurak Mrt Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R175", name: "Yurak qon Tomirlari Angiografiya Mrt", type: "MRT", isContrast: true, duration: 30 },
  { code: "R174", name: "Yurak qon Tomirlari Angiografiya Mrt (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R177", name: "Jigar Mrt Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R179", name: "Jigar Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R178", name: "Jigar MRT Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R180", name: "Oshqozon Osti Bezi Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R181", name: "Buyraklar Va Siydik Chiqarish Yollari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R203", name: "Qorin boshligi azolarining MRTsi+tomir ichiga kontrast modda", type: "MRT", isContrast: true, duration: 30 },
  { code: "R204", name: "Mrt qorin boshligi azolari + V/V Kontrast", type: "MRT", isContrast: true, duration: 30 },
  { code: "R182", name: "Kichik chanoq azolari MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R201", name: "Mrt kichik tos azolari + V/V Kontrastlashgan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R202", name: "Mrt kichik tos azolari + V/V Kontrastirovanie", type: "MRT", isContrast: true, duration: 30 },
  { code: "R4896", name: "Qorin boshligi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R188", name: "Chanoq Son Bogimi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R190", name: "Chanoq Son Bogimi Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R189", name: "Chanoq Son Bogimi Mrt Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R217", name: "Son bo`g`imlari va orqa chanoq (iliyosakral) bo'g'imlarining MRT si", type: "MRT", isContrast: false, duration: 30 },
  { code: "R168", name: "Bel Umurtqalari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R169", name: "Butun umurtqa MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R170", name: "Spinal Kanal Va Jigar Nervlari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R206", name: "Orqa miya MRT si+Traktografiya", type: "MRT", isContrast: false, duration: 30 },
  { code: "R219", name: "Orqa miyaning yuqori uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R218", name: "Orqa miyaning yuqori uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R222", name: "Orqa miyaning pastki uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R221", name: "Orqa miyaning orta uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R220", name: "Orqa miyaning orta uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R215", name: "Orqa miyaning o'rta uchdan bir qismi+umurtqa pogonasining MRT si", type: "MRT", isContrast: false, duration: 30 },
  { code: "R216", name: "Bel sohasi uchinchi (L3) darajadagi orqa miya+umurtqa pogonasining MRT tekshiruvi", type: "MRT", isContrast: false, duration: 30 },
  { code: "R223", name: "Orqa miyaning pastki uchdan bir qismi+umurtqa pogonasining MRT si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R183", name: "Yelka bogimi Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R186", name: "Tirsak Bogimi Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R184", name: "Qol-Kaft Bogimi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R185", name: "Tizza Bogimi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R187", name: "Tovon/ boldir-tovon bogimi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R205", name: "Mrt Yumshoq toqima azolari", type: "MRT", isContrast: false, duration: 30 },
  { code: "R197", name: "Ong va chap qol qon tomirlari MRT Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R196", name: "Ong va chap qol qon tomirlari Mrt Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R195", name: "Ong va chap Oyoq qon tomirlari Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R194", name: "Ong va chap oyoq qon tomirlari Mrt kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R4929", name: "Bosh miya yumshoq toqima MRT/ MRT yuz qismi", type: "MRT", isContrast: false, duration: 30 },
  { code: "R4920", name: "Boyin yumshoq toqimalari MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R198", name: "Butun Tanani Skrining Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R207", name: "Plyonka nusxasi, Disk I Xulosa", type: "MRT", isContrast: false, duration: 15 },
  { code: "R208", name: "Disk nusxasi (yoki qoshimcha)", type: "MRT", isContrast: false, duration: 10 }
];

// Standart tibbiy tavsiyalar va savolnomalarni yaratish funksiyasi
function getClinicalGuidelines(s) {
  const name = (s.name || "").toLowerCase();
  const isContrast = s.isContrast === true || name.includes("kontrast") || name.includes("injektor") || name.includes("v/v");
  const isMSKT = s.type === "MSKT" || name.includes("mskt") || name.includes("msct") || name.includes("tomografiya");

  let preparation = "";
  let contraindications = "";
  const questionsList = [];

  if (name.includes("disk") || name.includes("plyonka")) {
    preparation = "Tayyorgarlik talab etilmaydi.";
    contraindications = "Mavjud emas.";
    return { preparation, contraindications, questions: "" };
  }

  if (isMSKT) {
    if (isContrast) {
      preparation = "4-6 soat och qoringa kelish. Qonda Kreatinin va Mochevina tahlili (oxirgi 1 oy). Qandli diabet bo'lsa: Metformin 48 soat oldin to'xtatiladi. Tekshiruvdan so'ng ko'p suyuqlik ichish.";
      contraindications = "Yodli kontrastga allergiya, buyrak yetishmovchiligi (kreatinin yuqori), gipertireoz (bo'qoq), homiladorlik.";
    } else {
      if (name.includes("qorin") || name.includes("tos") || name.includes("buyrak") || name.includes("pardaorti")) {
        preparation = "4-6 soat och qoringa kelish. Tekshiruvdan 1 soat oldin 1 litr gazsiz toza suv ichish (qovuqni to'ldirish). Barcha metall buyumlar yechiladi.";
        contraindications = "Homiladorlik, tana vazni 150 kg dan yuqori bo'lishi.";
      } else {
        preparation = "Maxsus parhez talab etilmaydi. Tekshiriladigan sohadagi barcha metall buyumlar va taqinchoqlar yechiladi.";
        contraindications = "Homiladorlik (nisbiy), tana vazni 150 kg dan yuqori bo'lishi.";
      }
    }

    // MSKT Savolnomasi
    questionsList.push("Tanangizda kardiostimulyator yoki metall implantlar tekshiriladigan sohada mavjudmi?");
    questionsList.push("Homiladorlik holati bormi yoki homiladorlik ehtimoli mavjudmi?");
    questionsList.push("Oldin nur bilan davolanish (radioterapiya) yoki tez-tez rentgen tekshiruvlaridan o'tganmisiz?");
    if (isContrast) {
      questionsList.push("Dori vositalariga, yod preparatlariga yoki kontrast moddalarga allergik reaksiyangiz bo'lganmi?");
      questionsList.push("Buyrak yetishmovchiligi, qonda kreatinin yoki mochevina miqdori oshishi kuzatilganmi?");
      questionsList.push("Qandli diabet kasalligi bo'yicha Metformin (Glyukofaj, Siofor v.b.) dori vositasini qabul qilasizmi?");
      questionsList.push("Qalqonsimon bez kasalliklari (toksik bo'qoq / gipertireoz) mavjudmi?");
    } else {
      questionsList.push("Dori vositalariga yoki oziq-ovqatlarga jiddiy allergiyangiz bormi?");
      questionsList.push("Surunkali buyrak, jigar yoki yurak-qon tomir kasalliklari mavjudmi?");
    }
  } else {
    // MRT
    if (isContrast) {
      preparation = "4-6 soat och qoringa kelish. Qonda Kreatinin tahlili. Barcha ferromagnit metall buyumlar, soat, telefon, elektron kartalar yechiladi.";
      contraindications = "Kardiostimulyator (EKSM), ferromagnit implantlar/qisqichlar, koxlear implantlar, klavstrofobiya, og'ir buyrak yetishmovchiligi, homiladorlik (1-trimestr).";
    } else {
      if (name.includes("qorin") || name.includes("jigar") || name.includes("buyrak") || name.includes("tos") || name.includes("chanoq") || name.includes("oshqozon")) {
        preparation = "Kamida 4-6 soat och qoringa kelish. Gaz hosil qiluvchi mahsulotlarni 1 kun oldin cheklash. Barcha metall buyumlar va elektron jihozlar yechiladi.";
        contraindications = "Kardiostimulyator (EKSM), ferromagnit metall implantlar, koxlear implantlar, klavstrofobiya (yopiq joydan qo'rqish).";
      } else {
        preparation = "Maxsus parhez talab etilmaydi. Barcha ferromagnit metall buyumlar, soat, telefon, bank kartalari, kamar, sirg'a va kiyimdagi temir detallar yechiladi.";
        contraindications = "Kardiostimulyator (EKSM), ferromagnit metall buyumlar/implantlar, koxlear implantlar, klavstrofobiya (yopiq joydan qo'rqish).";
      }
    }

    // MRT Savolnomasi
    questionsList.push("Tanangizda kardiostimulyator (EKSM), sun'iy yurak klapani, koxlear implant yoki neyrostimulyator bormi?");
    questionsList.push("Tanangizda metall parchalar, ilonlar, temir plastina, klipsa yoki ferromagnit metall implant bormi?");
    questionsList.push("Homiladorlik holati bormi yoki ko'krak suti bilan emizasizmi?");
    questionsList.push("Yopiq joydan qo'rqish (klavstrofobiya), hushdan ketish, epilepsiya yoki tutqanoq holatlari bo'ladimi?");
    if (isContrast) {
      questionsList.push("Dori vositalariga, yod preparatlariga yoki kontrast moddalarga allergik reaksiyangiz bo'lganmi?");
      questionsList.push("Buyrak yetishmovchiligi, jigar kasalliklari yoki qonda kreatinin/mochevina miqdori oshishi bormi?");
      questionsList.push("Qandli diabet kasalligi bo'yicha Metformin (Glyukofaj, Siofor v.b.) dori vositasini qabul qilasizmi?");
    } else {
      questionsList.push("Dori vositalariga yoki boshqa moddalarga allergiyangiz bormi?");
      questionsList.push("Buyrak yoki jigar faoliyatida jiddiy yetishmovchiliklar mavjudmi?");
    }
  }

  return { preparation, contraindications, questions: questionsList.join("\n") };
}

const DEFAULT_SERVICES = RAW_DEFAULT_SERVICES.map(s => {
  const g = getClinicalGuidelines(s);
  return {
    ...s,
    preparation: s.preparation || g.preparation,
    contraindications: s.contraindications || g.contraindications,
    questions: s.questions || g.questions
  };
});

function listenToServices() {
  const svcRef = db.ref("services_catalog");
  svcRef.on("value", (snapshot) => {
    servicesList = [];
    const data = snapshot.val();
    
    if (!data) {
      initDefaultServices();
      return;
    }

    Object.keys(data).forEach((key) => {
      servicesList.push({ id: key, ...data[key] });
    });

    renderServicesTable();
  });
}

function initDefaultServices() {
  const seed = {};
  DEFAULT_SERVICES.forEach((s) => {
    const key = s.code.replace(/[^a-zA-Z0-9]/g, "_");
    seed[key] = s;
  });
  db.ref("services_catalog").set(seed);
}

function populateAllClinicalGuidelines() {
  if (confirm("Barcha tekshiruvlarga standart tibbiy tayyorgarlik, qarshi ko'rsatmalar va savolnomalarni to'ldirib chiqmoqchimisiz? (Belgilangan daqiqalar o'zgarmasdan saqlanadi)")) {
    const updates = {};
    servicesList.forEach((s) => {
      const g = getClinicalGuidelines(s);
      updates[`${s.id}/preparation`] = g.preparation;
      updates[`${s.id}/contraindications`] = g.contraindications;
      updates[`${s.id}/questions`] = g.questions;
    });
    db.ref("services_catalog").update(updates).then(() => {
      alert("✅ Barcha tekshiruvlarga standart tayyorgarlik, qarshi ko'rsatmalar va savolnomalar to'ldirildi!");
    });
  }
}

function resetAllServicesTo30Min() {
  if (confirm("Barcha tekshiruv vaqtlarini va standart tayyorgarlik ko'rsatmalarini boshlang'ich holatga qaytarmoqchimisiz?")) {
    initDefaultServices();
  }
}

// Helper: Tayyorgarlik matnidan tuzilmaviy ma'lumotlarni ajratish
function parseStructuredPreparation(prepText, serviceObj = {}) {
  const p = prepText || "";
  let fastingHours = serviceObj.fastingHours || "none";
  if (!serviceObj.fastingHours) {
    if (p.includes("8-10")) fastingHours = "8-10";
    else if (p.includes("6-8")) fastingHours = "6-8";
    else if (p.includes("4-6")) fastingHours = "4-6";
    else if (p.toLowerCase().includes("och qorin") || p.toLowerCase().includes("och holda")) fastingHours = "4-6";
  }

  const needsBloodTest = serviceObj.needsBloodTest !== undefined ? serviceObj.needsBloodTest : /kreatinin|mochevina|mochivina/i.test(p);
  const needsMetformin = serviceObj.needsMetformin !== undefined ? serviceObj.needsMetformin : /metformin|diabet/i.test(p);
  const needsMetalFree = serviceObj.needsMetalFree !== undefined ? serviceObj.needsMetalFree : /metall|ferromagnit/i.test(p);
  const needsHydration = serviceObj.needsHydration !== undefined ? serviceObj.needsHydration : /suyuqlik/i.test(p);

  let specialPrep = serviceObj.specialPreparation || "";
  if (!specialPrep && p) {
    const sentences = p.split(/(?:\.(?!\d)|\;|\r?\n)+/).map(s => s.trim().replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean);
    const specificParts = sentences.filter(s => {
      const l = s.toLowerCase();
      if (l.includes("och qorin") || l.includes("och holda") || l.includes("ovqatlanmasdan")) return false;
      if (l.includes("kreatinin") || l.includes("mochevina") || l.includes("mochivina")) return false;
      if (l.includes("metformin") || l.includes("glyukofaj") || l.includes("siofor")) return false;
      if (l.includes("ko'p suyuqlik") || l.includes("kop suyuqlik")) return false;
      if ((l.includes("metall") || l.includes("ferromagnit")) && l.includes("yechish")) return false;
      return true;
    });
    specialPrep = specificParts.join(". ");
  }

  return { fastingHours, needsBloodTest, needsMetformin, needsMetalFree, needsHydration, specialPrep };
}

function buildStructuredPreparationString(fastingHours, needsBloodTest, needsMetformin, needsMetalFree, needsHydration, specialPrep) {
  const parts = [];
  if (fastingHours === "8-10") parts.push("Kamida 8-10 soat och qoringa kelish.");
  else if (fastingHours === "6-8") parts.push("Kamida 6-8 soat och qoringa kelish.");
  else if (fastingHours === "4-6") parts.push("4-6 soat och qoringa kelish.");

  if (needsBloodTest) parts.push("Qonda Kreatinin va Mochevina tahlili (oxirgi 3 kun).");
  if (needsMetformin) parts.push("Qandli diabet bo'lsa: Metformin 48 soat oldin to'xtatiladi.");
  if (needsMetalFree) parts.push("Barcha ferromagnit metall buyumlar, soat, telefon, bank kartalari, kamar va taqinchoqlarni yechish.");
  if (needsHydration) parts.push("Tekshiruvdan so'ng ko'p suyuqlik ichish.");

  if (specialPrep && specialPrep.trim()) {
    let sp = specialPrep.trim();
    if (!/[.\?!:;]$/.test(sp)) sp += '.';
    parts.push(sp);
  }
  return parts.join(" ");
}

// Tekshiruvlar jadvalini chizish (Yangi Tuzilmaviy Tayyorgarlik va Savolnoma bilan)
function renderServicesTable() {
  const tbody = document.getElementById("servicesTableBody");
  if (!tbody) return;

  const searchQuery = (document.getElementById("serviceSearchInput") ? document.getElementById("serviceSearchInput").value : "").toLowerCase();
  const typeFilter = document.getElementById("serviceTypeFilter") ? document.getElementById("serviceTypeFilter").value : "all";

  const filtered = servicesList.filter(s => {
    const matchSearch = (s.code && s.code.toLowerCase().includes(searchQuery)) ||
                        (s.name && s.name.toLowerCase().includes(searchQuery));
    
    let matchType = true;
    if (typeFilter === "MRT") matchType = s.type === "MRT";
    else if (typeFilter === "MSKT") matchType = s.type === "MSKT";
    else if (typeFilter === "contrast") matchType = s.isContrast === true;
    else if (typeFilter === "no_contrast") matchType = s.isContrast === false;

    return matchSearch && matchType;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4" style="text-align:center; color:#94a3b8;">Tekshiruvlar topilmadi</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const struct = parseStructuredPreparation(s.preparation, s);
    const contraText = s.contraindications ? `<span style="color:#b91c1c; font-weight:600;">${escapeHtml(s.contraindications)}</span>` : '<span style="color:#94a3b8; font-size:12px;">—</span>';
    
    // Tuzilmaviy tayyorgarlik vizual ko'rinishi
    let prepBadges = [];
    if (struct.fastingHours && struct.fastingHours !== "none") {
      prepBadges.push(`<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-weight:800; font-size:11px;">⏳ ${struct.fastingHours}s och</span>`);
    }
    if (struct.needsBloodTest) {
      prepBadges.push(`<span style="background:#fee2e2; color:#b91c1c; padding:2px 6px; border-radius:4px; font-weight:700; font-size:11px;">🩸 Kreatinin</span>`);
    }
    if (struct.needsMetformin) {
      prepBadges.push(`<span style="background:#e0e7ff; color:#4338ca; padding:2px 6px; border-radius:4px; font-weight:700; font-size:11px;">💊 Metformin</span>`);
    }
    if (struct.needsMetalFree) {
      prepBadges.push(`<span style="background:#f1f5f9; color:#475569; padding:2px 6px; border-radius:4px; font-weight:700; font-size:11px;">🧲 Metall</span>`);
    }

    let prepHtml = "";
    if (prepBadges.length > 0) {
      prepHtml += `<div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:4px;">${prepBadges.join("")}</div>`;
    }
    if (struct.specialPrep) {
      prepHtml += `<div style="font-size:11.5px; color:#0f172a; line-height:1.25;"><strong>🔍 Maxsus:</strong> ${escapeHtml(struct.specialPrep)}</div>`;
    }
    if (!prepHtml) {
      prepHtml = '<span style="color:#94a3b8; font-size:12px;">— Maxsus talab yo\'q</span>';
    }

    // Savolnoma preview
    let questionsText = '<span style="color:#94a3b8; font-size:12px;">— Standart savollar</span>';
    if (s.questions && String(s.questions).trim()) {
      const qLines = String(s.questions).split(/\r?\n/).filter(q => q.trim().length > 0);
      if (qLines.length > 0) {
        questionsText = `<span style="color:#0369a1; font-weight:700;">📝 ${qLines.length} ta savol</span><div style="font-size:11px; color:#475569; margin-top:2px; line-height:1.25;">${escapeHtml(qLines[0])}${qLines.length > 1 ? ' ...' : ''}</div>`;
      }
    }

    return `
      <tr>
        <td><span class="ticket-tag" style="background:#e0f2fe; color:#0284c7;">${escapeHtml(s.code)}</span></td>
        <td onclick="openEditServiceModal('${s.id}')" style="cursor:pointer;" title="Tahrirlash uchun bosing">
          <strong>${escapeHtml(s.name)}</strong>
        </td>
        <td>
          <span class="badge ${s.type === 'MRT' ? 'badge-in_progress' : 'badge-waiting'}">
            ${escapeHtml(s.type || 'MRT')}
          </span>
        </td>
        <td>
          <span class="badge ${s.isContrast ? 'badge-calling' : 'badge-completed'}">
            ${s.isContrast ? '💉 Kontrastli' : 'Oddiy'}
          </span>
        </td>
        <td>
          <div class="duration-control-box">
            <button class="btn-step" onclick="changeDuration('${s.id}', -1)" title="-1 daqiqa">-1</button>
            <input type="number" class="duration-input" value="${s.duration || 30}" min="1" max="300" step="1"
              onchange="updateServiceDuration('${s.id}', this.value)">
            <button class="btn-step" onclick="changeDuration('${s.id}', 1)" title="+1 daqiqa">+1</button>
            <span class="duration-unit">daq</span>
          </div>
        </td>
        <td onclick="openEditServiceModal('${s.id}')" style="cursor:pointer;" title="Tahrirlash uchun bosing">
          <div style="font-size:12px; line-height:1.35; max-width:220px;">
            ${prepHtml}
          </div>
        </td>
        <td onclick="openEditServiceModal('${s.id}')" style="cursor:pointer;" title="Tahrirlash uchun bosing">
          <div style="font-size:12px; line-height:1.35; max-width:200px;">
            ${contraText}
          </div>
        </td>
        <td onclick="openEditServiceModal('${s.id}')" style="cursor:pointer;" title="Savolnomani tahrirlash uchun bosing">
          <div style="font-size:12px; line-height:1.35; max-width:220px;">
            ${questionsText}
          </div>
        </td>
        <td style="text-align:center; white-space:nowrap;">
          <button class="btn btn-secondary btn-small" title="Tahrirlash (Vaqti, Tayyorgarlik, Qarshi ko'rsatmalar, Savolnoma)" onclick="openEditServiceModal('${s.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-secondary btn-small" title="O'chirish" style="color:var(--danger); margin-left:3px;" onclick="deleteService('${s.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// Vaqtni o'zgartirish (ixtiyoriy daqiqa, 5 ga cheklanmagan)
function changeDuration(serviceId, delta) {
  const s = servicesList.find(item => item.id === serviceId);
  if (!s) return;
  const current = parseInt(s.duration || 30, 10);
  const nextVal = Math.max(1, Math.min(300, current + delta));
  updateServiceDuration(serviceId, nextVal);
}

function updateServiceDuration(serviceId, newDuration) {
  const duration = parseInt(newDuration, 10) || 1;
  const s = servicesList.find(item => item.id === serviceId);
  if (s) s.duration = duration;
  db.ref(`services_catalog/${serviceId}`).update({
    duration: duration
  });
}

function openAddServiceModal() {
  document.getElementById("serviceModalTitle").innerText = "Yangi Tekshiruv Qo'shish";
  document.getElementById("serviceId").value = "";
  document.getElementById("serviceForm").reset();
  document.getElementById("svcDuration").value = "30";
  document.getElementById("svcFastingHours").value = "none";
  document.getElementById("svcNeedsBloodTest").checked = false;
  document.getElementById("svcNeedsMetformin").checked = false;
  document.getElementById("svcNeedsMetalFree").checked = false;
  document.getElementById("svcNeedsHydration").checked = false;
  document.getElementById("svcSpecialPrep").value = "";
  document.getElementById("svcIncludeGeneralContra").checked = true;
  document.getElementById("svcSpecialContra").value = "";
  document.getElementById("svcIncludeGeneralQuestions").checked = true;
  document.getElementById("svcSpecialQuestions").value = "";
  document.getElementById("serviceModal").classList.add("open");
}

function openEditServiceModal(serviceId) {
  const s = servicesList.find(item => item.id === serviceId);
  if (!s) return;

  document.getElementById("serviceModalTitle").innerText = `${s.code ? s.code + ' - ' : ''}Tekshiruvni Tahrirlash`;
  document.getElementById("serviceId").value = s.id;
  document.getElementById("svcCode").value = s.code || "";
  document.getElementById("svcName").value = s.name || "";
  document.getElementById("svcType").value = s.type || "MRT";
  document.getElementById("svcContrast").value = s.isContrast ? "true" : "false";
  document.getElementById("svcDuration").value = s.duration || 30;

  const struct = parseStructuredPreparation(s.preparation, s);
  document.getElementById("svcFastingHours").value = struct.fastingHours || "none";
  document.getElementById("svcNeedsBloodTest").checked = struct.needsBloodTest === true;
  document.getElementById("svcNeedsMetformin").checked = struct.needsMetformin === true;
  document.getElementById("svcNeedsMetalFree").checked = struct.needsMetalFree === true;
  document.getElementById("svcNeedsHydration").checked = struct.needsHydration === true;
  document.getElementById("svcSpecialPrep").value = struct.specialPrep || "";

  document.getElementById("svcIncludeGeneralContra").checked = s.includeGeneralContra !== false;
  document.getElementById("svcSpecialContra").value = s.specialContraindications || (s.includeGeneralContra === false ? (s.contraindications || '') : (s.specialContraindications || ''));

  document.getElementById("svcIncludeGeneralQuestions").checked = s.includeGeneralQuestions !== false;
  document.getElementById("svcSpecialQuestions").value = s.specialQuestions || (s.includeGeneralQuestions === false ? (s.questions || '') : (s.specialQuestions || ''));

  document.getElementById("serviceModal").classList.add("open");
}

function setStandardQuestionsForServiceModal() {
  const type = document.getElementById("svcType").value;
  const isContrast = document.getElementById("svcContrast").value === "true";
  const name = document.getElementById("svcName").value;
  const g = getClinicalGuidelines({ type, isContrast, name });

  document.getElementById("svcIncludeGeneralContra").checked = true;
  document.getElementById("svcSpecialContra").value = "";
  document.getElementById("svcIncludeGeneralQuestions").checked = true;
  document.getElementById("svcSpecialQuestions").value = "";

  // Standart tuzilmaviy tayyorgarlikni qo'yish
  if (isContrast) {
    document.getElementById("svcFastingHours").value = "4-6";
    document.getElementById("svcNeedsBloodTest").checked = true;
    document.getElementById("svcNeedsMetformin").checked = true;
    document.getElementById("svcNeedsHydration").checked = true;
  } else {
    document.getElementById("svcFastingHours").value = "none";
    document.getElementById("svcNeedsBloodTest").checked = false;
    document.getElementById("svcNeedsMetformin").checked = false;
    document.getElementById("svcNeedsHydration").checked = false;
  }

  if (type === "MRT") {
    document.getElementById("svcNeedsMetalFree").checked = true;
  }
}

function closeServiceModal() {
  const modal = document.getElementById("serviceModal");
  if (modal) modal.classList.remove("open");
}

function handleServiceSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("serviceId").value;
  const code = document.getElementById("svcCode").value.trim().toUpperCase();
  const name = document.getElementById("svcName").value.trim();
  const type = document.getElementById("svcType").value;
  const isContrast = document.getElementById("svcContrast").value === "true";
  const duration = parseInt(document.getElementById("svcDuration").value, 10) || 30;

  const fastingHours = document.getElementById("svcFastingHours").value;
  const needsBloodTest = document.getElementById("svcNeedsBloodTest").checked;
  const needsMetformin = document.getElementById("svcNeedsMetformin").checked;
  const needsMetalFree = document.getElementById("svcNeedsMetalFree").checked;
  const needsHydration = document.getElementById("svcNeedsHydration").checked;
  const specialPreparation = document.getElementById("svcSpecialPrep").value.trim();

  const preparation = buildStructuredPreparationString(fastingHours, needsBloodTest, needsMetformin, needsMetalFree, needsHydration, specialPreparation);

  const includeGeneralContra = document.getElementById("svcIncludeGeneralContra").checked;
  const specialContraindications = document.getElementById("svcSpecialContra").value.trim();
  
  // Birlashtirilgan qarshi ko'rsatma matni
  let fullContra = [];
  if (includeGeneralContra) {
    const cGen = (globalGuidelines && globalGuidelines.contraTemplates) ? globalGuidelines.contraTemplates : DEFAULT_GLOBAL_GUIDELINES.contraTemplates;
    if (type === "MRT" && cGen.mrt) fullContra.push(cGen.mrt);
    if (type === "MSKT" && cGen.mskt) fullContra.push(cGen.mskt);
    if (isContrast && cGen.contrast) fullContra.push(cGen.contrast);
  }
  if (specialContraindications) {
    fullContra.push(specialContraindications);
  }
  const contraindications = fullContra.join(" ");

  const includeGeneralQuestions = document.getElementById("svcIncludeGeneralQuestions").checked;
  const specialQuestions = document.getElementById("svcSpecialQuestions").value.trim();
  
  // Birlashtirilgan savolnoma matni
  let fullQuestions = [];
  if (includeGeneralQuestions) {
    const qGen = (globalGuidelines && globalGuidelines.questionTemplates) ? globalGuidelines.questionTemplates : DEFAULT_GLOBAL_GUIDELINES.questionTemplates;
    if (qGen.universal) fullQuestions.push(...qGen.universal);
    if (isContrast && qGen.contrast) fullQuestions.push(...qGen.contrast);
    if (type === "MRT" && qGen.mrt) fullQuestions.push(...qGen.mrt);
    if (type === "MSKT" && qGen.mskt) fullQuestions.push(...qGen.mskt);
  }
  if (specialQuestions) {
    const sLines = specialQuestions.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    fullQuestions.push(...sLines);
  }
  const questions = fullQuestions.join("\n");

  const data = {
    code,
    name,
    type,
    isContrast,
    duration,
    fastingHours,
    needsBloodTest,
    needsMetformin,
    needsMetalFree,
    needsHydration,
    specialPreparation,
    preparation,
    includeGeneralContra,
    specialContraindications,
    contraindications,
    includeGeneralQuestions,
    specialQuestions,
    questions,
    updatedAt: new Date().toISOString()
  };

  if (id) {
    db.ref(`services_catalog/${id}`).update(data).then(() => closeServiceModal());
  } else {
    const key = code.replace(/[^a-zA-Z0-9]/g, "_") || db.ref("services_catalog").push().key;
    db.ref(`services_catalog/${key}`).set(data).then(() => closeServiceModal());
  }
}

function deleteService(serviceId) {
  if (confirm("Haqiqatdan ham ushbu tekshiruvni o'chirmoqchimisiz?")) {
    db.ref(`services_catalog/${serviceId}`).remove();
  }
}

// 10.1 OMMAVIY SOZLASH (GURUHLAB YANGILASH)
function openBatchSettingsModal() {
  document.getElementById("batchSettingsForm").reset();
  document.getElementById("batchApplyFasting").checked = true;
  document.getElementById("batchApplyGeneralRules").checked = true;
  document.getElementById("batchApplySpecialPrep").checked = false;
  document.getElementById("batchApplyContra").checked = true;
  document.getElementById("batchApplyQuestions").checked = true;
  document.getElementById("batchApplyDuration").checked = false;
  
  toggleBatchField('batchFastingBox', true);
  toggleBatchField('batchGeneralRulesBox', true);
  toggleBatchField('batchSpecialPrepBox', false);
  toggleBatchField('batchContraBox', true);
  toggleBatchField('batchQuestionsBox', true);
  toggleBatchField('batchDurationBox', false);

  onBatchGroupChanged();
  document.getElementById("batchSettingsModal").classList.add("open");
}

function closeBatchSettingsModal() {
  const modal = document.getElementById("batchSettingsModal");
  if (modal) modal.classList.remove("open");
}

function toggleBatchField(boxId, isChecked) {
  const el = document.getElementById(boxId);
  if (el) el.style.display = isChecked ? "block" : "none";
}

function onBatchGroupChanged() {
  const group = document.getElementById("batchGroupSelect").value;
  let sampleType = "MRT";
  let sampleContrast = false;

  if (group === "all_mrt") { sampleType = "MRT"; sampleContrast = false; }
  else if (group === "all_mskt") { sampleType = "MSKT"; sampleContrast = false; }
  else if (group === "all_contrast") { sampleType = "MRT"; sampleContrast = true; }
  else if (group === "all_non_contrast") { sampleType = "MRT"; sampleContrast = false; }
  else { sampleType = "MRT"; sampleContrast = false; }

  const g = getClinicalGuidelines({ type: sampleType, isContrast: sampleContrast, name: "" });

  if (sampleContrast) {
    document.getElementById("batchFastingHours").value = "4-6";
    document.getElementById("batchNeedsBloodTest").checked = true;
    document.getElementById("batchNeedsMetformin").checked = true;
    document.getElementById("batchNeedsHydration").checked = true;
  } else {
    document.getElementById("batchFastingHours").value = "none";
    document.getElementById("batchNeedsBloodTest").checked = false;
    document.getElementById("batchNeedsMetformin").checked = false;
    document.getElementById("batchNeedsHydration").checked = false;
  }

  if (sampleType === "MRT") {
    document.getElementById("batchNeedsMetalFree").checked = true;
  } else {
    document.getElementById("batchNeedsMetalFree").checked = false;
  }

  document.getElementById("batchContraindications").value = g.contraindications;
  document.getElementById("batchQuestions").value = g.questions;
}

async function handleBatchSettingsSubmit(e) {
  e.preventDefault();
  const group = document.getElementById("batchGroupSelect").value;

  const applyFasting = document.getElementById("batchApplyFasting").checked;
  const applyGeneralRules = document.getElementById("batchApplyGeneralRules").checked;
  const applySpecialPrep = document.getElementById("batchApplySpecialPrep").checked;
  const applyContra = document.getElementById("batchApplyContra").checked;
  const applyQuestions = document.getElementById("batchApplyQuestions").checked;
  const applyDuration = document.getElementById("batchApplyDuration").checked;

  const fastingHoursVal = document.getElementById("batchFastingHours").value;
  const needsBloodTestVal = document.getElementById("batchNeedsBloodTest").checked;
  const needsMetforminVal = document.getElementById("batchNeedsMetformin").checked;
  const needsMetalFreeVal = document.getElementById("batchNeedsMetalFree").checked;
  const needsHydrationVal = document.getElementById("batchNeedsHydration").checked;
  const specialPrepVal = document.getElementById("batchSpecialPrep").value.trim();

  const contraVal = document.getElementById("batchContraindications").value.trim();
  const questionsVal = document.getElementById("batchQuestions").value.trim();
  const durationVal = parseInt(document.getElementById("batchDuration").value, 10) || 30;

  const targetServices = servicesList.filter(s => {
    if (group === "all_mrt") return s.type === "MRT";
    if (group === "all_mskt") return s.type === "MSKT";
    if (group === "all_contrast") return s.isContrast === true;
    if (group === "all_non_contrast") return s.isContrast === false;
    return true; // all_services
  });

  if (targetServices.length === 0) {
    alert("Tanlangan guruhda tekshiruvlar topilmadi.");
    return;
  }

  if (!confirm(`${targetServices.length} ta tekshiruvga tanlangan ma'lumotlarni ommaviy qo'llamoqchimisiz?`)) {
    return;
  }

  const updates = {};
  targetServices.forEach(s => {
    const struct = parseStructuredPreparation(s.preparation, s);
    const finalFasting = applyFasting ? fastingHoursVal : struct.fastingHours;
    const finalBloodTest = applyGeneralRules ? needsBloodTestVal : struct.needsBloodTest;
    const finalMetformin = applyGeneralRules ? needsMetforminVal : struct.needsMetformin;
    const finalMetalFree = applyGeneralRules ? needsMetalFreeVal : struct.needsMetalFree;
    const finalHydration = applyGeneralRules ? needsHydrationVal : struct.needsHydration;
    const finalSpecialPrep = applySpecialPrep ? specialPrepVal : struct.specialPrep;

    if (applyFasting || applyGeneralRules || applySpecialPrep) {
      updates[`${s.id}/fastingHours`] = finalFasting;
      updates[`${s.id}/needsBloodTest`] = finalBloodTest;
      updates[`${s.id}/needsMetformin`] = finalMetformin;
      updates[`${s.id}/needsMetalFree`] = finalMetalFree;
      updates[`${s.id}/needsHydration`] = finalHydration;
      updates[`${s.id}/specialPreparation`] = finalSpecialPrep;
      updates[`${s.id}/preparation`] = buildStructuredPreparationString(finalFasting, finalBloodTest, finalMetformin, finalMetalFree, finalHydration, finalSpecialPrep);
    }

    if (applyContra) updates[`${s.id}/contraindications`] = contraVal;
    if (applyQuestions) updates[`${s.id}/questions`] = questionsVal;
    if (applyDuration) updates[`${s.id}/duration`] = durationVal;
    updates[`${s.id}/updatedAt`] = new Date().toISOString();
  });

  try {
    await db.ref("services_catalog").update(updates);
    closeBatchSettingsModal();
    alert(`✅ ${targetServices.length} ta tekshiruv muvaffaqiyatli yangilandi!`);
  } catch (err) {
    alert("Xatolik yuz berdi: " + err.message);
  }
}

function deleteService(serviceId) {
  if (confirm("Haqiqatdan ham ushbu tekshiruvni o'chirmoqchimisiz?")) {
    db.ref(`services_catalog/${serviceId}`).remove();
  }
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");

  const btn = document.querySelector(`.nav-item[onclick*="${tabId}"]`);
  if (btn) btn.classList.add("active");
}

function openNewPatientModal() {
  switchTab("new-patient-tab");
  document.getElementById("patientName").focus();
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

// ==========================================
// 📌 UMUMIY TIBBIY QOIDALAR VA SAVOLNOMA SHABLONLARI BOSHQARUVI
// ==========================================
function openGeneralGuidelinesModal() {
  const gg = (globalGuidelines && globalGuidelines.prepTemplates) ? globalGuidelines : DEFAULT_GLOBAL_GUIDELINES;
  
  // 1. Tayyorgarlik matnlari
  const p = gg.prepTemplates || DEFAULT_GLOBAL_GUIDELINES.prepTemplates;
  document.getElementById("ggFasting46").value = p.fasting_4_6 || "";
  document.getElementById("ggFasting68").value = p.fasting_6_8 || "";
  document.getElementById("ggFasting810").value = p.fasting_8_10 || "";
  document.getElementById("ggBloodTest").value = p.bloodTest || "";
  document.getElementById("ggMetformin").value = p.metformin || "";
  document.getElementById("ggMetalFree").value = p.metalFree || "";
  document.getElementById("ggHydration").value = p.hydration || "";

  // 2. Qarshi ko'rsatmalar
  const c = gg.contraTemplates || DEFAULT_GLOBAL_GUIDELINES.contraTemplates;
  document.getElementById("ggContraMRT").value = c.mrt || "";
  document.getElementById("ggContraMSKT").value = c.mskt || "";
  document.getElementById("ggContraContrast").value = c.contrast || "";

  // 3. Savolnomalar
  const q = gg.questionTemplates || DEFAULT_GLOBAL_GUIDELINES.questionTemplates;
  document.getElementById("ggQuestionsUniversal").value = (q.universal || []).join("\n");
  document.getElementById("ggQuestionsContrast").value = (q.contrast || []).join("\n");
  document.getElementById("ggQuestionsMRT").value = (q.mrt || []).join("\n");
  document.getElementById("ggQuestionsMSKT").value = (q.mskt || []).join("\n");

  // 4. So'rov muddati va rad etish qoidalari
  const r = gg.referralRules || DEFAULT_GLOBAL_GUIDELINES.referralRules;
  document.getElementById("ggMaxReferralAgeDays").value = r.maxReferralAgeDays || 10;
  document.getElementById("ggExpiredReferralMessage").value = r.expiredReferralMessage || "";
  document.getElementById("ggBlockedKeywords").value = (r.blockedKeywords || []).join(", ");
  document.getElementById("ggNonMrtMsktMessage").value = r.nonMrtMsktMessage || "";
  document.getElementById("ggCompletedRowMessage").value = r.completedRowMessage || "";

  const modal = document.getElementById("generalGuidelinesModal");
  if (modal) modal.classList.add("open");
}

function closeGeneralGuidelinesModal() {
  const modal = document.getElementById("generalGuidelinesModal");
  if (modal) modal.classList.remove("open");
}

function resetGeneralGuidelinesToDefaults() {
  if (confirm("Barcha umumiy tibbiy tayyorgarlik, qarshi ko'rsatmalar, savolnoma va so'rov muddati shablonlarini standart (boshlang'ich) holatga qaytarmoqchimisiz?")) {
    globalGuidelines = JSON.parse(JSON.stringify(DEFAULT_GLOBAL_GUIDELINES));
    db.ref("settings/general_guidelines").set(DEFAULT_GLOBAL_GUIDELINES).then(() => {
      openGeneralGuidelinesModal();
      alert("✅ Standart shablonlar qayta tiklandi!");
    });
  }
}

async function handleGeneralGuidelinesSubmit(e) {
  e.preventDefault();

  const parseLines = (id) => {
    const el = document.getElementById(id);
    if (!el) return [];
    return el.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  };

  const parseKeywords = (id) => {
    const el = document.getElementById(id);
    if (!el) return [];
    return el.value.split(/[\r\n,;]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
  };

  const payload = {
    prepTemplates: {
      fasting_4_6: document.getElementById("ggFasting46").value.trim(),
      fasting_6_8: document.getElementById("ggFasting68").value.trim(),
      fasting_8_10: document.getElementById("ggFasting810").value.trim(),
      bloodTest: document.getElementById("ggBloodTest").value.trim(),
      metformin: document.getElementById("ggMetformin").value.trim(),
      metalFree: document.getElementById("ggMetalFree").value.trim(),
      hydration: document.getElementById("ggHydration").value.trim()
    },
    contraTemplates: {
      mrt: document.getElementById("ggContraMRT").value.trim(),
      mskt: document.getElementById("ggContraMSKT").value.trim(),
      contrast: document.getElementById("ggContraContrast").value.trim()
    },
    questionTemplates: {
      universal: parseLines("ggQuestionsUniversal"),
      contrast: parseLines("ggQuestionsContrast"),
      mrt: parseLines("ggQuestionsMRT"),
      mskt: parseLines("ggQuestionsMSKT")
    },
    referralRules: {
      maxReferralAgeDays: parseInt(document.getElementById("ggMaxReferralAgeDays").value, 10) || 10,
      expiredReferralMessage: document.getElementById("ggExpiredReferralMessage").value.trim(),
      blockedKeywords: parseKeywords("ggBlockedKeywords"),
      nonMrtMsktMessage: document.getElementById("ggNonMrtMsktMessage").value.trim(),
      completedRowMessage: document.getElementById("ggCompletedRowMessage").value.trim()
    },
    updatedAt: new Date().toISOString()
  };

  try {
    await db.ref("settings/general_guidelines").set(payload);
    globalGuidelines = payload;
    closeGeneralGuidelinesModal();
    renderServicesTable();
    alert("✅ 📌 Umumiy shablonlar va rad etish qoidalari muvaffaqiyatli saqlandi!");
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

// ❓ TIBBIY SAVOLLARNI BARCHA TEKSHIRUVLAR UCHUN UMUMIY VA MAXSUS QISMLARNI AQLI BIRLASHTIRISH
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

// 📌 BIR NECHTA TEKSHIRUV BO'LGANDA TAYYORGARLIK VA QARSHI KO'RSATMALARNI AQLLI BIRLASHTIRISH
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
        return;
      }

      // 2. Qon tahlillari (Kreatinin va Mochevina)
      if (lower.includes("kreatinin") || lower.includes("mochevina") || lower.includes("mochivina") || (lower.includes("qon") && lower.includes("tahlil"))) {
        hasBloodTest = true;
        return;
      }

      // 3. Metformin / Diabet
      if (lower.includes("metformin") || lower.includes("glyukofaj") || lower.includes("siofor") || (lower.includes("qandli diabet") && lower.includes("to'xtatiladi"))) {
        hasMetformin = true;
        return;
      }

      // 4. Tekshiruvdan so'ng ko'p suyuqlik ichish
      if (lower.includes("ko'p suyuqlik") || lower.includes("kop suyuqlik") || (lower.includes("suyuqlik") && lower.includes("so'ng"))) {
        hasPostHydration = true;
        return;
      }

      // 5. Metall / ferromagnit buyumlarni yechish
      if ((lower.includes("metall") || lower.includes("ferromagnit") || lower.includes("telefon") || lower.includes("taqinchoq")) && (lower.includes("yechish") || lower.includes("mumkin emas") || lower.includes("olib tashlash"))) {
        hasMetalWarning = true;
        return;
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

// ==========================================
// 15. TILLAR VA SAVOLNOMA SOZLAMALARI (i18n Settings & Live Preview)
// ==========================================

let currentI18nEditorLang = 'uz';
let currentI18nPreviewMode = 'ticket'; // 'ticket' or 'consent'
let customI18nSettings = {};

const I18N_LANG_LABELS = {
  uz: "O'zbekcha",
  ru: "Русский",
  en: "English",
  kk: "Қазақша",
  tg: "Тоҷикӣ",
  tr: "Türkçe"
};

function initI18nSettingsModule() {
  loadI18nSettingsFromFirebase();
  populateI18nEditorForm(currentI18nEditorLang);
}

function loadI18nSettingsFromFirebase() {
  if (!db) return;
  db.ref("settings/i18n").on("value", snapshot => {
    if (snapshot.exists()) {
      customI18nSettings = snapshot.val() || {};
    } else {
      customI18nSettings = {};
    }
    populateI18nEditorForm(currentI18nEditorLang);
  });
}

function switchI18nEditorLang(langCode) {
  currentI18nEditorLang = langCode;
  document.querySelectorAll(".i18n-edit-lang-btn").forEach(btn => {
    if (btn.getAttribute("data-lang") === langCode) {
      btn.classList.add("active");
      btn.style.background = "#0284c7";
      btn.style.color = "#ffffff";
    } else {
      btn.classList.remove("active");
      btn.style.background = "transparent";
      btn.style.color = "#334155";
    }
  });

  const langLabel = I18N_LANG_LABELS[langCode] || langCode;
  for (let i = 1; i <= 4; i++) {
    const badge = document.getElementById(`i18nCurLangBadge${i}`);
    if (badge) badge.innerText = langLabel;
  }

  populateI18nEditorForm(langCode);
}

function populateI18nEditorForm(langCode) {
  const gDict = (customI18nSettings.guidelines && customI18nSettings.guidelines[langCode]) 
    ? customI18nSettings.guidelines[langCode]
    : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.guidelines && I18N_TRANSLATIONS.guidelines[langCode]) ? I18N_TRANSLATIONS.guidelines[langCode] : (typeof I18N_TRANSLATIONS !== 'undefined' ? I18N_TRANSLATIONS.guidelines['uz'] : {}));

  // 1. Guidelines
  if (document.getElementById("i18n_boxTitle")) document.getElementById("i18n_boxTitle").value = gDict.boxTitle || "";
  if (document.getElementById("i18n_generalPrepTitle")) document.getElementById("i18n_generalPrepTitle").value = gDict.generalPrepTitle || "";
  if (document.getElementById("i18n_fasting")) document.getElementById("i18n_fasting").value = gDict.fasting || "";
  if (document.getElementById("i18n_bloodTest")) document.getElementById("i18n_bloodTest").value = gDict.bloodTest || "";
  if (document.getElementById("i18n_metformin")) document.getElementById("i18n_metformin").value = gDict.metformin || "";
  if (document.getElementById("i18n_postHydration")) document.getElementById("i18n_postHydration").value = gDict.postHydration || "";
  if (document.getElementById("i18n_metalWarning")) document.getElementById("i18n_metalWarning").value = gDict.metalWarning || "";

  // 2. Contras
  if (document.getElementById("i18n_contraTitle")) document.getElementById("i18n_contraTitle").value = gDict.contraTitle || "";
  if (document.getElementById("i18n_allergy")) document.getElementById("i18n_allergy").value = gDict.allergy || "";
  if (document.getElementById("i18n_kidney")) document.getElementById("i18n_kidney").value = gDict.kidney || "";
  if (document.getElementById("i18n_hyperthyroidism")) document.getElementById("i18n_hyperthyroidism").value = gDict.hyperthyroidism || "";
  if (document.getElementById("i18n_pregnancy")) document.getElementById("i18n_pregnancy").value = gDict.pregnancy || "";
  if (document.getElementById("i18n_pacemaker")) document.getElementById("i18n_pacemaker").value = gDict.pacemaker || "";

  // 3. Questions
  const qMap = (customI18nSettings.questions) ? customI18nSettings.questions : (typeof I18N_TRANSLATIONS !== 'undefined' ? I18N_TRANSLATIONS.questions : {});
  const qKeys = [
    "pacemaker", "metalImplants", "claustrophobia", "pregnancy", "allergy",
    "kidney", "asthmaDiabetes", "hearingDental", "abdominalFasting", "pelvicBladder"
  ];
  qKeys.forEach(k => {
    const inp = document.getElementById(`i18n_q_${k}`);
    if (inp) {
      inp.value = (qMap[k] && qMap[k][langCode]) ? qMap[k][langCode] : ((I18N_TRANSLATIONS.questions && I18N_TRANSLATIONS.questions[k] && I18N_TRANSLATIONS.questions[k][langCode]) ? I18N_TRANSLATIONS.questions[k][langCode] : "");
    }
  });

  // 4. Deferral Reasons
  const rMap = (customI18nSettings.deferReasons) ? customI18nSettings.deferReasons : (typeof I18N_TRANSLATIONS !== 'undefined' ? I18N_TRANSLATIONS.deferReasons : {});
  const r1 = rMap["Bemorning shaxsiy iltimosi / Vaqti to'g'ri kelmadi"];
  const r2 = rMap["Bemor tayyorgarlik ko'rishga ulgurmaydi (och qorin / tahlillar topshirish)"];
  const r3 = rMap["Uzoqdan / viloyatdan yo'lda kelmoqda"];
  const r4 = rMap["Boshqa shifokor ko'rigi yoki boshqa muolajasi bor"];

  if (document.getElementById("i18n_r_personal")) document.getElementById("i18n_r_personal").value = (r1 && r1[langCode]) ? r1[langCode] : "";
  if (document.getElementById("i18n_r_prep")) document.getElementById("i18n_r_prep").value = (r2 && r2[langCode]) ? r2[langCode] : "";
  if (document.getElementById("i18n_r_travel")) document.getElementById("i18n_r_travel").value = (r3 && r3[langCode]) ? r3[langCode] : "";
  if (document.getElementById("i18n_r_doctor")) document.getElementById("i18n_r_doctor").value = (r4 && r4[langCode]) ? r4[langCode] : "";

  updateI18nLivePreview();
}

function updateI18nLivePreview() {
  const container = document.getElementById("i18nLivePreviewContainer");
  if (!container) return;

  const L = currentI18nEditorLang;
  const tDict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket && I18N_TRANSLATIONS.ticket[L]) ? I18N_TRANSLATIONS.ticket[L] : (typeof I18N_TRANSLATIONS !== 'undefined' ? I18N_TRANSLATIONS.ticket['uz'] : {});
  const cDict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.consent && I18N_TRANSLATIONS.consent[L]) ? I18N_TRANSLATIONS.consent[L] : (typeof I18N_TRANSLATIONS !== 'undefined' ? I18N_TRANSLATIONS.consent['uz'] : {});

  // Current values from editor form
  const boxTitle = document.getElementById("i18n_boxTitle")?.value || "TIBBIY KO'RSATMALAR VA ESLATMA";
  const generalPrepTitle = document.getElementById("i18n_generalPrepTitle")?.value || "📌 Umumiy Tayyorgarlik:";
  const fasting = (document.getElementById("i18n_fasting")?.value || "").replace('{H}', '6');
  const bloodTest = document.getElementById("i18n_bloodTest")?.value || "";
  const metformin = document.getElementById("i18n_metformin")?.value || "";
  const postHydration = document.getElementById("i18n_postHydration")?.value || "";
  const contraTitle = document.getElementById("i18n_contraTitle")?.value || "🚫 Qarshi ko'rsatmalar:";
  const allergy = document.getElementById("i18n_allergy")?.value || "";
  const kidney = document.getElementById("i18n_kidney")?.value || "";
  const pregnancy = document.getElementById("i18n_pregnancy")?.value || "";
  const reasonText = document.getElementById("i18n_r_personal")?.value || "Личная просьба пациента / Неудобное время";

  const sampleServiceName = (typeof formatServiceNameWithOriginal === 'function') ? formatServiceNameWithOriginal("Bosh Miya MRT (Kontrastsiz)", L) : "Bosh Miya MRT";
  const sampleRoom = (typeof formatRoomWithOriginal === 'function') ? formatRoomWithOriginal("1-MRT Xonasi", "MRT 1 (Siemens)", L) : "1-MRT Xonasi";

  if (currentI18nPreviewMode === 'ticket') {
    container.innerHTML = `
      <div style="background:#fff; border:2px solid #000; border-radius:6px; padding:12px 10px; font-family:sans-serif; color:#000; font-size:12px; max-width:320px; margin:0 auto; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <div style="text-align:center; font-weight:900; font-size:13px; text-transform:uppercase;">${escapeHtml(tDict.centerName || 'MARKAZ')}</div>
        <div style="text-align:center; font-size:11px; font-weight:700; margin-bottom:4px;">${escapeHtml(tDict.ticketTitle || 'Talon')}</div>
        <div style="border-top:1.5px dashed #000; margin:6px 0;"></div>
        
        <div style="text-align:center; font-size:26px; font-weight:900; border:2px solid #000; border-radius:6px; padding:2px 0; margin:4px 0;">84210</div>

        <div style="display:flex; justify-content:space-between; margin-top:6px; font-size:12px;">
          <span>${escapeHtml(tDict.patient || 'Bemor')}:</span>
          <strong>Sayidov Sherali</strong>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px;">
          <span>${escapeHtml(tDict.patientType || 'Toifasi')}:</span>
          <span>${escapeHtml(tDict.stationary || 'Statsionar')} (Xirurgiya)</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px;">
          <span>${escapeHtml(tDict.roomDevice || 'Xona')}:</span>
          <span style="text-align:right;">${escapeHtml(sampleRoom)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px;">
          <span>${escapeHtml(tDict.service || 'Tekshiruv')}:</span>
          <strong style="text-align:right;">${escapeHtml(sampleServiceName)}</strong>
        </div>

        <div style="border:2px solid #000; border-radius:6px; padding:4px 6px; text-align:center; margin:8px 0; background:#f8fafc;">
          <div style="font-size:10px; font-weight:900;">${escapeHtml(tDict.bookedTime || 'VAQT')}</div>
          <div style="font-size:18px; font-weight:900;">08:00 - 08:29</div>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:11px;">
          <span>${escapeHtml(tDict.appointmentDate || 'Sana')}:</span>
          <strong>2026-08-24</strong>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px;">
          <span>${escapeHtml(tDict.operator || 'Ro\'yxatchi')}:</span>
          <span>TB1 - Turatov Hojiakbar</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; margin-top:2px;">
          <span>${escapeHtml(tDict.reasonLabel || 'Sabab:')}</span>
          <span style="font-weight:bold; text-align:right;">${escapeHtml(reasonText)} [Bemor iltimosi]</span>
        </div>

        <div style="border-top:1.5px dashed #000; margin:6px 0;"></div>

        <!-- Guidelines Box Preview -->
        <div style="border:1.5px solid #000; border-radius:4px; padding:6px; margin:6px 0; font-size:10.5px;">
          <div style="text-align:center; font-weight:900; font-size:10.5px; border-bottom:1px dashed #000; padding-bottom:2px; margin-bottom:4px;">
            ${escapeHtml(boxTitle)}
          </div>
          <div style="font-weight:900; color:#000;">${escapeHtml(generalPrepTitle)}</div>
          <div style="padding-left:2px; margin-bottom:4px; line-height:1.25;">
            <div>• ${escapeHtml(fasting)}</div>
            <div>• ${escapeHtml(bloodTest)}</div>
            <div>• ${escapeHtml(metformin)}</div>
            <div>• ${escapeHtml(postHydration)}</div>
          </div>
          <div style="font-weight:900; color:#000;">${escapeHtml(contraTitle)}</div>
          <div style="padding-left:2px; line-height:1.25;">
            <div>• ${escapeHtml(allergy)}</div>
            <div>• ${escapeHtml(kidney)}</div>
            <div>• ${escapeHtml(pregnancy)}</div>
          </div>
        </div>

        <div style="border-top:1.5px dashed #000; margin:6px 0;"></div>
        <div style="text-align:center; font-size:10px; line-height:1.2;">
          ${escapeHtml(tDict.timeNotice || '')}<br>
          <strong>${escapeHtml(tDict.footerThanks || '')}</strong>
        </div>
      </div>
    `;
  } else {
    // Consent A4 Preview
    const qKeys = [
      "pacemaker", "metalImplants", "claustrophobia", "pregnancy", "allergy",
      "kidney", "asthmaDiabetes", "hearingDental", "abdominalFasting", "pelvicBladder"
    ];
    const questionsHtml = qKeys.map((k, idx) => {
      const qVal = document.getElementById(`i18n_q_${k}`)?.value || "";
      return `
        <tr>
          <td style="border:1px solid #000; padding:2px 4px; text-align:center; font-size:9.5px; font-weight:bold;">${idx + 1}</td>
          <td style="border:1px solid #000; padding:2px 4px; font-size:9.5px;">${escapeHtml(qVal)}</td>
          <td style="border:1px solid #000; padding:2px 4px; text-align:center; font-size:9.5px; width:30px;">[ ]</td>
          <td style="border:1px solid #000; padding:2px 4px; text-align:center; font-size:9.5px; width:30px;">[ ]</td>
        </tr>
      `;
    }).join("");

    container.innerHTML = `
      <div style="background:#fff; border:1px solid #000; border-radius:4px; padding:8px; font-family:sans-serif; color:#000; font-size:10.5px; line-height:1.25; box-shadow:0 2px 8px rgba(0,0,0,0.1);">
        <div style="border:1px solid #000; padding:4px; margin-bottom:6px; text-align:center;">
          <div style="font-size:9px; font-weight:bold;">${(cDict.ministryTitle || '').replace(/\\n/g, '<br>')}</div>
          <div style="font-size:10px; font-weight:900; margin-top:2px;">${(cDict.docTitle || '').replace('{examType}', 'MRT')}</div>
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:6px; font-size:9.5px;">
          <tr>
            <td style="border:1px solid #000; padding:2px 4px; font-weight:bold; width:25%; background:#f8fafc;">${cDict.patientName || 'Bemor'}</td>
            <td style="border:1px solid #000; padding:2px 4px; font-weight:bold;" colspan="3">Sayidov Sherali</td>
          </tr>
          <tr>
            <td style="border:1px solid #000; padding:2px 4px; font-weight:bold; background:#f8fafc;">${cDict.deviceRoom || 'Xona'}</td>
            <td style="border:1px solid #000; padding:2px 4px;">${escapeHtml(sampleRoom)}</td>
            <td style="border:1px solid #000; padding:2px 4px; font-weight:bold; background:#f8fafc;">${cDict.serviceName || 'Tekshiruv'}</td>
            <td style="border:1px solid #000; padding:2px 4px;"><strong>${escapeHtml(sampleServiceName)}</strong></td>
          </tr>
        </table>

        <div style="font-size:9.5px; font-weight:bold; background:#f1f5f9; border:1px solid #000; padding:2px 4px; margin-bottom:4px;">
          ${cDict.section1 || 'SAVOLNOMA'}
        </div>

        <table style="width:100%; border-collapse:collapse; margin-bottom:6px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="border:1px solid #000; padding:2px; font-size:9px; width:20px;">#</th>
              <th style="border:1px solid #000; padding:2px 4px; font-size:9px; text-align:left;">${cDict.criteriaHeader || 'Savollar'}</th>
              <th style="border:1px solid #000; padding:2px; font-size:9px;">${cDict.yes || 'HA'}</th>
              <th style="border:1px solid #000; padding:2px; font-size:9px;">${cDict.no || 'YO\'Q'}</th>
            </tr>
          </thead>
          <tbody>
            ${questionsHtml}
          </tbody>
        </table>

        <div style="font-size:8.5px; line-height:1.2; border:1px solid #000; padding:4px; background:#fafafa; text-align:justify;">
          ${(cDict.declaration || '').replace(/{examType}/g, 'MRT')}
        </div>
      </div>
    `;
  }
}

function setI18nPreviewMode(mode) {
  currentI18nPreviewMode = mode;
  const btnT = document.getElementById("btnPreviewModeTicket");
  const btnC = document.getElementById("btnPreviewModeConsent");

  if (mode === 'ticket') {
    if (btnT) { btnT.style.background = "#0284c7"; btnT.style.color = "#fff"; }
    if (btnC) { btnC.style.background = "#f8fafc"; btnC.style.color = "#334155"; }
  } else {
    if (btnC) { btnC.style.background = "#0284c7"; btnC.style.color = "#fff"; }
    if (btnT) { btnT.style.background = "#f8fafc"; btnT.style.color = "#334155"; }
  }
  updateI18nLivePreview();
}

async function saveCurrentI18nLangSettings() {
  const L = currentI18nEditorLang;
  
  if (!customI18nSettings.guidelines) customI18nSettings.guidelines = {};
  if (!customI18nSettings.guidelines[L]) customI18nSettings.guidelines[L] = {};

  customI18nSettings.guidelines[L].boxTitle = document.getElementById("i18n_boxTitle")?.value || "";
  customI18nSettings.guidelines[L].generalPrepTitle = document.getElementById("i18n_generalPrepTitle")?.value || "";
  customI18nSettings.guidelines[L].fasting = document.getElementById("i18n_fasting")?.value || "";
  customI18nSettings.guidelines[L].bloodTest = document.getElementById("i18n_bloodTest")?.value || "";
  customI18nSettings.guidelines[L].metformin = document.getElementById("i18n_metformin")?.value || "";
  customI18nSettings.guidelines[L].postHydration = document.getElementById("i18n_postHydration")?.value || "";
  customI18nSettings.guidelines[L].metalWarning = document.getElementById("i18n_metalWarning")?.value || "";
  customI18nSettings.guidelines[L].contraTitle = document.getElementById("i18n_contraTitle")?.value || "";
  customI18nSettings.guidelines[L].allergy = document.getElementById("i18n_allergy")?.value || "";
  customI18nSettings.guidelines[L].kidney = document.getElementById("i18n_kidney")?.value || "";
  customI18nSettings.guidelines[L].hyperthyroidism = document.getElementById("i18n_hyperthyroidism")?.value || "";
  customI18nSettings.guidelines[L].pregnancy = document.getElementById("i18n_pregnancy")?.value || "";
  customI18nSettings.guidelines[L].pacemaker = document.getElementById("i18n_pacemaker")?.value || "";

  // Questions
  if (!customI18nSettings.questions) customI18nSettings.questions = {};
  const qKeys = [
    "pacemaker", "metalImplants", "claustrophobia", "pregnancy", "allergy",
    "kidney", "asthmaDiabetes", "hearingDental", "abdominalFasting", "pelvicBladder"
  ];
  qKeys.forEach(k => {
    if (!customI18nSettings.questions[k]) customI18nSettings.questions[k] = {};
    customI18nSettings.questions[k][L] = document.getElementById(`i18n_q_${k}`)?.value || "";
  });

  // Reasons
  if (!customI18nSettings.deferReasons) customI18nSettings.deferReasons = {};
  const rKeys = [
    { id: "i18n_r_personal", raw: "Bemorning shaxsiy iltimosi / Vaqti to'g'ri kelmadi" },
    { id: "i18n_r_prep", raw: "Bemor tayyorgarlik ko'rishga ulgurmaydi (och qorin / tahlillar topshirish)" },
    { id: "i18n_r_travel", raw: "Uzoqdan / viloyatdan yo'lda kelmoqda" },
    { id: "i18n_r_doctor", raw: "Boshqa shifokor ko'rigi yoki boshqa muolajasi bor" }
  ];
  rKeys.forEach(item => {
    if (!customI18nSettings.deferReasons[item.raw]) customI18nSettings.deferReasons[item.raw] = {};
    customI18nSettings.deferReasons[item.raw][L] = document.getElementById(item.id)?.value || "";
  });

  try {
    if (db) {
      await db.ref("settings/i18n").set(customI18nSettings);
    }
    alert(`✅ [${I18N_LANG_LABELS[L] || L}] tili bo'yicha tibbiy ko'rsatmalar va savolnoma sozlamalari Firebase-da muvaffaqiyatli saqlandi!`);
  } catch (err) {
    alert("❌ Saqlashda xatolik yuz berdi: " + err.message);
  }
}

async function resetCurrentI18nLangToDefaults() {
  const L = currentI18nEditorLang;
  if (!confirm(`Haqiqatdan ham [${I18N_LANG_LABELS[L] || L}] tili sozlamalarini standart holatga qaytarmoqchimisiz?`)) return;

  if (customI18nSettings.guidelines && customI18nSettings.guidelines[L]) {
    delete customI18nSettings.guidelines[L];
  }
  if (customI18nSettings.questions) {
    Object.keys(customI18nSettings.questions).forEach(k => {
      if (customI18nSettings.questions[k][L]) delete customI18nSettings.questions[k][L];
    });
  }
  if (customI18nSettings.deferReasons) {
    Object.keys(customI18nSettings.deferReasons).forEach(k => {
      if (customI18nSettings.deferReasons[k][L]) delete customI18nSettings.deferReasons[k][L];
    });
  }

  try {
    if (db) {
      await db.ref("settings/i18n").set(customI18nSettings);
    }
    populateI18nEditorForm(L);
    alert(`✅ [${I18N_LANG_LABELS[L] || L}] tili standart holatga qaytarildi.`);
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

function testPrintCurrentI18nPreview() {
  const L = currentI18nEditorLang;
  const samplePatient = {
    ticketId: "84210",
    name: "Sayidov Sherali",
    patientType: "Bo'limda yotibdi",
    department: "Xirurgiya",
    referringDoctor: "Dr. Ahmedov",
    room: "1-MRT Xonasi",
    doctorName: "MRT 1 (Siemens)",
    service: "Bosh Miya MRT (Kontrastsiz)",
    scheduledTime: "08:00",
    endTime: "08:29",
    timeSlot: "08:00 - 08:29",
    appointmentDate: "2026-08-24",
    registeredBy: "TB1 - Turatov Hojiakbar",
    rescheduleReason: "Bemorning shaxsiy iltimosi / Vaqti to'g'ri kelmadi",
    preparation: "Kamida 6-8 soat och qoringa kelish. Qonda Kreatinin va Mochevina tahlili natijasi (oxirgi 3 kun ichida). Qandli diabet bo'lsa: Metformin dori vositasini 48 soat oldin to'xtatish.",
    contraindications: "Yodli kontrastga allergiya. Buyrak yetishmovchiligi. Gipertireoz. Homiladorlik.",
    servicesList: [
      {
        name: "Bosh Miya MRT",
        preparation: "Kamida 6-8 soat och qoringa kelish. Qonda Kreatinin va Mochevina tahlili natijasi.",
        contraindications: "Yodli kontrastga allergiya. Buyrak yetishmovchiligi."
      }
    ]
  };

  if (currentI18nPreviewMode === 'ticket') {
    openPrintModalDirect(samplePatient, true, L);
  } else {
    printConsentFormDirect(samplePatient, L);
  }
}
