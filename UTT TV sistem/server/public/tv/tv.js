/**
 * UTT TV SISTEM — TV DISPLAY LOGIC (Light Medical Theme)
 * 100% Offline (WebSocket + Audio Chime + Uzbek Voice Synthesis)
 */

let allPatients = [];
let allDoctors = [];
let selectedRoomFilter = "ALL";
let lastAnnouncementTimestamp = 0;
let isAudioUnlocked = false;
let audioContext = null;
let activeCallTimer = null;
let ws = null;

const UZBEK_WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const UZBEK_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];

document.addEventListener("DOMContentLoaded", () => {
  initClockAndDate();
  initAudio();
  fetchInitialState();
  initWebSocket();
  initRemoteKeys();
});

// 1. VAQT VA O'ZBEKCHA SANA (Format: Payshanba 27 Avgust 2026)
function initClockAndDate() {
  function update() {
    const now = new Date();
    const clockEl = document.getElementById("tvClockStr");
    const dateEl = document.getElementById("tvDateStr");

    if (clockEl) {
      clockEl.innerText = now.toLocaleTimeString("uz-UZ", { hour12: false });
    }

    if (dateEl) {
      const dayName = UZBEK_WEEKDAYS[now.getDay()];
      const dayNum = now.getDate();
      const monthName = UZBEK_MONTHS[now.getMonth()];
      const year = now.getFullYear();
      dateEl.innerText = `${dayName} ${dayNum} ${monthName} ${year}`;
    }
  }
  update();
  setInterval(update, 1000);
}

// 2. BOSHLANG'ICH MA'LUMOTLARNI YUKLASH
async function fetchInitialState() {
  try {
    const docRes = await fetch("/api/doctors");
    allDoctors = await docRes.json();
    populateRoomFilterDropdown();

    const qRes = await fetch("/api/queue");
    const qData = await qRes.json();

    allPatients = qData.patients || [];
    renderHeaderAndQueueTable();

    if (qData.current_announcement && qData.current_announcement.timestamp > lastAnnouncementTimestamp) {
      lastAnnouncementTimestamp = qData.current_announcement.timestamp;
      handleCallingAnnouncement(qData.current_announcement);
    }
  } catch (err) {
    console.warn("fetchInitialState error:", err.message);
  }
}

// 3. WEBSOCKET SYNC
function initWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${location.host}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("✅ TV WebSocket serverga ulandi");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWebSocketMessage(msg);
      } catch (e) {}
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = () => {};
  } catch (err) {
    setTimeout(initWebSocket, 4000);
  }

  // Backup polling
  setInterval(() => {
    if (!ws || ws.readyState !== 1) {
      fetchInitialState();
    }
  }, 5000);
}

function handleWebSocketMessage(msg) {
  if (msg.type === "INITIAL_STATE") {
    allDoctors = msg.data.doctors || [];
    allPatients = msg.data.queue.patients || [];
    populateRoomFilterDropdown();
    renderHeaderAndQueueTable();
  } else if (msg.type === "QUEUE_UPDATED") {
    allPatients = msg.data.patients || [];
    renderHeaderAndQueueTable();
  } else if (msg.type === "DOCTORS_UPDATED") {
    allDoctors = msg.data || [];
    populateRoomFilterDropdown();
    renderHeaderAndQueueTable();
  } else if (msg.type === "CALL_ANNOUNCEMENT") {
    handleCallingAnnouncement(msg.data);
  }
}

// 4. ROOM FILTER DROPDOWN
function populateRoomFilterDropdown() {
  const select = document.getElementById("roomFilterSelect");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="ALL">🏢 Barcha Xonalar Monitori</option>`;

  allDoctors.forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc.id;
    opt.innerText = `${doc.room} (${doc.name})`;
    select.appendChild(opt);
  });

  select.value = currentVal || "ALL";
}

function handleRoomChange(val) {
  selectedRoomFilter = val;
  renderHeaderAndQueueTable();
}

// 5. SARLAVHA VA NAVBAT JADVALINI CHIZISH
function renderHeaderAndQueueTable() {
  const headerTitle = document.getElementById("mainHeaderRoomTitle");
  const doctorSub = document.getElementById("mainHeaderDoctorSub");
  const tbody = document.getElementById("queueTableBody");

  // A) Sarlavhani sozlash
  if (selectedRoomFilter !== "ALL") {
    const doc = allDoctors.find(d => d.id === selectedRoomFilter);
    if (doc) {
      headerTitle.innerText = doc.room.toUpperCase();
      doctorSub.innerText = `${doc.specialty.toUpperCase()} -- ${doc.name}`;
    }
  } else {
    // Agar xona tanlanmagan bo'lsa yoki default
    if (allDoctors.length > 0) {
      const firstDoc = allDoctors[0];
      headerTitle.innerText = firstDoc.room.toUpperCase();
      doctorSub.innerText = `${firstDoc.specialty.toUpperCase()} -- ${firstDoc.name}`;
    } else {
      headerTitle.innerText = "UTT8-48 XONA";
      doctorSub.innerText = "ULTRATOVUSH --5 Xoshimova Lola Kabulova";
    }
  }

  // B) Bemorlar ro'yxatini filtrlash
  let patientsToShow = allPatients;
  if (selectedRoomFilter !== "ALL") {
    patientsToShow = allPatients.filter(p => p.doctorId === selectedRoomFilter);
  }

  if (!tbody) return;

  if (patientsToShow.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: #64748b; font-size: 20px;">
          Hozirda navbatda kutayotgan bemorlar yo'q
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = patientsToShow.map((p, idx) => {
    const isCalling = p.status === "calling";
    const isInProgress = p.status === "in_progress";

    let statusText = "KUTILMOQDA";
    let statusClass = "waiting";

    if (isCalling) {
      statusText = "📢 CHAQIRILMOQDA";
      statusClass = "calling";
    } else if (isInProgress) {
      statusText = "▶️ QABULDA";
      statusClass = "inprogress";
    }

    return `
      <tr class="${isCalling ? 'is-calling-row' : ''}">
        <td style="text-align: center;">
          <div class="order-num-circle">${idx + 1}</div>
        </td>
        <td>
          <div class="patient-name-text">${escapeHtml(p.patientName)}</div>
          <div class="patient-sub-service">${escapeHtml(p.service || 'Ko\'rik')} ${p.isContrast ? '<b style="color:#ef4444;">(KONTRAST)</b>' : ''}</div>
        </td>
        <td>
          <div class="room-badge-pill">${escapeHtml(p.room || 'Qabul xonasi')}</div>
          <div style="font-size: 13px; color: #64748b; margin-top: 3px;">${escapeHtml(p.doctorName || '')}</div>
        </td>
        <td style="text-align: center;">
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
      </tr>
    `;
  }).join("");
}

// 6. CHAQIRUV BO'LGANDA (HERO BANNER + AUDIO CHIME + O'ZBEKCHA OVOZ)
function handleCallingAnnouncement(data) {
  if (!data || !data.patientName) return;

  const heroSection = document.getElementById("servingHeroSection");
  const heroCard = document.getElementById("servingHeroCard");

  document.getElementById("heroPatientName").innerText = data.patientName.toUpperCase();
  document.getElementById("heroRoomText").innerText = data.room || "Qabul xonasi";
  document.getElementById("heroDoctorText").innerText = data.doctorName || "Shifokor";

  // Agar chaqirilgan xona bo'lsa, sarlavhani ham o'sha xonaga moslash
  document.getElementById("mainHeaderRoomTitle").innerText = (data.room || "UTT8-48 XONA").toUpperCase();
  document.getElementById("mainHeaderDoctorSub").innerText = `${(data.service || 'ULTRATOVUSH').toUpperCase()} -- ${data.doctorName || 'Shifokor'}`;

  if (heroSection) heroSection.style.display = "block";

  if (heroCard) {
    heroCard.classList.remove("active-pulse");
    void heroCard.offsetWidth;
    heroCard.classList.add("active-pulse");
  }

  // 1. Audio Gong (Ding-Dong)
  playChime();

  // 2. O'zbek tilida F.I.Sh va Xona raqami o'qiladi
  speakUzbekAnnouncement(data);

  renderHeaderAndQueueTable();

  // 35 soniyadan so'ng hero banner yashiriladi
  if (activeCallTimer) clearTimeout(activeCallTimer);
  activeCallTimer = setTimeout(() => {
    if (heroSection) heroSection.style.display = "none";
  }, 35000);
}

// 7. GONG CHIME (100% OFFLINE)
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

// 8. O'ZBEK TILI TALAFUZ VA OVOZLI E'LON
function formatRoomForSpeech(roomStr) {
  if (!roomStr) return "qabul xonasi";
  let r = roomStr.trim();
  r = r.replace(/UTT8-?48\s*XONA/i, "qirq sakkizinchi xona")
       .replace(/48-?xona/i, "qirq sakkizinchi xona")
       .replace(/101-?xona/i, "bir yuz birinchi xona")
       .replace(/102-?xona/i, "bir yuz ikkinchi xona")
       .replace(/1-?MRT\s*Xonasi/i, "birinchi MRT xonasi")
       .replace(/1-?MSKT\s*Xonasi/i, "birinchi MSKT xonasi");
  
  return r;
}

function speakUzbekAnnouncement(data) {
  if (!('speechSynthesis' in window)) return;

  setTimeout(() => {
    try {
      window.speechSynthesis.cancel();

      const patientName = (data.patientName || "Bemor").trim();
      const roomSpeech = formatRoomForSpeech(data.room || data.doctorName);
      
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

// 9. TV REMOTE PULT TUGMASI (ENTER / OK)
function initRemoteKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.keyCode === 13) {
      if (!isAudioUnlocked) unlockAudio();
    }
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.handleRoomChange = handleRoomChange;
window.unlockAudio = unlockAudio;
