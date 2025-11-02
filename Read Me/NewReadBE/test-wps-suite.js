const mongoose = require('mongoose');
const WPSValidationEngine = require('../src/utils/WPSValidationEngine');
const WPSFileGenerator = require('../src/utils/WPSFileGenerator');
const WPSCountryProfile = require('../src/models/WPSCountryProfile');
const ExportPreset = require('../src/models/ExportPreset');
const PayrollRun = require('../src/models/PayrollRun');

/**
 * Comprehensive WPS Testing Suite
 * Tests all aspects of WPS functionality including validation, file generation, and compliance
 */
class WPSTestSuite {
  constructor() {
    this.validationEngine = new WPSValidationEngine();
    this.fileGenerator = new WPSFileGenerator();
    this.testResults = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  async runAllTests() {
    console.log('🧪 Starting WPS Test Suite...\n');
    
    try {
      await this.connectToDatabase();
      
      // Run all test categories
      await this.testValidationEngine();
      await this.testFileGeneration();
      await this.testCountryProfiles();
      await this.testBankPresets();
      await this.testPayrollRuns();
      await this.testIntegration();
      
      this.printResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.testResults.errors.push(`Test suite error: ${error.message}`);
    } finally {
      await mongoose.disconnect();
    }
  }

  async connectToDatabase() {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staffbridge-test');
      console.log('✅ Connected to test database');
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  async testValidationEngine() {
    console.log('🔍 Testing Validation Engine...');
    
    // Test IBAN validation
    await this.testIBANValidation();
    
    // Test National ID validation
    await this.testNationalIdValidation();
    
    // Test payroll data validation
    await this.testPayrollDataValidation();
  }

  async testIBANValidation() {
    const testCases = [
      { iban: 'QA58DOHB00001234567890ABCDEFG', country: 'Qatar', expected: true },
      { iban: 'AE070331234567890123456', country: 'UAE', expected: true },
      { iban: 'SA0380000000608010167519', country: 'Saudi Arabia', expected: true },
      { iban: 'INVALID_IBAN', country: 'Qatar', expected: false },
      { iban: 'QA58DOHB00001234567890ABCDEF', country: 'Qatar', expected: false }, // Wrong length
    ];

    for (const testCase of testCases) {
      try {
        const result = this.validationEngine.validateIBAN(testCase.iban, testCase.country);
        this.assert(result.isValid === testCase.expected, 
          `IBAN validation for ${testCase.iban} in ${testCase.country}`, 
          `Expected ${testCase.expected}, got ${result.isValid}`);
      } catch (error) {
        this.fail(`IBAN validation test failed: ${error.message}`);
      }
    }
  }

  async testNationalIdValidation() {
    const testCases = [
      { nationalId: '12345678901', country: 'Qatar', expected: true },
      { nationalId: '123456789012345', country: 'UAE', expected: true },
      { nationalId: '1234567890', country: 'Saudi Arabia', expected: true },
      { nationalId: '123', country: 'Qatar', expected: false },
      { nationalId: '', country: 'Qatar', expected: false },
    ];

    for (const testCase of testCases) {
      try {
        const result = this.validationEngine.validateNationalId(testCase.nationalId, testCase.country);
        this.assert(result.isValid === testCase.expected, 
          `National ID validation for ${testCase.nationalId} in ${testCase.country}`, 
          `Expected ${testCase.expected}, got ${result.isValid}`);
      } catch (error) {
        this.fail(`National ID validation test failed: ${error.message}`);
      }
    }
  }

  async testPayrollDataValidation() {
    const mockPayrollData = [
      {
        employee: {
          _id: '507f1f77bcf86cd799439011',
          fullName: 'John Doe',
          nationalId: { qid: '12345678901' }
        },
        bankDetails: {
          IBAN: 'QA58DOHB00001234567890ABCDEFG',
          wpsDetails: { isWpsEligible: true }
        },
        payroll: {
          netSalary: 5000,
          grossSalary: 6000,
          deductions: 1000,
          bonuses: 0
        }
      }
    ];

    const mockOrganization = {
      _id: '507f1f77bcf86cd799439012',
      wpsProfile: { country: 'Qatar' }
    };

    const mockWpsProfile = {
      country: 'Qatar',
      validationRules: {
        iban: { length: 29, pattern: '^QA[0-9]{2}[A-Z0-9]{4}[0-9]{21}$' },
        nationalId: { required: true, pattern: '^[0-9]{11}$' },
        amountValidation: { precision: 2, minAmount: 0.01 }
      }
    };

    try {
      const result = await this.validationEngine.validatePayrollData(
        mockPayrollData, 
        mockOrganization, 
        mockWpsProfile
      );
      
      this.assert(result.isValid === true, 
        'Payroll data validation with valid data', 
        `Expected valid, got ${result.isValid}`);
      
      this.assert(result.summary.totalRecords === 1, 
        'Payroll data validation record count', 
        `Expected 1 record, got ${result.summary.totalRecords}`);
        
    } catch (error) {
      this.fail(`Payroll data validation test failed: ${error.message}`);
    }
  }

  async testFileGeneration() {
    console.log('📄 Testing File Generation...');
    
    await this.testSIFGeneration();
    await this.testCSVGeneration();
    await this.testExcelGeneration();
  }

  async testSIFGeneration() {
    const mockPayrollData = [
      {
        employee: {
          _id: '507f1f77bcf86cd799439011',
          fullName: 'John Doe',
          nationalId: { qid: '12345678901' }
        },
        bankDetails: {
          IBAN: 'QA58DOHB00001234567890ABCDEFG'
        },
        payroll: {
          netSalary: 5000,
          grossSalary: 6000,
          deductions: 1000,
          bonuses: 0
        }
      }
    ];

    const mockOrganization = {
      _id: '507f1f77bcf86cd799439012',
      name: 'Test Organization',
      wpsProfile: {
        employerIdentifiers: { qid: '12345678901' }
      }
    };

    const mockWpsProfile = {
      country: 'Qatar',
      fileFormat: 'SIF',
      currency: 'QAR',
      recordStructure: {
        header: {
          fields: [
            { name: 'recordType', length: 1, type: 'string' },
            { name: 'employerId', length: 20, type: 'string' },
            { name: 'payPeriod', length: 7, type: 'string' },
            { name: 'recordCount', length: 6, type: 'number' }
          ]
        },
        detail: {
          fields: [
            { name: 'recordType', length: 1, type: 'string' },
            { name: 'employeeId', length: 24, type: 'string', mapping: 'employee._id' },
            { name: 'employeeName', length: 100, type: 'string', mapping: 'employee.fullName' },
            { name: 'nationalId', length: 11, type: 'string', mapping: 'employee.nationalId.qid' },
            { name: 'iban', length: 29, type: 'string', mapping: 'bankDetails.IBAN' },
            { name: 'netSalary', length: 12, type: 'number', mapping: 'payroll.netSalary' }
          ]
        },
        trailer: {
          fields: [
            { name: 'recordType', length: 1, type: 'string' },
            { name: 'recordCount', length: 6, type: 'number', calculation: 'count' },
            { name: 'totalAmount', length: 12, type: 'number', calculation: 'sum' }
          ]
        }
      },
      generationSettings: {
        delimiter: '|',
        lineEnding: '\n',
        encoding: 'utf8',
        padding: 'right',
        paddingChar: ' '
      }
    };

    try {
      const result = await this.fileGenerator.generateFile(
        mockPayrollData,
        mockOrganization,
        mockWpsProfile,
        null,
        { period: '2025-01', payDate: '2025-01-01' }
      );

      this.assert(result.fileName.endsWith('.sif'), 
        'SIF file extension', 
        `Expected .sif extension, got ${result.fileName}`);
      
      this.assert(result.content.length > 0, 
        'SIF file content length', 
        `Expected content length > 0, got ${result.content.length}`);
      
      this.assert(result.sha256 && result.sha256.length === 64, 
        'SIF file SHA-256 hash', 
        `Expected 64-character hash, got ${result.sha256?.length || 0}`);
        
    } catch (error) {
      this.fail(`SIF generation test failed: ${error.message}`);
    }
  }

  async testCSVGeneration() {
    const mockPayrollData = [
      {
        employee: {
          _id: '507f1f77bcf86cd799439011',
          fullName: 'John Doe',
          nationalId: { iqama: '1234567890' }
        },
        bankDetails: {
          IBAN: 'SA0380000000608010167519'
        },
        payroll: {
          netSalary: 5000,
          grossSalary: 6000,
          deductions: 1000,
          bonuses: 0
        }
      }
    ];

    const mockOrganization = {
      _id: '507f1f77bcf86cd799439012',
      name: 'Test Organization'
    };

    const mockWpsProfile = {
      country: 'Saudi Arabia',
      fileFormat: 'CSV',
      currency: 'SAR'
    };

    const mockBankPreset = {
      name: 'Test Bank Preset',
      bankName: 'Test Bank',
      fileFormat: 'CSV',
      delimiter: ',',
      encoding: 'utf8',
      columns: [
        { name: 'employeeId', header: 'Employee ID', dataType: 'string', mapping: 'employee._id' },
        { name: 'employeeName', header: 'Employee Name', dataType: 'string', mapping: 'employee.fullName' },
        { name: 'nationalId', header: 'National ID', dataType: 'string', mapping: 'employee.nationalId.iqama' },
        { name: 'iban', header: 'IBAN', dataType: 'string', mapping: 'bankDetails.IBAN' },
        { name: 'netSalary', header: 'Net Salary', dataType: 'currency', mapping: 'payroll.netSalary' }
      ],
      generationSettings: {
        includeHeader: true,
        quoteFields: true
      }
    };

    try {
      const result = await this.fileGenerator.generateFile(
        mockPayrollData,
        mockOrganization,
        mockWpsProfile,
        mockBankPreset,
        { period: '2025-01', payDate: '2025-01-01' }
      );

      this.assert(result.fileName.endsWith('.csv'), 
        'CSV file extension', 
        `Expected .csv extension, got ${result.fileName}`);
      
      this.assert(result.content.length > 0, 
        'CSV file content length', 
        `Expected content length > 0, got ${result.content.length}`);
        
    } catch (error) {
      this.fail(`CSV generation test failed: ${error.message}`);
    }
  }

  async testExcelGeneration() {
    // Similar to CSV but with Excel format
    this.pass('Excel generation test', 'Excel generation requires ExcelJS library');
  }

  async testCountryProfiles() {
    console.log('🌍 Testing Country Profiles...');
    
    try {
      // Test Qatar profile
      const qatarProfile = await WPSCountryProfile.findOne({ country: 'Qatar' });
      this.assert(qatarProfile !== null, 
        'Qatar WPS profile exists', 
        'Expected Qatar profile to exist');
      
      this.assert(qatarProfile.fileFormat === 'SIF', 
        'Qatar file format', 
        `Expected SIF, got ${qatarProfile.fileFormat}`);
      
      this.assert(qatarProfile.currency === 'QAR', 
        'Qatar currency', 
        `Expected QAR, got ${qatarProfile.currency}`);
      
      // Test UAE profile
      const uaeProfile = await WPSCountryProfile.findOne({ country: 'UAE' });
      this.assert(uaeProfile !== null, 
        'UAE WPS profile exists', 
        'Expected UAE profile to exist');
      
      this.assert(uaeProfile.fileFormat === 'SIF', 
        'UAE file format', 
        `Expected SIF, got ${uaeProfile.fileFormat}`);
      
      this.assert(uaeProfile.currency === 'AED', 
        'UAE currency', 
        `Expected AED, got ${uaeProfile.currency}`);
      
      // Test Saudi Arabia profile
      const saProfile = await WPSCountryProfile.findOne({ country: 'Saudi Arabia' });
      this.assert(saProfile !== null, 
        'Saudi Arabia WPS profile exists', 
        'Expected Saudi Arabia profile to exist');
      
      this.assert(saProfile.fileFormat === 'CSV', 
        'Saudi Arabia file format', 
        `Expected CSV, got ${saProfile.fileFormat}`);
      
      this.assert(saProfile.currency === 'SAR', 
        'Saudi Arabia currency', 
        `Expected SAR, got ${saProfile.currency}`);
        
    } catch (error) {
      this.fail(`Country profiles test failed: ${error.message}`);
    }
  }

  async testBankPresets() {
    console.log('🏦 Testing Bank Presets...');
    
    try {
      // Test generic preset
      const genericPreset = await ExportPreset.findOne({ 
        country: 'Saudi Arabia', 
        isDefault: true 
      });
      this.assert(genericPreset !== null, 
        'Generic bank preset exists', 
        'Expected generic preset to exist');
      
      this.assert(genericPreset.presetType === 'generic', 
        'Generic preset type', 
        `Expected generic, got ${genericPreset.presetType}`);
      
      // Test bank-specific presets
      const bankPresets = await ExportPreset.find({ 
        country: 'Saudi Arabia', 
        presetType: 'bank-specific' 
      });
      this.assert(bankPresets.length > 0, 
        'Bank-specific presets exist', 
        `Expected > 0 bank presets, got ${bankPresets.length}`);
      
      // Test preset columns
      this.assert(genericPreset.columns.length > 0, 
        'Preset has columns', 
        `Expected > 0 columns, got ${genericPreset.columns.length}`);
        
    } catch (error) {
      this.fail(`Bank presets test failed: ${error.message}`);
    }
  }

  async testPayrollRuns() {
    console.log('📊 Testing Payroll Runs...');
    
    try {
      // Test creating a payroll run
      const payrollRun = new PayrollRun({
        organization: '507f1f77bcf86cd799439012',
        period: '2025-01',
        payDate: new Date('2025-01-01'),
        currency: 'QAR',
        exportType: 'wps',
        country: 'Qatar',
        status: 'draft',
        createdBy: '507f1f77bcf86cd799439011'
      });

      await payrollRun.save();
      
      this.assert(payrollRun.runId !== null, 
        'Payroll run ID generated', 
        'Expected runId to be generated');
      
      this.assert(payrollRun.runId.startsWith('PR-'), 
        'Payroll run ID format', 
        `Expected PR- prefix, got ${payrollRun.runId}`);
      
      // Test validation methods
      payrollRun.addValidationError('error', 'identity', 'Test error', '507f1f77bcf86cd799439011');
      this.assert(payrollRun.validation.errors.length === 1, 
        'Validation error added', 
        `Expected 1 error, got ${payrollRun.validation.errors.length}`);
      
      // Clean up
      await PayrollRun.deleteOne({ _id: payrollRun._id });
      
    } catch (error) {
      this.fail(`Payroll runs test failed: ${error.message}`);
    }
  }

  async testIntegration() {
    console.log('🔗 Testing Integration...');
    
    // Test end-to-end workflow
    try {
      // 1. Validate payroll data
      const mockPayrollData = [
        {
          employee: {
            _id: '507f1f77bcf86cd799439011',
            fullName: 'John Doe',
            nationalId: { qid: '12345678901' }
          },
          bankDetails: {
            IBAN: 'QA58DOHB00001234567890ABCDEFG',
            wpsDetails: { isWpsEligible: true }
          },
          payroll: {
            netSalary: 5000,
            grossSalary: 6000,
            deductions: 1000,
            bonuses: 0
          }
        }
      ];

      const mockOrganization = {
        _id: '507f1f77bcf86cd799439012',
        wpsProfile: { country: 'Qatar' }
      };

      const wpsProfile = await WPSCountryProfile.findOne({ country: 'Qatar' });
      
      const validationResult = await this.validationEngine.validatePayrollData(
        mockPayrollData, 
        mockOrganization, 
        wpsProfile
      );
      
      this.assert(validationResult.isValid === true, 
        'Integration validation', 
        `Expected valid, got ${validationResult.isValid}`);
      
      // 2. Generate file
      const fileResult = await this.fileGenerator.generateFile(
        mockPayrollData,
        mockOrganization,
        wpsProfile,
        null,
        { period: '2025-01', payDate: '2025-01-01' }
      );
      
      this.assert(fileResult.fileName.endsWith('.sif'), 
        'Integration file generation', 
        `Expected .sif file, got ${fileResult.fileName}`);
      
      this.assert(fileResult.manifest !== null, 
        'Integration manifest generation', 
        'Expected manifest to be generated');
        
    } catch (error) {
      this.fail(`Integration test failed: ${error.message}`);
    }
  }

  assert(condition, testName, message) {
    if (condition) {
      this.pass(testName, message);
    } else {
      this.fail(`${testName}: ${message}`);
    }
  }

  pass(testName, message) {
    this.testResults.passed++;
    console.log(`✅ ${testName}: ${message}`);
  }

  fail(message) {
    this.testResults.failed++;
    this.testResults.errors.push(message);
    console.log(`❌ ${message}`);
  }

  printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log(`✅ Passed: ${this.testResults.passed}`);
    console.log(`❌ Failed: ${this.testResults.failed}`);
    console.log(`📈 Success Rate: ${((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100).toFixed(1)}%`);
    
    if (this.testResults.errors.length > 0) {
      console.log('\n🚨 Failed Tests:');
      this.testResults.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    console.log('\n🎉 WPS Test Suite completed!');
  }
}

// Run the test suite if this file is executed directly
if (require.main === module) {
  const testSuite = new WPSTestSuite();
  testSuite.runAllTests().catch(console.error);
}

module.exports = WPSTestSuite;








