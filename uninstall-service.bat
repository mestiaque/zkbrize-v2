@echo off
title ZK Bridge - Remove Windows Service
cd /d "%~dp0"

net session >nul 2>&1
if errorlevel 1 (
    echo Requesting Administrator rights...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

node scripts\service.js uninstall
echo.
pause
