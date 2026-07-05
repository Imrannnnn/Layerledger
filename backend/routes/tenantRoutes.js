const express = require('express');
const router = express.Router();
const { getTenantDetails, updateTenantDetails } = require('../controller/tenantController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { updateTenantSchema } = require('../validators/tenantValidator');

router.route('/')
    .get(protect, getTenantDetails)
    .put(protect, restrictTo('owner'), validate(updateTenantSchema), updateTenantDetails);

module.exports = router;
