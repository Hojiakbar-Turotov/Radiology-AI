/**
 * RONS Navbat Tizimi - Xalqaro Ko'p Tilli Lug'at (i18n Dictionary)
 * Tillari: UZ (O'zbekcha), RU (Русский), EN (English), KK (Қазақша), TG (Тоҷикӣ), TR (Türkçe)
 */

const I18N_LANGUAGES = [
  { code: 'uz', name: "O'zbekcha", flag: '🇺🇿' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'kk', name: 'Қазақша', flag: '🇰🇿' },
  { code: 'tg', name: 'Тоҷикӣ', flag: '🇹🇯' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' }
];

const I18N_TRANSLATIONS = {
  // 1. TALON CHOP ETISH (80mm Xprinter)
  ticket: {
    uz: {
      centerName: "ONKOLOGIYA VA RADIOLOGIYA MARKAZI",
      ticketTitle: "Elektron Navbat Taloni",
      patient: "Bemor",
      patientType: "Bemor Toifasi",
      stationary: "🏥 Bo'limda yotibdi",
      ambulatory: "🏠 Uyidan qatnaydi",
      referringDoctor: "Fayl Shifokori",
      roomDevice: "Qurilma / Xona",
      service: "Tekshiruv",
      bookedTime: "BAND QILINGAN QABUL VAQTI:",
      appointmentDate: "Qabul Sanasi",
      operator: "Ro'yxatga oluvchi",
      reasonLabel: "Sabab:",
      timeNotice: "* Iltimos, belgilangan vaqtdan 15 daqiqa oldin xona oldida bo'ling!",
      footerThanks: "Salomatligingiz biz uchun muhim!",
      contrastBadge: "[KONTRASTLI]"
    },
    ru: {
      centerName: "ЦЕНТР ОНКОЛОГИИ И РАДИОЛОГИИ",
      ticketTitle: "Электронный талон очереди",
      patient: "Пациент",
      patientType: "Категория",
      stationary: "🏥 Стационар",
      ambulatory: "🏠 Амбулаторный",
      referringDoctor: "Врач направления",
      roomDevice: "Кабинет / Аппарат",
      service: "Исследование",
      bookedTime: "ЗАБРОНИРОВАННОЕ ВРЕМЯ:",
      appointmentDate: "Дата приёма",
      operator: "Регистратор",
      reasonLabel: "Причина:",
      timeNotice: "* Пожалуйста, будьте у кабинета за 15 минут до назначенного времени!",
      footerThanks: "Ваше здоровье — наша главная ценность!",
      contrastBadge: "[С КОНТРАСТОМ]"
    },
    en: {
      centerName: "ONCOLOGY & RADIOLOGY CENTER",
      ticketTitle: "Electronic Queue Ticket",
      patient: "Patient",
      patientType: "Patient Category",
      stationary: "🏥 Inpatient (Ward)",
      ambulatory: "🏠 Outpatient (Ambulatory)",
      referringDoctor: "Referring Doctor",
      roomDevice: "Room / Device",
      service: "Examination",
      bookedTime: "BOOKED APPOINTMENT TIME:",
      appointmentDate: "Appointment Date",
      operator: "Registrar",
      reasonLabel: "Reason:",
      timeNotice: "* Please arrive 15 minutes before your scheduled appointment!",
      footerThanks: "Your health is our greatest priority!",
      contrastBadge: "[WITH CONTRAST]"
    },
    kk: {
      centerName: "ОНКОЛОГИЯ ЖӘНЕ РАДИОЛОГИЯ ОРТАЛЫҒЫ",
      ticketTitle: "Электронды кезек талоны",
      patient: "Науқас",
      patientType: "Науқас санаты",
      stationary: "🏥 Бөлімшеде (Стационар)",
      ambulatory: "🏠 Үйінен келуші (Амбулаториялық)",
      referringDoctor: "Жолдаған дәрігер",
      roomDevice: "Бөлме / Құрылғы",
      service: "Зерттеу",
      bookedTime: "БРОНДАЛҒАН ҚАБЫЛДАУ УАҚЫТЫ:",
      appointmentDate: "Қабылдау күні",
      operator: "Тіркеуші",
      reasonLabel: "Себебі:",
      timeNotice: "* Белгіленген уақыттан 15 минут бұрын келіп күтуіңізді сұраймыз!",
      footerThanks: "Денсаулығыңыз біз үшін маңызды!",
      contrastBadge: "[КОНТРАСТПЕН]"
    },
    tg: {
      centerName: "МАРКАЗИ ОНКОЛОГИЯ ВА РАДИОЛОГИЯ",
      ticketTitle: "Талони электронии навбат",
      patient: "Бемор",
      patientType: "Гурӯҳи бемор",
      stationary: "🏥 Дар шуъба (Статсионар)",
      ambulatory: "🏠 Аз хона (Амбулаторӣ)",
      referringDoctor: "Духтури роҳхатдиҳанда",
      roomDevice: "Ҳуҷра / Дастгоҳ",
      service: "Ташхис",
      bookedTime: "ВАҚТИ ҚАБУЛИ БАНДШУДА:",
      appointmentDate: "Санаи қабул",
      operator: "Бақайдгиранда",
      reasonLabel: "Сабаб:",
      timeNotice: "* Лутфан 15 дақиқа пеш аз вақти муайяншуда дар назди ҳуҷра бошед!",
      footerThanks: "Саломатии шумо барои мо муҳим аст!",
      contrastBadge: "[БО КОНТРАСТ]"
    },
    tr: {
      centerName: "ONKOLOJİ VE RADYOLOJİ MERKEZİ",
      ticketTitle: "Elektronik Sıra Bileti",
      patient: "Hasta",
      patientType: "Hasta Kategorisi",
      stationary: "🏥 Yatan Hasta (Servis)",
      ambulatory: "🏠 Ayaktan Hasta",
      referringDoctor: "Yönlendiren Doktor",
      roomDevice: "Oda / Cihaz",
      service: "Tetkik",
      bookedTime: "RANDEVU SAATİ:",
      appointmentDate: "Randevu Tarihi",
      operator: "Kayıt Görevlisi",
      reasonLabel: "Gerekçe:",
      timeNotice: "* Lütfen randevu saatinizden 15 dakika önce bekleme alanında olunuz!",
      footerThanks: "Sağlığınız bizim için değerlidir!",
      contrastBadge: "[KONTRASTLI]"
    }
  },

  // 2. TIBBIY KO'RSATMALAR, TAYYORGARLIK VA QARSHI KO'RSATMALAR (Guidelines)
  guidelines: {
    uz: {
      boxTitle: "TIBBIY KO'RSATMALAR VA ESLATMA",
      generalPrepTitle: "📌 Umumiy Tayyorgarlik (Barcha tekshiruvlar uchun):",
      specificPrepTitle: "🔍 Har Bir Tekshiruv Uchun Alohida Tayyorgarlik:",
      contraTitle: "🚫 Qarshi ko'rsatmalar:",
      noSpecificPrep: "- Alohida maxsus tayyorgarlik talab etilmaydi (Umumiy qoidalarga amal qiling).",
      fasting: "Kamida {H} soat och qoringa kelish (barcha tekshiruvlar hisobga olingan holda).",
      bloodTest: "Qonda Kreatinin va Mochevina tahlili natijasi (oxirgi 3 kun ichida).",
      metformin: "Qandli diabet bo'lsa: Metformin (Glyukofaj, Siofor v.b.) dori vositasini 48 soat oldin to'xtatish.",
      postHydration: "Tekshiruvdan so'ng ko'p miqdorda suyuqlik (suv) ichish.",
      metalWarning: "Barcha metall buyumlar, soat, telefon, kamar va zargarlik buyumlarini yechish shart.",
      claustrophobia: "Klavstrofobiya (yopiq joydan qo'rqish) bo'lsa shifokorni ogohlantirish.",
      allergy: "Yodli yoki gadoliniyli kontrast moddalarga allergiya.",
      kidney: "Buyrak yetishmovchiligi (kreatinin miqdori yuqori).",
      hyperthyroidism: "Gipertireoz (qalqonsimon bez/bo'qoq kasalligi).",
      pregnancy: "Homiladorlik va laktatsiya (emizikli) davri.",
      pacemaker: "Yurak kardiostimulyatori yoki metall implantlar mavjudligi (MRT uchun mutlaq qarshi ko'rsatma!)."
    },
    ru: {
      boxTitle: "МЕДИЦИНСКИЕ УКАЗАНИЯ И ПАМЯТКА",
      generalPrepTitle: "📌 Общая подготовка (для всех исследований):",
      specificPrepTitle: "🔍 Индивидуальная подготовка к каждому исследованию:",
      contraTitle: "🚫 Противопоказания:",
      noSpecificPrep: "- Специальной подготовки не требуется (соблюдайте общие правила).",
      fasting: "Прийти натощак минимум за {H} часов (с учётом всех назначенных исследований).",
      bloodTest: "Результаты анализа крови на Креатинин и Мочевину (давностью не более 3 дней).",
      metformin: "При сахарном диабете: отменить приём Метформина (Глюкофаж, Сиофор и др.) за 48 часов до исследования.",
      postHydration: "После исследования пить обильное количество жидкости (чистой воды).",
      metalWarning: "Обязательно снять все металлические предметы, часы, телефон, ремень и украшения.",
      claustrophobia: "При клаустрофобии (боязни замкнутого пространства) предупредить врача.",
      allergy: "Аллергическая реакция на йодосодержащие и контрастные препараты.",
      kidney: "Почечная недостаточность (повышенный уровень креатинина).",
      hyperthyroidism: "Гипертиреоз (тяжёлые заболевания щитовидной железы).",
      pregnancy: "Беременность и период грудного вскармливания.",
      pacemaker: "Наличие кардиостимулятора или ферромагнитных имплантов (Абсолютное противопоказание для МРТ!)."
    },
    en: {
      boxTitle: "MEDICAL INSTRUCTIONS & GUIDELINES",
      generalPrepTitle: "📌 General Preparation (For all exams):",
      specificPrepTitle: "🔍 Specific Preparation for Each Procedure:",
      contraTitle: "🚫 Contraindications:",
      noSpecificPrep: "- No special preparation required (please follow general guidelines).",
      fasting: "Arrive fasting at least {H} hours prior (accounting for all combined exams).",
      bloodTest: "Blood test results for Creatinine and Urea (within the last 3 days).",
      metformin: "If diabetic: Discontinue Metformin (Glucophage, Siofor, etc.) 48 hours prior to the exam.",
      postHydration: "Drink plenty of water / fluids after the examination.",
      metalWarning: "Remove all metal items, watches, phones, belts, and jewelry before entering.",
      claustrophobia: "Inform staff if you suffer from claustrophobia.",
      allergy: "Allergy to iodine or gadolinium contrast media.",
      kidney: "Renal failure / impaired kidney function (elevated creatinine).",
      hyperthyroidism: "Severe hyperthyroidism / thyroid dysfunction.",
      pregnancy: "Pregnancy and lactation period.",
      pacemaker: "Cardiac pacemaker or ferromagnetic implants (Absolute contraindication for MRI!)."
    },
    kk: {
      boxTitle: "МЕДИЦИНАЛЫҚ НҰСҚАУЛЫҚТАР ЖӘНЕ ЕСКЕРТПЕ",
      generalPrepTitle: "📌 Жалпы дайындық (Барлық зерттеулер үшін):",
      specificPrepTitle: "🔍 Әрбір зерттеу үшін жеке дайындық:",
      contraTitle: "🚫 Қарсы көрсетілімдер:",
      noSpecificPrep: "- Арнайы дайындық талап етілмейді (Жалпы ережелерді сақтаңыз).",
      fasting: "Кемінде {H} сағат аш қарынға келу (барлық тағайындалған зерттеулерді ескере отырып).",
      bloodTest: "Қандағы Креатинин және Несепнәр талдауының нәтижелері (соңғы 3 күн ішінде).",
      metformin: "Қант диабеті кезінде: Метформин (Глюкофаж, Сиофор ж.б.) қабылдауды 48 сағат бұрын тоқтату.",
      postHydration: "Зерттеуден кейін көп мөлшерде сұйықтық (су) ішу.",
      metalWarning: "Барлық металл бұйымдарды, сағат, телефон және әшекейлерді шешу міндетті.",
      claustrophobia: "Клаустрофобия (жабық кеңістіктен қорқу) болса, дәрігерге ескертіңіз.",
      allergy: "Йодты немесе контрастты заттарға аллергия.",
      kidney: "Бүйрек жеткіліксіздігі (жоғары креатинин).",
      hyperthyroidism: "Гипертиреоз (қалқанша без ауруы).",
      pregnancy: "Жүктілік және бала емізу кезеңі.",
      pacemaker: "Кардиостимулятор немесе металл импланттардың болуы (МРТ үшін абсолютті қарсы көрсетілім!)."
    },
    tg: {
      boxTitle: "ДАСТУРҲОИ ТИББӢ ВА ЁДДОШТ",
      generalPrepTitle: "📌 Омодагии умумӣ (Барои ҳамаи ташхисҳо):",
      specificPrepTitle: "🔍 Омодагии инфиродӣ ба ҳар як ташхис:",
      contraTitle: "🚫 Нишондодҳои манъшуда:",
      noSpecificPrep: "- Омодагии махсус талаб карда намешавад (қоидаҳои умумиро риоя намоед).",
      fasting: "На камтар аз {H} соат пеш аз ташхис бо шиками холӣ омадан.",
      bloodTest: "Натиҷаи таҳлили хун барои Креатинин ва Мочевина (на зиёда аз 3 рӯз).",
      metformin: "Ҳангоми диабети қанд: қабули Метформин (Глюкофаж, Сиофор ва ғ.)-ро 48 соат пеш қатъ намоед.",
      postHydration: "Пас аз ташхис ба миқдори зиёд об нӯшидан.",
      metalWarning: "Ҳатман тамоми ашёи филизӣ, соат, телефон ва ҷавоҳиротро кашед.",
      claustrophobia: "Дар сурати тарси ҷойҳои маҳкам (клаустрофобия) духтурро огоҳ намоед.",
      allergy: "Аллергия ба маводи контрастии дорои йод.",
      kidney: "Норасогии гурдаҳо (креатинини баланд).",
      hyperthyroidism: "Гипертиреоз (бемории ғадуди сипаршакл).",
      pregnancy: "Ҳомиладорӣ ва давраи ширмаконӣ.",
      pacemaker: "Мавҷудияти кардиостимулятори дил (Манъи мутлақ барои МРТ!)."
    },
    tr: {
      boxTitle: "TIBBİ TALİMATLAR VE BİLGİLENDİRME",
      generalPrepTitle: "📌 Genel Hazırlık (Tüm tetkikler için):",
      specificPrepTitle: "🔍 Her Tetkik İçin Özel Hazırlık:",
      contraTitle: "🚫 Kontrendikasyonlar:",
      noSpecificPrep: "- Özel bir hazırlık gerekmemektedir (Genel kurallara uyunuz).",
      fasting: "Tüm tetkikler göz önüne alınarak en az {H} saat aç karnına gelinmelidir.",
      bloodTest: "Kanda Kreatinin ve Üre tahlili sonucu (son 3 gün içinde yapılmış olmalı).",
      metformin: "Diyabet hastalarında: Metformin (Glukofaj, Siofor vb.) ilacını tetkikten 48 saat önce kesiniz.",
      postHydration: "Tetkikten sonra bol miktarda sıvı (su) tüketiniz.",
      metalWarning: "Tüm metal eşyalar, saat, telefon, kemer ve takılar çıkarılmalıdır.",
      claustrophobia: "Kapalı alan korkusu (klostrofobi) varsa personele bildiriniz.",
      allergy: "İyotlu veya kontrast maddelere karşı alerji öyküsü.",
      kidney: "Böbrek yetmezliği (yüksek kreatinin seviyesi).",
      hyperthyroidism: "Hipertiroidizm (zehirli guatr / tiroid hastalığı).",
      pregnancy: "Hamilelik ve emzirme dönemi.",
      pacemaker: "Kalp pili veya ferromanyetik implant varlığı (MR için kesin kontrendikasyon!)."
    }
  },

  // 3. QOLDIRISH VA VOS KECHISH SABABLARI (Deferral Reasons)
  deferReasons: {
    "Bemorning shaxsiy iltimosi / Vaqti to'g'ri kelmadi": {
      uz: "Bemorning shaxsiy iltimosi / Vaqti to'g'ri kelmadi",
      ru: "Личная просьба пациента / Неудобное время",
      en: "Patient's personal request / Inconvenient time",
      kk: "Науқастың жеке өтініші / Уақыты сәйкес келмеді",
      tg: "Хоҳиши шахсии бемор / Вақти номувофиқ",
      tr: "Hastanın kişisel talebi / Uygun olmayan saat"
    },
    "Bemor tayyorgarlik ko'rishga ulgurmaydi (och qorin / tahlillar topshirish)": {
      uz: "Bemor tayyorgarlik ko'rishga ulgurmaydi (och qorin / tahlillar topshirish)",
      ru: "Пациент не успевает подготовиться (натощак / сдача анализов)",
      en: "Patient unable to prepare in time (fasting / lab tests)",
      kk: "Науқас дайындалып үлгермейді (аш қарын / талдаулар тапсыру)",
      tg: "Бемор омодагӣ дида наметавонад (шиками холӣ / супоридани таҳлилҳо)",
      tr: "Hasta hazırlık yapmaya yetişemiyor (açlık / tahlil verme)"
    },
    "Uzoqdan / viloyatdan yo'lda kelmoqda": {
      uz: "Uzoqdan / viloyatdan yo'lda kelmoqda",
      ru: "Пациент в дороге из дальнего региона / области",
      en: "Traveling from a distant region / on the way",
      kk: "Алыс облыстан / жолда келе жатыр",
      tg: "Аз вилоят / дар роҳ қарор дорад",
      tr: "Uzak ilden yolda geliyor"
    },
    "Boshqa shifokor ko'rigi yoki boshqa muolajasi bor": {
      uz: "Boshqa shifokor ko'rigi yoki boshqa muolajasi bor",
      ru: "Назначен осмотр у другого врача или другая процедура",
      en: "Has an appointment with another doctor or other treatment",
      kk: "Басқа дәрігердің қарауы немесе басқа емдеу шарасы бар",
      tg: "Муоинаи табиби дигар ё муолиҷаи дигар дорад",
      tr: "Başka bir doktor muayenesi veya tedavisi mevcut"
    }
  },

  // 4. ROZILIK ANKETASI (A4 Consent Form)
  consent: {
    uz: {
      ministryTitle: "RESPUBLIKA IXTISOSLASHTIRILGAN\nONKOLOGIYA VA RADIOLOGIYA\nILMIY-AMALIY TIBBIYOT MARKAZI",
      docTitle: "{examType} TEKSHIRUVINI O‘TKAZISHGA ROZILIK HUJJATI",
      codeNo: "Kod No:",
      publishDate: "Nashr sanasi:",
      reviewDate: "Ko‘rib chiqish sanasi:",
      examNum: "Tekshiruv raqami:",
      pageCount: "Sahifa/Sahifalar soni:",
      patientName: "Bemor F.I.Sh:",
      patientId: "Bemor ID:",
      appTime: "Qabul Sanasi & Vaqti:",
      patientCategory: "Bemor Toifasi:",
      referringDoc: "Fayl / Yo‘naltirgan shifokor:",
      deviceRoom: "Qurilma / Xona:",
      serviceName: "Tekshiruv Nomi:",
      height: "Bemor Bo‘yi:",
      weight: "Bemor Vazni:",
      stationary: "Bo'limda yotibdi (Statsionar)",
      ambulatory: "Uyidan qatnaydi (Ambulator)",
      contrastTag: "KONTRASTLI",
      labTitle: "💉 LABORATORIYA TAHLILLARI (KONTRASTLI TEKSHIRUVLAR UCHUN MAJBURIY):",
      creatinine: "Qonda Kreatinin miqdori:",
      urea: "Qonda Mochevina (Urea):",
      labDate: "Tahlil topshirilgan sana:",
      labNotice: "* Kreatinin normasi: Ayollarda 44–80 mkmol/l, Erkaklarda 62–106 mkmol/l. Qandli diabet bo‘yicha Metformin (Glyukofaj) qabul qiluvchi bemorlar preparatni tekshiruvdan 48 soat oldin to‘xtatishi shart.",
      section1: "I. TIBBIY XAVFSIZLIK VA QARSHI KO‘RSATMALAR SAVOLNOMASI",
      criteriaHeader: "Xavfsizlik va tibbiy qarshi ko‘rsatmalar mezoni",
      yes: "HA",
      no: "YO‘Q",
      section2: "II. BEMORNING (YOKI QONUNIY VAKILINING) XABARDOR QILINGAN ROZILIGI",
      declaration: "Men, ushbu anketada ko‘rsatilgan barcha ma‘lumotlarni to‘liq va haqqoniy taqdim etganimni tasdiqlayman. Menga o‘tkaziladigan {examType} tekshiruvining maqsadi, o‘tkazilish tartibi, xavfsizlik talablari (shu jumladan barcha metall buyumlar, soat, telefon, bank kartalari, kamar, sirg‘a va kiyimdagi temir detallarni yechish zarurligi) hamda kontrast modda yuborilganda ehtimoliy individual reaksiyalar haqida to‘liq tushuntirildi.\nShifokor va operator ko‘rsatmalariga rioya qilishga roziman va tekshiruv o‘tkazilishiga o‘z ixtiyoriy roziligimni bildiraman.\n* DIQQAT: Agar tekshiruv vaqtida bemor tomonidan (yoki bemor sababli) tekshiruv to‘xtatilsa, tekshiruv uchun navbat qaytadan qo‘yiladi.",
      section3: "III. TASDIQLASH VA IMZOLAR",
      sigPatient: "1. Bemor (yoki qonuniy vakili):",
      sigRegistrar: "2. Ro‘yxatga oluvchi (Registrator):",
      sigLaborant: "3. Rentgen-laborant (Operator):",
      sigDoctor: "4. Shifokor (Vrach-radiolog):",
      fullName: "F.I.Sh:",
      signature: "Imzo:",
      date: "Sana:"
    },
    ru: {
      ministryTitle: "РЕСПУБЛИКАНСКИЙ СПЕЦИАЛИЗИРОВАННЫЙ\nНАУЧНО-ПРАКТИЧЕСКИЙ МЕДИЦИНСКИЙ ЦЕНТР\nОНКОЛОГИИ И РАДИОЛОГИИ",
      docTitle: "ИНФОРМИРОВАННОЕ ДОБРОВОЛЬНОЕ СОГЛАСИЕ НА ПРОВЕДЕНИЕ ИССЛЕДОВАНИЯ {examType}",
      codeNo: "Код No:",
      publishDate: "Дата публикации:",
      reviewDate: "Дата пересмотра:",
      examNum: "Номер исследования:",
      pageCount: "Количество страниц:",
      patientName: "Ф.И.О. Пациента:",
      patientId: "ID Пациента:",
      appTime: "Дата и время приёма:",
      patientCategory: "Категория пациента:",
      referringDoc: "Направивший врач / Отделение:",
      deviceRoom: "Аппарат / Кабинет:",
      serviceName: "Название исследования:",
      height: "Рост пациента:",
      weight: "Вес пациента:",
      stationary: "Стационарный больной (Отделение)",
      ambulatory: "Амбулаторный пациент",
      contrastTag: "С КОНТРАСТОМ",
      labTitle: "💉 ЛАБОРАТОРНЫЕ АНАЛИЗЫ (ОБЯЗАТЕЛЬНО ПРИ КОНТРАСТИРОВАНИИ):",
      creatinine: "Креатинин крови:",
      urea: "Мочевина (Urea) крови:",
      labDate: "Дата сдачи анализа:",
      labNotice: "* Норма креатинина: Женщины 44–80 мкмоль/л, Мужчины 62–106 мкмоль/л. Пациентам с сахарным диабетом, принимающим Метформин (Глюкофаж), необходимо отменить препарат за 48 часов до исследования.",
      section1: "I. АНКЕТА МЕДИЦИНСКОЙ БЕЗОПАСНОСТИ И ПРОТИВОПОКАЗАНИЙ",
      criteriaHeader: "Критерии безопасности и противопоказаний",
      yes: "ДА",
      no: "НЕТ",
      section2: "II. ИНФОРМИРОВАННОЕ СОГЛАСИЕ ПАЦИЕНТА (ИЛИ ЗАКОННОГО ПРЕДСТАВИТЕЛЯ)",
      declaration: "Я подтверждаю, что предоставил(а) полную и достоверную информацию о состоянии своего здоровья. Мне в доступной форме разъяснены цели, порядок проведения исследования {examType}, правила безопасности (включая снятие всех металлических предметов, часов, телефона, украшений и ремня), а также возможные индивидуальные реакции на введение контрастного вещества.\nЯ согласен(на) следовать инструкциям медицинского персонала и добровольно даю согласие на проведение исследования.\n* ВНИМАНИЕ: Если во время исследования процедура будет прервана по инициативе пациента, очередь на повторное исследование аннулируется и назначается заново.",
      section3: "III. ПОДТВЕРЖДЕНИЕ И ПОДПИСИ",
      sigPatient: "1. Пациент (или законный представитель):",
      sigRegistrar: "2. Регистратор:",
      sigLaborant: "3. Рентген-лаборант (Оператор):",
      sigDoctor: "4. Врач-радиолог:",
      fullName: "Ф.И.О.:",
      signature: "Подпись:",
      date: "Дата:"
    },
    en: {
      ministryTitle: "REPUBLICAN SPECIALIZED SCIENTIFIC AND PRACTICAL\nMEDICAL CENTER OF ONCOLOGY AND RADIOLOGY",
      docTitle: "INFORMED CONSENT FOR {examType} EXAMINATION",
      codeNo: "Code No:",
      publishDate: "Publish Date:",
      reviewDate: "Review Date:",
      examNum: "Exam Number:",
      pageCount: "Page / Total:",
      patientName: "Patient Full Name:",
      patientId: "Patient ID:",
      appTime: "Appointment Date & Time:",
      patientCategory: "Patient Category:",
      referringDoc: "Referring Doctor / File:",
      deviceRoom: "Room / Device:",
      serviceName: "Examination Name:",
      height: "Patient Height:",
      weight: "Patient Weight:",
      stationary: "Inpatient (Hospitalized)",
      ambulatory: "Outpatient (Ambulatory)",
      contrastTag: "WITH CONTRAST",
      labTitle: "💉 LABORATORY TESTS (MANDATORY FOR CONTRAST STUDIES):",
      creatinine: "Serum Creatinine:",
      urea: "Blood Urea Nitrogen (BUN):",
      labDate: "Test Date:",
      labNotice: "* Creatinine normal range: Females 44–80 µmol/L, Males 62–106 µmol/L. Diabetic patients taking Metformin must discontinue medication 48 hours prior to contrast administration.",
      section1: "I. MEDICAL SAFETY & CONTRAINDICATION QUESTIONNAIRE",
      criteriaHeader: "Safety Criteria & Medical Conditions",
      yes: "YES",
      no: "NO",
      section2: "II. INFORMED CONSENT OF PATIENT (OR LEGAL REPRESENTATIVE)",
      declaration: "I confirm that all information provided in this questionnaire is true, complete, and accurate. The purpose, procedure, safety requirements of {examType} (including removal of all metal objects, watches, phones, cards, and jewelry), and potential risks of contrast administration have been fully explained to me.\nI agree to follow all instructions from the medical staff and voluntarily consent to undergo this examination.\n* NOTICE: If the examination is interrupted by or due to the patient during scanning, a new appointment must be rescheduled.",
      section3: "III. SIGNATURES & VERIFICATION",
      sigPatient: "1. Patient (or Legal Guardian):",
      sigRegistrar: "2. Registrar / Receptionist:",
      sigLaborant: "3. Radiologic Technologist (Operator):",
      sigDoctor: "4. Radiologist (Doctor):",
      fullName: "Full Name:",
      signature: "Signature:",
      date: "Date:"
    },
    kk: {
      ministryTitle: "РЕСПУБЛИКАЛЫҚ МАМАНДАНДЫРЫЛҒАН\nОНКОЛОГИЯ ЖӘНЕ РАДИОЛОГИЯ\nҒЫЛЫМИ-ТӘЖІРИБЕЛІК МЕДИЦИНА ОРТАЛЫҒЫ",
      docTitle: "{examType} ЗЕРТТЕУІН ЖҮРГІЗУГЕ АҚПАРАТТАНДЫРЫЛҒАН КЕЛІСІМ ҚҰЖАТЫ",
      codeNo: "Код No:",
      publishDate: "Жарияланған күні:",
      reviewDate: "Қайта қаралған күні:",
      examNum: "Зерттеу нөмірі:",
      pageCount: "Бет / Барлық беттер:",
      patientName: "Науқастың Т.А.Ә:",
      patientId: "Науқас ID:",
      appTime: "Қабылдау күні мен уақыты:",
      patientCategory: "Науқас санаты:",
      referringDoc: "Жолдаған дәрігер / Бөлімше:",
      deviceRoom: "Құрылғы / Бөлме:",
      serviceName: "Зерттеу атауы:",
      height: "Науқас бойы:",
      weight: "Науқас салмағы:",
      stationary: "Бөлімшеде (Стационар)",
      ambulatory: "Амбулаториялық науқас",
      contrastTag: "КОНТРАСТПЕН",
      labTitle: "💉 ЗЕРТХАНАЛЫҚ ТАЛДАУЛАР (КОНТРАСТТЫ ЗЕРТТЕУЛЕР ҮШІН МІНДЕТТІ):",
      creatinine: "Қандағы Креатинин:",
      urea: "Қандағы Несепнәр (Urea):",
      labDate: "Талдау тапсырылған күн:",
      labNotice: "* Креатинин нормасы: Әйелдерде 44–80 мкмоль/л, Ерлерде 62–106 мкмоль/л. Метформин қабылдайтын қант диабеті бар науқастар препаратты зерттеуден 48 сағат бұрын тоқтатуы тиіс.",
      section1: "I. МЕДИЦИНАЛЫҚ ҚАУІПСІЗДІК ЖӘНЕ ҚАРСЫ КӨРСЕТІЛІМДЕР САУАЛНАМАСЫ",
      criteriaHeader: "Қауіпсіздік және медициналық қарсы көрсетілімдер критерийі",
      yes: "ИӘ",
      no: "ЖОҚ",
      section2: "II. НАУҚАСТЫҢ (НЕМЕСЕ ЗАҢДЫ ӨКІЛІНІҢ) АҚПАРАТТАНДЫРЫЛҒАН КЕЛІСІМІ",
      declaration: "Мен осы сауалнамада көрсетілген барлық мәліметтердің толық әрі шынайы екенін растаймын. Маған өткізілетін {examType} зерттеуінің мақсаты, тәртібі, қауіпсіздік талаптары (барлық металл заттарды, сағат, телефон және әшекейлерді шешу қажеттілігі) толық түсіндірілді.\nДәрігер мен оператордың нұсқауларын орындауға келісемін және зерттеуді жүргізуге өз еркіммен келісім беремін.",
      section3: "III. РАСТАУ ЖӘНЕ ҚОЛДАР",
      sigPatient: "1. Науқас (немесе заңды өкілі):",
      sigRegistrar: "2. Тіркеуші:",
      sigLaborant: "3. Рентген-лаборант (Оператор):",
      sigDoctor: "4. Дәрігер (Рентгенолог):",
      fullName: "Т.А.Ә.:",
      signature: "Қолы:",
      date: "Күні:"
    },
    tg: {
      ministryTitle: "МАРКАЗИ ИЛМИЮ АМАЛИИ ТИББИИ\nСПЕТСИАЛИЗОНИДАШУДАИ ҶУМҲУРИЯВИИ\nОНКОЛОГИЯ ВА РАДИОЛОГИЯ",
      docTitle: "РИЗОИЯТИ ОГОҲОНА БАРОИ ГУЗАРОНИДАНИ ТАШХИСИ {examType}",
      codeNo: "Рақами рамз:",
      publishDate: "Санаи нашр:",
      reviewDate: "Санаи бозбинӣ:",
      examNum: "Рақами ташхис:",
      pageCount: "Саҳифа / Шумораи умумӣ:",
      patientName: "Н.Н.О-и Бемор:",
      patientId: "ID-и Бемор:",
      appTime: "Сана ва вақти қабул:",
      patientCategory: "Гурӯҳи бемор:",
      referringDoc: "Духтури роҳхатдиҳанда / Парванда:",
      deviceRoom: "Дастгоҳ / Ҳуҷра:",
      serviceName: "Номи ташхис:",
      height: "Қади бемор:",
      weight: "Вазни бемор:",
      stationary: "Дар шуъба (Статсионар)",
      ambulatory: "Амбулаторӣ",
      contrastTag: "БО КОНТРАСТ",
      labTitle: "💉 ТАҲЛИЛҲОИ ОЗМОИШГОҲӢ (БАРОИ ТАШХИСҲОИ КОНТРАСТӢ ҲАТМӢ):",
      creatinine: "Креатинини хун:",
      urea: "Мочевинаи хун:",
      labDate: "Санаи супоридани таҳлил:",
      labNotice: "* Меъёри креатинин: Занон 44–80 мкмол/л, Мардон 62–106 мкмол/л. Беморони гирифтори диабети қанд, ки Метформин мегиранд, бояд доруро 48 соат пеш аз ташхис қатъ намоянд.",
      section1: "I. САВОЛНОМАИ БЕХАТАРИИ ТИББӢ ВА НИШОНДОДҲОИ МАНЪШУДА",
      criteriaHeader: "Меъёрҳои бехатарӣ ва нишондодҳои манъшуда",
      yes: "ҲА",
      no: "НЕ",
      section2: "II. РИЗОИЯТИ ОГОҲОНАИ БЕМОР (Ё НАМОЯНДАИ ҚОНУНӢ)",
      declaration: "Ман тасдиқ мекунам, ки ҳамаи маълумоти дар ин саволнома овардашуда пурра ва ҳақиқӣ мебошанд. Мақсад, тартиби гузаронидани ташхиси {examType}, талаботи бехатарӣ (аз ҷумла кашидани ҳамаи ашёи филизӣ, соат, телефон ва ҷавоҳирот) ба ман пурра фаҳмонида шуд.\nБа иҷрои дастурҳои табиб ва оператор розӣ ҳастам ва барои гузаронидани ташхис ризоияти худро медиҳам.",
      section3: "III. ТАСДИҚ ВА ИМЗОҲО",
      sigPatient: "1. Бемор (ё намояндаи қонунӣ):",
      sigRegistrar: "2. Бақайдгиранда:",
      sigLaborant: "3. Рентген-лаборант (Оператор):",
      sigDoctor: "4. Табиб-радиолог:",
      fullName: "Н.Н.О.:",
      signature: "Имзо:",
      date: "Сана:"
    },
    tr: {
      ministryTitle: "CUMHURİYETİ ONKOLOJİ VE RADYOLOJİ\nUZMANLAŞMIŞ BİLİMSEL-UYGULAMALI\nTIBBİ MERKEZİ",
      docTitle: "{examType} TETKİKİ İÇİN BİLGİLENDİRİLMİŞ ONAM FORMU",
      codeNo: "Kod No:",
      publishDate: "Yayın Tarihi:",
      reviewDate: "Revizyon Tarihi:",
      examNum: "Tetkik No:",
      pageCount: "Sayfa / Toplam:",
      patientName: "Hasta Adı Soyadı:",
      patientId: "Hasta ID:",
      appTime: "Randevu Tarih ve Saati:",
      patientCategory: "Hasta Kategorisi:",
      referringDoc: "Yönlendiren Hekim / Servis:",
      deviceRoom: "Cihaz / Oda:",
      serviceName: "Tetkik Adı:",
      height: "Hasta Boyu:",
      weight: "Hasta Kilosu:",
      stationary: "Yatan Hasta (Servis)",
      ambulatory: "Ayaktan Hasta",
      contrastTag: "KONTRASTLI",
      labTitle: "💉 LABORATUVAR TAHLİLLERİ (KONTRASTLI ÇEKİMLER İÇİN ZORUNLUDUR):",
      creatinine: "Kanda Kreatinin Değeri:",
      urea: "Kanda Üre Değeri:",
      labDate: "Tahlil Tarihi:",
      labNotice: "* Kreatinin normal aralığı: Kadınlar 44–80 µmol/L, Erkekler 62–106 µmol/L. Şeker hastalarında Metformin kullanan hastaların ilacı çekimden 48 saat önce kesmesi zorunludur.",
      section1: "I. TIBBİ GÜVENLİK VE KONTRENDİKASYON FORMU",
      criteriaHeader: "Güvenlik Kriterleri ve Tıbbi Kontrendikasyonlar",
      yes: "EVET",
      no: "HAYIR",
      section2: "II. HASTANIN (VEYA YASAL TEMSİLCİSİNİN) BİLGİLENDİRİLMİŞ ONAMI",
      declaration: "Bu formda vermiş olduğum tüm bilgilerin doğru ve eksiksiz olduğunu beyan ederim. Bana yapılacak olan {examType} tetkikinin amacı, uygulama şekli, güvenlik kuralları (tüm metal eşya, saat, telefon ve takıların çıkarılması) ve kontrast maddeye bağlı gelişebilecek olası reaksiyonlar açıkça anlatılmıştır.\nSağlık personelinin talimatlarına uymayı kabul ediyor ve tetkikin yapılmasına özgür irademle onay veriyorum.",
      section3: "III. ONAY VE İMZALAR",
      sigPatient: "1. Hasta (veya Yasal Temsilcisi):",
      sigRegistrar: "2. Kayıt Görevlisi:",
      sigLaborant: "3. Radyoloji Teknikeri (Operatör):",
      sigDoctor: "4. Radyoloji Uzmanı (Doktor):",
      fullName: "Adı Soyadı:",
      signature: "İmza:",
      date: "Tarih:"
    }
  },

  // 5. TIBBIY XAVFSIZLIK SAVOLLARI (Questionnaire items)
  questions: {
    pacemaker: {
      uz: "Sizda yurak stimulyatori (kardiostimulyator), defibrillyator yoki neyrostimulyator bormi?",
      ru: "Установлен ли у вас кардиостимулятор, дефибриллятор или нейростимулятор?",
      en: "Do you have a cardiac pacemaker, defibrillator, or neurostimulator?",
      kk: "Сізде кардиостимулятор, дефибриллятор немесе нейростимулятор орнатылған ба?",
      tg: "Оё шумо кардиостимулятори дил, дефибриллятор ё нейростимулятор доред?",
      tr: "Vücudunuzda kalp pili (pacemaker), defibrilatör veya nörostimülatör var mı?"
    },
    metalImplants: {
      uz: "Tanangizda metall implantlar, sun‘iy bo‘g‘im, qon tomir klipi, plastinka, vint yoki metall parchalari bormi?",
      ru: "Имеются ли в теле металлические импланты, эндопротезы, сосудистые клипсы, пластины, винты или осколки?",
      en: "Do you have metal implants, artificial joints, aneurysm clips, plates, screws, or metal fragments?",
      kk: "Денеңізде металл импланттар, эндопротездер, тамыр клипсалары, пластиналар, бұрандалар немесе жарықшақтар бар ма?",
      tg: "Оё дар бадани шумо имплантҳои филизӣ, буғумҳои сунъӣ, клипҳои рагҳо, пластинаҳо ё пораҳои филизӣ мавҷуданд?",
      tr: "Vücudunuzda metal implant, protez, damar klipsi, platin, vida veya metal şarapnel parçası var mı?"
    },
    claustrophobia: {
      uz: "Klavstrofobiya (yopiq yoki tor joylardan qo‘rqish) holati bormi?",
      ru: "Страдаете ли вы клаустрофобией (боязнью замкнутого или узкого пространства)?",
      en: "Do you suffer from claustrophobia (fear of enclosed spaces)?",
      kk: "Клаустрофобия (жабық немесе тар кеңістіктен қорқу) сезімі бар ма?",
      tg: "Оё шумо аз ҷойҳои танг ё пӯшида тарс (клаустрофобия) доред?",
      tr: "Kapalı veya dar alan korkunuz (klostrofobi) var mı?"
    },
    pregnancy: {
      uz: "Homiladorlik (ehtimoli) yoki emizikli davringizdami? (Ayollar uchun)",
      ru: "Имеется ли (вероятность) беременность или период грудного вскармливания? (Для женщин)",
      en: "Are you pregnant (or potentially pregnant) or breastfeeding? (For females)",
      kk: "Жүктілік (болуы мүмкін) немесе бала емізу кезеңіндесіз бе? (Әйелдер үшін)",
      tg: "Оё ҳомиладор ҳастед (ё эҳтимоли он ҳаст) ё кӯдаки ширмак доред? (Барои занон)",
      tr: "Hamilelik (şüphesi) veya emzirme durumunuz var mı? (Kadınlar için)"
    },
    allergy: {
      uz: "Dori vositalariga, yodga yoki kontrast moddalarga allergiya kuzatilganmi?",
      ru: "Были ли аллергические реакции на медикаменты, йод или контрастные вещества?",
      en: "Have you ever had an allergic reaction to medications, iodine, or contrast media?",
      kk: "Дәрілік заттарға, йодқа немесе контрастты препараттарға аллергия болған ба?",
      tg: "Оё ба доруворӣ, йод ё маводи контрастӣ аксуламали аллергӣ доред?",
      tr: "İlaçlara, iyota veya kontrast maddelere karşı bilinen bir alerjiniz var mı?"
    },
    kidney: {
      uz: "Buyrak yetishmovchiligi yoki buyrak kasalliklari bormi? (Gemodializ olasizmi?)",
      ru: "Имеются ли заболевания почек или почечная недостаточность? (Находитесь ли на гемодиализе?)",
      en: "Do you have kidney disease or renal insufficiency? (Are you on hemodialysis?)",
      kk: "Бүйрек жеткіліксіздігі немесе бүйрек аурулары бар ма? (Гемодиализ аласыз ба?)",
      tg: "Оё бемории гурда ё норасогии гурда доред? (Дар гемодиализ ҳастед?)",
      tr: "Böbrek yetmezliği veya böbrek hastalığınız var mı? (Diyaliz alıyor musunuz?)"
    },
    asthmaDiabetes: {
      uz: "Bronxial astma, qandli diabet yoki qalqonsimon bez kasalliklari bormi?",
      ru: "Имеются ли бронхиальная астма, сахарный диабет или заболевания щитовидной железы?",
      en: "Do you have bronchial asthma, diabetes mellitus, or thyroid disease?",
      kk: "Бронх демікпесі, қант диабеті немесе қалқанша без аурулары бар ма?",
      tg: "Оё нафастангии бронхиалӣ, диабети қанд ё бемории ғадуди сипаршакл доред?",
      tr: "Astım, şeker hastalığı (diyabet) veya tiroid bezi rahatsızlığınız var mı?"
    },
    hearingDental: {
      uz: "Eshitish apparati, olinadigan tish protezi, tana pirsingi yoki tatuirovka bormi?",
      ru: "Имеются ли слуховой аппарат, съемные зубные протезы, пирсинг или татуировки?",
      en: "Do you have a hearing aid, removable dentures, body piercing, or tattoos?",
      kk: "Есту аппараты, алынбалы тіс протездері, пирсинг немесе татуировка бар ма?",
      tg: "Оё дастгоҳи шунавоӣ, протези ҷудошавандаи дандон, пирсинг ё татуировка доред?",
      tr: "İşitme cihazı, hareketli diş protezi, piercing veya dövmeniz var mı?"
    },
    abdominalFasting: {
      uz: "Qorin bo'shlig'i tekshiruvlari uchun kamida 6-8 soat och qoldingizmi?",
      ru: "Соблюдали ли вы голодный режим не менее 6-8 часов для исследования брюшной полости?",
      en: "Have you fasted for at least 6-8 hours for abdominal examinations?",
      kk: "Құрсақ қуысын зерттеу үшін кемінде 6-8 сағат аш қалдыңыз ба?",
      tg: "Оё барои ташхиси узвҳои шикам на камтар аз 6-8 соат нахӯрда омадаед?",
      tr: "Karın bölgesi çekimleri için en az 6-8 saat aç kaldınız mı?"
    },
    pelvicBladder: {
      uz: "Kichik chanoq tekshiruvlari uchun qovuqni to'ldirish (suv ichish) qoidasiga amal qildingizmi?",
      ru: "Соблюдали ли вы правило наполнения мочевого пузыря для исследования малого таза?",
      en: "Did you follow bladder filling instructions (drinking water) for pelvic examinations?",
      kk: "Кіші жамбас қуысын зерттеу үшін қуықты толтыру ережесін сақтадыңыз ба?",
      tg: "Оё барои ташхиси коси хурд масонаро бо пешоб пур карда омадед?",
      tr: "Pelvik çekimler için idrara sıkışma (su içme) kuralına uydunuz mu?"
    }
  },

  // 6. TEKSHIRUVLAR LUG'ATI (Service anatomical names translation)
  services: {
    "bosh miya": { ru: "Головной мозг", en: "Brain / Head", kk: "Бас миы", tg: "Мағзи сар", tr: "Beyin" },
    "bosh": { ru: "Голова", en: "Head", kk: "Бас", tg: "Сар", tr: "Baş" },
    "bo'yin": { ru: "Шея / Шейный отдел", en: "Neck / Cervical", kk: "Мойын", tg: "Гардан", tr: "Boyun" },
    "umurtqa": { ru: "Позвоночник", en: "Spine", kk: "Омыртқа", tg: "Сутунмӯҳра", tr: "Omurga" },
    "bel-dumg'aza": { ru: "Пояснично-крестцовый отдел", en: "Lumbar-Sacral Spine", kk: "Бел-сегізкөз", tg: "Камару думғоза", tr: "Lomber-Sakral" },
    "ko'krak": { ru: "Грудная клетка", en: "Chest / Thoracic", kk: "Көкірек қуысы", tg: "Қафаси сина", tr: "Göğüs" },
    "qorin bo'shlig'i": { ru: "Брюшная полость", en: "Abdomen", kk: "Құрсақ қуысы", tg: "Шикам", tr: "Karın" },
    "kichik chanoq": { ru: "Малый таз", en: "Pelvis", kk: "Кіші жамбас", tg: "Коси хурд", tr: "Pelvis" },
    "tizza bo'g'imi": { ru: "Коленный сустав", en: "Knee Joint", kk: "Тізе буыны", tg: "Буғуми зону", tr: "Diz Eklemi" },
    "chanoq-son bo'g'imi": { ru: "Тазобедренный сустав", en: "Hip Joint", kk: "Ұршық буыны", tg: "Буғуми рон", tr: "Kalça Eklemi" },
    "yelka bo'g'imi": { ru: "Плечевой сустав", en: "Shoulder Joint", kk: "Иық буыны", tg: "Буғуми китф", tr: "Omuz Eklemi" }
  },

  // 7. XONALAR LUG'ATI (Room / Device translation)
  rooms: {
    "1-MRT Xonasi": { ru: "Кабинет 1 (МРТ)", en: "Room 1 (MRI)", kk: "1-МРТ Бөлмесі", tg: "Ҳуҷраи 1 (МРТ)", tr: "1. MR Odası" },
    "2-MRT Xonasi": { ru: "Кабинет 2 (МРТ)", en: "Room 2 (MRI)", kk: "2-МРТ Бөлмесі", tg: "Ҳуҷраи 2 (МРТ)", tr: "2. MR Odası" },
    "1-MSKT Xonasi": { ru: "Кабинет 1 (МСКТ)", en: "Room 1 (MSCT)", kk: "1-МСКТ Бөлмесі", tg: "Ҳуҷраи 1 (МСКТ)", tr: "1. BT Odası" }
  },

  // 8. INTERFEYS MATNLARI (UI Elements)
  ui: {
    uz: {
      queueTitle: "Bugungi Navbat Ro'yxati",
      newPatientBtn: "Yangi Navbat Berish",
      exportExcelBtn: "Excelga Yuklash",
      searchPlaceholder: "Bemor ID, F.I.Sh yoki xona bo'yicha qidirish...",
      totalPatients: "Jami Bemorlar",
      waitingPatients: "Kutayotganlar",
      callingPatients: "Chaqirilmoqda",
      completedPatients: "Yakunlanganlar",
      tableTime: "Vaqt",
      tableTicket: "Talon ID",
      tablePatient: "Bemor F.I.Sh",
      tableType: "Bemor Toifasi",
      tableService: "Tekshiruv Nomi",
      tableRoom: "Xona / Qurilma",
      tableReferring: "Yo'naltirgan Shifokor",
      tableStatus: "Holat",
      tableActions: "Harakatlar"
    },
    ru: {
      queueTitle: "Список текущей очереди",
      newPatientBtn: "Записать в очередь",
      exportExcelBtn: "Экспорт в Excel",
      searchPlaceholder: "Поиск по ID, Ф.И.О. или кабинету...",
      totalPatients: "Всего пациентов",
      waitingPatients: "Ожидают",
      callingPatients: "Вызываются",
      completedPatients: "Завершено",
      tableTime: "Время",
      tableTicket: "Талон ID",
      tablePatient: "Ф.И.О. Пациента",
      tableType: "Категория",
      tableService: "Исследование",
      tableRoom: "Кабинет / Аппарат",
      tableReferring: "Направивший врач",
      tableStatus: "Статус",
      tableActions: "Действия"
    },
    en: {
      queueTitle: "Today's Patient Queue",
      newPatientBtn: "Book New Appointment",
      exportExcelBtn: "Export to Excel",
      searchPlaceholder: "Search by ID, Name, or Room...",
      totalPatients: "Total Patients",
      waitingPatients: "Waiting",
      callingPatients: "Calling",
      completedPatients: "Completed",
      tableTime: "Time",
      tableTicket: "Ticket ID",
      tablePatient: "Patient Name",
      tableType: "Category",
      tableService: "Examination",
      tableRoom: "Room / Device",
      tableReferring: "Referring Doctor",
      tableStatus: "Status",
      tableActions: "Actions"
    },
    kk: {
      queueTitle: "Бүгінгі кезек тізімі",
      newPatientBtn: "Жаңа кезек беру",
      exportExcelBtn: "Excel-ге жүктеу",
      searchPlaceholder: "ID, Т.А.Ә. немесе бөлме бойынша іздеу...",
      totalPatients: "Барлық науқастар",
      waitingPatients: "Күтудегілер",
      callingPatients: "Шақырылуда",
      completedPatients: "Аяқталғандар",
      tableTime: "Уақыты",
      tableTicket: "Талон ID",
      tablePatient: "Науқастың Т.А.Ә.",
      tableType: "Санаты",
      tableService: "Зерттеу атауы",
      tableRoom: "Бөлме / Құрылғы",
      tableReferring: "Жолдаған дәрігер",
      tableStatus: "Күйі",
      tableActions: "Әрекеттер"
    },
    tg: {
      queueTitle: "Рӯйхати навбати имрӯза",
      newPatientBtn: "Ба навбат гузоштан",
      exportExcelBtn: "Боргирӣ ба Excel",
      searchPlaceholder: "Ҷустуҷӯ аз рӯи ID, Н.Н.О. ё ҳуҷра...",
      totalPatients: "Ҳамагӣ беморон",
      waitingPatients: "Дар интизорӣ",
      callingPatients: "Даъватшудагон",
      completedPatients: "Анҷомёфтагон",
      tableTime: "Вақт",
      tableTicket: "Талон ID",
      tablePatient: "Н.Н.О-и Бемор",
      tableType: "Гурӯҳ",
      tableService: "Номи ташхис",
      tableRoom: "Ҳуҷра / Дастгоҳ",
      tableReferring: "Духтури роҳхатдиҳанда",
      tableStatus: "Ҳолат",
      tableActions: "Амалҳо"
    },
    tr: {
      queueTitle: "Bugünkü Sıra Listesi",
      newPatientBtn: "Yeni Randevu Ver",
      exportExcelBtn: "Excel'e Aktar",
      searchPlaceholder: "Hasta ID, Ad veya Odaya göre ara...",
      totalPatients: "Toplam Hasta",
      waitingPatients: "Bekleyenler",
      callingPatients: "Çağrılanlar",
      completedPatients: "Tamamlananlar",
      tableTime: "Saat",
      tableTicket: "Bilet No",
      tablePatient: "Hasta Adı Soyadı",
      tableType: "Kategori",
      tableService: "Tetkik Adı",
      tableRoom: "Oda / Cihaz",
      tableReferring: "Yönlendiren Hekim",
      tableStatus: "Durum",
      tableActions: "İşlemler"
    }
  }
};

// 9. KARDELEN VA TIBBIY MA'LUMOTLARNI QAVSLAR [ ] ICHIDA SAQLAGAN HOLDA TARJIMA QILISH
function formatServiceNameWithOriginal(rawServiceName, lang = 'uz') {
  if (!rawServiceName) return "-";
  if (!lang || lang === 'uz') return rawServiceName;

  let translated = rawServiceName;
  const lower = rawServiceName.toLowerCase();

  const svcMap = I18N_TRANSLATIONS.services;
  for (const key of Object.keys(svcMap)) {
    if (lower.includes(key) && svcMap[key][lang]) {
      let tName = svcMap[key][lang];
      if (lower.includes("mskt") || lower.includes("msct") || lower.includes("kt") || lower.includes("ct")) {
        tName = (lang === 'ru' ? "КТ / МСКТ " : (lang === 'en' ? "CT / MSCT " : (lang === 'tr' ? "BT / MSBT " : "МСКТ "))) + tName;
      } else if (lower.includes("mrt") || lower.includes("mri") || lower.includes("mr")) {
        tName = (lang === 'ru' ? "МРТ " : (lang === 'en' ? "MRI " : (lang === 'tr' ? "MR " : "МРТ "))) + tName;
      }
      if (lower.includes("kontrastli") || lower.includes("kontrast bilan")) {
        tName += (lang === 'ru' ? " (С контрастом)" : (lang === 'en' ? " (With contrast)" : " [Kontrastli]"));
      } else if (lower.includes("kontrastsiz") || lower.includes("oddiy")) {
        tName += (lang === 'ru' ? " (Без контраста)" : (lang === 'en' ? " (Without contrast)" : ""));
      }
      translated = tName;
      break;
    }
  }

  // Asl o'zbekcha nomini qavsda [ ... ] ko'rsatish
  if (translated !== rawServiceName) {
    return `${translated} [${rawServiceName}]`;
  }
  return rawServiceName;
}

function formatRoomWithOriginal(rawRoom, doctorName = "", lang = 'uz') {
  if (!rawRoom && !doctorName) return "-";
  const combined = (rawRoom || "") + (doctorName ? ` (${doctorName})` : "");
  if (!lang || lang === 'uz') return combined;

  const roomMap = I18N_TRANSLATIONS.rooms;
  for (const key of Object.keys(roomMap)) {
    if (rawRoom && rawRoom.includes(key) && roomMap[key][lang]) {
      const tRoom = roomMap[key][lang];
      return `${tRoom}${doctorName ? ` (${doctorName})` : ''} [${rawRoom}]`;
    }
  }
  return combined;
}

function translateDeferReason(rawReason, lang = 'uz') {
  if (!rawReason) return "";
  if (!lang || lang === 'uz') return rawReason;

  const reasonMap = I18N_TRANSLATIONS.deferReasons;
  for (const key of Object.keys(reasonMap)) {
    if (rawReason.includes(key) && reasonMap[key][lang]) {
      return `${reasonMap[key][lang]} [${rawReason}]`;
    }
  }
  return rawReason;
}

// 10. KO'P TILLI SAVOLLAR VA KO'RSATMALAR TARJIMASI
function translateQuestionsList(questions, lang = 'uz') {
  if (!questions || !Array.isArray(questions)) return [];
  if (!lang || lang === 'uz') return questions;

  const qMap = I18N_TRANSLATIONS.questions || {};

  return questions.map(q => {
    const qLower = q.toLowerCase();
    if (qLower.includes("kardiostimulyator") || qLower.includes("yurak stimulyatori") || qLower.includes("defibrillyator")) {
      return (qMap.pacemaker && qMap.pacemaker[lang]) ? qMap.pacemaker[lang] : q;
    }
    if (qLower.includes("metall implant") || qLower.includes("sun‘iy bo‘g‘im") || qLower.includes("plastinka") || qLower.includes("vint")) {
      return (qMap.metalImplants && qMap.metalImplants[lang]) ? qMap.metalImplants[lang] : q;
    }
    if (qLower.includes("klavstrofobiya") || qLower.includes("yopiq fazo")) {
      return (qMap.claustrophobia && qMap.claustrophobia[lang]) ? qMap.claustrophobia[lang] : q;
    }
    if (qLower.includes("homiladorlik") || qLower.includes("emizikli")) {
      return (qMap.pregnancy && qMap.pregnancy[lang]) ? qMap.pregnancy[lang] : q;
    }
    if (qLower.includes("allergiya") || qLower.includes("yodga") || qLower.includes("kontrast modda")) {
      return (qMap.allergy && qMap.allergy[lang]) ? qMap.allergy[lang] : q;
    }
    if (qLower.includes("buyrak yetishmovchiligi") || qLower.includes("gemodializ")) {
      return (qMap.kidney && qMap.kidney[lang]) ? qMap.kidney[lang] : q;
    }
    if (qLower.includes("astma") || qLower.includes("diabet") || qLower.includes("qalqonsimon bez")) {
      return (qMap.asthmaDiabetes && qMap.asthmaDiabetes[lang]) ? qMap.asthmaDiabetes[lang] : q;
    }
    if (qLower.includes("eshitish apparati") || qLower.includes("tish protez") || qLower.includes("tatuirovka")) {
      return (qMap.hearingDental && qMap.hearingDental[lang]) ? qMap.hearingDental[lang] : q;
    }
    if (qLower.includes("och qol") || qLower.includes("och qorin")) {
      return (qMap.abdominalFasting && qMap.abdominalFasting[lang]) ? qMap.abdominalFasting[lang] : q;
    }
    if (qLower.includes("qovuq") || qLower.includes("suv ich")) {
      return (qMap.pelvicBladder && qMap.pelvicBladder[lang]) ? qMap.pelvicBladder[lang] : q;
    }
    return q;
  });
}

// 11. KO'P TILLI TIBBIY KO'RSATMALAR HTML FORMATER (80mm Talon uchun)
function formatConsolidatedGuidelinesHtml(payload, lang = 'uz', customConfig = null) {
  const L = lang || payload.printLang || (typeof getI18nLanguage === 'function' ? getI18nLanguage() : 'uz') || 'uz';
  const gDict = (customConfig && customConfig.guidelines && customConfig.guidelines[L]) 
    ? customConfig.guidelines[L] 
    : ((I18N_TRANSLATIONS.guidelines && I18N_TRANSLATIONS.guidelines[L]) ? I18N_TRANSLATIONS.guidelines[L] : I18N_TRANSLATIONS.guidelines['uz']);

  const prep = payload.preparation || "";
  const contra = payload.contraindications || "";
  const sList = payload.servicesList || [];

  const isMultiple = (sList && sList.length > 1);

  let generalPrepList = [];
  let contraList = [];
  let fastingHours = 6;

  const combinedText = (prep + " " + contra + " " + sList.map(s => (s.preparation || '') + ' ' + (s.contraindications || '')).join(' ')).toLowerCase();

  if (combinedText.includes("och qorin") || combinedText.includes("och qol") || combinedText.includes("натощак") || combinedText.includes("fasting")) {
    const match = combinedText.match(/(d+)s*[-–—to]?s*(d+)?s*soat/i) || combinedText.match(/(d+)s*часов/i) || combinedText.match(/(d+)s*hours/i);
    if (match) {
      fastingHours = parseInt(match[2] || match[1], 10) || 6;
    }
    generalPrepList.push(gDict.fasting.replace('{H}', fastingHours));
  }

  if (combinedText.includes("kreatinin") || combinedText.includes("mochevina") || combinedText.includes("креатинин") || combinedText.includes("creatinine") || payload.isContrast) {
    generalPrepList.push(gDict.bloodTest);
    generalPrepList.push(gDict.metformin);
    generalPrepList.push(gDict.postHydration);
  }

  if (combinedText.includes("metall") || combinedText.includes("металл") || combinedText.includes("metal")) {
    generalPrepList.push(gDict.metalWarning);
  }

  if (combinedText.includes("yod") || combinedText.includes("kontrast") || combinedText.includes("йод") || combinedText.includes("contrast") || payload.isContrast) {
    contraList.push(gDict.allergy);
    contraList.push(gDict.kidney);
    contraList.push(gDict.hyperthyroidism);
    contraList.push(gDict.pregnancy);
  }

  if (combinedText.includes("kardiostimulyator") || combinedText.includes("stimulyator") || combinedText.includes("кардиостимулятор") || combinedText.includes("pacemaker")) {
    contraList.push(gDict.pacemaker);
  }

  if (generalPrepList.length === 0 && prep) {
    generalPrepList.push(prep);
  }
  if (contraList.length === 0 && contra) {
    contraList.push(contra);
  }

  if (generalPrepList.length === 0 && contraList.length === 0) {
    return "";
  }

  return `
    <div class="guide-box" style="border: 2px solid #000; border-radius: 4px; padding: 6px 8px; margin-bottom: 6px; font-size: 12px; line-height: 1.35; text-align: left; color: #000 !important;">
      <div style="font-size: 12px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; text-align: center; color: #000 !important; border-bottom: 2px dashed #000; padding-bottom: 3px;">
        ${gDict.boxTitle}
      </div>
      ${generalPrepList.length > 0 ? `
        <div style="margin-top: 4px; font-size: 12px;">
          <div style="font-weight: 900; margin-bottom: 2px; color:#000 !important;">${isMultiple ? gDict.generalPrepTitle : '📋 ' + (L === 'ru' ? 'Подготовка:' : (L === 'en' ? 'Preparation:' : "Tayyorgarlik:"))}</div>
          <div style="padding-left: 2px; line-height: 1.35;">
            ${generalPrepList.map(g => `<div style="margin-top:2px;">• ${g}</div>`).join('')}
          </div>
        </div>
      ` : ''}
      ${contraList.length > 0 ? `
        <div style="margin-top: 6px; font-size: 12px;">
          <div style="font-weight: 900; margin-bottom: 2px; color:#000 !important;">${gDict.contraTitle}</div>
          <div style="padding-left: 2px; line-height: 1.35;">
            ${contraList.map(c => `<div style="margin-top:2px;">• ${c}</div>`).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// 12. TIZIM TILI YORDAMCHILARI
function getI18nLanguage() {
  try {
    return localStorage.getItem("rons_system_lang") || "uz";
  } catch (e) {
    return "uz";
  }
}

function setI18nLanguage(langCode) {
  try {
    if (I18N_TRANSLATIONS.ticket[langCode]) {
      localStorage.setItem("rons_system_lang", langCode);
    }
  } catch (e) {}
}

function t(section, key, lang = null) {
  const l = lang || getI18nLanguage();
  if (I18N_TRANSLATIONS[section] && I18N_TRANSLATIONS[section][l] && I18N_TRANSLATIONS[section][l][key]) {
    return I18N_TRANSLATIONS[section][l][key];
  }
  if (I18N_TRANSLATIONS[section] && I18N_TRANSLATIONS[section]['uz'] && I18N_TRANSLATIONS[section]['uz'][key]) {
    return I18N_TRANSLATIONS[section]['uz'][key];
  }
  return key;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    I18N_LANGUAGES,
    I18N_TRANSLATIONS,
    getI18nLanguage,
    setI18nLanguage,
    t,
    formatServiceNameWithOriginal,
    formatRoomWithOriginal,
    translateDeferReason,
    translateQuestionsList,
    formatConsolidatedGuidelinesHtml
  };
}
