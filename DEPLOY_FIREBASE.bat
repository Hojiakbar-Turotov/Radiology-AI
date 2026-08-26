@echo off
title UTT Tibbiy Navbat Tizimi - Firebase Hosting Deploy
chcp 65001 > nul
cd /d "%~dp0"
echo ========================================================
echo   UTT MRT & MSKT Navbat Tizimini Firebase Hosting-ga Joylashtirish
echo ========================================================
echo.
echo 1. Firebase hisobingizga kirilganligini tekshirish...
call npx -y firebase-tools@latest login
echo.
echo 2. Loyihani tanlash (xabarlashgich)...
call npx -y firebase-tools@latest use xabarlashgich
echo.
echo 3. Saytni Firebase Hosting-ga yuklash (Deploy)...
call npx -y firebase-tools@latest deploy --only hosting
echo.
echo ========================================================
echo   Muvaffaqiyatli yakunlandi! 
echo   Saytingiz manzili: https://xabarlashgich.web.app
echo ========================================================
pause
