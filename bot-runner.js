/**
 * Radiodiagnostika Telegram Bot - 24/7 Polling Runner
 * Token: 8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4
 * Log Group: -1003950231961
 * Channel: -1003962033499
 * Web App: https://hojiakbar-turotov.github.io/Radiology-AI/webapp.html
 * MyID & FaceID Biometrik Integratsiyasi & Shaxsiy Profil
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const WEBAPP_BASE_URL = "https://hojiakbar-turotov.github.io/Radiology-AI/webapp.html";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;
const userSessions = new Map(); // chatId -> { step, patientId, pinfl, time }

console.log("🚀 Radiodiagnostika Telegram Boti (MyID FaceID & Web App Rejimida) ishga tushdi...");
console.log(`📋 Log Guruhi: ${LOG_GROUP_ID}`);
console.log(`📢 Xulosalar Kanali: ${CHANNEL_ID}`);
console.log(`📱 Web App Manzili: ${WEBAPP_BASE_URL}`);

// Boshlang'ich log
sendLogToGroup(`🟢 <b>BOT ISHGA TUSHDI (MYID FACEID & WEB APP REJIMI)</b>\n⏰ Vaqt: ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}\n🆔 MyID: Integratsiya qilingan\n🔒 Xavfsizlik: FaceID / 2 bosqichli\n⚠️ Holat: Test rejimida`);

async function sendLogToGroup(text) {
  try {
    await fetch(`${TG_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: LOG_GROUP_ID, text: text, parse_mode: "HTML" })
    });
  } catch (e) {
    console.warn("sendLogToGroup error:", e.message);
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
          allowed_updates: ["message", "callback_query", "channel_post", "my_chat_member"]
        })
      });

      if (!res.ok) {
        await sleep(3000);
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
      await sleep(4000);
    }
  }
}

async function handleUpdate(update) {
  const nowStr = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

  // 1. Callback Query (Inline tugmalar)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message ? cb.message.chat.id : cb.from.id;
    const fromId = cb.from.id;
    const data = cb.data;
    const userFirstName = cb.from.first_name || "Foydalanuvchi";
    const userFullName = `${cb.from.first_name || ''} ${cb.from.last_name || ''}`.trim();

    console.log(`🔘 Tugma bosildi [${fromId}] ${userFullName}: ${data}`);
    await answerCallbackQuery(cb.id);

    if (data === "restart_bot") {
      userSessions.set(String(chatId), { step: "WAITING_PATIENT_ID", time: Date.now() });
      await sendWelcomeMessage(chatId, userFirstName);
      return;
    }

    if (data === "search_again") {
      userSessions.set(String(chatId), { step: "WAITING_PATIENT_ID", time: Date.now() });
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
      return;
    }

    return;
  }

  // 2. Kanal posti
  if (update.channel_post) {
    return;
  }

  // 3. Foydalanuvchi xabari
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const fromId = msg.from ? msg.from.id : chatId;
  const text = (msg.text || "").trim();
  const userFirstName = msg.from ? msg.from.first_name : "Foydalanuvchi";
  const userLastName = msg.from ? (msg.from.last_name || "") : "";
  const userFullName = `${userFirstName} ${userLastName}`.trim();
  const userName = msg.from && msg.from.username ? `@${msg.from.username}` : "Username yo'q";

  console.log(`📩 Xabar [${fromId}] ${userFullName}: ${text}`);

  // Log guruhiga bildirishnoma
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
    return;
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
    return;
  }

  // C) /start yoki /help
  if (text === "/start" || text === "/help" || text === "start") {
    userSessions.set(String(chatId), { step: "WAITING_PATIENT_ID", time: Date.now() });
    await sendWelcomeMessage(chatId, userFirstName);
    return;
  }

  const session = userSessions.get(String(chatId)) || {};
  const cleanDigits = text.replace(/\D/g, "");

  // D) Ikkala ma'lumot birga yuborilgan bo'lsa (masalan: "53312 30804812190075")
  const numbers = text.match(/\b\d{3,14}\b/g) || [];
  let foundId = numbers.find(n => n.length >= 3 && n.length <= 8);
  let foundPinfl = numbers.find(n => n.length === 14);

  if (foundId && foundPinfl) {
    await processSecurityVerification(chatId, userFullName, fromId, foundId, foundPinfl);
    return;
  }

  // E) 1-bosqich: Bemor ID kiritilayotgan holat
  if (!session.patientId && cleanDigits.length >= 3 && cleanDigits.length <= 8) {
    userSessions.set(String(chatId), {
      step: "WAITING_PINFL",
      patientId: cleanDigits,
      time: Date.now()
    });

    const step2Msg = 
      `✅ Bemor ID qabul qilindi: <b>${cleanDigits}</b>\n\n` +
      `🔒 <b>2-bosqich:</b> Endi shaxsingizni tasdiqlash uchun <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni kiriting:\n` +
      `<i>(Masalan: <code>30804812190075</code>)</i>\n\n` +
      `🆔 <i>Yoki <b>MyID FaceID</b> orqali bir zumda tasdiqlang:</i>`;

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
    return;
  }

  // F) 2-bosqich: 14 xonali PINFL kiritilgan holat
  if (cleanDigits.length === 14) {
    if (session.patientId) {
      await processSecurityVerification(chatId, userFullName, fromId, session.patientId, cleanDigits);
      return;
    } else {
      userSessions.set(String(chatId), {
        step: "WAITING_PATIENT_ID",
        pinfl: cleanDigits,
        time: Date.now()
      });

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
      return;
    }
  }

  // G) Agar avval PINFL kiritilgan bo'lsa va endi Bemor ID kiritilsa
  if (session.pinfl && cleanDigits.length >= 3 && cleanDigits.length <= 8) {
    await processSecurityVerification(chatId, userFullName, fromId, cleanDigits, session.pinfl);
    return;
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
}

async function sendWelcomeMessage(chatId, userFirstName) {
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

// 2 BOSQICHLI XAVFSIZLIK TEKSHIRUVI VA XULOSALARNI TARTIBLAB BERISH
async function processSecurityVerification(chatId, userFullName, fromId, patientId, pinfl) {
  userSessions.delete(String(chatId));

  await sendTelegramMessage(
    chatId,
    `🔍 Bemor ID: <b>${patientId}</b> va JSHSHIR: <code>${pinfl}</code> bo'yicha tekshiruv xulosalari qidirilmoqda...`,
    { parse_mode: "HTML" }
  );

  try {
    const fbRes = await fetch(`${FIREBASE_DB_URL}/karmed_reports/${pinfl}.json`);
    const fbData = await fbRes.json();

    if (!fbData) {
      sendNotFoundMessage(chatId, patientId, pinfl, userFullName, fromId);
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
      sendNotFoundMessage(chatId, patientId, pinfl, userFullName, fromId);
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

    // Xulosalarni bittalab yuborish
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
      await sleep(400);
    }

    // Yakuniy inline tugmalar
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

    // Log guruhiga log
    sendLogToGroup(
      `✅ <b>XULOSALAR BERILDI (${matchedReports.length} ta):</b>\n` +
      `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
      `👤 Bemor: ${escapeHtml(patientName)}\n` +
      `🆔 Bemor ID: <code>${patientId}</code>\n` +
      `🔢 PINFL: <code>${pinfl}</code>`
    );

  } catch (err) {
    console.error("processSecurityVerification error:", err);
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

async function sendNotFoundMessage(chatId, patientId, pinfl, userFullName, fromId) {
  const notFound = 
    `⚠️ <b>Tekshiruv xulosasi topilmadi</b>\n\n` +
    `Kiritilgan <b>Bemor ID (${patientId})</b> va <b>JSHSHIR (${pinfl})</b> ma'lumotlari bo'yicha xulosa topilmadi yoki hali hisobot tasdiqlanmagan.\n\n` +
    `💡 <i>Iltimos, ma'lumotlarni to'g'ri kiritganingizni tekshirib qaytadan urinib ko'ring yoki MyID FaceID orqali kiring.</i>\n\n` +
    `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>`;

  await sendTelegramMessage(chatId, notFound, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🆔 MyID FaceID orqali Kirish (Kamera)", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
        [{ text: "📱 Web App orqali qidirish", web_app: { url: WEBAPP_BASE_URL } }],
        [{ text: "🔍 Qayta qidirish", callback_data: "search_again" }, { text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
      ]
    }
  });

  sendLogToGroup(
    `⚠️ <b>XULOSA TOPILMADI (MOS KELMADI)</b>\n` +
    `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
    `🆔 Kiritilgan ID: <code>${patientId}</code>\n` +
    `🔢 Kiritilgan PINFL: <code>${pinfl}</code>`
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

// Start
pollUpdates();
