/**
 * Tibbiyot / MRT & MSKT Aqlli Navbat Taqsimlash Dvigateli (lib/smart-scheduler.js)
 * Kontrast, tekshiruv davomiyligi, apparat yuklamasi va tayyorgarlik vaqtini avtomat hisoblaydi.
 */

// Rasmiy MRT va MSKT Xizmatlar Katalogi
const SERVICES_CATALOG = {
  // MSKT Xizmatlari (R134 - R155)
  "R134": { code: "R134", name: "Bosh Miya MSKT (Kontrast Moddasiz)", type: "MSKT", isContrast: false, duration: 20 },
  "R135": { code: "R135", name: "Bosh Miya MSKT (Vena ichi Kontrast Bilan)", type: "MSKT", isContrast: true, duration: 30 },
  "R136": { code: "R136", name: "Gipofiz bezining kontrast moddasiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 20 },
  "R137": { code: "R137", name: "Gipofiz bezining vena ichi kontrast bilan MSKT", type: "MSKT", isContrast: true, duration: 30 },
  "R138": { code: "R138", name: "Bosh-Bo'yin Kontrastsiz MSKT Tekshiruvi", type: "MSKT", isContrast: false, duration: 25 },
  "R139": { code: "R139", name: "Bosh-Bo'yin Vena Ichi Kontrast Bilan MSKT", type: "MSKT", isContrast: true, duration: 35 },
  "R140": { code: "R140", name: "Ko'krak qafasi organlarini kontrastsiz MSKT", type: "MSKT", isContrast: false, duration: 20 },
  "R141": { code: "R141", name: "Ko'krak qafasi organlarini kontrast modda bilan MSKT (PER OS)", type: "MSKT", isContrast: true, duration: 30 },
  "R142": { code: "R142", name: "Ko'krak qafasi organlarini vena ichi Kontrast Bilan MSKT", type: "MSKT", isContrast: true, duration: 35 },
  "R143": { code: "R143", name: "Qorin bo'shlig'i va retroperitoneal soha kontrastsiz MSKT", type: "MSKT", isContrast: false, duration: 25 },
  "R144": { code: "R144", name: "Qorin bo'shlig'i va retroperitoneal soha kontrast bilan MSKT (Per Os)", type: "MSKT", isContrast: true, duration: 35 },
  "R145": { code: "R145", name: "Qorin bo'shlig'i va retroperitoneal soha vena ichi kontrast bilan MSKT", type: "MSKT", isContrast: true, duration: 40 },
  "R146": { code: "R146", name: "Kichik tos a'zolarini kontrastsiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 20 },
  "R147": { code: "R147", name: "Kichik tos a'zolarini kontrast bilan MSKT (Per Os)", type: "MSKT", isContrast: true, duration: 30 },
  "R148": { code: "R148", name: "Kichik tos a'zolarini vena ichi kontrast bilan MSKT", type: "MSKT", isContrast: true, duration: 35 },
  "R149": { code: "R149", name: "Buyrak usti bezini kontrastsiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 20 },
  "R150": { code: "R150", name: "Buyrak usti bezini vena ichi kontrast bilan MSKT", type: "MSKT", isContrast: true, duration: 30 },
  "R151": { code: "R151", name: "Umurtqa pog'onasi (1-bo'limi) kontrastsiz MSKT", type: "MSKT", isContrast: false, duration: 20 },
  "R152": { code: "R152", name: "Umurtqa pog'onasi (1-bo'limi) vena ichi kontrast bilan MSKT", type: "MSKT", isContrast: true, duration: 30 },
  "R153": { code: "R153", name: "Bo'g'imlar MSKT tekshiruvi (1 soha)", type: "MSKT", isContrast: false, duration: 20 },
  "R154": { code: "R154", name: "Qo'l va oyoqlarning kontrastsiz MSKT tekshiruvi", type: "MSKT", isContrast: false, duration: 20 },
  "R155": { code: "R155", name: "Qo'l va oyoqlarning vena ichi kontrast bilan MSKT", type: "MSKT", isContrast: true, duration: 30 },

  // MRT Xizmatlari (R157 - R195)
  "R157": { code: "R157", name: "Bosh Miya MRT Kontrastsiz", type: "MRT", isContrast: false, duration: 25 },
  "R158": { code: "R158", name: "Bosh Miya MRT Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 40 },
  "R159": { code: "R159", name: "Bosh Miya MRT Kontrast Bilan", type: "MRT", isContrast: true, duration: 35 },
  "R160": { code: "R160", name: "Bosh Miya MRT + Traktografiya Kontrastsiz", type: "MRT", isContrast: false, duration: 35 },
  "R161": { code: "R161", name: "Gipofiz MRT + Kontrast", type: "MRT", isContrast: true, duration: 35 },
  "R162": { code: "R162", name: "Bosh Miya Angiografiya MRT (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 35 },
  "R163": { code: "R163", name: "Bosh Miya Angiografiya MRT (MPA/MPB)", type: "MRT", isContrast: false, duration: 25 },
  "R164": { code: "R164", name: "Ko'z va orbita MRT", type: "MRT", isContrast: false, duration: 25 },
  "R165": { code: "R165", name: "Yevstaxiy nayi va Ichki quloq MRT", type: "MRT", isContrast: false, duration: 25 },
  "R166": { code: "R166", name: "Bo'yin Umurtqalari MRT", type: "MRT", isContrast: false, duration: 25 },
  "R167": { code: "R167", name: "Ko'krak Umurtqalari MRT", type: "MRT", isContrast: false, duration: 25 },
  "R168": { code: "R168", name: "Bel Umurtqalari MRT", type: "MRT", isContrast: false, duration: 25 },
  "R169": { code: "R169", name: "Butun Umurtqa Pog'onasi MRT (3 soha)", type: "MRT", isContrast: false, duration: 50 },
  "R170": { code: "R170", name: "Spinal Kanal va Orqa Miya MRT", type: "MRT", isContrast: false, duration: 30 },
  "R171": { code: "R171", name: "Bo'yin Qon Tomirlari Angiografiya MRT (Injektorda)", type: "MRT", isContrast: true, duration: 35 },
  "R172": { code: "R172", name: "Bo'yin Qon Tomirlari Angiografiya MRT", type: "MRT", isContrast: true, duration: 30 },
  "R173": { code: "R173", name: "Yurak MRT Kontrastsiz", type: "MRT", isContrast: false, duration: 40 },
  "R174": { code: "R174", name: "Yurak Qon Tomirlari Angiografiya MRT (Injektorda)", type: "MRT", isContrast: true, duration: 45 },
  "R175": { code: "R175", name: "Yurak Qon Tomirlari Angiografiya MRT", type: "MRT", isContrast: true, duration: 40 },
  "R177": { code: "R177", name: "Jigar MRT Kontrastsiz", type: "MRT", isContrast: false, duration: 30 },
  "R178": { code: "R178", name: "Jigar MRT Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 45 },
  "R179": { code: "R179", name: "Jigar MRT Kontrast Bilan", type: "MRT", isContrast: true, duration: 40 },
  "R180": { code: "R180", name: "O't Yo'llari MR-Xolangiografiya", type: "MRT", isContrast: false, duration: 25 },
  "R181": { code: "R181", name: "Oshqozon Osti Bezi MRT", type: "MRT", isContrast: false, duration: 30 },
  "R182": { code: "R182", name: "Buyrak va Buyrak Usti Bezlar MRT", type: "MRT", isContrast: false, duration: 30 },
  "R183": { code: "R183", name: "Kichik Tos A'zolari MRT (Erkaklar - Prostata)", type: "MRT", isContrast: false, duration: 35 },
  "R184": { code: "R184", name: "Kichik Tos A'zolari MRT (Ayollar - Bachadon)", type: "MRT", isContrast: false, duration: 35 },
  "R185": { code: "R185", name: "Kichik Tos A'zolari MRT Kontrast Bilan (Injektorda)", type: "MRT", isContrast: true, duration: 45 },
  "R186": { code: "R186", name: "Tizza Bo'g'imi MRT", type: "MRT", isContrast: false, duration: 25 },
  "R187": { code: "R187", name: "Chanoq-Son Bo'g'imi MRT", type: "MRT", isContrast: false, duration: 25 },
  "R188": { code: "R188", name: "Yelka Bo'g'imi MRT", type: "MRT", isContrast: false, duration: 25 },
  "R189": { code: "R189", name: "Oshiq-Boldir Bo'g'imi MRT", type: "MRT", isContrast: false, duration: 25 },
  "R190": { code: "R190", name: "Tirsak Bo'g'imi MRT", type: "MRT", isContrast: false, duration: 25 },
  "R191": { code: "R191", name: "Kaft Bo'g'imi MRT", type: "MRT", isContrast: false, duration: 25 },
  "R192": { code: "R192", name: "Sut Bezlar MRT Kontrast Bilan (Shprits-Injektorda)", type: "MRT", isContrast: true, duration: 45 }
};

class SmartScheduler {
  constructor(db) {
    this.db = db;
  }

  /**
   * Bemor uchun umumiy vaqt va kontrast holatini hisoblash
   */
  analyzeServices(servicesList) {
    if (!Array.isArray(servicesList) || servicesList.length === 0) {
      return {
        deviceType: "MRT",
        isContrast: false,
        durationMinutes: 30,
        primaryName: "MRT Tekshiruvi"
      };
    }

    let isContrast = false;
    let totalDuration = 0;
    let deviceType = "MRT";
    const primaryName = servicesList[0]?.name || servicesList[0]?.serviceName || "MRT Tekshiruvi";

    servicesList.forEach((srv, idx) => {
      const code = (srv.code || srv.serviceCode || "").toUpperCase().trim();
      const catItem = SERVICES_CATALOG[code];

      if (catItem) {
        if (catItem.isContrast) isContrast = true;
        if (catItem.type === "MSKT") deviceType = "MSKT";
        // Agar bir nechta soha bo'lsa, ikkinchi sohadan boshlab yotqizish vaqti kamroq hisoblanadi
        totalDuration += idx === 0 ? catItem.duration : Math.round(catItem.duration * 0.75);
      } else {
        // Nomi bo'yicha kontrastni aniqlash
        const name = (srv.name || "").toLowerCase();
        if (name.includes("kontrast") || name.includes("shprits") || name.includes("injektor")) {
          isContrast = true;
        }
        if (name.includes("mskt")) {
          deviceType = "MSKT";
        }
        totalDuration += 30;
      }
    });

    if (totalDuration < 20) totalDuration = 20;

    return {
      deviceType,
      isContrast,
      durationMinutes: totalDuration,
      primaryName
    };
  }

  /**
   * Bemor uchun eng optimal apparatni tanlash va vaqtini belgilash
   */
  allocateOptimalSlot(patientInput) {
    const analysis = this.analyzeServices(patientInput.services || []);
    const settings = this.db.getSettings();
    const activeDevices = this.db.getDevices().filter(d => d.status === "active");

    const todayStr = new Date().toISOString().split("T")[0];
    const currentQueue = this.db.getQueue(todayStr);

    let chosenDeviceId = patientInput.deviceId || null;
    const isContrast = patientInput.isContrast !== undefined ? Boolean(patientInput.isContrast) : analysis.isContrast;
    const duration = patientInput.estimatedDurationMinutes || analysis.durationMinutes;
    const deviceType = patientInput.deviceType || analysis.deviceType;

    // 1. Agar foydalanuvchi/vrach qo'lda apparat tanlamagan bo'lsa:
    if (!chosenDeviceId) {
      if (deviceType === "MSKT") {
        const msktDev = activeDevices.find(d => d.type === "MSKT");
        chosenDeviceId = msktDev ? msktDev.id : "mskt1";
      } else {
        // MRT Apparatini tanlash:
        // Kontrastli bo'lsa va MRT 1 injektorli bo'lsa -> mrt1
        if (isContrast && settings.mrt1ContrastOnly) {
          chosenDeviceId = "mrt1";
        } else {
          // MRT 1 va MRT 2 o'rtasida yuklamani hisoblash (Load Balancing)
          const mrtDevices = activeDevices.filter(d => d.type === "MRT");
          if (mrtDevices.length === 1) {
            chosenDeviceId = mrtDevices[0].id;
          } else {
            // Har bir apparatda kutilayotgan umumiy daqiqalarni hisoblash
            let minWaitMinutes = Infinity;
            let bestDevId = "mrt1";

            mrtDevices.forEach(dev => {
              const devWaiting = currentQueue.filter(p => 
                p.deviceId === dev.id && 
                (p.status === "waiting" || p.status === "preparing" || p.status === "in_progress" || p.status === "calling")
              );
              const totalMins = devWaiting.reduce((sum, p) => sum + (p.estimatedDurationMinutes || 30), 0);

              if (totalMins < minWaitMinutes) {
                minWaitMinutes = totalMins;
                bestDevId = dev.id;
              }
            });

            chosenDeviceId = bestDevId;
          }
        }
      }
    }

    // 2. Vaqtlarini hisoblash (Start time, Finish time, Prep time)
    const now = new Date();
    const devQueue = currentQueue.filter(p => 
      p.deviceId === chosenDeviceId && 
      (p.status === "waiting" || p.status === "preparing" || p.status === "in_progress" || p.status === "calling")
    );

    let projectedStart = new Date(now);
    if (devQueue.length > 0) {
      const lastPatient = devQueue[devQueue.length - 1];
      if (lastPatient.estimatedFinishTime) {
        const lastFinish = new Date(lastPatient.estimatedFinishTime);
        if (lastFinish > projectedStart) {
          projectedStart = lastFinish;
        }
      } else {
        // Agar vaqti belgilanmagan bo'lsa
        const totalPendingMins = devQueue.reduce((acc, p) => acc + (p.estimatedDurationMinutes || 30), 0);
        projectedStart = new Date(now.getTime() + totalPendingMins * 60000);
      }
    }

    const projectedFinish = new Date(projectedStart.getTime() + duration * 60000);
    const prepMinutes = settings.prepTimeMinutes || 15;
    const projectedPrep = new Date(projectedStart.getTime() - prepMinutes * 60000);

    return {
      deviceId: chosenDeviceId,
      deviceType: deviceType,
      isContrast: isContrast,
      estimatedDurationMinutes: duration,
      primaryService: analysis.primaryName,
      estimatedStartTime: projectedStart.toISOString(),
      estimatedFinishTime: projectedFinish.toISOString(),
      prepCallTime: projectedPrep.toISOString(),
      estimatedStartTimeFormatted: this.formatTime(projectedStart),
      estimatedFinishTimeFormatted: this.formatTime(projectedFinish),
      prepCallTimeFormatted: this.formatTime(projectedPrep)
    };
  }

  formatTime(dateObj) {
    if (!dateObj) return "";
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = String(dateObj.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  getServicesCatalog() {
    return SERVICES_CATALOG;
  }
}

module.exports = SmartScheduler;
