/**
 * Karmed Vrach Bemorlarini Sanash & Hisobchi Portali - Popup Script
 * Google Sheets (Farq / Sevinch / Karmed) Integratsiyasi bilan
 */

const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const DEFAULT_SHEETS_SCRIPT_URL = "";

// DOM Elementlari
let elReportStartDate, elReportEndDate;
let elBtnDateToday, elBtnDateYesterday, elBtnDateThisMonth, elBtnDateLastMonth, elBtnDateAll;
let elDoctorSelect, elBtnAutoDetectDoctor, elDetectedGroup;
let elChkStrictDoctor, elChkAutoPagination, elChkOnlySheetsIds;
let elBtnStartScan, elScanResultsSection, elScanProgressBox, elScanProgressText, elScanProgressFill;
let elResPatientCount, elResServiceCount, elResTotalSummaValue, elResCodesBadgesWrap;
let elBtnTogglePreview, elPreviewBody, elPreviewChevron, elResListCount, elResPatientsList;
let elBtnSaveToFirebase, elBtnSaveToSheetsDirect, elConnectionBadge, elLinkOpenPortal;

// Google Sheets DOM Elementlari
let elBtnToggleSheetsConfig, elSheetsConfigPanel, elInputSheetsScriptUrl, elInputSpreadsheetId;
let elInputSourceSheetName, elInputTargetSheetName, elBtnFetchSheetsIds;
let elBtnExportToSheets, elBtnAutoSyncAll, elSheetsStatusText, elSheetsLoadedStatusPill;

let currentScannedReport = null;
let loadedSheetsPatientIds = [];
let loadedSheetsPatients = [];

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

  elChkOnlySheetsIds = document.getElementById("chkOnlySheetsIds");
  elChkStrictDoctor = document.getElementById("chkStrictDoctorMatch");
  elChkAutoPagination = document.getElementById("chkAutoPagination");

  elBtnStartScan = document.getElementById("btnStartScan");
  elScanResultsSection = document.getElementById("scanResultsSection");
  elScanProgressBox = document.getElementById("scanProgressBox");
  elScanProgressText = document.getElementById("scanProgressText");
  elScanProgressFill = document.getElementById("scanProgressFill");

  elResPatientCount = document.getElementById("resPatientCount");
  elResServiceCount = document.getElementById("resServiceCount");
  elResTotalSummaValue = document.getElementById("resTotalSummaValue");
  elResCodesBadgesWrap = document.getElementById("resCodesBadgesWrap");

  elBtnTogglePreview = document.getElementById("btnTogglePreview");
  elPreviewBody = document.getElementById("previewBody");
  elPreviewChevron = document.getElementById("previewChevron");
  elResListCount = document.getElementById("resListCount");
  elResPatientsList = document.getElementById("resPatientsList");

  elBtnSaveToSheetsDirect = document.getElementById("btnSaveToSheetsDirect");
  elBtnSaveToFirebase = document.getElementById("btnSaveToFirebase");
  elConnectionBadge = document.getElementById("connectionBadge");
  elLinkOpenPortal = document.getElementById("linkOpenAccountantPortal");

  // Sheets Elementlari
  elBtnToggleSheetsConfig = document.getElementById("btnToggleSheetsConfig");
  elSheetsConfigPanel = document.getElementById("sheetsConfigPanel");
  elInputSheetsScriptUrl = document.getElementById("inputSheetsScriptUrl");
  elInputSpreadsheetId = document.getElementById("inputSpreadsheetId");
  elInputSourceSheetName = document.getElementById("inputSourceSheetName");
  elInputTargetSheetName = document.getElementById("inputTargetSheetName");
  elBtnSaveSheetsConfig = document.getElementById("btnSaveSheetsConfig");
  elBtnClearSheetsCache = document.getElementById("btnClearSheetsCache");
  elSheetsConfigSaveStatus = document.getElementById("sheetsConfigSaveStatus");
  elBtnFetchSheetsIds = document.getElementById("btnFetchSheetsIds");
  elBtnExportToSheets = document.getElementById("btnExportToSheets");
  elBtnAutoSyncAll = document.getElementById("btnAutoSyncAll");
  elSheetsStatusText = document.getElementById("sheetsStatusText");
  elSheetsLoadedStatusPill = document.getElementById("sheetsLoadedStatusPill");
}

function setupEventListeners() {
  elBtnDateToday.addEventListener("click", () => applyDatePreset("today"));
  elBtnDateYesterday.addEventListener("click", () => applyDatePreset("yesterday"));
  elBtnDateThisMonth.addEventListener("click", () => applyDatePreset("thisMonth"));
  elBtnDateLastMonth.addEventListener("click", () => applyDatePreset("lastMonth"));
  elBtnDateAll.addEventListener("click", () => applyDatePreset("all"));

  elReportStartDate.addEventListener("change", () => { clearActiveDatePreset(); savePreferences(); });
  elReportEndDate.addEventListener("change", () => { clearActiveDatePreset(); savePreferences(); });

  elDoctorSelect.addEventListener("change", savePreferences);
  elChkOnlySheetsIds.addEventListener("change", savePreferences);
  elChkStrictDoctor.addEventListener("change", savePreferences);
  elChkAutoPagination.addEventListener("change", savePreferences);

  elBtnAutoDetectDoctor.addEventListener("click", handleAutoDetectDoctors);
  elBtnStartScan.addEventListener("click", () => handleStartScan(false));
  elBtnTogglePreview.addEventListener("click", togglePreviewAccordion);

  elBtnSaveToFirebase.addEventListener("click", handleSaveToFirebase);
  elBtnSaveToSheetsDirect.addEventListener("click", handleExportToSheets);

  elBtnToggleSheetsConfig.addEventListener("click", () => {
    const isHidden = elSheetsConfigPanel.style.display === "none";
    elSheetsConfigPanel.style.display = isHidden ? "block" : "none";
  });

  // Real-time va button orqali saqlash
  elInputSheetsScriptUrl.addEventListener("input", savePreferences);
  if (elInputSpreadsheetId) elInputSpreadsheetId.addEventListener("input", savePreferences);
  elInputSourceSheetName.addEventListener("input", savePreferences);
  elInputTargetSheetName.addEventListener("input", savePreferences);

  if (elBtnSaveSheetsConfig) {
    elBtnSaveSheetsConfig.addEventListener("click", () => {
      savePreferences();
      showConfigSaveFeedback("✅ Sozlamalar saqlandi!");
    });
  }

  if (elBtnClearSheetsCache) {
    elBtnClearSheetsCache.addEventListener("click", handleClearSheetsCache);
  }

  elBtnFetchSheetsIds.addEventListener("click", handleFetchSheetsIds);
  elBtnExportToSheets.addEventListener("click", handleExportToSheets);
  elBtnAutoSyncAll.addEventListener("click", handleAutoSyncAll);
}

function handleClearSheetsCache() {
  if (confirm("🧹 Barcha eski saqlangan sozlamalar, kesh va bemor ID lari tozalansinmi?")) {
    loadedSheetsPatientIds = [];
    loadedSheetsPatients = [];
    if (elInputSheetsScriptUrl) elInputSheetsScriptUrl.value = "";
    if (elInputSpreadsheetId) elInputSpreadsheetId.value = "";
    if (elInputSourceSheetName) elInputSourceSheetName.value = "";
    if (elInputTargetSheetName) elInputTargetSheetName.value = "";

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove([
        "sheetsScriptUrl", "spreadsheetId", "sourceSheetName", "targetSheetName",
        "cachedSheetsIds", "cachedSheetsPatients"
      ], () => {
        updateSheetsStatusPill(0, "");
        showConfigSaveFeedback("🧹 Kesh va eski sozlamalar tozalandi!");
      });
    }

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "UPDATE_SETTINGS",
          payload: {
            sheetsScriptUrl: "",
            spreadsheetId: "",
            targetSheetName: "Farq"
          }
        }, () => {
          const _ = chrome.runtime.lastError;
        });
      }
    });
  }
}

function showConfigSaveFeedback(msg = "✅ Sozlamalar saqlandi!") {
  if (elSheetsConfigSaveStatus) {
    elSheetsConfigSaveStatus.style.display = "block";
    elSheetsConfigSaveStatus.innerText = msg;
    setTimeout(() => {
      if (elSheetsConfigSaveStatus) elSheetsConfigSaveStatus.style.display = "none";
    }, 3000);
  }
}

function initDefaults() {
  applyDatePreset("today");

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      "lastTargetDoctor", "lastStrictDoctor", "lastAutoPage", "lastOnlySheetsIds",
      "lastStartDate", "lastEndDate", "sheetsScriptUrl", "spreadsheetId", "sourceSheetName", "targetSheetName",
      "cachedSheetsIds", "cachedSheetsPatients"
    ], (res) => {
      if (res.lastTargetDoctor && elDoctorSelect) elDoctorSelect.value = res.lastTargetDoctor;
      if (res.lastStrictDoctor !== undefined && elChkStrictDoctor) elChkStrictDoctor.checked = Boolean(res.lastStrictDoctor);
      if (res.lastAutoPage !== undefined && elChkAutoPagination) elChkAutoPagination.checked = Boolean(res.lastAutoPage);
      if (res.lastOnlySheetsIds !== undefined && elChkOnlySheetsIds) elChkOnlySheetsIds.checked = Boolean(res.lastOnlySheetsIds);

      if (elInputSheetsScriptUrl) elInputSheetsScriptUrl.value = res.sheetsScriptUrl || "";
      if (elInputSpreadsheetId) elInputSpreadsheetId.value = res.spreadsheetId || "";
      if (elInputSourceSheetName) elInputSourceSheetName.value = res.sourceSheetName || "Sevinch";
      if (elInputTargetSheetName) elInputTargetSheetName.value = res.targetSheetName || "Farq";

      if (res.cachedSheetsIds && Array.isArray(res.cachedSheetsIds) && res.cachedSheetsIds.length > 0) {
        loadedSheetsPatientIds = res.cachedSheetsIds;
        loadedSheetsPatients = res.cachedSheetsPatients || [];
        updateSheetsStatusPill(loadedSheetsPatientIds.length, res.sourceSheetName || "Sevinch");
      } else {
        updateSheetsStatusPill(0, "");
      }

      if (res.lastStartDate && res.lastEndDate) {
        elReportStartDate.value = res.lastStartDate;
        elReportEndDate.value = res.lastEndDate;
        clearActiveDatePreset();
      }
    });
  }
}

function extractSheetId(inputStr) {
  if (!inputStr) return "";
  const str = inputStr.trim();
  const match = str.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  return str;
}

function savePreferences() {
  const scriptUrl = elInputSheetsScriptUrl.value.trim();
  const sheetId = elInputSpreadsheetId ? extractSheetId(elInputSpreadsheetId.value.trim()) : "";
  const sourceSheet = elInputSourceSheetName.value.trim() || "Sevinch";
  const targetSheet = elInputTargetSheetName.value.trim() || "Farq";

  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({
      lastTargetDoctor: elDoctorSelect.value,
      lastStrictDoctor: elChkStrictDoctor.checked,
      lastAutoPage: elChkAutoPagination.checked,
      lastOnlySheetsIds: elChkOnlySheetsIds.checked,
      lastStartDate: elReportStartDate.value,
      lastEndDate: elReportEndDate.value,
      sheetsScriptUrl: scriptUrl,
      spreadsheetId: sheetId,
      sourceSheetName: sourceSheet,
      targetSheetName: targetSheet
    });
  }

  // Active tabga yangilanishlarni yuborish
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "UPDATE_SETTINGS",
        payload: {
          sheetsScriptUrl: scriptUrl,
          spreadsheetId: sheetId,
          targetSheetName: targetSheet
        }
      }, () => {
        const _ = chrome.runtime.lastError;
      });
    }
  });
}

// 1. GOOGLE SHEETS-DAN BEMOR ID LARINI YUKLASH (GET)
async function handleFetchSheetsIds() {
  const scriptUrl = elInputSheetsScriptUrl.value.trim();
  const sheetId = elInputSpreadsheetId ? extractSheetId(elInputSpreadsheetId.value.trim()) : "";
  const sourceSheet = elInputSourceSheetName.value.trim() || "Sevinch";

  if (!scriptUrl) {
    elSheetsConfigPanel.style.display = "block";
    elInputSheetsScriptUrl.focus();
    alert("⚠️ Google Apps Script Web App URL manzilini kiriting!\n(Ko'rsatma google_apps_script.js faylida keltirilgan)");
    return;
  }

  if (!scriptUrl.includes("script.google.com/macros/s/")) {
    elSheetsConfigPanel.style.display = "block";
    elInputSheetsScriptUrl.focus();
    alert("⚠️ Apps Script Web App URL noto'g'ri!\nURL manzili https://script.google.com/macros/s/.../exec ko'rinishida bo'lishi shart (Google Sheets fayl havolasi emas).");
    return;
  }

  elBtnFetchSheetsIds.disabled = true;
  elBtnFetchSheetsIds.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Yuklanmoqda...`;

  try {
    const fetchUrl = `${scriptUrl}?action=get_patient_ids&spreadsheetId=${encodeURIComponent(sheetId)}&sheetName=${encodeURIComponent(sourceSheet)}`;
    const response = await fetch(fetchUrl, { redirect: "follow" });
    const rawText = await response.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      if (rawText.includes("<!DOCTYPE") || rawText.includes("<html")) {
        throw new Error("Google Apps Script ruxsati noto'g'ri!\nApps Script-da 'Развернуть (Deploy)' qilayotganda 'Кто имеет доступ (Who has access)' ni 'Все (Anyone)' qilib belgilang.");
      } else {
        throw new Error(rawText || "Kutilmagan server javobi");
      }
    }

    if (data.status === "success" && Array.isArray(data.patientIds)) {
      loadedSheetsPatientIds = data.patientIds;
      loadedSheetsPatients = data.patients || [];

      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({
          cachedSheetsIds: loadedSheetsPatientIds,
          cachedSheetsPatients: loadedSheetsPatients
        });
      }

      updateSheetsStatusPill(loadedSheetsPatientIds.length, sourceSheet);
      savePreferences();
      alert(`✅ Google Sheets "${sourceSheet}" varag'idan ${loadedSheetsPatientIds.length} ta Bemor ID muvaffaqiyatli yuklandi!`);
    } else {
      throw new Error(data.message || "Bemor ID lari topilmadi");
    }
  } catch (err) {
    alert("❌ Sheets-dan yuklashda xatolik:\n" + err.message);
  } finally {
    elBtnFetchSheetsIds.disabled = false;
    elBtnFetchSheetsIds.innerHTML = `<i class="fa-solid fa-file-import"></i> 1. ID larni Yuklash`;
  }
}

function updateSheetsStatusPill(count, sheetName) {
  if (count > 0) {
    elSheetsStatusText.innerHTML = `<b>${count} ta Bemor ID</b> yuklangan (${sheetName})`;
    elSheetsLoadedStatusPill.style.color = "#065f46";
    elSheetsLoadedStatusPill.style.background = "#d1fae5";
    if (elBtnExportToSheets) elBtnExportToSheets.disabled = false;
  } else {
    elSheetsStatusText.innerText = "Sheets-dan ID lar yuklanmagan";
  }
}

// 2. KARMED JADVALINI SKANERLASH (2-QADAM)
async function handleStartScan(autoExportAfter = false) {
  const startDate = elReportStartDate.value;
  const endDate = elReportEndDate.value;
  const selectedDoctor = elDoctorSelect.value;
  const strictDoc = elChkStrictDoctor.checked;
  const autoPage = elChkAutoPagination.checked;
  const useSheetsIds = elChkOnlySheetsIds.checked && loadedSheetsPatientIds.length > 0;

  elBtnStartScan.disabled = true;
  elBtnStartScan.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Skanerlanmoqda...`;

  elScanResultsSection.style.display = "block";
  elScanProgressBox.style.display = "block";
  elScanProgressText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Karmed tahlil qilinmoqda...`;
  elScanProgressFill.style.width = "10%";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("Aktiv brauzer oynasi topilmadi");

    const payload = {
      targetStartDate: startDate,
      targetEndDate: endDate,
      targetDoctorName: selectedDoctor,
      targetPatientIds: useSheetsIds ? loadedSheetsPatientIds : null,
      options: {
        strictDoctorMatch: strictDoc,
        autoPagination: autoPage,
        onlySheetsIds: useSheetsIds
      }
    };

    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "START_SCAN",
      payload: payload
    });

    if (!response || !response.success) {
      throw new Error(response?.error || "Karmed sahifasidan javob olinmadi");
    }

    currentScannedReport = response.data;
    renderScanResults(currentScannedReport);

    if (autoExportAfter) {
      await handleExportToSheets();
    }

  } catch (err) {
    elScanProgressText.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Xatolik: ${err.message}</span>`;
    alert("Skanerlashda xatolik yuz berdi: " + err.message);
  } finally {
    elBtnStartScan.disabled = false;
    elBtnStartScan.innerHTML = `<i class="fa-solid fa-magnifying-glass-chart"></i> 2. Karmed Jadvalini Skanerlash & Yig'ish`;
  }
}

// 3. NATIJALARNI GOOGLE SHEETS-GA YOZISH (POST)
async function handleExportToSheets() {
  if (!currentScannedReport || !currentScannedReport.detailedRecords || currentScannedReport.detailedRecords.length === 0) {
    alert("⚠️ Avval 2-bosqichda Karmed jadvalini skanerlab, tekshiruvlarni yig'ing!");
    return;
  }

  const scriptUrl = elInputSheetsScriptUrl.value.trim();
  const sheetId = elInputSpreadsheetId ? extractSheetId(elInputSpreadsheetId.value.trim()) : "";
  const targetSheet = elInputTargetSheetName.value.trim() || "Farq";

  if (!scriptUrl) {
    elSheetsConfigPanel.style.display = "block";
    elInputSheetsScriptUrl.focus();
    alert("⚠️ Google Apps Script Web App URL manzilini kiriting!");
    return;
  }

  if (!scriptUrl.includes("script.google.com/macros/s/")) {
    elSheetsConfigPanel.style.display = "block";
    elInputSheetsScriptUrl.focus();
    alert("⚠️ Apps Script Web App URL noto'g'ri!\nURL manzili https://script.google.com/macros/s/.../exec ko'rinishida bo'lishi shart (Google Sheets fayl havolasi emas).");
    return;
  }

  const btn = elBtnSaveToSheetsDirect;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Google Sheets-ga saqlanmoqda...`;

  try {
    const postBody = {
      action: "save_karmed_records",
      spreadsheetId: sheetId,
      sheetName: targetSheet,
      records: currentScannedReport.detailedRecords
    };

    const res = await fetch(scriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(postBody)
    });

    const rawText = await res.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      if (rawText.includes("<!DOCTYPE") || rawText.includes("<html")) {
        throw new Error("Google Apps Script ruxsati noto'g'ri!\nApps Script-da 'Развернуть (Deploy)' qilayotganda 'Кто имеет доступ (Who has access)' ni 'Все (Anyone)' qilib belgilang.");
      } else {
        throw new Error(rawText || "Kutilmagan server javobi");
      }
    }

    if (data.status === "success") {
      alert(`🎉 Muvaffaqiyatli saqlandi!\n\n📄 Varag'i: ${targetSheet}\n📊 Saqlangan tekshiruvlar soni: ${data.addedCount || currentScannedReport.detailedRecords.length} ta\n💰 Jami summa: ${currentScannedReport.totalSumFormatted}`);
    } else {
      throw new Error(data.message || "Saqlashda xatolik");
    }
  } catch (err) {
    alert("❌ Google Sheets-ga saqlash xatosi:\n" + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-file-excel"></i> Natijalarni Google Sheets-ga Saqlash`;
  }
}

// 4. AVTOMATIK HAMMASINI BAJARISH (1 ➡️ 2 ➡️ 3)
async function handleAutoSyncAll() {
  const scriptUrl = elInputSheetsScriptUrl.value.trim();
  if (!scriptUrl) {
    elSheetsConfigPanel.style.display = "block";
    elInputSheetsScriptUrl.focus();
    alert("⚠️ Avval Google Apps Script URL manzilini kiriting!");
    return;
  }

  await handleFetchSheetsIds();

  if (loadedSheetsPatientIds.length > 0) {
    elChkOnlySheetsIds.checked = true;
    await handleStartScan(true);
  }
}

function renderScanResults(report) {
  elScanProgressBox.style.display = "none";
  elResPatientCount.innerText = report.totalPatientsCount || 0;
  elResServiceCount.innerText = report.totalServicesCount || 0;
  elResTotalSummaValue.innerText = report.totalSumFormatted || "0 so'm";
  elResListCount.innerText = report.totalPatientsCount || 0;

  elResCodesBadgesWrap.innerHTML = "";
  const codes = Object.values(report.servicesBreakdown || {});
  if (codes.length === 0) {
    elResCodesBadgesWrap.innerHTML = `<span style="font-size:11px; color:#94a3b8;">Xizmat kodlari topilmadi</span>`;
  } else {
    codes.sort((a, b) => b.count - a.count).forEach(c => {
      const badge = document.createElement("div");
      badge.className = "badge-code-item";
      badge.innerHTML = `<b>${c.code}</b> <span>${c.name}</span> <span class="badge-count">${c.count}</span>`;
      elResCodesBadgesWrap.appendChild(badge);
    });
  }

  elResPatientsList.innerHTML = "";
  const patients = report.patientsList || [];
  patients.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "patient-mini-item";

    const srvTags = (p.services || []).map(s => `
      <span class="tag-service-mini" title="${s.price ? s.price.toLocaleString('ru-RU') + ' so\'m' : ''}">
        ${s.code}: ${s.name} (${s.price ? s.price.toLocaleString('ru-RU') : 0} so'm)
      </span>
    `).join("");

    item.innerHTML = `
      <div class="patient-mini-top">
        <span>${idx + 1}. ${escapeHtml(p.fullName)} (ID: ${p.patientId})</span>
        <span style="color:#0284c7;">${p.totalPriceFormatted || ''}</span>
      </div>
      <div style="font-size:10.5px; color:#64748b; margin-top:2px;">
        📅 ${p.confirmDate || ''} • 🏛️ ${p.muassasa || 'Rezident'} • 👨‍⚕️ ${p.doctorName || ''}
      </div>
      <div class="patient-mini-services">${srvTags || '<span style="color:#94a3b8; font-size:10px;">Standart ko\'rik</span>'}</div>
    `;
    elResPatientsList.appendChild(item);
  });

  if (elBtnExportToSheets) elBtnExportToSheets.disabled = false;
}

// 5. FIREBASE-GA SAQLASH
async function handleSaveToFirebase() {
  if (!currentScannedReport) return;
  const btn = elBtnSaveToFirebase;
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Firebase-ga saqlanmoqda...`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: "SAVE_REPORT_FIREBASE",
      payload: currentScannedReport
    });

    if (response && response.success) {
      alert("✅ Hisobot Firebase hisobchi bazasiga muvaffaqiyatli saqlandi!");
    } else {
      throw new Error(response?.error || "Saqlashda xatolik");
    }
  } catch (err) {
    alert("❌ Firebase-ga saqlashda xatolik: " + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Firebase Bazasiga ham Saqlash`;
  }
}

// 6. SHIFOKORLARNI ANIQLASH
async function handleAutoDetectDoctors() {
  elBtnAutoDetectDoctor.disabled = true;
  elBtnAutoDetectDoctor.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>...`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const res = await chrome.tabs.sendMessage(tab.id, { action: "DETECT_PAGE_DOCTORS" });

    if (res && res.success && res.doctors.length > 0) {
      elDetectedGroup.innerHTML = "";
      elDetectedGroup.style.display = "block";

      res.doctors.forEach(doc => {
        const opt = document.createElement("option");
        opt.value = doc;
        opt.innerText = `🔍 ${doc}`;
        elDetectedGroup.appendChild(opt);
      });

      elDoctorSelect.value = res.doctors[0];
      savePreferences();
      alert(`✅ Sahifadan ${res.doctors.length} ta shifokor aniqlandi!`);
    } else {
      alert("ℹ️ Sahifadagi shifokorlar topilmadi yoki jadval ochilmagan");
    }
  } catch (e) {
    alert("Ulanish xatosi: Karmed sahifasi ochilganligini tekshiring");
  } finally {
    elBtnAutoDetectDoctor.disabled = false;
    elBtnAutoDetectDoctor.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> Sahifadan olish`;
  }
}

function togglePreviewAccordion() {
  const isShown = elPreviewBody.style.display !== "none";
  elPreviewBody.style.display = isShown ? "none" : "block";
  elPreviewChevron.className = isShown ? "fa-solid fa-chevron-down" : "fa-solid fa-chevron-up";
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

async function checkActiveTabConnection() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      setConnectionStatus(false, "Tab topilmadi");
      return;
    }

    if (!tab.url.includes("192.168.150.111") && !tab.url.includes("213.230.91.59") && !tab.url.includes("karmed")) {
      setConnectionStatus(false, "Karmed emas");
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: "DETECT_PAGE_DOCTORS" }, (res) => {
      const err = chrome.runtime.lastError;
      if (err || !res) {
        setConnectionStatus(false, "Sahifani yangilang (F5)");
      } else {
        setConnectionStatus(true, "Karmed Tayyor");
      }
    });
  } catch (e) {
    setConnectionStatus(false, "Ulanmagan");
  }
}

function setConnectionStatus(isReady, text) {
  if (elConnectionBadge) {
    elConnectionBadge.className = `status-badge ${isReady ? 'live' : 'offline'}`;
    elConnectionBadge.innerHTML = `<i class="fa-solid fa-circle"></i> ${text}`;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
