const express = require('express');
const router = express.Router();
const { getClients, getClientById, createClient, updateClient, deleteClient } = require('../controller/clientController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createClientSchema, updateClientSchema } = require('../validators/clientValidator');

router.route('/')
    .get(protect, getClients)
    .post(protect, validate(createClientSchema), createClient);

router.route('/:id')
    .get(protect, getClientById)
    .put(protect, validate(updateClientSchema), updateClient)
    .delete(protect, deleteClient);

module.exports = router;
