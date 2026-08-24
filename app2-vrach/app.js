/**
 * Vrach - Laborant Xonasi (App2) - Asosiy JavaScript Mantiqi
 * Avtorizatsiya, Laborantlar ro'yxati, Parol o'zgartirish, Navbatni boshqarish,
 * Xona Tekshiruvlari Boshqaruvi (Services CRUD), Audit Tarixi (Commits) va Test Chop Etish
 */

let db = null;
let currentLaborant = null;
let currentDoctor = null;
let laborantsList = [];
let doctorsList = [];
let todayDateStr = "";
let myPatients = [];
let activePatient = null;

// Tekshiruvlar va Audit Tarixi holatlari
let servicesList = [];
let currentServiceFilter = 'all';
let currentQueueSubFilter = 'all'; // 'all' (Navbat tartibi) or 'in_hall' (Hozir zalda)
let selectedServiceForTest = null;
let currentTestPreviewMode = 'ticket'; // 'ticket' or 'consent'
let currentTestLang = 'uz';
let mySchedule = null; // Laborant ish jadvali va band qilgan xonasi
let myCustomDurations = {}; // Laborantning shaxsiy tekshiruv vaqtlari { "R140": 25, ... }
let selectedVrachDate = ""; // Laborant ko'rayotgan sana (Bugun, Ertaga, Kecha va h.k.)
let currentPatientsRef = null;
let selectedRecheckPatient = null;

const DEFAULT_LABORANTS = [
  { login: "LAB1", name: "Yoqubov Dilmurod", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB2", name: "Isfandiyor Xaydaraliyev", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB3", name: "Shukrullayev Miraziz", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB4", name: "Hojiakbar Turatov", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB5", name: "Gulomov Miraziz", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB6", name: "Irisova Shariat", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB7", name: "Po'latov Akbar", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB8", name: "Abdurashidov Shoxruhbek", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB9", name: "Pazliyev Sardor", password: "15420", role: "Vrach / Laborant-Operator" },
  { login: "LAB10", name: "To'xtamishov Nodirbek", password: "15420", role: "Vrach / Laborant-Operator" }
];

document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupKeyboardShortcuts();
});

function initApp() {
  setTodayDate();
  db = initFirebase();

  const currentLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
  const l1 = document.getElementById("loginLangSelector");
  const l2 = document.getElementById("workspaceLangSelector");
  if (l1) l1.value = currentLang;
  if (l2) l2.value = currentLang;

  if (db) {
    setupConnectionMonitor();
    listenToLaborants();
    listenToDoctors();
    listenToServices();
    checkSavedSession();
  }
}

function changeLaborantLang(langCode) {
  if (typeof setI18nLanguage === 'function') {
    setI18nLanguage(langCode);
  }
  const l1 = document.getElementById("loginLangSelector");
  const l2 = document.getElementById("workspaceLangSelector");
  if (l1) l1.value = langCode;
  if (l2) l2.value = langCode;

  renderActivePatientCard();
  renderQueueList();
  renderLaborantServicesList();
  if (selectedServiceForTest) {
    const tpLang = document.getElementById("testPrintLang");
    if (tpLang) tpLang.value = langCode;
    renderTestPreview();
  }
}

function setTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  todayDateStr = `${y}-${m}-${d}`;
  if (!selectedVrachDate) selectedVrachDate = todayDateStr;

  const dateInput = document.getElementById("laborantDateSelector");
  if (dateInput) dateInput.value = selectedVrachDate;
}

function getDateStrWithOffset(offset) {
  const target = new Date();
  target.setDate(target.getDate() + offset);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function setupConnectionMonitor() {
  const connectedRef = db.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    const isOnline = snap.val() === true;
    const dot = document.getElementById("connDot");
    const txt = document.getElementById("connText");
    if (dot && txt) {
      dot.className = isOnline ? "status-dot connected" : "status-dot disconnected";
      txt.innerText = isOnline ? "Online" : "Offline";
    }
  });
}

// 1. LABORANTLAR RO'YXATINI REALTIME TINGLASH
function listenToLaborants() {
  db.ref("laborants").on("value", (snapshot) => {
    laborantsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        laborantsList.push({ login: key, ...data[key] });
      });
    } else {
      laborantsList = [...DEFAULT_LABORANTS];
    }
  });
}

// 2. QURILMALAR / XONALAR RO'YXATINI TINGLASH
function listenToDoctors() {
  db.ref("doctors").on("value", (snapshot) => {
    doctorsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        doctorsList.push({ id: key, ...data[key] });
      });
    }
    renderDoctorSelect();
  });
}

function renderDoctorSelect() {
  const select = document.getElementById("doctorSelect");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="">-- Ish xonasini tanlang --</option>` + doctorsList.map(d => `
    <option value="${escapeHtml(d.id)}">${escapeHtml(d.room || d.name)}: ${escapeHtml(d.name)} (${escapeHtml(d.specialty || '')})</option>
  `).join("");

  if (currentVal) select.value = currentVal;
}

// 3. TEKSHIRUVLAR KATALOGINI REALTIME TINGLASH
function listenToServices() {
  db.ref("services_catalog").on("value", (snapshot) => {
    servicesList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        servicesList.push({ id: key, ...data[key] });
      });
    }
    renderLaborantServicesList();
  });
}

// 4. SAQLANGAN SEANSIYANI TEKSHIRISH (AUTO-LOGIN)
function checkSavedSession() {
  try {
    const savedLaborantJson = localStorage.getItem("utt_active_laborant");
    const savedDocId = localStorage.getItem("utt_active_doctor_id");

    if (savedLaborantJson && savedDocId) {
      const savedLab = JSON.parse(savedLaborantJson);
      db.ref(`doctors/${savedDocId}`).once("value", (snap) => {
        const doc = snap.val();
        if (doc && savedLab) {
          setLaborantLoggedIn(savedLab, { id: savedDocId, ...doc });
        }
      });
    }
  } catch (e) {
    console.warn("checkSavedSession error:", e);
  }
}

// 5. LABORANT TIZIMGA KIRISHI
async function handleLaborantLogin(e) {
  e.preventDefault();
  const inputLogin = (document.getElementById("loginUsername")?.value || "").trim().toUpperCase();
  const inputPwd = (document.getElementById("loginPassword")?.value || "").trim();
  const selectedDocId = document.getElementById("doctorSelect")?.value;
  const errorEl = document.getElementById("loginErrorMsg");

  if (errorEl) errorEl.style.display = "none";

  if (!inputLogin || !inputPwd || !selectedDocId) {
    if (errorEl) {
      errorEl.innerText = "❌ Iltimos, barcha maydonlarni to'ldiring!";
      errorEl.style.display = "block";
    }
    return;
  }

  const selectedDoctor = doctorsList.find(d => d.id === selectedDocId);
  if (!selectedDoctor) return;

  const foundLab = laborantsList.find(l => l.login.toUpperCase() === inputLogin);

  if (foundLab && String(foundLab.password) === String(inputPwd)) {
    localStorage.setItem("utt_active_laborant", JSON.stringify(foundLab));
    localStorage.setItem("utt_active_doctor_id", selectedDocId);

    setLaborantLoggedIn(foundLab, selectedDoctor);
  } else {
    if (errorEl) {
      errorEl.innerText = "❌ Login yoki parol noto'g'ri!";
      errorEl.style.display = "block";
    }
  }
}

function setLaborantLoggedIn(laborant, doctor) {
  currentLaborant = laborant;
  currentDoctor = doctor;

  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("doctorWorkspace").style.display = "flex";

  const roomName = doctor.room || doctor.name || "Xona";
  const docSpecialty = doctor.specialty || doctor.name || "";

  document.getElementById("headerLaborantName").innerText = laborant.name;
  document.getElementById("headerLaborantBadge").innerText = laborant.login;
  document.getElementById("headerDocRoom").innerText = roomName;
  document.getElementById("headerDocSpecialty").innerText = `${docSpecialty}`;

  const modLabName = document.getElementById("modalLaborantName");
  const modLabLogin = document.getElementById("modalLaborantLogin");
  const modDocRoom = document.getElementById("modalDocRoomName");
  if (modLabName) modLabName.innerText = laborant.name;
  if (modLabLogin) modLabLogin.innerText = laborant.login;
  if (modDocRoom) modDocRoom.innerText = `${roomName} (${docSpecialty})`;

  listenToMyPatients();
  listenToDateSummaryCounts();
  listenToMyScheduleAndDurations();
  renderLaborantServicesList();
  updateDateNavigatorUI();
}

function listenToMyScheduleAndDurations() {
  if (!currentLaborant) return;
  db.ref(`laborants/${currentLaborant.login}/schedule`).on("value", (snap) => {
    mySchedule = snap.val();
  });
  db.ref(`laborants/${currentLaborant.login}/customDurations`).on("value", (snap) => {
    myCustomDurations = snap.val() || {};
    renderLaborantServicesList();
  });
}

function logoutLaborant() {
  if (confirm("Haqiqatan ham xonadan chiqmoqchimisiz?")) {
    localStorage.removeItem("utt_active_laborant");
    localStorage.removeItem("utt_active_doctor_id");
    currentLaborant = null;
    currentDoctor = null;
    activePatient = null;
    myPatients = [];

    document.getElementById("doctorWorkspace").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";

    const pwdInput = document.getElementById("loginPassword");
    if (pwdInput) pwdInput.value = "";
  }
}

// 5.5 SANA BO'YICHA NAVBATNI BOSHQARISH VA STATISTIKALARI
function setLaborantDateOffset(offset) {
  const target = new Date();
  target.setDate(target.getDate() + offset);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  setLaborantCustomDate(`${y}-${m}-${d}`);
}

function setLaborantCustomDate(dateStr) {
  if (!dateStr) dateStr = todayDateStr;
  selectedVrachDate = dateStr;
  const dateInput = document.getElementById("laborantDateSelector");
  if (dateInput) dateInput.value = selectedVrachDate;

  updateDateNavigatorUI();
  listenToMyPatients();
}

function updateDateNavigatorUI() {
  const yStr = getDateStrWithOffset(-1);
  const tStr = todayDateStr;
  const tmStr = getDateStrWithOffset(1);

  const btnY = document.getElementById("btnDateYesterday");
  const btnT = document.getElementById("btnDateToday");
  const btnTm = document.getElementById("btnDateTomorrow");
  const banner = document.getElementById("dateBannerNotification");
  const compLabel = document.getElementById("completedSectionDateLabel");

  if (btnY) btnY.classList.toggle("active", selectedVrachDate === yStr);
  if (btnT) btnT.classList.toggle("active", selectedVrachDate === tStr);
  if (btnTm) btnTm.classList.toggle("active", selectedVrachDate === tmStr);

  if (compLabel) {
    if (selectedVrachDate === tStr) compLabel.innerText = "Bugun";
    else if (selectedVrachDate === yStr) compLabel.innerText = "Kecha";
    else if (selectedVrachDate === tmStr) compLabel.innerText = "Ertaga";
    else compLabel.innerText = selectedVrachDate;
  }

  if (banner) {
    if (selectedVrachDate === tStr) {
      banner.style.display = "none";
    } else if (selectedVrachDate > tStr) {
      banner.style.display = "block";
      banner.style.background = "#eff6ff";
      banner.style.color = "#1d4ed8";
      banner.style.border = "1px solid #bfdbfe";
      banner.innerHTML = `<i class="fa-solid fa-calendar-plus"></i> Siz <strong>${selectedVrachDate} (Kelgusi kun)</strong> navbatini ko'rmoqdasiz. Bemorlarni bugun oldindan qabul qilishingiz mumkin.`;
    } else {
      banner.style.display = "block";
      banner.style.background = "#fef2f2";
      banner.style.color = "#b91c1c";
      banner.style.border = "1px solid #fecaca";
      banner.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> Siz <strong>${selectedVrachDate} (O'tgan kun)</strong> navbati va tarixini ko'rmoqdasiz. Bemorlarni qayta tekshiruvga (kontrol) yozishingiz mumkin.`;
    }
  }
}

function listenToDateSummaryCounts() {
  if (!currentDoctor) return;
  const yStr = getDateStrWithOffset(-1);
  const tStr = todayDateStr;
  const tmStr = getDateStrWithOffset(1);

  // Kecha
  db.ref(`patients/${yStr}`).on("value", snap => {
    let count = 0;
    const v = snap.val();
    if (v) Object.values(v).forEach(p => { if (p.doctorId === currentDoctor.id) count++; });
    const el = document.getElementById("countYesterdaySummary");
    if (el) el.innerText = count;
  });

  // Bugun
  db.ref(`patients/${tStr}`).on("value", snap => {
    let count = 0;
    const v = snap.val();
    if (v) Object.values(v).forEach(p => { if (p.doctorId === currentDoctor.id) count++; });
    const el = document.getElementById("countTodaySummary");
    if (el) el.innerText = count;
  });

  // Ertaga
  db.ref(`patients/${tmStr}`).on("value", snap => {
    let count = 0;
    const v = snap.val();
    if (v) Object.values(v).forEach(p => { if (p.doctorId === currentDoctor.id) count++; });
    const el = document.getElementById("countTomorrowSummary");
    if (el) el.innerText = count;
  });
}

// 6. XONA NAVBATINI REALTIME TINGLASH
function listenToMyPatients() {
  if (!currentDoctor) return;
  const queryDate = selectedVrachDate || todayDateStr;

  if (currentPatientsRef) {
    currentPatientsRef.off();
  }

  currentPatientsRef = db.ref(`patients/${queryDate}`);
  currentPatientsRef.on("value", (snapshot) => {
    myPatients = [];
    const data = snapshot.val();

    if (data) {
      Object.keys(data).forEach((key) => {
        const p = { id: key, dateKey: queryDate, ...data[key] };
        if (p.doctorId === currentDoctor.id) {
          myPatients.push(p);
        }
      });
    }

    myPatients.sort((a, b) => {
      // 1. Qayta tekshiruv (Navbatdan tashqari / 1-o'rin) bemorlar eng boshida turadi
      const aRecheck = !!(a.isOutOfQueue || a.isRecheck);
      const bRecheck = !!(b.isOutOfQueue || b.isRecheck);
      if (aRecheck && !bRecheck) return -1;
      if (!aRecheck && bRecheck) return 1;

      // 2. Qayta navbatga qo'yilgan (bekor qilinib zalda kutayotgan) bemorlar navbat oxirida turadi
      if (a.isRequeued && !b.isRequeued) return 1;
      if (!a.isRequeued && b.isRequeued) return -1;
      if (a.isRequeued && b.isRequeued) {
        return (a.requeuedAt || 0) - (b.requeuedAt || 0);
      }

      // 3. Standart vaqt bo'yicha saralash
      const tA = a.timeSlot || a.time || "";
      const tB = b.timeSlot || b.time || "";
      return tA.localeCompare(tB);
    });

    activePatient = myPatients.find(p => p.status === "calling" || p.status === "in_progress") || null;

    renderActivePatientCard();
    renderQueueList();
  });
}

function setQueueSubFilter(filter, btnEl) {
  currentQueueSubFilter = filter;
  document.querySelectorAll(".queue-filter-tabs .btn-q-filter").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderQueueList();
}

async function togglePatientPresence(patientId, event) {
  if (event) event.stopPropagation();
  const patient = myPatients.find(p => p.id === patientId);
  if (!patient) return;

  const currentPresence = patient.inHall !== false;
  const newPresence = !currentPresence;
  const pDate = patient.dateKey || selectedVrachDate || todayDateStr;

  try {
    await db.ref(`patients/${pDate}/${patient.id}`).update({
      inHall: newPresence,
      presenceUpdatedAt: firebase.database.ServerValue.TIMESTAMP
    });
  } catch (err) {
    console.error("Presence toggle error:", err);
  }
}

function toggleCompletedList() {
  const completedList = document.getElementById("completedList");
  const chevron = document.getElementById("completedChevron");
  if (!completedList) return;

  const isHidden = completedList.style.display === "none" || completedList.style.display === "";
  completedList.style.display = isHidden ? "block" : "none";
  if (chevron) {
    chevron.className = isHidden ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
  }
}

function renderActivePatientCard() {
  const emptyState = document.getElementById("emptyPatientState");
  const activeDetails = document.getElementById("activeDetails");
  const statusBadge = document.getElementById("currentStatusBadge");
  const btnCallNext = document.getElementById("btnCallNext");
  const inCallButtons = document.getElementById("inCallButtons");

  if (!activePatient) {
    if (emptyState) emptyState.style.display = "block";
    if (activeDetails) activeDetails.style.display = "none";
    if (statusBadge) {
      statusBadge.className = "badge badge-waiting";
      statusBadge.innerText = "Qabul bo'sh";
    }
    if (btnCallNext) btnCallNext.style.display = "flex";
    if (inCallButtons) inCallButtons.style.display = "none";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  if (activeDetails) activeDetails.style.display = "block";
  if (btnCallNext) btnCallNext.style.display = "none";
  if (inCallButtons) inCallButtons.style.display = "grid";

  const curLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
  const serviceTitle = formatServiceNameWithOriginal(activePatient.service || "Tekshiruv", curLang);

  document.getElementById("activeTicketId").innerText = activePatient.ticketId || "---";
  document.getElementById("activePatientName").innerText = activePatient.name || "Bemor";
  document.getElementById("activePhone").innerText = activePatient.phone || "-";
  document.getElementById("activeAge").innerText = activePatient.age ? `${activePatient.age} yosh` : "-";
  document.getElementById("activeService").innerText = serviceTitle;
  document.getElementById("activeTime").innerText = activePatient.timeSlot || activePatient.time || "-";

  const notesBox = document.getElementById("activeNotesBox");
  const notesText = document.getElementById("activeNotes");
  if (activePatient.notes || activePatient.rescheduleReason || activePatient.recheckReason) {
    const combinedNotes = [activePatient.notes, activePatient.recheckReason ? `Qayta tekshiruv: ${activePatient.recheckReason}` : null, activePatient.rescheduleReason ? `Sabab: ${activePatient.rescheduleReason}` : null].filter(Boolean).join(" | ");
    if (notesBox) notesBox.style.display = "block";
    if (notesText) notesText.innerText = combinedNotes;
  } else {
    if (notesBox) notesBox.style.display = "none";
  }

  const callingButtons = document.getElementById("callingStateButtons");
  const inProgressButtons = document.getElementById("inProgressStateButtons");

  if (activePatient.status === "calling") {
    statusBadge.className = "badge badge-calling";
    statusBadge.innerHTML = `<i class="fa-solid fa-bell"></i> Chaqirilmoqda...`;
    if (callingButtons) callingButtons.style.display = "contents";
    if (inProgressButtons) inProgressButtons.style.display = "none";
  } else if (activePatient.status === "in_progress") {
    statusBadge.className = "badge badge-in_progress";
    statusBadge.innerHTML = `<i class="fa-solid fa-circle-play"></i> Qabul qilinmoqda...`;
    if (callingButtons) callingButtons.style.display = "none";
    if (inProgressButtons) inProgressButtons.style.display = "flex";
  }
}

function renderQueueList() {
  const container = document.getElementById("queueCardsContainer");
  const countAllBadge = document.getElementById("countQueueAll");
  const countInHallBadge = document.getElementById("countQueueInHall");
  const mobileCountBadge = document.getElementById("mobileWaitingCount");
  const completedList = document.getElementById("completedList");
  const completedCount = document.getElementById("completedCount");

  // Faol qabuldagi bemor navbat ro'yxatida ko'rinmaydi
  const allWaiting = myPatients.filter(p => p.status === "waiting" && (!activePatient || p.id !== activePatient.id));
  const inHallWaiting = allWaiting.filter(p => p.inHall !== false);
  const completedPatients = myPatients.filter(p => p.status === "completed" || p.status === "cancelled");

  if (countAllBadge) countAllBadge.innerText = allWaiting.length;
  if (countInHallBadge) countInHallBadge.innerText = inHallWaiting.length;
  if (mobileCountBadge) mobileCountBadge.innerText = allWaiting.length;
  if (completedCount) completedCount.innerText = completedPatients.length;

  const targetList = (currentQueueSubFilter === 'in_hall') ? inHallWaiting : allWaiting;
  const isFutureDate = selectedVrachDate > todayDateStr;

  if (container) {
    if (targetList.length === 0) {
      container.innerHTML = `
        <div class="empty-queue-msg">
          <i class="fa-solid ${currentQueueSubFilter === 'in_hall' ? 'fa-couch' : 'fa-circle-check'}" style="font-size: 2rem; color: ${currentQueueSubFilter === 'in_hall' ? '#0284c7' : '#10b981'}; margin-bottom: 8px;"></i>
          <p>${currentQueueSubFilter === 'in_hall' ? 'Hozir kutish zalida o\'tirgan bemorlar yo\'q' : 'Kutayotgan bemorlar yo\'q'}</p>
        </div>
      `;
    } else {
      const curLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
      container.innerHTML = targetList.map((p, idx) => {
        const isInHall = p.inHall !== false;
        const isRecheck = !!(p.isOutOfQueue || p.isRecheck);

        return `
          <div class="queue-card ${idx === 0 ? 'next-in-line' : ''} ${p.isRequeued ? 'requeued-card' : ''} ${isRecheck ? 'out-of-queue-card' : ''}">
            <div class="queue-card-left">
              <div class="queue-ticket-badge" style="${isRecheck ? 'background:#7c3aed; color:#fff;' : ''}">${escapeHtml(p.ticketId || String(idx + 1))}</div>
              <div class="queue-info">
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <span class="queue-patient-title">${escapeHtml(p.name)}</span>
                  ${isRecheck ? `<span class="out-of-queue-badge"><i class="fa-solid fa-bolt"></i> Qayta tekshiruv (1-o'rin)</span>` : ''}
                  ${p.isRequeued ? `<span class="requeued-badge"><i class="fa-solid fa-rotate-right"></i> Qayta navbatda</span>` : ''}
                </div>
                <div class="queue-patient-sub">
                  ${escapeHtml(formatServiceNameWithOriginal(p.service || '', curLang))} • <strong>${escapeHtml(p.timeSlot || p.time || '')}</strong>
                </div>
                <div style="margin-top: 4px;">
                  <span class="presence-toggle-badge ${isInHall ? 'presence-in-hall' : 'presence-away'}" onclick="togglePatientPresence('${escapeHtml(p.id)}', event)" title="Zalda bor/yo'qligini belgilash uchun bosing">
                    <i class="fa-solid ${isInHall ? 'fa-couch' : 'fa-clock'}"></i>
                    ${isInHall ? 'Zalda o\'tiribdi' : 'Hali kelmadi'}
                  </span>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 6px; align-items: center;">
              ${isFutureDate ? `
                <button class="btn btn-early-call" onclick="callPatientEarly('${escapeHtml(p.id)}', '${selectedVrachDate}')" title="Ushbu kelgusi kungi bemorni bugun oldindan qabul qilish">
                  <i class="fa-solid fa-bolt"></i> Oldindan Qabul
                </button>
              ` : `
                <button class="btn btn-call-small" onclick="callSpecificPatient('${escapeHtml(p.id)}')">
                  <i class="fa-solid fa-bell"></i> Chaqirish
                </button>
              `}
            </div>
          </div>
        `;
      }).join("");
    }
  }

  if (completedList) {
    if (completedPatients.length === 0) {
      completedList.innerHTML = `<p style="font-size: 0.8rem; color: #94a3b8; text-align: center; padding: 10px;">Hozircha qabul tugaganlar yo'q</p>`;
    } else {
      completedList.innerHTML = completedPatients.map(p => `
        <div class="completed-row" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 0.85rem;">
          <div>
            <div><strong>${escapeHtml(p.ticketId || '-')}</strong> - ${escapeHtml(p.name)}</div>
            <div style="font-size: 0.78rem; color: #64748b;">${escapeHtml(p.service || '')}</div>
            ${p.cancelReason ? `<div style="font-size: 0.75rem; color: #dc2626; margin-top: 2px;"><i class="fa-solid fa-circle-exclamation"></i> Sabab: ${escapeHtml(p.cancelReason)}</div>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <span class="badge ${p.status === 'completed' ? 'badge-completed' : 'badge-danger'}" style="${p.status === 'cancelled' ? 'background: #fee2e2; color: #dc2626;' : ''}">
              ${p.status === 'completed' ? 'Yakunlandi' : 'Bekor qilindi'}
            </span>

            <button class="btn btn-sm btn-outline" onclick="openRecheckModal('${escapeHtml(p.id)}', '${selectedVrachDate}')" style="color: #7c3aed; border-color: #ddd6fe; background: #faf5ff; padding: 4px 8px; font-size: 0.78rem; font-weight: 700;" title="Ushbu bemorga qayta tekshiruv (kontrol) belgilash">
              <i class="fa-solid fa-rotate-right"></i> Qayta tekshiruv
            </button>

            ${p.status === 'cancelled' ? `
              <button class="btn btn-sm btn-outline" onclick="requeuePatient('${escapeHtml(p.id)}')" style="color: #0284c7; border-color: #bae6fd; background: #f0f9ff; padding: 4px 8px; font-size: 0.78rem;" title="Bugun qaytadan navbat oxiriga qo'yish">
                <i class="fa-solid fa-rotate-right"></i> Qayta navbatga
              </button>
            ` : ''}
          </div>
        </div>
      `).join("");
    }
  }
}

// 6.5 KELGUSI KUN BEMORLARINI OLDINDAN QABUL QILISH (ISTALGAN VAQTDA)
async function callPatientEarly(patientId, fromDate) {
  const patient = myPatients.find(p => p.id === patientId);
  if (!patient) return;

  if (!confirm(`"${patient.name}" (${fromDate} sanasiga yozilgan) bemorni HOZIROQ (${todayDateStr}) navbatdan oldin qabul qilasizmi?`)) {
    return;
  }

  const labLogin = currentLaborant ? currentLaborant.login : "";
  const labName = currentLaborant ? currentLaborant.name : "";

  // Bugungi sanaga ko'chirish / o'tkazish
  const targetKey = db.ref(`patients/${todayDateStr}`).push().key;
  const updatedPatient = {
    ...patient,
    id: targetKey,
    appointmentDate: todayDateStr,
    scheduledTime: "Oldindan qabul (" + fromDate + " dan)",
    timeSlot: "Oldindan qabul (" + fromDate + " dan)",
    isEarlyCalled: true,
    earlyCalledFromDate: fromDate,
    status: "calling",
    callTimestamp: firebase.database.ServerValue.TIMESTAMP,
    laborantLogin: labLogin,
    laborantName: labName,
    calledByLaborant: labName ? `[${labLogin}] ${labName}` : ""
  };

  try {
    await db.ref(`patients/${todayDateStr}/${targetKey}`).set(updatedPatient);
    // Kelgusi kungi holatini yangilash
    await db.ref(`patients/${fromDate}/${patientId}`).update({
      status: "completed",
      earlyTransferredToToday: true,
      transferredToDate: todayDateStr,
      transferredPatientKey: targetKey
    });

    broadcastToTV(updatedPatient);
    setLaborantCustomDate(todayDateStr);
    alert(`✅ "${patient.name}" bugungi qabulga olindi va ekranda chaqirildi!`);
  } catch (err) {
    alert("❌ Xatolik: " + err.message);
  }
}

// 6.6 OLDINGI KUNDAGI BEMORLARGA QAYTA TEKSHIRUV (KONTROL / NAVBATDAN TASHQARI) BELGILASH
function openRecheckModal(patientId, dateKey) {
  const patient = myPatients.find(p => p.id === patientId);
  if (!patient) return;

  selectedRecheckPatient = { ...patient, dateKey: dateKey || selectedVrachDate || todayDateStr };

  document.getElementById("recheckOriginalPatientId").value = patient.id;
  document.getElementById("recheckOriginalDate").value = selectedRecheckPatient.dateKey;
  document.getElementById("recheckPatientNameDisplay").innerText = patient.name || "Bemor";
  document.getElementById("recheckTicketIdDisplay").innerText = patient.ticketId || "-";
  document.getElementById("recheckServiceDisplay").innerText = patient.service || "Tekshiruv";

  document.getElementById("recheckTargetDate").value = todayDateStr;
  document.getElementById("recheckReasonSelect").value = "Kontrast modda dinamikasi / Kechki fazalar";
  document.getElementById("recheckReasonDetail").value = "";

  document.getElementById("modalRecheckPatient").style.display = "flex";
}

function closeRecheckModal() {
  document.getElementById("modalRecheckPatient").style.display = "none";
  selectedRecheckPatient = null;
}

function setRecheckTargetDateOffset(offset) {
  const target = new Date();
  target.setDate(target.getDate() + offset);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  document.getElementById("recheckTargetDate").value = `${y}-${m}-${d}`;
}

async function handleConfirmRecheck(e) {
  e.preventDefault();
  if (!selectedRecheckPatient || !currentDoctor) return;

  const targetDate = document.getElementById("recheckTargetDate")?.value || todayDateStr;
  const reasonSelect = document.getElementById("recheckReasonSelect")?.value;
  const reasonDetail = (document.getElementById("recheckReasonDetail")?.value || "").trim();
  const fullReason = reasonDetail ? `${reasonSelect} (${reasonDetail})` : reasonSelect;

  const newKey = db.ref(`patients/${targetDate}`).push().key;

  const recheckData = {
    ticketId: `${selectedRecheckPatient.ticketId || ''}-K`,
    name: selectedRecheckPatient.name,
    phone: selectedRecheckPatient.phone || "",
    age: selectedRecheckPatient.age || "",
    patientType: selectedRecheckPatient.patientType || "Ambulator",
    department: selectedRecheckPatient.department || "",
    referringDoctor: selectedRecheckPatient.referringDoctor || "",
    doctorId: currentDoctor.id,
    doctorName: currentDoctor.name,
    room: currentDoctor.room,
    service: selectedRecheckPatient.service,
    duration: selectedRecheckPatient.duration || 30,
    appointmentDate: targetDate,
    scheduledTime: "Navbatdan tashqari (1-o'rin)",
    timeSlot: "Navbatdan tashqari (1-o'rin)",
    isOutOfQueue: true,
    isRecheck: true,
    priority: 1,
    recheckFromDate: selectedRecheckPatient.dateKey,
    recheckReason: fullReason,
    recheckCreatedBy: currentLaborant ? `${currentLaborant.login} (${currentLaborant.name})` : "Laborant",
    recheckCreatedAt: firebase.database.ServerValue.TIMESTAMP,
    status: "waiting",
    inHall: true,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  try {
    await db.ref(`patients/${targetDate}/${newKey}`).set(recheckData);

    // Global audit logga yozish
    const logKey = db.ref("services_history_log").push().key;
    await db.ref(`services_history_log/${logKey}`).set({
      type: "patient_recheck",
      laborantLogin: currentLaborant ? currentLaborant.login : "LAB",
      laborantName: currentLaborant ? currentLaborant.name : "Laborant",
      room: currentDoctor ? (currentDoctor.room || currentDoctor.name) : "Xona",
      comment: `Qayta tekshiruv (kontrol) biriktirildi: ${selectedRecheckPatient.name} (${targetDate} kunga 1-o'rinda). Sabab: ${fullReason}`,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      datetime: new Date().toLocaleString()
    });

    closeRecheckModal();
    alert(`✅ "${selectedRecheckPatient.name}" ${targetDate} kunga 1-o'rinda (Navbatdan tashqari / Vaqtsiz) qayta tekshiruvga muvaffaqiyatli ro'yxatga olindi!`);

    if (selectedVrachDate !== targetDate && confirm(`Qayta tekshiruv yozilgan sana (${targetDate}) navbatiga o'tilsinmi?`)) {
      setLaborantCustomDate(targetDate);
    }
  } catch (err) {
    alert("❌ Xatolik: " + err.message);
  }
}

// 7. BEMORNI CHAQIRISH VA BOSHQARISH
function callNextPatient() {
  const waitingPatients = myPatients.filter(p => p.status === "waiting" && (!activePatient || p.id !== activePatient.id));
  if (waitingPatients.length === 0) {
    alert("Navbatda kutayotgan bemorlar yo'q!");
    return;
  }

  const nextPatient = waitingPatients[0];
  callPatient(nextPatient);
}

function callSpecificPatient(patientId) {
  const patient = myPatients.find(p => p.id === patientId);
  if (patient) {
    callPatient(patient);
  }
}

function callPatient(patient) {
  const labLogin = currentLaborant ? currentLaborant.login : "";
  const labName = currentLaborant ? currentLaborant.name : "";
  const pDate = patient.dateKey || selectedVrachDate || todayDateStr;

  db.ref(`patients/${pDate}/${patient.id}`).update({
    status: "calling",
    callTimestamp: firebase.database.ServerValue.TIMESTAMP,
    laborantLogin: labLogin,
    laborantName: labName,
    calledByLaborant: labName ? `[${labLogin}] ${labName}` : ""
  });

  broadcastToTV(patient);
}

function recallCurrentPatient() {
  if (!activePatient) return;
  broadcastToTV(activePatient);
}

function broadcastToTV(patient) {
  const labLogin = currentLaborant ? currentLaborant.login : "";
  const labName = currentLaborant ? currentLaborant.name : "";

  const announcement = {
    patientId: patient.id,
    ticketId: patient.ticketId,
    patientName: patient.name,
    room: currentDoctor ? (currentDoctor.room || currentDoctor.name) : "Xona",
    doctorName: currentDoctor ? currentDoctor.name : "",
    laborantName: labName,
    laborantLogin: labLogin,
    specialty: currentDoctor ? (currentDoctor.specialty || "Tomografiya") : "",
    isContrast: patient.isContrast || false,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  db.ref("calling_announcement").set(announcement);
}

async function startExamination() {
  if (!activePatient) return;
  const pDate = activePatient.dateKey || todayDateStr;
  const labLogin = currentLaborant ? currentLaborant.login : "";
  const labName = currentLaborant ? currentLaborant.name : "";

  try {
    await db.ref(`patients/${pDate}/${activePatient.id}`).update({
      status: "in_progress",
      startedAt: firebase.database.ServerValue.TIMESTAMP,
      laborantLogin: labLogin,
      laborantName: labName,
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  } catch (err) {
    alert("❌ Xatolik: " + err.message);
  }
}

async function finishExamination() {
  if (!activePatient) return;
  const pDate = activePatient.dateKey || todayDateStr;
  const labLogin = currentLaborant ? currentLaborant.login : "";
  const labName = currentLaborant ? currentLaborant.name : "";

  try {
    await db.ref(`patients/${pDate}/${activePatient.id}`).update({
      status: "completed",
      completedAt: firebase.database.ServerValue.TIMESTAMP,
      completedByLaborant: labName ? `[${labLogin}] ${labName}` : "Laborant",
      completedByLaborantLogin: labLogin,
      completedByLaborantName: labName,
      endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    // TV e'lonini tozalash
    db.ref("calling_announcement").once("value", (snap) => {
      const ann = snap.val();
      if (ann && ann.patientId === activePatient.id) {
        db.ref("calling_announcement").remove();
      }
    });

    activePatient = null;
  } catch (err) {
    alert("❌ Yakunlashda xatolik: " + err.message);
  }
}

// BEMOR TEKSHIRUVINI BEKOR QILISH (MODAL VA SABAB BILAN)
function openCancelExamModal() {
  if (!activePatient) return;
  const modal = document.getElementById("modalCancelPatientExam");
  if (!modal) return;

  const summaryBox = document.getElementById("cancelPatientSummary");
  if (summaryBox) {
    const curLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
    const sName = formatServiceNameWithOriginal(activePatient.service || '', curLang);
    const stText = activePatient.status === "in_progress" ? "Qabul jarayonida (Ko'rikda)" : "Chaqirilmoqda (Kutish zalida)";
    summaryBox.innerHTML = `
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px;">
        <div style="font-weight: 800; font-size: 1.1rem; color: #0f172a;">${escapeHtml(activePatient.name)}</div>
        <div style="font-size: 0.85rem; color: #64748b; margin-top: 2px;">
          Talon: <strong style="color:#0284c7;">${escapeHtml(activePatient.ticketId || '-')}</strong> | 
          Xizmat: <strong>${escapeHtml(sName)}</strong>
        </div>
        <div style="margin-top: 4px; font-size: 0.8rem; color: #dc2626; font-weight: 700;">
          <i class="fa-solid fa-clock"></i> Holati: ${stText}
        </div>
      </div>
    `;
  }

  // Formani tozalash
  const reasonSelect = document.getElementById("cancelReasonSelect");
  const detailText = document.getElementById("cancelReasonDetail");
  if (reasonSelect) reasonSelect.value = "";
  if (detailText) detailText.value = "";

  modal.style.display = "flex";
}

function closeCancelExamModal() {
  const modal = document.getElementById("modalCancelPatientExam");
  if (modal) modal.style.display = "none";
}

async function handleConfirmCancelExam(e) {
  e.preventDefault();
  if (!activePatient) return;

  const reasonSelect = document.getElementById("cancelReasonSelect")?.value;
  const reasonDetail = (document.getElementById("cancelReasonDetail")?.value || "").trim();

  if (!reasonSelect) {
    alert("Iltimos, tekshiruv bekor qilinishining asosiy sababini tanlang!");
    return;
  }

  const pDate = activePatient.dateKey || todayDateStr;
  const labLogin = currentLaborant ? currentLaborant.login : "";
  const labName = currentLaborant ? currentLaborant.name : "";
  const roomName = currentDoctor ? (currentDoctor.room || currentDoctor.name) : "";

  const cancelInfo = {
    status: "cancelled",
    cancelledAt: firebase.database.ServerValue.TIMESTAMP,
    cancelledDate: todayDateStr,
    cancelledTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cancelledByLaborant: labName ? `[${labLogin}] ${labName}` : "Laborant",
    cancelledByLaborantLogin: labLogin,
    cancelledByLaborantName: labName,
    cancelledStage: activePatient.status === "in_progress" ? "in_examination" : "calling",
    cancelReason: reasonSelect,
    cancelDetail: reasonDetail,
    notes: [activePatient.notes, `[BEKOR QILINDI (${reasonSelect})${reasonDetail ? ': ' + reasonDetail : ''}]`].filter(Boolean).join(" | ")
  };

  try {
    // 1. Bemor holatini Firebase'da yangilash
    await db.ref(`patients/${pDate}/${activePatient.id}`).update(cancelInfo);

    // 2. TV e'lonini tozalash (agar shu bemor chaqirilgan bo'lsa)
    db.ref("calling_announcement").once("value", (snap) => {
      const ann = snap.val();
      if (ann && ann.patientId === activePatient.id) {
        db.ref("calling_announcement").remove();
      }
    });

    // 3. Tarixga (Global Audit Log) yozish
    const logKey = db.ref("services_history_log").push().key;
    await db.ref(`services_history_log/${logKey}`).set({
      type: "patient_cancellation",
      patientId: activePatient.id,
      patientName: activePatient.name,
      ticketId: activePatient.ticketId,
      serviceName: activePatient.service || "",
      room: roomName,
      laborantLogin: labLogin,
      laborantName: labName,
      comment: `Bemor tekshiruvi bekor qilindi. Sabab: ${reasonSelect}${reasonDetail ? ' (' + reasonDetail + ')' : ''}`,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      datetime: new Date().toLocaleString()
    });

    closeCancelExamModal();
    activePatient = null;
    alert("✅ Bemor tekshiruvi bekor qilindi va sababi tizimga saqlandi!");
  } catch (err) {
    alert("❌ Xatolik yuz berdi: " + err.message);
  }
}

// BEMORNI MODALDAN NAVBAT OXIRIGA YO'NALTIRISH (Zalda kutib turadi, bugun qayta chaqiriladi)
async function handleConfirmRequeueFromModal() {
  if (!activePatient) return;

  const reasonSelect = document.getElementById("cancelReasonSelect")?.value || "Zalda kutib turadi";
  const reasonDetail = (document.getElementById("cancelReasonDetail")?.value || "").trim();

  const pDate = activePatient.dateKey || todayDateStr;
  const labLogin = currentLaborant ? currentLaborant.login : "";
  const labName = currentLaborant ? currentLaborant.name : "";
  const roomName = currentDoctor ? (currentDoctor.room || currentDoctor.name) : "";
  const requeuedCount = (activePatient.requeuedCount || 0) + 1;

  const updateInfo = {
    status: "waiting",
    inHall: true,
    isRequeued: true,
    requeuedAt: firebase.database.ServerValue.TIMESTAMP,
    requeuedCount: requeuedCount,
    requeuedByLaborant: labName ? `[${labLogin}] ${labName}` : "Laborant",
    requeueReason: reasonSelect,
    requeueDetail: reasonDetail,
    notes: [activePatient.notes, `[Navbat oxiriga qaytarildi (${reasonSelect})${reasonDetail ? ': ' + reasonDetail : ''}]`].filter(Boolean).join(" | ")
  };

  try {
    await db.ref(`patients/${pDate}/${activePatient.id}`).update(updateInfo);

    // TV e'lonini tozalash
    db.ref("calling_announcement").once("value", (snap) => {
      const ann = snap.val();
      if (ann && ann.patientId === activePatient.id) {
        db.ref("calling_announcement").remove();
      }
    });

    // Global Audit Logga yozish
    const logKey = db.ref("services_history_log").push().key;
    await db.ref(`services_history_log/${logKey}`).set({
      type: "patient_requeue",
      patientId: activePatient.id,
      patientName: activePatient.name,
      ticketId: activePatient.ticketId,
      serviceName: activePatient.service || "",
      room: roomName,
      laborantLogin: labLogin,
      laborantName: labName,
      comment: `Bemor (${activePatient.name}) navbat oxiriga yo'naltirildi. Sabab: ${reasonSelect}${reasonDetail ? ' (' + reasonDetail + ')' : ''}`,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      datetime: new Date().toLocaleString()
    });

    closeCancelExamModal();
    activePatient = null;
    alert("✅ Bemor navbat oxiriga muvaffaqiyatli yo'naltirildi va bugun qayta chaqiriladi!");
  } catch (err) {
    alert("❌ Xatolik yuz berdi: " + err.message);
  }
}

// BEMORNI BEKOR BO'LGANLAR RO'YXATIDAN QAYTADAN NAVBAT OXIRIGA QO'YISH
async function requeuePatient(patientId) {
  const patient = myPatients.find(p => p.id === patientId);
  if (!patient) return;

  const pDate = patient.dateKey || todayDateStr;
  const labLogin = currentLaborant ? currentLaborant.login : "";
  const labName = currentLaborant ? currentLaborant.name : "";
  const requeuedCount = (patient.requeuedCount || 0) + 1;

  try {
    await db.ref(`patients/${pDate}/${patient.id}`).update({
      status: "waiting",
      inHall: true,
      isRequeued: true,
      requeuedAt: firebase.database.ServerValue.TIMESTAMP,
      requeuedCount: requeuedCount,
      requeuedByLaborant: labName ? `[${labLogin}] ${labName}` : "Laborant",
      notes: [patient.notes, `[${requeuedCount}-marta navbat oxiriga qaytarildi]`].filter(Boolean).join(" | ")
    });

    // Global Audit Log
    const logKey = db.ref("services_history_log").push().key;
    await db.ref(`services_history_log/${logKey}`).set({
      type: "patient_requeue",
      patientId: patient.id,
      patientName: patient.name,
      ticketId: patient.ticketId,
      serviceName: patient.service || "",
      room: currentDoctor ? (currentDoctor.room || currentDoctor.name) : "",
      laborantLogin: labLogin,
      laborantName: labName,
      comment: `Bemor (${patient.name}) navbat oxiriga qaytadan qo'yildi (${requeuedCount}-marta)`,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      datetime: new Date().toLocaleString()
    });

    alert(`✅ ${patient.name} muvaffaqiyatli navbat oxiriga yo'naltirildi!`);
  } catch (err) {
    alert("❌ Qayta navbatga qo'yishda xatolik: " + err.message);
  }
}

// 8. TEKSHIRUVLARNI BOSHQARISH (SERVICES MANAGEMENT CRUD & COMMITS)
function openServicesManagementModal() {
  const modal = document.getElementById("servicesModal");
  if (modal) modal.style.display = "flex";

  const badge = document.getElementById("svcRoomBadge");
  if (badge && currentDoctor) {
    badge.innerText = `${currentDoctor.room || currentDoctor.name} (${currentDoctor.specialty || ''})`;
  }

  renderLaborantServicesList();
}

function closeServicesModal() {
  const modal = document.getElementById("servicesModal");
  if (modal) modal.style.display = "none";
}

function setServiceFilter(filter, el) {
  currentServiceFilter = filter;
  document.querySelectorAll(".services-filter-toolbar .filter-pill").forEach(p => p.classList.remove("active"));
  if (el) el.classList.add("active");
  renderLaborantServicesList();
}

function renderLaborantServicesList() {
  const container = document.getElementById("laborantServicesContainer");
  if (!container) return;

  const searchQuery = (document.getElementById("svcSearchInput")?.value || "").toLowerCase().trim();
  const curLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';

  let filtered = [...servicesList];

  // 1. Modallik va Xona filtrlari
  if (currentServiceFilter === "my_room" && currentDoctor) {
    const docSpec = (currentDoctor.specialty || currentDoctor.name || "").toUpperCase();
    if (docSpec.includes("MRT")) {
      filtered = filtered.filter(s => (s.type || "").toUpperCase() === "MRT");
    } else if (docSpec.includes("MSKT") || docSpec.includes("KT") || docSpec.includes("CT")) {
      filtered = filtered.filter(s => (s.type || "").toUpperCase() === "MSKT");
    }
  } else if (currentServiceFilter === "MRT") {
    filtered = filtered.filter(s => (s.type || "").toUpperCase() === "MRT");
  } else if (currentServiceFilter === "MSKT") {
    filtered = filtered.filter(s => (s.type || "").toUpperCase() === "MSKT");
  } else if (currentServiceFilter === "contrast") {
    filtered = filtered.filter(s => s.isContrast === true);
  }

  // 2. Qidiruv
  if (searchQuery) {
    filtered = filtered.filter(s => {
      const code = (s.code || "").toLowerCase();
      const name = (s.name || "").toLowerCase();
      const prep = (s.preparation || "").toLowerCase();
      return code.includes(searchQuery) || name.includes(searchQuery) || prep.includes(searchQuery);
    });
  }

  // Saralash: kod bo'yicha
  filtered.sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="padding: 40px 20px; text-align: center; color: #64748b;">
        <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 12px;"></i>
        <h4 style="color: #334155;">Tekshiruvlar topilmadi</h4>
        <p style="font-size: 0.9rem;">Qidiruv parametrini o'zgartiring yoki yangi tekshiruv qo'shing</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const isMrt = (s.type || "").toUpperCase() === "MRT";
    const duration = s.duration || 30;
    const myPersonalDur = myCustomDurations[s.code];
    const questionsCount = s.questions ? String(s.questions).split(/\r?\n/).filter(l => l.trim()).length : 0;
    const structured = parseStructuredPreparation(s.preparation, s);

    return `
      <div class="service-mgmt-card">
        <div class="svc-card-header">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="svc-code-badge">${escapeHtml(s.code || 'KOD')}</span>
            <span class="badge ${isMrt ? 'badge-mrt' : 'badge-mskt'}">${isMrt ? '🧲 MRT' : '⚡ MSKT'}</span>
            ${s.isContrast ? `<span class="badge badge-contrast">💉 Kontrastli</span>` : `<span class="badge badge-plain">Oddiy</span>`}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <div class="svc-duration-tag" style="${myPersonalDur ? 'background: #ede9fe; color: #7c3aed; border: 1.5px solid #c4b5fd;' : ''}">
              <i class="fa-solid fa-clock"></i> <strong>${myPersonalDur || duration}</strong> daq ${myPersonalDur ? '<span style="font-size: 0.72rem; font-weight: 700; color: #7c3aed;">(Mening vaqtim)</span>' : ''}
            </div>
          </div>
        </div>

        <h4 class="svc-card-title">${escapeHtml(s.name || 'Tekshiruv')}</h4>

        <div class="svc-card-body">
          <div class="svc-detail-row">
            <span class="svc-lbl">Tayyorgarlik:</span>
            <span class="svc-val">${escapeHtml(s.preparation || 'Maxsus tayyorgarlik talab etilmaydi')}</span>
          </div>
          ${s.contraindications ? `
            <div class="svc-detail-row">
              <span class="svc-lbl">Qarshi ko'rsatma:</span>
              <span class="svc-val" style="color: #b91c1c;">${escapeHtml(s.contraindications)}</span>
            </div>
          ` : ''}
          <div class="svc-detail-row">
            <span class="svc-lbl">Savolnoma:</span>
            <span class="svc-val">${questionsCount > 0 ? `<strong>${questionsCount} ta</strong> maxsus savol kiritilgan` : 'Standart savolnoma'}</span>
          </div>
        </div>

        <div class="svc-card-actions">
          <button type="button" class="btn-card-action btn-edit-act" onclick="openEditServiceModal('${escapeHtml(s.id)}')">
            <i class="fa-solid fa-pen-to-square"></i> Tahrirlash
          </button>
          <button type="button" class="btn-card-action btn-history-act" onclick="openServiceHistoryModal('${escapeHtml(s.id)}')">
            <i class="fa-solid fa-clock-rotate-left"></i> Tarix
          </button>
          <button type="button" class="btn-card-action btn-test-act" onclick="openTestPrintModal('${escapeHtml(s.id)}')">
            <i class="fa-solid fa-print"></i> Test Chop Etish
          </button>
          <button type="button" class="btn-card-action btn-delete-act" onclick="deleteService('${escapeHtml(s.id)}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

// 9. TEKSHIRUV QO'SHISH / TAHRIRLASH MODALI
function openAddServiceModal() {
  document.getElementById("serviceEditModalTitle").innerHTML = `<i class="fa-solid fa-plus" style="color: #10b981;"></i> Yangi Tekshiruv Qo'shish`;
  document.getElementById("editServiceId").value = "";
  document.getElementById("editIsNew").value = "1";

  document.getElementById("editServiceCode").value = "";
  document.getElementById("editServiceName").value = "";
  document.getElementById("editServiceType").value = (currentDoctor && (currentDoctor.specialty || "").includes("MRT")) ? "MRT" : "MSKT";
  document.getElementById("editServiceDuration").value = "30";
  document.getElementById("editMyPersonalDuration").value = "";
  document.getElementById("editServiceIsContrast").checked = false;

  document.getElementById("editFastingHours").value = "6-8";
  document.getElementById("editNeedsBloodTest").checked = false;
  document.getElementById("editNeedsMetformin").checked = false;
  document.getElementById("editNeedsMetalFree").checked = false;
  document.getElementById("editNeedsHydration").checked = false;
  document.getElementById("editSpecialPrep").value = "";
  document.getElementById("editContraindications").value = "";
  document.getElementById("editQuestions").value = "";
  document.getElementById("editCommitComment").value = "Yangi tekshiruv qo'shildi";

  handleModalityChange();
  document.getElementById("serviceEditModal").style.display = "flex";
}

function openEditServiceModal(serviceId) {
  const service = servicesList.find(s => s.id === serviceId);
  if (!service) return;

  document.getElementById("serviceEditModalTitle").innerHTML = `<i class="fa-solid fa-pen-to-square" style="color: #0284c7;"></i> [${escapeHtml(service.code || '')}] Tekshiruvni Tahrirlash`;
  document.getElementById("editServiceId").value = service.id;
  document.getElementById("editIsNew").value = "0";

  document.getElementById("editServiceCode").value = service.code || "";
  document.getElementById("editServiceName").value = service.name || "";
  document.getElementById("editServiceType").value = service.type || "MSKT";
  document.getElementById("editServiceDuration").value = service.duration || 30;
  document.getElementById("editMyPersonalDuration").value = (myCustomDurations && myCustomDurations[service.code]) ? myCustomDurations[service.code] : "";
  document.getElementById("editServiceIsContrast").checked = !!service.isContrast;

  const structured = parseStructuredPreparation(service.preparation, service);
  document.getElementById("editFastingHours").value = structured.fastingHours || "none";
  document.getElementById("editNeedsBloodTest").checked = !!structured.needsBloodTest;
  document.getElementById("editNeedsMetformin").checked = !!structured.needsMetformin;
  document.getElementById("editNeedsMetalFree").checked = !!structured.needsMetalFree;
  document.getElementById("editNeedsHydration").checked = !!structured.needsHydration;
  document.getElementById("editSpecialPrep").value = structured.specialPrep || "";

  document.getElementById("editContraindications").value = service.contraindications || "";
  document.getElementById("editQuestions").value = service.questions || "";
  document.getElementById("editCommitComment").value = "";

  handleModalityChange();
  document.getElementById("serviceEditModal").style.display = "flex";
}

function closeServiceEditModal() {
  document.getElementById("serviceEditModal").style.display = "none";
}

function handleModalityChange() {
  const type = document.getElementById("editServiceType")?.value;
  const isMrt = type === "MRT";
  const metalFreeBox = document.getElementById("editNeedsMetalFree");
  if (metalFreeBox && isMrt && !metalFreeBox.checked) {
    metalFreeBox.checked = true;
  }
}

function handleContrastToggle() {
  const isContrast = document.getElementById("editServiceIsContrast")?.checked;
  const bloodBox = document.getElementById("editNeedsBloodTest");
  const metforminBox = document.getElementById("editNeedsMetformin");
  const hydrationBox = document.getElementById("editNeedsHydration");

  if (isContrast) {
    if (bloodBox) bloodBox.checked = true;
    if (metforminBox) metforminBox.checked = true;
    if (hydrationBox) hydrationBox.checked = true;
  }
}

// Helper: Tayyorgarlik strukturasini ajratish
function parseStructuredPreparation(prepText, serviceObj = {}) {
  const p = prepText || "";
  let fastingHours = serviceObj.fastingHours || "none";
  if (!serviceObj.fastingHours) {
    if (p.includes("8-10")) fastingHours = "8-10";
    else if (p.includes("6-8")) fastingHours = "6-8";
    else if (p.includes("4-6")) fastingHours = "4-6";
    else if (p.toLowerCase().includes("och qorin") || p.toLowerCase().includes("och holda")) fastingHours = "6-8";
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

// Formani saqlash va Audit Log commitini yozish
async function handleSaveServiceForm(e) {
  e.preventDefault();

  const isNew = document.getElementById("editIsNew")?.value === "1";
  const serviceId = (document.getElementById("editServiceId")?.value || "").trim();
  const code = (document.getElementById("editServiceCode")?.value || "").trim().toUpperCase();
  const name = (document.getElementById("editServiceName")?.value || "").trim();
  const type = document.getElementById("editServiceType")?.value || "MSKT";
  const duration = parseInt(document.getElementById("editServiceDuration")?.value, 10) || 30;
  const isContrast = document.getElementById("editServiceIsContrast")?.checked || false;

  const fastingHours = document.getElementById("editFastingHours")?.value || "none";
  const needsBloodTest = document.getElementById("editNeedsBloodTest")?.checked || false;
  const needsMetformin = document.getElementById("editNeedsMetformin")?.checked || false;
  const needsMetalFree = document.getElementById("editNeedsMetalFree")?.checked || false;
  const needsHydration = document.getElementById("editNeedsHydration")?.checked || false;
  const specialPrep = (document.getElementById("editSpecialPrep")?.value || "").trim();

  const contraindications = (document.getElementById("editContraindications")?.value || "").trim();
  const questions = (document.getElementById("editQuestions")?.value || "").trim();
  const commitComment = (document.getElementById("editCommitComment")?.value || "").trim();

  if (!code || !name) {
    alert("Iltimos, kod va nomni kiriting!");
    return;
  }
  if (!commitComment) {
    alert("Iltimos, o'zgarish sababi (commit izohi)ni kiriting!");
    return;
  }

  const preparation = buildStructuredPreparationString(fastingHours, needsBloodTest, needsMetformin, needsMetalFree, needsHydration, specialPrep);

  const targetKey = isNew ? (code.replace(/[^a-zA-Z0-9]/g, "_") || db.ref("services_catalog").push().key) : serviceId;

  const updatedServiceData = {
    code,
    name,
    fullName: `${code} - ${name}`,
    type,
    duration,
    isContrast,
    fastingHours,
    needsBloodTest,
    needsMetformin,
    needsMetalFree,
    needsHydration,
    specialPreparation: specialPrep,
    preparation,
    contraindications,
    questions,
    lastModified: firebase.database.ServerValue.TIMESTAMP,
    lastModifiedBy: currentLaborant ? `${currentLaborant.login} (${currentLaborant.name})` : "Laborant"
  };

  // Diff hisoblash
  const changes = [];
  const oldObj = servicesList.find(s => s.id === targetKey);
  if (oldObj) {
    if (oldObj.duration !== duration) changes.push({ field: "Vaqt", old: `${oldObj.duration || 30} daqiqa`, new: `${duration} daqiqa` });
    if (oldObj.isContrast !== isContrast) changes.push({ field: "Kontrast", old: oldObj.isContrast ? "Ha" : "Yo'q", new: isContrast ? "Ha" : "Yo'q" });
    if (oldObj.preparation !== preparation) changes.push({ field: "Tayyorgarlik", old: oldObj.preparation || "Bo'sh", new: preparation });
    if (oldObj.contraindications !== contraindications) changes.push({ field: "Qarshi ko'rsatma", old: oldObj.contraindications || "Bo'sh", new: contraindications });
    if (oldObj.questions !== questions) changes.push({ field: "Savolnoma", old: oldObj.questions || "Bo'sh", new: questions });
  } else {
    changes.push({ field: "Yangi tekshiruv", old: "-", new: `${code}: ${name}` });
  }

  const historyEntry = {
    timestamp: Date.now(),
    datetime: new Date().toLocaleString('uz-UZ'),
    laborantLogin: currentLaborant ? currentLaborant.login : "LAB",
    laborantName: currentLaborant ? currentLaborant.name : "Laborant",
    room: currentDoctor ? (currentDoctor.room || currentDoctor.name) : "Xona",
    action: isNew ? "create" : "update",
    serviceCode: code,
    serviceName: name,
    comment: commitComment,
    changes: changes
  };

  try {
    await db.ref(`services_catalog/${targetKey}`).set(updatedServiceData);

    // Agar laborant o'zi uchun shaxsiy vaqt belgilagan bo'lsa
    const personalDurVal = document.getElementById("editMyPersonalDuration")?.value;
    const personalDur = parseInt(personalDurVal, 10);
    if (currentLaborant && currentLaborant.login) {
      if (!isNaN(personalDur) && personalDur > 0) {
        await db.ref(`laborants/${currentLaborant.login}/customDurations/${code}`).set(personalDur);
        myCustomDurations[code] = personalDur;
        changes.push({ field: "Mening shaxsiy vaqtim", old: "-", new: `${personalDur} daqiqa` });
      } else if (personalDurVal === "") {
        await db.ref(`laborants/${currentLaborant.login}/customDurations/${code}`).remove();
        delete myCustomDurations[code];
      }
    }

    await db.ref(`services_history/${targetKey}`).push(historyEntry);
    await db.ref(`services_history_log`).push({ serviceId: targetKey, ...historyEntry });

    closeServiceEditModal();
    alert("✅ Tekshiruv va o'zgarishlar tarixi muvaffaqiyatli saqlandi!");
  } catch (err) {
    console.error("Save error:", err);
    alert("❌ Saqlashda xatolik yuz berdi: " + err.message);
  }
}

// 9.5 LABORANT ISH JADVALI VA XONANI BAND QILISH FUNKSIYALARI (KUNBAY VA OYLIK ANIQ SANALAR)
let tempDateOverrides = {};

function switchScheduleTab(tabName) {
  const tabWeeklyBtn = document.getElementById("tabBtnWeeklySchedule");
  const tabMonthlyBtn = document.getElementById("tabBtnMonthlyOverrides");
  const contentWeekly = document.getElementById("tabContentWeekly");
  const contentMonthly = document.getElementById("tabContentMonthly");

  if (tabName === 'weekly') {
    if (tabWeeklyBtn) { tabWeeklyBtn.style.background = "#0284c7"; tabWeeklyBtn.style.color = "#fff"; }
    if (tabMonthlyBtn) { tabMonthlyBtn.style.background = "#f1f5f9"; tabMonthlyBtn.style.color = "#475569"; }
    if (contentWeekly) contentWeekly.style.display = "block";
    if (contentMonthly) contentMonthly.style.display = "none";
  } else {
    if (tabMonthlyBtn) { tabMonthlyBtn.style.background = "#16a34a"; tabMonthlyBtn.style.color = "#fff"; }
    if (tabWeeklyBtn) { tabWeeklyBtn.style.background = "#f1f5f9"; tabWeeklyBtn.style.color = "#475569"; }
    if (contentWeekly) contentWeekly.style.display = "none";
    if (contentMonthly) contentMonthly.style.display = "block";
  }
}

function toggleDayInputs(dayNum) {
  const chk = document.getElementById(`schedDay${dayNum}`);
  const wrap = document.getElementById(`inputsDay${dayNum}`);
  const row = document.getElementById(`dayRow${dayNum}`);
  if (!chk || !wrap) return;

  const isChecked = chk.checked;
  const inputs = wrap.querySelectorAll("input");
  inputs.forEach(inp => {
    inp.disabled = !isChecked;
    inp.style.opacity = isChecked ? "1" : "0.45";
  });
  if (row) {
    row.style.background = isChecked ? "#f0f9ff" : "#f8fafc";
    row.style.borderColor = isChecked ? "#bae6fd" : "var(--border)";
  }
}

function copyMondayHoursToAllDays() {
  const startMon = document.getElementById("startDay1")?.value || "08:00";
  const endMon = document.getElementById("endDay1")?.value || "19:30";
  const breakStartMon = document.getElementById("breakStartDay1")?.value || "";
  const breakEndMon = document.getElementById("breakEndDay1")?.value || "";

  [2, 3, 4, 5, 6, 0].forEach(d => {
    const sEl = document.getElementById(`startDay${d}`);
    const eEl = document.getElementById(`endDay${d}`);
    const bsEl = document.getElementById(`breakStartDay${d}`);
    const beEl = document.getElementById(`breakEndDay${d}`);
    if (sEl) sEl.value = startMon;
    if (eEl) eEl.value = endMon;
    if (bsEl) bsEl.value = breakStartMon;
    if (beEl) beEl.value = breakEndMon;
  });

  alert("✅ Dushanba soatlari barcha kunlarga nusxalandi! Endi har bir kunni xohlagancha o'zgartirishingiz mumkin.");
}

function toggleOverrideTimeInputs() {
  const type = document.getElementById("newOverrideType")?.value;
  const wrap = document.getElementById("overrideHoursWrap");
  if (wrap) {
    wrap.style.display = (type === "work") ? "flex" : "none";
  }
}

function addNewDateOverride() {
  const dateInput = document.getElementById("newOverrideDate");
  const dateVal = dateInput?.value;
  if (!dateVal) {
    alert("Iltimos, sanani tanlang!");
    return;
  }

  const type = document.getElementById("newOverrideType")?.value || "work";
  const start = document.getElementById("newOverrideStart")?.value || "08:00";
  const end = document.getElementById("newOverrideEnd")?.value || "18:00";

  tempDateOverrides[dateVal] = {
    enabled: (type === "work"),
    start: (type === "work") ? start : "",
    end: (type === "work") ? end : "",
    type: type
  };

  renderDateOverridesList();
  if (dateInput) dateInput.value = "";
}

function removeDateOverride(dateStr) {
  delete tempDateOverrides[dateStr];
  renderDateOverridesList();
}

function renderDateOverridesList() {
  const container = document.getElementById("dateOverridesList");
  const badge = document.getElementById("countOverridesBadge");
  const keys = Object.keys(tempDateOverrides).sort();
  if (badge) badge.innerText = keys.length;
  if (!container) return;

  if (keys.length === 0) {
    container.innerHTML = `<span style="font-size: 11.5px; color: #94a3b8; font-style: italic;">Hozircha maxsus oylik sanalar belgilanmagan.</span>`;
    return;
  }

  container.innerHTML = keys.map(k => {
    const ov = tempDateOverrides[k];
    const isWork = ov.enabled !== false;
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; background: ${isWork ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${isWork ? '#bbf7d0' : '#fecaca'}; border-radius: 6px; padding: 5px 10px; font-size: 12px;">
        <div>
          <strong style="color: #0f172a;"><i class="fa-solid fa-calendar-day"></i> ${escapeHtml(k)}:</strong>
          ${isWork ? `
            <span style="color: #15803d; font-weight: bold; margin-left: 6px;">${escapeHtml(ov.start || '08:00')} - ${escapeHtml(ov.end || '18:00')}</span>
          ` : `
            <span style="color: #b91c1c; font-weight: bold; margin-left: 6px;">⛔ Dam olish kuni</span>
          `}
        </div>
        <button type="button" onclick="removeDateOverride('${escapeHtml(k)}')" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 13px; padding: 2px 6px;">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join("");
}

function openLaborantScheduleModal() {
  if (!currentLaborant) return;
  const modal = document.getElementById("modalLaborantSchedule");
  if (!modal) return;

  // Xonalar ro'yxatini to'ldirish
  const roomSel = document.getElementById("schedRoomSelect");
  if (roomSel) {
    roomSel.innerHTML = doctorsList.map(d => {
      const isSelected = (mySchedule && mySchedule.roomId === d.id) || (currentDoctor && currentDoctor.id === d.id);
      return `<option value="${escapeHtml(d.id)}" ${isSelected ? 'selected' : ''}>${escapeHtml(d.room || d.name)} - ${escapeHtml(d.specialty || '')}</option>`;
    }).join("");
  }

  // Kunbay soatlar (dailyHours)
  const days = (mySchedule && mySchedule.days) ? mySchedule.days : [1, 2, 3, 4, 5];
  const dHours = (mySchedule && mySchedule.dailyHours) ? mySchedule.dailyHours : {};

  [1, 2, 3, 4, 5, 6, 0].forEach(d => {
    const chk = document.getElementById(`schedDay${d}`);
    const sEl = document.getElementById(`startDay${d}`);
    const eEl = document.getElementById(`endDay${d}`);
    const bsEl = document.getElementById(`breakStartDay${d}`);
    const beEl = document.getElementById(`breakEndDay${d}`);

    const dh = dHours[d];
    const isChecked = dh ? (dh.enabled !== false) : days.includes(d);

    if (chk) chk.checked = isChecked;
    if (sEl) sEl.value = (dh && dh.start) || (mySchedule && mySchedule.startTime) || "08:00";
    if (eEl) eEl.value = (dh && dh.end) || (mySchedule && mySchedule.endTime) || "19:30";
    if (bsEl) bsEl.value = (dh && dh.breakStart) || (mySchedule && mySchedule.breakStart) || ((d <= 5) ? "13:00" : "");
    if (beEl) beEl.value = (dh && dh.breakEnd) || (mySchedule && mySchedule.breakEnd) || ((d <= 5) ? "14:00" : "");

    toggleDayInputs(d);
  });

  // Oylik maxsus sanalar (dateOverrides)
  tempDateOverrides = (mySchedule && mySchedule.dateOverrides) ? { ...mySchedule.dateOverrides } : {};
  renderDateOverridesList();

  // Reset to weekly tab
  switchScheduleTab('weekly');

  if (document.getElementById("schedCommitComment")) document.getElementById("schedCommitComment").value = "";
  modal.style.display = "flex";
}

function closeLaborantScheduleModal() {
  const modal = document.getElementById("modalLaborantSchedule");
  if (modal) modal.style.display = "none";
}

async function handleSaveLaborantSchedule(e) {
  e.preventDefault();
  if (!currentLaborant) return;

  const roomId = document.getElementById("schedRoomSelect")?.value;
  const selectedDoc = doctorsList.find(d => d.id === roomId);
  const roomName = selectedDoc ? (selectedDoc.room || selectedDoc.name) : "Xona";

  const days = [];
  const dailyHours = {};

  [1, 2, 3, 4, 5, 6, 0].forEach(d => {
    const chk = document.getElementById(`schedDay${d}`);
    const isChecked = chk ? chk.checked : false;
    if (isChecked) {
      days.push(d);
    }
    dailyHours[d] = {
      enabled: isChecked,
      start: document.getElementById(`startDay${d}`)?.value || "08:00",
      end: document.getElementById(`endDay${d}`)?.value || "19:30",
      breakStart: document.getElementById(`breakStartDay${d}`)?.value || "",
      breakEnd: document.getElementById(`breakEndDay${d}`)?.value || ""
    };
  });

  if (days.length === 0 && Object.keys(tempDateOverrides).length === 0) {
    alert("Iltimos, kamida bitta ish kunini yoki maxsus sanani belgilang!");
    return;
  }

  // Fallback soatlar (birinchi tanlangan kundan yoki standart)
  const firstActiveDay = days[0] !== undefined ? dailyHours[days[0]] : null;
  const startTime = firstActiveDay ? firstActiveDay.start : "08:00";
  const endTime = firstActiveDay ? firstActiveDay.end : "19:30";

  const commitComment = (document.getElementById("schedCommitComment")?.value || "").trim() || "Kunbay va oylik ish jadvali yangilandi";

  const scheduleData = {
    laborantLogin: currentLaborant.login,
    laborantName: currentLaborant.name,
    roomId: roomId,
    roomName: roomName,
    days: days,
    dailyHours: dailyHours,
    dateOverrides: tempDateOverrides,
    startTime: startTime,
    endTime: endTime,
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
    updatedDate: todayDateStr
  };

  try {
    // 1. Laborant ma'lumotlariga saqlash
    await db.ref(`laborants/${currentLaborant.login}/schedule`).set(scheduleData);
    mySchedule = scheduleData;

    // 2. Global Audit logga yozish
    const logKey = db.ref("services_history_log").push().key;
    await db.ref(`services_history_log/${logKey}`).set({
      type: "schedule_update",
      laborantLogin: currentLaborant.login,
      laborantName: currentLaborant.name,
      room: roomName,
      comment: `Kunbay ish jadvali va xona band qilindi: ${roomName}, faol kunlar: [${days.join(',')}], maxsus sanalar: ${Object.keys(tempDateOverrides).length} ta. Izoh: ${commitComment}`,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      datetime: new Date().toLocaleString()
    });

    closeLaborantScheduleModal();
    alert(`✅ Ish jadvalingiz saqlandi va ${roomName} siz uchun band qilindi!`);
  } catch (err) {
    alert("❌ Saqlashda xatolik: " + err.message);
  }
}

// 10. TEKSHIRUVNI O'CHIRISH
async function deleteService(serviceId) {
  const service = servicesList.find(s => s.id === serviceId);
  if (!service) return;

  const reason = prompt(`"${service.code} - ${service.name}" tekshiruvini o'chirish sababini yozing:`);
  if (reason === null) return; // bekor qilindi

  if (!reason.trim()) {
    alert("O'chirish sababini kiritish majburiy!");
    return;
  }

  const historyEntry = {
    timestamp: Date.now(),
    datetime: new Date().toLocaleString('uz-UZ'),
    laborantLogin: currentLaborant ? currentLaborant.login : "LAB",
    laborantName: currentLaborant ? currentLaborant.name : "Laborant",
    room: currentDoctor ? (currentDoctor.room || currentDoctor.name) : "Xona",
    action: "delete",
    serviceCode: service.code || "",
    serviceName: service.name || "",
    comment: reason.trim(),
    changes: [{ field: "O'chirildi", old: `${service.code} - ${service.name}`, new: "Arxivlandi/O'chirildi" }]
  };

  try {
    await db.ref(`services_history/${serviceId}`).push(historyEntry);
    await db.ref(`services_history_log`).push({ serviceId, ...historyEntry });
    await db.ref(`services_catalog/${serviceId}`).remove();
    alert("✅ Tekshiruv o'chirildi va tarixga qayd etildi!");
  } catch (e) {
    alert("❌ O'chirishda xatolik: " + e.message);
  }
}

// 11. O'ZGARISHLAR TARIXI (HISTORY / COMMITS MODAL)
function openServiceHistoryModal(serviceId) {
  const service = servicesList.find(s => s.id === serviceId);
  const modal = document.getElementById("serviceHistoryModal");
  if (!modal) return;

  const headerInfo = document.getElementById("historyServiceInfo");
  if (headerInfo && service) {
    headerInfo.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
        <div>
          <h4 style="margin: 0; font-size: 1.1rem; color: #0f172a;">${escapeHtml(service.code)}: ${escapeHtml(service.name)}</h4>
          <span style="font-size: 0.85rem; color: #64748b;">Qurilma: <strong>${escapeHtml(service.type)}</strong> | Davomiyligi: <strong>${service.duration || 30} daqiqa</strong></span>
        </div>
        <span class="badge ${service.isContrast ? 'badge-contrast' : 'badge-plain'}">
          ${service.isContrast ? '💉 Kontrastli' : 'Oddiy'}
        </span>
      </div>
    `;
  }

  const container = document.getElementById("historyTimelineContainer");
  if (container) {
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin"></i> Tarix yuklanmoqda...</div>`;
  }

  modal.style.display = "flex";

  db.ref(`services_history/${serviceId}`).once("value", (snap) => {
    const data = snap.val();
    if (!data) {
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 30px; color: #64748b;">
            <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; color: #cbd5e1; margin-bottom: 8px;"></i>
            <p>Ushbu tekshiruv bo'yicha hali o'zgarishlar tarixi mavjud emas</p>
          </div>
        `;
      }
      return;
    }

    const list = Object.values(data);
    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (container) {
      container.innerHTML = list.map(item => `
        <div class="history-item-card">
          <div class="history-item-top">
            <div class="history-author">
              <div class="author-avatar">${escapeHtml((item.laborantLogin || 'LAB').slice(0, 4))}</div>
              <div>
                <strong>${escapeHtml(item.laborantName || 'Laborant')} (${escapeHtml(item.laborantLogin || '')})</strong>
                <div style="font-size: 0.75rem; color: #64748b;">Xona: ${escapeHtml(item.room || 'Xona')}</div>
              </div>
            </div>
            <div class="history-date">${escapeHtml(item.datetime || '')}</div>
          </div>

          <div class="history-comment-bubble">
            <i class="fa-solid fa-quote-left" style="color: #8b5cf6; margin-right: 4px;"></i>
            <strong>Izoh:</strong> "${escapeHtml(item.comment || 'Sabab ko\'rsatilmadi')}"
          </div>

          ${(item.changes && item.changes.length > 0) ? `
            <div class="history-changes-box">
              <strong style="font-size: 0.8rem; color: #334155; display: block; margin-bottom: 4px;">O'zgartirilgan parametrlar:</strong>
              ${item.changes.map(ch => `
                <div class="history-change-row">
                  <span class="ch-field">${escapeHtml(ch.field)}:</span>
                  <span class="ch-old">${escapeHtml(ch.old)}</span>
                  <i class="fa-solid fa-arrow-right" style="font-size: 0.7rem; color: #94a3b8;"></i>
                  <span class="ch-new">${escapeHtml(ch.new)}</span>
                </div>
              `).join("")}
            </div>
          ` : ''}
        </div>
      `).join("");
    }
  });
}

function closeServiceHistoryModal() {
  const modal = document.getElementById("serviceHistoryModal");
  if (modal) modal.style.display = "none";
}

// 12. TEST CHOP ETISH VA KO'RISH (MULTI-LANGUAGE PREVIEW & DIRECT PRINT)
function openTestPrintModal(serviceId) {
  const service = servicesList.find(s => s.id === serviceId);
  if (!service) return;

  selectedServiceForTest = service;
  currentTestPreviewMode = 'ticket';

  const curLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
  const tpLang = document.getElementById("testPrintLang");
  if (tpLang) tpLang.value = curLang;

  const badge = document.getElementById("testModalServiceBadge");
  if (badge) badge.innerText = `${service.code} - ${service.name}`;

  document.getElementById("testPrintModal").style.display = "flex";
  renderTestPreview();
}

function closeTestPrintModal() {
  document.getElementById("testPrintModal").style.display = "none";
  selectedServiceForTest = null;
}

function switchTestPreviewMode(mode) {
  currentTestPreviewMode = mode;
  document.getElementById("btnPreviewTicket")?.classList.toggle("active", mode === 'ticket');
  document.getElementById("btnPreviewConsent")?.classList.toggle("active", mode === 'consent');
  renderTestPreview();
}

function renderTestPreview() {
  if (!selectedServiceForTest) return;

  const lang = document.getElementById("testPrintLang")?.value || "uz";
  const frame = document.getElementById("testPreviewFrame");
  if (!frame) return;

  if (currentTestPreviewMode === "ticket") {
    frame.innerHTML = generateTestTicketHtml(selectedServiceForTest, lang);
  } else {
    frame.innerHTML = generateTestConsentHtml(selectedServiceForTest, lang);
  }
}

function generateTestTicketHtml(service, lang = 'uz') {
  const L = lang || 'uz';
  const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.ticket && I18N_TRANSLATIONS.ticket[L]) 
    ? I18N_TRANSLATIONS.ticket[L] 
    : I18N_TRANSLATIONS.ticket['uz'];

  const rawRoom = currentDoctor ? (currentDoctor.room || currentDoctor.name) : "101-xona";
  const docName = currentDoctor ? currentDoctor.name : "MRT 1";
  const roomFormatted = formatRoomWithOriginal(rawRoom, docName, L);
  const serviceFormatted = formatServiceNameWithOriginal(service.name || service.fullName, L);
  const contrastBadgeHtml = service.isContrast ? `<span style="background:#000; color:#fff; padding:2px 6px; font-size:12px; font-weight:bold; border-radius:3px; margin-left:4px;">${dict.contrastBadge}</span>` : '';

  const mockPayload = {
    ticketId: "847",
    name: "Yoqubov Dilshod (TEST)",
    patientType: "Ambulator",
    service: service.name,
    doctorName: docName,
    room: rawRoom,
    isContrast: service.isContrast,
    preparation: service.preparation,
    contraindications: service.contraindications,
    servicesList: [service]
  };

  const guidelinesHtml = formatConsolidatedGuidelinesHtml(mockPayload, L);

  return `
    <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:16px; width:100%; max-width:380px; margin:0 auto; font-family:'Segoe UI', Tahoma, sans-serif; font-size:13px; line-height:1.4; color:#000; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
      <div style="text-align:center; border-bottom:2px dashed #000; padding-bottom:8px; margin-bottom:8px;">
        <h3 style="font-size:14px; font-weight:900; text-transform:uppercase; margin:0 0 4px 0;">${dict.centerName}</h3>
        <div style="font-size:12px; font-weight:700; color:#334155;">${dict.ticketTitle}</div>
      </div>

      <div style="text-align:center; margin:8px 0; background:#f1f5f9; border:2px solid #000; border-radius:8px; padding:6px;">
        <div style="font-size:11px; font-weight:700; color:#475569;">TALON RAQAMI:</div>
        <div style="font-size:28px; font-weight:900; letter-spacing:1px; color:#000;">847</div>
      </div>

      <div style="margin-bottom:8px; font-size:12.5px;">
        <div><strong>${dict.patient}</strong> Yoqubov Dilshod</div>
        <div><strong>${dict.patientType}</strong> ${dict.ambulatory}</div>
        <div><strong>${dict.roomDevice}</strong> ${roomFormatted}</div>
        <div><strong>${dict.service}</strong> ${serviceFormatted} ${contrastBadgeHtml}</div>
      </div>

      <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; margin:8px 0; text-align:center;">
        <div style="font-size:11px; font-weight:700;">${dict.bookedTime}</div>
        <div style="font-size:18px; font-weight:900; color:#000;">09:00 - 09:${String(service.duration || 30).padStart(2, '0')}</div>
        <div style="font-size:11.5px; margin-top:2px;">${dict.appointmentDate} ${todayDateStr}</div>
      </div>

      <div style="margin-bottom:8px;">
        ${guidelinesHtml}
      </div>

      <div style="text-align:center; font-size:11px; color:#334155; margin-top:8px; border-top:1px dashed #000; padding-top:6px;">
        <div>${dict.timeNotice}</div>
        <div style="font-weight:700; margin-top:3px;">${dict.footerThanks}</div>
      </div>
    </div>
  `;
}

function generateTestConsentHtml(service, lang = 'uz') {
  const L = lang || 'uz';
  const dict = (typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.consent && I18N_TRANSLATIONS.consent[L]) 
    ? I18N_TRANSLATIONS.consent[L] 
    : I18N_TRANSLATIONS.consent['uz'];

  const rawRoom = currentDoctor ? (currentDoctor.room || currentDoctor.name) : "101-xona";
  const docName = currentDoctor ? currentDoctor.name : "MRT 1";
  const roomFormatted = formatRoomWithOriginal(rawRoom, docName, L);
  const serviceFormatted = formatServiceNameWithOriginal(service.name || service.fullName, L);

  const rawQuestions = service.questions || (service.isContrast 
    ? "1. Yodli yoki boshqa kontrast dori vositalariga allergiyangiz bormi?\n2. Buyrak yetishmovchiligi yoki dializ olasizmi?\n3. Homiladorlik yoki emizish davridamisiz?"
    : "1. Yuragingizda kardiostimulyator yoki metall implant bormi?\n2. Klavstrofobiya (yopiq joydan qo'rqish) bormi?");

  const qLines = rawQuestions.split(/\r?\n/).filter(l => l.trim());
  const translatedQuestions = translateQuestionsList(qLines, L);

  return `
    <div style="background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:20px; width:100%; max-width:680px; margin:0 auto; font-family:'Segoe UI', Tahoma, sans-serif; font-size:11.5px; line-height:1.35; color:#000; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);">
      <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px;">
        <img src="${typeof LOGO_ONKOLOGIYA !== 'undefined' ? LOGO_ONKOLOGIYA : ''}" style="width:60px; height:auto; max-height:60px;" alt="Logo Onko">
        <div style="text-align:center; flex:1; padding:0 10px;">
          <h3 style="font-size:12px; font-weight:900; margin:0; text-transform:uppercase;">${dict.ministryTitle}</h3>
          <h2 style="font-size:13.5px; font-weight:900; margin:3px 0 0 0; text-transform:uppercase;">${service.isContrast ? dict.contrastDocTitle : dict.standardDocTitle}</h2>
        </div>
        <img src="${typeof LOGO_SSV !== 'undefined' ? LOGO_SSV : ''}" style="width:60px; height:auto; max-height:60px;" alt="Logo SSV">
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:11px; text-align:center;">
        <tr>
          <td style="border:1px solid #000; padding:3px;"><strong>${dict.codeNo}</strong><br>TOMO-2026</td>
          <td style="border:1px solid #000; padding:3px;"><strong>${dict.publishDate}</strong><br>01.01.2026</td>
          <td style="border:1px solid #000; padding:3px;"><strong>${dict.examNum}</strong><br>847</td>
          <td style="border:1px solid #000; padding:3px;"><strong>${dict.pageCount}</strong><br>1 / 1</td>
        </tr>
      </table>

      <div style="background:#f1f5f9; border:1px solid #000; padding:3px 6px; font-weight:900; font-size:11.5px; text-transform:uppercase; margin-bottom:4px;">
        ${dict.patientSectionTitle}
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:11.5px;">
        <tr>
          <td style="border:1px solid #000; padding:4px 6px; width:25%; font-weight:700; background:#f8fafc;">${dict.patientName}:</td>
          <td style="border:1px solid #000; padding:4px 6px; width:25%; font-weight:800;">Yoqubov Dilshod</td>
          <td style="border:1px solid #000; padding:4px 6px; width:25%; font-weight:700; background:#f8fafc;">${dict.birthYear}:</td>
          <td style="border:1px solid #000; padding:4px 6px; width:25%; font-weight:800;">1995 (29 yosh)</td>
        </tr>
        <tr>
          <td style="border:1px solid #000; padding:4px 6px; font-weight:700; background:#f8fafc;">${dict.serviceLabel}:</td>
          <td style="border:1px solid #000; padding:4px 6px; font-weight:800;">${serviceFormatted}</td>
          <td style="border:1px solid #000; padding:4px 6px; font-weight:700; background:#f8fafc;">${dict.roomDeviceLabel}:</td>
          <td style="border:1px solid #000; padding:4px 6px; font-weight:800;">${roomFormatted}</td>
        </tr>
      </table>

      <div style="background:#f1f5f9; border:1px solid #000; padding:3px 6px; font-weight:900; font-size:11.5px; text-transform:uppercase; margin-bottom:4px;">
        ${dict.questionsTitle}
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:11px;">
        <thead>
          <tr style="background:#f8fafc;">
            <th style="border:1px solid #000; padding:4px 6px; text-align:left;">${dict.thQuestion}</th>
            <th style="border:1px solid #000; padding:4px 6px; width:50px; text-align:center;">${dict.thYes}</th>
            <th style="border:1px solid #000; padding:4px 6px; width:50px; text-align:center;">${dict.thNo}</th>
          </tr>
        </thead>
        <tbody>
          ${translatedQuestions.map(q => `
            <tr>
              <td style="border:1px solid #000; padding:3.5px 6px;">${escapeHtml(q.text)}</td>
              <td style="border:1px solid #000; padding:3.5px 6px; text-align:center; font-weight:bold;">[  ]</td>
              <td style="border:1px solid #000; padding:3.5px 6px; text-align:center; font-weight:bold;">[  ]</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="border:1px solid #000; border-radius:3px; padding:6px; background:#fafafa; font-size:10.5px; line-height:1.35; margin-bottom:8px; text-align:justify;">
        ${dict.declarationText}
      </div>

      <table style="width:100%; border-collapse:collapse; font-size:11.5px; margin-top:8px;">
        <tr>
          <td style="width:50%; vertical-align:top; padding-right:10px;">
            <strong>${dict.patientSignature}:</strong><br>
            <span style="font-size:10.5px; color:#475569;">Yoqubov Dilshod</span><br><br>
            _________________________ (Imzo)
          </td>
          <td style="width:50%; vertical-align:top; padding-left:10px;">
            <strong>${dict.laborantSignature}:</strong><br>
            <span style="font-size:10.5px; color:#475569;">${currentLaborant ? `${currentLaborant.name} (${currentLaborant.login})` : 'Laborant'}</span><br><br>
            _________________________ (Imzo)
          </td>
        </tr>
      </table>
    </div>
  `;
}

function printCurrentTestDocument() {
  if (!selectedServiceForTest) return;
  const lang = document.getElementById("testPrintLang")?.value || "uz";

  let printContent = "";
  if (currentTestPreviewMode === "ticket") {
    printContent = generateTestTicketHtml(selectedServiceForTest, lang);
  } else {
    printContent = generateTestConsentHtml(selectedServiceForTest, lang);
  }

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    alert("Iltimos, brauzerda pop-up oynalarni ochishga ruxsat bering!");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Chop Etish - RONS Navbat Tizimi</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, sans-serif; margin: 0; padding: 10px; background: #fff; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }, 300);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

// 13. SHAXSIY PROFIL VA PAROLNI O'ZGARTIRISH
function openProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.style.display = "flex";
  const statusEl = document.getElementById("pwdChangeStatus");
  if (statusEl) statusEl.style.display = "none";
}

function closeProfileModal() {
  const modal = document.getElementById("profileModal");
  if (modal) modal.style.display = "none";
}

async function handleChangePassword(e) {
  e.preventDefault();
  const oldPwd = document.getElementById("oldPassword")?.value.trim();
  const newPwd = document.getElementById("newPassword")?.value.trim();
  const confirmPwd = document.getElementById("confirmNewPassword")?.value.trim();
  const statusEl = document.getElementById("pwdChangeStatus");

  if (!currentLaborant) return;

  if (String(currentLaborant.password) !== String(oldPwd)) {
    statusEl.style.display = "block";
    statusEl.style.background = "#fee2e2";
    statusEl.style.color = "#dc2626";
    statusEl.innerText = "❌ Amaldagi eski parol noto'g'ri!";
    return;
  }

  if (newPwd !== confirmPwd) {
    statusEl.style.display = "block";
    statusEl.style.background = "#fee2e2";
    statusEl.style.color = "#dc2626";
    statusEl.innerText = "❌ Yangi parollar bir-biriga mos kelmadi!";
    return;
  }

  try {
    await db.ref(`laborants/${currentLaborant.login}/password`).set(newPwd);
    currentLaborant.password = newPwd;
    localStorage.setItem("utt_active_laborant", JSON.stringify(currentLaborant));

    statusEl.style.display = "block";
    statusEl.style.background = "#dcfce7";
    statusEl.style.color = "#15803d";
    statusEl.innerText = "✅ Parol muvaffaqiyatli o'zgartirildi!";

    document.getElementById("changePasswordForm")?.reset();
    setTimeout(() => { closeProfileModal(); }, 1500);
  } catch (err) {
    statusEl.style.display = "block";
    statusEl.style.background = "#fee2e2";
    statusEl.style.color = "#dc2626";
    statusEl.innerText = "❌ Xatolik: " + err.message;
  }
}

// 14. MOBIL TABLAR BOSHQARUVI
function switchMobileTab(tab) {
  const activeSec = document.getElementById("activeSection");
  const queueSec = document.getElementById("queueSection");
  const compSec = document.getElementById("completedSection");

  document.querySelectorAll(".mobile-tab-bar .tab-item").forEach(t => t.classList.remove("active"));

  if (tab === "active") {
    document.getElementById("tabBtnActive")?.classList.add("active");
    if (activeSec) activeSec.style.display = "flex";
    if (queueSec) queueSec.style.display = "none";
  } else if (tab === "queue") {
    document.getElementById("tabBtnQueue")?.classList.add("active");
    if (activeSec) activeSec.style.display = "none";
    if (queueSec) queueSec.style.display = "flex";
    if (compSec) compSec.style.display = "none";
  } else if (tab === "history") {
    document.getElementById("tabBtnHistory")?.classList.add("active");
    if (activeSec) activeSec.style.display = "none";
    if (queueSec) queueSec.style.display = "flex";
    if (compSec) {
      compSec.style.display = "block";
      const list = document.getElementById("completedList");
      if (list) list.style.display = "flex";
    }
  }
}

// 15. TUGMALAR VA YORDAMCHILAR
function togglePasswordVisibility(inputId, btnEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === "password") {
    input.type = "text";
    if (btnEl) btnEl.innerHTML = `<i class="fa-solid fa-eye-slash"></i>`;
  } else {
    input.type = "password";
    if (btnEl) btnEl.innerHTML = `<i class="fa-solid fa-eye"></i>`;
  }
}

function setupKeyboardShortcuts() {
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") {
      return;
    }

    if (e.code === "Space" || e.code === "Enter") {
      if (!activePatient) {
        e.preventDefault();
        callNextPatient();
      }
    }
  });
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
