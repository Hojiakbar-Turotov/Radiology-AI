/**
 * ==============================================================================
 *  🌐 MRT & MSKT ADMIN CLOUDFLARE TUNNEL & GITHUB BROKER AGENT
 * ==============================================================================
 *  - Faqat Admin Server (Port 9890) uchun HTTPS Cloudflare Tunnel ochadi.
 *  - Olingan jonli HTTPS manzilini tunnel_config.json ga yozadi.
 *  - data/bot_settings.json dagi WebApp havolasini yangilaydi.
 *  - Yangi tunnel manzilini avtomatik GitHub omboriga commit & push qiladi.
 *  - Registratura (Port 9891) bu yerga ulanmaydi (faqat LAN da ishlaydi).
 * ==============================================================================
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = __dirname;
const CLOUDFLARED_BIN = path.join(ROOT_DIR, 'cloudflared.exe');
const GIT_BIN = 'C:\\Program Files\\Git\\cmd\\git.exe';
const TUNNEL_CONFIG_FILE = path.join(ROOT_DIR, 'tunnel_config.json');
const BOT_SETTINGS_FILE = path.join(ROOT_DIR, 'data', 'bot_settings.json');
const TUNNEL_STATUS_FILE = path.join(ROOT_DIR, 'data', 'tunnel_status.json');
const MANZIL_FILE = path.join(ROOT_DIR, 'ONLINE_MANZILLAR.txt');

let activeTunnelProcess = null;
let currentTunnelUrl = null;
let isPushing = false;
let pushDebounceTimer = null;

function getGitExecutable() {
  if (fs.existsSync(GIT_BIN)) return `"${GIT_BIN}"`;
  return 'git';
}

function updateConfigFiles(tunnelUrl) {
  currentTunnelUrl = tunnelUrl;
  const now = new Date().toISOString();

  // 1. tunnel_config.json
  let config = {};
  try {
    if (fs.existsSync(TUNNEL_CONFIG_FILE)) {
      config = JSON.parse(fs.readFileSync(TUNNEL_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {}

  config.version = "7.3.0";
  config.updatedAt = now;
  config.mrt_mskt = config.mrt_mskt || {};
  config.mrt_mskt.localControlUrl = "http://10.34.14.33:9890/control";
  config.mrt_mskt.onlineControlUrl = `${tunnelUrl}/control`;
  config.mrt_mskt.onlineApiUrl = tunnelUrl;
  config.mrt_mskt.telegramBot = "@Radiodiagnostika_bot";

  fs.writeFileSync(TUNNEL_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  try {
    fs.writeFileSync(path.join(ROOT_DIR, 'docs', 'tunnel_config.json'), JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {}

  // 2. data/bot_settings.json
  let botSettings = { webAppUrl: `${tunnelUrl}/control`, adminPassword: "15420" };
  try {
    if (fs.existsSync(BOT_SETTINGS_FILE)) {
      botSettings = JSON.parse(fs.readFileSync(BOT_SETTINGS_FILE, 'utf8'));
    }
  } catch (e) {}
  botSettings.webAppUrl = `${tunnelUrl}/control`;
  if (!botSettings.adminPassword) botSettings.adminPassword = "15420";
  fs.writeFileSync(BOT_SETTINGS_FILE, JSON.stringify(botSettings, null, 2), 'utf8');

  // 3. data/tunnel_status.json
  const status = {
    active: true,
    tunnelUrl: tunnelUrl,
    controlUrl: `${tunnelUrl}/control`,
    updatedAt: now,
    gitPushStatus: "pending"
  };
  fs.writeFileSync(TUNNEL_STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');

  // 4. ONLINE_MANZILLAR.txt
  const textContent = 
`===============================================================================
  🏥 RIO va RIOATM MRT & MSKT ADMIN PORTALI — JONLI CLOUDFLARE TUNNEL
  Yangilangan vaqt: ${new Date().toLocaleString()}
===============================================================================

📱 TELEGRAM WEB APP MANZILI (ADMIN):
   ${tunnelUrl}/control

💻 LOKAL TARMOQ MANZILLARI:
   • Admin Portali:       http://localhost:9890/control
   • Registratura (LAN):  http://localhost:9891
   • TV Tablo:            http://localhost:9890/tv

🌐 GITHUB TUNNEL BROKER:
   https://raw.githubusercontent.com/Hojiakbar-Turotov/Radiology-AI/main/tunnel_config.json

⚠️ DIQQAT: Registratura (9891) xavfsizlik nuqtai nazaridan faqat shifoxona
ichki lokal tarmog'ida ishlaydi, tashqi tunnel orqali kirish taqiqlangan!
===============================================================================
`;
  fs.writeFileSync(MANZIL_FILE, textContent, 'utf8');

  console.log(`[TUNNEL] ✅ Yangi Admin Tunnel: ${tunnelUrl}/control`);

  // GitHub ga push qilish
  triggerGitPush();
}

function triggerGitPush() {
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    if (isPushing) return;
    isPushing = true;
    console.log('[GIT-PUSH] 🚀 Tunnel manzili GitHub omboriga push qilinmoqda...');

    const git = getGitExecutable();
    const gitCmd = `${git} add tunnel_config.json docs/tunnel_config.json data/bot_settings.json && ${git} commit -m "chore: auto-update MRT Cloudflare tunnel URL" && ${git} push origin main`;

    exec(gitCmd, { cwd: ROOT_DIR }, (err, stdout, stderr) => {
      isPushing = false;
      let statusData = {};
      try {
        statusData = JSON.parse(fs.readFileSync(TUNNEL_STATUS_FILE, 'utf8'));
      } catch (e) {}

      if (err) {
        console.warn('[GIT-PUSH] ⚠️ Git push xatosi:', err.message);
        statusData.gitPushStatus = "error: " + err.message;
      } else {
        console.log('[GIT-PUSH] ✅ GitHub ombori muvaffaqiyatli yangilandi va push qilindi!');
        statusData.gitPushStatus = "success";
        statusData.lastPushedAt = new Date().toISOString();
      }
      try {
        fs.writeFileSync(TUNNEL_STATUS_FILE, JSON.stringify(statusData, null, 2), 'utf8');
      } catch (e) {}
    });
  }, 2000);
}

function startTunnel() {
  if (!fs.existsSync(CLOUDFLARED_BIN)) {
    console.error(`[TUNNEL] ❌ cloudflared.exe topilmadi: ${CLOUDFLARED_BIN}`);
    return;
  }

  console.log('[TUNNEL] ⚡ Cloudflare Tunnel ishga tushirilmoqda (Port 9890 -> Admin)...');
  const proc = spawn(CLOUDFLARED_BIN, ['tunnel', '--url', 'http://localhost:9890']);
  activeTunnelProcess = proc;

  proc.stderr.on('data', d => {
    const str = d.toString();
    const m = str.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (m && m[0] !== currentTunnelUrl) {
      updateConfigFiles(m[0]);
    }
  });

  proc.on('close', code => {
    console.warn(`[TUNNEL] ⚠️ Cloudflared jarayoni to'xtadi (kod: ${code}). 5 soniyada qayta boshlanadi...`);
    activeTunnelProcess = null;
    setTimeout(startTunnel, 5000);
  });

  proc.on('error', err => {
    console.error('[TUNNEL] ❌ Cloudflared ishga tushirishda xatolik:', err.message);
  });
}

function stopTunnel() {
  if (activeTunnelProcess) {
    activeTunnelProcess.kill();
    activeTunnelProcess = null;
  }
}

// Jarayon to'xtaganda tozalash
process.on('SIGINT', () => { stopTunnel(); process.exit(0); });
process.on('SIGTERM', () => { stopTunnel(); process.exit(0); });

// Ishga tushirish
startTunnel();

module.exports = {
  startTunnel,
  stopTunnel,
  getCurrentTunnelUrl: () => currentTunnelUrl,
  triggerGitPush
};
