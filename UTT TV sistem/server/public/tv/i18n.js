/**
 * UTT TV SISTEM — 6 TA TILDAGI LUG'AT (i18n)
 * 100% Offline Lokal Lug'at: O'zbek, Rus, Ingliz, Turk, Qozoq, Tojik
 */

const I18N = {
  uz: {
    code: "uz",
    name: "O'zbekcha",
    flag: "🇺🇿",
    langVoice: "uz-UZ",
    weekdays: ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"],
    months: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
    allRoomsOption: "🏢 Barcha Xonalar Monitori",
    roomWord: "XONA",
    nowCalling: "QABULGA CHAQIRILMOQDA",
    thNum: "№",
    thName: "BEMOR FAMILIYA VA ISMI",
    thRoom: "XONA / QURILMA",
    thStatus: "HOLATI",
    statusWaiting: "KUTILMOQDA",
    statusCalling: "📢 CHAQIRILMOQDA",
    statusInProgress: "▶️ QABULDA",
    statusCompleted: "✅ YAKUNLANDI",
    emptyQueue: "Hozirda navbatda kutayotgan bemorlar yo'q",
    ticker: "Hurmatli bemorlar! Navbatingiz yetganda chaqirilgan xonaga kiring. • Elektron navbat tizimi asosida xizmat ko'rsatiladi. • Favqulodda holatlarda navbatsiz qabul qilinadi.",
    audioModalTitle: "Ovozli E'lonlarni Yoqish",
    audioModalText: "Android TV pultidagi [ OK ] tugmasini yoki ekranga bir marta bosing",
    audioModalBtn: "OVOZNI YOQISH",
    formatSpeech: (name, room) => `Diqqat! Bemor ${name}, ${room} qabuliga kiring.`,
    formatRoomSpeech: (r) => {
      if (!r) return "qabul xonasi";
      return r.replace(/UTT8-?48\s*XONA/i, "qirq sakkizinchi xona")
              .replace(/48-?xona/i, "qirq sakkizinchi xona")
              .replace(/101-?xona/i, "bir yuz birinchi xona")
              .replace(/102-?xona/i, "bir yuz ikkinchi xona")
              .replace(/1-?MRT\s*Xonasi/i, "birinchi MRT xonasi")
              .replace(/1-?MSKT\s*Xonasi/i, "birinchi MSKT xonasi");
    }
  },

  ru: {
    code: "ru",
    name: "Русский",
    flag: "🇷🇺",
    langVoice: "ru-RU",
    weekdays: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"],
    months: ["Января", "Февраля", "Марта", "Апреля", "Мая", "Июня", "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"],
    allRoomsOption: "🏢 Монитор Всех Кабинетов",
    roomWord: "КАБИНЕТ",
    nowCalling: "ВЫЗЫВАЕТСЯ НА ПРИЁМ",
    thNum: "№",
    thName: "Ф.И.О. ПАЦИЕНТА",
    thRoom: "КАБИНЕТ / АППАРАТ",
    thStatus: "СТАТУС",
    statusWaiting: "В ОЧЕРЕДИ",
    statusCalling: "📢 ВЫЗЫВАЕТСЯ",
    statusInProgress: "▶️ НА ПРИЁМЕ",
    statusCompleted: "✅ ЗАВЕРШЕНО",
    emptyQueue: "В настоящее время в очереди пациентов нет",
    ticker: "Уважаемые пациенты! Проходите в указанный кабинет при объявлении вашей очереди. • Обслуживание по электронной очереди. • Экстренные пациенты принимаются вне очереди.",
    audioModalTitle: "Включить Голосовое Оповещение",
    audioModalText: "Нажмите кнопку [ OK ] на пульте Android TV или кликните по экрану",
    audioModalBtn: "ВКЛЮЧИТЬ ЗВУК",
    formatSpeech: (name, room) => `Внимание! Пациент ${name}, пройдите в ${room}.`,
    formatRoomSpeech: (r) => {
      if (!r) return "кабинет приёма";
      return r.replace(/UTT8-?48\s*XONA/i, "сорок восьмой кабинет УЗИ")
              .replace(/48-?xona/i, "сорок восьмой кабинет")
              .replace(/101-?xona/i, "сто первый кабинет")
              .replace(/102-?xona/i, "сто второй кабинет")
              .replace(/1-?MRT\s*Xonasi/i, "первый кабинет МРТ")
              .replace(/1-?MSKT\s*Xonasi/i, "первый кабинет МСКТ");
    }
  },

  en: {
    code: "en",
    name: "English",
    flag: "🇬🇧",
    langVoice: "en-US",
    weekdays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    allRoomsOption: "🏢 All Rooms Monitor",
    roomWord: "ROOM",
    nowCalling: "NOW CALLING",
    thNum: "#",
    thName: "PATIENT FULL NAME",
    thRoom: "ROOM / DEVICE",
    thStatus: "STATUS",
    statusWaiting: "WAITING",
    statusCalling: "📢 CALLING",
    statusInProgress: "▶️ IN SERVICE",
    statusCompleted: "✅ COMPLETED",
    emptyQueue: "There are currently no patients waiting in the queue",
    ticker: "Dear patients! Please proceed to the designated room when your queue is called. • Service is provided based on the electronic queue system.",
    audioModalTitle: "Enable Audio Announcements",
    audioModalText: "Press [ OK ] button on your Android TV remote or click anywhere on screen",
    audioModalBtn: "ENABLE AUDIO",
    formatSpeech: (name, room) => `Attention! Patient ${name}, please proceed to ${room}.`,
    formatRoomSpeech: (r) => {
      if (!r) return "consultation room";
      return r.replace(/UTT8-?48\s*XONA/i, "Ultrasound Room 48")
              .replace(/48-?xona/i, "Room 48")
              .replace(/101-?xona/i, "Room 101")
              .replace(/102-?xona/i, "Room 102")
              .replace(/1-?MRT\s*Xonasi/i, "MRI Room 1")
              .replace(/1-?MSKT\s*Xonasi/i, "CT Room 1");
    }
  },

  tr: {
    code: "tr",
    name: "Türkçe",
    flag: "🇹🇷",
    langVoice: "tr-TR",
    weekdays: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"],
    months: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
    allRoomsOption: "🏢 Tüm Odalar Monitörü",
    roomWord: "ODA",
    nowCalling: "LÜTFEN GİRİNİZ",
    thNum: "Sıra",
    thName: "HASTA ADI SOYADI",
    thRoom: "ODA / CİHAZ",
    thStatus: "DURUM",
    statusWaiting: "BEKLİYOR",
    statusCalling: "📢 ÇAĞRILIYOR",
    statusInProgress: "▶️ MUAYENEDE",
    statusCompleted: "✅ TAMAMLANDI",
    emptyQueue: "Şu anda sırada bekleyen hasta bulunmamaktadır",
    ticker: "Değerli hastalarımız! Sıranız geldiğinde lütfen belirtilen odaya geçiniz. • Hizmetler elektronik sıra sistemi ile verilmektedir.",
    audioModalTitle: "Sesli Duyuruları Etkinleştir",
    audioModalText: "Android TV kumandanızdan [ OK ] tuşuna veya ekrana bir kez tıklayın",
    audioModalBtn: "SESİ AÇ",
    formatSpeech: (name, room) => `Dikkat! Hasta ${name}, lütfen ${room} numaralı odaya geçiniz.`,
    formatRoomSpeech: (r) => {
      if (!r) return "muayene odası";
      return r.replace(/UTT8-?48\s*XONA/i, "Kırk sekiz numaralı Ultrason odası")
              .replace(/48-?xona/i, "Kırk sekiz numaralı oda")
              .replace(/101-?xona/i, "Yüz bir numaralı oda")
              .replace(/102-?xona/i, "Yüz iki numaralı oda");
    }
  },

  kz: {
    code: "kz",
    name: "Қазақша",
    flag: "🇰🇿",
    langVoice: "kk-KZ",
    weekdays: ["Жексенбі", "Дүйсенбі", "Сейсенбі", "Сәрсенбі", "Бейсенбі", "Жұма", "Сенбі"],
    months: ["Қаңтар", "Ақпан", "Наурыз", "Сәуір", "Мамыр", "Маусым", "Шілде", "Тамыз", "Қыркүйек", "Қазан", "Қараша", "Желтоқсан"],
    allRoomsOption: "🏢 Барлық Бөлмелер Мониторы",
    roomWord: "БӨЛМЕ",
    nowCalling: "ҚАБЫЛДАУҒА ШАҚЫРЫЛАДЫ",
    thNum: "№",
    thName: "НАУҚАСТЫҢ Т.А.Ә.",
    thRoom: "БӨЛМЕ / ҚҰРЫЛҒЫ",
    thStatus: "КҮЙІ",
    statusWaiting: "КҮТУДЕ",
    statusCalling: "📢 ШАҚЫРЫЛУДА",
    statusInProgress: "▶️ ҚАБЫЛДАУДА",
    statusCompleted: "✅ АЯҚТАЛДЫ",
    emptyQueue: "Қазіргі уақытта кезекте науқастар жоқ",
    ticker: "Құрметті науқастар! Кезегіңіз келгенде шақырылған бөлмеге кіріңіз. • Қызмет электрондық кезек жүйесі бойынша көрсетіледі.",
    audioModalTitle: "Дыбыстық Хабарландыруларды Қосу",
    audioModalText: "Android TV пультіндегі [ OK ] батырмасын немесе экранды басыңыз",
    audioModalBtn: "ДЫБЫСТЫ ҚОСУ",
    formatSpeech: (name, room) => `Назар аударыңыз! Науқас ${name}, ${room} бөлмесіне кіріңіз.`,
    formatRoomSpeech: (r) => {
      if (!r) return "қабылдау бөлмесі";
      return r.replace(/UTT8-?48\s*XONA/i, "қырық сегізінші бөлме")
              .replace(/48-?xona/i, "қырық сегізінші бөлме")
              .replace(/101-?xona/i, "жүз бірінші бөлме")
              .replace(/102-?xona/i, "жүз екінші бөлме");
    }
  },

  tg: {
    code: "tg",
    name: "Тоҷикӣ",
    flag: "🇹🇯",
    langVoice: "tg-TJ",
    weekdays: ["Якшанбе", "Душанбе", "Сешанбе", "Чоршанбе", "Панҷшанбе", "Ҷумъа", "Шанбе"],
    months: ["Январ", "Феврал", "Март", "Апрел", "Май", "Июн", "Июл", "Август", "Сентябр", "Октябр", "Ноябр", "Декабр"],
    allRoomsOption: "🏢 Монитори Ҳамаи Ҳуҷраҳо",
    roomWord: "ҲУҶРА",
    nowCalling: "БА ҚАБУЛ ДАЪВАТ МЕШАВАД",
    thNum: "№",
    thName: "НОМУ НАСАБИ БЕМОРОН",
    thRoom: "ҲУҶРА / ДАСТГОҲ",
    thStatus: "ҲОЛАТ",
    statusWaiting: "ДАР НАВБАТ",
    statusCalling: "📢 ДАЪВАТ МЕШАВАД",
    statusInProgress: "▶️ ДАР ҚАБУЛ",
    statusCompleted: "✅ АНҶОМ ЁФТ",
    emptyQueue: "Дар ҳоли ҳозир дар навбат беморон нестанд",
    ticker: "Беморони муҳтарам! Вақте навбати шумо расад, ба ҳуҷраи даъватшуда дароед. • Хизматрасонӣ тавассути навбати электронӣ амалӣ мегардад.",
    audioModalTitle: "Фаъолсозии Эълонҳои Овозӣ",
    audioModalText: "Тугмаи [ OK ] -ро дар пулти Android TV ё экран пахш кунед",
    audioModalBtn: "САДОРО ФАЪОЛ КУНЕД",
    formatSpeech: (name, room) => `Диққат! Бемор ${name}, ба ҳуҷраи ${room} дароед.`,
    formatRoomSpeech: (r) => {
      if (!r) return "ҳуҷраи қабул";
      return r.replace(/UTT8-?48\s*XONA/i, "ҳуҷраи чилу ҳаштум")
              .replace(/48-?xona/i, "ҳуҷраи чилу ҳаштум")
              .replace(/101-?xona/i, "ҳуҷраи яксаду якум")
              .replace(/102-?xona/i, "ҳуҷраи яксаду дуюм");
    }
  }
};
