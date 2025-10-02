const EncryptionService = require('../core/encryption');

class Cluster {
    constructor(id, name, databaseId, type = 'mixed', createdAt = new Date()) {
        this.id = id;
        this.name = name;
        this.databaseId = databaseId;
        this.type = type; // 'json_only', 'file_only', 'mixed'
        this.createdAt = createdAt;
        this.updatedAt = new Date();
        this.collections = [];
        this.buckets = [];
        this.permissions = {};
        this.statistics = {
            collections: 0,
            buckets: 0,
            documents: 0,
            files: 0,
            totalSize: 0,
            lastActivity: new Date()
        };
        this.settings = {
            replication: {
                enabled: false,
                factor: 1
            },
            backup: {
                enabled: true,
                interval: '24h'
            },
            compression: true,
            encryption: true
        };
    }

    addCollection(collection) {
        this.collections.push({
            id: collection.id,
            name: collection.name,
            createdAt: collection.createdAt
        });
        this.statistics.collections = this.collections.length;
        this.updatedAt = new Date();
    }

    removeCollection(collectionId) {
        this.collections = this.collections.filter(c => c.id !== collectionId);
        this.statistics.collections = this.collections.length;
        this.updatedAt = new Date();
    }

    addBucket(bucket) {
        this.buckets.push({
            id: bucket.id,
            name: bucket.name,
            createdAt: bucket.createdAt
        });
        this.statistics.buckets = this.buckets.length;
        this.updatedAt = new Date();
    }

    removeBucket(bucketId) {
        this.buckets = this.buckets.filter(b => b.id !== bucketId);
        this.statistics.buckets = this.buckets.length;
        this.updatedAt = new Date();
    }

    getCollectionById(collectionId) {
        return this.collections.find(c => c.id === collectionId);
    }

    getCollectionByName(collectionName) {
        return this.collections.find(c => c.name === collectionName);
    }

    getBucketById(bucketId) {
        return this.buckets.find(b => b.id === bucketId);
    }

    getBucketByName(bucketName) {
        return this.buckets.find(b => b.name === bucketName);
    }

    updateStatistics() {
        // This would be called periodically to update cluster statistics
        this.statistics.lastActivity = new Date();
        this.updatedAt = new Date();
    }

    canCreateCollection() {
        return this.type === 'json_only' || this.type === 'mixed';
    }

    canCreateBucket() {
        return this.type === 'file_only' || this.type === 'mixed';
    }

    validateOperation(operationType) {
        switch (operationType) {
            case 'create_collection':
                return this.canCreateCollection();
            case 'create_bucket':
                return this.canCreateBucket();
            case 'json_operation':
                return this.type === 'json_only' || this.type === 'mixed';
            case 'file_operation':
                return this.type === 'file_only' || this.type === 'mixed';
            default:
                return true;
        }
    }

    getResourceCount() {
        return {
            collections: this.collections.length,
            buckets: this.buckets.length,
            total: this.collections.length + this.buckets.length
        };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            databaseId: this.databaseId,
            type: this.type,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            collections: this.collections,
            buckets: this.buckets,
            statistics: this.statistics,
            settings: this.settings,
            permissions: this.permissions
        };
    }

    static fromJSON(data) {
        const cluster = new Cluster(data.id, data.name, data.databaseId, data.type, data.createdAt);
        cluster.updatedAt = data.updatedAt;
        cluster.collections = data.collections || [];
        cluster.buckets = data.buckets || [];
        cluster.statistics = data.statistics || cluster.statistics;
        cluster.settings = data.settings || cluster.settings;
        cluster.permissions = data.permissions || {};
        return cluster;
    }

    static createFromTemplate(template) {
        const clusterId = EncryptionService.generateId('cluster');
        return new Cluster(
            clusterId,
            template.name,
            template.databaseId,
            template.type || 'mixed'
        );
    }
}

module.exports = Cluster;