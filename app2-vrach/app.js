/**
 * Vrach Xonasi - Asosiy JavaScript Mantiqi
 */

let db = null;
let currentDoctor = null;
let doctorsList = [];
let todayDateStr = "";
let myPatients = [];
let activePatient = null;

document.addEventListener("DOMContentLoaded", () => {
  initApp();
  setupKeyboardShortcuts();
});

function initApp() {
  setTodayDate();
  db = initFirebase();

  if (db) {
    setupConnectionMonitor();
    listenToDoctors();
    checkSavedDoctor();
  }
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

// 1. VRACHLAR RO'YXATINI OLISH VA SELECTGA JOYLASHTIRISH
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
    select.innerHTML = `<option value="">Vrachlar topilmadi</option>`;
    return;
  }

  select.innerHTML = `<option value="">-- O'z xonangizni tanlang --</option>` + doctorsList.map(d => `
    <option value="${d.id}">${escapeHtml(d.room)}: ${escapeHtml(d.name)} (${escapeHtml(d.specialty || '')})</option>
  `).join("");
}

// 2. SAQLANGAN VRACHNI TEKSHIRISH
function checkSavedDoctor() {
  const savedDocId = localStorage.getItem("utt_active_doctor_id");
  if (savedDocId) {
    db.ref(`doctors/${savedDocId}`).once("value", (snap) => {
      const doc = snap.val();
      if (doc) {
        setDoctorLoggedIn({ id: savedDocId, ...doc });
      }
    });
  }
}

function handleDoctorLogin(e) {
  e.preventDefault();
  const docId = document.getElementById("doctorSelect").value;
  const doc = doctorsList.find(d => d.id === docId);

  if (!doc) {
    alert("Iltimos, vrachni tanlang!");
    return;
  }

  localStorage.setItem("utt_active_doctor_id", doc.id);
  setDoctorLoggedIn(doc);
}

function setDoctorLoggedIn(doc) {
  currentDoctor = doc;
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("doctorWorkspace").style.display = "flex";

  document.getElementById("headerDocName").innerText = doc.name;
  document.getElementById("headerDocRoom").innerText = doc.room;
  document.getElementById("headerDocSpecialty").innerText = doc.specialty || "UTT Shifokori";

  listenToMyPatients();
}

function logoutDoctor() {
  localStorage.removeItem("utt_active_doctor_id");
  currentDoctor = null;
  activePatient = null;
  document.getElementById("doctorWorkspace").style.display = "none";
  document.getElementById("loginScreen").style.display = "flex";
}

// 3. SHU VRACHGA TEGISHLI BEMORLARNI REAL-TIME TINGLASH
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

    // Saralash: kutayotganlar timestamp bo'yicha birinchi
    myPatients.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    updateWorkspaceState();
  });
}

// 4. ISH STOLINI YANGILASH
function updateWorkspaceState() {
  // Hozirgi aktiv bemor (calling yoki in_progress)
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
  document.getElementById("activeService").innerText = patient.service || "UTT Ko'rik";
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
    btnStartExam.style.display = "none"; // allaqachon boshlangan
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

  container.innerHTML = waitingList.map((p, index) => `
    <div class="queue-item-card">
      <div class="queue-item-left">
        <span class="queue-ticket-num">${p.ticketId}</span>
        <div>
          <div class="queue-patient-title">${escapeHtml(p.name)}</div>
          <div class="queue-patient-sub">${escapeHtml(p.service || "UTT")} • ${p.time || ''}</div>
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

// 5. NAVBATNI BOSHQARISH VA TV MONITORGA CHAQIRUV YUBORISH
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
  // 1. Bemor holatini "calling" ga o'tkazish
  db.ref(`patients/${todayDateStr}/${patient.id}`).update({
    status: "calling",
    callTimestamp: firebase.database.ServerValue.TIMESTAMP
  });

  // 2. TV Monitor uchun maxsus e'lon xabarini yuborish
  broadcastToTV(patient);
}

function recallCurrentPatient() {
  if (!activePatient) return;
  broadcastToTV(activePatient);
}

// TV ga audio va animatsiya triggerini yuborish
function broadcastToTV(patient) {
  const announcement = {
    patientId: patient.id,
    ticketId: patient.ticketId,
    patientName: patient.name,
    room: currentDoctor.room,
    doctorName: currentDoctor.name,
    specialty: currentDoctor.specialty || "UTT",
    timestamp: firebase.database.ServerValue.TIMESTAMP
  };

  // TV dagi barcha ekranlar ushbu tugunni tinglab turadi
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

// Klaviatura tugmalari (Space yoki Enter - keyingisini chaqirish)
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
