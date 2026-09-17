/**
 * KARMED UTT NAVBAT TIZIMI — CLIENT APP.JS (v3.0.0)
 * TV Ekran, Yagona Xona TV, Post Boshqaruv va Mobil Qurilmalar uchun Real-Time Boshqaruv
 */

(function () {
  // UNIVERSAL POLYFILLS FOR OLD SMART TVS & WEBKIT (ES5 / iOS 7-9 / Android 4-7)
  if (!String.prototype.padStart) {
    String.prototype.padStart = function(targetLength, padString) {
      targetLength = targetLength >> 0;
      padString = String(typeof padString !== 'undefined' ? padString : ' ');
      if (this.length > targetLength) return String(this);
      targetLength = targetLength - this.length;
      var pad = '';
      while (pad.length < targetLength) pad += padString;
      return pad.slice(0, targetLength) + String(this);
    };
  }
  if (!String.prototype.padEnd) {
    String.prototype.padEnd = function(targetLength, padString) {
      targetLength = targetLength >> 0;
      padString = String(typeof padString !== 'undefined' ? padString : ' ');
      if (this.length > targetLength) return String(this);
      targetLength = targetLength - this.length;
      var pad = '';
      while (pad.length < targetLength) pad += padString;
      return String(this) + pad.slice(0, targetLength);
    };
  }
  if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
      if (typeof start !== 'number') start = 0;
      if (start + search.length > this.length) return false;
      return this.indexOf(search, start) !== -1;
    };
  }
  if (!Array.prototype.includes) {
    Array.prototype.includes = function(searchElement, fromIndex) {
      return this.indexOf(searchElement, fromIndex) !== -1;
    };
  }
  if (!Array.prototype.find) {
    Array.prototype.find = function(predicate) {
      if (this == null) throw new TypeError('Array.prototype.find called on null or undefined');
      if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      for (var i = 0; i < length; i++) {
        var value = list[i];
        if (predicate.call(thisArg, value, i, list)) return value;
      }
      return undefined;
    };
  }
  if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
      if (target == null) throw new TypeError('Cannot convert undefined or null to object');
      var to = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var nextSource = arguments[index];
        if (nextSource != null) {
          for (var nextKey in nextSource) {
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    };
  }
  if (!Array.from) {
    Array.from = function(object) {
      return [].slice.call(object);
    };
  }
  if (!Object.values) {
    Object.values = function(obj) {
      if (obj == null) return [];
      return Object.keys(obj).map(function(key) { return obj[key]; });
    };
  }
  if (!Object.entries) {
    Object.entries = function(obj) {
      if (obj == null) return [];
      var ownProps = Object.keys(obj), i = ownProps.length, resArray = new Array(i);
      while (i--) resArray[i] = [ownProps[i], obj[ownProps[i]]];
      return resArray;
    };
  }

  // 1. DOM ELEMENTLARI
  const body = document.body;

  // Rejim tugmalari
  const btnModeTv = document.getElementById('btnModeTv');
  const btnModeSingleRoom = document.getElementById('btnModeSingleRoom');
  const btnModeEmptyRoom = document.getElementById('btnModeEmptyRoom');
  const btnModePost = document.getElementById('btnModePost');
  const btnModeMobile = document.getElementById('btnModeMobile');

  // Header xona tanlash va Fullscreen
  const roomSelectorWrap = document.getElementById('roomSelectorWrap');
  const singleRoomSelect = document.getElementById('singleRoomSelect');
  const btnToggleFullscreen = document.getElementById('btnToggleFullscreen');
  const fsButtonText = document.getElementById('fsButtonText');

  // Jonli soat va aloqa
  const liveDate = document.getElementById('liveDate');
  const liveTime = document.getElementById('liveTime');
  const liveConnChip = document.getElementById('liveConnChip');
  const liveConnText = document.getElementById('liveConnText');
  const localIpBanner = document.getElementById('localIpBanner');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundStatusText = document.getElementById('soundStatusText');

  // Statistika paneli
  const totalPatientsCount = document.getElementById('totalPatientsCount');
  const activeDoctorsCount = document.getElementById('activeDoctorsCount');
  const selectedPillWrap = document.getElementById('selectedPillWrap');
  const selectedPatientsCount = document.getElementById('selectedPatientsCount');

  // Post kompyuteri filtrlari
  const postControlsPanel = document.getElementById('postControlsPanel');
  const doctorFilterChips = document.getElementById('doctorFilterChips');
  const btnSelectAllDocs = document.getElementById('btnSelectAllDocs');
  const btnClearAllDocs = document.getElementById('btnClearAllDocs');
  const patientSearchInput = document.getElementById('patientSearchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');

  // Asosiy konteynerlar
  const tvQueueGrid = document.getElementById('tvQueueGrid');
  const postTableContainer = document.getElementById('postTableContainer');
  const postPatientTableBody = document.getElementById('postPatientTableBody');
  const tableFilteredCountBadge = document.getElementById('tableFilteredCountBadge');

  // Yagona xona TV ekrani elementlari (Screenshot 2 ko'rinishi)
  const singleRoomWrapper = document.getElementById('singleRoomWrapper');
  const btnSrBackToAll = document.getElementById('btnSrBackToAll');
  const srRoomDropdown = document.getElementById('srRoomDropdown');
  const btnSrFullscreen = document.getElementById('btnSrFullscreen');
  const btnSrToggleMode = document.getElementById('btnSrToggleMode');
  const srBigRoomNumberTitle = document.getElementById('srBigRoomNumberTitle');
  const srFullDateUz = document.getElementById('srFullDateUz');
  const srFullClockTime = document.getElementById('srFullClockTime');
  const srDoctorFullTitle = document.getElementById('srDoctorFullTitle');
  const srTableContainer = document.getElementById('srTableContainer');
  const srPatientTableBody = document.getElementById('srPatientTableBody');
  const srEmptyRoomBox = document.getElementById('srEmptyRoomBox');
  const srEmptyWaitingInfo = document.getElementById('srEmptyWaitingInfo');

  // TV-DEV: Vrachlar ko'rib bo'lgan va oldingi kundan yo'naltirilgan bemorlar elementlari
  const totalCompletedCount = document.getElementById('totalCompletedCount');
  const todayRegPatientsCount = document.getElementById('todayRegPatientsCount');
  const earlierRegPatientsCount = document.getElementById('earlierRegPatientsCount');
  const tvDoctorSummaryRibbon = document.getElementById('tvDoctorSummaryRibbon');
  const tvRibbonDoctorChips = document.getElementById('tvRibbonDoctorChips');

  // Kecha va oldingi kunlarda yo'naltirilgan bemorlar jadvali elementlari
  const earlierPatientsSection = document.getElementById('earlierPatientsSection');
  const btnToggleEarlierPanel = document.getElementById('btnToggleEarlierPanel');
  const earlierPatientsCountBadge = document.getElementById('earlierPatientsCountBadge');
  const eppToggleText = document.getElementById('eppToggleText');
  const earlierPatientsBody = document.getElementById('earlierPatientsBody');
  const earlierPatientsTableBody = document.getElementById('earlierPatientsTableBody');

  // Filter elementlari
  const eppSearchInput = document.getElementById('eppSearchInput');
  const btnEppClearSearch = document.getElementById('btnEppClearSearch');
  const eppDoctorSelect = document.getElementById('eppDoctorSelect');
  const eppStatusSelect = document.getElementById('eppStatusSelect');
  const eppFilteredCountBadge = document.getElementById('eppFilteredCountBadge');
  const btnEppResetAll = document.getElementById('btnEppResetAll');

  // Vrach ko'rgan bemorlar iframe modali elementlari
  const doctorCompletedModal = document.getElementById('doctorCompletedModal');
  const docCompletedIframe = document.getElementById('docCompletedIframe');
  const dimhDoctorTitle = document.getElementById('dimhDoctorTitle');
  const dimhCompletedCountBadge = document.getElementById('dimhCompletedCountBadge');
  const btnDimhNewTab = document.getElementById('btnDimhNewTab');
  const btnDimhClose = document.getElementById('btnDimhClose');

  // Sana tanlash va arxiv ko'rsatkichlari elementlari
  const statsDateInput = document.getElementById('statsDateInput');
  const btnTodayReset = document.getElementById('btnTodayReset');
  const archiveStatusBanner = document.getElementById('archiveStatusBanner');
  const archiveDateDisplay = document.getElementById('archiveDateDisplay');
  const btnReturnToday = document.getElementById('btnReturnToday');
  const lblTodayReg = document.getElementById('lblTodayReg');
  const lblTodayCompleted = document.getElementById('lblTodayCompleted');

  let selectedArchiveDate = null; // null bo'lsa - bugungi jonli navbat; aks holda 'YYYY-MM-DD'
  let cachedLiveQueueData = null; // Bugungi jonli navbat ma'lumotlari keshda saqlanadi

  function getTodayYmd() {
    var now = new Date();
    var y = now.getFullYear();
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // 2. XONALAR NOM VA XONA RAQAMLARI XARITASI (VRACHLAR KATALOGI BILAN)
  const ROOM_MAP = {
    'Ultratovush-1': { title: 'UTT1-53 XONA', roomNum: '53', doctorName: 'Juravlev Igor Ivanovich', shortName: 'Juravlev' },
    'Ultratovush-2': { title: 'UTT2-54 XONA', roomNum: '54', doctorName: 'Kurbanova Sevinch Musayevna', shortName: 'Kurbanova' },
    'Ultratovush-3': { title: 'UTT3-46 XONA', roomNum: '46', doctorName: 'Abidjanov Alisher Maxamataliyevich', shortName: 'Abidjanov' },
    'Ultratovush-4': { title: 'UTT4-47 XONA', roomNum: '47', doctorName: 'Ziyayeva Zarina Abduganiyevna', shortName: 'Ziyayeva' },
    'Ultratovush-5': { title: 'UTT5-48 XONA', roomNum: '48', doctorName: 'Xoshimova Lola Kabulovna', shortName: 'Xoshimova' },
    'Ultratovush-6': { title: 'UTT6-52 XONA', roomNum: '52', doctorName: 'Toirova Shaxlo Oybek qizi', shortName: 'Toirova' },
    'Ultratovush-7': { title: 'UTT7-45 XONA', roomNum: '45', doctorName: 'Asadova Dildoraxon Asatullayevna', shortName: 'Asadova' },
    'Ultratovush-8': { title: 'UTT8-49 XONA', roomNum: '49', doctorName: 'Saidbayeva Zulfiya Yergeshovna', shortName: 'Saidbayeva' },
    'Ultratovush-9': { title: 'UTT9-50 XONA', roomNum: '50', doctorName: 'Xusanova Feruza Ikromjonovna', shortName: 'Xusanova' },
    'Ultratovush-10': { title: 'UTT10-51 XONA', roomNum: '51', doctorName: 'Xudayberdiyeva Nigora Nizamovna', shortName: 'Xudayberdiyeva' },
    'Ultratovush-11': { title: 'UTT11 XONA', roomNum: '11', doctorName: 'Yulchiyeva Nodira Siddikovna', shortName: 'Yulchiyeva' }
  };

  function getRoomDisplayInfo(roomName) {
    if (ROOM_MAP[roomName]) return ROOM_MAP[roomName];
    // Masalan "Ultratovush-1" -> "UTT1 XONA"
    const clean = String(roomName || '').replace('Ultratovush-', 'UTT').replace('Ultratovush', 'UTT');
    return {
      title: `${clean} XONA`,
      roomNum: '',
      doctorName: '',
      shortName: ''
    };
  }

  // 2.1 SHIFOKOR KO'RIB BO'LGAN BEMORLAR STATISTIKASI (4 TA KO'RSATKICH: SHU KUNI, KEYINGI KUNDA, KUTMOQDA, JAMI)
  function getDoctorCompletedStats(docIdOrRoom) {
    if (!queueData) return { completed: 0, completedToday: 0, completedEarlier: 0, seenToday: 0, seenLater: 0, waiting: 0, inProgress: 0, total: 0 };
    const rKey = String(docIdOrRoom || '').trim();
    let completed = 0;
    let completedToday = 0;
    let completedEarlier = 0;
    let seenToday = 0;
    let seenLater = 0;
    let waiting = 0;
    let inProgress = 0;
    let total = 0;

    // 1. Agar queueData.doctors ro'yxatida docObj topilsa
    const docObj = queueData.doctors ? queueData.doctors.find(d => (d.id === rKey || d.room === rKey)) : null;
    if (docObj) {
      seenToday = typeof docObj.seenTodayCount === 'number' ? docObj.seenTodayCount : (typeof docObj.completedCount === 'number' ? docObj.completedCount : 0);
      seenLater = typeof docObj.seenLaterCount === 'number' ? docObj.seenLaterCount : (typeof docObj.completedEarlierCount === 'number' ? docObj.completedEarlierCount : 0);
      completed = seenToday;
      completedToday = seenToday;
      completedEarlier = seenLater;
      waiting = typeof docObj.waitingCount === 'number' ? docObj.waitingCount : (docObj.patients ? docObj.patients.filter(p => p.statusCode !== 4).length : 0);
      inProgress = docObj.patients ? docObj.patients.filter(p => p.statusCode === 4).length : 0;
      total = typeof docObj.totalCount === 'number' ? docObj.totalCount : (completed + seenLater + waiting + inProgress);
    } else if (queueData.summary && queueData.summary.completedByDoctor && typeof queueData.summary.completedByDoctor[rKey] === 'number') {
      completed = queueData.summary.completedByDoctor[rKey];
      seenToday = completed;
      completedToday = (queueData.summary.completedTodayByDoctor && queueData.summary.completedTodayByDoctor[rKey]) || completed;
      completedEarlier = (queueData.summary.completedEarlierByDoctor && queueData.summary.completedEarlierByDoctor[rKey]) || 0;
      seenLater = completedEarlier;
      total = completed + waiting;
    }

    return { 
      completed, 
      completedToday, 
      completedEarlier, 
      seenToday,
      seenLater,
      waiting, 
      inProgress, 
      total: total || (completed + seenLater + waiting + inProgress)
    };
  }

  // Xonani tanlash uchun global qulay funksiya (Lenta chiplari bosilganda)
  window.uttSetSingleRoom = function(rKey) {
    if (rKey) {
      setViewMode('single-room', rKey);
    }
  };

  // Vrach ko'rgan bemorlarni ko'rish uchun kichik iframe modalini ochish
  let currentModalRoom = '';
  window.openDoctorCompletedModal = function(roomId, doctorName) {
    if (!doctorCompletedModal || !docCompletedIframe) return;
    currentModalRoom = roomId ? String(roomId).trim() : '';

    const staticInfo = ROOM_MAP[currentModalRoom] || {};
    const dName = doctorName || staticInfo.doctorName || currentModalRoom;

    if (dimhDoctorTitle) {
      dimhDoctorTitle.textContent = `${currentModalRoom} — ${dName}`;
    }

    const stats = getDoctorCompletedStats(currentModalRoom);
    if (dimhCompletedCountBadge) {
      dimhCompletedCountBadge.textContent = `${stats.completed} ta ko'rildi${stats.completedEarlier > 0 ? ` (${stats.completedEarlier} ta oldindan)` : ''}`;
    }

    const dateParam = selectedArchiveDate ? ('&date=' + encodeURIComponent(selectedArchiveDate)) : '';
    docCompletedIframe.src = `/doctor-completed.html?room=${encodeURIComponent(currentModalRoom)}${dateParam}`;
    doctorCompletedModal.style.display = 'flex';
  };

  window.closeDoctorCompletedModal = function() {
    if (!doctorCompletedModal) return;
    doctorCompletedModal.style.display = 'none';
    if (docCompletedIframe) docCompletedIframe.src = 'about:blank';
  };

  if (btnDimhClose) {
    btnDimhClose.addEventListener('click', window.closeDoctorCompletedModal);
  }
  if (btnDimhNewTab) {
    btnDimhNewTab.addEventListener('click', () => {
      if (currentModalRoom) {
        const dateParam = selectedArchiveDate ? ('&date=' + encodeURIComponent(selectedArchiveDate)) : '';
        window.open(`/doctor-completed.html?room=${encodeURIComponent(currentModalRoom)}${dateParam}`, '_blank');
      }
    });
  }
  if (doctorCompletedModal) {
    doctorCompletedModal.addEventListener('click', (e) => {
      if (e.target === doctorCompletedModal) {
        window.closeDoctorCompletedModal();
      }
    });
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && doctorCompletedModal && doctorCompletedModal.style.display !== 'none') {
      window.closeDoctorCompletedModal();
    }
  });

  // 3. HOLAT (STATE)
  let currentMode = 'tv'; // 'tv' | 'single-room' | 'post' | 'mobile'
  let currentRoomId = 'Ultratovush-10'; // Standart xona
  let singleRoomPage = 0;
  let singleRoomLastSwitchTime = Date.now();
  const SINGLE_ROOM_PAGE_INTERVAL = 45000; // 45 soniyalik sahifalar almashinuvi oralig'i
  let queueData = null;
  let selectedDoctorIds = new Set();
  let isSoundEnabled = true;
  let lastQueueHash = '';
  let sseSource = null;
  let activeCalls = {};
  let popupTimeout = null;

  // 4. O'ZBEKCHA SANA FORMATLASH (Masalan: Seshanba 8 Sentabr 2026)
  function getUzbekFullDate(date) {
    const days = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const months = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
    const dayName = days[date.getDay()];
    const dayNum = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName} ${dayNum} ${monthName} ${year}`;
  }

  // 5. TO'LIQ EKRAN (FULLSCREEN API)
  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
  }

  function toggleFullscreen() {
    if (!isFullscreen()) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(() => {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  function updateFullscreenUI() {
    const fsActive = isFullscreen();
    document.body.classList.toggle('is-fullscreen', fsActive);
    if (fsButtonText) {
      fsButtonText.textContent = fsActive ? "Chiqish (Esc)" : "To'liq ekran";
    }
    if (btnSrFullscreen) {
      btnSrFullscreen.textContent = fsActive ? "⛶ Chiqish" : "⛶ To'liq ekran";
    }
  }

  if (btnToggleFullscreen) {
    btnToggleFullscreen.addEventListener('click', toggleFullscreen);
  }
  if (btnSrFullscreen) {
    btnSrFullscreen.addEventListener('click', toggleFullscreen);
  }

  document.addEventListener('fullscreenchange', updateFullscreenUI);
  document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
  document.addEventListener('mozfullscreenchange', updateFullscreenUI);
  document.addEventListener('MSFullscreenChange', updateFullscreenUI);

  // 6. REJIMNI ALMASHTIRISH (TV, SINGLE-ROOM, EMPTY-ROOM, POST, MOBIL)
  function setViewMode(mode, targetRoomId) {
    currentMode = mode;
    if (targetRoomId) {
      currentRoomId = targetRoomId;
    }

    try {
      localStorage.setItem('utt_view_mode', mode);
      if (currentRoomId) localStorage.setItem('utt_selected_room', currentRoomId);
    } catch (e) {}

    try {
      if (window.AndroidTV && typeof window.AndroidTV.onModeChanged === 'function') {
        window.AndroidTV.onModeChanged(mode, currentRoomId || '');
      }
    } catch (e) {}

    body.className = `mode-${mode}`;

    if (btnModeTv) btnModeTv.classList.toggle('active', mode === 'tv');
    if (btnModeSingleRoom) btnModeSingleRoom.classList.toggle('active', mode === 'single-room');
    if (btnModeEmptyRoom) btnModeEmptyRoom.classList.toggle('active', mode === 'empty-room');
    if (btnModePost) btnModePost.classList.toggle('active', mode === 'post');
    if (btnModeMobile) btnModeMobile.classList.toggle('active', mode === 'mobile');

    if (roomSelectorWrap) {
      roomSelectorWrap.style.display = (mode === 'single-room' || mode === 'empty-room' || mode === 'tv') ? 'flex' : 'none';
    }

    if (mode === 'tv') {
      if (tvDoctorSummaryRibbon) tvDoctorSummaryRibbon.style.display = 'flex';
      if (earlierPatientsSection) earlierPatientsSection.style.display = 'block';
      if (selectedPillWrap) selectedPillWrap.style.display = 'none';
      if (singleRoomWrapper) singleRoomWrapper.style.display = 'none';
      if (tvQueueGrid) tvQueueGrid.style.display = 'grid';
      if (postTableContainer) postTableContainer.style.display = 'none';
      renderTvGrid();
      try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
    } else if (mode === 'single-room') {
      singleRoomPage = 0;
      singleRoomLastSwitchTime = Date.now();
      if (tvDoctorSummaryRibbon) tvDoctorSummaryRibbon.style.display = 'none';
      if (earlierPatientsSection) earlierPatientsSection.style.display = 'none';
      if (selectedPillWrap) selectedPillWrap.style.display = 'none';
      if (tvQueueGrid) tvQueueGrid.style.display = 'none';
      if (postTableContainer) postTableContainer.style.display = 'none';
      if (singleRoomWrapper) singleRoomWrapper.style.display = 'flex';
      if (srTableContainer) srTableContainer.style.display = 'block';
      if (srEmptyRoomBox) srEmptyRoomBox.style.display = 'none';
      if (btnSrToggleMode) btnSrToggleMode.textContent = '🚪 3-Rejim';
      renderSingleRoomView(currentRoomId);
      const cleanParam = currentRoomId.replace('Ultratovush-', '');
      try { history.replaceState(null, '', `?room=${encodeURIComponent(cleanParam)}`); } catch (e) {}
    } else if (mode === 'empty-room') {
      singleRoomPage = 0;
      singleRoomLastSwitchTime = Date.now();
      if (tvDoctorSummaryRibbon) tvDoctorSummaryRibbon.style.display = 'none';
      if (earlierPatientsSection) earlierPatientsSection.style.display = 'none';
      if (selectedPillWrap) selectedPillWrap.style.display = 'none';
      if (tvQueueGrid) tvQueueGrid.style.display = 'none';
      if (postTableContainer) postTableContainer.style.display = 'none';
      if (singleRoomWrapper) singleRoomWrapper.style.display = 'flex';
      if (srTableContainer) srTableContainer.style.display = 'none';
      if (srEmptyRoomBox) srEmptyRoomBox.style.display = 'flex';
      if (btnSrToggleMode) btnSrToggleMode.textContent = '📋 2-Rejim';
      renderSingleRoomView(currentRoomId);
      const cleanParam = currentRoomId.replace('Ultratovush-', '');
      try { history.replaceState(null, '', `?mode=empty&room=${encodeURIComponent(cleanParam)}`); } catch (e) {}
    } else if (mode === 'post') {
      if (tvDoctorSummaryRibbon) tvDoctorSummaryRibbon.style.display = 'none';
      if (earlierPatientsSection) earlierPatientsSection.style.display = 'none';
      if (selectedPillWrap) selectedPillWrap.style.display = 'flex';
      if (singleRoomWrapper) singleRoomWrapper.style.display = 'none';
      if (tvQueueGrid) tvQueueGrid.style.display = 'none';
      if (postTableContainer) postTableContainer.style.display = 'block';
      renderPostView();
      try { history.replaceState(null, '', '?mode=post'); } catch (e) {}
    } else if (mode === 'mobile') {
      if (tvDoctorSummaryRibbon) tvDoctorSummaryRibbon.style.display = 'none';
      if (earlierPatientsSection) earlierPatientsSection.style.display = 'none';
      if (selectedPillWrap) selectedPillWrap.style.display = 'none';
      if (singleRoomWrapper) singleRoomWrapper.style.display = 'none';
      if (tvQueueGrid) tvQueueGrid.style.display = 'grid';
      if (postTableContainer) postTableContainer.style.display = 'none';
      renderTvGrid();
      try { history.replaceState(null, '', '?mode=mobile'); } catch (e) {}
    }
  }

  if (btnModeTv) btnModeTv.addEventListener('click', () => setViewMode('tv'));
  if (btnModeSingleRoom) btnModeSingleRoom.addEventListener('click', () => setViewMode('single-room'));
  if (btnModeEmptyRoom) btnModeEmptyRoom.addEventListener('click', () => setViewMode('empty-room'));
  if (btnSrToggleMode) {
    btnSrToggleMode.addEventListener('click', () => {
      setViewMode(currentMode === 'empty-room' ? 'single-room' : 'empty-room');
    });
  }
  if (btnModePost) btnModePost.addEventListener('click', () => setViewMode('post'));
  if (btnModeMobile) btnModeMobile.addEventListener('click', () => setViewMode('mobile'));
  if (btnSrBackToAll) btnSrBackToAll.addEventListener('click', () => setViewMode('tv'));

  // 6.1 TV PULITI VA KLAVIATURA RAQAMLARI ORQALI XONAGA TEZKOR O'TISH (0-9)
  // Foydalanuvchi talabi: 0 -> UTT 10, 1 -> UTT 1, ..., 9 -> UTT 9
  const NUMBER_TO_ROOM = {
    1: 'Ultratovush-1',
    2: 'Ultratovush-2',
    3: 'Ultratovush-3',
    4: 'Ultratovush-4',
    5: 'Ultratovush-5',
    6: 'Ultratovush-6',
    7: 'Ultratovush-7',
    8: 'Ultratovush-8',
    9: 'Ultratovush-9',
    0: 'Ultratovush-10',
    10: 'Ultratovush-10'
  };

  window.uttSwitchRoomByNumber = function(num) {
    const targetRoom = NUMBER_TO_ROOM[num];
    if (!targetRoom) {
      setViewMode('tv');
      return;
    }

    // Agar allaqachon shu xona ochilgan bo'lsa -> umumiy TV ekranga toggle qilish!
    if ((currentMode === 'single-room' || currentMode === 'empty-room') && currentRoomId === targetRoom) {
      setViewMode('tv');
      return;
    }

    // Xonani ochish (agar 3-rejimda bo'lsa, 3-rejimda qoladi)
    const targetMode = currentMode === 'empty-room' ? 'empty-room' : 'single-room';
    setViewMode(targetMode, targetRoom);
  };

  window.uttBackToAllRooms = function() {
    if (currentMode === 'single-room' || currentMode === 'empty-room') {
      setViewMode('tv');
      return true;
    }
    return false;
  };

  // Klaviaturadan va TV pultidan 0-9 raqamlari bosilganda xonani ochish / qaytish
  window.addEventListener('keydown', function(e) {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
      return;
    }

    // 'M' yoki 'm' pult tugmasi orqali rejimlar aylanmasi (1-Rejim -> 2-Rejim -> 3-Rejim -> 1-Rejim)
    if (e.key === 'm' || e.key === 'M') {
      e.preventDefault();
      if (currentMode === 'tv') {
        setViewMode('single-room', currentRoomId || 'Ultratovush-8');
      } else if (currentMode === 'single-room') {
        setViewMode('empty-room', currentRoomId);
      } else {
        setViewMode('tv');
      }
      return;
    }

    // Escape yoki Backspace
    if (e.key === 'Escape' || e.keyCode === 27 || e.key === 'Backspace') {
      if (currentMode === 'single-room' || currentMode === 'empty-room') {
        e.preventDefault();
        setViewMode('tv');
        return;
      }
    }

    var digit = null;
    if (e.key >= '0' && e.key <= '9') {
      digit = parseInt(e.key, 10);
    } else if (e.keyCode >= 48 && e.keyCode <= 57) { // 0-9
      digit = e.keyCode - 48;
    } else if (e.keyCode >= 96 && e.keyCode <= 105) { // Numpad 0-9
      digit = e.keyCode - 96;
    }

    if (digit !== null) {
      e.preventDefault();
      window.uttSwitchRoomByNumber(digit);
    }
  }, true);

  // Xona tanlash dropdownlari (Server o'chiq bo'lsa ham ROOM_MAP dan to'ldiriladi)
  function populateRoomDropdowns() {
    var docList = [];
    if (queueData && queueData.doctors && queueData.doctors.length > 0) {
      docList = queueData.doctors;
    } else {
      docList = Object.keys(ROOM_MAP).map(function(k) {
        return {
          id: k,
          room: k,
          doctorName: ROOM_MAP[k].doctorName,
          shortName: ROOM_MAP[k].shortName,
          title: ROOM_MAP[k].title
        };
      });
    }

    // Header dropdown
    if (singleRoomSelect) {
      singleRoomSelect.innerHTML = '<option value="all">🖥️ Barcha xonalar</option>';
      docList.forEach(function(doc) {
        var id = doc.id || doc.room;
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${doc.room} — ${doc.shortName || (doc.doctorName ? doc.doctorName.split(' ')[0] : '')}`;
        singleRoomSelect.appendChild(opt);
      });
      if (currentMode === 'single-room' || currentMode === 'empty-room') {
        singleRoomSelect.value = currentRoomId;
      } else {
        singleRoomSelect.value = 'all';
      }
    }

    // Single Room ekranidagi dropdown
    if (srRoomDropdown) {
      srRoomDropdown.innerHTML = '';
      docList.forEach(function(doc) {
        var id = doc.id || doc.room;
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${doc.room} (${doc.shortName || (doc.doctorName ? doc.doctorName.split(' ')[0] : '')})`;
        srRoomDropdown.appendChild(opt);
      });
      srRoomDropdown.value = currentRoomId;
    }
  }

  if (singleRoomSelect) {
    singleRoomSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'all') {
        setViewMode('tv');
      } else {
        const targetMode = currentMode === 'empty-room' ? 'empty-room' : 'single-room';
        setViewMode(targetMode, val);
      }
    });
  }

  if (srRoomDropdown) {
    srRoomDropdown.addEventListener('change', (e) => {
      const targetMode = currentMode === 'empty-room' ? 'empty-room' : 'single-room';
      setViewMode(targetMode, e.target.value);
    });
  }

  // 6.2 SERVER VAQTINI SINXRONLASH (TV VA QURILMALARDA SANA TO'G'RI CHIQISHI UCHUN)
  // Eski Android TV'larda ichki soat noto'g'ri (yoki batareyasi o'tirgan) bo'lsa ham,
  // serverdan kelgan aniq sana va vaqtga avtomatik sinxronlanadi.
  let serverTimeOffset = 0; // ms: serverTime - clientLocalTime
  let serverDateString = ''; // Serverdan keluvchi aniq sana (masalan: "16.09.2026")
  let serverTimeSynched = false;

  function getServerNow() {
    return new Date(Date.now() + serverTimeOffset);
  }

  // 7. JONLI SOAT VA SANA
  function updateLiveClock() {
    const now = getServerNow();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const d = pad(now.getDate());
    const m = pad(now.getMonth() + 1);
    const y = now.getFullYear();
    const h = pad(now.getHours());
    const min = pad(now.getMinutes());
    const s = pad(now.getSeconds());

    // Agar serverdan aniq sana kelgan bo'lsa o'shani chiqaramiz
    const displayDate = serverDateString || `${d}.${m}.${y}`;

    // Header soati
    if (liveDate) liveDate.textContent = `📅 ${displayDate}`;
    if (liveTime) liveTime.textContent = `${h}:${min}:${s}`;

    // Single Room TV soati va sanasi
    if (srFullDateUz) srFullDateUz.textContent = getUzbekFullDate(now);
    if (srFullClockTime) srFullClockTime.textContent = `${h}:${min}:${s}`;

    // Xona ekrani sahifalarini 45 soniyalik interval bilan avtomatik almashtirish
    checkSingleRoomPageRotation();
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

  // Xona ekranida ko'p bemorlar bo'lsa, har 45 soniyada keyingi sahifaga o'tish
  function checkSingleRoomPageRotation() {
    if (currentMode !== 'single-room') return;
    if (!queueData || !queueData.doctors) return;

    let targetDoc = queueData.doctors.find(d => (d.id === currentRoomId || d.room === currentRoomId));
    if (!targetDoc) {
      targetDoc = queueData.doctors.find(d => 
        d.room.toLowerCase().includes(String(currentRoomId).toLowerCase()) ||
        String(d.num) === String(currentRoomId)
      );
    }
    const patients = (targetDoc && targetDoc.patients) ? targetDoc.patients : [];
    const waitingPatients = patients.filter(p => {
      const isAccepted = p.statusCode === 4 || (p.status && p.status.toLowerCase().includes('kabul'));
      const isDone = p.statusCode === 2 || p.isCompleted || (p.status && (p.status.toLowerCase().includes('onay') || p.status.toLowerCase().includes('tamam')));
      return !isAccepted && !isDone;
    });
    const PAGE_LIMIT = 7;
    const totalPages = Math.ceil(waitingPatients.length / PAGE_LIMIT);

    if (totalPages <= 1) {
      if (singleRoomPage !== 0) {
        singleRoomPage = 0;
        renderSingleRoomView(currentRoomId);
      }
      return;
    }

    const now = Date.now();
    if (now - singleRoomLastSwitchTime >= SINGLE_ROOM_PAGE_INTERVAL) {
      singleRoomLastSwitchTime = now;
      singleRoomPage = (singleRoomPage + 1) % totalPages;
      renderSingleRoomView(currentRoomId);
    }
  }

  // 8. OVOZLI BILDIRISHNOMA (25 XIL CHIME ENGINE)
  function playNotificationChime(soundId) {
    if (!isSoundEnabled) return;
    try {
      if (window.ChimeEngine && typeof window.ChimeEngine.play === 'function') {
        window.ChimeEngine.play(soundId || 1);
        return;
      }
      // Fallback
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    } catch (e) {}
  }

  // TV Katta Chaqiruv Popupi ko'rsatish (Faqat 1 MAROTABA aniq chaqiruv signali)
  let lastHandledCallKey = '';
  let lastHandledCallTime = 0;

  function showTvCallPopup(call) {
    if (!call) return;

    // Chaqiruvni aniq identifikatsiya qilish (Xona + Navbat raqami yoki Bemor ID)
    const callKey = (call.callId || '') + '_' + (call.roomKey || call.room || '') + '_' + (call.queueNo || call.patientId || '') + '_' + (call.calledAt || '');
    const now = Date.now();

    // Agar ayni shu chaqiruv oxirgi 15 soniya ichida chaqirilgan bo'lsa, qayta signal bermaymiz (aniq 1 marta chiqishi kafolatlanadi)
    if (callKey === lastHandledCallKey && (now - lastHandledCallTime < 15000)) {
      return;
    }
    lastHandledCallKey = callKey;
    lastHandledCallTime = now;

    const overlay = document.getElementById('tvCallPopupOverlay');
    if (!overlay) return;

    const qNum = document.getElementById('tcpQueueNum');
    const pName = document.getElementById('tcpPatientName');
    const rTarget = document.getElementById('tcpRoomTarget');

    if (qNum) qNum.textContent = `№ ${call.queueNo || '-'}`;
    if (pName) pName.textContent = (call.fullName || 'Bemor').toUpperCase();
    if (rTarget) {
      const roomStr = call.roomTitle || call.roomKey || 'Xonaga';
      const docStr = call.doctorName ? ` (${call.doctorName})` : '';
      rTarget.textContent = `${roomStr}${docStr}`;
    }

    overlay.style.display = 'flex';

    // Faqat 1 marta ovozli signal berish
    playNotificationChime(call.soundId || 1);

    if (popupTimeout) clearTimeout(popupTimeout);
    popupTimeout = setTimeout(() => {
      overlay.style.display = 'none';
    }, 12000); // 12 soniya ekranda ko'rinadi
  }

  const tvOverlayElem = document.getElementById('tvCallPopupOverlay');
  if (tvOverlayElem) {
    tvOverlayElem.addEventListener('click', () => {
      tvOverlayElem.style.display = 'none';
      if (popupTimeout) clearTimeout(popupTimeout);
    });
  }

  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      isSoundEnabled = !isSoundEnabled;
      soundStatusText.textContent = isSoundEnabled ? 'Yoqilgan' : "O'chirilgan";
      soundToggleBtn.style.opacity = isSoundEnabled ? '1' : '0.6';
      if (isSoundEnabled) playNotificationChime();
    });
  }

  // Helper: Universal HTTP GET using standard XMLHttpRequest (Works on 100% of TV browsers)
  function universalGet(url, onSuccess, onError) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = 10000;
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            var data = JSON.parse(xhr.responseText);
            if (onSuccess) onSuccess(data);
          } catch (pe) {
            if (window.reportTvTelemetry) {
              window.reportTvTelemetry('TV_JSON_PARSE_ERROR', { url: url, text: xhr.responseText.substring(0, 100) }, 500);
            }
            if (onError) onError(pe);
          }
        } else {
          if (onError) onError(new Error('HTTP status ' + xhr.status));
        }
      };
      xhr.onerror = function(err) {
        if (onError) onError(err || new Error('Network error'));
      };
      xhr.ontimeout = function() {
        if (onError) onError(new Error('Timeout'));
      };
      xhr.send();
    } catch (e) {
      if (onError) onError(e);
    }
  }

  // 9. SERVER STATUSI VA IP MANZILLARINI OLISH (Universal XHR)
  function fetchServerStatus() {
    universalGet('/status', function(data) {
      if (data && data.localIps && data.localIps.length > 0) {
        var mainIp = data.localIps[0].address;
        if (localIpBanner) {
          localIpBanner.textContent = 'http://' + mainIp + ':' + (data.port || 9876);
        }
      }
    });
  }
  fetchServerStatus();

  // 10. REAL-TIME NAVBAT QABUL QILISH (SSE VA DOIMIY POLLING - v6.0.0)
  function initRealtimeEvents() {
    // 1. Zudlik bilan va har 3 soniyada ishonchli polling (tarmoq uzilishlariga qaramay ekranni yangilab turadi)
    pollQueueData();
    setInterval(pollQueueData, 3000);

    // 2. Server-Sent Events (SSE) tezkor chaqiruv signallari uchun
    if (typeof window !== 'undefined' && window.EventSource) {
      try {
        if (sseSource) sseSource.close();
        sseSource = new EventSource('/api/events');

        sseSource.onopen = function () {
          if (liveConnChip) {
            liveConnChip.className = 'live-connection-chip connected';
            liveConnText.textContent = 'Jonli Aloqa (v8.0)';
          }
        };

        sseSource.onmessage = function (e) {
          try {
            var data = JSON.parse(e.data);
            if (data.type === 'CALL_UPDATE') {
              if (data.action === 'calling' && data.call) {
                var rKey = data.call.roomKey || data.call.room;
                if (rKey) activeCalls[rKey] = data.call;
                showTvCallPopup(data.call);
              } else if (data.action === 'finished' && data.roomKey) {
                delete activeCalls[data.roomKey];
              }
              if (data.activeCalls) {
                activeCalls = data.activeCalls;
              }
              if (!selectedArchiveDate) {
                if (currentMode === 'single-room' || currentMode === 'empty-room') renderSingleRoomView(currentRoomId);
                else if (currentMode === 'tv' || currentMode === 'mobile') renderTvGrid();
                else if (currentMode === 'post') renderPostView();
              }
              return;
            }
            cachedLiveQueueData = data;
            if (selectedArchiveDate) {
              return;
            }
            handleNewQueueData(data);
          } catch (err) {}
        };

        sseSource.onerror = function () {
          // SSE uzilsa ham polling ishlab turadi
          if (liveConnChip && !selectedArchiveDate) {
            liveConnChip.className = 'live-connection-chip connected';
            liveConnText.textContent = 'Jonli Aloqa (Auto)';
          }
        };
      } catch (e) {}
    }
  }

  var consecutivePollErrors = 0;
  function pollQueueData() {
    universalGet('/api/queue-live?t=' + Date.now(), function(data) {
      consecutivePollErrors = 0;
      cachedLiveQueueData = data;
      if (selectedArchiveDate) {
        return;
      }
      handleNewQueueData(data);
      if (liveConnChip) {
        liveConnChip.className = 'live-connection-chip connected';
        liveConnText.textContent = 'Jonli Aloqa (v8.0)';
      }
    }, function(err) {
      consecutivePollErrors++;
      if (!selectedArchiveDate && liveConnChip) {
        liveConnChip.className = 'live-connection-chip disconnected';
        liveConnText.textContent = 'Aloqa qidirilmoqda...';
      }
      if (consecutivePollErrors === 3 && window.reportTvTelemetry) {
        window.reportTvTelemetry('TV_API_POLL_ERROR', { error: String(err && err.message ? err.message : err), consecutiveFails: consecutivePollErrors }, 500);
      }
    });
  }

  // 10.1 SANA BO'YICHA ARXIV VA YAKUNIY KO'RSATKICHLARNI YUKLASH
  function initDateFilterControls() {
    if (statsDateInput) {
      var todayYmd = getTodayYmd();
      statsDateInput.value = todayYmd;
      statsDateInput.max = todayYmd;

      statsDateInput.addEventListener('change', function() {
        var chosenVal = statsDateInput.value;
        if (!chosenVal || chosenVal === getTodayYmd()) {
          switchToLiveToday();
        } else {
          loadDataForDate(chosenVal);
        }
      });
    }

    if (btnTodayReset) {
      btnTodayReset.addEventListener('click', switchToLiveToday);
    }
    if (btnReturnToday) {
      btnReturnToday.addEventListener('click', switchToLiveToday);
    }
  }

  function loadDataForDate(dateStr) {
    if (!dateStr) return;
    selectedArchiveDate = dateStr;

    var normDate = dateStr;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      var parts = dateStr.split('-');
      normDate = parts[2] + '.' + parts[1] + '.' + parts[0];
    }

    if (archiveStatusBanner) archiveStatusBanner.style.display = 'block';
    if (archiveDateDisplay) archiveDateDisplay.textContent = normDate;
    if (btnTodayReset) btnTodayReset.style.display = 'inline-block';
    if (liveConnChip) {
      liveConnChip.className = 'live-connection-chip connected';
      liveConnText.textContent = 'Arxiv (' + normDate + ')';
    }

    universalGet('/api/queue-live?date=' + encodeURIComponent(dateStr) + '&t=' + Date.now(), function(resp) {
      if (resp) {
        handleNewQueueData(resp);
      }
    }, function(err) {
      console.error('Arxiv yuklashda xato:', err);
    });
  }

  function switchToLiveToday() {
    selectedArchiveDate = null;
    var todayYmd = getTodayYmd();
    if (statsDateInput) statsDateInput.value = todayYmd;
    if (archiveStatusBanner) archiveStatusBanner.style.display = 'none';
    if (btnTodayReset) btnTodayReset.style.display = 'none';
    if (lblTodayReg) lblTodayReg.textContent = "Bugun ro'yxatga olingan:";
    if (lblTodayCompleted) lblTodayCompleted.textContent = "Bugun ko'rildi:";

    if (liveConnChip) {
      liveConnChip.className = 'live-connection-chip connected';
      liveConnText.textContent = 'Jonli Aloqa (v8.0)';
    }

    if (cachedLiveQueueData) {
      handleNewQueueData(cachedLiveQueueData);
    }
    pollQueueData();
  }

  function handleNewQueueData(data) {
    if (!data) return;
    queueData = data;

    // Server vaqtini sinxronlash
    if (data.date) {
      serverDateString = String(data.date).trim();
    }
    if (data.timestamp) {
      var sTime = new Date(data.timestamp).getTime();
      if (!isNaN(sTime)) {
        serverTimeOffset = sTime - Date.now();
        if (!serverTimeSynched) {
          serverTimeSynched = true;
          updateLiveClock();
          if (window.reportTvTelemetry) {
            var driftSec = Math.round(serverTimeOffset / 1000);
            window.reportTvTelemetry('TV_TIME_SYNC', {
              serverDate: serverDateString,
              clientLocalIso: new Date().toISOString(),
              driftSeconds: driftSec,
              note: Math.abs(driftSec) > 30 ? 'TV ichki soati noto\'g\'ri, serverdan to\'g\'rilandi' : 'Soat to\'g\'ri'
            }, 200);
          }
        }
      }
    }

    if (data.activeCalls) {
      activeCalls = data.activeCalls;
    }

    const hash = JSON.stringify(data.summary || {}) + (data.totalPatients || 0);
    if (hash !== lastQueueHash) {
      lastQueueHash = hash;
    }

    populateRoomDropdowns();
    updateStatsBar();
    updateDoctorFilterChips();

    if (currentMode === 'single-room' || currentMode === 'empty-room') {
      renderSingleRoomView(currentRoomId);
    } else if (currentMode === 'post') {
      renderPostView();
    } else {
      renderTvGrid();
    }
  }

  // 11. STATISTIKA PANELINI YANGILASH
  function updateStatsBar() {
    if (!queueData) return;
    const summary = queueData.summary || {};

    if (selectedArchiveDate) {
      var dDisplay = selectedArchiveDate;
      var dFullYear = '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(selectedArchiveDate)) {
        var dp = selectedArchiveDate.split('-');
        dDisplay = dp[2] + '.' + dp[1];
        dFullYear = dp[2] + '.' + dp[1] + '.' + dp[0];
      } else {
        dFullYear = selectedArchiveDate;
      }
      if (lblTodayReg) lblTodayReg.textContent = dDisplay + " da ro'yxatga olingan:";
      if (lblTodayCompleted) lblTodayCompleted.textContent = dDisplay + " da ko'rildi:";

      // Arxiv bannerini Karmed jonli ko'rsatkichlari bilan boyitish
      if (archiveStatusBanner) {
        var sToday = summary.seenTodayTotal !== undefined ? summary.seenTodayTotal : (summary.totalCompleted || 0);
        var sLater = summary.seenLaterTotal !== undefined ? summary.seenLaterTotal : 0;
        var sWait = summary.waitingTotal !== undefined ? summary.waitingTotal : (summary.totalWaiting || 0);
        var sTotal = summary.totalPatients || (sToday + sLater + sWait);

        archiveStatusBanner.innerHTML = `
          <div class="archive-banner-content" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; width:100%;">
            <div class="archive-banner-left" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <span class="archive-banner-icon">⚡</span>
              <span>KARMED JONLI: <b>${dFullYear}</b> da yo'naltirilgan bemorlar:</span>
              <span style="display:inline-flex; gap:6px; font-weight:800;">
                <span style="color:#4ade80; background:rgba(34,197,94,0.15); padding:2px 6px; border-radius:4px; border:1px solid rgba(34,197,94,0.3);" title="Shu kuni ko'rilgan">[Shu kuni: ${sToday}]</span>
                <span style="color:#38bdf8; background:rgba(56,189,248,0.15); padding:2px 6px; border-radius:4px; border:1px solid rgba(56,189,248,0.3);" title="Keyingi boshqa kunda ko'rilgan">[Keyingi kunda: ${sLater}]</span>
                <span style="color:#fbbf24; background:rgba(245,158,11,0.15); padding:2px 6px; border-radius:4px; border:1px solid rgba(245,158,11,0.3);" title="Hali ko'rikdan o'tmagan (kutmoqda)">[Hali o'tmagan: ${sWait}]</span>
                <span style="color:#c084fc; background:rgba(168,85,247,0.15); padding:2px 6px; border-radius:4px; border:1px solid rgba(168,85,247,0.3);" title="Jami yo'naltirilgan">[Jami: ${sTotal}]</span>
              </span>
            </div>
            <button type="button" id="btnReturnTodayDyn" class="btn-return-today">↩ Bugungi jonli navbatga qaytish</button>
          </div>
        `;
        const bDyn = document.getElementById('btnReturnTodayDyn');
        if (bDyn) bDyn.addEventListener('click', switchToLiveToday);
      }
    } else {
      if (lblTodayReg) lblTodayReg.textContent = "Bugun ro'yxatga olingan:";
      if (lblTodayCompleted) lblTodayCompleted.textContent = "Bugun ko'rildi:";
    }
    
    // Navbatdagi / Hali tekshiruvdan o'tmagan bemorlar soni
    const waiting = typeof summary.waitingTotal === 'number'
      ? summary.waitingTotal
      : (typeof summary.totalWaiting === 'number' 
        ? summary.totalWaiting 
        : (queueData.totalPatients || (queueData.allPatients ? queueData.allPatients.length : 0)));
    if (totalPatientsCount) totalPatientsCount.textContent = waiting;

    // Bugun / Shu kuni ro'yxatga olinganlar
    let todayReg = 0;
    if (typeof summary.totalPatients === 'number') {
      todayReg = summary.totalPatients;
    } else if (typeof summary.totalTodayRegistered === 'number') {
      todayReg = summary.totalTodayRegistered;
    } else if (Array.isArray(queueData.allPatients)) {
      todayReg = queueData.allPatients.filter(p => p.isRegToday).length;
    } else {
      todayReg = waiting;
    }

    let earlierReg = typeof summary.seenLaterTotal === 'number' 
      ? summary.seenLaterTotal 
      : (typeof summary.totalEarlierRegistered === 'number' ? summary.totalEarlierRegistered : 0);
    if (todayRegPatientsCount) todayRegPatientsCount.textContent = todayReg;
    if (earlierRegPatientsCount) {
      earlierRegPatientsCount.textContent = earlierReg > 0 ? (selectedArchiveDate ? `(${earlierReg} keyin)` : `(+${earlierReg} oldin)`) : '';
      earlierRegPatientsCount.style.display = earlierReg > 0 ? 'inline-block' : 'none';
    }

    // Faol qabuldagi shifokorlar
    const activeDocs = queueData.doctors ? queueData.doctors.filter(d => (d.patients && d.patients.length > 0 || (d.completedCount && d.completedCount > 0) || (d.seenTodayCount && d.seenTodayCount > 0))).length : 0;
    if (activeDoctorsCount) activeDoctorsCount.textContent = activeDocs;

    // Faqat tasdiqlangan sanasi shu kuni bo'lgan ko'riklar
    const totalComp = typeof summary.seenTodayTotal === 'number' 
      ? summary.seenTodayTotal 
      : (typeof summary.totalCompleted === 'number' ? summary.totalCompleted : 0);
    const earlierComp = typeof summary.seenLaterTotal === 'number'
      ? summary.seenLaterTotal
      : (typeof summary.totalCompletedEarlier === 'number' ? summary.totalCompletedEarlier : 0);
    if (totalCompletedCount) totalCompletedCount.textContent = totalComp;
    if (completedEarlierSubText) {
      completedEarlierSubText.textContent = earlierComp > 0 ? (selectedArchiveDate ? `(${earlierComp} keyin)` : `(${earlierComp} oldin)`) : '';
      completedEarlierSubText.style.display = earlierComp > 0 ? 'inline-block' : 'none';
    }

    if (selectedDoctorIds.size > 0) {
      let count = 0;
      if (queueData.doctors) {
        queueData.doctors.forEach(d => {
          if (selectedDoctorIds.has(d.id || d.room)) {
            count += (d.patients ? d.patients.length : 0);
          }
        });
      }
      if (selectedPatientsCount) selectedPatientsCount.textContent = count;
    } else {
      if (selectedPatientsCount) selectedPatientsCount.textContent = waiting;
    }

    // Kecha va oldingi kunlarda yo'naltirilib bugun o'tganlar jadvalini yangilash
    updateEarlierPatientsPanel();
  }

  // 11.2 KECHA VA OLDINGI KUNLARDA YO'NALTIRILIB BUGUN O'TGAN/QABUL QILINGANLAR JADVALI VA FILTRLASH
  let earlierSearchQuery = '';
  let earlierDoctorFilter = 'all';
  let earlierStatusFilter = 'all';

  function populateEarlierDoctorDropdown(list) {
    if (!eppDoctorSelect) return;
    const currentVal = eppDoctorSelect.value || 'all';
    const doctorsMap = new Map();

    list.forEach(p => {
      const dName = p.doctorName || p.room;
      if (dName && !doctorsMap.has(dName)) {
        doctorsMap.set(dName, p.room ? `${p.room} — ${dName}` : dName);
      }
    });

    let optionsHtml = '<option value="all">👨‍⚕️ Barcha vrachlar</option>';
    doctorsMap.forEach((label, key) => {
      optionsHtml += `<option value="${escapeHtml(key)}">${escapeHtml(label)}</option>`;
    });

    eppDoctorSelect.innerHTML = optionsHtml;
    if (doctorsMap.has(currentVal) || currentVal === 'all') {
      eppDoctorSelect.value = currentVal;
    } else {
      eppDoctorSelect.value = 'all';
      earlierDoctorFilter = 'all';
    }
  }

  function renderFilteredEarlierPatients() {
    if (!earlierPatientsSection) return;
    if (currentMode === 'single-room') {
      earlierPatientsSection.style.display = 'none';
      return;
    }
    if (!queueData) return;
    const summary = queueData.summary || {};
    const fullList = summary.earlierPatientsList || [];

    if (earlierPatientsCountBadge) {
      earlierPatientsCountBadge.textContent = `${fullList.length} ta`;
    }

    if (!earlierPatientsTableBody) return;

    // Filtrlash
    const filtered = fullList.filter(p => {
      // 1. Qidiruv
      if (earlierSearchQuery) {
        const q = earlierSearchQuery.toLowerCase();
        const pid = (p.patientId || '').toLowerCase();
        const fn = (p.fullName || '').toLowerCase();
        const rd = (p.referringDoctor || '').toLowerCase();
        const dn = (p.doctorName || '').toLowerCase();
        const rm = (p.room || '').toLowerCase();
        if (!pid.includes(q) && !fn.includes(q) && !rd.includes(q) && !dn.includes(q) && !rm.includes(q)) {
          return false;
        }
      }

      // 2. Vrach bo'yicha filtr
      if (earlierDoctorFilter !== 'all') {
        const pDoc = p.doctorName || p.room || '';
        if (pDoc !== earlierDoctorFilter && p.room !== earlierDoctorFilter) {
          return false;
        }
      }

      // 3. Holat bo'yicha filtr
      if (earlierStatusFilter !== 'all') {
        const isDone = p.isConfirmedToday || p.statusCode === 8;
        const isAccepted = p.statusCode === 4;
        const isWaiting = !isDone && !isAccepted;

        if (earlierStatusFilter === 'completed' && !isDone) return false;
        if (earlierStatusFilter === 'accepted' && !isAccepted) return false;
        if (earlierStatusFilter === 'waiting' && !isWaiting) return false;
      }

      return true;
    });

    if (eppFilteredCountBadge) {
      if (earlierSearchQuery || earlierDoctorFilter !== 'all' || earlierStatusFilter !== 'all') {
        eppFilteredCountBadge.textContent = `${filtered.length} ta / jami ${fullList.length} ta`;
        eppFilteredCountBadge.style.color = '#38bdf8';
      } else {
        eppFilteredCountBadge.textContent = `${fullList.length} ta`;
        eppFilteredCountBadge.style.color = '#94a3b8';
      }
    }

    if (filtered.length === 0) {
      earlierPatientsTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 25px; color: #94a3b8;">
            ${fullList.length === 0 ? "Oldingi kunlarda yo'naltirilib bugun kelgan bemorlar mavjud emas." : "Qidiruv yoki filtr bo'yicha hech qanday bemor topilmadi."}
          </td>
        </tr>
      `;
      return;
    }

    earlierPatientsTableBody.innerHTML = filtered.map(p => {
      let rowClass = 'epp-row-waiting';
      let tagClass = 'tag-waiting';
      if (p.isConfirmedToday || p.statusCode === 8) {
        rowClass = 'epp-row-completed';
        tagClass = 'tag-done';
      } else if (p.statusCode === 4) {
        rowClass = 'epp-row-accepted';
        tagClass = 'tag-accepted';
      }

      return `
        <tr class="${rowClass}">
          <td><b>${escapeHtml(p.referringDoctor || '-')}</b></td>
          <td><b style="color: #38bdf8;">${escapeHtml(p.patientId || '-')}</b></td>
          <td>${escapeHtml(p.doctorName || '-')}</td>
          <td><b>${escapeHtml(p.fullName || '-')}</b></td>
          <td><span class="room-badge">${escapeHtml(p.room || '-')}</span></td>
          <td>📅 ${escapeHtml(p.registrationDate || '-')} ${escapeHtml(p.registrationTime || '')}</td>
          <td>${p.confirmationDate ? `✅ ${escapeHtml(p.confirmationDate)} ${escapeHtml(p.confirmationTime || '')}` : '—'}</td>
          <td><span class="epp-tag-pill ${tagClass}">${escapeHtml(p.dateTag || (p.isConfirmedToday ? "Bugun tekshiruvdan o'tgan" : "Navbatda"))}</span></td>
        </tr>
      `;
    }).join('');
  }

  function updateEarlierPatientsPanel() {
    if (!earlierPatientsSection) return;
    if (currentMode === 'single-room') {
      earlierPatientsSection.style.display = 'none';
      return;
    }
    if (!queueData) return;
    const summary = queueData.summary || {};
    const fullList = summary.earlierPatientsList || [];

    populateEarlierDoctorDropdown(fullList);
    renderFilteredEarlierPatients();
  }

  // Filtr va qidiruv tinglovchilari
  if (eppSearchInput) {
    eppSearchInput.addEventListener('input', (e) => {
      earlierSearchQuery = e.target.value.trim();
      if (btnEppClearSearch) {
        btnEppClearSearch.style.display = earlierSearchQuery ? 'block' : 'none';
      }
      renderFilteredEarlierPatients();
    });
  }
  if (btnEppClearSearch) {
    btnEppClearSearch.addEventListener('click', () => {
      if (eppSearchInput) eppSearchInput.value = '';
      earlierSearchQuery = '';
      btnEppClearSearch.style.display = 'none';
      renderFilteredEarlierPatients();
    });
  }
  if (eppDoctorSelect) {
    eppDoctorSelect.addEventListener('change', (e) => {
      earlierDoctorFilter = e.target.value;
      renderFilteredEarlierPatients();
    });
  }
  if (eppStatusSelect) {
    eppStatusSelect.addEventListener('change', (e) => {
      earlierStatusFilter = e.target.value;
      renderFilteredEarlierPatients();
    });
  }
  if (btnEppResetAll) {
    btnEppResetAll.addEventListener('click', () => {
      if (eppSearchInput) eppSearchInput.value = '';
      earlierSearchQuery = '';
      if (btnEppClearSearch) btnEppClearSearch.style.display = 'none';
      if (eppDoctorSelect) eppDoctorSelect.value = 'all';
      earlierDoctorFilter = 'all';
      if (eppStatusSelect) eppStatusSelect.value = 'all';
      earlierStatusFilter = 'all';
      renderFilteredEarlierPatients();
    });
  }

  // Oldingi kunlar panelini ochish/yopish tugmasi hodisasi
  if (btnToggleEarlierPanel) {
    btnToggleEarlierPanel.addEventListener('click', () => {
      if (!earlierPatientsBody) return;
      const isHidden = earlierPatientsBody.style.display === 'none';
      earlierPatientsBody.style.display = isHidden ? 'block' : 'none';
      if (eppToggleText) {
        eppToggleText.textContent = isHidden ? '▲ Yopish' : '▼ Ko\'rish';
      }
    });
  }

  // 12. POST REJIMIDAGI VRACHLAR CHIPLARI
  function updateDoctorFilterChips() {
    if (!doctorFilterChips || !queueData || !queueData.doctors) return;

    doctorFilterChips.innerHTML = '';
    queueData.doctors.forEach(doc => {
      const docId = doc.id || doc.room;
      const count = doc.patients ? doc.patients.length : 0;
      const isSelected = selectedDoctorIds.has(docId);

      const chip = document.createElement('div');
      chip.className = `doc-chip ${isSelected ? 'selected' : ''}`;
      chip.innerHTML = `
        <span>${escapeHtml(doc.room.replace('Ultratovush-', 'U-'))} (${escapeHtml(doc.shortName || doc.doctorName.split(' ')[0])})</span>
        <span class="doc-chip-count">${count}</span>
      `;

      chip.addEventListener('click', () => {
        if (selectedDoctorIds.has(docId)) {
          selectedDoctorIds.delete(docId);
        } else {
          selectedDoctorIds.add(docId);
        }
        updateStatsBar();
        updateDoctorFilterChips();
        renderPostView();
      });

      doctorFilterChips.appendChild(chip);
    });
  }

  if (btnSelectAllDocs) {
    btnSelectAllDocs.addEventListener('click', () => {
      if (!queueData || !queueData.doctors) return;
      queueData.doctors.forEach(d => selectedDoctorIds.add(d.id || d.room));
      updateStatsBar();
      updateDoctorFilterChips();
      renderPostView();
    });
  }

  if (btnClearAllDocs) {
    btnClearAllDocs.addEventListener('click', () => {
      selectedDoctorIds.clear();
      updateStatsBar();
      updateDoctorFilterChips();
      renderPostView();
    });
  }

  if (patientSearchInput) {
    patientSearchInput.addEventListener('input', () => {
      if (currentMode === 'post') renderPostView();
      else if (currentMode === 'tv' || currentMode === 'mobile') renderTvGrid();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      patientSearchInput.value = '';
      if (currentMode === 'post') renderPostView();
      else renderTvGrid();
    });
  }

  // 13. BARCHA XONALAR TV GRIDINI CHIZISH (SCREENSHOT 1)
  function renderTvGrid() {
    if (!tvQueueGrid) return;
    if (!queueData || !queueData.doctors || queueData.doctors.length === 0) {
      tvQueueGrid.innerHTML = `
        <div class="empty-doc-queue" style="grid-column: 1/-1; padding: 50px;">
          Hozircha navbatda kutayotgan bemorlar ro'yxati mavjud emas.
        </div>
      `;
      return;
    }

    const searchQuery = (patientSearchInput && patientSearchInput.value || '').toLowerCase().trim();
    let html = '';

    queueData.doctors.forEach(doc => {
      const docId = doc.id || doc.room;
      let patients = doc.patients || [];

      if (searchQuery) {
        patients = patients.filter(p => 
          (p.patientId && p.patientId.toLowerCase().includes(searchQuery)) ||
          (p.fullName && p.fullName.toLowerCase().includes(searchQuery))
        );
      }

      const activeCall = activeCalls[doc.room] || activeCalls[docId];

      // Qabuldagi va kutayotgan bemorlarni ajratish (v6.0.0)
      const waitingPatients = patients.filter(p => {
        if (p.statusCode === 4) return false;
        if (activeCall && String(p.patientId || '').trim() === String(activeCall.patientId || '').trim()) return false;
        return true;
      });

      const hasWaiting = waitingPatients.length > 0;
      const curPatient = hasWaiting ? waitingPatients[0] : null;
      const waitingList = hasWaiting ? waitingPatients.slice(1) : [];

      const stats = getDoctorCompletedStats(docId);
      const seenTodayCount = typeof doc.seenTodayCount === 'number' ? doc.seenTodayCount : (typeof doc.completedCount === 'number' ? doc.completedCount : stats.seenToday);
      const seenLaterCount = typeof doc.seenLaterCount === 'number' ? doc.seenLaterCount : (stats.seenLater || 0);
      const waitingCount = typeof doc.waitingCount === 'number' ? doc.waitingCount : waitingPatients.length;
      const totalDocCount = typeof doc.totalCount === 'number' ? doc.totalCount : (stats.total || (seenTodayCount + seenLaterCount + waitingCount));
      const completedCount = seenTodayCount;
      const progressPercent = totalDocCount > 0 ? Math.round((completedCount / totalDocCount) * 100) : 0;

      html += `
        <div class="doctor-queue-card ${(hasWaiting || activeCall) ? 'has-active' : ''} ${activeCall ? (activeCall.status === 'accepted' ? 'card-accepted' : 'card-calling') : ''}" data-room-id="${escapeHtml(docId)}" title="Batafsil xona ekraniga o'tish uchun bosing">
          <div class="doc-card-header">
            <div class="doc-room-title">
              <span class="room-badge">${escapeHtml(doc.room.replace('Ultratovush-', 'U-'))}</span>
              <span class="doc-name" title="${escapeHtml(doc.doctorName)}">${escapeHtml(doc.doctorName)}</span>
            </div>
            <div class="doc-header-badges">
              <button type="button" class="btn-doc-eye" onclick="event.stopPropagation(); window.openDoctorCompletedModal('${escapeHtml(docId)}', '${escapeHtml(doc.doctorName)}')" title="Vrach ko'rgan bemorlarni ko'rish (${completedCount} ta ko'rilgan)">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
              <span class="doc-queue-badge ${(waitingCount > 0 || activeCall || completedCount > 0 || seenLaterCount > 0) ? '' : 'empty'}" title="Shu kuni: ${seenTodayCount} | Keyingi kunda: ${seenLaterCount} | Hali o'tmagan: ${waitingCount} | Jami: ${totalDocCount}">
                <span style="color: #4ade80;" title="Shu kuni ko'rilgan">${seenTodayCount}</span>
                <span style="opacity: 0.5; margin: 0 2px;">/</span>
                <span style="color: #38bdf8;" title="Keyingi kunda ko'rilgan">${seenLaterCount}</span>
                <span style="opacity: 0.5; margin: 0 2px;">/</span>
                <span style="color: #fbbf24;" title="Hali o'tmagan">${waitingCount}</span>
                <span style="opacity: 0.5; margin: 0 2px;">/</span>
                <span style="color: #c084fc;" title="Jami bemorlar">${totalDocCount}</span>
              </span>
            </div>
          </div>

          <!-- 4 TA ALOHIDA KO'RSATKICH: [Shu kuni] [Keyingi kunda] [Hali o'tmagan] [Jami] -->
          <div class="doc-four-metrics-bar">
            <div class="dfm-item dfm-today" title="Shu kuni ko'rilgan bemorlar soni">
              <span class="dfm-num">${seenTodayCount}</span>
              <span class="dfm-label">Shu kuni</span>
            </div>
            <div class="dfm-item dfm-later" title="Shu kuni yo'naltirilgan ammo keyingi boshqa kunda ko'rilgan bemorlar soni">
              <span class="dfm-num">${seenLaterCount}</span>
              <span class="dfm-label">Keyingi kunda</span>
            </div>
            <div class="dfm-item dfm-waiting" title="Shu kuni yo'naltirilgan ammo hali tekshiruvdan o'tmagan bemorlar soni">
              <span class="dfm-num">${waitingCount}</span>
              <span class="dfm-label">Hali o'tmagan</span>
            </div>
            <div class="dfm-item dfm-total" title="Jami yo'naltirilgan bemorlar soni">
              <span class="dfm-num">${totalDocCount}</span>
              <span class="dfm-label">Jami</span>
            </div>
          </div>

          ${activeCall ? `
            <div class="doc-card-calling-banner ${activeCall.status === 'accepted' ? 'banner-accepted' : 'banner-calling'}">
              <span class="banner-pulse-dot"></span>
              <span class="banner-label">${activeCall.status === 'accepted' ? '🟢 QABUL QILMOQDA:' : '📢 QABULGA CHAQIRILDI:'}</span>
              <span class="banner-patient">№${activeCall.queueNo} ${escapeHtml(activeCall.fullName)}</span>
            </div>
          ` : ''}

          ${curPatient ? `
            <div class="current-patient-box">
              <div class="cur-queue-num-wrap">
                <span class="cur-queue-label">${activeCall ? 'KEYINGI' : 'NAVBAT'}</span>
                <span class="cur-queue-number">${curPatient.queueNo || 1}</span>
              </div>
              <div class="cur-patient-details">
                <div class="cur-patient-id">ID: <b>${escapeHtml(curPatient.patientId || '-')}</b></div>
                <div class="cur-patient-name" title="${escapeHtml(curPatient.fullName)}">${escapeHtml(curPatient.fullName)}</div>
                <div class="cur-patient-time">
                  🕐 Ro'yxatga olingan: ${escapeHtml(curPatient.registrationTime || '-')}
                  ${(curPatient.isRegEarlier || curPatient.isRegYesterday) ? `
                    <span style="display:inline-block; font-size:10px; font-weight:700; color:#fbbf24; background:rgba(245,158,11,0.2); border:1px solid rgba(245,158,11,0.4); padding:1px 5px; border-radius:4px; margin-left:4px;" title="${escapeHtml(curPatient.dateTag || '')}">
                      📅 ${curPatient.isRegYesterday ? 'Kecha' : escapeHtml(curPatient.registrationDate)}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>
          ` : (activeCall ? `
            <div class="empty-doc-queue accepted-only">Xonada ko'rik davom etmoqda • Kutayotganlar yo'q</div>
          ` : `
            <div class="empty-doc-queue">Hozirda kutayotgan bemorlar yo'q</div>
          `)}

          ${waitingList.length > 0 ? (() => {
            const waitLimit = 7;
            const waitTotalPages = Math.ceil(waitingList.length / waitLimit);
            const waitPageIndex = Math.floor(Date.now() / 8000) % waitTotalPages;
            const pagedWaiting = waitingList.slice(waitPageIndex * waitLimit, (waitPageIndex + 1) * waitLimit);
            return `
            <div class="waiting-list-section">
              <div class="waiting-list-title">Keyingi navbatdagilar${waitTotalPages > 1 ? ` (Sahifa ${waitPageIndex + 1}/${waitTotalPages} • Jami: ${waitingList.length} ta)` : ''}:</div>
              <div class="waiting-items-scroll">
                ${pagedWaiting.map(p => `
                  <div class="waiting-row-item">
                    <div class="wait-left">
                      <span class="wait-num">${p.queueNo}</span>
                      <span class="wait-name" title="${escapeHtml(p.fullName)}">${escapeHtml(p.fullName)}</span>
                    </div>
                    <span class="wait-time">
                      🕐 ${escapeHtml(p.registrationTime || '')}
                      ${(p.isRegEarlier || p.isRegYesterday) ? `<small style="color:#fbbf24; margin-left:3px; font-weight:700;">[${p.isRegYesterday ? 'Kecha' : escapeHtml(p.registrationDate)}]</small>` : ''}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
            `;
          })() : ''}
        </div>
      `;
    });

    tvQueueGrid.innerHTML = html;

    // Har bir kartaga bosilganda ushbu xonaning Yagona Xona TV ekraniga o'tish
    const cards = tvQueueGrid.querySelectorAll('.doctor-queue-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const roomId = card.getAttribute('data-room-id');
        if (roomId) {
          setViewMode('single-room', roomId);
        }
      });
    });
  }

  // 14. YAGONA XONA TV EKRANINI CHIZISH (2-REJIM JADVAL VA 3-REJIM XONADA BEMOR YO'Q HOLATI)
  function renderSingleRoomView(roomId) {
    if (!singleRoomWrapper) return;

    // Xona parametrini tekshirish
    roomId = roomId || currentRoomId || localStorage.getItem('utt_selected_room') || 'Ultratovush-8';

    let targetDoc = null;
    if (queueData && queueData.doctors && queueData.doctors.length > 0) {
      targetDoc = queueData.doctors.find(d => (d.id === roomId || d.room === roomId));
      if (!targetDoc) {
        targetDoc = queueData.doctors.find(d => 
          d.room.toLowerCase().includes(String(roomId).toLowerCase()) ||
          String(d.num) === String(roomId)
        );
      }
    }

    // Xona va shifokor ma'lumotlarini aniqlash (Server o'chiq bo'lsa ham ROOM_MAP dan olinadi)
    let roomKey = roomId;
    if (!ROOM_MAP[roomKey]) {
      const matchKey = Object.keys(ROOM_MAP).find(k => 
        k.toLowerCase().includes(String(roomId).toLowerCase()) || 
        ROOM_MAP[k].roomNum === String(roomId)
      );
      if (matchKey) roomKey = matchKey;
      else roomKey = 'Ultratovush-8';
    }

    const staticInfo = ROOM_MAP[roomKey] || { title: 'UTT8-49 XONA', roomNum: '49', doctorName: 'Saidbayeva Zulfiya Yergeshovna' };
    const roomTitle = (targetDoc && targetDoc.room) ? getRoomDisplayInfo(targetDoc.room).title : staticInfo.title;
    const doctorName = (targetDoc && targetDoc.doctorName) ? targetDoc.doctorName : staticInfo.doctorName;
    const displayRoom = (targetDoc && targetDoc.room) ? targetDoc.room : roomKey;

    currentRoomId = displayRoom;
    try { localStorage.setItem('utt_selected_room', currentRoomId); } catch (e) {}

    // Dropdownlarda belgilab qo'yish
    if (srRoomDropdown && srRoomDropdown.value !== currentRoomId) {
      srRoomDropdown.value = currentRoomId;
    }
    if (singleRoomSelect && singleRoomSelect.value !== currentRoomId) {
      singleRoomSelect.value = currentRoomId;
    }

    // 1. Markaziy sarlavha (Screenshot: UTT8-49 XONA)
    if (srBigRoomNumberTitle) {
      srBigRoomNumberTitle.textContent = roomTitle;
    }

    // 2. Karta tepasidagi shifokor to'liq nomi (Screenshot: Ultratovush-8(Saidbayeva Zulfiya Yergeshovna))
    const patients = (targetDoc && targetDoc.patients) ? targetDoc.patients : [];

    // Foydalanuvchi talabi:
    // "qabuldagi bemor fish ko'rinmasin. navbatdagi bemor fish va navbat raqamini o'zi yetadi."
    // "har bir vrach uchun bemorlar ro'yxati alohida navbatlansin."
    const waitingPatients = patients.filter(p => {
      const isAccepted = p.statusCode === 4 || (p.status && p.status.toLowerCase().includes('kabul'));
      const isDone = p.statusCode === 2 || p.isCompleted || (p.status && (p.status.toLowerCase().includes('onay') || p.status.toLowerCase().includes('tamam')));
      return !isAccepted && !isDone;
    });

    // 3. Sana va soatni yangilash
    const now = getServerNow();
    if (srFullDateUz) srFullDateUz.textContent = getUzbekFullDate(now);

    // 3-REJIM: XONADA BEMOR YO'Q HOLATI
    if (currentMode === 'empty-room') {
      if (srTableContainer) srTableContainer.style.display = 'none';
      if (srEmptyRoomBox) srEmptyRoomBox.style.display = 'flex';
      if (srDoctorFullTitle) {
        srDoctorFullTitle.textContent = `${displayRoom}(${doctorName})`;
      }
      if (srEmptyWaitingInfo) {
        if (waitingPatients.length > 0) {
          const nextQ = waitingPatients[0].doctorQueueNo || waitingPatients[0].queueNo || 1;
          srEmptyWaitingInfo.innerHTML = `Navbatda kutayotgan bemorlar soni: <b>${waitingPatients.length}</b> nafar (Keyingi navbat: <b>№${nextQ}</b>)`;
          srEmptyWaitingInfo.style.display = 'block';
        } else {
          srEmptyWaitingInfo.style.display = 'none';
        }
      }
      return;
    }

    // 2-REJIM: NAVBAT JADVALI (2 USTUNLI)
    if (srTableContainer) srTableContainer.style.display = 'block';
    if (srEmptyRoomBox) srEmptyRoomBox.style.display = 'none';

    if (!srPatientTableBody) return;

    if (waitingPatients.length === 0) {
      singleRoomPage = 0;
      singleRoomLastSwitchTime = Date.now();
      if (srDoctorFullTitle) {
        srDoctorFullTitle.textContent = `${displayRoom}(${doctorName})`;
      }
      srPatientTableBody.innerHTML = `
        <tr>
          <td colspan="2" class="sr-empty-state">
            Hozirda ushbu xonada navbatda kutayotgan bemorlar mavjud emas.
          </td>
        </tr>
      `;
      return;
    }

    // 7 TALIK CHEKLOV VA SAHIFALASH (45 soniyalik oraliq bilan)
    const PAGE_LIMIT = 7;
    const totalPages = Math.ceil(waitingPatients.length / PAGE_LIMIT);
    if (singleRoomPage >= totalPages) {
      singleRoomPage = 0;
      singleRoomLastSwitchTime = Date.now();
    }

    const pagePatients = waitingPatients.slice(singleRoomPage * PAGE_LIMIT, (singleRoomPage + 1) * PAGE_LIMIT);

    if (srDoctorFullTitle) {
      const pageInfo = totalPages > 1 ? ` <span class="sr-page-badge" id="srPageBadge" title="Sahifa ${singleRoomPage + 1}/${totalPages} (Har 45 soniyada almashadi. Qo'lda o'tkazish uchun bosing)">📄 Sahifa ${singleRoomPage + 1} / ${totalPages} (Jami: ${waitingPatients.length} ta)</span>` : '';
      srDoctorFullTitle.innerHTML = `${escapeHtml(displayRoom)}(${escapeHtml(doctorName)})${pageInfo}`;

      const pageBadgeEl = document.getElementById('srPageBadge');
      if (pageBadgeEl && totalPages > 1) {
        pageBadgeEl.style.cursor = 'pointer';
        pageBadgeEl.onclick = function() {
          singleRoomPage = (singleRoomPage + 1) % totalPages;
          singleRoomLastSwitchTime = Date.now();
          renderSingleRoomView(currentRoomId);
        };
      }
    }

    let rowsHtml = '';
    pagePatients.forEach(p => {
      const qNo = p.doctorQueueNo || p.queueNo || '-';
      rowsHtml += `
        <tr>
          <td class="col-sr-name-td">${escapeHtml((p.fullName || '-').toUpperCase())}</td>
          <td class="col-sr-queue-td">${qNo}</td>
        </tr>
      `;
    });

    srPatientTableBody.innerHTML = rowsHtml;
  }

  // 15. POST REJIMIDAGI JADVALNI CHIZISH
  function renderPostView() {
    if (!queueData || !postPatientTableBody) return;

    const searchQuery = (patientSearchInput && patientSearchInput.value || '').toLowerCase().trim();
    let allPatients = [];

    if (queueData.doctors) {
      queueData.doctors.forEach(doc => {
        const docId = doc.id || doc.room;
        if (selectedDoctorIds.size === 0 || selectedDoctorIds.has(docId)) {
          if (doc.patients && Array.isArray(doc.patients)) {
            doc.patients.forEach(p => {
              var pCopy = (typeof Object.assign === 'function')
                ? Object.assign({}, p)
                : JSON.parse(JSON.stringify(p || {}));
              pCopy.room = doc.room;
              pCopy.doctorName = doc.doctorName;
              allPatients.push(pCopy);
            });
          }
        }
      });
    }

    if (searchQuery) {
      allPatients = allPatients.filter(p =>
        (p.patientId && p.patientId.toLowerCase().includes(searchQuery)) ||
        (p.fullName && p.fullName.toLowerCase().includes(searchQuery)) ||
        (p.referringDoctor && p.referringDoctor.toLowerCase().includes(searchQuery)) ||
        (p.doctorName && p.doctorName.toLowerCase().includes(searchQuery))
      );
    }

    if (tableFilteredCountBadge) {
      tableFilteredCountBadge.textContent = `${allPatients.length} ta bemor ko'rsatilmoqda`;
    }

    if (allPatients.length === 0) {
      postPatientTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            Tanlangan parametrlar bo'yicha hech qanday bemor topilmadi.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    allPatients.forEach(p => {
      rowsHtml += `
        <tr>
          <td><span class="q-badge-table">№ ${p.queueNo}</span></td>
          <td><span class="pat-id-table">${escapeHtml(p.patientId || '-')}</span></td>
          <td><span class="pat-name-table">${escapeHtml(p.fullName || '-')}</span></td>
          <td><b>${escapeHtml(p.room || '-')}</b> (${escapeHtml(p.doctorName || '-')})</td>
          <td>${escapeHtml(p.referringDoctor || '-')}</td>
          <td>${escapeHtml(p.registrationTime || '-')}</td>
          <td><span style="color: #4ade80; font-weight: 700;">● ${escapeHtml(p.status || 'Bekleyen')}</span></td>
        </tr>
      `;
    });

    postPatientTableBody.innerHTML = rowsHtml;
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

  // 16. URL PARAMETRLARI BO'YICHA ISHGA TUSHIRISH (Masalan: ?room=8 yoki ?mode=empty)
  function initFromUrlParams() {
    populateRoomDropdowns();
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const modeParam = urlParams.get('mode');
    let savedRoom = null;
    let savedMode = null;
    try { 
      savedRoom = localStorage.getItem('utt_selected_room'); 
      savedMode = localStorage.getItem('utt_view_mode');
    } catch (e) {}

    let matchedRoom = savedRoom || 'Ultratovush-8';
    if (roomParam) {
      if (/^\d+$/.test(roomParam)) {
        matchedRoom = `Ultratovush-${roomParam}`;
      } else {
        matchedRoom = roomParam;
      }
    }
    currentRoomId = matchedRoom;

    if (modeParam === 'empty' || modeParam === 'empty-room') {
      setViewMode('empty-room', currentRoomId);
    } else if (modeParam === 'single' || modeParam === 'single-room' || roomParam) {
      setViewMode('single-room', currentRoomId);
    } else if (modeParam === 'post') {
      setViewMode('post');
    } else if (modeParam === 'mobile') {
      setViewMode('mobile');
    } else if (modeParam === 'tv') {
      setViewMode('tv');
    } else if (savedMode && (savedMode === 'single-room' || savedMode === 'empty-room')) {
      setViewMode(savedMode, currentRoomId);
    } else {
      setViewMode('tv');
    }

    const dateParam = urlParams.get('date');
    if (dateParam) {
      setTimeout(function() {
        if (statsDateInput) statsDateInput.value = dateParam;
        loadDataForDate(dateParam);
      }, 100);
    }
  }

  // Dastlabki ishga tushirish (v8.2.0)
  initFromUrlParams();
  initDateFilterControls();
  initRealtimeEvents();
  pollQueueData();

  // Har 60 soniyada TV holati va soat sinxronligini serverga telemetriya orqali yuborish
  setInterval(function() {
    if (window.reportTvTelemetry) {
      var driftSec = Math.round(serverTimeOffset / 1000);
      window.reportTvTelemetry('TV_HEARTBEAT', {
        serverDate: serverDateString,
        currentMode: currentMode,
        currentRoomId: currentRoomId,
        driftSeconds: driftSec,
        deviceTime: new Date().toISOString()
      }, 200);
    }
  }, 60000);
})();
