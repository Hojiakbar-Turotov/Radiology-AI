@echo off
title UTT TV SISTEM — LOKAL TARMOQ SERVERI
color 0b
cls

echo ==================================================================
echo   🏥 RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA MARKAZI
echo   📺 UTT TV SISTEM — 100%% LOKAL TARMOQ (LAN / WI-FI) SERVERI
echo ==================================================================
echo.
echo  [1/2] Lokal tarmoq sozlamalari tekshirilmoqda...
echo.

cd /d "%~dp0\server"

echo.
echo  🚀 Server ishga tushirilmoqda...
echo  (Ushbu darchani yopmang, server ishlab turishi shart!)
echo.

start http://localhost:3000/admin
start http://localhost:3000/tv
node server.js

pause
