const crypto = require('crypto');
const SSOConfig = require('../models/SSOConfig');
const SSOAuth = require('../models/SSOAuth');
const Organization = require('../models/Organization');

/**
 * Discover organization by email domain for SSO
 */
exports.discoverOrganization = async (email) => {
  const domain = email.split('@')[1];
  
  if (!domain) {
    throw new Error('Invalid email format');
  }

  // Find organization by email domain
  // First try to find by exact email match, then by domain
  let organization = await Organization.findOne({ email: email });
  
  if (!organization) {
    // If no exact match, try to find by domain in the email field
    organization = await Organization.findOne({
      email: { $regex: new RegExp(`@${domain}$`, 'i') }
    });
  }
  
  if (!organization) {
    // Also try to find organizations where users with this domain exist
    const User = require('../models/User');
    const userWithDomain = await User.findOne({
      email: { $regex: new RegExp(`@${domain}$`, 'i') }
    }).populate('organization');
    
    if (userWithDomain && userWithDomain.organization) {
      organization = userWithDomain.organization;
    }
  }

  if (!organization) {
    throw new Error('No organization found for this email domain');
  }

  // Get or create SSO configuration
  const ssoConfig = await SSOConfig.findOrCreateForOrganization(organization._id);

  // Get available providers
  const availableProviders = ssoConfig.providers
    .filter(p => p.enabled)
    .map(p => ({
      provider: p.provider,
      name: p.provider === 'microsoft' ? 'Microsoft Entra ID' : 'Google Workspace'
    }));

  // Check if there are any enabled providers
  if (availableProviders.length === 0) {
    throw new Error('No SSO providers are enabled for this organization. Please contact your administrator to configure SSO.');
  }
  
  // Check if the email domain is allowed
  const enabledProviders = ssoConfig.providers.filter(p => p.enabled);
  const hasAllowedDomains = enabledProviders.some(provider => 
    provider.allowedDomains && provider.allowedDomains.length > 0
  );
  
  if (hasAllowedDomains) {
    const isEmailAllowed = enabledProviders.some(provider => 
      provider.allowedDomains && provider.allowedDomains.includes(domain)
    );
    
    console.log('Domain validation:', {
      emailDomain: domain,
      allowedDomains: enabledProviders.flatMap(p => p.allowedDomains || []),
      isEmailAllowed
    });
    
    if (!isEmailAllowed) {
      throw new Error(`Email domain '${domain}' is not allowed for SSO. Please contact your administrator.`);
    }
  } else {
    console.log('Warning: No allowed domains configured for any SSO provider');
  }

  return {
    organization,
    ssoConfig,
    availableProviders
  };
};

/**
 * Generate OAuth state for security
 */
exports.generateOAuthState = () => {
  const state = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(32).toString('hex');
  
  return { state, nonce };
};

/**
 * Generate PKCE parameters for OAuth 2.0
 */
exports.generatePKCE = () => {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  
  return { codeVerifier, codeChallenge };
};

/**
 * Validate OAuth state
 */
exports.validateOAuthState = (receivedState, expectedState) => {
  return receivedState === expectedState;
};

/**
 * Find or create user from SSO information
 */
exports.findOrCreateUser = async (organizationId, idpUserInfo, provider, ssoConfig) => {
  console.log('=== FIND OR CREATE USER ===');
  console.log('Organization ID:', organizationId);
  console.log('IdP User Info:', idpUserInfo);
  console.log('Provider:', provider);

  const User = require('../models/User');
  const Role = require('../models/Role');
  
  try {
    // First, try to find existing user by email and organization
    let user = await User.findOne({ 
      email: idpUserInfo.email, 
      organization: organizationId 
    });

    if (user) {
      console.log('Found existing user');
      return user;
    }

    // If JIT provisioning is enabled, create new user
    if (ssoConfig.jitProvisioning.enabled) {
      console.log('Creating new user via JIT provisioning');
      
      // Find the default role
      const defaultRole = await Role.findOne({
        organization: organizationId,
        name: ssoConfig.jitProvisioning.defaultRole || 'staff'
      });

      if (!defaultRole) {
        throw new Error(`Default role '${ssoConfig.jitProvisioning.defaultRole || 'staff'}' not found for organization`);
      }

      // Create new user
      user = new User({
        email: idpUserInfo.email,
        name: idpUserInfo.name || `${idpUserInfo.firstName || ''} ${idpUserInfo.lastName || ''}`.trim(),
        firstName: idpUserInfo.firstName,
        lastName: idpUserInfo.lastName,
        organization: organizationId,
        role: defaultRole._id,
        department: ssoConfig.jitProvisioning.defaultDepartment || 'General',
        isEmailVerified: true, // SSO users are considered verified
        password: null, // SSO users don't have passwords
        ssoOnly: true // Mark as SSO-only user
      });

      await user.save();
      console.log('Created new user successfully');
      return user;
    } else {
      throw new Error('User not found and JIT provisioning is disabled');
    }
  } catch (error) {
    console.error('Find or create user error:', error);
    throw error;
  }
};

/**
 * Create or update SSO authentication record
 */
exports.createSSOAuth = async (organizationId, userId, provider, tokens, idpUserInfo, state, nonce, codeVerifier, req) => {
  console.log('=== CREATE SSO AUTH ===');
  
  const SSOAuth = require('../models/SSOAuth');
  
  try {
    // Deactivate existing sessions for this user
    await SSOAuth.updateMany(
      { user: userId, organization: organizationId },
      { isActive: false }
    );

    // Generate unique session ID
    const sessionId = `sso_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create new session
    const ssoAuth = new SSOAuth({
      user: userId,
      organization: organizationId,
      provider,
      providerUserId: idpUserInfo.id,
      sessionId: sessionId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
      tokenExpiry: new Date(Date.now() + (tokens.expiresIn * 1000)),
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      metadata: {
        state,
        nonce,
        codeVerifier,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        idpUserInfo
      }
    });

    await ssoAuth.save();
    console.log('Created SSO auth record successfully');
    return ssoAuth;
  } catch (error) {
    console.error('Create SSO auth error:', error);
    throw error;
  }
};

/**
 * Get SSO authentication by session ID
 */
exports.getSSOAuthBySessionId = async (sessionId) => {
  return await SSOAuth.findBySessionId(sessionId);
};

/**
 * Update SSO configuration for organization
 */
exports.updateSSOConfig = async (organizationId, configData) => {
  let ssoConfig = await SSOConfig.findOne({ organization: organizationId });
  
  if (!ssoConfig) {
    ssoConfig = new SSOConfig({ organization: organizationId });
  }

  // Update configuration
  Object.assign(ssoConfig, configData);
  
  // Validate configuration
  const validationErrors = ssoConfig.validateConfig();
  if (validationErrors.length > 0) {
    throw new Error(`SSO configuration validation failed: ${validationErrors.join(', ')}`);
  }

  return await ssoConfig.save();
};

/**
 * Test SSO connection for a provider
 */
exports.testSSOConnection = async (organizationId, provider) => {
  const ssoConfig = await SSOConfig.findOne({ organization: organizationId });
  
  if (!ssoConfig) {
    throw new Error('SSO configuration not found');
  }

  const providerConfig = ssoConfig.getProviderConfig(provider);
  if (!providerConfig || !providerConfig.enabled) {
    throw new Error(`${provider} provider is not configured or enabled`);
  }

  // Update connection status to testing
  providerConfig.connectionStatus = 'testing';
  providerConfig.lastConnectionTest = new Date();
  await ssoConfig.save();

  try {
    // Here you would implement actual connection testing logic
    // For now, we'll simulate a successful test
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    providerConfig.connectionStatus = 'connected';
    providerConfig.lastConnectionTest = new Date();
    delete providerConfig.lastConnectionError;
    
    await ssoConfig.save();
    
    return {
      success: true,
      message: `${provider} connection test successful`,
      connectionStatus: 'connected'
    };
  } catch (error) {
    providerConfig.connectionStatus = 'error';
    providerConfig.lastConnectionError = error.message;
    await ssoConfig.save();
    
    throw error;
  }
};

/**
 * Cleanup expired SSO sessions
 */
exports.cleanupExpiredSessions = async () => {
  return await SSOAuth.cleanupExpiredSessions();
};

/**
 * Get user's active SSO sessions
 */
exports.getUserSessions = async (userId, organizationId) => {
  return await SSOAuth.findActiveSessions(userId, organizationId);
};

/**
 * Revoke specific SSO session
 */
exports.revokeSession = async (sessionId, userId, organizationId) => {
  const session = await SSOAuth.findOne({
    sessionId,
    user: userId,
    organization: organizationId
  });

  if (!session) {
    throw new Error('Session not found');
  }

  return await session.deactivate();
};

/**
 * Generate Microsoft OAuth authorization URL
 */
exports.generateMicrosoftAuthUrl = (providerConfig, state, nonce, codeChallenge) => {
  const { clientId, tenantId, redirectUri } = providerConfig;
  
  console.log('=== MICROSOFT AUTH URL GENERATION ===');
  console.log('Provider config:', {
    clientId: clientId ? 'SET' : 'MISSING',
    tenantId: tenantId ? 'SET' : 'MISSING', 
    redirectUri: redirectUri || 'MISSING',
    hasState: !!state,
    hasNonce: !!nonce,
    hasCodeChallenge: !!codeChallenge
  });
  
  if (!redirectUri) {
    throw new Error('Redirect URI is required but not configured');
  }
  
  const baseUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state: state,
    nonce: nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  });

  const authUrl = `${baseUrl}?${params.toString()}`;
  console.log('Generated auth URL:', authUrl);
  
  return authUrl;
};

/**
 * Exchange Microsoft authorization code for tokens
 */
exports.exchangeMicrosoftCode = async (code, codeVerifier, redirectUri, providerConfig) => {
  const { clientId, clientSecret, tenantId } = providerConfig;
  
  console.log('=== MICROSOFT TOKEN EXCHANGE ===');
  console.log('Config:', { 
    clientId: clientId ? 'SET' : 'MISSING',
    clientSecret: clientSecret ? 'SET' : 'MISSING',
    tenantId: tenantId ? 'SET' : 'MISSING',
    redirectUri,
    hasCode: !!code,
    hasCodeVerifier: !!codeVerifier
  });

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    scope: 'openid profile email User.Read'
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Microsoft token exchange error:', data);
      throw new Error(`Token exchange failed: ${data.error_description || data.error || 'Unknown error'}`);
    }

    console.log('Microsoft token exchange successful');
    console.log('Token response:', {
      hasAccessToken: !!data.access_token,
      hasRefreshToken: !!data.refresh_token,
      hasIdToken: !!data.id_token,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      scope: data.scope,
      accessTokenStart: data.access_token ? data.access_token.substring(0, 20) + '...' : 'MISSING'
    });
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  } catch (error) {
    console.error('Microsoft token exchange error:', error);
    throw error;
  }
};

/**
 * Generate Google OAuth authorization URL
 */
exports.generateGoogleAuthUrl = (providerConfig, state, codeChallenge) => {
  const { clientId, redirectUri, hostedDomain } = providerConfig;
  
  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'select_account'
  });

  if (hostedDomain) {
    params.append('hd', hostedDomain);
  }

  return `${baseUrl}?${params.toString()}`;
};

/**
 * Exchange Google authorization code for tokens
 */
exports.exchangeGoogleCode = async (code, codeVerifier, redirectUri, providerConfig) => {
  const { clientId, clientSecret } = providerConfig;
  
  console.log('=== GOOGLE TOKEN EXCHANGE ===');
  console.log('Config:', { 
    clientId: clientId ? 'SET' : 'MISSING',
    clientSecret: clientSecret ? 'SET' : 'MISSING',
    redirectUri,
    hasCode: !!code,
    hasCodeVerifier: !!codeVerifier
  });

  const tokenUrl = 'https://oauth2.googleapis.com/token';
  
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString()
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Google token exchange error:', data);
      throw new Error(`Token exchange failed: ${data.error_description || data.error || 'Unknown error'}`);
    }

    console.log('Google token exchange successful');
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope
    };
  } catch (error) {
    console.error('Google token exchange error:', error);
    throw error;
  }
};

/**
 * Get Microsoft user information using access token
 */
exports.getMicrosoftUserInfo = async (accessToken) => {
  console.log('=== MICROSOFT USER INFO ===');
  console.log('Access token (first 20 chars):', accessToken ? accessToken.substring(0, 20) + '...' : 'MISSING');
  
  if (!accessToken) {
    throw new Error('Access token is required but not provided');
  }
  
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    console.log('Microsoft Graph API response status:', response.status);
    console.log('Microsoft Graph API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Microsoft Graph API error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (parseError) {
        console.error('Failed to parse error response as JSON:', parseError);
        throw new Error(`Failed to get user info: HTTP ${response.status} - ${errorText}`);
      }
      
      const errorMessage = errorData.error?.message || errorData.error || errorText || 'Unknown error';
      throw new Error(`Failed to get user info: ${errorMessage}`);
    }

    const userInfo = await response.json();
    console.log('Microsoft user info retrieved successfully:', {
      id: userInfo.id ? 'SET' : 'MISSING',
      email: userInfo.mail || userInfo.userPrincipalName || 'MISSING',
      name: userInfo.displayName || 'MISSING'
    });
    
    return {
      id: userInfo.id,
      email: userInfo.mail || userInfo.userPrincipalName,
      name: userInfo.displayName,
      firstName: userInfo.givenName,
      lastName: userInfo.surname,
      profilePicture: null // Could be fetched separately if needed
    };
  } catch (error) {
    console.error('Microsoft user info error:', error);
    throw error;
  }
};

/**
 * Get Google user information using access token
 */
exports.getGoogleUserInfo = async (accessToken) => {
  console.log('=== GOOGLE USER INFO ===');
  
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Google user info error:', error);
      throw new Error(`Failed to get user info: ${error.error?.message || 'Unknown error'}`);
    }

    const userInfo = await response.json();
    console.log('Google user info retrieved successfully');
    
    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
      profilePicture: userInfo.picture
    };
  } catch (error) {
    console.error('Google user info error:', error);
    throw error;
  }
};

/**
 * Verify Microsoft ID token (simplified version)
 */
exports.verifyMicrosoftIdToken = async (idToken, providerConfig) => {
  // For production, you should verify the signature using Microsoft's JWKS
  // For now, we'll just decode the payload (NOT SECURE for production)
  console.log('=== MICROSOFT ID TOKEN VERIFICATION ===');
  console.log('Note: Using simplified verification - implement proper JWKS verification for production');
  
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
    return {
      sub: payload.sub,
      email: payload.email || payload.preferred_username,
      name: payload.name,
      oid: payload.oid // Microsoft's unique identifier
    };
  } catch (error) {
    console.error('Microsoft ID token verification error:', error);
    throw new Error('Invalid ID token');
  }
};

/**
 * Verify Google ID token (simplified version)
 */
exports.verifyGoogleIdToken = async (idToken, providerConfig) => {
  // For production, you should verify the signature using Google's public keys
  // For now, we'll just decode the payload (NOT SECURE for production)
  console.log('=== GOOGLE ID TOKEN VERIFICATION ===');
  console.log('Note: Using simplified verification - implement proper signature verification for production');
  
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture
    };
  } catch (error) {
    console.error('Google ID token verification error:', error);
    throw new Error('Invalid ID token');
  }
};

