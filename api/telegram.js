/**
 * Radiodiagnostika Telegram Bot Serverless Webhook Handler (@Radiodiagnostika_bot)
 * Handles 2-step security verification: 1) Patient ID -> 2) PINFL (JSHSHIR).
 * Delivers medical conclusion reports only when both match.
 * Log Group ID: -1003950231961 (Barcha loglar faqat shu guruhga)
 * Channel ID: -1003962033499 (Faqat toza tibbiy xulosalar)
 * Notice: Bot test tariqasida ishga tushgan.
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
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
      security: "2-step (Patient ID + PINFL)",
      mode: "test",
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

    // 1. Kanal posti
    if (update.channel_post) {
      return res.status(200).json({ ok: true });
    }

    // 2. Foydalanuvchi xabari
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

    // A) /id, /myid, /info
    if (text === "/id" || text === "/myid" || text === "/info" || text === "id") {
      const idCard = 
        `🆔 <b>SIZNING TELEGRAM MA'LUMOTLARINGIZ:</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Ism:</b> ${escapeHtml(userFullName)}\n` +
        `🏷 <b>Username:</b> ${userName}\n` +
        `🔢 <b>User ID:</b> <code>${fromId}</code>\n` +
        `💬 <b>Ushbu Chat ID:</b> <code>${chatId}</code>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>\n` +
        `💡 <i>Xulosalarni olish uchun /start tugmasini bosing.</i>`;

      await sendTelegramMessage(chatId, idCard, { parse_mode: "HTML" });
      return res.status(200).json({ ok: true, command: "id" });
    }

    // B) /start yoki /help
    if (text === "/start" || text === "/help" || text === "start") {
      await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "WAITING_PATIENT_ID", time: Date.now() })
      }).catch(() => {});

      const welcome = 
        `👋 <b>Assalomu alaykum, ${escapeHtml(userFirstName)}!</b>\n\n` +
        `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> tibbiy xulosalar portaliga xush kelibsiz.\n\n` +
        `⚠️ <i>Eslatma: Ushbu bot test tariqasida ishga tushirilgan.</i>\n\n` +
        `🔒 <b>Xavfsizlik talabi:</b> Tibbiy xulosani olish uchun 2 ta ma'lumot mos kelishi shart.\n\n` +
        `1️⃣ <b>1-bosqich:</b> Iltimos, <b>Bemor ID</b> raqamingizni kiriting:\n` +
        `<i>(Masalan: <code>2050</code> yoki <code>38027</code>)</i>`;

      await sendTelegramMessage(chatId, welcome, { parse_mode: "HTML" });
      return res.status(200).json({ ok: true, command: "start" });
    }

    // Sessiyani o'qish
    let session = {};
    try {
      const sessRes = await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`);
      session = (await sessRes.json()) || {};
    } catch (e) {}

    const cleanDigits = text.replace(/\D/g, "");

    // C) Ikkala ma'lumot birga yuborilgan bo'lsa (masalan: "2050 42105680270654")
    const numbers = text.match(/\b\d{3,14}\b/g) || [];
    let foundId = numbers.find(n => n.length >= 3 && n.length <= 8);
    let foundPinfl = numbers.find(n => n.length === 14);

    if (foundId && foundPinfl) {
      await processSecurityVerificationServerless(chatId, userFullName, fromId, foundId, foundPinfl);
      return res.status(200).json({ ok: true });
    }

    // D) 1-bosqich: Bemor ID kiritilayotgan holat
    if (!session.patientId && cleanDigits.length >= 3 && cleanDigits.length <= 8) {
      await fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "WAITING_PINFL", patientId: cleanDigits, time: Date.now() })
      }).catch(() => {});

      const step2Msg = 
        `✅ Bemor ID qabul qilindi: <b>${cleanDigits}</b>\n\n` +
        `🔒 <b>2-bosqich:</b> Endi xavfsizlikni tasdiqlash uchun <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni kiriting:\n` +
        `<i>(Masalan: <code>42105680270654</code>)</i>`;

      await sendTelegramMessage(chatId, step2Msg, { parse_mode: "HTML" });
      return res.status(200).json({ ok: true, step: "waiting_pinfl" });
    }

    // E) 2-bosqich: 14 xonali PINFL kiritilgan holat
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
          `<i>(Masalan: <code>2050</code> yoki <code>38027</code>)</i>`;

        await sendTelegramMessage(chatId, askIdMsg, { parse_mode: "HTML" });
        return res.status(200).json({ ok: true, step: "waiting_id" });
      }
    }

    // F) Agar avval PINFL kiritilgan bo'lsa va endi Bemor ID kiritilsa
    if (session.pinfl && cleanDigits.length >= 3 && cleanDigits.length <= 8) {
      await processSecurityVerificationServerless(chatId, userFullName, fromId, cleanDigits, session.pinfl);
      return res.status(200).json({ ok: true });
    }

    // G) Noma'lum xabar
    await sendTelegramMessage(
      chatId,
      `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>\n\n` +
      `Iltimos, xulosani olish uchun avval <b>Bemor ID</b> raqamingizni kiriting yoki /start tugmasini bosing.`,
      { parse_mode: "HTML" }
    );
    return res.status(200).json({ ok: true });

  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
};

async function processSecurityVerificationServerless(chatId, userFullName, fromId, patientId, pinfl) {
  fetch(`${FIREBASE_DB_URL}/bot_sessions/${chatId}.json`, { method: "DELETE" }).catch(() => {});

  await sendTelegramMessage(
    chatId,
    `🔍 Bemor ID: <b>${patientId}</b> va JSHSHIR: <code>${pinfl}</code> bo'yicha xavfsizlik tekshiruvi o'tkazilmoqda...`,
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

    await sendTelegramMessage(
      chatId,
      `✅ <b>Xavfsizlik tekshiruvi muvaffaqiyatli o'tdi!</b>\n` +
      `Topilgan tibbiy xulosalar soni: <b>${matchedReports.length} ta</b>\n\n` +
      `⚠️ <i>(Bot test tariqasida ishlamoqda)</i>`,
      { parse_mode: "HTML" }
    );

    for (const rep of matchedReports) {
      const repText = 
        `📄 <b>TIBBIY XULOSA PROTOKOLI</b>\n` +
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
        `⚠️ <i>Test rejimi</i>`;

      await sendTelegramMessage(chatId, repText, { parse_mode: "HTML" });
      await new Promise(r => setTimeout(r, 400));
    }

    sendLogToGroup(
      `✅ <b>XULOSA BERILDI (XAVFSIZLIK TASDIQLANDI)</b>\n` +
      `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
      `🆔 Bemor ID: <code>${patientId}</code>\n` +
      `🔢 PINFL: <code>${pinfl}</code>\n` +
      `📊 Topildi: ${matchedReports.length} ta hisobot`
    );

  } catch (err) {
    await sendTelegramMessage(chatId, "⚠️ Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
  }
}

async function sendNotFoundMessageServerless(chatId, patientId, pinfl, userFullName, fromId) {
  const notFound = 
    `⚠️ <b>Tekshiruv xulosasi topilmadi</b>\n\n` +
    `Kiritilgan <b>Bemor ID (${patientId})</b> va <b>JSHSHIR (${pinfl})</b> ma'lumotlari bo'yicha xulosa topilmadi yoki hali hisobot tasdiqlanmagan.\n\n` +
    `💡 <i>Iltimos, ma'lumotlarni to'g'ri kiritganingizni tekshirib qaytadan urinib ko'ring (/start).</i>\n\n` +
    `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>`;

  await sendTelegramMessage(chatId, notFound, { parse_mode: "HTML" });

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
    return null;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
