@echo off
title Omen - WhatsApp Gateway
cd /d %~dp0wppconnect-server
echo ===================================================
echo Starting Omen WhatsApp Gateway (Port 21465)...
echo ===================================================
npm run dev
pause
