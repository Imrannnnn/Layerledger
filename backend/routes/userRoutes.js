const express = require('express');
const router = express.Router();
const { getUsers, getUserById, createUser, updateUser, deleteUser } = require('../controller/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createUserSchema, updateUserSchema } = require('../validators/userValidator');

router.route('/')
    .get(protect, restrictTo('owner'), getUsers)
    .post(protect, restrictTo('owner'), validate(createUserSchema), createUser);

router.route('/:id')
    .get(protect, getUserById)
    .put(protect, validate(updateUserSchema), updateUser)
    .delete(protect, restrictTo('owner'), deleteUser);

module.exports = router;
