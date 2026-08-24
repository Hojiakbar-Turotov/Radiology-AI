/**
 * Extension Popup - Avtorizatsiya, Kengaytma Holati & Profil Boshqaruvi
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

const DEFAULT_OPERATORS = [
  { login: "TB1", name: "Turatov Hojiakbar", password: "15420", role: "Operator" },
  { login: "TB2", name: "Saida'loxon Saidaxmadxonov", password: "15420", role: "Operator" },
  { login: "TB3", name: "Isfandiyor Xaydaraliyev", password: "15420", role: "Operator" }
];

let currentUser = null;
let operatorsList = [...DEFAULT_OPERATORS];
let isExtensionEnabled = true;

document.addEventListener("DOMContentLoaded", () => {
  initPopup();
});

async function initPopup() {
  await loadExtensionState();
  await loadOperators();
  await loadCurrentUser();
  setupEvents();
}

async function loadExtensionState() {
  try {
    if (chrome.storage && chrome.storage.local) {
      const res = await chrome.storage.local.get("utt_extension_enabled");
      if (res && res.utt_extension_enabled !== undefined) {
        isExtensionEnabled = Boolean(res.utt_extension_enabled);
      }
    }
  } catch (e) {}
  renderExtensionState();
}

function renderExtensionState() {
  const card = document.getElementById("extStatusCard");
  const badge = document.getElementById("extStatusBadge");
  const desc = document.getElementById("extStatusDesc");
  const btn = document.getElementById("btnToggleExt");

  if (!card || !badge || !desc || !btn) return;

  if (isExtensionEnabled) {
    card.className = "card-box status-card";
    badge.className = "status-badge active";
    badge.innerHTML = "🟢 Faol";
    desc.innerText = "Kardelen tizimidan bemorlarni avtomatik aniqlash va navbatga yozish yoqilgan.";
    btn.className = "btn-toggle-ext active";
    btn.innerHTML = '<i class="fa-solid fa-pause"></i> Vaqtincha O\'chirish (To\'xtatish)';
  } else {
    card.className = "card-box status-card disabled";
    badge.className = "status-badge disabled";
    badge.innerHTML = "🔴 To'xtatilgan";
    desc.innerText = "Kengaytma faoliyati vaqtincha to'xtatilgan. Kardelen oynasida navbat paneli ko'rinmaydi.";
    btn.className = "btn-toggle-ext disabled";
    btn.innerHTML = '<i class="fa-solid fa-play"></i> Kengaytmani Ishga Tushirish';
  }
}

async function toggleExtensionState() {
  isExtensionEnabled = !isExtensionEnabled;
  try {
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ utt_extension_enabled: isExtensionEnabled });
    }
  } catch (e) {}
  renderExtensionState();
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

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 soat

async function loadCurrentUser() {
  let saved = null;
  if (chrome.storage && chrome.storage.session) {
    try {
      const sRes = await chrome.storage.session.get("utt_current_session");
      if (sRes && sRes.utt_current_session) saved = sRes.utt_current_session;
    } catch (e) {}
  }
  if (!saved && chrome.storage && chrome.storage.local) {
    const lRes = await chrome.storage.local.get("utt_current_user");
    if (lRes && lRes.utt_current_user) saved = lRes.utt_current_user;
  }

  if (saved && saved.authTime) {
    const elapsed = Date.now() - Number(saved.authTime);
    if (elapsed < SESSION_DURATION_MS) {
      currentUser = saved;
    } else {
      currentUser = null;
      if (chrome.storage && chrome.storage.local) {
        await chrome.storage.local.remove("utt_current_user");
      }
      if (chrome.storage && chrome.storage.session) {
        await chrome.storage.session.remove("utt_current_session");
      }
    }
  } else {
    currentUser = null;
  }

  const curLang = (typeof getI18nLanguage === 'function') ? getI18nLanguage() : 'uz';
  const sel = document.getElementById("popupLangSelector");
  if (sel) sel.value = curLang;

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
    renderExtensionState();
  }
}

function setupEvents() {
  document.getElementById("btnDoPopupLogin").onclick = doLogin;
  document.getElementById("btnPopupLogout").onclick = doLogout;
  document.getElementById("btnToggleExt").onclick = toggleExtensionState;
  document.getElementById("btnPopSavePwd").onclick = doChangePassword;

  const sel = document.getElementById("popupLangSelector");
  if (sel) {
    sel.onchange = (e) => {
      if (typeof setI18nLanguage === 'function') setI18nLanguage(e.target.value);
    };
  }
}

async function doLogin() {
  const selectedLogin = document.getElementById("loginOperatorSelect").value;
  const inputPwd = document.getElementById("loginPassword").value.trim();
  const errEl = document.getElementById("popupLoginError");

  await loadOperators();
  const foundOp = operatorsList.find(o => o.login.toUpperCase() === selectedLogin.toUpperCase());

  if (foundOp && String(foundOp.password) === String(inputPwd)) {
    errEl.style.display = "none";
    const sessionUser = {
      login: foundOp.login,
      name: foundOp.name,
      role: foundOp.role || "Operator",
      authTime: Date.now()
    };
    currentUser = sessionUser;
    if (chrome.storage && chrome.storage.session) {
      await chrome.storage.session.set({ utt_current_session: sessionUser }).catch(() => {});
    }
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set({ utt_current_user: sessionUser }).catch(() => {});
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
    if (chrome.storage && chrome.storage.session) {
      await chrome.storage.session.remove("utt_current_session").catch(() => {});
    }
    if (chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove("utt_current_user").catch(() => {});
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

async function doChangePassword() {
  if (!currentUser) return;

  const oldP = document.getElementById("popOldPwd").value.trim();
  const newP = document.getElementById("popNewPwd").value.trim();
  const confirmP = document.getElementById("popConfirmPwd").value.trim();
  const msgEl = document.getElementById("popPwdMsg");

  if (!oldP || !newP || !confirmP) {
    msgEl.style.display = "block";
    msgEl.style.background = "#fee2e2";
    msgEl.style.color = "#b91c1c";
    msgEl.innerText = "❌ Iltimos, barcha parollarni kiriting!";
    return;
  }

  if (String(currentUser.password) !== String(oldP)) {
    msgEl.style.display = "block";
    msgEl.style.background = "#fee2e2";
    msgEl.style.color = "#b91c1c";
    msgEl.innerText = "❌ Eski parol noto'g'ri!";
    return;
  }

  if (newP.length < 3) {
    msgEl.style.display = "block";
    msgEl.style.background = "#fee2e2";
    msgEl.style.color = "#b91c1c";
    msgEl.innerText = "❌ Yangi parol kamida 3 ta belgidan iborat bo'lsin!";
    return;
  }

  if (newP !== confirmP) {
    msgEl.style.display = "block";
    msgEl.style.background = "#fee2e2";
    msgEl.style.color = "#b91c1c";
    msgEl.innerText = "❌ Yangi parollar bir-biriga mos kelmadi!";
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
      body: JSON.stringify({ password: newP, lastUpdated: Date.now() })
    });
  } catch (e) {}

  msgEl.style.display = "block";
  msgEl.style.background = "#dcfce7";
  msgEl.style.color = "#15803d";
  msgEl.innerText = "✅ Parol muvaffaqiyatli o'zgartirildi!";
  document.getElementById("popOldPwd").value = "";
  document.getElementById("popNewPwd").value = "";
  document.getElementById("popConfirmPwd").value = "";
}
