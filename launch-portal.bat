@echo off
title MIT WPU Control Portal
echo.
echo  ==================================================
echo   MIT WPU System Launcher Portal (Port 3000)
echo  ==================================================
echo.
echo  Starting launcher control portal...
echo.

:: Open launcher page in browser after 1 second
start /b cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:3000"

:: Start express server
node launcher.js
