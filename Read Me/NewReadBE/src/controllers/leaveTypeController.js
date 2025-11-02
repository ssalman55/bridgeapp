const LeaveType = require('../models/LeaveType');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');

// Get all leave types for an organization
exports.getLeaveTypes = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;
    const organization = req.user.organization;

    let query = {
      organization: organization,
      isDeleted: false
    };

    if (!includeInactive) {
      query.isActive = true;
    }

    const leaveTypes = await LeaveType.find(query)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ name: 1 });

    res.json(leaveTypes);
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ message: 'Error fetching leave types' });
  }
};

// Get active leave types for staff dropdown
exports.getActiveLeaveTypes = async (req, res) => {
  try {
    const organization = req.user.organization;

    const leaveTypes = await LeaveType.findActiveByOrganization(organization);

    res.json(leaveTypes);
  } catch (error) {
    console.error('Error fetching active leave types:', error);
    res.status(500).json({ message: 'Error fetching active leave types' });
  }
};

// Create a new leave type
exports.createLeaveType = async (req, res) => {
  try {
    const { name, allocation, description, color, icon, documentThreshold } = req.body;
    const organization = req.user.organization;
    const createdBy = req.user._id;

    // Check if leave type with same name already exists
    const existingLeaveType = await LeaveType.findOne({
      organization: organization,
      name: name,
      isDeleted: false
    });

    if (existingLeaveType) {
      return res.status(400).json({ 
        message: 'Leave type with this name already exists' 
      });
    }

    const leaveType = new LeaveType({
      name,
      organization,
      allocation,
      description,
      color,
      icon,
      documentThreshold: documentThreshold || {
        enabled: false,
        days: 1,
        requiredDocumentTypes: [],
        description: ''
      },
      createdBy
    });

    await leaveType.save();

    // Populate the response
    await leaveType.populate('createdBy', 'fullName email');

    res.status(201).json({
      message: 'Leave type created successfully',
      leaveType
    });
  } catch (error) {
    console.error('Error creating leave type:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Leave type with this name already exists' 
      });
    }
    res.status(500).json({ message: 'Error creating leave type' });
  }
};

// Update a leave type
exports.updateLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, allocation, description, color, icon, isActive, documentThreshold } = req.body;
    const organization = req.user.organization;
    const updatedBy = req.user._id;

    const leaveType = await LeaveType.findOne({
      _id: id,
      organization: organization,
      isDeleted: false
    });

    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    // Check if name is being changed and if it conflicts with existing
    if (name && name !== leaveType.name) {
      const existingLeaveType = await LeaveType.findOne({
        organization: organization,
        name: name,
        _id: { $ne: id },
        isDeleted: false
      });

      if (existingLeaveType) {
        return res.status(400).json({ 
          message: 'Leave type with this name already exists' 
        });
      }
    }

    // Update fields
    if (name !== undefined) leaveType.name = name;
    if (allocation !== undefined) leaveType.allocation = allocation;
    if (description !== undefined) leaveType.description = description;
    if (color !== undefined) leaveType.color = color;
    if (icon !== undefined) leaveType.icon = icon;
    if (isActive !== undefined) leaveType.isActive = isActive;
    if (documentThreshold !== undefined) leaveType.documentThreshold = documentThreshold;
    
    leaveType.updatedBy = updatedBy;

    await leaveType.save();

    // Populate the response
    await leaveType.populate('createdBy', 'fullName email');
    await leaveType.populate('updatedBy', 'fullName email');

    res.json({
      message: 'Leave type updated successfully',
      leaveType
    });
  } catch (error) {
    console.error('Error updating leave type:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        message: 'Leave type with this name already exists' 
      });
    }
    res.status(500).json({ message: 'Error updating leave type' });
  }
};

// Delete a leave type (soft delete)
exports.deleteLeaveType = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;
    const deletedBy = req.user._id;

    const leaveType = await LeaveType.findOne({
      _id: id,
      organization: organization,
      isDeleted: false
    });

    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    // Check if there are any pending or approved leave requests using this type
    const activeRequests = await LeaveRequest.countDocuments({
      leaveType: id,
      status: { $in: ['Pending', 'Approved'] }
    });

    if (activeRequests > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete leave type with active leave requests. Please deactivate instead.' 
      });
    }

    await leaveType.softDelete(deletedBy);

    res.json({ message: 'Leave type deleted successfully' });
  } catch (error) {
    console.error('Error deleting leave type:', error);
    res.status(500).json({ message: 'Error deleting leave type' });
  }
};

// Get leave balance for a specific user and leave type
exports.getLeaveBalance = async (req, res) => {
  try {
    const { userId, leaveTypeId } = req.params;
    const organization = req.user.organization;

    // Verify the user belongs to the same organization
    const user = await User.findOne({
      _id: userId,
      organization: organization
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get the leave type
    const leaveType = await LeaveType.findOne({
      _id: leaveTypeId,
      organization: organization,
      isActive: true,
      isDeleted: false
    });

    if (!leaveType) {
      return res.status(404).json({ message: 'Leave type not found' });
    }

    // Calculate used days for this leave type
        const usedDays = await LeaveRequest.aggregate([
          {
            $match: {
              user: user._id,
              leaveType: leaveType._id,
              status: 'Approved',
              startDate: { $gte: new Date(new Date().getFullYear(), 0, 1) }, // From start of current year
              endDate: { $lte: new Date(new Date().getFullYear(), 11, 31) }  // To end of current year
            }
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: '$totalDays' }
            }
          }
        ]);

    const totalUsed = usedDays.length > 0 ? usedDays[0].totalDays : 0;
    const available = Math.max(0, leaveType.allocation - totalUsed);

    res.json({
      leaveType: {
        _id: leaveType._id,
        name: leaveType.name,
        allocation: leaveType.allocation,
        color: leaveType.color,
        icon: leaveType.icon
      },
      balance: {
        total: leaveType.allocation,
        used: totalUsed,
        available: available,
        percentage: leaveType.allocation > 0 ? Math.round((totalUsed / leaveType.allocation) * 100) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    res.status(500).json({ message: 'Error fetching leave balance' });
  }
};

// Get all leave balances for a user
exports.getUserLeaveBalances = async (req, res) => {
  try {
    const { userId } = req.params;
    const organization = req.user.organization;
    const currentUser = req.user;

    // If userId is 'me', use current user
    const targetUserId = userId === 'me' ? currentUser._id : userId;

    // Verify the user belongs to the same organization
    const user = await User.findOne({
      _id: targetUserId,
      organization: organization
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get all active leave types
    const leaveTypes = await LeaveType.findActiveByOrganization(organization);

    // Calculate balances for each leave type
    const balances = await Promise.all(
      leaveTypes.map(async (leaveType) => {
        const usedDays = await LeaveRequest.aggregate([
          {
            $match: {
              user: targetUserId,
              leaveType: leaveType._id,
              status: 'Approved',
              startDate: { $gte: new Date(new Date().getFullYear(), 0, 1) },
              endDate: { $lte: new Date(new Date().getFullYear(), 11, 31) }
            }
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: '$totalDays' }
            }
          }
        ]);

        const totalUsed = usedDays.length > 0 ? usedDays[0].totalDays : 0;
        const available = Math.max(0, leaveType.allocation - totalUsed);

        return {
          leaveType: {
            _id: leaveType._id,
            name: leaveType.name,
            allocation: leaveType.allocation,
            color: leaveType.color,
            icon: leaveType.icon
          },
          balance: {
            total: leaveType.allocation,
            used: totalUsed,
            available: available,
            percentage: leaveType.allocation > 0 ? Math.round((totalUsed / leaveType.allocation) * 100) : 0
          }
        };
      })
    );

    res.json(balances);
  } catch (error) {
    console.error('Error fetching user leave balances:', error);
    res.status(500).json({ message: 'Error fetching user leave balances' });
  }
};

// Get current user's leave balances (for dashboard widget)
exports.getCurrentUserLeaveBalances = async (req, res) => {
  try {
    const organization = req.user.organization;
    const userId = req.user._id;

    // Get all active leave types
    const leaveTypes = await LeaveType.findActiveByOrganization(organization);

    // Calculate balances for each leave type
    const balances = await Promise.all(
      leaveTypes.map(async (leaveType) => {
        const usedDays = await LeaveRequest.aggregate([
          {
            $match: {
              user: userId,
              leaveType: leaveType._id,
              status: 'Approved',
              startDate: { $gte: new Date(new Date().getFullYear(), 0, 1) },
              endDate: { $lte: new Date(new Date().getFullYear(), 11, 31) }
            }
          },
          {
            $group: {
              _id: null,
              totalDays: { $sum: '$totalDays' }
            }
          }
        ]);

        const totalUsed = usedDays.length > 0 ? usedDays[0].totalDays : 0;
        const available = Math.max(0, leaveType.allocation - totalUsed);

        return {
          leaveType: {
            _id: leaveType._id,
            name: leaveType.name,
            allocation: leaveType.allocation,
            color: leaveType.color,
            icon: leaveType.icon
          },
          balance: {
            total: leaveType.allocation,
            used: totalUsed,
            available: available,
            percentage: leaveType.allocation > 0 ? Math.round((totalUsed / leaveType.allocation) * 100) : 0
          }
        };
      })
    );

    res.json(balances);
  } catch (error) {
    console.error('Error fetching current user leave balances:', error);
    res.status(500).json({ message: 'Error fetching leave balances' });
  }
};
