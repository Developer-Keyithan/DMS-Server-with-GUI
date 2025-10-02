const express = require('express');
const router = express.Router();
const AuthenticationService = require('../../auth/authentication');
const authMiddleware = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        
        if (!name || !email || !password) {
            return res.status(400).json({
                error: 'Name, email, and password are required'
            });
        }

        const token = await AuthenticationService.register(name, email, password);
        
        res.json({
            success: true,
            message: 'User registered successfully',
            token
        });
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required'
            });
        }

        const token = await AuthenticationService.login(email, password);
        
        res.json({
            success: true,
            message: 'Login successful',
            token
        });
    } catch (error) {
        res.status(401).json({
            error: error.message
        });
    }
});

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await AuthenticationService.getUser(req.user.userId);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Remove sensitive information
        const { passwordHash, passwordSalt, ...userInfo } = user;
        
        res.json({
            success: true,
            user: userInfo
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Change password
router.put('/password', authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                error: 'Current password and new password are required'
            });
        }

        await AuthenticationService.changePassword(
            req.user.userId, 
            currentPassword, 
            newPassword
        );
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

module.exports = router;