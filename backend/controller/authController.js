/**
 * ----------------------------------------------------------------------
 * Auth Controller
 * ----------------------------------------------------------------------
 * Purpose: Handles user authentication, registration, and login.
 */

const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Register a new user (and potentially a new tenant)
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, companyName, tenantType } = req.body;

    // 1. Check if user already exists
    const userExists = await prisma.user.findUnique({ where: { email } });
    if (userExists) {
        res.status(400);
        throw new Error('User already exists');
    }

    // 2. Hash password with cost factor 12
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const finalCompanyName = companyName || name;
    const finalType = tenantType || (companyName ? 'organization' : 'individual');

    // 3. Create Tenant and User atomically
    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
            data: {
                name: finalCompanyName,
                type: finalType
            }
        });

        const user = await tx.user.create({
            data: {
                tenantId: tenant.id,
                name,
                email,
                passwordHash: hashedPassword,
                role: 'owner' // default to owner if creating a new company
            }
        });

        return user;
    });

    const user = result;

    res.status(201).json({
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role
    });
});

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // 1. Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    // 2. Verify password using bcrypt
    let isMatch = false;
    if (user) {
        isMatch = await bcrypt.compare(password, user.passwordHash);
    }

    if (user && isMatch) {
        // 3. Generate JWT
        const token = jwt.sign(
            { id: user.id, tenantId: user.tenantId },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            tenantId: user.tenantId,
            role: user.role,
            token
        });
    } else {
        res.status(401);
        throw new Error('Invalid Credentials');
    }
});

module.exports = {
    registerUser,
    loginUser
};
