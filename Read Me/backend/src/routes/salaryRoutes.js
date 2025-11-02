const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Salary Grade routes
router.post('/grades', authenticateToken, salaryController.createGrade);
router.get('/grades', authenticateToken, salaryController.getGrades);
router.put('/grades/:id', authenticateToken, salaryController.updateGrade);
router.delete('/grades/:id', authenticateToken, salaryController.deleteGrade);

// Salary Structure routes
router.post('/structure', authenticateToken, salaryController.createOrUpdateStructure);
router.get('/structure/:staffId', authenticateToken, salaryController.getStructure);
router.get('/structures', authenticateToken, permissions('Payroll', 'view', 'Salary Management'), salaryController.getAllStructures);
router.delete('/structure/:id', authenticateToken, salaryController.deleteStructure);
router.patch('/structure/:id/toggle-status', authenticateToken, salaryController.toggleStatus);
router.patch('/structure/:id/toggle-lock', authenticateToken, salaryController.toggleLock);
router.patch('/structure/:id/status', authenticateToken, salaryController.setStatus);
router.patch('/structure/:id/lock', authenticateToken, salaryController.setLock);
router.patch('/structure/:id/unlock', authenticateToken, salaryController.setUnlock);

// CSV Import route
router.post('/import-csv', authenticateToken, salaryController.importSalaryCSV);

// CSV Template download route
router.get('/csv-template', authenticateToken, salaryController.downloadSalaryCSVTemplate);

module.exports = router; 