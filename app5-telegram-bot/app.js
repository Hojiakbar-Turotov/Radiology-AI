/**
 * Radiodiagnostika Telegram Bot & Xulosalar Portali - Web Dashboard Script
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

let db = null;
let allReports = [];

document.addEventListener("DOMContentLoaded", () => {
  if (typeof firebase !== "undefined" && firebase.database) {
    db = firebase.database();
    listenToReports();
  }

  // Standart bugungi sana
  const dateInput = document.getElementById("mDate");
  if (dateInput) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }

  // Webhook inputga joriy domenni taklif qilish
  const whInput = document.getElementById("webhookUrlInput");
  if (whInput && window.location.origin && !window.location.origin.includes("file://")) {
    whInput.value = `${window.location.origin}/api/telegram`;
  }
});

// 1. Xulosalar bazasini real vaqtda tinglash
function listenToReports() {
  if (!db) return;

  db.ref("karmed_reports").on("value", (snapshot) => {
    allReports = [];
    const data = snapshot.val();
    const todayStr = new Date().toISOString().split("T")[0];
    const uniquePins = new Set();
    let todayCount = 0;

    if (data) {
      Object.keys(data).forEach((pinKey) => {
        uniquePins.add(pinKey);
        const userReports = data[pinKey];
        if (userReports && typeof userReports === "object") {
          Object.keys(userReports).forEach((rKey) => {
            const r = userReports[rKey];
            allReports.push({ ...r, id: rKey, pinflKey: pinKey });
            if (r.reportDate === todayStr) {
              todayCount++;
            }
          });
        }
      });
    }

    // Saralash: eng yangi saqlanganlar tepada
    allReports.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Statistikalar
    document.getElementById("statTotalReports").innerText = allReports.length;
    document.getElementById("statTotalPatients").innerText = uniquePins.size;
    document.getElementById("statTodayReports").innerText = todayCount;

    renderReportsTable(allReports);
  });
}

// 2. Jadvalni chizish
function renderReportsTable(list) {
  const tbody = document.getElementById("reportsTableBody");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:35px; color:#94a3b8;">Hozircha xulosalar saqlanmagan.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((r, idx) => `
    <tr>
      <td><span style="color:#94a3b8; font-size:11px;">#${idx + 1}</span></td>
      <td><strong style="color:#0284c7; font-size:13px;"><i class="fa-solid fa-id-card"></i> ${escapeHtml(r.pinfl || r.pinflKey)}</strong></td>
      <td><strong>${escapeHtml(r.patientName || 'Noma\'lum')}</strong></td>
      <td><span class="badge badge-info">${escapeHtml(r.serviceName || 'Radiologiya')}</span></td>
      <td>${escapeHtml(r.doctorName || '-')}</td>
      <td><span style="font-size:12px; color:#64748b;">${escapeHtml(r.reportDate || '-')}</span></td>
      <td style="max-width:320px;">
        <div style="font-size:11.5px; color:#334155; max-height:45px; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
          ${escapeHtml(r.conclusionText || '-')}
        </div>
      </td>
      <td style="text-align:right;">
        <button class="btn btn-outline btn-sm" onclick="viewReportDetails('${r.pinflKey}', '${r.id}')" title="Ko'rish" style="padding:4px 8px; font-size:11.5px;">
          <i class="fa-solid fa-eye"></i>
        </button>
        <button class="btn btn-outline btn-sm" onclick="deleteReport('${r.pinflKey}', '${r.id}')" title="O'chirish" style="padding:4px 8px; font-size:11.5px; color:#ef4444;">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    </tr>
  `).join("");
}

function filterReportsTable() {
  const query = (document.getElementById("searchTableInput")?.value || "").toLowerCase().trim();
  if (!query) {
    renderReportsTable(allReports);
    return;
  }

  const filtered = allReports.filter(r => 
    (r.pinfl && r.pinfl.includes(query)) ||
    (r.pinflKey && r.pinflKey.includes(query)) ||
    (r.patientName && r.patientName.toLowerCase().includes(query)) ||
    (r.serviceName && r.serviceName.toLowerCase().includes(query)) ||
    (r.doctorName && r.doctorName.toLowerCase().includes(query))
  );

  renderReportsTable(filtered);
}

// 3. Xulosani o'chirish
async function deleteReport(pinfl, reportId) {
  if (confirm(`Haqiqatan ham ushbu (${pinfl}) xulosasini bazadan o'chirmoqchimisiz?`)) {
    try {
      await db.ref(`karmed_reports/${pinfl}/${reportId}`).remove();
      alert("✅ Xulosa o'chirildi!");
    } catch (e) {
      alert("❌ O'chirishda xatolik: " + e.message);
    }
  }
}

// 4. Webhook Boshqaruvi
async function setTelegramWebhook() {
  const url = document.getElementById("webhookUrlInput")?.value.trim();
  if (!url || !url.startsWith("https://")) {
    alert("Iltimos, to'g'ri HTTPS formatidagi Webhook URL manzilini kiriting!\n(Masalan: https://radiology-ai.vercel.app/api/telegram)");
    return;
  }

  const box = document.getElementById("webhookInfoBox");
  box.style.display = "block";
  box.innerHTML = "⏳ Telegram Webhook o'rnatilmoqda...";

  try {
    const res = await fetch(`${TG_API_BASE}/setWebhook?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (data.ok) {
      box.innerHTML = `✅ <b>Webhook muvaffaqiyatli o'rnatildi!</b>\nManzil: ${url}\nTelegram Javobi: ${JSON.stringify(data, null, 2)}`;
      alert("✅ Telegram Webhook muvaffaqiyatli ishga tushirildi! Endi bot online 24/7 ishlaydi.");
    } else {
      box.innerHTML = `❌ <b>Xatolik:</b> ${data.description || "Noma'lum xatolik"}`;
    }
  } catch (err) {
    box.innerHTML = `❌ <b>Tarmoq xatoligi:</b> ${err.message}`;
  }
}

async function checkWebhookInfo() {
  const box = document.getElementById("webhookInfoBox");
  box.style.display = "block";
  box.innerHTML = "⏳ Webhook holati tekshirilmoqda...";

  try {
    const res = await fetch(`${TG_API_BASE}/getWebhookInfo`);
    const data = await res.json();

    if (data.ok) {
      const info = data.result;
      box.innerHTML = 
        `🌐 <b>Joriy Webhook Manzili:</b> ${info.url || "O'rnatilmagan (Polling rejimida)"}\n` +
        `📊 <b>Kutilayotgan so'rovlar:</b> ${info.pending_update_count}\n` +
        `⏰ <b>Oxirgi xatolik sanasi:</b> ${info.last_error_date ? new Date(info.last_error_date * 1000).toLocaleString() : "Xatolik yo'q"}\n` +
        `⚠️ <b>Oxirgi xatolik xabari:</b> ${info.last_error_message || "Yo'q"}`;
    } else {
      box.innerHTML = `❌ <b>Xatolik:</b> ${data.description}`;
    }
  } catch (err) {
    box.innerHTML = `❌ <b>Tarmoq xatoligi:</b> ${err.message}`;
  }
}

async function deleteTelegramWebhook() {
  if (!confirm("Haqiqatan ham Telegram Webhookni o'chirmoqchimisiz?")) return;

  const box = document.getElementById("webhookInfoBox");
  box.style.display = "block";
  box.innerHTML = "⏳ Webhook o'chirilmoqda...";

  try {
    const res = await fetch(`${TG_API_BASE}/deleteWebhook`);
    const data = await res.json();
    if (data.ok) {
      box.innerHTML = "✅ Webhook muvaffaqiyatli o'chirildi!";
      alert("✅ Webhook o'chirildi!");
    } else {
      box.innerHTML = `❌ ${data.description}`;
    }
  } catch (e) {
    box.innerHTML = `❌ ${e.message}`;
  }
}

// 5. Bemor so'rovini sinash (Simulyator)
async function testPinflQuery() {
  const pinInput = document.getElementById("testPinflInput");
  const pin = (pinInput?.value || "").replace(/\D/g, "");
  const resultBox = document.getElementById("testResultBox");

  if (!pin || pin.length !== 14) {
    alert("Iltimos, 14 xonali JSHSHIR (PINFL) kiriting!");
    return;
  }

  resultBox.innerHTML = `<div style="text-align:center; color:#0284c7; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Xulosa qidirilmoqda...</div>`;

  try {
    const snapshot = await db.ref(`karmed_reports/${pin}`).once("value");
    const reportsData = snapshot.val();

    if (!reportsData) {
      resultBox.innerHTML = `
        <div class="chat-bubble" style="border-left:4px solid #ef4444;">
          <strong>@Radiodiagnostika_bot javobi:</strong><br><br>
          🔍 <b>JSHSHIR:</b> <code>${pin}</code><br><br>
          ❌ Ushbu JSHSHIR bo'yicha bazada tayyor tibbiy xulosa topilmadi.<br><br>
          💡 <i>Agar tekshiruvdan yangi o'tgan bo'lsangiz, shifokor xulosasi tayyorlanayotgan bo'lishi mumkin. Iltimos, birozdan so'ng qayta tekshirib ko'ring.</i>
        </div>
      `;
      return;
    }

    const rKeys = Object.keys(reportsData);
    let html = `<div style="font-size:11.5px; color:#166534; font-weight:700; margin-bottom:8px;">✅ ${rKeys.length} ta xulosa topildi:</div>`;

    for (const key of rKeys) {
      const rep = reportsData[key];
      html += `
        <div class="chat-bubble" style="margin-bottom:10px; border-left:4px solid #0284c7;">
          <strong>📋 TIBBIY XULOSA HISOBOTI</strong><br>
          ━━━━━━━━━━━━━━━━━━<br>
          👤 <b>Bemor:</b> ${escapeHtml(rep.patientName || 'Bemor')}<br>
          🔢 <b>JSHSHIR:</b> <code>${escapeHtml(rep.pinfl || pin)}</code><br>
          🔬 <b>Tekshiruv:</b> ${escapeHtml(rep.serviceName || 'Radiologiya')}<br>
          👨‍⚕️ <b>Shifokor:</b> ${escapeHtml(rep.doctorName || 'Shifokor')}<br>
          📅 <b>Sana:</b> ${escapeHtml(rep.reportDate || '')}<br>
          ━━━━━━━━━━━━━━━━━━<br><br>
          📝 <b>Xulosa:</b><br>
          ${escapeHtml(rep.conclusionText || '')}
        </div>
      `;
    }

    resultBox.innerHTML = html;

  } catch (err) {
    resultBox.innerHTML = `<div style="color:#ef4444;">Xatolik: ${err.message}</div>`;
  }
}

// 6. Modal Funksiyalari
function openAddReportModal() {
  document.getElementById("modalAddReport").style.display = "flex";
}

function closeAddReportModal() {
  document.getElementById("modalAddReport").style.display = "none";
}

async function handleManualReportSubmit(e) {
  e.preventDefault();
  const pinfl = document.getElementById("mPinfl").value.trim();
  const date = document.getElementById("mDate").value;
  const patientName = document.getElementById("mPatientName").value.trim();
  const serviceName = document.getElementById("mService").value.trim();
  const doctorName = document.getElementById("mDoctor").value.trim();
  const conclusionText = document.getElementById("mText").value.trim();
  const fileUrl = document.getElementById("mFileUrl").value.trim();

  if (pinfl.length !== 14) {
    alert("JSHSHIR 14 ta raqam bo'lishi shart!");
    return;
  }

  const reportId = "rep_" + Date.now();
  const reportData = {
    id: reportId,
    pinfl,
    patientName,
    serviceName,
    doctorName: doctorName || "Shifokor-Radiolog",
    reportDate: date,
    conclusionText,
    fileUrl: fileUrl || "",
    createdAt: Date.now(),
    source: "Web Dashboard"
  };

  try {
    await db.ref(`karmed_reports/${pinfl}/${reportId}`).set(reportData);
    closeAddReportModal();
    alert("✅ Xulosa bazaga muvaffaqiyatli saqlandi! Bemor botga PINFL yuborganda ushbu xulosani oladi.");
  } catch (err) {
    alert("❌ Saqlashda xatolik: " + err.message);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
