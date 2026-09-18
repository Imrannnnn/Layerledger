const express = require('express');
const router = express.Router();
const { getCurrentPlanAndUsage, purchasePlan, claimFreeScans } = require('../controller/planController');
const { protect } = require('../middleware/authMiddleware');

router.get('/current', protect, getCurrentPlanAndUsage);
router.post('/purchase', protect, purchasePlan);
router.post('/claim-free', protect, claimFreeScans);

module.exports = router;
