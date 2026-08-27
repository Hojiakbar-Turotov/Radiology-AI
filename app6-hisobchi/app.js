/**
 * ===================================================
 * BUXGALTERIYA & HISOBCHI PORTALI - MAIN APPLICATION JS
 * ===================================================
 */

// Standart UTT & Radiologiya xonalari mappingi
const DOCTOR_ROOMS_MAP = {
  "Juravlev Igor Ivanovich": "UTT 1 - 53 XONA",
  "Kurbanova Sevinch Musayevna": "UTT 2 - 54 XONA",
  "Abidjanov Alisher Maxamataliyevich": "UTT 3 - 46 XONA",
  "Ziyayeva Zarina Abduganiyevna": "UTT 4 - 47 XONA",
  "Xoshimova Lola Kabulovna": "UTT 5 - 48 XONA",
  "Toirova Shaxlo Oybek qizi": "UTT 6 - 52 XONA",
  "Asadova Dildoraxon Asatullayevna": "UTT 7 - 45 XONA",
  "Saidbayeva Zulfiya Yergeshovna": "UTT 8 - 49 XONA",
  "Xusanova Feruza Ikromjonovna": "UTT 9 - 50 XONA",
  "Xudayberdiyeva Nigora Nizamovna": "UTT 10 - 51 XONA",
  "Yulchiyeva Nodira Siddikovna": "UTT Xonasi",
  "Turatov Hojiakbar Shavkat ogli": "Radiodiagnostika"
};

// Global holat
let allFirebaseReports = {};
let filteredData = {
  doctorsSummary: [],
  patientsList: [],
  codesMatrix: [],
  kpis: { totalPatients: 0, totalServices: 0, activeDoctors: 0, uniqueCodes: 0 }
};

let chartDoctorsInstance = null;
let chartServicesInstance = null;

// DOM Elementlari
let elFilterStartDate, elFilterEndDate, elFilterDoctor, elFilterDepartment, elFilterSearch;
let elKpiPatients, elKpiServices, elKpiDoctors, elKpiCodes;
let elKpiPatientsSub, elKpiServicesSub;
let elTbodyDoctors, elTfootDoctors, elTbodyPatients, elTbodyCodes;
let elBadgePatientsCount, elBadgeCodesCount, elDataStatusInfo;

// 1. DASTUR YUKLANGANDA
document.addEventListener("DOMContentLoaded", async () => {
  initDOMElements();
  initLiveClock();
  setupFilterEventListeners();
  setupTabNavigation();
  initDatePresets("today");
  await fetchAllReportsFromFirebase();
});

function initDOMElements() {
  elFilterStartDate = document.getElementById("filterStartDate");
  elFilterEndDate = document.getElementById("filterEndDate");
  elFilterDoctor = document.getElementById("filterDoctorSelect");
  elFilterDepartment = document.getElementById("filterDepartmentSelect");
  elFilterSearch = document.getElementById("filterSearchInput");

  elKpiPatients = document.getElementById("kpiTotalPatients");
  elKpiServices = document.getElementById("kpiTotalServices");
  elKpiDoctors = document.getElementById("kpiActiveDoctors");
  elKpiCodes = document.getElementById("kpiUniqueCodes");

  elKpiPatientsSub = document.getElementById("kpiPatientsSub");
  elKpiServicesSub = document.getElementById("kpiServicesSub");

  elTbodyDoctors = document.getElementById("tbodyDoctorsSummary");
  elTfootDoctors = document.getElementById("tfootDoctorsSummary");
  elTbodyPatients = document.getElementById("tbodyPatientsRegistry");
  elTbodyCodes = document.getElementById("tbodyCodesMatrix");

  elBadgePatientsCount = document.getElementById("tabBadgePatientsCount");
  elBadgeCodesCount = document.getElementById("tabBadgeCodesCount");
  elDataStatusInfo = document.getElementById("dataStatusInfo");

  document.getElementById("btnRefreshData").addEventListener("click", fetchAllReportsFromFirebase);
  document.getElementById("btnExportExcel").addEventListener("click", exportToExcel);
  document.getElementById("btnExportCSV").addEventListener("click", exportToCSV);
  document.getElementById("btnPrintReport").addEventListener("click", printOfficialReport);

  // Modal yopish
  document.getElementById("btnCloseDoctorModal").addEventListener("click", closeDoctorModal);
  document.getElementById("btnCloseDoctorModalBtn").addEventListener("click", closeDoctorModal);
}

// 2. JONLI SOAT VA O'ZBEKCHA SANA
function initLiveClock() {
  const uzMonths = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
  const uzWeekdays = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

  function update() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString("uz-UZ", { hour12: false });
    const dateStr = `${uzWeekdays[now.getDay()]}, ${now.getDate()}-${uzMonths[now.getMonth()]} ${now.getFullYear()}`;

    const elTime = document.getElementById("headerClock");
    const elDate = document.getElementById("headerDate");
    if (elTime) elTime.textContent = timeStr;
    if (elDate) elDate.textContent = dateStr;
  }
  update();
  setInterval(update, 1000);
}

// 3. SANA PRESETLARI
function initDatePresets(presetName = "today") {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (presetName === "today") {
    elFilterStartDate.value = todayStr;
    elFilterEndDate.value = todayStr;
  } else if (presetName === "yesterday") {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    elFilterStartDate.value = yStr;
    elFilterEndDate.value = yStr;
  } else if (presetName === "thisWeek") {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d.setDate(diff));
    const monStr = `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, '0')}-${String(mon.getDate()).padStart(2, '0')}`;
    elFilterStartDate.value = monStr;
    elFilterEndDate.value = todayStr;
  } else if (presetName === "thisMonth") {
    const firstDayStr = `${yyyy}-${mm}-01`;
    elFilterStartDate.value = firstDayStr;
    elFilterEndDate.value = todayStr;
  } else if (presetName === "all") {
    elFilterStartDate.value = "";
    elFilterEndDate.value = "";
  }

  // Chip tugmalar holatini yangilash
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.preset === presetName);
  });
}

function setupFilterEventListeners() {
  document.querySelectorAll(".chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      initDatePresets(btn.dataset.preset);
      applyFiltersAndRender();
    });
  });

  elFilterStartDate.addEventListener("change", () => {
    clearPresetChipsActive();
    applyFiltersAndRender();
  });
  elFilterEndDate.addEventListener("change", () => {
    clearPresetChipsActive();
    applyFiltersAndRender();
  });
  elFilterDoctor.addEventListener("change", applyFiltersAndRender);
  elFilterDepartment.addEventListener("change", applyFiltersAndRender);
  elFilterSearch.addEventListener("input", applyFiltersAndRender);
}

function clearPresetChipsActive() {
  document.querySelectorAll(".chip-btn").forEach(btn => btn.classList.remove("active"));
}

function setupTabNavigation() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.dataset.tab;
      const targetEl = document.getElementById(targetId);
      if (targetEl) targetEl.classList.add("active");
    });
  });
}

// 4. FIREBASE-DAN BARCHA HISOBOTLARNI YUKLASH
async function fetchAllReportsFromFirebase() {
  elDataStatusInfo.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Firebase-dan ma'lumotlar yuklanmoqda...`;

  try {
    const res = await fetch(`${FIREBASE_DB_URL}/accountant_reports.json`);
    if (!res.ok) throw new Error(`HTTP xatosi: ${res.status}`);

    const data = await res.json();
    allFirebaseReports = data || {};

    populateDoctorDropdown(allFirebaseReports);
    applyFiltersAndRender();

    const dateCount = Object.keys(allFirebaseReports).length;
    elDataStatusInfo.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10b981;"></i> Baza yangilandi (${dateCount} kunlik ma'lumotlar mavjud)`;

  } catch (err) {
    console.error("fetchAllReportsFromFirebase error:", err);
    elDataStatusInfo.innerHTML = `<span style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Xatolik: ${err.message}</span>`;
    
    // Agar Firebase bo'sh bo'lsa yoki test uchun
    applyFiltersAndRender();
  }
}

// Shifokorlar dropdownini to'ldirish
function populateDoctorDropdown(reportsData) {
  const currentVal = elFilterDoctor.value;
  const docSet = new Set(Object.keys(DOCTOR_ROOMS_MAP));

  if (reportsData) {
    Object.values(reportsData).forEach(dateReports => {
      if (dateReports && typeof dateReports === "object") {
        Object.values(dateReports).forEach(rep => {
          if (rep && rep.doctorName && rep.doctorName !== "Barcha Shifokorlar") {
            docSet.add(rep.doctorName);
          }
        });
      }
    });
  }

  elFilterDoctor.innerHTML = `<option value="ALL">-- Barcha Shifokorlar --</option>`;
  Array.from(docSet).sort().forEach(doc => {
    const opt = document.createElement("option");
    opt.value = doc;
    opt.textContent = `${doc} (${DOCTOR_ROOMS_MAP[doc] || 'Shifokor'})`;
    elFilterDoctor.appendChild(opt);
  });

  if (currentVal && docSet.has(currentVal)) {
    elFilterDoctor.value = currentVal;
  }
}

// 5. FILTRLASH VA AGGREGATSIYA
function applyFiltersAndRender() {
  const startDate = elFilterStartDate.value;
  const endDate = elFilterEndDate.value;
  const selDoc = elFilterDoctor.value;
  const selDept = elFilterDepartment.value;
  const searchQ = (elFilterSearch.value || "").trim().toLowerCase();

  const matchedPatients = [];
  const doctorStatsMap = {};
  const globalCodesMap = {};
  const seenPatientsMap = new Set();

  if (allFirebaseReports) {
    const dateKeys = Object.keys(allFirebaseReports);

    for (const dKey of dateKeys) {
      // Sana filtri (YYYY-MM-DD taqqoslash)
      if (startDate && dKey < startDate) continue;
      if (endDate && dKey > endDate) continue;

      const dateObj = allFirebaseReports[dKey];
      if (!dateObj || typeof dateObj !== "object") continue;

      const docKeys = Object.keys(dateObj);
      for (const docSlug of docKeys) {
        const rep = dateObj[docSlug];
        if (!rep || !Array.isArray(rep.patientsList)) continue;

        // Shifokor filtri
        if (selDoc !== "ALL" && rep.doctorName && !isDoctorMatch(rep.doctorName, selDoc)) {
          continue;
        }

        rep.patientsList.forEach(pat => {
          // Bemorning o'z shifokorini tekshirish (agar umumiy skanerlangan bo'lsa)
          if (selDoc !== "ALL" && pat.doctorName && !isDoctorMatch(pat.doctorName, selDoc)) {
            return;
          }

          // Bo'lim filtri
          if (selDept !== "ALL") {
            const patDept = (pat.department || pat.priority || "").toLowerCase();
            if (!patDept.includes(selDept.toLowerCase())) return;
          }

          // Qidiruv filtri
          if (searchQ) {
            const patName = (pat.fullName || "").toLowerCase();
            const patId = String(pat.patientId || "").toLowerCase();
            const patDoc = (pat.doctorName || "").toLowerCase();
            const srvCodes = (pat.services || []).map(s => (s.code || "").toLowerCase() + " " + (s.name || "").toLowerCase()).join(" ");

            const isMatch = patName.includes(searchQ) || patId.includes(searchQ) || patDoc.includes(searchQ) || srvCodes.includes(searchQ);
            if (!isMatch) return;
          }

          const uniquePatKey = `${pat.patientId}_${pat.fullName}_${pat.confirmDate}`;
          if (!seenPatientsMap.has(uniquePatKey)) {
            seenPatientsMap.add(uniquePatKey);
            matchedPatients.push(pat);

            // Shifokor agregatsiyasi
            const dName = pat.doctorName || rep.doctorName || "Noma'lum shifokor";
            if (!doctorStatsMap[dName]) {
              doctorStatsMap[dName] = {
                doctorName: dName,
                room: DOCTOR_ROOMS_MAP[dName] || "UTT Xonasi",
                patientsCount: 0,
                servicesCount: 0,
                codesMap: {},
                patients: []
              };
            }
            doctorStatsMap[dName].patientsCount++;
            doctorStatsMap[dName].patients.push(pat);

            const services = pat.services && pat.services.length > 0 ? pat.services : [{ code: "R_GEN", name: "UTT Tekshiruvi" }];
            doctorStatsMap[dName].servicesCount += services.length;

            services.forEach(s => {
              const code = (s.code || "OTHER").toUpperCase();
              const name = s.name || "Tekshiruv";

              // Shifokor ichidagi kod
              doctorStatsMap[dName].codesMap[code] = (doctorStatsMap[dName].codesMap[code] || 0) + 1;

              // Global kod
              if (!globalCodesMap[code]) {
                globalCodesMap[code] = { code, name, count: 0, doctorsMap: {} };
              }
              globalCodesMap[code].count++;
              globalCodesMap[code].doctorsMap[dName] = (globalCodesMap[code].doctorsMap[dName] || 0) + 1;
            });
          }
        });
      }
    }
  }

  // Hisoblashlar yakuni
  const totalPatients = matchedPatients.length;
  let totalServices = 0;
  matchedPatients.forEach(p => {
    totalServices += (p.services ? p.services.length : 1);
  });

  const doctorsSummaryList = Object.values(doctorStatsMap).sort((a, b) => b.patientsCount - a.patientsCount);
  const codesMatrixList = Object.values(globalCodesMap).sort((a, b) => b.count - a.count);

  filteredData = {
    doctorsSummary: doctorsSummaryList,
    patientsList: matchedPatients,
    codesMatrix: codesMatrixList,
    kpis: {
      totalPatients,
      totalServices,
      activeDoctors: doctorsSummaryList.length,
      uniqueCodes: codesMatrixList.length
    }
  };

  renderKPIs(filteredData.kpis);
  renderCharts(doctorsSummaryList, codesMatrixList);
  renderDoctorsSummaryTable(doctorsSummaryList, totalPatients, totalServices);
  renderPatientsRegistryTable(matchedPatients);
  renderCodesMatrixTable(codesMatrixList, totalServices);
}

function isDoctorMatch(docA, docB) {
  if (!docA || !docB) return false;
  const a = docA.toLowerCase().replace(/dr\.|doktor|shifokor|[\s_\-'.]/g, "");
  const b = docB.toLowerCase().replace(/dr\.|doktor|shifokor|[\s_\-'.]/g, "");
  return a.includes(b) || b.includes(a);
}

// 6. RENDER KPIS
function renderKPIs(kpis) {
  elKpiPatients.textContent = kpis.totalPatients;
  elKpiServices.textContent = kpis.totalServices;
  elKpiDoctors.textContent = kpis.activeDoctors;
  elKpiCodes.textContent = kpis.uniqueCodes;

  const ratio = kpis.totalPatients > 0 ? (kpis.totalServices / kpis.totalPatients).toFixed(1) : "0";
  elKpiServicesSub.textContent = `O'rtacha 1 bemorga: ${ratio} ta tekshiruv`;
  elKpiPatientsSub.textContent = `${elFilterStartDate.value || 'Barcha'} — ${elFilterEndDate.value || 'Barcha'}`;

  elBadgePatientsCount.textContent = kpis.totalPatients;
  elBadgeCodesCount.textContent = kpis.uniqueCodes;
}

// 7. RENDER CHARTS (CHART.JS)
function renderCharts(doctorsList, codesList) {
  // 1. Shifokorlar Yuklamasi Diagrammasi
  const ctxDoc = document.getElementById("chartDoctorsWorkload");
  if (ctxDoc) {
    if (chartDoctorsInstance) chartDoctorsInstance.destroy();

    const topDocs = doctorsList.slice(0, 10);
    const labels = topDocs.map(d => {
      const parts = d.doctorName.split(" ");
      return parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : d.doctorName;
    });
    const patientData = topDocs.map(d => d.patientsCount);
    const serviceData = topDocs.map(d => d.servicesCount);

    chartDoctorsInstance = new Chart(ctxDoc, {
      type: "bar",
      data: {
        labels: labels.length > 0 ? labels : ["Ma'lumot yo'q"],
        datasets: [
          {
            label: "Ko'rilgan Bemorlar",
            data: patientData.length > 0 ? patientData : [0],
            backgroundColor: "#0284c7",
            borderRadius: 6
          },
          {
            label: "Bajarilgan Sohalar",
            data: serviceData.length > 0 ? serviceData : [0],
            backgroundColor: "#10b981",
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { weight: "bold", size: 11 } } },
          tooltip: { padding: 10 }
        },
        scales: {
          y: { beginAtZero: true, grid: { color: "#f1f5f9" } },
          x: { grid: { display: false } }
        }
      }
    });
  }

  // 2. Tekshiruv Kodlari Taqsimoti (Pie/Doughnut)
  const ctxSrv = document.getElementById("chartServicesBreakdown");
  if (ctxSrv) {
    if (chartServicesInstance) chartServicesInstance.destroy();

    const topCodes = codesList.slice(0, 6);
    let otherCount = 0;
    codesList.slice(6).forEach(c => otherCount += c.count);

    const labels = topCodes.map(c => `${c.code} (${c.count})`);
    const data = topCodes.map(c => c.count);

    if (otherCount > 0) {
      labels.push(`Boshqalar (${otherCount})`);
      data.push(otherCount);
    }

    const bgColors = ["#0284c7", "#10b981", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4", "#94a3b8"];

    chartServicesInstance = new Chart(ctxSrv, {
      type: "doughnut",
      data: {
        labels: labels.length > 0 ? labels : ["Kodlar mavjud emas"],
        datasets: [{
          data: data.length > 0 ? data : [1],
          backgroundColor: data.length > 0 ? bgColors.slice(0, data.length) : ["#e2e8f0"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "right", labels: { boxWidth: 12, font: { size: 11, weight: "bold" } } }
        },
        cutout: "60%"
      }
    });
  }
}

// 8. RENDER TAB 1: SHIFOKORLAR UMUMIY HISOBOTI
function renderDoctorsSummaryTable(doctorsList, totalPatients, totalServices) {
  if (!doctorsList || doctorsList.length === 0) {
    elTbodyDoctors.innerHTML = `<tr><td colspan="8" class="text-center py-4" style="color:#94a3b8;">Tanlangan parametrlar bo'yicha ma'lumot topilmadi</td></tr>`;
    elTfootDoctors.innerHTML = "";
    return;
  }

  elTbodyDoctors.innerHTML = "";
  doctorsList.forEach((d, idx) => {
    const tr = document.createElement("tr");

    const ratio = d.patientsCount > 0 ? (d.servicesCount / d.patientsCount).toFixed(1) : "0";
    
    // Top 3 kodlar
    const topCodes = Object.keys(d.codesMap)
      .sort((a, b) => d.codesMap[b] - d.codesMap[a])
      .slice(0, 4)
      .map(c => `<span class="code-tag" title="${c}: ${d.codesMap[c]} marta">${c} (${d.codesMap[c]})</span>`)
      .join(" ");

    tr.innerHTML = `
      <td><strong>${idx + 1}</strong></td>
      <td>
        <strong style="color:#0f172a; font-size:13.5px;">${escapeHtml(d.doctorName)}</strong>
      </td>
      <td><span class="badge-stat blue">${escapeHtml(d.room)}</span></td>
      <td style="text-align: center; font-size:14px; font-weight:800; color:#0284c7;">${d.patientsCount}</td>
      <td style="text-align: center; font-size:14px; font-weight:800; color:#10b981;">${d.servicesCount}</td>
      <td style="text-align: center; font-weight:700; color:#64748b;">${ratio}</td>
      <td>${topCodes || '<span style="color:#cbd5e1;">-</span>'}</td>
      <td style="text-align: center;">
        <button type="button" class="btn-detail" onclick="openDoctorDetailsModal('${escapeHtml(d.doctorName)}')">
          <i class="fa-solid fa-eye"></i> Batafsil
        </button>
      </td>
    `;
    elTbodyDoctors.appendChild(tr);
  });

  // Jami tfoot qatori
  elTfootDoctors.innerHTML = `
    <tr>
      <td colspan="3" style="text-align: right;">JAMI:</td>
      <td style="text-align: center; color:#0284c7; font-size:15px;">${totalPatients} nafar</td>
      <td style="text-align: center; color:#10b981; font-size:15px;">${totalServices} ta</td>
      <td style="text-align: center;">${totalPatients > 0 ? (totalServices / totalPatients).toFixed(1) : '0'}</td>
      <td colspan="2"></td>
    </tr>
  `;
}

// 9. RENDER TAB 2: BEMORLAR VA SOHALAR REYESTRI
function renderPatientsRegistryTable(patientsList) {
  if (!patientsList || patientsList.length === 0) {
    elTbodyPatients.innerHTML = `<tr><td colspan="9" class="text-center py-4" style="color:#94a3b8;">Bemorlar reyestri bo'sh</td></tr>`;
    return;
  }

  elTbodyPatients.innerHTML = "";
  patientsList.forEach((p, idx) => {
    const tr = document.createElement("tr");

    const servicesHtml = (p.services || []).map(s => 
      `<span class="code-tag purple" title="${escapeHtml(s.name)}">${escapeHtml(s.code)} - ${escapeHtml(s.name)}</span>`
    ).join("<br>");

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong style="color:#0284c7; font-family:monospace;">${escapeHtml(p.patientId)}</strong></td>
      <td><strong>${escapeHtml(p.fullName)}</strong></td>
      <td><span style="color:#059669; font-weight:700;">${escapeHtml(p.doctorName)}</span></td>
      <td><span style="font-size:12px; color:#475569;">${escapeHtml(p.confirmDate || '-')}</span></td>
      <td>${servicesHtml || '<span class="code-tag">R_GEN</span>'}</td>
      <td style="text-align:center; font-weight:800;">${p.services ? p.services.length : 1}</td>
      <td><span class="badge-stat green">${escapeHtml(p.department || p.priority || 'Statsionar')}</span></td>
      <td><span style="font-size:11.5px; color:#64748b;">${escapeHtml(p.fileDoctor || '-')}</span></td>
    `;
    elTbodyPatients.appendChild(tr);
  });
}

// 10. RENDER TAB 3: TEKSHIRUV KODLARI MATRISASI
function renderCodesMatrixTable(codesList, totalServices) {
  if (!codesList || codesList.length === 0) {
    elTbodyCodes.innerHTML = `<tr><td colspan="5" class="text-center py-4" style="color:#94a3b8;">Tekshiruv kodlari topilmadi</td></tr>`;
    return;
  }

  elTbodyCodes.innerHTML = "";
  codesList.forEach(c => {
    const tr = document.createElement("tr");
    const percent = totalServices > 0 ? ((c.count / totalServices) * 100).toFixed(1) : "0";

    const docBadges = Object.keys(c.doctorsMap)
      .sort((a, b) => c.doctorsMap[b] - c.doctorsMap[a])
      .map(doc => `<span class="code-tag green">${escapeHtml(doc)}: <strong>${c.doctorsMap[doc]}</strong></span>`)
      .join(" ");

    tr.innerHTML = `
      <td><strong class="code-tag" style="font-size:12.5px;">${escapeHtml(c.code)}</strong></td>
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td style="text-align: center; font-weight:800; font-size:14px; color:#0284c7;">${c.count}</td>
      <td style="text-align: center; font-weight:700; color:#10b981;">${percent}%</td>
      <td>${docBadges}</td>
    `;
    elTbodyCodes.appendChild(tr);
  });
}

// 11. SHIFOKOR DETAL MODALI
window.openDoctorDetailsModal = function(doctorName) {
  const docSummary = filteredData.doctorsSummary.find(d => d.doctorName === doctorName);
  if (!docSummary) return;

  document.getElementById("modalDoctorTitle").textContent = docSummary.doctorName;
  document.getElementById("modalDoctorSubtitle").textContent = `${docSummary.room} | Jami: ${docSummary.patientsCount} ta bemor, ${docSummary.servicesCount} ta tekshiruv`;

  const kpiRow = document.getElementById("modalDoctorKpis");
  kpiRow.innerHTML = `
    <div class="modal-kpi-box">
      <div class="m-val">${docSummary.patientsCount}</div>
      <div class="m-lbl">Bemorlar</div>
    </div>
    <div class="modal-kpi-box">
      <div class="m-val" style="color:#10b981;">${docSummary.servicesCount}</div>
      <div class="m-lbl">Tekshiruv Sohalari</div>
    </div>
    <div class="modal-kpi-box">
      <div class="m-val" style="color:#8b5cf6;">${docSummary.patientsCount > 0 ? (docSummary.servicesCount / docSummary.patientsCount).toFixed(1) : 0}</div>
      <div class="m-lbl">O'rtacha Soha / Bemor</div>
    </div>
  `;

  const tbody = document.getElementById("modalDoctorPatientsTbody");
  tbody.innerHTML = "";

  docSummary.patients.forEach((p, idx) => {
    const tr = document.createElement("tr");
    const srvs = (p.services || []).map(s => `<span class="code-tag purple">${s.code}</span>`).join(" ");

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(p.patientId)}</strong></td>
      <td>${escapeHtml(p.fullName)}</td>
      <td>${escapeHtml(p.confirmDate || '-')}</td>
      <td>${srvs || '<span class="code-tag">R_GEN</span>'}</td>
      <td>${escapeHtml(p.department || p.priority || '')}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById("doctorDetailsModal").style.display = "flex";
};

function closeDoctorModal() {
  document.getElementById("doctorDetailsModal").style.display = "none";
}

// 12. EXCEL GA EKSPORT QILISH (SHEETJS)
function exportToExcel() {
  if (typeof XLSX === "undefined") {
    alert("SheetJS kutubxonasi yuklanmadi. Iltimos, internet ulanishini tekshiring.");
    return;
  }

  const wb = XLSX.utils.book_new();

  // 1. Shifokorlar xulosasi varag'i
  const summaryRows = [
    ["RESPUBLIKA IXTISOSLASHTIRILGAN ONKOLOGIYA VA RADIOLOGIYA ILMIY-AMALIY TIBBIYOT MARKAZI"],
    ["SHIFOKORLAR KO'RGAN BEMORLAR VA TEKSHIRUV SOHALARI HISOBOTI"],
    [`Davr: ${elFilterStartDate.value || 'Barcha'} dan ${elFilterEndDate.value || 'Barcha'} gacha`],
    [],
    ["T/r", "Shifokor F.I.SH", "Xonasi", "Ko'rilgan Bemorlar Soni", "Bajarilgan Sohalar Soni", "O'rtacha Soha/Bemor"]
  ];

  filteredData.doctorsSummary.forEach((d, idx) => {
    const ratio = d.patientsCount > 0 ? (d.servicesCount / d.patientsCount).toFixed(1) : "0";
    summaryRows.push([idx + 1, d.doctorName, d.room, d.patientsCount, d.servicesCount, Number(ratio)]);
  });

  summaryRows.push([]);
  summaryRows.push(["JAMI:", "", "", filteredData.kpis.totalPatients, filteredData.kpis.totalServices, ""]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Shifokorlar Hisoboti");

  // 2. Bemorlar reyestri varag'i
  const patientRows = [
    ["T/r", "Bemor ID", "Bemor F.I.SH", "Qabul Qiluvchi Shifokor", "Tasdiqlangan Sana", "Tekshiruv Kodlari", "Tekshiruv Sohalari Nomi", "Bo'lim", "Fayl Shifokori"]
  ];

  filteredData.patientsList.forEach((p, idx) => {
    const codes = (p.services || []).map(s => s.code).join(", ");
    const names = (p.services || []).map(s => s.name).join(", ");
    patientRows.push([
      idx + 1,
      p.patientId,
      p.fullName,
      p.doctorName,
      p.confirmDate,
      codes || "R_GEN",
      names || "Tekshiruv",
      p.department || p.priority || "Statsionar",
      p.fileDoctor || ""
    ]);
  });

  const wsPatients = XLSX.utils.aoa_to_sheet(patientRows);
  XLSX.utils.book_append_sheet(wb, wsPatients, "Bemorlar Reyestri");

  const fileName = `Karmed_Hisobchi_Tahlil_${elFilterStartDate.value || 'davr'}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// 13. CSV FORMATIDA YUKLASH
function exportToCSV() {
  let csvContent = "\uFEFF"; // UTF-8 BOM
  csvContent += "T/r;Bemor ID;Bemor F.I.SH;Qabul Qiluvchi Shifokor;Tasdiqlangan Sana;Tekshiruv Kodlari;Sohalar Soni;Bo'lim\n";

  filteredData.patientsList.forEach((p, idx) => {
    const codes = (p.services || []).map(s => s.code).join("+");
    const count = p.services ? p.services.length : 1;
    csvContent += `"${idx + 1}";"${p.patientId}";"${p.fullName}";"${p.doctorName}";"${p.confirmDate}";"${codes}";"${count}";"${p.department || ''}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", `Karmed_Bemorlar_Reyestri_${elFilterStartDate.value || 'sana'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 14. RASMIY A4 CHOP ETISH
function printOfficialReport() {
  const container = document.getElementById("printTableContainer");
  const metaLine = document.getElementById("printMetaLine");

  metaLine.textContent = `Hisobot davri: ${elFilterStartDate.value || 'Barcha'} — ${elFilterEndDate.value || 'Barcha'} | Shifokor: ${elFilterDoctor.value !== 'ALL' ? elFilterDoctor.value : 'Barcha shifokorlar'} | Jami: ${filteredData.kpis.totalPatients} bemor, ${filteredData.kpis.totalServices} soha`;

  let html = `
    <table class="print-table">
      <thead>
        <tr>
          <th>T/r</th>
          <th>Shifokor F.I.SH</th>
          <th>Xonasi</th>
          <th>Ko'rilgan Bemorlar Soni</th>
          <th>Bajarilgan Sohalar Soni</th>
          <th>Bemor boshiga o'rtacha</th>
          <th>Eng faol tekshiruv kodlari</th>
        </tr>
      </thead>
      <tbody>
  `;

  filteredData.doctorsSummary.forEach((d, idx) => {
    const ratio = d.patientsCount > 0 ? (d.servicesCount / d.patientsCount).toFixed(1) : "0";
    const topCodes = Object.keys(d.codesMap)
      .sort((a, b) => d.codesMap[b] - d.codesMap[a])
      .slice(0, 4)
      .map(c => `${c}: ${d.codesMap[c]}`)
      .join(", ");

    html += `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${escapeHtml(d.doctorName)}</strong></td>
        <td>${escapeHtml(d.room)}</td>
        <td style="text-align:center;">${d.patientsCount}</td>
        <td style="text-align:center;">${d.servicesCount}</td>
        <td style="text-align:center;">${ratio}</td>
        <td>${topCodes || '-'}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
      <tfoot>
        <tr style="font-weight:bold; background:#f0f0f0;">
          <td colspan="3" style="text-align:right;">JAMI:</td>
          <td style="text-align:center;">${filteredData.kpis.totalPatients}</td>
          <td style="text-align:center;">${filteredData.kpis.totalServices}</td>
          <td style="text-align:center;">${filteredData.kpis.totalPatients > 0 ? (filteredData.kpis.totalServices / filteredData.kpis.totalPatients).toFixed(1) : 0}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;

  container.innerHTML = html;
  window.print();
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
