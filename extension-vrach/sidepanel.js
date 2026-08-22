/**
 * Vrach / Operator Side Panel - MRT & MSKT Mantiqi
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

const DEVICES = [
  { id: "mrt1", name: "MRT 1", room: "1-MRT Xonasi", type: "MRT" },
  { id: "mrt2", name: "MRT 2", room: "2-MRT Xonasi", type: "MRT" },
  { id: "mskt1", name: "MSKT 1", room: "1-MSKT Xonasi", type: "MSKT" }
];

let currentDevice = DEVICES[0]; // Default: MRT 1
let patientsList = [];
let activePatient = null;
let pollInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initPanel();
});

async function initPanel() {
  populateDeviceSelect();
  await loadSavedDevice();
  setupEvents();
  
  fetchTodayPatients();
  pollInterval = setInterval(fetchTodayPatients, 2500);
}

function populateDeviceSelect() {
  const select = document.getElementById("doctorSelect");
  select.innerHTML = DEVICES.map(d => `
    <option value="${d.id}">${d.name} (${d.room})</option>
  `).join("");

  select.addEventListener("change", async (e) => {
    const devId = e.target.value;
    currentDevice = DEVICES.find(d => d.id === devId);
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ utt_selected_device_id: devId });
    }
    fetchTodayPatients();
  });
}

async function loadSavedDevice() {
  if (chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get("utt_selected_device_id");
    if (data && data.utt_selected_device_id) {
      const dev = DEVICES.find(d => d.id === data.utt_selected_device_id);
      if (dev) {
        currentDevice = dev;
        document.getElementById("doctorSelect").value = dev.id;
      }
    }
  }
}

function setupEvents() {
  document.getElementById("btnCallNext").onclick = callNextPatient;
  document.getElementById("btnRecall").onclick = recallCurrentPatient;
  document.getElementById("btnStartExam").onclick = startExamination;
  document.getElementById("btnFinishExam").onclick = finishExamination;
  document.getElementById("btnSkipPatient").onclick = skipPatient;
}

// BUGUNGI BEMORLARNI FIREBASE'DAN OLISH
async function fetchTodayPatients() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  try {
    const res = await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`);
    if (!res.ok) return;

    const data = await res.json();
    patientsList = [];

    if (data) {
      Object.keys(data).forEach(key => {
        const p = { id: key, ...data[key] };
        if (p.doctorId === currentDevice.id) {
          patientsList.push(p);
        }
      });
    }

    patientsList.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    updateUI();
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

function updateUI() {
  const currentActive = patientsList.find(p => p.status === "calling" || p.status === "in_progress");
  const waitingPatients = patientsList.filter(p => p.status === "waiting");

  activePatient = currentActive || null;

  renderActiveCard(activePatient);
  renderWaitingList(waitingPatients);
}

function renderActiveCard(patient) {
  const emptyState = document.getElementById("emptyState");
  const activeInfo = document.getElementById("activeInfo");
  const badge = document.getElementById("currentBadge");
  const btnCallNext = document.getElementById("btnCallNext");
  const inCallGroup = document.getElementById("inCallGroup");
  const btnStart = document.getElementById("btnStartExam");

  if (!patient) {
    emptyState.style.display = "block";
    activeInfo.style.display = "none";
    badge.className = "badge badge-waiting";
    badge.innerText = "Bo'sh";
    btnCallNext.style.display = "flex";
    inCallGroup.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  activeInfo.style.display = "flex";

  document.getElementById("activeId").innerText = patient.ticketId || "ID";
  
  const contrastTag = patient.isContrast ? `<span style="background:#ef4444; color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px;">KONTRAST</span>` : '';
  document.getElementById("activeName").innerHTML = `${escapeHtml(patient.name)} ${contrastTag}`;
  document.getElementById("activeService").innerText = patient.service || "Tomografiya";
  document.getElementById("activeTime").innerText = patient.time || "-";

  if (patient.referringDoctor) {
    document.getElementById("referringRow").style.display = "flex";
    document.getElementById("activeReferring").innerText = patient.referringDoctor;
  } else {
    document.getElementById("referringRow").style.display = "none";
  }

  if (patient.status === "calling") {
    badge.className = "badge badge-calling";
    badge.innerText = "Chaqirilmoqda...";
    btnStart.style.display = "flex";
  } else if (patient.status === "in_progress") {
    badge.className = "badge badge-in_progress";
    badge.innerText = "Qabulda";
    btnStart.style.display = "none";
  }

  btnCallNext.style.display = "none";
  inCallGroup.style.display = "grid";
}

function renderWaitingList(waitingList) {
  const container = document.getElementById("queueList");
  const countPill = document.getElementById("waitingCount");

  countPill.innerText = `${waitingList.length} nafar`;

  if (waitingList.length === 0) {
    container.innerHTML = `<div class="loading-text">Kutayotgan bemorlar yo'q</div>`;
    return;
  }

  container.innerHTML = waitingList.map(p => `
    <div class="queue-card-item">
      <div class="queue-card-left">
        <span class="queue-card-id">${p.ticketId}</span>
        <div>
          <div class="queue-card-name">${escapeHtml(p.name)} ${p.isContrast ? '<span style="color:#ef4444; font-size:10px; font-weight:bold;">[K]</span>' : ''}</div>
          <div class="queue-card-sub">${escapeHtml(p.service || "Tomografiya")} • ${p.time || ''}</div>
        </div>
      </div>
      <button class="btn-queue-call" onclick="window.callSpecific('${p.id}')">
        <i class="fa-solid fa-bell"></i>
      </button>
    </div>
  `).join("");
}

// NAVBATNI BOSHQARISH
async function callNextPatient() {
  const waiting = patientsList.filter(p => p.status === "waiting");
  if (waiting.length === 0) {
    alert("Kutayotgan bemorlar yo'q!");
    return;
  }
  await callPatient(waiting[0]);
}

window.callSpecific = async function(patientDbId) {
  const p = patientsList.find(item => item.id === patientDbId);
  if (p) await callPatient(p);
};

async function callPatient(patient) {
  const todayStr = getTodayStr();

  await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}/${patient.id}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "calling" })
  });

  await broadcastToTV(patient);
  fetchTodayPatients();
}

async function recallCurrentPatient() {
  if (!activePatient) return;
  await broadcastToTV(activePatient);
}

async function broadcastToTV(patient) {
  const announcement = {
    patientId: patient.id,
    ticketId: patient.ticketId,
    patientName: patient.name,
    room: currentDevice.room,
    doctorName: currentDevice.name,
    specialty: currentDevice.type,
    isContrast: patient.isContrast || false,
    timestamp: Date.now()
  };

  await fetch(`${FIREBASE_DB_URL}/calling_announcement.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(announcement)
  });
}

async function startExamination() {
  if (!activePatient) return;
  const todayStr = getTodayStr();
  await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}/${activePatient.id}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "in_progress" })
  });
  fetchTodayPatients();
}

async function finishExamination() {
  if (!activePatient) return;
  const todayStr = getTodayStr();
  await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}/${activePatient.id}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" })
  });
  fetchTodayPatients();
}

async function skipPatient() {
  if (!activePatient) return;
  if (confirm("Bemor kelmadi deb belgilansinmi?")) {
    const todayStr = getTodayStr();
    await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}/${activePatient.id}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" })
    });
    fetchTodayPatients();
  }
}

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
