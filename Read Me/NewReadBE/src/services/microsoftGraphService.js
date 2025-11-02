const axios = require('axios');
const UserToken = require('../models/UserToken');
const SSOConfig = require('../models/SSOConfig');

/**
 * Microsoft Graph Service
 * Handles OneDrive file operations via Microsoft Graph API
 */
class MicrosoftGraphService {
  constructor() {
    this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
    this.tokenEndpoint = 'https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token';
  }

  /**
   * Get or refresh access token for user
   */
  async getAccessToken(userId, organizationId, tenantId) {
    try {
      console.log('Getting access token for user:', userId);
      
      // Check if we have a valid token
      const tokenResult = await UserToken.findValidToken(userId, 'microsoft');
      
      if (tokenResult && !tokenResult.needsRefresh) {
        console.log('Using existing valid token');
        return tokenResult.token.accessToken;
      }
      
      if (tokenResult && tokenResult.needsRefresh && tokenResult.token.refreshToken) {
        console.log('Refreshing expired/expiring token');
        return await this.refreshAccessToken(userId, organizationId, tenantId, tokenResult.token.refreshToken);
      }
      
      // No valid token found
      console.log('No valid token found, consent required');
      return null;
      
    } catch (error) {
      console.error('Error getting access token:', error);
      throw new Error('Failed to get access token');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(userId, organizationId, tenantId, refreshToken) {
    try {
      console.log('Refreshing access token for user:', userId);
      
      // Get client credentials from SSO config
      const ssoConfig = await SSOConfig.findOne({ organization: organizationId });
      if (!ssoConfig) {
        throw new Error('SSO configuration not found');
      }
      
      const microsoftProvider = ssoConfig.providers.find(p => p.provider === 'microsoft');
      if (!microsoftProvider || !microsoftProvider.enabled) {
        throw new Error('Microsoft SSO not configured or disabled');
      }
      
      const tokenUrl = this.tokenEndpoint.replace('{tenantId}', tenantId);
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        client_id: microsoftProvider.clientId,
        client_secret: microsoftProvider.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'Files.Read Files.Read.All User.Read offline_access'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      // Store the new token
      await UserToken.storeToken(userId, organizationId, 'microsoft', response.data);
      
      console.log('Token refreshed successfully');
      return response.data.access_token;
      
    } catch (error) {
      console.error('Error refreshing token:', error.response?.data || error.message);
      
      // If refresh fails, the user needs to re-consent
      if (error.response?.status === 400) {
        // Delete the invalid token
        await UserToken.deleteOne({ userId, provider: 'microsoft' });
      }
      
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get OneDrive files for user
   */
  async getOneDriveFiles(userId, organizationId, tenantId, folderId = 'root', limit = 20) {
    try {
      console.log('Getting OneDrive files for user:', userId, 'folder:', folderId);
      
      const accessToken = await this.getAccessToken(userId, organizationId, tenantId);
      if (!accessToken) {
        throw new Error('No valid access token available');
      }
      
      const endpoint = folderId === 'root' 
        ? `${this.graphBaseUrl}/me/drive/root/children`
        : `${this.graphBaseUrl}/me/drive/items/${folderId}/children`;
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        params: {
          '$top': limit,
          '$select': 'id,name,size,lastModifiedDateTime,webUrl,file,folder,@microsoft.graph.downloadUrl'
        }
      });
      
      console.log(`Retrieved ${response.data.value.length} OneDrive items`);
      
      // Filter and format the files
      const files = response.data.value.map(item => ({
        id: item.id,
        name: item.name,
        size: item.size,
        lastModifiedDateTime: item.lastModifiedDateTime,
        webUrl: item.webUrl,
        downloadUrl: item['@microsoft.graph.downloadUrl'],
        isFolder: !!item.folder,
        isFile: !!item.file,
        mimeType: item.file?.mimeType || 'application/octet-stream'
      }));
      
      return {
        files,
        hasMore: response.data['@odata.nextLink'] ? true : false,
        nextLink: response.data['@odata.nextLink']
      };
      
    } catch (error) {
      console.error('Error getting OneDrive files:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        // Token might be invalid, try to refresh
        throw new Error('Authentication failed - please re-authorize OneDrive access');
      }
      
      throw new Error(`Failed to get OneDrive files: ${error.message}`);
    }
  }

  /**
   * Download file from OneDrive
   */
  async downloadFile(userId, organizationId, tenantId, fileId) {
    try {
      console.log('Downloading OneDrive file:', fileId, 'for user:', userId);
      
      const accessToken = await this.getAccessToken(userId, organizationId, tenantId);
      if (!accessToken) {
        throw new Error('No valid access token available');
      }
      
      // First get the file metadata
      const metadataResponse = await axios.get(`${this.graphBaseUrl}/me/drive/items/${fileId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const fileMetadata = metadataResponse.data;
      
      // Get the download URL
      const downloadUrl = fileMetadata['@microsoft.graph.downloadUrl'];
      if (!downloadUrl) {
        throw new Error('No download URL available for this file');
      }
      
      // Download the file content
      const fileResponse = await axios.get(downloadUrl, {
        responseType: 'stream',
        timeout: 30000 // 30 second timeout
      });
      
      return {
        stream: fileResponse.data,
        metadata: {
          name: fileMetadata.name,
          size: fileMetadata.size,
          mimeType: fileMetadata.file?.mimeType || 'application/octet-stream',
          lastModified: fileMetadata.lastModifiedDateTime
        }
      };
      
    } catch (error) {
      console.error('Error downloading OneDrive file:', error.response?.data || error.message);
      throw new Error(`Failed to download file: ${error.message}`);
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, clientId, clientSecret, tenantId, redirectUri) {
    try {
      console.log('Exchanging authorization code for tokens');
      
      const tokenUrl = this.tokenEndpoint.replace('{tenantId}', tenantId);
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: 'Files.Read Files.Read.All User.Read offline_access'
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      console.log('Successfully exchanged code for tokens');
      return response.data;
      
    } catch (error) {
      console.error('Error exchanging code for tokens:', error.response?.data || error.message);
      throw new Error('Failed to exchange authorization code for tokens');
    }
  }
}

module.exports = new MicrosoftGraphService();

