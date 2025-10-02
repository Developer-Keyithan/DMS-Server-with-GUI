#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const colors = require('../src/cli/utils/colors');

class DevSetup {
    constructor() {
        this.rootDir = path.join(__dirname, '..');
    }

    run() {
        console.log(colors.info('Setting up Hexabase development environment...'));

        // Check for existing issues first
        const { CommonIssues } = require('./debug-helpers');
        const existingIssues = CommonIssues.diagnoseStartupIssues();
        if (existingIssues.length > 0) {
            console.log(colors.warning('Found existing issues that will be fixed:'));
            existingIssues.forEach(issue => console.log('  - ' + issue));
        }
        
        this.createDirectories();
        this.createConfigFiles();
        this.setupPermissions();
        this.generateEncryptionKey();

        // Verify the fix
        const remainingIssues = CommonIssues.diagnoseStartupIssues();
        if (remainingIssues.length === 0) {
            console.log(colors.success('✓ All startup issues resolved!'));
        }

        console.log(colors.success('Development setup completed!'));
        console.log(colors.info('You can now run:'));
        console.log(colors.muted('  npm run dev        # Start development server'));
        console.log(colors.muted('  npm run cli        # Start CLI'));
        console.log(colors.muted('  npm test           # Run tests'));
    }

    createDirectories() {
        const directories = [
            'data',
            'config',
            'logs',
            'test-data',
            '.vscode'
        ];

        directories.forEach(dir => {
            const fullPath = path.join(this.rootDir, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(colors.success(`Created directory: ${dir}`));
            }
        });
    }

    createConfigFiles() {
        const configs = {
            '.env': `NODE_ENV=development
PORT=7701
HOST=127.0.0.1
JWT_SECRET=dev-jwt-secret-change-in-production
LOG_LEVEL=debug
DEBUG=true
DATA_PATH=./data
            `,

            'config/default.json': JSON.stringify({
                server: { port: 7701, host: '127.0.0.1' },
                security: { jwtSecret: 'dev-secret', tokenExpiry: '24h' },
                storage: { dataPath: './data' },
                logging: { level: 'debug' }
            }, null, 2)
        };

        Object.entries(configs).forEach(([file, content]) => {
            const filePath = path.join(this.rootDir, file);
            if (!fs.existsSync(filePath)) {
                fs.writeFileSync(filePath, content);
                console.log(colors.success(`Created config file: ${file}`));
            }
        });
    }

    setupPermissions() {
        const cliPath = path.join(this.rootDir, 'bin/hexabase.js');
        if (fs.existsSync(cliPath)) {
            fs.chmodSync(cliPath, '755');
            console.log(colors.success('Set CLI executable permissions'));
        }
    }

    generateEncryptionKey() {
        const crypto = require('crypto');
        const keyPath = path.join(this.rootDir, 'config/encryption.key');

        if (!fs.existsSync(keyPath)) {
            const key = crypto.randomBytes(32);
            fs.writeFileSync(keyPath, key);
            console.log(colors.success('Generated encryption key'));
        }
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new DevSetup();
    setup.run();
}

module.exports = DevSetup;