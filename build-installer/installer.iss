; ==============================================================================
; 🏥 RESPUBLIKA RADIOLOGIYA VA ONKOLOGIYA MARKAZI
; Tibbiyot / MRT & MSKT Aqlli Navbat Tizimi - To'liq Mustaqil O'rnatuvchi (Setup)
; Node.js va barcha kutubxonalar ichida integratsiya qilingan (Standalone Installer)
; ==============================================================================

#define MyAppName "UTT - Tibbiyot Navbat Tizimi"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Respublika Radiologiya va Onkologiya Markazi"
#define MyAppExeName "Start-Server.bat"
#define MyAppIco "c:\Users\Rentgen xona\Desktop\UTT\build-installer\app.ico"
#define MySourceDir "c:\Users\Rentgen xona\Desktop\UTT"

[Setup]
AppId={{A7B8C9D0-E1F2-4A3B-8C9D-UTTNAVTIMZIM2026}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\UTT_Navbat_Tizimi
DefaultGroupName=UTT Tibbiyot Navbat Tizimi
AllowNoIcons=yes
OutputDir=c:\Users\Rentgen xona\Desktop\UTT\dist
OutputBaseFilename=UTT_Navbat_Tizimi_Setup
SetupIconFile={#MyAppIco}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=auto
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; 1. Mustaqil Node.js runtime va boshqaruv skriptlari
Source: "{#MySourceDir}\build-installer\runtime\*"; DestDir: "{app}\runtime"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\build-installer\Start-Server.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\build-installer\Start-Server-Silent.vbs"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\build-installer\Stop-Server.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\build-installer\Open-TV.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\build-installer\Open-Navbat.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\build-installer\Open-Laborant.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\build-installer\app.ico"; DestDir: "{app}"; Flags: ignoreversion

; 2. Asosiy Server kodi va kutubxona
Source: "{#MySourceDir}\server.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\login.html"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#MySourceDir}\lib\*"; DestDir: "{app}\lib"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\shared\*"; DestDir: "{app}\shared"; Flags: ignoreversion recursesubdirs createallsubdirs

; 3. Front-end Portallar
Source: "{#MySourceDir}\karmed-workspace\*"; DestDir: "{app}\karmed-workspace"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\laborant\*"; DestDir: "{app}\laborant"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\navbat-yozish\*"; DestDir: "{app}\navbat-yozish"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\mrt-tv\*"; DestDir: "{app}\mrt-tv"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\wifi-tv\*"; DestDir: "{app}\wifi-tv"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\app1-registratura\*"; DestDir: "{app}\app1-registratura"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\app2-vrach\*"; DestDir: "{app}\app2-vrach"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\app4-admin\*"; DestDir: "{app}\app4-admin"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#MySourceDir}\server-dashboard\*"; DestDir: "{app}\server-dashboard"; Flags: ignoreversion recursesubdirs createallsubdirs

; 4. Baza fayllari (qayta o'rnatilganda mavjud ma'lumotlar o'chmasligi uchun onlyifdoesntexist)
Source: "{#MySourceDir}\data\*.json"; DestDir: "{app}\data"; Flags: onlyifdoesntexist
Source: "{#MySourceDir}\data\*.txt"; DestDir: "{app}\data"; Flags: onlyifdoesntexist
Source: "{#MySourceDir}\data\backups\*.json"; DestDir: "{app}\data\backups"; Flags: onlyifdoesntexist recursesubdirs createallsubdirs

[Icons]
; Ish stolidagi yorliqlar
Name: "{autodesktop}\Tibbiyot Navbat Tizimi"; Filename: "{app}\Start-Server.bat"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"; Tasks: desktopicon
Name: "{autodesktop}\Kutish Zali TV (Wi-Fi)"; Filename: "{app}\Open-TV.bat"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"; Tasks: desktopicon

; Start menyusidagi yorliqlar
Name: "{group}\Tibbiyot Navbat Tizimi (Konsolli)"; Filename: "{app}\Start-Server.bat"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"
Name: "{group}\Tibbiyot Navbat Tizimi (Fonda Ishlash)"; Filename: "{app}\Start-Server-Silent.vbs"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"
Name: "{group}\Kutish Zali TV (Wi-Fi 3030)"; Filename: "{app}\Open-TV.bat"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"
Name: "{group}\Navbatga Yozish (Registratura)"; Filename: "{app}\Open-Navbat.bat"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"
Name: "{group}\Laborant Portali"; Filename: "{app}\Open-Laborant.bat"; WorkingDir: "{app}"; IconFilename: "{app}\app.ico"
Name: "{group}\Serverni To'xtatish"; Filename: "{app}\Stop-Server.bat"; WorkingDir: "{app}"
Name: "{group}\Dasturni O'chirish"; Filename: "{uninstallexe}"

[Run]
Filename: "{app}\Start-Server.bat"; Description: "Tibbiyot Navbat Tizimini hoziroq ishga tushirish"; Flags: postinstall nowait skipifsilent
