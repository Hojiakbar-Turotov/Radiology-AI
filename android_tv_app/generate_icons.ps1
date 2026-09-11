Add-Type -AssemblyName System.Drawing

$outDir = 'c:\Users\Rentgen xona\Desktop\UTT\android_tv_app\res\drawable'
if (!(Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

# 1. ic_launcher.png (192x192)
$bmpIcon = New-Object System.Drawing.Bitmap 192, 192
$gIcon = [System.Drawing.Graphics]::FromImage($bmpIcon)
$gIcon.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$rect = New-Object System.Drawing.Rectangle 0, 0, 192, 192
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 15, 28, 63)), ([System.Drawing.Color]::FromArgb(255, 37, 99, 235)), 45.0
$gIcon.FillRectangle($brush, $rect)

$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 56, 189, 248)), 6.0
$gIcon.DrawRectangle($pen, 3, 3, 186, 186)

$fontTitle = New-Object System.Drawing.Font ('Arial', [float]32, [System.Drawing.FontStyle]::Bold)
$fontSub = New-Object System.Drawing.Font ('Arial', [float]18, [System.Drawing.FontStyle]::Bold)
$textBrushWhite = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$textBrushGold = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 245, 158, 11))

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center

$gIcon.DrawString('UTT', $fontTitle, $textBrushGold, [float]96, [float]65, $sf)
$gIcon.DrawString('TV NAVBAT', $fontSub, $textBrushWhite, [float]96, [float]125, $sf)

$bmpIcon.Save("$outDir\ic_launcher.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gIcon.Dispose()
$bmpIcon.Dispose()

# 2. banner.png (320x180 - Android TV Standarti)
$bmpBanner = New-Object System.Drawing.Bitmap 320, 180
$gBanner = [System.Drawing.Graphics]::FromImage($bmpBanner)
$gBanner.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

$rectB = New-Object System.Drawing.Rectangle 0, 0, 320, 180
$brushB = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rectB, ([System.Drawing.Color]::FromArgb(255, 10, 18, 45)), ([System.Drawing.Color]::FromArgb(255, 29, 78, 216)), 30.0
$gBanner.FillRectangle($brushB, $rectB)

$penB = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 245, 158, 11)), 5.0
$gBanner.DrawRectangle($penB, 2, 2, 316, 176)

$fontB1 = New-Object System.Drawing.Font ('Arial', [float]24, [System.Drawing.FontStyle]::Bold)
$fontB2 = New-Object System.Drawing.Font ('Arial', [float]13, [System.Drawing.FontStyle]::Bold)
$fontB3 = New-Object System.Drawing.Font ('Arial', [float]10, [System.Drawing.FontStyle]::Regular)

$gBanner.DrawString('UTT JONLI NAVBAT', $fontB1, $textBrushGold, [float]160, [float]50, $sf)
$gBanner.DrawString('ONKOLOGIYA MARKAZI', $fontB2, $textBrushWhite, [float]160, [float]95, $sf)
$gBanner.DrawString('Android TV Monitor Paneli', $fontB3, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 148, 163, 184))), [float]160, [float]135, $sf)

$bmpBanner.Save("$outDir\banner.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gBanner.Dispose()
$bmpBanner.Dispose()

Write-Host 'Icons and Android TV banner generated successfully'
