const GeofenceSettings = require('../models/GeofenceSettings');

// Get geofence settings for the organization
exports.getSettings = async (req, res) => {
  try {
    let settings = await GeofenceSettings.findOne({ organization: req.user.organization });
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await GeofenceSettings.create({
        organization: req.user.organization,
        isEnabled: false,
        allowCheckInOutside: false
      });
    }
    
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch geofence settings', error: err.message });
  }
};

// Update geofence settings
exports.updateSettings = async (req, res) => {
  try {
    const { isEnabled, allowCheckInOutside } = req.body;
    const update = {};
    if (typeof isEnabled === 'boolean') update.isEnabled = isEnabled;
    if (typeof allowCheckInOutside === 'boolean') update.allowCheckInOutside = allowCheckInOutside;
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    const settings = await GeofenceSettings.findOneAndUpdate(
      { organization: req.user.organization },
      update,
      { new: true, upsert: true }
    );
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update geofence settings', error: err.message });
  }
}; 