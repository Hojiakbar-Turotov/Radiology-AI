(function() {
  // 1. MODALITETNI ANIQLASH (UTT, MSKT, MRT)
  let currentModality = window.APP_MODALITY || 'AUTO';
  if (currentModality === 'AUTO') {
    const p = window.location.port;
    if (p === '9882' || window.location.pathname.includes('mskt')) currentModality = 'MSKT';
    else if (p === '9883' || window.location.pathname.includes('mrt')) currentModality = 'MRT';
    else currentModality = 'UTT';
  }

  // Sahifa tematikasi va sarlavhalarini o'rnatish
  const body = document.body;
  body.classList.remove('theme-utt', 'theme-mskt', 'theme-mrt');
  if (currentModality === 'MSKT') {
    body.classList.add('theme-mskt');
    document.title = 'MSKT Mobil Agenti (Port 9882)';
  } else if (currentModality === 'MRT') {
    body.classList.add('theme-mrt');
    document.title = 'MRT Mobil Agenti (Port 9883)';
  } else {
    body.classList.add('theme-utt');
    document.title = 'UTT Mobil Agenti (Port 9881)';
  }

  let queueData = null;
  let currentRoom = 'all';
  let activeProfiles = {};
  let selectedProfile = 'R5';
  let currentUser = null;

  const MODALITY_ROOMS = {
    UTT: [
      { name: "51-xona (Xudayberdiyeva N.N.)", altBolumId: 33, odaId: 51 },
      { name: "53-xona (Juravlev I.I.)", altBolumId: 13, odaId: 53 },
      { name: "54-xona (Kurbanova S.M.)", altBolumId: 15, odaId: 54 },
      { name: "46-xona (Abidjanov A.M.)", altBolumId: 16, odaId: 46 },
      { name: "47-xona (Ziyayeva Z.A.)", altBolumId: 18, odaId: 47 },
      { name: "48-xona (Xoshimova L.K.)", altBolumId: 17, odaId: 48 },
      { name: "52-xona (Toirova SH.O.)", altBolumId: 19, odaId: 52 },
      { name: "45-xona (Asadova D.A.)", altBolumId: 32, odaId: 45 },
      { name: "49-xona (Saidbayeva Z.Y.)", altBolumId: 20, odaId: 49 },
      { name: "50-xona (Xusanova F.I.)", altBolumId: 21, odaId: 50 }
    ],
    MRT: [
      { name: "MR1 (1-Qavat)", altBolumId: 1, odaId: 1 },
      { name: "MR2 (-1 Qavat)", altBolumId: 2, odaId: 2 },
      { name: "Shifokor konsultatsiyasi", altBolumId: 66, odaId: 66 }
    ],
    MSKT: [
      { name: "MSKT 1-xona", altBolumId: 23, odaId: 1 },
      { name: "MSKT 2-xona", altBolumId: 24, odaId: 2 },
      { name: "MSKT Shifokor konsultatsiyasi", altBolumId: 66, odaId: 66 }
    ]
  };

  function getAvailableRooms() {
    return MODALITY_ROOMS[currentModality] || MODALITY_ROOMS['UTT'];
  }

  // 2. AUTENTIFIKATSIYA VA SESSIYA BOSHQARUVI
  const SESSION_KEY = 'karmed_agent_session_' + currentModality;

  function getStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem('karmed_agent_session_GLOBAL');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function setStoredSession(sess) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
      localStorage.setItem('karmed_agent_session_GLOBAL', JSON.stringify(sess));
    } catch (e) {}
  }

  function clearStoredSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem('karmed_agent_session_GLOBAL');
    } catch (e) {}
  }

  function getAuthToken() {
    const s = getStoredSession();
    return s && s.token ? s.token : '';
  }

  function checkAuth() {
    const session = getStoredSession();
    const overlay = document.getElementById('m-auth-overlay');
    const userBadge = document.getElementById('m-logged-user-name');

    if (session && session.user && session.token) {
      currentUser = session.user;
      if (overlay) overlay.style.display = 'none';
      if (userBadge) {
        const verifiedTag = currentUser.karmedVerified ? '<span style="color:#22c55e; font-weight:bold; margin-right:4px;">🟢 KARMED:</span>' : '👤 ';
        userBadge.innerHTML = `${verifiedTag}<b>${currentUser.fullName || currentUser.username}</b> <span style="opacity:0.8; font-size:11px;">(${currentUser.username})</span> ${currentUser.role ? '• ' + currentUser.role : ''}`;
      }
      selectedProfile = currentUser.username;
      initAppAfterAuth();
    } else {
      if (overlay) {
        overlay.style.display = 'flex';
        const uInput = document.getElementById('m-login-username');
        if (uInput) uInput.focus();
      }
    }
  }

  // Kirish tugmasi
  const loginForm = document.getElementById('m-auth-form');
  const loginBtn = document.getElementById('m-btn-do-login');
  const errorBox = document.getElementById('m-auth-error');

  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });
  }

  async function handleLogin() {
    const usernameInput = document.getElementById('m-login-username');
    const passwordInput = document.getElementById('m-login-password');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value.trim() : '';

    if (!username || !password) {
      showAuthError("Login va parolni kiriting!");
      return;
    }

    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.innerText = '🛰️ Karmed orqali tekshirilmoqda...';
    }

    try {
      const res = await fetch('/api/mobile-agent/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setStoredSession({ token: data.token, user: data.user });
        currentUser = data.user;
        if (errorBox) errorBox.style.display = 'none';
        const overlay = document.getElementById('m-auth-overlay');
        if (overlay) overlay.style.display = 'none';
        checkAuth();
      } else {
        showAuthError(data.message || "Karmed tizimi login yoki parolni qabul qilmadi!");
      }
    } catch (err) {
      showAuthError("Server bilan aloqa xatosi: " + err.message);
    } finally {
      if (loginBtn) {
        loginBtn.disabled = false;
        loginBtn.innerText = 'Kirish';
      }
    }
  }

  function showAuthError(msg) {
    if (errorBox) {
      errorBox.innerText = msg;
      errorBox.style.display = 'block';
    } else {
      alert(msg);
    }
  }

  // Chiqish (Logout)
  const logoutBtn = document.getElementById('m-btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm("Mobil agentdan chiqmoqchimisiz?")) {
        clearStoredSession();
        currentUser = null;
        checkAuth();
      }
    });
  }

  // 3. TABLARNI ALMASHTIRISH
  document.querySelectorAll('.m-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.m-nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.m-view').forEach(v => v.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById('m-view-' + tab.dataset.tab);
      if (target) target.classList.add('active');

      if (tab.dataset.tab === 'profiles') loadProfiles();
      if (tab.dataset.tab === 'queue') fetchQueue();
    });
  });

  function initAppAfterAuth() {
    loadProfiles();
    fetchQueue();
  }

  // 4. PROFILLLARNI YUKLASH
  async function loadProfiles() {
    try {
      const res = await fetch('/api/karmed-profiles');
      const data = await res.json();
      if (data.success && data.profiles) {
        activeProfiles = data.profiles;
        renderProfilesUI();
      }
    } catch (e) {}
  }

  function renderProfilesUI() {
    const selectEl = document.getElementById('m-user-profile-select');
    const listBox = document.getElementById('m-profiles-list-box');
    if (!selectEl) return;

    selectEl.innerHTML = '';
    if (listBox) listBox.innerHTML = '';

    Object.values(activeProfiles).forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.username;
      opt.innerText = p.username + ' — ' + (p.fullName || 'Xodim');
      if (p.username === selectedProfile) opt.selected = true;
      selectEl.appendChild(opt);

      if (listBox) {
        const row = document.createElement('div');
        row.style.background = '#090d16';
        row.style.border = '1px solid #1e293b';
        row.style.borderRadius = '8px';
        row.style.padding = '8px 12px';
        row.style.fontSize = '12px';
        row.innerHTML = `
          <div style="font-weight:700; color:#38bdf8;">${p.username} — ${p.fullName || ''}</div>
          <div style="font-size:10px; color:#64748b;">Token: ${(p.loginBilgi || '').slice(0, 30)}... | So'nggi faollik: ${p.lastSeen ? new Date(p.lastSeen).toLocaleTimeString() : 'Noma\'lum'}</div>
        `;
        listBox.appendChild(row);
      }
    });

    selectEl.addEventListener('change', (e) => {
      selectedProfile = e.target.value;
    });
  }

  // 5. BEMOR ID BO'YICHA QIDIRUV VA MODALITET BO'YICHA AJRATISH
  const quickSearchBtn = document.getElementById('m-btn-quick-search');
  const idInput = document.getElementById('m-search-id-input');

  if (quickSearchBtn) quickSearchBtn.addEventListener('click', searchPatientById);
  if (idInput) {
    idInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchPatientById();
    });
  }

  async function searchPatientById() {
    const query = idInput ? idInput.value.trim() : '';
    const container = document.getElementById('m-search-result-container');
    if (!query) return;

    container.innerHTML = `<div class="m-loading">Kompyuter agenti Karmeddan (${selectedProfile} profili nomidan, ${currentModality} bo'limi) bemorni qidirmoqda...</div>`;

    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getAuthToken()
        },
        body: JSON.stringify({
          action: 'search_patient_karmed',
          patientId: query,
          profileUsername: selectedProfile,
          modality: currentModality
        })
      });

      const data = await res.json();
      if (!data.success || !data.patient) {
        container.innerHTML = `
          <div class="m-search-card" style="border-color:#ef4444; background:rgba(239, 68, 68, 0.08);">
            <div style="color:#f87171; font-weight:700; font-size:13px;">❌ Bemor topilmadi</div>
            <div style="font-size:12px; color:#cbd5e1;">${data.message || 'Karmed tizimidan hech qanday ma\'lumot qaytmadi.'}</div>
          </div>
        `;
        return;
      }

      renderPatientFullCard(data.patient, container);
    } catch (err) {
      container.innerHTML = `<div class="m-search-card" style="border-color:#ef4444; color:#f87171;">Aloqa xatosi: ${err.message}</div>`;
    }
  }

  // 6. BEMOR KARTASINI MODALITETLARGA AJRATIB CHIQARISH (UTT, MRT, MSKT)
  function renderPatientFullCard(p, container) {
    const services = Array.isArray(p.services) ? p.services : [];
    const grouped = p.groupedServices || {
      utt: services.filter(s => s.category === 'UTT'),
      mrt: services.filter(s => s.category === 'MRT'),
      kt: services.filter(s => s.category === 'KT'),
      rentgen: services.filter(s => s.category === 'RENTGEN'),
      boshqa: services.filter(s => s.category === 'BOSHQA')
    };

    const uttList = grouped.utt || [];
    const mrtList = grouped.mrt || [];
    const ktList = grouped.kt || [];
    const rentgenList = grouped.rentgen || [];
    const otherList = grouped.boshqa || [];

    // Hozirgi aktiv modalitet bo'yicha saralash
    let primaryHtml = '';
    let secondaryHtml = '';

    function renderServiceCategory(categoryKey, title, badgeClass, list, isPrimary) {
      if (!list || list.length === 0) {
        if (isPrimary) {
          return `
            <div class="m-service-category-card ${badgeClass} ${isPrimary ? 'm-scc-primary' : ''}" style="border-style:dashed; opacity:0.85;">
              <div class="m-scc-title">
                <span>${title}</span>
                <span class="m-scc-count-badge">0 ta</span>
              </div>
              <div style="font-size:11px; color:#cbd5e1; font-style:italic;">Ushbu bemorda ${title} bo'yicha buyurtma mavjud emas.</div>
            </div>
          `;
        }
        return '';
      }

      return `
        <div class="m-service-category-card ${badgeClass} ${isPrimary ? 'm-scc-primary' : ''}">
          <div class="m-scc-title">
            <span>${title}</span>
            <span class="m-scc-count-badge">${list.length} ta</span>
          </div>
          ${list.map(s => `
            <div class="m-scc-item">
              <div class="m-scc-item-top">
                <span class="m-scc-code code-${categoryKey}">${s.code || categoryKey.toUpperCase()}</span>
                <span class="m-scc-name">${s.name}</span>
              </div>
              ${s.doctor ? `<div class="m-scc-doc">👨‍⚕️ Shifokor: ${s.doctor}</div>` : ''}
              ${s.status ? `<div style="font-size:10px; color:#38bdf8;">Holat: ${s.status}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `;
    }

    if (currentModality === 'UTT') {
      primaryHtml = renderServiceCategory('utt', '🎯 UTT / UZI TEKSHIRUVLARI (Ushbu bo\'lim)', 'm-scc-utt', uttList, true);
      const otherSecs = [
        renderServiceCategory('mrt', '🧲 MRT Tekshiruvlari (Alohida xona)', 'm-scc-mrt', mrtList, false),
        renderServiceCategory('kt', '⚡ MSKT / KT Tekshiruvlari (Alohida xona)', 'm-scc-kt', ktList, false),
        renderServiceCategory('rentgen', '☢️ Rentgen & Mammografiya', 'm-scc-rentgen', rentgenList, false),
        renderServiceCategory('other', '📋 Boshqa tekshiruvlar', 'm-scc-other', otherList, false)
      ].filter(Boolean).join('');

      if (otherSecs) {
        secondaryHtml = `
          <div class="m-scc-other-dept-wrap">
            <div class="m-scc-other-header">⚠️ Bemorning boshqa bo'limlardagi tekshiruvlari (Aralashtirilmasin):</div>
            ${otherSecs}
          </div>
        `;
      }
    } else if (currentModality === 'MSKT') {
      primaryHtml = renderServiceCategory('kt', '⚡ MSKT / KT TEKSHIRUVLARI (Ushbu bo\'lim)', 'm-scc-kt', ktList, true);
      const otherSecs = [
        renderServiceCategory('utt', '🎯 UTT / UZI Tekshiruvlari', 'm-scc-utt', uttList, false),
        renderServiceCategory('mrt', '🧲 MRT Tekshiruvlari', 'm-scc-mrt', mrtList, false),
        renderServiceCategory('rentgen', '☢️ Rentgen & Mammografiya', 'm-scc-rentgen', rentgenList, false),
        renderServiceCategory('other', '📋 Boshqa tekshiruvlar', 'm-scc-other', otherList, false)
      ].filter(Boolean).join('');

      if (otherSecs) {
        secondaryHtml = `
          <div class="m-scc-other-dept-wrap">
            <div class="m-scc-other-header">⚠️ Bemorning boshqa bo'limlardagi tekshiruvlari (Aralashtirilmasin):</div>
            ${otherSecs}
          </div>
        `;
      }
    } else if (currentModality === 'MRT') {
      primaryHtml = renderServiceCategory('mrt', '🧲 MRT TEKSHIRUVLARI (Ushbu bo\'lim)', 'm-scc-mrt', mrtList, true);
      const otherSecs = [
        renderServiceCategory('utt', '🎯 UTT / UZI Tekshiruvlari', 'm-scc-utt', uttList, false),
        renderServiceCategory('kt', '⚡ MSKT / KT Tekshiruvlari', 'm-scc-kt', ktList, false),
        renderServiceCategory('rentgen', '☢️ Rentgen & Mammografiya', 'm-scc-rentgen', rentgenList, false),
        renderServiceCategory('other', '📋 Boshqa tekshiruvlar', 'm-scc-other', otherList, false)
      ].filter(Boolean).join('');

      if (otherSecs) {
        secondaryHtml = `
          <div class="m-scc-other-dept-wrap">
            <div class="m-scc-other-header">⚠️ Bemorning boshqa bo'limlardagi tekshiruvlari (Aralashtirilmasin):</div>
            ${otherSecs}
          </div>
        `;
      }
    }

    const dosyaId = p.dosyaId || p.labDosyaId || p.dosyaNo || '';
    const displayQueueNo = p.globalQueueNo || p.queueNo || p.queueNum || '—';

    container.innerHTML = `
      <div class="m-patient-full-card">
        <div class="m-pfc-header">
          <div>
            <div class="m-pfc-name">${p.fullName}</div>
            <div class="m-pfc-meta">ID: <strong>${p.patientId || p.dosyaNo}</strong> | PINFL: ${p.pinfl || 'Mavjud emas'}</div>
            <div class="m-pfc-meta">Hujjat/Talon: ${dosyaId || 'Mavjud emas'} | Manzil: ${p.region || 'Toshkent'}</div>
            <div class="m-pfc-room">Hozirgi xona: ${p.room || 'Biriktirilmagan'}</div>
          </div>
          <div class="m-pfc-qnum">#${displayQueueNo}</div>
        </div>

        ${p.diagnosis ? `
          <div style="background:#090d16; padding:8px 10px; border-radius:8px; border:1px solid #1e293b; font-size:11px;">
            <span style="color:#94a3b8; font-weight:700;">Tashxis:</span>
            <span style="color:#e2e8f0;">${p.diagnosis}</span>
          </div>
        ` : ''}

        ${p.allDosyas && p.allDosyas.length > 1 ? `
          <div style="background:#0b1329; padding:8px 10px; border-radius:8px; border:1px solid #1e293b; font-size:11px;">
            <div style="color:#38bdf8; font-weight:700; margin-bottom:4px;">📂 Bemorning barcha faol hujjatlari (${p.allDosyas.length} ta):</div>
            <div style="display:flex; flex-direction:column; gap:4px;">
              ${p.allDosyas.map(d => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#111827; padding:4px 8px; border-radius:4px; font-size:11px;">
                  <span><strong>${d.altBolumAdi || 'Bo\'lim'}</strong> (Talon: #${d.muayeneSirano || d.protokolNo})</span>
                  <span style="color:${String(d.durum || '').toLowerCase().includes('bekleyen') ? '#4ade80' : '#94a3b8'};">${d.durum || ''}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- TEKSHIRUVLAR (MODALITET BO'YICHA AJRATILGAN) -->
        <div class="m-services-container">
          ${primaryHtml}
          ${secondaryHtml}
        </div>

        <!-- AMALLAR PANELI -->
        <div class="m-actions-panel">
          <div style="font-size:11px; font-weight:700; color:#38bdf8;">⚙️ Xonani / Vrachni O'zgartirish:</div>
          <div class="m-change-room-box">
            <select id="m-target-room-select" class="m-select-room">
              ${getAvailableRooms().map(r => `<option value="${r.altBolumId}|${r.odaId}">${r.name}</option>`).join('')}
            </select>
            <button class="m-btn-change-room" id="m-btn-do-change-room">O'zgartirish</button>
          </div>

          <div style="font-size:11px; font-weight:700; color:#38bdf8; margin-top:4px;">⚡ Bemor Qabuli Amallari:</div>
          <div class="m-btn-accept-row">
            <button class="m-btn-accept" id="m-btn-do-accept">✅ Qabul Qilish</button>
            <button class="m-btn-cancel-accept" id="m-btn-do-cancel">🚫 Qabulni Bekor Qilish</button>
          </div>
          <div id="m-action-feedback" style="font-size:11px; text-align:center; min-height:16px;"></div>
        </div>

      </div>
    `;

    // Amallar listenerlari
    document.getElementById('m-btn-do-change-room').addEventListener('click', () => {
      const val = document.getElementById('m-target-room-select').value;
      const [altBolumId, odaId] = val.split('|');
      executePatientAction('change_room_karmed', {
        dosyaId: dosyaId,
        targetAltBolumId: altBolumId,
        targetOdaId: odaId
      });
    });

    document.getElementById('m-btn-do-accept').addEventListener('click', () => {
      executePatientAction('accept_patient_karmed', { dosyaId: dosyaId });
    });

    document.getElementById('m-btn-do-cancel').addEventListener('click', () => {
      if (confirm("Rostdan ham ushbu bemor qabulini bekor qilmoqchimisiz?")) {
        executePatientAction('cancel_accept_karmed', { dosyaId: dosyaId });
      }
    });
  }

  async function executePatientAction(action, extraPayload) {
    const feedback = document.getElementById('m-action-feedback');
    if (feedback) feedback.innerHTML = '<span style="color:#38bdf8;">Buyruq Karmed tizimiga yuborilmoqda...</span>';

    try {
      const res = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + getAuthToken()
        },
        body: JSON.stringify(Object.assign({
          action,
          profileUsername: selectedProfile
        }, extraPayload || {}))
      });

      const data = await res.json();
      if (data.success) {
        if (feedback) feedback.innerHTML = `<span style="color:#4ade80;">✔️ ${data.message || 'Amal muvaffaqiyatli bajarildi!'}</span>`;
        fetchQueue();
      } else {
        if (feedback) feedback.innerHTML = `<span style="color:#f87171;">❌ Xato: ${data.message || data.error || 'Bajarilmadi'}</span>`;
      }
    } catch (err) {
      if (feedback) feedback.innerHTML = `<span style="color:#f87171;">Tarmoq xatosi: ${err.message}</span>`;
    }
  }

  // 7. NAVBATNI OLISH VA KO'RSATISH
  const refreshBtn = document.getElementById('m-btn-refresh');
  if (refreshBtn) refreshBtn.addEventListener('click', fetchQueue);

  async function fetchQueue() {
    const listEl = document.getElementById('m-patient-list');
    if (!listEl) return;

    try {
      const res = await fetch('/api/queue-live');
      const data = await res.json();
      if (data.success && data.data) {
        queueData = data.data;
        updateHeaderStats();
        renderRoomChips();
        renderPatientList();
      }
    } catch (e) {
      listEl.innerHTML = '<div class="m-loading" style="color:#f87171;">Navbatni yuklashda xatolik yuz berdi.</div>';
    }
  }

  function updateHeaderStats() {
    if (!queueData) return;
    const totEl = document.getElementById('m-total-patients');
    const actEl = document.getElementById('m-active-rooms');
    if (totEl) totEl.innerText = queueData.totalPatients || 0;
    if (actEl) actEl.innerText = queueData.doctors ? queueData.doctors.filter(d => d.totalWaiting > 0 || d.callingPatient).length : 0;
  }

  function renderRoomChips() {
    const chipsContainer = document.getElementById('m-room-chips');
    if (!chipsContainer || !queueData || !queueData.doctors) return;

    chipsContainer.innerHTML = '';
    const allChip = document.createElement('button');
    allChip.className = 'm-chip ' + (currentRoom === 'all' ? 'active' : '');
    allChip.innerText = 'Barchasi (' + (queueData.totalPatients || 0) + ')';
    allChip.onclick = () => { currentRoom = 'all'; renderRoomChips(); renderPatientList(); };
    chipsContainer.appendChild(allChip);

    queueData.doctors.forEach(doc => {
      const chip = document.createElement('button');
      chip.className = 'm-chip ' + (currentRoom === doc.roomId ? 'active' : '');
      chip.innerText = `${doc.roomTitle || doc.roomId} (${doc.totalWaiting || 0})`;
      chip.onclick = () => { currentRoom = doc.roomId; renderRoomChips(); renderPatientList(); };
      chipsContainer.appendChild(chip);
    });
  }

  function renderPatientList() {
    const listEl = document.getElementById('m-patient-list');
    if (!listEl || !queueData || !queueData.allPatients) return;

    let patients = queueData.allPatients;
    if (currentRoom !== 'all') {
      patients = patients.filter(p => p.roomId === currentRoom);
    }

    if (patients.length === 0) {
      listEl.innerHTML = '<div class="m-tip-text">Ushbu xonada hozirda bemorlar navbati yo\'q.</div>';
      return;
    }

    listEl.innerHTML = patients.map(p => `
      <div class="m-patient-card" onclick="selectPatientForAction('${p.patientId || p.dosyaNo}')">
        <div class="m-q-num">#${p.queueNum}</div>
        <div class="m-p-details">
          <div class="m-p-name">${p.fullName}</div>
          <div class="m-p-sub">ID: ${p.patientId || p.dosyaNo} • Vaqt: ${p.registeredTime ? new Date(p.registeredTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '—'}</div>
          <div class="m-p-room">${p.roomTitle || p.room || ''} ${p.doctorName ? '(' + p.doctorName + ')' : ''}</div>
        </div>
      </div>
    `).join('');
  }

  window.selectPatientForAction = function(pid) {
    if (!pid) return;
    const searchTab = document.querySelector('[data-tab="search"]');
    if (searchTab) searchTab.click();
    if (idInput) idInput.value = pid;
    searchPatientById();
  };

  // Dastlabki sessiya tekshiruvi
  checkAuth();

  // Har 5 soniyada navbatni avtomatik yangilash
  setInterval(fetchQueue, 5000);

})();
