const express = require('express');
const router = express.Router();
const { getExpenses, createExpense, updateExpense, deleteExpense } = require('../controller/expenseController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createExpenseSchema, updateExpenseSchema } = require('../validators/expenseValidator');

router.route('/')
    .get(protect, restrictTo('owner'), getExpenses)
    .post(protect, restrictTo('owner'), validate(createExpenseSchema), createExpense);

router.route('/:id')
    .put(protect, restrictTo('owner'), validate(updateExpenseSchema), updateExpense)
    .delete(protect, restrictTo('owner'), deleteExpense);

module.exports = router;
