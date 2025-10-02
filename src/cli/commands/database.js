// All done

const StorageEngine = require('../../core/storage-engine');
const AuthorizationService = require('../../auth/authorization');
const EncryptionService = require('../../core/encryption');
const colors = require('../utils/colors');
const chalk = require('chalk');

class DatabaseCommands {
    static async createDatabase(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return
        }

        if (args.length < 1) {
            colors.printError('Database name missing');
            console.log('Usage: create database <name>');
            return
        }

        const name = args[0];
        const dbStorage = new StorageEngine('databases');

        // Check if database already exists
        const existing = await dbStorage.find({ name });
        if (existing.length > 0) {
            colors.printWarning(`Database '${name}' already exists`);
            return
        }

        if (!AuthorizationService.hasPermission(user.role, 'db.create')) {
            colors.printError('Insufficient permissions to create database');
            return
        }

        const databaseId = EncryptionService.generateId('db');
        const database = {
            id: databaseId,
            name,
            ownerId: user.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            permissions: {
                [user.userId]: ['admin']
            },
            clusters: [],
            statistics: {
                collections: 0,
                buckets: 0,
                documents: 0,
                files: 0,
                size: 0
            }
        };

        await dbStorage.save(databaseId, database);
        colors.printSuccess(`Database '${name}' created successfully with ID: ${databaseId}`);
    }

    static async listDatabase(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return
        }

        const dbStorage = new StorageEngine('databases');
        const databases = await dbStorage.findAll();

        const userDatabases = databases.filter(db =>
            AuthorizationService.canAccessDatabase(user, db, 'read')
        );

        if (userDatabases.length === 0) {
            colors.printWarning('No databases found.');
            return;
        }

        const tableData = userDatabases.map(db => [
            // db.id.length > 20 ? db.id.substring(0, 17) + '...' : db.id,
            // db.name.length > 16 ? db.name.substring(0, 13) + '...' : db.name,
            db.id,
            db.name,
            new Date(db.createdAt).toISOString().split('T')[0],
            db.clusters.length.toString(),
            db.ownerId === user.userId ? 'Yes' : 'No'
        ]);

        colors.printTable(
            ['ID', 'Name', 'Created', 'Clusters', 'Owner'],
            tableData
        );
    }

    static async useDatabase(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return
        }

        if (args.length < 1) {
            colors.printError('Database name|id missing');
            console.log('Usage: use database <id|name>');
            return
        }

        const identifier = args[0];
        const dbStorage = new StorageEngine('databases');
        const databases = await dbStorage.findAll();

        const database = databases.find(db =>
            (db.id === identifier || db.name === identifier) &&
            AuthorizationService.canAccessDatabase(user, db, 'read')
        );

        if (!database) {
            colors.printError(`Database '${identifier}' not found or access denied`);
            return
        }

        cli.setContext('database', database);
        cli.setContext('cluster', null);
        cli.setContext('collection', null);
        cli.setContext('bucket', null);
        cli.setContext('folder', null);

        colors.printSuccess(`Using database: ${database.name}`);
    }

    static async currentDatabase(args, cli) {
        const database = cli.getContext().database;
        if (!database) {
            colors.printWarning('No database selected.');
            return;
        }

        console.log(colors.info('Current Database:'));
        console.log(`  ID: ${database.id}`);
        console.log(`  Name: ${database.name}`);
        console.log(`  Owner: ${database.ownerId}`);
        console.log(`  Created: ${new Date(database.createdAt).toLocaleString()}`);
        console.log(`  Clusters: ${database.clusters.length}`);
        console.log(`  Collections: ${database.statistics?.collections || 0}`);
        console.log(`  Buckets: ${database.statistics?.buckets || 0}`);
        console.log(`  Documents: ${database.statistics?.documents || 0}`);
        console.log(`  Files: ${database.statistics?.files || 0}`);
    }

    static async editDatabase(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return
        }

        if (args.length < 2) {
            colors.printError('Database name|id missing');
            colors.info('Usage: edit database <id|name> [name:new_name]');
            return
        }

        const identifier = args[0];
        const updates = {};

        // Parse update arguments
        for (let i = 1; i < args.length; i++) {
            const [key, value] = args[i].split(':');
            if (key && value) {
                updates[key] = value;
            }
        }

        if (Object.keys(updates).length === 0) {
            colors.printWarning('No valid updates provided');
            return
        }

        const dbStorage = new StorageEngine('databases');
        const databases = await dbStorage.findAll();
        const database = databases.find(db =>
            (db.id === identifier || db.name === identifier) &&
            AuthorizationService.canAccessDatabase(user, db, 'admin')
        );

        if (!database) {
            colors.printError(`Database '${identifier}' not found or insufficient permissions`);
            return
        }

        const updatedDatabase = { ...database, ...updates, updatedAt: new Date() };
        await dbStorage.save(database.id, updatedDatabase);

        // Update context if current database was edited
        const context = cli.getContext();
        if (context.database && context.database.id === database.id) {
            cli.setContext('database', updatedDatabase);
        }

        colors.printSuccess(`Database '${database.name}' updated successfully`);
    }

    // static async deleteDatabase(args, cli) {
    //     const user = cli.getUser();
    //     if (!user) {
    //         colors.printWarning('Please login first');
    //         return
    //     }

    //     if (args.length < 1) {
    //         colors.printError('Database name|id missing');
    //         console.log('Usage: delete database <id|name>');
    //         return
    //     }

    //     const identifier = args[0];
    //     const confirm = args.includes('-y');

    //     const dbStorage = new StorageEngine('databases');
    //     const databases = await dbStorage.findAll();
    //     const database = databases.find(db =>
    //         (db.id === identifier || db.name === identifier) &&
    //         AuthorizationService.canAccessDatabase(user, db, 'delete')
    //     );

    //     if (!database) {
    //         colors.printError(`Database '${identifier}' not found or insufficient permissions`);
    //         return
    //     }

    //     // 🔴 If clusters exist, ask extra confirmation
    //     if (database.clusters && database.clusters.length > 0) {
    //         return new Promise((resolve) => {
    //             cli.rl.question(
    //                 colors.printWarning(
    //                     `Database '${database.name}' has ${database.clusters.length} cluster(s).\n` +
    //                     `Deleting this database will also delete all cluster data.\n` +
    //                     `Are you sure? (y/N): `
    //                 ),
    //                 async (answer) => {
    //                     if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    //                         if (!confirm) {
    //                             // second normal confirmation (already existing -y check)
    //                             cli.rl.question(
    //                                 colors.printWarning(`Are you really sure you want to delete database '${database.name}'? This action cannot be undone. (y/N): `),
    //                                 async (ans2) => {
    //                                     if (ans2.toLowerCase() === 'y' || ans2.toLowerCase() === 'yes') {
    //                                         await DatabaseCommands.performDelete(database, dbStorage, cli, true);
    //                                     }
    //                                     resolve();
    //                                 }
    //                             );
    //                         } else {
    //                             await DatabaseCommands.performDelete(database, dbStorage, cli, true);
    //                             resolve();
    //                         }
    //                     } else {
    //                         colors.printWarning(`Cancelled deletion of database '${database.name}'.`);
    //                         resolve();
    //                     }
    //                 }
    //             );
    //         });
    //     }


    //     if (!confirm) {
    //         return new Promise((resolve) => {
    //             cli.rl.question(colors.warning(`Are you sure you want to delete database '${database.name}'? This action cannot be undone. (y/N): `), (answer) => {
    //                 if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
    //                     DatabaseCommands.performDelete(database, dbStorage, cli);
    //                 }
    //                 resolve();
    //             });
    //         });
    //     } else {
    //         await DatabaseCommands.performDelete(database, dbStorage, cli);
    //     }
    // }

    static async deleteDatabase(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return;
        }

        if (args.length < 1) {
            colors.printError('Database name|id missing');
            console.log('Usage: delete database <id|name>');
            return;
        }

        const identifier = args[0];
        const confirm = args.includes('-y');

        const dbStorage = new StorageEngine('databases');
        const databases = await dbStorage.findAll();
        const database = databases.find(db =>
            (db.id === identifier || db.name === identifier) &&
            AuthorizationService.canAccessDatabase(user, db, 'delete')
        );

        if (!database) {
            colors.printError(`Database '${identifier}' not found or insufficient permissions`);
            return;
        }

        // 🚫 Prevent deletion if clusters exist
        if (database.clusters && database.clusters.length > 0) {
            colors.printWarning(
                `Cannot delete database '${database.name}' because it has ${database.clusters.length} cluster(s).\n` +
                `👉 Delete all clusters first before deleting the database.`
            );
            return;
        }

        // ✅ Continue with deletion if no clusters
        if (!confirm) {
            return new Promise((resolve) => {
                cli.rl.question(colors.printWarning(
                    `Are you sure you want to delete database '${database.name}'? This action cannot be undone. (y/N): `
                ), async (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        await DatabaseCommands.performDelete(database, dbStorage, cli);
                    }
                    resolve();
                });
            });
        } else {
            await DatabaseCommands.performDelete(database, dbStorage, cli);
        }
    }

    static async performDelete(database, dbStorage, cli) {
        await dbStorage.delete(database.id);

        // Clear context if deleted database was current
        const context = cli.getContext();
        if (context.database && context.database.id === database.id) {
            cli.clearContext();
        }

        colors.printSuccess(`Database '${database.name}' deleted successfully`);
    }
}

// Command metadata
DatabaseCommands.createDatabase.help = 'Create a new database: create database <name>';
DatabaseCommands.listDatabase.help = 'List all accessible databases: list database';
DatabaseCommands.useDatabase.help = 'Switch to a database: use database <id|name>';
DatabaseCommands.currentDatabase.help = 'Show current database: current database';
DatabaseCommands.editDatabase.help = 'Edit database: edit database <id|name> [name:new_name]';
DatabaseCommands.deleteDatabase.help = 'Delete database: delete database <id|name> [-y]';

module.exports = DatabaseCommands;