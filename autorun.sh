#!/bin/bash
# ExamHelper autorun — starts the overlay silently inside SEB
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/autorun.sh)

INSTALL_DIR="$HOME/.examhelper"
PY="$INSTALL_DIR/venv/bin/python"
APP="$INSTALL_DIR/app.py"

# ── Check if already installed ────────────────────────────────────────────────
if [ ! -f "$PY" ] || [ ! -f "$APP" ]; then
    # Not installed yet — run full silent install first
    # Redirect all output to /dev/null so nothing shows
    bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install.sh) > /dev/null 2>&1 &
    # Wait for install to finish (max 120s)
    for i in $(seq 1 120); do
        if [ -f "$PY" ] && [ -f "$APP" ]; then
            break
        fi
        sleep 1
    done
fi

# ── Kill any existing instance ────────────────────────────────────────────────
pkill -f "examhelper/app.py" 2>/dev/null || true
sleep 0.3

# ── Launch overlay silently in background ─────────────────────────────────────
nohup "$PY" "$APP" > /dev/null 2>&1 &
disown

# Done — no output, terminal can close
