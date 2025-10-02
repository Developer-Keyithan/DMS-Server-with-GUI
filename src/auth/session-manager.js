const StorageEngine = require('../core/storage-engine');

class SessionManager {
    constructor() {
        this.sessionStorage = new StorageEngine('sessions');
        this.sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    }

    async createSession(userId, userAgent, ipAddress) {
        const sessionId = require('../core/encryption').generateId('session');
        const session = {
            id: sessionId,
            userId,
            userAgent,
            ipAddress,
            createdAt: new Date(),
            lastActivity: new Date(),
            expiresAt: new Date(Date.now() + this.sessionTimeout),
            isActive: true
        };

        await this.sessionStorage.save(sessionId, session);
        return sessionId;
    }

    async getSession(sessionId) {
        const session = await this.sessionStorage.findById(sessionId);
        
        if (!session || !session.isActive) {
            return null;
        }

        // Check if session is expired
        if (new Date() > new Date(session.expiresAt)) {
            await this.invalidateSession(sessionId);
            return null;
        }

        // Update last activity
        session.lastActivity = new Date();
        await this.sessionStorage.save(sessionId, session);

        return session;
    }

    async invalidateSession(sessionId) {
        const session = await this.sessionStorage.findById(sessionId);
        if (session) {
            session.isActive = false;
            session.updatedAt = new Date();
            await this.sessionStorage.save(sessionId, session);
        }
        return true;
    }

    async invalidateAllUserSessions(userId) {
        const sessions = await this.sessionStorage.findAll();
        const userSessions = sessions.filter(session => 
            session.userId === userId && session.isActive
        );

        for (const session of userSessions) {
            await this.invalidateSession(session.id);
        }

        return userSessions.length;
    }

    async cleanupExpiredSessions() {
        const sessions = await this.sessionStorage.findAll();
        const now = new Date();
        let cleanedCount = 0;

        for (const session of sessions) {
            if (now > new Date(session.expiresAt) && session.isActive) {
                await this.invalidateSession(session.id);
                cleanedCount++;
            }
        }

        return cleanedCount;
    }

    async getUserSessions(userId) {
        const sessions = await this.sessionStorage.findAll();
        return sessions.filter(session => session.userId === userId);
    }
}

module.exports = new SessionManager();