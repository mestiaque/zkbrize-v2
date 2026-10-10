@echo off
title ZK Bridge - Install Windows Service
cd /d "%~dp0"

:: Re-launch with Administrator rights if needed
net session >nul 2>&1
if errorlevel 1 (
    echo Requesting Administrator rights...
    powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
)

:: Stop a manually started copy so the service can use the port
call stop.bat nopause >nul 2>&1

node scripts\service.js install
echo.
pause
