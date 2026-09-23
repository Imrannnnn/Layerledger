const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// In-memory cache for authenticated users to prevent pool exhaustion during concurrent requests
const userCache = new Map();
const USER_CACHE_TTL = 30 * 1000;

/**
 * Middleware to protect routes by verifying JWT token
 * and attaching the user object (with tenantId) to the request.
 */
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            if (!decoded || !decoded.id || typeof decoded.id !== 'string') {
                return res.status(401).json({ message: 'Not authorized, invalid token payload' });
            }

            // Check in-memory cache first
            const cached = userCache.get(decoded.id);
            if (cached && (Date.now() - cached.timestamp < USER_CACHE_TTL)) {
                req.user = cached.user;
            } else {
                // Get user from the token (exclude password)
                req.user = await prisma.user.findUnique({
                    where: { id: decoded.id },
                    select: {
                        id: true,
                        tenantId: true,
                        name: true,
                        email: true,
                        role: true,
                        tenant: {
                            select: {
                                settings: true
                            }
                        }
                    }
                });

                if (req.user) {
                    userCache.set(decoded.id, { user: req.user, timestamp: Date.now() });
                }
            }

            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user no longer exists' });
            }

            // Block suspended accounts
            if (req.user.tenant?.settings?.status === "Suspended") {
                return res.status(403).json({ message: 'Access denied: Your account has been suspended. Please contact support.' });
            }

            return next();
        } catch (error) {
            console.error("Auth Middleware Error:", error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

/**
 * Middleware to restrict access based on user roles
 */
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Access denied: insufficient permissions' });
        }
        next();
    };
};

/**
 * Clear cached user data (e.g. on account deletion or role update)
 */
const clearUserCache = (userId) => {
    if (userId) {
        userCache.delete(userId);
    } else {
        userCache.clear();
    }
};

module.exports = { protect, restrictTo, clearUserCache };
