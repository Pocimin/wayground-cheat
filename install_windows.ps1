# ExamHelper Windows Installer
# Run with: powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install_windows.ps1 | iex"

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ExamHelper Setup" -ForegroundColor Green
Write-Host "  made by nznt w/love" -ForegroundColor DarkGray
Write-Host ""

$INSTALL_DIR = "$env:LOCALAPPDATA\ExamHelper"
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

# ── 1. Check / Install Python ─────────────────────────────────────────────────
Write-Host "[1/6] Checking Python..." -ForegroundColor Cyan
$python = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "3\.(1[0-9]|[2-9]\d)") {
            $python = $cmd
            Write-Host "  Found: $ver" -ForegroundColor Green
            break
        }
    } catch {}
}

if (-not $python) {
    Write-Host "  Installing Python 3.11..." -ForegroundColor Yellow
    $installer = "$env:TEMP\python_installer.exe"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile $installer
    Start-Process $installer -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0" -Wait
    Remove-Item $installer -Force
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH","User")
    foreach ($cmd in @("python","python3","py")) {
        try { $ver = & $cmd --version 2>&1; if ($ver -match "Python 3") { $python = $cmd; break } } catch {}
    }
    if (-not $python) {
        Write-Host "  Python install failed. Restart and re-run." -ForegroundColor Red
        pause; exit 1
    }
    Write-Host "  Python installed." -ForegroundColor Green
}

# ── 2. Virtualenv ─────────────────────────────────────────────────────────────
Write-Host "[2/6] Setting up environment..." -ForegroundColor Cyan
$venv = "$INSTALL_DIR\venv"
if (-not (Test-Path $venv)) { & $python -m venv $venv }
$py      = "$venv\Scripts\python.exe"
$pythonw = "$venv\Scripts\pythonw.exe"
$pip     = "$venv\Scripts\pip.exe"

# ── 3. Dependencies ───────────────────────────────────────────────────────────
Write-Host "[3/6] Installing dependencies..." -ForegroundColor Cyan
& $pip install --quiet --upgrade pip
& $pip install --quiet Pillow pynput requests
Write-Host "  Done." -ForegroundColor Green

# ── 4. Download app.py ────────────────────────────────────────────────────────
Write-Host "[4/6] Downloading app..." -ForegroundColor Cyan
Invoke-WebRequest "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" -OutFile "$INSTALL_DIR\app.py"
Write-Host "  Done." -ForegroundColor Green

# ── 5. Download & open SEB config (Windows uses config.seb) ──────────────────
Write-Host "[5/6] Applying SEB config..." -ForegroundColor Cyan
$sebDest = "$env:USERPROFILE\Downloads\config.seb"
try {
    Invoke-WebRequest "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/config.seb" -OutFile $sebDest
    Start-Process $sebDest
    Write-Host "  SEB config opened." -ForegroundColor Green
} catch {
    Write-Host "  SEB config skipped: $_" -ForegroundColor Yellow
}

# ── 6. Desktop shortcut ───────────────────────────────────────────────────────
Write-Host "[6/6] Creating Desktop shortcut..." -ForegroundColor Cyan
try {
    # Get the real Desktop path (works even if redirected)
    $desktopPath = [Environment]::GetFolderPath("Desktop")
    if (-not (Test-Path $desktopPath)) {
        New-Item -ItemType Directory -Force -Path $desktopPath | Out-Null
    }
    $shortcut = "$desktopPath\ExamHelper.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($shortcut)
    $lnk.TargetPath = $pythonw
    $lnk.Arguments = "`"$INSTALL_DIR\app.py`""
    $lnk.WorkingDirectory = $INSTALL_DIR
    $lnk.Description = "ExamHelper"
    $lnk.Save()
    Write-Host "  Shortcut created: $shortcut" -ForegroundColor Green
} catch {
    Write-Host "  Shortcut skipped (non-fatal): $_" -ForegroundColor Yellow
}

# ── Launch ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Shift+A  -> Screenshot + answer" -ForegroundColor White
Write-Host "  Shift+Z  -> Show/hide" -ForegroundColor White
Write-Host "  F10      -> Quit" -ForegroundColor White
Write-Host ""
Write-Host "Launching ExamHelper..." -ForegroundColor Green
Start-Process $pythonw -ArgumentList "`"$INSTALL_DIR\app.py`""
