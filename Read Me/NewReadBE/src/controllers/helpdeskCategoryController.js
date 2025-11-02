const HelpdeskCategory = require('../models/HelpdeskCategory');
const HelpdeskTicket = require('../models/HelpdeskTicket');
const User = require('../models/User');

// Get all categories
exports.getCategories = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { active = true } = req.query;

    let filter = { organization: organizationId };
    if (active !== 'false') {
      filter.isActive = true;
    }

    let categories = await HelpdeskCategory.find(filter)
      .populate('assignedUsers', 'fullName email')
      .populate('autoAssignToUser', 'fullName email')
      .populate('createdBy', 'fullName')
      .sort({ name: 1 });

    // Create default categories if none exist
    if (categories.length === 0) {
      const defaultCategories = [
        {
          name: 'General Support',
          description: 'General helpdesk support requests',
          icon: 'FiHelpCircle',
          color: '#1C4E80',
          organization: organizationId,
          createdBy: req.user._id,
          defaultPriority: 'medium',
          isActive: true
        },
        {
          name: 'Technical Issues',
          description: 'Technical problems and IT support',
          icon: 'FiSettings',
          color: '#EA6A47',
          organization: organizationId,
          createdBy: req.user._id,
          defaultPriority: 'high',
          isActive: true
        },
        {
          name: 'Account Issues',
          description: 'User account and access problems',
          icon: 'FiUser',
          color: '#059669',
          organization: organizationId,
          createdBy: req.user._id,
          defaultPriority: 'medium',
          isActive: true
        }
      ];

      await HelpdeskCategory.insertMany(defaultCategories);
      
      // Fetch the newly created categories
      categories = await HelpdeskCategory.find(filter)
        .populate('assignedUsers', 'fullName email')
        .populate('autoAssignToUser', 'fullName email')
        .populate('createdBy', 'fullName')
        .sort({ name: 1 });
    }

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories', error: error.message });
  }
};

// Get single category
exports.getCategory = async (req, res) => {
  try {
    const category = await HelpdeskCategory.findById(req.params.id)
      .populate('assignedUsers', 'fullName email')
      .populate('autoAssignToUser', 'fullName email')
      .populate('createdBy', 'fullName');

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check access permissions
    if (!category.canAccess(req.user._id, req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Failed to fetch category', error: error.message });
  }
};

// Create new category
exports.createCategory = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const {
      name,
      description,
      icon,
      color,
      subcategories,
      assignedRoles,
      assignedUsers,
      autoAssignToRole,
      autoAssignToUser,
      defaultPriority,
      priorityRules
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    // Check if category name already exists
    const existingCategory = await HelpdeskCategory.findOne({
      organization: organizationId,
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCategory) {
      return res.status(400).json({ message: 'Category name already exists' });
    }

    // Create category
    const category = new HelpdeskCategory({
      name,
      description,
      icon,
      color,
      subcategories,
      assignedRoles,
      assignedUsers,
      autoAssignToRole,
      autoAssignToUser,
      defaultPriority,
      priorityRules,
      organization: organizationId,
      createdBy: req.user._id
    });

    await category.save();

    // Populate the saved category
    await category.populate([
      { path: 'assignedUsers', select: 'fullName email' },
      { path: 'autoAssignToUser', select: 'fullName email' },
      { path: 'createdBy', select: 'fullName' }
    ]);

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
};

// Update category
exports.updateCategory = async (req, res) => {
  try {
    const category = await HelpdeskCategory.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const {
      name,
      description,
      icon,
      color,
      subcategories,
      assignedRoles,
      assignedUsers,
      autoAssignToRole,
      autoAssignToUser,
      defaultPriority,
      priorityRules,
      isActive
    } = req.body;

    // Check if new name conflicts with existing categories
    if (name && name !== category.name) {
      const existingCategory = await HelpdeskCategory.findOne({
        organization: category.organization,
        _id: { $ne: category._id },
        name: { $regex: new RegExp(`^${name}$`, 'i') }
      });

      if (existingCategory) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (icon !== undefined) category.icon = icon;
    if (color !== undefined) category.color = color;
    if (subcategories !== undefined) category.subcategories = subcategories;
    if (assignedRoles !== undefined) category.assignedRoles = assignedRoles;
    if (assignedUsers !== undefined) category.assignedUsers = assignedUsers;
    if (autoAssignToRole !== undefined) category.autoAssignToRole = autoAssignToRole;
    if (autoAssignToUser !== undefined) category.autoAssignToUser = autoAssignToUser;
    if (defaultPriority !== undefined) category.defaultPriority = defaultPriority;
    if (priorityRules !== undefined) category.priorityRules = priorityRules;
    if (isActive !== undefined) category.isActive = isActive;
    
    category.updatedBy = req.user._id;

    await category.save();

    // Populate the updated category
    await category.populate([
      { path: 'assignedUsers', select: 'fullName email' },
      { path: 'autoAssignToUser', select: 'fullName email' },
      { path: 'createdBy', select: 'fullName' }
    ]);

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Failed to update category', error: error.message });
  }
};

// Delete category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await HelpdeskCategory.findById(req.params.id);
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if category has tickets
    const ticketCount = await HelpdeskTicket.countDocuments({ category: category._id });
    if (ticketCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. It has ${ticketCount} associated tickets.` 
      });
    }

    await HelpdeskCategory.findByIdAndDelete(req.params.id);

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category', error: error.message });
  }
};

// Get category statistics
exports.getCategoryStats = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const categories = await HelpdeskCategory.find({ 
      organization: organizationId, 
      isActive: true 
    }).sort({ name: 1 });

    const stats = await Promise.all(
      categories.map(async (category) => {
        const [
          totalTickets,
          openTickets,
          inProgressTickets,
          resolvedTickets,
          closedTickets,
          avgResolutionTime
        ] = await Promise.all([
          HelpdeskTicket.countDocuments({ 
            category: category._id, 
            createdAt: { $gte: startDate } 
          }),
          HelpdeskTicket.countDocuments({ 
            category: category._id, 
            status: 'open',
            createdAt: { $gte: startDate }
          }),
          HelpdeskTicket.countDocuments({ 
            category: category._id, 
            status: 'in_progress',
            createdAt: { $gte: startDate }
          }),
          HelpdeskTicket.countDocuments({ 
            category: category._id, 
            status: 'resolved',
            createdAt: { $gte: startDate }
          }),
          HelpdeskTicket.countDocuments({ 
            category: category._id, 
            status: 'closed',
            createdAt: { $gte: startDate }
          }),
          HelpdeskTicket.aggregate([
            { 
              $match: { 
                category: category._id, 
                resolvedAt: { $exists: true },
                createdAt: { $gte: startDate }
              } 
            },
            { 
              $group: { 
                _id: null, 
                avgTime: { $avg: { $subtract: ['$resolvedAt', '$createdAt'] } } 
              } 
            }
          ])
        ]);

        return {
          category: {
            _id: category._id,
            name: category.name,
            color: category.color,
            icon: category.icon
          },
          total: totalTickets,
          byStatus: {
            open: openTickets,
            inProgress: inProgressTickets,
            resolved: resolvedTickets,
            closed: closedTickets
          },
          avgResolutionTime: avgResolutionTime[0]?.avgTime || 0
        };
      })
    );

    res.json(stats);
  } catch (error) {
    console.error('Error fetching category stats:', error);
    res.status(500).json({ message: 'Failed to fetch category statistics', error: error.message });
  }
};

// Get available users for assignment
exports.getAvailableUsers = async (req, res) => {
  try {
    const organizationId = req.user.organization._id || req.user.organization;
    const { role } = req.query;

    let filter = { organization: organizationId };
    if (role) {
      filter.role = role;
    }

    const users = await User.find(filter)
      .select('fullName email role')
      .sort({ fullName: 1 });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};




