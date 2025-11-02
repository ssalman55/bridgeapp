require('dotenv').config();
const mongoose = require('mongoose');
const ExportPreset = require('./src/models/ExportPreset');

async function checkBankPresets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    const presets = await ExportPreset.find({ country: 'Qatar' });
    console.log(`Found ${presets.length} Qatar presets:`);
    
    presets.forEach(preset => {
      console.log(`- ${preset.name} (${preset.bankName}) - Active: ${preset.isActive}`);
    });

    if (presets.length === 0) {
      console.log('No Qatar presets found. Running seed script...');
      // Run the seed script
      require('./seed-wps-data.js');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBankPresets();








