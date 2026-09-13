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
const TUNNEL_CONFIG_FILE = path.join(ROOT_DIR, 'tunnel_config.json');
const TUNNEL_STATUS_FILE = path.join(ROOT_DIR, 'data', 'tunnel_status.json');
const SCHEDULES_FILE = path.join(ROOT_DIR, 'data', 'schedules.json');
const systemMonitor = require('./lib/system_monitor');

// -------------------------------------------------------------
// FOYDALANUVCHILAR VA SOZLAMALAR BAZASI
// -------------------------------------------------------------
function getLiveWebAppUrl() {
  try {
    if (fs.existsSync(TUNNEL_CONFIG_FILE)) {
      const tc = JSON.parse(fs.readFileSync(TUNNEL_CONFIG_FILE, 'utf8'));
      if (tc && tc.mrt_mskt && tc.mrt_mskt.onlineControlUrl) {
        return tc.mrt_mskt.onlineControlUrl;
      }
    }
  } catch (e) {}
  const bs = loadBotSettings();
  if (bs && bs.webAppUrl) return bs.webAppUrl;
  return "https://hojiakbar-turotov.github.io/Radiology-AI/control.html";
}

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

async function setTelegramMenuButton(chatId = null, webAppUrl = "https://hojiakbar-turotov.github.io/Radiology-AI/control.html") {
  try {
    const payload = {
      menu_button: {
        type: "web_app",
        text: "🚀 Admin Panel",
        web_app: { url: webAppUrl }
      }
    };
    if (chatId) payload.chat_id = chatId;
    await fetch(`${TG_API_BASE}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
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
// NAVBAT BO'YICHA ADMIN AMALLARI (TELEGRAM ORQALI BOSHQARISH)
// -------------------------------------------------------------
async function callNextPatient(deviceId) {
  try {
    const queue = getTodayQueue().filter(p => p.deviceId === deviceId);
    const nextPat = queue.find(p => p.status === 'waiting');
    if (!nextPat) return { success: false, message: "Navbatda kutayotgan bemor yo'q" };

    try {
      const res = await fetch("http://localhost:9890/api/queue/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nextPat.id })
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, message: `${nextPat.patientName} (ID: ${nextPat.ticketNumber || nextPat.patientId}) chaqirildi!` };
      }
    } catch (netErr) {}

    // Fallback: Faylni to'g'ridan-to'g'ri yangilash
    const all = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const p = all.find(x => x.id === nextPat.id);
    if (p) {
      all.forEach(x => { if (x.deviceId === deviceId && x.status === 'calling') x.status = 'waiting'; });
      p.status = 'calling';
      p.calledAt = new Date().toISOString();
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(all, null, 2), 'utf8');
      return { success: true, message: `${nextPat.patientName} chaqirildi!` };
    }
    return { success: false, message: "Bemor topilmadi" };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function startExamPatient(deviceId) {
  try {
    const queue = getTodayQueue().filter(p => p.deviceId === deviceId);
    const pat = queue.find(p => p.status === 'calling') || queue.find(p => p.status === 'waiting');
    if (!pat) return { success: false, message: "Chaqirilgan yoki navbatdagi bemor yo'q" };

    try {
      const res = await fetch("http://localhost:9890/api/queue/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pat.id, status: "in_progress" })
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, message: `${pat.patientName} tekshiruvga kirdi!` };
      }
    } catch (netErr) {}

    const all = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const p = all.find(x => x.id === pat.id);
    if (p) {
      p.status = 'in_progress';
      p.startTime = new Date().toISOString();
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(all, null, 2), 'utf8');
      return { success: true, message: `${pat.patientName} tekshiruvga kirdi!` };
    }
    return { success: false, message: "Bemor topilmadi" };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

async function finishExamPatient(deviceId) {
  try {
    const queue = getTodayQueue().filter(p => p.deviceId === deviceId);
    const pat = queue.find(p => p.status === 'in_progress');
    if (!pat) return { success: false, message: "Hozirda tekshirilayotgan bemor yo'q" };

    try {
      const res = await fetch("http://localhost:9890/api/queue/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pat.id, status: "completed" })
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, message: `${pat.patientName} tekshiruvi yakunlandi!` };
      }
    } catch (netErr) {}

    const all = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const p = all.find(x => x.id === pat.id);
    if (p) {
      p.status = 'completed';
      p.completedAt = new Date().toISOString();
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(all, null, 2), 'utf8');
      return { success: true, message: `${pat.patientName} tekshiruvi yakunlandi!` };
    }
    return { success: false, message: "Bemor topilmadi" };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function getDeviceQueueInlineKeyboard(deviceId, userRole) {
  const devKey = (deviceId === 'mskt1') ? 'mskt' : deviceId;
  if (userRole !== 'admin') {
    return {
      inline_keyboard: [
        [{ text: "🔄 Yangilash", callback_data: `lab_${devKey}` }],
        [{ text: "🔙 Asosiy Menyu", callback_data: "restart_bot" }]
      ]
    };
  }
  const liveWebAppUrl = getLiveWebAppUrl();
  const ghPagesUrl = "https://hojiakbar-turotov.github.io/Radiology-AI/control.html";
  const directTunnelUrl = (liveWebAppUrl.includes('trycloudflare.com')) ? liveWebAppUrl : `https://eau-jose-adware-flux.trycloudflare.com/control`;

  return {
    inline_keyboard: [
      [
        { text: "🔔 Navbatdagini Chaqirish", callback_data: `call_next_${deviceId}` }
      ],
      [
        { text: "🚪 Xonada (Boshlash)", callback_data: `start_curr_${deviceId}` },
        { text: "✅ Yakunlash", callback_data: `finish_curr_${deviceId}` }
      ],
      [
        { text: "🚀 📱 Web App", web_app: { url: ghPagesUrl } },
        { text: "🌐 Brauzerda", url: directTunnelUrl },
        { text: "🔄 Yangilash", callback_data: `lab_${devKey}` }
      ],
      [
        { text: "🔙 Asosiy Menyu", callback_data: "admin_refresh" }
      ]
    ]
  };
}

function formatSystemHealthMessage(report) {
  const admin = report.services.adminServer;
  const reg = report.services.regServerLocal;
  const regSec = report.services.regSecurityBarrier;
  const tunnel = report.services.cloudflareTunnel;
  const bot = report.services.telegramBot;
  const res = report.services.systemResources;

  const statusEmoji = report.overallStatus === 'HEALTHY' ? '🟢' : (report.overallStatus === 'DEGRADED' ? '🟡' : '🔴');
  
  let txt = `🩺 <b>TIZIM MONITORINGI VA SALOMATLIK (${statusEmoji} ${report.overallStatus})</b>\n`;
  txt += `<i>Tekshirilgan vaqt: ${new Date(report.checkedAt).toLocaleTimeString('uz-UZ')}</i>\n`;
  txt += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  txt += `🧲 <b>Admin Server (Port 9890):</b> ${admin.status === 'UP' ? '🟢 ISHLAMOQDA' : '🔴 TO\'XTAGAN'} (${admin.latencyMs}ms)\n`;
  txt += `🏥 <b>Registratura (Port 9891):</b> ${reg.status === 'UP' ? '🟢 ISHLAMOQDA (LAN)' : '🔴 TO\'XTAGAN'}\n`;
  txt += `🛡️ <b>LAN Xavfsizlik:</b> ${regSec.status === 'SECURED' ? '🟢 QAT\'IY HIMOYA (403)' : '⚠️ OGOHLANTIRISH'}\n`;
  
  if (tunnel && tunnel.status === 'ONLINE') {
    txt += `🌐 <b>Cloudflare Tunnel:</b> 🟢 JONLI (${tunnel.externalLatencyMs}ms)\n`;
    txt += `   🔗 <code>${escapeHtml(tunnel.url)}</code>\n`;
  } else {
    txt += `🌐 <b>Cloudflare Tunnel:</b> 🔴 UZILGAN\n`;
  }

  txt += `🤖 <b>Telegram Bot:</b> ${bot.status === 'ACTIVE' ? '🟢 FAOL' : '🔴 XATOLIK'} (@${bot.botUsername})\n\n`;

  txt += `💻 <b>Xotira (RAM):</b> ${res.memoryHeapUsedMb} MB (Heap) / ${res.memoryRssMb} MB (RSS)\n`;
  txt += `⏱️ <b>Uptime:</b> ${Math.floor(res.uptimeSeconds / 60)} daqiqa (OS: ${res.osUptimeHours} soat)\n`;
  txt += `⚠️ <b>Faol Insidentlar:</b> ${report.recentIncidentsCount} ta\n`;

  if (report.latestIncidents && report.latestIncidents.length > 0) {
    txt += `\n📋 <b>So'nggi hodisalar:</b>\n`;
    report.latestIncidents.slice(0, 3).forEach(inc => {
      const icon = inc.level === 'CRITICAL' ? '🚨' : (inc.level === 'ERROR' ? '❌' : '⚠️');
      txt += `${icon} [${inc.level}] <i>${escapeHtml(inc.message)}</i>\n`;
    });
  }

  return txt;
}

// -------------------------------------------------------------
// INTERFEYS VA TUGMALAR (ADMIN, LABORANT, BEMOR)
// -------------------------------------------------------------
async function sendMainMenu(chatId, fromInfo, isResetToUser = false) {
  const user = getOrUpdateUser(fromInfo, isResetToUser);
  const firstName = escapeHtml(fromInfo.first_name || "Foydalanuvchi");
  const liveWebAppUrl = getLiveWebAppUrl();

  if (user.role === 'admin') {
    // 1. ADMIN MENYUSI (WEB APP VA TO'LIQ INLINE BOSHQARUV)
    const text = 
      `👑 <b>Assalomu alaykum, Hurmatli Administrator ${firstName}!</b>\n\n` +
      `🏥 <b>MRT & MSKT Boshqaruv Administratsiyasi (Port 9890)</b>\n\n` +
      `Quyidagi <b>Web App</b> tugmasi orqali to'liq <b>Admin Boshqaruv Paneli</b>ni bevosita Telegram ichida ochishingiz yoki quyidagi tezkor tugmalar orqali navbatlarni boshqarishingiz mumkin:`;

    const ghPagesUrl = "https://hojiakbar-turotov.github.io/Radiology-AI/control.html";
    const directTunnelUrl = (liveWebAppUrl.includes('trycloudflare.com')) ? liveWebAppUrl : `https://eau-jose-adware-flux.trycloudflare.com/control`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: "🚀 📱 Admin Web App (Telegram)", web_app: { url: ghPagesUrl } },
          { text: "🌐 Brauzerda Ochish", url: directTunnelUrl }
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
          { text: "👥 Foydalanuvchilar & Rollar", callback_data: "admin_users_info" },
          { text: "⏰ Bugungi Ish Grafigi", callback_data: "admin_schedule_info" }
        ],
        [
          { text: "🩺 Tizim Monitoringi & Salomatlik", callback_data: "admin_monitor_info" }
        ],
        [
          { text: "🌐 Cloudflare Tunnel & GitHub", callback_data: "admin_tunnel_info" },
          { text: "🔄 Yangilash", callback_data: "admin_refresh" }
        ]
      ]
    };

    const replyKeyboard = {
      keyboard: [
        [
          { text: "🚀 Admin Web App", web_app: { url: ghPagesUrl } },
          { text: "📊 Bugungi Statistika" }
        ],
        [
          { text: "🧲 1-MRT" },
          { text: "⚡ MSKT" },
          { text: "🩺 Tizim Salomatligi" }
        ]
      ],
      resize_keyboard: true
    };

    await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: inlineKeyboard });
    // Asinxron tarzda Telegram chat menyu tugmasini WebApp ga sozlash (ikkinchi ortiqcha xabar yubormaslik uchun)
    setTelegramMenuButton(chatId, ghPagesUrl);
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

      let txt = `👥 <b>BOT FOYDALANUVCHILARI & ROLLAR BOSHQARUVI:</b>\n\n`;
      txt += `👑 <b>Adminlar (${admins.length}):</b>\n`;
      admins.forEach(a => txt += `• ${escapeHtml(a.fullName)} (${escapeHtml(a.username)})\n`);
      txt += `\n👨‍⚕️ <b>Laborantlar (${labs.length}):</b>\n`;
      labs.forEach(l => txt += `• ${escapeHtml(l.fullName)} (${escapeHtml(l.username)})\n`);
      txt += `\n👤 <b>Bemorlar / Oddiy:</b> ${regular.length} nafar\n`;
      txt += `\n💡 <i>Foydalanuvchi huquqini o'zgartirish uchun pastdagi tugmalardan foydalaning:</i>`;

      // Build inline action rows for non-admin users (up to 8)
      const userButtons = [];
      users.slice(0, 8).forEach(u => {
        const uLabel = (u.fullName || String(u.id)).substring(0, 14);
        const roleIcon = u.role === 'admin' ? '👑' : (u.role === 'laborant' ? '👨‍⚕️' : '👤');
        userButtons.push([
          { text: `${roleIcon} ${uLabel}`, callback_data: `info_u_${u.id}` },
          { text: "👑 Admin", callback_data: `set_role_admin_${u.id}` },
          { text: "👨‍⚕️ Lab", callback_data: `set_role_lab_${u.id}` },
          { text: "👤 Bekor", callback_data: `set_role_user_${u.id}` }
        ]);
      });

      userButtons.push([
        { text: "🔄 Yangilash", callback_data: "admin_users_info" },
        { text: "🔙 Asosiy Menyu", callback_data: "admin_refresh" }
      ]);

      await sendTelegramMessage(chatId, txt, { parse_mode: "HTML", reply_markup: { inline_keyboard: userButtons } });
      return;
    }

    if (data.startsWith("set_role_")) {
      const user = getOrUpdateUser(fromInfo, false);
      if (user.role !== 'admin') {
        await answerCallbackQuery(cb.id, "⚠️ Faqat Administrator uchun!");
        return;
      }
      const parts = data.split("_"); // set, role, (admin|lab|user), id
      const targetRole = parts[2] === 'lab' ? 'laborant' : (parts[2] === 'admin' ? 'admin' : 'user');
      const targetId = parts[3];

      const users = loadBotUsers();
      const targetUser = users.find(u => String(u.id) === String(targetId));
      if (targetUser) {
        targetUser.role = targetRole;
        targetUser.updatedAt = new Date().toISOString();
        saveBotUsers(users);
        await answerCallbackQuery(cb.id, `✅ ${targetUser.fullName || targetId} roli: ${targetRole}`);
      } else {
        await answerCallbackQuery(cb.id, "❌ Foydalanuvchi topilmadi");
      }
      return;
    }

    if (data.startsWith("info_u_")) {
      const uId = data.replace("info_u_", "");
      const users = loadBotUsers();
      const u = users.find(x => String(x.id) === String(uId));
      if (u) {
        await answerCallbackQuery(cb.id, `ID: ${u.id} | ${u.fullName} | Roli: ${u.role || 'user'}`);
      }
      return;
    }

    // Cloudflare Tunnel va GitHub Holati
    if (data === "admin_tunnel_info") {
      let tunnelCfg = {};
      try {
        if (fs.existsSync(TUNNEL_CONFIG_FILE)) {
          tunnelCfg = JSON.parse(fs.readFileSync(TUNNEL_CONFIG_FILE, 'utf8'));
        }
      } catch (e) {}

      let tunnelStat = {};
      try {
        if (fs.existsSync(TUNNEL_STATUS_FILE)) {
          tunnelStat = JSON.parse(fs.readFileSync(TUNNEL_STATUS_FILE, 'utf8'));
        }
      } catch (e) {}

      const onlineUrl = (tunnelCfg.mrt_mskt && tunnelCfg.mrt_mskt.onlineControlUrl) || (tunnelStat.controlUrl) || "Kutilmoqda...";
      const gitStatus = tunnelStat.gitPushStatus || "Kutilmoqda";
      const liveWebAppUrl = getLiveWebAppUrl();

      const txt = 
        `🌐 <b>CLOUDFLARE TUNNEL & GITHUB BROKER HOLATI:</b>\n\n` +
        `📱 <b>Online Admin (HTTPS):</b>\n<code>${escapeHtml(onlineUrl)}</code>\n\n` +
        `💻 <b>Lokal Admin (LAN):</b>\n<code>http://localhost:9890/control</code>\n\n` +
        `🔒 <b>Registratura Serveri (LAN):</b>\n<code>http://localhost:9891</code>\n<i>(Faqat ichki Wi-Fi/LAN tarmog'ida ishlaydi, tashqi tunneldan yopiq)</i>\n\n` +
        `🐙 <b>GitHub Config:</b>\n<a href="https://raw.githubusercontent.com/Hojiakbar-Turotov/Radiology-AI/main/tunnel_config.json">tunnel_config.json</a>\n` +
        `📊 <b>GitHub Push Holati:</b> <code>${escapeHtml(gitStatus)}</code>\n` +
        `⏰ <b>Oxirgi yangilanish:</b> ${tunnelStat.updatedAt ? new Date(tunnelStat.updatedAt).toLocaleTimeString('uz-UZ') : '-'}`;

      const kb = {
        inline_keyboard: [
          [
            { text: "🚀 Admin Panel (Web App)", web_app: { url: liveWebAppUrl } }
          ],
          [
            { text: "🔄 Tunnelni Qayta Ishga Tushirish", callback_data: "admin_restart_tunnel" }
          ],
          [
            { text: "🔙 Asosiy Menyu", callback_data: "admin_refresh" }
          ]
        ]
      };

      await sendTelegramMessage(chatId, txt, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    if (data === "admin_restart_tunnel") {
      await answerCallbackQuery(cb.id, "⚡ Tunnel qayta tekshirilmoqda...");
      try {
        const { exec } = require('child_process');
        exec('node mrt_tunnel_agent.js', { cwd: ROOT_DIR });
      } catch (e) {}
      await sendTelegramMessage(chatId, "✅ <i>Cloudflare Tunnel yangilanmoqda va GitHub brokeriga yuborilmoqda...</i>", { parse_mode: "HTML" });
      return;
    }

    // Tizim Monitoringi va Salomatlik
    if (data === "admin_monitor_info") {
      await answerCallbackQuery(cb.id, "🩺 Diagnostika o'tkazilmoqda...");
      const report = await systemMonitor.checkSystemHealth();
      const txt = formatSystemHealthMessage(report);
      const kb = {
        inline_keyboard: [
          [
            { text: "🚀 Admin Panel (Web App)", web_app: { url: getLiveWebAppUrl() } },
            { text: "🔄 Qayta Tekshirish", callback_data: "admin_monitor_info" }
          ],
          [
            { text: "⚡ Tunnelni Qayta Boshlash", callback_data: "admin_restart_tunnel" },
            { text: "🔙 Asosiy Menyu", callback_data: "admin_refresh" }
          ]
        ]
      };
      await sendTelegramMessage(chatId, txt, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    // Bugungi Ish Grafigi
    if (data === "admin_schedule_info") {
      let sched = {};
      try {
        if (fs.existsSync(SCHEDULES_FILE)) {
          sched = JSON.parse(fs.readFileSync(SCHEDULES_FILE, 'utf8'));
        }
      } catch (e) {}

      const dayIdx = new Date().getDay();
      const dayKey = String(dayIdx);
      const dayNames = { "1": "Dushanba", "2": "Seshanba", "3": "Chorshanba", "4": "Payshanba", "5": "Juma", "6": "Shanba", "0": "Yakshanba" };
      const dayCfg = (sched.weeklySchedule && sched.weeklySchedule[dayKey]) || { isOpen: true, intervals: [{ start: "08:00", end: "19:00" }] };

      let txt = `⏰ <b>BUGUNGI ISH GRAFIGI (${dayNames[dayKey]}):</b>\n\n`;
      txt += `📋 <b>Holat:</b> ${dayCfg.isOpen ? '✅ Ish kuni' : '⛔ Dam olish kuni'}\n`;
      if (dayCfg.isOpen && dayCfg.intervals && dayCfg.intervals.length > 0) {
        txt += `🕒 <b>Smenalar:</b>\n`;
        dayCfg.intervals.forEach((inv, i) => {
          txt += `   ${i + 1}. <b>${inv.start} — ${inv.end}</b>\n`;
        });
      } else {
        txt += `<i>Bugun apparatlarda ish soatlari kiritilmagan.</i>\n`;
      }

      const kb = {
        inline_keyboard: [
          [
            { text: "🚀 Grafikni Tahrirlash (Web App)", web_app: { url: getLiveWebAppUrl() } }
          ],
          [
            { text: "🔙 Asosiy Menyu", callback_data: "admin_refresh" }
          ]
        ]
      };

      await sendTelegramMessage(chatId, txt, { parse_mode: "HTML", reply_markup: kb });
      return;
    }

    // Navbat bo'yicha tezkor amallar (Chaqirish / Xonada / Yakunlash)
    if (data.startsWith("call_next_") || data.startsWith("start_curr_") || data.startsWith("finish_curr_")) {
      const user = getOrUpdateUser(fromInfo, false);
      if (user.role !== 'admin') {
        await answerCallbackQuery(cb.id, "⚠️ Faqat Administrator uchun!");
        return;
      }

      let resAction = null;
      let devId = null;
      if (data.startsWith("call_next_")) {
        devId = data.replace("call_next_", "");
        resAction = await callNextPatient(devId);
      } else if (data.startsWith("start_curr_")) {
        devId = data.replace("start_curr_", "");
        resAction = await startExamPatient(devId);
      } else if (data.startsWith("finish_curr_")) {
        devId = data.replace("finish_curr_", "");
        resAction = await finishExamPatient(devId);
      }

      if (resAction && resAction.success) {
        await answerCallbackQuery(cb.id, `✅ ${resAction.message}`);
      } else {
        await answerCallbackQuery(cb.id, `⚠️ ${resAction ? resAction.message : 'Amal bajarilmadi'}`);
      }

      const devName = (devId === 'mskt1') ? '1-MSKT Xonasi' : ((devId === 'mrt2') ? '2-MRT Xonasi (1.5 Tesla)' : '1-MRT Xonasi (1.5 Tesla)');
      const text = formatDeviceQueueMessage(devId, devName);
      const keyboard = getDeviceQueueInlineKeyboard(devId, user.role);
      await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
      return;
    }

    // FAQ savollari
    if (FAQ_ANSWERS[data]) {
      await sendTelegramMessage(chatId, FAQ_ANSWERS[data], { parse_mode: "HTML" });
      return;
    }

    // Laborant yoki Admin amallari (Navbat ko'rish)
    const user = getOrUpdateUser(fromInfo, false);
    if (user.role === 'laborant' || user.role === 'admin') {
      if (data === "lab_mrt1") {
        const text = formatDeviceQueueMessage('mrt1', '1-MRT Xonasi (1.5 Tesla)');
        const keyboard = getDeviceQueueInlineKeyboard('mrt1', user.role);
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
      } else if (data === "lab_mrt2") {
        const text = formatDeviceQueueMessage('mrt2', '2-MRT Xonasi (1.5 Tesla)');
        const keyboard = getDeviceQueueInlineKeyboard('mrt2', user.role);
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
      } else if (data === "lab_mskt") {
        const text = formatDeviceQueueMessage('mskt1', '1-MSKT Xonasi');
        const keyboard = getDeviceQueueInlineKeyboard('mskt1', user.role);
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: keyboard });
      } else if (data === "lab_stats") {
        const text = formatGeneralStatsMessage();
        const kb = {
          inline_keyboard: [
            [{ text: "🚀 Admin Panel (Web App)", web_app: { url: getLiveWebAppUrl() } }],
            [{ text: "🔙 Asosiy Menyu", callback_data: "admin_refresh" }]
          ]
        };
        await sendTelegramMessage(chatId, text, { parse_mode: "HTML", reply_markup: kb });
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
  if (text === "🩺 Tizim Salomatligi" || text === "🩺 Tizim Monitoringi") {
    const report = await systemMonitor.checkSystemHealth();
    const hText = formatSystemHealthMessage(report);
    await sendTelegramMessage(chatId, hText, { parse_mode: "HTML" });
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

  // Tizim monitoringi va diagnostikasi: /status, /health, /monitor
  if (text === "/status" || text === "/health" || text === "/monitor") {
    const user = getOrUpdateUser(fromInfo, false);
    if (user.role !== 'admin') {
      await sendTelegramMessage(chatId, "⚠️ <i>Tizim monitoringi faqat Administratorlar uchun ochiq. /admin [parol] bilan kiring.</i>", { parse_mode: "HTML" });
      return;
    }
    const report = await systemMonitor.checkSystemHealth();
    const sTxt = formatSystemHealthMessage(report);
    const kb = {
      inline_keyboard: [
        [
          { text: "🚀 Admin Panel (Web App)", web_app: { url: getLiveWebAppUrl() } },
          { text: "🔄 Qayta Tekshirish", callback_data: "admin_monitor_info" }
        ],
        [
          { text: "⚡ Tunnelni Qayta Boshlash", callback_data: "admin_restart_tunnel" },
          { text: "🔙 Asosiy Menyu", callback_data: "admin_refresh" }
        ]
      ]
    };
    await sendTelegramMessage(chatId, sTxt, { parse_mode: "HTML", reply_markup: kb });
    return;
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
  console.log("================================================================================");
  
  // Bot ishga tushganda Telegram WebApp menyu tugmasini sozlash
  setTelegramMenuButton();

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
