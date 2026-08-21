/**
 * Vrach Kengaytmasi - Background Service Worker
 */

// Extension ikonkasini bosganda yon panelni (Side Panel) ochish
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  console.log("UTT Vrach Kengaytmasi o'rnatildi");
});
