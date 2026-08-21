/**
 * Android TV Navbat Monitori - MRT & MSKT Mantiqi
 */

let db = null;
let todayDateStr = "";
let allPatients = [];
let lastAnnouncementTimestamp = 0;
let isAudioUnlocked = false;
let audioContext = null;

const DEVICES = [
  { id: "mrt1", name: "MRT 1", room: "1-MRT Xonasi", type: "MRT", icon: "fa-brain", color: "#38bdf8" },
  { id: "mrt2", name: "MRT 2", room: "2-MRT Xonasi", type: "MRT", icon: "fa-brain", color: "#818cf8" },
  { id: "mskt1", name: "MSKT 1", room: "1-MSKT Xonasi", type: "MSKT", icon: "fa-circle-nodes", color: "#34d399" },
  { id: "mskt2", name: "MSKT 2", room: "2-MSKT Xonasi", type: "MSKT", icon: "fa-circle-nodes", color: "#f59e0b" }
];

document.addEventListener("DOMContentLoaded", () => {
  initTV();
  startClock();
});

function initTV() {
  setTodayDate();
  db = initFirebase();

  if (db) {
    listenToTodayPatients();
    listenToCallingAnnouncements();
    renderDevicesGrid();
  }
}

// 1. SOAT VA SANA
function startClock() {
  function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const timeEl = document.getElementById("clockTime");
    if (timeEl) timeEl.innerText = timeStr;

    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const dateStr = now.toLocaleDateString('uz-UZ', dateOptions);
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

// 2. BUGUNGI BEMORLARNI TINGLASH
function listenToTodayPatients() {
  db.ref(`patients/${todayDateStr}`).on("value", (snapshot) => {
    allPatients = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        allPatients.push({ id: key, ...data[key] });
      });
    }
    renderDevicesGrid();
  });
}

// 3. 4 TA QURILMA GRIDINI CHIZISH (MRT1, MRT2, MSKT1, MSKT2)
function renderDevicesGrid() {
  const container = document.getElementById("roomsContainer");
  if (!container) return;

  container.innerHTML = DEVICES.map((dev) => {
    // Shu qurilmaga biriktirilgan bemorlar
    const devPatients = allPatients.filter(p => p.doctorId === dev.id);
    
    // Qabuldagi bemor (calling yoki in_progress)
    const servingPatient = devPatients.find(p => p.status === "calling" || p.status === "in_progress");
    
    // Navbatdagi kutayotgan bemorlar
    const waitingPatients = devPatients
      .filter(p => p.status === "waiting")
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
      .slice(0, 4);

    const isCalling = servingPatient && servingPatient.status === "calling";

    return `
      <div class="room-card ${isCalling ? 'is-active-room' : ''}" style="border-top: 4px solid ${dev.color};">
        <div class="room-header">
          <div>
            <span class="room-num" style="color: ${dev.color};"><i class="fa-solid ${dev.icon}"></i> ${escapeHtml(dev.name)}</span>
            <small style="color: #94a3b8; display: block; font-size: 11px;">${escapeHtml(dev.room)}</small>
          </div>
          <span style="background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: 700;">
            ${waitingPatients.length} kutmoqda
          </span>
        </div>

        <!-- Hozirgi qabuldagi bemor -->
        <div class="room-serving-box">
          <span class="serving-label">${servingPatient ? (servingPatient.status === 'calling' ? '🔔 CHAQIRILMOQDA' : '▶️ QABULDA') : 'QURILMA BO\'SH'}</span>
          <div class="serving-patient">
            ${servingPatient ? `
              <span class="serving-ticket" style="background:${dev.color};">${servingPatient.ticketId || 'ID'}</span>
              <div style="overflow:hidden;">
                <div class="serving-name">${escapeHtml(servingPatient.name)}</div>
                ${servingPatient.isContrast ? '<span style="background:#ef4444; color:#fff; font-size:9px; padding:1px 5px; border-radius:3px; font-weight:bold;">KONTRAST</span>' : ''}
              </div>
            ` : `
              <span style="color:#64748b; font-size:0.95rem; font-style:italic;">Navbat kutilmoqda</span>
            `}
          </div>
        </div>

        <!-- Keyingi navbatdagilar -->
        <div class="room-next-queue">
          <span class="next-label">Keyingi navbat:</span>
          <div class="next-tags-wrap">
            ${waitingPatients.length > 0 ? waitingPatients.map(p => `
              <span class="next-tag">
                <strong>${p.ticketId}</strong> <small style="color:#94a3b8;">${p.scheduledTime || p.time}</small> ${p.isContrast ? '<b style="color:#f87171;">[K]</b>' : ''}
              </span>
            `).join('') : `<span style="color:#64748b; font-size:0.8rem;">Yo'q</span>`}
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// 4. JONLI CHAQIRUV E'LONLARINI TINGLASH (AUDIO + KATTA BANNER)
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
  const idleState = document.getElementById("callingIdleState");
  const activeState = document.getElementById("callingActiveState");
  const callingCard = document.getElementById("callingCard");
  const contrastBadge = document.getElementById("heroContrastBadge");

  if (idleState) idleState.style.display = "none";
  if (activeState) activeState.style.display = "flex";

  document.getElementById("heroTicketId").innerText = data.ticketId || "ID";
  document.getElementById("heroPatientName").innerText = data.patientName || "Bemor";
  document.getElementById("heroRoomNum").innerText = data.room || data.doctorName || "Xona";
  document.getElementById("heroDoctorName").innerText = data.doctorName || "Qurilma";
  document.getElementById("heroService").innerText = data.specialty || "Tomografiya";

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
}

// 5. AUDIO CHIME
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

// 6. OVOZLI CHAQIRUV (Text-to-Speech)
function speakAnnouncement(data) {
  if (!('speechSynthesis' in window)) return;

  setTimeout(() => {
    window.speechSynthesis.cancel();

    // Masalan: "Talon 5245, SAYIDOV SHERALI, 1-MRT xonasiga kiring"
    const textToSpeak = `Talon ${data.ticketId}, ${data.patientName}, ${data.room}ga kiring.`;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const ruOrUzVoice = voices.find(v => v.lang.includes('uz') || v.lang.includes('ru') || v.lang.includes('tr'));
    if (ruOrUzVoice) {
      utterance.voice = ruOrUzVoice;
    }

    window.speechSynthesis.speak(utterance);
  }, 1100);
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
