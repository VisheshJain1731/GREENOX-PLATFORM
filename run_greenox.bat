@echo off
title GREENOX Eco-Clean Web Platform
cls
echo ========================================================
echo          GREENOX ECO-CLEAN WEB PLATFORM
echo ========================================================
echo.
echo [*] Local URL:       http://localhost:3000
echo [*] Wi-Fi URL:       Displayed in console when server starts
echo [*] Global Public:   Generated live and saved in PUBLIC_URL.txt
echo.
echo Launching GREENOX server and global tunnel...
python server.py
pause

