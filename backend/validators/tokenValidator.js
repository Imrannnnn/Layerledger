const { z } = require('zod');

const createTokenTransactionSchema = z.object({
    body: z.object({
        amount: z.union([z.number(), z.string()]).transform(val => parseFloat(val)).refine(val => !isNaN(val), 'Valid amount is required'),
        type: z.string().trim().min(1, 'Type is required'),
        description: z.string().trim().min(1, 'Description is required')
    })
});

module.exports = {
    createTokenTransactionSchema
};
