const EncryptionService = require('../core/encryption');

class User {
    constructor(id, name, email, passwordHash, passwordSalt, role = 'user', createdAt = new Date()) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
        this.passwordSalt = passwordSalt;
        this.role = role; // 'superadmin', 'admin', 'user', 'viewer'
        this.createdAt = createdAt;
        this.updatedAt = new Date();
        this.lastLogin = null;
        this.isActive = true;
        this.profile = {
            avatar: null,
            bio: '',
            timezone: 'UTC',
            language: 'en',
            preferences: {
                theme: 'light',
                notifications: {
                    email: true,
                    push: true,
                    sms: false
                }
            }
        };
        this.sessions = {};
        this.permissions = this.getDefaultPermissions(role);
        this.security = {
            twoFactorEnabled: false,
            twoFactorSecret: null,
            loginAttempts: 0,
            lastFailedLogin: null,
            passwordChangedAt: new Date(),
            mustChangePassword: false
        };
        this.metadata = {
            lastActivity: new Date(),
            totalLogins: 0,
            apiCalls: 0,
            storageUsed: 0
        };
    }

    // Authentication methods
    verifyPassword(password) {
        return EncryptionService.verifyPassword(password, this.passwordSalt, this.passwordHash);
    }

    changePassword(newPassword) {
        const { salt, hash } = EncryptionService.hashPassword(newPassword);
        this.passwordSalt = salt;
        this.passwordHash = hash;
        this.security.passwordChangedAt = new Date();
        this.security.mustChangePassword = false;
        this.updatedAt = new Date();
    }

    recordLogin(success = true, ipAddress = null, userAgent = null) {
        if (success) {
            this.lastLogin = new Date();
            this.security.loginAttempts = 0;
            this.security.lastFailedLogin = null;
            this.metadata.totalLogins += 1;
            this.metadata.lastActivity = new Date();
        } else {
            this.security.loginAttempts += 1;
            this.security.lastFailedLogin = new Date();
        }
        
        this.updatedAt = new Date();
        
        // Create session for successful login
        if (success) {
            this.createSession(ipAddress, userAgent);
        }
    }

    createSession(ipAddress, userAgent) {
        const sessionId = EncryptionService.generateId('session');
        const session = {
            id: sessionId,
            createdAt: new Date(),
            lastActivity: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            ipAddress,
            userAgent,
            isActive: true
        };
        
        this.sessions[sessionId] = session;
        this.updatedAt = new Date();
        
        return sessionId;
    }

    invalidateSession(sessionId) {
        if (this.sessions[sessionId]) {
            this.sessions[sessionId].isActive = false;
            this.sessions[sessionId].updatedAt = new Date();
            this.updatedAt = new Date();
        }
    }

    invalidateAllSessions() {
        Object.values(this.sessions).forEach(session => {
            session.isActive = false;
            session.updatedAt = new Date();
        });
        this.updatedAt = new Date();
    }

    getActiveSessions() {
        return Object.values(this.sessions).filter(session => 
            session.isActive && new Date() < new Date(session.expiresAt)
        );
    }

    // Permission methods
    getDefaultPermissions(role) {
        const permissionSets = {
            superadmin: ['*'],
            admin: [
                'db.create', 'db.delete', 'db.read', 'db.write', 'db.admin',
                'user.read', 'user.manage', 'system.monitor'
            ],
            user: [
                'db.read', 'db.write', 'file.read', 'file.write',
                'collection.create', 'collection.read', 'collection.write',
                'bucket.create', 'bucket.read', 'bucket.write'
            ],
            viewer: ['db.read', 'file.read', 'collection.read', 'bucket.read']
        };
        
        return permissionSets[role] || permissionSets.user;
    }

    hasPermission(permission) {
        if (this.permissions.includes('*')) return true;
        return this.permissions.includes(permission);
    }

    canAccessDatabase(database, action) {
        // Database owner has full access
        if (database.ownerId === this.id) return true;
        
        // Check role-based permissions
        const requiredPermission = `db.${action}`;
        if (this.hasPermission(requiredPermission)) return true;
        
        // Check explicit database permissions
        const userPerms = database.permissions[this.id] || [];
        return userPerms.includes('admin') || userPerms.includes(action);
    }

    canAccessResource(resourceType, action) {
        const requiredPermission = `${resourceType}.${action}`;
        return this.hasPermission(requiredPermission);
    }

    // Role management
    changeRole(newRole) {
        const validRoles = ['superadmin', 'admin', 'user', 'viewer'];
        if (!validRoles.includes(newRole)) {
            throw new Error(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(', ')}`);
        }
        
        this.role = newRole;
        this.permissions = this.getDefaultPermissions(newRole);
        this.updatedAt = new Date();
        
        // Invalidate all sessions when role changes
        this.invalidateAllSessions();
    }

    // Profile management
    updateProfile(updates) {
        this.profile = { ...this.profile, ...updates };
        this.updatedAt = new Date();
    }

    updatePreferences(preferences) {
        this.profile.preferences = { ...this.profile.preferences, ...preferences };
        this.updatedAt = new Date();
    }

    // Security methods
    enableTwoFactor(secret) {
        this.security.twoFactorEnabled = true;
        this.security.twoFactorSecret = secret;
        this.updatedAt = new Date();
    }

    disableTwoFactor() {
        this.security.twoFactorEnabled = false;
        this.security.twoFactorSecret = null;
        this.updatedAt = new Date();
    }

    isLocked() {
        return this.security.loginAttempts >= 5; // Lock after 5 failed attempts
    }

    getLockoutTime() {
        if (!this.isLocked()) return 0;
        
        const lockoutDuration = 15 * 60 * 1000; // 15 minutes
        const timeSinceLastFailed = new Date() - new Date(this.security.lastFailedLogin);
        return Math.max(0, lockoutDuration - timeSinceLastFailed);
    }

    resetLoginAttempts() {
        this.security.loginAttempts = 0;
        this.security.lastFailedLogin = null;
        this.updatedAt = new Date();
    }

    requirePasswordChange() {
        this.security.mustChangePassword = true;
        this.updatedAt = new Date();
    }

    // Activity tracking
    recordActivity(activityType, metadata = {}) {
        this.metadata.lastActivity = new Date();
        this.metadata.apiCalls += 1;
        
        // Store detailed activity log (in production, this would go to a separate log)
        const activity = {
            type: activityType,
            timestamp: new Date(),
            metadata
        };
        
        this.updatedAt = new Date();
        return activity;
    }

    updateStorageUsage(size) {
        this.metadata.storageUsed += size;
        this.updatedAt = new Date();
    }

    // Validation methods
    validateEmail(newEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            return { valid: false, error: 'Invalid email format' };
        }
        return { valid: true };
    }

    validateName(newName) {
        if (!newName || newName.trim().length === 0) {
            return { valid: false, error: 'Name cannot be empty' };
        }

        if (newName.length < 2 || newName.length > 50) {
            return { valid: false, error: 'Name must be between 2 and 50 characters' };
        }

        if (!/^[a-zA-Z ]+$/.test(newName)) {
            return { valid: false, error: 'Name can only contain letters and spaces' };
        }

        return { valid: true };
    }

    // Export and serialization
    toJSON(includeSensitive = false) {
        const baseData = {
            id: this.id,
            name: this.name,
            email: this.email,
            role: this.role,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            lastLogin: this.lastLogin,
            isActive: this.isActive,
            profile: this.profile,
            metadata: this.metadata,
            permissions: this.permissions
        };

        if (includeSensitive) {
            baseData.sessions = this.sessions;
            baseData.security = {
                twoFactorEnabled: this.security.twoFactorEnabled,
                loginAttempts: this.security.loginAttempts,
                passwordChangedAt: this.security.passwordChangedAt,
                mustChangePassword: this.security.mustChangePassword
            };
        }

        return baseData;
    }

    toPublicJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            role: this.role,
            createdAt: this.createdAt,
            lastLogin: this.lastLogin,
            isActive: this.isActive,
            profile: {
                avatar: this.profile.avatar,
                bio: this.profile.bio,
                timezone: this.profile.timezone,
                language: this.profile.language
            }
        };
    }

    // Static methods
    static fromJSON(data) {
        const user = new User(
            data.id,
            data.name,
            data.email,
            data.passwordHash,
            data.passwordSalt,
            data.role,
            data.createdAt
        );
        
        user.updatedAt = data.updatedAt;
        user.lastLogin = data.lastLogin;
        user.isActive = data.isActive !== undefined ? data.isActive : true;
        user.profile = data.profile || user.profile;
        user.sessions = data.sessions || {};
        user.permissions = data.permissions || user.permissions;
        user.security = data.security || user.security;
        user.metadata = data.metadata || user.metadata;
        
        return user;
    }

    static createFromRegistration(name, email, password) {
        const { salt, hash } = EncryptionService.hashPassword(password);
        const userId = EncryptionService.generateId('user');
        
        return new User(
            userId,
            name,
            email,
            hash,
            salt,
            'user' // Default role
        );
    }

    // Administrative methods
    suspend(reason = '') {
        this.isActive = false;
        this.invalidateAllSessions();
        this.updatedAt = new Date();
        
        // Log suspension (in production, this would go to audit log)
        return {
            suspended: true,
            timestamp: new Date(),
            reason: reason
        };
    }

    activate() {
        this.isActive = true;
        this.updatedAt = new Date();
        
        return {
            activated: true,
            timestamp: new Date()
        };
    }

    // Statistics and reporting
    getUsageStatistics() {
        return {
            totalLogins: this.metadata.totalLogins,
            apiCalls: this.metadata.apiCalls,
            storageUsed: this.metadata.storageUsed,
            activeSessions: this.getActiveSessions().length,
            lastActivity: this.metadata.lastActivity
        };
    }

    getSecurityStatus() {
        return {
            twoFactorEnabled: this.security.twoFactorEnabled,
            isLocked: this.isLocked(),
            lockoutTime: this.getLockoutTime(),
            passwordAge: new Date() - new Date(this.security.passwordChangedAt),
            mustChangePassword: this.security.mustChangePassword,
            failedAttempts: this.security.loginAttempts
        };
    }

    // Compliance and auditing
    getAuditTrail() {
        // This would retrieve the user's audit trail from a separate log
        return {
            userId: this.id,
            lastPasswordChange: this.security.passwordChangedAt,
            lastLogin: this.lastLogin,
            roleChanges: this.getRoleChangeHistory(),
            securityEvents: this.getSecurityEvents()
        };
    }

    getRoleChangeHistory() {
        // This would be stored in an audit log
        return [
            {
                from: null,
                to: this.role,
                timestamp: this.createdAt,
                by: 'system'
            }
        ];
    }

    getSecurityEvents() {
        // This would be retrieved from security event logs
        const events = [];
        
        if (this.security.lastFailedLogin) {
            events.push({
                type: 'failed_login',
                timestamp: this.security.lastFailedLogin,
                attempts: this.security.loginAttempts
            });
        }
        
        if (this.security.twoFactorEnabled) {
            events.push({
                type: 'two_factor_enabled',
                timestamp: this.updatedAt
            });
        }
        
        return events;
    }

    // Resource cleanup
    cleanupExpiredSessions() {
        const now = new Date();
        let cleanedCount = 0;
        
        Object.keys(this.sessions).forEach(sessionId => {
            const session = this.sessions[sessionId];
            if (!session.isActive || now > new Date(session.expiresAt)) {
                delete this.sessions[sessionId];
                cleanedCount++;
            }
        });
        
        if (cleanedCount > 0) {
            this.updatedAt = new Date();
        }
        
        return cleanedCount;
    }

    // Notifications and preferences
    shouldReceiveNotification(type) {
        const notificationSettings = this.profile.preferences.notifications;
        
        switch (type) {
            case 'email':
                return notificationSettings.email;
            case 'push':
                return notificationSettings.push;
            case 'sms':
                return notificationSettings.sms;
            default:
                return false;
        }
    }

    getNotificationPreferences() {
        return {
            email: this.profile.preferences.notifications.email,
            push: this.profile.preferences.notifications.push,
            sms: this.profile.preferences.notifications.sms,
            frequency: 'instant' // Could be 'instant', 'daily', 'weekly'
        };
    }
}

module.exports = User;