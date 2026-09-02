/**
 * MRT & MSKT Kutish Zali TV Tablosi - Client Script (mrt-tv/app.js)
 */

let ws = null;
let audioEnabled = true;
let currentQueue = [];
let currentDevices = [];

document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  connectWebSocket();
  fetchInitialQueue();

  document.getElementById("btnAudioToggle").addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    const btn = document.getElementById("btnAudioToggle");
    btn.innerHTML = audioEnabled 
      ? '<i class="fa-solid fa-volume-high"></i> Ovozli E\'lon: Faol' 
      : '<i class="fa-solid fa-volume-xmark" style="color:#ef4444;"></i> Ovozli E\'lon: O\'chirilgan';
  });

  // Brauzerda avtomatik ovoz blokirovkasini yechish (foydalanuvchi bir marta ekranga bossa)
  document.body.addEventListener("click", () => {
    playChime(true);
  }, { once: true });
});

// -------------------------------------------------------------
// CLOCK
// -------------------------------------------------------------
function startLiveClock() {
  function update() {
    const now = new Date();
    document.getElementById("tvClock").innerText = now.toLocaleTimeString("ru-RU");

    const months = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
    const d = now.getDate();
    const m = months[now.getMonth()];
    const y = now.getFullYear();
    document.getElementById("tvDate").innerText = `${d}-${m}, ${y}-yil`;
  }
  update();
  setInterval(update, 1000);
}

// -------------------------------------------------------------
// WEBSOCKET JONLI ALOQA
// -------------------------------------------------------------
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: "register",
      role: "tv",
      deviceName: "MRT Kutish Zali TV Tablosi"
    }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === "queue_init" || data.type === "queue_updated") {
        if (data.payload.queue) currentQueue = data.payload.queue;
        if (data.payload.devices) currentDevices = data.payload.devices;
        renderTVGrid();
      } else if (data.type === "voice_announcement") {
        handleVoiceAnnouncement(data.payload);
      }
    } catch (e) {
      console.error("[WS TV Error]:", e);
    }
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

async function fetchInitialQueue() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.success) {
      currentQueue = data.queue || [];
      currentDevices = data.devices || [];
      renderTVGrid();
    }
  } catch (e) {}
}

// -------------------------------------------------------------
// TV GRID RENDERING
// -------------------------------------------------------------
function renderTVGrid() {
  const container = document.getElementById("tvDevicesGrid");
  if (!container) return;

  if (currentDevices.length === 0) {
    container.innerHTML = `<div class="empty-placeholder">Apparatlar yuklanmoqda...</div>`;
    return;
  }

  container.innerHTML = currentDevices.map(dev => {
    const devQueue = currentQueue.filter(p => p.deviceId === dev.id);
    const inProgress = devQueue.find(p => p.status === "in_progress" || p.status === "calling");
    const preparing = devQueue.find(p => p.status === "preparing");
    const waitingList = devQueue.filter(p => p.status === "waiting");

    // 1. In Progress Card
    let inProgressHtml = "";
    if (inProgress) {
      const isCalling = inProgress.status === "calling";
      inProgressHtml = `
        <div class="in-progress-card ${isCalling ? 'pulse-calling' : ''}">
          <div class="card-status-label">
            <span class="pulse-dot"></span> ${isCalling ? "XONAGA CHAQIRILMOQDA" : "XONADA (TEKSHIRILMOQDA)"}
          </div>
          <div class="pat-ticket-badge">${escapeHtml(inProgress.ticketNumber)}</div>
          <div class="pat-fullname">${escapeHtml(inProgress.patientName)}</div>
          <div class="pat-service-name">${escapeHtml(inProgress.primaryService)}</div>
          <div class="pat-meta-row">
            <span>⏳ ${inProgress.estimatedDurationMinutes || 30} daqiqa</span>
            ${inProgress.isContrast ? '<span class="badge-contrast">💉 KONTRAST</span>' : ''}
          </div>
        </div>
      `;
    } else {
      inProgressHtml = `
        <div class="in-progress-card" style="border-color:#475569; background:rgba(30, 41, 59, 0.4);">
          <div class="card-status-label" style="color:#94a3b8;">
            <i class="fa-solid fa-bed"></i> APPARAT BO'SH
          </div>
          <div class="pat-ticket-badge" style="color:#64748b; font-size:24px;">NAVAT KUTILMOQDA</div>
          <div class="pat-fullname" style="color:#94a3b8; font-size:14px;">Bemor xonaga taklif etilishi kutilmoqda</div>
        </div>
      `;
    }

    // 2. Preparing Card
    let prepHtml = "";
    if (preparing) {
      prepHtml = `
        <div class="preparing-card">
          <div class="card-status-label">
            <i class="fa-solid fa-user-clock"></i> TAYYORGARLIKDA (NAVBATDAGI)
          </div>
          <div class="prep-pat-name">
            <span>${escapeHtml(preparing.patientName)}</span>
            <strong style="color:#fbbf24; font-family:monospace;">${escapeHtml(preparing.ticketNumber)}</strong>
          </div>
          <div style="font-size:11.5px; color:#cbd5e1; display:flex; justify-content:space-between;">
            <span>${escapeHtml(preparing.primaryService)}</span>
            ${preparing.isContrast ? '<span class="badge-contrast">💉 Kateter tayyorlash</span>' : ''}
          </div>
        </div>
      `;
    }

    // 3. Waiting List
    let waitingHtml = "";
    if (waitingList.length === 0) {
      waitingHtml = `<div style="text-align:center; padding:20px; color:#64748b; font-size:12.5px;">Kutayotganlar yo'q</div>`;
    } else {
      waitingHtml = waitingList.slice(0, 5).map((p, idx) => `
        <div class="waiting-item-row">
          <span class="wait-ticket">${escapeHtml(p.ticketNumber)}</span>
          <span class="wait-name">${escapeHtml(p.patientName)}</span>
          <span class="wait-time">${p.estimatedStartTime ? formatTime(p.estimatedStartTime) : ''}</span>
        </div>
      `).join("");
    }

    return `
      <div class="device-column">
        <div class="device-column-header">
          <div class="col-dev-title">
            <i class="fa-solid fa-magnet" style="color:#38bdf8;"></i> ${escapeHtml(dev.name)}
          </div>
          <div class="col-dev-room">${escapeHtml(dev.room)}</div>
        </div>

        ${inProgressHtml}
        ${prepHtml}

        <div class="waiting-list-section">
          <div class="waiting-list-header">
            <span>NAVBATDAGI BEMORLAR</span>
            <span>Jami: ${waitingList.length} ta</span>
          </div>
          <div class="waiting-items-scroll">
            ${waitingHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// -------------------------------------------------------------
// OVOZLI E'LON (SPEECH SYNTHESIS)
// -------------------------------------------------------------
function handleVoiceAnnouncement(payload) {
  if (!audioEnabled) return;

  playChime();

  setTimeout(() => {
    let speechText = "";
    if (payload.type === "call_room") {
      speechText = `${payload.ticketNumber} raqamli bemor ${payload.patientName}, ${payload.room}ga kiring.`;
    } else if (payload.type === "call_prep") {
      speechText = `${payload.ticketNumber} raqamli bemor ${payload.patientName}, ${payload.room}ga tayyorgarlik uchun murojaat qiling.`;
    }

    if (speechText && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = "uz-UZ";
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, 900);
}

function playChime(silent = false) {
  const audio = document.getElementById("audioChime");
  if (audio) {
    audio.currentTime = 0;
    if (silent) audio.volume = 0.01;
    else audio.volume = 1.0;
    audio.play().catch(() => {});
  }
}

function formatTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
