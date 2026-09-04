/**
 * Mustaqil Navbatga Yozish Portali - Client Script (navbat-yozish/app.js)
 */

let ws = null;
let servicesList = [];
let selectedServices = [];
let todayQueue = [];
let lastAddedPatient = null;

document.addEventListener("DOMContentLoaded", () => {
  initEventListeners();
  loadServicesCatalog();
  fetchQueue();
  connectWebSocket();
  updateCalculationsPreview();
});

function initEventListeners() {
  document.getElementById("patientQueueForm").addEventListener("submit", handleFormSubmit);
  document.getElementById("inpSearchService").addEventListener("input", handleServiceSearch);
  document.getElementById("chkIsContrast").addEventListener("change", updateCalculationsPreview);
  document.getElementById("selectTargetDevice").addEventListener("change", updateCalculationsPreview);

  document.getElementById("btnPrintLastTicket").addEventListener("click", () => {
    if (lastAddedPatient) printTicket(lastAddedPatient);
  });

  document.getElementById("filterDevice").addEventListener("change", renderQueueTable);
  document.getElementById("btnRefreshQueue").addEventListener("click", fetchQueue);
}

// -------------------------------------------------------------
// XIZMATLAR KATALOGI VA QIDIRUV
// -------------------------------------------------------------
async function loadServicesCatalog() {
  try {
    const res = await fetch("/api/services");
    const data = await res.json();
    const list = data.catalog || data.services || [];
    if (Array.isArray(list)) {
      servicesList = list;
      renderServicesList(servicesList);
    }
  } catch (e) {
    console.error("Xizmatlar yuklanmadi:", e);
  }
}

function renderServicesList(list, query = "") {
  const container = document.getElementById("servicesCatalogContainer");
  if (!container) return;

  const filtered = list.filter(item => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (item.code || "").toLowerCase().includes(q) || (item.name || "").toLowerCase().includes(q);
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:15px; color:#64748b; font-size:12px;">Xizmat topilmadi</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => {
    const code = item.code;
    const isChecked = selectedServices.some(s => s.code === code);
    const priceText = item.priceFormatted ? item.priceFormatted : (item.price ? `${item.price.toLocaleString()} so'm` : '');
    return `
      <div class="service-item-row ${isChecked ? 'selected' : ''}" onclick="toggleService('${code}')">
        <div class="service-item-left">
          <input type="checkbox" id="chk_srv_${code}" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); toggleService('${code}')">
          <span class="srv-code">${code}</span>
          <span class="srv-name">${escapeHtml(item.name)}</span>
          ${item.isContrast ? '<span class="srv-contrast-badge">💉 Kontrast</span>' : ''}
        </div>
        <div class="service-item-right" style="display:flex; align-items:center; gap:12px;">
          ${priceText ? `<span style="font-size:11px; color:#34d399; font-weight:700;">${priceText}</span>` : ''}
          <span style="font-size:11.5px; color:#94a3b8; font-family:monospace;">${item.duration} daqiqa</span>
        </div>
      </div>
    `;
  }).join("");
}

function handleServiceSearch(e) {
  const q = e.target.value.trim();
  renderServicesList(servicesList, q);
}

window.toggleService = function(code) {
  if (!code) return;
  const item = servicesList.find(s => s.code === code);
  if (!item) return;

  const existingIdx = selectedServices.findIndex(s => s.code === code);
  if (existingIdx > -1) {
    // Tanlangan bo'lsa -> ro'yxatdan olib tashlaymiz (uncheck)
    selectedServices.splice(existingIdx, 1);
  } else {
    // Tanlanmagan bo'lsa -> FAQAT 1 MARTA QO'SHAMIZ (takrorlanish mutlaqo bo'lmaydi!)
    selectedServices.push(item);
  }

  // Checkbox holatini yangilash
  const chk = document.getElementById(`chk_srv_${code}`);
  if (chk) chk.checked = selectedServices.some(s => s.code === code);

  // Qatordagi 'selected' klassini yangilash
  const rows = document.querySelectorAll(".service-item-row");
  rows.forEach(r => {
    const input = r.querySelector("input[type='checkbox']");
    if (input && input.id === `chk_srv_${code}`) {
      if (selectedServices.some(s => s.code === code)) {
        r.classList.add("selected");
      } else {
        r.classList.remove("selected");
      }
    }
  });

  // Agar kontrastli tekshiruv tanlansa, avtomatik kontrast checkboxini yoqish
  const hasContrast = selectedServices.some(s => s.isContrast);
  const chkContrast = document.getElementById("chkIsContrast");
  if (chkContrast) {
    chkContrast.checked = hasContrast;
  }

  // Tanlanganlar hisoblagichi
  const txtCount = document.getElementById("txtSelectedCount");
  if (txtCount) {
    txtCount.innerText = selectedServices.length > 0 
      ? `Tanlangan xizmatlar: ${selectedServices.length} ta xizmat tanlandi`
      : "Tanlangan xizmatlar: 0 ta";
  }

  updateCalculationsPreview();
};

// -------------------------------------------------------------
// HISOB-KITOBLAR VA LIVE PREVIEW
// -------------------------------------------------------------
let previewDebounceTimer = null;

function updateCalculationsPreview() {
  const targetDevVal = document.getElementById("selectTargetDevice") ? document.getElementById("selectTargetDevice").value : "auto";
  const hasContrast = document.getElementById("chkIsContrast") ? document.getElementById("chkIsContrast").checked : false;

  const srvList = selectedServices.length > 0
    ? selectedServices
    : [{ name: "MRT Tekshiruvi", code: "R157", duration: 30 }];

  // Boshlang'ich taxminiy hisob-kitob
  let totalMinutes = 0;
  if (selectedServices.length === 0) {
    totalMinutes = 30;
  } else {
    selectedServices.forEach((s, idx) => {
      totalMinutes += idx === 0 ? (s.duration || 25) : Math.round((s.duration || 25) * 0.75);
    });
  }
  const durEl = document.getElementById("prevDuration");
  if (durEl) durEl.innerText = `${totalMinutes} daqiqa`;

  const devEl = document.getElementById("prevDevice");
  let fallbackDevName = "Aqlli Taqsimlash";
  if (targetDevVal === "mrt1" || (targetDevVal === "auto" && hasContrast)) fallbackDevName = "1-MRT (1.5 T)";
  else if (targetDevVal === "mrt2") fallbackDevName = "2-MRT (3.0 T)";
  else if (targetDevVal === "mskt1") fallbackDevName = "1-MSKT";
  if (devEl) devEl.innerText = fallbackDevName;

  // Aqlli taqsimlash algoritmi orqali eng yaqin aniq bo'sh soatni hisoblash
  clearTimeout(previewDebounceTimer);
  previewDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch("/api/queue/smart-slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: srvList,
          deviceId: targetDevVal !== "auto" ? targetDevVal : null,
          isContrast: hasContrast
        })
      });

      const data = await res.json();
      if (data && data.success && data.slot) {
        const slot = data.slot;

        if (durEl) durEl.innerText = `${slot.durationMinutes} daqiqa`;
        if (devEl) {
          const devMap = { mrt1: "1-MRT (1.5 T)", mrt2: "2-MRT (3.0 T)", mskt1: "1-MSKT" };
          devEl.innerText = devMap[slot.deviceId] || slot.deviceId.toUpperCase();
        }

        const startEl = document.getElementById("prevStartTime");
        if (startEl) {
          const dateTxt = slot.scheduledDateFormatted ? `${slot.scheduledDateFormatted}, ` : '';
          startEl.innerHTML = `<span style="color:#38bdf8; font-weight:800; font-size:14px;">${dateTxt}${slot.startTime}</span> <small style="color:#94a3b8; font-size:11px; font-weight:600;">(${slot.finishTime} gacha)</small>`;
        }

        const prepEl = document.getElementById("prevPrepTime");
        if (prepEl) {
          // Tayyorgarlik vaqti: tekshiruvdan 15 daqiqa oldin
          const [sh, sm] = slot.startTime.split(':').map(Number);
          let prepTotal = sh * 60 + sm - 15;
          if (prepTotal < 0) prepTotal = 0;
          const ph = String(Math.floor(prepTotal / 60)).padStart(2, '0');
          const pm = String(prepTotal % 60).padStart(2, '0');
          prepEl.innerHTML = `<span style="color:#fbbf24; font-weight:800; font-size:14px;">${ph}:${pm}</span> <small style="color:#94a3b8; font-size:10.5px; font-weight:600;">(15 daq oldin)</small>`;
        }
      }
    } catch (e) {
      console.warn("Smart slot preview xatosi:", e);
    }
  }, 80);
}

// -------------------------------------------------------------
// FORM SUBMISSION (BEMORNI NAVBATGA QO'YISH)
// -------------------------------------------------------------
async function handleFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById("inpPatientName").value.trim();
  const id = document.getElementById("inpPatientId").value.trim();
  const sampleNumber = document.getElementById("inpSampleNumber") ? document.getElementById("inpSampleNumber").value.trim() : "";
  const phone = document.getElementById("inpPhone").value.trim();
  const birthDate = document.getElementById("inpBirthDate").value;
  const doctor = document.getElementById("inpDoctor").value.trim();
  const targetDev = document.getElementById("selectTargetDevice").value;
  const isContrast = document.getElementById("chkIsContrast").checked;

  if (!name) {
    alert("Iltimos, bemor F.I.Sh ni kiriting!");
    return;
  }

  // Namuna raqami bo'yicha takroriylikni tekshirish
  if (sampleNumber) {
    const existing = todayQueue.find(p => p.sampleNumber && String(p.sampleNumber).trim() === sampleNumber && p.status !== 'cancelled');
    if (existing) {
      alert(`⚠️ DIQQAT!\n\nUshbu tekshiruv (Namuna №${sampleNumber}) allaqachon navbatga qo'yilgan!\nNavbat raqami: #${existing.ticketNumber}\nBemor: ${existing.patientName} (${existing.estimatedStartTimeFormatted || ''})`);
      return;
    }
  }

  const srvList = selectedServices.length > 0 ? selectedServices : [{ name: "MRT Tekshiruvi", code: "R157", duration: 30 }];

  const payload = {
    patientName: name,
    patientId: id,
    sampleNumber: sampleNumber,
    phone: phone,
    birthDate: birthDate,
    referringDoctor: doctor,
    deviceId: targetDev !== "auto" ? targetDev : null,
    isContrast: isContrast,
    services: srvList,
    operatorName: window.currentUser ? window.currentUser.name : "Operator"
  };

  const btnSubmit = document.getElementById("btnSubmitPatient");
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...`;

  try {
    const res = await fetch("/api/queue/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.success && data.patient) {
      lastAddedPatient = data.patient;
      document.getElementById("btnPrintLastTicket").disabled = false;

      alert(`✅ Bemor muvaffaqiyatli navbatga olindi!\n\n🎫 Raqam: ${data.patient.ticketNumber}\n👤 Bemor: ${data.patient.patientName}\n🧲 Xona: ${data.patient.deviceId.toUpperCase()}\n⏱️ Boshlanish vaqti: ${data.patient.estimatedStartTimeFormatted || 'Navbatda'}`);

      // Formani tozalash
      document.getElementById("patientQueueForm").reset();
      selectedServices = [];
      document.getElementById("txtSelectedCount").innerText = "Tanlangan xizmatlar: 0 ta";
      renderServicesList(servicesList);
      updateCalculationsPreview();

      fetchQueue();
    } else {
      alert("Xatolik: " + (data.error || "Bemor qo'shilmadi"));
    }
  } catch (err) {
    alert("Server xatosi: " + err.message);
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i class="fa-solid fa-check-circle"></i> Navbatga Qo'shish`;
  }
}

// -------------------------------------------------------------
// CHIPTA CHOP ETISH (PRINT THERMAL TICKET)
// -------------------------------------------------------------
const TELEGRAM_RONS_QR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="115" height="115" style="display:block; margin:0 auto;"><rect style="fill:#ffffff" x="0" y="0" width="100" height="100" /><path style="fill:#000000" d="M 0,0 l 4,0 0,4 -4,0 z M 4,0 l 4,0 0,4 -4,0 z M 8,0 l 4,0 0,4 -4,0 z M 12,0 l 4,0 0,4 -4,0 z M 16,0 l 4,0 0,4 -4,0 z M 20,0 l 4,0 0,4 -4,0 z M 24,0 l 4,0 0,4 -4,0 z M 36,0 l 4,0 0,4 -4,0 z M 48,0 l 4,0 0,4 -4,0 z M 52,0 l 4,0 0,4 -4,0 z M 72,0 l 4,0 0,4 -4,0 z M 76,0 l 4,0 0,4 -4,0 z M 80,0 l 4,0 0,4 -4,0 z M 84,0 l 4,0 0,4 -4,0 z M 88,0 l 4,0 0,4 -4,0 z M 92,0 l 4,0 0,4 -4,0 z M 96,0 l 4,0 0,4 -4,0 z M 0,4 l 4,0 0,4 -4,0 z M 24,4 l 4,0 0,4 -4,0 z M 32,4 l 4,0 0,4 -4,0 z M 48,4 l 4,0 0,4 -4,0 z M 56,4 l 4,0 0,4 -4,0 z M 60,4 l 4,0 0,4 -4,0 z M 64,4 l 4,0 0,4 -4,0 z M 72,4 l 4,0 0,4 -4,0 z M 96,4 l 4,0 0,4 -4,0 z M 0,8 l 4,0 0,4 -4,0 z M 8,8 l 4,0 0,4 -4,0 z M 12,8 l 4,0 0,4 -4,0 z M 16,8 l 4,0 0,4 -4,0 z M 24,8 l 4,0 0,4 -4,0 z M 40,8 l 4,0 0,4 -4,0 z M 44,8 l 4,0 0,4 -4,0 z M 60,8 l 4,0 0,4 -4,0 z M 64,8 l 4,0 0,4 -4,0 z M 72,8 l 4,0 0,4 -4,0 z M 80,8 l 4,0 0,4 -4,0 z M 84,8 l 4,0 0,4 -4,0 z M 88,8 l 4,0 0,4 -4,0 z M 96,8 l 4,0 0,4 -4,0 z M 0,12 l 4,0 0,4 -4,0 z M 8,12 l 4,0 0,4 -4,0 z M 12,12 l 4,0 0,4 -4,0 z M 16,12 l 4,0 0,4 -4,0 z M 24,12 l 4,0 0,4 -4,0 z M 44,12 l 4,0 0,4 -4,0 z M 48,12 l 4,0 0,4 -4,0 z M 60,12 l 4,0 0,4 -4,0 z M 64,12 l 4,0 0,4 -4,0 z M 72,12 l 4,0 0,4 -4,0 z M 80,12 l 4,0 0,4 -4,0 z M 84,12 l 4,0 0,4 -4,0 z M 88,12 l 4,0 0,4 -4,0 z M 96,12 l 4,0 0,4 -4,0 z M 0,16 l 4,0 0,4 -4,0 z M 8,16 l 4,0 0,4 -4,0 z M 12,16 l 4,0 0,4 -4,0 z M 16,16 l 4,0 0,4 -4,0 z M 24,16 l 4,0 0,4 -4,0 z M 32,16 l 4,0 0,4 -4,0 z M 36,16 l 4,0 0,4 -4,0 z M 48,16 l 4,0 0,4 -4,0 z M 60,16 l 4,0 0,4 -4,0 z M 72,16 l 4,0 0,4 -4,0 z M 80,16 l 4,0 0,4 -4,0 z M 84,16 l 4,0 0,4 -4,0 z M 88,16 l 4,0 0,4 -4,0 z M 96,16 l 4,0 0,4 -4,0 z M 0,20 l 4,0 0,4 -4,0 z M 24,20 l 4,0 0,4 -4,0 z M 36,20 l 4,0 0,4 -4,0 z M 40,20 l 4,0 0,4 -4,0 z M 48,20 l 4,0 0,4 -4,0 z M 60,20 l 4,0 0,4 -4,0 z M 72,20 l 4,0 0,4 -4,0 z M 96,20 l 4,0 0,4 -4,0 z M 0,24 l 4,0 0,4 -4,0 z M 4,24 l 4,0 0,4 -4,0 z M 8,24 l 4,0 0,4 -4,0 z M 12,24 l 4,0 0,4 -4,0 z M 16,24 l 4,0 0,4 -4,0 z M 20,24 l 4,0 0,4 -4,0 z M 24,24 l 4,0 0,4 -4,0 z M 32,24 l 4,0 0,4 -4,0 z M 40,24 l 4,0 0,4 -4,0 z M 48,24 l 4,0 0,4 -4,0 z M 56,24 l 4,0 0,4 -4,0 z M 64,24 l 4,0 0,4 -4,0 z M 72,24 l 4,0 0,4 -4,0 z M 76,24 l 4,0 0,4 -4,0 z M 80,24 l 4,0 0,4 -4,0 z M 84,24 l 4,0 0,4 -4,0 z M 88,24 l 4,0 0,4 -4,0 z M 92,24 l 4,0 0,4 -4,0 z M 96,24 l 4,0 0,4 -4,0 z M 44,28 l 4,0 0,4 -4,0 z M 48,28 l 4,0 0,4 -4,0 z M 52,28 l 4,0 0,4 -4,0 z M 64,28 l 4,0 0,4 -4,0 z M 0,32 l 4,0 0,4 -4,0 z M 8,32 l 4,0 0,4 -4,0 z M 16,32 l 4,0 0,4 -4,0 z M 24,32 l 4,0 0,4 -4,0 z M 36,32 l 4,0 0,4 -4,0 z M 40,32 l 4,0 0,4 -4,0 z M 52,32 l 4,0 0,4 -4,0 z M 56,32 l 4,0 0,4 -4,0 z M 60,32 l 4,0 0,4 -4,0 z M 64,32 l 4,0 0,4 -4,0 z M 80,32 l 4,0 0,4 -4,0 z M 88,32 l 4,0 0,4 -4,0 z M 96,32 l 4,0 0,4 -4,0 z M 0,36 l 4,0 0,4 -4,0 z M 4,36 l 4,0 0,4 -4,0 z M 8,36 l 4,0 0,4 -4,0 z M 12,36 l 4,0 0,4 -4,0 z M 20,36 l 4,0 0,4 -4,0 z M 28,36 l 4,0 0,4 -4,0 z M 32,36 l 4,0 0,4 -4,0 z M 36,36 l 4,0 0,4 -4,0 z M 44,36 l 4,0 0,4 -4,0 z M 52,36 l 4,0 0,4 -4,0 z M 56,36 l 4,0 0,4 -4,0 z M 64,36 l 4,0 0,4 -4,0 z M 68,36 l 4,0 0,4 -4,0 z M 72,36 l 4,0 0,4 -4,0 z M 76,36 l 4,0 0,4 -4,0 z M 96,36 l 4,0 0,4 -4,0 z M 0,40 l 4,0 0,4 -4,0 z M 12,40 l 4,0 0,4 -4,0 z M 16,40 l 4,0 0,4 -4,0 z M 24,40 l 4,0 0,4 -4,0 z M 28,40 l 4,0 0,4 -4,0 z M 36,40 l 4,0 0,4 -4,0 z M 56,40 l 4,0 0,4 -4,0 z M 68,40 l 4,0 0,4 -4,0 z M 80,40 l 4,0 0,4 -4,0 z M 88,40 l 4,0 0,4 -4,0 z M 92,40 l 4,0 0,4 -4,0 z M 96,40 l 4,0 0,4 -4,0 z M 4,44 l 4,0 0,4 -4,0 z M 16,44 l 4,0 0,4 -4,0 z M 36,44 l 4,0 0,4 -4,0 z M 40,44 l 4,0 0,4 -4,0 z M 44,44 l 4,0 0,4 -4,0 z M 52,44 l 4,0 0,4 -4,0 z M 64,44 l 4,0 0,4 -4,0 z M 68,44 l 4,0 0,4 -4,0 z M 72,44 l 4,0 0,4 -4,0 z M 92,44 l 4,0 0,4 -4,0 z M 4,48 l 4,0 0,4 -4,0 z M 8,48 l 4,0 0,4 -4,0 z M 12,48 l 4,0 0,4 -4,0 z M 16,48 l 4,0 0,4 -4,0 z M 24,48 l 4,0 0,4 -4,0 z M 28,48 l 4,0 0,4 -4,0 z M 36,48 l 4,0 0,4 -4,0 z M 40,48 l 4,0 0,4 -4,0 z M 52,48 l 4,0 0,4 -4,0 z M 56,48 l 4,0 0,4 -4,0 z M 60,48 l 4,0 0,4 -4,0 z M 64,48 l 4,0 0,4 -4,0 z M 68,48 l 4,0 0,4 -4,0 z M 72,48 l 4,0 0,4 -4,0 z M 76,48 l 4,0 0,4 -4,0 z M 84,48 l 4,0 0,4 -4,0 z M 92,48 l 4,0 0,4 -4,0 z M 96,48 l 4,0 0,4 -4,0 z M 4,52 l 4,0 0,4 -4,0 z M 12,52 l 4,0 0,4 -4,0 z M 16,52 l 4,0 0,4 -4,0 z M 28,52 l 4,0 0,4 -4,0 z M 32,52 l 4,0 0,4 -4,0 z M 36,52 l 4,0 0,4 -4,0 z M 44,52 l 4,0 0,4 -4,0 z M 52,52 l 4,0 0,4 -4,0 z M 56,52 l 4,0 0,4 -4,0 z M 64,52 l 4,0 0,4 -4,0 z M 68,52 l 4,0 0,4 -4,0 z M 72,52 l 4,0 0,4 -4,0 z M 84,52 l 4,0 0,4 -4,0 z M 96,52 l 4,0 0,4 -4,0 z M 0,56 l 4,0 0,4 -4,0 z M 8,56 l 4,0 0,4 -4,0 z M 16,56 l 4,0 0,4 -4,0 z M 20,56 l 4,0 0,4 -4,0 z M 24,56 l 4,0 0,4 -4,0 z M 28,56 l 4,0 0,4 -4,0 z M 36,56 l 4,0 0,4 -4,0 z M 40,56 l 4,0 0,4 -4,0 z M 52,56 l 4,0 0,4 -4,0 z M 56,56 l 4,0 0,4 -4,0 z M 64,56 l 4,0 0,4 -4,0 z M 68,56 l 4,0 0,4 -4,0 z M 76,56 l 4,0 0,4 -4,0 z M 88,56 l 4,0 0,4 -4,0 z M 92,56 l 4,0 0,4 -4,0 z M 96,56 l 4,0 0,4 -4,0 z M 4,60 l 4,0 0,4 -4,0 z M 8,60 l 4,0 0,4 -4,0 z M 12,60 l 4,0 0,4 -4,0 z M 20,60 l 4,0 0,4 -4,0 z M 36,60 l 4,0 0,4 -4,0 z M 44,60 l 4,0 0,4 -4,0 z M 52,60 l 4,0 0,4 -4,0 z M 80,60 l 4,0 0,4 -4,0 z M 92,60 l 4,0 0,4 -4,0 z M 0,64 l 4,0 0,4 -4,0 z M 8,64 l 4,0 0,4 -4,0 z M 12,64 l 4,0 0,4 -4,0 z M 24,64 l 4,0 0,4 -4,0 z M 28,64 l 4,0 0,4 -4,0 z M 36,64 l 4,0 0,4 -4,0 z M 48,64 l 4,0 0,4 -4,0 z M 52,64 l 4,0 0,4 -4,0 z M 56,64 l 4,0 0,4 -4,0 z M 64,64 l 4,0 0,4 -4,0 z M 68,64 l 4,0 0,4 -4,0 z M 72,64 l 4,0 0,4 -4,0 z M 76,64 l 4,0 0,4 -4,0 z M 80,64 l 4,0 0,4 -4,0 z M 84,64 l 4,0 0,4 -4,0 z M 32,68 l 4,0 0,4 -4,0 z M 36,68 l 4,0 0,4 -4,0 z M 44,68 l 4,0 0,4 -4,0 z M 48,68 l 4,0 0,4 -4,0 z M 52,68 l 4,0 0,4 -4,0 z M 56,68 l 4,0 0,4 -4,0 z M 64,68 l 4,0 0,4 -4,0 z M 80,68 l 4,0 0,4 -4,0 z M 84,68 l 4,0 0,4 -4,0 z M 92,68 l 4,0 0,4 -4,0 z M 96,68 l 4,0 0,4 -4,0 z M 0,72 l 4,0 0,4 -4,0 z M 4,72 l 4,0 0,4 -4,0 z M 8,72 l 4,0 0,4 -4,0 z M 12,72 l 4,0 0,4 -4,0 z M 16,72 l 4,0 0,4 -4,0 z M 20,72 l 4,0 0,4 -4,0 z M 24,72 l 4,0 0,4 -4,0 z M 44,72 l 4,0 0,4 -4,0 z M 48,72 l 4,0 0,4 -4,0 z M 52,72 l 4,0 0,4 -4,0 z M 60,72 l 4,0 0,4 -4,0 z M 64,72 l 4,0 0,4 -4,0 z M 72,72 l 4,0 0,4 -4,0 z M 80,72 l 4,0 0,4 -4,0 z M 84,72 l 4,0 0,4 -4,0 z M 92,72 l 4,0 0,4 -4,0 z M 96,72 l 4,0 0,4 -4,0 z M 0,76 l 4,0 0,4 -4,0 z M 24,76 l 4,0 0,4 -4,0 z M 36,76 l 4,0 0,4 -4,0 z M 40,76 l 4,0 0,4 -4,0 z M 48,76 l 4,0 0,4 -4,0 z M 52,76 l 4,0 0,4 -4,0 z M 64,76 l 4,0 0,4 -4,0 z M 80,76 l 4,0 0,4 -4,0 z M 84,76 l 4,0 0,4 -4,0 z M 92,76 l 4,0 0,4 -4,0 z M 96,76 l 4,0 0,4 -4,0 z M 0,80 l 4,0 0,4 -4,0 z M 8,80 l 4,0 0,4 -4,0 z M 12,80 l 4,0 0,4 -4,0 z M 16,80 l 4,0 0,4 -4,0 z M 24,80 l 4,0 0,4 -4,0 z M 32,80 l 4,0 0,4 -4,0 z M 36,80 l 4,0 0,4 -4,0 z M 44,80 l 4,0 0,4 -4,0 z M 56,80 l 4,0 0,4 -4,0 z M 64,80 l 4,0 0,4 -4,0 z M 68,80 l 4,0 0,4 -4,0 z M 72,80 l 4,0 0,4 -4,0 z M 76,80 l 4,0 0,4 -4,0 z M 80,80 l 4,0 0,4 -4,0 z M 84,80 l 4,0 0,4 -4,0 z M 92,80 l 4,0 0,4 -4,0 z M 96,80 l 4,0 0,4 -4,0 z M 0,84 l 4,0 0,4 -4,0 z M 8,84 l 4,0 0,4 -4,0 z M 12,84 l 4,0 0,4 -4,0 z M 16,84 l 4,0 0,4 -4,0 z M 24,84 l 4,0 0,4 -4,0 z M 36,84 l 4,0 0,4 -4,0 z M 40,84 l 4,0 0,4 -4,0 z M 44,84 l 4,0 0,4 -4,0 z M 64,84 l 4,0 0,4 -4,0 z M 76,84 l 4,0 0,4 -4,0 z M 80,84 l 4,0 0,4 -4,0 z M 84,84 l 4,0 0,4 -4,0 z M 88,84 l 4,0 0,4 -4,0 z M 0,88 l 4,0 0,4 -4,0 z M 8,88 l 4,0 0,4 -4,0 z M 12,88 l 4,0 0,4 -4,0 z M 16,88 l 4,0 0,4 -4,0 z M 24,88 l 4,0 0,4 -4,0 z M 40,88 l 4,0 0,4 -4,0 z M 52,88 l 4,0 0,4 -4,0 z M 60,88 l 4,0 0,4 -4,0 z M 80,88 l 4,0 0,4 -4,0 z M 96,88 l 4,0 0,4 -4,0 z M 0,92 l 4,0 0,4 -4,0 z M 24,92 l 4,0 0,4 -4,0 z M 32,92 l 4,0 0,4 -4,0 z M 44,92 l 4,0 0,4 -4,0 z M 60,92 l 4,0 0,4 -4,0 z M 64,92 l 4,0 0,4 -4,0 z M 80,92 l 4,0 0,4 -4,0 z M 84,92 l 4,0 0,4 -4,0 z M 92,92 l 4,0 0,4 -4,0 z M 0,96 l 4,0 0,4 -4,0 z M 4,96 l 4,0 0,4 -4,0 z M 8,96 l 4,0 0,4 -4,0 z M 12,96 l 4,0 0,4 -4,0 z M 16,96 l 4,0 0,4 -4,0 z M 20,96 l 4,0 0,4 -4,0 z M 24,96 l 4,0 0,4 -4,0 z M 36,96 l 4,0 0,4 -4,0 z M 40,96 l 4,0 0,4 -4,0 z M 48,96 l 4,0 0,4 -4,0 z M 64,96 l 4,0 0,4 -4,0 z M 68,96 l 4,0 0,4 -4,0 z M 72,96 l 4,0 0,4 -4,0 z M 76,96 l 4,0 0,4 -4,0 z M 92,96 l 4,0 0,4 -4,0 z M 96,96 l 4,0 0,4 -4,0 z" /></svg>`;

function printTicket(patient) {
  if (!patient) return;
  if (window.parent && typeof window.parent.printThermalTicket === 'function') {
    window.parent.printThermalTicket(patient);
    return;
  }
  const printWindow = window.open('', '_blank', 'width=380,height=640');
  if (!printWindow) {
    window.print();
    return;
  }
  const patientIdDisplay = String(patient.patientId || patient.id || patient.cardNo || '').trim();
  const dateStr = patient.date || new Date().toISOString().split('T')[0];
  const parts = dateStr.split('-');
  const dd = parts[2] ? parts[2].padStart(2, '0') : String(new Date().getDate()).padStart(2, '0');
  const mm = parts[1] ? parts[1].padStart(2, '0') : String(new Date().getMonth() + 1).padStart(2, '0');
  const yyyy = parts[0] || new Date().getFullYear();
  const fullDateDisplay = `${dd}.${mm}.${yyyy}`;

  let devCode = "MR1";
  const devId = String(patient.deviceId || "").toLowerCase();
  if (devId.includes("mrt2") || devId.includes("mr2")) devCode = "MR2";
  else if (devId.includes("mskt") || devId.includes("kt") || patient.deviceType === "MSKT") devCode = "KT1";

  const rawNum = String(patient.ticketNumber || '001').replace(/[^0-9]/g, '');
  const seqStr = (rawNum || '1').padStart(3, '0');
  const fullTicketNumber = `${dd}-${mm}-${devCode}-${seqStr}`;

  let timeStr = patient.scheduledTime || '';
  if (!timeStr && patient.estimatedStartTime) {
    if (patient.estimatedStartTime.includes('T')) {
      try {
        const dt = new Date(patient.estimatedStartTime);
        if (!isNaN(dt.getTime())) timeStr = dt.toTimeString().substring(0, 5);
      } catch(e) {}
    } else {
      const m = patient.estimatedStartTime.match(/\d{1,2}:\d{2}/);
      if (m) timeStr = m[0];
    }
  }
  if (!timeStr && patient.estimatedStartTimeFormatted) {
    timeStr = patient.estimatedStartTimeFormatted;
  }
  if (!timeStr) timeStr = '--:--';
  if (patient.finishTime && !timeStr.includes('–') && !timeStr.includes('-')) {
    timeStr += ` – ${patient.finishTime}`;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chipta #${fullTicketNumber}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 800; }
        body {
          font-family: 'Arial', 'Helvetica', 'Segoe UI', sans-serif;
          width: 72mm; margin: 0 auto; padding: 2mm 1mm 4mm 1mm;
          color: #000000 !important; background: #ffffff !important;
          font-size: 12.5px; line-height: 1.35; font-weight: 800;
        }
        .header { text-align: center; font-weight: 900; font-size: 14px; line-height: 1.25; color: #000000 !important; text-transform: uppercase; margin-bottom: 4px; }
        .divider { border: none; border-top: 2.5px dashed #000000; margin: 5px 0; }
        .patient-id-box {
          text-align: center;
          margin: 6px 0 7px 0;
          padding: 5px 6px;
          border: 2.5px solid #000000;
          border-radius: 6px;
          background: #ffffff;
        }
        .patient-id-label {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #000000 !important;
          text-transform: uppercase;
        }
        .patient-id-val {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #000000 !important;
          margin-top: 2px;
          font-family: 'Arial', 'Courier New', monospace, sans-serif;
        }
        .ticket-center { text-align: center; margin: 5px 0; }
        .ticket-title { font-size: 14.5px; font-weight: 900; letter-spacing: 1px; color: #000000 !important; }
        .ticket-num { font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #000000 !important; margin: 3px 0; }
        .info-row { margin: 4px 0; font-size: 13px; color: #000000 !important; font-weight: 800; }
        .info-row b { font-weight: 900; color: #000000 !important; }
        .time-box {
          border: 2.5px solid #000000;
          border-radius: 6px;
          padding: 6px 4px;
          margin: 7px 0;
          text-align: center;
          background: #ffffff;
        }
        .time-label {
          font-size: 12.5px;
          font-weight: 900;
          letter-spacing: 0.8px;
          color: #000000 !important;
          text-transform: uppercase;
          margin-bottom: 4px;
          border-bottom: 1.5px dashed #000000;
          padding-bottom: 3px;
        }
        .time-date-row {
          margin: 4px 0 2px 0;
        }
        .time-hour-row {
          margin: 3px 0 2px 0;
        }
        .time-sub-label {
          font-size: 11px;
          font-weight: 800;
          color: #000000 !important;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .time-date-val {
          font-size: 20px;
          font-weight: 900;
          color: #000000 !important;
          letter-spacing: 0.5px;
          margin-top: 1px;
        }
        .time-hour-val {
          font-size: 24px;
          font-weight: 900;
          color: #000000 !important;
          letter-spacing: 1px;
          margin-top: 1px;
        }
        .footer-contacts { text-align: center; font-size: 12.5px; margin: 6px 0; line-height: 1.35; color: #000000 !important; font-weight: 800; }
        .qr-box {
          text-align: center;
          margin: 6px auto;
          padding: 6px 4px;
          border: 2px solid #000000;
          border-radius: 6px;
          max-width: 58mm;
          background: #ffffff;
        }
        .qr-title {
          font-size: 11.5px;
          font-weight: 900;
          text-transform: uppercase;
          color: #000000 !important;
          margin-bottom: 4px;
          line-height: 1.25;
          letter-spacing: 0.3px;
        }
        .qr-desc {
          font-size: 12px;
          font-weight: 900;
          color: #000000 !important;
          margin-top: 4px;
          letter-spacing: 0.5px;
        }
        .footer-notice { text-align: center; font-size: 13px; font-weight: 900; line-height: 1.35; margin-top: 6px; color: #000000 !important; text-transform: uppercase; }
      </style>
    </head>
    <body>
      <div class="header">RESPUBLIKA RADIOLOGIYA VA<br>ONKOLOGIYA MARKAZI</div>
      <hr class="divider">
      <div class="ticket-center">
        <div class="ticket-title">NAVBAT RAQAMI:</div>
        <div class="ticket-num">${fullTicketNumber}</div>
      </div>

      ${patientIdDisplay ? `
      <!-- BEMOR ID (KATTA RAQAMLAR) -->
      <div class="patient-id-box">
        <div class="patient-id-label">BEMOR ID:</div>
        <div class="patient-id-val">${escapeHtml(patientIdDisplay)}</div>
      </div>
      ` : ''}
      <hr class="divider">

      <div class="info-row"><b>FISH:</b> ${escapeHtml(patient.patientName)}</div>
      <div class="info-row"><b>Xizmat:</b> ${escapeHtml(patient.primaryService || 'MRT Tekshiruvi')}</div>

      <!-- QABUL SANASI VA VAQTI (ALOHIDA-ALOHIDA QATORLARDA VA KATTA) -->
      <div class="time-box">
        <div class="time-label">QABUL SANASI VA VAQTI:</div>
        <div class="time-date-row">
          <div class="time-sub-label">📅 SANA:</div>
          <div class="time-date-val">${escapeHtml(fullDateDisplay)}</div>
        </div>
        <div class="time-hour-row">
          <div class="time-sub-label">🕐 SOAT:</div>
          <div class="time-hour-val">${escapeHtml(timeStr)}</div>
        </div>
      </div>
      ${patient.isContrast ? '<div class="info-row" style="color:#000000; font-weight:900;">💉 DIQQAT: Vena ichi kontrast moddasi talab qilinadi. 15 daqiqa oldin xonaga uchrashing!</div>' : ''}
      <hr class="divider">
      <div class="footer-contacts">
        <b>Savol va takliflar uchun:</b><br>Tel: 1303<br>Telegram: @rons_2026
      </div>
      <hr class="divider">
      <!-- TELEGRAM QR KODI: https://t.me/rons_2026 -->
      <div class="qr-box">
        <div class="qr-title">📱 JAVOBLAR VA MA'LUMOT:</div>
        ${TELEGRAM_RONS_QR_SVG}
        <div class="qr-desc">Telegram: @rons_2026<br><span style="font-size:10.5px; font-weight:800;">https://t.me/rons_2026</span></div>
      </div>
      <hr class="divider">
      <div class="footer-notice">ILTIMOS, NAVBAT VAQTIDAN<br>30-40 MINUT OLDIN KELING!</div>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 300);
}

// -------------------------------------------------------------
// BUGUNGI NAVBAT JADVALI
// -------------------------------------------------------------
async function fetchQueue() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.success && data.queue) {
      todayQueue = data.queue;
      renderQueueTable();
    }
  } catch (e) {}
}

function formatQueueSlotTime(p) {
  let startTime = p.scheduledTime || '';
  let finishTime = p.finishTime || '';

  if (!startTime && p.estimatedStartTime) {
    if (p.estimatedStartTime.includes('T')) {
      try {
        const d = new Date(p.estimatedStartTime);
        if (!isNaN(d.getTime())) {
          startTime = d.toTimeString().substring(0, 5);
        }
      } catch(e) {}
    } else {
      const m = p.estimatedStartTime.match(/\d{1,2}:\d{2}/);
      if (m) startTime = m[0];
    }
  }

  if (!finishTime && p.estimatedFinishTime) {
    if (p.estimatedFinishTime.includes('T')) {
      try {
        const d = new Date(p.estimatedFinishTime);
        if (!isNaN(d.getTime())) {
          finishTime = d.toTimeString().substring(0, 5);
        }
      } catch(e) {}
    } else {
      const m = p.estimatedFinishTime.match(/\d{1,2}:\d{2}/);
      if (m) finishTime = m[0];
    }
  }

  if (!startTime && p.estimatedStartTimeFormatted) {
    return `<div style="font-size:13px; font-weight:800; color:#38bdf8;">${escapeHtml(p.estimatedStartTimeFormatted)}</div>`;
  }

  if (!startTime) {
    return `<span style="color:#64748b; font-weight:700;">--:--</span>`;
  }

  const isOtherDay = p.scheduledDate && p.scheduledDate !== new Date().toISOString().split('T')[0];

  return `
    <div style="display:flex; flex-direction:column; gap:2px;">
      <div style="font-size:13.5px; font-weight:900; color:#38bdf8; letter-spacing:0.4px; line-height:1.2; white-space:nowrap;">
        <i class="fa-regular fa-clock" style="font-size:11px; margin-right:3px; opacity:0.85;"></i>${startTime}${finishTime ? ` <span style="font-weight:700; color:#94a3b8; font-size:11.5px;">– ${finishTime}</span>` : ''}
      </div>
      ${isOtherDay ? `<div style="font-size:10px; font-weight:800; color:#a5b4fc; white-space:nowrap;"><i class="fa-regular fa-calendar"></i> ${escapeHtml(p.scheduledDate)}</div>` : ''}
    </div>
  `;
}

function renderQueueTable() {
  const tbody = document.getElementById("todayQueueTableBody");
  if (!tbody) return;

  const filter = document.getElementById("filterDevice").value;
  let list = todayQueue;
  if (filter !== "all") {
    list = list.filter(p => p.deviceId === filter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Hozircha bemorlar ro'yxatga olinmagan</td></tr>`;
    return;
  }

  const authUser = window.currentUser || (window.parent && window.parent.currentUser) || (function() {
    try {
      const u = localStorage.getItem("auth_user") || (window.parent && window.parent.localStorage ? window.parent.localStorage.getItem("auth_user") : null);
      return u ? JSON.parse(u) : null;
    } catch(e) { return null; }
  })();

  const canDelete = Boolean(
    !authUser ||
    authUser.role === 'super_admin' ||
    authUser.role === 'server_nazoratchisi' ||
    authUser.role === 'admin'
  );

  tbody.innerHTML = list.map(p => {
    const statusClass = `status-tag ${p.status}`;
    const statusMap = {
      waiting: "Kutmoqda",
      preparing: "Tayyorlanmoqda",
      calling: "Chaqirilmoqda",
      in_progress: "Xonada",
      completed: "Tugatildi",
      cancelled: "Bekor qilindi"
    };

    return `
      <tr>
        <td class="ticket-cell">${escapeHtml(p.ticketNumber)}</td>
        <td>
          <strong>${escapeHtml(p.patientName)}</strong>
          ${p.phone ? `<div style="font-size:11px; color:#9ca3af;">${p.phone}</div>` : ''}
        </td>
        <td>
          <div>${escapeHtml(p.primaryService)}</div>
          ${p.isContrast ? '<span class="srv-contrast-badge">💉 Kontrast</span>' : ''}
          ${p.consent ? `<span class="srv-contrast-badge" style="background:${p.consent.isSafe ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.2)'}; color:${p.consent.isSafe ? '#34d399' : '#f87171'}; border:1px solid ${p.consent.isSafe ? '#10b981' : '#ef4444'};">📋 ${p.consent.isSafe ? 'Rozilik: Xavfsiz' : 'Rozilik: Xavf!'}</span>` : ''}
        </td>
        <td><span style="font-size:11.5px; font-weight:700; color:#93c5fd;">${escapeHtml(p.deviceId.toUpperCase())}</span></td>
        <td><span class="${statusClass}">${statusMap[p.status] || p.status}</span></td>
        <td style="white-space:nowrap;">${formatQueueSlotTime(p)}</td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn-icon" onclick="callPatientAction('${p.id}')" title="Chaqirish"><i class="fa-solid fa-bullhorn"></i></button>
          <button class="btn-icon" onclick="printSingleTicket('${p.id}')" title="Chipta"><i class="fa-solid fa-print"></i></button>
          ${canDelete ? `
            <button class="btn-icon btn-icon-delete" onclick="deletePatientAction('${p.id}', '${escapeHtml(p.ticketNumber)}', '${escapeHtml(p.patientName)}')" title="Navbatdan o'chirish" style="color:#ef4444; margin-left:3px;">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join("");
}

window.callPatientAction = async function(id) {
  try {
    await fetch("/api/queue/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    alert("🔔 Bemor TV orqali xonaga chaqirildi!");
    fetchQueue();
  } catch (e) {}
};

window.printSingleTicket = function(id) {
  const p = todayQueue.find(x => x.id === id);
  if (p) printTicket(p);
};

window.deletePatientAction = async function(id, ticketNumber, patientName) {
  if (!confirm(`⚠️ DIQQAT!\n\nHaqiqatan ham ${ticketNumber} (${patientName}) bemorni navbatdan butunlay o'chirmoqchimisiz?`)) {
    return;
  }

  let token = localStorage.getItem("auth_token");
  if (!token && window.parent && window.parent.localStorage) {
    try { token = window.parent.localStorage.getItem("auth_token"); } catch(e) {}
  }

  try {
    const res = await fetch("/api/queue/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : ""
      },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (data.success) {
      fetchQueue();
    } else {
      alert("Xatolik: " + (data.error || "Bemorni o'chirib bo'lmadi"));
    }
  } catch (e) {
    alert("Server xatosi: " + e.message);
  }
};

// -------------------------------------------------------------
// WEBSOCKET JONLI ALOQA
// -------------------------------------------------------------
function connectWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    ws.send(JSON.stringify({
      action: "register",
      role: "operator",
      deviceName: "Navbatga Yozish Portali"
    }));
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "queue_updated" || data.type === "queue_init") {
        fetchQueue();
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(connectWebSocket, 3000);
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
