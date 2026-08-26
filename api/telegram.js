/**
 * Radiodiagnostika Telegram Bot Serverless Webhook Handler (@Radiodiagnostika_bot)
 * Handles patient PINFL (JSHSHIR) requests and sends back medical conclusion reports.
 * Auto-detects Channels and forwards all events to Admin (ID: 5314298089).
 */

const BOT_TOKEN = "8836735566:AAEHBNHpIUINi_SsDxlCAkW6BQRRhpo61NQ";
const ADMIN_USER_ID = "5314298089";
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
        adminId: ADMIN_USER_ID,
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
    if (!update) {
      return res.status(200).json({ ok: true, note: "Empty body" });
    }

    // 1. Kanalga post yozilganda (channel_post)
    if (update.channel_post) {
      const post = update.channel_post;
      const channelId = post.chat.id;
      const channelTitle = post.chat.title || "Telegram Kanal";
      const postText = post.text || "(Fayl/Media post)";

      // Kanal ID sini Firebase bazasiga saqlaymiz
      await fetch(`${FIREBASE_DB_URL}/settings/telegram_channel_id.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: channelId,
          channelTitle: channelTitle,
          updatedAt: Date.now()
        })
      }).catch(() => {});

      // Admin userga bildirishnoma yuboramiz
      const adminNotif = 
        `📢 <b>KANAL POSTI QABUL QILINDI VA KANAL BIRIKTIRILDI!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆔 <b>Kanal ID:</b> <code>${channelId}</code>\n` +
        `📛 <b>Kanal Nomi:</b> ${escapeHtml(channelTitle)}\n` +
        `💬 <b>Post Matni:</b> ${escapeHtml(postText)}\n\n` +
        `✅ <i>Ushbu kanal ID si avtomatik tarzda xulosalarni arxivlash kanali sifatida saqlandi!</i>`;

      await sendTelegramMessage(ADMIN_USER_ID, adminNotif, { parse_mode: "HTML" });
      return res.status(200).json({ ok: true, channelSaved: channelId });
    }

    // 2. Bot guruh yoki kanalga admin qilib qo'shilganda (my_chat_member)
    if (update.my_chat_member) {
      const m = update.my_chat_member;
      const targetChat = m.chat;
      const newStatus = m.new_chat_member ? m.new_chat_member.status : "unknown";

      if (targetChat.type === "channel" || targetChat.type === "supergroup" || targetChat.type === "group") {
        await fetch(`${FIREBASE_DB_URL}/settings/telegram_channel_id.json`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: targetChat.id,
            channelTitle: targetChat.title,
            updatedAt: Date.now()
          })
        }).catch(() => {});

        const memberNotif = 
          `🎉 <b>BOT KANAL/GURUHGA QO'SHILDI!</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🆔 <b>ID:</b> <code>${targetChat.id}</code>\n` +
          `📛 <b>Nomi:</b> ${escapeHtml(targetChat.title || 'Noma\'lum')}\n` +
          `🏷 <b>Turi:</b> ${targetChat.type}\n` +
          `👑 <b>Bot Holati:</b> ${newStatus}\n\n` +
          `✅ <i>Kanal ID si xulosalar arxivi sifatida avtomatik sozlandi!</i>`;

        await sendTelegramMessage(ADMIN_USER_ID, memberNotif, { parse_mode: "HTML" });
      }
      return res.status(200).json({ ok: true });
    }

    // 3. Foydalanuvchidan xabar kelganda (message)
    if (!update.message) {
      return res.status(200).json({ ok: true, note: "Unhandled update type" });
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    const userFirstName = msg.from.first_name || "Foydalanuvchi";
    const userName = msg.from.username ? `@${msg.from.username}` : userFirstName;

    // Admin userga bildirishnoma (Monitoring)
    if (String(chatId) !== ADMIN_USER_ID) {
      const userActivityNotif = 
        `📩 <b>Botga yangi murojaat:</b>\n` +
        `👤 <b>Foydalanuvchi:</b> ${escapeHtml(userFirstName)} (${userName})\n` +
        `🆔 <b>User ID:</b> <code>${chatId}</code>\n` +
        `💬 <b>Xabar:</b> <code>${escapeHtml(text || '(Media/Fayl)')}</code>`;

      sendTelegramMessage(ADMIN_USER_ID, userActivityNotif, { parse_mode: "HTML" }).catch(() => {});
    }

    // A) /start yoki /help
    if (text === "/start" || text === "/help") {
      const welcomeText = 
        `Assalomu alaykum, <b>${escapeHtml(userFirstName)}</b>! 👋\n\n` +
        `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> radiologik xulosalarni olish botiga xush kelibsiz.\n\n` +
        `📄 O'zingizning <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni yoki pasport seriya-raqamingizni yozib yuboring.\n\n` +
        `<i>Misol: <code>31205981234567</code> yoki <code>AA1234567</code></i>`;

      await sendTelegramMessage(chatId, welcomeText, { parse_mode: "HTML" });
      return res.status(200).json({ ok: true });
    }

    // B) PINFL yoki Pasport formatini tekshirish
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

    // C) Firebase bazasidan xulosalarni izlash
    await sendTelegramChatAction(chatId, "typing");

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

    // D) Barcha xulosalarni yuborish
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
