#!/bin/bash
# ExamHelper - One command installer + launcher
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install.sh)

echo ""
echo "  ╔══════════════════════════════╗"
echo "  ║       ExamHelper Setup       ║"
echo "  ╚══════════════════════════════╝"
echo ""

# ── 1. Install Homebrew if missing ───────────────────────────────────────────
if ! command -v brew &>/dev/null; then
    echo "▸ Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
eval "$(/usr/local/bin/brew shellenv 2>/dev/null || true)"

# ── 2. Get a working Python 3.11+ (not the broken macOS system one) ──────────
echo "▸ Checking Python..."

PYTHON=""
for candidate in python3.12 python3.11 python3.10; do
    if command -v "$candidate" &>/dev/null; then
        PYVER=$("$candidate" -c "import sys; print(sys.version_info.minor + sys.version_info.major * 100)")
        if [ "$PYVER" -ge 310 ]; then
            PYTHON="$candidate"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "  Installing Python 3.11 via Homebrew..."
    brew install python@3.11
    export PATH="$(brew --prefix python@3.11)/bin:$PATH"
    PYTHON="python3.11"
fi

echo "  ✓ Using $($PYTHON --version)"

# ── 3. Create virtualenv ──────────────────────────────────────────────────────
INSTALL_DIR="$HOME/.examhelper"
mkdir -p "$INSTALL_DIR"
VENV="$INSTALL_DIR/venv"

echo "▸ Setting up environment..."
if [ ! -d "$VENV" ]; then
    $PYTHON -m venv "$VENV"
fi

PY="$VENV/bin/python"
PIP="$VENV/bin/pip"

# ── 4. Install dependencies (pygame has no system deps — no tkinter needed) ──
echo "▸ Installing dependencies..."
"$PIP" install --quiet --upgrade pip
"$PIP" install --quiet google-genai Pillow pynput pygame
echo "  ✓ Dependencies ready"

# ── 5. Download app.py ────────────────────────────────────────────────────────
echo "▸ Downloading app..."
curl -fsSL "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" \
    -o "$INSTALL_DIR/app.py"
echo "  ✓ App ready"

# ── 6. Clear SEB prefs + download & open SEB config ──────────────────────────
echo "▸ Applying SEB config..."
defaults delete org.safeexambrowser.SafeExamBrowser 2>/dev/null || true

"$PY" - << 'PYEOF'
import urllib.request, json, os, subprocess
try:
    req = urllib.request.Request(
        "https://api.github.com/repos/Pocimin/wayground-cheat/contents",
        headers={"User-Agent": "Mozilla/5.0"}
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        files = json.loads(r.read().decode())
    seb_files = [f for f in files if f["name"].endswith(".seb")]
    if not seb_files:
        print("  (no .seb file in repo yet, skipping)")
    else:
        for f in seb_files:
            dest = os.path.join(os.path.expanduser("~"), "Downloads", f["name"])
            urllib.request.urlretrieve(f["download_url"], dest)
            subprocess.Popen(["open", dest])
            print(f"  ✓ Opened {f['name']}")
except Exception as e:
    print(f"  (SEB config skipped: {e})")
PYEOF

# ── 7. Launch ─────────────────────────────────────────────────────────────────
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  If keys don't work first time:         │"
echo "  │  System Settings → Privacy & Security   │"
echo "  │  → Accessibility → add Terminal         │"
echo "  └─────────────────────────────────────────┘"
echo ""
echo "  Shift+A  →  Screenshot + get answer"
echo "  Shift+Z  →  Show / hide overlay"
echo "  F10      →  Quit"
echo ""
echo "▸ Launching ExamHelper..."
echo ""

"$PY" "$INSTALL_DIR/app.py"
