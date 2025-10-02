const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');
const StorageEngine = require('../../core/storage-engine');
const AuthorizationService = require('../../auth/authorization');
const Collection = require('../../models/collection');

// Get all collections in a cluster
router.get('/cluster/:clusterId', authMiddleware, async (req, res) => {
    try {
        const { clusterId } = req.params;
        
        const clusterStorage = new StorageEngine(`cluster_${clusterId}`);
        const cluster = await clusterStorage.findById('metadata');
        
        if (!cluster) {
            return res.status(404).json({
                error: 'Cluster not found'
            });
        }

        if (!AuthorizationService.canAccessDatabase(req.user, { id: cluster.databaseId }, 'read')) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        // Load collection details
        const collectionDetails = [];
        for (const collRef of cluster.collections) {
            const collectionStorage = new StorageEngine(`collection_${collRef.id}`);
            const collection = await collectionStorage.findById('metadata');
            if (collection) {
                collectionDetails.push(collection);
            }
        }

        res.json({
            success: true,
            data: collectionDetails,
            count: collectionDetails.length
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Get specific collection
router.get('/:collectionId', authMiddleware, async (req, res) => {
    try {
        const { collectionId } = req.params;
        
        const collectionStorage = new StorageEngine(`collection_${collectionId}`);
        const collection = await collectionStorage.findById('metadata');
        
        if (!collection) {
            return res.status(404).json({
                error: 'Collection not found'
            });
        }

        // Check permissions via cluster
        const clusterStorage = new StorageEngine(`cluster_${collection.clusterId}`);
        const cluster = await clusterStorage.findById('metadata');
        
        if (!AuthorizationService.canAccessDatabase(req.user, { id: cluster.databaseId }, 'read')) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        res.json({
            success: true,
            data: collection
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Create new collection
router.post('/cluster/:clusterId', authMiddleware, validationMiddleware.validateCollection, async (req, res) => {
    try {
        const { clusterId } = req.params;
        const { name, schema } = req.body;
        
        if (!name) {
            return res.status(400).json({
                error: 'Collection name is required'
            });
        }

        const clusterStorage = new StorageEngine(`cluster_${clusterId}`);
        const cluster = await clusterStorage.findById('metadata');
        
        if (!cluster) {
            return res.status(404).json({
                error: 'Cluster not found'
            });
        }

        if (!AuthorizationService.canAccessDatabase(req.user, { id: cluster.databaseId }, 'write')) {
            return res.status(403).json({
                error: 'Insufficient permissions to create collection'
            });
        }

        // Check if collection already exists
        if (cluster.collections.some(coll => coll.name === name)) {
            return res.status(400).json({
                error: `Collection '${name}' already exists in this cluster`
            });
        }

        const EncryptionService = require('../../core/encryption');
        const collectionId = EncryptionService.generateId('coll');
        
        const collection = new Collection(collectionId, name, clusterId, cluster.databaseId);
        if (schema) {
            collection.schema = schema;
        }

        // Add collection to cluster
        cluster.collections.push({
            id: collectionId,
            name,
            createdAt: collection.createdAt
        });
        cluster.updatedAt = new Date();
        cluster.statistics.collections = cluster.collections.length;
        
        await clusterStorage.save('metadata', cluster);
        
        // Create collection storage
        const collectionStorage = new StorageEngine(`collection_${collectionId}`);
        await collectionStorage.save('metadata', collection.toJSON());

        res.status(201).json({
            success: true,
            message: 'Collection created successfully',
            data: collection
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Update collection
router.put('/:collectionId', authMiddleware, validationMiddleware.validateCollection, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const updates = req.body;
        
        const collectionStorage = new StorageEngine(`collection_${collectionId}`);
        const collectionData = await collectionStorage.findById('metadata');
        
        if (!collectionData) {
            return res.status(404).json({
                error: 'Collection not found'
            });
        }

        const collection = Collection.fromJSON(collectionData);

        // Check permissions via cluster
        const clusterStorage = new StorageEngine(`cluster_${collection.clusterId}`);
        const cluster = await clusterStorage.findById('metadata');
        
        if (!AuthorizationService.canAccessDatabase(req.user, { id: cluster.databaseId }, 'write')) {
            return res.status(403).json({
                error: 'Insufficient permissions to update collection'
            });
        }

        // Apply updates
        if (updates.name) collection.name = updates.name;
        if (updates.schema) collection.schema = updates.schema;
        
        collection.updatedAt = new Date();
        
        await collectionStorage.save('metadata', collection.toJSON());

        // Update cluster reference if name changed
        if (updates.name) {
            const collectionRef = cluster.collections.find(c => c.id === collectionId);
            if (collectionRef) {
                collectionRef.name = updates.name;
                cluster.updatedAt = new Date();
                await clusterStorage.save('metadata', cluster);
            }
        }

        res.json({
            success: true,
            message: 'Collection updated successfully',
            data: collection
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Delete collection
router.delete('/:collectionId', authMiddleware, async (req, res) => {
    try {
        const { collectionId } = req.params;
        
        const collectionStorage = new StorageEngine(`collection_${collectionId}`);
        const collectionData = await collectionStorage.findById('metadata');
        
        if (!collectionData) {
            return res.status(404).json({
                error: 'Collection not found'
            });
        }

        const collection = Collection.fromJSON(collectionData);

        // Check permissions via cluster
        const clusterStorage = new StorageEngine(`cluster_${collection.clusterId}`);
        const cluster = await clusterStorage.findById('metadata');
        
        if (!AuthorizationService.canAccessDatabase(req.user, { id: cluster.databaseId }, 'delete')) {
            return res.status(403).json({
                error: 'Insufficient permissions to delete collection'
            });
        }

        // Remove collection from cluster
        cluster.collections = cluster.collections.filter(c => c.id !== collectionId);
        cluster.statistics.collections = cluster.collections.length;
        cluster.updatedAt = new Date();
        
        await clusterStorage.save('metadata', cluster);

        // Note: In production, you would also delete all collection data files

        res.json({
            success: true,
            message: 'Collection deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Collection documents operations
router.get('/:collectionId/documents', authMiddleware, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const { query, limit = 50, skip = 0, sort } = req.query;
        
        const collectionStorage = new StorageEngine(`collection_${collectionId}`);
        const collectionData = await collectionStorage.findById('metadata');
        
        if (!collectionData) {
            return res.status(404).json({
                error: 'Collection not found'
            });
        }

        const collection = Collection.fromJSON(collectionData);

        // Check permissions
        const clusterStorage = new StorageEngine(`cluster_${collection.clusterId}`);
        const cluster = await clusterStorage.findById('metadata');
        
        if (!AuthorizationService.canAccessDatabase(req.user, { id: cluster.databaseId }, 'read')) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        // Load all documents (simplified - in production, use proper querying)
        const allData = await collectionStorage.loadAll();
        delete allData.metadata; // Remove metadata
        
        let documents = Object.values(allData);
        
        // Apply query filter if provided
        if (query) {
            const queryObj = JSON.parse(query);
            documents = documents.filter(doc => {
                for (const [key, value] of Object.entries(queryObj)) {
                    if (doc[key] !== value) return false;
                }
                return true;
            });
        }

        // Apply pagination
        const total = documents.length;
        const paginatedDocs = documents.slice(parseInt(skip), parseInt(skip) + parseInt(limit));

        res.json({
            success: true,
            data: paginatedDocs,
            pagination: {
                total,
                limit: parseInt(limit),
                skip: parseInt(skip),
                hasMore: parseInt(skip) + parseInt(limit) < total
            }
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Insert document
router.post('/:collectionId/documents', authMiddleware, async (req, res) => {
    try {
        const { collectionId } = req.params;
        const document = req.body;
        
        const collectionStorage = new StorageEngine(`collection_${collectionId}`);
        const collectionData = await collectionStorage.findById('metadata');
        
        if (!collectionData) {
            return res.status(404).json({
                error: 'Collection not found'
            });
        }

        const collection = Collection.fromJSON(collectionData);

        // Check permissions
        const clusterStorage = new StorageEngine(`cluster_${collection.clusterId}`);
        const cluster = await clusterStorage.findById('metadata');
        
        if (!AuthorizationService.canAccessDatabase(req.user, { id: cluster.databaseId }, 'write')) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        // Validate against schema if exists
        if (collection.schema) {
            const validationResult = collection.validateDocument(document);
            if (!validationResult.valid) {
                return res.status(400).json({
                    error: `Schema validation failed: ${validationResult.errors.join(', ')}`
                });
            }
        }

        const EncryptionService = require('../../core/encryption');
        const documentId = EncryptionService.generateId('doc');
        
        const documentWithMeta = {
            ...document,
            _id: documentId,
            _system: {
                createdAt: new Date(),
                updatedAt: new Date(),
                createdBy: req.user.userId,
                version: 1
            }
        };

        await collectionStorage.save(documentId, documentWithMeta);
        
        // Update collection statistics
        collection.documentCount += 1;
        collection.updatedAt = new Date();
        await collectionStorage.save('metadata', collection.toJSON());

        res.status(201).json({
            success: true,
            message: 'Document inserted successfully',
            data: documentWithMeta
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;