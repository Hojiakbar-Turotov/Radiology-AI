/**
 * Karmed Radiologiya & MRT Navbat Markazi - Unified Workspace App (app.js)
 */

let allServices = [];
let todayQueue = [];
let currentTab = 'karmed';
let ws = null;
let currentKarmedHost = '213.230.91.59:2025';
let activeKarmedUrl = 'http://213.230.91.59:2025/Radiology/Rbys.aspx';
let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
  initKarmedConnection();
  setupKarmedIframeBridge();
  checkCurrentUser();
  initServices();
  initWebSocket();
  fetchTodayQueue();
  pollClusterStatus();
  setInterval(pollClusterStatus, 5000);
});

// -------------------------------------------------------------
// KARMED ALOQASINI ANIQLASH VA FAILOVER (192.168.150.111 -> 213.230.91.59)
// -------------------------------------------------------------
async function initKarmedConnection() {
  const frame = document.getElementById("frameKarmed");
  const overlay = document.getElementById("karmedFallbackOverlay");

  // Har doim bir xil origin (Same-Origin) proksi orqali yuklash (kuki va AJAX to'siqsiz ishlashi uchun)
  if (frame && (!frame.src || !frame.src.includes("/Radiology/Rbys.aspx"))) {
    frame.src = "/Radiology/Rbys.aspx";
  }

  try {
    const res = await fetch("/api/karmed-url");
    const data = await res.json();
    if (data.success && data.url) {
      activeKarmedUrl = data.url;
      currentKarmedHost = data.host;
      updateKarmedUI(data.host, data.isLocal);
    }
  } catch (err) {
    updateKarmedUI('192.168.150.111:2025', true);
  }

  if (frame) {
    frame.onload = () => {
      if (overlay) overlay.style.display = "none";
    };
  }
}

function updateKarmedUI(host, isLocal) {
  const dot = document.getElementById("karmedHostDot");
  const txt = document.getElementById("txtKarmedHost");
  if (txt) {
    txt.innerText = isLocal ? `Karmed: 192.168.150.111` : `Karmed: 213.230.91.59`;
  }
  if (dot) {
    dot.className = isLocal ? "host-dot" : "host-dot remote";
  }
}

window.switchKarmedHost = function(targetHost) {
  const frame = document.getElementById("frameKarmed");
  const overlay = document.getElementById("karmedFallbackOverlay");

  if (targetHost.includes("192.168.150.111")) {
    currentKarmedHost = "192.168.150.111:2025";
    activeKarmedUrl = "http://192.168.150.111:2025/Radiology/Rbys.aspx";
    updateKarmedUI(currentKarmedHost, true);
  } else {
    currentKarmedHost = "213.230.91.59:2025";
    activeKarmedUrl = "http://213.230.91.59:2025/Radiology/Rbys.aspx";
    updateKarmedUI(currentKarmedHost, false);
  }

  if (frame) {
    frame.src = "/Radiology/Rbys.aspx";
  }
  if (overlay) {
    overlay.style.display = "none";
  }
};

window.toggleKarmedHost = function() {
  if (currentKarmedHost.includes("192.168.150.111")) {
    switchKarmedHost("213.230.91.59");
  } else {
    switchKarmedHost("192.168.150.111");
  }
};

window.openKarmedInNewTab = function() {
  window.open(activeKarmedUrl, "_blank");
};

// -------------------------------------------------------------
// VIEW SWITCHING
// -------------------------------------------------------------
function switchView(tabKey) {
  currentTab = tabKey;

  // Tabs
  document.querySelectorAll(".nav-tab-btn").forEach(btn => btn.classList.remove("active"));
  const activeTabBtn = document.getElementById("tab" + capitalize(tabKey));
  if (activeTabBtn) activeTabBtn.classList.add("active");

  // Frames
  document.querySelectorAll(".view-frame").forEach(frame => frame.classList.remove("active"));
  const activeFrame = document.getElementById("frame" + capitalize(tabKey));
  if (activeFrame) {
    activeFrame.classList.add("active");

    // Agar frame oldin noto'g'ri URL ga o'tib ketgan bo'lsa, toza manzilini yuklash
    const expectedSrcs = {
      navbat: "/navbat-yozish/",
      tv: "/mrt-tv/",
      laborant: "/laborant/",
      dashboard: "/server-dashboard/",
      karmed: "/Radiology/Rbys.aspx"
    };

    const targetSrc = expectedSrcs[tabKey];
    if (targetSrc) {
      try {
        const curPath = activeFrame.contentWindow.location.pathname;
        if (!curPath || curPath.includes("login.html") || !curPath.includes(targetSrc.replace(/\//g, ''))) {
          activeFrame.src = targetSrc;
        }
      } catch (e) {
        if (!activeFrame.src || !activeFrame.src.includes(targetSrc)) {
          activeFrame.src = targetSrc;
        }
      }
    }
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function refreshCurrentFrame() {
  const frame = document.getElementById("frame" + capitalize(currentTab));
  if (frame) {
    frame.src = frame.src;
  }
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

// -------------------------------------------------------------
// TEZKOR NAVBAT DRAWER TOGGLE
// -------------------------------------------------------------
function toggleQuickQueueDrawer() {
  const drawer = document.getElementById("quickQueueDrawer");
  const btn = document.getElementById("btnToggleDrawer");
  if (!drawer) return;

  const isCollapsed = drawer.classList.toggle("collapsed");
  if (btn) {
    btn.classList.toggle("active", !isCollapsed);
  }
}

// -------------------------------------------------------------
// XIZMATLAR KATALOGINI YUKLASH
// -------------------------------------------------------------
async function initServices() {
  try {
    const res = await fetch("/api/services");
    const data = await res.json();
    const list = data.catalog || data.services || [];
    if (Array.isArray(list) && list.length > 0) {
      allServices = list;
      const select = document.getElementById("quickServiceSelect");
      if (select) {
        select.innerHTML = '<option value="">-- Tekshiruv sohasini tanlang --</option>' +
          allServices.map(s => {
            const priceLabel = s.priceFormatted ? ` [ ${s.priceFormatted} ]` : (s.price ? ` [ ${s.price.toLocaleString()} so'm ]` : '');
            return `
              <option value="${s.code}" data-contrast="${s.isContrast ? 'yes' : 'no'}" data-device="${s.type}">
                ${s.code} - ${s.name}${priceLabel}
              </option>
            `;
          }).join("");
      }
    }
  } catch (e) {
    console.error("[Workspace Services Error]:", e);
  }
}
window.initServiceOptions = initServices;

// -------------------------------------------------------------
// TEKSHIRUV TURI ANIQLASH VA SARALASH (FAQAT MRT VA MSKT)
// -------------------------------------------------------------
function checkIsMrtOrMskt(code, name, groupName = "") {
  const normCode = (code || "").toUpperCase().replace(/\s+/g, "");
  const normName = (name || "").toUpperCase().trim();
  const normGroup = (groupName || "").toUpperCase().trim();

  // 1. Agar nomi yoki guruhida ochiq UZI / Ultratovush / Rentgen / EKG / Laboratoriya bo'lsa:
  const isNonRadiology = 
    normGroup.includes("ULTRATOVUSH") || normGroup.includes("UZI") || normGroup.includes("UTT") ||
    normName.includes("ULTRATOVUSH") || normName.includes("UZI") || normName.includes("UTT") ||
    normGroup.includes("RENTGEN") || normName.includes("RENTGEN") ||
    normGroup.includes("LABORATORIYA") || normName.includes("LABORATORIYA") ||
    normName.includes("MAMMOGRAFIYA") || normName.includes("PLEVRA") || normName.includes("LIMFA TUGUN");

  if (isNonRadiology && !normName.includes("MRT") && !normName.includes("MSKT") && !normName.includes("TOMOGRAFIYA")) {
    return {
      isMrtOrMskt: false,
      examType: "OTHER",
      reason: "Ushbu tekshiruvga navbat berilmaydi (Ultratovush / Boshqa tekshiruv)"
    };
  }

  // 2. Katalogimizdagi (allServices) rasmiy MRT va MSKT xizmatlari bilan solishtirish:
  const catItem = allServices.find(s => s.code === normCode);
  if (catItem) {
    if (catItem.type === "MRT" || catItem.type === "MSKT") {
      return {
        isMrtOrMskt: true,
        examType: catItem.type,
        serviceObj: catItem,
        isContrast: Boolean(catItem.isContrast),
        isInjector: Boolean(catItem.isInjector)
      };
    } else {
      return {
        isMrtOrMskt: false,
        examType: catItem.type,
        reason: "Faqat MRT va MSKT tekshiruvlari uchun navbat beriladi"
      };
    }
  }

  // 3. Matn orqali aniqlash:
  if (normName.includes("MSKT") || normName.includes("KOMPYUTER TOMOGRAFIYA") || (normName.includes("TOMOGRAFIYA") && !normName.includes("MAGNIT"))) {
    return {
      isMrtOrMskt: true,
      examType: "MSKT",
      isContrast: (normName.includes("KONTRAST") || normName.includes("VENA ICHI")) && !normName.includes("KONTRASTSIZ")
    };
  }

  if (normName.includes("MRT") || normName.includes("MAGNIT-REZONANS") || normName.includes("MAGNIT REZONANS")) {
    return {
      isMrtOrMskt: true,
      examType: "MRT",
      isContrast: (normName.includes("KONTRAST") || normName.includes("VENA ICHI") || normName.includes("INJEKTOR")) && !normName.includes("KONTRASTSIZ"),
      isInjector: normName.includes("INJEKTOR") || normName.includes("SHPRITS")
    };
  }

  // 4. Boshqa barcha xizmatlar: NAVBAT BERILMAYDI!
  return {
    isMrtOrMskt: false,
    examType: "OTHER",
    reason: "Ushbu tekshiruvga navbat berilmaydi (Faqat MRT va MSKT tekshiruvlari uchun navbat mavjud)"
  };
}

// -------------------------------------------------------------
// YASHIL RANGDAGI / O'TKAZILIB BO'LINGAN QATORNI ANIQLASH
// -------------------------------------------------------------
function isRowGreenOrCompleted(row, doc) {
  if (!row) return false;

  try {
    // 1. Matn bo'yicha "Fayl holati" yoki statusni tekshirish:
    const rowText = (row.innerText || "").toLowerCase();
    if (
      rowText.includes("rapor onayli") || 
      rowText.includes("raporlu") ||
      rowText.includes("tamamlandi") ||
      rowText.includes("onaylandi") ||
      rowText.includes("bajarildi") ||
      rowText.includes("o'tkazildi") ||
      rowText.includes("suret alindi") ||
      rowText.includes("sonuc cikti")
    ) {
      return true;
    }

    // 2. Element va uning barcha katakchalari (td) rangini tekshirish:
    const cells = Array.from(row.querySelectorAll("td"));
    const elementsToCheck = [row, ...cells];

    for (const el of elementsToCheck) {
      if (!el) continue;
      // Inline style tekshiruvi:
      const attrStyle = (el.getAttribute("style") || "").toLowerCase();
      if (isGreenColorString(attrStyle)) return true;

      // Direct style property:
      if (isGreenColorString(el.style.backgroundColor)) return true;

      // Computed style tekshiruvi:
      try {
        const view = (doc && doc.defaultView) ? doc.defaultView : window;
        const comp = view.getComputedStyle(el);
        if (comp && isGreenColorRgb(comp.backgroundColor)) return true;
      } catch (e) {}
    }
  } catch (err) {
    console.warn("[isRowGreenOrCompleted Error]:", err);
  }

  return false;
}

function isGreenColorString(s) {
  if (!s) return false;
  const str = s.toLowerCase();
  return str.includes("green") || str.includes("lime") || 
         str.includes("#00ff") || str.includes("#00ee") || str.includes("#00e6") ||
         str.includes("#22c55e") || str.includes("#10b981") || str.includes("#4ade80") ||
         str.includes("#86efac") || str.includes("#bbf7d0") || str.includes("#c8e6c9") ||
         str.includes("#a5d") || str.includes("#81c") || str.includes("#69f") ||
         str.includes("rgb(0, 255") || str.includes("rgb(0, 238") || str.includes("rgb(34, 197") ||
         str.includes("rgb(0, 204") || str.includes("rgb(16, 185") || str.includes("rgb(74, 222");
}

function isGreenColorRgb(colorStr) {
  if (!colorStr || colorStr === "rgba(0, 0, 0, 0)" || colorStr === "transparent") return false;
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1], 10);
    const g = parseInt(m[2], 10);
    const b = parseInt(m[3], 10);
    // Agar yashil (green) komponenti boshqa ranglardan ancha ustun bo'lsa:
    if (g >= 120 && g > r + 15 && g > b + 15) return true;
    if (g >= 150 && (g - r > 10 || g - b > 10)) return true;
  }
  return false;
}

// -------------------------------------------------------------
// RO'YXATGA OLINGAN SANANI TEKSHIRISH (OXIRGI 10 KUNLIK QOIDA)
// -------------------------------------------------------------
function checkRegistrationDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") {
    return { isExpired: false, daysDiff: 0, dateFormatted: "" };
  }

  try {
    const trimmed = dateStr.trim();
    if (!trimmed) return { isExpired: false, daysDiff: 0, dateFormatted: "" };

    // 1. DD.MM.YYYY yoki DD/MM/YYYY yoki DD-MM-YYYY formatini qidirish
    const dmyMatch = trimmed.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
    let regDate = null;

    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      regDate = new Date(year, month, day);
    } else {
      // 2. YYYY-MM-DD formati
      const ymdMatch = trimmed.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
      if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10) - 1;
        const day = parseInt(ymdMatch[3], 10);
        regDate = new Date(year, month, day);
      } else {
        const parsed = Date.parse(trimmed);
        if (!isNaN(parsed)) regDate = new Date(parsed);
      }
    }

    if (!regDate || isNaN(regDate.getTime())) {
      return { isExpired: false, daysDiff: 0, dateFormatted: dateStr };
    }

    // Bugungi sana (faqat kunni solishtirish uchun vaqt 00:00:00)
    const now = new Date();
    const todayZero = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const regZero = new Date(regDate.getFullYear(), regDate.getMonth(), regDate.getDate()).getTime();

    const diffDays = Math.floor((todayZero - regZero) / (1000 * 60 * 60 * 24));

    const dd = String(regDate.getDate()).padStart(2, '0');
    const mm = String(regDate.getMonth() + 1).padStart(2, '0');
    const yyyy = regDate.getFullYear();
    const dateFormatted = `${dd}.${mm}.${yyyy}`;

    // Agar 10 kundan oldingi tekshiruv bo'lsa (diffDays > 10):
    if (diffDays > 10) {
      return {
        isExpired: true,
        daysDiff: diffDays,
        dateFormatted: dateFormatted,
        reason: "So'rovni yangilash kerak (10 kundan oshgan)"
      };
    }

    return {
      isExpired: false,
      daysDiff: Math.max(0, diffDays),
      dateFormatted: dateFormatted
    };
  } catch (err) {
    console.warn("[checkRegistrationDate error]:", err);
    return { isExpired: false, daysDiff: 0, dateFormatted: dateStr };
  }
}

function onServiceSelected() {
  const select = document.getElementById("quickServiceSelect");
  const selectedOpt = select.options[select.selectedIndex];
  if (!selectedOpt || !selectedOpt.value) return;

  const submitBtn = document.getElementById("btnQuickSubmit");
  const recBox = document.getElementById("smartRecommendationBox");
  const recTitle = document.getElementById("smartBoxTitle");
  const recDesc = document.getElementById("smartBoxDesc");

  // Agar 10 kundan oldingi tekshiruv bo'lsa (Muddat o'tgan):
  if (selectedOpt.getAttribute("data-expired") === "true" || select.value === "EXPIRED") {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove("ready-pulse");
      submitBtn.classList.add("btn-disabled-blocked");
      submitBtn.style.background = "#475569";
      submitBtn.style.cursor = "not-allowed";
      submitBtn.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:#fbbf24;"></i> So'rovni yangilash kerak (10 kundan oshgan)`;
      submitBtn.title = "Ro'yxatga olingan sana 10 kundan oshgan. So'rovni yangilash kerak!";
    }
    if (recBox && recDesc) {
      recBox.style.display = "flex";
      recBox.style.background = "linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(180, 83, 9, 0.35))";
      recBox.style.borderColor = "#f59e0b";
      recBox.style.boxShadow = "0 4px 14px rgba(245, 158, 11, 0.3)";
      if (recTitle) {
        recTitle.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:#fbbf24;"></i> SO'ROVNI YANGILASH KERAK`;
        recTitle.style.color = "#fbbf24";
      }
      recDesc.innerHTML = `<span style="color:#fef3c7;">Ro'yxatga olingan sana 10 kundan oshgan. Bemor shifokor orqali so'rovni yangilashi shart!</span>`;
    }
    return;
  }

  // Agar tekshiruv allaqachon o'tkazilgan bo'lsa (Yashil):
  if (selectedOpt.getAttribute("data-done") === "true" || select.value === "DONE") {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove("ready-pulse");
      submitBtn.classList.add("btn-disabled-blocked");
      submitBtn.style.background = "#334155";
      submitBtn.style.cursor = "not-allowed";
      submitBtn.innerHTML = `<i class="fa-solid fa-check-double" style="color:#34d399;"></i> Tekshiruv o'tkazilgan (Navbat shart emas)`;
      submitBtn.title = "Ushbu tekshiruv allaqachon o'tkazilgan (yashil). Qayta navbatga qo'yish kerak emas!";
    }
    if (recBox && recDesc) {
      recBox.style.display = "flex";
      recBox.style.background = "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 78, 59, 0.35))";
      recBox.style.borderColor = "#10b981";
      if (recTitle) {
        recTitle.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#34d399;"></i> TEKSHIRUV O'TKAZILIB BO'LGAN (YASHIL)`;
        recTitle.style.color = "#34d399";
      }
      recDesc.innerHTML = `<span style="color:#ecfdf5;">Ushbu tekshiruv o'tkazilib bo'lgan, buni navbatga qo'yish kerak emas!</span>`;
    }
    return;
  }

  if (selectedOpt.getAttribute("data-blocked") === "true" || select.value === "BLOCKED") {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove("ready-pulse");
      submitBtn.classList.add("btn-disabled-blocked");
      submitBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Ushbu tekshiruvga navbat berilmaydi`;
      submitBtn.title = "Ushbu tekshiruv MRT yoki MSKT emas!";
    }
    if (recBox && recDesc) {
      recBox.style.display = "flex";
      recBox.style.background = "rgba(239, 68, 68, 0.15)";
      recBox.style.borderColor = "#ef4444";
      if (recTitle) {
        recTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> USHBU TEKSHIRUVGA NAVBAT BERILMAYDI`;
        recTitle.style.color = "#f87171";
      }
      recDesc.innerHTML = `<span style="color:#fecaca;">Elektron navbat faqat MRT va MSKT tekshiruvlari uchundir.</span>`;
    }
    return;
  }

  const check = checkIsMrtOrMskt(select.value, selectedOpt.text);
  if (!check.isMrtOrMskt) {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove("ready-pulse");
      submitBtn.classList.add("btn-disabled-blocked");
      submitBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Ushbu tekshiruvga navbat berilmaydi`;
      submitBtn.title = "Ushbu tekshiruv MRT yoki MSKT emas!";
    }
    if (recBox && recDesc) {
      recBox.style.display = "flex";
      recBox.style.background = "rgba(239, 68, 68, 0.15)";
      recBox.style.borderColor = "#ef4444";
      if (recTitle) {
        recTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> USHBU TEKSHIRUVGA NAVBAT BERILMAYDI`;
        recTitle.style.color = "#f87171";
      }
      recDesc.innerHTML = `<span style="color:#fecaca;">Elektron navbat faqat MRT va MSKT tekshiruvlari uchundir.</span>`;
    }
    return;
  }

  // Agar ruxsat etilgan bo'lsa:
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.remove("btn-disabled-blocked");
    submitBtn.classList.add("ready-pulse");
    submitBtn.style.background = "";
    submitBtn.style.cursor = "pointer";
  }

  const contrast = selectedOpt.getAttribute("data-contrast");
  const device = selectedOpt.getAttribute("data-device") || check.examType;

  const contrastSelect = document.getElementById("quickContrastSelect");
  const deviceSelect = document.getElementById("quickDeviceSelect");

  if (contrast === "yes" && contrastSelect) {
    contrastSelect.value = "yes";
  }

  if (device === "MSKT" && deviceSelect) {
    deviceSelect.value = "mskt";
  } else if (device === "MRT" && deviceSelect && deviceSelect.value === "mskt") {
    deviceSelect.value = "auto";
  }

  triggerSmartSlotRecalc();
}

// -------------------------------------------------------------
// KARMED IFRAME INTEGRATSIYASI VA AQLLI NAVBATGA OLISH
// -------------------------------------------------------------
function setupKarmedIframeBridge() {
  const frame = document.getElementById("frameKarmed");
  if (!frame) return;

  function attachListeners() {
    try {
      const doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
      if (!doc || !doc.body) return;

      // Karmed jadvalidagi qator bosilganda darhol ma'lumotlarni o'qib olish
      doc.body.addEventListener("click", (e) => {
        const row = e.target.closest("tr");
        if (!row) return;

        // Header, Pager, Filter qatorlarini tashlab ketish
        if (row.querySelector("th") || (row.className && (row.className.includes("Filter") || row.className.includes("Pager")))) return;

        // Karmed pastki jadvalini yangilashi uchun 120ms kutish
        setTimeout(() => {
          const patient = extractPatientFromKarmedDoc(doc, row);
          if (patient && (patient.name || patient.id)) {
            autoFillQuickQueue(patient);
          }
        }, 120);

        // Agar pastki tekshiruvlar jadvali biroz kechikib yangilansa:
        setTimeout(() => {
          const patient = extractPatientFromKarmedDoc(doc, row);
          if (patient && patient.service) {
            autoFillQuickQueue(patient);
          }
        }, 500);
      }, true);

      console.log("[Karmed Workspace] Iframe DOM tinglovchisi ulandi!");
    } catch (err) {
      console.warn("[Karmed Workspace] Iframe bridge ulanish:", err.message);
    }
  }

  frame.addEventListener("load", attachListeners);
  attachListeners();
}

// Kengaytma (Extension) postMessage orqali yuborganda ham qabul qilish:
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === 'KARMED_PATIENT_SELECTED' && event.data.patient) {
    console.log("[Karmed Workspace] Kengaytmadan bemor qabul qilindi:", event.data.patient);
    autoFillQuickQueue(event.data.patient);
  }
});

function extractPatientFromKarmedDoc(doc, clickedRow) {
  try {
    if (!doc) return null;

    // 1. Tanlangan bemor qatori (Focused / Magenta yoki bosilgan qator)
    let focusedRow = doc.querySelector(".dxgvFocusedRow_DevEx, .dxgvSelectedRow_DevEx") || clickedRow;
    if (!focusedRow) {
      const allRows = doc.querySelectorAll("tr");
      for (const r of allRows) {
        const bg = (r.style.backgroundColor || "").toLowerCase();
        if (bg.includes("magenta") || bg.includes("rgb(255, 0, 255)") || bg.includes("#ff00ff") || bg.includes("rgb(255, 105, 180)") || bg.includes("pink")) {
          focusedRow = r;
          break;
        }
      }
    }

    if (!focusedRow) return null;

    const cells = Array.from(focusedRow.querySelectorAll("td"));
    if (cells.length < 3) return null;

    const cellTexts = cells.map(c => (c.innerText || "").trim());

    // Ustunlarni aniqlash
    let surname = "";
    let name = "";
    let middle = "";
    let patientId = "";
    let pinfl = "";
    let regDate = "";

    const table = focusedRow.closest("table");
    if (table) {
      const headerThs = Array.from(table.querySelectorAll("th, td.dxgvHeader_DevEx, tr:first-child td")).map(h => (h.innerText || "").trim().toLowerCase());
      headerThs.forEach((h, idx) => {
        if (idx >= cellTexts.length) return;
        const val = cellTexts[idx];
        if (!val) return;
        if (h.includes("familiya")) surname = val;
        else if (h.includes("ism") && !h.includes("ota") && !h.includes("sharif")) name = val;
        else if (h.includes("ota") || h.includes("sharif")) middle = val;
        else if (h.includes("bemor id") || (h.includes("id") && !patientId)) patientId = val;
        else if (h.includes("pinfl") || h.includes("jshshir")) pinfl = val;
        else if (h.includes("ro'yxat") || h.includes("royxat") || (h.includes("sana") && !h.includes("tug"))) regDate = val;
      });
    }

    if (!surname && cellTexts[0] && isNaN(cellTexts[0])) surname = cellTexts[0];
    if (!name && cellTexts[1] && isNaN(cellTexts[1])) name = cellTexts[1];
    if (!patientId) {
      for (const val of cellTexts) {
        if (/^\d{4,8}$/.test(val)) {
          patientId = val;
          break;
        }
      }
    }

    // Agar ustun orqali sana topilmagan bo'lsa, katakchalardan qidirish:
    if (!regDate) {
      for (const val of cellTexts) {
        if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}/.test(val)) {
          regDate = val;
          break;
        }
      }
    }

    const fullName = `${surname} ${name} ${middle}`.trim();
    if (!fullName && !patientId) return null;

    // Guruh nomini aniqlash (masalan: "Ultratovush (10)", "MRT (4)", "MSKT (2)")
    let groupName = "";
    let p = focusedRow.previousElementSibling;
    while (p) {
      const t = (p.innerText || "").trim();
      if (t.includes("(") && t.includes(")") && (t.includes("Ultratovush") || t.includes("MRT") || t.includes("MSKT") || t.includes("Tomografiya") || t.includes("Rentgen"))) {
        groupName = t;
        break;
      }
      p = p.previousElementSibling;
    }

    // Yashil / O'tkazilgan holatni tekshirish (Top row):
    const isTopRowGreen = isRowGreenOrCompleted(focusedRow, doc) || isRowGreenOrCompleted(clickedRow, doc);

    // 2. Pastki jadvaldan barcha xizmat nomlari va kodlarini yig'ish
    const candidateServices = [];
    const allDocRows = doc.querySelectorAll("tr");
    for (const r of allDocRows) {
      const rowCells = Array.from(r.querySelectorAll("td"));
      if (rowCells.length < 2) continue;
      const texts = rowCells.map(c => (c.innerText || "").trim());

      // R kodini qidirish (R157, R184, R78, R143 va h.k.)
      const codeCellIdx = texts.findIndex(t => /^R\s*\d{2,5}$/i.test(t));
      if (codeCellIdx !== -1) {
        const code = texts[codeCellIdx].toUpperCase().replace(/\s+/g, "");
        let sName = "";
        if (texts[codeCellIdx + 1] && texts[codeCellIdx + 1].length > 2) {
          sName = texts[codeCellIdx + 1];
        } else if (codeCellIdx > 0 && texts[codeCellIdx - 1].length > 2) {
          sName = texts[codeCellIdx - 1];
        }
        const isServiceRowGreen = isRowGreenOrCompleted(r, doc);
        if (sName && !candidateServices.some(cs => cs.code === code)) {
          candidateServices.push({ code, name: sName, isGreen: isServiceRowGreen });
        }
      }
    }

    // Bemorning xizmatlari orasidan tekshiruv turini saralash:
    let chosenService = null;

    // 1-ustuvorlik: Agar pastki jadvalda MRT yoki MSKT bo'lsa, birinchi navbatda shuni olamiz
    for (const cs of candidateServices) {
      const check = checkIsMrtOrMskt(cs.code, cs.name, groupName);
      if (check.isMrtOrMskt) {
        chosenService = {
          code: cs.code,
          name: cs.name,
          isMrtOrMskt: true,
          examType: check.examType,
          isContrast: check.isContrast,
          isInjector: check.isInjector,
          serviceObj: check.serviceObj,
          isGreen: Boolean(cs.isGreen)
        };
        break;
      }
    }

    // 2-ustuvorlik: Agar birorta ham MRT/MSKT topilmasa (masalan, UZI R78, R82 bo'lsa)
    if (!chosenService && candidateServices.length > 0) {
      const first = candidateServices[0];
      chosenService = {
        code: first.code,
        name: first.name,
        isMrtOrMskt: false,
        examType: "OTHER",
        isGreen: Boolean(first.isGreen),
        reason: "Ushbu tekshiruvga navbat berilmaydi"
      };
    }

    // 3-ustuvorlik: Agar pastki jadvalda kodlar topilmagan bo'lsa, qatordagi matndan qidirish
    if (!chosenService) {
      for (const r of allDocRows) {
        const text = (r.innerText || "").trim();
        if ((text.includes("Mrt") || text.includes("MRT") || text.includes("Mskt") || text.includes("MSKT")) && text.length < 80 && !text.includes("Qidiruv") && !text.includes("Markazi")) {
          const isMskt = text.toUpperCase().includes("MSKT");
          chosenService = {
            code: "",
            name: text,
            isMrtOrMskt: true,
            examType: isMskt ? "MSKT" : "MRT",
            isContrast: text.toLowerCase().includes("kontrast") && !text.toLowerCase().includes("kontrastsiz"),
            isGreen: isRowGreenOrCompleted(r, doc)
          };
          break;
        }
      }
    }

    if (!chosenService) {
      chosenService = {
        code: "",
        name: groupName || "Ultratovush / Boshqa tekshiruv",
        isMrtOrMskt: false,
        examType: "OTHER",
        isGreen: isTopRowGreen,
        reason: "Ushbu tekshiruvga navbat berilmaydi"
      };
    }

    const isAlreadyCompleted = isTopRowGreen || Boolean(chosenService.isGreen);
    const dateCheck = checkRegistrationDate(regDate);

    return {
      name: fullName,
      id: patientId,
      pinfl: pinfl,
      groupName: groupName,
      registrationDate: regDate,
      isDateExpired: Boolean(dateCheck.isExpired),
      daysDiff: dateCheck.daysDiff,
      serviceCode: chosenService.code,
      service: chosenService.name,
      isMrtOrMskt: chosenService.isMrtOrMskt,
      examType: chosenService.examType,
      isContrast: Boolean(chosenService.isContrast),
      isAlreadyCompleted: Boolean(isAlreadyCompleted)
    };
  } catch (err) {
    console.warn("[extractPatientFromKarmedDoc Error]:", err);
    return null;
  }
}

// -------------------------------------------------------------
// AQLLI QURILMA TANLASH ALGORITMI
// -------------------------------------------------------------
function determineSmartDevice(patientData) {
  if (patientData.isMrtOrMskt === false) {
    return {
      isAllowed: false,
      deviceId: "none",
      deviceName: "Navbat berilmaydi",
      badgeText: `⛔ <strong>Ushbu tekshiruvga navbat berilmaydi!</strong> (Elektron navbat faqat MRT va MSKT tekshiruvlari uchun)`
    };
  }

  const examType = patientData.examType || (patientData.service && patientData.service.toUpperCase().includes("MSKT") ? "MSKT" : "MRT");
  const isContrast = Boolean(patientData.isContrast);

  // 1. Agar MSKT / KT tekshiruvi bo'lsa
  if (examType === "MSKT" || (patientData.service && patientData.service.toUpperCase().includes("MSKT"))) {
    const msktWaiting = todayQueue.filter(p => p.deviceId === 'mskt' && p.status === 'waiting').length;
    return {
      isAllowed: true,
      deviceId: "mskt",
      deviceName: "MSKT 1",
      badgeText: `🖥️ <strong>MSKT 1</strong> (Tomograf tanlandi | Navbatda: <strong>${msktWaiting}</strong> ta bemor)`
    };
  }

  // 2. Agar KONTRASTLI MRT bo'lsa -> Faqat MRT 1 (Injektorli)
  if (isContrast) {
    const mrt1Waiting = todayQueue.filter(p => (p.deviceId === 'mrt1' || p.deviceId === 'mrt') && p.status === 'waiting').length;
    return {
      isAllowed: true,
      deviceId: "mrt1",
      deviceName: "MRT 1 (Injektor)",
      badgeText: `💉 <strong>MRT 1</strong> (Injektorli apparat | Kontrastli MRT | Navbatda: <strong>${mrt1Waiting}</strong> ta bemor)`
    };
  }

  // 3. Agar KONTRASTSIZ (Oddiy) MRT bo'lsa:
  const mrt1Waiting = todayQueue.filter(p => (p.deviceId === 'mrt1' || p.deviceId === 'mrt') && p.status === 'waiting').length;
  const mrt2Waiting = todayQueue.filter(p => p.deviceId === 'mrt2' && p.status === 'waiting').length;

  if (mrt2Waiting <= mrt1Waiting) {
    return {
      isAllowed: true,
      deviceId: "mrt2",
      deviceName: "MRT 2 (3.0T)",
      badgeText: `⚡ <strong>MRT 2</strong> (Optimal tezkor navbat | Navbatda: <strong>${mrt2Waiting}</strong> ta bemor)`
    };
  } else {
    return {
      isAllowed: true,
      deviceId: "mrt1",
      deviceName: "MRT 1 (1.5T)",
      badgeText: `⚡ <strong>MRT 1</strong> (Kamroq kutish vaqti | Navbatda: <strong>${mrt1Waiting}</strong> ta bemor)`
    };
  }
}

// -------------------------------------------------------------
// FORMANI AVTOMAT TO'LDIRISH VA TAYYOR TURISH
// -------------------------------------------------------------
function autoFillQuickQueue(patientData) {
  if (!patientData) return;

  const nameInput = document.getElementById("quickPatientName");
  const idInput = document.getElementById("quickPatientId");
  const phoneInput = document.getElementById("quickPhone");
  const serviceSelect = document.getElementById("quickServiceSelect");
  const contrastSelect = document.getElementById("quickContrastSelect");
  const deviceSelect = document.getElementById("quickDeviceSelect");
  const submitBtn = document.getElementById("btnQuickSubmit");
  const recBox = document.getElementById("smartRecommendationBox");
  const recTitle = document.getElementById("smartBoxTitle");
  const recDesc = document.getElementById("smartBoxDesc");

  // 1. Bemor F.I.SH va ID
  if (nameInput && patientData.name) {
    nameInput.value = patientData.name.toUpperCase();
  }
  if (idInput && patientData.id) {
    idInput.value = patientData.id;
  }
  if (phoneInput && patientData.phone) {
    phoneInput.value = patientData.phone;
  }

  // Ro'yxatga olingan sana indikatori
  const regWrap = document.getElementById("quickRegDateWrap");
  const regText = document.getElementById("quickRegDateText");
  const regBadge = document.getElementById("quickRegDateBadge");
  if (regWrap && regText && regBadge) {
    if (patientData.registrationDate) {
      const dc = checkRegistrationDate(patientData.registrationDate);
      regWrap.style.display = "block";
      regText.innerText = `${dc.dateFormatted || patientData.registrationDate} (${dc.daysDiff} kun oldin)`;
      if (dc.isExpired) {
        regBadge.style.background = "#7f1d1d";
        regBadge.style.color = "#fca5a5";
        regBadge.style.border = "1px solid #ef4444";
        regBadge.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i> ${dc.daysDiff} kun (>10 kun)`;
      } else {
        regBadge.style.background = "#064e3b";
        regBadge.style.color = "#6ee7b7";
        regBadge.style.border = "1px solid #10b981";
        regBadge.innerHTML = `<i class="fa-solid fa-check"></i> Oxirgi 10 kunlik`;
      }
    } else {
      regWrap.style.display = "none";
    }
  }

  // 2. FAQAT MRT VA MSKT UCHUN NAVBAT BERILADI (BOSHQA TEKSHIRUVLAR BLOKLANADI)
  const examCheck = checkIsMrtOrMskt(patientData.serviceCode, patientData.service, patientData.groupName);
  const isMrtOrMskt = (patientData.isMrtOrMskt !== false) && examCheck.isMrtOrMskt;

  if (!isMrtOrMskt) {
    // ⛔ USHBU TEKSHIRUVGA NAVBAT BERILMAYDI! (UZI / Ultratovush / Rentgen va h.k.)
    if (contrastSelect) contrastSelect.value = "no";

    // Service selectda ogohlantirish tanlovini ko'rsatish
    if (serviceSelect) {
      let blockedOpt = serviceSelect.querySelector("option[data-blocked='true']");
      if (!blockedOpt) {
        blockedOpt = document.createElement("option");
        blockedOpt.setAttribute("data-blocked", "true");
        serviceSelect.prepend(blockedOpt);
      }
      const labelText = patientData.service || patientData.serviceCode || "Ultratovush / Boshqa";
      blockedOpt.value = "BLOCKED";
      blockedOpt.text = `⛔ [${patientData.serviceCode || 'UZI'}] ${labelText} — Ushbu tekshiruvga navbat berilmaydi!`;
      serviceSelect.selectedIndex = 0;
    }

    if (deviceSelect) {
      deviceSelect.value = "auto";
    }

    // Qizil ogohlantirish darchasini ko'rsatish
    if (recBox && recDesc) {
      recBox.style.display = "flex";
      recBox.style.background = "rgba(239, 68, 68, 0.15)";
      recBox.style.borderColor = "#ef4444";
      recBox.style.boxShadow = "0 4px 14px rgba(239, 68, 68, 0.25)";
      if (recTitle) {
        recTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> USHBU TEKSHIRUVGA NAVBAT BERILMAYDI`;
        recTitle.style.color = "#f87171";
      }
      recDesc.innerHTML = `
        <div style="color:#fecaca; font-size:12.5px; line-height:1.4;">
          ⚠️ Bemor tekshiruvi: <strong>${escapeHtml(patientData.service || patientData.serviceCode || 'Ultratovush')}</strong>.<br>
          <span style="color:#f87171; font-weight:700;">Elektron navbat tizimi faqat MRT va MSKT tekshiruvlari uchun mo'ljallangan!</span> Boshqa tekshiruvlarga navbat berilmaydi.
        </div>
      `;
    }

    // Tugmani to'liq bloklash
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove("ready-pulse");
      submitBtn.classList.add("btn-disabled-blocked");
      submitBtn.innerHTML = `<i class="fa-solid fa-ban"></i> Ushbu tekshiruvga navbat berilmaydi`;
      submitBtn.title = "Ushbu tekshiruv MRT yoki MSKT emas. Navbat berish taqiqlangan!";
    }

    // Tezkor navbat darchasini ochish
    const drawer = document.getElementById("quickQueueDrawer");
    if (drawer && drawer.classList.contains("collapsed")) {
      drawer.classList.remove("collapsed");
      const btnToggle = document.getElementById("btnToggleDrawer");
      if (btnToggle) btnToggle.classList.add("active");
    }

    return;
  }

  // 3. YASHIL RANGDAGI / O'TKAZILIB BO'LGAN TEKSHIRUV BO'LSA - NAVBATGA QO'YISH KERAK EMAS!
  const isAlreadyCompleted = Boolean(patientData.isAlreadyCompleted);

  if (isAlreadyCompleted) {
    if (contrastSelect) contrastSelect.value = patientData.isContrast ? "yes" : "no";

    // Service selectda ogohlantirish ko'rsatish
    if (serviceSelect) {
      let doneOpt = serviceSelect.querySelector("option[data-done='true']");
      if (!doneOpt) {
        doneOpt = document.createElement("option");
        doneOpt.setAttribute("data-done", "true");
        serviceSelect.prepend(doneOpt);
      }
      const labelText = patientData.service || patientData.serviceCode || "MRT Tekshiruvi";
      doneOpt.value = "DONE";
      doneOpt.text = `✅ [${patientData.serviceCode || 'MRT'}] ${labelText} — Tekshiruv o'tkazilgan (Bajarilgan)`;
      serviceSelect.selectedIndex = 0;
    }

    if (deviceSelect) {
      deviceSelect.value = "auto";
    }

    // Yashil / Tinchlantiruvchi ogohlantirish darchasini ko'rsatish
    if (recBox && recDesc) {
      recBox.style.display = "flex";
      recBox.style.background = "linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 78, 59, 0.35))";
      recBox.style.borderColor = "#10b981";
      recBox.style.boxShadow = "0 4px 14px rgba(16, 185, 129, 0.25)";
      if (recTitle) {
        recTitle.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#34d399;"></i> TEKSHIRUV O'TKAZILIB BO'LGAN (YASHIL)`;
        recTitle.style.color = "#34d399";
      }
      recDesc.innerHTML = `
        <div style="color:#ecfdf5; font-size:12.5px; line-height:1.4;">
          ✅ Bemor: <strong>${escapeHtml(patientData.name || '')}</strong><br>
          🔬 Tekshiruv: <strong>${escapeHtml(patientData.service || patientData.serviceCode || '')}</strong> (Rapor Onayli / Bajarilgan).<br>
          <strong style="color:#fbbf24;">ℹ️ Ushbu tekshiruv o'tkazilib bo'lgan, buni navbatga qo'yish kerak emas!</strong>
        </div>
      `;
    }

    // Tugmani to'liq bloklash
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove("ready-pulse");
      submitBtn.classList.add("btn-disabled-blocked");
      submitBtn.style.background = "#334155";
      submitBtn.style.cursor = "not-allowed";
      submitBtn.innerHTML = `<i class="fa-solid fa-check-double" style="color:#34d399;"></i> Tekshiruv o'tkazilgan (Navbat shart emas)`;
      submitBtn.title = "Ushbu tekshiruv allaqachon o'tkazilgan (yashil). Qayta navbatga qo'yish kerak emas!";
    }

    // Tezkor navbat darchasini ochish
    const drawer = document.getElementById("quickQueueDrawer");
    if (drawer && drawer.classList.contains("collapsed")) {
      drawer.classList.remove("collapsed");
      const btnToggle = document.getElementById("btnToggleDrawer");
      if (btnToggle) btnToggle.classList.add("active");
    }

    return;
  }

  // 4. RO'YXATGA OLINGAN SANA OXIRGI 10 KUNLIK BO'LISHI SHART! (10 KUNDAN OSHGAN BO'LSA - SO'ROVNI YANGILASH KERAK)
  const dateCheck = checkRegistrationDate(patientData.registrationDate);
  const isDateExpired = Boolean(patientData.isDateExpired) || dateCheck.isExpired;

  if (isDateExpired) {
    if (contrastSelect) contrastSelect.value = patientData.isContrast ? "yes" : "no";

    // Service selectda ogohlantirish ko'rsatish
    if (serviceSelect) {
      let expOpt = serviceSelect.querySelector("option[data-expired='true']");
      if (!expOpt) {
        expOpt = document.createElement("option");
        expOpt.setAttribute("data-expired", "true");
        serviceSelect.prepend(expOpt);
      }
      const labelText = patientData.service || patientData.serviceCode || "MRT Tekshiruvi";
      expOpt.value = "EXPIRED";
      expOpt.text = `⚠️ [${patientData.serviceCode || 'MRT'}] ${labelText} — So'rovni yangilash kerak (${dateCheck.daysDiff} kun oldin)`;
      serviceSelect.selectedIndex = 0;
    }

    if (deviceSelect) {
      deviceSelect.value = "auto";
    }

    // Ogohlantirish darchasini ko'rsatish
    if (recBox && recDesc) {
      recBox.style.display = "flex";
      recBox.style.background = "linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(180, 83, 9, 0.4))";
      recBox.style.borderColor = "#f59e0b";
      recBox.style.boxShadow = "0 4px 14px rgba(245, 158, 11, 0.3)";
      if (recTitle) {
        recTitle.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:#fbbf24;"></i> SO'ROVNI YANGILASH KERAK (10 KUNDAN OSHGAN)`;
        recTitle.style.color = "#fbbf24";
      }
      recDesc.innerHTML = `
        <div style="color:#fef3c7; font-size:12.5px; line-height:1.45;">
          📅 Ro'yxatga olingan sana: <strong>${escapeHtml(dateCheck.dateFormatted || patientData.registrationDate || '')}</strong> (<strong>${dateCheck.daysDiff} kun oldin</strong>).<br>
          ⚠️ Qoida bo'yicha sana <strong>oxirgi 10 kunlik</strong> bo'lishi shart.<br>
          <strong style="color:#f87171; font-size:13px;">⛔ So'rovni yangilash kerak! 10 kundan oldingi tekshiruvga navbat berilmaydi.</strong>
        </div>
      `;
    }

    // Tugmani to'liq bloklash
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.remove("ready-pulse");
      submitBtn.classList.add("btn-disabled-blocked");
      submitBtn.style.background = "#475569";
      submitBtn.style.cursor = "not-allowed";
      submitBtn.innerHTML = `<i class="fa-solid fa-clock-rotate-left" style="color:#fbbf24;"></i> So'rovni yangilash kerak (10 kundan oshgan)`;
      submitBtn.title = "Tekshiruv ro'yxatga olinganiga 10 kundan oshgan. Bemor shifokor orqali so'rovni yangilashi shart!";
    }

    // Tezkor navbat darchasini ochish
    const drawer = document.getElementById("quickQueueDrawer");
    if (drawer && drawer.classList.contains("collapsed")) {
      drawer.classList.remove("collapsed");
      const btnToggle = document.getElementById("btnToggleDrawer");
      if (btnToggle) btnToggle.classList.add("active");
    }

    return;
  }

  // ✅ RUXSAT ETILGAN (MRT YOKI MSKT):
  if (serviceSelect) {
    const blockedOpt = serviceSelect.querySelector("option[data-blocked='true']");
    if (blockedOpt) blockedOpt.remove();
    const doneOpt = serviceSelect.querySelector("option[data-done='true']");
    if (doneOpt) doneOpt.remove();
    const expOpt = serviceSelect.querySelector("option[data-expired='true']");
    if (expOpt) expOpt.remove();
  }

  const isContrast = Boolean(patientData.isContrast);
  if (contrastSelect) {
    contrastSelect.value = isContrast ? "yes" : "no";
  }

  // 3. Tekshiruv sohasi (Xizmat)
  if (serviceSelect && (patientData.serviceCode || patientData.service)) {
    let matched = false;
    for (let i = 0; i < serviceSelect.options.length; i++) {
      const opt = serviceSelect.options[i];
      if (patientData.serviceCode && opt.value === patientData.serviceCode) {
        serviceSelect.selectedIndex = i;
        matched = true;
        break;
      }
      if (patientData.service && opt.text.toLowerCase().includes(patientData.service.toLowerCase())) {
        serviceSelect.selectedIndex = i;
        matched = true;
        break;
      }
    }
    if (!matched && patientData.service) {
      const val = patientData.serviceCode || ("R_AUTO_" + Date.now());
      const label = (patientData.serviceCode ? `[${patientData.serviceCode}] ` : "") + patientData.service;
      const opt = new Option(label, val, true, true);
      opt.setAttribute("data-contrast", isContrast ? "yes" : "no");
      opt.setAttribute("data-device", (patientData.examType === "MSKT" || patientData.service.toUpperCase().includes("MSKT")) ? "MSKT" : "MRT");
      serviceSelect.add(opt);
    }
  }

  // 4. AQLLI QURILMA TANLASH
  const smart = determineSmartDevice(patientData);
  if (deviceSelect) {
    deviceSelect.value = smart.deviceId;
  }

  if (recBox && recDesc) {
    recBox.style.display = "flex";
    recBox.style.background = "linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))";
    recBox.style.borderColor = "#0284c7";
    recBox.style.boxShadow = "0 4px 14px rgba(2, 132, 199, 0.25)";
    if (recTitle) {
      recTitle.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> AQLLI TAQSIMLASH`;
      recTitle.style.color = "#38bdf8";
    }
    recDesc.innerHTML = smart.badgeText;
  }

  // 5. Eng yaqin ish kuni va bo'sh soatni avtomatik hisoblash
  triggerSmartSlotRecalc();

  // 6. Tezkor navbat darchasini ochish
  const drawer = document.getElementById("quickQueueDrawer");
  if (drawer && drawer.classList.contains("collapsed")) {
    drawer.classList.remove("collapsed");
    const btnToggle = document.getElementById("btnToggleDrawer");
    if (btnToggle) btnToggle.classList.add("active");
  }

  // 7. Tugmani yashil pulsatsiya bilan tayyor holga keltirish
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.remove("btn-disabled-blocked");
    submitBtn.classList.add("ready-pulse");
    submitBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${smart.deviceName} ga Navbatga Qo'yish & Chipta`;
    submitBtn.title = "Barcha ma'lumotlar olindi! Navbatga qo'yish uchun bosing yoki Enter bosing.";
  }
}

// -------------------------------------------------------------
// TEZKOR NAVBATGA QO'SHISH & CHIPTA
// -------------------------------------------------------------
async function handleQuickQueueSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById("quickPatientName");
  const idInput = document.getElementById("quickPatientId");
  const phoneInput = document.getElementById("quickPhone");
  const serviceSelect = document.getElementById("quickServiceSelect");
  const deviceSelect = document.getElementById("quickDeviceSelect");
  const contrastSelect = document.getElementById("quickContrastSelect");
  const dateInput = document.getElementById("quickScheduledDate");
  const timeInput = document.getElementById("quickScheduledTime");
  const submitBtn = document.getElementById("btnQuickSubmit");

  if (submitBtn && submitBtn.disabled) {
    alert("⛔ Ushbu tekshiruvga navbat berilmaydi!\n\nElektron navbat faqat MRT va MSKT tekshiruvlari uchun mo'ljallangan.");
    return;
  }

  const selectedOpt = serviceSelect.options[serviceSelect.selectedIndex];
  if (selectedOpt && (selectedOpt.getAttribute("data-expired") === "true" || serviceSelect.value === "EXPIRED")) {
    alert("⚠️ Ushbu tekshiruv ro'yxatga olinganiga 10 kundan oshgan!\n\nSo'rovni yangilash kerak deb qaytarildi. Bemor shifokor orqali yo'llanma/so'rovni yangilashi shart.");
    return;
  }

  if (selectedOpt && (selectedOpt.getAttribute("data-done") === "true" || serviceSelect.value === "DONE")) {
    alert("ℹ️ Ushbu tekshiruv allaqachon o'tkazilgan (yashil rangda)! Buni navbatga qo'yish kerak emas.");
    return;
  }

  if (!selectedOpt || selectedOpt.getAttribute("data-blocked") === "true" || serviceSelect.value === "BLOCKED") {
    alert("⛔ Ushbu tekshiruvga elektron navbat berilmaydi!\n\nElektron navbat faqat MRT va MSKT tekshiruvlari uchun mo'ljallangan.");
    return;
  }

  const check = checkIsMrtOrMskt(serviceSelect.value, selectedOpt.text);
  if (!check.isMrtOrMskt) {
    alert("⛔ Ushbu tekshiruvga elektron navbat berilmaydi!\n\nElektron navbat faqat MRT va MSKT tekshiruvlari uchun mo'ljallangan.");
    return;
  }

  const serviceCode = serviceSelect.value;
  const serviceObj = allServices.find(s => s.code === serviceCode) || {
    code: serviceCode,
    name: serviceSelect.options[serviceSelect.selectedIndex].text,
    duration: 20
  };

  const isContrast = contrastSelect.value === "yes";
  let targetDeviceId = deviceSelect.value;
  if (targetDeviceId === "auto") {
    targetDeviceId = isContrast ? "mrt1" : "mrt2";
  }

  const payload = {
    patientName: nameInput.value.trim().toUpperCase(),
    patientId: idInput.value.trim(),
    phone: phoneInput.value.trim(),
    deviceId: targetDeviceId,
    isContrast: isContrast,
    scheduledDate: dateInput ? dateInput.value : undefined,
    scheduledTime: timeInput ? timeInput.value : undefined,
    services: [serviceObj]
  };

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...';

  try {
    const res = await fetch("/api/queue/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success && data.patient) {
      // 1. Chiptani chop etish
      printThermalTicket(data.patient);

      // 2. Formani tozalash
      nameInput.value = "";
      idInput.value = "";
      phoneInput.value = "";
      serviceSelect.selectedIndex = 0;
      contrastSelect.value = "no";
      deviceSelect.value = "auto";
      submitBtn.classList.remove("ready-pulse");
      const recBox = document.getElementById("smartRecommendationBox");
      if (recBox) recBox.style.display = "none";

      // 3. Ro'yxatni yangilash
      fetchTodayQueue();
    } else {
      alert("Xatolik: " + (data.error || "Navbatga qo'shib bo'lmadi"));
    }
  } catch (err) {
    alert("Server bilan aloqa xatosi: " + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-print"></i> Navbatga Qo\'shish & Chipta';
  }
}

// -------------------------------------------------------------
// CHIPTA CHOP ETISH
// -------------------------------------------------------------
function printThermalTicket(patient) {
  const printWindow = window.open('', '_blank', 'width=350,height=500');
  if (!printWindow) return;

  const servicesText = (patient.services || []).map(s => s.name).join(', ') || 'MRT Tekshiruvi';
  const roomName = patient.deviceId === 'mrt1' ? '1-MRT (101-xona)' : (patient.deviceId === 'mrt2' ? '2-MRT (102-xona)' : 'MSKT Xonasi');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Chipta #${patient.ticketNumber}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          font-family: 'Courier New', monospace;
          width: 76mm;
          margin: 2mm auto;
          text-align: center;
          color: #000;
        }
        h2 { font-size: 16px; margin: 2px 0; }
        h1 { font-size: 34px; margin: 6px 0; letter-spacing: 2px; }
        .room { font-size: 15px; font-weight: bold; margin: 4px 0; border: 1px dashed #000; padding: 4px; }
        .info { font-size: 11px; text-align: left; margin: 8px 0; line-height: 1.4; }
        .footer { font-size: 10px; margin-top: 10px; border-top: 1px dashed #000; padding-top: 4px; }
      </style>
    </head>
    <body>
      <h2>🏥 RESPUBLIKA ONKOLOGIYA</h2>
      <div>Tomografiya (MRT & MSKT) Markazi</div>
      <hr style="border:none; border-top:1px dashed #000; margin: 6px 0;">
      
      <div>NAVBAT RAQAMI:</div>
      <h1>${patient.ticketNumber}</h1>
      
      <div class="room">${roomName}</div>
      
      <div class="info">
        <div><b>Bemor:</b> ${patient.patientName}</div>
        <div><b>Xizmat:</b> ${servicesText}</div>
        ${patient.services && patient.services[0] && patient.services[0].priceFormatted ? `<div><b>Narxi:</b> ${patient.services[0].priceFormatted}</div>` : ''}
        ${patient.isContrast ? '<div><b>Turi:</b> 💉 KONTRASTLI</div>' : ''}
        <div><b>Taxminiy vaqt:</b> ${patient.estimatedStartTime || '--:--'}</div>
        <div><b>Sana:</b> ${new Date().toLocaleDateString('ru-RU')} ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
      </div>
      
      <div class="footer">
        Iltimos, navbatingizni monitorda kuting!<br>
        Navbat chaqirilganda ovozli e'lon beriladi.
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, 250);
}

// -------------------------------------------------------------
// BUGUNGI NAVBATNI YUKLASH VA CHIQARISH
// -------------------------------------------------------------
async function fetchTodayQueue() {
  try {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.success && Array.isArray(data.queue)) {
      todayQueue = data.queue;
      renderDrawerQueue(todayQueue);
    }
  } catch (e) {}
}

function renderDrawerQueue(queue) {
  const container = document.getElementById("quickQueueList");
  const countBadge = document.getElementById("quickQueueCount");
  if (!container) return;

  if (countBadge) countBadge.innerText = `${queue.length} ta`;

  if (queue.length === 0) {
    container.innerHTML = '<div style="color:#6b7280; text-align:center; padding:20px; font-size:12px;">Hozircha navbatda bemorlar yo\'q</div>';
    return;
  }

  // Oxirgi qo'shilganlar yuqorida
  const sorted = [...queue].reverse();

  container.innerHTML = sorted.map(p => {
    const devBadgeClass = p.deviceId === 'mrt1' ? 'badge-mrt1' : (p.deviceId === 'mrt2' ? 'badge-mrt2' : 'badge-mskt');
    const devName = p.deviceId === 'mrt1' ? 'MRT 1' : (p.deviceId === 'mrt2' ? 'MRT 2' : 'MSKT');
    const serviceName = (p.services || []).map(s => s.name).join(', ') || 'Tekshiruv';

    return `
      <div class="quick-queue-item">
        <div class="item-left">
          <span class="item-ticket">${p.ticketNumber}</span>
          <div class="item-details">
            <span class="item-name">${escapeHtml(p.patientName)}</span>
            <span class="item-service">${escapeHtml(serviceName)}</span>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
          <span class="item-badge ${devBadgeClass}">${devName}</span>
          <span style="font-size:10px; color:#6b7280;">${p.estimatedStartTime || ''}</span>
        </div>
      </div>
    `;
  }).join("");
}

function escapeHtml(text) {
  if (!text) return "";
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// -------------------------------------------------------------
// WEBSOCKET (REAL-TIME UPDATES)
// -------------------------------------------------------------
function initWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: "register", role: "workspace", deviceName: "Karmed Workspace" }));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "queue_updated") {
          fetchTodayQueue();
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      setTimeout(initWebSocket, 3000);
    };
  } catch (e) {
    setTimeout(initWebSocket, 3000);
  }
}

// -------------------------------------------------------------
// KLASTER HOLATINI TEKSHIRISH
// -------------------------------------------------------------
async function pollClusterStatus() {
  try {
    const res = await fetch("/api/cluster/nodes");
    const data = await res.json();
    const statusTxt = document.getElementById("txtClusterStatus");
    if (data.success && statusTxt) {
      statusTxt.innerText = `Klaster: ${data.activeCount}/${data.maxNodes} Faol`;
    }
  } catch (e) {}
}

// -------------------------------------------------------------
// FOYDALANUVCHI SESSIYASINI VA ROLLRINI TEKSHIRISH
// -------------------------------------------------------------
async function checkCurrentUser() {
  const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
  if (!token) {
    currentUser = null;
    applyRolePermissions(null);
    return;
  }

  try {
    const res = await fetch("/api/auth/me", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success && data.user) {
      currentUser = data.user;
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      applyRolePermissions(currentUser);
    } else {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      currentUser = null;
      applyRolePermissions(null);
    }
  } catch (e) {
    const cached = localStorage.getItem("auth_user");
    if (cached) {
      currentUser = JSON.parse(cached);
      applyRolePermissions(currentUser);
    } else {
      currentUser = null;
      applyRolePermissions(null);
    }
  }
}

window.onAuthStateChanged = function(user) {
  currentUser = user;
  applyRolePermissions(user);
};

// -------------------------------------------------------------
// ROLLIK RUXSATLAR TIZIMI (DYNAMIC VIEW GATING)
// -------------------------------------------------------------
function applyRolePermissions(user) {
  const btnOpenLogin = document.getElementById("btnOpenLogin");
  const authUserWrap = document.getElementById("authUserWrap");
  const userAvatarLetter = document.getElementById("userAvatarLetter");
  const userNavName = document.getElementById("userNavName");
  const userNavRole = document.getElementById("userNavRole");

  const tabKarmed = document.getElementById("tabKarmed");
  const tabNavbat = document.getElementById("tabNavbat");
  const tabTv = document.getElementById("tabTv");
  const tabLaborant = document.getElementById("tabLaborant");
  const tabStaff = document.getElementById("tabStaff");
  const tabDashboard = document.getElementById("tabDashboard");

  const btnToggleDrawer = document.getElementById("btnToggleDrawer");
  const clusterBadge = document.getElementById("clusterBadge");
  const quickQueueDrawer = document.getElementById("quickQueueDrawer");

  // 1. TIZIMGA KIRMAGAN FOYDALANUVCHI (ANONYMOUS / GUEST)
  if (!user) {
    if (btnOpenLogin) btnOpenLogin.style.display = "inline-flex";
    if (authUserWrap) authUserWrap.style.display = "none";

    // Faqat Karmed ko'rinadi, qolgan barcha oynalar mutlaqo yashirin!
    if (tabKarmed) tabKarmed.style.display = "inline-flex";
    if (tabNavbat) tabNavbat.style.display = "none";
    if (tabTv) tabTv.style.display = "none";
    if (tabLaborant) tabLaborant.style.display = "none";
    if (tabStaff) tabStaff.style.display = "none";
    if (tabDashboard) tabDashboard.style.display = "none";

    if (btnToggleDrawer) btnToggleDrawer.style.display = "none";
    if (clusterBadge) clusterBadge.style.display = "none";
    const btnKarmedHost = document.getElementById("btnKarmedHost");
    if (btnKarmedHost) btnKarmedHost.style.display = "none";

    if (quickQueueDrawer) quickQueueDrawer.classList.add("collapsed");

    switchView("karmed");
    return;
  }

  // 2. TIZIMGA KIRGAN FOYDALANUVCHI (AUTHENTICATED USER)
  if (btnOpenLogin) btnOpenLogin.style.display = "none";
  if (authUserWrap) authUserWrap.style.display = "flex";

  if (userAvatarLetter) userAvatarLetter.innerText = (user.name ? user.name[0] : user.login[0]).toUpperCase();
  if (userNavName) userNavName.innerText = user.name || user.login;
  if (userNavRole) userNavRole.innerText = formatRoleName(user.role);

  // Tezkor navbat darchasi tugmasini ko'rsatish
  if (btnToggleDrawer) btnToggleDrawer.style.display = "inline-flex";

  // Har doim Karmed ochiq
  if (tabKarmed) tabKarmed.style.display = "inline-flex";

  // Agar frame oldin 404 ga tushgan bo'lsa, toza manzillarga yo'naltirish
  const expectedIframes = [
    { id: "frameNavbat", src: "/navbat-yozish/" },
    { id: "frameTv", src: "/mrt-tv/" },
    { id: "frameLaborant", src: "/laborant/" },
    { id: "frameDashboard", src: "/server-dashboard/" }
  ];
  expectedIframes.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      try {
        const curPath = el.contentWindow.location.pathname;
        if (!curPath || curPath.includes("login.html") || !curPath.includes(item.src.replace(/\//g, ''))) {
          el.src = item.src;
        }
      } catch (e) {
        if (!el.src || !el.src.includes(item.src)) el.src = item.src;
      }
    }
  });

  const btnKarmedHost = document.getElementById("btnKarmedHost");
  const role = user.role || 'tibbiy_navbat';

  // Server ma'lumotlari (tugma va indikatorlar) faqat Server Nazoratchisiga ko'rinadi ("bu yerda server ko'rinmasin")
  if (btnKarmedHost) {
    btnKarmedHost.style.display = (role === 'server_nazoratchisi') ? 'inline-flex' : 'none';
  }
  if (clusterBadge) {
    clusterBadge.style.display = (role === 'server_nazoratchisi') ? 'inline-flex' : 'none';
  }

  // TV va Laborant menyulari ruxsati bo'lsa yuqorida tursin:
  const canAccessTv = !user.permissions || user.permissions.includes('tv') || 
    ['tibbiy_navbat', 'laborant', 'super_admin', 'server_nazoratchisi'].includes(role);

  const laborantAllowedNames = ['isfandiyor', 'hojiakbar', 'shoxruh', 'dilmurod', 'miraziz', 'aziz', 'sardor', 'shariat', 'sevinch', 'nodirbek', 'akbar'];
  const userNameLower = (user.name || '').toLowerCase();

  const canAccessLaborant = (role === 'laborant' || role === 'super_admin' || role === 'server_nazoratchisi') ||
    (user.permissions && user.permissions.includes('laborant')) ||
    (user.isLaborant === true) ||
    laborantAllowedNames.some(n => userNameLower.includes(n));

  if (tabNavbat) tabNavbat.style.display = "inline-flex";
  if (tabTv) tabTv.style.display = canAccessTv ? "inline-flex" : "none";
  if (tabLaborant) tabLaborant.style.display = canAccessLaborant ? "inline-flex" : "none";
  if (tabStaff) tabStaff.style.display = (role === 'super_admin' || role === 'server_nazoratchisi') ? "inline-flex" : "none";
  if (tabDashboard) tabDashboard.style.display = (role === 'server_nazoratchisi') ? "inline-flex" : "none";
}

function formatRoleName(role) {
  switch (role) {
    case 'tibbiy_navbat': return 'Navbatchi';
    case 'laborant': return 'Laborant';
    case 'super_admin': return 'Super Admin';
    case 'server_nazoratchisi': return 'Server Nazorati';
    case 'admin': return 'Admin';
    default: return role || 'Xodim';
  }
}

// -------------------------------------------------------------
// LOGIN MODAL VA AVTORIZATSIYA
// -------------------------------------------------------------
function openLoginModal() {
  const modal = document.getElementById("modalLogin");
  const errBox = document.getElementById("modalLoginError");
  if (errBox) errBox.style.display = "none";
  if (modal) modal.style.display = "flex";
  const inp = document.getElementById("modalLoginUser");
  if (inp) {
    inp.focus();
    inp.select();
  }
}

function closeLoginModal() {
  const modal = document.getElementById("modalLogin");
  if (modal) modal.style.display = "none";
}

async function handleModalLogin(e) {
  e.preventDefault();
  const loginInput = document.getElementById("modalLoginUser");
  const passInput = document.getElementById("modalLoginPass");
  const errBox = document.getElementById("modalLoginError");
  const submitBtn = document.getElementById("btnSubmitLogin");

  const login = loginInput.value.trim();
  const password = passInput.value.trim();

  if (!login || !password) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tekshirilmoqda...';
  if (errBox) errBox.style.display = "none";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password })
    });
    const data = await res.json();

    if (data.success && data.token && data.user) {
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      currentUser = data.user;
      applyRolePermissions(currentUser);
      closeLoginModal();
      loginInput.value = "";
      passInput.value = "";
    } else {
      if (errBox) {
        errBox.innerText = "❌ " + (data.error || "Login yoki parol noto'g'ri!");
        errBox.style.display = "block";
      }
    }
  } catch (err) {
    if (errBox) {
      errBox.innerText = "❌ Server bilan aloqa xatosi: " + err.message;
      errBox.style.display = "block";
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Kirish';
  }
}

function handleLogout() {
  if (!confirm("Tizimdan chiqmoqchimisiz?")) return;
  const token = localStorage.getItem("auth_token");
  fetch("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  }).finally(() => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    currentUser = null;
    applyRolePermissions(null);
  });
}

// -------------------------------------------------------------
// SHAXSIY PROFILNI BOSHQARISH (MY PROFILE)
// -------------------------------------------------------------
function openProfileModal() {
  if (!currentUser) {
    openLoginModal();
    return;
  }

  const modal = document.getElementById("modalProfile");
  const msgBox = document.getElementById("modalProfileMsg");
  if (msgBox) msgBox.style.display = "none";

  document.getElementById("profName").value = currentUser.name || "";
  document.getElementById("profLogin").value = currentUser.login || "";
  document.getElementById("profPhone").value = currentUser.phone || "";
  document.getElementById("profRoom").value = currentUser.room || "";
  document.getElementById("profNewPass").value = "";
  document.getElementById("profConfirmPass").value = "";

  const ws = currentUser.workSchedule || {};
  document.getElementById("profWorkStart").value = ws.start || "08:00";
  document.getElementById("profWorkEnd").value = ws.end || "17:00";
  document.getElementById("profLunchStart").value = ws.lunchStart || "12:00";
  document.getElementById("profLunchEnd").value = ws.lunchEnd || "13:00";

  const labSettings = document.getElementById("profLaborantSettings");
  if (currentUser.role === 'laborant' || currentUser.role === 'super_admin' || currentUser.role === 'server_nazoratchisi' || currentUser.role === 'admin') {
    if (labSettings) labSettings.style.display = "block";
    const prefs = currentUser.preferences?.testDurations || {};
    document.getElementById("profDurMrtPlain").value = prefs.MRT_ODDIY || 15;
    document.getElementById("profDurMrtContrast").value = prefs.MRT_KONTRAST || 25;
    document.getElementById("profDurMskt").value = prefs.MSKT || 10;
  } else {
    if (labSettings) labSettings.style.display = "none";
  }

  document.getElementById("profRoleBadge").innerText = formatRoleName(currentUser.role);
  if (modal) modal.style.display = "flex";
}

function closeProfileModal() {
  const modal = document.getElementById("modalProfile");
  if (modal) modal.style.display = "none";
}

async function handleSaveProfile(e) {
  e.preventDefault();
  if (!currentUser) return;

  const msgBox = document.getElementById("modalProfileMsg");
  const saveBtn = document.getElementById("btnSaveProfile");

  const name = document.getElementById("profName").value.trim();
  const login = document.getElementById("profLogin").value.trim();
  const phone = document.getElementById("profPhone").value.trim();
  const room = document.getElementById("profRoom").value.trim();
  const newPass = document.getElementById("profNewPass").value.trim();
  const confirmPass = document.getElementById("profConfirmPass").value.trim();

  if (newPass && newPass !== confirmPass) {
    if (msgBox) {
      msgBox.className = "modal-error-box";
      msgBox.innerText = "❌ Yangi parollar bir-biriga mos kelmadi!";
      msgBox.style.display = "block";
    }
    return;
  }

  const workSchedule = {
    start: document.getElementById("profWorkStart").value || "08:00",
    end: document.getElementById("profWorkEnd").value || "17:00",
    lunchStart: document.getElementById("profLunchStart").value || "12:00",
    lunchEnd: document.getElementById("profLunchEnd").value || "13:00"
  };

  const payload = { name, login, phone, room, workSchedule };
  if (newPass) payload.password = newPass;

  if (document.getElementById("profLaborantSettings").style.display !== 'none') {
    payload.preferences = {
      testDurations: {
        MRT_ODDIY: parseInt(document.getElementById("profDurMrtPlain").value) || 15,
        MRT_KONTRAST: parseInt(document.getElementById("profDurMrtContrast").value) || 25,
        MSKT: parseInt(document.getElementById("profDurMskt").value) || 10
      }
    };
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saqlanmoqda...';

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success && data.user) {
      currentUser = data.user;
      localStorage.setItem("auth_user", JSON.stringify(data.user));
      applyRolePermissions(currentUser);

      if (msgBox) {
        msgBox.className = "modal-msg-box";
        msgBox.innerText = "✅ Profil ma'lumotlari muvaffaqiyatli saqlandi!";
        msgBox.style.display = "block";
      }

      setTimeout(() => closeProfileModal(), 1200);
    } else {
      if (msgBox) {
        msgBox.className = "modal-error-box";
        msgBox.innerText = "❌ " + (data.error || "Profilni saqlab bo'lmadi");
        msgBox.style.display = "block";
      }
    }
  } catch (err) {
    if (msgBox) {
      msgBox.className = "modal-error-box";
      msgBox.innerText = "❌ Server xatosi: " + err.message;
      msgBox.style.display = "block";
    }
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> O\'zgarishlarni Saqlash';
  }
}

// -------------------------------------------------------------
// XODIMLAR VA ROLLAR BOSHQARUVI (SUPER ADMIN & SERVER NAZORATCHISI)
// -------------------------------------------------------------
function openStaffModal() {
  if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'server_nazoratchisi' && currentUser.role !== 'admin')) {
    alert("Xodimlarni boshqarish uchun Super Admin yoki Server Nazoratchisi huquqi talab qilinadi!");
    return;
  }

  const modal = document.getElementById("modalStaff");
  if (modal) modal.style.display = "flex";

  const optSuper = document.getElementById("optSuperAdmin");
  const optSupervisor = document.getElementById("optServerSupervisor");
  const isSupervisor = (currentUser.role === 'server_nazoratchisi' || currentUser.role === 'admin');

  if (optSuper) optSuper.style.display = isSupervisor ? "block" : "none";
  if (optSupervisor) optSupervisor.style.display = isSupervisor ? "block" : "none";

  fetchStaffList();
}

function closeStaffModal() {
  const modal = document.getElementById("modalStaff");
  if (modal) modal.style.display = "none";
}

function toggleAddStaffForm() {
  const box = document.getElementById("boxAddStaff");
  if (!box) return;
  box.style.display = box.style.display === "none" ? "block" : "none";
}

async function fetchStaffList() {
  const tbody = document.getElementById("staffTableBody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Xodimlar ro\'yxati yuklanmoqda...</td></tr>';

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/staff", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success && Array.isArray(data.staff)) {
      renderStaffTable(data.staff);
    } else {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#f87171; padding:16px;">❌ ${data.error || "Yuklash xatosi"}</td></tr>`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#f87171; padding:16px;">❌ Server bilan aloqa yo'q</td></tr>`;
  }
}

function renderStaffTable(staffList) {
  const tbody = document.getElementById("staffTableBody");
  if (!tbody) return;

  const isSupervisor = (currentUser.role === 'server_nazoratchisi' || currentUser.role === 'admin');

  tbody.innerHTML = staffList.map(s => {
    const ws = s.workSchedule || {};
    const workHours = (ws.start && ws.end) ? `${ws.start}-${ws.end}` : "08:00-17:00";
    const isTargetAdmin = (s.role === 'super_admin' || s.role === 'server_nazoratchisi');
    const canManageThisUser = isSupervisor || !isTargetAdmin;

    return `
      <tr>
        <td><strong style="color:#38bdf8;">${escapeHtml(s.login)}</strong></td>
        <td>${escapeHtml(s.name)}</td>
        <td><span class="badge-role">${formatRoleName(s.role)}</span></td>
        <td>${escapeHtml(s.room || '-')}</td>
        <td>${escapeHtml(s.phone || '-')}</td>
        <td><span style="color:#10b981; font-weight:700;"><i class="fa-solid fa-circle" style="font-size:8px;"></i> Faol</span></td>
        <td>
          ${canManageThisUser ? `
            <button class="btn-table-action" onclick="promptResetStaffPassword('${escapeHtml(s.login)}')">
              <i class="fa-solid fa-key"></i> Parol
            </button>
            <button class="btn-table-action" onclick="promptEditStaffRole('${escapeHtml(s.login)}', '${s.role}')">
              <i class="fa-solid fa-user-gear"></i> Rol
            </button>
          ` : `<span style="color:#64748b; font-size:11px;">Himoyalangan</span>`}
        </td>
      </tr>
    `;
  }).join("");
}

async function handleCreateStaff(e) {
  e.preventDefault();
  const login = document.getElementById("newStaffLogin").value.trim().toUpperCase();
  const name = document.getElementById("newStaffName").value.trim();
  const password = document.getElementById("newStaffPassword").value.trim();
  const role = document.getElementById("newStaffRole").value;

  if (!login || !password) return;

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/staff/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ login, name, password, role })
    });
    const data = await res.json();

    if (data.success) {
      alert(`✅ Xodim ${login} (${name}) muvaffaqiyatli qo'shildi!`);
      document.getElementById("formAddStaff").reset();
      document.getElementById("newStaffPassword").value = "15420";
      toggleAddStaffForm();
      fetchStaffList();
    } else {
      alert("❌ Xatolik: " + (data.error || "Xodim qo'shib bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server bilan aloqa xatosi: " + err.message);
  }
}

async function promptResetStaffPassword(login) {
  const newPass = prompt(`${login} xodimi uchun yangi parolni kiriting:`, "15420");
  if (!newPass) return;

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/staff/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ login, password: newPass })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${login} paroli muvaffaqiyatli o'zgartirildi!`);
    } else {
      alert("❌ Xatolik: " + (data.error || "Parolni tiklab bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server xatosi: " + err.message);
  }
}

async function promptEditStaffRole(login, currentRole) {
  const isSupervisor = (currentUser.role === 'server_nazoratchisi' || currentUser.role === 'admin');
  let allowedOptions = ["tibbiy_navbat", "laborant"];
  if (isSupervisor) allowedOptions.push("super_admin", "server_nazoratchisi");

  const newRole = prompt(`${login} uchun yangi rolni kiriting:\nVariantlar: ${allowedOptions.join(", ")}`, currentRole);
  if (!newRole || newRole === currentRole) return;

  if (!allowedOptions.includes(newRole)) {
    alert("❌ Noto'g'ri rol kiritildi! Variantlar: " + allowedOptions.join(", "));
    return;
  }

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/auth/staff/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ login, role: newRole })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${login} roli ${formatRoleName(newRole)} ga o'zgartirildi!`);
      fetchStaffList();
    } else {
      alert("❌ Xatolik: " + (data.error || "Rolni o'zgartirib bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server xatosi: " + err.message);
  }
}

// -------------------------------------------------------------
// AQLLI SLOT REKALKULATSIYASI (Smart Slot Recalculator)
// -------------------------------------------------------------
async function triggerSmartSlotRecalc() {
  const serviceSelect = document.getElementById("quickServiceSelect");
  const contrastSelect = document.getElementById("quickContrastSelect");
  const deviceSelect = document.getElementById("quickDeviceSelect");
  const dateInput = document.getElementById("quickScheduledDate");
  const nameInput = document.getElementById("quickPatientName");

  if (!serviceSelect) return;

  const serviceCode = serviceSelect.value;
  const serviceObj = allServices.find(s => s.code === serviceCode) || {
    code: serviceCode,
    name: serviceSelect.options[serviceSelect.selectedIndex]?.text || "MRT Tekshiruvi",
    duration: 25
  };

  const isContrast = contrastSelect ? contrastSelect.value === "yes" : false;
  let targetDeviceId = deviceSelect ? deviceSelect.value : "auto";

  try {
    const res = await fetch("/api/queue/smart-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        services: [serviceObj],
        deviceId: targetDeviceId,
        isContrast: isContrast,
        scheduledDate: dateInput ? dateInput.value : undefined,
        patientName: nameInput ? nameInput.value.trim() : ""
      })
    });
    const data = await res.json();
    if (data.success && data.slot) {
      const slot = data.slot;
      const dateInp = document.getElementById("quickScheduledDate");
      const timeInp = document.getElementById("quickScheduledTime");
      const recBox = document.getElementById("smartRecommendationBox");
      const recDesc = document.getElementById("smartBoxDesc");

      if (dateInp && (!dateInp.value || dateInp.value < slot.scheduledDate)) {
        dateInp.value = slot.scheduledDate;
      }
      if (timeInp) timeInp.value = slot.startTime;

      if (recBox && recDesc) {
        recDesc.innerHTML = `
          <strong>📅 Bo'sh Vaqt:</strong> ${slot.scheduledDateFormatted}, soat <strong>${slot.startTime}</strong> (${slot.deviceId.toUpperCase()})<br>
          <strong>⏱️ Davomiyligi:</strong> ${slot.durationMinutes} daqiqa<br>
          <span style="font-size:11px; color:#38bdf8;">📌 ${slot.ruleDescription}</span>
        `;
        recBox.style.display = "flex";
      }
    }
  } catch (e) {
    console.warn("Smart slot recalc error:", e);
  }
}

// -------------------------------------------------------------
// TEKSHIRUVLAR & STANDART VAQTLAR BOSHQARUVI (SUPER ADMIN)
// -------------------------------------------------------------
let catalogServicesList = [];

window.switchStaffTab = function(tabName) {
  const btnMembers = document.getElementById("btnStaffTabMembers");
  const btnServices = document.getElementById("btnStaffTabServices");
  const panelMembers = document.getElementById("panelStaffMembers");
  const panelServices = document.getElementById("panelStaffServices");

  if (tabName === 'members') {
    if (btnMembers) btnMembers.classList.add("active");
    if (btnServices) btnServices.classList.remove("active");
    if (panelMembers) panelMembers.style.display = "block";
    if (panelServices) panelServices.style.display = "none";
    fetchStaffList();
  } else {
    if (btnMembers) btnMembers.classList.remove("active");
    if (btnServices) btnServices.classList.add("active");
    if (panelMembers) panelMembers.style.display = "none";
    if (panelServices) panelServices.style.display = "block";
    fetchServicesList();
  }
};

window.toggleAddServiceForm = function() {
  const box = document.getElementById("boxAddService");
  if (box) {
    box.style.display = box.style.display === "none" ? "block" : "none";
  }
};

async function fetchServicesList() {
  const tbody = document.getElementById("servicesTableBody");
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px;"><i class="fa-solid fa-spinner fa-spin"></i> Tekshiruvlar ro\'yxati yuklanmoqda...</td></tr>';

  try {
    const res = await fetch("/api/services");
    const data = await res.json();
    if (data.success && Array.isArray(data.catalog)) {
      catalogServicesList = data.catalog;
      renderServicesTable(catalogServicesList);
    } else {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#f87171; padding:16px;">❌ Yuklab bo'lmadi</td></tr>`;
    }
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#f87171; padding:16px;">❌ Server bilan aloqa yo'q</td></tr>`;
  }
}

function renderServicesTable(list) {
  const tbody = document.getElementById("servicesTableBody");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:16px; color:#94a3b8;">Xizmatlar mavjud emas</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(s => {
    return `
      <tr>
        <td><strong style="color:#38bdf8;">${escapeHtml(s.code)}</strong></td>
        <td>${escapeHtml(s.name)}</td>
        <td><span class="badge" style="background:#1e293b; color:#cbd5e1; font-weight:700;">${escapeHtml(s.type)}</span></td>
        <td>${s.isContrast ? '<span style="color:#f87171; font-weight:700;">💉 Kontrastli</span>' : '<span style="color:#94a3b8;">Oddiy</span>'}</td>
        <td style="color:#34d399; font-weight:700; font-size:11.5px; white-space:nowrap;">${s.priceFormatted || (s.price ? (s.price.toLocaleString() + " so'm") : '-')}</td>
        <td>
          <input type="number" id="srvDur_${escapeHtml(s.code)}" class="service-duration-inp" value="${s.duration}" min="5" max="120"> daq
        </td>
        <td>
          <button class="btn-table-action" onclick="handleSaveServiceDuration('${escapeHtml(s.code)}')" title="Standart vaqtni saqlash">
            <i class="fa-solid fa-check"></i>
          </button>
          <button class="btn-table-action danger" onclick="handleDeleteService('${escapeHtml(s.code)}')" title="O'chirish">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

window.filterServicesTable = function() {
  const q = (document.getElementById("inpSearchServices")?.value || "").toLowerCase().trim();
  if (!q) {
    renderServicesTable(catalogServicesList);
    return;
  }
  const filtered = catalogServicesList.filter(s => 
    s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
  );
  renderServicesTable(filtered);
};

window.handleCreateService = async function(e) {
  e.preventDefault();
  const code = document.getElementById("newSrvCode").value.trim().toUpperCase();
  const name = document.getElementById("newSrvName").value.trim();
  const type = document.getElementById("newSrvType").value;
  const isContrast = document.getElementById("newSrvContrast").value === "yes";
  const duration = parseInt(document.getElementById("newSrvDuration").value, 10);
  const priceInput = document.getElementById("newSrvPrice");
  const price = priceInput ? parseInt(priceInput.value, 10) : 0;

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/services/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ code, name, type, isContrast, duration, price })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${code} tekshiruvi muvaffaqiyatli saqlandi!`);
      toggleAddServiceForm();
      fetchServicesList();
      if (typeof initServiceOptions === 'function') initServiceOptions();
    } else {
      alert("❌ Xatolik: " + (data.error || "Saqlab bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server xatosi: " + err.message);
  }
};

window.handleSaveServiceDuration = async function(code) {
  const inp = document.getElementById(`srvDur_${code}`);
  if (!inp) return;
  const duration = parseInt(inp.value, 10);
  if (isNaN(duration) || duration < 5) {
    alert("Iltimos, to'g'ri daqiqa kiriting (kamida 5 daqiqa)");
    return;
  }

  const srv = catalogServicesList.find(s => s.code === code);
  if (!srv) return;

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/services/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        code: srv.code,
        name: srv.name,
        type: srv.type,
        isContrast: srv.isContrast,
        duration: duration
      })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${code} standart vaqti ${duration} daqiqaga o'zgartirildi!`);
      fetchServicesList();
    } else {
      alert("❌ Xatolik: " + (data.error || "Yangilab bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server xatosi: " + err.message);
  }
};

window.handleDeleteService = async function(code) {
  if (!confirm(`${code} tekshiruvini katalogdan o'chirmoqchimisiz?`)) return;

  try {
    const token = localStorage.getItem("auth_token");
    const res = await fetch("/api/services/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ code })
    });
    const data = await res.json();
    if (data.success) {
      alert(`✅ ${code} tekshiruvi o'chirildi!`);
      fetchServicesList();
      if (typeof initServiceOptions === 'function') initServiceOptions();
    } else {
      alert("❌ Xatolik: " + (data.error || "O'chirib bo'lmadi"));
    }
  } catch (err) {
    alert("❌ Server xatosi: " + err.message);
  }
};


