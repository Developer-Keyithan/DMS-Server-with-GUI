class AuthorizationService {
    constructor() {
        this.roles = {
            superadmin: ['*'],
            admin: [
                'db.create', 'db.delete', 'db.read', 'db.write', 
                'db.admin', 'user.read', 'user.manage'
            ],
            user: [
                'db.read', 'db.write', 'file.read', 'file.write',
                'collection.create', 'collection.read', 'collection.write'
            ],
            viewer: ['db.read', 'file.read', 'collection.read']
        };
    }

    hasPermission(userRole, permission) {
        const rolePermissions = this.roles[userRole] || [];
        
        if (rolePermissions.includes('*')) {
            return true;
        }

        return rolePermissions.includes(permission);
    }

    canAccessDatabase(user, database, action) {
        // Database owner has full access
        if (database.ownerId === user.userId) {
            return true;
        }

        // Check explicit permissions
        const userPerms = database.permissions?.[user.userId] || [];
        if (userPerms.includes('admin') || userPerms.includes(action)) {
            return true;
        }

        // Check role-based permissions
        const requiredPermission = `db.${action}`;
        return this.hasPermission(user.role, requiredPermission);
    }

    canAccessCollection(user, collection, action) {
        const requiredPermission = `collection.${action}`;
        return this.hasPermission(user.role, requiredPermission);
    }

    canAccessFile(user, bucket, action) {
        const requiredPermission = `file.${action}`;
        return this.hasPermission(user.role, requiredPermission);
    }

    canManageUsers(user) {
        return this.hasPermission(user.role, 'user.manage');
    }

    getRolePermissions(role) {
        return this.roles[role] || [];
    }

    validateRole(role) {
        return Object.keys(this.roles).includes(role);
    }
}

module.exports = new AuthorizationService();