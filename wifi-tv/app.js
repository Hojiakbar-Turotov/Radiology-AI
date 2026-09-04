/**
 * ==============================================================================
 * 🏥 KUTISH ZALI TV — CLIENT SCRIPT (wifi-tv/app.js)
 * Port 3030 Wi-Fi TV ekrani uchun to'liq optimallashtirilgan
 * Real-time WebSocket + Fail-safe Polling + Ovozli e'lon + Mobil Responsivlik
 * ==============================================================================
 */

let ws = null;
let audioEnabled = true;
let audioUnlocked = false;
let currentQueue = [];
let currentDevices = [];
let activeDeviceFilter = 'all'; // 'all', 'mrt1', 'mrt2', 'mskt1'

document.addEventListener("DOMContentLoaded", () => {
  startClock();
  connectWebSocket();
  fetchInitialData();

  // Foydalanuvchi bir marta ekranga bossa yoki pult tugmasini bossa, audio ruxsatini yechamiz
  document.body.addEventListener("click", () => {
    enableAudio();
  }, { once: true });

  // Ekran yoki sarlavhaga 2 marta tez bosilganda (Double click) butun ekranga chiqarish / qaytish
  document.addEventListener("dblclick", (e) => {
    if (!e.target.closest("button") && !e.target.closest("a") && !e.target.closest("input")) {
      toggleFullscreen();
    }
  });

  // F11 tugmasi
  window.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  // Fullscreen o'zgarishini kuzatish
  document.addEventListener("fullscreenchange", updateFullscreenUi);
  document.addEventListener("webkitfullscreenchange", updateFullscreenUi);

  // Zaxira avtomatik yangilanish (har 10 soniyada)
  setInterval(fetchInitialData, 10000);
});

// -------------------------------------------------------------
// 1. SOAT VA SANA (JONLI)
// -------------------------------------------------------------
function startClock() {
  const clockEl = document.getElementById("tvClock");
  const dateEl = document.getElementById("tvDate");

  const monthsUz = [
    "yanvar", "fevral", "mart", "aprel", "may", "iyun",
    "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"
  ];

  function update() {
    const now = new Date();
    if (clockEl) {
      clockEl.innerText = now.toLocaleTimeString("ru-RU", { hour12: false });
    }
    if (dateEl) {
      const d = now.getDate();
      const m = monthsUz[now.getMonth()];
      const y = now.getFullYear();
      dateEl.innerText = `${d}-${m}, ${y}-yil`;
    }
  }

  update();
  setInterval(update, 1000);
}

// -------------------------------------------------------------
// 2. WEBSOCKET REAL-TIME ALOQA
// -------------------------------------------------------------
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[TV WS] Ulandi:", wsUrl);
      ws.send(JSON.stringify({
        action: "register",
        role: "tv",
        deviceName: "Kutish Zali TV (Wi-Fi Port)"
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "queue_init" || data.type === "queue_updated") {
          if (data.payload && data.payload.queue) currentQueue = data.payload.queue;
          if (data.payload && data.payload.devices) currentDevices = data.payload.devices;
          renderDevicesGrid();
        } else if (data.type === "voice_announcement") {
          handleVoiceAnnouncement(data.payload);
        }
      } catch (err) {
        console.error("[TV WS Parse Error]:", err);
      }
    };

    ws.onclose = () => {
      console.warn("[TV WS] Uzildi, 3 soniyada qayta ulanadi...");
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      if (ws) ws.close();
    };
  } catch (e) {
    setTimeout(connectWebSocket, 3000);
  }
}

// REST API orqali dastlabki ma'lumotlarni olish
async function fetchInitialData() {
  try {
    const res = await fetch("/api/queue");
    if (!res.ok) return;
    const data = await res.json();
    if (data.success) {
      currentQueue = data.queue || [];
      currentDevices = data.devices || [];
      renderDevicesGrid();
    }
  } catch (e) {
    // Tarmoq xatosi bo'lsa indamaymiz
  }
}

// -------------------------------------------------------------
// 3. APPARATLAR GRIDINI CHIZISH (RENDER)
// -------------------------------------------------------------
function renderDevicesGrid() {
  const container = document.getElementById("devicesGridContainer");
  if (!container) return;

  if (!currentDevices || currentDevices.length === 0) {
    container.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-spinner fa-spin fa-2x" style="color:var(--primary);"></i>
        <span>Tomografiya apparatlari yuklanmoqda...</span>
      </div>
    `;
    return;
  }

  // Mobil tab filtri bo'yicha saralash
  let filteredDevices = currentDevices;
  if (activeDeviceFilter && activeDeviceFilter !== 'all') {
    filteredDevices = currentDevices.filter(d => d.id === activeDeviceFilter);
  }

  container.innerHTML = filteredDevices.map(device => {
    const devQueue = currentQueue.filter(p => p.deviceId === device.id);
    
    // 1. Xonadagi yoki chaqirilayotgan bemor
    const inProgress = devQueue.find(p => p.status === "in_progress" || p.status === "calling");
    
    // 2. Tayyorgarlikdagi bemor
    const preparing = devQueue.find(p => p.status === "preparing");
    
    // 3. Kutayotganlar ro'yxati
    const waitingList = devQueue.filter(p => p.status === "waiting");

    // Asosiy karta HTML
    let currentCardHtml = "";
    if (inProgress) {
      const isCalling = inProgress.status === "calling";
      currentCardHtml = `
        <div class="current-patient-card ${isCalling ? 'is-calling' : 'in-room'}">
          <div class="card-status-badge">
            <span class="status-dot"></span>
            ${isCalling ? "🔔 XONAGA CHAQIRILMOQDA!" : "🟢 XONADA (TEKSHIRILMOQDA)"}
          </div>
          <div class="patient-ticket-big">${escapeHtml(inProgress.ticketNumber)}</div>
          <div class="patient-name-text" title="${escapeHtml(inProgress.patientName)}">
            ${escapeHtml(inProgress.patientName)}
          </div>
          <div class="patient-service-text">
            <i class="fa-solid fa-stethoscope"></i> ${escapeHtml(inProgress.primaryService || 'Tomografiya')}
          </div>
          <div class="patient-meta-footer">
            <span>⏳ ${inProgress.estimatedDurationMinutes || 25} daqiqa</span>
            ${inProgress.isContrast ? '<span class="contrast-badge"><i class="fa-solid fa-syringe"></i> KONTRAST</span>' : ''}
          </div>
        </div>
      `;
    } else {
      currentCardHtml = `
        <div class="current-patient-card is-idle">
          <div class="card-status-badge">
            <i class="fa-solid fa-bed-pulse"></i> APPARAT BO'SH
          </div>
          <div class="patient-ticket-big" style="font-size:22px; color:var(--text-muted); margin: 6px 0;">
            NAVBAT KUTILMOQDA
          </div>
          <div style="font-size:13px; color:var(--text-muted); font-weight:600;">
            Bemor xonaga taklif etilishi kutilmoqda
          </div>
        </div>
      `;
    }

    // Tayyorgarlik kartasi HTML
    let prepCardHtml = "";
    if (preparing) {
      prepCardHtml = `
        <div class="prep-patient-card">
          <div class="prep-header-row">
            <span><i class="fa-solid fa-user-clock"></i> Tayyorgarlikda (Navbatdagi)</span>
            ${preparing.isContrast ? '<span style="color:#dc2626; font-size:10.5px;">💉 Kateter</span>' : ''}
          </div>
          <div class="prep-body-row">
            <div class="prep-pat-name">${escapeHtml(preparing.patientName)}</div>
            <div class="prep-ticket-badge">${escapeHtml(preparing.ticketNumber)}</div>
          </div>
        </div>
      `;
    }

    // Kutayotganlar ro'yxati HTML
    let waitingHtml = "";
    if (waitingList.length === 0) {
      waitingHtml = `<div class="waiting-empty-state"><i class="fa-regular fa-circle-check"></i> Kutayotgan bemorlar yo'q</div>`;
    } else {
      waitingHtml = waitingList.slice(0, 6).map(p => `
        <div class="waiting-row">
          <span class="w-ticket-tag">${escapeHtml(p.ticketNumber)}</span>
          <span class="w-name-text">${escapeHtml(p.patientName)}</span>
          <span class="w-time-tag">${p.estimatedStartTime ? formatTime(p.estimatedStartTime) : ''}</span>
        </div>
      `).join("");
    }

    // Apparat ikonkasini aniqlash
    const isMskt = device.type === 'MSKT' || (device.id && device.id.includes('mskt'));
    const devIcon = isMskt ? 'fa-ring' : 'fa-magnet';

    return `
      <div class="device-column" id="col_${device.id}">
        <div class="device-header">
          <div class="device-title">
            <i class="fa-solid ${devIcon}"></i> ${escapeHtml(device.name)}
          </div>
          <div class="device-room-pill">${escapeHtml(device.room || 'Tomografiya')}</div>
        </div>

        ${currentCardHtml}
        ${prepCardHtml}

        <div class="waiting-list-container">
          <div class="waiting-list-title">
            <span><i class="fa-solid fa-list-ol"></i> Navbatdagilar</span>
            <span>Jami: ${waitingList.length} ta</span>
          </div>
          <div class="waiting-scroll-area">
            ${waitingHtml}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// -------------------------------------------------------------
// 4. MOBIL TAB FILTRI (MRT 1, MRT 2, MSKT 1)
// -------------------------------------------------------------
window.filterDeviceTab = function(filter) {
  activeDeviceFilter = filter;
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderDevicesGrid();
};

// -------------------------------------------------------------
// 5. OVOZLI E'LON VA CHIME (SPEECH SYNTHESIS)
// -------------------------------------------------------------
function handleVoiceAnnouncement(payload) {
  if (!audioEnabled || !payload) return;

  playChime();

  setTimeout(() => {
    let patientName = (payload.patientName || "").trim();
    if (!patientName && payload.patient && payload.patient.patientName) {
      patientName = payload.patient.patientName.trim();
    }
    if (!patientName) return;

    // Foydalanuvchi talabi: bemor chaqirishda navbat raqami va xona nomi o'qilmasin. Faqat: FISH postga keling.
    const text = `${patientName} postga keling.`;

    if (text && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel(); // oldingi gapni to'xtatish
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "uz-UZ";
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {}
    }
  }, 900);
}

function playChime(silent = false) {
  const audio = document.getElementById("audioChime");
  if (audio) {
    audio.currentTime = 0;
    audio.volume = silent ? 0.01 : 1.0;
    audio.play().catch(() => {});
  }
}

window.enableAudio = function() {
  audioUnlocked = true;
  const banner = document.getElementById("audioAlertBanner");
  if (banner) banner.style.display = "none";
  playChime(true);
};

window.toggleAudio = function() {
  audioEnabled = !audioEnabled;
  const icon = document.getElementById("audioIcon");
  const text = document.getElementById("audioText");
  if (audioEnabled) {
    icon.className = "fa-solid fa-volume-high";
    text.innerText = "Ovoz: Faol";
    playChime(true);
  } else {
    icon.className = "fa-solid fa-volume-xmark";
    text.innerText = "Ovoz: O'chiq";
  }
};

// -------------------------------------------------------------
// 6. TO'LIQ EKRAN (FULLSCREEN) BOSHQARUVI
// -------------------------------------------------------------
window.toggleFullscreen = function() {
  const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  if (!isFs) {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(() => {});
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
};

function updateFullscreenUi() {
  const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  const icon = document.getElementById("fsIcon");
  const text = document.getElementById("fsText");
  if (icon && text) {
    if (isFs) {
      icon.className = "fa-solid fa-compress";
      text.innerText = "Kichraytirish";
    } else {
      icon.className = "fa-solid fa-expand";
      text.innerText = "Butun Ekran";
    }
  }
}

// -------------------------------------------------------------
// YORDAMCHI FUNKSIYALAR
// -------------------------------------------------------------
function formatTime(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
