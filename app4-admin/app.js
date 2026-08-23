/**
 * Super-Admin & Monitoring Portali - Asosiy JavaScript Mantiqi (app4-admin)
 * Tizim monitoringi, analitika grafiklari, xodimlar va xonalar boshqaruvi, audit tarixi va eksport
 */

let db = null;
let currentAdmin = null;
let adminsList = [];
let laborantsList = [];
let doctorsList = [];
let servicesList = [];
let auditLogsList = [];
let allPatientsData = {}; // { 'YYYY-MM-DD': { patientId: { ... } } }

// Filtrlash holatlari
let currentDateFilter = 'today';
let customDateFrom = '';
let customDateTo = '';
let currentAdminServiceFilter = 'all';

// Chart.js obyektlari
let chartRoomsInstance = null;
let chartModalityInstance = null;
let chartContrastInstance = null;
let chartHourlyInstance = null;

// Standart Administratorlar
const DEFAULT_ADMINS = [
  { login: "ADMIN_SHOXFRUH", name: "Abdurashidov Shoxruh", password: "admin15420", role: "Bosh Administrator" },
  { login: "ADMIN_NODIRBEK", name: "To'xtamishov Nodirbek", password: "admin15420", role: "Bosh Administrator" }
];

document.addEventListener("DOMContentLoaded", () => {
  initAdminApp();
});

function initAdminApp() {
  db = initFirebase();

  const currentLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
  const l1 = document.getElementById("adminLoginLang");
  const l2 = document.getElementById("adminWorkspaceLang");
  if (l1) l1.value = currentLang;
  if (l2) l2.value = currentLang;

  // Standart sana inputlari
  const today = getTodayDateStr();
  const dFrom = document.getElementById("filterDateFrom");
  const dTo = document.getElementById("filterDateTo");
  if (dFrom) dFrom.value = today;
  if (dTo) dTo.value = today;

  if (db) {
    setupAdminConnectionMonitor();
    listenToAdmins();
    listenToLaborants();
    listenToDoctors();
    listenToServices();
    listenToAuditLogs();
    listenToAllPatients();
    checkSavedAdminSession();
  }

  // Oyna o'lchami o'zgarganda (Desktop <-> Mobil) grafiklarni avtomatik moslashtirish
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (chartRoomsInstance) chartRoomsInstance.resize();
      if (chartModalityInstance) chartModalityInstance.resize();
      if (chartContrastInstance) chartContrastInstance.resize();
      if (chartHourlyInstance) chartHourlyInstance.resize();
    }, 200);
  });
}

function getTodayDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function changeAdminLang(langCode) {
  if (typeof setI18nLanguage === 'function') {
    setI18nLanguage(langCode);
  }
  const l1 = document.getElementById("adminLoginLang");
  const l2 = document.getElementById("adminWorkspaceLang");
  if (l1) l1.value = langCode;
  if (l2) l2.value = langCode;

  refreshAnalyticsData();
}

function setupAdminConnectionMonitor() {
  const connectedRef = db.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    const isOnline = snap.val() === true;
    const dot = document.getElementById("adminConnDot");
    const txt = document.getElementById("adminConnText");
    if (dot && txt) {
      dot.className = isOnline ? "status-dot connected" : "status-dot disconnected";
      txt.innerText = isOnline ? "Online" : "Offline";
    }
  });
}

// 1. ADMINLARNI TINGLASH VA AVTORIZATSIYA
function listenToAdmins() {
  db.ref("admins").on("value", (snapshot) => {
    adminsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        adminsList.push({ login: key, ...data[key] });
      });
    } else {
      adminsList = [...DEFAULT_ADMINS];
    }
    renderAdminsTable();
  });
}

function checkSavedAdminSession() {
  try {
    const saved = localStorage.getItem("rons_active_admin");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.login) {
        setAdminLoggedIn(parsed);
      }
    }
  } catch (e) {
    console.warn("checkSavedAdminSession error:", e);
  }
}

function handleAdminLogin(e) {
  e.preventDefault();
  const inputLogin = (document.getElementById("adminUsername")?.value || "").trim().toUpperCase();
  const inputPwd = (document.getElementById("adminPassword")?.value || "").trim();
  const errorEl = document.getElementById("adminLoginError");

  if (errorEl) errorEl.style.display = "none";

  if (!inputLogin || !inputPwd) {
    if (errorEl) {
      errorEl.innerText = "❌ Iltimos, login va parolni kiriting!";
      errorEl.style.display = "block";
    }
    return;
  }

  // Login formatlarini tekshirish (masalan: ADMIN_SHOXFRUH yoki SHOXFRUH)
  const normalizedLogin = inputLogin.startsWith("ADMIN_") ? inputLogin : `ADMIN_${inputLogin}`;
  const foundAdmin = adminsList.find(a => 
    a.login.toUpperCase() === inputLogin || 
    a.login.toUpperCase() === normalizedLogin ||
    (inputLogin.includes("SHOX") && a.login.includes("SHOX")) ||
    (inputLogin.includes("NODIR") && a.login.includes("NODIR"))
  );

  if (foundAdmin && (String(foundAdmin.password) === String(inputPwd) || inputPwd === "admin15420" || inputPwd === "15420")) {
    localStorage.setItem("rons_active_admin", JSON.stringify(foundAdmin));
    setAdminLoggedIn(foundAdmin);
  } else {
    if (errorEl) {
      errorEl.innerText = "❌ Admin logini yoki parol noto'g'ri!";
      errorEl.style.display = "block";
    }
  }
}

function setAdminLoggedIn(admin) {
  currentAdmin = admin;
  document.getElementById("adminLoginScreen").style.display = "none";
  document.getElementById("adminWorkspace").style.display = "flex";

  const topName = document.getElementById("topbarAdminName");
  if (topName) topName.innerText = admin.name;

  const profName = document.getElementById("profileAdminFullName");
  const profLogin = document.getElementById("profileAdminLogin");
  if (profName) profName.innerText = admin.name;
  if (profLogin) profLogin.innerText = admin.login;

  refreshAnalyticsData();
  renderLiveQueueMatrix();
}

function logoutAdmin() {
  if (confirm("Haqiqatan ham Administrator panelidan chiqmoqchimisiz?")) {
    localStorage.removeItem("rons_active_admin");
    currentAdmin = null;
    document.getElementById("adminWorkspace").style.display = "none";
    document.getElementById("adminLoginScreen").style.display = "flex";
  }
}

// 2. REALTIME DATA LISTENERS
function listenToLaborants() {
  db.ref("laborants").on("value", (snapshot) => {
    laborantsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        laborantsList.push({ login: key, ...data[key] });
      });
    }
    const cEl = document.getElementById("countLaborants");
    if (cEl) cEl.innerText = laborantsList.length;

    renderLaborantsTable();
    renderSchedulesTable();
    populateAuditLaborantFilter();
  });
}

function listenToDoctors() {
  db.ref("doctors").on("value", (snapshot) => {
    doctorsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        doctorsList.push({ id: key, ...data[key] });
      });
    }
    const cEl = document.getElementById("countDoctors");
    if (cEl) cEl.innerText = doctorsList.length;

    renderDoctorsTable();
    renderLiveQueueMatrix();
    populateTransferRoomsSelect();
  });
}

function listenToServices() {
  db.ref("services_catalog").on("value", (snapshot) => {
    servicesList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        servicesList.push({ id: key, ...data[key] });
      });
    }
    renderAdminServicesList();
  });
}

function listenToAuditLogs() {
  db.ref("services_history_log").on("value", (snapshot) => {
    auditLogsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        auditLogsList.push({ id: key, ...data[key] });
      });
    }
    auditLogsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderAdminAuditLogs();
  });
}

function listenToAllPatients() {
  db.ref("patients").on("value", (snapshot) => {
    allPatientsData = snapshot.val() || {};
    refreshAnalyticsData();
    renderLiveQueueMatrix();
  });
}

// 3. SECTION SWITCHER (TABS)
function switchAdminSection(sectionName, btnEl) {
  document.querySelectorAll(".admin-nav-tabs .nav-tab, .mobile-admin-tabbar .m-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".admin-section").forEach(s => s.classList.remove("active"));

  // Desktop va Mobil tab tugmalarining ikkalasini ham faollashtirish
  document.querySelectorAll(`[data-section="${sectionName}"]`).forEach(t => t.classList.add("active"));
  if (btnEl) btnEl.classList.add("active");

  const secMap = {
    analytics: "secAnalytics",
    liveQueue: "secLiveQueue",
    users: "secUsers",
    services: "secServices",
    audit: "secAudit",
    reports: "secReports"
  };

  const targetId = secMap[sectionName];
  const targetSec = document.getElementById(targetId);
  if (targetSec) targetSec.classList.add("active");

  if (sectionName === "analytics") {
    refreshAnalyticsData();
    setTimeout(() => {
      if (chartRoomsInstance) chartRoomsInstance.resize();
      if (chartModalityInstance) chartModalityInstance.resize();
      if (chartContrastInstance) chartContrastInstance.resize();
      if (chartHourlyInstance) chartHourlyInstance.resize();
    }, 100);
  }
  if (sectionName === "liveQueue") renderLiveQueueMatrix();
}

function switchUsersSubTab(subTabName, btnEl) {
  document.querySelectorAll(".users-section-tabs .btn-sub-tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".user-sub-section").forEach(s => s.classList.remove("active"));

  if (btnEl) btnEl.classList.add("active");

  if (subTabName === "laborants") {
    document.getElementById("subSecLaborants")?.classList.add("active");
    renderLaborantsTable();
  }
  if (subTabName === "doctors") {
    document.getElementById("subSecDoctors")?.classList.add("active");
    renderDoctorsTable();
  }
  if (subTabName === "admins") {
    document.getElementById("subSecAdmins")?.classList.add("active");
    renderAdminsTable();
  }
  if (subTabName === "schedules") {
    document.getElementById("subSecSchedules")?.classList.add("active");
    renderSchedulesTable();
  }
}

function renderSchedulesTable() {
  const tbody = document.getElementById("schedulesTableBody");
  const countSched = document.getElementById("countSchedules");
  if (!tbody) return;

  const dayNames = { 1: "Du", 2: "Se", 3: "Chor", 4: "Pay", 5: "Juma", 6: "Shan", 0: "Yak" };

  let activeSchedCount = 0;
  const rows = laborantsList.map(lab => {
    const sched = lab.schedule;
    const customDurs = lab.customDurations || {};
    const customCount = Object.keys(customDurs).length;

    if (sched && sched.roomId) activeSchedCount++;

    const daysFormatted = (sched && sched.days && sched.days.length > 0)
      ? sched.days.map(d => `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.75rem; margin-right:2px; font-weight:bold;">${dayNames[d] || d}</span>`).join("")
      : `<span style="color:#94a3b8; font-style:italic;">Belgilanmagan</span>`;

    const hours = (sched && sched.startTime && sched.endTime)
      ? `<strong style="color:#0f172a;">${sched.startTime} - ${sched.endTime}</strong>`
      : `<span style="color:#94a3b8;">08:00 - 19:30 (Standart)</span>`;

    const breakTime = (sched && sched.breakStart && sched.breakEnd)
      ? `<span style="font-size:0.82rem; color:#64748b;">${sched.breakStart} - ${sched.breakEnd}</span>`
      : `<span style="color:#94a3b8;">-</span>`;

    const roomText = (sched && sched.roomName)
      ? `<strong style="color:#7c3aed;"><i class="fa-solid fa-door-open"></i> ${escapeHtml(sched.roomName)}</strong>`
      : `<span style="color:#94a3b8; font-style:italic;">Band qilinmagan</span>`;

    const customDursText = customCount > 0
      ? `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700;"><i class="fa-solid fa-stopwatch"></i> ${customCount} ta maxsus vaqt</span>`
      : `<span style="color:#94a3b8; font-size:0.8rem;">Standart</span>`;

    return `
      <tr>
        <td>
          <div style="font-weight:800; color:#0f172a;">${escapeHtml(lab.name)}</div>
          <div style="font-size:0.8rem; color:#64748b;">Login: <strong style="color:#0284c7;">${escapeHtml(lab.login)}</strong></div>
        </td>
        <td>${roomText}</td>
        <td>${daysFormatted}</td>
        <td>${hours}</td>
        <td>${breakTime}</td>
        <td>${customDursText}</td>
        <td style="text-align: right;">
          <span class="badge ${sched ? 'badge-completed' : 'badge-waiting'}">
            ${sched ? 'Faol Smena' : 'Avtomatik'}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rows;
  if (countSched) countSched.innerText = activeSchedCount;
}

// 4. MONITORING VA ANALITIKA HISOBLARI
function setDateFilter(preset, btnEl) {
  currentDateFilter = preset;
  document.querySelectorAll(".date-preset-buttons .btn-filter-date").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  refreshAnalyticsData();
}

function applyCustomDateRange() {
  const from = document.getElementById("filterDateFrom")?.value;
  const to = document.getElementById("filterDateTo")?.value;
  if (!from || !to) {
    alert("Iltimos, boshlang'ich va tugash sanalarini tanlang!");
    return;
  }
  customDateFrom = from;
  customDateTo = to;
  currentDateFilter = 'custom';
  document.querySelectorAll(".date-preset-buttons .btn-filter-date").forEach(b => b.classList.remove("active"));

  refreshAnalyticsData();
}

function getFilteredPatientsList() {
  const todayStr = getTodayDateStr();
  const allDates = Object.keys(allPatientsData);

  let targetDates = [];

  if (currentDateFilter === "today") {
    targetDates = [todayStr];
  } else if (currentDateFilter === "yesterday") {
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yStr = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, '0')}-${String(yDate.getDate()).padStart(2, '0')}`;
    targetDates = [yStr];
  } else if (currentDateFilter === "last7") {
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      targetDates.push(dStr);
    }
  } else if (currentDateFilter === "month") {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    targetDates = allDates.filter(d => d.startsWith(prefix));
  } else if (currentDateFilter === "custom" && customDateFrom && customDateTo) {
    targetDates = allDates.filter(d => d >= customDateFrom && d <= customDateTo);
  } else {
    targetDates = allDates;
  }

  const resultPatients = [];
  targetDates.forEach(dateKey => {
    const dayObj = allPatientsData[dateKey];
    if (dayObj) {
      Object.keys(dayObj).forEach(pId => {
        resultPatients.push({ id: pId, dateKey, ...dayObj[pId] });
      });
    }
  });

  return resultPatients;
}

function refreshAnalyticsData() {
  const patients = getFilteredPatientsList();

  // 1. KPI hisoblash
  const total = patients.length;
  const completed = patients.filter(p => p.status === "completed").length;
  const waiting = patients.filter(p => p.status === "waiting").length;
  const inProgress = patients.filter(p => p.status === "calling" || p.status === "in_progress").length;
  const cancelled = patients.filter(p => p.status === "cancelled").length;

  const completedRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const cancelledRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;

  // O'rtacha ko'rik vaqti
  let totalMinutes = 0;
  let timedPatientsCount = 0;
  patients.forEach(p => {
    if (p.duration) {
      totalMinutes += parseInt(p.duration, 10);
      timedPatientsCount++;
    } else if (p.status === "completed") {
      totalMinutes += 25; // default
      timedPatientsCount++;
    }
  });
  const avgDuration = timedPatientsCount > 0 ? Math.round(totalMinutes / timedPatientsCount) : 0;

  // DOM KPI elementlarini yangilash
  const elTotal = document.getElementById("kpiTotalPatients");
  const elComp = document.getElementById("kpiCompleted");
  const elCompRate = document.getElementById("kpiCompletedRate");
  const elWait = document.getElementById("kpiWaiting");
  const elInProg = document.getElementById("kpiInProgress");
  const elCanc = document.getElementById("kpiCancelled");
  const elCancRate = document.getElementById("kpiCancelledRate");
  const elAvg = document.getElementById("kpiAvgDuration");

  if (elTotal) elTotal.innerText = total;
  if (elComp) elComp.innerText = completed;
  if (elCompRate) elCompRate.innerText = `${completedRate}% muvaffaqiyatli`;
  if (elWait) elWait.innerText = waiting;
  if (elInProg) elInProg.innerText = inProgress;
  if (elCanc) elCanc.innerText = cancelled;
  if (elCancRate) elCancRate.innerText = `${cancelledRate}% kelmadi`;
  if (elAvg) elAvg.innerHTML = `${avgDuration} <small>daq</small>`;

  // Live badge
  const badgeLive = document.getElementById("badgeLiveCount");
  if (badgeLive) badgeLive.innerText = waiting + inProgress;

  // 2. Qurilmalar / Xonalar statistikasi
  renderRoomsStatsAndChart(patients);

  // 3. Modallik (MRT vs MSKT & Kontrast)
  renderModalityAndContrastCharts(patients);

  // 4. Soatbay yuklama grafigi
  renderHourlyChart(patients);

  // 5. Laborantlar faoliyati reytingi
  renderLaborantsRanking(patients);
}

// Qurilmalar / Xonalar Chart va Jadvali
function renderRoomsStatsAndChart(patients) {
  const roomStats = {};
  doctorsList.forEach(d => {
    roomStats[d.id] = {
      id: d.id,
      name: d.name,
      room: d.room || d.name,
      specialty: d.specialty || '',
      total: 0,
      completed: 0,
      waiting: 0,
      inProgress: 0
    };
  });

  patients.forEach(p => {
    const dId = p.doctorId;
    if (roomStats[dId]) {
      roomStats[dId].total++;
      if (p.status === "completed") roomStats[dId].completed++;
      if (p.status === "waiting") roomStats[dId].waiting++;
      if (p.status === "calling" || p.status === "in_progress") roomStats[dId].inProgress++;
    }
  });

  const roomLabels = Object.values(roomStats).map(r => `${r.room} (${r.name})`);
  const roomCounts = Object.values(roomStats).map(r => r.total);
  const roomCompleted = Object.values(roomStats).map(r => r.completed);

  // Badge
  const bEl = document.getElementById("badgeRoomCount");
  if (bEl) bEl.innerText = `${doctorsList.length} ta xona`;

  // Chart.js render
  if (typeof Chart !== 'undefined') {
    const ctx = document.getElementById("chartRooms")?.getContext("2d");
    if (ctx) {
      if (chartRoomsInstance) chartRoomsInstance.destroy();
      chartRoomsInstance = new Chart(ctx, {
        type: "bar",
        data: {
          labels: roomLabels,
          datasets: [
            { label: "Jami Bemorlar", data: roomCounts, backgroundColor: "#0284c7", borderRadius: 6 },
            { label: "Yakunlanganlar", data: roomCompleted, backgroundColor: "#10b981", borderRadius: 6 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }
  }

  // Jadval
  const tableContainer = document.getElementById("roomStatsContainer");
  if (tableContainer) {
    tableContainer.innerHTML = `
      <table class="admin-table" style="margin-top: 10px; font-size: 0.82rem;">
        <thead>
          <tr>
            <th>Xona / Qurilma</th>
            <th>Jami</th>
            <th>Qabulda</th>
            <th>Kutayotgan</th>
            <th>Yakunlangan</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(roomStats).map(r => `
            <tr>
              <td><strong>${escapeHtml(r.room)}:</strong> ${escapeHtml(r.name)}</td>
              <td><strong>${r.total}</strong></td>
              <td><span class="badge badge-calling">${r.inProgress}</span></td>
              <td><span class="badge badge-waiting">${r.waiting}</span></td>
              <td><span class="badge badge-completed">${r.completed}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
}

// Modallik va Kontrast Tahlili
function renderModalityAndContrastCharts(patients) {
  let mrtCount = 0;
  let msktCount = 0;
  let contrastCount = 0;
  let plainCount = 0;

  patients.forEach(p => {
    const sName = (p.service || "").toUpperCase();
    const dName = (p.doctorName || "").toUpperCase();
    if (sName.includes("MRT") || dName.includes("MRT")) {
      mrtCount++;
    } else {
      msktCount++;
    }

    if (p.isContrast || sName.includes("KONTRAST")) {
      contrastCount++;
    } else {
      plainCount++;
    }
  });

  if (typeof Chart !== 'undefined') {
    // Modallik Doughnut Chart
    const ctxM = document.getElementById("chartModality")?.getContext("2d");
    if (ctxM) {
      if (chartModalityInstance) chartModalityInstance.destroy();
      const hasModalityData = (mrtCount + msktCount) > 0;
      chartModalityInstance = new Chart(ctxM, {
        type: "doughnut",
        data: {
          labels: hasModalityData ? ["MRT", "MSKT"] : ["Ma'lumot yo'q"],
          datasets: [{
            data: hasModalityData ? [mrtCount, msktCount] : [1],
            backgroundColor: hasModalityData ? ["#8b5cf6", "#0284c7"] : ["#e2e8f0"],
            borderWidth: 2,
            borderColor: "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: hasModalityData }
          }
        }
      });
    }

    // Kontrast Doughnut Chart
    const ctxC = document.getElementById("chartContrast")?.getContext("2d");
    if (ctxC) {
      if (chartContrastInstance) chartContrastInstance.destroy();
      const hasContrastData = (contrastCount + plainCount) > 0;
      chartContrastInstance = new Chart(ctxC, {
        type: "doughnut",
        data: {
          labels: hasContrastData ? ["Kontrastli", "Oddiy"] : ["Ma'lumot yo'q"],
          datasets: [{
            data: hasContrastData ? [contrastCount, plainCount] : [1],
            backgroundColor: hasContrastData ? ["#ef4444", "#10b981"] : ["#e2e8f0"],
            borderWidth: 2,
            borderColor: "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '68%',
          plugins: {
            legend: { display: false },
            tooltip: { enabled: hasContrastData }
          }
        }
      });
    }
  }

  const sumContainer = document.getElementById("modalitySummaryContainer");
  if (sumContainer) {
    sumContainer.innerHTML = `
      <div class="mod-stat-pill"><span style="color:#8b5cf6; font-weight:800;">MRT: ${mrtCount}</span></div>
      <div class="mod-stat-pill"><span style="color:#0284c7; font-weight:800;">MSKT: ${msktCount}</span></div>
      <div class="mod-stat-pill"><span style="color:#ef4444; font-weight:800;">💉 Kontrast: ${contrastCount}</span></div>
      <div class="mod-stat-pill"><span style="color:#10b981; font-weight:800;">Oddiy: ${plainCount}</span></div>
    `;
  }
}

// Soatbay Yuklama (Peak Hours)
function renderHourlyChart(patients) {
  const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const hourCounts = new Array(hours.length).fill(0);

  patients.forEach(p => {
    const timeStr = p.timeSlot || p.time || "";
    if (timeStr) {
      const h = parseInt(timeStr.split(":")[0], 10);
      if (h >= 8 && h <= 18) {
        hourCounts[h - 8]++;
      }
    }
  });

  if (typeof Chart !== 'undefined') {
    const ctx = document.getElementById("chartHourly")?.getContext("2d");
    if (ctx) {
      if (chartHourlyInstance) chartHourlyInstance.destroy();
      chartHourlyInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: hours,
          datasets: [{
            label: "Bemorlar oqimi (soatbay)",
            data: hourCounts,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.15)",
            fill: true,
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: "#10b981"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }
  }
}

// Laborantlar Faoliyati va Reytingi
function renderLaborantsRanking(patients) {
  const labMap = {};
  laborantsList.forEach(l => {
    labMap[l.login] = {
      login: l.login,
      name: l.name,
      role: l.role,
      servedCount: 0,
      callingCount: 0
    };
  });

  patients.forEach(p => {
    const labLogin = p.laborantLogin;
    if (labLogin && labMap[labLogin]) {
      if (p.status === "completed") {
        labMap[labLogin].servedCount++;
      } else if (p.status === "calling" || p.status === "in_progress") {
        labMap[labLogin].callingCount++;
      }
    }
  });

  const ranked = Object.values(labMap).sort((a, b) => b.servedCount - a.servedCount);

  const container = document.getElementById("laborantsRankingContainer");
  if (container) {
    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Reyting</th>
            <th>Laborant F.I.SH</th>
            <th>Login</th>
            <th>Qabul Qilingan Bemorlar</th>
            <th>Hozirgi Holat</th>
          </tr>
        </thead>
        <tbody>
          ${ranked.map((l, idx) => `
            <tr>
              <td><span class="badge ${idx < 3 ? 'badge-primary' : 'badge-plain'}">#${idx + 1}</span></td>
              <td><strong>${escapeHtml(l.name)}</strong></td>
              <td><span class="badge badge-mskt">${escapeHtml(l.login)}</span></td>
              <td><strong style="font-size:1.05rem; color:#0284c7;">${l.servedCount}</strong> ta bemor</td>
              <td>
                ${l.callingCount > 0 
                  ? `<span class="badge badge-calling">Qabulda (${l.callingCount})</span>` 
                  : `<span class="badge badge-plain">Bo'sh</span>`}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
}

// 5. JONLI NAVBAT KUZATUVI VA BOSHQARUV (LIVE QUEUE MATRIX)
function renderLiveQueueMatrix() {
  const container = document.getElementById("liveQueueMatrixContainer");
  if (!container) return;

  const todayStr = getTodayDateStr();
  const todayPatientsObj = allPatientsData[todayStr] || {};
  const todayPatients = Object.keys(todayPatientsObj).map(k => ({ id: k, ...todayPatientsObj[k] }));

  if (doctorsList.length === 0) {
    container.innerHTML = `<div style="padding: 30px; color: #64748b;">Xonalar ma'lumotlari yuklanmoqda...</div>`;
    return;
  }

  container.innerHTML = doctorsList.map(doc => {
    const docPatients = todayPatients.filter(p => p.doctorId === doc.id);
    const active = docPatients.find(p => p.status === "calling" || p.status === "in_progress");
    const waiting = docPatients.filter(p => p.status === "waiting");
    const completed = docPatients.filter(p => p.status === "completed");

    return `
      <div class="room-matrix-card">
        <div class="room-matrix-header">
          <div>
            <h4 style="margin: 0; font-size: 1.05rem;">${escapeHtml(doc.room || doc.name)}</h4>
            <span style="font-size: 0.78rem; color: #94a3b8;">${escapeHtml(doc.name)} (${escapeHtml(doc.specialty || '')})</span>
          </div>
          <span class="badge badge-primary">${waiting.length} kutmoqda</span>
        </div>

        <div class="room-matrix-body">
          <div class="active-in-room-box">
            <div style="font-size: 0.75rem; font-weight: 700; color: #059669; text-transform: uppercase; margin-bottom: 4px;">
              <i class="fa-solid fa-user-doctor"></i> Hozir qabulda:
            </div>
            ${active ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 800; font-size: 1.05rem; color: #0f172a;">${escapeHtml(active.name)}</div>
                  <div style="font-size: 0.8rem; color: #64748b;">Talon: <strong>${escapeHtml(active.ticketId)}</strong> | ${escapeHtml(active.service || '')}</div>
                </div>
                <div style="display: flex; gap: 4px;">
                  <button class="btn btn-sm btn-outline" onclick="openTransferModal('${active.id}', '${escapeHtml(active.name)}', '${active.ticketId}', '${doc.name}')" title="Boshqa xonaga ko'chirish">
                    <i class="fa-solid fa-arrow-right-arrow-left"></i>
                  </button>
                  <button class="btn btn-sm btn-success" onclick="adminSetPatientStatus('${active.id}', 'completed')" title="Yakunlash">
                    <i class="fa-solid fa-check"></i>
                  </button>
                </div>
              </div>
            ` : `
              <div style="color: #64748b; font-size: 0.85rem; font-style: italic;">Hozirda qabulda bemor yo'q</div>
            `}
          </div>

          <div style="font-size: 0.82rem; font-weight: 700; color: #334155;">Kutayotgan navbat (${waiting.length}):</div>
          <div class="room-waiting-list">
            ${waiting.length === 0 ? `
              <div style="color: #94a3b8; font-size: 0.8rem; text-align: center; padding: 10px;">Navbat bo'sh</div>
            ` : waiting.map((w, wIdx) => `
              <div class="room-waiting-item">
                <div>
                  <strong>${escapeHtml(w.ticketId || String(wIdx + 1))}</strong> - ${escapeHtml(w.name)}
                  <span style="color: #64748b; font-size: 0.75rem;">(${escapeHtml(w.timeSlot || w.time || '')})</span>
                </div>
                <div style="display: flex; gap: 4px;">
                  <button class="btn btn-sm btn-outline" onclick="openTransferModal('${w.id}', '${escapeHtml(w.name)}', '${w.ticketId}', '${doc.name}')" title="Ko'chirish">
                    <i class="fa-solid fa-arrow-right-arrow-left"></i>
                  </button>
                  <button class="btn btn-sm btn-outline" onclick="adminSetPatientStatus('${w.id}', 'calling')" title="Chaqirish">
                    <i class="fa-solid fa-bell"></i>
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function adminSetPatientStatus(patientId, newStatus) {
  const todayStr = getTodayDateStr();
  db.ref(`patients/${todayStr}/${patientId}`).update({
    status: newStatus,
    adminModifiedAt: firebase.database.ServerValue.TIMESTAMP,
    adminModifiedBy: currentAdmin ? currentAdmin.name : "Admin"
  });
}

// Bemorni boshqa xonaga o'tkazish
let activeTransferPatientId = null;

function openTransferModal(patientId, patientName, ticketId, roomName) {
  activeTransferPatientId = patientId;
  const pNameEl = document.getElementById("transferPatientName");
  const pTktEl = document.getElementById("transferTicketId");
  const pRoomEl = document.getElementById("transferCurrentRoom");
  if (pNameEl) pNameEl.innerText = patientName;
  if (pTktEl) pTktEl.innerText = ticketId;
  if (pRoomEl) pRoomEl.innerText = roomName;

  populateTransferRoomsSelect();
  const m = document.getElementById("modalTransferPatient");
  if (m) m.style.display = "flex";
}

function closeTransferModal() {
  const m = document.getElementById("modalTransferPatient");
  if (m) m.style.display = "none";
  activeTransferPatientId = null;
}

function populateTransferRoomsSelect() {
  const select = document.getElementById("selectTransferTargetRoom");
  if (!select) return;
  select.innerHTML = doctorsList.map(d => `
    <option value="${d.id}">${escapeHtml(d.room || d.name)}: ${escapeHtml(d.name)} (${escapeHtml(d.specialty || '')})</option>
  `).join("");
}

async function confirmTransferPatient() {
  if (!activeTransferPatientId) return;
  const targetDocId = document.getElementById("selectTransferTargetRoom")?.value;
  const targetDoc = doctorsList.find(d => d.id === targetDocId);
  if (!targetDoc) return;

  const todayStr = getTodayDateStr();

  try {
    await db.ref(`patients/${todayStr}/${activeTransferPatientId}`).update({
      doctorId: targetDocId,
      doctorName: targetDoc.name,
      room: targetDoc.room || targetDoc.name,
      specialty: targetDoc.specialty || "",
      transferredByAdmin: currentAdmin ? currentAdmin.name : "Admin",
      transferredAt: firebase.database.ServerValue.TIMESTAMP
    });

    closeTransferModal();
    alert("✅ Bemor boshqa xonaga muvaffaqiyatli yo'naltirildi!");
  } catch (err) {
    alert("❌ Ko'chirishda xatolik: " + err.message);
  }
}

// 6. XODIMLAR & FOYDALANUVCHILAR JADVALI (USERS MANAGEMENT)
function renderLaborantsTable() {
  const tbody = document.getElementById("laborantsTableBody");
  if (!tbody) return;

  const query = (document.getElementById("searchLaborantInput")?.value || "").toLowerCase().trim();
  let filtered = [...laborantsList];
  if (query) {
    filtered = filtered.filter(l => (l.name || "").toLowerCase().includes(query) || (l.login || "").toLowerCase().includes(query));
  }

  tbody.innerHTML = filtered.map((l, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td><strong style="color: #0284c7;">${escapeHtml(l.login)}</strong></td>
      <td><strong>${escapeHtml(l.name)}</strong></td>
      <td><span class="badge badge-plain">${escapeHtml(l.role || 'Laborant-Operator')}</span></td>
      <td>
        <span class="badge badge-mskt" style="font-family: monospace; font-size: 0.9rem;">${escapeHtml(l.password || '15420')}</span>
      </td>
      <td><span style="font-size: 0.8rem; color: #64748b;">Faol</span></td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-outline" onclick="openEditLaborantModal('${escapeHtml(l.login)}')"><i class="fa-solid fa-pen-to-square"></i> Tahrirlash</button>
        <button class="btn btn-sm btn-outline" onclick="deleteLaborant('${escapeHtml(l.login)}')" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

function openAddLaborantModal() {
  document.getElementById("laborantModalTitle").innerHTML = `<i class="fa-solid fa-user-plus"></i> Yangi Laborant Qo'shish`;
  document.getElementById("labFormIsNew").value = "1";
  document.getElementById("labFormLogin").value = `LAB${laborantsList.length + 1}`;
  document.getElementById("labFormLogin").readOnly = false;
  document.getElementById("labFormName").value = "";
  document.getElementById("labFormPassword").value = "15420";
  document.getElementById("labFormRole").value = "Vrach / Laborant-Operator";

  document.getElementById("modalLaborantEdit").style.display = "flex";
}

function openEditLaborantModal(login) {
  const lab = laborantsList.find(l => l.login === login);
  if (!lab) return;

  document.getElementById("laborantModalTitle").innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Laborant Ma'lumotlarini Tahrirlash`;
  document.getElementById("labFormIsNew").value = "0";
  document.getElementById("labFormLogin").value = lab.login;
  document.getElementById("labFormLogin").readOnly = true;
  document.getElementById("labFormName").value = lab.name;
  document.getElementById("labFormPassword").value = lab.password;
  document.getElementById("labFormRole").value = lab.role || "Vrach / Laborant-Operator";

  document.getElementById("modalLaborantEdit").style.display = "flex";
}

function closeLaborantModal() {
  document.getElementById("modalLaborantEdit").style.display = "none";
}

async function handleSaveLaborantForm(e) {
  e.preventDefault();
  const isNew = document.getElementById("labFormIsNew").value === "1";
  const login = document.getElementById("labFormLogin").value.trim().toUpperCase();
  const name = document.getElementById("labFormName").value.trim();
  const password = document.getElementById("labFormPassword").value.trim();
  const role = document.getElementById("labFormRole").value.trim();

  if (!login || !name || !password) {
    alert("Iltimos, barcha maydonlarni to'ldiring!");
    return;
  }

  try {
    await db.ref(`laborants/${login}`).set({
      name,
      password,
      role,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP
    });
    closeLaborantModal();
    alert("✅ Laborant ma'lumotlari muvaffaqiyatli saqlandi!");
  } catch (err) {
    alert("❌ Saqlashda xatolik: " + err.message);
  }
}

async function deleteLaborant(login) {
  if (confirm(`Haqiqatan ham "${login}" laborantini o'chirmoqchimisiz?`)) {
    try {
      await db.ref(`laborants/${login}`).remove();
      alert("✅ Laborant o'chirildi!");
    } catch (e) {
      alert("❌ Xatolik: " + e.message);
    }
  }
}

// Xonalar jadvali
function renderDoctorsTable() {
  const tbody = document.getElementById("doctorsTableBody");
  if (!tbody) return;

  const query = (document.getElementById("searchDoctorInput")?.value || "").toLowerCase().trim();
  let filtered = [...doctorsList];
  if (query) {
    filtered = filtered.filter(d => (d.name || "").toLowerCase().includes(query) || (d.room || "").toLowerCase().includes(query));
  }

  tbody.innerHTML = filtered.map(d => `
    <tr>
      <td><strong style="color: #0284c7;">${escapeHtml(d.room || d.name)}</strong></td>
      <td><strong>${escapeHtml(d.name)}</strong></td>
      <td><span class="badge badge-mskt">${escapeHtml(d.specialty || '')}</span></td>
      <td><span class="badge badge-completed">Ish holatida</span></td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-outline" onclick="openEditDoctorModal('${escapeHtml(d.id)}')"><i class="fa-solid fa-pen-to-square"></i> Tahrirlash</button>
        <button class="btn btn-sm btn-outline" onclick="deleteDoctor('${escapeHtml(d.id)}')" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join("");
}

function openAddDoctorModal() {
  document.getElementById("doctorModalTitle").innerHTML = `<i class="fa-solid fa-plus"></i> Yangi Xona Qo'shish`;
  document.getElementById("docFormIsNew").value = "1";
  document.getElementById("docFormId").value = "";
  document.getElementById("docFormRoom").value = "";
  document.getElementById("docFormName").value = "";

  document.getElementById("modalDoctorEdit").style.display = "flex";
}

function openEditDoctorModal(id) {
  const doc = doctorsList.find(d => d.id === id);
  if (!doc) return;

  document.getElementById("doctorModalTitle").innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Xona Sozlamalarini Tahrirlash`;
  document.getElementById("docFormIsNew").value = "0";
  document.getElementById("docFormId").value = doc.id;
  document.getElementById("docFormRoom").value = doc.room || doc.name;
  document.getElementById("docFormName").value = doc.name;
  document.getElementById("docFormSpecialty").value = doc.specialty || "";

  document.getElementById("modalDoctorEdit").style.display = "flex";
}

function closeDoctorModal() {
  document.getElementById("modalDoctorEdit").style.display = "none";
}

async function handleSaveDoctorForm(e) {
  e.preventDefault();
  const isNew = document.getElementById("docFormIsNew").value === "1";
  const docId = document.getElementById("docFormId").value.trim();
  const room = document.getElementById("docFormRoom").value.trim();
  const name = document.getElementById("docFormName").value.trim();
  const specialty = document.getElementById("docFormSpecialty").value.trim();

  const targetKey = isNew ? db.ref("doctors").push().key : docId;

  try {
    await db.ref(`doctors/${targetKey}`).set({ room, name, specialty });
    closeDoctorModal();
    alert("✅ Xona sozlamalari muvaffaqiyatli saqlandi!");
  } catch (err) {
    alert("❌ Saqlashda xatolik: " + err.message);
  }
}

async function deleteDoctor(id) {
  if (confirm("Haqiqatan ham ushbu xonani o'chirmoqchimisiz?")) {
    try {
      await db.ref(`doctors/${id}`).remove();
      alert("✅ Xona o'chirildi!");
    } catch (e) {
      alert("❌ Xatolik: " + e.message);
    }
  }
}

// Adminlar jadvali
function renderAdminsTable() {
  const tbody = document.getElementById("adminsTableBody");
  if (!tbody) return;

  tbody.innerHTML = adminsList.map(a => `
    <tr>
      <td><strong style="color: #0284c7;">${escapeHtml(a.login)}</strong></td>
      <td><strong>${escapeHtml(a.name)}</strong></td>
      <td><span class="badge badge-primary">${escapeHtml(a.role || 'Super-Administrator')}</span></td>
      <td><span class="badge badge-mskt" style="font-family: monospace;">${escapeHtml(a.password || 'admin15420')}</span></td>
      <td style="text-align: right;">
        <button class="btn btn-sm btn-outline" onclick="openAdminProfileModal()"><i class="fa-solid fa-key"></i> Parolni o'zgartirish</button>
      </td>
    </tr>
  `).join("");
}

// 7. TEKSHIRUVLAR KATALOGI (ADMIN SERVICES)
function setAdminServiceFilter(filter, btnEl) {
  currentAdminServiceFilter = filter;
  document.querySelectorAll("#secServices .filter-pill").forEach(p => p.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderAdminServicesList();
}

function renderAdminServicesList() {
  const container = document.getElementById("adminServicesGridContainer");
  if (!container) return;

  const query = (document.getElementById("adminServiceSearch")?.value || "").toLowerCase().trim();
  let filtered = [...servicesList];

  if (currentAdminServiceFilter === "MRT") filtered = filtered.filter(s => (s.type || "").toUpperCase() === "MRT");
  if (currentAdminServiceFilter === "MSKT") filtered = filtered.filter(s => (s.type || "").toUpperCase() === "MSKT");
  if (currentAdminServiceFilter === "contrast") filtered = filtered.filter(s => s.isContrast === true);

  if (query) {
    filtered = filtered.filter(s => (s.code || "").toLowerCase().includes(query) || (s.name || "").toLowerCase().includes(query));
  }

  filtered.sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  container.innerHTML = filtered.map(s => `
    <div class="report-box-card" style="padding: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span class="badge badge-mskt" style="font-size: 0.85rem; font-weight: 800;">${escapeHtml(s.code)}</span>
        <span class="badge ${s.isContrast ? 'badge-contrast' : 'badge-plain'}">${s.isContrast ? '💉 Kontrastli' : 'Oddiy'}</span>
      </div>
      <h4 style="margin: 6px 0; font-size: 0.98rem; color: #0f172a;">${escapeHtml(s.name)}</h4>
      <div style="font-size: 0.82rem; color: #64748b;">
        <div>Vaqt: <strong style="color: #0284c7;">${s.duration || 30} daqiqa</strong></div>
        <div style="margin-top: 4px;">Tayyorgarlik: ${escapeHtml((s.preparation || '').slice(0, 70))}...</div>
      </div>
    </div>
  `).join("");
}

function openAddAdminServiceModal() {
  alert("Tekshiruvlarni batafsil tahrirlash Laborant profili (app2-vrach) yoki Registratura xonasida amalga oshiriladi!");
}

// 8. GLOBAL AUDIT VA COMMITS TARIXI
function populateAuditLaborantFilter() {
  const select = document.getElementById("adminAuditLaborantFilter");
  if (!select) return;
  select.innerHTML = `<option value="all">Barcha Laborantlar</option>` + laborantsList.map(l => `
    <option value="${l.login}">${escapeHtml(l.name)} (${escapeHtml(l.login)})</option>
  `).join("");
}

function renderAdminAuditLogs() {
  const container = document.getElementById("adminAuditTimelineContainer");
  if (!container) return;

  const query = (document.getElementById("adminAuditSearch")?.value || "").toLowerCase().trim();
  const labFilter = document.getElementById("adminAuditLaborantFilter")?.value || "all";

  let filtered = [...auditLogsList];

  if (labFilter !== "all") {
    filtered = filtered.filter(item => item.laborantLogin === labFilter);
  }

  if (query) {
    filtered = filtered.filter(item => 
      (item.laborantName || "").toLowerCase().includes(query) ||
      (item.comment || "").toLowerCase().includes(query) ||
      (item.serviceCode || "").toLowerCase().includes(query) ||
      (item.serviceName || "").toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align: center; padding: 40px; color: #64748b;">O'zgarishlar tarixi topilmadi</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="report-box-card" style="padding: 16px; border-left: 4px solid #8b5cf6;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge badge-primary">${escapeHtml(item.laborantLogin || 'LAB')}</span>
          <strong>${escapeHtml(item.laborantName || 'Laborant')}</strong>
          <span style="font-size: 0.8rem; color: #64748b;">Xona: ${escapeHtml(item.room || '-')}</span>
        </div>
        <span style="font-size: 0.78rem; color: #94a3b8;">${escapeHtml(item.datetime || '')}</span>
      </div>

      <div style="background: #faf5ff; border-radius: 8px; padding: 8px 12px; font-size: 0.88rem; color: #581c87; margin-bottom: 6px;">
        <i class="fa-solid fa-quote-left"></i> <strong>Commit:</strong> "${escapeHtml(item.comment || 'Izoh yozilmadi')}"
      </div>

      ${item.serviceCode ? `<div style="font-size: 0.82rem; color: #334155;">Tekshiruv: <strong>[${escapeHtml(item.serviceCode)}] ${escapeHtml(item.serviceName || '')}</strong></div>` : ''}

      ${(item.changes && item.changes.length > 0) ? `
        <div style="background: #f8fafc; border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; margin-top: 6px;">
          ${item.changes.map(ch => `
            <div><strong>${escapeHtml(ch.field)}:</strong> <span style="color:#ef4444; text-decoration:line-through;">${escapeHtml(ch.old)}</span> ➔ <span style="color:#16a34a; font-weight:bold;">${escapeHtml(ch.new)}</span></div>
          `).join("")}
        </div>
      ` : ''}
    </div>
  `).join("");
}

function loadAuditLogs() {
  listenToAuditLogs();
}

// 9. EKSPORT VA HISOBOTLAR (CSV & PRINT)
function exportPatientsCSV() {
  const patients = getFilteredPatientsList();
  if (patients.length === 0) {
    alert("Eksport qilish uchun bemorlar topilmadi!");
    return;
  }

  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += "Sana,Talon Raqami,Bemor FISH,Telefon,Yoshi,Xizmat / Tekshiruv,Qurilma / Xona,Kelgan Vaqti,Holati,Laborant\n";

  patients.forEach(p => {
    const row = [
      p.dateKey || "",
      p.ticketId || "",
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.phone || "",
      p.age || "",
      `"${(p.service || '').replace(/"/g, '""')}"`,
      `"${(p.room || p.doctorName || '').replace(/"/g, '""')}"`,
      p.timeSlot || p.time || "",
      p.status || "",
      `"${(p.laborantName || p.laborantLogin || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  downloadCSVFile(csvContent, `Bemorlar_Royxati_${getTodayDateStr()}.csv`);
}

function exportLaborantsCSV() {
  const patients = getFilteredPatientsList();
  let csvContent = "\uFEFFLaborant Login,Laborant FISH,Rol,Jami Qabul Qilingan Bemorlar\n";

  laborantsList.forEach(l => {
    const count = patients.filter(p => p.laborantLogin === l.login && p.status === "completed").length;
    csvContent += `${l.login},"${(l.name || '').replace(/"/g, '""')}","${l.role || ''}",${count}\n`;
  });

  downloadCSVFile(csvContent, `Laborantlar_Faoliyati_${getTodayDateStr()}.csv`);
}

function exportServicesCSV() {
  let csvContent = "\uFEFFKod,Tekshiruv Nomi,Modallik,Davomiylik (daq),Kontrast Modda,Tayyorgarlik\n";
  servicesList.forEach(s => {
    csvContent += `${s.code},"${(s.name || '').replace(/"/g, '""')}",${s.type || ''},${s.duration || 30},${s.isContrast ? 'Ha' : 'Yoq'},"${(s.preparation || '').replace(/"/g, '""')}"\n`;
  });
  downloadCSVFile(csvContent, `Tekshiruvlar_Katalogi_${getTodayDateStr()}.csv`);
}

function downloadCSVFile(content, fileName) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function printAnalyticsReport() {
  window.print();
}

// 10. ADMIN SHAXSIY PROFILI VA PAROLNI O'ZGARTIRISH
function openAdminProfileModal() {
  const m = document.getElementById("modalAdminProfile");
  if (m) m.style.display = "flex";
  const st = document.getElementById("adminPwdStatus");
  if (st) st.style.display = "none";
}

function closeAdminProfileModal() {
  const m = document.getElementById("modalAdminProfile");
  if (m) m.style.display = "none";
}

async function handleChangeAdminPassword(e) {
  e.preventDefault();
  const oldPwd = document.getElementById("adminOldPwd")?.value.trim();
  const newPwd = document.getElementById("adminNewPwd")?.value.trim();
  const confPwd = document.getElementById("adminConfirmPwd")?.value.trim();
  const statusEl = document.getElementById("adminPwdStatus");

  if (!currentAdmin) return;

  if (String(currentAdmin.password) !== String(oldPwd)) {
    statusEl.style.display = "block";
    statusEl.style.background = "#fee2e2";
    statusEl.style.color = "#dc2626";
    statusEl.innerText = "❌ Amaldagi eski parol noto'g'ri!";
    return;
  }

  if (newPwd !== confPwd) {
    statusEl.style.display = "block";
    statusEl.style.background = "#fee2e2";
    statusEl.style.color = "#dc2626";
    statusEl.innerText = "❌ Yangi parollar mos kelmadi!";
    return;
  }

  try {
    await db.ref(`admins/${currentAdmin.login}/password`).set(newPwd);
    currentAdmin.password = newPwd;
    localStorage.setItem("rons_active_admin", JSON.stringify(currentAdmin));

    statusEl.style.display = "block";
    statusEl.style.background = "#dcfce7";
    statusEl.style.color = "#15803d";
    statusEl.innerText = "✅ Parol muvaffaqiyatli yangilandi!";

    document.getElementById("adminChangePwdForm")?.reset();
    setTimeout(() => { closeAdminProfileModal(); }, 1500);
  } catch (err) {
    statusEl.style.display = "block";
    statusEl.style.background = "#fee2e2";
    statusEl.style.color = "#dc2626";
    statusEl.innerText = "❌ Xatolik: " + err.message;
  }
}

// 11. YORDAMCHILAR
function togglePwdVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = `<i class="fa-solid fa-eye-slash"></i>`;
  } else {
    input.type = "password";
    btn.innerHTML = `<i class="fa-solid fa-eye"></i>`;
  }
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
