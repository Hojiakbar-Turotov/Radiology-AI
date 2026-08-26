/**
 * Radiodiagnostika Telegram Bot - 24/7 Polling Runner
 * Token: 8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4
 * Admin: 5314298089 (@rons_2026)
 * Channel: -1003962033499 (Xulosa)
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const ADMIN_USER_ID = "5314298089";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;

console.log("🚀 Radiodiagnostika Telegram Boti ishga tushdi...");
console.log(`👤 Admin: ${ADMIN_USER_ID} (@rons_2026)`);
console.log(`📢 Kanal: ${CHANNEL_ID} (Xulosa)`);

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

  // Admin monitoring
  if (String(chatId) !== ADMIN_USER_ID) {
    const notif = 
      `📩 <b>BOTGA YANGI XABAR KELDI!</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Kim:</b> ${escapeHtml(userFullName)} (${userName})\n` +
      `🆔 <b>User ID:</b> <code>${fromId}</code>\n` +
      `💬 <b>Chat ID:</b> <code>${chatId}</code>\n` +
      `📝 <b>Xabar:</b> <code>${escapeHtml(text || '(Media)')}</code>\n` +
      `⏰ <b>Vaqt:</b> ${nowStr}`;

    sendTelegramMessage(ADMIN_USER_ID, notif, { parse_mode: "HTML" }).catch(() => {});
  }

  // A) /id, /myid, /info
  if (text === "/id" || text === "/myid" || text === "/info" || text === "id") {
    const idCard = 
      `🆔 <b>SIZNING TELEGRAM MA'LUMOTLARINGIZ:</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Ism:</b> ${escapeHtml(userFullName)}\n` +
      `🏷 <b>Username:</b> ${userName}\n` +
      `🆔 <b>Sizning User ID:</b> <code>${fromId}</code>\n` +
      `💬 <b>Joriy Chat ID:</b> <code>${chatId}</code>\n` +
      `📱 <b>Chat Turi:</b> <code>${msg.chat.type}</code>\n` +
      `📢 <b>Xulosalar Kanali ID:</b> <code>${CHANNEL_ID}</code>\n` +
      `⏰ <b>Vaqt:</b> ${nowStr}`;

    await sendTelegramMessage(chatId, idCard, { parse_mode: "HTML" });
    return;
  }

  // B) Admin /users
  if ((text === "/users" || text === "/stats") && String(chatId) === ADMIN_USER_ID) {
    const res = await fetch(`${FIREBASE_DB_URL}/karmed_reports.json`);
    const data = res.ok ? await res.json() : {};
    const totalPinfl = data ? Object.keys(data).length : 0;

    await sendTelegramMessage(chatId, `📊 <b>Statistika:</b>\nJami xulosa saqlangan bemorlar (PINFL): <b>${totalPinfl} ta</b>\n📢 Ulangan kanal: <code>${CHANNEL_ID}</code>`, { parse_mode: "HTML" });
    return;
  }

  // C) /start
  if (text === "/start" || text === "/help") {
    const welcome = 
      `Assalomu alaykum, <b>${escapeHtml(userFirstName)}</b>! 👋\n\n` +
      `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> radiologik xulosalarni olish botiga xush kelibsiz.\n\n` +
      `📄 O'zingizning <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni yuboring. yoki MyID orqali botga kiring.\n\n` +
      `<i>Misol: <code>31205981234567</code></i>\n\n` +
      `❤️ <i>Sizning sog'lig'ingiz biz uchun muhim.</i>`;

    await sendTelegramMessage(chatId, welcome, { parse_mode: "HTML" });
    return;
  }

  // D) PINFL qidiruvi
  const cleanPin = text.replace(/[\s\-_]/g, "").toUpperCase();
  const isPinfl = /^\d{14}$/.test(cleanPin);
  const isPassport = /^[A-Z]{2}\d{7}$/.test(cleanPin);

  if (!isPinfl && !isPassport) {
    const invalid = 
      `⚠️ <b>Noto'g'ri format!</b>\n\n` +
      `Iltimos, pasportingizdagi <b>14 ta raqamdan iborat JSHSHIR (PINFL)</b> raqamingizni yuboring.\n\n` +
      `<i>Misol: <code>31205981234567</code></i>\n\n` +
      `🆔 <i>Sizning Chat ID: <code>${chatId}</code></i>`;

    await sendTelegramMessage(chatId, invalid, { parse_mode: "HTML" });
    return;
  }

  // Firebase qidiruv
  const fbRes = await fetch(`${FIREBASE_DB_URL}/karmed_reports/${cleanPin}.json`);
  const reportsData = fbRes.ok ? await fbRes.json() : null;

  if (!reportsData || Object.keys(reportsData).length === 0) {
    const notFound = 
      `🔍 <b>JSHSHIR:</b> <code>${cleanPin}</code>\n\n` +
      `❌ Ushbu JSHSHIR bo'yicha bazada tayyor tibbiy xulosa topilmadi.\n\n` +
      `💡 <i>Agar tekshiruvdan yangi o'tgan bo'lsangiz, shifokor xulosasi tayyorlanayotgan bo'lishi mumkin. Iltimos, birozdan so'ng qayta tekshirib ko'ring yoki shifoxona registratsiyasiga murojaat qiling.</i>`;

    await sendTelegramMessage(chatId, notFound, { parse_mode: "HTML" });
    return;
  }

  const reportKeys = Object.keys(reportsData);
  await sendTelegramMessage(chatId, `✅ <b>Jami ${reportKeys.length} ta xulosa topildi!</b> Xulosalar yuborilmoqda...`, { parse_mode: "HTML" });

  for (const key of reportKeys) {
    const rep = reportsData[key];
    const pName = rep.patientName || "Bemor";
    const sName = rep.serviceName || rep.examinationType || "Radiologik Tekshiruv";
    const dName = rep.doctorName || "Shifokor-Radiolog";
    const rDate = rep.reportDate || rep.date || "Noma'lum sana";
    const rText = rep.conclusionText || rep.reportText || rep.findings || "Xulosa matni mavjud emas.";

    let reportMsg = 
      `📋 <b>TIBBIY XULOSA HISOBOTI</b>\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Bemor:</b> ${escapeHtml(pName)}\n` +
      `🔢 <b>JSHSHIR:</b> <code>${escapeHtml(rep.pinfl || cleanPin)}</code>\n` +
      `🔬 <b>Tekshiruv:</b> ${escapeHtml(sName)}\n` +
      `👨‍⚕️ <b>Shifokor:</b> ${escapeHtml(dName)}\n` +
      `📅 <b>Sana:</b> ${escapeHtml(rDate)}\n` +
      `━━━━━━━━━━━━━━━━━━\n\n` +
      `📝 <b>Xulosa:</b>\n${escapeHtml(rText)}`;

    if (reportMsg.length > 4000) {
      reportMsg = reportMsg.substring(0, 3950) + "...\n\n<i>(Xulosa matni qisqartirildi)</i>";
    }

    await sendTelegramMessage(chatId, reportMsg, { parse_mode: "HTML" });

    if (rep.fileUrl) {
      await sendTelegramDocument(chatId, rep.fileUrl, `${pName} - ${sName}`);
    }
  }
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  return fetch(`${TG_API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, ...extra })
  });
}

async function sendTelegramDocument(chatId, documentUrl, caption = "") {
  return fetch(`${TG_API_BASE}/sendDocument`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, document: documentUrl, caption: caption })
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Boshlash
pollUpdates();
