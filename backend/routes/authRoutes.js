const express = require('express');
const router = express.Router();
const { registerUser, loginUser, activateUser, resendActivation } = require('../controller/authController');
const { validate } = require('../middleware/validationMiddleware');
const {
    registerUserSchema,
    loginUserSchema,
    activateAccountSchema,
    resendActivationSchema
} = require('../validators/authValidator');

router.post('/register', validate(registerUserSchema), registerUser);
router.post('/login', validate(loginUserSchema), loginUser);
router.post('/activate', validate(activateAccountSchema), activateUser);
router.get('/activate', validate(activateAccountSchema), activateUser);
router.post('/resend-activation', validate(resendActivationSchema), resendActivation);

module.exports = router;
