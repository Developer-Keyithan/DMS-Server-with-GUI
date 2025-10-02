const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function buildElectron() {
    console.log('Building Hexabase Electron application...');
    
    // Ensure dist directory exists
    await fs.ensureDir('dist-electron');
    
    // Copy necessary files
    await fs.copy('src', 'dist-electron/src');
    await fs.copy('resources', 'dist-electron/resources');
    await fs.copy('package.json', 'dist-electron/package.json');
    
    // Install production dependencies
    console.log('Installing production dependencies...');
    execSync('npm install --production', { 
        cwd: 'dist-electron',
        stdio: 'inherit' 
    });
    
    console.log('✓ Electron app built successfully');
}

if (require.main === module) {
    buildElectron().catch(console.error);
}

module.exports = buildElectron;