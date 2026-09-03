/**
 * Karmed Radiologiya & MRT Navbat Markazi - Unified Workspace App (app.js)
 */

let allServices = [];
let todayQueue = [];
let currentTab = 'karmed';
let ws = null;
let currentKarmedHost = '213.230.91.59:2025';
let activeKarmedUrl = 'http://213.230.91.59:2025/Radiology/Rbys.aspx';
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  initKarmedConnection();
  setupKarmedIframeBridge();
  checkCurrentUser();
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
  if (activeFrame) {
    activeFrame.classList.add("active");

    // Agar frame oldin noto'g'ri URL ga o'tib ketgan bo'lsa, toza manzilini yuklash
    const expectedSrcs = {
      navbat: "/navbat-yozish/",
      tv: "/mrt-tv/",
      laborant: "/laborant/",
      dashboard: "/server-dashboard/",
      karmed: "/Radiology/Rbys.aspx"
    };

    const targetSrc = expectedSrcs[tabKey];
    if (targetSrc) {
      try {
        const curPath = activeFrame.contentWindow.location.pathname;
        if (!curPath || curPath.includes("login.html") || !curPath.includes(targetSrc.replace(/\//g, ''))) {
          activeFrame.src = targetSrc;
        }
      } catch (e) {
        if (!activeFrame.src || !activeFrame.src.includes(targetSrc)) {
          activeFrame.src = targetSrc;
        }
      }
    }
  }
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
// KARMED IFRAME INTEGRATSIYASI VA AQLLI NAVBATGA OLISH
// -------------------------------------------------------------
function setupKarmedIframeBridge() {
  const frame = document.getElementById("frameKarmed");
  if (!frame) return;

  function attachListeners() {
    try {
      const doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
      if (!doc || !doc.body) return;

      // Karmed jadvalidagi qator bosilganda darhol ma'lumotlarni o'qib olish
      doc.body.addEventListener("click", (e) => {
        const row = e.target.closest("tr");
        if (!row) return;

        // Header, Pager, Filter qatorlarini tashlab ketish
        if (row.querySelector("th") || (row.className && (row.className.includes("Filter") || row.className.includes("Pager")))) return;

        // Karmed pastki jadvalini yangilashi uchun 120ms kutish
        setTimeout(() => {
          const patient = extractPatientFromKarmedDoc(doc, row);
          if (patient && (patient.name || patient.id)) {
            autoFillQuickQueue(patient);
          }
        }, 120);

        // Agar pastki tekshiruvlar jadvali biroz kechikib yangilansa:
        setTimeout(() => {
          const patient = extractPatientFromKarmedDoc(doc, row);
          if (patient && patient.service) {
            autoFillQuickQueue(patient);
          }
        }, 500);
      }, true);

      console.log("[Karmed Workspace] Iframe DOM tinglovchisi ulandi!");
    } catch (err) {
      console.warn("[Karmed Workspace] Iframe bridge ulanish:", err.message);
    }
  }

  frame.addEventListener("load", attachListeners);
  attachListeners();
}

// Kengaytma (Extension) postMessage orqali yuborganda ham qabul qilish:
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === 'KARMED_PATIENT_SELECTED' && event.data.patient) {
    console.log("[Karmed Workspace] Kengaytmadan bemor qabul qilindi:", event.data.patient);
    autoFillQuickQueue(event.data.patient);
  }
});

function extractPatientFromKarmedDoc(doc, clickedRow) {
  try {
    if (!doc) return null;

    // 1. Tanlangan bemor qatori (Focused / Magenta yoki bosilgan qator)
    let focusedRow = doc.querySelector(".dxgvFocusedRow_DevEx, .dxgvSelectedRow_DevEx") || clickedRow;
    if (!focusedRow) {
      const allRows = doc.querySelectorAll("tr");
      for (const r of allRows) {
        const bg = (r.style.backgroundColor || "").toLowerCase();
        if (bg.includes("magenta") || bg.includes("rgb(255, 0, 255)") || bg.includes("#ff00ff") || bg.includes("rgb(255, 105, 180)") || bg.includes("pink")) {
          focusedRow = r;
          break;
        }
      }
    }

    if (!focusedRow) return null;

    const cells = Array.from(focusedRow.querySelectorAll("td"));
    if (cells.length < 3) return null;

    const cellTexts = cells.map(c => (c.innerText || "").trim());

    // Ustunlarni aniqlash
    let surname = "";
    let name = "";
    let middle = "";
    let patientId = "";
    let pinfl = "";

    const table = focusedRow.closest("table");
    if (table) {
      const headerThs = Array.from(table.querySelectorAll("th, td.dxgvHeader_DevEx, tr:first-child td")).map(h => (h.innerText || "").trim().toLowerCase());
      headerThs.forEach((h, idx) => {
        if (idx >= cellTexts.length) return;
        const val = cellTexts[idx];
        if (!val) return;
        if (h.includes("familiya")) surname = val;
        else if (h.includes("ism") && !h.includes("ota") && !h.includes("sharif")) name = val;
        else if (h.includes("ota") || h.includes("sharif")) middle = val;
        else if (h.includes("bemor id") || (h.includes("id") && !patientId)) patientId = val;
        else if (h.includes("pinfl") || h.includes("jshshir")) pinfl = val;
      });
    }

    if (!surname && cellTexts[0] && isNaN(cellTexts[0])) surname = cellTexts[0];
    if (!name && cellTexts[1] && isNaN(cellTexts[1])) name = cellTexts[1];
    if (!patientId) {
      for (const val of cellTexts) {
        if (/^\d{4,8}$/.test(val)) {
          patientId = val;
          break;
        }
      }
    }

    const fullName = `${surname} ${name} ${middle}`.trim();
    if (!fullName && !patientId) return null;

    // 2. Pastki jadvaldan tekshiruv (Xizmat) ma'lumotlarini olish
    let serviceCode = "";
    let serviceName = "";
    let isContrast = false;

    const allDocRows = doc.querySelectorAll("tr");
    for (const r of allDocRows) {
      const rowCells = Array.from(r.querySelectorAll("td"));
      if (rowCells.length < 2) continue;
      const texts = rowCells.map(c => (c.innerText || "").trim());

      // R kodini qidirish (R157, R184, R92, R143 va h.k.)
      const codeCellIdx = texts.findIndex(t => /^R\s*\d{2,5}$/i.test(t));
      if (codeCellIdx !== -1) {
        serviceCode = texts[codeCellIdx].toUpperCase();
        if (texts[codeCellIdx + 1] && texts[codeCellIdx + 1].length > 2) {
          serviceName = texts[codeCellIdx + 1];
        } else if (codeCellIdx > 0 && texts[codeCellIdx - 1].length > 2) {
          serviceName = texts[codeCellIdx - 1];
        }
        break;
      }
    }

    if (!serviceName) {
      for (const r of allDocRows) {
        const text = (r.innerText || "").trim();
        if ((text.includes("Mrt") || text.includes("MRT") || text.includes("Mskt") || text.includes("MSKT")) && text.length < 80 && !text.includes("Qidiruv") && !text.includes("Markazi")) {
          serviceName = text;
          break;
        }
      }
    }

    // Kontrast bor-yo'qligini aniqlash:
    const sNameLower = serviceName.toLowerCase();
    if (sNameLower.includes("kontrastsiz") || sNameLower.includes("bez kontrast") || sNameLower.includes("oddiy") || sNameLower.includes("native")) {
      isContrast = false;
    } else if (sNameLower.includes("kontrast") || sNameLower.includes("bilan") || sNameLower.includes("injektor") || sNameLower.includes("dinamik")) {
      isContrast = true;
    }

    return {
      name: fullName,
      id: patientId,
      pinfl: pinfl,
      serviceCode: serviceCode,
      service: serviceName,
      isContrast: isContrast
    };
  } catch (err) {
    console.warn("[extractPatientFromKarmedDoc Error]:", err);
    return null;
  }
}

// -------------------------------------------------------------
// AQLLI QURILMA TANLASH ALGORITMI
// -------------------------------------------------------------
function determineSmartDevice(patientData) {
  const serviceName = (patientData.service || "").toUpperCase();
  const serviceCode = (patientData.serviceCode || "").toUpperCase();
  const isContrast = Boolean(patientData.isContrast);

  // 1. Agar MSKT / KT tekshiruvi bo'lsa
  if (serviceName.includes("MSKT") || serviceName.includes(" KT ") || serviceCode.startsWith("R2") || serviceName.includes("KOMPYUTER TOMOGRAFIYA")) {
    const msktWaiting = todayQueue.filter(p => p.deviceId === 'mskt' && p.status === 'waiting').length;
    return {
      deviceId: "mskt",
      deviceName: "MSKT 1",
      badgeText: `🖥️ <strong>MSKT 1</strong> (Tomograf tanlandi | Navbatda: <strong>${msktWaiting}</strong> ta bemor)`
    };
  }

  // 2. Agar KONTRASTLI MRT bo'lsa -> Faqat MRT 1 (Injektorli)
  if (isContrast) {
    const mrt1Waiting = todayQueue.filter(p => (p.deviceId === 'mrt1' || p.deviceId === 'mrt') && p.status === 'waiting').length;
    return {
      deviceId: "mrt1",
      deviceName: "MRT 1 (Injektor)",
      badgeText: `💉 <strong>MRT 1</strong> (Injektorli apparat | Kontrastli MRT | Navbatda: <strong>${mrt1Waiting}</strong> ta bemor)`
    };
  }

  // 3. Agar KONTRASTSIZ (Oddiy) MRT bo'lsa:
  const mrt1Waiting = todayQueue.filter(p => (p.deviceId === 'mrt1' || p.deviceId === 'mrt') && p.status === 'waiting').length;
  const mrt2Waiting = todayQueue.filter(p => p.deviceId === 'mrt2' && p.status === 'waiting').length;

  if (mrt2Waiting <= mrt1Waiting) {
    return {
      deviceId: "mrt2",
      deviceName: "MRT 2 (3.0T)",
      badgeText: `⚡ <strong>MRT 2</strong> (Optimal tezkor navbat | Navbatda: <strong>${mrt2Waiting}</strong> ta bemor)`
    };
  } else {
    return {
      deviceId: "mrt1",
      deviceName: "MRT 1 (1.5T)",
      badgeText: `⚡ <strong>MRT 1</strong> (Kamroq kutish vaqti | Navbatda: <strong>${mrt1Waiting}</strong> ta bemor)`
    };
  }
}

// -------------------------------------------------------------
// FORMANI AVTOMAT TO'LDIRISH VA TAYYOR TURISH
// -------------------------------------------------------------
function autoFillQuickQueue(patientData) {
  if (!patientData) return;

  const nameInput = document.getElementById("quickPatientName");
  const idInput = document.getElementById("quickPatientId");
  const phoneInput = document.getElementById("quickPhone");
  const serviceSelect = document.getElementById("quickServiceSelect");
  const contrastSelect = document.getElementById("quickContrastSelect");
  const deviceSelect = document.getElementById("quickDeviceSelect");
  const submitBtn = document.getElementById("btnQuickSubmit");
  const recBox = document.getElementById("smartRecommendationBox");
  const recDesc = document.getElementById("smartBoxDesc");

  // 1. Bemor F.I.SH va ID
  if (nameInput && patientData.name) {
    nameInput.value = patientData.name.toUpperCase();
  }
  if (idInput && patientData.id) {
    idInput.value = patientData.id;
  }
  if (phoneInput && patientData.phone) {
    phoneInput.value = patientData.phone;
  }

  // 2. Kontrast
  const isContrast = Boolean(patientData.isContrast);
  if (contrastSelect) {
    contrastSelect.value = isContrast ? "yes" : "no";
  }

  // 3. Tekshiruv sohasi (Xizmat)
  if (serviceSelect && (patientData.serviceCode || patientData.service)) {
    let matched = false;
    for (let i = 0; i < serviceSelect.options.length; i++) {
      const opt = serviceSelect.options[i];
      if (patientData.serviceCode && opt.value === patientData.serviceCode) {
        serviceSelect.selectedIndex = i;
        matched = true;
        break;
      }
      if (patientData.service && opt.text.toLowerCase().includes(patientData.service.toLowerCase())) {
        serviceSelect.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched && patientData.service) {
      const val = patientData.serviceCode || ("R_AUTO_" + Date.now());
      const label = (patientData.serviceCode ? `[${patientData.serviceCode}] ` : "") + patientData.service;
      const opt = new Option(label, val, true, true);
      opt.setAttribute("data-contrast", isContrast ? "yes" : "no");
      opt.setAttribute("data-device", patientData.service.toUpperCase().includes("MSKT") ? "MSKT" : "MRT");
      serviceSelect.add(opt);
    }
  }

  // 4. AQLLI QURILMA TANLASH
  const smart = determineSmartDevice(patientData);
  if (deviceSelect) {
    deviceSelect.value = smart.deviceId;
  }

  if (recBox && recDesc) {
    recDesc.innerHTML = smart.badgeText;
    recBox.style.display = "flex";
  }

  // 5. Tezkor navbat darchasini ochish
  const drawer = document.getElementById("quickQueueDrawer");
  if (drawer && drawer.classList.contains("collapsed")) {
    drawer.classList.remove("collapsed");
    const btnToggle = document.getElementById("btnToggleDrawer");
    if (btnToggle) btnToggle.classList.add("active");
  }

  // 6. Tugmani yashil pulsatsiya bilan tayyor holga keltirish
  if (submitBtn) {
    submitBtn.classList.add("ready-pulse");
    submitBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${smart.deviceName} ga Navbatga Qo'yish & Chipta`;
    submitBtn.title = "Barcha ma'lumotlar olindi! Navbatga qo'yish uchun bosing yoki Enter bosing.";
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
      submitBtn.classList.remove("ready-pulse");
      const recBox = document.getElementById("smartRecommendationBox");
      if (recBox) recBox.style.display = "none";

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

// -------------------------------------------------------------
// FOYDALANUVCHI SESSIYASINI VA ROLLRINI TEKSHIRISH
// -------------------------------------------------------------
async function checkCurrentUser() {
  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
  if (!token) {
    currentUser = null;
    applyRolePermissions(null);
    return;
  }

  try {
    const res = await fetch("/api/auth/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      applyRolePermissions(currentUser);
    } else {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      currentUser = null;
      applyRolePermissions(null);
    }
  } catch (e) {
    const cached = localStorage.getItem("auth_user");
    if (cached) {
      currentUser = JSON.parse(cached);
      applyRolePermissions(currentUser);
    } else {
      currentUser = null;
      applyRolePermissions(null);
    }
  }
}

window.onAuthStateChanged = function(user) {
  currentUser = user;
  applyRolePermissions(user);
};

// -------------------------------------------------------------
// ROLLIK RUXSATLAR TIZIMI (DYNAMIC VIEW GATING)
// -------------------------------------------------------------
function applyRolePermissions(user) {
  const btnOpenLogin = document.getElementById("btnOpenLogin");
  const authUserWrap = document.getElementById("authUserWrap");
  const userAvatarLetter = document.getElementById("userAvatarLetter");
  const userNavName = document.getElementById("userNavName");
  const userNavRole = document.getElementById("userNavRole");

  const tabKarmed = document.getElementById("tabKarmed");
  const tabNavbat = document.getElementById("tabNavbat");
  const tabTv = document.getElementById("tabTv");
  const tabLaborant = document.getElementById("tabLaborant");
  const tabStaff = document.getElementById("tabStaff");
  const tabDashboard = document.getElementById("tabDashboard");

  const btnToggleDrawer = document.getElementById("btnToggleDrawer");
  const clusterBadge = document.getElementById("clusterBadge");
  const quickQueueDrawer = document.getElementById("quickQueueDrawer");

  // 1. TIZIMGA KIRMAGAN FOYDALANUVCHI (ANONYMOUS / GUEST)
  if (!user) {
    if (btnOpenLogin) btnOpenLogin.style.display = "inline-flex";
    if (authUserWrap) authUserWrap.style.display = "none";

    // Faqat Karmed ko'rinadi, qolgan barcha oynalar mutlaqo yashirin!
    if (tabKarmed) tabKarmed.style.display = "inline-flex";
    if (tabNavbat) tabNavbat.style.display = "none";
    if (tabTv) tabTv.style.display = "none";
    if (tabLaborant) tabLaborant.style.display = "none";
    if (tabStaff) tabStaff.style.display = "none";
    if (tabDashboard) tabDashboard.style.display = "none";

    if (btnToggleDrawer) btnToggleDrawer.style.display = "none";
    if (clusterBadge) clusterBadge.style.display = "none";

    if (quickQueueDrawer) quickQueueDrawer.classList.add("collapsed");

    switchView("karmed");
    return;
  }

  // 2. TIZIMGA KIRGAN FOYDALANUVCHI (AUTHENTICATED USER)
  if (btnOpenLogin) btnOpenLogin.style.display = "none";
  if (authUserWrap) authUserWrap.style.display = "flex";

  if (userAvatarLetter) userAvatarLetter.innerText = (user.name ? user.name[0] : user.login[0]).toUpperCase();
  if (userNavName) userNavName.innerText = user.name || user.login;
  if (userNavRole) userNavRole.innerText = formatRoleName(user.role);

  // Tezkor navbat darchasi tugmasini ko'rsatish
  if (btnToggleDrawer) btnToggleDrawer.style.display = "inline-flex";

  // Har doim Karmed ochiq
  if (tabKarmed) tabKarmed.style.display = "inline-flex";

  // Agar frame oldin 404 ga tushgan bo'lsa, toza manzillarga yo'naltirish
  const expectedIframes = [
    { id: "frameNavbat", src: "/navbat-yozish/" },
    { id: "frameTv", src: "/mrt-tv/" },
    { id: "frameLaborant", src: "/laborant/" },
    { id: "frameDashboard", src: "/server-dashboard/" }
  ];
  expectedIframes.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      try {
        const curPath = el.contentWindow.location.pathname;
        if (!curPath || curPath.includes("login.html") || !curPath.includes(item.src.replace(/\//g, ''))) {
          el.src = item.src;
        }
      } catch (e) {
        if (!el.src || !el.src.includes(item.src)) el.src = item.src;
      }
    }
  });

  const role = user.role || 'tibbiy_navbat';

  if (role === 'tibbiy_navbat') {
    // Tibbiy navbatga qo'yuvchi: Karmed, Navbatga Yozish, TV Tablo, Tezkor navbat
    if (tabNavbat) tabNavbat.style.display = "inline-flex";
    if (tabTv) tabTv.style.display = "inline-flex";
    if (tabLaborant) tabLaborant.style.display = "none";
    if (tabStaff) tabStaff.style.display = "none";
    if (tabDashboard) tabDashboard.style.display = "none";
    if (clusterBadge) clusterBadge.style.display = "none";
  } else if (role === 'laborant') {
    // Laborant: Karmed, Navbat, TV Tablo, Laborant Portali, Tezkor navbat
    if (tabNavbat) tabNavbat.style.display = "inline-flex";
    if (tabTv) tabTv.style.display = "inline-flex";
    if (tabLaborant) tabLaborant.style.display = "inline-flex";
    if (tabStaff) tabStaff.style.display = "none";
    if (tabDashboard) tabDashboard.style.display = "none";
    if (clusterBadge) clusterBadge.style.display = "none";
  } else if (role === 'super_admin') {
    // Super Admin: Karmed, Navbat, TV Tablo, Laborant, Xodimlar Nazorati, Tezkor navbat
    if (tabNavbat) tabNavbat.style.display = "inline-flex";
    if (tabTv) tabTv.style.display = "inline-flex";
    if (tabLaborant) tabLaborant.style.display = "inline-flex";
    if (tabStaff) tabStaff.style.display = "inline-flex";
    if (tabDashboard) tabDashboard.style.display = "none";
    if (clusterBadge) clusterBadge.style.display = "none";
  } else if (role === 'server_nazoratchisi' || role === 'admin') {
    // Server Nazoratchisi: BARCHA DARCHALARGA TO'LIQ RUXSAT!
    if (tabNavbat) tabNavbat.style.display = "inline-flex";
    if (tabTv) tabTv.style.display = "inline-flex";
    if (tabLaborant) tabLaborant.style.display = "inline-flex";
    if (tabStaff) tabStaff.style.display = "inline-flex";
    if (tabDashboard) tabDashboard.style.display = "inline-flex";
    if (clusterBadge) clusterBadge.style.display = "inline-flex";
  }
}

function formatRoleName(role) {
  switch (role) {
    case 'tibbiy_navbat': return 'Navbatchi';
    case 'laborant': return 'Laborant';
    case 'super_admin': return 'Super Admin';
    case 'server_nazoratchisi': return 'Server Nazorati';
    case 'admin': return 'Admin';
    default: return role || 'Xodim';
  }
}

// -------------------------------------------------------------
// LOGIN MODAL VA AVTORIZATSIYA
// -------------------------------------------------------------
function openLoginModal() {
  const modal = document.getElementById("modalLogin");
  const errBox = document.getElementById("modalLoginError");
  if (errBox) errBox.style.display = "none";
  if (modal) modal.style.display = "flex";
  const inp = document.getElementById("modalLoginUser");
  if (inp) {
    inp.focus();
    inp.select();
  }
}

function closeLoginModal() {
  const modal = document.getElementById("modalLogin");
  if (modal) modal.style.display = "none";
}

async function handleModalLogin(e) {
  e.preventDefault();
  const loginInput = document.getElementById("modalLoginUser");
  const passInput = document.getElementById("modalLoginPass");
  const errBox = document.getElementById("modalLoginError");
  const submitBtn = document.getElementById("btnSubmitLogin");

  const login = loginInput.value.trim();
  const password = passInput.value.trim();

  if (!login || !password) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tekshirilmoqda...';
  if (errBox) errBox.style.display = "none";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password })
    });
    const data = await res.json();

    if (data.success && data.token && data.user) {
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      currentUser = data.user;
      applyRolePermissions(currentUser);
      closeLoginModal();
      loginInput.value = "";
      passInput.value = "";
    } else {
      if (errBox) {
        errBox.innerText = "❌ " + (data.error || "Login yoki parol noto'g'ri!");
        errBox.style.display = "block";
      }
    }
  } catch (err) {
    if (errBox) {
      errBox.innerText = "❌ Server bilan aloqa xatosi: " + err.message;
      errBox.style.display = "block";
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Kirish';
  }
}

function handleLogout() {
  if (!confirm("Tizimdan chiqmoqchimisiz?")) return;
  const token = localStorage.getItem("auth_token");
  fetch("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  }).finally(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    currentUser = null;
    applyRolePermissions(null);
  });
}

// -------------------------------------------------------------
// SHAXSIY PROFILNI BOSHQARISH (MY PROFILE)
// -------------------------------------------------------------
function openProfileModal() {
  if (!currentUser) {
    openLoginModal();
    return;
  }

  const modal = document.getElementById("modalProfile");
  const msgBox = document.getElementById("modalProfileMsg");
  if (msgBox) msgBox.style.display = "none";

  document.getElementById("profName").value = currentUser.name || "";
  document.getElementById("profLogin").value = currentUser.login || "";
  document.getElementById("profPhone").value = currentUser.phone || "";
  document.getElementById("profRoom").value = currentUser.room || "";
  document.getElementById("profNewPass").value = "";
  document.getElementById("profConfirmPass").value = "";

  const ws = currentUser.workSchedule || {};
  document.getElementById("profWorkStart").value = ws.start || "08:00";
  document.getElementById("profWorkEnd").value = ws.end || "17:00";
  document.getElementById("profLunchStart").value = ws.lunchStart || "12:00";
  document.getElementById("profLunchEnd").value = ws.lunchEnd || "13:00";

  const labSettings = document.getElementById("profLaborantSettings");
  if (currentUser.role === 'laborant' || currentUser.role === 'super_admin' || currentUser.role === 'server_nazoratchisi' || currentUser.role === 'admin') {
    if (labSettings) labSettings.style.display = "block";
    const prefs = currentUser.preferences?.testDurations || {};
    document.getElementById("profDurMrtPlain").value = prefs.MRT_ODDIY || 15;
    document.getElementById("profDurMrtContrast").value = prefs.MRT_KONTRAST || 25;
    document.getElementById("profDurMskt").value = prefs.MSKT || 10;
  } else {
    if (labSettings) labSettings.style.display = "none";
  }

  document.getElementById("profRoleBadge").innerText = formatRoleName(currentUser.role);
  if (modal) modal.style.display = "flex";
}

function closeProfileModal() {
  const modal = document.getElementById("modalProfile");
  if (modal) modal.style.display = "none";
}

async function handleSaveProfile(e) {
  e.preventDefault();
  if (!currentUser) return;

  const msgBox = document.getElementById("modalProfileMsg");
  const saveBtn = document.getElementById("btnSaveProfile");

  const name = document.getElementById("profName").value.trim();
  const login = document.getElementById("profLogin").value.trim();
  const phone = document.getElementById("profPhone").value.trim();
  const room = document.getElementById("profRoom").value.trim();
  const newPass = document.getElementById("profNewPass").value.trim();
  const confirmPass = document.getElementById("profConfirmPass").value.trim();

  if (newPass && newPass !== confirmPass) {
    if (msgBox) {
      msgBox.className = "modal-error-box";
      msgBox.innerText = "❌ Yangi parollar bir-biriga mos kelmadi!";
      msgBox.style.display = "block";
    }
    return;
  }

  const workSchedule = {
    start: document.getElementById("profWorkStart").value || "08:00",
    end: document.getElementById("profWorkEnd").value || "17:00",
    lunchStart: document.getElementById("profLunchStart").value || "12:00",
    lunchEnd: document.getElementById("profLunchEnd").value || "13:00"
  };

  const payload = { name, login, phone, room, workSchedule };
  if (newPass) payload.password = newPass;

  if (document.getElementById("profLaborantSettings").style.display !== 'none') {
    payload.preferences = {
      testDurations: {
        MRT_ODDIY: parseInt(document.getElementById("profDurMrtPlain").value) || 15,
        MRT_KONTRAST: parseInt(document.getElementById("profDurMrtContrast").value) || 25,
        MSKT: parseInt(document.getElementById("profDurMskt").value) || 10
      }
    };
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...';

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success && data.user) {
      currentUser = data.user;
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      applyRolePermissions(currentUser);

      if (msgBox) {
        msgBox.className = "modal-msg-box";
        msgBox.innerText = "✅ Profil ma'lumotlari muvaffaqiyatli saqlandi!";
        msgBox.style.display = "block";
      }

      setTimeout(() => closeProfileModal(), 1200);
    } else {
      if (msgBox) {
        msgBox.className = "modal-error-box";
        msgBox.innerText = "❌ " + (data.error || "Profilni saqlab bo'lmadi");
        msgBox.style.display = "block";
      }
    }
  } catch (err) {
    if (msgBox) {
      msgBox.className = "modal-error-box";
      msgBox.innerText = "❌ Server xatosi: " + err.message;
      msgBox.style.display = "block";
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> O\'zgarishlarni Saqlash';
  }
}

// -------------------------------------------------------------
// XODIMLAR VA ROLLAR BOSHQARUVI (SUPER ADMIN & SERVER NAZORATCHISI)
// -------------------------------------------------------------
function openStaffModal() {
  if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'server_nazoratchisi' && currentUser.role !== 'admin')) {
    alert("Xodimlarni boshqarish uchun Super Admin yoki Server Nazoratchisi huquqi talab qilinadi!");
    return;
  }

  const modal = document.getElementById("modalStaff");
  if (modal) modal.style.display = "flex";

  const optSuper = document.getElementById("optSuperAdmin");
  const optSupervisor = document.getElementById("optServerSupervisor");
  const isSupervisor = (currentUser.role === 'server_nazoratchisi' || currentUser.role === 'admin');

  if (optSuper) optSuper.style.display = isSupervisor ? "block" : "none";
  if (optSupervisor) optSupervisor.style.display = isSupervisor ? "block" : "none";

  fetchStaffList();
}

function closeStaffModal() {
  const modal = document.getElementById("modalStaff");
  if (modal) modal.style.display = "none";
}

function toggleAddStaffForm() {
  const box = document.getElementById("boxAddStaff");
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
}

async function fetchStaffList() {
  const tbody = document.getElementById("staffTableBody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Xodimlar ro\'yxati yuklanmoqda...</td></tr>';

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/staff", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.staff)) {
      renderStaffTable(data.staff);
    } else {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#f87171; padding:16px;">❌ ${data.error || "Yuklash xatosi"}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#f87171; padding:16px;">❌ Server bilan aloqa yo'q</td></tr>`;
  }
}

function renderStaffTable(staffList) {
  const tbody = document.getElementById("staffTableBody");
  if (!tbody) return;

  const isSupervisor = (currentUser.role === 'server_nazoratchisi' || currentUser.role === 'admin');

  tbody.innerHTML = staffList.map(s => {
    const ws = s.workSchedule || {};
    const workHours = (ws.start && ws.end) ? `${ws.start}-${ws.end}` : "08:00-17:00";
    const isTargetAdmin = (s.role === 'super_admin' || s.role === 'server_nazoratchisi');
    const canManageThisUser = isSupervisor || !isTargetAdmin;

    return `
      <tr>
        <td><strong style="color:#38bdf8;">${escapeHtml(s.login)}</strong></td>
        <td>${escapeHtml(s.name)}</td>
        <td><span class="badge-role">${formatRoleName(s.role)}</span></td>
        <td>${escapeHtml(s.room || '-')}</td>
        <td>${escapeHtml(s.phone || '-')}</td>
        <td><span style="color:#10b981; font-weight:700;"><i class="fa-solid fa-circle" style="font-size:8px;"></i> Faol</span></td>
        <td>
          ${canManageThisUser ? `
            <button class="btn-table-action" onclick="promptResetStaffPassword('${escapeHtml(s.login)}')">
              <i class="fa-solid fa-key"></i> Parol
            </button>
            <button class="btn-table-action" onclick="promptEditStaffRole('${escapeHtml(s.login)}', '${s.role}')">
              <i class="fa-solid fa-user-gear"></i> Rol
            </button>
          ` : `<span style="color:#64748b; font-size:11px;">Himoyalangan</span>`}
        </td>
      </tr>
    `;
  }).join("");
}

async function handleCreateStaff(e) {
  e.preventDefault();
  const login = document.getElementById("newStaffLogin").value.trim().toUpperCase();
  const name = document.getElementById("newStaffName").value.trim();
  const password = document.getElementById("newStaffPassword").value.trim();
  const role = document.getElementById("newStaffRole").value;

  if (!login || !password) return;

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/staff/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ login, name, password, role })
    });
    const data = await res.json();

    if (data.success) {
      alert(`✅ Xodim ${login} (${name}) muvaffaqiyatli qo'shildi!`);
      document.getElementById("formAddStaff").reset();
      document.getElementById("newStaffPassword").value = "15420";
      toggleAddStaffForm();
      fetchStaffList();
    } else {
      alert("❌ Xatolik: " + (data.error || "Xodim qo'shib bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server bilan aloqa xatosi: " + err.message);
  }
}

async function promptResetStaffPassword(login) {
  const newPass = prompt(`${login} xodimi uchun yangi parolni kiriting:`, "15420");
  if (!newPass) return;

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/staff/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ login, password: newPass })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${login} paroli muvaffaqiyatli o'zgartirildi!`);
    } else {
      alert("❌ Xatolik: " + (data.error || "Parolni tiklab bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server xatosi: " + err.message);
  }
}

async function promptEditStaffRole(login, currentRole) {
  const isSupervisor = (currentUser.role === 'server_nazoratchisi' || currentUser.role === 'admin');
  let allowedOptions = ["tibbiy_navbat", "laborant"];
  if (isSupervisor) allowedOptions.push("super_admin", "server_nazoratchisi");

  const newRole = prompt(`${login} uchun yangi rolni kiriting:\nVariantlar: ${allowedOptions.join(", ")}`, currentRole);
  if (!newRole || newRole === currentRole) return;

  if (!allowedOptions.includes(newRole)) {
    alert("❌ Noto'g'ri rol kiritildi! Variantlar: " + allowedOptions.join(", "));
    return;
  }

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/staff/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ login, role: newRole })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${login} roli ${formatRoleName(newRole)} ga o'zgartirildi!`);
      fetchStaffList();
    } else {
      alert("❌ Xatolik: " + (data.error || "Rolni o'zgartirib bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server xatosi: " + err.message);
  }
}

