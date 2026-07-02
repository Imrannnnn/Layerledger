const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controller/expenseController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, restrictTo('owner'), getExpenses)
    .post(protect, restrictTo('owner'), createExpense);

router.route('/:id')
    .put(protect, restrictTo('owner'), updateExpense)
    .delete(protect, restrictTo('owner'), deleteExpense);

module.exports = router;
