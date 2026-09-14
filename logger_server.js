/**
 * KARMED RADIOLOGY UTT NAVBAT VA KUNLIK LOGGER SERVER (v7.1.0)
 * 
 * Portlar Arxitekturasi:
 * - 9876: Registrator Posti & Asosiy Boshqaruv (index.html, statistika, to'liq boshqaruv)
 * - 9877: TV Jonli Monitor Ekrani (tv.html, yirik shriftlar, chaqiruv ovozi va popuplari)
 * - 9878: Vrach Qabulxona Profili (doctor.html, U0-U9 login, chaqirish/yakunlash boshqaruvi)
 * - 9879: Bemorlar Portali (patient.html, ID/Ism bo'yicha qidirish, navbat va chaqiruv holati)
 * - 9880: Admin Dashborti (barcha harakatlar monitori)
 * - 9881: 🎯 UTT Mobil Agenti
 * - 9882: ⚡ MSKT Mobil Agenti
 * - 9883: 🧲 MRT Mobil Agenti
 * 
 * Imkoniyatlar:
 * 1. Kunlik Dinamik Log: Log/<DD.MM.YYYY>/logger.me papka va faylini avtomatik yaratish.
 * 2. Karmed Direct Master Sync (v5.0.0): Karmed serveridan har 20 soniyada navbatni mustaqil olish.
 * 3. Destructive Overwrite Guard: Kengaytmadagi 1-2 kishilik qidiruv TV navbatini o'chirishini taqiqlash.
 * 4. Shifokorlar Avtorizatsiyasi: U0..U9, standart parol 15420, parolni o'zgartirish (data/doctors_auth.json).
 * 5. Xonalarga ajratilgan chaqiruv tizimi: Faqat o'z xonasidagi bemorlarni chaqirish va yakunlash.
 * 6. Server-Sent Events (SSE) orqali barcha 8 ta portdagi ekranlarni soniyada yangilab turish.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const adminAnalytics = require('./lib/admin-analytics');

// PORTLAR (JAMI 8 TA PORT: ASOSIY + 3 TA MAXSUS MOBIL AGENT)
const PORT_REGISTRATOR = 9876;
const PORT_TV = 9877;
const PORT_DOCTOR = 9878;
const PORT_PATIENT = 9879;
const PORT_ADMIN = 9880;
const PORT_MOBILE_UTT = 9881;    // 🎯 UTT Mobil Agenti
const PORT_MOBILE_MSKT = 9882;   // ⚡ MSKT Mobil Agenti
const PORT_MOBILE_MRT = 9883;    // 🧲 MRT Mobil Agenti
const PORT_MOBILE_AGENT = 9881;  // Umumiy moslik uchun
const HOST = '0.0.0.0';

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const AUTH_FILE = path.join(ROOT_DIR, 'data', 'doctors_auth.json');
const PROFILES_FILE = path.join(ROOT_DIR, 'data', 'karmed_profiles.json');
const AGENT_AUTH_FILE = path.join(ROOT_DIR, 'data', 'agent_auth.json');

// Mobil Agent Autentifikatsiya foydalanuvchilarini olish (R5 va boshqalar)
function getAgentAuthUsers() {
  try {
    if (fs.existsSync(AGENT_AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AGENT_AUTH_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    "R5": { username: "R5", password: "17720", fullName: "Pazliyev Sardor", role: "Registrator / Mobil Agent Admin" }
  };
}

// Xotiradagi faol mobil sessiyalar
const activeAgentSessions = new Map();

// Universal Karmed Login Bilgi Token ajratish funksiyasi (barcha javoblardan)
function extractKarmedLoginBilgi(str) {
  if (!str || typeof str !== 'string') return null;
  const m = str.match(/App\.hdnKrmdLoginBilgi\.setValue\([\\\"\']*([A-Za-z0-9%_+\-\/=]{40,})[\\\"\']*\)/);
  if (m && m[1]) return m[1];
  if (str.includes('hdnKrmdLoginBilgi=')) {
    const m2 = str.match(/hdnKrmdLoginBilgi=([^&\"\'\s]+)/);
    if (m2 && m2[1]) return decodeURIComponent(m2[1]);
  }
  return null;
}

// Karmed Foydalanuvchilar Profillari (R5 va boshqalar)
function getKarmedProfiles() {
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      return JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('[Profiles Read Error]:', e);
  }
  return {};
}

function saveKarmedProfile(profile) {
  if (!profile || !profile.username) return null;
  try {
    const profiles = getKarmedProfiles();
    const uname = String(profile.username).trim().toUpperCase();
    const existing = profiles[uname] || {};
    profiles[uname] = {
      ...existing,
      username: uname,
      fullName: profile.fullName || existing.fullName || ('Foydalanuvchi (' + uname + ')'),
      loginBilgi: profile.loginBilgi || existing.loginBilgi || '',
      cookie: profile.cookie || existing.cookie || '',
      lastSeen: new Date().toISOString(),
      isDefault: uname === 'R5' || existing.isDefault || false
    };
    const dir = path.dirname(PROFILES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2), 'utf8');
    return profiles[uname];
  } catch (e) {
    console.error('[Profiles Save Error]:', e);
    return null;
  }
}

// =========================================================================
// FOYDALANUVCHILAR SESSIYALARI NUSXALARINI SAQLASH (F.I.SH, SessionId, Token)
// =========================================================================
const USERS_HISTORY_FILE = path.join(ROOT_DIR, 'data', 'karmed_users_history.json');
const SESSIONS_DIR = path.join(ROOT_DIR, 'data', 'user_sessions');

function getUserSessionsHistory() {
  try {
    if (fs.existsSync(USERS_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_HISTORY_FILE, 'utf8'));
    }
  } catch (e) {}
  return { lastUpdated: new Date().toISOString(), totalSnapshots: 0, users: {} };
}

function saveUserSessionSnapshot(data) {
  if (!data) return null;
  try {
    const uname = String(data.username || 'R5').trim().toUpperCase();
    const fullName = String(data.fullName || data.name || ('Foydalanuvchi (' + uname + ')')).trim();
    const loginBilgi = data.loginBilgi || '';
    let sessionId = data.sessionId || '';
    const cookie = data.cookie || '';
    if (!sessionId && cookie) {
      const sm = cookie.match(/ASP\.NET_SessionId=([^;]+)/);
      if (sm && sm[1]) sessionId = sm[1].trim();
    }

    const timestamp = new Date().toISOString();
    const snapshotItem = {
      username: uname,
      fullName: fullName,
      sessionId: sessionId,
      loginBilgi: loginBilgi,
      cookie: cookie,
      url: data.url || '',
      source: data.source || 'karmed_monitoring',
      timestamp: timestamp
    };

    // 1. Alohida vaqt tamg'ali nusxa fayliga saqlash (data/user_sessions/)
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    const safeDateStr = timestamp.replace(/[:.]/g, '-');
    const singleFile = path.join(SESSIONS_DIR, `session_${uname}_${safeDateStr}.json`);
    fs.writeFileSync(singleFile, JSON.stringify(snapshotItem, null, 2), 'utf8');

    // 2. Umumiy karmed_users_history.json fayliga jamlash
    const history = getUserSessionsHistory();
    if (!history.users) history.users = {};
    if (!history.users[uname]) {
      history.users[uname] = {
        username: uname,
        fullName: fullName,
        firstSeen: timestamp,
        lastSeen: timestamp,
        lastSessionId: sessionId,
        lastLoginBilgi: loginBilgi,
        snapshotsCount: 0,
        history: []
      };
    }

    const u = history.users[uname];
    u.fullName = fullName || u.fullName;
    u.lastSeen = timestamp;
    if (sessionId) u.lastSessionId = sessionId;
    if (loginBilgi) u.lastLoginBilgi = loginBilgi;
    u.snapshotsCount = (u.snapshotsCount || 0) + 1;
    if (!Array.isArray(u.history)) u.history = [];
    u.history.unshift({
      fullName: fullName,
      sessionId: sessionId,
      loginBilgiSnippet: loginBilgi ? (loginBilgi.slice(0, 35) + '...') : '',
      timestamp: timestamp,
      file: path.basename(singleFile)
    });
    if (u.history.length > 50) u.history = u.history.slice(0, 50);

    history.lastUpdated = timestamp;
    history.totalSnapshots = (history.totalSnapshots || 0) + 1;
    const historyDir = path.dirname(USERS_HISTORY_FILE);
    if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
    fs.writeFileSync(USERS_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');

    return snapshotItem;
  } catch (err) {
    console.error('[Session Snapshot Error]:', err);
    return null;
  }
}

// Doimiy Karmed So'rovlarini faylga qo'shib saqlash (Auto-Save Stream)
function saveAutoSaveTraffic(batch, profile, clientIp) {
  try {
    const { logDir } = getDailyLogInfo();
    const trafficFile = path.join(logDir, 'karmed_traffic.json');
    let trafficData = {
      source: 'KARMED_AUTO_SAVE_STREAM',
      timestamp: new Date().toISOString(),
      totalRequests: 0,
      requests: []
    };

    if (fs.existsSync(trafficFile)) {
      try {
        const loaded = JSON.parse(fs.readFileSync(trafficFile, 'utf8'));
        if (loaded) {
          trafficData = loaded;
          if (!Array.isArray(trafficData.requests)) {
            trafficData.requests = Array.isArray(trafficData.summary) ? trafficData.summary : [];
          }
        }
      } catch (e) {}
    }

    const existingIds = new Set(trafficData.requests.map(r => r.id).filter(Boolean));
    let newCount = 0;

    if (Array.isArray(batch)) {
      batch.forEach(item => {
        if (!item.id || !existingIds.has(item.id)) {
          trafficData.requests.unshift(item);
          if (item.id) existingIds.add(item.id);
          newCount++;
        }

        // Har bir javob yoki so'rovdan hdnKrmdLoginBilgi tokenini o'qib saqlash
        const detectedToken = extractKarmedLoginBilgi(item.responseBody) || extractKarmedLoginBilgi(item.requestBody);
        if (detectedToken) {
          const itemUname = (item.profile && item.profile.username) || (profile && profile.username) || 'R5';
          const itemFullName = (item.profile && item.profile.fullName) || (profile && profile.fullName) || null;
          saveKarmedProfile({
            username: itemUname,
            fullName: itemFullName,
            loginBilgi: detectedToken
          });
        }
      });
    }

    if (trafficData.requests.length > 3000) {
      trafficData.requests = trafficData.requests.slice(0, 3000);
    }
    trafficData.totalRequests = trafficData.requests.length;
    trafficData.lastUpdated = new Date().toISOString();

    fs.writeFileSync(trafficFile, JSON.stringify(trafficData, null, 2), 'utf8');

    if (profile && profile.username && profile.loginBilgi) {
      saveKarmedProfile(profile);
    }

    const uname = profile?.username || 'R5';
    const logMsg = `Karmed-dan ${newCount} ta yangi so'rov avto-saqlandi (Jami: ${trafficData.totalRequests} ta, Profil: ${uname})`;
    recordSystemEvent('KARMED_AUTO_SAVE', logMsg, clientIp, { newCount, total: trafficData.totalRequests, profile: uname });

    return { total: trafficData.totalRequests, newCount };
  } catch (err) {
    console.error('[AutoSave Error]:', err);
    throw err;
  }
}

// Ext.NET JSON javoblarini xavfsiz o'qish
function safeParseExtNetJson(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    try {
      return JSON.parse(str.replace(/\\"/g, '"'));
    } catch (e2) {
      try {
        const clean = str.replace(/new Date\([^)]+\)/g, '"2026-09-09"').replace(/\\"/g, '"');
        return JSON.parse(clean);
      } catch (e3) {
        return null;
      }
    }
  }
}

// Karmed serveriga to'g'ridan-to'g'ri so'rov yuborish
function queryKarmedEndpoint(actionUrl, postData, cookieHeader, callback) {
  if (typeof cookieHeader === 'function') { callback = cookieHeader; cookieHeader = ''; }
  const parsedTarget = new URL('http://192.168.150.111:2025/Radiology/Rbys.aspx' + actionUrl);
  const actName = actionUrl.replace(/^\?action=/, '');
  const reqOpts = {
    hostname: parsedTarget.hostname,
    port: parsedTarget.port || 2025,
    path: parsedTarget.pathname + parsedTarget.search,
    method: 'POST',
    headers: {
      'X-Ext-Net': 'delta=true',
      'action': actName,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'http://192.168.150.111:2025',
      'Referer': 'http://192.168.150.111:2025/Radiology/Rbys.aspx',
      'Content-Length': Buffer.byteLength(postData),
      ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
    },
    timeout: 8000
  };

  const req = http.request(reqOpts, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const extractedToken = extractKarmedLoginBilgi(data);
      if (extractedToken) {
        saveKarmedProfile({ username: 'R5', loginBilgi: extractedToken });
      }
      callback(null, res.statusCode, data);
    });
  });

  req.on('error', (err) => callback(err));
  req.on('timeout', () => {
    req.destroy();
    callback(new Error('Karmed server javob bermadi (timeout 8s)'));
  });

  req.write(postData);
  req.end();
}

// =========================================================================
// KARMED JONLI KIRISH VA AVTORIZATSIYA (Login.aspx -> MakeLogin -> Rbys.aspx)
// =========================================================================
function karmedRawRequest(options, postData = null, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Karmed server javob berish vaqti tugadi (Timeout ' + timeoutMs + 'ms)'));
    });
    if (postData) req.write(postData);
    req.end();
  });
}

async function loginToKarmedLive(username, password) {
  username = String(username).trim().toUpperCase();
  password = String(password).trim();

  // 1. Boshlang'ich GET Login.aspx (ASP.NET_SessionId cookie va yo'naltirish kaliti)
  const r1 = await karmedRawRequest({
    hostname: '192.168.150.111',
    port: 2025,
    path: '/Login/Login.aspx?returnUrl=http://192.168.150.111:2025/Radiology/Rbys.aspx',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const setCookies1 = r1.headers['set-cookie'] || [];
  let cookieStr = setCookies1.map(c => c.split(';')[0]).join('; ');
  let sessionId = '';
  const sm = cookieStr.match(/ASP\.NET_SessionId=([^;]+)/);
  if (sm && sm[1]) sessionId = sm[1].trim();

  const m1 = r1.body.match(/value='([^']+)'/);
  if (!m1) throw new Error("Karmed boshlang'ich yo'naltirish kaliti topilmadi");

  // 2. POST /Karmed/Default.aspx (Token olish)
  const r2 = await karmedRawRequest({
    hostname: '192.168.150.111',
    port: 2025,
    path: '/Karmed/Default.aspx',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength('=' + m1[1]),
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }, '=' + m1[1]);

  const m2 = r2.body.match(/name='token'\s+value='([^']+)'/);
  if (!m2) throw new Error('Karmed token topilmadi');
  const tokenVal = m2[1];

  // 3. POST token to Login.aspx (hdnDataIndexInfo olish)
  const tokenBody = 'token=' + encodeURIComponent(tokenVal);
  const r3 = await karmedRawRequest({
    hostname: '192.168.150.111',
    port: 2025,
    path: '/Login/Login.aspx?returnUrl=http://192.168.150.111:2025/Radiology/Rbys.aspx',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(tokenBody),
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }, tokenBody);

  const mDataIndex = r3.body.match(/id="hdnDataIndexInfo"[^>]*value="([^"]+)"/) || 
                     r3.body.match(/hdnDataIndexInfo[\\\"':,=\s]+([^"&'<>]+)/);
  const dataIndexInfo = mDataIndex ? mDataIndex[1] : '';

  // 4. POST MakeLogin DirectMethod (Karmed live login tekshiruvi)
  const makeLoginParams = new URLSearchParams();
  makeLoginParams.set('submitDirectEventConfig', JSON.stringify({ config: { extraParams: { dataIndex: null } } }));
  makeLoginParams.set('HdnBaseYazdirmaTuru', '-1');
  makeLoginParams.set('__VIEWSTATEGENERATOR', '5E7FB4E4');
  makeLoginParams.set('hdnSmsInfo', '');
  makeLoginParams.set('hdnDataIndexInfo', decodeURIComponent(dataIndexInfo));
  makeLoginParams.set('hdToken', tokenVal);
  makeLoginParams.set('hdReferer', '192.168.150.111');
  makeLoginParams.set('hdCaptchaVisible', 'False');
  makeLoginParams.set('CmbCulture', 'uz-UZ');
  makeLoginParams.set('txtUsername', username);
  makeLoginParams.set('txtPassword', password);
  makeLoginParams.set('cmbData', '');
  makeLoginParams.set('_cmbData_state', '');
  makeLoginParams.set('captchaResim_hdnMyCaptcha', '');
  makeLoginParams.set('captchaResim_hdnCaptchaYenile', 'true');
  makeLoginParams.set('captchaResim$txtCaptcha', '');
  makeLoginParams.set('HdnAlanMesaj', "Iltimos, barcha maydonlarni to'ldiring.");
  makeLoginParams.set('__EVENTTARGET', 'ResLogin');
  makeLoginParams.set('__EVENTARGUMENT', '-|public|MakeLogin');

  const pData = makeLoginParams.toString();
  const r4 = await karmedRawRequest({
    hostname: '192.168.150.111',
    port: 2025,
    path: '/Login/Login.aspx?returnUrl=http%3a%2f%2f192.168.150.111%3a2025%2fRadiology%2fRbys.aspx&action=MakeLogin',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(pData),
      'Cookie': cookieStr,
      'X-Ext-Net': 'delta=true',
      'action': 'MakeLogin',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }, pData);

  if (!r4.body.includes('userInfo')) {
    return {
      success: false,
      reason: 'rejected_by_karmed',
      message: "Karmed tizimi login yoki parolni qabul qilmadi. Foydalanuvchi nomi yoki maxfiy so'z xato!"
    };
  }

  // 5. Muvaffaqiyatli! userInfo ni olib Rbys.aspx ga uzatish
  const mUserInfo = r4.body.match(/name='userInfo'\s+value='([^']+)'/);
  const userInfoVal = mUserInfo ? mUserInfo[1] : '';

  const r5Data = 'userInfo=' + encodeURIComponent(userInfoVal);
  const r5 = await karmedRawRequest({
    hostname: '192.168.150.111',
    port: 2025,
    path: '/Radiology/Rbys.aspx',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(r5Data),
      'Cookie': cookieStr,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }, r5Data);

  if (r5.headers['set-cookie']) {
    const newCookies = r5.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
    cookieStr = cookieStr + '; ' + newCookies;
    const sm2 = cookieStr.match(/ASP\.NET_SessionId=([^;]+)/);
    if (sm2 && sm2[1]) sessionId = sm2[1].trim();
  }

  let loginBilgi = extractKarmedLoginBilgi(r5.body) || '';
  let fullName = '';

  // 6. extnet-init-js orqali haqiqiy F.I.SH va yangi tokenni Karmeddan to'g'ridan-to'g'ri olish
  const mInitScript = r5.body.match(/src="(\/Radiology\/extnet\/extnet-init-js\/ext\.axd\?[^"]+)"/);
  if (mInitScript && mInitScript[1]) {
    try {
      const r6 = await karmedRawRequest({
        hostname: '192.168.150.111',
        port: 2025,
        path: mInitScript[1],
        method: 'GET',
        headers: {
          'Cookie': cookieStr,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (r6 && r6.body) {
        // Haqiqiy Foydalanuvchi F.I.SH ni ajratish (btnKullanici text atributidan)
        const mBtnUser = r6.body.match(/\{id:"btnKullanici"[^}]*text:"([^"]+)"/);
        if (mBtnUser && mBtnUser[1] && mBtnUser[1].trim()) {
          fullName = mBtnUser[1].trim();
        }
        // Yangi hdnKrmdLoginBilgi tokenni ajratish
        const mTok = r6.body.match(/id:"hdnKrmdLoginBilgi"[^}]*value:"([^"]+)"/);
        if (mTok && mTok[1]) {
          loginBilgi = mTok[1];
        }
      }
    } catch (scErr) {
      console.warn('[ExtNet Init Warning] extnet-init-js yuklashda xatolik:', scErr.message);
    }
  }

  if (!loginBilgi) {
    const existingProfiles = getKarmedProfiles();
    if (existingProfiles[username] && existingProfiles[username].loginBilgi) {
      loginBilgi = existingProfiles[username].loginBilgi;
    }
  }

  // Agar extnet-init-js dan topilmagan bo'lsa, Rbys sahifasi yoki zaxira manbalardan tekshirish
  if (!fullName) {
    const mFish = r5.body.match(/id="lblKullaniciAdi"[^>]*>([^<]+)</) ||
                  r5.body.match(/App\.btnKullanici\.setText\("([^"]+)"\)/) ||
                  r5.body.match(/id="btnKullanici"[^>]*>([^<]+)</);
    if (mFish && mFish[1].trim()) fullName = mFish[1].trim();
  }

  if (!fullName) {
    try {
      const histPath = USERS_HISTORY_FILE;
      if (fs.existsSync(histPath)) {
        const h = JSON.parse(fs.readFileSync(histPath, 'utf8'));
        if (h.users && h.users[username] && h.users[username].fullName && !h.users[username].fullName.includes('Foydalanuvchi (')) {
          fullName = h.users[username].fullName;
        }
      }
    } catch(e) {}
  }
  if (!fullName) {
    try {
      const docPath = AUTH_FILE;
      if (fs.existsSync(docPath)) {
        const docs = JSON.parse(fs.readFileSync(docPath, 'utf8'));
        if (docs[username]) fullName = docs[username].doctorName || docs[username].shortName;
      }
    } catch(e) {}
  }
  if (!fullName && username === 'R5') {
    fullName = 'Turatov Hojiakbar Shavkat ogli';
  }
  if (!fullName) {
    fullName = 'Karmed Xodimi (' + username + ')';
  }

  let role = 'Registrator';
  if (/^U\d+$/i.test(username)) {
    role = 'Shifokor';
  } else if (username.startsWith('R')) {
    role = 'Registrator / Navbat Boshqaruvchisi';
  }

  return {
    success: true,
    username: username,
    fullName: fullName,
    role: role,
    sessionId: sessionId,
    loginBilgi: loginBilgi,
    cookie: cookieStr,
    karmedVerified: true
  };
}

// 1. KUNLIK LOG PAPKASI VA FAYLINI ANIQLASH
function getDailyLogInfo() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(now.getDate());
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();
  const dateStr = `${day}.${month}.${year}`;

  const logDir = path.join(ROOT_DIR, 'Log', dateStr);
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
      console.error('[Logger] Papka yaratishda xatolik:', e);
    }
  }

  const logFile = path.join(logDir, 'logger.me');
  return { dateStr, logDir, logFile };
}

function getTimestamp() {
  const d = new Date();
  return d.toISOString().replace('T', ' ').substring(0, 19) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function writeToDailyLog(message) {
  try {
    const { logFile } = getDailyLogInfo();
    const line = `[${getTimestamp()}] ${message}\n`;
    fs.appendFileSync(logFile, line, 'utf8');

    // Root logger.me ga ham dublyaj qilamiz (orqaga moslik uchun)
    const rootLog = path.join(ROOT_DIR, 'logger.me');
    fs.appendFileSync(rootLog, line, 'utf8');
  } catch (e) {
    // EPIPE yoki fayl xatoliklarini tinch o'tkazib yuboramiz
  }
}

// Server boshlang'ich start yozuvi
try {
  const { dateStr, logFile } = getDailyLogInfo();
  const initMsg = `\n================================================================================\n` +
    `[${getTimestamp()}] KARMED UTT NAVBAT VA 4-PORTLI SERVER (v4.0.0) ISHGA TUSHDI\n` +
    `  Sana: ${dateStr} | Fayl: ${logFile}\n` +
    `  Portlar: Registrator: ${PORT_REGISTRATOR} | TV: ${PORT_TV} | Vrach: ${PORT_DOCTOR} | Bemor: ${PORT_PATIENT}\n` +
    `================================================================================\n`;
  fs.appendFileSync(logFile, initMsg, 'utf8');
  console.log(`[Server] Kunlik log fayli tayyor: ${logFile}`);
} catch (e) {
  console.error('[Server Init Error]:', e);
}

// 2. VRACHLAR AVTORIZATSIYA BAZASI (data/doctors_auth.json)
function getDoctorsAuth() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const content = fs.readFileSync(AUTH_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (e) {
    console.error('[Auth Read Error]:', e);
  }
  return {};
}

function saveDoctorsAuth(data) {
  try {
    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[Auth Save Error]:', e);
    return false;
  }
}

// Aktiv sessiyalar (token -> doctor)
const doctorSessions = new Map();

// 3. NAVBAT MA'LUMOTLARI VA AKTIV CHAQIRUVLAR
let activeCalls = {}; // roomKey -> { patientId, queueNo, fullName, registrationTime, roomKey, roomTitle, doctorName, calledAt, status: 'calling' }

let latestQueueData = {
  timestamp: new Date().toISOString(),
  date: getDailyLogInfo().dateStr,
  totalPatients: 0,
  department: "Ultratovush",
  statusFilter: "Bekleyen",
  summary: {
    totalWaiting: 0,
    byDoctor: {}
  },
  doctors: [],
  allPatients: [],
  activeCalls: {}
};

// Agar diskda avvalgi latest_queue.json bo'lsa, o'qiymiz
try {
  const { logDir } = getDailyLogInfo();
  const diskQueueFile = path.join(logDir, 'latest_queue.json');
  const rootQueueFile = path.join(ROOT_DIR, 'latest_queue.json');
  const fileToLoad = fs.existsSync(diskQueueFile) ? diskQueueFile : (fs.existsSync(rootQueueFile) ? rootQueueFile : null);
  if (fileToLoad) {
    const saved = JSON.parse(fs.readFileSync(fileToLoad, 'utf8'));
    if (saved && Array.isArray(saved.doctors)) {
      latestQueueData = saved;
      if (saved.activeCalls) activeCalls = saved.activeCalls;
      console.log(`[Queue] Diskdan saqlangan navbat yuklandi: ${saved.totalPatients || 0} ta bemor`);
    }
  }
} catch (e) {}

function saveQueueToFile(data) {
  try {
    const { logDir } = getDailyLogInfo();
    const dataToSave = { ...data, activeCalls };
    fs.writeFileSync(path.join(logDir, 'latest_queue.json'), JSON.stringify(dataToSave, null, 2), 'utf8');
    fs.writeFileSync(path.join(ROOT_DIR, 'latest_queue.json'), JSON.stringify(dataToSave, null, 2), 'utf8');
  } catch (e) {}
}

// 4. SSE (SERVER-SENT EVENTS) REAL-TIME STREAM
const sseClients = new Set();
const adminSseClients = new Set();
const systemEvents = [];

function recordSystemEvent(type, message, clientIp = '', detail = null) {
  const event = {
    id: 'ev_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
    type,
    message,
    clientIp,
    detail,
    time: new Date().toLocaleTimeString(),
    timestamp: new Date().toISOString()
  };
  systemEvents.push(event);
  if (systemEvents.length > 500) systemEvents.shift();

  // Broadcast to Admin SSE
  const adminPayload = `data: ${JSON.stringify({ type: 'EVENT', event })}\n\n`;
  for (const clientRes of adminSseClients) {
    try {
      clientRes.write(adminPayload);
    } catch (e) {
      adminSseClients.delete(clientRes);
    }
  }
}

function broadcastEvent(payloadObj) {
  const payload = `data: ${JSON.stringify(payloadObj)}\n\n`;
  for (const clientRes of sseClients) {
    try {
      clientRes.write(payload);
    } catch (e) {
      sseClients.delete(clientRes);
    }
  }

  // Also broadcast overview updates to Admin SSE
  const adminPayload = `data: ${JSON.stringify({ type: 'OVERVIEW_UPDATE', ...payloadObj })}\n\n`;
  for (const clientRes of adminSseClients) {
    try {
      clientRes.write(adminPayload);
    } catch (e) {
      adminSseClients.delete(clientRes);
    }
  }
}

// =========================================================================
// TV VA SMART QURILMALAR REAL-TIME MONITORING TIZIMI (v6.0.0)
// =========================================================================
const tvTelemetryLogs = [];

function recordTvEvent(type, clientIp, userAgent, path, status, detail = null) {
  let deviceType = 'Noma\'lum';
  const ua = String(userAgent || '');
  if (/Android.*(TV|LargeScreen|AFT)|AndroidTV|SmartTV|GoogleTV|AFTMM|MIBOX/i.test(ua)) {
    deviceType = '📺 Android TV';
  } else if (/Tizen|Web0S|WebOS|AppleTV|BRAVIA/i.test(ua)) {
    deviceType = '📺 Smart TV (Tizen/WebOS)';
  } else if (/Android.*Mobile|iPhone|iPad/i.test(ua)) {
    deviceType = '📱 Mobil Telefon/Planshet';
  } else if (/Windows|Macintosh|Linux/i.test(ua)) {
    deviceType = '💻 Kompyuter';
  } else {
    deviceType = '📺 TV / Brauzer';
  }

  const logEntry = {
    id: 'tv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    timestamp: new Date().toISOString(),
    time: new Date().toLocaleTimeString(),
    type,
    clientIp: String(clientIp || '').replace(/^::ffff:/, ''),
    userAgent: ua,
    deviceType,
    path: path || '',
    status: status || 200,
    detail
  };

  tvTelemetryLogs.unshift(logEntry);
  if (tvTelemetryLogs.length > 400) tvTelemetryLogs.pop();

  if (type.includes('ERROR') || type === 'TV_CONNECT' || type === 'TV_PAGE_INIT' || type === 'APK_ERROR') {
    console.log(`[TV-MONITOR] [${logEntry.time}] [${deviceType}] ${logEntry.clientIp} -> ${type}: ${logEntry.path} (${status}) ${detail ? JSON.stringify(detail) : ''}`);
  }

  return logEntry;
}
// 4.1. KARMED DIRECT MASTER QUEUE SYNC (v5.0.0)
// Har 20 soniyada Karmed serveridan (192.168.150.111:2025) bugungi barcha
// UTT bemorlarini mustaqil va uzluksiz tortib oluvchi asosiy master dvigatel.
// =========================================================================

let isKarmedSyncInProgress = false;
let lastKarmedSyncTime = null;
let lastKarmedSyncStatus = 'INITIALIZING';
let karmedSyncStats = {
  totalSyncs: 0,
  successfulSyncs: 0,
  failedSyncs: 0,
  lastPatientCount: 0,
  lastWaitingCount: 0,
  lastError: null
};

// Vaqtni HH:MM formatga o'tkazish
function formatKarmedTimeString(tStr) {
  if (!tStr) return '';
  if (tStr.includes('T')) {
    const parts = tStr.split('T')[1];
    return parts.substring(0, 5); // "08:40"
  }
  if (tStr.includes(':')) {
    const parts = tStr.split(':');
    return parts[0].padStart(2, '0') + ':' + parts[1].padStart(2, '0');
  }
  return tStr;
}

// Bemor yozuvini UTT xonalariga moslashtirish (Mapping - v6.0.0)
function mapKarmedRecordToDoctor(p, docsAuth) {
  const roomStr = (p.AltBolumAdi || p.OdaAdi || '').trim();
  const docName = (p.DoktorAdi || p.KabulEden || p.DosyaDoktoru || '').toLowerCase();
  const doctorKeys = Object.keys(docsAuth || {});

  // 1. Ultratovush-N yoki Ultratovush--N raqamini aniqlash
  const m = roomStr.match(/Ultratovush-+(\d+)/i);
  if (m) {
    const num = m[1];
    const targetRoomId = `Ultratovush-${num}`;
    for (const key of doctorKeys) {
      if (docsAuth[key] && docsAuth[key].roomId === targetRoomId) {
        return docsAuth[key];
      }
    }
  }

  // 2. Xona satri yoki shifokor ismidan qidirish
  for (const key of doctorKeys) {
    const d = docsAuth[key];
    if (!d) continue;
    if (d.shortName && roomStr.toLowerCase().includes(d.shortName.toLowerCase())) return d;
    if (d.doctorName && roomStr.toLowerCase().includes(d.doctorName.toLowerCase())) return d;
    if (docName && d.doctorName && docName.includes(d.doctorName.toLowerCase())) return d;
    if (docName && d.shortName && docName.includes(d.shortName.toLowerCase())) return d;
  }

  // 3. OdaId yoki roomNum bo'yicha moslashtirish
  if (p.OdaId) {
    for (const key of doctorKeys) {
      const d = docsAuth[key];
      if (!d) continue;
      if (String(d.roomNum) === String(p.OdaId) || String(d.kod) === String(p.OdaId)) {
        return d;
      }
    }
  }

  return null;
}

async function syncMasterQueueFromKarmedDirect() {
  if (isKarmedSyncInProgress) return;
  isKarmedSyncInProgress = true;

  try {
    const { dateStr } = getDailyLogInfo(); // e.g. "10.09.2026"
    const profiles = getKarmedProfiles();
    let r5 = profiles['R5'];

    // Agar R5 sessiyasi mavjud bo'lmasa, avtomatik login qilamiz
    if (!r5 || !r5.loginBilgi || !r5.cookie) {
      console.log('[Karmed Master Sync] R5 sessiyasi topilmadi, yangi login qilinmoqda...');
      const logRes = await loginToKarmedLive('R5', '17720');
      if (logRes && logRes.success) {
        r5 = saveKarmedProfile({
          username: 'R5',
          loginBilgi: logRes.loginBilgi,
          cookie: logRes.cookie,
          fullName: logRes.fullName
        });
      } else {
        throw new Error("R5 hisobi bilan Karmedga kirib bo'lmadi: " + (logRes ? logRes.message : "Noma'lum xato"));
      }
    }

    let liveToken = r5.loginBilgi;
    let cookieStr = r5.cookie;

    // Karmed HastaSorgula so'rov parametrlari
    async function executeQuery(token, cookie) {
      const sParams = new URLSearchParams();
      sParams.set('submitDirectEventConfig', JSON.stringify({
        config: { extraParams: { aDosyaDurumu: null, aHizliAra: false } }
      }));
      sParams.set('cbYil', dateStr.split('.')[2] || '2026');
      sParams.set('_cbYil_state', JSON.stringify([{ value: sParams.get('cbYil'), text: sParams.get('cbYil'), index: 1 }]));
      sParams.set('cbHizliAramaTur', 'Bemor ID');
      sParams.set('_cbHizliAramaTur_state', JSON.stringify([{ value: '0', text: 'Bemor ID', index: 0 }]));
      sParams.set('tfHizliAramaDeger', '');
      sParams.set('BaslangicDt', dateStr);
      sParams.set('BitisDt', dateStr);
      sParams.set('cbBolum', 'Ultratovush, Dopler Ultratovush');
      sParams.set('_cbBolum_state', JSON.stringify([
        { value: '10', text: 'Ultratovush', index: 9 },
        { value: '24', text: 'Dopler Ultratovush', index: 0 }
      ]));
      sParams.set('cbAltBolum', '(Subbirliklar)');
      sParams.set('_cbAltBolum_state', JSON.stringify([{ value: '0', text: '(Subbirliklar)', index: 0 }]));
      sParams.set('cbBolumOda', '(Barcha Xonalar)');
      sParams.set('_cbBolumOda_state', JSON.stringify([{ value: '0', text: '(Barcha Xonalar)', index: 0 }]));
      sParams.set('cbBirimTuru', '(Butun Birlik)');
      sParams.set('_cbBirimTuru_state', JSON.stringify([{ value: '0', text: '(Butun Birlik)', index: 0 }]));
      sParams.set('cbBina', '(Butun Binolar)');
      sParams.set('_cbBina_state', JSON.stringify([{ value: '0', text: '(Butun Binolar)', index: 0 }]));
      sParams.set('cbKayitSayisiSecim', '500');
      sParams.set('_cbKayitSayisiSecim_state', JSON.stringify([{ value: '500', text: '500', index: 3 }]));
      sParams.set('hdnDosyaDurumu', '');
      sParams.set('btnTumu_Pressed', 'true');
      sParams.set('btnBekleyen_Pressed', '');
      sParams.set('HdnBaseYazdirmaTuru', '-1');
      sParams.set('__VIEWSTATEGENERATOR', '5DE5E74B');
      sParams.set('hdnKrmdLoginBilgi', token);
      sParams.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
      sParams.set('__EVENTARGUMENT', '-|public|HastaSorgula');

      const spData = sParams.toString();
      return await karmedRawRequest({
        hostname: '192.168.150.111',
        port: 2025,
        path: '/Radiology/Rbys.aspx?action=HastaSorgula',
        method: 'POST',
        headers: {
          'X-Ext-Net': 'delta=true',
          'action': 'HastaSorgula',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': cookie,
          'Content-Length': Buffer.byteLength(spData)
        }
      }, spData);
    }

    let qRes = await executeQuery(liveToken, cookieStr);
    let dataMatch = qRes.body.match(/App\.grdHastalarStore\.proxy\.data\s*=\s*(\[.*?\]);/s);

    // Agar sessiya eskirgan bo'lsa yoki token yangilangan bo'lsa, qayta login qilamiz
    if (!dataMatch) {
      console.log('[Karmed Master Sync] Sessiya yangilanmoqda (Re-authenticating R5)...');
      const refreshed = await loginToKarmedLive('R5', '17720');
      if (refreshed && refreshed.success) {
        liveToken = refreshed.loginBilgi;
        cookieStr = refreshed.cookie;
        saveKarmedProfile({
          username: 'R5',
          loginBilgi: liveToken,
          cookie: cookieStr,
          fullName: refreshed.fullName
        });
        qRes = await executeQuery(liveToken, cookieStr);
        dataMatch = qRes.body.match(/App\.grdHastalarStore\.proxy\.data\s*=\s*(\[.*?\]);/s);
      }
    }

    if (!dataMatch) {
      throw new Error("Karmed javobida grdHastalarStore topilmadi");
    }

    const rawList = safeParseExtNetJson(dataMatch[1]);
    if (!Array.isArray(rawList)) {
      throw new Error("Karmed ma'lumotlari massiv emas");
    }

    // UTT shifokorlari tuzilmasini tayyorlash (U0..U9, U11 va boshqalar - v6.0.0)
    const docsAuth = getDoctorsAuth();
    const doctorKeys = Object.keys(docsAuth || {});
    const doctorMap = {};

    doctorKeys.forEach(key => {
      const d = docsAuth[key] || {};
      const roomId = d.roomId || ('Ultratovush-' + key.replace('U', ''));
      doctorMap[roomId] = {
        id: roomId,
        room: roomId,
        num: key.replace('U', ''),
        shortName: d.shortName || roomId,
        doctorName: d.doctorName || 'Shifokor',
        roomTitle: d.roomTitle || `${roomId} XONA`,
        roomNum: d.roomNum || '',
        kod: d.kod || '',
        soundId: d.soundId || 1,
        patients: [],
        count: 0
      };
    });

    // Bugungi va kechagi sanalarni aniqlash (GMT+5 / Server vaqti)
    const nowObj = new Date();
    const pad2 = (n) => (n < 10 ? '0' : '') + n;
    const todayIso = `${nowObj.getFullYear()}-${pad2(nowObj.getMonth() + 1)}-${pad2(nowObj.getDate())}`;
    const todayDmy = `${pad2(nowObj.getDate())}.${pad2(nowObj.getMonth() + 1)}.${nowObj.getFullYear()}`;

    const yDateObj = new Date(nowObj.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayIso = `${yDateObj.getFullYear()}-${pad2(yDateObj.getMonth() + 1)}-${pad2(yDateObj.getDate())}`;
    const yesterdayDmy = `${pad2(yDateObj.getDate())}.${pad2(yDateObj.getMonth() + 1)}.${yDateObj.getFullYear()}`;

    function formatIsoToDmy(isoStr) {
      if (!isoStr) return '';
      const parts = isoStr.split('-');
      if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
      return isoStr;
    }

    // Qabul qilingan bemorlar ro'yxatini shakllantirish
    const allPatients = [];
    let totalWaitingCount = 0;

    rawList.forEach((kp, idx) => {
      const matchedDoc = mapKarmedRecordToDoctor(kp, docsAuth);
      const regIso = kp.KayitTarihi ? kp.KayitTarihi.split('T')[0] : '';
      const regTime = formatKarmedTimeString(kp.KayitTarihi || kp.KabulTarihi || kp.Saat);
      const acceptIso = kp.KabulTarihi ? kp.KabulTarihi.split('T')[0] : '';
      const acceptTime = kp.KabulTarihi ? formatKarmedTimeString(kp.KabulTarihi) : '';
      const confirmIso = kp.HakedisTarihi ? kp.HakedisTarihi.split('T')[0] : (kp.KabulTarihi ? kp.KabulTarihi.split('T')[0] : '');
      const confirmTime = kp.HakedisTarihi ? formatKarmedTimeString(kp.HakedisTarihi) : acceptTime;

      const statusCode = kp.DosyaDurumu || (kp.Durum === 'Bekleyen' ? 1 : (kp.Durum === 'Kabul Edilen' ? 4 : (kp.Durum === 'Rapor Onaylı' ? 8 : 1)));
      const isWaiting = statusCode === 1; // 1 = Bekleyen
      const isAccepted = statusCode === 4; // 4 = Kabul Edilen
      const isFinished = statusCode === 8 || (kp.Durum && String(kp.Durum).toLowerCase().includes('onay'));

      // 1. Foydalanuvchi talabi: Faqat tasdiqlangan sanasi BUGUN bo'lganlar bugungi ko'rikka kiradi
      const isConfirmedToday = isFinished && (confirmIso === todayIso);

      // 2. Ro'yxatga olingan sana tahlili:
      const isRegToday = (regIso === todayIso);
      const isRegYesterday = (regIso === yesterdayIso);
      const isRegEarlier = (!isRegToday && regIso && regIso < todayIso);

      // 3. Matnli aniq ta'rif / teg:
      let dateTag = '';
      let dateTagType = 'today';
      const regPretty = formatIsoToDmy(regIso);
      const confPretty = formatIsoToDmy(confirmIso);

      if (isConfirmedToday) {
        if (isRegToday) {
          dateTag = "Bugun yo'naltirilgan, bugun tekshiruvdan o'tgan";
          dateTagType = "today_done";
        } else if (isRegYesterday) {
          dateTag = "Kecha yo'naltirilgan, bugun tekshiruvdan o'tgan";
          dateTagType = "yesterday_done";
        } else {
          dateTag = `${regPretty} da yo'naltirilgan, bugun tekshiruvdan o'tgan`;
          dateTagType = "earlier_done";
        }
      } else if (isAccepted && (acceptIso === todayIso)) {
        if (isRegToday) {
          dateTag = "Bugun yo'naltirilgan, bugun qabul qilingan";
          dateTagType = "today_accepted";
        } else if (isRegYesterday) {
          dateTag = "Kecha yo'naltirilgan, bugun qabul qilingan";
          dateTagType = "yesterday_accepted";
        } else {
          dateTag = `${regPretty} da yo'naltirilgan, bugun qabul qilingan`;
          dateTagType = "earlier_accepted";
        }
      } else if (isWaiting) {
        if (isRegToday) {
          dateTag = "Bugun ro'yxatga olingan";
          dateTagType = "today_waiting";
        } else if (isRegYesterday) {
          dateTag = "Kecha yo'naltirilgan, navbatda kutmoqda";
          dateTagType = "yesterday_waiting";
        } else {
          dateTag = `${regPretty} da yo'naltirilgan, navbatda kutmoqda`;
          dateTagType = "earlier_waiting";
        }
      } else if (isFinished) {
        dateTag = `${confPretty} da tekshiruvdan o'tgan`;
        dateTagType = "other_done";
      }

      let statusText = kp.Durum || 'Bekleyen';
      if (statusCode === 1) statusText = 'Bekleyen';
      else if (statusCode === 4) statusText = 'Kabul Edilen';
      else if (statusCode === 8) statusText = 'Rapor Onaylı';

      const patientObj = {
        patientId: String(kp.KimlikNo || kp.Id),
        dosyaNo: kp.ProtokolNo || kp.DosyaNo || '',
        labDosyaId: kp.Id,
        fullName: (kp.AdSoyad || ((kp.HastaAdi || '') + ' ' + (kp.Soyadi || ''))).trim(),
        queueNo: kp.MuayeneSirano || (idx + 1),
        globalQueueNo: idx + 1,
        status: statusText,
        statusCode: statusCode,
        registrationDate: regPretty || todayDmy,
        registrationIso: regIso,
        registrationTime: regTime,
        acceptanceDate: formatIsoToDmy(acceptIso),
        acceptanceTime: acceptTime,
        confirmationDate: formatIsoToDmy(confirmIso),
        confirmationTime: confirmTime,
        confirmationFullTime: kp.HakedisTarihi || kp.KabulTarihi || '',
        isConfirmedToday: isConfirmedToday,
        isRegToday: isRegToday,
        isRegYesterday: isRegYesterday,
        isRegEarlier: isRegEarlier,
        dateTag: dateTag,
        dateTagType: dateTagType,
        room: matchedDoc ? matchedDoc.roomId : (kp.AltBolumAdi || 'Biriktirilmagan'),
        roomTitle: matchedDoc ? matchedDoc.roomTitle : 'Umumiy navbat',
        doctorName: matchedDoc ? matchedDoc.doctorName : (kp.KabulEden || kp.DoktorAdi || 'Navbatchi shifokor'),
        referringDoctor: kp.DosyaDoktoru || '',
        karmedIndex: idx
      };

      allPatients.push(patientObj);

      if (isWaiting || isAccepted) {
        totalWaitingCount++;
      }

      // Faqat kutayotgan yoki qabuldagi bemorlar xonadagi faol navbatga qo'shiladi
      if (matchedDoc && (isWaiting || isAccepted)) {
        doctorMap[matchedDoc.roomId].patients.push(patientObj);
      }
    });

    // Global navbat raqamlarini tartiblash (Vaqt va ID bo'yicha)
    allPatients.sort((a, b) => {
      const tA = a.registrationTime || '';
      const tB = b.registrationTime || '';
      return tA.localeCompare(tB) || (a.labDosyaId - b.labDosyaId);
    });

    const idToGlobalQueue = new Map();
    allPatients.forEach((p, idx) => {
      const gNo = idx + 1;
      p.queueNo = gNo;
      p.globalQueueNo = gNo;
      idToGlobalQueue.set(String(p.patientId).trim(), gNo);
    });

    // Statistika hisob-kitoblari (Faqat tasdiqlangan sanasi bugun bo'lganlar va ro'yxatga olingan sana ajratilishi)
    let totalTodayRegisteredCount = 0;
    let totalEarlierRegisteredCount = 0;
    let totalCompletedCount = 0;
    let totalCompletedTodayCount = 0;
    let totalCompletedEarlierCount = 0;

    const summaryByDoctor = {};
    const completedByDoctor = {};
    const completedTodayByDoctor = {};
    const completedEarlierByDoctor = {};
    const earlierPatientsList = [];

    allPatients.forEach(p => {
      if (p.isRegToday) {
        totalTodayRegisteredCount++;
      } else {
        totalEarlierRegisteredCount++;
      }

      // Kecha yoki oldingi kundan qolgan bemorlarni alohida ro'yxatga jamlash
      if (p.isRegEarlier || p.isRegYesterday) {
        earlierPatientsList.push(p);
      }

      // Vrachlar ko'rigi: FAQAT TASDIQLANGAN SANASI BUGUN BO'LGANLAR
      if (p.isConfirmedToday) {
        totalCompletedCount++;
        const rKey = p.room;
        if (rKey && rKey !== 'Biriktirilmagan') {
          completedByDoctor[rKey] = (completedByDoctor[rKey] || 0) + 1;
          if (p.isRegToday) {
            totalCompletedTodayCount++;
            completedTodayByDoctor[rKey] = (completedTodayByDoctor[rKey] || 0) + 1;
          } else {
            totalCompletedEarlierCount++;
            completedEarlierByDoctor[rKey] = (completedEarlierByDoctor[rKey] || 0) + 1;
          }
        }
      }
    });

    Object.values(doctorMap).forEach(doc => {
      doc.patients.forEach(p => {
        const pKey = String(p.patientId).trim();
        if (idToGlobalQueue.has(pKey)) {
          p.queueNo = idToGlobalQueue.get(pKey);
          p.globalQueueNo = idToGlobalQueue.get(pKey);
        }
      });
      doc.patients.sort((a, b) => (a.queueNo || 0) - (b.queueNo || 0));
      doc.count = doc.patients.length;
      doc.waitingCount = doc.patients.filter(p => p.statusCode !== 4).length;
      const rId = doc.room || doc.id;

      doc.completedCount = completedByDoctor[rId] || 0;
      doc.completedTodayCount = completedTodayByDoctor[rId] || 0;
      doc.completedEarlierCount = completedEarlierByDoctor[rId] || 0;

      // Jami bemorlar: bugun ro'yxatga olinganlar + oldingi kundan yo'naltirilganlar
      const docTodayReg = allPatients.filter(p => p.room === rId && p.isRegToday).length;
      const docEarlierReg = allPatients.filter(p => p.room === rId && (p.isRegYesterday || p.isRegEarlier)).length;

      doc.totalToday = docTodayReg;
      doc.totalEarlier = docEarlierReg;
      doc.totalAll = docTodayReg + docEarlierReg;
      doc.earlierPatients = earlierPatientsList.filter(p => p.room === rId);

      summaryByDoctor[rId] = doc.patients.length;
    });

    // KARMED "KABUL EDILEN" (DosyaDurumu === 4) -> TV DA "QABUL QILMOQDA" AVTO-INTEGRATSIYA (v6.0.0)
    const acceptedByRoom = {};
    allPatients.forEach(p => {
      if (p.statusCode === 4 && p.room && p.room !== 'Biriktirilmagan') {
        acceptedByRoom[p.room] = p;
      }
    });

    // activeCalls ni Karmed qabul holatlari bilan sinxronlash
    Object.keys(acceptedByRoom).forEach(roomKey => {
      const p = acceptedByRoom[roomKey];
      const doc = doctorMap[roomKey] || {};
      activeCalls[roomKey] = {
        patientId: p.patientId,
        queueNo: p.queueNo,
        globalQueueNo: p.globalQueueNo,
        fullName: p.fullName,
        registrationTime: p.registrationTime,
        roomKey: roomKey,
        roomTitle: doc.roomTitle || p.roomTitle || `${roomKey} XONA`,
        doctorName: doc.doctorName || p.doctorName || 'Shifokor',
        source: 'karmed_accepted',
        status: 'accepted',
        statusText: 'Qabul qilmoqda',
        calledAt: p.registrationTime || new Date().toISOString()
      };
    });

    // Agar avval karmed_accepted orqali o'rnatilgan activeCall bo'lsa-yu, endi Karmedda u xonada qabul qilingan bemor qolmagan bo'lsa, o'chiramiz
    Object.keys(activeCalls).forEach(rKey => {
      if (activeCalls[rKey] && activeCalls[rKey].source === 'karmed_accepted') {
        if (!acceptedByRoom[rKey]) {
          delete activeCalls[rKey];
        }
      }
    });

    const doctorsArray = Object.values(doctorMap);

    // Yangi master ma'lumotlar paketi (v7.2.0)
    const masterData = {
      timestamp: new Date().toISOString(),
      date: dateStr,
      totalPatients: totalTodayRegisteredCount,
      department: "Ultratovush",
      statusFilter: "Bekleyen",
      karmedDirectSync: true,
      lastSyncAt: new Date().toISOString(),
      version: '7.2.0',
      summary: {
        totalWaiting: totalWaitingCount,
        totalPatients: totalTodayRegisteredCount,
        totalEarlierRegistered: totalEarlierRegisteredCount,
        totalAll: allPatients.length,
        totalCompleted: totalCompletedCount,
        totalCompletedToday: totalCompletedTodayCount,
        totalCompletedEarlier: totalCompletedEarlierCount,
        byDoctor: summaryByDoctor,
        completedByDoctor: completedByDoctor,
        completedTodayByDoctor: completedTodayByDoctor,
        completedEarlierByDoctor: completedEarlierByDoctor,
        earlierPatientsList: earlierPatientsList
      },
      doctors: doctorsArray,
      allPatients: allPatients,
      activeCalls: activeCalls
    };

    latestQueueData = masterData;
    saveQueueToFile(masterData);

    // SSE orqali barcha TV va mijozlarga uzatish
    broadcastEvent({
      type: 'QUEUE_SYNC',
      ...masterData,
      activeCalls
    });

    lastKarmedSyncTime = new Date();
    lastKarmedSyncStatus = 'SUCCESS';
    karmedSyncStats.totalSyncs++;
    karmedSyncStats.successfulSyncs++;
    karmedSyncStats.lastPatientCount = allPatients.length;
    karmedSyncStats.lastWaitingCount = totalWaitingCount;
    karmedSyncStats.lastError = null;

    console.log(`[Karmed Master Sync v6.0] Muvaffaqiyatli: Jami ${allPatients.length} ta bemor, ${totalWaitingCount} ta kutayotgan (${doctorsArray.length} ta xona yangilandi)`);
  } catch (err) {
    lastKarmedSyncStatus = 'ERROR';
    karmedSyncStats.totalSyncs++;
    karmedSyncStats.failedSyncs++;
    karmedSyncStats.lastError = err.message;
    console.warn(`[Karmed Master Sync Warning]:`, err.message);
  } finally {
    isKarmedSyncInProgress = false;
  }
}

// Har 20 soniyada Karmed Master Sync ni ishga tushiruvchi taymer
function startKarmedMasterSyncLoop() {
  console.log('[Karmed Master Sync] Dvigatel ishga tushmoqda (Har 20 soniyada avto-sync)...');
  // Zudlik bilan birinchi sinxronizatsiyani amalga oshiramiz
  setTimeout(() => {
    syncMasterQueueFromKarmedDirect().catch(e => console.warn('[Initial Sync Error]:', e.message));
  }, 2000);

  setInterval(() => {
    syncMasterQueueFromKarmedDirect().catch(e => console.warn('[Periodic Sync Error]:', e.message));
  }, 20000);
}

// 5. TARMOQ IP MANZILLARI
function getLocalIpAddresses() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ iface: name, address: iface.address });
      }
    }
  }
  return ips;
}

// 6. STATIK FAYLLARNI TARQATISH (MIME TYPES)
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.apk': 'application/vnd.android.package-archive'
};

function serveStaticFile(reqPath, res, defaultHtml) {
  let cleanPath = String(reqPath || '').replace(/\\/g, '/').replace(/^\/+/, '').split('?')[0];
  if (!cleanPath) cleanPath = defaultHtml;

  // Maxsus qulay yo'nalishlar (TV, Agentlar, Shifokor, Admin)
  if (cleanPath === 'tv' || cleanPath === 'tv.html') cleanPath = 'tv.html';
  else if (cleanPath === 'tv-dev' || cleanPath === 'tv-dev.html') cleanPath = 'tv-dev.html';
  else if (cleanPath === 'tv-monitor' || cleanPath === 'tv-monitor.html') cleanPath = 'tv-monitor.html';
  else if (cleanPath === 'doctor' || cleanPath === 'doctor.html') cleanPath = 'doctor.html';
  else if (cleanPath === 'patient' || cleanPath === 'patient.html') cleanPath = 'patient.html';
  else if (cleanPath === 'post' || cleanPath === 'index' || cleanPath === 'index.html') cleanPath = 'index.html';
  else if (cleanPath === 'admin' || cleanPath === 'admin.html') cleanPath = 'admin.html';
  else if (cleanPath === 'utt' || cleanPath === 'mobile_agent_utt.html') cleanPath = 'mobile_agent_utt.html';
  else if (cleanPath === 'mskt' || cleanPath === 'kt' || cleanPath === 'mobile_agent_mskt.html') cleanPath = 'mobile_agent_mskt.html';
  else if (cleanPath === 'mrt' || cleanPath === 'mobile_agent_mrt.html') cleanPath = 'mobile_agent_mrt.html';
  else if (cleanPath === 'agent' || cleanPath === 'mobile' || cleanPath === 'mobile_agent.html') cleanPath = 'mobile_agent.html';

  let filePath = path.join(PUBLIC_DIR, cleanPath);
  if (!fs.existsSync(filePath)) {
    // Agar /icons/ bo'lsa extension papkasidan ham qidirish
    if (cleanPath.includes('icons/')) {
      const iconName = path.basename(cleanPath);
      const extIconPath = path.join(ROOT_DIR, 'extension-karmed-assign-doctor', 'icons', iconName);
      if (fs.existsSync(extIconPath)) {
        filePath = extIconPath;
      }
    }
  }

  // APK yuklab olish
  if (cleanPath === 'UTT_TV_Navbat.apk' || cleanPath === 'app.apk' || cleanPath.endsWith('.apk')) {
    const rootApk = path.join(ROOT_DIR, 'UTT_TV_Navbat.apk');
    if (fs.existsSync(rootApk)) {
      filePath = rootApk;
    }
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, defaultHtml);
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Sahifa topilmadi');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Faylni o\'qishda xatolik: ' + e.message);
  }
}

// 7. BODY PARSER YORDAMCHISI
function parseJsonBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 10 * 1024 * 1024) { // 10MB limit
      req.connection.destroy();
    }
  });
  req.on('end', () => {
    try {
      const parsed = body ? JSON.parse(body) : {};
      callback(null, parsed, body);
    } catch (err) {
      callback(err, null, body);
    }
  });
}

// 8. ASOSIY REQUES-ROUTER (Barcha 4 ta port uchun umumiy API)

// Tibbiy tekshiruvlarni modalitetlar (UTT, MRT, KT, Rentgen) bo'yicha ajratish
function classifyMedicalService(s) {
  const name = String(s.TetkikIsmi || s.name || '').toUpperCase();
  const code = String(s.KodAra || s.code || '').toUpperCase();

  // 1. MRT (Magnit-Rezonans Tomografiya)
  if (name.includes('MRT') || name.includes('M.R.T') || name.includes('MAGNIT') || name.startsWith('MR ') || code.startsWith('R18') || code.startsWith('R20') || code.startsWith('R156') || code === 'R4896') {
    return {
      category: 'MRT',
      categoryLabel: '🧲 MRT (Magnit-Rezonans Tomografiya)',
      badgeClass: 'badge-mrt',
      badgeColor: '#8b5cf6'
    };
  }

  // 2. KT / MSKT (Kompyuter Tomografiyasi)
  if (name.includes('MSKT') || name.includes(' KT ') || name.includes('TOMOGRAFIYA') || code.startsWith('R14')) {
    return {
      category: 'KT',
      categoryLabel: '⚡ MSKT / KT (Kompyuter Tomografiyasi)',
      badgeClass: 'badge-kt',
      badgeColor: '#f59e0b'
    };
  }

  // 3. Rentgen / Mammografiya
  if (name.includes('RENTGEN') || name.includes('R-SKOPIYA') || name.includes('R-GRAFIYA') || name.includes('MAMMOGRAFIYA') || code === 'R95' || code === 'R130') {
    return {
      category: 'RENTGEN',
      categoryLabel: '☢️ Rentgen / Mammografiya',
      badgeClass: 'badge-rentgen',
      badgeColor: '#06b6d4'
    };
  }

  // 4. EKG / Funktsional
  if (name.includes('EKG') || name.includes('ELEKTROKARDIO') || code === 'R232') {
    return {
      category: 'BOSHQA',
      categoryLabel: '📋 Funktsional & Boshqa',
      badgeClass: 'badge-other',
      badgeColor: '#64748b'
    };
  }

  // 5. Standart UZI / UTT (Ultratovush va Dopler)
  return {
    category: 'UTT',
    categoryLabel: '🎯 UTT / UZI (Ultratovush)',
    badgeClass: 'badge-utt',
    badgeColor: '#10b981'
  };
}

function handleHttpRequest(req, res, defaultHtml, serverPort) {
  // CORS sarlavhalari
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // TV so'rovlarini avtomatik telemetriyaga yozish
  if (pathname === '/tv' || pathname === '/tv.html' || (serverPort === PORT_TV && pathname === '/')) {
    const ua = req.headers['user-agent'] || '';
    recordTvEvent('TV_CONNECT', req.socket.remoteAddress, ua, pathname, 200, 'TV sahifasiga ulanish so\'rovi keldi');
  } else if (pathname === '/tv-dev' || pathname === '/tv-dev.html') {
    const ua = req.headers['user-agent'] || '';
    recordTvEvent('TV_DEV_CONNECT', req.socket.remoteAddress, ua, pathname, 200, 'TV-DEV (Test) sahifasiga ulanish so\'rovi keldi');
  }

  // =========================================================================
  // API ENDPOINTLARI (BARCHA PORTLARDA ISHLAYDI)
  // =========================================================================

  // A. LOG YOZISH ENDPOINTI (/log)
  if (req.method === 'POST' && pathname === '/log') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      writeToDailyLog(body);
      console.log(`[LOG] ${body.trim().substring(0, 140)}`);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('OK');
    });
    return;
  }

  // B. EKSTESHNDAN NAVBAT MA'LUMOTLARINI QABUL QILISH (/api/queue-sync)
  if (req.method === 'POST' && pathname === '/api/queue-sync') {
    parseJsonBody(req, (err, data, rawBody) => {
      if (err) {
        console.error('[Queue Sync Parse Error]:', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
        return;
      }

      // DESTRUCTIVE OVERWRITE GUARD (v5.0.0):
      // Agar tashqi kengaytma faqat 1-2 kishilik qidiruv filtrini yuborayotgan bo'lsa,
      // serverdagi to'liq master navbatni (masalan 50+ bemor) o'chirishga ruxsat bermaymiz!
      const incomingTotal = (data && Array.isArray(data.allPatients)) ? data.allPatients.length : (data ? (data.totalPatients || 0) : 0);
      const currentMasterTotal = (latestQueueData && Array.isArray(latestQueueData.allPatients)) ? latestQueueData.allPatients.length : (latestQueueData ? (latestQueueData.totalPatients || 0) : 0);

      if (currentMasterTotal >= 5 && incomingTotal < Math.max(3, currentMasterTotal * 0.5)) {
        const guardMsg = `[QUEUE_SYNC_GUARD] Rad etildi: Kengaytmadan faqat ${incomingTotal} ta bemor keldi (Server master navbatida ${currentMasterTotal} ta bemor mavjud). TV ekrani himoyalandi!`;
        console.warn(guardMsg);
        writeToDailyLog(guardMsg);
        recordSystemEvent('QUEUE_SYNC_GUARD', guardMsg, req.socket.remoteAddress, { incomingTotal, currentMasterTotal });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          guarded: true,
          message: "Master navbat chala qidiruvdan himoyalandi",
          serverTotal: currentMasterTotal
        }));
        return;
      }

      data.serverReceivedAt = new Date().toISOString();
      data.activeCalls = activeCalls;

      // UMUMIY RO'YXAT BO'YICHA NAVBAT RAQAMINI (GLOBAL QUEUE NO) QAT'IY BELGILASH:
      // "misol bemor umumiy ro'yxatda 24 bo'lsa uni navbatini 24 deb belgilash kerak.
      // shunda bemor o'z vrachini o'zgartirsa ham navbat raqami o'zgarmaydi."
      if (data && Array.isArray(data.allPatients) && data.allPatients.length > 0) {
        data.allPatients.sort((a, b) => (a.timeMinutes || 0) - (b.timeMinutes || 0));
        const idToGlobalQueue = new Map();
        data.allPatients.forEach((p, idx) => {
          const gNo = idx + 1;
          p.queueNo = gNo;
          p.globalQueueNo = gNo;
          if (p.patientId) idToGlobalQueue.set(String(p.patientId).trim(), gNo);
        });

        if (Array.isArray(data.doctors)) {
          data.doctors.forEach(doc => {
            if (Array.isArray(doc.patients)) {
              doc.patients.forEach(p => {
                const pKey = String(p.patientId || '').trim();
                if (idToGlobalQueue.has(pKey)) {
                  p.queueNo = idToGlobalQueue.get(pKey);
                  p.globalQueueNo = idToGlobalQueue.get(pKey);
                }
              });
              doc.patients.sort((a, b) => (a.timeMinutes || 0) - (b.timeMinutes || 0));
            }
          });
        }
      }

      latestQueueData = data;
      saveQueueToFile(data);

      // Barcha ulangan TV, Registrator, Vrach va Bemor ekranlariga SSE orqali yuboramiz
      broadcastEvent({
        type: 'QUEUE_SYNC',
        ...data,
        activeCalls
      });

      const docCount = Array.isArray(data.doctors) ? data.doctors.length : 0;
      const total = data.totalPatients || 0;
      const logMsg = `[QUEUE_SYNC] Navbat yangilandi: Jami ${total} ta bemor, ${docCount} ta vrach guruhi (Umumiy navbat raqamlari bilan)`;
      writeToDailyLog(logMsg);
      recordSystemEvent('QUEUE_SYNC', `Navbat yangilandi: ${total} ta bemor (${docCount} ta xona)`, req.socket.remoteAddress, { total, docCount });
      console.log(`[QUEUE_SYNC] ${logMsg}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, total, receivedAt: data.serverReceivedAt }));
    });
    return;
  }

  // C. JORIY NAVBATNI OLISH (/api/queue yoki /api/queue-live)
  if (req.method === 'GET' && (pathname === '/api/queue' || pathname === '/api/queue-live')) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      data: {
        ...latestQueueData,
        activeCalls
      },
      ...latestQueueData,
      activeCalls
    }));
    return;
  }

  // D. AKTIV CHAQIRUVLARNI OLISH (/api/active-calls)
  if (req.method === 'GET' && pathname === '/api/active-calls') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, activeCalls }));
    return;
  }

  // E. SERVER-SENT EVENTS (SSE) REAL-TIME STREAM (/api/events)
  if (req.method === 'GET' && pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no'
    });

    // Dastlabki holatni yuboramiz
    res.write(`data: ${JSON.stringify({ ...latestQueueData, activeCalls })}\n\n`);

    sseClients.add(res);
    console.log(`[SSE:Port ${serverPort}] Yangi jonli mijoz ulandi. Jami: ${sseClients.size}`);

    const keepAliveTimer = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (e) {}
    }, 15000);

    req.on('close', () => {
      clearInterval(keepAliveTimer);
      sseClients.delete(res);
      console.log(`[SSE:Port ${serverPort}] Mijoz uzildi. Jami: ${sseClients.size}`);
    });
    return;
  }

  // F. SERVER HOLATI (/status)
  if (req.method === 'GET' && pathname === '/status') {
    const { dateStr, logFile } = getDailyLogInfo();
    const localIps = getLocalIpAddresses();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      status: 'running',
      version: '7.1.0',
      system: 'Karmed Direct Master Sync v7.1.0',
      date: dateStr,
      logFile,
      localIps,
      currentPort: serverPort,
      ports: {
        registrator: PORT_REGISTRATOR,
        tv: PORT_TV,
        doctor: PORT_DOCTOR,
        patient: PORT_PATIENT,
        admin: PORT_ADMIN,
        mobileUtt: PORT_MOBILE_UTT,
        mobileMskt: PORT_MOBILE_MSKT,
        mobileMrt: PORT_MOBILE_MRT
      },
      activeSseClients: sseClients.size,
      totalPatients: latestQueueData.totalPatients || 0,
      totalWaiting: (latestQueueData.summary && latestQueueData.summary.totalWaiting) || 0,
      activeCallsCount: Object.keys(activeCalls).length,
      karmedDirectSync: true,
      lastKarmedSyncTime,
      lastKarmedSyncStatus,
      karmedSyncStats
    }));
    return;
  }

  // F1. ANDROID TV APK YANGILANISH MA'LUMOTLARI (/api/app-version)
  if (req.method === 'GET' && pathname === '/api/app-version') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: true,
      latestVersion: "7.1.0",
      versionCode: 710,
      apkFileName: "UTT_TV_Navbat.apk",
      downloadUrl: "/download/UTT_TV_Navbat.apk",
      releaseDate: "11.09.2026",
      releaseNotes: "v7.1.0: Admin panelida ID kodlar va sana oralig'i bo'yicha maxsus Karmed hisob-kitob bo'limi (Google Sheets reestri) va Excel eksport.",
      minSupportedVersion: "1.0.0"
    }));
    return;
  }

  // F2. APK FAYLINI YUKLAB OLISH (/download/UTT_TV_Navbat.apk)
  if (req.method === 'GET' && (pathname === '/download/UTT_TV_Navbat.apk' || pathname === '/UTT_TV_Navbat.apk')) {
    const apkPath = path.join(ROOT_DIR, 'UTT_TV_Navbat.apk');
    if (fs.existsSync(apkPath)) {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': stat.size,
        'Content-Disposition': 'attachment; filename="UTT_TV_Navbat.apk"'
      });
      fs.createReadStream(apkPath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'APK fayli topilmadi' }));
      return;
    }
  }

  // F3. TV TELEMETRIYA MONITORINGI DASHBORDI (/tv-monitor)
  if (req.method === 'GET' && (pathname === '/tv-monitor' || pathname === '/tv-monitor.html')) {
    serveStaticFile('tv-monitor.html', res, 'tv-monitor.html');
    return;
  }

  // F4. TV TELEMETRIYA MA'LUMOTLARINI OLISH (/api/tv-telemetry)
  if (req.method === 'GET' && pathname === '/api/tv-telemetry') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      success: true,
      count: tvTelemetryLogs.length,
      logs: tvTelemetryLogs
    }));
    return;
  }

  // F5. TV TELEMETRIYA HODISASINI QABUL QILISH (/api/tv-telemetry)
  if (req.method === 'POST' && pathname === '/api/tv-telemetry') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: "Noto'g'ri JSON formati" }));
        return;
      }
      const clientIp = req.socket.remoteAddress;
      const ua = body.userAgent || req.headers['user-agent'] || '';
      const eventType = body.type || 'TV_CLIENT_EVENT';
      const eventStatus = body.status || 200;
      const eventDetail = body.detail || null;
      const eventPath = body.path || pathname;

      const log = recordTvEvent(eventType, clientIp, ua, eventPath, eventStatus, eventDetail);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, log }));
    });
    return;
  }

  // F6. TV TELEMETRIYA LOGLARINI TOZALASH (/api/tv-telemetry/clear)
  if (req.method === 'POST' && pathname === '/api/tv-telemetry/clear') {
    tvTelemetryLogs.length = 0;
    recordTvEvent('LOGS_CLEARED', req.socket.remoteAddress, req.headers['user-agent'], pathname, 200, 'Foydalanuvchi tomonidan loglar tozalandi');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, message: 'Loglar tozalandi' }));
    return;
  }
  if (req.method === 'GET' && pathname === '/api/karmed-overview-stats') {
    try {
      const { logDir } = getDailyLogInfo();
      const trafficFile = path.join(logDir, 'karmed_traffic.json');
      let totalRequests = 0;
      let recent = [];
      if (fs.existsSync(trafficFile)) {
        const d = JSON.parse(fs.readFileSync(trafficFile, 'utf8'));
        const list = d.requests || d.summary || [];
        totalRequests = list.length;
        recent = list.slice(0, 30);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, totalRequests, recent, profiles: getKarmedProfiles() }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // G. KARMED MONITORING SO'ROVLARI DOIMIY AVTO-SAQLASH STREAMI (/api/karmed-auto-save)
  if (req.method === 'POST' && pathname === '/api/karmed-auto-save') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri so'rov formati" }));
        return;
      }
      try {
        const clientIp = req.socket.remoteAddress || '';
        const batch = body.requests || [];
        const profile = body.profile || null;
        const resStats = saveAutoSaveTraffic(batch, profile, clientIp);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, saved: true, ...resStats }));
      } catch (saveErr) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, error: saveErr.message }));
      }
    });
    return;
  }

  // G2. PROFILNI SERVERGA SINXRONLASH (/api/karmed-profile-sync)
  if (req.method === 'POST' && pathname === '/api/karmed-profile-sync') {
    parseJsonBody(req, (err, body) => {
      if (err || !body || !body.profile) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: "Profil ma'lumotlari kiritilmadi" }));
        return;
      }
      const savedProf = saveKarmedProfile(body.profile);
      // Profil o'zgarganda foydalanuvchi sessiya nusxasini ham arxivlash
      saveUserSessionSnapshot(body.profile);
      recordSystemEvent('KARMED_PROFILE_SYNC', `Karmed profili sinxronlandi: ${savedProf?.username} (${savedProf?.fullName})`, req.socket.remoteAddress);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, profile: savedProf }));
    });
    return;
  }

  // G2_A. FOYDALANUVCHI SESSIYA NUSXASINI SAQLASH (/api/karmed-save-user-snapshot)
  if (req.method === 'POST' && pathname === '/api/karmed-save-user-snapshot') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: "Ma'lumot kiritilmadi" }));
        return;
      }
      const snapshot = saveUserSessionSnapshot(body);
      const uname = snapshot?.username || 'R5';
      const fname = snapshot?.fullName || '';
      recordSystemEvent('USER_SNAPSHOT', `Foydalanuvchi sessiyasi nusxalandi: ${uname} (${fname})`, req.socket.remoteAddress, { sessionId: snapshot?.sessionId });
      writeToDailyLog(`[USER_SNAPSHOT] ${uname} (${fname}) nusxalandi: SessionId=${snapshot?.sessionId}`);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, snapshot }));
    });
    return;
  }

  // G2_B. FOYDALANUVCHILAR SESSIYA TARIXINI OLISH (/api/karmed-users-history)
  if (req.method === 'GET' && pathname === '/api/karmed-users-history') {
    const history = getUserSessionsHistory();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, history }));
    return;
  }

  // G2_C. FOYDALANUVCHILAR SESSIYALARINI JSON QILIB YUKLAB OLISH (/api/karmed-users-history/download)
  if (req.method === 'GET' && pathname === '/api/karmed-users-history/download') {
    const history = getUserSessionsHistory();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="karmed_users_history.json"',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(history, null, 2));
    return;
  }

  // G3. BARCHA AKTIV PROFILLLARNI OLISH (/api/karmed-profiles)
  if (req.method === 'GET' && pathname === '/api/karmed-profiles') {
    const profs = getKarmedProfiles();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, profiles: profs }));
    return;
  }

  // G4. KARMED MONITORING SO'ROVLARI LOGI (/api/karmed-traffic)
  if (req.method === 'POST' && pathname === '/api/karmed-traffic') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri so'rov formati" }));
        return;
      }
      try {
        const { logDir } = getDailyLogInfo();
        const trafficFile = path.join(logDir, 'karmed_traffic.json');
        fs.writeFileSync(trafficFile, JSON.stringify(body, null, 2), 'utf8');
        writeToDailyLog(`[KARMED_TRAFFIC] Monitoringdan ${body.totalRequests || 0} ta so'rov qabul qilindi va ${trafficFile} ga saqlandi.`);
        recordSystemEvent('KARMED_TRAFFIC', `Karmed monitoringdan ${body.totalRequests || 0} ta so'rov qabul qilindi`, req.socket.remoteAddress);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, saved: true, total: body.totalRequests || 0 }));
      } catch (saveErr) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: saveErr.message }));
      }
    });
    return;
  }

  // =========================================================================
  // ADMIN DASHBORTI VA MOBIL AGENT API ENDPOINTLARI (PORT 9880 & 9881)
  // =========================================================================

  // H. ADMIN OVERVIEW (/api/admin/overview)
  if (req.method === 'GET' && pathname === '/api/admin/overview') {
    const ips = getLocalIpAddresses();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({
      success: true,
      totalPatients: latestQueueData.totalPatients || 0,
      doctors: latestQueueData.doctors || [],
      activeCalls,
      agentRequestCount: systemEvents.filter(e => e.type === 'AGENT_ACTION').length,
      recentEvents: systemEvents.slice(-100),
      karmedTarget: 'http://192.168.150.111:2025/',
      localIps: ips,
      serverTime: new Date().toISOString()
    }));
    return;
  }

  // I. ADMIN LIVE FEED SSE (/api/admin/live-feed)
  if (req.method === 'GET' && pathname === '/api/admin/live-feed') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({
      type: 'OVERVIEW_UPDATE',
      totalPatients: latestQueueData.totalPatients || 0,
      doctors: latestQueueData.doctors || [],
      activeCalls,
      recentEvents: systemEvents.slice(-50)
    })}\n\n`);

    adminSseClients.add(res);
    req.on('close', () => adminSseClients.delete(res));
    return;
  }

  // J. ADMIN ANALITIKA HISOBOTI (/api/admin/analytics-report)
  if (req.method === 'POST' && pathname === '/api/admin/analytics-report') {
    parseJsonBody(req, async (err, body) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri so'rov" }));
        return;
      }
      const now = new Date();
      const pad = n => (n < 10 ? '0' : '') + n;
      const todayStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

      const startDate = (body && body.startDate) || todayStr;
      const endDate = (body && body.endDate) || todayStr;
      const forceRefresh = !!(body && body.forceRefresh);

      try {
        const report = await adminAnalytics.getAdminAnalytics({ startDate, endDate, forceRefresh });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(report));
      } catch (apiErr) {
        console.error('[Admin Analytics API Error]:', apiErr.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: apiErr.message }));
      }
    });
    return;
  }

  // K. ADMIN NARXLAR TARIFNOMASI (/api/admin/price-catalog)
  if (req.method === 'GET' && pathname === '/api/admin/price-catalog') {
    try {
      const catalog = adminAnalytics.getPriceCatalog();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, ...catalog }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, message: err.message }));
    }
    return;
  }

  // L. ADMIN ANALITIKA EXCEL (CSV) EKSPORT (/api/admin/analytics-export)
  if (req.method === 'GET' && pathname === '/api/admin/analytics-export') {
    const now = new Date();
    const pad = n => (n < 10 ? '0' : '') + n;
    const todayStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

    const startDate = parsedUrl.searchParams.get('startDate') || todayStr;
    const endDate = parsedUrl.searchParams.get('endDate') || todayStr;
    const type = parsedUrl.searchParams.get('type') || 'all';

    adminAnalytics.getAdminAnalytics({ startDate, endDate, forceRefresh: false })
      .then(report => {
        const csv = adminAnalytics.generateCsvExport(report, type);
        const fileName = `UTT_Hisobot_${startDate}_${endDate}_${type}.csv`;

        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(csv);
      })
      .catch(err => {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("Eksport xatosi: " + err.message);
      });
    return;
  }

  // M. BEMORNING KARMED TASHXISI VA BARCHA TEKSHIRUV ORGANLARI (/api/admin/patient-details)
  if (req.method === 'GET' && pathname === '/api/admin/patient-details') {
    const labDosyaId = parsedUrl.searchParams.get('labDosyaId');
    const onKayitId = parsedUrl.searchParams.get('onKayitId') || 0;
    const yatPol = parsedUrl.searchParams.get('yatPol') || 'P';
    const protokolNo = parsedUrl.searchParams.get('protokolNo') || '';
    const patientId = parsedUrl.searchParams.get('patientId') || '';
    const fullName = parsedUrl.searchParams.get('fullName') || '';
    const kurumAdi = parsedUrl.searchParams.get('kurumAdi') || '';
    const connectedRoom = parsedUrl.searchParams.get('connectedRoom') || '';
    const acceptingDoctor = parsedUrl.searchParams.get('acceptingDoctor') || parsedUrl.searchParams.get('reportAuthor') || '';
    const referringDoctor = parsedUrl.searchParams.get('referringDoctor') || '';

    if (!labDosyaId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, message: "labDosyaId kiritilmadi" }));
      return;
    }

    adminAnalytics.fetchPatientServicesFromKarmed({
      labDosyaId,
      onKayitId,
      yatPol,
      dosyaNo: protokolNo,
      patientId,
      fullName,
      kurumAdi,
      connectedRoom,
      acceptingDoctor,
      reportAuthor: acceptingDoctor,
      referringDoctor
    })
      .then(details => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, details }));
      })
      .catch(err => {
        console.error('[Patient Details API Error]:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: err.message }));
      });
    return;
  }

  // N. ID KODLAR BO'YICHA MAXSUS KARMED REESTRI (/api/admin/custom-reestr)
  if (req.method === 'POST' && pathname === '/api/admin/custom-reestr') {
    parseJsonBody(req, async (err, body) => {
      if (err) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri JSON formati" }));
        return;
      }
      try {
        const ids = (body && body.ids) || '';
        const startDate = (body && body.startDate) || '01.08.2026';
        const endDate = (body && body.endDate) || '31.08.2026';
        const forceFresh = body ? body.forceFresh !== false : true;

        const result = await adminAnalytics.calculateCustomReestrByIds({
          ids,
          startDate,
          endDate,
          forceFresh
        });

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(result));
      } catch (calcErr) {
        console.error('[Custom Reestr Error]:', calcErr);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: calcErr.message }));
      }
    });
    return;
  }

  // O. ID KODLAR BO'YICHA REESTRNI EXCEL (CSV) EKSPORT QILISH (/api/admin/custom-reestr-export)
  if ((req.method === 'POST' || req.method === 'GET') && pathname === '/api/admin/custom-reestr-export') {
    const handleExport = async (ids, startDate, endDate) => {
      try {
        const result = await adminAnalytics.calculateCustomReestrByIds({
          ids,
          startDate: startDate || '01.08.2026',
          endDate: endDate || '31.08.2026',
          forceFresh: false
        });
        const csv = adminAnalytics.generateGoogleSheetCsvExport(result.rows);
        const fileName = `Karmed_Reestr_${startDate}_${endDate}.csv`;

        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Access-Control-Allow-Origin': '*'
        });
        res.end(csv);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end("Eksport xatosi: " + err.message);
      }
    };

    if (req.method === 'POST') {
      parseJsonBody(req, (err, body) => {
        handleExport((body && body.ids) || '', (body && body.startDate), (body && body.endDate));
      });
    } else {
      const ids = parsedUrl.searchParams.get('ids') || '';
      const startDate = parsedUrl.searchParams.get('startDate') || '01.08.2026';
      const endDate = parsedUrl.searchParams.get('endDate') || '31.08.2026';
      handleExport(ids, startDate, endDate);
    }
    return;
  }

  // P. TELEGRAM BOT FOYDALANUVCHILARI RO'YXATI (/api/bot/users)
  if (req.method === 'GET' && pathname === '/api/bot/users') {
    const usersFile = path.join(ROOT_DIR, 'data', 'bot_users.json');
    let users = [];
    try {
      if (fs.existsSync(usersFile)) {
        users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      }
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: true, users }));
    return;
  }

  // Q. TELEGRAM BOT FOYDALANUVCHISI ROLINI O'ZGARTIRISH (/api/bot/set-role)
  if (req.method === 'POST' && pathname === '/api/bot/set-role') {
    parseJsonBody(req, (err, body) => {
      const usersFile = path.join(ROOT_DIR, 'data', 'bot_users.json');
      let users = [];
      try {
        if (fs.existsSync(usersFile)) {
          users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        }
      } catch (e) {}

      const user = users.find(u => String(u.id) === String(body && body.id));
      if (!user) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: "Bot foydalanuvchisi topilmadi" }));
      }

      user.role = (body && body.role === 'laborant') ? 'laborant' : 'user';
      user.updatedAt = new Date().toISOString();
      try {
        fs.writeFileSync(usersFile, JSON.stringify(users, null, 2), 'utf8');
      } catch (e) {}

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, user, message: `Foydalanuvchi roli ${user.role} ga o'zgartirildi` }));
    });
    return;
  }

  // I1. MOBIL AGENT AUTENTIFIKATSIYASI (/api/mobile-agent/login)
  // Foydalanuvchi login va paroli to'g'ridan-to'g'ri Karmed tizimiga yo'llanadi,
  // faqat Karmed ijobiy javob bergandan keyin profil F.I.SH va sessiya olinadi.
  if (req.method === 'POST' && pathname === '/api/mobile-agent/login') {
    parseJsonBody(req, async (err, body) => {
      if (err || !body || !body.username || !body.password) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: "Login va parol kiritilishi shart" }));
        return;
      }
      const username = String(body.username).trim().toUpperCase();
      const password = String(body.password).trim();
      const clientIp = req.socket.remoteAddress || '';

      // 1. So'rovni to'g'ridan-to'g'ri Karmed tizimiga yo'llash (Jonli tekshiruv)
      let karmedAuth = null;
      let karmedNetworkError = null;

      try {
        karmedAuth = await loginToKarmedLive(username, password);
      } catch (kErr) {
        console.warn(`[Karmed Auth Warning] ${username} uchun Karmed aloqa xatosi:`, kErr.message);
        karmedNetworkError = kErr;
      }

      let matchedUser = null;

      if (karmedAuth && karmedAuth.success) {
        // Karmed ijobiy javob berdi! Profil FISH va sessiya ma'lumotlari olindi
        matchedUser = {
          username: karmedAuth.username,
          fullName: karmedAuth.fullName,
          role: karmedAuth.role,
          sessionId: karmedAuth.sessionId,
          loginBilgi: karmedAuth.loginBilgi,
          karmedVerified: true,
          type: 'karmed_live_agent'
        };

        // Karmed profilini va foydalanuvchi sessiyasining nusxasini saqlash
        saveKarmedProfile({
          username: matchedUser.username,
          fullName: matchedUser.fullName,
          loginBilgi: karmedAuth.loginBilgi,
          cookie: karmedAuth.cookie
        });

        saveUserSessionSnapshot({
          username: matchedUser.username,
          fullName: matchedUser.fullName,
          sessionId: karmedAuth.sessionId,
          loginBilgi: karmedAuth.loginBilgi,
          cookie: karmedAuth.cookie,
          source: 'mobile_agent_karmed_login'
        });

      } else if (karmedAuth && !karmedAuth.success) {
        // Karmed login yoki parolni qabul qilmadi (Salbiy javob)
        recordSystemEvent('AUTH_FAILED', `Karmed rad etdi: ${username}`, clientIp);
        writeToDailyLog(`[AUTH_FAILED] ${username} Karmed tomonidan rad etildi: ${karmedAuth.message}`);
        res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          success: false,
          message: karmedAuth.message || "Karmed tizimi login yoki parolni qabul qilmadi. Foydalanuvchi nomi yoki maxfiy so'z xato!"
        }));
        return;

      } else if (karmedNetworkError) {
        // Agar Karmed serveri bilan tarmoq uzilgan bo'lsa, zaxira lokal bazadan tekshirish
        const agentUsers = getAgentAuthUsers();
        if (agentUsers[username] && String(agentUsers[username].password) === password) {
          matchedUser = {
            username,
            fullName: agentUsers[username].fullName || ('Foydalanuvchi ' + username),
            role: agentUsers[username].role || 'Registrator',
            type: 'agent_fallback',
            karmedVerified: false,
            offlineMode: true
          };
        } else {
          try {
            const docAuthFile = path.join(ROOT_DIR, 'data', 'doctors_auth.json');
            if (fs.existsSync(docAuthFile)) {
              const doctors = JSON.parse(fs.readFileSync(docAuthFile, 'utf8'));
              if (doctors[username] && String(doctors[username].password) === password) {
                matchedUser = {
                  username,
                  fullName: doctors[username].doctorName || doctors[username].shortName,
                  role: 'Shifokor (' + (doctors[username].roomTitle || '') + ')',
                  roomTitle: doctors[username].roomTitle,
                  roomId: doctors[username].roomId,
                  type: 'doctor_fallback',
                  karmedVerified: false,
                  offlineMode: true
                };
              }
            }
          } catch (de) {}
        }

        if (!matchedUser) {
          res.writeHead(503, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            success: false,
            message: `Karmed tizimiga ulanib bo'lmadi (${karmedNetworkError.message}) va foydalanuvchi lokal bazada topilmadi.`
          }));
          return;
        }
      }

      if (!matchedUser) {
        recordSystemEvent('AUTH_FAILED', `Mobil agentga noto'g'ri kirish urinishi: ${username}`, clientIp);
        res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: "Login yoki parol noto'g'ri" }));
        return;
      }

      const sessionToken = 'tok_agent_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      activeAgentSessions.set(sessionToken, {
        ...matchedUser,
        token: sessionToken,
        loginTime: new Date().toISOString(),
        lastSeen: new Date().toISOString()
      });

      const logMsg = `Mobil agentga kirildi: ${matchedUser.username} (${matchedUser.fullName}) [Karmed: ${matchedUser.karmedVerified ? 'TASDIQLANDI' : 'OFFLINE'}]`;
      recordSystemEvent('AGENT_LOGIN', logMsg, clientIp);
      writeToDailyLog(`[AGENT_LOGIN] ${logMsg}`);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({
        success: true,
        token: sessionToken,
        user: matchedUser
      }));
    });
    return;
  }

  // I2. MOBIL AGENT SESSIYASINI TEKSHIRISH (/api/mobile-agent/check-session)
  if (req.method === 'GET' && pathname === '/api/mobile-agent/check-session') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || (parsedUrl.searchParams.get('token'));
    if (token && activeAgentSessions.has(token)) {
      const session = activeAgentSessions.get(token);
      session.lastSeen = new Date().toISOString();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: true, user: session }));
      return;
    }
    res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ success: false, message: "Sessiya mavjud emas yoki muddati tugagan" }));
    return;
  }

  // J. KOMPYUTER AGENTI ORQALI SO'ROV BAJARISH (/api/agent/execute)
  if (req.method === 'POST' && pathname === '/api/agent/execute') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri so'rov formati" }));
        return;
      }
      const clientIp = req.socket.remoteAddress || '';
      const action = body.action || 'fetch_queue';
      const profName = String(body.profileUsername || 'R5').trim().toUpperCase();
      const allProfiles = getKarmedProfiles();
      const activeProf = allProfiles[profName] || allProfiles['R5'] || { username: 'R5', loginBilgi: '' };
      const currentToken = activeProf.loginBilgi || '';

      // 1. Karmeddan Bemor ID bo'yicha to'liq qidirish va ma'lumotlarni tartiblash
      if (action === 'search_patient_karmed') {
        const query = String(body.patientId || '').trim();
        if (!query) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, message: "Bemor ID raqami kiritilmadi" }));
          return;
        }

        // Avval lokal navbatdan tezkor qidirish
        let localMatch = null;
        if (latestQueueData && Array.isArray(latestQueueData.allPatients)) {
          localMatch = latestQueueData.allPatients.find(p => String(p.patientId) === query || String(p.dosyaNo) === query);
        }

        // Karmedga bevosita HastaSorgula so'rovi yuborish
        const isPinfl = query.length >= 12;
        const searchTur = isPinfl ? 'PINFL' : 'Bemor ID';
        const searchTurVal = isPinfl ? '1' : '0';
        const { dateStr } = getDailyLogInfo();
        const currentYear = new Date().getFullYear().toString();

        function buildHastaSorgulaParams(tok) {
          const params = new URLSearchParams();
          params.set('submitDirectEventConfig', JSON.stringify({ config: { extraParams: { aDosyaDurumu: null, aHizliAra: true } } }));
          params.set('cbYil', currentYear);
          params.set('_cbYil_state', JSON.stringify([{ value: currentYear, text: currentYear, index: 1 }]));
          params.set('cbHizliAramaTur', searchTur);
          params.set('_cbHizliAramaTur_state', JSON.stringify([{ value: searchTurVal, text: searchTur, index: isPinfl ? 1 : 0 }]));
          params.set('tfHizliAramaDeger', query);
          params.set('BaslangicDt', dateStr);
          params.set('BitisDt', dateStr);
          params.set('cbBolum', '');
          params.set('_cbBolum_state', '');
          params.set('cbAltBolum', '(Subbirliklar)');
          params.set('_cbAltBolum_state', JSON.stringify([{ value: '0', text: '(Subbirliklar)', index: 0 }]));
          params.set('cbBolumOda', '(Barcha Xonalar)');
          params.set('_cbBolumOda_state', JSON.stringify([{ value: '0', text: '(Barcha Xonalar)', index: 0 }]));
          params.set('cbBirimTuru', '(Butun Birlik)');
          params.set('_cbBirimTuru_state', JSON.stringify([{ value: '0', text: '(Butun Birlik)', index: 0 }]));
          params.set('cbBina', '(Butun Binolar)');
          params.set('_cbBina_state', JSON.stringify([{ value: '0', text: '(Butun Binolar)', index: 0 }]));
          params.set('cbKayitSayisiSecim', '100');
          params.set('_cbKayitSayisiSecim_state', JSON.stringify([{ value: '100', text: '100', index: 2 }]));
          params.set('hdnDosyaDurumu', '');
          params.set('btnBekleyen_Pressed', '');
          params.set('HdnBaseYazdirmaTuru', '-1');
          params.set('__VIEWSTATEGENERATOR', '5DE5E74B');
          params.set('hdnKrmdLoginBilgi', tok);
          params.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
          params.set('__EVENTARGUMENT', '-|public|HastaSorgula');
          return params.toString();
        }

        async function executeSearchFlow() {
          let tok = currentToken;
          let cookie = activeProf.cookie || '';

          // Agar token yoki cookie bo'lmasa, live login qilish
          if (!tok || !cookie) {
            try {
              const liveLogin = await loginToKarmedLive(profName, '17720');
              if (liveLogin && liveLogin.success) {
                tok = liveLogin.loginBilgi;
                cookie = liveLogin.cookie;
                saveKarmedProfile({ username: profName, loginBilgi: tok, cookie });
              }
            } catch (le) {
              console.warn('[Search Live Login Warning]:', le.message);
            }
          }

          function sendQuery(t, c, cb) {
            const pData = buildHastaSorgulaParams(t);
            queryKarmedEndpoint('?action=HastaSorgula', pData, c, cb);
          }

          sendQuery(tok, cookie, async (karmedErr, statusCode, resBody) => {
            // Agar sessiya muddati tugagan bo'lsa (Login.aspx ga qaytgan bo'lsa)
            if (resBody && (resBody.includes('Login.aspx') || resBody.includes('ResLogin') || resBody.includes('MakeLogin'))) {
              console.log('[Karmed Search] Sessiya muddati tugagan, avtomatik jonli login qilinmoqda...');
              try {
                const refreshed = await loginToKarmedLive(profName, '17720');
                if (refreshed && refreshed.success) {
                  tok = refreshed.loginBilgi;
                  cookie = refreshed.cookie;
                  saveKarmedProfile({ username: profName, loginBilgi: tok, cookie });
                  return sendQuery(tok, cookie, (rErr, rStatus, rBody) => {
                    processSearchResponse(rErr, rStatus, rBody, tok, cookie);
                  });
                }
              } catch (reAuthErr) {
                console.warn('[Re-auth Error]:', reAuthErr.message);
              }
            }
            processSearchResponse(karmedErr, statusCode, resBody, tok, cookie);
          });
        }

        function processSearchResponse(karmedErr, statusCode, resBody, activeTok, activeCookie) {
          if (karmedErr) {
            console.warn('[Agent Search Warning] Karmed aloqa xatosi, lokal navbatdan foydalaniladi:', karmedErr.message);
            if (localMatch) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ success: true, source: 'local_queue', patient: localMatch }));
              return;
            }
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: false, error: karmedErr.message }));
            return;
          }

          // Tokenni yangilash
          const extractedTok = extractKarmedLoginBilgi(resBody);
          if (extractedTok) {
            activeTok = extractedTok;
            saveKarmedProfile({ username: profName, loginBilgi: extractedTok });
          }

          // Bemorlar ro'yxatini ajratish
          const dataMatch = resBody.match(/App\.grdHastalarStore\.proxy\.data\s*=\s*(\[.*?\]);/s);
          const pList = dataMatch ? safeParseExtNetJson(dataMatch[1]) : null;

          if (!pList || pList.length === 0) {
            if (localMatch) {
              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ success: true, source: 'local_queue', patient: localMatch }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: false, message: `Bemor (ID: ${query}) Karmed tizimida topilmadi` }));
            return;
          }

          // Eng to'g'ri va faol dosyani tanlash (Bugungi, kutayotgan yoki modalitetga mos)
          let kp = null;
          const targetModality = String(body.modality || 'UTT').toUpperCase();

          // 1. Agar lokal bugungi navbatdagi dosyaNo bilan bir xil bo'lsa
          if (localMatch && localMatch.dosyaNo) {
            kp = pList.find(p => String(p.ProtokolNo) === String(localMatch.dosyaNo) && String(p.Durum || '').toLowerCase().includes('bekleyen'));
            if (!kp) kp = pList.find(p => String(p.ProtokolNo) === String(localMatch.dosyaNo));
          }

          // 2. Aks holda modalitetga mos va kutayotgan (Bekleyen) dosyani tanlash
          if (!kp) {
            kp = pList.find(p => {
              const b = String(p.AltBolumAdi || '').toLowerCase();
              const isBekleyen = String(p.Durum || '').toLowerCase().includes('bekleyen');
              if (targetModality === 'UTT' && (b.includes('ultratovush') || b.includes('dopler')) && isBekleyen) return true;
              if (targetModality === 'MRT' && (b.includes('mrt') || b.includes('mr')) && isBekleyen) return true;
              if (targetModality === 'MSKT' && (b.includes('mskt') || b.includes('kt')) && isBekleyen) return true;
              return false;
            });
          }

          // 3. Aks holda modalitetga mos har qanday dosya
          if (!kp) {
            kp = pList.find(p => {
              const b = String(p.AltBolumAdi || '').toLowerCase();
              if (targetModality === 'UTT' && (b.includes('ultratovush') || b.includes('dopler'))) return true;
              if (targetModality === 'MRT' && (b.includes('mrt') || b.includes('mr'))) return true;
              if (targetModality === 'MSKT' && (b.includes('mskt') || b.includes('kt'))) return true;
              return false;
            });
          }

          // 4. Aks holda kutayotgan (Bekleyen) har qanday bugungi dosya
          if (!kp) {
            kp = pList.find(p => String(p.Durum || '').toLowerCase().includes('bekleyen'));
          }

          // 5. Aks holda eng oxirgi ro'yxatga olingan dosya
          if (!kp) {
            const sorted = [...pList].sort((a, b) => new Date(b.KayitTarihi || 0) - new Date(a.KayitTarihi || 0));
            kp = sorted[0] || pList[0];
          }

          const qNumber = localMatch ? (localMatch.globalQueueNo || localMatch.queueNo) : (kp.MuayeneSirano || null);
          const formattedPatient = {
            patientId: String(kp.KimlikNo || query),
            dosyaNo: String(kp.ProtokolNo || ''),
            fullName: (localMatch && localMatch.fullName) || kp.AdSoyad || (kp.HastaAdi + ' ' + kp.Soyadi),
            room: kp.AltBolumAdi || (localMatch && localMatch.room) || '',
            referringDoctor: kp.DosyaDoktoru || (localMatch && localMatch.referringDoctor) || '',
            registrationTime: kp.KayitTarihi ? new Date(kp.KayitTarihi).toLocaleTimeString().slice(0, 5) : '',
            registrationDate: kp.KayitTarihi ? new Date(kp.KayitTarihi).toLocaleDateString() : '',
            rawLabDosyaId: kp.Id,
            dosyaId: kp.Id,
            queueNo: localMatch ? localMatch.queueNo : (kp.MuayeneSirano || '?'),
            globalQueueNo: localMatch ? localMatch.globalQueueNo : (kp.MuayeneSirano || null),
            queueNum: qNumber,
            status: kp.Durum || 'Bekleyen',
            services: [],
            allDosyas: pList.map(p => ({
              id: p.Id,
              protokolNo: p.ProtokolNo,
              altBolumAdi: p.AltBolumAdi,
              durum: p.Durum,
              kayitTarihi: p.KayitTarihi,
              muayeneSirano: p.MuayeneSirano
            }))
          };

          // Tekshiruvlarni (TaniHizmetBilgisiGetir) olish uchun dosyalarni aniqlash
          const dosyasToFetch = [kp];
          pList.forEach(p => {
            if (p.Id !== kp.Id && String(p.Durum || '').toLowerCase().includes('bekleyen')) {
              if (dosyasToFetch.length < 4) dosyasToFetch.push(p);
            }
          });

          // Dosyalar bo'yicha barcha xizmatlarni parallel tortib olish
          const servicePromises = dosyasToFetch.map(dosya => {
            return new Promise(resolveService => {
              const tParams = new URLSearchParams();
              tParams.set('submitDirectEventConfig', JSON.stringify({
                config: {
                  extraParams: {
                    aLabDosyaId: dosya.Id,
                    aOnkayitSiraNo: dosya.MuayeneSirano || 0,
                    aYatPol: dosya.YatPol || "P",
                    aProtokolNo: dosya.ProtokolNo,
                    aKimlikId: dosya.KimlikNo,
                    aHastaAdi: dosya.AdSoyad || (dosya.HastaAdi + ' ' + dosya.Soyadi),
                    aBolumId: dosya.BolumId || 10,
                    mrrsProtokolNo: null
                  }
                }
              }));
              tParams.set('hdnKrmdLoginBilgi', activeTok);
              tParams.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
              tParams.set('__EVENTARGUMENT', '-|public|TaniHizmetBilgisiGetir');

              queryKarmedEndpoint('?action=TaniHizmetBilgisiGetir', tParams.toString(), activeCookie || '', (tErr, tStatus, tBody) => {
                if (tErr || !tBody) return resolveService({ diagnosis: '', services: [] });
                let diagnosis = '';
                const diagMatch = tBody.match(/App\.lblTanilar\.setText\("([^"]+)"/) ||
                                  tBody.match(/App\.lblTanilar\.setText\(\"([^\\"]+)\"/);
                if (diagMatch) diagnosis = diagMatch[1];

                const sResult = [];
                const hizMatch = tBody.match(/App\.grdHizmetlerStore\.loadData\((\[.*?\])\);/s);
                if (hizMatch) {
                  const sList = safeParseExtNetJson(hizMatch[1]);
                  if (Array.isArray(sList)) {
                    sList.forEach(s => {
                      const cls = classifyMedicalService(s);
                      sResult.push({
                        id: s.Id,
                        dosyaId: dosya.Id,
                        dosyaProtokol: dosya.ProtokolNo,
                        altBolumAdi: dosya.AltBolumAdi,
                        name: s.TetkikIsmi,
                        code: s.KodAra,
                        doctor: s.IDoktorAdSoyad || s.DoktorAdSoyad,
                        status: s.RaporOnayli ? 'Tasdiqlangan' : (s.RaporYazili ? 'Yozilgan' : 'Kutilmoqda'),
                        ...cls
                      });
                    });
                  }
                }
                resolveService({ diagnosis, services: sResult });
              });
            });
          });

          Promise.all(servicePromises).then(results => {
            const allServices = [];
            const seenServiceIds = new Set();
            let diagnosis = '';

            results.forEach(r => {
              if (r.diagnosis && !diagnosis) diagnosis = r.diagnosis;
              (r.services || []).forEach(s => {
                if (!seenServiceIds.has(s.id)) {
                  seenServiceIds.add(s.id);
                  allServices.push(s);
                }
              });
            });

            if (diagnosis) formattedPatient.diagnosis = diagnosis;
            formattedPatient.services = allServices;
            formattedPatient.groupedServices = {
              utt: allServices.filter(s => s.category === 'UTT'),
              mrt: allServices.filter(s => s.category === 'MRT'),
              kt: allServices.filter(s => s.category === 'KT'),
              rentgen: allServices.filter(s => s.category === 'RENTGEN'),
              boshqa: allServices.filter(s => s.category === 'BOSHQA')
            };
            formattedPatient.serviceCounts = {
              total: allServices.length,
              utt: formattedPatient.groupedServices.utt.length,
              mrt: formattedPatient.groupedServices.mrt.length,
              kt: formattedPatient.groupedServices.kt.length,
              rentgen: formattedPatient.groupedServices.rentgen.length,
              boshqa: formattedPatient.groupedServices.boshqa.length
            };

            recordSystemEvent('AGENT_ACTION', `Mobil Agent (${profName}): Bemor topildi ID: ${query} (${formattedPatient.fullName})`, clientIp);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: true, source: 'karmed_live', patient: formattedPatient }));
          }).catch(err => {
            recordSystemEvent('AGENT_ACTION', `Mobil Agent (${profName}): Bemor xizmatlarini olishda xatolik: ${err.message}`, clientIp);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: true, source: 'karmed_live', patient: formattedPatient }));
          });
        }

        executeSearchFlow();
        return;
      }

      // 2. Karmedda Bemor Yo'naltirilgan Xonani/Vrachni O'zgartirish (AltBolumuDegistir)
      if (action === 'change_room_karmed') {
        const { dosyaId, targetAltBolumId, targetOdaId } = body;
        if (!dosyaId || !targetAltBolumId) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, message: "dosyaId va targetAltBolumId kiritilishi shart" }));
          return;
        }

        const params = new URLSearchParams();
        params.set('submitDirectEventConfig', JSON.stringify({
          config: {
            extraParams: {
              aLabDoysaId: parseInt(dosyaId, 10),
              aYeniAltBolumId: parseInt(targetAltBolumId, 10),
              aYeniOdaId: targetOdaId ? parseInt(targetOdaId, 10) : null
            }
          }
        }));
        params.set('cbBolum', '');
        params.set('btnBekleyen_Pressed', 'true');
        params.set('hdnDosyaDurumu', '');
        params.set('hdnKrmdLoginBilgi', currentToken);
        params.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
        params.set('__EVENTARGUMENT', '-|public|AltBolumuDegistir');

        queryKarmedEndpoint('?action=AltBolumuDegistir', params.toString(), activeProf.cookie || '', (err, status, rBody) => {
          if (err) {
            recordSystemEvent('AGENT_ACTION', `Xona o'zgartirish xatosi: ${err.message}`, clientIp);
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }

          // Yangi tokenni saqlash
          const tm = extractKarmedLoginBilgi(rBody);
          if (tm) {
            saveKarmedProfile({ username: profName, loginBilgi: tm });
          }

          const logMsg = `Bemor xonasi o'zgartirildi (Dosya: ${dosyaId}, Yangi AltBolum: ${targetAltBolumId}, Oda: ${targetOdaId || 'yoq'}, Profil: ${profName})`;
          recordSystemEvent('AGENT_ACTION', logMsg, clientIp);
          writeToDailyLog(`[AGENT_ACTION] ${logMsg}`);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, message: "Xona muvaffaqiyatli o'zgartirildi" }));
        });
        return;
      }

      // 3. Qabul Qilish (accept_patient_karmed)
      if (action === 'accept_patient_karmed') {
        const { dosyaId } = body;
        const logMsg = `Mobil Agent (${profName}): Bemor qabul qilindi (Dosya/ID: ${dosyaId})`;
        recordSystemEvent('AGENT_ACTION', logMsg, clientIp);
        writeToDailyLog(`[AGENT_ACTION] ${logMsg}`);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, message: "Bemor qabul qilindi" }));
        return;
      }

      // 4. Qabulni Bekor Qilish (cancel_accept_karmed / DosyaIptal)
      if (action === 'cancel_accept_karmed') {
        const { dosyaId } = body;
        if (!dosyaId) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, message: "dosyaId kiritilmadi" }));
          return;
        }

        const params = new URLSearchParams();
        params.set('submitDirectEventConfig', JSON.stringify({ config: { extraParams: { aDosyaId: parseInt(dosyaId, 10) } } }));
        params.set('cbYil', '2026');
        params.set('_cbYil_state', JSON.stringify([{ value: '2026', text: '2026', index: 1 }]));
        params.set('hdnKrmdLoginBilgi', currentToken);
        params.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
        params.set('__EVENTARGUMENT', 'RbysDosya|public|DosyaIptal');

        queryKarmedEndpoint('?action=DosyaIptal', params.toString(), activeProf.cookie || '', (err, status, rBody) => {
          if (err) {
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: false, error: err.message }));
            return;
          }

          const tm = rBody.match(/App\.hdnKrmdLoginBilgi\.setValue\("([^"]+)"\)/) ||
                     rBody.match(/App\.hdnKrmdLoginBilgi\.setValue\(\"([^\\"]+)\"\)/);
          if (tm && tm[1]) saveKarmedProfile({ username: profName, loginBilgi: tm[1] });

          const logMsg = `Mobil Agent (${profName}): Bemor qabuli Karmedda bekor qilindi (DosyaId: ${dosyaId})`;
          recordSystemEvent('AGENT_ACTION', logMsg, clientIp);
          writeToDailyLog(`[AGENT_ACTION] ${logMsg}`);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: true, message: "Qabul muvaffaqiyatli bekor qilindi (DosyaIptal)" }));
        });
        return;
      }

      // 1. Navbatni olish
      if (action === 'fetch_queue') {
        recordSystemEvent('AGENT_ACTION', 'Mobil Agent: Navbat ro\'yxati yangilandi', clientIp, { total: latestQueueData.totalPatients || 0 });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, queue: latestQueueData }));
        return;
      }

      // 2. Bemor qidirish
      if (action === 'search_patient') {
        const query = String(body.params?.query || '').trim().toLowerCase();
        const matches = [];
        (latestQueueData.doctors || []).forEach(doc => {
          (doc.patients || []).forEach(p => {
            if (String(p.patientId || '').toLowerCase().includes(query) ||
                String(p.fullName || '').toLowerCase().includes(query)) {
              matches.push({
                ...p,
                roomTitle: doc.id,
                doctorName: doc.doctorName
              });
            }
          });
        });
        recordSystemEvent('AGENT_ACTION', `Mobil Agent: Bemor qidirildi ("${query}") -> ${matches.length} ta topildi`, clientIp);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true, matches }));
        return;
      }

      // 3. Karmed so'rovini proxy qilish (kompyuter nomidan 192.168.150.111:2025 ga yuborish)
      if (action === 'karmed_request' || action === 'karmed_raw') {
        const targetUrl = body.url || 'http://192.168.150.111:2025/';
        const method = (body.method || 'GET').toUpperCase();
        const headers = body.headers || {};
        const startTime = Date.now();

        try {
          const parsedTarget = new URL(targetUrl);
          const reqOpts = {
            hostname: parsedTarget.hostname,
            port: parsedTarget.port || 80,
            path: parsedTarget.pathname + parsedTarget.search,
            method,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KarmedAgent/1.0',
              ...headers
            },
            timeout: 8000
          };

          const proxyReq = http.request(reqOpts, (proxyRes) => {
            let resData = '';
            proxyRes.on('data', chunk => resData += chunk);
            proxyRes.on('end', () => {
              const durationMs = Date.now() - startTime;
              const logMsg = `Karmed so'rovi: [${method}] ${targetUrl} -> ${proxyRes.statusCode} (${durationMs}ms)`;
              recordSystemEvent('AGENT_ACTION', logMsg, clientIp, { status: proxyRes.statusCode, durationMs });
              writeToDailyLog(`[AGENT_ACTION] ${logMsg} (Client: ${clientIp})`);

              res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({
                success: true,
                statusCode: proxyRes.statusCode,
                statusText: proxyRes.statusMessage,
                headers: proxyRes.headers,
                durationMs,
                body: resData
              }));
            });
          });

          proxyReq.on('error', (reqErr) => {
            const durationMs = Date.now() - startTime;
            const errMsg = `Karmed ulanish xatosi: ${reqErr.message}`;
            recordSystemEvent('AGENT_ACTION', errMsg, clientIp);
            res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ success: false, error: reqErr.message, durationMs }));
          });

          if (body.body && method !== 'GET') {
            proxyReq.write(typeof body.body === 'string' ? body.body : JSON.stringify(body.body));
          }
          proxyReq.end();
        } catch (urlErr) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: urlErr.message }));
        }
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ success: false, message: "Noma'lum action" }));
    });
    return;
  }

  // =========================================================================
  // VRACHLAR PORTALI API ENDPOINTLARI (PORT 9878 & BOSHQA PORTLAR)
  // =========================================================================

  // 1. VRACH LOGIN (/api/doctor/login)
  if (req.method === 'POST' && pathname === '/api/doctor/login') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri so'rov formati" }));
        return;
      }

      const username = String(body.username || '').trim().toUpperCase();
      const password = String(body.password || '').trim();

      const authData = getDoctorsAuth();
      const doc = authData[username];

      if (!doc || doc.password !== password) {
        writeToDailyLog(`[AUTH_FAIL] Noto'g'ri login urinishi: ${username}`);
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Login yoki parol noto'g'ri!" }));
        return;
      }

      // Muvaffaqiyatli login
      const token = 'tok_' + username + '_' + Date.now();
      const doctorProfile = {
        username: doc.username,
        token: token,
        doctorName: doc.doctorName,
        shortName: doc.shortName,
        roomId: doc.roomId,
        roomNum: doc.roomNum,
        roomTitle: doc.roomTitle,
        kod: doc.kod,
        soundId: doc.soundId || 1
      };

      doctorSessions.set(token, doctorProfile);

      writeToDailyLog(`[AUTH_SUCCESS] Vrach kirdi: ${username} (${doc.doctorName}) -> ${doc.roomTitle}`);
      console.log(`[AUTH] Vrach muvaffaqiyatli kirdi: ${username} (${doc.doctorName})`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        doctor: doctorProfile
      }));
    });
    return;
  }

  // 2. VRACH PAROLINI O'ZGARTIRISH (/api/doctor/change-password)
  if (req.method === 'POST' && pathname === '/api/doctor/change-password') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri ma'lumot" }));
        return;
      }

      const username = String(body.username || '').trim().toUpperCase();
      const oldPassword = String(body.oldPassword || '').trim();
      const newPassword = String(body.newPassword || '').trim();

      if (!username || !newPassword) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Yangi parol bo'sh bo'lishi mumkin emas!" }));
        return;
      }

      const authData = getDoctorsAuth();
      const doc = authData[username];

      if (!doc || doc.password !== oldPassword) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Hozirgi eski parol noto'g'ri kiritildi!" }));
        return;
      }

      doc.password = newPassword;
      authData[username] = doc;
      saveDoctorsAuth(authData);

      writeToDailyLog(`[PASSWORD_CHANGED] Vrach ${username} (${doc.doctorName}) o'z parolini muvaffaqiyatli o'zgartirdi`);
      console.log(`[PASSWORD_CHANGED] Vrach ${username} paroli yangilandi`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: "Parol muvaffaqiyatli o'zgartirildi!" }));
    });
    return;
  }

  // 2.5. VRACH CHAQIRUV SIGNALINI YANGILASH (/api/doctor/update-sound)
  if (req.method === 'POST' && pathname === '/api/doctor/update-sound') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri ma'lumot" }));
        return;
      }

      const username = String(body.username || '').trim().toUpperCase();
      const soundId = parseInt(body.soundId, 10) || 1;

      const authData = getDoctorsAuth();
      const doc = authData[username];

      if (!doc) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Vrach topilmadi" }));
        return;
      }

      doc.soundId = soundId;
      authData[username] = doc;
      saveDoctorsAuth(authData);

      writeToDailyLog(`[SOUND_UPDATED] Vrach ${doc.doctorName} (${doc.roomTitle}) chaqiruv signalini o'zgartirdi: #${soundId}`);
      console.log(`[SOUND_UPDATED] Vrach ${username} chaqiruv signali #${soundId} ga o'zgartirildi`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, soundId: soundId }));
    });
    return;
  }

  // 3. VRACHNING XONASIDAGI BEMORLARNI OLISH (/api/doctor/my-queue)
  if (req.method === 'GET' && pathname === '/api/doctor/my-queue') {
    const username = (parsedUrl.searchParams.get('username') || '').trim().toUpperCase();
    const authData = getDoctorsAuth();
    const docProfile = authData[username];

    if (!docProfile) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: "Vrach topilmadi" }));
      return;
    }

    const roomId = docProfile.roomId; // Masalan: "Ultratovush-10"
    let doctorQueueItem = null;

    if (latestQueueData && Array.isArray(latestQueueData.doctors)) {
      doctorQueueItem = latestQueueData.doctors.find(d => 
        d.room === roomId || 
        d.id === roomId || 
        (d.doctorName && d.doctorName.toLowerCase().includes(docProfile.shortName.toLowerCase()))
      );
    }

    const patients = doctorQueueItem && Array.isArray(doctorQueueItem.patients) ? doctorQueueItem.patients : [];
    const activeCall = activeCalls[roomId] || null;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      room: roomId,
      doctorName: docProfile.doctorName,
      roomTitle: docProfile.roomTitle,
      soundId: docProfile.soundId || 1,
      patients: patients,
      activeCall: activeCall
    }));
    return;
  }

  // 4. VRACH TOMONIDAN BEMORNI CHAQIRISH (/api/doctor/call-patient)
  if (req.method === 'POST' && pathname === '/api/doctor/call-patient') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri ma'lumot" }));
        return;
      }

      const username = String(body.username || '').trim().toUpperCase();
      const patientId = String(body.patientId || '').trim();
      const fullName = String(body.fullName || '').trim();
      const queueNo = body.queueNo || '-';
      const registrationTime = body.registrationTime || '';

      const authData = getDoctorsAuth();
      const docProfile = authData[username];

      if (!docProfile) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Vrach avtorizatsiyadan o'tmagan" }));
        return;
      }

      const roomKey = docProfile.roomId; // "Ultratovush-10"
      const roomTitle = docProfile.roomTitle; // "UTT10-51 XONA"
      const doctorName = docProfile.doctorName;
      const soundId = parseInt(body.soundId, 10) || docProfile.soundId || 1;

      // Aktiv chaqiruvni o'rnatamiz
      const callData = {
        patientId: patientId,
        queueNo: queueNo,
        fullName: fullName,
        registrationTime: registrationTime,
        roomKey: roomKey,
        roomTitle: roomTitle,
        doctorName: doctorName,
        soundId: soundId,
        calledAt: new Date().toISOString(),
        status: 'calling'
      };

      activeCalls[roomKey] = callData;
      latestQueueData.activeCalls = activeCalls;
      saveQueueToFile(latestQueueData);

      // Barcha 4 ta portdagi barcha ekranlarga (TV, Registrator, Bemor mobil, Vrach) SSE orqali uzatamiz!
      broadcastEvent({
        type: 'CALL_UPDATE',
        action: 'calling',
        call: callData,
        activeCalls: activeCalls
      });

      const logMsg = `[PATIENT_CALL] Vrach ${doctorName} (${roomTitle}) bemor ${fullName} (Navbat №${queueNo}, ID: ${patientId}) ni xonaga chaqirdi [Signal #${soundId}]`;
      writeToDailyLog(logMsg);
      console.log(logMsg);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        activeCall: callData
      }));
    });
    return;
  }

  // 5. VRACH TOMONIDAN CHAQIRUVNI YAKUNLASH (/api/doctor/finish-call)
  if (req.method === 'POST' && pathname === '/api/doctor/finish-call') {
    parseJsonBody(req, (err, body) => {
      if (err || !body) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Noto'g'ri so'rov" }));
        return;
      }

      const username = String(body.username || '').trim().toUpperCase();
      const authData = getDoctorsAuth();
      const docProfile = authData[username];

      if (!docProfile) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: "Vrach avtorizatsiyadan o'tmagan" }));
        return;
      }

      const roomKey = docProfile.roomId;
      const prevCall = activeCalls[roomKey];
      delete activeCalls[roomKey];
      latestQueueData.activeCalls = activeCalls;
      saveQueueToFile(latestQueueData);

      // Barcha ekranlarga chaqiruv tugaganligini bildiramiz
      broadcastEvent({
        type: 'CALL_UPDATE',
        action: 'finished',
        roomKey: roomKey,
        activeCalls: activeCalls
      });

      const logMsg = `[PATIENT_FINISH] Vrach ${docProfile.doctorName} (${docProfile.roomTitle}) qabulni yakunladi. ` +
        (prevCall ? `(Bemor: ${prevCall.fullName}, №${prevCall.queueNo})` : '');
      writeToDailyLog(logMsg);
      console.log(logMsg);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    });
    return;
  }

  // =========================================================================
  // BEMORLAR MOBIL PORTALI API ENDPOINTLARI (PORT 9879 & BOSHQA PORTLAR)
  // =========================================================================

  // BEMOR QIDIRUVI: ID raqami yoki Familya/Ism bo'yicha (/api/patient/search?q=...)
  if (req.method === 'GET' && pathname === '/api/patient/search') {
    const q = (parsedUrl.searchParams.get('q') || '').toLowerCase().trim();
    if (!q) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, matches: [] }));
      return;
    }

    const matches = [];
    const doctors = latestQueueData.doctors || [];

    doctors.forEach(doc => {
      const patients = doc.patients || [];
      const totalInRoom = patients.length;
      const roomKey = doc.room;
      const roomTitle = doc.roomTitle || doc.room;
      const doctorName = doc.doctorName;
      const currentCall = activeCalls[roomKey];

      patients.forEach((p, idx) => {
        const idMatch = p.patientId && p.patientId.toLowerCase().includes(q);
        const nameMatch = p.fullName && p.fullName.toLowerCase().includes(q);

        if (idMatch || nameMatch) {
          const queueNo = p.queueNo || (idx + 1);
          const patientsAhead = idx; // Navbatda oldinda turganlar soni
          const isBeingCalled = !!(
            currentCall && 
            (
              (currentCall.patientId && p.patientId && String(currentCall.patientId).trim() === String(p.patientId).trim()) ||
              (String(currentCall.queueNo) === String(queueNo))
            )
          );

          matches.push({
            patientId: p.patientId || '',
            fullName: p.fullName || '',
            queueNo: queueNo,
            room: roomKey,
            roomTitle: roomTitle,
            doctorName: doctorName,
            registrationTime: p.registrationTime || '',
            patientsAhead: patientsAhead,
            totalInRoom: totalInRoom,
            isBeingCalled: isBeingCalled,
            calledAt: isBeingCalled && currentCall ? currentCall.calledAt : null
          });
        }
      });
    });

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true, matches }));
    return;
  }

  // =========================================================================
  // STATIK VEB SAHIFA VA FAYLLARNI TARQATISH
  // =========================================================================
  serveStaticFile(pathname, res, defaultHtml);
}

// 9. SAKKIZTA PORTDA SERVERLARNI ISHGA TUSHIRISH (UTT, MSKT VA MRT ALOHIDA PORTLARDA)
const serverRegistrator = http.createServer((req, res) => handleHttpRequest(req, res, 'index.html', PORT_REGISTRATOR));
const serverTv = http.createServer((req, res) => handleHttpRequest(req, res, 'tv.html', PORT_TV));
const serverDoctor = http.createServer((req, res) => handleHttpRequest(req, res, 'doctor.html', PORT_DOCTOR));
const serverPatient = http.createServer((req, res) => handleHttpRequest(req, res, 'patient.html', PORT_PATIENT));
const serverAdmin = http.createServer((req, res) => handleHttpRequest(req, res, 'admin.html', PORT_ADMIN));
const serverMobileUtt = http.createServer((req, res) => handleHttpRequest(req, res, 'mobile_agent_utt.html', PORT_MOBILE_UTT));
const serverMobileMskt = http.createServer((req, res) => handleHttpRequest(req, res, 'mobile_agent_mskt.html', PORT_MOBILE_MSKT));
const serverMobileMrt = http.createServer((req, res) => handleHttpRequest(req, res, 'mobile_agent_mrt.html', PORT_MOBILE_MRT));

// 1. Registrator Posti (9876)
serverRegistrator.listen(PORT_REGISTRATOR, HOST, () => {
  console.log(`[Port ${PORT_REGISTRATOR}] Registrator Posti & API Server ishga tushdi: http://localhost:${PORT_REGISTRATOR}`);
});

// 2. TV Jonli Monitor Ekrani (9877)
serverTv.listen(PORT_TV, HOST, () => {
  console.log(`[Port ${PORT_TV}] TV Jonli Monitor Ekrani ishga tushdi: http://localhost:${PORT_TV}`);
});

// 3. Vrach Qabulxona Profili (9878)
serverDoctor.listen(PORT_DOCTOR, HOST, () => {
  console.log(`[Port ${PORT_DOCTOR}] Vrach Qabulxona Profili ishga tushdi: http://localhost:${PORT_DOCTOR}`);
});

// 4. Bemorlar Mobil Portali (9879)
serverPatient.listen(PORT_PATIENT, HOST, () => {
  console.log(`[Port ${PORT_PATIENT}] Bemorlar Mobil Portali ishga tushdi: http://localhost:${PORT_PATIENT}`);
});

// 5. Admin Barcha Harakatlar Dashborti (9880)
serverAdmin.listen(PORT_ADMIN, HOST, () => {
  console.log(`[Port ${PORT_ADMIN}] Admin Barcha Harakatlar Dashborti ishga tushdi: http://localhost:${PORT_ADMIN}`);
});

// 6. 🎯 UTT Mobil Agenti (9881)
serverMobileUtt.listen(PORT_MOBILE_UTT, HOST, () => {
  console.log(`[Port ${PORT_MOBILE_UTT}] 🎯 UTT Mobil Agenti ishga tushdi: http://localhost:${PORT_MOBILE_UTT}`);
});

// 7. ⚡ MSKT Mobil Agenti (9882)
serverMobileMskt.listen(PORT_MOBILE_MSKT, HOST, () => {
  console.log(`[Port ${PORT_MOBILE_MSKT}] ⚡ MSKT Mobil Agenti ishga tushdi: http://localhost:${PORT_MOBILE_MSKT}`);
});

// 8. 🧲 MRT Mobil Agenti (9883)
serverMobileMrt.listen(PORT_MOBILE_MRT, HOST, () => {
  const ips = getLocalIpAddresses();
  const { dateStr, logFile } = getDailyLogInfo();

  console.log(`[Port ${PORT_MOBILE_MRT}] 🧲 MRT Mobil Agenti ishga tushdi: http://localhost:${PORT_MOBILE_MRT}`);
  console.log(`\n================================================================================`);
  console.log(`  RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI — UTT / MSKT / MRT (8 PORT)`);
  console.log(`================================================================================`);
  console.log(`  📅 Bugungi sana:          ${dateStr}`);
  console.log(`  📁 Kunlik log fayl:       ${logFile}`);
  console.log(`  🖥️  Registrator Posti:     http://localhost:${PORT_REGISTRATOR}`);
  console.log(`  📺 TV Jonli Ekran:        http://localhost:${PORT_TV}`);
  console.log(`  👨‍⚕️ Vrach Profili:        http://localhost:${PORT_DOCTOR}`);
  console.log(`  📱 Bemorlar Portali:      http://localhost:${PORT_PATIENT}`);
  console.log(`  🛡️ Admin Dashborti:      http://localhost:${PORT_ADMIN}`);
  console.log(`  🎯 UTT Mobil Agenti:      http://localhost:${PORT_MOBILE_UTT}`);
  console.log(`  ⚡ MSKT Mobil Agenti:     http://localhost:${PORT_MOBILE_MSKT}`);
  console.log(`  🧲 MRT Mobil Agenti:      http://localhost:${PORT_MOBILE_MRT}`);
  ips.forEach(ip => {
    console.log(`  ------------------------------------------------------------------------`);
    console.log(`  📶 Wi-Fi (${ip.iface}):`);
    console.log(`     🎯 UTT Mobil:   http://${ip.address}:${PORT_MOBILE_UTT}`);
    console.log(`     ⚡ MSKT Mobil:  http://${ip.address}:${PORT_MOBILE_MSKT}`);
    console.log(`     🧲 MRT Mobil:   http://${ip.address}:${PORT_MOBILE_MRT}`);
    console.log(`     🛡️ Admin:       http://${ip.address}:${PORT_ADMIN}`);
    console.log(`     📺 TV:          http://${ip.address}:${PORT_TV}`);
  });
  console.log(`================================================================================\n`);

  // KARMED DIRECT MASTER SYNC (v5.0.0) ISHGA TUSHIRISH
  startKarmedMasterSyncLoop();
});

// Xatoliklarni ushlab qolish
process.on('uncaughtException', (err) => {
  if (err && (err.code === 'EPIPE' || err.message?.includes('EPIPE'))) return;
  try {
    console.error('[Uncaught Exception]:', err);
  } catch (e) {}
  writeToDailyLog(`[CRITICAL_ERROR] Uncaught Exception: ${err ? err.message : ''}\n${err ? err.stack : ''}`);
});

process.on('unhandledRejection', (reason) => {
  try {
    console.error('[Unhandled Rejection]:', reason);
  } catch (e) {}
  writeToDailyLog(`[CRITICAL_ERROR] Unhandled Rejection: ${reason}`);
});
