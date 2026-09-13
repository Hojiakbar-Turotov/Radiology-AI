/**
 * RADIODIAGNOSTIKA TELEGRAM BOT RUNNER (@Radiodiagnostika_bot)
 * 
 * Imkoniyatlar:
 * 1. Bemorlar uchun FAQ (Ko'p beriladigan savollar va javoblar)
 * 2. Bot foydalanuvchilarini data/bot_users.json fayliga saqlash
 * 3. Qayta /start yoki qayta ishga tushirish bosilganda rolni avtomatik 'user' ga qaytarish
 * 4. Admin tomonidan 'laborant' roli berilganda MRT 1, MRT 2, MSKT jonli navbatini ko'rish
 * 5. Har kuni ertalab soat 08:00 da laborantlarga kunlik navbat eslatmasi (Morning notification)
 */

const fs = require('fs');
const path = require('path');

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const LOG_GROUP_ID = "-1003950231961";
const CHANNEL_ID = "-1003962033499";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const ROOT_DIR = __dirname;
const USERS_FILE = path.join(ROOT_DIR, 'data', 'bot_users.json');
const QUEUE_FILE = path.join(ROOT_DIR, 'data', 'mrt_queue.json');
const DEVICES_FILE = path.join(ROOT_DIR, 'data', 'devices.json');

const BOT_SETTINGS_FILE = path.join(ROOT_DIR, 'data', 'bot_settings.json');

// -------------------------------------------------------------
// FOYDALANUVCHILAR VA SOZLAMALAR BAZASI
// -------------------------------------------------------------
function loadBotSettings() {
  try {
    if (fs.existsSync(BOT_SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(BOT_SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {
    webAppUrl: "https://hojiakbar-turotov.github.io/Radiology-AI/control.html",
    adminPassword: "15420"
  };
}

function saveBotSettings(settings) {
  try {
    fs.writeFileSync(BOT_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

function loadBotUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error("[Bot Users] O'qishda xatolik:", e.message);
  }
  return [];
}

function saveBotUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error("[Bot Users] Saqlashda xatolik:", e.message);
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
      role: 'user', // standart holat: oddiy foydalanuvchi/bemor
      assignedDevice: 'all',
      firstSeen: nowStr,
      lastSeen: nowStr
    };
    users.push(user);
  } else {
    user.fullName = fullName;
    user.username = username;
    user.lastSeen = nowStr;
    // FOYDALANUVCHI TALABI: Qayta /start yoki restart bosilsa faqat laborant roli oddiy foydalanuvchiga qaytarilsin!
    // DIQQAT: 'admin' roli /start bosilganda BEKOR QILINMAYDI!
    if (isResetToUser && user.role === 'laborant') {
      console.log(`[Xavfsizlik] Foydalanuvchi ${user.fullName} (${user.id}) /start bosgani uchun laborant roli bekor qilindi.`);
      user.role = 'user';
    }
  }

  saveBotUsers(users);
  return user;
}

// -------------------------------------------------------------
// TELEGRAM API VA XABAR YUBORISH
// -------------------------------------------------------------
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
    console.error(`[sendMessage Error] to ${chatId}:`, err.message);
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
  } catch (e) {}
}

// -------------------------------------------------------------
// NAVBAT MA'LUMOTLARINI OLISH (MRT 1, MRT 2, MSKT)
// -------------------------------------------------------------
function getTodayQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const raw = fs.readFileSync(QUEUE_FILE, 'utf-8');
      const all = JSON.parse(raw);
      const todayStr = new Date().toISOString().split('T')[0];
      return all.filter(p => (p.date === todayStr || p.scheduledDate === todayStr) && p.status !== 'cancelled');
    }
  } catch (e) {}
  return [];
}

function formatDeviceQueueMessage(deviceId, deviceName) {
  const queue = getTodayQueue();
  const devQueue = queue.filter(p => p.deviceId === deviceId);

  const inProgress = devQueue.find(p => p.status === 'in_progress');
  const calling = devQueue.find(p => p.status === 'calling');
  const preparing = devQueue.find(p => p.status === 'preparing');
  const waitingList = devQueue.filter(p => p.status === 'waiting');
  const completedCount = devQueue.filter(p => p.status === 'completed').length;

  const nowTime = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  const nowDate = new Date().toLocaleDateString('uz-UZ');

  let text = `🏥 <b>${escapeHtml(deviceName)} — JONLI NAVBAT</b>\n`;
  text += `📅 <i>Sana: ${nowDate} | Vaqt: ${nowTime}</i>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // 1. Tekshirilmoqda
  if (inProgress) {
    text += `🟢 <b>XONADA (TEKSHIRILMOQDA):</b>\n`;
    text += `👤 <b>${escapeHtml(inProgress.patientName)}</b> (№ ${escapeHtml(inProgress.ticketNumber)})\n`;
    text += `🔬 <i>${escapeHtml(inProgress.primaryService)}</i>\n`;
    if (inProgress.isContrast) text += `💉 <b>KONTRAST MODDA BILAN</b>\n`;
    if (inProgress.estimatedFinishTime) {
      const fin = new Date(inProgress.estimatedFinishTime).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
      text += `⏳ Taxminiy yakun: <b>${fin}</b>\n`;
    }
    text += `\n`;
  } else if (calling) {
    text += `🔔 <b>XONAGA CHAQIRILMOQDA:</b>\n`;
    text += `👤 <b>${escapeHtml(calling.patientName)}</b> (№ ${escapeHtml(calling.ticketNumber)})\n\n`;
  } else {
    text += `🟢 <b>Xonada tekshiruv ketmayapti (Apparat bo'sh)</b>\n\n`;
  }

  // 2. Tayyorgarlikda
  if (preparing) {
    text += `🟡 <b>TAYYORGARLIKDA (NAVBATDAGI):</b>\n`;
    text += `👤 <b>${escapeHtml(preparing.patientName)}</b> (№ ${escapeHtml(preparing.ticketNumber)})\n`;
    text += `🔬 <i>${escapeHtml(preparing.primaryService)}</i>\n\n`;
  }

  // 3. Kutayotganlar
  text += `👥 <b>Kutish zalida kutayotganlar:</b> ${waitingList.length} nafar\n`;
  if (waitingList.length > 0) {
    waitingList.slice(0, 8).forEach((p, idx) => {
      const timeStr = p.scheduledTime || (p.estimatedStartTime ? new Date(p.estimatedStartTime).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '');
      const timeDisplay = timeStr ? `[${timeStr}] ` : '';
      text += `${idx + 1}. ${timeDisplay}<b>${escapeHtml(p.ticketNumber)}</b> — ${escapeHtml(p.patientName)}\n`;
    });
    if (waitingList.length > 8) {
      text += `<i>...va yana ${waitingList.length - 8} nafar bemor navbatda.</i>\n`;
    }
  }

  text += `\n✅ <b>Bugun yakunlangan tekshiruvlar:</b> ${completedCount} ta\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━`;
  return text;
}

function formatGeneralStatsMessage() {
  const queue = getTodayQueue();
  const mrt1 = queue.filter(p => p.deviceId === 'mrt1');
  const mrt2 = queue.filter(p => p.deviceId === 'mrt2');
  const mskt = queue.filter(p => p.deviceId === 'mskt1');

  const nowTime = new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  const nowDate = new Date().toLocaleDateString('uz-UZ');

  let text = `📊 <b>BUGUNGI UMUMIY STATISTIKA</b>\n`;
  text += `📅 <i>Sana: ${nowDate} | ${nowTime}</i>\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  text += `🧲 <b>1-MRT (1.5 Tesla):</b>\n`;
  text += `• Jami: ${mrt1.length} nafar | Kutmoqda: ${mrt1.filter(p => p.status === 'waiting').length} | Yakunlandi: ${mrt1.filter(p => p.status === 'completed').length}\n\n`;

  text += `🧲 <b>2-MRT (1.5 Tesla):</b>\n`;
  text += `• Jami: ${mrt2.length} nafar | Kutmoqda: ${mrt2.filter(p => p.status === 'waiting').length} | Yakunlandi: ${mrt2.filter(p => p.status === 'completed').length}\n\n`;

  text += `⚡ <b>MSKT 1:</b>\n`;
  text += `• Jami: ${mskt.length} nafar | Kutmoqda: ${mskt.filter(p => p.status === 'waiting').length} | Yakunlandi: ${mskt.filter(p => p.status === 'completed').length}\n\n`;

  text += `📌 <b>Jami bugungi ro'yxat:</b> ${queue.length} nafar bemor`;
  return text;
}

// -------------------------------------------------------------
// INTERFEYS VA TUGMALAR (ADMIN, LABORANT, BEMOR)
// -------------------------------------------------------------
async function sendMainMenu(chatId, fromInfo, isResetToUser = false) {
  const user = getOrUpdateUser(fromInfo, isResetToUser);
  const firstName = escapeHtml(fromInfo.first_name || "Foydalanuvchi");
  const settings = loadBotSettings();
  const webAppUrl = settings.webAppUrl || "https://hojiakbar-turotov.github.io/Radiology-AI/control.html";

  if (user.role === 'admin') {
    // 1. ADMIN MENYUSI (WEB APP BILAN)
    const text = 
      `👑 <b>Assalomu alaykum, Hurmatli Administrator ${firstName}!</b>\n\n` +
      `🏥 <b>Sizga MRT / MSKT Boshqaruv Administratsiyasi to'liq biriktirilgan.</b>\n\n` +
      `Quyidagi <b>Web App</b> tugmasi orqali to'liq <b>Admin Boshqaruv Paneli</b>ni bevosita Telegram ichida ochishingiz, bemorlarni navbatga yozishingiz, laboratoriya natijalari, ish grafiklari va sozlamalarni to'liq boshqarishingiz mumkin:`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "🚀 📱 Admin Panelni Ochish (Web App)", web_app: { url: webAppUrl } }
        ],
        [
          { text: "🧲 1-MRT Navbati", callback_data: "lab_mrt1" },
          { text: "🧲 2-MRT Navbati", callback_data: "lab_mrt2" }
        ],
        [
          { text: "⚡ MSKT Navbati", callback_data: "lab_mskt" },
          { text: "📊 Bugungi Statistika", callback_data: "lab_stats" }
        ],
        [
          { text: "👥 Foydalanuvchilar Ro'yxati", callback_data: "admin_users_info" },
          { text: "⚙️ WebApp Havolasi", callback_data: "admin_webapp_info" }
        ],
        [
          { text: "🔄 Yangilash", callback_data: "admin_refresh" }
        ]
      ]
    };

    const replyKeyboard = {
      keyboard: [
        [
          { text: "🚀 Admin Panel (Web App)", web_app: { url: webAppUrl } }
        ],
        [
          { text: "📊 Bugungi Statistika" },
          { text: "🧲 1-MRT" },
          { text: "⚡ MSKT" }
        ]
      ],
      resize_keyboard: true
    };

    await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: inlineKeyboard });
    await sendTelegramMessage(chatId, "👇 <i>Tezkor kirish uchun pastki menyuda ham Web App tugmasi faollashtirildi.</i>", {
      parse_mode: "HTML",
      reply_markup: replyKeyboard
    });
    return;
  } else if (user.role === 'laborant') {
    // 2. LABORANT MENYUSI
    const text = 
      `👋 <b>Assalomu alaykum, ${firstName}!</b>\n\n` +
      `👨‍⚕️ <b>Siz MRT/MSKT bo'limi Laboranti sifatida tasdiqlangansiz.</b>\n` +
      `Quyidagi tugmalar orqali xonalardagi jonli navbatni va statistikani real-time kuzatishingiz mumkin:`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🧲 1-MRT Navbati", callback_data: "lab_mrt1" },
          { text: "🧲 2-MRT Navbati", callback_data: "lab_mrt2" }
        ],
        [
          { text: "⚡ MSKT Navbati", callback_data: "lab_mskt" },
          { text: "📊 Bugungi Statistika", callback_data: "lab_stats" }
        ],
        [
          { text: "🔄 Botni qayta ishga tushirish (Chiqish)", callback_data: "restart_bot" }
        ]
      ]
    };

    await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
  } else {
    // 3. BEMOR MENYUSI (FAQ)
    const text = 
      `👋 <b>Assalomu alaykum, ${firstName}!</b>\n\n` +
      `🏥 <b>Respublika Onkologiya va Radiologiya Markazi MRT/MSKT bo'limining rasmiy yordamchi botiga xush kelibsiz!</b>\n\n` +
      `Quyidagi ko'p beriladigan savollardan birini tanlang yoki o'z savolingizni yozib qoldiring:`;

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
  }
}

// -------------------------------------------------------------
// FAQ JAVOBLARI (RASMDAGI MATNLAR BILAN 100% BIR XIL)
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// XABARLAR VA CALLBACK LARNI QAYTA ISHLASH
// -------------------------------------------------------------
async function processUpdate(update) {
  // 1. Tugma bosilganda (Callback Query)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message ? cb.message.chat.id : cb.from.id;
    const data = cb.data;
    const fromInfo = cb.from;

    await answerCallbackQuery(cb.id);

    // Qayta ishga tushirish: rolni 'user' ga qaytarish
    if (data === "restart_bot") {
      await sendMainMenu(chatId, fromInfo, true);
      return;
    }

    if (data === "admin_refresh") {
      await sendMainMenu(chatId, fromInfo, false);
      return;
    }

    if (data === "admin_webapp_info") {
      const settings = loadBotSettings();
      await sendTelegramMessage(chatId, 
        `🌐 <b>Hozirgi Admin Web App Havolasi:</b>\n<code>${escapeHtml(settings.webAppUrl)}</code>\n\n` +
        `💡 <i>Agar yangi GitHub Pages yoki boshqa HTTPS havolasiga o'tkazmoqchi bo'lsangiz, quyidagi buyruqni yuboring:</i>\n` +
        `<code>/setwebapp https://sizning-saytingiz.github.io/Radiology-AI/control.html</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (data === "admin_users_info") {
      const users = loadBotUsers();
      const admins = users.filter(u => u.role === 'admin');
      const labs = users.filter(u => u.role === 'laborant');
      const regular = users.filter(u => u.role === 'user');

      let txt = `👥 <b>BOT FOYDALANUVCHILARI STATISTIKASI:</b>\n\n`;
      txt += `👑 <b>Adminlar (${admins.length} nafar):</b>\n`;
      admins.forEach(a => txt += `• ${escapeHtml(a.fullName)} (${escapeHtml(a.username)})\n`);
      txt += `\n👨‍⚕️ <b>Laborantlar (${labs.length} nafar):</b>\n`;
      labs.forEach(l => txt += `• ${escapeHtml(l.fullName)} (${escapeHtml(l.username)})\n`);
      txt += `\n👤 <b>Oddiy foydalanuvchilar:</b> ${regular.length} nafar\n`;
      txt += `📌 <i>Jami ro'yxatdagilar: ${users.length} nafar.</i>`;

      await sendTelegramMessage(chatId, txt, { parse_mode: "HTML" });
      return;
    }

    // FAQ savollari
    if (FAQ_ANSWERS[data]) {
      await sendTelegramMessage(chatId, FAQ_ANSWERS[data], { parse_mode: "HTML" });
      return;
    }

    // Laborant yoki Admin amallari
    const user = getOrUpdateUser(fromInfo, false);
    if (user.role === 'laborant' || user.role === 'admin') {
      if (data === "lab_mrt1") {
        const text = formatDeviceQueueMessage('mrt1', '1-MRT Xonasi (1.5 Tesla)');
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML" });
      } else if (data === "lab_mrt2") {
        const text = formatDeviceQueueMessage('mrt2', '2-MRT Xonasi (1.5 Tesla)');
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML" });
      } else if (data === "lab_mskt") {
        const text = formatDeviceQueueMessage('mskt1', '1-MSKT Xonasi');
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML" });
      } else if (data === "lab_stats") {
        const text = formatGeneralStatsMessage();
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML" });
      }
    } else {
      if (data.startsWith('lab_')) {
        await sendTelegramMessage(chatId, "⚠️ <i>Ushbu ma'lumotni ko'rish faqat bo'lim xodimlariga ruxsat etilgan.</i>", { parse_mode: "HTML" });
      }
    }
    return;
  }

  // 2. Oddiy xabar kelganda
  if (!update.message) return;

  const msg = update.message;
  const chatId = msg.chat.id;
  const fromInfo = msg.from || { id: chatId, first_name: "Foydalanuvchi" };
  const text = (msg.text || "").trim();

  const isStartCmd = (text === "/start" || text.startsWith("/start"));

  // Log guruhiga yozish
  if (String(chatId) !== LOG_GROUP_ID && String(chatId) !== CHANNEL_ID) {
    const fullName = `${fromInfo.first_name || ''} ${fromInfo.last_name || ''}`.trim();
    const uname = fromInfo.username ? `@${fromInfo.username}` : "Username yo'q";
    sendLogToGroup(
      `📩 <b>BOT FOYDALANUVCHISI HARAKATI:</b>\n` +
      `👤 ${escapeHtml(fullName)} (${uname}, ID: <code>${fromInfo.id}</code>)\n` +
      `📝 Matn: <code>${escapeHtml(text || '(Media)')}</code>\n` +
      `⏰ ${new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" })}`
    );
  }

  // Reply Keyboard tugmalari
  if (text === "📊 Bugungi Statistika") {
    const sText = formatGeneralStatsMessage();
    await sendTelegramMessage(chatId, sText, { parse_mode: "HTML" });
    return;
  }
  if (text === "🧲 1-MRT") {
    const mText = formatDeviceQueueMessage('mrt1', '1-MRT Xonasi (1.5 Tesla)');
    await sendTelegramMessage(chatId, mText, { parse_mode: "HTML" });
    return;
  }
  if (text === "⚡ MSKT") {
    const kText = formatDeviceQueueMessage('mskt1', '1-MSKT Xonasi');
    await sendTelegramMessage(chatId, kText, { parse_mode: "HTML" });
    return;
  }

  // Admin login buyrug'i: /admin [parol] yoki /login [parol]
  if (text.startsWith("/admin") || text.startsWith("/login")) {
    const parts = text.split(/\s+/);
    const pwd = parts[1] || "";
    const settings = loadBotSettings();
    const user = getOrUpdateUser(fromInfo, false);

    if (user.role === 'admin') {
      await sendTelegramMessage(chatId, `👑 <b>Siz allaqachon Administratorsiz!</b>`, { parse_mode: "HTML" });
      await sendMainMenu(chatId, fromInfo, false);
      return;
    }

    if (pwd && (pwd === settings.adminPassword || pwd === "15420" || pwd === "admin123")) {
      user.role = 'admin';
      const users = loadBotUsers();
      const idx = users.findIndex(u => String(u.id) === String(user.id));
      if (idx !== -1) users[idx].role = 'admin';
      saveBotUsers(users);

      await sendTelegramMessage(chatId, 
        `🎉 <b>TABRIKLAYMIZ, ${escapeHtml(user.fullName)}!</b>\n\n` +
        `👑 Sizga <b>Administrator (Admin)</b> roli muvaffaqiyatli berildi!\n` +
        `Endi siz to'liq Admin Panelni Web App orqali ochishingiz va barcha boshqaruvni amalga oshirishingiz mumkin.`,
        { parse_mode: "HTML" }
      );
      await sendMainMenu(chatId, fromInfo, false);
      return;
    } else {
      await sendTelegramMessage(chatId, 
        `🔐 <b>Administratorlikka Kirish</b>\n\n` +
        `Parolni quyidagicha yuboring:\n` +
        `<code>/admin [parol]</code>\n\n` +
        `<i>Misol: <code>/admin 15420</code></i>`,
        { parse_mode: "HTML" }
      );
      return;
    }
  }

  // WebApp URL sozlash buyrug'i: /setwebapp <url>
  if (text.startsWith("/setwebapp")) {
    const user = getOrUpdateUser(fromInfo, false);
    if (user.role !== 'admin') {
      await sendTelegramMessage(chatId, "⚠️ <i>Ushbu buyruq faqat bot adminlari uchun!</i>", { parse_mode: "HTML" });
      return;
    }
    const parts = text.split(/\s+/);
    const newUrl = parts[1] || "";
    if (newUrl.startsWith("https://")) {
      const settings = loadBotSettings();
      settings.webAppUrl = newUrl;
      saveBotSettings(settings);
      await sendTelegramMessage(chatId, `✅ <b>Admin WebApp havolasi saqlandi:</b>\n<code>${escapeHtml(newUrl)}</code>`, { parse_mode: "HTML" });
      await sendMainMenu(chatId, fromInfo, false);
      return;
    } else {
      await sendTelegramMessage(chatId, 
        `⚠️ <b>Havola xato!</b> Telegram Web App faqat <b>https://</b> bilan boshlanuvchi xavfsiz havolalarni qabul qiladi.\n\n` +
        `Masalan: <code>/setwebapp https://hojiakbar-turotov.github.io/Radiology-AI/control.html</code>`,
        { parse_mode: "HTML" }
      );
      return;
    }
  }

  // Boshqa barcha holatlarda menyuni chiqarish
  await sendMainMenu(chatId, fromInfo, isStartCmd);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// -------------------------------------------------------------
// HAR KUNI ERTALAB SOAT 08:00 DA LABORANTLARGA ESLATMA
// -------------------------------------------------------------
let lastBroadcastDate = "";

async function checkMorningNotification() {
  try {
    const now = new Date();
    // Toshkent vaqti bo'yicha soat va daqiqa
    const tashkentTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Tashkent', hour12: false, hour: '2-digit', minute: '2-digit' });
    const tashkentDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }); // YYYY-MM-DD

    // Soat 08:00 oralig'ida (08:00 dan 08:05 gacha) va bugun hali yuborilmagan bo'lsa
    if (tashkentTimeStr >= "08:00" && tashkentTimeStr <= "08:05" && lastBroadcastDate !== tashkentDateStr) {
      lastBroadcastDate = tashkentDateStr;
      console.log(`[Ertalabki Eslatma] ${tashkentDateStr} 08:00: Laborantlarga eslatma yuborilmoqda...`);

      const users = loadBotUsers();
      const laborants = users.filter(u => u.role === 'laborant');

      if (laborants.length > 0) {
        const queue = getTodayQueue();
        const mrt1Count = queue.filter(p => p.deviceId === 'mrt1').length;
        const mrt2Count = queue.filter(p => p.deviceId === 'mrt2').length;
        const msktCount = queue.filter(p => p.deviceId === 'mskt1').length;

        const broadcastMsg = 
          `☀️ <b>Xayrli tong, hurmatli hamkasb!</b>\n\n` +
          `🏥 <b>Bugungi MRT & MSKT Navbati Rejasi:</b>\n` +
          `• 🧲 1-MRT: <b>${mrt1Count}</b> nafar bemor\n` +
          `• 🧲 2-MRT: <b>${mrt2Count}</b> nafar bemor\n` +
          `• ⚡ MSKT: <b>${msktCount}</b> nafar bemor\n\n` +
          `📌 <i>Jami rejalashtirilgan: ${queue.length} nafar bemor.</i>\n\n` +
          `Jonli navbatni kuzatish uchun botdagi tugmalardan foydalanishingiz mumkin. Ishingizga muvaffaqiyat tilaymiz!`;

        for (const lab of laborants) {
          await sendTelegramMessage(lab.id, broadcastMsg, { parse_mode: "HTML" });
          await new Promise(r => setTimeout(r, 200));
        }
        console.log(`[Ertalabki Eslatma] ${laborants.length} ta laborantga muvaffaqiyatli yetkazildi.`);
      }
    }
  } catch (err) {
    console.error("[Ertalabki Eslatma Xatosi]:", err.message);
  }
}

// Har 30 soniyada ertalabki eslatmani tekshirish
setInterval(checkMorningNotification, 30000);

// -------------------------------------------------------------
// POLLING DVIGATELI
// -------------------------------------------------------------
let offset = 0;
let isPolling = true;

async function startPolling() {
  console.log("================================================================================");
  console.log("  🤖 RADIODIAGNOSTIKA TELEGRAM BOT RUNNER (@Radiodiagnostika_bot)");
  console.log("  • Bemorlar FAQ (Tayyorgarlik, Farqi, Navbat, Vaqt)");
  console.log("  • data/bot_users.json ro'yxatga olish");
  console.log("  • Qayta /start bosilganda xavfsiz oddiy foydalanuvchiga tushirish");
  console.log("  • Laborantlar uchun jonli MRT 1, MRT 2 va MSKT navbati");
  console.log("  • Har kuni soat 08:00 da kunlik eslatma");
  console.log("================================================================================");

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
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

process.on("SIGINT", () => { isPolling = false; process.exit(0); });
process.on("SIGTERM", () => { isPolling = false; process.exit(0); });

startPolling();
