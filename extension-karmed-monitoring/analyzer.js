/**
 * KARMED MONITORING - ANALYZER ENGINE
 * Ushbu modul har bir tarmoq so'rovini tekshirib, unda:
 * - Avtorizatsiya (Login, Cookies, Session, Token)
 * - Bemorlar Ro'yxati (Patient List / Queue)
 * - Vrach va Bo'lim filtrlari
 * bor-yo'qligini avtomatik aniqlaydi.
 */
const KarmedAnalyzer = {
  
  // So'rovni tahlil qilish
  analyzeRequest(req) {
    const findings = {
      isAuth: false,
      isPatientList: false,
      isDoctorAssign: false,
      authDetails: null,
      patientDetails: null,
      extractedParams: {},
      summaryTag: 'Oddiy So\'rov'
    };

    const urlLower = (req.url || '').toLowerCase();
    const bodyStr = typeof req.requestBody === 'string' ? req.requestBody : JSON.stringify(req.requestBody || '');
    const resStr = typeof req.responseBody === 'string' ? req.responseBody : JSON.stringify(req.responseBody || '');

    // 1. AVTORIZATSIYA TAHLILI
    const authKeywords = ['login', 'giris', 'auth', 'signin', 'kullanici', 'parola', 'sifre', 'token', 'session'];
    const hasAuthUrl = authKeywords.some(k => urlLower.includes(k));
    const hasAuthBody = authKeywords.some(k => bodyStr.toLowerCase().includes(k));
    const hasAuthHeaders = req.requestHeaders && (req.requestHeaders['authorization'] || req.requestHeaders['token']);
    const hasAuthCookie = req.responseHeaders && (req.responseHeaders['set-cookie'] || '').includes('ASP.NET_SessionId');

    if (hasAuthUrl || hasAuthBody || hasAuthHeaders || hasAuthCookie) {
      findings.isAuth = true;
      findings.summaryTag = '🔑 Avtorizatsiya';
      findings.authDetails = {
        endpoint: req.url,
        method: req.method,
        hasSessionCookie: hasAuthCookie,
        hasAuthorizationHeader: !!hasAuthHeaders,
        capturedAt: req.timestamp
      };
    }

    // 2. BEMORLAR RO'YXATI TAHLILI
    const patientKeywords = [
      'hasta', 'bemor', 'protokol', 'randevu', 'poliklinik', 
      'bekleyen', 'kayit', 'tckimlik', 'doktor', 'altbolum',
      'gelen hastalar', 'kabul', 'sirano', 'navbat'
    ];

    const matchCountUrl = patientKeywords.filter(k => urlLower.includes(k)).length;
    const matchCountRes = patientKeywords.filter(k => resStr.toLowerCase().includes(k)).length;

    // Response ichida bemorlar ro'yxati bormi?
    if (matchCountRes >= 2 || (matchCountUrl >= 1 && resStr.length > 500)) {
      findings.isPatientList = true;
      findings.summaryTag = '📋 Bemorlar Ro\'yxati';

      // Taxminiy bemorlar soni
      let estimatedCount = 0;
      const protokolMatches = resStr.match(/protokol/gi) || [];
      const hastaMatches = resStr.match(/hasta/gi) || [];
      estimatedCount = Math.max(protokolMatches.length, hastaMatches.length);

      // Sana yoki filtr parametrlari qidirish
      const dateMatch = (bodyStr + ' ' + req.url).match(/(\d{2}[.\/-]\d{2}[.\/-]\d{4})/g);

      findings.patientDetails = {
        endpoint: req.url,
        method: req.method,
        estimatedPatients: estimatedCount,
        responseSizeKB: (resStr.length / 1024).toFixed(1),
        detectedDate: dateMatch ? dateMatch[0] : 'Noma\'lum',
        capturedAt: req.timestamp,
        replayPayload: {
          url: req.url,
          method: req.method,
          headers: req.requestHeaders,
          body: req.requestBody
        }
      };
    }

    // 3. VRACH BIRIKTIRISH TAHLILI
    if (urlLower.includes('doktor') || bodyStr.includes('Doktor') || bodyStr.includes('AltBolum') || req.callbackArgs) {
      if (!findings.isPatientList) {
        findings.isDoctorAssign = true;
        findings.summaryTag = '👨‍⚕️ Vrach/Bo\'lim';
      }
    }

    return findings;
  },

  // cURL buyrug'i shakllantirish
  generateCurl(req) {
    const parts = ['curl'];
    parts.push(`-X ${req.method || 'GET'}`);
    parts.push(`"${req.url}"`);

    if (req.requestHeaders) {
      Object.entries(req.requestHeaders).forEach(([k, v]) => {
        parts.push(`-H "${k}: ${v}"`);
      });
    }

    if (req.requestBody && req.method !== 'GET') {
      const cleanBody = typeof req.requestBody === 'string' ? req.requestBody : JSON.stringify(req.requestBody);
      parts.push(`--data-raw '${cleanBody.replace(/'/g, "\\'")}'`);
    }

    return parts.join(' \
  ');
  },

  // JavaScript Fetch kodi shakllantirish
  generateFetch(req) {
    const opts = {
      method: req.method || 'GET',
      headers: req.requestHeaders || {}
    };
    if (req.requestBody && req.method !== 'GET') {
      opts.body = req.requestBody;
    }
    return `fetch("${req.url}", ${JSON.stringify(opts, null, 2)});`;
  }
};

window.KarmedAnalyzer = KarmedAnalyzer;
