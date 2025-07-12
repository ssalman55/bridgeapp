const express = require('express');
const router = express.Router();
const { submitLeaveRequest, getMyLeaveRequests, getAllLeaveRequests, updateLeaveStatus, getLeaveRecords, getUpcomingApprovedLeaves } = require('../controllers/leaveController');
const { protect, adminOrAcademicAdmin } = require('../middleware/authMiddleware');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const permissions = require('../middleware/permissions');

// Staff: submit leave request
router.post('/', protect, submitLeaveRequest);

// Staff: view their own leave requests
router.get('/my', protect, getMyLeaveRequests);

// Admin/Academic Admin: view all leave requests
router.get('/', protect, permissions('Leave', 'view', 'Leave Management'), getAllLeaveRequests);

// Admin/Academic Admin: approve/reject leave request
router.patch('/:id', protect, permissions('Leave', 'full', 'Leave Management'), updateLeaveStatus);
router.put('/:id', protect, permissions('Leave', 'full', 'Leave Management'), updateLeaveStatus);

// Admin: get leave records for a staff member (for Leave Tracker)
router.get('/leave-records', authenticateToken, permissions('Leave', 'view', 'Leave Tracker'), getLeaveRecords);

// Admin: get upcoming approved leaves
router.get('/upcoming-approved', authenticateToken, permissions('Leave', 'view', 'Upcoming Leaves'), getUpcomingApprovedLeaves);

module.exports = router; 