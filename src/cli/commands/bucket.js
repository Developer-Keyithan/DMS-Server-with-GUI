const StorageEngine = require('../../core/storage-engine');
const AuthorizationService = require('../../auth/authorization');
const EncryptionService = require('../../core/encryption');
const colors = require('../utils/colors');
const fs = require('fs');
const path = require('path');

class BucketCommands {
    static async createBucket(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected. Use "use database" and "use cluster" first.');
        }

        if (args.length < 1) {
            throw new Error('Usage: create bucket <name>');
        }

        const name = args[0];

        // Check permissions
        if (!AuthorizationService.canAccessFile(user, null, 'write')) {
            throw new Error('Insufficient permissions to create bucket');
        }

        const clusterStorage = new StorageEngine(`cluster_${context.cluster.id}`);
        const cluster = await clusterStorage.findById('metadata');

        // Check if bucket already exists
        if (cluster.buckets.some(bucket => bucket.name === name)) {
            throw new Error(`Bucket '${name}' already exists in this cluster`);
        }

        const bucketId = EncryptionService.generateId('bucket');
        const bucket = {
            id: bucketId,
            name,
            clusterId: context.cluster.id,
            databaseId: context.database.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            folders: [],
            files: [],
            statistics: {
                totalFiles: 0,
                totalSize: 0,
                folders: 0
            }
        };

        // Add bucket to cluster
        cluster.buckets.push({
            id: bucketId,
            name,
            createdAt: bucket.createdAt
        });
        cluster.updatedAt = new Date();
        cluster.statistics.buckets = cluster.buckets.length;

        await clusterStorage.save('metadata', cluster);

        // Create bucket storage
        const bucketStorage = new StorageEngine(`bucket_${bucketId}`);
        await bucketStorage.save('metadata', bucket);

        colors.printSuccess(`Bucket '${name}' created successfully with ID: ${bucketId}`);
    }

    static async listBucket(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected.');
        }

        const clusterStorage = new StorageEngine(`cluster_${context.cluster.id}`);
        const cluster = await clusterStorage.findById('metadata');

        if (cluster.buckets.length === 0) {
            colors.printWarning('No buckets found in this cluster.');
            return;
        }

        // Load bucket details
        const bucketDetails = [];
        for (const bucketRef of cluster.buckets) {
            const bucketStorage = new StorageEngine(`bucket_${bucketRef.id}`);
            const bucket = await bucketStorage.findById('metadata');
            if (bucket) {
                bucketDetails.push(bucket);
            }
        }

        const tableData = bucketDetails.map(bucket => [
            bucket.id.length > 20 ? bucket.id.substring(0, 17) + '...' : bucket.id,
            bucket.name.length > 16 ? bucket.name.substring(0, 13) + '...' : bucket.name,
            bucket.statistics.totalFiles.toString(),
            this.formatFileSize(bucket.statistics.totalSize),
            new Date(bucket.createdAt).toISOString().split('T')[0]
        ]);

        colors.printTable(
            ['ID', 'Name', 'Files', 'Size', 'Created'],
            tableData
        );
    }

    static async useBucket(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: use bucket <id|name>');
        }

        const identifier = args[0];
        const clusterStorage = new StorageEngine(`cluster_${context.cluster.id}`);
        const cluster = await clusterStorage.findById('metadata');

        const bucketRef = cluster.buckets.find(bucket =>
            bucket.id === identifier || bucket.name === identifier
        );

        if (!bucketRef) {
            throw new Error(`Bucket '${identifier}' not found in cluster '${cluster.name}'`);
        }

        // Load bucket details
        const bucketStorage = new StorageEngine(`bucket_${bucketRef.id}`);
        const bucket = await bucketStorage.findById('metadata');

        if (!bucket) {
            throw new Error('Bucket data corrupted or not found');
        }

        if (!AuthorizationService.canAccessFile(user, bucket, 'read')) {
            throw new Error('Insufficient permissions to access bucket');
        }

        cli.setContext('bucket', bucket);
        cli.setContext('collection', null);
        cli.setContext('folder', null);
        cli.setContext('mode', 'file');

        colors.printSuccess(`Using bucket: ${bucket.name}`);
    }

    static async currentBucket(args, cli) {
        const bucket = cli.getContext().bucket;
        if (!bucket) {
            colors.printWarning('No bucket selected.');
            return;
        }

        console.log(colors.info('Current Bucket:'));
        console.log(`  ID: ${bucket.id}`);
        console.log(`  Name: ${bucket.name}`);
        console.log(`  Cluster: ${bucket.clusterId}`);
        console.log(`  Database: ${bucket.databaseId}`);
        console.log(`  Created: ${new Date(bucket.createdAt).toLocaleString()}`);
        console.log(`  Files: ${bucket.statistics.totalFiles}`);
        console.log(`  Size: ${this.formatFileSize(bucket.statistics.totalSize)}`);
        console.log(`  Folders: ${bucket.folders.length}`);
    }

    static async createFolder(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.bucket) {
            throw new Error('No database, cluster, or bucket selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: create folder <name>');
        }

        const name = args[0];
        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        // Check if folder already exists
        if (bucket.folders.some(folder => folder.name === name)) {
            throw new Error(`Folder '${name}' already exists in this bucket`);
        }

        const folderId = EncryptionService.generateId('folder');
        const folder = {
            id: folderId,
            name,
            bucketId: context.bucket.id,
            path: `/${name}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            files: [],
            statistics: {
                files: 0,
                size: 0
            }
        };

        // Add folder to bucket
        bucket.folders.push({
            id: folderId,
            name,
            path: folder.path,
            createdAt: folder.createdAt
        });
        bucket.updatedAt = new Date();
        bucket.statistics.folders = bucket.folders.length;

        await bucketStorage.save('metadata', bucket);

        // Create folder storage
        const folderStorage = new StorageEngine(`folder_${folderId}`);
        await folderStorage.save('metadata', folder);

        colors.printSuccess(`Folder '${name}' created successfully with ID: ${folderId}`);
    }

    static async useFolder(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.bucket) {
            throw new Error('No database, cluster, or bucket selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: use folder <id|name>');
        }

        const identifier = args[0];
        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        const folderRef = bucket.folders.find(folder =>
            folder.id === identifier || folder.name === identifier
        );

        if (!folderRef) {
            throw new Error(`Folder '${identifier}' not found in bucket '${bucket.name}'`);
        }

        // Load folder details
        const folderStorage = new StorageEngine(`folder_${folderRef.id}`);
        const folder = await folderStorage.findById('metadata');

        if (!folder) {
            throw new Error('Folder data corrupted or not found');
        }

        cli.setContext('folder', folder);
        colors.printSuccess(`Using folder: ${folder.name}`);
    }

    static async switchJson(args, cli) {
        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected.');
        }

        cli.setContext('mode', 'json');
        cli.setContext('bucket', null);
        cli.setContext('folder', null);

        colors.printSuccess('Switched to JSON object storage mode');
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';

        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // File operations would be implemented here
    static async insertFile(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.bucket) {
            throw new Error('No database, cluster, or bucket selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: insert file <local_file_path>');
        }

        const filePath = args[0];

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        const stats = fs.statSync(filePath);
        if (!stats.isFile()) {
            throw new Error('Path is not a file');
        }

        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        const fileId = EncryptionService.generateId('file');
        const fileName = path.basename(filePath);

        // Read file data
        const fileData = fs.readFileSync(filePath);

        // Create file record
        const fileRecord = {
            id: fileId,
            name: fileName,
            originalName: fileName,
            size: stats.size,
            mimeType: this.getMimeType(fileName),
            uploadedAt: new Date(),
            updatedAt: new Date(),
            uploadedBy: user.userId,
            bucketId: context.bucket.id,
            folderId: context.folder?.id || null,
            metadata: {
                originalPath: filePath,
                lastModified: stats.mtime
            },
            // In a real implementation, you would store the encrypted file data
            // For this example, we'll just store the metadata
            chunks: [`chunk_${fileId}_1`]
        };

        // Add file to bucket
        bucket.files.push({
            id: fileId,
            name: fileName,
            size: stats.size,
            uploadedAt: fileRecord.uploadedAt
        });

        if (context.folder) {
            // Add file to folder
            const folderStorage = new StorageEngine(`folder_${context.folder.id}`);
            const folder = await folderStorage.findById('metadata');
            folder.files.push({
                id: fileId,
                name: fileName,
                size: stats.size,
                uploadedAt: fileRecord.uploadedAt
            });
            folder.statistics.files += 1;
            folder.statistics.size += stats.size;
            folder.updatedAt = new Date();
            await folderStorage.save('metadata', folder);
        }

        // Update bucket statistics
        bucket.statistics.totalFiles += 1;
        bucket.statistics.totalSize += stats.size;
        bucket.updatedAt = new Date();

        await bucketStorage.save('metadata', bucket);

        // Save file metadata
        const fileStorage = new StorageEngine(`file_${fileId}`);
        await fileStorage.save('metadata', fileRecord);

        colors.printSuccess(`File '${fileName}' uploaded successfully with ID: ${fileId}`);
        console.log(colors.muted(`Size: ${this.formatFileSize(stats.size)}`));
    }

    static getMimeType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.txt': 'text/plain',
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.pdf': 'application/pdf',
            '.zip': 'application/zip'
        };

        return mimeTypes[ext] || 'application/octet-stream';
    }

    static async listData(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        if (bucket.files.length === 0) {
            colors.printWarning('No files found in this bucket.');
            return;
        }

        const tableData = bucket.files.map(file => [
            file.id.length > 20 ? file.id.substring(0, 17) + '...' : file.id,
            file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name,
            this.formatFileSize(file.size),
            new Date(file.uploadedAt).toISOString().split('T')[0],
            this.getMimeType(file.name)
        ]);

        colors.printTable(
            ['ID', 'Name', 'Size', 'Uploaded', 'Type'],
            tableData
        );

        console.log(colors.muted(`Total: ${bucket.files.length} files, ${this.formatFileSize(bucket.statistics.totalSize)}`));
    }

    static async editBucket(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected.');
        }

        if (args.length < 2) {
            throw new Error('Usage: edit bucket <id|name> [name:new_name]');
        }

        const identifier = args[0];
        const updates = {};

        for (let i = 1; i < args.length; i++) {
            const [key, value] = args[i].split(':');
            if (key && value) {
                updates[key] = value;
            }
        }

        if (Object.keys(updates).length === 0) {
            throw new Error('No valid updates provided');
        }

        const clusterStorage = new StorageEngine(`cluster_${context.cluster.id}`);
        const cluster = await clusterStorage.findById('metadata');

        const bucketRef = cluster.buckets.find(bucket =>
            bucket.id === identifier || bucket.name === identifier
        );

        if (!bucketRef) {
            throw new Error(`Bucket '${identifier}' not found`);
        }

        // Update bucket metadata
        const bucketStorage = new StorageEngine(`bucket_${bucketRef.id}`);
        const bucket = await bucketStorage.findById('metadata');

        if (!bucket) {
            throw new Error('Bucket data not found');
        }

        const updatedBucket = { ...bucket, ...updates, updatedAt: new Date() };
        await bucketStorage.save('metadata', updatedBucket);

        // Update cluster bucket reference if name changed
        if (updates.name && bucketRef.name !== updates.name) {
            bucketRef.name = updates.name;
            cluster.updatedAt = new Date();
            await clusterStorage.save('metadata', cluster);
        }

        // Update context if current bucket was edited
        if (context.bucket && context.bucket.id === bucket.id) {
            cli.setContext('bucket', updatedBucket);
        }

        colors.printSuccess(`Bucket '${bucket.name}' updated successfully`);
    }

    static async deleteBucket(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster) {
            throw new Error('No database or cluster selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: delete bucket <id|name>');
        }

        const identifier = args[0];
        const confirm = args.includes('-y');

        const clusterStorage = new StorageEngine(`cluster_${context.cluster.id}`);
        const cluster = await clusterStorage.findById('metadata');

        const bucketIndex = cluster.buckets.findIndex(bucket =>
            bucket.id === identifier || bucket.name === identifier
        );

        if (bucketIndex === -1) {
            throw new Error(`Bucket '${identifier}' not found`);
        }

        const bucketRef = cluster.buckets[bucketIndex];

        if (!confirm) {
            return new Promise((resolve) => {
                cli.rl.question(colors.warning(`Are you sure you want to delete bucket '${bucketRef.name}' and all its files? (y/N): `), (answer) => {
                    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
                        this.performDeleteBucket(bucketRef, cluster, clusterStorage, bucketIndex, cli);
                    }
                    resolve();
                });
            });
        } else {
            await this.performDeleteBucket(bucketRef, cluster, clusterStorage, bucketIndex, cli);
        }
    }

    static async performDeleteBucket(bucketRef, cluster, clusterStorage, bucketIndex, cli) {
        // Remove bucket from cluster
        cluster.buckets.splice(bucketIndex, 1);
        cluster.statistics.buckets = cluster.buckets.length;
        cluster.updatedAt = new Date();
        await clusterStorage.save('metadata', cluster);

        // Note: In real implementation, delete all bucket data files

        colors.printSuccess(`Bucket '${bucketRef.name}' deleted successfully`);

        // Clear context if deleted bucket was current
        const context = cli.getContext();
        if (context.bucket && context.bucket.id === bucketRef.id) {
            cli.setContext('bucket', null);
            cli.setContext('folder', null);
        }
    }
    // Add these methods to the BucketCommands class

    static async insertFiles(args, cli) {
        const user = cli.getUser();
        if (!user) {
            throw new Error('Please login first');
        }

        const context = cli.getContext();
        if (!context.database || !context.cluster || !context.bucket) {
            throw new Error('No database, cluster, or bucket selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: insert files <local_file_path1> <local_file_path2> ...');
        }

        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        const uploadedFiles = [];
        const errors = [];

        for (const filePath of args) {
            try {
                // Check if file exists
                if (!fs.existsSync(filePath)) {
                    errors.push(`File not found: ${filePath}`);
                    continue;
                }

                const stats = fs.statSync(filePath);
                if (!stats.isFile()) {
                    errors.push(`Path is not a file: ${filePath}`);
                    continue;
                }

                const fileId = EncryptionService.generateId('file');
                const fileName = path.basename(filePath);

                // Read file data
                const fileData = fs.readFileSync(filePath);

                // Create file record
                const fileRecord = {
                    id: fileId,
                    name: fileName,
                    originalName: fileName,
                    size: stats.size,
                    mimeType: this.getMimeType(fileName),
                    uploadedAt: new Date(),
                    updatedAt: new Date(),
                    uploadedBy: user.userId,
                    bucketId: context.bucket.id,
                    folderId: context.folder?.id || null,
                    metadata: {
                        originalPath: filePath,
                        lastModified: stats.mtime,
                        checksum: this.calculateChecksum(fileData)
                    },
                    chunks: [`chunk_${fileId}_1`]
                };

                // Add file to bucket
                bucket.files.push({
                    id: fileId,
                    name: fileName,
                    size: stats.size,
                    uploadedAt: fileRecord.uploadedAt
                });

                if (context.folder) {
                    // Add file to folder
                    const folderStorage = new StorageEngine(`folder_${context.folder.id}`);
                    const folder = await folderStorage.findById('metadata');
                    folder.files.push({
                        id: fileId,
                        name: fileName,
                        size: stats.size,
                        uploadedAt: fileRecord.uploadedAt
                    });
                    folder.statistics.files += 1;
                    folder.statistics.size += stats.size;
                    folder.updatedAt = new Date();
                    await folderStorage.save('metadata', folder);
                }

                // Save file metadata
                const fileStorage = new StorageEngine(`file_${fileId}`);
                await fileStorage.save('metadata', fileRecord);

                uploadedFiles.push({
                    id: fileId,
                    name: fileName,
                    size: stats.size
                });

            } catch (error) {
                errors.push(`Failed to upload ${filePath}: ${error.message}`);
            }
        }

        // Update bucket statistics
        const totalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
        bucket.statistics.totalFiles += uploadedFiles.length;
        bucket.statistics.totalSize += totalSize;
        bucket.updatedAt = new Date();

        await bucketStorage.save('metadata', bucket);

        if (uploadedFiles.length > 0) {
            colors.printSuccess(`${uploadedFiles.length} files uploaded successfully`);
            uploadedFiles.forEach(file => {
                console.log(colors.muted(`  - ${file.name} (${this.formatFileSize(file.size)})`));
            });
        }

        if (errors.length > 0) {
            colors.printWarning(`${errors.length} errors occurred:`);
            errors.forEach(error => colors.printWarning(`  - ${error}`));
        }
    }

    static async listFiles(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        // Parse command line options
        let fileType = null;
        let sizeFilter = null;

        for (let i = 0; i < args.length; i++) {
            if (args[i] === '--type' && i + 1 < args.length) {
                fileType = args[i + 1].toLowerCase();
                i++;
            } else if (args[i] === '--size' && i + 1 < args.length) {
                sizeFilter = args[i + 1].toLowerCase();
                i++;
            }
        }

        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        let files = bucket.files;

        // Apply filters
        if (fileType) {
            files = files.filter(file =>
                this.getMimeType(file.name).includes(fileType) ||
                path.extname(file.name).toLowerCase().includes(fileType.replace('.', ''))
            );
        }

        if (sizeFilter) {
            files = files.filter(file => this.matchesSizeFilter(file.size, sizeFilter));
        }

        if (files.length === 0) {
            colors.printWarning('No files found matching the criteria.');
            return;
        }

        const tableData = files.map(file => [
            file.id.length > 20 ? file.id.substring(0, 17) + '...' : file.id,
            file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name,
            this.formatFileSize(file.size),
            new Date(file.uploadedAt).toISOString().split('T')[0],
            this.getMimeType(file.name)
        ]);

        colors.printTable(
            ['ID', 'Name', 'Size', 'Uploaded', 'Type'],
            tableData
        );

        console.log(colors.muted(`Total: ${files.length} files`));
    }

    static matchesSizeFilter(fileSize, sizeFilter) {
        if (sizeFilter.endsWith('+')) {
            const minSize = this.parseSize(sizeFilter.slice(0, -1));
            return fileSize >= minSize;
        } else if (sizeFilter.startsWith('-')) {
            const maxSize = this.parseSize(sizeFilter.slice(1));
            return fileSize <= maxSize;
        } else {
            const targetSize = this.parseSize(sizeFilter);
            // Allow 10% tolerance for exact size matches
            return Math.abs(fileSize - targetSize) <= targetSize * 0.1;
        }
    }

    static parseSize(sizeStr) {
        const units = {
            'b': 1,
            'kb': 1024,
            'mb': 1024 * 1024,
            'gb': 1024 * 1024 * 1024,
            'tb': 1024 * 1024 * 1024 * 1024
        };

        const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*([kmgt]?b?)$/);
        if (!match) return 0;

        const value = parseFloat(match[1]);
        const unit = match[2] || 'b';

        return value * (units[unit] || 1);
    }

    static async find(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        let query = {};
        if (args.length > 0) {
            try {
                query = JSON.parse(args.join(' '));
            } catch (error) {
                throw new Error('Invalid query format. Please provide valid JSON.');
            }
        }

        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        const results = bucket.files.filter(file => {
            for (const [key, value] of Object.entries(query)) {
                if (key === 'name' && !file.name.includes(value)) {
                    return false;
                }
                if (key === 'type' && !this.getMimeType(file.name).includes(value)) {
                    return false;
                }
                if (key === 'size' && file.size !== value) {
                    return false;
                }
            }
            return true;
        });

        console.log(colors.info(`Found ${results.length} files:`));

        if (results.length > 0) {
            const tableData = results.map(file => [
                file.id,
                file.name,
                this.formatFileSize(file.size),
                this.getMimeType(file.name)
            ]);

            colors.printTable(
                ['ID', 'Name', 'Size', 'Type'],
                tableData
            );
        }

        return results;
    }

    static async findOne(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: findone <query_json>');
        }

        let query;
        try {
            query = JSON.parse(args.join(' '));
        } catch (error) {
            throw new Error('Invalid query format. Please provide valid JSON.');
        }

        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        const result = bucket.files.find(file => {
            for (const [key, value] of Object.entries(query)) {
                if (key === 'name' && !file.name.includes(value)) {
                    return false;
                }
                if (key === 'type' && !this.getMimeType(file.name).includes(value)) {
                    return false;
                }
                if (key === 'size' && file.size !== value) {
                    return false;
                }
            }
            return true;
        });

        if (result) {
            console.log(colors.info('Found file:'));
            console.log(`  ID: ${result.id}`);
            console.log(`  Name: ${result.name}`);
            console.log(`  Size: ${this.formatFileSize(result.size)}`);
            console.log(`  Type: ${this.getMimeType(result.name)}`);
            console.log(`  Uploaded: ${new Date(result.uploadedAt).toLocaleString()}`);
        } else {
            colors.printWarning('No file found matching the query.');
        }

        return result;
    }

    static async signedUrl(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: signedurl <file_id> [expire_seconds]');
        }

        const fileId = args[0];
        const expireSeconds = args[1] ? parseInt(args[1]) : 3600; // Default 1 hour

        // In a real implementation, this would generate a signed URL
        // For this example, we'll simulate it
        const baseUrl = `http://localhost:7701/api/v1/files`;
        const token = EncryptionService.generateId('url');
        const expiresAt = new Date(Date.now() + expireSeconds * 1000);

        const signedUrl = `${baseUrl}/${fileId}?token=${token}&expires=${expiresAt.getTime()}`;

        console.log(colors.info('Signed URL generated:'));
        console.log(`  URL: ${signedUrl}`);
        console.log(`  Expires: ${expiresAt.toLocaleString()}`);
        console.log(`  Valid for: ${expireSeconds} seconds`);

        return signedUrl;
    }

    static async preview(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: preview <file_id>');
        }

        const fileId = args[0];
        const fileStorage = new StorageEngine(`file_${fileId}`);
        const file = await fileStorage.findById('metadata');

        if (!file) {
            throw new Error(`File with ID '${fileId}' not found`);
        }

        // Check if file is text-based and can be previewed
        const textTypes = [
            'text/plain', 'text/html', 'text/css', 'application/javascript',
            'application/json', 'application/xml'
        ];

        if (!textTypes.some(type => file.mimeType.includes(type))) {
            colors.printWarning(`Preview not available for ${file.mimeType} files.`);
            console.log(colors.info('Use "get file" to download the file.'));
            return;
        }

        console.log(colors.info(`Preview of ${file.name}:`));
        console.log(colors.muted('='.repeat(50)));

        // In a real implementation, you would read the actual file content
        // For this example, we'll show metadata
        console.log(`File: ${file.name}`);
        console.log(`Size: ${this.formatFileSize(file.size)}`);
        console.log(`Type: ${file.mimeType}`);
        console.log(`Uploaded: ${new Date(file.uploadedAt).toLocaleString()}`);
        console.log(`Uploaded by: ${file.uploadedBy}`);

        if (file.metadata) {
            console.log('Metadata:');
            Object.entries(file.metadata).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
        }

        console.log(colors.muted('='.repeat(50)));
        console.log(colors.info('(File content would be displayed here in real implementation)'));
    }

    static async getFile(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        if (args.length < 2) {
            throw new Error('Usage: get file <file_id> <local_path>');
        }

        const fileId = args[0];
        const localPath = args[1];

        const fileStorage = new StorageEngine(`file_${fileId}`);
        const file = await fileStorage.findById('metadata');

        if (!file) {
            throw new Error(`File with ID '${fileId}' not found`);
        }

        // Check if local directory exists
        const dir = path.dirname(localPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // In a real implementation, you would decrypt and write the actual file data
        // For this example, we'll create a placeholder file with metadata
        const fileInfo = {
            originalName: file.name,
            fileId: file.id,
            size: file.size,
            mimeType: file.mimeType,
            uploadedAt: file.uploadedAt,
            downloadedAt: new Date().toISOString()
        };

        const content = `This is a placeholder for file: ${file.name}\n\nMetadata:\n${JSON.stringify(fileInfo, null, 2)}`;

        try {
            fs.writeFileSync(localPath, content);
            colors.printSuccess(`File downloaded successfully to: ${localPath}`);
            console.log(colors.muted(`Size: ${this.formatFileSize(file.size)}`));
            console.log(colors.muted(`Type: ${file.mimeType}`));
        } catch (error) {
            throw new Error(`Failed to write file: ${error.message}`);
        }
    }

    static async getFiles(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        if (args.length < 1) {
            throw new Error('Usage: get files <(file_id1, path1)> <(file_id2, path2)> ...');
        }

        const downloads = [];

        // Parse download pairs
        for (const arg of args) {
            const match = arg.match(/\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                downloads.push({
                    fileId: match[1].trim(),
                    localPath: match[2].trim()
                });
            }
        }

        if (downloads.length === 0) {
            throw new Error('Invalid format. Use: (file_id, local_path) pairs');
        }

        const results = {
            successful: [],
            failed: []
        };

        for (const download of downloads) {
            try {
                await this.getFile([download.fileId, download.localPath], cli);
                results.successful.push(download);
            } catch (error) {
                results.failed.push({
                    ...download,
                    error: error.message
                });
            }
        }

        if (results.successful.length > 0) {
            colors.printSuccess(`${results.successful.length} files downloaded successfully`);
        }

        if (results.failed.length > 0) {
            colors.printWarning(`${results.failed.length} downloads failed:`);
            results.failed.forEach(failed => {
                colors.printWarning(`  - ${failed.fileId}: ${failed.error}`);
            });
        }
    }

    static async listStatistics(args, cli) {
        const context = cli.getContext();
        if (!context.bucket) {
            throw new Error('No bucket selected.');
        }

        const bucketStorage = new StorageEngine(`bucket_${context.bucket.id}`);
        const bucket = await bucketStorage.findById('metadata');

        console.log(colors.info(`Statistics for bucket: ${bucket.name}`));
        console.log(colors.muted('='.repeat(40)));

        console.log(`Total Files: ${bucket.statistics.totalFiles}`);
        console.log(`Total Size: ${this.formatFileSize(bucket.statistics.totalSize)}`);
        console.log(`Folders: ${bucket.folders.length}`);
        console.log(`Created: ${new Date(bucket.createdAt).toLocaleString()}`);
        console.log(`Last Updated: ${new Date(bucket.updatedAt).toLocaleString()}`);

        // File type breakdown
        const typeStats = {};
        bucket.files.forEach(file => {
            const type = this.getMimeType(file.name);
            typeStats[type] = (typeStats[type] || 0) + 1;
        });

        console.log('\nFile Types:');
        Object.entries(typeStats).forEach(([type, count]) => {
            console.log(`  ${type}: ${count} files`);
        });

        // Size distribution
        const sizeRanges = {
            '0-1MB': 0,
            '1-10MB': 0,
            '10-100MB': 0,
            '100MB+': 0
        };

        bucket.files.forEach(file => {
            if (file.size < 1024 * 1024) sizeRanges['0-1MB']++;
            else if (file.size < 10 * 1024 * 1024) sizeRanges['1-10MB']++;
            else if (file.size < 100 * 1024 * 1024) sizeRanges['10-100MB']++;
            else sizeRanges['100MB+']++;
        });

        console.log('\nSize Distribution:');
        Object.entries(sizeRanges).forEach(([range, count]) => {
            if (count > 0) {
                console.log(`  ${range}: ${count} files`);
            }
        });
    }

    static calculateChecksum(data) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(data).digest('hex');
    }
}

// Command metadata
// Bucket
BucketCommands.createBucket.help = 'Create a new bucket: create bucket <name>';
BucketCommands.listBucket.help = 'List all buckets in current cluster: list bucket';
BucketCommands.useBucket.help = 'Switch to a bucket: use bucket <id|name>';
BucketCommands.currentBucket.help = 'Show current bucket: current bucket';
BucketCommands.editBucket.help = 'Edit bucket: edit bucket <id|name> [name:new_name]';
BucketCommands.deleteBucket.help = 'Delete bucket: delete bucket <id|name> [-y]';
BucketCommands.listStatistics.help = 'Show bucket statistics: list statistics';

// Folder
BucketCommands.createFolder.help = 'Create a new folder: create folder <name>';
BucketCommands.useFolder.help = 'Switch to a folder: use folder <id|name>';

// File
BucketCommands.insertFile.help = 'Upload a file: insert file <local_file_path>';
BucketCommands.insertFiles.help = 'Upload multiple files: insert files <file_path1> <file_path2> ...';
BucketCommands.listData.help = 'List files in current bucket/folder: list data';
BucketCommands.listFiles.help = 'List files with filters: list files [--type <type>] [--size <size_filter>]';
BucketCommands.find.help = 'Find files by metadata: find [query_json]';
BucketCommands.findOne.help = 'Find one file by metadata: findone <query_json>';
BucketCommands.signedUrl.help = 'Generate signed URL: signedurl <file_id> [expire_seconds]';
BucketCommands.preview.help = 'Preview file content: preview <file_id>';
BucketCommands.getFile.help = 'Download file: get file <file_id> <local_path>';
BucketCommands.getFiles.help = 'Download multiple files: get files <(file_id1, path1)> <(file_id2, path2)> ...';

// Switch to JSON system
BucketCommands.switchJson.help = 'Switch to JSON storage mode: switch json';

module.exports = BucketCommands;