const express = require('express');
const router = express.Router();
const { getRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe } = require('../controller/recipeController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const { createRecipeSchema, updateRecipeSchema } = require('../validators/recipeValidator');

router.route('/')
    .get(protect, getRecipes)
    .post(protect, validate(createRecipeSchema), createRecipe);

router.route('/:id')
    .get(protect, getRecipeById)
    .put(protect, validate(updateRecipeSchema), updateRecipe)
    .delete(protect, deleteRecipe);

module.exports = router;
