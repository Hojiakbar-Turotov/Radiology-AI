/**
 * Extension Popup - Avtorizatsiya & Profil Boshqaruvi
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

const DEFAULT_OPERATORS = [
  { login: "TB1", name: "Turatov Hojiakbar", password: "15420", role: "Operator" },
  { login: "TB2", name: "Saida'loxon Saidaxmadxonov", password: "15420", role: "Operator" },
  { login: "TB3", name: "Isfandiyor Xaydaraliyev", password: "15420", role: "Operator" }
];

let currentUser = null;
let operatorsList = [...DEFAULT_OPERATORS];

document.addEventListener("DOMContentLoaded", () => {
  initPopup();
});

async function initPopup() {
  await loadOperators();
  await loadCurrentUser();
  setupEvents();
}

async function loadOperators() {
  try {
    const res = await fetch(`${FIREBASE_DB_URL}/operators.json`);
    if (res.ok) {
      const data = await res.json();
      if (data) operatorsList = Object.values(data);
    }
  } catch (e) {}
}

async function loadCurrentUser() {
  if (chrome.storage && chrome.storage.local) {
    const saved = await chrome.storage.local.get("utt_current_user");
    if (saved && saved.utt_current_user) {
      currentUser = saved.utt_current_user;
    }
  }

  renderView();
  if (currentUser) fetchTodayStats();
}

function renderView() {
  const loginView = document.getElementById("loginView");
  const mainView = document.getElementById("mainView");

  if (!currentUser) {
    loginView.style.display = "block";
    mainView.style.display = "none";
  } else {
    loginView.style.display = "none";
    mainView.style.display = "block";

    document.getElementById("opAvatar").innerText = currentUser.login;
    document.getElementById("opName").innerText = currentUser.name;
    document.getElementById("opBadge").innerText = `Operator (${currentUser.login})`;
  }
}

function setupEvents() {
  document.getElementById("btnDoPopupLogin").onclick = doLogin;
  document.getElementById("btnPopupLogout").onclick = doLogout;
  document.getElementById("btnQuickSend").onclick = doQuickSend;
  document.getElementById("btnPopSavePwd").onclick = doChangePassword;
}

async function doLogin() {
  const selectedLogin = document.getElementById("loginOperatorSelect").value;
  const inputPwd = document.getElementById("loginPassword").value.trim();
  const errEl = document.getElementById("popupLoginError");

  await loadOperators();
  const foundOp = operatorsList.find(o => o.login.toUpperCase() === selectedLogin.toUpperCase());

  if (foundOp && String(foundOp.password) === String(inputPwd)) {
    errEl.style.display = "none";
    currentUser = foundOp;
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ utt_current_user: foundOp });
    }
    renderView();
    fetchTodayStats();
  } else {
    errEl.style.display = "block";
  }
}

async function doLogout() {
  if (confirm("Tizimdan chiqmoqchimisiz?")) {
    currentUser = null;
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove("utt_current_user");
    }
    renderView();
  }
}

async function fetchTodayStats() {
  if (!currentUser) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  try {
    const res = await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`);
    if (!res.ok) return;
    const data = await res.json();
    let count = 0;
    if (data) {
      Object.values(data).forEach(p => {
        if (p.operatorLogin === currentUser.login) count++;
      });
    }
    document.getElementById("opTodayCount").innerText = `${count} nafar`;
  } catch (e) {}
}

async function doQuickSend() {
  if (!currentUser) return;

  const id = document.getElementById("quickId").value.trim();
  const name = document.getElementById("quickName").value.trim();
  const service = document.getElementById("quickService").value.trim() || "Bosh Miya Tomografiyasi";
  const deviceId = document.getElementById("quickDevice").value;

  if (!id || !name) {
    alert("Iltimos, bemor ID va Ismini kiriting!");
    return;
  }

  const deviceMap = {
    mrt1: { name: "MRT 1", room: "1-MRT Xonasi", type: "MRT" },
    mrt2: { name: "MRT 2", room: "2-MRT Xonasi", type: "MRT" },
    mskt1: { name: "MSKT 1", room: "1-MSKT Xonasi", type: "MSKT" }
  };

  const dev = deviceMap[deviceId] || deviceMap.mrt1;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  const timeSlot = await calculatePopupTimeSlot(deviceId, 30);

  const payload = {
    ticketId: id,
    name: name,
    doctorId: deviceId,
    doctorName: dev.name,
    room: dev.room,
    deviceType: dev.type,
    service: service,
    duration: 30,
    scheduledTime: timeSlot.startTime,
    endTime: timeSlot.endTime,
    timeSlot: timeSlot.slotString,
    operatorLogin: currentUser.login,
    operatorName: currentUser.name,
    registeredBy: `${currentUser.login} - ${currentUser.name}`,
    notes: "Popup orqali yuborildi",
    status: "waiting",
    timestamp: Date.now(),
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  try {
    const res = await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      alert(`✅ ${name} (ID: ${id}) ${dev.name}ga ${timeSlot.slotString} vaqtiga yozildi!`);
      document.getElementById("quickId").value = "";
      document.getElementById("quickName").value = "";
      fetchTodayStats();
    }
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

async function calculatePopupTimeSlot(deviceId, duration) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  function addMinutes(t, mins) {
    const [h, m] = t.split(":").map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  try {
    const res = await fetch(`${FIREBASE_DB_URL}/patients/${todayStr}.json`);
    if (!res.ok) return { startTime: "08:00", endTime: addMinutes("08:00", duration), slotString: `08:00 - ${addMinutes("08:00", duration)}` };
    const data = await res.json();
    let devPatients = [];
    if (data) {
      Object.values(data).forEach(p => {
        if (p.doctorId === deviceId && p.status !== "cancelled") devPatients.push(p);
      });
    }
    if (devPatients.length === 0) {
      return { startTime: "08:00", endTime: addMinutes("08:00", duration), slotString: `08:00 - ${addMinutes("08:00", duration)}` };
    }
    devPatients.sort((a, b) => (a.scheduledTime || "08:00").localeCompare(b.scheduledTime || "08:00"));
    const lastP = devPatients[devPatients.length - 1];
    const nextStart = lastP.endTime || addMinutes(lastP.scheduledTime || "08:00", lastP.duration || 30);
    const nextEnd = addMinutes(nextStart, duration);
    return { startTime: nextStart, endTime: nextEnd, slotString: `${nextStart} - ${nextEnd}` };
  } catch (e) {
    return { startTime: "08:00", endTime: addMinutes("08:00", duration), slotString: `08:00 - ${addMinutes("08:00", duration)}` };
  }
}

async function doChangePassword() {
  const oldP = document.getElementById("popOldPwd").value.trim();
  const newP = document.getElementById("popNewPwd").value.trim();
  const msgEl = document.getElementById("popPwdMsg");

  if (String(currentUser.password) !== String(oldP)) {
    msgEl.style.display = "block";
    msgEl.style.color = "#ef4444";
    msgEl.innerText = "Eski parol noto'g'ri!";
    return;
  }

  if (!newP || newP.length < 3) {
    msgEl.style.display = "block";
    msgEl.style.color = "#ef4444";
    msgEl.innerText = "Yangi parol kamida 3 ta belgi bo'lsin!";
    return;
  }

  currentUser.password = newP;
  if (chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ utt_current_user: currentUser });
  }

  try {
    await fetch(`${FIREBASE_DB_URL}/operators/${currentUser.login}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newP })
    });
  } catch (e) {}

  msgEl.style.display = "block";
  msgEl.style.color = "#10b981";
  msgEl.innerText = "Parol saqlandi!";
  document.getElementById("popOldPwd").value = "";
  document.getElementById("popNewPwd").value = "";
}
