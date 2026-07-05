const express = require('express');
const router = express.Router();
const { getInventory, createItem, updateItem, deleteItem } = require('../controller/inventoryController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createInventorySchema, updateInventorySchema } = require('../validators/inventoryValidator');

router.route('/')
    .get(protect, getInventory)
    .post(protect, validate(createInventorySchema), createItem);

router.route('/:id')
    .put(protect, validate(updateInventorySchema), updateItem)
    .delete(protect, deleteItem);

module.exports = router;
