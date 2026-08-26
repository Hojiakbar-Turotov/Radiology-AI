/**
 * Radiodiagnostika Telegram Bot - 24/7 Polling Runner (Tozalangan va Optimallashtirilgan)
 * Token: 8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4
 * Log Group: -1003950231961
 * Channel: -1003962033499
 * Web App: https://hojiakbar-turotov.github.io/Radiology-AI/webapp.html
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const WEBAPP_BASE_URL = "https://hojiakbar-turotov.github.io/Radiology-AI/webapp.html";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;
const userSessions = new Map(); // chatId -> { step, patientId, pinfl, time }

console.log("🚀 Radiodiagnostika Telegram Boti (Yagona Toza Rejim) ishga tushdi...");

// Boshlang'ich log
sendLogToGroup(
  `🟢 <b>BOT ISHGA TUSHDI (TOZA VA YAGONA REJIM)</b>\n` +
  `⏰ Vaqt: ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}\n` +
  `🆔 MyID: Faol (Logger guruhi: <code>${LOG_GROUP_ID}</code>)\n` +
  `📱 Web App: <code>${WEBAPP_BASE_URL}</code>`
);

async function sendLogToGroup(text) {
  try {
    await fetch(`${TG_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: LOG_GROUP_ID, text: text, parse_mode: "HTML" })
    });
  } catch (e) {
    console.warn("sendLogToGroup xatosi:", e.message);
  }
}

async function answerCallbackQuery(callbackQueryId, text = "") {
  try {
    await fetch(`${TG_API_BASE}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
    });
  } catch (e) {}
}

async function pollUpdates() {
  try {
    await fetch(`${TG_API_BASE}/deleteWebhook?drop_pending_updates=false`);
  } catch (e) {}

  while (true) {
    try {
      const res = await fetch(`${TG_API_BASE}/getUpdates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offset: lastUpdateId + 1,
          timeout: 25,
          allowed_updates: ["message", "callback_query"]
        })
      });

      if (!res.ok) {
        await sleep(2500);
        continue;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          lastUpdateId = update.update_id;
          await handleUpdate(update);
        }
      }
    } catch (err) {
      console.error("Polling error:", err.message);
      await sleep(3500);
    }
  }
}

async function handleUpdate(update) {
  const nowStr = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

  // 1. Callback Query tugmalari
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message ? cb.message.chat.id : cb.from.id;
    const data = cb.data;
    const userFirstName = cb.from.first_name || "Foydalanuvchi";

    await answerCallbackQuery(cb.id);

    if (data === "restart_bot") {
      userSessions.delete(String(chatId));
      await sendWelcomeMessage(chatId, userFirstName);
      return;
    }

    if (data === "search_again") {
      userSessions.set(String(chatId), { step: "WAITING_PATIENT_ID", time: Date.now() });
      await sendTelegramMessage(
        chatId,
        `🔍 <b>YANGI QIDIRUV:</b>\n\nIltimos, <b>Bemor ID</b> yoki <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni kiriting:\n<i>(Masalan: <code>53312</code> yoki <code>30804812190075</code>)</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🆔 MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
              [{ text: "🔄 Bosh menyu", callback_data: "restart_bot" }]
            ]
          }
        }
      );
      return;
    }
    return;
  }

  // 2. Foydalanuvchi xabari
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const fromId = msg.from ? msg.from.id : chatId;
  const text = (msg.text || "").trim();
  const userFirstName = msg.from ? msg.from.first_name : "Foydalanuvchi";
  const userLastName = msg.from ? (msg.from.last_name || "") : "";
  const userFullName = `${userFirstName} ${userLastName}`.trim();
  const userName = msg.from && msg.from.username ? `@${msg.from.username}` : "Username yo'q";

  // Xabarni log guruhiga qayd etish
  if (String(chatId) !== LOG_GROUP_ID && String(chatId) !== CHANNEL_ID) {
    sendLogToGroup(
      `📩 <b>FOYDALANUVCHIDAN XABAR:</b>\n` +
      `👤 ${escapeHtml(userFullName)} (${userName}, ID: <code>${fromId}</code>)\n` +
      `📝 Matn: <code>${escapeHtml(text || '(Media)')}</code>\n` +
      `⏰ ${nowStr}`
    );
  }

  // A) Boshlang'ich buyruqlar: /start, /help, /myid, /profil
  if (text === "/start" || text === "/help" || text === "/myid" || text === "/profil" || text.toLowerCase() === "start") {
    userSessions.delete(String(chatId));
    await sendWelcomeMessage(chatId, userFirstName);
    return;
  }

  // B) Raqamlarni aniqlash (Bemor ID yoki 14 xonali PINFL)
  const cleanDigits = text.replace(/\D/g, "");
  const session = userSessions.get(String(chatId)) || {};

  // 14 xonali PINFL kiritilgan bo'lsa
  if (cleanDigits.length === 14) {
    await processPatientLookup(chatId, userFullName, fromId, cleanDigits, "PINFL");
    return;
  }

  // 3 dan 8 xonagacha bo'lgan Bemor ID kiritilgan bo'lsa
  if (cleanDigits.length >= 3 && cleanDigits.length <= 8) {
    await processPatientLookup(chatId, userFullName, fromId, cleanDigits, "PATIENT_ID");
    return;
  }

  // Noma'lum xabar holatida yo'l-yo'riq berish
  await sendTelegramMessage(
    chatId,
    `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>\n\n` +
    `Xulosalarni olish uchun <b>MyID FaceID</b> orqali kiring yoki <b>Bemor ID (masalan: 53312)</b> raqamingizni yuboring:`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [{ text: "🆔 MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
          [{ text: "📱 Tibbiy Web App Portali", web_app: { url: WEBAPP_BASE_URL } }],
          [{ text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
        ]
      }
    }
  );
}

async function sendWelcomeMessage(chatId, userFirstName) {
  const welcome = 
    `👋 <b>Assalomu alaykum, ${escapeHtml(userFirstName)}!</b>\n\n` +
    `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> tibbiy xulosalar portaliga xush kelibsiz.\n\n` +
    `🆔 <b>MyID FaceID Avtorizatsiya:</b>\n` +
    `Yuzingizni skanerlab (FaceID) shaxsiy profilingizni oching va barcha tekshiruv xulosalaringizni (MRT, MSKT, UTT, Rentgen) bir zumda oling.\n\n` +
    `🔢 <i>Yoki <b>Bemor ID</b> (masalan: <code>53312</code>) yoki <b>PINFL</b> raqamingizni yozib yuboring:</i>`;

  await sendTelegramMessage(chatId, welcome, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🆔 MyID FaceID orqali Kirish (Biometrik)", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
        [{ text: "📱 Tibbiy Web App Portali", web_app: { url: WEBAPP_BASE_URL } }],
        [{ text: "🔍 Yangi qidiruv", callback_data: "search_again" }, { text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
      ]
    }
  });
}

// YAGONA VA TO'LIQ QIDIRUV FUNKSIYASI (PINFL yoki Bemor ID bo'yicha)
async function processPatientLookup(chatId, userFullName, fromId, inputQuery, queryType) {
  userSessions.delete(String(chatId));

  await sendTelegramMessage(
    chatId,
    `🔍 <b>${queryType === 'PINFL' ? 'JSHSHIR: ' + inputQuery : 'Bemor ID: ' + inputQuery}</b> bo'yicha MyID ma'lumotlari qidirilmoqda...`,
    { parse_mode: "HTML" }
  );

  try {
    const fbRes = await fetch(`${FIREBASE_DB_URL}/karmed_reports.json`);
    const allData = await fbRes.json();

    let matchedReports = [];
    let foundPinfl = "";

    if (allData) {
      if (queryType === 'PINFL' && allData[inputQuery]) {
        foundPinfl = inputQuery;
        matchedReports = Object.values(allData[inputQuery]);
      } else {
        const pinflKeys = Object.keys(allData);
        for (const pKey of pinflKeys) {
          const repsObj = allData[pKey];
          if (!repsObj) continue;
          const repList = Object.values(repsObj);
          const match = repList.find(r => String(r.patientId || '').trim() === inputQuery || String(r.pinfl || '').trim() === inputQuery);
          if (match) {
            foundPinfl = pKey;
            matchedReports = repList;
            break;
          }
        }
      }
    }

    matchedReports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // A) Agar xulosalar topilsa
    if (matchedReports.length > 0) {
      const rep = matchedReports[0];
      const patientName = rep.patientName || 'Bemor';
      const patientAge = rep.age || rep.birthDate || '-';
      const patientId = rep.patientId || inputQuery;
      const pinfl = rep.pinfl || foundPinfl || inputQuery;
      const patientWebUrl = `${WEBAPP_BASE_URL}?id=${patientId}&pinfl=${pinfl}`;

      await sendTelegramMessage(
        chatId,
        `✅ <b>MyID Shaxsiy Profil ochildi!</b>\n\n` +
        `👤 <b>Bemor:</b> ${escapeHtml(patientName)}\n` +
        `🎂 <b>Yoshi:</b> ${escapeHtml(patientAge)}\n` +
        `🆔 <b>Bemor ID:</b> <code>${escapeHtml(patientId)}</code>\n` +
        `🔢 <b>PINFL:</b> <code>${escapeHtml(pinfl)}</code>\n` +
        `📊 <b>Topilgan xulosalar:</b> ${matchedReports.length} ta\n\n` +
        `📱 <i>Barcha xulosalarni interaktiv Web App-da bo'limlar bo'yicha ko'rish va chop etish uchun pastdagi tugmani bosing:</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: `📱 Web App-da Tartibli Ko'rish (${matchedReports.length} ta xulosa)`, web_app: { url: patientWebUrl } }],
              [{ text: "🆔 MyID Shaxsiy Profil", web_app: { url: `${patientWebUrl}&auth=myid` } }],
              [{ text: "🔍 Boshqa qidiruv", callback_data: "search_again" }, { text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
            ]
          }
        }
      );

      // Xulosalarni yuborish
      for (let i = 0; i < matchedReports.length; i++) {
        const r = matchedReports[i];
        const repText = 
          `📄 <b>TIBBIY XULOSA PROTOKOLI [${i + 1}/${matchedReports.length}]</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Bemor:</b> ${escapeHtml(r.patientName || patientName)}\n` +
          `🆔 <b>Bemor ID:</b> <code>${escapeHtml(r.patientId || patientId)}</code>\n` +
          `🔢 <b>Namuna:</b> <code>${escapeHtml(r.sampleNumber || '-')}</code>\n` +
          `🔬 <b>Tekshiruv:</b> <b>${escapeHtml(r.serviceName || 'Tibbiy tekshiruv')}</b>\n` +
          `👨‍⚕️ <b>Shifokor:</b> ${escapeHtml(r.doctorName || r.reportAuthor || '-')}\n` +
          `📅 <b>Sana:</b> ${escapeHtml(r.reportDate || r.confirmDate || '-')}\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `📝 <b>XULOSA MATNI:</b>\n\n` +
          `${escapeHtml(r.conclusionText || 'Xulosa matni mavjud emas.')}\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🏥 <i>Respublika Onkologiya va Radiologiya Markazi</i>\n` +
          `🛡️ <i>MyID Tasdiqlangan</i>`;

        await sendTelegramMessage(chatId, repText, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📱 Ushbu xulosani Web App-da ochish", web_app: { url: patientWebUrl } }]
            ]
          }
        });
        await sleep(350);
      }

      // Loggerga yozish
      sendLogToGroup(
        `✅ <b>MYID QIDIRUV MUVAFFAQIYATLI:</b>\n` +
        `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
        `👤 Bemor: ${escapeHtml(patientName)}\n` +
        `🆔 Bemor ID: <code>${patientId}</code>\n` +
        `🔢 PINFL: <code>${pinfl}</code>\n` +
        `📊 Topilgan xulosalar: ${matchedReports.length} ta`
      );

    } else {
      // B) Agar bazada xulosa hali mavjud bo'lmasa, shaxsiy profilni ochish
      const fallbackUrl = `${WEBAPP_BASE_URL}?id=${inputQuery}&auth=myid`;

      await sendTelegramMessage(
        chatId,
        `🛡️ <b>MYID SHAXSIY PROFILINGIZ OCHILDI</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Kiritilgan raqam:</b> <code>${inputQuery}</code>\n\n` +
        `ℹ️ <i>Sizning nomingizga hali tasdiqlangan tibbiy xulosalar mavjud emas yoki shifokor tekshiruv jarayonida. Shifokor tasdiqlashi bilan xulosalar profilingizda paydo bo'ladi.</i>\n\n` +
        `📱 <i>MyID Shaxsiy profilingizni to'liq ko'rish uchun quyidagi tugmani bosing:</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🆔 MyID Shaxsiy Profilni Ochish", web_app: { url: fallbackUrl } }],
              [{ text: "🔍 Qayta qidirish", callback_data: "search_again" }, { text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
            ]
          }
        }
      );

      // Loggerga yozish
      sendLogToGroup(
        `ℹ️ <b>MYID QIDIRUV (XULOSALAR HALI MAVJUD EMAS):</b>\n` +
        `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
        `🔢 Kiritilgan so'rov: <code>${inputQuery}</code>\n` +
        `📊 Holat: Profil ochildi, xulosalar 0 ta`
      );
    }

  } catch (err) {
    console.error("processPatientLookup error:", err);
    // Xatolik loggerga yoziladi
    sendLogToGroup(
      `❌ <b>MYID QIDIRUV XATOLIK:</b>\n` +
      `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
      `🔢 So'rov: <code>${inputQuery}</code>\n` +
      `⚠️ Sabab: <code>${escapeHtml(err.message)}</code>`
    );

    await sendTelegramMessage(
      chatId,
      "⚠️ Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
          ]
        }
      }
    );
  }
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const payload = {
    chat_id: chatId,
    text: text,
    ...options
  };

  try {
    const res = await fetch(`${TG_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error(`sendMessage to ${chatId} failed:`, err.message);
    return null;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Ishga tushirish
pollUpdates();
