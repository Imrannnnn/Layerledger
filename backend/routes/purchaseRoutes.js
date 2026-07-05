const express = require('express');
const router = express.Router();
const { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase } = require('../controller/purchaseController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createPurchaseSchema, updatePurchaseSchema } = require('../validators/purchaseValidator');

router.route('/')
    .get(protect, getPurchases)
    .post(protect, validate(createPurchaseSchema), createPurchase);

router.route('/:id')
    .get(protect, getPurchaseById)
    .put(protect, validate(updatePurchaseSchema), updatePurchase)
    .delete(protect, deletePurchase);

module.exports = router;
