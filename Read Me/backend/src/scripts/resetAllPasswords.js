const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Path relative to this script

// === CONFIGURE THESE ===
const MONGODB_URI = 'mongodb://localhost:27017/your-db'; // <-- Replace with your connection string
const organizationId = '68248ad64661b180f8b5aa78'; // <-- Replace with your organization ID
const newPassword = 'Default123!';
// =======================

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  const hashed = await bcrypt.hash(newPassword, 10);

  const result = await User.updateMany(
    { organization: organizationId },
    { password: hashed }
  );

  console.log(`Password reset for ${result.nModified || result.modifiedCount} users in organization ${organizationId}.`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 