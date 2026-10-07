@echo off
chcp 65001 >nul
title RADIOLOGY AI & UTT — 24/7 XIZMATLAR BOSHQARUVI
color 0a
cd /d "%~dp0"

echo ===============================================================================
echo       RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI
echo       RADIOLOGY AI & UTT — 24/7 UZLUKSIZ SERVERLAR MAJMUI
echo ===============================================================================
echo.
echo   * MRT & MSKT Admin:       http://localhost:9890/control
echo   * MRT Registratura:       http://localhost:9891/
echo   * MRT Jonli TV:           http://localhost:9890/tv
echo   * UTT Registratura:       http://localhost:9876/
echo   * UTT Jonli TV:           http://localhost:9877/
echo   * UTT Vrach Xonasi:       http://localhost:9878/
echo   * Telegram Boti:          @Radiodiagnostika_bot
echo   * 24/7 Monitoring:        Fonda faol tekshiruvda
echo.
echo ===============================================================================

wscript.exe "%~dp0start_24_7_silent.vbs"

echo [OK] Barcha serverlar va monitoring orqa fonda 24/7 rejimida ishga tushirildi!
echo [OK] Kompyuter o'chsa o'chadi, qayta yonganda esa avtomatik ravishda yonaveradi.
echo.
timeout /t 3 >nul
exit
