const AuthenticationService = require('../../auth/authentication');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Authentication token required'
        });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    try {
        const decoded = AuthenticationService.verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            error: 'Invalid or expired token'
        });
    }
};

module.exports = authMiddleware;