/**
 * Karmed Xulosalar Portali - Extension Popup Script
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let allReportsList = [];

document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initFormInputs();
  await loadSettings();
  await loadReportsHistory();

  // Avtomatik o'qish tugmasi
  document.getElementById("btnAutoGrab")?.addEventListener("click", handleAutoGrabFromActiveTab);

  // Saqlash formasi
  document.getElementById("reportForm")?.addEventListener("submit", handleSaveReport);

  // Qidiruv
  document.getElementById("searchHistoryInput")?.addEventListener("input", renderReportsHistory);

  // Sozlamalarni saqlash
  document.getElementById("btnSaveSettings")?.addEventListener("click", saveSettings);
});

// 1. Tablarni almashtirish
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");

      if (targetId === "tabHistory") {
        loadReportsHistory();
      }
    });
  });
}

// 2. Inputlarni sozlash
function initFormInputs() {
  const pinInput = document.getElementById("repPinfl");
  const pinCounter = document.getElementById("pinflCounter");
  const dateInput = document.getElementById("repDate");

  // Bugungi sana
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }

  // PINFL tekshiruvi va hisoblagichi
  if (pinInput && pinCounter) {
    pinInput.addEventListener("input", (e) => {
      // Faqat raqamlar
      let val = pinInput.value.replace(/\D/g, "");
      if (val.length > 14) val = val.substring(0, 14);
      pinInput.value = val;

      pinCounter.innerText = `${val.length}/14`;
      if (val.length === 14) {
        pinCounter.classList.add("valid");
      } else {
        pinCounter.classList.remove("valid");
      }
    });
  }
}

// 3. Ochiq Karmed sahifasidan avtomatik ma'lumotlarni o'qish
async function handleAutoGrabFromActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      showToast("❌ Faol sahifa topilmadi");
      return;
    }

    showToast("⏳ Sahifadan ma'lumotlar o'qilmoqda...");

    chrome.tabs.sendMessage(tab.id, { action: "GRAB_KARMED_REPORT" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        showToast("⚠️ Karmed sahifasidan ma'lumot topilmadi. Qo'lda to'ldiring.");
        return;
      }

      const d = response.data || {};
      if (d.pinfl) {
        const pinInput = document.getElementById("repPinfl");
        if (pinInput) {
          pinInput.value = d.pinfl;
          pinInput.dispatchEvent(new Event("input"));
        }
      }
      if (d.patientName) {
        const nameInput = document.getElementById("repPatientName");
        if (nameInput) nameInput.value = d.patientName;
      }
      if (d.serviceName) {
        const sInput = document.getElementById("repService");
        if (sInput) sInput.value = d.serviceName;
      }
      if (d.doctorName) {
        const docInput = document.getElementById("repDoctor");
        if (docInput) docInput.value = d.doctorName;
      }
      if (d.conclusionText) {
        const txtInput = document.getElementById("repText");
        if (txtInput) txtInput.value = d.conclusionText;
      }
      if (d.date) {
        const dInput = document.getElementById("repDate");
        if (dInput) dInput.value = d.date;
      }

      showToast("✅ Karmed sahifasidan ma'lumotlar avtomatik to'ldirildi!");
    });
  } catch (err) {
    showToast("❌ Xatolik: " + err.message);
  }
}

// 4. Xulosani saqlash va Telegramga jo'natish
async function handleSaveReport(e) {
  e.preventDefault();

  const pinfl = document.getElementById("repPinfl")?.value.trim();
  const date = document.getElementById("repDate")?.value;
  const patientName = document.getElementById("repPatientName")?.value.trim();
  const serviceName = document.getElementById("repService")?.value.trim();
  const doctorName = document.getElementById("repDoctor")?.value.trim();
  const conclusionText = document.getElementById("repText")?.value.trim();
  const fileUrl = document.getElementById("repFileUrl")?.value.trim();

  if (!pinfl || pinfl.length !== 14) {
    alert("Iltimos, 14 xonali JSHSHIR (PINFL) raqamini to'liq kiriting!");
    return;
  }

  if (!patientName || !conclusionText) {
    alert("Bemor ismi va xulosa matnini to'ldiring!");
    return;
  }

  const saveBtn = document.getElementById("btnSaveReport");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...`;
  }

  const reportId = "rep_" + Date.now();
  const reportData = {
    id: reportId,
    pinfl: pinfl,
    patientName: patientName,
    serviceName: serviceName,
    doctorName: doctorName || "Shifokor-Radiolog",
    reportDate: date,
    conclusionText: conclusionText,
    fileUrl: fileUrl || "",
    createdAt: Date.now(),
    source: "Karmed Extension"
  };

  try {
    // 1. Firebase Realtime Database ga yozish (/karmed_reports/{pinfl}/{reportId})
    const fbUrl = `${FIREBASE_DB_URL}/karmed_reports/${pinfl}/${reportId}.json`;
    const res = await fetch(fbUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(reportData)
    });

    if (!res.ok) {
      throw new Error(`Firebase xatoligi: ${res.statusText}`);
    }

    // 2. Agar Telegram kanal ID sozlangan bo'lsa, kanalga ham nusxasini jo'natamiz
    const channelId = await getSavedChannelId();
    if (channelId) {
      const tgMsg = 
        `📄 <b>YANGI TIBBIY XULOSA SAQLANDI</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Bemor:</b> ${escapeHtml(patientName)}\n` +
        `🔢 <b>JSHSHIR:</b> <code>${pinfl}</code>\n` +
        `🔬 <b>Tekshiruv:</b> ${escapeHtml(serviceName)}\n` +
        `👨‍⚕️ <b>Shifokor:</b> ${escapeHtml(doctorName)}\n` +
        `📅 <b>Sana:</b> ${date}\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <b>Xulosa:</b>\n${escapeHtml(conclusionText)}`;

      await fetch(`${TG_API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: channelId, text: tgMsg, parse_mode: "HTML" })
      }).catch(e => console.warn("Telegram channel send error:", e));
    }

    showToast("✅ Xulosa Firebase va Telegram bazasiga muvaffaqiyatli saqlandi!");

    // Formani tozalash
    document.getElementById("repText").value = "";
    document.getElementById("repFileUrl").value = "";

    // Tarixni yangilash
    await loadReportsHistory();

  } catch (err) {
    alert("Saqlashda xatolik yuz berdi: " + err.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Xulosani Saqlash & Telegramga Jo'natish`;
    }
  }
}

// 5. Tarixni yuklash
async function loadReportsHistory() {
  const container = document.getElementById("historyListContainer");
  const countEl = document.getElementById("countReports");

  try {
    const res = await fetch(`${FIREBASE_DB_URL}/karmed_reports.json`);
    if (!res.ok) return;

    const data = await res.json();
    allReportsList = [];

    if (data) {
      Object.keys(data).forEach(pinKey => {
        const pinObj = data[pinKey];
        if (pinObj && typeof pinObj === "object") {
          Object.keys(pinObj).forEach(rKey => {
            allReportsList.push({ ...pinObj[rKey], pinKey });
          });
        }
      });
    }

    allReportsList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (countEl) countEl.innerText = allReportsList.length;
    renderReportsHistory();

  } catch (e) {
    if (container) container.innerHTML = `<div class="empty-state">Tarixni yuklashda xatolik yuz berdi.</div>`;
  }
}

function renderReportsHistory() {
  const container = document.getElementById("historyListContainer");
  if (!container) return;

  const query = (document.getElementById("searchHistoryInput")?.value || "").toLowerCase().trim();
  let filtered = allReportsList;

  if (query) {
    filtered = allReportsList.filter(r => 
      (r.pinfl && r.pinfl.includes(query)) ||
      (r.patientName && r.patientName.toLowerCase().includes(query)) ||
      (r.serviceName && r.serviceName.toLowerCase().includes(query))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state">Saqlangan xulosalar topilmadi.</div>`;
    return;
  }

  container.innerHTML = filtered.map(r => `
    <div class="history-card">
      <div class="history-header">
        <span class="history-pin"><i class="fa-solid fa-id-card"></i> ${escapeHtml(r.pinfl)}</span>
        <span class="history-date">${escapeHtml(r.reportDate || '')}</span>
      </div>
      <div class="history-name">${escapeHtml(r.patientName || 'Bemor')}</div>
      <div class="history-service"><i class="fa-solid fa-microscope"></i> ${escapeHtml(r.serviceName || 'Radiologiya')} • ${escapeHtml(r.doctorName || '')}</div>
      <div class="history-preview">${escapeHtml(r.conclusionText || '')}</div>
    </div>
  `).join("");
}

// 6. Sozlamalar
async function loadSettings() {
  try {
    const data = await chrome.storage.local.get("karmed_channel_id");
    const chInput = document.getElementById("cfgChannelId");
    if (chInput && data.karmed_channel_id) {
      chInput.value = data.karmed_channel_id;
    }
  } catch (e) {}
}

async function saveSettings() {
  const chVal = document.getElementById("cfgChannelId")?.value.trim();
  await chrome.storage.local.set({ karmed_channel_id: chVal || "" });
  showToast("✅ Sozlamalar saqlandi!");
}

async function getSavedChannelId() {
  try {
    const data = await chrome.storage.local.get("karmed_channel_id");
    return data.karmed_channel_id || "";
  } catch (e) {
    return "";
  }
}

// Yordamchilar
function showToast(msg) {
  const t = document.getElementById("toastMessage");
  if (!t) return;
  t.innerText = msg;
  t.style.display = "block";
  setTimeout(() => {
    t.style.display = "none";
  }, 2800);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
