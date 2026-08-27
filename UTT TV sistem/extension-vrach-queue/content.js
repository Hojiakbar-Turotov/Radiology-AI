/**
 * 1-Kengaytma: Karmed / Kardelen Sahifasiga Chaqiruv Tugmalarini Joylash
 */

let localServerUrl = "http://localhost:3000";
let currentDoctorId = "";

// Sozlamalarni o'qish
chrome.storage.local.get(["serverUrl", "selectedDoctorId"], (res) => {
  if (res.serverUrl) localServerUrl = res.serverUrl.replace(/\/+$/, "");
  if (res.selectedDoctorId) currentDoctorId = res.selectedDoctorId;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.serverUrl) localServerUrl = changes.serverUrl.newValue.replace(/\/+$/, "");
  if (changes.selectedDoctorId) currentDoctorId = changes.selectedDoctorId.newValue;
});

// Karmed sahifasida bemor qatorlarini aniqlash va tugma qo'shish
function injectQueueButtons() {
  const rows = document.querySelectorAll("table tbody tr, .patient-row, .karmed-row, .grid-row");

  rows.forEach(row => {
    if (row.dataset.uttQueueInjected) return;
    row.dataset.uttQueueInjected = "true";

    // Bemor F.I.Sh ni topish
    const cells = Array.from(row.querySelectorAll("td, .cell"));
    if (cells.length < 2) return;

    let patientName = "";
    let patientId = "";

    // Odatda 1- yoki 2-katakda F.I.Sh bo'ladi
    for (const c of cells) {
      const txt = c.innerText.trim();
      if (!patientName && txt.length > 5 && /[a-zA-Zа-яА-ЯёЁ\s]{5,}/.test(txt) && !/sana|shifokor|tekshiruv|xulosa/i.test(txt)) {
        patientName = txt;
      }
      if (!patientId && /^\d{3,8}$/.test(txt)) {
        patientId = txt;
      }
    }

    if (!patientName) return;

    // Harakatlar ustunini topish yoki oxirgi ustunga tugma qo'shish
    const lastCell = cells[cells.length - 1];
    if (!lastCell) return;

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "utt-inline-btn-wrap";

    const callBtn = document.createElement("button");
    callBtn.className = "utt-btn-inline-call";
    callBtn.innerHTML = "📢 Chaqirish";
    callBtn.title = "Ushbu bemorni Android TV orqali ovozli chaqirish";

    callBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      e.preventDefault();

      callBtn.innerText = "⏳ Chaqirilmoqda...";
      callBtn.disabled = true;

      try {
        // 1. Avval navbatga qo'shish yoki mavjudligini tekshirish
        const addRes = await fetch(`${localServerUrl}/api/queue/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientName: patientName,
            patientId: patientId,
            doctorId: currentDoctorId
          })
        });
        const addData = await addRes.json();

        // 2. Chaqiruv signalini yuborish
        const callRes = await fetch(`${localServerUrl}/api/queue/call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: addData.patient ? addData.patient.id : patientId,
            patientName: patientName
          })
        });
        const callData = await callRes.json();

        if (callData.ok) {
          showToast(`📢 ${patientName} TV ekranida chaqirildi!`, "success");
          callBtn.innerHTML = "✅ Chaqirildi";
          setTimeout(() => {
            callBtn.innerHTML = "📢 Qayta chaqirish";
            callBtn.disabled = false;
          }, 3000);
        } else {
          showToast("Xatolik: " + (callData.error || "Chaqirib bo'lmadi"), "error");
          callBtn.innerHTML = "📢 Chaqirish";
          callBtn.disabled = false;
        }
      } catch (err) {
        showToast("Lokal serverga ulanib bo'lmadi (" + localServerUrl + ")", "error");
        callBtn.innerHTML = "📢 Chaqirish";
        callBtn.disabled = false;
      }
    });

    btnWrapper.appendChild(callBtn);
    lastCell.appendChild(btnWrapper);
  });
}

// Floating Toast Notification
function showToast(text, type = "success") {
  let t = document.getElementById("utt-toast-notice");
  if (!t) {
    t = document.createElement("div");
    t.id = "utt-toast-notice";
    document.body.appendChild(t);
  }
  t.className = `utt-toast ${type} show`;
  t.innerText = text;
  setTimeout(() => { t.classList.remove("show"); }, 3500);
}

// Dinamik yuklanuvchi jadvallar uchun kuzatuvchi
const observer = new MutationObserver(() => {
  injectQueueButtons();
});

observer.observe(document.body, { childList: true, subtree: true });
setTimeout(injectQueueButtons, 1500);
