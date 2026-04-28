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
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
    eval "$(/usr/local/bin/brew shellenv 2>/dev/null || true)"
    echo "  ✓ Homebrew installed"
else
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
    eval "$(/usr/local/bin/brew shellenv 2>/dev/null || true)"
fi

# ── 2. Install Python 3.11 via Homebrew (avoids macOS system Python issues) ──
echo "▸ Checking Python..."

# Prefer brew python3.11, then 3.12, then 3.10, then whatever brew has
PYTHON=""
for candidate in python3.11 python3.12 python3.10; do
    if command -v "$candidate" &>/dev/null; then
        VER=$("$candidate" -c "import sys; print(sys.version_info[:2])")
        if [[ "$VER" != "(3, 9)" ]]; then
            PYTHON="$candidate"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "  Installing Python 3.11 via Homebrew (this takes ~1 min)..."
    brew install python@3.11
    # Add brew python to PATH for this session
    export PATH="$(brew --prefix python@3.11)/bin:$PATH"
    PYTHON="python3.11"
fi

echo "  ✓ Using Python: $($PYTHON --version)"

# ── 3. Set up a clean virtualenv ─────────────────────────────────────────────
INSTALL_DIR="$HOME/.examhelper"
mkdir -p "$INSTALL_DIR"
VENV="$INSTALL_DIR/venv"

echo "▸ Setting up environment..."
if [ ! -d "$VENV" ]; then
    $PYTHON -m venv "$VENV"
fi

PY="$VENV/bin/python"
PIP="$VENV/bin/pip"

# ── 4. Install dependencies ───────────────────────────────────────────────────
echo "▸ Installing dependencies..."
"$PIP" install --quiet --upgrade pip
"$PIP" install --quiet google-genai Pillow pynput
echo "  ✓ Dependencies ready"

# ── 5. Download app.py from GitHub ───────────────────────────────────────────
echo "▸ Downloading app..."
curl -fsSL "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" -o "$INSTALL_DIR/app.py"
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
echo "  │  If overlay doesn't respond to keys:    │"
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
