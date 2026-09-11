@echo off
title KARMED UTT NAVBAT VA ADMIN ANALITIKA TIZIMI (v5.0.0)
cd /d "%~dp0"
echo ========================================================
echo   KARMED UTT — NAVBAT VA ADMIN ANALITIKA TIZIMI (v5.0.0)
echo   Admin Panel: http://localhost:9880/admin.html
echo   TV Ekran:    http://localhost:9880/
echo ========================================================
node logger_server.js
pause
