/**
 * UTT TV SISTEM — ADMIN PANEL JAVASCRIPT
 * Masofadan barcha TV monitorlari, tillar, xonalar va ulangan qurilmalarni boshqarish
 */

let ws = null;
let allDoctors = [];
let allPatients = [];
let allClients = [];
let currentSettings = { activeLang: "uz", activeRoomId: "ALL", tickerText: "" };

document.addEventListener("DOMContentLoaded", async () => {
  await fetchServerInfo();
  await fetchDoctors();
  await fetchQueue();
  await fetchClients();
  initWebSocket();
});

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

    // IP manzillarni chizish
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
      setTimeout(initWebSocket, 3000);
    };
  } catch (err) {
    setTimeout(initWebSocket, 4000);
  }

  // Backup polling
  setInterval(() => {
    fetchClients();
    fetchQueue();
  }, 5000);
}

function handleWebSocketMessage(msg) {
  if (msg.type === "INITIAL_STATE") {
    allDoctors = msg.data.doctors || [];
    allPatients = msg.data.queue.patients || [];
    if (msg.data.settings) {
      currentSettings = msg.data.settings;
      applySettingsToUI(currentSettings);
    }
    renderDoctorsSelect();
    renderPatientsList();
  } else if (msg.type === "CLIENTS_UPDATED") {
    allClients = msg.data || [];
    renderClientsList(allClients);
  } else if (msg.type === "QUEUE_UPDATED") {
    allPatients = msg.data.patients || [];
    renderPatientsList();
  } else if (msg.type === "DOCTORS_UPDATED") {
    allDoctors = msg.data || [];
    renderDoctorsSelect();
  } else if (msg.type === "TV_CONFIG_CHANGED") {
    currentSettings = { ...currentSettings, ...msg.data };
    applySettingsToUI(currentSettings);
  }
}

// 3. ULANGAN QURILMALARNI YUKLASH VA CHIZISH
async function fetchClients() {
  try {
    const res = await fetch("/api/clients");
    const data = await res.json();
    allClients = data.clients || [];
    renderClientsList(allClients);
  } catch (e) {}
}

function renderClientsList(clients) {
  const listEl = document.getElementById("devicesList");
  const countEl = document.getElementById("devicesCount");
  const activeTopCount = document.getElementById("activeClientsCount");

  if (countEl) countEl.innerText = clients.length;
  if (activeTopCount) activeTopCount.innerText = clients.length;

  if (!listEl) return;

  if (clients.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Hozircha ulangan qurilmalar yo'q</div>`;
    return;
  }

  listEl.innerHTML = clients.map(client => {
    let icon = "📱";
    let typeName = "Qurilma";

    if (client.type === "tv") {
      icon = "📺";
      typeName = "Android TV Monitor";
    } else if (client.type === "extension") {
      icon = "💻";
      typeName = "Vrach Chrome Kengaytmasi";
    } else if (client.type === "admin") {
      icon = "⚙️";
      typeName = "Admin Boshqaruv Paneli";
    }

    return `
      <div class="device-item">
        <div class="dev-info">
          <div class="dev-icon">${icon}</div>
          <div>
            <div class="dev-name">${escapeHtml(client.name || typeName)}</div>
            <div class="dev-meta">IP: <code>${escapeHtml(client.ip)}</code> • Ulandi: ${client.connectedAtStr || ''}</div>
          </div>
        </div>
        <span class="dev-status-badge">🟢 Online</span>
      </div>
    `;
  }).join("");
}

// 4. TV MONITORLARINI MASOFADAN BOSHQARISH
function applySettingsToUI(settings) {
  // Til tugmalari
  document.querySelectorAll(".btn-lang").forEach(btn => {
    if (btn.dataset.lang === settings.activeLang) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Xona tanlash
  const roomSelect = document.getElementById("adminRoomSelect");
  if (roomSelect && settings.activeRoomId) {
    roomSelect.value = settings.activeRoomId;
  }

  // Ticker
  const tickerInput = document.getElementById("adminTickerInput");
  if (tickerInput && settings.tickerText && !tickerInput.value) {
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
        doctorId: currentSettings.activeRoomId !== "ALL" ? currentSettings.activeRoomId : (allDoctors[0] ? allDoctors[0].id : "vrach_utt_48")
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

  if (adminRoomSelect) {
    adminRoomSelect.innerHTML = `<option value="ALL">🏢 Barcha Xonalar Monitori</option>`;
    allDoctors.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.innerText = `${doc.room} (${doc.name})`;
      if (doc.id === currentSettings.activeRoomId) opt.selected = true;
      adminRoomSelect.appendChild(opt);
    });
  }

  if (addDocSelect) {
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
