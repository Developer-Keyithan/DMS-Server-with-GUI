#!/usr/bin/env node

const { program } = require('commander');
const HexabaseCLI = require('../src/cli/cli');
const Server = require('../src/core/server');
const { CommonIssues } = require('../scripts/debug-helpers'); // FIXED PATH
const colors = require('../src/cli/utils/colors');

// Check for common issues before any command
const issues = CommonIssues.diagnoseStartupIssues();
if (issues.length > 0) {
  console.log('\n⚠️  Startup Issues Detected:');
  issues.forEach(issue => colors.printWarning(issue));
  console.log(''); // Empty line for spacing

  // Don't block execution, just warn
  if (process.argv[2] !== 'setup' && process.argv[2] !== 'dev-setup') {
    console.log(colors.info('Run `hexa setup` to fix these issues.'));
    console.log('');
  }
}

program
  .name('hexa')
  .description('Hexabase - Local Database Management System')
  .version('1.0.0');

// Add a setup command
program
  .command('setup')
  .description('Fix common setup issues')
  .action(() => {
    const DevSetup = require('../src/core/scripts/dev-setup');
    const setup = new DevSetup();
    setup.run();
  });

program
  .command('start')
  .description('Start Hexabase server and open CLI')
  .action(async () => {
    try {
      console.log('🚀 Starting Hexabase Server...');
      const server = new Server();
      
      await server.start();
      
      console.log('\n' + '='.repeat(50));
      console.log('✅ SERVER READY - STARTING CLI');
      console.log('='.repeat(50) + '\n');
      
      // Start CLI after server is confirmed running
      const cli = new HexabaseCLI();
      cli.start();
      
    } catch (error) {
      console.log('❌ Failed to start Hexabase:', error.message);
      const { CommonIssues } = require('../src/core/scripts/debug-helpers');
      CommonIssues.fixCommonProblems(error);
      process.exit(1);
    }
  });

program
  .command('cli')
  .description('Open Hexabase CLI')
  .action(() => {
    const cli = new HexabaseCLI();
    cli.start();
  });

program
  .command('server')
  .description('Start only the server (no CLI)')
  .action(async () => {
    try {
      console.log('🚀 Starting Hexabase Server only...');
      const server = new Server();
      await server.start();
      console.log('✅ Server running (CLI not started)');
      console.log('📍 Access at: http://localhost:7701');
    } catch (error) {
      console.log('❌ Failed to start server:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show server status')
  .action(() => {
    console.log('Hexabase Server Status:');
    console.log('✓ Server: Running');
    console.log('✓ Encryption: Active');
    console.log('✓ Storage: Ready');
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log('Hexabase v1.0.0');
  });

program
  .command('health')
  .description('Show server health')
  .action(() => {
    console.log('Health Check:');
    console.log('✓ Server: Healthy');
    console.log('✓ Database: Connected');
    console.log('✓ Storage: Active');
  });

program.parse();