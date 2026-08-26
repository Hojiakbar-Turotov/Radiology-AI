/**
 * Karmed Xulosalar Portali - Injected Content Script
 * Scans Karmed hospital pages (List, Editor, FastReport Viewer, Export)
 * and directly captures & saves patient medical reports into Firebase and Telegram.
 */

const BOT_TOKEN = "8836735566:AAEHBNHpIUINi_SsDxlCAkW6BQRRhpo61NQ";
const ADMIN_USER_ID = "5314298089";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 1. Popup-dan xabar kelganda sahifani tahlil qilish
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GRAB_KARMED_REPORT") {
    const reportData = extractKarmedPageData();
    sendResponse({ success: !!reportData, data: reportData });
    return true;
  }
});

// 2. Sahifadan ma'lumotlarni har 4 ta oynadan aniq ajratib olish
function extractKarmedPageData() {
  let pinfl = "";
  let patientName = "";
  let serviceName = "";
  let doctorName = "";
  let conclusionText = "";
  let date = new Date().toISOString().split("T")[0];

  try {
    const pageText = document.body.innerText || "";

    // ─────────────────────────────────────────────────────────────
    // A) FastReport Export / Print sahifasi (4-bosqich skrinshoti)
    // ─────────────────────────────────────────────────────────────
    const pinflMatch = pageText.match(/PINFL\s*[:：]\s*(\d{14})/i);
    if (pinflMatch) {
      pinfl = pinflMatch[1];
    }

    const nameMatch = pageText.match(/Name\s*[:：]\s*([^\n\r\t]+)/i);
    const lastNameMatch = pageText.match(/Last\s*name\s*[:：]\s*([^\n\r\t]+)/i);
    if (nameMatch) {
      const fName = nameMatch[1].trim();
      const lName = lastNameMatch ? lastNameMatch[1].trim() : "";
      patientName = `${fName} ${lName}`.trim();
    }

    const repDocMatch = pageText.match(/Reporting\s*Doctor\s*[:：]\s*([^\n\r\t]+)/i);
    if (repDocMatch) {
      doctorName = repDocMatch[1].trim();
    }

    const repDateMatch = pageText.match(/Reporting\s*date\s*[:：]\s*(\d{2})\.(\d{2})\.(\d{4})/i);
    if (repDateMatch) {
      date = `${repDateMatch[3]}-${repDateMatch[2]}-${repDateMatch[1]}`;
    }

    // ─────────────────────────────────────────────────────────────
    // B) "Radiologiya Hisobot:" Sarlavhasi (2-bosqich skrinshoti)
    // Masalan: Radiologiya Hisobot: [MELIBAY YULDASHEV / E / 74 Yil... / Plevra bo'shliqlari... ]
    // ─────────────────────────────────────────────────────────────
    const winTitleMatch = pageText.match(/Radiologiya\s*Hisobot\s*:\s*\[([^\]]+)\]/i);
    if (winTitleMatch) {
      const parts = winTitleMatch[1].split("/").map(s => s.trim());
      if (!patientName && parts[0]) patientName = parts[0];
      if (!serviceName && parts[3]) serviceName = parts[3];
    }

    // ─────────────────────────────────────────────────────────────
    // C) Karmed Jadvalidan tanlangan qator (1-bosqich skrinshoti)
    // ─────────────────────────────────────────────────────────────
    if (!pinfl) {
      // Jadval katakchalaridan 14 xonali PINFL ni qidiramiz
      const allTds = document.querySelectorAll("td, div, span");
      for (const td of allTds) {
        const txt = td.innerText.trim();
        if (/^[1-6]\d{13}$/.test(txt)) {
          pinfl = txt;
          // Yonidagi qatordan ismni olishga harakat qilamiz
          const row = td.closest("tr");
          if (row) {
            const rowTds = Array.from(row.querySelectorAll("td")).map(c => c.innerText.trim());
            // Familiya, Ismi, Ota ismi
            const possibleNames = rowTds.filter(t => t.length > 2 && /^[A-ZА-ЯЁ\s]+$/.test(t) && !t.includes("MRT") && !t.includes("MSKT") && !t.includes("REZIDENT"));
            if (possibleNames.length >= 2 && !patientName) {
              patientName = possibleNames.slice(0, 3).join(" ");
            }
          }
          break;
        }
      }
    }

    // ─────────────────────────────────────────────────────────────
    // D) Tekshiruv Nomi
    // ─────────────────────────────────────────────────────────────
    if (!serviceName) {
      if (pageText.includes("Qo'l-Kaft") || pageText.includes("Bo'g'imi")) {
        serviceName = "Qo'l-Kaft Bo'g'imi MRT";
      } else if (pageText.includes("Plevra") || pageText.includes("o'pka")) {
        serviceName = "Plevra bo'shliqlari va O'pka Radiologiyasi";
      } else if (pageText.includes("Bosh Miya") || pageText.includes("Bosh miya")) {
        serviceName = "Bosh Miya MRT Tekshiruvi";
      } else if (pageText.includes("MRT") || pageText.includes("MR1") || pageText.includes("MR2")) {
        serviceName = "MRT Tekshiruvi";
      } else if (pageText.includes("MSKT") || pageText.includes("MSCT")) {
        serviceName = "MSKT Tekshiruvi";
      } else if (pageText.includes("Rentgen") || pageText.includes("Рентген")) {
        serviceName = "Rentgen Tekshiruvi";
      } else if (pageText.includes("UZI") || pageText.includes("UTT")) {
        serviceName = "UTT / UZI Tekshiruvi";
      }
    }

    // ─────────────────────────────────────────────────────────────
    // E) Shifokor F.I.Sh
    // ─────────────────────────────────────────────────────────────
    if (!doctorName) {
      const docMatch = pageText.match(/(?:Врач|Shifokor|Radiolog|Muallif)[\s:—–]+([A-ZА-ЯЁ][a-zа-яё\.\s]+)/i);
      if (docMatch && docMatch[1]) {
        doctorName = docMatch[1].trim();
      }
    }

    // ─────────────────────────────────────────────────────────────
    // F) To'liq Xulosa Matni (Editor / Document body)
    // ─────────────────────────────────────────────────────────────
    // 1. Textarea yoki contenteditable editor
    const textareas = document.querySelectorAll("textarea, [contenteditable='true'], .xulosa-text, .report-content, .conclusion");
    for (const ta of textareas) {
      const val = (ta.value || ta.innerText || "").trim();
      if (val.length > 25) {
        conclusionText = val;
        break;
      }
    }

    // 2. Sahifa matnidan "РЕСПУБЛИКАНСКИЙ..." yoki "Заключение:" yoki "Xulosa:"
    if (!conclusionText) {
      const onkoHeaderMatch = pageText.match(/(РЕСПУБЛИКАНСКИЙ[\s\S]{50,3000}?)(?:Врач|Шифокор|$)/i);
      if (onkoHeaderMatch) {
        conclusionText = onkoHeaderMatch[1].trim();
      }
    }

    if (!conclusionText) {
      const zklMatch = pageText.match(/(?:Закл|Заключение|Xulosa)[\s:—–]+([\s\S]{20,2000}?)(?:Врач|Шифокор|$)/i);
      if (zklMatch) {
        conclusionText = zklMatch[1].trim();
      }
    }

    // Agar hech narsa topilmasa, sahifaning asosiy matni
    if (!conclusionText && pageText.length > 30) {
      conclusionText = pageText.substring(0, 1500).trim();
    }

  } catch (e) {
    console.warn("extractKarmedPageData error:", e);
  }

  return {
    pinfl,
    patientName,
    serviceName: serviceName || "Radiologik Tekshiruv",
    doctorName: doctorName || "Shifokor-Radiolog",
    conclusionText,
    date
  };
}

// 3. Sahifada qulay suzuvchi tugma joylashtirish
function injectFloatingKarmedButton() {
  if (document.getElementById("karmedReportsFloatingBtn")) return;

  const btn = document.createElement("button");
  btn.id = "karmedReportsFloatingBtn";
  btn.className = "karmed-floating-btn";
  btn.innerHTML = `<i class="fa-solid fa-file-medical"></i> <span>Xulosani Saqlash</span>`;
  btn.title = "Karmed-dagi ushbu xulosani Telegram bot bazasiga saqlash";

  btn.addEventListener("click", handleDirectSaveClick);

  document.body.appendChild(btn);
}

// 4. To'g'ridan-to'g'ri saqlash modalini ko'rsatish
async function handleDirectSaveClick() {
  const data = extractKarmedPageData();

  // Modal oynani yaratish
  let oldModal = document.getElementById("karmedDirectSaveModal");
  if (oldModal) oldModal.remove();

  const modal = document.createElement("div");
  modal.id = "karmedDirectSaveModal";
  modal.className = "karmed-modal-overlay";

  modal.innerHTML = `
    <div class="karmed-modal-box">
      <div class="karmed-modal-header">
        <h3><i class="fa-solid fa-file-circle-check"></i> Xulosani Telegram Bazasiga Saqlash</h3>
        <button type="button" class="karmed-modal-close" id="btnKarmedModalClose">&times;</button>
      </div>

      <div class="karmed-modal-body">
        <div class="karmed-form-group">
          <label><b>JSHSHIR (PINFL - 14 xonali):</b></label>
          <input type="text" id="kModalPinfl" maxlength="14" value="${escapeHtml(data.pinfl || '')}" placeholder="14 ta raqam">
        </div>

        <div class="karmed-form-group">
          <label><b>Bemor F.I.Sh:</b></label>
          <input type="text" id="kModalName" value="${escapeHtml(data.patientName || '')}" placeholder="Bemor F.I.Sh">
        </div>

        <div class="karmed-form-row">
          <div class="karmed-form-group flex-1">
            <label><b>Tekshiruv Nomi:</b></label>
            <input type="text" id="kModalService" value="${escapeHtml(data.serviceName || '')}">
          </div>
          <div class="karmed-form-group flex-1">
            <label><b>Shifokor:</b></label>
            <input type="text" id="kModalDoctor" value="${escapeHtml(data.doctorName || '')}">
          </div>
        </div>

        <div class="karmed-form-group">
          <label><b>Tibbiy Xulosa Matni:</b></label>
          <textarea id="kModalText" rows="5" placeholder="Xulosa matni...">${escapeHtml(data.conclusionText || '')}</textarea>
        </div>

        <div class="karmed-modal-actions">
          <button type="button" class="karmed-btn karmed-btn-cancel" id="btnKarmedModalCancel">Bekor qilish</button>
          <button type="button" class="karmed-btn karmed-btn-save" id="btnKarmedModalSave">
            <i class="fa-solid fa-paper-plane"></i> Saqlash & Telegramga Jo'natish
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Yopish tugmalari
  document.getElementById("btnKarmedModalClose").onclick = () => modal.remove();
  document.getElementById("btnKarmedModalCancel").onclick = () => modal.remove();

  // Saqlash tugmasi
  document.getElementById("btnKarmedModalSave").onclick = async () => {
    const pinfl = document.getElementById("kModalPinfl").value.replace(/\D/g, "");
    const patientName = document.getElementById("kModalName").value.trim();
    const serviceName = document.getElementById("kModalService").value.trim();
    const doctorName = document.getElementById("kModalDoctor").value.trim();
    const conclusionText = document.getElementById("kModalText").value.trim();

    if (!pinfl || pinfl.length !== 14) {
      alert("Iltimos, 14 xonali JSHSHIR (PINFL) raqamini to'liq kiriting!");
      return;
    }

    if (!patientName || !conclusionText) {
      alert("Bemor ismi va xulosa matnini to'ldiring!");
      return;
    }

    const saveBtn = document.getElementById("btnKarmedModalSave");
    saveBtn.disabled = true;
    saveBtn.innerHTML = "⏳ Saqlanmoqda...";

    const reportId = "rep_" + Date.now();
    const dateStr = new Date().toISOString().split("T")[0];

    const reportData = {
      id: reportId,
      pinfl,
      patientName,
      serviceName,
      doctorName: doctorName || "Shifokor-Radiolog",
      reportDate: dateStr,
      conclusionText,
      createdAt: Date.now(),
      source: "Karmed Screen Capture"
    };

    try {
      // 1. Firebase-ga saqlash
      await fetch(`${FIREBASE_DB_URL}/karmed_reports/${pinfl}/${reportId}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportData)
      });

      // 2. Admin userga (5314298089) va sozlangan kanalga xabar berish
      const tgMsg = 
        `📄 <b>YANGI TIBBIY XULOSA BAZAGA SAQLANDI</b>\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `👤 <b>Bemor:</b> ${escapeHtml(patientName)}\n` +
        `🔢 <b>JSHSHIR:</b> <code>${pinfl}</code>\n` +
        `🔬 <b>Tekshiruv:</b> ${escapeHtml(serviceName)}\n` +
        `👨‍⚕️ <b>Shifokor:</b> ${escapeHtml(doctorName)}\n` +
        `📅 <b>Sana:</b> ${dateStr}\n` +
        `━━━━━━━━━━━━━━━━━━\n\n` +
        `📝 <b>Xulosa:</b>\n${escapeHtml(conclusionText)}`;

      // Adminga jo'natish
      fetch(`${TG_API_BASE}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_USER_ID, text: tgMsg, parse_mode: "HTML" })
      }).catch(() => {});

      // Sozlangan kanalga jo'natish (agar bo'lsa)
      fetch(`${FIREBASE_DB_URL}/settings/telegram_channel_id.json`)
        .then(r => r.json())
        .then(cfg => {
          if (cfg && cfg.channelId) {
            fetch(`${TG_API_BASE}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: cfg.channelId, text: tgMsg, parse_mode: "HTML" })
            }).catch(() => {});
          }
        }).catch(() => {});

      modal.remove();
      alert(`✅ Muvaffaqiyatli saqlandi!\nBemor: ${patientName}\nPINFL: ${pinfl}\n\nBemor @Radiodiagnostika_bot da ushbu PINFL ni yozishi bilan xulosani oladi!`);

    } catch (err) {
      alert("Saqlashda xatolik: " + err.message);
      saveBtn.disabled = false;
      saveBtn.innerHTML = "Saqlash & Telegramga Jo'natish";
    }
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Sahifa yuklanganda ishga tushirish
setTimeout(injectFloatingKarmedButton, 1200);
