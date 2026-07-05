const express = require('express');
const router = express.Router();
const { getDecorations, getDecorationById, createDecoration, updateDecoration, deleteDecoration } = require('../controller/decorationController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createDecorationSchema, updateDecorationSchema } = require('../validators/decorationValidator');

router.route('/')
    .get(protect, getDecorations)
    .post(protect, validate(createDecorationSchema), createDecoration);

router.route('/:id')
    .get(protect, getDecorationById)
    .put(protect, validate(updateDecorationSchema), updateDecoration)
    .delete(protect, deleteDecoration);

module.exports = router;
