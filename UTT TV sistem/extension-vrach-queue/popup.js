/**
 * 1-Kengaytma: Vrach Qabuli va Navbat Chaqiruv Popup Logic
 */

let serverUrl = "http://localhost:3000";
let selectedDoctorId = "";
let allDoctors = [];
let queuePatients = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedSettings();
  initUIListeners();
  await checkServerAndFetchData();
});

// 1. SAQLANGAN SOZLAMALARNI YUKLASH
async function loadSavedSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["serverUrl", "selectedDoctorId"], (res) => {
      if (res.serverUrl) {
        serverUrl = res.serverUrl.replace(/\/+$/, "");
      }
      if (res.selectedDoctorId) {
        selectedDoctorId = res.selectedDoctorId;
      }
      const inputEl = document.getElementById("serverUrlInput");
      if (inputEl) inputEl.value = serverUrl;
      resolve();
    });
  });
}

// 2. UI TUGMALARINI SOZLASH
function initUIListeners() {
  // Sozlamalar panelini ochish/yopish
  document.getElementById("btnSettingsToggle").addEventListener("click", () => {
    const p = document.getElementById("settingsPanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
  });

  // Server URL saqlash
  document.getElementById("btnSaveServerUrl").addEventListener("click", async () => {
    const val = document.getElementById("serverUrlInput").value.trim().replace(/\/+$/, "");
    if (val) {
      serverUrl = val;
      await chrome.storage.local.set({ serverUrl: serverUrl });
      await checkServerAndFetchData();
      alert("✅ Server manzili saqlandi: " + serverUrl);
    }
  });

  // Vrach tanlanganda
  document.getElementById("doctorSelect").addEventListener("change", async (e) => {
    selectedDoctorId = e.target.value;
    await chrome.storage.local.set({ selectedDoctorId: selectedDoctorId });
    await fetchQueue();
  });

  // Navbatdagini chaqirish
  document.getElementById("btnCallNext").addEventListener("click", handleCallNext);

  // Yangilash
  document.getElementById("btnRefresh").addEventListener("click", checkServerAndFetchData);

  // Navbatni tozalash
  document.getElementById("btnClearQueue").addEventListener("click", async () => {
    if (confirm("Rostdan ham barcha navbatdagi bemorlarni tozalamoqchimisiz?")) {
      try {
        await fetch(`${serverUrl}/api/queue/clear`, { method: "POST" });
        await fetchQueue();
      } catch (e) {
        alert("Xatolik: " + e.message);
      }
    }
  });
}

// 3. SERVER HOLATINI TEKSHIRISH VA MA'LUMOTLARNI OLISH
async function checkServerAndFetchData() {
  const dot = document.querySelector(".status-dot");
  const txt = document.getElementById("serverStatusText");

  try {
    const res = await fetch(`${serverUrl}/api/info`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();

    if (dot) dot.className = "status-dot online";
    if (txt) txt.innerText = `Ulangan (${data.primaryIp || "Local"})`;

    await fetchDoctors();
    await fetchQueue();
  } catch (err) {
    if (dot) dot.className = "status-dot offline";
    if (txt) txt.innerText = "Ulanib bo'lmadi (Host IP tekshiring)";
    renderEmptyQueue("Server bilan aloqa yo'q. Server ishga tushirilganini va IP manzil to'g'riligini tekshiring.");
  }
}

// 4. VRACHLAR RO'YXATINI YUKLASH
async function fetchDoctors() {
  try {
    const res = await fetch(`${serverUrl}/api/doctors`);
    allDoctors = await res.json();

    const select = document.getElementById("doctorSelect");
    select.innerHTML = `<option value="">-- Vrach / Xonani tanlang --</option>`;

    allDoctors.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.innerText = `${doc.room} - ${doc.name} (${doc.specialty})`;
      if (doc.id === selectedDoctorId) opt.selected = true;
      select.appendChild(opt);
    });

    if (!selectedDoctorId && allDoctors.length > 0) {
      selectedDoctorId = allDoctors[0].id;
      select.value = selectedDoctorId;
      await chrome.storage.local.set({ selectedDoctorId: selectedDoctorId });
    }
  } catch (e) {}
}

// 5. NAVBATDAGI BEMORLARNI YUKLASH
async function fetchQueue() {
  if (!selectedDoctorId) {
    renderEmptyQueue("Iltimos, avval yuqoridan vrach xonasini tanlang.");
    return;
  }

  try {
    const res = await fetch(`${serverUrl}/api/queue?doctorId=${selectedDoctorId}`);
    const data = await res.json();
    queuePatients = data.patients || [];

    document.getElementById("queueCount").innerText = queuePatients.length;
    renderPatientCards(queuePatients);
    updateQuickCallButton(queuePatients);
  } catch (e) {
    renderEmptyQueue("Navbatni yuklab bo'lmadi: " + e.message);
  }
}

// 6. TEZKOR CHAQIRUV TUGMASINI YANGILASH
function updateQuickCallButton(patients) {
  const btn = document.getElementById("btnCallNext");
  const preview = document.getElementById("nextPatientPreview");

  // Navbatdagi birinchi "waiting" bemor
  const nextP = patients.find(p => p.status === "waiting");

  if (nextP) {
    btn.disabled = false;
    preview.innerText = `Navbatda: ${nextP.patientName} (${nextP.service || 'Ko\'rik'})`;
  } else {
    btn.disabled = true;
    preview.innerText = "Navbatda kutayotgan bemor yo'q";
  }
}

async function handleCallNext() {
  const nextP = queuePatients.find(p => p.status === "waiting");
  if (nextP) {
    await callPatient(nextP.id);
  }
}

// 7. BEMORNI CHAQIRISH (SERVERGA VA TV GA SIGNAL)
async function callPatient(patientId) {
  try {
    const res = await fetch(`${serverUrl}/api/queue/call`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: patientId })
    });
    const data = await res.json();
    if (data.ok) {
      await fetchQueue();
    }
  } catch (err) {
    alert("Chaqirishda xatolik: " + err.message);
  }
}

// 8. BEMOR HOLATINI O'ZGARTIRISH (Boshlash / Yakunlash)
async function updatePatientStatus(patientId, status) {
  try {
    const res = await fetch(`${serverUrl}/api/queue/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: patientId, status: status })
    });
    const data = await res.json();
    if (data.ok) {
      await fetchQueue();
    }
  } catch (err) {
    alert("Status yangilashda xatolik: " + err.message);
  }
}

// 9. BEMORLAR RO'YXATINI CHIZISH
function renderPatientCards(patients) {
  const list = document.getElementById("patientCardsList");

  if (patients.length === 0) {
    renderEmptyQueue("Ushbu vrach qabulida hozircha bemorlar yo'q.");
    return;
  }

  list.innerHTML = patients.map((p, idx) => {
    const isCalling = p.status === "calling";
    const isInProgress = p.status === "in_progress";
    const isCompleted = p.status === "completed";

    let badgeClass = "badge-waiting";
    let badgeText = "Kutilmoqda";

    if (isCalling) { badgeClass = "badge-calling"; badgeText = "📢 Chaqirilmoqda"; }
    else if (isInProgress) { badgeClass = "badge-inprogress"; badgeText = "▶️ Qabulda"; }
    else if (isCompleted) { badgeClass = "badge-completed"; badgeText = "✅ Tugatildi"; }

    return `
      <div class="patient-card ${isCalling ? 'is-calling' : ''}">
        <div class="p-header">
          <span class="p-name">${idx + 1}. ${escapeHtml(p.patientName)}</span>
          <span class="p-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="p-meta">
          <span>${escapeHtml(p.service || 'Ko\'rik')}</span>
          ${p.patientId ? ` • ID: <code>${p.patientId}</code>` : ''}
          ${p.isContrast ? ' • <b style="color:#ef4444;">KONTRAST</b>' : ''}
          <span> • ${p.createdAtStr || ''}</span>
        </div>
        <div class="p-actions">
          ${!isCompleted ? `
            <button class="btn-act btn-act-call" onclick="callPatient('${p.id}')">📢 Chaqirish</button>
            ${!isInProgress ? `<button class="btn-act btn-act-start" onclick="updatePatientStatus('${p.id}', 'in_progress')">▶️ Boshlash</button>` : ''}
            <button class="btn-act btn-act-finish" onclick="updatePatientStatus('${p.id}', 'completed')">✅ Yakunlash</button>
          ` : `
            <span style="font-size:11px; color:#94a3b8; font-style:italic;">Ko'rik yakunlangan</span>
          `}
        </div>
      </div>
    `;
  }).join("");
}

function renderEmptyQueue(msg) {
  const list = document.getElementById("patientCardsList");
  list.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">${escapeHtml(msg)}</div>`;
}

// 10. QO'LDA BEMOR QO'SHISH FORMASI
async function handleAddPatient(e) {
  e.preventDefault();
  if (!selectedDoctorId) {
    alert("Iltimos, avval vrachni tanlang!");
    return;
  }

  const name = document.getElementById("addPatientName").value.trim();
  const patId = document.getElementById("addPatientId").value.trim();
  const service = document.getElementById("addService").value.trim();
  const isContrast = document.getElementById("addIsContrast").checked;

  try {
    const res = await fetch(`${serverUrl}/api/queue/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: name,
        patientId: patId,
        service: service,
        isContrast: isContrast,
        doctorId: selectedDoctorId
      })
    });
    const data = await res.json();
    if (data.ok) {
      document.getElementById("addPatientForm").reset();
      switchTab("queue");
      await fetchQueue();
    }
  } catch (err) {
    alert("Bemor qo'shishda xatolik: " + err.message);
  }
}

// TAB SWITCHER
function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (tab === "queue") {
    document.getElementById("tabQueue").classList.add("active");
    document.getElementById("queueSection").style.display = "block";
    document.getElementById("addSection").style.display = "none";
  } else {
    document.getElementById("tabAdd").classList.add("active");
    document.getElementById("queueSection").style.display = "none";
    document.getElementById("addSection").style.display = "block";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Global qilish (HTML onclick uchun)
window.callPatient = callPatient;
window.updatePatientStatus = updatePatientStatus;
window.switchTab = switchTab;
window.handleAddPatient = handleAddPatient;
