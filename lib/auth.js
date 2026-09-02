/**
 * Tibbiyot / MRT & UTT - Autentifikatsiya va Foydalanuvchilar Boshqaruvi (lib/auth.js)
 * Barcha darchalar uchun xavfsiz login/parol tizimi.
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
    name: "Tizim Administratori",
    password: "admin",
    role: "admin",
    status: "active",
    createdAt: "2026-09-02"
  },
  {
    login: "TB1",
    name: "Turatov Hojiakbar",
    password: "15420",
    role: "operator",
    status: "active",
    createdAt: "2026-09-02"
  },
  {
    login: "TB2",
    name: "Saida'loxon Saidaxmadxonov",
    password: "15420",
    role: "operator",
    status: "active",
    createdAt: "2026-09-02"
  },
  {
    login: "TB3",
    name: "Isfandiyor Xaydaraliyev",
    password: "15420",
    role: "operator",
    status: "active",
    createdAt: "2026-09-02"
  },
  {
    login: "vrach1",
    name: "Navbatchi Vrach MRT",
    password: "123",
    role: "doctor",
    status: "active",
    createdAt: "2026-09-02"
  },
  {
    login: "laborant1",
    name: "MRT 1 Laboranti",
    password: "123",
    role: "laborant",
    status: "active",
    createdAt: "2026-09-02"
  },
  {
    login: "laborant2",
    name: "MRT 2 Laboranti",
    password: "123",
    role: "laborant",
    status: "active",
    createdAt: "2026-09-02"
  }
];

class AuthManager {
  constructor() {
    this.users = [];
    this.sessions = new Map(); // token -> sessionData
    this.init();
  }

  init() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // Foydalanuvchilarni o'qish
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

    // Sessiyalarni o'qish
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

    const user = this.users.find(u => 
      u.login.toLowerCase() === String(login).trim().toLowerCase() && 
      u.password === String(password).trim()
    );

    if (!user) {
      return { success: false, error: "Login yoki parol noto'g'ri!" };
    }

    if (user.status !== 'active') {
      return { success: false, error: "Foydalanuvchi hisobi faol emas!" };
    }

    // Token yaratish
    const token = `tok_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    const sessionData = {
      token: token,
      user: {
        login: user.login,
        name: user.name,
        role: user.role
      },
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 kun
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

    // Muddatni tekshirish
    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(token);
      this.saveSessions();
      return null;
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

  getUsers() {
    return this.users.map(({ password, ...rest }) => rest);
  }

  addUser(userData) {
    if (!userData.login || !userData.password) {
      throw new Error("Login va parol talab qilinadi");
    }

    if (this.users.some(u => u.login.toLowerCase() === userData.login.toLowerCase())) {
      throw new Error("Bunday login allaqachon mavjud");
    }

    const newUser = {
      login: userData.login.trim(),
      name: userData.name || userData.login,
      password: userData.password.trim(),
      role: userData.role || "operator",
      status: "active",
      createdAt: new Date().toISOString().split('T')[0]
    };

    this.users.push(newUser);
    this.saveUsers();
    return { login: newUser.login, name: newUser.name, role: newUser.role };
  }

  updateUser(login, updates) {
    const user = this.users.find(u => u.login.toLowerCase() === login.toLowerCase());
    if (!user) throw new Error("Foydalanuvchi topilmadi");

    if (updates.name) user.name = updates.name;
    if (updates.password) user.password = updates.password;
    if (updates.role) user.role = updates.role;
    if (updates.status) user.status = updates.status;

    this.saveUsers();
    return { login: user.login, name: user.name, role: user.role, status: user.status };
  }
}

const authInstance = new AuthManager();
module.exports = authInstance;
