const mongoose = require('mongoose');
const User = require('../src/models/User');
const Payroll = require('../src/models/Payroll');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yourdb';
const payPeriod = process.argv[2];

if (!payPeriod) {
  console.error('Usage: node find-missing-payroll.js <payPeriod>');
  process.exit(1);
}

(async () => {
  await mongoose.connect(MONGO_URI);
  const staff = await User.find({ role: 'staff', status: { $ne: 'archived' } });
  const payrolls = await Payroll.find({ payPeriod });
  const staffIdsWithPayroll = new Set(payrolls.map(p => p.staff.toString()));
  const missing = staff.filter(s => !staffIdsWithPayroll.has(s._id.toString()));
  if (missing.length === 0) {
    console.log('No missing staff. All have payrolls for', payPeriod);
  } else {
    console.log('Missing staff for', payPeriod + ':');
    missing.forEach(s => console.log(`- ${s.fullName} (${s._id})`));
  }
  process.exit();
})(); 