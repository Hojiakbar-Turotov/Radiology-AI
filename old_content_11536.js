/**
 * CONTENT.JS - KARMED TEZKOR VRACH BIRIKTIRISH (0-9)
 * 
 * To'liq Avtomatlashtirilgan Jarayon:
 * 1. Bemor / fayl qatori tanlanadi.
 * 2. Klaviaturadan 0-9 raqami bosiladi (yoki ekrandagi tugma bosiladi).
 * 3. Qator ustiga sichqoncha o'ng tugmasi (contextmenu) bosiladi.
 * 4. Chiqqan kontekst menyudan «Pastdagi bo'limlarni o'zgartir» bandi avtomatik bosiladi.
 * 5. «Pastdagi bo'limlar ro'yxati so'ralmoqda...» modal oynasidan raqamga mos vrach tanlanadi.
 * 6. Modalning [Ok] tugmasi bosilib, vrach tasdiqlanadi.
 */

(function () {
  if (window.__karmedQuickAssignLoaded) return;
  window.__karmedQuickAssignLoaded = true;

  // 1. VRACHLAR VA 0-9 RAQAMLARI RO'YXATI
  const DOCTORS = {
    "1": {
      num: "1",
      room: "Ultratovush-1",
      shortName: "Juravlev",
      fullName: "Juravlev Igor Ivanovich",
      aliases: ["juravlev", "igor", "ultratovush-1", "ultratovush 1", "juravlev igor ivanovich", "журавлев"]
    },
    "2": {
      num: "2",
      room: "Ultratovush-2",
      shortName: "Kurbanova",
      fullName: "Kurbanova Sevinch Musayevna",
      aliases: ["kurbanova", "sevinch", "ultratovush-2", "ultratovush 2", "kurbanova sevinch musayevna", "курбанова"]
    },
    "3": {
      num: "3",
      room: "Ultratovush-3",
      shortName: "Abidjanov",
      fullName: "Abidjanov Alisher Maxamataliyevich",
      aliases: ["abidjanov", "alisher", "ultratovush-3", "ultratovush 3", "abidjanov alisher maxamataliyevich", "абиджанов"]
    },
    "4": {
      num: "4",
      room: "Ultratovush-4",
      shortName: "Ziyayeva",
      fullName: "Ziyayeva Zarina Abduganiyevna",
      aliases: ["ziyayeva", "zarina", "ultratovush-4", "ultratovush 4", "ziyayeva zarina abduganiyevna", "зияева"]
    },
    "5": {
      num: "5",
      room: "Ultratovush-5",
      shortName: "Xoshimova",
      fullName: "Xoshimova Lola Kabulovna",
      aliases: ["xoshimova", "lola", "ultratovush-5", "ultratovush 5", "xoshimova lola kabulovna", "хошимова"]
    },
    "6": {
      num: "6",
      room: "Ultratovush-6",
      shortName: "Toirova",
      fullName: "Toirova Shaxlo Oybek qizi",
      aliases: ["toirova", "shaxlo", "ultratovush-6", "ultratovush 6", "toirova shaxlo oybek qizi", "тоирова"]
    },
    "7": {
      num: "7",
      room: "Ultratovush-7",
      shortName: "Asadova",
      fullName: "Asadova Dildoraxon Asatullayevna",
      aliases: ["asadova", "dildora", "dildoraxon", "ultratovush-7", "ultratovush 7", "asadova dildoraxon asatullayevna", "асадова"]
    },
    "8": {
      num: "8",
      room: "Ultratovush-8",
      shortName: "Saidbayeva",
      fullName: "Saidbayeva Zulfiya Yergeshovna",
      aliases: ["saidbayeva", "zulfiya", "ultratovush-8", "ultratovush 8", "saidbayeva zulfiya yergeshovna", "саидбаева"]
    },
    "9": {
      num: "9",
      room: "Ultratovush-9",
      shortName: "Xusanova",
      fullName: "Xusanova Feruza Ikromjonovna",
      aliases: ["xusanova", "feruza", "ultratovush-9", "ultratovush 9", "xusanova feruza ikromjonovna", "хусанова"]
    },
    "0": {
      num: "0",
      room: "Ultratovush-10",
      shortName: "Xudayberdiyeva",
      fullName: "Xudayberdiyeva Nigora Nizamovna",
      aliases: ["xudayberdiyeva", "nigora", "ultratovush-10", "ultratovush 10", "xudayberdiyeva nigora nizamovna", "худайбердиева"]
    }
  };

  // State
  let lastSelectedRow = null;
  let isAssigning = false;
  let isBarMinimized = false;
  let toastTimer = null;

  initExtension();

  function initExtension() {
    createQuickBar();
    createToastElement();
    initRowClickListener();
    initKeyboardListener();
    console.log('[Karmed Tezkor Vrach] Kengaytma tayyor. 0-9 tugmalari faol.');
  }

  // 2. QATOR TANLASHNI KUZATISH
  function initRowClickListener() {
    document.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      if (!tr) return;

      if (isStudyRow(tr)) {
        setActiveRow(tr);
      }
    }, true);
  }

  function isStudyRow(tr) {
    if (!tr) return false;
    if (tr.querySelector('th')) return false;
    // Popup yoki yordamchi elementlar qatorlarini chiqarib tashlash
    if (tr.closest('#utt-quick-assign-bar, #karmed-assign-toast, .dxpcLite, div[id*="Popup"]')) return false;

    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length < 4) return false;

    const text = tr.innerText.toLowerCase();
    if (text.includes('ultratovush') || text.includes('mrt') || text.includes('dr.') || text.includes('rentgen') || text.includes('mskt') || /\b\d{4,8}\b/.test(text)) {
      return true;
    }
    return false;
  }

  function setActiveRow(tr) {
    if (lastSelectedRow && lastSelectedRow !== tr) {
      lastSelectedRow.classList.remove('karmed-active-study-row');
    }
    lastSelectedRow = tr;
    lastSelectedRow.classList.add('karmed-active-study-row');
  }

  function getSelectedStudyRow() {
    // 1. Oxirgi bosilgan faol qator
    if (lastSelectedRow && document.body.contains(lastSelectedRow)) {
      return lastSelectedRow;
    }

    // 2. DevExpress tomonidan belgilangan qator
    const selected = document.querySelector('tr.dxgvSelectedRow_Office2010Blue, tr.dxgvFocusedRow_Office2010Blue, tr[class*="SelectedRow"], tr[class*="FocusedRow"]');
    if (selected && isStudyRow(selected)) {
      setActiveRow(selected);
      return selected;
    }

    // 3. Rang bilan ajratilgan qator
    const rows = Array.from(document.querySelectorAll('tr'));
    for (const r of rows) {
      if (!isStudyRow(r)) continue;
      const bg = window.getComputedStyle(r).backgroundColor;
      if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(255, 255, 255)' && !bg.includes('255, 255, 255')) {
        setActiveRow(r);
        return r;
      }
    }

    return null;
  }

  // 3. KLAVIATURA (0-9) TINGLOVCHISI
  function initKeyboardListener() {
    document.addEventListener('keydown', (e) => {
      // Qidiruv yoki matn yozish kataklari ichida bo'lsa xalaqit bermaslik
      const active = document.activeElement;
      if (active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable ||
        active.getAttribute('role') === 'textbox' ||
        active.getAttribute('role') === 'searchbox'
      )) {
        return;
      }

      // Agar modal oyna ochiq bo'lsa va unda qidiruv yozilayotgan bo'lsa xalaqit bermaslik
      const modal = findDoctorModal();
      if (modal && isElementVisible(modal) && active && active.tagName === 'INPUT') {
        return;
      }

      // Modifier (Ctrl, Alt, Meta) bilan bosilgan bo'lsa e'tibor bermaslik
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      let digit = null;
      if (/^[0-9]$/.test(e.key)) {
        digit = e.key;
      } else if (e.code && /^Numpad[0-9]$/.test(e.code)) {
        digit = e.code.replace('Numpad', '');
      }

      if (digit !== null && DOCTORS[digit]) {
        e.preventDefault();
        e.stopPropagation();
        assignDoctorByNumber(digit);
      }
    }, true);
  }

  // 4. ASOSIY AVTOMATLASHTIRISH TIZIMI
  async function assignDoctorByNumber(digit) {
    const doc = DOCTORS[digit];
    if (!doc) return;

    if (isAssigning) {
      showToast(`⏳ Hozir boshqa biriktirish jarayoni ketmoqda...`, 'warn');
      return;
    }

    // 1-QADAM: Agar modal oyna allaqachon ochiq bo'lsa, to'g'ridan-to'g'ri tanlash
    let modal = findDoctorModal();
    if (modal && isElementVisible(modal)) {
      await processDoctorSelectionInModal(modal, doc, digit);
      return;
    }

    // 2-QADAM: Agar kontekst menyu allaqachon ochiq bo'lsa
    let menuItem = findContextMenuItem();
    if (menuItem && isElementVisible(menuItem)) {
      isAssigning = true;
      showToast(`🔄 «Pastdagi bo'limlarni o'zgartir» tanlanmoqda...`, 'info', 2000);
      clickElement(menuItem);

      modal = await waitForDoctorModal(3500);
      if (!modal) {
        showToast(`❌ Bo'limlar ro'yxati oynasi ochilmadi!`, 'error', 3500);
        isAssigning = false;
        return;
      }
      await processDoctorSelectionInModal(modal, doc, digit);
      return;
    }

    // 3-QADAM: Oddiy holat: Fayl qatorini topish va to'liq zanjirni bajarish
    const row = getSelectedStudyRow();
    if (!row) {
      showToast(`⚠️ Iltimos, avval ro'yxatdan kerakli bemor (fayl) qatorini tanlang!`, 'error', 3500);
      return;
    }

    isAssigning = true;
    showToast(`🔄 [${digit}] ${doc.shortName} biriktirilmoqda...`, 'info', 3000);

    try {
      // A. Qatorga sichqoncha o'ng tugmasini bosish
      triggerRightClick(row);

      // B. Kontekst menyu chiqishini kutish va «Pastdagi bo'limlarni o'zgartir» ni bosish
      const menuBtn = await waitForContextMenuItem(2200);
      if (!menuBtn) {
        // Agar to'g'ridan-to'g'ri modal ochilgan bo'lsa tekshirib ko'ramiz
        modal = findDoctorModal();
        if (!modal) {
          showToast(`❌ Kontekst menyu chiqamadi. Qator ustiga o'ng tugmani o'zingiz bosing!`, 'error', 3500);
          isAssigning = false;
          return;
        }
      } else {
        clickElement(menuBtn);
      }

      // C. «Pastdagi bo'limlar ro'yxati so'ralmoqda...» modal oynasini kutish
      if (!modal) {
        modal = await waitForDoctorModal(3500);
      }
      if (!modal) {
        showToast(`❌ Bo'limlar ro'yxati oynasi ochilmadi!`, 'error', 3500);
        isAssigning = false;
        return;
      }

      // D. Vrachni tanlash va [Ok] ni bosish
      await processDoctorSelectionInModal(modal, doc, digit);

    } catch (err) {
      console.error('[Karmed Quick Assign Error]:', err);
      showToast(`⚠️ Xatolik yuz berdi: ${err.message}`, 'error', 3500);
    } finally {
      setTimeout(() => { isAssigning = false; }, 400);
    }
  }

  // 5. MODAL ICHIDA VRACHNI TANLASH VA OK BOSISH
  async function processDoctorSelectionInModal(modal, doc, digit) {
    const docRow = await findDoctorRowWithRetry(modal, doc, 2500);
    if (!docRow) {
      showToast(`❌ Ro'yxatdan ${doc.room} (${doc.shortName}) topilmadi!`, 'error', 3500);
      isAssigning = false;
      return;
    }

    // Vrach qatori va checkboxini belgilash
    selectModalRow(docRow);

    // DevExpress tanlovni ro'yxatga olishi uchun qisqa pauza
    await sleep(120);

    // [Ok] tugmasini bosish
    const okClicked = clickOkButtonInModal(modal);
    if (okClicked) {
      showToast(`✅ [${digit}] ${doc.room} (${doc.fullName}) muvaffaqiyatli biriktirildi!`, 'success', 4000);
    } else {
      showToast(`⚠️ Vrach belgilandi, lekin [Ok] tugmasi topilmadi. O'zingiz Ok bosing!`, 'warn', 4000);
    }
  }

  // 6. SICHQONCHA O'NG TUGMASI (CONTEXTMENU) SIMULYATSIYASI
  function triggerRightClick(row) {
    const cells = Array.from(row.querySelectorAll('td'));
    // Karmedda 6 yoki 7-ustun odatda "Ulangan bo'lim"
    let target = row;
    for (let i = 0; i < cells.length; i++) {
      const txt = (cells[i].innerText || '').toLowerCase();
      if (txt.includes('ultratovush') || txt.includes('mr2') || txt.includes('bo\'lim') || i === 6) {
        target = cells[i];
        break;
      }
    }
    if (target === row && cells.length > 0) {
      target = cells[Math.min(6, cells.length - 1)];
    }

    const rect = target.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    const eventOpts = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 2,
      buttons: 2,
      clientX,
      clientY
    };

    target.dispatchEvent(new MouseEvent('mousedown', eventOpts));
    target.dispatchEvent(new MouseEvent('mouseup', eventOpts));
    target.dispatchEvent(new MouseEvent('contextmenu', eventOpts));

    if (target !== row) {
      row.dispatchEvent(new MouseEvent('contextmenu', eventOpts));
    }
  }

  // 7. KONTEKST MENYUDAN «PASTDAGI BO'LIMLARNI O'ZGARTIR» NI TOPISH
  function waitForContextMenuItem(maxWaitMs = 2200) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const item = findContextMenuItem();
        if (item && isElementVisible(item)) {
          clearInterval(interval);
          resolve(item);
          return;
        }
        if (Date.now() - startTime > maxWaitMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 35);
    });
  }

  function findContextMenuItem() {
    const elements = Array.from(document.querySelectorAll('div, span, td, a, li, b, p'));
    for (const el of elements) {
      // Faqat matnli yoki 1-2 bolali elementlarni ko'rish
      if (el.children.length > 2) continue;
      const txt = (el.innerText || '').trim().toLowerCase();
      if (
        txt.includes("pastdagi bo'limlarni o'zgartir") ||
        txt.includes("pastdagi bolimlarni ozgartir") ||
        (txt.includes("pastdagi bo'lim") && txt.includes("o'zgartir")) ||
        (txt.includes("pastdagi") && txt.includes("bo'lim"))
      ) {
        const clickable = el.closest('.dxm-item, tr, li, a, td, div') || el;
        if (isElementVisible(clickable)) {
          return clickable;
        }
      }
    }
    return null;
  }

  // 8. «PASTDAGI BO'LIMLAR RO'YXATI SO'RALMOQDA...» MODALINI TOPISH
  function waitForDoctorModal(maxWaitMs = 3500) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const modal = findDoctorModal();
        if (modal && isElementVisible(modal)) {
          clearInterval(interval);
          resolve(modal);
          return;
        }
        if (Date.now() - startTime > maxWaitMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 40);
    });
  }

  function findDoctorModal() {
    // A. Sarlavha matni: "Pastdagi bo'limlar ro'yxati..."
    const headers = Array.from(document.querySelectorAll('div, span, td, b, h1, h2, h3, h4, caption'));
    for (const el of headers) {
      const txt = (el.innerText || '').trim().toLowerCase();
      if (txt.includes("pastdagi bo'limlar") || txt.includes("bo'limlar ro'yxati") || txt.includes("bolimlar royxati")) {
        const modal = el.closest('.dxpcLite, .dxpc-mainDiv, div[style*="z-index"], div[id*="Popup"], div[id*="Modal"], table[id*="Popup"]');
        if (modal && isElementVisible(modal)) return modal;
      }
    }

    // B. Jadval ichida "Bo'lim Adı" yoki "Ultratovush-" bo'lishi
    const tables = Array.from(document.querySelectorAll('table, .dxgvTable'));
    for (const tbl of tables) {
      const txt = (tbl.innerText || '').toLowerCase();
      if ((txt.includes("bo'lim ad") || txt.includes("kod")) && (txt.includes("ultratovush-") || txt.includes("juravlev") || txt.includes("asadova"))) {
        if (isElementVisible(tbl)) {
          const modal = tbl.closest('.dxpcLite, .dxpc-mainDiv, div[style*="z-index"], div[id*="Popup"], div[id*="Modal"]') || tbl;
          return modal;
        }
      }
    }

    // C. Yuqori z-index ga ega eng oxirgi ochilgan popup
    const popups = Array.from(document.querySelectorAll('.dxpcLite, .dxpc-mainDiv, div[id*="Popup"], div[class*="Popup"]'));
    for (const p of popups) {
      if (isElementVisible(p)) {
        const txt = (p.innerText || '').toLowerCase();
        if (txt.includes("ultratovush-") && txt.includes("bo'lim")) {
          return p;
        }
      }
    }

    return null;
  }

  // 9. MODAL ICHIDAN KERAKLI VRACH QATORINI TOPISH
  async function findDoctorRowWithRetry(modal, doc, maxWaitMs = 2500) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const row = findDoctorRowInModal(modal, doc);
      if (row) return row;
      await sleep(60);
    }
    return null;
  }

  function findDoctorRowInModal(modal, doc) {
    const rows = Array.from(modal.querySelectorAll('tr'));
    for (const r of rows) {
      const txt = (r.innerText || '').toLowerCase();
      for (const alias of doc.aliases) {
        if (txt.includes(alias)) {
          return r;
        }
      }
    }
    return null;
  }

  // 10. MODAL QATORINI VA CHECKBOXINI BELGILASH
  function selectModalRow(row) {
    // 1. Input checkbox bo'lsa
    const chk = row.querySelector('input[type="checkbox"]');
    if (chk) {
      clickElement(chk);
      if (!chk.checked) {
        chk.checked = true;
        chk.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 2. DevExpress span checkbox bo'lsa
    const dxChk = row.querySelector('span.dxICheckBox, span[class*="CheckBox"], [role="checkbox"]');
    if (dxChk) {
      clickElement(dxChk);
    }

    // 3. Birinchi katak va qatorning o'zini bosish
    const firstCell = row.querySelector('td');
    if (firstCell) {
      clickElement(firstCell);
    }
    clickElement(row);
  }

  // 11. [OK] TUGMASINI BOSISH
  function clickOkButtonInModal(modal) {
    const clickables = Array.from(modal.querySelectorAll('button, input[type="button"], input[type="submit"], div.dxbButton, a.dxbButton, [role="button"], td.dxbButton, div, span, b'));

    // 1. Aniq "Ok" yoki "OK" yoki "Tamam"
    for (const el of clickables) {
      const txt = (el.innerText || el.value || '').trim();
      if (/^ok$/i.test(txt) || /^tamam$/i.test(txt) || txt === '✓ Ok') {
        const btn = el.closest('button, input, div.dxbButton, a') || el;
        clickElement(btn);
        return true;
      }
    }

    // 2. Yashil galochkali rasm/ikonka
    const imgs = Array.from(modal.querySelectorAll('img, svg, i'));
    for (const img of imgs) {
      const src = (img.src || img.className || '').toLowerCase();
      if (src.includes('ok') || src.includes('check') || src.includes('apply') || src.includes('yes')) {
        const btn = img.closest('button, input, div.dxbButton, a, td') || img;
        clickElement(btn);
        return true;
      }
    }

    // 3. "Ok" so'zi bor tugma
    for (const el of clickables) {
      const txt = (el.innerText || el.value || '').trim();
      if (txt.includes('Ok') && !txt.toLowerCase().includes('bekor')) {
        const btn = el.closest('button, input, div.dxbButton, a') || el;
        clickElement(btn);
        return true;
      }
    }

    return false;
  }

  // 12. ELEMENTNI ISHONCHLI BOSISH
  function clickElement(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    if (typeof el.click === 'function') {
      el.click();
    }
  }

  // 13. EKRaNDAGI TEZKOR TUGMALAR PANELI (QUICK BAR)
  function createQuickBar() {
    if (document.getElementById('utt-quick-assign-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'utt-quick-assign-bar';
    bar.innerHTML = `
      <div class="qbar-header" id="qbarHeader">
        <div class="qbar-title">
          <span class="qbar-icon">⚡</span>
          <b>Tezkor Vrach (0-9)</b>
        </div>
        <div class="qbar-actions">
          <button type="button" class="qbar-btn-toggle" id="qbarToggleBtn" title="Kichraytirish/Kattalashtirish">➖</button>
        </div>
      </div>
      <div class="qbar-body" id="qbarBody">
        <div class="qbar-hint">Klaviaturadan <b>0-9</b> ni bosing yoki quyidagilardan birini tanlang:</div>
        <div class="qbar-grid">
          ${Object.keys(DOCTORS).map(key => {
            const d = DOCTORS[key];
            return `
              <button type="button" class="qbar-item-btn" data-key="${key}" title="${d.room} — ${d.fullName}">
                <span class="qbar-key-badge">${key}</span>
                <span class="qbar-room-name">${d.room.replace('Ultratovush-', 'U-')}</span>
                <span class="qbar-doc-name">${d.shortName}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(bar);

    const toggleBtn = bar.querySelector('#qbarToggleBtn');
    const body = bar.querySelector('#qbarBody');
    const header = bar.querySelector('#qbarHeader');

    toggleBtn.addEventListener('click', () => {
      isBarMinimized = !isBarMinimized;
      body.style.display = isBarMinimized ? 'none' : 'block';
      bar.classList.toggle('minimized', isBarMinimized);
      toggleBtn.textContent = isBarMinimized ? '➕' : '➖';
    });

    header.addEventListener('dblclick', () => {
      isBarMinimized = !isBarMinimized;
      body.style.display = isBarMinimized ? 'none' : 'block';
      bar.classList.toggle('minimized', isBarMinimized);
      toggleBtn.textContent = isBarMinimized ? '➕' : '➖';
    });

    bar.querySelectorAll('.qbar-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        assignDoctorByNumber(key);
      });
    });
  }

  // 14. TOAST BILDIRISHNOMA
  function createToastElement() {
    if (document.getElementById('karmed-assign-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'karmed-assign-toast';
    document.body.appendChild(toast);
  }

  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('karmed-assign-toast');
    if (!toast) return;

    toast.className = `karmed-toast-${type} show`;
    toast.innerHTML = message;

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // 15. YORDAMCHI FUNKSIYALAR
  function isElementVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
