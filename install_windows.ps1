# ExamHelper Windows Installer
# Run with: powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install_windows.ps1 | iex"

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ExamHelper Setup" -ForegroundColor Green
Write-Host ""

$INSTALL_DIR = "$env:LOCALAPPDATA\ExamHelper"
New-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null

# ── 1. Check / Install Python ─────────────────────────────────────────────────
Write-Host "Checking Python..." -ForegroundColor Cyan
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
    Write-Host "  Python not found. Installing Python 3.11..." -ForegroundColor Yellow
    $installer = "$env:TEMP\python_installer.exe"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe" -OutFile $installer
    Start-Process $installer -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0" -Wait
    Remove-Item $installer -Force

    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

    foreach ($cmd in @("python", "python3", "py")) {
        try {
            $ver = & $cmd --version 2>&1
            if ($ver -match "Python 3") { $python = $cmd; break }
        } catch {}
    }

    if (-not $python) {
        Write-Host "  Python install failed. Please restart and re-run this script." -ForegroundColor Red
        Write-Host "  Or install manually from https://python.org" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host "  Python installed." -ForegroundColor Green
}

# ── 2. Create virtualenv ──────────────────────────────────────────────────────
Write-Host "Setting up environment..." -ForegroundColor Cyan
$venv = "$INSTALL_DIR\venv"
if (-not (Test-Path $venv)) {
    & $python -m venv $venv
}
$py  = "$venv\Scripts\python.exe"
$pip = "$venv\Scripts\pip.exe"

# ── 3. Install dependencies ───────────────────────────────────────────────────
Write-Host "Installing dependencies..." -ForegroundColor Cyan
& $pip install --quiet --upgrade pip
& $pip install --quiet Pillow pynput requests
Write-Host "  Done." -ForegroundColor Green

# ── 4. Download app.py ────────────────────────────────────────────────────────
Write-Host "Downloading app..." -ForegroundColor Cyan
Invoke-WebRequest "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" -OutFile "$INSTALL_DIR\app.py"
Write-Host "  Done." -ForegroundColor Green

# ── 5. SEB config ─────────────────────────────────────────────────────────────
Write-Host "Applying SEB config..." -ForegroundColor Cyan
& $py -c @"
import urllib.request, json, os, subprocess
try:
    req = urllib.request.Request(
        'https://api.github.com/repos/Pocimin/wayground-cheat/contents',
        headers={'User-Agent': 'Mozilla/5.0'}
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        files = json.loads(r.read().decode())
    seb = [f for f in files if f['name'].endswith('.seb')]
    for f in seb:
        dest = os.path.join(os.path.expanduser('~'), 'Downloads', f['name'])
        urllib.request.urlretrieve(f['download_url'], dest)
        os.startfile(dest)
        print('Opened', f['name'])
except Exception as e:
    print('SEB skipped:', e)
"@

# ── 6. Desktop shortcut ───────────────────────────────────────────────────────
Write-Host "Creating Desktop shortcut..." -ForegroundColor Cyan
$pythonw = "$venv\Scripts\pythonw.exe"
$shortcut = "$env:USERPROFILE\Desktop\ExamHelper.lnk"
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($shortcut)
$lnk.TargetPath = $pythonw
$lnk.Arguments = "`"$INSTALL_DIR\app.py`""
$lnk.WorkingDirectory = $INSTALL_DIR
$lnk.Description = "ExamHelper"
$lnk.Save()
Write-Host "  Shortcut created on Desktop." -ForegroundColor Green

# ── 7. Launch ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Shift+A  -> Screenshot + answer" -ForegroundColor White
Write-Host "  Shift+Z  -> Show/hide" -ForegroundColor White
Write-Host "  F10      -> Quit" -ForegroundColor White
Write-Host ""
Write-Host "Launching ExamHelper..." -ForegroundColor Green
Start-Process $pythonw -ArgumentList "`"$INSTALL_DIR\app.py`""
