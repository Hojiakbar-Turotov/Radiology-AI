/**
 * Vrach - Laborant Xonasi (App2) - Asosiy JavaScript Mantiqi
 * Avtorizatsiya, Laborantlar ro'yxati, Parol o'zgartirish va Navbatni boshqarish
 */

let db = null;
let currentLaborant = null;
let currentDoctor = null;
let laborantsList = [];
let doctorsList = [];
let todayDateStr = "";
let myPatients = [];
let activePatient = null;

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
}

function setTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  todayDateStr = `${y}-${m}-${d}`;
}

function setupConnectionMonitor() {
  const connectedRef = db.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    const isOnline = snap.val() === true;
    const dot = document.getElementById("connDot");
    const txt = document.getElementById("connText");
    if (dot && txt) {
      dot.className = isOnline ? "status-dot connected" : "status-dot disconnected";
      txt.innerText = isOnline ? "Firebase: Ulangan" : "Ulanish uzildi";
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

    if (currentLaborant) {
      const fresh = laborantsList.find(l => l.login.toUpperCase() === currentLaborant.login.toUpperCase());
      if (fresh) currentLaborant = fresh;
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

  if (doctorsList.length === 0) {
    select.innerHTML = `<option value="">Qurilmalar topilmadi</option>`;
    return;
  }

  const currentVal = select.value;
  select.innerHTML = `<option value="">-- Ish xonasini tanlang --</option>` + doctorsList.map(d => `
    <option value="${escapeHtml(d.id)}">${escapeHtml(d.room || d.name)}: ${escapeHtml(d.name)} (${escapeHtml(d.specialty || '')})</option>
  `).join("");

  if (currentVal) select.value = currentVal;
}

// 3. SAQLANGAN SEANSIYANI TEKSHIRISH (AUTO-LOGIN)
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

// 4. LABORANT TIZIMGA KIRISHI (LOGIN VA PAROLNI TERISH ORQALI)
async function handleLaborantLogin(e) {
  e.preventDefault();
  const inputLogin = (document.getElementById("loginUsername")?.value || "").trim().toUpperCase();
  const inputPwd = (document.getElementById("loginPassword")?.value || "").trim();
  const docId = document.getElementById("doctorSelect").value;
  const errorMsg = document.getElementById("loginErrorMsg");

  if (!inputLogin) {
    alert("Iltimos, Loginni kiriting!");
    return;
  }

  if (!inputPwd) {
    alert("Iltimos, Parolni kiriting!");
    return;
  }

  if (!docId) {
    alert("Iltimos, ish xonasini (qurilmani) tanlang!");
    return;
  }

  const laborant = laborantsList.find(l => (l.login || "").toUpperCase() === inputLogin);
  const doc = doctorsList.find(d => d.id === docId);

  if (!doc) {
    alert("Tanlangan ish xonasi topilmadi!");
    return;
  }

  if (laborant && String(laborant.password) === String(inputPwd)) {
    if (errorMsg) errorMsg.style.display = "none";

    localStorage.setItem("utt_active_laborant", JSON.stringify(laborant));
    localStorage.setItem("utt_active_doctor_id", doc.id);

    setLaborantLoggedIn(laborant, doc);
  } else {
    if (errorMsg) {
      errorMsg.style.display = "block";
      errorMsg.innerText = "❌ Login yoki parol noto'g'ri! Qaytadan tekshirib kiriting.";
    }
  }
}

function setLaborantLoggedIn(laborant, doc) {
  currentLaborant = laborant;
  currentDoctor = doc;

  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("doctorWorkspace").style.display = "flex";

  document.getElementById("headerLaborantName").innerText = laborant.name;
  document.getElementById("headerLaborantBadge").innerText = laborant.login;
  document.getElementById("headerDocRoom").innerText = doc.room || doc.name;
  document.getElementById("headerDocSpecialty").innerText = `${doc.name} (${doc.specialty || 'Tomografiya'})`;

  listenToMyPatients();
}

function logoutLaborant() {
  if (confirm("Tizimdan chiqmoqchimisiz?")) {
    localStorage.removeItem("utt_active_laborant");
    localStorage.removeItem("utt_active_doctor_id");
    currentLaborant = null;
    currentDoctor = null;
    activePatient = null;

    document.getElementById("loginPassword").value = "";
    document.getElementById("doctorWorkspace").style.display = "none";
    document.getElementById("loginScreen").style.display = "flex";
  }
}

// 5. SHAXSIY PROFIL VA PAROL O'ZGARTIRISH MODALI
function openProfileModal() {
  if (!currentLaborant) return;

  document.getElementById("modalLaborantName").innerText = currentLaborant.name;
  document.getElementById("modalLaborantLogin").innerText = currentLaborant.login;
  document.getElementById("modalLaborantRole").innerText = currentLaborant.role || "Vrach / Laborant";

  document.getElementById("oldPassword").value = "";
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmNewPassword").value = "";

  const statusEl = document.getElementById("pwdChangeStatus");
  if (statusEl) statusEl.style.display = "none";

  document.getElementById("profileModal").style.display = "flex";
}

function closeProfileModal() {
  document.getElementById("profileModal").style.display = "none";
}

async function handleChangePassword(e) {
  e.preventDefault();
  if (!currentLaborant) return;

  const oldPwd = document.getElementById("oldPassword").value.trim();
  const newPwd = document.getElementById("newPassword").value.trim();
  const confirmPwd = document.getElementById("confirmNewPassword").value.trim();

  if (String(oldPwd) !== String(currentLaborant.password)) {
    showPasswordStatus("❌ Amaldagi (eski) parol noto'g'ri!", "error");
    return;
  }

  if (newPwd.length < 4) {
    showPasswordStatus("❌ Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak!", "error");
    return;
  }

  if (newPwd !== confirmPwd) {
    showPasswordStatus("❌ Yangi parollar bir-biriga mos kelmadi!", "error");
    return;
  }

  try {
    // Firebase-da parolni yangilash
    await db.ref(`laborants/${currentLaborant.login}/password`).set(newPwd);

    currentLaborant.password = newPwd;
    localStorage.setItem("utt_active_laborant", JSON.stringify(currentLaborant));

    showPasswordStatus("✅ Parol muvaffaqiyatli o'zgartirildi!", "success");

    setTimeout(() => {
      closeProfileModal();
    }, 1500);
  } catch (err) {
    showPasswordStatus("❌ Xatolik yuz berdi: " + err.message, "error");
  }
}

function showPasswordStatus(msg, type) {
  const el = document.getElementById("pwdChangeStatus");
  if (!el) return;
  el.style.display = "block";
  el.innerText = msg;
  if (type === "success") {
    el.style.background = "#dcfce7";
    el.style.color = "#166534";
    el.style.border = "1px solid #86efac";
  } else {
    el.style.background = "#fee2e2";
    el.style.color = "#991b1b";
    el.style.border = "1px solid #fca5a5";
  }
}

function togglePasswordVisibility(inputId, btn) {
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

// 6. SHU QURILMA/XONAGA TEGISHLI BEMORLARNI REAL-TIME TINGLASH
function listenToMyPatients() {
  if (!currentDoctor) return;

  db.ref(`patients/${todayDateStr}`).on("value", (snapshot) => {
    myPatients = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        const p = { id: key, ...data[key] };
        if (p.doctorId === currentDoctor.id) {
          myPatients.push(p);
        }
      });
    }

    // Saralash: kutayotganlar timestamp / vaqt bo'yicha birinchi
    myPatients.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    updateWorkspaceState();
  });
}

// 7. ISH STOLINI YANGILASH
function updateWorkspaceState() {
  const currentActive = myPatients.find(p => p.status === "calling" || p.status === "in_progress");
  const waitingPatients = myPatients.filter(p => p.status === "waiting");
  const completedPatients = myPatients.filter(p => p.status === "completed" || p.status === "cancelled");

  activePatient = currentActive || null;

  renderActivePatientCard(activePatient);
  renderWaitingQueue(waitingPatients);
  renderCompletedHistory(completedPatients);
}

function renderActivePatientCard(patient) {
  const emptyState = document.getElementById("emptyPatientState");
  const activeDetails = document.getElementById("activeDetails");
  const badge = document.getElementById("currentStatusBadge");
  const btnCallNext = document.getElementById("btnCallNext");
  const inCallButtons = document.getElementById("inCallButtons");
  const btnStartExam = document.getElementById("btnStartExam");

  if (!patient) {
    emptyState.style.display = "block";
    activeDetails.style.display = "none";
    badge.className = "badge badge-waiting";
    badge.innerText = "Qabul bo'sh";
    btnCallNext.style.display = "flex";
    inCallButtons.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  activeDetails.style.display = "flex";

  document.getElementById("activeTicketId").innerText = patient.ticketId || "U-000";
  document.getElementById("activePatientName").innerText = patient.name;
  document.getElementById("activePhone").innerText = patient.phone || "-";
  document.getElementById("activeAge").innerText = patient.age || "-";
  document.getElementById("activeService").innerText = patient.service || "Tomografiya Ko'rik";
  document.getElementById("activeTime").innerText = patient.time || "-";

  if (patient.notes) {
    document.getElementById("activeNotesBox").style.display = "block";
    document.getElementById("activeNotes").innerText = patient.notes;
  } else {
    document.getElementById("activeNotesBox").style.display = "none";
  }

  if (patient.status === "calling") {
    badge.className = "badge badge-calling";
    badge.innerText = "Chaqirilmoqda...";
    btnStartExam.style.display = "inline-flex";
  } else if (patient.status === "in_progress") {
    badge.className = "badge badge-in_progress";
    badge.innerText = "Qabul qilinmoqda";
    btnStartExam.style.display = "none";
  }

  btnCallNext.style.display = "none";
  inCallButtons.style.display = "grid";
}

function renderWaitingQueue(waitingList) {
  const container = document.getElementById("queueCardsContainer");
  const countBadge = document.getElementById("waitingCount");

  countBadge.innerText = `${waitingList.length} nafar`;

  if (waitingList.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;"><i class="fa-solid fa-check" style="font-size:2rem; margin-bottom:8px; display:block;"></i>Kutayotgan bemorlar yo'q</div>`;
    return;
  }

  container.innerHTML = waitingList.map((p) => `
    <div class="queue-item-card">
      <div class="queue-item-left">
        <span class="queue-ticket-num">${p.ticketId}</span>
        <div>
          <div class="queue-patient-title">${escapeHtml(p.name)}</div>
          <div class="queue-patient-sub">${escapeHtml(p.service || "Tomografiya")} • ${p.time || ''}</div>
        </div>
      </div>
      <button class="btn btn-primary btn-small" onclick="callSpecificPatient('${p.id}')">
        <i class="fa-solid fa-bell"></i> Chaqirish
      </button>
    </div>
  `).join("");
}

function renderCompletedHistory(completedList) {
  const countSpan = document.getElementById("completedCount");
  const listContainer = document.getElementById("completedList");

  countSpan.innerText = completedList.length;

  listContainer.innerHTML = completedList.map(p => `
    <div class="completed-row">
      <span><strong>${p.ticketId}</strong> - ${escapeHtml(p.name)}</span>
      <span class="badge ${p.status === 'completed' ? 'badge-completed' : 'badge-cancelled'}">
        ${p.status === 'completed' ? 'Yakunlandi' : 'Kelmadi'}
      </span>
    </div>
  `).join("");
}

// 8. NAVBATNI BOSHQARISH VA TV MONITORGA CHAQIRUV YUBORISH
function callNextPatient() {
  const waitingPatients = myPatients.filter(p => p.status === "waiting");
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

  db.ref(`patients/${todayDateStr}/${patient.id}`).update({
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
    room: currentDoctor.room || currentDoctor.name,
    doctorName: currentDoctor.name,
    laborantName: labName,
    laborantLogin: labLogin,
    specialty: currentDoctor.specialty || "Tomografiya",
    isContrast: patient.isContrast || false,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  db.ref("calling_announcement").set(announcement);
}

function startExamination() {
  if (!activePatient) return;
  db.ref(`patients/${todayDateStr}/${activePatient.id}`).update({
    status: "in_progress",
    startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
}

function finishExamination() {
  if (!activePatient) return;
  db.ref(`patients/${todayDateStr}/${activePatient.id}`).update({
    status: "completed",
    endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
}

function skipPatient() {
  if (!activePatient) return;
  if (confirm("Bemor kelmadi deb belgilansinmi?")) {
    db.ref(`patients/${todayDateStr}/${activePatient.id}`).update({
      status: "cancelled"
    });
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

function toggleCompletedList() {
  const list = document.getElementById("completedList");
  const chevron = document.getElementById("completedChevron");
  if (list.style.display === "none") {
    list.style.display = "flex";
    chevron.className = "fa-solid fa-chevron-up";
  } else {
    list.style.display = "none";
    chevron.className = "fa-solid fa-chevron-down";
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

