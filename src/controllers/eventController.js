const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const notificationService = require('../services/notificationService');

// Get all events for the organization
const getEvents = asyncHandler(async (req, res) => {
  const events = await Event.find({ organization: req.user.organization })
    .populate('createdBy', 'fullName')
    .sort({ date: 1 });

  res.json(events);
});

// Create a new event
const createEvent = asyncHandler(async (req, res) => {
  const { title, description, start, end, type } = req.body;

  if (!title || !start || !end) {
    return res.status(400).json({ message: 'Title, start, and end are required' });
  }

  const event = await Event.create({
    title,
    description,
    start,
    end,
    type,
    organization: req.user.organization,
    createdBy: req.user._id
  });

  const populatedEvent = await event.populate('createdBy', 'fullName');

  // Notify all users (including custom admins)
  await notificationService.notifyAllUsers({
    organization: req.user.organization,
    message: `${req.user.fullName} created a new calendar event: ${title}`,
    type: 'calendar',
    link: '/admin-calendar',
    sender: req.user._id
  });

  res.status(201).json(populatedEvent);
});

// Update an event
const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, start, end, type } = req.body;

  if (!title || !start || !end) {
    return res.status(400).json({ message: 'Title, start, and end are required' });
  }

  const event = await Event.findOneAndUpdate(
    { _id: id, organization: req.user.organization },
    { title, description, start, end, type },
    { new: true }
  ).populate('createdBy', 'fullName');

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  res.json(event);
});

// Delete an event
const deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const event = await Event.findOneAndDelete({
    _id: id,
    organization: req.user.organization
  });

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  res.json({ message: 'Event deleted successfully' });
});

module.exports = {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent
}; 