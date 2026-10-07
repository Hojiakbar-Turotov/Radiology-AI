@echo off
chcp 65001 >nul
title RADIOLOGY AI — 24/7 XIZMATLARNI TO'XTATISH
color 0c
cd /d "%~dp0"

echo ===============================================================================
echo   RADIOLOGY AI & UTT — 24/7 SERVERLARNI TO'XTATISH
echo ===============================================================================
echo.

echo [1/3] Master runner to'xtatilmoqda...
for /f "tokens=2" %%a in ('tasklist ^| findstr /i "wscript.exe"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [2/3] Server portlari tozalanmoqda (9890, 9891, 9876-9883)...
for %%p in (9890 9891 9876 9877 9878 9879 9880) do (
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%%p ^| findstr LISTENING') do (
        taskkill /F /PID %%a >nul 2>&1
    )
)

echo [3/3] Monitoring va Bot to'xtatilmoqda...
wmic process where "CommandLine like '%%service_runner_24_7.js%%'" call terminate >nul 2>&1
wmic process where "CommandLine like '%%mrt_monitor_agent.js%%'" call terminate >nul 2>&1
wmic process where "CommandLine like '%%bot-runner.js%%'" call terminate >nul 2>&1

echo.
echo [OK] Barcha serverlar va monitoring xizmatlari to'xtatildi.
timeout /t 3 >nul
exit
