/**
 * 2-Kengaytma: Bemor Vrachini O'zgartirish Popup Logic (6 Ta Tilda)
 */

let serverUrl = "http://localhost:3000";
let currentLang = "uz";
let allDoctors = [];
let allPatients = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedSettings();
  initUIListeners();
  applyLanguage(currentLang);
  await checkServerAndFetchData();
});

// 1. SAQLANGAN SOZLAMALARNI YUKLASH
async function loadSavedSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["serverUrl", "lang"], (res) => {
      if (res.serverUrl) {
        serverUrl = res.serverUrl.replace(/\/+$/, "");
      }
      if (res.lang && I18N_EXT2[res.lang]) {
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
  if (!I18N_EXT2[lang]) return;
  currentLang = lang;
  chrome.storage.local.set({ lang: lang });
  applyLanguage(lang);
}

function applyLanguage(lang) {
  const dict = I18N_EXT2[lang] || I18N_EXT2.uz;

  const tTitle = document.getElementById("txtHeaderTitle");
  const tSub = document.getElementById("txtHeaderSub");
  const lblHost = document.getElementById("lblServerHost");
  const btnSave = document.getElementById("btnSaveServerUrl");
  const cTitle = document.getElementById("txtCardTitle");
  const lblPat = document.getElementById("lblTargetPatient");
  const lblDoc = document.getElementById("lblTargetDoctor");
  const btnSub = document.getElementById("btnSubmitReassign");
  const qTitle = document.getElementById("txtQueueTitle");
  const sInput = document.getElementById("searchFilter");
  const fNotice = document.getElementById("txtFooterNotice");
  const btnRef = document.getElementById("btnRefresh");

  if (tTitle) tTitle.innerText = dict.headerTitle;
  if (tSub) tSub.innerText = dict.headerSub;
  if (lblHost) lblHost.innerText = dict.serverHostLabel;
  if (btnSave) btnSave.innerText = dict.btnSave;
  if (cTitle) cTitle.innerText = dict.cardTitle;
  if (lblPat) lblPat.innerText = dict.lblTargetPatient;
  if (lblDoc) lblDoc.innerText = dict.lblTargetDoctor;
  if (btnSub) btnSub.innerText = dict.btnSubmit;
  if (qTitle) qTitle.innerText = dict.queueTitle;
  if (sInput) sInput.placeholder = dict.searchPlaceholder;
  if (fNotice) fNotice.innerText = dict.footerNotice;
  if (btnRef) btnRef.innerText = dict.btnRefresh;

  renderPatientsList(allPatients);
  fetchDoctors();
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

  document.getElementById("btnRefresh").addEventListener("click", checkServerAndFetchData);
  document.getElementById("btnSubmitReassign").addEventListener("click", handleManualReassign);

  document.getElementById("searchFilter").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = allPatients.filter(p => p.patientName.toLowerCase().includes(q) || (p.patientId && p.patientId.includes(q)));
    renderPatientsList(filtered);
  });
}

// 4. SERVER TEKSHIRUV
async function checkServerAndFetchData() {
  const dot = document.querySelector(".status-dot");
  const txt = document.getElementById("serverStatusText");

  try {
    const res = await fetch(`${serverUrl}/api/info`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();

    if (dot) dot.className = "status-dot online";
    if (txt) txt.innerText = `Ulangan (${data.primaryIp || "Local"})`;

    await fetchDoctors();
    await fetchPatients();
  } catch (err) {
    if (dot) dot.className = "status-dot offline";
    if (txt) txt.innerText = "Ulanib bo'lmadi (Host IP tekshiring)";
  }
}

// 5. VRACHLAR
async function fetchDoctors() {
  const dict = I18N_EXT2[currentLang] || I18N_EXT2.uz;
  try {
    const res = await fetch(`${serverUrl}/api/doctors`);
    allDoctors = await res.json();

    const select = document.getElementById("targetDoctorSelect");
    select.innerHTML = `<option value="">${dict.selectTargetPlaceholder}</option>`;

    allDoctors.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.innerText = `${doc.room} - ${doc.name} (${doc.specialty})`;
      select.appendChild(opt);
    });
  } catch (e) {}
}

// 6. BEMORLAR
async function fetchPatients() {
  try {
    const res = await fetch(`${serverUrl}/api/queue`);
    const data = await res.json();
    allPatients = data.patients || [];

    document.getElementById("totalPatientsCount").innerText = allPatients.length;
    renderPatientsList(allPatients);
  } catch (e) {}
}

function renderPatientsList(patients) {
  const dict = I18N_EXT2[currentLang] || I18N_EXT2.uz;
  const list = document.getElementById("reassignPatientsList");
  if (!list) return;

  if (patients.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:15px; color:#94a3b8; font-size:12px;">${dict.emptyList}</div>`;
    return;
  }

  list.innerHTML = patients.map(p => `
    <div class="reassign-card-item">
      <div class="r-header">
        <span class="r-name">${escapeHtml(p.patientName)}</span>
        <span class="r-doctor">${escapeHtml(p.doctorName || p.room || 'Vrach')}</span>
      </div>
      <div style="font-size:11.5px; color:#94a3b8;">
        <span>${escapeHtml(p.service || 'Ko\'rik')}</span>
        ${p.patientId ? ` • ID: <code>${p.patientId}</code>` : ''}
        <span> • ${p.status === 'calling' ? '📢 Chaqirilmoqda' : (p.status === 'in_progress' ? '▶️ Qabulda' : 'Kutilmoqda')}</span>
      </div>
      <div class="r-actions">
        <button class="btn-quick-reassign" onclick="selectPatientForReassign('${escapeHtml(p.patientName)}')">
          ${dict.btnQuickChange}
        </button>
      </div>
    </div>
  `).join("");
}

function selectPatientForReassign(patientName) {
  const input = document.getElementById("targetPatientInput");
  if (input) {
    input.value = patientName;
    document.getElementById("targetDoctorSelect").focus();
  }
}

async function handleManualReassign() {
  const patientName = document.getElementById("targetPatientInput").value.trim();
  const targetDoctorId = document.getElementById("targetDoctorSelect").value;

  if (!patientName) {
    alert("Iltimos, bemor nomini kiriting!");
    return;
  }
  if (!targetDoctorId) {
    alert("Iltimos, yangi vrachni tanlang!");
    return;
  }

  const btn = document.getElementById("btnSubmitReassign");
  btn.disabled = true;

  try {
    const res = await fetch(`${serverUrl}/api/queue/reassign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: patientName,
        targetDoctorId: targetDoctorId
      })
    });
    const data = await res.json();

    btn.disabled = false;

    if (data.ok) {
      alert(`✅ Muvaffaqiyatli!\n\n${patientName} -> ${data.targetDoctor.name} (${data.targetDoctor.room})`);
      document.getElementById("targetPatientInput").value = "";
      document.getElementById("targetDoctorSelect").value = "";
      await fetchPatients();
    } else {
      alert("Xatolik: " + (data.error || "Yo'naltirib bo'lmadi"));
    }
  } catch (err) {
    btn.disabled = false;
    alert("Xatolik: " + err.message);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.changeExtLanguage = changeExtLanguage;
window.selectPatientForReassign = selectPatientForReassign;
