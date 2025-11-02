const asyncHandler = require('express-async-handler');
const OnboardingTask = require('../models/OnboardingTask');
const OnboardingPipeline = require('../models/OnboardingPipeline');
const User = require('../models/User');
const multer = require('multer');
const { uploadToS3, deleteFromS3 } = require('../utils/s3');

// Task Management
const getTasks = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 10, 
    search, 
    status, 
    taskType, 
    assignedTo, 
    overdue,
    dueDateFrom,
    dueDateTo,
    category,
    priority,
    pipelineId
  } = req.query;
  
  const filter = { organization: req.user.organization };
  
  // DEBUG: Log the filter and organization
  console.log('DEBUG getTasks - Organization:', req.user.organization);
  console.log('DEBUG getTasks - User role:', req.user.role);
  console.log('DEBUG getTasks - Base filter:', filter);
  
  if (search) {
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status) {
    if (Array.isArray(status)) {
      filter.status = { $in: status };
    } else {
      filter.status = status;
    }
  }
  
  if (taskType) filter.taskType = taskType;
  if (assignedTo) filter.assignedTo = assignedTo;
  if (category) filter.category = category;
  if (priority) filter.priority = priority;
  if (overdue === 'true') filter.isOverdue = true;
  if (pipelineId) filter.onboarding = pipelineId;
  
  if (dueDateFrom || dueDateTo) {
    filter.dueDate = {};
    if (dueDateFrom) filter.dueDate.$gte = new Date(dueDateFrom);
    if (dueDateTo) filter.dueDate.$lte = new Date(dueDateTo);
  }
  
  // If user is not admin/hr, only show their assigned tasks
  if (!['admin', 'hr'].includes(req.user.role)) {
    filter.assignedTo = req.user._id;
  }
  
  console.log('DEBUG getTasks - Final filter:', filter);
  
  // DEBUG: First check total count without populate
  const totalRaw = await OnboardingTask.countDocuments(filter);
  console.log('DEBUG getTasks - Total raw count:', totalRaw);
  
  // DEBUG: Get all tasks for this organization first
  const allOrgTasks = await OnboardingTask.find({ organization: req.user.organization });
  console.log('DEBUG getTasks - All org tasks count:', allOrgTasks.length);
  console.log('DEBUG getTasks - Sample tasks:', allOrgTasks.slice(0, 2));
  
  const tasks = await OnboardingTask.find(filter)
    .populate({
      path: 'onboarding',
      select: 'newHire currentStage position startDate',
      populate: {
        path: 'newHire',
        select: 'fullName email'
      }
    })
    .populate('assignedTo', 'fullName email')
    .populate('assignedBy', 'fullName email')
    .sort({ dueDate: 1, priority: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);
  
  const total = await OnboardingTask.countDocuments(filter);
  
  console.log('DEBUG getTasks - Final tasks count:', tasks.length);
  console.log('DEBUG getTasks - Final total:', total);
  
  // Debug: Log sample task data to see what's being populated
  if (tasks.length > 0) {
    console.log('DEBUG getTasks - Sample task onboarding data:', {
      taskId: tasks[0]._id,
      taskTitle: tasks[0].title,
      onboarding: tasks[0].onboarding,
      onboardingType: typeof tasks[0].onboarding,
      newHire: tasks[0].onboarding && typeof tasks[0].onboarding === 'object' ? tasks[0].onboarding.newHire : 'N/A'
    });
  }
  
  res.json({
    tasks,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total,
    debug: {
      organization: req.user.organization,
      userRole: req.user.role,
      filter: filter,
      allOrgTasksCount: allOrgTasks.length,
      rawTotal: totalRaw
    }
  });
});

const getTask = asyncHandler(async (req, res) => {
  const task = await OnboardingTask.findOne({
    _id: req.params.id,
    organization: req.user.organization
  })
    .populate({
      path: 'onboarding',
      select: 'newHire currentStage position department startDate manager',
      populate: {
        path: 'newHire',
        select: 'fullName email profileImage'
      }
    })
    .populate('onboarding.manager', 'fullName email')
    .populate('assignedTo', 'fullName email')
    .populate('assignedBy', 'fullName email')
    .populate('notes.author', 'fullName email')
    .populate('auditLog.performedBy', 'fullName email');
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  // Check if user has access to this task
  if (!['admin', 'hr'].includes(req.user.role) && task.assignedTo?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  res.json(task);
});

const updateTaskStatus = asyncHandler(async (req, res) => {
  const { status, notes, formData } = req.body;
  
  const task = await OnboardingTask.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  // Check if user can update this task
  if (!['admin', 'hr'].includes(req.user.role) && task.assignedTo?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  const oldStatus = task.status;
  task.status = status;
  
  if (status === 'in-progress' && !task.startedAt) {
    task.startedAt = new Date();
  }
  
  if (status === 'completed') {
    task.completedAt = new Date();
  }
  
  if (formData) {
    task.formData = formData;
  }
  
  // Add note if provided
  if (notes) {
    task.notes.push({
      author: req.user._id,
      content: notes,
      isInternal: false
    });
  }
  
  // Add audit log entry
  task.auditLog.push({
    action: 'Status updated',
    performedBy: req.user._id,
    oldValue: oldStatus,
    newValue: status,
    details: notes || 'Status updated'
  });
  
  task.updatedBy = req.user._id;
  await task.save();
  
  // Update dependencies for other tasks
  if (status === 'completed') {
    await updateTaskDependencies(task);
  }
  
  // Update pipeline progress
  await updatePipelineProgress(task.onboarding);
  
  await task.populate([
    { path: 'onboarding', select: 'newHire currentStage position' },
    { path: 'assignedTo', select: 'firstName lastName email' },
    { path: 'notes.author', select: 'firstName lastName email' }
  ]);
  
  res.json(task);
});

const assignTask = asyncHandler(async (req, res) => {
  const { assignedTo, notes } = req.body;
  
  const task = await OnboardingTask.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  // Verify the assigned user exists and is in the same organization
  const assignee = await User.findOne({
    _id: assignedTo,
    organization: req.user.organization
  });
  
  if (!assignee) {
    return res.status(404).json({ message: 'Assignee not found' });
  }
  
  const oldAssignee = task.assignedTo;
  task.assignedTo = assignedTo;
  task.assignedBy = req.user._id;
  task.assignedAt = new Date();
  
  // Add note about reassignment
  if (notes) {
    task.notes.push({
      author: req.user._id,
      content: notes,
      isInternal: true
    });
  }
  
  // Add audit log entry
  task.auditLog.push({
    action: 'Task reassigned',
    performedBy: req.user._id,
    oldValue: oldAssignee,
    newValue: assignedTo,
    details: `Task reassigned to ${assignee.firstName} ${assignee.lastName}`
  });
  
  task.updatedBy = req.user._id;
  await task.save();
  
  await task.populate([
    { path: 'assignedTo', select: 'firstName lastName email' },
    { path: 'assignedBy', select: 'firstName lastName email' }
  ]);
  
  res.json(task);
});

const bulkUpdateTasks = asyncHandler(async (req, res) => {
  const { taskIds, updates } = req.body;
  
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ message: 'Task IDs are required' });
  }
  
  const tasks = await OnboardingTask.find({
    _id: { $in: taskIds },
    organization: req.user.organization
  });
  
  if (tasks.length === 0) {
    return res.status(404).json({ message: 'No tasks found' });
  }
  
  const results = [];
  
  for (const task of tasks) {
    // Check access for each task
    if (!['admin', 'hr'].includes(req.user.role) && task.assignedTo?.toString() !== req.user._id.toString()) {
      continue;
    }
    
    const oldValues = {};
    
    if (updates.status) {
      oldValues.status = task.status;
      task.status = updates.status;
      
      if (updates.status === 'in-progress' && !task.startedAt) {
        task.startedAt = new Date();
      }
      
      if (updates.status === 'completed') {
        task.completedAt = new Date();
      }
    }
    
    if (updates.assignedTo) {
      oldValues.assignedTo = task.assignedTo;
      task.assignedTo = updates.assignedTo;
      task.assignedBy = req.user._id;
      task.assignedAt = new Date();
    }
    
    if (updates.priority) {
      oldValues.priority = task.priority;
      task.priority = updates.priority;
    }
    
    // Add audit log entry
    task.auditLog.push({
      action: 'Bulk update',
      performedBy: req.user._id,
      details: `Bulk update: ${Object.keys(updates).join(', ')}`
    });
    
    task.updatedBy = req.user._id;
    await task.save();
    
    results.push({
      taskId: task._id,
      success: true,
      oldValues
    });
  }
  
  res.json({
    message: `Successfully updated ${results.length} tasks`,
    results
  });
});

const addTaskNote = asyncHandler(async (req, res) => {
  const { content, isInternal = false } = req.body;
  
  const task = await OnboardingTask.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  task.notes.push({
    author: req.user._id,
    content,
    isInternal
  });
  
  task.updatedBy = req.user._id;
  await task.save();
  
  await task.populate('notes.author', 'firstName lastName email');
  
  res.json({
    message: 'Note added successfully',
    note: task.notes[task.notes.length - 1]
  });
});

const uploadTaskFile = asyncHandler(async (req, res) => {
  const task = await OnboardingTask.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  
  try {
    const fileUrl = await uploadToS3(req.file, 'onboarding-tasks');
    
    const fileData = {
      name: req.file.originalname,
      originalName: req.file.originalname,
      url: fileUrl,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: req.user._id
    };
    
    task.files.push(fileData);
    
    // Add audit log entry
    task.auditLog.push({
      action: 'File uploaded',
      performedBy: req.user._id,
      details: `Uploaded file: ${req.file.originalname}`
    });
    
    task.updatedBy = req.user._id;
    await task.save();
    
    res.json({
      message: 'File uploaded successfully',
      file: fileData
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload file', error: error.message });
  }
});

const deleteTaskFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  
  const task = await OnboardingTask.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  const fileIndex = task.files.findIndex(file => file._id.toString() === fileId);
  
  if (fileIndex === -1) {
    return res.status(404).json({ message: 'File not found' });
  }
  
  const file = task.files[fileIndex];
  
  try {
    // Delete from S3
    await deleteFromS3(file.url);
    
    // Remove from task
    task.files.splice(fileIndex, 1);
    
    // Add audit log entry
    task.auditLog.push({
      action: 'File deleted',
      performedBy: req.user._id,
      details: `Deleted file: ${file.name}`
    });
    
    task.updatedBy = req.user._id;
    await task.save();
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete file', error: error.message });
  }
});

// Helper functions
const updateTaskDependencies = async (completedTask) => {
  // Find tasks that depend on this completed task
  const dependentTasks = await OnboardingTask.find({
    organization: completedTask.organization,
    'dependencies.taskId': completedTask._id
  });
  
  for (const task of dependentTasks) {
    await task.updateDependencyStatus();
    await task.save();
  }
};

const updatePipelineProgress = async (onboardingId) => {
  const pipeline = await OnboardingPipeline.findById(onboardingId);
  if (pipeline) {
    pipeline.updateProgress();
    await pipeline.save();
  }
};

const downloadTaskFile = asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  
  const task = await OnboardingTask.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }
  
  // Check if user has access to this task
  if (!['admin', 'hr'].includes(req.user.role) && task.assignedTo?.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  const file = task.files.find(f => f._id.toString() === fileId);
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }
  
  try {
    // Extract S3 key from the URL (following the working pattern from documentRoutes.js)
    let s3Key;
    if (file.url.startsWith('http')) {
      const match = file.url.match(/amazonaws\.com\/(.+)$/);
      s3Key = match ? decodeURIComponent(match[1]) : null;
    } else if (file.url) {
      // If it's already an S3 key, use it directly
      s3Key = file.url;
    } else {
      return res.status(400).json({ message: 'Invalid file URL' });
    }
    
    if (!s3Key) {
      console.error('Onboarding task S3 key extraction failed:', file.url);
      return res.status(400).json({ message: 'Invalid file URL' });
    }
    
    // Generate signed URL
    const { getSignedUrl } = require('../utils/s3');
    const signedUrl = getSignedUrl(s3Key, 3600); // 1 hour expiry
    
    // Return the signed URL instead of redirecting
    res.json({ downloadUrl: signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    res.status(500).json({ message: 'Failed to generate download link' });
  }
});

module.exports = {
  getTasks,
  getTask,
  updateTaskStatus,
  assignTask,
  bulkUpdateTasks,
  addTaskNote,
  uploadTaskFile,
  deleteTaskFile,
  downloadTaskFile,
  updateTaskDependencies,
  updatePipelineProgress
};
