/**
 * CONTENT.JS - KARMED IN-PAGE FLOATING PRICE DRAWER & AUTOMATIC PATIENT EXAMINATION PRICE DETECTION
 * 
 * Imkoniyatlar:
 * 1. Bemor ustiga bosilganda uning barcha tekshiruvlarini aniqlaydi.
 * 2. Muassasasi bo'yicha 3 ta holat (Rezident, No Rezident, Sug'urta/Order) to'g'ri aniqlanadi.
 * 3. Jadval ichiga inline narx badgelarini kiritadi (jadval ustunlari buzilmaydi, qora panel yo'q).
 * 4. Tashxislar yonida ixcham jami to'lov belgisi chiqadi.
 * 5. Ekranning o'ng pastki burchagida jonli bemor kartochkasi (HUD) chiqadi.
 * 6. Alt + P orqali ochiluvchi Preyskurantda har bir xizmat uchun 3 ta narx (Rezident, No Rezident, Sug'urta)
 *    to'liq yozilgan holda va 3 ta tarif tugmasi bilan ko'rsatiladi.
 */

(function () {
  // Prevent duplicate injection
  if (document.getElementById('karmed-price-fab')) return;

  let servicesCatalog = [];
  const catalogByCode = new Map();
  const catalogByName = new Map();

  // State
  let currentPatient = null;
  let detectedSubtableServices = [];
  let isDrawerOpen = false;
  let isHudMinimized = false;
  let toastTimer = null;

  // Drawer state
  let currentDrawerTariff = 'rezident'; // 'rezident' | 'norezident' | 'sugurta'
  let currentCategory = 'ALL';
  let searchQuery = '';
  let onlyContrast = false;
  let onlyInjector = false;
  const selectedCodes = new Set();

  function cyrillicToLatin(str) {
    if (!str) return '';
    const map = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z',
      'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
      'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'x', 'ҳ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh',
      'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
      'ў': 'o', 'ғ': 'g', 'қ': 'q'
    };
    return str.toLowerCase().split('').map(c => map[c] !== undefined ? map[c] : c).join('');
  }

  function normalizeName(str) {
    if (!str) return '';
    return cyrillicToLatin(str).replace(/[^a-z0-9]/gi, '');
  }

  initPriceExtension();

  async function initPriceExtension() {
    // 1. Fetch catalog
    try {
      const url = chrome.runtime.getURL('price_catalog.json');
      const res = await fetch(url);
      servicesCatalog = await res.json();

      // Index catalog for instant O(1) lookup
      servicesCatalog.forEach(item => {
        const cleanCode = item.code.toUpperCase().replace(/\s+/g, '');
        catalogByCode.set(cleanCode, item);
        catalogByName.set(normalizeName(item.name), item);
        if (item.nameLatin) {
          catalogByName.set(normalizeName(item.nameLatin), item);
        }
      });
    } catch (err) {
      console.warn('[Karmed Preyskurant] Katalog yuklanmadi:', err);
      return;
    }

    // 2. Inject UI Elements
    createFloatingButton();
    createDrawer();
    createPatientHud();

    // 3. Listen to Patient Clicks and Table Changes
    initPatientAndTableObserver();

    // 4. Global Shortcuts
    document.addEventListener('keydown', (e) => {
      // Toggle drawer with Alt + P or Ctrl + Shift + P
      if ((e.altKey && e.code === 'KeyP') || (e.ctrlKey && e.shiftKey && e.code === 'KeyP')) {
        e.preventDefault();
        toggleDrawer();
      }
      // Close with Escape
      if (e.key === 'Escape' && isDrawerOpen) {
        toggleDrawer(false);
      }
    });
  }

  // ============================================================
  // 1. OBSERVER & PATIENT CLICK LISTENER
  // ============================================================
  function initPatientAndTableObserver() {
    // A. Click on any patient row in top table
    document.addEventListener('click', (e) => {
      const row = e.target.closest('tr');
      if (!row) return;

      // Check if this row belongs to patient list
      const patient = parsePatientFromRow(row);
      if (patient) {
        currentPatient = patient;
        currentDrawerTariff = patient.statusType;
        scheduleSubtableScan();
      }
    }, true);

    // B. Periodic scanner to detect subtable even if user used arrow keys or auto-selected
    setInterval(() => {
      detectAndInjectSubtablePrices();
    }, 600);

    // C. MutationObserver for instant DOM updates
    let debounceTimer = null;
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.addedNodes.length > 0 || (m.target && m.target.nodeName === 'TABLE')) {
          shouldScan = true;
          break;
        }
      }
      if (shouldScan) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          detectAndInjectSubtablePrices();
        }, 120);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function scheduleSubtableScan() {
    const delays = [80, 200, 450, 800, 1400];
    delays.forEach(ms => setTimeout(detectAndInjectSubtablePrices, ms));
  }

  // ============================================================
  // 2. PARSE PATIENT FROM ROW
  // ============================================================
  function parsePatientFromRow(tr) {
    if (!tr) return null;
    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length < 3) return null;

    const cellTexts = cells.map(c => c.innerText.trim());

    // Check for patient ID (4-8 digits, not containing dot or date)
    let patientId = '';
    let doctorName = '';
    let surname = '';
    let firstName = '';
    let middleName = '';
    let muassasa = '';

    for (let i = 0; i < cellTexts.length; i++) {
      const txt = cellTexts[i];
      if (/^dr\./i.test(txt) || /shifokor/i.test(txt)) {
        doctorName = txt;
      } else if (!patientId && /^\d{4,8}$/.test(txt)) {
        patientId = txt;
        if (cellTexts[i + 1]) surname = cellTexts[i + 1];
        if (cellTexts[i + 2]) firstName = cellTexts[i + 2];
        if (cellTexts[i + 3]) middleName = cellTexts[i + 3];
      }
    }

    if (!patientId && !surname) return null;

    // Muassasa nomini topish (Orderli, Sugurta Ambulator..., Rezident, No rezident, Vaqf, Imtiyoz)
    for (const t of cellTexts) {
      const low = t.toLowerCase();
      if (
        low.includes('rezident') ||
        low.includes("sug'urta") ||
        low.includes('sugurta') ||
        low.includes('order') ||
        low.includes('vaqf') ||
        low.includes('imtiyoz')
      ) {
        muassasa = t;
        break;
      }
    }
    if (!muassasa && cells[5]) {
      muassasa = cells[5].innerText.trim();
    }
    if (!muassasa) muassasa = 'Rezident';

    const statusType = getPatientStatusType(muassasa);

    // Clean patronymic
    if (/^(xxx|xx|x|\-+|none|null)$/i.test(middleName.trim())) {
      middleName = '';
    }

    const fullName = [surname, firstName, middleName].filter(Boolean).join(' ').trim() || 'Bemor';

    return {
      patientId: patientId || '—',
      doctorName: doctorName || 'Shifokor',
      surname,
      firstName,
      middleName,
      fullName,
      muassasa,
      statusType
    };
  }

  // Muassasa bo'yicha tarif turini aniqlash:
  // 1. Rezident -> rezident narxi
  // 2. No Rezident -> norezident narxi
  // 3. Sug'urta, Order, Orderli, Vaqf, Imtiyoz va boshqalar -> sugurta narxi
  function getPatientStatusType(muassasaText) {
    if (!muassasaText) return 'rezident';
    const clean = muassasaText.toLowerCase().trim();

    // No Rezident
    if (clean.includes('no rezident') || clean.includes('norezident') || clean.includes('no-rezident')) {
      return 'norezident';
    }

    // Rezident
    if (clean === 'rezident' || (clean.includes('rezident') && !clean.includes('no'))) {
      return 'rezident';
    }

    // Sug'urta, Order, Orderli, Vaqf, Imtiyoz va boshqa barcha holatlar
    return 'sugurta';
  }

  function getServicePriceByStatus(service, statusType = 'rezident') {
    if (!service) return { price: 0, priceFormatted: '0 so\'m' };
    let p = 0;
    if (service.prices && service.prices[statusType] !== undefined) {
      p = service.prices[statusType];
    } else {
      const base = service.price || 0;
      if (statusType === 'norezident') p = Math.round(base * 1.6);
      else if (statusType === 'sugurta') p = Math.round(base * 0.98);
      else p = base;
    }

    return {
      price: p,
      priceFormatted: formatCurrency(p)
    };
  }

  // Find currently highlighted / selected row if currentPatient is null
  function getSelectedPatientFromPage() {
    if (currentPatient) return currentPatient;

    const allRows = Array.from(document.querySelectorAll('tr'));
    for (const tr of allRows) {
      const cls = (tr.className || '').toLowerCase();
      const style = tr.getAttribute('style') || '';
      const isSelected = cls.includes('selected') || cls.includes('focused') || style.includes('background') || style.includes('#d8b4e2');

      if (isSelected) {
        const p = parsePatientFromRow(tr);
        if (p && p.patientId !== '—') {
          currentPatient = p;
          currentDrawerTariff = p.statusType;
          return p;
        }
      }
    }
    return null;
  }

  // ============================================================
  // 3. SUBTABLE DETECTION & INLINE ROW PRICE INJECTION
  // ============================================================
  function detectAndInjectSubtablePrices() {
    // Remove old broken column cells or black bar if any exist
    const oldCells = document.querySelectorAll('.kp-col-price-head, .kp-col-price-cell, #kp-subtable-total-bar');
    if (oldCells.length > 0) {
      oldCells.forEach(el => el.remove());
    }

    const patient = getSelectedPatientFromPage();
    const statusType = patient ? patient.statusType : 'rezident';

    const allRows = Array.from(document.querySelectorAll('tr'));
    const matchedItems = [];

    for (const row of allRows) {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 2) continue;

      const cellTexts = cells.map(c => c.innerText.trim());

      // Skip top patient list rows (they have doctor name or patient ID)
      const isTopPatientRow = cellTexts.some(t => /^dr\./i.test(t));
      if (isTopPatientRow) continue;

      let matchedService = null;
      let matchedCode = '';
      let matchedName = '';
      let nameCell = null;

      // Scan all cells in the row to find medical examination code
      for (let i = 0; i < cells.length; i++) {
        const raw = cellTexts[i];
        if (!raw) continue;

        const clean = raw.toUpperCase().replace(/[\s\-_]/g, '');

        // 1. Direct code lookup in catalog (R62, R64, R157, etc.)
        if (catalogByCode.has(clean)) {
          matchedCode = clean;
          matchedService = catalogByCode.get(clean);
          if (cells[i + 1] && cellTexts[i + 1].length >= 3) {
            matchedName = cellTexts[i + 1];
            nameCell = cells[i + 1];
          }
          break;
        }

        // 2. Regex code match R\d+ or X\d+
        const m = raw.match(/\b([RX]\s*\d{1,5})\b/i);
        if (m) {
          const potentialCode = m[1].toUpperCase().replace(/\s+/g, '');
          if (catalogByCode.has(potentialCode)) {
            matchedCode = potentialCode;
            matchedService = catalogByCode.get(potentialCode);
            if (cells[i + 1] && cellTexts[i + 1].length >= 3) {
              matchedName = cellTexts[i + 1];
              nameCell = cells[i + 1];
            }
            break;
          }
        }
      }

      // 3. Fallback: match by examination name in catalog
      if (!matchedService) {
        for (let i = 0; i < cells.length; i++) {
          const raw = cellTexts[i];
          if (raw.length >= 4) {
            const norm = normalizeName(raw);
            if (catalogByName.has(norm)) {
              matchedService = catalogByName.get(norm);
              matchedCode = matchedService.code;
              matchedName = matchedService.name;
              nameCell = cells[i];
              break;
            }
          }
        }
      }

      if (matchedService) {
        const targetCell = nameCell || cells[1] || cells[0];
        const priceInfo = getServicePriceByStatus(matchedService, statusType);

        const rezPrice = (matchedService.pricesFormatted && matchedService.pricesFormatted.rezident) || formatCurrency(matchedService.price);
        const noRezPrice = (matchedService.pricesFormatted && matchedService.pricesFormatted.norezident) || formatCurrency(Math.round(matchedService.price * 1.6));
        const sugPrice = (matchedService.pricesFormatted && matchedService.pricesFormatted.sugurta) || formatCurrency(Math.round(matchedService.price * 0.98));

        // INJECT INLINE PRICE BADGE DIRECTLY INTO NAME CELL
        let badge = targetCell.querySelector('.kp-row-price-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'kp-row-price-badge';
          targetCell.appendChild(badge);
        }
        badge.textContent = `[ ${priceInfo.priceFormatted} ]`;
        badge.title = `Rezident: ${rezPrice} | No rezident: ${noRezPrice} | Sug'urta/Order: ${sugPrice}`;

        matchedItems.push({
          row,
          code: matchedCode || matchedService.code,
          name: matchedName || matchedService.name,
          price: priceInfo.price,
          priceFormatted: priceInfo.priceFormatted,
          prices: matchedService.prices,
          pricesFormatted: matchedService.pricesFormatted,
          date: cells[2] ? cells[2].innerText.trim() : "",
          queueNo: cells[3] ? cells[3].innerText.trim() : ""
        });
      }
    }

    if (matchedItems.length === 0) {
      updateTashxisTotalBadge(null, 0, patient);
      const hud = document.getElementById('karmed-patient-hud');
      if (hud && !currentPatient) hud.style.display = 'none';
      return;
    }

    detectedSubtableServices = matchedItems;

    // Calculate TRUE TOTAL of all detected row services according to patient's muassasa
    const totalSum = matchedItems.reduce((acc, cur) => acc + cur.price, 0);

    // Update Tashxis header badge
    updateTashxisTotalBadge(matchedItems, totalSum, patient);

    // Update Patient Live HUD Card
    updatePatientHud(patient, matchedItems, totalSum);
  }

  // ============================================================
  // 4. CLEAN TASHXIS TOTAL BADGE (NO BLACK BAR!)
  // ============================================================
  function updateTashxisTotalBadge(items, totalSum, patient) {
    let badge = document.getElementById('kp-tashxis-total-badge');

    if (!items || items.length === 0) {
      if (badge) badge.style.display = 'none';
      return;
    }

    // Find container containing "Tashxislar"
    if (!badge) {
      let tashxisEl = null;
      const allElements = Array.from(document.querySelectorAll('div, span, td, b, strong, p'));
      for (const el of allElements) {
        if (el.children.length === 0 && el.innerText.trim().toLowerCase().startsWith('tashxislar')) {
          tashxisEl = el;
          break;
        }
      }

      if (tashxisEl) {
        badge = document.createElement('span');
        badge.id = 'kp-tashxis-total-badge';
        badge.className = 'kp-tashxis-badge';
        badge.title = "Hisobni nusxalash uchun bosing";
        tashxisEl.insertAdjacentElement('afterend', badge);
      }
    }

    if (badge) {
      const muassasaLabel = patient ? patient.muassasa : 'Rezident';
      badge.style.display = 'inline-flex';
      badge.innerHTML = `💰 Jami to'lov: ${formatCurrency(totalSum)} (${escapeHtml(muassasaLabel)} • ${items.length} ta)`;

      badge.onclick = (e) => {
        e.stopPropagation();
        let text = `🏥 KARMED BEMOR TEKSHIRUVI:\n`;
        if (patient) {
          text += `Bemor: ${patient.fullName} (ID: ${patient.patientId})\n`;
          text += `Muassasa: ${patient.muassasa} (${patient.statusType})\n`;
          text += `Shifokor: ${patient.doctorName}\n`;
        }
        text += `------------------------------------\n`;
        items.forEach((item, idx) => {
          text += `${idx + 1}. [${item.code}] ${item.name} - ${item.priceFormatted}\n`;
        });
        text += `------------------------------------\n`;
        text += `JAMI (${items.length} ta tekshiruv): ${formatCurrency(totalSum)}\n`;

        copyText(text, `Jami to'lov nusxalandi! (${formatCurrency(totalSum)})`);
      };
    }
  }

  // ============================================================
  // 5. FLOATING PATIENT LIVE HUD CARD
  // ============================================================
  function createPatientHud() {
    const hud = document.createElement('div');
    hud.id = 'karmed-patient-hud';
    hud.style.display = 'none';
    document.body.appendChild(hud);
  }

  function updatePatientHud(patient, items, totalSum) {
    const hud = document.getElementById('karmed-patient-hud');
    if (!hud) return;

    if (!items || items.length === 0) {
      hud.style.display = 'none';
      return;
    }

    hud.style.display = 'flex';

    const count = items.length;
    const sumFormatted = formatCurrency(totalSum);

    const statusBadge = (patient && patient.statusType === 'norezident') 
      ? '🌐 No Rezident' 
      : ((patient && patient.statusType === 'sugurta') ? "📄 Sug'urta / Order" : '🇺🇿 Rezident');

    let rowsHtml = '';
    items.forEach((item, idx) => {
      rowsHtml += `
        <div class="hud-item-row">
          <div class="hud-item-left">
            <span class="hud-item-num">${idx + 1}.</span>
            <span class="hud-item-code">${escapeHtml(item.code)}</span>
            <span class="hud-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
          </div>
          <div class="hud-item-right">
            <span class="hud-item-price">${escapeHtml(item.priceFormatted)}</span>
          </div>
        </div>
      `;
    });

    hud.innerHTML = `
      <div class="hud-header" id="hudHeader">
        <div class="hud-patient-info">
          <span class="hud-patient-name">👤 ${escapeHtml(patient ? patient.fullName : 'Bemor')}</span>
          <span class="hud-patient-id">ID: ${escapeHtml(patient ? patient.patientId : '—')}</span>
          <span class="hud-patient-muassasa" title="${escapeHtml(patient ? patient.muassasa : '')}">🏥 ${escapeHtml(patient ? patient.muassasa : 'Rezident')}</span>
          <span class="hud-status-badge ${patient ? patient.statusType : 'rezident'}">${statusBadge}</span>
        </div>
        <div class="hud-controls">
          <button type="button" class="hud-btn-toggle" id="hudBtnToggle" title="Kichraytirish/Kattalashtirish">
            ${isHudMinimized ? '➕' : '➖'}
          </button>
        </div>
      </div>
      <div class="hud-body" id="hudBody" style="display: ${isHudMinimized ? 'none' : 'block'};">
        <div class="hud-services-list">
          ${rowsHtml}
        </div>
        <div class="hud-footer">
          <div class="hud-total-box">
            <span class="hud-total-lbl">Jami (${count} ta tekshiruv):</span>
            <span class="hud-total-val">${sumFormatted}</span>
          </div>
          <button type="button" class="hud-btn-copy" id="hudBtnCopy" title="Hisobni nusxalash">
            📋 Nusxalash
          </button>
        </div>
      </div>
    `;

    // Toggle minimize
    const header = hud.querySelector('#hudHeader');
    const btnToggle = hud.querySelector('#hudBtnToggle');
    const body = hud.querySelector('#hudBody');

    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      isHudMinimized = !isHudMinimized;
      body.style.display = isHudMinimized ? 'none' : 'block';
      hud.classList.toggle('minimized', isHudMinimized);
      btnToggle.textContent = isHudMinimized ? '➕' : '➖';
    });

    header.addEventListener('dblclick', () => {
      isHudMinimized = !isHudMinimized;
      body.style.display = isHudMinimized ? 'none' : 'block';
      hud.classList.toggle('minimized', isHudMinimized);
      btnToggle.textContent = isHudMinimized ? '➕' : '➖';
    });

    // Copy action
    const btnCopy = hud.querySelector('#hudBtnCopy');
    btnCopy.addEventListener('click', () => {
      let text = `🏥 KARMED BEMOR TEKSHIRUVI:\n`;
      if (patient) {
        text += `Bemor: ${patient.fullName} (ID: ${patient.patientId})\n`;
        text += `Muassasa: ${patient.muassasa} (${statusBadge})\n`;
        text += `Shifokor: ${patient.doctorName}\n`;
      }
      text += `------------------------------------\n`;
      items.forEach((item, idx) => {
        text += `${idx + 1}. [${item.code}] ${item.name} - ${item.priceFormatted}\n`;
      });
      text += `------------------------------------\n`;
      text += `JAMI (${items.length} ta tekshiruv): ${sumFormatted}\n`;

      copyText(text, `Hisob nusxalandi! (${sumFormatted})`);
    });
  }

  // ============================================================
  // 6. FLOATING PREYSKURANT BUTTON & DRAWER
  // ============================================================
  function createFloatingButton() {
    const fab = document.createElement('div');
    fab.id = 'karmed-price-fab';
    fab.title = 'Karmed rasmiy xizmat narxlari va tariflari (Alt + P)';
    fab.innerHTML = `
      <span class="fab-icon">🏷️</span>
      <span class="fab-label">Preyskurant</span>
    `;
    fab.addEventListener('click', () => toggleDrawer());
    document.body.appendChild(fab);
  }

  function createDrawer() {
    const backdrop = document.createElement('div');
    backdrop.id = 'karmed-price-backdrop';
    backdrop.addEventListener('click', () => toggleDrawer(false));
    document.body.appendChild(backdrop);

    const drawer = document.createElement('div');
    drawer.id = 'karmed-price-drawer';
    drawer.innerHTML = `
      <div class="kp-drawer-header">
        <div class="kp-header-title-box">
          <h2>KARMED PREYSKURANT</h2>
          <p>168 ta rasmiy xizmat narxlari (3 ta tarif bo'yicha)</p>
        </div>
        <button type="button" class="kp-close-btn" id="kpCloseBtn" title="Yopish (Esc)">✕</button>
      </div>

      <div class="kp-search-panel">
        <!-- Search Box -->
        <div class="kp-search-box">
          <span class="kp-search-icon">🔍</span>
          <input 
            type="text" 
            class="kp-search-input" 
            id="kpSearchInput" 
            placeholder="Kod yoki xizmat nomi (masalan: R157, Miya, UTT)..." 
            autocomplete="off"
            spellcheck="false"
          >
          <button type="button" class="kp-search-clear" id="kpSearchClear">✕</button>
        </div>

        <!-- Tariff Switcher Bar -->
        <div class="kp-tariff-bar" id="kpTariffBar">
          <button type="button" class="kp-tariff-btn active" data-tariff="rezident">🇺🇿 Rezident</button>
          <button type="button" class="kp-tariff-btn" data-tariff="norezident">🌐 No Rezident</button>
          <button type="button" class="kp-tariff-btn" data-tariff="sugurta">📄 Sug'urta / Order</button>
        </div>

        <!-- Category Tabs -->
        <div class="kp-cats-bar" id="kpCatsBar">
          <button type="button" class="kp-cat-tab active" data-cat="ALL">Barchasi <span class="kp-tab-num" id="kpCount-ALL">168</span></button>
          <button type="button" class="kp-cat-tab" data-cat="MRT">MRT <span class="kp-tab-num" id="kpCount-MRT">68</span></button>
          <button type="button" class="kp-cat-tab" data-cat="MSKT">MSKT <span class="kp-tab-num" id="kpCount-MSKT">23</span></button>
          <button type="button" class="kp-cat-tab" data-cat="Rentgen">Rentgen <span class="kp-tab-num" id="kpCount-Rentgen">41</span></button>
          <button type="button" class="kp-cat-tab" data-cat="UTT">UTT <span class="kp-tab-num" id="kpCount-UTT">33</span></button>
          <button type="button" class="kp-cat-tab" data-cat="EKG">EKG <span class="kp-tab-num" id="kpCount-EKG">3</span></button>
        </div>

        <div class="kp-subfilter-bar">
          <div class="kp-subfilter-chips">
            <button type="button" class="kp-chip-btn" id="kpFilterContrast">💉 Kontrastli</button>
            <button type="button" class="kp-chip-btn" id="kpFilterInjector">⚡ Injektorli</button>
          </div>
          <div class="kp-subfilter-info" id="kpFilterInfo">168 ta xizmat</div>
        </div>
      </div>

      <div class="kp-viewport" id="kpViewport">
        <div class="kp-list" id="kpList"></div>
      </div>

      <div class="kp-calc-footer">
        <div class="kp-calc-hint" id="kpCalcHint">
          <span>💡</span> Bir nechta xizmat tanlab jami narxini hisoblang
        </div>
        <div class="kp-calc-active" id="kpCalcActive" style="display: none;">
          <div class="kp-calc-left">
            <span class="kp-calc-badge" id="kpCalcCount">0 ta xizmat</span>
            <div class="kp-calc-sum-wrap">
              <span class="kp-calc-sum-lbl">Jami:</span>
              <span class="kp-calc-sum-val" id="kpCalcTotal">0 so'm</span>
            </div>
          </div>
          <div class="kp-calc-actions">
            <button type="button" class="kp-calc-btn kp-btn-copy-calc" id="kpBtnCopyCalc">📋 Nusxalash</button>
            <button type="button" class="kp-calc-btn kp-btn-reset-calc" id="kpBtnResetCalc">✕ Tozalash</button>
          </div>
        </div>
      </div>

      <div class="kp-toast" id="kpToast"></div>
    `;

    document.body.appendChild(drawer);
    setupDrawerEvents(drawer);
  }

  function toggleDrawer(forceState) {
    const drawer = document.getElementById('karmed-price-drawer');
    const backdrop = document.getElementById('karmed-price-backdrop');
    if (!drawer || !backdrop) return;

    isDrawerOpen = typeof forceState === 'boolean' ? forceState : !isDrawerOpen;

    if (isDrawerOpen) {
      drawer.classList.add('open');
      backdrop.classList.add('open');

      // Sync active patient status
      if (currentPatient) {
        currentDrawerTariff = currentPatient.statusType;
        const tariffBar = drawer.querySelector('#kpTariffBar');
        if (tariffBar) {
          tariffBar.querySelectorAll('.kp-tariff-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tariff === currentDrawerTariff);
          });
        }
      }

      // If active patient has services and none selected yet, auto-select them
      if (selectedCodes.size === 0 && detectedSubtableServices.length > 0) {
        detectedSubtableServices.forEach(s => selectedCodes.add(s.code));
        updateCalcUI();
      }

      renderDrawerList();
      const input = document.getElementById('kpSearchInput');
      if (input) setTimeout(() => input.focus(), 150);
    } else {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
    }
  }

  function setupDrawerEvents(drawer) {
    const closeBtn = drawer.querySelector('#kpCloseBtn');
    const searchInput = drawer.querySelector('#kpSearchInput');
    const searchClear = drawer.querySelector('#kpSearchClear');
    const tariffBar = drawer.querySelector('#kpTariffBar');
    const catsBar = drawer.querySelector('#kpCatsBar');
    const filterContrast = drawer.querySelector('#kpFilterContrast');
    const filterInjector = drawer.querySelector('#kpFilterInjector');
    const btnResetCalc = drawer.querySelector('#kpBtnResetCalc');
    const btnCopyCalc = drawer.querySelector('#kpBtnCopyCalc');

    closeBtn.addEventListener('click', () => toggleDrawer(false));

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      searchClear.style.display = searchQuery ? 'flex' : 'none';
      renderDrawerList();
    });

    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClear.style.display = 'none';
      searchInput.focus();
      renderDrawerList();
    });

    if (tariffBar) {
      tariffBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.kp-tariff-btn');
        if (!btn) return;
        tariffBar.querySelectorAll('.kp-tariff-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDrawerTariff = btn.dataset.tariff;
        renderDrawerList();
        updateCalcUI();
      });
    }

    catsBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.kp-cat-tab');
      if (!btn) return;
      catsBar.querySelectorAll('.kp-cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.cat;
      renderDrawerList();
    });

    filterContrast.addEventListener('click', () => {
      onlyContrast = !onlyContrast;
      filterContrast.classList.toggle('active', onlyContrast);
      renderDrawerList();
    });

    filterInjector.addEventListener('click', () => {
      onlyInjector = !onlyInjector;
      filterInjector.classList.toggle('active', onlyInjector);
      renderDrawerList();
    });

    btnResetCalc.addEventListener('click', () => {
      selectedCodes.clear();
      updateCalcUI();
      renderDrawerList();
      showToast('Belgilashlar tozalandi');
    });

    btnCopyCalc.addEventListener('click', () => {
      if (selectedCodes.size === 0) return;
      const selected = servicesCatalog.filter(s => selectedCodes.has(s.code));
      const total = selected.reduce((acc, cur) => acc + getServicePriceByStatus(cur, currentDrawerTariff).price, 0);

      const tariffLabel = currentDrawerTariff === 'norezident' 
        ? 'No Rezident' 
        : (currentDrawerTariff === 'sugurta' ? "Sug'urta / Order" : 'Rezident');

      let text = `🏥 KARMED XIZMATLARI HISOBLANDI (${tariffLabel}):\n`;
      text += `------------------------------------\n`;
      selected.forEach((item, idx) => {
        const pInfo = getServicePriceByStatus(item, currentDrawerTariff);
        text += `${idx + 1}. [${item.code}] ${item.name} - ${pInfo.priceFormatted}\n`;
      });
      text += `------------------------------------\n`;
      text += `JAMI (${selected.length} ta): ${formatCurrency(total)}\n`;

      copyText(text, `Hisob-kitob nusxalandi! (${formatCurrency(total)})`);
    });

    updateDrawerTabCounts();
  }

  function renderDrawerList() {
    const listEl = document.getElementById('kpList');
    const infoEl = document.getElementById('kpFilterInfo');
    if (!listEl) return;

    const normQ = cyrillicToLatin(searchQuery).replace(/[^a-z0-9]/g, '');

    const filtered = servicesCatalog.filter(item => {
      if (currentCategory !== 'ALL' && item.category !== currentCategory) return false;
      if (onlyContrast && !item.isContrast) return false;
      if (onlyInjector && !item.isInjector) return false;
      if (searchQuery) {
        const mCode = item.code.toLowerCase().includes(searchQuery);
        const mName = item.name.toLowerCase().includes(searchQuery);
        const normName = cyrillicToLatin(item.name).replace(/[^a-z0-9]/g, '');
        const normLatin = item.nameLatin ? item.nameLatin.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const mTranslit = normName.includes(normQ) || normLatin.includes(normQ);
        if (!mCode && !mName && !mTranslit) return false;
      }
      return true;
    });

    if (infoEl) infoEl.textContent = `${filtered.length} ta xizmat`;

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="kp-empty">
          <div style="font-size:32px;margin-bottom:8px;">🔍</div>
          <div style="font-weight:700;color:#334155;">Mos xizmat topilmadi</div>
          <div style="font-size:12px;color:#64748b;">Qidiruv so'zini o'zgartirib ko'ring</div>
        </div>
      `;
      return;
    }

    const activeTariffLabel = currentDrawerTariff === 'norezident' 
      ? 'No Rezident' 
      : (currentDrawerTariff === 'sugurta' ? "Sug'urta" : 'Rezident');

    let html = '';
    filtered.forEach(item => {
      const isChecked = selectedCodes.has(item.code);
      const highlightedName = highlightMatch(item.name, searchQuery);
      const highlightedCode = highlightMatch(item.code, searchQuery);
      const pInfo = getServicePriceByStatus(item, currentDrawerTariff);

      const rezPrice = (item.pricesFormatted && item.pricesFormatted.rezident) || formatCurrency(item.price);
      const noRezPrice = (item.pricesFormatted && item.pricesFormatted.norezident) || formatCurrency(Math.round(item.price * 1.6));
      const sugPrice = (item.pricesFormatted && item.pricesFormatted.sugurta) || formatCurrency(Math.round(item.price * 0.98));

      html += `
        <div class="kp-row ${isChecked ? 'selected' : ''}" data-code="${item.code}">
          <div class="kp-row-check">
            <input type="checkbox" class="kp-check" data-code="${item.code}" ${isChecked ? 'checked' : ''}>
          </div>
          <div class="kp-row-info">
            <div class="kp-meta-row">
              <span class="kp-badge-code ${item.category}">${highlightedCode}</span>
              ${item.isContrast ? '<span class="kp-tag-badge kp-tag-contrast">💉 Kontrast</span>' : ''}
              ${item.isInjector ? '<span class="kp-tag-badge kp-tag-injector">⚡ Injektor</span>' : ''}
            </div>
            <div class="kp-row-title">${highlightedName}</div>
            <div class="kp-tariffs-row">
              <span class="kp-tp-pill rezident ${currentDrawerTariff === 'rezident' ? 'active' : ''}" title="O'zbekiston fuqarolari">
                <span class="kp-tp-lbl">Rezident:</span>
                <span class="kp-tp-val">${rezPrice}</span>
              </span>
              <span class="kp-tp-pill norezident ${currentDrawerTariff === 'norezident' ? 'active' : ''}" title="Chet el fuqarolari">
                <span class="kp-tp-lbl">No rezident:</span>
                <span class="kp-tp-val">${noRezPrice}</span>
              </span>
              <span class="kp-tp-pill sugurta ${currentDrawerTariff === 'sugurta' ? 'active' : ''}" title="Davlat tibbiy sug'urta fondi / Order">
                <span class="kp-tp-lbl">Sug'urta/Order:</span>
                <span class="kp-tp-val">${sugPrice}</span>
              </span>
            </div>
          </div>
          <div class="kp-row-price-col">
            <span class="kp-row-price">${pInfo.priceFormatted}</span>
            <span class="kp-tariff-hint ${currentDrawerTariff}">${activeTariffLabel}</span>
            <button type="button" class="kp-btn-copy-item" data-code="${item.code}" title="3 ta narxni nusxalash">
              📋 Nusxa
            </button>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    listEl.querySelectorAll('.kp-row').forEach(row => {
      const code = row.dataset.code;
      const chk = row.querySelector('.kp-check');
      const copyBtn = row.querySelector('.kp-btn-copy-item');

      row.addEventListener('click', (e) => {
        if (e.target.closest('.kp-btn-copy-item')) return;
        if (e.target !== chk) chk.checked = !chk.checked;

        if (chk.checked) {
          selectedCodes.add(code);
          row.classList.add('selected');
        } else {
          selectedCodes.delete(code);
          row.classList.remove('selected');
        }
        updateCalcUI();
      });

      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = servicesCatalog.find(s => s.code === code);
        if (!item) return;

        const rezPrice = (item.pricesFormatted && item.pricesFormatted.rezident) || formatCurrency(item.price);
        const noRezPrice = (item.pricesFormatted && item.pricesFormatted.norezident) || formatCurrency(Math.round(item.price * 1.6));
        const sugPrice = (item.pricesFormatted && item.pricesFormatted.sugurta) || formatCurrency(Math.round(item.price * 0.98));

        const copyText = `[${item.code}] ${item.name}\n` +
          `• Rezident (O'zb): ${rezPrice}\n` +
          `• No rezident (Chet el): ${noRezPrice}\n` +
          `• Sug'urta / Order: ${sugPrice}`;

        copyTextFn(copyText, `${item.code} 3 ta narxi nusxalandi!`);
      });
    });
  }

  function updateCalcUI() {
    const hintEl = document.getElementById('kpCalcHint');
    const activeEl = document.getElementById('kpCalcActive');
    const countEl = document.getElementById('kpCalcCount');
    const totalEl = document.getElementById('kpCalcTotal');

    if (!hintEl || !activeEl) return;

    if (selectedCodes.size === 0) {
      hintEl.style.display = 'flex';
      activeEl.style.display = 'none';
      return;
    }

    hintEl.style.display = 'none';
    activeEl.style.display = 'flex';
    countEl.textContent = `${selectedCodes.size} ta xizmat`;

    let total = 0;
    servicesCatalog.forEach(item => {
      if (selectedCodes.has(item.code)) {
        total += getServicePriceByStatus(item, currentDrawerTariff).price;
      }
    });

    totalEl.textContent = formatCurrency(total);
  }

  function updateDrawerTabCounts() {
    const counts = { ALL: servicesCatalog.length, MRT: 0, MSKT: 0, Rentgen: 0, UTT: 0, EKG: 0, Boshqa: 0 };
    servicesCatalog.forEach(s => {
      if (counts[s.category] !== undefined) counts[s.category]++;
      else counts.Boshqa++;
    });

    Object.keys(counts).forEach(cat => {
      const el = document.getElementById(`kpCount-${cat}`);
      if (el) el.textContent = counts[cat];
    });
  }

  // ============================================================
  // 7. GENERAL HELPERS
  // ============================================================
  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="kp-highlight">$1</span>');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCurrency(val) {
    return Math.round(val).toLocaleString('uz-UZ').replace(/,/g, ' ') + " so'm";
  }

  function copyTextFn(text, msg) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(msg);
    });
  }

  function copyText(text, msg) {
    copyTextFn(text, msg);
  }

  function showToast(msg) {
    const toast = document.getElementById('kpToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }
})();
