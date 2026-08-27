/**
 * UTT TV SISTEM — ADMIN PANEL JAVASCRIPT
 * Masofadan barcha TV monitorlari, tillar, xonalar, ulangan qurilmalar va tekshiruvlar media boshqaruvi
 */

let ws = null;
let allDoctors = [];
let allPatients = [];
let allClients = [];
let allGuidelines = [];
let currentSettings = { activeLang: "uz", activeRoomId: "ALL", tickerText: "" };
const openPreviews = new Set(); // Ochiq qoldirilgan jonli previewlar

let clientsRenderDebounceTimer = null;

let authToken = localStorage.getItem("admin_auth_token") || "";

document.addEventListener("DOMContentLoaded", async () => {
  const isAuth = await checkAuthSession();
  if (isAuth) {
    initAdminApp();
  }
});

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  return headers;
}

// 0. AUTHENTICATION & LOGIN BOSHQARUVI
async function checkAuthSession() {
  const overlay = document.getElementById("adminLoginOverlay");
  const userBadge = document.getElementById("currentAdminUser");

  if (!authToken) {
    if (overlay) overlay.style.display = "flex";
    return false;
  }

  try {
    const res = await fetch("/api/auth/check", {
      headers: getAuthHeaders()
    });
    const data = await res.json();
    if (data.authenticated) {
      if (overlay) overlay.style.display = "none";
      if (userBadge && data.username) userBadge.innerText = data.username;
      return true;
    } else {
      localStorage.removeItem("admin_auth_token");
      authToken = "";
      if (overlay) overlay.style.display = "flex";
      return false;
    }
  } catch (e) {
    return true; // Offline fallback
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const uInput = document.getElementById("loginUsername");
  const pInput = document.getElementById("loginPassword");
  const errEl = document.getElementById("loginErrorMsg");

  const username = uInput.value.trim();
  const password = pInput.value.trim();

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.ok) {
      authToken = data.token;
      localStorage.setItem("admin_auth_token", authToken);
      const overlay = document.getElementById("adminLoginOverlay");
      if (overlay) overlay.style.display = "none";
      const userBadge = document.getElementById("currentAdminUser");
      if (userBadge && data.username) userBadge.innerText = data.username;

      initAdminApp();
    } else {
      if (errEl) {
        errEl.innerText = data.error || "Login yoki parol noto'g'ri!";
        errEl.style.display = "block";
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = "Serverga ulanishda xatolik: " + err.message;
      errEl.style.display = "block";
    }
  }
}

async function handleLogout() {
  if (confirm("Admin paneldan chiqishni tasdiqlaysizmi?")) {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ token: authToken })
      });
    } catch (e) {}

    localStorage.removeItem("admin_auth_token");
    authToken = "";
    const overlay = document.getElementById("adminLoginOverlay");
    if (overlay) overlay.style.display = "flex";
  }
}

function openChangeAuthModal() {
  const modal = document.getElementById("changeAuthModal");
  const errEl = document.getElementById("changeAuthErrorMsg");
  const userBadge = document.getElementById("currentAdminUser");
  if (errEl) errEl.style.display = "none";
  if (document.getElementById("authNewUser") && userBadge) {
    document.getElementById("authNewUser").value = userBadge.innerText || "R5";
  }
  if (document.getElementById("authCurrentPass")) document.getElementById("authCurrentPass").value = "";
  if (document.getElementById("authNewPass")) document.getElementById("authNewPass").value = "";
  if (modal) modal.style.display = "flex";
}

function closeChangeAuthModal() {
  const modal = document.getElementById("changeAuthModal");
  if (modal) modal.style.display = "none";
}

async function handleChangeAuthSubmit(e) {
  e.preventDefault();
  const currentPassword = document.getElementById("authCurrentPass").value.trim();
  const newUsername = document.getElementById("authNewUser").value.trim();
  const newPassword = document.getElementById("authNewPass").value.trim();
  const errEl = document.getElementById("changeAuthErrorMsg");

  try {
    const res = await fetch("/api/auth/change", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ currentPassword, newUsername, newPassword })
    });
    const data = await res.json();

    if (data.ok) {
      alert("✅ " + (data.message || "Login va parol muvaffaqiyatli saqlandi!"));
      closeChangeAuthModal();
      const userBadge = document.getElementById("currentAdminUser");
      if (userBadge && data.username) userBadge.innerText = data.username;
    } else {
      if (errEl) {
        errEl.innerText = data.error || "Xatolik yuz berdi!";
        errEl.style.display = "block";
      }
    }
  } catch (err) {
    if (errEl) {
      errEl.innerText = "Xatolik: " + err.message;
      errEl.style.display = "block";
    }
  }
}

let isAppInitialized = false;
async function initAdminApp() {
  if (isAppInitialized) return;
  isAppInitialized = true;
  await fetchServerInfo();
  await fetchDoctors();
  await fetchQueue();
  await fetchClients();
  await fetchGuidelines();
  initWebSocket();
}

// 1. SERVER MA'LUMOTLARI VA HOST IP LAR
async function fetchServerInfo() {
  try {
    const res = await fetch("/api/info");
    const data = await res.json();

    document.getElementById("primaryIpText").innerText = `${data.primaryIp}:${data.port}`;
    if (data.settings) {
      currentSettings = { ...currentSettings, ...data.settings };
      applySettingsToUI(currentSettings);
    }

    renderNetworkLinks(data.hostIps || [], data.port);
  } catch (err) {
    console.warn("fetchServerInfo error:", err);
  }
}

function renderNetworkLinks(ips, port) {
  const container = document.getElementById("netLinksGrid");
  if (!container) return;

  container.innerHTML = ips.map(item => `
    <div class="net-link-chip">
      <b>[${item.type}] ${item.interface}:</b>
      <span>TV: <code>http://${item.ip}:${port}/tv</code></span> •
      <span>Admin: <code>http://${item.ip}:${port}/admin</code></span>
    </div>
  `).join("");
}

// 2. WEBSOCKET SYNC
function initWebSocket() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${location.host}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("✅ Admin WebSocket serverga ulandi");
      ws.send(JSON.stringify({
        type: "CLIENT_IDENTIFY",
        data: {
          clientType: "admin",
          name: "⚙️ Admin Boshqaruv Paneli"
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
  } catch (err) {
    setTimeout(initWebSocket, 5000);
  }
}

function handleWebSocketMessage(msg) {
  if (msg.type === "INITIAL_STATE") {
    allDoctors = msg.data.doctors || [];
    allPatients = msg.data.queue.patients || [];
    allGuidelines = msg.data.guidelines || [];
    if (msg.data.settings) {
      currentSettings = msg.data.settings;
      applySettingsToUI(currentSettings);
    }
    renderDoctorsSelect();
    renderPatientsList();
    renderGuidelinesList();
  } else if (msg.type === "CLIENTS_UPDATED") {
    allClients = msg.data || [];
    renderClientsListSmart(allClients, true);
  } else if (msg.type === "PENDING_DEVICES_UPDATED") {
    renderPendingDevicesList(msg.data || []);
  } else if (msg.type === "QUEUE_UPDATED") {
    allPatients = msg.data.patients || [];
    renderPatientsList();
  } else if (msg.type === "DOCTORS_UPDATED") {
    allDoctors = msg.data || [];
    renderDoctorsSelect();
  } else if (msg.type === "GUIDELINES_UPDATED") {
    allGuidelines = msg.data || [];
    renderGuidelinesList();
  } else if (msg.type === "TV_CONFIG_CHANGED") {
    currentSettings = { ...currentSettings, ...msg.data };
    applySettingsToUI(currentSettings);
  }
}

// 3. ULANGAN QURILMALARNI YUKLASH VA TINGCH/BARQAROR CHIZISH (SMART IN-PLACE DIFF)
async function fetchClients() {
  try {
    const res = await fetch("/api/clients");
    const data = await res.json();
    allClients = data.clients || [];
    renderClientsListSmart(allClients, true);
    if (data.pending) {
      renderPendingDevicesList(data.pending);
    }
  } catch (e) {}
}

function renderPendingDevicesList(pendingList) {
  const card = document.getElementById("pendingDevicesCard");
  const listEl = document.getElementById("pendingDevicesList");
  const countEl = document.getElementById("pendingCount");

  if (countEl) countEl.innerText = pendingList.length;

  if (!card || !listEl) return;

  if (pendingList.length === 0) {
    card.style.display = "none";
    listEl.innerHTML = "";
    return;
  }

  card.style.display = "block";
  listEl.innerHTML = pendingList.map(dev => `
    <div class="device-item" style="border-color:#eab308; background:#292524;">
      <div class="dev-header-row">
        <div class="dev-info">
          <div class="dev-icon">📺</div>
          <div>
            <div class="dev-name" style="color:#facc15;">${escapeHtml(dev.name)}</div>
            <div class="dev-meta">IP: <code>${escapeHtml(dev.ip)}</code> • So'rov vaqti: ${dev.connectedAtStr || ''}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn-success" style="padding:6px 12px; font-size:12px;" onclick="approveDevice('${dev.id}')">✅ Ruxsat Berish</button>
          <button class="btn-danger-sm" style="padding:6px 10px; font-size:12px;" onclick="rejectDevice('${dev.id}')">🚫 Rad Etish</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function approveDevice(clientId) {
  try {
    const res = await fetch("/api/devices/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: clientId })
    });
    const data = await res.json();
    if (data.ok) {
      allClients = data.clients || [];
      renderClientsListSmart(allClients, true);
      renderPendingDevicesList(data.pending || []);
    }
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

async function rejectDevice(clientId) {
  if (confirm("Ushbu qurilmaning ulanish so'rovini rad etasizmi?")) {
    try {
      const res = await fetch("/api/devices/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId })
      });
      const data = await res.json();
      if (data.ok) {
        allClients = data.clients || [];
        renderClientsListSmart(allClients, true);
        renderPendingDevicesList(data.pending || []);
      }
    } catch (err) {
      alert("Xatolik: " + err.message);
    }
  }
}

function renderClientsListSmart(clients, forceInitial = false) {
  const listEl = document.getElementById("devicesList");
  const countEl = document.getElementById("devicesCount");
  const activeTopCount = document.getElementById("activeClientsCount");

  if (countEl) countEl.innerText = clients.length;
  if (activeTopCount) activeTopCount.innerText = clients.length;

  if (!listEl) return;

  // Agar foydalanuvchi ayni damda biror input yoki select ichida bo'lsa, mutlaqo qayta chizmaslik!
  if (document.activeElement && listEl.contains(document.activeElement)) {
    return;
  }

  // Mavjud kartalarni tekshirish
  const existingCardIds = Array.from(listEl.querySelectorAll(".device-item")).map(el => el.dataset.clientId).filter(Boolean);
  const newClientIds = clients.map(c => c.id);

  // Agar qurilmalar o'zgarmagan bo'lsa va bu birinchi yuklanish bo'lmasa, DOM ni qayta tuzmaslik!
  const isSame = existingCardIds.length === newClientIds.length && existingCardIds.every((id, i) => id === newClientIds[i]);
  if (isSame && !forceInitial && listEl.children.length > 0) {
    return; // Dropdown va oynalar joyida sokin turadi!
  }

  if (clients.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Hozircha ulangan qurilmalar yo'q</div>`;
    return;
  }

  listEl.innerHTML = clients.map((client, idx) => {
    let icon = "📱";
    let typeName = "Qurilma";
    const isTv = client.type === "tv";

    if (isTv) {
      icon = "📺";
      typeName = `TV Monitor #${idx + 1}`;
    } else if (client.type === "extension") {
      icon = "💻";
      typeName = "Vrach Chrome Kengaytmasi";
    } else if (client.type === "admin") {
      icon = "⚙️";
      typeName = "Admin Boshqaruv Paneli";
    }

    const curLang = client.lang || currentSettings.activeLang || "uz";
    const curRoomId = client.roomId || currentSettings.activeRoomId || "ALL";
    const isPreviewOpen = openPreviews.has(client.id);

    // Vrachlar select opsiyalari
    const docOptions = `
      <option value="ALL" ${curRoomId === "ALL" ? "selected" : ""}>🏢 Barcha Xonalar Monitori</option>
      ${allDoctors.map(doc => `
        <option value="${doc.id}" ${curRoomId === doc.id ? "selected" : ""}>
          ${escapeHtml(doc.room)} (${escapeHtml(doc.name)})
        </option>
      `).join("")}
    `;

    return `
      <div class="device-item ${isTv ? 'tv-device-card' : ''}" id="devCard_${client.id}" data-client-id="${client.id}">
        <div class="dev-header-row">
          <div class="dev-info">
            <div class="dev-icon">${icon}</div>
            <div>
              <div class="dev-name">${escapeHtml(client.name || typeName)}</div>
              <div class="dev-meta">IP: <code>${escapeHtml(client.ip)}</code> • Ulandi: ${client.connectedAtStr || ''}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            ${isTv ? `<button class="btn-sm" id="btnPrev_${client.id}" onclick="toggleDevicePreview('${client.id}')">${isPreviewOpen ? '🙈 Yopish' : '👁️ Ko\'rish'}</button>` : ''}
            <span class="dev-status-badge">🟢 Online</span>
            <button class="btn-danger-sm" onclick="disconnectDevice('${client.id}')" title="Ushbu oynani masofadan yopish">❌ Oynani Yopish</button>
          </div>
        </div>

        ${isTv ? `
          <!-- TV MONITOR ALOHIDA BOSHQARUVI -->
          <div class="tv-dev-controls">
            <!-- 1. Tillar -->
            <div class="tv-dev-ctrl-row">
              <span class="tv-dev-ctrl-label">🌐 TV Tili:</span>
              <div class="tv-dev-lang-btns">
                <button class="btn-dev-lang ${curLang === 'uz' ? 'active' : ''}" onclick="setDeviceConfig('${client.id}', { lang: 'uz' })">🇺🇿 UZ</button>
                <button class="btn-dev-lang ${curLang === 'ru' ? 'active' : ''}" onclick="setDeviceConfig('${client.id}', { lang: 'ru' })">🇷🇺 RU</button>
                <button class="btn-dev-lang ${curLang === 'en' ? 'active' : ''}" onclick="setDeviceConfig('${client.id}', { lang: 'en' })">🇬🇧 EN</button>
                <button class="btn-dev-lang ${curLang === 'tr' ? 'active' : ''}" onclick="setDeviceConfig('${client.id}', { lang: 'tr' })">🇹🇷 TR</button>
                <button class="btn-dev-lang ${curLang === 'kz' ? 'active' : ''}" onclick="setDeviceConfig('${client.id}', { lang: 'kz' })">🇰🇿 KZ</button>
                <button class="btn-dev-lang ${curLang === 'tg' ? 'active' : ''}" onclick="setDeviceConfig('${client.id}', { lang: 'tg' })">🇹🇯 TG</button>
              </div>
            </div>

            <!-- 2. Vrach va Xona tanlash -->
            <div class="tv-dev-ctrl-row">
              <span class="tv-dev-ctrl-label">🚪 Xona/Vrach:</span>
              <select class="form-select" id="devSelect_${client.id}" style="flex:1; font-size:12px; padding:6px 8px;" onchange="handleDeviceDoctorChange('${client.id}', this.value)">
                ${docOptions}
              </select>
            </div>

            <!-- 3. Qo'lda Xona va Vrachni o'zgartirish (Override) -->
            <div class="tv-dev-custom-inputs">
              <input type="text" id="devRoom_${client.id}" class="form-input" style="font-size:11.5px; padding:6px;" placeholder="Xona (masalan: UTT 5 - 48 XONA)" value="${escapeHtml(client.roomName || '')}">
              <input type="text" id="devDoc_${client.id}" class="form-input" style="font-size:11.5px; padding:6px;" placeholder="Vrach (masalan: Xoshimova Lola)" value="${escapeHtml(client.doctorName || '')}">
              <button class="btn-success" style="padding:6px 12px; font-size:11.5px;" onclick="saveDeviceCustomNames('${client.id}')">💾 Saqlash</button>
            </div>

            <!-- Mini Live Preview (Yashirin/Ochiq) -->
            <div class="dev-mini-preview-wrap" id="devPreview_${client.id}" style="display:${isPreviewOpen ? 'block' : 'none'};">
              <iframe src="/tv" class="dev-mini-iframe"></iframe>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join("");
}

function toggleDevicePreview(clientId) {
  const el = document.getElementById(`devPreview_${clientId}`);
  const btn = document.getElementById(`btnPrev_${clientId}`);
  if (el) {
    if (el.style.display === "none") {
      el.style.display = "block";
      openPreviews.add(clientId);
      if (btn) btn.innerText = "🙈 Yopish";
    } else {
      el.style.display = "none";
      openPreviews.delete(clientId);
      if (btn) btn.innerText = "👁️ Ko'rish";
    }
  }
}

async function setDeviceConfig(clientId, config) {
  try {
    const res = await fetch("/api/devices/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: clientId, ...config })
    });
    const data = await res.json();
    if (data.ok) {
      allClients = data.clients || [];
      updateDeviceUIInPlace(clientId, config);
    }
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

function updateDeviceUIInPlace(clientId, config) {
  const card = document.getElementById(`devCard_${clientId}`);
  if (!card) return;

  if (config.lang) {
    card.querySelectorAll(".btn-dev-lang").forEach(btn => {
      if (btn.innerText.toLowerCase().includes(config.lang)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  if (config.roomId !== undefined) {
    const sel = document.getElementById(`devSelect_${clientId}`);
    if (sel && document.activeElement !== sel) {
      sel.value = config.roomId;
    }
  }

  if (config.roomName !== undefined) {
    const rInput = document.getElementById(`devRoom_${clientId}`);
    if (rInput && document.activeElement !== rInput) {
      rInput.value = config.roomName;
    }
  }

  if (config.doctorName !== undefined) {
    const dInput = document.getElementById(`devDoc_${clientId}`);
    if (dInput && document.activeElement !== dInput) {
      dInput.value = config.doctorName;
    }
  }
}

function handleDeviceDoctorChange(clientId, docId) {
  const doc = allDoctors.find(d => d.id === docId);
  const payload = {
    roomId: docId,
    roomName: doc ? doc.room : "🏢 Barcha Xonalar",
    doctorName: doc ? doc.name : "Navbat Monitori"
  };
  setDeviceConfig(clientId, payload);
}

function saveDeviceCustomNames(clientId) {
  const roomVal = document.getElementById(`devRoom_${clientId}`).value.trim();
  const docVal = document.getElementById(`devDoc_${clientId}`).value.trim();

  setDeviceConfig(clientId, {
    roomName: roomVal,
    doctorName: docVal
  });
  alert("✅ Ushbu TV monitori ma'lumotlari yangilandi va TV ga yuborildi!");
}

// 4. TV MONITORLARINI MASOFADAN BOSHQARISH
function applySettingsToUI(settings) {
  document.querySelectorAll(".btn-lang").forEach(btn => {
    if (btn.dataset.lang === settings.activeLang) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const roomSelect = document.getElementById("adminRoomSelect");
  if (roomSelect && settings.activeRoomId && document.activeElement !== roomSelect) {
    roomSelect.value = settings.activeRoomId;
  }

  const tickerInput = document.getElementById("adminTickerInput");
  if (tickerInput && settings.tickerText && !tickerInput.value && document.activeElement !== tickerInput) {
    tickerInput.value = settings.tickerText;
  }
}

async function changeTvLanguage(lang) {
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeLang: lang })
    });
    const data = await res.json();
    if (data.ok) {
      currentSettings.activeLang = lang;
      applySettingsToUI(currentSettings);
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

async function changeTvRoom(roomId) {
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeRoomId: roomId })
    });
    const data = await res.json();
    if (data.ok) {
      currentSettings.activeRoomId = roomId;
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

async function saveTickerText() {
  const val = document.getElementById("adminTickerInput").value.trim();
  if (!val) return;

  try {
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickerText: val })
    });
    alert("✅ Yuguruvchi satr e'loni yangilandi!");
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// 5. TEST OVOZLI CHAQIRUV
async function sendTestCall() {
  const name = document.getElementById("testPatientName").value.trim();
  if (!name) return;

  try {
    const res = await fetch("/api/queue/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: name,
        doctorId: currentSettings.activeRoomId !== "ALL" ? currentSettings.activeRoomId : (allDoctors[0] ? allDoctors[0].id : "vrach_utt_1")
      })
    });
    const data = await res.json();
    if (data.ok) {
      alert(`📢 Test chaqiruvi barcha TV monitorlariga yuborildi: ${name}`);
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

// 6. VRACHLAR VA NAVBAT
async function fetchDoctors() {
  try {
    const res = await fetch("/api/doctors");
    allDoctors = await res.json();
    renderDoctorsSelect();
  } catch (e) {}
}

function renderDoctorsSelect() {
  const adminRoomSelect = document.getElementById("adminRoomSelect");
  const addDocSelect = document.getElementById("addDoctor");

  if (adminRoomSelect && document.activeElement !== adminRoomSelect) {
    adminRoomSelect.innerHTML = `<option value="ALL">🏢 Barcha Xonalar Monitori</option>`;
    allDoctors.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.innerText = `${doc.room} (${doc.name})`;
      if (doc.id === currentSettings.activeRoomId) opt.selected = true;
      adminRoomSelect.appendChild(opt);
    });
  }

  if (addDocSelect && document.activeElement !== addDocSelect) {
    addDocSelect.innerHTML = `<option value="">Vrachni tanlang...</option>`;
    allDoctors.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.innerText = `${doc.room} - ${doc.name}`;
      addDocSelect.appendChild(opt);
    });
  }
}

async function fetchQueue() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    allPatients = data.patients || [];
    renderPatientsList();
  } catch (e) {}
}

function renderPatientsList() {
  const listEl = document.getElementById("adminPatientsList");
  const countEl = document.getElementById("queuePatientsCount");

  if (countEl) countEl.innerText = allPatients.length;
  if (!listEl) return;

  if (allPatients.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Hozirda navbatda bemorlar yo'q</div>`;
    return;
  }

  listEl.innerHTML = allPatients.map((p, idx) => {
    const isCalling = p.status === "calling";
    const isInProgress = p.status === "in_progress";

    return `
      <div class="pat-card ${isCalling ? 'calling' : ''}">
        <div>
          <div class="pat-name">${idx + 1}. ${escapeHtml(p.patientName)}</div>
          <div class="pat-details">${escapeHtml(p.room || '')} • ${escapeHtml(p.service || 'Ko\'rik')} • ${p.createdAtStr || ''} • <b>${p.status.toUpperCase()}</b></div>
        </div>
        <div class="pat-actions">
          <button class="btn-act btn-act-call" onclick="callPatient('${p.id}')">📢 Chaqirish</button>
          ${!isInProgress ? `<button class="btn-act btn-act-start" onclick="updatePatientStatus('${p.id}', 'in_progress')">▶️ Qabul</button>` : ''}
          <button class="btn-act btn-act-finish" onclick="updatePatientStatus('${p.id}', 'completed')">✅ Tugatish</button>
        </div>
      </div>
    `;
  }).join("");
}

async function handleAddPatient(e) {
  e.preventDefault();
  const name = document.getElementById("addName").value.trim();
  const docId = document.getElementById("addDoctor").value;
  const service = document.getElementById("addService").value.trim();

  try {
    await fetch("/api/queue/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patientName: name, doctorId: docId, service: service })
    });
    document.getElementById("adminAddPatientForm").reset();
    await fetchQueue();
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

async function callPatient(patientId) {
  try {
    await fetch("/api/queue/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: patientId })
    });
    await fetchQueue();
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

async function updatePatientStatus(patientId, status) {
  try {
    await fetch("/api/queue/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: patientId, status: status })
    });
    await fetchQueue();
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

async function clearQueue() {
  if (confirm("Rostdan ham barcha navbatlarni tozalamoqchimisiz?")) {
    try {
      await fetch("/api/queue/clear", { method: "POST" });
      await fetchQueue();
    } catch (e) {}
  }
}

// =========================================================
// 7. TEKSHIRUVLAR, RASM VA VIDEO MEDIA BOSHQARUVI (GUIDELINES)
// =========================================================
async function fetchGuidelines() {
  try {
    const res = await fetch("/api/guidelines");
    allGuidelines = await res.json();
    renderGuidelinesList();
  } catch (e) {}
}

function renderGuidelinesList() {
  const listEl = document.getElementById("guidelinesList");
  const countEl = document.getElementById("guidelinesCount");

  if (countEl) countEl.innerText = allGuidelines.length;
  if (!listEl) return;

  if (allGuidelines.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Hozircha tekshiruvlar kiritilmagan</div>`;
    return;
  }

  listEl.innerHTML = allGuidelines.map(g => {
    const pointsCount = (g.points || []).length;
    const isAct = g.isActive !== false;

    return `
      <div class="guide-item ${isAct ? '' : 'inactive-guide'}">
        <div class="guide-item-left">
          <div class="guide-thumb-wrap">
            ${g.video ? `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:18px;">🎬</div>` : `<img class="guide-thumb-img" src="${g.image || '/tv/assets/ultrasound_abdomen.jpg'}" alt="Media">`}
          </div>
          <div>
            <div class="guide-item-title">${g.icon || 'ℹ️'} ${escapeHtml(g.title)}</div>
            <div class="guide-item-meta">${g.code ? `Kodi: <b>${escapeHtml(g.code)}</b> • ` : ''}${pointsCount} ta qoida • ${g.video ? '🎥 Video' : '🖼️ Rasm'}</div>
          </div>
        </div>
        <div class="guide-item-actions">
          <button class="btn-sm" onclick="editGuideline('${g.id}')">✏️ Tahrirlash</button>
          <button class="btn-danger-sm" onclick="deleteGuideline('${g.id}')">🗑️ Ayirish</button>
        </div>
      </div>
    `;
  }).join("");
}

function toggleAddGuidelineForm(forceShow) {
  const form = document.getElementById("adminGuidelineForm");
  if (!form) return;

  if (forceShow !== undefined) {
    form.style.display = forceShow ? "flex" : "none";
  } else {
    form.style.display = form.style.display === "none" ? "flex" : "none";
  }

  if (form.style.display === "flex" && !document.getElementById("guideId").value) {
    document.getElementById("adminGuidelineForm").reset();
    document.getElementById("guideId").value = "";
  }
}

function editGuideline(id) {
  const g = allGuidelines.find(item => item.id === id);
  if (!g) return;

  document.getElementById("guideId").value = g.id;
  document.getElementById("guideCode").value = g.code || "";
  document.getElementById("guideIcon").value = g.icon || "🍏";
  document.getElementById("guideTitle").value = g.title || "";
  document.getElementById("guideImageUrl").value = g.image || "/tv/assets/ultrasound_abdomen.jpg";
  document.getElementById("guideVideoUrl").value = g.video || "";
  document.getElementById("guidePoints").value = (g.points || []).join("\n");

  toggleAddGuidelineForm(true);
  document.getElementById("guideTitle").focus();
}

async function handleSaveGuideline(e) {
  e.preventDefault();

  const id = document.getElementById("guideId").value;
  const code = document.getElementById("guideCode").value.trim();
  const icon = document.getElementById("guideIcon").value.trim() || "ℹ️";
  const title = document.getElementById("guideTitle").value.trim();
  const imageUrl = document.getElementById("guideImageUrl").value.trim();
  const videoUrl = document.getElementById("guideVideoUrl").value.trim();
  const pointsRaw = document.getElementById("guidePoints").value.trim();

  const points = pointsRaw.split("\n").map(p => p.trim()).filter(Boolean);

  const payload = {
    id: id || `g_${Date.now()}`,
    code: code,
    icon: icon,
    title: title,
    image: imageUrl,
    video: videoUrl,
    points: points,
    isActive: true
  };

  try {
    const res = await fetch("/api/guidelines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById("adminGuidelineForm").reset();
      document.getElementById("guideId").value = "";
      toggleAddGuidelineForm(false);
      await fetchGuidelines();
    }
  } catch (err) {
    alert("Xatolik: " + err.message);
  }
}

async function deleteGuideline(id) {
  if (confirm("Ushbu tekshiruv tayyorgarligi va rasmini TV dan ayirishni (o'chirishni) tasdiqlaysizmi?")) {
    try {
      const res = await fetch("/api/guidelines/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id })
      });
      const data = await res.json();
      if (data.ok) {
        await fetchGuidelines();
      }
    } catch (e) {
      alert("Xatolik: " + e.message);
    }
  }
}

async function disconnectDevice(clientId) {
  if (confirm("Ushbu TV monitori yoki oynani masofadan butunlay yopishni (uzishni) tasdiqlaysizmi?")) {
    try {
      const res = await fetch("/api/devices/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: clientId })
      });
      const data = await res.json();
      if (data.ok) {
        const card = document.getElementById(`devCard_${clientId}`);
        if (card) card.remove();
        allClients = data.clients || [];
        const countEl = document.getElementById("devicesCount");
        const activeTopCount = document.getElementById("activeClientsCount");
        if (countEl) countEl.innerText = allClients.length;
        if (activeTopCount) activeTopCount.innerText = allClients.length;
      }
    } catch (err) {
      alert("Xatolik: " + err.message);
    }
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.changeTvLanguage = changeTvLanguage;
window.changeTvRoom = changeTvRoom;
window.saveTickerText = saveTickerText;
window.sendTestCall = sendTestCall;
window.fetchClients = fetchClients;
window.handleAddPatient = handleAddPatient;
window.callPatient = callPatient;
window.updatePatientStatus = updatePatientStatus;
window.clearQueue = clearQueue;
window.toggleAddGuidelineForm = toggleAddGuidelineForm;
window.editGuideline = editGuideline;
window.handleSaveGuideline = handleSaveGuideline;
window.deleteGuideline = deleteGuideline;
window.toggleDevicePreview = toggleDevicePreview;
window.setDeviceConfig = setDeviceConfig;
window.handleDeviceDoctorChange = handleDeviceDoctorChange;
window.saveDeviceCustomNames = saveDeviceCustomNames;
window.disconnectDevice = disconnectDevice;
window.approveDevice = approveDevice;
window.rejectDevice = rejectDevice;
window.handleLoginSubmit = handleLoginSubmit;
window.handleLogout = handleLogout;
window.openChangeAuthModal = openChangeAuthModal;
window.closeChangeAuthModal = closeChangeAuthModal;
window.handleChangeAuthSubmit = handleChangeAuthSubmit;
