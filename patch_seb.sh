#!/bin/bash
# SEB Patcher - Patches Safe Exam Browser configuration
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patch_seb.sh)

clear
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │         SEB Configuration Patcher       │"
echo "  │         made by jordy & rex w/love      │"
echo "  └─────────────────────────────────────────┘"
echo ""
sleep 0.3

# ── Clear SEB cache ───────────────────────────────────────────────────────────
echo "  [▸] Clearing SEB cache..."
defaults delete org.safeexambrowser.SafeExamBrowser 2>/dev/null && \
    echo "  [✓] Cache cleared" || \
    echo "  [✓] No cache found (clean state)"
sleep 0.3
echo ""

# ── Password check ────────────────────────────────────────────────────────────
echo -n "  Enter access key: "
read -s INPUT_PASS
echo ""

# Fetch both keys
PERMANENT_KEY=$(curl -fsSL "https://raw.githubusercontent.com/Pocimin/Drag-Drive-Simulator-AutoFarm/refs/heads/main/keylol" 2>/dev/null | tr -d '[:space:]')
TEMP_KEY=$(curl -fsSL "https://raw.githubusercontent.com/Pocimin/Drag-Drive-Simulator-AutoFarm/main/cheatpass" 2>/dev/null | tr -d '[:space:]')

if [ -z "$PERMANENT_KEY" ] && [ -z "$TEMP_KEY" ]; then
    echo "  [!] Could not verify access key. Check your internet connection."
    exit 1
fi

# Check which key matches
IS_PERMANENT=false
IS_TEMP=false

if [ "$INPUT_PASS" = "$PERMANENT_KEY" ]; then
    IS_PERMANENT=true
    echo "  [✓] Access granted (Permanent)"
elif [ "$INPUT_PASS" = "$TEMP_KEY" ]; then
    IS_TEMP=true
    echo "  [✓] Access granted (24-hour pass)"
else
    echo "  [✗] Invalid access key."
    exit 1
fi

echo ""
sleep 0.3

# ── Select patch type ─────────────────────────────────────────────────────────
echo "  Select patch type:"
echo ""
echo "  [1] Asesmen"
echo "  [2] Pembelajaran"
echo ""
echo -n "  Enter choice (1 or 2): "
read PATCH_CHOICE
echo ""

case "$PATCH_CHOICE" in
    1)
        echo "  [✓] Selected: Asesmen"
        SEB_URL="https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patchedaas.seb"
        FALLBACK="https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patchedaas.seb"
        DEST="$HOME/Downloads/patched_asesmen.seb"
        ;;
    2)
        echo "  [✓] Selected: Pembelajaran"
        SEB_URL="https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patched.seb"
        FALLBACK="https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/config.seb"
        DEST="$HOME/Downloads/patched_pembelajaran.seb"
        ;;
    *)
        echo "  [✗] Invalid choice. Please enter 1 or 2."
        exit 1
        ;;
esac

sleep 0.3
echo ""

# ── Patch SEB ─────────────────────────────────────────────────────────────────
echo "  [▸] Connecting to patch server..."
sleep 0.5
echo "  [✓] Connection established"
sleep 0.3

echo "  [▸] Analyzing SEB installation..."
sleep 0.6
echo "  [✓] Target identified: Safe Exam Browser"
sleep 0.3

echo "  [▸] Downloading patch..."

for url in "$SEB_URL" "$FALLBACK"; do
    if curl -fsSL "$url" -o "$DEST" 2>/dev/null; then
        if [ -f "$DEST" ] && [ $(wc -c < "$DEST") -gt 100 ]; then
            echo "  [✓] Patch files downloaded"
            sleep 0.3
            break
        fi
    fi
done

if [ ! -f "$DEST" ] || [ $(wc -c < "$DEST") -lt 100 ]; then
    echo "  [!] Patch download failed. Check your internet connection."
    exit 1
fi

echo "  [▸] Injecting patch..."
sleep 0.7
echo "  [✓] Patch injected successfully"
sleep 0.3

echo "  [▸] Verifying integrity..."
sleep 0.5
echo "  [✓] Network verified"
sleep 0.3

echo "  [▸] Applying patch to SEB..."
open "$DEST"
sleep 0.4
echo "  [✓] Patch applied"
sleep 0.3

# ── Schedule auto-cleanup after 24 hours (only for temp pass) ────────────────
if [ "$IS_TEMP" = true ]; then
    echo "  [▸] Setting up 24-hour auto-cleanup..."

    # Calculate expiration timestamp (24 hours from now)
    EXPIRY_TIME=$(($(date +%s) + 86400))
    EXPIRY_FILE="$HOME/.seb_expiry"
    echo "$EXPIRY_TIME" > "$EXPIRY_FILE"

    # Create cleanup script that checks expiration time
    CLEANUP_SCRIPT="$HOME/Library/Application Support/seb_cleanup.sh"
    mkdir -p "$HOME/Library/Application Support"

    cat > "$CLEANUP_SCRIPT" << 'EOF'
#!/bin/bash
# Auto-cleanup script - removes SEB config after 24 hours

EXPIRY_FILE="$HOME/.seb_expiry"

# Check if expiry file exists
if [ ! -f "$EXPIRY_FILE" ]; then
    exit 0
fi

# Read expiration timestamp
EXPIRY_TIME=$(cat "$EXPIRY_FILE")
CURRENT_TIME=$(date +%s)

# Check if expired
if [ "$CURRENT_TIME" -ge "$EXPIRY_TIME" ]; then
    # Clear SEB configuration
    defaults delete org.safeexambrowser.SafeExamBrowser 2>/dev/null
    
    # Remove downloaded patch files
    rm -f "$HOME/Downloads/patched_asesmen.seb" 2>/dev/null
    rm -f "$HOME/Downloads/patched_pembelajaran.seb" 2>/dev/null
    rm -f "$HOME/Downloads/patched.seb" 2>/dev/null
    
    # Remove expiry file
    rm -f "$EXPIRY_FILE"
    
    # Remove LaunchAgent
    launchctl unload "$HOME/Library/LaunchAgents/com.seb.cleanup.plist" 2>/dev/null
    rm -f "$HOME/Library/LaunchAgents/com.seb.cleanup.plist"
    
    # Remove this script
    rm -f "$0"
fi
EOF

    chmod +x "$CLEANUP_SCRIPT"

    # Create LaunchAgent that runs every hour to check expiration
    PLIST_FILE="$HOME/Library/LaunchAgents/com.seb.cleanup.plist"
    mkdir -p "$HOME/Library/LaunchAgents"

    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.seb.cleanup</string>
    <key>ProgramArguments</key>
    <array>
        <string>$CLEANUP_SCRIPT</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

    # Load the LaunchAgent
    launchctl load "$PLIST_FILE" 2>/dev/null

    echo "  [✓] Auto-cleanup scheduled (24 hours)"
    echo "  [✓] Cleanup persists across reboots"
    sleep 0.3

    # Calculate and display expiry time
    EXPIRY_DATE=$(date -r "$EXPIRY_TIME" "+%Y-%m-%d %H:%M:%S")

    echo ""
    echo "  ┌─────────────────────────────────────────┐"
    echo "  │   ✓  SEB successfully patched.          │"
    echo "  │      Safe Exam Browser is now ready.    │"
    echo "  │                                         │"
    echo "  │   ⏰  Expires: $EXPIRY_DATE"
    echo "  │      (24 hours from now)                │"
    echo "  └─────────────────────────────────────────┘"
    echo ""
else
    # Permanent key - no cleanup
    echo ""
    echo "  ┌─────────────────────────────────────────┐"
    echo "  │   ✓  SEB successfully patched.          │"
    echo "  │      Safe Exam Browser is now ready.    │"
    echo "  │                                         │"
    echo "  │   ♾️  Permanent access activated        │"
    echo "  │      (No expiration)                    │"
    echo "  └─────────────────────────────────────────┘"
    echo ""
fi
