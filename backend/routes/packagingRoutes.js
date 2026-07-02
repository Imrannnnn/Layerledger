const express = require('express');
const router = express.Router();
const { getPackaging, getPackagingById, createPackaging, updatePackaging, deletePackaging } = require('../controller/packagingController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getPackaging)
    .post(protect, createPackaging);

router.route('/:id')
    .get(protect, getPackagingById)
    .put(protect, updatePackaging)
    .delete(protect, deletePackaging);

module.exports = router;
