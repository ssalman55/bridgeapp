const axios = require('axios');
const https = require('https');
const { uploadFileStream } = require('../utils/s3');
const CloudImportAudit = require('../models/CloudImportAudit');
const CloudImportConfig = require('../models/CloudImportConfig');

/**
 * Trigger virus scan for uploaded file
 * @param {string} s3Key - S3 key of uploaded file
 * @param {string} auditLogId - Audit log ID for tracking
 */
async function triggerVirusScan(s3Key, auditLogId) {
  try {
    // TODO: Integrate with actual virus scanning service
    // For now, simulate a scan
    console.log(`Triggering virus scan for ${s3Key}`);
    
    // Simulate scan delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update audit log with scan result
    await CloudImportAudit.findByIdAndUpdate(auditLogId, {
      virusScanResult: 'clean', // or 'infected', 'error'
      virusScanCompletedAt: new Date()
    });
    
    console.log(`Virus scan completed for ${s3Key}`);
  } catch (error) {
    console.error('Virus scan error:', error);
    
    // Update audit log with scan error
    await CloudImportAudit.findByIdAndUpdate(auditLogId, {
      virusScanResult: 'error',
      virusScanError: error.message,
      virusScanCompletedAt: new Date()
    }).catch(console.error);
  }
}

/**
 * Cloud Import Service
 * Handles streaming files from cloud storage providers to S3
 */

/**
 * Import file from Microsoft OneDrive
 * @param {string} fileId - OneDrive file ID
 * @param {string} accessToken - OAuth access token
 * @param {object} metadata - File metadata
 * @param {object} userId - User ID for audit
 * @param {object} organizationId - Organization ID
 * @returns {Promise<object>} Imported document record
 */
async function importFromOneDrive(userId, organizationId, fileId, fileName, fileSize, mimeType, tenantId) {
  const startTime = Date.now();
  let auditLog = null;
  
  try {
    // Validate input
    if (!fileId || !userId || !organizationId) {
      throw new Error('Missing required parameters: fileId, userId, organizationId');
    }

    // Create audit record
    auditLog = new CloudImportAudit({
      organization: organizationId,
      user: userId,
      provider: 'onedrive',
      fileId,
      fileName,
      fileSize,
      mimeType,
      status: 'in_progress',
      startedAt: new Date()
    });
    await auditLog.save();
    
    // Use Microsoft Graph Service to download the file
    const microsoftGraphService = require('./microsoftGraphService');
    const downloadResult = await microsoftGraphService.downloadFile(userId, organizationId, tenantId, fileId);
    
    // Create S3 key
    const orgIdString = String(organizationId).slice(-12);
    const folder = `docs/${orgIdString}`;
    const timestamp = Date.now();
    const s3Key = `${folder}/${timestamp}-${downloadResult.metadata.name}`;
    
    // Stream file directly to S3
    const fileUrl = await uploadFileStream(downloadResult.stream, {
      s3Key,
      contentType: downloadResult.metadata.mimeType,
      metadata: {
        originalName: downloadResult.metadata.name,
        provider: 'onedrive',
        fileId: fileId,
        importedAt: new Date().toISOString()
      }
    });
    
    // Update audit record
    const durationMs = Date.now() - startTime;
    auditLog.status = 'completed';
    auditLog.s3Key = s3Key;
    auditLog.completedAt = new Date();
    auditLog.durationMs = durationMs;
    auditLog.virusScanResult = 'pending'; // Will be updated after scan
    auditLog.metadata = {
      provider: 'onedrive',
      originalSize: downloadResult.metadata.size,
      lastModified: downloadResult.metadata.lastModified
    };
    await auditLog.save();
    
    // Trigger virus scan (async)
    triggerVirusScan(s3Key, auditLog._id).catch(console.error);
    
    return {
      success: true,
      s3Key,
      fileUrl,
      fileName: downloadResult.metadata.name,
      fileSize: downloadResult.metadata.size,
      mimeType: downloadResult.metadata.mimeType,
      auditLogId: auditLog._id
    };
    
  } catch (error) {
    // Update audit with error
    const durationMs = Date.now() - startTime;
    console.error('OneDrive import error:', error);
    
    if (auditLog && auditLog._id) {
      await CloudImportAudit.findByIdAndUpdate(auditLog._id, {
        status: 'failed',
        errorCode: error.response?.status || error.code || 'IMPORT_ERROR',
        errorMessage: error.message || error.response?.data?.error?.message || 'Unknown error',
        completedAt: new Date(),
        durationMs
      }).catch(console.error);
    }
    
    // Provide more specific error messages
    if (error.response?.status === 401) {
      throw new Error('Unauthorized: Please re-authenticate');
    } else if (error.response?.status === 404) {
      throw new Error('File not found in OneDrive');
    } else if (error.response?.status === 403) {
      throw new Error('Access denied to this file');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Network error: Could not connect to OneDrive');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Request timed out: Please try again');
    }
    
    throw new Error(`Failed to import from OneDrive: ${error.message}`);
  }
}

/**
 * Import file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @param {string} accessToken - OAuth access token
 * @param {object} metadata - File metadata
 * @param {object} userId - User ID for audit
 * @param {object} organizationId - Organization ID
 * @returns {Promise<object>} Imported document record
 */
async function importFromGoogleDrive(fileId, accessToken, metadata, userId, organizationId) {
  const startTime = Date.now();
  let auditLog = null;
  
  try {
    // Validate input
    if (!fileId || !accessToken) {
      throw new Error('Missing required parameters: fileId and accessToken');
    }

    // Create audit record
    auditLog = new CloudImportAudit({
      organization: organizationId,
      user: userId,
      provider: 'googledrive',
      fileId,
      fileName: metadata.name,
      fileSize: metadata.size,
      mimeType: metadata.mimeType,
      status: 'in_progress',
      startedAt: new Date()
    });
    await auditLog.save();
    
    // Get file download URL from Google Drive API
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    
    const response = await axios({
      method: 'GET',
      url: driveUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      responseType: 'stream',
      timeout: 300000 // 5 minutes
    });
    
    // Create S3 key
    const orgIdString = String(organizationId).slice(-12);
    const folder = `docs/${orgIdString}`;
    const timestamp = Date.now();
    const s3Key = `${folder}/${timestamp}-${metadata.name}`;
    
    // Stream file directly to S3
    const fileUrl = await uploadFileStream(response.data, {
      s3Key,
      contentType: metadata.mimeType,
      metadata: {
        originalName: metadata.name,
        provider: 'googledrive',
        fileId: fileId,
        importedAt: new Date().toISOString()
      }
    });
    
    // Update audit record
    const durationMs = Date.now() - startTime;
    auditLog.status = 'completed';
    auditLog.s3Key = s3Key;
    auditLog.completedAt = new Date();
    auditLog.durationMs = durationMs;
    auditLog.virusScanResult = 'pending';
    auditLog.metadata = {
      originalUrl: driveUrl,
      provider: 'googledrive'
    };
    await auditLog.save();
    
    // Trigger virus scan (async)
    triggerVirusScan(s3Key, auditLog._id).catch(console.error);
    
    return {
      success: true,
      s3Key,
      fileUrl,
      fileName: metadata.name,
      fileSize: metadata.size,
      mimeType: metadata.mimeType,
      auditLogId: auditLog._id
    };
    
  } catch (error) {
    // Update audit with error
    const durationMs = Date.now() - startTime;
    console.error('Google Drive import error:', error);
    
    if (auditLog && auditLog._id) {
      await CloudImportAudit.findByIdAndUpdate(auditLog._id, {
        status: 'failed',
        errorCode: error.response?.status || error.code || 'IMPORT_ERROR',
        errorMessage: error.message || error.response?.data?.error?.message || 'Unknown error',
        completedAt: new Date(),
        durationMs
      }).catch(console.error);
    }
    
    // Provide more specific error messages
    if (error.response?.status === 401) {
      throw new Error('Unauthorized: Please re-authenticate with Google');
    } else if (error.response?.status === 404) {
      throw new Error('File not found in Google Drive');
    } else if (error.response?.status === 403) {
      throw new Error('Access denied to this file');
    } else if (error.code === 'ENOTFOUND') {
      throw new Error('Network error: Could not connect to Google Drive');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Request timed out: Please try again');
    }
    
    throw new Error(`Failed to import from Google Drive: ${error.message}`);
  }
}

/**
 * Validate cloud import configuration for tenant
 * @param {object} organizationId - Organization ID
 * @param {string} provider - Provider name ('onedrive' or 'googledrive')
 * @returns {Promise<object>} Configuration object
 */
async function validateCloudImportConfig(organizationId, provider) {
  const config = await CloudImportConfig.getForOrganization(organizationId);
  
  if (!config.enabled) {
    throw new Error('Cloud import is not enabled for this organization');
  }
  
  const isProviderEnabled = config.isProviderEnabled(provider);
  if (!isProviderEnabled) {
    throw new Error(`Cloud import from ${provider} is not enabled for this organization`);
  }
  
  return config;
}

module.exports = {
  importFromOneDrive,
  importFromGoogleDrive,
  validateCloudImportConfig
};
