# 🏥 UTT TV SISTEM — 100% LOKAL TARMOQ (LAN) TIBBIY NAVBAT VA CHAQIRUV TIZIMI

Ushbu tizim shifoxonada **internet ulanishisiz**, faqat **lokal tarmoq (Ethernet kabeli yoki Wi-Fi router)** orqali ishlaydi. Barcha ma'lumotlar shifoxonaning o'z kompyuterida lokal saqlanadi va tashqariga chiqmaydi.

---

## 📂 Loyiha Tarkibi:

1. **`server/`** — Node.js Lokal Realtime Serveri va Ma'lumotlar Bazasi.
2. **`extension-vrach-queue/`** — 1-Chrome Kengaytmasi (Vrach qabuli va bemorlarni navbat bo'yicha chaqirish).
3. **`extension-reassign-doctor/`** — 2-Chrome Kengaytmasi (Karmed orqali bemorning vrachini o'zgartirish va yangi vrach ro'yxatiga yo'naltirish).
4. **`server/public/tv/`** — Android TV uchun Katta Ekran Navbat Monitori (O'zbekcha ovozli TTS + Gong Chime).
5. **`START_SERVER.bat`** — Serverni bitta bosishda ishga tushirish fayli.

---

## 🚀 1-QADAM: Serverni Ishga Tushirish va Host IP Manzilini Aniqlash

### A) Serverni ishga tushirish:
1. `UTT TV sistem` papkasidagi **`START_SERVER.bat`** faylini sichqoncha bilan ikki marta bosing.
2. Qora darcha (konsol) ochiladi va server avtomatik ravishda kompyuteringizning lokal IP manzilini aniqlab beradi.

### B) Konsolda chiquvchi manzil namunasi:
```text
==================================================================
  🏥 UTT TV SISTEM — 100% LOKAL TARMOQ (LAN) REALTIME SERVERI
==================================================================
  🚀 Server holati: ISHLAMOQDA (Port: 3000)
  🌐 Lokal Kompyuterda:   http://localhost:3000/tv
------------------------------------------------------------------
  📡 LOKAL TARMOQDAGI (LAN) ULANISH MANZILLARI:
  📺 [Ethernet] Android TV:  http://192.168.1.100:3000/tv
  🔌 [Ethernet] Kengaytmalar: http://192.168.1.100:3000/api
------------------------------------------------------------------
  💡 ASOSIY HOST MANZILI: http://192.168.1.100:3000
==================================================================
```

### C) Qo'shimcha: Windows `ipconfig` orqali IP manzilni aniqlash:
1. Klaviaturada `Win + R` bosing, `cmd` yozib `Enter` bosing.
2. Darchaga `ipconfig` deb yozib `Enter` bosing.
3. **`IPv4 Address`** qatoridagi raqamni toping (masalan: `192.168.1.100` yoki `10.10.x.x`).
4. Sizning Server Host manzilingiz: `http://192.168.1.100:3000` bo'ladi!

---

## 📺 2-QADAM: Android TV ni Lokal Tarmoqqa Ulash va Sozlash

1. **Tarmoqqa ulash:** Android TV va Server kompyuterini bir xil tarmoqqa ulang (Internet/LAN kabeli orqali switchga yoki umumiy Wi-Fi routerga).
2. **Brauzerni ochish:** Android TV dagi istalgan brauzerni (Google Chrome, TV Browser, Puffin TV) oching.
3. **Manzilni kiritish:** Manzil satriga konsoldan olingan havolani yozing:
   ```text
   http://192.168.1.100:3000/tv
   ```
   *(Raqam o'rniga o'zingizning kompyuter IP manzilingizni qo'ying)*
4. **Ovozni faollashtirish:** Ekranda «Ovozli E'lonlarni Faollashtirish» oynasi chiqadi. TV pultidagi **[ OK ]** tugmasini bir marta bosing.
5. **Natija:** TV da barcha xonalar bo'yicha chiroyli navbat jadvali chiqadi. Vrach chaqiruv tugmasini bosgan zahoti TV da ding-dong musiqasi chalinadi va o'zbek tilida bemorning **F.I.Sh va Xona raqami** aniq o'qib eshittiriladi!

---

## 🧩 3-QADAM: 1-Chrome Kengaytmasini O'rnatish (Vrach Qabuli & Chaqiruv)

1. Google Chrome brauzerini oching va manzil satriga yozing:
   ```text
   chrome://extensions/
   ```
2. Yuqori o'ng burchakdagi **«Developer mode» (Режим разработчика)** tugmasini yoqing.
3. Chap tomondagi **«Load unpacked» (Загрузить распакованное расширение)** tugmasini bosing.
4. `UTT TV sistem/extension-vrach-queue` papkasini tanlang.
5. **Foydalanish:**
   - Kengaytma belgisini bosing va o'zingizning **Xona / Shifokor** nomini tanlang.
   - Sozlamalardan Server IP manzilini kiriting (masalan: `http://localhost:3000` yoki `http://192.168.1.100:3000`).
   - Navbatdagi bemor yonidagi **«📢 Chaqirish»** tugmasini bosing -> TV da ovozli e'lon beriladi!
   - Karmed sahifasidagi bemorlar ro'yxatida ham avtomatik ravishda **«📢 Chaqirish»** tugmasi paydo bo'ladi.

---

## 🔄 4-QADAM: 2-Chrome Kengaytmasini O'rnatish (Vrachni O'zgartirish)

1. `chrome://extensions/` sahifasiga kiring.
2. **«Load unpacked»** tugmasini bosing.
3. `UTT TV sistem/extension-reassign-doctor` papkasini tanlang.
4. **Foydalanish:**
   - Karmed sahifasidagi bemorlar yonida **«🔄 Vrachni o'zgartirish»** tugmasi chiqadi.
   - Tugmani bosib, yangi vrachni tanlang (masalan: `102-xona Dr. Dadaboyev` yoki `1-MRT`).
   - Bemor darhol yangi vrach navbatiga o'tadi va 1-kengaytmada o'sha vrach ro'yxatida paydo bo'ladi!

---

## 🛠️ Xatoliklar va Muammolarni Hal Qilish (Troubleshooting)

| Muammo | Sababi | Yechimi |
|---|---|---|
| **Android TV ga ulanmayapti** | Kompyuter va TV turli tarmoqda yoki IP noto'g'ri | Ikkalasi ham bir xil tarmoq kabeli / routerga ulanganini tekshiring. `ipconfig` orqali IP ni qayta tekshiring. |
| **Windows Firewall bloklayapti** | Windows xavfsizlik devori 3000 portni yopgan | `START_SERVER.bat` birinchi marta ochilganda Windows "Ruxsat berish" (Allow access) so'rasa, "Ruxsat berish"ni bosing. |
| **TV da ovoz chiqmayapti** | Brauzer avto-ovozni bloklagan | TV pultidagi **[ OK ]** tugmasini bir marta bosib, ekrandagi ovoz oynasini yoping. |
| **Kengaytma serverga ulanmadi** | Kengaytma sozlamalarida IP kiritilmagan | Kengaytma ichidagi ⚙️ (Sozlamalar) tugmasini bosib, server manzilini to'g'ri kiriting (`http://192.168.1.100:3000`). |

---

### 🛡️ Xavfsizlik va Maxfiylik:
- Barcha ma'lumotlar `server/data/queue.json` faylida lokal saqlanadi.
- Hech qanday tashqi internet ulanishi shart emas.
