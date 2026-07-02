/**
 * ----------------------------------------------------------------------
 * Tenant Controller
 * ----------------------------------------------------------------------
 * Purpose: Manages the organization's or individual's workspace details.
 */

const prisma = require('../prisma');

/**
 * @desc    Get current tenant details and settings
 * @route   GET /api/tenant
 * @access  Private (Requires valid JWT with tenantId)
 */
const getTenantDetails = async (req, res) => {
    try {
        const tenantId = req.user.tenantId; 

        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }

        res.json(tenant);
    } catch (error) {
        console.error("Error in getTenantDetails:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Update current tenant details (e.g. company name, address, settings)
 * @route   PUT /api/tenant
 * @access  Private (Requires valid JWT and likely 'owner' role)
 */
const updateTenantDetails = async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const { name, contactEmail, contactPhone, settings } = req.body;

        const updatedTenant = await prisma.tenant.update({
            where: { id: tenantId },
            data: { name, contactEmail, contactPhone, settings }
        });

        res.json(updatedTenant);
    } catch (error) {
        console.error("Error in updateTenantDetails:", error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getTenantDetails,
    updateTenantDetails
};
