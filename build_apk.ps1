# ==============================================================================
# UTT ANDROID TV APK BUILD SCRIPT (v8.0.0)
# ==============================================================================
$ErrorActionPreference = 'Stop'

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  UTT NAVBAT TIZIMI — ANDROID TV APK YIG'ISH JARAYONI (v8.0.0)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. YO'LLAR VA QURILMALAR
$BASE_DIR = "c:\Users\Rentgen xona\Desktop\UTT"
$APP_DIR = "$BASE_DIR\android_tv_app"
$BUILD_DIR = "$APP_DIR\build"

$JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$JAVAC = "$JAVA_HOME\bin\javac.exe"
$JAR = "$JAVA_HOME\bin\jar.exe"
$KEYTOOL = "$JAVA_HOME\bin\keytool.exe"

$SDK_DIR = "C:\Users\Rentgen xona\AppData\Local\Android\Sdk"
$BUILD_TOOLS = "$SDK_DIR\build-tools\36.0.0"
$AAPT2 = "$BUILD_TOOLS\aapt2.exe"
$D8 = "$BUILD_TOOLS\d8.bat"
$ZIPALIGN = "$BUILD_TOOLS\zipalign.exe"
$APKSIGNER = "$BUILD_TOOLS\apksigner.bat"
$ANDROID_JAR = "$SDK_DIR\platforms\android-37.0\android.jar"

$FINAL_APK = "$BASE_DIR\UTT_TV_Navbat.apk"
$PUBLIC_APK = "$BASE_DIR\public\UTT_TV_Navbat.apk"
$PUBLIC_APP_APK = "$BASE_DIR\public\app.apk"
$DESKTOP_APK = "c:\Users\Rentgen xona\Desktop\UTT_TV_Navbat.apk"

# Kerakli vositalarni tekshirish
if (!(Test-Path $JAVAC)) { throw "javac.exe topilmadi: $JAVAC" }
if (!(Test-Path $AAPT2)) { throw "aapt2.exe topilmadi: $AAPT2" }
if (!(Test-Path $ANDROID_JAR)) { throw "android.jar topilmadi: $ANDROID_JAR" }

# [0/6] Eng so'nggi TV veb-fayllarini assets papkasiga ko'chirish
Write-Host "[0/6] Eng so'nggi TV veb-fayllari nusxalanmoqda (public -> assets)..." -ForegroundColor Yellow
Copy-Item "$BASE_DIR\public\tv.html" "$APP_DIR\assets\tv.html" -Force
Copy-Item "$BASE_DIR\public\app.js" "$APP_DIR\assets\app.js" -Force
Copy-Item "$BASE_DIR\public\styles.css" "$APP_DIR\assets\styles.css" -Force
Copy-Item "$BASE_DIR\public\doctor-completed.html" "$APP_DIR\assets\doctor-completed.html" -Force
Copy-Item "$BASE_DIR\public\chime_engine.js" "$APP_DIR\assets\chime_engine.js" -Force
if (Test-Path "$BASE_DIR\public\icons\logo-onko.png") {
    Copy-Item "$BASE_DIR\public\icons\logo-onko.png" "$APP_DIR\assets\icons\logo-onko.png" -Force
}
# Keraksiz eski APKlarni assetsdan tozalash
if (Test-Path "$APP_DIR\assets\UTT_TV_Navbat.apk") { Remove-Item "$APP_DIR\assets\UTT_TV_Navbat.apk" -Force }
if (Test-Path "$APP_DIR\assets\app.apk") { Remove-Item "$APP_DIR\assets\app.apk" -Force }

# Build papkasini tozalash va tayyorlash
if (Test-Path $BUILD_DIR) {
    Remove-Item -Path $BUILD_DIR -Recurse -Force | Out-Null
}
New-Item -ItemType Directory -Path "$BUILD_DIR\gen" -Force | Out-Null
New-Item -ItemType Directory -Path "$BUILD_DIR\classes" -Force | Out-Null
New-Item -ItemType Directory -Path "$BUILD_DIR\dex" -Force | Out-Null

Write-Host "[1/6] Resurslar kompilyatsiya qilinmoqda (aapt2 compile)..." -ForegroundColor Yellow
& $AAPT2 compile --dir "$APP_DIR\res" -o "$BUILD_DIR\compiled_res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile xatoligi yuz berdi" }

Write-Host "[2/6] Resurslar bog'lanmoqda va R.java yaratilmoqda (aapt2 link)..." -ForegroundColor Yellow
& $AAPT2 link -I $ANDROID_JAR `
    --manifest "$APP_DIR\AndroidManifest.xml" `
    --java "$BUILD_DIR\gen" `
    -o "$BUILD_DIR\base.apk" `
    -A "$APP_DIR\assets" `
    "$BUILD_DIR\compiled_res.zip"
if ($LASTEXITCODE -ne 0) { throw "aapt2 link xatoligi yuz berdi" }

Write-Host "[3/6] Java kodlari kompilyatsiya qilinmoqda (javac)..." -ForegroundColor Yellow
$javaFiles = @(
    (Get-ChildItem -Path "$BUILD_DIR\gen" -Recurse -Filter "*.java").FullName
    (Get-ChildItem -Path "$APP_DIR\src" -Recurse -Filter "*.java").FullName
)

& $JAVAC -cp $ANDROID_JAR `
    --release 17 `
    -d "$BUILD_DIR\classes" `
    $javaFiles
if ($LASTEXITCODE -ne 0) { throw "javac kompilyatsiya xatoligi" }

Write-Host "[4/6] Baytkodlar Dalvik formatiga o'tkazilmoqda (d8 -> classes.dex)..." -ForegroundColor Yellow
$classFiles = (Get-ChildItem -Path "$BUILD_DIR\classes" -Recurse -Filter "*.class").FullName

$env:JAVA_HOME = $JAVA_HOME
& $D8 --min-api 21 --lib $ANDROID_JAR --output "$BUILD_DIR\dex" $classFiles
if ($LASTEXITCODE -ne 0) { throw "d8 xatoligi yuz berdi" }

Write-Host "[5/6] classes.dex APK fayliga qo'shilmoqda..." -ForegroundColor Yellow
Push-Location "$BUILD_DIR\dex"
try {
    & $JAR -uf "$BUILD_DIR\base.apk" classes.dex
} finally {
    Pop-Location
}
if ($LASTEXITCODE -ne 0) { throw "jar qo'shish xatoligi" }

# Zipalign (4-baytli tekislash)
Write-Host "[6/6] Zipalign va imzolash (apksigner)..." -ForegroundColor Yellow
& $ZIPALIGN -f -p 4 "$BUILD_DIR\base.apk" "$BUILD_DIR\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "zipalign xatoligi" }

# Keystore tekshirish yoki yaratish
$KEYSTORE = "$APP_DIR\debug.keystore"
if (!(Test-Path $KEYSTORE)) {
    Write-Host "Debug keystore yaratilmoqda..." -ForegroundColor Cyan
    & $KEYTOOL -genkeypair -v `
        -keystore $KEYSTORE `
        -storepass android `
        -alias androiddebugkey `
        -keypass android `
        -keyalg RSA `
        -keysize 2048 `
        -validity 10000 `
        -dname "CN=UTT Android TV,OU=Radiology,O=Oncology,C=UZ"
}

# APKni imzolash
& $APKSIGNER sign `
    --ks $KEYSTORE `
    --ks-pass pass:android `
    --ks-key-alias androiddebugkey `
    --key-pass pass:android `
    --out $FINAL_APK `
    "$BUILD_DIR\aligned.apk"
if ($LASTEXITCODE -ne 0) { throw "apksigner imzolash xatoligi" }

# Imzoni tekshirish
Write-Host "Imzo tekshirilmoqda..." -ForegroundColor Cyan
& $APKSIGNER verify $FINAL_APK

Copy-Item -Path $FINAL_APK -Destination $PUBLIC_APK -Force
Copy-Item -Path $FINAL_APK -Destination $PUBLIC_APP_APK -Force
Copy-Item -Path $FINAL_APK -Destination $DESKTOP_APK -Force

$apkItem = Get-Item $FINAL_APK
$apkSizeKB = [math]::Round($apkItem.Length / 1KB, 2)
$apkSizeMB = [math]::Round($apkItem.Length / 1MB, 2)

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  MUVAFFAQINLI YAKUNLANDI!" -ForegroundColor Green
Write-Host "  APK Fayli: $FINAL_APK" -ForegroundColor Green
Write-Host "  Nusxalari: $PUBLIC_APK va $DESKTOP_APK" -ForegroundColor Green
Write-Host "  Hajmi: $apkSizeKB KB ($apkSizeMB MB)" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
