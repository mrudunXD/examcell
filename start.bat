@echo off
title MIT WPU Exam Management System

echo.
echo  ==================================================
echo   MIT WPU Exam Management System (Single Terminal)
echo  ==================================================
echo.
echo  Starting backend and frontend servers...
echo.

:: Launch browser in background after a 4-second delay
start /b cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"

:: Run the unified terminal server startup script
npm start
