const LetterTemplate = require('../models/LetterTemplate');
const LetterCategory = require('../models/LetterCategory');
const LetterRequest = require('../models/LetterRequest');

// Get all letter templates for an organization
exports.getLetterTemplates = async (req, res) => {
  try {
    const { category, includeInactive = false } = req.query;
    const organization = req.user.organization;

    const query = { organization };
    if (category) {
      query.category = category;
    }
    if (!includeInactive) {
      query.isActive = true;
    }

    const templates = await LetterTemplate.find(query)
      .populate('category', 'name color icon')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ name: 1 });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching letter templates:', error);
    res.status(500).json({ message: 'Error fetching letter templates' });
  }
};

// Get a single letter template by ID
exports.getLetterTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;

    const template = await LetterTemplate.findOne({ _id: id, organization })
      .populate('category', 'name color icon')
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    if (!template) {
      return res.status(404).json({ message: 'Letter template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching letter template:', error);
    res.status(500).json({ message: 'Error fetching letter template' });
  }
};

// Create a new letter template
exports.createLetterTemplate = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      category, 
      templateContent, 
      placeholders, 
      requiresApproval, 
      autoApprove,
      isDefault,
      formatting,
      branding
    } = req.body;
    const organization = req.user.organization;
    const createdBy = req.user._id;

    console.log('Received template data:', { name, category, templateContent: templateContent?.substring(0, 100) + '...' });

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Template name is required' });
    }
    
    if (!category || !category.trim()) {
      return res.status(400).json({ message: 'Category is required' });
    }
    
    if (!templateContent || !templateContent.trim()) {
      return res.status(400).json({ message: 'Template content is required' });
    }

    // Validate category exists
    const categoryExists = await LetterCategory.findOne({ _id: category, organization, isActive: true });
    if (!categoryExists) {
      return res.status(400).json({ message: 'Invalid or inactive category' });
    }

    // Check if template with same name already exists
    const existingTemplate = await LetterTemplate.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }, 
      organization 
    });

    if (existingTemplate) {
      return res.status(400).json({ message: 'Template with this name already exists' });
    }

    // If this is set as default, unset other defaults in the same category
    if (isDefault) {
      await LetterTemplate.updateMany(
        { category, organization },
        { isDefault: false }
      );
    }

    const template = new LetterTemplate({
      name,
      description,
      category,
      organization,
      templateContent,
      placeholders: placeholders || [],
      requiresApproval: requiresApproval !== false, // Default to true
      autoApprove: autoApprove || false,
      isDefault: isDefault || false,
      formatting: formatting || {
        headerFont: {
          family: 'Arial',
          size: 16,
          color: '#000000',
          bold: true,
          italic: false
        },
        bodyFont: {
          family: 'Arial',
          size: 12,
          color: '#000000',
          bold: false,
          italic: false
        },
        lineHeight: 1.5,
        margin: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      },
      branding: branding || {
        showLogo: true,
        logoPosition: 'top-left',
        logoSize: 100,
        showSignature: true,
        signaturePosition: 'bottom-right',
        signatureSize: 80,
        showStamp: false,
        stampPosition: 'bottom-left',
        stampSize: 60
      },
      createdBy
    });

    await template.save();
    await template.populate(['category', 'createdBy'], 'name color icon fullName email');

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating letter template:', error);
    res.status(500).json({ message: 'Error creating letter template' });
  }
};

// Update a letter template
exports.updateLetterTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      description, 
      category, 
      templateContent, 
      placeholders, 
      requiresApproval, 
      autoApprove,
      isActive,
      isDefault,
      version,
      formatting,
      branding
    } = req.body;
    const organization = req.user.organization;
    const updatedBy = req.user._id;

    const template = await LetterTemplate.findOne({ _id: id, organization });

    if (!template) {
      return res.status(404).json({ message: 'Letter template not found' });
    }

    // Validate category if being changed
    if (category && category !== template.category.toString()) {
      const categoryExists = await LetterCategory.findOne({ _id: category, organization, isActive: true });
      if (!categoryExists) {
        return res.status(400).json({ message: 'Invalid or inactive category' });
      }
    }

    // Check if new name conflicts with existing template (excluding current one)
    if (name && name !== template.name) {
      const existingTemplate = await LetterTemplate.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') }, 
        organization,
        _id: { $ne: id }
      });

      if (existingTemplate) {
        return res.status(400).json({ message: 'Template with this name already exists' });
      }
    }

    // If this is set as default, unset other defaults in the same category
    if (isDefault && !template.isDefault) {
      const targetCategory = category || template.category;
      await LetterTemplate.updateMany(
        { category: targetCategory, organization, _id: { $ne: id } },
        { isDefault: false }
      );
    }

    // Update fields
    if (name !== undefined) template.name = name;
    if (description !== undefined) template.description = description;
    if (category !== undefined) template.category = category;
    if (templateContent !== undefined) template.templateContent = templateContent;
    if (placeholders !== undefined) template.placeholders = placeholders;
    if (requiresApproval !== undefined) template.requiresApproval = requiresApproval;
    if (autoApprove !== undefined) template.autoApprove = autoApprove;
    if (isActive !== undefined) template.isActive = isActive;
    if (isDefault !== undefined) template.isDefault = isDefault;
    if (version !== undefined) template.version = version;
    if (formatting !== undefined) template.formatting = formatting;
    if (branding !== undefined) template.branding = branding;
    template.updatedBy = updatedBy;

    await template.save();
    await template.populate(['category', 'createdBy', 'updatedBy'], 'name color icon fullName email');

    res.json(template);
  } catch (error) {
    console.error('Error updating letter template:', error);
    res.status(500).json({ message: 'Error updating letter template' });
  }
};

// Delete a letter template
exports.deleteLetterTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;

    const template = await LetterTemplate.findOne({ _id: id, organization });

    if (!template) {
      return res.status(404).json({ message: 'Letter template not found' });
    }

    // Check if template has associated requests
    const requestCount = await LetterRequest.countDocuments({ template: id, organization });
    if (requestCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete template. It has ${requestCount} associated request(s). Please handle the requests first.` 
      });
    }

    await LetterTemplate.findByIdAndDelete(id);
    res.json({ message: 'Letter template deleted successfully' });
  } catch (error) {
    console.error('Error deleting letter template:', error);
    res.status(500).json({ message: 'Error deleting letter template' });
  }
};

// Toggle template active status
exports.toggleTemplateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;
    const updatedBy = req.user._id;

    const template = await LetterTemplate.findOne({ _id: id, organization });

    if (!template) {
      return res.status(404).json({ message: 'Letter template not found' });
    }

    template.isActive = !template.isActive;
    template.updatedBy = updatedBy;

    await template.save();
    await template.populate(['category', 'createdBy', 'updatedBy'], 'name color icon fullName email');

    res.json(template);
  } catch (error) {
    console.error('Error toggling template status:', error);
    res.status(500).json({ message: 'Error toggling template status' });
  }
};

// Get available placeholders for a template
exports.getAvailablePlaceholders = async (req, res) => {
  try {
    const availablePlaceholders = [
      // Employee Information
      { key: 'employee.name', label: 'Employee Full Name', type: 'text', description: 'Full name of the employee' },
      { key: 'employee.firstName', label: 'Employee First Name', type: 'text', description: 'First name of the employee' },
      { key: 'employee.lastName', label: 'Employee Last Name', type: 'text', description: 'Last name of the employee' },
      { key: 'employee.email', label: 'Employee Email', type: 'text', description: 'Email address of the employee' },
      { key: 'employee.phone', label: 'Employee Phone', type: 'text', description: 'Phone number of the employee' },
      { key: 'employee.department', label: 'Employee Department', type: 'text', description: 'Department of the employee' },
      { key: 'employee.position', label: 'Employee Position', type: 'text', description: 'Job title/position of the employee' },
      { key: 'employee.employeeId', label: 'Employee ID', type: 'text', description: 'Employee ID number' },
      { key: 'employee.dateOfJoining', label: 'Date of Joining', type: 'date', description: 'Date when employee joined' },
      { key: 'employee.dateOfBirth', label: 'Date of Birth', type: 'date', description: 'Employee date of birth' },
      { key: 'employee.nationality', label: 'Nationality', type: 'text', description: 'Employee nationality' },
      { key: 'employee.passportNumber', label: 'Passport Number', type: 'text', description: 'Employee passport number' },
      
      // Organization Information
      { key: 'organization.name', label: 'Organization Name', type: 'text', description: 'Name of the organization' },
      { key: 'organization.address', label: 'Organization Address', type: 'text', description: 'Full address of the organization' },
      { key: 'organization.phone', label: 'Organization Phone', type: 'text', description: 'Organization phone number' },
      { key: 'organization.email', label: 'Organization Email', type: 'text', description: 'Organization email address' },
      { key: 'organization.website', label: 'Organization Website', type: 'text', description: 'Organization website URL' },
      
      // Salary Information (for salary certificates)
      { key: 'salary.basic', label: 'Basic Salary', type: 'currency', description: 'Basic salary amount' },
      { key: 'salary.housing', label: 'Housing Allowance', type: 'currency', description: 'Housing allowance amount' },
      { key: 'salary.transport', label: 'Transport Allowance', type: 'currency', description: 'Transport allowance amount' },
      { key: 'salary.utility', label: 'Utility Allowance', type: 'currency', description: 'Utility allowance amount' },
      { key: 'salary.bonus', label: 'Bonus', type: 'currency', description: 'Bonus amount' },
      { key: 'salary.total', label: 'Total Salary', type: 'currency', description: 'Total salary amount' },
      { key: 'salary.currency', label: 'Salary Currency', type: 'text', description: 'Currency of salary (e.g., AED, USD)' },
      
      // Date Information
      { key: 'date.current', label: 'Current Date', type: 'date', description: 'Current date' },
      { key: 'date.request', label: 'Request Date', type: 'date', description: 'Date when request was made' },
      { key: 'date.issue', label: 'Issue Date', type: 'date', description: 'Date when letter is issued' },
      
      // Request Information
      { key: 'request.number', label: 'Request Number', type: 'text', description: 'Letter request number' },
      { key: 'request.message', label: 'Request Message', type: 'text', description: 'Message from the requester' },
      { key: 'request.purpose', label: 'Request Purpose', type: 'text', description: 'Purpose of the letter request' }
    ];

    res.json(availablePlaceholders);
  } catch (error) {
    console.error('Error fetching available placeholders:', error);
    res.status(500).json({ message: 'Error fetching available placeholders' });
  }
};

