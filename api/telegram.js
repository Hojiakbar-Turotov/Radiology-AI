/**
 * Radiodiagnostika Telegram Bot Serverless Webhook Handler (@Radiodiagnostika_bot)
 * Handles MyID FaceID Biometric integration, 2-step security verification, and Web App routing.
 * Log Group ID: -1003950231961
 * Channel ID: -1003962033499
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: "active",
      bot: "@Radiodiagnostika_bot",
      myid: "FaceID Biometric Active",
      webApp: WEBAPP_BASE_URL,
      logGroup: LOG_GROUP_ID,
      channel: CHANNEL_ID
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const update = req.body;
    if (!update) {
      return res.status(200).json({ ok: true, note: "Empty body" });
    }

    const nowStr = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

    // 1. Callback Query
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message ? cb.message.chat.id : cb.from.id;
      const data = cb.data;
      const userFirstName = cb.from.first_name || "Foydalanuvchi";

      await answerCallbackQuery(cb.id);

      if (data === "restart_bot") {
        await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "WAITING_PATIENT_ID", time: Date.now() })
        }).catch(() => {});

        await sendWelcomeMessageServerless(chatId, userFirstName);
        return res.status(200).json({ ok: true, action: "restart_bot" });
      }

      if (data === "search_again") {
        await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "WAITING_PATIENT_ID", time: Date.now() })
        }).catch(() => {});

        await sendTelegramMessage(
          chatId,
          `🔍 <b>YANGI XULOSA QIDIRUVI:</b>\n\n1️⃣ Iltimos, <b>Bemor ID</b> raqamini kiriting:\n<i>(Masalan: <code>53312</code> yoki <code>2050</code>)</i>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🆔 MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
                [{ text: "📱 Web App orqali ochish", web_app: { url: WEBAPP_BASE_URL } }],
                [{ text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
              ]
            }
          }
        );
        return res.status(200).json({ ok: true, action: "search_again" });
      }

      return res.status(200).json({ ok: true });
    }

    // 2. Kanal posti
    if (update.channel_post) {
      return res.status(200).json({ ok: true });
    }

    // 3. Foydalanuvchi xabari
    if (!update.message) {
      return res.status(200).json({ ok: true });
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const fromId = msg.from ? msg.from.id : chatId;
    const text = (msg.text || "").trim();
    const userFirstName = msg.from ? msg.from.first_name : "Foydalanuvchi";
    const userLastName = msg.from ? (msg.from.last_name || "") : "";
    const userFullName = `${userFirstName} ${userLastName}`.trim();
    const userName = msg.from && msg.from.username ? `@${msg.from.username}` : "Username yo'q";

    // Log guruhiga monitoring
    if (String(chatId) !== LOG_GROUP_ID && String(chatId) !== CHANNEL_ID) {
      const notif = 
        `📩 <b>BOTGA YANGI XABAR KELDI:</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Kim:</b> ${escapeHtml(userFullName)} (${userName})\n` +
        `🆔 <b>User ID:</b> <code>${fromId}</code>\n` +
        `💬 <b>Chat ID:</b> <code>${chatId}</code>\n` +
        `📝 <b>Xabar:</b> <code>${escapeHtml(text || '(Media/Hujjat)')}</code>\n` +
        `⏰ <b>Vaqt:</b> ${nowStr}`;

      sendLogToGroup(notif).catch(() => {});
    }

    // A) /myid, /faceid, /profil
    if (text === "/myid" || text === "/faceid" || text === "/profil" || text.toLowerCase().includes("myid") || text.toLowerCase().includes("faceid")) {
      const myidCard = 
        `🆔 <b>MYID FACEID AVTORIZATSIYA TIZIMI</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Foydalanuvchi:</b> ${escapeHtml(userFullName)}\n\n` +
        `🔒 MyID biometrik FaceID orqali ro'yxatdan o'ting:\n` +
        `• Shaxsiy profilingiz (F.I.Sh, Yoshi, Jinsi, PINFL) ochiladi;\n` +
        `• Barcha tekshiruv xulosalaringiz (MRT, MSKT, UTT, Rentgen) bir zumda saralanadi;\n` +
        `• Rasmiy tibbiy xulosalarni PDF formatida yuklab olishingiz mumkin.\n\n` +
        `👇 <i>Quyidagi tugmani bosing va FaceID tekshiruvidan o'ting:</i>`;

      await sendTelegramMessage(chatId, myidCard, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🆔 MyID FaceID orqali Kirish (Kamera)", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
            [{ text: "📱 Shaxsiy Kabinetni Ochish", web_app: { url: WEBAPP_BASE_URL } }],
            [{ text: "🔄 Bosh menyuga qaytish", callback_data: "restart_bot" }]
          ]
        }
      });
      return res.status(200).json({ ok: true, command: "myid" });
    }

    // B) /id, /myid_info
    if (text === "/id" || text === "/info" || text === "id") {
      const idCard = 
        `🆔 <b>SIZNING TELEGRAM MA'LUMOTLARINGIZ:</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Ism:</b> ${escapeHtml(userFullName)}\n` +
        `🏷 <b>Username:</b> ${userName}\n` +
        `🔢 <b>User ID:</b> <code>${fromId}</code>\n` +
        `💬 <b>Ushbu Chat ID:</b> <code>${chatId}</code>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>`;

      await sendTelegramMessage(chatId, idCard, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🆔 MyID FaceID bilan Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
            [{ text: "📱 Tibbiy Web App", web_app: { url: WEBAPP_BASE_URL } }],
            [{ text: "🔍 Qidiruv", callback_data: "search_again" }, { text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
          ]
        }
      });
      return res.status(200).json({ ok: true, command: "id" });
    }

    // C) /start yoki /help
    if (text === "/start" || text === "/help" || text === "start") {
      await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "WAITING_PATIENT_ID", time: Date.now() })
      }).catch(() => {});

      await sendWelcomeMessageServerless(chatId, userFirstName);
      return res.status(200).json({ ok: true, command: "start" });
    }

    // Sessiyani o'qish
    let session = {};
    try {
      const sessRes = await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`);
      session = (await sessRes.json()) || {};
    } catch (e) {}

    const cleanDigits = text.replace(/\D/g, "");

    // D) Ikkala ma'lumot birga yuborilgan bo'lsa
    const numbers = text.match(/\b\d{3,14}\b/g) || [];
    let foundId = numbers.find(n => n.length >= 3 && n.length <= 8);
    let foundPinfl = numbers.find(n => n.length === 14);

    if (foundId && foundPinfl) {
      await processSecurityVerificationServerless(chatId, userFullName, fromId, foundId, foundPinfl);
      return res.status(200).json({ ok: true });
    }

    // E) 1-bosqich: Bemor ID kiritilayotgan holat
    if (!session.patientId && cleanDigits.length >= 3 && cleanDigits.length <= 8) {
      await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "WAITING_PINFL", patientId: cleanDigits, time: Date.now() })
      }).catch(() => {});

      const step2Msg = 
        `✅ Bemor ID qabul qilindi: <b>${cleanDigits}</b>\n\n` +
        `🔒 <b>2-bosqich:</b> Endi xavfsizlikni tasdiqlash uchun <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni kiriting:\n` +
        `<i>(Masalan: <code>30804812190075</code>)</i>\n\n` +
        `🆔 <i>Yoki <b>MyID FaceID</b> orqali tasdiqlang:</i>`;

      await sendTelegramMessage(chatId, step2Msg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🆔 MyID FaceID orqali Tasdiqlash", web_app: { url: `${WEBAPP_BASE_URL}?id=${cleanDigits}&auth=myid` } }],
            [{ text: "📱 Web App orqali to'ldirish", web_app: { url: `${WEBAPP_BASE_URL}?id=${cleanDigits}` } }],
            [{ text: "🔄 Boshidan boshlash", callback_data: "restart_bot" }]
          ]
        }
      });
      return res.status(200).json({ ok: true, step: "waiting_pinfl" });
    }

    // F) 2-bosqich: 14 xonali PINFL kiritilgan holat
    if (cleanDigits.length === 14) {
      if (session.patientId) {
        await processSecurityVerificationServerless(chatId, userFullName, fromId, session.patientId, cleanDigits);
        return res.status(200).json({ ok: true });
      } else {
        await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: "WAITING_PATIENT_ID", pinfl: cleanDigits, time: Date.now() })
        }).catch(() => {});

        const askIdMsg = 
          `🔢 JSHSHIR (PINFL): <code>${cleanDigits}</code> qabul qilindi.\n\n` +
          `🔒 Xavfsizlik yuzasidan, iltimos, <b>Bemor ID</b> raqamingizni ham kiriting:\n` +
          `<i>(Masalan: <code>53312</code> yoki <code>2050</code>)</i>`;

        await sendTelegramMessage(chatId, askIdMsg, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🆔 MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?pinfl=${cleanDigits}&auth=myid` } }],
              [{ text: "📱 Web App-da ochish", web_app: { url: `${WEBAPP_BASE_URL}?pinfl=${cleanDigits}` } }],
              [{ text: "🔄 Boshidan boshlash", callback_data: "restart_bot" }]
            ]
          }
        });
        return res.status(200).json({ ok: true, step: "waiting_id" });
      }
    }

    // G) Agar avval PINFL kiritilgan bo'lsa va endi Bemor ID kiritilsa
    if (session.pinfl && cleanDigits.length >= 3 && cleanDigits.length <= 8) {
      await processSecurityVerificationServerless(chatId, userFullName, fromId, cleanDigits, session.pinfl);
      return res.status(200).json({ ok: true });
    }

    // H) Noma'lum xabar
    await sendTelegramMessage(
      chatId,
      `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>\n\n` +
      `Iltimos, xulosani olish uchun <b>MyID FaceID</b> orqali kiring yoki <b>Bemor ID</b> raqamingizni yuboring:`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🆔 MyID FaceID orqali Kirish (Kamera)", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
            [{ text: "📱 Tibbiy Web App Portali", web_app: { url: WEBAPP_BASE_URL } }],
            [{ text: "🔍 Qayta qidirish", callback_data: "search_again" }, { text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
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
    `⚠️ <i>Eslatma: Ushbu bot test tariqasida ishga tushirilgan.</i>\n\n` +
    `🆔 <b>MyID Biometrik Avtorizatsiya:</b>\n` +
    `Yuzingizni skanerlab (FaceID) shaxsiy profilingizni oching va barcha tekshiruv xulosalaringizni (MRT, MSKT, UTT, Rentgen) bir zumda oling.\n\n` +
    `1️⃣ <i>Yoki an'anaviy ravishda <b>Bemor ID</b> raqamingizni kiriting (Masalan: <code>53312</code>):</i>`;

  await sendTelegramMessage(chatId, welcome, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🆔 MyID FaceID orqali Kirish (Biometrik)", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
        [{ text: "📱 Barcha Xulosalarni Web App-da Ko'rish", web_app: { url: WEBAPP_BASE_URL } }],
        [{ text: "🔍 Yangi qidiruv", callback_data: "search_again" }, { text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
      ]
    }
  });
}

async function processSecurityVerificationServerless(chatId, userFullName, fromId, patientId, pinfl) {
  fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, { method: "DELETE" }).catch(() => {});

  await sendTelegramMessage(
    chatId,
    `🔍 Bemor ID: <b>${patientId}</b> va JSHSHIR: <code>${pinfl}</code> bo'yicha tekshiruv xulosalari qidirilmoqda...`,
    { parse_mode: "HTML" }
  );

  try {
    const fbRes = await fetch(`${FIREBASE_DB_URL}/karmed_reports/${pinfl}.json`);
    const fbData = await fbRes.json();

    if (!fbData) {
      sendNotFoundMessageServerless(chatId, patientId, pinfl, userFullName, fromId);
      return;
    }

    const reportKeys = Object.keys(fbData);
    const matchedReports = [];

    for (const key of reportKeys) {
      const rep = fbData[key];
      const repPatientId = String(rep.patientId || "").trim();
      const inputPatientId = String(patientId).trim();

      if (repPatientId === inputPatientId || !repPatientId) {
        matchedReports.push(rep);
      }
    }

    if (matchedReports.length === 0) {
      sendNotFoundMessageServerless(chatId, patientId, pinfl, userFullName, fromId);
      return;
    }

    matchedReports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const patientName = matchedReports[0].patientName || 'Bemor';
    const patientWebUrl = `${WEBAPP_BASE_URL}?id=${patientId}&pinfl=${pinfl}`;

    await sendTelegramMessage(
      chatId,
      `✅ <b>MyID & Xavfsizlik tekshiruvi muvaffaqiyatli o'tdi!</b>\n\n` +
      `👤 <b>Bemor:</b> ${escapeHtml(patientName)}\n` +
      `🎂 <b>Yoshi:</b> ${escapeHtml(matchedReports[0].age || matchedReports[0].birthDate || '-')}\n` +
      `📊 <b>Topilgan xulosalar:</b> ${matchedReports.length} ta\n\n` +
      `📱 <i>Barcha xulosalarni interaktiv Web App-da bo'limlar bo'yicha (MRT, MSKT, UTT, Rentgen) ko'rish va chop etish uchun pastdagi tugmani bosing:</i>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: `📱 Web App-da Tartibli Ko'rish (${matchedReports.length} ta xulosa)`, web_app: { url: patientWebUrl } }],
            [{ text: "🆔 MyID Shaxsiy Profil", web_app: { url: `${patientWebUrl}&auth=myid` } }],
            [{ text: "🔍 Boshqa xulosani qidirish", callback_data: "search_again" }, { text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
          ]
        }
      }
    );

    for (let i = 0; i < matchedReports.length; i++) {
      const rep = matchedReports[i];
      const repText = 
        `📄 <b>TIBBIY XULOSA PROTOKOLI [${i + 1}/${matchedReports.length}]</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Bemor:</b> ${escapeHtml(rep.patientName || 'Bemor')}\n` +
        `🎂 <b>Yoshi:</b> ${escapeHtml(rep.age || rep.birthDate || '-')}\n` +
        `🆔 <b>Bemor ID:</b> <code>${escapeHtml(rep.patientId || patientId)}</code>\n` +
        `🔢 <b>Namuna raqami:</b> <code>${escapeHtml(rep.sampleNumber || '-')}</code>\n` +
        `🔢 <b>PINFL:</b> <code>${pinfl}</code>\n` +
        `🔬 <b>Tekshiruv turi:</b> <b>${escapeHtml(rep.serviceName || 'Tibbiy tekshiruv')}</b>\n` +
        `👨‍⚕️ <b>Shifokor-Radiolog:</b> ${escapeHtml(rep.doctorName || rep.reportAuthor || '-')}\n` +
        `📅 <b>Tasdiqlangan sana:</b> ${escapeHtml(rep.reportDate || rep.confirmDate || '-')}\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <b>XULOSA MATNI:</b>\n\n` +
        `${escapeHtml(rep.conclusionText || 'Xulosa matni mavjud emas.')}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🏥 <i>Respublika Onkologiya va Radiologiya Markazi</i>\n` +
        `✅ <i>MyID Tasdiqlangan</i>`;

      await sendTelegramMessage(chatId, repText, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📱 Ushbu xulosani Web App-da ochish", web_app: { url: patientWebUrl } }]
          ]
        }
      });
      await new Promise(r => setTimeout(r, 350));
    }

    await sendTelegramMessage(
      chatId,
      `🏁 <b>Barcha ${matchedReports.length} ta xulosa taqdim etildi.</b>\n\n` +
      `Yangi xulosani tekshirish yoki botni qayta ishga tushirish uchun quyidagi tugmalardan foydalaning:`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📱 Barcha Xulosalarni Web App-da Ko'rish", web_app: { url: patientWebUrl } }],
            [{ text: "🆔 MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
            [{ text: "🔍 Boshqa xulosani qidirish", callback_data: "search_again" }, { text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
          ]
        }
      }
    );

    sendLogToGroup(
      `✅ <b>XULOSALAR BERILDI (${matchedReports.length} ta):</b>\n` +
      `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
      `👤 Bemor: ${escapeHtml(patientName)}\n` +
      `🆔 Bemor ID: <code>${patientId}</code>\n` +
      `🔢 PINFL: <code>${pinfl}</code>`
    );

  } catch (err) {
    await sendTelegramMessage(chatId, "⚠️ Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
        ]
      }
    });
  }
}

async function sendNotFoundMessageServerless(chatId, patientId, pinfl, userFullName, fromId) {
  const notFound = 
    `🛡️ <b>MYID SHAXSIY PROFILINGIZ OCHILDI</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>Bemor ID:</b> <code>${patientId}</code>\n` +
    `🔢 <b>JSHSHIR (PINFL):</b> <code>${pinfl}</code>\n\n` +
    `ℹ️ <i>Sizning nomingizga hali tasdiqlangan tibbiy xulosalar mavjud emas yoki shifokor tekshiruv jarayonida. Shifokor tasdiqlashi bilan xulosalar profilingizda paydo bo'ladi.</i>\n\n` +
    `📱 <i>MyID Shaxsiy profilingizni to'liq ko'rish uchun quyidagi tugmani bosing:</i>`;

  await sendTelegramMessage(chatId, notFound, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🆔 MyID Shaxsiy Profilni Ochish", web_app: { url: `${WEBAPP_BASE_URL}?id=${patientId}&pinfl=${pinfl}&auth=myid` } }],
        [{ text: "🔍 Qayta qidirish", callback_data: "search_again" }, { text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
      ]
    }
  });

  sendLogToGroup(
    `🆔 <b>MYID QIDIRUV (XULOSA HALI MAVJUD EMAS)</b>\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
    `🆔 Kiritilgan ID: <code>${patientId}</code>\n` +
    `🔢 Kiritilgan PINFL: <code>${pinfl}</code>\n` +
    `📊 Holat: Profil faol, xulosa kutilmoqda`
  );
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
    return null;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
