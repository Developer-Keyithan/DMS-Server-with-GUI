const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function buildWindows() {
    console.log('Building Windows installer...');
    
    const version = require('../package.json').version;
    const buildDir = path.join(__dirname, '..', 'build', 'windows');
    
    await fs.ensureDir(buildDir);
    
    // Copy NSIS script with version
    let nsisScript = await fs.readFile(
        path.join(__dirname, 'windows-installer.nsi'), 
        'utf8'
    );
    nsisScript = nsisScript.replace(/\$\{VERSION\}/g, version);
    
    await fs.writeFile(
        path.join(buildDir, 'installer.nsi'), 
        nsisScript
    );
    
    // Build with NSIS
    try {
        execSync(`makensis "${path.join(buildDir, 'installer.nsi')}"`, {
            stdio: 'inherit'
        });
        console.log('✓ Windows installer built successfully');
    } catch (error) {
        console.error('Failed to build Windows installer:', error.message);
    }
}

buildWindows().catch(console.error);