const express = require('express');
const router = express.Router();
const { migrateLegacyData } = require('../controller/migrationController');
const { protect } = require('../middleware/custommiddleware');

router.post('/', protect, migrateLegacyData);

module.exports = router;
