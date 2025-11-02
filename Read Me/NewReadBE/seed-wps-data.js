require('dotenv').config();
const mongoose = require('mongoose');
const WPSCountryProfile = require('./src/models/WPSCountryProfile');
const ExportPreset = require('./src/models/ExportPreset');

/**
 * Seed WPS Country Profiles and Bank Presets
 * This script creates the initial data for WPS compliance
 */
async function seedWPSData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge');
    console.log('Connected to MongoDB');

    // Get or create a system user for seeding
    const User = require('./src/models/User');
    let systemUser = await User.findOne({ email: 'admin@sb.com' });
    if (!systemUser) {
      // If no admin user exists, find any admin user
      systemUser = await User.findOne({ role: 'admin' });
    }
    if (!systemUser) {
      console.error('No admin user found. Please create an admin user first.');
      process.exit(1);
    }
    console.log(`Using user ${systemUser.email} as creator for seed data`);

    // Clear existing data
    await WPSCountryProfile.deleteMany({});
    await ExportPreset.deleteMany({});
    console.log('Cleared existing WPS data');

    // Create WPS Country Profiles
    const countryProfiles = [
      {
        country: 'Qatar',
        countryCode: 'QA',
        currency: 'QAR',
        fileFormat: 'SIF',
        fileExtension: '.sif',
        recordStructure: {
          header: {
            required: true,
            fields: [
              { name: 'recordType', length: 1, type: 'string', required: true, description: 'Header record identifier' },
              { name: 'employerId', length: 20, type: 'string', required: true, description: 'Employer QID or Establishment ID' },
              { name: 'payPeriod', length: 7, type: 'string', format: 'YYYY-MM', required: true, description: 'Pay period' },
              { name: 'payDate', length: 10, type: 'date', format: 'YYYY-MM-DD', required: true, description: 'Pay date' },
              { name: 'recordCount', length: 6, type: 'number', format: '000000', required: true, description: 'Number of detail records' },
              { name: 'currency', length: 3, type: 'string', required: true, description: 'Currency code' },
              { name: 'generationDate', length: 10, type: 'date', format: 'YYYY-MM-DD', required: true, description: 'File generation date' }
            ]
          },
          detail: {
            required: true,
            fields: [
              { name: 'recordType', length: 1, type: 'string', required: true, description: 'Detail record identifier' },
              { name: 'employeeId', length: 24, type: 'string', required: true, description: 'Employee ID', mapping: 'employee._id' },
              { name: 'employeeName', length: 100, type: 'string', required: true, description: 'Employee full name', mapping: 'employee.fullName' },
              { name: 'nationalId', length: 11, type: 'string', required: true, description: 'Qatar ID', mapping: 'employee.nationalId.qid' },
              { name: 'iban', length: 29, type: 'string', required: true, description: 'IBAN', mapping: 'bankDetails.IBAN' },
              { name: 'netSalary', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Net salary', mapping: 'payroll.netSalary' },
              { name: 'grossSalary', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Gross salary', mapping: 'payroll.grossSalary' },
              { name: 'deductions', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Total deductions', mapping: 'payroll.deductions' },
              { name: 'bonuses', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Total bonuses', mapping: 'payroll.bonuses' },
              { name: 'reference', length: 50, type: 'string', required: true, description: 'Payment reference' }
            ]
          },
          trailer: {
            required: true,
            fields: [
              { name: 'recordType', length: 1, type: 'string', required: true, description: 'Trailer record identifier' },
              { name: 'recordCount', length: 6, type: 'number', format: '000000', required: true, description: 'Number of detail records', calculation: 'count' },
              { name: 'totalAmount', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Total amount', calculation: 'sum' },
              { name: 'checksum', length: 10, type: 'string', required: true, description: 'File checksum' }
            ]
          }
        },
        validationRules: {
          iban: { length: 29, pattern: '^QA[0-9]{2}[A-Z0-9]{4}[0-9]{21}$', checksum: 'mod97' },
          nationalId: { required: true, pattern: '^[0-9]{11}$', length: 11 },
          employerId: { required: true, pattern: '^[0-9]{11}$', length: 11 },
          amountValidation: { precision: 2, maxAmount: 999999999.99, minAmount: 0.01 }
        },
        generationSettings: {
          delimiter: '|',
          lineEnding: '\n',
          encoding: 'utf8',
          padding: 'right',
          paddingChar: ' '
        },
        compliance: {
          requiresChecksum: true,
          requiresTrailerValidation: true,
          maxRecordsPerFile: 10000,
          requiresEncryption: false
        },
        description: 'Qatar Central Bank WPS specification for salary payments'
      },
      {
        country: 'UAE',
        countryCode: 'AE',
        currency: 'AED',
        fileFormat: 'SIF',
        fileExtension: '.sif',
        recordStructure: {
          header: {
            required: true,
            fields: [
              { name: 'recordType', length: 1, type: 'string', required: true, description: 'Header record identifier' },
              { name: 'employerId', length: 20, type: 'string', required: true, description: 'MOL ID or Trade License' },
              { name: 'payPeriod', length: 7, type: 'string', format: 'YYYY-MM', required: true, description: 'Pay period' },
              { name: 'payDate', length: 10, type: 'date', format: 'YYYY-MM-DD', required: true, description: 'Pay date' },
              { name: 'recordCount', length: 6, type: 'number', format: '000000', required: true, description: 'Number of detail records' },
              { name: 'currency', length: 3, type: 'string', required: true, description: 'Currency code' },
              { name: 'generationDate', length: 10, type: 'date', format: 'YYYY-MM-DD', required: true, description: 'File generation date' }
            ]
          },
          detail: {
            required: true,
            fields: [
              { name: 'recordType', length: 1, type: 'string', required: true, description: 'Detail record identifier' },
              { name: 'employeeId', length: 24, type: 'string', required: true, description: 'Employee ID', mapping: 'employee._id' },
              { name: 'employeeName', length: 100, type: 'string', required: true, description: 'Employee full name', mapping: 'employee.fullName' },
              { name: 'nationalId', length: 15, type: 'string', required: true, description: 'Emirates ID', mapping: 'employee.nationalId.emiratesId' },
              { name: 'iban', length: 23, type: 'string', required: true, description: 'IBAN', mapping: 'bankDetails.IBAN' },
              { name: 'netSalary', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Net salary', mapping: 'payroll.netSalary' },
              { name: 'grossSalary', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Gross salary', mapping: 'payroll.grossSalary' },
              { name: 'deductions', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Total deductions', mapping: 'payroll.deductions' },
              { name: 'bonuses', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Total bonuses', mapping: 'payroll.bonuses' },
              { name: 'reference', length: 50, type: 'string', required: true, description: 'Payment reference' }
            ]
          },
          trailer: {
            required: true,
            fields: [
              { name: 'recordType', length: 1, type: 'string', required: true, description: 'Trailer record identifier' },
              { name: 'recordCount', length: 6, type: 'number', format: '000000', required: true, description: 'Number of detail records', calculation: 'count' },
              { name: 'totalAmount', length: 12, type: 'number', format: '000000000.00', required: true, description: 'Total amount', calculation: 'sum' },
              { name: 'checksum', length: 10, type: 'string', required: true, description: 'File checksum' }
            ]
          }
        },
        validationRules: {
          iban: { length: 23, pattern: '^AE[0-9]{2}[A-Z0-9]{3}[0-9]{16}$', checksum: 'mod97' },
          nationalId: { required: true, pattern: '^[0-9]{15}$', length: 15 },
          employerId: { required: true, pattern: '^[0-9]{10}$', length: 10 },
          amountValidation: { precision: 2, maxAmount: 999999999.99, minAmount: 0.01 }
        },
        generationSettings: {
          delimiter: '|',
          lineEnding: '\n',
          encoding: 'utf8',
          padding: 'right',
          paddingChar: ' '
        },
        compliance: {
          requiresChecksum: true,
          requiresTrailerValidation: true,
          maxRecordsPerFile: 10000,
          requiresEncryption: false
        },
        description: 'Central Bank of UAE WPS specification for salary payments'
      },
      {
        country: 'Saudi Arabia',
        countryCode: 'SA',
        currency: 'SAR',
        fileFormat: 'CSV',
        fileExtension: '.csv',
        recordStructure: {
          header: { required: false },
          detail: { required: true },
          trailer: { required: false }
        },
        validationRules: {
          iban: { length: 24, pattern: '^SA[0-9]{2}[A-Z0-9]{2}[0-9]{18}$', checksum: 'mod97' },
          nationalId: { required: true, pattern: '^[0-9]{10}$', length: 10 },
          employerId: { required: true, pattern: '^[0-9]{10}$', length: 10 },
          amountValidation: { precision: 2, maxAmount: 999999999.99, minAmount: 0.01 }
        },
        generationSettings: {
          delimiter: ',',
          lineEnding: '\n',
          encoding: 'utf8',
          padding: 'none',
          paddingChar: ' '
        },
        compliance: {
          requiresChecksum: false,
          requiresTrailerValidation: false,
          maxRecordsPerFile: 50000,
          requiresEncryption: false
        },
        description: 'SAMA WPS specification for salary payments (bank-specific CSV formats)'
      }
    ];

    for (const profile of countryProfiles) {
      await WPSCountryProfile.create(profile);
      console.log(`Created WPS profile for ${profile.country}`);
    }

    // Create Bank Presets for Saudi Arabia
    const bankPresets = [
      {
        name: 'KSA - Generic WPS CSV',
        country: 'Saudi Arabia',
        bankName: 'Generic',
        bankCode: 'GENERIC',
        presetType: 'generic',
        fileFormat: 'CSV',
        delimiter: ',',
        encoding: 'utf8',
        createdBy: systemUser._id,
        columns: [
          { name: 'employeeId', header: 'Employee ID', dataType: 'string', mapping: 'employee._id', required: true },
          { name: 'employeeName', header: 'Employee Name', dataType: 'string', mapping: 'employee.fullName', required: true },
          { name: 'nationalId', header: 'National ID', dataType: 'string', mapping: 'employee.nationalId.iqama', required: true },
          { name: 'iban', header: 'IBAN', dataType: 'string', mapping: 'bankDetails.IBAN', required: true },
          { name: 'netSalary', header: 'Net Salary', dataType: 'currency', format: '0.00', mapping: 'payroll.netSalary', required: true },
          { name: 'grossSalary', header: 'Gross Salary', dataType: 'currency', format: '0.00', mapping: 'payroll.grossSalary', required: true },
          { name: 'deductions', header: 'Deductions', dataType: 'currency', format: '0.00', mapping: 'payroll.deductions', required: false },
          { name: 'bonuses', header: 'Bonuses', dataType: 'currency', format: '0.00', mapping: 'payroll.bonuses', required: false },
          { name: 'reference', header: 'Reference', dataType: 'string', mapping: 'payroll.payPeriod', required: true }
        ],
        validationRules: {
          requiredFields: ['employeeId', 'employeeName', 'nationalId', 'iban', 'netSalary'],
          fieldFormats: [
            { field: 'nationalId', pattern: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
            { field: 'iban', pattern: '^SA[0-9]{2}[A-Z0-9]{2}[0-9]{18}$', minLength: 24, maxLength: 24 }
          ],
          businessRules: [
            { name: 'netSalaryPositive', condition: 'netSalary > 0', message: 'Net salary must be greater than 0' },
            { name: 'ibanFormat', condition: 'iban.startsWith("SA")', message: 'IBAN must start with SA for Saudi Arabia' }
          ]
        },
        generationSettings: {
          includeHeader: true,
          quoteFields: true,
          dateFormat: 'YYYY-MM-DD',
          numberFormat: '0.00',
          currencyFormat: '0.00'
        },
        isActive: true,
        isDefault: true,
        description: 'Generic WPS CSV format for Saudi Arabia banks'
      },
      {
        name: 'Al Rajhi Bank WPS',
        country: 'Saudi Arabia',
        bankName: 'Al Rajhi Bank',
        bankCode: 'ALRAJHI',
        presetType: 'bank-specific',
        fileFormat: 'CSV',
        delimiter: ',',
        encoding: 'utf8',
        createdBy: systemUser._id,
        columns: [
          { name: 'employeeId', header: 'Employee ID', dataType: 'string', mapping: 'employee._id', required: true },
          { name: 'employeeName', header: 'Employee Name', dataType: 'string', mapping: 'employee.fullName', required: true },
          { name: 'nationalId', header: 'National ID', dataType: 'string', mapping: 'employee.nationalId.iqama', required: true },
          { name: 'iban', header: 'IBAN', dataType: 'string', mapping: 'bankDetails.IBAN', required: true },
          { name: 'netSalary', header: 'Amount', dataType: 'currency', format: '0.00', mapping: 'payroll.netSalary', required: true },
          { name: 'reference', header: 'Reference', dataType: 'string', mapping: 'payroll.payPeriod', required: true }
        ],
        validationRules: {
          requiredFields: ['employeeId', 'employeeName', 'nationalId', 'iban', 'netSalary'],
          fieldFormats: [
            { field: 'nationalId', pattern: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
            { field: 'iban', pattern: '^SA[0-9]{2}[A-Z0-9]{2}[0-9]{18}$', minLength: 24, maxLength: 24 }
          ],
          businessRules: [
            { name: 'netSalaryPositive', condition: 'netSalary > 0', message: 'Amount must be greater than 0' }
          ]
        },
        generationSettings: {
          includeHeader: true,
          quoteFields: true,
          dateFormat: 'YYYY-MM-DD',
          numberFormat: '0.00',
          currencyFormat: '0.00'
        },
        isActive: true,
        isDefault: false,
        description: 'Al Rajhi Bank specific WPS format'
      },
      {
        name: 'Riyad Bank WPS',
        country: 'Saudi Arabia',
        bankName: 'Riyad Bank',
        bankCode: 'RIYAD',
        presetType: 'bank-specific',
        fileFormat: 'Excel',
        delimiter: ',',
        encoding: 'utf8',
        createdBy: systemUser._id,
        columns: [
          { name: 'employeeId', header: 'Employee ID', dataType: 'string', mapping: 'employee._id', required: true },
          { name: 'employeeName', header: 'Employee Name', dataType: 'string', mapping: 'employee.fullName', required: true },
          { name: 'nationalId', header: 'National ID', dataType: 'string', mapping: 'employee.nationalId.iqama', required: true },
          { name: 'iban', header: 'IBAN', dataType: 'string', mapping: 'bankDetails.IBAN', required: true },
          { name: 'netSalary', header: 'Net Salary', dataType: 'currency', format: '0.00', mapping: 'payroll.netSalary', required: true },
          { name: 'grossSalary', header: 'Gross Salary', dataType: 'currency', format: '0.00', mapping: 'payroll.grossSalary', required: true },
          { name: 'reference', header: 'Reference', dataType: 'string', mapping: 'payroll.payPeriod', required: true }
        ],
        validationRules: {
          requiredFields: ['employeeId', 'employeeName', 'nationalId', 'iban', 'netSalary'],
          fieldFormats: [
            { field: 'nationalId', pattern: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
            { field: 'iban', pattern: '^SA[0-9]{2}[A-Z0-9]{2}[0-9]{18}$', minLength: 24, maxLength: 24 }
          ],
          businessRules: [
            { name: 'netSalaryPositive', condition: 'netSalary > 0', message: 'Net salary must be greater than 0' }
          ]
        },
        generationSettings: {
          includeHeader: true,
          quoteFields: true,
          dateFormat: 'YYYY-MM-DD',
          numberFormat: '0.00',
          currencyFormat: '0.00'
        },
        isActive: true,
        isDefault: false,
        description: 'Riyad Bank specific WPS format'
      },
      {
        name: 'SABB WPS',
        country: 'Saudi Arabia',
        bankName: 'Saudi British Bank',
        bankCode: 'SABB',
        presetType: 'bank-specific',
        fileFormat: 'CSV',
        delimiter: ',',
        encoding: 'utf8',
        createdBy: systemUser._id,
        columns: [
          { name: 'employeeId', header: 'Employee ID', dataType: 'string', mapping: 'employee._id', required: true },
          { name: 'employeeName', header: 'Employee Name', dataType: 'string', mapping: 'employee.fullName', required: true },
          { name: 'nationalId', header: 'National ID', dataType: 'string', mapping: 'employee.nationalId.iqama', required: true },
          { name: 'iban', header: 'IBAN', dataType: 'string', mapping: 'bankDetails.IBAN', required: true },
          { name: 'netSalary', header: 'Amount', dataType: 'currency', format: '0.00', mapping: 'payroll.netSalary', required: true },
          { name: 'reference', header: 'Reference', dataType: 'string', mapping: 'payroll.payPeriod', required: true }
        ],
        validationRules: {
          requiredFields: ['employeeId', 'employeeName', 'nationalId', 'iban', 'netSalary'],
          fieldFormats: [
            { field: 'nationalId', pattern: '^[0-9]{10}$', minLength: 10, maxLength: 10 },
            { field: 'iban', pattern: '^SA[0-9]{2}[A-Z0-9]{2}[0-9]{18}$', minLength: 24, maxLength: 24 }
          ],
          businessRules: [
            { name: 'netSalaryPositive', condition: 'netSalary > 0', message: 'Amount must be greater than 0' }
          ]
        },
        generationSettings: {
          includeHeader: true,
          quoteFields: true,
          dateFormat: 'YYYY-MM-DD',
          numberFormat: '0.00',
          currencyFormat: '0.00'
        },
        isActive: true,
        isDefault: false,
        description: 'Saudi British Bank specific WPS format'
      }
    ];

    for (const preset of bankPresets) {
      await ExportPreset.create(preset);
      console.log(`Created bank preset: ${preset.name}`);
    }

    console.log('WPS data seeding completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding WPS data:', error);
    process.exit(1);
  }
}

// Run the seeding function
seedWPSData();
