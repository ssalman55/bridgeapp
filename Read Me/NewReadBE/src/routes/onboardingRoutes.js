const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const { featureAccess } = require('../middleware/featureAccessMiddleware');
const permissions = require('../middleware/permissions');
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Import the actual onboarding controller
const onboardingController = require('../controllers/onboardingController');
const taskController = require('../controllers/onboardingTaskController');
const preboardingController = require('../controllers/onboardingPreboardingController');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user (but skip for public preboarding routes)
// 2. Subscription check uses req.user
// 3. Feature access check uses req.user

// Apply authentication, subscription, and feature access to all routes EXCEPT preboarding
router.use((req, res, next) => {
  // Skip all checks for public preboarding routes
  if (req.path.startsWith('/preboarding/')) {
    return next();
  }
  
  // For all other routes, apply middleware in correct order
  protect(req, res, (err) => {
    if (err) return next(err);
    checkSubscriptionStatus(req, res, (err) => {
      if (err) return next(err);
      featureAccess('onboarding_workflows')(req, res, next);
    });
  });
});

// Middleware for onboarding permissions
const requireOnboardingAccess = permissions('Onboarding', 'full');
const requireOnboardingView = permissions('Onboarding', 'view');

// Templates routes (authentication, subscription, and feature access already applied via router.use)
router.get('/templates', requireOnboardingView, onboardingController.getTemplates);
router.post('/templates', requireOnboardingAccess, onboardingController.createTemplate);
router.get('/templates/:id', requireOnboardingView, onboardingController.getTemplate);
router.put('/templates/:id', requireOnboardingAccess, onboardingController.updateTemplate);
router.delete('/templates/:id', requireOnboardingAccess, onboardingController.deleteTemplate);

// Pipelines routes
router.get('/pipelines', requireOnboardingView, onboardingController.getPipelines);
router.post('/pipelines', requireOnboardingAccess, onboardingController.createPipeline);
router.get('/pipelines/:id', requireOnboardingView, onboardingController.getPipeline);
router.put('/pipelines/:id/stage', requireOnboardingAccess, onboardingController.updatePipelineStage);
router.delete('/pipelines/:id', requireOnboardingAccess, onboardingController.deletePipeline);

// Utility routes
router.post('/cleanup-orphaned-tasks', requireOnboardingAccess, onboardingController.cleanupOrphanedTasks);

// Dashboard and analytics
router.get('/dashboard', requireOnboardingView, onboardingController.getDashboard);
router.get('/reports', requireOnboardingView, onboardingController.getReports);

// Task routes
router.get('/tasks', requireOnboardingView, taskController.getTasks);
router.get('/tasks/:id', requireOnboardingView, taskController.getTask);
router.put('/tasks/:id/status', requireOnboardingAccess, taskController.updateTaskStatus);
router.post('/tasks/:id/assign', requireOnboardingAccess, taskController.assignTask); // Changed to POST for consistency
router.put('/tasks/bulk', requireOnboardingAccess, taskController.bulkUpdateTasks);
router.post('/tasks/:id/notes', requireOnboardingAccess, taskController.addTaskNote);
router.post('/tasks/:id/files', requireOnboardingAccess, upload.single('file'), taskController.uploadTaskFile);
router.get('/tasks/:id/files/:fileId/download', requireOnboardingView, taskController.downloadTaskFile);
router.delete('/tasks/:id/files/:fileId', requireOnboardingAccess, taskController.deleteTaskFile);

// Preboarding portal routes (public with token)
router.get('/preboarding/:token', preboardingController.getPreboardingData);
router.put('/preboarding/:token/tasks/:taskId', preboardingController.updatePreboardingTask);
router.post('/preboarding/:token/tasks/:taskId/files', upload.single('file'), preboardingController.uploadPreboardingFile);
router.post('/preboarding/:token/personal-info', preboardingController.submitPersonalInfo);
router.get('/preboarding/:token/progress', preboardingController.getPreboardingProgress);

// Admin preboarding management
router.post('/pipelines/:id/regenerate-token', requireOnboardingAccess, preboardingController.regeneratePreboardingToken);

// DEBUG: Temporary debug endpoint
router.get('/debug/tasks', async (req, res) => {
  try {
    const OnboardingTask = require('../models/OnboardingTask');
    const OnboardingPipeline = require('../models/OnboardingPipeline');
    
    console.log('DEBUG /debug/tasks - User org:', req.user.organization);
    
    const allTasks = await OnboardingTask.find({ organization: req.user.organization });
    const allPipelines = await OnboardingPipeline.find({ organization: req.user.organization });
    
    console.log('DEBUG /debug/tasks - Tasks found:', allTasks.length);
    console.log('DEBUG /debug/tasks - Pipelines found:', allPipelines.length);
    
    res.json({
      message: 'Debug info',
      organization: req.user.organization,
      userRole: req.user.role,
      tasksCount: allTasks.length,
      pipelinesCount: allPipelines.length,
      tasks: allTasks.map(t => ({
        id: t._id,
        title: t.title,
        status: t.status,
        assignedRole: t.assignedRole,
        onboarding: t.onboarding,
        organization: t.organization
      })),
      pipelines: allPipelines.map(p => ({
        id: p._id,
        newHire: p.newHire,
        currentStage: p.currentStage,
        tasksInPipeline: p.tasks?.length || 0,
        totalTasksCount: p.totalTasksCount
      }))
    });
  } catch (error) {
    console.error('DEBUG /debug/tasks - Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resend onboarding welcome email
router.post('/pipelines/:id/resend-email', requireOnboardingAccess, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the onboarding pipeline with populated user and organization
    const OnboardingPipeline = require('../models/OnboardingPipeline');
    const User = require('../models/User');
    const Organization = require('../models/Organization');
    
    const pipeline = await OnboardingPipeline.findById(id);
    if (!pipeline) {
      return res.status(404).json({ message: 'Onboarding pipeline not found' });
    }
    
    // Check if pipeline belongs to user's organization
    if (pipeline.organization.toString() !== req.user.organization.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Get the new hire user and organization details
    const [newHire, organization] = await Promise.all([
      User.findById(pipeline.newHire),
      Organization.findById(pipeline.organization)
    ]);
    
    if (!newHire) {
      return res.status(404).json({ message: 'New hire user not found' });
    }
    
    if (!organization) {
      return res.status(404).json({ message: 'Organization not found' });
    }
    
    // Send the onboarding welcome email
    const emailService = require('../services/emailService');
    
    const emailResult = await emailService.sendOnboardingWelcomeEmail({
      organization,
      newHire,
      onboardingPipeline: pipeline,
      preboardingToken: pipeline.preboardingToken,
      manager: null // TODO: Fetch manager if available
    });
    
    res.json({
      success: true,
      message: `Onboarding welcome email resent to ${newHire.email}`,
      messageId: emailResult.messageId,
      recipient: newHire.email
    });
    
  } catch (error) {
    console.error('Error resending onboarding email:', error);
    res.status(500).json({ 
      message: 'Failed to resend onboarding email', 
      error: error.message 
    });
  }
});

module.exports = router;