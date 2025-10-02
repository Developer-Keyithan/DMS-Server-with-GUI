const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const StorageEngine = require('../../core/storage-engine');
const AuthorizationService = require('../../auth/authorization');

// Get all databases for user
router.get('/', authMiddleware, async (req, res) => {
    try {
        const dbStorage = new StorageEngine('databases');
        const databases = await dbStorage.findAll();
        
        const userDatabases = databases.filter(db => 
            AuthorizationService.canAccessDatabase(req.user, db, 'read')
        );

        res.json({
            success: true,
            data: userDatabases,
            count: userDatabases.length
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Get specific database
router.get('/:dbId', authMiddleware, async (req, res) => {
    try {
        const { dbId } = req.params;
        const dbStorage = new StorageEngine('databases');
        const database = await dbStorage.findById(dbId);
        
        if (!database) {
            return res.status(404).json({
                error: 'Database not found'
            });
        }

        if (!AuthorizationService.canAccessDatabase(req.user, database, 'read')) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        res.json({
            success: true,
            data: database
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Create new database
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({
                error: 'Database name is required'
            });
        }

        if (!AuthorizationService.hasPermission(req.user.role, 'db.create')) {
            return res.status(403).json({
                error: 'Insufficient permissions to create database'
            });
        }

        const dbStorage = new StorageEngine('databases');
        
        // Check if database already exists
        const existing = await dbStorage.find({ name });
        if (existing.length > 0) {
            return res.status(400).json({
                error: `Database '${name}' already exists`
            });
        }

        const EncryptionService = require('../../core/encryption');
        const databaseId = EncryptionService.generateId('db');
        const database = {
            id: databaseId,
            name,
            ownerId: req.user.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            permissions: {
                [req.user.userId]: ['admin']
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

        res.status(201).json({
            success: true,
            message: 'Database created successfully',
            data: database
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Update database
router.put('/:dbId', authMiddleware, async (req, res) => {
    try {
        const { dbId } = req.params;
        const updates = req.body;
        
        const dbStorage = new StorageEngine('databases');
        const database = await dbStorage.findById(dbId);
        
        if (!database) {
            return res.status(404).json({
                error: 'Database not found'
            });
        }

        if (!AuthorizationService.canAccessDatabase(req.user, database, 'admin')) {
            return res.status(403).json({
                error: 'Insufficient permissions to update database'
            });
        }

        const updatedDatabase = { 
            ...database, 
            ...updates, 
            updatedAt: new Date() 
        };
        
        await dbStorage.save(dbId, updatedDatabase);

        res.json({
            success: true,
            message: 'Database updated successfully',
            data: updatedDatabase
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Delete database
router.delete('/:dbId', authMiddleware, async (req, res) => {
    try {
        const { dbId } = req.params;
        
        const dbStorage = new StorageEngine('databases');
        const database = await dbStorage.findById(dbId);
        
        if (!database) {
            return res.status(404).json({
                error: 'Database not found'
            });
        }

        if (!AuthorizationService.canAccessDatabase(req.user, database, 'delete')) {
            return res.status(403).json({
                error: 'Insufficient permissions to delete database'
            });
        }

        await dbStorage.delete(dbId);

        res.json({
            success: true,
            message: 'Database deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Get database clusters
router.get('/:dbId/clusters', authMiddleware, async (req, res) => {
    try {
        const { dbId } = req.params;
        const dbStorage = new StorageEngine('databases');
        const database = await dbStorage.findById(dbId);
        
        if (!database) {
            return res.status(404).json({
                error: 'Database not found'
            });
        }

        if (!AuthorizationService.canAccessDatabase(req.user, database, 'read')) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        // Load cluster details
        const clusterDetails = [];
        for (const clusterRef of database.clusters) {
            const clusterStorage = new StorageEngine(`cluster_${clusterRef.id}`);
            const cluster = await clusterStorage.findById('metadata');
            if (cluster) {
                clusterDetails.push(cluster);
            }
        }

        res.json({
            success: true,
            data: clusterDetails,
            count: clusterDetails.length
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;