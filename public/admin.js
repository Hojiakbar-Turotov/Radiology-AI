/**
 * public/admin.js
 * KARMED UTT — RAHBARIYAT VA ADMIN STRATEGIK ANALITIKA DASHBORTI
 * 
 * Qoidalar:
 * - Faqat qo'lda so'rov orqali yangilanadi (Avto-polling va SSE yo'q)
 * - Tezkor kesh orqali ishlaydi (Keshdan 50ms da ochiladi)
 * - 10 ta UTT shifokori, davolovchilar reytingi, kunlik dinamika va 160 ta narxlar katalogi
 */

(function () {
  'use strict';

  // State
  let currentReport = null;
  let priceCatalog = null;
  let currentDoctorModalData = null;
  let currentPatientsPage = 1;
  let patientPageSize = 100;
  let filteredPatientsCache = [];
  let priceModalityFilter = 'ALL';
  let hideFinancials = false;
  let matrixMode = 'utt-first'; // 'utt-first' or 'ref-first'

  // DOM Elements
  const clockEl = document.getElementById('admin-clock');
  const startDateInput = document.getElementById('input-start-date');
  const endDateInput = document.getElementById('input-end-date');
  const btnFetchReport = document.getElementById('btn-fetch-report');
  const btnForceRefresh = document.getElementById('btn-force-refresh');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const cacheIndicator = document.getElementById('cache-indicator');
  const dateSummaryText = document.getElementById('date-summary-text');

  // KPI Elements
  const kpiTotalReferred = document.getElementById('kpi-total-referred');
  const kpiTotalCompleted = document.getElementById('kpi-total-completed');
  const kpiCompletedPct = document.getElementById('kpi-completed-pct');
  const kpiTotalWaiting = document.getElementById('kpi-total-waiting');
  const kpiTotalAccepted = document.getElementById('kpi-total-accepted');
  const kpiTotalRevenue = document.getElementById('kpi-total-revenue');

  // Modal Elements
  const doctorModal = document.getElementById('doctor-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalDoctorTitle = document.getElementById('modal-doctor-title');
  const modalDoctorSubtitle = document.getElementById('modal-doctor-subtitle');
  const modalPatientSearch = document.getElementById('modal-patient-search');
  const modalStatusFilter = document.getElementById('modal-status-filter');
  const modalStatsSummary = document.getElementById('modal-stats-summary');
  const tbodyModalPatients = document.getElementById('tbody-modal-patients');
  const btnExportModalCsv = document.getElementById('btn-export-modal-csv');

  // Clock
  function updateClock() {
    const d = new Date();
    const pad = n => (n < 10 ? '0' : '') + n;
    if (clockEl) {
      clockEl.innerText = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Format Helpers
  function formatMoney(num) {
    if (hideFinancials) return "••••••";
    if (!num) return "0 so'm";
    return Number(num).toLocaleString('uz-UZ') + " so'm";
  }

  function formatNumber(num) {
    if (!num) return "0";
    return Number(num).toLocaleString('uz-UZ');
  }

  // Date Formatting & Dynamic Presets
  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function formatDateDDMMYYYY(d) {
    return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function getTodayString() {
    return formatDateDDMMYYYY(new Date());
  }

  function getMonthNameUz(monthIdx) {
    const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
    return months[monthIdx] || '';
  }

  let currentActivePreset = 'today';

  function updateAutoRefreshBadge() {
    const autoBadge = document.getElementById('auto-refresh-status');
    if (!autoBadge) return;
    const todayStr = getTodayString();
    const isTodaySelected = (currentActivePreset === 'today') &&
                            startDateInput && endDateInput &&
                            (startDateInput.value.trim() === todayStr) &&
                            (endDateInput.value.trim() === todayStr);

    if (isTodaySelected) {
      autoBadge.textContent = '🟢 Jonli avto-yangilanish: Faol (45s)';
      autoBadge.style.color = '#38bdf8';
      autoBadge.style.background = 'rgba(56,189,248,0.15)';
      autoBadge.style.borderColor = 'rgba(56,189,248,0.3)';
    } else {
      autoBadge.textContent = "⏸️ Avto-yangilanish: O'chirilgan (Boshqa muddat)";
      autoBadge.style.color = '#94a3b8';
      autoBadge.style.background = 'rgba(148,163,184,0.1)';
      autoBadge.style.borderColor = 'rgba(148,163,184,0.2)';
    }
  }

  function applyDatePreset(preset, autoFetch = true) {
    currentActivePreset = preset;
    const now = new Date();
    const todayStr = getTodayString();

    document.querySelectorAll('.btn-preset').forEach(b => {
      if (b.getAttribute('data-preset') === preset) b.classList.add('active');
      else b.classList.remove('active');
    });

    if (preset === 'today') {
      startDateInput.value = todayStr;
      endDateInput.value = todayStr;
    } else if (preset === '7days') {
      const d7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDateInput.value = formatDateDDMMYYYY(d7);
      endDateInput.value = todayStr;
    } else if (preset === 'september' || preset === 'currentMonth') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      startDateInput.value = formatDateDDMMYYYY(firstDay);
      endDateInput.value = todayStr;
    } else if (preset === 'august' || preset === 'lastMonth') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      startDateInput.value = formatDateDDMMYYYY(firstDayLastMonth);
      endDateInput.value = formatDateDDMMYYYY(lastDayLastMonth);
    } else if (preset === '2month') {
      const firstDay2mAgo = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDateInput.value = formatDateDDMMYYYY(firstDay2mAgo);
      endDateInput.value = todayStr;
    }

    updateAutoRefreshBadge();

    if (autoFetch) {
      // Agar "Bugun" bo'lsa, Karmeddan har doim yangi jonli ma'lumotni tortib oladi
      const isToday = (preset === 'today');
      fetchAnalyticsReport(isToday);
    }
  }

  // Theme Management
  function initTheme() {
    const savedTheme = localStorage.getItem('karmed_admin_theme') || 'dark';
    applyTheme(savedTheme);
  }

  function applyTheme(theme) {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      if (toggleBtn) {
        toggleBtn.innerHTML = '<span class="theme-icon">☀️</span> <span class="theme-text">Kunduzgi rejim</span>';
      }
    } else {
      document.body.classList.remove('light-theme');
      if (toggleBtn) {
        toggleBtn.innerHTML = '<span class="theme-icon">🌙</span> <span class="theme-text">Tungi rejim</span>';
      }
    }
    localStorage.setItem('karmed_admin_theme', theme);
  }

  function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    applyTheme(isLight ? 'dark' : 'light');
  }

  // Money Visibility Management (Summalarni ko'rsatish / yashirish)
  function initMoneyVisibility() {
    const savedState = localStorage.getItem('karmed_admin_hide_money');
    hideFinancials = savedState === 'true';
    applyMoneyVisibility(hideFinancials);
  }

  function applyMoneyVisibility(hide) {
    hideFinancials = hide;
    const btn = document.getElementById('btn-money-toggle');
    if (btn) {
      if (hide) {
        btn.classList.add('hidden-mode');
        btn.innerHTML = '<span class="money-icon">🙈</span> <span class="money-text">Summalar: Yashirilgan</span>';
      } else {
        btn.classList.remove('hidden-mode');
        btn.innerHTML = '<span class="money-icon">👁️</span> <span class="money-text">Summalar: Ko\'rsatilgan</span>';
      }
    }
    localStorage.setItem('karmed_admin_hide_money', String(hide));
    renderAll();
    renderPrices();
    if (currentDoctorModalData) {
      renderDoctorModalPatients();
    }
  }

  function toggleMoneyVisibility() {
    applyMoneyVisibility(!hideFinancials);
  }

  // Sanani to'g'rilash (masalan, 31.06 kabi mavjud bo'lmagan kunlarni oyning oxirgi kuniga, masalan 30.06 ga moslash)
  function sanitizeDateStr(dStr) {
    if (!dStr) return dStr;
    const parts = String(dStr).trim().split('.');
    if (parts.length !== 3) return dStr;
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10);
    let year = parseInt(parts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return dStr;
    if (month < 1) month = 1;
    if (month > 12) month = 12;
    const maxDays = new Date(year, month, 0).getDate();
    if (day > maxDays) day = maxDays;
    if (day < 1) day = 1;
    const pad = n => (n < 10 ? '0' : '') + n;
    return `${pad(day)}.${pad(month)}.${year}`;
  }

  // =========================================================================
  // 1. HISOBOTNI SERVERDAN YUKLASH (KESH YOKI JONLI SO'ROV)
  // =========================================================================
  async function fetchAnalyticsReport(forceRefresh = false) {
    const todayStr = getTodayString();
    let startDate = (startDateInput.value || todayStr).trim();
    let endDate = (endDateInput.value || todayStr).trim();

    // Noto'g'ri kalendar sanalarini (masalan, 31.06) avtomatik to'g'rilash
    const cleanStart = sanitizeDateStr(startDate);
    const cleanEnd = sanitizeDateStr(endDate);
    if (cleanStart !== startDate) {
      startDate = cleanStart;
      startDateInput.value = cleanStart;
    }
    if (cleanEnd !== endDate) {
      endDate = cleanEnd;
      endDateInput.value = cleanEnd;
    }
    if (!startDateInput.value) startDateInput.value = startDate;
    if (!endDateInput.value) endDateInput.value = endDate;

    // Loading status
    if (cacheIndicator) {
      cacheIndicator.innerText = forceRefresh 
        ? "⏳ Karmed serveridan jonli ma'lumotlar yuklanmoqda (taxminan 3-5 soniya)..." 
        : "⏳ Ma'lumotlar yuklanmoqda...";
      cacheIndicator.style.color = "#fbbf24";
    }

    if (btnFetchReport) btnFetchReport.disabled = true;
    if (btnForceRefresh) btnForceRefresh.disabled = true;

    try {
      const response = await fetch('/api/admin/analytics-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, forceRefresh })
      });

      if (!response.ok) {
        throw new Error(`Server xatosi: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || "Hisobotni olib bo'lmadi");
      }

      currentReport = data;
      renderAll();

      if (cacheIndicator) {
        const timeStr = data.cachedAt ? new Date(data.cachedAt).toLocaleTimeString('uz-UZ') : '';
        if (data.cached) {
          cacheIndicator.innerText = `⚡ Keshdan yuklandi (${timeStr}) • ${formatNumber(data.summary.totalReferred)} ta bemor`;
          cacheIndicator.style.color = "#34d399";
        } else {
          cacheIndicator.innerText = `🟢 Jonli Karmeddan olindi (${timeStr}) • ${formatNumber(data.summary.totalReferred)} ta bemor`;
          cacheIndicator.style.color = "#38bdf8";
        }
      }

      if (dateSummaryText) {
        dateSummaryText.innerText = `Muddat: ${startDate} — ${endDate}`;
      }

    } catch (err) {
      console.error('[Admin Analytics Fetch Error]:', err);
      if (cacheIndicator) {
        cacheIndicator.innerText = `❌ Xatolik: ${err.message}`;
        cacheIndicator.style.color = "#f43f5e";
      }
      alert(`Hisobotni olishda xatolik yuz berdi:\n${err.message}`);
    } finally {
      if (btnFetchReport) btnFetchReport.disabled = false;
      if (btnForceRefresh) btnForceRefresh.disabled = false;
    }
  }

  // =========================================================================
  // 2. NARXLAR TARIFNOMASINI YUKLASH
  // =========================================================================
  async function fetchPriceCatalog() {
    try {
      const res = await fetch('/api/admin/price-catalog');
      if (res.ok) {
        priceCatalog = await res.json();
        renderPrices();
      }
    } catch (e) {
      console.warn('Narxlar katalogini yuklashda ogohlantirish:', e.message);
    }
  }

  // =========================================================================
  // 3. ASOSIY RENDERERLAR
  // =========================================================================
  function renderAll() {
    if (!currentReport) return;
    renderKPIs();
    renderDoctors();
    renderCrossMatrix();
    renderReferrals();
    renderTimeline();
    renderPatientsFilterOptions();
    renderPatientsTable();
  }

  // KPI CARDS
  function renderKPIs() {
    const s = currentReport.summary || {};
    kpiTotalReferred.innerText = formatNumber(s.totalReferred || 0);
    kpiTotalCompleted.innerText = formatNumber(s.totalCompleted || 0);
    kpiCompletedPct.innerText = s.completedPercent || '0%';
    kpiTotalWaiting.innerText = formatNumber(s.totalWaiting || 0);
    kpiTotalAccepted.innerText = formatNumber(s.totalAccepted || 0);
    kpiTotalRevenue.innerText = formatMoney(s.totalRevenue || 0);

    const kpiDiscrepancies = document.getElementById('kpi-total-discrepancies');
    const kpiDiscrepancyPct = document.getElementById('kpi-discrepancy-pct');
    if (kpiDiscrepancies) kpiDiscrepancies.innerText = formatNumber(s.totalDiscrepancies || 0);
    if (kpiDiscrepancyPct) kpiDiscrepancyPct.innerText = s.discrepancyPercent || '0%';

    const quickDiscCount = document.getElementById('quick-discrepancy-count');
    if (quickDiscCount) quickDiscCount.innerText = `${formatNumber(s.totalDiscrepancies || 0)} ta bemor`;

    const hintEl = document.getElementById('kpi-residency-hint');
    if (hintEl && s.rezidentCount !== undefined) {
      hintEl.innerText = `Rezident: ${formatNumber(s.rezidentCount)} | No-rezident: ${formatNumber(s.noRezidentCount)} | Sug'urta: ${formatNumber(s.sugurtaCount)}`;
    }
  }

  // TAB 1: DOCTORS CARDS & TABLE
  function renderDoctors() {
    const container = document.getElementById('doctors-cards-container');
    const tbody = document.getElementById('tbody-doctors-summary');
    if (!container || !tbody) return;

    const filterQuery = (document.getElementById('filter-doc-input')?.value || '').toLowerCase().trim();
    const doctors = (currentReport.byDoctor || []).filter(d => {
      if (!filterQuery) return true;
      return (d.roomId || '').toLowerCase().includes(filterQuery) ||
             (d.doctorName || '').toLowerCase().includes(filterQuery) ||
             (d.shortName || '').toLowerCase().includes(filterQuery);
    });

    // Render Cards
    container.innerHTML = '';
    if (doctors.length === 0) {
      container.innerHTML = '<div class="loading-box">Vrachlar topilmadi</div>';
    } else {
      doctors.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'doctor-card';
        card.innerHTML = `
          <div class="doc-card-header">
            <span class="doc-room-badge">${doc.roomTitle || doc.roomId}</span>
            <div class="doc-info">
              <div class="doc-name">${doc.doctorName || 'Shifokor biriktirilmagan'}</div>
              <div class="doc-title">${doc.shortName || doc.roomId} • Mutaxassis</div>
            </div>
          </div>

          <div class="doc-stats-table">
            <div class="doc-stat-item">
              <div class="doc-stat-val">${formatNumber(doc.totalCount)}</div>
              <div class="doc-stat-lbl">Jami Bemor</div>
            </div>
            <div class="doc-stat-item">
              <div class="doc-stat-val val-green">${formatNumber(doc.completedCount)}</div>
              <div class="doc-stat-lbl">O'tgan (${doc.completionRate})</div>
            </div>
            <div class="doc-stat-item">
              <div class="doc-stat-val val-amber">${formatNumber(doc.waitingCount)}</div>
              <div class="doc-stat-lbl">Kutmoqda</div>
            </div>
          </div>

          <div class="doc-revenue-bar">
            <span class="doc-rev-title">Qabul qilingan tushum:</span>
            <span class="doc-rev-sum">${formatMoney(doc.revenue)}</span>
          </div>

          <div class="doc-card-actions">
            <button type="button" class="btn-view-patients" data-room-id="${doc.roomId}">
              👥 Bemorlar Ro'yxati (${formatNumber(doc.totalCount)} ta)
            </button>
          </div>
        `;
        container.appendChild(card);
      });
    }

    // Attach click listeners for "Bemorlar Ro'yxati" buttons
    container.querySelectorAll('.btn-view-patients').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-room-id');
        openDoctorModal(roomId);
      });
    });

    // Render Table
    tbody.innerHTML = '';
    doctors.forEach(doc => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${doc.roomTitle || doc.roomId}</strong></td>
        <td>${doc.doctorName || '—'}</td>
        <td class="text-right"><strong>${formatNumber(doc.totalCount)}</strong></td>
        <td class="text-right" style="color:#34d399; font-weight:700;">${formatNumber(doc.completedCount)}</td>
        <td class="text-right" style="color:#fbbf24;">${formatNumber(doc.waitingCount)}</td>
        <td class="text-right" style="color:#a5b4fc;">${formatNumber(doc.acceptedCount)}</td>
        <td class="text-center"><span class="badge-pct">${doc.completionRate}</span></td>
        <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(doc.revenue)}</td>
        <td class="text-center">
          <button type="button" class="btn-preset btn-table-view" data-room-id="${doc.roomId}">Ro'yxat</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-table-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-room-id');
        openDoctorModal(roomId);
      });
    });
  }

  // TAB 2: REFERRALS (DAVOLOVCHILAR REYTINGI)
  function renderReferrals() {
    const podiumContainer = document.getElementById('top-podium-container');
    const tbody = document.getElementById('tbody-referrals');
    const badgeCount = document.getElementById('badge-ref-count');
    if (!podiumContainer || !tbody) return;

    const filterQuery = (document.getElementById('filter-ref-input')?.value || '').toLowerCase().trim();
    const list = (currentReport.byReferringDoctor || []).filter(r => {
      if (!filterQuery) return true;
      return (r.name || '').toLowerCase().includes(filterQuery) ||
             (r.dept || '').toLowerCase().includes(filterQuery);
    });

    if (badgeCount) badgeCount.innerText = `${formatNumber(list.length)} shifokor`;

    // Render Top 3 Podium
    podiumContainer.innerHTML = '';
    const top3 = list.slice(0, 3);
    const podiumIcons = ['🥇', '🥈', '🥉'];
    const podiumClasses = ['podium-1', 'podium-2', 'podium-3'];

    top3.forEach((r, idx) => {
      const card = document.createElement('div');
      card.className = `podium-card ${podiumClasses[idx]}`;
      card.innerHTML = `
        <div class="podium-rank">${podiumIcons[idx]} #${idx + 1}</div>
        <div class="podium-doc-name">${r.name}</div>
        <div class="podium-dept">${r.dept || 'Ambulator'}</div>
        <div class="podium-metrics">
          <div>
            <div class="podium-stat-val">${formatNumber(r.totalSent)}</div>
            <div class="podium-stat-lbl">Yuborgan</div>
          </div>
          <div>
            <div class="podium-stat-val" style="color:#34d399;">${formatNumber(r.completed)}</div>
            <div class="podium-stat-lbl">O'tgan (${r.sharePercent})</div>
          </div>
          <div>
            <div class="podium-stat-val" style="color:#34d399;">${formatMoney(r.revenue)}</div>
            <div class="podium-stat-lbl">Tushum</div>
          </div>
        </div>
      `;
      podiumContainer.appendChild(card);
    });

    // Render Table
    tbody.innerHTML = '';
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">Davolovchi shifokorlar topilmadi</td></tr>';
      return;
    }

    list.forEach((r, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center"><strong>#${idx + 1}</strong></td>
        <td><strong>${r.name}</strong></td>
        <td>${r.dept || 'Ambulator'}</td>
        <td class="text-right"><strong>${formatNumber(r.totalSent)}</strong></td>
        <td class="text-right" style="color:#34d399;">${formatNumber(r.completed)}</td>
        <td class="text-right" style="color:#fbbf24;">${formatNumber(r.waiting)}</td>
        <td class="text-center"><span class="badge-pct">${r.sharePercent}</span></td>
        <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(r.revenue)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // TAB 3: TIMELINE (KUNLIK DINAMIKA)
  function renderTimeline() {
    const tbody = document.getElementById('tbody-timeline');
    const badgeDays = document.getElementById('badge-days-count');
    if (!tbody) return;

    const days = currentReport.dailyTimeline || [];
    if (badgeDays) badgeDays.innerText = `${days.length} kun`;

    tbody.innerHTML = '';
    if (days.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Kunlik ma\'lumotlar mavjud emas</td></tr>';
      return;
    }

    // Find max for bar scaling
    const maxCount = Math.max(...days.map(d => d.total || 0), 1);

    days.forEach(d => {
      const pct = Math.min(100, Math.round(((d.total || 0) / maxCount) * 100));
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>📅 ${d.date}</strong></td>
        <td class="text-right"><strong>${formatNumber(d.total)}</strong> ta</td>
        <td>
          <div class="timeline-bar-bg">
            <div class="timeline-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </td>
        <td class="text-right" style="color:#34d399;">${formatNumber(d.completed)} ta</td>
        <td class="text-center"><span class="badge-pct">${d.completedPercent || '0%'}</span></td>
        <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(d.revenue)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Format & Badge Helpers
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function renderCitizenshipBadge(p) {
    const type = p.patientType || 'sugurta';
    const kurum = (p.kurumAdi || p.citizenshipTitle || "Sug'urta").trim();

    if (type === 'rezident') {
      return `
        <div class="patient-type-cell">
          <span class="badge-type badge-type-resident" title="Karmed: ${escapeHtml(kurum)}">🇺🇿 Rezident</span>
          <span class="patient-type-sub">O'zbekiston fuqarosi</span>
        </div>
      `;
    } else if (type === 'norezident') {
      return `
        <div class="patient-type-cell">
          <span class="badge-type badge-type-foreign" title="Karmed: ${escapeHtml(kurum)}">🌐 No-rezident</span>
          <span class="patient-type-sub">Chet el fuqarosi</span>
        </div>
      `;
    } else {
      // Sug'urta, Orderli, Vaqf...
      let icon = '🏥';
      let label = "Sug'urta";
      const kLower = kurum.toLowerCase();
      if (kLower.includes('orderli')) {
        icon = '📜';
        label = 'Orderli';
      } else if (kLower.includes('vaqf')) {
        icon = '🤝';
        label = 'Vaqf';
      } else if (kLower.includes('rambac') || kLower.includes('xodimlarni')) {
        icon = '🏢';
        label = 'Shartnoma';
      }
      return `
        <div class="patient-type-cell">
          <span class="badge-type badge-type-insurance" title="Karmed: ${escapeHtml(kurum)}">${icon} ${escapeHtml(label)}</span>
          <span class="patient-type-sub" title="${escapeHtml(kurum)}">${escapeHtml(kurum)}</span>
        </div>
      `;
    }
  }

  // TAB 4: ADVANCED PATIENTS JOURNAL
  function renderPatientsFilterOptions() {
    const selectRoom = document.getElementById('patient-filter-room');
    if (!selectRoom || !currentReport) return;

    // Preserve selection
    const prev = selectRoom.value;
    selectRoom.innerHTML = '<option value="ALL">Barcha Xonalar</option>';

    (currentReport.byDoctor || []).forEach(doc => {
      const opt = document.createElement('option');
      opt.value = doc.roomId;
      opt.innerText = `${doc.roomTitle || doc.roomId} (${doc.doctorName})`;
      selectRoom.appendChild(opt);
    });

    if (prev) selectRoom.value = prev;
  }

  function filterPatientsList() {
    if (!currentReport || !Array.isArray(currentReport.allPatients)) return [];

    const q = (document.getElementById('patient-search-query')?.value || '').toLowerCase().trim();
    const room = document.getElementById('patient-filter-room')?.value || 'ALL';
    const status = document.getElementById('patient-filter-status')?.value || 'ALL';
    const discrepancy = document.getElementById('patient-filter-discrepancy')?.value || 'ALL';
    const type = document.getElementById('patient-filter-type')?.value || 'ALL';

    return currentReport.allPatients.filter(p => {
      if (room !== 'ALL' && p.roomId !== room) return false;
      if (status !== 'ALL' && p.statusCategory !== status) return false;
      if (discrepancy === 'DISCREPANCY_ONLY' && !p.hasDiscrepancy) return false;
      if (discrepancy === 'MATCH_ONLY' && p.hasDiscrepancy) return false;
      if (type !== 'ALL') {
        if (type === 'rezident' && p.patientType !== 'rezident') return false;
        if (type === 'norezident' && p.patientType !== 'norezident') return false;
        if (type === 'sugurta' && p.patientType !== 'sugurta') return false;
      }
      if (q) {
        const idMatch = (p.patientId || '').toLowerCase().includes(q);
        const nameMatch = (p.fullName || '').toLowerCase().includes(q);
        const dosyaMatch = (p.dosyaNo || '').toLowerCase().includes(q);
        const kurumMatch = (p.kurumAdi || '').toLowerCase().includes(q);
        const docMatch = (p.acceptingDoctorName || p.acceptingDoctor || p.reportAuthorDoctor || p.reportAuthor || '').toLowerCase().includes(q);
        const refMatch = (p.referringDoctor || '').toLowerCase().includes(q);
        const organMatch = (p.serviceName || '').toLowerCase().includes(q) || (p.diagnosis || '').toLowerCase().includes(q);
        if (!idMatch && !nameMatch && !dosyaMatch && !kurumMatch && !docMatch && !refMatch && !organMatch) return false;
      }
      return true;
    });
  }

  function renderOrganBadge(p) {
    const count = p.servicesCount || (p.services && p.services.length) || 1;
    if (count > 1) {
      return `<button type="button" class="badge-organ multi clickable" onclick="openPatientDetailModalByLabId('${p.labDosyaId}')" title="${count} ta tekshiruv organini ko'rish uchun bosing">🔬 ${count} ta organ 👁️</button>`;
    }
    const sName = p.serviceName || 'UTT Tekshiruvi';
    return `<button type="button" class="badge-organ single clickable" onclick="openPatientDetailModalByLabId('${p.labDosyaId}')" title="${escapeHtml(sName)}">🔬 1 ta organ</button>`;
  }

  function renderDiscrepancyBadge(p) {
    if (p.hasDiscrepancy) {
      return `<span class="badge-discrepancy warning clickable" onclick="openPatientDetailModalByLabId('${p.labDosyaId}')" title="${escapeHtml(p.discrepancyText || 'Boshqa vrach qabul qilgan')}">⚠️ Farq bor</span>`;
    }
    if (p.statusCategory === 'waiting') {
      return `<span class="badge-discrepancy" style="background:rgba(148, 163, 184, 0.15); color:#94a3b8; border:1px solid rgba(148, 163, 184, 0.3);">⏳ Kutilmoqda</span>`;
    }
    return `<span class="badge-discrepancy match">✓ Bir xil</span>`;
  }

  function renderPatientsTable() {
    const tbody = document.getElementById('tbody-patients');
    const matchedCountEl = document.getElementById('patients-matched-count');
    const pageInfoEl = document.getElementById('patients-page-info');
    const paginationEl = document.getElementById('pagination-controls');
    if (!tbody) return;

    filteredPatientsCache = filterPatientsList();
    const total = filteredPatientsCache.length;
    if (matchedCountEl) matchedCountEl.innerText = formatNumber(total);

    const totalPages = Math.ceil(total / patientPageSize) || 1;
    if (currentPatientsPage > totalPages) currentPatientsPage = totalPages;
    if (currentPatientsPage < 1) currentPatientsPage = 1;

    const startIdx = (currentPatientsPage - 1) * patientPageSize;
    const endIdx = Math.min(startIdx + patientPageSize, total);

    if (pageInfoEl) {
      pageInfoEl.innerText = total > 0 
        ? `(${startIdx + 1}-${endIdx} / jami ${formatNumber(total)} ta ko'rsatilmoqda)` 
        : "(0 ta)";
    }

    // Pagination controls
    if (paginationEl) {
      paginationEl.innerHTML = `
        <button type="button" class="btn-page" id="btn-page-prev" ${currentPatientsPage <= 1 ? 'disabled' : ''}>◀ Oldingi</button>
        <span style="font-size:12px; color:#94a3b8;">Sahifa ${currentPatientsPage} / ${totalPages}</span>
        <button type="button" class="btn-page" id="btn-page-next" ${currentPatientsPage >= totalPages ? 'disabled' : ''}>Keyingi ▶</button>
      `;

      document.getElementById('btn-page-prev')?.addEventListener('click', () => {
        if (currentPatientsPage > 1) {
          currentPatientsPage--;
          renderPatientsTable();
        }
      });
      document.getElementById('btn-page-next')?.addEventListener('click', () => {
        if (currentPatientsPage < totalPages) {
          currentPatientsPage++;
          renderPatientsTable();
        }
      });
    }

    tbody.innerHTML = '';
    if (total === 0) {
      tbody.innerHTML = '<tr><td colspan="14" class="text-center">Bemorlar topilmadi</td></tr>';
      return;
    }

    const pageSlice = filteredPatientsCache.slice(startIdx, endIdx);
    pageSlice.forEach((p, idx) => {
      const tr = document.createElement('tr');
      if (p.hasDiscrepancy) {
        tr.classList.add('row-discrepancy-highlight');
      }

      let badgeClass = 'badge-waiting';
      if (p.statusCategory === 'completed') badgeClass = 'badge-completed';
      else if (p.statusCategory === 'accepted') badgeClass = 'badge-accepted';
      else if (p.statusCategory === 'writing') badgeClass = 'badge-writing';
      else if (p.statusCategory === 'cancelled') badgeClass = 'badge-cancelled';

      tr.innerHTML = `
        <td>${startIdx + idx + 1}</td>
        <td><strong>${escapeHtml(p.patientId || '—')}</strong></td>
        <td>${escapeHtml(p.dosyaNo || '—')}</td>
        <td>
          <span class="patient-name-link clickable" onclick="openPatientDetailModalByLabId('${p.labDosyaId}')" title="Karmed tashxisi va barcha javoblarini ko'rish uchun bosing">
            <strong>${escapeHtml(p.fullName || '—')}</strong> 🔍
          </span>
        </td>
        <td>${renderCitizenshipBadge(p)}</td>
        <td>${escapeHtml(p.date || '—')}</td>
        <td>${escapeHtml(p.time || '—')}</td>
        <td>${renderOrganBadge(p)}</td>
        <td>
          <div class="cell-room-title">${escapeHtml(p.connectedRoomTitle || p.roomName || p.roomId)}</div>
          <div class="cell-sub-doc">${escapeHtml(p.connectedDoctor || '—')}</div>
        </td>
        <td>
          <div class="cell-author-doc">👨‍⚕️ ${escapeHtml(p.acceptingDoctorName || p.acceptingDoctor || (p.statusCategory === 'waiting' ? '— (Kutilmoqda)' : '—'))}</div>
        </td>
        <td>${renderDiscrepancyBadge(p)}</td>
        <td>${escapeHtml(p.referringDoctor || '—')}</td>
        <td><span class="status-badge ${badgeClass}">${escapeHtml(p.status || 'Kutmoqda')}</span></td>
        <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(p.price)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 3.1. BEMORNING KARMED JAVOBLARI VA BARCHA TEKSHIRUV ORGANLARI MODALI
  // =========================================================================
  window.openPatientDetailModalByLabId = function(labDosyaId) {
    if (!currentReport || !Array.isArray(currentReport.allPatients)) return;
    const p = currentReport.allPatients.find(x => String(x.labDosyaId) === String(labDosyaId));
    if (p) openPatientDetailModal(p);
  };

  async function openPatientDetailModal(p) {
    const modal = document.getElementById('patient-detail-modal');
    if (!modal) return;

    document.getElementById('pmodal-fullname').innerText = p.fullName || 'Bemor';
    document.getElementById('pmodal-meta').innerText = `ID: ${p.patientId || '—'} | Protokol: ${p.dosyaNo || '—'} | Sana: ${p.date || '—'} ${p.time || ''} | Toifa: ${p.citizenshipTitle || "Sug'urta"}`;
    document.getElementById('pmodal-connected-room').innerText = p.connectedRoomTitle || p.roomName || 'Biriktirilmagan';
    document.getElementById('pmodal-connected-doc').innerText = p.connectedDoctor || '—';
    document.getElementById('pmodal-report-author').innerText = p.acceptingDoctorName || p.acceptingDoctor || (p.statusCategory === 'waiting' ? '— (Kutilmoqda)' : '—');
    document.getElementById('pmodal-referring-doc').innerText = p.referringDoctor || 'Kiritilmagan';
    document.getElementById('pmodal-dept').innerText = p.department || 'Ambulator';

    const discBanner = document.getElementById('pmodal-discrepancy-banner');
    const discDesc = document.getElementById('pmodal-discrepancy-desc');
    if (p.hasDiscrepancy) {
      discBanner.style.display = 'flex';
      discDesc.innerText = `Bemor ${p.connectedRoomTitle || p.connectedRoom} xonasiga yo'naltirilgan, biroq tekshiruvni ${p.acceptingDoctorName || p.acceptingDoctor} qabul qilib o'tkazgan!`;
    } else {
      discBanner.style.display = 'none';
    }

    const diagBox = document.getElementById('pmodal-diagnosis-text');
    diagBox.innerText = p.diagnosis ? p.diagnosis : "Karmed serveridan yuklanmoqda...";

    const tbody = document.getElementById('pmodal-services-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Karmed tekshiruv organlari yuklanmoqda...</td></tr>';
    document.getElementById('pmodal-services-count').innerText = `${p.servicesCount || 1} ta tekshiruv`;
    document.getElementById('pmodal-total-price').innerText = formatMoney(p.price);

    modal.style.display = 'flex';

    // Agar keshda mavjud bo'lsa darhol chiqaramiz
    if (p.services && p.services.length > 0) {
      renderPatientModalServicesTable(p.services, p.totalPrice || p.price);
      if (p.diagnosis) diagBox.innerText = p.diagnosis;
      return;
    }

    // Karmed API dan jonli tortish
    try {
      const url = `/api/admin/patient-details?labDosyaId=${p.labDosyaId}&onKayitId=${p.onKayitId || 0}&yatPol=${p.yatPol || 'P'}&protokolNo=${p.dosyaNo}&patientId=${p.patientId}&fullName=${encodeURIComponent(p.fullName)}&kurumAdi=${encodeURIComponent(p.kurumAdi || '')}&connectedRoom=${encodeURIComponent(p.connectedRoom || '')}&acceptingDoctor=${encodeURIComponent(p.acceptingDoctor || p.reportAuthor || '')}&referringDoctor=${encodeURIComponent(p.referringDoctor || '')}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.details) {
          const d = data.details;
          p.services = d.services || [];
          p.diagnosis = d.diagnosis || '';
          p.totalPrice = d.totalPrice || p.price;
          p.servicesCount = (d.services || []).length;

          diagBox.innerText = d.diagnosis || "Tashxis ko'rsatilmagan";
          document.getElementById('pmodal-services-count').innerText = `${p.services.length} ta tekshiruv`;
          document.getElementById('pmodal-total-price').innerText = formatMoney(p.totalPrice);
          renderPatientModalServicesTable(p.services, p.totalPrice);
        }
      }
    } catch (err) {
      console.warn('Patient details fetch warning:', err);
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:#f43f5e;">Tekshiruvlarni olishda ogohlantirish: ${escapeHtml(err.message)}</td></tr>`;
    }
  }

  function renderPatientModalServicesTable(services, totalPrice) {
    const tbody = document.getElementById('pmodal-services-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!services || services.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">Tekshiruvlar ro\'yxati bo\'sh</td></tr>';
      return;
    }
    services.forEach((s, idx) => {
      const tr = document.createElement('tr');
      const statusBadge = s.isApproved 
        ? '<span class="status-badge badge-completed">✅ Rapor Onaylı</span>' 
        : (s.isWritten ? '<span class="status-badge badge-writing">📝 Yozilmoqda</span>' : '<span class="status-badge badge-waiting">⏳ Kutmoqda</span>');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${s.id || '—'}</strong></td>
        <td><span class="status-badge badge-writing">${escapeHtml(s.code || 'UTT')}</span></td>
        <td><strong>${escapeHtml(s.name || 'UTT Tekshiruvi')}</strong></td>
        <td>${escapeHtml(s.doctorName || s.authorDoctor || '—')}</td>
        <td>${statusBadge}</td>
        <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(s.price)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function closePatientDetailModal() {
    const modal = document.getElementById('patient-detail-modal');
    if (modal) modal.style.display = 'none';
  }

  // TAB 5: PRICE CATALOG
  function renderPrices() {
    const tbody = document.getElementById('tbody-prices');
    if (!tbody || !priceCatalog) return;

    const query = (document.getElementById('price-search-input')?.value || '').toLowerCase().trim();
    let services = priceCatalog.services || [];

    if (priceModalityFilter !== 'ALL') {
      services = services.filter(s => s.category === priceModalityFilter);
    }

    if (query) {
      services = services.filter(s => {
        return (s.id || '').toLowerCase().includes(query) ||
               (s.name || '').toLowerCase().includes(query) ||
               (s.category || '').toLowerCase().includes(query);
      });
    }

    tbody.innerHTML = '';
    if (services.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Xizmatlar topilmadi</td></tr>';
      return;
    }

    services.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.id}</strong></td>
        <td><span class="status-badge badge-writing">${s.category}</span></td>
        <td><strong>${s.name}</strong></td>
        <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(s.priceLocal)}</td>
        <td class="text-right" style="color:#38bdf8;">${formatMoney(s.priceInsurance)}</td>
        <td class="text-right" style="color:#fbbf24;">${formatMoney(s.priceForeign)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // =========================================================================
  // 4. DOCTOR PATIENTS MODAL (BEMORLAR RO'YXATI)
  // =========================================================================
  function openDoctorModal(roomId) {
    if (!currentReport || !Array.isArray(currentReport.byDoctor)) return;

    const doc = currentReport.byDoctor.find(d => d.roomId === roomId);
    if (!doc) {
      alert("Vrach ma'lumotlari topilmadi");
      return;
    }

    currentDoctorModalData = doc;
    modalDoctorTitle.innerText = `🏥 ${doc.roomTitle || doc.roomId} — ${doc.doctorName}`;
    modalDoctorSubtitle.innerText = `${doc.shortName} ko'rgan barcha bemorlar ro'yxati (${formatNumber(doc.totalCount)} ta)`;

    if (modalPatientSearch) modalPatientSearch.value = '';
    if (modalStatusFilter) modalStatusFilter.value = 'ALL';

    renderDoctorModalPatients();
    if (doctorModal) doctorModal.style.display = 'flex';
  }

  function renderDoctorModalPatients() {
    if (!currentDoctorModalData) return;

    const q = (modalPatientSearch?.value || '').toLowerCase().trim();
    const status = modalStatusFilter?.value || 'ALL';

    const patients = (currentDoctorModalData.patients || []).filter(p => {
      if (status !== 'ALL' && p.statusCategory !== status) return false;
      if (q) {
        const idM = (p.patientId || '').toLowerCase().includes(q);
        const nameM = (p.fullName || '').toLowerCase().includes(q);
        const dosyaM = (p.dosyaNo || '').toLowerCase().includes(q);
        const refM = (p.referringDoctor || '').toLowerCase().includes(q);
        if (!idM && !nameM && !dosyaM && !refM) return false;
      }
      return true;
    });

    // Update Modal Stats
    const totalP = patients.length;
    const completedP = patients.filter(p => p.statusCategory === 'completed').length;
    const revenueP = patients.filter(p => p.statusCategory === 'completed').reduce((sum, p) => sum + (p.price || 0), 0);

    if (modalStatsSummary) {
      modalStatsSummary.innerHTML = `
        Jami: <strong>${formatNumber(totalP)}</strong> ta | 
        O'tgan: <strong style="color:#34d399;">${formatNumber(completedP)}</strong> ta | 
        Tushum: <strong style="color:#34d399;">${formatMoney(revenueP)}</strong>
      `;
    }

    // Render Modal Table
    tbodyModalPatients.innerHTML = '';
    if (patients.length === 0) {
      tbodyModalPatients.innerHTML = '<tr><td colspan="11" class="text-center">Bemorlar topilmadi</td></tr>';
      return;
    }

    patients.forEach((p, idx) => {
      const tr = document.createElement('tr');
      let badgeClass = 'badge-waiting';
      if (p.statusCategory === 'completed') badgeClass = 'badge-completed';
      else if (p.statusCategory === 'accepted') badgeClass = 'badge-accepted';
      else if (p.statusCategory === 'writing') badgeClass = 'badge-writing';
      else if (p.statusCategory === 'cancelled') badgeClass = 'badge-cancelled';

      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(p.patientId || '—')}</strong></td>
        <td>${escapeHtml(p.dosyaNo || '—')}</td>
        <td><strong>${escapeHtml(p.fullName || '—')}</strong></td>
        <td>${renderCitizenshipBadge(p)}</td>
        <td>${escapeHtml(p.date || '—')}</td>
        <td>${escapeHtml(p.time || '—')}</td>
        <td><span class="status-badge ${badgeClass}">${escapeHtml(p.status || 'Kutmoqda')}</span></td>
        <td>${escapeHtml(p.serviceName || 'UTT Tekshiruvi')}</td>
        <td>${escapeHtml(p.referringDoctor || '—')}</td>
        <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(p.price)}</td>
      `;
      tbodyModalPatients.appendChild(tr);
    });
  }

  function closeDoctorModal() {
    if (doctorModal) doctorModal.style.display = 'none';
    currentDoctorModalData = null;
  }

  // =========================================================================
  // 5. CSV EKSPORT FUNKSIYALARI (INSTANT CLIENT-SIDE BLOB DOWNLOAD)
  // =========================================================================
  function downloadCsvFile(content, fileName) {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function exportDoctorsCsv() {
    if (!currentReport || !Array.isArray(currentReport.byDoctor)) return;
    let csv = "Xona;Shifokor;Jami Yo'naltirilgan;Tekshiruvdan O'tgan;Kutmoqda;Qabul Qilingan;O'tish Foizi;Jami Tushum (so'm)\n";
    currentReport.byDoctor.forEach(d => {
      csv += `"${d.roomTitle || d.roomId}";"${d.doctorName}";${d.totalCount};${d.completedCount};${d.waitingCount};${d.acceptedCount};"${d.completionRate}";"${d.revenue}"\n`;
    });
    downloadCsvFile(csv, `UTT_Vrachlar_Hisoboti_${startDateInput.value}_${endDateInput.value}.csv`);
  }

  function exportReferralsCsv() {
    if (!currentReport || !Array.isArray(currentReport.byReferringDoctor)) return;
    let csv = "Reyting;Davolovchi Shifokor;Bo'limi;Jami Yuborgan;Tekshiruvdan O'tgan;Kutmoqda;Ulushi;Jami Summa (so'm)\n";
    currentReport.byReferringDoctor.forEach((r, idx) => {
      csv += `${idx + 1};"${r.name}";"${r.dept}";${r.totalSent};${r.completed};${r.waiting};"${r.sharePercent}";"${r.revenue}"\n`;
    });
    downloadCsvFile(csv, `UTT_Davolovchilar_Reytingi_${startDateInput.value}_${endDateInput.value}.csv`);
  }

  function exportAllPatientsCsv() {
    if (!currentReport || !Array.isArray(currentReport.allPatients)) return;
    let csv = "№;Bemor ID;Dosya No;Bemor F.I.SH;Toifasi (Karmed);Fuqaroligi;Sana;Vaqt;UTT Xonasi;UTT Shifokori;Davolovchi Shifokor;Bo'lim;Holati;Tekshiruv Nomi;To'lov Summasi (so'm)\n";
    currentReport.allPatients.forEach((p, idx) => {
      csv += `${idx + 1};"${p.patientId}";"${p.dosyaNo}";"${p.fullName}";"${p.kurumAdi || ''}";"${p.citizenshipTitle || ''}";"${p.date}";"${p.time}";"${p.roomName}";"${p.doctorName}";"${p.referringDoctor}";"${p.department}";"${p.status}";"${p.serviceName}";"${p.price}"\n`;
    });
    downloadCsvFile(csv, `UTT_Barcha_Bemorlar_${startDateInput.value}_${endDateInput.value}.csv`);
  }

  function exportDiscrepanciesCsv() {
    if (!currentReport) return;
    const list = currentReport.discrepancyPatients || (currentReport.allPatients || []).filter(p => p.hasDiscrepancy);
    if (!list || list.length === 0) {
      alert("Farqli qabul qilingan (boshqa vrachga kirgan) bemorlar topilmadi.");
      return;
    }
    let csv = "№;Bemor ID;Dosya No;Bemor F.I.SH;Toifasi (Karmed);Fuqaroligi;Sana;Vaqt;Ulangan Xona (Navbat);Tekshiruv O'tkazgan Shifokor;Farq Holati;Davolovchi Shifokor;Bo'lim;Holati;Tekshiruv Organlari;Tarif Summasi (so'm)\n";
    list.forEach((p, idx) => {
      const queuedRoom = p.connectedRoomTitle || p.roomName || p.roomId || '';
      const examiningDoc = p.acceptingDoctorName || p.acceptingDoctor || p.reportAuthorDoctor || p.reportAuthor || '';
      const discText = p.discrepancyText || 'Boshqa vrach qabul qilgan';
      csv += `${idx + 1};"${p.patientId || ''}";"${p.dosyaNo || ''}";"${p.fullName || ''}";"${p.kurumAdi || ''}";"${p.citizenshipTitle || ''}";"${p.date || ''}";"${p.time || ''}";"${queuedRoom}";"${examiningDoc}";"${discText}";"${p.referringDoctor || ''}";"${p.department || ''}";"${p.status || ''}";"${p.serviceName || ''}";"${p.price || 0}"\n`;
    });
    downloadCsvFile(csv, `UTT_Boshqa_Vrachga_Kirgan_Bemorlar_${startDateInput.value}_${endDateInput.value}.csv`);
  }

  function exportDoctorModalPatientsCsv() {
    if (!currentDoctorModalData) return;
    let csv = "№;Bemor ID;Dosya No;Bemor F.I.SH;Toifasi (Karmed);Fuqaroligi;Sana;Vaqt;Holati;Tekshiruv Nomi;Davolovchi Shifokor;To'lov (so'm)\n";
    (currentDoctorModalData.patients || []).forEach((p, idx) => {
      csv += `${idx + 1};"${p.patientId}";"${p.dosyaNo}";"${p.fullName}";"${p.kurumAdi || ''}";"${p.citizenshipTitle || ''}";"${p.date}";"${p.time}";"${p.status}";"${p.serviceName}";"${p.referringDoctor}";"${p.price}"\n`;
    });
    downloadCsvFile(csv, `Bemorlar_${currentDoctorModalData.roomId}_${startDateInput.value}_${endDateInput.value}.csv`);
  }

  function exportCrossMatrixCsv() {
    if (!currentReport || !Array.isArray(currentReport.byDoctor)) return;
    let csv = "UTT Xonasi;UTT Shifokori;Davolovchi Shifokor;Bo'limi;Bemorlar Soni;O'tganlar Soni;Summa (so'm)\n";
    currentReport.byDoctor.forEach(d => {
      (d.referringList || []).forEach(r => {
        csv += `"${d.roomTitle || d.roomId}";"${d.doctorName}";"${r.name}";"${r.dept}";${r.count};${r.completed};"${r.revenue}"\n`;
      });
    });
    downloadCsvFile(csv, `UTT_Vrachlararo_Taqsimot_Matritsasi_${startDateInput.value}_${endDateInput.value}.csv`);
  }

  // =========================================================================
  // TAB: VRACHLARARO TAQSIMOT (CROSS DOCTOR MATRIX)
  // =========================================================================
  function renderCrossMatrix() {
    const container = document.getElementById('matrix-grid-container');
    if (!container || !currentReport) return;

    const query = (document.getElementById('filter-matrix-input')?.value || '').toLowerCase().trim();
    const matrix = currentReport.crossDoctorMatrix;

    if (matrixMode === 'utt-first') {
      // 1. UTT Shifokori bo'yicha: kimlar unga yuborgan
      const uttList = (matrix && matrix.byUttDoctor) 
        ? matrix.byUttDoctor 
        : (currentReport.byDoctor || []).map(d => ({
            roomId: d.roomId,
            roomTitle: d.roomTitle,
            doctorName: d.doctorName,
            totalPatients: d.totalCount,
            completedCount: d.completedCount,
            revenue: d.revenue,
            referringDoctors: d.referringList || []
          }));

      const filtered = uttList.filter(u => {
        if (!query) return true;
        const rMatch = (u.roomTitle || u.roomId || '').toLowerCase().includes(query);
        const dMatch = (u.doctorName || '').toLowerCase().includes(query);
        const refMatch = (u.referringDoctors || []).some(r => (r.name || '').toLowerCase().includes(query) || (r.dept || '').toLowerCase().includes(query));
        return rMatch || dMatch || refMatch;
      });

      container.innerHTML = '';
      if (filtered.length === 0) {
        container.innerHTML = '<div class="loading-box">Mos shifokorlar topilmadi</div>';
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'matrix-item-card';

        const refs = (item.referringDoctors || []).filter(r => {
          if (!query) return true;
          return (r.name || '').toLowerCase().includes(query) || 
                 (r.dept || '').toLowerCase().includes(query) ||
                 (item.roomTitle || '').toLowerCase().includes(query) ||
                 (item.doctorName || '').toLowerCase().includes(query);
        });

        const maxCount = Math.max(...refs.map(r => r.count || 0), 1);

        let rowsHtml = '';
        if (refs.length === 0) {
          rowsHtml = '<tr><td colspan="5" class="text-center" style="padding:16px;">Davolovchi shifokorlar mavjud emas</td></tr>';
        } else {
          refs.forEach(r => {
            const barWidth = Math.min(100, Math.round(((r.count || 0) / maxCount) * 100));
            rowsHtml += `
              <tr>
                <td><strong>👨‍⚕️ ${r.name}</strong></td>
                <td><span style="color:var(--text-secondary);">${r.dept || 'Ambulator'}</span></td>
                <td style="width: 280px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <strong style="min-width:35px;">${formatNumber(r.count)} ta</strong>
                    <div class="matrix-bar-wrap">
                      <div class="matrix-bar-fill" style="width:${barWidth}%;"></div>
                    </div>
                  </div>
                </td>
                <td class="text-right" style="color:#34d399; font-weight:700;">${formatNumber(r.completed || 0)} ta</td>
                <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(r.revenue || 0)}</td>
              </tr>
            `;
          });
        }

        card.innerHTML = `
          <div class="matrix-item-header">
            <div class="matrix-header-info">
              <span class="matrix-room-badge">${item.roomTitle || item.roomId}</span>
              <div>
                <div class="matrix-doc-name">${item.doctorName || 'Shifokor biriktirilmagan'}</div>
                <div class="matrix-doc-sub">Qabul qilingan davolovchilar: ${refs.length} nafar</div>
              </div>
            </div>
            <div class="matrix-header-metrics">
              <div class="matrix-stat-group">
                <div class="matrix-stat-val">${formatNumber(item.totalPatients || 0)} ta</div>
                <div class="matrix-stat-lbl">Jami Bemor</div>
              </div>
              <div class="matrix-stat-group">
                <div class="matrix-stat-val" style="color:#34d399;">${formatNumber(item.completedCount || 0)} ta</div>
                <div class="matrix-stat-lbl">O'tgan</div>
              </div>
              <div class="matrix-stat-group">
                <div class="matrix-stat-val" style="color:#34d399;">${formatMoney(item.revenue || 0)}</div>
                <div class="matrix-stat-lbl">Tushum</div>
              </div>
              <span class="matrix-toggle-chevron">▼</span>
            </div>
          </div>
          <div class="matrix-item-body">
            <table class="matrix-subtable">
              <thead>
                <tr>
                  <th>Davolovchi Shifokor F.I.SH</th>
                  <th>Bo'limi</th>
                  <th>Yuborilgan Bemorlar Oqimi</th>
                  <th class="text-right">O'tganlar</th>
                  <th class="text-right">Generatsiya Qilingan Tushum</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `;

        card.querySelector('.matrix-item-header').addEventListener('click', () => {
          card.classList.toggle('collapsed');
        });

        container.appendChild(card);
      });

    } else {
      // 2. Davolovchi Shifokor bo'yicha: u yuborgan bemorlar qaysi UTT xonalariga borgan
      const refList = (matrix && matrix.byReferringDoctor)
        ? matrix.byReferringDoctor
        : (currentReport.byReferringDoctor || []).map(r => ({
            name: r.name,
            dept: r.dept,
            totalSent: r.totalSent,
            completedCount: r.completed,
            revenue: r.revenue,
            uttRooms: r.uttList || []
          }));

      const filtered = refList.filter(r => {
        if (!query) return true;
        const nMatch = (r.name || '').toLowerCase().includes(query);
        const dMatch = (r.dept || '').toLowerCase().includes(query);
        const uMatch = (r.uttRooms || []).some(u => (u.roomTitle || u.roomId || '').toLowerCase().includes(query) || (u.doctorName || '').toLowerCase().includes(query));
        return nMatch || dMatch || uMatch;
      });

      container.innerHTML = '';
      if (filtered.length === 0) {
        container.innerHTML = '<div class="loading-box">Mos davolovchi shifokorlar topilmadi</div>';
        return;
      }

      filtered.forEach(item => {
        const card = document.createElement('div');
        card.className = 'matrix-item-card';

        const utts = (item.uttRooms || []).filter(u => {
          if (!query) return true;
          return (u.roomTitle || u.roomId || '').toLowerCase().includes(query) ||
                 (u.doctorName || '').toLowerCase().includes(query) ||
                 (item.name || '').toLowerCase().includes(query) ||
                 (item.dept || '').toLowerCase().includes(query);
        });

        const maxCount = Math.max(...utts.map(u => u.count || 0), 1);

        let rowsHtml = '';
        if (utts.length === 0) {
          rowsHtml = '<tr><td colspan="5" class="text-center" style="padding:16px;">UTT xonalari ma\'lumoti mavjud emas</td></tr>';
        } else {
          utts.forEach(u => {
            const barWidth = Math.min(100, Math.round(((u.count || 0) / maxCount) * 100));
            rowsHtml += `
              <tr>
                <td><strong>🏥 ${u.roomTitle || u.roomId}</strong></td>
                <td><strong>${u.doctorName || '—'}</strong></td>
                <td style="width: 280px;">
                  <div style="display:flex; align-items:center; gap:10px;">
                    <strong style="min-width:35px;">${formatNumber(u.count)} ta</strong>
                    <div class="matrix-bar-wrap">
                      <div class="matrix-bar-fill" style="width:${barWidth}%;"></div>
                    </div>
                  </div>
                </td>
                <td class="text-right" style="color:#34d399; font-weight:700;">${formatNumber(u.completed || 0)} ta</td>
                <td class="text-right" style="color:#34d399; font-weight:700;">${formatMoney(u.revenue || 0)}</td>
              </tr>
            `;
          });
        }

        card.innerHTML = `
          <div class="matrix-item-header">
            <div class="matrix-header-info">
              <span class="matrix-room-badge" style="background:linear-gradient(135deg, #065f46, #047857); color:#34d399; border-color:rgba(52,211,153,0.3);">👨‍⚕️ Davolovchi</span>
              <div>
                <div class="matrix-doc-name">${item.name}</div>
                <div class="matrix-doc-sub">${item.dept || 'Ambulator'} • Yo'naltirilgan UTT xonalari: ${utts.length} ta</div>
              </div>
            </div>
            <div class="matrix-header-metrics">
              <div class="matrix-stat-group">
                <div class="matrix-stat-val">${formatNumber(item.totalSent || 0)} ta</div>
                <div class="matrix-stat-lbl">Jami Yuborgan</div>
              </div>
              <div class="matrix-stat-group">
                <div class="matrix-stat-val" style="color:#34d399;">${formatNumber(item.completedCount || 0)} ta</div>
                <div class="matrix-stat-lbl">O'tgan</div>
              </div>
              <div class="matrix-stat-group">
                <div class="matrix-stat-val" style="color:#34d399;">${formatMoney(item.revenue || 0)}</div>
                <div class="matrix-stat-lbl">Tushum</div>
              </div>
              <span class="matrix-toggle-chevron">▼</span>
            </div>
          </div>
          <div class="matrix-item-body">
            <table class="matrix-subtable">
              <thead>
                <tr>
                  <th>Qabul Qilgan UTT Xonasi</th>
                  <th>UTT Shifokori F.I.SH</th>
                  <th>Yo'naltirilgan Bemorlar Oqimi</th>
                  <th class="text-right">O'tganlar</th>
                  <th class="text-right">Tushum</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        `;

        card.querySelector('.matrix-item-header').addEventListener('click', () => {
          card.classList.toggle('collapsed');
        });

        container.appendChild(card);
      });
    }
  }

  // =========================================================================
  // 6. EVENT LISTENERS
  // =========================================================================
  function initEventListeners() {
    // Theme toggle
    document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);

    // Money visibility toggle
    document.getElementById('btn-money-toggle')?.addEventListener('click', toggleMoneyVisibility);

    // KPI Cards Clickable Filters
    document.querySelectorAll('.kpi-card.clickable').forEach(card => {
      card.addEventListener('click', () => {
        const filter = card.getAttribute('data-kpi-filter');
        if (!filter) return;

        document.querySelectorAll('.kpi-card').forEach(c => c.classList.remove('active-kpi'));
        card.classList.add('active-kpi');

        // Switch to Patients tab
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-tab') === 'tab-patients');
        });
        document.querySelectorAll('.tab-pane').forEach(p => {
          p.classList.toggle('active', p.id === 'tab-patients');
        });

        if (filter === 'discrepancy') {
          const selectDisc = document.getElementById('patient-filter-discrepancy');
          if (selectDisc) selectDisc.value = 'DISCREPANCY_ONLY';
          const selectStatus = document.getElementById('patient-filter-status');
          if (selectStatus) selectStatus.value = 'ALL';
        } else {
          const selectDisc = document.getElementById('patient-filter-discrepancy');
          if (selectDisc) selectDisc.value = 'ALL';
          const selectStatus = document.getElementById('patient-filter-status');
          if (selectStatus) selectStatus.value = filter;
        }

        currentPatientsPage = 1;
        renderPatientsTable();

        const tabPatients = document.getElementById('tab-patients');
        if (tabPatients) {
          tabPatients.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Buttons: Fetch & Force Refresh
    btnFetchReport?.addEventListener('click', () => fetchAnalyticsReport(false));
    btnForceRefresh?.addEventListener('click', () => fetchAnalyticsReport(true));
    btnExportCsv?.addEventListener('click', exportAllPatientsCsv);
    document.getElementById('btn-export-doctors-csv')?.addEventListener('click', exportDoctorsCsv);
    document.getElementById('btn-export-referrals-csv')?.addEventListener('click', exportReferralsCsv);
    document.getElementById('btn-export-cross-matrix-csv')?.addEventListener('click', exportCrossMatrixCsv);
    btnExportModalCsv?.addEventListener('click', exportDoctorModalPatientsCsv);
    document.getElementById('btn-export-discrepancy-csv')?.addEventListener('click', exportDiscrepanciesCsv);

    document.getElementById('btn-quick-discrepancy-filter')?.addEventListener('click', () => {
      const selectDisc = document.getElementById('patient-filter-discrepancy');
      if (selectDisc) selectDisc.value = 'DISCREPANCY_ONLY';
      const selectStatus = document.getElementById('patient-filter-status');
      if (selectStatus) selectStatus.value = 'ALL';
      currentPatientsPage = 1;
      renderPatientsTable();
      const tabPatients = document.getElementById('tab-patients');
      if (tabPatients) tabPatients.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // Dynamic Preset Button Labels
    const now = new Date();
    const btnToday = document.querySelector('.btn-preset[data-preset="today"]');
    if (btnToday) btnToday.textContent = `Bugun (${pad2(now.getDate())}.${pad2(now.getMonth() + 1)})`;

    const btnCurrentMonth = document.querySelector('.btn-preset[data-preset="september"]');
    if (btnCurrentMonth) btnCurrentMonth.textContent = `${getMonthNameUz(now.getMonth())} ${now.getFullYear()}`;

    const prevMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const btnLastMonth = document.querySelector('.btn-preset[data-preset="august"]');
    if (btnLastMonth) btnLastMonth.textContent = `${getMonthNameUz(prevMonthIdx)} ${prevMonthYear}`;

    // Date Presets Click Handling
    document.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        if (!preset) return;
        applyDatePreset(preset, true);
      });
    });

    // Foydalanuvchi sanani qo'lda o'zgartirsa, avto-yangilanishni to'xtatish
    startDateInput?.addEventListener('input', () => {
      currentActivePreset = 'custom';
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      updateAutoRefreshBadge();
    });
    startDateInput?.addEventListener('blur', () => {
      if (startDateInput.value) {
        startDateInput.value = sanitizeDateStr(startDateInput.value);
      }
    });
    endDateInput?.addEventListener('input', () => {
      currentActivePreset = 'custom';
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      updateAutoRefreshBadge();
    });
    endDateInput?.addEventListener('blur', () => {
      if (endDateInput.value) {
        endDateInput.value = sanitizeDateStr(endDateInput.value);
      }
    });

    // Navigation Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const pane = document.getElementById(targetId);
        if (pane) pane.classList.add('active');
      });
    });

    // Doctor Filter Search
    document.getElementById('filter-doc-input')?.addEventListener('input', renderDoctors);
    // Referring Doctor Filter Search
    document.getElementById('filter-ref-input')?.addEventListener('input', renderReferrals);

    // Cross Matrix Controls
    document.querySelectorAll('.btn-matrix-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-matrix-mode').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        matrixMode = btn.getAttribute('data-matrix-mode');
        renderCrossMatrix();
      });
    });
    document.getElementById('filter-matrix-input')?.addEventListener('input', renderCrossMatrix);

    // Patients Advanced Filters
    document.getElementById('patient-search-query')?.addEventListener('input', () => {
      currentPatientsPage = 1;
      renderPatientsTable();
    });
    document.getElementById('patient-filter-room')?.addEventListener('change', () => {
      currentPatientsPage = 1;
      renderPatientsTable();
    });
    document.getElementById('patient-filter-status')?.addEventListener('change', () => {
      currentPatientsPage = 1;
      renderPatientsTable();
    });
    document.getElementById('patient-filter-discrepancy')?.addEventListener('change', () => {
      currentPatientsPage = 1;
      renderPatientsTable();
    });
    document.getElementById('patient-filter-type')?.addEventListener('change', () => {
      currentPatientsPage = 1;
      renderPatientsTable();
    });
    document.getElementById('patient-page-size')?.addEventListener('change', (e) => {
      patientPageSize = parseInt(e.target.value, 10) || 100;
      currentPatientsPage = 1;
      renderPatientsTable();
    });

    // Doctor Modal Search & Filter
    modalPatientSearch?.addEventListener('input', renderDoctorModalPatients);
    modalStatusFilter?.addEventListener('change', renderDoctorModalPatients);
    btnCloseModal?.addEventListener('click', closeDoctorModal);
    doctorModal?.addEventListener('click', (e) => {
      if (e.target === doctorModal) closeDoctorModal();
    });

    // Patient Detail Modal Close
    document.getElementById('btn-close-patient-modal')?.addEventListener('click', closePatientDetailModal);
    document.getElementById('btn-close-patient-modal-2')?.addEventListener('click', closePatientDetailModal);
    const pDetailModal = document.getElementById('patient-detail-modal');
    pDetailModal?.addEventListener('click', (e) => {
      if (e.target === pDetailModal) closePatientDetailModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (doctorModal?.style.display === 'flex') closeDoctorModal();
        if (pDetailModal?.style.display === 'flex') closePatientDetailModal();
      }
    });

    // Price Catalog Filters
    document.querySelectorAll('.mod-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.mod-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        priceModalityFilter = pill.getAttribute('data-mod');
        renderPrices();
      });
    });
    document.getElementById('price-search-input')?.addEventListener('input', renderPrices);
  }

  // =========================================================================
  // 8. ID KODLARI BO'YICHA MAXSUS REESTR MODULI (v7.1)
  // =========================================================================
  let reestrCurrentRows = [];
  let reestrFilteredRows = [];

  function initCustomReestrModule() {
    const tabBtnDashboard = document.getElementById('tab-btn-dashboard');
    const tabBtnReestr = document.getElementById('tab-btn-reestr');
    const viewDashboard = document.getElementById('view-dashboard');
    const viewReestr = document.getElementById('view-reestr');

    const textareaIds = document.getElementById('reestr-input-ids');
    const idsCounter = document.getElementById('reestr-ids-counter');
    const btnSampleIds = document.getElementById('btn-sample-ids');
    const btnClearIds = document.getElementById('btn-clear-ids');

    const reestrStartDate = document.getElementById('reestr-start-date');
    const reestrEndDate = document.getElementById('reestr-end-date');
    const btnCalcReestr = document.getElementById('btn-calc-reestr');
    const btnExportReestr = document.getElementById('btn-export-reestr');

    const reestrKpiGrid = document.getElementById('reestr-kpi-grid');
    const rkpiReqIds = document.getElementById('rkpi-req-ids');
    const rkpiFoundIds = document.getElementById('rkpi-found-ids');
    const rkpiServicesCount = document.getElementById('rkpi-services-count');
    const rkpiOrderSum = document.getElementById('rkpi-order-sum');
    const rkpiPulliSum = document.getElementById('rkpi-pulli-sum');
    const rkpiTotalSum = document.getElementById('rkpi-total-sum');

    const reestrTbody = document.getElementById('reestr-tbody');
    const reestrTfoot = document.getElementById('reestr-tfoot');
    const reestrRowsCountBadge = document.getElementById('reestr-rows-count-badge');
    const reestrTableSearch = document.getElementById('reestr-table-search');

    const footOrderli = document.getElementById('reestr-foot-orderli');
    const footPulli = document.getElementById('reestr-foot-pulli');
    const footTolangan = document.getElementById('reestr-foot-tolangan');
    const footJami = document.getElementById('reestr-foot-jami');

    // 1. Tab Switching
    function switchTab(tabName) {
      if (tabName === 'reestr') {
        tabBtnDashboard?.classList.remove('active');
        tabBtnReestr?.classList.add('active');
        if (viewDashboard) viewDashboard.style.display = 'none';
        if (viewReestr) viewReestr.style.display = 'block';
      } else {
        tabBtnReestr?.classList.remove('active');
        tabBtnDashboard?.classList.add('active');
        if (viewReestr) viewReestr.style.display = 'none';
        if (viewDashboard) viewDashboard.style.display = 'block';
      }
    }

    tabBtnDashboard?.addEventListener('click', () => switchTab('dashboard'));
    tabBtnReestr?.addEventListener('click', () => switchTab('reestr'));

    // 2. ID Counter & Parsing
    function parseIdsList(text) {
      if (!text) return [];
      return text.split(/[;,\n\r\t\s]+/)
        .map(s => s.trim().replace(/[^\d]/g, ''))
        .filter(Boolean);
    }

    function updateIdCounter() {
      const ids = parseIdsList(textareaIds ? textareaIds.value : '');
      const uniqueCount = new Set(ids).size;
      if (idsCounter) {
        idsCounter.innerHTML = `Kiritilgan IDlar: <strong>${uniqueCount} ta</strong>`;
      }
    }

    textareaIds?.addEventListener('input', updateIdCounter);

    // 3. Sample IDs & Clear
    btnSampleIds?.addEventListener('click', () => {
      if (textareaIds) {
        textareaIds.value = '50443; 40852; 40857; 260020144; 260060508; 51230; 50812';
        updateIdCounter();
      }
    });

    btnClearIds?.addEventListener('click', () => {
      if (textareaIds) {
        textareaIds.value = '';
        updateIdCounter();
      }
      reestrCurrentRows = [];
      reestrFilteredRows = [];
      renderReestrTable();
      if (reestrKpiGrid) reestrKpiGrid.style.display = 'none';
      if (reestrTfoot) reestrTfoot.style.display = 'none';
      if (reestrRowsCountBadge) reestrRowsCountBadge.textContent = '0 ta yozuv';
    });

    // 4. Date Presets for Reestr
    document.querySelectorAll('[data-rpreset]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-rpreset]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const p = btn.getAttribute('data-rpreset');
        if (!reestrStartDate || !reestrEndDate) return;

        if (p === 'august') {
          reestrStartDate.value = '01.08.2026';
          reestrEndDate.value = '31.08.2026';
        } else if (p === 'september') {
          reestrStartDate.value = '01.09.2026';
          reestrEndDate.value = '30.09.2026';
        } else if (p === 'july') {
          reestrStartDate.value = '01.07.2026';
          reestrEndDate.value = '31.07.2026';
        } else if (p === 'june') {
          reestrStartDate.value = '01.06.2026';
          reestrEndDate.value = '30.06.2026';
        } else if (p === 'today') {
          const t = getTodayString();
          reestrStartDate.value = t;
          reestrEndDate.value = t;
        }
      });
    });

    // 5. Execute Calculation (Fetch from Karmed)
    async function executeReestrCalculation() {
      const rawText = textareaIds ? textareaIds.value.trim() : '';
      const ids = parseIdsList(rawText);

      if (ids.length === 0) {
        alert("Iltimos, hisoblash uchun kamida 1 ta bemor ID yoki karta raqamini kiriting!");
        textareaIds?.focus();
        return;
      }

      const sDate = reestrStartDate ? reestrStartDate.value.trim() : '01.08.2026';
      const eDate = reestrEndDate ? reestrEndDate.value.trim() : '31.08.2026';

      // Set Loading UI
      if (btnCalcReestr) {
        btnCalcReestr.disabled = true;
        btnCalcReestr.innerHTML = '<span class="btn-icon">⏳</span> Karmeddan yuklanmoqda...';
      }

      if (reestrTbody) {
        reestrTbody.innerHTML = `
          <tr>
            <td colspan="21" class="reestr-empty-cell">
              <div class="reestr-empty-prompt">
                <span class="rep-icon" style="animation: spin 1s infinite linear;">🔄</span>
                <h4>Karmed tizimidan to'g'ridan-to'g'ri yangi ma'lumotlar olinmoqda...</h4>
                <p>${ids.length} ta ID bo'yicha ${sDate} dan ${eDate} gacha bo'lgan barcha tekshiruvlar tekshirilmoqda. Iltimos, kuting...</p>
              </div>
            </td>
          </tr>
        `;
      }

      try {
        const response = await fetch('/api/admin/custom-reestr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: ids,
            startDate: sDate,
            endDate: eDate,
            forceFresh: true
          })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "Karmeddan ma'lumot olishda xatolik yuz berdi");
        }

        reestrCurrentRows = data.rows || [];
        reestrFilteredRows = [...reestrCurrentRows];

        // Update KPIs
        if (reestrKpiGrid) reestrKpiGrid.style.display = 'grid';
        if (rkpiReqIds) rkpiReqIds.textContent = data.totalRequestedIds;
        if (rkpiFoundIds) rkpiFoundIds.textContent = `${data.foundIdsCount} ta`;
        if (rkpiServicesCount) rkpiServicesCount.textContent = `${reestrCurrentRows.length} ta`;
        if (rkpiOrderSum) rkpiOrderSum.textContent = (data.summary?.totalOrderliFormatted || '0,00') + " so'm";
        if (rkpiPulliSum) rkpiPulliSum.textContent = (data.summary?.totalPulliFormatted || '0,00') + " so'm";
        if (rkpiTotalSum) rkpiTotalSum.textContent = (data.summary?.totalJamiFormatted || '0,00') + " so'm";

        renderReestrTable();

        if (data.missingIds && data.missingIds.length > 0) {
          console.warn('[Reestr] Topilmagan IDlar:', data.missingIds);
        }

      } catch (err) {
        console.error('[Reestr Calc Error]:', err);
        if (reestrTbody) {
          reestrTbody.innerHTML = `
            <tr>
              <td colspan="21" class="reestr-empty-cell">
                <div class="reestr-empty-prompt">
                  <span class="rep-icon" style="color:#ef4444;">⚠️</span>
                  <h4 style="color:#ef4444;">Hisobotni olishda xatolik yuz berdi</h4>
                  <p>${err.message}</p>
                </div>
              </td>
            </tr>
          `;
        }
      } finally {
        if (btnCalcReestr) {
          btnCalcReestr.disabled = false;
          btnCalcReestr.innerHTML = '<span class="btn-icon">⚡</span> Karmeddan Hisobotni Olish';
        }
      }
    }

    btnCalcReestr?.addEventListener('click', executeReestrCalculation);

    // 6. Render Reestr Table
    function renderReestrTable() {
      if (!reestrTbody) return;

      if (reestrFilteredRows.length === 0) {
        reestrTbody.innerHTML = `
          <tr>
            <td colspan="21" class="reestr-empty-cell">
              <div class="reestr-empty-prompt">
                <span class="rep-icon">🔍</span>
                <h4>Hech qanday ma'lumot topilmadi</h4>
                <p>Kiritilgan ID kodlar bo'yicha belgilangan muddatda yozuvlar mavjud emas.</p>
              </div>
            </td>
          </tr>
        `;
        if (reestrTfoot) reestrTfoot.style.display = 'none';
        if (reestrRowsCountBadge) reestrRowsCountBadge.textContent = '0 ta yozuv';
        return;
      }

      let rowsHtml = '';
      let sumOrderli = 0;
      let sumPulli = 0;
      let sumTolangan = 0;
      let sumJami = 0;

      reestrFilteredRows.forEach((r, idx) => {
        sumOrderli += (r.orderliUcret || 0);
        sumPulli += (r.pulliUcret || 0);
        sumTolangan += (r.tolanganUcret || 0);
        sumJami += (r.jamiUcret || 0);

        const statusClass = (r.status === 'Rapor Onaylı' || r.status === 'Bajarildi') ? 'badge-completed' : (r.status === 'Bekleyen' ? 'badge-waiting' : 'badge-accepted');
        const privClass = r.privilegeCategory?.toLowerCase().includes('order') || r.privilegeCategory?.toLowerCase().includes('vaqf') ? 'color:#fbbf24; font-weight:700;' : (r.privilegeCategory?.toLowerCase().includes('no') ? 'color:#f87171;' : 'color:#34d399;');

        rowsHtml += `
          <tr>
            <td><strong>${idx + 1}</strong></td>
            <td><code>${r.id || '-'}</code></td>
            <td><strong>${r.fullName || '-'}</strong></td>
            <td>${r.patientType || '-'}</td>
            <td>${r.serviceCategory || 'Radiologiya'}</td>
            <td>${r.functionalDept || 'Ultratovush'}</td>
            <td><strong style="color:#38bdf8;">${r.serviceName || '-'}</strong></td>
            <td><span class="badge badge-secondary">${r.cardNo || '-'}</span></td>
            <td>${r.cardType || 'Ambulator'}</td>
            <td>${r.department || '-'}</td>
            <td>${r.orderingDoctor || '-'}</td>
            <td><span style="color:#34d399; font-weight:600;">${r.performingDoctor || '-'}</span></td>
            <td>${r.dateTime || '-'}</td>
            <td><span style="${privClass}">${r.privilegeCategory || '-'}</span></td>
            <td class="col-money order">${r.orderliUcretFormatted || '0,00'}</td>
            <td class="col-money pulli">${r.pulliUcretFormatted || '0,00'}</td>
            <td class="col-money tolangan">${r.tolanganUcretFormatted || '0,00'}</td>
            <td class="col-money jami">${r.jamiUcretFormatted || '0,00'}</td>
            <td><span class="badge badge-info">${r.paymentMethod || 'Naqd'}</span></td>
            <td>${r.paymentDate || '-'}</td>
            <td><span class="status-badge ${statusClass}">${r.status || 'Bajarildi'}</span></td>
          </tr>
        `;
      });

      reestrTbody.innerHTML = rowsHtml;

      // Update footer totals
      if (reestrTfoot) {
        reestrTfoot.style.display = '';
        if (footOrderli) footOrderli.textContent = Number(sumOrderli).toLocaleString('ru-RU') + ',00';
        if (footPulli) footPulli.textContent = Number(sumPulli).toLocaleString('ru-RU') + ',00';
        if (footTolangan) footTolangan.textContent = Number(sumTolangan).toLocaleString('ru-RU') + ',00';
        if (footJami) footJami.textContent = Number(sumJami).toLocaleString('ru-RU') + ',00';
      }

      if (reestrRowsCountBadge) {
        reestrRowsCountBadge.textContent = `${reestrFilteredRows.length} ta yozuv`;
      }
    }

    // 7. Table Search Filter
    reestrTableSearch?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        reestrFilteredRows = [...reestrCurrentRows];
      } else {
        reestrFilteredRows = reestrCurrentRows.filter(r => {
          return (r.fullName && r.fullName.toLowerCase().includes(q)) ||
                 (r.id && r.id.toLowerCase().includes(q)) ||
                 (r.cardNo && r.cardNo.toLowerCase().includes(q)) ||
                 (r.serviceName && r.serviceName.toLowerCase().includes(q)) ||
                 (r.performingDoctor && r.performingDoctor.toLowerCase().includes(q)) ||
                 (r.orderingDoctor && r.orderingDoctor.toLowerCase().includes(q));
        });
      }
      renderReestrTable();
    });

    // 8. Export to CSV (Excel with UTF-8 BOM)
    btnExportReestr?.addEventListener('click', () => {
      if (reestrCurrentRows.length === 0) {
        alert("Eksport qilish uchun avval hisobotni shakllantiring!");
        return;
      }

      const BOM = '\uFEFF';
      const headers = [
        '№', 'ID', 'Ism va familiya', 'Тип', 'Xizmat Turi', 'Funktsional xizmat bolimi',
        'Услуга', '№ Карта', 'Тип Карта', 'Отделения', 'Лечащий врач', 'dr_uygulayan',
        'Время_tarihi', 'Категория лыгот', 'Orderli_Ucret', 'Pulli_Ucret', 'Tolangan_ucret',
        'Jami_ucret_toplam', 'Форма оплаты', 'Tolov Sana Tarihi', 'Holati'
      ];

      let csv = BOM + headers.join(';') + '\n';

      reestrCurrentRows.forEach((r, idx) => {
        const row = [
          idx + 1,
          `"${r.id || ''}"`,
          `"${(r.fullName || '').replace(/"/g, '""')}"`,
          `"${r.patientType || ''}"`,
          `"${r.serviceCategory || 'Radiologiya'}"`,
          `"${r.functionalDept || 'Ultratovush'}"`,
          `"${(r.serviceName || '').replace(/"/g, '""')}"`,
          `"${r.cardNo || ''}"`,
          `"${r.cardType || 'Ambulator'}"`,
          `"${(r.department || '').replace(/"/g, '""')}"`,
          `"${(r.orderingDoctor || '').replace(/"/g, '""')}"`,
          `"${(r.performingDoctor || '').replace(/"/g, '""')}"`,
          `"${r.dateTime || ''}"`,
          `"${r.privilegeCategory || 'Rezident'}"`,
          `"${r.orderliUcretFormatted || '0,00'}"`,
          `"${r.pulliUcretFormatted || '0,00'}"`,
          `"${r.tolanganUcretFormatted || '0,00'}"`,
          `"${r.jamiUcretFormatted || '0,00'}"`,
          `"${r.paymentMethod || 'Naqd'}"`,
          `"${r.paymentDate || ''}"`,
          `"${r.status || 'Bajarildi'}"`
        ];
        csv += row.join(';') + '\n';
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const sDate = reestrStartDate ? reestrStartDate.value.trim() : '01.08.2026';
      const eDate = reestrEndDate ? reestrEndDate.value.trim() : '31.08.2026';
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', `Karmed_Vedomost_${sDate}_${eDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // =========================================================================
  // 9. DASTUR BOSHLANISHI
  // =========================================================================
  initTheme();
  initMoneyVisibility();
  initEventListeners();
  initCustomReestrModule();
  fetchPriceCatalog();

  // DASTUR BIRINCHI BO'LIB DOIMIY RAVISHTA BUGUNGI KUN MA'LUMOTLARINI YUKLAYDI:
  applyDatePreset('today', false);
  fetchAnalyticsReport(true);

  updateAutoRefreshBadge();

  // JONLI AVTO-YANGILANISH: QAT'IY FAQAT VA FAQAT "BUGUN" TANLANGANDA ISHLAYDI!
  setInterval(() => {
    // Agar boshqa muddat (Sentabr, Avgust, 7 kun yoki ixtiyoriy sana) tanlangan bo'lsa, mutlaqo yangilanmasin:
    if (currentActivePreset !== 'today') {
      return;
    }

    const todayStr = getTodayString();
    if (!startDateInput || !endDateInput) return;
    if (startDateInput.value.trim() !== todayStr || endDateInput.value.trim() !== todayStr) {
      return;
    }

    // Modal oynalar ochiq bo'lsa, foydalanuvchiga xalaqit bermaslik
    if (doctorModal && doctorModal.style.display === 'flex') return;
    const pDetail = document.getElementById('patient-detail-modal');
    if (pDetail && pDetail.style.display === 'flex') return;

    fetchAnalyticsReport(false);
  }, 45000);

})();