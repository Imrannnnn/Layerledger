const { z } = require('zod');

const registerUserSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name is required'),
        email: z.string().email('Email is required'),
        password: z.string().min(1, 'Password is required'),
        companyName: z.string().optional(),
        tenantType: z.string().optional()
    })
});

const loginUserSchema = z.object({
    body: z.object({
        email: z.string().email('Email is required'),
        password: z.string().min(1, 'Password is required')
    })
});

module.exports = {
    registerUserSchema,
    loginUserSchema
};
