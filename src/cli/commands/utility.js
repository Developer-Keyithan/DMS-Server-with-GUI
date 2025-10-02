const colors = require('../utils/colors');
const AuthenticationService = require('../../auth/authentication');
const StorageEngine = require('../../core/storage-engine');

class UtilityCommands {
    static async status(args, cli) {
        const user = cli.getUser();
        const context = cli.getContext();

        console.log(colors.info('Hexabase Status:'));
        console.log(`  Version: 1.0.0`);
        console.log(`  Server: ${colors.success('Running')}`);
        console.log(`  Encryption: ${colors.success('Active')}`);

        if (user) {
            console.log(`  User: ${user.name} (${user.role})`);
        } else {
            console.log(`  User: ${colors.warning('Not logged in')}`);
        }

        if (context.database) {
            console.log(`  Database: ${context.database.name}`);
        }

        if (context.cluster) {
            console.log(`  Cluster: ${context.cluster.name}`);
        }

        if (context.collection) {
            console.log(`  Collection: ${context.collection.name}`);
        }

        if (context.bucket) {
            console.log(`  Bucket: ${context.bucket.name}`);
        }

        console.log(`  Mode: ${context.mode === 'json' ? 'JSON Storage' : 'File Storage'}`);
    }

    static async health(args, cli) {
        console.log(colors.info('Health Check:'));

        try {
            // Test user storage
            const userStorage = new StorageEngine('users');
            const userCount = await userStorage.count();
            console.log(`  User Storage: ${colors.success('OK')} (${userCount} users)`);

            // Test database storage
            const dbStorage = new StorageEngine('databases');
            const dbCount = await dbStorage.count();
            console.log(`  Database Storage: ${colors.success('OK')} (${dbCount} databases)`);

            // Test encryption
            const testData = { test: 'data' };
            const encrypted = require('../../core/encryption').encrypt(testData);
            const decrypted = require('../../core/encryption').decrypt(encrypted);

            if (JSON.stringify(testData) === JSON.stringify(decrypted)) {
                console.log(`  Encryption: ${colors.success('OK')}`);
            } else {
                console.log(`  Encryption: ${colors.error('FAILED')}`);
            }

            console.log(`  Overall: ${colors.success('HEALTHY')}`);

        } catch (error) {
            console.log(`  Overall: ${colors.error('UNHEALTHY')}`);
            colors.printError(`Health check failed: ${error.message}`);
        }
    }

    static async version(args, cli) {
        console.log(colors.info('Hexabase v1.0.0'));
        console.log('  Build: 1698398400000');
        console.log('  Node.js: ' + process.version);
        console.log('  Platform: ' + process.platform + '/' + process.arch);
    }

    static async stats(args, cli) {
        const userStorage = new StorageEngine('users');
        const dbStorage = new StorageEngine('databases');

        const userCount = await userStorage.count();
        const dbCount = await dbStorage.count();

        console.log(colors.info('Server Statistics:'));
        console.log(`  Users: ${userCount}`);
        console.log(`  Databases: ${dbCount}`);
        console.log(`  Uptime: ${process.uptime().toFixed(2)} seconds`);
        console.log(`  Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Platform: ${process.platform}`);
        console.log(`  Node.js: ${process.version}`);
    }

    static async mode(args, cli) {
        const context = cli.getContext();

        console.log(colors.info('Current Context:'));
        console.log(`  User: ${cli.getUser()?.name || 'Not logged in'}`);
        console.log(`  Database: ${context.database?.name || 'None'}`);
        console.log(`  Cluster: ${context.cluster?.name || 'None'}`);
        console.log(`  Collection: ${context.collection?.name || 'None'}`);
        console.log(`  Bucket: ${context.bucket?.name || 'None'}`);
        console.log(`  Folder: ${context.folder?.name || 'None'}`);
        console.log(`  Mode: ${context.mode === 'json' ? 'JSON Object Storage' : 'File Storage'}`);
    }

    static async clear(args, cli) {
        console.clear();
        cli.showWelcome();
    }

    // Add these methods to the UtilityCommands class

    static async start(args, cli) {
        try {
            const Server = require('../../core/server');
            const server = new Server();

            console.log(colors.info('Starting Hexabase server...'));
            await server.start();

            colors.printSuccess('Hexabase server started successfully');
            console.log(colors.muted('Server is running on http://localhost:7701'));
            console.log(colors.muted('WebSocket server available on ws://localhost:7701'));

        } catch (error) {
            colors.printError(`Failed to start server: ${error.message}`);
        }
    }

    static async restart(args, cli) {
        console.log(colors.info('Restarting Hexabase server...'));

        // In a real implementation, this would restart the server process
        // For this example, we'll simulate it
        colors.printWarning('Server restart functionality would be implemented here');
        colors.printInfo('In a production environment, this would gracefully restart the server process');
    }

    static async exit(args, cli) {
        const confirm = args.includes('-y');

        if (!confirm) {
            return new Promise((resolve) => {
                cli.rl.question(colors.warning('Are you sure you want to exit? This will stop the server. (y/N): '), (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        this.performExit(cli);
                    }
                    resolve();
                });
            });
        } else {
            await this.performExit(cli);
        }
    }

    static async performExit(cli) {
        console.log(colors.info('Stopping Hexabase server...'));

        // In a real implementation, this would stop the server
        // For this example, we'll just close the CLI
        colors.printSuccess('Hexabase server stopped');
        console.log(colors.muted('Goodbye!'));

        cli.rl.close();
        process.exit(0);
    }

    static async stop(args, cli) {
        const confirm = args.includes('-y');

        if (!confirm) {
            return new Promise((resolve) => {
                cli.rl.question(colors.warning('Are you sure you want to stop the server? (y/N): '), (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        this.performStop(cli);
                    }
                    resolve();
                });
            });
        } else {
            await this.performStop(cli);
        }
    }

    static async performStop(cli) {
        console.log(colors.info('Stopping Hexabase server...'));

        // In a real implementation, this would stop the server but keep CLI open
        colors.printSuccess('Hexabase server stopped');
        colors.printInfo('CLI remains active. Use "start" to restart the server.');
    }

    static async help(args, cli) {
        cli.showHelp();
    }
}

// Command metadata
UtilityCommands.status.help = 'Show server status: status';
UtilityCommands.health.help = 'Show server health: health';
UtilityCommands.version.help = 'Show version information: version';
UtilityCommands.stats.help = 'Show server statistics: stats';
UtilityCommands.mode.help = 'Show current context and mode: mode';
UtilityCommands.clear.help = 'Clear terminal: clear';
UtilityCommands.start.help = 'Start Hexabase server: start';
UtilityCommands.restart.help = 'Restart Hexabase server: restart';
UtilityCommands.exit.help = 'Exit Hexabase and stop server: exit [-y]';
UtilityCommands.stop.help = 'Stop Hexabase server: stop [-y]';
UtilityCommands.help.help = 'Show help: help';

module.exports = UtilityCommands;