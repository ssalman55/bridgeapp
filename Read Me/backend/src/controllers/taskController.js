const Task = require('../models/Task');
const User = require('../models/User');
const mongoose = require('mongoose');
const path = require('path');
const notificationService = require('../services/notificationService');
const { uploadFile, getFileUrl } = require('../utils/s3');

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
      const s3Result = await uploadFile(req.file, s3Key);
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
    // Notify assigned users
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
    const task = await Task.findOne({ _id: id, organization: req.user.organization });
    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (!task.assignedTo.map(id => id.toString()).includes(req.user._id.toString())) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    task.status = status;
    if (note) {
      task.statusNotes.push({ note, by: req.user._id });
    }
    await task.save();
    // TODO: Notify admin (in-app notification)
    res.json(task);
  } catch (err) {
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