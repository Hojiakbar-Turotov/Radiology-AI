@echo off
title Radiodiagnostika Telegram Bot Runner
color 0b
cd /d "%~dp0"
echo ===================================================
echo   Radiodiagnostika Telegram Boti Ishga Tushmoqda...
echo   Bot: @Radiodiagnostika_bot
echo   Log Guruhi: -1003950231961
echo   Foydalanuvchilar: data/bot_users.json
echo ===================================================
echo.

if exist "%~dp0node.exe" (
    "%~dp0node.exe" bot-runner.js
) else (
    node bot-runner.js
)

pause
