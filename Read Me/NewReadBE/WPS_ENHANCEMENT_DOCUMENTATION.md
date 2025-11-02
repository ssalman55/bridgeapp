# WPS (Wage Protection System) Enhancement Documentation

## Overview

This enhancement extends the existing Generate Payroll File feature to support WPS compliance for Middle Eastern countries. The system now generates compliant WPS files with strict validation, auditability, and multi-tenant safety.

## Features Implemented

### 1. Country-Specific WPS Profiles
- **Qatar (QCB WPS)**: `.SIF` format with fixed specification
- **UAE (CBUAE WPS)**: `.SIF` format with pipe/fixed specification
- **Saudi Arabia (SAMA)**: Bank-specific CSV/Excel presets
- **Kuwait, Bahrain, Oman**: Bank CSV/Excel presets

### 2. Validation Engine
- **Identity Validation**: Country-specific national ID validation
- **Banking Validation**: IBAN checksum and format validation
- **Payroll Math**: Net salary calculation validation
- **Employment Status**: Active employee validation
- **Duplicate Detection**: IBAN and employee ID duplicate checks

### 3. File Generation
- **SIF Files**: Fixed-width format for Qatar and UAE
- **CSV Files**: Bank-specific column mapping
- **Excel Files**: Formatted spreadsheets with headers
- **Manifest Files**: JSON metadata with file information

### 4. Security & Compliance
- **Audit Trail**: Complete audit logging
- **File Encryption**: Optional password protection
- **Signed URLs**: Short-lived download links
- **Tamper Evidence**: SHA-256 file hashing
- **Multi-tenant Isolation**: Organization-level data separation

## Database Schema Changes

### New Models

#### WPSCountryProfile
```javascript
{
  country: String, // Qatar, UAE, Saudi Arabia, etc.
  countryCode: String, // QA, AE, SA, etc.
  currency: String, // QAR, AED, SAR, etc.
  fileFormat: String, // SIF, CSV, Excel
  recordStructure: {
    header: { fields: [...] },
    detail: { fields: [...] },
    trailer: { fields: [...] }
  },
  validationRules: {
    iban: { length, pattern, checksum },
    nationalId: { required, pattern, length },
    employerId: { required, pattern, length }
  },
  generationSettings: {
    delimiter, lineEnding, encoding, padding
  },
  compliance: {
    requiresChecksum, requiresTrailerValidation,
    maxRecordsPerFile, requiresEncryption
  }
}
```

#### ExportPreset
```javascript
{
  name: String,
  country: String,
  bankName: String,
  presetType: String, // bank-specific, generic, custom
  fileFormat: String, // CSV, Excel
  columns: [{
    name, header, dataType, format, mapping,
    required, maxLength, defaultValue
  }],
  validationRules: {
    requiredFields, fieldFormats, businessRules
  },
  generationSettings: {
    includeHeader, quoteFields, dateFormat,
    numberFormat, currencyFormat
  }
}
```

#### PayrollRun
```javascript
{
  runId: String, // Auto-generated unique ID
  organization: ObjectId,
  period: String, // YYYY-MM format
  payDate: Date,
  exportType: String, // spreadsheet, wps
  country: String, // For WPS exports
  bankPreset: ObjectId, // For bank-specific exports
  wpsProfile: ObjectId, // For WPS exports
  status: String, // draft, validating, generated, exported
  validation: {
    isValid, errors, warnings, summary
  },
  files: [{
    fileName, fileType, fileSize, s3Key,
    downloadUrl, expiresAt, sha256, manifest
  }],
  statistics: {
    totalAmount, recordCount, processingTimeMs,
    downloadCount, lastDownloadedAt
  }
}
```

### Enhanced Existing Models

#### Organization
```javascript
wpsProfile: {
  country: String,
  employerIdentifiers: {
    qid: String, // Qatar
    molId: String, // UAE
    companyId: String, // Saudi Arabia
    // ... other countries
  },
  defaultBankPreset: ObjectId,
  wpsSettings: {
    enabled: Boolean,
    requiresApproval: Boolean,
    autoLockAfterExport: Boolean,
    retentionDays: Number,
    encryptionRequired: Boolean
  }
}
```

#### User
```javascript
nationalId: {
  qid: String, // Qatar ID
  emiratesId: String, // UAE Emirates ID
  iqama: String, // Saudi Arabia Iqama
  civilId: String, // Kuwait Civil ID
  cpr: String, // Bahrain CPR
  nationalId: String // Oman National ID
},
employmentDetails: {
  hireDate: Date,
  terminationDate: Date,
  employmentStatus: String,
  contractType: String
}
```

#### StaffBankDetails
```javascript
wpsDetails: {
  isPrimary: Boolean,
  bankCode: String,
  branchCode: String,
  accountType: String,
  isWpsEligible: Boolean,
  lastWpsExport: Date,
  wpsExportCount: Number
}
```

## API Endpoints

### Enhanced Payroll Routes (`/api/enhanced-payroll`)

#### POST `/generate-wps-file`
Generate WPS-compliant payroll file
```javascript
{
  month: String,
  year: Number,
  organizationId: String,
  exportType: String, // 'spreadsheet' or 'wps'
  country: String, // Required for WPS
  bankPresetId: String, // Optional for WPS
  outputSettings: {
    packaging: String, // 'single' or 'zip'
    encryption: {
      enabled: Boolean,
      password: String
    },
    retentionDays: Number
  },
  justification: String // Required for duplicate exports
}
```

#### GET `/wps-countries`
Get available WPS countries
```javascript
Response: {
  success: Boolean,
  countries: [{
    name: String,
    code: String,
    currency: String,
    fileFormat: String
  }]
}
```

#### GET `/bank-presets/:country`
Get bank presets for a country
```javascript
Response: {
  success: Boolean,
  presets: [{
    id: String,
    name: String,
    bankName: String,
    presetType: String,
    fileFormat: String,
    isDefault: Boolean,
    description: String
  }]
}
```

#### GET `/run-history/:organizationId`
Get payroll run history
```javascript
Query: {
  page: Number,
  limit: Number,
  status: String,
  exportType: String
}
```

#### GET `/download/:runId`
Download payroll file
```javascript
Response: {
  success: Boolean,
  downloadUrl: String,
  fileName: String,
  fileSize: Number,
  expiresAt: Date,
  manifest: Object
}
```

## File Formats

### Qatar WPS (.SIF)
```
H|12345678901|2025-01|000001|QAR|2025-01-15|
D|507f1f77bcf86cd799439011|John Doe|12345678901|QA58DOHB00001234567890ABCDEFG|000005000.00|000006000.00|000001000.00|000000000.00|PAY-2025-01-507f1f77bcf86cd799439011|
T|000001|000005000.00|000005001.00|
```

### UAE WPS (.SIF)
```
H|1234567890|2025-01|000001|AED|2025-01-15|
D|507f1f77bcf86cd799439011|John Doe|123456789012345|AE070331234567890123456|000005000.00|000006000.00|000001000.00|000000000.00|PAY-2025-01-507f1f77bcf86cd799439011|
T|000001|000005000.00|000005001.00|
```

### Saudi Arabia Bank CSV
```csv
Employee ID,Employee Name,National ID,IBAN,Net Salary,Gross Salary,Reference
507f1f77bcf86cd799439011,John Doe,1234567890,SA0380000000608010167519,5000.00,6000.00,PAY-2025-01
```

## Validation Rules

### Qatar
- **IBAN**: 29 characters, starts with QA, mod-97 checksum
- **National ID**: 11 digits
- **Employer ID**: QID or Establishment ID required

### UAE
- **IBAN**: 23 characters, starts with AE, mod-97 checksum
- **National ID**: 15 digits (Emirates ID)
- **Employer ID**: MOL ID or Trade License required

### Saudi Arabia
- **IBAN**: 24 characters, starts with SA, mod-97 checksum
- **National ID**: 10 digits (Iqama or National ID)
- **Employer ID**: Company ID or GOSI ID required

## Security Features

### File Security
- **Encryption**: Optional AES-256 encryption
- **Signed URLs**: 15-minute expiry
- **One-time Download**: Optional single-use links
- **File Hashing**: SHA-256 for tamper detection

### Audit Trail
- **Complete Logging**: Who, when, what, where
- **File Metadata**: Size, hash, generation time
- **Download Tracking**: Count and timestamps
- **Error Logging**: Detailed validation failures

### Multi-tenant Safety
- **Organization Isolation**: Users only see their organization's data
- **Role-based Access**: Payroll.Export permission required
- **Branch Filtering**: Head office can access linked branches
- **Data Minimization**: Only necessary data in logs

## Usage Instructions

### For Administrators

1. **Enable WPS**: Go to Organization Settings → WPS Settings → Enable WPS
2. **Configure Country**: Set organization country and employer identifiers
3. **Set Default Bank Preset**: Choose default bank preset for exports
4. **Configure Settings**: Set approval requirements, retention, encryption

### For Payroll Managers

1. **Navigate**: Go to Generate Payroll File page
2. **Select Period**: Choose month and year
3. **Choose Export Type**: Select "WPS" for compliance
4. **Select Country**: Choose from available WPS countries
5. **Choose Bank Preset**: Select bank-specific format (if applicable)
6. **Configure Output**: Set packaging, encryption, retention
7. **Generate**: System validates and generates compliant file
8. **Download**: Use signed URL to download file

### For Staff

1. **Bank Details**: Ensure bank details are verified and WPS-eligible
2. **National ID**: Ensure national ID is provided and valid
3. **Employment Status**: Must be active during payroll period

## Testing

### Test Suite
Run the comprehensive test suite:
```bash
cd backend
node test-wps-suite.js
```

### Manual Testing
1. **Seed Data**: Run `node seed-wps-data.js`
2. **Migrate Organizations**: Run `node migrate-organizations-wps.js`
3. **Test Validation**: Use test IBANs and national IDs
4. **Test Generation**: Generate files for each country
5. **Test Download**: Verify signed URLs work correctly

## Deployment Checklist

### Backend
- [ ] Deploy new models and routes
- [ ] Run migration script for existing organizations
- [ ] Seed WPS country profiles and bank presets
- [ ] Configure S3 for file storage
- [ ] Set up audit logging

### Frontend
- [ ] Deploy enhanced Generate Payroll File page
- [ ] Update navigation and permissions
- [ ] Test UI components and validation
- [ ] Configure API endpoints

### Database
- [ ] Backup existing data
- [ ] Run migration scripts
- [ ] Verify indexes and constraints
- [ ] Test performance with large datasets

## Troubleshooting

### Common Issues

1. **Validation Failures**
   - Check IBAN format and checksum
   - Verify national ID format
   - Ensure employee is active

2. **File Generation Errors**
   - Check organization WPS settings
   - Verify bank preset configuration
   - Ensure sufficient S3 permissions

3. **Download Issues**
   - Check signed URL expiry
   - Verify file exists in S3
   - Check user permissions

### Support

For technical support or questions about WPS implementation:
- Check validation error messages
- Review audit logs
- Verify organization configuration
- Test with sample data

## Future Enhancements

### Planned Features
- **Additional Countries**: Bahrain, Kuwait, Oman profiles
- **Real-time Validation**: Live IBAN and ID validation
- **Bank Integration**: Direct bank API integration
- **Advanced Analytics**: WPS compliance reporting
- **Mobile Support**: Mobile-optimized interface

### Extensibility
- **Custom Presets**: Organization-specific bank formats
- **Plugin System**: Third-party validation plugins
- **API Extensions**: Custom validation rules
- **Integration Hooks**: Webhook support for external systems








