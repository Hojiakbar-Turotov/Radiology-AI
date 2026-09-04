@echo off
chcp 65001 >nul
cd /d "%~dp0"
title UTT Tibbiyot Navbat Tizimi Serveri
echo =======================================================
echo   RESPUBLIKA RADIOLOGIYA VA ONKOLOGIYA MARKAZI
echo   Elektron Navbat Tizimi Serveri Ishga Tushmoqda...
echo =======================================================
echo.
echo   Asosiy Ish Muhiti: http://localhost:3000
echo   Kutish Zali TV:    http://localhost:3030
echo.
echo   Iltimos, ushbu konsol oynasini yopmang!
echo =======================================================
start http://localhost:3000
if exist "runtime\node.exe" (
  runtime\node.exe server.js
) else (
  node server.js
)
pause
