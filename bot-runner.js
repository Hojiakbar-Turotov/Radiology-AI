/**
 * RADIODIAGNOSTIKA TELEGRAM BOT RUNNER (@Radiodiagnostika_bot)
 * Minimal va qulay interfeys:
 * 1. 📱 Web App-ni ochish
 * 2. 🔄 Botni qayta ishga tushirish
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const WEBAPP_BASE_URL = "https://hojiakbar-turotov.github.io/Radiology-AI/webapp.html";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendLogToGroup(text) {
  try {
    await fetch(`${TG_API_BASE}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: LOG_GROUP_ID,
        text: text,
        parse_mode: "HTML"
      })
    });
  } catch (e) {
    console.error("Log sending error:", e.message);
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
    console.error(`sendMessage error to ${chatId}:`, err.message);
    return null;
  }
}

async function sendWelcomeMessage(chatId, userFirstName) {
  const welcome = 
    `👋 <b>Assalomu alaykum, ${escapeHtml(userFirstName)}!</b>\n\n` +
    `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> tibbiy xulosalar portaliga xush kelibsiz.\n\n` +
    `🔒 <b>Tizimda 2 ta xavfsiz avtorizatsiya usuli mavjud:</b>\n` +
    `• <b>1-Usul:</b> MyID FaceID (Biometrik tekshiruv)\n` +
    `• <b>2-Usul:</b> Bemor ID va PINFL mosligi\n\n` +
    `👇 <i>Tibbiy xulosalaringizni ko'rish uchun quyidagi Web App tugmasini bosing:</i>`;

  await sendTelegramMessage(chatId, welcome, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "📱 Tibbiy Xulosalar Web App Portali", web_app: { url: WEBAPP_BASE_URL } }],
        [{ text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
      ]
    }
  });
}

async function processUpdate(update) {
  const nowStr = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

  // 1. Callback Query (Tugma bosilganda)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message ? cb.message.chat.id : cb.from.id;
    const data = cb.data;
    const userFirstName = cb.from.first_name || "Foydalanuvchi";

    await answerCallbackQuery(cb.id);

    if (data === "restart_bot") {
      await sendWelcomeMessage(chatId, userFirstName);
      return;
    }
    return;
  }

  // 2. Foydalanuvchidan xabar kelganda
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const fromId = msg.from ? msg.from.id : chatId;
  const text = (msg.text || "").trim();
  const userFirstName = msg.from ? msg.from.first_name : "Foydalanuvchi";
  const userLastName = msg.from ? (msg.from.last_name || "") : "";
  const userFullName = `${userFirstName} ${userLastName}`.trim();
  const userName = msg.from && msg.from.username ? `@${msg.from.username}` : "Username yo'q";

  // Logger guruhiga yozish
  if (String(chatId) !== LOG_GROUP_ID && String(chatId) !== CHANNEL_ID) {
    sendLogToGroup(
      `📩 <b>FOYDALANUVCHIDAN XABAR:</b>\n` +
      `👤 ${escapeHtml(userFullName)} (${userName}, ID: <code>${fromId}</code>)\n` +
      `📝 Matn: <code>${escapeHtml(text || '(Media)')}</code>\n` +
      `⏰ ${nowStr}`
    );
  }

  // Har qanday xabar yuborilganda yoki /start bosilganda toza 2 ta tugmali menyu ko'rsatiladi
  await sendWelcomeMessage(chatId, userFirstName);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

let offset = 0;
let isPolling = true;

async function startPolling() {
  console.log("🚀 Radiodiagnostika Telegram Bot Runner ishga tushdi (@Radiodiagnostika_bot)...");

  while (isPolling) {
    try {
      const response = await fetch(`${TG_API_BASE}/getUpdates?offset=${offset}&timeout=25`);
      const data = await response.json();

      if (data && data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await processUpdate(update);
        }
      }
    } catch (err) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

process.on("SIGINT", () => { isPolling = false; process.exit(0); });
process.on("SIGTERM", () => { isPolling = false; process.exit(0); });

startPolling();
