/**
 * Radiodiagnostika Telegram Bot - 24/7 Polling Runner
 * Token: 8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4
 * Log Group: -1003950231961 (Barcha loglar, monitoring va bildirishnomalar shu guruhga)
 * Channel: -1003962033499 (Faqat toza tibbiy xulosalar)
 * Admin: Hech qanday log yozilmaydi
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;

console.log("🚀 Radiodiagnostika Telegram Boti ishga tushdi...");
console.log(`📋 Log Guruhi: ${LOG_GROUP_ID}`);
console.log(`📢 Xulosalar Kanali: ${CHANNEL_ID}`);

// Boshlang'ich logni Log guruhiga yuborish
sendLogToGroup(`🟢 <b>BOT ISHGA TUSHDI</b>\n⏰ Vaqt: ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}\n🤖 Status: Polling faol, xulosalarni qabul qilishga tayyor.`);

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
    const post = update.channel_post;
    console.log(`📢 Kanal xabari (${post.chat.title} [${post.chat.id}]): ${post.text || ''}`);
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

  // Log guruhiga bildirishnoma yuborish (Log guruhi yoki kanaldan kelgan bo'lmasa)
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
      `💡 <i>Tibbiy xulosalarni olish uchun 14 xonali JSHSHIR (PINFL) raqamingizni yuboring.</i>`;

    await sendTelegramMessage(chatId, idCard, { parse_mode: "HTML" });
    return;
  }

  // B) /start yoki /help
  if (text === "/start" || text === "/help") {
    const welcome = 
      `👋 <b>Assalomu alaykum, ${escapeHtml(userFirstName)}!</b>\n\n` +
      `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> xulosalar bazasiga xush kelibsiz.\n\n` +
      `🔍 O'z tibbiy tekshiruv (MRT, MSKT, Rentgen, UTT) xulosalaringizni olish uchun <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni yuboring.\n\n` +
      `<i>Misol: <code>42105680270654</code></i>`;

    await sendTelegramMessage(chatId, welcome, { parse_mode: "HTML" });
    return;
  }

  // C) 14 xonali PINFL kiritilganda
  const cleanDigits = text.replace(/\D/g, "");
  if (cleanDigits.length === 14) {
    await sendTelegramMessage(chatId, `🔍 <b>${cleanDigits}</b> bo'yicha tibbiy xulosalar qidirilmoqda...`, { parse_mode: "HTML" });

    try {
      const fbRes = await fetch(`${FIREBASE_DB_URL}/karmed_reports/${cleanDigits}.json`);
      const fbData = await fbRes.json();

      if (!fbData) {
        await sendTelegramMessage(
          chatId,
          `⚠️ <b>Xulosa topilmadi</b>\n\n` +
          `JSHSHIR: <code>${cleanDigits}</code> bo'yicha hali hisobot tasdiqlanmagan yoki kiritilmagan.\n` +
          `Iltimos, keyinroq qayta tekshirib ko'ring yoki shifokor bilan bog'laning.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const reportKeys = Object.keys(fbData);
      await sendTelegramMessage(chatId, `✅ <b>${reportKeys.length} ta</b> tibbiy tekshiruv xulosasi topildi:`, { parse_mode: "HTML" });

      for (const key of reportKeys) {
        const rep = fbData[key];
        const repText = 
          `📄 <b>TIBBIY XULOSA PROTOKOLI</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Bemor:</b> ${escapeHtml(rep.patientName || 'Bemor')}\n` +
          `🎂 <b>Yoshi:</b> ${escapeHtml(rep.age || rep.birthDate || '-')}\n` +
          `🆔 <b>Bemor ID:</b> ${escapeHtml(rep.patientId || '-')}\n` +
          `🔢 <b>Namuna raqami:</b> <code>${rep.sampleNumber || '-'}</code>\n` +
          `🔢 <b>PINFL:</b> <code>${cleanDigits}</code>\n` +
          `🔬 <b>Tekshiruv turi:</b> <b>${escapeHtml(rep.serviceName || 'Tibbiy tekshiruv')}</b>\n` +
          `👨‍⚕️ <b>Shifokor-Radiolog:</b> ${escapeHtml(rep.doctorName || rep.reportAuthor || '-')}\n` +
          `📅 <b>Tasdiqlangan sana:</b> ${escapeHtml(rep.reportDate || rep.confirmDate || '-')}\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `📝 <b>XULOSA MATNI:</b>\n\n` +
          `${escapeHtml(rep.conclusionText || 'Xulosa matni mavjud emas.')}\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🏥 <i>Respublika Onkologiya va Radiologiya Markazi</i>`;

        await sendTelegramMessage(chatId, repText, { parse_mode: "HTML" });
        await sleep(500);
      }

      // Log guruhiga muvaffaqiyatli qidiruv haqida yozish
      sendLogToGroup(`✅ <b>BEMOR XULOSANI OLDI</b>\n👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n🔢 PINFL: <code>${cleanDigits}</code>\n📊 Topilgan hisobotlar: ${reportKeys.length} ta`);

    } catch (err) {
      console.error("Firebase fetch error:", err);
      await sendTelegramMessage(chatId, "⚠️ Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.");
    }
    return;
  }

  // D) Noma'lum xabar
  await sendTelegramMessage(
    chatId,
    `ℹ️ Iltimos, <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni yuboring yoki ID ma'lumotingizni ko'rish uchun /id deb yozing.`,
    { parse_mode: "HTML" }
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
