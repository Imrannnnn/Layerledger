const express = require('express');
const router = express.Router();
const { getDecorations, getDecorationById, createDecoration, updateDecoration, deleteDecoration } = require('../controller/decorationController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getDecorations)
    .post(protect, createDecoration);

router.route('/:id')
    .get(protect, getDecorationById)
    .put(protect, updateDecoration)
    .delete(protect, deleteDecoration);

module.exports = router;
