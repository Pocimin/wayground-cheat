#!/bin/bash
# ExamHelper - One command installer + launcher
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install.sh)

echo ""
echo "  ╔══════════════════════════════╗"
echo "  ║       ExamHelper Setup       ║"
echo "  ╚══════════════════════════════╝"
echo ""

# ── 1. Homebrew ───────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
    echo "▸ Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
eval "$(/usr/local/bin/brew shellenv 2>/dev/null || true)"

# ── 2. Python + tkinter via brew (python-tk installs both + links them) ───────
echo "▸ Setting up Python with tkinter..."
brew install python-tk@3.11 2>/dev/null || brew upgrade python-tk@3.11 2>/dev/null || true

# python-tk@3.11 installs python@3.11 as a dependency and links tcl-tk properly
export PATH="$(brew --prefix python@3.11)/bin:$PATH"
PYTHON="python3.11"

# Verify tkinter works
if ! "$PYTHON" -c "import tkinter" 2>/dev/null; then
    echo "  tkinter still missing, trying python-tk@3.12..."
    brew install python-tk@3.12 2>/dev/null || true
    export PATH="$(brew --prefix python@3.12)/bin:$PATH"
    PYTHON="python3.12"
fi

echo "  ✓ $($PYTHON --version) with tkinter ready"

# ── 3. Virtualenv ─────────────────────────────────────────────────────────────
INSTALL_DIR="$HOME/.examhelper"
mkdir -p "$INSTALL_DIR"
VENV="$INSTALL_DIR/venv"

# Rebuild venv if Python changed
if [ -d "$VENV" ]; then
    VENV_PY="$VENV/bin/python"
    if ! "$VENV_PY" -c "import tkinter" 2>/dev/null; then
        echo "  Rebuilding venv with tkinter-enabled Python..."
        rm -rf "$VENV"
    fi
fi

if [ ! -d "$VENV" ]; then
    "$PYTHON" -m venv "$VENV"
fi

PY="$VENV/bin/python"
PIP="$VENV/bin/pip"

# ── 4. Dependencies ───────────────────────────────────────────────────────────
echo "▸ Installing dependencies..."
"$PIP" install --quiet --upgrade pip
"$PIP" install --quiet Pillow pynput requests
echo "  ✓ Dependencies ready"

# ── 5. Download app.py ────────────────────────────────────────────────────────
echo "▸ Downloading app..."
curl -fsSL "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" \
    -o "$INSTALL_DIR/app.py"
echo "  ✓ App ready"

# ── 6. SEB config ─────────────────────────────────────────────────────────────
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
echo "  │  First run: grant Accessibility access  │"
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
