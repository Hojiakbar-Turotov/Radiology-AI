@echo off
title UTT TV SISTEM — LOKAL TARMOQ SERVERI
color 0b
cls

echo ==================================================================
echo   🏥 RESPUBLIKA ONKOLOGIYA VA RADIOLOGIYA MARKAZI
echo   📺 UTT TV SISTEM — 100%% LOKAL TARMOQ (LAN) SERVERI
echo ==================================================================
echo.
echo  [1/2] Lokal tarmoq sozlamalari tekshirilmoqda...
echo.

cd /d "%~dp0\server"

if not exist "node_modules\ws" (
  echo  [2/2] Birinchi marta ishga tushirish uchun modullar tekshirilmoqda...
)

echo.
echo  🚀 Server ishga tushirilmoqda...
echo  (Darchani yopmang, server ishlab turishi shart!)
echo.

start http://localhost:3000/tv
node server.js

pause
