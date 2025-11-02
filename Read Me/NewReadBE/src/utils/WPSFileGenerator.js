const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * WPS File Generation Engine
 * Generates compliant WPS files for different countries and formats
 */
class WPSFileGenerator {
  constructor() {
    this.generators = {
      'SIF': new SIFGenerator(),
      'CSV': new CSVGenerator(),
      'Excel': new ExcelGenerator()
    };
  }

  /**
   * Generate WPS file based on country profile and bank preset
   * @param {Array} payrollData - Array of payroll records
   * @param {Object} organization - Organization details
   * @param {Object} wpsProfile - WPS country profile
   * @param {Object} bankPreset - Bank preset (if applicable)
   * @param {Object} options - Generation options
   * @returns {Object} Generated file information
   */
  async generateFile(payrollData, organization, wpsProfile, bankPreset = null, options = {}) {
    const generator = this.generators[wpsProfile.fileFormat];
    if (!generator) {
      throw new Error(`Unsupported file format: ${wpsProfile.fileFormat}`);
    }

    const fileInfo = await generator.generate(payrollData, organization, wpsProfile, bankPreset, options);
    
    // Calculate file hash for tamper evidence
    fileInfo.sha256 = this.calculateFileHash(fileInfo.content);
    
    // Generate manifest
    fileInfo.manifest = this.generateManifest(payrollData, organization, wpsProfile, bankPreset, fileInfo, options);
    
    return fileInfo;
  }

  /**
   * Calculate SHA-256 hash of file content
   * @param {Buffer|String} content - File content
   * @returns {String} SHA-256 hash
   */
  calculateFileHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate manifest JSON
   * @param {Array} payrollData - Payroll data
   * @param {Object} organization - Organization details
   * @param {Object} wpsProfile - WPS profile
   * @param {Object} bankPreset - Bank preset
   * @param {Object} fileInfo - File information
   * @param {Object} options - Generation options
   * @returns {Object} Manifest object
   */
  generateManifest(payrollData, organization, wpsProfile, bankPreset, fileInfo, options = {}) {
    const totalAmount = payrollData.reduce((sum, record) => sum + record.payroll.netSalary, 0);
    
    return {
      orgId: organization._id.toString(),
      branchId: organization.branch || null,
      country: wpsProfile.country,
      bankPreset: bankPreset ? bankPreset.name : null,
      payrollRunId: options.runId || null,
      period: options.period || null,
      payDate: options.payDate || new Date().toISOString(),
      recordCount: payrollData.length,
      totalAmount: totalAmount,
      currency: wpsProfile.currency,
      fileSha256: fileInfo.sha256,
      fileName: fileInfo.fileName,
      fileSize: fileInfo.content.length,
      generatedBy: options.generatedBy || null,
      generatedAt: new Date().toISOString(),
      wpsProfileVersion: wpsProfile.version,
      bankPresetVersion: bankPreset ? bankPreset.version : null,
      compliance: {
        requiresChecksum: wpsProfile.compliance.requiresChecksum,
        requiresTrailerValidation: wpsProfile.compliance.requiresTrailerValidation,
        maxRecordsPerFile: wpsProfile.compliance.maxRecordsPerFile
      }
    };
  }
}

/**
 * Base Generator Class
 */
class BaseGenerator {
  constructor() {
    this.name = 'BaseGenerator';
  }

  async generate(payrollData, organization, wpsProfile, bankPreset, options) {
    throw new Error('generate method must be implemented by subclass');
  }

  /**
   * Format field value according to specification
   * @param {*} value - Value to format
   * @param {Object} fieldSpec - Field specification
   * @returns {String} Formatted value
   */
  formatField(value, fieldSpec) {
    if (value === null || value === undefined) {
      return fieldSpec.defaultValue || '';
    }

    let formattedValue = value.toString();

    switch (fieldSpec.type) {
      case 'number':
        formattedValue = this.formatNumber(value, fieldSpec);
        break;
      case 'date':
        formattedValue = this.formatDate(value, fieldSpec);
        break;
      case 'string':
      default:
        formattedValue = this.formatString(value, fieldSpec);
        break;
    }

    // Apply padding
    if (fieldSpec.length) {
      formattedValue = this.applyPadding(formattedValue, fieldSpec);
    }

    return formattedValue;
  }

  formatNumber(value, fieldSpec) {
    const num = parseFloat(value);
    if (isNaN(num)) return '0';

    if (fieldSpec.format) {
      // Handle specific number formats
      if (fieldSpec.format.includes('.')) {
        const decimals = fieldSpec.format.split('.')[1].length;
        return num.toFixed(decimals);
      }
    }

    return num.toString();
  }

  formatDate(value, fieldSpec) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';

    if (fieldSpec.format) {
      // Handle specific date formats
      return this.formatDateString(date, fieldSpec.format);
    }

    return date.toISOString().split('T')[0]; // Default to YYYY-MM-DD
  }

  formatDateString(date, format) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day);
  }

  formatString(value, fieldSpec) {
    let str = value.toString();
    
    if (fieldSpec.maxLength && str.length > fieldSpec.maxLength) {
      str = str.substring(0, fieldSpec.maxLength);
    }

    return str;
  }

  applyPadding(value, fieldSpec) {
    const targetLength = fieldSpec.length;
    const currentLength = value.length;

    if (currentLength >= targetLength) {
      return value.substring(0, targetLength);
    }

    const paddingChar = fieldSpec.paddingChar || ' ';
    const paddingLength = targetLength - currentLength;
    const padding = paddingChar.repeat(paddingLength);

    switch (fieldSpec.padding) {
      case 'left':
        return padding + value;
      case 'right':
      default:
        return value + padding;
    }
  }

  /**
   * Get field value from payroll record
   * @param {Object} record - Payroll record
   * @param {String} mapping - Field mapping path
   * @returns {*} Field value
   */
  getFieldValue(record, mapping) {
    const parts = mapping.split('.');
    let value = record;

    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return value;
  }
}

/**
 * SIF File Generator for Qatar and UAE
 */
class SIFGenerator extends BaseGenerator {
  constructor() {
    super();
    this.name = 'SIFGenerator';
  }

  async generate(payrollData, organization, wpsProfile, bankPreset, options) {
    const lines = [];
    
    // Generate header record
    const headerLine = this.generateHeaderRecord(organization, wpsProfile, payrollData.length, options);
    lines.push(headerLine);

    // Generate detail records
    for (const record of payrollData) {
      const detailLine = this.generateDetailRecord(record, wpsProfile, options);
      lines.push(detailLine);
    }

    // Generate trailer record
    const trailerLine = this.generateTrailerRecord(payrollData, wpsProfile);
    lines.push(trailerLine);

    // Join lines with appropriate line ending
    const content = lines.join(wpsProfile.generationSettings.lineEnding);
    
    return {
      fileName: this.generateFileName(organization, wpsProfile, options),
      content: Buffer.from(content, wpsProfile.generationSettings.encoding),
      mimeType: 'application/octet-stream',
      fileType: 'SIF'
    };
  }

  generateHeaderRecord(organization, wpsProfile, recordCount, options = {}) {
    const headerFields = wpsProfile.recordStructure.header.fields;
    const line = [];

    for (const field of headerFields) {
      let value = '';

      switch (field.name) {
        case 'recordType':
          value = 'H'; // Header
          break;
        case 'employerId':
          value = this.getEmployerId(organization, wpsProfile.country);
          break;
        case 'payPeriod':
          value = options.period || new Date().toISOString().substring(0, 7);
          break;
        case 'payDate':
          value = options.payDate || new Date().toISOString().substring(0, 10);
          break;
        case 'recordCount':
          value = recordCount.toString();
          break;
        case 'currency':
          value = wpsProfile.currency;
          break;
        case 'generationDate':
          value = new Date().toISOString().substring(0, 10);
          break;
        default:
          value = field.defaultValue || '';
      }

      line.push(this.formatField(value, field));
    }

    return line.join(wpsProfile.generationSettings.delimiter);
  }

  generateDetailRecord(record, wpsProfile, options = {}) {
    const detailFields = wpsProfile.recordStructure.detail.fields;
    const line = [];

    for (const field of detailFields) {
      let value = '';

      switch (field.name) {
        case 'recordType':
          value = 'D'; // Detail
          break;
        case 'employeeId':
          value = record.employee._id.toString();
          break;
        case 'employeeName':
          value = record.employee.fullName;
          break;
        case 'nationalId':
          value = this.getNationalId(record.employee, wpsProfile.country);
          break;
        case 'iban':
          value = record.bankDetails.IBAN;
          break;
        case 'netSalary':
          value = record.payroll.netSalary.toString();
          break;
        case 'grossSalary':
          value = record.payroll.grossSalary.toString();
          break;
        case 'deductions':
          value = (record.payroll.deductions || 0).toString();
          break;
        case 'bonuses':
          value = (record.payroll.bonuses || 0).toString();
          break;
        case 'reference':
          value = `PAY-${options.period || 'CURRENT'}-${record.employee._id}`;
          break;
        default:
          if (field.mapping) {
            value = this.getFieldValue(record, field.mapping);
          } else {
            value = field.defaultValue || '';
          }
      }

      line.push(this.formatField(value, field));
    }

    return line.join(wpsProfile.generationSettings.delimiter);
  }

  generateTrailerRecord(payrollData, wpsProfile) {
    const trailerFields = wpsProfile.recordStructure.trailer.fields;
    const line = [];
    const totalAmount = payrollData.reduce((sum, record) => sum + record.payroll.netSalary, 0);

    for (const field of trailerFields) {
      let value = '';

      switch (field.name) {
        case 'recordType':
          value = 'T'; // Trailer
          break;
        case 'recordCount':
          value = payrollData.length.toString();
          break;
        case 'totalAmount':
          value = totalAmount.toString();
          break;
        case 'checksum':
          value = this.calculateChecksum(payrollData, wpsProfile);
          break;
        default:
          value = field.defaultValue || '';
      }

      line.push(this.formatField(value, field));
    }

    return line.join(wpsProfile.generationSettings.delimiter);
  }

  getEmployerId(organization, country) {
    const identifiers = organization.wpsProfile.employerIdentifiers;
    
    switch (country) {
      case 'Qatar':
        return identifiers.qid || identifiers.establishmentId || '';
      case 'UAE':
        return identifiers.molId || identifiers.tradeLicense || '';
      case 'Saudi Arabia':
        return identifiers.companyId || identifiers.gosiId || '';
      case 'Kuwait':
        return identifiers.civilId || '';
      case 'Bahrain':
        return identifiers.crNumber || '';
      case 'Oman':
        return identifiers.commercialRegister || '';
      default:
        return '';
    }
  }

  getNationalId(employee, country) {
    const nationalId = employee.nationalId;
    
    switch (country) {
      case 'Qatar':
        return nationalId.qid || '';
      case 'UAE':
        return nationalId.emiratesId || '';
      case 'Saudi Arabia':
        return nationalId.iqama || '';
      case 'Kuwait':
        return nationalId.civilId || '';
      case 'Bahrain':
        return nationalId.cpr || '';
      case 'Oman':
        return nationalId.nationalId || '';
      default:
        return '';
    }
  }

  calculateChecksum(payrollData, wpsProfile) {
    // Simple checksum calculation - can be enhanced based on specific country requirements
    const totalAmount = payrollData.reduce((sum, record) => sum + record.payroll.netSalary, 0);
    const recordCount = payrollData.length;
    
    // Basic checksum: sum of all net salaries + record count
    return (totalAmount + recordCount).toString();
  }

  generateFileName(organization, wpsProfile, options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const period = options.period || new Date().toISOString().substring(0, 7);
    return `WPS_${organization.name.replace(/\s+/g, '_')}_${period}_${timestamp}.sif`;
  }
}

/**
 * CSV File Generator for Bank Presets
 */
class CSVGenerator extends BaseGenerator {
  constructor() {
    super();
    this.name = 'CSVGenerator';
  }

  async generate(payrollData, organization, wpsProfile, bankPreset, options) {
    if (!bankPreset) {
      throw new Error('Bank preset is required for CSV generation');
    }

    const lines = [];
    
    // Generate header row
    if (bankPreset.generationSettings.includeHeader) {
      const headerRow = bankPreset.columns.map(col => col.header);
      lines.push(this.formatCSVRow(headerRow, bankPreset));
    }

    // Generate data rows
    for (const record of payrollData) {
      const dataRow = bankPreset.columns.map(col => {
        const value = this.getFieldValue(record, col.mapping);
        return this.formatField(value, col);
      });
      lines.push(this.formatCSVRow(dataRow, bankPreset));
    }

    const content = lines.join('\n');
    
    return {
      fileName: this.generateFileName(organization, bankPreset, options),
      content: Buffer.from(content, bankPreset.encoding),
      mimeType: 'text/csv',
      fileType: 'CSV'
    };
  }

  formatCSVRow(values, bankPreset) {
    const delimiter = bankPreset.delimiter;
    const quoteFields = bankPreset.generationSettings.quoteFields;
    
    return values.map(value => {
      const str = value.toString();
      
      if (quoteFields || str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
        // Escape quotes by doubling them
        const escaped = str.replace(/"/g, '""');
        return `"${escaped}"`;
      }
      
      return str;
    }).join(delimiter);
  }

  generateFileName(organization, bankPreset, options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const period = options.period || new Date().toISOString().substring(0, 7);
    return `WPS_${bankPreset.bankName.replace(/\s+/g, '_')}_${organization.name.replace(/\s+/g, '_')}_${period}_${timestamp}.csv`;
  }
}

/**
 * Excel File Generator for Bank Presets
 */
class ExcelGenerator extends BaseGenerator {
  constructor() {
    super();
    this.name = 'ExcelGenerator';
  }

  async generate(payrollData, organization, wpsProfile, bankPreset, options) {
    if (!bankPreset) {
      throw new Error('Bank preset is required for Excel generation');
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Payroll Data');

    // Add header row
    if (bankPreset.generationSettings.includeHeader) {
      const headerRow = bankPreset.columns.map(col => col.header);
      worksheet.addRow(headerRow);
      
      // Style header row
      const headerRowObj = worksheet.getRow(1);
      headerRowObj.font = { bold: true };
      headerRowObj.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    }

    // Add data rows
    for (const record of payrollData) {
      const dataRow = bankPreset.columns.map(col => {
        const value = this.getFieldValue(record, col.mapping);
        return this.formatField(value, col);
      });
      worksheet.addRow(dataRow);
    }

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      column.width = Math.max(column.width || 10, 15);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    
    return {
      fileName: this.generateFileName(organization, bankPreset, options),
      content: buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileType: 'Excel'
    };
  }

  generateFileName(organization, bankPreset, options) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const period = options.period || new Date().toISOString().substring(0, 7);
    return `WPS_${bankPreset.bankName.replace(/\s+/g, '_')}_${organization.name.replace(/\s+/g, '_')}_${period}_${timestamp}.xlsx`;
  }
}

module.exports = WPSFileGenerator;
