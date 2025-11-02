const LetterCategory = require('../models/LetterCategory');
const LetterTemplate = require('../models/LetterTemplate');

// Get all letter categories for an organization
exports.getLetterCategories = async (req, res) => {
  try {
    const { includeInactive = false } = req.query;
    const organization = req.user.organization;

    const query = { organization };
    if (!includeInactive) {
      query.isActive = true;
    }

    const categories = await LetterCategory.find(query)
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email')
      .sort({ name: 1 });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching letter categories:', error);
    res.status(500).json({ message: 'Error fetching letter categories' });
  }
};

// Get a single letter category by ID
exports.getLetterCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;

    const category = await LetterCategory.findOne({ _id: id, organization })
      .populate('createdBy', 'fullName email')
      .populate('updatedBy', 'fullName email');

    if (!category) {
      return res.status(404).json({ message: 'Letter category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error fetching letter category:', error);
    res.status(500).json({ message: 'Error fetching letter category' });
  }
};

// Create a new letter category
exports.createLetterCategory = async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;
    const organization = req.user.organization;
    const createdBy = req.user._id;

    // Check if category with same name already exists
    const existingCategory = await LetterCategory.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') }, 
      organization 
    });

    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }

    const category = new LetterCategory({
      name,
      description,
      organization,
      createdBy,
      color: color || '#1C4E80',
      icon: icon || 'FiFileText'
    });

    await category.save();
    await category.populate('createdBy', 'fullName email');

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating letter category:', error);
    res.status(500).json({ message: 'Error creating letter category' });
  }
};

// Update a letter category
exports.updateLetterCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, isActive } = req.body;
    const organization = req.user.organization;
    const updatedBy = req.user._id;

    const category = await LetterCategory.findOne({ _id: id, organization });

    if (!category) {
      return res.status(404).json({ message: 'Letter category not found' });
    }

    // Check if new name conflicts with existing category (excluding current one)
    if (name && name !== category.name) {
      const existingCategory = await LetterCategory.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') }, 
        organization,
        _id: { $ne: id }
      });

      if (existingCategory) {
        return res.status(400).json({ message: 'Category with this name already exists' });
      }
    }

    // Update fields
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (color !== undefined) category.color = color;
    if (icon !== undefined) category.icon = icon;
    if (isActive !== undefined) category.isActive = isActive;
    category.updatedBy = updatedBy;

    await category.save();
    await category.populate(['createdBy', 'updatedBy'], 'fullName email');

    res.json(category);
  } catch (error) {
    console.error('Error updating letter category:', error);
    res.status(500).json({ message: 'Error updating letter category' });
  }
};

// Delete a letter category
exports.deleteLetterCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;

    const category = await LetterCategory.findOne({ _id: id, organization });

    if (!category) {
      return res.status(404).json({ message: 'Letter category not found' });
    }

    // Check if category has associated templates
    const templateCount = await LetterTemplate.countDocuments({ category: id, organization });
    if (templateCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category. It has ${templateCount} associated template(s). Please move or delete the templates first.` 
      });
    }

    await LetterCategory.findByIdAndDelete(id);
    res.json({ message: 'Letter category deleted successfully' });
  } catch (error) {
    console.error('Error deleting letter category:', error);
    res.status(500).json({ message: 'Error deleting letter category' });
  }
};

// Toggle category active status
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const organization = req.user.organization;
    const updatedBy = req.user._id;

    const category = await LetterCategory.findOne({ _id: id, organization });

    if (!category) {
      return res.status(404).json({ message: 'Letter category not found' });
    }

    category.isActive = !category.isActive;
    category.updatedBy = updatedBy;

    await category.save();
    await category.populate(['createdBy', 'updatedBy'], 'fullName email');

    res.json(category);
  } catch (error) {
    console.error('Error toggling category status:', error);
    res.status(500).json({ message: 'Error toggling category status' });
  }
};










