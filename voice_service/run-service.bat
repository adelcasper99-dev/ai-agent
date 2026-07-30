@echo off
chcp 65001 > nul
echo ========================================================
echo   Casper Voice & ERP — 24/7 PM2 Service Launcher
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/4] Checking PM2 installation...
call pm2 -v >nul 2>&1
if %errorlevel% neq 0 (
    echo PM2 not found. Installing pm2 and pm2-windows-startup globally...
    call npm install -g pm2 pm2-windows-startup
) else (
    echo PM2 is already installed.
)

echo [2/4] Registering Windows Auto-Startup...
call pm2-startup install >nul 2>&1

echo [3/4] Starting Casper Voice Agent in production 24/7 mode...
call pm2 start ecosystem.config.js

echo [4/4] Saving PM2 state for Windows auto-reboot persistence...
call pm2 save

echo.
echo ========================================================
echo   ✅ Casper Voice Agent is NOW RUNNING 24/7 ONLINE!
echo   Command shortcuts:
echo   - View live logs:      pm2 logs casper-voice-agent
echo   - Check status:        pm2 status
echo   - Restart agent:       pm2 restart casper-voice-agent
echo   - Stop agent:          pm2 stop casper-voice-agent
echo ========================================================
echo.
pause
