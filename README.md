# 🏥 UTT va Tibbiyot Navbat Tizimi (Real-Time Queue System)

Ushbu tizim yagona **Google Firebase Realtime Database** bulutli bazasida ishlaydigan 3 ta alohida front-end dasturlaridan iborat:

1. 💻 **1-Dastur (`app1-registratura`)**: Registratura kompyuteri uchun Windows `.exe` dasturi (Bemorlarni ro'yxatga olish, talon berish, umumiy nazorat).
2. 👨‍⚕️ **2-Dastur (`app2-vrach`)**: Vrachlar xonasi uchun Windows `.exe` dasturi (O'ziga biriktirilgan bemorlarni chaqirish, qabul qilish, yakunlash).
3. 📺 **3-Dastur (`app3-android-tv`)**: Kutish zalidagi Android TV ekrani uchun `.apk` dasturi (Katta ekranda navbatni ko'rsatish va ovozli chaqiruv).

---

## 📁 Loyiha Tuzilishi

```text
UTT/
├── shared/
│   └── firebase-config.js      <-- Yagona Firebase sozlamasi (3 ta dastur ham shundan foydalanadi)
│
├── extension-kardelen/        <-- Kardelen RIS uchun Chrome Extension (1 ta tugma bilan navbatga qo'shish)
│   ├── manifest.json           <-- Manifest V3 konfiguratsiyasi
│   ├── content.js              <-- Kardelen jadvaliga "Navbatga" tugmasini ulaydi
│   ├── content.css             <-- Modal va tugma stillari
│   ├── popup.html              <-- Tezkor yuborish paneli
│   └── popup.js
│
├── app1-registratura/          <-- 1-Dastur: Registratura (.exe)
│   ├── index.html              <-- Registratura interfeysi
│   ├── style.css               <-- Stillar va POS printer chek dizayni
│   ├── app.js                  <-- Bemor qo'shish, talon chiqarish, Excel eksport
│   ├── main.js                 <-- Electron asosiy fayli
│   └── package.json            <-- .exe yig'ish sozlamalari
│
├── app2-vrach/                 <-- 2-Dastur: Vrach Xonasi (.exe)
│   ├── index.html              <-- Vrach ish stoli interfeysi
│   ├── style.css               <-- Vrach paneli stillari
│   ├── app.js                  <-- Jonli bemor chaqirish, qabul boshlash/yakunlash
│   ├── main.js                 <-- Electron asosiy fayli
│   └── package.json            <-- .exe yig'ish sozlamalari
│
├── app3-android-tv/            <-- 3-Dastur: Android TV (.apk)
│   ├── index.html              <-- 1080p/4K TV monitor ekrani
│   ├── style.css               <-- Katta ekran stillari va animatsiyalar
│   ├── tv.js                   <-- Real-time tinglovchi va audio/ovozli chaqiruv
│   ├── capacitor.config.json   <-- Android APK konfiguratsiyasi
│   └── package.json            <-- APK yig'ish sozlamalari
│
└── README.md                   <-- Ushbu qo'llanma fayli
```

---

## 🚀 1-Qadam: Firebase Loyihasini Sozlash (100% Bepul, 2 daqiqa)

Dasturlar ishlashi uchun bitta bepul Firebase bazasi kerak bo'ladi:

1. [console.firebase.google.com](https://console.firebase.google.com/) saytiga kiring va Google hisobingiz orqali kiring.
2. **"Add project"** (Loyiha qo'shish) tugmasini bosing va nom bering (masalan: `utt-navbat`).
3. Chap menyudan **Build** $\rightarrow$ **Realtime Database** bo'limiga kiring:
   - **"Create Database"** tugmasini bosing.
   - Joylashuvni tanlang (masalan, `Belgium (europe-west1)` yoki `United States`).
   - Xavfsizlik qoidalarida **"Start in test mode"** (Test rejimi)ni tanlang va **Enable** bosing.
4. **Project Settings** (Tishli g'ildirakcha / Loyiha sozlamalari) ga kiring:
   - Pastga tushib **"Your apps"** bo'limidan Web belgisi **`</>`** ni bosing.
   - Nom yozib (masalan: `utt-web`), **Register app** bosing.
   - Ekranda chiqadigan `firebaseConfig` kodlarini nusxalab oling.
5. `UTT/shared/firebase-config.js` faylini oching va o'z ma'lumotlaringizni qo'ying:

```javascript
const firebaseConfig = {
  apiKey: "SIZNING_API_KEYINGIZ",
  authDomain: "utt-navbat.firebaseapp.com",
  databaseURL: "https://utt-navbat-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "utt-navbat",
  storageBucket: "utt-navbat.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

---

## ⚡ 2-Qadam: Dasturlarni Sinab Ko'rish (Brauzerda)

Hech narsa o'rnatmasdan ham dasturlarni darhol tekshirib ko'rishingiz mumkin:

1. `app1-registratura/index.html` faylini brauzerda oching $\rightarrow$ Bemor qo'shing.
2. `app2-vrach/index.html` faylini boshqa oynada oching $\rightarrow$ Vrach xonasini tanlang va **"Chaqirish"** tugmasini bosing.
3. `app3-android-tv/index.html` faylini 3-oynada oching $\rightarrow$ Chaqirilgan bemor ekranda miltillab chiqadi va ovoz bilan chaqiriladi!

---

## 📦 3-Qadam: Windows `.EXE` Fayllarni Yig'ish (Build)

### 1-Dastur (Registratura `.exe`):
Terminalda (PowerShell yoki CMD) quyidagi buyruqlarni bajaring:
```bash
cd "app1-registratura"
npm install
npm run build:exe
```
> Yig'ilgan `UTT Registratura.exe` fayli `app1-registratura/dist/` papkasida paydo bo'ladi.

### 2-Dastur (Vrach `.exe`):
```bash
cd "app2-vrach"
npm install
npm run build:exe
```
> Yig'ilgan `UTT Vrach.exe` fayli `app2-vrach/dist/` papkasida paydo bo'ladi.

---

## 📱 4-Qadam: Android TV `.APK` Faylini Yig'ish (Build)

Android TV uchun `.apk` yaratish:

```bash
cd "app3-android-tv"
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "UTT Monitor" "com.utt.tv" --web-dir "."
npx cap add android
npx cap open android
```
> Android Studio ochiladi $\rightarrow$ **Build** $\rightarrow$ **Build Bundle(s) / APK(s)** $\rightarrow$ **Build APK(s)** ni bosasiz va tayyor `.apk` faylni fleshkaga yozib Android TV ga o'rnatasiz.

---

## 🧩 5-Qadam: Kardelen RIS uchun Chrome Kengaytmasini O'rnatish

Kardelen `http://192.168.150.111:2025` tizimi orqali 1 ta tugma bilan bemorlarni navbatga yuborish:

1. Google Chrome brauzerida yangi tab ochib, manzil satriga: **`chrome://extensions/`** deb yozing va Enter bosing.
2. O'ng tomondagi yuqori burchakda **"Developer mode" (Dasturchi rejimi)** ni yoqing.
3. Chap tomonda chiqqan **"Load unpacked" (Paketsiz yuklash)** tugmasini bosing.
4. Ochilgan oynada loyihangizdagi **`UTT/extension-kardelen`** papkasini tanlang.
5. Tayyor! Endi Kardelen tizimi (`http://192.168.150.111:2025/Radiology/Rbys.aspx`) sahifasini yangilang (`F5`). Barcha bemorlar qatorida ko'k rangli **"🏥 Navbatga"** tugmasi paydo bo'ladi.

---

## 🌟 Asosiy Xususiyatlar

- **Kardelen Tizimi bilan 1-Klik Integratsiya**: HIS/RIS tizimidan bemor ismi va tekshiruvini avtomatik ajratib olib navbatga yuborish.
- **Real-Time Tezlik**: 0.1 soniya ichida vrach chaqiruvi barcha ekranlarda yangilanadi.
- **Ovozli Chaqiruv (TTS & Chime)**: Android TV da yangi chaqiruv bo'lganda maxsus qo'ng'iroq chimesi chalinadi va bemor ismi o'zbek tilida chaqiriladi.
- **POS Printer Qulayligi**: Registratura panelidan to'g'ridan-to'g'ri kichik chek printerlariga (58mm/80mm) navbat taloni chop etiladi (`Ctrl + P`).
- **Excel Eksport**: Kunlik bemorlar hisobotini bir tugma bilan `.csv` (Excel) formatda yuklab olish imkoniyati.
- **Vrachlar boshqaruvi**: Registratura orqali yangi vrachlar va xonalarni xohlagancha qo'shish va tahrirlash mumkin.
