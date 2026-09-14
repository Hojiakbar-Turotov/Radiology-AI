@echo off
chcp 65001 >nul
title KARMED UTT RAHBARIYAT ADMIN ANALITIKA DASHBORTI
cd /d c:\Users\Rentgen xona\Desktop\UTT

echo ===============================================================================
echo       RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA TIBBIYOT MARKAZI
echo       KARMED UTT — RAHBARIYAT ADMIN ANALITIKA DASHBORTI (v8.0.0)
echo ===============================================================================
echo.
echo   * Admin Dashbort:    http://localhost:9880/admin.html
echo   * Shifoxona Wi-Fi:   http://10.34.17.210:9880/admin.html
echo   * Karmed Serveri:    192.168.150.111:2025
echo.

netstat -ano | findstr :9880 | findstr LISTENING >nul
if %errorlevel% neq 0 (
    echo [1/2] Server ishga tushirilmoqda...
    start /b node logger_server.js
    timeout /t 2 >nul
) else (
    echo [OK] Server faol ishlab turibdi!
)

echo [2/2] Brauzerda Admin paneli ochilmoqda: http://localhost:9880/admin.html
start http://localhost:9880/admin.html

timeout /t 2 >nul
