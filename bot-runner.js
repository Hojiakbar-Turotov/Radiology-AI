/**
 * RADIODIAGNOSTIKA TELEGRAM BOT RUNNER (@Radiodiagnostika_bot)
 * 2 ta Avtorizatsiya Usuli:
 * 1. 🆔 MyID FaceID Biometrik Avtorizatsiya
 * 2. 🔢 Bemor ID va PINFL Mosligini Tekshirish orqali Xulosalarni Berish
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const WEBAPP_BASE_URL = "https://hojiakbar-turotov.github.io/Radiology-AI/webapp.html";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const userSessions = new Map();

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

async function processUpdate(update) {
  const nowStr = new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });

  // 1. Callback Query tugmalari
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message ? cb.message.chat.id : cb.from.id;
    const data = cb.data;
    const userFirstName = cb.from.first_name || "Foydalanuvchi";

    await answerCallbackQuery(cb.id);

    if (data === "restart_bot") {
      userSessions.delete(String(chatId));
      await sendWelcomeMessage(chatId, userFirstName);
      return;
    }

    if (data === "auth_patient_id") {
      userSessions.set(String(chatId), { step: "WAITING_PATIENT_ID", time: Date.now() });
      await sendTelegramMessage(
        chatId,
        `🔢 <b>BEMOR ID VA PINFL ORQALI KIRISH [1/2]:</b>\n\n` +
        `Iltimos, <b>Bemor ID</b> raqamingizni kiriting:\n<i>(Masalan: <code>53312</code> yoki <code>1300</code>)</i>`,
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
      return;
    }
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

  // Xabarni log guruhiga qayd etish
  if (String(chatId) !== LOG_GROUP_ID && String(chatId) !== CHANNEL_ID) {
    sendLogToGroup(
      `📩 <b>FOYDALANUVCHIDAN XABAR:</b>\n` +
      `👤 ${escapeHtml(userFullName)} (${userName}, ID: <code>${fromId}</code>)\n` +
      `📝 Matn: <code>${escapeHtml(text || '(Media)')}</code>\n` +
      `⏰ ${nowStr}`
    );
  }

  // A) Boshlang'ich buyruqlar: /start, /help, /myid, /profil
  if (text === "/start" || text === "/help" || text === "/myid" || text === "/profil" || text.toLowerCase() === "start") {
    userSessions.delete(String(chatId));
    await sendWelcomeMessage(chatId, userFirstName);
    return;
  }

  const cleanDigits = text.replace(/\D/g, "");
  const currentSession = userSessions.get(String(chatId));

  // B) 2-QADAM: Agar Bemor ID kiritilgan bo'lsa va endi PINFL kutilayotgan bo'lsa
  if (currentSession && currentSession.step === "WAITING_PINFL") {
    const savedPatientId = currentSession.patientId;

    if (cleanDigits.length === 14) {
      await verifyPatientIdAndPinflMatch(chatId, userFullName, fromId, savedPatientId, cleanDigits);
      return;
    } else {
      await sendTelegramMessage(
        chatId,
        `⚠️ <b>PINFL xato kiritildi!</b>\n\nIltimos, aynan <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni kiriting:\n<i>(Masalan: <code>30804812190075</code>)</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Qaytadan boshlash", callback_data: "auth_patient_id" }]
            ]
          }
        }
      );
      return;
    }
  }

  // C) 1-QADAM: Bemor ID kiritilganda (3 dan 8 xonagacha raqam)
  if (cleanDigits.length >= 3 && cleanDigits.length <= 8) {
    userSessions.set(String(chatId), { step: "WAITING_PINFL", patientId: cleanDigits, time: Date.now() });

    await sendTelegramMessage(
      chatId,
      `✅ <b>1-Qadam qabul qilindi:</b> Bemor ID: <code>${cleanDigits}</code>\n\n` +
      `🛡️ <b>2-Qadam (Xavfsizlik tekshiruvi):</b>\n` +
      `Ushbu bemorga tegishli <b>14 xonali JSHSHIR (PINFL)</b> raqamingizni yuboring:\n<i>(Masalan: <code>30804812190075</code>)</i>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🆔 MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }],
            [{ text: "🔄 Boshqa ID kiritish", callback_data: "auth_patient_id" }]
          ]
        }
      }
    );
    return;
  }

  // D) Agar to'g'ridan-to'g'ri 14 xonali PINFL kiritilgan bo'lsa
  if (cleanDigits.length === 14) {
    userSessions.set(String(chatId), { step: "WAITING_PATIENT_ID_AFTER_PINFL", pinfl: cleanDigits, time: Date.now() });
    await sendTelegramMessage(
      chatId,
      `🔢 <b>PINFL qabul qilindi:</b> <code>${cleanDigits}</code>\n\n` +
      `Iltimos, ushbu PINFL ga tegishli <b>Bemor ID</b> raqamingizni kiriting:\n<i>(Masalan: <code>53312</code>)</i>`,
      { parse_mode: "HTML" }
    );
    return;
  }

  if (currentSession && currentSession.step === "WAITING_PATIENT_ID_AFTER_PINFL") {
    const savedPinfl = currentSession.pinfl;
    await verifyPatientIdAndPinflMatch(chatId, userFullName, fromId, cleanDigits, savedPinfl);
    return;
  }

  // Noma'lum xabar holatida yo'l-yo'riq berish
  await sendWelcomeMessage(chatId, userFirstName);
}

async function sendWelcomeMessage(chatId, userFirstName) {
  const welcome = 
    `👋 <b>Assalomu alaykum, ${escapeHtml(userFirstName)}!</b>\n\n` +
    `🏥 <b>Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi</b> tibbiy xulosalar portaliga xush kelibsiz.\n\n` +
    `🔒 <b>Tizimga kirish uchun 2 ta xavfsiz usul mavjud:</b>\n\n` +
    `1️⃣ <b>1-Usul: MyID FaceID Biometrik Kirish</b>\n` +
    `<i>Yuzingizni skanerlab (FaceID) shaxsiy profilingizni oching va barcha tekshiruv xulosalaringizni bir zumda oling.</i>\n\n` +
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

// 2-USUL: BEMOR ID VA PINFL MOSLIGINI TEKSHIRISH FUNKSIYASI
async function verifyPatientIdAndPinflMatch(chatId, userFullName, fromId, patientId, pinfl) {
  userSessions.delete(String(chatId));

  await sendTelegramMessage(
    chatId,
    `🔍 <b>Xavfsizlik tekshiruvi:</b> Bemor ID: <code>${patientId}</code> va PINFL: <code>${pinfl}</code> mosligi tekshirilmoqda...`,
    { parse_mode: "HTML" }
  );

  try {
    const fbRes = await fetch(`${FIREBASE_DB_URL}/karmed_reports.json`);
    const allData = await fbRes.json();

    let isMatched = false;
    let matchedReportsList = [];
    let matchedPatientName = "";
    let matchedBirthDate = "";
    let matchedAge = "";

    if (allData) {
      if (allData[pinfl]) {
        const list = Object.values(allData[pinfl]);
        const match = list.find(r => String(r.patientId || '').trim() === patientId);
        if (match) {
          isMatched = true;
          matchedReportsList = list;
          matchedPatientName = match.patientName || "Bemor";
          matchedBirthDate = match.birthDate || "-";
          matchedAge = match.age || "-";
        }
      }

      if (!isMatched) {
        const pinflKeys = Object.keys(allData);
        for (const pKey of pinflKeys) {
          const repsObj = allData[pKey];
          if (!repsObj) continue;
          const repList = Object.values(repsObj);
          const match = repList.find(r => {
            const rPid = String(r.patientId || '').trim();
            const rPinfl = String(r.pinfl || '').trim();
            return rPid === patientId && (rPinfl === pinfl || pKey === pinfl);
          });
          if (match) {
            isMatched = true;
            matchedReportsList = repList;
            matchedPatientName = match.patientName || "Bemor";
            matchedBirthDate = match.birthDate || "-";
            matchedAge = match.age || "-";
            break;
          }
        }
      }
    }

    if (isMatched && matchedReportsList.length > 0) {
      matchedReportsList.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const patientWebUrl = `${WEBAPP_BASE_URL}?id=${patientId}&pinfl=${pinfl}&auth=patient`;

      await sendTelegramMessage(
        chatId,
        `✅ <b>Bemor ID va PINFL mosligi muvaffaqiyatli tasdiqlandi!</b>\n\n` +
        `👤 <b>Bemor F.I.Sh:</b> ${escapeHtml(matchedPatientName)}\n` +
        `🎂 <b>Yoshi / Sana:</b> ${escapeHtml(matchedBirthDate)} (${escapeHtml(matchedAge)})\n` +
        `🆔 <b>Bemor ID:</b> <code>${escapeHtml(patientId)}</code>\n` +
        `🔢 <b>JSHSHIR (PINFL):</b> <code>${escapeHtml(pinfl)}</code>\n` +
        `📊 <b>Topilgan xulosalar:</b> ${matchedReportsList.length} ta\n\n` +
        `📱 <i>Barcha xulosalarni interaktiv Web App-da ko'rish va chop etish uchun pastdagi tugmani bosing:</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: `📱 Web App-da Xulosalarni Ko'rish (${matchedReportsList.length} ta)`, web_app: { url: patientWebUrl } }],
              [{ text: "🆔 MyID Shaxsiy Profil", web_app: { url: `${patientWebUrl}&auth=myid` } }],
              [{ text: "🔄 Yangi tekshiruv", callback_data: "auth_patient_id" }]
            ]
          }
        }
      );

      for (let i = 0; i < matchedReportsList.length; i++) {
        const r = matchedReportsList[i];
        const repText = 
          `📄 <b>TIBBIY XULOSA PROTOKOLI [${i + 1}/${matchedReportsList.length}]</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `👤 <b>Bemor:</b> ${escapeHtml(r.patientName || matchedPatientName)}\n` +
          `🆔 <b>Bemor ID:</b> <code>${escapeHtml(r.patientId || patientId)}</code>\n` +
          `🔢 <b>Namuna:</b> <code>${escapeHtml(r.sampleNumber || '-')}</code>\n` +
          `🔬 <b>Tekshiruv:</b> <b>${escapeHtml(r.serviceName || 'Tibbiy tekshiruv')}</b>\n` +
          `👨‍⚕️ <b>Shifokor:</b> ${escapeHtml(r.doctorName || r.reportAuthor || '-')}\n` +
          `📅 <b>Sana:</b> ${escapeHtml(r.reportDate || r.confirmDate || '-')}\n` +
          `━━━━━━━━━━━━━━━━━━\n\n` +
          `📝 <b>XULOSA MATNI:</b>\n\n` +
          `${escapeHtml(r.conclusionText || 'Xulosa matni mavjud emas.')}\n\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `🏥 <i>Respublika Onkologiya va Radiologiya Markazi</i>\n` +
          `🛡️ <i>Xavfsiz Tasdiqlangan Protokol</i>`;

        await sendTelegramMessage(chatId, repText, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📱 Ushbu xulosani Web App-da ochish", web_app: { url: patientWebUrl } }]
            ]
          }
        });
        await new Promise(r => setTimeout(r, 300));
      }

      sendLogToGroup(
        `✅ <b>BEMOR ID & PINFL MOSLIGI TASDIQLANDI:</b>\n` +
        `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
        `👤 Bemor: ${escapeHtml(matchedPatientName)}\n` +
        `🆔 Bemor ID: <code>${patientId}</code>\n` +
        `🔢 PINFL: <code>${pinfl}</code>\n` +
        `📊 Topilgan xulosalar: ${matchedReportsList.length} ta`
      );

    } else {
      await sendTelegramMessage(
        chatId,
        `❌ <b>XAVFSIZLIK TEKSHIRUVI: MOS KELMADI!</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🆔 Kiritilgan Bemor ID: <code>${patientId}</code>\n` +
        `🔢 Kiritilgan PINFL: <code>${pinfl}</code>\n\n` +
        `⚠️ <i>Kiritilgan Bemor ID va 14 xonali PINFL ma'lumotlar bazasida bir-biriga mos kelmadi yoki bunday tekshiruv xulosasi mavjud emas.</i>\n\n` +
        `Iltimos, ma'lumotlarni qaytadan tekshirib kiritib ko'ring:`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Qaytadan kiritish", callback_data: "auth_patient_id" }],
              [{ text: "🆔 1-Usul: MyID FaceID orqali Kirish", web_app: { url: `${WEBAPP_BASE_URL}?auth=myid` } }]
            ]
          }
        }
      );

      sendLogToGroup(
        `❌ <b>BEMOR ID & PINFL MOS KELMADI:</b>\n` +
        `👤 Foydalanuvchi: ${escapeHtml(userFullName)} (${fromId})\n` +
        `🆔 Bemor ID: <code>${patientId}</code>\n` +
        `🔢 PINFL: <code>${pinfl}</code>\n` +
        `⚠️ Holat: Mos kelmadi yoki xulosa topilmadi`
      );
    }

  } catch (err) {
    console.error("verifyPatientIdAndPinflMatch error:", err.message);
    await sendTelegramMessage(chatId, "⚠️ Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄 Qayta ishga tushirish", callback_data: "restart_bot" }]
        ]
      }
    });
  }
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
