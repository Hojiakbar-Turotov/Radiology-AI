/**
 * 2-Kengaytma: Bemor Vrachini O'zgartirish va Yo'naltirish Popup Logic
 */

let serverUrl = "http://localhost:3000";
let allDoctors = [];
let allPatients = [];

document.addEventListener("DOMContentLoaded", async () => {
  await loadSavedSettings();
  initUIListeners();
  await checkServerAndFetchData();
});

// 1. SAQLANGAN SOZLAMALARNI YUKLASH
async function loadSavedSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["serverUrl"], (res) => {
      if (res.serverUrl) {
        serverUrl = res.serverUrl.replace(/\/+$/, "");
      }
      const inputEl = document.getElementById("serverUrlInput");
      if (inputEl) inputEl.value = serverUrl;
      resolve();
    });
  });
}

// 2. UI LISTENERS
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
      alert("✅ Server manzili saqlandi: " + serverUrl);
    }
  });

  document.getElementById("btnRefresh").addEventListener("click", checkServerAndFetchData);

  // Vrachni o'zgartirish formasi
  document.getElementById("btnSubmitReassign").addEventListener("click", handleManualReassign);

  // Qidiruv
  document.getElementById("searchFilter").addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = allPatients.filter(p => p.patientName.toLowerCase().includes(q) || (p.patientId && p.patientId.includes(q)));
    renderPatientsList(filtered);
  });
}

// 3. SERVERDAN MA'LUMOTLARNI OLISH
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

// 4. VRACHLAR RO'YXATI
async function fetchDoctors() {
  try {
    const res = await fetch(`${serverUrl}/api/doctors`);
    allDoctors = await res.json();

    const select = document.getElementById("targetDoctorSelect");
    select.innerHTML = `<option value="">-- Yangi Vrach / Xonani tanlang --</option>`;

    allDoctors.forEach(doc => {
      const opt = document.createElement("option");
      opt.value = doc.id;
      opt.innerText = `${doc.room} - ${doc.name} (${doc.specialty})`;
      select.appendChild(opt);
    });
  } catch (e) {}
}

// 5. BARCHA BEMORLARNI YUKLASH
async function fetchPatients() {
  try {
    const res = await fetch(`${serverUrl}/api/queue`);
    const data = await res.json();
    allPatients = data.patients || [];

    document.getElementById("totalPatientsCount").innerText = allPatients.length;
    renderPatientsList(allPatients);
  } catch (e) {}
}

// 6. BEMORLARNI CHIZISH
function renderPatientsList(patients) {
  const list = document.getElementById("reassignPatientsList");

  if (patients.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding:15px; color:#94a3b8; font-size:12px;">Hozircha bemorlar yo'q</div>`;
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
          🔄 Ushbu bemor vrachini almashtirish
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

// 7. BEMOR VRACHINI ALMASHTIRISH (POST /api/queue/reassign)
async function handleManualReassign() {
  const patientName = document.getElementById("targetPatientInput").value.trim();
  const targetDoctorId = document.getElementById("targetDoctorSelect").value;

  if (!patientName) {
    alert("Iltimos, bemor F.I.Sh yoki ID raqamini kiriting!");
    return;
  }
  if (!targetDoctorId) {
    alert("Iltimos, yangi vrachni tanlang!");
    return;
  }

  const btn = document.getElementById("btnSubmitReassign");
  btn.disabled = true;
  btn.innerText = "⏳ Yo'naltirilmoqda...";

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
    btn.innerText = "🔄 Vrachni O'zgartirish va Navbatga Yuborish";

    if (data.ok) {
      alert(`✅ Muvaffaqiyatli!\n\n${patientName} bemori ${data.targetDoctor.name} (${data.targetDoctor.room}) navbatiga yo'naltirildi!`);
      document.getElementById("targetPatientInput").value = "";
      document.getElementById("targetDoctorSelect").value = "";
      await fetchPatients();
    } else {
      alert("Xatolik: " + (data.error || "Yo'naltirib bo'lmadi"));
    }
  } catch (err) {
    btn.disabled = false;
    btn.innerText = "🔄 Vrachni O'zgartirish va Navbatga Yuborish";
    alert("Lokal serverga ulanishda xatolik: " + err.message);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.selectPatientForReassign = selectPatientForReassign;
