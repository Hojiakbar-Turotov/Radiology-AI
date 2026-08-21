@echo off
title UTT Tibbiy Navbat Tizimi - Server
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo   UTT MRT & MSKT Navbat Tizimi Serveri Ishga Tushirilmoqda...
echo ========================================================
node server.js
pause
