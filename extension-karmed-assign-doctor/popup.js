/**
 * POPUP.JS - KARMED TEZKOR VRACH
 */

const DOCTORS = [
  { key: "1", kod: "13", room: "Ultratovush-1", name: "Juravlev Igor Ivanovich" },
  { key: "2", kod: "15", room: "Ultratovush-2", name: "Kurbanova Sevinch Musayevna" },
  { key: "3", kod: "16", room: "Ultratovush-3", name: "Abidjanov Alisher Maxamataliyevich" },
  { key: "4", kod: "18", room: "Ultratovush-4", name: "Ziyayeva Zarina Abduganiyevna" },
  { key: "5", kod: "17", room: "Ultratovush-5", name: "Xoshimova Lola Kabulovna" },
  { key: "6", kod: "19", room: "Ultratovush-6", name: "Toirova Shaxlo Oybek qizi" },
  { key: "7", kod: "32", room: "Ultratovush-7", name: "Asadova Dildoraxon Asatullayevna" },
  { key: "8", kod: "14", room: "Ultratovush-8", name: "Saidbayeva Zulfiya Yergeshovna" },
  { key: "9", kod: "35", room: "Ultratovush-9", name: "Xusanova Feruza Ikromjonovna" },
  { key: "0", kod: "33", room: "Ultratovush-10", name: "Xudayberdiyeva Nigora Nizamovna" }
];

document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('docsList');
  if (listEl) {
    listEl.innerHTML = DOCTORS.map(d => `
      <div class="doc-card">
        <span class="doc-key">${d.key}</span>
        <div class="doc-info">
          <div class="doc-room">${d.room} <small style="font-size:10px;opacity:0.75;font-weight:normal;">[Kod: ${d.kod}]</small></div>
          <div class="doc-name" title="${d.name}">${d.name}</div>
        </div>
      </div>
    `).join('');
  }

  // Power Button Management
  const powerBtn = document.getElementById('popupPowerBtn');
  const powerText = document.getElementById('popupPowerText');

  function updateUI(isEnabled) {
    if (!powerBtn || !powerText) return;
    powerBtn.className = `status-power-btn ${isEnabled ? 'power-on' : 'power-off'}`;
    powerText.textContent = isEnabled ? 'Yoqilgan' : 'O\'chirilgan';
  }

  // Query active tab for power status
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_POWER_STATUS' }, (res) => {
          if (chrome.runtime.lastError) return;
          if (res && typeof res.isEnabled === 'boolean') {
            updateUI(res.isEnabled);
          }
        });
      }
    });

    if (powerBtn) {
      powerBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs && tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_POWER' }, (res) => {
              if (chrome.runtime.lastError) return;
              if (res && typeof res.isEnabled === 'boolean') {
                updateUI(res.isEnabled);
              }
            });
          }
        });
      });
    }
  }
});
