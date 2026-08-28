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

    const existingTenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existingTenant) {
        res.status(404);
        throw new Error('Tenant not found');
    }

    let mergedSettings = existingTenant.settings || {};
    if (settings) {
        const existingConfig = (existingTenant.settings && (existingTenant.settings.appConfig || existingTenant.settings.localState)) || {};
        const incomingConfig = settings.appConfig || settings.localState || {};

        mergedSettings = {
            ...existingTenant.settings,
            ...settings,
            appConfig: {
                ...existingConfig,
                ...incomingConfig
            }
        };
    }

    const updatedTenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
            name: name !== undefined ? name : existingTenant.name,
            contactEmail: contactEmail !== undefined ? contactEmail : existingTenant.contactEmail,
            contactPhone: contactPhone !== undefined ? contactPhone : existingTenant.contactPhone,
            settings: mergedSettings
        }
    });

    res.json(updatedTenant);
});

module.exports = {
    getTenantDetails,
    updateTenantDetails
};
