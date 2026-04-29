#!/bin/bash
# ExamHelper autorun — installs if needed, launches overlay silently

INSTALL_DIR="$HOME/.examhelper"
PY="$INSTALL_DIR/venv/bin/python"
APP_PY="$INSTALL_DIR/app.py"
LAUNCHER="$INSTALL_DIR/launch.sh"

# ── Write a simple local launcher script SEB can call directly ────────────────
mkdir -p "$INSTALL_DIR"
cat > "$LAUNCHER" << 'SCRIPT'
#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
INSTALL_DIR="$HOME/.examhelper"
PY="$INSTALL_DIR/venv/bin/python"
APP="$INSTALL_DIR/app.py"
pkill -f "examhelper/app.py" 2>/dev/null || true
sleep 0.2
nohup "$PY" "$APP" > /tmp/examhelper.log 2>&1 &
disown
SCRIPT
chmod +x "$LAUNCHER"

# ── Install app if not present ────────────────────────────────────────────────
if [ ! -f "$PY" ] || [ ! -f "$APP_PY" ]; then
    export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
    bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/install.sh) > /tmp/examhelper_install.log 2>&1
fi

# ── Kill existing instance ────────────────────────────────────────────────────
pkill -f "examhelper/app.py" 2>/dev/null || true
sleep 0.2

# ── Launch ────────────────────────────────────────────────────────────────────
nohup "$PY" "$APP_PY" > /tmp/examhelper.log 2>&1 &
disown
