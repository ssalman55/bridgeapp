const Payroll = require('../models/Payroll');
const SalaryStructure = require('../models/SalaryStructure');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const path = require('path');
const Organization = require('../models/Organization');
const SystemSettings = require('../models/SystemSettings');
const PayrollAuditLog = require('../models/PayrollAuditLog');

// Generate payroll for all staff for a given month (payPeriod: 'YYYY-MM')
exports.generatePayroll = async (req, res) => {
  try {
    const { payPeriod } = req.body;
    if (!payPeriod) return res.status(400).json({ error: 'payPeriod is required' });
    
    // Parse payPeriod (YYYY-MM) into start and end dates
    const [year, month] = payPeriod.split('-');
    const startDate = new Date(year, month - 1, 1); // First day of month
    const endDate = new Date(year, month, 0); // Last day of month
    
    const staffStructures = await SalaryStructure.find({ organization: req.user.organization })
      .populate('staff');
    const payrolls = [];
    const skipped = [];
    const failed = [];
    
    for (const structure of staffStructures) {
      try {
        // Only generate payroll if salary structure is submitted and locked
        if (structure.status !== 'submitted' || !structure.locked) {
          skipped.push({ staff: structure.staff._id, name: structure.staff.fullName, reason: 'Salary structure not submitted and locked' });
          continue;
        }
        // Check for existing payroll for this staff and payPeriod
        const existingPayroll = await Payroll.findOne({ 
          staff: structure.staff._id, 
          payPeriod,
          organization: req.user.organization 
        });
        if (existingPayroll) {
          skipped.push({ staff: structure.staff._id, name: structure.staff.fullName, reason: 'Payroll already exists for this period' });
          continue;
        }
        
        // Attendance integration (optional)
        let totalWorkdays = 22; // Default, or calculate from calendar
        let absences = 0;
        let overtime = 0;
        
        if (Attendance) {
          const attendances = await Attendance.find({
            user: structure.staff._id,
            organization: req.user.organization,
            date: {
              $gte: startDate,
              $lte: endDate
            }
          });
          totalWorkdays = attendances.length;
          absences = attendances.filter(a => a.status === 'Absent').length;
          overtime = attendances.reduce((sum, a) => sum + (a.overtime || 0), 0);
        }
        
        // Calculate gross/net using the new salary structure fields
        const grossSalary = structure.basic + 
          structure.housing + 
          structure.utility + 
          structure.bonus + 
          structure.transport + 
          structure.reimbursements;
        const totalDeductions = structure.deductions + structure.taxes;
        const netSalary = grossSalary - totalDeductions;
        
        // Create payroll
        const payroll = await Payroll.create({
          staff: structure.staff._id,
          organization: req.user.organization,
          salaryStructure: structure,
          payPeriod,
          totalWorkdays,
          absences,
          overtime,
          deductions: totalDeductions,
          bonuses: structure.bonus || 0,
          grossSalary,
          netSalary,
          paymentStatus: 'Pending',
          paymentMethod: 'Bank Transfer', // Default payment method
          bankDetails: {}, // Empty bank details as default
        });

        // Send notification to staff about payroll generation
        await Notification.create({
          message: `Your payroll for ${payPeriod} has been generated. Net salary: ${netSalary}`,
          type: 'payroll',
          link: '/my-payroll',
          recipient: structure.staff._id,
          sender: req.user._id,
          organization: req.user.organization
        });

        payrolls.push(payroll);
      } catch (err) {
        console.error(`Error generating payroll for staff ${structure.staff.fullName} (${structure.staff._id}):`, err);
        failed.push({ staff: structure.staff._id, name: structure.staff.fullName, error: err.message });
      }
    }
    res.status(201).json({ created: payrolls, skipped, failed });
  } catch (err) {
    console.error('Error generating payroll:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get all payrolls (with filters)
exports.getPayrolls = async (req, res) => {
  try {
    const { payPeriod, staff, department, role, employmentType, year, paymentStatus } = req.query;
    const orgId = (req.user.organization && req.user.organization._id)
      ? req.user.organization._id
      : req.user.organization;
    let match = { organization: new mongoose.Types.ObjectId(orgId) };
    if (payPeriod) match.payPeriod = payPeriod;
    if (staff) match.staff = staff;
    if (paymentStatus) match.paymentStatus = paymentStatus;
    if (year) match.payPeriod = { $regex: `^${year}-` };

    // Build aggregation pipeline
    const pipeline = [
      { $match: match },
      // Join staff
      { $lookup: {
          from: 'users',
          localField: 'staff',
          foreignField: '_id',
          as: 'staffObj'
        }
      },
      { $unwind: { path: '$staffObj', preserveNullAndEmptyArrays: true } },
    ];
    // Apply department/role/employmentType filters if provided
    const staffMatch = {};
    if (department) staffMatch['staffObj.department'] = department;
    if (role) staffMatch['staffObj.role'] = role;
    if (employmentType) staffMatch['staffObj.employmentType'] = employmentType;
    if (Object.keys(staffMatch).length) pipeline.push({ $match: staffMatch });

    // Add currency
    const settings = await SystemSettings.findOne({ organization: req.user.organization });
    const currency = settings?.currency || 'QAR';

    // Project fields and flatten staff
    pipeline.push({
      $addFields: {
        staff: '$staffObj',
        currency: currency
      }
    });
    pipeline.push({ $project: { staffObj: 0 } });

    const payrolls = await Payroll.aggregate(pipeline);
    res.json(payrolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mark payroll as paid
exports.markAsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod } = req.body;
    const payroll = await Payroll.findOneAndUpdate(
      { 
        _id: id,
        organization: req.user.organization 
      },
      { 
        paymentStatus: 'Paid', 
        paymentDate: new Date(), 
        paymentMethod 
      },
      { new: true }
    ).populate({ path: 'staff', select: 'fullName department profileImage' });

    if (!payroll) {
      return res.status(404).json({ error: 'Payroll not found' });
    }

    // Send notification to staff about salary payment
    await Notification.create({
      message: `Your salary for ${payroll.payPeriod} has been marked as paid. Amount: ${payroll.netSalary}`,
      type: 'payroll',
      link: '/my-payroll',
      recipient: payroll.staff._id,
      sender: req.user._id,
      organization: req.user.organization
    });

    const settings = await SystemSettings.findOne({ organization: req.user.organization });
    const currency = settings?.currency || 'QAR';
    res.json({ ...payroll.toObject(), currency });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get payslip for a payroll
exports.getPayslip = async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findOne({
      _id: id,
      organization: req.user.organization
    }).populate({ path: 'staff', select: 'fullName department profileImage' });
    if (!payroll) return res.status(404).json({ error: 'Payslip not found' });
    const settings = await SystemSettings.findOne({ organization: req.user.organization });
    const currency = settings?.currency || 'QAR';
    res.json({ ...payroll.toObject(), currency });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

// Get payrolls for a staff (self-service)
exports.getMyPayrolls = async (req, res) => {
  try {
    const payrolls = await Payroll.find({ 
      staff: req.user._id,
      organization: req.user.organization 
    }).populate({ path: 'staff', select: 'fullName department profileImage' });
    const settings = await SystemSettings.findOne({ organization: req.user.organization });
    const currency = settings?.currency || 'QAR';
    res.json(payrolls.map(p => ({ ...p.toObject(), currency })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate and download payslip PDF
exports.getPayslipPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const payroll = await Payroll.findOne({
      _id: id,
      organization: req.user.organization
    }).populate({ path: 'staff', select: 'fullName department profileImage' });
    if (!payroll) return res.status(404).json({ error: 'Payslip not found' });

    // Fetch organization name
    const organization = await Organization.findById(payroll.organization);
    const orgName = organization ? organization.name : 'Organization';

    // Fetch organization settings for logo
    const settings = await SystemSettings.findOne({ organization: payroll.organization });
    const logoUrl = settings?.logoUrl;

    // Calculate YTD gross/net
    const year = payroll.payPeriod.split('-')[0];
    const ytdPayrolls = await Payroll.find({
      staff: payroll.staff._id,
      organization: payroll.organization,
      payPeriod: { $regex: `^${year}-` }
    });
    const grossYTD = ytdPayrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
    const netYTD = ytdPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Payslip-${id}.pdf`);
    doc.pipe(res);

    // Header: Organization logo (right) and name (left)
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    if (logoUrl) {
      try {
        // If logoUrl is a URL, fetch and use it; if base64, use directly
        if (logoUrl.startsWith('data:image')) {
          doc.image(Buffer.from(logoUrl.split(',')[1], 'base64'), doc.page.width - doc.page.margins.right - 120, doc.page.margins.top, { width: 100, align: 'right' });
        } else {
          // Assume it's a URL or file path
          const https = require('https');
          const http = require('http');
          const { promisify } = require('util');
          const stream = require('stream');
          const get = logoUrl.startsWith('https') ? https.get : http.get;
          await new Promise((resolve, reject) => {
            get(logoUrl, (response) => {
              const data = [];
              response.on('data', chunk => data.push(chunk));
              response.on('end', () => {
                try {
                  const buffer = Buffer.concat(data);
                  doc.image(buffer, doc.page.width - doc.page.margins.right - 120, doc.page.margins.top, { width: 100, align: 'right' });
                  resolve();
                } catch (e) { resolve(); }
              });
              response.on('error', reject);
            });
          });
        }
      } catch (e) { /* ignore logo errors */ }
    }
    doc.fontSize(20).font('Helvetica-Bold').text(orgName, { align: 'left' });
    doc.moveDown(1.2);

    // Payslip Title
    doc.fontSize(16).font('Helvetica-Bold').text('Monthly Payroll Payslip', { align: 'left' });
    doc.moveDown(0.8);

    // Employee Info
    doc.fontSize(12).font('Helvetica-Bold').text('Employee Name', { continued: true }).font('Helvetica').text(`: ${payroll.staff.fullName}`);
    doc.font('Helvetica-Bold').text('Employee Number', { continued: true }).font('Helvetica').text(`: ${payroll.staff._id}`);
    doc.font('Helvetica-Bold').text('Pay Date', { continued: true }).font('Helvetica').text(`: ${payroll.paymentDate ? new Date(payroll.paymentDate).toLocaleDateString() : '-'}`);
    doc.moveDown(1.5);

    // Table: Payments and Deductions side by side
    const tableWidth = pageWidth * 0.9;
    const colWidth = tableWidth / 2;
    const startX = doc.page.margins.left + (pageWidth - tableWidth) / 2;
    let y = doc.y;

    // Table headers
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Payments', startX, y, { width: colWidth, align: 'left' });
    doc.text('Deductions', startX + colWidth, y, { width: colWidth, align: 'left' });
    y += 20;

    // Table rows
    doc.font('Helvetica').fontSize(11);
    const payments = [
      { desc: 'Basic Pay', val: payroll.salaryStructure.basic },
      { desc: 'Travel Allowance', val: payroll.salaryStructure.transport },
      { desc: 'Housing Allowance', val: payroll.salaryStructure.housing },
      { desc: 'Utility Allowance', val: payroll.salaryStructure.utility },
      { desc: 'Bonus', val: payroll.salaryStructure.bonus },
      { desc: 'Reimbursements', val: payroll.salaryStructure.reimbursements },
    ];
    const deductions = [
      { desc: 'Deductions', val: payroll.salaryStructure.deductions },
      { desc: 'Taxes', val: payroll.salaryStructure.taxes },
    ];
    const maxRows = Math.max(payments.length, deductions.length);
    for (let i = 0; i < maxRows; i++) {
      const p = payments[i];
      const d = deductions[i];
      doc.text(p ? `${p.desc}: ${p.val?.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '', startX, y, { width: colWidth, align: 'left' });
      doc.text(d ? `${d.desc}: ${d.val?.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '', startX + colWidth, y, { width: colWidth, align: 'left' });
      y += 18;
    }
    // Totals row
    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(`Total Payments: ${payroll.grossSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX, y, { width: colWidth, align: 'left' });
    doc.text(`Total Deductions: ${payroll.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX + colWidth, y, { width: colWidth, align: 'left' });
    y += 28;

    // NET PAY and YTD below the table
    doc.font('Helvetica-Bold').fontSize(13);
    const currency = settings?.currency || 'QAR';
    doc.text(`NET PAY: ${currency} ${payroll.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX, y, { width: tableWidth, align: 'left' });
    y += 20;
    doc.font('Helvetica').fontSize(12);
    doc.text(`Gross Paid YTD: ${grossYTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX, y, { width: tableWidth, align: 'left' });
    y += 16;
    doc.text(`Net Paid YTD: ${netYTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX, y, { width: tableWidth, align: 'left' });
    y += 30;

    doc.font('Helvetica').fontSize(10).fillColor('#888').text('This is a system-generated payslip.', startX, y, { width: tableWidth, align: 'center' });
    doc.end();
  } catch (error) {
    res.status(500).json({ message: 'Error generating payslip PDF' });
  }
};

// GET /api/payroll-audit
exports.getPayrollAuditLogs = async (req, res) => {
  try {
    const { dateFrom, dateTo, staff, action, search, page = 1, pageSize = 20 } = req.query;
    const orgId = req.user.organization._id || req.user.organization;
    const filter = { organization: orgId };
    if (dateFrom) filter.date = { ...filter.date, $gte: new Date(dateFrom) };
    if (dateTo) filter.date = { ...filter.date, $lte: new Date(dateTo) };
    if (staff) filter.staff = staff;
    if (action) filter.action = action;
    // Search by staff or performedBy name
    let userIds = [];
    if (search) {
      const users = await require('../models/User').find({
        fullName: { $regex: search, $options: 'i' },
        organization: orgId
      }, '_id');
      userIds = users.map(u => u._id);
      filter.$or = [
        { staff: { $in: userIds } },
        { performedBy: { $in: userIds } }
      ];
    }
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const total = await PayrollAuditLog.countDocuments(filter);
    const logs = await PayrollAuditLog.find(filter)
      .populate('performedBy', 'fullName profileImage')
      .populate('staff', 'fullName profileImage')
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(pageSize));
    res.json({ logs, total, page: parseInt(page), pageSize: parseInt(pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 