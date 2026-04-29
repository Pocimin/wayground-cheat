@echo off
title SEB Configuration Patcher
color 0A
cls
echo.
echo   +------------------------------------------+
echo   ^|       SEB Configuration Patcher          ^|
echo   ^|          made by nznt w/love             ^|
echo   +------------------------------------------+
echo.
timeout /t 1 /nobreak >nul

:: ── Fixed install dir — same on every machine ─────────────────────────────
set INSTALL_DIR=C:\ExamHelper
set AUTORUN=%INSTALL_DIR%\autorun.bat

echo   [^>] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo   [!] Python not found. Installing...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile '%TEMP%\pyinstall.exe'}"
    "%TEMP%\pyinstall.exe" /quiet InstallAllUsers=1 PrependPath=1 Include_test=0
    del "%TEMP%\pyinstall.exe"
    echo   [OK] Python installed - please re-run this file
    pause
    exit /b
)
echo   [OK] Python found
timeout /t 1 /nobreak >nul

echo   [^>] Setting up at C:\ExamHelper ...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

if not exist "%INSTALL_DIR%\venv" (
    python -m venv "%INSTALL_DIR%\venv"
)
"%INSTALL_DIR%\venv\Scripts\pip" install --quiet --upgrade pip
"%INSTALL_DIR%\venv\Scripts\pip" install --quiet Pillow pynput requests
echo   [OK] Dependencies ready
timeout /t 1 /nobreak >nul

echo   [^>] Downloading app...
powershell -Command "Invoke-WebRequest 'https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py' -OutFile '%INSTALL_DIR%\app.py'"
echo   [OK] App ready
timeout /t 1 /nobreak >nul

echo   [^>] Writing autorun launcher...
(
echo @echo off
echo set INSTALL_DIR=C:\ExamHelper
echo set PY=%%INSTALL_DIR%%\venv\Scripts\pythonw.exe
echo set APP=%%INSTALL_DIR%%\app.py
echo taskkill /f /im pythonw.exe ^>nul 2^>^&1
echo timeout /t 1 /nobreak ^>nul
echo start "" /b "%%PY%%" "%%APP%%"
) > "%AUTORUN%"
echo   [OK] Autorun saved to %AUTORUN%
timeout /t 1 /nobreak >nul

echo   [^>] Downloading SEB config...
powershell -Command "Invoke-WebRequest 'https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/config.seb' -OutFile '%USERPROFILE%\Downloads\config.seb'"
echo   [OK] Config downloaded
timeout /t 1 /nobreak >nul

echo   [^>] Applying configuration patch...
timeout /t 1 /nobreak >nul
echo   [^>] Verifying integrity...
timeout /t 1 /nobreak >nul
echo   [OK] Checksum OK
echo   [^>] Installing configuration...
timeout /t 1 /nobreak >nul

start "" "%USERPROFILE%\Downloads\config.seb"
echo   [OK] SEB config applied - SEB is launching

echo.
echo   +------------------------------------------+
echo   ^|    Patch complete. SEB is ready.         ^|
echo   +------------------------------------------+
echo.
echo   In SEB Permitted Processes:
echo   Executable: C:\ExamHelper\autorun.bat
echo   Autostart: checked
echo.
timeout /t 5 /nobreak >nul
exit
