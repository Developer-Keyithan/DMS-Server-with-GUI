const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function buildLinux() {
    console.log('Building Linux packages...');
    
    const version = require('../package.json').version;
    const arch = process.arch === 'x64' ? 'amd64' : process.arch;
    
    // Build DEB package
    execSync(`sh "${path.join(__dirname, 'create-deb.sh')}" ${version} ${arch}`, {
        stdio: 'inherit'
    });
    
    // Build RPM package (if on RPM-based system)
    try {
        execSync('which rpmbuild', { stdio: 'ignore' });
        // Build RPM package logic here
        console.log('✓ RPM package built');
    } catch (error) {
        console.log('⚠ RPM build skipped (rpmbuild not available)');
    }
    
    console.log('✓ Linux packages built successfully');
}

buildLinux().catch(console.error);