/**
 * ==============================================================================
 *  🩺 RADIOLOGY AI — 24/7 BACKGROUND MONITORING AGENT
 * ==============================================================================
 *  Ushbu dastur orqa fonda (daemon) tinimsiz ishlab turadi:
 *  - Har 15 soniyada Port 9890 (Admin), 9891 (Registratura), Cloudflare Tunnel
 *    va Telegram Bot holatini avtomatik tekshiradi.
 *  - Har qanday uzilish yoki xatolikni logs/system_monitor.log va
 *    data/system_health.json fayliga muhrlab boradi.
 *  - Admin yoki foydalanuvchi "nega ishlamayapti" deb so'raganida barcha
 *    insidentlar aniq sababi bilan ko'rinib turadi.
 * ==============================================================================
 */

const { checkSystemHealth, logIncident } = require('./lib/system_monitor');

const CHECK_INTERVAL_MS = 15000; // Har 15 soniyada
let checkCount = 0;

console.log('================================================================================');
console.log('  🩺 RADIOLOGY AI — 24/7 MONITORING AGENTI ISHGA TUSHDI');
console.log('  Interval: Har 15 soniyada to\'liq tizim diagnostikasi');
console.log('  Loglar: logs/system_monitor.log va data/system_health.json');
console.log('================================================================================');

logIncident('monitor_agent', 'INFO', '24/7 Monitoring agenti muvaffaqiyatli ishga tushirildi');

async function runCheckCycle() {
  checkCount++;
  try {
    const report = await checkSystemHealth();
    const admin = report.services.adminServer;
    const reg = report.services.regServerLocal;
    const tunnel = report.services.cloudflareTunnel;

    if (checkCount % 4 === 0 || report.overallStatus !== 'HEALTHY') {
      const statusIcon = report.overallStatus === 'HEALTHY' ? '🟢' : (report.overallStatus === 'DEGRADED' ? '🟡' : '🔴');
      console.log(`[${new Date().toLocaleTimeString('uz-UZ')}] ${statusIcon} Status: ${report.overallStatus} | Admin: ${admin.status} (${admin.latencyMs}ms) | Reg: ${reg.status} | Tunnel: ${tunnel.status} (${tunnel.externalLatencyMs || 0}ms)`);
    }
  } catch (err) {
    console.error('[Monitor Agent] Tekshiruvda kutilmagan xatolik:', err.message);
    logIncident('monitor_agent', 'ERROR', `Diagnostika siklida xatolik: ${err.message}`);
  }
}

// Birinchi tekshiruv darhol
runCheckCycle();

// Doimiy tsikl
setInterval(runCheckCycle, CHECK_INTERVAL_MS);

// To'xtash signallari
process.on('SIGINT', () => {
  logIncident('monitor_agent', 'INFO', 'Monitoring agenti foydalanuvchi tomonidan to\'xtatildi');
  process.exit(0);
});
process.on('SIGTERM', () => {
  logIncident('monitor_agent', 'INFO', 'Monitoring agenti tizim tomonidan to\'xtatildi');
  process.exit(0);
});
