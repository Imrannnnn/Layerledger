const express = require('express');
const router = express.Router();
const { getPurchases, getPurchaseById, createPurchase, updatePurchase, deletePurchase } = require('../controller/purchaseController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getPurchases)
    .post(protect, createPurchase);

router.route('/:id')
    .get(protect, getPurchaseById)
    .put(protect, updatePurchase)
    .delete(protect, deletePurchase);

module.exports = router;
