const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  permissions: {
    type: Map,
    of: {
      type: Map,
      of: String // 'none', 'view', 'full' for each page
    },
    default: {}
  }
}, { timestamps: true });

module.exports = mongoose.model('Role', RoleSchema); 