/**
 * INTERCEPTOR.JS - MAIN WORLD BACKGROUND REQUEST SNIFFER & DISPATCHER
 * 
 * Ushbu fayl sahifaning asosiy (MAIN) kontekstida ishlaydi:
 * 1. Karmed [Ok] bosilganda qaysi so'rov yoki DevExpress Callback'i ketishini avtomatik ushlab oladi.
 * 2. Ushlangan shablonni xotirada saqlaydi.
 * 3. Keyingi barcha biriktirishlarni 0.05 soniyada to'g'ridan-to'g'ri orqa fonda bajaradi!
 */

(function () {
  if (window.__karmedInterceptorLoaded) return;
  window.__karmedInterceptorLoaded = true;

  console.log('%c[Karmed Interceptor]%c Orqa fon so\'rovlarini kuzatuvchi tayyor (MAIN WORLD).', 'color:#2563eb;font-weight:bold;', 'color:auto;');

  // Barcha vrachlarning kodlari
  const DOCTOR_KODS = ["13", "15", "16", "18", "17", "19", "32", "14", "35", "33"];

  let activeTemplate = null;
  let expectingAssignUntil = 0;
  let expectedDoctorKod = null;
  let expectedDocInfo = null;

  // Xotiradan oldingi shablonni yuklash
  try {
    const saved = localStorage.getItem('__karmed_direct_assign_template');
    if (saved) {
      activeTemplate = JSON.parse(saved);
      console.log('[Karmed Interceptor] Saqlangan shablon yuklandi:', activeTemplate.type, activeTemplate.matchedKod);
    }
  } catch (e) {}

  // 1. DEVEXPRESS CALLBACKLARINI HOOK QILISH
  hookDevExpressCallbacks();

  // 2. XHR VA FETCH SO'ROVLARINI HOOK QILISH
  hookNetworkRequests();

  // 3. CONTENT SCRIPT BILAN ALOQA (POSTMESSAGE)
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;

    // Status tekshirish
    if (event.data.type === 'KARMED_CHECK_STATUS') {
      window.postMessage({
        type: 'KARMED_STATUS_RESPONSE',
        hasTemplate: !!activeTemplate,
        template: activeTemplate
      }, '*');
    }

    // Shablonni tozalash (qayta o'rganish)
    if (event.data.type === 'KARMED_RESET_TEMPLATE') {
      activeTemplate = null;
      try { localStorage.removeItem('__karmed_direct_assign_template'); } catch(e){}
      console.log('[Karmed Interceptor] Shablon tozalandi.');
      window.postMessage({ type: 'KARMED_TEMPLATE_RESET_DONE' }, '*');
    }

    // UI orqali [Ok] bosilishi kutilmoqda (aniq ushlash rejimi)
    if (event.data.type === 'KARMED_EXPECT_ASSIGN_REQUEST') {
      expectingAssignUntil = Date.now() + 5000;
      expectedDoctorKod = String(event.data.kod || '');
      expectedDocInfo = event.data.doc || null;
      console.log('[Karmed Interceptor] [Ok] so\'rovi kutilmoqda... Kod:', expectedDoctorKod);
    }

    // Orqa fonda to'g'ridan-to'g'ri biriktirish buyrug'i
    if (event.data.type === 'KARMED_TRIGGER_DIRECT_ASSIGN') {
      const { kod, docInfo, rowInfo } = event.data;
      executeDirectAssign(String(kod), docInfo, rowInfo);
    }
  });

  // ==========================================
  // DEVEXPRESS CALLBACKLARINI HOOK QILISH
  // ==========================================
  function hookDevExpressCallbacks() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      let anyHooked = false;

      // ASPxClientGridView
      if (window.ASPxClientGridView && ASPxClientGridView.prototype && !ASPxClientGridView.prototype.__karmedHooked) {
        ASPxClientGridView.prototype.__karmedHooked = true;
        anyHooked = true;
        const origGridCallback = ASPxClientGridView.prototype.PerformCallback;
        ASPxClientGridView.prototype.PerformCallback = function (args, onComplete) {
          inspectDevExpressCallback(this, args);
          return origGridCallback.call(this, args, onComplete);
        };
      }

      // ASPxClientCallbackPanel
      if (window.ASPxClientCallbackPanel && ASPxClientCallbackPanel.prototype && !ASPxClientCallbackPanel.prototype.__karmedHooked) {
        ASPxClientCallbackPanel.prototype.__karmedHooked = true;
        anyHooked = true;
        const origPanelCallback = ASPxClientCallbackPanel.prototype.PerformCallback;
        ASPxClientCallbackPanel.prototype.PerformCallback = function (args, onComplete) {
          inspectDevExpressCallback(this, args);
          return origPanelCallback.call(this, args, onComplete);
        };
      }

      // ASPxClientCallback
      if (window.ASPxClientCallback && ASPxClientCallback.prototype && !ASPxClientCallback.prototype.__karmedHooked) {
        ASPxClientCallback.prototype.__karmedHooked = true;
        anyHooked = true;
        const origCallback = ASPxClientCallback.prototype.SendCallback;
        ASPxClientCallback.prototype.SendCallback = function (param, onComplete) {
          inspectDevExpressCallback(this, param);
          return origCallback.call(this, param, onComplete);
        };
      }

      // ASPxClientPopupControl
      if (window.ASPxClientPopupControl && ASPxClientPopupControl.prototype && !ASPxClientPopupControl.prototype.__karmedHooked) {
        ASPxClientPopupControl.prototype.__karmedHooked = true;
        anyHooked = true;
        const origPopupCallback = ASPxClientPopupControl.prototype.PerformCallback;
        if (origPopupCallback) {
          ASPxClientPopupControl.prototype.PerformCallback = function (args, onComplete) {
            inspectDevExpressCallback(this, args);
            return origPopupCallback.call(this, args, onComplete);
          };
        }
      }

      // WebForm_DoCallback
      if (window.WebForm_DoCallback && !window.WebForm_DoCallback.__karmedHooked) {
        const origWebFormCb = window.WebForm_DoCallback;
        window.WebForm_DoCallback = function (eventTarget, eventArgument, eventCallback, context, errorCallback, useAsync) {
          inspectDevExpressCallback({ name: eventTarget }, eventArgument);
          return origWebFormCb.apply(this, arguments);
        };
        window.WebForm_DoCallback.__karmedHooked = true;
        anyHooked = true;
      }

      if (anyHooked || attempts > 60) {
        if (attempts > 60) clearInterval(interval);
      }
    }, 250);
  }

  function inspectDevExpressCallback(control, args) {
    if (!args) return;
    const strArgs = String(args);
    const ctrlName = control ? (control.name || control.id || '') : '';
    console.log('[Karmed Callback]', ctrlName, strArgs);

    const isExpected = Date.now() < expectingAssignUntil && expectedDoctorKod;
    const checkKods = isExpected ? [expectedDoctorKod] : DOCTOR_KODS;

    for (const kod of checkKods) {
      if (isKodInString(strArgs, kod)) {
        console.log('%c[Karmed Interceptor]%c DevExpress Callback shabloni ushlandi! Kod:', 'color:#16a34a;font-weight:bold;', 'color:auto;', kod, ctrlName);
        const template = {
          type: 'DEVEXPRESS_CALLBACK',
          controlName: ctrlName,
          pattern: strArgs,
          matchedKod: kod,
          capturedAt: Date.now(),
          context: getActiveDevExpressContext()
        };
        saveTemplate(template);
        expectingAssignUntil = 0;
        break;
      }
    }
  }

  // ==========================================
  // XHR VA FETCH SO'ROVLARINI HOOK QILISH
  // ==========================================
  function hookNetworkRequests() {
    // 1. XMLHttpRequest
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    const origSetReqHeader = XMLHttpRequest.prototype.setRequestHeader;

    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      this.__karmedMethod = method;
      this.__karmedUrl = url;
      this.__karmedHeaders = {};
      return origOpen.call(this, method, url, ...rest);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
      if (this.__karmedHeaders) {
        this.__karmedHeaders[header] = value;
      }
      return origSetReqHeader.call(this, header, value);
    };

    XMLHttpRequest.prototype.send = function (body) {
      try {
        inspectHttpPayload(this.__karmedMethod, this.__karmedUrl, body, this.__karmedHeaders);
      } catch (e) {}
      return origSend.call(this, body);
    };

    // 2. Fetch
    const origFetch = window.fetch;
    window.fetch = function (resource, init) {
      try {
        const url = typeof resource === 'string' ? resource : (resource.url || '');
        const method = (init && init.method) || 'GET';
        const body = init && init.body;
        inspectHttpPayload(method, url, body, init && init.headers);
      } catch (e) {}
      return origFetch.apply(this, arguments);
    };
  }

  function inspectHttpPayload(method, url, body, headers) {
    if (!body || method !== 'POST') return;
    const strBody = typeof body === 'string' ? body : (body instanceof FormData ? formDataToString(body) : (body instanceof URLSearchParams ? body.toString() : ''));
    if (!strBody) return;

    const isAltBolumuDegistir = (url && url.includes('AltBolumuDegistir')) || (headers && (headers['Action'] === 'AltBolumuDegistir' || headers['action'] === 'AltBolumuDegistir'));
    const isExpected = Date.now() < expectingAssignUntil && expectedDoctorKod;
    const checkKods = isExpected ? [expectedDoctorKod] : DOCTOR_KODS;

    let detectedKod = null;
    for (const kod of checkKods) {
      if (isKodInString(strBody, kod)) {
        detectedKod = kod;
        break;
      }
    }

    if (isAltBolumuDegistir || detectedKod) {
      const kodToUse = detectedKod || expectedDoctorKod || '35';
      console.log('%c[Karmed Interceptor]%c AltBolumuDegistir / Vrach biriktirish so\'rovi ushlandi! Kod:', 'color:#16a34a;font-weight:bold;', 'color:auto;', kodToUse, url);
      const template = {
        type: 'HTTP_POST',
        url: url || window.location.href,
        method: 'POST',
        bodyPattern: strBody,
        matchedKod: kodToUse,
        headers: headers || {},
        capturedAt: Date.now(),
        context: getActiveDevExpressContext()
      };
      saveTemplate(template);
      expectingAssignUntil = 0;
    }
  }

  function isKodInString(str, kod) {
    if (!str || !kod) return false;
    const regex = new RegExp(`(=|;|:|\\||"|'|%3b|%3B|%7c|,|^)${kod}(=|;|:|\\||"|'|%3b|%3B|%7c|&|,|$)`, 'i');
    return regex.test(str);
  }

  function replaceTokenInString(text, oldToken, newToken) {
    if (!text || !oldToken || !newToken) return text;
    const regex = new RegExp(`(=|;|:|\\||"|'|%3b|%3B|%7c|,|^)${oldToken}(=|;|:|\\||"|'|%3b|%3B|%7c|&|,|$)`, 'gi');
    return text.replace(regex, `$1${newToken}$2`);
  }

  function formDataToString(fd) {
    const pairs = [];
    for (const [key, val] of fd.entries()) {
      pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(val));
    }
    return pairs.join('&');
  }

  function saveTemplate(template) {
    activeTemplate = template;
    try {
      localStorage.setItem('__karmed_direct_assign_template', JSON.stringify(template));
    } catch (e) {}

    window.postMessage({
      type: 'KARMED_TEMPLATE_CAPTURED',
      template: template
    }, '*');
  }

  function getActiveDevExpressContext() {
    const ctx = {
      focusedRowKeys: {},
      focusedRowIndices: {}
    };
    try {
      if (window.ASPxClientControl) {
        const coll = ASPxClientControl.GetControlCollection();
        if (coll) {
          coll.ForEachControl(function (c) {
            if (c && c.name && typeof c.GetFocusedRowIndex === 'function') {
              const idx = c.GetFocusedRowIndex();
              ctx.focusedRowIndices[c.name] = idx;
              if (typeof c.GetRowKey === 'function' && idx >= 0) {
                try {
                  ctx.focusedRowKeys[c.name] = c.GetRowKey(idx);
                } catch(e){}
              }
            }
          });
        }
      }
    } catch (e) {}
    return ctx;
  }

  // ==========================================
  // TO'G'RIDAN-TO'G'RI ORQA FONDA BIRIKTIRISH
  // ==========================================
  async function executeDirectAssign(newKod, docInfo, rowInfo) {
    console.log('[Karmed Interceptor] Orqa fonda biriktirish boshlandi. Yangi Kod:', newKod);
    const startTime = performance.now();

    try {
      if (!activeTemplate) {
        window.postMessage({ type: 'KARMED_DIRECT_FAILED', reason: 'NO_TEMPLATE' }, '*');
        return;
      }

      const currentCtx = getActiveDevExpressContext();

      // 1-USUL: DevExpress Callback orqali
      if (activeTemplate.type === 'DEVEXPRESS_CALLBACK' && activeTemplate.controlName) {
        let ctrl = null;
        if (window.ASPxClientControl) {
          ctrl = ASPxClientControl.GetControlCollection().GetByName(activeTemplate.controlName);
        }
        if (!ctrl && window[activeTemplate.controlName]) {
          ctrl = window[activeTemplate.controlName];
        }

        if (ctrl && typeof ctrl.PerformCallback === 'function') {
          let newArgs = replaceTokenInString(activeTemplate.pattern, activeTemplate.matchedKod, newKod);

          // Agar oldingi va hozirgi qator kaliti o'zgargan bo'lsa
          if (activeTemplate.context && activeTemplate.context.focusedRowKeys && currentCtx.focusedRowKeys) {
            for (const [gridName, oldKey] of Object.entries(activeTemplate.context.focusedRowKeys)) {
              const currentKey = currentCtx.focusedRowKeys[gridName];
              if (oldKey && currentKey && oldKey !== currentKey) {
                newArgs = replaceTokenInString(newArgs, String(oldKey), String(currentKey));
              }
            }
          }

          ctrl.PerformCallback(newArgs);

          const duration = Math.round(performance.now() - startTime);
          console.log('%c[Karmed Interceptor]%c DevExpress Callback muvaffaqiyatli yuborildi! (' + duration + 'ms)', 'color:#16a34a;font-weight:bold;', 'color:auto;');

          setTimeout(refreshMainGrid, 300);

          window.postMessage({
            type: 'KARMED_DIRECT_SUCCESS',
            kod: newKod,
            docInfo: docInfo,
            duration: duration
          }, '*');
          return;
        }
      }

      // 2-USUL: To'g'ridan-to'g'ri HTTP POST orqali
      if (activeTemplate.type === 'HTTP_POST' || activeTemplate.bodyPattern) {
        let body = activeTemplate.bodyPattern;

        // Yangi VIEWSTATE olish
        const vsEl = document.getElementById('__VIEWSTATE');
        if (vsEl && vsEl.value) {
          body = body.replace(/__VIEWSTATE=[^&]*/, '__VIEWSTATE=' + encodeURIComponent(vsEl.value));
        }
        const evEl = document.getElementById('__EVENTVALIDATION');
        if (evEl && evEl.value) {
          body = body.replace(/__EVENTVALIDATION=[^&]*/, '__EVENTVALIDATION=' + encodeURIComponent(evEl.value));
        }

        // Vrach kodini almashtirish
        body = replaceTokenInString(body, activeTemplate.matchedKod, newKod);

        // Agar qator kaliti o'zgargan bo'lsa
        if (activeTemplate.context && activeTemplate.context.focusedRowKeys && currentCtx.focusedRowKeys) {
          for (const [gridName, oldKey] of Object.entries(activeTemplate.context.focusedRowKeys)) {
            const currentKey = currentCtx.focusedRowKeys[gridName];
            if (oldKey && currentKey && oldKey !== currentKey) {
              body = replaceTokenInString(body, String(oldKey), String(currentKey));
            }
          }
        }

        // So'rovni jo'natish
        const response = await fetch(activeTemplate.url || window.location.href, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: body
        });

        if (response.ok) {
          const duration = Math.round(performance.now() - startTime);
          console.log('%c[Karmed Interceptor]%c HTTP POST muvaffaqiyatli yuborildi! (' + duration + 'ms)', 'color:#16a34a;font-weight:bold;', 'color:auto;');

          setTimeout(refreshMainGrid, 300);

          window.postMessage({
            type: 'KARMED_DIRECT_SUCCESS',
            kod: newKod,
            docInfo: docInfo,
            duration: duration
          }, '*');
          return;
        }
      }

      window.postMessage({ type: 'KARMED_DIRECT_FAILED', reason: 'EXECUTION_FAILED' }, '*');
    } catch (err) {
      console.error('[Karmed Direct Assign Error]:', err);
      window.postMessage({ type: 'KARMED_DIRECT_FAILED', reason: err.message }, '*');
    }
  }

  function refreshMainGrid() {
    try {
      if (window.ASPxClientControl) {
        const coll = ASPxClientControl.GetControlCollection();
        if (coll) {
          coll.ForEachControl(function (ctrl) {
            if (ctrl && typeof ctrl.Refresh === 'function') {
              try { ctrl.Refresh(); } catch(e){}
            }
          });
        }
      }
    } catch (e) {}
  }
})();
