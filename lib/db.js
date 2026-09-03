/**
 * Tibbiyot / MRT & UTT Navbat Tizimi - Lokal Ma'lumotlar Bazasi (lib/db.js)
 * Tashqi bazalarsiz, 100% lokal JSON fayllar asosida atomik xotirada ishlaydi.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUPS_DIR = path.join(DATA_DIR, 'backups');

// Standart boshlang'ich ma'lumotlar
const DEFAULT_DEVICES = [
  {
    id: "mrt1",
    name: "MRT 1 (1.5 Tesla)",
    room: "1-MRT Xonasi",
    type: "MRT",
    specialty: "Tomografiya (MRT)",
    hasInjector: true,
    supportsContrast: true,
    status: "active",
    currentPatientId: null
  },
  {
    id: "mrt2",
    name: "MRT 2 (3.0 Tesla)",
    room: "2-MRT Xonasi",
    type: "MRT",
    specialty: "Tomografiya (MRT)",
    hasInjector: false,
    supportsContrast: false,
    status: "active",
    currentPatientId: null
  },
  {
    id: "mskt1",
    name: "MSKT 1",
    room: "1-MSKT Xonasi",
    type: "MSKT",
    specialty: "Tomografiya (MSKT)",
    hasInjector: true,
    supportsContrast: true,
    status: "active",
    currentPatientId: null
  }
];

const DEFAULT_SETTINGS = {
  clinicName: "Respublika Radiologiya va Onkologiya Markazi",
  autoSchedule: true,
  prepTimeMinutes: 15,
  voiceLanguage: "uz", // "uz", "ru"
  enableSoundNotification: true,
  allowedSubnets: ["127.0.0.1", "192.168.", "10."],
  mrt1ContrastOnly: true
};

const DEFAULT_CONSENT_QUESTIONS = [
  {
    id: "cq_mrt_pacemaker",
    category: "MRT",
    order: 1,
    text: "Tanangizda kardiostimulyator, sun'iy yurak klapani, neyrostimulyator yoki insulin pompasi bormi?",
    riskLevel: "danger",
    dangerAnswer: "yes",
    description: "Kuchli magnit maydoni kardiostimulyator faoliyatini to'xtatishi yoki qizib ketishiga sabab bo'lishi mumkin (Mutlaq qarshi ko'rsatma).",
    required: true
  },
  {
    id: "cq_mrt_clips",
    category: "MRT",
    order: 2,
    text: "Bosh miya qon tomirlarida metall klipslar, ko'z sohasida metall qirindi/parchalari yoki o'q/shrapnel bormi?",
    riskLevel: "danger",
    dangerAnswer: "yes",
    description: "Magnit maydonida metall parchalari siljishi va to'qimalarga jiddiy shikast yetkazishi mumkin.",
    required: true
  },
  {
    id: "cq_mrt_cochlear",
    category: "MRT",
    order: 3,
    text: "Quloq ichi implantati (koxlear implant) yoki eshitish apparati o'rnatilganmi?",
    riskLevel: "danger",
    dangerAnswer: "yes",
    description: "Elektron implant shikastlanishi va kuchli og'riq keltirib chiqarishi mumkin.",
    required: true
  },
  {
    id: "cq_mrt_implants",
    category: "MRT",
    order: 4,
    text: "Tanangizda sun'iy bo'g'im endoprotezlari, metall plastina, vint, stent yoki protezlar mavjudmi?",
    riskLevel: "warning",
    dangerAnswer: "yes",
    description: "Protezning metall tarkibi (titan, po'lat) va o'rnatilgan muddati haqida ma'lumot talab etiladi.",
    required: true
  },
  {
    id: "cq_mrt_claustro",
    category: "MRT",
    order: 5,
    text: "Sizda tor va yopiq joylardan qo'rqish (klaustrofobiya) holati bormi?",
    riskLevel: "warning",
    dangerAnswer: "yes",
    description: "Zarur bo'lsa, sedativ dori vositalari qo'llash yoki tekshiruv davomida yaqinlaridan birining birga turishi kerak.",
    required: false
  },
  {
    id: "cq_gen_pregnancy",
    category: "ALL",
    order: 6,
    text: "Homiladorlik holatidamisiz yoki homiladorlik ehtimoli bormi?",
    riskLevel: "danger",
    dangerAnswer: "yes",
    description: "Homiladorlikning 1-trimestrida MRT faqat hayotiy ko'rsatma bo'yicha o'tkaziladi. MSKT tekshiruvida rentgen nurlanishi sababli homiladorlikda qat'iyan taqiqlanadi.",
    required: true
  },
  {
    id: "cq_mrt_tattoo",
    category: "MRT",
    order: 7,
    text: "Tanangizda metall tarkibli bo'yoq bilan chizilgan tatuirovkalar bormi?",
    riskLevel: "info",
    dangerAnswer: "yes",
    description: "Ba'zi temir tarkibli bo'yoqlar tekshiruv vaqtida biroz qizishi mumkin.",
    required: false
  },
  {
    id: "cq_mrt_removables",
    category: "MRT",
    order: 8,
    text: "Barcha metall buyumlar: tish protezlari, soat, uzuk, sirg'a, soch to'g'nog'ichlari, telefon va kalitlar yechildimi?",
    riskLevel: "danger",
    dangerAnswer: "no",
    description: "Xonaga kirishdan oldin barcha metall va magnit buyumlar mutlaqo yechilishi shart!",
    required: true
  },
  {
    id: "cq_mskt_barium",
    category: "MSKT",
    order: 9,
    text: "Oxirgi 7 kun ichida oshqozon-ichak trakti bariy moddasi bilan rentgen qilinganmi?",
    riskLevel: "warning",
    dangerAnswer: "yes",
    description: "Qorin bo'shlig'idagi qoldiq bariy tomografik tasvirlarda kuchli artefakt keltirib chiqaradi.",
    required: false
  },
  {
    id: "cq_contrast_allergy",
    category: "CONTRAST",
    order: 11,
    text: "Oldin kontrast moddalarga, yodga, dori-darmonlarga yoki dengiz mahsulotlariga kuchli allergiya bo'lganmi?",
    riskLevel: "danger",
    dangerAnswer: "yes",
    description: "Anafilaktik shok xavfini baholash va kerak bo'lsa oldindan antiallergik premedikatsiya o'tkazish kerak.",
    required: true
  },
  {
    id: "cq_contrast_kidney",
    category: "CONTRAST",
    order: 12,
    text: "Sizda surunkali buyrak kasalligi bormi? Qon tahlilida Kreatinin miqdori me'yordami?",
    riskLevel: "danger",
    dangerAnswer: "yes",
    description: "Kontrast nefropatiyasi xavfi. Kreatinin va GFR ko'rsatkichi me'yordan yuqori bo'lsa kontrast qilinmaydi.",
    required: true
  },
  {
    id: "cq_contrast_diabetes",
    category: "CONTRAST",
    order: 13,
    text: "Qandli diabet bormi va Metformin (Siofor, Glukofaj) dori vositalarini qabul qilasizmi?",
    riskLevel: "warning",
    dangerAnswer: "yes",
    description: "Kontrastli MSKT dan oldin va keyin 48 soat davomida Metformin dori vositasini to'xtatib turish shart.",
    required: true
  },
  {
    id: "cq_contrast_asthma",
    category: "CONTRAST",
    order: 14,
    text: "Bronxial astma yoki surunkali nafas qisishi kasalligi kuzatiladimi?",
    riskLevel: "warning",
    dangerAnswer: "yes",
    description: "Bronxospazm xavfi yuqori bo'lgani sababli tayyorgarlik choralari ko'rilishi zarur.",
    required: false
  },
  {
    id: "cq_contrast_thyroid",
    category: "CONTRAST",
    order: 15,
    text: "Qalqonsimon bez giperfunksiyasi (tireotoksikoz yoki zaharli buqoq) mavjudmi?",
    riskLevel: "warning",
    dangerAnswer: "yes",
    description: "Yod saqlovchi kontrast modda tireotoksik kriz keltirib chiqarishi mumkin.",
    required: false
  },
  {
    id: "cq_contrast_breastfeed",
    category: "CONTRAST",
    order: 16,
    text: "Emizikli davrdamisiz?",
    riskLevel: "info",
    dangerAnswer: "yes",
    description: "Kontrast yuborilgach, 24 soat davomida ko'krak suti bilan emizmaslik tavsiya qilinadi.",
    required: false
  }
];

class LocalDatabase {
  constructor() {
    this.queueFile = path.join(DATA_DIR, 'mrt_queue.json');
    this.devicesFile = path.join(DATA_DIR, 'devices.json');
    this.logsFile = path.join(DATA_DIR, 'audit_logs.json');
    this.settingsFile = path.join(DATA_DIR, 'settings.json');
    this.consentFile = path.join(DATA_DIR, 'consent_questions.json');

    this.queue = [];
    this.devices = [...DEFAULT_DEVICES];
    this.logs = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.consentQuestions = [];

    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

    this.queue = this.readJSON(this.queueFile, []);
    this.devices = this.readJSON(this.devicesFile, DEFAULT_DEVICES);
    this.logs = this.readJSON(this.logsFile, []);
    this.settings = this.readJSON(this.settingsFile, DEFAULT_SETTINGS);
    this.consentQuestions = this.readJSON(this.consentFile, DEFAULT_CONSENT_QUESTIONS);
    if (!fs.existsSync(this.consentFile)) {
      this.saveConsentQuestions();
    }

    // Kundalik avtomatik zaxira (har 24 soatda bir marta)
    this.checkDailyBackup();
  }

  readJSON(filePath, fallback) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error(`[DB Error] ${filePath} o'qishda xatolik:`, err.message);
    }
    this.atomicWrite(filePath, fallback);
    return fallback;
  }

  atomicWrite(filePath, data) {
    try {
      const tempPath = `${filePath}.tmp_${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, filePath);
    } catch (err) {
      console.error(`[DB AtomicWrite Error] ${filePath}:`, err.message);
    }
  }

  // --- QUEUE METODLARI ---
  getQueue(filterDate = null) {
    const todayStr = filterDate || new Date().toISOString().split('T')[0];
    return this.queue.filter(p => !p.date || p.date === todayStr);
  }

  getAllQueue() {
    return this.queue;
  }

  getPatientById(id) {
    return this.queue.find(p => p.id === id);
  }

  addPatient(patientData) {
    const todayStr = patientData.scheduledDate || new Date().toISOString().split('T')[0];
    const todayList = this.getQueue(todayStr);

    // Navbat raqami generatsiyasi (M-001, M-002, ...)
    const nextSeq = todayList.length + 1;
    const prefix = patientData.deviceType === 'MSKT' ? 'K' : 'M';
    const ticketNumber = `${prefix}-${String(nextSeq).padStart(3, '0')}`;

    const newPatient = {
      id: patientData.id || `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      ticketNumber: patientData.ticketNumber || ticketNumber,
      patientName: (patientData.patientName || patientData.fullName || 'BEMOR').toUpperCase(),
      patientId: String(patientData.patientId || patientData.cardNo || '').trim(),
      pinfl: String(patientData.pinfl || '').trim(),
      phone: patientData.phone || '',
      birthDate: patientData.birthDate || '',
      date: todayStr,
      scheduledDate: todayStr,
      scheduledTime: patientData.startTime || patientData.scheduledTime || null,
      finishTime: patientData.finishTime || null,
      services: Array.isArray(patientData.services) ? patientData.services : [],
      primaryService: patientData.primaryService || (patientData.services?.[0]?.name || 'MRT Tekshiruvi'),
      isContrast: Boolean(patientData.isContrast),
      totalPrice: patientData.totalPrice || 0,
      deviceId: patientData.deviceId || 'mrt1',
      deviceType: patientData.deviceType || 'MRT',
      status: 'waiting', // waiting -> preparing -> calling -> in_progress -> completed -> cancelled
      estimatedDurationMinutes: patientData.estimatedDurationMinutes || patientData.durationMinutes || 30,
      estimatedStartTime: patientData.estimatedStartTime || null,
      estimatedFinishTime: patientData.estimatedFinishTime || null,
      prepCallTime: patientData.prepCallTime || null,
      preparation: patientData.preparation || (patientData.services?.[0]?.preparation || ''),
      contraindications: patientData.contraindications || (patientData.services?.[0]?.contraindications || ''),
      referringDoctor: patientData.referringDoctor || '',
      performingDoctor: patientData.performingDoctor || '',
      operatorName: patientData.operatorName || 'Operator',
      comment: patientData.comment || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.queue.push(newPatient);
    this.saveQueue();
    return newPatient;
  }

  updatePatientStatus(id, newStatus, extraData = {}) {
    const patient = this.queue.find(p => p.id === id);
    if (!patient) return null;

    patient.status = newStatus;
    patient.updatedAt = new Date().toISOString();

    if (newStatus === 'calling') {
      patient.calledAt = new Date().toISOString();
    } else if (newStatus === 'in_progress') {
      patient.startedAt = new Date().toISOString();
      // Qurilmani band qilish
      const dev = this.devices.find(d => d.id === patient.deviceId);
      if (dev) dev.currentPatientId = patient.id;
    } else if (newStatus === 'completed' || newStatus === 'cancelled') {
      patient.finishedAt = new Date().toISOString();
      // Qurilmani bo'shatish
      const dev = this.devices.find(d => d.id === patient.deviceId);
      if (dev && dev.currentPatientId === patient.id) {
        dev.currentPatientId = null;
      }
    }

    Object.assign(patient, extraData);
    this.saveQueue();
    this.saveDevices();
    return patient;
  }

  saveQueue() {
    this.atomicWrite(this.queueFile, this.queue);
  }

  deletePatient(id) {
    const idx = this.queue.findIndex(p => p.id === id);
    if (idx !== -1) {
      const deleted = this.queue.splice(idx, 1)[0];
      if (deleted.deviceId) {
        const dev = this.devices.find(d => d.id === deleted.deviceId);
        if (dev && dev.currentPatientId === id) {
          dev.currentPatientId = null;
          this.saveDevices();
        }
      }
      this.saveQueue();
      return deleted;
    }
    return null;
  }

  // --- DEVICES METODLARI ---
  getDevices() {
    return this.devices;
  }

  getDeviceById(id) {
    return this.devices.find(d => d.id === id);
  }

  addDevice(data) {
    let id = (data.id || "").toLowerCase().trim().replace(/[^a-z0-9_]/g, '');
    if (!id) {
      const prefix = data.type === 'MSKT' ? 'mskt' : 'mrt';
      let count = this.devices.filter(d => d.type === data.type).length + 1;
      id = `${prefix}${count}`;
      while (this.devices.some(d => d.id === id)) {
        count++;
        id = `${prefix}${count}`;
      }
    }

    const newDev = {
      id: id,
      name: (data.name || "").trim() || (data.type === 'MSKT' ? 'MSKT Apparat' : 'MRT Apparat'),
      room: (data.room || "").trim() || 'MRT Xonasi',
      type: data.type === 'MSKT' ? 'MSKT' : 'MRT',
      specialty: data.specialty || (data.type === 'MSKT' ? 'Tomografiya (MSKT)' : 'Tomografiya (MRT)'),
      hasInjector: Boolean(data.hasInjector),
      supportsContrast: Boolean(data.supportsContrast),
      status: data.status || 'active',
      currentPatientId: null
    };

    this.devices.push(newDev);
    this.saveDevices();
    return newDev;
  }

  updateDevice(id, data) {
    const dev = this.devices.find(d => d.id === id);
    if (dev) {
      if (data.name !== undefined) dev.name = String(data.name).trim();
      if (data.room !== undefined) dev.room = String(data.room).trim();
      if (data.type !== undefined) dev.type = data.type;
      if (data.specialty !== undefined) dev.specialty = data.specialty;
      if (data.hasInjector !== undefined) dev.hasInjector = Boolean(data.hasInjector);
      if (data.supportsContrast !== undefined) dev.supportsContrast = Boolean(data.supportsContrast);
      if (data.status !== undefined) dev.status = data.status;
      this.saveDevices();
    }
    return dev;
  }

  deleteDevice(id) {
    const idx = this.devices.findIndex(d => d.id === id);
    if (idx !== -1) {
      const removed = this.devices.splice(idx, 1)[0];
      this.saveDevices();
      return removed;
    }
    return null;
  }

  saveDevices() {
    this.atomicWrite(this.devicesFile, this.devices);
  }

  // --- AUDIT LOGS (SERVER TRAFIK VA HARAKATLAR) ---
  addLog(entry) {
    const logItem = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString('ru-RU'),
      ip: entry.ip || '127.0.0.1',
      method: entry.method || 'GET',
      path: entry.path || '/',
      status: entry.status || 200,
      durationMs: entry.durationMs || 0,
      action: entry.action || 'REQUEST',
      details: entry.details || '',
      userAgent: entry.userAgent || ''
    };

    this.logs.unshift(logItem);
    // Oxirgi 1000 ta logni saqlash
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(0, 1000);
    }
    this.atomicWrite(this.logsFile, this.logs);
    return logItem;
  }

  getLogs(limit = 100) {
    return this.logs.slice(0, limit);
  }

  clearLogs() {
    this.logs = [];
    this.atomicWrite(this.logsFile, this.logs);
  }

  // --- SOZLAMALAR ---
  getSettings() {
    return this.settings;
  }

  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.atomicWrite(this.settingsFile, this.settings);
    return this.settings;
  }

  // --- ROZILIK SAVOLLARI (CONSENT QUESTIONNAIRE) METODLARI ---
  getConsentQuestions(category) {
    let list = this.consentQuestions || [];
    if (category && category !== "ALL") {
      list = list.filter(q => q.category === category || q.category === "ALL");
    }

    // Takroriylikni mutlaqo yo'qotish (id va normallashtirilgan matn bo'yicha)
    const seenIds = new Set();
    const seenTexts = new Set();
    const deduped = [];

    for (const q of list) {
      if (!q || !q.text) continue;
      const norm = q.text.toLowerCase().replace(/[\s\?\,\.\!ʻʼ'`]+/g, ' ').trim();
      if (seenIds.has(q.id) || seenTexts.has(norm)) continue;
      seenIds.add(q.id);
      seenTexts.add(norm);
      deduped.push(q);
    }

    return deduped;
  }

  saveConsentQuestions() {
    this.atomicWrite(this.consentFile, this.consentQuestions);
  }

  saveConsentQuestion(data) {
    if (!data.text) throw new Error("Savol matni kiritilishi shart");
    const cleanText = String(data.text).trim();
    const normKey = cleanText.toLowerCase().replace(/[\s\?\,\.\!ʻʼ'`]+/g, ' ').trim();

    // Takroriy savol qo'shilishini oldini olish: ID yoki aynan bir xil matn bo'yicha qidirish
    let item = null;
    if (data.id) {
      item = this.consentQuestions.find(q => q.id === data.id);
    }
    if (!item) {
      item = this.consentQuestions.find(q => q.text && q.text.toLowerCase().replace(/[\s\?\,\.\!ʻʼ'`]+/g, ' ').trim() === normKey);
    }

    if (item) {
      item.text = cleanText;
      if (data.category) item.category = data.category;
      if (data.riskLevel) item.riskLevel = data.riskLevel;
      if (data.dangerAnswer) item.dangerAnswer = data.dangerAnswer;
      if (data.description !== undefined) item.description = String(data.description).trim();
      if (data.required !== undefined) item.required = Boolean(data.required);
    } else {
      item = {
        id: data.id || ('cq_' + Date.now()),
        category: data.category || 'MRT',
        order: this.consentQuestions.length + 1,
        text: cleanText,
        riskLevel: data.riskLevel || 'warning',
        dangerAnswer: data.dangerAnswer || 'yes',
        description: data.description ? String(data.description).trim() : '',
        required: Boolean(data.required)
      };
      this.consentQuestions.push(item);
    }
    this.saveConsentQuestions();
    return item;
  }

  deleteConsentQuestion(id) {
    const idx = this.consentQuestions.findIndex(q => q.id === id);
    if (idx !== -1) {
      const removed = this.consentQuestions.splice(idx, 1)[0];
      this.saveConsentQuestions();
      return removed;
    }
    return null;
  }

  savePatientConsent(patientId, consentData) {
    const p = this.queue.find(x => x.id === patientId);
    if (!p) return null;
    p.consent = {
      isSafe: Boolean(consentData.isSafe),
      answers: consentData.answers || {},
      notes: consentData.notes || '',
      filledBy: consentData.filledBy || 'Laborant',
      filledAt: new Date().toISOString()
    };
    this.saveQueue();
    return p;
  }

  // --- ZAXIRA (BACKUP) ---
  checkDailyBackup() {
    const today = new Date().toISOString().split('T')[0];
    const backupName = `backup_${today}.json`;
    const targetPath = path.join(BACKUPS_DIR, backupName);

    if (!fs.existsSync(targetPath)) {
      const dump = {
        date: today,
        timestamp: new Date().toISOString(),
        queue: this.queue,
        devices: this.devices,
        settings: this.settings
      };
      this.atomicWrite(targetPath, dump);
    }
  }

  createManualBackup() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const targetPath = path.join(BACKUPS_DIR, `manual_backup_${ts}.json`);
    const dump = {
      timestamp: new Date().toISOString(),
      queue: this.queue,
      devices: this.devices,
      settings: this.settings
    };
    this.atomicWrite(targetPath, dump);
    return targetPath;
  }
}

// Yagona nusxa (Singleton)
const dbInstance = new LocalDatabase();
module.exports = dbInstance;
