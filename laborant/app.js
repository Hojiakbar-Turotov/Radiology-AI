/**
 * Laborant Portali - Client Script (laborant/app.js)
 */

let ws = null;
let currentQueue = [];
let selectedDeviceId = localStorage.getItem("selectedLaborantRoom") || "mrt1";
let activePatient = null;
let prepPatient = null;

document.addEventListener("DOMContentLoaded", () => {
  const selectDev = document.getElementById("selectDevice");
  selectDev.value = selectedDeviceId;

  selectDev.addEventListener("change", (e) => {
    selectedDeviceId = e.target.value;
    localStorage.setItem("selectedLaborantRoom", selectedDeviceId);
    renderLaborantView();
  });

  initActionButtons();
  connectWebSocket();
  fetchQueue();
});

function initActionButtons() {
  document.getElementById("btnActionCall").addEventListener("click", async () => {
    if (!activePatient) return;
    await postAPI("/api/queue/call", { id: activePatient.id });
  });

  document.getElementById("btnActionComplete").addEventListener("click", async () => {
    if (!activePatient) return;
    if (confirm(`${activePatient.patientName} ning tekshiruvi yakunlansinmi?`)) {
      await postAPI("/api/queue/update-status", { id: activePatient.id, status: "completed" });
    }
  });

  document.getElementById("btnCallToRoom").addEventListener("click", async () => {
    if (!prepPatient) return;
    await postAPI("/api/queue/call", { id: prepPatient.id });
    await postAPI("/api/queue/update-status", { id: prepPatient.id, status: "in_progress" });
  });
}

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: "register",
      role: "doctor",
      room: selectedDeviceId,
      deviceName: `Laborant (${selectedDeviceId})`
    }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "queue_init" || data.type === "queue_updated") {
        if (data.payload.queue) currentQueue = data.payload.queue;
        renderLaborantView();
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

async function fetchQueue() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.success && data.queue) {
      currentQueue = data.queue;
      renderLaborantView();
    }
  } catch (e) {}
}

function renderLaborantView() {
  const devQueue = currentQueue.filter(p => p.deviceId === selectedDeviceId);

  activePatient = devQueue.find(p => p.status === "in_progress" || p.status === "calling") || null;
  prepPatient = devQueue.find(p => p.status === "preparing") || null;
  const waitingList = devQueue.filter(p => p.status === "waiting");

  // 1. Active Patient Card
  const emptyBox = document.getElementById("emptyPatientBox");
  const detailsBox = document.getElementById("activePatientDetails");
  const sectionBadge = document.getElementById("currentSectionBadge");

  if (activePatient) {
    emptyBox.style.display = "none";
    detailsBox.style.display = "block";

    const isCalling = activePatient.status === "calling";
    sectionBadge.innerHTML = isCalling ? "🔔 Xonaga Chaqirilmoqda" : "🟢 Xonada (Tekshiruvda)";
    sectionBadge.style.color = isCalling ? "#38bdf8" : "#34d399";

    document.getElementById("curTicket").innerText = activePatient.ticketNumber;
    document.getElementById("curName").innerText = activePatient.patientName;
    document.getElementById("curService").innerText = activePatient.primaryService;
    document.getElementById("curDuration").innerText = activePatient.estimatedDurationMinutes || 30;

    const contrastPill = document.getElementById("curContrastPill");
    contrastPill.style.display = activePatient.isContrast ? "inline-block" : "none";

    const startTimeFormatted = activePatient.startedAt 
      ? new Date(activePatient.startedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) 
      : "--:--";
    document.getElementById("curStartTime").innerText = `Boshlandi: ${startTimeFormatted}`;
  } else {
    emptyBox.style.display = "block";
    detailsBox.style.display = "none";
    sectionBadge.innerHTML = "⚪ Xona Bo'sh";
    sectionBadge.style.color = "#94a3b8";
  }

  // 2. Preparing Patient Card
  const emptyPrep = document.getElementById("emptyPrepBox");
  const prepDetails = document.getElementById("prepDetailsBox");

  if (prepPatient) {
    emptyPrep.style.display = "none";
    prepDetails.style.display = "block";

    document.getElementById("prepTicket").innerText = prepPatient.ticketNumber;
    document.getElementById("prepName").innerText = prepPatient.patientName;
    document.getElementById("prepService").innerText = prepPatient.primaryService;

    const badge = document.getElementById("prepContrastBadge");
    badge.style.display = prepPatient.isContrast ? "inline-block" : "none";
  } else {
    emptyPrep.style.display = "block";
    prepDetails.style.display = "none";
  }

  // 3. Waiting List
  document.getElementById("waitingCountBadge").innerText = `${waitingList.length} ta`;
  const listContainer = document.getElementById("waitingCardsContainer");

  if (waitingList.length === 0) {
    listContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b; font-size:12px;">Kutayotgan bemorlar yo'q</div>`;
    return;
  }

  listContainer.innerHTML = waitingList.map(p => `
    <div class="waiting-card-item">
      <div class="item-left">
        <span class="item-ticket">${escapeHtml(p.ticketNumber)}</span>
        <div>
          <div class="item-name">${escapeHtml(p.patientName)}</div>
          <div class="item-service">
            ${escapeHtml(p.primaryService)} 
            ${p.isContrast ? '<b style="color:#f87171;">[💉 Kontrast]</b>' : ''}
          </div>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn-mini-prep" onclick="handleStartPrep('${p.id}')">
          <i class="fa-solid fa-syringe"></i> Tayyorlash
        </button>
        <button class="btn-mini-call" onclick="handleCallPatient('${p.id}')">
          <i class="fa-solid fa-door-open"></i> Chaqirish
        </button>
      </div>
    </div>
  `).join("");
}

window.handleStartPrep = async function(id) {
  await postAPI("/api/queue/prep", { id });
};

window.handleCallPatient = async function(id) {
  await postAPI("/api/queue/call", { id });
  await postAPI("/api/queue/update-status", { id, status: "in_progress" });
};

async function postAPI(url, data) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
