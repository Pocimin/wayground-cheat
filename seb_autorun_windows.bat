@echo off
:: This file is called by SEB via Permitted Processes > Autostart
:: It launches the overlay silently — nothing visible in taskbar
set INSTALL_DIR=%LOCALAPPDATA%\ExamHelper
set PY=%INSTALL_DIR%\venv\Scripts\pythonw.exe
set APP=%INSTALL_DIR%\app.py

:: Kill any existing instance
taskkill /f /im pythonw.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Launch silently — pythonw has no console window
start "" /b "%PY%" "%APP%"
