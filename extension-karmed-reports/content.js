/**
 * Karmed Xulosalar Portali - Injected Content Script
 * Scans Karmed hospital pages for Patient PINFL (JSHSHIR), Name, Examination, and Conclusion text.
 */

// 1. Popup-dan xabar kelganda sahifani tahlil qilish
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GRAB_KARMED_REPORT") {
    const reportData = extractKarmedPageData();
    sendResponse({ success: !!reportData, data: reportData });
    return true;
  }
});

// 2. Sahifadan ma'lumotlarni ajratib olish funksiyasi
function extractKarmedPageData() {
  let pinfl = "";
  let patientName = "";
  let serviceName = "";
  let doctorName = "";
  let conclusionText = "";
  let date = new Date().toISOString().split("T")[0];

  try {
    const pageText = document.body.innerText || "";

    // 1. PINFL (14 xonali JSHSHIR) ni topish
    // a) Maxsus inputlardan
    const inputs = document.querySelectorAll("input, span, td, div, p, strong, b");
    for (const el of inputs) {
      const txt = (el.value || el.innerText || "").trim();
      const m = txt.match(/\b([1-6]\d{13})\b/); // O'zbekiston JSHSHIR odatda 1..6 bilan boshlanadi va 14 xonali bo'ladi
      if (m) {
        pinfl = m[1];
        break;
      }
    }
    if (!pinfl) {
      const m = pageText.match(/\b(\d{14})\b/);
      if (m) pinfl = m[1];
    }

    // 2. Bemor Ismi (F.I.Sh)
    // Karmed-da odatda "F.I.SH:", "Bemor:", "Пациент:" yonida bo'ladi
    const nameRegexes = [
      /(?:Bemor|F\.I\.Sh|Пациент|Ф\.И\.О|F\.I\.O)[\s:—–]+([A-ZА-ЯЁO‘G‘ShCh][a-zа-яёo‘g‘shch\']+\s+[A-ZА-ЯЁO‘G‘ShCh][a-zа-яёo‘g‘shch\']+(?:\s+[A-ZА-ЯЁO‘G‘ShCh][a-zа-яёo‘g‘shch\']+)?)/i,
      /([A-ZА-ЯЁO‘G‘ShCh][a-zа-яёo‘g‘shch\']+\s+[A-ZА-ЯЁO‘G‘ShCh][a-zа-яёo‘g‘shch\']+\s+[A-ZА-ЯЁO‘G‘ShCh][a-zа-яёo‘g‘shch\']+\s*(?:o‘g‘li|qizi|угли|кизи)?)/
    ];
    for (const reg of nameRegexes) {
      const match = pageText.match(reg);
      if (match && match[1]) {
        patientName = match[1].trim();
        break;
      }
    }

    // 3. Tekshiruv Nomi
    if (pageText.includes("MRT") || pageText.includes("Magnit-rezonans")) {
      serviceName = "MRT Tekshiruvi";
    } else if (pageText.includes("MSKT") || pageText.includes("MSCT") || pageText.includes("Kompyuter tomografiya")) {
      serviceName = "MSKT Tekshiruvi";
    } else if (pageText.includes("Rentgen") || pageText.includes("Рентген")) {
      serviceName = "Rentgen Tekshiruvi";
    } else if (pageText.includes("UTT") || pageText.includes("UZI")) {
      serviceName = "UTT Tekshiruvi";
    }

    // 4. Shifokor F.I.Sh
    const docMatch = pageText.match(/(?:Vrach|Shifokor|Radiolog|Врач)[\s:—–]+([A-ZА-ЯЁ][a-zа-яё\']+\s+[A-ZА-ЯЁ]\.?[A-ZА-ЯЁ]?\.?)/i);
    if (docMatch && docMatch[1]) {
      doctorName = docMatch[1].trim();
    }

    // 5. Xulosa Matni (Conclusion / Findings)
    // Karmed-da textarea yoki xulosa konteynerini qidiramiz
    const textareas = document.querySelectorAll("textarea, [contenteditable='true'], .conclusion-text, .report-content, .xulosa-body");
    for (const ta of textareas) {
      const val = (ta.value || ta.innerText || "").trim();
      if (val.length > 20) {
        conclusionText = val;
        break;
      }
    }

    // Agar maxsus maydon topilmasa, "Xulosa:" yoki "Заключение:" matnidan keyingi qismini olamiz
    if (!conclusionText) {
      const concMatch = pageText.match(/(?:Xulosa|Заключение|Xulosa qismi)[\s:—–]+([\s\S]{20,1500}?)(?:\n\s*\n|Shifokor|Врач|$)/i);
      if (concMatch && concMatch[1]) {
        conclusionText = concMatch[1].trim();
      }
    }

    // 6. Sana
    const dateMatch = pageText.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (dateMatch) {
      const parts = dateMatch[1].split(".");
      if (parts.length === 3) {
        date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

  } catch (e) {
    console.warn("extractKarmedPageData error:", e);
  }

  return {
    pinfl,
    patientName,
    serviceName,
    doctorName,
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

  btn.addEventListener("click", () => {
    // Kengaytma popup oynasini eslatuvchi bildirishnoma yoki avtomatik saqlash
    const data = extractKarmedPageData();
    if (!data.pinfl) {
      alert("⚠️ Diqqat: Sahifada 14 xonali PINFL (JSHSHIR) topilmadi. Iltimos, kengaytma belgisini bosib, PINFL ni qo'lda kiriting.");
    } else {
      alert(`✅ Bemor topildi:\nPINFL: ${data.pinfl}\nF.I.Sh: ${data.patientName || "Noma'lum"}\n\nKengaytma belgisini ochib, «Xulosani Saqlash» tugmasini bosing!`);
    }
  });

  document.body.appendChild(btn);
}

// Sahifa yuklanganda ishga tushirish
setTimeout(injectFloatingKarmedButton, 1500);
