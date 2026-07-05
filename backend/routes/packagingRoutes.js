const express = require('express');
const router = express.Router();
const { getPackaging, getPackagingById, createPackaging, updatePackaging, deletePackaging } = require('../controller/packagingController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createPackagingSchema, updatePackagingSchema } = require('../validators/packagingValidator');

router.route('/')
    .get(protect, getPackaging)
    .post(protect, validate(createPackagingSchema), createPackaging);

router.route('/:id')
    .get(protect, getPackagingById)
    .put(protect, validate(updatePackagingSchema), updatePackaging)
    .delete(protect, deletePackaging);

module.exports = router;
