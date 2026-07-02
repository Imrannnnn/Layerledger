const express = require('express');
const router = express.Router();
const { getOrders, getOrderById, createOrder, updateOrder, deleteOrder } = require('../controller/orderController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getOrders)
    .post(protect, createOrder);

router.route('/:id')
    .get(protect, getOrderById)
    .put(protect, updateOrder)
    .delete(protect, deleteOrder);

module.exports = router;
