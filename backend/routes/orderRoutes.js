const express = require('express');
const router = express.Router();
const { getOrders, getOrderById, createOrder, updateOrder, deleteOrder } = require('../controller/orderController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createOrderSchema, updateOrderSchema } = require('../validators/orderValidator');

router.route('/')
    .get(protect, getOrders)
    .post(protect, validate(createOrderSchema), createOrder);

router.route('/:id')
    .get(protect, getOrderById)
    .put(protect, validate(updateOrderSchema), updateOrder)
    .delete(protect, deleteOrder);

module.exports = router;
