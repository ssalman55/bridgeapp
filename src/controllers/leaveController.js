const LeaveRequest = require('../models/LeaveRequest');
const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

// Staff: Submit a leave request
exports.submitLeaveRequest = asyncHandler(async (req, res) => {
  const { startDate, endDate, reason, leaveType } = req.body;
  const leave = await LeaveRequest.create({
    user: req.user._id,
    organization: req.user.organization._id,
    startDate,
    endDate,
    reason,
    leaveType,
  });

  // Notify all admins in the same organization
  const admins = await User.find({ organization: req.user.organization._id, role: 'admin', status: { $ne: 'archived' } });
  const staffName = req.user.fullName;
  const message = `${staffName} submitted a leave request`;
  const link = '/leave-management';
  await Promise.all(admins.map(admin => Notification.create({
    message,
    type: 'leave',
    link,
    recipient: admin._id,
    sender: req.user._id,
    organization: req.user.organization._id
  })));

  res.status(201).json(leave);
});

// Staff: View their own leave requests
exports.getMyLeaveRequests = asyncHandler(async (req, res) => {
  const leaves = await LeaveRequest.find({ user: req.user._id })
    .populate('actionedBy', 'fullName')
    .populate('user', 'fullName email department profileImage')
    .sort({ createdAt: -1 });
  res.json(leaves);
});

// Admin: View all leave requests
exports.getAllLeaveRequests = asyncHandler(async (req, res) => {
  const leaves = await LeaveRequest.find({ organization: req.user.organization._id })
    .populate('user', 'fullName email department profileImage')
    .populate('actionedBy', 'fullName')
    .sort({ createdAt: -1 });
  res.json(leaves);
});

// Admin: Approve or reject a leave request
exports.updateLeaveStatus = asyncHandler(async (req, res) => {
  const { status, adminComment } = req.body;
  let leave = await LeaveRequest.findOne({ _id: req.params.id, organization: req.user.organization._id });
  if (!leave) {
    // Fallback for legacy requests (missing organization field)
    leave = await LeaveRequest.findById(req.params.id);
  }
  if (!leave) return res.status(404).json({ message: 'Leave request not found' });
  leave.status = status;
  if (adminComment) leave.adminComment = adminComment;
  if (status === 'Approved' || status === 'Rejected') {
    leave.actionedBy = req.user._id;
    // Notify the user whose request was actioned
    await notificationService.notifyUser({
      userId: leave.user,
      organization: leave.organization,
      message: `Your leave request has been ${status.toLowerCase()}.`,
      type: 'leave',
      link: '/my-leave-requests',
      sender: req.user._id
    });
  } else if (status === 'Pending') {
    leave.actionedBy = undefined;
  }
  await leave.save();
  res.json(leave);
});

// Get leave records for a staff member, filtered by month/year or from/to
exports.getLeaveRecords = async (req, res) => {
  try {
    const { staff, month, year, from, to } = req.query;
    let filter = {};
    if (staff) filter.user = staff;
    if (month && year) {
      // Filter by month and year
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      filter.startDate = { $lte: end };
      filter.endDate = { $gte: start };
    } else if (from && to) {
      const fromDate = new Date(from + '-01');
      const toDate = new Date(to + '-31');
      filter.startDate = { $lte: toDate };
      filter.endDate = { $gte: fromDate };
    }
    const records = await LeaveRequest.find(filter);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leave records' });
  }
};

// Admin: Get upcoming approved leaves
exports.getUpcomingApprovedLeaves = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  const leaves = await LeaveRequest.find({
    organization: req.user.organization._id,
    status: { $in: ['approved', 'Approved'] },
    endDate: { $gte: today },
    $or: [
      { startDate: { $gte: startOfMonth, $lte: endOfMonth } },
      { endDate: { $gte: startOfMonth, $lte: endOfMonth } }
    ]
  })
    .populate('user', 'fullName department profileImage')
    .sort({ startDate: 1 });
  res.json(leaves);
}); 

