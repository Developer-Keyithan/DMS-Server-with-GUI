const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const StorageEngine = require('../../core/storage-engine');
const AuthorizationService = require('../../auth/authorization');

router.get('/', async (req, res) => {
    try {
        const wsClients = req.app.get('wsClients');
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        const activeConnections = wsClients?.size || 0;

        const totalDatabases = await DatabaseManager.getDatabaseCount();
        const totalCollections = await DatabaseManager.getCollectionCount();
        const totalBuckets = await DatabaseManager.getBucketCount();
        const totalUsers = await UserManager.getUserCount();

        res.json({
            status: 'running',
            uptime,
            memoryUsage,
            activeConnections,
            databases: totalDatabases,
            stats: {
                totalUsers,
                totalDatabases,
                totalCollections,
                totalBuckets
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: error.message });
    }
});

module.exports = router;
