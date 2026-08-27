/**
 * UTT TV SISTEM — 6 TA TILDAGI LUG'AT VA TIBBIY QO'LLANMALAR (i18n)
 * 100% Offline: O'zbek, Rus, Ingliz, Turk, Qozoq, Tojik
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
    thStatus: "HOLATI",
    statusWaiting: "KUTILMOQDA",
    statusCalling: "📢 CHAQIRILMOQDA",
    statusInProgress: "▶️ QABULDA",
    statusCompleted: "✅ YAKUNLANDI",
    emptyQueue: "Hozirda navbatda kutayotgan bemorlar yo'q",
    ticker: "Hurmatli bemorlar! Navbatingiz yetganda chaqirilgan xonaga kiring. • Elektron navbat tizimi asosida xizmat ko'rsatiladi. • Favqulodda holatlarda navbatsiz qabul qilinadi.",
    infoBoxHeader: "ℹ️ TEKSHIRUVGA TAYYORGARLIK QOIDALARI",
    guidelines: [
      {
        icon: "🍏",
        title: "Qorin Bo'shlig'i UTT Tekshiruvi",
        points: [
          "Tekshiruvdan kamida 6 soat oldin ovqatlanmaslik (och qoringa kelish) shart.",
          "1 kun oldin gaz hosil qiluvchi mahsulotlar (dukkaklilar, xom sabzavot, gazli suv) yemang.",
          "Tekshiruv kuni ertalab suv ichmaslik yoki oz miqdorda toza gazsiz suv ichish mumkin."
        ]
      },
      {
        icon: "💧",
        title: "Qovuq va Kichik Chanoq UTT (Prostata/Ginekologiya)",
        points: [
          "Tekshiruvdan 1–1.5 soat oldin 1 litr toza gazsiz suv ichish zarur.",
          "Siydik pufagi o'rtacha to'lgan (peshob qistagan) holatda bo'lishi shart.",
          "Maxsus och qolish talab etilmaydi."
        ]
      },
      {
        icon: "🧠",
        title: "Bosh Miya va Umurtqa Pog'onasi MRT",
        points: [
          "Xonaga kirishdan oldin barcha metall buyumlar, soat, tanga, telefonlarni topshiring.",
          "Tanada kardiostimulyator, metall protez bo'lsa shifokorni oldindan ogohlantiring.",
          "Tasvir aniq chiqishi uchun 15–20 daqiqa qimirlamay yotish zarur."
        ]
      },
      {
        icon: "💉",
        title: "Kontrastli MSKT / MRT Tekshiruvlari",
        points: [
          "Tekshiruvdan kamida 4–6 soat oldin ovqatlanmaslik (och qoringa bo'lish) kerak.",
          "Qondagi kreatinin tahlili natijasi (oxirgi 1 oy ichidagi) bo'lishi shart.",
          "Tekshiruvdan keyin kontrast chiqishi uchun 1.5–2 litr toza suv iching."
        ]
      },
      {
        icon: "🩺",
        title: "Qalqonsimon Bez va Bo'yin UTT",
        points: [
          "Maxsus och qolish yoki parhez talab etilmaydi.",
          "Bo'yindagi barcha taqinchoq va zanjirlarni yechib qo'yish kerak.",
          "Oldingi UTT xulosalari bo'lsa shifokorga taqdim eting."
        ]
      }
    ],
    audioModalTitle: "Ovozli E'lonlarni Yoqish",
    audioModalText: "Android TV pultidagi [ OK ] tugmasini yoki ekranga bir marta bosing",
    audioModalBtn: "OVOZNI YOQISH",
    formatSpeech: (name, room) => `Diqqat! Bemor ${name}, ${room} qabuliga kiring.`,
    formatRoomSpeech: (r) => {
      if (!r) return "qabul xonasi";
      return r.replace(/.*53\s*XONA.*/i, "ellik uchinchi xona")
              .replace(/.*54\s*XONA.*/i, "ellik to'rtinchi xona")
              .replace(/.*46\s*XONA.*/i, "qirq oltinchi xona")
              .replace(/.*47\s*XONA.*/i, "qirq yettinchi xona")
              .replace(/.*48\s*XONA.*/i, "qirq sakkizinchi xona")
              .replace(/.*52\s*XONA.*/i, "ellik ikkinchi xona")
              .replace(/.*45\s*XONA.*/i, "qirq beshinchi xona")
              .replace(/.*49\s*XONA.*/i, "qirq to'qqizinchi xona")
              .replace(/.*50\s*XONA.*/i, "ellikinchi xona")
              .replace(/.*51\s*XONA.*/i, "ellik birinchi xona")
              .replace(/101-?xona/i, "bir yuz birinchi xona")
              .replace(/102-?xona/i, "bir yuz ikkinchi xona");
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
    thStatus: "СТАТУС",
    statusWaiting: "В ОЧЕРЕДИ",
    statusCalling: "📢 ВЫЗЫВАЕТСЯ",
    statusInProgress: "▶️ НА ПРИЁМЕ",
    statusCompleted: "✅ ЗАВЕРШЕНО",
    emptyQueue: "В настоящее время в очереди пациентов нет",
    ticker: "Уважаемые пациенты! Проходите в указанный кабинет при объявлении вашей очереди. • Обслуживание по электронной очереди. • Экстренные пациенты принимаются вне очереди.",
    infoBoxHeader: "ℹ️ ПРАВИЛА ПОДГОТОВКИ К ИССЛЕДОВАНИЯМ",
    guidelines: [
      {
        icon: "🍏",
        title: "УЗИ Органов Брюшной Полости",
        points: [
          "Исследование проводится строго натощак (не есть минимум 6 часов).",
          "За 1 день исключите продукты, вызывающие газообразование (бобовые, сырые овощи).",
          "Утром перед исследованием не пить много воды."
        ]
      },
      {
        icon: "💧",
        title: "УЗИ Мочевого Пузыря и Малого Таза",
        points: [
          "За 1–1.5 часа до процедуры выпейте 1 литр негазированной воды.",
          "Мочевой пузырь должен быть наполнен к началу исследования.",
          "Специальной диеты или голодания не требуется."
        ]
      },
      {
        icon: "🧠",
        title: "МРТ Головного Мозга и Позвоночника",
        points: [
          "Снимите все металлические предметы, украшения, часы и оставьте телефон.",
          "Сообщите врачу о наличии кардиостимулятора или металлических имплантов.",
          "Во время сканирования (15–20 минут) необходимо лежать неподвижно."
        ]
      },
      {
        icon: "💉",
        title: "МСКТ и МРТ с Контрастом",
        points: [
          "Исследование проводится натощак (не принимать пищу 4–6 часов).",
          "Обязательно наличие свежего анализа крови на креатинин (не старше 1 месяца).",
          "После процедуры пейте 1.5–2 литра чистой воды для вывода контраста."
        ]
      },
      {
        icon: "🩺",
        title: "УЗИ Щитовидной Железы и Шеи",
        points: [
          "Специальной подготовки и голодания не требуется.",
          "Снимите цепочки и украшения с шеи перед процедурой.",
          "Возьмите с собой результаты предыдущих УЗИ при наличии."
        ]
      }
    ],
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
    thStatus: "STATUS",
    statusWaiting: "WAITING",
    statusCalling: "📢 CALLING",
    statusInProgress: "▶️ IN SERVICE",
    statusCompleted: "✅ COMPLETED",
    emptyQueue: "There are currently no patients waiting in the queue",
    ticker: "Dear patients! Please proceed to the designated room when your queue is called. • Service is provided based on the electronic queue system.",
    infoBoxHeader: "ℹ️ EXAMINATION PREPARATION GUIDELINES",
    guidelines: [
      {
        icon: "🍏",
        title: "Abdominal Ultrasound Examination",
        points: [
          "Fasting is required for at least 6 hours prior to examination.",
          "Avoid gas-producing foods (beans, raw vegetables, sodas) the day before.",
          "You may sip small amounts of plain water on the morning of scan."
        ]
      },
      {
        icon: "💧",
        title: "Pelvic & Bladder Ultrasound",
        points: [
          "Drink 1 liter of still water 1–1.5 hours before the exam.",
          "Do not empty your bladder before the ultrasound scan.",
          "No special fasting is necessary."
        ]
      },
      {
        icon: "🧠",
        title: "Brain & Spine MRI Scan",
        points: [
          "Remove all metallic items, jewelry, coins, and mobile phones.",
          "Inform medical staff if you have pacemakers or metal implants.",
          "Remain completely still during the 15–20 minute scan."
        ]
      },
      {
        icon: "💉",
        title: "Contrast-Enhanced CT / MRI",
        points: [
          "Fast for 4–6 hours prior to the contrast injection.",
          "Recent blood creatinine lab test result (within 1 month) is mandatory.",
          "Drink 1.5–2 liters of water after scan to flush out contrast dye."
        ]
      },
      {
        icon: "🩺",
        title: "Thyroid & Neck Ultrasound",
        points: [
          "No special fasting or preparation required.",
          "Remove necklaces and neck jewelry prior to exam.",
          "Bring prior ultrasound reports for comparison if available."
        ]
      }
    ],
    audioModalTitle: "Enable Audio Announcements",
    audioModalText: "Press [ OK ] button on your Android TV remote or click anywhere on screen",
    audioModalBtn: "ENABLE AUDIO",
    formatSpeech: (name, room) => `Attention! Patient ${name}, please proceed to ${room}.`,
    formatRoomSpeech: (r) => {
      if (!r) return "consultation room";
      return r.replace(/UTT8-?48\s*XONA/i, "Ultrasound Room 48")
              .replace(/48-?xona/i, "Room 48")
              .replace(/101-?xona/i, "Room 101")
              .replace(/102-?xona/i, "Room 102");
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
    thStatus: "DURUM",
    statusWaiting: "BEKLİYOR",
    statusCalling: "📢 ÇAĞRILIYOR",
    statusInProgress: "▶️ MUAYENEDE",
    statusCompleted: "✅ TAMAMLANDI",
    emptyQueue: "Şu anda sırada bekleyen hasta bulunmamaktadır",
    ticker: "Değerli hastalarımız! Sıranız geldiğinde lütfen belirtilen odaya geçiniz. • Hizmetler elektronik sıra sistemi ile verilmektedir.",
    infoBoxHeader: "ℹ️ TETKİK HAZIRLIK BİLGİLERİ",
    guidelines: [
      {
        icon: "🍏",
        title: "Karın (Batın) Ultrasonu",
        points: [
          "İşlemden önce en az 6 saat aç kalmanız gerekmektedir.",
          "Bir gün önceden gaz yapıcı gıdalardan (baklagiller vb.) kaçınınız.",
          "Sabah az miktarda su içilebilir."
        ]
      },
      {
        icon: "💧",
        title: "Mesane ve Pelvik Ultrason",
        points: [
          "İşlemden 1–1.5 saat önce 1 litre su içiniz.",
          "İdrara sıkışık olarak tetkike geliniz.",
          "Aç kalmaya gerek yoktur."
        ]
      },
      {
        icon: "🧠",
        title: "Beyin ve Omurga MR Tetkiki",
        points: [
          "Tüm metal eşyaları, takıları ve telefonu dışarıda bırakınız.",
          "Vücudunuzda metal implant veya kalp pili varsa doktora bildiriniz.",
          "Çekim esnasında hareketsiz yatmanız gerekmektedir."
        ]
      }
    ],
    audioModalTitle: "Sesli Duyuruları Etkinleştir",
    audioModalText: "Android TV kumandanızdan [ OK ] tuşuna veya ekrana bir kez tıklayın",
    audioModalBtn: "SESİ AÇ",
    formatSpeech: (name, room) => `Dikkat! Hasta ${name}, lütfen ${room} numaralı odaya geçiniz.`,
    formatRoomSpeech: (r) => {
      if (!r) return "muayene odası";
      return r.replace(/UTT8-?48\s*XONA/i, "Kırk sekiz numaralı Ultrason odası")
              .replace(/48-?xona/i, "Kırk sekiz numaralı oda");
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
    thStatus: "КҮЙІ",
    statusWaiting: "КҮТУДЕ",
    statusCalling: "📢 ШАҚЫРЫЛУДА",
    statusInProgress: "▶️ ҚАБЫЛДАУДА",
    statusCompleted: "✅ АЯҚТАЛДЫ",
    emptyQueue: "Қазіргі уақытта кезекте науқастар жоқ",
    ticker: "Құрметті науқастар! Кезегіңіз келгенде шақырылған бөлмеге кіріңіз. • Қызмет электрондық кезек жүйесі бойынша көрсетіледі.",
    infoBoxHeader: "ℹ️ ТЕКСЕРУГЕ ДАЙЫНДЫҚ ЕРЕЖЕЛЕРІ",
    guidelines: [
      {
        icon: "🍏",
        title: "Құрсақ Қуысы УДЗ (УЗИ)",
        points: [
          "Тексеру аш қарынға (кемінде 6 сағат тамақтанбау) жүргізіледі.",
          "1 күн бұрын газ түзуші тағамдарды жеуге болмайды.",
          "Таңертең аз мөлшерде ғана таза су ішуге болады."
        ]
      },
      {
        icon: "💧",
        title: "Қуық және Кіші Жамбас УДЗ",
        points: [
          "Тексеруге дейін 1 сағат бұрын 1 литр газсыз су ішіңіз.",
          "Қуық толған күйде тексерілуі тиіс.",
          "Арнайы аш қалу талап етілмейді."
        ]
      },
      {
        icon: "🧠",
        title: "Бас Миы мен Омыртқа МРТ",
        points: [
          "Барлық металл бұйымдарды, сағатты және телефонды қалдырыңыз.",
          "Денеде кардиостимулятор немесе металл болса ескертіңіз.",
          "Түсірілім кезінде 15–20 минут қозғалмай жату керек."
        ]
      }
    ],
    audioModalTitle: "Дыбыстық Хабарландыруларды Қосу",
    audioModalText: "Android TV пультіндегі [ OK ] батырмасын немесе экранды басыңыз",
    audioModalBtn: "ДЫБЫСТЫ ҚОСУ",
    formatSpeech: (name, room) => `Назар аударыңыз! Науқас ${name}, ${room} бөлмесіне кіріңіз.`,
    formatRoomSpeech: (r) => {
      if (!r) return "қабылдау бөлмесі";
      return r.replace(/UTT8-?48\s*XONA/i, "қырық сегізінші бөлме");
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
    thStatus: "ҲОЛАТ",
    statusWaiting: "ДАР НАВБАТ",
    statusCalling: "📢 ДАЪВАТ МЕШАВАД",
    statusInProgress: "▶️ ДАР ҚАБУЛ",
    statusCompleted: "✅ АНҶОМ ЁФТ",
    emptyQueue: "Дар ҳоли ҳозир дар навбат беморон нестанд",
    ticker: "Беморони муҳтарам! Вақте навбати шумо расад, ба ҳуҷраи даъватшуда дароед. • Хизматрасонӣ тавассути навбати электронӣ амалӣ мегардад.",
    infoBoxHeader: "ℹ️ ҚОИДАҲОИ ТАЙЁРӢ БА ТАШХИС",
    guidelines: [
      {
        icon: "🍏",
        title: "Ташхиси УЗИ Узвҳои Шикам",
        points: [
          "Ташхис ҳатман бо меъдаи холӣ (на камтар аз 6 соат) гузаронида мешавад.",
          "1 рӯз пеш хӯрокҳои газдор ва хомро истеъмол накунед.",
          "Субҳи барвақт танҳо миқдори ками оби соф нӯшидан мумкин аст."
        ]
      },
      {
        icon: "💧",
        title: "УЗИ Пешобдон ва Коси Хурд",
        points: [
          "1 соат пеш аз ташхис 1 литр оби газношуда нӯшед.",
          "Пешобдон бояд ҳангоми ташхис пур бошад.",
          "Гуруснагӣ талаб карда намешавад."
        ]
      },
      {
        icon: "🧠",
        title: "Ташхиси МРТ Мағзи Сар ва Сутунмӯҳра",
        points: [
          "Ҳамаи ашёҳои металлӣ, соат ва телефонро дар берун монед.",
          "Дар сурати мавҷуд будани протезҳои металлӣ ба духтур хабар диҳед.",
          "Ҳангоми ташхис 15–20 дақиқа беҳаракат хобидан зарур аст."
        ]
      }
    ],
    audioModalTitle: "Фаъолсозии Эълонҳои Овозӣ",
    audioModalText: "Тугмаи [ OK ] -ро дар пулти Android TV ё экран пахш кунед",
    audioModalBtn: "САДОРО ФАЪОЛ КУНЕД",
    formatSpeech: (name, room) => `Диққат! Бемор ${name}, ба ҳуҷраи ${room} дароед.`,
    formatRoomSpeech: (r) => {
      if (!r) return "ҳуҷраи қабул";
      return r.replace(/UTT8-?48\s*XONA/i, "ҳуҷраи чилу ҳаштум");
    }
  }
};
