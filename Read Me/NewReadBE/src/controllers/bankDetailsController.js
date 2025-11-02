const StaffBankDetails = require('../models/StaffBankDetails');
const User = require('../models/User');
const Notification = require('../models/Notification');
const PayrollAuditLog = require('../models/PayrollAuditLog');
const mongoose = require('mongoose');
const { sendBankDetailsEmail } = require('../services/emailService');
const Organization = require('../models/Organization');
const { processProfileImagesInArray } = require('../utils/profileImageHelper');

// Create or update bank details for a staff user
exports.createOrUpdateBankDetails = async (req, res) => {
  try {
    const {
      staff_id,
      account_holder_name,
      bank_name,
      IBAN,
      SWIFT_code,
      account_number,
      currency = 'QAR'
    } = req.body;

    // Validate required fields
    if (!account_holder_name || !bank_name || !IBAN) {
      return res.status(400).json({
        success: false,
        message: 'Account holder name, bank name, and IBAN are required'
      });
    }

    // Handle "me" endpoint for staff to update their own details
    let targetStaffId = staff_id;
    if (staff_id === 'me') {
      targetStaffId = req.user._id;
    }

    // Check if user is trying to update their own details or is admin
    const isOwnDetails = req.user._id.toString() === targetStaffId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwnDetails && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own bank details'
      });
    }

    // Get the organization ID - handle both populated and unpopulated references
    let organizationId;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organizationId = req.user.organization._id;
    } else {
      // Organization is not populated, use the ID directly
      organizationId = req.user.organization;
    }

    // Find existing bank details
    let bankDetails = await StaffBankDetails.findOne({
      staff_id: targetStaffId,
      organization_id: organizationId
    });

    if (bankDetails) {
      // Update existing record
      bankDetails.account_holder_name = account_holder_name;
      bankDetails.bank_name = bank_name;
      bankDetails.IBAN = IBAN;
      bankDetails.SWIFT_code = SWIFT_code;
      bankDetails.account_number = account_number;
      bankDetails.currency = currency;
      bankDetails.status = 'pending_verification'; // Reset to pending when updated
      bankDetails.verification_notes = '';
      bankDetails.verified_by = null;
      bankDetails.verified_at = null;
      
      await bankDetails.save();
    } else {
      // Create new record
      bankDetails = await StaffBankDetails.create({
        organization_id: organizationId,
        staff_id: targetStaffId,
        account_holder_name,
        bank_name,
        IBAN,
        SWIFT_code,
        account_number,
        currency
      });
    }

    // Get organization details for email
    let organization;
    if (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id) {
      // Organization is already populated
      organization = req.user.organization;
    } else {
      // Organization is not populated, fetch it
      organization = await Organization.findById(organizationId);
    }
    
    if (!organization) {
      console.error('Organization not found for bank details:', organizationId);
    } else {
      // Notify all admins in the SAME organization only - ensure tenant isolation
      const admins = await User.find({ 
        organization: organizationId, 
        role: 'admin', 
        status: { $ne: 'archived' } 
      });
      
      console.log(`Found ${admins.length} admins in organization ${organization.name} (${organizationId})`);
      
      // Send notification to HR/Admin about new/updated bank details
      const staffUser = await User.findById(targetStaffId);
      if (staffUser) {
        // Create in-app notifications for admins in the same organization
        await Promise.all(admins.map(admin => Notification.create({
          message: `${staffUser.fullName} has ${bankDetails.isNew ? 'submitted' : 'updated'} their bank details for verification`,
          type: 'payroll',
          link: '/admin/payroll/bank-details',
          recipient: admin._id,
          sender: req.user._id,
          organization: organizationId
        })));

        // Send SMTP emails to all admins in the same organization only
        if (admins.length > 0) {
          try {
            console.log(`Sending bank details emails to ${admins.length} admins in organization: ${organization.name} (${organizationId})`);
            
            const emailResult = await sendBankDetailsEmail({
              organization,
              admins,
              staff: {
                fullName: staffUser.fullName,
                email: staffUser.email,
                department: staffUser.department,
                role: staffUser.role
              },
              bankDetails
            });
            
            console.log('Bank details emails sent successfully:', {
              organization: organization.name,
              organizationId: organizationId,
              totalSent: emailResult.totalSent,
              totalFailed: emailResult.totalFailed,
              successfulEmails: emailResult.successfulEmails,
              failedEmails: emailResult.failedEmails
            });
          } catch (emailError) {
            console.error('Failed to send bank details emails:', emailError);
            // Don't fail the request if email sending fails
          }
        } else {
          console.log('No admins found in organization:', {
            organizationName: organization.name,
            organizationId: organizationId
          });
        }
      }
    }

    // Audit log
    await PayrollAuditLog.create({
      date: new Date(),
      action: bankDetails.isNew ? 'create' : 'update',
      performedBy: req.user._id,
      staff: targetStaffId,
      prevValue: bankDetails.isNew ? '' : 'Bank details updated',
      newValue: `Bank: ${bank_name}, IBAN: ${bankDetails.maskedIBAN}`,
      notes: 'Bank details updated',
      organization: organizationId
    });

    res.status(201).json({
      success: true,
      message: 'Bank details saved successfully',
      data: {
        ...bankDetails.toObject(),
        IBAN: bankDetails.maskedIBAN // Return masked IBAN for security
      }
    });
  } catch (error) {
    console.error('Error creating/updating bank details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error saving bank details'
    });
  }
};

// Get bank details for all staff in the organization (admin view)
exports.getBankDetails = async (req, res) => {
  try {
    const { status, staff_name, bank_name, page = 1, limit = 10 } = req.query;
    const orgId = req.user.organization._id || req.user.organization;

    // Build match conditions
    let match = { organization_id: new mongoose.Types.ObjectId(orgId) };
    if (status) match.status = status;

    // Build aggregation pipeline
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'staff_id',
          foreignField: '_id',
          as: 'staff'
        }
      },
      { $unwind: '$staff' }
    ];

    // Add staff name filter
    if (staff_name) {
      pipeline.push({
        $match: {
          'staff.fullName': { $regex: staff_name, $options: 'i' }
        }
      });
    }

    // Add bank name filter
    if (bank_name) {
      pipeline.push({
        $match: {
          bank_name: { $regex: bank_name, $options: 'i' }
        }
      });
    }

    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push(
      { $skip: skip },
      { $limit: parseInt(limit) },
      {
        $project: {
          _id: 1,
          account_holder_name: 1,
          bank_name: 1,
          IBAN: 1, // Show full IBAN for admin users
          SWIFT_code: 1,
          currency: 1,
          status: 1,
          verification_notes: 1,
          verified_at: 1,
          createdAt: 1,
          updatedAt: 1,
          staff: {
            _id: 1,
            fullName: 1,
            email: 1,
            department: 1,
            profileImage: 1
          }
        }
      }
    );

    const bankDetails = await StaffBankDetails.aggregate(pipeline);
    
    // Convert profile images to signed URLs
    const processedBankDetails = processProfileImagesInArray(bankDetails);

    // Get total count for pagination
    const countPipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'staff_id',
          foreignField: '_id',
          as: 'staff'
        }
      },
      { $unwind: '$staff' }
    ];

    if (staff_name) {
      countPipeline.push({
        $match: {
          'staff.fullName': { $regex: staff_name, $options: 'i' }
        }
      });
    }

    if (bank_name) {
      countPipeline.push({
        $match: {
          bank_name: { $regex: bank_name, $options: 'i' }
        }
      });
    }

    countPipeline.push({ $count: 'total' });
    const countResult = await StaffBankDetails.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      success: true,
      data: processedBankDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank details'
    });
  }
};

// Get bank details for a specific staff member
exports.getStaffBankDetails = async (req, res) => {
  try {
    const { staff_id } = req.params;
    const orgId = req.user.organization._id || req.user.organization;

    // Handle "me" endpoint for staff to get their own details
    let targetStaffId = staff_id;
    if (staff_id === 'me') {
      targetStaffId = req.user._id;
    }

    // Check if user is requesting their own details or is admin
    const isOwnDetails = req.user._id.toString() === targetStaffId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwnDetails && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'You can only view your own bank details'
      });
    }

    const bankDetails = await StaffBankDetails.findOne({
      staff_id: targetStaffId,
      organization_id: orgId
    }).populate('staff_id', 'fullName email department');

    if (!bankDetails) {
      return res.status(404).json({
        success: false,
        message: 'Bank details not found'
      });
    }

    // Return full IBAN only for admin or the staff member themselves
    const responseData = {
      ...bankDetails.toObject(),
      IBAN: isAdmin || isOwnDetails ? bankDetails.IBAN : bankDetails.maskedIBAN
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error fetching staff bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bank details'
    });
  }
};

// Verify bank details (admin only)
exports.verifyBankDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes = '' } = req.body;

    if (!['active', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "rejected"'
      });
    }

    const bankDetails = await StaffBankDetails.findOne({
      _id: id,
      organization_id: req.user.organization._id || req.user.organization
    }).populate('staff_id', 'fullName email');

    if (!bankDetails) {
      return res.status(404).json({
        success: false,
        message: 'Bank details not found'
      });
    }

    if (status === 'active') {
      await bankDetails.verify(req.user._id, notes);
    } else {
      await bankDetails.reject(req.user._id, notes);
    }

    // Send notification to staff member
    await Notification.create({
      message: `Your bank details have been ${status === 'active' ? 'verified' : 'rejected'}${notes ? `: ${notes}` : ''}`,
      type: 'payroll',
      link: '/my-profile',
      recipient: bankDetails.staff_id,
      sender: req.user._id,
      organization: req.user.organization._id || req.user.organization
    });

    // Audit log
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'verify',
      performedBy: req.user._id,
      staff: bankDetails.staff_id,
      prevValue: `Status: ${bankDetails.status}`,
      newValue: `Status: ${status}, Notes: ${notes}`,
      notes: `Bank details ${status}`,
      organization: req.user.organization._id || req.user.organization
    });

    res.json({
      success: true,
      message: `Bank details ${status} successfully`,
      data: {
        ...bankDetails.toObject(),
        IBAN: bankDetails.maskedIBAN
      }
    });
  } catch (error) {
    console.error('Error verifying bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying bank details'
    });
  }
};

// Delete bank details (admin only)
exports.deleteBankDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const bankDetails = await StaffBankDetails.findOne({
      _id: id,
      organization_id: req.user.organization._id || req.user.organization
    }).populate('staff_id', 'fullName email');

    if (!bankDetails) {
      return res.status(404).json({
        success: false,
        message: 'Bank details not found'
      });
    }

    // Audit log before deletion
    await PayrollAuditLog.create({
      date: new Date(),
      action: 'delete',
      performedBy: req.user._id,
      staff: bankDetails.staff_id,
      prevValue: `Bank: ${bankDetails.bank_name}, IBAN: ${bankDetails.maskedIBAN}`,
      newValue: 'Deleted',
      notes: 'Bank details deleted',
      organization: req.user.organization._id || req.user.organization
    });

    await StaffBankDetails.findByIdAndDelete(id);

    // Send notification to staff member
    await Notification.create({
      message: 'Your bank details have been deleted by an administrator',
      type: 'payroll',
      link: '/my-profile',
      recipient: bankDetails.staff_id,
      sender: req.user._id,
      organization: req.user.organization._id || req.user.organization
    });

    res.json({
      success: true,
      message: 'Bank details deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting bank details'
    });
  }
};

// Export bank details for payroll processing (admin only)
exports.exportBankDetails = async (req, res) => {
  try {
    const { status = 'active' } = req.query;
    const orgId = req.user.organization._id || req.user.organization;

    const bankDetails = await StaffBankDetails.find({
      organization_id: orgId,
      status
    }).populate('staff_id', 'fullName email department');

    // Format data for export
    const exportData = bankDetails.map(detail => ({
      'Staff Name': detail.staff.fullName,
      'Staff Email': detail.staff.email,
      'Department': detail.staff.department,
      'Account Holder Name': detail.account_holder_name,
      'Bank Name': detail.bank_name,
      'IBAN': detail.IBAN, // Full IBAN for payroll processing
      'SWIFT Code': detail.SWIFT_code || '',
      'Account Number': detail.account_number || '',
      'Currency': detail.currency,
      'Status': detail.status,
      'Verified At': detail.verified_at ? new Date(detail.verified_at).toLocaleDateString() : '',
      'Last Updated': new Date(detail.updatedAt).toLocaleDateString()
    }));

    res.json({
      success: true,
      data: exportData,
      count: exportData.length
    });
  } catch (error) {
    console.error('Error exporting bank details:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting bank details'
    });
  }
}; 