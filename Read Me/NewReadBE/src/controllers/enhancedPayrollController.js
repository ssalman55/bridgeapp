const WPSValidationEngine = require('../utils/WPSValidationEngine');
const WPSFileGenerator = require('../utils/WPSFileGenerator');
const WPSCountryProfile = require('../models/WPSCountryProfile');
const ExportPreset = require('../models/ExportPreset');
const PayrollRun = require('../models/PayrollRun');
const Payroll = require('../models/Payroll');
const StaffBankDetails = require('../models/StaffBankDetails');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { uploadFile, getSignedUrl } = require('../utils/s3');

/**
 * Enhanced Payroll Controller with WPS Support
 * Extends existing payroll functionality with WPS compliance features
 */
class EnhancedPayrollController {
  constructor() {
    this.validationEngine = new WPSValidationEngine();
    this.fileGenerator = new WPSFileGenerator();
  }

  /**
   * Generate WPS-compliant payroll file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generateWPSFile(req, res) {
    try {
      const { 
        month, 
        year, 
        organizationId, 
        exportType, 
        country, 
        bankPresetId, 
        outputSettings = {},
        justification = null 
      } = req.body;

      // Validate required parameters
      if (!month || !year || !organizationId || !exportType) {
        return res.status(400).json({ 
          error: 'Month, year, organization ID, and export type are required' 
        });
      }

      if (exportType === 'wps' && !country) {
        return res.status(400).json({ 
          error: 'Country is required for WPS export' 
        });
      }

      const payPeriod = `${year}-${month.padStart(2, '0')}`;
      const payDate = new Date(year, month - 1, 1); // First day of the month

      // Get organization details
      const organization = await Organization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      // Check if WPS is enabled for this organization
      if (exportType === 'wps' && !organization.wpsProfile?.wpsSettings?.enabled) {
        return res.status(403).json({ 
          error: 'WPS export is not enabled for this organization' 
        });
      }

      // Get WPS profile and bank preset
      let wpsProfile = null;
      let bankPreset = null;

      if (exportType === 'wps') {
        wpsProfile = await WPSCountryProfile.findOne({ 
          country, 
          isActive: true 
        });
        if (!wpsProfile) {
          return res.status(404).json({ 
            error: `WPS profile not found for country: ${country}` 
          });
        }

        if (bankPresetId) {
          bankPreset = await ExportPreset.findById(bankPresetId);
          if (!bankPreset) {
            return res.status(404).json({ 
              error: 'Bank preset not found' 
            });
          }
        } else if (wpsProfile.fileFormat !== 'SIF') {
          // For non-SIF formats, get default bank preset
          bankPreset = await ExportPreset.findOne({ 
            country, 
            isDefault: true, 
            isActive: true 
          });
          if (!bankPreset) {
            return res.status(404).json({ 
              error: `No default bank preset found for ${country}` 
            });
          }
        }
      }

      // Allow unlimited WPS file generation - no duplicate restrictions
      // WPS files can be regenerated as many times as needed

      // Create new payroll run
      const payrollRun = new PayrollRun({
        runId: `PR-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`.toUpperCase(),
        organization: organizationId,
        period: payPeriod,
        payDate,
        currency: organization.wpsProfile?.country ? 
          (organization.wpsProfile.country === 'Qatar' ? 'QAR' : 
           organization.wpsProfile.country === 'UAE' ? 'AED' :
           organization.wpsProfile.country === 'Saudi Arabia' ? 'SAR' :
           organization.wpsProfile.country === 'Kuwait' ? 'KWD' :
           organization.wpsProfile.country === 'Bahrain' ? 'BHD' :
           organization.wpsProfile.country === 'Oman' ? 'OMR' : 'QAR') : 'QAR',
        exportType,
        country: exportType === 'wps' ? country : null,
        bankPreset: bankPreset ? bankPreset._id : null,
        wpsProfile: wpsProfile ? wpsProfile._id : null,
        outputSettings: {
          packaging: outputSettings.packaging || 'single',
          encryption: outputSettings.encryption || { enabled: false },
          retentionDays: outputSettings.retentionDays || 90
        },
        status: 'draft',
        createdBy: req.user._id
      });

      await payrollRun.save();

      // Get payroll data
      const payrollData = await this.getPayrollData(organizationId, payPeriod);
      if (payrollData.length === 0) {
        return res.status(404).json({ 
          error: 'No payroll data found for the specified period' 
        });
      }

      // Validate payroll data
      payrollRun.status = 'validating';
      await payrollRun.save();

      const validationResult = await this.validationEngine.validatePayrollData(
        payrollData, 
        organization, 
        wpsProfile, 
        bankPreset
      );

      // Update validation results
      payrollRun.validation = {
        isValid: validationResult.isValid,
        errors: validationResult.errors,
        summary: validationResult.summary,
        validatedAt: new Date(),
        validatedBy: req.user._id
      };

      if (!validationResult.isValid) {
        payrollRun.status = 'failed';
        await payrollRun.save();

        return res.status(400).json({
          success: false,
          message: 'Payroll validation failed',
          validationErrors: validationResult.errors,
          warnings: validationResult.warnings,
          summary: validationResult.summary,
          runId: payrollRun.runId
        });
      }

      // Generate file
      payrollRun.status = 'generating';
      await payrollRun.save();

      const fileInfo = await this.fileGenerator.generateFile(
        payrollData,
        organization,
        wpsProfile,
        bankPreset,
        {
          runId: payrollRun.runId,
          period: payPeriod,
          payDate: payDate.toISOString(),
          generatedBy: req.user._id
        }
      );

      // Upload file to S3
      const s3Key = `wps-files/${fileInfo.fileName}`;
      console.log(`[WPS] Uploading file to S3: ${s3Key}`);
      
      try {
        await uploadFile({ 
          buffer: fileInfo.content, 
          mimetype: fileInfo.mimeType, 
          originalname: fileInfo.fileName 
        }, s3Key);
        console.log(`[WPS] File uploaded successfully to S3: ${s3Key}`);
      } catch (uploadError) {
        console.error(`[WPS] S3 upload failed:`, uploadError);
        payrollRun.status = 'failed';
        await payrollRun.save();
        
        return res.status(500).json({
          success: false,
          message: 'Failed to upload file to storage',
          error: uploadError.message,
          runId: payrollRun.runId
        });
      }

      // Generate signed download URL (15 minutes expiry)
      const downloadUrl = getSignedUrl(s3Key, 900);
      console.log(`[WPS] Generated download URL: ${downloadUrl}`);

      // Update payroll run with file information
      payrollRun.files.push({
        fileName: fileInfo.fileName,
        fileType: fileInfo.fileType,
        fileSize: fileInfo.content.length,
        mimeType: fileInfo.mimeType,
        s3Key,
        downloadUrl,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        sha256: fileInfo.sha256,
        manifest: fileInfo.manifest
      });

      payrollRun.statistics = {
        totalAmount: validationResult.summary.totalRecords > 0 ? 
          payrollData.reduce((sum, record) => sum + record.payroll.netSalary, 0) : 0,
        recordCount: validationResult.summary.totalRecords,
        processingTimeMs: Date.now() - payrollRun.createdAt.getTime()
      };

      payrollRun.status = 'generated';
      await payrollRun.save();

      // Log audit entry
      await this.logAuditEntry(req.user._id, organizationId, 'wps_file_generated', {
        runId: payrollRun.runId,
        fileName: fileInfo.fileName,
        recordCount: validationResult.summary.totalRecords,
        totalAmount: payrollRun.statistics.totalAmount,
        country,
        bankPreset: bankPreset ? bankPreset.name : null
      });

      res.json({
        success: true,
        message: 'WPS file generated successfully',
        runId: payrollRun.runId,
        fileName: fileInfo.fileName,
        downloadUrl,
        recordCount: validationResult.summary.totalRecords,
        totalAmount: payrollRun.statistics.totalAmount,
        warnings: validationResult.warnings,
        manifest: fileInfo.manifest,
        expiresAt: payrollRun.files[0].expiresAt
      });

    } catch (error) {
      console.error('Error generating WPS file:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get payroll data for export
   * @param {String} organizationId - Organization ID
   * @param {String} payPeriod - Pay period (YYYY-MM)
   * @returns {Array} Payroll data array
   */
  async getPayrollData(organizationId, payPeriod) {
    // Get all approved payrolls for the period
    const payrolls = await Payroll.find({
      organization: organizationId,
      payPeriod,
      paymentStatus: 'Paid'
    }).populate({
      path: 'staff',
      select: 'fullName _id nationalId employmentDetails'
    });

    console.log(`[WPS] Found ${payrolls.length} payroll records for period ${payPeriod}`);

    if (payrolls.length === 0) {
      return [];
    }

    // Get bank details for all staff (filter out null staff first)
    const staffIds = payrolls
      .filter(p => p.staff && p.staff._id)
      .map(p => p.staff._id);
    
    console.log(`[WPS] Found ${staffIds.length} valid staff IDs from payroll records`);
    
    if (staffIds.length === 0) {
      throw new Error('No valid staff data found in payroll records');
    }
    
    // First, get all bank details (without WPS filter) to see what's available
    const allBankDetails = await StaffBankDetails.find({
      staff_id: { $in: staffIds },
      organization_id: organizationId,
      status: 'active'
    });
    
    console.log(`[WPS] Found ${allBankDetails.length} active bank details for staff`);
    
    const bankDetails = await StaffBankDetails.find({
      staff_id: { $in: staffIds },
      organization_id: organizationId,
      status: 'active',
      'wpsDetails.isWpsEligible': true
    });
    
    console.log(`[WPS] Found ${bankDetails.length} WPS-eligible bank details`);
    
    if (bankDetails.length === 0 && allBankDetails.length > 0) {
      throw new Error(`Found ${allBankDetails.length} bank account(s), but none are marked as WPS-eligible. Please ensure staff bank details have wpsDetails.isWpsEligible set to true.`);
    }

    // Filter payrolls with valid bank details and non-null staff
    const payrollData = payrolls
      .filter(p => p.staff && p.staff._id && bankDetails.find(bd => bd.staff_id.toString() === p.staff._id.toString()))
      .map(payroll => {
        const bankDetail = bankDetails.find(bd => 
          bd.staff_id.toString() === payroll.staff._id.toString()
        );

        return {
          employee: payroll.staff,
          bankDetails: bankDetail,
          payroll: {
            netSalary: payroll.netSalary,
            grossSalary: payroll.grossSalary,
            deductions: payroll.deductions || 0,
            bonuses: payroll.bonuses || 0,
            payPeriod: payroll.payPeriod
          }
        };
      });

    return payrollData;
  }

  /**
   * Get available countries for WPS export
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getWPSCountries(req, res) {
    try {
      const countries = await WPSCountryProfile.find({ isActive: true })
        .select('country countryCode currency fileFormat')
        .sort({ country: 1 });

      res.json({
        success: true,
        countries: countries.map(country => ({
          name: country.country,
          code: country.countryCode,
          currency: country.currency,
          fileFormat: country.fileFormat
        }))
      });
    } catch (error) {
      console.error('Error getting WPS countries:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get bank presets for a country
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getBankPresets(req, res) {
    try {
      const { country } = req.params;
      const { organizationId } = req.query;

      const query = { 
        country, 
        isActive: true 
      };

      // Include organization-specific presets
      if (organizationId) {
        query.$or = [
          { organization: organizationId },
          { organization: null }, // Global presets
          { presetType: 'generic' }
        ];
      }

      const presets = await ExportPreset.find(query)
        .select('name bankName presetType fileFormat isDefault description')
        .sort({ isDefault: -1, name: 1 });

      res.json({
        success: true,
        presets: presets.map(preset => ({
          id: preset._id,
          name: preset.name,
          bankName: preset.bankName,
          presetType: preset.presetType,
          fileFormat: preset.fileFormat,
          isDefault: preset.isDefault,
          description: preset.description
        }))
      });
    } catch (error) {
      console.error('Error getting bank presets:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get payroll run history
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getPayrollRunHistory(req, res) {
    try {
      const { organizationId } = req.params;
      const { page = 1, limit = 10, status, exportType } = req.query;

      const query = { organization: organizationId };
      if (status) query.status = status;
      if (exportType) query.exportType = exportType;

      const runs = await PayrollRun.find(query)
        .populate('createdBy', 'fullName email')
        .populate('bankPreset', 'name bankName')
        .populate('wpsProfile', 'country currency')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await PayrollRun.countDocuments(query);

      res.json({
        success: true,
        runs: runs.map(run => ({
          runId: run.runId,
          period: run.period,
          payDate: run.payDate,
          exportType: run.exportType,
          country: run.wpsProfile?.country,
          bankPreset: run.bankPreset?.name,
          status: run.status,
          recordCount: run.statistics.recordCount,
          totalAmount: run.statistics.totalAmount,
          currency: run.currency,
          createdAt: run.createdAt,
          createdBy: run.createdBy?.fullName,
          files: run.files.map(file => ({
            fileName: file.fileName,
            fileSize: file.fileSize,
            expiresAt: file.expiresAt
          }))
        })),
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      });
    } catch (error) {
      console.error('Error getting payroll run history:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Download payroll file
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async downloadPayrollFile(req, res) {
    try {
      const { runId } = req.params;

      const payrollRun = await PayrollRun.findOne({ runId })
        .populate('organization', 'name')
        .populate('createdBy', 'fullName email');

      if (!payrollRun) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }

      // Check if user has access to this organization
      if (req.user.organization.toString() !== payrollRun.organization._id.toString() && 
          !req.user.isSuperAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (payrollRun.files.length === 0) {
        return res.status(404).json({ error: 'No files found for this run' });
      }

      const file = payrollRun.files[0];
      
      // Check if file has expired
      if (file.expiresAt && new Date() > file.expiresAt) {
        return res.status(410).json({ error: 'Download link has expired' });
      }

      // Generate new signed URL
      const downloadUrl = getSignedUrl(file.s3Key, 900); // 15 minutes

      // Update download count
      payrollRun.incrementDownloadCount();
      await payrollRun.save();

      res.json({
        success: true,
        downloadUrl,
        fileName: file.fileName,
        fileSize: file.fileSize,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        manifest: file.manifest
      });

    } catch (error) {
      console.error('Error downloading payroll file:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get currency for country
   * @param {String} country - Country name
   * @returns {String} Currency code
   */
  getCurrencyForCountry(country) {
    const currencyMap = {
      'Qatar': 'QAR',
      'UAE': 'AED',
      'Saudi Arabia': 'SAR',
      'Kuwait': 'KWD',
      'Bahrain': 'BHD',
      'Oman': 'OMR'
    };
    return currencyMap[country] || 'QAR';
  }

  /**
   * Log audit entry
   * @param {String} userId - User ID
   * @param {String} organizationId - Organization ID
   * @param {String} action - Action performed
   * @param {Object} details - Additional details
   */
  async logAuditEntry(userId, organizationId, action, details) {
    // Implementation depends on your existing audit logging system
    console.log('Audit:', { userId, organizationId, action, details });
  }
}

module.exports = new EnhancedPayrollController();
