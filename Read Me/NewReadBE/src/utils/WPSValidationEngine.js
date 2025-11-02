const crypto = require('crypto');

/**
 * WPS Validation Engine
 * Provides comprehensive validation for WPS compliance across different countries
 */
class WPSValidationEngine {
  constructor() {
    this.countryValidators = {
      'Qatar': new QatarValidator(),
      'UAE': new UAEValidator(),
      'Saudi Arabia': new SaudiArabiaValidator(),
      'Kuwait': new KuwaitValidator(),
      'Bahrain': new BahrainValidator(),
      'Oman': new OmanValidator()
    };
  }

  /**
   * Validate payroll data for WPS export
   * @param {Object} payrollData - Array of payroll records
   * @param {Object} organization - Organization details
   * @param {Object} wpsProfile - WPS country profile
   * @param {Object} bankPreset - Bank preset (if applicable)
   * @returns {Object} Validation result with errors and warnings
   */
  async validatePayrollData(payrollData, organization, wpsProfile, bankPreset = null) {
    const validator = this.countryValidators[organization.wpsProfile.country];
    if (!validator) {
      throw new Error(`No validator found for country: ${organization.wpsProfile.country}`);
    }

    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        totalRecords: payrollData.length,
        validRecords: 0,
        errorCount: 0,
        warningCount: 0
      }
    };

    // Validate each payroll record
    for (const record of payrollData) {
      const recordValidation = await validator.validateRecord(record, organization, wpsProfile, bankPreset);
      
      if (recordValidation.errors.length > 0) {
        validationResult.errors.push(...recordValidation.errors);
        validationResult.summary.errorCount += recordValidation.errors.length;
      }
      
      if (recordValidation.warnings.length > 0) {
        validationResult.warnings.push(...recordValidation.warnings);
        validationResult.summary.warningCount += recordValidation.warnings.length;
      }
      
      if (recordValidation.errors.length === 0) {
        validationResult.summary.validRecords++;
      }
    }

    // Validate file-level requirements
    const fileValidation = await validator.validateFile(payrollData, organization, wpsProfile);
    validationResult.errors.push(...fileValidation.errors);
    validationResult.warnings.push(...fileValidation.warnings);
    validationResult.summary.errorCount += fileValidation.errors.length;
    validationResult.summary.warningCount += fileValidation.warnings.length;

    // Overall validation status
    validationResult.isValid = validationResult.summary.errorCount === 0;

    return validationResult;
  }

  /**
   * Validate IBAN for specific country
   * @param {string} iban - IBAN to validate
   * @param {string} country - Country code
   * @returns {Object} Validation result
   */
  validateIBAN(iban, country) {
    const validator = this.countryValidators[country];
    if (!validator) {
      throw new Error(`No validator found for country: ${country}`);
    }
    return validator.validateIBAN(iban);
  }

  /**
   * Validate national ID for specific country
   * @param {string} nationalId - National ID to validate
   * @param {string} country - Country code
   * @returns {Object} Validation result
   */
  validateNationalId(nationalId, country) {
    const validator = this.countryValidators[country];
    if (!validator) {
      throw new Error(`No validator found for country: ${country}`);
    }
    return validator.validateNationalId(nationalId);
  }
}

/**
 * Base Validator Class
 */
class BaseValidator {
  constructor() {
    this.countryCode = '';
    this.currency = '';
    this.ibanLength = 0;
    this.nationalIdPattern = null;
  }

  async validateRecord(record, organization, wpsProfile, bankPreset) {
    const errors = [];
    const warnings = [];

    // Validate employee identity
    const identityValidation = this.validateEmployeeIdentity(record.employee, organization);
    errors.push(...identityValidation.errors);
    warnings.push(...identityValidation.warnings);

    // Validate bank details
    const bankValidation = this.validateBankDetails(record.bankDetails, organization);
    errors.push(...bankValidation.errors);
    warnings.push(...bankValidation.warnings);

    // Validate payroll amounts
    const amountValidation = this.validatePayrollAmounts(record.payroll, organization);
    errors.push(...amountValidation.errors);
    warnings.push(...amountValidation.warnings);

    // Validate employment status
    const employmentValidation = this.validateEmploymentStatus(record.employee, record.payroll);
    errors.push(...employmentValidation.errors);
    warnings.push(...employmentValidation.warnings);

    return { errors, warnings };
  }

  async validateFile(payrollData, organization, wpsProfile) {
    const errors = [];
    const warnings = [];

    // Check for duplicates
    const duplicateValidation = this.validateDuplicates(payrollData);
    errors.push(...duplicateValidation.errors);
    warnings.push(...duplicateValidation.warnings);

    // Validate totals
    const totalsValidation = this.validateTotals(payrollData, organization);
    errors.push(...totalsValidation.errors);
    warnings.push(...totalsValidation.warnings);

    // Validate file size limits
    const sizeValidation = this.validateFileSize(payrollData, wpsProfile);
    errors.push(...sizeValidation.errors);
    warnings.push(...sizeValidation.warnings);

    return { errors, warnings };
  }

  validateEmployeeIdentity(employee, organization) {
    const errors = [];
    const warnings = [];

    // Check if national ID is provided
    const nationalId = this.getNationalId(employee, organization.wpsProfile.country);
    if (!nationalId) {
      errors.push({
        type: 'error',
        category: 'identity',
        message: `${this.countryCode} National ID is required`,
        employeeId: employee._id,
        field: 'nationalId',
        suggestedFix: 'Add national ID to employee profile'
      });
    } else {
      const idValidation = this.validateNationalId(nationalId);
      if (!idValidation.isValid) {
        errors.push({
          type: 'error',
          category: 'identity',
          message: `Invalid ${this.countryCode} National ID format`,
          employeeId: employee._id,
          field: 'nationalId',
          suggestedFix: idValidation.suggestedFix
        });
      }
    }

    return { errors, warnings };
  }

  validateBankDetails(bankDetails, organization) {
    const errors = [];
    const warnings = [];

    if (!bankDetails) {
      errors.push({
        type: 'error',
        category: 'banking',
        message: 'Bank details are required',
        field: 'bankDetails',
        suggestedFix: 'Add bank account details for employee'
      });
      return { errors, warnings };
    }

    // Validate IBAN
    const ibanValidation = this.validateIBAN(bankDetails.IBAN);
    if (!ibanValidation.isValid) {
      errors.push({
        type: 'error',
        category: 'banking',
        message: `Invalid IBAN format for ${this.countryCode}`,
        field: 'IBAN',
        suggestedFix: ibanValidation.suggestedFix
      });
    }

    // Check if bank is WPS eligible
    if (bankDetails.wpsDetails && !bankDetails.wpsDetails.isWpsEligible) {
      warnings.push({
        type: 'warning',
        category: 'banking',
        message: 'Bank account is not WPS eligible',
        field: 'wpsEligible',
        suggestedFix: 'Verify bank account eligibility with bank'
      });
    }

    return { errors, warnings };
  }

  validatePayrollAmounts(payroll, organization) {
    const errors = [];
    const warnings = [];

    // Validate net salary calculation
    // Net salary = Gross salary - Deductions (bonuses are already included in gross salary)
    const calculatedNet = payroll.grossSalary - (payroll.deductions || 0);
    const tolerance = 0.01;
    
    if (Math.abs(calculatedNet - payroll.netSalary) > tolerance) {
      errors.push({
        type: 'error',
        category: 'payroll',
        message: 'Net salary calculation mismatch',
        field: 'netSalary',
        suggestedFix: `Expected: ${calculatedNet.toFixed(2)}, Found: ${payroll.netSalary.toFixed(2)}`
      });
    }

    // Validate minimum amount
    if (payroll.netSalary < 0.01) {
      errors.push({
        type: 'error',
        category: 'payroll',
        message: 'Net salary must be greater than 0',
        field: 'netSalary',
        suggestedFix: 'Check salary calculation and deductions'
      });
    }

    return { errors, warnings };
  }

  validateEmploymentStatus(employee, payroll) {
    const errors = [];
    const warnings = [];

    // Check if employee is active during payroll period
    if (employee.employmentDetails && employee.employmentDetails.employmentStatus !== 'active') {
      warnings.push({
        type: 'warning',
        category: 'employment',
        message: 'Employee is not in active status',
        field: 'employmentStatus',
        suggestedFix: 'Verify employment status for payroll period'
      });
    }

    return { errors, warnings };
  }

  validateDuplicates(payrollData) {
    const errors = [];
    const warnings = [];

    // Check for duplicate IBANs
    const ibanCounts = {};
    payrollData.forEach(record => {
      if (record.bankDetails && record.bankDetails.IBAN) {
        ibanCounts[record.bankDetails.IBAN] = (ibanCounts[record.bankDetails.IBAN] || 0) + 1;
      }
    });

    Object.entries(ibanCounts).forEach(([iban, count]) => {
      if (count > 1) {
        warnings.push({
          type: 'warning',
          category: 'duplicates',
          message: `IBAN ${iban} appears ${count} times`,
          field: 'IBAN',
          suggestedFix: 'Verify if shared accounts are allowed'
        });
      }
    });

    return { errors, warnings };
  }

  validateTotals(payrollData, organization) {
    const errors = [];
    const warnings = [];

    const totalAmount = payrollData.reduce((sum, record) => sum + record.payroll.netSalary, 0);
    const recordCount = payrollData.length;

    // Validate reasonable totals
    if (totalAmount <= 0) {
      errors.push({
        type: 'error',
        category: 'totals',
        message: 'Total payroll amount must be greater than 0',
        field: 'totalAmount',
        suggestedFix: 'Check payroll data and calculations'
      });
    }

    if (recordCount === 0) {
      errors.push({
        type: 'error',
        category: 'totals',
        message: 'No payroll records found',
        field: 'recordCount',
        suggestedFix: 'Add payroll records for the period'
      });
    }

    return { errors, warnings };
  }

  validateFileSize(payrollData, wpsProfile) {
    const errors = [];
    const warnings = [];

    if (wpsProfile.compliance.maxRecordsPerFile && payrollData.length > wpsProfile.compliance.maxRecordsPerFile) {
      errors.push({
        type: 'error',
        category: 'file-size',
        message: `File exceeds maximum record limit of ${wpsProfile.compliance.maxRecordsPerFile}`,
        field: 'recordCount',
        suggestedFix: 'Split payroll into multiple files'
      });
    }

    return { errors, warnings };
  }

  getNationalId(employee, country) {
    const nationalIdMap = {
      'Qatar': employee.nationalId?.qid,
      'UAE': employee.nationalId?.emiratesId,
      'Saudi Arabia': employee.nationalId?.iqama,
      'Kuwait': employee.nationalId?.civilId,
      'Bahrain': employee.nationalId?.cpr,
      'Oman': employee.nationalId?.nationalId
    };
    return nationalIdMap[country];
  }

  validateIBAN(iban) {
    if (!iban) {
      return { isValid: false, suggestedFix: 'IBAN is required' };
    }

    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    
    if (cleanIban.length !== this.ibanLength) {
      return { 
        isValid: false, 
        suggestedFix: `${this.countryCode} IBAN must be ${this.ibanLength} characters long` 
      };
    }

    if (!cleanIban.startsWith(this.countryCode)) {
      return { 
        isValid: false, 
        suggestedFix: `${this.countryCode} IBAN must start with ${this.countryCode}` 
      };
    }

    // Mod-97 checksum validation
    if (!this.validateMod97Checksum(cleanIban)) {
      return { 
        isValid: false, 
        suggestedFix: 'Invalid IBAN checksum' 
      };
    }

    return { isValid: true };
  }

  validateNationalId(nationalId) {
    if (!nationalId) {
      return { isValid: false, suggestedFix: 'National ID is required' };
    }

    if (this.nationalIdPattern && !this.nationalIdPattern.test(nationalId)) {
      return { 
        isValid: false, 
        suggestedFix: 'Invalid national ID format' 
      };
    }

    return { isValid: true };
  }

  validateMod97Checksum(iban) {
    // Move first 4 characters to end
    const rearranged = iban.slice(4) + iban.slice(0, 4);
    
    // Replace letters with numbers (A=10, B=11, etc.)
    const numeric = rearranged.replace(/[A-Z]/g, (char) => char.charCodeAt(0) - 55);
    
    // Calculate mod 97
    const remainder = BigInt(numeric) % 97n;
    return remainder === 1n;
  }
}

/**
 * Qatar Validator
 */
class QatarValidator extends BaseValidator {
  constructor() {
    super();
    this.countryCode = 'QA';
    this.currency = 'QAR';
    this.ibanLength = 29; // QA + 2 check digits + 4 bank + 21 account
    this.nationalIdPattern = /^[0-9]{11}$/; // 11-digit QID
  }
}

/**
 * UAE Validator
 */
class UAEValidator extends BaseValidator {
  constructor() {
    super();
    this.countryCode = 'AE';
    this.currency = 'AED';
    this.ibanLength = 23; // AE + 2 check digits + 3 bank + 16 account
    this.nationalIdPattern = /^[0-9]{15}$/; // 15-digit Emirates ID
  }
}

/**
 * Saudi Arabia Validator
 */
class SaudiArabiaValidator extends BaseValidator {
  constructor() {
    super();
    this.countryCode = 'SA';
    this.currency = 'SAR';
    this.ibanLength = 24; // SA + 2 check digits + 2 bank + 18 account
    this.nationalIdPattern = /^[0-9]{10}$/; // 10-digit National ID or Iqama
  }
}

/**
 * Kuwait Validator
 */
class KuwaitValidator extends BaseValidator {
  constructor() {
    super();
    this.countryCode = 'KW';
    this.currency = 'KWD';
    this.ibanLength = 30; // KW + 2 check digits + 4 bank + 22 account
    this.nationalIdPattern = /^[0-9]{12}$/; // 12-digit Civil ID
  }
}

/**
 * Bahrain Validator
 */
class BahrainValidator extends BaseValidator {
  constructor() {
    super();
    this.countryCode = 'BH';
    this.currency = 'BHD';
    this.ibanLength = 22; // BH + 2 check digits + 4 bank + 14 account
    this.nationalIdPattern = /^[0-9]{9}$/; // 9-digit CPR
  }
}

/**
 * Oman Validator
 */
class OmanValidator extends BaseValidator {
  constructor() {
    super();
    this.countryCode = 'OM';
    this.currency = 'OMR';
    this.ibanLength = 23; // OM + 2 check digits + 3 bank + 16 account
    this.nationalIdPattern = /^[0-9]{8}$/; // 8-digit National ID
  }
}

module.exports = WPSValidationEngine;
