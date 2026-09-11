/**
 * KARMED MONITORING - BACKGROUND SERVICE WORKER (v1.2.0)
 * 1. Karmed sessiya kukilari (ASP.NET_SessionId) ni doimiy kuzatadi va saqlaydi.
 * 2. Content scriptga cookie ma'lumotlarini taqdim etadi.
 * 3. Serverga faol sessiya ma'lumotlarini uzatadi.
 */

async function getKarmedCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ url: "http://192.168.150.111:2025/" });
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch (err) {
    return '';
  }
}

async function getKarmedSessionId() {
  try {
    const cookie = await chrome.cookies.get({ url: "http://192.168.150.111:2025/", name: "ASP.NET_SessionId" });
    return cookie ? cookie.value : '';
  } catch (e) {
    return '';
  }
}

// Xabarlarni tinglash
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_KARMED_COOKIES') {
    Promise.all([getKarmedCookies(), getKarmedSessionId()]).then(([cookieStr, sessionId]) => {
      sendResponse({ cookies: cookieStr, sessionId: sessionId });
    });
    return true; // async javob
  }
});

// Cookie o'zgarganda serverga sinxronlash
chrome.cookies.onChanged.addListener(async (changeInfo) => {
  if (changeInfo.cookie.domain && changeInfo.cookie.domain.includes('192.168.150.111')) {
    const cookieStr = await getKarmedCookies();
    if (cookieStr) {
      const urls = ['http://localhost:9876/api/karmed-profile-sync', 'http://10.34.17.210:9876/api/karmed-profile-sync'];
      for (const u of urls) {
        try {
          await fetch(u, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: {
                username: 'R5',
                cookie: cookieStr
              }
            })
          });
          break;
        } catch (e) {}
      }
    }
  }
});

console.log('[Karmed Monitor] Background Service Worker faol.');
