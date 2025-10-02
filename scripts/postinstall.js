#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const colors = require('../src/cli/utils/colors');

console.log(colors.info('Running Hexabase post-installation setup...'));

// Create necessary directories
const directories = [
  './data',
  './config',
  './logs',
  './temp'
];

directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(colors.success(`Created directory: ${dir}`));
  }
});

// Create default configuration if it doesn't exist
const configPath = path.join(__dirname, '../config/config.json');
if (!fs.existsSync(configPath)) {
  const defaultConfig = {
    server: {
      port: 7701,
      host: '127.0.0.1'
    },
    security: {
      jwtSecret: require('crypto').randomBytes(32).toString('hex'),
      tokenExpiry: '24h'
    },
    storage: {
      dataPath: './data',
      encryption: {
        algorithm: 'aes-256-gcm'
      }
    },
    gui: {
      theme: 'dark',
      autoStart: false,
      notifications: true
    }
  };

  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(colors.success('Created default configuration file'));
}

// Set executable permissions for CLI (Unix-like systems)
if (process.platform !== 'win32') {
  try {
    const cliPath = path.join(__dirname, '../bin/hexabase.js');
    fs.chmodSync(cliPath, '755');
    console.log(colors.success('Set executable permissions for CLI'));
  } catch (error) {
    console.log(colors.warning('Could not set executable permissions'));
  }
}

console.log(colors.success('Hexabase installation completed successfully!'));
console.log(colors.info('You can now run:'));
console.log(colors.muted('  hexa start    - Start the server and CLI'));
console.log(colors.muted('  npm run gui   - Start the GUI application'));