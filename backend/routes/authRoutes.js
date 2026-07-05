const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controller/authController');
const { validate } = require('../middleware/validationMiddleware');
const { registerUserSchema, loginUserSchema } = require('../validators/authValidator');

router.post('/register', validate(registerUserSchema), registerUser);
router.post('/login', validate(loginUserSchema), loginUser);

module.exports = router;
