/**
 * ----------------------------------------------------------------------
 * Auth Controller
 * ----------------------------------------------------------------------
 * Purpose: Handles user authentication, registration, activation, and login.
 */

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');
const emailService = require('../services/emailService');

/**
 * @desc    Register a new user (and potentially a new tenant) with activation link
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password, companyName, tenantType } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    // 1. Check if user already exists (case-insensitive)
    const userExists = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } }
    });
    if (userExists) {
        if (!userExists.isActivated) {
            res.status(400);
            throw new Error('An account with this email is pending activation. Please check your email or click resend activation.');
        }
        res.status(400);
        throw new Error('User already exists');
    }

    // 2. Hash password with cost factor 12
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const finalCompanyName = companyName || name;
    const finalType = tenantType || (companyName ? 'organization' : 'individual');

    // 3. Generate secure activation token (valid for 24 hours)
    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // 4. Create Tenant and User atomically with 10 free scans (20 credits) & isActivated: false
    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
            data: {
                name: finalCompanyName,
                type: finalType,
                tokenBalance: 20, // 10 free scans * 2 credits
                settings: {
                    plan: 'free',
                    freeScansGranted: true,
                    freeScansClaimedAt: new Date().toISOString()
                }
            }
        });

        const user = await tx.user.create({
            data: {
                tenantId: tenant.id,
                name,
                email: normalizedEmail,
                passwordHash: hashedPassword,
                role: 'owner', // default to owner if creating a new company
                isActivated: false,
                activationToken,
                activationExpiresAt
            }
        });

        await tx.tokenTransaction.create({
            data: {
                tenantId: tenant.id,
                amount: 20,
                type: 'bonus',
                description: 'Welcome allowance: 10 free scans (20 credits)'
            }
        });

        return user;
    });

    const user = result;

    // Asynchronously dispatch Bakewealth activation email with token link
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const activationUrl = `${appUrl}/?activate=${activationToken}`;
    emailService.sendActivationEmail({
        to: user.email,
        name: user.name,
        companyName: finalCompanyName,
        activationUrl
    }).catch(err => {
        console.error('[AuthController] Activation email failed to send:', err.message);
    });

    res.status(201).json({
        success: true,
        isActivated: false,
        message: 'Account created! Please check your email to activate your account and start your onboarding session.',
        id: user.id,
        name: user.name,
        email: normalizedEmail,
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
    const normalizedEmail = (email || '').trim().toLowerCase();

    // 1. Find user by email (case-insensitive) with tenant
    const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    settings: true,
                    createdAt: true
                }
            }
        }
    });

    // 2. Verify password using bcrypt
    let isMatch = false;
    if (user) {
        isMatch = await bcrypt.compare(password, user.passwordHash);
    }

    if (user && isMatch) {
        // Enforce account activation
        if (user.isActivated === false) {
            res.status(403);
            const err = new Error('Your account is not activated yet. Please check your email for the activation link.');
            err.notActivated = true;
            err.email = normalizedEmail;
            throw err;
        }

        // If legacy database email had mixed or upper case, heal to canonical lowercase
        if (user.email !== normalizedEmail) {
            await prisma.user.update({
                where: { id: user.id },
                data: { email: normalizedEmail }
            }).catch(e => console.warn('[AuthController] Auto-heal email notice:', e.message));
        }

        // 3. Generate JWT
        const token = jwt.sign(
            { id: user.id, tenantId: user.tenantId },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.json({
            id: user.id,
            name: user.name,
            email: normalizedEmail,
            tenantId: user.tenantId,
            role: user.role,
            token,
            tenant: user.tenant
        });
    } else {
        res.status(401);
        throw new Error('Invalid Credentials');
    }
});

/**
 * @desc    Activate account via token link and transition into session / onboarding
 * @route   POST /api/auth/activate, GET /api/auth/activate
 * @access  Public
 */
const activateUser = asyncHandler(async (req, res) => {
    const token = req.body?.token || req.query?.token;
    if (!token) {
        res.status(400);
        throw new Error('Activation token is required');
    }

    // 1. Find user with this activation token
    const user = await prisma.user.findFirst({
        where: { activationToken: token },
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    settings: true,
                    createdAt: true
                }
            }
        }
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired activation link. If your account is already active, please sign in.');
    }

    // 2. Check expiration
    if (user.activationExpiresAt && new Date() > new Date(user.activationExpiresAt)) {
        res.status(400);
        throw new Error('This activation link has expired. Please request a new activation link.');
    }

    // 3. Mark user as activated atomically
    const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
            isActivated: true,
            activationToken: null,
            activationExpiresAt: null
        }
    });

    // 4. Issue JWT for immediate seamless login & onboarding transition
    const jwtToken = jwt.sign(
        { id: updatedUser.id, tenantId: updatedUser.tenantId },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    res.json({
        success: true,
        message: 'Account activated successfully! Welcome to Bakewealth.',
        token: jwtToken,
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        tenantId: updatedUser.tenantId,
        role: updatedUser.role,
        tenant: user.tenant,
        isNewRegistration: true
    });
});

/**
 * @desc    Resend activation email to pending user
 * @route   POST /api/auth/resend-activation
 * @access  Public
 */
const resendActivation = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = (email || '').trim().toLowerCase();

    const user = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        include: { tenant: { select: { name: true } } }
    });

    if (!user) {
        return res.json({
            success: true,
            message: 'If an inactive account exists for this email, a fresh activation link has been sent.'
        });
    }

    if (user.isActivated) {
        res.status(400);
        throw new Error('This account is already activated. Please sign in directly.');
    }

    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.user.update({
        where: { id: user.id },
        data: {
            activationToken,
            activationExpiresAt
        }
    });

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const activationUrl = `${appUrl}/?activate=${activationToken}`;
    emailService.sendActivationEmail({
        to: user.email,
        name: user.name,
        companyName: user.tenant?.name || 'Bakewealth Workspace',
        activationUrl
    }).catch(err => {
        console.error('[AuthController] Resend activation email failed:', err.message);
    });

    res.json({
        success: true,
        message: 'A fresh activation link has been sent to your email.'
    });
});

module.exports = {
    registerUser,
    loginUser,
    activateUser,
    resendActivation
};
