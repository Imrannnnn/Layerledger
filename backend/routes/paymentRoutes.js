/**
 * LayerLedger Payment Routes
 * Adheres to Principles:
 * #38 (Authentication + Authorization), #39 (Rate Limiting), #40 (HTTPS endpoints)
 */

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
    initializePayment,
    verifyPayment,
    getPaymentStatus,
    getTenantPayments
} = require('../modules/payments/payment.controller');
const { handlePaystackWebhook } = require('../modules/payments/webhook/webhook.controller');
const { initiateRefund } = require('../modules/payments/refunds/refund.controller');

// Rate limiter for payment initialization and verification (#39)
const paymentActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // up to 100 payment operations per 15 minutes
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many payment requests from this IP, please try again later.' }
});

// Stricter rate limiter for refunds
const refundLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many refund requests, please try again later.' }
});

// Public webhook endpoint - must not have JWT auth (#6, #7, #39)
router.post('/webhook', handlePaystackWebhook);

// Protected payment operations (#38)
router.post('/initialize', protect, paymentActionLimiter, initializePayment);
router.post('/verify', protect, paymentActionLimiter, verifyPayment);
router.post('/refund', protect, restrictTo('owner', 'superadmin'), refundLimiter, initiateRefund);
router.get('/', protect, getTenantPayments);
router.get('/history', protect, getTenantPayments);
router.get('/:reference', protect, getPaymentStatus);

module.exports = router;
