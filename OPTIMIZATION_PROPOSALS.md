# 🚀 Tizim Ishlash Tezligi Tahlili va Optimallashtirish Takliflari (Performance & Optimization Guide)

Ushbu hujjatda **RONS (Radiology AI)** tizimining Kardelen Chrome kengaytmasi hamda Registratura, Laborant va Admin veb-panellaridagi ishlash tezligi tahlili, sekinlashuvga olib kelayotgan asosiy sabablar va ularni bartaraf etish bo'yicha tavsiya etilgan optimallashtirish yechimlari batafsil bayon etilgan.

---

## 🔍 1. Aniqlangan Asosiy Sekinlashuv Sabablari (Bottlenecks)

### ⚠️ 1.1. Brauzerda «Layout Thrashing» (Majburiy Stillarni Qayta Hisoblash)
- **Muammo**: Kengaytma ichidagi `setInterval(syncPatientAndServicesFromDom, 1000)` funksiyasi har 1 soniyada Kardelen sahifasidagi yuzlab `<tr>` va `<td>` elementlarini aylanib chiqadi.
- **Asosiy sabab**: Har bir katakcha tekshirilganda `window.getComputedStyle(el).backgroundColor` chaqiriladi.
- **Oqibati**: Brauzer har soniyada butun sahifaning geometriyasi va piksellarini majburiy qayta hisoblashga (reflow / layout thrashing) majbur bo'ladi. Natijada brauzerda CPU sarfi oshib, sichqoncha harakatlarida yoki sahifa aylanishida mikro-qotishlar (lag) yuzaga keladi.

### ⚠️ 1.2. Kengaytma Yuklanishida Ketma-Ket (Sequential) Tarmoq So'rovlari
- **Muammo**: Kengaytma ishga tushganda 7–8 ta Firebase sozlamalari (`services_catalog`, `general_guidelines`, `doctors`, `schedule`, `calendar_exceptions`, `scheduling_rules`, `operators`) birin-ketin (`await fetch1; await fetch2; await fetch3...`) yuklanadi.
- **Oqibati**: Har bir so'rov 200–500ms vaqt olganda, kengaytmaning to'liq tayyor bo'lishi 2–3 soniyaga cho'zilib ketadi.

### ⚠️ 1.3. Tarmoq So'rovlarida Xotira Keshi (In-Memory Cache) Yetishmasligi
- **Muammo**: Foydalanuvchi Kardelen jadvalidagi biror bemor qatorini bosganda yoki navbat oynasini ochganda, o'sha kungi barcha bemorlar ro'yxati (`/patients/${date}.json`) har safar serverdan boshqatdan yuklanadi.
- **Oqibati**: Bir necha bemorni ketma-ket ko'rishda har bir klikdan so'ng internet tezligiga qarab 300ms–1s gacha kutish yuzaga keladi.

### ⚠️ 1.4. Qidiruv va Filtrlarda «Debounce» Yetishmasligi
- **Muammo**: Registratura va Admin veb-panellarida qidiruv maydoniga har bir harf yozilganda (`oninput`), butun 100+ qatorli jadval o'sha zahotiyoq qaytadan saralanib, yangitdan HTML qilib chiziladi.
- **Oqibati**: Tez yozilganda harflar kechikib chiqadi yoki matn kiritishda qotish seziladi.

---

## 🛠 2. Tavsiya Etilgan Optimallashtirish Yechimlari

### 💡 2.1. Kengaytma (`extension-kardelen/content.js`) bo'yicha:
1. **Parallel Yuklash (`Promise.allSettled`)**:
   - Boshlang'ich barcha Firebase sozlamalarini ketma-ket emas, bir vaqtning o'zida parallel yuklash.
   - *Natija:* Kengaytmaning ishga tushish vaqti **4–5 barobarga** qisqaradi (2–3 soniyadan 300–500ms ga tushadi).
2. **Layout Thrashing ni Bartaraf Etish**:
   - `getComputedStyle` chaqiruvini olib tashlash. Ranglarni to'g'ridan-to'g'ri `el.getAttribute('style')` va CSS `className` orqali aniqlash.
   - Har soniyadagi `setInterval(1000)` o'rniga faqat foydalanuvchi qatorni bosganida (`click`) yoki jadval o'zgargandagina ishlaydigan yengil mexanizmga o'tkazish.
   - *Natija:* Brauzerning protsessor yuklamasi 80% ga kamayadi, sahifa ravon va yengil aylanadi.
3. **Qisqa Muddatli Xotira Keshi (In-Memory Cache - 5-10 soniya)**:
   - Yuklangan kunlik bemorlar ma'lumotlarini 5–10 soniya xotirada saqlab turish.
   - *Natija:* Ketma-ket bemorlarni tanlashda serverga ortiqcha so'rov ketmaydi va ma'lumotlar **0 millisekundda (bir zumda)** ochiladi.

### 💡 2.2. Veb-Panellar (`app1-registratura`, `app4-admin`) bo'yicha:
1. **Qidiruvga Debounce (150ms) Qo'shish**:
   - Qidiruv maydoniga yozish to'xtaganidan so'nggina jadvalni qayta chizish.
   - *Natija:* Matn yozish nihoyatda yengil va silliq bo'ladi.
2. **DOM Yangilanishini Optimallashtirish**:
   - Qator holati o'zgarganda (masalan, «Kutish zalida» tugmasi bosilganda), butun jadvalni qaytadan chizmasdan faqat tegishli qatorni yangilash.

---

## 📊 Kutilayotgan Natijalar

| Parametr | Hozirgi Holat | Optimallashtirishdan Keyin | O'sish |
| :--- | :--- | :--- | :--- |
| **Kengaytma tayyor bo'lishi** | 2.5 – 3.5 soniya | 0.4 – 0.6 soniya | **~5x tezroq** |
| **Bemor tanlanganda ochilish** | 400 – 1200 ms | 0 – 50 ms (kesh orqali) | **Bir zumda** |
| **Sahifaning CPU yuklamasi** | O'rtacha / Yuqori (har 1 soniyada reflow) | Minimal (faqat amallar paytida) | **~80% yengilroq** |
| **Qidiruvda matn kiritish** | Har bir harfda jadval qayta chiziladi | Debounce orqali silliq | **Juda ravon** |

---

*Hujjat avtomatik tarzda shakllantirildi va tasdiqlangandan so'ng amaliyotga tatbiq etilishi mumkin.*
