const Organization = require('../models/Organization');
const User = require('../models/User');

// Get all organizations with linking status
exports.getOrganizationsWithLinkingStatus = async (req, res) => {
  try {
    const organizations = await Organization.find({})
      .select('name email plan organizationType parentHeadOffice linkedBranches linkingStatus linkedAt linkedBy')
      .sort({ createdAt: -1 });

    // Get user counts for each organization
    const organizationsWithStats = await Promise.all(
      organizations.map(async (org) => {
        const userCount = await User.countDocuments({ organization: org._id });
        const branches = await Organization.find({ parentHeadOffice: org._id })
          .select('name email plan linkingStatus linkedAt');

        return {
          _id: org._id,
          name: org.name,
          email: org.email,
          plan: org.plan,
          organizationType: org.organizationType,
          parentHeadOffice: org.parentHeadOffice,
          linkedBranches: org.linkedBranches,
          linkingStatus: org.linkingStatus,
          linkedAt: org.linkedAt,
          linkedBy: org.linkedBy,
          userCount,
          branches: branches.map(branch => ({
            _id: branch._id,
            name: branch.name,
            email: branch.email,
            plan: branch.plan,
            linkingStatus: branch.linkingStatus,
            linkedAt: branch.linkedAt
          }))
        };
      })
    );

    res.json({
      success: true,
      data: organizationsWithStats
    });
  } catch (error) {
    console.error('Error fetching organizations with linking status:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching organizations with linking status'
    });
  }
};

// Get organization network hierarchy
exports.getOrganizationNetwork = async (req, res) => {
  try {
    const network = await Organization.getOrganizationNetwork();
    
    // Add user counts to each organization
    const networkWithStats = await Promise.all(
      network.map(async (org) => {
        const userCount = await User.countDocuments({ organization: org._id });
        return {
          ...org,
          userCount
        };
      })
    );

    res.json({
      success: true,
      data: networkWithStats
    });
  } catch (error) {
    console.error('Error fetching organization network:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching organization network'
    });
  }
};

// Create head office from existing organization
exports.createHeadOffice = async (req, res) => {
  try {
    const { organizationId, branchIds = [], dataSharingConfig = {} } = req.body;

    // Validate organization exists and can be converted to head office
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    if (organization.organizationType !== 'standalone') {
      return res.status(400).json({
        success: false,
        message: 'Organization is already a head office or branch'
      });
    }

    // Validate branch organizations
    if (branchIds.length > 0) {
      const branchOrgs = await Organization.find({
        _id: { $in: branchIds },
        organizationType: 'standalone'
      });

      if (branchOrgs.length !== branchIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more branch organizations are invalid or already linked'
        });
      }
    }

    // Convert organization to head office
    organization.organizationType = 'head-office';
    organization.linkedBranches = branchIds;
    organization.linkedAt = new Date();
    organization.linkedBy = req.user?.email || 'Owner Panel';
    organization.dataSharingConfig = {
      payroll: dataSharingConfig.payroll || { level: 'none', fields: [] },
      attendance: dataSharingConfig.attendance || { level: 'none', fields: [] },
      leave: dataSharingConfig.leave || { level: 'none', fields: [] },
      documents: dataSharingConfig.documents || { level: 'none', fields: [] },
      officialLetters: dataSharingConfig.officialLetters || { level: 'none', fields: [] }
    };

    await organization.save();

    // Convert selected organizations to branches
    if (branchIds.length > 0) {
      await Organization.updateMany(
        { _id: { $in: branchIds } },
        {
          organizationType: 'branch',
          parentHeadOffice: organizationId,
          linkedAt: new Date(),
          linkedBy: req.user?.email || 'Owner Panel'
        }
      );
    }

    // Get updated organization with branches
    const updatedHeadOffice = await Organization.findById(organizationId)
      .populate('linkedBranches', 'name email plan linkingStatus linkedAt');

    res.json({
      success: true,
      message: 'Head office created successfully',
      data: updatedHeadOffice
    });
  } catch (error) {
    console.error('Error creating head office:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating head office'
    });
  }
};

// Link organizations to existing head office
exports.linkOrganizations = async (req, res) => {
  try {
    const { headOfficeId, branchIds = [], dataSharingConfig = {} } = req.body;

    // Validate head office exists
    const headOffice = await Organization.findById(headOfficeId);
    if (!headOffice || headOffice.organizationType !== 'head-office') {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }

    // Validate branch organizations
    const branchOrgs = await Organization.find({
      _id: { $in: branchIds },
      organizationType: 'standalone'
    });

    if (branchOrgs.length !== branchIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more branch organizations are invalid or already linked'
      });
    }

    // Update data sharing config if provided
    if (Object.keys(dataSharingConfig).length > 0) {
      headOffice.dataSharingConfig = {
        ...headOffice.dataSharingConfig,
        ...dataSharingConfig
      };
      await headOffice.save();
    }

    // Link organizations to head office
    await Organization.updateMany(
      { _id: { $in: branchIds } },
      {
        organizationType: 'branch',
        parentHeadOffice: headOfficeId,
        linkedAt: new Date(),
        linkedBy: req.user?.email || 'Owner Panel'
      }
    );

    // Update head office linked branches
    headOffice.linkedBranches = [...new Set([...headOffice.linkedBranches, ...branchIds])];
    await headOffice.save();

    // Get updated head office with branches
    const updatedHeadOffice = await Organization.findById(headOfficeId)
      .populate('linkedBranches', 'name email plan linkingStatus linkedAt');

    res.json({
      success: true,
      message: 'Organizations linked successfully',
      data: updatedHeadOffice
    });
  } catch (error) {
    console.error('Error linking organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Error linking organizations'
    });
  }
};

// Unlink organization from head office
exports.unlinkOrganization = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    if (organization.organizationType === 'branch' && organization.parentHeadOffice) {
      // Remove from head office's linked branches
      await Organization.findByIdAndUpdate(
        organization.parentHeadOffice,
        { $pull: { linkedBranches: organizationId } }
      );

      // Convert back to standalone
      organization.organizationType = 'standalone';
      organization.parentHeadOffice = null;
      organization.linkedAt = null;
      organization.linkedBy = null;
      await organization.save();

      res.json({
        success: true,
        message: 'Organization unlinked successfully'
      });
    } else if (organization.organizationType === 'head-office') {
      // Convert all linked branches back to standalone
      await Organization.updateMany(
        { parentHeadOffice: organizationId },
        {
          organizationType: 'standalone',
          parentHeadOffice: null,
          linkedAt: null,
          linkedBy: null
        }
      );

      // Convert head office back to standalone
      organization.organizationType = 'standalone';
      organization.linkedBranches = [];
      organization.linkedAt = null;
      organization.linkedBy = null;
      await organization.save();

      res.json({
        success: true,
        message: 'Head office converted to standalone and all branches unlinked'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Organization is not linked to any head office'
      });
    }
  } catch (error) {
    console.error('Error unlinking organization:', error);
    res.status(500).json({
      success: false,
      message: 'Error unlinking organization'
    });
  }
};

// Update data sharing configuration
exports.updateDataSharingConfig = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { dataSharingConfig } = req.body;

    const organization = await Organization.findById(organizationId);
    if (!organization || organization.organizationType !== 'head-office') {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }

    organization.dataSharingConfig = {
      ...organization.dataSharingConfig,
      ...dataSharingConfig
    };
    await organization.save();

    res.json({
      success: true,
      message: 'Data sharing configuration updated successfully',
      data: organization.dataSharingConfig
    });
  } catch (error) {
    console.error('Error updating data sharing config:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating data sharing configuration'
    });
  }
};

// Get cross-organization analytics
exports.getCrossOrganizationAnalytics = async (req, res) => {
  try {
    const { headOfficeId } = req.params;

    const headOffice = await Organization.findById(headOfficeId)
      .populate('linkedBranches', 'name email plan linkingStatus');
    
    if (!headOffice || headOffice.organizationType !== 'head-office') {
      return res.status(404).json({
        success: false,
        message: 'Head office not found'
      });
    }

    // Get analytics for head office and all linked branches
    const allOrgIds = [headOfficeId, ...headOffice.linkedBranches.map(branch => branch._id)];
    
    // Import required models for comprehensive analytics
    const LeaveRequest = require('../models/LeaveRequest');
    const Attendance = require('../models/Attendance');
    const Payroll = require('../models/Payroll');
    const PayrollDeduction = require('../models/PayrollDeduction');
    const LetterRequest = require('../models/LetterRequest');
    const OrganizationDocument = require('../models/OrganizationDocument');
    
    const analytics = await Promise.all(
      allOrgIds.map(async (orgId) => {
        const org = await Organization.findById(orgId).select('name email plan');
        
        // User analytics
        const userCount = await User.countDocuments({ organization: orgId });
        const activeUsers = await User.countDocuments({ 
          organization: orgId, 
          isActive: { $ne: false } 
        });
        const adminUsers = await User.countDocuments({ 
          organization: orgId, 
          role: 'admin' 
        });
        const staffUsers = await User.countDocuments({ 
          organization: orgId, 
          role: 'staff' 
        });

        // Leave analytics
        const totalLeaveRequests = await LeaveRequest.countDocuments({ organization: orgId });
        const pendingLeaveRequests = await LeaveRequest.countDocuments({ 
          organization: orgId, 
          status: 'pending' 
        });
        const approvedLeaveRequests = await LeaveRequest.countDocuments({ 
          organization: orgId, 
          status: 'approved' 
        });
        const rejectedLeaveRequests = await LeaveRequest.countDocuments({ 
          organization: orgId, 
          status: 'rejected' 
        });

        // Attendance analytics (if attendance model exists)
        let attendanceStats = {
          totalRecords: 0,
          presentToday: 0,
          absentToday: 0,
          averageAttendance: 0
        };
        
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const totalAttendance = await Attendance.countDocuments({ organization: orgId });
          const presentTodayCount = await Attendance.countDocuments({ 
            organization: orgId,
            date: { $gte: today, $lt: tomorrow },
            status: 'present'
          });
          const absentTodayCount = await Attendance.countDocuments({ 
            organization: orgId,
            date: { $gte: today, $lt: tomorrow },
            status: 'absent'
          });
          
          attendanceStats = {
            totalRecords: totalAttendance,
            presentToday: presentTodayCount,
            absentToday: absentTodayCount,
            averageAttendance: totalAttendance > 0 ? Math.round((presentTodayCount / (presentTodayCount + absentTodayCount)) * 100) : 0
          };
        } catch (attendanceError) {
          console.log('Attendance model not available or error:', attendanceError.message);
        }

        // Payroll analytics
        let payrollStats = {
          totalPayrolls: 0,
          totalAmount: 0,
          averageSalary: 0,
          lwopDeductions: 0
        };
        
        try {
          const totalPayrolls = await Payroll.countDocuments({ organization: orgId });
          const payrollAggregation = await Payroll.aggregate([
            { $match: { organization: mongoose.Types.ObjectId(orgId) } },
            { $group: { _id: null, totalAmount: { $sum: '$totalNetPay' } } }
          ]);
          
          const lwopDeductions = await PayrollDeduction.aggregate([
            { $match: { organization: mongoose.Types.ObjectId(orgId), code: 'LWOP' } },
            { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
          ]);
          
          payrollStats = {
            totalPayrolls,
            totalAmount: payrollAggregation[0]?.totalAmount || 0,
            averageSalary: userCount > 0 ? Math.round((payrollAggregation[0]?.totalAmount || 0) / userCount) : 0,
            lwopDeductions: lwopDeductions[0]?.totalAmount || 0
          };
        } catch (payrollError) {
          console.log('Payroll analytics error:', payrollError.message);
        }

        // Official Letters analytics
        let letterStats = {
          totalRequests: 0,
          pendingRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0
        };
        
        try {
          const totalLetterRequests = await LetterRequest.countDocuments({ organization: orgId });
          const pendingLetterRequests = await LetterRequest.countDocuments({ 
            organization: orgId, 
            status: 'pending' 
          });
          const approvedLetterRequests = await LetterRequest.countDocuments({ 
            organization: orgId, 
            status: 'approved' 
          });
          const rejectedLetterRequests = await LetterRequest.countDocuments({ 
            organization: orgId, 
            status: 'rejected' 
          });
          
          letterStats = {
            totalRequests: totalLetterRequests,
            pendingRequests: pendingLetterRequests,
            approvedRequests: approvedLetterRequests,
            rejectedRequests: rejectedLetterRequests
          };
        } catch (letterError) {
          console.log('Letter analytics error:', letterError.message);
        }

        // Document analytics
        let documentStats = {
          totalDocuments: 0,
          recentUploads: 0
        };
        
        try {
          const totalDocs = await OrganizationDocument.countDocuments({ organization: orgId });
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const recentDocs = await OrganizationDocument.countDocuments({ 
            organization: orgId,
            createdAt: { $gte: sevenDaysAgo }
          });
          
          documentStats = {
            totalDocuments: totalDocs,
            recentUploads: recentDocs
          };
        } catch (docError) {
          console.log('Document analytics error:', docError.message);
        }

        return {
          _id: orgId,
          name: org.name,
          email: org.email,
          plan: org.plan,
          organizationType: orgId.toString() === headOfficeId ? 'head-office' : 'branch',
          // User analytics
          userCount,
          activeUsers,
          adminUsers,
          staffUsers,
          // Leave analytics
          leaveAnalytics: {
            totalRequests: totalLeaveRequests,
            pendingRequests: pendingLeaveRequests,
            approvedRequests: approvedLeaveRequests,
            rejectedRequests: rejectedLeaveRequests,
            approvalRate: totalLeaveRequests > 0 ? Math.round((approvedLeaveRequests / totalLeaveRequests) * 100) : 0
          },
          // Attendance analytics
          attendanceAnalytics: attendanceStats,
          // Payroll analytics
          payrollAnalytics: payrollStats,
          // Letter analytics
          letterAnalytics: letterStats,
          // Document analytics
          documentAnalytics: documentStats
        };
      })
    );

    // Calculate network-wide summary
    const networkSummary = {
      totalOrganizations: analytics.length,
      totalUsers: analytics.reduce((sum, org) => sum + org.userCount, 0),
      totalActiveUsers: analytics.reduce((sum, org) => sum + org.activeUsers, 0),
      totalBranches: headOffice.linkedBranches.length,
      totalLeaveRequests: analytics.reduce((sum, org) => sum + org.leaveAnalytics.totalRequests, 0),
      totalApprovedLeaves: analytics.reduce((sum, org) => sum + org.leaveAnalytics.approvedRequests, 0),
      totalPayrollAmount: analytics.reduce((sum, org) => sum + org.payrollAnalytics.totalAmount, 0),
      totalLetterRequests: analytics.reduce((sum, org) => sum + org.letterAnalytics.totalRequests, 0),
      totalDocuments: analytics.reduce((sum, org) => sum + org.documentAnalytics.totalDocuments, 0),
      averageNetworkAttendance: analytics.length > 0 ? 
        Math.round(analytics.reduce((sum, org) => sum + org.attendanceAnalytics.averageAttendance, 0) / analytics.length) : 0
    };

    res.json({
      success: true,
      data: {
        headOffice: analytics.find(org => org._id.toString() === headOfficeId),
        branches: analytics.filter(org => org._id.toString() !== headOfficeId),
        networkSummary,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    console.error('Error fetching cross-organization analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching cross-organization analytics'
    });
  }
};

// Get all head offices for dashboard navigation
exports.getHeadOffices = async (req, res) => {
  try {
    const headOffices = await Organization.find({ organizationType: 'head-office' })
      .select('name email plan linkedBranches linkedAt')
      .populate('linkedBranches', 'name email plan linkingStatus');

    // Add user counts for each head office
    const headOfficesWithStats = await Promise.all(
      headOffices.map(async (headOffice) => {
        const userCount = await User.countDocuments({ organization: headOffice._id });
        return {
          _id: headOffice._id,
          name: headOffice.name,
          email: headOffice.email,
          plan: headOffice.plan,
          linkedBranches: headOffice.linkedBranches,
          linkedAt: headOffice.linkedAt,
          userCount,
          branchCount: headOffice.linkedBranches.length
        };
      })
    );

    res.json({
      success: true,
      data: headOfficesWithStats
    });
  } catch (error) {
    console.error('Error fetching head offices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching head offices'
    });
  }
};

// Get available organizations for linking
exports.getAvailableOrganizationsForLinking = async (req, res) => {
  try {
    const { excludeId } = req.query;

    const query = {
      organizationType: 'standalone'
    };

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const organizations = await Organization.find(query)
      .select('name email plan createdAt')
      .sort({ name: 1 });

    // Add user counts
    const organizationsWithStats = await Promise.all(
      organizations.map(async (org) => {
        const userCount = await User.countDocuments({ organization: org._id });
        return {
          _id: org._id,
          name: org.name,
          email: org.email,
          plan: org.plan,
          userCount,
          createdAt: org.createdAt
        };
      })
    );

    res.json({
      success: true,
      data: organizationsWithStats
    });
  } catch (error) {
    console.error('Error fetching available organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available organizations'
    });
  }
};
