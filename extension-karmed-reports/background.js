/**
 * Karmed Reports Extension - Background Service Worker
 * Listens for newly opened PDF/FastReport tabs and coordinates document capture & Telegram upload.
 */

const BOT_TOKEN = "8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4";
const ADMIN_USER_ID = "5314298089";
const CHANNEL_ID = "-1003962033499";
const FIREBASE_DB_URL = "https://xabarlashgich-default-rtdb.firebaseio.com";
const TG_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

chrome.runtime.onInstalled.addListener(() => {
  console.log("🚀 Karmed Xulosalar Portali kengaytmasi faollashdi.");
});

// Yangi ochilgan tablarni (PDF / FastReport Export) kuzatish
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const url = tab.url.toLowerCase();
    if (url.includes("fastreport.export") || url.includes(".pdf") || url.includes("export.axd") || url.includes("report")) {
      console.log("📄 Yangi PDF hisobot sahifasi aniqlandi:", tab.url);
      
      // Sahifaga avtomatik bildirishnoma yuborish
      chrome.tabs.sendMessage(tabId, {
        action: "PDF_TAB_READY",
        pdfUrl: tab.url
      }).catch(() => {});
    }
  }
});
