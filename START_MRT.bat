@echo off
title KARMED MRT VA MSKT AQLLI NAVBAT SERVERI (Port 9890)
color 0a
cd /d "%~dp0"

echo ========================================================
echo   KARMED RADIOLOGY - MRT VA MSKT AQLLI NAVBAT TIZIMI
echo ========================================================
echo   * Port:                   9890
echo   * TV Tablo (Ovozsiz):     http://localhost:9890/tv
echo   * Aqlli Navbat & Control: http://localhost:9890/control
echo ========================================================
echo.

if exist "%~dp0node.exe" (
    start "" "http://localhost:9890/control"
    start "" "http://localhost:9890/tv"
    "%~dp0node.exe" mrt_server.js
) else (
    start "" "http://localhost:9890/control"
    start "" "http://localhost:9890/tv"
    node mrt_server.js
)

pause
