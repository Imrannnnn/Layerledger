const express = require('express');
const router = express.Router();
const { getRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe } = require('../controller/recipeController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getRecipes)
    .post(protect, createRecipe);

router.route('/:id')
    .get(protect, getRecipeById)
    .put(protect, updateRecipe)
    .delete(protect, deleteRecipe);

module.exports = router;
