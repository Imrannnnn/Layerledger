const { z } = require('zod');

const createClientSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Client name is required'),
        phone: z.string().optional(),
        email: z.string().email('Invalid email address').optional().or(z.literal('')),
        address: z.string().optional(),
        notes: z.string().optional()
    })
});

const updateClientSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Client name cannot be empty').optional(),
        phone: z.string().optional(),
        email: z.string().email('Invalid email address').optional().or(z.literal('')),
        address: z.string().optional(),
        notes: z.string().optional()
    })
});

module.exports = {
    createClientSchema,
    updateClientSchema
};
