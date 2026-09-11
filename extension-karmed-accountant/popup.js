/**
 * POPUP.JS - KARMED XIZMAT NARXLARI & PREYSKURANT
 * 168 ta rasmiy xizmat narxlari (Google Sheets asosida), 3 ta tarif (Rezident, No Rezident, Sug'urta/Order),
 * tezkor qidiruv va kalkulyator
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const searchInput = document.getElementById('searchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const tariffSwitcherBar = document.getElementById('tariffSwitcherBar');
  const categoryTabs = document.getElementById('categoryTabs');
  const toggleContrastFilter = document.getElementById('toggleContrastFilter');
  const toggleInjectorFilter = document.getElementById('toggleInjectorFilter');
  const filterResultsInfo = document.getElementById('filterResultsInfo');
  const servicesList = document.getElementById('servicesList');
  const totalServicesBadge = document.getElementById('totalServicesBadge');

  // Calculator elements
  const calcHint = document.getElementById('calcHint');
  const calcActive = document.getElementById('calcActive');
  const calcCount = document.getElementById('calcCount');
  const calcTotal = document.getElementById('calcTotal');
  const btnCopyCalc = document.getElementById('btnCopyCalc');
  const btnResetCalc = document.getElementById('btnResetCalc');
  const toastPopup = document.getElementById('toastPopup');

  // State
  let services = [];
  let currentTariff = 'rezident'; // 'rezident' | 'norezident' | 'sugurta'
  let currentCategory = 'ALL';
  let searchQuery = '';
  let onlyContrast = false;
  let onlyInjector = false;
  const selectedCodes = new Set();
  let toastTimer = null;

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

  function getItemPriceInfo(item) {
    let p = 0;
    if (item.prices && item.prices[currentTariff] !== undefined) {
      p = item.prices[currentTariff];
    } else {
      const base = item.price || 0;
      if (currentTariff === 'norezident') p = Math.round(base * 1.6);
      else if (currentTariff === 'sugurta') p = Math.round(base * 0.98);
      else p = base;
    }
    return {
      price: p,
      priceFormatted: formatCurrency(p)
    };
  }

  // 1. LOAD DATA
  try {
    const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('price_catalog.json')
      : 'price_catalog.json';
    const res = await fetch(url);
    services = await res.json();
  } catch (err) {
    console.error('Narxlar katalogini yuklashda xatolik:', err);
    servicesList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Katalog yuklanmadi</div>
        <div class="empty-desc">price_catalog.json fayli topilmadi yoki yuklanmadi.</div>
      </div>
    `;
    return;
  }

  // Update total count
  if (totalServicesBadge) {
    totalServicesBadge.textContent = `${services.length} xizmat`;
  }

  // Update tab counts
  updateTabCounts();

  // Initial render
  renderServices();

  // 2. SEARCH EVENT
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    clearSearchBtn.style.display = searchQuery ? 'flex' : 'none';
    renderServices();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.style.display = 'none';
    searchInput.focus();
    renderServices();
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchQuery = '';
      clearSearchBtn.style.display = 'none';
      renderServices();
    }
  });

  // TARIFF SWITCHER
  if (tariffSwitcherBar) {
    tariffSwitcherBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.tariff-btn');
      if (!btn) return;

      tariffSwitcherBar.querySelectorAll('.tariff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      currentTariff = btn.dataset.tariff;
      renderServices();
      updateCalculator();
    });
  }

  // 3. CATEGORY TABS
  categoryTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    categoryTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    currentCategory = btn.dataset.cat;
    renderServices();
  });

  // 4. SUB FILTERS (Contrast & Injector)
  toggleContrastFilter.addEventListener('click', () => {
    onlyContrast = !onlyContrast;
    toggleContrastFilter.classList.toggle('active', onlyContrast);
    renderServices();
  });

  toggleInjectorFilter.addEventListener('click', () => {
    onlyInjector = !onlyInjector;
    toggleInjectorFilter.classList.toggle('active', onlyInjector);
    renderServices();
  });

  // 5. CALCULATOR ACTIONS
  btnResetCalc.addEventListener('click', () => {
    selectedCodes.clear();
    updateCalculator();
    renderServices();
    showToast('Belgilashlar tozalandi');
  });

  btnCopyCalc.addEventListener('click', () => {
    if (selectedCodes.size === 0) return;

    const tariffTitle = currentTariff === 'norezident' 
      ? 'No Rezident (Chet el fuqarolari)' 
      : (currentTariff === 'sugurta' ? "Sug'urta / Davlat tibbiy sug'urta fondi / Order" : 'Rezident (O\'zbekiston fuqarolari)');

    const selectedItems = services.filter(s => selectedCodes.has(s.code));
    const totalSum = selectedItems.reduce((acc, cur) => acc + getItemPriceInfo(cur).price, 0);

    let text = `🏥 KARMED XIZMATLARI HISOBLANDI (${tariffTitle}):\n`;
    text += `------------------------------------\n`;
    selectedItems.forEach((item, idx) => {
      const pInfo = getItemPriceInfo(item);
      text += `${idx + 1}. [${item.code}] ${item.name} - ${pInfo.priceFormatted}\n`;
    });
    text += `------------------------------------\n`;
    text += `JAMI (${selectedItems.length} ta xizmat): ${formatCurrency(totalSum)}\n`;

    copyToClipboard(text, `Hisob-kitob nusxalandi! (${formatCurrency(totalSum)})`);
  });

  // 6. RENDER FUNCTION
  function renderServices() {
    const filtered = filterServices();

    // Results count info
    filterResultsInfo.textContent = `${filtered.length} ta xizmat`;

    if (filtered.length === 0) {
      servicesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">Mos xizmat topilmadi</div>
          <div class="empty-desc">Qidiruv so'zini yoki tanlangan toifani o'zgartirib ko'ring.</div>
        </div>
      `;
      return;
    }

    const tariffTitle = currentTariff === 'norezident' 
      ? 'No Rezident' 
      : (currentTariff === 'sugurta' ? "Sug'urta" : 'Rezident');

    let html = '';
    filtered.forEach(item => {
      const isChecked = selectedCodes.has(item.code);
      const highlightedName = highlightMatch(item.name, searchQuery);
      const highlightedCode = highlightMatch(item.code, searchQuery);
      const pInfo = getItemPriceInfo(item);

      const rezPrice = (item.pricesFormatted && item.pricesFormatted.rezident) || formatCurrency(item.price);
      const noRezPrice = (item.pricesFormatted && item.pricesFormatted.norezident) || formatCurrency(Math.round(item.price * 1.6));
      const sugPrice = (item.pricesFormatted && item.pricesFormatted.sugurta) || formatCurrency(Math.round(item.price * 0.98));

      html += `
        <div class="service-item ${isChecked ? 'selected' : ''}" data-code="${item.code}">
          <div class="item-check-wrap">
            <input 
              type="checkbox" 
              class="item-check-input" 
              data-code="${item.code}" 
              ${isChecked ? 'checked' : ''}
              title="Hisoblash uchun tanlang"
            >
          </div>
          <div class="item-content">
            <div class="item-header-meta">
              <span class="badge-code ${item.category}">${highlightedCode}</span>
              ${item.isContrast ? '<span class="tag-badge tag-contrast">💉 Kontrast</span>' : ''}
              ${item.isInjector ? '<span class="tag-badge tag-injector">⚡ Injektor</span>' : ''}
            </div>
            <div class="item-title">${highlightedName}</div>
            <div class="item-tariffs-row">
              <span class="tariff-pill rezident ${currentTariff === 'rezident' ? 'active' : ''}" title="O'zbekiston fuqarolari uchun">
                <span class="tp-label">Rezident:</span>
                <span class="tp-val">${rezPrice}</span>
              </span>
              <span class="tariff-pill norezident ${currentTariff === 'norezident' ? 'active' : ''}" title="Chet el fuqarolari uchun">
                <span class="tp-label">No rezident:</span>
                <span class="tp-val">${noRezPrice}</span>
              </span>
              <span class="tariff-pill sugurta ${currentTariff === 'sugurta' ? 'active' : ''}" title="Davlat tibbiy sug'urta fondi / Order uchun">
                <span class="tp-label">Sug'urta/Order:</span>
                <span class="tp-val">${sugPrice}</span>
              </span>
            </div>
          </div>
          <div class="item-price-col">
            <span class="item-price-val">${pInfo.priceFormatted}</span>
            <span class="tariff-badge-hint ${currentTariff}">${tariffTitle}</span>
            <button type="button" class="btn-copy-item" data-code="${item.code}" title="Barcha narxlarni nusxalash">
              📋 Nusxa
            </button>
          </div>
        </div>
      `;
    });

    servicesList.innerHTML = html;

    // Attach row events
    attachItemEvents();
  }

  // 7. FILTER LOGIC
  function filterServices() {
    const normQ = cyrillicToLatin(searchQuery).replace(/[^a-z0-9]/g, '');

    return services.filter(item => {
      // Category
      if (currentCategory !== 'ALL' && item.category !== currentCategory) {
        return false;
      }

      // Sub filters
      if (onlyContrast && !item.isContrast) return false;
      if (onlyInjector && !item.isInjector) return false;

      // Search Query
      if (searchQuery) {
        const matchCode = item.code.toLowerCase().includes(searchQuery);
        const matchName = item.name.toLowerCase().includes(searchQuery);
        const normName = cyrillicToLatin(item.name).replace(/[^a-z0-9]/g, '');
        const normLatin = item.nameLatin ? item.nameLatin.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
        const matchTranslit = normName.includes(normQ) || normLatin.includes(normQ);

        if (!matchCode && !matchName && !matchTranslit) return false;
      }

      return true;
    });
  }

  // 8. ITEM CLICK & COPY EVENTS
  function attachItemEvents() {
    servicesList.querySelectorAll('.service-item').forEach(row => {
      const code = row.dataset.code;
      const checkbox = row.querySelector('.item-check-input');
      const copyBtn = row.querySelector('.btn-copy-item');

      // Click on row toggles checkbox
      row.addEventListener('click', (e) => {
        // If clicked on copy button, don't toggle checkbox
        if (e.target.closest('.btn-copy-item')) return;

        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }

        if (checkbox.checked) {
          selectedCodes.add(code);
          row.classList.add('selected');
        } else {
          selectedCodes.delete(code);
          row.classList.remove('selected');
        }

        updateCalculator();
      });

      // Copy button
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = services.find(s => s.code === code);
        if (!item) return;

        const rezPrice = (item.pricesFormatted && item.pricesFormatted.rezident) || formatCurrency(item.price);
        const noRezPrice = (item.pricesFormatted && item.pricesFormatted.norezident) || formatCurrency(Math.round(item.price * 1.6));
        const sugPrice = (item.pricesFormatted && item.pricesFormatted.sugurta) || formatCurrency(Math.round(item.price * 0.98));

        const copyText = `[${item.code}] ${item.name}\n` +
          `• Rezident (O'zb): ${rezPrice}\n` +
          `• No rezident (Chet el): ${noRezPrice}\n` +
          `• Sug'urta / Order: ${sugPrice}`;
        
        copyToClipboard(copyText, `${item.code} 3 ta narxi nusxalandi!`);
      });
    });
  }

  // 9. CALCULATOR UPDATE
  function updateCalculator() {
    if (selectedCodes.size === 0) {
      calcActive.style.display = 'none';
      calcHint.style.display = 'flex';
      return;
    }

    calcHint.style.display = 'none';
    calcActive.style.display = 'flex';

    calcCount.textContent = `${selectedCodes.size} ta xizmat`;

    let total = 0;
    services.forEach(item => {
      if (selectedCodes.has(item.code)) {
        total += getItemPriceInfo(item).price;
      }
    });

    calcTotal.textContent = formatCurrency(total);
  }

  // 10. UPDATE TAB COUNTS
  function updateTabCounts() {
    const counts = { ALL: services.length, MRT: 0, MSKT: 0, Rentgen: 0, UTT: 0, EKG: 0, Boshqa: 0 };
    services.forEach(s => {
      if (counts[s.category] !== undefined) {
        counts[s.category]++;
      } else {
        counts.Boshqa++;
      }
    });

    Object.keys(counts).forEach(cat => {
      const el = document.getElementById(`count-${cat}`);
      if (el) el.textContent = counts[cat];
    });
  }

  // 11. HELPERS
  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapeHtml(text).replace(regex, '<span class="highlight">$1</span>');
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatCurrency(val) {
    return Math.round(val).toLocaleString('uz-UZ').replace(/,/g, ' ') + " so'm";
  }

  function copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(msg);
    }).catch(() => {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast(msg);
    });
  }

  function showToast(msg) {
    if (!toastPopup) return;
    toastPopup.textContent = msg;
    toastPopup.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastPopup.classList.remove('show');
    }, 2200);
  }
});
