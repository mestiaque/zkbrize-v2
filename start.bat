@echo off
title AttendBridge Launcher
cd /d "%~dp0"

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found!
    echo Please install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

:: Install dependencies if needed (setup runs automatically after install)
if exist "node_modules" goto :setup
echo Installing dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed!
    pause
    exit /b 1
)
goto :start

:setup
node scripts\setup.js

:start
set "PORT=3000"
for /f "tokens=1,* delims==" %%a in ('findstr /b "PORT=" .env 2^>nul') do set "PORT=%%b"
set "URL=http://localhost:%PORT%"

:: Installed as a Windows service? Then it is already running in the background.
sc query "attendbridge.exe" >nul 2>&1
if errorlevel 1 goto :checkpm2
sc query "attendbridge.exe" | findstr "RUNNING" >nul 2>&1
if errorlevel 1 (
    echo Starting Windows service...
    net start "attendbridge.exe" >nul 2>&1
    if errorlevel 1 echo [WARN] Could not start the service. Run as Administrator or start it from Services.
)
goto :wait

:checkpm2
where pm2 >nul 2>&1
if errorlevel 1 goto :nopm2

call pm2 describe attendbridge >nul 2>&1
if errorlevel 1 (
    echo Starting server with PM2...
    call pm2 start ecosystem.config.js
) else (
    echo Restarting existing server...
    call pm2 restart attendbridge --update-env
)
goto :wait

:nopm2
echo Starting server...
:: Stop any existing server on this port
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
start "AttendBridge Server" /min cmd /c "node src\server.js > logs\server.log 2>&1"

:wait
echo Waiting for server to start...
ping -n 5 127.0.0.1 >nul

start "" "%URL%"
echo.
echo Server is running at %URL%
echo Close this window to keep server running in background.
echo.
ping -n 4 127.0.0.1 >nul
exit /b 0
