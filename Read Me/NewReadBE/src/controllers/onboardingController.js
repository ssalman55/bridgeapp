// Ultra-simple onboarding controller for deployment stability
const OnboardingTemplate = require('../models/OnboardingTemplate');
const OnboardingPipeline = require('../models/OnboardingPipeline');
const OnboardingTask = require('../models/OnboardingTask');

// Templates
function getTemplates(req, res) {
  OnboardingTemplate.find({ organization: req.user.organization })
    .then(templates => {
      res.json({
        templates,
        pagination: {
          page: 1,
          limit: 10,
          total: templates.length,
          pages: 1
        }
      });
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error fetching templates', 
        error: error.message 
      });
    });
}

function getTemplate(req, res) {
  OnboardingTemplate.findOne({
    _id: req.params.id,
    organization: req.user.organization
  })
    .then(template => {
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      res.json(template);
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error fetching template', 
        error: error.message 
      });
    });
}

function createTemplate(req, res) {
  const templateData = {
    ...req.body,
    organization: req.user.organization,
    createdBy: req.user._id,
    updatedBy: req.user._id
  };
  
  OnboardingTemplate.create(templateData)
    .then(template => {
      res.status(201).json(template);
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error creating template', 
        error: error.message 
      });
    });
}

function updateTemplate(req, res) {
  OnboardingTemplate.findOneAndUpdate(
    {
      _id: req.params.id,
      organization: req.user.organization
    },
    {
      ...req.body,
      updatedBy: req.user._id,
      updatedAt: new Date()
    },
    { new: true }
  )
    .then(template => {
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      res.json(template);
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error updating template', 
        error: error.message 
      });
    });
}

function deleteTemplate(req, res) {
  OnboardingTemplate.findOne({
    _id: req.params.id,
    organization: req.user.organization
  })
    .then(template => {
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      
      // First, delete all tasks associated with pipelines that used this template
      const OnboardingTask = require('../models/OnboardingTask');
      const OnboardingPipeline = require('../models/OnboardingPipeline');
      
      return OnboardingPipeline.find({ 
        template: req.params.id,
        organization: req.user.organization 
      })
        .then(pipelines => {
          const pipelineIds = pipelines.map(p => p._id);
          console.log(`DEBUG deleteTemplate - Found ${pipelines.length} pipelines using this template`);
          
          // Delete all tasks associated with these pipelines
          return OnboardingTask.deleteMany({
            onboarding: { $in: pipelineIds },
            organization: req.user.organization
          })
            .then(deleteResult => {
              console.log(`DEBUG deleteTemplate - Deleted ${deleteResult.deletedCount} tasks`);
              
              // Delete the pipelines themselves
              return OnboardingPipeline.deleteMany({
                _id: { $in: pipelineIds },
                organization: req.user.organization
              })
                .then(pipelineDeleteResult => {
                  console.log(`DEBUG deleteTemplate - Deleted ${pipelineDeleteResult.deletedCount} pipelines`);
                  
                  // Finally, delete the template
                  return template.deleteOne();
                });
            });
        });
    })
    .then(() => {
      res.json({ message: 'Template and all associated pipelines and tasks deleted successfully' });
    })
    .catch(error => {
      console.error('DEBUG deleteTemplate - Error:', error);
      res.status(500).json({ 
        message: 'Error deleting template', 
        error: error.message 
      });
    });
}

// Pipelines
function getPipelines(req, res) {
  OnboardingPipeline.find({
    organization: req.user.organization
  })
    .populate('newHire', 'fullName email')
    .then(async pipelines => {
      // Update progress for each pipeline based on actual tasks
      const OnboardingTask = require('../models/OnboardingTask');
      
      for (let pipeline of pipelines) {
        const tasks = await OnboardingTask.find({ onboarding: pipeline._id });
        const completedTasks = tasks.filter(task => task.status === 'completed').length;
        const totalTasks = tasks.length;
        
        pipeline.completedTasksCount = completedTasks;
        pipeline.totalTasksCount = totalTasks;
        pipeline.progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      }
      
      res.json({
        pipelines,
        pagination: {
          page: 1,
          limit: 10,
          total: pipelines.length,
          pages: 1
        }
      });
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error fetching pipelines', 
        error: error.message 
      });
    });
}

function getPipeline(req, res) {
  OnboardingPipeline.findOne({
    _id: req.params.id,
    organization: req.user.organization
  })
    .populate('newHire', 'fullName email')
    .populate('manager', 'fullName email')
    .populate('template', 'name description')
    .then(async pipeline => {
      if (!pipeline) {
        return res.status(404).json({ message: 'Pipeline not found' });
      }
      
      // Update progress based on actual tasks
      const OnboardingTask = require('../models/OnboardingTask');
      const tasks = await OnboardingTask.find({ onboarding: pipeline._id });
      const completedTasks = tasks.filter(task => task.status === 'completed').length;
      const totalTasks = tasks.length;
      
      pipeline.completedTasksCount = completedTasks;
      pipeline.totalTasksCount = totalTasks;
      pipeline.progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      
      res.json(pipeline);
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error fetching pipeline', 
        error: error.message 
      });
    });
}

function createPipeline(req, res) {
  const { 
    templateId, 
    position, 
    department, 
    location, 
    startDate,
    firstName,
    lastName,
    email,
    phone,
    managerId 
  } = req.body;
  
  // Basic validation
  if (!templateId || !position || !startDate || !firstName || !lastName || !email) {
    return res.status(400).json({ 
      message: 'Missing required fields: templateId, position, startDate, firstName, lastName, email' 
    });
  }
  
  // First, create a User record for the new hire
  const User = require('../models/User');
  const newHireData = {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email,
    phone: phone || '',
    organization: req.user.organization,
    department: department || 'General',
    role: 'staff', // Default role for new hires
    isActive: false, // Not active until onboarding completes
    ssoOnly: false, // Allow password to be set later during onboarding
    profileImage: '',
    isEmailVerified: false,
    // Add a temporary password field to pass validation, will be updated during onboarding
    password: 'temp_password_' + Date.now()
    // Note: Real password will be set during the onboarding process
  };
  
  // Store references for later use in email sending
  let createdUser = null;
  let createdPipeline = null;
  
  User.create(newHireData)
    .then(newUser => {
      createdUser = newUser; // Store for later use
      // Fetch the template to get checklist items
      const OnboardingTemplate = require('../models/OnboardingTemplate');
      return OnboardingTemplate.findById(templateId)
        .then(template => {
          if (!template) {
            throw new Error('Template not found');
          }
          
          // Generate tasks from template checklist items
          const tasks = template.checklistItems.map((item, index) => {
            const dueDate = new Date(startDate);
            dueDate.setDate(dueDate.getDate() + item.relativeDueDate);
            
            // Determine category based on due date relative to start date
            let category = 'setup';
            if (item.relativeDueDate < 0) {
              category = 'preboarding'; // Tasks due before start date
            } else if (item.relativeDueDate <= 7) {
              category = 'setup'; // Tasks due within first week
            } else if (item.relativeDueDate <= 30) {
              category = 'compliance'; // Tasks due within first month
            } else {
              category = 'training'; // Tasks due later
            }
            
            return {
              id: `task_${Date.now()}_${index}`,
              templateItemId: item.id,
              title: item.title,
              description: item.description || '',
              taskType: item.taskType,
              status: 'pending',
              assignedRole: item.ownerRole || 'new-hire', // Default to new-hire if not specified
              category: category,
              dueDate: dueDate,
              slaHours: item.slaHours || 24,
              isOverdue: false,
              dependencies: [], // TODO: Convert string dependencies to proper object format
              dependencyStatus: 'ready',
              metadata: item.metadata || {},
              notes: [],
              files: []
            };
          });
          
          // Now create the onboarding pipeline with the new user and generated tasks
          const pipelineData = {
            template: templateId,
            templateSnapshot: template.toObject(), // Save template snapshot
            organization: req.user.organization,
            newHire: newUser._id, // Use the newly created user
            position,
            department: department || 'General',
            location: location || '',
            startDate: new Date(startDate),
            currentStage: 'offer-accepted',
            priority: 'normal',
            tasks: tasks,
            completedTasksCount: 0,
            totalTasksCount: tasks.length,
        progressPercentage: 0,
        preboardingCompleted: false,
        preboardingToken: 'pb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        equipmentAssigned: [],
            documents: [],
            stageHistory: [{
              stage: 'offer-accepted',
              enteredAt: new Date(),
              enteredBy: req.user._id,
              notes: `Onboarding created for ${firstName} ${lastName}`
            }],
            blockers: [],
            kpis: {},
            auditLog: [{
              action: 'pipeline_created',
              performedBy: req.user._id,
              timestamp: new Date(),
              details: `Created onboarding pipeline for ${firstName} ${lastName} in ${position} position`
            }],
            createdBy: req.user._id,
            // Store new hire info in metadata for reference
            metadata: {
              newHireInfo: {
                firstName,
                lastName, 
                email,
                phone: phone || '',
                fullName: `${firstName} ${lastName}`
              }
            }
          };
          
          // Create the onboarding pipeline
          return OnboardingPipeline.create(pipelineData)
            .then(pipeline => {
              createdPipeline = pipeline; // Store for later use
              console.log('DEBUG createPipeline - Pipeline created:', pipeline._id);
              console.log('DEBUG createPipeline - Tasks to create:', tasks.length);
              
              // Create individual OnboardingTask documents for each task
              const OnboardingTask = require('../models/OnboardingTask');
              const taskPromises = tasks.map((task, index) => {
                console.log(`DEBUG createPipeline - Creating task ${index + 1}:`, task.title);
                return OnboardingTask.create({
                  ...task,
                  onboarding: pipeline._id,
                  organization: req.user.organization,
                  createdBy: req.user._id,
                  updatedBy: req.user._id
                });
              });
              
              return Promise.all(taskPromises)
                .then(createdTasks => {
                  console.log('DEBUG createPipeline - Tasks created successfully:', createdTasks.length);
                  console.log('DEBUG createPipeline - Sample task IDs:', createdTasks.map(t => t._id));
                  return pipeline;
                })
                .catch(taskError => {
                  console.error('DEBUG createPipeline - Error creating tasks:', taskError);
                  throw taskError;
                });
            });
        });
    })
    .then(pipeline => {
      // Send welcome email to new hire after successful pipeline creation
      const emailService = require('../services/emailService');
      const Organization = require('../models/Organization');
      
      // Get organization details and send email asynchronously
      Organization.findById(req.user.organization)
        .then(organization => {
          if (organization && createdUser && createdUser.email) {
            console.log('DEBUG createPipeline - Sending welcome email to:', createdUser.email);
            
            // Send onboarding welcome email
            emailService.sendOnboardingWelcomeEmail({
              organization,
              newHire: createdUser,
              onboardingPipeline: createdPipeline,
              preboardingToken: createdPipeline.preboardingToken,
              manager: null // TODO: Fetch manager if managerId is provided
            })
            .then(emailResult => {
              console.log('✅ Onboarding welcome email sent successfully:', emailResult.messageId);
            })
            .catch(emailError => {
              console.error('❌ Failed to send onboarding welcome email:', emailError.message);
              // Don't fail the pipeline creation if email fails
            });
          }
        })
        .catch(orgError => {
          console.error('❌ Failed to fetch organization for email:', orgError.message);
        });
      
      // Return success response immediately (don't wait for email)
      res.status(201).json({
        ...pipeline.toObject(),
        // Return friendly response
        message: `Onboarding pipeline created successfully for ${firstName} ${lastName}`,
        newHireName: `${firstName} ${lastName}`,
        position,
        startDate,
        emailSent: true // Indicate that email sending was initiated
      });
    })
    .catch(error => {
      console.error('Error creating pipeline:', error);
      
      // Handle specific error types
      if (error.code === 11000) {
        // Duplicate key error
        if (error.keyPattern && error.keyPattern.email) {
          return res.status(400).json({ 
            message: 'A user with this email already exists in your organization',
            error: 'DUPLICATE_EMAIL'
          });
        } else if (error.keyPattern && error.keyPattern.newHire) {
          return res.status(400).json({ 
            message: 'An onboarding pipeline already exists for this user',
            error: 'DUPLICATE_ONBOARDING'
          });
        }
      }
      
      res.status(500).json({ 
        message: 'Error creating onboarding pipeline', 
        error: error.message,
        details: 'Please check that all information is correct and the template exists'
      });
    });
}

function updatePipelineStage(req, res) {
  const { stage } = req.body;
  
  OnboardingPipeline.findOneAndUpdate(
    {
      _id: req.params.id,
      organization: req.user.organization
    },
    {
      currentStage: stage,
      updatedAt: new Date()
    },
    { new: true }
  )
    .then(pipeline => {
      if (!pipeline) {
        return res.status(404).json({ message: 'Pipeline not found' });
      }
      res.json(pipeline);
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error updating pipeline stage', 
        error: error.message 
      });
    });
}

function deletePipeline(req, res) {
  OnboardingPipeline.findOne({
    _id: req.params.id,
    organization: req.user.organization
  })
    .then(pipeline => {
      if (!pipeline) {
        return res.status(404).json({ message: 'Pipeline not found' });
      }
      
      // First, delete all tasks associated with this pipeline
      const OnboardingTask = require('../models/OnboardingTask');
      
      return OnboardingTask.deleteMany({
        onboarding: req.params.id,
        organization: req.user.organization
      })
        .then(deleteResult => {
          console.log(`DEBUG deletePipeline - Deleted ${deleteResult.deletedCount} tasks for pipeline ${req.params.id}`);
          
          // Then delete the pipeline itself
          return pipeline.deleteOne();
        });
    })
    .then(() => {
      res.json({ message: 'Pipeline and all associated tasks deleted successfully' });
    })
    .catch(error => {
      console.error('DEBUG deletePipeline - Error:', error);
      res.status(500).json({ 
        message: 'Error deleting pipeline', 
        error: error.message 
      });
    });
}

// Utility function to clean up orphaned tasks
function cleanupOrphanedTasks(req, res) {
  const OnboardingTask = require('../models/OnboardingTask');
  const OnboardingPipeline = require('../models/OnboardingPipeline');
  
  // Find all tasks that reference non-existent pipelines
  OnboardingTask.find({ organization: req.user.organization })
    .then(allTasks => {
      console.log(`DEBUG cleanupOrphanedTasks - Found ${allTasks.length} total tasks`);
      
      // Get all existing pipeline IDs
      return OnboardingPipeline.find({ organization: req.user.organization })
        .select('_id')
        .then(existingPipelines => {
          const existingPipelineIds = existingPipelines.map(p => p._id.toString());
          console.log(`DEBUG cleanupOrphanedTasks - Found ${existingPipelineIds.length} existing pipelines`);
          
          // Find orphaned tasks
          const orphanedTasks = allTasks.filter(task => {
            const taskPipelineId = task.onboarding.toString();
            return !existingPipelineIds.includes(taskPipelineId);
          });
          
          console.log(`DEBUG cleanupOrphanedTasks - Found ${orphanedTasks.length} orphaned tasks`);
          
          if (orphanedTasks.length === 0) {
            return res.json({ 
              message: 'No orphaned tasks found',
              deletedCount: 0
            });
          }
          
          // Delete orphaned tasks
          const orphanedTaskIds = orphanedTasks.map(t => t._id);
          return OnboardingTask.deleteMany({
            _id: { $in: orphanedTaskIds },
            organization: req.user.organization
          })
            .then(deleteResult => {
              console.log(`DEBUG cleanupOrphanedTasks - Deleted ${deleteResult.deletedCount} orphaned tasks`);
              res.json({ 
                message: `Cleaned up ${deleteResult.deletedCount} orphaned tasks`,
                deletedCount: deleteResult.deletedCount
              });
            });
        });
    })
    .catch(error => {
      console.error('DEBUG cleanupOrphanedTasks - Error:', error);
      res.status(500).json({ 
        message: 'Error cleaning up orphaned tasks', 
        error: error.message 
      });
    });
}

// Analytics
function getDashboard(req, res) {
  const organization = req.user.organization._id;
  const { timeframe = '30' } = req.query;
  
  // Calculate date range for timeframe
  const daysAgo = parseInt(timeframe);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysAgo);
  
  Promise.all([
    // Overview metrics
    OnboardingPipeline.countDocuments({ 
      organization, 
      currentStage: { $nin: ['on-hold', 'withdrawn'] } 
    }),
    // Count pipelines that completed onboarding (reached day-1 stage) in the last 30 days
    OnboardingPipeline.countDocuments({ 
      organization,
      currentStage: 'day-1',
      'stageHistory': {
        $elemMatch: {
          stage: 'day-1',
          timestamp: { $gte: startDate }
        }
      }
    }),
    OnboardingPipeline.countDocuments({ 
      organization,
      startDate: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    }),
    
    // Stage distribution
    OnboardingPipeline.aggregate([
      { $match: { organization: organization } },
      { $group: { _id: '$currentStage', count: { $sum: 1 } } }
    ]),
    
    // Task summary with better overdue calculation
    OnboardingTask.aggregate([
      { $match: { organization: organization } },
      { $addFields: {
        isActuallyOverdue: {
          $and: [
            { $ne: ['$dueDate', null] },
            { $lt: ['$dueDate', new Date()] },
            { $ne: ['$status', 'completed'] }
          ]
        }
      }},
      { $group: { 
        _id: '$taskType', 
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        overdue: { $sum: { $cond: ['$isActuallyOverdue', 1, 0] } }
      }},
      { $sort: { total: -1 } }
    ]),
    
    // Recent activity
    OnboardingPipeline.find({ organization })
      .populate('newHire', 'fullName email')
      .sort({ updatedAt: -1 })
      .limit(5)
  ])
    .then(([
      totalActive,
      completedThisMonth,
      upcomingStarts,
      stageDistribution,
      taskSummary,
      recentActivity
    ]) => {
      res.json({
        overview: {
          totalActive,
          completedThisMonth,
          overdueCount: taskSummary.reduce((sum, task) => sum + task.overdue, 0),
          upcomingStarts
        },
        stageDistribution: stageDistribution || [],
        recentActivity: recentActivity.map(pipeline => ({
          _id: pipeline._id,
          newHire: pipeline.newHire || { fullName: 'Unknown User', email: 'unknown@example.com' },
          currentStage: pipeline.currentStage,
          updatedAt: pipeline.updatedAt
        })),
        taskSummary: taskSummary || []
      });
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error fetching dashboard data', 
        error: error.message 
      });
    });
}

function getReports(req, res) {
  const { type = 'overview' } = req.query;
  const organization = req.user.organization;
  
  OnboardingPipeline.find({ organization })
    .then(data => {
      res.json({
        type,
        data: data.length,
        message: 'Reports endpoint - basic implementation'
      });
    })
    .catch(error => {
      res.status(500).json({ 
        message: 'Error generating reports', 
        error: error.message 
      });
    });
}

// Export using basic module.exports
module.exports = {
  getTemplates: getTemplates,
  getTemplate: getTemplate,
  createTemplate: createTemplate,
  updateTemplate: updateTemplate,
  deleteTemplate: deleteTemplate,
  getPipelines: getPipelines,
  getPipeline: getPipeline,
  createPipeline: createPipeline,
  updatePipelineStage: updatePipelineStage,
  deletePipeline: deletePipeline,
  cleanupOrphanedTasks: cleanupOrphanedTasks,
  getDashboard: getDashboard,
  getReports: getReports
};