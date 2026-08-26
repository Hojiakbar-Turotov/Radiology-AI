/**
 * Radiodiagnostika Telegram Bot Serverless Webhook Handler (@Radiodiagnostika_bot)
 * Faqat 2 ta inline tugma: 
 * 1. 📱 Tibbiy Xulosalar Web App Portali
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

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
        await sendWelcomeMessage(chatId, userFirstName);
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

    await sendWelcomeMessage(chatId, userFirstName);
    return res.status(200).json({ ok: true });

  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
};
