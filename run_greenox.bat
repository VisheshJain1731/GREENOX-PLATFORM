@echo off
title GREENOX Web Platform
echo ========================================================
echo          GREENOX ECO-CLEAN WEB PLATFORM
echo ========================================================
echo.
echo [1] Local URL:     http://localhost:3000
echo [2] Local Wi-Fi:   http://192.168.1.52:3000
echo [3] Global Public: Check console output or PUBLIC_URL.txt
echo.
echo Launching GREENOX server and global tunnel...
python server.py
pause
