@echo off
:: Launched by SEB autostart — runs the overlay silently
set INSTALL_DIR=C:\ExamHelper
set PY=%INSTALL_DIR%\venv\Scripts\pythonw.exe
set APP=%INSTALL_DIR%\app.py

taskkill /f /im pythonw.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" /b "%PY%" "%APP%"
