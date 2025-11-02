const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/auth');

// Create payment intent
router.post('/create-payment-intent', authenticateToken, paymentController.createPaymentIntent);

// Confirm payment
router.post('/confirm-payment', authenticateToken, paymentController.confirmPayment);

// Handle webhooks (no authentication required for webhooks)
router.post('/webhooks/airwallex', paymentController.handleWebhook);

// Get supported payment methods
router.get('/payment-methods/:organizationId', authenticateToken, paymentController.getPaymentMethods);

module.exports = router; 