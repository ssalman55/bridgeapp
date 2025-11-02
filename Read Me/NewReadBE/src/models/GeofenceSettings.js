const mongoose = require('mongoose');

const geofenceSettingsSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    unique: true // One settings document per organization
  },
  isEnabled: {
    type: Boolean,
    default: false // Geofencing is disabled by default
  },
  allowCheckInOutside: {
    type: Boolean,
    default: false // By default, users cannot check in outside geofence
  }
}, { timestamps: true });

module.exports = mongoose.model('GeofenceSettings', geofenceSettingsSchema); 