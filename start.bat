@echo off
title MIT WPU Exam Management System

echo.
echo  ==========================================
echo   MIT WPU Exam Management System
echo  ==========================================
echo.
echo  Starting servers...
echo.

:: Start the backend server in a new window
start "Backend Server (port 5000)" cmd /k "cd /d %~dp0server && npm run dev"

:: Small delay to let the backend boot first
timeout /t 2 /nobreak >nul

:: Start the frontend server in a new window
start "Frontend Server (port 5173)" cmd /k "cd /d %~dp0client && npm run dev"

:: Small delay before opening browser
timeout /t 3 /nobreak >nul

:: Open the app in the default browser
start "" "http://localhost:5173"

echo  Backend  →  http://localhost:5000
echo  Frontend →  http://localhost:5173
echo.
echo  Both servers are starting in separate windows.
echo  Close those windows to stop the servers.
echo.
pause
