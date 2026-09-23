const { z } = require('zod');

const registerUserSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, 'Name is required'),
        email: z.string().trim().toLowerCase().email('Email is required'),
        password: z.string().min(1, 'Password is required'),
        companyName: z.string().optional(),
        tenantType: z.string().optional()
    })
});

const loginUserSchema = z.object({
    body: z.object({
        email: z.string().trim().toLowerCase().email('Email is required'),
        password: z.string().min(1, 'Password is required')
    })
});

const activateAccountSchema = z.object({
    body: z.object({
        token: z.string().trim().min(1, 'Activation token is required').optional()
    }).optional(),
    query: z.object({
        token: z.string().trim().min(1, 'Activation token is required').optional()
    }).optional()
}).refine(data => !!(data.body?.token || data.query?.token), {
    message: 'Activation token is required'
});

const resendActivationSchema = z.object({
    body: z.object({
        email: z.string().trim().toLowerCase().email('Valid email is required')
    })
});

module.exports = {
    registerUserSchema,
    loginUserSchema,
    activateAccountSchema,
    resendActivationSchema
};
