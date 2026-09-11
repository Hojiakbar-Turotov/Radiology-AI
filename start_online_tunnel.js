const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const cloudflared = 'C:\\Users\\Rentgen xona\\Desktop\\MRT_MSKT\\cloudflared.exe';
const manzilFile = 'C:\\Users\\Rentgen xona\\Desktop\\ONLINE_MANZILLAR.txt';
const uttRepoDir = 'C:\\Users\\Rentgen xona\\Desktop\\UTT';
const tunnelConfigFile = path.join(uttRepoDir, 'tunnel_config.json');

let uttUrl = null;
let mrtUrl = null;
let gitPushDebounceTimer = null;

function updateGitTunnelConfig() {
  const config = {
    version: "7.0.0",
    updatedAt: new Date().toISOString(),
    utt: {
      localTvUrl: "http://10.34.17.210:9877/tv",
      localApiUrl: "http://10.34.17.210:9880",
      onlineTvUrl: uttUrl ? (uttUrl + '/tv') : null,
      onlineApiUrl: uttUrl || null,
      apkDownloadUrl: "https://raw.githubusercontent.com/Hojiakbar-Turotov/Radiology-AI/main/UTT_TV_Navbat.apk"
    },
    mrt_mskt: {
      localAdminUrl: "http://10.34.17.210:9890/admin.html",
      onlineAdminUrl: mrtUrl ? (mrtUrl + '/admin.html') : null
    }
  };

  try {
    fs.writeFileSync(tunnelConfigFile, JSON.stringify(config, null, 2), 'utf8');
    console.log(`[GIT-TUNNEL] Konfiguratsiya saqlandi: ${tunnelConfigFile}`);

    if (gitPushDebounceTimer) clearTimeout(gitPushDebounceTimer);
    gitPushDebounceTimer = setTimeout(() => {
      const gitCmd = `git add tunnel_config.json index.html && git commit -m "Auto-update tunnel config (v7.0.0)" && git push origin main`;
      exec(gitCmd, { cwd: uttRepoDir }, (err, stdout, stderr) => {
        if (err) {
          console.warn('[GIT-TUNNEL] Git push kechikishi yoki xatosi:', err.message);
        } else {
          console.log('[GIT-TUNNEL] GitHub muvaffaqiyatli yangilandi va push qilindi!');
        }
      });
    }, 3000);
  } catch (e) {
    console.warn('[GIT-TUNNEL] Xatolik:', e.message);
  }
}

function saveLinks() {
  const content = `===============================================================================
        KARMED TIBBIYOT MARKAZI — ONLINE MANZILLAR RO'YXATI (v7.0.0)
        Yangilangan vaqt: ${new Date().toLocaleString()}
===============================================================================

Ushbu havolalar orqali internetga ulangan istalgan telefon, planshet, kompyuter
yoki Smart TV orqali tizimga kirish va hisobotlarni onlayn ko'rish mumkin:

-------------------------------------------------------------------------------
1. 🎯 UTT & DOPLER TIZIMI (PORT 9880 / 9877):
-------------------------------------------------------------------------------
   🌐 Online Admin Dashborti:  ${uttUrl ? uttUrl + '/admin' : 'Kutilmoqda...'}
   📺 Online TV Jonli Monitor: ${uttUrl ? uttUrl + '/tv' : 'Kutilmoqda...'}
   📲 Android TV APK (v7.0.0): ${uttUrl ? uttUrl + '/download/UTT_TV_Navbat.apk' : 'Kutilmoqda...'}
   👨‍⚕️ Online Vrach Profili:    ${uttUrl ? uttUrl + '/doctor' : 'Kutilmoqda...'}
   📱 Online UTT Agenti:       ${uttUrl ? uttUrl + '/utt' : 'Kutilmoqda...'}
   📶 Shifoxona Wi-Fi TV:      http://10.34.17.210:9877/tv
   📶 Shifoxona Wi-Fi Admin:   http://10.34.17.210:9880/admin.html
   💻 Ushbu Kompyuter:         http://localhost:9880/admin.html
   🌐 GitHub Doimiy Tunnel:    https://raw.githubusercontent.com/Hojiakbar-Turotov/Radiology-AI/main/tunnel_config.json

-------------------------------------------------------------------------------
2. 🧲⚡ MRT & MSKT TIZIMI (PORT 9890):
-------------------------------------------------------------------------------
   🌐 Online Admin Dashborti:  ${mrtUrl ? mrtUrl + '/admin.html' : 'Kutilmoqda...'}
   📶 Shifoxona Wi-Fi:         http://10.34.17.210:9890/admin.html
   💻 Ushbu Kompyuter:         http://localhost:9890/admin.html

===============================================================================
Eslatma: Agar internet yoki tunnel yangilansa, yangi manzil GitHub orqali
barcha TV va ilovalarda avtomatik yangilanadi.
`;
  fs.writeFileSync(manzilFile, content, 'utf8');
  console.log(`[TUNNEL] Saqlandi: ${manzilFile}`);
  updateGitTunnelConfig();
}

console.log('1. UTT uchun Cloudflare tunneli yoqilmoqda (Port 9880)...');
const uttTunnel = spawn(cloudflared, ['tunnel', '--url', 'http://localhost:9880']);
uttTunnel.stderr.on('data', d => {
  const m = d.toString().match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (m && !uttUrl) {
    uttUrl = m[0];
    console.log('🎯 UTT Online Havola:', uttUrl + '/admin');
    saveLinks();
  }
});

console.log('2. MRT & MSKT uchun Cloudflare tunneli yoqilmoqda (Port 9890)...');
const mrtTunnel = spawn(cloudflared, ['tunnel', '--url', 'http://localhost:9890']);
mrtTunnel.stderr.on('data', d => {
  const m = d.toString().match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (m && !mrtUrl) {
    mrtUrl = m[0];
    console.log('🧲⚡ MRT/MSKT Online Havola:', mrtUrl + '/admin.html');
    saveLinks();
  }
});