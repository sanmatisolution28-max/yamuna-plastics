@echo off
title Yamuna Plastics - Enterprise Billing & Tally Engine
color 0B
echo ======================================================================
echo    YAMUNA PLASTICS - MOBILE BILLING & TALLY PRIME INTEGRATION
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Backend API Server (Port 5005)...
start "Yamuna Plastics - Backend Server (Port 5005)" cmd /k "cd server && node index.js"

timeout /t 2 /nobreak >nul

echo [2/3] Starting Frontend Web Application (Port 5173)...
start "Yamuna Plastics - Frontend Client (Port 5173)" cmd /k "cd client && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Opening Web App in Browser...
start http://localhost:5173

echo.
echo ======================================================================
echo  Yamuna Plastics System is LIVE and Running!
echo  - PC / Desktop Browser : http://localhost:5173
echo  - Tally Prime Status   : http://localhost:5005/api/tally/status
echo ======================================================================
echo.
pause
