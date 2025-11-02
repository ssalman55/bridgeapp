const Geofence = require('../models/Geofence');

// Create a geofence
exports.createGeofence = async (req, res) => {
  try {
    const { name, latitude, longitude, radius } = req.body;
    if (!name || latitude == null || longitude == null || radius == null) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const geofence = await Geofence.create({
      name,
      latitude,
      longitude,
      radius,
      organization: req.user.organization
    });
    res.status(201).json(geofence);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create geofence', error: err.message });
  }
};

// Get all geofences for the admin's organization
exports.getGeofences = async (req, res) => {
  try {
    const geofences = await Geofence.find({ organization: req.user.organization });
    res.json(geofences);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch geofences', error: err.message });
  }
};

// Update a geofence
exports.updateGeofence = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, latitude, longitude, radius } = req.body;
    const geofence = await Geofence.findOneAndUpdate(
      { _id: id, organization: req.user.organization },
      { name, latitude, longitude, radius },
      { new: true }
    );
    if (!geofence) return res.status(404).json({ message: 'Geofence not found' });
    res.json(geofence);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update geofence', error: err.message });
  }
};

// Delete a geofence
exports.deleteGeofence = async (req, res) => {
  try {
    const { id } = req.params;
    const geofence = await Geofence.findOneAndDelete({ _id: id, organization: req.user.organization });
    if (!geofence) return res.status(404).json({ message: 'Geofence not found' });
    res.json({ message: 'Geofence deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete geofence', error: err.message });
  }
}; 