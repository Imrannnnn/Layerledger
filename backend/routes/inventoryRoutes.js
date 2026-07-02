const express = require('express');
const router = express.Router();
const { getInventory, createItem, updateItem, deleteItem } = require('../controller/inventoryController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getInventory)
    .post(protect, createItem);

router.route('/:id')
    .put(protect, updateItem)
    .delete(protect, deleteItem);

module.exports = router;
