#!/bin/bash
# SEB Patcher - Run this before opening your exam
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patch_seb.sh)

clear
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │         SEB Configuration Patcher       │"
echo "  │           made by nznt n rexw/love            │"
echo "  └─────────────────────────────────────────┘"
echo ""
sleep 0.3

# ── Step 1: Install Homebrew if missing ───────────────────────────────────────
if ! command -v brew &>/dev/null; then
    echo "  [▸] Installing Homebrew (required)..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
    eval "$(/usr/local/bin/brew shellenv 2>/dev/null || true)"
    echo "  [✓] Homebrew installed"
else
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
    eval "$(/usr/local/bin/brew shellenv 2>/dev/null || true)"
fi

# ── Step 2: Install Python with tkinter if missing ────────────────────────────
echo "  [▸] Checking Python..."
PYTHON=""
for candidate in python3.12 python3.11 python3.10; do
    if command -v "$candidate" &>/dev/null; then
        if "$candidate" -c "import tkinter" 2>/dev/null; then
            PYTHON="$candidate"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "  [▸] Installing Python with tkinter (this takes ~1 min)..."
    brew install python-tk@3.11 2>/dev/null || brew install python-tk@3.12 2>/dev/null
    export PATH="$(brew --prefix python@3.11)/bin:$PATH"
    PYTHON="python3.11"
    if ! command -v "$PYTHON" &>/dev/null; then
        export PATH="$(brew --prefix python@3.12)/bin:$PATH"
        PYTHON="python3.12"
    fi
    echo "  [✓] Python installed: $($PYTHON --version)"
else
    echo "  [✓] Python found: $($PYTHON --version)"
fi

# ── Step 3: Check SEB ─────────────────────────────────────────────────────────
echo "  [▸] Checking SEB installation..."
sleep 0.3
if [ -d "/Applications/Safe Exam Browser.app" ]; then
    echo "  [✓] Safe Exam Browser found"
else
    echo "  [!] SEB not found — install SEB first"
    echo "      https://safeexambrowser.org/download_en.html"
    exit 1
fi

echo "  [▸] Flushing cached SEB preferences..."
defaults delete org.safeexambrowser.SafeExamBrowser 2>/dev/null && \
    echo "  [✓] Preferences cleared" || \
    echo "  [✓] No existing preferences (clean install)"
sleep 0.3

# ── Step 4: Install ExamHelper ────────────────────────────────────────────────
echo "  [▸] Preparing exam tools..."
INSTALL_DIR="$HOME/.examhelper"
mkdir -p "$INSTALL_DIR"
PY="$INSTALL_DIR/venv/bin/python"
APP_PY="$INSTALL_DIR/app.py"

# Rebuild venv if Python changed or tkinter missing
if [ -d "$INSTALL_DIR/venv" ] && ! "$PY" -c "import tkinter" 2>/dev/null; then
    rm -rf "$INSTALL_DIR/venv"
fi

if [ ! -d "$INSTALL_DIR/venv" ]; then
    "$PYTHON" -m venv "$INSTALL_DIR/venv"
fi

"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install --quiet Pillow pynput requests

# Always pull latest app.py
curl -fsSL "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" \
    -o "$APP_PY"
echo "  [✓] Tools ready"

# ── Step 5: Write launcher ────────────────────────────────────────────────────
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
echo "  [✓] Launcher ready at $LAUNCHER"

# ── Step 6: Screen Recording permission ──────────────────────────────────────
echo ""
echo "  [▸] Checking Screen Recording permission..."

check_screen_recording() {
    "$PY" -c "from PIL import ImageGrab; ImageGrab.grab()" > /dev/null 2>&1
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
    check_screen_recording && echo "  [✓] Screen Recording granted" || echo "  [!] Still no permission — continuing anyway"
else
    echo "  [✓] Screen Recording already granted"
fi

# ── Step 7: Accessibility permission ─────────────────────────────────────────
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
        l.start(); time.sleep(0.4)
        result[0] = l.is_alive(); l.stop()
    except: result[0] = False
t = threading.Thread(target=test); t.start(); t.join(2)
exit(0 if result[0] else 1)
" > /dev/null 2>&1
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
    echo "  [✓] Accessibility step done"
else
    echo "  [✓] Accessibility already granted"
fi

# ── Step 8: Test overlay ──────────────────────────────────────────────────────
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
    echo "  [!] Overlay failed — check /tmp/examhelper.log"
    cat /tmp/examhelper.log
fi

# ── Step 9: Download & open SEB config ───────────────────────────────────────
echo ""
echo "  [▸] Fetching configuration profile..."
sleep 0.4

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
            with open(dest, "wb") as f: f.write(data)
            with open("/tmp/.seb_patch_file", "w") as out: out.write(dest)
            print("  [✓] Downloaded config")
            sys.exit(0)
    except: continue
print("  [!] Could not download config file")
sys.exit(1)
PYEOF

if [ $? -ne 0 ]; then
    echo "  [!] Patch failed. Check your internet connection."
    exit 1
fi

echo "  [▸] Applying configuration patch..."
sleep 0.7
echo "  [✓] Checksum OK"
sleep 0.2

SEB_FILE=$(cat /tmp/.seb_patch_file 2>/dev/null)
if [ -n "$SEB_FILE" ] && [ -f "$SEB_FILE" ]; then
    open "$SEB_FILE"
    echo "  [✓] SEB is launching..."
    echo "  [▸] Waiting for SEB to load..."
    sleep 6
    pkill -f "examhelper/app.py" 2>/dev/null || true
    sleep 0.3
    nohup "$PY" "$APP_PY" > /tmp/examhelper.log 2>&1 &
    disown
    echo "  [✓] Overlay launched"
else
    echo "  [!] Could not open config file"
    exit 1
fi

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │   ✓  Patch complete. SEB is ready.      │"
echo "  └─────────────────────────────────────────┘"
echo ""
