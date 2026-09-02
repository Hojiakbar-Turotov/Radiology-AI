/**
 * Tibbiyot / MRT & MSKT Laborantlar Telegram Boti (lib/laborant-bot.js)
 * Laborantlar kun davomida o'z xonalaridagi (MRT 1, MRT 2, MSKT) bemorlar ro'yxatini real-time olishadi.
 */

const https = require('https');

const BOT_TOKEN = "8795065373:AAEOlNtUUYugOL8_dkhAqq3zJ1sxHavTGH0";
const TG_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

class LaborantBot {
  constructor(db, smartScheduler) {
    this.db = db;
    this.scheduler = smartScheduler;
    this.offset = 0;
    this.isPolling = false;
    this.pollTimer = null;
  }

  start() {
    if (this.isPolling) return;
    this.isPolling = true;
    console.log("[Telegram Bot] Laborantlar boti ishga tushdi (@bot)...");
    this.pollUpdates();
  }

  stop() {
    this.isPolling = false;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    console.log("[Telegram Bot] Bot to'xtatildi.");
  }

  async pollUpdates() {
    if (!this.isPolling) return;

    try {
      const url = `${TG_BASE}/getUpdates?offset=${this.offset}&timeout=25`;
      const res = await this.httpRequest(url);
      const data = JSON.parse(res);

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          this.offset = update.update_id + 1;
          await this.handleUpdate(update);
        }
      }
    } catch (err) {
      // Internet uzilgan bo'lsa yoki Telegram javob bermasa server yiqilmaydi
      // console.warn("[Telegram Bot Poll Warn]:", err.message);
    }

    if (this.isPolling) {
      this.pollTimer = setTimeout(() => this.pollUpdates(), 1000);
    }
  }

  async handleUpdate(update) {
    // 1. Matnli xabarlar
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const userName = update.message.from.first_name || "Laborant";

      if (text === "/start" || text === "/help") {
        await this.sendWelcome(chatId, userName);
      } else if (text === "/mrt1" || text.toLowerCase().includes("mrt 1")) {
        await this.sendDeviceQueue(chatId, "mrt1", "MRT 1 (1.5 Tesla)");
      } else if (text === "/mrt2" || text.toLowerCase().includes("mrt 2")) {
        await this.sendDeviceQueue(chatId, "mrt2", "MRT 2 (3.0 Tesla)");
      } else if (text === "/mskt" || text.toLowerCase().includes("mskt")) {
        await this.sendDeviceQueue(chatId, "mskt1", "MSKT 1");
      } else if (text === "/bugun" || text === "/navbat") {
        await this.sendGeneralStats(chatId);
      } else {
        await this.sendWelcome(chatId, userName, "Noma'lum buyruq. Quyidagi tugmalardan foydalaning:");
      }
    }

    // 2. Inline tugmalar (Callback query)
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;
      const data = query.data;

      if (data === "cmd_mrt1") {
        await this.sendDeviceQueue(chatId, "mrt1", "MRT 1 (1.5 Tesla)", messageId);
      } else if (data === "cmd_mrt2") {
        await this.sendDeviceQueue(chatId, "mrt2", "MRT 2 (3.0 Tesla)", messageId);
      } else if (data === "cmd_mskt") {
        await this.sendDeviceQueue(chatId, "mskt1", "MSKT 1", messageId);
      } else if (data === "cmd_stats") {
        await this.sendGeneralStats(chatId, messageId);
      }

      // Tugma bosilishiga javob qaytarish
      try {
        await this.httpRequest(`${TG_BASE}/answerCallbackQuery?callback_query_id=${query.id}`);
      } catch (e) {}
    }
  }

  async sendWelcome(chatId, userName, customMsg = null) {
    const text = customMsg || `Assalomu alaykum, *${userName}*!\n\n🏥 *MRT & MSKT Navbat Tizimi Boti*\nQuyidagi tugmalar orqali xonalardagi jonli bemorlar ro'yxatini olishingiz mumkin:`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "🧲 MRT 1 Navbati", callback_data: "cmd_mrt1" },
          { text: "🧲 MRT 2 Navbati", callback_data: "cmd_mrt2" }
        ],
        [
          { text: "⚡ MSKT Navbati", callback_data: "cmd_mskt" },
          { text: "📊 Bugungi Statistika", callback_data: "cmd_stats" }
        ]
      ]
    };

    await this.sendMessage(chatId, text, keyboard);
  }

  async sendDeviceQueue(chatId, deviceId, deviceName, editMessageId = null) {
    const todayStr = new Date().toISOString().split("T")[0];
    const allQueue = this.db.getQueue(todayStr);
    const devQueue = allQueue.filter(p => p.deviceId === deviceId);

    const inProgress = devQueue.find(p => p.status === "in_progress");
    const calling = devQueue.find(p => p.status === "calling");
    const preparing = devQueue.find(p => p.status === "preparing");
    const waitingList = devQueue.filter(p => p.status === "waiting");
    const completedList = devQueue.filter(p => p.status === "completed");

    let text = `🏥 *${deviceName} BO'YICHA NAVBAT*\n📅 _Sana: ${new Date().toLocaleDateString('ru-RU')} | ${new Date().toLocaleTimeString('ru-RU')}_\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;

    // 1. Joriy tekshiruvdagi bemor
    if (inProgress) {
      text += `🟢 *XONADA (TEKSHIRILMOQDA):*\n`;
      text += `👤 *${inProgress.patientName}* (#${inProgress.ticketNumber})\n`;
      text += `📋 _${inProgress.primaryService}_\n`;
      if (inProgress.isContrast) text += `💉 *KONTRAST MODDA BILAN*\n`;
      if (inProgress.estimatedFinishTime) {
        const finishH = new Date(inProgress.estimatedFinishTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        text += `⏳ Taxminiy tugash: *${finishH}*\n`;
      }
      text += `\n`;
    } else if (calling) {
      text += `🔔 *XONAGA CHAQIRILMOQDA:*\n`;
      text += `👤 *${calling.patientName}* (#${calling.ticketNumber})\n\n`;
    } else {
      text += `🟢 *Xonada bemor yo'q (Apparat bo'sh)*\n\n`;
    }

    // 2. Tayyorlanayotgan bemor
    if (preparing) {
      text += `🟡 *TAYYORLANMOQDA (Navbatdagi):*\n`;
      text += `👤 *${preparing.patientName}* (#${preparing.ticketNumber})\n`;
      text += `📋 _${preparing.primaryService}_\n`;
      if (preparing.isContrast) text += `💉 *KONTRAST: Kateter tayyorlash!*\n`;
      text += `\n`;
    }

    // 3. Kutayotganlar ro'yxati
    text += `🔵 *KUTAYOTGAN BEMORLAR (${waitingList.length} ta):*\n`;
    if (waitingList.length === 0) {
      text += `_Kutayotgan bemorlar mavjud emas_\n`;
    } else {
      waitingList.slice(0, 10).forEach((p, idx) => {
        const contrastBadge = p.isContrast ? "💉 Kontrast" : "";
        const timeBadge = p.estimatedStartTime ? `[${new Date(p.estimatedStartTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}]` : "";
        text += `${idx + 1}. *#${p.ticketNumber}* ${p.patientName} ${timeBadge} ${contrastBadge}\n`;
      });
      if (waitingList.length > 10) {
        text += `_...va yana ${waitingList.length - 10} ta bemor_\n`;
      }
    }

    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `✅ Tugallangan: *${completedList.length} ta* | Jami: *${devQueue.length} ta*`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔄 Yangilash", callback_data: `cmd_${deviceId === 'mskt1' ? 'mskt' : deviceId}` },
          { text: "📊 Umumiy", callback_data: "cmd_stats" }
        ],
        [
          { text: "🧲 MRT 1", callback_data: "cmd_mrt1" },
          { text: "🧲 MRT 2", callback_data: "cmd_mrt2" },
          { text: "⚡ MSKT", callback_data: "cmd_mskt" }
        ]
      ]
    };

    if (editMessageId) {
      await this.editMessage(chatId, editMessageId, text, keyboard);
    } else {
      await this.sendMessage(chatId, text, keyboard);
    }
  }

  async sendGeneralStats(chatId, editMessageId = null) {
    const todayStr = new Date().toISOString().split("T")[0];
    const q = this.db.getQueue(todayStr);

    const total = q.length;
    const completed = q.filter(p => p.status === "completed").length;
    const inProgress = q.filter(p => p.status === "in_progress").length;
    const waiting = q.filter(p => p.status === "waiting" || p.status === "preparing").length;

    const mrt1Count = q.filter(p => p.deviceId === "mrt1").length;
    const mrt2Count = q.filter(p => p.deviceId === "mrt2").length;
    const msktCount = q.filter(p => p.deviceId === "mskt1").length;

    let text = `📊 *BUGUNGI UMUMIY KO'RSATKICHLAR*\n📅 _Sana: ${new Date().toLocaleDateString('ru-RU')} | ${new Date().toLocaleTimeString('ru-RU')}_\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👥 Jami bemorlar: *${total} ta*\n`;
    text += `🟢 Tekshiruvda: *${inProgress} ta*\n`;
    text += `⏳ Kutayotganlar: *${waiting} ta*\n`;
    text += `✅ Yakunlangan: *${completed} ta*\n\n`;
    text += `*Apparatlar bo'yicha taqsimot:*\n`;
    text += `▫️ *MRT 1:* ${mrt1Count} ta bemor\n`;
    text += `▫️ *MRT 2:* ${mrt2Count} ta bemor\n`;
    text += `▫️ *MSKT 1:* ${msktCount} ta bemor\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🧲 MRT 1 Navbati", callback_data: "cmd_mrt1" },
          { text: "🧲 MRT 2 Navbati", callback_data: "cmd_mrt2" }
        ],
        [
          { text: "⚡ MSKT Navbati", callback_data: "cmd_mskt" },
          { text: "🔄 Yangilash", callback_data: "cmd_stats" }
        ]
      ]
    };

    if (editMessageId) {
      await this.editMessage(chatId, editMessageId, text, keyboard);
    } else {
      await this.sendMessage(chatId, text, keyboard);
    }
  }

  async sendMessage(chatId, text, replyMarkup = null) {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: "Markdown",
      reply_markup: replyMarkup
    };
    return this.postRequest(`${TG_BASE}/sendMessage`, payload);
  }

  async editMessage(chatId, messageId, text, replyMarkup = null) {
    const payload = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: "Markdown",
      reply_markup: replyMarkup
    };
    return this.postRequest(`${TG_BASE}/editMessageText`, payload);
  }

  postRequest(url, data) {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(data);
      const u = new URL(url);
      const req = https.request({
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      }, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => resolve(body));
      });

      req.on("error", reject);
      req.write(payload);
      req.end();
    });
  }

  httpRequest(url) {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let body = "";
        res.on("data", chunk => body += chunk);
        res.on("end", () => resolve(body));
      }).on("error", reject);
    });
  }
}

module.exports = LaborantBot;
