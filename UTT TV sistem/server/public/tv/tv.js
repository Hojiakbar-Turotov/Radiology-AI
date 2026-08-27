/**
 * UTT TV SISTEM — ANDROID TV REALTIME MONITOR & UZBEK VOICE ANNOUNCER
 * 100% Offline Lokal Tarmoqda Ishlaydi (WebSocket + Audio Chime + Uzbek TTS)
 */

let allPatients = [];
let allDoctors = [];
let lastAnnouncementTimestamp = 0;
let isAudioUnlocked = false;
let audioContext = null;
let activeCallTimer = null;
let ws = null;

document.addEventListener("DOMContentLoaded", () => {
  initClock();
  initAudio();
  fetchInitialState();
  initWebSocket();
  initRemoteKeys();
});

// 1. SOAT VA SANA
function initClock() {
  function updateTime() {
    const now = new Date();
    const clockEl = document.getElementById("liveClock");
    const dateEl = document.getElementById("liveDate");

    if (clockEl) {
      clockEl.innerText = now.toLocaleTimeString("uz-UZ", { hour12: false });
    }
    if (dateEl) {
      dateEl.innerText = now.toLocaleDateString("uz-UZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      });
    }
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// 2. BOSHLANG'ICH HOLATNI HTTP ORQALI YUKLASH
async function fetchInitialState() {
  try {
    const docRes = await fetch("/api/doctors");
    allDoctors = await docRes.json();

    const qRes = await fetch("/api/queue");
    const qData = await qRes.json();

    allPatients = qData.patients || [];
    renderRoomsGrid();

    if (qData.current_announcement && qData.current_announcement.timestamp > lastAnnouncementTimestamp) {
      lastAnnouncementTimestamp = qData.current_announcement.timestamp;
      handleCallingAnnouncement(qData.current_announcement);
    }
  } catch (err) {
    console.warn("fetchInitialState error:", err.message);
  }
}

// 3. WEBSOCKET REALTIME ULANISH (Avtomatik qayta ulanish bilan)
function initWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${location.host}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("✅ WebSocket serverga ulandi!");
      updateNetworkBadge(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWebSocketMessage(msg);
      } catch (e) {}
    };

    ws.onclose = () => {
      console.warn("⚠️ WebSocket uzildi. Qayta ulanmoqda...");
      updateNetworkBadge(false);
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = () => {
      updateNetworkBadge(false);
    };
  } catch (err) {
    console.warn("WebSocket init error:", err);
    setTimeout(initWebSocket, 4000);
  }

  // Fallback Polling (Har 5 soniyada tarmoqni tekshirib turadi)
  setInterval(() => {
    if (!ws || ws.readyState !== 1) {
      fetchInitialState();
    }
  }, 5000);
}

function updateNetworkBadge(isOnline) {
  const badge = document.getElementById("netBadge");
  const text = document.getElementById("netStatusText");
  if (!badge || !text) return;

  if (isOnline) {
    badge.style.background = "rgba(34, 197, 94, 0.15)";
    badge.style.borderColor = "rgba(34, 197, 94, 0.4)";
    badge.style.color = "#4ade80";
    text.innerText = "Lokal Tarmoq: Ulangan";
  } else {
    badge.style.background = "rgba(239, 68, 68, 0.15)";
    badge.style.borderColor = "rgba(239, 68, 68, 0.4)";
    badge.style.color = "#f87171";
    text.innerText = "Lokal Tarmoq: Qayta ulanmoqda...";
  }
}

function handleWebSocketMessage(msg) {
  if (msg.type === "INITIAL_STATE") {
    allDoctors = msg.data.doctors || [];
    allPatients = msg.data.queue.patients || [];
    renderRoomsGrid();
  } else if (msg.type === "QUEUE_UPDATED") {
    allPatients = msg.data.patients || [];
    renderRoomsGrid();
  } else if (msg.type === "DOCTORS_UPDATED") {
    allDoctors = msg.data || [];
    renderRoomsGrid();
  } else if (msg.type === "CALL_ANNOUNCEMENT") {
    handleCallingAnnouncement(msg.data);
  }
}

// 4. JONLI CHAQIRUV E'LONI (ANIMATSIYA + CHIME + O'ZBEKCHA OVOZ)
function handleCallingAnnouncement(data) {
  if (!data || !data.patientName) return;

  const heroBanner = document.getElementById("callingHeroBanner");
  const heroCard = document.getElementById("callingHeroCard");

  document.getElementById("heroPatientName").innerText = data.patientName.toUpperCase();
  document.getElementById("heroRoomNum").innerText = data.room || "Qabul xonasi";
  document.getElementById("heroDoctorName").innerText = data.doctorName || "Shifokor";
  document.getElementById("heroServiceTag").innerText = data.service || "Tibbiy Ko'rik";

  if (heroBanner) heroBanner.style.display = "block";

  if (heroCard) {
    heroCard.classList.remove("active-pulse");
    void heroCard.offsetWidth;
    heroCard.classList.add("active-pulse");
  }

  // 1. Audio Gong (Ding-Dong) chalinadi
  playChime();

  // 2. O'zbek tilida F.I.Sh va Xona raqami o'qiladi
  speakUzbekAnnouncement(data);

  // Xonalarni qayta chizish
  renderRoomsGrid();

  // 35 soniyadan so'ng katta banner yopiladi
  if (activeCallTimer) clearTimeout(activeCallTimer);
  activeCallTimer = setTimeout(() => {
    if (heroBanner) heroBanner.style.display = "none";
  }, 35000);
}

// 5. XONALAR VA NAVBAT JADVALINI CHIZISH
function renderRoomsGrid() {
  const container = document.getElementById("roomsGrid");
  if (!container) return;

  if (allDoctors.length === 0) {
    container.innerHTML = `<div style="color:#64748b; font-size:18px; text-align:center; grid-column:1/-1;">Vrachlar ro'yxati yuklanmoqda...</div>`;
    return;
  }

  container.innerHTML = allDoctors.map(doctor => {
    // Ushbu vrachga tegishli bemorlar
    const docPatients = allPatients.filter(p => p.doctorId === doctor.id);
    
    // Qabuldagi bemor
    const servingPatient = docPatients.find(p => p.status === "calling" || p.status === "in_progress");
    const isCalling = servingPatient && servingPatient.status === "calling";

    // Navbatda kutayotgan bemorlar
    const waitingPatients = docPatients.filter(p => p.status === "waiting");

    return `
      <div class="room-card ${isCalling ? 'is-active-calling' : ''}" style="border-top: 5px solid ${doctor.color || '#0284c7'};">
        
        <div class="room-top">
          <div>
            <div class="room-badge-name">${escapeHtml(doctor.room)}</div>
            <div class="room-subtext">${escapeHtml(doctor.name)} • ${escapeHtml(doctor.specialty)}</div>
          </div>
          <div class="room-queue-pill">
            ${waitingPatients.length} ta navbatda
          </div>
        </div>

        <!-- QABULDAGI BEMOR -->
        <div class="serving-box">
          <div class="serving-status-title ${servingPatient ? (isCalling ? 'status-calling' : 'status-inprogress') : 'status-empty'}">
            <span>●</span> ${servingPatient ? (isCalling ? '📢 CHAQIRILMOQDA...' : '▶️ QABULDA') : 'XONA BO\'SH'}
          </div>
          <div class="serving-name-main">
            ${servingPatient ? escapeHtml(servingPatient.patientName) : '<span style="color:#64748b; font-size:18px; font-weight:600; font-style:italic;">Navbat kutilmoqda</span>'}
          </div>
          ${servingPatient ? `
            <div class="serving-details">
              ${escapeHtml(servingPatient.service || 'Ko\'rik')} ${servingPatient.isContrast ? '<b style="color:#ef4444;">(KONTRAST)</b>' : ''} • ${servingPatient.calledAtStr || ''}
            </div>
          ` : ''}
        </div>

        <!-- KUTAYOTGAN NAVBATDAGI BEMORLAR (1-2 ta) -->
        <div class="waiting-list-section">
          <div class="waiting-title">KEYINGI BEMORLAR:</div>
          <div class="waiting-chips">
            ${waitingPatients.length > 0 ? waitingPatients.slice(0, 3).map((wp, idx) => `
              <div class="waiting-chip">
                <div><span class="chip-order">${idx + 1}.</span> ${escapeHtml(wp.patientName)}</div>
                <span class="chip-time">${wp.createdAtStr || ''}</span>
              </div>
            `).join('') : '<div style="color:#64748b; font-size:12px; font-style:italic;">Kutayotgan bemorlar yo\'q</div>'}
          </div>
        </div>

      </div>
    `;
  }).join("");
}

// 6. AUDIO UNLOCK VA GONG CHIME (100% OFFLINE SYNTHESIS)
function initAudio() {
  document.addEventListener("click", unlockAudio, { once: true });
}

function unlockAudio() {
  isAudioUnlocked = true;
  const overlay = document.getElementById("audioOverlay");
  if (overlay) overlay.style.display = "none";

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }
      playChime();
    }
  } catch (e) {}
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = audioContext || new AudioCtx();
    const now = ctx.currentTime;

    // Chime ohangi: E5 -> C5 -> G4 (Klassik garmonik gong)
    playTone(ctx, 659.25, now, 0.45);
    playTone(ctx, 523.25, now + 0.35, 0.45);
    playTone(ctx, 392.00, now + 0.70, 0.75);
  } catch (err) {}
}

function playTone(ctx, freq, startTime, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.35, startTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// 7. O'ZBEK TILI XONA NOMLARI VA OVOZLI E'LON (TTS)
function formatRoomForSpeech(roomStr) {
  if (!roomStr) return "qabul xonasi";
  let r = roomStr.trim();
  r = r.replace(/101-?xona/i, "bir yuz birinchi xona")
       .replace(/102-?xona/i, "bir yuz ikkinchi xona")
       .replace(/103-?xona/i, "bir yuz uchinchi xona")
       .replace(/104-?xona/i, "bir yuz to'rtinchi xona")
       .replace(/1-?MRT\s*Xonasi/i, "birinchi MRT xonasi")
       .replace(/2-?MRT\s*Xonasi/i, "ikkinchi MRT xonasi")
       .replace(/1-?MSKT\s*Xonasi/i, "birinchi MSKT xonasi")
       .replace(/2-?MSKT\s*Xonasi/i, "ikkinchi MSKT xonasi")
       .replace(/Rentgen\s*Xonasi/i, "Rentgen xonasi")
       .replace(/^1-?xona/i, "birinchi xona")
       .replace(/^2-?xona/i, "ikkinchi xona")
       .replace(/^3-?xona/i, "uchinchi xona");
  
  return r;
}

function speakUzbekAnnouncement(data) {
  if (!('speechSynthesis' in window)) return;

  setTimeout(() => {
    try {
      window.speechSynthesis.cancel();

      const patientName = (data.patientName || "Bemor").trim();
      const roomSpeech = formatRoomForSpeech(data.room || data.doctorName);
      
      // Aniq, rasmiy va ravon o'zbekcha matn
      const speechText = `Diqqat! Bemor ${patientName}, ${roomSpeech} qabuliga kiring.`;

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = "uz-UZ";
      utterance.rate = 0.86;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const uzVoice = voices.find(v => v.lang === "uz-UZ" || v.lang.startsWith("uz") || (v.name && v.name.toLowerCase().includes("uzbek")));
      const trVoice = voices.find(v => v.lang === "tr-TR" || v.lang.startsWith("tr"));
      const ruVoice = voices.find(v => v.lang === "ru-RU" || v.lang.startsWith("ru"));

      if (uzVoice) {
        utterance.voice = uzVoice;
        utterance.lang = uzVoice.lang || "uz-UZ";
      } else if (trVoice) {
        utterance.voice = trVoice;
        utterance.lang = "tr-TR";
      } else if (ruVoice) {
        utterance.voice = ruVoice;
        utterance.lang = "ru-RU";
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("speakUzbekAnnouncement error:", err);
    }
  }, 1100);
}

// 8. ANDROID TV PULTI TUGMALARI (D-PAD / REMOTE CONTROL)
function initRemoteKeys() {
  document.addEventListener("keydown", (e) => {
    // OK / Enter tugmasi bosilganda ovozni ochish
    if (e.key === "Enter" || e.keyCode === 13) {
      if (!isAudioUnlocked) unlockAudio();
    }
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
