const express = require('express');
const router = express.Router();
const {
    getTenantDetails,
    updateTenantDetails,
    clearAllTenantData,
    getTenantBootstrap,
    getTenantPricing,
    updateTenantPricing,
    resetTenantPricing
} = require('../controller/tenantController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { updateTenantSchema } = require('../validators/tenantValidator');

router.get('/bootstrap', protect, getTenantBootstrap);

router.route('/pricing')
    .get(protect, getTenantPricing)
    .put(protect, restrictTo('owner'), updateTenantPricing);

router.post('/pricing/reset', protect, restrictTo('owner'), resetTenantPricing);

router.route('/')
    .get(protect, getTenantDetails)
    .put(protect, restrictTo('owner'), validate(updateTenantSchema), updateTenantDetails);

router.delete('/data', protect, restrictTo('owner'), clearAllTenantData);

module.exports = router;


