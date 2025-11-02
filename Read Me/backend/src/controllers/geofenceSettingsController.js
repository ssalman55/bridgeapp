const GeofenceSettings = require('../models/GeofenceSettings');

// Get geofence settings for the organization
exports.getSettings = async (req, res) => {
  try {
    let settings = await GeofenceSettings.findOne({ organization: req.user.organization });
    
    // If no settings exist, create default settings
    if (!settings) {
      settings = await GeofenceSettings.create({
        organization: req.user.organization,
        isEnabled: false
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
    const { isEnabled } = req.body;
    
    if (typeof isEnabled !== 'boolean') {
      return res.status(400).json({ message: 'isEnabled must be a boolean value' });
    }

    const settings = await GeofenceSettings.findOneAndUpdate(
      { organization: req.user.organization },
      { isEnabled },
      { new: true, upsert: true } // Create if doesn't exist
    );
    
    res.json(settings);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update geofence settings', error: err.message });
  }
}; 