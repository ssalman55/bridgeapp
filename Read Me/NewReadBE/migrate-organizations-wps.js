require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('./src/models/Organization');

/**
 * Migration Script: Add WPS Settings to Existing Organizations
 * This script adds WPS-specific fields to existing organizations
 */
async function migrateOrganizationsForWPS() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`Found ${organizations.length} organizations to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const org of organizations) {
      try {
        // Check if WPS profile already exists
        if (org.wpsProfile && org.wpsProfile.country) {
          console.log(`⏭️  Skipping ${org.name} - already has WPS profile`);
          skippedCount++;
          continue;
        }

        // Determine country based on organization data
        let country = null;
        if (org.country) {
          const countryMap = {
            'Qatar': 'Qatar',
            'UAE': 'UAE',
            'United Arab Emirates': 'UAE',
            'Saudi Arabia': 'Saudi Arabia',
            'Kuwait': 'Kuwait',
            'Bahrain': 'Bahrain',
            'Oman': 'Oman'
          };
          country = countryMap[org.country] || null;
        }

        // If no country detected, default to Qatar (most common in the system)
        if (!country) {
          country = 'Qatar';
          console.log(`🌍 No country detected for ${org.name}, defaulting to Qatar`);
        }

        // Update organization with WPS profile
        const updateData = {
          wpsProfile: {
            country: country,
            employerIdentifiers: {
              // Set based on country
              ...(country === 'Qatar' && { qid: org.taxId || null }),
              ...(country === 'UAE' && { molId: org.taxId || null }),
              ...(country === 'Saudi Arabia' && { companyId: org.taxId || null }),
              ...(country === 'Kuwait' && { civilId: org.taxId || null }),
              ...(country === 'Bahrain' && { crNumber: org.taxId || null }),
              ...(country === 'Oman' && { commercialRegister: org.taxId || null })
            },
            wpsSettings: {
              enabled: false, // Start disabled, admin can enable
              requiresApproval: true,
              autoLockAfterExport: true,
              retentionDays: 90,
              encryptionRequired: false
            }
          }
        };

        await Organization.findByIdAndUpdate(org._id, updateData);
        console.log(`✅ Migrated ${org.name} - Country: ${country}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Failed to migrate ${org.name}:`, error.message);
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount} organizations`);
    console.log(`⏭️  Skipped (already migrated): ${skippedCount} organizations`);
    console.log(`📈 Total processed: ${migratedCount + skippedCount} organizations`);

    // Verify migration
    const migratedOrgs = await Organization.find({ 'wpsProfile.country': { $exists: true } });
    console.log(`\n🔍 Verification: ${migratedOrgs.length} organizations now have WPS profiles`);

    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateOrganizationsForWPS();
}

module.exports = migrateOrganizationsForWPS;








