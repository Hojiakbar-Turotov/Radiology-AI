/**
 * Registratura - Asosiy JavaScript Mantiqi
 */

let db = null;
let patientsList = [];
let doctorsList = [];
let todayDateStr = "";
let selectedQueueDate = "";
let currentPatientsRef = null;

// Boshlang'ich yuklash
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  setTodayDate();
  
  // Firebase-ni ishga tushirish
  db = initFirebase();

  if (db) {
    setupConnectionMonitor();
    listenToDoctors();
    listenToPatients(todayDateStr);
    listenToServices();

    // Dastlabki sana qiymatlari
    const qDateEl = document.getElementById("queueDateFilter");
    if (qDateEl) qDateEl.value = todayDateStr;
    const pDateEl = document.getElementById("patientAppDate");
    if (pDateEl) pDateEl.value = todayDateStr;
  } else {
    updateConnStatus(false, "Firebase sozlanmagan!");
  }
}

// 1. FIREBASE ULANISH MONITORINGI
function setupConnectionMonitor() {
  const connectedRef = db.ref(".info/connected");
  connectedRef.on("value", (snap) => {
    const isOnline = snap.val() === true;
    updateConnStatus(isOnline, isOnline ? "Firebase: Ulangan" : "Firebase: Ulanish uzildi");
  });
}

function updateConnStatus(isOnline, text) {
  const dot = document.getElementById("connDot");
  const txt = document.getElementById("connText");
  if (dot) {
    dot.className = isOnline ? "status-dot connected" : "status-dot disconnected";
  }
  if (txt) {
    txt.innerText = text || (isOnline ? "Firebase: Ulangan" : "Firebase: Ulanish uzildi");
  }
}

// 1.1 VRACHLAR VA QURILMALAR RO'YXATINI TINGLASH
function listenToDoctors() {
  db.ref("doctors").on("value", (snapshot) => {
    doctorsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        doctorsList.push({ id: key, ...data[key] });
      });
    }
    renderDoctors();
    updateDoctorSelectOptions();
  });
}

// Bugungi sana
function setTodayDate() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById("currentDate").innerText = now.toLocaleDateString('uz-UZ', options);
  
  // Format: YYYY-MM-DD (Firebase query uchun)
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  todayDateStr = `${y}-${m}-${d}`;
  selectedQueueDate = todayDateStr;
}

function getDateStrWithOffset(offsetDays) {
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeToMinutes(tStr) {
  if (!tStr) return 0;
  const parts = tStr.trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function addMinutesToTime(tStr, mins) {
  if (!tStr) return "08:00";
  const parts = tStr.trim().split(":");
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  const total = h * 60 + m + parseInt(mins, 10);
  const rH = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const rM = String(total % 60).padStart(2, "0");
  return `${rH}:${rM}`;
}

// 2. BEMORLAR NAVBATINI TINGLASH (Ixtiyoriy sana uchun)
function listenToPatients(targetDate) {
  selectedQueueDate = targetDate || todayDateStr;
  if (currentPatientsRef) {
    currentPatientsRef.off();
  }

  currentPatientsRef = db.ref(`patients/${selectedQueueDate}`);
  currentPatientsRef.on("value", (snapshot) => {
    patientsList = [];
    const data = snapshot.val();
    if (data) {
      Object.keys(data).forEach((key) => {
        patientsList.push({ id: key, ...data[key] });
      });
    }
    // Vaqt bo'yicha saralash
    patientsList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    renderQueueTable();
    updateStats();
  });
}

function changeQueueDate(newDate) {
  if (!newDate) return;
  listenToPatients(newDate);
}

function setQueueDateQuick(offsetDays) {
  const targetDate = getDateStrWithOffset(offsetDays);
  const dateInput = document.getElementById("queueDateFilter");
  if (dateInput) dateInput.value = targetDate;
  listenToPatients(targetDate);
}

function setAppDateOffset(offsetDays) {
  const targetDate = getDateStrWithOffset(offsetDays);
  const dateInput = document.getElementById("patientAppDate");
  if (dateInput) {
    dateInput.value = targetDate;
    onDateOrDoctorOrTimeChanged();
  }
}

function togglePatientDepartment() {
  const type = document.getElementById("patientTypeSelect") ? document.getElementById("patientTypeSelect").value : "Uyidan qatnaydi";
  const deptGroup = document.getElementById("deptInputGroup");
  if (deptGroup) {
    deptGroup.style.display = type === "Bo'limda yotibdi" ? "block" : "none";
    if (type === "Bo'limda yotibdi" && document.getElementById("patientDepartment")) {
      document.getElementById("patientDepartment").focus();
    }
  }
}

// 3. JADVALNI SARALASH VA CHIZISH
let currentSortColumn = "scheduledTime"; // Boshlang'ich saralash: Vaqt bo'yicha
let currentSortOrder = "asc"; // "asc" yoki "desc"

function toggleSort(columnKey) {
  if (currentSortColumn === columnKey) {
    currentSortOrder = (currentSortOrder === "asc") ? "desc" : "asc";
  } else {
    currentSortColumn = columnKey;
    currentSortOrder = "asc";
  }
  updateSortHeaderUI();
  renderQueueTable();
}

function updateSortHeaderUI() {
  const allThs = document.querySelectorAll(".data-table th.sortable");
  allThs.forEach(th => {
    th.classList.remove("sort-active");
    const indicator = th.querySelector(".sort-indicator");
    if (indicator) indicator.innerHTML = '<i class="fa-solid fa-sort"></i>';
  });

  const activeTh = document.getElementById(`th-${currentSortColumn}`);
  if (activeTh) {
    activeTh.classList.add("sort-active");
    const indicator = activeTh.querySelector(".sort-indicator");
    if (indicator) {
      indicator.innerHTML = currentSortOrder === "asc"
        ? '<i class="fa-solid fa-sort-up"></i>'
        : '<i class="fa-solid fa-sort-down"></i>';
    }
  }
}

function renderQueueTable() {
  const tbody = document.getElementById("queueTableBody");
  if (!tbody) return;

  const searchQuery = (document.getElementById("searchInput") ? document.getElementById("searchInput").value : "").toLowerCase();
  const docFilter = document.getElementById("doctorFilter") ? document.getElementById("doctorFilter").value : "all";
  const statusFilter = document.getElementById("statusFilter") ? document.getElementById("statusFilter").value : "all";

  const filtered = patientsList.filter((p) => {
    const matchSearch = (p.name && p.name.toLowerCase().includes(searchQuery)) ||
                        (p.ticketId && p.ticketId.toLowerCase().includes(searchQuery)) ||
                        (p.phone && p.phone.includes(searchQuery)) ||
                        (p.referringDoctor && p.referringDoctor.toLowerCase().includes(searchQuery)) ||
                        (p.department && p.department.toLowerCase().includes(searchQuery));
    const matchDoc = docFilter === "all" || p.doctorId === docFilter;
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchDoc && matchStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4" style="text-align:center; color:#94a3b8;">${selectedQueueDate} sanasi uchun bemorlar topilmadi</td></tr>`;
    return;
  }

  // A-Z va Har qanday ustun bo'yicha saralash
  filtered.sort((a, b) => {
    let valA = "";
    let valB = "";

    switch (currentSortColumn) {
      case "ticketId": {
        const numA = parseInt(String(a.ticketId || "").replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(String(b.ticketId || "").replace(/\D/g, ""), 10) || 0;
        return currentSortOrder === "asc" ? numA - numB : numB - numA;
      }
      case "scheduledTime": {
        valA = a.scheduledTime || a.time || "08:00";
        valB = b.scheduledTime || b.time || "08:00";
        return currentSortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      case "name":
        valA = (a.name || "").toLowerCase();
        valB = (b.name || "").toLowerCase();
        break;
      case "patientType":
        valA = `${a.patientType || ''} ${a.department || ''}`.toLowerCase();
        valB = `${b.patientType || ''} ${b.department || ''}`.toLowerCase();
        break;
      case "doctorName":
        valA = `${a.doctorName || ''} ${a.room || ''}`.toLowerCase();
        valB = `${b.doctorName || ''} ${b.room || ''}`.toLowerCase();
        break;
      case "service":
        valA = (a.service || "").toLowerCase();
        valB = (b.service || "").toLowerCase();
        break;
      case "referringDoctor":
        valA = (a.referringDoctor || "").toLowerCase();
        valB = (b.referringDoctor || "").toLowerCase();
        break;
      case "registeredBy":
        valA = (a.registeredBy || a.operatorLogin || "").toLowerCase();
        valB = (b.registeredBy || b.operatorLogin || "").toLowerCase();
        break;
      case "status":
        valA = (a.status || "").toLowerCase();
        valB = (b.status || "").toLowerCase();
        break;
      default:
        valA = (a[currentSortColumn] || "").toString().toLowerCase();
        valB = (b[currentSortColumn] || "").toString().toLowerCase();
        break;
    }

    if (valA < valB) return currentSortOrder === "asc" ? -1 : 1;
    if (valA > valB) return currentSortOrder === "asc" ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = filtered.map((p) => {
    const isCancelled = p.status === "cancelled";
    const oldSlot = p.cancelledSlot || p.timeSlot || p.scheduledTime || "-";
    const timeDisplay = isCancelled
      ? `<div style="color:#94a3b8; font-size:11.5px; text-decoration:line-through;">${escapeHtml(oldSlot)}</div>
         <span style="background:#dcfce7; color:#15803d; font-size:10px; font-weight:700; padding:1px 6px; border-radius:4px; display:inline-block; margin-top:2px;">
           🟢 Bo'shatildi
         </span>`
      : (p.timeSlot ? `<strong style="color:#0284c7;">${escapeHtml(p.timeSlot)}</strong>` : (p.scheduledTime || p.time || '-'));
    const operatorDisplay = p.registeredBy || (p.operatorLogin ? `${p.operatorLogin} - ${p.operatorName || ''}` : '-');
    const statusInfo = getStatusBadge(p.status);
    const dateLabel = (p.appointmentDate && p.appointmentDate !== todayDateStr) ? `<div style="font-size:10px; color:#b45309; font-weight:bold;">📅 ${escapeHtml(p.appointmentDate)}</div>` : '';
    const deferNote = p.rescheduleReason ? `<div style="font-size:10px; color:#64748b;" title="Voz kechish sababi: ${escapeHtml(p.rescheduleReason)}">⚠️ ${escapeHtml(p.rescheduleReason)}</div>` : '';
    const patientTypeBadge = p.patientType === "Bo'limda yotibdi"
      ? `<span class="badge" style="background:#fef3c7; color:#b45309; font-weight:700;">🏥 Bo'limda ${p.department ? `(${escapeHtml(p.department)})` : ''}</span>`
      : `<span class="badge" style="background:#e0f2fe; color:#0284c7; font-weight:700;">🏠 Uyidan qatnaydi</span>`;
    const docDisplay = p.referringDoctor ? `<span style="font-weight:600; color:#0f172a; font-size:12px;">👨‍⚕️ ${escapeHtml(p.referringDoctor)}</span>` : '<span style="color:#94a3b8; font-size:12px;">-</span>';

    let actionsHtml = "";
    if (isCancelled) {
      actionsHtml = `
        <button class="btn btn-secondary btn-small" title="Talonni chop etish" onclick="openPrintModal('${p.id}')">
          <i class="fa-solid fa-print"></i>
        </button>
        <span style="background:#fee2e2; color:#dc2626; font-size:11px; padding:4px 8px; border-radius:6px; font-weight:bold; display:inline-flex; align-items:center; gap:4px;" title="Bemor navbati o'chirilgan">
          <i class="fa-solid fa-ban"></i> O'chirilgan
        </span>
        <button class="btn btn-secondary btn-small" title="Qayta tiklash" style="color:#0284c7; margin-left:4px;" onclick="restorePatient('${p.id}')">
          <i class="fa-solid fa-rotate-left"></i>
        </button>
      `;
    } else {
      actionsHtml = `
        <button class="btn btn-secondary btn-small" title="Talonni chop etish" onclick="openPrintModal('${p.id}')">
          <i class="fa-solid fa-print"></i>
        </button>
        <button class="btn btn-secondary btn-small" title="Navbatdan o'chirish / Bekor qilish" style="color:var(--danger);" onclick="deletePatient('${p.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;
    }

    return `
      <tr ${isCancelled ? 'class="row-cancelled"' : ''}>
        <td><span class="ticket-tag" style="${isCancelled ? 'opacity:0.6;' : ''}">${escapeHtml(p.ticketId)}</span></td>
        <td>
          <strong style="${isCancelled ? 'color:#64748b;' : ''}">${escapeHtml(p.name)}</strong>
          ${isCancelled ? '<span style="color:#ef4444; font-size:10px; font-weight:bold; display:block;">[O\'CHIRILGAN]</span>' : ''}
          ${dateLabel}
          ${deferNote}
        </td>
        <td>${patientTypeBadge}</td>
        <td><strong>${escapeHtml(p.doctorName || p.room)}</strong> <small style="color:#64748b;">(${escapeHtml(p.room || '')})</small></td>
        <td>${escapeHtml(p.service || '-')} ${p.isContrast ? '<span style="color:#ef4444; font-weight:bold; font-size:10px;">[KONTRAST]</span>' : ''}</td>
        <td>${timeDisplay}</td>
        <td>${docDisplay}</td>
        <td><span style="background:#f1f5f9; padding:3px 8px; border-radius:6px; font-size:11.5px; font-weight:600; color:#334155;">👤 ${escapeHtml(operatorDisplay)}</span></td>
        <td><span class="badge ${statusInfo.cls}">${statusInfo.label}</span></td>
        <td style="white-space: nowrap; text-align: center;">${actionsHtml}</td>
      </tr>
    `;
  }).join("");
}

function getStatusBadge(status) {
  switch (status) {
    case "waiting": return { label: "Kutmoqda", cls: "badge-waiting" };
    case "calling": return { label: "Chaqirilmoqda", cls: "badge-calling" };
    case "in_progress": return { label: "Qabulda", cls: "badge-in_progress" };
    case "completed": return { label: "Yakunlandi", cls: "badge-completed" };
    case "cancelled": return { label: "O'chirilgan", cls: "badge-cancelled" };
    default: return { label: "Kutmoqda", cls: "badge-waiting" };
  }
}

// 4. STATISTIKANI YANGILASH
function updateStats() {
  document.getElementById("statTotal").innerText = patientsList.length;
  document.getElementById("statWaiting").innerText = patientsList.filter(p => p.status === "waiting").length;
  document.getElementById("statCalling").innerText = patientsList.filter(p => p.status === "calling" || p.status === "in_progress").length;
  document.getElementById("statCompleted").innerText = patientsList.filter(p => p.status === "completed").length;
}

// 5. VAQT REJIMINI ALMASHTIRISH VA BAND/BO'SH TEKSHIRUV MANTIQI
function toggleTimeSlotMode() {
  const mode = document.querySelector('input[name="timeSlotMode"]:checked').value;
  const customBox = document.getElementById("customTimeBox");
  if (customBox) {
    customBox.style.display = mode === "custom" ? "block" : "none";
  }
  onDateOrDoctorOrTimeChanged();
}

function toggleDeferReasonOther() {
  const val = document.getElementById("deferReasonSelect").value;
  const otherInput = document.getElementById("deferReasonOtherText");
  if (otherInput) {
    otherInput.style.display = val === "Boshqa sabab" ? "block" : "none";
    if (val === "Boshqa sabab") otherInput.focus();
  }
}

let lastCalculatedSlot = null;
let isCurrentSlotValid = false;

async function onDateOrDoctorOrTimeChanged() {
  const docId = document.getElementById("doctorSelect") ? document.getElementById("doctorSelect").value : "";
  const appDate = document.getElementById("patientAppDate") ? document.getElementById("patientAppDate").value : todayDateStr;
  const duration = parseInt(document.getElementById("patientDuration") ? document.getElementById("patientDuration").value : 30, 10) || 30;
  const mode = document.querySelector('input[name="timeSlotMode"]:checked') ? document.querySelector('input[name="timeSlotMode"]:checked').value : "auto";
  const customStartTime = document.getElementById("customStartTime") ? document.getElementById("customStartTime").value : "08:00";
  const alertEl = document.getElementById("slotStatusAlert");
  const deferContainer = document.getElementById("deferReasonContainer");
  const submitBtn = document.getElementById("btnSubmitPatient");

  if (!docId) {
    if (alertEl) {
      alertEl.style.background = "#f1f5f9";
      alertEl.style.color = "#64748b";
      alertEl.innerHTML = "ℹ️ Iltimos, oldin qurilma / xonani tanlang";
    }
    isCurrentSlotValid = false;
    return;
  }

  // Tanlangan sana uchun bemorlarni olish
  let targetPatients = [];
  if (appDate === selectedQueueDate) {
    targetPatients = patientsList;
  } else {
    try {
      const snap = await db.ref(`patients/${appDate}`).once("value");
      const val = snap.val();
      if (val) {
        targetPatients = Object.keys(val).map(k => ({ id: k, ...val[k] }));
      }
    } catch (e) {}
  }

  const devPatients = targetPatients.filter(p => p.doctorId === docId && p.status !== "cancelled");

  if (mode === "auto") {
    // Eng yaqin bo'sh slotni hisoblash
    const slot = calculateSlotFromPatientsList(devPatients, duration);
    lastCalculatedSlot = slot;
    isCurrentSlotValid = true;

    if (alertEl) {
      alertEl.style.background = "#dcfce7";
      alertEl.style.color = "#15803d";
      alertEl.innerHTML = `✅ <strong>Eng yaqin bo'sh vaqt:</strong> ${slot.slotString} (${appDate === todayDateStr ? 'Bugun' : appDate})`;
    }

    if (submitBtn) submitBtn.disabled = false;

    // Agar bugungi kundan boshqa sana tanlangan bo'lsa, sabab so'raymiz
    if (deferContainer) {
      deferContainer.style.display = (appDate !== todayDateStr) ? "block" : "none";
    }
  } else {
    // Ixtiyoriy kiritilgan vaqt
    const startMin = timeToMinutes(customStartTime);
    const endMin = startMin + duration;
    const customEndTime = addMinutesToTime(customStartTime, duration);
    const slotStr = `${customStartTime} - ${customEndTime}`;

    const slotCalcEl = document.getElementById("customCalculatedSlot");
    if (slotCalcEl) slotCalcEl.innerText = slotStr;

    // To'qnashuv (Overlap) tekshiruvi
    const conflict = checkSlotConflict(devPatients, startMin, endMin);

    if (conflict.hasConflict) {
      isCurrentSlotValid = false;
      if (alertEl) {
        alertEl.style.background = "#fee2e2";
        alertEl.style.color = "#b91c1c";
        alertEl.innerHTML = `❌ <strong>DIQQAT! Bu vaqt BAND:</strong> Ushbu vaqtda boshqa bemor bor: <strong>${escapeHtml(conflict.conflictingPatient.name || conflict.conflictingPatient.ticketId)}</strong> (${escapeHtml(conflict.conflictTime)}). Iltimos, boshqa bo'sh vaqt tanlang!`;
      }
      if (submitBtn) submitBtn.disabled = true;
    } else {
      isCurrentSlotValid = true;
      lastCalculatedSlot = { startTime: customStartTime, endTime: customEndTime, slotString: slotStr };
      if (alertEl) {
        alertEl.style.background = "#dcfce7";
        alertEl.style.color = "#15803d";
        alertEl.innerHTML = `✅ <strong>Ushbu vaqt BO'SH!</strong> Qabul vaqti: <strong>${slotStr}</strong> (${appDate === todayDateStr ? 'Bugun' : appDate})`;
      }
      if (submitBtn) submitBtn.disabled = false;
    }

    // Ixtiyoriy vaqt tanlanganda har doim sabab maydonini ko'rsatamiz
    if (deferContainer) {
      deferContainer.style.display = "block";
    }
  }
}

function checkSlotConflict(devPatients, newStartMin, newEndMin, excludeTicketId = null) {
  for (const p of devPatients) {
    if (p.status === "cancelled") continue;
    if (excludeTicketId && (p.ticketId === excludeTicketId || p.id === excludeTicketId)) continue;

    const pStartStr = p.scheduledTime || p.time;
    if (!pStartStr) continue;
    const pStart = timeToMinutes(pStartStr);
    const pDur = parseInt(p.duration, 10) || 30;
    const pEnd = p.endTime ? timeToMinutes(p.endTime) : (pStart + pDur);

    // To'qnashuv sharti: Math.max(newStart, pStart) < Math.min(newEnd, pEnd)
    if (Math.max(newStartMin, pStart) < Math.min(newEndMin, pEnd)) {
      return {
        hasConflict: true,
        conflictingPatient: p,
        conflictTime: `${pStartStr} - ${p.endTime || addMinutesToTime(pStartStr, pDur)}`
      };
    }
  }
  return { hasConflict: false };
}

function calculateSlotFromPatientsList(devPatients, duration) {
  return findEarliestFreeSlot(devPatients, duration);
}

// OCHIQ VAQTLAR (GAP) NI TEKSHIRIB ENG YAQUIN BO'SH VAQTNI TOPISH
function findEarliestFreeSlot(devPatients, duration, workDayStart = "08:00") {
  const dur = parseInt(duration, 10) || 30;
  const startWorkMin = timeToMinutes(workDayStart); // 480 (08:00)

  // 1. Faol bemorlarning vaqt oraliqlarini olish
  const activeIntervals = [];
  for (const p of (devPatients || [])) {
    if (p.status === "cancelled") continue;
    const pStartStr = p.scheduledTime || p.time;
    if (!pStartStr) continue;

    const pStart = timeToMinutes(pStartStr);
    const pDur = parseInt(p.duration, 10) || 30;
    const pEnd = p.endTime ? timeToMinutes(p.endTime) : (pStart + pDur);

    if (pEnd > pStart) {
      activeIntervals.push({ start: pStart, end: pEnd, patient: p });
    }
  }

  // Agar navbatda bemor bo'lmasa -> 08:00 dan boshlanadi
  if (activeIntervals.length === 0) {
    const endMin = startWorkMin + dur;
    return {
      startTime: minutesToTime(startWorkMin),
      endTime: minutesToTime(endMin),
      slotString: `${minutesToTime(startWorkMin)} - ${minutesToTime(endMin)}`
    };
  }

  // Boshlanish vaqti bo'yicha saralash
  activeIntervals.sort((a, b) => a.start - b.start);

  // Bir-biriga tutash yoki ustma-ust tushgan band vaqtlarni birlashtirish
  const busyBlocks = [];
  let currentBlock = { start: activeIntervals[0].start, end: activeIntervals[0].end };

  for (let i = 1; i < activeIntervals.length; i++) {
    const next = activeIntervals[i];
    if (next.start <= currentBlock.end) {
      currentBlock.end = Math.max(currentBlock.end, next.end);
    } else {
      busyBlocks.push(currentBlock);
      currentBlock = { start: next.start, end: next.end };
    }
  }
  busyBlocks.push(currentBlock);

  // 2. 08:00 dan birinchi band bemorgacha bo'sh oraliqqa sig'adimi?
  if (busyBlocks[0].start - startWorkMin >= dur) {
    const endMin = startWorkMin + dur;
    return {
      startTime: minutesToTime(startWorkMin),
      endTime: minutesToTime(endMin),
      slotString: `${minutesToTime(startWorkMin)} - ${minutesToTime(endMin)}`
    };
  }

  // 3. Oraliqlarda ochiq qolgan (bo'sh) vaqtlarga sig'adimi?
  for (let i = 0; i < busyBlocks.length - 1; i++) {
    const gapStart = Math.max(startWorkMin, busyBlocks[i].end);
    const gapEnd = busyBlocks[i + 1].start;
    if (gapEnd - gapStart >= dur) {
      const endMin = gapStart + dur;
      return {
        startTime: minutesToTime(gapStart),
        endTime: minutesToTime(endMin),
        slotString: `${minutesToTime(gapStart)} - ${minutesToTime(endMin)}`
      };
    }
  }

  // 4. Agar oraliqlarga sig'masa -> eng oxirgi band oraliqdan keyinga yozish
  const lastBlockEnd = Math.max(startWorkMin, busyBlocks[busyBlocks.length - 1].end);
  const finalEnd = lastBlockEnd + dur;
  return {
    startTime: minutesToTime(lastBlockEnd),
    endTime: minutesToTime(finalEnd),
    slotString: `${minutesToTime(lastBlockEnd)} - ${minutesToTime(finalEnd)}`
  };
}

function minutesToTime(totalMins) {
  const h = String(Math.floor(totalMins / 60) % 24).padStart(2, "0");
  const m = String(totalMins % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// 6. BEMOR QO'SHISH (FORM SUBMIT)
async function handlePatientSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("patientName").value.trim();
  const ticketId = document.getElementById("patientId").value.trim();
  const patientType = document.getElementById("patientTypeSelect") ? document.getElementById("patientTypeSelect").value : "Uyidan qatnaydi";
  const department = patientType === "Bo'limda yotibdi" ? (document.getElementById("patientDepartment") ? document.getElementById("patientDepartment").value.trim() : "") : "";
  const referringDoctor = document.getElementById("patientReferringDoctor") ? document.getElementById("patientReferringDoctor").value.trim() : "";
  const phone = document.getElementById("patientPhone").value.trim();
  const age = document.getElementById("patientAge").value.trim();
  const docId = document.getElementById("doctorSelect").value;
  const appDate = document.getElementById("patientAppDate").value || todayDateStr;
  const duration = parseInt(document.getElementById("patientDuration").value, 10) || 30;
  const service = document.getElementById("serviceType").value.trim() || "MRT / MSKT Tekshiruvi";
  const notes = document.getElementById("patientNotes").value.trim();
  const mode = document.querySelector('input[name="timeSlotMode"]:checked').value;

  if (!ticketId) {
    alert("Iltimos, Bemor ID yoki Talon raqamini kiriting!");
    document.getElementById("patientId").focus();
    return;
  }

  const selectedDoctor = doctorsList.find(d => d.id === docId);
  if (!selectedDoctor) {
    alert("Iltimos, qurilma / xonani tanlang!");
    return;
  }

  await onDateOrDoctorOrTimeChanged();

  if (!isCurrentSlotValid || !lastCalculatedSlot) {
    alert("⚠️ Tanlangan vaqt band yoki xato! Iltimos, boshqa bo'sh vaqtni tanlang.");
    return;
  }

  // Voz kechish sababi
  let deferReason = "";
  if (appDate !== todayDateStr || mode === "custom") {
    const rSelect = document.getElementById("deferReasonSelect").value;
    const rOther = document.getElementById("deferReasonOtherText").value.trim();
    deferReason = (rSelect === "Boshqa sabab" ? (rOther || "Boshqa sabab") : rSelect);
  }

  const newPatient = {
    ticketId: ticketId,
    name: name,
    patientType: patientType,
    department: department,
    referringDoctor: referringDoctor,
    phone: phone,
    age: age,
    doctorId: selectedDoctor.id,
    doctorName: selectedDoctor.name,
    room: selectedDoctor.room,
    deviceType: selectedDoctor.specialty && selectedDoctor.specialty.includes("MSKT") ? "MSKT" : "MRT",
    service: service,
    duration: duration,
    appointmentDate: appDate,
    scheduledTime: lastCalculatedSlot.startTime,
    endTime: lastCalculatedSlot.endTime,
    timeSlot: lastCalculatedSlot.slotString,
    rescheduleReason: deferReason,
    operatorLogin: "TB1",
    operatorName: "Turatov Hojiakbar",
    registeredBy: "TB1 - Turatov Hojiakbar",
    notes: notes + (deferReason ? ` [Sabab: ${deferReason}]` : ""),
    status: "waiting",
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  // Firebase-ga saqlash
  const newRef = db.ref(`patients/${appDate}`).push();
  newRef.set(newPatient).then(() => {
    document.getElementById("patientForm").reset();
    togglePatientDepartment();
    
    // Agar boshqa sana uchun qo'shilgan bo'lsa, o'sha sanaga o'tamiz
    if (selectedQueueDate !== appDate) {
      const qDateEl = document.getElementById("queueDateFilter");
      if (qDateEl) qDateEl.value = appDate;
      listenToPatients(appDate);
    }

    switchTab("queue-tab");

    // Talon chop etish modalini ochish va to'g'ridan-to'g'ri chop etishga yo'naltirish
    openPrintModalDirect(newPatient, true);
  }).catch((err) => {
    alert("Xatolik yuz berdi: " + err.message);
  });
}

// 7. TALONNI CHOP ETISH
function openPrintModal(patientDbId) {
  const patient = patientsList.find(p => p.id === patientDbId);
  if (patient) {
    openPrintModalDirect(patient, true);
  }
}

function openPrintModalDirect(patient, autoTriggerPrint = false) {
  document.getElementById("ticketPrintNum").innerText = patient.ticketId || "ID";
  document.getElementById("ticketPrintName").innerText = patient.name || "-";
  
  const typeText = patient.patientType === "Bo'limda yotibdi"
    ? `🏥 Bo'limda yotibdi ${patient.department ? `(${patient.department})` : ''}`
    : "🏠 Uyidan qatnaydi";
  const typeEl = document.getElementById("ticketPrintPatientType");
  if (typeEl) typeEl.innerText = typeText;

  const docRow = document.getElementById("ticketPrintDocRow");
  const docEl = document.getElementById("ticketPrintReferringDoctor");
  if (docRow && docEl) {
    if (patient.referringDoctor) {
      docRow.style.display = "flex";
      docEl.innerText = patient.referringDoctor;
    } else {
      docRow.style.display = "none";
    }
  }

  document.getElementById("ticketPrintRoom").innerText = patient.room || "-";
  document.getElementById("ticketPrintDoctor").innerText = patient.doctorName || "-";
  document.getElementById("ticketPrintService").innerText = (patient.service || "Tomografiya") + (patient.isContrast ? " [KONTRASTLI]" : "");
  document.getElementById("ticketPrintTimeSlot").innerText = patient.timeSlot || patient.scheduledTime || (patient.time || "-");
  document.getElementById("ticketPrintRegistrar").innerText = patient.registeredBy || (patient.operatorLogin ? `${patient.operatorLogin} - ${patient.operatorName || ''}` : "TB1 - Turatov Hojiakbar");
  const appDateDisplay = patient.appointmentDate || selectedQueueDate || todayDateStr;
  document.getElementById("ticketPrintTime").innerText = (patient.time || "") + " | " + appDateDisplay;

  const guideEl = document.getElementById("ticketPrintGuidelines");
  if (guideEl) {
    let guidelinesHtml = "";
    if (patient.rescheduleReason) {
      guidelinesHtml += `<div style="margin-bottom:4px; font-size:10px; color:#333;"><strong>Eslatma:</strong> ${escapeHtml(patient.rescheduleReason)}</div>`;
    }
    if (patient.preparation || patient.contraindications) {
      guidelinesHtml += `
        <div style="border:1px solid #000; border-radius:4px; padding:4px 6px; margin-top:4px; line-height:1.25;">
          <div style="font-weight:bold; border-bottom:1px dashed #000; padding-bottom:2px; margin-bottom:2px; text-align:center;">
            TIBBIY KO'RSATMALAR
          </div>
          ${patient.preparation && patient.preparation !== '—' ? `<div style="margin-top:2px;"><strong>📋 Tayyorgarlik:</strong> ${escapeHtml(patient.preparation)}</div>` : ''}
          ${patient.contraindications && patient.contraindications !== '—' ? `<div style="margin-top:2px;"><strong>🚫 Qarshi ko'rsatmalar:</strong> ${escapeHtml(patient.contraindications)}</div>` : ''}
        </div>
      `;
    }

    if (guidelinesHtml) {
      guideEl.style.display = "block";
      guideEl.innerHTML = guidelinesHtml;
    } else {
      guideEl.style.display = "none";
      guideEl.innerHTML = "";
    }
  }

  document.getElementById("ticketModal").classList.add("open");

  if (autoTriggerPrint) {
    setTimeout(() => {
      window.print();
    }, 250);
  }
}

function closeTicketModal() {
  document.getElementById("ticketModal").classList.remove("open");
}

function deletePatient(patientDbId) {
  const patient = patientsList.find(p => p.id === patientDbId);
  const pName = patient ? patient.name : "bemor";
  const oldSlot = patient ? (patient.timeSlot || patient.scheduledTime || "") : "";
  if (confirm(`Haqiqatdan ham "${pName}"ni navbatdan o'chirmoqchimisiz?\n\n(Bemor ma'lumotlari saqlanadi, egallagan vaqti [${oldSlot}] esa boshqa bemorlar uchun to'liq bo'shatiladi)`)) {
    const targetDate = (patient && patient.appointmentDate) ? patient.appointmentDate : (selectedQueueDate || todayDateStr);
    db.ref(`patients/${targetDate}/${patientDbId}`).update({
      status: "cancelled",
      cancelledSlot: oldSlot,
      cancelledScheduledTime: patient.scheduledTime || "",
      cancelledEndTime: patient.endTime || "",
      scheduledTime: "",
      endTime: "",
      timeSlot: "",
      cancelledAt: firebase.database.ServerValue.TIMESTAMP,
      cancelledBy: "TB1 - Turatov Hojiakbar"
    });
  }
}

async function restorePatient(patientDbId) {
  const patient = patientsList.find(p => p.id === patientDbId);
  if (!patient) return;
  const pName = patient.name || "Bemor";
  const targetDate = (patient.appointmentDate) ? patient.appointmentDate : (selectedQueueDate || todayDateStr);
  const duration = parseInt(patient.duration, 10) || 30;

  // 1. Shu kungi ushbu qurilmadagi barcha faol (band) bemorlarni olish
  let devPatients = [];
  try {
    const snap = await db.ref(`patients/${targetDate}`).once("value");
    const data = snap.val();
    if (data) {
      Object.keys(data).forEach(k => {
        const item = data[k];
        item.id = k;
        if (item.doctorId === patient.doctorId && item.status !== "cancelled" && k !== patientDbId) {
          devPatients.push(item);
        }
      });
    }
  } catch (e) {
    devPatients = patientsList.filter(p => p.doctorId === patient.doctorId && p.status !== "cancelled" && p.id !== patientDbId);
  }

  // 2. Eng birinchi bo'sh vaqt oralig'ini topish
  const newSlot = findEarliestFreeSlot(devPatients, duration);

  const confirmMsg = `"${pName}"ni navbatga qayta tiklash:\n\n` +
                     `🏥 Qurilma: ${patient.doctorName || patient.room}\n` +
                     `⏱ Tekshiruv vaqti: ${duration} daqiqa\n` +
                     `🕒 Yangi ajratilgan bo'sh vaqt: ${newSlot.slotString}\n\n` +
                     `Ushbu yangi bo'sh vaqt bilan navbatga qo'yishni tasdiqlaysizmi?`;

  if (confirm(confirmMsg)) {
    db.ref(`patients/${targetDate}/${patientDbId}`).update({
      status: "waiting",
      scheduledTime: newSlot.startTime,
      endTime: newSlot.endTime,
      timeSlot: newSlot.slotString,
      cancelledSlot: null,
      restoredAt: firebase.database.ServerValue.TIMESTAMP,
      notes: (patient.notes || "") + ` [Qayta tiklandi: yangi vaqt ${newSlot.slotString}]`
    }).then(() => {
      openPrintModalDirect({
        ...patient,
        status: "waiting",
        scheduledTime: newSlot.startTime,
        endTime: newSlot.endTime,
        timeSlot: newSlot.slotString
      }, false);
    });
  }
}

// 8. EXCEL (CSV) YUKLAB OLISH
function exportToCSV() {
  if (patientsList.length === 0) {
    alert("Yuklab olish uchun bemorlar mavjud emas!");
    return;
  }

  let csvContent = "\uFEFF"; // UTF-8 BOM o'zbek harflari to'g'ri chiqishi uchun
  csvContent += "Talon ID,F.I.Sh,Telefon,Yoshi,Vrach,Xona,Xizmat,Holat,Vaqt,Sana\n";

  patientsList.forEach((p) => {
    const statusText = getStatusBadge(p.status).label;
    const row = [
      `"${p.ticketId || ''}"`,
      `"${p.name || ''}"`,
      `"${p.phone || ''}"`,
      `"${p.age || ''}"`,
      `"${p.doctorName || ''}"`,
      `"${p.room || ''}"`,
      `"${p.service || ''}"`,
      `"${statusText}"`,
      `"${p.time || ''}"`,
      `"${todayDateStr}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `UTT_Navbat_${todayDateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 9. VRACHLARNI BOSHQARISH
function renderDoctors() {
  const container = document.getElementById("doctorsContainer");
  if (!container) return;

  container.innerHTML = doctorsList.map(doc => `
    <div class="doctor-card">
      <span class="room-badge">${escapeHtml(doc.room)}</span>
      <h3>${escapeHtml(doc.name)}</h3>
      <p><i class="fa-solid fa-stethoscope"></i> ${escapeHtml(doc.specialty || "Shifokor")}</p>
      <div style="margin-top:auto; display:flex; gap:8px;">
        <button class="btn btn-secondary btn-small" onclick="openEditDoctorModal('${doc.id}')">
          <i class="fa-solid fa-pen"></i> Tahrirlash
        </button>
        <button class="btn btn-secondary btn-small" style="color:var(--danger);" onclick="deleteDoctor('${doc.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join("");
}

function updateDoctorSelectOptions() {
  const select = document.getElementById("doctorSelect");
  const filter = document.getElementById("doctorFilter");
  
  if (select) {
    select.innerHTML = `<option value="">-- Tanlang --</option>` + doctorsList.map(d => `
      <option value="${d.id}">${escapeHtml(d.room)}: ${escapeHtml(d.name)} (${escapeHtml(d.specialty || '')})</option>
    `).join("");
  }

  if (filter) {
    filter.innerHTML = `<option value="all">Barcha Vrachlar / Xonalar</option>` + doctorsList.map(d => `
      <option value="${d.id}">${escapeHtml(d.room)} - ${escapeHtml(d.name)}</option>
    `).join("");
  }
}

function openAddDoctorModal() {
  document.getElementById("doctorModalTitle").innerText = "Yangi Vrach Qo'shish";
  document.getElementById("doctorId").value = "";
  document.getElementById("doctorForm").reset();
  document.getElementById("doctorModal").classList.add("open");
}

function openEditDoctorModal(docId) {
  const doc = doctorsList.find(d => d.id === docId);
  if (!doc) return;
  document.getElementById("doctorModalTitle").innerText = "Vrachni Tahrirlash";
  document.getElementById("doctorId").value = doc.id;
  document.getElementById("docName").value = doc.name;
  document.getElementById("docRoom").value = doc.room;
  document.getElementById("docSpecialty").value = doc.specialty || "";
  document.getElementById("doctorModal").classList.add("open");
}

function closeDoctorModal() {
  document.getElementById("doctorModal").classList.remove("open");
}

function handleDoctorSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("doctorId").value;
  const name = document.getElementById("docName").value.trim();
  const room = document.getElementById("docRoom").value.trim();
  const specialty = document.getElementById("docSpecialty").value.trim();

  const data = { name, room, specialty };

  if (id) {
    // Tahrirlash
    db.ref(`doctors/${id}`).update(data).then(() => closeDoctorModal());
  } else {
    // Yangi qo'shish
    db.ref("doctors").push(data).then(() => closeDoctorModal());
  }
}

function deleteDoctor(docId) {
  if (confirm("Ushbu vrachni ro'yxatdan o'chirmoqchimisiz?")) {
    db.ref(`doctors/${docId}`).remove();
  }
}

// 10. TEKSHIRUVLAR KATALOGI VA VAQTLARINI BOSHQARISH
let servicesList = [];

// Boshlang'ich barcha MRT va MSKT tekshiruvlari ro'yxati (standart 30 daqiqadan)
const RAW_DEFAULT_SERVICES = [
  // MSKT Xizmatlari
  { code: "R134", name: "Bosh Miya MSKT Tekshiruvi (Kontrast Moddasiz)", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R135", name: "Bosh Miya Mskt Tekshiruvi (Vena ichi Kontrast Modda Bilan)", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R138", name: "Bosh-Boyin Kontrast Moddasiz MSKT Tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R139", name: "Bosh-Boyin Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R136", name: "Gipofiz bezining kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R137", name: "Gipofiz bezining vena ichi kontrast moddasi bilan MSKT tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R151", name: "Umurtqa pogonasi (1-bolimi)ni kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R152", name: "Umurtqa Pogonasi (1-Bolimi) ni Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R140", name: "Kokrak qafasi organlarini kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R142", name: "Kokrak qafasi organlarini vena ichi Kontrast Moddasi Bilan MSKT Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R141", name: "Kokrak qafasi organlarini kontrast moddasi bilan MSKT tekshiruvi PER OS", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R143", name: "Qorin boshligi va qorin Pardaorti Azolarini Kontrast Moddasiz Mskt Tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R144", name: "Qorin Boshligi Va Qorin Pardaorti Azolarini Kontrast Moddasi Bilan Mskt Tekshiruvi Per Os", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R145", name: "Qorin Boshligi Va Qorin Pardaorti Azolarini Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R149", name: "Buyrak Usti Bezini Kontrast Moddasiz Mskt Tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R150", name: "Buyrak Usti Bezini Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R146", name: "Kichik tos azolarini kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R148", name: "Kichik Tos Azolarini Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R147", name: "Kichik Tos Azolarini Kontrast Moddasi Bilan Mskt Tekshiruvi Per Os", type: "MSKT", isContrast: true, duration: 30 },
  { code: "R153", name: "Bogimlar Mskt Tekshiruvi (1 Soha)", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R154", name: "Qol Va Oyoqlarning Kontrast Moddasiz Mskt Tekshiruvi (1 Soha)", type: "MSKT", isContrast: false, duration: 30 },
  { code: "R155", name: "Qol Va Oyoqlarning Vena Ichi Kontrast Moddasi Bilan Mskt Tekshiruvi (1 Soha)", type: "MSKT", isContrast: true, duration: 30 },

  // MRT Xizmatlari
  { code: "R157", name: "Bosh Miya Mrt Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R159", name: "Bosh Miya Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R158", name: "Bosh Miya Mrt Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R163", name: "Bosh Miya Angiografiya Mrt MPA/MPB", type: "MRT", isContrast: false, duration: 30 },
  { code: "R162", name: "Bosh Miya Angiografiya Mrt (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R160", name: "Bosh Miya Mrt + Trayektografiya Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R212", name: "Mrt bosh miya+ kontrastsiz Mr-Arterio I Venografiya", type: "MRT", isContrast: false, duration: 30 },
  { code: "R211", name: "Mrt bosh miya I Bosh miya yumshoq toqima T1 + Contrast", type: "MRT", isContrast: true, duration: 30 },
  { code: "R214", name: "Bosh miyaning MRT si+DTI", type: "MRT", isContrast: false, duration: 30 },
  { code: "R213", name: "Bosh miyaning MRT si+FIESTA rejimida", type: "MRT", isContrast: false, duration: 30 },
  { code: "R209", name: "Bosh miyaning va bosh sohasidagi yumshoq to`qimalarning MRT si", type: "MRT", isContrast: false, duration: 30 },
  { code: "R210", name: "Bosh miyaning va bosh sohasidagi yumshoq to`qimalarning MRTsi, T1 rejimida", type: "MRT", isContrast: false, duration: 30 },
  { code: "R161", name: "Gipofiz MRT + kontrast", type: "MRT", isContrast: true, duration: 30 },
  { code: "R164", name: "Koz va orbita MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R165", name: "Yestaxeviy nay va Ichki quloq Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R199", name: "Sinusit Va Burun boshliqlari MRT (Yuz-Jag Bogimlari)", type: "MRT", isContrast: false, duration: 30 },
  { code: "R166", name: "Boyin Umurtqalari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R200", name: "Boyin Limfa Tugunlari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R172", name: "Boyin qon Tomirlari Angiografiya Mrt", type: "MRT", isContrast: true, duration: 30 },
  { code: "R171", name: "Boyin qon Tomirlari Angiografiya Mrt (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R167", name: "Kokrak umurtqalari MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R191", name: "Sut Bezlari MRT Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R193", name: "Sut Bezlari Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R192", name: "Sut Bezlari Mrt Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R173", name: "Yurak Mrt Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R175", name: "Yurak qon Tomirlari Angiografiya Mrt", type: "MRT", isContrast: true, duration: 30 },
  { code: "R174", name: "Yurak qon Tomirlari Angiografiya Mrt (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R177", name: "Jigar Mrt Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  { code: "R179", name: "Jigar Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R178", name: "Jigar MRT Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R180", name: "Oshqozon Osti Bezi Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R181", name: "Buyraklar Va Siydik Chiqarish Yollari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R203", name: "Qorin boshligi azolarining MRTsi+tomir ichiga kontrast modda", type: "MRT", isContrast: true, duration: 30 },
  { code: "R204", name: "Mrt qorin boshligi azolari + V/V Kontrast", type: "MRT", isContrast: true, duration: 30 },
  { code: "R182", name: "Kichik chanoq azolari MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R201", name: "Mrt kichik tos azolari + V/V Kontrastlashgan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R202", name: "Mrt kichik tos azolari + V/V Kontrastirovanie", type: "MRT", isContrast: true, duration: 30 },
  { code: "R4896", name: "Qorin boshligi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R188", name: "Chanoq Son Bogimi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R190", name: "Chanoq Son Bogimi Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R189", name: "Chanoq Son Bogimi Mrt Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R217", name: "Son bo`g`imlari va orqa chanoq (iliyosakral) bo'g'imlarining MRT si", type: "MRT", isContrast: false, duration: 30 },
  { code: "R168", name: "Bel Umurtqalari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R169", name: "Butun umurtqa MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R170", name: "Spinal Kanal Va Jigar Nervlari Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R206", name: "Orqa miya MRT si+Traktografiya", type: "MRT", isContrast: false, duration: 30 },
  { code: "R219", name: "Orqa miyaning yuqori uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R218", name: "Orqa miyaning yuqori uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R222", name: "Orqa miyaning pastki uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R221", name: "Orqa miyaning orta uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R220", name: "Orqa miyaning orta uchdan bir qismi+umurtqa pogonasining (MRT)si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R215", name: "Orqa miyaning o'rta uchdan bir qismi+umurtqa pogonasining MRT si", type: "MRT", isContrast: false, duration: 30 },
  { code: "R216", name: "Bel sohasi uchinchi (L3) darajadagi orqa miya+umurtqa pogonasining MRT tekshiruvi", type: "MRT", isContrast: false, duration: 30 },
  { code: "R223", name: "Orqa miyaning pastki uchdan bir qismi+umurtqa pogonasining MRT si", type: "MRT", isContrast: true, duration: 30 },
  { code: "R183", name: "Yelka bogimi Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R186", name: "Tirsak Bogimi Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R184", name: "Qol-Kaft Bogimi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R185", name: "Tizza Bogimi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R187", name: "Tovon/ boldir-tovon bogimi MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R205", name: "Mrt Yumshoq toqima azolari", type: "MRT", isContrast: false, duration: 30 },
  { code: "R197", name: "Ong va chap qol qon tomirlari MRT Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R196", name: "Ong va chap qol qon tomirlari Mrt Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R195", name: "Ong va chap Oyoq qon tomirlari Mrt Kontrast Bilan", type: "MRT", isContrast: true, duration: 30 },
  { code: "R194", name: "Ong va chap oyoq qon tomirlari Mrt kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 30 },
  { code: "R4929", name: "Bosh miya yumshoq toqima MRT/ MRT yuz qismi", type: "MRT", isContrast: false, duration: 30 },
  { code: "R4920", name: "Boyin yumshoq toqimalari MRT", type: "MRT", isContrast: false, duration: 30 },
  { code: "R198", name: "Butun Tanani Skrining Mrt", type: "MRT", isContrast: false, duration: 30 },
  { code: "R207", name: "Plyonka nusxasi, Disk I Xulosa", type: "MRT", isContrast: false, duration: 15 },
  { code: "R208", name: "Disk nusxasi (yoki qoshimcha)", type: "MRT", isContrast: false, duration: 10 }
];

// Standart tibbiy tavsiyalarni yaratish funksiyasi
function getClinicalGuidelines(s) {
  const name = (s.name || "").toLowerCase();
  const isContrast = s.isContrast === true || name.includes("kontrast") || name.includes("injektor") || name.includes("v/v");
  const isMSKT = s.type === "MSKT" || name.includes("mskt") || name.includes("msct") || name.includes("tomografiya");

  let preparation = "";
  let contraindications = "";

  if (name.includes("disk") || name.includes("plyonka")) {
    preparation = "Tayyorgarlik talab etilmaydi.";
    contraindications = "Mavjud emas.";
    return { preparation, contraindications };
  }

  if (isMSKT) {
    if (isContrast) {
      preparation = "4-6 soat och qoringa kelish. Qonda Kreatinin va Mochevina tahlili (oxirgi 1 oy). Qandli diabet bo'lsa: Metformin 48 soat oldin to'xtatiladi. Tekshiruvdan so'ng ko'p suyuqlik ichish.";
      contraindications = "Yodli kontrastga allergiya, buyrak yetishmovchiligi (kreatinin yuqori), gipertireoz (bo'qoq), homiladorlik.";
    } else {
      if (name.includes("qorin") || name.includes("tos") || name.includes("buyrak") || name.includes("pardaorti")) {
        preparation = "4-6 soat och qoringa kelish. Tekshiruvdan 1 soat oldin 1 litr gazsiz toza suv ichish (qovuqni to'ldirish). Barcha metall buyumlar yechiladi.";
        contraindications = "Homiladorlik, tana vazni 150 kg dan yuqori bo'lishi.";
      } else {
        preparation = "Maxsus parhez talab etilmaydi. Tekshiriladigan sohadagi barcha metall buyumlar va taqinchoqlar yechiladi.";
        contraindications = "Homiladorlik (nisbiy), tana vazni 150 kg dan yuqori bo'lishi.";
      }
    }
  } else {
    // MRT
    if (isContrast) {
      preparation = "4-6 soat och qoringa kelish. Qonda Kreatinin tahlili. Barcha ferromagnit metall buyumlar, soat, telefon, elektron kartalar yechiladi.";
      contraindications = "Kardiostimulyator (EKSM), ferromagnit implantlar/qisqichlar, koxlear implantlar, klavstrofobiya, og'ir buyrak yetishmovchiligi, homiladorlik (1-trimestr).";
    } else {
      if (name.includes("qorin") || name.includes("jigar") || name.includes("buyrak") || name.includes("tos") || name.includes("chanoq") || name.includes("oshqozon")) {
        preparation = "Kamida 4-6 soat och qoringa kelish. Gaz hosil qiluvchi mahsulotlarni 1 kun oldin cheklash. Barcha metall buyumlar va elektron jihozlar yechiladi.";
        contraindications = "Kardiostimulyator (EKSM), ferromagnit metall implantlar, koxlear implantlar, klavstrofobiya (yopiq joydan qo'rqish).";
      } else {
        preparation = "Maxsus parhez talab etilmaydi. Barcha ferromagnit metall buyumlar, soat, telefon, bank kartalari, kamar, sirg'a va kiyimdagi temir detallar yechiladi.";
        contraindications = "Kardiostimulyator (EKSM), ferromagnit metall buyumlar/implantlar, koxlear implantlar, klavstrofobiya (yopiq joydan qo'rqish).";
      }
    }
  }

  return { preparation, contraindications };
}

const DEFAULT_SERVICES = RAW_DEFAULT_SERVICES.map(s => {
  const g = getClinicalGuidelines(s);
  return {
    ...s,
    preparation: s.preparation || g.preparation,
    contraindications: s.contraindications || g.contraindications
  };
});

function listenToServices() {
  const svcRef = db.ref("services_catalog");
  svcRef.on("value", (snapshot) => {
    servicesList = [];
    const data = snapshot.val();
    
    if (!data) {
      initDefaultServices();
      return;
    }

    Object.keys(data).forEach((key) => {
      servicesList.push({ id: key, ...data[key] });
    });

    renderServicesTable();
  });
}

function initDefaultServices() {
  const seed = {};
  DEFAULT_SERVICES.forEach((s) => {
    const key = s.code.replace(/[^a-zA-Z0-9]/g, "_");
    seed[key] = s;
  });
  db.ref("services_catalog").set(seed);
}

function populateAllClinicalGuidelines() {
  if (confirm("Barcha tekshiruvlarga standart tibbiy tayyorgarlik va qarshi ko'rsatmalarni to'ldirib chiqmoqchimisiz? (Belgilangan daqiqalar o'zgarmasdan saqlanadi)")) {
    const updates = {};
    servicesList.forEach((s) => {
      const g = getClinicalGuidelines(s);
      updates[`${s.id}/preparation`] = g.preparation;
      updates[`${s.id}/contraindications`] = g.contraindications;
    });
    db.ref("services_catalog").update(updates).then(() => {
      alert("✅ Barcha tekshiruvlarga standart tayyorgarlik va qarshi ko'rsatmalar to'ldirildi!");
    });
  }
}

function resetAllServicesTo30Min() {
  if (confirm("Barcha tekshiruv vaqtlarini va standart tayyorgarlik ko'rsatmalarini boshlang'ich holatga qaytarmoqchimisiz?")) {
    initDefaultServices();
  }
}

// Tekshiruvlar jadvalini chizish
function renderServicesTable() {
  const tbody = document.getElementById("servicesTableBody");
  if (!tbody) return;

  const searchQuery = (document.getElementById("serviceSearchInput") ? document.getElementById("serviceSearchInput").value : "").toLowerCase();
  const typeFilter = document.getElementById("serviceTypeFilter") ? document.getElementById("serviceTypeFilter").value : "all";

  const filtered = servicesList.filter(s => {
    const matchSearch = (s.code && s.code.toLowerCase().includes(searchQuery)) ||
                        (s.name && s.name.toLowerCase().includes(searchQuery));
    
    let matchType = true;
    if (typeFilter === "MRT") matchType = s.type === "MRT";
    else if (typeFilter === "MSKT") matchType = s.type === "MSKT";
    else if (typeFilter === "contrast") matchType = s.isContrast === true;
    else if (typeFilter === "no_contrast") matchType = s.isContrast === false;

    return matchSearch && matchType;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="text-align:center; color:#94a3b8;">Tekshiruvlar topilmadi</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const prepText = s.preparation ? escapeHtml(s.preparation) : '<span style="color:#94a3b8; font-size:12px;">—</span>';
    const contraText = s.contraindications ? `<span style="color:#b91c1c; font-weight:600;">${escapeHtml(s.contraindications)}</span>` : '<span style="color:#94a3b8; font-size:12px;">—</span>';

    return `
      <tr>
        <td><span class="ticket-tag" style="background:#e0f2fe; color:#0284c7;">${escapeHtml(s.code)}</span></td>
        <td onclick="openEditServiceModal('${s.id}')" style="cursor:pointer;" title="Tahrirlash uchun bosing">
          <strong>${escapeHtml(s.name)}</strong>
        </td>
        <td>
          <span class="badge ${s.type === 'MRT' ? 'badge-in_progress' : 'badge-waiting'}">
            ${escapeHtml(s.type || 'MRT')}
          </span>
        </td>
        <td>
          <span class="badge ${s.isContrast ? 'badge-calling' : 'badge-completed'}">
            ${s.isContrast ? '💉 Kontrastli' : 'Oddiy'}
          </span>
        </td>
        <td>
          <div class="duration-control-box">
            <button class="btn-step" onclick="changeDuration('${s.id}', -1)" title="-1 daqiqa">-1</button>
            <input type="number" class="duration-input" value="${s.duration || 30}" min="1" max="300" step="1"
              onchange="updateServiceDuration('${s.id}', this.value)">
            <button class="btn-step" onclick="changeDuration('${s.id}', 1)" title="+1 daqiqa">+1</button>
            <span class="duration-unit">daq</span>
          </div>
        </td>
        <td onclick="openEditServiceModal('${s.id}')" style="cursor:pointer;" title="Tahrirlash uchun bosing">
          <div style="font-size:12px; line-height:1.35; max-width:240px;">
            ${prepText}
          </div>
        </td>
        <td onclick="openEditServiceModal('${s.id}')" style="cursor:pointer;" title="Tahrirlash uchun bosing">
          <div style="font-size:12px; line-height:1.35; max-width:240px;">
            ${contraText}
          </div>
        </td>
        <td>
          <button class="btn btn-secondary btn-small" title="Tahrirlash (Vaqti, Tayyorgarlik, Qarshi ko'rsatmalar)" onclick="openEditServiceModal('${s.id}')">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn btn-secondary btn-small" title="O'chirish" style="color:var(--danger);" onclick="deleteService('${s.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// Vaqtni o'zgartirish (ixtiyoriy daqiqa, 5 ga cheklanmagan)
function changeDuration(serviceId, delta) {
  const s = servicesList.find(item => item.id === serviceId);
  if (!s) return;
  const current = parseInt(s.duration || 30, 10);
  const nextVal = Math.max(1, Math.min(300, current + delta));
  updateServiceDuration(serviceId, nextVal);
}

function updateServiceDuration(serviceId, newDuration) {
  const duration = parseInt(newDuration, 10) || 1;
  const s = servicesList.find(item => item.id === serviceId);
  if (s) s.duration = duration;
  db.ref(`services_catalog/${serviceId}`).update({
    duration: duration
  });
}

function openAddServiceModal() {
  document.getElementById("serviceModalTitle").innerText = "Yangi Tekshiruv Qo'shish";
  document.getElementById("serviceId").value = "";
  document.getElementById("serviceForm").reset();
  document.getElementById("svcDuration").value = "30";
  document.getElementById("svcPreparation").value = "";
  document.getElementById("svcContraindications").value = "";
  document.getElementById("serviceModal").classList.add("open");
}

function openEditServiceModal(serviceId) {
  const s = servicesList.find(item => item.id === serviceId);
  if (!s) return;

  document.getElementById("serviceModalTitle").innerText = `${s.code ? s.code + ' - ' : ''}Tekshiruvni Tahrirlash`;
  document.getElementById("serviceId").value = s.id;
  document.getElementById("svcCode").value = s.code || "";
  document.getElementById("svcName").value = s.name || "";
  document.getElementById("svcType").value = s.type || "MRT";
  document.getElementById("svcContrast").value = s.isContrast ? "true" : "false";
  document.getElementById("svcDuration").value = s.duration || 30;
  document.getElementById("svcPreparation").value = s.preparation || "";
  document.getElementById("svcContraindications").value = s.contraindications || "";

  document.getElementById("serviceModal").classList.add("open");
}

function closeServiceModal() {
  document.getElementById("serviceModal").classList.remove("open");
}

function handleServiceSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("serviceId").value;
  const code = document.getElementById("svcCode").value.trim().toUpperCase();
  const name = document.getElementById("svcName").value.trim();
  const type = document.getElementById("svcType").value;
  const isContrast = document.getElementById("svcContrast").value === "true";
  const duration = parseInt(document.getElementById("svcDuration").value, 10) || 30;
  const preparation = document.getElementById("svcPreparation").value.trim();
  const contraindications = document.getElementById("svcContraindications").value.trim();

  const data = { code, name, type, isContrast, duration, preparation, contraindications };

  if (id) {
    db.ref(`services_catalog/${id}`).update(data).then(() => closeServiceModal());
  } else {
    const key = code.replace(/[^a-zA-Z0-9]/g, "_") || db.ref("services_catalog").push().key;
    db.ref(`services_catalog/${key}`).set(data).then(() => closeServiceModal());
  }
}

function deleteService(serviceId) {
  if (confirm("Haqiqatdan ham ushbu tekshiruvni o'chirmoqchimisiz?")) {
    db.ref(`services_catalog/${serviceId}`).remove();
  }
}

// 11. TABLARNI ALMASHTIRISH
function switchTab(tabId) {
  document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add("active");

  const navItems = document.querySelectorAll(".nav-item");
  if (tabId === "queue-tab") navItems[0].classList.add("active");
  if (tabId === "new-patient-tab") navItems[1].classList.add("active");
  if (tabId === "services-tab") navItems[2].classList.add("active");
  if (tabId === "doctors-tab") navItems[3].classList.add("active");
}

function openNewPatientModal() {
  switchTab("new-patient-tab");
  document.getElementById("patientName").focus();
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
