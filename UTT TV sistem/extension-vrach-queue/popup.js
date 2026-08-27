/**
 * 1-Kengaytma: Vrach Qabuli va Navbat Chaqiruv Popup Logic (6 Ta Tilda)
 */

let serverUrl = "http://localhost:3000";
let selectedDoctorId = "";
let currentLang = "uz";
let allDoctors = [];
let queuePatients = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedSettings();
  initUIListeners();
  applyLanguage(currentLang);
  await checkServerAndFetchData();
});

// 1. SAQLANGAN SOZLAMALARNI YUKLASH
async function loadSavedSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["serverUrl", "selectedDoctorId", "lang"], (res) => {
      if (res.serverUrl) {
        serverUrl = res.serverUrl.replace(/\/+$/, "");
      }
      if (res.selectedDoctorId) {
        selectedDoctorId = res.selectedDoctorId;
      }
      if (res.lang && I18N_EXT1[res.lang]) {
        currentLang = res.lang;
      }
      const inputEl = document.getElementById("serverUrlInput");
      if (inputEl) inputEl.value = serverUrl;

      const langSelect = document.getElementById("extLangSelect");
      if (langSelect) langSelect.value = currentLang;

      resolve();
    });
  });
}

// 2. TILNI QO'LLASH
function changeExtLanguage(lang) {
  if (!I18N_EXT1[lang]) return;
  currentLang = lang;
  chrome.storage.local.set({ lang: lang });
  applyLanguage(lang);
}

function applyLanguage(lang) {
  const dict = I18N_EXT1[lang] || I18N_EXT1.uz;

  const tTitle = document.getElementById("txtHeaderTitle");
  const tSub = document.getElementById("txtHeaderSub");
  const lblHost = document.getElementById("lblServerHost");
  const btnSave = document.getElementById("btnSaveServerUrl");
  const lblDoc = document.getElementById("lblDoctorSelect");
  const tCallNext = document.getElementById("txtCallNextTitle");
  const tTabQ = document.getElementById("txtTabQueue");
  const tTabA = document.getElementById("txtTabAdd");
  const lblName = document.getElementById("lblAddName");
  const lblId = document.getElementById("lblAddId");
  const lblSrv = document.getElementById("lblAddService");
  const lblCnt = document.getElementById("lblAddContrast");
  const btnAdd = document.getElementById("btnAddSubmit");
  const btnClr = document.getElementById("btnClearQueue");
  const btnRef = document.getElementById("btnRefresh");

  if (tTitle) tTitle.innerText = dict.headerTitle;
  if (tSub) tSub.innerText = dict.headerSub;
  if (lblHost) lblHost.innerText = dict.serverHostLabel;
  if (btnSave) btnSave.innerText = dict.btnSave;
  if (lblDoc) lblDoc.innerText = dict.doctorLabel;
  if (tCallNext) tCallNext.innerText = dict.callNextTitle;
  if (tTabQ) tTabQ.innerText = dict.tabQueue;
  if (tTabA) tTabA.innerText = dict.tabAdd;
  if (lblName) lblName.innerText = dict.lblPatientName;
  if (lblId) lblId.innerText = dict.lblPatientId;
  if (lblSrv) lblSrv.innerText = dict.lblService;
  if (lblCnt) lblCnt.innerText = dict.lblContrast;
  if (btnAdd) btnAdd.innerText = dict.btnAddSubmit;
  if (btnClr) btnClr.innerText = dict.btnClear;
  if (btnRef) btnRef.innerText = dict.btnRefresh;

  renderPatientCards(queuePatients);
  updateQuickCallButton(queuePatients);
}

// 3. UI LISTENERS
function initUIListeners() {
  document.getElementById("btnSettingsToggle").addEventListener("click", () => {
    const p = document.getElementById("settingsPanel");
    p.style.display = p.style.display === "none" ? "block" : "none";
  });

  document.getElementById("btnSaveServerUrl").addEventListener("click", async () => {
    const val = document.getElementById("serverUrlInput").value.trim().replace(/\/+$/, "");
    if (val) {
      serverUrl = val;
      await chrome.storage.local.set({ serverUrl: serverUrl });
      await checkServerAndFetchData();
      alert("✅ Server URL: " + serverUrl);
    }
  });

  document.getElementById("doctorSelect").addEventListener("change", async (e) => {
    selectedDoctorId = e.target.value;
    await chrome.storage.local.set({ selectedDoctorId: selectedDoctorId });
    await fetchQueue();
  });

  document.getElementById("btnCallNext").addEventListener("click", handleCallNext);
  document.getElementById("btnRefresh").addEventListener("click", checkServerAndFetchData);

  document.getElementById("btnClearQueue").addEventListener("click", async () => {
    if (confirm("Navbatni tozalashni tasdiqlaysizmi?")) {
      try {
        await fetch(`${serverUrl}/api/queue/clear`, { method: "POST" });
        await fetchQueue();
      } catch (e) {
        alert("Xatolik: " + e.message);
      }
    }
  });
}

// 4. SERVER HOLATINI TEKSHIRISH
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
    renderEmptyQueue("Server bilan aloqa yo'q.");
  }
}

// 5. VRACHLAR
async function fetchDoctors() {
  const dict = I18N_EXT1[currentLang] || I18N_EXT1.uz;
  try {
    const res = await fetch(`${serverUrl}/api/doctors`);
    allDoctors = await res.json();

    const select = document.getElementById("doctorSelect");
    select.innerHTML = `<option value="">${dict.selectDoctorPlaceholder}</option>`;

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

// 6. NAVBAT
async function fetchQueue() {
  const dict = I18N_EXT1[currentLang] || I18N_EXT1.uz;
  if (!selectedDoctorId) {
    renderEmptyQueue(dict.selectDoctorPlaceholder);
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

function updateQuickCallButton(patients) {
  const dict = I18N_EXT1[currentLang] || I18N_EXT1.uz;
  const btn = document.getElementById("btnCallNext");
  const preview = document.getElementById("nextPatientPreview");

  const nextP = patients.find(p => p.status === "waiting");

  if (nextP) {
    btn.disabled = false;
    preview.innerText = `${nextP.patientName} (${nextP.service || 'Ko\'rik'})`;
  } else {
    btn.disabled = true;
    preview.innerText = dict.noPatientsNext;
  }
}

async function handleCallNext() {
  const nextP = queuePatients.find(p => p.status === "waiting");
  if (nextP) {
    await callPatient(nextP.id);
  }
}

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
    alert("Xatolik: " + err.message);
  }
}

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
    alert("Xatolik: " + err.message);
  }
}

function renderPatientCards(patients) {
  const dict = I18N_EXT1[currentLang] || I18N_EXT1.uz;
  const list = document.getElementById("patientCardsList");
  if (!list) return;

  if (patients.length === 0) {
    renderEmptyQueue(dict.emptyList);
    return;
  }

  list.innerHTML = patients.map((p, idx) => {
    const isCalling = p.status === "calling";
    const isInProgress = p.status === "in_progress";
    const isCompleted = p.status === "completed";

    let badgeClass = "badge-waiting";
    let badgeText = dict.badgeWaiting;

    if (isCalling) { badgeClass = "badge-calling"; badgeText = dict.badgeCalling; }
    else if (isInProgress) { badgeClass = "badge-inprogress"; badgeText = dict.badgeInProgress; }
    else if (isCompleted) { badgeClass = "badge-completed"; badgeText = dict.badgeCompleted; }

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
            <button class="btn-act btn-act-call" onclick="callPatient('${p.id}')">${dict.btnCall}</button>
            ${!isInProgress ? `<button class="btn-act btn-act-start" onclick="updatePatientStatus('${p.id}', 'in_progress')">${dict.btnStart}</button>` : ''}
            <button class="btn-act btn-act-finish" onclick="updatePatientStatus('${p.id}', 'completed')">${dict.btnFinish}</button>
          ` : `
            <span style="font-size:11px; color:#94a3b8; font-style:italic;">${dict.badgeCompleted}</span>
          `}
        </div>
      </div>
    `;
  }).join("");
}

function renderEmptyQueue(msg) {
  const list = document.getElementById("patientCardsList");
  if (list) list.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">${escapeHtml(msg)}</div>`;
}

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
    alert("Xatolik: " + err.message);
  }
}

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

window.changeExtLanguage = changeExtLanguage;
window.callPatient = callPatient;
window.updatePatientStatus = updatePatientStatus;
window.switchTab = switchTab;
window.handleAddPatient = handleAddPatient;
