/**
 * Tibbiyot / MRT & UTT - Autentifikatsiya va Foydalanuvchilar Boshqaruvi (lib/auth.js)
 * Rollar: tibbiy_navbat, laborant, super_admin, server_nazoratchisi
 * Barcha darchalar uchun xavfsiz seans va profil boshqaruvi.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

const DEFAULT_USERS = [
  {
    login: "admin",
    name: "Tizim Boshqaruvchisi",
    password: "admin",
    role: "server_nazoratchisi",
    status: "active",
    phone: "",
    room: "Server Xonasi",
    workSchedule: { start: "08:00", end: "18:00", lunchStart: "12:00", lunchEnd: "13:00", days: ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"] },
    preferences: { testDurations: { "MRT_ODDIY": 15, "MRT_KONTRAST": 25, "MSKT": 10 }, notes: "Asosiy server nazoratchisi" },
    createdAt: "2026-09-03"
  },
  { login: "T1", name: "Isfandiyor", password: "15420", role: "tibbiy_navbat", status: "active", room: "Registratura", createdAt: "2026-09-03" },
  { login: "T2", name: "A'loxon", password: "15420", role: "tibbiy_navbat", status: "active", room: "Registratura", createdAt: "2026-09-03" },
  { login: "T3", name: "Nigora", password: "15420", role: "tibbiy_navbat", status: "active", room: "Registratura", createdAt: "2026-09-03" },
  { login: "T4", name: "Hojiakbar", password: "15420", role: "server_nazoratchisi", status: "active", room: "Server & Radiologiya", createdAt: "2026-09-03" },
  { login: "L1", name: "Shoxruh", password: "15420", role: "super_admin", status: "active", room: "MRT 1 Xonasi", createdAt: "2026-09-03" },
  { login: "L2", name: "Dilmurod", password: "15420", role: "laborant", status: "active", room: "MRT 2 Xonasi", createdAt: "2026-09-03" },
  { login: "L3", name: "Miraziz", password: "15420", role: "laborant", status: "active", room: "MRT Xonasi", createdAt: "2026-09-03" },
  { login: "L4", name: "Aziz", password: "15420", role: "laborant", status: "active", room: "MRT Xonasi", createdAt: "2026-09-03" },
  { login: "L5", name: "Sardor", password: "15420", role: "laborant", status: "active", room: "MRT Xonasi", createdAt: "2026-09-03" },
  { login: "L6", name: "Shariat", password: "15420", role: "laborant", status: "active", room: "MRT Xonasi", createdAt: "2026-09-03" },
  { login: "L7", name: "Sevinch", password: "15420", role: "laborant", status: "active", room: "MRT Xonasi", createdAt: "2026-09-03" },
  { login: "L8", name: "Isfandiyor", password: "15420", role: "laborant", status: "active", room: "MRT Xonasi", createdAt: "2026-09-03" },
  { login: "L9", name: "Nodirbek", password: "15420", role: "super_admin", status: "active", room: "MRT Xonasi", createdAt: "2026-09-03" },
  { login: "L10", name: "Akbar", password: "15420", role: "laborant", status: "active", room: "MSKT Xonasi", createdAt: "2026-09-03" }
];

class AuthManager {
  constructor() {
    this.users = [];
    this.sessions = new Map(); // token -> sessionData
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    if (fs.existsSync(USERS_FILE)) {
      try {
        this.users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      } catch (e) {
        this.users = [...DEFAULT_USERS];
        this.saveUsers();
      }
    } else {
      this.users = [...DEFAULT_USERS];
      this.saveUsers();
    }

    if (fs.existsSync(SESSIONS_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
        for (const [token, data] of Object.entries(raw)) {
          this.sessions.set(token, data);
        }
      } catch (e) {
        this.sessions = new Map();
      }
    }
  }

  saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2), 'utf-8');
  }

  saveSessions() {
    const obj = {};
    for (const [token, data] of this.sessions.entries()) {
      obj[token] = data;
    }
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  }

  authenticate(login, password) {
    if (!login || !password) return { success: false, error: "Login va parol kiritilishi shart" };

    const cleanLogin = String(login).trim().toLowerCase();
    const cleanPwd = String(password).trim();

    const user = this.users.find(u => 
      u.login.toLowerCase() === cleanLogin && 
      u.password === cleanPwd
    );

    if (!user) {
      return { success: false, error: "Login yoki parol noto'g'ri!" };
    }

    if (user.status !== 'active') {
      return { success: false, error: "Ushbu xodim hisobi faol emas!" };
    }

    const token = `tok_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const sessionData = {
      token: token,
      user: this.sanitizeUser(user),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    this.sessions.set(token, sessionData);
    this.saveSessions();

    return {
      success: true,
      token: token,
      user: sessionData.user
    };
  }

  verifySession(token) {
    if (!token) return null;
    const session = this.sessions.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
    }

    // Doimiy yangilangan foydalanuvchi ma'lumotlarini olish
    const liveUser = this.users.find(u => u.login.toLowerCase() === session.user.login.toLowerCase());
    if (liveUser && liveUser.status === 'active') {
      const sanitized = this.sanitizeUser(liveUser);
      session.user = sanitized;
      return sanitized;
    }

    return session.user;
  }

  logout(token) {
    if (token && this.sessions.has(token)) {
      this.sessions.delete(token);
      this.saveSessions();
      return true;
    }
    return false;
  }

  sanitizeUser(user) {
    const { password, ...rest } = user;
    const ws = rest.workSchedule || {};
    const prefs = rest.preferences || {};
    return {
      login: rest.login,
      name: rest.name || rest.login,
      role: rest.role || "tibbiy_navbat",
      status: rest.status || "active",
      phone: rest.phone || "",
      room: rest.room || "",
      workSchedule: {
        start: ws.start || "08:00",
        end: ws.end || "17:00",
        lunchStart: ws.lunchStart || "12:00",
        lunchEnd: ws.lunchEnd || "13:00",
        days: Array.isArray(ws.days) ? ws.days : ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"],
        customDates: ws.customDates && typeof ws.customDates === 'object' ? ws.customDates : {},
        shiftPattern: ws.shiftPattern || "standard"
      },
      preferences: {
        testDurations: prefs.testDurations && typeof prefs.testDurations === 'object' ? prefs.testDurations : { "MRT_ODDIY": 15, "MRT_KONTRAST": 25, "MSKT": 10 },
        servicePreparations: prefs.servicePreparations && typeof prefs.servicePreparations === 'object' ? prefs.servicePreparations : {},
        serviceContraindications: prefs.serviceContraindications && typeof prefs.serviceContraindications === 'object' ? prefs.serviceContraindications : {},
        serviceConsentQuestions: prefs.serviceConsentQuestions && typeof prefs.serviceConsentQuestions === 'object' ? prefs.serviceConsentQuestions : {},
        notes: prefs.notes || ""
      },
      createdAt: rest.createdAt || "2026-09-03"
    };
  }

  getUser(login) {
    if (!login) return null;
    return this.users.find(u => u.login.toLowerCase() === login.toLowerCase()) || null;
  }

  // -------------------------------------------------------------
  // SHAXSIY PROFILNI YANGILASH (F.I.SH, Login, Parol, Ish vaqti, h.k.)
  // -------------------------------------------------------------
  updateProfile(currentLogin, updates) {
    const user = this.users.find(u => u.login.toLowerCase() === currentLogin.toLowerCase());
    if (!user) throw new Error("Foydalanuvchi hisobi topilmadi");

    // 1. Yangi login tekshiruvi (agar login o'zgarsa)
    if (updates.login && updates.login.trim().toLowerCase() !== user.login.toLowerCase()) {
      const newLogin = updates.login.trim();
      if (this.users.some(u => u.login.toLowerCase() === newLogin.toLowerCase())) {
        throw new Error(`'${newLogin}' logini allaqachon band. Boshqa login tanlang.`);
      }
      const oldLogin = user.login;
      user.login = newLogin;

      // Mavjud seanslarni yangi login bilan yangilash
      for (const [t, s] of this.sessions.entries()) {
        if (s.user && s.user.login.toLowerCase() === oldLogin.toLowerCase()) {
          s.user.login = newLogin;
        }
      }
    }

    // 2. F.I.SH (To'liq ism)
    if (updates.name && updates.name.trim()) {
      user.name = updates.name.trim();
    }

    // 3. Parolni yangilash
    if (updates.password && String(updates.password).trim().length > 0) {
      const newPwd = String(updates.password).trim();
      if (newPwd.length < 3) throw new Error("Parol kamida 3 ta belgidan iborat bo'lishi kerak");
      user.password = newPwd;
    }

    // 4. Qo'shimcha ma'lumotlar
    if (updates.phone !== undefined) user.phone = String(updates.phone).trim();
    if (updates.room !== undefined) user.room = String(updates.room).trim();

    // 5. Ish vaqtlari va taqvim
    if (updates.workSchedule && typeof updates.workSchedule === 'object') {
      const curWs = user.workSchedule || {};
      user.workSchedule = {
        start: updates.workSchedule.start || curWs.start || "08:00",
        end: updates.workSchedule.end || curWs.end || "17:00",
        lunchStart: updates.workSchedule.lunchStart || curWs.lunchStart || "12:00",
        lunchEnd: updates.workSchedule.lunchEnd || curWs.lunchEnd || "13:00",
        days: Array.isArray(updates.workSchedule.days) ? updates.workSchedule.days : (curWs.days || ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"]),
        customDates: updates.workSchedule.customDates !== undefined
          ? (typeof updates.workSchedule.customDates === 'object' && updates.workSchedule.customDates !== null ? { ...updates.workSchedule.customDates } : {})
          : (curWs.customDates || {}),
        shiftPattern: updates.workSchedule.shiftPattern || curWs.shiftPattern || "standard"
      };
    }

    // 6. Shaxsiy sozlamalar / tekshiruv vaqtlari / tayyorgarliklar
    if (updates.preferences && typeof updates.preferences === 'object') {
      const curPrefs = user.preferences || {};
      user.preferences = {
        ...curPrefs,
        ...updates.preferences,
        testDurations: {
          ...(curPrefs.testDurations || {}),
          ...(updates.preferences.testDurations || {})
        },
        servicePreparations: {
          ...(curPrefs.servicePreparations || {}),
          ...(updates.preferences.servicePreparations || {})
        },
        serviceContraindications: {
          ...(curPrefs.serviceContraindications || {}),
          ...(updates.preferences.serviceContraindications || {})
        },
        serviceConsentQuestions: {
          ...(curPrefs.serviceConsentQuestions || {}),
          ...(updates.preferences.serviceConsentQuestions || {})
        }
      };
    }

    this.saveUsers();
    this.saveSessions();

    return this.sanitizeUser(user);
  }

  // -------------------------------------------------------------
  // XODIMLAR RO'YXATINI OLISH (SUPER ADMIN VA SERVER NAZORATCHISI)
  // -------------------------------------------------------------
  getStaffList(requesterUser) {
    if (!requesterUser) throw new Error("Ruxsat berilmagan (Avtorizatsiya talab qilinadi)");

    const isSupervisor = requesterUser.role === 'server_nazoratchisi';
    const isSuperAdmin = requesterUser.role === 'super_admin';

    if (!isSupervisor && !isSuperAdmin) {
      throw new Error("Xodimlar ro'yxatini ko'rish uchun Super Admin yoki Server Nazoratchisi huquqi talab qilinadi");
    }

    return this.users.map(u => this.sanitizeUser(u));
  }

  // -------------------------------------------------------------
  // YANGI XODIMNI RO'YXATGA OLISH (CREATE STAFF)
  // -------------------------------------------------------------
  addStaff(requesterUser, staffData) {
    if (!requesterUser) throw new Error("Ruxsat berilmagan");

    const isSupervisor = requesterUser.role === 'server_nazoratchisi';
    const isSuperAdmin = requesterUser.role === 'super_admin';

    if (!isSupervisor && !isSuperAdmin) {
      throw new Error("Xodimlarni ro'yxatga olish huquqingiz yo'q");
    }

    if (!staffData.login || !staffData.password) {
      throw new Error("Login va parol kiritilishi shart");
    }

    const cleanLogin = staffData.login.trim();
    if (this.users.some(u => u.login.toLowerCase() === cleanLogin.toLowerCase())) {
      throw new Error(`'${cleanLogin}' logini allaqachon mavjud!`);
    }

    let targetRole = staffData.role || "tibbiy_navbat";

    // Super Admin faqat tibbiy_navbat yoki laborant yarata oladi (Admin yarata olmaydi)
    if (isSuperAdmin && !isSupervisor) {
      if (targetRole === 'super_admin' || targetRole === 'server_nazoratchisi') {
        throw new Error("Super Admin faqat 'tibbiy_navbat' yoki 'laborant' xodimlarini qo'sha oladi! Admin tayinlash uchun Server Nazoratchisiga murojaat qiling.");
      }
    }

    const newUser = {
      login: cleanLogin,
      name: staffData.name ? staffData.name.trim() : cleanLogin,
      password: String(staffData.password).trim(),
      role: targetRole,
      status: staffData.status || "active",
      phone: staffData.phone ? String(staffData.phone).trim() : "",
      room: staffData.room ? String(staffData.room).trim() : "",
      workSchedule: staffData.workSchedule || {
        start: "08:00",
        end: "17:00",
        lunchStart: "12:00",
        lunchEnd: "13:00",
        days: ["Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"]
      },
      preferences: staffData.preferences || {
        testDurations: { "MRT_ODDIY": 15, "MRT_KONTRAST": 25, "MSKT": 10 },
        notes: ""
      },
      createdAt: new Date().toISOString().split('T')[0]
    };

    this.users.push(newUser);
    this.saveUsers();

    return this.sanitizeUser(newUser);
  }

  // -------------------------------------------------------------
  // XODIM PAROLINI TIKLASH (RESET PASSWORD)
  // -------------------------------------------------------------
  resetPassword(requesterUser, targetLogin, newPassword) {
    if (!requesterUser) throw new Error("Ruxsat berilmagan");

    const isSupervisor = requesterUser.role === 'server_nazoratchisi';
    const isSuperAdmin = requesterUser.role === 'super_admin';

    if (!isSupervisor && !isSuperAdmin) {
      throw new Error("Parolni tiklash uchun yetarli huquq yo'q");
    }

    const user = this.users.find(u => u.login.toLowerCase() === targetLogin.toLowerCase());
    if (!user) throw new Error("Xodim topilmadi");

    // Super Admin boshqa Admin yoki Server Nazoratchisi parolini tiklay olmaydi
    if (isSuperAdmin && !isSupervisor) {
      if (user.role === 'super_admin' || user.role === 'server_nazoratchisi') {
        throw new Error("Super Admin boshqa adminlar parolini tiklay olmaydi! Buni faqat Server Nazoratchisi qila oladi.");
      }
    }

    if (!newPassword || String(newPassword).trim().length < 3) {
      throw new Error("Yangi parol kamida 3 ta belgidan iborat bo'lishi kerak");
    }

    user.password = String(newPassword).trim();
    this.saveUsers();

    // Xodimning eski sessiyalarini o'chirish (qayta kirishi uchun)
    for (const [t, s] of this.sessions.entries()) {
      if (s.user && s.user.login.toLowerCase() === targetLogin.toLowerCase()) {
        this.sessions.delete(t);
      }
    }
    this.saveSessions();

    return { success: true, login: user.login, message: "Parol muvaffaqiyatli tiklandi" };
  }

  // -------------------------------------------------------------
  // XODIM ROLI VA MA'LUMOTLARINI O'ZGARTIRISH (UPDATE STAFF)
  // -------------------------------------------------------------
  updateStaff(requesterUser, targetLogin, updates) {
    if (!requesterUser) throw new Error("Ruxsat berilmagan");

    const isSupervisor = requesterUser.role === 'server_nazoratchisi';
    const isSuperAdmin = requesterUser.role === 'super_admin';

    if (!isSupervisor && !isSuperAdmin) {
      throw new Error("Xodim ma'lumotlarini tahrirlash huquqingiz yo'q");
    }

    const user = this.users.find(u => u.login.toLowerCase() === targetLogin.toLowerCase());
    if (!user) throw new Error("Xodim topilmadi");

    // Super Admin tekshiruvlari
    if (isSuperAdmin && !isSupervisor) {
      if (user.role === 'super_admin' || user.role === 'server_nazoratchisi') {
        throw new Error("Super Admin boshqa admin ma'lumotlarini o'zgartira olmaydi");
      }
      if (updates.role && (updates.role === 'super_admin' || updates.role === 'server_nazoratchisi')) {
        throw new Error("Super Admin yangi admin tayinlay olmaydi! Faqat 'tibbiy_navbat' yoki 'laborant' roliga ruxsat berilgan.");
      }
    }

    if (updates.name) user.name = updates.name.trim();
    if (updates.role) user.role = updates.role;
    if (updates.status) user.status = updates.status;
    if (updates.phone !== undefined) user.phone = String(updates.phone).trim();
    if (updates.room !== undefined) user.room = String(updates.room).trim();

    this.saveUsers();
    return this.sanitizeUser(user);
  }
}

const authInstance = new AuthManager();
module.exports = authInstance;
