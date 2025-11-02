const LWOPThresholdReport = require('../models/LWOPThresholdReport');
const PayrollDeduction = require('../models/PayrollDeduction');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');
const Payroll = require('../models/Payroll');
const User = require('../models/User');
const PayrollAuditLog = require('../models/PayrollAuditLog');
const SalaryStructure = require('../models/SalaryStructure');
const { getSignedUrl } = require('../utils/s3');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

// Generate LWOP Threshold Report for a given pay period
exports.generateLWOPReport = async (req, res) => {
  try {
    const { payPeriod, department, leaveType, employee, status } = req.body;
    const organization = req.user.organization;
    
    console.log('LWOP Report Generation Request:', { payPeriod, department, leaveType, employee, status, organization });
    
    if (!payPeriod) {
      return res.status(400).json({ message: 'Pay period is required' });
    }

    // Parse pay period to get start and end dates
    const [year, month] = payPeriod.split('-');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    // Build filter for approved leave requests
    // Include any leave request that overlaps with the pay period
    const leaveFilter = {
      organization: organization,
      status: 'Approved',
      $or: [
        // Leave request starts within the pay period
        { startDate: { $gte: startDate, $lte: endDate } },
        // Leave request ends within the pay period
        { endDate: { $gte: startDate, $lte: endDate } },
        // Leave request spans the entire pay period
        { startDate: { $lte: startDate }, endDate: { $gte: endDate } }
      ]
    };

    if (department) {
      // Get users in the specified department
      const departmentUsers = await User.find({ 
        organization: organization, 
        department: department 
      }).select('_id');
      leaveFilter.user = { $in: departmentUsers.map(u => u._id) };
    }

    if (employee) {
      leaveFilter.user = employee;
    }

    // Get approved leave requests with populated data
    const leaveRequests = await LeaveRequest.find(leaveFilter)
      .populate('user', 'fullName email department')
      .populate('leaveType', 'name allocation documentThreshold color icon')
      .sort({ startDate: 1 });

    console.log(`Found ${leaveRequests.length} approved leave requests for period ${payPeriod}`);
    
    // Clear existing LWOP reports for this pay period to ensure fresh calculation
    await LWOPThresholdReport.deleteMany({
      organization: organization,
      payPeriod: payPeriod
    });
    console.log(`Cleared existing LWOP reports for period ${payPeriod}`);
    
    // Debug: Log all leave requests to see what's being processed
    console.log(`Processing ${leaveRequests.length} leave requests:`);
    leaveRequests.forEach((req, index) => {
      console.log(`Request ${index + 1}:`, {
        id: req._id,
        employee: req.user?.fullName,
        leaveType: req.leaveType?.name,
        totalDays: req.totalDays,
        startDate: req.startDate,
        endDate: req.endDate,
        status: req.status,
        allocation: req.leaveType?.allocation,
        thresholdDays: req.leaveType?.documentThreshold?.days
      });
    });

    const lwopReports = [];

    // Group leave requests by employee and leave type to calculate total used days
    const employeeLeaveUsage = {};
    
    for (const leaveRequest of leaveRequests) {
      const leaveType = leaveRequest.leaveType;
      const employee = leaveRequest.user;
      
      // Check if leave type is populated
      if (!leaveType) {
        console.log(`Skipping leave request ${leaveRequest._id} - leave type not found or not populated`);
        continue;
      }
      
      const employeeId = employee._id.toString();
      const leaveTypeId = leaveType._id.toString();
      const key = `${employeeId}-${leaveTypeId}`;
      
      if (!employeeLeaveUsage[key]) {
        employeeLeaveUsage[key] = {
          employee: employee,
          leaveType: leaveType,
          totalUsedDays: 0,
          leaveRequests: []
        };
      }
      
      employeeLeaveUsage[key].totalUsedDays += leaveRequest.totalDays;
      employeeLeaveUsage[key].leaveRequests.push(leaveRequest);
    }

    // Process each employee's leave usage to calculate LWOP
    for (const [key, usage] of Object.entries(employeeLeaveUsage)) {
      const { employee, leaveType, totalUsedDays, leaveRequests } = usage;
      
      // Calculate LWOP based on allocation, not threshold
      const allocation = leaveType.allocation;
      const lwopDays = Math.max(0, totalUsedDays - allocation);
      
      // Skip if no LWOP days
      if (lwopDays <= 0) {
        console.log(`No LWOP for ${employee.fullName} - ${leaveType.name}: used ${totalUsedDays}, allocation ${allocation}`);
        continue;
      }
      
      console.log(`LWOP calculated for ${employee.fullName} - ${leaveType.name}: used ${totalUsedDays}, allocation ${allocation}, LWOP ${lwopDays} days`);

      // Get employee's salary structure
      const salaryStructure = await SalaryStructure.findOne({
        staff: employee._id,
        organization: organization,
        status: 'submitted'
      });

      if (!salaryStructure) {
        console.warn(`No salary structure found for employee ${employee.fullName} - skipping LWOP calculation`);
        continue;
      }

      // Calculate base monthly salary
      const baseMonthlySalary = salaryStructure.basic + salaryStructure.housing + 
                               salaryStructure.utility + salaryStructure.transport;

      // Calculate calendar days in the month
      const calendarDaysInMonth = new Date(year, month, 0).getDate();
      
      // Calculate daily rate using calendar-days method
      const dailyRate = baseMonthlySalary / calendarDaysInMonth;
      
      // Calculate suggested deduction amount
      const suggestedDeductionAmount = dailyRate * lwopDays;

      // Determine document status based on threshold requirements
      let documentStatus = 'not_required';
      let documentCount = 0;
      
      // Check if any leave request exceeded the document threshold
      const hasExceededThreshold = leaveRequests.some(req => 
        req.totalDays > (leaveType.documentThreshold?.days || 0)
      );
      
      if (hasExceededThreshold) {
        // Check if documents were provided for threshold-exceeding requests
        const thresholdExceedingRequests = leaveRequests.filter(req => 
          req.totalDays > (leaveType.documentThreshold?.days || 0)
        );
        
        const totalAttachments = thresholdExceedingRequests.reduce((sum, req) => 
          sum + (req.attachments?.length || 0), 0
        );
        
        if (totalAttachments > 0) {
          documentStatus = 'provided';
          documentCount = totalAttachments;
        } else {
          documentStatus = 'missing';
        }
      }

      // Create new report - use the first leave request for reference dates
      const firstLeaveRequest = leaveRequests[0];
      const lwopReport = new LWOPThresholdReport({
        organization: organization,
        payPeriod: payPeriod,
        employee: employee._id,
        leaveType: leaveType._id,
        leaveRequest: firstLeaveRequest._id, // Reference to first leave request
        leaveStartDate: firstLeaveRequest.startDate,
        leaveEndDate: firstLeaveRequest.endDate,
        totalRequestedDays: totalUsedDays,
        thresholdDays: allocation, // Now showing allocation instead of threshold
        excessLWOPDays: lwopDays,
        baseMonthlySalary: baseMonthlySalary,
        calendarDaysInMonth: calendarDaysInMonth,
        dailyRate: dailyRate,
        suggestedDeductionAmount: suggestedDeductionAmount,
        documentStatus: documentStatus,
        documentCount: documentCount,
        calculationTrace: {
          baseSalary: baseMonthlySalary,
          calendarDays: calendarDaysInMonth,
          dailyRate: dailyRate,
          lwopDays: lwopDays,
          calculationMethod: 'calendar-days',
          currency: 'QAR',
          allocation: allocation,
          totalUsedDays: totalUsedDays
        }
      });

      await lwopReport.save();
      lwopReports.push(lwopReport);
    }

    // Apply additional filters
    let filteredReports = lwopReports;

    if (leaveType) {
      filteredReports = filteredReports.filter(report => 
        report.leaveType.toString() === leaveType
      );
    }

    if (status) {
      filteredReports = filteredReports.filter(report => 
        report.status === status
      );
    }

    // Populate the reports with full data
    const populatedReports = await LWOPThresholdReport.find({
      _id: { $in: lwopReports.map(r => r._id) }
    })
      .populate('employee', 'fullName email department')
      .populate('leaveType', 'name color icon')
      .populate('leaveRequest', 'startDate endDate reason attachments')
      .populate('reviewedBy', 'fullName')
      .populate('postedBy', 'fullName')
      .sort({ createdAt: -1 });

    // Log the report generation
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'generate_lwop_report',
      performedBy: req.user._id,
      prevValue: '',
      newValue: `Generated LWOP report for ${payPeriod}`,
      notes: `Found ${populatedReports.length} threshold exceedances`,
      organization: organization
    });

    console.log(`LWOP report generation completed. Generated ${populatedReports.length} reports.`);
    
    res.json({
      success: true,
      message: `LWOP report generated for ${payPeriod}`,
      reports: populatedReports,
      summary: {
        totalReports: populatedReports.length,
        unposted: populatedReports.filter(r => r.status === 'unposted').length,
        posted: populatedReports.filter(r => r.status === 'posted').length,
        ignored: populatedReports.filter(r => r.status === 'ignored').length,
        override: populatedReports.filter(r => r.status === 'override').length
      }
    });

  } catch (error) {
    console.error('Error generating LWOP report:', error);
    res.status(500).json({ message: 'Error generating LWOP report' });
  }
};

// Get LWOP reports with filters
exports.getLWOPReports = async (req, res) => {
  try {
    const { 
      payPeriod, 
      department, 
      leaveType, 
      employee, 
      status,
      page = 1, 
      pageSize = 20 
    } = req.query;
    const organization = req.user.organization;

    // Build filter
    const filter = { organization: organization };

    if (payPeriod) filter.payPeriod = payPeriod;
    if (status) filter.status = status;
    if (leaveType) filter.leaveType = leaveType;
    if (employee) filter.employee = employee;

    // If department filter is provided, get users in that department
    if (department) {
      const departmentUsers = await User.find({ 
        organization: organization, 
        department: department 
      }).select('_id');
      filter.employee = { $in: departmentUsers.map(u => u._id) };
    }

    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const total = await LWOPThresholdReport.countDocuments(filter);

    const reports = await LWOPThresholdReport.find(filter)
      .populate('employee', 'fullName email department')
      .populate('leaveType', 'name color icon')
      .populate('leaveRequest', 'startDate endDate reason attachments')
      .populate('reviewedBy', 'fullName')
      .populate('postedBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(pageSize));

    res.json({
      reports,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(total / parseInt(pageSize))
      }
    });

  } catch (error) {
    console.error('Error fetching LWOP reports:', error);
    res.status(500).json({ message: 'Error fetching LWOP reports' });
  }
};

// Post LWOP deduction to payroll
exports.postLWOPDeduction = async (req, res) => {
  try {
    const { reportIds, overrideAmount, justification } = req.body;
    const organization = req.user.organization;
    const postedBy = req.user._id;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({ message: 'Report IDs are required' });
    }

    const results = {
      posted: [],
      failed: [],
      alreadyPosted: []
    };

    for (const reportId of reportIds) {
      try {
        const report = await LWOPThresholdReport.findById(reportId)
          .populate('employee', 'fullName email department')
          .populate('leaveType', 'name')
          .populate('leaveRequest', 'startDate endDate');

        if (!report) {
          results.failed.push({ 
            reportId, 
            error: 'Report not found' 
          });
          continue;
        }

        // Check if already posted
        if (report.status === 'posted') {
          results.alreadyPosted.push({
            reportId,
            employeeName: report.employee.fullName,
            message: 'Already posted to payroll'
          });
          continue;
        }

        // Find or create payroll for the employee and pay period
        let payroll = await Payroll.findOne({
          staff: report.employee._id,
          organization: organization,
          payPeriod: report.payPeriod
        });

        if (!payroll) {
          // Create a basic payroll record if it doesn't exist
          let salaryStructure = await SalaryStructure.findOne({
            staff: report.employee._id,
            organization: organization,
            status: 'submitted'
          });

          // If no submitted salary structure, try draft
          if (!salaryStructure) {
            salaryStructure = await SalaryStructure.findOne({
              staff: report.employee._id,
              organization: organization,
              status: 'draft'
            });
          }

          if (!salaryStructure) {
            results.failed.push({
              reportId,
              employeeName: report.employee.fullName,
              error: 'No salary structure found'
            });
            continue;
          }

          const grossSalary = salaryStructure.basic + salaryStructure.housing + 
                             salaryStructure.utility + salaryStructure.transport + 
                             salaryStructure.bonus + salaryStructure.reimbursements;
          const totalDeductions = salaryStructure.deductions + salaryStructure.taxes;
          const netSalary = grossSalary - totalDeductions;

          payroll = await Payroll.create({
            staff: report.employee._id,
            organization: organization,
            salaryStructure: salaryStructure,
            payPeriod: report.payPeriod,
            totalWorkdays: 22, // Default
            absences: 0,
            overtime: 0,
            deductions: totalDeductions,
            bonuses: salaryStructure.bonus || 0,
            grossSalary: grossSalary,
            netSalary: netSalary,
            paymentStatus: 'Pending',
            paymentMethod: 'Bank Transfer'
          });
        }

        // Determine deduction amount
        const deductionAmount = overrideAmount !== undefined ? overrideAmount : report.suggestedDeductionAmount;

        // Create payroll deduction
        const payrollDeduction = new PayrollDeduction({
          organization: organization,
          payroll: payroll._id,
          employee: report.employee._id,
          payPeriod: report.payPeriod,
          code: 'LWOP',
          description: `Leave Without Pay - ${report.excessLWOPDays} days`,
          amount: deductionAmount,
          lwopDetails: {
            leaveRequest: report.leaveRequest._id,
            leaveType: report.leaveType._id,
            lwopDays: report.excessLWOPDays,
            calculationMethod: 'calendar-days',
            dailyRate: report.dailyRate,
            baseSalary: report.baseMonthlySalary
          },
          status: 'approved',
          createdBy: postedBy,
          approvedBy: postedBy,
          approvedAt: new Date(),
          postedBy: postedBy,
          postedAt: new Date(),
          lwopReportId: report._id,
          notes: justification || `LWOP deduction for ${report.excessLWOPDays} days beyond threshold`
        });

        await payrollDeduction.save();

        // Update payroll deductions total
        payroll.deductions += deductionAmount;
        payroll.netSalary -= deductionAmount;
        await payroll.save();

        // Mark report as posted
        await report.markAsPosted(postedBy, payrollDeduction._id);

        results.posted.push({
          reportId,
          employeeName: report.employee.fullName,
          deductionAmount: deductionAmount,
          payrollDeductionId: payrollDeduction._id
        });

        // Log the posting
        await PayrollAuditLog.create({
          date: new Date(),
          action: 'post_lwop_deduction',
          performedBy: postedBy,
          staff: report.employee._id,
          prevValue: '',
          newValue: `Posted LWOP deduction: ${deductionAmount} QAR`,
          notes: `Leave request: ${report.leaveRequest._id}, LWOP days: ${report.excessLWOPDays}`,
          organization: organization
        });

      } catch (error) {
        console.error(`Error posting deduction for report ${reportId}:`, error);
        results.failed.push({
          reportId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${reportIds.length} LWOP deductions`,
      results
    });

  } catch (error) {
    console.error('Error posting LWOP deductions:', error);
    res.status(500).json({ message: 'Error posting LWOP deductions' });
  }
};

// Ignore LWOP deduction
exports.ignoreLWOPDeduction = async (req, res) => {
  try {
    const { reportIds, justification } = req.body;
    const organization = req.user.organization;
    const reviewedBy = req.user._id;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({ message: 'Report IDs are required' });
    }

    if (!justification) {
      return res.status(400).json({ message: 'Justification is required for ignoring deductions' });
    }

    const results = {
      ignored: [],
      failed: []
    };

    for (const reportId of reportIds) {
      try {
        const report = await LWOPThresholdReport.findById(reportId)
          .populate('employee', 'fullName');

        if (!report) {
          results.failed.push({ 
            reportId, 
            error: 'Report not found' 
          });
          continue;
        }

        // Mark as ignored
        await report.markAsIgnored(reviewedBy, justification);

        results.ignored.push({
          reportId,
          employeeName: report.employee.fullName
        });

        // Log the action
        await PayrollAuditLog.create({
          date: new Date(),
          action: 'ignore_lwop_deduction',
          performedBy: reviewedBy,
          staff: report.employee._id,
          prevValue: '',
          newValue: 'Ignored LWOP deduction',
          notes: `Justification: ${justification}`,
          organization: organization
        });

      } catch (error) {
        console.error(`Error ignoring deduction for report ${reportId}:`, error);
        results.failed.push({
          reportId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${reportIds.length} LWOP deductions`,
      results
    });

  } catch (error) {
    console.error('Error ignoring LWOP deductions:', error);
    res.status(500).json({ message: 'Error ignoring LWOP deductions' });
  }
};

// Override LWOP deduction amount
exports.overrideLWOPDeduction = async (req, res) => {
  try {
    const { reportIds, overrideAmount, justification } = req.body;
    const organization = req.user.organization;
    const reviewedBy = req.user._id;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({ message: 'Report IDs are required' });
    }

    if (overrideAmount === undefined || overrideAmount < 0) {
      return res.status(400).json({ message: 'Valid override amount is required' });
    }

    if (!justification) {
      return res.status(400).json({ message: 'Justification is required for overriding deductions' });
    }

    const results = {
      overridden: [],
      failed: []
    };

    for (const reportId of reportIds) {
      try {
        const report = await LWOPThresholdReport.findById(reportId)
          .populate('employee', 'fullName');

        if (!report) {
          results.failed.push({ 
            reportId, 
            error: 'Report not found' 
          });
          continue;
        }

        // Mark as override
        await report.markAsOverride(reviewedBy, overrideAmount, justification);

        results.overridden.push({
          reportId,
          employeeName: report.employee.fullName,
          originalAmount: report.suggestedDeductionAmount,
          overrideAmount: overrideAmount
        });

        // Log the action
        await PayrollAuditLog.create({
          date: new Date(),
          action: 'override_lwop_deduction',
          performedBy: reviewedBy,
          staff: report.employee._id,
          prevValue: `Suggested: ${report.suggestedDeductionAmount} QAR`,
          newValue: `Override: ${overrideAmount} QAR`,
          notes: `Justification: ${justification}`,
          organization: organization
        });

      } catch (error) {
        console.error(`Error overriding deduction for report ${reportId}:`, error);
        results.failed.push({
          reportId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Processed ${reportIds.length} LWOP deductions`,
      results
    });

  } catch (error) {
    console.error('Error overriding LWOP deductions:', error);
    res.status(500).json({ message: 'Error overriding LWOP deductions' });
  }
};

// Export LWOP report to Excel
exports.exportLWOPReport = async (req, res) => {
  try {
    const { payPeriod, department, leaveType, employee, status } = req.query;
    const organization = req.user.organization;

    // Build filter (same as getLWOPReports)
    const filter = { organization: organization };

    if (payPeriod) filter.payPeriod = payPeriod;
    if (status) filter.status = status;
    if (leaveType) filter.leaveType = leaveType;
    if (employee) filter.employee = employee;

    if (department) {
      const departmentUsers = await User.find({ 
        organization: organization, 
        department: department 
      }).select('_id');
      filter.employee = { $in: departmentUsers.map(u => u._id) };
    }

    const reports = await LWOPThresholdReport.find(filter)
      .populate('employee', 'fullName email department')
      .populate('leaveType', 'name')
      .populate('leaveRequest', 'startDate endDate reason')
      .populate('reviewedBy', 'fullName')
      .populate('postedBy', 'fullName')
      .sort({ createdAt: -1 });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('LWOP Threshold Report');

    // Define columns
    worksheet.columns = [
      { header: 'Employee ID', key: 'employeeId', width: 15 },
      { header: 'Employee Name', key: 'employeeName', width: 25 },
      { header: 'Department', key: 'department', width: 20 },
      { header: 'Leave Type', key: 'leaveType', width: 20 },
      { header: 'Leave Request ID', key: 'leaveRequestId', width: 20 },
      { header: 'Leave Period', key: 'leavePeriod', width: 25 },
      { header: 'Total Days', key: 'totalDays', width: 12 },
      { header: 'Threshold Days', key: 'thresholdDays', width: 15 },
      { header: 'Excess LWOP Days', key: 'excessDays', width: 18 },
      { header: 'Base Salary', key: 'baseSalary', width: 15 },
      { header: 'Daily Rate', key: 'dailyRate', width: 12 },
      { header: 'Suggested Deduction', key: 'suggestedDeduction', width: 20 },
      { header: 'Document Status', key: 'documentStatus', width: 15 },
      { header: 'Document Count', key: 'documentCount', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Reviewed By', key: 'reviewedBy', width: 20 },
      { header: 'Reviewed At', key: 'reviewedAt', width: 20 },
      { header: 'Posted By', key: 'postedBy', width: 20 },
      { header: 'Posted At', key: 'postedAt', width: 20 },
      { header: 'Justification', key: 'justification', width: 30 }
    ];

    // Add data rows
    reports.forEach(report => {
      worksheet.addRow({
        employeeId: report.employee._id,
        employeeName: report.employee.fullName,
        department: report.employee.department,
        leaveType: report.leaveType.name,
        leaveRequestId: report.leaveRequest._id,
        leavePeriod: `${report.leaveStartDate.toLocaleDateString()} - ${report.leaveEndDate.toLocaleDateString()}`,
        totalDays: report.totalRequestedDays,
        thresholdDays: report.thresholdDays,
        excessDays: report.excessLWOPDays,
        baseSalary: report.baseMonthlySalary,
        dailyRate: report.dailyRate.toFixed(2),
        suggestedDeduction: report.suggestedDeductionAmount.toFixed(2),
        documentStatus: report.documentStatus,
        documentCount: report.documentCount,
        status: report.status,
        reviewedBy: report.reviewedBy ? report.reviewedBy.fullName : '',
        reviewedAt: report.reviewedAt ? report.reviewedAt.toLocaleDateString() : '',
        postedBy: report.postedBy ? report.postedBy.fullName : '',
        postedAt: report.postedAt ? report.postedAt.toLocaleDateString() : '',
        justification: report.justification || ''
      });
    });

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Generate Excel buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Set response headers
    const fileName = `lwop-report-${payPeriod || 'all'}-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);

    // Log the export
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'export_lwop_report',
      performedBy: req.user._id,
      prevValue: '',
      newValue: `Exported LWOP report: ${fileName}`,
      notes: `Exported ${reports.length} records`,
      organization: organization
    });

  } catch (error) {
    console.error('Error exporting LWOP report:', error);
    res.status(500).json({ message: 'Error exporting LWOP report' });
  }
};

// Get document download URL for leave request attachment
exports.getDocumentDownloadUrl = async (req, res) => {
  try {
    const { reportId, attachmentIndex } = req.params;
    const organization = req.user.organization;

    const report = await LWOPThresholdReport.findById(reportId)
      .populate('leaveRequest', 'attachments');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    if (report.organization.toString() !== organization.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const leaveRequest = report.leaveRequest;
    const attachmentIndexNum = parseInt(attachmentIndex);

    if (!leaveRequest.attachments || attachmentIndexNum >= leaveRequest.attachments.length) {
      return res.status(404).json({ message: 'Attachment not found' });
    }

    const attachment = leaveRequest.attachments[attachmentIndexNum];
    
    // Extract S3 key from URL (assuming URL format: https://bucket.s3.region.amazonaws.com/key)
    const urlParts = attachment.url.split('/');
    const s3Key = urlParts.slice(3).join('/'); // Remove protocol and domain parts

    const signedUrl = getSignedUrl(s3Key, 3600); // 1 hour expiry

    res.json({
      downloadUrl: signedUrl,
      filename: attachment.originalName,
      size: attachment.size,
      mimeType: attachment.mimeType
    });

  } catch (error) {
    console.error('Error getting document download URL:', error);
    res.status(500).json({ message: 'Error getting document download URL' });
  }
};

// Get LWOP report summary statistics
exports.getLWOPSummary = async (req, res) => {
  try {
    const { payPeriod } = req.query;
    const organization = req.user.organization;

    const filter = { organization: organization };
    if (payPeriod) filter.payPeriod = payPeriod;

    const reports = await LWOPThresholdReport.find(filter);

    const summary = {
      totalReports: reports.length,
      totalExcessDays: reports.reduce((sum, r) => sum + r.excessLWOPDays, 0),
      totalSuggestedDeductions: reports.reduce((sum, r) => sum + r.suggestedDeductionAmount, 0),
      statusBreakdown: {
        unposted: reports.filter(r => r.status === 'unposted').length,
        posted: reports.filter(r => r.status === 'posted').length,
        ignored: reports.filter(r => r.status === 'ignored').length,
        override: reports.filter(r => r.status === 'override').length
      },
      documentStatusBreakdown: {
        required: reports.filter(r => r.documentStatus === 'required').length,
        provided: reports.filter(r => r.documentStatus === 'provided').length,
        missing: reports.filter(r => r.documentStatus === 'missing').length,
        not_required: reports.filter(r => r.documentStatus === 'not_required').length
      }
    };

    res.json(summary);

  } catch (error) {
    console.error('Error getting LWOP summary:', error);
    res.status(500).json({ message: 'Error getting LWOP summary' });
  }
};
