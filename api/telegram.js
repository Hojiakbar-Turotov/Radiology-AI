/**
 * Radiodiagnostika Telegram Bot Serverless Webhook Handler (@Radiodiagnostika_bot)
 */

const fs = require('fs');
const path = require('path');

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const USERS_FILE = path.join(__dirname, '..', 'data', 'bot_users.json');
const QUEUE_FILE = path.join(__dirname, '..', 'data', 'mrt_queue.json');

function loadBotUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return [];
}

function saveBotUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function getOrUpdateUser(fromInfo, isResetToUser = false) {
  const users = loadBotUsers();
  const userId = String(fromInfo.id);
  const nowStr = new Date().toISOString();

  let user = users.find(u => String(u.id) === userId);
  const firstName = fromInfo.first_name || "Foydalanuvchi";
  const lastName = fromInfo.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const username = fromInfo.username ? `@${fromInfo.username}` : "Username yo'q";

  if (!user) {
    user = {
      id: userId,
      fullName: fullName,
      username: username,
      role: 'user',
      assignedDevice: 'all',
      firstSeen: nowStr,
      lastSeen: nowStr
    };
    users.push(user);
  } else {
    user.fullName = fullName;
    user.username = username;
    user.lastSeen = nowStr;
    if (isResetToUser && user.role === 'laborant') {
      user.role = 'user';
    }
  }

  saveBotUsers(users);
  return user;
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

async function answerCallbackQuery(callbackQueryId, text = "") {
  try {
    await fetch(`${TG_API_BASE}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text: text })
    });
  } catch (e) {}
}

const FAQ_ANSWERS = {
  faq_prep_mrt: 
    `<b>❓ MRT tekshiruviga qanday tayyorgarlik ko'rish kerak?</b>\n\n` +
    `Metall buyumlar, taqinchoqlar va soatni yechish kerak. Tekshiruvdan 4 soat oldin og'ir ovqatlanmaslik tavsiya etiladi.`,

  faq_diff_mskt_mrt: 
    `<b>❓ MSKT va MRT ning farqi nimada?</b>\n\n` +
    `MSKT rentgen nurlari orqali suyak va o'pka to'qimalarini aniq ko'rsatadi. MRT esa magnit maydon orqali miya, yumshoq to'qimalar va bo'g'imlarni nurlanishsiz tekshiradi.`,

  faq_my_queue: 
    `<b>❓ Navbatimni qanday bilishim mumkin?</b>\n\n` +
    `Chiptangizdagi QR kodni skaner qiling yoki terminal orqali bemor ID raqamingizni kiriting.`,

  faq_duration: 
    `<b>❓ Tekshiruv qancha vaqt davom etadi?</b>\n\n` +
    `Har bir standart tekshiruv uchun aniq 30 daqiqa vaqt ajratiladi.`
};

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: "active", bot: "@Radiodiagnostika_bot" });
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  try {
    const update = req.body;
    if (!update) return res.status(200).json({ ok: true });

    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message ? cb.message.chat.id : cb.from.id;
      const data = cb.data;
      const fromInfo = cb.from;

      await answerCallbackQuery(cb.id);

      if (data === "restart_bot") {
        getOrUpdateUser(fromInfo, true);
        const firstName = escapeHtml(fromInfo.first_name || "Radiodiagnostika");
        const text = `👋 <b>Assalomu alaykum, ${firstName}!</b>\n\n🏥 <b>Respublika Onkologiya va Radiologiya Markazi MRT/MSKT bo'limining rasmiy yordamchi botiga xush kelibsiz!</b>\n\nQuyidagi ko'p beriladigan savollardan birini tanlang yoki o'z savolingizni yozib qoldiring:`;
        const keyboard = {
          inline_keyboard: [
            [{ text: "❓ MRT tekshiruviga qanday tayyorgarlik ko'rish kerak?", callback_data: "faq_prep_mrt" }],
            [{ text: "❓ MSKT va MRT ning farqi nimada?", callback_data: "faq_diff_mskt_mrt" }],
            [{ text: "❓ Navbatimni qanday bilishim mumkin?", callback_data: "faq_my_queue" }],
            [{ text: "❓ Tekshiruv qancha vaqt davom etadi?", callback_data: "faq_duration" }],
            [{ text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
          ]
        };
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
        return res.status(200).json({ ok: true });
      }

      if (FAQ_ANSWERS[data]) {
        await sendTelegramMessage(chatId, FAQ_ANSWERS[data], { parse_mode: "HTML" });
        return res.status(200).json({ ok: true });
      }
    }

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const fromInfo = msg.from || { id: chatId, first_name: "Foydalanuvchi" };
      const text = (msg.text || "").trim();
      const isStartCmd = (text === "/start" || text.startsWith("/start"));

      const user = getOrUpdateUser(fromInfo, isStartCmd);
      const firstName = escapeHtml(fromInfo.first_name || "Radiodiagnostika");

      if (user.role === 'laborant') {
        const labText = `👋 <b>Assalomu alaykum, ${firstName}!</b>\n\n👨‍⚕️ <b>Siz MRT/MSKT bo'limi Laboranti sifatida tasdiqlangansiz.</b>\nQuyidagi tugmalar orqali xonalardagi jonli navbatni ko'rishingiz mumkin:`;
        const keyboard = {
          inline_keyboard: [
            [{ text: "🧲 1-MRT Navbati", callback_data: "lab_mrt1" }, { text: "🧲 2-MRT Navbati", callback_data: "lab_mrt2" }],
            [{ text: "⚡ MSKT Navbati", callback_data: "lab_mskt" }, { text: "📊 Bugungi Statistika", callback_data: "lab_stats" }],
            [{ text: "🔄 Botni qayta ishga tushirish (Chiqish)", callback_data: "restart_bot" }]
          ]
        };
        await sendTelegramMessage(chatId, labText, { parse_mode: "HTML", reply_markup: keyboard });
      } else {
        const patText = `👋 <b>Assalomu alaykum, ${firstName}!</b>\n\n🏥 <b>Respublika Onkologiya va Radiologiya Markazi MRT/MSKT bo'limining rasmiy yordamchi botiga xush kelibsiz!</b>\n\nQuyidagi ko'p beriladigan savollardan birini tanlang yoki o'z savolingizni yozib qoldiring:`;
        const keyboard = {
          inline_keyboard: [
            [{ text: "❓ MRT tekshiruviga qanday tayyorgarlik ko'rish kerak?", callback_data: "faq_prep_mrt" }],
            [{ text: "❓ MSKT va MRT ning farqi nimada?", callback_data: "faq_diff_mskt_mrt" }],
            [{ text: "❓ Navbatimni qanday bilishim mumkin?", callback_data: "faq_my_queue" }],
            [{ text: "❓ Tekshiruv qancha vaqt davom etadi?", callback_data: "faq_duration" }],
            [{ text: "🔄 Botni qayta ishga tushirish", callback_data: "restart_bot" }]
          ]
        };
        await sendTelegramMessage(chatId, patText, { parse_mode: "HTML", reply_markup: keyboard });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(200).json({ ok: false, error: err.message });
  }
};
