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
  clinicName: "Radiologiya va MRT Markazi",
  autoSchedule: true,
  prepTimeMinutes: 15,
  voiceLanguage: "uz", // "uz", "ru"
  enableSoundNotification: true,
  allowedSubnets: ["127.0.0.1", "192.168.", "10."],
  mrt1ContrastOnly: true
};

class LocalDatabase {
  constructor() {
    this.queueFile = path.join(DATA_DIR, 'mrt_queue.json');
    this.devicesFile = path.join(DATA_DIR, 'devices.json');
    this.logsFile = path.join(DATA_DIR, 'audit_logs.json');
    this.settingsFile = path.join(DATA_DIR, 'settings.json');

    this.queue = [];
    this.devices = [...DEFAULT_DEVICES];
    this.logs = [];
    this.settings = { ...DEFAULT_SETTINGS };

    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

    this.queue = this.readJSON(this.queueFile, []);
    this.devices = this.readJSON(this.devicesFile, DEFAULT_DEVICES);
    this.logs = this.readJSON(this.logsFile, []);
    this.settings = this.readJSON(this.settingsFile, DEFAULT_SETTINGS);

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
    const todayStr = new Date().toISOString().split('T')[0];
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
      services: Array.isArray(patientData.services) ? patientData.services : [],
      primaryService: patientData.primaryService || (patientData.services?.[0]?.name || 'MRT Tekshiruvi'),
      isContrast: Boolean(patientData.isContrast),
      totalPrice: patientData.totalPrice || 0,
      deviceId: patientData.deviceId || 'mrt1',
      deviceType: patientData.deviceType || 'MRT',
      status: 'waiting', // waiting -> preparing -> calling -> in_progress -> completed -> cancelled
      estimatedDurationMinutes: patientData.estimatedDurationMinutes || 30,
      estimatedStartTime: patientData.estimatedStartTime || null,
      estimatedFinishTime: patientData.estimatedFinishTime || null,
      prepCallTime: patientData.prepCallTime || null,
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

  // --- DEVICES METODLARI ---
  getDevices() {
    return this.devices;
  }

  getDeviceById(id) {
    return this.devices.find(d => d.id === id);
  }

  updateDevice(id, data) {
    const dev = this.devices.find(d => d.id === id);
    if (dev) {
      Object.assign(dev, data);
      this.saveDevices();
    }
    return dev;
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
