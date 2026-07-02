const express = require('express');
const router = express.Router();
const { getTransactions, createTransaction, updateTransaction, deleteTransaction } = require('../controller/transactionController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, restrictTo('owner'), getTransactions)
    .post(protect, restrictTo('owner'), createTransaction);

router.route('/:id')
    .put(protect, restrictTo('owner'), updateTransaction)
    .delete(protect, restrictTo('owner'), deleteTransaction);

module.exports = router;
