const CloudImportService = require('../services/cloudImportService');
const OrganizationDocument = require('../models/OrganizationDocument');
const { getSignedUrl } = require('../utils/s3');

/**
 * Import file from cloud storage
 * POST /api/cloud-import
 */
exports.importFile = async (req, res) => {
  try {
    const { provider, fileId, accessToken, fileName, fileSize, mimeType } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organization;
    
    // Validate required fields
    if (!provider || !fileId || !accessToken || !fileName || !mimeType) {
      return res.status(400).json({ 
        message: 'Missing required fields: provider, fileId, accessToken, fileName, mimeType' 
      });
    }
    
    // Validate provider
    if (!['onedrive', 'googledrive'].includes(provider.toLowerCase())) {
      return res.status(400).json({ 
        message: 'Invalid provider. Supported: onedrive, googledrive' 
      });
    }
    
    // Validate cloud import config
    await CloudImportService.validateCloudImportConfig(organizationId, provider);
    
    // Prepare metadata
    const metadata = {
      name: fileName,
      size: fileSize || 0,
      mimeType,
      fileId
    };
    
    // Import file based on provider
    let importResult;
    if (provider.toLowerCase() === 'onedrive') {
      importResult = await CloudImportService.importFromOneDrive(
        userId,
        organizationId,
        fileId,
        fileName,
        fileSize,
        mimeType,
        tenantId
      );
    } else if (provider.toLowerCase() === 'googledrive') {
      importResult = await CloudImportService.importFromGoogleDrive(
        fileId,
        accessToken,
        metadata,
        userId,
        organizationId
      );
    }
    
    // Create document record (same as manual upload)
    const document = new OrganizationDocument({
      title: fileName,
      description: 'Imported from cloud storage',
      category: 'Other', // Default category, can be updated later
      fileName: fileName,
      originalFileName: fileName,
      fileUrl: importResult.fileUrl,
      s3Key: importResult.s3Key,
      fileSize: importResult.fileSize,
      mimeType: importResult.mimeType,
      organization: organizationId,
      uploadedBy: userId,
      version: '1.0',
      tags: [],
      effectiveDate: new Date()
    });
    
    await document.save();
    await document.populate('uploadedBy', 'fullName email');
    
    // Return document with signed URL
    const docObj = document.toObject();
    docObj.downloadUrl = getSignedUrl(document.s3Key, 3600);
    
    res.status(201).json({
      success: true,
      message: 'File imported successfully',
      document: docObj,
      auditLogId: importResult.auditLogId
    });
    
  } catch (error) {
    console.error('Cloud import error:', error);
    res.status(error.status || 500).json({ 
      message: error.message || 'Failed to import file',
      error: error.message
    });
  }
};

/**
 * Get cloud import configuration for tenant
 * GET /api/cloud-import/config
 */
exports.getConfig = async (req, res) => {
  try {
    console.log('Getting cloud import config for organization:', req.user.organization);
    const organizationId = req.user.organization;
    const CloudImportConfig = require('../models/CloudImportConfig');
    
    console.log('CloudImportConfig model loaded successfully');
    let config = await CloudImportConfig.getForOrganization(organizationId);
    console.log('Config retrieved:', config ? 'found' : 'not found');
    
    // Return only what the frontend needs
    res.json({
      enabled: config.enabled,
      microsoft: {
        enabled: config.microsoft ? config.microsoft.enabled : false
      },
      google: {
        enabled: config.google ? config.google.enabled : false
      },
      allowedMimeTypes: config.allowedMimeTypes || [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif'
      ],
      virusScanning: config.virusScanning !== false // Default to true
    });
    
  } catch (error) {
    console.error('Error fetching cloud import config:', error);
    
    // Return default config on error
    res.json({
      enabled: false,
      microsoft: { enabled: false },
      google: { enabled: false },
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
    });
  }
};

/**
 * Check OneDrive authentication status for current user
 * POST /api/cloud-import/onedrive-auth-check
 */
exports.checkOneDriveAuth = async (req, res) => {
  console.log('=== ONEDRIVE AUTH CHECK ENDPOINT HIT ===');
  console.log('Request method:', req.method);
  console.log('Request body:', req.body);
  console.log('User:', req.user ? req.user._id : 'No user');
  
  try {
    const { clientId, tenantId, requestedScopes } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organization;
    
    console.log('Checking OneDrive auth for user:', userId);
    console.log('Organization:', organizationId);
    console.log('Client ID:', clientId);
    console.log('Tenant ID:', tenantId);
    
    const microsoftGraphService = require('../services/microsoftGraphService');
    
    // Try to get a valid access token
    const accessToken = await microsoftGraphService.getAccessToken(userId, organizationId, tenantId);
    
    if (accessToken) {
      console.log('Found valid OneDrive access token');
      
      // Get OneDrive files to return with the response
      try {
        const filesResult = await microsoftGraphService.getOneDriveFiles(userId, organizationId, tenantId);
        
        res.json({
          success: true,
          accessToken: accessToken,
          files: filesResult.files,
          hasMore: filesResult.hasMore,
          message: 'OneDrive access available'
        });
      } catch (filesError) {
        console.error('Error fetching OneDrive files:', filesError);
        // Still return success with token, but no files
        res.json({
          success: true,
          accessToken: accessToken,
          files: [],
          message: 'OneDrive access available but could not fetch files'
        });
      }
    } else {
      console.log('No valid OneDrive access token found, consent needed');
      res.json({
        success: false,
        needsConsent: true,
        message: 'OneDrive consent required for first-time access'
      });
    }
    
  } catch (error) {
    console.error('Error checking OneDrive auth:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking OneDrive authentication status',
      error: error.message
    });
  }
};

/**
 * Generate OneDrive consent URL
 * POST /api/cloud-import/onedrive-consent-url
 */
exports.getOneDriveConsentUrl = async (req, res) => {
  try {
    const { clientId, tenantId, scopes } = req.body;
    const userId = req.user._id;
    
    console.log('Generating OneDrive consent URL for user:', userId);
    
    // Use a centralized redirect URI that works across all pages
    const redirectUri = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/auth/onedrive-callback`;
    const state = `${userId}_${Date.now()}`;
    const scopeString = scopes.join(' ');
    
    const consentUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_mode=query&` +
      `scope=${encodeURIComponent(scopeString)}&` +
      `state=${state}&` +
      `prompt=consent`; // Force consent to ensure all permissions are granted
    
    console.log('Generated consent URL:', consentUrl);
    
    res.json({
      success: true,
      consentUrl,
      redirectUri,
      state
    });
    
  } catch (error) {
    console.error('Error generating OneDrive consent URL:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating consent URL',
      error: error.message
    });
  }
};

/**
 * Exchange OneDrive authorization code for access token
 * POST /api/cloud-import/onedrive-token-exchange
 */
exports.exchangeOneDriveToken = async (req, res) => {
  try {
    const { code, state } = req.body;
    const userId = req.user._id;
    const organizationId = req.user.organization;
    
    console.log('Exchanging OneDrive authorization code for user:', userId);
    console.log('Authorization code received:', code);
    console.log('State parameter:', state);
    
    // Validate state parameter (basic validation)
    if (!state || !state.startsWith(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid state parameter'
      });
    }
    
    // Get SSO configuration to get client credentials
    const SSOConfig = require('../models/SSOConfig');
    const ssoConfig = await SSOConfig.findOne({ organization: organizationId });
    
    if (!ssoConfig) {
      return res.status(400).json({
        success: false,
        message: 'SSO configuration not found'
      });
    }
    
    const microsoftProvider = ssoConfig.providers.find(p => p.provider === 'microsoft');
    if (!microsoftProvider || !microsoftProvider.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Microsoft SSO not configured or disabled'
      });
    }
    
    // Exchange authorization code for tokens
    const microsoftGraphService = require('../services/microsoftGraphService');
    const UserToken = require('../models/UserToken');
    
    const redirectUri = `${process.env.FRONTEND_URL || 'https://www.stfbridge.com'}/auth/onedrive-callback`;
    
    const tokenData = await microsoftGraphService.exchangeCodeForTokens(
      code,
      microsoftProvider.clientId,
      microsoftProvider.clientSecret,
      microsoftProvider.tenantId,
      redirectUri
    );
    
    // Store the tokens in database
    await UserToken.storeToken(userId, organizationId, 'microsoft', tokenData);
    
    console.log('OneDrive tokens stored successfully for user:', userId);
    
    res.json({
      success: true,
      message: 'OneDrive access granted successfully',
      accessGranted: true
    });
    
  } catch (error) {
    console.error('Error exchanging OneDrive token:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing OneDrive authorization',
      error: error.message
    });
  }
};

/**
 * Update cloud import configuration for tenant
 * PUT /api/cloud-import/config
 */
exports.updateConfig = async (req, res) => {
  try {
    const organizationId = req.user.organization;
    const userId = req.user._id;
    const CloudImportConfig = require('../models/CloudImportConfig');
    
    const { enabled, microsoft, google, virusScanning } = req.body;
    
    // Find existing config or create new one
    let config = await CloudImportConfig.getForOrganization(organizationId);
    
    // Update configuration
    config.enabled = enabled !== undefined ? enabled : config.enabled;
    config.virusScanning = virusScanning !== undefined ? virusScanning : config.virusScanning;
    
    if (microsoft) {
      config.microsoft = {
        ...config.microsoft,
        enabled: microsoft.enabled !== undefined ? microsoft.enabled : config.microsoft?.enabled || false
      };
    }
    
    if (google) {
      config.google = {
        ...config.google,
        enabled: google.enabled !== undefined ? google.enabled : config.google?.enabled || false
      };
    }
    
    config.updatedBy = userId;
    await config.save();
    
    res.json({
      success: true,
      message: 'Cloud import configuration updated successfully',
      config: {
        enabled: config.enabled,
        microsoft: {
          enabled: config.microsoft?.enabled || false
        },
        google: {
          enabled: config.google?.enabled || false
        },
        allowedMimeTypes: config.allowedMimeTypes,
        virusScanning: config.virusScanning
      }
    });
    
  } catch (error) {
    console.error('Error updating cloud import config:', error);
    res.status(500).json({ 
      message: 'Error updating configuration',
      error: error.message
    });
  }
};
