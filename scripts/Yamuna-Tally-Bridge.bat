@echo off
title Yamuna Plastics - Tally Prime Cloud Bridge
cls
echo ========================================================
echo   YAMUNA PLASTICS - TALLY PRIME CLOUD BRIDGE CONNECTOR
echo ========================================================
echo.
echo Starting real-time sync with Tally Prime and Yamuna Portal...
echo Keep this window minimized while using Tally Prime.
echo.
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0Yamuna-Tally-Bridge.ps1"
pause
