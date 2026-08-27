/**
 * 2-Kengaytma: Karmed Sahifasida Vrachni O'zgartirish Modal va Tugmalari
 */

let localServerUrl = "http://localhost:3000";
let cachedDoctors = [];

chrome.storage.local.get(["serverUrl"], (res) => {
  if (res.serverUrl) localServerUrl = res.serverUrl.replace(/\/+$/, "");
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.serverUrl) localServerUrl = changes.serverUrl.newValue.replace(/\/+$/, "");
});

// Vrachlar ro'yxatini yuklab olish
async function loadDoctors() {
  try {
    const res = await fetch(`${localServerUrl}/api/doctors`);
    cachedDoctors = await res.json();
  } catch (e) {}
}
loadDoctors();

// Bemor qatorlariga «🔄 Vrachni almashtirish» tugmasini qo'shish
function injectReassignButtons() {
  const rows = document.querySelectorAll("table tbody tr, .patient-row, .karmed-row, .grid-row");

  rows.forEach(row => {
    if (row.dataset.uttReassignInjected) return;
    row.dataset.uttReassignInjected = "true";

    const cells = Array.from(row.querySelectorAll("td, .cell"));
    if (cells.length < 2) return;

    let patientName = "";
    let patientId = "";

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

    const lastCell = cells[cells.length - 1];
    if (!lastCell) return;

    const btn = document.createElement("button");
    btn.className = "utt-btn-inline-reassign";
    btn.innerHTML = "🔄 Vrachni o'zgartirish";
    btn.title = "Ushbu bemorni boshqa vrach qabuliga yo'naltirish";

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      openReassignModal(patientName, patientId);
    });

    lastCell.appendChild(btn);
  });
}

// Modal dialog yaratish va ochish
async function openReassignModal(patientName, patientId) {
  if (cachedDoctors.length === 0) await loadDoctors();

  let modal = document.getElementById("utt-reassign-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "utt-reassign-modal";
    modal.className = "utt-modal-overlay";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="utt-modal-box">
      <div class="utt-modal-header">
        <h3>🔄 Bemor Vrachini O'zgartirish</h3>
        <button class="utt-modal-close" id="uttModalCloseBtn">✕</button>
      </div>

      <div class="utt-modal-body">
        <div class="utt-patient-info-box">
          <b>Bemor:</b> <span>${patientName}</span> ${patientId ? `(ID: <code>${patientId}</code>)` : ''}
        </div>

        <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:6px; color:#334155;">
          Qaysi Vrach / Xona qabuliga yo'naltirmoqchisiz?
        </label>
        
        <div class="utt-doctors-select-list">
          ${cachedDoctors.map(doc => `
            <div class="utt-doc-radio-item" data-doc-id="${doc.id}">
              <input type="radio" name="targetDocRadio" id="rad_${doc.id}" value="${doc.id}">
              <label for="rad_${doc.id}">
                <b>${doc.room}</b> — ${doc.name}
                <small style="display:block; color:#64748b;">${doc.specialty}</small>
              </label>
            </div>
          `).join('')}
        </div>

        <button id="uttConfirmReassignBtn" class="utt-btn-confirm-reassign">
          ✅ Yangi Vrach Navbatiga Yuborish
        </button>
      </div>
    </div>
  `;

  modal.style.display = "flex";

  // Yopish
  document.getElementById("uttModalCloseBtn").onclick = () => { modal.style.display = "none"; };
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };

  // Tanlov qilinganda item ni belgilash
  modal.querySelectorAll(".utt-doc-radio-item").forEach(item => {
    item.onclick = () => {
      const radio = item.querySelector("input");
      if (radio) radio.checked = true;
      modal.querySelectorAll(".utt-doc-radio-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
    };
  });

  // Tasdiqlash tugmasi
  document.getElementById("uttConfirmReassignBtn").onclick = async () => {
    const selectedRadio = modal.querySelector("input[name='targetDocRadio']:checked");
    if (!selectedRadio) {
      alert("Iltimos, vrachlardan birini tanlang!");
      return;
    }

    const targetDocId = selectedRadio.value;
    const targetDoc = cachedDoctors.find(d => d.id === targetDocId);

    const btn = document.getElementById("uttConfirmReassignBtn");
    btn.disabled = true;
    btn.innerText = "⏳ Yo'naltirilmoqda...";

    try {
      const res = await fetch(`${localServerUrl}/api/queue/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientName: patientName,
          patientId: patientId,
          targetDoctorId: targetDocId
        })
      });
      const data = await res.json();

      modal.style.display = "none";

      if (data.ok) {
        showToast(`✅ ${patientName} -> ${targetDoc.name} (${targetDoc.room}) navbatiga yo'naltirildi!`, "success");
      } else {
        showToast("Xatolik: " + (data.error || "Yo'naltirib bo'lmadi"), "error");
      }
    } catch (err) {
      modal.style.display = "none";
      showToast("Lokal serverga ulanib bo'lmadi (" + localServerUrl + ")", "error");
    }
  };
}

// Toast
function showToast(text, type = "success") {
  let t = document.getElementById("utt-reassign-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "utt-reassign-toast";
    document.body.appendChild(t);
  }
  t.className = `utt-toast ${type} show`;
  t.innerText = text;
  setTimeout(() => { t.classList.remove("show"); }, 3500);
}

const observer = new MutationObserver(() => {
  injectReassignButtons();
});

observer.observe(document.body, { childList: true, subtree: true });
setTimeout(injectReassignButtons, 1500);
