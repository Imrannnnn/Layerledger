const express = require('express');
const router = express.Router();
const { getClients, getClientById, createClient, updateClient, deleteClient } = require('../controller/clientController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getClients)
    .post(protect, createClient);

router.route('/:id')
    .get(protect, getClientById)
    .put(protect, updateClient)
    .delete(protect, deleteClient);

module.exports = router;
