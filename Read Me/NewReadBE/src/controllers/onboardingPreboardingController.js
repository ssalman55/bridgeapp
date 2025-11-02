const asyncHandler = require('express-async-handler');
const OnboardingPipeline = require('../models/OnboardingPipeline');
const OnboardingTask = require('../models/OnboardingTask');
const User = require('../models/User');
const { uploadToS3 } = require('../utils/s3');
const crypto = require('crypto');

// Preboarding Portal Access
const getPreboardingData = asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }
  
  const pipeline = await OnboardingPipeline.findOne({
    preboardingToken: token
  })
    .populate('newHire', 'fullName email phone profileImage')
    .populate('manager', 'fullName email phone')
    .populate('organization', 'name address phone email website');
  
  if (!pipeline) {
    return res.status(404).json({ message: 'Invalid or expired token' });
  }
  
  // Get preboarding tasks for the new hire
  // Include tasks assigned to new hire that are due before or within 7 days of start date
  const startDate = new Date(pipeline.startDate);
  const sevenDaysAfterStart = new Date(startDate);
  sevenDaysAfterStart.setDate(sevenDaysAfterStart.getDate() + 7);
  
  const preboardingTasks = await OnboardingTask.find({
    onboarding: pipeline._id,
    $and: [
      {
        $or: [
          { assignedRole: 'new-hire' },
          { assignedTo: pipeline.newHire._id }
        ]
      },
      {
        $or: [
          { category: 'preboarding' },
          { dueDate: { $lte: sevenDaysAfterStart } }
        ]
      }
    ]
  }).sort({ dueDate: 1 });
  
  // Calculate progress
  const completedTasks = preboardingTasks.filter(task => task.status === 'completed').length;
  const progressPercentage = preboardingTasks.length > 0 ? 
    Math.round((completedTasks / preboardingTasks.length) * 100) : 0;
  
  // Get upcoming events/schedule for first week
  const scheduleStartDate = new Date(pipeline.startDate);
  const firstWeekEnd = new Date(scheduleStartDate);
  firstWeekEnd.setDate(firstWeekEnd.getDate() + 7);
  
  const firstWeekSchedule = [
    {
      date: scheduleStartDate.toISOString().split('T')[0],
      time: '09:00',
      title: 'Welcome & Orientation',
      location: 'Main Conference Room',
      type: 'orientation'
    },
    {
      date: scheduleStartDate.toISOString().split('T')[0],
      time: '11:00',
      title: 'IT Setup & Equipment Collection',
      location: 'IT Department',
      type: 'setup'
    },
    {
      date: scheduleStartDate.toISOString().split('T')[0],
      time: '14:00',
      title: 'Meet Your Team',
      location: pipeline.department || 'Department Office',
      type: 'meeting'
    }
  ];
  
  // Get key contacts
  const keyContacts = [
    {
      role: 'Direct Manager',
      name: pipeline.manager ? `${pipeline.manager.firstName} ${pipeline.manager.lastName}` : 'TBD',
      email: pipeline.manager?.email,
      phone: pipeline.manager?.phone
    },
    {
      role: 'HR Representative',
      name: 'HR Team',
      email: pipeline.organization.email,
      phone: pipeline.organization.phone
    },
    {
      role: 'IT Support',
      name: 'IT Help Desk',
      email: 'it-support@' + (pipeline.organization.email?.split('@')[1] || 'company.com'),
      phone: pipeline.organization.phone
    }
  ];
  
  // Mask sensitive data
  const safeData = {
    onboarding: {
      _id: pipeline._id,
      position: pipeline.position,
      department: pipeline.department,
      location: pipeline.location,
      startDate: pipeline.startDate,
      currentStage: pipeline.currentStage,
      preboardingCompleted: pipeline.preboardingCompleted,
      progressPercentage
    },
    newHire: {
      firstName: pipeline.newHire.fullName?.split(' ')[0] || 'New',
      lastName: pipeline.newHire.fullName?.split(' ').slice(1).join(' ') || 'Hire',
      fullName: pipeline.newHire.fullName,
      email: pipeline.newHire.email,
      profileImage: pipeline.newHire.profileImage
    },
    organization: {
      name: pipeline.organization.name,
      address: pipeline.organization.address,
      website: pipeline.organization.website
    },
    tasks: preboardingTasks.map(task => ({
      _id: task._id,
      title: task.title,
      description: task.description,
      taskType: task.taskType,
      status: task.status,
      dueDate: task.dueDate,
      formData: task.formData,
      files: task.files
    })),
    firstWeekSchedule,
    keyContacts,
    welcomeMessage: `Welcome to ${pipeline.organization.name}, ${pipeline.newHire.fullName?.split(' ')[0] || 'New Hire'}! We're excited to have you join our team as ${pipeline.position}.`
  };
  
  res.json(safeData);
});

const updatePreboardingTask = asyncHandler(async (req, res) => {
  const { token, taskId } = req.params;
  const { status, formData, notes } = req.body;
  
  const pipeline = await OnboardingPipeline.findOne({
    preboardingToken: token
  });
  
  if (!pipeline) {
    return res.status(404).json({ message: 'Invalid or expired token' });
  }
  
  const task = await OnboardingTask.findOne({
    _id: taskId,
    onboarding: pipeline._id,
    $or: [
      { assignedRole: 'new-hire' },
      { assignedTo: pipeline.newHire._id }
    ]
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found or not accessible' });
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
    task.formData = { ...(task.formData || {}), ...formData };
  }
  
  if (notes) {
    task.notes.push({
      author: pipeline.newHire,
      content: notes,
      isInternal: false
    });
  }
  
  // Add audit log entry
  task.auditLog.push({
    action: 'Preboarding update',
    performedBy: pipeline.newHire,
    oldValue: oldStatus,
    newValue: status,
    details: 'Updated via preboarding portal'
  });
  
  await task.save();
  
  // Check if all preboarding tasks are completed
  const completionStartDate = new Date(pipeline.startDate);
  const sevenDaysAfterStart = new Date(completionStartDate);
  sevenDaysAfterStart.setDate(sevenDaysAfterStart.getDate() + 7);
  
  const allPreboardingTasks = await OnboardingTask.find({
    onboarding: pipeline._id,
    $and: [
      {
        $or: [
          { assignedRole: 'new-hire' },
          { assignedTo: pipeline.newHire._id }
        ]
      },
      {
        $or: [
          { category: 'preboarding' },
          { dueDate: { $lte: sevenDaysAfterStart } }
        ]
      }
    ]
  });
  
  const completedCount = allPreboardingTasks.filter(t => t.status === 'completed').length;
  
  if (completedCount === allPreboardingTasks.length && !pipeline.preboardingCompleted) {
    pipeline.preboardingCompleted = true;
    pipeline.preboardingCompletedAt = new Date();
    
    // Advance stage to provisioning if still in preboarding
    if (pipeline.currentStage === 'preboarding') {
      pipeline.currentStage = 'provisioning';
      pipeline.stageHistory.push({
        stage: 'provisioning',
        enteredBy: pipeline.newHire,
        notes: 'Preboarding completed, automatically advanced to provisioning'
      });
    }
    
    await pipeline.save();
  }
  
  res.json({
    message: 'Task updated successfully',
    task: {
      _id: task._id,
      title: task.title,
      status: task.status,
      formData: task.formData
    },
    preboardingCompleted: pipeline.preboardingCompleted
  });
});

const uploadPreboardingFile = asyncHandler(async (req, res) => {
  const { token, taskId } = req.params;
  
  const pipeline = await OnboardingPipeline.findOne({
    preboardingToken: token
  });
  
  if (!pipeline) {
    return res.status(404).json({ message: 'Invalid or expired token' });
  }
  
  const task = await OnboardingTask.findOne({
    _id: taskId,
    onboarding: pipeline._id,
    $or: [
      { assignedRole: 'new-hire' },
      { assignedTo: pipeline.newHire._id }
    ]
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found or not accessible' });
  }
  
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  
  try {
    const fileUrl = await uploadToS3(req.file, 'preboarding-documents');
    
    const fileData = {
      name: req.file.originalname,
      originalName: req.file.originalname,
      url: fileUrl,
      size: req.file.size,
      mimeType: req.file.mimetype,
      uploadedBy: pipeline.newHire
    };
    
    task.files.push(fileData);
    
    // Add audit log entry
    task.auditLog.push({
      action: 'File uploaded',
      performedBy: pipeline.newHire,
      details: `Uploaded file via preboarding portal: ${req.file.originalname}`
    });
    
    await task.save();
    
    res.json({
      message: 'File uploaded successfully',
      file: {
        name: fileData.name,
        size: fileData.size,
        uploadedAt: fileData.uploadedAt
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload file', error: error.message });
  }
});

const markTaskComplete = asyncHandler(async (req, res) => {
  const { token, taskId } = req.params;
  
  const pipeline = await OnboardingPipeline.findOne({
    preboardingToken: token
  });
  
  if (!pipeline) {
    return res.status(404).json({ message: 'Invalid or expired token' });
  }
  
  const task = await OnboardingTask.findOne({
    _id: taskId,
    onboarding: pipeline._id,
    $or: [
      { assignedRole: 'new-hire' },
      { assignedTo: pipeline.newHire._id }
    ]
  });
  
  if (!task) {
    return res.status(404).json({ message: 'Task not found or not accessible' });
  }
  
  // Mark task as completed
  task.status = 'completed';
  task.completedAt = new Date();
  
  // Add audit log entry
  task.auditLog.push({
    action: 'Task completed',
    performedBy: pipeline.newHire,
    details: 'Task marked as complete via preboarding portal'
  });
  
  await task.save();
  
  res.json({
    message: 'Task marked as complete successfully',
    task: {
      id: task._id,
      status: task.status,
      completedAt: task.completedAt
    }
  });
});

const submitPersonalInfo = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const personalInfo = req.body;
  
  const pipeline = await OnboardingPipeline.findOne({
    preboardingToken: token
  }).populate('newHire');
  
  if (!pipeline) {
    return res.status(404).json({ message: 'Invalid or expired token' });
  }
  
  // Update user's personal information
  const user = pipeline.newHire;
  
  // Update basic fields that are safe to update
  const allowedFields = [
    'phone', 'address', 'emergencyContact', 'bankDetails', 
    'taxInformation', 'personalDetails'
  ];
  
  allowedFields.forEach(field => {
    if (personalInfo[field]) {
      user[field] = personalInfo[field];
    }
  });
  
  await user.save();
  
  // Find and update the personal info task
  const personalInfoTask = await OnboardingTask.findOne({
    onboarding: pipeline._id,
    taskType: 'form',
    $or: [
      { assignedRole: 'new-hire' },
      { assignedTo: pipeline.newHire._id }
    ],
    title: { $regex: /personal.*info/i }
  });
  
  if (personalInfoTask) {
    personalInfoTask.status = 'completed';
    personalInfoTask.completedAt = new Date();
    personalInfoTask.formData = personalInfo;
    
    personalInfoTask.auditLog.push({
      action: 'Personal information submitted',
      performedBy: pipeline.newHire._id,
      details: 'Personal information form completed via preboarding portal'
    });
    
    await personalInfoTask.save();
  }
  
  res.json({
    message: 'Personal information saved successfully',
    personalInfoCompleted: true
  });
});

const getPreboardingProgress = asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  const pipeline = await OnboardingPipeline.findOne({
    preboardingToken: token
  });
  
  if (!pipeline) {
    return res.status(404).json({ message: 'Invalid or expired token' });
  }
  
  const progressStartDate = new Date(pipeline.startDate);
  const sevenDaysAfterStart = new Date(progressStartDate);
  sevenDaysAfterStart.setDate(sevenDaysAfterStart.getDate() + 7);
  
  const tasks = await OnboardingTask.find({
    onboarding: pipeline._id,
    $and: [
      {
        $or: [
          { assignedRole: 'new-hire' },
          { assignedTo: pipeline.newHire._id }
        ]
      },
      {
        $or: [
          { category: 'preboarding' },
          { dueDate: { $lte: sevenDaysAfterStart } }
        ]
      }
    ]
  });
  
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;
  
  const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Calculate estimated completion time
  const averageTaskTime = 15; // minutes per task
  const remainingTasks = totalTasks - completedTasks;
  const estimatedTimeRemaining = remainingTasks * averageTaskTime;
  
  res.json({
    progress: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      progressPercentage,
      estimatedTimeRemaining,
      isCompleted: pipeline.preboardingCompleted
    },
    timeline: tasks.map(task => ({
      title: task.title,
      status: task.status,
      completedAt: task.completedAt,
      dueDate: task.dueDate
    }))
  });
});

// Generate new preboarding token (admin only)
const regeneratePreboardingToken = asyncHandler(async (req, res) => {
  const pipeline = await OnboardingPipeline.findOne({
    _id: req.params.id,
    organization: req.user.organization
  });
  
  if (!pipeline) {
    return res.status(404).json({ message: 'Onboarding not found' });
  }
  
  const newToken = crypto.randomBytes(32).toString('hex');
  pipeline.preboardingToken = newToken;
  
  pipeline.auditLog.push({
    action: 'Preboarding token regenerated',
    performedBy: req.user._id,
    details: 'New preboarding token generated'
  });
  
  await pipeline.save();
  
  res.json({
    message: 'Preboarding token regenerated successfully',
    token: newToken,
    preboardingUrl: `${process.env.FRONTEND_URL}/preboarding/${newToken}`
  });
});

module.exports = {
  getPreboardingData,
  updatePreboardingTask,
  uploadPreboardingFile,
  submitPersonalInfo,
  getPreboardingProgress,
  regeneratePreboardingToken
};

