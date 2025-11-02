const HelpdeskTicket = require('../models/HelpdeskTicket');
const HelpdeskCategory = require('../models/HelpdeskCategory');
const KnowledgeArticle = require('../models/KnowledgeArticle');
const User = require('../models/User');
const Role = require('../models/Role');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');

// Helper function to check if user has full access to Helpdesk
exports.hasFullHelpdeskAccess = async function hasFullHelpdeskAccess(user, organizationId) {
  // Admin always has full access
  if (user.role && user.role.toLowerCase() === 'admin') return true;
  
  // Check if custom role has full helpdesk access
  try {
    const organizationIdObj = organizationId && typeof organizationId === 'object' && organizationId._id
      ? organizationId._id
      : organizationId;
    
    const roleDoc = await Role.findOne({ 
      name: new RegExp('^' + user.role + '$', 'i'),
      organization: organizationIdObj 
    });
    
    if (roleDoc && roleDoc.permissions) {
      let helpdeskPerms;
      if (roleDoc.permissions instanceof Map) {
        helpdeskPerms = roleDoc.permissions.get('Helpdesk');
      } else if (typeof roleDoc.permissions === 'object') {
        helpdeskPerms = roleDoc.permissions['Helpdesk'];
      }
      
      // Check if all pages have 'full' access
      if (helpdeskPerms && typeof helpdeskPerms === 'object') {
        const levels = ['none', 'view', 'full'];
        if (helpdeskPerms instanceof Map) {
          for (let [pageName, perm] of helpdeskPerms) {
            if (levels.indexOf(perm) === 2) return true; // Found at least one 'full'
          }
        } else {
          for (let pageName in helpdeskPerms) {
            if (levels.indexOf(helpdeskPerms[pageName]) === 2) return true; // Found at least one 'full'
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking full helpdesk access:', error);
  }
  
  return false;
}

// Get all tickets with filtering and pagination
exports.getTickets = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      priority, 
      category, 
      assignedTo, 
      requester,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    let filter = { organization: organizationId };

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (requester) filter.requester = requester;

    // Search functionality
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { ticketNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Role-based filtering
    const hasFullAccess = await exports.hasFullHelpdeskAccess(req.user, organizationId);
    
    if (!hasFullAccess) {
      // Staff users can only see their own tickets
      if (req.user.role === 'staff') {
        filter.requester = req.user._id;
      } else {
        // Department users can see tickets in their categories
        const userCategories = await HelpdeskCategory.find({
          organization: organizationId,
          $or: [
            { assignedRoles: req.user.role },
            { assignedUsers: req.user._id }
          ]
        }).select('_id');
        
        filter.category = { $in: userCategories.map(cat => cat._id) };
      }
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await HelpdeskTicket.countDocuments(filter);

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get tickets
    const tickets = await HelpdeskTicket.find(filter)
      .populate('category', 'name color icon')
      .populate('requester', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName')
      .populate('comments.author', 'fullName email')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    res.json({
      tickets,
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ message: 'Failed to fetch tickets', error: error.message });
  }
};

// Get single ticket
exports.getTicket = async (req, res) => {
  try {
    const ticket = await HelpdeskTicket.findById(req.params.id)
      .populate('category', 'name color icon priorityRules')
      .populate('requester', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName')
      .populate('comments.author', 'fullName email')
      .populate('activityLog.performedBy', 'fullName email')
      .populate('suggestedArticles', 'title summary');

    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check access permissions
    if (!ticket.canView(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ message: 'Failed to fetch ticket', error: error.message });
  }
};

// Create new ticket
exports.createTicket = async (req, res) => {
  try {
    console.log('=== TICKET CREATION DEBUG ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);
    console.log('Organization ID:', req.user.organization);
    console.log('Files:', req.files);
    
    const organizationId = req.user.organization._id || req.user.organization;
    const {
      title,
      description,
      category,
      subcategory,
      priority,
      tags
    } = req.body;

    // Parse tags if it's a JSON string
    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
      } catch (error) {
        console.log('Error parsing tags:', error);
        parsedTags = [];
      }
    }

    console.log('Extracted data:', { title, description, category, subcategory, priority });

    // Validate required fields
    if (!title || !description || !category) {
      console.log('Validation failed - missing required fields:', { title: !!title, description: !!description, category: !!category });
      return res.status(400).json({ 
        message: 'Title, description, and category are required' 
      });
    }

    // Process file attachments and upload to S3
    const { uploadToS3 } = require('../utils/s3');
    const processedAttachments = [];
    
    if (req.files && req.files.length > 0) {
      console.log('Processing attachments:', req.files.length);
      
      for (const file of req.files) {
        try {
          console.log('Uploading file to S3:', file.originalname);
          const fileUrl = await uploadToS3(file, 'helpdesk-attachments');
          
          processedAttachments.push({
            filename: file.originalname,
            originalName: file.originalname,
            url: fileUrl,
            size: file.size,
            mimeType: file.mimetype,
            uploadedBy: req.user._id
          });
          
          console.log('File uploaded successfully:', fileUrl);
        } catch (uploadError) {
          console.error('Error uploading file to S3:', uploadError);
          return res.status(500).json({ 
            message: 'Failed to upload attachment', 
            error: uploadError.message 
          });
        }
      }
    }

    // Get category details
    console.log('Creating ticket with category:', category, 'organization:', organizationId);
    const categoryDoc = await HelpdeskCategory.findById(category);
    console.log('Found category:', categoryDoc);
    
    if (!categoryDoc || categoryDoc.organization.toString() !== organizationId.toString()) {
      console.log('Category validation failed:', {
        categoryDoc: !!categoryDoc,
        categoryOrg: categoryDoc?.organization?.toString(),
        userOrg: organizationId.toString(),
        match: categoryDoc?.organization?.toString() === organizationId.toString()
      });
      return res.status(400).json({ message: 'Invalid category' });
    }

    // Create ticket
    const ticket = new HelpdeskTicket({
      title,
      description,
      category,
      subcategory,
      priority: priority || categoryDoc.defaultPriority,
      requester: req.user._id,
      organization: organizationId,
      attachments: processedAttachments,
      tags: parsedTags,
      createdBy: req.user._id
    });

    // Auto-assign based on category rules
    const autoAssignee = categoryDoc.getAutoAssignee();
    if (autoAssignee) {
      if (autoAssignee.type === 'user') {
        ticket.assignedTo = autoAssignee.id;
      } else if (autoAssignee.type === 'role') {
        ticket.assignedRole = autoAssignee.role;
        // Find a user with this role to assign
        const assignee = await User.findOne({
          organization: organizationId,
          role: autoAssignee.role
        });
        if (assignee) {
          ticket.assignedTo = assignee._id;
        }
      }
    }

    // Manually generate ticket number if not set
    if (!ticket.ticketNumber) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.random().toString(36).substr(2, 3).toUpperCase();
      ticket.ticketNumber = `HD-${timestamp}-${random}`;
      console.log('Manually generated ticket number:', ticket.ticketNumber);
    }

    try {
      console.log('About to save ticket, ticketNumber before save:', ticket.ticketNumber);
      await ticket.save();
      console.log('Ticket saved successfully:', ticket.ticketNumber);
    } catch (saveError) {
      console.error('Error saving ticket:', saveError);
      return res.status(400).json({ 
        message: 'Failed to create ticket', 
        error: saveError.message 
      });
    }

    // Populate the saved ticket
    try {
      await ticket.populate([
        { path: 'category', select: 'name color icon' },
        { path: 'requester', select: 'fullName email' },
        { path: 'assignedTo', select: 'fullName email' }
      ]);
    } catch (populateError) {
      console.error('Error populating ticket:', populateError);
    }

    // Add to activity log
    ticket.activityLog.push({
      action: 'created',
      details: 'Ticket created',
      performedBy: req.user._id
    });

    if (ticket.assignedTo) {
      ticket.activityLog.push({
        action: 'assigned',
        details: `Auto-assigned to ${ticket.assignedTo.fullName}`,
        newValue: ticket.assignedTo._id.toString(),
        performedBy: req.user._id
      });
    }

    try {
      await ticket.save();
      console.log('Ticket updated with activity log');
    } catch (updateError) {
      console.error('Error updating ticket with activity log:', updateError);
    }

    // Send notifications and emails
    const assignedUsers = [];
    
    // Notify assigned user if any
    if (ticket.assignedTo) {
      assignedUsers.push(ticket.assignedTo);
      
      // Notify assignee
      await notificationService.notifyUser({
        userId: ticket.assignedTo._id,
        organization: organizationId,
        message: `New ticket assigned: ${ticket.title}`,
        type: 'helpdesk',
        link: `/helpdesk/tickets/${ticket._id}`,
        sender: req.user._id
      });

      // Send email notification
      await emailService.sendTicketAssignmentEmail({
        ticket,
        assignee: ticket.assignedTo,
        requester: ticket.requester
      });
    }

    // Notify users assigned to the category
    if (categoryDoc.assignedUsers && categoryDoc.assignedUsers.length > 0) {
      for (const userId of categoryDoc.assignedUsers) {
        if (userId.toString() !== ticket.assignedTo?._id?.toString()) {
          const user = await User.findById(userId);
          if (user) {
            assignedUsers.push(user);
            
            // Notify category assigned user
            await notificationService.notifyUser({
              userId: user._id,
              organization: organizationId,
              message: `New ticket in your category: ${ticket.title}`,
              type: 'helpdesk',
              link: `/helpdesk/tickets/${ticket._id}`,
              sender: req.user._id
            });
          }
        }
      }
    }

    // Send creation email to all assigned users
    if (assignedUsers.length > 0) {
      await emailService.sendTicketCreationEmail({
        ticket,
        requester: ticket.requester,
        assignedUsers
      });
    }

    // Notify admin if high priority
    if (ticket.priority === 'high' || ticket.priority === 'urgent') {
      const admins = await User.find({
        organization: organizationId,
        role: 'admin'
      });

      for (const admin of admins) {
        await notificationService.notifyUser({
          userId: admin._id,
          organization: organizationId,
          message: `High priority ticket created: ${ticket.title}`,
          type: 'helpdesk',
          link: `/helpdesk/tickets/${ticket._id}`,
          sender: req.user._id
        });
      }
    }

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ message: 'Failed to create ticket', error: error.message });
  }
};

// Update ticket
exports.updateTicket = async (req, res) => {
  try {
    const ticket = await HelpdeskTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check permissions
    if (!ticket.canEdit(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      title,
      description,
      category,
      subcategory,
      priority,
      status,
      assignedTo,
      tags
    } = req.body;

    // Update fields
    if (title !== undefined) ticket.title = title;
    if (description !== undefined) ticket.description = description;
    if (category !== undefined) ticket.category = category;
    if (subcategory !== undefined) ticket.subcategory = subcategory;
    if (priority !== undefined) ticket.priority = priority;
    if (tags !== undefined) ticket.tags = tags;
    
    ticket.updatedBy = req.user._id;

    const organizationId = req.user.organization._id || req.user.organization;
    let oldStatus = ticket.status;
    let statusChanged = false;

    // Handle status change
    if (status && status !== ticket.status) {
      oldStatus = ticket.status;
      statusChanged = true;
      await ticket.updateStatus(status, req.user._id, `Status changed to ${status}`);
    }

    // Handle assignment change
    if (assignedTo && assignedTo !== ticket.assignedTo?.toString()) {
      await ticket.assignTo(assignedTo, req.user._id, `Ticket reassigned`);
    }

    await ticket.save();

    // Populate the updated ticket
    await ticket.populate([
      { path: 'category', select: 'name color icon' },
      { path: 'requester', select: 'fullName email' },
      { path: 'assignedTo', select: 'fullName email' }
    ]);

    // Send status change notifications and emails
    if (statusChanged) {
      // Notify requester about status change
      await notificationService.notifyUser({
        userId: ticket.requester._id,
        organization: organizationId,
        message: `Ticket status updated: ${ticket.title} - ${oldStatus} → ${status}`,
        type: 'helpdesk',
        link: `/helpdesk/my-requests`,
        sender: req.user._id
      });

      // Send email to requester
      await emailService.sendTicketStatusChangeEmail({
        ticket,
        requester: ticket.requester,
        changedBy: req.user,
        oldStatus,
        newStatus: status
      });

      // Notify assigned user if different from the one making the change
      if (ticket.assignedTo && ticket.assignedTo._id.toString() !== req.user._id.toString()) {
        await notificationService.notifyUser({
          userId: ticket.assignedTo._id,
          organization: organizationId,
          message: `Ticket status updated: ${ticket.title} - ${oldStatus} → ${status}`,
          type: 'helpdesk',
          link: `/helpdesk/tickets/${ticket._id}`,
          sender: req.user._id
        });
      }
    }

    res.json(ticket);
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ message: 'Failed to update ticket', error: error.message });
  }
};

// Add comment to ticket
exports.addComment = async (req, res) => {
  try {
    const ticket = await HelpdeskTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check permissions
    if (!ticket.canView(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { content, isInternal = false, attachments = [] } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    await ticket.addComment(content, req.user._id, isInternal, attachments);

    // Populate the updated ticket
    await ticket.populate([
      { path: 'category', select: 'name color icon' },
      { path: 'requester', select: 'fullName email' },
      { path: 'assignedTo', select: 'fullName email' },
      { path: 'comments.author', select: 'fullName email' }
    ]);

    // Send notifications and emails
    if (!isInternal) {
      const emailService = require('../services/emailService');
      const newComment = ticket.comments[ticket.comments.length - 1];
      
      // Notify requester if not the commenter
      if (ticket.requester.toString() !== req.user._id.toString()) {
        await notificationService.notifyUser({
          userId: ticket.requester,
          organization: ticket.organization,
          message: `New comment on ticket: ${ticket.title}`,
          type: 'helpdesk',
          link: `/helpdesk/tickets/${ticket._id}`,
          sender: req.user._id
        });
        
        // Send email to requester
        try {
          await emailService.sendTicketCommentEmail({
            ticket: {
              _id: ticket._id,
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              status: ticket.status,
              priority: ticket.priority
            },
            comment: newComment,
            recipient: ticket.requester,
            commenter: req.user
          });
        } catch (emailErr) {
          console.error('Failed to send ticket comment email to requester:', emailErr);
        }
      }

      // Notify assignee if not the commenter
      if (ticket.assignedTo && ticket.assignedTo.toString() !== req.user._id.toString()) {
        await notificationService.notifyUser({
          userId: ticket.assignedTo,
          organization: ticket.organization,
          message: `New comment on ticket: ${ticket.title}`,
          type: 'helpdesk',
          link: `/helpdesk/tickets/${ticket._id}`,
          sender: req.user._id
        });
        
        // Send email to assignee
        try {
          await emailService.sendTicketCommentEmail({
            ticket: {
              _id: ticket._id,
              ticketNumber: ticket.ticketNumber,
              title: ticket.title,
              status: ticket.status,
              priority: ticket.priority
            },
            comment: newComment,
            recipient: ticket.assignedTo,
            commenter: req.user
          });
        } catch (emailErr) {
          console.error('Failed to send ticket comment email to assignee:', emailErr);
        }
      }
    }

    // Return the newly added comment with populated author
    res.json({ 
      success: true, 
      comment: newComment,
      message: 'Comment added successfully' 
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Failed to add comment', error: error.message });
  }
};

// Get ticket statistics
exports.getTicketStats = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Build base filter
    let baseFilter = { organization: organizationId, createdAt: { $gte: startDate } };

    // Role-based filtering
    const hasFullAccess = await exports.hasFullHelpdeskAccess(req.user, organizationId);
    
    if (!hasFullAccess) {
      if (req.user.role === 'staff') {
        baseFilter.requester = req.user._id;
      } else {
        // Department users
        const userCategories = await HelpdeskCategory.find({
          organization: organizationId,
          $or: [
            { assignedRoles: req.user.role },
            { assignedUsers: req.user._id }
          ]
        }).select('_id');
        
        baseFilter.category = { $in: userCategories.map(cat => cat._id) };
      }
    }

    // Get statistics
    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      closedTickets,
      overdueTickets,
      ticketsByPriority,
      ticketsByCategory,
      avgResponseTime,
      avgResolutionTime
    ] = await Promise.all([
      HelpdeskTicket.countDocuments(baseFilter),
      HelpdeskTicket.countDocuments({ ...baseFilter, status: 'open' }),
      HelpdeskTicket.countDocuments({ ...baseFilter, status: 'in_progress' }),
      HelpdeskTicket.countDocuments({ ...baseFilter, status: 'resolved' }),
      HelpdeskTicket.countDocuments({ ...baseFilter, status: 'closed' }),
      HelpdeskTicket.countDocuments({ 
        ...baseFilter, 
        dueDate: { $lt: new Date() },
        status: { $nin: ['closed', 'resolved'] }
      }),
      HelpdeskTicket.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      HelpdeskTicket.aggregate([
        { $match: baseFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $lookup: { from: 'helpdeskcategories', localField: '_id', foreignField: '_id', as: 'category' } },
        { $unwind: '$category' },
        { $project: { _id: 1, name: '$category.name', count: 1 } }
      ]),
      HelpdeskTicket.aggregate([
        { $match: { ...baseFilter, firstResponseAt: { $exists: true } } },
        { $group: { _id: null, avgTime: { $avg: { $subtract: ['$firstResponseAt', '$createdAt'] } } } }
      ]),
      HelpdeskTicket.aggregate([
        { $match: { ...baseFilter, resolvedAt: { $exists: true } } },
        { $group: { _id: null, avgTime: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } } }
      ])
    ]);

    res.json({
      total: totalTickets,
      byStatus: {
        open: openTickets,
        inProgress: inProgressTickets,
        resolved: resolvedTickets,
        closed: closedTickets
      },
      overdue: overdueTickets,
      byPriority: ticketsByPriority,
      byCategory: ticketsByCategory,
      avgResponseTime: avgResponseTime[0]?.avgTime || 0,
      avgResolutionTime: avgResolutionTime[0]?.avgTime || 0
    });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics', error: error.message });
  }
};

// Get overdue tickets
exports.getOverdueTickets = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;

    // Build filter
    const filter = {
      organization: organizationId,
      dueDate: { $lt: new Date() },
      status: { $nin: ['closed', 'resolved'] }
    };

    // Role-based filtering
    const hasFullAccess = await exports.hasFullHelpdeskAccess(req.user, organizationId);
    
    if (!hasFullAccess) {
      if (req.user.role === 'staff') {
        filter.requester = req.user._id;
      } else {
        // Department users can see tickets in their categories
        const userCategories = await HelpdeskCategory.find({
          organization: organizationId,
          $or: [
            { assignedRoles: req.user.role },
            { assignedUsers: req.user._id }
          ]
        }).select('_id');
        
        filter.category = { $in: userCategories.map(cat => cat._id) };
      }
    }

    const overdueTickets = await HelpdeskTicket.find(filter)
      .populate('category', 'name color icon')
      .populate('requester', 'fullName email')
      .populate('assignedTo', 'fullName email')
      .sort({ dueDate: 1 });

    res.json(overdueTickets);
  } catch (error) {
    console.error('Error fetching overdue tickets:', error);
    res.status(500).json({ message: 'Failed to fetch overdue tickets', error: error.message });
  }
};

// Close ticket
exports.closeTicket = async (req, res) => {
  try {
    const ticket = await HelpdeskTicket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check permissions
    if (!ticket.canEdit(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await ticket.updateStatus('closed', req.user._id, 'Ticket closed');

    // Populate the updated ticket
    await ticket.populate([
      { path: 'category', select: 'name color icon' },
      { path: 'requester', select: 'fullName email' },
      { path: 'assignedTo', select: 'fullName email' }
    ]);

    // Send notification to requester
    await notificationService.notifyUser({
      userId: ticket.requester,
      organization: ticket.organization,
      message: `Your ticket has been closed: ${ticket.title}`,
      type: 'helpdesk',
      link: `/helpdesk/tickets/${ticket._id}`,
      sender: req.user._id
    });

    res.json(ticket);
  } catch (error) {
    console.error('Error closing ticket:', error);
    res.status(500).json({ message: 'Failed to close ticket', error: error.message });
  }
};



