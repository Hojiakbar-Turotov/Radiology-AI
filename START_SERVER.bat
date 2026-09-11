@echo off
chcp 65001 >nul
title Karmed UTT Navbat va Logger Server (v3.0.0)
cd /d "%~dp0"
if exist "server.exe" (
    server.exe
) else (
    node logger_server.js
)
pause
