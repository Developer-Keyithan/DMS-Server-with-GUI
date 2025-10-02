#!/bin/bash

set -e

VERSION=$1
APP_NAME="Hexabase"
DMG_NAME="${APP_NAME}-${VERSION}.dmg"
APP_DIR="${APP_NAME}.app"
VOLUME_NAME="${APP_NAME} ${VERSION}"
SOURCE_DIR="dist/mac"
BACKGROUND_IMAGE="resources/dmg-background.png"

echo "Creating DMG for ${APP_NAME} ${VERSION}"

# Create the DMG directory structure
mkdir -p "dist/dmg"
cp -R "${SOURCE_DIR}/${APP_DIR}" "dist/dmg/"
ln -s "/Applications" "dist/dmg/Applications"

# Create temporary DS_Store with settings
echo "Setting up DMG layout..."
cat > "dist/dmg/.DS_Store" << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>BackgroundAlpha</key>
    <real>1</real>
    <key>BackgroundColorRed</key>
    <real>1</real>
    <key>BackgroundColorGreen</key>
    <real>1</real>
    <key>BackgroundColorBlue</key>
    <real>1</real>
    <key>ShowIconPreview</key>
    <false/>
    <key>ShowItemInfo</key>
    <false/>
    <key>IconSize</key>
    <integer>128</integer>
    <key>TextSize</key>
    <integer>16</integer>
    <key>arrangeby</key>
    <string>name</string>
</dict>
</plist>
EOF

# Create the DMG
echo "Creating DMG file..."
hdiutil create \
    -srcfolder "dist/dmg" \
    -volname "${VOLUME_NAME}" \
    -fs HFS+ \
    -fsargs "-c c=64,a=16,e=16" \
    -format UDZO \
    -imagekey zlib-level=9 \
    -ov \
    "dist/${DMG_NAME}"

echo "DMG created: dist/${DMG_NAME}"

# Clean up
rm -rf "dist/dmg"

echo "Done!"