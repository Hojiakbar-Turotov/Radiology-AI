/**
 * ==============================================================================
 *  🩺 RADIOLOGY AI — SYSTEM MONITORING & DIAGNOSTICS ENGINE
 * ==============================================================================
 *  Barcha MRT, MSKT, Registratura, Cloudflare Tunnel va Telegram Bot
 *  xizmatlarini uzluksiz nazorat qiluvchi, xatoliklarni qayd etuvchi
 *  va tahlil qiluvchi asosiy monitoring moduli.
 * ==============================================================================
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT_DIR = path.resolve(__dirname, '..');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const MONITOR_LOG_FILE = path.join(LOGS_DIR, 'system_monitor.log');
const HEALTH_FILE = path.join(DATA_DIR, 'system_health.json');
const EVENTS_FILE = path.join(DATA_DIR, 'monitoring_events.json');
const TUNNEL_CONFIG_FILE = path.join(ROOT_DIR, 'tunnel_config.json');

if (!fs.existsSync(LOGS_DIR)) {
  try { fs.mkdirSync(LOGS_DIR, { recursive: true }); } catch (e) {}
}

const MAX_SAVED_EVENTS = 200;
let eventsBuffer = [];

// Boshlang'ich eventlarni yuklash
try {
  if (fs.existsSync(EVENTS_FILE)) {
    eventsBuffer = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8'));
    if (!Array.isArray(eventsBuffer)) eventsBuffer = [];
  }
} catch (e) {
  eventsBuffer = [];
}

/**
 * Insident yoki xatolikni jurnallash
 */
function logIncident(component, level, message, details = {}) {
  const timestamp = new Date().toISOString();
  const event = {
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    timestamp,
    component,
    level,
    message,
    details
  };

  // 1. Faylga qator sifatida yozish (APPEND)
  const detailsStr = Object.keys(details).length > 0 ? ` | ${JSON.stringify(details)}` : '';
  const logLine = `[${timestamp}] [${level.padEnd(8)}] [${component.padEnd(14)}] ${message}${detailsStr}\n`;
  
  try {
    fs.appendFileSync(MONITOR_LOG_FILE, logLine, 'utf8');
  } catch (e) {
    console.error("[SystemMonitor] Faylga yozishda xatolik:", e.message);
  }

  // 2. Xotiradagi buferga va JSON ga saqlash
  eventsBuffer.unshift(event);
  if (eventsBuffer.length > MAX_SAVED_EVENTS) {
    eventsBuffer = eventsBuffer.slice(0, MAX_SAVED_EVENTS);
  }

  try {
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(eventsBuffer, null, 2), 'utf8');
  } catch (e) {}

  if (level === 'ERROR' || level === 'CRITICAL') {
    console.error(`🚨 [MONITOR-${level}] [${component}] ${message}`, details);
  } else if (level === 'WARN') {
    console.warn(`⚠️ [MONITOR-WARN] [${component}] ${message}`);
  }
}

/**
 * Mijoz so'rovlari metrikasini qayd etish
 */
function recordRequestMetric(component, method, urlPath, statusCode, durationMs, clientIp, userAgent) {
  if (statusCode >= 400) {
    const level = statusCode >= 500 ? 'ERROR' : 'WARN';
    logIncident(component, level, `HTTP ${statusCode} on ${method} ${urlPath} (${durationMs}ms)`, {
      clientIp,
      statusCode,
      durationMs,
      userAgent: userAgent ? userAgent.substring(0, 150) : 'unknown'
    });
  }
}

/**
 * HTTP/HTTPS GET tekshiruv yordamchisi
 */
function probeHttp(targetUrl, timeoutMs = 4000, extraHeaders = {}) {
  return new Promise((resolve) => {
    const isHttps = targetUrl.startsWith('https:');
    const client = isHttps ? https : http;
    const startTime = Date.now();

    try {
      const urlObj = new URL(targetUrl);
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + (urlObj.search || ''),
        method: 'GET',
        timeout: timeoutMs,
        headers: {
          'User-Agent': 'Radiology-System-Monitor/1.0',
          ...extraHeaders
        }
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const latencyMs = Date.now() - startTime;
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 400,
            statusCode: res.statusCode,
            latencyMs,
            bodySnippet: body.substring(0, 200)
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          ok: false,
          statusCode: 0,
          latencyMs: Date.now() - startTime,
          error: 'Connection timed out'
        });
      });

      req.on('error', (err) => {
        resolve({
          ok: false,
          statusCode: 0,
          latencyMs: Date.now() - startTime,
          error: err.message
        });
      });

      req.end();
    } catch (err) {
      resolve({
        ok: false,
        statusCode: 0,
        latencyMs: 0,
        error: err.message
      });
    }
  });
}

/**
 * Tizimning barcha qismlarini to'liq tekshirish va salomatlik hisobotini tuzish
 */
async function checkSystemHealth() {
  const now = new Date().toISOString();
  const checks = {};
  let overallStatus = 'HEALTHY'; // 'HEALTHY' | 'DEGRADED' | 'CRITICAL'

  // 1. Admin Server (Port 9890)
  const adminProbe = await probeHttp('http://localhost:9890/api/status', 3000);
  checks.adminServer = {
    name: "Admin Server (Port 9890)",
    status: adminProbe.ok ? 'UP' : 'DOWN',
    latencyMs: adminProbe.latencyMs,
    statusCode: adminProbe.statusCode,
    error: adminProbe.error || null,
    checkedAt: now
  };
  if (!adminProbe.ok) {
    overallStatus = 'CRITICAL';
    logIncident('mrt_server', 'CRITICAL', `Admin Server (9890) javob bermayapti: ${adminProbe.error || adminProbe.statusCode}`);
  }

  // 2. Registratura Server (Port 9891 - Lokal)
  const regProbe = await probeHttp('http://localhost:9891/', 3000);
  checks.regServerLocal = {
    name: "Registratura Server (Port 9891 - LAN)",
    status: regProbe.ok ? 'UP' : 'DOWN',
    latencyMs: regProbe.latencyMs,
    statusCode: regProbe.statusCode,
    error: regProbe.error || null,
    checkedAt: now
  };
  if (!regProbe.ok) {
    if (overallStatus !== 'CRITICAL') overallStatus = 'DEGRADED';
    logIncident('mrt_reg_server', 'WARN', `Registratura (9891) javob bermayapti: ${regProbe.error || regProbe.statusCode}`);
  }

  // 3. Registratura Xavfsizlik Cheklovi (403 Forbidden tekshiruvi)
  const regSecProbe = await probeHttp('http://localhost:9891/', 3000, {
    'cf-connecting-ip': '203.0.113.195',
    'host': 'test-tunnel.trycloudflare.com'
  });
  const isSecurityActive = (regSecProbe.statusCode === 403);
  checks.regSecurityBarrier = {
    name: "Registratura Tashqi Tarmoq Himoyasi",
    status: isSecurityActive ? 'SECURED' : 'VULNERABLE',
    statusCode: regSecProbe.statusCode,
    checkedAt: now
  };
  if (!isSecurityActive) {
    logIncident('mrt_reg_server', 'WARN', `Registratura xavfsizlik filtri 403 qaytarmadi! Kod: ${regSecProbe.statusCode}`);
  }

  // 4. Cloudflare HTTPS Tunnel (Tashqi Internet Tekshiruvi)
  let tunnelUrl = null;
  try {
    if (fs.existsSync(TUNNEL_CONFIG_FILE)) {
      const tc = JSON.parse(fs.readFileSync(TUNNEL_CONFIG_FILE, 'utf8'));
      tunnelUrl = tc?.mrt_mskt?.onlineApiUrl || null;
    }
  } catch (e) {}

  if (tunnelUrl) {
    const tunnelProbe = await probeHttp(`${tunnelUrl}/api/status`, 6000);
    checks.cloudflareTunnel = {
      name: "Cloudflare HTTPS Tunnel",
      url: tunnelUrl,
      status: tunnelProbe.ok ? 'ONLINE' : 'OFFLINE',
      externalLatencyMs: tunnelProbe.latencyMs,
      statusCode: tunnelProbe.statusCode,
      error: tunnelProbe.error || null,
      checkedAt: now
    };
    if (!tunnelProbe.ok) {
      if (overallStatus !== 'CRITICAL') overallStatus = 'DEGRADED';
      logIncident('tunnel', 'ERROR', `Cloudflare Tunnel internetdan javob bermayapti (${tunnelUrl}): ${tunnelProbe.error || tunnelProbe.statusCode}`);
    }
  } else {
    checks.cloudflareTunnel = {
      name: "Cloudflare HTTPS Tunnel",
      status: 'NOT_CONFIGURED',
      checkedAt: now
    };
    if (overallStatus !== 'CRITICAL') overallStatus = 'DEGRADED';
  }

  // 5. Telegram Bot API Tekshiruvi
  const tgProbe = await probeHttp('https://api.telegram.org/bot8836735566:AAEJV5tMm0RY5XRUZJhI8Zo9duJ_7b3YKY4/getMe', 5000);
  let tgBotInfo = null;
  try {
    if (tgProbe.ok && tgProbe.bodySnippet) {
      const parsed = JSON.parse(tgProbe.bodySnippet);
      if (parsed.ok) tgBotInfo = parsed.result?.username;
    }
  } catch (e) {}

  checks.telegramBot = {
    name: "Telegram Bot API (@Radiodiagnostika_bot)",
    status: tgProbe.ok ? 'ACTIVE' : 'ERROR',
    latencyMs: tgProbe.latencyMs,
    botUsername: tgBotInfo || 'Radiodiagnostika_bot',
    checkedAt: now
  };
  if (!tgProbe.ok) {
    logIncident('bot', 'WARN', `Telegram Bot API ulanishida xatolik: ${tgProbe.error || tgProbe.statusCode}`);
  }

  // 6. Tizim Resurslari
  const memUsage = process.memoryUsage();
  checks.systemResources = {
    uptimeSeconds: Math.round(process.uptime()),
    osUptimeHours: (os.uptime() / 3600).toFixed(1),
    memoryHeapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
    memoryRssMb: Math.round(memUsage.rss / 1024 / 1024),
    freeMemMb: Math.round(os.freemem() / 1024 / 1024),
    totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
    cpuCores: os.cpus().length,
    loadAvg: os.loadavg()
  };

  const healthReport = {
    overallStatus,
    checkedAt: now,
    services: checks,
    recentIncidentsCount: eventsBuffer.filter(e => e.level === 'ERROR' || e.level === 'CRITICAL').length,
    latestIncidents: eventsBuffer.slice(0, 10)
  };

  // Salomatlik fayliga yozish
  try {
    fs.writeFileSync(HEALTH_FILE, JSON.stringify(healthReport, null, 2), 'utf8');
  } catch (e) {}

  return healthReport;
}

module.exports = {
  logIncident,
  recordRequestMetric,
  checkSystemHealth,
  getRecentEvents: (limit = 50) => eventsBuffer.slice(0, limit),
  getHealthReport: () => {
    try {
      if (fs.existsSync(HEALTH_FILE)) {
        return JSON.parse(fs.readFileSync(HEALTH_FILE, 'utf8'));
      }
    } catch (e) {}
    return null;
  }
};
