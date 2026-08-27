/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Popup Script
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

// DOM Elementlari
let elReportDate, elBtnDateToday, elBtnDateYesterday;
let elDoctorSelect, elBtnAutoDetectDoctor, elDetectedGroup;
let elChkStrictDoctor, elChkAutoPagination;
let elBtnStartScan, elScanResultsSection, elScanProgressBox, elScanProgressText, elScanProgressFill;
let elResPatientCount, elResServiceCount, elResCodesBadgesWrap;
let elBtnTogglePreview, elPreviewBody, elPreviewChevron, elResListCount, elResPatientsList;
let elBtnSaveToFirebase, elConnectionBadge, elLinkOpenPortal;

let currentScannedReport = null;

document.addEventListener("DOMContentLoaded", async () => {
  initDOMElements();
  setupEventListeners();
  initDefaults();
  await checkActiveTabConnection();
});

function initDOMElements() {
  elReportDate = document.getElementById("reportDateInput");
  elBtnDateToday = document.getElementById("btnDateToday");
  elBtnDateYesterday = document.getElementById("btnDateYesterday");

  elDoctorSelect = document.getElementById("doctorSelect");
  elBtnAutoDetectDoctor = document.getElementById("btnAutoDetectDoctor");
  elDetectedGroup = document.getElementById("detectedDoctorsGroup");

  elChkStrictDoctor = document.getElementById("chkStrictDoctorMatch");
  elChkAutoPagination = document.getElementById("chkAutoPagination");

  elBtnStartScan = document.getElementById("btnStartScan");
  elScanResultsSection = document.getElementById("scanResultsSection");
  elScanProgressBox = document.getElementById("scanProgressBox");
  elScanProgressText = document.getElementById("scanProgressText");
  elScanProgressFill = document.getElementById("scanProgressFill");

  elResPatientCount = document.getElementById("resPatientCount");
  elResServiceCount = document.getElementById("resServiceCount");
  elResCodesBadgesWrap = document.getElementById("resCodesBadgesWrap");

  elBtnTogglePreview = document.getElementById("btnTogglePreview");
  elPreviewBody = document.getElementById("previewBody");
  elPreviewChevron = document.getElementById("previewChevron");
  elResListCount = document.getElementById("resListCount");
  elResPatientsList = document.getElementById("resPatientsList");

  elBtnSaveToFirebase = document.getElementById("btnSaveToFirebase");
  elConnectionBadge = document.getElementById("connectionBadge");
  elLinkOpenPortal = document.getElementById("linkOpenAccountantPortal");
}

function setupEventListeners() {
  // Sana tezkor tugmalari
  elBtnDateToday.addEventListener("click", () => setDateOffset(0));
  elBtnDateYesterday.addEventListener("click", () => setDateOffset(-1));

  elReportDate.addEventListener("change", () => {
    updateDateButtonState();
    savePreferences();
  });

  elDoctorSelect.addEventListener("change", savePreferences);
  elChkStrictDoctor.addEventListener("change", savePreferences);
  elChkAutoPagination.addEventListener("change", savePreferences);

  // Sahifadagi shifokorlarni aniqlash
  elBtnAutoDetectDoctor.addEventListener("click", handleAutoDetectDoctors);

  // Skanerlash
  elBtnStartScan.addEventListener("click", handleStartScan);

  // Bemorlar reyestrini ochish/yopish
  elBtnTogglePreview.addEventListener("click", togglePreviewAccordion);

  // Firebase-ga saqlash
  elBtnSaveToFirebase.addEventListener("click", handleSaveToFirebase);
}

function initDefaults() {
  setDateOffset(0);

  // Xotiradan oldingi tanlovlarni yuklash
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["lastTargetDoctor", "lastStrictDoctor", "lastAutoPage"], (res) => {
      if (res.lastTargetDoctor && elDoctorSelect) {
        elDoctorSelect.value = res.lastTargetDoctor;
      }
      if (res.lastStrictDoctor !== undefined && elChkStrictDoctor) {
        elChkStrictDoctor.checked = Boolean(res.lastStrictDoctor);
      }
      if (res.lastAutoPage !== undefined && elChkAutoPagination) {
        elChkAutoPagination.checked = Boolean(res.lastAutoPage);
      }
    });
  }
}

function setDateOffset(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  elReportDate.value = `${yyyy}-${mm}-${dd}`;
  updateDateButtonState();
}

function updateDateButtonState() {
  const val = elReportDate.value;
  const today = new Date().toISOString().split('T')[0];
  
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().split('T')[0];

  elBtnDateToday.classList.toggle("active", val === today);
  elBtnDateYesterday.classList.toggle("active", val === yesterday);
}

function savePreferences() {
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      lastTargetDoctor: elDoctorSelect.value,
      lastStrictDoctor: elChkStrictDoctor.checked,
      lastAutoPage: elChkAutoPagination.checked
    });
  }
}

// Karmed tabiga ulanish holatini tekshirish
async function checkActiveTabConnection() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;
    
    const activeTab = tabs[0];
    const url = (activeTab.url || '').toLowerCase();

    if (url.includes("karmed") || url.includes("kardelen") || url.includes("192.168.") || url.includes("213.230.")) {
      elConnectionBadge.className = "status-badge live";
      elConnectionBadge.innerHTML = `<i class="fa-solid fa-circle"></i> Karmed Bog'langan`;
    } else {
      elConnectionBadge.className = "status-badge";
      elConnectionBadge.style.background = "#fef3c7";
      elConnectionBadge.style.color = "#b45309";
      elConnectionBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Karmed Oynasi Emas`;
    }
  } catch (e) {}
}

// 1. SAHIFADAGI SHIFOKORLARNI AVTO-ANIQLASH
async function handleAutoDetectDoctors() {
  elBtnAutoDetectDoctor.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Olinmoqda...`;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    chrome.tabs.sendMessage(tabs[0].id, { action: "DETECT_PAGE_DOCTORS" }, (res) => {
      elBtnAutoDetectDoctor.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Sahifadan olish`;
      
      if (res && res.success && Array.isArray(res.doctors) && res.doctors.length > 0) {
        elDetectedGroup.innerHTML = "";
        elDetectedGroup.style.display = "block";

        res.doctors.forEach(doc => {
          const opt = document.createElement("option");
          opt.value = doc;
          opt.textContent = `⭐ ${doc} (Karmed sahifasida)`;
          elDetectedGroup.appendChild(opt);
        });

        // 1-shifokorni tanlash
        elDoctorSelect.value = res.doctors[0];
        savePreferences();
      } else {
        alert("Karmed sahifasidan shifokorlar topilmadi. Avval bemorlar jadvalini oching.");
      }
    });
  } catch (e) {
    elBtnAutoDetectDoctor.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Sahifadan olish`;
  }
}

// 2. SKANERLASH VA SANASH
async function handleStartScan() {
  const targetDate = elReportDate.value;
  const targetDoctor = elDoctorSelect.value;

  if (!targetDate) {
    alert("Iltimos, hisobot sanasini tanlang!");
    return;
  }

  elBtnStartScan.disabled = true;
  elBtnStartScan.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Skanerlanmoqda...`;

  elScanResultsSection.style.display = "block";
  elScanProgressBox.style.display = "flex";
  elScanProgressText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Karmed jadvali skanerlanmoqda...`;
  elScanProgressFill.style.width = "25%";

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) {
      throw new Error("Faol brauzer oynasi topilmadi!");
    }

    const payload = {
      targetDate: targetDate,
      targetDoctorName: targetDoctor,
      options: {
        strictDoctorMatch: elChkStrictDoctor.checked,
        autoPagination: elChkAutoPagination.checked
      }
    };

    chrome.tabs.sendMessage(tabs[0].id, { action: "START_SCAN", payload }, (res) => {
      elBtnStartScan.disabled = false;
      elBtnStartScan.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart"></i> Karmed Jadvalini Skanerlash & Sanash`;

      if (chrome.runtime.lastError) {
        elScanProgressText.innerHTML = `❌ Karmed sahifasini yangilang (F5) va qayta urinib ko'ring!`;
        elScanProgressFill.style.width = "100%";
        elScanProgressFill.style.background = "#ef4444";
        return;
      }

      if (res && res.success && res.data) {
        currentScannedReport = res.data;
        renderScanResults(res.data);
      } else {
        elScanProgressText.innerHTML = `❌ Xatolik: ${res ? res.error : "Noma'lum xatolik"}`;
        elScanProgressFill.style.width = "100%";
        elScanProgressFill.style.background = "#ef4444";
      }
    });

  } catch (err) {
    elBtnStartScan.disabled = false;
    elBtnStartScan.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart"></i> Karmed Jadvalini Skanerlash & Sanash`;
    elScanProgressText.innerHTML = `❌ Xatolik: ${err.message}`;
  }
}

// 3. NATIJALARNI RENDER QILISH
function renderScanResults(report) {
  elScanProgressFill.style.width = "100%";
  elScanProgressFill.style.background = "#10b981";
  elScanProgressText.innerHTML = `✅ Skanerlash muvaffaqiyatli yakunlandi!`;

  elResPatientCount.textContent = report.totalPatientsCount || 0;
  elResServiceCount.textContent = report.totalServicesCount || 0;

  // Kodlar taqsimoti
  elResCodesBadgesWrap.innerHTML = "";
  const breakdown = report.servicesBreakdown || {};
  const codes = Object.keys(breakdown);

  if (codes.length > 0) {
    codes.sort((a, b) => breakdown[b].count - breakdown[a].count).forEach(c => {
      const item = breakdown[c];
      const pill = document.createElement("div");
      pill.className = "code-pill";
      pill.title = item.name || c;
      pill.innerHTML = `<strong>${c}</strong> <span class="pill-count">${item.count}</span>`;
      elResCodesBadgesWrap.appendChild(pill);
    });
  } else {
    elResCodesBadgesWrap.innerHTML = `<span style="font-size:11px; color:#94a3b8;">Tekshiruv kodlari topilmadi</span>`;
  }

  // Bemorlar reyestri
  elResListCount.textContent = report.patientsList ? report.patientsList.length : 0;
  elResPatientsList.innerHTML = "";

  if (report.patientsList && report.patientsList.length > 0) {
    report.patientsList.forEach((pat, idx) => {
      const item = document.createElement("div");
      item.className = "patient-mini-item";

      const srvBadges = (pat.services || []).map(s => 
        `<span class="tag-service-mini" title="${escapeHtml(s.name)}">${escapeHtml(s.code)}</span>`
      ).join(" ");

      item.innerHTML = `
        <div class="patient-mini-top">
          <span>${idx + 1}. ${escapeHtml(pat.fullName)}</span>
          <span style="color:#0284c7;">ID: ${escapeHtml(pat.patientId)}</span>
        </div>
        <div style="font-size:10.5px; color:#64748b; margin-top:2px;">
          📅 ${escapeHtml(pat.confirmDate)} | 🏢 ${escapeHtml(pat.department || pat.priority || '')}
        </div>
        <div class="patient-mini-services">
          ${srvBadges || '<span style="color:#94a3b8; font-size:10px;">Xizmat ko\'rsatilgan</span>'}
        </div>
      `;
      elResPatientsList.appendChild(item);
    });
  }

  // Hisobchiga yuborish tugmasini faollashtirish
  elBtnSaveToFirebase.disabled = false;
  elBtnSaveToFirebase.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Hisobchi Bazasiga Saqlash (Firebase)`;
}

// 4. ACCORDION TOGGLE
function togglePreviewAccordion() {
  const isVisible = elPreviewBody.style.display === "block";
  elPreviewBody.style.display = isVisible ? "none" : "block";
  elPreviewChevron.className = isVisible ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up";
}

// 5. FIREBASE GA SAQLASH
async function handleSaveToFirebase() {
  if (!currentScannedReport) {
    alert("Saqlash uchun skanerlangan hisobot mavjud emas!");
    return;
  }

  elBtnSaveToFirebase.disabled = true;
  elBtnSaveToFirebase.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Firebase-ga yozilmoqda...`;

  try {
    const dateKey = currentScannedReport.date;
    const docSlug = (currentScannedReport.doctorName || 'all_doctors')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');

    // 1. Asosiy to'liq hisobotni saqlash
    const resMain = await fetch(`${FIREBASE_DB_URL}/accountant_reports/${dateKey}/${docSlug}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentScannedReport)
    });

    if (!resMain.ok) throw new Error("Asosiy hisobotni yozishda xatolik!");

    // 2. Hisobot indeksini yangilash
    const summaryData = {
      reportId: currentScannedReport.reportId,
      date: currentScannedReport.date,
      dateFormatted: currentScannedReport.dateFormatted,
      doctorName: currentScannedReport.doctorName,
      totalPatientsCount: currentScannedReport.totalPatientsCount,
      totalServicesCount: currentScannedReport.totalServicesCount,
      servicesBreakdown: currentScannedReport.servicesBreakdown,
      updatedAt: Date.now()
    };

    await fetch(`${FIREBASE_DB_URL}/accountant_reports_summary/${dateKey}/${docSlug}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(summaryData)
    });

    elBtnSaveToFirebase.innerHTML = `<i class="fa-solid fa-circle-check"></i> Muvaffaqiyatli Saqlandi!`;
    elBtnSaveToFirebase.classList.remove("btn-success");
    elBtnSaveToFirebase.classList.add("btn-primary");

    setTimeout(() => {
      elBtnSaveToFirebase.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Qayta Saqlash (Firebase)`;
      elBtnSaveToFirebase.disabled = false;
      elBtnSaveToFirebase.classList.remove("btn-primary");
      elBtnSaveToFirebase.classList.add("btn-success");
    }, 2500);

  } catch (err) {
    alert(`Firebase-ga saqlashda xatolik: ${err.message}`);
    elBtnSaveToFirebase.disabled = false;
    elBtnSaveToFirebase.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Hisobchi Bazasiga Saqlash (Firebase)`;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
