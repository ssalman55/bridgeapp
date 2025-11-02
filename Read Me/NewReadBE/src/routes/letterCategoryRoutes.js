const express = require('express');
const router = express.Router();
const letterCategoryController = require('../controllers/letterCategoryController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// @route   GET /api/letter-categories
// @desc    Get all letter categories
// @access  Private (Admin with 'view' access)
router.get('/', 
  authenticateToken, 
  letterCategoryController.getLetterCategories
);

// @route   GET /api/letter-categories/:id
// @desc    Get a single letter category by ID
// @access  Private (Admin with 'view' access)
router.get('/:id', 
  authenticateToken, 
  letterCategoryController.getLetterCategoryById
);

// @route   POST /api/letter-categories
// @desc    Create a new letter category
// @access  Private (Admin with 'full' access)
router.post('/', 
  authenticateToken, 
  letterCategoryController.createLetterCategory
);

// @route   PUT /api/letter-categories/:id
// @desc    Update a letter category
// @access  Private (Admin with 'full' access)
router.put('/:id', 
  authenticateToken, 
  letterCategoryController.updateLetterCategory
);

// @route   DELETE /api/letter-categories/:id
// @desc    Delete a letter category
// @access  Private (Admin with 'full' access)
router.delete('/:id', 
  authenticateToken, 
  letterCategoryController.deleteLetterCategory
);

// @route   PATCH /api/letter-categories/:id/toggle-status
// @desc    Toggle category active status
// @access  Private (Admin with 'full' access)
router.patch('/:id/toggle-status', 
  authenticateToken, 
  letterCategoryController.toggleCategoryStatus
);

module.exports = router;
