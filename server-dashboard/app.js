/**
 * Lokal Server Boshqaruv & Audit Paneli - Client Script (server-dashboard/app.js)
 */

let ws = null;
let pollTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  initUIEventListeners();
  connectWebSocket();
  startStatsPolling();
});

function initUIEventListeners() {
  document.getElementById("btnManualBackup").addEventListener("click", handleManualBackup);
  document.getElementById("btnResetQueue").addEventListener("click", handleResetQueue);
  document.getElementById("btnClearLogs").addEventListener("click", handleClearLogs);
  document.getElementById("btnRefreshLogs").addEventListener("click", fetchServerLogs);

  document.getElementById("btnTestVoice").addEventListener("click", () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        action: "test_voice",
        message: "Test ovozli e'lon"
      }));
      alert("🔊 TV Tabloga test ovozli e'lon yuborildi!");
    }
  });

  document.getElementById("btnOpenTv").addEventListener("click", () => {
    window.open("/mrt-tv/", "_blank");
  });

  document.getElementById("btnOpenLaborant").addEventListener("click", () => {
    window.open("/laborant/", "_blank");
  });
}

// -------------------------------------------------------------
// WEBSOCKET JONLI ALOQA
// -------------------------------------------------------------
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    // Dashboard sifatida ro'yxatdan o'tish
    ws.send(JSON.stringify({
      action: "register",
      role: "dashboard",
      deviceName: "Server Dashboard Console"
    }));

    document.getElementById("txtServerStatus").innerText = "Server Faol (Online)";
    document.querySelector(".pulse-dot").style.background = "#10b981";
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "dashboard_clients_update") {
        renderConnectedClients(data.payload.clients || []);
      } else if (data.type === "queue_updated") {
        fetchServerStats();
        fetchServerLogs();
      }
    } catch (e) {
      console.error("[WS Data Error]:", e);
    }
  };

  ws.onclose = () => {
    document.getElementById("txtServerStatus").innerText = "Ulanish uzildi...";
    document.querySelector(".pulse-dot").style.background = "#ef4444";
    setTimeout(connectWebSocket, 3000); // 3 soniyada avto-qayta ulanish
  };
}

// -------------------------------------------------------------
// POLING VA STATISTIKALAR
// -------------------------------------------------------------
function startStatsPolling() {
  fetchServerStats();
  fetchServerLogs();
  fetchClusterNodes();
  pollTimer = setInterval(() => {
    fetchServerStats();
    fetchClusterNodes();
  }, 2500);
}

async function fetchServerStats() {
  try {
    const res = await fetch("/api/server-stats");
    const data = await res.json();

    if (data.success && data.stats) {
      const s = data.stats;
      document.getElementById("metricUptime").innerText = s.uptimeFormatted;
      document.getElementById("metricTime").innerText = `Server: ${s.serverTime} (${s.ip})`;
      document.getElementById("txtServerIp").innerText = `${s.ip}:3000`;

      document.getElementById("metricMemory").innerText = `${s.memoryRssMb} MB`;
      document.getElementById("metricHeap").innerText = `Heap: ${s.memoryHeapMb} MB`;

      document.getElementById("metricClients").innerText = `${s.connectedClientsCount} ta`;
      document.getElementById("badgeClientsCount").innerText = `${s.connectedClientsCount} ta ulangan`;

      document.getElementById("metricQueue").innerText = `${s.totalPatientsToday} ta`;
      document.getElementById("metricDevicesCount").innerText = `${s.activeDevicesCount} ta apparat faol`;

      if (Array.isArray(s.connectedClients)) {
        renderConnectedClients(s.connectedClients);
      }
    }
  } catch (err) {
    console.warn("Stats fetch error:", err.message);
  }

  // Apparatlar ro'yxatini ham yangilash
  fetchDevices();
}

async function fetchDevices() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.success && data.devices) {
      renderDevices(data.devices, data.queue || []);
    }
  } catch (e) {}
}

async function fetchServerLogs() {
  try {
    const res = await fetch("/api/server-logs?limit=40");
    const data = await res.json();
    if (data.success && Array.isArray(data.logs)) {
      renderLogs(data.logs);
    }
  } catch (e) {}
}

async function fetchClusterNodes() {
  try {
    const res = await fetch("/api/cluster/nodes");
    const data = await res.json();
    if (data.success && Array.isArray(data.nodes)) {
      renderClusterNodes(data.nodes, data.maxNodes || 5);
    }
  } catch (e) {}
}

function renderClusterNodes(nodes, maxNodes = 5) {
  const container = document.getElementById("clusterNodesContainer");
  const badge = document.getElementById("badgeClusterCount");
  if (!container) return;

  const count = nodes.length;
  if (badge) {
    badge.innerText = `${count} / ${maxNodes} ta Server Faol`;
    if (count >= maxNodes) {
      badge.className = "badge badge-warning";
    } else {
      badge.className = "badge badge-success";
    }
  }

  container.innerHTML = nodes.map((n, idx) => `
    <div class="device-item" style="padding:10px 14px; background:${n.isSelf ? '#172554' : '#1f2937'}; border-color:${n.isSelf ? '#3b82f6' : '#374151'};">
      <div class="device-info">
        <h4 style="font-size:13px;">
          <i class="fa-solid fa-server" style="color:${n.isSelf ? '#60a5fa' : '#34d399'};"></i> 
          Node #${idx + 1}: ${escapeHtml(n.computerName)}
        </h4>
        <div class="device-tags">
          <span class="mini-tag" style="font-family:monospace; color:#93c5fd;">IP: ${n.ip}:${n.port}</span>
          ${n.isSelf ? '<span class="mini-tag" style="background:#1d4ed8; color:#fff;">Ushbu Server</span>' : '<span class="mini-tag" style="background:#065f46; color:#a7f3d0;">Zaxira Server</span>'}
        </div>
      </div>
      <div class="device-status-badge">
        <span class="status-free" style="color:#34d399;"><i class="fa-solid fa-circle" style="font-size:8px;"></i> 🟢 Faol (100% Sinxron)</span>
        <div style="font-size:10.5px; color:#9ca3af; margin-top:2px;">Bemorlar: ${n.queueCount} ta</div>
      </div>
    </div>
  `).join("");
}

// -------------------------------------------------------------
// RENDERING
// -------------------------------------------------------------
function renderDevices(devices, queue) {
  const container = document.getElementById("devicesListContainer");
  if (!container) return;

  container.innerHTML = devices.map(dev => {
    const devQueue = queue.filter(p => p.deviceId === dev.id);
    const inProgress = devQueue.find(p => p.status === "in_progress");
    const waiting = devQueue.filter(p => p.status === "waiting" || p.status === "preparing");

    let statusHtml = inProgress 
      ? `<span class="status-busy">🟢 Xonada: ${escapeHtml(inProgress.patientName)} (#${inProgress.ticketNumber})</span>`
      : `<span class="status-free">⚪ Bo'sh (Kutayotgan: ${waiting.length} ta)</span>`;

    return `
      <div class="device-item">
        <div class="device-info">
          <h4><i class="fa-solid fa-laptop-medical" style="color:#60a5fa;"></i> ${escapeHtml(dev.name)}</h4>
          <div class="device-tags">
            <span class="mini-tag">${dev.room}</span>
            <span class="mini-tag">${dev.type}</span>
            ${dev.supportsContrast ? '<span class="mini-tag contrast">💉 Injektor bor</span>' : ''}
          </div>
        </div>
        <div class="device-status-badge">
          ${statusHtml}
        </div>
      </div>
    `;
  }).join("");
}

function renderConnectedClients(clients) {
  const tbody = document.getElementById("clientsTableBody");
  if (!tbody) return;

  if (clients.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Hozircha ulangan mijozlar yo'q</td></tr>`;
    return;
  }

  tbody.innerHTML = clients.map(c => `
    <tr>
      <td><strong style="color:#93c5fd; font-family:monospace;">${c.ip}</strong></td>
      <td><span class="badge ${c.role === 'tv' ? 'badge-success' : 'badge-warning'}">${c.deviceName || c.role}</span></td>
      <td><span style="color:#9ca3af;">${c.room || 'all'}</span></td>
      <td><span style="color:#34d399; font-family:monospace;">${c.latencyMs}ms</span></td>
      <td><span style="color:#6b7280; font-size:11px;">${c.connectedAt || '-'}</span></td>
    </tr>
  `).join("");
}

function renderLogs(logs) {
  const container = document.getElementById("logsFeedContainer");
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; color:#6b7280;">Hozircha loglar mavjud emas</div>`;
    return;
  }

  container.innerHTML = logs.map(l => {
    let typeClass = "log-get";
    if (l.method === "POST") typeClass = "log-post";
    else if (l.method.includes("WS")) typeClass = "log-ws";
    else if (l.status >= 400 || l.method === "ERROR") typeClass = "log-err";

    return `
      <div class="log-entry ${typeClass}">
        <div class="log-main">
          <span class="log-time">${l.timeFormatted || ''}</span>
          <span class="log-ip">${l.ip}</span>
          <span class="log-method">${l.method}</span>
          <span class="log-path">${l.path}</span>
          ${l.details ? `<span class="log-details">• ${escapeHtml(l.details)}</span>` : ''}
        </div>
        <div class="log-dur">${l.durationMs}ms</div>
      </div>
    `;
  }).join("");
}

// -------------------------------------------------------------
// TEZKOR BUYRUQLAR
// -------------------------------------------------------------
async function handleManualBackup() {
  try {
    const res = await fetch("/api/server-backup", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Zaxira nusxa saqlandi: data/backups/${data.path}`);
      fetchServerLogs();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

async function handleResetQueue() {
  if (!confirm("⚠️ DIQQAT! Bugungi barcha navbat tozalanadi (avval zaxira nusxa olinadi). Rozimisiz?")) {
    return;
  }

  try {
    const res = await fetch("/api/server-reset-queue", { method: "POST" });
    const data = await res.json();
    if (data.success) {
      alert("✅ Navbat muvaffaqiyatli tozalandi!");
      fetchServerStats();
      fetchServerLogs();
    }
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

async function handleClearLogs() {
  try {
    await fetch("/api/server-logs/clear", { method: "POST" });
    renderLogs([]);
  } catch (e) {}
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
