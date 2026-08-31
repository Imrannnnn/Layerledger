const express = require('express');
const router = express.Router();
const {
    getInventory,
    createItem,
    updateItem,
    deleteItem,
    adjustItem,
    deleteAllInventory,
    deleteOpeningStock
} = require('../controller/inventoryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createInventorySchema, updateInventorySchema } = require('../validators/inventoryValidator');

router.route('/')
    .get(protect, getInventory)
    .post(protect, validate(createInventorySchema), createItem);

// Bulk delete operations (placed before /:id to prevent route shadowing)
router.delete('/all', protect, restrictTo('owner'), deleteAllInventory);
router.delete('/opening-stock', protect, restrictTo('owner'), deleteOpeningStock);

router.route('/:id')
    .put(protect, validate(updateInventorySchema), updateItem)
    .delete(protect, deleteItem);

router.route('/:id/adjust')
    .post(protect, adjustItem);

module.exports = router;

