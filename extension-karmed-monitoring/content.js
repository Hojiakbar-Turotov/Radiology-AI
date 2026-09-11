/**
 * KARMED MONITORING - CONTENT SCRIPT (v1.3.0)
 * 1. Main world (interceptor.js) dan so'rovlar, foydalanuvchi F.I.SH va sessiya nusxalarini qabul qiladi.
 * 2. Foydalanuvchi o'zgarganda F.I.SH, hdnKrmdLoginBilgi va ASP.NET_SessionId nusxalarini faylga saqlaydi.
 * 3. Qo'lda tekshirish, nusxa olish va JSON qilib yuklab olish imkoniyatini taqdim etadi.
 */

(function() {
  const requests = [];
  const MAX_REQUESTS = 200;
  let autoSavedCount = 0;
  const pendingAutoSaveQueue = [];
  let isSaving = false;

  let currentProfile = {
    username: 'R5',
    fullName: 'Pazliyev Sardor',
    loginBilgi: '',
    sessionId: '',
    cookie: ''
  };

  let lastNotifiedUserKey = '';
  let userSnapshots = [];
  let activeTab = 'feed'; // 'feed' | 'users'

  // Sahifa yuklanganda serverdagi joriy statistikani va foydalanuvchilar tarixini olish
  async function loadInitialStats() {
    try {
      const urls = ['http://localhost:9876/api/karmed-overview-stats', 'http://10.34.17.210:9876/api/karmed-overview-stats'];
      for (const u of urls) {
        try {
          const res = await fetch(u);
          const data = await res.json();
          if (data && data.success) {
            autoSavedCount = data.totalSavedRequests || 0;
            if (data.profiles && data.profiles.R5) {
              const sp = data.profiles.R5;
              if (sp.fullName) currentProfile.fullName = sp.fullName;
              if (sp.loginBilgi) currentProfile.loginBilgi = sp.loginBilgi;
              if (sp.cookie) currentProfile.cookie = sp.cookie;
            }
            updateBadge();
            updateProfileUI();
            break;
          }
        } catch (e) {}
      }

      // Foydalanuvchilar sessiya tarixini yuklash
      loadUserSnapshotsFromServer();
    } catch (e) {}
  }
  loadInitialStats();

  async function loadUserSnapshotsFromServer() {
    try {
      const urls = ['http://localhost:9876/api/karmed-users-history', 'http://10.34.17.210:9876/api/karmed-users-history'];
      for (const u of urls) {
        try {
          const res = await fetch(u);
          const data = await res.json();
          if (data && data.success && data.history) {
            const hUsers = data.history.users || {};
            const list = [];
            Object.values(hUsers).forEach(u => {
              if (Array.isArray(u.history)) {
                u.history.forEach(h => {
                  list.push({
                    username: u.username,
                    fullName: h.fullName || u.fullName,
                    sessionId: h.sessionId || u.lastSessionId,
                    loginBilgi: u.lastLoginBilgi || '',
                    timestamp: h.timestamp
                  });
                });
              }
            });
            if (list.length > 0) {
              userSnapshots = list;
              renderUsersHistoryUI();
            }
            break;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  // 1. MAIN WORLDGA INTERCEPTOR SKRIPTINI YUKLASH
  function injectMainScript() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('interceptor.js');
      script.onload = function() { this.remove(); };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {}
  }
  injectMainScript();

  // 2. MAIN WORLD DAN VOQEALARNI QABUL QILISH
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'KARMED_MONITOR_PAGE') return;

    if (event.data.type === 'NETWORK_EVENT') {
      handleNetworkEvent(event.data.data);
    } else if (event.data.type === 'PROFILE_DETECTED') {
      handleProfileDetected(event.data.data);
    } else if (event.data.type === 'USER_SNAPSHOT_DETECTED') {
      handleUserSnapshotDetected(event.data.data);
    }
  });

  function handleProfileDetected(prof) {
    if (!prof) return;
    let changed = false;
    if (prof.loginBilgi && prof.loginBilgi !== currentProfile.loginBilgi) {
      currentProfile.loginBilgi = prof.loginBilgi;
      changed = true;
    }
    if (prof.fullName && prof.fullName !== currentProfile.fullName) {
      currentProfile.fullName = prof.fullName;
      changed = true;
    }
    if (prof.username && prof.username !== currentProfile.username) {
      currentProfile.username = prof.username;
      changed = true;
    }
    if (prof.sessionId && prof.sessionId !== currentProfile.sessionId) {
      currentProfile.sessionId = prof.sessionId;
      changed = true;
    }

    if (changed) {
      updateProfileUI();
      syncProfileToServer(currentProfile);
    }
  }

  async function handleUserSnapshotDetected(snap) {
    if (!snap) return;

    // Cookie va SessionId ni backgrounddan tekshirish
    try {
      const resp = await chrome.runtime.sendMessage({ action: 'GET_KARMED_COOKIES' });
      if (resp) {
        if (resp.sessionId) snap.sessionId = resp.sessionId;
        if (resp.cookies) snap.cookie = resp.cookies;
      }
    } catch (e) {}

    currentProfile.username = snap.username || currentProfile.username;
    currentProfile.fullName = snap.fullName || currentProfile.fullName;
    if (snap.loginBilgi) currentProfile.loginBilgi = snap.loginBilgi;
    if (snap.sessionId) currentProfile.sessionId = snap.sessionId;
    if (snap.cookie) currentProfile.cookie = snap.cookie;

    // Foydalanuvchi almashgan bo'lsa xabar berish (toast)
    const userKey = `${currentProfile.username}_${currentProfile.fullName}`;
    if (userKey !== lastNotifiedUserKey) {
      lastNotifiedUserKey = userKey;
      showToast(`👤 Foydalanuvchi aniqlandi: ${currentProfile.fullName} (${currentProfile.username})`);
    }

    // Mahalliy ro'yxatga qo'shish
    userSnapshots.unshift({
      username: currentProfile.username,
      fullName: currentProfile.fullName,
      sessionId: currentProfile.sessionId,
      loginBilgi: currentProfile.loginBilgi,
      timestamp: new Date().toISOString()
    });
    if (userSnapshots.length > 50) userSnapshots = userSnapshots.slice(0, 50);

    updateProfileUI();
    renderUsersHistoryUI();

    // Serverga saqlash
    sendSnapshotToServer({
      username: currentProfile.username,
      fullName: currentProfile.fullName,
      loginBilgi: currentProfile.loginBilgi,
      sessionId: currentProfile.sessionId,
      cookie: currentProfile.cookie,
      url: window.location.href
    });
  }

  async function sendSnapshotToServer(payload) {
    const urls = ['http://localhost:9876/api/karmed-save-user-snapshot', 'http://10.34.17.210:9876/api/karmed-save-user-snapshot'];
    for (const u of urls) {
      try {
        await fetch(u, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        break;
      } catch (e) {}
    }
  }

  function handleNetworkEvent(rawReq) {
    const idx = requests.findIndex(r => r.id === rawReq.id);
    let reqObj;

    if (idx >= 0) {
      reqObj = Object.assign(requests[idx], rawReq);
    } else {
      reqObj = rawReq;
      requests.unshift(reqObj);
      if (requests.length > MAX_REQUESTS) requests.pop();
    }

    if (window.KarmedAnalyzer) {
      reqObj.findings = KarmedAnalyzer.analyzeRequest(reqObj);
    }

    if (reqObj.stage === 'completed' || reqObj.stage === 'error') {
      pendingAutoSaveQueue.push(reqObj);
    }

    updateBadge();
    if (activeTab === 'feed') renderFeed();
  }

  // 3. DOIMIY AVTOMATIK SAQLASH (HAR 1.5 SONIYADA)
  setInterval(flushAutoSaveQueue, 1500);

  async function flushAutoSaveQueue() {
    if (pendingAutoSaveQueue.length === 0 || isSaving) return;
    isSaving = true;

    const batch = pendingAutoSaveQueue.splice(0, 20);
    try {
      const payload = {
        source: 'KARMED_AUTO_SAVE',
        timestamp: new Date().toISOString(),
        profile: currentProfile,
        batchCount: batch.length,
        requests: batch
      };

      const urls = ['http://localhost:9876/api/karmed-auto-save', 'http://10.34.17.210:9876/api/karmed-auto-save'];
      for (const u of urls) {
        try {
          await fetch(u, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          autoSavedCount += batch.length;
          break;
        } catch (e) {}
      }
      updateBadge();
    } catch (err) {
      pendingAutoSaveQueue.unshift(...batch);
    } finally {
      isSaving = false;
    }
  }

  async function syncProfileToServer(prof) {
    try {
      let cookieStr = '';
      try {
        const resp = await chrome.runtime.sendMessage({ action: 'GET_KARMED_COOKIES' });
        if (resp && resp.cookies) cookieStr = resp.cookies;
      } catch (e) {}

      if (cookieStr) prof.cookie = cookieStr;

      const urls = ['http://localhost:9876/api/karmed-profile-sync', 'http://10.34.17.210:9876/api/karmed-profile-sync'];
      for (const u of urls) {
        try {
          await fetch(u, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile: prof })
          });
          break;
        } catch (e) {}
      }
    } catch (e) {}
  }

  // 4. UI YARATISH (SUZUVCHI PANEL VA TIZIMLI TABLAR)
  function createFloatingInspector() {
    const badge = document.createElement('div');
    badge.id = 'karmed-monitor-badge';
    badge.innerHTML = `
      <div class="km-pulse"></div>
      <span>🛰️ Karmed [Auto-Save]</span>
      <span class="km-badge-count" id="km-badge-num">0</span>
    `;
    badge.title = "Karmed Monitoring panelini ochish";
    document.body.appendChild(badge);

    const panel = document.createElement('div');
    panel.id = 'karmed-monitor-panel';
    panel.innerHTML = `
      <div class="km-header">
        <div class="km-title-group">
          <span class="km-title">🛰️ KARMED MONITORING & SESSIYALAR NAZORATCHISI</span>
          <span class="km-badge-count" id="km-profile-badge">R5</span>
        </div>
        <div class="km-header-actions">
          <button class="km-btn-icon" id="km-btn-minimize">✖</button>
        </div>
      </div>

      <!-- TABS ROW -->
      <div class="km-tabs">
        <button id="km-tab-feed-btn" class="km-tab-btn km-tab-active">📡 So'rovlar Oqimi (<span id="km-tab-req-count">0</span>)</button>
        <button id="km-tab-users-btn" class="km-tab-btn">👥 Foydalanuvchilar & Sessiyalar Nusxasi</button>
      </div>

      <div class="km-filter-bar" style="background:#0b1120; font-size:11px; padding: 6px 12px; color:#38bdf8; display:flex; justify-content:space-between; align-items:center;">
        <span>👤 Faol: <strong id="km-prof-name">R5 (Pazliyev Sardor)</strong></span>
        <span>Saqlangan so'rovlar: <strong id="km-saved-count">0</strong></span>
      </div>

      <!-- TAB 1: FEED -->
      <div id="km-tab-feed-view" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
        <div class="km-req-list" id="km-req-list-container" style="flex:1; overflow-y:auto; padding:6px;">
          <div style="padding: 20px; text-align: center; color: #64748b; font-size: 12px;">
            Har bir so'rov avtomatik ravishda mahalliy serverga saqlanmoqda...
          </div>
        </div>
      </div>

      <!-- TAB 2: USERS & SESSIONS -->
      <div id="km-tab-users-view" style="flex:1; display:none; flex-direction:column; overflow-y:auto; padding:12px; gap:10px;">
        
        <!-- ACTIVE USER CARD -->
        <div class="km-active-user-box">
          <div class="km-user-title-row">
            <div>
              <span style="font-size:11px; color:#94a3b8; font-weight:700;">Hozirgi Faol Foydalanuvchi:</span>
              <div class="km-user-fullname" id="km-u-card-name">Pazliyev Sardor</div>
            </div>
            <span class="km-user-uname-badge" id="km-u-card-uname">R5</span>
          </div>

          <div class="km-prop-row">
            <span class="km-prop-lbl">🔑 ASP.NET_SessionId:</span>
            <span class="km-prop-val" id="km-u-card-sessionid">Aniqlanmoqda...</span>
            <button class="km-btn-copy" id="km-btn-copy-sess">📋 Nusxa</button>
          </div>

          <div class="km-prop-row">
            <span class="km-prop-lbl">🎫 hdnKrmdLoginBilgi:</span>
            <span class="km-prop-val" id="km-u-card-token">Aniqlanmoqda...</span>
            <button class="km-btn-copy" id="km-btn-copy-token">📋 Nusxa</button>
          </div>

          <div class="km-users-actions-row">
            <button class="km-btn-download-json" id="km-btn-download-history">💾 Barcha Nusxalarni JSON Yuklab Olish</button>
            <button class="km-btn-refresh-users" id="km-btn-refresh-history">🔄 Yangilash</button>
          </div>
        </div>

        <!-- HISTORY HEADER -->
        <div style="font-size:12px; font-weight:700; color:#38bdf8; margin-top:6px;">
          📋 Aniqlangan Foydalanuvchilar Sessiya Tarixi (Nusxalar):
        </div>

        <!-- HISTORY LIST -->
        <div id="km-users-history-container" style="display:flex; flex-direction:column; gap:8px;">
          <div style="padding:15px; text-align:center; color:#64748b; font-size:11px;">Foydalanuvchilar tarixi yuklanmoqda...</div>
        </div>

      </div>
    `;
    document.body.appendChild(panel);

    // Toggle panel
    badge.addEventListener('click', () => panel.classList.toggle('km-open'));
    document.getElementById('km-btn-minimize').addEventListener('click', () => panel.classList.remove('km-open'));

    // Tab buttons
    const tabFeedBtn = document.getElementById('km-tab-feed-btn');
    const tabUsersBtn = document.getElementById('km-tab-users-btn');
    const feedView = document.getElementById('km-tab-feed-view');
    const usersView = document.getElementById('km-tab-users-view');

    tabFeedBtn.addEventListener('click', () => {
      activeTab = 'feed';
      tabFeedBtn.classList.add('km-tab-active');
      tabUsersBtn.classList.remove('km-tab-active');
      feedView.style.display = 'flex';
      usersView.style.display = 'none';
      renderFeed();
    });

    tabUsersBtn.addEventListener('click', () => {
      activeTab = 'users';
      tabUsersBtn.classList.add('km-tab-active');
      tabFeedBtn.classList.remove('km-tab-active');
      feedView.style.display = 'none';
      usersView.style.display = 'flex';
      renderUsersHistoryUI();
      loadUserSnapshotsFromServer();
    });

    // Copy buttons
    document.getElementById('km-btn-copy-sess').addEventListener('click', function() {
      copyToClipboard(currentProfile.sessionId || '', this);
    });
    document.getElementById('km-btn-copy-token').addEventListener('click', function() {
      copyToClipboard(currentProfile.loginBilgi || '', this);
    });

    // Download JSON
    document.getElementById('km-btn-download-history').addEventListener('click', downloadHistoryJson);
    document.getElementById('km-btn-refresh-history').addEventListener('click', loadUserSnapshotsFromServer);
  }

  function copyToClipboard(text, btnEl) {
    if (!text) {
      alert("Nusxalanadigan ma'lumot mavjud emas!");
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      const orig = btnEl.innerText;
      btnEl.innerText = '✔️ Nusxalandi!';
      btnEl.style.background = '#059669';
      btnEl.style.color = '#fff';
      setTimeout(() => {
        btnEl.innerText = orig;
        btnEl.style.background = '';
        btnEl.style.color = '';
      }, 1500);
    });
  }

  function downloadHistoryJson() {
    const data = {
      exportedAt: new Date().toISOString(),
      currentProfile: currentProfile,
      totalSnapshots: userSnapshots.length,
      snapshots: userSnapshots
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `karmed_users_sessions_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("💾 Foydalanuvchilar sessiya nusxasi yuklab olindi!");
  }

  function showToast(msg) {
    const existing = document.getElementById('km-floating-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'km-floating-toast';
    toast.className = 'km-toast';
    toast.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  function updateBadge() {
    const bNum = document.getElementById('km-badge-num');
    const sCount = document.getElementById('km-saved-count');
    const tCount = document.getElementById('km-tab-req-count');
    if (bNum) bNum.innerText = requests.length;
    if (sCount) sCount.innerText = autoSavedCount;
    if (tCount) tCount.innerText = requests.length;
  }

  function updateProfileUI() {
    const pBadge = document.getElementById('km-profile-badge');
    const pName = document.getElementById('km-prof-name');
    const uCardName = document.getElementById('km-u-card-name');
    const uCardUname = document.getElementById('km-u-card-uname');
    const uCardSess = document.getElementById('km-u-card-sessionid');
    const uCardTok = document.getElementById('km-u-card-token');

    if (pBadge) pBadge.innerText = currentProfile.username;
    if (pName) pName.innerText = (currentProfile.username + ' (' + currentProfile.fullName + ')');
    if (uCardName) uCardName.innerText = currentProfile.fullName || "Noma'lum";
    if (uCardUname) uCardUname.innerText = currentProfile.username || "R5";
    if (uCardSess) uCardSess.innerText = currentProfile.sessionId || "Sessiya tekshirilmoqda...";
    if (uCardTok) uCardTok.innerText = currentProfile.loginBilgi ? (currentProfile.loginBilgi.slice(0, 32) + '...') : "Token yo'q";
  }

  function renderUsersHistoryUI() {
    const container = document.getElementById('km-users-history-container');
    if (!container) return;

    if (userSnapshots.length === 0) {
      container.innerHTML = '<div style="padding:15px; text-align:center; color:#64748b; font-size:11px;">Hozircha saqlangan foydalanuvchilar sessiyasi yo\'q.</div>';
      return;
    }

    container.innerHTML = userSnapshots.map((snap, idx) => `
      <div class="km-snapshot-item">
        <div class="km-snapshot-header">
          <div class="km-snapshot-user">👤 ${snap.fullName || 'Noma\'lum'} (${snap.username || 'R5'})</div>
          <div class="km-snapshot-time">${snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString() : '—'}</div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:#090d16; padding:4px 8px; border-radius:4px;">
          <span style="font-size:10px; color:#94a3b8; font-family:monospace;">SessionId: ${snap.sessionId || '—'}</span>
          <button class="km-btn-copy" onclick="navigator.clipboard.writeText('${snap.sessionId || ''}')">📋 Nusxa</button>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:#090d16; padding:4px 8px; border-radius:4px;">
          <span style="font-size:10px; color:#94a3b8; font-family:monospace;">Token: ${(snap.loginBilgi || '').slice(0, 26)}...</span>
          <button class="km-btn-copy" onclick="navigator.clipboard.writeText('${snap.loginBilgi || ''}')">📋 Nusxa</button>
        </div>
      </div>
    `).join('');
  }

  function renderFeed() {
    const container = document.getElementById('km-req-list-container');
    if (!container) return;
    if (requests.length === 0) return;

    container.innerHTML = '';
    requests.slice(0, 50).forEach(req => {
      const item = document.createElement('div');
      item.className = 'km-req-item';
      const methodClass = req.method === 'GET' ? 'km-method-get' : 'km-method-post';
      item.innerHTML = `
        <div class="km-req-row1">
          <span class="km-method-badge ${methodClass}">${req.method || 'GET'}</span>
          <span class="km-status-pill">${req.status || '...'}</span>
        </div>
        <div class="km-req-url">${req.url}</div>
        <div class="km-req-row2">
          <span>${req.durationMs ? req.durationMs + 'ms' : ''}</span>
          <span class="km-tag-pill">${req.findings ? req.findings.summaryTag : ''}</span>
        </div>
      `;
      container.appendChild(item);
    });
  }

  // Dastlabki UI ishga tushirish
  createFloatingInspector();

})();
