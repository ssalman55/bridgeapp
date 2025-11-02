const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(protect);

// Apply subscription middleware to all calendar routes
router.use(checkSubscriptionStatus);

// Create event (authentication and subscription already applied)
router.post('/', permissions('Communication', 'full', 'Calendar'), calendarController.createEvent);
// Update event
router.put('/:id', permissions('Communication', 'full', 'Calendar'), calendarController.updateEvent);
// Delete event
router.delete('/:id', permissions('Communication', 'full', 'Calendar'), calendarController.deleteEvent);
// List all events
router.get('/', permissions('Communication', 'view', 'Calendar'), calendarController.getAllEvents);
// Get single event
router.get('/:id', permissions('Communication', 'view', 'Calendar'), calendarController.getEvent);

module.exports = router; 