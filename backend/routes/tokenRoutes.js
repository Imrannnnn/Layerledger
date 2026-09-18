const express = require('express');
const router = express.Router();
const { getTokenBalance, getTokenHistory, createTokenTransaction, purchaseCreditPack, refundScanCredits } = require('../controller/tokenController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createTokenTransactionSchema } = require('../validators/tokenValidator');

router.get('/balance', protect, getTokenBalance);
router.get('/history', protect, getTokenHistory);
router.post('/transaction', protect, validate(createTokenTransactionSchema), createTokenTransaction);
router.post('/pack', protect, purchaseCreditPack);
router.post('/refund', protect, refundScanCredits);

module.exports = router;

