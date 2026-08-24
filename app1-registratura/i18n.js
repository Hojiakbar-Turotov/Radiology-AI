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
      centerName: "RESPUBLIKA IXTISOSLASHTIRILGAN ONKOLOGIYA VA RADIOLOGIYA ILMIY-AMALIY TIBBIYOT MARKAZI",
      ticketTitle: "Elektron Navbat Taloni",
      patient: "Bemor:",
      patientType: "Bemor toifasi:",
      stationary: "🏥 Bo'limda yotibdi",
      ambulatory: "🏠 Ambulator",
      referringDoctor: "Fayl shifokori:",
      senderInstitution: "Muassasa / To'lov:",
      roomDevice: "Xona / Qurilma:",
      service: "Tekshiruv:",
      bookedTime: "BAND QILINGAN QABUL VAQTI:",
      appointmentDate: "Qabul Sanasi:",
      operator: "Ro'yxatga oluvchi:",
      reasonLabel: "Sabab:",
      timeNotice: "* Iltimos, belgilangan vaqtdan 30-40 daqiqa oldin kutish zalida bo'ling!",
      footerThanks: "Salomatligingiz biz uchun muhim!",
      contrastBadge: "[KONTRASTLI]",
      onlineResults: "📱 Javoblarni onlayn olish uchun:"
    },
    ru: {
      centerName: "РЕСПУБЛИКАНСКИЙ СПЕЦИАЛИЗИРОВАННЫЙ НАУЧНО-ПРАКТИЧЕСКИЙ МЕДИЦИНСКИЙ ЦЕНТР ОНКОЛОГИИ И РАДИОЛОГИИ",
      ticketTitle: "Электронный талон очереди",
      patient: "Пациент:",
      patientType: "Категория пациента:",
      stationary: "🏥 Стационар",
      ambulatory: "🏠 Амбулаторный",
      referringDoctor: "Направивший врач:",
      senderInstitution: "Учреждение / Оплата:",
      roomDevice: "Кабинет / Аппарат:",
      service: "Исследование:",
      bookedTime: "ЗАБРОНИРОВАННОЕ ВРЕМЯ ПРИЁМА:",
      appointmentDate: "Дата приёма:",
      operator: "Регистратор:",
      reasonLabel: "Причина переноса:",
      timeNotice: "* Пожалуйста, будьте в зале ожидания за 30-40 минут до назначенного времени!",
      footerThanks: "Ваше здоровье — наша главная ценность!",
      contrastBadge: "[С КОНТРАСТОМ]",
      onlineResults: "📱 Чтобы получить результаты онлайн:"
    },
    en: {
      centerName: "REPUBLICAN SPECIALIZED SCIENTIFIC AND PRACTICAL MEDICAL CENTER OF ONCOLOGY AND RADIOLOGY",
      ticketTitle: "Electronic Queue Ticket",
      patient: "Patient:",
      patientType: "Patient Category:",
      stationary: "🏥 Inpatient (Ward)",
      ambulatory: "🏠 Outpatient (Ambulatory)",
      referringDoctor: "Referring Doctor:",
      senderInstitution: "Institution / Payment:",
      roomDevice: "Room / Device:",
      service: "Examination:",
      bookedTime: "BOOKED APPOINTMENT TIME:",
      appointmentDate: "Appointment Date:",
      operator: "Registrar:",
      reasonLabel: "Reason for Reschedule:",
      timeNotice: "* Please arrive in the waiting room 30-40 minutes before your scheduled appointment!",
      footerThanks: "Your health is our greatest priority!",
      contrastBadge: "[WITH CONTRAST]",
      onlineResults: "📱 To get results online:"
    },
    kk: {
      centerName: "РЕСПУБЛИКАЛЫҚ МАМАНДАНДЫРЫЛҒАН ОНКОЛОГИЯ ЖӘНЕ РАДИОЛОГИЯ ҒЫЛЫМИ-ПРАКТИКАЛЫҚ МЕДИЦИНАЛЫҚ ОРТАЛЫҒЫ",
      ticketTitle: "Электронды кезек талоны",
      patient: "Науқас:",
      patientType: "Науқас санаты:",
      stationary: "🏥 Бөлімшеде (Стационар)",
      ambulatory: "🏠 Үйінен келуші (Амбулаториялық)",
      referringDoctor: "Жолдаған дәрігер:",
      senderInstitution: "Мекеме / Төлем:",
      roomDevice: "Бөлме / Құрылғы:",
      service: "Зерттеу:",
      bookedTime: "БРОНДАЛҒАН ҚАБЫЛДАУ УАҚЫТЫ:",
      appointmentDate: "Қабылдау күні:",
      operator: "Тіркеуші:",
      reasonLabel: "Себебі:",
      timeNotice: "* Белгіленген уақыттан 30-40 минут бұрын күту залында болуыңызды сұраймыз!",
      footerThanks: "Денсаулығыңыз біз үшін маңызды!",
      contrastBadge: "[КОНТРАСТПЕН]",
      onlineResults: "📱 Нәтижелерді онлайн алу үшін:"
    },
    tg: {
      centerName: "МАРКАЗИ ИЛМИЮ АМАЛИИ ТИББИИ ИХТИСОСИИ ҶУМҲУРИЯВИИ ОНКОЛОГИЯ ВА РАДИОЛОГИЯ",
      ticketTitle: "Талони электронии навбат",
      patient: "Бемор:",
      patientType: "Гурӯҳи бемор:",
      stationary: "🏥 Дар шуъба (Статсионар)",
      ambulatory: "🏠 Аз хона (Амбулаторӣ)",
      referringDoctor: "Духтури роҳхатдиҳанда:",
      senderInstitution: "Муассиса / Пардохт:",
      roomDevice: "Ҳуҷра / Дастгоҳ:",
      service: "Ташхис:",
      bookedTime: "ВАҚТИ ҚАБУЛИ БАНДШУДА:",
      appointmentDate: "Санаи қабул:",
      operator: "Бақайдгиранда:",
      reasonLabel: "Сабаби гузаронидан:",
      timeNotice: "* Лутфан 30-40 дақиқа пеш аз вақти таъйиншуда дар толори интизорӣ бошед!",
      footerThanks: "Саломатии шумо барои мо муҳим аст!",
      contrastBadge: "[БО КОНТРАСТ]",
      onlineResults: "📱 Барои гирифтани натиҷаҳо онлайн:"
    },
    tr: {
      centerName: "CUMHURİYET UZMANLAŞMIŞ ONKOLOJİ VE RADYOLOJİ BİLİMSEL-UYGULAMALI TIP MERKEZİ",
      ticketTitle: "Elektronik Sıra Bileti",
      patient: "Hasta:",
      patientType: "Hasta Kategorisi:",
      stationary: "🏥 Yatan Hasta (Servis)",
      ambulatory: "🏠 Ayaktan Hasta",
      referringDoctor: "Yönlendiren Hekim:",
      senderInstitution: "Kurum / Ödeme:",
      roomDevice: "Oda / Cihaz:",
      service: "Tetkik:",
      bookedTime: "RANDEVU SAATİ:",
      appointmentDate: "Randevu Tarihi:",
      operator: "Kayıt Görevlisi:",
      reasonLabel: "Erteleme Gerekçesi:",
      timeNotice: "* Lütfen randevu saatinizden 30-40 dakika önce bekleme salonunda olunuz!",
      footerThanks: "Sağlığınız bizim için değerlidir!",
      contrastBadge: "[KONTRASTLI]",
      onlineResults: "📱 Sonuçları çevrimiçi almak için:"
    }
  },

  // 2. TIBBIY KO'RSATMALAR, TAYYORGARLIK VA QARSHI KO'RSATMALAR (Guidelines)
  guidelines: {
    uz: {
      boxTitle: "TIBBIY KO'RSATMALAR VA ESLATMA",
      generalPrepTitle: "📌 Umumiy Tayyorgarlik (Barcha tekshiruvlar uchun):",
      singlePrepTitle: "📋 Tayyorgarlik:",
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
      singlePrepTitle: "📋 Подготовка к исследованию:",
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
      singlePrepTitle: "📋 Preparation Instructions:",
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
      singlePrepTitle: "📋 Зерттеуге дайындық:",
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
      singlePrepTitle: "📋 Омодагӣ ба ташхис:",
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
      singlePrepTitle: "📋 Tetkik Hazırlığı:",
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
      ministryTitle: "RESPUBLIKA IXTISOSLASHTIRILGAN\\nONKOLOGIYA VA RADIOLOGIYA\\nILMIY-AMALIY TIBBIYOT MARKAZI",
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
      ambulatory: "Ambulator",
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
      declaration: "Men, ushbu anketada ko‘rsatilgan barcha ma‘lumotlarni to‘liq va haqqoniy taqdim etganimni tasdiqlayman. Menga o‘tkaziladigan {examType} tekshiruvining maqsadi, o‘tkazilish tartibi, xavfsizlik talablari (shu jumladan barcha metall buyumlar, soat, telefon, bank kartalari, kamar, sirg‘a va kiyimdagi temir detallarni yechish zarurligi) hamda kontrast modda yuborilganda ehtimoliy individual reaksiyalar haqida to‘liq tushuntirildi.\\nShifokor va operator ko‘rsatmalariga rioya qilishga roziman va tekshiruv o‘tkazilishiga o‘z ixtiyoriy roziligimni bildiraman.\\n* DIQQAT: Agar tekshiruv vaqtida bemor tomonidan (yoki bemor sababli) tekshiruv to‘xtatilsa, tekshiruv uchun navbat qaytadan qo‘yiladi.",
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
      ministryTitle: "РЕСПУБЛИКАНСКИЙ СПЕЦИАЛИЗИРОВАННЫЙ\\nНАУЧНО-ПРАКТИЧЕСКИЙ МЕДИЦИНСКИЙ ЦЕНТР\\nОНКОЛОГИИ И РАДИОЛОГИИ",
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
      declaration: "Я подтверждаю, что предоставил(а) полную и достоверную информацию о состоянии своего здоровья. Мне в доступной форме разъяснены цели, порядок проведения исследования {examType}, правила безопасности (включая снятие всех металлических предметов, часов, телефона, украшений и ремня), а также возможные индивидуальные реакции на введение контрастного вещества.\\nЯ согласен(на) следовать инструкциям медицинского персонала и добровольно даю согласие на проведение исследования.\\n* ВНИМАНИЕ: Если во время исследования процедура будет прервана по инициативе пациента, очередь на повторное исследование аннулируется и назначается заново.",
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
      ministryTitle: "REPUBLICAN SPECIALIZED SCIENTIFIC AND PRACTICAL\\nMEDICAL CENTER OF ONCOLOGY AND RADIOLOGY",
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
      declaration: "I confirm that all information provided in this questionnaire is true, complete, and accurate. The purpose, procedure, safety requirements of {examType} (including removal of all metal objects, watches, phones, cards, and jewelry), and potential risks of contrast administration have been fully explained to me.\\nI agree to follow all instructions from the medical staff and voluntarily consent to undergo this examination.\\n* NOTICE: If the examination is interrupted by or due to the patient during scanning, a new appointment must be rescheduled.",
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
      ministryTitle: "РЕСПУБЛИКАЛЫҚ МАМАНДАНДЫРЫЛҒАН\\nОНКОЛОГИЯ ЖӘНЕ РАДИОЛОГИЯ\\nҒЫЛЫМИ-ТӘЖІРИБЕЛІК МЕДИЦИНА ОРТАЛЫҒЫ",
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
      declaration: "Мен осы сауалнамада көрсетілген барлық мәліметтердің толық әрі шынайы екенін растаймын. Маған өткізілетін {examType} зерттеуінің мақсаты, тәртібі, қауіпсіздік талаптары (барлық металл заттарды, сағат, телефон және әшекейлерді шешу қажеттілігі) толық түсіндірілді.\\nДәрігер мен оператордың нұсқауларын орындауға келісемін және зерттеуді жүргізуге өз еркіммен келісім беремін.",
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
      ministryTitle: "МАРКАЗИ ИЛМИЮ АМАЛИИ ТИББИИ\\nСПЕТСИАЛИЗОНИДАШУДАИ ҶУМҲУРИЯВИИ\\nОНКОЛОГИЯ ВА РАДИОЛОГИЯ",
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
      declaration: "Ман тасдиқ мекунам, ки ҳамаи маълумоти дар ин саволнома овардашуда пурра ва ҳақиқӣ мебошанд. Мақсад, тартиби гузаронидани ташхиси {examType}, талаботи бехатарӣ (аз ҷумла кашидани ҳамаи ашёи филизӣ, соат, телефон ва ҷавоҳирот) ба ман пурра фаҳмонида шуд.\\nБа иҷрои дастурҳои табиб ва оператор розӣ ҳастам ва барои гузаронидани ташхис ризоияти худро медиҳам.",
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
      ministryTitle: "CUMHURİYETİ ONKOLOJİ VE RADYOLOJİ\\nUZMANLAŞMIŞ BİLİMSEL-UYGULAMALI\\nTIBBİ MERKEZİ",
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
      declaration: "Bu formda vermiş olduğum tüm bilgilerin doğru ve eksiksiz olduğunu beyan ederim. Bana yapılacak olan {examType} tetkikinin amacı, uygulama şekli, güvenlik kuralları (tüm metal eşya, saat, telefon ve takıların çıkarılması) ve kontrast maddeye bağlı gelişebilecek olası reaksiyonlar açıkça anlatılmıştır.\\nSağlık personelinin talimatlarına uymayı kabul ediyor ve tetkikin yapılmasına özgür irademle onay veriyorum.",
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

  // 6. TEKSHIRUVLAR VA ANATOMIK SOHALAR LUG'ATI (Service anatomical names translation)
  services: {
    "bosh miya": { ru: "Головной мозг", en: "Brain / Head", kk: "Бас миы", tg: "Мағзи сар", tr: "Beyin" },
    "bosh": { ru: "Голова / Головной мозг", en: "Head / Brain", kk: "Бас", tg: "Сар", tr: "Baş" },
    "gipofiz": { ru: "Гипофиз", en: "Pituitary Gland", kk: "Гипофиз", tg: "Гипофиз", tr: "Hipofiz" },
    "orbit": { ru: "Орбиты и глазницы", en: "Orbits & Eyes", kk: "Көз шарасы", tg: "Косахонаи чашм", tr: "Göz Çukuru (Orbita)" },
    "ko'z": { ru: "Глазницы / Орбиты", en: "Orbits", kk: "Көз", tg: "Чашм", tr: "Göz" },
    "yuz-jag'": { ru: "Лицевой скелет и челюсти", en: "Maxillofacial Region", kk: "Бет-жақ сүйектері", tg: "Ҷоғ ва рӯй", tr: "Maksillofasiyal" },
    "bo'yin umurtqa": { ru: "Шейный отдел позвоночника", en: "Cervical Spine", kk: "Мойын омыртқасы", tg: "Сутунмӯҳраи гардан", tr: "Boyun Omurgası (Servikal)" },
    "bo'yin": { ru: "Шея / Шейный отдел", en: "Neck / Cervical Spine", kk: "Мойын", tg: "Гардан", tr: "Boyun" },
    "ko'krak umurtqa": { ru: "Грудной отдел позвоночника", en: "Thoracic Spine", kk: "Көкірек омыртқасы", tg: "Сутунмӯҳраи қафаси сина", tr: "Sırt Omurgası (Torakal)" },
    "bel-dumg'aza": { ru: "Пояснично-крестцовый отдел позвоночника", en: "Lumbar-Sacral Spine", kk: "Бел-сегізкөз омыртқасы", tg: "Камару думғоза", tr: "Bel Omurgası (Lomber-Sakral)" },
    "bel": { ru: "Поясничный отдел", en: "Lumbar Spine", kk: "Бел", tg: "Камар", tr: "Bel" },
    "dumg'aza": { ru: "Крестец и копчик", en: "Sacrum & Coccyx", kk: "Сегізкөз", tg: "Думғоза", tr: "Sakrum" },
    "umurtqa": { ru: "Позвоночник", en: "Spine", kk: "Омыртқа", tg: "Сутунмӯҳра", tr: "Omurga" },
    "ko'krak qafasi": { ru: "Органы грудной клетки", en: "Chest Organs / Thorax", kk: "Көкірек қуысы ағзалары", tg: "Узвҳои қафаси сина", tr: "Göğüs Kafesi (Toraks)" },
    "ko'krak": { ru: "Грудная клетка", en: "Chest", kk: "Көкірек", tg: "Қафаси сина", tr: "Göğüs" },
    "o'pka": { ru: "Лёгкие и средостение", en: "Lungs & Mediastinum", kk: "Өкпе", tg: "Шушҳо", tr: "Akciğer" },
    "qorin bo'shlig'i va retroperitoneal": { ru: "Брюшная полость и забрюшинное пространство", en: "Abdomen & Retroperitoneal Space", kk: "Құрсақ қуысы және ретроперитонеальді кеңістік", tg: "Шикам ва фазои паси шикам", tr: "Karın ve Retroperitoneal Bölge" },
    "qorin bo'shlig'i": { ru: "Органы брюшной полости", en: "Abdominal Organs", kk: "Құрсақ қуысы", tg: "Узвҳои шикам", tr: "Karın Bölgesi (Abdomen)" },
    "kichik chanoq": { ru: "Органы малого таза", en: "Pelvic Organs", kk: "Кіші жамбас ағзалары", tg: "Узвҳои коси хурд", tr: "Pelvis (Küçük Çanak)" },
    "chanoq-son": { ru: "Тазобедренный сустав", en: "Hip Joint", kk: "Ұршық буыны", tg: "Буғуми рон", tr: "Kalça Eklemi" },
    "tizza": { ru: "Коленный сустав", en: "Knee Joint", kk: "Тізе буыны", tg: "Буғуми зону", tr: "Diz Eklemi" },
    "yelka": { ru: "Плечевой сустав", en: "Shoulder Joint", kk: "Иық буыны", tg: "Буғуми китф", tr: "Omuz Eklemi" },
    "tirsak": { ru: "Локтевой сустав", en: "Elbow Joint", kk: "Шынтақ буыны", tg: "Буғуми оринҷ", tr: "Dirsek Eklemi" },
    "boldir": { ru: "Голень и кости голени", en: "Shin / Lower Leg", kk: "Сирақ", tg: "Соқ", tr: "Kaval Kemiği" },
    "to'piq": { ru: "Голеностопный сустав", en: "Ankle Joint", kk: "Тобық буыны", tg: "Буғуми пой", tr: "Ayak Bileği" },
    "oyoq panja": { ru: "Стопа", en: "Foot", kk: "Аяқ басы", tg: "Кафи пой", tr: "Ayak" },
    "qo'l panja": { ru: "Кисть руки", en: "Hand / Wrist", kk: "Қол басы", tg: "Даст", tr: "El" }
  },

  // 7. XONALAR LUG'ATI (Room / Device translation)
  rooms: {
    "1-MRT Xonasi": { ru: "Кабинет 1 (МРТ)", en: "Room 1 (MRI)", kk: "1-МРТ Бөлмесі", tg: "Ҳуҷраи 1 (МРТ)", tr: "1. MR Odası" },
    "2-MRT Xonasi": { ru: "Кабинет 2 (МРТ)", en: "Room 2 (MRI)", kk: "2-МРТ Бөлмесі", tg: "Ҳуҷраи 2 (МРТ)", tr: "2. MR Odası" },
    "1-MSKT Xonasi": { ru: "Кабинет 1 (МСКТ)", en: "Room 1 (MSCT)", kk: "1-МСКТ Бөлмесі", tg: "Ҳуҷраи 1 (МСКТ)", tr: "1. BT Odası" }
  },

  // 8. KENGAYTMA VA PANEL INTERFEYSI (Extension & Panel UI)
  ext: {
    uz: {
      userProfile: "Ro'yxatchi profili",
      queueListBtn: "📋 Navbatlar Ro'yxati",
      queueListTitle: "Bugungi va ertangi navbatdagi bemorlar ro'yxatini ko'rish",
      mrtMsktBrand: "⚡ MRT & MSKT:",
      clickPatientRow: "Jadvaldan bemor qatorini bosing",
      selectedPrefix: "Tanlangan:",
      bookQueueBtn: "➕ Navbatga Yozish",
      loginRequired: "Tizimga Kirish",
      selectPatientFirst: "Iltimos, avval jadvaldan bemorni tanlang!",
      nonMrtMsktWarning: "Faqat MRT va MSKT tekshiruvlariga navbat beriladi ({service} — MRT/MSKT emas).",
      completedRowWarning: "Ushbu tekshiruv o'tkazilgan (Yashil qator) — Navbatga qo'yilmaydi.",
      
      // Send Modal
      sendModalTitle: "MRT & MSKT Navbatiga Yozish",
      patientInfoTitle: "👤 Bemor Ma'lumotlari:",
      patientName: "Bemor F.I.Sh:",
      patientType: "Bemor Toifasi:",
      referringDoc: "Fayl Shifokori:",
      durationTime: "Ketadigan Vaqt:",
      serviceChoiceTitle: "🏥 Tekshiruv Xizmati:",
      allServicesTogether: "Barchasini birgalikda yozish",
      singleService: "Alohida xizmat",
      contrastDetected: "💉 Kontrastli tekshiruv aniqlandi",
      durationMin: "daqiqa",
      deviceTargetTitle: "🏢 Qurilma / Xonani tanlang:",
      dateTitle: "📅 Qabul Sanasi:",
      todayBtn: "Bugun",
      tomorrowBtn: "Ertaga",
      timeModeTitle: "⏰ Qabul Vaqtini Belgilash:",
      modeAuto: "⚡ Eng yaqin avtomatik vaqt",
      modeCustom: "🕒 Ixtiyoriy vaqt (Bemor iltimosiga ko'ra)",
      customStartTime: "Boshlanish vaqti:",
      customEndTime: "Oraliq:",
      calculatingSlot: "Hisoblanmoqda...",
      deferReasonTitle: "⚠️ Eng yaqin vaqtdan vos kechish sababi:",
      deferReasonOtherPlaceholder: "Sababni batafsil yozing...",
      docLangTitle: "🌐 Hujjat / Chop Etish Tili (Language):",
      ticket80mm: "🎫 Talon (80mm)",
      consentA4: "📋 Rozilik anketasi (A4)",
      cancelBtn: "Bekor qilish",
      submitBtn: "Navbatga Yozish & Chop Etish",

      // Drawer
      drawerTitle: "📋 Navbatlar Ro'yxati",
      tabAll: "Barchasi",
      tabToday: "Bugun",
      tabTomorrow: "Ertaga",
      searchDrawerPlaceholder: "Bemor ID, F.I.Sh yoki xona bo'yicha qidirish...",
      colTime: "Vaqt",
      colId: "ID",
      colPatient: "Bemor F.I.Sh",
      colCategory: "Toifasi / Bo'lim",
      colService: "Tekshiruv Nomi",
      colReferring: "Fayl Shifokori",
      colOperator: "Ro'yxatchi",
      colWaitingRoom: "Kutish Zalida",
      colStatus: "Holat",
      colTicket: "Talon",
      colConsent: "Rozilik",
      statusWaiting: "Kutmoqda",
      statusCalling: "Chaqirilmoqda",
      statusInProgress: "Qabulda",
      statusCompleted: "Yakunlandi",
      statusCancelled: "O'chirilgan",
      statusUnknown: "Noma'lum",
      btnMarkArrived: "🟢 Zalda",
      btnMarkNotArrived: "⏳ Hali kelmadi",
      btnMarkArrivedTitle: "Bemor kutish zalida o'tiribdi (O'zgartirish uchun bosing)",
      btnMarkNotArrivedTitle: "Bemor hali kelmadi (Kelganini belgilash uchun bosing)",
      btnReprintTicket: "Talonni qayta chop etish",
      btnReprintConsent: "Rozilik anketasini chop etish",
      noPatientsFound: "Bemorlar topilmadi",
      noPatientsSubtitle: "Ushbu kunga hali hech qanday bemor yozilmagan yoki qidiruvga mos kelmadi.",
      patientsCount: "ta bemor",
      otherDevices: "Boshqa qurilmalar",
      showingSummary: "Ko'rsatilmoqda: {total} nafar (Faol navbat: {active} nafar) | Sana: {date}",

      // Profile Modal
      profileTitle: "⚙️ Ro'yxatchi Profili",
      loginLabel: "Login:",
      nameLabel: "F.I.Sh:",
      newPasswordLabel: "Yangi parol (o'zgartirish ixtiyoriy):",
      saveBtn: "Saqlash",
      logoutBtn: "Profildan chiqish",
      profileSaved: "✅ Profil ma'lumotlari muvaffaqiyatli yangilandi!",

      // Login Modal
      loginModalTitle: "🔐 Ro'yxatchi Kirish Tizimi",
      passwordLabel: "Parol:",
      enterBtn: "Kirish",
      loginSuccess: "✅ Xush kelibsiz, {name}!",
      loginError: "❌ Login yoki parol noto'g'ri!",

      // Toast & Alerts
      langSwitched: "🌐 Til tanlandi: {lang}",
      slotOccupiedError: "❌ Bu vaqt band!",
      slotPastError: "❌ O'tib ketgan vaqtga navbat yozib bo'lmaydi!",
      slotWorkHoursError: "❌ Tanlangan vaqt ish soatlaridan tashqarida!"
    },
    ru: {
      userProfile: "Профиль регистратора",
      queueListBtn: "📋 Список Очереди",
      queueListTitle: "Просмотр списка пациентов на сегодня и завтра",
      mrtMsktBrand: "⚡ МРТ и МСКТ:",
      clickPatientRow: "Выберите строку пациента из таблицы",
      selectedPrefix: "Выбран:",
      bookQueueBtn: "➕ Записать в Очередь",
      loginRequired: "Вход в систему",
      selectPatientFirst: "Пожалуйста, сначала выберите пациента из таблицы!",
      nonMrtMsktWarning: "В очередь записываются только МРТ и МСКТ ({service} — не МРТ/МСКТ).",
      completedRowWarning: "Это исследование уже проведено (Зелёная строка) — Запись невозможна.",

      // Send Modal
      sendModalTitle: "Запись в очередь МРТ & МСКТ",
      patientInfoTitle: "👤 Данные Пациента:",
      patientName: "Ф.И.О. Пациента:",
      patientType: "Категория Пациента:",
      referringDoc: "Направивший Врач:",
      durationTime: "Длительность:",
      serviceChoiceTitle: "🏥 Медицинская Услуга:",
      allServicesTogether: "Записать все услуги вместе",
      singleService: "Отдельная услуга",
      contrastDetected: "💉 Обнаружено контрастное исследование",
      durationMin: "мин",
      deviceTargetTitle: "🏢 Выберите Аппарат / Кабинет:",
      dateTitle: "📅 Дата Приёма:",
      todayBtn: "Сегодня",
      tomorrowBtn: "Завтра",
      timeModeTitle: "⏰ Выбор Времени Приёма:",
      modeAuto: "⚡ Ближайшее свободное время (Авто)",
      modeCustom: "🕒 Точное время (По просьбе пациента)",
      customStartTime: "Время начала:",
      customEndTime: "Интервал:",
      calculatingSlot: "Выполняется расчёт...",
      deferReasonTitle: "⚠️ Причина отказа от ближайшего времени:",
      deferReasonOtherPlaceholder: "Опишите причину подробно...",
      docLangTitle: "🌐 Язык Документа / Печати (Language):",
      ticket80mm: "🎫 Талон (80мм)",
      consentA4: "📋 Согласие (А4)",
      cancelBtn: "Отмена",
      submitBtn: "Записать в Очередь & Печать",

      // Drawer
      drawerTitle: "📋 Список Очереди Пациентов",
      tabAll: "Все",
      tabToday: "Сегодня",
      tabTomorrow: "Завтра",
      searchDrawerPlaceholder: "Поиск по ID, Ф.И.О. или кабинету...",
      colTime: "Время",
      colId: "ID",
      colPatient: "Ф.И.О. Пациента",
      colCategory: "Категория / Отделение",
      colService: "Исследование",
      colReferring: "Направивший Врач",
      colOperator: "Регистратор",
      colWaitingRoom: "В Зале",
      colStatus: "Статус",
      colTicket: "Талон",
      colConsent: "Согласие",
      statusWaiting: "Ожидает",
      statusCalling: "Вызывается",
      statusInProgress: "На приёме",
      statusCompleted: "Завершено",
      statusCancelled: "Отменено",
      statusUnknown: "Неизвестно",
      btnMarkArrived: "🟢 В зале",
      btnMarkNotArrived: "⏳ Не прибыл",
      btnMarkArrivedTitle: "Пациент в зале ожидания (Нажмите для изменения)",
      btnMarkNotArrivedTitle: "Пациент ещё не прибыл (Нажмите, чтобы отметить прибытие)",
      btnReprintTicket: "Перепечатать талон",
      btnReprintConsent: "Распечатать согласие А4",
      noPatientsFound: "Пациенты не найдены",
      noPatientsSubtitle: "На эту дату пациенты не записаны или не найдены по поиску.",
      patientsCount: "пациентов",
      otherDevices: "Другие аппараты",
      showingSummary: "Отображено: {total} чел. (Активная очередь: {active} чел.) | Дата: {date}",

      // Profile Modal
      profileTitle: "⚙️ Профиль Регистратора",
      loginLabel: "Логин:",
      nameLabel: "Ф.И.О.:",
      newPasswordLabel: "Новый пароль (необязательно):",
      saveBtn: "Сохранить",
      logoutBtn: "Выйти из профиля",
      profileSaved: "✅ Профиль успешно обновлён!",

      // Login Modal
      loginModalTitle: "🔐 Вход для Регистратора",
      passwordLabel: "Пароль:",
      enterBtn: "Войти",
      loginSuccess: "✅ Добро пожаловать, {name}!",
      loginError: "❌ Неверный логин или пароль!",

      // Toast & Alerts
      langSwitched: "🌐 Выбран язык: {lang}",
      slotOccupiedError: "❌ Это время уже занято!",
      slotPastError: "❌ Нельзя записать на прошедшее время!",
      slotWorkHoursError: "❌ Выбранное время вне рабочих часов!"
    },
    en: {
      userProfile: "Registrar Profile",
      queueListBtn: "📋 Queue List",
      queueListTitle: "View queue list for today and tomorrow",
      mrtMsktBrand: "⚡ MRI & CT:",
      clickPatientRow: "Click a patient row from table",
      selectedPrefix: "Selected:",
      bookQueueBtn: "➕ Book Appointment",
      loginRequired: "Sign In",
      selectPatientFirst: "Please select a patient from table first!",
      nonMrtMsktWarning: "Only MRI and CT exams can be queued ({service} is not MRI/CT).",
      completedRowWarning: "This exam is already completed (Green row) — Cannot be scheduled.",

      // Send Modal
      sendModalTitle: "Book MRI & CT Queue",
      patientInfoTitle: "👤 Patient Information:",
      patientName: "Patient Name:",
      patientType: "Patient Category:",
      referringDoc: "Referring Doctor:",
      durationTime: "Duration:",
      serviceChoiceTitle: "🏥 Examination Service:",
      allServicesTogether: "Book all services together",
      singleService: "Individual service",
      contrastDetected: "💉 Contrast examination detected",
      durationMin: "min",
      deviceTargetTitle: "🏢 Select Device / Room:",
      dateTitle: "📅 Appointment Date:",
      todayBtn: "Today",
      tomorrowBtn: "Tomorrow",
      timeModeTitle: "⏰ Appointment Time Setting:",
      modeAuto: "⚡ Earliest Available Slot (Automatic)",
      modeCustom: "🕒 Specific Time (Patient Request)",
      customStartTime: "Start Time:",
      customEndTime: "Interval:",
      calculatingSlot: "Calculating available slot...",
      deferReasonTitle: "⚠️ Reason for skipping nearest slot:",
      deferReasonOtherPlaceholder: "Describe the reason in detail...",
      docLangTitle: "🌐 Document / Print Language:",
      ticket80mm: "🎫 Ticket (80mm)",
      consentA4: "📋 Consent Form (A4)",
      cancelBtn: "Cancel",
      submitBtn: "Book & Print Ticket",

      // Drawer
      drawerTitle: "📋 Patient Queue List",
      tabAll: "All",
      tabToday: "Today",
      tabTomorrow: "Tomorrow",
      searchDrawerPlaceholder: "Search by ID, Name, or Room...",
      colTime: "Time",
      colId: "ID",
      colPatient: "Patient Full Name",
      colCategory: "Category / Dept",
      colService: "Exam Name",
      colReferring: "Referring Doctor",
      colOperator: "Registrar",
      colWaitingRoom: "In Waiting",
      colStatus: "Status",
      colTicket: "Ticket",
      colConsent: "Consent",
      statusWaiting: "Waiting",
      statusCalling: "Calling",
      statusInProgress: "In Exam",
      statusCompleted: "Completed",
      statusCancelled: "Cancelled",
      statusUnknown: "Unknown",
      btnMarkArrived: "🟢 In Hall",
      btnMarkNotArrived: "⏳ Not Arrived",
      btnMarkArrivedTitle: "Patient is in waiting room (Click to toggle)",
      btnMarkNotArrivedTitle: "Patient has not arrived yet (Click to mark arrived)",
      btnReprintTicket: "Reprint 80mm ticket",
      btnReprintConsent: "Print A4 consent form",
      noPatientsFound: "No patients found",
      noPatientsSubtitle: "No patients scheduled for this date or matching query.",
      patientsCount: "patients",
      otherDevices: "Other devices",
      showingSummary: "Showing: {total} patients (Active queue: {active}) | Date: {date}",

      // Profile Modal
      profileTitle: "⚙️ Registrar Profile",
      loginLabel: "Username:",
      nameLabel: "Full Name:",
      newPasswordLabel: "New Password (optional):",
      saveBtn: "Save Changes",
      logoutBtn: "Log Out",
      profileSaved: "✅ Profile updated successfully!",

      // Login Modal
      loginModalTitle: "🔐 Registrar Login",
      passwordLabel: "Password:",
      enterBtn: "Sign In",
      loginSuccess: "✅ Welcome, {name}!",
      loginError: "❌ Invalid username or password!",

      // Toast & Alerts
      langSwitched: "🌐 Language selected: {lang}",
      slotOccupiedError: "❌ Time slot is already booked!",
      slotPastError: "❌ Cannot schedule for past time!",
      slotWorkHoursError: "❌ Selected time is outside working hours!"
    },
    kk: {
      userProfile: "Тіркеуші профилі",
      queueListBtn: "📋 Кезек Тізімі",
      queueListTitle: "Бүгінгі және ертеңгі науқастар кезегін көру",
      mrtMsktBrand: "⚡ МРТ және КТ:",
      clickPatientRow: "Кестеден науқас қатарын басыңыз",
      selectedPrefix: "Таңдалған:",
      bookQueueBtn: "➕ Кезекке Жазу",
      loginRequired: "Кіру",
      selectPatientFirst: "Алдымен кестеден науқасты таңдаңыз!",
      nonMrtMsktWarning: "Тек МРТ және КТ зерттеулері кезекке жазылады ({service} — МРТ/КТ емес).",
      completedRowWarning: "Бұл зерттеу өткізілген (Жасыл қатар) — Кезекке қойылмайды.",

      // Send Modal
      sendModalTitle: "МРТ және КТ Кезегіне Жазу",
      patientInfoTitle: "👤 Науқас Мәліметтері:",
      patientName: "Науқастың Т.А.Ә:",
      patientType: "Науқас Санаты:",
      referringDoc: "Жолдаған Дәрігер:",
      durationTime: "Ұзақтығы:",
      serviceChoiceTitle: "🏥 Зерттеу Қызметі:",
      allServicesTogether: "Барлық қызметтерді бірге жазу",
      singleService: "Жеке қызмет",
      contrastDetected: "💉 Контрастты зерттеу анықталды",
      durationMin: "мин",
      deviceTargetTitle: "🏢 Құрылғы / Бөлмені таңдаңыз:",
      dateTitle: "📅 Қабылдау Күні:",
      todayBtn: "Бүгін",
      tomorrowBtn: "Ертең",
      timeModeTitle: "⏰ Қабылдау Уақытын Белгілеу:",
      modeAuto: "⚡ Ең жақын бос уақыт (Авто)",
      modeCustom: "🕒 Нақты уақыт (Науқас өтініші бойынша)",
      customStartTime: "Басталу уақыты:",
      customEndTime: "Аралық:",
      calculatingSlot: "Есептелуде...",
      deferReasonTitle: "⚠️ Ең жақын уақыттан бас тарту себебі:",
      deferReasonOtherPlaceholder: "Себебін толық жазыңыз...",
      docLangTitle: "🌐 Құжат / Басып Шығару Тілі:",
      ticket80mm: "🎫 Талон (80мм)",
      consentA4: "📋 Келісім (А4)",
      cancelBtn: "Бас тарту",
      submitBtn: "Кезекке Жазу және Басу",

      // Drawer
      drawerTitle: "📋 Науқастар Кезегінің Тізімі",
      tabAll: "Барлығы",
      tabToday: "Бүгін",
      tabTomorrow: "Ертең",
      searchDrawerPlaceholder: "ID, Т.А.Ә. немесе бөлме бойынша іздеу...",
      colTime: "Уақыты",
      colId: "ID",
      colPatient: "Науқастың Т.А.Ә.",
      colCategory: "Санаты / Бөлімше",
      colService: "Зерттеу Атауы",
      colReferring: "Жолдаған Дәрігер",
      colOperator: "Тіркеуші",
      colWaitingRoom: "Күту Залында",
      colStatus: "Күйі",
      colTicket: "Талон",
      colConsent: "Келісім",
      statusWaiting: "Күтуде",
      statusCalling: "Шақырылуда",
      statusInProgress: "Қабылдауда",
      statusCompleted: "Аяқталды",
      statusCancelled: "Өшірілген",
      statusUnknown: "Белгісіз",
      btnMarkArrived: "🟢 Залда",
      btnMarkNotArrived: "⏳ Келмеді",
      btnMarkArrivedTitle: "Науқас күту залында (Өзгерту үшін басыңыз)",
      btnMarkNotArrivedTitle: "Науқас әлі келмеді (Келгенін белгілеу үшін басыңыз)",
      btnReprintTicket: "Талонды қайта басу",
      btnReprintConsent: "Келісімді басып шығару",
      noPatientsFound: "Науқастар табылмады",
      noPatientsSubtitle: "Бұл күнге науқастар жазылмаған немесе табылмады.",
      patientsCount: "науқас",
      otherDevices: "Басқа құрылғылар",
      showingSummary: "Көрсетілуде: {total} науқас (Белсенді кезек: {active}) | Күні: {date}",

      // Profile Modal
      profileTitle: "⚙️ Тіркеуші Профилі",
      loginLabel: "Логин:",
      nameLabel: "Т.А.Ә.:",
      newPasswordLabel: "Жаңа құпиясөз (міндетті емес):",
      saveBtn: "Сақтау",
      logoutBtn: "Шығу",
      profileSaved: "✅ Профиль сәтті жаңартылды!",

      // Login Modal
      loginModalTitle: "🔐 Тіркеушінің Кіру Жүйесі",
      passwordLabel: "Құпиясөз:",
      enterBtn: "Кіру",
      loginSuccess: "✅ Қош келдіңіз, {name}!",
      loginError: "❌ Логин немесе құпиясөз қате!",

      // Toast & Alerts
      langSwitched: "🌐 Тіл таңдалды: {lang}",
      slotOccupiedError: "❌ Бұл уақыт бос емес!",
      slotPastError: "❌ Өтіп кеткен уақытқа жазуға болмайды!",
      slotWorkHoursError: "❌ Таңдалған уақыт жұмыс уақытынан тыс!"
    },
    tg: {
      userProfile: "Профили бақайдгиранда",
      queueListBtn: "📋 Рӯйхати Навбат",
      queueListTitle: "Дидани рӯйхати навбати беморони имрӯз ва фардо",
      mrtMsktBrand: "⚡ МРТ ва КТ:",
      clickPatientRow: "Сатри беморро аз ҷадвал интихоб кунед",
      selectedPrefix: "Интихобшуда:",
      bookQueueBtn: "➕ Ба Навбат Гузоштан",
      loginRequired: "Ворид шудан",
      selectPatientFirst: "Лутфан аввал беморро аз ҷадвал интихоб кунед!",
      nonMrtMsktWarning: "Танҳо ташхисҳои МРТ ва КТ ба навбат гузошта мешаванд ({service} — МРТ/КТ нест).",
      completedRowWarning: "Ин ташхис аллакай гузаронида шудааст (Сатри сабз) — Ба навбат гузошта намешавад.",

      // Send Modal
      sendModalTitle: "Ба Навбати МРТ ва КТ Гузоштан",
      patientInfoTitle: "👤 Маълумоти Бемор:",
      patientName: "Н.Н.О-и Бемор:",
      patientType: "Гурӯҳи Бемор:",
      referringDoc: "Духтури Роҳхатдиҳанда:",
      durationTime: "Давомнокӣ:",
      serviceChoiceTitle: "🏥 Хизматрасонии Ташхис:",
      allServicesTogether: "Ҳамаи хизматрасониҳо якҷоя",
      singleService: "Хизматрасонии алоҳида",
      contrastDetected: "💉 Ташхиси контрастӣ муайян карда шуд",
      durationMin: "дақ",
      deviceTargetTitle: "🏢 Дастгоҳ / Ҳуҷраро интихоб кунед:",
      dateTitle: "📅 Санаи Қабул:",
      todayBtn: "Имрӯз",
      tomorrowBtn: "Фардо",
      timeModeTitle: "⏰ Муайян кардани Вақти Қабул:",
      modeAuto: "⚡ Вақти холӣ наздиктарин (Авто)",
      modeCustom: "🕒 Вақти дилхоҳ (Бо хоҳиши бемор)",
      customStartTime: "Вақти оғоз:",
      customEndTime: "Фосила:",
      calculatingSlot: "Ҳисоб карда мешавад...",
      deferReasonTitle: "⚠️ Сабаби рад кардани вақти наздиктарин:",
      deferReasonOtherPlaceholder: "Сабабро муфассал нависед...",
      docLangTitle: "🌐 Забони Ҳуҷҷат / Чоп:",
      ticket80mm: "🎫 Талон (80мм)",
      consentA4: "📋 Ризоият (А4)",
      cancelBtn: "Бекор кардан",
      submitBtn: "Ба Навбат Гузоштан ва Чоп",

      // Drawer
      drawerTitle: "📋 Рӯйхати Навбати Беморон",
      tabAll: "Ҳама",
      tabToday: "Имрӯз",
      tabTomorrow: "Фардо",
      searchDrawerPlaceholder: "Ҷустуҷӯ аз рӯи ID, Н.Н.О. ё ҳуҷра...",
      colTime: "Вақт",
      colId: "ID",
      colPatient: "Н.Н.О-и Бемор",
      colCategory: "Гурӯҳ / Шуъба",
      colService: "Номи Ташхис",
      colReferring: "Духтури Роҳхатдиҳанда",
      colOperator: "Бақайдгиранда",
      colWaitingRoom: "Дар Толор",
      colStatus: "Ҳолат",
      colTicket: "Талон",
      colConsent: "Ризоият",
      statusWaiting: "Дар интизорӣ",
      statusCalling: "Даъват мешавад",
      statusInProgress: "Дар қабул",
      statusCompleted: "Анҷом ёфт",
      statusCancelled: "Бекор шуд",
      statusUnknown: "Номаълум",
      btnMarkArrived: "🟢 Дар толор",
      btnMarkNotArrived: "⏳ Наомадааст",
      btnMarkArrivedTitle: "Бемор дар толор нишастааст (Барои иваз кардан пахш кунед)",
      btnMarkNotArrivedTitle: "Бемор ҳанӯз наомадааст (Барои қайди омадан пахш кунед)",
      btnReprintTicket: "Бори дигар чопи талон",
      btnReprintConsent: "Чопи ризоияти А4",
      noPatientsFound: "Беморон ёфт нашуданд",
      noPatientsSubtitle: "Барои ин сана беморон сабт нашудаанд ё ёфт нашуданд.",
      patientsCount: "бемор",
      otherDevices: "Дастгоҳҳои дигар",
      showingSummary: "Нишон дода мешавад: {total} нафар (Фаъол: {active}) | Сана: {date}",

      // Profile Modal
      profileTitle: "⚙️ Профили Бақайдгиранда",
      loginLabel: "Логин:",
      nameLabel: "Н.Н.О.:",
      newPasswordLabel: "Рамзи нав (ихтиёрӣ):",
      saveBtn: "Сабт кардан",
      logoutBtn: "Баромадан",
      profileSaved: "✅ Маълумот бомуваффақият сабт шуд!",

      // Login Modal
      loginModalTitle: "🔐 Воридшавии Бақайдгиранда",
      passwordLabel: "Рамз:",
      enterBtn: "Ворид шудан",
      loginSuccess: "✅ Хуш омадед, {name}!",
      loginError: "❌ Логин ё рамз нодуруст аст!",

      // Toast & Alerts
      langSwitched: "🌐 Забон интихоб шуд: {lang}",
      slotOccupiedError: "❌ Ин вақт банд аст!",
      slotPastError: "❌ Ба вақти гузашта навбат гузоштан мумкин нест!",
      slotWorkHoursError: "❌ Вақти интихобшуда берун аз соатҳои корӣ аст!"
    },
    tr: {
      userProfile: "Kayıt Görevlisi Profili",
      queueListBtn: "📋 Sıra Listesi",
      queueListTitle: "Bugünkü ve yarınki hasta sırasını görüntüle",
      mrtMsktBrand: "⚡ MR ve BT:",
      clickPatientRow: "Tablodan hasta satırını seçiniz",
      selectedPrefix: "Seçilen:",
      bookQueueBtn: "➕ Randevu Ver",
      loginRequired: "Giriş Yap",
      selectPatientFirst: "Lütfen önce tablodan bir hasta seçiniz!",
      nonMrtMsktWarning: "Yalnızca MR ve BT tetkiklerine randevu verilir ({service} — MR/BT değildir).",
      completedRowWarning: "Bu tetkik tamamlanmış (Yeşil satır) — Randevu verilemez.",

      // Send Modal
      sendModalTitle: "MR ve BT Sırasına Kayıt",
      patientInfoTitle: "👤 Hasta Bilgileri:",
      patientName: "Hasta Adı Soyadı:",
      patientType: "Hasta Kategorisi:",
      referringDoc: "Yönlendiren Hekim:",
      durationTime: "Süre:",
      serviceChoiceTitle: "🏥 Tetkik Hizmeti:",
      allServicesTogether: "Tüm hizmetleri birlikte kaydet",
      singleService: "Ayrı hizmet",
      contrastDetected: "💉 Kontrastlı tetkik tespit edildi",
      durationMin: "dk",
      deviceTargetTitle: "🏢 Cihaz / Oda Seçiniz:",
      dateTitle: "📅 Randevu Tarihi:",
      todayBtn: "Bugün",
      tomorrowBtn: "Yarın",
      timeModeTitle: "⏰ Randevu Saati Belirleme:",
      modeAuto: "⚡ En Yakın Boş Saat (Otomatik)",
      modeCustom: "🕒 Belirli Saat (Hasta İsteğine Göre)",
      customStartTime: "Başlangıç Saati:",
      customEndTime: "Aralık:",
      calculatingSlot: "Hesaplanıyor...",
      deferReasonTitle: "⚠️ En yakın saatten vazgeçme gerekçesi:",
      deferReasonOtherPlaceholder: "Gerekçeyi detaylı yazınız...",
      docLangTitle: "🌐 Belge / Yazdırma Dili:",
      ticket80mm: "🎫 Bilet (80mm)",
      consentA4: "📋 Onam Formu (A4)",
      cancelBtn: "İptal",
      submitBtn: "Randevu Ver ve Yazdır",

      // Drawer
      drawerTitle: "📋 Hasta Sıra Listesi",
      tabAll: "Tümü",
      tabToday: "Bugün",
      tabTomorrow: "Yarın",
      searchDrawerPlaceholder: "Hasta ID, Ad veya Odaya göre ara...",
      colTime: "Saat",
      colId: "ID",
      colPatient: "Hasta Adı Soyadı",
      colCategory: "Kategori / Servis",
      colService: "Tetkik Adı",
      colReferring: "Yönlendiren Hekim",
      colOperator: "Kayıt Görevlisi",
      colWaitingRoom: "Bekleme Alanında",
      colStatus: "Durum",
      colTicket: "Bilet",
      colConsent: "Onam",
      statusWaiting: "Bekliyor",
      statusCalling: "Çağrılıyor",
      statusInProgress: "İşlemde",
      statusCompleted: "Tamamlandı",
      statusCancelled: "İptal Edildi",
      statusUnknown: "Bilinmiyor",
      btnMarkArrived: "🟢 Salonda",
      btnMarkNotArrived: "⏳ Gelmedi",
      btnMarkArrivedTitle: "Hasta bekleme salonunda (Değiştirmek için tıklayınız)",
      btnMarkNotArrivedTitle: "Hasta henüz gelmedi (Geldi olarak işaretlemek için tıklayınız)",
      btnReprintTicket: "Bileti tekrar yazdır",
      btnReprintConsent: "A4 Onam formunu yazdır",
      noPatientsFound: "Hasta bulunamadı",
      noPatientsSubtitle: "Bu tarihte kayıtlı hasta bulunmamaktadır.",
      patientsCount: "hasta",
      otherDevices: "Diğer cihazlar",
      showingSummary: "Gösterilen: {total} hasta (Aktif sıra: {active}) | Tarih: {date}",

      // Profile Modal
      profileTitle: "⚙️ Kayıt Görevlisi Profili",
      loginLabel: "Kullanıcı Adı:",
      nameLabel: "Ad Soyad:",
      newPasswordLabel: "Yeni Şifre (isteğe bağlı):",
      saveBtn: "Kaydet",
      logoutBtn: "Çıkış Yap",
      profileSaved: "✅ Profil başarıyla güncellendi!",

      // Login Modal
      loginModalTitle: "🔐 Kayıt Görevlisi Girişi",
      passwordLabel: "Şifre:",
      enterBtn: "Giriş Yap",
      loginSuccess: "✅ Hoş geldiniz, {name}!",
      loginError: "❌ Hatalı kullanıcı adı veya şifre!",

      // Toast & Alerts
      langSwitched: "🌐 Dil seçildi: {lang}",
      slotOccupiedError: "❌ Bu saat aralığı dolu!",
      slotPastError: "❌ Geçmiş saate randevu verilemez!",
      slotWorkHoursError: "❌ Seçilen saat mesai saatleri dışındadır!"
    }
  },

  // 8.1. REGISTRATURA PANELI INTERFEYSI (Registratura Web App UI)
  reg: {
    uz: {
      centerName: "RESPUBLIKA IXTISOSLASHTIRILGAN ONKOLOGIYA VA RADIOLOGIYA ILMIY-AMALIY TIBBIYOT MARKAZI",
      sidebarQueue: "Bemorlar Navbati",
      sidebarNewPatient: "Yangi Bemor Qo'shish",
      sidebarRooms: "Qurilmalar & Xonalar",
      pageTitle: "Bugungi Navbat Ro'yxati",
      btnNewPatient: "Yangi Navbat Berish",
      btnExportExcel: "Excelga Yuklash",
      btnExtZip: "Kengaytma (.ZIP)",
      statTotal: "Jami Bemorlar",
      statWaiting: "Kutayotganlar",
      statCalling: "Qabulda",
      statCompleted: "Yakunlandi",
      searchPlaceholder: "F.I.Sh yoki ID bo'yicha qidirish...",
      dateLabel: "📅 Sana:",
      todayBtn: "Bugun",
      tomorrowBtn: "Ertaga",
      allDoctors: "Barcha Vrachlar / Xonalar",
      allStatuses: "Barcha Holatlar",
      statusWaiting: "Kutmoqda",
      statusCalling: "Chaqirilmoqda",
      statusInProgress: "Qabulda",
      statusCompleted: "Yakunlandi",
      statusCancelled: "Bekor qilingan",
      colId: "ID",
      colPatient: "Bemor F.I.Sh",
      colType: "Toifasi / Bo'lim",
      colDevice: "Qurilma & Xona",
      colService: "Tekshiruv",
      colTime: "Band Qilingan Vaqt",
      colReferring: "Fayl Shifokori",
      colOperator: "Ro'yxatchi",
      colArrived: "Kutish Zalida",
      colStatus: "Holat",
      colActions: "Amallar",
      arrivedInHall: "🟢 Zalda",
      notArrived: "⏳ Hali kelmadi",
      noPatients: "{date} sanasi uchun bemorlar topilmadi",
      loadingPatients: "Bemorlar yuklanmoqda...",
      printTicket: "Talon",
      printConsent: "Anketa",
      cancelQueue: "Navbatdan o'chirish",
      restoreQueue: "Qayta tiklash",
      cancelledBadge: "O'chirilgan",
      freedSlot: "Bo'shatildi",
      outOfQueue: "1-O'rin (Navbatdan tashqari)",
      sampleLabel: "Namuna:",
      connOnline: "Firebase: Ulangan",
      connOffline: "Firebase: Aloqa yo'q"
    },
    ru: {
      centerName: "РЕСПУБЛИКАНСКИЙ СПЕЦИАЛИЗИРОВАННЫЙ НАУЧНО-ПРАКТИЧЕСКИЙ МЕДИЦИНСКИЙ ЦЕНТР ОНКОЛОГИИ И РАДИОЛОГИИ",
      sidebarQueue: "Очередь Пациентов",
      sidebarNewPatient: "Новый Пациент",
      sidebarRooms: "Аппараты и Кабинеты",
      pageTitle: "Список Очереди на Сегодня",
      btnNewPatient: "Записать в Очередь",
      btnExportExcel: "Экспорт в Excel",
      btnExtZip: "Расширение (.ZIP)",
      statTotal: "Всего Пациентов",
      statWaiting: "В Ожидании",
      statCalling: "На Приёме",
      statCompleted: "Завершено",
      searchPlaceholder: "Поиск по Ф.И.О. или ID...",
      dateLabel: "📅 Дата:",
      todayBtn: "Сегодня",
      tomorrowBtn: "Завтра",
      allDoctors: "Все Врачи / Кабинеты",
      allStatuses: "Все Статусы",
      statusWaiting: "В ожидании",
      statusCalling: "Вызывается",
      statusInProgress: "На приёме",
      statusCompleted: "Завершено",
      statusCancelled: "Отменено",
      colId: "ID",
      colPatient: "Ф.И.О. Пациента",
      colType: "Категория / Отд.",
      colDevice: "Аппарат и Кабинет",
      colService: "Исследование",
      colTime: "Забронированное Время",
      colReferring: "Направивший Врач",
      colOperator: "Регистратор",
      colArrived: "В Зале Ожидания",
      colStatus: "Статус",
      colActions: "Действия",
      arrivedInHall: "🟢 В зале",
      notArrived: "⏳ Еще не прибыл",
      noPatients: "Пациенты на дату {date} не найдены",
      loadingPatients: "Загрузка пациентов...",
      printTicket: "Талон",
      printConsent: "Анкета",
      cancelQueue: "Отменить очередь",
      restoreQueue: "Восстановить",
      cancelledBadge: "Отменено",
      freedSlot: "Освобождено",
      outOfQueue: "1-е место (Вне очереди)",
      sampleLabel: "Образец:",
      connOnline: "Firebase: Подключено",
      connOffline: "Firebase: Нет связи"
    },
    en: {
      centerName: "REPUBLICAN SPECIALIZED SCIENTIFIC AND PRACTICAL MEDICAL CENTER OF ONCOLOGY AND RADIOLOGY",
      sidebarQueue: "Patient Queue",
      sidebarNewPatient: "Add New Patient",
      sidebarRooms: "Devices & Rooms",
      pageTitle: "Today's Queue List",
      btnNewPatient: "Book Appointment",
      btnExportExcel: "Export to Excel",
      btnExtZip: "Extension (.ZIP)",
      statTotal: "Total Patients",
      statWaiting: "Waiting",
      statCalling: "In Progress",
      statCompleted: "Completed",
      searchPlaceholder: "Search by Name or ID...",
      dateLabel: "📅 Date:",
      todayBtn: "Today",
      tomorrowBtn: "Tomorrow",
      allDoctors: "All Doctors / Rooms",
      allStatuses: "All Statuses",
      statusWaiting: "Waiting",
      statusCalling: "Calling",
      statusInProgress: "In Progress",
      statusCompleted: "Completed",
      statusCancelled: "Cancelled",
      colId: "ID",
      colPatient: "Patient Full Name",
      colType: "Category / Dept",
      colDevice: "Device & Room",
      colService: "Examination",
      colTime: "Booked Time",
      colReferring: "Referring Doctor",
      colOperator: "Registrar",
      colArrived: "In Waiting Room",
      colStatus: "Status",
      colActions: "Actions",
      arrivedInHall: "🟢 In Hall",
      notArrived: "⏳ Not Arrived",
      noPatients: "No patients found for {date}",
      loadingPatients: "Loading patients...",
      printTicket: "Ticket",
      printConsent: "Consent",
      cancelQueue: "Cancel Queue",
      restoreQueue: "Restore",
      cancelledBadge: "Cancelled",
      freedSlot: "Freed",
      outOfQueue: "1st Priority (Out of queue)",
      sampleLabel: "Sample:",
      connOnline: "Firebase: Connected",
      connOffline: "Firebase: Offline"
    },
    kk: {
      centerName: "РЕСПУБЛИКАЛЫҚ МАМАНДАНДЫРЫЛҒАН ОНКОЛОГИЯ ЖӘНЕ РАДИОЛОГИЯ ҒЫЛЫМИ-ПРАКТИКАЛЫҚ МЕДИЦИНАЛЫҚ ОРТАЛЫҒЫ",
      sidebarQueue: "Науқастар Кезегі",
      sidebarNewPatient: "Жаңа Науқас Қосу",
      sidebarRooms: "Құрылғылар мен Бөлмелер",
      pageTitle: "Бүгінгі Кезек Тізімі",
      btnNewPatient: "Кезекке Жазу",
      btnExportExcel: "Excel-ге Жүктеу",
      btnExtZip: "Кеңейтпе (.ZIP)",
      statTotal: "Барлық Науқастар",
      statWaiting: "Күтуде",
      statCalling: "Қабылдауда",
      statCompleted: "Аяқталды",
      searchPlaceholder: "Аты-жөні немесе ID бойынша іздеу...",
      dateLabel: "📅 Күні:",
      todayBtn: "Бүгін",
      tomorrowBtn: "Ертең",
      allDoctors: "Барлық Дәрігерлер / Бөлмелер",
      allStatuses: "Барлық Күйлер",
      statusWaiting: "Күтуде",
      statusCalling: "Шақырылуда",
      statusInProgress: "Қабылдауда",
      statusCompleted: "Аяқталды",
      statusCancelled: "Жойылған",
      colId: "ID",
      colPatient: "Науқастың Аты-жөні",
      colType: "Санаты / Бөлім",
      colDevice: "Құрылғы мен Бөлме",
      colService: "Зерттеу",
      colTime: "Брондалған Уақыт",
      colReferring: "Жолдаған Дәрігер",
      colOperator: "Тіркеуші",
      colArrived: "Күту Залында",
      colStatus: "Күйі",
      colActions: "Әрекеттер",
      arrivedInHall: "🟢 Залда",
      notArrived: "⏳ Әлі келмеді",
      noPatients: "{date} күніне науқастар табылмады",
      loadingPatients: "Науқастар жүктелуде...",
      printTicket: "Талон",
      printConsent: "Сауалнама",
      cancelQueue: "Кезек өшіру",
      restoreQueue: "Қалпына келтіру",
      cancelledBadge: "Жойылған",
      freedSlot: "Босатылды",
      outOfQueue: "1-орын (Кезексіз)",
      sampleLabel: "Үлгі:",
      connOnline: "Firebase: Қосылған",
      connOffline: "Firebase: Байланыс жоқ"
    },
    tg: {
      centerName: "МАРКАЗИ ИЛМИЮ АМАЛИИ ТИББИИ ИХТИСОСИИ ҶУМҲУРИЯВИИ ОНКОЛОГИЯ ВА РАДИОЛОГИЯ",
      sidebarQueue: "Навбати Беморон",
      sidebarNewPatient: "Иловаи Бемори Нав",
      sidebarRooms: "Дастгоҳҳо ва Ҳуҷраҳо",
      pageTitle: "Рӯйхати Навбати Имрӯза",
      btnNewPatient: "Ба Навбат Гузоштан",
      btnExportExcel: "Боргирӣ ба Excel",
      btnExtZip: "Васеъшавӣ (.ZIP)",
      statTotal: "Ҳамагӣ Беморон",
      statWaiting: "Дар Интизорӣ",
      statCalling: "Дар Қабул",
      statCompleted: "Анҷомёфта",
      searchPlaceholder: "Ҷустуҷӯ аз рӯи Ном ё ID...",
      dateLabel: "📅 Сана:",
      todayBtn: "Имрӯз",
      tomorrowBtn: "Пагоҳ",
      allDoctors: "Ҳамаи Табибон / Ҳуҷраҳо",
      allStatuses: "Ҳамаи Ҳолатҳо",
      statusWaiting: "Дар интизорӣ",
      statusCalling: "Даъват мешавад",
      statusInProgress: "Дар қабул",
      statusCompleted: "Анҷомёфта",
      statusCancelled: "Бекоршуда",
      colId: "ID",
      colPatient: "Ному Насаби Бемор",
      colType: "Гурӯҳ / Шуъба",
      colDevice: "Дастгоҳ ва Ҳуҷра",
      colService: "Муоина",
      colTime: "Вақти Бандшуда",
      colReferring: "Табиби Равонкунанда",
      colOperator: "Бақайдгиранда",
      colArrived: "Дар Толори Интизорӣ",
      colStatus: "Ҳолат",
      colActions: "Амалҳо",
      arrivedInHall: "🟢 Дар толор",
      notArrived: "⏳ Ҳанӯз наомадааст",
      noPatients: "Барои санаи {date} беморон ёфт نشуданд",
      loadingPatients: "Беморон боргирӣ мешаванд...",
      printTicket: "Талон",
      printConsent: "Варақаи розигӣ",
      cancelQueue: "Бекор кардани навбат",
      restoreQueue: "Барқароркунӣ",
      cancelledBadge: "Бекоршуда",
      freedSlot: "Озод шуд",
      outOfQueue: "Ҷойи 1-ум (Берун аз навбат)",
      sampleLabel: "Намуна:",
      connOnline: "Firebase: Пайваст",
      connOffline: "Firebase: Бе алоқа"
    },
    tr: {
      centerName: "CUMHURİYET ONKOLOJİ VE RADYOLOJİ BİLİMSEL-UYGULAMALI TIBBİ MERKEZİ",
      sidebarQueue: "Hasta Sırası",
      sidebarNewPatient: "Yeni Hasta Ekle",
      sidebarRooms: "Cihazlar ve Odalar",
      pageTitle: "Bugünkü Randevu Sırası",
      btnNewPatient: "Yeni Randevu Ver",
      btnExportExcel: "Excel'e Aktar",
      btnExtZip: "Uzantı (.ZIP)",
      statTotal: "Toplam Hasta",
      statWaiting: "Bekleyenler",
      statCalling: "Kabulde",
      statCompleted: "Tamamlandı",
      searchPlaceholder: "İsim veya ID ile ara...",
      dateLabel: "📅 Tarih:",
      todayBtn: "Bugün",
      tomorrowBtn: "Yarın",
      allDoctors: "Tüm Doktorlar / Odalar",
      allStatuses: "Tüm Durumlar",
      statusWaiting: "Bekliyor",
      statusCalling: "Çağrılıyor",
      statusInProgress: "Kabulde",
      statusCompleted: "Tamamlandı",
      statusCancelled: "İptal Edildi",
      colId: "ID",
      colPatient: "Hasta Adı Soyadı",
      colType: "Kategori / Bölüm",
      colDevice: "Cihaz ve Oda",
      colService: "Tetkik",
      colTime: "Randevu Saati",
      colReferring: "Yönlendiren Doktor",
      colOperator: "Kayıt Görevlisi",
      colArrived: "Bekleme Salonunda",
      colStatus: "Durum",
      colActions: "İşlemler",
      arrivedInHall: "🟢 Salonda",
      notArrived: "⏳ Henüz gelmedi",
      noPatients: "{date} tarihi için hasta bulunamadı",
      loadingPatients: "Hastalar yükleniyor...",
      printTicket: "Bilet",
      printConsent: "Onam Formu",
      cancelQueue: "Randevuyu İptal Et",
      restoreQueue: "Geri Al",
      cancelledBadge: "İptal",
      freedSlot: "Boşaltıldı",
      outOfQueue: "1. Sıra (Öncelikli)",
      sampleLabel: "Numune:",
      connOnline: "Firebase: Bağlı",
      connOffline: "Firebase: Bağlantı yok"
    }
  }
};

// 9. KARDELEN VA TIBBIY MA'LUMOTLARNI QAVSLAR [ ] ICHIDA SAQLAGAN HOLDA TARJIMA QILISH
function formatServiceNameWithOriginal(rawServiceName, lang = 'uz') {
  if (!rawServiceName) return "-";
  if (!lang || lang === 'uz') return rawServiceName;

  let translated = rawServiceName;
  const lower = rawServiceName.toLowerCase();

  const svcMap = I18N_TRANSLATIONS.services || {};
  let bestMatchKey = "";

  for (const key of Object.keys(svcMap)) {
    if (lower.includes(key)) {
      if (!bestMatchKey || key.length > bestMatchKey.length) {
        bestMatchKey = key;
      }
    }
  }

  if (bestMatchKey && svcMap[bestMatchKey][lang]) {
    let tName = svcMap[bestMatchKey][lang];
    if (lower.includes("mskt") || lower.includes("msct") || lower.includes("kt") || lower.includes("ct")) {
      tName = (lang === 'ru' ? "КТ / МСКТ " : (lang === 'en' ? "CT / MSCT " : (lang === 'tr' ? "BT / MSBT " : (lang === 'tg' ? "МСКТ " : "МСКТ ")))) + tName;
    } else if (lower.includes("mrt") || lower.includes("mri") || lower.includes("mr")) {
      tName = (lang === 'ru' ? "МРТ " : (lang === 'en' ? "MRI " : (lang === 'tr' ? "MR " : "МРТ "))) + tName;
    }
    if (lower.includes("kontrastli") || lower.includes("kontrast bilan")) {
      tName += (lang === 'ru' ? " (С контрастом)" : (lang === 'en' ? " (With contrast)" : (lang === 'tr' ? " (Kontrastlı)" : (lang === 'kk' ? " (Контрастпен)" : (lang === 'tg' ? " (Бо контраст)" : " (Kontrastli)")))));
    } else if (lower.includes("kontrastsiz") || lower.includes("oddiy")) {
      tName += (lang === 'ru' ? " (Без контраста)" : (lang === 'en' ? " (Without contrast)" : (lang === 'tr' ? " (Kontrastsız)" : (lang === 'kk' ? " (Контрастсыз)" : (lang === 'tg' ? " (Бе контраст)" : " (Kontrastsiz)")))));
    }
    translated = tName;
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

  const roomMap = I18N_TRANSLATIONS.rooms || {};
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

  const reasonMap = I18N_TRANSLATIONS.deferReasons || {};
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
    if (qLower.includes("klavstrofobiya") || qLower.includes("yopiq fazo") || qLower.includes("yopiq yoki tor")) {
      return (qMap.claustrophobia && qMap.claustrophobia[lang]) ? qMap.claustrophobia[lang] : q;
    }
    if (qLower.includes("homiladorlik") || qLower.includes("emizikli")) {
      return (qMap.pregnancy && qMap.pregnancy[lang]) ? qMap.pregnancy[lang] : q;
    }
    if (qLower.includes("allergiya") || qLower.includes("yodga") || qLower.includes("kontrast modda")) {
      return (qMap.allergy && qMap.allergy[lang]) ? qMap.allergy[lang] : q;
    }
    if (qLower.includes("buyrak yetishmovchiligi") || qLower.includes("gemodializ") || qLower.includes("buyrak kasalliklari")) {
      return (qMap.kidney && qMap.kidney[lang]) ? qMap.kidney[lang] : q;
    }
    if (qLower.includes("astma") || qLower.includes("diabet") || qLower.includes("qalqonsimon bez")) {
      return (qMap.asthmaDiabetes && qMap.asthmaDiabetes[lang]) ? qMap.asthmaDiabetes[lang] : q;
    }
    if (qLower.includes("eshitish apparati") || qLower.includes("tish protez") || qLower.includes("tatuirovka") || qLower.includes("pirsing")) {
      return (qMap.hearingDental && qMap.hearingDental[lang]) ? qMap.hearingDental[lang] : q;
    }
    if (qLower.includes("och qol") || qLower.includes("och qorin") || qLower.includes("ochlik")) {
      return (qMap.abdominalFasting && qMap.abdominalFasting[lang]) ? qMap.abdominalFasting[lang] : q;
    }
    if (qLower.includes("qovuq") || qLower.includes("suv ich") || qLower.includes("kichik chanoq")) {
      return (qMap.pelvicBladder && qMap.pelvicBladder[lang]) ? qMap.pelvicBladder[lang] : q;
    }
    return q;
  });
}

// 11. KO'P TILLI TIBBIY KO'RSATMALAR HTML FORMATER (80mm Talon uchun)
function formatConsolidatedGuidelinesHtml(payload, lang = 'uz', customConfig = null) {
  if (!payload) return "";
  const L = lang || payload.printLang || (typeof getI18nLanguage === 'function' ? getI18nLanguage() : 'uz') || 'uz';
  const gDict = (customConfig && customConfig.guidelines && customConfig.guidelines[L]) 
    ? customConfig.guidelines[L] 
    : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.guidelines && I18N_TRANSLATIONS.guidelines[L]) 
        ? I18N_TRANSLATIONS.guidelines[L] 
        : ((typeof I18N_TRANSLATIONS !== 'undefined' && I18N_TRANSLATIONS.guidelines) ? I18N_TRANSLATIONS.guidelines['uz'] : {
            boxTitle: "TIBBIY KO'RSATMALAR VA ESLATMA",
            singlePrepTitle: "📋 Tayyorgarlik:",
            generalPrepTitle: "📋 Umumiy Tayyorgarlik:",
            contraTitle: "🚫 Qarshi ko'rsatmalar:"
          }));

  const prep = (payload.preparation || "").trim();
  const contra = (payload.contraindications || "").trim();
  const sList = payload.servicesList || [];
  const isMultiple = (sList && sList.length > 1);

  let prepLines = [];
  let contraLines = [];

  function parseTextToLines(text) {
    if (!text || text === "—" || text === "-") return [];
    return text.split(/\r?\n/)
      .map(line => line.trim().replace(/^[•\-\*]\s*/, '').trim())
      .filter(line => line.length > 1);
  }

  // 1. Agar payload.preparation mavjud bo'lsa:
  if (prep) {
    prepLines.push(...parseTextToLines(prep));
  }

  // 2. Agar payload.contraindications mavjud bo'lsa:
  if (contra) {
    contraLines.push(...parseTextToLines(contra));
  }

  // 3. Agar bir nechta tekshiruvlar ro'yxati (sList) bo'lsa va yuqoridagi bo'sh bo'lsa:
  if (sList.length > 0 && prepLines.length === 0) {
    sList.forEach(s => {
      const sPrep = parseTextToLines(s.preparation);
      const sName = s.fullName || s.name || "";
      sPrep.forEach(p => {
        prepLines.push(sList.length > 1 ? `[${sName}] ${p}` : p);
      });
      const sContra = parseTextToLines(s.contraindications);
      contraLines.push(...sContra);
    });
  }

  // 4. Agar umumiy bazada ham tayyorgarlik bo'sh bo'lsa, xavfsizlik uchun tekshiruv turiga mos minimal eslatma:
  if (prepLines.length === 0) {
    if (payload.isContrast) {
      prepLines.push(gDict.fasting ? gDict.fasting.replace('{H}', '4-6') : "4-6 soat och qoringa kelish.");
      if (gDict.bloodTest) prepLines.push(gDict.bloodTest);
      if (gDict.metformin) prepLines.push(gDict.metformin);
      if (gDict.postHydration) prepLines.push(gDict.postHydration);
    } else if (payload.deviceType === "MRT" || (payload.doctorName && payload.doctorName.includes("MRT"))) {
      if (gDict.metalWarning) prepLines.push(gDict.metalWarning);
    }
  }

  if (contraLines.length === 0) {
    if (payload.isContrast) {
      if (gDict.allergy) contraLines.push(gDict.allergy);
      if (gDict.kidney) contraLines.push(gDict.kidney);
      if (gDict.pregnancy) contraLines.push(gDict.pregnancy);
    } else if (payload.deviceType === "MRT" || (payload.doctorName && payload.doctorName.includes("MRT"))) {
      if (gDict.pacemaker) contraLines.push(gDict.pacemaker);
    }
  }

  // Deduplikatsiya
  const seenP = new Set();
  prepLines = prepLines.filter(p => {
    const norm = p.toLowerCase().replace(/[^a-z0-9а-яёўқғҳ]/gi, '');
    if (seenP.has(norm)) return false;
    seenP.add(norm);
    return true;
  });

  const seenC = new Set();
  contraLines = contraLines.filter(c => {
    const norm = c.toLowerCase().replace(/[^a-z0-9а-яёўқғҳ]/gi, '');
    if (seenC.has(norm)) return false;
    seenC.add(norm);
    return true;
  });

  if (prepLines.length === 0 && contraLines.length === 0) {
    return "";
  }

  function esc(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  return `
    <div class="guide-box" style="border: 2px solid #000; border-radius: 4px; padding: 6px 8px; margin-bottom: 6px; font-size: 11px; line-height: 1.35; text-align: left; color: #000 !important;">
      <div style="font-size: 11.5px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px; text-align: center; color: #000 !important; border-bottom: 2px dashed #000; padding-bottom: 3px;">
        ${esc(gDict.boxTitle || "TIBBIY KO'RSATMALAR VA ESLATMA")}
      </div>
      ${prepLines.length > 0 ? `
        <div style="margin-top: 4px; font-size: 11px;">
          <div style="font-weight: 900; margin-bottom: 2px; color:#000 !important;">${esc(isMultiple ? (gDict.generalPrepTitle || '📋 Umumiy Tayyorgarlik:') : (gDict.singlePrepTitle || '📋 Tayyorgarlik:'))}</div>
          <div style="padding-left: 2px; line-height: 1.35;">
            ${prepLines.map(g => `<div style="margin-top:2px;">• ${esc(g)}</div>`).join('')}
          </div>
        </div>
      ` : ''}
      ${contraLines.length > 0 ? `
        <div style="margin-top: 5px; font-size: 11px;">
          <div style="font-weight: 900; margin-bottom: 2px; color:#000 !important;">${esc(gDict.contraTitle || "🚫 Qarshi ko'rsatmalar:")}</div>
          <div style="padding-left: 2px; line-height: 1.35;">
            ${contraLines.map(c => `<div style="margin-top:2px;">• ${esc(c)}</div>`).join('')}
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
