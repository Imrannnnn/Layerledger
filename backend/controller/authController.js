/**
 * ----------------------------------------------------------------------
 * Auth Controller
 * ----------------------------------------------------------------------
 * Purpose: Handles user authentication, registration, and login.
 */

const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const prisma = require('../prisma');

/**
 * @desc    Register a new user (and potentially a new tenant)
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res) => {
    try {
        const { name, email, password, companyName, tenantType } = req.body;

        if (!name || typeof name !== 'string' || name.trim() === '') {
            return res.status(400).json({ message: 'Name is required' });
        }
        if (!email || typeof email !== 'string' || email.trim() === '') {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!password || typeof password !== 'string' || password === '') {
            return res.status(400).json({ message: 'Password is required' });
        }

        // 1. Check if user already exists
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // 2. Always create a new Tenant for public registrations
        const finalCompanyName = companyName || name;
        const finalType = tenantType || (companyName ? 'organization' : 'individual');
        const tenant = await prisma.tenant.create({
            data: {
                name: finalCompanyName,
                type: finalType
            }
        });
        const tenantId = tenant.id;

        // 3. Hash password with cost factor 12
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 4. Create User
        const user = await prisma.user.create({
            data: {
                tenantId,
                name,
                email,
                passwordHash: hashedPassword,
                role: 'owner' // default to owner if creating a new company
            }
        });

        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            tenantId: user.tenantId,
            role: user.role
        });

    } catch (error) {
        console.error("Error in registerUser:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || typeof email !== 'string' || email.trim() === '') {
            return res.status(400).json({ message: 'Email is required' });
        }
        if (!password || typeof password !== 'string' || password === '') {
            return res.status(400).json({ message: 'Password is required' });
        }

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
            res.status(401).json({ message: 'Invalid Credentials' });
        }
    } catch (error) {
        console.error("Error in loginUser:", error);
        res.status(500).json({ message: 'Server Error' });
    }
};

module.exports = {
    registerUser,
    loginUser
};
