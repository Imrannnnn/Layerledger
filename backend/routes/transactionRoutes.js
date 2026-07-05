const express = require('express');
const router = express.Router();
const { getTransactions, createTransaction, updateTransaction, deleteTransaction } = require('../controller/transactionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createTransactionSchema, updateTransactionSchema } = require('../validators/transactionValidator');

router.route('/')
    .get(protect, restrictTo('owner'), getTransactions)
    .post(protect, restrictTo('owner'), validate(createTransactionSchema), createTransaction);

router.route('/:id')
    .put(protect, restrictTo('owner'), validate(updateTransactionSchema), updateTransaction)
    .delete(protect, restrictTo('owner'), deleteTransaction);

module.exports = router;
