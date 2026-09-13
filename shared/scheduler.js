const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCHEDULES_FILE = path.join(DATA_DIR, 'schedules.json');

function timeToMin(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return NaN;
  const [h, m] = timeStr.trim().split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

function minToTime(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function readJson(file, defaultVal) {
  try {
    if (!fs.existsSync(file)) return defaultVal;
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return defaultVal;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Returns schedule object for a specific date and device
 */
function getScheduleForDate(dateStr, deviceId) {
  const schedules = readJson(SCHEDULES_FILE, {
    activeMode: 'custom',
    weeklySchedule: {},
    deviceOverrides: {},
    dateOverrides: {},
    holidays: []
  });

  if (!dateStr) {
    return { isOpen: false, reason: "Sana ko'rsatilmadi", intervals: [] };
  }

  // 1. Check holidays
  if (Array.isArray(schedules.holidays)) {
    const holiday = schedules.holidays.find(h => h.date === dateStr);
    if (holiday) {
      return { isOpen: false, reason: `Bayram kuni: ${holiday.name}`, intervals: [] };
    }
  }

  // 2. Check date overrides (specific date custom schedule)
  if (schedules.dateOverrides && schedules.dateOverrides[dateStr]) {
    const override = schedules.dateOverrides[dateStr];
    return {
      isOpen: Boolean(override.isOpen),
      reason: override.reason || (override.isOpen ? '' : "Maxsus dam olish kuni"),
      intervals: Array.isArray(override.intervals) ? override.intervals : []
    };
  }

  // 3. Determine day of week
  const dateObj = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = String(dateObj.getDay()); // '0' for Sunday, '1' for Monday ...

  // 4. Check device overrides if any
  if (deviceId && schedules.deviceOverrides && schedules.deviceOverrides[deviceId]) {
    const devSched = schedules.deviceOverrides[deviceId];
    const devWeekly = devSched.weeklySchedule || devSched;
    if (devWeekly && devWeekly[dayOfWeek]) {
      const item = devWeekly[dayOfWeek];
      return {
        isOpen: Boolean(item.isOpen),
        reason: item.isOpen ? '' : (item.dayName ? `${item.dayName} — dam olish kuni` : "Dam olish kuni"),
        dayName: item.dayName,
        intervals: Array.isArray(item.intervals) ? item.intervals : []
      };
    }
  }

  // 5. Check weekly schedule
  if (schedules.weeklySchedule && schedules.weeklySchedule[dayOfWeek]) {
    const item = schedules.weeklySchedule[dayOfWeek];
    return {
      isOpen: Boolean(item.isOpen),
      reason: item.isOpen ? '' : (item.dayName ? `${item.dayName} — dam olish kuni` : "Dam olish kuni"),
      dayName: item.dayName,
      intervals: Array.isArray(item.intervals) ? item.intervals : []
    };
  }

  // 6. Default: if not configured at all, do NOT give appointments
  return { isOpen: false, reason: "Ushbu kunda ish grafigi kiritilmagan", intervals: [] };
}

/**
 * Validates a proposed booking against work shifts and collisions with existing bookings
 */
function validateBookingSlot(dateStr, timeStr, durationMinutes, deviceId, queue, excludePatientId) {
  const sched = getScheduleForDate(dateStr, deviceId);
  if (!sched.isOpen) {
    return {
      valid: false,
      error: `Ushbu kunda ish rejimi mavjud emas (${sched.reason || 'Dam olish kuni'})!`
    };
  }

  const sMin = timeToMin(timeStr);
  const dur = parseInt(durationMinutes || 30, 10);
  if (isNaN(sMin)) {
    return { valid: false, error: "Vaqt formati noto'g'ri (HH:MM bo'lishi kerak)!" };
  }
  const fMin = sMin + dur;

  // Check if [sMin, fMin] is fully inside at least ONE work shift interval
  const fitsShift = sched.intervals.some(inv => {
    const startM = timeToMin(inv.start);
    const endM = timeToMin(inv.end);
    return sMin >= startM && fMin <= endM;
  });

  if (!fitsShift) {
    const shiftList = sched.intervals.map(i => `${i.start} - ${i.end}`).join(' va ');
    return {
      valid: false,
      error: `Belgilangan vaqt (${timeStr} - ${minToTime(fMin)}) ish vaqti smenasiga to'g'ri kelmaydi! Bugungi ish intervallari: ${shiftList || 'Mavjud emas'}.`
    };
  }

  // Check collisions with active patients on this device and date
  const activePatients = (queue || []).filter(p => 
    (p.date === dateStr || p.scheduledDate === dateStr) &&
    p.deviceId === deviceId &&
    p.status !== 'cancelled' &&
    (!excludePatientId || p.id !== excludePatientId)
  );

  for (const p of activePatients) {
    const pStart = timeToMin(p.scheduledTime);
    const pDur = parseInt(p.estimatedDurationMinutes || p.durationMinutes || 30, 10);
    if (!isNaN(pStart)) {
      const pEnd = pStart + pDur;
      // Overlap condition:
      if (Math.max(sMin, pStart) < Math.min(fMin, pEnd)) {
        return {
          valid: false,
          error: `Ushbu vaqt oralig'i (${timeStr} - ${minToTime(fMin)}) band! Bu vaqtda boshqa bemor yozilgan: Talon № ${p.ticketNumber} (${p.patientName}, ${p.scheduledTime} - ${minToTime(pEnd)}). Iltimos, boshqa bo'sh vaqtni tanlang.`
        };
      }
    }
  }

  return {
    valid: true,
    startTime: timeStr,
    finishTime: minToTime(fMin),
    durationMinutes: dur,
    schedule: sched
  };
}

/**
 * Returns complete status for a date and device:
 * - isOpen
 * - intervals
 * - busySlots
 * - availableSlots
 * - recommendedSlot
 */
function getAvailableSlotsForDay(dateStr, deviceId, durationMinutes, queue) {
  const sched = getScheduleForDate(dateStr, deviceId);
  const dur = parseInt(durationMinutes || 30, 10);

  if (!sched.isOpen) {
    return {
      success: true,
      isOpen: false,
      reason: sched.reason,
      intervals: [],
      busySlots: [],
      availableSlots: [],
      recommendedSlot: null
    };
  }

  const activePatients = (queue || []).filter(p => 
    (p.date === dateStr || p.scheduledDate === dateStr) &&
    p.deviceId === deviceId &&
    p.status !== 'cancelled'
  );

  const busySlots = [];
  activePatients.forEach(p => {
    const pStart = timeToMin(p.scheduledTime);
    const pDur = parseInt(p.estimatedDurationMinutes || p.durationMinutes || 30, 10);
    if (!isNaN(pStart)) {
      busySlots.push({
        ticketNumber: p.ticketNumber,
        patientName: p.patientName,
        serviceName: p.primaryService || p.serviceName || '',
        startMin: pStart,
        endMin: pStart + pDur,
        startTime: minToTime(pStart),
        finishTime: minToTime(pStart + pDur)
      });
    }
  });
  busySlots.sort((a, b) => a.startMin - b.startMin);

  // Check if today
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const isToday = (dateStr === todayStr);
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const availableSlots = [];
  const availableSlotsDetailed = [];

  sched.intervals.forEach(inv => {
    const shiftStart = timeToMin(inv.start);
    const shiftEnd = timeToMin(inv.end);

    for (let candidate = shiftStart; candidate + dur <= shiftEnd; candidate += 5) {
      if (isToday && candidate < currentMin + 5) {
        continue; // In the past
      }
      const cEnd = candidate + dur;
      const collides = busySlots.some(b => Math.max(candidate, b.startMin) < Math.min(cEnd, b.endMin));
      if (!collides) {
        const sTime = minToTime(candidate);
        const fTime = minToTime(cEnd);
        availableSlots.push(sTime);
        availableSlotsDetailed.push({
          startTime: sTime,
          finishTime: fTime,
          duration: dur,
          timeSlot: `${sTime} - ${fTime}`,
          label: `${sTime} – ${fTime} (${dur} daq)`
        });
      }
    }
  });

  return {
    success: true,
    isOpen: true,
    dayName: sched.dayName,
    reason: '',
    durationMinutes: dur,
    intervals: sched.intervals,
    busySlots: busySlots.map(b => ({
      ticketNumber: b.ticketNumber,
      patientName: b.patientName,
      serviceName: b.serviceName,
      timeSlot: `${b.startTime} - ${b.finishTime}`,
      startTime: b.startTime,
      finishTime: b.finishTime
    })),
    availableSlots: availableSlots,
    availableSlotsDetailed: availableSlotsDetailed,
    recommendedSlot: availableSlots.length > 0 ? availableSlots[0] : null,
    recommendedFinishTime: availableSlots.length > 0 ? minToTime(timeToMin(availableSlots[0]) + dur) : null
  };
}

/**
 * Find next genuinely free slot across upcoming days
 */
function findNextAvailableSmartSlot(input, queue) {
  let deviceId = input.deviceId;
  const isContrast = Boolean(input.isContrast);
  const deviceType = input.deviceType || (input.serviceName && input.serviceName.toLowerCase().includes('mskt') ? 'MSKT' : 'MRT');

  if (!deviceId || deviceId === 'auto') {
    if (deviceType === 'MSKT') {
      deviceId = 'mskt1';
    } else {
      deviceId = isContrast ? 'mrt1' : 'mrt2';
    }
  }

  let duration = parseInt(input.durationMinutes || 30, 10);
  if (!input.durationMinutes) {
    if (isContrast && duration < 35) duration = 40;
    if (deviceType === 'MSKT' && duration > 25) duration = 20;
  }

  const now = new Date();
  const maxSearchDays = 30;

  if (input.scheduledDate) {
    // Specific date requested
    const dayData = getAvailableSlotsForDay(input.scheduledDate, deviceId, duration, queue);
    if (dayData.isOpen && dayData.availableSlots.length > 0) {
      const startTime = dayData.recommendedSlot;
      const sMin = timeToMin(startTime);
      return {
        success: true,
        date: input.scheduledDate,
        startTime: startTime,
        finishTime: minToTime(sMin + duration),
        durationMinutes: duration,
        deviceId: deviceId,
        availableSlots: dayData.availableSlots
      };
    } else {
      return {
        success: false,
        message: dayData.isOpen ? "Ushbu kunda barcha vaqtlar band!" : `Ushbu kunda ish rejimi yo'q (${dayData.reason})!`
      };
    }
  }

  // Iterate upcoming days starting today
  for (let offset = 0; offset < maxSearchDays; offset++) {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const dayData = getAvailableSlotsForDay(dateStr, deviceId, duration, queue);
    if (dayData.isOpen && dayData.availableSlots.length > 0) {
      const startTime = dayData.recommendedSlot;
      const sMin = timeToMin(startTime);
      return {
        success: true,
        date: dateStr,
        startTime: startTime,
        finishTime: minToTime(sMin + duration),
        durationMinutes: duration,
        deviceId: deviceId,
        availableSlots: dayData.availableSlots
      };
    }
  }

  return { success: false, message: "Yaqin 30 kun ichida bo'sh vaqt topilmadi" };
}

module.exports = {
  timeToMin,
  minToTime,
  getScheduleForDate,
  validateBookingSlot,
  getAvailableSlotsForDay,
  findNextAvailableSmartSlot,
  SCHEDULES_FILE
};
