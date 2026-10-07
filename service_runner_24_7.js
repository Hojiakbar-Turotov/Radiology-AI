/**
 * ==============================================================================
 *  🏥 RADIOLOGY AI & UTT — 24/7 MASTER SERVICE RUNNER & WATCHDOG
 * ==============================================================================
 *  Ushbu skript kompyuter yoniq bo'lgan vaqtda barcha server va agentlarni
 *  24/7 uzluksiz rejimda ushlab turadi:
 * 
 *  1. mrt_server.js        (Port 9890 - MRT & MSKT Admin, Smart Slot, TV)
 *  2. mrt_reg_server.js    (Port 9891 - MRT Registratura Portali)
 *  3. logger_server.js     (Port 9876-9883 - UTT Navbat & Asosiy Logger)
 *  4. mrt_monitor_agent.js (24/7 Tizim Monitoringi va Diagnostika)
 *  5. bot-runner.js        (@Radiodiagnostika_bot Telegram boti)
 * 
 *  - Agar biron bir xizmat kutilmaganda to'xtasa yoki xatolik bilan qulasa,
 *    uni darhol (2 soniya ichida) qayta ishga tushiradi (Auto-restart).
 *  - Kompyuter o'chganda tabiiy ravishda o'chadi.
 *  - Kompyuter yoqilganda (Windows yuklanganda) avtomatik ishga tushadi.
 * ==============================================================================
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = __dirname;
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const RUNNER_LOG = path.join(LOGS_DIR, 'service_runner_24_7.log');

if (!fs.existsSync(LOGS_DIR)) {
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch (e) {}
}

function writeRunnerLog(msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  try {
    fs.appendFileSync(RUNNER_LOG, line, 'utf8');
  } catch (e) {}
  console.log(`[${new Date().toLocaleTimeString('uz-UZ')}] ${msg}`);
}

const SERVICES = [
  {
    id: 'mrt_server',
    name: 'MRT/MSKT Asosiy Server (Port 9890)',
    script: 'mrt_server.js',
    ports: [9890],
    restartDelayMs: 2000
  },
  {
    id: 'mrt_reg_server',
    name: 'MRT/MSKT Registratura Portali (Port 9891)',
    script: 'mrt_reg_server.js',
    ports: [9891],
    restartDelayMs: 2000
  },
  {
    id: 'logger_server',
    name: 'UTT Navbat & Logger Server (Port 9876-9883)',
    script: 'logger_server.js',
    ports: [9876, 9877, 9878, 9879, 9880],
    restartDelayMs: 2500
  },
  {
    id: 'mrt_monitor_agent',
    name: '24/7 Tizim Monitoring Agenti',
    script: 'mrt_monitor_agent.js',
    ports: [],
    restartDelayMs: 3000
  },
  {
    id: 'bot_runner',
    name: 'Telegram Bot Agenti (@Radiodiagnostika_bot)',
    script: 'bot-runner.js',
    ports: [],
    restartDelayMs: 4000
  }
];

const processes = new Map();
let isShuttingDown = false;

// 1. Portlarni band qilgan eski qotib qolgan jarayonlarni tozalash
function killStalePortProcesses(ports) {
  for (const port of ports) {
    try {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = out.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && parseInt(pid, 10) > 0 && parseInt(pid, 10) !== process.pid) {
          writeRunnerLog(`[Port Cleanup] Port ${port} band bo'lgan (PID: ${pid}). Tozalanmoqda...`);
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
}

// 2. Xizmatni ishga tushirish
function startService(svc) {
  if (isShuttingDown) return;

  if (svc.ports && svc.ports.length > 0) {
    killStalePortProcesses(svc.ports);
  }

  writeRunnerLog(`🚀 Ishga tushirilmoqda: ${svc.name} (${svc.script})...`);

  const nodeExe = path.join(ROOT_DIR, 'node.exe');
  const executable = fs.existsSync(nodeExe) ? nodeExe : 'node';

  const child = spawn(executable, [path.join(ROOT_DIR, svc.script)], {
    cwd: ROOT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, NODE_ENV: 'production' }
  });

  const procInfo = {
    svc,
    child,
    pid: child.pid,
    startedAt: Date.now(),
    crashCount: (processes.get(svc.id)?.crashCount || 0)
  };

  processes.set(svc.id, procInfo);
  writeRunnerLog(`✅ [PID: ${child.pid}] ${svc.name} faol holatga o'tdi.`);

  // Loglarni yo'naltirish
  const logFile = path.join(LOGS_DIR, `${svc.id}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });

  child.stdout.on('data', chunk => {
    try { logStream.write(chunk); } catch (e) {}
  });

  child.stderr.on('data', chunk => {
    try { logStream.write(chunk); } catch (e) {}
  });

  // To'xtash hodisasi
  child.on('exit', (code, signal) => {
    if (isShuttingDown) return;

    writeRunnerLog(`⚠️ [Jarayon to'xtadi] ${svc.name} (PID: ${child.pid}) chiqdi (Kod: ${code}, Signal: ${signal}).`);

    // Agar 5 soniya ichida tez-tez qulasa, kutiladi (crash loop protection)
    const uptime = Date.now() - procInfo.startedAt;
    let delay = svc.restartDelayMs;

    if (uptime < 5000) {
      procInfo.crashCount++;
      if (procInfo.crashCount > 3) {
        delay = 10000;
        writeRunnerLog(`⏳ [Crash Loop Himoyasi] ${svc.name} tez-tez to'xtamoqda. Keyingi urinish ${delay/1000}s dan keyin.`);
      }
    } else {
      procInfo.crashCount = 0;
    }

    setTimeout(() => {
      if (!isShuttingDown) {
        startService(svc);
      }
    }, delay);
  });

  child.on('error', (err) => {
    writeRunnerLog(`❌ [Xatolik] ${svc.name} ishga tushirishda xatolik: ${err.message}`);
  });
}

// Barcha xizmatlarni ishga tushirish
function startAllServices() {
  writeRunnerLog('================================================================================');
  writeRunnerLog('  🏥 RADIOLOGY AI & UTT — 24/7 MASTER WATCHDOG ISHGA TUSHDI');
  writeRunnerLog(`  Katalog: ${ROOT_DIR}`);
  writeRunnerLog(`  Xizmatlar soni: ${SERVICES.length} ta`);
  writeRunnerLog('================================================================================');

  for (const svc of SERVICES) {
    startService(svc);
  }
}

// Toza to'xtatish
function stopAllServices() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  writeRunnerLog('🛑 Master Watchdog to\'xtatilmoqda. Barcha xizmatlar to\'xtatiladi...');

  for (const [id, procInfo] of processes.entries()) {
    try {
      if (procInfo.child && !procInfo.child.killed) {
        writeRunnerLog(`To'xtatilmoqda: ${procInfo.svc.name} (PID: ${procInfo.child.pid})`);
        procInfo.child.kill('SIGTERM');
        try { execSync(`taskkill /F /PID ${procInfo.child.pid}`, { stdio: 'ignore' }); } catch (e) {}
      }
    } catch (e) {}
  }
  writeRunnerLog('✅ Barcha jarayonlar toza to\'xtatildi.');
  process.exit(0);
}

process.on('SIGINT', stopAllServices);
process.on('SIGTERM', stopAllServices);

startAllServices();
