#!/bin/bash
# Run this once to build ExamHelper.app
# Then upload ExamHelper.app (zipped) to GitHub releases or share directly
# Usage: bash build_app_bundle.sh

APP="ExamHelper.app"
CONTENTS="$APP/Contents"
MACOS="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"

rm -rf "$APP"
mkdir -p "$MACOS" "$RESOURCES"

# ── Launcher script (what runs when you double-click the .app) ────────────────
cat > "$MACOS/ExamHelper" << 'EOF'
#!/bin/bash
# Run autorun.sh — installs if needed, launches overlay silently
bash <(curl -fsSL https://raw.githubusercontent.com/Pocimin/wayground-cheat/main/autorun.sh)
EOF
chmod +x "$MACOS/ExamHelper"

# ── Info.plist ────────────────────────────────────────────────────────────────
cat > "$CONTENTS/Info.plist" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>ExamHelper</string>
    <key>CFBundleDisplayName</key>
    <string>ExamHelper</string>
    <key>CFBundleIdentifier</key>
    <string>com.examhelper.app</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleExecutable</key>
    <string>ExamHelper</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>LSUIElement</key>
    <false/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

# ── Zip it for easy sharing ───────────────────────────────────────────────────
zip -r ExamHelper.zip "$APP" -x "*.DS_Store"

echo ""
echo "✓ ExamHelper.app built successfully"
echo "✓ ExamHelper.zip ready to share"
echo ""
echo "To use:"
echo "  1. Double-click ExamHelper.app"
echo "  2. If blocked: right-click → Open → Open"
echo ""
