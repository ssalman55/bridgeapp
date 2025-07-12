const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent
} = require('../controllers/eventController');

router.get('/', protect, getEvents);
router.post('/', protect, createEvent);
router.put('/:id', protect, updateEvent);
router.delete('/:id', protect, deleteEvent);

module.exports = router; 