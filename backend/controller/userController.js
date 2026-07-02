/**
 * ----------------------------------------------------------------------
 * User Controller
 * ----------------------------------------------------------------------
 * Purpose: Manages employees/users within a specific Tenant.
 */

const bcrypt = require('bcrypt');
const prisma = require('../prisma');

/**
 * @desc    Get all users for the current tenant
 * @route   GET /api/users
 * @access  Private (Owner only)
 */
const getUsers = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const users = await prisma.user.findMany({
            where: { tenantId },
            select: { id: true, tenantId: true, name: true, email: true, role: true, pin: true, createdAt: true, updatedAt: true }
        });
        res.json(users);
    } catch (error) {
        console.error("Error in getUsers:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Get a single user by ID
 * @route   GET /api/users/:id
 * @access  Private (Owner or Self)
 */
const getUserById = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        // Non-owners can only view their own user record
        if (req.user.role !== 'owner' && req.user.id !== req.params.id) {
            return res.status(403).json({ message: 'Access denied: you can only view your own profile' });
        }

        const user = await prisma.user.findFirst({
            where: { id: req.params.id, tenantId },
            select: { id: true, tenantId: true, name: true, email: true, role: true, pin: true, createdAt: true, updatedAt: true }
        });
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error("Error in getUserById:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Create a new user/employee in the tenant
 * @route   POST /api/users
 * @access  Private (Owner only)
 */
const createUser = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, email, password, role, pin } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: 'Name is required' });
        }
        if (!email || typeof email !== 'string' || email.trim() === '') {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!password || typeof password !== 'string' || password === '') {
            return res.status(400).json({ message: 'Password is required' });
        }

        // Check if user already exists
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password with cost factor 12
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await prisma.user.create({
            data: {
                tenantId,
                name,
                email,
                passwordHash: hashedPassword,
                role: role || 'production',
                pin
            },
            select: { id: true, tenantId: true, name: true, email: true, role: true, pin: true, createdAt: true, updatedAt: true }
        });

        res.status(201).json(newUser);
    } catch (error) {
        console.error("Error in createUser:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update a user
 * @route   PUT /api/users/:id
 * @access  Private (Owner or Self)
 */
const updateUser = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, role, pin } = req.body;

        // Non-owners can only update themselves
        if (req.user.role !== 'owner' && req.user.id !== req.params.id) {
            return res.status(403).json({ message: 'Access denied: you can only update your own profile' });
        }

        // Non-owners cannot update roles
        if (role && req.user.role !== 'owner') {
            return res.status(403).json({ message: 'Access denied: only owners can update user roles' });
        }

        // If standard user is updating self, role should remain unchanged or be omitted
        const updateData = { name, pin };
        if (req.user.role === 'owner' && role) {
            updateData.role = role;
        }

        const updatedUser = await prisma.user.updateMany({
            where: { id: req.params.id, tenantId },
            data: updateData
        });

        if (updatedUser.count === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = await prisma.user.findFirst({
            where: { id: req.params.id, tenantId },
            select: { id: true, tenantId: true, name: true, email: true, role: true, pin: true, createdAt: true, updatedAt: true }
        });
        res.json(user);
    } catch (error) {
        console.error("Error in updateUser:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/:id
 * @access  Private (Owner only)
 */
const deleteUser = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        // Owners cannot delete their own account
        if (req.user.id === req.params.id) {
            return res.status(400).json({ message: 'Access denied: owners cannot delete their own profile' });
        }

        const deletedUser = await prisma.user.deleteMany({
            where: { id: req.params.id, tenantId }
        });
        
        if (deletedUser.count === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User removed successfully' });
    } catch (error) {
        console.error("Error in deleteUser:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};
