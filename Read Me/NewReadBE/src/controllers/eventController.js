const asyncHandler = require('express-async-handler');
const Event = require('../models/Event');
const CalendarEvent = require('../models/CalendarEvent');
const EventTemplate = require('../models/EventTemplate');
const User = require('../models/User');
const Department = require('../models/Department');
const Location = require('../models/Location');
const { uploadToS3 } = require('../utils/s3');

// Import validation schemas
const {
  validateCreateEvent,
  validateUpdateEvent,
  validateUpdateEventTask,
  validateApproveEvent,
  validateRejectEvent
} = require('../schemas/eventSchemas');

// Helper function to check conflicts
const checkConflicts = async (organizationId, locationId, startsAt, endsAt, excludeEventId = null) => {
  const query = {
    organization: organizationId,
    locationId,
    status: { $in: ['scheduled', 'in_delivery'] },
    $or: [
      {
        startsAt: { $lt: endsAt },
        endsAt: { $gt: startsAt }
      }
    ]
  };

  if (excludeEventId) {
    query._id = { $ne: excludeEventId };
  }

  return await Event.find(query);
};

// Helper function to create calendar events
const createCalendarEvents = async (event) => {
  try {
    const calendarEvents = [];
    
    // Create calendar event for each attendee
    const attendeeIds = [
      ...event.invitees.map(inv => inv.userId).filter(Boolean),
      ...event.staffStakeholders.map(stakeholder => stakeholder.userId),
      event.leadUserId
    ].filter((id, index, arr) => arr.indexOf(id) === index); // Remove duplicates

    console.log(`Creating calendar events for ${attendeeIds.length} attendees`);

    for (const attendeeId of attendeeIds) {
      try {
        const calendarEvent = new CalendarEvent({
          eventId: event._id,
          title: event.title,
          description: event.description,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.locationText || (event.locationId ? 'TBD' : ''),
          roomId: event.locationId,
          organization: event.organization,
          visibility: 'org',
          attendeeUserIds: [attendeeId],
          source: 'events-module',
          createdBy: event.createdBy
        });

        await calendarEvent.save();
        calendarEvents.push(calendarEvent);
        console.log(`Created calendar event for attendee ${attendeeId}`);
      } catch (error) {
        console.error(`Failed to create calendar event for attendee ${attendeeId}:`, error);
        // Continue with other attendees even if one fails
      }
    }

    // Update event with calendar event IDs
    if (calendarEvents.length > 0) {
      event.calendarEventIds = calendarEvents.map(ce => ce._id);
      await event.save();
      console.log(`Updated event with ${calendarEvents.length} calendar event IDs`);
    }

    return calendarEvents;
  } catch (error) {
    console.error('Error in createCalendarEvents:', error);
    return [];
  }
};

// Helper function to schedule reminders (idempotent)
const scheduleReminders = async (event) => {
  try {
    // Default reminders if none specified
    const defaultReminders = [
      { type: 'email', triggerOffset: 24, recipients: 'attendees' }, // 24 hours before
      { type: 'email', triggerOffset: 2, recipients: 'assignees' },  // 2 hours before
      { type: 'in-app', triggerOffset: 0.5, recipients: 'all' }       // 30 minutes before
    ];

    const baseReminders = (Array.isArray(event.reminders) && event.reminders.length > 0)
      ? event.reminders
      : defaultReminders;

    console.log(`Scheduling ${baseReminders.length} reminders for event ${event._id}`);

    const startsAtMs = (event.startsAt instanceof Date)
      ? event.startsAt.getTime()
      : new Date(event.startsAt).getTime();

    if (isNaN(startsAtMs)) {
      console.error('scheduleReminders: invalid event.startsAt, skipping scheduling');
      return;
    }

    // Prepare new reminders list without duplicating on repeated calls
    const prepared = baseReminders.map((reminder) => {
      // Prefer existing valid triggerAt if present
      const hasValidTriggerAt = reminder.triggerAt && !isNaN(new Date(reminder.triggerAt).getTime());
      const triggerAt = hasValidTriggerAt
        ? new Date(reminder.triggerAt)
        : new Date(startsAtMs - ((Number(reminder.triggerOffset) || 0) * 60 * 60 * 1000));

      return {
        type: reminder.type || 'email',
        triggerAt,
        recipients: reminder.recipients || 'attendees',
        message: reminder.message || `Reminder: ${event.title} starts soon`,
        sent: reminder.sent === true ? true : false,
      };
    })
    // Filter out any invalid dates defensively
    .filter(r => !isNaN(new Date(r.triggerAt).getTime()));

    // De-duplicate by type + triggerAt timestamp
    const seen = new Set();
    const deduped = prepared.filter(r => {
      const key = `${r.type}-${new Date(r.triggerAt).getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Replace reminders atomically to avoid exponential growth
    event.reminders = deduped;
    await event.save();
    deduped.forEach(r => console.log(`Scheduled ${r.type} reminder for ${r.triggerAt}`));
    console.log('Reminders scheduled successfully');
  } catch (error) {
    console.error('Error in scheduleReminders:', error);
  }
};

// GET /api/events - List events with filters
const getEvents = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization._id;
  const queryParams = req.query;
  
  const {
    page = 1,
    limit = 20,
    startDate,
    endDate,
    department,
    status,
    leadUserId,
    search,
    type
  } = queryParams;

  // Build filter
  const filter = { organization: organizationId };

  if (startDate) filter.startsAt = { $gte: new Date(startDate) };
  if (endDate) filter.startsAt = { ...filter.startsAt, $lte: new Date(endDate) };
  if (department) filter.sponsorDeptId = department;
  if (status) filter.status = status;
  if (leadUserId) filter.leadUserId = leadUserId;
  if (type) filter.type = type;
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Execute query
  const skip = (page - 1) * limit;
  const events = await Event.find(filter)
    .populate('leadUserId', 'fullName email')
    .populate('sponsorDeptId', 'name')
    .populate('locationId', 'name')
    .populate('invitees.userId', 'fullName email')
    .populate('staffStakeholders.userId', 'fullName email')
    .sort({ startsAt: 1 })
    .skip(skip)
    .limit(limit);

  const total = await Event.countDocuments(filter);

  res.json({
    events,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

// GET /api/events/:id - Get single event
const getEvent = asyncHandler(async (req, res) => {
  console.log('Fetching event:', req.params.id);
  
  const event = await Event.findById(req.params.id)
    .populate('leadUserId', 'fullName email')
    .populate('sponsorDeptId', 'name')
    .populate('locationId', 'name')
    .populate('invitees.userId', 'fullName email')
    .populate('externalInvitees.userId', 'fullName email')
    .populate('staffStakeholders.userId', 'fullName email')
    .populate('tasks.assignedTo', 'fullName email')
    .populate('approval.approverUserId', 'fullName email')
    .populate('createdBy', 'fullName email')
    .populate('updatedBy', 'fullName email');

  if (!event) {
    console.log('Event not found:', req.params.id);
    return res.status(404).json({ message: 'Event not found' });
  }

  console.log('Event found, checking permissions...');
  console.log('Invitees:', event.invitees.map(inv => ({ userId: inv.userId, fullName: inv.userId?.fullName || 'No name' })));
  console.log('Staff Stakeholders:', event.staffStakeholders.map(stakeholder => ({ userId: stakeholder.userId, fullName: stakeholder.userId?.fullName || 'No name' })));

  // Check if user can view this event
  if (!event.canView(req.user._id, req.user.role)) {
    console.log('Access denied for user:', req.user._id, 'role:', req.user.role);
    return res.status(403).json({ message: 'Access denied' });
  }

  console.log('Event access granted, returning data');
  res.json(event);
});

// POST /api/events - Create new event
const createEvent = asyncHandler(async (req, res) => {
  try {
    console.log('Creating event with data:', JSON.stringify(req.body, null, 2));
    console.log('Files received:', req.files ? req.files.length : 0);
    
    const organizationId = req.user.organization._id;
    const eventData = req.body;

    // Parse JSON fields from FormData
    if (eventData.invitees && typeof eventData.invitees === 'string') {
      eventData.invitees = JSON.parse(eventData.invitees);
    }
    if (eventData.externalInvitees && typeof eventData.externalInvitees === 'string') {
      eventData.externalInvitees = JSON.parse(eventData.externalInvitees);
    }
    if (eventData.staffStakeholders && typeof eventData.staffStakeholders === 'string') {
      eventData.staffStakeholders = JSON.parse(eventData.staffStakeholders);
    }
    if (eventData.toggles && typeof eventData.toggles === 'string') {
      eventData.toggles = JSON.parse(eventData.toggles);
    }

    // Coerce primitive types coming from FormData (which are strings)
    if (eventData.notifyOnCreate !== undefined) {
      if (typeof eventData.notifyOnCreate === 'string') {
        eventData.notifyOnCreate = eventData.notifyOnCreate === 'true';
      }
    }
    if (eventData.expectedAttendees !== undefined && eventData.expectedAttendees !== '') {
      if (typeof eventData.expectedAttendees === 'string') {
        const parsed = Number(eventData.expectedAttendees);
        eventData.expectedAttendees = isNaN(parsed) ? undefined : parsed;
      }
    }
    // Normalize optional ids that may arrive as empty strings
    if (eventData.locationId === '') delete eventData.locationId;
    if (eventData.sponsorDeptId === '') delete eventData.sponsorDeptId;
    if (eventData.templateId === '') delete eventData.templateId;

    // Handle file attachments
    if (req.files && req.files.length > 0) {
      eventData.attachments = req.files.map(file => ({
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer
      }));
    }

    // Validate required fields
    if (!eventData.title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!eventData.startsAt) {
      return res.status(400).json({ message: 'Start date is required' });
    }
    if (!eventData.endsAt) {
      return res.status(400).json({ message: 'End date is required' });
    }

    console.log('Event data validated, checking conflicts...');
  
  // Validate event data
  if (!validateCreateEvent(eventData)) {
    return res.status(400).json({ message: 'Invalid event data' });
  }

  // Check for conflicts
  if (eventData.locationId) {
    console.log('Checking for location conflicts...');
    const conflicts = await checkConflicts(
      organizationId,
      eventData.locationId,
      new Date(eventData.startsAt),
      new Date(eventData.endsAt)
    );

    if (conflicts.length > 0) {
      console.log('Location conflicts found:', conflicts.length);
      return res.status(409).json({
        message: 'Location conflict detected',
        conflicts: conflicts.map(c => ({
          id: c._id,
          title: c.title,
          startsAt: c.startsAt,
          endsAt: c.endsAt
        }))
      });
    }
    console.log('No location conflicts found');
  }

  console.log('Creating event in database...');
  // Create event
  const event = new Event({
    ...eventData,
    organization: organizationId,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  // Set approval status based on user role
  if (req.user.role === 'admin') {
    event.status = 'scheduled';
    event.approval = {
      required: false,
      status: 'approved'
    };
  } else {
    event.status = 'pending_approval';
    event.approval = {
      required: true,
      status: 'pending'
    };
  }

  await event.save();
  console.log('Event saved successfully:', event._id);

  // If admin created and scheduled, create calendar events (simplified for now)
  if (event.status === 'scheduled') {
    console.log('Skipping calendar events and reminders for now to avoid timeout');
    // TODO: Implement calendar events and reminders asynchronously
    // await createCalendarEvents(event);
    // await scheduleReminders(event);
  }

  // Send notifications for staff-created events requiring approval
  if (event.status === 'pending_approval' && event.approval.required) {
    try {
      // Get organization details for email
      let organization;
      if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
        organization = req.user.organization;
      } else {
        const Organization = require('../models/Organization');
        organization = await Organization.findById(organizationId).select('name');
      }
      
      if (organization) {
        // Notify all admins in the SAME organization only - ensure tenant isolation
        const User = require('../models/User');
        const admins = await User.find({ 
          organization: organizationId, 
          role: 'admin', 
          status: { $ne: 'archived' } 
        });
        
        console.log(`Found ${admins.length} admins in organization ${organization.name} (${organizationId})`);
        
        // Create in-app notifications for admins in the same organization
        const notificationService = require('../services/notificationService');
        await Promise.all(admins.map(admin => notificationService.notifyUser({
          userId: admin._id,
          organization: organizationId,
          message: `${req.user.fullName} submitted a new event request.`,
          type: 'event',
          link: '/events/approvals',
          sender: req.user._id
        })));

        // Send SMTP emails to all admins in the same organization only
        if (admins.length > 0) {
          const { sendEventRequestSubmissionEmail } = require('../services/emailService');
          await sendEventRequestSubmissionEmail({
            organization,
            admins,
            submitter: { fullName: req.user.fullName, email: req.user.email },
            event
          });
          console.log(`Event request submission emails sent to ${admins.length} admins`);
        }
      }
    } catch (emailErr) {
      console.error('Failed to send event request submission notifications:', emailErr);
      // Don't fail the event creation if email fails
    }
  }

  // Add audit log
  event.addAuditLog('event_created', req.user._id, 'Event created', eventData);

  // Populate and return
  await event.populate([
    { path: 'leadUserId', select: 'fullName email' },
    { path: 'sponsorDeptId', select: 'name' },
    { path: 'locationId', select: 'name' }
  ]);

  res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Failed to create event', error: error.message });
  }
});

// PUT /api/events/:id - Update event
const updateEvent = asyncHandler(async (req, res) => {
  try {
    console.log('Updating event:', req.params.id);
    const event = await Event.findById(req.params.id);

    if (!event) {
      console.log('Event not found:', req.params.id);
      return res.status(404).json({ message: 'Event not found' });
    }

    // Check permissions
    if (!event.canEdit(req.user._id, req.user.role)) {
      console.log('Access denied for user:', req.user._id, 'role:', req.user.role);
      return res.status(403).json({ message: 'Access denied' });
    }

    const updateData = req.body;
    console.log('Update data:', JSON.stringify(updateData, null, 2));
    
    // Validate update data
    if (!validateUpdateEvent(updateData)) {
      console.log('Validation failed for update data');
      return res.status(400).json({ message: 'Invalid update data' });
    }
  const changes = {};

  // Track changes for audit log
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== event[key]) {
      changes[key] = { from: event[key], to: updateData[key] };
    }
  });

    // Check for conflicts if location/time changed
    if (updateData.locationId || updateData.startsAt || updateData.endsAt) {
      const locationId = updateData.locationId || event.locationId;
      const startsAt = new Date(updateData.startsAt || event.startsAt);
      const endsAt = new Date(updateData.endsAt || event.endsAt);

      console.log('Checking conflicts - Location:', locationId, 'Start:', startsAt, 'End:', endsAt, 'Status:', event.status);

      // Only check for conflicts if we have a location and the event is scheduled
      if (locationId && (event.status === 'scheduled' || event.status === 'in_delivery')) {
        console.log('Running conflict check...');
        const conflicts = await checkConflicts(
          event.organization,
          locationId,
          startsAt,
          endsAt,
          event._id
        );

        console.log('Found conflicts:', conflicts.length);

        if (conflicts.length > 0) {
          console.log('Conflict details:', conflicts.map(c => ({ id: c._id, title: c.title, startsAt: c.startsAt, endsAt: c.endsAt })));
          return res.status(409).json({
            message: 'Location conflict detected',
            conflicts: conflicts.map(c => ({
              id: c._id,
              title: c.title,
              startsAt: c.startsAt,
              endsAt: c.endsAt
            }))
          });
        }
      } else {
        console.log('Skipping conflict check - no location or not scheduled');
      }
    }

    // Update event
    console.log('Updating event in database...');
    Object.assign(event, updateData);
    event.updatedBy = req.user._id;

    await event.save();
    console.log('Event updated successfully');

    // Update calendar events if scheduled
    if (event.status === 'scheduled' && event.calendarEventIds.length > 0) {
      console.log('Updating calendar events...');
      await CalendarEvent.updateMany(
        { _id: { $in: event.calendarEventIds } },
        {
          title: event.title,
          description: event.description,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          location: event.locationText || 'TBD',
          roomId: event.locationId,
          updatedBy: req.user._id
        }
      );
    }

    // Add audit log
    event.addAuditLog('event_updated', req.user._id, 'Event updated', changes);

    // Populate and return
    await event.populate([
      { path: 'leadUserId', select: 'fullName email' },
      { path: 'sponsorDeptId', select: 'name' },
      { path: 'locationId', select: 'name' }
    ]);

    console.log('Event update completed successfully');
    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Failed to update event', error: error.message });
  }
});

// POST /api/events/:id/approve - Approve event (admin only)
const approveEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Check permissions
  if (!event.canApprove(req.user._id, req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (event.approval.status !== 'pending') {
    return res.status(400).json({ message: 'Event is not pending approval' });
  }

  const approvalData = req.body;
  
  // Validate approval data
  if (!validateApproveEvent(approvalData)) {
    return res.status(400).json({ message: 'Invalid approval data' });
  }

  // Approve event
  event.approval.status = 'approved';
  event.approval.approverUserId = req.user._id;
  event.approval.decidedAt = new Date();
  event.approval.notes = approvalData.notes;
  event.status = 'scheduled';
  event.updatedBy = req.user._id;

  await event.save();

  // Create calendar events and schedule reminders with error handling
  try {
    console.log('Creating calendar events and scheduling reminders...');
    await createCalendarEvents(event);
    await scheduleReminders(event);
    console.log('Calendar events and reminders completed successfully');
  } catch (error) {
    console.error('Error creating calendar events or scheduling reminders:', error);
    // Don't fail the approval if calendar/reminders fail
  }

  // Send email notification to the submitter
  try {
    const User = require('../models/User');
    const Organization = require('../models/Organization');
    
    // Get the submitter (createdBy)
    const submitter = await User.findOne({ _id: event.createdBy, organization: event.organization })
      .select('fullName email organization');
    
    // Get organization details
    let organization;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      organization = req.user.organization;
    } else {
      organization = await Organization.findById(event.organization).select('name');
    }
    
    if (submitter && organization) {
      const { sendEventApprovalEmail } = require('../services/emailService');
      await sendEventApprovalEmail({
        organization,
        submitter,
        admin: { fullName: req.user.fullName, email: req.user.email },
        event,
        adminComment: approvalData.notes
      });
      console.log(`Event approval email sent to ${submitter.email}`);
    }
  } catch (emailErr) {
    console.error('Failed to send event approval email:', emailErr);
  }

  // Notify the submitter
  try {
    const notificationService = require('../services/notificationService');
    await notificationService.notifyUser({
      userId: event.createdBy,
      organization: event.organization,
      message: `Your event request "${event.title}" has been approved.`,
      type: 'event',
      link: '/events/my',
      sender: req.user._id
    });
  } catch (notifyErr) {
    console.error('Failed to send event approval notification:', notifyErr);
  }

  // Add audit log
  event.addAuditLog('event_approved', req.user._id, 'Event approved', approvalData);

  res.json({ message: 'Event approved successfully', event });
});

// POST /api/events/:id/reject - Reject event (admin only)
const rejectEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Check permissions
  if (!event.canApprove(req.user._id, req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (event.approval.status !== 'pending') {
    return res.status(400).json({ message: 'Event is not pending approval' });
  }

  const rejectionData = req.body;
  
  // Validate rejection data
  if (!validateRejectEvent(rejectionData)) {
    return res.status(400).json({ message: 'Invalid rejection data' });
  }

  // Reject event
  event.approval.status = 'rejected';
  event.approval.approverUserId = req.user._id;
  event.approval.decidedAt = new Date();
  event.approval.reason = rejectionData.reason;
  event.approval.notes = rejectionData.notes;
  event.status = 'cancelled';
  event.updatedBy = req.user._id;

  await event.save();

  // Send email notification to the submitter
  try {
    const User = require('../models/User');
    const Organization = require('../models/Organization');
    
    // Get the submitter (createdBy)
    const submitter = await User.findOne({ _id: event.createdBy, organization: event.organization })
      .select('fullName email organization');
    
    // Get organization details
    let organization;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      organization = req.user.organization;
    } else {
      organization = await Organization.findById(event.organization).select('name');
    }
    
    if (submitter && organization) {
      const { sendEventRejectionEmail } = require('../services/emailService');
      await sendEventRejectionEmail({
        organization,
        submitter,
        admin: { fullName: req.user.fullName, email: req.user.email },
        event,
        adminComment: rejectionData.reason || rejectionData.notes
      });
      console.log(`Event rejection email sent to ${submitter.email}`);
    }
  } catch (emailErr) {
    console.error('Failed to send event rejection email:', emailErr);
  }

  // Notify the submitter
  try {
    const notificationService = require('../services/notificationService');
    await notificationService.notifyUser({
      userId: event.createdBy,
      organization: event.organization,
      message: `Your event request "${event.title}" has been rejected.`,
      type: 'event',
      link: '/events/my',
      sender: req.user._id
    });
  } catch (notifyErr) {
    console.error('Failed to send event rejection notification:', notifyErr);
  }

  // Add audit log
  event.addAuditLog('event_rejected', req.user._id, 'Event rejected', rejectionData);

  res.json({ message: 'Event rejected', event });
});

// POST /api/events/:id/schedule - Schedule event
const scheduleEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Check permissions
  if (!event.canEdit(req.user._id, req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (event.status !== 'draft') {
    return res.status(400).json({ message: 'Only draft events can be scheduled' });
  }

  // Check for conflicts
  if (event.locationId) {
    const conflicts = await checkConflicts(
      event.organization,
      event.locationId,
      event.startsAt,
      event.endsAt,
      event._id
    );

    if (conflicts.length > 0) {
      return res.status(409).json({
        message: 'Location conflict detected',
        conflicts: conflicts.map(c => ({
          id: c._id,
          title: c.title,
          startsAt: c.startsAt,
          endsAt: c.endsAt
        }))
      });
    }
  }

  // Schedule event
  event.status = 'scheduled';
  event.updatedBy = req.user._id;

  await event.save();

  // Create calendar events and schedule reminders
  await createCalendarEvents(event);
  await scheduleReminders(event);

  // Add audit log
  event.addAuditLog('event_scheduled', req.user._id, 'Event scheduled');

  res.json({ message: 'Event scheduled successfully', event });
});

// POST /api/events/:id/cancel - Cancel event
const cancelEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Check permissions
  if (!event.canEdit(req.user._id, req.user.role)) {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (event.status === 'cancelled') {
    return res.status(400).json({ message: 'Event is already cancelled' });
  }

  // Cancel event
  event.status = 'cancelled';
  event.updatedBy = req.user._id;

  await event.save();

  // Cancel calendar events
  if (event.calendarEventIds.length > 0) {
    await CalendarEvent.updateMany(
      { _id: { $in: event.calendarEventIds } },
      { status: 'cancelled', updatedBy: req.user._id }
    );
  }

  // Add audit log
  event.addAuditLog('event_cancelled', req.user._id, 'Event cancelled');

  res.json({ message: 'Event cancelled successfully', event });
});

// POST /api/events/:id/tasks/:taskId - Update event task
const updateEventTask = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  const taskId = req.params.taskId;
  const task = event.tasks.id(taskId);

  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  // Check permissions - task assignee or admin can update
  if (task.assignedTo && task.assignedTo.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const updateData = req.body;
  
  // Validate task update data
  if (!validateUpdateEventTask(updateData)) {
    return res.status(400).json({ message: 'Invalid task update data' });
  }
  const changes = {};

  // Track changes
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== task[key]) {
      changes[key] = { from: task[key], to: updateData[key] };
    }
  });

  // Update task
  Object.assign(task, updateData);

  // Set completion details
  if (updateData.status === 'completed') {
    task.completedAt = new Date();
    task.completedBy = req.user._id;
  }

  await event.save();

  // Add audit log
  event.addAuditLog('task_updated', req.user._id, `Task "${task.title}" updated`, changes);

  res.json({ message: 'Task updated successfully', task });
});

// GET /api/events/admin/pending - Get events pending approval (admin only)
const getPendingEvents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, department, type, dateFrom, dateTo } = req.query;
  
  // Build query for pending events
  const query = {
    organization: req.user.organization,
    'approval.required': true,
    'approval.status': 'pending',
    status: 'pending_approval'
  };

  // Add search filter
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Add department filter
  if (department) {
    query.sponsorDeptId = department;
  }

  // Add type filter
  if (type) {
    query.type = type;
  }

  // Add date range filter
  if (dateFrom || dateTo) {
    query.startsAt = {};
    if (dateFrom) query.startsAt.$gte = new Date(dateFrom);
    if (dateTo) query.startsAt.$lte = new Date(dateTo);
  }

  const limitNum = parseInt(limit);
  const pageNum = parseInt(page);
  const skip = (pageNum - 1) * limitNum;

  const events = await Event.find(query)
    .populate([
      { path: 'leadUserId', select: 'fullName email profileImage' },
      { path: 'sponsorDeptId', select: 'name' },
      { path: 'locationId', select: 'name address' },
      { path: 'createdBy', select: 'fullName email' },
      { path: 'templateId', select: 'name category' }
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Event.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);
  
  res.json({
    events: events,
    pagination: {
      total: total,
      page: pageNum,
      limit: limitNum,
      pages: totalPages
    }
  });
});

// GET /api/events/admin/approved - Get approved events (admin only)
const getApprovedEvents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, department, type, dateFrom, dateTo } = req.query;
  
  // Build query for approved events
  const query = {
    organization: req.user.organization,
    'approval.status': 'approved',
    status: { $in: ['scheduled', 'in_delivery', 'completed'] }
  };

  // Add search filter
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Add department filter
  if (department) {
    query.sponsorDeptId = department;
  }

  // Add type filter
  if (type) {
    query.type = type;
  }

  // Add date range filter
  if (dateFrom || dateTo) {
    query.startsAt = {};
    if (dateFrom) query.startsAt.$gte = new Date(dateFrom);
    if (dateTo) query.startsAt.$lte = new Date(dateTo);
  }

  const limitNum = parseInt(limit);
  const pageNum = parseInt(page);
  const skip = (pageNum - 1) * limitNum;

  const events = await Event.find(query)
    .populate([
      { path: 'leadUserId', select: 'fullName email profileImage' },
      { path: 'sponsorDeptId', select: 'name' },
      { path: 'locationId', select: 'name address' },
      { path: 'createdBy', select: 'fullName email' },
      { path: 'approval.approverUserId', select: 'fullName email' },
      { path: 'templateId', select: 'name category' }
    ])
    .sort({ startsAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Event.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);
  
  res.json({
    events: events,
    pagination: {
      total: total,
      page: pageNum,
      limit: limitNum,
      pages: totalPages
    }
  });
});

// GET /api/events/my - Get events created by current user
const getMyEvents = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, status, type, dateFrom, dateTo } = req.query;
  
  // Build query for events created by current user
  const query = {
    organization: req.user.organization,
    createdBy: req.user._id
  };

  // Add status filter
  if (status) {
    query.status = status;
  }

  // Add type filter
  if (type) {
    query.type = type;
  }

  // Add search filter
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  // Add date range filter
  if (dateFrom || dateTo) {
    query.startsAt = {};
    if (dateFrom) query.startsAt.$gte = new Date(dateFrom);
    if (dateTo) query.startsAt.$lte = new Date(dateTo);
  }

  const limitNum = parseInt(limit);
  const pageNum = parseInt(page);
  const skip = (pageNum - 1) * limitNum;

  const events = await Event.find(query)
    .populate([
      { path: 'leadUserId', select: 'fullName email profileImage' },
      { path: 'sponsorDeptId', select: 'name' },
      { path: 'locationId', select: 'name address' },
      { path: 'approval.approverUserId', select: 'fullName email' },
      { path: 'templateId', select: 'name category' }
    ])
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum);

  const total = await Event.countDocuments(query);
  const totalPages = Math.ceil(total / limitNum);
  
  res.json({
    events: events,
    pagination: {
      total: total,
      page: pageNum,
      limit: limitNum,
      pages: totalPages
    }
  });
});

module.exports = {
  getEvents,
  getEvent,
  createEvent,
  updateEvent,
  approveEvent,
  rejectEvent,
  scheduleEvent,
  cancelEvent,
  updateEventTask,
  getPendingEvents,
  getApprovedEvents,
  getMyEvents
};