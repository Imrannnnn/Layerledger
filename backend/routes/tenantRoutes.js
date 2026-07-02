const express = require('express');
const router = express.Router();
const { getTenantDetails, updateTenantDetails } = require('../controller/tenantController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getTenantDetails)
    .put(protect, restrictTo('owner'), updateTenantDetails);

module.exports = router;
