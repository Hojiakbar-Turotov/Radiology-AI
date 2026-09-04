/**
 * Laborant Portali - Client Script (laborant/app.js)
 */

let ws = null;
let currentQueue = [];
let selectedDeviceId = localStorage.getItem("selectedLaborantRoom") || "mrt1";
let activePatient = null;
let prepPatient = null;

document.addEventListener("DOMContentLoaded", () => {
  const selectDev = document.getElementById("selectDevice");
  selectDev.value = selectedDeviceId;

  selectDev.addEventListener("change", (e) => {
    selectedDeviceId = e.target.value;
    localStorage.setItem("selectedLaborantRoom", selectedDeviceId);
    renderLaborantView();
  });

  initActionButtons();
  connectWebSocket();
  fetchQueue();
  fetchConsentQuestions();
  fetchServices();
});

function initActionButtons() {
  document.getElementById("btnActionCall").addEventListener("click", async () => {
    if (!activePatient) return;
    await postAPI("/api/queue/call", { id: activePatient.id });
  });

  document.getElementById("btnActionComplete").addEventListener("click", async () => {
    if (!activePatient) return;
    if (confirm(`${activePatient.patientName} ning tekshiruvi yakunlansinmi?`)) {
      await postAPI("/api/queue/update-status", { id: activePatient.id, status: "completed" });
    }
  });

  document.getElementById("btnCallToRoom").addEventListener("click", async () => {
    if (!prepPatient) return;
    await postAPI("/api/queue/call", { id: prepPatient.id });
    await postAPI("/api/queue/update-status", { id: prepPatient.id, status: "in_progress" });
  });

  // Bekor qilish tugmasi
  const btnCancel = document.getElementById("btnActionCancel");
  if (btnCancel) {
    btnCancel.addEventListener("click", () => {
      if (!activePatient) {
        alert("Hozirda xonada faol bemor yo'q");
        return;
      }
      const modal = document.getElementById("modalCancelReason");
      if (modal) modal.style.display = "flex";
    });
  }

  // Qayta navbatga qo'yish tugmasi
  const btnRequeue = document.getElementById("btnActionRequeue");
  if (btnRequeue) {
    btnRequeue.addEventListener("click", async () => {
      if (!activePatient) {
        alert("Hozirda xonada faol bemor yo'q");
        return;
      }
      if (confirm(`${activePatient.patientName} ni navbatga qayta qo'ymoqchimisiz? (Bemor kutish navbatiga qaytariladi)`)) {
        await postAPI("/api/queue/requeue", { id: activePatient.id, notes: "Laborant tomonidan qayta navbatga qo'yildi" });
        fetchQueue();
      }
    });
  }
}

window.closeCancelModal = function() {
  const modal = document.getElementById("modalCancelReason");
  if (modal) modal.style.display = "none";
};

window.confirmCancelExamination = async function() {
  if (!activePatient) return;
  const selectedRadio = document.querySelector('input[name="cancelReason"]:checked');
  const reason = selectedRadio ? selectedRadio.value : "Sabab ko'rsatilmadi";
  const extraNotes = document.getElementById("cancelExtraNotes").value.trim();

  const res = await postAPI("/api/queue/cancel", {
    id: activePatient.id,
    reason: reason,
    notes: extraNotes
  });

  closeCancelModal();
  if (res && res.success) {
    document.getElementById("cancelExtraNotes").value = "";
    fetchQueue();
  }
};

function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: "register",
      role: "doctor",
      room: selectedDeviceId,
      deviceName: `Laborant (${selectedDeviceId})`
    }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "queue_init" || data.type === "queue_updated") {
        if (data.payload.queue) currentQueue = data.payload.queue;
        renderLaborantView();
      } else if (data.type === "consent_questions_updated") {
        if (data.payload.questions) allConsentQuestions = data.payload.questions;
        renderConsentQuestionsManager();
      } else if (data.type === "laborant_schedule_updated") {
        if (document.getElementById("modalLaborantSchedule")?.style.display !== "none") {
          fetchLaborantScheduleData();
        }
      } else if (data.type === "services_updated" || data.type === "laborant_services_configured") {
        fetchServices();
        if (document.getElementById("modalServicesConfig")?.style.display !== "none") {
          fetchServicesConfigData();
        }
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

async function fetchQueue() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.success && data.queue) {
      currentQueue = data.queue;
      renderLaborantView();
    }
  } catch (e) {}
}

async function fetchConsentQuestions() {
  try {
    const res = await fetch("/api/consent/questions");
    const data = await res.json();
    if (data.success && Array.isArray(data.questions)) {
      allConsentQuestions = data.questions;
    }
  } catch (e) {
    console.error("Consent questions fetch error:", e);
  }
}

let cachedServicesCatalog = [];
let laborantPreferences = {};

async function fetchServices() {
  try {
    const res = await fetch("/api/services");
    const data = await res.json();
    if (data.success && Array.isArray(data.catalog)) {
      cachedServicesCatalog = data.catalog;
      window.servicesCatalogMap = {};
      cachedServicesCatalog.forEach(s => {
        window.servicesCatalogMap[s.code] = s;
      });
    }
  } catch (e) {
    console.error("Services fetch error:", e);
  }
}

function renderLaborantView() {
  const devQueue = currentQueue.filter(p => p.deviceId === selectedDeviceId);

  activePatient = devQueue.find(p => p.status === "in_progress" || p.status === "calling") || null;
  prepPatient = devQueue.find(p => p.status === "preparing") || null;
  const waitingList = devQueue.filter(p => p.status === "waiting");

  // 1. Active Patient Card
  const emptyBox = document.getElementById("emptyPatientBox");
  const detailsBox = document.getElementById("activePatientDetails");
  const sectionBadge = document.getElementById("currentSectionBadge");

  if (activePatient) {
    emptyBox.style.display = "none";
    detailsBox.style.display = "block";

    const isCalling = activePatient.status === "calling";
    sectionBadge.innerHTML = isCalling ? "🔔 Xonaga Chaqirilmoqda" : "🟢 Xonada (Tekshiruvda)";
    sectionBadge.style.color = isCalling ? "#38bdf8" : "#34d399";

    document.getElementById("curTicket").innerText = activePatient.ticketNumber;
    document.getElementById("curName").innerText = activePatient.patientName;
    document.getElementById("curService").innerText = activePatient.primaryService;
    document.getElementById("curDuration").innerText = activePatient.estimatedDurationMinutes || 30;

    const contrastPill = document.getElementById("curContrastPill");
    contrastPill.style.display = activePatient.isContrast ? "inline-flex" : "none";

    const consentPill = document.getElementById("curConsentPill");
    if (consentPill) {
      consentPill.style.display = "inline-flex";
      if (activePatient.consent) {
        if (activePatient.consent.isSafe) {
          consentPill.style.background = "rgba(16, 185, 129, 0.2)";
          consentPill.style.color = "#6ee7b7";
          consentPill.style.borderColor = "#10b981";
          consentPill.innerHTML = `<i class="fa-solid fa-circle-check"></i> Rozilik: Xavfsiz`;
        } else {
          consentPill.style.background = "rgba(239, 68, 68, 0.25)";
          consentPill.style.color = "#fca5a5";
          consentPill.style.borderColor = "#ef4444";
          consentPill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Rozilik: Xavf bor!`;
        }
      } else {
        consentPill.style.background = "rgba(245, 158, 11, 0.2)";
        consentPill.style.color = "#fde68a";
        consentPill.style.borderColor = "#f59e0b";
        consentPill.innerHTML = `<i class="fa-solid fa-clipboard-question"></i> Rozilik: Kutilmoqda`;
      }
    }

    const startTimeFormatted = activePatient.startedAt 
      ? new Date(activePatient.startedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) 
      : "--:--";
    document.getElementById("curStartTime").innerHTML = `<i class="fa-solid fa-circle-play" style="color:#10b981;"></i> Boshlandi: ${startTimeFormatted}`;
  } else {
    emptyBox.style.display = "block";
    detailsBox.style.display = "none";
    sectionBadge.innerHTML = "⚪ XONA BO'SH";
    sectionBadge.style.color = "#94a3b8";
  }

  // 2. Preparing Patient Card
  const emptyPrep = document.getElementById("emptyPrepBox");
  const prepDetails = document.getElementById("prepDetailsBox");

  if (prepPatient) {
    emptyPrep.style.display = "none";
    prepDetails.style.display = "block";

    document.getElementById("prepTicket").innerText = prepPatient.ticketNumber;
    document.getElementById("prepName").innerText = prepPatient.patientName;
    document.getElementById("prepService").innerText = prepPatient.primaryService;

    const badge = document.getElementById("prepContrastBadge");
    badge.style.display = prepPatient.isContrast ? "inline-flex" : "none";
  } else {
    emptyPrep.style.display = "flex";
    prepDetails.style.display = "none";
  }

  // 3. Waiting Queue List
  const listContainer = document.getElementById("waitingQueueList") || document.getElementById("waitingCardsContainer");
  const badgeEl = document.getElementById("waitingCountBadge");
  if (badgeEl) badgeEl.innerText = `${waitingList.length} ta`;

  if (!listContainer) return;

  if (waitingList.length === 0) {
    listContainer.innerHTML = `<div style="text-align:center; padding:32px 16px; color:#64748b; font-size:13.5px; font-weight:600;"><i class="fa-solid fa-user-check" style="font-size:28px; opacity:0.4; display:block; margin-bottom:8px;"></i>Hozirda kutayotgan bemorlar yo'q</div>`;
    return;
  }

  listContainer.innerHTML = waitingList.map(p => `
    <div class="waiting-card-item">
      <div class="item-left">
        <span class="item-ticket">${escapeHtml(p.ticketNumber)}</span>
        <div class="item-info">
          <div class="item-name">${escapeHtml(p.patientName)}</div>
          <div class="item-service">
            <span>${escapeHtml(p.primaryService)}</span>
            ${p.isContrast ? '<span class="mini-contrast-tag"><i class="fa-solid fa-syringe"></i> Kontrast</span>' : ''}
          </div>
          <div class="item-time-row">
            <span class="item-time-main">
              <i class="fa-regular fa-clock"></i> ${p.scheduledTime || (p.estimatedStartTime && p.estimatedStartTime.includes(':') ? (p.estimatedStartTime.match(/\d{1,2}:\d{2}/) || [''])[0] : '') || '--:--'}${p.finishTime ? ` – ${p.finishTime}` : ''}
            </span>
            ${p.prepCallTime ? `<span class="item-time-prep"><i class="fa-solid fa-hourglass-start"></i> Tayyorgarlik: ${new Date(p.prepCallTime).toTimeString().substring(0, 5)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="item-actions">
        <button class="btn-mini-consent" onclick="openPatientConsentById('${p.id}')" title="Bemor rozilik anketasi">
          <i class="fa-solid fa-clipboard-check"></i> <span>Anketa</span>
        </button>
        <button class="btn-mini-prep" onclick="handleStartPrep('${p.id}')" title="Tayyorgarlikka chaqirish">
          <i class="fa-solid fa-syringe"></i> <span>Tayyorlash</span>
        </button>
        <button class="btn-mini-call" onclick="handleCallPatient('${p.id}')" title="Tekshiruv xonasiga chaqirish">
          <i class="fa-solid fa-door-open"></i> <span>Chaqirish</span>
        </button>
      </div>
    </div>
  `).join("");
}

window.handleStartPrep = async function(id) {
  await postAPI("/api/queue/prep", { id });
};

window.handleCallPatient = async function(id) {
  await postAPI("/api/queue/call", { id });
  await postAPI("/api/queue/update-status", { id, status: "in_progress" });
};

async function postAPI(url, data) {
  try {
    const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || "";
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data)
    });
    return await res.json();
  } catch (e) {
    alert("Xatolik: " + e.message);
  }
}

async function getAPI(url) {
  try {
    const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token") || "";
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    return await res.json();
  } catch (e) {
    console.error("GET API xatosi:", e);
    return { success: false, error: e.message };
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// =============================================================
// ROZILIK ANKETASI (INFORMED CONSENT QUESTIONNAIRE) BOSHQARUVI
// =============================================================
let allConsentQuestions = [];
let consentTargetPatient = null;
let currentConsentAnswers = {};
let activeCqFilter = "ALL";

window.openCurrentPatientConsent = function() {
  if (!activePatient) {
    alert("Hozirda xonada bemor yo'q");
    return;
  }
  openPatientConsent(activePatient);
};

window.openPrepPatientConsent = function() {
  if (!prepPatient) {
    alert("Hozirda tayyorgarlikda bemor yo'q");
    return;
  }
  openPatientConsent(prepPatient);
};

window.openPatientConsentById = function(id) {
  const p = currentQueue.find(x => x.id === id);
  if (p) openPatientConsent(p);
};

function openPatientConsent(patient) {
  consentTargetPatient = patient;
  currentConsentAnswers = patient.consent ? { ...(patient.consent.answers || {}) } : {};

  const titleEl = document.getElementById("consentPatTitle");
  const subEl = document.getElementById("consentPatSubtitle");
  const notesInp = document.getElementById("consentNotesInp");

  if (titleEl) titleEl.innerText = `${patient.ticketNumber} — ${patient.patientName}`;
  if (subEl) subEl.innerText = `${patient.primaryService} (${(patient.deviceId || '').toUpperCase()}) • Xabardor qilingan rozilik anketasi`;
  if (notesInp) notesInp.value = patient.consent?.notes || "";

  renderConsentQuestionsForPatient(patient);
  updateConsentSafetyStatus();

  const modal = document.getElementById("modalPatientConsent");
  if (modal) modal.style.display = "flex";
}

window.closePatientConsentModal = function() {
  const modal = document.getElementById("modalPatientConsent");
  if (modal) modal.style.display = "none";
  consentTargetPatient = null;
};

function getDeduplicatedRelevantQuestions(patient) {
  if (!patient) return [];

  const services = Array.isArray(patient.services) && patient.services.length > 0
    ? patient.services
    : [{ name: patient.primaryService, deviceType: patient.deviceType, isContrast: patient.isContrast }];
  
  let isMrt = false;
  let isMskt = false;
  let isContrast = Boolean(patient.isContrast);

  const devId = String(patient.deviceId || '').toLowerCase();
  if (devId.includes('mrt') || patient.deviceType === 'MRT') isMrt = true;
  if (devId.includes('mskt') || devId.includes('kt') || patient.deviceType === 'MSKT') isMskt = true;

  services.forEach(s => {
    const sName = String(s.name || '').toLowerCase();
    const sType = String(s.type || s.examType || '').toUpperCase();
    if (sType === 'MRT' || sName.includes('mrt')) isMrt = true;
    if (sType === 'MSKT' || sName.includes('mskt') || sName.includes('kt')) isMskt = true;
    if (s.isContrast || sName.includes('kontrast')) isContrast = true;
  });

  if (!isMrt && !isMskt) isMrt = true;

  const serviceSpecificQuestionIds = new Set();
  services.forEach(s => {
    if (Array.isArray(s.consentQuestionIds)) {
      s.consentQuestionIds.forEach(id => serviceSpecificQuestionIds.add(id));
    }
    const sCode = (s.code || s.serviceCode || '').toUpperCase().trim();
    if (sCode) {
      if (laborantPreferences.serviceConsentQuestions && Array.isArray(laborantPreferences.serviceConsentQuestions[sCode])) {
        laborantPreferences.serviceConsentQuestions[sCode].forEach(id => serviceSpecificQuestionIds.add(id));
      }
      if (Array.isArray(cachedServicesCatalog)) {
        const catItem = cachedServicesCatalog.find(c => c.code === sCode);
        if (catItem && Array.isArray(catItem.consentQuestionIds)) {
          catItem.consentQuestionIds.forEach(id => serviceSpecificQuestionIds.add(id));
        }
      }
    }
  });

  // Filtrlash: maxsus tekshiruv savollari + tegishli apparat savollari + kontrast savollari + umumiy (ALL) savollar
  const rawRelevant = allConsentQuestions.filter(q => {
    if (serviceSpecificQuestionIds.has(q.id)) return true;
    if (q.category === "ALL") return true;
    if (q.category === "MRT" && isMrt) return true;
    if (q.category === "MSKT" && isMskt) return true;
    if (q.category === "CONTRAST" && isContrast) return true;
    return false;
  });

  // Takroriylikni mutlaqo yo'qotish (ID va normallashtirilgan savol matni bo'yicha)
  const seenIds = new Set();
  const seenTexts = new Set();
  const deduped = [];

  for (const q of rawRelevant) {
    if (!q || !q.text) continue;
    const norm = q.text.toLowerCase().replace(/[\s\?\,\.\!ʻʼ'`]+/g, ' ').trim();
    if (seenIds.has(q.id) || seenTexts.has(norm)) continue;
    seenIds.add(q.id);
    seenTexts.add(norm);
    deduped.push(q);
  }

  return deduped;
}

function renderConsentQuestionsForPatient(patient) {
  const container = document.getElementById("consentQuestionsList");
  if (!container) return;

  const relevantQuestions = getDeduplicatedRelevantQuestions(patient);

  if (relevantQuestions.length === 0) {
    container.innerHTML = `<div style="color:#94a3b8; text-align:center; padding:20px; font-size:12px;">Ushbu tekshiruv uchun savollar topilmadi.</div>`;
    return;
  }

  container.innerHTML = relevantQuestions.map((q, idx) => {
    // Agar javob berilmagan bo'lsa, xavfsiz default javobni olish
    const currentAns = currentConsentAnswers[q.id] !== undefined 
      ? currentConsentAnswers[q.id] 
      : (q.dangerAnswer === "yes" ? "no" : "yes");
    
    currentConsentAnswers[q.id] = currentAns;

    const isDanger = (currentAns === q.dangerAnswer);
    const riskBadgeClass = `cq-badge ${q.riskLevel || 'warning'}`;
    const riskLabel = q.riskLevel === 'danger' ? 'Mutlaq Qarshi Ko\'rsatma' : (q.riskLevel === 'warning' ? 'Ehtiyotkorlik' : 'Ma\'lumot');

    return `
      <div class="consent-q-item ${isDanger ? 'danger-flag' : ''}" id="cq_wrap_${q.id}">
        <div class="consent-q-top">
          <div class="consent-q-text">
            <span style="color:#38bdf8; font-weight:800; margin-right:4px;">${idx + 1}.</span>
            ${escapeHtml(q.text)}
            <span class="${riskBadgeClass}" style="margin-left:6px; font-size:9.5px;">${riskLabel}</span>
          </div>
          <div class="consent-btn-group">
            <button type="button" class="btn-answer ${currentAns === 'no' ? (q.dangerAnswer === 'no' ? 'selected-yes' : 'selected-no') : ''}" onclick="setPatientAnswer('${q.id}', 'no')">
              Yo'q
            </button>
            <button type="button" class="btn-answer ${currentAns === 'yes' ? (q.dangerAnswer === 'yes' ? 'selected-yes' : 'selected-no') : ''}" onclick="setPatientAnswer('${q.id}', 'yes')">
              Ha
            </button>
          </div>
        </div>
        ${q.description ? `<div class="consent-q-desc"><i class="fa-solid fa-circle-info" style="color:#38bdf8;"></i> ${escapeHtml(q.description)}</div>` : ''}
      </div>
    `;
  }).join("");
}

window.setPatientAnswer = function(questionId, ans) {
  currentConsentAnswers[questionId] = ans;
  const q = allConsentQuestions.find(x => x.id === questionId);
  const wrap = document.getElementById(`cq_wrap_${questionId}`);

  if (wrap && q) {
    const isDanger = (ans === q.dangerAnswer);
    if (isDanger) wrap.classList.add("danger-flag");
    else wrap.classList.remove("danger-flag");

    const noBtn = wrap.querySelector(".consent-btn-group button:nth-child(1)");
    const yesBtn = wrap.querySelector(".consent-btn-group button:nth-child(2)");

    if (noBtn && yesBtn) {
      noBtn.className = `btn-answer ${ans === 'no' ? (q.dangerAnswer === 'no' ? 'selected-yes' : 'selected-no') : ''}`;
      yesBtn.className = `btn-answer ${ans === 'yes' ? (q.dangerAnswer === 'yes' ? 'selected-yes' : 'selected-no') : ''}`;
    }
  }

  updateConsentSafetyStatus();
};

function updateConsentSafetyStatus() {
  const banner = document.getElementById("consentSafetyBanner");
  const textEl = document.getElementById("consentSafetyText");
  const iconEl = document.getElementById("consentSafetyIcon");
  if (!banner || !textEl) return;

  let dangerCount = 0;
  let dangerQuestions = [];

  for (const qId in currentConsentAnswers) {
    const ans = currentConsentAnswers[qId];
    const q = allConsentQuestions.find(x => x.id === qId);
    if (q && ans === q.dangerAnswer) {
      dangerCount++;
      dangerQuestions.push(q.text);
    }
  }

  if (dangerCount > 0) {
    banner.className = "consent-safety-banner danger";
    if (iconEl) iconEl.className = "fa-solid fa-triangle-exclamation";
    textEl.innerHTML = `<strong>🚨 DIQQAT: Xavfli holat aniqlandi! (${dangerCount} ta qarshi ko'rsatma).</strong> Shifokor ko'rigi talab etiladi.`;
  } else {
    banner.className = "consent-safety-banner safe";
    if (iconEl) iconEl.className = "fa-solid fa-circle-check";
    textEl.innerHTML = `<strong>🟢 Tekshiruvga ruxsat etiladi:</strong> Qarshi ko'rsatmalar aniqlanmadi. Bemor xavfsiz.`;
  }
}

window.savePatientConsentForm = async function() {
  if (!consentTargetPatient) return;

  const notes = document.getElementById("consentNotesInp")?.value.trim() || "";
  let isSafe = true;

  for (const qId in currentConsentAnswers) {
    const ans = currentConsentAnswers[qId];
    const q = allConsentQuestions.find(x => x.id === qId);
    if (q && ans === q.dangerAnswer && q.riskLevel === "danger") {
      isSafe = false;
      break;
    }
  }

  const payload = {
    patientId: consentTargetPatient.id,
    isSafe: isSafe,
    answers: currentConsentAnswers,
    notes: notes,
    filledBy: "Laborant"
  };

  const res = await postAPI("/api/consent/submit", payload);
  if (res && res.success) {
    alert("✅ Bemor rozilik anketasi muvaffaqiyatli saqlandi!");
    closePatientConsentModal();
    fetchQueue();
  } else {
    alert("Xatolik: " + (res?.error || "Saqlab bo'lmadi"));
  }
};

window.printPatientConsentForm = function() {
  if (!consentTargetPatient) return;

  const printWin = window.open("", "_blank", "width=800,height=900");
  if (!printWin) return;

  const pat = consentTargetPatient;
  const isMskt = pat.deviceType === "MSKT" || (pat.deviceId && pat.deviceId.includes("mskt"));
  const devCategory = isMskt ? "MSKT" : "MRT";

  const relevantQuestions = getDeduplicatedRelevantQuestions(pat);

  const todayStr = new Date().toLocaleDateString("ru-RU");

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Rozilik Varaqasi - ${escapeHtml(pat.patientName)}</title>
      <style>
        @page { size: A4; margin: 15mm 12mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Times New Roman', Times, serif; font-size: 13px; line-height: 1.35; color: #000; margin: 0; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .header h3 { margin: 0 0 3px 0; font-size: 14px; text-transform: uppercase; }
        .header h2 { margin: 0 0 3px 0; font-size: 16px; font-weight: 900; }
        .header p { margin: 0; font-size: 12px; font-style: italic; }
        .info-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .info-table td { padding: 4px 6px; border: 1px solid #777; font-size: 12.5px; }
        .info-table td.label { width: 22%; font-weight: bold; background: #f8f8f8; }
        .q-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        .q-table th, .q-table td { border: 1px solid #000; padding: 5px 6px; font-size: 12px; }
        .q-table th { background: #eeeeee; text-align: center; }
        .text-center { text-align: center; font-weight: bold; }
        .ans-yes { color: #000; font-weight: 900; text-align: center; }
        .ans-no { color: #000; font-weight: bold; text-align: center; }
        .declaration { border: 1px solid #333; background: #fafafa; padding: 8px 10px; font-size: 12px; line-height: 1.35; text-align: justify; margin-bottom: 14px; }
        .signatures { width: 100%; margin-top: 25px; border-collapse: collapse; }
        .signatures td { vertical-align: bottom; font-size: 12.5px; padding: 6px 0; }
        .sign-line { display: inline-block; width: 160px; border-bottom: 1px solid #000; margin-left: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h3>O'zbekiston Respublikasi Sog'liqni Saqlash Vazirligi</h3>
        <h2>RESPUBLIKA IXTISOSLASHTIRILGAN ONKOLOGIYA VA RADIOLOGIYA ILMIY-AMALIY TIBBIYOT MARKAZI</h2>
        <p>Radiologik tekshiruv (${devCategory}) o'tkazishga xabardor qilingan ixtiyoriy rozilik va xavfsizlik anketasi</p>
      </div>

      <table class="info-table">
        <tr>
          <td class="label">Bemor F.I.Sh:</td>
          <td><strong>${escapeHtml(pat.patientName)}</strong></td>
          <td class="label">Bemor ID / Karta:</td>
          <td>${escapeHtml(pat.patientId || pat.cardNo || '-')}</td>
        </tr>
        <tr>
          <td class="label">Tekshiruv Sohasi:</td>
          <td><strong>${escapeHtml(pat.primaryService)}</strong></td>
          <td class="label">Apparat / Xona:</td>
          <td>${(pat.deviceId || '').toUpperCase()}</td>
        </tr>
        <tr>
          <td class="label">Kontrast Modda:</td>
          <td>${pat.isContrast ? 'Ha (Vena ichiga kontrast yuboriladi)' : 'Yo\'q (Kontrastsiz)'}</td>
          <td class="label">To'ldirilgan Sana:</td>
          <td>${todayStr}</td>
        </tr>
      </table>

      <table class="q-table">
        <thead>
          <tr>
            <th style="width:5%;">№</th>
            <th style="width:75%; text-align:left;">Xavfsizlik va Tibbiy Anamnez Savoli</th>
            <th style="width:10%;">Yo'q</th>
            <th style="width:10%;">Ha</th>
          </tr>
        </thead>
        <tbody>
          ${relevantQuestions.map((q, idx) => {
            const ans = currentConsentAnswers[q.id] || "no";
            return `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td>${escapeHtml(q.text)}</td>
                <td class="ans-no">${ans === 'no' ? 'V' : ''}</td>
                <td class="ans-yes">${ans === 'yes' ? 'V' : ''}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="declaration">
        <strong>BEMORNING ROZILIK BAYONNOMASI:</strong><br>
        Men, yuqorida ko'rsatilgan bemor (yoki uning qonuniy vakili), o'tkazilayotgan radiologik tekshiruvning maqsadi, tartibi, kontrast moddaning xususiyatlari va yuzaga kelishi mumkin bo'lgan holatlar haqida to'liq tushuntirish oldim. Anketa savollariga to'liq va to'g'ri javob berganimni tasdiqlayman. O'tkaziladigan tekshiruvga o'z ixtiyorim bilan rozilik bildiraman.
      </div>

      <table class="signatures">
        <tr>
          <td style="width:50%;">
            Bemor (yoki vakili) imzosi: <span class="sign-line"></span>
          </td>
          <td style="width:50%; text-align:right;">
            Laborant / Vrach imzosi: <span class="sign-line"></span>
          </td>
        </tr>
        <tr>
          <td>F.I.Sh: ___________________________</td>
          <td style="text-align:right;">Sana: ${todayStr} yil</td>
        </tr>
      </table>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
};

// =============================================================
// ROZILIK SAVOLLARINI BOSHQARISH (QUESTIONS MANAGER MODAL)
// =============================================================
window.openConsentQuestionsManagerModal = function() {
  const modal = document.getElementById("modalConsentQuestionsManager");
  if (modal) modal.style.display = "flex";
  renderConsentQuestionsManager();
};

window.closeConsentQuestionsManagerModal = function() {
  const modal = document.getElementById("modalConsentQuestionsManager");
  if (modal) modal.style.display = "none";
  toggleAddQuestionForm(false);
};

window.filterConsentQuestions = function(category, btnEl) {
  activeCqFilter = category;
  const buttons = document.querySelectorAll(".cq-tab-btn");
  buttons.forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  renderConsentQuestionsManager();
};

function renderConsentQuestionsManager() {
  const container = document.getElementById("cqItemsList");
  if (!container) return;

  const rawFiltered = activeCqFilter === "ALL" 
    ? allConsentQuestions 
    : allConsentQuestions.filter(q => q.category === activeCqFilter || q.category === "ALL");

  const seenIds = new Set();
  const seenTexts = new Set();
  const filtered = [];

  for (const q of rawFiltered) {
    if (!q || !q.text) continue;
    const norm = q.text.toLowerCase().replace(/[\s\?\,\.\!ʻʼ'`]+/g, ' ').trim();
    if (seenIds.has(q.id) || seenTexts.has(norm)) continue;
    seenIds.add(q.id);
    seenTexts.add(norm);
    filtered.push(q);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Ushbu bo'limda savollar mavjud emas.</div>`;
    return;
  }

  container.innerHTML = filtered.map((q, idx) => {
    const riskBadgeClass = `cq-badge ${q.riskLevel || 'warning'}`;
    const riskLabel = q.riskLevel === 'danger' ? 'Mutlaq Qarshi Ko\'rsatma' : (q.riskLevel === 'warning' ? 'Ehtiyotkorlik' : 'Ma\'lumot');
    const catLabel = q.category === 'CONTRAST' ? '💉 Kontrast' : (q.category === 'MSKT' ? '⚡ MSKT' : (q.category === 'ALL' ? '🌐 Barchasi' : '🧲 MRT'));

    return `
      <div class="cq-item-card">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
            <span style="font-size:11px; font-weight:700; color:#38bdf8; background:#1e293b; padding:1px 6px; border-radius:4px;">${catLabel}</span>
            <span class="${riskBadgeClass}">${riskLabel}</span>
            ${q.required ? '<span style="font-size:10px; color:#f87171; font-weight:700;">* Majburiy</span>' : ''}
          </div>
          <div style="font-size:12.5px; font-weight:600; color:#f8fafc; line-height:1.35;">
            ${idx + 1}. ${escapeHtml(q.text)}
          </div>
          ${q.description ? `<div style="font-size:11px; color:#94a3b8; margin-top:2px;">${escapeHtml(q.description)}</div>` : ''}
        </div>
        <div>
          <button class="cq-del-btn" onclick="deleteQuestionAction('${q.id}', '${escapeHtml(q.text)}')" title="Savolni o'chirish">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

window.toggleAddQuestionForm = function(show) {
  const formWrap = document.getElementById("cqAddFormWrap");
  if (!formWrap) return;
  if (show === undefined) {
    formWrap.style.display = formWrap.style.display === "none" ? "block" : "none";
  } else {
    formWrap.style.display = show ? "block" : "none";
  }
};

window.submitNewQuestion = async function() {
  const textInp = document.getElementById("newCqText");
  const catInp = document.getElementById("newCqCategory");
  const riskInp = document.getElementById("newCqRisk");
  const dangerInp = document.getElementById("newCqDangerAnswer");
  const reqInp = document.getElementById("newCqRequired");
  const descInp = document.getElementById("newCqDesc");

  const text = textInp.value.trim();
  if (!text) {
    alert("Iltimos, savol matnini kiriting!");
    return;
  }

  const payload = {
    text: text,
    category: catInp.value,
    riskLevel: riskInp.value,
    dangerAnswer: dangerInp.value,
    required: reqInp.value === "true",
    description: descInp.value.trim()
  };

  const res = await postAPI("/api/consent/questions/save", payload);
  if (res && res.success) {
    alert("✅ Yangi savol muvaffaqiyatli qo'shildi!");
    textInp.value = "";
    descInp.value = "";
    toggleAddQuestionForm(false);
    if (res.questions) allConsentQuestions = res.questions;
    renderConsentQuestionsManager();
  } else {
    alert("Xatolik: " + (res?.error || "Savolni qo'shib bo'lmadi"));
  }
};

window.deleteQuestionAction = async function(id, text) {
  if (!confirm(`Haqiqatan ham ushbu savolni so'rovnomadan o'chirmoqchimisiz?\n\n"${text}"`)) {
    return;
  }

  const res = await postAPI("/api/consent/questions/delete", { id });
  if (res && res.success) {
    if (res.questions) allConsentQuestions = res.questions;
    renderConsentQuestionsManager();
  } else {
    alert("Xatolik: " + (res?.error || "Savolni o'chirib bo'lmadi"));
  }
};

// =============================================================
// LABORANT ISH GRAFIGI VA TAQVIM (MONTHLY/YEARLY SCHEDULE)
// =============================================================
let laborantWorkSchedule = {
  start: "08:00",
  end: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  days: ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"],
  customDates: {},
  shiftPattern: "standard"
};
let currentCalDate = new Date();

window.openLaborantScheduleModal = async function() {
  const modal = document.getElementById("modalLaborantSchedule");
  if (!modal) return;
  modal.style.display = "flex";

  await fetchLaborantScheduleData();
};

window.closeLaborantScheduleModal = function() {
  const modal = document.getElementById("modalLaborantSchedule");
  if (modal) modal.style.display = "none";
};

window.switchScheduleTab = function(tab, btn) {
  const tabCal = document.getElementById("schedTabCalendar");
  const tabHours = document.getElementById("schedTabHours");
  const btnCal = document.getElementById("tabBtnSchedCalendar");
  const btnHours = document.getElementById("tabBtnSchedHours");

  if (tab === 'calendar') {
    if (tabCal) tabCal.style.display = "block";
    if (tabHours) tabHours.style.display = "none";
    if (btnCal) btnCal.classList.add("active");
    if (btnHours) btnHours.classList.remove("active");
    renderCalendar();
  } else {
    if (tabCal) tabCal.style.display = "none";
    if (tabHours) tabHours.style.display = "block";
    if (btnCal) btnCal.classList.remove("active");
    if (btnHours) btnHours.classList.add("active");
  }
};

async function fetchLaborantScheduleData() {
  const res = await getAPI("/api/laborant/my-schedule");
  if (res && res.success) {
    if (res.workSchedule) {
      laborantWorkSchedule = {
        ...laborantWorkSchedule,
        ...res.workSchedule,
        customDates: res.workSchedule.customDates || {}
      };
    }
    if (res.preferences) {
      laborantPreferences = res.preferences;
    }

    // Soatlar inputlarini to'ldirish
    const inpStart = document.getElementById("inpSchedWorkStart");
    const inpEnd = document.getElementById("inpSchedWorkEnd");
    const inpLStart = document.getElementById("inpSchedLunchStart");
    const inpLEnd = document.getElementById("inpSchedLunchEnd");

    if (inpStart) inpStart.value = laborantWorkSchedule.start || "08:00";
    if (inpEnd) inpEnd.value = laborantWorkSchedule.end || "17:00";
    if (inpLStart) inpLStart.value = laborantWorkSchedule.lunchStart || "12:00";
    if (inpLEnd) inpLEnd.value = laborantWorkSchedule.lunchEnd || "13:00";

    // Haftaning standart kunlari
    const activeDays = laborantWorkSchedule.days || ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    const checkboxes = document.querySelectorAll("#schedWeekdaysWrap input[type='checkbox']");
    checkboxes.forEach(chk => {
      chk.checked = activeDays.includes(chk.value);
    });

    renderCalendar();
  }
}

window.changeCalMonth = function(offset) {
  currentCalDate = new Date(currentCalDate.getFullYear(), currentCalDate.getMonth() + offset, 1);
  renderCalendar();
};

const MONTH_NAMES_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"
];
const DAY_SHORT_UZ = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

window.renderCalendar = function() {
  const grid = document.getElementById("calDaysGrid");
  const titleEl = document.getElementById("calMonthYearTitle");
  if (!grid || !titleEl) return;

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();

  titleEl.textContent = `${MONTH_NAMES_UZ[month]} ${year}`;

  grid.innerHTML = "";

  // Oyning birinchi kuni haftaning qaysi kuniga to'g'ri keladi (1 = Du, ..., 7 = Ya)
  const firstDay = new Date(year, month, 1);
  let startDayOfWeek = firstDay.getDay(); // 0 = Ya, 1 = Du
  if (startDayOfWeek === 0) startDayOfWeek = 7; // Du = 1, Ya = 7

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  // O'tgan oydan qolgan bo'sh kataklar
  for (let i = 1; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "cal-day-cell other-month";
    grid.appendChild(emptyCell);
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const standardDays = laborantWorkSchedule.days || ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const curDate = new Date(year, month, d);
    const yyyy = curDate.getFullYear();
    const mm = String(curDate.getMonth() + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const isToday = (dateStr === todayStr);
    const dayOfWeekShort = DAY_SHORT_UZ[curDate.getDay()];

    let status = "work";
    let statusLabel = "Ish";
    let customHours = null;

    // Agar shaxsiy taqvimda sana belgilangan bo'lsa
    if (laborantWorkSchedule.customDates && laborantWorkSchedule.customDates[dateStr]) {
      const cd = laborantWorkSchedule.customDates[dateStr];
      if (typeof cd === 'string') {
        status = cd;
      } else if (typeof cd === 'object' && cd !== null) {
        status = cd.type || (cd.isWorkDay === false ? 'off' : 'work');
        if (cd.start && cd.end && status !== 'off') {
          customHours = `${cd.start}-${cd.end}`;
        }
      }
    } else {
      // Standart haftalik kunlar asosida
      if (standardDays.includes(dayOfWeekShort)) {
        status = "work";
      } else {
        status = "off";
      }
    }

    if (status === "work") statusLabel = "Ish";
    else if (status === "duty") statusLabel = "Navbt";
    else if (status === "off") statusLabel = "Dam";

    const cell = document.createElement("div");
    cell.className = `cal-day-cell ${status} ${isToday ? "today" : ""} ${customHours ? "has-custom-hours" : ""}`;
    const hoursTooltip = customHours ? ` | Ish soati: ${customHours}` : (status === 'off' ? ' | Dam olish kuni' : '');
    cell.title = `${dateStr} (${dayOfWeekShort}): ${statusLabel}${hoursTooltip} - Bosib o'zgartirish`;
    cell.onclick = () => openDayScheduleModal(dateStr);

    cell.innerHTML = `
      <div class="cal-cell-top">
        <span class="cal-day-num">${d}</span>
        <span class="cal-day-badge">${statusLabel}</span>
      </div>
      ${customHours ? `<span class="cal-day-hours">${customHours}</span>` : `<span class="cal-day-hours-empty"></span>`}
    `;

    grid.appendChild(cell);
  }
};

let currentEditingDateStr = null;
const DAY_NAMES_FULL_UZ = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

window.openDayScheduleModal = function(dateStr) {
  currentEditingDateStr = dateStr;
  const modal = document.getElementById("modalDayScheduleEditor");
  if (!modal) return;

  const d = new Date(dateStr + "T00:00:00");
  const dayName = DAY_NAMES_FULL_UZ[d.getDay()];
  const monthName = MONTH_NAMES_UZ[d.getMonth()];
  const formattedTitle = `${d.getDate()}-${monthName}, ${d.getFullYear()}`;

  const titleEl = document.getElementById("dayModalDateTitle");
  const weekdayEl = document.getElementById("dayModalWeekday");
  if (titleEl) titleEl.innerText = formattedTitle;
  if (weekdayEl) weekdayEl.innerText = `${dayName} kuni uchun grafik`;

  // Mavjud custom holat yoki standartni aniqlash
  let customConfig = null;
  if (laborantWorkSchedule.customDates && laborantWorkSchedule.customDates[dateStr]) {
    customConfig = laborantWorkSchedule.customDates[dateStr];
  }

  let selectedType = "default";
  let startTime = laborantWorkSchedule.start || "08:00";
  let endTime = laborantWorkSchedule.end || "17:00";
  let lunchStart = laborantWorkSchedule.lunchStart || "12:00";
  let lunchEnd = laborantWorkSchedule.lunchEnd || "13:00";

  if (customConfig) {
    if (typeof customConfig === "string") {
      selectedType = customConfig;
    } else if (typeof customConfig === "object") {
      selectedType = customConfig.type || (customConfig.isWorkDay === false ? "off" : "work");
      if (customConfig.start) startTime = customConfig.start;
      if (customConfig.end) endTime = customConfig.end;
      if (customConfig.lunchStart) lunchStart = customConfig.lunchStart;
      if (customConfig.lunchEnd) lunchEnd = customConfig.lunchEnd;
    }
  } else {
    // Standart kunlar
    const dayOfWeekShort = DAY_SHORT_UZ[d.getDay()];
    const standardDays = laborantWorkSchedule.days || ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    selectedType = standardDays.includes(dayOfWeekShort) ? "work" : "off";
  }

  // Radio buttonni tanlash
  const rads = document.querySelectorAll("input[name='radDayStatus']");
  rads.forEach(rad => {
    rad.checked = (rad.value === selectedType);
  });

  // Soatlarni kiritish
  const inpS = document.getElementById("inpDayStart");
  const inpE = document.getElementById("inpDayEnd");
  const inpLS = document.getElementById("inpDayLunchStart");
  const inpLE = document.getElementById("inpDayLunchEnd");

  if (inpS) inpS.value = startTime;
  if (inpE) inpE.value = endTime;
  if (inpLS) inpLS.value = lunchStart;
  if (inpLE) inpLE.value = lunchEnd;

  onDayStatusChange();
  modal.style.display = "flex";
};

window.closeDayScheduleModal = function() {
  const modal = document.getElementById("modalDayScheduleEditor");
  if (modal) modal.style.display = "none";
  currentEditingDateStr = null;
};

window.onDayStatusChange = function() {
  const selectedRad = document.querySelector("input[name='radDayStatus']:checked");
  const val = selectedRad ? selectedRad.value : "work";

  const hoursSec = document.getElementById("dayHoursSection");
  const offNotice = document.getElementById("dayOffNoticeBox");
  const defNotice = document.getElementById("dayDefaultNoticeBox");

  if (val === "off") {
    if (hoursSec) hoursSec.style.display = "none";
    if (offNotice) offNotice.style.display = "block";
    if (defNotice) defNotice.style.display = "none";
  } else if (val === "default") {
    if (hoursSec) hoursSec.style.display = "none";
    if (offNotice) offNotice.style.display = "none";
    if (defNotice) defNotice.style.display = "block";
  } else {
    if (hoursSec) hoursSec.style.display = "block";
    if (offNotice) offNotice.style.display = "none";
    if (defNotice) defNotice.style.display = "none";
  }
};

window.setDayPresetHours = function(start, end, lunchStart, lunchEnd) {
  const inpS = document.getElementById("inpDayStart");
  const inpE = document.getElementById("inpDayEnd");
  const inpLS = document.getElementById("inpDayLunchStart");
  const inpLE = document.getElementById("inpDayLunchEnd");

  if (inpS) inpS.value = start;
  if (inpE) inpE.value = end;
  if (inpLS) inpLS.value = lunchStart;
  if (inpLE) inpLE.value = lunchEnd;
};

window.saveCurrentDaySchedule = function() {
  if (!currentEditingDateStr) return;
  if (!laborantWorkSchedule.customDates) laborantWorkSchedule.customDates = {};

  const selectedRad = document.querySelector("input[name='radDayStatus']:checked");
  const val = selectedRad ? selectedRad.value : "work";

  if (val === "default") {
    delete laborantWorkSchedule.customDates[currentEditingDateStr];
  } else if (val === "off") {
    laborantWorkSchedule.customDates[currentEditingDateStr] = {
      type: "off",
      isWorkDay: false
    };
  } else {
    const start = document.getElementById("inpDayStart")?.value || "08:00";
    const end = document.getElementById("inpDayEnd")?.value || "17:00";
    const lunchStart = document.getElementById("inpDayLunchStart")?.value || "12:00";
    const lunchEnd = document.getElementById("inpDayLunchEnd")?.value || "13:00";

    laborantWorkSchedule.customDates[currentEditingDateStr] = {
      type: val, // 'work' | 'duty'
      isWorkDay: true,
      start,
      end,
      lunchStart,
      lunchEnd
    };
  }

  closeDayScheduleModal();
  renderCalendar();
};

window.toggleDayCustomStatus = function(dateStr) {
  openDayScheduleModal(dateStr);
};

window.applyShiftPattern = function(pattern) {
  if (!laborantWorkSchedule.customDates) laborantWorkSchedule.customDates = {};

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= totalDays; d++) {
    const curDate = new Date(year, month, d);
    const yyyy = curDate.getFullYear();
    const mm = String(curDate.getMonth() + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayOfWeek = curDate.getDay(); // 0 = Ya

    let type = "work";

    if (pattern === "standard") {
      type = (dayOfWeek !== 0) ? "work" : "off";
    } else if (pattern === "alternate_1_1") {
      type = (d % 2 === 1) ? "work" : "off";
    } else if (pattern === "shift_2_2") {
      type = (Math.floor((d - 1) / 2) % 2 === 0) ? "work" : "off";
    } else if (pattern === "odd_days") {
      type = (d % 2 === 1) ? "work" : "off";
    } else if (pattern === "even_days") {
      type = (d % 2 === 0) ? "work" : "off";
    }

    laborantWorkSchedule.customDates[dateStr] = {
      type,
      start: laborantWorkSchedule.start || "08:00",
      end: laborantWorkSchedule.end || "17:00",
      lunchStart: laborantWorkSchedule.lunchStart || "12:00",
      lunchEnd: laborantWorkSchedule.lunchEnd || "13:00"
    };
  }

  laborantWorkSchedule.shiftPattern = pattern;
  renderCalendar();
};

window.resetCalendarCustomDates = function() {
  if (!confirm("Ushbu oy uchun kiritilgan maxsus kunlar tozalanib, standart jadvalga qaytarilsinmi?")) return;

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();
  const totalDays = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= totalDays; d++) {
    const yyyy = year;
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    if (laborantWorkSchedule.customDates) {
      delete laborantWorkSchedule.customDates[dateStr];
    }
  }

  renderCalendar();
};

window.saveLaborantSchedule = async function() {
  const inpStart = document.getElementById("inpSchedWorkStart")?.value || "08:00";
  const inpEnd = document.getElementById("inpSchedWorkEnd")?.value || "17:00";
  const inpLStart = document.getElementById("inpSchedLunchStart")?.value || "12:00";
  const inpLEnd = document.getElementById("inpSchedLunchEnd")?.value || "13:00";

  const checkedDays = Array.from(document.querySelectorAll("#schedWeekdaysWrap input[type='checkbox']:checked"))
    .map(chk => chk.value);

  laborantWorkSchedule.start = inpStart;
  laborantWorkSchedule.end = inpEnd;
  laborantWorkSchedule.lunchStart = inpLStart;
  laborantWorkSchedule.lunchEnd = inpLEnd;
  laborantWorkSchedule.days = checkedDays.length > 0 ? checkedDays : ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];

  const res = await postAPI("/api/laborant/my-schedule", {
    workSchedule: laborantWorkSchedule
  });

  if (res && res.success) {
    alert("✅ Ish grafigi va taqvim muvaffaqiyatli saqlandi!");
    closeLaborantScheduleModal();
  } else {
    alert("Xatolik: " + (res?.error || "Jadvalni saqlab bo'lmadi"));
  }
};

// =============================================================
// TEKSHIRUVLAR SOZLAMALARI (VAQTLAR, TAYYORGARLIK, QARSHI KO'RSATMA, SAVOLLAR)
// =============================================================
let activeScFilter = "ALL";
let selectedQuestionsMap = {}; // code -> Set of question ids

window.openServicesConfigModal = async function() {
  const modal = document.getElementById("modalServicesConfig");
  if (!modal) return;
  modal.style.display = "flex";

  await fetchServicesConfigData();
};

window.closeServicesConfigModal = function() {
  const modal = document.getElementById("modalServicesConfig");
  if (modal) modal.style.display = "none";
};

window.filterServicesConfig = function(filter, btn) {
  activeScFilter = filter;
  const buttons = document.querySelectorAll(".sc-filter-tabs .sc-tab-btn");
  buttons.forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  renderServicesConfigList();
};

async function fetchServicesConfigData() {
  const res = await getAPI("/api/laborant/services-config");
  if (res && res.success) {
    cachedServicesCatalog = res.catalog || [];
    window.servicesCatalogMap = {};
    cachedServicesCatalog.forEach(s => {
      window.servicesCatalogMap[s.code] = s;
    });

    if (Array.isArray(res.consentQuestions)) {
      allConsentQuestions = res.consentQuestions;
    }
    if (res.userPreferences) {
      laborantPreferences = res.userPreferences;
    }

    // Initialize selectedQuestionsMap
    selectedQuestionsMap = {};
    cachedServicesCatalog.forEach(s => {
      const qIds = laborantPreferences.serviceConsentQuestions?.[s.code] || s.consentQuestionIds || [];
      selectedQuestionsMap[s.code] = new Set(qIds);
    });

    renderServicesConfigList();
  }
}

window.renderServicesConfigList = function() {
  const container = document.getElementById("scListContainer");
  if (!container) return;

  const searchVal = document.getElementById("inpScSearch")?.value.toLowerCase().trim() || "";

  const filtered = cachedServicesCatalog.filter(s => {
    // Type filter
    if (activeScFilter === "MRT" && s.type !== "MRT") return false;
    if (activeScFilter === "MSKT" && s.type !== "MSKT") return false;
    if (activeScFilter === "CONTRAST" && !s.isContrast) return false;

    // Search filter
    if (searchVal) {
      const name = (s.name || "").toLowerCase();
      const code = (s.code || "").toLowerCase();
      if (!name.includes(searchVal) && !code.includes(searchVal)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="color:#94a3b8; text-align:center; padding:30px; font-size:13px;">Mos keluvchi tekshiruv topilmadi.</div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const customDur = laborantPreferences.testDurations?.[s.code] ?? s.duration ?? 25;
    const customPrep = laborantPreferences.servicePreparations?.[s.code] ?? s.preparation ?? "";
    const customContra = laborantPreferences.serviceContraindications?.[s.code] ?? s.contraindications ?? "";
    const chosenQSet = selectedQuestionsMap[s.code] || new Set();

    const typeBadgeClass = s.type === "MSKT" ? "mskt" : "mrt";

    // Build question chips (all available questions)
    const chipsHtml = allConsentQuestions.map(q => {
      const isSelected = chosenQSet.has(q.id);
      return `
        <span class="sc-q-chip ${isSelected ? 'selected' : ''}" onclick="toggleServiceQuestion('${s.code}', '${q.id}', this)" title="${escapeHtml(q.text)}">
          <i class="fa-solid ${isSelected ? 'fa-check-circle' : 'fa-circle-plus'}"></i>
          ${escapeHtml(q.text.length > 38 ? q.text.substring(0, 38) + '...' : q.text)}
        </span>
      `;
    }).join("");

    return `
      <div class="sc-item-card" id="sc_card_${s.code}">
        <div class="sc-card-top">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="sc-code-badge">${escapeHtml(s.code)}</span>
            <strong style="font-size:13.5px; color:#f8fafc;">${escapeHtml(s.name)}</strong>
            <span class="sc-type-badge ${typeBadgeClass}">${s.type || 'MRT'}</span>
            ${s.isContrast ? '<span class="mini-contrast-badge" style="font-size:10px;">💉 Kontrast</span>' : ''}
          </div>
          <small style="color:#94a3b8; font-size:11px;">Standart: <strong>${s.duration || 25}</strong> daq</small>
        </div>

        <div class="sc-grid-fields">
          <div class="sc-field-box">
            <label><i class="fa-solid fa-stopwatch"></i> Laborant Vaqti (daq):</label>
            <input type="number" min="5" max="180" id="sc_dur_${s.code}" value="${customDur}">
          </div>

          <div class="sc-field-box">
            <label><i class="fa-solid fa-list-ul"></i> Tayyorgarlik Qoidasi:</label>
            <textarea id="sc_prep_${s.code}" rows="2" placeholder="Masalan: 4 soat och qolish, qon tahlili...">${escapeHtml(customPrep)}</textarea>
          </div>

          <div class="sc-field-box">
            <label><i class="fa-solid fa-ban"></i> Qarshi Ko'rsatmalar:</label>
            <textarea id="sc_contra_${s.code}" rows="2" placeholder="Masalan: Kardiostimulyator, buyrak yetishmovchiligi...">${escapeHtml(customContra)}</textarea>
          </div>
        </div>

        <div class="sc-field-box" style="margin-top:2px;">
          <label><i class="fa-solid fa-clipboard-question"></i> Rozilik Anketasiga Alohida Bog'lanadigan Savollar (${chosenQSet.size} ta tanlangan):</label>
          <div class="sc-q-chips-wrap">
            ${chipsHtml}
          </div>
        </div>

        <div class="sc-card-actions">
          <span style="margin-right:auto; font-size:11px; color:#64748b;">
            <i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Boshqa tekshiruvlar bilan birlashganda takrorlanmaydi
          </span>
          <button type="button" class="btn-sc-save-single" onclick="saveSingleServiceConfig('${s.code}')">
            <i class="fa-solid fa-check"></i> Saqlash
          </button>
        </div>
      </div>
    `;
  }).join("");
};

window.toggleServiceQuestion = function(serviceCode, questionId, chipEl) {
  if (!selectedQuestionsMap[serviceCode]) selectedQuestionsMap[serviceCode] = new Set();
  const qSet = selectedQuestionsMap[serviceCode];

  if (qSet.has(questionId)) {
    qSet.delete(questionId);
    if (chipEl) {
      chipEl.classList.remove("selected");
      const icon = chipEl.querySelector("i");
      if (icon) icon.className = "fa-solid fa-circle-plus";
    }
  } else {
    qSet.add(questionId);
    if (chipEl) {
      chipEl.classList.add("selected");
      const icon = chipEl.querySelector("i");
      if (icon) icon.className = "fa-solid fa-check-circle";
    }
  }
};

window.saveSingleServiceConfig = async function(serviceCode) {
  const durVal = document.getElementById("sc_dur_" + serviceCode)?.value;
  const prepVal = document.getElementById("sc_prep_" + serviceCode)?.value;
  const contraVal = document.getElementById("sc_contra_" + serviceCode)?.value;
  const qIds = Array.from(selectedQuestionsMap[serviceCode] || []);

  const payload = {
    serviceCode: serviceCode,
    duration: durVal ? parseInt(durVal, 10) : undefined,
    preparation: prepVal !== undefined ? prepVal.trim() : "",
    contraindications: contraVal !== undefined ? contraVal.trim() : "",
    consentQuestionIds: qIds,
    updateCatalog: true
  };

  const res = await postAPI("/api/laborant/services-config", payload);
  if (res && res.success) {
    if (res.userPreferences) laborantPreferences = res.userPreferences;
    alert(`✅ [${serviceCode}] tekshiruvi sozlamalari muvaffaqiyatli saqlandi!`);
  } else {
    alert("Xatolik: " + (res?.error || "Saqlab bo'lmadi"));
  }
};

window.saveAllPendingServices = async function() {
  const cards = document.querySelectorAll(".sc-item-card");
  if (cards.length === 0) return;

  let savedCount = 0;
  for (const card of cards) {
    const code = card.id.replace("sc_card_", "");
    const durVal = document.getElementById("sc_dur_" + code)?.value;
    const prepVal = document.getElementById("sc_prep_" + code)?.value;
    const contraVal = document.getElementById("sc_contra_" + code)?.value;
    const qIds = Array.from(selectedQuestionsMap[code] || []);

    const payload = {
      serviceCode: code,
      duration: durVal ? parseInt(durVal, 10) : undefined,
      preparation: prepVal !== undefined ? prepVal.trim() : "",
      contraindications: contraVal !== undefined ? contraVal.trim() : "",
      consentQuestionIds: qIds,
      updateCatalog: true
    };

    const res = await postAPI("/api/laborant/services-config", payload);
    if (res && res.success) {
      savedCount++;
      if (res.userPreferences) laborantPreferences = res.userPreferences;
    }
  }

  alert(`✅ Barcha ${savedCount} ta tekshiruv sozlamalari muvaffaqiyatli saqlandi!`);
  closeServicesConfigModal();
};
