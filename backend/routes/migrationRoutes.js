const express = require('express');
const router = express.Router();
const { migrateLegacyData } = require('../controller/migrationController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, migrateLegacyData);

module.exports = router;
