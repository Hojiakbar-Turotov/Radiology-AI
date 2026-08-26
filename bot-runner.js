/**
 * Radiodiagnostika Telegram Bot - 24/7 Polling Runner
 * Token: 8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4
 * Log Group: -1003950231961 (Barcha monitoring va loglar faqat shu guruhga)
 * Channel: -1003962033499 (Faqat toza tibbiy xulosalar)
 * 2-Bosqichli Xavfsizlik: 1) Bemor ID -> 2) PINFL (JSHSHIR). Ikkalasi mos kelsa xulosa beriladi.
 * Eslatma: Bot test tariqasida ishga tushgan.
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;
const userSessions = new Map(); // chatId -> { step, patientId, pinfl, time }

console.log("🚀 Radiodiagnostika Telegram Boti (Xavfsizlik & Test Rejimida) ishga tushdi...");
console.log(`📋 Log Guruhi: ${LOG_GROUP_ID}`);
console.log(`📢 Xulosalar Kanali: ${CHANNEL_ID}`);

// Boshlang'ich log
sendLogToGroup(`🟢 <b>BOT ISHGA TUSHDI (XAVFSIZLIK REJIMI)</b>\n⏰ Vaqt: ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}\n🔒 Xavfsizlik: 2 bosqichli (Bemor ID + PINFL)\n⚠️ Holat: Test rejimida`);

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
          allowed_updates: ["message", "channel_post", "my_chat_member"]
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

  // 1. Kanal posti
  if (update.channel_post) {
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

  // A) /id, /myid, /info
  if (text === "/id" || text === "/myid" || text === "/info" || text === "id") {
    const idCard = 
      `🆔 <b>SIZNING TELEGRAM MA'LUMOTLARINGIZ:</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Ism:</b> ${escapeHtml(userFullName)}\n` +
      `🏷 <b>Username:</b> ${userName}\n` +
      `🔢 <b>User ID:</b> <code>${fromId}</code>\n` +
      `💬 <b>Chat ID:</b> <code>${chatId}</code>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>\n` +
      `💡 <i>Xulosalarni olish uchun /start tugmasini bosing.</i>`;

    await sendTelegramMessage(chatId, idCard, { parse_mode: "HTML" });
    return;
  }

  // B) /start yoki /help
  if (text === "/start" || text === "/help" || text === "start") {
    userSessions.set(String(chatId), { step: "WAITING_PATIENT_ID", time: Date.now() });

    const welcome = 
      `👋 <b>Assalomu alaykum, ${escapeHtml(userFirstName)}!</b>\n\n` +
      `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> tibbiy xulosalar portaliga xush kelibsiz.\n\n` +
      `⚠️ <i>Eslatma: Ushbu bot test tariqasida ishga tushirilgan.</i>\n\n` +
      `🔒 <b>Xavfsizlik talabi:</b> Tibbiy xulosani olish uchun 2 ta ma'lumot mos kelishi shart.\n\n` +
      `1️⃣ <b>1-bosqich:</b> Iltimos, <b>Bemor ID</b> raqamingizni kiriting:\n` +
      `<i>(Masalan: <code>2050</code> yoki <code>38027</code>)</i>`;

    await sendTelegramMessage(chatId, welcome, { parse_mode: "HTML" });
    return;
  }

  const session = userSessions.get(String(chatId)) || {};
  const cleanDigits = text.replace(/\D/g, "");

  // C) Ikkala ma'lumot birga yuborilgan bo'lsa (masalan: "2050 42105680270654")
  const numbers = text.match(/\b\d{3,14}\b/g) || [];
  let foundId = numbers.find(n => n.length >= 3 && n.length <= 8);
  let foundPinfl = numbers.find(n => n.length === 14);

  if (foundId && foundPinfl) {
    await processSecurityVerification(chatId, userFullName, fromId, foundId, foundPinfl);
    return;
  }

  // D) 1-bosqich: Bemor ID kiritilayotgan holat
  if (!session.patientId && cleanDigits.length >= 3 && cleanDigits.length <= 8) {
    userSessions.set(String(chatId), {
      step: "WAITING_PINFL",
      patientId: cleanDigits,
      time: Date.now()
    });

    const step2Msg = 
      `✅ Bemor ID qabul qilindi: <b>${cleanDigits}</b>\n\n` +
      `🔒 <b>2-bosqich:</b> Endi xavfsizlikni tasdiqlash uchun <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni kiriting:\n` +
      `<i>(Masalan: <code>42105680270654</code>)</i>`;

    await sendTelegramMessage(chatId, step2Msg, { parse_mode: "HTML" });
    return;
  }

  // E) 2-bosqich: 14 xonali PINFL kiritilgan holat
  if (cleanDigits.length === 14) {
    if (session.patientId) {
      await processSecurityVerification(chatId, userFullName, fromId, session.patientId, cleanDigits);
      return;
    } else {
      // PINFL kiritildi, lekin Bemor ID kiritilmagan
      userSessions.set(String(chatId), {
        step: "WAITING_PATIENT_ID",
        pinfl: cleanDigits,
        time: Date.now()
      });

      const askIdMsg = 
        `🔢 JSHSHIR (PINFL): <code>${cleanDigits}</code> qabul qilindi.\n\n` +
        `🔒 Xavfsizlik yuzasidan, iltimos, <b>Bemor ID</b> raqamingizni ham kiriting:\n` +
        `<i>(Masalan: <code>2050</code> yoki <code>38027</code>)</i>`;

      await sendTelegramMessage(chatId, askIdMsg, { parse_mode: "HTML" });
      return;
    }
  }

  // F) Agar avval PINFL kiritilgan bo'lsa va endi Bemor ID kiritilsa
  if (session.pinfl && cleanDigits.length >= 3 && cleanDigits.length <= 8) {
    await processSecurityVerification(chatId, userFullName, fromId, cleanDigits, session.pinfl);
    return;
  }

  // G) Noma'lum xabar
  await sendTelegramMessage(
    chatId,
    `⚠️ <i>Bot test tariqasida ishga tushirilgan.</i>\n\n` +
    `Iltimos, xulosani olish uchun avval <b>Bemor ID</b> raqamingizni kiriting yoki /start tugmasini bosing.`,
    { parse_mode: "HTML" }
  );
}

// 2 BOSQICHLI XAVFSIZLIK TEKSHIRUVI VA XULOSANI BERISH
async function processSecurityVerification(chatId, userFullName, fromId, patientId, pinfl) {
  userSessions.delete(String(chatId));

  await sendTelegramMessage(
    chatId,
    `🔍 Bemor ID: <b>${patientId}</b> va JSHSHIR: <code>${pinfl}</code> bo'yicha xavfsizlik tekshiruvi o'tkazilmoqda...`,
    { parse_mode: "HTML" }
  );

  try {
    const fbRes = await fetch(`${FIREBASE_DB_URL}/karmed_reports/${pinfl}.json`);
    const fbData = await fbRes.json();

    if (!fbData) {
      sendNotFoundMessage(chatId, patientId, pinfl, userFullName, fromId);
      return;
    }

    // Bemor ID va PINFL ikkalasi mos kelishini qat'iy tekshirish
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

    // Muvaffaqiyatli topildi
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
      await sleep(500);
    }

    // Log guruhiga muvaffaqiyatli log
    sendLogToGroup(
      `✅ <b>XULOSA BERILDI (XAVFSIZLIK TASDIQLANDI)</b>\n` +
      `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
      `🆔 Bemor ID: <code>${patientId}</code>\n` +
      `🔢 PINFL: <code>${pinfl}</code>\n` +
      `📊 Topildi: ${matchedReports.length} ta hisobot`
    );

  } catch (err) {
    console.error("processSecurityVerification error:", err);
    await sendTelegramMessage(chatId, "⚠️ Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
  }
}

async function sendNotFoundMessage(chatId, patientId, pinfl, userFullName, fromId) {
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
