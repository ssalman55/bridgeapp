const OnboardingAutomation = require('../models/OnboardingAutomation');
const OnboardingPipeline = require('../models/OnboardingPipeline');
const OnboardingTask = require('../models/OnboardingTask');
const {
  ESignatureService,
  IdentityProvisioningService,
  EquipmentService,
  TrainingService,
  NotificationService,
  WebhookService
} = require('./onboardingIntegrationService');

class OnboardingAutomationService {
  constructor() {
    this.eSignService = new ESignatureService();
    this.identityService = new IdentityProvisioningService();
    this.equipmentService = new EquipmentService();
    this.trainingService = new TrainingService();
    this.notificationService = new NotificationService();
    this.webhookService = new WebhookService();
  }

  /**
   * Execute automations based on trigger event
   */
  async executeAutomations(event, data) {
    try {
      console.log(`[AUTOMATION] Executing automations for event: ${event}`);
      
      const automations = await OnboardingAutomation.find({
        'trigger.event': event,
        isActive: true,
        organization: data.organization
      });

      const results = [];

      for (const automation of automations) {
        try {
          const shouldExecute = await this.evaluateConditions(automation, data);
          
          if (shouldExecute) {
            const result = await this.executeAutomationActions(automation, data);
            results.push({
              automationId: automation._id,
              name: automation.name,
              success: true,
              result
            });

            // Update execution history
            automation.executionHistory.push({
              onboardingId: data.onboarding?._id,
              executedAt: new Date(),
              success: true,
              actionsExecuted: automation.actions.length
            });

            automation.stats.totalExecutions += 1;
            automation.stats.successfulExecutions += 1;
            automation.stats.lastExecutedAt = new Date();

            await automation.save();
          }
        } catch (error) {
          console.error(`[AUTOMATION] Error executing automation ${automation.name}:`, error);
          
          // Log failed execution
          automation.executionHistory.push({
            onboardingId: data.onboarding?._id,
            executedAt: new Date(),
            success: false,
            error: error.message
          });

          automation.stats.totalExecutions += 1;
          await automation.save();

          results.push({
            automationId: automation._id,
            name: automation.name,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      console.error('[AUTOMATION] Error in executeAutomations:', error);
      throw error;
    }
  }

  /**
   * Evaluate if automation conditions are met
   */
  async evaluateConditions(automation, data) {
    if (!automation.trigger.conditions || automation.trigger.conditions.length === 0) {
      return true; // No conditions means always execute
    }

    for (const condition of automation.trigger.conditions) {
      const result = await this.evaluateCondition(condition, data);
      if (!result) {
        return false; // All conditions must be true
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  async evaluateCondition(condition, data) {
    const { type, field, operator, value } = condition;

    switch (type) {
      case 'stage-change':
        return data.stage === value || data.newStage === value;
        
      case 'task-status':
        if (data.task) {
          return this.compareValues(data.task.status, operator, value);
        }
        return false;
        
      case 'document-signed':
        if (data.document) {
          return data.document.status === 'signed' || data.document.status === 'completed';
        }
        return false;
        
      case 'day-offset':
        if (data.onboarding) {
          const startDate = new Date(data.onboarding.startDate);
          const currentDate = new Date();
          const daysDiff = Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));
          return this.compareValues(daysDiff, operator, value);
        }
        return false;
        
      case 'overdue':
        if (data.task) {
          return data.task.isOverdue === true;
        }
        return false;
        
      case 'field-value':
        const fieldValue = this.getNestedValue(data, field);
        return this.compareValues(fieldValue, operator, value);
        
      default:
        return false;
    }
  }

  /**
   * Execute automation actions
   */
  async executeAutomationActions(automation, data) {
    const results = [];

    for (const action of automation.actions) {
      try {
        if (action.delayMinutes > 0) {
          // In a real implementation, you'd schedule this for later execution
          console.log(`[AUTOMATION] Scheduling action ${action.type} for ${action.delayMinutes} minutes later`);
        }

        const result = await this.executeAction(action, data);
        results.push({
          actionType: action.type,
          success: true,
          result
        });
      } catch (error) {
        console.error(`[AUTOMATION] Error executing action ${action.type}:`, error);
        results.push({
          actionType: action.type,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Execute a single action
   */
  async executeAction(action, data) {
    const { type, config } = action;

    switch (type) {
      case 'send-email':
        return await this.executeEmailAction(config, data);
        
      case 'provision-account':
        return await this.executeProvisionAccountAction(config, data);
        
      case 'assign-equipment':
        return await this.executeAssignEquipmentAction(config, data);
        
      case 'enroll-training':
        return await this.executeEnrollTrainingAction(config, data);
        
      case 'escalate':
        return await this.executeEscalateAction(config, data);
        
      case 'webhook':
        return await this.executeWebhookAction(config, data);
        
      case 'create-ticket':
        return await this.executeCreateTicketAction(config, data);
        
      case 'update-field':
        return await this.executeUpdateFieldAction(config, data);
        
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  /**
   * Action Implementations
   */
  async executeEmailAction(config, data) {
    const { template, to, subject, variables } = config;
    
    // Resolve recipient
    let recipient = to;
    if (to === 'new-hire' && data.onboarding) {
      const pipeline = await OnboardingPipeline.findById(data.onboarding._id).populate('newHire');
      recipient = pipeline.newHire.email;
    } else if (to === 'manager' && data.onboarding) {
      const pipeline = await OnboardingPipeline.findById(data.onboarding._id).populate('manager');
      recipient = pipeline.manager?.email;
    }

    // Replace variables in subject and template
    const processedSubject = this.replaceVariables(subject, data, variables);
    
    return await this.notificationService.sendEmail(
      recipient,
      processedSubject,
      template,
      { ...data, ...variables }
    );
  }

  async executeProvisionAccountAction(config, data) {
    if (!data.onboarding) {
      throw new Error('Onboarding data required for account provisioning');
    }

    const pipeline = await OnboardingPipeline.findById(data.onboarding._id)
      .populate('newHire')
      .populate('manager');

    const userData = {
      firstName: pipeline.newHire.firstName,
      lastName: pipeline.newHire.lastName,
      email: pipeline.newHire.email,
      department: pipeline.department,
      role: pipeline.position,
      manager: pipeline.manager?.email
    };

    // Create account
    const accountResult = await this.identityService.createUserAccount(userData);
    
    // Provision email if requested
    if (config.includeEmail) {
      const emailResult = await this.identityService.provisionEmail(userData);
      accountResult.emailProvisioning = emailResult;
    }

    return accountResult;
  }

  async executeAssignEquipmentAction(config, data) {
    if (!data.onboarding) {
      throw new Error('Onboarding data required for equipment assignment');
    }

    const pipeline = await OnboardingPipeline.findById(data.onboarding._id).populate('newHire');
    const { equipmentCategories, equipmentIds } = config;

    let equipmentToAssign = [];

    if (equipmentIds && equipmentIds.length > 0) {
      equipmentToAssign = equipmentIds;
    } else if (equipmentCategories && equipmentCategories.length > 0) {
      // Get available equipment for each category
      for (const category of equipmentCategories) {
        const available = await this.equipmentService.getAvailableEquipment(category);
        if (available.length > 0) {
          equipmentToAssign.push(available[0].id); // Take first available
        }
      }
    }

    if (equipmentToAssign.length === 0) {
      throw new Error('No equipment available for assignment');
    }

    const result = await this.equipmentService.reserveEquipment(
      equipmentToAssign,
      pipeline.newHire.email
    );

    // Update pipeline with equipment assignment
    pipeline.equipmentAssigned.push({
      itemId: result.reservationId,
      itemName: 'Equipment Package',
      assignedAt: new Date(),
      assignedBy: data.performedBy,
      status: 'reserved'
    });

    await pipeline.save();

    return result;
  }

  async executeEnrollTrainingAction(config, data) {
    if (!data.onboarding) {
      throw new Error('Onboarding data required for training enrollment');
    }

    const pipeline = await OnboardingPipeline.findById(data.onboarding._id).populate('newHire');
    const { courseIds, mandatory } = config;

    const enrollmentResults = [];

    // Enroll in specified courses
    if (courseIds && courseIds.length > 0) {
      for (const courseId of courseIds) {
        const result = await this.trainingService.enrollInCourse(
          pipeline.newHire.email,
          courseId,
          `Course ${courseId}`
        );
        enrollmentResults.push(result);
      }
    }

    // Enroll in mandatory courses if requested
    if (mandatory) {
      const mandatoryCourses = await this.trainingService.getMandatoryCourses(
        pipeline.department,
        pipeline.position
      );

      for (const course of mandatoryCourses) {
        const result = await this.trainingService.enrollInCourse(
          pipeline.newHire.email,
          course.id,
          course.name
        );
        enrollmentResults.push(result);
      }
    }

    return { enrollments: enrollmentResults };
  }

  async executeEscalateAction(config, data) {
    const { escalateTo, message, priority } = config;
    
    // Send escalation email
    const escalationMessage = this.replaceVariables(
      message || 'Onboarding task requires attention',
      data
    );

    return await this.notificationService.sendEmail(
      escalateTo,
      `Onboarding Escalation - ${priority || 'Normal'} Priority`,
      'escalation',
      { message: escalationMessage, data }
    );
  }

  async executeWebhookAction(config, data) {
    const { url, headers, payload } = config;
    
    const processedPayload = {
      ...payload,
      data,
      timestamp: new Date().toISOString()
    };

    return await this.webhookService.sendWebhook(url, processedPayload, headers);
  }

  async executeCreateTicketAction(config, data) {
    const { system, title, description, assignee } = config;
    
    console.log(`[AUTOMATION] Creating ticket in ${system}`);
    console.log(`Title: ${this.replaceVariables(title, data)}`);
    console.log(`Assignee: ${assignee}`);
    
    // Mock ticket creation
    return {
      ticketId: `ticket_${Date.now()}`,
      system,
      title: this.replaceVariables(title, data),
      status: 'created'
    };
  }

  async executeUpdateFieldAction(config, data) {
    const { model, field, value } = config;
    
    if (model === 'onboarding' && data.onboarding) {
      const pipeline = await OnboardingPipeline.findById(data.onboarding._id);
      pipeline[field] = this.replaceVariables(value, data);
      await pipeline.save();
      return { updated: true, field, value };
    }
    
    throw new Error(`Unsupported model for field update: ${model}`);
  }

  /**
   * Utility methods
   */
  compareValues(actual, operator, expected) {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'not-equals':
        return actual !== expected;
      case 'contains':
        return String(actual).includes(String(expected));
      case 'greater-than':
        return Number(actual) > Number(expected);
      case 'less-than':
        return Number(actual) < Number(expected);
      case 'before':
        return new Date(actual) < new Date(expected);
      case 'after':
        return new Date(actual) > new Date(expected);
      default:
        return false;
    }
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  replaceVariables(template, data, variables = {}) {
    if (!template) return '';
    
    const allVariables = { ...data, ...variables };
    
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(allVariables, path);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Daily job to check for due tasks and overdue items
   */
  async runDailyChecks() {
    console.log('[AUTOMATION] Running daily checks...');
    
    try {
      // Find overdue tasks
      const overdueTasks = await OnboardingTask.find({
        status: { $nin: ['completed', 'rejected'] },
        dueDate: { $lt: new Date() },
        isOverdue: false
      }).populate('onboarding');

      // Mark as overdue and trigger automations
      for (const task of overdueTasks) {
        task.isOverdue = true;
        await task.save();

        // Trigger overdue automations
        await this.executeAutomations('task-overdue', {
          task,
          onboarding: task.onboarding,
          organization: task.organization
        });
      }

      // Check for day-offset automations
      const activePipelines = await OnboardingPipeline.find({
        currentStage: { $nin: ['completed', 'withdrawn'] }
      });

      for (const pipeline of activePipelines) {
        await this.executeAutomations('cron-daily', {
          onboarding: pipeline,
          organization: pipeline.organization
        });
      }

      console.log(`[AUTOMATION] Daily checks completed. Processed ${overdueTasks.length} overdue tasks.`);
    } catch (error) {
      console.error('[AUTOMATION] Error in daily checks:', error);
    }
  }

  /**
   * Hourly job for time-sensitive automations
   */
  async runHourlyChecks() {
    console.log('[AUTOMATION] Running hourly checks...');
    
    try {
      const activePipelines = await OnboardingPipeline.find({
        currentStage: { $nin: ['completed', 'withdrawn'] }
      });

      for (const pipeline of activePipelines) {
        await this.executeAutomations('cron-hourly', {
          onboarding: pipeline,
          organization: pipeline.organization
        });
      }

      console.log('[AUTOMATION] Hourly checks completed.');
    } catch (error) {
      console.error('[AUTOMATION] Error in hourly checks:', error);
    }
  }
}

module.exports = OnboardingAutomationService;







