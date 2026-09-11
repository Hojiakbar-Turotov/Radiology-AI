# 🏥 KARMED RADIOLOGY NAVBAT, TV MONITOR VA ANALITIKA TIZIMI (v7.1.0)
### Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Ilmiy-Amaliy Tibbiyot Markazi (RIOIATM)
> **UTT (Dopler) 11 ta xonasi, MRT & MSKT bo'limi, Karmed RBYS integratsiyasi, Android TV APK, Git Tunnel Brokeri va Boshqaruv Analitikasi**

---

## 📌 1. LOYIHA HAQIDA VA ASOSIY MAQSAD

Ushbu tizim Respublika Onkologiya Markazi Radiologiya va UTT (Ultratovush tekshiruvi / Dopler) bo'limida bemorlar qabuli, navbatni tartibga solish, koridordagi TV monitorlarda navbatni jonli namoyish etish, hamda markaz rahbariyati uchun moliyaviy va tibbiy tahlilni to'liq avtomatlashtirish maqsadida ishlab chiqilgan.

Tizim shifoxonaning ichki **Karmed RBYS (Kardelen Yazılım)** tibbiy axborot tizimi (`192.168.150.111:2025`) bilan bevosita integratsiyalashgan bo'lib, inson omilisiz ma'lumotlarni real vaqtda tortib oladi va qayta ishlaydi.

### 🎯 Asosiy Vazifalar:
1. **Jonli Navbat va Intizom:** 11 ta UTT xonasi bo'yicha bemorlarni o'z vaqtida, adolatli va tartibli qabul qilish, koridordagi tiqilinchlarni bartaraf etish.
2. **Katta TV Ekranlar va Android TV:** Kutish zalidagi televizorlarda har bir xona uchun alohida yoki umumiy ko'rinishda navbatni, shifokorning to'liq F.I.SH va xona raqamini ko'rsatish, yangi bemor chaqirilganda yoqimli ovozli bildirishnoma berish.
3. **Rahbariyat Analitika Portali:** 160 ta rasmiy tasdiqlangan tibbiy xizmatlar preyskuranti asosida har bir shifokor qabul qilgan bemorlar soni, to'lov turlari (Pulli, Sug'urta/Order, Imtiyozli) va moliyaviy tushumni soniyalar ichida aniq hisoblash.
4. **Nomuvofiqliklar (Discrepancy) Nazorati:** Bemor yo'naltirilgan xona bilan uni haqiqatda ko'rikdan o'tkazgan shifokor o'rtasidagi farqlarni avtomatik aniqlash.
5. **Maxsus ID Reestri (Google Sheets bilan 1-ga-1 mos):** Belgilangan bemor ID kodlari (ProtokolNo va KimlikNo) va sana oralig'i bo'yicha Karmeddan yangi ma'lumotlarni tortib, 21 ta ustunli rasmiy reestr shakllantirish va Excel (CSV UTF-8 BOM) formatida yuklab olish.
6. **Smart Failover va Portativlik:** Server o'chiq bo'lsa ham TV ekrani xatolik bermasligi, internet uzilganda zaxira kanallarga o'tishi va boshqa kompyuterlarda dastursiz ishlaydigan mustaqil portativ paket bo'lishi.

---

## 🏗️ 2. TIZIM ARXITEKTURASI VA MA'LUMOTLAR OQIMI

```mermaid
flowchart TD
    subgraph HospitalNetwork [Shifoxona Ichki Tarmog'i - LAN]
        KARMED["🏥 Karmed RBYS Server\n(192.168.150.111:2025)\nHastaSorgula & TaniHizmetBilgisiGetir"]
        
        UTT_SERVER["🖥️ UTT Master Server (v7.1.0)\nlogger_server.js (Port 9880 & 9877)\nlib/admin-analytics.js"]
        
        MRT_SERVER["🧲 MRT & MSKT Server\nlogger_server.js (Port 9890)"]
    end

    subgraph ClientsLocal [Mahalliy Qurilmalar]
        TV_LOCAL["📺 Smart TV Ekranlar (11 ta xona)\nhttp://10.34.17.210:9877/tv?room=1..11"]
        ADMIN_LOCAL["🛡️ Rahbariyat Admin Paneli\nhttp://10.34.17.210:9880/admin.html"]
        REG_LOCAL["👩‍💼 Registratura Porti\nhttp://10.34.17.210:9876"]
    end

    subgraph CloudAndRemote [Masofaviy Ulanish & Broker]
        TUNNEL_BROKER["🌐 Git & GitHub Pages Broker\ntunnel_config.json\n(Hojiakbar-Turotov/Radiology-AI)"]
        CLOUDFLARE["☁️ Cloudflare Doimiy Tunnel\ntrycloudflare.com"]
        APK_TV["📱 Android TV APK v7.0.0\n(Smart Failover & 30-min Probe)"]
    end

    subgraph PortablePackage [Portativ TV Serveri]
        PORTABLE_ZIP["📦 UTT_TV_Monitor_Portable.zip\n(Embedded node.exe v24.19 + Zero-Dependency)"]
    end

    KARMED <-->|HTTP JSON Sync har 20 sek| UTT_SERVER
    KARMED <-->|HTTP JSON Sync| MRT_SERVER
    
    UTT_SERVER -->|SSE / REST API| TV_LOCAL
    UTT_SERVER -->|Analitika & Reestr| ADMIN_LOCAL
    UTT_SERVER -->|Live Stream| REG_LOCAL

    UTT_SERVER <-->|Tunnel yangilash| CLOUDFLARE
    CLOUDFLARE -->|URL e'lon qilish| TUNNEL_BROKER
    APK_TV -->|1. Lokal Port| UTT_SERVER
    APK_TV -.->|2. Agar lokal yo'q bo'lsa (Failover)| TUNNEL_BROKER
```

---

## 📅 3. AMALGA OSHIRILGAN ISHLAR TARIXI (v1.0.0 DAN v7.1.0 GACHA)

### 🚀 [v7.1.0] — 11.09.2026 (Joriy Faol Versiya)
* **ID Bo'yicha Maxsus Hisob-Kitob Reestri (`/admin.html`):**
  * Foydalanuvchi bir nechta bemor ID kodlarini nuqta-vergul (`;`), vergul yoki qatorma-qator kiritishi va sana oralig'ini tanlashi mumkin (masalan: `01.08.2026` — `31.08.2026`).
  * **"Eskilari saqlanmasin" talabi:** So'rov yuborilganda eski kesh ishlatilmaydi (`forceFresh: true`), Karmed tizimidan (`HastaSorgula` va `TaniHizmetBilgisiGetir`) to'g'ridan-to'g'ri faqat berilgan ID'larning yangi holati olinadi.
* **Google Sheets bilan 1-ga-1 Mos 21 ta Ustun:**
  * Rasmiy reestr ustunlari: `№`, `ID`, `Ism va familiya`, `Тип`, `Xizmat Turi`, `Funktsional xizmat bolimi`, `Услуга`, `№ Карта`, `Тип Карта`, `Отделения`, `Лечащий врач`, `dr_uygulayan`, `Время_tarihi`, `Категория лыгот`, `Orderli_Ucret`, `Pulli_Ucret`, `Tolangan_ucret`, `Jami_ucret_toplam`, `Форма оплаты`, `Tolov Sana Tarihi`, `Holati`.
  * Ko'p a'zoli ko'riklarda har bir tekshirilgan organ alohida qatorga ajratiladi va o'z tarifida narxlanadi.
* **Excel (CSV UTF-8 BOM) Eksport:**
  * Excelda ochganda o'zbek va kirill harflari (Ў, Қ, Ғ, Ҳ) buzilmaydigan `\uFEFF` (BOM) va `;` ustun ajratuvchili eksport.
* **Serverlarni Ishga Tushiruvchi .EXE Fayllari:**
  * `START_UTT.exe`, `START_MRT_MSKT.exe`, `START_ALL_SERVERS.exe`, `START_TV_MONITOR.exe` mustaqil C# kompilyatsiya qilingan dasturlari yaratildi (Node.js o'rnatilmagan kompyuterda ham ichki runtime'dan foydalanadi).
* **Zero-Dependency Portativ TV Monitor Serveri (`UTT_TV_Monitor_Portable.zip`):**
  * Boshqa istalgan kompyuterda ochish uchun 34.8 MB lik arxiv: ichida mustaqil portable `node.exe`, `server.js`, 11 ta xona TV monitor sahifalari va yo'riqnoma mavjud.

### 🚀 [v7.0.0] — 11.09.2026
* **Git & GitHub Doimiy Tunnel Brokeri:**
  * Repozitoriy: `https://github.com/Hojiakbar-Turotov/Radiology-AI.git`.
  * `tunnel_config.json` va GitHub Pages portali (`index.html`) orqali dinamik Cloudflare tunnel manzillarini avtomatik e'lon qilish.
* **Android TV APK v7.0.0 (`UTT_TV_Navbat.apk`):**
  * **Lokal port ustuvorligi:** Birinchi navbatda `10.34.17.210:9877/tv` tekshiriladi.
  * **GitHub zaxirasi:** Lokal bo'lmasa, GitHub'dagi `tunnel_config.json` dan online havola olinadi.
  * **30 minutlik Avto-Probe:** Har 30 minutda lokal portni tekshirib, lokal tarmoq tiklanishi bilan darhol unga qaytadi.
  * **Server o'chiq bo'lganda himoyalangan ko'rinish:** Qizil xatolik oynasi o'rniga "Navbatda kutayotgan bemorlar mavjud emas" yozuvi bilan xona interfeysi saqlanadi.
* **11 ta UTT Xonasi va Shifokorlar F.I.SH To'liq Integratsiyasi:**
  * Har bir xona uchun shifokor nomi biriktirildi (masalan: `UTT1-53 XONA` / `Dr. Juravlev Igor Ivanovich`).

### ✅ [v6.0.0] — 10.09.2026 - 11.09.2026
* **Karmed Qabul Qilingan Bemorlar:** `DosyaDurumu=4` bo'lgan bemorlar TV da "Qabul qilmoqda" holatida ko'rsatildi.
* **TV Telemetriya Monitoringi:** TV qurilmalarining IP manzillari va ulanish vaqti `data/devices.json` da qayd etildi.
* **Ovozli Signal Cheklovi:** Chaqiruv signali har bir bemor uchun faqat 1 marta yangrashi ta'minlandi.
* **Shaffof Boshqaruv:** TV ekranidagi xona tanlash va sozlash tugmalari nozik shaffof (yarim ko'rinmas) holatga keltirildi.

### ✅ [v5.0.0 - v5.1.0] — 10.09.2026
* **Rahbariyat Analitika Dashborti (`/admin.html`):** 6,500 dan ortiq bemorlik katta ma'lumotlarni soniyaning ulushida tahlil qilish.
* **160 ta Rasmiy Tibbiy Tariflar:** Rezident (159 000 so'm), No-rezident (254 400 so'm), Sug'urta/Order (155 820 so'm).
* **Qabul Qiluvchi Shifokor (`KabulEden`) Hisobi:** Tushumlar ro'yxatga olgan xonaga emas, bemorni haqiqatda ko'rikdan o'tkazgan shifokor hisobiga yozilishi.
* **Nomuvofiqliklar (Discrepancy) Tahlili:** Yo'naltirilgan xona va qabul qilgan vrach farqlarini aniqlash (1,052 ta bemor, 16.0%).
* **Davolovchi Shifokorlar Reytingi:** Bo'limga eng ko'p bemor yo'naltirgan tashqi shifokorlar tahlili.

### ✅ [v4.0.0 - v4.1.0] — 09.09.2026
* **Karmed Direct Master Sync:** Server har 20 soniyada Karmed tizimidan (`HastaSorgula`) bemorlarni to'g'ridan-to'g'ri tortishga o'tkazildi (brauzer kengaytmasiga bo'lgan to'liq bog'liqlik yo'qotildi).
* **Destructive Overwrite Guard:** Shifokor kompyuterida 1 kishilik qidiruv natijasi serverdagi 50+ kishilik navbatni o'chirib yuborishining oldi olindi.

### ✅ [v1.0.0 - v3.0.0] — Dastlabki Bosqich
* Boshlang'ich navbat tizimi, registratura interfeysi, audio va xonalar prototipi.

---

## 👨‍⚕️ 4. UTT BO'LIMI XONALARI VA SHIFOKORLAR JADVALI (11 TA XONA)

TV monitorlarida va tizimda quyidagi 11 ta xona va shifokorlar to'liq xaritalangan:

| № | Xona Kodi | Xona Raqami | TV Sarlavhasi | Biriktirilgan Shifokor F.I.SH | URL Havolasi |
|---|---|---|---|---|---|
| 1 | `Ultratovush-1` | 53-xona | `UTT1-53 XONA` | Juravlev Igor Ivanovich | `/tv?room=1` |
| 2 | `Ultratovush-2` | 54-xona | `UTT2-54 XONA` | Kurbanova Sevinch Musayevna | `/tv?room=2` |
| 3 | `Ultratovush-3` | 46-xona | `UTT3-46 XONA` | Abidjanov Alisher Maxamataliyevich | `/tv?room=3` |
| 4 | `Ultratovush-4` | 47-xona | `UTT4-47 XONA` | Ziyayeva Zarina Abduganiyevna | `/tv?room=4` |
| 5 | `Ultratovush-5` | 48-xona | `UTT5-48 XONA` | Xoshimova Lola Kabulovna | `/tv?room=5` |
| 6 | `Ultratovush-6` | 52-xona | `UTT6-52 XONA` | Toirova Shaxlo Oybek qizi | `/tv?room=6` |
| 7 | `Ultratovush-7` | 45-xona | `UTT7-45 XONA` | Asadova Dildoraxon Asatullayevna | `/tv?room=7` |
| 8 | `Ultratovush-8` | 49-xona | `UTT8-49 XONA` | Saidbayeva Zulfiya Yergeshovna | `/tv?room=8` |
| 9 | `Ultratovush-9` | 50-xona | `UTT9-50 XONA` | Xusanova Feruza Ikromjonovna | `/tv?room=9` |
| 10 | `Ultratovush-10` | 51-xona | `UTT10-51 XONA` | Xudayberdiyeva Nigora Nizamovna | `/tv?room=10` |
| 11 | `Ultratovush-11` | 11-xona | `UTT11 XONA` | Yulchiyeva Nodira Siddikovna | `/tv?room=11` |

---

## 📁 5. LOYIHA STRUKTURASI VA FAYLLAR XARITASI

```text
c:\Users\Rentgen xona\Desktop\UTT/
├── logger_server.js             <-- Markaziy UTT Serveri (Port 9880, 9877, 9876, Karmed Sync)
├── cloudflared.exe              <-- Cloudflare Tunnel mijozi (Tashqi internetga xavfsiz chiqish)
├── tunnel_config.json           <-- Doimiy tunnel konfiguratsiyasi (Git broker uchun)
├── index.html                   <-- GitHub Pages portali (Online havolalar redirectori)
├── latest_queue.json            <-- Jonli navbat ma'lumotlari kesh-fayli (11 ta xona)
├── UTT_TV_Navbat.apk            <-- Android TV uchun tayyor ilova (v7.0.0, Smart Failover)
├── START_UTT.exe                <-- UTT serverini ishga tushiruvchi mustaqil dastur (.exe)
├── START_UTT.bat                <-- UTT serverini ishga tushiruvchi batch skript
├── VERSIONS.md                  <-- Barcha versiyalar jurnali
├── CHANGELOG.md                 <-- O'zgarishlar tarixi
│
├── lib/                         <-- Serverning biznes mantig'i modullari
│   ├── admin-analytics.js       <-- 160 tarifli Analitika dvigateli & Maxsus 21-ustunli ID Reestri
│   ├── karmed-direct.js         <-- Karmed RBYS bilan to'g'ridan-to'g'ri HTTP sessiya va so'rovlar
│   ├── sound-generator.js      <-- Audio chaqiruv signallari generatori
│   └── tv-telemetry.js          <-- TV telemetriya monitoringi
│
├── public/                      <-- Veb-mijozlar va interfeyslar
│   ├── tv.html                  <-- Asosiy TV Jonli Monitori (11 ta xona, audio chaqiruv)
│   ├── tv-dev.html              <-- Rivojlantirish va sinov uchun TV monitor
│   ├── admin.html               <-- Rahbariyat Analitika Dashborti va Maxsus ID Reestri (v7.1.0)
│   ├── admin.js                 <-- Analitika paneli, reestr qidiruvi va Excel yuklash mantig'i
│   ├── admin.css                <-- Admin paneli va reestr jadvalining stillari
│   ├── app.js                   <-- TV monitorining real-time mijoz skripti (SSE + Polling)
│   ├── chime_engine.js          <-- Ko'p ovozli bildirishnoma audio dvigateli
│   ├── styles.css               <-- TV monitorining umumiy dizayn va responsive stillari
│   └── icons/                   <-- SSV va Onkologiya markazi logotiplari, piktogrammalar
│
├── data/                        <-- Ma'lumotlar ombori (JSON bazalar)
│   ├── admin_analytics_cache.json <-- Analitika uchun tezkor kesh
│   ├── devices.json             <-- Ulangan Smart TV va mijozlar telemetriyasi
│   ├── karmed_profiles.json     <-- Shifokorlar profillari va xonalar konfiguratsiyasi
│   └── users.json               <-- Foydalanuvchilar va rollar
│
├── android_tv_app/              <-- Android TV APK loyihasi manba kodlari
│   ├── src/uz/onco/utttv/MainActivity.java <-- Smart Failover va 30-min Local Probe mantig'i
│   └── build_apk.ps1            <-- APK ni avtomatik kompilyatsiya qilish skripti
│
├── build-installer/             <-- O'rnatuvchi va portativ muhit
│   ├── runtime/node.exe         <-- Mustaqil Node.js dvigateli (v24.19.0, zero-dependency)
│   └── app.ico                  <-- Dastur rasmiy belgisi (Icon)
│
└── versions/                    <-- Barcha o'tgan barqaror versiyalar zaxirasi
    ├── v5.0.0/                  <-- v5.0.0 to'liq arxiv
    └── v6.0.0/                  <-- v6.0.0 to'liq arxiv (server, APK, kodlar)
```

---

## 🌐 6. PORTLAR, TARMOQ VA ASOSIY MANZILLAR

| Xizmat | Port | Lokal Manzil (Wi-Fi / LAN) | Vazifasi |
|---|---|---|---|
| 📺 **TV Jonli Monitor** | `9877` | `http://10.34.17.210:9877/tv` | Koridordagi televizorlar uchun jonli navbat |
| 🛡️ **Admin & Reestr** | `9880` | `http://10.34.17.210:9880/admin.html` | Rahbariyat analitikasi va ID bo'yicha maxsus reestr |
| 👩‍💼 **Registratura** | `9876` | `http://10.34.17.210:9876` | Ro'yxatga olish oynasi |
| 🧲 **MRT & MSKT Server** | `9890` | `http://10.34.17.210:9890/admin.html` | MRT va MSKT bo'limi serveri |
| 🏥 **Karmed RBYS** | `2025` | `http://192.168.150.111:2025` | Shifoxonaning asosiy Karmed tizimi |

### Masofaviy va Internet Manzillari:
* **GitHub Repozitoriy:** `https://github.com/Hojiakbar-Turotov/Radiology-AI`
* **GitHub Pages Portal:** `https://hojiakbar-turotov.github.io/Radiology-AI/`
* **Doimiy Tunnel Config:** `https://raw.githubusercontent.com/Hojiakbar-Turotov/Radiology-AI/main/tunnel_config.json`
* **Android TV APK Yuklab olish:** `http://10.34.17.210:9880/download/UTT_TV_Navbat.apk`

---

## 🚀 7. ISHGA TUSHIRISH YO'RIQNOMASI (QUICKSTART GUIDE)

### Variant A: Ish Stolidagi `.EXE` Orqali (Eng Oson)
1. **UTT & TV Serverini yoqish:** Ish stolidagi `START_UTT.exe` faylini 2 marta bosing. Server 9880 va 9877 portlarida avtomatik yoqiladi va brauzerda ochiladi.
2. **Faqat TV Monitorni yoqish:** Ish stolidagi `START_TV_MONITOR.exe` faylini bosing.
3. **MRT/MSKT Serverini yoqish:** Ish stolidagi `START_MRT_MSKT.exe` faylini bosing.
4. **Barcha Serverlarni yoqish:** Ish stolidagi `START_ALL_SERVERS.exe` faylini bosing.

### Variant B: Terminal / Antigravity Orqali (Dasturchilar Uchun)
```powershell
# UTT papkasiga o'tish
cd "c:\Users\Rentgen xona\Desktop\UTT"

# Serverni to'g'ridan-to'g'ri ishga tushirish:
node logger_server.js

# Server holatini tekshirish:
curl http://localhost:9880/status
curl http://localhost:9877/tv
```

### Variant C: Boshqa Kompyuterda Ochish (Portativ Paket)
1. Ish stolidagi `c:\Users\Rentgen xona\Desktop\UTT_TV_Monitor_Portable.zip` faylini istalgan kompyuterga ko'chiring va arxivdan chiqaring.
2. Papka ichidagi `START_TV_MONITOR.exe` dasturini bosing.
3. Dastur o'rnatilgan portable Node.js orqali ishga tushadi va darhol TV ekranini ochadi.

---

## 🗺️ 8. REJALASHTIRILGAN VA KELGUSI ISHLAR (ROADMAP)

Kelgusi bosqichlar uchun belgilangan reja:

- [ ] **1. MRT va MSKT Bo'limi Uchun Maxsus ID Reestri:**
  - Hozirgi UTT uchun yaratilgan 21 ustunli Karmed Google Sheets reestrini `MRT_MSKT` (Port 9890) bo'limi uchun ham moslashtirish va alohida hisob-kitob oynasini joriy etish.
- [ ] **2. Bemorlarni SMS / Telegram Orqali Avtomatik Xabardor Qilish:**
  - Bemor navbati kelishiga 2-3 kishi qolganda uning telefon raqamiga Telegram bot yoki SMS shlyuz orqali: *"Hurmatli bemor, sizning UTT ko'rigingizga navbatingiz yaqinlashmoqda. 48-xonaga yaqinlashishingizni so'raymiz"* xabarini yuborish.
- [ ] **3. Registratura POS Chek Printeri Integratsiyasi:**
  - Bemor ro'yxatga olinganda avtomatik ravishda termal chek printeridan (ESC/POS) navbat raqami, xona raqami va shifokor F.I.SH yozilgan talon chiqarish.
- [ ] **4. Shifokor Xonasi Uchun Mobil/Planshet Interfeysi (`/doctor`):**
  - Shifokor yoki uning hamshirasi o'z telefoni/planshetidan turib "Keyingi bemorni chaqirish", "Qabul qilindi", "Yakunlandi" tugmalarini bitta teginishda boshqarishi.
- [ ] **5. Karmed Sessiyasi Uzilmasligi Uchun Ko'p Kanalli Master Token Rotatsiyasi:**
  - Shifoxonadagi bir nechta foydalanuvchi akkauntlari (R5, R6, R7) orqali Karmed so'rovlarini parallel taqsimlash va tezlikni 3 barobarga oshirish.
- [ ] **6. Doimiy Bulutli Sinxronizatsiya va Zaxira Klasteri:**
  - Lokal server o'chirilgan taqdirda ham masofaviy shifokorlar va bemorlar navbatni internet orqali uzluksiz kuzatib turishi uchun avtomatik Cloudflare Workers / Firebase live-sync ko'prigi.

---

## 🔒 9. XAVFSIZLIK VA MA'LUMOTLAR BUTUNLIGI

1. **Destructive Overwrite Guard:** Shifokor yoki registrator qidiruv panelida tasodifan 1 nafar bemorni qidirganda, tizim butun UTT bo'limining 50+ bemorlik navbatini o'chirib yuborishiga yo'l qo'ymaydi.
2. **No-Cache Force-Fresh:** ID bo'yicha maxsus hisob-kitobda har doim xolis va haqiqiy karmed natijalari olinadi, eski kesh natijalarni chalkashtirmaydi.
3. **Git Clean Commit:** Maxfiy sessiya fayllari, 100 MB dan katta bo'lgan loglar va arxivlar `.gitignore` orqali GitHub-ga chiqib ketishidan himoyalangan.

---

**Muallif & Tizim Boshqaruvi:** Respublika Ixtisoslashtirilgan Onkologiya va Radiologiya Markazi • UTT Bo'limi Muhandisligi  
**Loyiha Holati:** Faol Ishlab Turibdi (`v7.1.0`)  
**Oxirgi Yangilanish:** 11-Sentyabr, 2026-yil
