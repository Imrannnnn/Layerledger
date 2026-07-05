const { z } = require('zod');

const createUserSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name is required'),
        email: z.string().email('Email is required'),
        password: z.string().min(1, 'Password is required'),
        role: z.enum(['owner', 'manager', 'production', 'sales']).optional(),
        pin: z.string().optional()
    })
});

const updateUserSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name cannot be empty').optional(),
        role: z.enum(['owner', 'manager', 'production', 'sales']).optional(),
        pin: z.string().optional()
    })
});

module.exports = {
    createUserSchema,
    updateUserSchema
};
