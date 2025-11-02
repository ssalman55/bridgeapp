const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const { authenticateToken } = require('../middleware/auth');
const { checkSubscriptionStatus } = require('../middleware/subscriptionMiddleware');
const permissions = require('../middleware/permissions');

// IMPORTANT: Middleware order matters!
// 1. Authentication must come first to set req.user
// 2. Subscription check uses req.user

// All routes require authentication
router.use(authenticateToken);

// Apply subscription middleware to all salary routes
router.use(checkSubscriptionStatus);

// Salary Grade routes (authentication and subscription already applied)
router.post('/grades', salaryController.createGrade);
router.get('/grades', salaryController.getGrades);
router.put('/grades/:id', salaryController.updateGrade);
router.delete('/grades/:id', salaryController.deleteGrade);

// Salary Structure routes
router.post('/structure', salaryController.createOrUpdateStructure);
router.get('/structure/:staffId', salaryController.getStructure);
router.get('/structures', permissions('Salary', 'view', 'Salary Management'), salaryController.getAllStructures);
router.delete('/structure/:id', salaryController.deleteStructure);
router.patch('/structure/:id/toggle-status', salaryController.toggleStatus);
router.patch('/structure/:id/toggle-lock', salaryController.toggleLock);
router.patch('/structure/:id/status', salaryController.setStatus);
router.patch('/structure/:id/lock', salaryController.setLock);
router.patch('/structure/:id/unlock', salaryController.setUnlock);

// CSV Import route
router.post('/import-csv', salaryController.importSalaryCSV);

// CSV Template download route
router.get('/csv-template', salaryController.downloadSalaryCSVTemplate);

// Flush variable salary fields (admin only)
router.post('/flush-variable-fields', permissions('Salary', 'full', 'Salary Management'), salaryController.flushVariableFields);

module.exports = router; 