# ExamHelper autorun for Windows — run inside SEB
# Usage: powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/autorun_windows.ps1 | iex"

$INSTALL_DIR = "$env:LOCALAPPDATA\ExamHelper"
$py  = "$INSTALL_DIR\venv\Scripts\pythonw.exe"
$app = "$INSTALL_DIR\app.py"

# ── Install if not present ────────────────────────────────────────────────────
if (-not (Test-Path $py) -or -not (Test-Path $app)) {
    # Run full installer silently
    $job = Start-Job -ScriptBlock {
        powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install_windows.ps1 | iex" *>$null
    }
    # Wait up to 120s for install
    for ($i = 0; $i -lt 120; $i++) {
        if ((Test-Path $py) -and (Test-Path $app)) { break }
        Start-Sleep 1
    }
    Stop-Job $job -ErrorAction SilentlyContinue
}

# ── Kill existing instance ────────────────────────────────────────────────────
Get-Process pythonw -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowTitle -eq "" 
} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300

# ── Launch silently ───────────────────────────────────────────────────────────
Start-Process $py -ArgumentList "`"$app`"" -WindowStyle Hidden
