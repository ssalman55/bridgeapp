const CalendarEvent = require('../models/CalendarEvent');
const notificationService = require('../services/notificationService');

// Create event (admin)
exports.createEvent = async (req, res) => {
  try {
    const { title, description, date, time, location } = req.body;
    const event = new CalendarEvent({
      title,
      description,
      date,
      time,
      location,
      createdBy: req.user._id,
      organization: req.user.organization,
    });
    await event.save();
    await notificationService.notifyAllUsers({
      organization: req.user.organization,
      message: `${req.user.fullName} created a new calendar event: ${title}`,
      type: 'calendar',
      link: '/admin-calendar',
      sender: req.user._id
    });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create event', error: err.message });
  }
};

// Update event (admin)
exports.updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, date, time, location } = req.body;
    const event = await CalendarEvent.findByIdAndUpdate(
      id,
      { title, description, date, time, location },
      { new: true }
    );
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update event', error: err.message });
  }
};

// Delete event (admin)
exports.deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await CalendarEvent.findByIdAndDelete(id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete event', error: err.message });
  }
};

// List all events (admin & staff)
exports.getAllEvents = async (req, res) => {
  try {
    const events = await CalendarEvent.find({ organization: req.user.organization }).sort({ date: 1, time: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch events', error: err.message });
  }
};

// Get single event (admin & staff)
exports.getEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await CalendarEvent.findOne({
      _id: id,
      organization: req.user.organization
    });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch event', error: err.message });
  }
}; 