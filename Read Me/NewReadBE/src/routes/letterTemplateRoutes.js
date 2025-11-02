const express = require('express');
const router = express.Router();
const letterTemplateController = require('../controllers/letterTemplateController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// @route   GET /api/letter-templates
// @desc    Get all letter templates
// @access  Private (Admin with 'view' access, Staff with 'view' access for active templates)
router.get('/', 
  authenticateToken, 
  letterTemplateController.getLetterTemplates
);

// @route   GET /api/letter-templates/placeholders
// @desc    Get available placeholders for templates
// @access  Private (Admin with 'view' access)
router.get('/placeholders', 
  authenticateToken, 
  letterTemplateController.getAvailablePlaceholders
);

// @route   GET /api/letter-templates/:id
// @desc    Get a single letter template by ID
// @access  Private (Admin with 'view' access, Staff with 'view' access for active templates)
router.get('/:id', 
  authenticateToken, 
  letterTemplateController.getLetterTemplateById
);

// @route   POST /api/letter-templates
// @desc    Create a new letter template
// @access  Private (Admin with 'full' access)
router.post('/', 
  authenticateToken, 
  letterTemplateController.createLetterTemplate
);

// @route   PUT /api/letter-templates/:id
// @desc    Update a letter template
// @access  Private (Admin with 'full' access)
router.put('/:id', 
  authenticateToken, 
  letterTemplateController.updateLetterTemplate
);

// @route   DELETE /api/letter-templates/:id
// @desc    Delete a letter template
// @access  Private (Admin with 'full' access)
router.delete('/:id', 
  authenticateToken, 
  letterTemplateController.deleteLetterTemplate
);

// @route   PATCH /api/letter-templates/:id/toggle-status
// @desc    Toggle template active status
// @access  Private (Admin with 'full' access)
router.patch('/:id/toggle-status', 
  authenticateToken, 
  letterTemplateController.toggleTemplateStatus
);

module.exports = router;
