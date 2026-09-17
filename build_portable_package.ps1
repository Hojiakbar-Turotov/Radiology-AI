$ErrorActionPreference = 'Stop'
$base = "c:\Users\Rentgen xona\Desktop\UTT"
$dist = "$base\dist_portable\UTT_TIZIMI"

if (Test-Path "$base\dist_portable") {
    Remove-Item -Path "$base\dist_portable" -Recurse -Force
}

Write-Host "0. UTT_SERVER.exe qayta kompilyatsiya qilinmoqda (v11.6.0)..." -ForegroundColor Cyan
$csc = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
& $csc /nologo /target:winexe /r:System.Windows.Forms.dll /r:System.Drawing.dll /win32icon:"$base\build-installer\app.ico" /out:"$base\UTT_SERVER.exe" "$base\src_launcher\UttTrayLauncher.cs"
if ($LASTEXITCODE -ne 0) { throw "UTT_SERVER.exe kompilyatsiya qilinmadi" }

New-Item -ItemType Directory -Path "$dist\runtime" -Force | Out-Null
New-Item -ItemType Directory -Path "$dist\public" -Force | Out-Null
New-Item -ItemType Directory -Path "$dist\data" -Force | Out-Null
New-Item -ItemType Directory -Path "$dist\lib" -Force | Out-Null
New-Item -ItemType Directory -Path "$dist\android_apps" -Force | Out-Null

Write-Host "1. Ikkala APK nusxalanmoqda..." -ForegroundColor Cyan
Copy-Item "$base\UTT_TV_Navbat.apk" "$dist\android_apps\UTT_TV_Navbat.apk" -Force
Copy-Item "$base\UTT_Bemor_Navbat.apk" "$dist\android_apps\UTT_Bemor_Navbat.apk" -Force

Write-Host "2. Asosiy dasturlar va runtime nusxalanmoqda..." -ForegroundColor Cyan
Copy-Item "$base\UTT_SERVER.exe" "$dist\UTT_SERVER.exe" -Force
Copy-Item "$base\node.exe" "$dist\runtime\node.exe" -Force
Copy-Item "$base\logger_server.js" "$dist\logger_server.js" -Force
if (Test-Path "$base\cloudflared.exe") {
    Copy-Item "$base\cloudflared.exe" "$dist\cloudflared.exe" -Force
}
if (Test-Path "$base\latest_queue.json") {
    Copy-Item "$base\latest_queue.json" "$dist\latest_queue.json" -Force
}

Write-Host "3. Public va Lib papkalari nusxalanmoqda..." -ForegroundColor Cyan
Copy-Item "$base\public\*" "$dist\public\" -Recurse -Force
Copy-Item "$base\lib\*" "$dist\lib\" -Recurse -Force

Write-Host "4. Data papkasi (katta kesh fayllarsiz) nusxalanmoqda..." -ForegroundColor Cyan
Get-ChildItem "$base\data" | Where-Object { 
    $_.Name -ne "admin_analytics_cache.json" -and $_.Name -ne "backups"
} | ForEach-Object {
    Copy-Item $_.FullName "$dist\data\" -Recurse -Force
}

Write-Host "5. Qollanma fayli yaratilmoqda..." -ForegroundColor Cyan
$readme = @"
================================================================================
RESPUBLIKA IXTISOSLASHTIRILGAN ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI
UTT / MSKT / MRT NAVBAT VA BOSHQARUV TIZIMI (v11.6.0 PORTABLE)
================================================================================

USHBU TO'PLAM TO'LIQ MUSTAQIL (STANDALONE) BO'LIB, BOSHQA KOMPYUTERDA ISHLATISH
UCHUN NODE.JS YOKI HECH QANDAY QO'SHIMCHA DASTUR O'RNATISH TALAB ETILMAYDI!

1. ISHGA TUSHIRISH:
------------------
- "UTT_SERVER.exe" faylini ikki marta bosing.
- Dastur orqa fonda (konsolsiz) ishga tushadi.
- Windows ekranning pastki o'ng burchagida (soat yonidagi bildirishnomalar/tray
  sohasida) UTT ikonkasi paydo bo'ladi.
- Takroriy bosishlardan himoyalangan (agar qayta bossangiz, tizim xabar beradi).

2. TRAY IKONKASI VA BOSHQARUV:
------------------------------
- Ikonkani o'ng tugma bilan bosing:
  * 🖥️ Registrator Posti (http://localhost:9876)
  * 📺 TV Jonli Monitor Ekrani (http://localhost:9877)
  * 👨‍⚕️ Vrach Qabulxona Profili (http://localhost:9878)
  * 📱 Bemor Portali (http://localhost:9879)
  * 🛡️ Admin Boshqaruv Dashborti (http://localhost:9880)
  * 🌐 Lokal IP manzil (masalan: http://192.168.x.x:9877) - pult va telefonlar uchun.
  * 🔄 Serverni qayta yuklash (Restart)
  * 🛑 Serverni to'xtatish va Chiqish (Exit) - serverni to'liq o'chiradi.

3. ANDROID QURILMALARNI ULASH:
------------------------------
"android_apps" papkasida 2 ta tayyor dastur (.apk) mavjud:

A) "UTT_TV_Navbat.apk" — Android TV va Smart TV uchun:
   - Fleshkaga yozib TV ga o'rnating.
   - Pult orqali boshqariladi, to'liq ekranli 16:9 rejimda ishlaydi.
   - Pultdagi MENU yoki OK orqali Server IP manzilini kiriting.
   - Har bir vrach kartasida 4 ta rangli ko'rsatkich va chaqiruv ovozi mavjud.

B) "UTT_Bemor_Navbat.apk" — Android Telefonlar uchun:
   - Telefon orqali bemor navbatini ko'rish.
   - Shifokorni o'zgartirish va sababini kiritish imkoniyati.
   - O'zgartirish sabablari Admin panelda avtomatik qayd etiladi.

4. BARCHA PORTLAR VA HAVOLALAR:
------------------------------
- Port 9876: Registrator posti va kassa integratsiyasi
- Port 9877: TV Katta ekran monitori
- Port 9878: Shifokor profili (U0..U9 kabinetlari)
- Port 9879: Bemorlar portali (bemor.html)
- Port 9880: Admin boshqaruv paneli (admin.html)
- Port 9881: UTT Mobil Agenti
- Port 9882: MSKT Mobil Agenti
- Port 9883: MRT Mobil Agenti

================================================================================
"@

$readme | Set-Content -Encoding UTF8 "$dist\QOLLANMA.txt"

Write-Host "6. ZIP arxivi yaratilmoqda (UTT_SERVER_PORTABLE.zip)..." -ForegroundColor Cyan
$zipFile = "$base\UTT_SERVER_PORTABLE.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile -Force }
Compress-Archive -Path "$dist\*" -DestinationPath $zipFile -CompressionLevel Optimal

Write-Host "7. Foydalanuvchi Ish stoliga (Desktop) nusxalanmoqda..." -ForegroundColor Cyan
Copy-Item $zipFile "c:\Users\Rentgen xona\Desktop\UTT_SERVER_PORTABLE.zip" -Force
Copy-Item "$dist\android_apps\UTT_TV_Navbat.apk" "c:\Users\Rentgen xona\Desktop\UTT_TV_Navbat.apk" -Force
Copy-Item "$dist\android_apps\UTT_Bemor_Navbat.apk" "c:\Users\Rentgen xona\Desktop\UTT_Bemor_Navbat.apk" -Force

$zipItem = Get-Item $zipFile
$zipMB = [math]::Round($zipItem.Length / 1MB, 2)

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  PORTATIV TO'PLAM MUVAFFAQIYATLI YARATILDI!" -ForegroundColor Green
Write-Host "  ZIP Fayl: $zipFile ($zipMB MB)" -ForegroundColor Green
Write-Host "  Desktop: c:\Users\Rentgen xona\Desktop\UTT_SERVER_PORTABLE.zip" -ForegroundColor Green
Write-Host "  TV APK:  c:\Users\Rentgen xona\Desktop\UTT_TV_Navbat.apk" -ForegroundColor Green
Write-Host "  Tel APK: c:\Users\Rentgen xona\Desktop\UTT_Bemor_Navbat.apk" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
