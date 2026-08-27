/**
 * UTT TV SISTEM — TV DISPLAY LOGIC (Split: Chapda Navbat, O'ngda Tekshiruv Ma'lumoti)
 * 100% Offline (WebSocket + Audio Chime + Multi-language Voice Synthesis)
 */

let currentLang = "uz";
let allPatients = [];
let allDoctors = [];
let selectedRoomFilter = "ALL";
let lastAnnouncementTimestamp = 0;
let isAudioUnlocked = false;
let audioContext = null;
let activeCallTimer = null;
let ws = null;

// SLAYDSHOU O'ZGARUVCHILARI
let currentSlideIdx = 0;
let slideProgressTimer = null;
const SLIDE_DURATION_SEC = 18; // Har bir ma'lumot 18 soniya turadi
let slideRemainingSec = SLIDE_DURATION_SEC;

document.addEventListener("DOMContentLoaded", () => {
  initClockAndDate();
  initAudio();
  initGuidelinesSlideshow();
  fetchInitialState();
  initWebSocket();
  initRemoteKeys();
  applyLanguage(currentLang);
});

// 1. TILNI QO'LLASH (ADMIN PANEL TARAFIIDAN YUBORILGANDA AVTOMATIK O'ZGARADI)
function applyLanguage(lang) {
  if (!I18N[lang]) lang = "uz";
  currentLang = lang;
  const dict = I18N[lang] || I18N.uz;

  const thNum = document.getElementById("thNum");
  const thName = document.getElementById("thName");
  const thStatus = document.getElementById("thStatus");

  if (thNum) thNum.innerText = dict.thNum;
  if (thName) thName.innerText = dict.thName;
  if (thStatus) thStatus.innerText = dict.thStatus;

  const infoHeader = document.getElementById("infoBoxHeader");
  if (infoHeader && dict.infoBoxHeader) infoHeader.innerText = dict.infoBoxHeader;

  const mTitle = document.getElementById("audioModalTitle");
  const mText = document.getElementById("audioModalText");
  const mBtn = document.getElementById("audioModalBtn");

  if (mTitle) mTitle.innerText = dict.audioModalTitle;
  if (mText) mText.innerHTML = dict.audioModalText;
  if (mBtn) mBtn.innerText = dict.audioModalBtn;

  const ticker = document.getElementById("bottomMarqueeText");
  if (ticker) ticker.innerText = dict.ticker;

  const heroBadge = document.getElementById("heroCallBadgeText");
  if (heroBadge) heroBadge.innerText = dict.nowCalling;

  renderHeaderAndQueueTable();
  renderCurrentSlide();
  updateClockAndDate();
}

// 2. VAQT VA SANA
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

let serverGuidelines = [];

function getActiveSlides() {
  const activeFromServer = serverGuidelines.filter(g => g.isActive !== false);
  if (activeFromServer.length > 0) return activeFromServer;

  const dict = I18N[currentLang] || I18N.uz;
  return dict.guidelines || [];
}

// 3. TEKSHIRUVLAR HAQIDA MA'LUMOT SLAYDSHOUSI (O'NG TOMON)
function initGuidelinesSlideshow() {
  currentSlideIdx = 0;
  slideRemainingSec = SLIDE_DURATION_SEC;
  renderCurrentSlide();

  if (slideProgressTimer) clearInterval(slideProgressTimer);

  slideProgressTimer = setInterval(() => {
    slideRemainingSec--;
    const progressPercent = ((SLIDE_DURATION_SEC - slideRemainingSec) / SLIDE_DURATION_SEC) * 100;
    const barEl = document.getElementById("slideProgressBar");
    if (barEl) barEl.style.width = `${progressPercent}%`;

    if (slideRemainingSec <= 0) {
      slideRemainingSec = SLIDE_DURATION_SEC;
      const slides = getActiveSlides();
      if (slides.length > 0) {
        currentSlideIdx = (currentSlideIdx + 1) % slides.length;
        renderCurrentSlide();
      }
    }
  }, 1000);
}

function renderCurrentSlide() {
  const slides = getActiveSlides();
  if (slides.length === 0) return;

  if (currentSlideIdx >= slides.length) currentSlideIdx = 0;
  const slide = slides[currentSlideIdx];

  const indicator = document.getElementById("slideIndicator");
  const iconEl = document.getElementById("infoServiceIcon");
  const titleEl = document.getElementById("infoServiceTitle");
  const pointsEl = document.getElementById("infoPointsList");
  const barEl = document.getElementById("slideProgressBar");
  const mediaWrap = document.getElementById("infoMediaWrap");
  const imgEl = document.getElementById("infoSlideImg");
  const videoEl = document.getElementById("infoSlideVideo");

  if (indicator) indicator.innerText = `${currentSlideIdx + 1} / ${slides.length}`;
  if (iconEl) iconEl.innerText = slide.icon || "ℹ️";

  // Tilga moslashtirish
  let title = slide.title || "Tekshiruv";
  let points = slide.points || [];

  if (currentLang === "ru") {
    if (slide.title_ru) title = slide.title_ru;
    if (slide.points_ru && slide.points_ru.length > 0) points = slide.points_ru;
  } else if (currentLang === "en") {
    if (slide.title_en) title = slide.title_en;
    if (slide.points_en && slide.points_en.length > 0) points = slide.points_en;
  }

  if (titleEl) titleEl.innerText = title;
  if (barEl) barEl.style.width = "0%";

  // Media (Rasm yoki Video)
  if (mediaWrap) {
    if (slide.video) {
      mediaWrap.style.display = "block";
      if (videoEl) {
        videoEl.style.display = "block";
        videoEl.src = slide.video;
      }
      if (imgEl) imgEl.style.display = "none";
    } else if (slide.image) {
      mediaWrap.style.display = "block";
      if (imgEl) {
        imgEl.style.display = "block";
        imgEl.src = slide.image;
      }
      if (videoEl) videoEl.style.display = "none";
    } else {
      mediaWrap.style.display = "none";
    }
  }

  if (pointsEl) {
    pointsEl.innerHTML = points.map(pt => `
      <div class="info-point-item">
        <span class="point-dot"></span>
        <span>${escapeHtml(pt)}</span>
      </div>
    `).join("");
  }
}

// 4. BOSHLANG'ICH MA'LUMOTLARNI YUKLASH
async function fetchInitialState() {
  try {
    const infoRes = await fetch("/api/info");
    const infoData = await infoRes.json();
    if (infoData.settings) {
      if (infoData.settings.activeLang) currentLang = infoData.settings.activeLang;
      if (infoData.settings.activeRoomId) selectedRoomFilter = infoData.settings.activeRoomId;
    }

    const guideRes = await fetch("/api/guidelines");
    if (guideRes.ok) {
      serverGuidelines = await guideRes.json();
    }

    const docRes = await fetch("/api/doctors");
    allDoctors = await docRes.json();

    const qRes = await fetch("/api/queue");
    const qData = await qRes.json();

    allPatients = qData.patients || [];
    applyLanguage(currentLang);
    renderCurrentSlide();

    if (qData.current_announcement && qData.current_announcement.timestamp > lastAnnouncementTimestamp) {
      lastAnnouncementTimestamp = qData.current_announcement.timestamp;
      handleCallingAnnouncement(qData.current_announcement);
    }
  } catch (err) {
    console.warn("fetchInitialState error:", err.message);
  }
}

let myDeviceId = localStorage.getItem("utt_tv_device_id");
if (!myDeviceId) {
  myDeviceId = `TV_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  localStorage.setItem("utt_tv_device_id", myDeviceId);
}
const isInsideIframe = window.self !== window.top || window.location.search.includes("preview=1");

// 5. WEBSOCKET SYNC
function initWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${location.host}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("✅ TV WebSocket serverga ulandi");
      ws.send(JSON.stringify({
        type: "CLIENT_IDENTIFY",
        data: {
          clientType: "tv",
          deviceId: myDeviceId,
          isPreview: isInsideIframe,
          name: `📺 TV Monitor [${myDeviceId}] (${location.hostname})`
        }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWebSocketMessage(msg);
      } catch (e) {}
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 4000);
    };

    ws.onerror = () => {};
  } catch (err) {
    setTimeout(initWebSocket, 5000);
  }
}

function handleWebSocketMessage(msg) {
  if (msg.type === "INITIAL_STATE") {
    allDoctors = msg.data.doctors || [];
    allPatients = msg.data.queue.patients || [];
    if (msg.data.isApproved === false && !isInsideIframe) {
      showApprovalOverlay(myDeviceId);
    } else {
      hideApprovalOverlay();
    }
    if (msg.data.settings) {
      if (msg.data.settings.activeLang) currentLang = msg.data.settings.activeLang;
      if (msg.data.settings.activeRoomId) selectedRoomFilter = msg.data.settings.activeRoomId;
    }
    applyLanguage(currentLang);
  } else if (msg.type === "DEVICE_PENDING_APPROVAL") {
    if (!isInsideIframe) showApprovalOverlay(msg.data.deviceId || myDeviceId);
  } else if (msg.type === "DEVICE_APPROVED") {
    hideApprovalOverlay();
  } else if (msg.type === "DEVICE_REJECTED") {
    showRejectedOverlay(msg.message);
  }
  } else if (msg.type === "TV_CONFIG_CHANGED") {
    if (msg.data.activeLang && msg.data.activeLang !== currentLang) {
      applyLanguage(msg.data.activeLang);
    }
    if (msg.data.activeRoomId !== undefined) {
      selectedRoomFilter = msg.data.activeRoomId;
    }
    if (msg.data.customRoom !== undefined) {
      customRoomName = msg.data.customRoom;
    }
    if (msg.data.customDoctor !== undefined) {
      customDoctorName = msg.data.customDoctor;
    }
    renderHeaderAndQueueTable();
    if (msg.data.tickerText) {
      const ticker = document.getElementById("bottomMarqueeText");
      if (ticker) ticker.innerText = msg.data.tickerText;
    }
  } else if (msg.type === "QUEUE_UPDATED") {
    allPatients = msg.data.patients || [];
    renderHeaderAndQueueTable();
  } else if (msg.type === "DOCTORS_UPDATED") {
    allDoctors = msg.data || [];
    renderHeaderAndQueueTable();
  } else if (msg.type === "GUIDELINES_UPDATED") {
    serverGuidelines = msg.data || [];
    renderCurrentSlide();
  } else if (msg.type === "CALL_ANNOUNCEMENT") {
    handleCallingAnnouncement(msg.data);
  } else if (msg.type === "FORCE_CLOSE_WINDOW") {
    document.body.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#020617; color:#ffffff; font-family:sans-serif; text-align:center; padding:30px; box-sizing:border-box;">
        <div style="font-size:80px; margin-bottom:20px;">🔒</div>
        <h1 style="font-size:36px; font-weight:900; color:#ef4444; margin-bottom:14px; text-transform:uppercase; letter-spacing:1px;">
          OYNA ADMIN TOMONIDAN YOPILDI
        </h1>
        <p style="font-size:20px; color:#94a3b8; max-width:600px; line-height:1.5; margin-bottom:24px;">
          ${escapeHtml(msg.message || "Ushbu TV monitoriga ruxsat to'xtatildi yoki admin tomonidan masofadan yopildi.")}
        </p>
        <div style="font-size:14px; color:#64748b; background:#0f172a; padding:10px 20px; border-radius:10px; border:1px solid #1e293b;">
          Agar bu xatolik bo'lsa, markaziy administratorga murojaat qiling.
        </div>
      </div>
    `;
    setTimeout(() => {
      try { window.close(); } catch(e) {}
    }, 2000);
  }
}

let customRoomName = "";
let customDoctorName = "";

// 6. SARLAVHA VA JADVALNI CHIZISH (3 TA USTUN: №, BEMOR F.I.SH, HOLATI)
function renderHeaderAndQueueTable() {
  const dict = I18N[currentLang] || I18N.uz;
  const headerTitle = document.getElementById("mainHeaderRoomTitle");
  const doctorSub = document.getElementById("mainHeaderDoctorSub");
  const tbody = document.getElementById("queueTableBody");

  if (customRoomName || customDoctorName) {
    if (headerTitle && customRoomName) headerTitle.innerText = customRoomName.toUpperCase();
    if (doctorSub && customDoctorName) doctorSub.innerText = customDoctorName;
  } else if (selectedRoomFilter !== "ALL") {
    const doc = allDoctors.find(d => d.id === selectedRoomFilter);
    if (doc) {
      if (headerTitle) headerTitle.innerText = doc.room.toUpperCase();
      if (doctorSub) doctorSub.innerText = `${(doc.specialty || 'ULTRATOVUSH').toUpperCase()} -- ${doc.name}`;
    }
  } else {
    if (allDoctors.length > 0) {
      const firstDoc = allDoctors[0];
      if (headerTitle) headerTitle.innerText = "🏢 BARCHA XONALAR MONITORI";
      if (doctorSub) doctorSub.innerText = "RADIOLOGIYA VA ULTRATOVUSH DIAGNOSTIKASI BO'LIMI";
    } else {
      if (headerTitle) headerTitle.innerText = "UTT 1 - 53 XONA";
      if (doctorSub) doctorSub.innerText = "ULTRATOVUSH -- 1 -- Juravlev Igor Ivanovich";
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
        <td colspan="3" style="text-align: center; padding: 40px; color: #64748b; font-size: 18px;">
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

  playChime();
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

// 9. 6 TA TILDA OVOZLI E'LON
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
      let targetVoice = voices.find(v => v.lang === dict.langVoice || v.lang.startsWith(dict.code));
      if (!targetVoice && (lang === "kz" || lang === "tg" || lang === "uz")) {
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

// 10. TV REMOTE KEYS
function initRemoteKeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.keyCode === 13) {
      if (!isAudioUnlocked) unlockAudio();
    }
  });
}

// 11. TASDIQLASH VA RUXSAT OVERLAYLARI
function showApprovalOverlay(deviceId) {
  let el = document.getElementById("tvApprovalOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "tvApprovalOverlay";
    el.className = "tv-approval-overlay";
    document.body.appendChild(el);
  }
  el.style.display = "flex";
  el.innerHTML = `
    <div class="approval-card">
      <div class="approval-icon">⏳</div>
      <h2 style="font-size:32px; font-weight:900; color:#38bdf8; margin:0 0 10px 0; letter-spacing:0.5px;">
        ADMINISTRATOR TASDIQLASHI KUTILMOQDA
      </h2>
      <p style="font-size:18px; color:#cbd5e1; margin:0 0 20px 0; line-height:1.5;">
        Ushbu TV monitori ulanishi xavfsizlik maqsadida administrator tasdiqlashini kutmoqda.
      </p>
      <div style="background:#0f172a; border:2px solid #0284c7; padding:12px 24px; border-radius:12px; font-size:22px; color:#facc15; font-weight:900; margin-bottom:20px;">
        Qurilma ID: <span style="color:#ffffff;">${escapeHtml(deviceId)}</span>
      </div>
      <div style="font-size:15px; color:#94a3b8;">
        ⚙️ Admin paneldan [ <b>✅ Ruxsat Berish</b> ] tugmasini bosing
      </div>
    </div>
  `;
}

function hideApprovalOverlay() {
  const el = document.getElementById("tvApprovalOverlay");
  if (el) el.style.display = "none";
}

function showRejectedOverlay(msg) {
  let el = document.getElementById("tvApprovalOverlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "tvApprovalOverlay";
    el.className = "tv-approval-overlay";
    document.body.appendChild(el);
  }
  el.style.display = "flex";
  el.innerHTML = `
    <div class="approval-card" style="border-color:#ef4444;">
      <div class="approval-icon" style="color:#ef4444;">🚫</div>
      <h2 style="font-size:32px; font-weight:900; color:#ef4444; margin:0 0 10px 0;">
        ULANISH RAD ETILDI
      </h2>
      <p style="font-size:18px; color:#cbd5e1; margin:0 0 20px 0;">
        ${escapeHtml(msg || "Ushbu qurilma administrator tomonidan rad etildi.")}
      </p>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.unlockAudio = unlockAudio;
