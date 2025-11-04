const LetterRequest = require('../models/LetterRequest');
const LetterTemplate = require('../models/LetterTemplate');
const LetterCategory = require('../models/LetterCategory');
const User = require('../models/User');
const StaffProfile = require('../models/StaffProfile');
const Notification = require('../models/Notification');
const SystemSettings = require('../models/SystemSettings');
const { uploadToS3, getSignedUrl, downloadFile } = require('../utils/s3');

// Helper function to extract S3 key from URL
const extractS3KeyFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname.substring(1); // Remove leading slash
  } catch (error) {
    console.error('Error extracting S3 key from URL:', error);
    return null;
  }
};
const PDFDocument = require('pdfkit');
const notificationService = require('../services/notificationService');
// Using native JavaScript date formatting instead of date-fns

// Helper function to format dates
const formatDate = (date, format = 'dd MMMM yyyy') => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
};

// Get all letter requests (admin view)
exports.getLetterRequests = async (req, res) => {
  try {
    const { 
      status, 
      category, 
      employee, 
      requestedBy, 
      startDate, 
      endDate,
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    const organization = req.user.organization;

    const query = { organization };
    
    // Apply filters
    if (status) query.status = status;
    if (category) query.category = category;
    if (employee) query.employee = employee;
    if (requestedBy) query.requestedBy = requestedBy;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [requests, total] = await Promise.all([
      LetterRequest.find(query)
        .populate('template', 'name description')
        .populate('category', 'name color icon')
        .populate('employee', 'fullName email department')
        .populate('requestedBy', 'fullName email')
        .populate('approvalDetails.approvedBy', 'fullName email')
        .populate('approvalDetails.rejectedBy', 'fullName email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      LetterRequest.countDocuments(query)
    ]);

    res.json({
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching letter requests:', error);
    res.status(500).json({ message: 'Error fetching letter requests' });
  }
};

// Get letter requests for current user (staff view)
exports.getMyLetterRequests = async (req, res) => {
  try {
    const { 
      status, 
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    const organization = req.user.organization;
    const userId = req.user._id;

    const query = { 
      organization,
      $or: [
        { employee: userId },
        { requestedBy: userId }
      ]
    };
    
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [requests, total] = await Promise.all([
      LetterRequest.find(query)
        .populate('template', 'name description')
        .populate('category', 'name color icon')
        .populate('employee', 'fullName email department')
        .populate('requestedBy', 'fullName email')
        .populate('approvalDetails.approvedBy', 'fullName email')
        .populate('approvalDetails.rejectedBy', 'fullName email')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      LetterRequest.countDocuments(query)
    ]);

    res.json({
      requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching my letter requests:', error);
    res.status(500).json({ message: 'Error fetching letter requests' });
  }
};

// Get a single letter request by ID
exports.getLetterRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;
    const userId = req.user._id;
    const userRole = req.user.role;

    const query = { _id: id, organization };
    
    // Staff can only view their own requests
    if (userRole === 'staff') {
      query.$or = [
        { employee: userId },
        { requestedBy: userId }
      ];
    }

    const request = await LetterRequest.findOne(query)
      .populate('template', 'name description templateContent placeholders')
      .populate('category', 'name color icon')
      .populate('employee', 'fullName email department position')
      .populate('requestedBy', 'fullName email')
      .populate('approvalDetails.approvedBy', 'fullName email')
      .populate('approvalDetails.rejectedBy', 'fullName email')
      .populate('auditLog.performedBy', 'fullName email');

    if (!request) {
      return res.status(404).json({ message: 'Letter request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Error fetching letter request:', error);
    res.status(500).json({ message: 'Error fetching letter request' });
  }
};

// Create a new letter request
exports.createLetterRequest = async (req, res) => {
  try {
    const { 
      template, 
      requestMessage, 
      customData, 
      priority = 'medium',
      isUrgent = false,
      dueDate 
    } = req.body;
    let { employee } = req.body;
    const organization = req.user.organization;
    const requestedBy = req.user._id;

    // Validate template exists and is active
    const templateDoc = await LetterTemplate.findOne({ 
      _id: template, 
      organization, 
      isActive: true 
    }).populate('category');

    if (!templateDoc) {
      return res.status(400).json({ message: 'Invalid or inactive template' });
    }

    // For staff users, automatically set employee to themselves
    if (req.user.role === 'staff') {
      employee = requestedBy; // Force staff to only request for themselves
    }
    
    // Validate employee field is not empty
    if (!employee || (typeof employee === 'string' && employee.trim() === '')) {
      return res.status(400).json({ message: 'Employee field is required' });
    }
    
    // Check if user can request for this employee (staff can only request for themselves)
    if (req.user.role === 'staff' && employee.toString() !== requestedBy.toString()) {
      return res.status(403).json({ message: 'You can only request letters for yourself' });
    }

    // Validate employee exists
    const employeeDoc = await User.findOne({ 
      _id: employee, 
      organization, 
      status: 'active' 
    });

    if (!employeeDoc) {
      console.error('Employee validation failed:', {
        employeeId: employee,
        organization,
        requestedBy,
        userRole: req.user.role
      });
      return res.status(400).json({ message: 'Invalid employee or employee not found in organization' });
    }

    const request = new LetterRequest({
      template,
      category: templateDoc.category._id,
      employee,
      requestedBy,
      organization,
      requestMessage,
      customData: customData || {},
      priority,
      isUrgent,
      dueDate: dueDate ? new Date(dueDate) : null,
      status: templateDoc.autoApprove ? 'approved' : 'pending'
    });

    // Generate request number manually since pre-save middleware might not be working
    try {
      const count = await LetterRequest.countDocuments({ organization: organization });
      request.requestNumber = `LR-${organization.toString().slice(-6)}-${String(count + 1).padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating request number:', error);
      // Fallback to timestamp-based number
      request.requestNumber = `LR-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    }

    console.log('Creating letter request with data:', {
      template: template,
      category: templateDoc.category._id,
      employee: employee,
      requestedBy: requestedBy,
      organization: organization,
      requestNumber: request.requestNumber,
      status: templateDoc.autoApprove ? 'approved' : 'pending'
    });

    await request.save();
    
    console.log('Letter request saved with requestNumber:', request.requestNumber);

    // Add audit log
    await request.addAuditLog('created', requestedBy, 'Letter request created');

    // Create notifications for admin users when request is submitted (if not auto-approved)
    if (!templateDoc.autoApprove) {
      try {
        const Organization = require('../models/Organization');
        const orgObj = await Organization.findById(organization).select('name');
        
        // Get all admin users in the organization
        const admins = await User.find({ 
          organization: organization, 
          role: 'admin',
          status: 'active'
        }).select('_id fullName email');

        if (admins.length > 0) {
          // Create system notifications using notificationService
          await Promise.all(admins.map(admin => notificationService.notifyUser({
            userId: admin._id,
            organization: organization,
            message: `${employeeDoc.fullName} submitted a letter request for ${templateDoc.name}`,
            type: 'letter',
            link: '/admin/official-letters',
            sender: requestedBy
          })));
          
          // Send emails to admins
          try {
            const { sendLetterRequestSubmissionEmail } = require('../services/emailService');
            await sendLetterRequestSubmissionEmail({
              organization: orgObj,
              admins,
              submitter: {
                fullName: employeeDoc.fullName,
                email: employeeDoc.email
              },
              request: {
                requestNumber: request.requestNumber,
                template: { name: templateDoc.name }
              }
            });
          } catch (emailErr) {
            console.error('Failed to send letter request submission emails:', emailErr);
          }
        }
      } catch (notificationError) {
        console.error('Error creating notifications for letter request:', notificationError);
      }
    }

    // If auto-approved, generate document immediately
    if (templateDoc.autoApprove) {
      await request.addAuditLog('approved', requestedBy, 'Auto-approved based on template settings');
      // Generate document
      await generateLetterDocument(request, templateDoc, employeeDoc, req.user);
    }

    await request.populate([
      'template', 'category', 'employee', 'requestedBy'
    ], 'name description templateContent placeholders name color icon fullName email department');

    console.log('Letter request created successfully:', {
      requestNumber: request.requestNumber,
      template: request.template?.name,
      employee: request.employee?.fullName,
      status: request.status,
      organization: organization
    });

    res.status(201).json(request);
  } catch (error) {
    console.error('Error creating letter request:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      message: 'Error creating letter request',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Approve a letter request
exports.approveLetterRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const organization = req.user.organization;
    const approvedBy = req.user._id;

    const request = await LetterRequest.findOne({ _id: id, organization })
      .populate('template')
      .populate('employee');

    if (!request) {
      return res.status(404).json({ message: 'Letter request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not in pending status' });
    }

    const previousStatus = request.status;
    request.status = 'approved';
    request.approvalDetails.approvedBy = approvedBy;
    request.approvalDetails.approvedAt = new Date();

    await request.save();
    await request.addAuditLog('approved', approvedBy, notes || 'Request approved', previousStatus, 'approved');

    // Notify the employee whose request was approved
    await notificationService.notifyUser({
      userId: request.employee._id,
      organization: organization,
      message: `Your letter request for ${request.template.name} has been approved.`,
      type: 'letter',
      link: '/official-letters',
      sender: approvedBy
    });
    
    // Send email to staff member
    try {
      const Organization = require('../models/Organization');
      const orgObj = await Organization.findById(organization).select('name');
      const staff = await User.findById(request.employee._id).select('fullName email');
      const adminUser = await User.findById(approvedBy).select('fullName email');
      
      if (orgObj && staff && adminUser) {
        const { sendLetterRequestDecisionEmail } = require('../services/emailService');
        await sendLetterRequestDecisionEmail({
          organization: orgObj,
          staff,
          admin: adminUser,
          request: {
            requestNumber: request.requestNumber,
            template: { name: request.template.name }
          },
          status: 'approved'
        });
      }
    } catch (emailErr) {
      console.error('Failed to send letter approval email:', emailErr);
    }

    // Generate the letter document
    await generateLetterDocument(request, request.template, request.employee, req.user);

    await request.populate([
      'template', 'category', 'employee', 'requestedBy', 'approvalDetails.approvedBy'
    ]);

    res.json(request);
  } catch (error) {
    console.error('Error approving letter request:', error);
    res.status(500).json({ message: 'Error approving letter request' });
  }
};

// Reject a letter request
exports.rejectLetterRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const organization = req.user.organization;
    const rejectedBy = req.user._id;

    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const request = await LetterRequest.findOne({ _id: id, organization });

    if (!request) {
      return res.status(404).json({ message: 'Letter request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not in pending status' });
    }

    const previousStatus = request.status;
    request.status = 'rejected';
    request.approvalDetails.rejectedBy = rejectedBy;
    request.approvalDetails.rejectedAt = new Date();
    request.approvalDetails.rejectionReason = rejectionReason;

    await request.save();
    await request.addAuditLog('rejected', rejectedBy, rejectionReason, previousStatus, 'rejected');

    // Notify the employee whose request was rejected
    await notificationService.notifyUser({
      userId: request.employee._id,
      organization: organization,
      message: `Your letter request has been rejected. Reason: ${rejectionReason}`,
      type: 'letter',
      link: '/official-letters',
      sender: rejectedBy
    });
    
    // Send email to staff member
    try {
      const Organization = require('../models/Organization');
      const orgObj = await Organization.findById(organization).select('name');
      const staff = await User.findById(request.employee._id).select('fullName email');
      const adminUser = await User.findById(rejectedBy).select('fullName email');
      
      if (orgObj && staff && adminUser) {
        await request.populate('template', 'name');
        const { sendLetterRequestDecisionEmail } = require('../services/emailService');
        await sendLetterRequestDecisionEmail({
          organization: orgObj,
          staff,
          admin: adminUser,
          request: {
            requestNumber: request.requestNumber,
            template: { name: request.template?.name || 'N/A' }
          },
          status: 'rejected',
          rejectionReason
        });
      }
    } catch (emailErr) {
      console.error('Failed to send letter rejection email:', emailErr);
    }

    await request.populate([
      'template', 'category', 'employee', 'requestedBy', 'approvalDetails.rejectedBy'
    ]);

    res.json(request);
  } catch (error) {
    console.error('Error rejecting letter request:', error);
    res.status(500).json({ message: 'Error rejecting letter request' });
  }
};

// Generate letter document (PDF)
const generateLetterDocument = async (request, template, employee, user) => {
  try {
    // Get employee profile data
    const employeeProfile = await StaffProfile.findOne({ 
      staffId: employee._id, 
      organization: request.organization 
    });

    // Get organization data
    const Organization = require('../models/Organization');
    const organization = await Organization.findById(request.organization);

    // Get system settings for logo
    const systemSettings = await SystemSettings.findOne({ organization: request.organization });

    // Get salary data if available
    const SalaryStructure = require('../models/SalaryStructure');
    const salaryStructure = await SalaryStructure.findOne({
      staff: employee._id,
      organization: request.organization,
      status: 'submitted'
    });

    // Prepare comprehensive placeholder data
    const placeholderData = {
      // Employee Information - Basic
      'employee.fullName': employee.fullName || '',
      'employee.firstName': employee.firstName || employee.fullName?.split(' ')[0] || '',
      'employee.lastName': employee.lastName || employee.fullName?.split(' ').slice(1).join(' ') || '',
      'employee.email': employee.email || '',
      'employee.phone': employee.phone || '',
      'employee.employeeId': employee._id.toString().slice(-6) || '',
      'employee.department': employee.department || '',
      'employee.position': employeeProfile?.workExperience?.[0]?.designation || employee.department || '',
      
      // Employee Information - Extended
      'employee.employmentType': employee.employmentType || 'Full-time',
      'employee.hireDate': employeeProfile?.workExperience?.[0]?.from ? formatDate(new Date(employeeProfile.workExperience[0].from)) : '',
      'employee.salary': salaryStructure?.basic || 0,
      'employee.address': employee.address || '',
      'employee.city': employee.city || '',
      'employee.country': employee.country || '',
      'employee.nationality': employeeProfile?.personalInfo?.nationality || '',
      'employee.passportNumber': employee.passportNumber || '',
      'employee.dateOfBirth': employeeProfile?.personalInfo?.dob ? formatDate(new Date(employeeProfile.personalInfo.dob)) : '',
      'employee.gender': employeeProfile?.personalInfo?.gender || '',
      'employee.maritalStatus': employeeProfile?.personalInfo?.maritalStatus || '',
      'employee.emergencyContact': employeeProfile?.personalInfo?.emergencyContact?.name || '',
      'employee.emergencyPhone': employeeProfile?.personalInfo?.emergencyContact?.phone || '',
      'employee.branch': employee.branch || '',
      
      // Organization Information
      'organization.name': organization?.name || '',
      'organization.address': organization?.address || '',
      'organization.city': organization?.city || '',
      'organization.country': organization?.country || '',
      'organization.phone': organization?.phone || '',
      'organization.email': organization?.email || '',
      'organization.website': organization?.website || '',
      'organization.taxId': organization?.taxId || '',
      'organization.licenseNumber': organization?.licenseNumber || '',
      'organization.establishedDate': organization?.establishedDate ? formatDate(new Date(organization.establishedDate)) : '',
      
      // System Information
      'currentDate': formatDate(new Date()),
      'currentTime': new Date().toLocaleTimeString(),
      'currentYear': new Date().getFullYear().toString(),
      'currentMonth': new Date().toLocaleDateString('en-US', { month: 'long' }),
      'letterNumber': `LTR-${new Date().getFullYear()}-${String(request._id).slice(-6).toUpperCase()}`,
      'requestNumber': request.requestNumber || '',
      'generatedBy': user?.fullName || 'System',
      'approvedBy': request.approvalDetails?.approvedBy ? 'Approved by Admin' : 'Pending Approval',
      'approvalDate': request.approvalDetails?.approvedAt ? formatDate(new Date(request.approvalDetails.approvedAt)) : '',
      
      // Salary Information
      'salary.basic': salaryStructure?.basic || 0,
      'salary.housing': salaryStructure?.housing || 0,
      'salary.transport': salaryStructure?.transport || 0,
      'salary.utility': salaryStructure?.utility || 0,
      'salary.bonus': salaryStructure?.bonus || 0,
      'salary.total': (salaryStructure?.basic || 0) + (salaryStructure?.housing || 0) + (salaryStructure?.transport || 0) + (salaryStructure?.utility || 0) + (salaryStructure?.bonus || 0),
      'salary.currency': 'AED',
      'salary.payPeriod': 'Monthly', // Default value
      'salary.paymentMethod': salaryStructure?.paymentMethod || 'Bank Transfer',
      
      // Leave Information - These would need to be populated based on context
      'leave.startDate': '',
      'leave.endDate': '',
      'leave.totalDays': '',
      'leave.type': '',
      'leave.reason': '',
      'leave.status': '',
      'leave.approvedBy': '',
      'leave.approvalDate': '',
      
      // Legacy placeholders for backward compatibility
      'employee.name': employee.fullName || '',
      'date.current': formatDate(new Date()),
      'date.request': formatDate(request.createdAt),
      'date.issue': formatDate(new Date()),
      'request.number': request.requestNumber,
      'request.message': request.requestMessage || '',
      'request.purpose': request.requestMessage || ''
    };

    // Replace placeholders in template content
    let processedContent = template.templateContent;
    Object.keys(placeholderData).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = placeholderData[key];
      processedContent = processedContent.replace(new RegExp(placeholder, 'g'), value);
    });

    // Generate PDF with enhanced formatting and branding
    const margin = template.formatting?.margin || { top: 50, bottom: 50, left: 50, right: 50 };
    const doc = new PDFDocument({ 
      margin: margin.top,
      size: 'A4',
      layout: 'portrait'
    });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', async () => {
      const pdfBuffer = Buffer.concat(chunks);
      
      // Upload to S3
      const fileName = `${template.name.replace(/\s+/g, '-')}-${employee.fullName.replace(/\s+/g, '-')}-${Date.now()}.pdf`;
      
      // Create file object for S3 upload with buffer
      const file = {
        buffer: pdfBuffer,
        originalname: fileName,
        mimetype: 'application/pdf'
      };
      
      try {
        const fileUrl = await uploadToS3(file, `letter-documents/${request.organization}`);
        
        // Extract S3 key from the returned URL
        const s3Key = extractS3KeyFromUrl(fileUrl);
        
        if (!s3Key) {
          throw new Error('Failed to extract S3 key from upload URL');
        }
        
        // Update request with document details
        request.generatedDocument = {
          filename: fileName,
          originalName: fileName,
          s3Key: s3Key,
          fileUrl: fileUrl,
          fileSize: pdfBuffer.length,
          mimeType: 'application/pdf',
          generatedAt: new Date()
        };
        request.status = 'generated';
        
        await request.save();
        await request.addAuditLog('generated', request.approvalDetails.approvedBy || request.requestedBy, 'Letter document generated');
      } catch (uploadError) {
        console.error('Error uploading to S3:', uploadError);
        throw uploadError;
      }
    });

    // Add branding elements
    const branding = template.branding || {};
    
    // Add company logo to top-right corner
    if (systemSettings?.logoUrl) {
      try {
        console.log('[Letter Generation] Adding company logo to PDF');
        
        let logoBuffer = null;
        
        // Handle different logo storage formats
        if (systemSettings.logoUrl.startsWith('data:image/')) {
          // Base64 encoded image
          const base64Data = systemSettings.logoUrl.split(',')[1];
          logoBuffer = Buffer.from(base64Data, 'base64');
          console.log('[Letter Generation] Using base64 logo');
        } else if (systemSettings.logoUrl.includes('amazonaws.com') || systemSettings.logoUrl.includes('s3')) {
          // S3 stored image - extract S3 key and download
          let s3Key = systemSettings.logoUrl;
          
          // If it's a full URL, extract the key
          if (systemSettings.logoUrl.includes('amazonaws.com')) {
            s3Key = systemSettings.logoUrl.split('amazonaws.com/')[1];
          } else if (systemSettings.logoUrl.includes('.s3.')) {
            s3Key = systemSettings.logoUrl.split('.s3.')[1].split('/').slice(1).join('/');
          }
          
          console.log('[Letter Generation] Downloading logo from S3, key:', s3Key);
          logoBuffer = await downloadFile(s3Key);
          console.log('[Letter Generation] Logo downloaded successfully');
        } else {
          // Direct URL - fetch the image
          const https = require('https');
          const http = require('http');
          
          logoBuffer = await new Promise((resolve, reject) => {
            const client = systemSettings.logoUrl.startsWith('https:') ? https : http;
            client.get(systemSettings.logoUrl, (response) => {
              const chunks = [];
              response.on('data', (chunk) => chunks.push(chunk));
              response.on('end', () => resolve(Buffer.concat(chunks)));
              response.on('error', reject);
            }).on('error', reject);
          });
          console.log('[Letter Generation] Logo fetched from URL');
        }
        
        if (logoBuffer) {
          // Position logo in top-right corner
          const logoSize = 80; // Fixed size for consistency
          const logoX = doc.page.width - margin.right - logoSize - 10; // 10px padding from right edge
          const logoY = margin.top + 10; // 10px padding from top
          
          console.log(`[Letter Generation] Adding logo at position (${logoX}, ${logoY}) with size ${logoSize}x${logoSize}`);
          
          // Add logo to PDF
          doc.image(logoBuffer, logoX, logoY, {
            width: logoSize,
            height: logoSize,
            fit: [logoSize, logoSize],
            align: 'center',
            valign: 'center'
          });
          
          console.log('[Letter Generation] Logo added successfully to PDF');
        }
      } catch (logoError) {
        console.error('[Letter Generation] Error adding logo to PDF:', logoError);
        // Continue without logo - don't fail the entire letter generation
      }
    } else {
      console.log('[Letter Generation] No logo configured in system settings');
    }

    // Set up fonts
    const headerFont = template.formatting?.headerFont || {
      family: 'Arial',
      size: 16,
      color: '#000000',
      bold: true,
      italic: false
    };
    
    const bodyFont = template.formatting?.bodyFont || {
      family: 'Arial',
      size: 12,
      color: '#000000',
      bold: false,
      italic: false
    };

    // Apply body font
    doc.fontSize(bodyFont.size);
    doc.fillColor(bodyFont.color);
    
    if (bodyFont.bold) {
      doc.font('Helvetica-Bold');
    } else if (bodyFont.italic) {
      doc.font('Helvetica-Oblique');
    } else {
      doc.font('Helvetica');
    }

    // Set line height
    const lineHeight = template.formatting?.lineHeight || 1.5;
    doc.lineGap(lineHeight * bodyFont.size - bodyFont.size);

    // Add content to PDF
    doc.text(processedContent, { 
      align: 'left',
      lineGap: lineHeight * bodyFont.size - bodyFont.size
    });

    // Add signature if enabled
    if (branding.showSignature) {
      try {
        const signatureSize = branding.signatureSize || 80;
        const signaturePosition = branding.signaturePosition || 'bottom-right';
        
        let signatureX = margin.left;
        let signatureY = doc.page.height - margin.bottom - signatureSize;
        
        if (signaturePosition === 'bottom-center') {
          signatureX = (doc.page.width - signatureSize) / 2;
        } else if (signaturePosition === 'bottom-right') {
          signatureX = doc.page.width - margin.right - signatureSize;
        }
        
        // Note: In a real implementation, you would download the signature from S3
        // For now, we'll skip the signature addition
        console.log(`Signature would be added at position: ${signatureX}, ${signatureY} with size: ${signatureSize}`);
      } catch (signatureError) {
        console.error('Error adding signature:', signatureError);
      }
    }

    // Add stamp if enabled
    if (branding.showStamp) {
      try {
        const stampSize = branding.stampSize || 60;
        const stampPosition = branding.stampPosition || 'bottom-left';
        
        let stampX = margin.left;
        let stampY = doc.page.height - margin.bottom - stampSize;
        
        if (stampPosition === 'bottom-center') {
          stampX = (doc.page.width - stampSize) / 2;
        } else if (stampPosition === 'bottom-right') {
          stampX = doc.page.width - margin.right - stampSize;
        }
        
        // Note: In a real implementation, you would download the stamp from S3
        // For now, we'll skip the stamp addition
        console.log(`Stamp would be added at position: ${stampX}, ${stampY} with size: ${stampSize}`);
      } catch (stampError) {
        console.error('Error adding stamp:', stampError);
      }
    }

    doc.end();

  } catch (error) {
    console.error('Error generating letter document:', error);
    throw error;
  }
};

// Download letter document
exports.downloadLetterDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;
    const userId = req.user._id;
    const userRole = req.user.role;

    const query = { _id: id, organization };
    
    // Staff can only download their own letters
    if (userRole === 'staff') {
      query.$or = [
        { employee: userId },
        { requestedBy: userId }
      ];
    }

    const request = await LetterRequest.findOne(query);

    if (!request) {
      return res.status(404).json({ message: 'Letter request not found' });
    }

    if (!request.generatedDocument || !request.generatedDocument.s3Key) {
      return res.status(400).json({ message: 'Document not generated yet' });
    }

    if (request.status !== 'generated') {
      return res.status(400).json({ message: 'Document not available for download' });
    }

    // Debug logging
    console.log('[Download] Request ID:', request._id);
    console.log('[Download] S3 Key:', request.generatedDocument.s3Key);
    console.log('[Download] File URL:', request.generatedDocument.fileUrl);

    // Validate and fix s3Key if needed
    let s3Key = request.generatedDocument.s3Key;
    if (!s3Key || typeof s3Key !== 'string' || s3Key.includes('Reason:') || s3Key.includes('{') || s3Key.includes('}')) {
      console.warn('[Download] Invalid s3Key detected, attempting to extract from fileUrl');
      console.warn('[Download] Current s3Key:', s3Key);
      
      // Try to extract s3Key from fileUrl as fallback
      if (request.generatedDocument.fileUrl) {
        try {
          const extractedKey = extractS3KeyFromUrl(request.generatedDocument.fileUrl);
          if (extractedKey) {
            s3Key = extractedKey;
            console.log('[Download] Extracted s3Key from URL:', s3Key);
            
            // Update the request with corrected s3Key
            request.generatedDocument.s3Key = s3Key;
            await request.save();
            console.log('[Download] Updated request with corrected s3Key');
          } else {
            throw new Error('Failed to extract S3 key from file URL');
          }
        } catch (urlError) {
          console.error('[Download] Failed to extract s3Key from URL:', urlError);
          return res.status(500).json({ message: 'Document file reference is invalid. Please regenerate the document.' });
        }
      } else {
        console.error('[Download] No fileUrl available for fallback');
        return res.status(500).json({ message: 'Document file reference is invalid. Please regenerate the document.' });
      }
    }

    // Generate signed URL for download
    const downloadUrl = getSignedUrl(s3Key, 300); // 5 minutes

    // Add download audit log
    await request.addAuditLog('downloaded', userId, 'Document downloaded');

    res.json({
      downloadUrl,
      fileName: request.generatedDocument.originalName,
      fileSize: request.generatedDocument.fileSize,
      mimeType: request.generatedDocument.mimeType
    });
  } catch (error) {
    console.error('Error downloading letter document:', error);
    res.status(500).json({ message: 'Error downloading letter document' });
  }
};

// Get letter request statistics
exports.getLetterRequestStats = async (req, res) => {
  try {
    const organization = req.user.organization;
    const userId = req.user._id;
    const userRole = req.user.role;

    const baseQuery = { organization };
    
    // Staff can only see their own stats
    if (userRole === 'staff') {
      baseQuery.$or = [
        { employee: userId },
        { requestedBy: userId }
      ];
    }

    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      generatedRequests
    ] = await Promise.all([
      LetterRequest.countDocuments(baseQuery),
      LetterRequest.countDocuments({ ...baseQuery, status: 'pending' }),
      LetterRequest.countDocuments({ ...baseQuery, status: 'approved' }),
      LetterRequest.countDocuments({ ...baseQuery, status: 'rejected' }),
      LetterRequest.countDocuments({ ...baseQuery, status: 'generated' })
    ]);

    res.json({
      total: totalRequests,
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests,
      generated: generatedRequests
    });
  } catch (error) {
    console.error('Error fetching letter request stats:', error);
    res.status(500).json({ message: 'Error fetching letter request statistics' });
  }
};
