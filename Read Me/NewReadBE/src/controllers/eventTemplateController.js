const asyncHandler = require('express-async-handler');
const EventTemplate = require('../models/EventTemplate');
const Event = require('../models/Event');

// GET /api/events/templates - List event templates
const getEventTemplates = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization._id;
  const { category, search } = req.query;

  const filter = {
    organization: organizationId,
    isActive: true
  };

  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  const templates = await EventTemplate.find(filter)
    .populate('createdBy', 'fullName email')
    .sort({ usageCount: -1, name: 1 });

  res.json({ templates });
});

// GET /api/events/templates/:id - Get single template
const getEventTemplate = asyncHandler(async (req, res) => {
  const template = await EventTemplate.findById(req.params.id)
    .populate('createdBy', 'fullName email')
    .populate('updatedBy', 'fullName email');

  if (!template) {
    return res.status(404).json({ message: 'Template not found' });
  }

  // Check if user can view this template
  if (template.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json(template);
});

// POST /api/events/templates - Create new template
const createEventTemplate = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization._id;
  const templateData = req.body;

  const template = new EventTemplate({
    ...templateData,
    organization: organizationId,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  await template.save();

  await template.populate('createdBy', 'fullName email');

  res.status(201).json(template);
});

// PUT /api/events/templates/:id - Update template
const updateEventTemplate = asyncHandler(async (req, res) => {
  const template = await EventTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({ message: 'Template not found' });
  }

  // Check permissions
  if (template.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (template.isSystem && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'System templates cannot be modified' });
  }

  const updateData = req.body;

  Object.assign(template, updateData);
  template.updatedBy = req.user._id;

  await template.save();

  await template.populate('updatedBy', 'fullName email');

  res.json(template);
});

// DELETE /api/events/templates/:id - Delete template
const deleteEventTemplate = asyncHandler(async (req, res) => {
  const template = await EventTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({ message: 'Template not found' });
  }

  // Check permissions
  if (template.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (template.isSystem) {
    return res.status(403).json({ message: 'System templates cannot be deleted' });
  }

  // Soft delete
  template.isActive = false;
  template.updatedBy = req.user._id;

  await template.save();

  res.json({ message: 'Template deleted successfully' });
});

// POST /api/events/templates/:id/use - Use template to create event
const useEventTemplate = asyncHandler(async (req, res) => {
  const template = await EventTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({ message: 'Template not found' });
  }

  // Check permissions
  if (template.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  if (!template.isActive) {
    return res.status(400).json({ message: 'Template is not active' });
  }

  const { eventData } = req.body;

  if (!eventData) {
    return res.status(400).json({ message: 'Event data is required' });
  }

  // Generate event data from template
  const generatedData = template.generateEventData(eventData);

  // Increment usage count
  await template.incrementUsage();

  res.json({
    message: 'Template applied successfully',
    generatedData,
    template: {
      id: template._id,
      name: template.name,
      category: template.category
    }
  });
});

// GET /api/events/templates/categories - Get template categories
const getTemplateCategories = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization._id;

  const categories = await EventTemplate.aggregate([
    { $match: { organization: organizationId, isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } }
  ]);

  res.json({ categories });
});

// GET /api/events/templates/popular - Get popular templates
const getPopularTemplates = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization._id;
  const limit = parseInt(req.query.limit) || 5;

  const templates = await EventTemplate.getPopular(organizationId, limit);

  res.json({ templates });
});

// POST /api/events/templates/:id/duplicate - Duplicate template
const duplicateEventTemplate = asyncHandler(async (req, res) => {
  const template = await EventTemplate.findById(req.params.id);

  if (!template) {
    return res.status(404).json({ message: 'Template not found' });
  }

  // Check permissions
  if (template.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Create duplicate
  const duplicateData = template.toObject();
  delete duplicateData._id;
  delete duplicateData.createdAt;
  delete duplicateData.updatedAt;
  delete duplicateData.usageCount;
  delete duplicateData.lastUsed;

  duplicateData.name = `${template.name} (Copy)`;
  duplicateData.createdBy = req.user._id;
  duplicateData.updatedBy = req.user._id;

  const duplicate = new EventTemplate(duplicateData);
  await duplicate.save();

  await duplicate.populate('createdBy', 'fullName email');

  res.status(201).json(duplicate);
});

// POST /api/events/templates/from-event - Create template from event
const createTemplateFromEvent = asyncHandler(async (req, res) => {
  try {
    const { eventId, templateData } = req.body;
  
  if (!eventId) {
    return res.status(400).json({ message: 'Event ID is required' });
  }

  // Get the event
  const Event = require('../models/Event');
  const event = await Event.findById(eventId);
  
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Check permissions
  if (event.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  // Only admin users can create templates
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admin users can create templates' });
  }

  // Calculate duration in minutes
  const duration = Math.round((new Date(event.endsAt) - new Date(event.startsAt)) / (1000 * 60));

  console.log('Creating template from event:', event.title);
  console.log('Event reminders:', event.reminders);
  console.log('Event tasks:', event.tasks);
  console.log('Event checklist:', event.checklist);

  // Create template data from event
  const template = new EventTemplate({
    name: templateData.name || `${event.title} Template`,
    description: templateData.description || event.description || '',
    category: templateData.category || 'Other',
    organization: req.user.organization._id,
    defaultToggles: event.toggles || {
      refreshments: false,
      equipment: false,
      facilities: false,
      security: false,
      av: false
    },
    defaultDuration: duration,
    defaultAttendanceMode: event.attendanceMode || 'in-person',
    tasks: event.tasks ? event.tasks.map(task => ({
      title: task.title,
      description: task.description,
      area: task.area || 'General',
      assignedRole: task.assignedRole,
      dueDateOffset: task.dueDateOffset || 1,
      priority: task.priority || 'medium',
      isRequired: task.isRequired !== false,
      conditionalOn: task.conditionalOn
    })) : [],
    checklist: event.checklist ? event.checklist.map(item => ({
      title: item.title,
      description: item.description,
      dueDateOffset: item.dueDateOffset || 0,
      isRequired: item.isRequired !== false,
      conditionalOn: item.conditionalOn
    })) : [],
    reminders: event.reminders ? event.reminders.map(reminder => ({
      type: reminder.type || 'email',
      triggerOffset: reminder.triggerOffset || 24, // Default to 24 hours if not specified
      recipients: reminder.recipients || 'attendees',
      message: reminder.message,
      isDefault: reminder.isDefault !== false
    })) : [],
    defaultNotes: event.notes || '',
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  await template.save();
  await template.populate('createdBy', 'fullName email');

  console.log('Template created successfully:', template.name);

  res.status(201).json({
    message: 'Template created successfully from event',
    template
  });
  } catch (error) {
    console.error('Error creating template from event:', error);
    res.status(500).json({ 
      message: 'Failed to create template', 
      error: error.message 
    });
  }
});

module.exports = {
  getEventTemplates,
  getEventTemplate,
  createEventTemplate,
  createTemplateFromEvent,
  updateEventTemplate,
  deleteEventTemplate,
  useEventTemplate,
  getTemplateCategories,
  getPopularTemplates,
  duplicateEventTemplate
};
