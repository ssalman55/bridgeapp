require('dotenv').config();
const mongoose = require('mongoose');
const Organization = require('./src/models/Organization');
const ExportPreset = require('./src/models/ExportPreset');
const WPSCountryProfile = require('./src/models/WPSCountryProfile');

async function fixWPSIssues() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // 1. Check if bank presets exist
    const presets = await ExportPreset.find({ country: 'Qatar' });
    console.log(`Found ${presets.length} Qatar bank presets`);
    
    if (presets.length === 0) {
      console.log('No Qatar presets found. Creating default presets...');
      
      // Find an admin user for createdBy field
      const User = require('./src/models/User');
      const adminUser = await User.findOne({ role: 'admin' });
      
      if (!adminUser) {
        console.error('No admin user found for createdBy field');
        process.exit(1);
      }

      // Create default Qatar bank presets
      const defaultPresets = [
        {
          name: 'Qatar National Bank (QNB)',
          country: 'Qatar',
          bankName: 'Qatar National Bank',
          bankCode: 'QNB',
          presetType: 'bank-specific',
          fileFormat: 'CSV',
          delimiter: '|',
          encoding: 'utf8',
          columns: [
            { name: 'employeeId', header: 'EMP_ID', dataType: 'string', mapping: 'user.employeeId', required: true, maxLength: 10 },
            { name: 'fullName', header: 'EMP_NAME', dataType: 'string', mapping: 'user.fullName', required: true, maxLength: 50 },
            { name: 'nationalId', header: 'QID', dataType: 'string', mapping: 'user.nationalId.qid', required: true, maxLength: 11 },
            { name: 'iban', header: 'IBAN', dataType: 'string', mapping: 'bankDetails.iban', required: true, maxLength: 29 },
            { name: 'netSalary', header: 'NET_SALARY', dataType: 'currency', mapping: 'payroll.netSalary', required: true, format: '0.00' }
          ],
          isActive: true,
          isDefault: true,
          description: 'Default QNB CSV format for Qatar WPS',
          createdBy: adminUser._id
        },
        {
          name: 'Commercial Bank of Qatar (CBQ)',
          country: 'Qatar',
          bankName: 'Commercial Bank of Qatar',
          bankCode: 'CBQ',
          presetType: 'bank-specific',
          fileFormat: 'CSV',
          delimiter: '|',
          encoding: 'utf8',
          columns: [
            { name: 'employeeId', header: 'EMP_ID', dataType: 'string', mapping: 'user.employeeId', required: true, maxLength: 10 },
            { name: 'fullName', header: 'EMP_NAME', dataType: 'string', mapping: 'user.fullName', required: true, maxLength: 50 },
            { name: 'nationalId', header: 'QID', dataType: 'string', mapping: 'user.nationalId.qid', required: true, maxLength: 11 },
            { name: 'iban', header: 'IBAN', dataType: 'string', mapping: 'bankDetails.iban', required: true, maxLength: 29 },
            { name: 'netSalary', header: 'NET_SALARY', dataType: 'currency', mapping: 'payroll.netSalary', required: true, format: '0.00' }
          ],
          isActive: true,
          isDefault: false,
          description: 'CBQ CSV format for Qatar WPS',
          createdBy: adminUser._id
        },
        {
          name: 'Generic Qatar Format',
          country: 'Qatar',
          bankName: 'Generic',
          bankCode: 'GEN',
          presetType: 'generic',
          fileFormat: 'CSV',
          delimiter: '|',
          encoding: 'utf8',
          columns: [
            { name: 'employeeId', header: 'EMP_ID', dataType: 'string', mapping: 'user.employeeId', required: true, maxLength: 10 },
            { name: 'fullName', header: 'EMP_NAME', dataType: 'string', mapping: 'user.fullName', required: true, maxLength: 50 },
            { name: 'nationalId', header: 'QID', dataType: 'string', mapping: 'user.nationalId.qid', required: true, maxLength: 11 },
            { name: 'iban', header: 'IBAN', dataType: 'string', mapping: 'bankDetails.iban', required: true, maxLength: 29 },
            { name: 'netSalary', header: 'NET_SALARY', dataType: 'currency', mapping: 'payroll.netSalary', required: true, format: '0.00' }
          ],
          isActive: true,
          isDefault: false,
          description: 'Generic CSV format for Qatar WPS',
          createdBy: adminUser._id
        }
      ];

      await ExportPreset.insertMany(defaultPresets);
      console.log('✅ Created default Qatar bank presets');
    }

    // 2. Enable WPS for ACS Doha organization
    const organization = await Organization.findOne({ email: 'sahmad@acsdoha.school' });
    
    if (!organization) {
      console.error('Organization with email sahmad@acsdoha.school not found');
      process.exit(1);
    }

    console.log(`Found organization: ${organization.name}`);
    
    // Check if WPS profile exists
    if (!organization.wpsProfile || !organization.wpsProfile.country) {
      console.log('Creating WPS profile for organization...');
      
      organization.wpsProfile = {
        country: 'Qatar',
        employerIdentifiers: {
          qid: organization.taxId || '12345678901' // Default QID if not set
        },
        wpsSettings: {
          enabled: true,
          requiresApproval: true,
          autoLockAfterExport: true,
          retentionDays: 90,
          encryptionRequired: false
        }
      };
    } else {
      // Enable WPS
      organization.wpsProfile.wpsSettings.enabled = true;
    }
    
    await organization.save();
    
    console.log('✅ WPS enabled successfully!');
    console.log('Organization:', organization.name);
    console.log('Country:', organization.wpsProfile.country);
    console.log('WPS Enabled:', organization.wpsProfile.wpsSettings.enabled);
    console.log('Employer QID:', organization.wpsProfile.employerIdentifiers.qid);
    
    // 3. Check WPS Country Profile
    const wpsProfile = await WPSCountryProfile.findOne({ country: 'Qatar' });
    if (!wpsProfile) {
      console.log('Creating Qatar WPS country profile...');
      
      const qatarProfile = new WPSCountryProfile({
        country: 'Qatar',
        code: 'QA',
        currency: 'QAR',
        fileFormat: 'SIF',
        recordStructure: {
          header: {
            fields: [
              { name: 'recordType', position: 1, length: 1, value: 'H' },
              { name: 'employerId', position: 2, length: 11, mapping: 'organization.wpsProfile.employerIdentifiers.qid' },
              { name: 'payPeriod', position: 13, length: 6, mapping: 'payroll.payPeriod' },
              { name: 'totalRecords', position: 19, length: 6, mapping: 'calculated.totalRecords' }
            ]
          },
          detail: {
            fields: [
              { name: 'recordType', position: 1, length: 1, value: 'D' },
              { name: 'employeeId', position: 2, length: 10, mapping: 'user.employeeId' },
              { name: 'nationalId', position: 12, length: 11, mapping: 'user.nationalId.qid' },
              { name: 'iban', position: 23, length: 29, mapping: 'bankDetails.iban' },
              { name: 'netSalary', position: 52, length: 12, mapping: 'payroll.netSalary' }
            ]
          },
          trailer: {
            fields: [
              { name: 'recordType', position: 1, length: 1, value: 'T' },
              { name: 'totalAmount', position: 2, length: 15, mapping: 'calculated.totalAmount' },
              { name: 'totalRecords', position: 17, length: 6, mapping: 'calculated.totalRecords' }
            ]
          }
        },
        fieldDefinitions: {
          employeeId: { type: 'string', required: true, maxLength: 10 },
          nationalId: { type: 'string', required: true, pattern: '^[0-9]{11}$' },
          iban: { type: 'string', required: true, pattern: '^QA[0-9]{2}[A-Z0-9]{25}$' },
          netSalary: { type: 'decimal', required: true, precision: 2, min: 0 }
        },
        validationRules: {
          nationalId: { required: true, format: 'qid', length: 11 },
          iban: { required: true, format: 'iban', country: 'QA' },
          netSalary: { required: true, min: 0, max: 999999999.99 }
        },
        createdBy: adminUser._id
      });
      
      await qatarProfile.save();
      console.log('✅ Created Qatar WPS country profile');
    } else {
      console.log('✅ Qatar WPS country profile already exists');
    }
    
    console.log('\n🎉 All WPS issues fixed!');
    console.log('You can now:');
    console.log('1. Refresh the Generate Payroll File page');
    console.log('2. Select WPS export type');
    console.log('3. Choose Qatar and a bank preset (CSV format)');
    console.log('4. Generate the file');
    
    process.exit(0);

  } catch (error) {
    console.error('Error fixing WPS issues:', error);
    process.exit(1);
  }
}

fixWPSIssues();
