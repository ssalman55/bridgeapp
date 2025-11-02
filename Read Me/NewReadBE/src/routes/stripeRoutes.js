const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const { authenticateToken } = require('../middleware/auth');

// Create payment intent
router.post('/create-payment-intent', authenticateToken, stripeController.createPaymentIntent);
// Confirm payment (optional)
router.post('/confirm-payment', authenticateToken, stripeController.confirmPayment);
// Stripe webhook (no auth, must pass ?ownerId=...)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeController.handleWebhook);

module.exports = router; 