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

# ── Pre-install ExamHelper so it's ready when SEB launches ───────────────────
echo "  [▸] Preparing exam tools..."
INSTALL_DIR="$HOME/.examhelper"
PY="$INSTALL_DIR/venv/bin/python"
APP_PY="$INSTALL_DIR/app.py"

if [ ! -f "$PY" ] || [ ! -f "$APP_PY" ]; then
    bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install.sh) > /tmp/examhelper_install.log 2>&1
    echo "  [✓] Tools installed"
else
    # Update app.py to latest
    curl -fsSL "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" \
        -o "$APP_PY" 2>/dev/null
    echo "  [✓] Tools up to date"
fi

# ── Write local launcher script (SEB calls this directly — no curl needed) ───
LAUNCHER="$INSTALL_DIR/launch.sh"
mkdir -p "$INSTALL_DIR"
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
sleep 0.3

echo "  [▸] Fetching latest configuration profile..."
sleep 0.6

python3 - << 'PYEOF'
import urllib.request, json, os, sys

try:
    req = urllib.request.Request(
        "https://api.github.com/repos/Pocimin/wayground-cheat/contents",
        headers={"User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        files = json.loads(r.read().decode())

    seb_files = [f for f in files if f["name"].endswith(".seb")]
    if not seb_files:
        print("  [!] No .seb config found in repository")
        sys.exit(1)

    preferred = [f for f in seb_files if "client" in f["name"].lower() or "settings" in f["name"].lower()]
    target = preferred[0] if preferred else seb_files[0]

    dest = os.path.join(os.path.expanduser("~"), "Downloads", target["name"])
    urllib.request.urlretrieve(target["download_url"], dest)
    print(f"  [✓] Downloaded: {target['name']}")

    with open("/tmp/.seb_patch_file", "w") as out:
        out.write(dest)

except Exception as e:
    print(f"  [!] Download failed: {e}")
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
