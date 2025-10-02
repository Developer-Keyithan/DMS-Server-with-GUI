const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const StorageEngine = require('../../core/storage-engine');
const AuthorizationService = require('../../auth/authorization');

// Get file metadata
router.get('/:fileId', authMiddleware, async (req, res) => {
    try {
        const { fileId } = req.params;
        const fileStorage = new StorageEngine(`file_${fileId}`);
        const file = await fileStorage.findById('metadata');
        
        if (!file) {
            return res.status(404).json({
                error: 'File not found'
            });
        }

        // Check permissions (simplified)
        const bucketStorage = new StorageEngine(`bucket_${file.bucketId}`);
        const bucket = await bucketStorage.findById('metadata');
        
        if (!AuthorizationService.canAccessFile(req.user, bucket, 'read')) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        res.json({
            success: true,
            data: file
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Generate signed URL
router.post('/:fileId/signed-url', authMiddleware, async (req, res) => {
    try {
        const { fileId } = req.params;
        const { expiresIn = 3600 } = req.body;
        
        const fileStorage = new StorageEngine(`file_${fileId}`);
        const file = await fileStorage.findById('metadata');
        
        if (!file) {
            return res.status(404).json({
                error: 'File not found'
            });
        }

        // Generate signed URL (simplified)
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { 
                fileId, 
                action: 'download',
                expiresAt: Date.now() + expiresIn * 1000 
            },
            process.env.JWT_SECRET || 'hexabase-default-secret',
            { expiresIn }
        );

        const signedUrl = `/api/v1/files/${fileId}/download?token=${token}`;

        res.json({
            success: true,
            data: {
                signedUrl,
                expiresIn,
                expiresAt: new Date(Date.now() + expiresIn * 1000)
            }
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Download file
router.get('/:fileId/download', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { token } = req.query;
        
        if (!token) {
            return res.status(401).json({
                error: 'Download token required'
            });
        }

        // Verify token
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'hexabase-default-secret');
        
        if (decoded.fileId !== fileId) {
            return res.status(403).json({
                error: 'Invalid token'
            });
        }

        const fileStorage = new StorageEngine(`file_${fileId}`);
        const file = await fileStorage.findById('metadata');
        
        if (!file) {
            return res.status(404).json({
                error: 'File not found'
            });
        }

        // In real implementation, stream the actual file
        // For now, return metadata
        res.json({
            success: true,
            data: {
                ...file,
                downloadUrl: `placeholder-download-url-for-${fileId}`
            }
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

module.exports = router;