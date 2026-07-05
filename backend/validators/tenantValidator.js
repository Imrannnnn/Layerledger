const { z } = require('zod');

const updateTenantSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Tenant name cannot be empty').optional(),
        contactEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
        contactPhone: z.string().optional(),
        settings: z.any().optional()
    })
});

module.exports = {
    updateTenantSchema
};
