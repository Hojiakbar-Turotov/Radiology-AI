/**
 * Tibbiyot / UTT Navbat Tizimi - Umumiy Firebase Konfiguratsiyasi
 */

const firebaseConfig = {
  apiKey: "AIzaSyD80Poi-ZuzSCdVQkUls6MvvUDgon-17Tk",
  authDomain: "xabarlashgich.firebaseapp.com",
  databaseURL: "https://xabarlashgich-default-rtdb.firebaseio.com",
  projectId: "xabarlashgich",
  storageBucket: "xabarlashgich.firebasestorage.app",
  messagingSenderId: "708734167496",
  appId: "1:708734167496:web:1bda21c79bae5bff2c38fd",
  measurementId: "G-2RW2NFS51B"
};

// Firebase SDK ni ishga tushirish (Compat v9/v10 versiya)
function initFirebase() {
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    return firebase.database();
  }
  console.error("Firebase SDK yuklanmagan!");
  return null;
}
