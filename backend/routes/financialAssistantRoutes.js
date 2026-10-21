const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
    getAssistantStatus,
    getFinancialOverview,
    chatWithAssistant
} = require('../controller/financialAssistantController');

// All assistant routes require authentication and are restricted to owners
router.use(protect);
router.use(restrictTo('owner'));

// Status and entitlement check
router.get('/status', getAssistantStatus);

// Consolidated overview metrics
router.get('/overview', getFinancialOverview);

// Conversational AI financial chat
router.post('/chat', chatWithAssistant);

module.exports = router;
