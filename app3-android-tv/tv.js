/**
 * Android TV Navbat Monitori - MRT & MSKT Mantiqi
 */

let db = null;
let todayDateStr = "";
let allPatients = [];
let lastAnnouncementTimestamp = 0;
let isAudioUnlocked = false;
let audioContext = null;
let activeCallTimer = null;

// Preparation Guidelines Slideshow
let preparationSlides = [];
let currentSlideIdx = 0;
let slideProgressTimer = null;
const SLIDE_DURATION_SEC = 240; // Har bir tekshiruv tayyorgarligi 4 daqiqa (240 soniya) ekranda turadi
let slideRemainingSec = SLIDE_DURATION_SEC;

const DEFAULT_GUIDELINES = [
  {
    icon: "fa-syringe",
    title: "💉 Kontrastli MSKT Tekshiruvlari (Bosh miya, bo'yin, qorin)",
    points: [
      "Tekshiruvdan kamida 4–6 soat oldin ovqatlanmaslik (och qoringa kelish) talab etiladi.",
      "Qondagi kreatinin tahlili natijasi (oxirgi 1 oy ichida olingan) bo'lishi shart.",
      "Qandli diabeti bor va Metformin (Glyukofaj) qabul qiluvchi bemorlar shifokorga xabar berishi shart.",
      "Tekshiruvdan so'ng kontrast modda organizmdan tez chiqib ketishi uchun ko'proq gazsiz toza suv iching."
    ]
  },
  {
    icon: "fa-brain",
    title: "🧠 Bosh Miya va Umurtqa Pog'onasi MRT Tekshiruvi",
    points: [
      "MRT xonasiga kirishdan oldin barcha metall buyumlar, soat, kalit, tangalar, karta va telefonlarni topshiring.",
      "Tanada metall implant, kardiostimulyator yoki sun'iy klapan bo'lsa shifokorga oldindan ma'lum qiling.",
      "Tasvir sifati aniq chiqishi uchun tekshiruv vaqtida (15–25 daqiqa) mutlaqo qimirlamay yotish zarur.",
      "Xavotir yoki klostrofobiya (yopiq joydan qo'rqish) bo'lsa laborant-operatorga ayting."
    ]
  },
  {
    icon: "fa-lungs",
    title: "🫁 Ko'krak Qafasi va O'pka MSKT Tekshiruvi",
    points: [
      "Oddiy (kontrastsiz) o'pka MSKT tekshiruvi uchun maxsus och qolish talab qilinmaydi.",
      "Tekshiruv vaqtida laborant buyrug'iga binoan nafasni 10–15 soniyaga ushlab turish kerak.",
      "Oldingi rentgen yoki KT tasvirlari/xulosalari bo'lsa, qiyoslash uchun shifokorga taqdim eting."
    ]
  },
  {
    icon: "fa-apple-whole",
    title: "🍏 Qorin Bo'shlig'i va Kichik Chanoq MRT / MSKT",
    points: [
      "Tekshiruvdan 6 soat oldin ovqat yemaslik (och qoringa bo'lish) tavsiya etiladi.",
      "Tekshiruvdan 1 kun oldin gaz hosil qiluvchi mahsulotlar (dukkaklilar, xom sabzavotlar, gazli suvlar) yemang.",
      "Kichik chanoq a'zolari MRT tekshiruvi uchun siydik pufagi o'rtacha to'lgan bo'lishi maqsadga muvofiq."
    ]
  },
  {
    icon: "fa-bone",
    title: "🦴 Bo'g'imlar va Tayanch-Harakat Tizimi MRT (Tizza, Yelka, Tos)",
    points: [
      "Tekshiruv uchun och qolish yoki maxsus parhez talab qilinmaydi.",
      "Bo'g'imdagi fiksatorlar, metall bolt/plastinalar mavjudligi haqida laborantni ogohlantiring.",
      "Tekshirilayotgan qo'l yoki oyoqni qimirlatmasdan erkin holatda saqlang."
    ]
  },
  {
    icon: "fa-droplet",
    title: "🩸 Kontrastli MRT (Magnit-Rezonans Tomografiya)",
    points: [
      "Tekshiruvdan 3–4 soat oldin yengil taomlanish mumkin, ortiqcha to'yib ovqatlanmaslik tavsiya etiladi.",
      "Dori vositalariga allergik reaksiyalar yoki buyrak yetishmovchiligi bo'lsa shifokorga ayting.",
      "Tekshiruv tugagach, kun davomida 1.5–2 litr toza suv ichish kontrast chiqishini tezlashtiradi."
    ]
  }
];

const DEVICES = [
  { id: "mrt1", name: "MRT 1", room: "1-MRT Xonasi", type: "MRT", icon: "fa-brain", color: "#38bdf8" },
  { id: "mrt2", name: "MRT 2", room: "2-MRT Xonasi", type: "MRT", icon: "fa-brain", color: "#818cf8" },
  { id: "mskt1", name: "MSKT 1", room: "1-MSKT Xonasi", type: "MSKT", icon: "fa-circle-nodes", color: "#34d399" }
];

document.addEventListener("DOMContentLoaded", () => {
  initTV();
  startClock();
});

function initTV() {
  setTodayDate();
  db = initFirebase();

  initGuidelinesSlideshow();

  if (db) {
    listenToTodayPatients();
    listenToCallingAnnouncements();
    listenToServicesCatalog();
    renderDevicesGrid();
  }
}

// 1. TAYYORGARLIK SLAYDSHOU (Har bir tekshiruv 4 daqiqa ekranda turadi, ovozsiz)
function initGuidelinesSlideshow() {
  preparationSlides = [...DEFAULT_GUIDELINES];
  currentSlideIdx = 0;
  slideRemainingSec = SLIDE_DURATION_SEC;
  renderCurrentSlide();

  if (slideProgressTimer) clearInterval(slideProgressTimer);

  // 1 soniyalik progress bar yangilanishi
  slideProgressTimer = setInterval(() => {
    const slideshowEl = document.getElementById("guidelinesSlideshow");
    if (slideshowEl && slideshowEl.style.display !== "none") {
      slideRemainingSec--;
      const progressPercent = ((SLIDE_DURATION_SEC - slideRemainingSec) / SLIDE_DURATION_SEC) * 100;
      const fillEl = document.getElementById("slideProgressFill");
      if (fillEl) fillEl.style.width = `${progressPercent}%`;

      if (slideRemainingSec <= 0) {
        nextGuidelineSlide();
      }
    }
  }, 1000);
}

function nextGuidelineSlide() {
  slideRemainingSec = SLIDE_DURATION_SEC;
  currentSlideIdx = (currentSlideIdx + 1) % preparationSlides.length;
  renderCurrentSlide();
}

function renderCurrentSlide() {
  if (preparationSlides.length === 0) return;
  const slide = preparationSlides[currentSlideIdx];

  const counterEl = document.getElementById("slideCounter");
  const titleEl = document.getElementById("slideServiceTitle");
  const boxEl = document.getElementById("slideGuidelinesBox");
  const fillEl = document.getElementById("slideProgressFill");

  if (counterEl) counterEl.innerText = `${currentSlideIdx + 1} / ${preparationSlides.length}`;
  if (titleEl) titleEl.innerText = slide.title;
  if (fillEl) fillEl.style.width = "0%";

  if (boxEl) {
    boxEl.innerHTML = slide.points.map(pt => `
      <div class="guideline-item">
        <i class="fa-solid fa-circle-check"></i>
        <span>${escapeHtml(pt)}</span>
      </div>
    `).join("");
  }
}

function listenToServicesCatalog() {
  db.ref("services_catalog").on("value", (snap) => {
    const val = snap.val();
    if (val && Object.keys(val).length > 0) {
      const dynamicSlides = [];
      Object.keys(val).forEach(k => {
        const s = val[k];
        if (s.preparation || s.guidelines || s.contraindications) {
          const points = [];
          if (s.preparation) points.push(s.preparation);
          if (s.contraindications) points.push(`Qarshi ko'rsatmalar: ${s.contraindications}`);
          if (s.guidelines) points.push(s.guidelines);

          dynamicSlides.push({
            icon: s.name?.toLowerCase().includes("mrt") ? "fa-brain" : "fa-circle-nodes",
            title: `${s.isContrast ? '💉 ' : '📋 '}${s.name}`,
            points: points.length > 0 ? points : ["Maxsus tayyorgarlik talab etilmaydi."]
          });
        }
      });

      if (dynamicSlides.length > 0) {
        preparationSlides = dynamicSlides;
        if (currentSlideIdx >= preparationSlides.length) currentSlideIdx = 0;
        renderCurrentSlide();
      }
    }
  });
}

// 2. SOAT VA SANA (To'liq O'zbek tilida hafta kuni va oy)
const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"
];
const UZ_WEEKDAYS = [
  "Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"
];

function formatUzbekDate(dateObj) {
  const dayName = UZ_WEEKDAYS[dateObj.getDay()];
  const dayNum = dateObj.getDate();
  const monthName = UZ_MONTHS[dateObj.getMonth()];
  const yearNum = dateObj.getFullYear();
  return `${dayName}, ${dayNum}-${monthName} ${yearNum}-yil`;
}

function startClock() {
  function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const timeEl = document.getElementById("clockTime");
    if (timeEl) timeEl.innerText = timeStr;

    const dateStr = formatUzbekDate(now);
    const dateEl = document.getElementById("clockDate");
    if (dateEl) dateEl.innerText = dateStr;
  }

  updateTime();
  setInterval(updateTime, 1000);
}

function setTodayDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  todayDateStr = `${y}-${m}-${d}`;
}

// 3. BUGUNGI BEMORLARNI TINGLASH VA JAMI STATISTIKALAR
function listenToTodayPatients() {
  db.ref(`patients/${todayDateStr}`).on("value", (snapshot) => {
    allPatients = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        allPatients.push({ id: key, ...data[key] });
      });
    }

    // Jami navbat va jami zal hisob-kitobi
    const allWaiting = allPatients.filter(p => p.status === "waiting");
    const allInHall = allWaiting.filter(p => p.inHall !== false);

    const totalQueueEl = document.getElementById("totalQueueCount");
    const totalHallEl = document.getElementById("totalInHallCount");
    if (totalQueueEl) totalQueueEl.innerText = allWaiting.length;
    if (totalHallEl) totalHallEl.innerText = allInHall.length;

    renderDevicesGrid();
  });
}

// 4. QURILMALAR HOLATI VA NAVBATNI CHIZISH (ID raqamlarsiz, Ro'yxatsiz)
function renderDevicesGrid() {
  const container = document.getElementById("roomsContainer");
  if (!container) return;

  container.innerHTML = DEVICES.map((dev) => {
    // Shu qurilmaga biriktirilgan bemorlar
    const devPatients = allPatients.filter(p => p.doctorId === dev.id);
    
    // Qabuldagi bemor (calling yoki in_progress)
    const servingPatient = devPatients.find(p => p.status === "calling" || p.status === "in_progress");
    
    // Navbatdagi kutayotgan bemorlar soni
    const waitingPatients = devPatients.filter(p => p.status === "waiting");
    const inHallPatients = waitingPatients.filter(p => p.inHall !== false);

    const isCalling = servingPatient && servingPatient.status === "calling";

    return `
      <div class="room-card ${isCalling ? 'is-active-room' : ''}" style="border-top: 4px solid ${dev.color};">
        <div class="room-header">
          <div>
            <span class="room-num" style="color: ${dev.color};"><i class="fa-solid ${dev.icon}"></i> ${escapeHtml(dev.name)}</span>
            <small style="color: #94a3b8; display: block; font-size: 11px;">${escapeHtml(dev.room)}</small>
          </div>
          <span style="background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 8px; font-size: 12px; font-weight: 700; color: #38bdf8;">
            ${waitingPatients.length} ta navbatda
          </span>
        </div>

        <!-- Hozirgi qabuldagi bemor (ID raqamsiz, Faqat FISH) -->
        <div class="room-serving-box">
          <span class="serving-label">
            <i class="fa-solid ${servingPatient ? (servingPatient.status === 'calling' ? 'fa-bell' : 'fa-circle-play') : 'fa-hourglass-start'}"></i>
            ${servingPatient ? (servingPatient.status === 'calling' ? 'CHAQIRILMOQDA' : 'QABUL QILINMOQDA') : 'QURILMA BO\'SH'}
          </span>
          <div class="serving-patient">
            ${servingPatient ? `
              <div style="overflow:hidden; width: 100%;">
                <div class="serving-name">${escapeHtml(servingPatient.name)}</div>
                <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 2px;">${escapeHtml(servingPatient.service || 'Tekshiruv')}</div>
                ${servingPatient.isContrast ? '<span style="background:#ef4444; color:#fff; font-size:9px; padding:1px 6px; border-radius:3px; font-weight:bold; display:inline-block; margin-top:3px;">KONTRAST</span>' : ''}
                ${(servingPatient.calledByLaborant || servingPatient.laborantName) ? `
                  <div style="font-size:11px; color:#fbbf24; font-weight:700; margin-top:3px;">
                    <i class="fa-solid fa-user-doctor" style="font-size:10px;"></i> ${escapeHtml(servingPatient.calledByLaborant || servingPatient.laborantName)}
                  </div>
                ` : ''}
              </div>
            ` : `
              <span style="color:#64748b; font-size:0.95rem; font-style:italic;">Navbat kutilmoqda</span>
            `}
          </div>
        </div>

        <!-- Qurilma jami navbat statistikasi (Bemorlar ro'yxatisiz) -->
        <div class="room-stats-footer">
          <div class="room-stat-item">
            <span>Navbatda:</span>
            <strong>${waitingPatients.length} ta</strong>
          </div>
          <div class="room-stat-item">
            <span>Zalda:</span>
            <strong style="color: #22c55e;">${inHallPatients.length} ta</strong>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// 5. JONLI CHAQIRUV E'LONLARINI TINGLASH (AUDIO + KATTA E'LON)
function listenToCallingAnnouncements() {
  db.ref("calling_announcement").on("value", (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    if (data.timestamp && data.timestamp > lastAnnouncementTimestamp) {
      lastAnnouncementTimestamp = data.timestamp;
      handleNewCall(data);
    }
  });
}

function handleNewCall(data) {
  const slideshowEl = document.getElementById("guidelinesSlideshow");
  const activeState = document.getElementById("callingActiveState");
  const callingCard = document.getElementById("callingCard");
  const contrastBadge = document.getElementById("heroContrastBadge");
  const heroLaborant = document.getElementById("heroLaborant");
  const heroLaborantName = document.getElementById("heroLaborantName");
  const heroHeaderTitle = document.getElementById("heroHeaderTitle");
  const heroHeaderIcon = document.getElementById("heroHeaderIcon");

  if (slideshowEl) slideshowEl.style.display = "none";
  if (activeState) activeState.style.display = "flex";
  if (heroHeaderTitle) heroHeaderTitle.innerText = "QABULGA CHAQIRUV";
  if (heroHeaderIcon) heroHeaderIcon.className = "fa-solid fa-bullhorn icon-blink";

  document.getElementById("heroPatientName").innerText = data.patientName || "BEMOR";
  document.getElementById("heroRoomNum").innerText = data.room || data.doctorName || "Xona";
  document.getElementById("heroDoctorName").innerText = data.doctorName || "Qurilma";
  document.getElementById("heroService").innerText = data.specialty || data.service || "Tomografiya";

  if (heroLaborant && heroLaborantName) {
    if (data.laborantName) {
      heroLaborant.style.display = "inline-flex";
      heroLaborantName.innerText = `Laborant: ${data.laborantName}${data.laborantLogin ? ` (${data.laborantLogin})` : ''}`;
    } else {
      heroLaborant.style.display = "none";
    }
  }

  if (data.isContrast) {
    contrastBadge.style.display = "inline-block";
  } else {
    contrastBadge.style.display = "none";
  }

  callingCard.classList.remove("active-pulse");
  void callingCard.offsetWidth;
  callingCard.classList.add("active-pulse");

  playCallChime();
  speakAnnouncement(data);

  // 45 soniyadan so'ng avtomatik tayyorgarlik slaydshousiga qaytish
  if (activeCallTimer) clearTimeout(activeCallTimer);
  activeCallTimer = setTimeout(() => {
    returnToSlideshow();
  }, 45000);
}

function returnToSlideshow() {
  const slideshowEl = document.getElementById("guidelinesSlideshow");
  const activeState = document.getElementById("callingActiveState");
  const callingCard = document.getElementById("callingCard");
  const heroHeaderTitle = document.getElementById("heroHeaderTitle");
  const heroHeaderIcon = document.getElementById("heroHeaderIcon");

  if (callingCard) callingCard.classList.remove("active-pulse");
  if (activeState) activeState.style.display = "none";
  if (slideshowEl) slideshowEl.style.display = "flex";
  if (heroHeaderTitle) heroHeaderTitle.innerText = "TEKSHIRUV TAYYORGARLIGI";
  if (heroHeaderIcon) heroHeaderIcon.className = "fa-solid fa-notes-medical";
}

// 6. AUDIO CHIME
function unlockAudio() {
  isAudioUnlocked = true;
  const overlay = document.getElementById("audioUnlockOverlay");
  if (overlay) overlay.style.display = "none";

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }
      playCallChime();
    }
  } catch (e) {}
}

function playCallChime() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = audioContext || new AudioContextClass();
    const now = ctx.currentTime;

    playTone(ctx, 659.25, now, 0.4);
    playTone(ctx, 523.25, now + 0.35, 0.4);
    playTone(ctx, 392.00, now + 0.7, 0.6);
  } catch (err) {}
}

function playTone(ctx, freq, startTime, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, startTime);

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// 7. O'ZBEK TILI XONA NOMLARI KONVERTERI
function formatRoomUzbek(roomStr) {
  if (!roomStr) return "qabul xonasi";
  let r = roomStr.trim();
  r = r.replace(/^1-?MRT\s*Xonasi/i, "birinchi MRT xonasi")
       .replace(/^2-?MRT\s*Xonasi/i, "ikkinchi MRT xonasi")
       .replace(/^1-?MSKT\s*Xonasi/i, "birinchi MSKT xonasi")
       .replace(/^2-?MSKT\s*Xonasi/i, "ikkinchi MSKT xonasi")
       .replace(/^1-?xona/i, "birinchi xona")
       .replace(/^2-?xona/i, "ikkinchi xona")
       .replace(/^3-?xona/i, "uchinchi xona")
       .replace(/^4-?xona/i, "to'rtinchi xona")
       .replace(/^101-?xona/i, "bir yuz birinchi xona")
       .replace(/^102-?xona/i, "bir yuz ikkinchi xona");
  
  return r;
}

function buildUzbekAnnouncement(data) {
  const patientName = data.patientName ? data.patientName.trim() : "Bemor";
  const roomText = formatRoomUzbek(data.room || data.doctorName);
  
  let laborantText = "";
  if (data.laborantName) {
    const labName = data.laborantName.trim();
    laborantText = ` Laborant ${labName}.`;
  }

  return `Diqqat! Bemor ${patientName}, ${roomText} oldiga keling.${laborantText}`;
}

// 8. OVOZLI CHAQIRUV (To'liq O'zbek tilida Text-to-Speech)
function speakAnnouncement(data) {
  if (!('speechSynthesis' in window)) return;

  setTimeout(() => {
    try {
      window.speechSynthesis.cancel();

      const textToSpeak = buildUzbekAnnouncement(data);
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "uz-UZ";
      utterance.rate = 0.88;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const uzbekVoice = voices.find(v => v.lang === "uz-UZ" || v.lang.startsWith("uz") || (v.name && v.name.toLowerCase().includes("uzbek")));
      const turkishVoice = voices.find(v => v.lang === "tr-TR" || v.lang.startsWith("tr"));
      const russianVoice = voices.find(v => v.lang === "ru-RU" || v.lang.startsWith("ru"));

      if (uzbekVoice) {
        utterance.voice = uzbekVoice;
        utterance.lang = uzbekVoice.lang || "uz-UZ";
      } else if (turkishVoice) {
        utterance.voice = turkishVoice;
        utterance.lang = "tr-TR";
      } else if (russianVoice) {
        utterance.voice = russianVoice;
        utterance.lang = "ru-RU";
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("speakAnnouncement error:", err);
    }
  }, 1000);
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
