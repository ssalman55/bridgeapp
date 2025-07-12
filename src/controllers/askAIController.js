const Attendance = require('../models/Attendance');
const SystemSettings = require('../models/SystemSettings');
const User = require('../models/User');
const LeaveRequest = require('../models/LeaveRequest');
const TrainingRequest = require('../models/TrainingRequest');
const Task = require('../models/Task');
const Payroll = require('../models/Payroll');
const ExpenseClaim = require('../models/ExpenseClaim');
const InventoryItem = require('../models/InventoryItem');
const InventoryRequest = require('../models/InventoryRequest');

const handleAskAIQuery = async (req, res) => {
  const { query } = req.body;
  const user = req.user || { fullName: 'User', email: 'user@example.com' };
  let answer = '';
  let actions = [];

  // Get org timezone
  let timezone = 'Asia/Qatar';
  if (user.organization) {
    const settings = await SystemSettings.findOne({ organization: user.organization._id || user.organization });
    if (settings && settings.timezone) timezone = settings.timezone;
  }

  // Helper: get start of day in org timezone
  function getOrgDay(date) {
    const d = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Helper: month name to number
  const monthNameToNumber = (str) => {
    const months = [
      'january', 'february', 'march', 'april', 'may', 'june',
      'july', 'august', 'september', 'october', 'november', 'december'
    ];
    str = str.toLowerCase();
    for (let i = 0; i < months.length; i++) {
      if (str.includes(months[i])) return (i + 1).toString().padStart(2, '0');
    }
    return null;
  };

  // --- STAFF EXTRACTION LOGIC ---
  // Only extract staff for user-specific queries
  // List of user-specific query types
  const userSpecificPatterns = [
    /salary breakdown|salary details|show salary for|salary structure/i,
    /download.*payslip|payslip.*pdf/i,
    /training requests?/i,
    /approved training/i,
    /upcoming training/i,
    /all.*training sessions|my training history/i,
    /leave days.*left/i,
    /leave history|my leave requests/i,
    /status.*last leave request/i,
    /view tasks|show tasks|list tasks/i,
    /my tasks|tasks assigned to me|what are my tasks/i,
    /all my tasks|show all my tasks/i,
    /leave tracker|leave summary/i,
    /upcoming leaves?/i,
    /approved leave/i,
    /pending leave/i,
    /rejected leave/i,
    /inventory (for|of|assigned to)?/i
  ];
  let targetUser = user;
  let targetUserId = user._id;
  if (user.role === 'admin' && userSpecificPatterns.some(p => p.test(query))) {
    // Try to extract staff name/email only if not 'for all staff', 'for June', etc.
    // Look for 'for [name/email]' not followed by 'for all staff', 'for [month]', etc.
    const staffMatch = query.match(/for ([A-Za-z .'-]+@[\w.-]+|[A-Za-z .'-]+)/i);
    if (staffMatch) {
      const staffStr = staffMatch[1].trim();
      // If the staffStr is a month or 'all staff', skip extraction
      if (!monthNameToNumber(staffStr) && !/all staff/i.test(staffStr)) {
        let staff;
        if (staffStr.includes('@')) {
          staff = await User.findOne({ email: staffStr, organization: user.organization._id || user.organization });
        } else {
          // Fuzzy/partial match: ignore extra spaces, case-insensitive, allow partials
          const regex = new RegExp(staffStr.replace(/ +/g, '.*'), 'i');
          const matches = await User.find({ fullName: regex, organization: user.organization._id || user.organization });
          if (matches.length === 1) {
            staff = matches[0];
          } else if (matches.length > 1) {
            answer = `Multiple staff found matching '${staffStr}': ` + matches.map(u => u.fullName).join(', ') + '. Please specify the full name or email.';
            return res.json({ answer, actions: [] });
          } else {
            staff = null;
          }
        }
        if (staff) {
          targetUser = staff;
          targetUserId = staff._id;
        } else if (!answer) {
          answer = `No staff found with ${staffStr}.`;
          return res.json({ answer, actions: [] });
        }
      }
    }
  }

  // Attendance: What time did I clock in today?
  if (/clock in|check[- ]?in.*today/i.test(query)) {
    const today = getOrgDay(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const record = await Attendance.findOne({
      user: targetUserId,
      date: { $gte: today, $lt: tomorrow }
    }).sort({ checkIn: -1 });
    if (record && record.checkIn) {
      const checkInTime = new Date(record.checkIn).toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timezone
      });
      answer = `You clocked in today at ${checkInTime}.`;
    } else {
      answer = `You have not clocked in today.`;
    }
    actions = [
      { label: "Show my last 7 days' attendance", query: "Show me my last 7 days' attendance." },
      { label: 'Do I have any missed check-ins this week?', query: 'Do I have any missed check-ins this week?' }
    ];
  }
  // Attendance: Show me my last 7 days' attendance
  else if (/last 7 days.*attendance/i.test(query)) {
    const today = getOrgDay(new Date());
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      days.push(d);
    }
    const records = await Attendance.find({
      user: targetUserId,
      date: { $gte: days[0], $lte: days[6] }
    });
    const dayMap = {};
    records.forEach(r => {
      const key = getOrgDay(r.date).toISOString().slice(0, 10);
      dayMap[key] = r.status || 'present';
    });
    const week = days.map(d => {
      const key = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: timezone });
      return `${dayName}: ${dayMap[key] ? 'Present' : 'Absent'}`;
    });
    answer = `Here's your attendance for the last 7 days:\n${week.join(' ')}`;
    actions = [
      { label: 'Do I have any missed check-ins this week?', query: 'Do I have any missed check-ins this week?' }
    ];
  }
  // Attendance: Do I have any missed check-ins this week?
  else if (/missed check[- ]?ins?/i.test(query)) {
    // Get this week's Monday (start) and today
    const now = getOrgDay(new Date());
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const monday = new Date(now); monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    const records = await Attendance.find({
      user: targetUserId,
      date: { $gte: monday, $lte: now }
    });
    const checkedInDays = new Set(records.map(r => getOrgDay(r.date).toISOString().slice(0, 10)));
    let missed = 0;
    for (let i = 0; i <= (now - monday) / (24*60*60*1000); i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      if (!checkedInDays.has(key)) missed++;
    }
    if (missed === 0) {
      answer = `You have no missed check-ins this week!`;
    } else {
      answer = `You have ${missed} missed check-in${missed > 1 ? 's' : ''} this week.`;
    }
    actions = [
      { label: "Show my last 7 days' attendance", query: "Show me my last 7 days' attendance." }
    ];
  }
  // Attendance: Who is present/absent today? (admin only)
  else if (/who.*present.*today|present staff.*today/i.test(query) && user.role === 'admin') {
    const today = getOrgDay(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const presentRecords = await Attendance.find({
      organization: user.organization._id || user.organization,
      date: { $gte: today, $lt: tomorrow }
    }).populate('user', 'fullName email department');
    const presentNames = presentRecords.map(r => r.user.fullName).join(', ');
    answer = presentNames ? `Present today: ${presentNames}` : 'No staff present today.';
  }
  else if (/who.*absent.*today|absent staff.*today/i.test(query) && user.role === 'admin') {
    const today = getOrgDay(new Date());
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const presentUserIds = await Attendance.find({
      organization: user.organization._id || user.organization,
      date: { $gte: today, $lt: tomorrow }
    }).distinct('user');
    const absentStaff = await User.find({
      _id: { $nin: presentUserIds },
      organization: user.organization._id || user.organization,
      status: { $ne: 'archived' }
    }).select('fullName');
    const absentNames = absentStaff.map(u => u.fullName).join(', ');
    answer = absentNames ? `Absent today: ${absentNames}` : 'No staff absent today.';
  }
  // Leave: How many leave days do I have left?
  else if (/leave days.*left/i.test(query)) {
    // Example: Assume 30 annual leave days per year, minus approved leaves
    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    const leaves = await LeaveRequest.find({
      user: targetUserId,
      leaveType: 'Annual',
      status: { $in: ['Approved', 'approved'] },
      startDate: { $gte: yearStart, $lte: yearEnd }
    });
    let daysUsed = 0;
    leaves.forEach(l => {
      const start = new Date(l.startDate);
      const end = new Date(l.endDate);
      daysUsed += Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    });
    const totalDays = 30;
    const daysLeft = Math.max(0, totalDays - daysUsed);
    answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} ${daysLeft} annual leave day${daysLeft === 1 ? '' : 's'} left this year.`;
    actions = [
      { label: 'Show leave history', query: `Show leave history for ${targetUser.fullName}` }
    ];
  }
  // Leave: Show leave history
  else if (/leave history|my leave requests/i.test(query)) {
    const leaves = await LeaveRequest.find({ user: targetUserId }).sort({ startDate: -1 }).limit(5);
    if (leaves.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no leave requests.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} recent leave requests:\n` + leaves.map(l => {
        const start = new Date(l.startDate).toLocaleDateString('en-US', { timeZone: timezone });
        const end = new Date(l.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${l.leaveType} leave: ${start} to ${end} (${l.status})`;
      }).join('\n');
    }
    actions = [];
  }
  // Leave: Status of last leave request
  else if (/status.*last leave request/i.test(query)) {
    const last = await LeaveRequest.findOne({ user: targetUserId }).sort({ createdAt: -1 });
    if (!last) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} not submitted any leave requests.`;
    } else {
      const start = new Date(last.startDate).toLocaleDateString('en-US', { timeZone: timezone });
      const end = new Date(last.endDate).toLocaleDateString('en-US', { timeZone: timezone });
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} last leave request (${start} to ${end}) is ${last.status}.`;
    }
    actions = [];
  }
  // Leave: Apply for leave (mock, but acknowledge)
  else if (/apply for.*leave/i.test(query)) {
    answer = 'Your leave request has been submitted. Would you like to view its status?';
    actions = [
      { label: "What's the status of my last leave request?", query: "What's the status of my last leave request?" }
    ];
  }
  // Training: Upcoming training
  else if (/upcoming training/i.test(query)) {
    const now = new Date();
    const upcoming = await TrainingRequest.find({
      staffId: targetUserId,
      status: { $in: ['Approved', 'Pending'] },
      requestedDate: { $gte: now }
    }).sort({ requestedDate: 1 }).limit(1);
    if (upcoming.length > 0) {
      const t = upcoming[0];
      const date = new Date(t.requestedDate).toLocaleDateString('en-US', { timeZone: timezone });
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s next training session is" : 'Your next training session is'} "${t.trainingTitle}" on ${date}.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no upcoming training sessions.`;
    }
    actions = [];
  }
  // Training: Show all my training sessions
  else if (/all.*training sessions|my training history/i.test(query)) {
    const trainings = await TrainingRequest.find({ staffId: targetUserId }).sort({ requestedDate: -1 }).limit(5);
    if (trainings.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no training sessions.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} recent training sessions:\n` + trainings.map(t => {
        const date = new Date(t.requestedDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${t.trainingTitle} (${t.status}) on ${date}`;
      }).join('\n');
    }
    actions = [];
  }
  // Tasks: What tasks are assigned to me?
  else if (/my tasks|tasks assigned to me|what are my tasks/i.test(query)) {
    const now = new Date();
    const tasks = await Task.find({
      assignedTo: targetUserId,
      organization: user.organization._id || user.organization,
      endDate: { $gte: now }
    }).sort({ endDate: 1 }).limit(5);
    if (tasks.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no active tasks.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} current tasks:\n` + tasks.map(t => {
        const due = new Date(t.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${t.title} (Due: ${due}, Status: ${t.status})`;
      }).join('\n');
    }
    actions = [];
  }
  // Tasks: Show all my tasks
  else if (/all my tasks|show all my tasks/i.test(query)) {
    const tasks = await Task.find({
      assignedTo: targetUserId,
      organization: user.organization._id || user.organization
    }).sort({ endDate: -1 }).limit(10);
    if (tasks.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no tasks.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'All your'} tasks:\n` + tasks.map(t => {
        const due = new Date(t.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${t.title} (Due: ${due}, Status: ${t.status})`;
      }).join('\n');
    }
    actions = [];
  }
  // Tasks: Admin - show all staff tasks
  else if (/all staff tasks|tasks for all staff/i.test(query) && user.role === 'admin') {
    const now = new Date();
    const tasks = await Task.find({
      organization: user.organization._id || user.organization,
      endDate: { $gte: now }
    }).populate('assignedTo', 'fullName').sort({ endDate: 1 }).limit(10);
    if (tasks.length === 0) {
      answer = 'No active tasks for any staff.';
    } else {
      answer = 'Active tasks for staff:\n' + tasks.map(t => {
        const due = new Date(t.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        const names = t.assignedTo.map(u => u.fullName).join(', ');
        return `${t.title} (Due: ${due}, Status: ${t.status}, Assigned to: ${names})`;
      }).join('\n');
    }
    actions = [];
  }
  // Payroll
  else if (/next salary date/i.test(query)) {
    answer = 'Your next salary date is June 30, 2024.';
    actions = [
      { label: 'Show my payroll history', query: 'Show my payroll history.' }
    ];
  }
  // Training & Evaluation
  else if (/feedback.*performance review/i.test(query)) {
    answer = 'Feedback from your last review: "Consistent performer, great teamwork. Focus on time management."';
    actions = [
      { label: 'Show my evaluation history', query: 'Show my evaluation history.' }
    ];
  }
  // Training: Show approved training sessions
  else if (/approved training/i.test(query)) {
    const trainings = await TrainingRequest.find({
      staffId: targetUserId,
      status: 'Approved'
    }).sort({ requestedDate: -1 }).limit(5);
    if (trainings.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no approved training sessions.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} approved training sessions:\n` + trainings.map(t => {
        const date = new Date(t.requestedDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${t.trainingTitle} on ${date}`;
      }).join('\n');
    }
    actions = [];
  }
  // Training: Show all training requests
  else if (/training requests?/i.test(query)) {
    const trainings = await TrainingRequest.find({ staffId: targetUserId }).sort({ requestedDate: -1 }).limit(10);
    if (trainings.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no training requests.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} training requests:\n` + trainings.map(t => {
        const date = new Date(t.requestedDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${t.trainingTitle} (${t.status}) on ${date}`;
      }).join('\n');
    }
    actions = [];
  }
  // Training: Show training costs (admin only)
  else if (/training costs?/i.test(query) && user.role === 'admin') {
    // Aggregate costs for all approved trainings in org
    const match = {
      status: 'Approved',
      organization: user.organization._id || user.organization
    };
    const summary = await TrainingRequest.aggregate([
      { $match: match },
      { $group: {
          _id: null,
          registrationFee: { $sum: { $ifNull: ['$costBreakdown.registrationFee', 0] } },
          travelCost: { $sum: { $ifNull: ['$costBreakdown.travelCost', 0] } },
          accommodationCost: { $sum: { $ifNull: ['$costBreakdown.accommodationCost', 0] } },
          mealCost: { $sum: { $ifNull: ['$costBreakdown.mealCost', 0] } },
          otherCost: { $sum: { $ifNull: ['$costBreakdown.otherCost', 0] } },
          total: { $sum: {
            $add: [
              { $ifNull: ['$costBreakdown.registrationFee', 0] },
              { $ifNull: ['$costBreakdown.travelCost', 0] },
              { $ifNull: ['$costBreakdown.accommodationCost', 0] },
              { $ifNull: ['$costBreakdown.mealCost', 0] },
              { $ifNull: ['$costBreakdown.otherCost', 0] }
            ]
          } }
        }
      }
    ]);
    if (!summary.length) {
      answer = 'No approved training costs found.';
    } else {
      const s = summary[0];
      answer = `Total training costs (approved):\nRegistration: ${s.registrationFee}\nTravel: ${s.travelCost}\nAccommodation: ${s.accommodationCost}\nMeals: ${s.mealCost}\nOther: ${s.otherCost}\nTotal: ${s.total}`;
    }
    actions = [];
  }
  // Tasks: View tasks
  else if (/view tasks|show tasks|list tasks/i.test(query)) {
    const now = new Date();
    const tasks = await Task.find({
      assignedTo: targetUserId,
      organization: user.organization._id || user.organization,
      endDate: { $gte: now }
    }).sort({ endDate: 1 }).limit(10);
    if (tasks.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no active tasks.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} active tasks:\n` + tasks.map(t => {
        const due = new Date(t.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${t.title} (Due: ${due}, Status: ${t.status})`;
      }).join('\n');
    }
    actions = [];
  }
  // Leave: Leave tracker (show summary of leaves this year)
  else if (/leave tracker|leave summary/i.test(query)) {
    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    const leaves = await LeaveRequest.find({
      user: targetUserId,
      startDate: { $gte: yearStart, $lte: yearEnd }
    });
    if (leaves.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no leave records this year.`;
    } else {
      const summary = {};
      leaves.forEach(l => {
        summary[l.leaveType] = (summary[l.leaveType] || 0) + (Math.round((new Date(l.endDate) - new Date(l.startDate)) / (1000 * 60 * 60 * 24)) + 1);
      });
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} leave tracker for this year:\n` + Object.entries(summary).map(([type, days]) => `${type}: ${days} days`).join('\n');
    }
    actions = [];
  }
  // Leave: Upcoming leaves
  else if (/upcoming leaves?/i.test(query)) {
    const now = new Date();
    const leaves = await LeaveRequest.find({
      user: targetUserId,
      startDate: { $gte: now },
      status: { $in: ['Approved', 'approved'] }
    }).sort({ startDate: 1 }).limit(5);
    if (leaves.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no upcoming approved leaves.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} upcoming approved leaves:\n` + leaves.map(l => {
        const start = new Date(l.startDate).toLocaleDateString('en-US', { timeZone: timezone });
        const end = new Date(l.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${l.leaveType} leave: ${start} to ${end}`;
      }).join('\n');
    }
    actions = [];
  }
  // Payroll: Salary breakdown for a staff
  else if (/salary breakdown|salary details|show salary for|salary structure/i.test(query)) {
    // Find latest payroll for the staff
    const payroll = await Payroll.findOne({
      staff: targetUserId,
      organization: user.organization._id || user.organization
    }).sort({ payPeriod: -1 });
    if (!payroll) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no payroll records.`;
    } else {
      const s = payroll.salaryStructure;
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} latest salary breakdown:\n` +
        `Basic: ${s.basic}\nHousing: ${s.housing}\nUtility: ${s.utility}\nTransport: ${s.transport}\nBonus: ${s.bonus}\nReimbursements: ${s.reimbursements}\nDeductions: ${s.deductions}\nTaxes: ${s.taxes}\nNet Salary: ${payroll.netSalary}`;
    }
    actions = [];
  }
  // Payroll: Download PDF payslip for a staff for a given month
  else if (/download.*payslip|payslip.*pdf/i.test(query)) {
    // Extract month/year or payPeriod
    let payPeriod = null;
    // Try YYYY-MM or YYYY/MM or YYYY MM
    let periodMatch = query.match(/(\d{4})[-/ ]?(\d{1,2})/);
    // Try month name and year (e.g. June 2025)
    if (!periodMatch) {
      const monthMatch = query.match(/([A-Za-z]+)\s*(\d{4})/);
      if (monthMatch) {
        const monthNum = monthNameToNumber(monthMatch[1]);
        if (monthNum) payPeriod = `${monthMatch[2]}-${monthNum}`;
      }
    }
    if (periodMatch) {
      const year = periodMatch[1];
      const month = periodMatch[2].padStart(2, '0');
      payPeriod = `${year}-${month}`;
    }
    let payroll;
    if (payPeriod) {
      payroll = await Payroll.findOne({ staff: targetUserId, organization: user.organization._id || user.organization, payPeriod });
    } else {
      payroll = await Payroll.findOne({ staff: targetUserId, organization: user.organization._id || user.organization }).sort({ payPeriod: -1 });
    }
    if (!payroll) {
      answer = `No payroll found for ${payPeriod ? payPeriod : 'the latest period'}.`;
    } else {
      answer = `[Download PDF](/api/payroll/${payroll._id}/payslip/pdf)`;
    }
    actions = [];
  }
  // Payroll: Highest salary staff
  else if (/highest salary|top salary|most paid/i.test(query) && user.role === 'admin') {
    const payroll = await Payroll.find({ organization: user.organization._id || user.organization }).sort({ netSalary: -1 }).limit(1).populate('staff', 'fullName');
    if (!payroll.length) {
      answer = 'No payroll records found.';
    } else {
      answer = `Highest salary: ${payroll[0].staff.fullName} (Net: ${payroll[0].netSalary})`;
    }
    actions = [];
  }
  // Payroll: Lowest salary staff
  else if (/lowest salary|least paid|lowest paid/i.test(query) && user.role === 'admin') {
    const payroll = await Payroll.find({ organization: user.organization._id || user.organization }).sort({ netSalary: 1 }).limit(1).populate('staff', 'fullName');
    if (!payroll.length) {
      answer = 'No payroll records found.';
    } else {
      answer = `Lowest salary: ${payroll[0].staff.fullName} (Net: ${payroll[0].netSalary})`;
    }
    actions = [];
  }
  // Payroll: Sum of salary breakdown elements
  else if (/sum of (basic|housing|utility|transport|bonus|reimbursements|deductions|taxes)/i.test(query) && user.role === 'admin') {
    // Accept 'sum of basic for all staff', 'sum of utility for all staff', etc.
    const fieldMatch = query.match(/sum of (basic|housing|utility|transport|bonus|reimbursements|deductions|taxes)/i);
    const field = fieldMatch[1];
    const payrolls = await Payroll.find({ organization: user.organization._id || user.organization });
    let sum = 0;
    payrolls.forEach(p => {
      if (p.salaryStructure && typeof p.salaryStructure[field] === 'number') sum += p.salaryStructure[field];
    });
    answer = `Sum of ${field} for all staff: ${sum}`;
    actions = [];
  }
  // Payroll: Payroll for a given month (summary)
  else if (/payroll (summary )?for (\d{4})[-/ ]?(\d{1,2})/i.test(query) || /payroll (summary )?for ([A-Za-z]+)\s*(\d{4})/i.test(query)) {
    // Try YYYY-MM or YYYY/MM or YYYY MM
    let payPeriod = null;
    let periodMatch = query.match(/payroll (summary )?for (\d{4})[-/ ]?(\d{1,2})/i);
    if (periodMatch) {
      const year = periodMatch[2];
      const month = periodMatch[3].padStart(2, '0');
      payPeriod = `${year}-${month}`;
    } else {
      // Try month name and year
      const monthMatch = query.match(/payroll (summary )?for ([A-Za-z]+)\s*(\d{4})/i);
      if (monthMatch) {
        const monthNum = monthNameToNumber(monthMatch[2]);
        if (monthNum) payPeriod = `${monthMatch[3]}-${monthNum}`;
      }
    }
    if (!payPeriod) {
      answer = 'Could not determine payroll month.';
    } else {
      const payrolls = await Payroll.find({ organization: user.organization._id || user.organization, payPeriod }).populate('staff', 'fullName');
      if (!payrolls.length) {
        answer = `No payroll records found for ${payPeriod}.`;
      } else {
        const totalNet = payrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);
        answer = `Payroll summary for ${payPeriod}:\nTotal staff: ${payrolls.length}\nTotal net paid: ${totalNet}\n` + payrolls.map(p => `${p.staff.fullName}: Net ${p.netSalary}`).join('\n');
      }
    }
    actions = [];
  }
  // Expenses: Pending Claims
  else if (/pending (expense )?claims?/i.test(query)) {
    const claims = await ExpenseClaim.find({ staffId: targetUserId, organization: user.organization._id || user.organization, status: 'Pending' }).sort({ expenseDate: -1 }).limit(10);
    if (claims.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no pending expense claims.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} pending expense claims:\n` + claims.map(c => `${c.title} (${c.category}) - ${c.totalAmount} on ${new Date(c.expenseDate).toLocaleDateString('en-US', { timeZone: timezone })}`).join('\n');
    }
    actions = [];
  }
  // Expenses: Approved Claims
  else if (/approved (expense )?claims?/i.test(query)) {
    const claims = await ExpenseClaim.find({ staffId: targetUserId, organization: user.organization._id || user.organization, status: 'Approved' }).sort({ expenseDate: -1 }).limit(10);
    if (claims.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no approved expense claims.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} approved expense claims:\n` + claims.map(c => `${c.title} (${c.category}) - ${c.totalAmount} on ${new Date(c.expenseDate).toLocaleDateString('en-US', { timeZone: timezone })}`).join('\n');
    }
    actions = [];
  }
  // Expenses: Rejected Claims
  else if (/rejected (expense )?claims?/i.test(query)) {
    const claims = await ExpenseClaim.find({ staffId: targetUserId, organization: user.organization._id || user.organization, status: 'Rejected' }).sort({ expenseDate: -1 }).limit(10);
    if (claims.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no rejected expense claims.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} rejected expense claims:\n` + claims.map(c => `${c.title} (${c.category}) - ${c.totalAmount} on ${new Date(c.expenseDate).toLocaleDateString('en-US', { timeZone: timezone })}`).join('\n');
    }
    actions = [];
  }
  // Expenses: Expense Reports (summary)
  else if (/expense reports?|expense summary/i.test(query)) {
    const claims = await ExpenseClaim.find({ staffId: targetUserId, organization: user.organization._id || user.organization, status: { $in: ['Approved', 'Rejected', 'Pending'] } });
    if (claims.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no expense claims.`;
    } else {
      const total = claims.reduce((sum, c) => sum + (c.totalAmount || 0), 0);
      const byStatus = { Pending: 0, Approved: 0, Rejected: 0 };
      claims.forEach(c => { byStatus[c.status] = (byStatus[c.status] || 0) + (c.totalAmount || 0); });
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} expense report:\nTotal claims: ${claims.length}\nTotal amount: ${total}\nApproved: ${byStatus.Approved}\nPending: ${byStatus.Pending}\nRejected: ${byStatus.Rejected}`;
    }
    actions = [];
  }
  // Inventory: Inventory assigned to a staff
  else if (/inventory assigned( to)?/i.test(query)) {
    const items = await InventoryItem.find({ assignedTo: targetUserId, organization: user.organization._id || user.organization });
    if (items.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no inventory assigned.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} assigned inventory:\n` + items.map(i => `${i.name} (Code: ${i.itemCode}, Serial: ${i.serialNumber})`).join('\n');
    }
    actions = [];
  }
  // Inventory: Total items available for a given item
  else if (/total (items )?available for ([\w .'-]+)/i.test(query)) {
    const itemMatch = query.match(/total (items )?available for ([\w .'-]+)/i);
    const itemStr = itemMatch ? itemMatch[2].trim() : null;
    let items = [];
    if (itemStr) {
      const regex = new RegExp(itemStr.replace(/ +/g, '.*'), 'i');
      items = await InventoryItem.find({ name: regex, organization: user.organization._id || user.organization });
    }
    const total = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
    if (!items.length) {
      answer = `No inventory items found matching '${itemStr}'.`;
    } else {
      answer = `Total available for '${itemStr}': ${total}`;
    }
    actions = [];
  }
  // Inventory: New inventory requests
  else if (/new inventory requests?/i.test(query)) {
    const requests = await InventoryRequest.find({ organization: user.organization._id || user.organization, status: 'Pending' }).populate('staff', 'fullName').sort({ createdAt: -1 }).limit(10);
    if (requests.length === 0) {
      answer = 'No new inventory requests.';
    } else {
      answer = 'New inventory requests:\n' + requests.map(r => `${r.itemName} (${r.quantity}) by ${r.staff ? r.staff.fullName : 'Unknown'}`).join('\n');
    }
    actions = [];
  }
  // Inventory: Inventory summary
  else if (/inventory summary|inventory report/i.test(query)) {
    const items = await InventoryItem.find({ organization: user.organization._id || user.organization });
    if (items.length === 0) {
      answer = 'No inventory items found.';
    } else {
      const byName = {};
      items.forEach(i => { byName[i.name] = (byName[i.name] || 0) + (i.quantity || 0); });
      answer = 'Inventory summary:\n' + Object.entries(byName).map(([name, qty]) => `${name}: ${qty}`).join('\n');
    }
    actions = [];
  }
  // Leave: Approved leave
  else if (/approved leave/i.test(query)) {
    const leaves = await LeaveRequest.find({
      user: targetUserId,
      status: { $in: ['Approved', 'approved'] }
    }).sort({ startDate: -1 }).limit(5);
    if (leaves.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no approved leave records.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} approved leaves:\n` + leaves.map(l => {
        const start = new Date(l.startDate).toLocaleDateString('en-US', { timeZone: timezone });
        const end = new Date(l.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${l.leaveType} leave: ${start} to ${end}`;
      }).join('\n');
    }
    actions = [];
  }
  // Leave: Pending leave
  else if (/pending leave/i.test(query)) {
    const leaves = await LeaveRequest.find({
      user: targetUserId,
      status: { $in: ['Pending', 'pending'] }
    }).sort({ startDate: -1 }).limit(5);
    if (leaves.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no pending leave records.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} pending leaves:\n` + leaves.map(l => {
        const start = new Date(l.startDate).toLocaleDateString('en-US', { timeZone: timezone });
        const end = new Date(l.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${l.leaveType} leave: ${start} to ${end}`;
      }).join('\n');
    }
    actions = [];
  }
  // Leave: Rejected leave
  else if (/rejected leave/i.test(query)) {
    const leaves = await LeaveRequest.find({
      user: targetUserId,
      status: { $in: ['Rejected', 'rejected'] }
    }).sort({ startDate: -1 }).limit(5);
    if (leaves.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no rejected leave records.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} rejected leaves:\n` + leaves.map(l => {
        const start = new Date(l.startDate).toLocaleDateString('en-US', { timeZone: timezone });
        const end = new Date(l.endDate).toLocaleDateString('en-US', { timeZone: timezone });
        return `${l.leaveType} leave: ${start} to ${end}`;
      }).join('\n');
    }
    actions = [];
  }
  // Inventory: Inventory for/of/assigned to
  else if (/inventory (for|of|assigned to)?/i.test(query)) {
    const items = await InventoryItem.find({ assignedTo: targetUserId, organization: user.organization._id || user.organization });
    if (items.length === 0) {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + ' has' : 'You have'} no inventory assigned.`;
    } else {
      answer = `${user.role === 'admin' && targetUserId.toString() !== user._id.toString() ? targetUser.fullName + "'s" : 'Your'} assigned inventory:\n` + items.map(i => `${i.name} (Code: ${i.itemCode}, Serial: ${i.serialNumber})`).join('\n');
    }
    actions = [];
  }
  // Default
  else {
    answer = "Sorry, I'm not sure how to help with that yet. Try asking about attendance, leave, payroll, or training.";
    actions = [
      { label: "What time did I clock in today?", query: "What time did I clock in today?" },
      { label: "How many leave days do I have left?", query: "How many leave days do I have left?" }
    ];
  }
  // At the end, provide sample questions for the user
  if (query && /sample questions|example questions|help/i.test(query)) {
    answer = `Sample questions you can ask:\n- Show my pending expense claims\n- Show approved expense claims for John Doe\n- Show rejected expense claims for Jane Smith\n- Show my expense report\n- Show inventory assigned to me\n- Show inventory assigned to John Doe\n- Total items available for Laptop\n- Any new inventory requests?\n- Show inventory summary\n- Show inventory report`;
    actions = [];
  }
  // At the end of each handler, add context-aware actions for admin
  // Example for leave:
  if (/leave/i.test(query) && user.role === 'admin') {
    actions.push(
      { label: 'Show approved leave for [staff]', query: 'Show approved leave for ' },
      { label: 'Show pending leave for [staff]', query: 'Show pending leave for ' },
      { label: 'Show leave tracker for [staff]', query: 'Show leave tracker for ' }
    );
  }
  if (/payroll|salary|payslip/i.test(query) && user.role === 'admin') {
    actions.push(
      { label: 'Download payslip PDF for [staff] for [month]', query: 'Download payslip PDF for  for ' },
      { label: 'Show payroll summary for [month]', query: 'Payroll summary for ' },
      { label: 'Who has the highest salary?', query: 'Who has the highest salary?' }
    );
  }
  if (/inventory/i.test(query) && user.role === 'admin') {
    actions.push(
      { label: 'Show inventory assigned to [staff]', query: 'Show inventory assigned to ' },
      { label: 'Total items available for [item]', query: 'Total items available for ' },
      { label: 'Any new inventory requests?', query: 'Any new inventory requests?' }
    );
  }
  if (/expense|claim/i.test(query) && user.role === 'admin') {
    actions.push(
      { label: 'Show pending expense claims for [staff]', query: 'Show pending expense claims for ' },
      { label: 'Show approved expense claims for [staff]', query: 'Show approved expense claims for ' },
      { label: 'Show expense report for [staff]', query: 'Show expense report for ' }
    );
  }
  if (/task/i.test(query) && user.role === 'admin') {
    actions.push(
      { label: 'Show tasks for [staff]', query: 'Show tasks for ' },
      { label: 'Show all staff tasks', query: 'Show all staff tasks' }
    );
  }
  if (/training/i.test(query) && user.role === 'admin') {
    actions.push(
      { label: 'Show approved training for [staff]', query: 'Show approved training for ' },
      { label: 'Show training requests for [staff]', query: 'Show training requests for ' }
    );
  }
  // Special: How to use Ask AI
  if (/how to use ask ai/i.test(query)) {
    answer = `**How to use Ask AI (Admin Guide)**\n\n- You can ask about any staff by name or email, e.g. 'Show approved leave for John Doe'.\n- Use keywords like 'approved leave', 'pending leave', 'inventory', 'payslip', 'payroll summary', 'expense claims', 'tasks', 'training', etc.\n- Use [staff] and [month] placeholders in your queries.\n- Click on suggestion chips below the chat to auto-fill queries.\n- Click 'Show Examples' for more sample questions.\n\n**Sample Queries:**\n- Show approved leave for John Doe\n- Download payslip PDF for Jane Smith for June 2025\n- Show inventory assigned to Ahmed Ali\n- Show pending expense claims for Amira Aldass\n- Show tasks for Ana Russo\n- Show approved training for Ahmed Ali`;
    actions = [
      { label: 'Show Examples', query: 'Show me example questions' }
    ];
    return res.json({ answer, actions });
  }
  // Default: add Show Examples action if not recognized
  if (answer.startsWith("Sorry, I'm not sure")) {
    actions.push({ label: 'Show Examples', query: 'Show me example questions' });
  }
  res.json({ answer, actions });
};

module.exports = { handleAskAIQuery }; 