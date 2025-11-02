require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('./src/models/Organization');

/**
 * Enable WPS for a specific organization
 * Usage: node enable-wps-for-org.js [organizationEmail]
 */
async function enableWPS() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Get organization email from command line argument or use default
    const orgEmail = process.argv[2] || 'sahmad@acsdoha.school';
    
    const organization = await Organization.findOne({ email: orgEmail });
    
    if (!organization) {
      console.error(`Organization with email ${orgEmail} not found`);
      console.log('Usage: node enable-wps-for-org.js [organizationEmail]');
      process.exit(1);
    }

    console.log(`Found organization: ${organization.name}`);
    
    // Check if WPS profile exists
    if (!organization.wpsProfile || !organization.wpsProfile.country) {
      console.log('Organization does not have WPS profile. Running migration first...');
      
      // Determine country based on organization data
      let country = organization.country;
      const countryMap = {
        'Qatar': 'Qatar',
        'UAE': 'UAE',
        'United Arab Emirates': 'UAE',
        'Saudi Arabia': 'Saudi Arabia',
        'Kuwait': 'Kuwait',
        'Bahrain': 'Bahrain',
        'Oman': 'Oman'
      };
      country = countryMap[country] || 'Qatar';
      
      organization.wpsProfile = {
        country: country,
        employerIdentifiers: {
          ...(country === 'Qatar' && { qid: organization.taxId || null }),
          ...(country === 'UAE' && { molId: organization.taxId || null }),
          ...(country === 'Saudi Arabia' && { companyId: organization.taxId || null }),
          ...(country === 'Kuwait' && { civilId: organization.taxId || null }),
          ...(country === 'Bahrain' && { crNumber: organization.taxId || null }),
          ...(country === 'Oman' && { commercialRegister: organization.taxId || null })
        },
        wpsSettings: {
          enabled: false,
          requiresApproval: true,
          autoLockAfterExport: true,
          retentionDays: 90,
          encryptionRequired: false
        }
      };
    }
    
    // Enable WPS
    organization.wpsProfile.wpsSettings.enabled = true;
    
    await organization.save();
    
    console.log('✅ WPS enabled successfully!');
    console.log('Organization:', organization.name);
    console.log('Country:', organization.wpsProfile.country);
    console.log('WPS Enabled:', organization.wpsProfile.wpsSettings.enabled);
    console.log('Employer ID:', 
      organization.wpsProfile.employerIdentifiers.qid || 
      organization.wpsProfile.employerIdentifiers.molId || 
      organization.wpsProfile.employerIdentifiers.companyId || 
      'Not set'
    );
    
    process.exit(0);

  } catch (error) {
    console.error('Error enabling WPS:', error);
    process.exit(1);
  }
}

enableWPS();









