@echo off
title KARMED MRT VA MSKT NAVBATGA QO'YISH PORTALI (Port 9891)
color 0b
cd /d "%~dp0"

echo ========================================================
echo   KARMED RADIOLOGY - MRT & MSKT NAVBATGA QO'YISH PORTALI
echo ========================================================
echo   * Port:                   9891
echo   * Navbatga qo'yish:       http://localhost:9891
echo   * Operatorlar:            TB1, TB2, TB3 (Parol: 14520)
echo   * Karmed integratsiyasi:  R5 (17720 - Yashirin)
echo   * Admin IP Nazorati:      http://localhost:9890/control
echo ========================================================
echo.

if exist "%~dp0node.exe" (
    start "" "http://localhost:9891"
    "%~dp0node.exe" mrt_reg_server.js
) else (
    start "" "http://localhost:9891"
    node mrt_reg_server.js
)

pause
