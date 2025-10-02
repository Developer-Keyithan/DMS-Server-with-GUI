const EncryptionService = require('../core/encryption');

class Bucket {
    constructor(id, name, clusterId, databaseId, createdAt = new Date()) {
        this.id = id;
        this.name = name;
        this.clusterId = clusterId;
        this.databaseId = databaseId;
        this.createdAt = createdAt;
        this.updatedAt = new Date();
        this.folders = [];
        this.files = [];
        this.permissions = {};
        this.statistics = {
            totalFiles: 0,
            totalSize: 0,
            folders: 0,
            fileTypes: {},
            sizeDistribution: {
                '0-1MB': 0,
                '1-10MB': 0,
                '10-100MB': 0,
                '100MB+': 0
            }
        };
        this.settings = {
            maxFileSize: 100 * 1024 * 1024, // 100MB
            allowedTypes: ['*'],
            compression: true,
            encryption: true
        };
    }

    addFolder(folder) {
        this.folders.push({
            id: folder.id,
            name: folder.name,
            path: folder.path,
            createdAt: folder.createdAt
        });
        this.statistics.folders = this.folders.length;
        this.updatedAt = new Date();
    }

    removeFolder(folderId) {
        this.folders = this.folders.filter(f => f.id !== folderId);
        this.statistics.folders = this.folders.length;
        this.updatedAt = new Date();
    }

    addFile(file) {
        this.files.push({
            id: file.id,
            name: file.name,
            size: file.size,
            mimeType: file.mimeType,
            uploadedAt: file.uploadedAt
        });
        
        this.updateStatistics(file);
        this.updatedAt = new Date();
    }

    removeFile(fileId) {
        const file = this.files.find(f => f.id === fileId);
        if (file) {
            this.files = this.files.filter(f => f.id !== fileId);
            this.updateStatistics(file, true);
            this.updatedAt = new Date();
        }
    }

    updateStatistics(file, isRemoval = false) {
        const multiplier = isRemoval ? -1 : 1;
        
        this.statistics.totalFiles += multiplier;
        this.statistics.totalSize += file.size * multiplier;
        
        // Update file type statistics
        const fileType = file.mimeType.split('/')[0];
        this.statistics.fileTypes[fileType] = (this.statistics.fileTypes[fileType] || 0) + multiplier;
        if (this.statistics.fileTypes[fileType] <= 0) {
            delete this.statistics.fileTypes[fileType];
        }
        
        // Update size distribution
        const sizeRanges = this.statistics.sizeDistribution;
        if (file.size < 1024 * 1024) sizeRanges['0-1MB'] += multiplier;
        else if (file.size < 10 * 1024 * 1024) sizeRanges['1-10MB'] += multiplier;
        else if (file.size < 100 * 1024 * 1024) sizeRanges['10-100MB'] += multiplier;
        else sizeRanges['100MB+'] += multiplier;
    }

    getFolderById(folderId) {
        return this.folders.find(f => f.id === folderId);
    }

    getFolderByPath(path) {
        return this.folders.find(f => f.path === path);
    }

    getFileById(fileId) {
        return this.files.find(f => f.id === fileId);
    }

    searchFiles(query) {
        return this.files.filter(file => {
            if (query.name && !file.name.includes(query.name)) return false;
            if (query.type && !file.mimeType.includes(query.type)) return false;
            if (query.size) {
                const size = parseInt(query.size);
                if (file.size !== size) return false;
            }
            return true;
        });
    }

    canUploadFile(fileSize, mimeType) {
        if (fileSize > this.settings.maxFileSize) {
            return { allowed: false, reason: `File size exceeds maximum limit of ${this.formatSize(this.settings.maxFileSize)}` };
        }
        
        if (this.settings.allowedTypes[0] !== '*' && 
            !this.settings.allowedTypes.includes(mimeType)) {
            return { allowed: false, reason: `File type ${mimeType} is not allowed` };
        }
        
        return { allowed: true };
    }

    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            clusterId: this.clusterId,
            databaseId: this.databaseId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            folders: this.folders,
            files: this.files,
            statistics: this.statistics,
            settings: this.settings,
            permissions: this.permissions
        };
    }

    static fromJSON(data) {
        const bucket = new Bucket(data.id, data.name, data.clusterId, data.databaseId, data.createdAt);
        bucket.updatedAt = data.updatedAt;
        bucket.folders = data.folders || [];
        bucket.files = data.files || [];
        bucket.statistics = data.statistics || bucket.statistics;
        bucket.settings = data.settings || bucket.settings;
        bucket.permissions = data.permissions || {};
        return bucket;
    }
}

module.exports = Bucket;