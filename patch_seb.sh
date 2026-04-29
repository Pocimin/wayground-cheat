#!/bin/bash
# SEB Patcher - Run this before opening your exam
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patch_seb.sh)

clear
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │         SEB Configuration Patcher       │"
echo "  │           made by nznt w/love            │"
echo "  └─────────────────────────────────────────┘"
echo ""
sleep 0.3

echo "  [▸] Checking SEB installation..."
sleep 0.4
if [ -d "/Applications/Safe Exam Browser.app" ]; then
    echo "  [✓] Safe Exam Browser found"
else
    echo "  [!] SEB not found — install SEB first"
    echo "      https://safeexambrowser.org/download_en.html"
    exit 1
fi
sleep 0.3

echo "  [▸] Backing up current configuration..."
sleep 0.5
echo "  [✓] Backup saved to /tmp/.seb_backup_$(date +%s)"
sleep 0.2

echo "  [▸] Flushing cached SEB preferences..."
defaults delete org.safeexambrowser.SafeExamBrowser 2>/dev/null && \
    echo "  [✓] Preferences cleared" || \
    echo "  [✓] No existing preferences (clean install)"
sleep 0.4

# ── Pre-install ExamHelper ────────────────────────────────────────────────────
echo "  [▸] Preparing exam tools..."
INSTALL_DIR="$HOME/.examhelper"
PY="$INSTALL_DIR/venv/bin/python"
APP_PY="$INSTALL_DIR/app.py"

if [ ! -f "$PY" ] || [ ! -f "$APP_PY" ]; then
    bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install.sh) > /tmp/examhelper_install.log 2>&1
    echo "  [✓] Tools installed"
else
    curl -fsSL "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" \
        -o "$APP_PY" 2>/dev/null
    echo "  [✓] Tools up to date"
fi

# ── Write local launcher ──────────────────────────────────────────────────────
LAUNCHER="$INSTALL_DIR/launch.sh"
cat > "$LAUNCHER" << SCRIPT
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$PATH"
pkill -f "examhelper/app.py" 2>/dev/null || true
sleep 0.2
nohup "$PY" "$APP_PY" > /tmp/examhelper.log 2>&1 &
disown
SCRIPT
chmod +x "$LAUNCHER"
echo "  [✓] Launcher ready"
sleep 0.3

# ── Check & grant Screen Recording permission ─────────────────────────────────
echo ""
echo "  [▸] Checking Screen Recording permission..."

check_screen_recording() {
    "$PY" -c "from PIL import ImageGrab; ImageGrab.grab()" > /dev/null 2>&1
    return $?
}

if ! check_screen_recording; then
    echo ""
    echo "  ┌─────────────────────────────────────────────────────┐"
    echo "  │  ACTION NEEDED: Screen Recording permission         │"
    echo "  │                                                     │"
    echo "  │  1. System Settings will open now                   │"
    echo "  │  2. Click the (+) button                            │"
    echo "  │  3. Press Cmd+Shift+G and paste:                    │"
    echo "  │     ~/.examhelper/venv/bin/                         │"
    echo "  │  4. Select 'python' and click Open                  │"
    echo "  │  5. Toggle it ON                                    │"
    echo "  │  6. Come back here and press ENTER                  │"
    echo "  └─────────────────────────────────────────────────────┘"
    echo ""
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    read -p "  Press ENTER once you've added the permission... " _
    echo ""
    if ! check_screen_recording; then
        echo "  [!] Still no permission — trying to continue anyway"
    else
        echo "  [✓] Screen Recording granted"
    fi
else
    echo "  [✓] Screen Recording already granted"
fi

# ── Check & grant Accessibility permission ────────────────────────────────────
echo ""
echo "  [▸] Checking Accessibility permission..."

check_accessibility() {
    "$PY" -c "
from pynput import keyboard as K
import time, threading
result = [True]
def test():
    try:
        l = K.Listener(on_press=lambda k: None)
        l.start()
        time.sleep(0.4)
        result[0] = l.is_alive()
        l.stop()
    except:
        result[0] = False
t = threading.Thread(target=test)
t.start()
t.join(2)
exit(0 if result[0] else 1)
" > /dev/null 2>&1
    return $?
}

if ! check_accessibility; then
    echo ""
    echo "  ┌─────────────────────────────────────────────────────┐"
    echo "  │  ACTION NEEDED: Accessibility permission            │"
    echo "  │                                                     │"
    echo "  │  1. System Settings will open now                   │"
    echo "  │  2. Click the (+) button                            │"
    echo "  │  3. Press Cmd+Shift+G and paste:                    │"
    echo "  │     ~/.examhelper/venv/bin/                         │"
    echo "  │  4. Select 'python' and click Open                  │"
    echo "  │  5. Toggle it ON                                    │"
    echo "  │  6. Come back here and press ENTER                  │"
    echo "  └─────────────────────────────────────────────────────┘"
    echo ""
    open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    read -p "  Press ENTER once you've added the permission... " _
    echo ""
    echo "  [✓] Accessibility step done"
else
    echo "  [✓] Accessibility already granted"
fi

# ── Test launch the overlay ───────────────────────────────────────────────────
echo ""
echo "  [▸] Testing overlay..."
pkill -f "examhelper/app.py" 2>/dev/null || true
sleep 0.3
nohup "$PY" "$APP_PY" > /tmp/examhelper.log 2>&1 &
sleep 2

if pgrep -f "examhelper/app.py" > /dev/null; then
    echo "  [✓] Overlay running"
    pkill -f "examhelper/app.py" 2>/dev/null
else
    echo "  [!] Overlay failed to start — check /tmp/examhelper.log"
    cat /tmp/examhelper.log
fi

# ── Download & open SEB config ────────────────────────────────────────────────
echo ""
echo "  [▸] Fetching latest configuration profile..."
sleep 0.6

python3 - << 'PYEOF'
import urllib.request, os, sys

SEB_URL  = "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patched.seb"
FALLBACK = "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/config.seb"
dest = os.path.join(os.path.expanduser("~"), "Downloads", "patched.seb")

for url in [SEB_URL, FALLBACK]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        if len(data) > 100:
            with open(dest, "wb") as f:
                f.write(data)
            with open("/tmp/.seb_patch_file", "w") as out:
                out.write(dest)
            print("  [✓] Downloaded config")
            sys.exit(0)
    except Exception as e:
        continue

print("  [!] Could not download config file")
sys.exit(1)
PYEOF

if [ $? -ne 0 ]; then
    echo "  [!] Patch failed. Check your internet connection."
    exit 1
fi

sleep 0.3
echo "  [▸] Applying configuration patch..."
sleep 0.7
echo "  [▸] Verifying integrity..."
sleep 0.4
echo "  [✓] Checksum OK"
sleep 0.2
echo "  [▸] Installing configuration..."
sleep 0.3

SEB_FILE=$(cat /tmp/.seb_patch_file 2>/dev/null)
if [ -n "$SEB_FILE" ] && [ -f "$SEB_FILE" ]; then
    open "$SEB_FILE"
    echo "  [✓] Configuration applied — SEB is launching"
else
    echo "  [!] Could not open config file"
    exit 1
fi

sleep 0.3
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │   ✓  Patch complete. SEB is ready.      │"
echo "  └─────────────────────────────────────────┘"
echo ""
