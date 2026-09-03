/**
 * Tibbiyot / MRT & MSKT Aqlli Navbat Taqsimlash Dvigateli (lib/smart-scheduler.js)
 * Ish kunlari taqvimi, navbatchi laborantlar va ularning shaxsiy vaqtlari,
 * ko'p laborant bo'lganda maksimal vaqtni tanlash hamda admin standart vaqtlarini boshqaradi.
 */

const fs = require('fs');
const path = require('path');

const SERVICES_FILE = path.join(__dirname, '..', 'data', 'services.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');

const DAY_NAMES = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
const DAY_FULL_NAMES_UZ = [
  "Yakshanba",
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba"
];

class SmartScheduler {
  constructor(db) {
    this.db = db;
    this.services = this.loadServices();
  }

  /**
   * Xizmatlar katalogini yuklash (data/services.json dan)
   */
  loadServices() {
    try {
      if (fs.existsSync(SERVICES_FILE)) {
        const raw = fs.readFileSync(SERVICES_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error("[SmartScheduler] services.json o'qishda xatolik:", e.message);
    }
    return [];
  }

  /**
   * Xizmatlar katalogini saqlash
   */
  saveServicesList(list) {
    try {
      fs.writeFileSync(SERVICES_FILE, JSON.stringify(list, null, 2), 'utf-8');
      this.services = list;
      return true;
    } catch (e) {
      console.error("[SmartScheduler] services.json saqlashda xatolik:", e.message);
      return false;
    }
  }

  getServicesCatalog() {
    this.services = this.loadServices();
    return this.services;
  }

  /**
   * Super Admin / Server Nazoratchisi uchun yangi xizmat qo'shish yoki tahrirlash
   */
  upsertService(serviceData, requesterUser) {
    this.services = this.loadServices();
    const code = (serviceData.code || "").toUpperCase().trim();
    if (!code) throw new Error("Tekshiruv kodi kiritilishi shart (masalan, R196)");
    if (!serviceData.name) throw new Error("Tekshiruv nomi kiritilishi shart");

    const existingIndex = this.services.findIndex(s => s.code === code);
    const item = {
      code: code,
      name: serviceData.name.trim(),
      type: serviceData.type === "MSKT" ? "MSKT" : "MRT",
      isContrast: Boolean(serviceData.isContrast),
      duration: parseInt(serviceData.duration || 30, 10),
      updatedAt: new Date().toISOString(),
      updatedBy: requesterUser ? (requesterUser.name || requesterUser.login) : "admin"
    };

    if (existingIndex >= 0) {
      this.services[existingIndex] = { ...this.services[existingIndex], ...item };
    } else {
      this.services.push(item);
    }

    this.saveServicesList(this.services);
    return item;
  }

  /**
   * Super Admin uchun xizmatni o'chirish
   */
  deleteService(serviceCode, requesterUser) {
    this.services = this.loadServices();
    const code = (serviceCode || "").toUpperCase().trim();
    const beforeCount = this.services.length;
    this.services = this.services.filter(s => s.code !== code);

    if (this.services.length === beforeCount) {
      throw new Error(`Xizmat topilmadi: ${serviceCode}`);
    }

    this.saveServicesList(this.services);
    return true;
  }

  /**
   * Xodimlarni (users.json) yuklash
   */
  getStaffUsers() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      }
    } catch (e) {}
    return [];
  }

  /**
   * Muayyan sana va vaqtda qaysi laborantlar ishda (smenada) ekanligini aniqlash
   */
  getLaborantsOnShift(targetDate, timeStr, deviceId = null) {
    const allUsers = this.getStaffUsers();
    const dayIndex = targetDate.getDay();
    const shortDayName = DAY_NAMES[dayIndex]; // "Dush", "Sesh", ...

    // Faqat laborant yoki laborant vazifasini bajaruvchi super_admin / server_nazoratchisi
    const laborants = allUsers.filter(u => {
      if (u.status && u.status !== 'active') return false;
      const role = u.role || '';
      return role === 'laborant' || role === 'super_admin' || role === 'server_nazoratchisi';
    });

    const onShift = [];

    for (const lab of laborants) {
      const ws = lab.workSchedule;
      if (!ws) continue;

      // 1. Ish kuni to'g'ri keladimi?
      const days = ws.days || ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
      if (!days.includes(shortDayName)) continue;

      // 2. Ish soati oralig'idami?
      const start = ws.start || "08:00";
      const end = ws.end || "17:00";
      if (timeStr < start || timeStr >= end) continue;

      // 3. Tushlik vaqti emasmi?
      const lStart = ws.lunchStart || "12:00";
      const lEnd = ws.lunchEnd || "13:00";
      if (timeStr >= lStart && timeStr < lEnd) continue;

      // 4. Apparat (xona) mosligi: agar xodim faqat bitta apparatga biriktirilgan bo'lsa
      if (deviceId && lab.room) {
        const roomLower = lab.room.toLowerCase();
        if (deviceId.includes('mrt1') && (roomLower.includes('mrt 2') || roomLower.includes('mskt'))) {
          continue;
        }
        if (deviceId.includes('mrt2') && (roomLower.includes('mrt 1') || roomLower.includes('mskt'))) {
          continue;
        }
        if (deviceId.includes('mskt') && (roomLower.includes('mrt'))) {
          continue;
        }
      }

      onShift.push(lab);
    }

    return onShift;
  }

  /**
   * Bemor uchun umumiy vaqt va kontrast holatini hisoblash (Katalog asosida)
   */
  analyzeServices(servicesList) {
    this.services = this.loadServices();

    if (!Array.isArray(servicesList) || servicesList.length === 0) {
      return {
        deviceType: "MRT",
        isContrast: false,
        durationMinutes: 30,
        primaryName: "MRT Tekshiruvi",
        serviceCode: "R157"
      };
    }

    let isContrast = false;
    let totalStandardDuration = 0;
    let deviceType = "MRT";
    let primaryCode = "";
    const primaryName = servicesList[0]?.name || servicesList[0]?.serviceName || "MRT Tekshiruvi";

    servicesList.forEach((srv, idx) => {
      const code = (srv.code || srv.serviceCode || "").toUpperCase().trim();
      if (!primaryCode && code) primaryCode = code;

      const catItem = this.services.find(s => s.code === code);

      if (catItem) {
        if (catItem.isContrast) isContrast = true;
        if (catItem.type === "MSKT") deviceType = "MSKT";
        totalStandardDuration += idx === 0 ? catItem.duration : Math.round(catItem.duration * 0.75);
      } else {
        const name = (srv.name || "").toLowerCase();
        if (name.includes("kontrast") || name.includes("shprits") || name.includes("injektor")) {
          isContrast = true;
        }
        if (name.includes("mskt")) {
          deviceType = "MSKT";
        }
        totalStandardDuration += 30;
      }
    });

    if (totalStandardDuration < 15) totalStandardDuration = 15;

    return {
      deviceType,
      isContrast,
      durationMinutes: totalStandardDuration,
      primaryName,
      serviceCode: primaryCode || (deviceType === "MSKT" ? "R134" : "R157")
    };
  }

  /**
   * FOYDALANUVCHI TALABIDAGI 4 TA SHART ASOSIDA TEKSHIRUV VAQTINI HISOBLASH
   *
   * 1-shart: Ish vaqtida eng yaqin bo'sh soatni aniqlash
   * 2-shart: 1 ta laborant bo'lsa -> Uning shaxsiy vaqti
   * 3-shart: Laborant ko'rsatilmagan / smenada bo'lmasa -> Admin standart vaqti
   * 4-shart: 2 yoki undan ortiq laborant bo'lsa -> Eng kattasi (MAX)
   */
  calculateExamDurationForSlot(analysis, onShiftLaborants) {
    const adminStandardTime = analysis.durationMinutes;

    // 3-SHART: Agar smenada laborant bo'lmasa -> Admin standart vaqti
    if (!onShiftLaborants || onShiftLaborants.length === 0) {
      return {
        duration: adminStandardTime,
        ruleApplied: "standart_admin",
        ruleDescription: `Admin standart vaqti (${adminStandardTime} daqiqa)`,
        activeLaborantNames: []
      };
    }

    const serviceCode = analysis.serviceCode;
    const isContrast = analysis.isContrast;
    const deviceType = analysis.deviceType; // "MRT" | "MSKT"

    // Har bir smenadagi laborantning ushbu tekshiruv uchun belgilagan vaqti
    const laborantDurations = onShiftLaborants.map(lab => {
      let customTime = null;
      const prefs = lab.preferences && lab.preferences.testDurations ? lab.preferences.testDurations : {};

      // Aniq kod bo'yicha (masalan, "R157")
      if (prefs[serviceCode]) {
        customTime = parseInt(prefs[serviceCode], 10);
      }
      // Kategoriya bo'yicha
      else if (deviceType === "MRT") {
        if (isContrast && prefs["MRT_KONTRAST"]) customTime = parseInt(prefs["MRT_KONTRAST"], 10);
        else if (!isContrast && prefs["MRT_ODDIY"]) customTime = parseInt(prefs["MRT_ODDIY"], 10);
        else if (prefs["MRT"]) customTime = parseInt(prefs["MRT"], 10);
      } else if (deviceType === "MSKT") {
        if (isContrast && prefs["MSKT_KONTRAST"]) customTime = parseInt(prefs["MSKT_KONTRAST"], 10);
        else if (!isContrast && prefs["MSKT_ODDIY"]) customTime = parseInt(prefs["MSKT_ODDIY"], 10);
        else if (prefs["MSKT"]) customTime = parseInt(prefs["MSKT"], 10);
      }

      // Agar laborant belgilamagan bo'lsa, standart vaqtni olamiz
      return {
        laborantName: lab.name || lab.login,
        duration: (customTime && customTime > 5) ? customTime : adminStandardTime,
        hasCustom: Boolean(customTime)
      };
    });

    const activeNames = laborantDurations.map(l => l.laborantName);

    // 2-SHART: Aynan 1 ta laborant ishda bo'lsa
    if (laborantDurations.length === 1) {
      const single = laborantDurations[0];
      return {
        duration: single.duration,
        ruleApplied: "single_laborant",
        ruleDescription: `Laborant ${single.laborantName} (${single.duration} daqiqa)`,
        activeLaborantNames: activeNames
      };
    }

    // 4-SHART: 2 yoki undan oshiq laborant ishda bo'lsa -> ENG KATTASI (MAX)
    const maxItem = laborantDurations.reduce((max, cur) => cur.duration > max.duration ? cur : max, laborantDurations[0]);
    const maxDuration = maxItem.duration;

    const detailsStr = laborantDurations.map(l => `${l.laborantName}: ${l.duration} daq`).join(', ');

    return {
      duration: maxDuration,
      ruleApplied: "multi_laborant_max",
      ruleDescription: `${laborantDurations.length} ta laborant smenada (${detailsStr}) ➔ Maksimal: ${maxDuration} daqiqa`,
      activeLaborantNames: activeNames
    };
  }

  /**
   * 1-SHART: ENG YAQIN ISH KUNIDAGI ENG YAQIN BO'SH SOATNI ANIQLASH (SMART APPOINTMENT ALLOCATOR)
   */
  findNextAvailableSlot(patientInput) {
    const analysis = this.analyzeServices(patientInput.services || []);
    const settings = this.db.getSettings();
    const activeDevices = this.db.getDevices().filter(d => d.status === "active");

    // 1. Apparatni aniqlash
    let chosenDeviceId = patientInput.deviceId || null;
    const isContrast = patientInput.isContrast !== undefined ? Boolean(patientInput.isContrast) : analysis.isContrast;
    const deviceType = patientInput.deviceType || analysis.deviceType;

    if (!chosenDeviceId || chosenDeviceId === "auto") {
      if (deviceType === "MSKT") {
        const msktDev = activeDevices.find(d => d.type === "MSKT");
        chosenDeviceId = msktDev ? msktDev.id : "mskt1";
      } else {
        if (isContrast && settings.mrt1ContrastOnly) {
          chosenDeviceId = "mrt1";
        } else {
          // Yuklamasi eng kam apparatni tanlash
          const mrtDevices = activeDevices.filter(d => d.type === "MRT");
          if (mrtDevices.length === 1) {
            chosenDeviceId = mrtDevices[0].id;
          } else {
            chosenDeviceId = "mrt1"; // Standart tanlov
          }
        }
      }
    }

    // 2. Ish kunlari taqvimi: Dushanbadan Shanbagacha (Yakshanba - dam olish)
    const clinicWorkDays = ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
    const now = new Date();

    // Qidiruvni bugungi kundan boshlab keyingi 30 kun ichida amalga oshirish
    for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
      const candidateDate = new Date(now);
      candidateDate.setDate(now.getDate() + dayOffset);

      const dayIdx = candidateDate.getDay();
      const shortDayName = DAY_NAMES[dayIdx];

      // Ish kuni emas bo'lsa (masalan, Yakshanba) -> keyingi kunga o'tish
      if (!clinicWorkDays.includes(shortDayName)) {
        continue;
      }

      const dateStr = candidateDate.toISOString().split("T")[0]; // YYYY-MM-DD
      const isToday = (dayOffset === 0);

      // Ushbu kunda ushbu apparat uchun allaqachon navbatga qo'yilgan bemorlar
      const dayQueue = this.db.getQueue(dateStr).filter(p => 
        p.deviceId === chosenDeviceId && 
        p.status !== "cancelled" && 
        p.status !== "completed"
      );

      // Kunlik ish soatlari: 08:00 dan 17:30 gacha
      // Agar bugun bo'lsa, qidiruv joriy soatdan (kamida 5 daqiqa keyin) boshlanadi
      let startHour = 8;
      let startMinute = 0;

      if (isToday) {
        const currentTotalMinutes = now.getHours() * 60 + now.getMinutes() + 5;
        // Agar joriy vaqt 08:00 dan oldin bo'lsa, 08:00 dan boshlaymiz
        if (currentTotalMinutes > (8 * 60)) {
          // Eng yaqin 5 daqiqaga yaxlitlash
          const roundedMinutes = Math.ceil(currentTotalMinutes / 5) * 5;
          startHour = Math.floor(roundedMinutes / 60);
          startMinute = roundedMinutes % 60;
        }
      }

      const clinicClosingMinute = 17 * 60 + 30; // 17:30
      let currentCheckMinute = startHour * 60 + startMinute;

      // Ushbu kun ichidagi bo'sh soatlarni 5 daqiqalik oraliqlar bilan tekshirish
      while (currentCheckMinute < clinicClosingMinute) {
        const checkH = String(Math.floor(currentCheckMinute / 60)).padStart(2, '0');
        const checkM = String(currentCheckMinute % 60).padStart(2, '0');
        const timeStr = `${checkH}:${checkM}`;

        // Tushlik tanaffusini chetlab o'tish (12:00 dan 13:00 gacha)
        if (currentCheckMinute >= (12 * 60) && currentCheckMinute < (13 * 60)) {
          currentCheckMinute = 13 * 60;
          continue;
        }

        // 1. Ushbu vaqtda ishda bo'lgan laborantlarni aniqlash
        const onShiftLaborants = this.getLaborantsOnShift(candidateDate, timeStr, chosenDeviceId);

        // 2. Qoidalar bo'yicha davomiylikni hisoblash
        const durationResult = this.calculateExamDurationForSlot(analysis, onShiftLaborants);
        const examDuration = durationResult.duration;

        const finishMinute = currentCheckMinute + examDuration;

        // Agar tekshiruv tushlik vaqtiga kirib ketsa -> tushlikdan keyinga surish
        if (currentCheckMinute < (12 * 60) && finishMinute > (12 * 60)) {
          currentCheckMinute = 13 * 60;
          continue;
        }

        // Agar tekshiruv ish vaqti tugashidan oshib ketsa -> bu kunda joy yo'q, keyingi kunga o'tish
        if (finishMinute > clinicClosingMinute) {
          break;
        }

        // 3. Mavjud bemorlar bilan to'qnashuvni (Overlap) tekshirish
        const finishH = String(Math.floor(finishMinute / 60)).padStart(2, '0');
        const finishM = String(finishMinute % 60).padStart(2, '0');
        const finishTimeStr = `${finishH}:${finishM}`;

        let hasConflict = false;
        for (const existing of dayQueue) {
          if (!existing.estimatedStartTime || !existing.estimatedFinishTime) continue;

          const exStart = existing.estimatedStartTime.substring(11, 16);
          const exFinish = existing.estimatedFinishTime.substring(11, 16);

          // Oraliqlar to'qnashuvi: [A, B] va [C, D]
          if (timeStr < exFinish && finishTimeStr > exStart) {
            hasConflict = true;
            // To'qnashuv bo'lsa, tekshirish vaqtini mavjud bemor tugaydigan vaqtga siljitish
            const [exFH, exFM] = exFinish.split(':').map(Number);
            currentCheckMinute = exFH * 60 + exFM;
            break;
          }
        }

        if (!hasConflict) {
          // ENG BIRINCHI BO'SH SLOT TOPILDI!
          const startDateTime = new Date(candidateDate);
          startDateTime.setHours(Math.floor(currentCheckMinute / 60), currentCheckMinute % 60, 0, 0);

          const finishDateTime = new Date(startDateTime.getTime() + examDuration * 60000);
          const prepMinutes = settings.prepTimeMinutes || 15;
          const prepDateTime = new Date(startDateTime.getTime() - prepMinutes * 60000);

          let dateLabel = `${DAY_FULL_NAMES_UZ[dayIdx]}, ${candidateDate.getDate()}-kun`;
          if (isToday) dateLabel = `Bugun (${DAY_FULL_NAMES_UZ[dayIdx]})`;
          else if (dayOffset === 1) dateLabel = `Ertaga (${DAY_FULL_NAMES_UZ[dayIdx]})`;

          return {
            scheduledDate: dateStr,
            scheduledDateFormatted: dateLabel,
            startTime: timeStr,
            finishTime: finishTimeStr,
            durationMinutes: examDuration,
            deviceId: chosenDeviceId,
            deviceType: deviceType,
            isContrast: isContrast,
            primaryService: analysis.primaryName,
            serviceCode: analysis.serviceCode,
            estimatedStartTime: startDateTime.toISOString(),
            estimatedFinishTime: finishDateTime.toISOString(),
            prepCallTime: prepDateTime.toISOString(),
            ruleApplied: durationResult.ruleApplied,
            ruleDescription: durationResult.ruleDescription,
            activeLaborantNames: durationResult.activeLaborantNames
          };
        }
      }
    }

    // Hech qanday slot topilmasa (favqulodda fallback)
    const fallbackStart = new Date(now.getTime() + 10 * 60000);
    const fallbackFinish = new Date(fallbackStart.getTime() + 30 * 60000);

    return {
      scheduledDate: now.toISOString().split("T")[0],
      scheduledDateFormatted: "Bugun",
      startTime: this.formatTime(fallbackStart),
      finishTime: this.formatTime(fallbackFinish),
      durationMinutes: 30,
      deviceId: chosenDeviceId || "mrt1",
      deviceType: deviceType,
      isContrast: isContrast,
      primaryService: analysis.primaryName,
      serviceCode: analysis.serviceCode,
      estimatedStartTime: fallbackStart.toISOString(),
      estimatedFinishTime: fallbackFinish.toISOString(),
      prepCallTime: fallbackStart.toISOString(),
      ruleApplied: "fallback",
      ruleDescription: "Zaxira taqsimlash (30 daqiqa)",
      activeLaborantNames: []
    };
  }

  /**
   * allocateOptimalSlot (Mavjud API chaqiruvlari bilan 100% moslik uchun)
   */
  allocateOptimalSlot(patientInput) {
    return this.findNextAvailableSlot(patientInput);
  }

  formatTime(dateObj) {
    if (!dateObj) return "";
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = String(dateObj.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

module.exports = SmartScheduler;
