const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const EncryptionService = require('../core/encryption');
const StorageEngine = require('../core/storage-engine');

class AuthenticationService {
    constructor() {
        this.jwtSecret = process.env.JWT_SECRET || 'hexabase-default-secret-change-in-production';
        this.tokenExpiry = '24h';
        this.userStorage = new StorageEngine('users');
        this.auditStorage = new StorageEngine('audit');
    }

    async register(name, email, password, role = 'viewer') {
        // Only allow one super admin
        if (role === 'superadmin') {
            const existingUsers = await this.userStorage.findAll();
            const superAdminExists = existingUsers.some(u => u.role === 'superadmin');
            if (superAdminExists) {
                throw new Error('Super admin already exists');
            }
        }

        // Check if user already exists
        const existingUsers = await this.userStorage.findAll();
        const userExists = existingUsers.some(user => user.email === email);

        if (userExists) {
            throw new Error('User already exists with this email');
        }

        // Hash password
        const { salt, hash } = EncryptionService.hashPassword(password);

        // Create user
        const userId = EncryptionService.generateId('user');
        const user = {
            id: userId,
            name,
            email,
            passwordSalt: salt,
            passwordHash: hash,
            role, // default 'viewer' if not specified
            createdAt: new Date(),
            updatedAt: new Date(),
            isActive: true,
            lastLogin: null
        };

        await this.userStorage.save(userId, user);

        // Log audit event
        await this.logAudit('USER_REGISTER', userId, { email, name, role });

        return this.generateToken(user);
    }


    async login(email, password) {
        const users = await this.userStorage.findAll();
        const user = users.find(u => u.email === email && u.isActive);

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = EncryptionService.verifyPassword(
            password,
            user.passwordSalt,
            user.passwordHash
        );

        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        user.lastLogin = new Date();
        await this.userStorage.save(user.id, user);

        // Log audit event
        await this.logAudit('USER_LOGIN', user.id, { email });

        return this.generateToken(user);
    }

    generateToken(user) {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            name: user.name
        };

        return jwt.sign(payload, this.jwtSecret, { expiresIn: this.tokenExpiry });
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, this.jwtSecret);
        } catch (error) {
            throw new Error('Invalid or expired token');
        }
    }

    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.userStorage.findById(userId);

        if (!user) {
            throw new Error('User not found');
        }

        const isValid = EncryptionService.verifyPassword(
            currentPassword,
            user.passwordSalt,
            user.passwordHash
        );

        if (!isValid) {
            throw new Error('Current password is incorrect');
        }

        const { salt, hash } = EncryptionService.hashPassword(newPassword);
        user.passwordSalt = salt;
        user.passwordHash = hash;
        user.updatedAt = new Date();

        await this.userStorage.save(userId, user);

        await this.logAudit('PASSWORD_CHANGE', userId, {});

        return true;
    }

    async logAudit(action, userId, metadata) {
        const auditId = EncryptionService.generateId('audit');
        const auditLog = {
            id: auditId,
            action,
            userId,
            timestamp: new Date(),
            ipAddress: '127.0.0.1', // In real implementation, get from request
            userAgent: 'hexabase-cli',
            metadata
        };

        await this.auditStorage.save(auditId, auditLog);
    }

    async getUser(userId) {
        return await this.userStorage.findById(userId);
    }

    async updateUser(userId, updates) {
        const user = await this.userStorage.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const updatedUser = { ...user, ...updates, updatedAt: new Date() };
        await this.userStorage.save(userId, updatedUser);

        return updatedUser;
    }

    async changeUserRole(currentUser, targetUserId, newRole) {
        const users = await this.userStorage.findAll();
        const targetUser = users.find(u => u.id === targetUserId);
        if (!targetUser) throw new Error('Target user not found');

        // Role hierarchy
        const roleHierarchy = { viewer: 1, user: 2, admin: 3, superadmin: 4 };

        switch (currentUser.role) {
            case 'viewer':
                throw new Error('Viewer cannot change roles');
            case 'user':
                if (targetUser.role !== 'viewer' || !['user'].includes(newRole))
                    throw new Error('User can only promote viewers to user');
                break;
            case 'admin':
                if (targetUser.role === 'superadmin' || !['user', 'admin'].includes(newRole))
                    throw new Error('Admin can only change viewer/user roles to user/admin');
                break;
            case 'superadmin':
                if (!['user', 'admin'].includes(newRole))
                    throw new Error('Super admin can only set roles to user/admin');
                break;
        }

        targetUser.role = newRole;
        targetUser.updatedAt = new Date();
        await this.userStorage.save(targetUser.id, targetUser);

        // Log audit
        await this.logAudit('ROLE_CHANGE', currentUser.userId, { targetUserId, newRole });

        return targetUser;
    }


}

module.exports = new AuthenticationService();