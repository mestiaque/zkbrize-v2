@echo off
title ZK Bridge - Stop Server
cd /d "%~dp0"

:: Installed as a Windows service?
sc query "zkbridge.exe" >nul 2>&1
if errorlevel 1 goto :pm2
net stop "zkbridge.exe" >nul 2>&1
if errorlevel 1 (
    echo The server runs as a Windows service. Run this file as Administrator to stop it,
    echo or use uninstall-service.bat to remove the service.
) else (
    echo Service stopped.
)
goto :done

:pm2
where pm2 >nul 2>&1
if errorlevel 1 goto :nopm2
call pm2 describe zk-bridge >nul 2>&1
if errorlevel 1 goto :nopm2
call pm2 stop zk-bridge >nul 2>&1
echo Server stopped (PM2).
goto :done

:nopm2
set "PORT=3000"
for /f "tokens=1,* delims==" %%a in ('findstr /b "PORT=" .env 2^>nul') do set "PORT=%%b"
set "FOUND="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
    set "FOUND=1"
)
if defined FOUND (echo Server stopped.) else (echo No running server found.)

:done
if /i not "%~1"=="nopause" pause
