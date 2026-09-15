/**
 * lib/admin-analytics.js
 * KARMED UTT TIZIMI — ADMIN ANALITIKA VA STATISTIKA DVIGATELI (v5.2.0)
 * 
 * Imkoniyatlari:
 * 1. Tanlangan muddat bo'yicha Karmeddan to'liq ma'lumotlarni olish
 * 2. 10 ta UTT xonalari/vrachlari bo'yicha qabul qilingan bemorlar, o'tganlar, kutayotganlar va tushumlar
 * 3. Har bir UTT vrachi ko'rgan bemorlarining batafsil ro'yxati (Bemorlar modali)
 * 4. Davolovchi shifokorlar (Yo'naltiruvchi vrachlar - DosyaDoktoru) reytingi va tushumi
 * 5. IKkI TOMONLAMA VRACHLARARO TAQSIMOT (UTT ⟷ Davolovchi Shifokorlar)
 * 6. ANIQ NARXLAR TIZIMI:
 *    - Rezident (O'zbekiston fuqarosi): 159 000 UZS
 *    - No Rezident (Chet el fuqarosi): 254 400 UZS
 *    - Qolgan barchasi (Sug'urta, Orderli, Vaqf...): 155 820 UZS
 *    - Bitta bemorda bir nechta UTT tekshiruvi alohida narxlanadi
 * 7. Server kesh tizimi (data/admin_analytics_cache.json) orqali tezkor ishlash (<50ms)
 * 8. Excel (CSV UTF-8 BOM) eksport generatori
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CACHE_FILE = path.join(DATA_DIR, 'admin_analytics_cache.json');
const PRICE_CATALOG_FILE = path.join(DATA_DIR, 'price_catalog.json');
const DOCTORS_AUTH_FILE = path.join(DATA_DIR, 'doctors_auth.json');
const KARMED_PROFILES_FILE = path.join(DATA_DIR, 'karmed_profiles.json');
const PATIENT_SERVICES_CACHE_FILE = path.join(DATA_DIR, 'patient_services_cache.json');

// ExtNet JSON ni xavfsiz o'qish
function safeParseExtNetJson(str) {
  if (!str) return null;
  try { return JSON.parse(str); } catch (e) {
    try { return JSON.parse(str.replace(/\\"/g, '"')); } catch (e2) {
      try {
        const clean = str.replace(/new Date\([^)]+\)/g, '"2026-09-10"').replace(/\\"/g, '"');
        return JSON.parse(clean);
      } catch (e3) { return null; }
    }
  }
}

// Vrachlar ro'yxatini yuklash
function getDoctorsAuth() {
  try {
    if (fs.existsSync(DOCTORS_AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(DOCTORS_AUTH_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[Admin Analytics] Doctors auth load warning:', e.message);
  }
  return {};
}

// Karmed profillarini yuklash
function getKarmedProfiles() {
  try {
    if (fs.existsSync(KARMED_PROFILES_FILE)) {
      return JSON.parse(fs.readFileSync(KARMED_PROFILES_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[Admin Analytics] Karmed profiles load warning:', e.message);
  }
  return {};
}

// Narxlar katalogini yuklash
function getPriceCatalog() {
  try {
    if (fs.existsSync(PRICE_CATALOG_FILE)) {
      return JSON.parse(fs.readFileSync(PRICE_CATALOG_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[Admin Analytics] Price catalog load warning:', e.message);
  }
  return { services: [], categories: { UTT: [] } };
}

// Bemor tekshiruv organlari keshini yuklash
function getPatientServicesCache() {
  try {
    if (fs.existsSync(PATIENT_SERVICES_CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(PATIENT_SERVICES_CACHE_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[Admin Analytics] Patient services cache warning:', e.message);
  }
  return {};
}

// Bemor tekshiruv organlari keshini saqlash
function savePatientServicesCache(cache) {
  try {
    fs.writeFileSync(PATIENT_SERVICES_CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.error('[Admin Analytics] Patient services cache save error:', e.message);
  }
}

// 1. Xona nomi orqali biriktirilgan shifokorni aniqlash (Ulangan bo'lim vrachi)
function mapDoctorByRoom(roomStr, docsAuth, doctorKeys) {
  if (!roomStr) return null;
  const str = String(roomStr).trim();
  const m = str.match(/Ultratovush-+(\d+)/i);
  if (m) {
    const num = m[1];
    const targetRoomId = `Ultratovush-${num}`;
    for (const key of doctorKeys) {
      if (docsAuth[key] && docsAuth[key].roomId === targetRoomId) return docsAuth[key];
    }
  }
  const low = str.toLowerCase().replace(/['`ʻʼ]/g, '');
  for (const key of doctorKeys) {
    const d = docsAuth[key];
    if (!d) continue;
    const dDocName = (d.doctorName || '').toLowerCase().replace(/['`ʻʼ]/g, '');
    const dShortName = (d.shortName || '').toLowerCase().replace(/['`ʻʼ]/g, '');

    if (dShortName && low.includes(dShortName)) return d;
    if (dDocName && low.includes(dDocName)) return d;
    const parts = dDocName.split(' ');
    if (parts.length >= 2 && low.includes(parts[0]) && low.includes(parts[1])) return d;
    if (parts.length >= 1 && parts[0].length >= 4 && low.includes(parts[0])) return d;
  }
  return null;
}

// 2. F.I.SH orqali shifokorni aniqlash (Qabul qiluvchi vrach / Shifokor nomi)
function mapDoctorByName(nameStr, docsAuth, doctorKeys) {
  if (!nameStr) return null;
  const trimmed = String(nameStr).trim();
  if (!trimmed || trimmed === 'Kiritilmagan' || trimmed.toLowerCase().includes('kutilmoqda')) return null;

  const low = trimmed.toLowerCase().replace(/['`ʻʼ]/g, '');
  for (const key of doctorKeys) {
    const d = docsAuth[key];
    if (!d) continue;
    const dDocName = (d.doctorName || '').toLowerCase().replace(/['`ʻʼ]/g, '');
    const dShortName = (d.shortName || '').toLowerCase().replace(/['`ʻʼ]/g, '');

    if (dDocName && low.includes(dDocName)) return d;
    if (dShortName && low.includes(dShortName)) return d;
    const parts = dDocName.split(' ');
    if (parts.length >= 2 && low.includes(parts[0]) && low.includes(parts[1])) return d;
    if (parts.length >= 1 && parts[0].length >= 4 && low.includes(parts[0])) return d;
  }
  // Agar ro'yxatda aniq topilmasa (masalan qo'shimcha shifokor)
  const parts = trimmed.split(' ');
  const sName = parts[0] || trimmed;
  return {
    roomId: `Shifokor-${sName}`,
    roomNum: '—',
    roomTitle: `Dr. ${sName}`,
    doctorName: trimmed,
    shortName: sName
  };
}

// Eski moslashtiruvchi funksiya (backward compatibility)
function mapKarmedRecordToDoctor(p, docsAuth, doctorKeys) {
  const roomStr = (p.AltBolumAdi || p.OdaAdi || '').trim();
  const byRoom = mapDoctorByRoom(roomStr, docsAuth, doctorKeys);
  if (byRoom) return byRoom;

  const docName = (p.DoktorAdi || p.KabulEden || p.DosyaDoktoru || '').trim();
  const byName = mapDoctorByName(docName, docsAuth, doctorKeys);
  if (byName) return byName;

  if (p.OdaId) {
    for (const key of doctorKeys) {
      const d = docsAuth[key];
      if (!d) continue;
      if (String(d.roomNum) === String(p.OdaId) || String(d.kod) === String(p.OdaId)) return d;
    }
  }

  return null;
}

// Tekshiruv narxini aniqlash (Foydalanuvchining aniq qoidasi):
// 1. No Rezident (Chet el fuqarosi) -> 254 400 UZS
// 2. Rezident (O'zbekiston fuqarosi) -> 159 000 UZS
// 3. Qolgan barchasi (Sug'urta, Orderli, Vaqf...) -> 155 820 UZS
function estimateRecordPrice(p, priceCatalog) {
  const kurum = String(p.KurumAdi || p.SosyalGuvence || '').toLowerCase();
  const isNoRezident = kurum.includes('no rezident') || kurum.includes('norezident') || kurum.includes('no-rezident');
  const isRezident = !isNoRezident && kurum.includes('rezident');

  let patientType = 'sugurta';
  let citizenshipTitle = "Sug'urta / Imtiyozli";
  let price = 155820; // Qolgan barchasi standart sug'urta narxi

  if (isNoRezident) {
    patientType = 'norezident';
    citizenshipTitle = 'No Rezident (Chet el)';
    price = 254400;
  } else if (isRezident) {
    patientType = 'rezident';
    citizenshipTitle = "Rezident (O'zbekiston)";
    price = 159000;
  }

  // Katalogdan aniq tekshiruv nomini qidirish
  const testName = String(p.TetkikIsmi || p.HizmetAdi || '').trim().toLowerCase();
  const testCode = String(p.SevkTetkikKodu || p.KodAra || p.code || '').trim().toUpperCase();
  let matchedServiceName = 'UTT Tekshiruvi';

  if (priceCatalog && Array.isArray(priceCatalog.services)) {
    let found = null;
    if (testCode) {
      found = priceCatalog.services.find(s => s.id === testCode || s.code === testCode);
    }
    if (!found && testName) {
      found = priceCatalog.services.find(s => {
        const sName = (s.name || '').toLowerCase();
        return testName.includes(sName) || sName.includes(testName);
      });
    }
    if (found) {
      matchedServiceName = found.name;
      if (patientType === 'norezident' && found.priceForeign) price = found.priceForeign;
      else if (patientType === 'rezident' && found.priceLocal) price = found.priceLocal;
      else if (found.priceInsurance) price = found.priceInsurance;
    }
  }

  return {
    price,
    patientType,
    citizenshipTitle,
    serviceName: matchedServiceName
  };
}

// Karmeddan bitta bemorning barcha tekshiruv organlari va tashxisini olish
async function fetchPatientServicesFromKarmed(p) {
  const labDosyaId = p.labDosyaId || p.Id;
  if (!labDosyaId) throw new Error("Bemor labDosyaId kiritilmagan");

  const cache = getPatientServicesCache();
  if (cache[labDosyaId] && Array.isArray(cache[labDosyaId].services) && cache[labDosyaId].services.length > 0) {
    return cache[labDosyaId];
  }

  const profiles = getKarmedProfiles();
  const activeProfile = profiles.R5 || profiles.R4 || profiles.R1 || Object.values(profiles)[0];
  if (!activeProfile || !activeProfile.loginBilgi) {
    throw new Error("Karmed profili yoki login tokeni topilmadi");
  }

  const sParams = new URLSearchParams();
  sParams.set('submitDirectEventConfig', JSON.stringify({
    config: {
      extraParams: {
        aLabDosyaId: labDosyaId,
        aOnkayitSiraNo: p.onKayitId || p.OnKayitId || 0,
        aYatPol: p.yatPol || p.YatPol || 'P',
        aProtokolNo: p.dosyaNo || p.ProtokolNo || 0,
        aKimlikId: p.patientId || p.KimlikNo || 0,
        aHastaAdi: p.fullName || p.AdSoyad || '',
        aBolumId: 10,
        mrrsProtokolNo: null
      }
    }
  }));
  sParams.set('cbYil', '2026');
  sParams.set('_cbYil_state', JSON.stringify([{ value: '2026', text: '2026', index: 1 }]));
  sParams.set('hdnKrmdLoginBilgi', activeProfile.loginBilgi);
  sParams.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
  sParams.set('__EVENTARGUMENT', '-|public|TaniHizmetBilgisiGetir');

  const spData = sParams.toString();
  const priceCatalog = getPriceCatalog();
  const docsAuth = getDoctorsAuth();
  const doctorKeys = Object.keys(docsAuth);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '192.168.150.111',
      port: 2025,
      path: '/Radiology/Rbys.aspx?action=TaniHizmetBilgisiGetir',
      method: 'POST',
      headers: {
        'X-Ext-Net': 'delta=true',
        'action': 'TaniHizmetBilgisiGetir',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': activeProfile.cookie || '',
        'Content-Length': Buffer.byteLength(spData)
      },
      timeout: 12000
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let diagnosis = '';
        const mTanilar = data.match(/lblTanilar\.setText\((.*?)\);/);
        if (mTanilar) {
          try {
            const rawTxt = mTanilar[1].split(',')[0].replace(/^"|"$/g, '').replace(/\\"/g, '"');
            diagnosis = rawTxt.trim();
          } catch (e) {}
        }

        let rawServices = [];
        const mServices = data.match(/App\.grdHizmetlerStore\.loadData\((\[.*?\])\);/s);
        if (mServices) {
          rawServices = safeParseExtNetJson(mServices[1]) || [];
        }

        const kurumStr = String(p.kurumAdi || p.KurumAdi || p.SosyalGuvence || '').toLowerCase();
        let patientType = 'sugurta';
        let defaultTariff = 155820;
        let citizenshipTitle = "Sug'urta / Imtiyozli";
        if (kurumStr.includes('no rezident') || kurumStr.includes('norezident')) {
          patientType = 'norezident';
          defaultTariff = 254400;
          citizenshipTitle = "No Rezident (Chet el)";
        } else if (kurumStr.includes('rezident')) {
          patientType = 'rezident';
          defaultTariff = 159000;
          citizenshipTitle = "Rezident (O'zbekiston)";
        }

        const formattedServices = rawServices.map((s, sIdx) => {
          const code = (s.KodAra || s.HizmetKodu || 'UTT').trim().toUpperCase();
          const name = (s.TetkikIsmi || 'UTT Tekshiruvi').trim();
          let itemPrice = defaultTariff;

          if (priceCatalog && Array.isArray(priceCatalog.services)) {
            const found = priceCatalog.services.find(cs => cs.id === code || cs.code === code);
            if (found) {
              if (patientType === 'norezident' && found.priceForeign) itemPrice = found.priceForeign;
              else if (patientType === 'rezident' && found.priceLocal) itemPrice = found.priceLocal;
              else if (found.priceInsurance) itemPrice = found.priceInsurance;
            }
          }

          return {
            id: s.Id || (sIdx + 1),
            code: code,
            name: name,
            doctorName: (s.DoktorAdSoyad || '').trim(),
            authorDoctor: (s.RaporYazan || s.DoktorAdSoyad || '').trim(),
            confirmingDoctor: (s.RaporOnaylayan || '').trim(),
            referringDoctor: (s.IDoktorAdSoyad || '').trim(),
            isApproved: s.RaporOnayli === true,
            isWritten: s.RaporYazili === true,
            price: itemPrice,
            priceFormatted: itemPrice.toLocaleString('uz-UZ') + " so'm",
            debtStatus: s.BorcDurumu || "To'lanmagan"
          };
        });

        const totalPrice = formattedServices.length > 0 
          ? formattedServices.reduce((sum, s) => sum + s.price, 0)
          : defaultTariff;

        const roomStr = (p.connectedRoom || p.AltBolumAdi || p.OdaAdi || '').trim();
        const kabulStr = (p.acceptingDoctor || p.KabulEden || p.DoktorAdi || p.reportAuthor || (formattedServices[0] && formattedServices[0].doctorName) || '').trim();
        const docRoom = mapDoctorByRoom(roomStr, docsAuth, doctorKeys);
        const docAccepting = mapDoctorByName(kabulStr, docsAuth, doctorKeys);
        const isWaiting = p.statusCategory === 'waiting';
        const hasDiscrepancy = Boolean(!isWaiting && docRoom && docAccepting && docRoom.roomId !== docAccepting.roomId);

        const result = {
          labDosyaId,
          patientId: String(p.patientId || p.KimlikNo || ''),
          dosyaNo: String(p.dosyaNo || p.ProtokolNo || ''),
          fullName: (p.fullName || p.AdSoyad || '').trim(),
          diagnosis: diagnosis || "Ko'rsatilmagan",
          connectedRoom: roomStr,
          connectedDoctor: docRoom ? docRoom.doctorName : (roomStr || 'Biriktirilmagan'),
          connectedRoomId: docRoom ? docRoom.roomId : 'Biriktirilmagan',
          acceptingDoctor: kabulStr || (isWaiting ? "Kutilmoqda (Qabul qilinmagan)" : "Kiritilmagan"),
          acceptingDoctorName: docAccepting ? docAccepting.doctorName : (kabulStr || (isWaiting ? "Kutilmoqda (Qabul qilinmagan)" : "Kiritilmagan")),
          acceptingDoctorRoomId: docAccepting ? docAccepting.roomId : null,
          acceptingDoctorShort: docAccepting ? docAccepting.shortName : (kabulStr || '—'),
          reportAuthor: kabulStr || (isWaiting ? "Kutilmoqda (Qabul qilinmagan)" : "Kiritilmagan"),
          reportAuthorDoctor: docAccepting ? docAccepting.doctorName : (kabulStr || 'Kiritilmagan'),
          reportAuthorRoomId: docAccepting ? docAccepting.roomId : null,
          referringDoctor: (p.referringDoctor || p.DosyaDoktoru || '').trim(),
          hasDiscrepancy,
          discrepancyText: hasDiscrepancy ? `Ulangan: ${docRoom.shortName} ⟷ Qabul: ${docAccepting.shortName}` : (isWaiting ? 'Kutilmoqda' : 'Mos keladi'),
          patientType,
          citizenshipTitle,
          servicesCount: formattedServices.length,
          services: formattedServices,
          totalPrice,
          totalPriceFormatted: totalPrice.toLocaleString('uz-UZ') + " so'm",
          updatedAt: new Date().toISOString()
        };

        cache[labDosyaId] = result;
        savePatientServicesCache(cache);

        resolve(result);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error("Karmed serveridan javob kutish vaqti tugadi (Timeout 12s)"));
    });
    req.on('error', reject);
    req.write(spData);
    req.end();
  });
}

// Karmeddan jonli ma'lumotlarni tortib olish
async function queryKarmedAnalyticsDirect(startDate, endDate) {
  const now = new Date();
  const pad = n => (n < 10 ? '0' : '') + n;
  const todayStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
  startDate = startDate || todayStr;
  endDate = endDate || todayStr;

  const profiles = getKarmedProfiles();
  const activeProfile = profiles.R5 || profiles.R4 || profiles.R1 || Object.values(profiles)[0];
  
  if (!activeProfile || !activeProfile.loginBilgi) {
    throw new Error("Karmed profil yoki login tokeni topilmadi (R5 profili mavjud emas)");
  }

  const sParams = new URLSearchParams();
  sParams.set('submitDirectEventConfig', JSON.stringify({
    config: { extraParams: { aDosyaDurumu: null, aHizliAra: false } }
  }));
  sParams.set('cbYil', '2026');
  sParams.set('_cbYil_state', JSON.stringify([{ value: '2026', text: '2026', index: 1 }]));
  sParams.set('cbHizliAramaTur', 'Bemor ID');
  sParams.set('_cbHizliAramaTur_state', JSON.stringify([{ value: '0', text: 'Bemor ID', index: 0 }]));
  sParams.set('tfHizliAramaDeger', '');
  sParams.set('BaslangicDt', startDate);
  sParams.set('BitisDt', endDate);
  sParams.set('cbBolum', 'Ultratovush, Dopler Ultratovush');
  sParams.set('_cbBolum_state', JSON.stringify([
    { value: '10', text: 'Ultratovush', index: 9 },
    { value: '24', text: 'Dopler Ultratovush', index: 0 }
  ]));
  sParams.set('cbAltBolum', '(Subbirliklar)');
  sParams.set('_cbAltBolum_state', JSON.stringify([{ value: '0', text: '(Subbirliklar)', index: 0 }]));
  sParams.set('cbBolumOda', '(Barcha Xonalar)');
  sParams.set('_cbBolumOda_state', JSON.stringify([{ value: '0', text: '(Barcha Xonalar)', index: 0 }]));
  sParams.set('cbBirimTuru', '(Butun Birlik)');
  sParams.set('_cbBirimTuru_state', JSON.stringify([{ value: '0', text: '(Butun Birlik)', index: 0 }]));
  sParams.set('cbBina', '(Butun Binolar)');
  sParams.set('_cbBina_state', JSON.stringify([{ value: '0', text: '(Butun Binolar)', index: 0 }]));
  sParams.set('cbKayitSayisiSecim', '500');
  sParams.set('_cbKayitSayisiSecim_state', JSON.stringify([{ value: '500', text: '500', index: 3 }]));
  sParams.set('hdnDosyaDurumu', '');
  sParams.set('btnTumu_Pressed', 'true');
  sParams.set('btnBekleyen_Pressed', '');
  sParams.set('HdnBaseYazdirmaTuru', '-1');
  sParams.set('__VIEWSTATEGENERATOR', '5DE5E74B');
  sParams.set('hdnKrmdLoginBilgi', activeProfile.loginBilgi);
  sParams.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
  sParams.set('__EVENTARGUMENT', '-|public|HastaSorgula');

  const spData = sParams.toString();

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '192.168.150.111',
      port: 2025,
      path: '/Radiology/Rbys.aspx?action=HastaSorgula',
      method: 'POST',
      headers: {
        'X-Ext-Net': 'delta=true',
        'action': 'HastaSorgula',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': activeProfile.cookie || '',
        'Content-Length': Buffer.byteLength(spData)
      },
      timeout: 120000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (data.includes('Login.aspx') || data.includes('ResLogin')) {
          return reject(new Error("Karmed sessiyasi muddati tugagan. Qayta avtorizatsiya talab etiladi."));
        }

        const match = data.match(/App\.grdHastalarStore\.proxy\.data\s*=\s*(\[.*?\]);/s);
        if (match) {
          const list = safeParseExtNetJson(match[1]);
          resolve(list || []);
        } else {
          resolve([]);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error("Karmed serveridan javob kutish vaqti tugadi (Timeout 120s)"));
    });

    req.on('error', reject);
    req.write(spData);
    req.end();
  });
}

// Barcha xom bemorlar ma'lumotlarini tahlil qilish va agregatsiya
function processAnalytics(rawRecords, startDate, endDate) {
  const docsAuth = getDoctorsAuth();
  const doctorKeys = Object.keys(docsAuth);
  const priceCatalog = getPriceCatalog();
  const patientServicesCache = getPatientServicesCache();

  let totalReferred = rawRecords.length; // Jami yo'naltirilgan tekshiruvlar
  let totalCompleted = 0;
  let totalAccepted = 0;
  let totalWaiting = 0;
  let totalWriting = 0;
  let totalCancelled = 0;
  let totalRevenue = 0;
  let totalDiscrepancies = 0;

  let rezidentCount = 0;
  let noRezidentCount = 0;
  let sugurtaCount = 0;

  const uniquePatientsSet = new Set();
  const patientTestCounts = {};

  // 10 ta UTT xonasi uchun boshlang'ich ob'ekt
  const docStats = {};
  doctorKeys.forEach(k => {
    const d = docsAuth[k];
    docStats[d.roomId] = {
      roomId: d.roomId,
      doctorName: d.doctorName,
      shortName: d.shortName,
      roomNum: d.roomNum,
      roomTitle: d.roomTitle || `${d.roomNum}-xona (${d.shortName})`,
      totalCount: 0,
      completedCount: 0,
      acceptedCount: 0,
      waitingCount: 0,
      writingCount: 0,
      revenue: 0,
      revenueFormatted: "0 so'm",
      completionRate: "0%",
      patients: [],
      referringBreakdown: {} // Qaysi davolovchi vrach bu xonaga qancha bemor yuborgan
    };
  });

  const referringDoctors = {};
  const departments = {};
  const dailyTimeline = {};
  const allPatients = [];

  // 1-qadam: Bemorlarning jami tekshiruvlar sonini sanash
  rawRecords.forEach(p => {
    const pId = String(p.KimlikNo || p.ProtokolNo || '');
    if (pId) {
      patientTestCounts[pId] = (patientTestCounts[pId] || 0) + 1;
    }
  });

  // 2-qadam: Asosiy qayta ishlash
  rawRecords.forEach((p, index) => {
    const pId = String(p.KimlikNo || p.ProtokolNo || '');
    if (pId) uniquePatientsSet.add(pId);

    const statusCode = p.DosyaDurumu;
    let statusCategory = 'waiting';
    let statusText = p.Durum || '';

    if (statusCode === 8 || statusText.toLowerCase().includes('onay')) {
      statusCategory = 'completed';
      statusText = "Rapor Onaylı (Tekshiruvdan o'tdi)";
    } else if (statusCode === 4 || statusText.toLowerCase().includes('kabul')) {
      statusCategory = 'accepted';
      statusText = 'Kabul Edilen (Xonada qabul qilindi)';
    } else if (statusText.toLowerCase().includes('yaz')) {
      statusCategory = 'writing';
      statusText = 'Rapor Yazılıyor (Hisobot yozilmoqda)';
    } else if (p.CekimeGelmedi || p.CekimIptalNedeni) {
      statusCategory = 'cancelled';
      statusText = 'Bekor qilindi / Kelmadi';
    } else {
      statusCategory = 'waiting';
      statusText = statusText || 'Bekleyen (Navbatda kutmoqda)';
    }

    // 1. Shifokorlar va xonani aniq ajratish
    const connectedRoomStr = (p.AltBolumAdi || p.OdaAdi || '').trim();
    const kabulEdenStr = (p.KabulEden || p.DoktorAdi || '').trim();
    const refDoc = (p.DosyaDoktoru || 'Kiritilmagan').trim();
    const dept = (p.ServisAdi || p.AltServisAdi || 'Ambulator').trim();

    const docRoom = mapDoctorByRoom(connectedRoomStr, docsAuth, doctorKeys);
    const docAccepting = mapDoctorByName(kabulEdenStr, docsAuth, doctorKeys);

    const connectedRoomId = docRoom ? docRoom.roomId : 'Biriktirilmagan';
    const connectedDoctorName = docRoom ? docRoom.doctorName : (connectedRoomStr || 'Biriktirilmagan');
    const connectedRoomTitle = docRoom ? docRoom.roomTitle : (connectedRoomStr || 'Biriktirilmagan');

    const isWaiting = statusCategory === 'waiting';

    const acceptingDoctorName = docAccepting 
      ? docAccepting.doctorName 
      : (kabulEdenStr || (isWaiting ? "Kutilmoqda (Qabul qilinmagan)" : "Kiritilmagan"));
    const acceptingDoctorRoomId = docAccepting ? docAccepting.roomId : null;
    const acceptingDoctorShort = docAccepting ? docAccepting.shortName : (kabulEdenStr || '—');

    // 2. Farq (Discrepancy) tekshiruvi:
    // Ulangan bo'lim vrachi bilan qabul qilgan shifokor taqqoslanadi (kutayotganlar bundan mustasno)
    let hasDiscrepancy = false;
    let discrepancyText = 'Mos keladi';
    if (!isWaiting && docRoom && docAccepting && docRoom.roomId !== docAccepting.roomId) {
      hasDiscrepancy = true;
      totalDiscrepancies++;
      discrepancyText = `Ulangan: ${docRoom.shortName} ⟷ Qabul: ${docAccepting.shortName}`;
    } else if (isWaiting) {
      discrepancyText = 'Kutilmoqda';
    }

    // 3. Narx va tekshiruv organlarini hisoblash
    const priceInfo = estimateRecordPrice(p, priceCatalog);
    const cachedDetail = patientServicesCache[p.Id] || null;
    let patientPrice = priceInfo.price;
    let servicesList = [];
    let diagnosisText = '';
    let testCount = (p.HizmetSayisiTumu && p.HizmetSayisiTumu > 0) ? p.HizmetSayisiTumu : (patientTestCounts[pId] || 1);

    if (cachedDetail && Array.isArray(cachedDetail.services) && cachedDetail.services.length > 0) {
      servicesList = cachedDetail.services;
      diagnosisText = cachedDetail.diagnosis || '';
      testCount = cachedDetail.services.length;
      patientPrice = cachedDetail.totalPrice || (priceInfo.price * testCount);
    } else {
      patientPrice = priceInfo.price * (testCount > 0 ? testCount : 1);
    }

    if (priceInfo.patientType === 'norezident') noRezidentCount++;
    else if (priceInfo.patientType === 'rezident') rezidentCount++;
    else sugurtaCount++;

    if (statusCategory === 'completed') {
      totalCompleted++;
      totalRevenue += patientPrice;
    } else if (statusCategory === 'accepted') {
      totalAccepted++;
    } else if (statusCategory === 'waiting') {
      totalWaiting++;
    } else if (statusCategory === 'writing') {
      totalWriting++;
    } else if (statusCategory === 'cancelled') {
      totalCancelled++;
    }

    // 4. UTT Shifokoriga biriktirish va summa hisoblash:
    // QOIDAGA BINOAN: Summa va tekshiruv QABUL QILUVCHI SHIFOKORGA hisoblanadi!
    // Agar bemor hali qabul qilinmagan bo'lsa (navbatda), u yo'naltirilgan xonaga biriktiriladi.
    const targetDoctor = isWaiting ? (docRoom || docAccepting) : (docAccepting || docRoom);
    const targetRoomId = targetDoctor ? targetDoctor.roomId : 'Biriktirilmagan';

    if (!docStats[targetRoomId]) {
      docStats[targetRoomId] = {
        roomId: targetRoomId,
        doctorName: targetDoctor ? targetDoctor.doctorName : (connectedDoctorName || 'Noma\'lum'),
        shortName: targetDoctor ? targetDoctor.shortName : targetRoomId,
        roomNum: targetDoctor ? (targetDoctor.roomNum || '—') : '—',
        roomTitle: targetDoctor ? (targetDoctor.roomTitle || targetDoctor.doctorName) : targetRoomId,
        totalCount: 0,
        completedCount: 0,
        acceptedCount: 0,
        waitingCount: 0,
        writingCount: 0,
        revenue: 0,
        revenueFormatted: "0 so'm",
        completionRate: "0%",
        patients: [],
        referringBreakdown: {}
      };
    }

    const dStat = docStats[targetRoomId];
    dStat.totalCount++;

    if (statusCategory === 'completed') {
      dStat.completedCount++;
      dStat.revenue += patientPrice;
    } else if (statusCategory === 'accepted') {
      dStat.acceptedCount++;
    } else if (statusCategory === 'writing') {
      dStat.writingCount++;
    } else {
      dStat.waitingCount++;
    }

    // Sana va vaqt
    const rawDateStr = p.KayitTarihi || p.KabulTarihi || '';
    let dateOnly = '';
    let timeOnly = '';
    if (rawDateStr) {
      const parts = rawDateStr.split('T');
      dateOnly = parts[0] || '';
      timeOnly = (parts[1] || '').substring(0, 5);
    }

    const patientItem = {
      index: index + 1,
      patientId: String(p.KimlikNo || ''),
      dosyaNo: String(p.ProtokolNo || ''),
      labDosyaId: p.Id,
      onKayitId: p.OnKayitId || 0,
      yatPol: p.YatPol || 'P',
      fullName: (p.AdSoyad || ((p.HastaAdi || '') + ' ' + (p.Soyadi || ''))).trim(),
      date: dateOnly,
      time: timeOnly,
      rawDateTime: rawDateStr,
      roomId: targetRoomId,
      roomName: dStat.roomTitle,
      connectedRoom: connectedRoomStr,
      connectedDoctor: connectedDoctorName,
      connectedRoomTitle: connectedRoomTitle,
      acceptingDoctor: kabulEdenStr || (isWaiting ? "Kutilmoqda (Qabul qilinmagan)" : "Kiritilmagan"),
      acceptingDoctorName: acceptingDoctorName,
      acceptingDoctorRoomId: acceptingDoctorRoomId,
      acceptingDoctorShort: acceptingDoctorShort,
      reportAuthor: kabulEdenStr || (isWaiting ? "Kutilmoqda (Qabul qilinmagan)" : "Kiritilmagan"),
      reportAuthorDoctor: acceptingDoctorName,
      reportAuthorRoomId: acceptingDoctorRoomId,
      reportAuthorShort: acceptingDoctorShort,
      hasDiscrepancy: hasDiscrepancy,
      discrepancyText: discrepancyText,
      referringDoctor: refDoc,
      department: dept,
      status: statusText,
      statusCategory: statusCategory,
      statusCode: statusCode,
      serviceName: priceInfo.serviceName,
      servicesCount: testCount,
      services: servicesList,
      diagnosis: diagnosisText,
      price: patientPrice,
      priceFormatted: patientPrice.toLocaleString('uz-UZ') + " so'm",
      patientType: priceInfo.patientType,
      citizenshipTitle: priceInfo.citizenshipTitle,
      kurumAdi: (p.KurumAdi || p.SosyalGuvence || '').trim(),
      testsForPatient: testCount
    };

    dStat.patients.push(patientItem);
    allPatients.push(patientItem);

    // =========================================================================
    // IKKI TOMONLAMA MATRITSA:
    // 1. UTT Vrachi bo'yicha: unga qaysi davolovchi shifokorlar qancha yubordi
    // =========================================================================
    if (!dStat.referringBreakdown[refDoc]) {
      dStat.referringBreakdown[refDoc] = {
        name: refDoc,
        dept: dept,
        count: 0,
        completed: 0,
        waiting: 0,
        revenue: 0,
        revenueFormatted: "0 so'm"
      };
    }
    const rRef = dStat.referringBreakdown[refDoc];
    rRef.count++;
    if (statusCategory === 'completed') {
      rRef.completed++;
      rRef.revenue += patientPrice;
    } else {
      rRef.waiting++;
    }
    rRef.revenueFormatted = rRef.revenue.toLocaleString('uz-UZ') + " so'm";

    // =========================================================================
    // 2. Davolovchi Shifokor bo'yicha: u yuborgan bemorlar qaysi UTT ga tushdi
    // =========================================================================
    if (!referringDoctors[refDoc]) {
      referringDoctors[refDoc] = {
        name: refDoc,
        dept: dept,
        totalSent: 0,
        completed: 0,
        waiting: 0,
        accepted: 0,
        revenue: 0,
        revenueFormatted: "0 so'm",
        sharePercent: "0%",
        uttBreakdown: {} // Qaysi UTT xonasiga nechta borgani
      };
    }
    const rStat = referringDoctors[refDoc];
    rStat.totalSent++;
    if (statusCategory === 'completed') {
      rStat.completed++;
      rStat.revenue += patientPrice;
    } else if (statusCategory === 'accepted') {
      rStat.accepted++;
    } else {
      rStat.waiting++;
    }

    if (!rStat.uttBreakdown[targetRoomId]) {
      rStat.uttBreakdown[targetRoomId] = {
        roomId: targetRoomId,
        roomTitle: dStat.roomTitle,
        doctorName: dStat.doctorName,
        count: 0,
        completed: 0,
        waiting: 0,
        revenue: 0,
        revenueFormatted: "0 so'm"
      };
    }
    const rUtt = rStat.uttBreakdown[targetRoomId];
    rUtt.count++;
    if (statusCategory === 'completed') {
      rUtt.completed++;
      rUtt.revenue += patientPrice;
    } else {
      rUtt.waiting++;
    }
    rUtt.revenueFormatted = rUtt.revenue.toLocaleString('uz-UZ') + " so'm";

    // Bo'lim (ServisAdi)
    if (!departments[dept]) {
      departments[dept] = { name: dept, count: 0, completed: 0, revenue: 0 };
    }
    departments[dept].count++;
    if (statusCategory === 'completed') {
      departments[dept].completed++;
      departments[dept].revenue += patientPrice;
    }

    // Kunlik xronologiya
    if (dateOnly && dateOnly.length === 10) {
      if (!dailyTimeline[dateOnly]) {
        dailyTimeline[dateOnly] = { date: dateOnly, total: 0, completed: 0, waiting: 0, revenue: 0 };
      }
      dailyTimeline[dateOnly].total++;
      if (statusCategory === 'completed') {
        dailyTimeline[dateOnly].completed++;
        dailyTimeline[dateOnly].revenue += patientPrice;
      } else {
        dailyTimeline[dateOnly].waiting++;
      }
    }
  });

  // UTT Vrachlari ro'yxatini to'ldirish va formatlash
  const byDoctor = Object.values(docStats).map(d => {
    d.revenueFormatted = d.revenue.toLocaleString('uz-UZ') + " so'm";
    d.completionRate = d.totalCount > 0 ? ((d.completedCount / d.totalCount) * 100).toFixed(1) + '%' : '0%';
    d.referringList = Object.values(d.referringBreakdown).sort((a, b) => b.count - a.count);
    return d;
  }).sort((a, b) => b.completedCount - a.completedCount);

  // Davolovchi shifokorlar reytingi
  const byReferringDoctor = Object.values(referringDoctors).map(r => {
    r.revenueFormatted = r.revenue.toLocaleString('uz-UZ') + " so'm";
    r.sharePercent = totalReferred > 0 ? ((r.totalSent / totalReferred) * 100).toFixed(1) + '%' : '0%';
    r.uttList = Object.values(r.uttBreakdown).sort((a, b) => b.count - a.count);
    return r;
  }).sort((a, b) => b.totalSent - a.totalSent);

  // Bo'limlar ro'yxati
  const byDepartment = Object.values(departments).map(dept => {
    dept.revenueFormatted = dept.revenue.toLocaleString('uz-UZ') + " so'm";
    return dept;
  }).sort((a, b) => b.count - a.count);

  // Kunlik dinamika
  const dailyList = Object.values(dailyTimeline).map(day => {
    day.revenueFormatted = day.revenue.toLocaleString('uz-UZ') + " so'm";
    day.completedPercent = day.total > 0 ? ((day.completed / day.total) * 100).toFixed(1) + '%' : '0%';
    return day;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const completedPercent = totalReferred > 0 ? ((totalCompleted / totalReferred) * 100).toFixed(1) + '%' : '0%';
  const discrepancyPercent = totalReferred > 0 ? ((totalDiscrepancies / totalReferred) * 100).toFixed(1) + '%' : '0%';

  return {
    summary: {
      totalReferred, // Jami yo'naltirilgan tekshiruvlar (4,746 / 6,500)
      uniquePatientsCount: uniquePatientsSet.size, // Noyob bemorlar soni
      totalCompleted,
      completedPercent,
      totalWaiting,
      totalAccepted,
      totalWriting,
      totalCancelled,
      totalRevenue,
      totalRevenueFormatted: totalRevenue.toLocaleString('uz-UZ') + " so'm",
      totalDiscrepancies,
      discrepancyPercent,
      rezidentCount,
      noRezidentCount,
      sugurtaCount,
      totalDoctors: byDoctor.length,
      totalReferringDoctors: byReferringDoctor.length,
      startDate,
      endDate,
      generatedAt: new Date().toISOString()
    },
    byDoctor,
    byReferringDoctor,
    byDepartment,
    dailyTimeline: dailyList,
    allPatients,
    discrepancyPatients: allPatients.filter(p => p.hasDiscrepancy),
    crossDoctorMatrix: {
      byUttDoctor: byDoctor.map(d => ({
        roomId: d.roomId,
        roomTitle: d.roomTitle,
        doctorName: d.doctorName,
        totalPatients: d.totalCount,
        completedCount: d.completedCount,
        revenueFormatted: d.revenueFormatted,
        referringDoctors: d.referringList
      })),
      byReferringDoctor: byReferringDoctor.map(r => ({
        name: r.name,
        dept: r.dept,
        totalSent: r.totalSent,
        completedCount: r.completed,
        revenueFormatted: r.revenueFormatted,
        uttRooms: r.uttList
      }))
    }
  };
}

// Sanalarni to'g'rilash (masalan, 31.06.2026 kabi mavjud bo'lmagan kunlarni oyning oxirgi kuniga, masalan 30.06.2026 ga moslash)
function sanitizeDateStr(dStr) {
  if (!dStr) return dStr;
  const parts = String(dStr).trim().split('.');
  if (parts.length !== 3) return dStr;
  let day = parseInt(parts[0], 10);
  let month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return dStr;
  if (month < 1) month = 1;
  if (month > 12) month = 12;
  const maxDays = new Date(year, month, 0).getDate();
  if (day > maxDays) day = maxDays;
  if (day < 1) day = 1;
  const pad = n => (n < 10 ? '0' : '') + n;
  return `${pad(day)}.${pad(month)}.${year}`;
}

// Katta vaqt oraliqlarini oylik qismlarga (chunks) bo'lish
function splitDateRangeIntoMonthlyChunks(startStr, endStr) {
  const [sD, sM, sY] = startStr.split('.').map(Number);
  const [eD, eM, eY] = endStr.split('.').map(Number);
  const startDate = new Date(sY, sM - 1, sD);
  const endDate = new Date(eY, eM - 1, eD);

  if (startDate >= endDate) {
    return [{ start: startStr, end: endStr }];
  }

  const chunks = [];
  let curr = new Date(startDate.getTime());
  const pad = n => (n < 10 ? '0' : '') + n;

  while (curr <= endDate) {
    const chunkStartStr = `${pad(curr.getDate())}.${pad(curr.getMonth() + 1)}.${curr.getFullYear()}`;
    const endOfMonth = new Date(curr.getFullYear(), curr.getMonth() + 1, 0);
    const chunkEndDate = (endOfMonth < endDate) ? endOfMonth : endDate;
    const chunkEndStr = `${pad(chunkEndDate.getDate())}.${pad(chunkEndDate.getMonth() + 1)}.${chunkEndDate.getFullYear()}`;
    chunks.push({ start: chunkStartStr, end: chunkEndStr });

    curr = new Date(chunkEndDate.getFullYear(), chunkEndDate.getMonth(), chunkEndDate.getDate() + 1);
  }

  return chunks;
}

// Asosiy kesh boshqaruvi va so'rov funksiyasi
async function getAdminAnalytics({ startDate, endDate, forceRefresh = false } = {}) {
  const now = new Date();
  const pad = n => (n < 10 ? '0' : '') + n;
  const todayStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;

  const rawStartInput = startDate;
  const rawEndInput = endDate;

  startDate = sanitizeDateStr(startDate || todayStr);
  endDate = sanitizeDateStr(endDate || todayStr);

  const cacheKey = `${startDate}_${endDate}`;
  const origCacheKey = (rawStartInput && rawEndInput) ? `${rawStartInput.trim()}_${rawEndInput.trim()}` : cacheKey;
  const isTodayInRange = (startDate === todayStr || endDate === todayStr);

  // 1. Kesh mavjudligini tekshirish
  if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
    try {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const cachedItem = cacheData[cacheKey] || cacheData[origCacheKey];
      if (cachedItem && cachedItem.summary && cachedItem.summary.rezidentCount !== undefined) {
        // Agar keshda 0 bemor bo'lsa va bu bir oylik yoki ko'p kunlik muddat bo'lsa, eskirgan xato kesh deb hisoblab, qayta yuklash
        const isSuspiciousZero = (cachedItem.summary.totalReferred === 0 && startDate !== endDate);
        const cachedAt = cachedItem.summary.generatedAt ? new Date(cachedItem.summary.generatedAt).getTime() : 0;
        const cacheAgeMs = Date.now() - cachedAt;

        if (isTodayInRange && cacheAgeMs > 45000) {
          console.log(`[Admin Analytics] Bugungi kun keshi eskirgan (${Math.round(cacheAgeMs/1000)}s oldin). Karmeddan jonli olinmoqda...`);
        } else if (!isSuspiciousZero) {
          console.log(`[Admin Analytics] Keshdan yuklandi: ${cacheKey} (${cachedItem.summary.totalReferred} ta tekshiruv)`);
          return {
            success: true,
            cached: true,
            cachedAt: cachedItem.summary.generatedAt,
            ...cachedItem
          };
        } else {
          console.log(`[Admin Analytics] Keshdagi 0 ta bemor gumonli (xatolik natijasi bo'lishi mumkin). Karmeddan qayta so'ralmoqda...`);
        }
      }
    } catch (ce) {
      console.warn('[Admin Analytics] Kesh o\'qishda xatolik:', ce.message);
    }
  }

  // 2. Jonli Karmed serveridan yuklash (agar muddat 35 kundan ko'p bo'lsa, oylik qismlarga bo'lib so'rash)
  const chunks = splitDateRangeIntoMonthlyChunks(startDate, endDate);
  let rawRecords = [];

  if (chunks.length <= 1) {
    console.log(`[Admin Analytics] Karmeddan yuklanmoqda: ${startDate} — ${endDate}...`);
    rawRecords = await queryKarmedAnalyticsDirect(startDate, endDate);
    console.log(`[Admin Analytics] Karmeddan ${rawRecords.length} ta yozuv qabul qilindi.`);
  } else {
    console.log(`[Admin Analytics] Katta muddat aniqlandi (${chunks.length} ta oylik qism). Karmeddan ketma-ket yuklanmoqda...`);
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i];
      console.log(`[Admin Analytics] Qism ${i+1}/${chunks.length}: ${ch.start} — ${ch.end}...`);
      const chRecords = await queryKarmedAnalyticsDirect(ch.start, ch.end);
      console.log(`[Admin Analytics] Qism ${i+1}/${chunks.length} dan ${chRecords.length} ta yozuv olindi.`);
      rawRecords.push(...chRecords);
    }
    console.log(`[Admin Analytics] Barcha qismlar bo'yicha jami: ${rawRecords.length} ta yozuv olindi.`);
  }

  const processed = processAnalytics(rawRecords, startDate, endDate);

  // 3. Keshga saqlash
  try {
    let cacheStore = {};
    if (fs.existsSync(CACHE_FILE)) {
      try { cacheStore = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) {}
    }
    cacheStore[cacheKey] = processed;
    if (origCacheKey !== cacheKey) {
      cacheStore[origCacheKey] = processed;
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheStore, null, 2), 'utf8');
    console.log(`[Admin Analytics] Yangi hisobot keshlandi: ${cacheKey}`);
  } catch (se) {
    console.warn('[Admin Analytics] Keshga yozish xatosi:', se.message);
  }

  return {
    success: true,
    cached: false,
    cachedAt: processed.summary.generatedAt,
    ...processed
  };
}

// Excel (CSV UTF-8 BOM) eksport generatori
function generateCsvExport(data, type = 'all') {
  const BOM = '\uFEFF';
  let csv = BOM;

  if (type === 'doctors') {
    csv += "Xona;Shifokor;Jami Tekshiruvlar;Tekshiruvdan O'tgan;Kutmoqda;Qabul Qilingan;O'tish Foizi;Jami Tushum (so'm)\n";
    (data.byDoctor || []).forEach(d => {
      csv += `"${d.roomTitle || d.roomId}";"${d.doctorName}";${d.totalCount};${d.completedCount};${d.waitingCount};${d.acceptedCount};"${d.completionRate}";"${d.revenue}"\n`;
    });
  } else if (type === 'referring') {
    csv += "Reyting;Davolovchi Shifokor;Bo'limi;Jami Yuborgan;Tekshiruvdan O'tgan;Kutmoqda;Ulushi;Jami Summa (so'm)\n";
    (data.byReferringDoctor || []).forEach((r, idx) => {
      csv += `${idx + 1};"${r.name}";"${r.dept}";${r.totalSent};${r.completed};${r.waiting};"${r.sharePercent}";"${r.revenue}"\n`;
    });
  } else if (type === 'cross-matrix') {
    csv += "UTT Xonasi;UTT Shifokori;Davolovchi Shifokor;Bo'limi;Bemorlar Soni;O'tganlar Soni;Summa (so'm)\n";
    (data.byDoctor || []).forEach(d => {
      (d.referringList || []).forEach(r => {
        csv += `"${d.roomTitle || d.roomId}";"${d.doctorName}";"${r.name}";"${r.dept}";${r.count};${r.completed};"${r.revenue}"\n`;
      });
    });
  } else if (type === 'discrepancies') {
    // Faqat boshqa vrachga kirgan / yo'naltirilgan xonasi farq qilgan bemorlar ro'yxati
    csv += "№;Bemor ID;Dosya No;Bemor F.I.SH;Sana;Vaqt;Ulangan Bo'lim (Navbatda Turgan Xona);Qabul Qiluvchi Shifokor (Tekshiruv O'tkazgan Vrach);Farq Tavsifi;Davolovchi Shifokor;Bo'lim;Holati;Tarif Summasi (so'm)\n";
    const disList = (data.allPatients || []).filter(p => p.hasDiscrepancy);
    disList.forEach((p, idx) => {
      const doctorAccepted = p.acceptingDoctorName || p.acceptingDoctor || '—';
      const doctorConnected = p.connectedRoomTitle || p.connectedDoctor || p.connectedRoom || '—';
      csv += `${idx + 1};"${p.patientId}";"${p.dosyaNo}";"${p.fullName}";"${p.date}";"${p.time}";"${doctorConnected}";"${doctorAccepted}";"${p.discrepancyText}";"${p.referringDoctor}";"${p.department}";"${p.status}";"${p.price}"\n`;
    });
  } else {
    // Barcha bemorlar jurnali
    csv += "№;Bemor ID;Dosya No;Bemor F.I.SH;Fuqarolik / Toifa;Sana;Vaqt;Tekshiruv Organlari;Ulangan Bo'lim (Xona);Qabul Qiluvchi Shifokor;Farq Holati;Davolovchi Shifokor;Bo'lim;Holati;To'lov Summasi (so'm)\n";
    (data.allPatients || []).forEach((p, idx) => {
      const organs = p.services && p.services.length > 0 
        ? p.services.map(s => s.code + ' (' + s.name + ')').join(', ') 
        : (p.serviceName || 'UTT Tekshiruvi') + (p.servicesCount > 1 ? ` (${p.servicesCount} ta)` : '');
      const discrepancyStatus = p.hasDiscrepancy ? 'Farq mavjud (' + p.discrepancyText + ')' : 'Mos keladi';
      const doctorAccepted = p.acceptingDoctorName || p.acceptingDoctor || p.reportAuthorDoctor || p.reportAuthor || '—';
      csv += `${idx + 1};"${p.patientId}";"${p.dosyaNo}";"${p.fullName}";"${p.kurumAdi ? p.kurumAdi + ' (' + p.citizenshipTitle + ')' : p.citizenshipTitle}";"${p.date}";"${p.time}";"${organs}";"${p.connectedRoomTitle || p.roomName}";"${doctorAccepted}";"${discrepancyStatus}";"${p.referringDoctor}";"${p.department}";"${p.status}";"${p.price}"\n`;
    });
  }

  return csv;
}

// Bemor sanasini o'qish va formatlash (DD.MM.YYYY HH:mm)
function formatKarmedDateTime(dStr) {
  if (!dStr) return '';
  try {
    const d = new Date(dStr);
    if (!isNaN(d.getTime())) {
      const pad = n => (n < 10 ? '0' : '') + n;
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
  } catch (e) {}
  return String(dStr);
}

// Pul formatlash: "173 000,00"
function formatReestrMoney(val) {
  const num = typeof val === 'number' ? val : (parseFloat(String(val).replace(/[^\d.]/g, '')) || 0);
  return num.toLocaleString('ru-RU') + ',00';
}

// Bitta bemor ID si bo'yicha Karmeddan tezkor qidiruv
async function queryKarmedSinglePatientDirect(patientId, startDate, endDate) {
  const profiles = getKarmedProfiles();
  const activeProfile = profiles.R5 || profiles.R4 || profiles.R1 || Object.values(profiles)[0];
  if (!activeProfile || !activeProfile.loginBilgi) {
    throw new Error("Karmed profili topilmadi");
  }

  const sParams = new URLSearchParams();
  sParams.set('submitDirectEventConfig', JSON.stringify({
    config: { extraParams: { aDosyaDurumu: null, aHizliAra: true } }
  }));
  sParams.set('cbYil', '2026');
  sParams.set('_cbYil_state', JSON.stringify([{ value: '2026', text: '2026', index: 1 }]));
  sParams.set('cbHizliAramaTur', 'Bemor ID');
  sParams.set('_cbHizliAramaTur_state', JSON.stringify([{ value: '0', text: 'Bemor ID', index: 0 }]));
  sParams.set('tfHizliAramaDeger', String(patientId).trim());
  sParams.set('BaslangicDt', startDate || '01.01.2026');
  sParams.set('BitisDt', endDate || '31.12.2026');
  sParams.set('cbBolum', 'Ultratovush, Dopler Ultratovush');
  sParams.set('cbAltBolum', '(Subbirliklar)');
  sParams.set('cbBolumOda', '(Barcha Xonalar)');
  sParams.set('cbBirimTuru', '(Butun Birlik)');
  sParams.set('cbBina', '(Butun Binolar)');
  sParams.set('cbKayitSayisiSecim', '500');
  sParams.set('btnTumu_Pressed', 'true');
  sParams.set('HdnBaseYazdirmaTuru', '-1');
  sParams.set('hdnKrmdLoginBilgi', activeProfile.loginBilgi);
  sParams.set('__EVENTTARGET', 'ctl00$ResourceManagerX');
  sParams.set('__EVENTARGUMENT', '-|public|HastaSorgula');

  const spData = sParams.toString();

  return new Promise((resolve) => {
    const req = http.request({
      hostname: '192.168.150.111',
      port: 2025,
      path: '/Radiology/Rbys.aspx?action=HastaSorgula',
      method: 'POST',
      headers: {
        'X-Ext-Net': 'delta=true',
        'action': 'HastaSorgula',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Cookie': activeProfile.cookie || '',
        'Content-Length': Buffer.byteLength(spData)
      },
      timeout: 15000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/App\.grdHastalarStore\.proxy\.data\s*=\s*(\[.*?\]);/s);
        if (match) {
          const list = safeParseExtNetJson(match[1]);
          resolve(list || []);
        } else {
          resolve([]);
        }
      });
    });

    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.on('error', () => resolve([]));
    req.write(spData);
    req.end();
  });
}

// Bemorning ID kodlari va sana oralig'i bo'yicha maxsus Karmed reestrini tuzish
async function calculateCustomReestrByIds({ ids, startDate = '01.08.2026', endDate = '31.08.2026', forceFresh = true }) {
  // 1. IDlarni tozalash
  let idList = [];
  if (Array.isArray(ids)) {
    idList = ids.map(s => String(s).trim().replace(/[^\d]/g, '')).filter(Boolean);
  } else if (typeof ids === 'string') {
    idList = ids.split(/[;,\n\r\t\s]+/).map(s => s.trim().replace(/[^\d]/g, '')).filter(Boolean);
  }
  // Takroriy IDlarni olib tashlash
  idList = [...new Set(idList)];

  if (idList.length === 0) {
    throw new Error("Bemor ID kodlari kiritilmadi. Nuqtali vergul (;) bilan ajratilgan ID raqamlarini kiriting.");
  }

  startDate = sanitizeDateStr(startDate);
  endDate = sanitizeDateStr(endDate);

  console.log(`[Custom Reestr] Qidiruv boshlandi: ${idList.length} ta ID, muddat: ${startDate} - ${endDate}`);

  // 2. Muddat bo'yicha Karmeddan ma'lumotlarni tortish
  const chunks = splitDateRangeIntoMonthlyChunks(startDate, endDate);
  let allRawPatients = [];

  for (const ch of chunks) {
    try {
      const records = await queryKarmedAnalyticsDirect(ch.start, ch.end);
      if (Array.isArray(records)) {
        allRawPatients = allRawPatients.concat(records);
      }
    } catch (err) {
      console.warn(`[Custom Reestr] Chunk ${ch.start} - ${ch.end} xatolik:`, err.message);
    }
  }

  // 3. Berilgan IDlar bo'yicha mos keluvchi bemorlarni topish
  const matchedPatients = [];
  const foundIdSet = new Set();

  idList.forEach(targetId => {
    const found = allRawPatients.filter(p => {
      const kNo = String(p.KimlikNo || '').trim();
      const pNo = String(p.ProtokolNo || '').trim();
      const tNo = String(p.TcKimlikNo || '').trim();
      const idStr = String(p.Id || '').trim();
      return kNo === targetId || pNo === targetId || tNo === targetId || idStr === targetId;
    });

    if (found.length > 0) {
      found.forEach(p => {
        matchedPatients.push(p);
      });
      foundIdSet.add(targetId);
    }
  });

  // Agar umumiy muddatda topilmagan IDlar bo'lsa, Karmed tezkor qidiruvi orqali individual qidirish
  const missingIds = idList.filter(id => !foundIdSet.has(id));
  if (missingIds.length > 0) {
    console.log(`[Custom Reestr] ${missingIds.length} ta ID umumiy ro'yxatda chiqmadi, individual qidiruv boshlanmoqda...`);
    for (const missingId of missingIds) {
      try {
        const indResult = await queryKarmedSinglePatientDirect(missingId, startDate, endDate);
        if (indResult && indResult.length > 0) {
          indResult.forEach(p => matchedPatients.push(p));
          foundIdSet.add(missingId);
        }
      } catch (e) {
        console.warn(`[Custom Reestr] ID ${missingId} individual qidiruv xatosi:`, e.message);
      }
    }
  }

  console.log(`[Custom Reestr] Jami topilgan bemorlar yozuvlari: ${matchedPatients.length}`);

  // 4. Har bir bemor uchun xizmatlar (organlar) va narxlarini olish
  const reestrRows = [];
  let rowCounter = 1;
  let totalOrderli = 0;
  let totalPulli = 0;
  let totalTolangan = 0;
  let totalJami = 0;

  for (const p of matchedPatients) {
    let serviceDetails = null;
    try {
      if (forceFresh) {
        const cache = getPatientServicesCache();
        if (p.Id && cache[p.Id]) {
          delete cache[p.Id];
        }
      }
      serviceDetails = await fetchPatientServicesFromKarmed(p);
    } catch (e) {
      console.warn(`[Custom Reestr] Xizmatlarni yuklashda xatolik (${p.AdSoyad}):`, e.message);
    }

    const kurumAdi = String(p.KurumAdi || p.SosyalGuvence || '').trim();
    const isOrder = kurumAdi.toLowerCase().includes('order') || kurumAdi.toLowerCase().includes('vaqf') || kurumAdi.toLowerCase().includes('imtiyoz');
    const isSugurta = kurumAdi.toLowerCase().includes("sug'urta") || kurumAdi.toLowerCase().includes('sugurta');
    const isNoRezident = kurumAdi.toLowerCase().includes('no rezident') || kurumAdi.toLowerCase().includes('norezident');
    const privilegeCategory = isNoRezident ? 'No Rezident' : (kurumAdi || (isOrder ? 'Orderli' : 'Rezident'));

    const services = (serviceDetails && serviceDetails.services && serviceDetails.services.length > 0)
      ? serviceDetails.services
      : [{
          id: p.Id,
          code: 'UTT',
          name: p.TetkikIsmi || p.AltBolumAdi || 'Ultratovush tekshiruvi',
          doctorName: p.KabulEden || p.DoktorAdi || '',
          referringDoctor: p.DosyaDoktoru || '',
          price: isNoRezident ? 254400 : (isOrder || isSugurta ? 155820 : 159000),
          debtStatus: p.Durum === 'Rapor Onaylı' ? "To'langan" : "To'lanmagan"
        }];

    for (const s of services) {
      const priceVal = s.price || (isNoRezident ? 254400 : (isOrder || isSugurta ? 155820 : 159000));
      const orderliVal = isOrder ? priceVal : 0;
      const pulliVal = isOrder ? 0 : priceVal;
      const isPaid = s.debtStatus === "To'langan" || (!isOrder && p.Durum === 'Rapor Onaylı') || (p.KabulTarihi && !isOrder);
      const tolanganVal = isOrder ? 0 : (isPaid ? priceVal : 0);
      const jamiVal = priceVal;

      totalOrderli += orderliVal;
      totalPulli += pulliVal;
      totalTolangan += tolanganVal;
      totalJami += jamiVal;

      const orderingDoc = s.referringDoctor || p.DosyaDoktoru || 'Laboratoriya va Radyologiya';
      const performingDoc = s.doctorName || p.KabulEden || p.DoktorAdi || 'Ultratovush Shifokori';
      const paymentMethod = isOrder ? 'Order / Imtiyoz' : (isSugurta ? "Sug'urta" : (p.Faturalandi ? 'Plastik karta' : 'Naqd'));

      reestrRows.push({
        rowIndex: rowCounter,
        orderNo: p.Id ? String(p.Id) : String(2600000 + rowCounter),
        id: String(p.ProtokolNo || p.TcKimlikNo || p.KimlikNo || ''),
        fullName: String(p.AdSoyad || `${p.Soyadi || ''} ${p.HastaAdi || ''}`).trim().toUpperCase(),
        patientType: p.ServisAdi || 'Ambulator',
        serviceCategory: 'Radiologiya',
        functionalDept: p.BolumuAdi || 'Ultratovush',
        serviceName: s.name || 'Ultratovush tekshiruvi',
        serviceCode: s.code || 'UTT',
        cardNo: String(p.KimlikNo || p.ProtokolNo || ''),
        cardType: p.OncelikAciklama || 'Ambulator',
        department: p.AltServisAdi || p.ServisAdi || 'Radiologiya',
        orderingDoctor: orderingDoc,
        performingDoctor: performingDoc,
        dateTime: formatKarmedDateTime(p.KayitTarihi || p.KabulTarihi),
        privilegeCategory: privilegeCategory,
        orderliUcret: orderliVal,
        orderliUcretFormatted: formatReestrMoney(orderliVal),
        pulliUcret: pulliVal,
        pulliUcretFormatted: formatReestrMoney(pulliVal),
        tolanganUcret: tolanganVal,
        tolanganUcretFormatted: formatReestrMoney(tolanganVal),
        jamiUcret: jamiVal,
        jamiUcretFormatted: formatReestrMoney(jamiVal),
        paymentMethod: paymentMethod,
        paymentDate: formatKarmedDateTime(p.KabulTarihi || p.KayitTarihi),
        status: p.Durum || 'Bajarildi'
      });

      rowCounter++;
    }
  }

  return {
    success: true,
    totalRequestedIds: idList.length,
    foundIdsCount: foundIdSet.size,
    missingIds: idList.filter(id => !foundIdSet.has(id)),
    totalRecords: reestrRows.length,
    summary: {
      totalOrderli,
      totalOrderliFormatted: formatReestrMoney(totalOrderli),
      totalPulli,
      totalPulliFormatted: formatReestrMoney(totalPulli),
      totalTolangan,
      totalTolanganFormatted: formatReestrMoney(totalTolangan),
      totalJami,
      totalJamiFormatted: formatReestrMoney(totalJami),
      startDate,
      endDate,
      generatedAt: new Date().toISOString()
    },
    rows: reestrRows
  };
}

// Google Sheets (21 ustunli) formatidagi CSV (Excel UTF-8 BOM) eksport generatori
function generateGoogleSheetCsvExport(rows) {
  const BOM = '\uFEFF';
  const headers = [
    '№', 'ID', 'Ism va familiya', 'Тип', 'Xizmat Turi', 'Funktsional xizmat bolimi',
    'Услуга', '№ Карта', 'Тип Карта', 'Отделения', 'Лечащий врач', 'dr_uygulayan',
    'Время_tarihi', 'Категория лыгот', 'Orderli_Ucret', 'Pulli_Ucret', 'Tolangan_ucret',
    'Jami_ucret_toplam', 'Форма оплаты', 'Tolov Sana Tarihi', 'Holati'
  ];

  let csv = BOM + headers.join(';') + '\n';

  (rows || []).forEach((r, idx) => {
    const row = [
      idx + 1,
      `"${r.id || ''}"`,
      `"${(r.fullName || '').replace(/"/g, '""')}"`,
      `"${r.patientType || ''}"`,
      `"${r.serviceCategory || 'Radiologiya'}"`,
      `"${r.functionalDept || 'Ultratovush'}"`,
      `"${(r.serviceName || '').replace(/"/g, '""')}"`,
      `"${r.cardNo || ''}"`,
      `"${r.cardType || 'Ambulator'}"`,
      `"${(r.department || '').replace(/"/g, '""')}"`,
      `"${(r.orderingDoctor || '').replace(/"/g, '""')}"`,
      `"${(r.performingDoctor || '').replace(/"/g, '""')}"`,
      `"${r.dateTime || ''}"`,
      `"${r.privilegeCategory || 'Rezident'}"`,
      `"${r.orderliUcretFormatted || '0,00'}"`,
      `"${r.pulliUcretFormatted || '0,00'}"`,
      `"${r.tolanganUcretFormatted || '0,00'}"`,
      `"${r.jamiUcretFormatted || '0,00'}"`,
      `"${r.paymentMethod || 'Naqd'}"`,
      `"${r.paymentDate || ''}"`,
      `"${r.status || 'Bajarildi'}"`
    ];
    csv += row.join(';') + '\n';
  });

  return csv;
}

module.exports = {
  getAdminAnalytics,
  getPriceCatalog,
  generateCsvExport,
  processAnalytics,
  fetchPatientServicesFromKarmed,
  getPatientServicesCache,
  savePatientServicesCache,
  queryKarmedAnalyticsDirect,
  sanitizeDateStr,
  splitDateRangeIntoMonthlyChunks,
  calculateCustomReestrByIds,
  queryKarmedSinglePatientDirect,
  generateGoogleSheetCsvExport
};

