const InventoryItem = require('../models/InventoryItem');
const User = require('../models/User');
const Notification = require('../models/Notification');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const InventoryItemName = require('../models/InventoryItemName');
const InventoryRequest = require('../models/InventoryRequest');
const InventoryCategory = require('../models/InventoryCategory');
const notificationService = require('../services/notificationService');
const { sendInventoryRequestSubmissionEmail, sendInventoryRequestDecisionEmail } = require('../services/emailService');
const { processProfileImagesInArray } = require('../utils/profileImageHelper');

// Admin: Add inventory items
const addInventory = asyncHandler(async (req, res) => {
  const { name, description, quantity, itemCode, category, minimumThreshold, unitCost } = req.body;
  
  if (!name || !quantity || quantity < 1 || !itemCode || !category) {
    return res.status(400).json({ message: 'Name, Item Code, Category, and Quantity are required.' });
  }

  const items = [];
  const baseSerialNumber = Date.now().toString();

  try {
    // Try to drop the problematic index if it exists
    try {
      await mongoose.connection.collections.inventoryitems.dropIndex('unitInventoryId_1');
    } catch (error) {
      // Ignore error if index doesn't exist
      console.log('Index drop attempt:', error.message);
    }

    for (let i = 0; i < quantity; i++) {
      const serialNumber = itemCode ? `${itemCode}-${Date.now()}-${i + 1}` : `SN-${Date.now()}-${i + 1}`;
      const code = quantity > 1 ? `${itemCode}-${i + 1}` : itemCode;
      console.log('Creating inventory item:', {
        serialNumber,
        code,
        name,
        description,
        category,
        quantity: 1,
        minimumThreshold,
        unitCost,
        organization: req.user.organization
      });
      const item = await InventoryItem.create({
        itemCode: code,
        serialNumber,
        name,
        description,
        category,
        quantity: 1,
        minimumThreshold: minimumThreshold || 0,
        unitCost: unitCost || 0,
        organization: req.user.organization
      });
      items.push(item);
    }

    res.status(201).json(items);
  } catch (error) {
    console.error('Error creating inventory items:', error);
    
    // Check for duplicate key error
    if (error.code === 11000) {
      if (error.keyPattern?.unitInventoryId) {
        // If the error is due to unitInventoryId, try to drop the index and return a retry message
        try {
          await mongoose.connection.collections.inventoryitems.dropIndex('unitInventoryId_1');
          return res.status(409).json({ 
            message: 'Please try again. The system has removed an old database constraint.',
            shouldRetry: true
          });
        } catch (dropError) {
          console.error('Error dropping index:', dropError);
        }
      }
      return res.status(400).json({ 
        message: 'Duplicate serial number or item ID detected. Please try again.',
        error: error.message 
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to create inventory items',
      error: error.message 
    });
  }
});

// Admin: Get all inventory items
const getAllInventory = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  
  let query = { organization: req.user.organization };
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { serialNumber: { $regex: search, $options: 'i' } },
      { status: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (status) {
    query.status = status;
  }

  const items = await InventoryItem.find(query)
    .populate('assignedTo', 'fullName email profileImage')
    .sort({ createdAt: -1 });
  
  res.json(items);
});

// Admin: Edit inventory item
const editInventory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Name is required.' });
  }

  const item = await InventoryItem.findOneAndUpdate(
    { _id: id, organization: req.user.organization },
    { name, description },
    { new: true }
  ).populate('assignedTo', 'fullName email profileImage');

  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }

  res.json(item);
});

// Admin: Delete inventory item
const deleteInventory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const item = await InventoryItem.findOneAndDelete({
    _id: id,
    organization: req.user.organization
  });

  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }

  res.json({ message: 'Item deleted successfully' });
});

// Admin: Bulk delete inventory items
const bulkDeleteInventory = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'No IDs provided' });
  }
  
  const result = await InventoryItem.deleteMany({
    _id: { $in: ids },
    organization: req.user.organization
  });

  res.json({ message: `${result.deletedCount} items deleted successfully` });
});

// Admin: Assign inventory item to staff
const assignInventory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { staffId } = req.body;

  console.log('Assigning inventory item:', { itemId: id, staffId, organization: req.user.organization });

  if (!staffId) {
    return res.status(400).json({ message: 'Staff ID is required' });
  }

  try {
    // Verify staff exists and belongs to the same organization
    const staff = await User.findOne({
      _id: staffId,
      organization: req.user.organization
    });

    if (!staff) {
      return res.status(404).json({ message: 'Staff member not found' });
    }

    const item = await InventoryItem.findOne({
      _id: id,
      organization: req.user.organization
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.status === 'assigned') {
      return res.status(400).json({ message: 'Item is already assigned' });
    }

    item.status = 'assigned';
    item.assignedTo = staffId;
    item.assignedDate = new Date();
    await item.save();

    const updatedItem = await item.populate('assignedTo', 'fullName email profileImage');
    console.log('Successfully assigned item:', { 
      itemId: id, 
      staffId, 
      staffName: updatedItem.assignedTo.fullName 
    });

    // Create notification for the staff member
    await Notification.create({
      message: `You have been assigned a new inventory item: ${item.name}`,
      type: 'inventory',
      link: `/my-inventory/${item._id}`,
      recipient: staffId,
      sender: req.user._id,
      organization: req.user.organization
    });
    
    // Send email to staff member
    try {
      const Organization = require('../models/Organization');
      const orgObj = await Organization.findById(req.user.organization).select('name');
      const staffMember = await User.findById(staffId).select('fullName email');
      
      if (orgObj && staffMember) {
        const { sendInventoryAssignmentEmail } = require('../services/emailService');
        await sendInventoryAssignmentEmail({
          organization: orgObj,
          staff: staffMember,
          admin: { fullName: req.user.fullName, email: req.user.email },
          item: {
            _id: item._id,
            name: item.name,
            category: item.category
          }
        });
      }
    } catch (emailErr) {
      console.error('Failed to send inventory assignment email:', emailErr);
    }

    res.json(updatedItem);
  } catch (error) {
    console.error('Error assigning inventory item:', error);
    res.status(500).json({ 
      message: 'Failed to assign inventory item',
      error: error.message 
    });
  }
});

// Admin: Unassign inventory item from staff
const unassignInventory = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const item = await InventoryItem.findOne({
      _id: id,
      organization: req.user.organization
    });

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.status !== 'assigned') {
      return res.status(400).json({ message: 'Item is not assigned' });
    }

    item.status = 'In Stock';
    item.assignedTo = null;
    item.assignedDate = null;
    await item.save();

    res.json(item);
  } catch (error) {
    console.error('Error unassigning inventory item:', error);
    res.status(500).json({
      message: 'Failed to unassign inventory item',
      error: error.message
    });
  }
});

// Staff: Get my inventory
const getMyInventory = asyncHandler(async (req, res) => {
  const items = await InventoryItem.find({
    assignedTo: req.user._id,
    organization: req.user.organization,
    status: 'assigned'
  }).sort({ assignedDate: -1 }).populate('assignedTo', 'fullName email profileImage');
  
  res.json(items);
});

// Get single inventory item
const getInventoryItem = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const item = await InventoryItem.findOne({
    _id: id,
    $or: [
      { organization: req.user.organization },
      { assignedTo: req.user._id }
    ]
  }).populate('assignedTo', 'fullName email profileImage');

  if (!item) {
    return res.status(404).json({ message: 'Item not found' });
  }

  res.json(item);
});

// Admin: Inventory summary with filters, search, pagination, and total value
const getInventorySummary = asyncHandler(async (req, res) => {
  const { category, status, search, startDate, endDate } = req.query;
  const orgId = req.user.organization;
  const query = { organization: orgId };

  if (category) query.category = category;
  if (status) query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { itemCode: { $regex: search, $options: 'i' } }
    ];
  }
  if (startDate || endDate) {
    query.lastUpdated = {};
    if (startDate) query.lastUpdated.$gte = new Date(startDate);
    if (endDate) query.lastUpdated.$lte = new Date(endDate);
  }

  // DEBUG: Fetch and log all inventory items for the organization
  const items = await InventoryItem.find({ organization: orgId });
  console.log('Inventory items:', items);

  const orgObjectId = new mongoose.Types.ObjectId(orgId);

  // DEBUG: Minimal aggregation by name
  const summaryAgg = await InventoryItem.aggregate([
    { $match: { organization: orgObjectId } },
    {
      $group: {
        _id: { name: "$name" },
        quantityInStock: { $sum: "$quantity" },
        category: { $first: "$category" },
        unitCost: { $first: "$unitCost" },
        minimumThreshold: { $first: "$minimumThreshold" },
        status: { $first: "$status" },
        lastUpdated: { $max: "$lastUpdated" },
        totalValue: { $sum: { $multiply: ["$unitCost", "$quantity"] } },
        assignedCount: {
          $sum: {
            $cond: [ { $eq: [ "$status", "assigned" ] }, 1, 0 ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        name: "$_id.name",
        category: 1,
        unitCost: 1,
        minimumThreshold: 1,
        status: 1,
        lastUpdated: 1,
        quantityInStock: 1,
        totalValue: 1,
        assignedCount: 1
      }
    }
  ]);

  const totalValue = summaryAgg.reduce((acc, item) => acc + (item.totalValue || 0), 0);

  res.json({
    items: summaryAgg,
    totalValue
  });
});

// GET /inventory/item-names
const getItemNames = asyncHandler(async (req, res) => {
  const orgId = req.user.organization;
  const names = await InventoryItemName.find({ organization: orgId }).sort({ name: 1 });
  res.json(names);
});

// POST /inventory/item-names
const createItemName = asyncHandler(async (req, res) => {
  const orgId = req.user.organization;
  const { name, category } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });
  if (!category) return res.status(400).json({ message: 'Category is required' });
  
  try {
    // Check if item name already exists in this organization
    const exists = await InventoryItemName.findOne({ name, organization: orgId });
    if (exists) {
      return res.status(400).json({ message: 'Item name already exists in your organization' });
    }
    
    const itemName = await InventoryItemName.create({ name, category, organization: orgId });
    res.status(201).json(itemName);
  } catch (error) {
    // Handle duplicate key error for compound unique index
    if (error.code === 11000 && error.keyPattern && (error.keyPattern.name || error.keyPattern.organization)) {
      return res.status(400).json({ message: 'Item name already exists in your organization' });
    }
    console.error('Error creating inventory item name:', error);
    res.status(500).json({ message: 'Failed to create item name', error: error.message });
  }
});

// DELETE /inventory/item-names/:id
const deleteItemName = asyncHandler(async (req, res) => {
  const orgId = req.user.organization;
  const { id } = req.params;
  const deleted = await InventoryItemName.findOneAndDelete({ _id: id, organization: orgId });
  if (!deleted) return res.status(404).json({ message: 'Item name not found' });
  res.json({ message: 'Item name deleted' });
});

// Staff: Submit a new inventory request
const createInventoryRequest = async (req, res) => {
  try {
    const { itemName, quantity, justification, requiredDate } = req.body;
    if (!itemName || !quantity || !justification || !requiredDate) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    // Look up category by itemName
    let category = null;
    const item = await InventoryItem.findOne({ name: itemName, organization: req.user.organization });
    if (item) {
      category = item.category;
    } else {
      // fallback: try InventoryItemName collection if exists
      const itemNameDoc = await InventoryItemName.findOne({ name: itemName, organization: req.user.organization });
      if (itemNameDoc && itemNameDoc.category) {
        category = itemNameDoc.category;
      }
    }
    if (!category) {
      return res.status(400).json({ message: 'Category not found for the selected item.' });
    }
    const request = new InventoryRequest({
      staff: req.user._id,
      itemName,
      category,
      quantity,
      justification,
      requiredDate,
      status: 'Pending',
      organization: req.user.organization
    });
    await request.save();

    // Notify & email all admins in the SAME organization (tenant isolation)
    if (request.status === 'Pending') {
      // In-app notifications (existing)
      await notificationService.notifyAllUsers({
        organization: request.organization,
        message: `${req.user.fullName} submitted a new inventory request.`,
        type: 'inventory',
        link: '/inventory/requests',
        sender: req.user._id,
        roles: ['admin']
      });

      // SMTP emails to admins in this organization only
      try {
        const admins = await User.find({ organization: request.organization, role: 'admin', status: { $ne: 'archived' } })
          .select('fullName email');
        const organization = (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id)
          ? req.user.organization
          : await require('../models/Organization').findById(request.organization).select('name');
        if (admins.length && organization) {
          await sendInventoryRequestSubmissionEmail({
            organization,
            admins,
            submitter: { fullName: req.user.fullName, email: req.user.email },
            request
          });
        }
      } catch (emailErr) {
        console.error('Failed to send inventory submission emails to admins:', emailErr);
      }
    }

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: List all inventory requests (with optional status filter)
const getAllInventoryRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { organization: req.user.organization };
    if (status) {
      filter.status = status;
    }
    const requests = await InventoryRequest.find(filter)
      .populate('staff', 'fullName email profileImage')
      .populate('decisionBy', 'fullName profileImage')
      .sort({ createdAt: -1 });
    
    // Convert profile images to signed URLs
    const processedRequests = processProfileImagesInArray(requests);
    res.json(processedRequests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin: Approve or reject an inventory request
const decisionInventoryRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminComment } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const request = await InventoryRequest.findOne({ 
      _id: id, 
      organization: req.user.organization 
    });
    if (!request) return res.status(404).json({ message: 'Request not found' });
    request.status = status;
    request.decisionDate = new Date();
    request.decisionBy = req.user._id;
    await request.save();

    // Email the staff submitter with tenant isolation
    try {
      const submitter = await User.findOne({ _id: request.staff, organization: request.organization })
        .select('fullName email organization');
      const organization = (req.user.organization && typeof req.user.organization === 'object' && req.user.organization._id)
        ? req.user.organization
        : await require('../models/Organization').findById(request.organization).select('name');
      if (submitter && organization) {
        await sendInventoryRequestDecisionEmail({
          organization,
          submitter,
          admin: { fullName: req.user.fullName, email: req.user.email },
          request,
          status,
          adminComment
        });
      }
    } catch (emailErr) {
      console.error('Failed to send inventory decision email:', emailErr);
    }

    // Notify the user whose request was actioned
    await notificationService.notifyUser({
      userId: request.staff,
      organization: request.organization,
      message: `Your inventory request has been ${status.toLowerCase()}.`,
      type: 'inventory',
      link: '/inventory/requests',
      sender: req.user._id
    });
    res.json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /inventory/categories
const getCategories = asyncHandler(async (req, res) => {
  const orgId = req.user.organization;
  const { active = true } = req.query;
  
  let filter = { organization: orgId };
  if (active !== 'false') {
    filter.isActive = true;
  }
  
  const categories = await InventoryCategory.find(filter)
    .sort({ name: 1 });
  
  res.json(categories);
});

// POST /inventory/categories
const createCategory = asyncHandler(async (req, res) => {
  const orgId = req.user.organization;
  const { name, description, icon, color } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }
  
  try {
    // Check if category already exists
    const existingCategory = await InventoryCategory.findOne({
      organization: orgId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    
    const category = await InventoryCategory.create({
      name: name.trim(),
      description: description?.trim(),
      icon: icon || 'FiBox',
      color: color || '#1C4E80',
      organization: orgId,
      createdBy: req.user._id
    });
    
    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating inventory category:', error);
    res.status(500).json({ message: 'Failed to create category', error: error.message });
  }
});

// PUT /inventory/categories/:id
const updateCategory = asyncHandler(async (req, res) => {
  const orgId = req.user.organization;
  const { id } = req.params;
  const { name, description, icon, color, isActive } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Category name is required' });
  }
  
  try {
    // Check if another category with this name exists
    const existingCategory = await InventoryCategory.findOne({
      organization: orgId,
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }
    
    const category = await InventoryCategory.findOneAndUpdate(
      { _id: id, organization: orgId },
      {
        name: name.trim(),
        description: description?.trim(),
        icon: icon || 'FiBox',
        color: color || '#1C4E80',
        isActive: isActive !== undefined ? isActive : true,
        updatedBy: req.user._id
      },
      { new: true }
    );
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('Error updating inventory category:', error);
    res.status(500).json({ message: 'Failed to update category', error: error.message });
  }
});

// DELETE /inventory/categories/:id
const deleteCategory = asyncHandler(async (req, res) => {
  const orgId = req.user.organization;
  const { id } = req.params;
  
  try {
    // Check if category is being used by any items
    const itemCount = await InventoryItem.countDocuments({
      organization: orgId,
      category: (await InventoryCategory.findById(id))?.name
    });
    
    if (itemCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category. It is being used by ${itemCount} inventory item(s).`
      });
    }
    
    const category = await InventoryCategory.findOneAndDelete({ _id: id, organization: orgId });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory category:', error);
    res.status(500).json({ message: 'Failed to delete category', error: error.message });
  }
});

module.exports = {
  addInventory,
  getAllInventory,
  editInventory,
  deleteInventory,
  bulkDeleteInventory,
  assignInventory,
  unassignInventory,
  getMyInventory,
  getInventoryItem,
  getInventorySummary,
  getItemNames,
  createItemName,
  deleteItemName,
  createInventoryRequest,
  getAllInventoryRequests,
  decisionInventoryRequest,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory
}; 