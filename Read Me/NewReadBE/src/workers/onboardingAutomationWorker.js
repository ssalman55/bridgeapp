const cron = require('node-cron');
const OnboardingAutomationService = require('../services/onboardingAutomationService');

class OnboardingAutomationWorker {
  constructor() {
    this.automationService = new OnboardingAutomationService();
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) {
      console.log('[AUTOMATION WORKER] Already running');
      return;
    }

    console.log('[AUTOMATION WORKER] Starting automation worker...');
    this.isRunning = true;

    // Daily check at 6 AM
    this.dailyJob = cron.schedule('0 6 * * *', async () => {
      console.log('[AUTOMATION WORKER] Running daily checks...');
      try {
        await this.automationService.runDailyChecks();
      } catch (error) {
        console.error('[AUTOMATION WORKER] Error in daily checks:', error);
      }
    });

    // Hourly checks
    this.hourlyJob = cron.schedule('0 * * * *', async () => {
      console.log('[AUTOMATION WORKER] Running hourly checks...');
      try {
        await this.automationService.runHourlyChecks();
      } catch (error) {
        console.error('[AUTOMATION WORKER] Error in hourly checks:', error);
      }
    });

    // Every 15 minutes - SLA monitoring
    this.slaJob = cron.schedule('*/15 * * * *', async () => {
      try {
        await this.checkSLAs();
      } catch (error) {
        console.error('[AUTOMATION WORKER] Error in SLA checks:', error);
      }
    });

    console.log('[AUTOMATION WORKER] Automation worker started successfully');
    console.log('[AUTOMATION WORKER] - Daily checks: 6:00 AM every day');
    console.log('[AUTOMATION WORKER] - Hourly checks: Every hour');
    console.log('[AUTOMATION WORKER] - SLA monitoring: Every 15 minutes');
  }

  stop() {
    if (!this.isRunning) {
      console.log('[AUTOMATION WORKER] Not running');
      return;
    }

    console.log('[AUTOMATION WORKER] Stopping automation worker...');
    
    if (this.dailyJob) {
      this.dailyJob.stop();
    }
    
    if (this.hourlyJob) {
      this.hourlyJob.stop();
    }
    
    if (this.slaJob) {
      this.slaJob.stop();
    }

    this.isRunning = false;
    console.log('[AUTOMATION WORKER] Automation worker stopped');
  }

  async checkSLAs() {
    const OnboardingTask = require('../models/OnboardingTask');
    
    try {
      // Find tasks approaching SLA deadline (within 2 hours)
      const approachingSLA = await OnboardingTask.find({
        status: { $nin: ['completed', 'rejected'] },
        isOverdue: false,
        dueDate: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 2 * 60 * 60 * 1000) // Next 2 hours
        }
      }).populate('onboarding');

      for (const task of approachingSLA) {
        // Trigger SLA warning automation
        await this.automationService.executeAutomations('task-sla-warning', {
          task,
          onboarding: task.onboarding,
          organization: task.organization
        });
      }

      // Find newly overdue tasks
      const newlyOverdue = await OnboardingTask.find({
        status: { $nin: ['completed', 'rejected'] },
        isOverdue: false,
        dueDate: { $lt: new Date() }
      }).populate('onboarding');

      for (const task of newlyOverdue) {
        task.isOverdue = true;
        await task.save();

        // Trigger overdue automation
        await this.automationService.executeAutomations('task-overdue', {
          task,
          onboarding: task.onboarding,
          organization: task.organization
        });
      }

      if (approachingSLA.length > 0 || newlyOverdue.length > 0) {
        console.log(`[AUTOMATION WORKER] SLA Check: ${approachingSLA.length} approaching, ${newlyOverdue.length} newly overdue`);
      }
    } catch (error) {
      console.error('[AUTOMATION WORKER] Error checking SLAs:', error);
    }
  }

  // Method to trigger automation manually
  async triggerAutomation(event, data) {
    try {
      console.log(`[AUTOMATION WORKER] Manual trigger: ${event}`);
      const results = await this.automationService.executeAutomations(event, data);
      console.log(`[AUTOMATION WORKER] Executed ${results.length} automations`);
      return results;
    } catch (error) {
      console.error('[AUTOMATION WORKER] Error in manual trigger:', error);
      throw error;
    }
  }

  // Get worker status
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: {
        daily: this.dailyJob ? 'active' : 'inactive',
        hourly: this.hourlyJob ? 'active' : 'inactive',
        sla: this.slaJob ? 'active' : 'inactive'
      }
    };
  }
}

// Export singleton instance
const worker = new OnboardingAutomationWorker();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[AUTOMATION WORKER] Received SIGINT, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[AUTOMATION WORKER] Received SIGTERM, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

module.exports = worker;







