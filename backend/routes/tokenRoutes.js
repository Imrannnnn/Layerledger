const express = require('express');
const router = express.Router();
const { getTokenBalance, getTokenHistory, createTokenTransaction } = require('../controller/tokenController');
const { protect } = require('../middleware/authMiddleware');

router.get('/balance', protect, getTokenBalance);
router.get('/history', protect, getTokenHistory);
router.post('/transaction', protect, createTokenTransaction);

module.exports = router;
