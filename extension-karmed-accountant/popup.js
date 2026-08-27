/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Popup Script
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";

// DOM Elementlari
let elReportStartDate, elReportEndDate;
let elBtnDateToday, elBtnDateYesterday, elBtnDateThisMonth, elBtnDateLastMonth, elBtnDateAll;
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
  elReportStartDate = document.getElementById("reportStartDateInput");
  elReportEndDate = document.getElementById("reportEndDateInput");

  elBtnDateToday = document.getElementById("btnDateToday");
  elBtnDateYesterday = document.getElementById("btnDateYesterday");
  elBtnDateThisMonth = document.getElementById("btnDateThisMonth");
  elBtnDateLastMonth = document.getElementById("btnDateLastMonth");
  elBtnDateAll = document.getElementById("btnDateAll");

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
  elBtnDateToday.addEventListener("click", () => applyDatePreset("today"));
  elBtnDateYesterday.addEventListener("click", () => applyDatePreset("yesterday"));
  elBtnDateThisMonth.addEventListener("click", () => applyDatePreset("thisMonth"));
  elBtnDateLastMonth.addEventListener("click", () => applyDatePreset("lastMonth"));
  elBtnDateAll.addEventListener("click", () => applyDatePreset("all"));

  elReportStartDate.addEventListener("change", () => {
    clearActiveDatePreset();
    savePreferences();
  });
  elReportEndDate.addEventListener("change", () => {
    clearActiveDatePreset();
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
  // Standart 1 oylik yoki bugun
  applyDatePreset("today");

  // Xotiradan oldingi tanlovlarni yuklash
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["lastTargetDoctor", "lastStrictDoctor", "lastAutoPage", "lastStartDate", "lastEndDate"], (res) => {
      if (res.lastTargetDoctor && elDoctorSelect) {
        elDoctorSelect.value = res.lastTargetDoctor;
      }
      if (res.lastStrictDoctor !== undefined && elChkStrictDoctor) {
        elChkStrictDoctor.checked = Boolean(res.lastStrictDoctor);
      }
      if (res.lastAutoPage !== undefined && elChkAutoPagination) {
        elChkAutoPagination.checked = Boolean(res.lastAutoPage);
      }
      if (res.lastStartDate && res.lastEndDate) {
        elReportStartDate.value = res.lastStartDate;
        elReportEndDate.value = res.lastEndDate;
        clearActiveDatePreset();
      }
    });
  }
}

function applyDatePreset(preset) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  clearActiveDatePreset();

  if (preset === "today") {
    elReportStartDate.value = todayStr;
    elReportEndDate.value = todayStr;
    elBtnDateToday.classList.add("active");
  } else if (preset === "yesterday") {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    elReportStartDate.value = yStr;
    elReportEndDate.value = yStr;
    elBtnDateYesterday.classList.add("active");
  } else if (preset === "thisMonth") {
    // 1 Oylik: oyning 1-kunidan oxirgi kunigacha
    const lastDay = new Date(yyyy, now.getMonth() + 1, 0).getDate();
    elReportStartDate.value = `${yyyy}-${mm}-01`;
    elReportEndDate.value = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;
    elBtnDateThisMonth.classList.add("active");
  } else if (preset === "lastMonth") {
    const prevMonthDate = new Date(yyyy, now.getMonth() - 1, 1);
    const pY = prevMonthDate.getFullYear();
    const pM = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const pLastDay = new Date(pY, prevMonthDate.getMonth() + 1, 0).getDate();
    elReportStartDate.value = `${pY}-${pM}-01`;
    elReportEndDate.value = `${pY}-${pM}-${String(pLastDay).padStart(2, '0')}`;
    elBtnDateLastMonth.classList.add("active");
  } else if (preset === "all") {
    elReportStartDate.value = "";
    elReportEndDate.value = "";
    elBtnDateAll.classList.add("active");
  }

  savePreferences();
}

function clearActiveDatePreset() {
  [elBtnDateToday, elBtnDateYesterday, elBtnDateThisMonth, elBtnDateLastMonth, elBtnDateAll].forEach(btn => {
    if (btn) btn.classList.remove("active");
  });
}

function savePreferences() {
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      lastTargetDoctor: elDoctorSelect.value,
      lastStrictDoctor: elChkStrictDoctor.checked,
      lastAutoPage: elChkAutoPagination.checked,
      lastStartDate: elReportStartDate.value,
      lastEndDate: elReportEndDate.value
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
  const startDate = elReportStartDate.value;
  const endDate = elReportEndDate.value;
  const targetDoctor = elDoctorSelect.value;

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
      targetStartDate: startDate,
      targetEndDate: endDate,
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
  elScanProgressText.innerHTML = `✅ Skanerlash yakunlandi! Jami: ${report.totalPatientsCount} ta bemor, ${report.totalServicesCount} ta soha topildi.`;

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
          📅 ${escapeHtml(pat.confirmDate)} | 👨‍⚕️ ${escapeHtml(pat.doctorName || '')} | 🏢 ${escapeHtml(pat.department || pat.priority || '')}
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

// 5. FIREBASE GA SAQLASH (KUNBAY VA ORALIQ GURUHLASH)
async function handleSaveToFirebase() {
  if (!currentScannedReport) {
    alert("Saqlash uchun skanerlangan hisobot mavjud emas!");
    return;
  }

  elBtnSaveToFirebase.disabled = true;
  elBtnSaveToFirebase.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Firebase-ga yozilmoqda...`;

  try {
    const patients = currentScannedReport.patientsList || [];
    
    // 1. Bemorlarni kunbay guruhlash (har bir bemor o'zining tasdiqlangan sanasi bo'yicha)
    const dayGroups = {};
    patients.forEach(p => {
      const d = p.confirmDateNorm || currentScannedReport.startDate || new Date().toISOString().split('T')[0];
      if (!dayGroups[d]) dayGroups[d] = [];
      dayGroups[d].push(p);
    });

    const docSlug = (currentScannedReport.doctorName || 'all_doctors')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');

    // Har bir kun uchun hisobotni Firebase-ga PUT qilish
    for (const dKey of Object.keys(dayGroups)) {
      const dayPatients = dayGroups[dKey];
      const dayBreakdown = {};
      let dayServicesCount = 0;

      dayPatients.forEach(p => {
        (p.services || []).forEach(s => {
          dayServicesCount++;
          const c = s.code || "OTHER";
          if (!dayBreakdown[c]) dayBreakdown[c] = { code: c, name: s.name, count: 0 };
          dayBreakdown[c].count++;
        });
      });

      const dayReportData = {
        reportId: `rep_${dKey}_${docSlug}`,
        date: dKey,
        doctorName: currentScannedReport.doctorName,
        totalPatientsCount: dayPatients.length,
        totalServicesCount: dayServicesCount,
        servicesBreakdown: dayBreakdown,
        patientsList: dayPatients,
        updatedAt: Date.now()
      };

      await fetch(`${FIREBASE_DB_URL}/accountant_reports/${dKey}/${docSlug}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dayReportData)
      });
    }

    // 2. Oraliq hisobotini ham alohida saqlash (Range / Monthly)
    const rangeKey = `${currentScannedReport.startDate || 'all'}_to_${currentScannedReport.endDate || 'all'}`;
    await fetch(`${FIREBASE_DB_URL}/accountant_reports_range/${rangeKey}/${docSlug}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentScannedReport)
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
