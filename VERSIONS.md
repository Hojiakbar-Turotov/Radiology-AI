# KARMED UTT NAVBAT VA MONITOR TIZIMI — VERSIYALAR JURNALI

Ushbu hujjatda loyihaning barcha versiyalari, kiritilgan yangiliklar va ularning zaxira arxivlari ro'yxati yuritiladi.

---

### 🚀 [v7.0.0] — 11.09.2026 (Joriy Faol Versiya)
- **Tavsif:** Git va GitHub doimiy tunnel brokeri, Android TV Smart Failover & 30 minutlik lokal port monitoringi, Shifokor F.I.SH va xona nomi integratsiyasi, Server o'chiq holatda toza TV ekrani.
- **Kiritilgan Yangiliklar va Imkoniyatlar:**
  1. **Git & GitHub Doimiy Tunnel Brokeri:**
     - `https://github.com/Hojiakbar-Turotov/Radiology-AI.git` repozitoriysi bilan integratsiya.
     - `tunnel_config.json` va GitHub Pages portali (`index.html`) orqali dinamik Cloudflare tunnel manzillarini avtomatik e'lon qilish.
     - `start_online_tunnels.js` skripti tunnel ko'tarilganda Git-ga avtomatik commit va push qiladi.
  2. **Android TV APK v7.0.0 (`UTT_TV_Navbat.apk`):**
     - **Lokal port ustuvorligi:** Dastlab lokal tarmoq porti (`10.34.17.210:9877` yoki `9880`) tekshiriladi.
     - **GitHub Tunnel zaxirasi:** Agar lokal port javob bermasa, GitHub-dagi `tunnel_config.json` orqali online tunnelga ulanadi.
     - **30 minutlik Avto-Probe:** TV ilovasi har 30 minutda lokal portni tekshiradi va lokal tarmoq tiklanishi bilan zudlik bilan lokal portga o'tib oladi.
     - **Server o'chiq holatida himoyalangan ko'rinish:** Server ishlamayotgan paytda ham qizil xatolik oynasi chiqmaydi; tanlangan xona va shifokor nomi bilan toza "Navbatda kutayotgan bemorlar mavjud emas" ko'rinishi namoyish etiladi.
  3. **Shifokor F.I.SH va Xona Nomi Ko'rinishi (11 ta UTT Xonasi):**
     - Har bir xona uchun shifokor F.I.SH to'liq kiritildi (masalan: `UTT1-53 XONA` — `Ultratovush-1(Juravlev Igor Ivanovich)`).
     - Tanlangan xona `localStorage` va URL parametrida saqlanadi (`?room=1..11`).
     - Server offline bo'lsa ham shifokor va xona sarlavhasi o'chib ketmaydi.
- **Tegishli Fayllar:**
  - APK: `UTT_TV_Navbat.apk` (v7.0.0, versionCode 700)
  - Server: `logger_server.js` (v7.0.0)
  - GitHub Broker: `tunnel_config.json`, `index.html`

---

### ✅ [v6.0.0] — 10.09.2026 - 11.09.2026 (Barqaror va Arxivlangan)
- **Tavsif:** Karmed qabul qilingan bemorlar holati, TV telemetriya monitoringi, Ovozli signallarni tartibga solish, Shaffof interfeys boshqaruvi.
- **Kiritilgan Imkoniyatlar:**
  1. **Qabul qilingan bemorlar ko'rinishi:** `DosyaDurumu=4` bo'lgan bemorlar TV ekranida "Qabul qilmoqda" holatida ko'rsatilishi.
  2. **TV Telemetriya Monitoringi:** Qaysi TV qachon qaysi IP orqali ulanayotganini `data/devices.json` va loglarda qayd etish.
  3. **Chaqiruv signali cheklovi:** Ovozli signalning qayta-qayta yangrashini cheklash (1 marta yangrashi).
  4. **Bugungi kun filtrida fon yangilanishi:** 45 soniyalik fon yangilanishi faqat bugungi kun uchun cheklanishi.
  5. **Shaffof interfeys:** TV monitor boshqaruv tugmalari va xona tanlash elementlari sukut bo'yicha deyarli ko'rinmas (shaffof) bo'lib turishi.
- **Zaxira Arxivlari:**
  - Papka: `versions/v6.0.0/` (`server/`, `android_tv_app/`, `UTT_TV_Navbat.apk`)

---

### ✅ [v5.0.0] — 10.09.2026 (To'liq Yakunlangan, Barqaror va Arxivlangan)
- **Tavsif:** Karmed Rahbariyat & Admin Analitika Portali, 160 ta xizmatli rasmiy preyskurant, Ko'p organli tekshiruvlar, Karmed tashxis integratsiyasi, Qabul qiluvchi shifokor hisob-kitobi, Xona vs Qabul farqlari (Discrepancies), Vrachlararo taqsimot matritsasi, Maxfiylik va Tungi/Kunduzgi rejimlar.
- **Kiritilgan Imkoniyatlar:**
  1. **To'liq Admin Analitika Dashborti (`/admin.html`):**
     - Karmed serveridan 6,589 ta yozuvni to'g'ridan-to'g'ri tahlil qiluvchi yuqori tezlikdagi analitika dvigateli (`lib/admin-analytics.js`).
     - Jonli va keshli yuklash rejimlari (soniyaning ulushida javob).
  2. **160 ta Xizmatli Rasmiy Preyskurant va Fuqarolik Toifalari:**
     - Rezident (159 000 so'm), No-rezident (254 400 so'm), Sug'urta / Orderli (155 820 so'm).
     - Bir bemorda bir nechta tekshiruv organlari bo'lsa, har biri mustaqil narxlanadi (masalan, 5 ta organ = 779 100 so'm).
  3. **Qabul Qiluvchi Shifokor (`KabulEden`) Hisob-kitobi:**
     - Summalar va o'tgan bemorlar ro'yxatga olingan xonaga emas, bemorni haqiqatda qabul qilgan va ko'rik o'tkazgan shifokor hisobiga yoziladi.
     - 11-xona (`Ultratovush-11`, Yulchiyeva Nodira) mustaqil shifokor sifatida tizimga to'liq ulandi.
  4. **Nomuvofiqliklar (Discrepancy) Tahlili:**
     - Yo'naltirilgan xona bilan qabul qilgan vrach o'rtasidagi farqlarni avtomatik aniqlash (1,052 ta bemor, 16.0%).
     - KPI kartochkasi orqali bir marta bosishda barcha farqli bemorlarni filtrlash.
  5. **Bemor Karmed Javoblari (Tashxisi) Modali:**
     - Karmed tizimidagi asosiy va qo'shimcha tashxislar (`lblTanilar`), barcha organlar, narxlar va shifokorlar batafsil ko'rinishi.
  6. **Ikki Tomonlama Vrachlararo Taqsimot Matritsasi:**
     - UTT vrachlari bo'yicha (kimlar yuborgan) va Davolovchi shifokorlar bo'yicha (qaysi UTT ga tushgan) chuqur tahlil.
  7. **Maxfiylik va Vizual Rejimlar:**
     - ☀️ Kunduzgi va 🌙 Tungi rejim.
     - 👁️ Summalarni ko'rsatish / 🙈 Yashirish (Maxfiylik) rejimi.
  8. **TV Ekranida 7 Talik Sahifalash va Avtomatik Aylanish:**
     - Navbatdagi bemorlar 7 tadan sahifalanadi va har 8 soniyada silliq aylanib turadi.
- **Zaxira Arxivlari:**
  - Papka: `versions/v5.0.0/server/`
  - To'liq Arxiv: `versions/UTT-Full-System-v5.0.0.zip` (126 MB)

---

### ✅ [v4.1.0] — 09.09.2026 (To'liq Ishlab Chiqilgan va Zaxiralangan)
- **Tavsif:** Multi-portli arxitektura barqarorligi, Umumiy xronologik navbat, Vrachlar shaxsiy chaqiruv signallari (25 xil), Nutqsiz chaqiruv va Yangilangan Android TV ilovasi.
- **Kiritilgan Imkoniyatlar va Tuzatishlar:**
  1. **Port 9877 Barqarorligi (`tv.html`):**
     - Umumiy `app.js` skriptidagi DOM elementlari null-safety bilan himoyalandi (`selectedPillWrap` xatosi bartaraf etildi).
     - TV monitor to'xtovsiz, silliq va xatosiz ishlashi ta'minlandi.
  2. **Umumiy Xronologik Navbat Raqami (Global Queue Number):**
     - Barcha bemorlar ro'yxatga olingan vaqti (`timeMinutes` / `KayitTarihi`) bo'yicha yagona xronologik tartibda (1..N) raqamlanadi.
     - Bemor boshqa vrach yoki xonaga ko'chirilsa ham, uning navbat raqami (masalan **#24**) qat'iy o'zgarmasdan saqlanib qoladi.
  3. **Ovozli Nutq O'chirildi:**
     - TV ekranida bemor ism-familiyasini sun'iy nutq (TTS) orqali o'qish olib tashlandi, faqat xona signali va vizual chaqiruv kartochkasi qoldirildi.
  4. **25 Xil Chaqiruv Signallari (`public/chime_engine.js`):**
     - Web Audio API asosida tashqi fayllarsiz ishlaydigan 25 ta har xil ohangdagi musiqiy signallar ishlab chiqildi (Klassik, Uchlik, Shifoxona, Oltin melodiya, Aeroport, Marimba, Arfa, Vibrafon va h.k.).
     - Vrach profilida **`🔔 Chaqiruv signali`** modal oynasi qo'shildi: vrach o'z xonasi signalini tanlay oladi, **`▶ Eshitib ko'rish`** orqali oldindan tinglaydi va **`💾 Saqlash`** orqali `data/doctors_auth.json` da mustahkamlaydi.
     - Vrach bemorni chaqirganda, TV monitor aynan o'sha xonaga biriktirilgan maxsus ohangni yangratadi.
  5. **Android TV APK Qayta Yig'ildi:**
     - Yangi chime dvigateli va tuzatilgan skriptlar APK aktivlariga joylandi.
     - `UTT_TV_Navbat.apk` v4.1.0 imzolanib, server orqali to'g'ridan-to'g'ri yuklab olish imkoniyati yaratildi (`/UTT_TV_Navbat.apk`).
- **Zaxira Arxivlari:**
  - Papka: `versions/v4.1.0/`
    - `versions/v4.1.0/apk/UTT_TV_Navbat-v4.1.0.apk`
    - `versions/v4.1.0/extension/`
    - `versions/v4.1.0/server/`
  - Zip arxivlar:
    - `versions/extension-karmed-assign-doctor-v4.1.0.zip`
    - `versions/UTT-Full-System-v4.1.0.zip`

---

### ✅ [v4.0.0] — 08.09.2026 - 09.09.2026 (To'liq Arxivlangan)
- **Tavsif:** Tizimni 4 ta mustaqil tarmoq portiga ajratish, Vrach kabineti avtorizatsiyasi, Bemorlar mobil qidiruv portali.
- **Kiritilgan Imkoniyatlar:**
  1. **4 ta Mustaqil Tarmoq Portlari Arxitekturasi:**
     - `9876`: **Registrator Posti** (Asosiy boshqaruv, to'liq filtrlash, Karmed eksteshn sinxronizatsiyasi).
     - `9877`: **TV Jonli Monitor** (Smart TV, Android TV, koridor monitorlari).
     - `9878`: **Vrach Profili** (Shifokorlar kabineti, U0..U9 avtorizatsiya, xonaga izolyatsiyalangan navbat).
     - `9879`: **Bemorlar Portali** (Bemorlar mobil telefoni orqali ID yoki Familya bilan qidirish, navbat o'rni, chaqiruv bildirishnomasi).
  2. **Vrach Avtorizatsiyasi va Xona Izolyatsiyasi:**
     - Standart loginlar: `U0` dan `U9` gacha, boshlang'ich parol: `15420`.
     - Vrach parolini o'z profilida o'zgartira oladi (`data/doctors_auth.json`).
     - Har bir vrach faqat o'z xonasi bemorlarini ko'radi, boshqa xona navbatiga ta'sir qilmaydi.
  3. **Bemor Chaqiruvi va Qabulni Yakunlash:**
     - Vrach o'zi istagan bemorni "📢 Chaqirish" tugmasi orqali chaqiradi.
     - "✅ Qabulni yakunlash" bosilganda chaqiruv to'xtatiladi.
     - Shifokor harakatlari Karmed eksteshn olib berayotgan navbat listiga aslo aralashmaydi.
  4. **Bemorlar Mobil Portali (`Port 9879`):**
     - Bemor o'z telefoni orqali o'zini qidiradi, o'zidan oldin nechta bemor borligini ko'radi.
     - Shifokor chaqirganda bemor telefonida tebranish (vibratsiya) va ovozli signal beriladi.
  5. **Kunlik Dinamik Logger:**
     - `Log/<DD.MM.YYYY>/logger.me` formatida har kungi barcha operatsiyalar (sinxronizatsiya, kirish, chaqirish, yakunlash) to'liq qayd etiladi.
- **Zaxira Arxivlari:**
  - Papka: `versions/v4.0.0/`
  - Zip: `versions/extension-karmed-assign-doctor-v4.0.0.zip`

---

### ✅ [v3.0.0] — 08.09.2026 (To'liq Arxivlangan)
- **Tavsif:** Server dasturi, Kunlik Log, Web TV Dashboard, Yagona Xona Ekrani va Android TV APK ilovasi.
- **Kiritilgan imkoniyatlar:**
  1. **Mustaqil Server (`server.exe` va `logger_server.js`):**
     - Windows konsol dasturi, 2 marta bosishda ishga tushadi (Port: 9876).
  2. **Kunlik Dinamik Log (`Log/<DD.MM.YYYY>/logger.me`):**
     - Har kuni avtomatik ravishda yangi sana nomli papka ochilib, kunlik barcha amallar yozib boriladi.
  3. **Karmed Navbatini Avtomatik Saralash:**
     - `Ultratovush` bo'limi, `Bekleyen` holatidagi bemorlarni `Alt Bölüm` bo'yicha ajratish va `Kayıt Tarihi` bo'yicha tartiblash.
  4. **Web TV Dashboard (Responsiv):**
     - Barcha xonalar bo'yicha TV gridi (Kutish zali uchun).
     - Post kompyuteri boshqaruv paneli (Vrachlarni tanlash va filtrlash).
     - Mobil telefonlar uchun qulay ko'rinish.
  5. **Yagona Xona TV Ekrani (Skrinshot ko'rinishida):**
     - Markaziy sarlavha (masalan: `UTT10-51 XONA`).
     - O'zbekcha sana va soat (`Seshanba 8 Sentabr 2026` | `10:28:34`).
     - Oq karta, qizil yuqori chiziq, shifokor nomi.
     - Jadvalda 3 ta ustun: `ISM FAMILYA`, `RO'YXATGA OLINGAN VAQTI`, `NAVBAT RAQAMI`.
     - Pastki ko'k yuguruvchi satr (Marquee banner) va Onkologiya Markazi logotipi.
  6. **To'liq Ekran (Full Screen / F11):**
     - Bir marta bosishda monitor to'liq ekranga o'tadi.
  7. **Android TV APK Ilovasi (`UTT_TV_Navbat.apk`):**
     - Android TV Leanback launcher banneri (320x180 px).
     - `FLAG_KEEP_SCREEN_ON` — TV ekrani o'chib qolmaydi.
     - TV pultdagi `MENU` orqali Server IP va Xona tanlash sozlamasi.
     - Wi-Fi uzilsa avtomatik qayta ulanish (Auto-retry).
- **Arxivlar:**
  - To'liq tizim: `versions/UTT-Full-System-v3.0.0.zip`
  - Eksteshn: `versions/extension-karmed-assign-doctor-v3.0.0.zip`
  - Papka: `versions/v3.0.0/`

---

### 📦 [v2.0.0 - v2.5.0] — 07.09.2026 - 08.09.2026
- **Tavsif:** XPrinter chop etish, 6 tilda talon, vrach o'zgartirish izohlari va logger.me.
- **Kiritilgan imkoniyatlar:**
  1. XPrinter orqali navbat taloni chop etish (bemor ID, sana, vaqt, navbat raqami).
  2. 6 tilda talon (O'zbek, Rus, Ingliz, Turk, Qozoq, Tojik).
  3. Vrach o'zgartirish sababini tanlash oynasi:
     - 1. Bemor o'z xohishi bilan (shifokorni kutishga rozi).
     - 2. Vrach iltimosi (qaysi vrach iltimos qilgani izohi bilan).
     - 3. Boshqa sabab (maxsus izoh bilan).
  4. Barcha amallarni `logger.me` ga yozish.
- **Arxivlar:** `versions/v2.0.0/` ... `versions/v2.5.0/` va zip fayllar.

---

### 📦 [v1.0.0 - v1.4.0] — 06.09.2026 - 07.09.2026
- **Tavsif:** Boshlang'ich tezkor vrach biriktirish (0-9 raqamli klavishlar orqali).
- **Arxivlar:** `versions/v1.4.0/` va zip fayl.
