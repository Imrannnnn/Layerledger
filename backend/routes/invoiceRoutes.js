const express = require('express');
const router = express.Router();
const { getInvoices, createInvoice, updateInvoice, deleteInvoice } = require('../controller/invoiceController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createInvoiceSchema, updateInvoiceSchema } = require('../validators/invoiceValidator');

router.route('/')
    .get(protect, getInvoices)
    .post(protect, validate(createInvoiceSchema), createInvoice);

router.route('/:id')
    .put(protect, validate(updateInvoiceSchema), updateInvoice)
    .delete(protect, deleteInvoice);

module.exports = router;
