#!/bin/bash
# ExamHelper silent installer — only installs the overlay app, no SEB stuff
# Called by autorun.sh if not already installed

set -e

# ── Homebrew ──────────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" < /dev/null
fi
eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || true)"
eval "$(/usr/local/bin/brew shellenv 2>/dev/null || true)"

# ── Python with tkinter ───────────────────────────────────────────────────────
brew install python-tk@3.11 2>/dev/null || true
export PATH="$(brew --prefix python@3.11)/bin:$PATH"
PYTHON="python3.11"

if ! "$PYTHON" -c "import tkinter" 2>/dev/null; then
    brew install python-tk@3.12 2>/dev/null || true
    export PATH="$(brew --prefix python@3.12)/bin:$PATH"
    PYTHON="python3.12"
fi

# ── Virtualenv ────────────────────────────────────────────────────────────────
INSTALL_DIR="$HOME/.examhelper"
mkdir -p "$INSTALL_DIR"
VENV="$INSTALL_DIR/venv"

if [ -d "$VENV" ] && ! "$VENV/bin/python" -c "import tkinter" 2>/dev/null; then
    rm -rf "$VENV"
fi

if [ ! -d "$VENV" ]; then
    "$PYTHON" -m venv "$VENV"
fi

"$VENV/bin/pip" install --quiet --upgrade pip
"$VENV/bin/pip" install --quiet Pillow pynput requests

# ── Download app ──────────────────────────────────────────────────────────────
curl -fsSL "https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/app.py" \
    -o "$INSTALL_DIR/app.py"
