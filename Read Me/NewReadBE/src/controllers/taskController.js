const Task = require('../models/Task');
const User = require('../models/User');
const mongoose = require('mongoose');
const path = require('path');
const notificationService = require('../services/notificationService');
const { uploadFile, getFileUrl } = require('../utils/s3');
const { sendTaskStatusChangeEmail, sendNewTaskAssignedEmail } = require('../services/emailService');
const Organization = require('../models/Organization');

// Admin: Create a new task
exports.createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, priority, startDate, endDate } = req.body;
    if (!title || !assignedTo || !priority || !startDate || !endDate) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    // File upload (if any)
    let attachment = null;
    if (req.file) {
      if (req.file.size > 10 * 1024 * 1024) {
        return res.status(400).json({ message: 'File too large (max 10MB)' });
      }
      // Upload to S3
      const s3Key = `tasks/${Date.now()}-${req.file.originalname}`;
      console.log('Uploading task attachment to S3:', { s3Key, originalname: req.file.originalname });
      const s3Result = await uploadFile(req.file, s3Key);
      console.log('S3 upload result:', { Location: s3Result.Location, Key: s3Result.Key });
      attachment = {
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: s3Result.Location, // S3 public URL
      };
    }
    const assignedUserIds = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    const task = new Task({
      title,
      description,
      assignedTo: assignedUserIds,
      priority,
      startDate,
      endDate,
      attachment,
      createdBy: req.user._id,
      organization: req.user.organization
    });
    await task.save();

    // Tenant-isolated fetch of assigned users for email
    const assignedUsers = await User.find({
      _id: { $in: assignedUserIds },
      organization: req.user.organization,
      status: { $ne: 'archived' }
    }).select('fullName email');

    // Resolve organization object for template
    const organizationObj = (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id)
      ? req.user.organization
      : await Organization.findById(req.user.organization).select('name');

    // Send SMTP emails only to assigned users within the same organization
    if (assignedUsers.length > 0 && organizationObj) {
      try {
        await sendNewTaskAssignedEmail({
          organization: organizationObj,
          admin: { fullName: req.user.fullName, email: req.user.email },
          assignedUsers,
          task
        });
      } catch (emailErr) {
        console.error('Failed to send new task assigned emails:', emailErr);
      }
    }

    // Notify assigned users (in-app)
    await notificationService.notifyUsers({
      userIds: assignedUserIds,
      organization: req.user.organization,
      message: `You have been assigned a new task: ${title}`,
      type: 'task',
      link: '/my-tasks',
      sender: req.user._id
    });
    res.status(201).json(task);
  } catch (err) {
    console.error('Task creation error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Staff: Get all tasks assigned to them
exports.getTasksForStaff = async (req, res) => {
  try {
    const tasks = await Task.find({ assignedTo: req.user._id, organization: req.user.organization })
      .populate('createdBy', 'fullName email')
      .sort({ endDate: 1, priority: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Get all tasks (optionally filter by staff, status, priority)
exports.getTasksForAdmin = async (req, res) => {
  try {
    const { staffId, status, priority } = req.query;
    const query = { organization: req.user.organization };
    if (staffId) query.assignedTo = staffId;
    if (status) query.status = status;
    if (priority) query.priority = priority;
    const tasks = await Task.find(query)
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email')
      .sort({ endDate: 1, priority: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get task details by ID
exports.getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid task ID' });
    const task = await Task.findOne({ _id: id, organization: req.user.organization })
      .populate('assignedTo', 'fullName email')
      .populate('createdBy', 'fullName email');
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Staff: Update task status and add note
exports.updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, note } = req.body;
    if (!['Pending', 'In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    
    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }
    
    const task = await Task.findOne({ _id: id, organization: organizationId })
      .populate('createdBy', 'fullName email department role');
    
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!task.assignedTo.map(id => id.toString()).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Store the previous status for email notification
    const oldStatus = task.status;
    
    task.status = status;
    if (note) {
      task.statusNotes.push({ note, by: req.user._id });
    }
    await task.save();
    
    // Send email notification to the admin who created the task
    if ((oldStatus === 'Pending' && (status === 'In Progress' || status === 'Completed')) || 
        (oldStatus === 'In Progress' && status === 'Completed')) {
      
      console.log('Task status changed - sending notification email');
      
      // Get organization details for email
      let organization;
      if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
        // Organization is already populated
        organization = req.user.organization;
      } else {
        // Organization is not populated, fetch it
        organization = await Organization.findById(organizationId);
      }
      
      if (!organization) {
        console.error('Organization not found for task status change:', organizationId);
      } else if (task.createdBy) {
        try {
          console.log(`Sending task status change email to admin: ${task.createdBy.email} in organization: ${organization.name} (${organizationId})`);
          
          const emailResult = await sendTaskStatusChangeEmail({
            organization,
            admin: {
              fullName: task.createdBy.fullName,
              email: task.createdBy.email,
              department: task.createdBy.department,
              role: task.createdBy.role
            },
            staff: {
              fullName: req.user.fullName,
              email: req.user.email,
              department: req.user.department,
              role: req.user.role
            },
            task,
            oldStatus,
            newStatus: status,
            note
          });
          
          console.log('Task status change email sent successfully:', {
            organization: organization.name,
            organizationId: organizationId,
            adminEmail: task.createdBy.email,
            taskTitle: task.title,
            oldStatus,
            newStatus: status
          });
        } catch (emailError) {
          console.error('Failed to send task status change email:', emailError);
          // Don't fail the request if email sending fails
        }
      } else {
        console.log('Task creator not found for email notification:', {
          taskId: task._id,
          createdBy: task.createdBy
        });
      }
    }
    
    res.json(task);
  } catch (err) {
    console.error('Error updating task status:', err);
    res.status(500).json({ message: err.message });
  }
};

// Admin: Revert task status to 'In Progress' and leave a note
exports.revertTaskToInProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const task = await Task.findOne({ _id: id, organization: req.user.organization });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    // Only allow if current status is Completed
    if (task.status !== 'Completed') {
      return res.status(400).json({ message: 'Task is not completed' });
    }
    task.status = 'In Progress';
    if (note) {
      task.statusNotes.push({ note, by: req.user._id });
    }
    await task.save();
    // TODO: Notify user (in-app notification)
    res.json(task);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}; 