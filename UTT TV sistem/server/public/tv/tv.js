/**
 * UTT TV SISTEM — TV DISPLAY LOGIC (6 Ta Tilda: UZ, RU, EN, TR, KZ, TG)
 * 100% Offline (WebSocket + Multi-language Audio Chime + Voice Synthesis)
 */

let currentLang = "uz";
let allPatients = [];
let allDoctors = [];
let selectedRoomFilter = "ALL";
let lastAnnouncementTimestamp = 0;
let isAudioUnlocked = false;
let audioContext = null;
let activeCallTimer = null;
let langRotationTimer = null;
let ws = null;

document.addEventListener("DOMContentLoaded", () => {
  initClockAndDate();
  initAudio();
  fetchInitialState();
  initWebSocket();
  initRemoteKeys();
  applyLanguage(currentLang);
});

// 1. TILNI O'ZGARTIRISH (6 TA TIL)
function setLanguage(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  applyLanguage(lang);
}

function applyLanguage(lang) {
  const dict = I18N[lang] || I18N.uz;

  // Tugmalarni aktivlashtirish
  document.querySelectorAll(".lang-btn").forEach(btn => {
    if (btn.dataset.lang === lang) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Jadval sarlavhalari
  const thNum = document.getElementById("thNum");
  const thName = document.getElementById("thName");
  const thRoom = document.getElementById("thRoom");
  const thStatus = document.getElementById("thStatus");

  if (thNum) thNum.innerText = dict.thNum;
  if (thName) thName.innerText = dict.thName;
  if (thRoom) thRoom.innerText = dict.thRoom;
  if (thStatus) thStatus.innerText = dict.thStatus;

  // Modal oynasi
  const mTitle = document.getElementById("audioModalTitle");
  const mText = document.getElementById("audioModalText");
  const mBtn = document.getElementById("audioModalBtn");

  if (mTitle) mTitle.innerText = dict.audioModalTitle;
  if (mText) mText.innerHTML = dict.audioModalText;
  if (mBtn) mBtn.innerText = dict.audioModalBtn;

  // Pastki yuguruvchi satr
  const ticker = document.getElementById("bottomMarqueeText");
  if (ticker) ticker.innerText = dict.ticker;

  // Chaqiruv kartasi badge
  const heroBadge = document.getElementById("heroCallBadgeText");
  if (heroBadge) heroBadge.innerText = dict.nowCalling;

  // Jadval va sarlavhalarni qayta chizish
  populateRoomFilterDropdown();
  renderHeaderAndQueueTable();
  updateClockAndDate();
}

// 2. VAQT VA SANA (Tanlangan tilda)
function initClockAndDate() {
  updateClockAndDate();
  setInterval(updateClockAndDate, 1000);
}

function updateClockAndDate() {
  const now = new Date();
  const clockEl = document.getElementById("tvClockStr");
  const dateEl = document.getElementById("tvDateStr");
  const dict = I18N[currentLang] || I18N.uz;

  if (clockEl) {
    clockEl.innerText = now.toLocaleTimeString("uz-UZ", { hour12: false });
  }

  if (dateEl) {
    const dayName = dict.weekdays[now.getDay()];
    const dayNum = now.getDate();
    const monthName = dict.months[now.getMonth()];
    const year = now.getFullYear();

    if (currentLang === "en") {
      dateEl.innerText = `${dayName}, ${monthName} ${dayNum}, ${year}`;
    } else {
      dateEl.innerText = `${dayName} ${dayNum} ${monthName} ${year}`;
    }
  }
}

// 3. BOSHLANG'ICH MA'LUMOTLARNI YUKLASH
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

// 4. WEBSOCKET SYNC
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

// 5. ROOM FILTER DROPDOWN
function populateRoomFilterDropdown() {
  const select = document.getElementById("roomFilterSelect");
  if (!select) return;

  const dict = I18N[currentLang] || I18N.uz;
  const currentVal = select.value;
  select.innerHTML = `<option value="ALL">${dict.allRoomsOption}</option>`;

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

// 6. SARLAVHA VA JADVALNI CHIZISH
function renderHeaderAndQueueTable() {
  const dict = I18N[currentLang] || I18N.uz;
  const headerTitle = document.getElementById("mainHeaderRoomTitle");
  const doctorSub = document.getElementById("mainHeaderDoctorSub");
  const tbody = document.getElementById("queueTableBody");

  if (selectedRoomFilter !== "ALL") {
    const doc = allDoctors.find(d => d.id === selectedRoomFilter);
    if (doc) {
      headerTitle.innerText = doc.room.toUpperCase();
      doctorSub.innerText = `${doc.specialty.toUpperCase()} -- ${doc.name}`;
    }
  } else {
    if (allDoctors.length > 0) {
      const firstDoc = allDoctors[0];
      headerTitle.innerText = firstDoc.room.toUpperCase();
      doctorSub.innerText = `${firstDoc.specialty.toUpperCase()} -- ${firstDoc.name}`;
    } else {
      headerTitle.innerText = "UTT8-48 XONA";
      doctorSub.innerText = "ULTRATOVUSH --5 Xoshimova Lola Kabulova";
    }
  }

  let patientsToShow = allPatients;
  if (selectedRoomFilter !== "ALL") {
    patientsToShow = allPatients.filter(p => p.doctorId === selectedRoomFilter);
  }

  if (!tbody) return;

  if (patientsToShow.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 40px; color: #64748b; font-size: 20px;">
          ${dict.emptyQueue}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = patientsToShow.map((p, idx) => {
    const isCalling = p.status === "calling";
    const isInProgress = p.status === "in_progress";

    let statusText = dict.statusWaiting;
    let statusClass = "waiting";

    if (isCalling) {
      statusText = dict.statusCalling;
      statusClass = "calling";
    } else if (isInProgress) {
      statusText = dict.statusInProgress;
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

// 7. CHAQIRUV E'LONI VA OVOZLI O'QISH
function handleCallingAnnouncement(data) {
  if (!data || !data.patientName) return;

  const dict = I18N[currentLang] || I18N.uz;
  const heroSection = document.getElementById("servingHeroSection");
  const heroCard = document.getElementById("servingHeroCard");

  document.getElementById("heroPatientName").innerText = data.patientName.toUpperCase();
  document.getElementById("heroRoomText").innerText = data.room || "Qabul xonasi";
  document.getElementById("heroDoctorText").innerText = data.doctorName || "Shifokor";
  document.getElementById("heroCallBadgeText").innerText = dict.nowCalling;

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

  // 2. Tanlangan tildagi ovozli e'lon (Uzbek, Rus, Ingliz, Turk, Qozoq, Tojik)
  speakMultilingualAnnouncement(data, currentLang);

  renderHeaderAndQueueTable();

  if (activeCallTimer) clearTimeout(activeCallTimer);
  activeCallTimer = setTimeout(() => {
    if (heroSection) heroSection.style.display = "none";
  }, 35000);
}

// 8. AUDIO CHIME (100% OFFLINE)
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

// 9. 6 TA TILDA OVOZLI E'LON (TTS)
function speakMultilingualAnnouncement(data, lang) {
  if (!('speechSynthesis' in window)) return;

  const dict = I18N[lang] || I18N.uz;

  setTimeout(() => {
    try {
      window.speechSynthesis.cancel();

      const patientName = (data.patientName || "Bemor").trim();
      const roomSpeech = dict.formatRoomSpeech ? dict.formatRoomSpeech(data.room || data.doctorName) : (data.room || "xona");
      const speechText = dict.formatSpeech(patientName, roomSpeech);

      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = dict.langVoice || "uz-UZ";
      utterance.rate = 0.88;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      
      // Mos til ovozini qidirish
      let targetVoice = voices.find(v => v.lang === dict.langVoice || v.lang.startsWith(dict.code));
      if (!targetVoice && (lang === "kz" || lang === "tg" || lang === "uz")) {
        // Fallback qardosh tillar
        targetVoice = voices.find(v => v.lang === "tr-TR" || v.lang === "ru-RU" || v.lang.startsWith("tr") || v.lang.startsWith("ru"));
      }

      if (targetVoice) {
        utterance.voice = targetVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("speakMultilingualAnnouncement error:", err);
    }
  }, 1100);
}

// 10. TV REMOTE PULT
function initRemoteKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.keyCode === 13) {
      if (!isAudioUnlocked) unlockAudio();
    }
    // Raqamlar orqali tilni tez o'zgartirish (1: UZ, 2: RU, 3: EN, 4: TR, 5: KZ, 6: TG)
    const keyMap = { "1": "uz", "2": "ru", "3": "en", "4": "tr", "5": "kz", "6": "tg" };
    if (keyMap[e.key]) {
      setLanguage(keyMap[e.key]);
    }
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.setLanguage = setLanguage;
window.handleRoomChange = handleRoomChange;
window.unlockAudio = unlockAudio;
