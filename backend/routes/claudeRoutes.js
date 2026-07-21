const express = require('express');
const router = express.Router();
const { handleClaudeProxy } = require('../controller/claudeController');
const { protect } = require('../middleware/authMiddleware');

// Protect route so only authenticated users can access the proxy
router.post('/', protect, handleClaudeProxy);

module.exports = router;
