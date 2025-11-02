const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

/**
 * Contact Sales Routes
 * Public routes for handling contact form submissions
 */

// Submit contact sales form
router.post('/contact-sales', contactController.submitContactSales);

// Health check
router.get('/health', contactController.healthCheck);

module.exports = router;
