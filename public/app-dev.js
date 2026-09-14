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

  // 1. DOM ELEMENTLARI
  const body = document.body;

  // Rejim tugmalari
  const btnModeTv = document.getElementById('btnModeTv');
  const btnModeSingleRoom = document.getElementById('btnModeSingleRoom');
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
  const srBigRoomNumberTitle = document.getElementById('srBigRoomNumberTitle');
  const srFullDateUz = document.getElementById('srFullDateUz');
  const srFullClockTime = document.getElementById('srFullClockTime');
  const srDoctorFullTitle = document.getElementById('srDoctorFullTitle');
  const srPatientTableBody = document.getElementById('srPatientTableBody');

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

  // 3. HOLAT (STATE)
  let currentMode = 'tv'; // 'tv' | 'single-room' | 'post' | 'mobile'
  let currentRoomId = 'Ultratovush-10'; // Standart xona
  let singleRoomPage = 0;
  let singleRoomTimer = null;
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

  // 6. REJIMNI ALMASHTIRISH (TV, SINGLE-ROOM, POST, MOBIL)
  function setViewMode(mode, targetRoomId) {
    currentMode = mode;
    if (targetRoomId) {
      currentRoomId = targetRoomId;
    }

    body.className = `mode-${mode}`;

    if (btnModeTv) btnModeTv.classList.toggle('active', mode === 'tv');
    if (btnModeSingleRoom) btnModeSingleRoom.classList.toggle('active', mode === 'single-room');
    if (btnModePost) btnModePost.classList.toggle('active', mode === 'post');
    if (btnModeMobile) btnModeMobile.classList.toggle('active', mode === 'mobile');

    if (roomSelectorWrap) {
      roomSelectorWrap.style.display = (mode === 'single-room' || mode === 'tv') ? 'flex' : 'none';
    }

    if (mode === 'tv') {
      if (selectedPillWrap) selectedPillWrap.style.display = 'none';
      if (singleRoomWrapper) singleRoomWrapper.style.display = 'none';
      if (tvQueueGrid) tvQueueGrid.style.display = 'grid';
      if (postTableContainer) postTableContainer.style.display = 'none';
      renderTvGrid();
      try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
    } else if (mode === 'single-room') {
      if (selectedPillWrap) selectedPillWrap.style.display = 'none';
      if (tvQueueGrid) tvQueueGrid.style.display = 'none';
      if (postTableContainer) postTableContainer.style.display = 'none';
      if (singleRoomWrapper) singleRoomWrapper.style.display = 'flex';
      renderSingleRoomView(currentRoomId);
      const cleanParam = currentRoomId.replace('Ultratovush-', '');
      try { history.replaceState(null, '', `?room=${encodeURIComponent(cleanParam)}`); } catch (e) {}
    } else if (mode === 'post') {
      if (selectedPillWrap) selectedPillWrap.style.display = 'flex';
      if (singleRoomWrapper) singleRoomWrapper.style.display = 'none';
      if (tvQueueGrid) tvQueueGrid.style.display = 'none';
      if (postTableContainer) postTableContainer.style.display = 'block';
      renderPostView();
      try { history.replaceState(null, '', '?mode=post'); } catch (e) {}
    } else if (mode === 'mobile') {
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
  if (btnModePost) btnModePost.addEventListener('click', () => setViewMode('post'));
  if (btnModeMobile) btnModeMobile.addEventListener('click', () => setViewMode('mobile'));
  if (btnSrBackToAll) btnSrBackToAll.addEventListener('click', () => setViewMode('tv'));

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
      if (currentMode === 'single-room') {
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
        setViewMode('single-room', val);
      }
    });
  }

  if (srRoomDropdown) {
    srRoomDropdown.addEventListener('change', (e) => {
      setViewMode('single-room', e.target.value);
    });
  }

  // 7. JONLI SOAT VA SANA
  function updateLiveClock() {
    const now = new Date();
    const pad = (n) => (n < 10 ? '0' : '') + n;
    const d = pad(now.getDate());
    const m = pad(now.getMonth() + 1);
    const y = now.getFullYear();
    const h = pad(now.getHours());
    const min = pad(now.getMinutes());
    const s = pad(now.getSeconds());

    // Header soati
    if (liveDate) liveDate.textContent = `📅 ${d}.${m}.${y}`;
    if (liveTime) liveTime.textContent = `${h}:${min}:${s}`;

    // Single Room TV soati va sanasi (Screenshot 2: Seshanba 8 Sentabr 2026 | 10:28:34)
    if (srFullDateUz) srFullDateUz.textContent = getUzbekFullDate(now);
    if (srFullClockTime) srFullClockTime.textContent = `${h}:${min}:${s}`;
  }
  setInterval(updateLiveClock, 1000);
  updateLiveClock();

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
            liveConnText.textContent = 'Jonli TV v7.1.0-dev (Test)';
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
              if (currentMode === 'single-room') renderSingleRoomView(currentRoomId);
              else if (currentMode === 'tv' || currentMode === 'mobile') renderTvGrid();
              else if (currentMode === 'post') renderPostView();
              return;
            }
            handleNewQueueData(data);
          } catch (err) {}
        };

        sseSource.onerror = function () {
          // SSE uzilsa ham polling ishlab turadi
          if (liveConnChip) {
            liveConnChip.className = 'live-connection-chip connected';
            liveConnText.textContent = 'Jonli TV v7.1.0-dev (Auto)';
          }
        };
      } catch (e) {}
    }
  }

  var consecutivePollErrors = 0;
  function pollQueueData() {
    universalGet('/api/queue-live?t=' + Date.now(), function(data) {
      consecutivePollErrors = 0;
      handleNewQueueData(data);
      if (liveConnChip) {
        liveConnChip.className = 'live-connection-chip connected';
        liveConnText.textContent = 'Jonli TV v7.1.0-dev (Test)';
      }
    }, function(err) {
      consecutivePollErrors++;
      if (liveConnChip) {
        liveConnChip.className = 'live-connection-chip disconnected';
        liveConnText.textContent = 'Aloqa qidirilmoqda...';
      }
      if (consecutivePollErrors === 3 && window.reportTvTelemetry) {
        window.reportTvTelemetry('TV_API_POLL_ERROR', { error: String(err && err.message ? err.message : err), consecutiveFails: consecutivePollErrors }, 500);
      }
    });
  }

  function handleNewQueueData(data) {
    if (!data) return;
    queueData = data;
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

    if (currentMode === 'single-room') {
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
    const waiting = (queueData.summary && typeof queueData.summary.totalWaiting === 'number') 
      ? queueData.summary.totalWaiting 
      : (queueData.totalPatients || (queueData.allPatients ? queueData.allPatients.length : 0));
    if (totalPatientsCount) totalPatientsCount.textContent = waiting;

    const activeDocs = queueData.doctors ? queueData.doctors.filter(d => (d.patients && d.patients.length > 0)).length : 0;
    if (activeDoctorsCount) activeDoctorsCount.textContent = activeDocs;

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

      html += `
        <div class="doctor-queue-card ${(hasWaiting || activeCall) ? 'has-active' : ''} ${activeCall ? (activeCall.status === 'accepted' ? 'card-accepted' : 'card-calling') : ''}" data-room-id="${escapeHtml(docId)}" title="Batafsil xona ekraniga o'tish uchun bosing">
          <div class="doc-card-header">
            <div class="doc-room-title">
              <span class="room-badge">${escapeHtml(doc.room.replace('Ultratovush-', 'U-'))}</span>
              <span class="doc-name" title="${escapeHtml(doc.doctorName)}">${escapeHtml(doc.doctorName)}</span>
            </div>
            <span class="doc-queue-badge ${(hasWaiting || activeCall) ? '' : 'empty'}">
              ${patients.length} ta bemor
            </span>
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
                <div class="cur-patient-time">🕐 Ro'yxatga olingan: ${escapeHtml(curPatient.registrationTime || '-')}</div>
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
                    <span class="wait-time">🕐 ${escapeHtml(p.registrationTime || '')}</span>
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

  // 14. YAGONA XONA TV EKRANINI CHIZISH (SCREENSHOT 2 KO'RINISHI)
  function renderSingleRoomView(roomId) {
    if (!singleRoomWrapper) return;

    // Xona parametrini tekshirish
    roomId = roomId || currentRoomId || localStorage.getItem('utt_selected_room') || 'Ultratovush-1';

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
      else roomKey = 'Ultratovush-1';
    }

    const staticInfo = ROOM_MAP[roomKey] || { title: 'UTT1-53 XONA', roomNum: '53', doctorName: 'Juravlev Igor Ivanovich' };
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

    // 1. Markaziy sarlavha (Screenshot: UTT1-53 XONA)
    if (srBigRoomNumberTitle) {
      srBigRoomNumberTitle.textContent = roomTitle;
    }

    // 2. Karta tepasidagi shifokor to'liq nomi (Screenshot: Ultratovush-1(Juravlev Igor Ivanovich))
    if (srDoctorFullTitle) {
      srDoctorFullTitle.textContent = `${displayRoom}(${doctorName})`;
    }

    // 3. Sana va soatni yangilash
    const now = new Date();
    if (srFullDateUz) srFullDateUz.textContent = getUzbekFullDate(now);

    // 4. Jadvalni to'ldirish (Foydalanuvchi talabi: 7 talik cheklov, qolganlari yangi sahifaga o'tsin)
    // Ustunlar: ISM FAMILYA | RO'YXATGA OLINGAN VAQTI | NAVBAT RAQAMI
    const patients = (targetDoc && targetDoc.patients) ? targetDoc.patients : [];

    if (!srPatientTableBody) return;

    if (patients.length === 0) {
      if (singleRoomTimer) { clearTimeout(singleRoomTimer); singleRoomTimer = null; }
      srPatientTableBody.innerHTML = `
        <tr>
          <td colspan="3" class="sr-empty-state">
            Hozirda ushbu xonada navbatda kutayotgan bemorlar mavjud emas.
          </td>
        </tr>
      `;
      return;
    }

    // 7 TALIK CHEKLOV VA SAHIFALASH (PAGINATION)
    const PAGE_LIMIT = 7;
    const totalPages = Math.ceil(patients.length / PAGE_LIMIT);
    if (singleRoomPage >= totalPages) singleRoomPage = 0;

    const pagePatients = patients.slice(singleRoomPage * PAGE_LIMIT, (singleRoomPage + 1) * PAGE_LIMIT);

    let rowsHtml = '';
    const activeCall = activeCalls[targetDoc.room] || activeCalls[currentRoomId];

    // Xona boshida qabul qilinayotgan bemor banneri (v6.0.0)
    if (srDoctorFullTitle) {
      const pageInfo = totalPages > 1 ? ` <span class="sr-page-badge">📄 Sahifa ${singleRoomPage + 1} / ${totalPages} (Jami: ${patients.length} ta)</span>` : '';
      let callBanner = '';
      if (activeCall) {
        const isAccepted = activeCall.status === 'accepted';
        callBanner = `<div class="sr-active-call-badge ${isAccepted ? 'sr-badge-accepted' : 'sr-badge-calling'}">
          <span class="pulse-dot"></span>
          ${isAccepted ? '🟢 HOZIR QABUL QILMOQDA:' : '📢 CHAQIRILDI:'} №${activeCall.queueNo} — ${escapeHtml(activeCall.fullName)}
        </div>`;
      }
      srDoctorFullTitle.innerHTML = `${escapeHtml(targetDoc.room)}(${escapeHtml(targetDoc.doctorName)})${pageInfo}${callBanner}`;
    }

    pagePatients.forEach(p => {
      const isCallingThis = activeCall && (
        (activeCall.patientId && p.patientId && String(activeCall.patientId).trim() === String(p.patientId).trim()) ||
        (activeCall.queueNo && p.queueNo && String(activeCall.queueNo) === String(p.queueNo))
      );
      const isAcceptedThis = isCallingThis && activeCall.status === 'accepted';

      rowsHtml += `
        <tr class="${isAcceptedThis ? 'row-accepted' : (isCallingThis ? 'row-calling' : '')}">
          <td class="col-sr-name-td">
            ${escapeHtml(p.fullName || '-')}
            ${isAcceptedThis ? '<span class="badge-accepted-now">🟢 QABULDA</span>' : (isCallingThis ? '<span class="badge-calling-now">📢 QABULDA</span>' : '')}
          </td>
          <td class="col-sr-time-td">${escapeHtml(p.registrationTime || '-')}</td>
          <td class="col-sr-queue-td">${p.queueNo || '-'}</td>
        </tr>
      `;
    });

    srPatientTableBody.innerHTML = rowsHtml;

    // Agar bemorlar 7 tadan ko'p bo'lsa, har 8 soniyada keyingi sahifaga avtomatik o'tish
    if (singleRoomTimer) clearTimeout(singleRoomTimer);
    if (totalPages > 1) {
      singleRoomTimer = setTimeout(() => {
        if (currentMode === 'single-room') {
          singleRoomPage = (singleRoomPage + 1) % totalPages;
          renderSingleRoomView(currentRoomId);
        }
      }, 8000);
    }
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

  // 16. URL PARAMETRLARI BO'YICHA ISHGA TUSHIRISH (Masalan: ?room=1 yoki ?mode=single-room)
  function initFromUrlParams() {
    populateRoomDropdowns();
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const modeParam = urlParams.get('mode');
    let savedRoom = null;
    try { savedRoom = localStorage.getItem('utt_selected_room'); } catch (e) {}

    if (roomParam) {
      let matchedRoom = roomParam;
      if (/^\d+$/.test(roomParam)) {
        matchedRoom = `Ultratovush-${roomParam}`;
      }
      currentRoomId = matchedRoom;
      try { localStorage.setItem('utt_selected_room', currentRoomId); } catch (e) {}
      setViewMode('single-room', currentRoomId);
    } else if (modeParam === 'post') {
      setViewMode('post');
    } else if (modeParam === 'mobile') {
      setViewMode('mobile');
    } else if (modeParam === 'single' || modeParam === 'single-room') {
      currentRoomId = savedRoom || 'Ultratovush-1';
      setViewMode('single-room', currentRoomId);
    } else if (savedRoom) {
      currentRoomId = savedRoom;
      setViewMode('single-room', currentRoomId);
    } else {
      setViewMode('tv');
    }
  }

  // Dastlabki ishga tushirish (v7.0.0)
  initFromUrlParams();
  initRealtimeEvents();
  pollQueueData();
})();
