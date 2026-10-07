const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Setting up 24/7 Autostart on Windows Boot & Logon ===');

// 1. Get Windows Startup folder
const appData = process.env.APPDATA;
const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
const targetVbs = path.join(__dirname, 'start_24_7_silent.vbs');

if (fs.existsSync(startupDir)) {
  // Create a .vbs directly in the Startup folder that calls our targetVbs
  const startupVbsPath = path.join(startupDir, 'Radiology_AI_24_7_Autostart.vbs');
  const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "D:\\Desk\\UTT"
WshShell.Run "wscript.exe ""D:\\Desk\\UTT\\start_24_7_silent.vbs""", 0, False
`;
  fs.writeFileSync(startupVbsPath, vbsContent, 'utf8');
  console.log(`✅ [1/2] Windows Startup skripti o'rnatildi: ${startupVbsPath}`);
} else {
  console.warn(`⚠️ Startup papkasi topilmadi: ${startupDir}`);
}

// 2. Register Windows Scheduled Task for system boot & user logon
try {
  const taskName = "Radiology_AI_24_7";
  const cmd = `schtasks /Create /TN "${taskName}" /TR "wscript.exe \\"D:\\Desk\\UTT\\start_24_7_silent.vbs\\"" /SC ONLOGON /RL HIGHEST /F`;
  execSync(cmd, { stdio: 'pipe' });
  console.log(`✅ [2/2] Windows Task Scheduler vazifasi o'rnatildi: ${taskName} (ONLOGON, HIGHEST)`);
} catch (err) {
  console.warn(`[Task Scheduler Notice]: ${err.message}`);
}

console.log('\n=== Tizim avto-yuklanishi muvaffaqiyatli sozlandi! ===');
