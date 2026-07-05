/**
 * ----------------------------------------------------------------------
 * Tenant Controller
 * ----------------------------------------------------------------------
 * Purpose: Manages the organization's or individual's workspace details.
 */

const prisma = require('../prisma');
const { asyncHandler } = require('../middleware/custommiddleware');

/**
 * @desc    Get current tenant details and settings
 * @route   GET /api/tenant
 * @access  Private (Requires valid JWT with tenantId)
 */
const getTenantDetails = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId; 

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    res.json(tenant);
});

/**
 * @desc    Update current tenant details (e.g. company name, address, settings)
 * @route   PUT /api/tenant
 * @access  Private (Requires valid JWT and likely 'owner' role)
 */
const updateTenantDetails = asyncHandler(async (req, res) => {
    const tenantId = req.user.tenantId;
    const { name, contactEmail, contactPhone, settings } = req.body;

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { name, contactEmail, contactPhone, settings }
    });

    res.json(updatedTenant);
});

module.exports = {
    getTenantDetails,
    updateTenantDetails
};
