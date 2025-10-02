const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function buildMacOS() {
    console.log('Building macOS installer...');
    
    const version = require('../package.json').version;
    
    // Create app bundle
    const appDir = path.join(__dirname, '..', 'build', 'macos', 'Hexabase.app');
    await fs.ensureDir(path.join(appDir, 'Contents', 'MacOS'));
    await fs.ensureDir(path.join(appDir, 'Contents', 'Resources'));
    
    // Create Info.plist
    const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>Hexabase</string>
    <key>CFBundleExecutable</key>
    <string>Hexabase</string>
    <key>CFBundleIdentifier</key>
    <string>com.hexabase.app</string>
    <key>CFBundleName</key>
    <string>Hexabase</string>
    <key>CFBundleVersion</key>
    <string>${version}</string>
    <key>CFBundleShortVersionString</key>
    <string>${version}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.12.0</string>
</dict>
</plist>`;
    
    await fs.writeFile(path.join(appDir, 'Contents', 'Info.plist'), infoPlist);
    
    // Create DMG
    execSync(`sh "${path.join(__dirname, 'create-dmg.sh')}" ${version}`, {
        stdio: 'inherit'
    });
    
    console.log('✓ macOS installer built successfully');
}

buildMacOS().catch(console.error);