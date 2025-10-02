const EncryptionService = require('../core/encryption');

class Database {
    constructor(id, name, ownerId, createdAt = new Date()) {
        this.id = id;
        this.name = name;
        this.ownerId = ownerId;
        this.createdAt = createdAt;
        this.updatedAt = new Date();
        this.clusters = [];
        this.permissions = {
            [ownerId]: ['admin'] // Owner has full admin rights
        };
        this.statistics = {
            collections: 0,
            buckets: 0,
            documents: 0,
            files: 0,
            totalSize: 0,
            lastActivity: new Date(),
            operations: {
                read: 0,
                write: 0,
                delete: 0
            }
        };
        this.settings = {
            encryption: {
                enabled: true,
                algorithm: 'aes-256-gcm',
                keyRotation: {
                    enabled: true,
                    interval: 90 // days
                }
            },
            backup: {
                enabled: true,
                schedule: '0 2 * * *', // Daily at 2 AM
                retention: 30 // days
            },
            replication: {
                enabled: false,
                nodes: []
            },
            compression: {
                enabled: true,
                level: 6
            },
            auditing: {
                enabled: true,
                logLevel: 'info'
            }
        };
        this.metadata = {
            description: '',
            tags: [],
            version: '1.0.0',
            environment: 'development'
        };
    }

    addCluster(cluster) {
        this.clusters.push({
            id: cluster.id,
            name: cluster.name,
            type: cluster.type,
            createdAt: cluster.createdAt
        });
        this.updateStatistics();
        this.updatedAt = new Date();
    }

    removeCluster(clusterId) {
        this.clusters = this.clusters.filter(c => c.id !== clusterId);
        this.updateStatistics();
        this.updatedAt = new Date();
    }

    getClusterById(clusterId) {
        return this.clusters.find(c => c.id === clusterId);
    }

    getClusterByName(clusterName) {
        return this.clusters.find(c => c.name === clusterName);
    }

    updateStatistics() {
        // This would be calculated from actual cluster data
        // For now, we'll set basic counts
        this.statistics.collections = this.clusters.reduce((sum, cluster) => 
            sum + (cluster.collections || 0), 0);
        this.statistics.buckets = this.clusters.reduce((sum, cluster) => 
            sum + (cluster.buckets || 0), 0);
        this.statistics.lastActivity = new Date();
        this.updatedAt = new Date();
    }

    // Permission management
    grantPermission(userId, permissions) {
        if (!this.permissions[userId]) {
            this.permissions[userId] = [];
        }
        
        permissions.forEach(permission => {
            if (!this.permissions[userId].includes(permission)) {
                this.permissions[userId].push(permission);
            }
        });
        
        this.updatedAt = new Date();
    }

    revokePermission(userId, permissions) {
        if (!this.permissions[userId]) return;
        
        if (permissions === 'all') {
            delete this.permissions[userId];
        } else {
            this.permissions[userId] = this.permissions[userId].filter(
                p => !permissions.includes(p)
            );
            
            if (this.permissions[userId].length === 0) {
                delete this.permissions[userId];
            }
        }
        
        this.updatedAt = new Date();
    }

    hasPermission(userId, permission) {
        // Owner has all permissions
        if (userId === this.ownerId) return true;
        
        const userPermissions = this.permissions[userId];
        if (!userPermissions) return false;
        
        return userPermissions.includes('admin') || userPermissions.includes(permission);
    }

    getUserPermissions(userId) {
        if (userId === this.ownerId) {
            return ['admin', 'read', 'write', 'delete', 'manage_users'];
        }
        return this.permissions[userId] || [];
    }

    // Settings management
    updateSettings(newSettings) {
        this.settings = this.deepMerge(this.settings, newSettings);
        this.updatedAt = new Date();
    }

    updateMetadata(newMetadata) {
        this.metadata = { ...this.metadata, ...newMetadata };
        this.updatedAt = new Date();
    }

    // Backup and maintenance
    getBackupInfo() {
        return {
            lastBackup: this.statistics.lastBackup,
            nextBackup: this.calculateNextBackup(),
            size: this.statistics.totalSize,
            clusterCount: this.clusters.length
        };
    }

    calculateNextBackup() {
        // Simple calculation - in production, use proper cron parsing
        const now = new Date();
        const nextBackup = new Date(now);
        nextBackup.setDate(nextBackup.getDate() + 1);
        nextBackup.setHours(2, 0, 0, 0);
        return nextBackup;
    }

    // Utility methods
    deepMerge(target, source) {
        const output = { ...target };
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        output[key] = source[key];
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    output[key] = source[key];
                }
            });
        }
        
        return output;
    }

    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    }

    validateName(newName) {
        if (!newName || newName.trim().length === 0) {
            return { valid: false, error: 'Database name cannot be empty' };
        }

        if (newName.length < 2 || newName.length > 50) {
            return { valid: false, error: 'Database name must be between 2 and 50 characters' };
        }

        if (!/^[a-zA-Z0-9_\- ]+$/.test(newName)) {
            return { valid: false, error: 'Database name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }

        return { valid: true };
    }

    // Export and import
    toExportFormat(includeData = false) {
        const exportData = {
            id: this.id,
            name: this.name,
            ownerId: this.ownerId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            metadata: this.metadata,
            settings: this.settings,
            statistics: this.statistics,
            permissions: this.permissions,
            clusterCount: this.clusters.length
        };

        if (includeData) {
            exportData.clusters = this.clusters;
        }

        return exportData;
    }

    // Search and filtering
    searchClusters(query) {
        return this.clusters.filter(cluster => 
            cluster.name.toLowerCase().includes(query.toLowerCase()) ||
            cluster.type.toLowerCase().includes(query.toLowerCase())
        );
    }

    getClusterStatistics() {
        const stats = {
            total: this.clusters.length,
            byType: {
                json_only: 0,
                file_only: 0,
                mixed: 0
            },
            active: 0,
            inactive: 0
        };

        this.clusters.forEach(cluster => {
            stats.byType[cluster.type] = (stats.byType[cluster.type] || 0) + 1;
            
            // Simple activity check - in production, use actual activity data
            const isActive = true; // This would be determined by actual usage
            if (isActive) stats.active++;
            else stats.inactive++;
        });

        return stats;
    }

    // Lifecycle management
    canBeDeleted() {
        // Check if database has any active operations or important data
        const hasClusters = this.clusters.length > 0;
        const hasRecentActivity = new Date() - this.statistics.lastActivity < 24 * 60 * 60 * 1000; // 24 hours
        
        return {
            canDelete: !hasClusters,
            warnings: hasClusters ? ['Database contains clusters that will be deleted'] : [],
            requiresForce: hasClusters
        };
    }

    // Migration and versioning
    getMigrationPlan(targetVersion) {
        // This would generate a migration plan for database schema changes
        return {
            currentVersion: this.metadata.version,
            targetVersion: targetVersion,
            steps: [],
            estimatedDuration: '5 minutes',
            risks: ['Data loss possible', 'Backup recommended']
        };
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            ownerId: this.ownerId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            clusters: this.clusters,
            permissions: this.permissions,
            statistics: this.statistics,
            settings: this.settings,
            metadata: this.metadata
        };
    }

    static fromJSON(data) {
        const database = new Database(data.id, data.name, data.ownerId, data.createdAt);
        database.updatedAt = data.updatedAt;
        database.clusters = data.clusters || [];
        database.permissions = data.permissions || {};
        database.statistics = data.statistics || database.statistics;
        database.settings = data.settings || database.settings;
        database.metadata = data.metadata || database.metadata;
        return database;
    }

    static createFromTemplate(template) {
        const databaseId = EncryptionService.generateId('db');
        return new Database(
            databaseId,
            template.name,
            template.ownerId
        );
    }

    // Performance and monitoring
    getPerformanceMetrics() {
        return {
            readOperations: this.statistics.operations.read,
            writeOperations: this.statistics.operations.write,
            deleteOperations: this.statistics.operations.delete,
            averageResponseTime: this.calculateAverageResponseTime(),
            errorRate: this.calculateErrorRate(),
            storageUsage: this.statistics.totalSize,
            activeConnections: this.getActiveConnections()
        };
    }

    calculateAverageResponseTime() {
        // This would be calculated from actual performance data
        return 45; // milliseconds
    }

    calculateErrorRate() {
        // This would be calculated from actual error data
        return 0.02; // 2%
    }

    getActiveConnections() {
        // This would track actual active connections
        return Math.floor(Math.random() * 10) + 1; // Simulated
    }

    // Security and compliance
    getSecurityReport() {
        return {
            encryption: {
                enabled: this.settings.encryption.enabled,
                algorithm: this.settings.encryption.algorithm,
                keyRotation: this.settings.encryption.keyRotation.enabled
            },
            auditing: {
                enabled: this.settings.auditing.enabled,
                logLevel: this.settings.auditing.logLevel
            },
            accessControl: {
                userCount: Object.keys(this.permissions).length,
                lastAccessReview: this.getLastAccessReview()
            },
            compliance: {
                meetsRequirements: this.checkCompliance(),
                issues: this.getComplianceIssues()
            }
        };
    }

    getLastAccessReview() {
        // This would be stored and retrieved from audit logs
        return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    }

    checkCompliance() {
        // Basic compliance checks
        return this.settings.encryption.enabled && 
               this.settings.auditing.enabled &&
               Object.keys(this.permissions).length > 0;
    }

    getComplianceIssues() {
        const issues = [];
        
        if (!this.settings.encryption.enabled) {
            issues.push('Encryption is not enabled');
        }
        
        if (!this.settings.auditing.enabled) {
            issues.push('Auditing is not enabled');
        }
        
        if (Object.keys(this.permissions).length === 0) {
            issues.push('No access controls configured');
        }
        
        return issues;
    }
}

module.exports = Database;