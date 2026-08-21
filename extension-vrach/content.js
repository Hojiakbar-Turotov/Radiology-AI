/**
 * Vrach / Operator Kengaytmasi - Sahifadagi Widget (MRT & MSKT)
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

const DEVICES = [
  { id: "mrt1", name: "MRT 1", room: "1-MRT Xonasi", type: "MRT" },
  { id: "mrt2", name: "MRT 2", room: "2-MRT Xonasi", type: "MRT" },
  { id: "mskt1", name: "MSKT 1", room: "1-MSKT Xonasi", type: "MSKT" },
  { id: "mskt2", name: "MSKT 2", room: "2-MSKT Xonasi", type: "MSKT" }
];

let myDevice = DEVICES[0]; // Default: MRT 1
let myPatients = [];
let activePatient = null;

initDoctorWidget();

async function initDoctorWidget() {
  if (chrome.storage && chrome.storage.local) {
    const saved = await chrome.storage.local.get("utt_selected_device_id");
    if (saved && saved.utt_selected_device_id) {
      const dev = DEVICES.find(d => d.id === saved.utt_selected_device_id);
      if (dev) myDevice = dev;
    }
  }

  createWidgetDOM();
  fetchDeviceQueue();
  setInterval(fetchDeviceQueue, 3000);
}

function createWidgetDOM() {
  if (document.getElementById("uttDocWidget")) return;

  const widget = document.createElement("div");
  widget.id = "uttDocWidget";
  widget.className = "utt-doc-widget";

  widget.innerHTML = `
    <div class="utt-doc-info">
      <div class="utt-doc-header-line">
        <span class="utt-doc-room" id="uttWidgetRoom">${myDevice.name}</span>
        <span class="utt-doc-wait-badge" id="uttWidgetWaitCount">0 kutmoqda</span>
      </div>
      <div class="utt-doc-patient-name" id="uttWidgetPatient">Qabul bo'sh</div>
    </div>

    <div class="utt-doc-actions">
      <button class="utt-doc-btn utt-doc-btn-call" id="uttWidgetBtnCall">
        🔔 Chaqirish
      </button>
      <button class="utt-doc-btn utt-doc-btn-finish" id="uttWidgetBtnFinish" style="display: none;">
        ✅ Tugadi
      </button>
    </div>
  `;

  document.body.appendChild(widget);

  document.getElementById("uttWidgetBtnCall").onclick = callNext;
  document.getElementById("uttWidgetBtnFinish").onclick = finishExam;
}

async function fetchDeviceQueue() {
  if (chrome.storage && chrome.storage.local) {
    const saved = await chrome.storage.local.get("utt_selected_device_id");
    if (saved && saved.utt_selected_device_id && saved.utt_selected_device_id !== myDevice.id) {
      const dev = DEVICES.find(d => d.id === saved.utt_selected_device_id);
      if (dev) {
        myDevice = dev;
        document.getElementById("uttWidgetRoom").innerText = myDevice.name;
      }
    }
  }

  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  try {
    const res = await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`);
    if (!res.ok) return;

    const data = await res.json();
    myPatients = [];

    if (data) {
      Object.keys(data).forEach(key => {
        const p = { id: key, ...data[key] };
        if (p.doctorId === myDevice.id) {
          myPatients.push(p);
        }
      });
    }

    myPatients.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    updateWidgetState();
  } catch (err) {}
}

function updateWidgetState() {
  const waiting = myPatients.filter(p => p.status === "waiting");
  const currentActive = myPatients.find(p => p.status === "calling" || p.status === "in_progress");

  activePatient = currentActive || null;

  const countBadge = document.getElementById("uttWidgetWaitCount");
  const patientText = document.getElementById("uttWidgetPatient");
  const btnCall = document.getElementById("uttWidgetBtnCall");
  const btnFinish = document.getElementById("uttWidgetBtnFinish");

  if (countBadge) countBadge.innerText = `${waiting.length} kutmoqda`;

  if (activePatient) {
    const kTag = activePatient.isContrast ? ' [K]' : '';
    if (patientText) patientText.innerText = `${activePatient.ticketId} - ${activePatient.name}${kTag}`;
    if (btnCall) btnCall.innerText = "🔁 Qayta chaqirish";
    if (btnFinish) btnFinish.style.display = "inline-flex";
  } else {
    if (patientText) patientText.innerText = "Qabul bo'sh";
    if (btnCall) btnCall.innerText = "🔔 Keyingisini Chaqirish";
    if (btnFinish) btnFinish.style.display = "none";
  }
}

async function callNext() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  let target = activePatient;

  if (!target) {
    const waiting = myPatients.filter(p => p.status === "waiting");
    if (waiting.length === 0) {
      alert("Kutayotgan bemorlar yo'q!");
      return;
    }
    target = waiting[0];
  }

  await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}/${target.id}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "calling" })
  });

  const announcement = {
    patientId: target.id,
    ticketId: target.ticketId,
    patientName: target.name,
    room: myDevice.room,
    doctorName: myDevice.name,
    specialty: myDevice.type,
    isContrast: target.isContrast || false,
    timestamp: Date.now()
  };

  await fetch(`${FIREBASE_DB_URL}/calling_announcement.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(announcement)
  });

  fetchDeviceQueue();
}

async function finishExam() {
  if (!activePatient) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}/${activePatient.id}.json`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" })
  });

  fetchDeviceQueue();
}
