/**
 * Karmed Radiologiya & MRT Navbat Markazi - Unified Workspace App (app.js)
 */

let allServices = [];
let todayQueue = [];
let currentTab = 'karmed';
let ws = null;
let currentKarmedHost = '213.230.91.59:2025';
let activeKarmedUrl = 'http://213.230.91.59:2025/Radiology/Rbys.aspx';

document.addEventListener("DOMContentLoaded", () => {
  initKarmedConnection();
  initServices();
  initWebSocket();
  fetchTodayQueue();
  pollClusterStatus();
  setInterval(pollClusterStatus, 5000);
});

// -------------------------------------------------------------
// KARMED ALOQASINI ANIQLASH VA FAILOVER (192.168.150.111 -> 213.230.91.59)
// -------------------------------------------------------------
async function initKarmedConnection() {
  const frame = document.getElementById("frameKarmed");
  const overlay = document.getElementById("karmedFallbackOverlay");

  // Har doim bir xil origin (Same-Origin) proksi orqali yuklash (kuki va AJAX to'siqsiz ishlashi uchun)
  if (frame && (!frame.src || !frame.src.includes("/Radiology/Rbys.aspx"))) {
    frame.src = "/Radiology/Rbys.aspx";
  }

  try {
    const res = await fetch("/api/karmed-url");
    const data = await res.json();
    if (data.success && data.url) {
      activeKarmedUrl = data.url;
      currentKarmedHost = data.host;
      updateKarmedUI(data.host, data.isLocal);
    }
  } catch (err) {
    updateKarmedUI('192.168.150.111:2025', true);
  }

  if (frame) {
    frame.onload = () => {
      if (overlay) overlay.style.display = "none";
    };
  }
}

function updateKarmedUI(host, isLocal) {
  const dot = document.getElementById("karmedHostDot");
  const txt = document.getElementById("txtKarmedHost");
  if (txt) {
    txt.innerText = isLocal ? `Karmed: 192.168.150.111` : `Karmed: 213.230.91.59`;
  }
  if (dot) {
    dot.className = isLocal ? "host-dot" : "host-dot remote";
  }
}

window.switchKarmedHost = function(targetHost) {
  const frame = document.getElementById("frameKarmed");
  const overlay = document.getElementById("karmedFallbackOverlay");

  if (targetHost.includes("192.168.150.111")) {
    currentKarmedHost = "192.168.150.111:2025";
    activeKarmedUrl = "http://192.168.150.111:2025/Radiology/Rbys.aspx";
    updateKarmedUI(currentKarmedHost, true);
  } else {
    currentKarmedHost = "213.230.91.59:2025";
    activeKarmedUrl = "http://213.230.91.59:2025/Radiology/Rbys.aspx";
    updateKarmedUI(currentKarmedHost, false);
  }

  if (frame) {
    frame.src = "/Radiology/Rbys.aspx";
  }
  if (overlay) {
    overlay.style.display = "none";
  }
};

window.toggleKarmedHost = function() {
  if (currentKarmedHost.includes("192.168.150.111")) {
    switchKarmedHost("213.230.91.59");
  } else {
    switchKarmedHost("192.168.150.111");
  }
};

window.openKarmedInNewTab = function() {
  window.open(activeKarmedUrl, "_blank");
};

// -------------------------------------------------------------
// VIEW SWITCHING
// -------------------------------------------------------------
function switchView(tabKey) {
  currentTab = tabKey;

  // Tabs
  document.querySelectorAll(".nav-tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeTabBtn = document.getElementById("tab" + capitalize(tabKey));
  if (activeTabBtn) activeTabBtn.classList.add("active");

  // Frames
  document.querySelectorAll(".view-frame").forEach(frame => frame.classList.remove("active"));
  const activeFrame = document.getElementById("frame" + capitalize(tabKey));
  if (activeFrame) activeFrame.classList.add("active");

  // Karmed bo'lmagan darchalarda yon panelni avtomat yopish mumkin yoki ochiq qoldirish
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function refreshCurrentFrame() {
  const frame = document.getElementById("frame" + capitalize(currentTab));
  if (frame) {
    frame.src = frame.src;
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// -------------------------------------------------------------
// TEZKOR NAVBAT DRAWER TOGGLE
// -------------------------------------------------------------
function toggleQuickQueueDrawer() {
  const drawer = document.getElementById("quickQueueDrawer");
  const btn = document.getElementById("btnToggleDrawer");
  if (!drawer) return;

  const isCollapsed = drawer.classList.toggle("collapsed");
  if (btn) {
    btn.classList.toggle("active", !isCollapsed);
  }
}

// -------------------------------------------------------------
// XIZMATLAR KATALOGINI YUKLASH
// -------------------------------------------------------------
async function initServices() {
  try {
    const res = await fetch("/api/services");
    const data = await res.json();
    if (data.success && Array.isArray(data.services)) {
      allServices = data.services;
      const select = document.getElementById("quickServiceSelect");
      if (select) {
        select.innerHTML = '<option value="">-- Tekshiruv sohasini tanlang --</option>' +
          allServices.map(s => `
            <option value="${s.code}" data-contrast="${s.contrast ? 'yes' : 'no'}" data-device="${s.deviceType}">
              [${s.code}] ${s.name} (${s.duration} daqiqa)
            </option>
          `).join("");
      }
    }
  } catch (e) {
    console.error("[Workspace Services Error]:", e);
  }
}

function onServiceSelected() {
  const select = document.getElementById("quickServiceSelect");
  const selectedOpt = select.options[select.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) return;

  const contrast = selectedOpt.getAttribute("data-contrast");
  const device = selectedOpt.getAttribute("data-device");

  const contrastSelect = document.getElementById("quickContrastSelect");
  const deviceSelect = document.getElementById("quickDeviceSelect");

  if (contrast === "yes" && contrastSelect) {
    contrastSelect.value = "yes";
  }

  if (device === "MSKT" && deviceSelect) {
    deviceSelect.value = "mskt";
  } else if (device === "MRT" && deviceSelect && deviceSelect.value === "mskt") {
    deviceSelect.value = "auto";
  }
}

// -------------------------------------------------------------
// TEZKOR NAVBATGA QO'SHISH & CHIPTA
// -------------------------------------------------------------
async function handleQuickQueueSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById("quickPatientName");
  const idInput = document.getElementById("quickPatientId");
  const phoneInput = document.getElementById("quickPhone");
  const serviceSelect = document.getElementById("quickServiceSelect");
  const deviceSelect = document.getElementById("quickDeviceSelect");
  const contrastSelect = document.getElementById("quickContrastSelect");
  const submitBtn = document.getElementById("btnQuickSubmit");

  const serviceCode = serviceSelect.value;
  const serviceObj = allServices.find(s => s.code === serviceCode) || {
    code: serviceCode,
    name: serviceSelect.options[serviceSelect.selectedIndex].text,
    duration: 20
  };

  const isContrast = contrastSelect.value === "yes";
  let targetDeviceId = deviceSelect.value;
  if (targetDeviceId === "auto") {
    targetDeviceId = isContrast ? "mrt1" : "mrt2";
  }

  const payload = {
    patientName: nameInput.value.trim().toUpperCase(),
    patientId: idInput.value.trim(),
    phone: phoneInput.value.trim(),
    deviceId: targetDeviceId,
    isContrast: isContrast,
    services: [serviceObj]
  };

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...';

  try {
    const res = await fetch("/api/queue/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success && data.patient) {
      // 1. Chiptani chop etish
      printThermalTicket(data.patient);

      // 2. Formani tozalash
      nameInput.value = "";
      idInput.value = "";
      phoneInput.value = "";
      serviceSelect.selectedIndex = 0;
      contrastSelect.value = "no";
      deviceSelect.value = "auto";

      // 3. Ro'yxatni yangilash
      fetchTodayQueue();
    } else {
      alert("Xatolik: " + (data.error || "Navbatga qo'shib bo'lmadi"));
    }
  } catch (err) {
    alert("Server bilan aloqa xatosi: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-print"></i> Navbatga Qo\'shish & Chipta';
  }
}

// -------------------------------------------------------------
// CHIPTA CHOP ETISH
// -------------------------------------------------------------
function printThermalTicket(patient) {
  const printWindow = window.open('', '_blank', 'width=350,height=500');
  if (!printWindow) return;

  const servicesText = (patient.services || []).map(s => s.name).join(', ') || 'MRT Tekshiruvi';
  const roomName = patient.deviceId === 'mrt1' ? '1-MRT (101-xona)' : (patient.deviceId === 'mrt2' ? '2-MRT (102-xona)' : 'MSKT Xonasi');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chipta #${patient.ticketNumber}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', monospace;
          width: 76mm;
          margin: 2mm auto;
          text-align: center;
          color: #000;
        }
        h2 { font-size: 16px; margin: 2px 0; }
        h1 { font-size: 34px; margin: 6px 0; letter-spacing: 2px; }
        .room { font-size: 15px; font-weight: bold; margin: 4px 0; border: 1px dashed #000; padding: 4px; }
        .info { font-size: 11px; text-align: left; margin: 8px 0; line-height: 1.4; }
        .footer { font-size: 10px; margin-top: 10px; border-top: 1px dashed #000; padding-top: 4px; }
      </style>
    </head>
    <body>
      <h2>🏥 RESPUBLIKA ONKOLOGIYA</h2>
      <div>Tomografiya (MRT & MSKT) Markazi</div>
      <hr style="border:none; border-top:1px dashed #000; margin: 6px 0;">
      
      <div>NAVBAT RAQAMI:</div>
      <h1>${patient.ticketNumber}</h1>
      
      <div class="room">${roomName}</div>
      
      <div class="info">
        <div><b>Bemor:</b> ${patient.patientName}</div>
        <div><b>Xizmat:</b> ${servicesText}</div>
        ${patient.isContrast ? '<div><b>Turi:</b> 💉 KONTRASTLI</div>' : ''}
        <div><b>Taxminiy vaqt:</b> ${patient.estimatedStartTime || '--:--'}</div>
        <div><b>Sana:</b> ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
      </div>
      
      <div class="footer">
        Iltimos, navbatingizni monitorda kuting!<br>
        Navbat chaqirilganda ovozli e'lon beriladi.
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, 250);
}

// -------------------------------------------------------------
// BUGUNGI NAVBATNI YUKLASH VA CHIQARISH
// -------------------------------------------------------------
async function fetchTodayQueue() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.success && Array.isArray(data.queue)) {
      todayQueue = data.queue;
      renderDrawerQueue(todayQueue);
    }
  } catch (e) {}
}

function renderDrawerQueue(queue) {
  const container = document.getElementById("quickQueueList");
  const countBadge = document.getElementById("quickQueueCount");
  if (!container) return;

  if (countBadge) countBadge.innerText = `${queue.length} ta`;

  if (queue.length === 0) {
    container.innerHTML = '<div style="color:#6b7280; text-align:center; padding:20px; font-size:12px;">Hozircha navbatda bemorlar yo\'q</div>';
    return;
  }

  // Oxirgi qo'shilganlar yuqorida
  const sorted = [...queue].reverse();

  container.innerHTML = sorted.map(p => {
    const devBadgeClass = p.deviceId === 'mrt1' ? 'badge-mrt1' : (p.deviceId === 'mrt2' ? 'badge-mrt2' : 'badge-mskt');
    const devName = p.deviceId === 'mrt1' ? 'MRT 1' : (p.deviceId === 'mrt2' ? 'MRT 2' : 'MSKT');
    const serviceName = (p.services || []).map(s => s.name).join(', ') || 'Tekshiruv';

    return `
      <div class="quick-queue-item">
        <div class="item-left">
          <span class="item-ticket">${p.ticketNumber}</span>
          <div class="item-details">
            <span class="item-name">${escapeHtml(p.patientName)}</span>
            <span class="item-service">${escapeHtml(serviceName)}</span>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
          <span class="item-badge ${devBadgeClass}">${devName}</span>
          <span style="font-size:10px; color:#6b7280;">${p.estimatedStartTime || ''}</span>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// -------------------------------------------------------------
// WEBSOCKET (REAL-TIME UPDATES)
// -------------------------------------------------------------
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "register", role: "workspace", deviceName: "Karmed Workspace" }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "queue_updated") {
          fetchTodayQueue();
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };
  } catch (e) {
    setTimeout(initWebSocket, 3000);
  }
}

// -------------------------------------------------------------
// KLASTER HOLATINI TEKSHIRISH
// -------------------------------------------------------------
async function pollClusterStatus() {
  try {
    const res = await fetch("/api/cluster/nodes");
    const data = await res.json();
    const statusTxt = document.getElementById("txtClusterStatus");
    if (data.success && statusTxt) {
      statusTxt.innerText = `Klaster: ${data.activeCount}/${data.maxNodes} Faol`;
    }
  } catch (e) {}
}
