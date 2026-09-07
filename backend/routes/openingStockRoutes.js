const express = require('express');
const router = express.Router();
const {
    getOpeningStock,
    createOpeningStock,
    bulkSyncOpeningStock,
    updateOpeningStock,
    lockMonthOpeningStock,
    deleteOpeningStockItem,
    deleteAllOpeningStock
} = require('../controller/openingStockController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getOpeningStock)
    .post(protect, createOpeningStock)
    .delete(protect, restrictTo('owner'), deleteAllOpeningStock);

router.post('/bulk', protect, bulkSyncOpeningStock);
router.put('/lock', protect, lockMonthOpeningStock);

router.route('/:id')
    .put(protect, updateOpeningStock)
    .delete(protect, deleteOpeningStockItem);

module.exports = router;

