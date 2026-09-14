# KARMED RADIOLOGY NAVBAT VA MONITORING TIZIMI — VERSIYALAR TARIXI (CHANGELOG)

## [v8.0.0] - 2026-09-14 (Standalone Direct Karmed Portable TV Monitor & Native Launcher)
### Yangiliklar va Arxitekturaviy Yechimlar:
- **To'liq Mustaqil Portativ TV Monitor Paketi (`UTT_TV_MONITOR_PORTABLE.zip`)**:
  - Oraliq serverlarga yoki tarmoq sinxronlashiga bog'liqlik butunlay olib tashlandi.
  - Server o'zi bevosita shifoxonaning Karmed serveri (`192.168.150.111:2025`) bilan to'g'ridan-to'g'ri integratsiyada ishlaydi.
- **Oson O'zgartiriladigan Kirish Kaliti (`OPEN_KARMED_KEY.json`)**:
  - `username` ("R5"), `password` ("17720"), Karmed host va port ma'lumotlari alohida ochiq JSON faylida saqlanadi. Foydalanuvchi hisob ma'lumotlarini dastur kodiga kirmasdan oson o'zgartira oladi.
- **Dinamik Tarmoq IP Aniqlash (Local & Wi-Fi Broadcast)**:
  - Doimiy qat'iy IP manzil bog'liqligi olib tashlandi. Dastur qaysi kompyuterda ishga tushsa, uning mahalliy tarmoq (Wi-Fi / Ethernet) IP manzilini avtomatik aniqlaydi va bir xil Wi-Fi tarmog'idagi Smart TV yoki telefonlar uchun ulanish manzilini (`http://KOMPYUTER_IP:9877`) e'lon qiladi.
- **Native C# Dasturi (`START_TV_MONITOR.exe`)**:
  - `.bat` fayl o'rniga portativ `node.exe` va `server.js` ni ishga tushiruvchi hamda brauzerda TV ekranini avtomatik ochuvchi ixcham (18 KB) native `.exe` dasturi yaratildi.
  - Serverni to'xtatish uchun `STOP_TV_MONITOR.bat` taqdim etildi.
- **Asosiy TV Ekrani Yangilanishlari**:
  - Shifokor kartochkasida `[ko'rilgan] / [kutayotgan] / [jami]` ko'rinishidagi indikator (so'zsiz, rangli).
  - Shifokor ko'rgan bemorlarni ochuvchi ko'z znachogi (`👁️`) va modal oynasi.
  - Kecha va oldingi kunlarda yo'naltirilib, bugun qabul qilingan/o'tgan bemorlar filtrlash paneli.

---

## [v7.1.0] - 2026-09-11 (Admin Custom ID Registry & Google Sheets 21-Column Match)
### Yangiliklar va Imkoniyatlar:
- **Admin Panel Maxsus Reestr Bo'limi (`/admin.html` -> ID Bo'yicha Maxsus Hisob-Kitob)**:
  - Bemor ID kodlari (ProtokolNo va KimlikNo) nuqta-vergul (`;`), vergul yoki qatorma-qator kiritiladi.
  - Belgilangan muddat (masalan, 01.08.2026 dan 31.08.2026 gacha) bo'yicha Karmeddan to'g'ridan-to'g'ri yangi so'rov olinadi.
  - "Eskilari saqlanmasin" — har bir hisob-kitobda eski kesh ishlatilmaydi, faqat berilgan ID'larning yangi holati olinadi.
- **Google Sheets bilan 1-ga-1 Mos 21 ta Ustun**:
  - `№`, `ID`, `Ism va familiya`, `Тип`, `Xizmat Turi`, `Funktsional xizmat bolimi`, `Услуга`, `№ Карта`, `Тип Карта`, `Отделения`, `Лечащий врач`, `dr_uygulayan`, `Время_tarihi`, `Категория лыгот`, `Orderli_Ucret`, `Pulli_Ucret`, `Tolangan_ucret`, `Jami_ucret_toplam`, `Форма оплаты`, `Tolov Sana Tarihi`, `Holati`.
  - Har bir tekshirilgan organ bo'yicha alohida qator va tegishli tarif (Rezident 159,000, Sug'urta/Orderli 155,820, No-rezident 254,400).
- **Excel (CSV UTF-8 BOM) Eksport**:
  - Excelda format va o'zbek/kirill yozuvlari buzilmasligi uchun UTF-8 BOM (`\uFEFF`) va `;` separatorli fayl shakllantirish.
- **Backend API (`logger_server.js`, `lib/admin-analytics.js`)**:
  - `POST /api/admin/custom-reestr` va `POST / GET /api/admin/custom-reestr-export`.

---

## [v7.0.0] - 2026-09-11 (GitHub Dynamic Tunnel Broker & Smart TV APK Failover)
### Yangiliklar va Arxitekturaviy Yechimlar:
- **GitHub Doimiy Tunnel Brokeri (`tunnel_config.json` & `index.html`)**:
  - `https://github.com/Hojiakbar-Turotov/Radiology-AI.git` bilan avtomatlashtirilgan sinxronizatsiya.
  - Tunnel serveri ishga tushganda yangi Cloudflare URL manzillarini GitHub Pages orqali avtomatik e'lon qiladi.
- **Android TV Smart Failover & 30-minutlik Local Probe (`MainActivity.java`)**:
  - **Lokal port birinchi tekshiriladi:** `http://10.34.17.210:9877/tv` yoki `9880`.
  - **GitHub zaxira tekshiruvi:** Lokal tarmoq bo'lmasa, `tunnel_config.json` dan online tunnelni yuklaydi.
  - **30 minutlik tekshiruv:** Har 30 minutda lokal port tekshiriladi va lokal tarmoq paydo bo'lganda darhol lokalga o'tadi.
  - **Server o'chiqligida toza TV ekrani:** Server o'chiq bo'lsa xatolik dialogi o'rniga "Hozirda ushbu xonada navbatda kutayotgan bemorlar mavjud emas" yozuvi bilan xona ko'rinishi ochiladi.
- **TV da Shifokor F.I.SH va Xona Nomi (11 ta xona xaritalanishi)**:
  - Har bir xona uchun shifokor F.I.SH to'liq kiritildi (masalan: `UTT1-53 XONA` / `Ultratovush-1(Juravlev Igor Ivanovich)`).
  - Tanlangan xona `localStorage` da eslab qolinadi va offline holatda ham shifokor F.I.SH ko'rinib turadi.

---

## [v6.0.0] - 2026-09-11 (Karmed Qabul Bemorlar, TV Telemetriya & Chaqiruv Cheklovi)
### Yangiliklar va Arxitekturaviy Yechimlar:
- **Qabul Qilmoqda holati (`DosyaDurumu=4`)**: Karmedda qabul qilingan bemorlar TV ekranida "Qabul qilmoqda" holatida aks ettiriladi.
- **TV Telemetriya Monitoringi (`data/devices.json`)**: Qaysi TV qachon qaysi IP orqali ulanayotganini tahlil qilish.
- **Chaqiruv Signali Takrorlanishini Cheklash**: TV monitorda bir bemor uchun signal faqat 1 marta yangrashi ta'minlandi.
- **Shaffof Boshqaruv Tugmalari**: TV monitor tugmalari (barcha xonalar, xona tanlash, to'liq ekran) nozik shaffof holatga keltirildi.

---

## [v5.1.0] - 2026-09-10 (Executive Admin Analytics Dashboard & Financial Price Catalog)
### Yangiliklar va Arxitekturaviy Yechimlar:
- **Professional Rahbariyat Analitika Paneli (`admin.html`, `admin.js`, `admin.css`)**:
  - `http://localhost:9880` va online `https://battle-opening-telephony-miss.trycloudflare.com/admin` orqali to'liq tahlil portali.
  - **Faqat qo'lda so'rov yuborish (On-Demand Monitoring)**: Server va Karmedni ortiqcha yuklamaslik uchun avto-polling va SSE live-stream o'chirildi. Yangilanish faqat admin "Hisobotni Olish" yoki "Karmeddan Yangilash" tugmasini bosganda amalga oshiriladi.
  - **2 oylik retrospektiv tahlil (01.08.2026 — 10.09.2026)**: 6,500 nafar yo'naltirilgan bemor, 5,820 (89.5%) tekshiruvdan o'tganlar, 610 kutayotganlar va 49 qabul qilinganlar aniq hisoblandi.
- **UTT Vrachlari (Xonalar) Tahlili & "👥 Bemorlar Ro'yxati" Modali**:
  - Barcha 10 ta UTT shifokori (Ultratovush-1 dan 10 gacha) bo'yicha ko'rgan bemorlari, o'tganlari, kutayotganlari va qabul qilingan to'lov summasi.
  - Har bir vrach kartochkasida "👥 Bemorlar Ro'yxati" tugmasi orqali shu shifokor qabul qilgan barcha bemorlarning to'liq ma'lumotlari (ID, F.I.SH, sana, holat, xizmat, to'lov) modali ochiladi.
- **Davolovchi Shifokorlar Reytingi (DosyaDoktoru)**:
  - UTT bo'limiga eng ko'p bemor yo'naltirgan shifokorlar shohsupasi (#1 Dr. Inoyatov Shavkat - 431 bemor, #2 Dr. Kasimov Doniyor - 388 bemor, #3 Dr. Laboratoriya va Radyologiya - 386 bemor) va to'liq jadvali.
- **160 ta Rasmiy Tibbiy Tariflar Katalogi (Google Sheets Integratsiyasi)**:
  - Rasmiy tasdiqlangan narxlar (32 UTT, 37 Rentgen, 23 MSKT, 68 MRT) asosida jami 917,255,100 so'm tushum aniq hisoblandi.
- **Tezkor Kesh Tizimi (`data/admin_analytics_cache.json`)**:
  - 6,500 bemorlik hisobot bir marta yuklangach, keyingi barcha so'rovlar keshdan 50ms dan kam vaqtda ochiladi.
- **Excel (CSV UTF-8 BOM) Eksport**:
  - Bemorlar jurnali, vrachlar hisoboti va davolovchi shifokorlar reytingini bitta tugma bilan Excelda ochiladigan CSV formatda yuklab olish imkoniyati.

---
### Yangiliklar va Arxitekturaviy Yechimlar:
- **Karmed Direct Master Sync Engine**:
  - `logger_server.js` da har 20 soniyada Karmed serveridan (`192.168.150.111:2025`) `HastaSorgula` orqali barcha bugungi UTT bemorlarini mustaqil, xolis va uzluksiz tortib oluvchi master dvigatel ishga tushirildi.
  - Brauzer kengaytmasiga bo'lgan to'liq bog'liqlik bartaraf etildi.
  - Sessiya uzilganda avtomatik `loginToKarmedLive('R5', '17720')` orqali yangi token va cookielar olinadi.
- **Destructive Overwrite Guard (Navbatni himoyalash)**:
  - Shifokor yoki registrator o'z kompyuterida 1 nafar bemorni qidirganda kengaytma serverga 1 kishilik jadval yuborsa, ushbu chala ma'lumot rad etiladi va master 50+ kishilik navbat saqlab qolinadi.
- **10 ta UTT xonasi to'liq xaritalanishi**:
  - Barcha bemorlar o'z xonalariga (`Ultratovush-1` dan `Ultratovush-10` gacha) taqsimlanadi.
  - "Kutayotgan bemorlar yo'q" holati bartaraf etildi.
- **Android TV Avto-yangilanish va Masofaviy Ekranga chiqarish**:
  - `https://battle-opening-telephony-miss.trycloudflare.com/tv` orqali masofadan TV ekrani ishlaydi.
  - `/api/app-version` va `/download/UTT_TV_Navbat.apk` orqali TV ilovasi yangi versiyalarni aniqlaydi va o'zini yangilaydi.
- **Yangi .exe Launcher**:
  - `KARMED_SERVER_V5.exe` orqali serverni bitta tugma bilan ishga tushirish ta'minlandi.

---

## [v4.1.0] - 2026-09-09 (Modality Agents & Individual Search)
- UTT (9881), MSKT (9882) va MRT (9883) uchun 3 ta alohida mobil agent portlari ochildi.
- Individual bemor qidiruvi (`HastaSorgula` ID bo'yicha) barcha bo'limlar bo'yicha kengaytirildi.
- R5 orqali xonani o'zgartirish (`AltBolumuDegistir`) MRT, MSKT va UTT bo'limlariga moslashtirildi.

---

## [v4.0.0] - 2026-09-08 (TV Monitor & Multi-Room)
- TV Monitor ekrani (9877) to'liq ekran rejimi, 10 ta xona gridi va ovozli chaqiruv tizimi bilan chiqarildi.
- Shifokor kabinetlari (9878, U0-U9) va chaqiruv mexanizmi joriy etildi.

---

## [v3.0.0] - 2026-09-05 (Kunlik Logger va Real-time SSE)
- `Log/<DD.MM.YYYY>/logger.me` dinamik kunlik log fayli joriy etildi.
- Server-Sent Events (SSE) orqali barcha portlar soniyada sinxronlashtirildi.
