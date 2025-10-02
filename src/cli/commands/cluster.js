// All done

const StorageEngine = require('../../core/storage-engine');
const AuthorizationService = require('../../auth/authorization');
const EncryptionService = require('../../core/encryption');
const colors = require('../utils/colors');
const chalk = require('chalk');

class ClusterCommands {
    static async createCluster(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return;
        }

        const context = cli.getContext();
        if (!context.database) {
            colors.printInfo('No database selected. Use "use database <name>" first.');
            return;
        }

        if (args.length < 1) {
            colors.printError('Cluster name missing');
            console.log('Usage: create cluster <name>');
            return;
        }

        const name = args[0];
        const dbStorage = new StorageEngine('databases');

        // Load current database
        const database = await dbStorage.findById(context.database.id);

        if (!database.clusters) {
            database.clusters = [];
        }

        if (!database.statistics) {
            database.statistics = {
                clusters: 0,
                collections: 0,
                buckets: 0,
                documents: 0,
                files: 0,
                size: 0
            };
        }

        // Check if cluster already exists
        if (database.clusters.some(cluster => cluster.name === name)) {
            colors.printWarning(`Cluster '${name}' already exists in this database`);
            return;
        }

        if (!AuthorizationService.canAccessDatabase(user, database, 'write')) {
            colors.printError('Insufficient permissions to create cluster');
            return;
        }

        const clusterId = EncryptionService.generateId('cluster');

        const cluster = {
            id: clusterId,
            name,
            databaseId: database.id,
            type: 'mixed', // 'json_only', 'file_only', 'mixed'
            createdAt: new Date(),
            updatedAt: new Date(),
            collections: [],
            buckets: [],
            statistics: {
                collections: 0,
                buckets: 0,
                documents: 0,
                files: 0,
                size: 0
            }
        };

        // Add cluster to database
        database.clusters.push({
            id: clusterId,
            name,
            createdAt: cluster.createdAt
        });

        // Update database statistics
        database.statistics.clusters += 1;
        database.updatedAt = new Date();

        // Save updated database
        await dbStorage.save(database.id, database);

        // Update CLI context so statistics reflect the new cluster
        cli.setContext('database', database);

        // Create cluster storage
        const clusterStorage = new StorageEngine(`${clusterId}`);
        await clusterStorage.save('metadata', cluster);

        colors.printSuccess(`Cluster '${name}' created successfully with ID: ${clusterId}`);
    }

    static async listClusters(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return
        }

        const context = cli.getContext();
        if (!context.database) {
            colors.printInfo('No database selected. Use "use database <name>" first.');
            return
        }

        const dbStorage = new StorageEngine('databases');
        const database = await dbStorage.findById(context.database.id);

        if (!AuthorizationService.canAccessDatabase(user, database, 'read')) {
            colors.printError('Insufficient permissions to view clusters');
            return
        }

        if (database.clusters.length === 0) {
            colors.printWarning('No clusters found in this database.');
            return;
        }

        // Load cluster details
        const clusterDetails = [];
        for (const clusterRef of database.clusters) {
            const clusterStorage = new StorageEngine(`${clusterRef.id}`);
            const cluster = await clusterStorage.findById('metadata');
            if (cluster) {
                clusterDetails.push(cluster);
            }
        }

        const tableData = clusterDetails.map(cluster => [
            // cluster.id.length > 20 ? cluster.id.substring(0, 17) + '...' : cluster.id,
            // cluster.name.length > 16 ? cluster.name.substring(0, 13) + '...' : cluster.name,
            cluster.id,
            cluster.name,
            cluster.type,
            new Date(cluster.createdAt).toISOString().split('T')[0],
            cluster.collections.length.toString(),
            cluster.buckets.length.toString()
        ]);

        colors.printTable(
            ['ID', 'Name', 'Type', 'Created', 'Collections', 'Buckets'],
            tableData
        );
    }

    static async useCluster(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return
        }

        const context = cli.getContext();
        if (!context.database) {
            colors.printInfo('No database selected. Use "use database <name>" first.');
            return
        }

        if (args.length < 1) {
            colors.printError('Cluster name|id missing');
            console.log('Usage: use cluster <id|name>');
            return
        }

        const identifier = args[0];
        const dbStorage = new StorageEngine('databases');
        const database = await dbStorage.findById(context.database.id);

        const clusterRef = database.clusters.find(cluster =>
            cluster.id === identifier || cluster.name === identifier
        );

        if (!clusterRef) {
            colors.printWarning(`Cluster '${identifier}' not found in database '${database.name}'`);
            return
        }

        // Load cluster details
        const clusterStorage = new StorageEngine(`${clusterRef.id}`);
        const cluster = await clusterStorage.findById('metadata');

        if (!cluster) {
            colors.printError('Cluster data corrupted or not found');
            return
        }

        if (!AuthorizationService.canAccessDatabase(user, database, 'read')) {
            colors.printError('Insufficient permissions to access cluster');
            return
        }

        cli.setContext('cluster', cluster);
        cli.setContext('collection', null);
        cli.setContext('bucket', null);
        cli.setContext('folder', null);

        colors.printSuccess(`Using cluster: ${cluster.name}`);
    }

    static async currentCluster(args, cli) {
        const cluster = cli.getContext().cluster;
        if (!cluster) {
            colors.printWarning('No cluster selected.');
            return;
        }

        console.log(colors.info('Current Cluster:'));
        console.log(`  ID: ${cluster.id}`);
        console.log(`  Name: ${cluster.name}`);
        console.log(`  Database: ${cluster.databaseId}`);
        console.log(`  Type: ${cluster.type}`);
        console.log(`  Created: ${new Date(cluster.createdAt).toLocaleString()}`);
        console.log(`  Collections: ${cluster.collections.length}`);
        console.log(`  Buckets: ${cluster.buckets.length}`);
        console.log(`  Documents: ${cluster.statistics?.documents || 0}`);
        console.log(`  Files: ${cluster.statistics?.files || 0}`);
    }

    static async editCluster(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            colors.printWarning('No database or cluster selected.');
            return;
        }

        if (args.length < 2) {
            if (args.length < 1) {
                colors.printError('Cluster name|id missing');
            } else {
                colors.printError('Cluster new name missing');
            }
            console.log('Usage: edit cluster <id|name> [name:new_name] [type:json_only|file_only|mixed]');
            return;
        }

        const identifier = args[0];
        const updates = {};

        // Parse update arguments
        for (let i = 1; i < args.length; i++) {
            const [key, value] = args[i].split(':');
            if (key && value) {
                if (key === 'type' && !['json_only', 'file_only', 'mixed'].includes(value)) {
                    colors.printError('Type must be one of: json_only, file_only, mixed');
                    return;
                }
                updates[key] = value;
            }
        }

        if (Object.keys(updates).length === 0) {
            colors.printWarning('No valid updates provided');
            return;
        }

        const dbStorage = new StorageEngine('databases');
        const database = await dbStorage.findById(context.database.id);

        if (!AuthorizationService.canAccessDatabase(user, database, 'write')) {
            colors.printError('Insufficient permissions to edit cluster');
            return
        }

        const clusterRef = database.clusters.find(cluster =>
            cluster.id === identifier || cluster.name === identifier
        );

        if (!clusterRef) {
            colors.printError(`Cluster '${identifier}' not found`);
            return
        }

        // Update cluster metadata
        const clusterStorage = new StorageEngine(`${clusterRef.id}`);
        const cluster = await clusterStorage.findById('metadata');

        if (!cluster) {
            colors.printError('Cluster data not found');
            return
        }

        const updatedCluster = { ...cluster, ...updates, updatedAt: new Date() };
        await clusterStorage.save('metadata', updatedCluster);

        // Update database cluster reference if name changed
        if (updates.name && clusterRef.name !== updates.name) {
            clusterRef.name = updates.name;
            database.updatedAt = new Date();
            await dbStorage.save(database.id, database);
        }

        // Update context if current cluster was edited
        if (context.cluster && context.cluster.id === cluster.id) {
            cli.setContext('cluster', updatedCluster);
        }

        colors.printSuccess(`Cluster '${cluster.name}' updated successfully`);
    }

    static async deleteCluster(args, cli) {
        const user = cli.getUser();
        if (!user) {
            colors.printWarning('Please login first');
            return;
        }

        const context = cli.getContext();
        if (!context.database) {
            colors.printInfo('No database selected. Use "use database <name>" first.');
            return;
        }

        if (args.length < 1) {
            colors.printError('Cluster name|id missing');
            console.log('Usage: delete cluster <id|name>');
            return;
        }

        const identifier = args[0];

        const dbStorage = new StorageEngine('databases');
        const database = await dbStorage.findById(context.database.id);

        if (!AuthorizationService.canAccessDatabase(user, database, 'delete')) {
            colors.printError('Insufficient permissions to delete cluster');
            return;
        }

        const clusterIndex = database.clusters.findIndex(cluster =>
            cluster.id === identifier || cluster.name === identifier
        );

        if (clusterIndex === -1) {
            colors.printError(`Cluster '${identifier}' not found`);
            return;
        }

        const clusterRef = database.clusters[clusterIndex];

        // Load cluster details
        const clusterStorage = new StorageEngine(clusterRef.id);
        const cluster = await clusterStorage.findById('metadata');

        if (!cluster) {
            colors.printError('Cluster data not found');
            return;
        }

        // Check if cluster has collections or buckets
        if ((cluster.collections?.length || 0) > 0 || (cluster.buckets?.length || 0) > 0) {
            colors.printWarning(
                `Cluster '${clusterRef.name}' has ${cluster.collections?.length} collection(s) and ${cluster.buckets?.length} bucket(s) and cannot be deleted.\n` +
                `👉 Delete all collections and buckets first before deleting the cluster.`);
            return;
        }

        // Remove cluster from database & delete cluster file
        await ClusterCommands.performDelete(clusterRef, database, dbStorage, clusterIndex, cli);
    }

    static async performDelete(clusterRef, database, dbStorage, clusterIndex, cli) {
        // Remove cluster from database
        database.clusters.splice(clusterIndex, 1);
        database.statistics.clusters = database.clusters.length;
        database.updatedAt = new Date();
        await dbStorage.save(database.id, database);

        // Remove cluster file
        const clusterStorage = new StorageEngine(clusterRef.id);
        clusterStorage.removeFile();
        console.log(`Cluster file '${clusterRef.id}.hexa' removed.`);

        colors.printSuccess(`Cluster '${clusterRef.name}' deleted successfully`);

        // Clear context if deleted cluster was current
        const context = cli.getContext();
        if (context.cluster && context.cluster.id === clusterRef.id) {
            cli.setContext('cluster', null);
            cli.setContext('collection', null);
            cli.setContext('bucket', null);
            cli.setContext('folder', null);
        }

        cli.setContext('database', database);
    }
}

// Command metadata
ClusterCommands.createCluster.help = 'Create a new cluster: create cluster <name>';
ClusterCommands.listClusters.help = 'List all clusters in current database: list cluster';
ClusterCommands.useCluster.help = 'Switch to a cluster: use cluster <id|name>';
ClusterCommands.currentCluster.help = 'Show current cluster: current cluster';
ClusterCommands.editCluster.help = 'Edit cluster: edit cluster <id|name> [name:new_name] [type:json_only|file_only|mixed]';
ClusterCommands.deleteCluster.help = 'Delete cluster: delete cluster <id|name> [-y]';

module.exports = ClusterCommands;