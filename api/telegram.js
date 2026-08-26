/**
 * Radiodiagnostika Telegram Bot Serverless Webhook Handler (@Radiodiagnostika_bot)
 * Handles patient PINFL (JSHSHIR) requests and sends back medical conclusion reports.
 */

const BOT_TOKEN = "8836735566:AAEHBNHpIUINi_SsDxlCAkW6BQRRhpo61NQ";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

module.exports = async (req, res) => {
  // CORS headers
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

  // GET request - Status check or Webhook info
  if (req.method === 'GET') {
    try {
      const tgRes = await fetch(`${TG_API_BASE}/getWebhookInfo`);
      const info = await tgRes.json();
      return res.status(200).json({
        status: "active",
        bot: "@Radiodiagnostika_bot",
        name: "Radiodiagnostika Xulosalar Boti",
        webhookInfo: info.result || null
      });
    } catch (e) {
      return res.status(200).json({ status: "active", bot: "@Radiodiagnostika_bot" });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const update = req.body;
    if (!update || !update.message) {
      return res.status(200).json({ ok: true, note: "No message in update" });
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    const userFirstName = msg.from.first_name || "Foydalanuvchi";

    // 1. /start yoki /help buyrug'i
    if (text === "/start" || text === "/help") {
      const welcomeText = 
        `Assalomu alaykum, <b>${escapeHtml(userFirstName)}</b>! 👋\n\n` +
        `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> radiologik xulosalarni olish botiga xush kelibsiz.\n\n` +
        `📄 O'zingizning <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni yoki pasport seriya-raqamingizni yozib yuboring.\n\n` +
        `<i>Misol: <code>31205981234567</code> yoki <code>AA1234567</code></i>`;

      await sendTelegramMessage(chatId, welcomeText, { parse_mode: "HTML" });
      return res.status(200).json({ ok: true });
    }

    // 2. PINFL (JSHSHIR) yoki Pasport raqamini tozalash
    const cleanPin = text.replace(/[\s\-_]/g, "").toUpperCase();
    const isPinfl = /^\d{14}$/.test(cleanPin);
    const isPassport = /^[A-Z]{2}\d{7}$/.test(cleanPin);

    if (!isPinfl && !isPassport) {
      const invalidText = 
        `⚠️ <b>Noto'g'ri format!</b>\n\n` +
        `Iltimos, pasportingizdagi <b>14 ta raqamdan iborat JSHSHIR (PINFL)</b> raqamingizni yuboring.\n\n` +
        `<i>Misol: <code>31205981234567</code></i>`;

      await sendTelegramMessage(chatId, invalidText, { parse_mode: "HTML" });
      return res.status(200).json({ ok: true });
    }

    // 3. Firebase bazasidan PINFL bo'yicha xulosalarni qidirish
    await sendTelegramChatAction(chatId, "typing");

    // Firebase REST so'rovi
    const fbRes = await fetch(`${FIREBASE_DB_URL}/karmed_reports/${cleanPin}.json`);
    const reportsData = fbRes.ok ? await fbRes.json() : null;

    if (!reportsData || Object.keys(reportsData).length === 0) {
      const notFoundText = 
        `🔍 <b>JSHSHIR:</b> <code>${cleanPin}</code>\n\n` +
        `❌ Ushbu JSHSHIR bo'yicha bazada tayyor tibbiy xulosa topilmadi.\n\n` +
        `💡 <i>Agar tekshiruvdan yangi o'tgan bo'lsangiz, shifokor xulosasi tayyorlanayotgan bo'lishi mumkin. Iltimos, birozdan so'ng qayta tekshirib ko'ring yoki shifoxona registratsiyasiga murojaat qiling.</i>`;

      await sendTelegramMessage(chatId, notFoundText, { parse_mode: "HTML" });
      return res.status(200).json({ ok: true });
    }

    // 4. Topilgan barcha xulosalarni yuborish
    const reportKeys = Object.keys(reportsData);
    await sendTelegramMessage(chatId, `✅ <b>Jami ${reportKeys.length} ta xulosa topildi!</b> Xulosalar yuklanmoqda...`, { parse_mode: "HTML" });

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

      // Agar xulosa matni juda uzun bo'lsa (Telegram 4096 belgilik limiti)
      if (reportMsg.length > 4000) {
        reportMsg = reportMsg.substring(0, 3950) + "...\n\n<i>(Xulosa matni qisqartirildi)</i>";
      }

      await sendTelegramMessage(chatId, reportMsg, { parse_mode: "HTML" });

      // Agar PDF yoki rasm fayli bo'lsa, faylni jo'natamiz
      if (rep.fileUrl || rep.telegramFileId) {
        await sendTelegramChatAction(chatId, "upload_document");
        if (rep.telegramFileId) {
          await sendTelegramDocument(chatId, rep.telegramFileId, `${pName} - ${sName}`);
        } else if (rep.fileUrl) {
          await sendTelegramDocument(chatId, rep.fileUrl, `${pName} - ${sName}`);
        }
      }
    }

    return res.status(200).json({ ok: true, delivered: reportKeys.length });

  } catch (err) {
    console.error("Telegram webhook error:", err);
    return res.status(200).json({ ok: false, error: err.message });
  }
};

// Telegram API yordamchi funksiyalari
async function sendTelegramMessage(chatId, text, extra = {}) {
  return fetch(`${TG_API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, ...extra })
  });
}

async function sendTelegramDocument(chatId, documentUrlOrId, caption = "") {
  return fetch(`${TG_API_BASE}/sendDocument`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, document: documentUrlOrId, caption: caption })
  });
}

async function sendTelegramChatAction(chatId, action = "typing") {
  return fetch(`${TG_API_BASE}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: action })
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
