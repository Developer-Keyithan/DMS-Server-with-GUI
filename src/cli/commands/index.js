const AuthCommands = require('./auth');
const DatabaseCommands = require('./database');
const ClusterCommands = require('./cluster');
const CollectionCommands = require('./collection');
const BucketCommands = require('./bucket');
const UtilityCommands = require('./utility');
const chalk = require('chalk');


class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.registerAllCommands();
    }

    registerAllCommands() {
        // Auth commands
        this.register('register', AuthCommands.register);
        this.register('login', AuthCommands.login);
        this.register('logout', AuthCommands.logout);
        this.register('user', AuthCommands.user);
        this.register('change-role', AuthCommands.changeRole);
        this.register('list user', AuthCommands.listUser);

        // Database commands
        this.register('create database', DatabaseCommands.createDatabase);
        this.register('list database', DatabaseCommands.listDatabase);
        this.register('use database', DatabaseCommands.useDatabase);
        this.register('current database', DatabaseCommands.currentDatabase);
        this.register('edit database', DatabaseCommands.editDatabase);
        this.register('delete database', DatabaseCommands.deleteDatabase);

        // Cluster commands
        this.register('create cluster', ClusterCommands.createCluster);
        this.register('list cluster', ClusterCommands.listClusters);
        this.register('use cluster', ClusterCommands.useCluster);
        this.register('current cluster', ClusterCommands.currentCluster);
        this.register('edit cluster', ClusterCommands.editCluster);
        this.register('delete cluster', ClusterCommands.deleteCluster);

        // Collection commands
        this.register('create collection', CollectionCommands.createCollection);
        this.register('list collection', CollectionCommands.listCollection);
        this.register('use collection', CollectionCommands.useCollection);
        this.register('current collection', CollectionCommands.currentCollection);
        this.register('edit collection', CollectionCommands.editCollection);
        this.register('delete collection', CollectionCommands.deleteCollection);
        this.register('create schema', CollectionCommands.createSchema);
        this.register('insertone', CollectionCommands.insertOne);
        this.register('insertmany', CollectionCommands.insertMany);
        this.register('find', CollectionCommands.find);
        this.register('findone', CollectionCommands.findOne);
        this.register('listdata', CollectionCommands.listData);
        this.register('editone', CollectionCommands.editOne);
        this.register('deletemany', CollectionCommands.deleteMany);
        this.register('editmany', CollectionCommands.editMany);
        this.register('deleteone', CollectionCommands.deleteOne);
        this.register('edit schema', CollectionCommands.editSchema);
        this.register('delete schema', CollectionCommands.deleteSchema);
        this.register('switch filesystem', CollectionCommands.switchFilesystem);

        // Bucket commands
        this.register('create bucket', BucketCommands.createBucket);
        this.register('list bucket', BucketCommands.listBucket);
        this.register('use bucket', BucketCommands.useBucket);
        this.register('current bucket', BucketCommands.currentBucket);
        this.register('create folder', BucketCommands.createFolder);
        this.register('use folder', BucketCommands.useFolder);
        this.register('switch json', BucketCommands.switchJson);
        this.register('insert files', BucketCommands.insertFiles);
        this.register('list files', BucketCommands.listFiles);
        this.register('find', BucketCommands.find);
        this.register('findone', BucketCommands.findOne);
        this.register('signedurl', BucketCommands.signedUrl);
        this.register('preview', BucketCommands.preview);
        this.register('get file', BucketCommands.getFile);
        this.register('get files', BucketCommands.getFiles);
        this.register('list statistics', BucketCommands.listStatistics);

        // Utility commands
        this.register('status', UtilityCommands.status);
        this.register('health', UtilityCommands.health);
        this.register('version', UtilityCommands.version);
        this.register('stats', UtilityCommands.stats);
        this.register('mode', UtilityCommands.mode);
        this.register('clear', UtilityCommands.clear);
        this.register('start', UtilityCommands.start);
        this.register('restart', UtilityCommands.restart);
        this.register('exit', UtilityCommands.exit);
        this.register('stop', UtilityCommands.stop);
        this.register('help', UtilityCommands.help);
    }

    register(name, commandMethod) {
        // Wrap the method in an object with execute method
        if (typeof commandMethod === 'function') {
            this.commands.set(name, {
                execute: commandMethod,
                help: commandMethod.help || 'No description available'
            });
        } else if (commandMethod && typeof commandMethod.execute === 'function') {
            // Already has execute method
            this.commands.set(name, commandMethod);
        } else {
            console.warn(chalk.yellow(`⚠️ Invalid command format for: ${name}`));
            this.commands.set(name, {
                execute: async () => {
                    console.log(chalk.cyan(`Command "${name}" is not properly configured.`));
                },
                help: 'Command configuration error'
            });
        }
    }


    async execute(commandName, args, cli) {
        const command = this.commands.get(commandName);
        if (!command) {
            console.log(chalk.cyan(`Unknown command: ${commandName}. Type 'help' for available commands.`));
            return
        }

        if (typeof command.execute === 'function') {
            return await command.execute(args, cli);
        } else {
            console.log(chalk.red(`Invalid command implementation for: ${commandName}`));
            return
        }
    }

    async execute(commandName, args, cli) {
        const command = this.commands.get(commandName);
        if (!command) {
            throw new Error(`Unknown command: ${commandName}. Type 'help' for available commands.`);
        }
        return await command.execute(args, cli);
    }

    getCommandNames() {
        return Array.from(this.commands.keys());
    }

    getCommandsByCategory() {
        const categories = {
            authentication: [],
            database: [],
            cluster: [],
            collection: [],
            bucket: [],
            utility: []
        };

        this.commands.forEach((cmd, name) => {
            let category = 'utility';

            if (name.includes('register') || name.includes('login') || name.includes('logout') || name.includes('user') || name.includes('change-role')) {
                category = 'authentication';
            } else if (name.includes('database')) {
                category = 'database';
            } else if (name.includes('cluster')) {
                category = 'cluster';
            } else if (name.includes('collection') || name.includes('schema') || name.includes('insert') ||
                name.includes('find') || name.includes('edit') || name.includes('delete') || name.includes('listdata')) {
                category = 'collection';
            } else if (name.includes('bucket') || name.includes('folder') || name.includes('switch')) {
                category = 'bucket';
            }

            categories[category].push({
                name,
                help: cmd.help || 'No description available'
            });
        });

        return categories;
    }
}

module.exports = CommandRegistry;