/**
 * CONTENT.JS - KARMED TEZKOR VRACH BIRIKTIRISH (0-9)
 * 
 * To'liq Sahifadagi UI Avtomatlashtirish & Ko'p Modal Himoyasi:
 * 1. Bemor / fayl qatori tanlanadi (1-qator va guruh sarlavhalari to'g'ri ajratiladi).
 * 2. Gorizontal skroll bo'lganda ham o'ng tugma (contextmenu) 100% aniq ishlaydi.
 * 3. 2 ta yoki undan ortiq modal oyna ochilganligi tekshiriladi va hisobga olinadi.
 * 4. ExtJS SelectionModel va DOM orqali AYNAN raqamga mos vrach tanlanadi.
 * 5. Modalning [Ok] tugmasi bosiladi (serverga saqlanadi).
 * 6. Barcha ochiq qolgan modal oynalar «Bekor qil...» orqali to'liq yopiladi.
 * 7. Barcha bosqichlar to'liq "logger.me" fayliga yozib boriladi.
 * 8. F8 tugmasi orqali kengaytmani Yoqish / O'chirish mumkin.
 */

(function () {
  // Avvalgi nusxani to'liq tozalash (Multiple instance bo'lib qolmasligi uchun)
  if (window.__karmedQuickAssignCleanup) {
    try {
      window.__karmedQuickAssignCleanup();
    } catch (e) {}
  }

  const abortCtrl = new AbortController();
  const signal = abortCtrl.signal;

  window.__karmedQuickAssignCleanup = function () {
    abortCtrl.abort();
    const oldBar = document.getElementById('utt-quick-assign-bar');
    if (oldBar) oldBar.remove();
    const oldToast = document.getElementById('karmed-assign-toast');
    if (oldToast) oldToast.remove();
  };

  // 1. VRACHLAR VA KODLAR RO'YXATI (0-9)
  const DOCTORS = {
    "1": {
      num: "1",
      kod: "13",
      room: "Ultratovush-1",
      shortName: "Juravlev",
      fullName: "Juravlev Igor Ivanovich",
      aliases: ["13", "juravlev", "igor", "ultratovush-1", "ultratovush 1", "журавлев"]
    },
    "2": {
      num: "2",
      kod: "15",
      room: "Ultratovush-2",
      shortName: "Kurbanova",
      fullName: "Kurbanova Sevinch Musayevna",
      aliases: ["15", "kurbanova", "sevinch", "ultratovush-2", "ultratovush 2", "курбанова"]
    },
    "3": {
      num: "3",
      kod: "16",
      room: "Ultratovush-3",
      shortName: "Abidjanov",
      fullName: "Abidjanov Alisher Maxamataliyevich",
      aliases: ["16", "abidjanov", "alisher", "ultratovush-3", "ultratovush 3", "абиджанов"]
    },
    "4": {
      num: "4",
      kod: "18",
      room: "Ultratovush-4",
      shortName: "Ziyayeva",
      fullName: "Ziyayeva Zarina Abduganiyevna",
      aliases: ["18", "ziyayeva", "zarina", "ultratovush-4", "ultratovush 4", "зияева"]
    },
    "5": {
      num: "5",
      kod: "17",
      room: "Ultratovush-5",
      shortName: "Xoshimova",
      fullName: "Xoshimova Lola Kabulovna",
      aliases: ["17", "xoshimova", "lola", "ultratovush-5", "ultratovush 5", "хошимова"]
    },
    "6": {
      num: "6",
      kod: "19",
      room: "Ultratovush-6",
      shortName: "Toirova",
      fullName: "Toirova Shaxlo Oybek qizi",
      aliases: ["19", "toirova", "shaxlo", "ultratovush-6", "ultratovush 6", "тоирова"]
    },
    "7": {
      num: "7",
      kod: "32",
      room: "Ultratovush-7",
      shortName: "Asadova",
      fullName: "Asadova Dildoraxon Asatullayevna",
      aliases: ["32", "asadova", "dildora", "dildoraxon", "ultratovush-7", "ultratovush 7", "асадова"]
    },
    "8": {
      num: "8",
      kod: "14",
      room: "Ultratovush-8",
      shortName: "Saidbayeva",
      fullName: "Saidbayeva Zulfiya Yergeshovna",
      aliases: ["14", "saidbayeva", "zulfiya", "ultratovush-8", "ultratovush 8", "саидбаева"]
    },
    "9": {
      num: "9",
      kod: "35",
      room: "Ultratovush-9",
      shortName: "Xusanova",
      fullName: "Xusanova Feruza Ikromjonovna",
      aliases: ["35", "xusanova", "feruza", "ultratovush-9", "ultratovush 9", "хусанова"]
    },
    "0": {
      num: "0",
      kod: "33",
      room: "Ultratovush-10",
      shortName: "Xudayberdiyeva",
      fullName: "Xudayberdiyeva Nigora Nizamovna",
      aliases: ["33", "xudayberdiyeva", "nigora", "ultratovush-10", "ultratovush 10", "худайбердиева"]
    }
  };

  // 1.1 KO'P TILLI LUG'AT VA TALON MATNLARI (UZ, RU, EN, TR, KK, TG)
  const PRINT_LANGUAGES = [
    { code: 'uz', label: 'UZ', name: "O'zbekcha" },
    { code: 'ru', label: 'RU', name: "Русский" },
    { code: 'en', label: 'EN', name: "English" },
    { code: 'tr', label: 'TR', name: "Türkçe" },
    { code: 'kk', label: 'KK', name: "Қазақша" },
    { code: 'tg', label: 'TG', name: "Тоҷикӣ" }
  ];

  let currentPrintLang = 'uz';
  try {
    const savedLang = localStorage.getItem('__karmed_ext_print_lang');
    if (savedLang && ['uz', 'ru', 'en', 'tr', 'kk', 'tg'].includes(savedLang)) {
      currentPrintLang = savedLang;
    }
  } catch (e) {}

  const I18N_TICKET = {
    uz: {
      centerHeader: "RESPUBLIKA IXTISOSLASHTIRILGAN ONKOLOGIYA VA RADIOLOGIYA ILMIY-AMALIY TIBBIYOT MARKAZI",
      subHeader: "Ultratovush Tekshiruvi (UTT) Taloni",
      queueTitle: "NAVBAT RAQAMI",
      tvWarning: "navbat raqami yuqoridagi navbat raqami TV ekrani bilan mos, ammo hozirda TV tizimi to'liq ishga tushmagani bois bu raqamni navbatingiz deb bilmang. ta'lonni to'liq o'qib chiqib navbatingizni aniqlab oling.",
      timeTitle: "RO'YXATGA OLINGAN VAQTI:",
      idTitle: "BEMOR ID:",
      lblPatient: "Bemor (F.I.SH):",
      lblUttDoc: "UTT Shifokori:",
      lblRefDoc: "Davolovchi Shifokor:",
      noticeTitle: "ℹ️ ESLATMA",
      generalTitle: "📋 UMUMIY ESLATMA:",
      generalNotice: "har bir tekshiruv uchun o'rtacha 20 minutdan 40 minutgacha vaqt ketadi. Bemor ahvoliga qarab bu vaqt ko'proq bo'lishi mumkin. vrach va hamshiraga savolingiz bo'lsa, iltimos tekshiruvdagi bemorni bezovta qilmaslik uchun eshik oldida kutib turing va hamshira yoki vrachni tekshiruvdagi bemor chiqqanidan so'ng so'rab savollaringizni bering. qo'shimcha savollar uchun postga uchrashishingiz mumkin.",
      wifiTitle: "📶 BEPUL WI-FI",
      wifiSsidLbl: "Tarmoq Nomi (SSID):",
      wifiPassLbl: "Parol:",
      quietRule: "baland gapirish mumkin emas. iltimos past ovozda gaplashing. baqirish va yuqori ovozda gaplashish tekshiruvlarning o'tishiga va vrachlarning ish faoliyatiga xalaqit beradi.",
      emptyQueue: "bemor fayli o'zgartirilgan, izoh bemor xoxishi",
      footer: "Salomatligingiz biz uchun muhim! • XPrinter 80mm",
      docNotices: {
        "1": "hamshiraga ushbu qog'ozni berib qo'ying, xamshirani o'zlari chaqiradi.",
        "2": "hamshirasiga uchrashib, familya ismingizni yozdirib qo'ying. hamshira navbat bilan chaqiradi.",
        "3": "hamshirasiga uchrashib, familya ismingizni yozdirib qo'ying. hamshira navbat bilan chaqiradi.",
        "4": "hamshirasiga uchrashib, familya ismingizni yozdirib qo'ying. hamshira navbat bilan chaqiradi.",
        "5": "jonli navbatga turing. vrach jonli navbat bo'yicha chaqiradilar.",
        "6": "jonli navbatga turing. vrach jonli navbat bo'yicha chaqiradilar.",
        "7": "xamshirasiga uchrashib so'rang navbat haqida ma'lumot beradi.",
        "8": "xamshirasiga uchrashib so'rang navbat haqida ma'lumot beradi.",
        "9": "xamshirasiga uchrashib so'rang navbat haqida ma'lumot beradi.",
        "0": "xamshirasiga uchrashib so'rang navbat haqida ma'lumot beradi.",
        "10": "xamshirasiga uchrashib so'rang navbat haqida ma'lumot beradi."
      }
    },
    ru: {
      centerHeader: "РЕСПУБЛИКАНСКИЙ СПЕЦИАЛИЗИРОВАННЫЙ НАУЧНО-ПРАКТИЧЕСКИЙ МЕДИЦИНСКИЙ ЦЕНТР ОНКОЛОГИИ И РАДИОЛОГИИ",
      subHeader: "Талон ультразвукового исследования (УЗИ)",
      queueTitle: "НОМЕР ОЧЕРЕДИ",
      tvWarning: "номер очереди совпадает с экраном ТВ, но так как система ТВ ещё не полностью запущена, не считайте этот номер своей очередью. Внимательно прочитайте талон и уточните свою очередь.",
      timeTitle: "ВРЕМЯ РЕГИСТРАЦИИ:",
      idTitle: "ID ПАЦИЕНТА:",
      lblPatient: "Пациент (Ф.И.О):",
      lblUttDoc: "Врач УЗИ:",
      lblRefDoc: "Лечащий врач:",
      noticeTitle: "ℹ️ ПАМЯТКА",
      generalTitle: "📋 ОБЩАЯ ПАМЯТКА:",
      generalNotice: "на каждое исследование в среднем уходит от 20 до 40 минут. В зависимости от состояния пациента это время может увеличиться. Если у вас есть вопросы к врачу или медсестре, пожалуйста, чтобы не беспокоить обследуемого пациента, ожидайте перед дверью и задавайте вопросы только после выхода пациента. По дополнительным вопросам вы можете обратиться на пост.",
      wifiTitle: "📶 БЕСПЛАТНЫЙ WI-FI",
      wifiSsidLbl: "Имя сети (SSID):",
      wifiPassLbl: "Пароль:",
      quietRule: "громко разговаривать запрещено. Пожалуйста, говорите тихим голосом. Крик и громкие разговоры мешают проведению обследований и работе врачей.",
      emptyQueue: "файл пациента изменён, примечание: по желанию пациента",
      footer: "Ваше здоровье — наша главная ценность! • XPrinter 80mm",
      docNotices: {
        "1": "передайте эту бумагу медсестре, медсестра сама вас вызовет.",
        "2": "подойдите к медсестре и запишите свою фамилию и имя. Медсестра вызовет по очереди.",
        "3": "подойдите к медсестре и запишите свою фамилию и имя. Медсестра вызовет по очереди.",
        "4": "подойдите к медсестре и запишите свою фамилию и имя. Медсестра вызовет по очереди.",
        "5": "занимайте живую очередь. Врач вызывает по живой очереди.",
        "6": "занимайте живую очередь. Врач вызывает по живой очереди.",
        "7": "обратитесь к медсестре кабинета, она предоставит информацию об очереди.",
        "8": "обратитесь к медсестре кабинета, она предоставит информацию об очереди.",
        "9": "обратитесь к медсестре кабинета, она предоставит информацию об очереди.",
        "0": "обратитесь к медсестре кабинета, она предоставит информацию об очереди.",
        "10": "обратитесь к медсестре кабинета, она предоставит информацию об очереди."
      }
    },
    en: {
      centerHeader: "REPUBLICAN SPECIALIZED SCIENTIFIC AND PRACTICAL MEDICAL CENTER OF ONCOLOGY AND RADIOLOGY",
      subHeader: "Ultrasound Examination (US) Ticket",
      queueTitle: "QUEUE NUMBER",
      tvWarning: "the queue number matches the TV screen, but since the TV system is not yet fully operational, do not consider this number as your final queue. Please read the ticket completely to determine your order.",
      timeTitle: "REGISTRATION TIME:",
      idTitle: "PATIENT ID:",
      lblPatient: "Patient (Full Name):",
      lblUttDoc: "Ultrasound Doctor:",
      lblRefDoc: "Referring Doctor:",
      noticeTitle: "ℹ️ NOTICE",
      generalTitle: "📋 GENERAL NOTICE:",
      generalNotice: "each examination takes on average 20 to 40 minutes. Depending on the patient's condition, it may take longer. If you have questions for the doctor or nurse, please wait outside the door so as not to disturb the patient being examined, and ask your questions only after the patient exits. For additional questions, please contact the post.",
      wifiTitle: "📶 FREE WI-FI",
      wifiSsidLbl: "Network Name (SSID):",
      wifiPassLbl: "Password:",
      quietRule: "loud talking is not permitted. Please speak in a low voice. Shouting and loud conversations disrupt examinations and interfere with doctors' work.",
      emptyQueue: "patient file has been modified, note: at patient's request",
      footer: "Your health is our greatest priority! • XPrinter 80mm",
      docNotices: {
        "1": "hand this paper to the nurse; the nurse will call you in.",
        "2": "see the nurse and have your name written down. The nurse will call you in queue order.",
        "3": "see the nurse and have your name written down. The nurse will call you in queue order.",
        "4": "see the nurse and have your name written down. The nurse will call you in queue order.",
        "5": "please join the live queue. The doctor will call patients in live queue order.",
        "6": "please join the live queue. The doctor will call patients in live queue order.",
        "7": "please consult the room nurse, who will provide information about your queue.",
        "8": "please consult the room nurse, who will provide information about your queue.",
        "9": "please consult the room nurse, who will provide information about your queue.",
        "0": "please consult the room nurse, who will provide information about your queue.",
        "10": "please consult the room nurse, who will provide information about your queue."
      }
    },
    tr: {
      centerHeader: "CUMHURİYET UZMANLAŞMIŞ ONKOLOJİ VE RADYOLOJİ BİLİMSEL-UYGULAMALI TIP MERKEZİ",
      subHeader: "Ultrason Muayenesi (USG) Sıra Bileti",
      queueTitle: "SIRA NUMARASI",
      tvWarning: "sıra numarası TV ekranı ile eşleşmektedir, ancak TV sistemi henüz tam devreye girmediğinden bu numarayı sıranız olarak kabul etmeyiniz. Sıranızı netleştirmek için bileti tam okuyunuz.",
      timeTitle: "KAYIT ZAMANI:",
      idTitle: "HASTA ID:",
      lblPatient: "Hasta (Adı Soyadı):",
      lblUttDoc: "Ultrason Hekimi:",
      lblRefDoc: "Tedavi Eden Hekim:",
      noticeTitle: "ℹ️ BİLGİLENDİRME",
      generalTitle: "📋 GENEL BİLGİLENDİRME:",
      generalNotice: "her muayene ortalama 20 ila 40 dakika sürmektedir. Hastanın durumuna bağlı olarak bu süre uzayabilir. Hekim veya hemşireye sorunuz varsa, içerideki hastayı rahatsız etmemek adına kapı önünde bekleyiniz ve sorunuzu hasta çıktıktan sonra iletiniz. Ek sorularınız için danışma/posta başvurabilirsiniz.",
      wifiTitle: "📶 ÜCRETSİZ WI-FI",
      wifiSsidLbl: "Ağ Adı (SSID):",
      wifiPassLbl: "Şifre:",
      quietRule: "yüksek sesle konuşmak yasaktır. Lütfen alçak sesle konuşunuz. Bağırmak ve yüksek sesle konuşmak muayenelerin yapılmasına ve hekimlerin çalışmasına engel olur.",
      emptyQueue: "hasta dosyası değiştirildi, açıklama: hasta isteği üzerine",
      footer: "Sağlığınız bizim için değerlidir! • XPrinter 80mm",
      docNotices: {
        "1": "bu kağıdı hemşireye veriniz, hemşire sizi kendisi çağıracaktır.",
        "2": "hemşire ile görüşüp adınızı soyadınızı yazdırınız. Hemşire sırayla çağıracaktır.",
        "3": "hemşire ile görüşüp adınızı soyadınızı yazdırınız. Hemşire sırayla çağıracaktır.",
        "4": "hemşire ile görüşüp adınızı soyadınızı yazdırınız. Hemşire sırayla çağıracaktır.",
        "5": "canlı sıraya giriniz. Hekim canlı sıraya göre çağıracaktır.",
        "6": "canlı sıraya giriniz. Hekim canlı sıraya göre çağıracaktır.",
        "7": "oda hemşiresine danışınız, sıra hakkında bilgi verecektir.",
        "8": "oda hemşiresine danışınız, sıra hakkında bilgi verecektir.",
        "9": "oda hemşiresine danışınız, sıra hakkında bilgi verecektir.",
        "0": "oda hemşiresine danışınız, sıra hakkında bilgi verecektir.",
        "10": "oda hemşiresine danışınız, sıra hakkında bilgi verecektir."
      }
    },
    kk: {
      centerHeader: "РЕСПУБЛИКАЛЫҚ МАМАНДАНДЫРЫЛҒАН ОНКОЛОГИЯ ЖӘНЕ РАДИОЛОГИЯ ҒЫЛЫМИ-ПРАКТИКАЛЫҚ МЕДИЦИНАЛЫҚ ОРТАЛЫҒЫ",
      subHeader: "Ультрадыбыстық зерттеу (УДЗ) талоны",
      queueTitle: "КЕЗЕК НӨМІРІ",
      tvWarning: "кезек нөмірі теледидар экранымен сәйкес келеді, бірақ теледидар жүйесі әлі толық іске қосылмағандықтан, бұл нөмірді кезегіңіз деп санамаңыз. Кезегіңізді анықтау үшін талонды толық оқып шығыңыз.",
      timeTitle: "ТІРКЕЛГЕН УАҚЫТЫ:",
      idTitle: "НАУҚАС ID:",
      lblPatient: "Науқас (Аты-жөні):",
      lblUttDoc: "УДЗ дәрігері:",
      lblRefDoc: "Емдеуші дәрігер:",
      noticeTitle: "ℹ️ ЕСКЕРТПЕ",
      generalTitle: "📋 ЖАЛПЫ ЕСКЕРТПЕ:",
      generalNotice: "әрбір зерттеу орта есеппен 20-дан 40 минутқа дейін уақыт алады. Науқастың жағдайына байланысты бұл уақыт көбірек болуы мүмкін. Дәрігерге немесе мейірбикеге сұрақтарыңыз болса, тексеріліп жатқан науқасқа кедергі келтірмеу үшін есік алдында күтіңіз және сұрақтарыңызды науқас шыққаннан кейін қойыңыз. Қосымша сұрақтар бойынша бекетке жолығуыңызға болады.",
      wifiTitle: "📶 ТЕГІН WI-FI",
      wifiSsidLbl: "Желі атауы (SSID):",
      wifiPassLbl: "Құпия сөз:",
      quietRule: "қатты сөйлеуге тыйым салынады. Өтінеміз, ақырын дауыспен сөйлесіңіз. Айқайлау және қатты сөйлесу зерттеулердің өтуіне және дәрігерлердің жұмысына кедергі келтіреді.",
      emptyQueue: "науқас файлы өзгертілді, түсініктеме: науқастың қалауы бойынша",
      footer: "Денсаулығыңыз біз үшін маңызды! • XPrinter 80mm",
      docNotices: {
        "1": "бұл қағазды мейірбикеге беріңіз, мейірбике өзі шақырады.",
        "2": "мейірбикеге барып, аты-жөніңізді жаздырыңыз. Мейірбике кезекпен шақырады.",
        "3": "мейірбикеге барып, аты-жөніңізді жаздырыңыз. Мейірбике кезекпен шақырады.",
        "4": "мейірбикеге барып, аты-жөніңізді жаздырыңыз. Мейірбике кезекпен шақырады.",
        "5": "жанды кезекке тұрыңыз. Дәрігер жанды кезек бойынша шақырады.",
        "6": "жанды кезекке тұрыңыз. Дәрігер жанды кезек бойынша шақырады.",
        "7": "бөлме мейірбикесіне жолығып сұраңыз, ол кезек туралы ақпарат береді.",
        "8": "бөлме мейірбикесіне жолығып сұраңыз, ол кезек туралы ақпарат береді.",
        "9": "бөлме мейірбикесіне жолығып сұраңыз, ол кезек туралы ақпарат береді.",
        "0": "бөлме мейірбикесіне жолығып сұраңыз, ол кезек туралы ақпарат береді.",
        "10": "бөлме мейірбикесіне жолығып сұраңыз, ол кезек туралы ақпарат береді."
      }
    },
    tg: {
      centerHeader: "МАРКАЗИ ИЛМИЮ АМАЛИИ ТИББИИ ИХТИСОСИИ ҶУМҲУРИЯВИИ ОНКОЛОГИЯ ВА РАДИОЛОГИЯ",
      subHeader: "Талони ташхиси ултрасадоӣ (УЗИ)",
      queueTitle: "РАҚАМИ НАВБАТ",
      tvWarning: "рақами навбат бо экрани телевизор мувофиқ аст, аммо азбаски системаи ТВ ҳанӯз пурра ба кор надаромадааст, ин рақамро навбати худ надонед. Барои муайян кардани навбат талонро пурра хонед.",
      timeTitle: "ВАҚТИ БАҚАЙДГИРӢ:",
      idTitle: "ID БЕМОР:",
      lblPatient: "Бемор (Н.Н.О):",
      lblUttDoc: "Духтури УЗИ:",
      lblRefDoc: "Духтури табобаткунанда:",
      noticeTitle: "ℹ️ ЁДДОШТ",
      generalTitle: "📋 ЁДДОШТИ УМУМӢ:",
      generalNotice: "барои ҳар як ташхис ба ҳисоби миёна аз 20 то 40 дақиқа вақт сарф мешавад. Вобаста ба вазъияти бемор ин вақт метавонад зиёдтар бошад. Агар ба духтур ё ҳамшира саволе дошта бошед, лутфан барои халал нарасондан ба бемори зери ташхис дар назди дар интизор шавед ва саволҳои худро танҳо пас аз баромадани бемор диҳед. Барои саволҳои иловагӣ ба пост муроҷиат кунед.",
      wifiTitle: "📶 WI-FI РОЙГОН",
      wifiSsidLbl: "Номи шабака (SSID):",
      wifiPassLbl: "Гузарвожа:",
      quietRule: "баланд гап задан қатъиян манъ аст. Лутфан бо овози паст сӯҳбат кунед. Дод задан ва гуфтугӯи баланд ба гузаронидани ташхис ва кори табибон халал мерасонад.",
      emptyQueue: "парвандаи бемор иваз карда шуд, эзоҳ: бо хоҳиши бемор",
      footer: "Саломатии шумо барои мо муҳим аст! • XPrinter 80mm",
      docNotices: {
        "1": "ин қоғазро ба ҳамшира диҳед, ҳамшира худаш шуморо ҷеғ мезанад.",
        "2": "ба назди ҳамшира рафта, насабу номи худро нависед. Ҳамшира бо навбат ҷеғ мезанад.",
        "3": "ба назди ҳамшира рафта, насабу номи худро нависед. Ҳамшира бо навбат ҷеғ мезанад.",
        "4": "ба назди ҳамшира рафта, насабу номи худро нависед. Ҳамшира бо навбат ҷеғ мезанад.",
        "5": "дар навбати зинда биистед. Духтур аз рӯи навбати зинда ҷеғ мезанад.",
        "6": "дар навбати зинда биистед. Духтур аз рӯи навбати зинда ҷеғ мезанад.",
        "7": "ба ҳамшираи ҳуҷра муроҷиат кунед, ӯ дар бораи навбат маълумот медиҳад.",
        "8": "ба ҳамшираи ҳуҷра муроҷиат кунед, ӯ дар бораи навбат маълумот медиҳад.",
        "9": "ба ҳамшираи ҳуҷра муроҷиат кунед, ӯ дар бораи навбат маълумот медиҳад.",
        "0": "ба ҳамшираи ҳуҷра муроҷиат кунед, ӯ дар бораи навбат маълумот медиҳад.",
        "10": "ба ҳамшираи ҳуҷра муроҷиат кунед, ӯ дар бораи навбат маълумот медиҳад."
      }
    }
  };

  // Holat va Qat'iy Qulflash (Lock / Debounce)
  let isEnabled = true;
  try {
    const saved = localStorage.getItem('__karmed_ext_enabled');
    if (saved !== null) isEnabled = (saved === 'true');
  } catch (e) {}

  let isAutoPrintEnabled = true;
  try {
    const savedAuto = localStorage.getItem('__karmed_ext_autoprint');
    if (savedAuto !== null) isAutoPrintEnabled = (savedAuto === 'true');
  } catch (e) {}

  let lastSelectedRow = null;
  let lastPatientData = null;
  let isAssigning = false;
  let lastAssignEndTime = 0;
  const COOLDOWN_MS = 2000;
  let isBarMinimized = false;
  let toastTimer = null;

  // 2. REAL-TIME LOGGER (LOGGER.ME VA CONSOLE)
  function logToMe(category, message, data = null) {
    const time = new Date().toLocaleTimeString();
    let line = `[${time}] [${category}] ${message}`;
    if (data !== null) {
      try {
        line += ' | ' + (typeof data === 'object' ? JSON.stringify(data) : String(data));
      } catch (e) {}
    }

    console.log(`%c[KARMED UI LOG]%c ${line}`, 'color:#2563eb;font-weight:bold;', 'color:auto;');

    try {
      fetch('http://127.0.0.1:9876/log', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: line
      }).catch(() => {});
    } catch (e) {}

    try {
      const logs = JSON.parse(localStorage.getItem('__karmed_log_buffer') || '[]');
      logs.push(line);
      if (logs.length > 300) logs.shift();
      localStorage.setItem('__karmed_log_buffer', JSON.stringify(logs));
    } catch (e) {}
  }

  // 2.1 BARCHA BEMOR FAYLLARINI LOGGER.ME GA YOZISH TIZIMI
  let lastFilesHash = '';

  function getAllPatientRecordsFromStore() {
    const records = [];
    try {
      if (window.Ext && window.Ext.getCmp) {
        const grid = Ext.getCmp('grdHastalar');
        if (grid && grid.getStore) {
          const store = grid.getStore();
          if (store && store.getCount && store.getCount() > 0) {
            const count = store.getCount();
            for (let i = 0; i < count; i++) {
              const rec = store.getAt(i);
              if (rec && rec.data) {
                records.push(rec.data);
              }
            }
          }
        }
      }
    } catch (e) {}
    return records;
  }

  function getAllPatientRowsFromDom() {
    const rows = [];
    try {
      const gridContainer = document.getElementById('grdHastalar') || document.querySelector('.x-grid');
      if (!gridContainer) return rows;
      const allTrs = Array.from(gridContainer.querySelectorAll('tr, .x-grid-item'));
      for (const tr of allTrs) {
        if (isStudyRow(tr)) {
          rows.push(tr);
        }
      }
    } catch (e) {}
    return rows;
  }

  function scanAndLogAllPatientFiles(reason = 'AUTO') {
    try {
      const storeRecords = getAllPatientRecordsFromStore();
      let files = [];

      if (storeRecords.length > 0) {
        files = storeRecords.map((rec, idx) => {
          const pId = String(rec.KimlikNo || rec.Id || rec.HastaId || '').trim();
          const dosya = String(rec.DosyaNo || rec.DosyaId || rec.ProtokolNo || '').trim();
          const name = `${rec.Soyadi || ''} ${rec.HastaAdi || ''} ${rec.BabaAdi || ''}`.replace(/\s+/g, ' ').trim() || String(rec.AdSoyad || '').trim();
          const queue = String(rec.MuayeneSiraNo || rec.HastaSiraNo || rec.SiraNo || '').trim();
          const refDoc = String(rec.DosyaDoktoru || rec.DoktorAdi || '').trim();
          const roomDoc = String(rec.AltBolumAdi || rec.OdaAdi || rec.BolumAdi || '').trim();
          const time = String(rec.KayitTarihi || rec.GondermeTarihi || '').trim();
          const status = String(rec.Durum || rec.DurumAdi || '').trim();
          return {
            index: idx + 1,
            patientId: pId,
            dosyaNo: dosya,
            fullName: name,
            queueNumber: queue,
            referringDoctor: refDoc,
            assignedDoctor: roomDoc,
            registrationTime: time,
            status: status
          };
        });
      } else {
        const domRows = getAllPatientRowsFromDom();
        files = domRows.map((r, idx) => {
          const pData = extractPatientDataFromRow(r);
          return {
            index: idx + 1,
            patientId: pData.patientId,
            dosyaNo: pData.dosyaNo || '',
            fullName: pData.fullName,
            queueNumber: pData.queueNumber,
            referringDoctor: pData.referringDoctor,
            assignedDoctor: pData.assignedDoctor,
            registrationTime: `${pData.registrationDate} ${pData.registrationTime}`.trim(),
            status: ''
          };
        });
      }

      if (files.length === 0) return;

      const currentHash = files.map(f => `${f.patientId}_${f.queueNumber}_${f.assignedDoctor}`).join('|');
      if (reason === 'AUTO' && currentHash === lastFilesHash) {
        return;
      }
      lastFilesHash = currentHash;

      let logMessage = `\n================================================================================\n` +
        `[BARCHA_BEMOR_FAYLLARI] JAMI: ${files.length} TA FAYL TOPILDI (Sabab: ${reason}):\n` +
        `--------------------------------------------------------------------------------\n`;

      files.forEach(f => {
        logMessage += `  #${f.index} | ID: ${f.patientId || '-'} | FAYL: ${f.dosyaNo || '-'} | NAVBAT: ${f.queueNumber || 'Bo\'sh'} | FISH: ${f.fullName || '-'} | DAVOLOVCHI: ${f.referringDoctor || '-'} | BO'LIM: ${f.assignedDoctor || '-'} | VAQT: ${f.registrationTime || '-'}\n`;
      });
      logMessage += `================================================================================`;

      logToMe('FILES_SNAPSHOT', logMessage);
    } catch (e) {
      logToMe('FILES_SCAN_ERR', e.message);
    }
  }

  // 2.2 UTT VA BEKLEYEN NAVBATINI SERVERGA SINXRONIZATSIYA QILISH
  let lastQueueSyncHash = '';

  function parseRoomAndDoctorInfo(rawStr) {
    if (!rawStr) return { room: 'Taqsimlanmagan', num: '', doctorName: 'Noma\'lum', shortName: 'Taqsimlanmagan' };

    // 1. Ultratovush-X raqamini qidirish
    const roomMatch = rawStr.match(/ultratovush[\s-]*(\d+)/i);
    let num = '';
    let room = '';

    if (roomMatch) {
      num = roomMatch[1];
      room = `Ultratovush-${num}`;
    }

    // 2. Qavs ichidagi ismni ajratish: Ultratovush-4(Ziyayeva Zarina Abduganiyevna)
    let doctorName = '';
    let shortName = '';
    const parenMatch = rawStr.match(/\(([^)]+)\)/);
    if (parenMatch) {
      doctorName = parenMatch[1].trim();
      const parts = doctorName.split(/\s+/);
      shortName = parts[0] || doctorName;
    }

    // 3. Agar DOCTORS ro'yxatida bo'lsa
    if (num && DOCTORS[num]) {
      const d = DOCTORS[num];
      room = d.room;
      if (!doctorName) doctorName = d.fullName;
      if (!shortName) shortName = d.shortName;
    } else if (num === '10' && DOCTORS['0']) {
      const d = DOCTORS['0'];
      room = d.room;
      if (!doctorName) doctorName = d.fullName;
      if (!shortName) shortName = d.shortName;
    }

    if (!room) room = rawStr.substring(0, 30);
    if (!doctorName) doctorName = room;
    if (!shortName) shortName = doctorName.split(/\s+/)[0] || doctorName;

    return { room, num, doctorName, shortName };
  }

  function extractTimeAndMinutes(rawTime) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const curDate = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
    const curTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (!rawTime) {
      return { timeStr: curTime, dateStr: curDate, minutes: 99999 };
    }

    let timeStr = curTime;
    let dateStr = curDate;

    // Masalan: "08.09.2026 07:31" yoki "2026-09-08T07:31:00"
    const timeMatch = rawTime.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      timeStr = `${pad(timeMatch[1])}:${timeMatch[2]}`;
    }

    const dateMatch = rawTime.match(/(\d{2}\.\d{2}\.\d{4})/);
    if (dateMatch) {
      dateStr = dateMatch[1];
    } else {
      const isoDateMatch = rawTime.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoDateMatch) {
        dateStr = `${isoDateMatch[3]}.${isoDateMatch[2]}.${isoDateMatch[1]}`;
      }
    }

    let minutes = 99999;
    if (timeMatch) {
      minutes = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
    }

    return { timeStr, dateStr, minutes };
  }

  function syncQueueToServer(reason = 'AUTO') {
    try {
      const storeRecords = getAllPatientRecordsFromStore();
      let rawList = [];

      if (storeRecords.length > 0) {
        rawList = storeRecords;
      } else {
        const domRows = getAllPatientRowsFromDom();
        rawList = domRows.map(r => {
          const p = extractPatientDataFromRow(r);
          return {
            KimlikNo: p.patientId,
            DosyaNo: p.dosyaNo,
            AdSoyad: p.fullName,
            AltBolumAdi: p.assignedDoctor || p.assignedRoom,
            DosyaDoktoru: p.referringDoctor,
            KayitTarihi: `${p.registrationDate} ${p.registrationTime}`.trim(),
            Durum: 'Bekleyen',
            BolumuAdi: 'Ultratovush'
          };
        });
      }

      if (rawList.length === 0) return;

      // 1. Ultratovush va Bekleyen filtri
      const uttBekleyenPatients = [];

      rawList.forEach(rec => {
        const bolum = normalizeUzbekText(String(rec.BolumuAdi || rec.BolumAdi || rec.ServisAdi || ''));
        const altBolum = normalizeUzbekText(String(rec.AltBolumAdi || rec.OdaAdi || ''));
        const durum = normalizeUzbekText(String(rec.Durum || rec.DurumAdi || ''));

        // Faqat Ultratovushga tegishli bo'lganlar
        const isUtt = bolum.includes('ultratovush') || altBolum.includes('ultratovush') || bolum.includes('utt');
        // Faqat Bekleyen bo'lganlar
        const isBekleyen = durum === '' || durum.includes('bekleyen') || durum.includes('davet') || durum.includes('kutilmoqda');

        if (isUtt && isBekleyen) {
          const pId = String(rec.KimlikNo || rec.Id || rec.HastaId || '').trim();
          const dosya = String(rec.DosyaNo || rec.DosyaId || rec.ProtokolNo || '').trim();
          const name = `${rec.Soyadi || ''} ${rec.HastaAdi || ''} ${rec.BabaAdi || ''}`.replace(/\s+/g, ' ').trim() || String(rec.AdSoyad || '').trim();
          const refDoc = String(rec.DosyaDoktoru || rec.DoktorAdi || '').trim();
          const rawAlt = String(rec.AltBolumAdi || rec.OdaAdi || '').trim();
          const rawTime = String(rec.KayitTarihi || rec.GondermeTarihi || '').trim();

          const timeParts = extractTimeAndMinutes(rawTime);
          const roomInfo = parseRoomAndDoctorInfo(rawAlt);

          uttBekleyenPatients.push({
            patientId: pId,
            dosyaNo: dosya,
            fullName: name,
            referringDoctor: refDoc,
            rawAltBolum: rawAlt,
            room: roomInfo.room,
            roomNum: roomInfo.num,
            doctorName: roomInfo.doctorName,
            shortName: roomInfo.shortName,
            registrationTime: timeParts.timeStr,
            registrationDate: timeParts.dateStr,
            timeMinutes: timeParts.minutes,
            status: rec.Durum || 'Bekleyen'
          });
        }
      });

      // 1.5. UMUMIY NAVBAT RAQAMINI ANIQLASH (GLOBAL QUEUE NO)
      // Foydalanuvchi talabi: "navbat raqami umumiy navbat raqamidan olsin. misol bemor umumiy ro'yxatda 24 bo'lsa uni navbatini 24 deb belgilash kerak. shunda bemor o'z vrachini o'zgartirsa ham navbat raqami o'zgarmaydi."
      uttBekleyenPatients.sort((a, b) => (a.timeMinutes || 0) - (b.timeMinutes || 0));
      uttBekleyenPatients.forEach((p, idx) => {
        p.queueNo = idx + 1;
        p.globalQueueNo = idx + 1;
      });

      // 2. Vrachlar / Xonalar bo'yicha guruhlash
      const doctorsMap = {};

      Object.keys(DOCTORS).forEach(key => {
        const d = DOCTORS[key];
        doctorsMap[d.room] = {
          id: d.room,
          room: d.room,
          num: d.num,
          shortName: d.shortName,
          doctorName: d.fullName,
          kod: d.kod,
          patients: []
        };
      });

      uttBekleyenPatients.forEach(pat => {
        const rName = pat.room || 'Taqsimlanmagan';
        if (!doctorsMap[rName]) {
          doctorsMap[rName] = {
            id: rName,
            room: rName,
            num: pat.roomNum || '',
            shortName: pat.shortName || rName,
            doctorName: pat.doctorName || rName,
            patients: []
          };
        }
        doctorsMap[rName].patients.push(pat);
      });

      // 3. Har bir xona ichida bemorlarni tartiblash (lekin umumiy queueNo saqlanadi!)
      let totalAssigned = 0;
      const doctorsArray = Object.values(doctorsMap).map(doc => {
        doc.patients.sort((a, b) => (a.timeMinutes || 0) - (b.timeMinutes || 0));

        // p.queueNo umumiy navbatdagi doimiy raqam (1..N) bo'lib qoladi!
        doc.count = doc.patients.length;
        totalAssigned += doc.count;
        return doc;
      });

      const activeDoctors = doctorsArray.filter(d => d.count > 0 || DOCTORS[d.num]);

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const curDate = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

      const payload = {
        timestamp: new Date().toISOString(),
        date: curDate,
        department: "Ultratovush",
        statusFilter: "Bekleyen",
        totalPatients: uttBekleyenPatients.length,
        summary: {
          totalWaiting: uttBekleyenPatients.length,
          byDoctor: activeDoctors.reduce((acc, d) => { acc[d.room] = d.count; return acc; }, {})
        },
        doctors: activeDoctors,
        allPatients: uttBekleyenPatients
      };

      const queueHash = JSON.stringify(payload.summary) + uttBekleyenPatients.length;
      if (reason === 'AUTO' && queueHash === lastQueueSyncHash) {
        return;
      }
      lastQueueSyncHash = queueHash;

      fetch('http://127.0.0.1:9876/api/queue-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(res => res.json())
      .then(resData => {
        updateQueueBarStatus(payload.totalPatients);
      })
      .catch(() => {});

    } catch (e) {
      logToMe('QUEUE_SYNC_ERR', e.message);
    }
  }

  function updateQueueBarStatus(count) {
    const badge = document.getElementById('qbarQueueCountBadge');
    if (badge) {
      badge.textContent = `📡 Navbat: ${count} ta`;
    }
  }

  function hookStoreEvents() {
    try {
      if (window.Ext && window.Ext.getCmp) {
        const grid = Ext.getCmp('grdHastalar');
        if (grid && grid.getStore) {
          const store = grid.getStore();
          if (store && !store.__karmedLoggedHooked) {
            store.__karmedLoggedHooked = true;
            store.on('load', () => {
              logToMe('STORE_LOAD', 'Karmed grdHastalar Store yangilandi (load)');
              setTimeout(() => {
                scanAndLogAllPatientFiles('STORE_LOAD');
                syncQueueToServer('STORE_LOAD');
              }, 600);
            });
            store.on('datachanged', () => {
              logToMe('STORE_DATA_CHANGED', 'Karmed grdHastalar ma\'lumotlari o\'zgardi');
              setTimeout(() => {
                scanAndLogAllPatientFiles('STORE_DATA_CHANGED');
                syncQueueToServer('STORE_DATA_CHANGED');
              }, 600);
            });
            logToMe('STORE_HOOKED', 'Karmed grdHastalar Store hodisalariga muvaffaqiyatli ulandi');
          }
        }
      }
    } catch (e) {}
  }

  // 3. EXTENSION INITIALIZATION
  initExtension();

  function initExtension() {
    logToMe('STARTUP', 'Karmed UI Extension v4.0.0 ishga tushdi (To\'liq Fayllar, Navbat va Kunlik Log)', {
      url: window.location.href,
      isEnabled,
      isAutoPrintEnabled,
      currentPrintLang
    });

    createQuickBar();
    createToastElement();
    initRowClickListener();
    initKeyboardListener();
    initMessageListener();
    updatePowerUI();

    // Dastlabki fayllar ro'yxatini qayd etish va navbatni sinxronlash
    setTimeout(() => {
      hookStoreEvents();
      scanAndLogAllPatientFiles('STARTUP');
      syncQueueToServer('STARTUP');
    }, 1500);

    // Har 6 soniyada yangilanishlarni kuzatib borish va serverga navbatni uzatish
    setInterval(() => {
      hookStoreEvents();
      scanAndLogAllPatientFiles('AUTO_TIMER');
      syncQueueToServer('AUTO_TIMER');
    }, 6000);
  }

  // 4. POWER TOGGLE (YOQISH / O'CHIRISH - F8)
  function togglePower(explicitState = null) {
    if (explicitState !== null) {
      isEnabled = !!explicitState;
    } else {
      isEnabled = !isEnabled;
    }

    try {
      localStorage.setItem('__karmed_ext_enabled', String(isEnabled));
    } catch (e) {}

    updatePowerUI();
    const statusText = isEnabled ? "YOQILGAN" : "O'CHIRILGAN";
    logToMe('POWER_TOGGLED', `Kengaytma holati o'zgardi: ${statusText}`);
    showToast(
      isEnabled ? `⚡ Tezkor Vrach tizimi YOQILDI (0-9 faol)` : `⏸️ Tezkor Vrach tizimi VAQTINCHA TO'XTATILDI`,
      isEnabled ? 'success' : 'warn',
      2500
    );
  }

  function updatePowerUI() {
    const bar = document.getElementById('utt-quick-assign-bar');
    const pBtn = document.getElementById('qbarPowerBtn');
    const pText = document.getElementById('qbarPowerText');
    const sInd = document.getElementById('qbarStatusIndicator');
    const sTxt = document.getElementById('qbarStatusText');

    if (bar) {
      bar.classList.toggle('power-off', !isEnabled);
    }
    if (pBtn && pText) {
      pBtn.className = `qbar-power-btn ${isEnabled ? 'power-on' : 'power-off'}`;
      pText.textContent = isEnabled ? 'Yoqilgan' : 'O\'chirilgan';
    }
    if (sInd && sTxt) {
      sInd.className = `qbar-status-indicator ${isEnabled ? 'status-active' : 'status-inactive'}`;
      sTxt.textContent = isEnabled ? 'Faol (0-9 tayyor)' : 'To\'xtatilgan (F8)';
    }
  }

  function initMessageListener() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'GET_POWER_STATUS') {
          sendResponse({ isEnabled });
        } else if (request.action === 'TOGGLE_POWER') {
          togglePower();
          sendResponse({ isEnabled });
        }
      });
    }
  }

  // 5. QATOR TANLASHNI VA HARAKATLARNI KUZATISH
  function initRowClickListener() {
    document.addEventListener('click', (e) => {
      let tr = e.target.closest('tr, .x-grid-item');
      if (tr) {
        // Agar guruh sarlavhasi (masalan "Ultratovush (4)") bosilgan bo'lsa, uning ostidagi 1-bemor qatorini olamiz
        if (isGroupHeaderRow(tr)) {
          logToMe('ACTION_CLICK', 'Guruh sarlavhasi bosildi, 1-bemor qatori qidirilmoqda...');
          const nextStudy = findFirstStudyRowAfter(tr);
          if (nextStudy) {
            tr = nextStudy;
          } else {
            return;
          }
        }

        if (isStudyRow(tr)) {
          setActiveRow(tr);
          lastPatientData = extractPatientDataFromRow(tr);
          logToMe('FILE_SELECTED', `Bemor fayli tanlandi: [ID: ${lastPatientData.patientId || '-'}] [FAYL: ${lastPatientData.dosyaNo || '-'}] [NAVBAT: ${lastPatientData.queueNumber || 'Bo\'sh'}] [FISH: ${lastPatientData.fullName || '-'}] [DAVOLOVCHI: ${lastPatientData.referringDoctor || '-'}] [BO'LIM: ${lastPatientData.assignedDoctor || '-'}] [SANA/VAQT: ${lastPatientData.registrationDate} ${lastPatientData.registrationTime}]`);
          return;
        }
      }

      // Agar boshqa tugma yoki menyu bosilgan bo'lsa, harakatni logger.me ga qayd etamiz
      const clickable = e.target.closest('button, .x-btn, .x-menu-item, a, .x-tab');
      if (clickable) {
        const desc = (clickable.innerText || clickable.title || clickable.id || '').replace(/\s+/g, ' ').trim().substring(0, 60);
        if (desc && !clickable.closest('#utt-quick-assign-bar')) {
          logToMe('ACTION_CLICK', `Foydalanuvchi bosdi: [${desc}]`);
        }
      }
    }, { capture: true, signal });
  }

  function isGroupHeaderRow(el) {
    if (!el) return false;
    if (el.classList.contains('x-grid-group-hd') || el.closest('.x-grid-group-hd')) return true;
    if (el.querySelector('.x-grid-group-hd, .x-grid-group-title')) return true;
    const txt = (el.innerText || '').trim();
    if (/^ultratovush\s*\(\d+\)$/i.test(txt) || /^mrt\s*\(\d+\)$/i.test(txt)) return true;
    return false;
  }

  function findFirstStudyRowAfter(headerRow) {
    let next = headerRow.nextElementSibling;
    while (next) {
      if (isStudyRow(next)) return next;
      if (isGroupHeaderRow(next)) break;
      next = next.nextElementSibling;
    }
    return null;
  }

  function isStudyRow(tr) {
    if (!tr) return false;
    // Guruh sarlavhalarini chiqarib tashlaymiz!
    if (isGroupHeaderRow(tr)) return false;

    if (tr.querySelector('th')) return false;
    if (tr.closest('#utt-quick-assign-bar, #karmed-assign-toast, .dxpcLite, div[id*="Popup"]')) return false;

    // Doctor modal ichidagi qatorlar bemor qatori emas!
    if (tr.closest('.x-window, [role="dialog"]') && !tr.closest('#grdHastalar')) return false;

    const cells = Array.from(tr.querySelectorAll('td'));
    if (cells.length < 3) return false;

    const text = tr.innerText.toLowerCase();
    // Haqiqiy bemor qatori ekanligini tasdiqlovchi belgilar:
    if (text.includes('bekleyen') || text.includes('davet') || text.includes('normal') || /\b\d{4,9}\b/.test(text)) {
      return true;
    }
    if (text.includes('ultratovush') || text.includes('dr.') || text.includes('mrt') || text.includes('rentgen')) {
      return true;
    }
    return false;
  }

  function setActiveRow(tr) {
    if (lastSelectedRow && lastSelectedRow !== tr) {
      lastSelectedRow.classList.remove('karmed-active-study-row');
    }
    lastSelectedRow = tr;
    lastSelectedRow.classList.add('karmed-active-study-row');
  }

  function getSelectedStudyRow() {
    // 1. ExtJS grdHastalar SelectionModel orqali tekshirish
    try {
      if (window.Ext && window.Ext.getCmp) {
        const grid = Ext.getCmp('grdHastalar');
        if (grid && grid.getSelectionModel) {
          const sm = grid.getSelectionModel();
          const rec = sm.getLastSelected ? sm.getLastSelected() : (sm.getSelection ? sm.getSelection()[0] : null);
          if (rec) {
            const view = grid.getView ? grid.getView() : null;
            if (view && view.getNode) {
              const node = view.getNode(rec);
              if (node && !isGroupHeaderRow(node) && isElementVisible(node)) {
                setActiveRow(node);
                return node;
              }
            }
          }
        }
      }
    } catch (e) {}

    // 2. Oxirgi bosilgan faol qator
    if (lastSelectedRow && document.body.contains(lastSelectedRow) && isElementVisible(lastSelectedRow) && !isGroupHeaderRow(lastSelectedRow)) {
      return lastSelectedRow;
    }

    // 3. ExtJS tomonidan belgilangan qator (.x-grid-item-selected)
    const extSelected = document.querySelectorAll('#grdHastalar .x-grid-item-selected, #grdHastalar tr.x-grid-row-selected');
    for (const sel of extSelected) {
      if (!isGroupHeaderRow(sel) && isStudyRow(sel) && isElementVisible(sel)) {
        setActiveRow(sel);
        return sel;
      }
    }

    // 4. Bemorlar jadvalining ko'rinib turgan birinchi haqiqiy bemor qatori (1-qator!)
    const gridContainer = document.getElementById('grdHastalar') || document.querySelector('.x-grid');
    if (gridContainer) {
      const rows = Array.from(gridContainer.querySelectorAll('tr, .x-grid-item'));
      for (const r of rows) {
        if (isGroupHeaderRow(r)) continue;
        if (!isStudyRow(r) || !isElementVisible(r)) continue;
        setActiveRow(r);
        return r;
      }
    }

    return null;
  }

  // 6. KLAVIATURA TINGLOVCHISI (0-9 VA F8)
  function initKeyboardListener() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'F8' || e.code === 'F8') {
        e.preventDefault();
        e.stopPropagation();
        logToMe('ACTION_KEY', 'Klaviaturadan [F8] bosildi: Kengaytmani Yoqish / O\'chirish');
        togglePower();
        return;
      }

      if (!isEnabled) return;

      if (e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Agar o'zgartirish sababi modal oynasi ochiq bo'lsa, asosiy sahifadagi 0-9 va P ishlamasin!
      if (document.getElementById('karmed-reason-modal-overlay')) {
        return;
      }

      const active = document.activeElement;
      if (active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT' ||
        active.isContentEditable ||
        active.getAttribute('role') === 'textbox' ||
        active.getAttribute('role') === 'searchbox'
      )) {
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // P tugmasi: Tanlangan bemor talonini chop etish (XPrinter)
      if (e.key === 'p' || e.key === 'P' || e.code === 'KeyP') {
        e.preventDefault();
        e.stopPropagation();
        logToMe('ACTION_KEY', 'Klaviaturadan [P] bosildi: Tanlangan bemor fayli talonini chop etish');
        printQueueTicketForActiveRow();
        return;
      }

      let digit = null;
      if (/^[0-9]$/.test(e.key)) {
        digit = e.key;
      } else if (e.code && /^Numpad[0-9]$/.test(e.code)) {
        digit = e.code.replace('Numpad', '');
      }

      if (digit !== null && DOCTORS[digit]) {
        e.preventDefault();
        e.stopPropagation();
        const doc = DOCTORS[digit];
        logToMe('ACTION_KEY', `Klaviaturadan [${digit}] bosildi: ${doc.room} (${doc.shortName}) biriktirish boshlanmoqda`);
        assignDoctorByNumber(digit);
      }
    }, { capture: true, signal });
  }

  // 7. KO'P MODAL OYNALARNI ANIQLASH (2 TA OYNA OCHILGANLIGINI TEKSHIRISH)
  function getAllDoctorModals() {
    const modals = [];

    // A. ExtJS orqali ko'rish
    try {
      if (window.Ext && Ext.ComponentQuery) {
        const wins = Ext.ComponentQuery.query('window');
        for (const w of wins) {
          if (!w.isVisible || !w.isVisible()) continue;
          const txt = normalizeUzbekText(w.getTitle ? w.getTitle() : (w.title || ''));
          if (txt.includes('pastdagi') || txt.includes('bolim') || txt.includes('soralmoqda')) {
            modals.push({ type: 'ext', win: w, dom: w.el ? w.el.dom : null, id: w.id });
          }
        }
      }
    } catch (e) {}

    // B. DOM orqali ko'rish
    const domWins = Array.from(document.querySelectorAll('.x-window, .dxpcLite, div[role="dialog"]'));
    for (const dw of domWins) {
      if (!isElementVisible(dw)) continue;
      const txt = normalizeUzbekText(dw.innerText || '');
      if (txt.includes('pastdagi bolimlar') || txt.includes('bolimlar royxati') || txt.includes('soralmoqda')) {
        if (!modals.some(m => m.dom === dw)) {
          modals.push({ type: 'dom', win: null, dom: dw, id: dw.id || 'dom-win' });
        }
      }
    }

    return modals;
  }

  // 7.1 BEMOR VRACHI O'ZGARTIRILAYOTGANLIGINI TEKSHIRISH
  function checkIfDoctorChanged(patientData, targetDoc) {
    if (!patientData || !targetDoc) return false;
    const currentDocStr = (patientData.assignedDoctor || '').trim();
    const currentRoom = (patientData.assignedRoom || '').trim();
    const currentNum = (patientData.doctorNum || '').trim();

    // Agar avval biriktirilmagan bo'lsa (bo'sh, '-', '0' yoki noma'lum)
    if (!currentDocStr || currentDocStr === '-' || currentDocStr === '0' || currentDocStr === 'null') {
      return false;
    }

    // Biriktirilganligini ko'rsatuvchi belgilar:
    const hasPriorAssignment = /ultratovush/i.test(currentDocStr) || 
                               /dr\./i.test(currentDocStr) || 
                               currentRoom.length > 0 || 
                               currentNum.length > 0 ||
                               Object.values(DOCTORS).some(d => normalizeUzbekText(currentDocStr).includes(normalizeUzbekText(d.shortName)));

    if (!hasPriorAssignment) return false;

    // Agar ayni shu vrachga qayta bosilgan bo'lsa (o'zgarish yo'q)
    if (currentNum && String(currentNum) === String(targetDoc.num)) return false;
    if (currentRoom && normalizeUzbekText(currentRoom) === normalizeUzbekText(targetDoc.room)) return false;
    if (normalizeUzbekText(currentDocStr).includes(normalizeUzbekText(targetDoc.shortName))) return false;

    return true;
  }

  // 7.2 VRACH O'ZGARTIRILGANDA IZOH TANLASH MODAL OYNASI (1, 2, 3)
  function promptDoctorChangeReason(patientData, targetDoc) {
    return new Promise((resolve) => {
      const existing = document.getElementById('karmed-reason-modal-overlay');
      if (existing) existing.remove();

      const overlay = document.createElement('div');
      overlay.id = 'karmed-reason-modal-overlay';

      const currentDocDisplay = patientData.assignedDoctor || patientData.assignedRoom || 'Oldingi vrach';
      const patId = patientData.patientId || '-';
      const patName = patientData.fullName || 'Bemor';

      overlay.innerHTML = `
        <div class="karmed-reason-modal-card" role="dialog" aria-modal="true">
          <div class="karmed-reason-modal-header">
            <div class="karmed-reason-modal-title">🔄 VRACHNI O'ZGARTIRISH IZOHI</div>
            <button type="button" class="karmed-reason-close-btn" id="reasonCloseBtn" title="Yopish (Esc)">✕</button>
          </div>
          <div class="karmed-reason-patient-info">
            <div><b>Bemor:</b> ${escapeHtml(patName)} (ID: <b>${escapeHtml(patId)}</b>)</div>
            <div class="karmed-reason-route">
              <span>${escapeHtml(currentDocDisplay)}</span>
              <span class="reason-arrow">➔</span>
              <span style="font-weight: 800; color: #1e40af;">${escapeHtml(targetDoc.room)} (${escapeHtml(targetDoc.shortName)})</span>
            </div>
          </div>
          <div class="karmed-reason-section-title">O'zgartirish sababini tanlang (1, 2, 3 yoki bosing):</div>

          <!-- 1. BEMOR O'Z XOXISHI BILAN -->
          <div class="karmed-reason-option" id="optReason1" tabindex="0">
            <div class="reason-opt-header">
              <span class="reason-key-badge">1</span>
              <span class="reason-opt-name">Bemor o'z xoxishi bilan</span>
            </div>
            <div class="reason-opt-desc">
              Talon izohi: <i>«bemor o'z xoxishi bilan UTT vrachini tanladi va vrachni kutishga rozi.»</i>
            </div>
          </div>

          <!-- 2. VRACH ILTIMOSI -->
          <div class="karmed-reason-option" id="optReason2" tabindex="0">
            <div class="reason-opt-header">
              <span class="reason-key-badge">2</span>
              <span class="reason-opt-name">Vrach iltimosi</span>
            </div>
            <div class="reason-opt-desc">
              Qaysi vrach iltimos qilganligini kiriting:
            </div>
            <div class="reason-extra-input-wrap" id="wrapDocInput" style="display: none;">
              <input type="text" class="reason-input" id="reasonDocInput" placeholder="Masalan: Dr. Karimov, Onkolog vrach..." />
              <button type="button" class="reason-confirm-sub-btn" id="btnConfirmDoc">Tasdiqlash ↵</button>
            </div>
          </div>

          <!-- 3. BOSHQA SABAB -->
          <div class="karmed-reason-option" id="optReason3" tabindex="0">
            <div class="reason-opt-header">
              <span class="reason-key-badge">3</span>
              <span class="reason-opt-name">Boshqa sabab</span>
            </div>
            <div class="reason-opt-desc">
              O'zgartirish sababini yozing:
            </div>
            <div class="reason-extra-input-wrap" id="wrapOtherInput" style="display: none;">
              <input type="text" class="reason-input" id="reasonOtherInput" placeholder="Masalan: Qayta ko'rik, Konsultatsiya, Shoshilinch..." />
              <button type="button" class="reason-confirm-sub-btn" id="btnConfirmOther">Tasdiqlash ↵</button>
            </div>
          </div>

          <div class="karmed-reason-footer">
            <button type="button" class="reason-cancel-btn" id="reasonCancelBtn">Bekor qilish (Esc)</button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      let isResolved = false;
      function finish(result) {
        if (isResolved) return;
        isResolved = true;
        window.removeEventListener('keydown', handleGlobalKey, true);
        overlay.remove();
        resolve(result);
      }

      const opt1 = overlay.querySelector('#optReason1');
      const opt2 = overlay.querySelector('#optReason2');
      const opt3 = overlay.querySelector('#optReason3');
      const wrapDoc = overlay.querySelector('#wrapDocInput');
      const wrapOther = overlay.querySelector('#wrapOtherInput');
      const inputDoc = overlay.querySelector('#reasonDocInput');
      const inputOther = overlay.querySelector('#reasonOtherInput');
      const btnDoc = overlay.querySelector('#btnConfirmDoc');
      const btnOther = overlay.querySelector('#btnConfirmOther');
      const closeBtn = overlay.querySelector('#reasonCloseBtn');
      const cancelBtn = overlay.querySelector('#reasonCancelBtn');

      // 1-variant
      function chooseOption1() {
        finish({
          optionType: 'patient_request',
          reasonText: "bemor o'z xoxishi bilan UTT vrachini tanladi va vrachni kutishga rozi."
        });
      }

      // 2-variant
      function activateOption2() {
        opt1.classList.remove('selected');
        opt3.classList.remove('selected');
        wrapOther.style.display = 'none';
        opt2.classList.add('selected');
        wrapDoc.style.display = 'flex';
        inputDoc.focus();
      }

      function confirmOption2() {
        const val = (inputDoc.value || '').trim();
        const docLabel = val || "Vrach";
        finish({
          optionType: 'doctor_request',
          doctorName: val,
          reasonText: `${docLabel} iltimosi bilan UTT vrachini tanladi va vrachni kutishga rozi.`
        });
      }

      // 3-variant
      function activateOption3() {
        opt1.classList.remove('selected');
        opt2.classList.remove('selected');
        wrapDoc.style.display = 'none';
        opt3.classList.add('selected');
        wrapOther.style.display = 'flex';
        inputOther.focus();
      }

      function confirmOption3() {
        const val = (inputOther.value || '').trim();
        const reasonLabel = val || "Boshqa sabab";
        finish({
          optionType: 'other_reason',
          customReason: val,
          reasonText: `${reasonLabel} bilan UTT vrachini tanladi va vrachni kutishga rozi.`
        });
      }

      opt1.addEventListener('click', (e) => {
        e.stopPropagation();
        chooseOption1();
      });

      opt2.addEventListener('click', (e) => {
        e.stopPropagation();
        activateOption2();
      });

      btnDoc.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmOption2();
      });

      inputDoc.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          confirmOption2();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(null);
        }
      });

      opt3.addEventListener('click', (e) => {
        e.stopPropagation();
        activateOption3();
      });

      btnOther.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmOption3();
      });

      inputOther.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          confirmOption3();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(null);
        }
      });

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        finish(null);
      });

      cancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        finish(null);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          finish(null);
        }
      });

      function handleGlobalKey(e) {
        if (document.activeElement === inputDoc || document.activeElement === inputOther) {
          return;
        }

        if (e.key === '1') {
          e.preventDefault();
          e.stopPropagation();
          chooseOption1();
        } else if (e.key === '2') {
          e.preventDefault();
          e.stopPropagation();
          activateOption2();
        } else if (e.key === '3') {
          e.preventDefault();
          e.stopPropagation();
          activateOption3();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(null);
        }
      }

      window.addEventListener('keydown', handleGlobalKey, true);
    });
  }

  // 8. ASOSIY AVTOMATLASHTIRISH TIZIMI
  async function assignDoctorByNumber(digit) {
    const doc = DOCTORS[digit];
    if (!doc) return;

    if (!isEnabled) {
      showToast(`⚠️ Kengaytma o'chirilgan. Yoqish uchun F8 tugmasini bosing!`, 'warn', 3000);
      return;
    }

    // 1. QAT'IY QULFLASH (MUTEX LOCK)
    if (isAssigning) {
      logToMe('DROP_DUPLICATE_BUSY', `[${digit}] bekor qilindi — Hozir boshqa biriktirish jarayoni ketmoqda!`);
      showToast(`⏳ Hozir biriktirish bajarilmoqda, kuting...`, 'warn', 1500);
      return;
    }

    // 2. COOLDOWN TEKSHIRUVI
    const timeSinceLast = Date.now() - lastAssignEndTime;
    if (timeSinceLast < COOLDOWN_MS) {
      logToMe('DROP_DUPLICATE_COOLDOWN', `[${digit}] bekor qilindi — Cooldown faol (${timeSinceLast}ms < ${COOLDOWN_MS}ms)`);
      return;
    }

    // 3. EKRANDA NECHTA MODAL OYNA BORLIGINI TEKSHIRISH
    const openModals = getAllDoctorModals();
    logToMe('MODAL_COUNT_CHECK', `Jarayon boshida ochiq modallar soni: ${openModals.length} ta`, openModals.map(m => m.id));
    if (openModals.length >= 2) {
      logToMe('MULTIPLE_MODALS_DETECTED', `DIQQAT: 2 ta yoki undan ortiq modal oyna aniqlandi (${openModals.length} ta)! Ortiqchalari tozalanmoqda...`);
      // Ortiqchalarini yopib, faqat 1 tasini qoldiramiz yoki barchasini tozalaymiz
      closeAllDoctorModals();
      await sleep(200);
    }

    isAssigning = true;
    logToMe('ASSIGN_START', `>>> BIRIKTIRISH BOSHLANDI: [${digit}] ${doc.room} (${doc.shortName}), Kod: ${doc.kod}`);

    try {
      // 1-QADAM: Agar modal oyna allaqachon ekranda ochiq tursa
      const existingTable = findDoctorTableOrRow();
      if (existingTable) {
        logToMe('MODAL_ALREADY_OPEN', 'Vrachlar ro\'yxati modal jadvali allaqachon ekranda ochiq, to\'g\'ridan-to\'g\'ri tanlanmoqda');
        const activeRow = getSelectedStudyRow();
        const currentPData = extractPatientDataFromRow(activeRow, null);
        let isDoctorChanged = false;
        let changeReasonText = '';

        if (checkIfDoctorChanged(currentPData, doc)) {
          logToMe('DOCTOR_CHANGE_DETECTED', `Vrach o'zgartirilmoqda: "${currentPData.assignedDoctor || currentPData.assignedRoom}" -> "${doc.room}"`);
          const reasonResult = await promptDoctorChangeReason(currentPData, doc);
          if (!reasonResult) {
            logToMe('DOCTOR_CHANGE_ABORTED', 'Vrach o\'zgartirish bekor qilindi');
            showToast('Bekor qilindi', 'info', 1500);
            return;
          }
          isDoctorChanged = true;
          changeReasonText = reasonResult.reasonText;
          logToMe('DOCTOR_CHANGE_CONFIRMED', `O'zgartirish tasdiqlandi: [${reasonResult.optionType}] -> "${changeReasonText}"`);
        }

        const pData = extractPatientDataFromRow(activeRow, doc);
        pData.isDoctorChanged = isDoctorChanged;
        pData.changeReasonText = changeReasonText;
        lastPatientData = pData;
        await processDoctorSelection(doc, digit, pData);
        return;
      }

      // 2-QADAM: Bemor / fayl qatorini aniqlash (1-qatorni aniq olish)
      const row = getSelectedStudyRow();
      if (!row) {
        showToast(`⚠️ Iltimos, avval ro'yxatdan kerakli bemor (fayl) qatorini tanlang!`, 'warn', 3500);
        logToMe('ASSIGN_CANCEL', 'Bemor qatori tanlanmagan');
        return;
      }

      // A. Bemorning hozirgi holatini tekshiramiz (Vrach o'zgartirilayotganligini aniqlash)
      const currentPData = extractPatientDataFromRow(row, null);
      let isDoctorChanged = false;
      let changeReasonText = '';

      if (checkIfDoctorChanged(currentPData, doc)) {
        logToMe('DOCTOR_CHANGE_DETECTED', `Vrach o'zgartirilmoqda: "${currentPData.assignedDoctor || currentPData.assignedRoom}" -> "${doc.room}"`);
        const reasonResult = await promptDoctorChangeReason(currentPData, doc);
        if (!reasonResult) {
          logToMe('DOCTOR_CHANGE_ABORTED', 'Foydalanuvchi vrach o\'zgartirish sababi oynasini bekor qildi');
          showToast('Bekor qilindi', 'info', 1500);
          return;
        }
        isDoctorChanged = true;
        changeReasonText = reasonResult.reasonText;
        logToMe('DOCTOR_CHANGE_CONFIRMED', `O'zgartirish tasdiqlandi: [${reasonResult.optionType}] -> "${changeReasonText}"`);
      }

      // B. Bemor ma'lumotlarini o'qib olamiz (XPrinter taloni uchun)
      const patientData = extractPatientDataFromRow(row, doc);
      patientData.isDoctorChanged = isDoctorChanged;
      patientData.changeReasonText = changeReasonText;
      lastPatientData = patientData;

      logToMe('PATIENT_DATA_EXTRACTED', 'Talon uchun ma\'lumotlar olindi:', {
        patientId: patientData.patientId,
        fullName: patientData.fullName,
        queueNumber: patientData.queueNumber,
        isQueueEmpty: patientData.isQueueEmpty,
        isDoctorChanged: patientData.isDoctorChanged,
        changeReasonText: patientData.changeReasonText
      });

      const rowText = row.innerText.replace(/\s+/g, ' ').trim().substring(0, 80);
      logToMe('ROW_CONFIRMED', `Tanlangan bemor qatori: ${rowText}`);
      showToast(`🔄 [${digit}] ${doc.shortName} biriktirilmoqda...`, 'info', 2500);

      // A. Qatorga sichqoncha o'ng tugmasini (contextmenu) bosish (ko'rinib turgan katakka)
      triggerRightClick(row);
      logToMe('RIGHT_CLICK_SENT', 'Qatorga o\'ng tugma yuborildi');

      // B. Kontekst menyu chiqishini kutish va «Pastdagi bo'limlarni o'zgartir» ni bosish
      const menuItem = await waitForContextMenuItem(3500);
      if (!menuItem) {
        const tableCheck = findDoctorTableOrRow();
        if (!tableCheck) {
          showToast(`❌ Kontekst menyu chiqmadi. Qator ustiga o'ng tugmani bosing!`, 'error', 3500);
          logToMe('MENU_TIMEOUT', 'Kontekst menyu chiqmadi');
          return;
        }
      } else {
        logToMe('MENU_ITEM_CLICKING', '«Pastdagi bo\'limlarni o\'zgartir» bosilmoqda');
        clickMenuItem(menuItem);
      }

      // C. «Pastdagi bo'limlar ro'yxati so'ralmoqda...» modal oynasini kutish (8 soniyagacha)
      logToMe('WAITING_MODAL', 'Vrachlar ro\'yxati modal jadvali ochilishi kutilmoqda (max 8s)...');
      const doctorTable = await waitForDoctorTable(8000);
      if (!doctorTable) {
        showToast(`❌ Bo'limlar ro'yxati oynasi ochilmadi!`, 'error', 3500);
        logToMe('MODAL_TIMEOUT', 'Modal jadval 8 soniyada ochilmadi');
        return;
      }

      // D. Modal ichidan vrachni tanlash, [Ok] ni bosish va barcha modallarni avtomatik yopish
      await processDoctorSelection(doc, digit, patientData);

    } catch (err) {
      console.error('[Karmed Quick Assign Error]:', err);
      logToMe('ASSIGN_ERROR', `Xatolik yuz berdi: ${err.message}`);
      showToast(`⚠️ Xatolik yuz berdi: ${err.message}`, 'error', 3500);
    } finally {
      lastAssignEndTime = Date.now();
      setTimeout(() => {
        isAssigning = false;
        logToMe('LOCK_RELEASED', 'Kengaytma qulfi yechildi, yangi buyruqqa tayyor.');
      }, COOLDOWN_MS);
    }
  }

  // 9. SICHQONCHA O'NG TUGMASI (CONTEXTMENU) — GORIZONTAL SKROLLDA HAM ANIQ KO'RINADIGAN KATAKKA
  function triggerRightClick(row) {
    const cells = Array.from(row.querySelectorAll('td'));

    // Ekranda haqiqatda ko'rinib turgan katakni topamiz (gorizontal skroll qilingan bo'lsa ham)
    let targetCell = null;
    const viewW = window.innerWidth || document.documentElement.clientWidth || 1000;

    for (const c of cells) {
      const rect = c.getBoundingClientRect();
      // Katak viewport ichida bo'lishi shart:
      if (rect.width > 20 && rect.height > 10 && rect.left >= 10 && rect.right <= (viewW - 20)) {
        targetCell = c;
        break;
      }
    }

    if (!targetCell && cells.length > 0) {
      targetCell = cells[Math.min(3, cells.length - 1)];
    }
    if (!targetCell) targetCell = row;

    const rect = targetCell.getBoundingClientRect();
    const clientX = Math.max(10, Math.min(viewW - 10, rect.left + rect.width / 2));
    const clientY = Math.max(10, rect.top + rect.height / 2);

    const eventOpts = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 2,
      buttons: 2,
      clientX,
      clientY
    };

    targetCell.dispatchEvent(new MouseEvent('mousedown', eventOpts));
    targetCell.dispatchEvent(new MouseEvent('mouseup', eventOpts));
    targetCell.dispatchEvent(new MouseEvent('contextmenu', eventOpts));

    if (targetCell !== row) {
      row.dispatchEvent(new MouseEvent('contextmenu', eventOpts));
    }

    // ExtJS Grid rowcontextmenu va itemcontextmenu ni to'g'ridan-to'g'ri chaqirish
    try {
      if (window.Ext && window.Ext.getCmp) {
        const grid = Ext.getCmp('grdHastalar');
        if (grid) {
          const view = grid.getView ? grid.getView() : null;
          const sm = grid.getSelectionModel ? grid.getSelectionModel() : null;
          const rec = sm ? (sm.getLastSelected ? sm.getLastSelected() : sm.getSelection()[0]) : null;
          if (view) {
            const item = (rec && view.getNode ? view.getNode(rec) : null) || row;
            const index = view.indexOf ? view.indexOf(item) : 0;
            const extEvt = new Ext.event.Event({
              type: 'contextmenu',
              target: targetCell,
              pageX: clientX,
              pageY: clientY,
              clientX: clientX,
              clientY: clientY,
              button: 2
            });

            if (rec) {
              view.fireEvent('itemcontextmenu', view, rec, item, index, extEvt);
            }
            view.fireEvent('rowcontextmenu', view, index, extEvt);
          }
        }
      }
    } catch (e) {
      logToMe('EXT_CONTEXT_DIRECT_ERR', e.message);
    }
  }

  // 10. KONTEKST MENYUDAN «PASTDAGI BO'LIMLARNI O'ZGARTIR» BANDINI TOPISH
  function waitForContextMenuItem(maxWaitMs = 3500) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const item = findContextMenuItem();
        if (item) {
          clearInterval(interval);
          resolve(item);
          return;
        }
        if (Date.now() - startTime > maxWaitMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 35);
    });
  }

  function findContextMenuItem() {
    try {
      if (window.Ext && Ext.ComponentQuery) {
        const items = Ext.ComponentQuery.query('menuitem');
        for (const it of items) {
          if (!it.el || !it.el.dom || !isElementVisible(it.el.dom)) continue;
          const text = normalizeUzbekText(it.text || '');
          if (text.includes("pastdagi") && (text.includes("bolim") || text.includes("ozgartir"))) {
            return { extItem: it, domEl: it.el.dom };
          }
        }
      }
    } catch (e) {}

    const elements = Array.from(document.querySelectorAll('div, span, td, a, li, b, p'));
    for (const el of elements) {
      if (el.children.length > 2) continue;
      if (!isElementVisible(el)) continue;
      const text = normalizeUzbekText(el.innerText || '');
      if (
        text.includes("pastdagi bolimlarni ozgartir") ||
        (text.includes("pastdagi") && text.includes("ozgartir")) ||
        (text.includes("pastdagi") && text.includes("bolim"))
      ) {
        const clickable = el.closest('.x-menu-item, .dxm-item, tr, li, a, td, div') || el;
        if (isElementVisible(clickable)) {
          return { extItem: null, domEl: clickable };
        }
      }
    }
    return null;
  }

  function clickMenuItem(menuItem) {
    if (!menuItem) return;
    if (menuItem.extItem) {
      const it = menuItem.extItem;
      if (typeof it.fireHandler === 'function') it.fireHandler();
      else if (it.handler) it.handler.call(it.scope || it, it);
      else if (it.fireEvent) it.fireEvent('click', it);
    }
    if (menuItem.domEl) {
      clickElement(menuItem.domEl);
    }
  }

  // 11. «PASTDAGI BO'LIMLAR RO'YXATI...» JADVALINI ANIQ TOPISH
  function waitForDoctorTable(maxWaitMs = 8000) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const table = findDoctorTableOrRow();
        if (table) {
          clearInterval(interval);
          resolve(table);
          return;
        }
        if (Date.now() - startTime > maxWaitMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 50);
    });
  }

  function findDoctorTableOrRow() {
    const tables = Array.from(document.querySelectorAll('table, .x-grid-table, .x-grid-view, .dxgvTable'));
    for (const tbl of tables) {
      if (!isElementVisible(tbl)) continue;

      const txt = (tbl.innerText || '').toLowerCase();
      if (txt.includes('bemor id') || txt.includes('familiya') || txt.includes('faylning shifokorini')) {
        continue;
      }

      const win = tbl.closest('.x-window, .dxpcLite, div[role="dialog"], div[id*="Popup"], div[style*="z-index"]');
      if (!win) continue;

      const hasRooms = (
        (txt.includes('ultratovush-1') || txt.includes('ultratovush 1')) &&
        (txt.includes('ultratovush-2') || txt.includes('ultratovush 2'))
      ) || (txt.includes('bolum alt') || txt.includes('bölüm alt'));

      if (hasRooms && (txt.includes('kurbanova') || txt.includes('juravlev') || txt.includes('asadova') || txt.includes('xusanova'))) {
        return tbl;
      }
    }

    const headers = Array.from(document.querySelectorAll('div, span, td, b, h1, h2, h3, h4'));
    for (const h of headers) {
      if (!isElementVisible(h)) continue;
      const t = normalizeUzbekText(h.innerText || '');
      if (t.includes("pastdagi bolimlar") || t.includes("bolimlar royxati") || t.includes("soralmoqda")) {
        const win = h.closest('.x-window, .dxpcLite, div[role="dialog"], div[style*="z-index"]');
        if (win && isElementVisible(win)) {
          return win;
        }
      }
    }

    return null;
  }

  // 12. VRACHLAR EXTJS GRIDINI ANIQLASH
  function findDoctorExtGrid() {
    if (!window.Ext || !Ext.ComponentQuery) return null;

    try {
      const grids = Ext.ComponentQuery.query('grid');
      for (const g of grids) {
        if (!g.isVisible || !g.isVisible()) continue;
        if (g.id === 'grdHastalar' || g.id === 'grdHizmetler' || g.id === 'grdEskiRaporlar') continue;

        if (g.getStore && g.getStore()) {
          const store = g.getStore();
          let hasDoctorRecord = false;
          store.each(rec => {
            const d = rec.data || {};
            const k = String(d.Kod || d.kod || d.AltBolumId || '');
            if (k === '13' || k === '15' || k === '32' || k === '35' || k === '18') {
              hasDoctorRecord = true;
              return false;
            }
          });
          if (hasDoctorRecord) {
            return g;
          }
        }
      }
    } catch (e) {
      logToMe('EXT_GRID_SEARCH_ERR', e.message);
    }
    return null;
  }

  // 13. MODAL ICHIDA VRACHNI TANLASH, [OK] BOSISH VA BARCHA MODALLARNI TO'LIQ YOPISH
  async function processDoctorSelection(doc, digit, patientData = null) {
    logToMe('PROCESS_SELECTION', `Tanlov boshlandi: [${digit}] ${doc.room} (${doc.shortName}), Kod: ${doc.kod}`);

    let extSelected = false;

    // A. EXTJS SELECTIONMODEL ORQALI ANIQ TANLASH
    const extGrid = findDoctorExtGrid();
    if (extGrid && extGrid.getStore) {
      const store = extGrid.getStore();
      let matchedRecord = null;
      let matchedIndex = -1;

      store.each((rec, idx) => {
        const data = rec.data || {};
        const recKod = String(data.Kod || data.kod || data.AltBolumId || data.Id || '').trim();
        if (recKod === String(doc.kod)) {
          matchedRecord = rec;
          matchedIndex = idx;
          return false;
        }

        const recText = normalizeUzbekText(String(data.BolumAlt || data.AltBolumAdi || data.Adi || data.Name || ''));
        for (const alias of doc.aliases) {
          if (recText.includes(normalizeUzbekText(alias))) {
            matchedRecord = rec;
            matchedIndex = idx;
            return false;
          }
        }
      });

      if (matchedRecord) {
        logToMe('EXT_RECORD_FOUND', `ExtJS Record topildi: Kod ${doc.kod}, Index: ${matchedIndex}`, matchedRecord.data);
        const sm = extGrid.getSelectionModel();
        if (sm) {
          if (sm.deselectAll) sm.deselectAll();
          if (sm.select) sm.select(matchedRecord, false, false);
          extSelected = true;
          logToMe('EXT_SELECTED_SUCCESS', `ExtJS SelectionModel tanlandi: Kod ${doc.kod}`);
        }
        if (extGrid.getView && extGrid.getView().focusRow) {
          extGrid.getView().focusRow(matchedIndex);
        }
      } else {
        logToMe('EXT_RECORD_NOT_FOUND', `ExtJS Store'dan vrach topilmadi: Kod ${doc.kod}`);
      }
    } else {
      logToMe('EXT_GRID_NOT_FOUND', 'Vrachlar ExtJS Gridi topilmadi, DOM orqali davom etiladi');
    }

    // B. DOM ORQALI QATOR VA CHECKBOXNI ANIQ TANLASH
    const domRow = await findDoctorRowWithRetry(doc, 3000);
    if (domRow) {
      const rowSnippet = domRow.innerText.replace(/\s+/g, ' ').trim().substring(0, 80);
      logToMe('DOM_ROW_FOUND', `DOM Qator topildi: ${rowSnippet}`);
      selectModalRow(domRow);
    } else if (!extSelected) {
      showToast(`❌ Ro'yxatdan ${doc.room} (${doc.shortName}) topilmadi!`, 'error', 3500);
      logToMe('ROW_NOT_FOUND_FATAL', `DOM va ExtJS dan vrach topilmadi: [${digit}] ${doc.shortName}`);
      return;
    }

    // ExtJS va DOM hodisalari to'liq qabul qilinishi uchun pauza (150ms)
    await sleep(150);

    // C. [OK] TUGMASINI BOSISH (KARMED SERVERIGA SAQLASH)
    const okClicked = clickOkButton(extGrid);
    if (okClicked) {
      logToMe('OK_CLICKED', `[${digit}] ${doc.room} (${doc.shortName}) uchun [Ok] bosildi!`);
      showToast(`🔄 [${digit}] ${doc.room} saqlanmoqda...`, 'info', 2000);

      // Tanlangan faol qatorni tozalaymiz
      if (lastSelectedRow) {
        lastSelectedRow.classList.remove('karmed-active-study-row');
        lastSelectedRow = null;
      }

      // Karmed serveriga so'rov yetib borishi va saqlanishi uchun 700ms kutamiz
      await sleep(700);

      // D. BARCHA OCHIQ MODAL OYNALARNI TO'LIQ YOPISH (1 TA YOKI 2 TA BO'LSA HAM!)
      logToMe('AUTO_CLOSING_ALL_MODALS', 'Barcha ochiq modal oynalar avtomatik yopilmoqda (Bekor qilish / [X])...');
      closeAllDoctorModals();

      // Oyna yopilishini kutish (1.5 soniya)
      await sleep(500);
      const remainingModals = getAllDoctorModals();
      if (remainingModals.length > 0) {
        logToMe('LEFTOVER_MODALS_FOUND', `Hali ham ${remainingModals.length} ta modal ochiq, qayta yopilmoqda...`);
        closeAllDoctorModals();
      }

      logToMe('ASSIGN_FINISHED_SUCCESS', `[${digit}] ${doc.room} (${doc.fullName}) muvaffaqiyatli biriktirildi va barcha oynalar yopildi!`);
      showToast(`✅ [${digit}] ${doc.room} (${doc.fullName}) biriktirildi!`, 'success', 3000);

      // E. BARCHA FAYLLAR RO'YXATINI YANGILANGAN HOLATDA LOGGER.ME GA YOZISH VA NAVBATNI SINXRONLASH
      setTimeout(() => {
        scanAndLogAllPatientFiles('AFTER_ASSIGNMENT');
        syncQueueToServer('AFTER_ASSIGNMENT');
      }, 1200);

      // F. XPRINTER NAVBAT TALONINI AVTOMATIK CHOP ETISH
      if (isAutoPrintEnabled && patientData) {
        logToMe('AUTO_PRINT_START', `Avto-chop faol, talon yuborilmoqda: ID ${patientData.patientId}`);
        setTimeout(() => {
          printThermalTicketDirect(patientData);
        }, 300);
      }
    } else {
      logToMe('OK_NOT_FOUND', 'Ok tugmasi topilmadi');
      showToast(`⚠️ [${digit}] ${doc.shortName} belgilandi, lekin Ok tugmasi topilmadi. O'zingiz Ok bosing!`, 'warn', 4000);
    }
  }

  // 14. MODAL QATORINI IZLASH VA CHECKBOXINI BOSISH
  async function findDoctorRowWithRetry(doc, maxWaitMs = 3000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const row = findDoctorRowInDOM(doc);
      if (row) return row;
      await sleep(50);
    }
    return null;
  }

  function findDoctorRowInDOM(doc) {
    const table = findDoctorTableOrRow();
    const searchRoot = table || document.body;

    const rows = Array.from(searchRoot.querySelectorAll('tr, .x-grid-item, .x-grid-row, [role="row"]'));

    // 1-Pass: Kod bo'yicha aniq tekshirish
    for (const r of rows) {
      if (!isElementVisible(r)) continue;
      const cells = Array.from(r.querySelectorAll('td, .x-grid-cell, div'));
      let kodMatched = false;
      for (const c of cells) {
        const cTxt = (c.innerText || '').trim();
        if (cTxt === String(doc.kod)) {
          kodMatched = true;
          break;
        }
      }

      if (kodMatched) {
        const rTxt = normalizeUzbekText(r.innerText || '');
        if (rTxt.includes('ultratovush') || rTxt.includes(normalizeUzbekText(doc.shortName))) {
          return r;
        }
      }
    }

    // 2-Pass: Vrach familiyasi bo'yicha
    for (const r of rows) {
      if (!isElementVisible(r)) continue;
      const rTxt = normalizeUzbekText(r.innerText || '');
      if (rTxt.includes(normalizeUzbekText(doc.shortName)) && (rTxt.includes('ultratovush') || rTxt.includes(String(doc.kod)))) {
        return r;
      }
    }

    // 3-Pass: Barcha taxalluslar bo'yicha
    for (const r of rows) {
      if (!isElementVisible(r)) continue;
      const rTxt = normalizeUzbekText(r.innerText || '');
      for (const alias of doc.aliases) {
        if (alias.length > 2 && rTxt.includes(normalizeUzbekText(alias))) {
          return r;
        }
      }
    }

    return null;
  }

  function selectModalRow(row) {
    const checker = row.querySelector('.x-grid-row-checker, .x-grid-cell-row-checker, input[type="checkbox"], .x-form-checkbox');
    if (checker) {
      clickElement(checker);
    }

    const firstCell = row.querySelector('td, .x-grid-cell');
    if (firstCell && firstCell !== checker) {
      clickElement(firstCell);
    }
    clickElement(row);
  }

  // 15. [OK] TUGMASINI ISHONCHLI BOSISH
  function clickOkButton(extGrid = null) {
    // 1. ExtJS Button orqali
    if (extGrid) {
      const win = extGrid.up ? extGrid.up('window') : null;
      if (win && win.query) {
        const buttons = win.query('button');
        for (const b of buttons) {
          const txt = normalizeUzbekText(b.text || (b.getText && b.getText()) || '');
          const iconCls = (b.iconCls || '').toLowerCase();
          if (txt === 'ok' || txt === '✓ ok' || txt.includes('ok') || iconCls.includes('accept') || iconCls.includes('check')) {
            if (!txt.includes('bekor') && !txt.includes('cancel')) {
              logToMe('OK_EXT_CLICK', `ExtJS Ok tugmasi bosildi: id=${b.id}, text=${b.text}`);
              if (typeof b.fireHandler === 'function') b.fireHandler();
              else if (b.handler) b.handler.call(b.scope || b, b);
              else if (b.fireEvent) b.fireEvent('click', b);

              if (b.btnEl && b.btnEl.dom) clickElement(b.btnEl.dom);
              else if (b.el && b.el.dom) clickElement(b.el.dom);
              return true;
            }
          }
        }
      }
    }

    // 2. DOM orqali
    const table = findDoctorTableOrRow();
    const container = table ? (table.closest('.x-window, .dxpcLite, div[role="dialog"], div[style*="z-index"]') || document.body) : document.body;

    const clickables = Array.from(container.querySelectorAll('button, a.x-btn, .x-btn, input[type="button"], [role="button"]'));
    for (const el of clickables) {
      if (!isElementVisible(el)) continue;
      const txt = normalizeUzbekText(el.innerText || el.value || '');
      if (txt === 'ok' || txt === '✓ ok' || (txt.includes('ok') && !txt.includes('bekor') && !txt.includes('cancel'))) {
        logToMe('OK_DOM_CLICK', `DOM Ok tugmasi bosildi: ${txt}`);
        clickElement(el);
        return true;
      }
    }

    const icons = Array.from(container.querySelectorAll('.x-btn-icon-el, img, svg, i'));
    for (const ic of icons) {
      if (!isElementVisible(ic)) continue;
      const cls = (ic.className || ic.src || '').toLowerCase();
      if (cls.includes('ok') || cls.includes('accept') || cls.includes('check')) {
        const btn = ic.closest('button, a, .x-btn') || ic;
        logToMe('OK_ICON_CLICK', 'Ikonkali Ok tugmasi bosildi');
        clickElement(btn);
        return true;
      }
    }

    return false;
  }

  // 16. BARCHA OCHIQ MODAL OYNALARNI TO'LIQ YOPISH (1 TA YOKI 2 TA BO'LSA HAM)
  function closeAllDoctorModals() {
    const allModals = getAllDoctorModals();
    logToMe('CLOSING_ALL_MODALS', `Yopilishi kerak bo'lgan modallar soni: ${allModals.length} ta`);

    for (const m of allModals) {
      // 1. ExtJS orqali yopish
      try {
        if (m.win) {
          logToMe('CLOSE_EXT_WIN', `ExtJS Window yopilmoqda: id=${m.win.id}`);
          if (typeof m.win.close === 'function') m.win.close();
          else if (typeof m.win.hide === 'function') m.win.hide();
        }
      } catch (e) {}

      // 2. DOM orqali «Bekor qil...» tugmasini bosish
      if (m.dom) {
        const buttons = Array.from(m.dom.querySelectorAll('button, a.x-btn, .x-btn, input[type="button"], [role="button"]'));
        for (const b of buttons) {
          const txt = normalizeUzbekText(b.innerText || b.value || '');
          if (txt.includes('bekor') || txt.includes('cancel') || txt.includes('vazgec')) {
            logToMe('CLOSE_BEKOR_CLICK', `Modal ichidagi «Bekor qil» bosildi: "${txt}"`);
            clickElement(b);
            break;
          }
        }

        // 3. Sarlavhadagi [X] yopish tugmasi
        const closeTools = Array.from(m.dom.querySelectorAll('.x-tool-close, .x-tool, div[class*="close"]'));
        for (const ct of closeTools) {
          if (isElementVisible(ct)) {
            logToMe('CLOSE_TOOL_X_CLICK', '[X] tugmasi bosildi');
            clickElement(ct);
            break;
          }
        }

        // 4. Oxirgi chora: yashirib qo'yish
        setTimeout(() => {
          if (m.dom && m.dom.parentNode) {
            m.dom.style.display = 'none';
          }
        }, 300);
      }
    }
  }

  // 17. ELEMENTNI ISHONCHLI BOSISH
  function clickElement(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new MouseEvent('mouseover', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    if (typeof el.click === 'function') {
      try { el.click(); } catch (e) {}
    }
  }

  // 18. XPRINTER 80mm NAVBAT TALONI VA BEMOR MA'LUMOTLARINI O'QISH
  function getExtPatientRecord(row) {
    try {
      if (window.Ext && Ext.getCmp) {
        const grid = Ext.getCmp('grdHastalar');
        if (grid) {
          const view = grid.getView ? grid.getView() : null;
          if (view && view.getRecord && row) {
            const r = view.getRecord(row);
            if (r && r.data) return r.data;
          }
          if (grid.getSelectionModel) {
            const sm = grid.getSelectionModel();
            const sel = sm.getLastSelected ? sm.getLastSelected() : (sm.getSelection ? sm.getSelection()[0] : null);
            if (sel && sel.data) return sel.data;
          }
        }
      }
    } catch (e) {}
    return null;
  }

  function extractPatientDataFromRow(row, fallbackDoc = null) {
    const data = {
      patientId: '',
      dosyaNo: '',
      surname: '',
      name: '',
      patronymic: '',
      fullName: '',
      referringDoctor: '',
      assignedDoctor: '',
      assignedRoom: '',
      doctorNum: '',
      queueNumber: '',
      registrationDate: '',
      registrationTime: '',
      isQueueEmpty: false
    };

    if (!row) return data;

    const extData = getExtPatientRecord(row) || {};
    data.dosyaNo = String(extData.DosyaNo || extData.DosyaId || extData.ProtokolNo || '').trim();

    // DOM cell larni olish
    const cells = Array.from(row.querySelectorAll('td, .x-grid-cell'));

    // Ustun sarlavhalari indeksini topish
    const gridContainer = row.closest('#grdHastalar') || document.getElementById('grdHastalar') || document.querySelector('.x-grid');
    const colMap = {};
    if (gridContainer) {
      const headers = Array.from(gridContainer.querySelectorAll('.x-column-header, th, .x-grid-header'));
      headers.forEach((h, idx) => {
        const txt = normalizeUzbekText(h.innerText || '');
        if (txt.includes('faylning shifokor') || txt.includes('fayl shifokor')) colMap.referringDoctor = idx;
        else if (txt.includes('bemor id') || txt.includes('kimlik')) colMap.patientId = idx;
        else if (txt.includes('familiya') || txt.includes('soyadi')) colMap.surname = idx;
        else if (txt.includes('ismi') || txt.includes('hasta adi') || txt === 'ism') colMap.name = idx;
        else if (txt.includes('ota ismi') || txt.includes('baba adi')) colMap.patronymic = idx;
        else if (txt.includes('ulangan bolim') || txt.includes('bolum alt') || txt.includes('alt bolum')) colMap.department = idx;
        else if (txt === 'raqam' || txt.includes('sira no') || txt.includes('navbat')) colMap.queueNumber = idx;
        else if (txt.includes('royxatga olingan') || txt.includes('kayit tarihi') || txt.includes('ro\'yxatga')) colMap.registrationTime = idx;
      });
    }

    // 1. BEMOR ID
    if (extData.KimlikNo) {
      data.patientId = String(extData.KimlikNo);
    } else if (extData.Id && String(extData.Id).length <= 7) {
      data.patientId = String(extData.Id);
    } else if (colMap.patientId !== undefined && cells[colMap.patientId]) {
      data.patientId = cells[colMap.patientId].innerText.trim();
    } else {
      for (const c of cells) {
        const t = c.innerText.trim();
        if (/^\d{4,8}$/.test(t)) {
          data.patientId = t;
          break;
        }
      }
    }

    // 2. FAMILIYA, ISM, OTA ISMI
    if (extData.Soyadi) data.surname = String(extData.Soyadi).trim();
    else if (colMap.surname !== undefined && cells[colMap.surname]) data.surname = cells[colMap.surname].innerText.trim();

    if (extData.HastaAdi) data.name = String(extData.HastaAdi).trim();
    else if (colMap.name !== undefined && cells[colMap.name]) data.name = cells[colMap.name].innerText.trim();

    if (extData.BabaAdi) data.patronymic = String(extData.BabaAdi).trim();
    else if (colMap.patronymic !== undefined && cells[colMap.patronymic]) data.patronymic = cells[colMap.patronymic].innerText.trim();

    if (data.surname || data.name) {
      data.fullName = `${data.surname} ${data.name} ${data.patronymic}`.replace(/\s+/g, ' ').trim();
    } else if (extData.AdSoyad) {
      data.fullName = String(extData.AdSoyad).trim();
    } else {
      const rowSnippet = row.innerText.replace(/\s+/g, ' ').trim();
      data.fullName = rowSnippet.substring(0, 50);
    }

    // 3. FAYLNING SHIFOKORI (DAVOLOVCHI SHIFOKOR)
    if (extData.DosyaDoktoru) {
      data.referringDoctor = String(extData.DosyaDoktoru).trim();
    } else if (colMap.referringDoctor !== undefined && cells[colMap.referringDoctor]) {
      data.referringDoctor = cells[colMap.referringDoctor].innerText.trim();
    } else {
      for (const c of cells) {
        const t = c.innerText.trim();
        if (/^dr\./i.test(t)) {
          data.referringDoctor = t;
          break;
        }
      }
    }

    // 4. ULANGAN BO'LIM (UTT VRACH FISH VA XONA)
    if (fallbackDoc) {
      data.assignedDoctor = `${fallbackDoc.room} (${fallbackDoc.fullName})`;
      data.assignedRoom = fallbackDoc.room;
      data.doctorNum = fallbackDoc.num;
    } else {
      if (extData.AltBolumAdi || extData.OdaAdi) {
        data.assignedDoctor = String(extData.AltBolumAdi || extData.OdaAdi).trim();
      } else if (colMap.department !== undefined && cells[colMap.department]) {
        data.assignedDoctor = cells[colMap.department].innerText.trim();
      } else {
        for (const c of cells) {
          const t = c.innerText.trim();
          if (/ultratovush/i.test(t)) {
            data.assignedDoctor = t;
            break;
          }
        }
      }

      // Xona raqamini aniqlash (1-10)
      const match = data.assignedDoctor.match(/ultratovush[\s-]*(\d+)/i);
      if (match) {
        data.doctorNum = match[1];
        data.assignedRoom = `Ultratovush-${match[1]}`;
      }
    }

    // 5. NAVBAT RAQAMI (RAQAM USTUNI)
    let rawQueue = '';
    if (colMap.queueNumber !== undefined && cells[colMap.queueNumber]) {
      rawQueue = cells[colMap.queueNumber].innerText.trim();
    } else if (extData.MuayeneSiraNo !== undefined && extData.MuayeneSiraNo !== null) {
      rawQueue = String(extData.MuayeneSiraNo).trim();
    } else if (extData.HastaSiraNo !== undefined && extData.HastaSiraNo !== null) {
      rawQueue = String(extData.HastaSiraNo).trim();
    } else {
      for (let i = cells.length - 1; i >= 0; i--) {
        const t = cells[i].innerText.trim();
        if (/^\d{1,4}$/.test(t) && t !== data.patientId) {
          rawQueue = t;
          break;
        }
      }
    }

    if (!rawQueue || rawQueue === '-' || rawQueue === '0') {
      data.queueNumber = '';
      data.isQueueEmpty = true;
    } else {
      data.queueNumber = rawQueue;
      data.isQueueEmpty = false;
    }

    // 6. RO'YXATGA OLINGAN SANA VA SOAT
    let rawDateTime = '';
    if (colMap.registrationTime !== undefined && cells[colMap.registrationTime]) {
      rawDateTime = cells[colMap.registrationTime].innerText.trim();
    } else if (extData.KayitTarihi || extData.GondermeTarihi) {
      rawDateTime = String(extData.KayitTarihi || extData.GondermeTarihi).trim();
    } else {
      for (const c of cells) {
        const t = c.innerText.trim();
        if (/\d{2}\.\d{2}\.\d{4}/.test(t) || /\d{4}-\d{2}-\d{2}/.test(t)) {
          rawDateTime = t;
          break;
        }
      }
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const curDate = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
    const curTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (rawDateTime) {
      const parts = rawDateTime.split(/[\sT]+/);
      if (parts.length >= 2) {
        data.registrationDate = formatCleanDate(parts[0]) || curDate;
        data.registrationTime = formatCleanTime(parts[1]) || curTime;
      } else if (parts.length === 1) {
        if (parts[0].includes('.') || parts[0].includes('-')) {
          data.registrationDate = formatCleanDate(parts[0]) || curDate;
          data.registrationTime = curTime;
        } else {
          data.registrationDate = curDate;
          data.registrationTime = formatCleanTime(parts[0]) || curTime;
        }
      }
    } else {
      data.registrationDate = curDate;
      data.registrationTime = curTime;
    }

    return data;
  }

  function formatCleanDate(str) {
    if (!str) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const [y, m, d] = str.substring(0, 10).split('-');
      return `${d}.${m}.${y}`;
    }
    return str.substring(0, 10);
  }

  function formatCleanTime(str) {
    if (!str) return '';
    const match = str.match(/(\d{1,2}:\d{2})/);
    return match ? match[1] : str.substring(0, 5);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildThermalTicketHtml(p, lang = null) {
    const L = lang || currentPrintLang || 'uz';
    const dict = I18N_TICKET[L] || I18N_TICKET['uz'];
    const docNotice = (dict.docNotices && dict.docNotices[p.doctorNum]) 
      || (dict.docNotices && dict.docNotices["1"]) 
      || (dict.docNotices && dict.docNotices["7"])
      || "xamshirasiga uchrashib so'rang navbat haqida ma'lumot beradi.";
    const roomTitle = p.assignedRoom || (p.doctorNum ? `Ultratovush-${p.doctorNum}` : "Ultratovush");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Navbat Taloni - ${escapeHtml(p.patientId || 'Bemor')}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      width: 74mm;
      margin: 0 auto;
      padding: 6px 2px 14px 2px;
      color: #000000 !important;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .center {
      text-align: center;
    }
    .ticket-header {
      font-size: 13.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 3px;
      line-height: 1.25;
    }
    .ticket-sub-header {
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .divider-solid {
      border-top: 2px solid #000000;
      margin: 6px 0;
    }
    .divider-dashed {
      border-top: 1.5px dashed #000000;
      margin: 6px 0;
    }

    /* 1. NAVBAT RAQAMI VA TV ESLATMASI (AGAR VRACH O'ZGARTIRILMAGAN BO'LSA) */
    .queue-box {
      border: 3px solid #000000;
      border-radius: 8px;
      padding: 6px 4px 8px 4px;
      margin: 6px 0 8px 0;
      text-align: center;
      background: #ffffff;
    }
    .queue-title {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-bottom: 1.5px dashed #000000;
      padding-bottom: 3px;
      margin-bottom: 4px;
    }
    .queue-number {
      font-size: 54px;
      font-weight: 900;
      line-height: 1.05;
      font-family: 'Arial Black', Impact, sans-serif;
      margin: 2px 0 4px 0;
      letter-spacing: 2px;
    }
    .queue-tv-warning {
      font-size: 10px;
      font-weight: 600;
      line-height: 1.25;
      text-align: justify;
      border-top: 1px dotted #000000;
      padding-top: 5px;
      margin-top: 4px;
    }

    /* 1.1 VRACH O'ZGARTIRILGANDA IZOH BLOKI */
    .change-reason-box {
      border: 2.5px solid #000000;
      border-radius: 8px;
      padding: 7px 6px;
      margin: 6px 0 8px 0;
      text-align: center;
      background: #ffffff;
    }
    .change-reason-title {
      font-size: 11.5px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      border-bottom: 1.5px dashed #000000;
      padding-bottom: 3px;
      margin-bottom: 5px;
    }
    .change-reason-text {
      font-size: 13px;
      font-weight: 800;
      line-height: 1.35;
      text-align: center;
    }

    /* 2. RO'YXATGA OLINGAN VAQTI (IKKITA QATORDA KATTA) */
    .time-box {
      border: 2px solid #000000;
      border-radius: 6px;
      padding: 6px 4px;
      margin: 6px 0;
      text-align: center;
      background: #ffffff;
    }
    .time-title {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-bottom: 4px;
      border-bottom: 1px dashed #000000;
      padding-bottom: 2px;
    }
    .time-date {
      font-size: 26px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: 1px;
    }
    .time-hour {
      font-size: 30px;
      font-weight: 900;
      line-height: 1.15;
      letter-spacing: 2px;
      margin-top: 2px;
    }

    /* 3. BEMOR ID (KATTA) */
    .id-box {
      border: 2px solid #000000;
      border-radius: 6px;
      padding: 6px 4px;
      margin: 6px 0;
      text-align: center;
      background: #ffffff;
    }
    .id-title {
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .id-val {
      font-size: 26px;
      font-weight: 900;
      letter-spacing: 2px;
      font-family: monospace, Arial, sans-serif;
    }

    /* 4. BEMOR VA SHIFOKORLAR MA'LUMOTLARI */
    .info-section {
      margin: 6px 0;
      font-size: 12px;
      line-height: 1.35;
    }
    .info-row {
      margin: 4px 0;
      border-bottom: 1px dotted #bbbbbb;
      padding-bottom: 3px;
    }
    .info-label {
      font-weight: 800;
      font-size: 11.5px;
      color: #000000;
      display: block;
    }
    .info-val-patient {
      font-size: 14.5px;
      font-weight: 900;
      color: #000000;
      display: block;
      margin-top: 1px;
    }
    .info-val {
      font-size: 12.5px;
      font-weight: 700;
      color: #000000;
      display: block;
      margin-top: 1px;
    }

    /* 5. ESLATMALAR */
    .notice-box {
      border: 1.5px solid #000000;
      border-radius: 6px;
      padding: 6px;
      margin: 6px 0;
      font-size: 11px;
      line-height: 1.35;
      text-align: justify;
    }
    .notice-box-title {
      font-weight: 900;
      font-size: 11.5px;
      text-transform: uppercase;
      border-bottom: 1px dashed #000000;
      padding-bottom: 2px;
      margin-bottom: 3px;
      text-align: left;
    }

    /* 5.1 ALOHIDA KATTA WI-FI QISMI */
    .wifi-box {
      border: 2.5px solid #000000;
      border-radius: 6px;
      padding: 7px 5px;
      margin: 7px 0;
      text-align: center;
      background: #ffffff;
    }
    .wifi-title {
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 0.8px;
      border-bottom: 1.5px dashed #000000;
      padding-bottom: 4px;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    .wifi-row {
      margin: 4px 0;
    }
    .wifi-lbl {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #222222;
      text-transform: uppercase;
    }
    .wifi-val-ssid {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 1px;
      margin-top: 1px;
    }
    .wifi-val-pass {
      font-size: 21px;
      font-weight: 900;
      letter-spacing: 1.5px;
      margin-top: 2px;
      font-family: "Courier New", Courier, monospace, monospace;
    }

    /* 6. MAJBURIY QOIDA (BALAND GAPIRISH MUMKIN EMAS) */
    .quiet-box {
      border: 2px solid #000000;
      border-radius: 6px;
      padding: 6px 4px;
      margin: 6px 0;
      text-align: center;
      font-size: 11px;
      font-weight: 800;
      line-height: 1.3;
      background: #ffffff;
    }

    .footer {
      text-align: center;
      font-size: 10.5px;
      font-weight: 700;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="center ticket-header">${escapeHtml(dict.centerHeader)}</div>
  <div class="center ticket-sub-header">${escapeHtml(dict.subHeader)}</div>
  <div class="divider-solid"></div>

  ${p.isDoctorChanged && p.changeReasonText ? `
  <!-- VRACH O'ZGARTIRILGANDA: NAVBAT RAQAMI CHOP ETILMAYDI, O'ZGARISH IZOHI CHOP ETILADI -->
  <div class="change-reason-box">
    <div class="change-reason-title">⚠️ VRACH O'ZGARTIRILGAN / ИЗМЕНЕН ВРАЧ</div>
    <div class="change-reason-text">${escapeHtml(p.changeReasonText)}</div>
  </div>
  ` : (!p.isQueueEmpty && p.queueNumber ? `
  <!-- ILK BOR BIRIKTIRILGANDA: NAVBAT RAQAMI VA TV OGOHLANTIRISH -->
  <div class="queue-box">
    <div class="queue-title">${escapeHtml(dict.queueTitle)}</div>
    <div class="queue-number">${escapeHtml(p.queueNumber)}</div>
    <div class="queue-tv-warning">${escapeHtml(dict.tvWarning)}</div>
  </div>
  ` : '')}

  <!-- RO'YXATGA OLINGAN VAQTI (IKKITA QATORDAGI KATTA SANA VA SOAT) -->
  <div class="time-box">
    <div class="time-title">${escapeHtml(dict.timeTitle)}</div>
    <div class="time-date">📅 ${escapeHtml(p.registrationDate)}</div>
    <div class="time-hour">🕐 ${escapeHtml(p.registrationTime)}</div>
  </div>

  <!-- BEMOR ID (KATTA) -->
  <div class="id-box">
    <div class="id-title">${escapeHtml(dict.idTitle)}</div>
    <div class="id-val">${escapeHtml(p.patientId || '-')}</div>
  </div>

  <!-- BEMOR VA SHIFOKORLAR -->
  <div class="info-section">
    <div class="info-row">
      <span class="info-label">${escapeHtml(dict.lblPatient)}</span>
      <span class="info-val-patient">${escapeHtml(p.fullName || '-')}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${escapeHtml(dict.lblUttDoc)}</span>
      <span class="info-val">${escapeHtml(p.assignedDoctor || '-')}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${escapeHtml(dict.lblRefDoc)}</span>
      <span class="info-val">${escapeHtml(p.referringDoctor || '-')}</span>
    </div>
  </div>

  <div class="divider-dashed"></div>

  <!-- VRACH UCHUN INDIVIDUAL ESLATMA -->
  <div class="notice-box">
    <div class="notice-box-title">${escapeHtml(dict.noticeTitle)} (${escapeHtml(roomTitle)}):</div>
    <div>${escapeHtml(docNotice)}</div>
  </div>

  <!-- UMUMIY ESLATMA -->
  <div class="notice-box">
    <div class="notice-box-title">${escapeHtml(dict.generalTitle)}</div>
    <div>${escapeHtml(dict.generalNotice)}</div>
  </div>

  <!-- ALOHIDA KATTA WI-FI QISMI -->
  <div class="wifi-box">
    <div class="wifi-title">${escapeHtml(dict.wifiTitle)}</div>
    <div class="wifi-row">
      <span class="wifi-lbl">${escapeHtml(dict.wifiSsidLbl)}</span>
      <div class="wifi-val-ssid">ONC-Clients</div>
    </div>
    <div class="wifi-row">
      <span class="wifi-lbl">${escapeHtml(dict.wifiPassLbl)}</span>
      <div class="wifi-val-pass">Onco2026++</div>
    </div>
  </div>

  <!-- MAJBURIY QOIDA: BALAND GAPIRISH MUMKIN EMAS -->
  <div class="quiet-box">
    ⚠️ ${escapeHtml(dict.quietRule)}
  </div>

  <div class="divider-solid"></div>
  <div class="footer">
    ${escapeHtml(dict.footer)}
  </div>
</body>
</html>`;
  }

  function printThermalTicketDirect(patientData, lang = null) {
    if (!patientData) return;
    try {
      const oldIframe = document.getElementById("uttPrintIframe");
      if (oldIframe) oldIframe.remove();

      const iframe = document.createElement("iframe");
      iframe.id = "uttPrintIframe";
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const printLang = lang || currentPrintLang || 'uz';
      const html = buildThermalTicketHtml(patientData, printLang);
      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();

      logToMe('PRINT_TICKET', `XPrinter taloni chop etishga yuborildi: ID ${patientData.patientId}, Navbat: ${patientData.queueNumber || 'Bo\'sh'}`);
      showToast(`🖨️ XPrinter taloni chop etilmoqda (ID: ${patientData.patientId})...`, 'info', 2500);

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          logToMe('PRINT_EXEC_ERR', e.message);
        }
      }, 350);
    } catch (e) {
      logToMe('PRINT_ERR', e.message);
      console.error('[XPrinter Print Error]:', e);
    }
  }

  function printQueueTicketForActiveRow() {
    const row = getSelectedStudyRow();
    if (!row) {
      if (lastPatientData) {
        logToMe('PRINT_LAST_PATIENT', 'Oxirgi bemor taloni qayta chop etilmoqda', lastPatientData.patientId);
        printThermalTicketDirect(lastPatientData);
        return;
      }
      showToast(`⚠️ Iltimos, avval ro'yxatdan bemor qatorini tanlang!`, 'warn', 3000);
      return;
    }
    const pData = extractPatientDataFromRow(row);
    if (lastPatientData && lastPatientData.patientId === pData.patientId && lastPatientData.isDoctorChanged) {
      pData.isDoctorChanged = lastPatientData.isDoctorChanged;
      pData.changeReasonText = lastPatientData.changeReasonText;
    }
    lastPatientData = pData;
    printThermalTicketDirect(pData);
  }

  // 19. EKRANDAGI TEZKOR PANEL (QUICK BAR)
  function createQuickBar() {
    if (document.getElementById('utt-quick-assign-bar')) return;

    const bar = document.createElement('div');
    bar.id = 'utt-quick-assign-bar';
    bar.innerHTML = `
      <div class="qbar-header" id="qbarHeader">
        <div class="qbar-title">
          <span class="qbar-icon">⚡</span>
          <b>Tezkor Vrach (0-9)</b>
        </div>
        <div class="qbar-actions">
          <button type="button" class="qbar-power-btn power-on" id="qbarPowerBtn" title="Kengaytmani Yoqish / O'chirish (F8)">
            <span class="qbar-power-dot"></span>
            <span id="qbarPowerText">Yoqilgan</span>
          </button>
          <button type="button" class="qbar-btn-toggle" id="qbarToggleBtn" title="Kichraytirish/Kattalashtirish">➖</button>
        </div>
      </div>
      <div class="qbar-body" id="qbarBody">
        <div class="qbar-status-bar">
          <div class="qbar-status-indicator status-active" id="qbarStatusIndicator">
            <span class="status-dot-pulse"></span>
            <span id="qbarStatusText">Faol (0-9 tayyor)</span>
          </div>
          <span id="qbarQueueCountBadge" class="qbar-queue-badge" title="Jonli navbatdagi bemorlar soni (bosilsa sinxronlanadi)">📡 Navbat: 0 ta</span>
          <span class="qbar-hotkey-hint"><b>F8</b></span>
        </div>
        <div class="qbar-tv-row">
          <button type="button" class="qbar-tv-btn" id="qbarOpenTvBtn" title="Brauzerda Jonli TV Navbat ekranini ochish (Wi-Fi / Monitor)">
            🖥️ TV Navbat Ekranini ochish
          </button>
        </div>
        <div class="qbar-print-controls">
          <button type="button" class="qbar-print-btn" id="qbarPrintBtn" title="Tanlangan bemor talonini chop etish (P)">
            🖨️ Talon chop etish (P)
          </button>
          <button type="button" class="qbar-autoprint-btn ${isAutoPrintEnabled ? 'auto-on' : 'auto-off'}" id="qbarAutoPrintBtn" title="Vrach biriktirilgach avtomatik chop etish">
            Avto: <span id="qbarAutoText">${isAutoPrintEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
        <div class="qbar-lang-row" id="qbarLangRow">
          <span class="qbar-lang-title">Til:</span>
          ${PRINT_LANGUAGES.map(l => `
            <button type="button" class="qbar-lang-btn ${currentPrintLang === l.code ? 'active' : ''}" data-lang="${l.code}" title="${l.name}">
              ${l.label}
            </button>
          `).join('')}
        </div>
        <button type="button" class="qbar-sync-btn" id="qbarSyncFilesBtn" title="Jadvaldagi barcha bemor fayllarini logger.me ga to'liq yozish">
          📋 Barcha fayllarni qayd etish (Log)
        </button>
        <div class="qbar-hint">Bemor qatorini tanlang va <b>0-9</b> ni bosing:</div>
        <div class="qbar-grid">
          ${Object.keys(DOCTORS).map(key => {
            const d = DOCTORS[key];
            return `
              <button type="button" class="qbar-item-btn" data-key="${key}" title="${d.room} — ${d.fullName} [Kod: ${d.kod}]">
                <span class="qbar-key-badge">${key}</span>
                <span class="qbar-room-name">${d.room.replace('Ultratovush-', 'U-')}</span>
                <span class="qbar-doc-name">${d.shortName}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.body.appendChild(bar);

    const toggleBtn = bar.querySelector('#qbarToggleBtn');
    const powerBtn = bar.querySelector('#qbarPowerBtn');
    const printBtn = bar.querySelector('#qbarPrintBtn');
    const autoPrintBtn = bar.querySelector('#qbarAutoPrintBtn');
    const autoText = bar.querySelector('#qbarAutoText');
    const syncFilesBtn = bar.querySelector('#qbarSyncFilesBtn');
    const body = bar.querySelector('#qbarBody');
    const header = bar.querySelector('#qbarHeader');

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isBarMinimized = !isBarMinimized;
      body.style.display = isBarMinimized ? 'none' : 'block';
      bar.classList.toggle('minimized', isBarMinimized);
      toggleBtn.textContent = isBarMinimized ? '➕' : '➖';
      logToMe('ACTION_CLICK', `Tezkor panel: ${isBarMinimized ? 'Kichraytirildi' : 'Kattalashtirildi'}`);
    }, { signal });

    powerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      logToMe('ACTION_CLICK', 'Tezkor panel: Power tugmasi bosildi');
      togglePower();
    }, { signal });

    const openTvBtn = bar.querySelector('#qbarOpenTvBtn');
    if (openTvBtn) {
      openTvBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        logToMe('ACTION_CLICK', 'Tezkor panel: [TV Navbat Ekranini ochish] bosildi');
        window.open('http://localhost:9876', '_blank');
      }, { signal });
    }

    const queueBadge = bar.querySelector('#qbarQueueCountBadge');
    if (queueBadge) {
      queueBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        logToMe('ACTION_CLICK', 'Tezkor panel: Navbat badge bosildi (qo\'lda sinxronlash)');
        syncQueueToServer('MANUAL_CLICK');
        showToast('🔄 Navbat ma\'lumotlari serverga sinxronlandi!', 'info', 2000);
      }, { signal });
    }

    if (printBtn) {
      printBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        logToMe('ACTION_CLICK', 'Tezkor panel: [Talon chop etish] tugmasi bosildi');
        printQueueTicketForActiveRow();
      }, { signal });
    }

    if (autoPrintBtn) {
      autoPrintBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isAutoPrintEnabled = !isAutoPrintEnabled;
        try {
          localStorage.setItem('__karmed_ext_autoprint', String(isAutoPrintEnabled));
        } catch (err) {}
        autoPrintBtn.className = `qbar-autoprint-btn ${isAutoPrintEnabled ? 'auto-on' : 'auto-off'}`;
        if (autoText) autoText.textContent = isAutoPrintEnabled ? 'ON' : 'OFF';
        showToast(isAutoPrintEnabled ? `🖨️ Avtomatik chop etish YOQILDI` : `⏸️ Avtomatik chop etish O'CHIRILDI`, 'info', 2000);
        logToMe('ACTION_CLICK', `Tezkor panel: Avto-chop holati o'zgardi -> ${isAutoPrintEnabled ? 'ON' : 'OFF'}`);
      }, { signal });
    }

    if (syncFilesBtn) {
      syncFilesBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        logToMe('ACTION_CLICK', 'Tezkor panel: [Barcha fayllarni qayd etish] tugmasi bosildi');
        scanAndLogAllPatientFiles('MANUAL_USER_CLICK');
        showToast('📋 Barcha bemor fayllari logger.me ga yozildi!', 'success', 2500);
      }, { signal });
    }

    // Tilni tanlash (UZ, RU, EN, TR, KK, TG)
    bar.querySelectorAll('.qbar-lang-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = btn.dataset.lang;
        currentPrintLang = lang;
        try {
          localStorage.setItem('__karmed_ext_print_lang', lang);
        } catch (err) {}
        bar.querySelectorAll('.qbar-lang-btn').forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
        const langObj = PRINT_LANGUAGES.find(l => l.code === lang);
        showToast(`🌐 Talon tili: ${langObj ? langObj.name : lang.toUpperCase()}`, 'info', 2000);
        logToMe('ACTION_CLICK', `Tezkor panel: Til o'zgartirildi -> [${lang.toUpperCase()}] (${langObj ? langObj.name : ''})`);
      }, { signal });
    });

    header.addEventListener('dblclick', () => {
      isBarMinimized = !isBarMinimized;
      body.style.display = isBarMinimized ? 'none' : 'block';
      bar.classList.toggle('minimized', isBarMinimized);
      toggleBtn.textContent = isBarMinimized ? '➕' : '➖';
      logToMe('ACTION_CLICK', `Tezkor panel: Sarlavha 2 marta bosildi (${isBarMinimized ? 'Kichraytirildi' : 'Kattalashtirildi'})`);
    }, { signal });

    bar.querySelectorAll('.qbar-item-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.key;
        const d = DOCTORS[key];
        logToMe('ACTION_CLICK', `Tezkor panel: [${key}] ${d.room} (${d.shortName}) tugmasi bosildi`);
        assignDoctorByNumber(key);
      }, { signal });
    });
  }

  // 19. TOAST BILDIRISHNOMA
  function createToastElement() {
    if (document.getElementById('karmed-assign-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'karmed-assign-toast';
    document.body.appendChild(toast);
  }

  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('karmed-assign-toast');
    if (!toast) return;

    toast.className = `karmed-toast-${type} show`;
    toast.innerHTML = message;

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // 20. YORDAMCHI FUNKSIYALAR
  function isElementVisible(el) {
    if (!el || !document.body.contains(el)) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const viewW = window.innerWidth || document.documentElement.clientWidth || 1000;
    const viewH = window.innerHeight || document.documentElement.clientHeight || 800;
    if (rect.bottom < 0 || rect.top > viewH) return false;
    if (rect.right < 0 || rect.left > viewW) return false;

    return true;
  }

  function normalizeUzbekText(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[‘’ʻ`']/g, '')
      .replace(/[\s\r\n]+/g, ' ')
      .trim();
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
