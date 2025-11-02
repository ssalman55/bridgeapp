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
const ExcelJS = require('exceljs');
const StaffBankDetails = require('../models/StaffBankDetails');
const { uploadFile, getSignedUrl } = require('../utils/s3');
const { processProfileImagesInArray, processProfileImages } = require('../utils/profileImageHelper');

// Helper function to generate payslip PDF buffer
const generatePayslipPDFBuffer = async (payroll) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Fetch organization name
      const organization = await Organization.findById(payroll.organization);
      const orgName = organization ? organization.name : 'Organization';

      // Fetch organization settings for logo and address
      const settings = await SystemSettings.findOne({ organization: payroll.organization });
      const logoUrl = settings?.logoUrl;
      const orgAddress = settings?.address;

      // Calculate YTD gross/net
      const year = payroll.payPeriod.split('-')[0];
      const ytdPayrolls = await Payroll.find({
        staff: payroll.staff._id,
        organization: payroll.organization,
        payPeriod: { $regex: `^${year}-` }
      });
      const grossYTD = ytdPayrolls.reduce((sum, p) => sum + (p.grossSalary || 0), 0);
      const netYTD = ytdPayrolls.reduce((sum, p) => sum + (p.netSalary || 0), 0);

      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4'
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      // Page dimensions
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const centerX = doc.page.margins.left + pageWidth / 2;

      // Header with organization name
      doc
        .fontSize(28)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text(orgName, doc.page.margins.left, 60, { align: 'left' });

      // Company address (only if configured)
      if (orgAddress) {
        doc
          .fontSize(12)
          .font('Helvetica')
          .fillColor('#4B5563')
          .text(orgAddress, doc.page.margins.left, doc.y + 10, { align: 'left' })
          .moveDown(2);
      } else {
        doc.moveDown(2);
      }

      // Divider line
      doc
        .moveTo(doc.page.margins.left, doc.y + 10)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y + 10)
        .strokeColor('#E5E7EB')
        .lineWidth(2)
        .stroke()
        .moveDown(2);

      // Payslip title
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#E67E22')
        .text('Monthly Payroll Payslip', doc.page.margins.left, doc.y, { align: 'left' })
        .moveDown(2);

      // Payslip details with improved spacing and formatting
      let currentY = doc.y;

      // Employee name
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Employee Name:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payroll.staff.fullName, doc.page.margins.left + 140, currentY);
      currentY += 25;

      // Employee number
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Employee Number:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payroll.staff._id, doc.page.margins.left + 140, currentY);
      currentY += 25;

      // Pay date
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Pay Date:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payroll.paymentDate ? new Date(payroll.paymentDate).toLocaleDateString() : '-', doc.page.margins.left + 120, currentY);
      currentY += 25;

      // Pay Period
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Pay Period:', doc.page.margins.left, currentY)
        .font('Helvetica')
        .fontSize(13)
        .fillColor('#374151')
        .text(payroll.payPeriod, doc.page.margins.left + 120, currentY);
      currentY += 35;

      // Payments and Deductions section with spacing
      const tableWidth = pageWidth * 0.95;
      const colWidth = (tableWidth - 40) / 2; // Subtract 40px for spacing between columns
      const spacingWidth = 40; // Width of the spacing column
      const startX = doc.page.margins.left + (pageWidth - tableWidth) / 2;

      // Section headers
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Payments', startX, currentY, { width: colWidth, align: 'left' })
        .text('Deductions', startX + colWidth + spacingWidth, currentY, { width: colWidth, align: 'left' });
      currentY += 25;

      // Payments and deductions data
      doc.font('Helvetica').fontSize(13).fillColor('#374151');
      
      const payments = [
        { desc: 'Basic Pay', val: payroll.salaryStructure.basic },
        { desc: 'Travel Allowance', val: payroll.salaryStructure.transport },
        { desc: 'Housing Allowance', val: payroll.salaryStructure.housing },
        { desc: 'Utility Allowance', val: payroll.salaryStructure.utility },
        { desc: 'Bonus', val: payroll.salaryStructure.bonus },
        { desc: 'Reimbursements', val: payroll.salaryStructure.reimbursements },
      ];
      
      // Calculate LWOP deduction amount for this payroll period
      const PayrollDeduction = require('../models/PayrollDeduction');
      const lwopDeductions = await PayrollDeduction.find({
        employee: payroll.staff._id,
        organization: payroll.organization,
        payPeriod: payroll.payPeriod,
        code: 'LWOP'
      });
      const totalLWOPAmount = lwopDeductions.reduce((sum, deduction) => sum + deduction.amount, 0);

      const deductions = [
        { desc: 'Deductions', val: payroll.salaryStructure.deductions },
        { desc: 'Taxes', val: payroll.salaryStructure.taxes },
        ...(totalLWOPAmount > 0 ? [{ desc: 'LWOP Deduction', val: totalLWOPAmount }] : []),
      ];

      const maxRows = Math.max(payments.length, deductions.length);
      for (let i = 0; i < maxRows; i++) {
        const p = payments[i];
        const d = deductions[i];
        
        if (p) {
          const labelWidth = colWidth - 80; // Space for the amount
          const amountWidth = 80;
          
          doc
            .font('Helvetica-Bold')
            .text(p.desc + ':', startX, currentY, { width: labelWidth, align: 'left' })
            .font('Helvetica')
            .text(p.val?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00', startX + labelWidth, currentY, { width: amountWidth, align: 'right' });
        }
        
        if (d) {
          const labelWidth = colWidth - 80; // Space for the amount
          const amountWidth = 80;
          
          doc
            .font('Helvetica-Bold')
            .text(d.desc + ':', startX + colWidth + spacingWidth, currentY, { width: labelWidth, align: 'left' })
            .font('Helvetica')
            .text(d.val?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00', startX + colWidth + spacingWidth + labelWidth, currentY, { width: amountWidth, align: 'right' });
        }
        
        currentY += 20;
      }

      // Totals row with divider
      currentY += 10;
      doc
        .moveTo(startX, currentY)
        .lineTo(startX + tableWidth, currentY)
        .strokeColor('#E5E7EB')
        .lineWidth(1)
        .stroke();
      currentY += 15;

      // Total Payments
      const labelWidth = colWidth - 80;
      const amountWidth = 80;
      
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('Total Payments:', startX, currentY, { width: labelWidth, align: 'left' })
        .fillColor('#16A34A')
        .text(payroll.grossSalary.toLocaleString(undefined, { minimumFractionDigits: 2 }), startX + labelWidth, currentY, { width: amountWidth, align: 'right' });

      // Total Deductions
      doc
        .fillColor('#1C4E80')
        .text('Total Deductions:', startX + colWidth + spacingWidth, currentY, { width: labelWidth, align: 'left' })
        .fillColor('#DC2626')
        .text(payroll.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 }), startX + colWidth + spacingWidth + labelWidth, currentY, { width: amountWidth, align: 'right' });
      currentY += 30;

      // NET PAY (prominent)
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#1C4E80')
        .text('NET PAY:', startX, currentY, { width: labelWidth, align: 'left' })
        .fillColor('#16A34A')
        .text(`${settings?.currency || 'QAR'} ${payroll.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX + labelWidth, currentY, { width: colWidth + amountWidth, align: 'right' });
      currentY += 30;

      // YTD information
      doc
        .fontSize(13)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text(`Gross Paid YTD: ${grossYTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX, currentY, { width: tableWidth, align: 'left' });
      currentY += 20;
      doc.text(`Net Paid YTD: ${netYTD.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, startX, currentY, { width: tableWidth, align: 'left' });
      currentY += 40;

      // Footer divider
      doc
        .moveTo(doc.page.margins.left, currentY)
        .lineTo(doc.page.width - doc.page.margins.right, currentY)
        .strokeColor('#E5E7EB')
        .lineWidth(1.5)
        .stroke();

      // Footer with system-generated note and support info
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#6B7280')
        .text('This is a system-generated payslip.', centerX, currentY + 20, { align: 'center' })
        .text('For support, contact support@stfbridge.com', centerX, currentY + 40, { align: 'center' });

      // End the document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

// Helper function to generate and store payslip to S3
const generateAndStorePayslip = async (payroll) => {
  try {
    // Generate unique filename with organization isolation: payslips/{orgId}/{userId}/{yyyy-mm}.pdf
    const orgId = payroll.organization;
    const userId = payroll.staff._id;
    const payPeriod = payroll.payPeriod;
    const s3Key = `payslips/${orgId}/${userId}/${payPeriod}.pdf`;

    // Generate PDF buffer
    const pdfBuffer = await generatePayslipPDFBuffer(payroll);

    // Upload to S3
    await uploadFile(
      { 
        buffer: pdfBuffer, 
        mimetype: 'application/pdf', 
        originalname: `payslip-${payPeriod}.pdf` 
      }, 
      s3Key
    );

    console.log(`Payslip generated and stored: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error('Error generating and storing payslip:', error);
    throw error;
  }
};

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
        // Skip if staff is null or not populated
        if (!structure.staff || !structure.staff._id) {
          skipped.push({ staff: structure.staff?._id || null, name: 'Unknown Staff', reason: 'Staff reference not found in salary structure' });
          continue;
        }

        // Only generate payroll if salary structure is submitted and locked
        if (structure.status !== 'submitted' || !structure.locked) {
          skipped.push({ staff: structure.staff._id, name: structure.staff.fullName || 'Unknown Staff', reason: 'Salary structure not submitted and locked' });
          continue;
        }
        // Check for existing payroll for this staff and payPeriod
        const existingPayroll = await Payroll.findOne({ 
          staff: structure.staff._id, 
          payPeriod,
          organization: req.user.organization 
        });
        if (existingPayroll) {
          skipped.push({ staff: structure.staff._id, name: structure.staff.fullName || 'Unknown Staff', reason: 'Payroll already exists for this period' });
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
        const staffId = structure.staff?._id || 'Unknown';
        const staffName = structure.staff?.fullName || 'Unknown Staff';
        console.error(`Error generating payroll for staff ${staffName} (${staffId}):`, err);
        failed.push({ staff: staffId, name: staffName, error: err.message });
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
    
    // Convert profile images to signed URLs
    const processedPayrolls = processProfileImagesInArray(payrolls);
    res.json(processedPayrolls);
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

    // Generate and store payslip PDF to S3 when marked as paid
    try {
      await generateAndStorePayslip(payroll);
      console.log(`Payslip generated for payroll ${payroll._id} (${payroll.payPeriod})`);
    } catch (payslipError) {
      console.error('Error generating payslip:', payslipError);
      // Don't fail the entire operation if payslip generation fails
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
    
    // Convert profile image to signed URL
    const processedPayroll = processProfileImages(payroll);
    res.json({ ...processedPayroll.toObject(), currency });
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
    
    // Convert profile image to signed URL
    const processedPayroll = processProfileImages(payroll);
    res.json({ ...processedPayroll.toObject(), currency });
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
    
    // Convert profile images to signed URLs
    const processedPayrolls = processProfileImagesInArray(payrolls);
    res.json(processedPayrolls.map(p => ({ ...p.toObject(), currency })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get payslip PDF (serve from S3 with signed URL)
exports.getPayslipPDF = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Debug: Log the request details
    console.log('Payslip request:', {
      payrollId: id,
      userId: req.user._id,
      userRole: req.user.role,
      userOrg: req.user.organization,
      userOrgType: typeof req.user.organization,
      userOrgId: req.user.organization._id || req.user.organization,
      jwtToken: req.headers.authorization ? req.headers.authorization.split(' ')[1].substring(0, 20) + '...' : 'No token'
    });
    
    const payroll = await Payroll.findOne({
      _id: id,
      organization: req.user.organization
    }).populate({ path: 'staff', select: 'fullName department profileImage' });
    
    if (!payroll) {
      console.log('Payroll not found for ID:', id, 'and organization:', req.user.organization);
      return res.status(404).json({ error: 'Payslip not found' });
    }
    
    // Convert profile image to signed URL
    processProfileImages(payroll);

    // Debug: Log the payroll details
    console.log('Payroll found:', {
      payrollId: payroll._id,
      payrollOrg: payroll.organization,
      payrollOrgType: typeof payroll.organization,
      staffId: payroll.staff._id,
      userOrg: req.user.organization,
      userOrgType: typeof req.user.organization
    });

    // Security check: Ensure user can only access their own payslips (unless admin)
    if (req.user.role !== 'admin' && req.user.role !== 'owner' && payroll.staff._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only view your own payslips.' });
    }

    // Additional security: Ensure the payroll belongs to the user's organization
    // Handle all possible cases: populated object, ObjectId, or string
    let userOrgId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Populated organization object
      userOrgId = req.user.organization._id.toString();
    } else if (req.user.organization) {
      // ObjectId or string
      userOrgId = req.user.organization.toString();
    } else {
      console.error('User organization is null or undefined');
      return res.status(403).json({ error: 'Access denied. Invalid organization context.' });
    }
    
    const payrollOrgId = payroll.organization.toString();
    
    console.log('Organization comparison:', {
      userOrgId,
      payrollOrgId,
      match: userOrgId === payrollOrgId,
      userOrgType: typeof req.user.organization,
      payrollOrgType: typeof payroll.organization
    });
    
    if (userOrgId !== payrollOrgId) {
      console.log('Organization mismatch:', {
        userOrgId,
        payrollOrgId,
        userOrgType: typeof req.user.organization,
        payrollOrgType: typeof payroll.organization
      });
      return res.status(403).json({ error: 'Access denied. Organization mismatch.' });
    }

    // Generate organization-isolated S3 key for the payslip
    const orgId = payroll.organization;
    const userId = payroll.staff._id;
    const payPeriod = payroll.payPeriod;
    const s3Key = `payslips/${orgId}/${userId}/${payPeriod}.pdf`;

    try {
      // Try to get signed URL for existing payslip
      const signedUrl = getSignedUrl(s3Key, 300); // 5 minutes expiry
      
      // Return the signed URL instead of generating PDF
      res.json({ 
        signedUrl,
        message: 'Payslip available for download',
        payPeriod: payroll.payPeriod,
        staffName: payroll.staff.fullName
      });
    } catch (s3Error) {
      // If payslip doesn't exist in S3, generate it on-demand (fallback)
      console.log(`Payslip not found in S3, generating on-demand: ${s3Key}`);
      
      try {
        // Only generate if payment status is Paid
        if (payroll.paymentStatus !== 'Paid') {
          return res.status(400).json({ 
            error: 'Payslip not available. Payment status must be "Paid" to generate payslip.' 
          });
        }

        // Generate and store payslip
        await generateAndStorePayslip(payroll);
        
        // Get signed URL for the newly generated payslip
        const signedUrl = getSignedUrl(s3Key, 300);
        
        res.json({ 
          signedUrl,
          message: 'Payslip generated and available for download',
          payPeriod: payroll.payPeriod,
          staffName: payroll.staff.fullName
        });
      } catch (generateError) {
        console.error('Error generating payslip on-demand:', generateError);
        res.status(500).json({ error: 'Failed to generate payslip' });
      }
    }
  } catch (error) {
    console.error('Error serving payslip:', error);
    res.status(500).json({ error: 'Error serving payslip' });
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

// Get organizations for payroll file generation
exports.getOrganizations = async (req, res) => {
  try {
    // Only return the organization of the currently logged-in user
    const orgId = req.user.organization._id || req.user.organization;
    const organization = await Organization.findById(orgId, 'name _id');
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }
    const formatted = [{
      label: organization.name,
      value: organization._id
    }];
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate payroll file for download
exports.generatePayrollFile = async (req, res) => {
  try {
    const { month, year, format, organizationId } = req.body;
    
    if (!month || !year || !format || !organizationId) {
      return res.status(400).json({ error: 'Month, year, format, and organization ID are required' });
    }

    const payPeriod = `${year}-${month.padStart(2, '0')}`;
    
    // Get all approved staff with active bank details for the organization
    const payrolls = await Payroll.find({
      organization: organizationId,
      payPeriod,
      paymentStatus: 'Paid'
    }).populate({
      path: 'staff',
      select: 'fullName _id'
    }).populate({
      path: 'salaryStructure',
      select: 'netSalary'
    });

    if (payrolls.length === 0) {
      return res.status(404).json({ error: 'No payroll data found for the specified period' });
    }

    // Validate that all staff have bank details
    const staffIds = payrolls
      .filter(p => p.staff && p.staff._id) // Filter out null staff
      .map(p => p.staff._id);
    
    if (staffIds.length === 0) {
      return res.status(400).json({ error: 'No valid staff data found in payroll records' });
    }
    
    const bankDetails = await StaffBankDetails.find({
      staff_id: { $in: staffIds },
      organization_id: organizationId,
      status: 'active'
    });

    // Find payrolls with and without bank details
    const payrollsWithBank = payrolls.filter(p =>
      p.staff && p.staff._id && bankDetails.find(bd => bd.staff_id.toString() === p.staff._id.toString())
    );
    const payrollsWithoutBank = payrolls.filter(p =>
      p.staff && p.staff._id && !bankDetails.find(bd => bd.staff_id.toString() === p.staff._id.toString())
    );

    if (payrollsWithBank.length === 0) {
      return res.status(400).json({
        error: 'None of the staff have active bank account details. At least one staff with active bank details is required to generate the payroll file.',
        missingStaff: payrollsWithoutBank.map(p => p.staff ? p.staff.fullName : 'Unknown Staff')
      });
    }

    // Prepare data for file generation (only those with bank details)
    const payrollData = payrollsWithBank.map(payroll => {
      const bankDetail = bankDetails.find(bd =>
        bd.staff_id.toString() === payroll.staff._id.toString()
      );
      return {
        employeeName: payroll.staff ? payroll.staff.fullName : 'Unknown Staff',
        employeeId: payroll.staff ? payroll.staff._id : 'Unknown',
        IBAN: bankDetail ? bankDetail.IBAN : '',
        bankName: bankDetail ? bankDetail.bank_name : '',
        netAmount: payroll.netSalary,
        currency: 'QAR',
        reference: `PAY-${payPeriod}-${payroll.staff ? payroll.staff._id : 'unknown'}`,
        remarks: `Salary for ${payPeriod}`
      };
    });

    // Generate file based on format
    let fileName = `payroll-${payPeriod}.${format.toLowerCase()}`;
    let fileContent;

    switch (format.toLowerCase()) {
      case 'csv':
        fileContent = generateCSV(payrollData);
        break;
      case 'excel':
        fileName = `payroll-${payPeriod}.xlsx`;
        fileContent = await generateExcel(payrollData);
        break;
      case 'pdf':
        fileName = `payroll-${payPeriod}.pdf`;
        fileContent = await generatePDF(payrollData, payPeriod);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported format. Use CSV, Excel, or PDF' });
    }

    // Prepare file buffer for S3 upload
    let fileBuffer;
    let mimeType;
    if (format.toLowerCase() === 'excel') {
      // ExcelJS workbook
      const stream = await fileContent.xlsx.writeBuffer();
      fileBuffer = Buffer.from(stream);
      mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else if (format.toLowerCase() === 'pdf') {
      fileBuffer = fileContent;
      mimeType = 'application/pdf';
    } else {
      // CSV
      fileBuffer = Buffer.from(fileContent, 'utf-8');
      mimeType = 'text/csv';
    }

    // Upload to S3
    const s3Key = `payroll-files/${fileName}`;
    await uploadFile({ buffer: fileBuffer, mimetype: mimeType, originalname: fileName }, s3Key);

    // Generate signed URL (5 minutes expiry)
    const downloadUrl = getSignedUrl(s3Key, 300);

    let message = `Payroll file generated successfully: ${fileName}`;
    let warning = undefined;
    if (payrollsWithoutBank.length > 0) {
      warning = `The following staff do not have active bank account details and were excluded from the file: ${payrollsWithoutBank.map(p => p.staff.fullName).join(', ')}`;
      message += ' (Some staff were excluded due to missing bank details)';
    }

    // Log the file generation
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'generate_file',
      performedBy: req.user._id,
      prevValue: '',
      newValue: `Generated ${format.toUpperCase()} file: ${fileName}`,
      notes: `Payroll file generated for ${payPeriod}`,
      organization: organizationId
    });

    res.json({
      success: true,
      message,
      warning,
      fileName,
      downloadUrl,
      recordCount: payrollsWithBank.length,
      excludedStaff: payrollsWithoutBank.map(p => p.staff.fullName)
    });

  } catch (err) {
    console.error('Error generating payroll file:', err);
    res.status(500).json({ error: err.message });
  }
};

// Download generated payroll file
exports.downloadPayrollFile = async (req, res) => {
  try {
    const { fileName } = req.params;
    const path = require('path');
    const fs = require('fs');
    
    const filePath = path.join(__dirname, '../../uploads/payroll-files', fileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Log the download
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'download_file',
      performedBy: req.user._id,
      prevValue: '',
      newValue: `Downloaded file: ${fileName}`,
      notes: 'Payroll file downloaded',
      organization: req.user.organization._id || req.user.organization
    });

    res.download(filePath);
  } catch (err) {
    console.error('Error downloading payroll file:', err);
    res.status(500).json({ error: err.message });
  }
};

// Helper function to generate CSV
function generateCSV(data) {
  const headers = ['Employee Name', 'Employee ID', 'IBAN', 'Bank Name', 'Net Amount', 'Currency', 'Reference', 'Remarks'];
  const csvContent = [
    headers.join(','),
    ...data.map(row => [
      `"${row.employeeName}"`,
      `"${row.employeeId}"`,
      `"${row.IBAN}"`,
      `"${row.bankName}"`,
      row.netAmount,
      `"${row.currency}"`,
      `"${row.reference}"`,
      `"${row.remarks}"`
    ].join(','))
  ].join('\n');
  
  return csvContent;
}

// Helper function to generate Excel
async function generateExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Payroll');
  
  // Add headers
  worksheet.columns = [
    { header: 'Employee Name', key: 'employeeName', width: 20 },
    { header: 'Employee ID', key: 'employeeId', width: 15 },
    { header: 'IBAN', key: 'IBAN', width: 25 },
    { header: 'Bank Name', key: 'bankName', width: 20 },
    { header: 'Net Amount', key: 'netAmount', width: 15 },
    { header: 'Currency', key: 'currency', width: 10 },
    { header: 'Reference', key: 'reference', width: 25 },
    { header: 'Remarks', key: 'remarks', width: 30 }
  ];
  
  // Add data
  data.forEach(row => {
    worksheet.addRow(row);
  });
  
  return workbook;
}

// Helper function to generate PDF
async function generatePDF(data, payPeriod) {
  const doc = new PDFDocument({ margin: 40 });
  const chunks = [];
  
  doc.on('data', chunk => chunks.push(chunk));
  
  // Header
  doc.fontSize(20).font('Helvetica-Bold').text('Payroll File', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica').text(`Period: ${payPeriod}`, { align: 'center' });
  doc.moveDown(2);
  
  // Table
  const tableTop = doc.y;
  const tableLeft = 40;
  const colWidths = [80, 60, 100, 80, 60, 40, 100, 100];
  
  // Headers
  const headers = ['Employee', 'ID', 'IBAN', 'Bank', 'Amount', 'Currency', 'Reference', 'Remarks'];
  let x = tableLeft;
  headers.forEach((header, i) => {
    doc.fontSize(10).font('Helvetica-Bold').text(header, x, tableTop, { width: colWidths[i] });
    x += colWidths[i];
  });
  
  // Data rows
  let y = tableTop + 20;
  data.forEach((row, index) => {
    if (y > doc.page.height - 100) {
      doc.addPage();
      y = 60;
    }
    
    x = tableLeft;
    doc.fontSize(9).font('Helvetica');
    doc.text(row.employeeName.substring(0, 15), x, y, { width: colWidths[0] });
    x += colWidths[0];
    doc.text(row.employeeId.toString().substring(0, 10), x, y, { width: colWidths[1] });
    x += colWidths[1];
    doc.text(row.IBAN.substring(0, 20), x, y, { width: colWidths[2] });
    x += colWidths[2];
    doc.text(row.bankName.substring(0, 15), x, y, { width: colWidths[3] });
    x += colWidths[3];
    doc.text(row.netAmount.toString(), x, y, { width: colWidths[4] });
    x += colWidths[4];
    doc.text(row.currency, x, y, { width: colWidths[5] });
    x += colWidths[5];
    doc.text(row.reference.substring(0, 20), x, y, { width: colWidths[6] });
    x += colWidths[6];
    doc.text(row.remarks.substring(0, 20), x, y, { width: colWidths[7] });
    
    y += 15;
  });
  
  doc.end();
  
  return new Promise((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

// Export the generateAndStorePayslip function for use in migration scripts
exports.generateAndStorePayslip = generateAndStorePayslip; 