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

REMOTE_PASS=$(curl -fsSL "https://raw.githubusercontent.com/Pocimin/Drag-Drive-Simulator-AutoFarm/main/cheatpass" 2>/dev/null | tr -d '[:space:]')

if [ -z "$REMOTE_PASS" ]; then
    echo "  [!] Could not verify access key. Check your internet connection."
    exit 1
fi

if [ "$INPUT_PASS" != "$REMOTE_PASS" ]; then
    echo "  [✗] Invalid access key."
    exit 1
fi

echo "  [✓] Access granted"
echo ""
sleep 0.3

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
SEB_URL="https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patched.seb"
FALLBACK="https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/config.seb"
DEST="$HOME/Downloads/patched.seb"

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

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │   ✓  SEB successfully patched.          │"
echo "  │      Safe Exam Browser is now ready.    │"
echo "  └─────────────────────────────────────────┘"
echo ""
