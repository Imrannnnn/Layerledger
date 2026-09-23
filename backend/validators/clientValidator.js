const { z } = require('zod');

const createClientSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Client name is required'),
        phone: z.string().optional().nullable(),
        email: z.string().trim().toLowerCase().email('Invalid email address').optional().or(z.literal('')).nullable(),
        address: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        birthday: z.string().optional().nullable()
    })
});

const updateClientSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Client name cannot be empty').optional(),
        phone: z.string().optional().nullable(),
        email: z.string().trim().toLowerCase().email('Invalid email address').optional().or(z.literal('')).nullable(),
        address: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
        birthday: z.string().optional().nullable()
    })
});

module.exports = {
    createClientSchema,
    updateClientSchema
};
