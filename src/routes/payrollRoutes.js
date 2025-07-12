const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payrollController');
const { authenticateToken } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Generate payroll for a month
router.post('/generate', authenticateToken, permissions('Payroll', 'full', 'Salary Management'), payrollController.generatePayroll);
// Get all payrolls (admin)
router.get('/', authenticateToken, permissions('Payroll', 'view', 'Payroll Management'), payrollController.getPayrolls);
// Mark payroll as paid
router.patch('/:id/mark-paid', authenticateToken, permissions('Payroll', 'full'), payrollController.markAsPaid);
// Get payslip for a payroll
router.get('/:id/payslip', authenticateToken, payrollController.getPayslip);
// Get payslip PDF for a payroll
router.get('/:id/payslip/pdf', authenticateToken, payrollController.getPayslipPDF);
// Get payrolls for logged-in staff
router.get('/my', authenticateToken, payrollController.getMyPayrolls);
// Get payroll audit logs
router.get('/audit', authenticateToken, permissions('Payroll', 'view'), payrollController.getPayrollAuditLogs);

module.exports = router; 