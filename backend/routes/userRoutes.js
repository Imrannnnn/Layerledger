const express = require('express');
const router = express.Router();
const { getUsers, getUserById, createUser, updateUser, deleteUser } = require('../controller/userController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, restrictTo('owner'), getUsers)
    .post(protect, restrictTo('owner'), createUser);

router.route('/:id')
    .get(protect, getUserById)
    .put(protect, updateUser)
    .delete(protect, restrictTo('owner'), deleteUser);

module.exports = router;
