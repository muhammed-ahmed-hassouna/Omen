@echo off
title Omen - Full Stack Development Mode
cd /d %~dp0
echo ===================================================
echo Starting Omen Backend Server (Port 3000)...
echo ===================================================
start "Omen Backend (Port 3000)" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo ===================================================
echo Starting Omen React Vite UI (Port 5173)...
echo ===================================================
start "Omen React UI (Port 5173)" cmd /k "npm run dev:ui"
