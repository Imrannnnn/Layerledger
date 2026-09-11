const express = require('express');
const router = express.Router();
const {
    getPurchases,
    getPurchaseById,
    createPurchase,
    updatePurchase,
    deletePurchase,
    deleteAllPurchases
} = require('../controller/purchaseController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createPurchaseSchema, updatePurchaseSchema } = require('../validators/purchaseValidator');

router.route('/')
    .get(protect, getPurchases)
    .post(protect, validate(createPurchaseSchema), createPurchase);

// Clear / delete all purchase records (placed before /:id to prevent route shadowing)
router.delete('/all', protect, restrictTo('owner'), deleteAllPurchases);

router.route('/:id')
    .get(protect, getPurchaseById)
    .put(protect, validate(updatePurchaseSchema), updatePurchase)
    .delete(protect, deletePurchase);

module.exports = router;
