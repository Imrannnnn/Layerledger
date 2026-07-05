/**
 * ----------------------------------------------------------------------
 * User Controller
 * ----------------------------------------------------------------------
 * Purpose: Manages employees/users within a specific Tenant.
 */

const bcrypt = require('bcrypt');
const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get all users for the current tenant
 * @route   GET /api/users
 * @access  Private (Owner only)
 */
const getUsers = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const users = await prisma.user.findMany({
        where: { tenantId },
        select: { id: true, tenantId: true, name: true, email: true, role: true, pin: true, createdAt: true, updatedAt: true }
    });
    res.json(users);
});

/**
 * @desc    Get a single user by ID
 * @route   GET /api/users/:id
 * @access  Private (Owner or Self)
 */
const getUserById = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    // Non-owners can only view their own user record
    if (req.user.role !== 'owner' && req.user.id !== req.params.id) {
        res.status(403);
        throw new Error('Access denied: you can only view your own profile');
    }

    const user = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId },
        select: { id: true, tenantId: true, name: true, email: true, role: true, pin: true, createdAt: true, updatedAt: true }
    });
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    res.json(user);
});

/**
 * @desc    Create a new user/employee in the tenant
 * @route   POST /api/users
 * @access  Private (Owner only)
 */
const createUser = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, email, password, role, pin } = req.body;

    // Check if user already exists
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
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
});

/**
 * @desc    Update a user
 * @route   PUT /api/users/:id
 * @access  Private (Owner or Self)
 */
const updateUser = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, role, pin } = req.body;

    // Non-owners can only update themselves
    if (req.user.role !== 'owner' && req.user.id !== req.params.id) {
        res.status(403);
        throw new Error('Access denied: you can only update your own profile');
    }

    // Non-owners cannot update roles
    if (role && req.user.role !== 'owner') {
        res.status(403);
        throw new Error('Access denied: only owners can update user roles');
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
        res.status(404);
        throw new Error('User not found');
    }
    
    const user = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId },
        select: { id: true, tenantId: true, name: true, email: true, role: true, pin: true, createdAt: true, updatedAt: true }
    });
    res.json(user);
});

/**
 * @desc    Delete a user
 * @route   DELETE /api/users/:id
 * @access  Private (Owner only)
 */
const deleteUser = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;

    // Owners cannot delete their own account
    if (req.user.id === req.params.id) {
        res.status(400);
        throw new Error('Access denied: owners cannot delete their own profile');
    }

    const deletedUser = await prisma.user.deleteMany({
        where: { id: req.params.id, tenantId }
    });
    
    if (deletedUser.count === 0) {
        res.status(404);
        throw new Error('User not found');
    }
    res.json({ message: 'User removed successfully' });
});

module.exports = {
    getUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser
};
