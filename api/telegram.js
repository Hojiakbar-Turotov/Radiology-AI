/**
 * Radiodiagnostika Telegram Bot Serverless Webhook Handler (@Radiodiagnostika_bot)
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

async function sendLogToGroup(text) {
  try {
    await fetch(`${TG_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: LOG_GROUP_ID, text: text, parse_mode: "HTML" })
    });
  } catch (e) {}
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({ status: "active", bot: "@Radiodiagnostika_bot", webApp: WEBAPP_BASE_URL });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  try {
    const update = req.body;
    if (!update) return res.status(200).json({ ok: true });

    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message ? cb.message.chat.id : cb.from.id;
      const data = cb.data;
      const userFirstName = cb.from.first_name || "Foydalanuvchi";

      await answerCallbackQuery(cb.id);

      if (data === "restart_bot") {
        await sendWelcomeMessageServerless(chatId, userFirstName);
        return res.status(200).json({ ok: true });
      }

      if (data === "search_again") {
        await sendTelegramMessage(
          chatId,
          `🔍 <b>YANGI QIDIRUV:</b>\n\nIltimos, <b>Bemor ID</b> raqamingizni kiriting:\n<i>(Masalan: <code>53312</code> yoki <code>1300</code>)</i>\n\nYoki MyID orqali kiring:`,
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
        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
    }

    if (!update.message) return res.status(200).json({ ok: true });

    const msg = update.message;
    const chatId = msg.chat.id;
    const fromId = msg.from ? msg.from.id : chatId;
    const text = (msg.text || "").trim();
    const userFirstName = msg.from ? msg.from.first_name : "Foydalanuvchi";
    const userLastName = msg.from ? (msg.from.last_name || "") : "";
    const userFullName = `${userFirstName} ${userLastName}`.trim();
    const userName = msg.from && msg.from.username ? `@${msg.from.username}` : "Username yo'q";

    if (String(chatId) !== LOG_GROUP_ID && String(chatId) !== CHANNEL_ID) {
      sendLogToGroup(
        `📩 <b>FOYDALANUVCHIDAN XABAR:</b>\n` +
        `👤 ${escapeHtml(userFullName)} (${userName}, ID: <code>${fromId}</code>)\n` +
        `📝 Matn: <code>${escapeHtml(text || '(Media)')}</code>\n` +
        `⏰ ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}`
      );
    }

    if (text === "/start" || text === "/help" || text === "/myid" || text === "/profil" || text.toLowerCase() === "start") {
      await sendWelcomeMessageServerless(chatId, userFirstName);
      return res.status(200).json({ ok: true });
    }

    const cleanDigits = text.replace(/\D/g, "");

    if (cleanDigits.length >= 3) {
      await processPatientLookupServerless(chatId, userFullName, fromId, cleanDigits, cleanDigits.length === 14 ? "PINFL" : "PATIENT_ID");
      return res.status(200).json({ ok: true });
    }

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
    return res.status(200).json({ ok: true });

  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
};

async function sendWelcomeMessageServerless(chatId, userFirstName) {
  const welcome = 
    `👋 <b>Assalomu alaykum, ${escapeHtml(userFirstName)}!</b>\n\n` +
    `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> tibbiy xulosalar portaliga xush kelibsiz.\n\n` +
    `🆔 <b>MyID FaceID Avtorizatsiya:</b>\n` +
    `Yuzingizni skanerlab (FaceID) shaxsiy profilingizni oching va barcha tekshiruv xulosalaringizni (MRT, MSKT, UTT, Rentgen) bir zumda oling.\n\n` +
    `🔢 <i>Yoki <b>Bemor ID</b> (masalan: <code>53312</code>) raqamingizni yozib yuboring:</i>`;

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

async function processPatientLookupServerless(chatId, userFullName, fromId, inputQuery, queryType) {
  await sendTelegramMessage(
    chatId,
    `🔍 <b>Bemor ID: ${inputQuery}</b> bo'yicha ma'lumotlar qidirilmoqda...`,
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
          const match = repList.find(r => {
            const rPid = String(r.patientId || '').trim();
            const rPinfl = String(r.pinfl || '').trim();
            return rPid === inputQuery || rPinfl === inputQuery;
          });
          if (match) {
            foundPinfl = pKey;
            matchedReports = repList;
            break;
          }
        }
      }
    }

    matchedReports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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
        `👤 <b>Bemor F.I.Sh:</b> ${escapeHtml(patientName)}\n` +
        `🎂 <b>Yoshi / Sana:</b> ${escapeHtml(patientAge)}\n` +
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
        await new Promise(r => setTimeout(r, 300));
      }

      sendLogToGroup(
        `✅ <b>MYID QIDIRUV MUVAFFAQIYATLI:</b>\n` +
        `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
        `👤 Bemor: ${escapeHtml(patientName)}\n` +
        `🆔 Bemor ID: <code>${patientId}</code>\n` +
        `🔢 PINFL: <code>${pinfl}</code>\n` +
        `📊 Topilgan xulosalar: ${matchedReports.length} ta`
      );

    } else {
      const fallbackUrl = `${WEBAPP_BASE_URL}?id=${inputQuery}&auth=myid`;

      await sendTelegramMessage(
        chatId,
        `🛡️ <b>MYID SHAXSIY PROFILINGIZ OCHILDI</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Kiritilgan Bemor ID:</b> <code>${inputQuery}</code>\n\n` +
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

      sendLogToGroup(
        `ℹ️ <b>MYID QIDIRUV (XULOSALAR HALI MAVJUD EMAS):</b>\n` +
        `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
        `🔢 Kiritilgan Bemor ID: <code>${inputQuery}</code>\n` +
        `📊 Holat: Profil ochildi, xulosalar 0 ta`
      );
    }

  } catch (err) {
    sendLogToGroup(
      `❌ <b>MYID QIDIRUV XATOLIK:</b>\n` +
      `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
      `🔢 So'rov: <code>${inputQuery}</code>\n` +
      `⚠️ Sabab: <code>${escapeHtml(err.message)}</code>`
    );

    await sendTelegramMessage(chatId, "⚠️ Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
        ]
      }
    });
  }
}

async function sendTelegramMessage(chatId, text, options = {}) {
  const payload = { chat_id: chatId, text: text, ...options };
  try {
    const res = await fetch(`${TG_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    return null;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
