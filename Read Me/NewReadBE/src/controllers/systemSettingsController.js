const SystemSettings = require('../models/SystemSettings');

// GET /api/settings
exports.getSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ organization: req.user.organization });
    if (!settings) {
      settings = new SystemSettings({
        organization: req.user.organization,
        organizationName: req.user.organization?.name || 'Default Org',
        // Add other sensible defaults if needed
      });
      await settings.save();
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/settings (admin only)
exports.updateSettings = async (req, res) => {
  try {
    let settings = await SystemSettings.findOne({ organization: req.user.organization });
    if (!settings) {
      settings = new SystemSettings({ ...req.body, organization: req.user.organization });
    } else {
      Object.assign(settings, req.body);
      settings.updatedAt = new Date();
    }
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}; 