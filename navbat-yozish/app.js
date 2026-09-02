/**
 * Mustaqil Navbatga Yozish Portali - Client Script (navbat-yozish/app.js)
 */

let ws = null;
let servicesCatalog = {};
let selectedServices = [];
let todayQueue = [];
let lastAddedPatient = null;

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  loadServicesCatalog();
  fetchQueue();
  connectWebSocket();
});

function initEventListeners() {
  document.getElementById("patientQueueForm").addEventListener("submit", handleFormSubmit);
  document.getElementById("inpSearchService").addEventListener("input", handleServiceSearch);
  document.getElementById("chkIsContrast").addEventListener("change", updateCalculationsPreview);
  document.getElementById("selectTargetDevice").addEventListener("change", updateCalculationsPreview);

  document.getElementById("btnPrintLastTicket").addEventListener("click", () => {
    if (lastAddedPatient) printTicket(lastAddedPatient);
  });

  document.getElementById("filterDevice").addEventListener("change", renderQueueTable);
  document.getElementById("btnRefreshQueue").addEventListener("click", fetchQueue);
}

// -------------------------------------------------------------
// XIZMATLAR KATALOGI VA QIDIRUV
// -------------------------------------------------------------
async function loadServicesCatalog() {
  try {
    const res = await fetch("/api/services");
    const data = await res.json();
    if (data.success && data.catalog) {
      servicesCatalog = data.catalog;
      renderServicesList(servicesCatalog);
    }
  } catch (e) {
    console.error("Xizmatlar yuklanmadi:", e);
  }
}

function renderServicesList(catalog, query = "") {
  const container = document.getElementById("servicesCatalogContainer");
  if (!container) return;

  const entries = Object.entries(catalog).filter(([code, item]) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return code.toLowerCase().includes(q) || item.name.toLowerCase().includes(q);
  });

  if (entries.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:15px; color:#64748b; font-size:12px;">Xizmat topilmadi</div>`;
    return;
  }

  container.innerHTML = entries.map(([code, item]) => {
    const isChecked = selectedServices.some(s => s.code === code);
    return `
      <div class="service-item-row" onclick="toggleService('${code}')">
        <div class="service-item-left">
          <input type="checkbox" id="chk_srv_${code}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleService('${code}')">
          <span class="srv-code">${code}</span>
          <span class="srv-name">${escapeHtml(item.name)}</span>
          ${item.isContrast ? '<span class="srv-contrast-badge">💉 Kontrast</span>' : ''}
        </div>
        <div style="font-size:11.5px; color:#94a3b8; font-family:monospace;">
          ${item.duration} daqiqa
        </div>
      </div>
    `;
  }).join("");
}

function handleServiceSearch(e) {
  const q = e.target.value.trim();
  renderServicesList(servicesCatalog, q);
}

window.toggleService = function(code) {
  const item = servicesCatalog[code];
  if (!item) return;

  const index = selectedServices.findIndex(s => s.code === code);
  if (index > -1) {
    selectedServices.splice(index, 1);
  } else {
    selectedServices.push(item);
  }

  // Checkbox holatini yangilash
  const chk = document.getElementById(`chk_srv_${code}`);
  if (chk) chk.checked = selectedServices.some(s => s.code === code);

  // Agar kontrastli tekshiruv tanlansa, avtomatik kontrast checkboxini yoqish
  if (selectedServices.some(s => s.isContrast)) {
    document.getElementById("chkIsContrast").checked = true;
  }

  document.getElementById("txtSelectedCount").innerText = `${selectedServices.length} ta xizmat tanlandi`;
  updateCalculationsPreview();
};

// -------------------------------------------------------------
// HISOB-KITOBLAR VA LIVE PREVIEW
// -------------------------------------------------------------
function updateCalculationsPreview() {
  let totalMinutes = 0;
  let hasContrast = document.getElementById("chkIsContrast").checked;

  if (selectedServices.length === 0) {
    totalMinutes = 30;
  } else {
    selectedServices.forEach((s, idx) => {
      totalMinutes += idx === 0 ? s.duration : Math.round(s.duration * 0.75);
      if (s.isContrast) hasContrast = true;
    });
  }

  document.getElementById("prevDuration").innerText = `${totalMinutes} daqiqa`;

  const targetDevVal = document.getElementById("selectTargetDevice").value;
  let devName = "Aqlli Taqsimlash";
  if (targetDevVal === "mrt1" || (targetDevVal === "auto" && hasContrast)) {
    devName = "1-MRT (1.5 T)";
  } else if (targetDevVal === "mrt2") {
    devName = "2-MRT (3.0 T)";
  } else if (targetDevVal === "mskt1") {
    devName = "1-MSKT";
  }

  document.getElementById("prevDevice").innerText = devName;
}

// -------------------------------------------------------------
// FORM SUBMISSION (BEMORNI NAVBATGA QO'YISH)
// -------------------------------------------------------------
async function handleFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("inpPatientName").value.trim();
  const id = document.getElementById("inpPatientId").value.trim();
  const phone = document.getElementById("inpPhone").value.trim();
  const birthDate = document.getElementById("inpBirthDate").value;
  const doctor = document.getElementById("inpDoctor").value.trim();
  const targetDev = document.getElementById("selectTargetDevice").value;
  const isContrast = document.getElementById("chkIsContrast").checked;

  if (!name) {
    alert("Iltimos, bemor F.I.Sh ni kiriting!");
    return;
  }

  const srvList = selectedServices.length > 0 ? selectedServices : [{ name: "MRT Tekshiruvi", code: "R157", duration: 30 }];

  const payload = {
    patientName: name,
    patientId: id,
    phone: phone,
    birthDate: birthDate,
    referringDoctor: doctor,
    deviceId: targetDev !== "auto" ? targetDev : null,
    isContrast: isContrast,
    services: srvList,
    operatorName: window.currentUser ? window.currentUser.name : "Operator"
  };

  const btnSubmit = document.getElementById("btnSubmitPatient");
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...`;

  try {
    const res = await fetch("/api/queue/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success && data.patient) {
      lastAddedPatient = data.patient;
      document.getElementById("btnPrintLastTicket").disabled = false;

      alert(`✅ Bemor muvaffaqiyatli navbatga olindi!\n\n🎫 Raqam: ${data.patient.ticketNumber}\n👤 Bemor: ${data.patient.patientName}\n🧲 Xona: ${data.patient.deviceId.toUpperCase()}\n⏱️ Boshlanish vaqti: ${data.patient.estimatedStartTimeFormatted || 'Navbatda'}`);

      // Formani tozalash
      document.getElementById("patientQueueForm").reset();
      selectedServices = [];
      document.getElementById("txtSelectedCount").innerText = "0 ta";
      renderServicesList(servicesCatalog);
      updateCalculationsPreview();

      fetchQueue();
    } else {
      alert("Xatolik: " + (data.error || "Bemor qo'shilmadi"));
    }
  } catch (err) {
    alert("Server xatosi: " + err.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i class="fa-solid fa-check-circle"></i> Navbatga Qo'shish`;
  }
}

// -------------------------------------------------------------
// CHIPTA CHOP ETISH (PRINT THERMAL TICKET)
// -------------------------------------------------------------
function printTicket(patient) {
  if (!patient) return;

  document.getElementById("ttTicketNum").innerText = patient.ticketNumber;
  document.getElementById("ttPatientName").innerText = patient.patientName;
  document.getElementById("ttServiceName").innerText = patient.primaryService;
  document.getElementById("ttDate").innerText = patient.date || new Date().toLocaleDateString("ru-RU");
  document.getElementById("ttTime").innerText = patient.estimatedStartTimeFormatted || new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const roomText = patient.deviceId === "mrt1" ? "1-MRT XONASI (1.5 Tesla)" 
                 : patient.deviceId === "mrt2" ? "2-MRT XONASI (3.0 Tesla)" 
                 : "1-MSKT XONASI";
  document.getElementById("ttRoomName").innerText = roomText;

  const prepNote = document.getElementById("ttPrepNote");
  if (patient.isContrast) {
    prepNote.style.display = "block";
    prepNote.innerText = "💉 DIQQAT: Vena ichi kontrast moddasi talab qilinadi. 15 daqiqa oldin xonaga uchrashing!";
  } else {
    prepNote.style.display = "block";
    prepNote.innerText = "⚠️ Iltimos, tekshiruvdan 10 daqiqa oldin xona oldida hozir bo'ling.";
  }

  window.print();
}

// -------------------------------------------------------------
// BUGUNGI NAVBAT JADVALI
// -------------------------------------------------------------
async function fetchQueue() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.success && data.queue) {
      todayQueue = data.queue;
      renderQueueTable();
    }
  } catch (e) {}
}

function renderQueueTable() {
  const tbody = document.getElementById("todayQueueTableBody");
  if (!tbody) return;

  const filter = document.getElementById("filterDevice").value;
  let list = todayQueue;
  if (filter !== "all") {
    list = list.filter(p => p.deviceId === filter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Hozircha bemorlar ro'yxatga olinmagan</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const statusClass = `status-tag ${p.status}`;
    const statusMap = {
      waiting: "Kutmoqda",
      preparing: "Tayyorlanmoqda",
      calling: "Chaqirilmoqda",
      in_progress: "Xonada",
      completed: "Tugatildi",
      cancelled: "Bekor qilindi"
    };

    return `
      <tr>
        <td class="ticket-cell">${escapeHtml(p.ticketNumber)}</td>
        <td>
          <strong>${escapeHtml(p.patientName)}</strong>
          ${p.phone ? `<div style="font-size:11px; color:#9ca3af;">${p.phone}</div>` : ''}
        </td>
        <td>
          <div>${escapeHtml(p.primaryService)}</div>
          ${p.isContrast ? '<span class="srv-contrast-badge">💉 Kontrast</span>' : ''}
        </td>
        <td><span style="font-size:11.5px; font-weight:700; color:#93c5fd;">${escapeHtml(p.deviceId.toUpperCase())}</span></td>
        <td><span class="${statusClass}">${statusMap[p.status] || p.status}</span></td>
        <td style="font-family:monospace; font-size:11.5px;">${p.estimatedStartTimeFormatted || '--:--'}</td>
        <td style="text-align:right;">
          <button class="btn-icon" onclick="callPatientAction('${p.id}')" title="Chaqirish"><i class="fa-solid fa-bullhorn"></i></button>
          <button class="btn-icon" onclick="printSingleTicket('${p.id}')" title="Chipta"><i class="fa-solid fa-print"></i></button>
        </td>
      </tr>
    `;
  }).join("");
}

window.callPatientAction = async function(id) {
  try {
    await fetch("/api/queue/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    alert("🔔 Bemor TV orqali xonaga chaqirildi!");
    fetchQueue();
  } catch (e) {}
};

window.printSingleTicket = function(id) {
  const p = todayQueue.find(x => x.id === id);
  if (p) printTicket(p);
};

// -------------------------------------------------------------
// WEBSOCKET JONLI ALOQA
// -------------------------------------------------------------
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: "register",
      role: "operator",
      deviceName: "Navbatga Yozish Portali"
    }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "queue_updated" || data.type === "queue_init") {
        fetchQueue();
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
