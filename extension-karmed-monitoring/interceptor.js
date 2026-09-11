/**
 * KARMED MONITORING - MAIN WORLD INTERCEPTOR (v1.1.0)
 * 1. Tarmoqdagi barcha Fetch, XHR va DevExpress Callback so'rovlarini ushlaydi.
 * 2. Karmed foydalanuvchi profili (R5, F.I.SH) va hdnKrmdLoginBilgi tokenini doimiy kuzatadi.
 * 3. So'rovlarni avtomatik ravishda content scriptga uzatadi.
 */
(function() {
  if (window.__karmedMonitoringActive) return;
  window.__karmedMonitoringActive = true;

  console.log('%c[Karmed Monitoring v1.1.0]%c Avto-kuzatuvchi va Profil aniqlovchi faol.', 'color:#0284c7;font-weight:bold;font-size:13px;', 'color:auto;');

  let reqCounter = 0;
  let currentProfile = {
    username: 'R5',
    fullName: 'Foydalanuvchi (R5)',
    loginBilgi: ''
  };

  function generateReqId() {
    return 'req_' + Date.now() + '_' + (++reqCounter);
  }

  function safeStringify(obj, maxLen = 500000) {
    try {
      if (typeof obj === 'string') {
        return obj.length > maxLen ? obj.slice(0, maxLen) + '... [TRUNCATED]' : obj;
      }
      const str = JSON.stringify(obj);
      return str.length > maxLen ? str.slice(0, maxLen) + '... [TRUNCATED]' : str;
    } catch (e) {
      return String(obj);
    }
  }

  function parseHeaders(headersString) {
    const headers = {};
    if (!headersString) return headers;
    const lines = headersString.trim().split(/[\r\n]+/);
    lines.forEach(line => {
      const parts = line.split(': ');
      const header = parts.shift();
      const value = parts.join(': ');
      if (header) headers[header.toLowerCase()] = value;
    });
    return headers;
  }

  // FOYDALANUVCHI PROFILINI TEKSHIRISH
  // FOYDALANUVCHI PROFILINI TEKSHIRISH VA MANZILNI KUZATISH
  let lastDispatchedUrl = '';

  function checkUserProfile() {
    let detectedName = '';
    let detectedLogin = '';

    // A. AGAR LOGIN SAHIFASIDA BO'LSAK (/Login/Login.aspx yoki Smart Hospital Solution)
    const txtUser = document.getElementById('txtUsername') || 
                    document.querySelector('input[name="txtUsername"]') ||
                    document.querySelector('input[name*="Username"]') ||
                    document.querySelector('input[name="kullaniciadi"]');
    if (txtUser && txtUser.value) {
      detectedLogin = txtUser.value.trim().toUpperCase();
      try { localStorage.setItem('__karmed_active_login', detectedLogin); } catch(e){}
    }

    // Input maydonini doimiy tinglash
    if (txtUser && !txtUser.__karmedMonitored) {
      txtUser.__karmedMonitored = true;
      const onUserInputChange = () => {
        if (txtUser.value) {
          const val = txtUser.value.trim().toUpperCase();
          currentProfile.username = val;
          try { localStorage.setItem('__karmed_active_login', val); } catch(e){}
          window.postMessage({
            source: 'KARMED_MONITOR_PAGE',
            type: 'PROFILE_DETECTED',
            data: currentProfile
          }, '*');
        }
      };
      txtUser.addEventListener('input', onUserInputChange);
      txtUser.addEventListener('change', onUserInputChange);
    }

    // Kirish tugmasini bosilishini kuzatish
    const btnLogin = document.getElementById('BtnLogin') || 
                     document.querySelector('[id*="BtnLogin"]') || 
                     document.querySelector('button[type="submit"]') ||
                     document.querySelector('input[type="submit"]');
    if (btnLogin && !btnLogin.__karmedBound) {
      btnLogin.__karmedBound = true;
      btnLogin.addEventListener('click', () => {
        const u = (txtUser && txtUser.value ? txtUser.value.trim().toUpperCase() : '') || currentProfile.username;
        if (u) {
          currentProfile.username = u;
          try { localStorage.setItem('__karmed_active_login', u); } catch(e){}
        }
        dispatchToContentScript({
          id: generateReqId(),
          transport: 'login_action',
          stage: 'completed',
          timestamp: new Date().toISOString(),
          url: window.location.href,
          method: 'LOGIN_SUBMIT',
          status: 200,
          findings: { summaryTag: 'KIRISH_URINISHI (' + u + ')' }
        });
      });
    }

    // B. AGAR ASOSIY SAHIFA BO'LSAK (/Radiology/Rbys.aspx)
    if (!detectedLogin) {
      try { detectedLogin = localStorage.getItem('__karmed_active_login') || ''; } catch(e){}
    }

    // 1. Karmed DOM dan foydalanuvchi tugmasi
    const btnUser = document.getElementById('btnKullanici') || 
                    document.querySelector('[id*="btnKullanici"]') ||
                    document.getElementById('lblKullaniciAdi');
    if (btnUser) {
      detectedName = btnUser.innerText || btnUser.textContent || '';
    } else if (window.App && window.App.btnKullanici && window.App.btnKullanici.getText) {
      detectedName = window.App.btnKullanici.getText();
    }

    // 2. Token tekshirish
    let token = '';
    if (window.App && window.App.hdnKrmdLoginBilgi && window.App.hdnKrmdLoginBilgi.getValue) {
      token = window.App.hdnKrmdLoginBilgi.getValue();
    } else {
      const inp = document.querySelector('input[name="hdnKrmdLoginBilgi"]');
      if (inp) token = inp.value;
    }

    // 3. ASP.NET_SessionId cookie tekshirish
    let sessionId = '';
    const cookieMatch = document.cookie.match(/ASP\.NET_SessionId=([^;]+)/);
    if (cookieMatch && cookieMatch[1]) {
      sessionId = cookieMatch[1].trim();
    }

    let profileChanged = false;
    if (token && token !== currentProfile.loginBilgi) {
      currentProfile.loginBilgi = token;
      profileChanged = true;
    }
    if (detectedName && detectedName.trim() !== currentProfile.fullName) {
      currentProfile.fullName = detectedName.trim();
      profileChanged = true;
    }
    if (detectedLogin && detectedLogin !== currentProfile.username) {
      currentProfile.username = detectedLogin;
      profileChanged = true;
    }
    if (sessionId && sessionId !== currentProfile.sessionId) {
      currentProfile.sessionId = sessionId;
      profileChanged = true;
    }

    // Foydalanuvchi yoki sessiya kaliti o'zgarganda zudlik bilan snapshot yuborish
    if (profileChanged) {
      window.postMessage({
        source: 'KARMED_MONITOR_PAGE',
        type: 'USER_SNAPSHOT_DETECTED',
        data: {
          username: currentProfile.username || 'R5',
          fullName: currentProfile.fullName || 'Pazliyev Sardor',
          loginBilgi: currentProfile.loginBilgi || '',
          sessionId: currentProfile.sessionId || '',
          url: window.location.href,
          timestamp: new Date().toISOString()
        }
      }, '*');
    }

    // 3. Manzil o'zgarishini kuzatish (URL Navigation)
    if (window.location.href !== lastDispatchedUrl) {
      lastDispatchedUrl = window.location.href;
      dispatchToContentScript({
        id: generateReqId(),
        transport: 'navigation',
        stage: 'completed',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        method: 'NAVIGATE',
        status: 200,
        findings: { summaryTag: 'MANZIL: ' + (window.location.pathname || window.location.href) }
      });
    }

    // Agar ma'lumot o'zgargan bo'lsa xabar berish
    window.postMessage({
      source: 'KARMED_MONITOR_PAGE',
      type: 'PROFILE_DETECTED',
      data: currentProfile
    }, '*');
  }

  // Har 3 soniyada profilni tekshirish
  setInterval(checkUserProfile, 3000);
  setTimeout(checkUserProfile, 1000);

  function dispatchToContentScript(eventPayload) {
    try {
      window.postMessage({
        source: 'KARMED_MONITOR_PAGE',
        type: 'NETWORK_EVENT',
        data: {
          ...eventPayload,
          profile: currentProfile
        }
      }, '*');
    } catch (e) {
      console.warn('[Karmed Monitor] postMessage xatosi:', e);
    }
  }

  // 1. FETCH HOOK
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const reqId = generateReqId();
    const startTime = performance.now();
    const timestamp = new Date().toISOString();

    let url = '';
    let method = 'GET';
    let reqHeaders = {};
    let reqBody = null;

    try {
      if (typeof args[0] === 'string') {
        url = args[0];
      } else if (args[0] && args[0].url) {
        url = args[0].url;
        method = args[0].method || 'GET';
      }

      if (args[1]) {
        if (args[1].method) method = args[1].method.toUpperCase();
        if (args[1].headers) {
          if (args[1].headers instanceof Headers) {
            args[1].headers.forEach((v, k) => reqHeaders[k] = v);
          } else if (typeof args[1].headers === 'object') {
            reqHeaders = { ...args[1].headers };
          }
        }
        if (args[1].body) {
          reqBody = safeStringify(args[1].body);
        }
      }
    } catch (err) {}

    // Check for token inside body
    if (reqBody && typeof reqBody === 'string' && reqBody.includes('hdnKrmdLoginBilgi=')) {
      const m = reqBody.match(/hdnKrmdLoginBilgi=([^&]+)/);
      if (m && m[1]) currentProfile.loginBilgi = decodeURIComponent(m[1]);
    }

    try {
      const response = await origFetch.apply(this, args);
      const durationMs = Math.round(performance.now() - startTime);

      const clone = response.clone();
      let resHeaders = {};
      try { clone.headers.forEach((val, key) => { resHeaders[key] = val; }); } catch (e) {}

      clone.text().then(bodyText => {
        // Response dan yangi token chiqsa darhol saqlash va sinxronlash
        if (bodyText && bodyText.includes('App.hdnKrmdLoginBilgi.setValue(')) {
          const tm = bodyText.match(/App\.hdnKrmdLoginBilgi\.setValue\([\\\"\']*([A-Za-z0-9%_+\-\/=]{40,})[\\\"\']*\)/);
          if (tm && tm[1]) {
            currentProfile.loginBilgi = tm[1];
            try {
              window.postMessage({
                source: 'KARMED_MONITOR_PAGE',
                type: 'PROFILE_DETECTED',
                data: currentProfile
              }, '*');
            } catch (e) {}
          }
        }

        dispatchToContentScript({
          id: reqId,
          transport: 'fetch',
          stage: 'completed',
          timestamp,
          durationMs,
          url,
          method,
          status: response.status,
          statusText: response.statusText,
          requestHeaders: reqHeaders,
          requestBody: reqBody,
          responseHeaders: resHeaders,
          responseBody: safeStringify(bodyText)
        });
      }).catch(() => {});

      return response;
    } catch (fetchErr) {
      const durationMs = Math.round(performance.now() - startTime);
      dispatchToContentScript({
        id: reqId,
        transport: 'fetch',
        stage: 'error',
        timestamp,
        durationMs,
        url,
        method,
        error: fetchErr.message,
        requestHeaders: reqHeaders,
        requestBody: reqBody
      });
      throw fetchErr;
    }
  };

  // 2. XMLHTTPREQUEST HOOK
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  const origSetHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__karmedReqId = generateReqId();
    this.__karmedMethod = (method || 'GET').toUpperCase();
    this.__karmedUrl = String(url);
    this.__karmedHeaders = {};
    this.__karmedStartTime = performance.now();
    this.__karmedTimestamp = new Date().toISOString();
    return origOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    if (!this.__karmedHeaders) this.__karmedHeaders = {};
    this.__karmedHeaders[header] = value;
    return origSetHeader.call(this, header, value);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const reqId = this.__karmedReqId || generateReqId();
    const method = this.__karmedMethod || 'GET';
    const url = this.__karmedUrl || '';
    const reqHeaders = this.__karmedHeaders || {};
    const reqBody = safeStringify(body);
    const startTime = this.__karmedStartTime || performance.now();
    const timestamp = this.__karmedTimestamp || new Date().toISOString();

    if (reqBody && typeof reqBody === 'string' && reqBody.includes('hdnKrmdLoginBilgi=')) {
      const m = reqBody.match(/hdnKrmdLoginBilgi=([^&]+)/);
      if (m && m[1]) currentProfile.loginBilgi = decodeURIComponent(m[1]);
    }

    const onFinish = () => {
      if (this.__karmedCompleted) return;
      this.__karmedCompleted = true;
      const durationMs = Math.round(performance.now() - startTime);

      let resHeaders = {};
      try { resHeaders = parseHeaders(this.getAllResponseHeaders()); } catch (e) {}

      let resBody = '';
      try { resBody = safeStringify(this.responseText); } catch (e) {}

      if (resBody && resBody.includes('App.hdnKrmdLoginBilgi.setValue(')) {
        const tm = resBody.match(/App\.hdnKrmdLoginBilgi\.setValue\([\\\"\']*([A-Za-z0-9%_+\-\/=]{40,})[\\\"\']*\)/);
        if (tm && tm[1]) {
          currentProfile.loginBilgi = tm[1];
          try {
            window.postMessage({
              source: 'KARMED_MONITOR_PAGE',
              type: 'PROFILE_DETECTED',
              data: currentProfile
            }, '*');
          } catch (e) {}
        }
      }

      dispatchToContentScript({
        id: reqId,
        transport: 'xhr',
        stage: 'completed',
        timestamp,
        durationMs,
        url,
        method,
        status: this.status,
        statusText: this.statusText,
        requestHeaders: reqHeaders,
        requestBody: reqBody,
        responseHeaders: resHeaders,
        responseBody: resBody
      });
    };

    this.addEventListener('load', onFinish);
    this.addEventListener('error', onFinish);
    return origSend.call(this, body);
  };

  // 3. REPLAY & AUTO-FETCH LISTENER
  window.addEventListener('message', async (e) => {
    if (!e.data || e.data.source !== 'KARMED_CONTENT_SCRIPT') return;

    if (e.data.action === 'EXECUTE_PAGE_FETCH') {
      const { replayId, url, method, headers, body } = e.data;
      try {
        const res = await origFetch(url, {
          method: method || 'GET',
          headers: headers || {},
          credentials: 'include',
          body: (body && method !== 'GET') ? body : undefined
        });
        const text = await res.text();
        window.postMessage({
          source: 'KARMED_MONITOR_PAGE',
          type: 'REPLAY_RESPONSE',
          replayId,
          status: res.status,
          responseBody: text
        }, '*');
      } catch (err) {
        window.postMessage({
          source: 'KARMED_MONITOR_PAGE',
          type: 'REPLAY_RESPONSE',
          replayId,
          error: err.message
        }, '*');
      }
    }
  });

})();
