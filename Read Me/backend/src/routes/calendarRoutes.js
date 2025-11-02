const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { protect, adminOrAcademicAdmin } = require('../middleware/authMiddleware');

// Admin & Academic Admin: Create event
router.post('/', protect, adminOrAcademicAdmin, calendarController.createEvent);
// Admin & Academic Admin: Update event
router.put('/:id', protect, adminOrAcademicAdmin, calendarController.updateEvent);
// Admin & Academic Admin: Delete event
router.delete('/:id', protect, adminOrAcademicAdmin, calendarController.deleteEvent);
// All: List all events
router.get('/', protect, calendarController.getAllEvents);
// All: Get single event
router.get('/:id', protect, calendarController.getEvent);

module.exports = router; 