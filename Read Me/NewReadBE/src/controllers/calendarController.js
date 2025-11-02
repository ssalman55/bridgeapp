const asyncHandler = require('express-async-handler');
const CalendarEvent = require('../models/CalendarEvent');
const Event = require('../models/Event');
const User = require('../models/User');
const crypto = require('crypto');

// GET /api/calendar/my - Get user's calendar events
const getMyCalendar = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const organizationId = req.user.organization._id;
  const { startDate, endDate } = req.query;

  let start, end;
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    const now = new Date();
    // Show events from 6 months ago to 6 months ahead to capture more events
    start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 6, 0, 23, 59, 59);
  }

  // Get CalendarEvents (both old and new schema)
  const calendarEvents = await CalendarEvent.find({
    organization: organizationId,
    $or: [
      // New schema: has startsAt field
      { startsAt: { $gte: start, $lte: end } },
      // Old schema: has date field
      { date: { $gte: start, $lte: end } }
    ],
    status: 'active'
  })
    .populate('eventId', 'title description type')
    .sort({ startsAt: 1, date: 1 });

  // Get Events where user is involved
  const events = await Event.find({
    organization: organizationId,
    startsAt: { $gte: start, $lte: end },
    status: { $in: ['draft', 'scheduled', 'in_delivery'] }, // Include draft events
    $or: [
      { leadUserId: userId },
      { 'invitees.userId': userId },
      { 'staffStakeholders.userId': userId }
    ]
  })
    .populate('leadUserId', 'fullName email')
    .populate('sponsorDeptId', 'name')
    .sort({ startsAt: 1 });

  // Combine both types of events
  const allEvents = [
    // CalendarEvents
    ...calendarEvents.map(ce => ({
      id: ce._id,
      title: ce.title,
      description: ce.description,
      startsAt: ce.startsAt || ce.date,
      endsAt: ce.endsAt || (ce.date ? new Date(ce.date.getTime() + 2 * 60 * 60 * 1000) : new Date()),
      location: ce.location,
      source: 'calendar',
      eventId: ce.eventId?._id,
      eventType: ce.eventId?.type
    })),
    // Events
    ...events.map(ev => ({
      id: ev._id,
      title: ev.title,
      description: ev.description,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      location: ev.locationText || (ev.locationId ? 'TBD' : ''),
      source: 'events',
      eventId: ev._id,
      eventType: ev.type
    }))
  ];

  // Sort by startsAt
  allEvents.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  res.json({ events: allEvents, dateRange: { start, end } });
});

// GET /api/calendar/ics/:userId/:token.ics - Generate ICS feed
const generateICSFeed = asyncHandler(async (req, res) => {
  const { userId, token } = req.params;

  const expectedToken = crypto
    .createHash('sha256')
    .update(userId + (process.env.ICS_SECRET || 'default-secret'))
    .digest('hex');

  if (token !== expectedToken) {
    return res.status(401).json({ message: 'Invalid token' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 3);

  const calendarEvents = await CalendarEvent.find({
    organization: user.organization,
    attendeeUserIds: userId,
    startsAt: { $gte: startDate, $lte: endDate },
    status: 'active'
  }).sort({ startsAt: 1 });

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//StaffBridge//Events Module//EN',
    'METHOD:PUBLISH'
  ];

  calendarEvents.forEach(event => {
    const formatDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    icsContent.push(
      'BEGIN:VEVENT',
      `UID:${event.icsUid}`,
      `DTSTART:${formatDate(event.startsAt)}`,
      `DTEND:${formatDate(event.endsAt)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ''}`,
      `LOCATION:${event.location || ''}`,
      `STATUS:${event.status.toUpperCase()}`,
      `SEQUENCE:${event.icsSequence}`,
      `DTSTAMP:${formatDate(new Date())}`,
      'END:VEVENT'
    );
  });

  icsContent.push('END:VCALENDAR');

  const ics = icsContent.join('\r\n');

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="staffbridge-calendar-${userId}.ics"`);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  res.send(ics);
});

// Additional functions needed by existing calendar routes
const createEvent = asyncHandler(async (req, res) => {
  // This function should create calendar events
  // For now, return a placeholder response
  res.status(501).json({ message: 'Calendar event creation not implemented yet' });
});

const updateEvent = asyncHandler(async (req, res) => {
  // This function should update calendar events
  // For now, return a placeholder response
  res.status(501).json({ message: 'Calendar event update not implemented yet' });
});

const deleteEvent = asyncHandler(async (req, res) => {
  // This function should delete calendar events
  // For now, return a placeholder response
  res.status(501).json({ message: 'Calendar event deletion not implemented yet' });
});

const getAllEvents = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization._id;
  const { startDate, endDate } = req.query;

  let start, end;
  if (startDate && endDate) {
    start = new Date(startDate);
    end = new Date(endDate);
  } else {
    const now = new Date();
    // Show events from 6 months ago to 6 months ahead to capture more events
    start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    end = new Date(now.getFullYear(), now.getMonth() + 6, 0, 23, 59, 59);
  }

  // Query for CalendarEvents with both old and new schema
  const calendarEvents = await CalendarEvent.find({
    organization: organizationId,
    $or: [
      // New schema: has startsAt field
      { startsAt: { $gte: start, $lte: end } },
      // Old schema: has date field
      { date: { $gte: start, $lte: end } }
    ],
    status: 'active'
  })
    .populate('eventId', 'title description type')
    .populate('createdBy', 'fullName email')
    .sort({ startsAt: 1, date: 1 });

  // Also get Events that don't have CalendarEvent entries yet
  const events = await Event.find({
    organization: organizationId,
    startsAt: { $gte: start, $lte: end },
    status: { $in: ['draft', 'scheduled', 'in_delivery'] } // Include draft events
  })
    .populate('leadUserId', 'fullName email')
    .populate('sponsorDeptId', 'name')
    .sort({ startsAt: 1 });

  // Combine both types of events
  const allEvents = [
    // CalendarEvents
    ...calendarEvents.map(ce => ({
      id: ce._id,
      title: ce.title,
      description: ce.description,
      startsAt: ce.startsAt || ce.date,
      endsAt: ce.endsAt || (ce.date ? new Date(ce.date.getTime() + 2 * 60 * 60 * 1000) : new Date()),
      location: ce.location,
      source: 'calendar',
      eventId: ce.eventId?._id,
      eventType: ce.eventId?.type,
      createdBy: ce.createdBy
    })),
    // Events
    ...events.map(ev => ({
      id: ev._id,
      title: ev.title,
      description: ev.description,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      location: ev.locationText || (ev.locationId ? 'TBD' : ''),
      source: 'events',
      eventId: ev._id,
      eventType: ev.type,
      createdBy: ev.leadUserId
    }))
  ];

  // Sort by startsAt
  allEvents.sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));

  res.json(allEvents);
});

const getEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user.organization._id;

  const calendarEvent = await CalendarEvent.findOne({
    _id: id,
    organization: organizationId
  })
    .populate('eventId', 'title description type')
    .populate('createdBy', 'fullName email')
    .populate('attendeeUserIds', 'fullName email');

  if (!calendarEvent) {
    return res.status(404).json({ message: 'Calendar event not found' });
  }

  const event = {
    id: calendarEvent._id,
    title: calendarEvent.title,
    description: calendarEvent.description,
    startsAt: calendarEvent.startsAt,
    endsAt: calendarEvent.endsAt,
    location: calendarEvent.location,
    source: 'calendar',
    eventId: calendarEvent.eventId?._id,
    eventType: calendarEvent.eventId?.type,
    createdBy: calendarEvent.createdBy,
    attendees: calendarEvent.attendeeUserIds,
    visibility: calendarEvent.visibility,
    status: calendarEvent.status
  };

  res.json(event);
});

module.exports = {
  getMyCalendar,
  generateICSFeed,
  createEvent,
  updateEvent,
  deleteEvent,
  getAllEvents,
  getEvent
};