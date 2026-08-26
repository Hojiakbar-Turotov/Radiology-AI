/**
 * Radiodiagnostika Telegram Bot Serverless Webhook Handler (@Radiodiagnostika_bot)
 * 2 ta Avtorizatsiya: 1) MyID FaceID, 2) Bemor ID & PINFL Mosligi
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

      if (data === "auth_patient_id") {
        await sendTelegramMessage(
          chatId,
          `🔢 <b>BEMOR ID VA PINFL ORQALI KIRISH:</b>\n\nIltimos, <b>Bemor ID</b> raqamingizni kiriting:\n<i>(Masalan: <code>53312</code>)</i>`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: "🆔 1-Usul: MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
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

    if (cleanDigits.length >= 3 && cleanDigits.length <= 8) {
      await sendTelegramMessage(
        chatId,
        `✅ <b>Bemor ID qabul qilindi:</b> <code>${cleanDigits}</code>\n\n` +
        `🛡️ <b>Xavfsizlik tekshiruvi:</b> Ushbu bemorga tegishli <b>14 xonali PINFL</b> raqamingiz bilan xulosalarni ochish uchun quyidagi tugmani bosing:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔢 PINFL kiritib xulosalarni ochish", web_app: { url: `${WEBAPP_BASE_URL}?id=${cleanDigits}&auth=patient` } }],
              [{ text: "🆔 1-Usul: MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
              [{ text: "🔄 Bosh menyu", callback_data: "restart_bot" }]
            ]
          }
        }
      );
      return res.status(200).json({ ok: true });
    }

    await sendWelcomeMessageServerless(chatId, userFirstName);
    return res.status(200).json({ ok: true });

  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
};

async function sendWelcomeMessageServerless(chatId, userFirstName) {
  const welcome = 
    `👋 <b>Assalomu alaykum, ${escapeHtml(userFirstName)}!</b>\n\n` +
    `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> tibbiy xulosalar portaliga xush kelibsiz.\n\n` +
    `🔒 <b>Tizimga kirish uchun 2 ta xavfsiz usul mavjud:</b>\n\n` +
    `1️⃣ <b>1-Usul: MyID FaceID Biometrik Kirish</b>\n` +
    `<i>Yuzingizni skanerlab shaxsiy profilingizni oching va xulosalarni oling.</i>\n\n` +
    `2️⃣ <b>2-Usul: Bemor ID va PINFL Mosligi</b>\n` +
    `<i>Bemor ID va 14 xonali PINFL raqamingiz mos kelsa xulosalar beriladi.</i>\n\n` +
    `👇 <i>Quyidagi tugmalardan birini tanlang yoki <b>Bemor ID</b> (masalan: <code>53312</code>) yozing:</i>`;

  await sendTelegramMessage(chatId, welcome, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🆔 1-Usul: MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
        [{ text: "🔢 2-Usul: Bemor ID & PINFL orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=patient` } }],
        [{ text: "📱 Tibbiy Web App Portali", web_app: { url: WEBAPP_BASE_URL } }],
        [{ text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
      ]
    }
  });
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
