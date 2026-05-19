#!/bin/bash
# SEB Config Installer - Downloads and opens your SEB config
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/patch_seb.sh)

clear
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │         SEB Configuration Loader        │"
echo "  │           made by nznt w/love            │"
echo "  └─────────────────────────────────────────┘"
echo ""
sleep 0.3

# ── Download SEB config ───────────────────────────────────────────────────────
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
    echo "  [!] Failed. Check your internet connection."
    exit 1
fi

# ── Open SEB config ───────────────────────────────────────────────────────────
SEB_FILE=$(cat /tmp/.seb_patch_file 2>/dev/null)
if [ -n "$SEB_FILE" ] && [ -f "$SEB_FILE" ]; then
    open "$SEB_FILE"
    echo "  [✓] SEB is launching..."
else
    echo "  [!] Could not open config file"
    exit 1
fi

echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │   ✓  Done. SEB is loading your config.  │"
echo "  └─────────────────────────────────────────┘"
echo ""
