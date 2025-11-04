const ssoService = require('../services/ssoService');
const SSOConfig = require('../models/SSOConfig');
const SSOAuth = require('../models/SSOAuth');
const OAuthState = require('../models/OAuthState');
const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const SSOConfiguration = require('../models/SSOConfiguration');

// JWT secret key with fallback
const JWT_SECRET = process.env.JWT_SECRET || 'your-fallback-secret-key';

/**
 * Discover organization by email domain for SSO
 */
exports.discoverOrganization = async (req, res) => {
  try {
    const { email } = req.body;
    
    console.log('=== SSO DISCOVERY REQUEST ===');
    console.log('Email:', email);
    console.log('Request body:', req.body);

    if (!email) {
      console.log('ERROR: No email provided');
      return res.status(400).json({
        success: false,
        message: 'Email is required for organization discovery'
      });
    }

    console.log('Attempting organization discovery for email:', email);
    const discovery = await ssoService.discoverOrganization(email);
    
    console.log('Discovery successful:', {
      organizationId: discovery.organization._id,
      organizationName: discovery.organization.name,
      providersCount: discovery.availableProviders.length,
      enabledProviders: discovery.availableProviders.map(p => p.provider)
    });
    
    res.json({
      success: true,
      data: {
        organization: {
          id: discovery.organization._id,
          name: discovery.organization.name,
          plan: discovery.organization.plan
        },
        availableProviders: discovery.availableProviders.map(p => ({
          provider: p.provider,
          name: p.provider === 'microsoft' ? 'Microsoft Entra ID' : 'Google Workspace'
        })),
        ssoOnly: discovery.ssoConfig.ssoOnly
      }
    });
  } catch (error) {
    console.error('=== SSO DISCOVERY ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Email attempted:', req.body?.email);
    
    res.status(404).json({
      success: false,
      message: error.message || 'No SSO configuration found for this domain'
    });
  }
};

/**
 * Initiate SSO login flow
 */
exports.initiateSSO = async (req, res) => {
  try {
    const { email, provider, organizationId, platform } = req.body;

    if (!email || !provider || !organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Email, provider, and organization ID are required'
      });
    }

    // Validate provider
    if (!['microsoft', 'google'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid provider specified'
      });
    }

    // Get SSO configuration
    const ssoConfig = await SSOConfig.findOne({ organization: organizationId });
    if (!ssoConfig) {
      return res.status(404).json({
        success: false,
        message: 'SSO configuration not found for this organization'
      });
    }

    const providerConfig = ssoConfig.getProviderConfig(provider);
    if (!providerConfig) {
      return res.status(400).json({
        success: false,
        message: `${provider} SSO is not configured for this organization`
      });
    }

    // Generate OAuth security parameters
    const { state, nonce } = ssoService.generateOAuthState();
    const { codeVerifier, codeChallenge } = ssoService.generatePKCE();

    // Store OAuth state in both session and database for redundancy
    const oauthStateData = {
      state,
      nonce,
      codeVerifier,
      email,
      provider,
      organizationId,
      platform: platform || 'web', // Store platform (mobile or web) for redirect detection
      sessionId: req.sessionID,
      timestamp: Date.now()
    };

    // Store in session
    req.session.oauthState = oauthStateData;

    // Store in database as fallback
    const savedState = await OAuthState.createState({
      state,
      nonce,
      codeVerifier,
      email,
      provider,
      organizationId,
      platform: platform || 'web', // Store platform for callback redirect
      sessionId: req.sessionID
    });
    
    console.log('✅ OAuth state saved to database with platform:', savedState.platform);

    console.log('=== SSO INITIATION DEBUG ===');
    console.log('Session ID:', req.sessionID);
    console.log('Stored OAuth state:', req.session.oauthState);
    console.log('Platform:', platform || 'web');
    console.log('Generated state:', state);

    // Generate authorization URL
    let authUrl;
    if (provider === 'microsoft') {
      authUrl = ssoService.generateMicrosoftAuthUrl(
        providerConfig,
        state,
        nonce,
        codeChallenge
      );
    } else if (provider === 'google') {
      authUrl = ssoService.generateGoogleAuthUrl(
        providerConfig,
        state,
        codeChallenge
      );
    }

    res.json({
      success: true,
      data: {
        authUrl,
        state,
        expiresIn: 300 // 5 minutes
      }
    });
  } catch (error) {
    console.error('SSO initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate SSO login'
    });
  }
};

/**
 * Handle SSO callback from IdP
 */
exports.handleSSOCallback = async (req, res) => {
  try {
    console.log('🔵 === SSO CALLBACK STARTED ===');
    console.log('🔵 Request URL:', req.originalUrl);
    console.log('🔵 Request Method:', req.method);
    console.log('🔵 Request Headers User-Agent:', req.get('User-Agent'));
    
    const { code, state, error, error_description } = req.query;

    console.log('=== SSO CALLBACK DEBUG ===');
    console.log('Query params:', { code: !!code, state, error, error_description });
    console.log('Session ID:', req.sessionID);
    console.log('Session data:', req.session);
    console.log('OAuth state from session:', req.session.oauthState);

    if (error) {
      return res.status(400).json({
        success: false,
        message: `SSO error: ${error_description || error}`
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code or state'
      });
    }

    // Retrieve stored OAuth state from session first, then database as fallback
    let oauthState = req.session.oauthState;
    
    // If not found in session, try database
    if (!oauthState || oauthState.state !== state) {
      console.log('Session state not found or mismatch, trying database...');
      console.log('Looking for state:', state);
      const dbState = await OAuthState.findAndConsumeState(state);
      
      if (dbState) {
        console.log('Found OAuth state in database:', {
          platform: dbState.platform,
          email: dbState.email,
          provider: dbState.provider
        });
        oauthState = {
          state: dbState.state,
          nonce: dbState.nonce,
          codeVerifier: dbState.codeVerifier,
          email: dbState.email,
          provider: dbState.provider,
          organizationId: dbState.organizationId,
          platform: dbState.platform || 'web', // Include platform from database
          timestamp: dbState.createdAt.getTime()
        };
        console.log('OAuth state reconstructed from database with platform:', oauthState.platform);
      } else {
        console.error('OAuth state not found in database either!');
      }
    } else {
      console.log('OAuth state found in session with platform:', oauthState.platform);
    }

    console.log('State comparison:', {
      receivedState: state,
      storedState: oauthState?.state,
      match: oauthState?.state === state,
      hasOAuthState: !!oauthState,
      platform: oauthState?.platform, // Log platform for debugging
      source: req.session.oauthState ? 'session' : 'database'
    });

    if (!oauthState || oauthState.state !== state) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OAuth state'
      });
    }

    // Check if state is expired (5 minutes)
    if (Date.now() - oauthState.timestamp > 5 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'OAuth state has expired'
      });
    }

    const { email, provider, organizationId, codeVerifier } = oauthState;

    // Get SSO configuration
    const ssoConfig = await SSOConfig.findOne({ organization: organizationId });
    const providerConfig = ssoConfig.getProviderConfig(provider);

    // Exchange code for tokens
    let tokens;
    if (provider === 'microsoft') {
      tokens = await ssoService.exchangeMicrosoftCode(
        code,
        codeVerifier,
        providerConfig.redirectUri,
        providerConfig
      );
    } else if (provider === 'google') {
      tokens = await ssoService.exchangeGoogleCode(
        code,
        codeVerifier,
        providerConfig.redirectUri,
        providerConfig
      );
    }

    // Get user information from IdP
    let idpUserInfo;
    if (provider === 'microsoft') {
      idpUserInfo = await ssoService.getMicrosoftUserInfo(tokens.accessToken);
      // Verify ID token if present
      if (tokens.idToken) {
        const verifiedToken = await ssoService.verifyMicrosoftIdToken(
          tokens.idToken,
          providerConfig
        );
        // Merge verified token claims with user info
        idpUserInfo = { ...idpUserInfo, ...verifiedToken };
      }
    } else if (provider === 'google') {
      idpUserInfo = await ssoService.getGoogleUserInfo(tokens.accessToken);
      // Verify ID token if present
      if (tokens.idToken) {
        const verifiedToken = await ssoService.verifyGoogleIdToken(
          tokens.idToken,
          providerConfig
        );
        // Merge verified token claims with user info
        idpUserInfo = { ...idpUserInfo, ...verifiedToken };
      }
    }

    // Validate email matches
    if (idpUserInfo.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'Email mismatch between OAuth state and IdP response'
      });
    }

    // Find or create user
    const user = await ssoService.findOrCreateUser(
      organizationId,
      idpUserInfo,
      provider,
      ssoConfig
    );

    // Create SSO authentication record
    const ssoAuth = await ssoService.createSSOAuth(
      organizationId,
      user._id,
      provider,
      tokens,
      idpUserInfo,
      state,
      oauthState.nonce,
      codeVerifier,
      req
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        organization: user.organization,
        role: user.role,
        ssoSessionId: ssoAuth._id,
        provider: provider
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Clear OAuth state from session
    delete req.session.oauthState;

    // Determine redirect URL based on platform
    // PRIORITY: Use stored platform from OAuth state (most reliable)
    // FALLBACK: Check User-Agent (less reliable since browser redirects from IdP)
    const storedPlatform = oauthState?.platform || 'web';
    const userAgent = req.get('User-Agent') || '';
    const isMobileUserAgent = /Mobile|Android|iPhone|iPad|okhttp/i.test(userAgent);
    
    // CRITICAL: Always prioritize stored platform over User-Agent
    // When IdP redirects back, User-Agent will be browser, not mobile app
    const isMobile = storedPlatform === 'mobile';
    
    console.log('=== SSO REDIRECT DETECTION ===');
    console.log('🔍 OAuth State Platform (PRIMARY):', storedPlatform);
    console.log('🔍 User-Agent (SECONDARY):', userAgent);
    console.log('🔍 Is Mobile User-Agent:', isMobileUserAgent);
    console.log('🔍 Final Decision - Is Mobile:', isMobile);
    console.log('🔍 Platform check - storedPlatform === "mobile":', storedPlatform === 'mobile');
    console.log('🔍 OAuth State Object:', JSON.stringify(oauthState, null, 2));
    
    let redirectUrl;
    if (isMobile) {
      // Redirect to mobile app custom URL scheme
      redirectUrl = `staffbridge://sso-callback?token=${encodeURIComponent(token)}`;
      console.log('=== SSO REDIRECT (MOBILE) ===');
      console.log('Redirect URL:', redirectUrl);
      console.log('✅ Redirecting to mobile app');
    } else {
      // Redirect to web frontend
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      redirectUrl = `${frontendUrl}/sso-callback?token=${encodeURIComponent(token)}`;
      console.log('=== SSO REDIRECT (WEB) ===');
      console.log('Frontend URL:', frontendUrl);
      console.log('Redirect URL:', redirectUrl);
      console.log('⚠️ Redirecting to web (platform was:', storedPlatform, ')');
    }
    
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
    console.log('Final redirect URL:', redirectUrl);
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('SSO callback error:', error);
    
    // Clear OAuth state from session
    delete req.session.oauthState;
    
    // Determine redirect URL based on platform
    const userAgent = req.get('User-Agent') || '';
    const isMobileUserAgent = /Mobile|Android|iPhone|iPad|okhttp/i.test(userAgent);
    const errorMessage = encodeURIComponent(error.message);
    
    let errorUrl;
    if (isMobileUserAgent) {
      // For mobile, redirect to app with error (if app can handle it)
      // Or redirect to web with error message
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      errorUrl = `${frontendUrl}/login?error=${errorMessage}`;
    } else {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      errorUrl = `${frontendUrl}/login?error=${errorMessage}`;
    }
    
    res.redirect(errorUrl);
  }
};

/**
 * Get SSO configuration for the current user's organization
 */
exports.getSSOConfig = async (req, res) => {
  try {
    // Support both routes: /config and /config/:organizationId
    let organizationId = req.params.organizationId || req.user.organization;

    // Get the ORIGINAL SSO configuration (not the Teams configuration)
    let ssoConfig = await SSOConfig.findOne({ organization: organizationId });

    // If not exists, return default empty config
    if (!ssoConfig) {
      // Return a default config structure expected by the frontend
      return res.json({
        success: true,
        data: {
          ssoOnly: false,
          providers: [],
          breakGlassAdmin: null,
          lastSsoLogin: undefined,
          ssoLoginCount: 0
        }
      });
    }

    // Don't return sensitive data like clientSecret
    const configData = ssoConfig.toObject();
    if (configData.providers) {
      configData.providers = configData.providers.map((provider) => {
        const providerCopy = { ...provider };
        if (providerCopy.clientSecret) {
          delete providerCopy.clientSecret;
        }
        return providerCopy;
      });
    }

    res.json({
      success: true,
      data: configData
    });
  } catch (error) {
    console.error('Error fetching SSO config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch SSO configuration',
      error: error.message
    });
  }
};

/**
 * Get full Teams integration configuration (for settings page)
 * Used by Teams Integration Settings page
 */
exports.getTeamsConfig = async (req, res) => {
  try {
    const organizationId = req.user.organization;

    const ssoConfig = await SSOConfiguration.getForOrganization(organizationId);

    if (!ssoConfig) {
      return res.json({
        success: true,
        data: {
          enableTeamsIntegration: false,
          teamsCallMode: 'deeplink',
          enableEmailIntegration: false,
          azureEntraId: {
            enabled: false,
            tenantId: '',
            clientId: '',
            redirectUri: ''
          }
        }
      });
    }

    // Return config without secrets
    const configData = ssoConfig.toObject();
    if (configData.azureEntraId && configData.azureEntraId.clientSecret) {
      delete configData.azureEntraId.clientSecret;
    }

    res.json({
      success: true,
      data: configData
    });
  } catch (error) {
    console.error('Error fetching Teams config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch Teams configuration',
      error: error.message
    });
  }
};

/**
 * Check if Teams integration is enabled
 * Used by frontend to conditionally display Teams icon
 */
exports.checkTeamsIntegration = async (req, res) => {
  try {
    const organizationId = req.user.organization;

    const ssoConfig = await SSOConfiguration.getForOrganization(organizationId);

    if (!ssoConfig) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          azureEntraIdEnabled: false,
          teamsCallMode: 'deeplink',
          emailIntegrationEnabled: false
        }
      });
    }

    res.json({
      success: true,
      data: {
        enabled: ssoConfig.enableTeamsIntegration,
        azureEntraIdEnabled: ssoConfig.isAzureEntraIdEnabled(),
        teamsCallMode: ssoConfig.teamsCallMode,
        emailIntegrationEnabled: ssoConfig.enableEmailIntegration
      }
    });
  } catch (error) {
    console.error('Error checking Teams integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check Teams integration',
      error: error.message
    });
  }
};

/**
 * Update SSO configuration (admin only)
 */
exports.updateSSOConfig = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can update SSO configuration.'
      });
    }

    const organizationId = req.user.organization;
    const { azureEntraId, enableTeamsIntegration, teamsCallMode, enableEmailIntegration } = req.body;

    // Validate input
    if (azureEntraId && azureEntraId.enabled) {
      if (!azureEntraId.tenantId || !azureEntraId.clientId) {
        return res.status(400).json({
          success: false,
          message: 'Azure Entra ID tenant ID and client ID are required when enabling'
        });
      }
    }

    if (teamsCallMode && !['deeplink', 'teams_app', 'teams_web'].includes(teamsCallMode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Teams call mode'
      });
    }

    let ssoConfig = await SSOConfiguration.getForOrganization(organizationId);

    if (!ssoConfig) {
      ssoConfig = new SSOConfiguration({
        organization: organizationId
      });
    }

    // Update Azure Entra ID configuration
    if (azureEntraId) {
      ssoConfig.azureEntraId = {
        ...ssoConfig.azureEntraId,
        ...azureEntraId,
        configuredAt: new Date(),
        configuredBy: req.user._id
      };
    }

    // Update Teams integration settings
    if (typeof enableTeamsIntegration === 'boolean') {
      ssoConfig.enableTeamsIntegration = enableTeamsIntegration;
    }

    if (teamsCallMode) {
      ssoConfig.teamsCallMode = teamsCallMode;
    }

    // Update email integration settings
    if (typeof enableEmailIntegration === 'boolean') {
      ssoConfig.enableEmailIntegration = enableEmailIntegration;
    }

    ssoConfig.updatedBy = req.user._id;
    await ssoConfig.save();

    // Return config without secrets
    const configData = ssoConfig.toObject();
    if (configData.azureEntraId && configData.azureEntraId.clientSecret) {
      delete configData.azureEntraId.clientSecret;
    }

    res.json({
      success: true,
      message: 'SSO configuration updated successfully',
      data: configData
    });
  } catch (error) {
    console.error('Error updating SSO config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update SSO configuration',
      error: error.message
    });
  }
};

/**
 * Test Azure Entra ID connection (admin only)
 */
exports.testAzureConnection = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can test connections.'
      });
    }

    const { tenantId, clientId } = req.body;

    // Basic validation
    if (!tenantId || !clientId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID and Client ID are required'
      });
    }

    // Simulate connection test (in production, actually make Azure API call)
    // For now, just validate the format
    const tenantIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const clientIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!tenantIdRegex.test(tenantId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Tenant ID format. Expected UUID.'
      });
    }

    if (!clientIdRegex.test(clientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Client ID format. Expected UUID.'
      });
    }

    res.json({
      success: true,
      message: 'Azure configuration appears to be valid',
      data: {
        tenantId: tenantId,
        clientId: clientId
      }
    });
  } catch (error) {
    console.error('Error testing Azure connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test Azure connection',
      error: error.message
    });
  }
};

/**
 * Test SSO connection for a provider
 */
exports.testSSOConnection = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { provider } = req.body;

    // Check if user has admin access to this organization
    if (req.user.organization._id.toString() !== organizationId || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to test SSO connection'
      });
    }

    const result = await ssoService.testConnection(organizationId, provider);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Test SSO connection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test SSO connection'
    });
  }
};

/**
 * Refresh SSO access token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken, provider } = req.body;
    const organizationId = req.user.organization;

    if (!refreshToken || !provider) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token and provider are required'
      });
    }

    const result = await ssoService.refreshAccessToken(refreshToken, provider, organizationId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Failed to refresh token'
    });
  }
};

/**
 * Revoke SSO session
 */
exports.revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const organizationId = req.user.organization;

    await ssoService.revokeSession(sessionId, organizationId);
    
    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to revoke session'
    });
  }
};

/**
 * Get SSO sessions for current user
 */
exports.getUserSessions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const organizationId = req.user.organization;

    const sessions = await SSOAuth.find({
      user: userId,
      organization: organizationId,
      isActive: true
    }).select('-accessToken -refreshToken -idToken -codeVerifier');

    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user sessions'
    });
  }
};

/**
 * Break-glass local admin login (when SSO is down)
 */
exports.breakGlassLogin = async (req, res) => {
  try {
    const { email, password, organizationId } = req.body;

    if (!email || !password || !organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and organization ID are required'
      });
    }

    // Get SSO configuration
    const ssoConfig = await SSOConfig.findOne({ organization: organizationId });
    if (!ssoConfig || !ssoConfig.breakGlassAdmin.enabled) {
      return res.status(400).json({
        success: false,
        message: 'Break-glass login is not enabled for this organization'
      });
    }

    // Check if this is the break-glass admin
    if (email !== ssoConfig.breakGlassAdmin.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid break-glass credentials'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, ssoConfig.breakGlassAdmin.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid break-glass credentials'
      });
    }

    // Get organization
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: 'break-glass-admin',
        email: email,
        organization: organizationId,
        role: 'admin',
        isBreakGlass: true
      },
      JWT_SECRET,
      { expiresIn: '1h' } // Shorter expiry for break-glass access
    );

    res.json({
      success: true,
      message: 'Break-glass login successful',
      data: {
        token,
        user: {
          email: email,
          role: 'admin',
          organization: {
            id: organization._id,
            name: organization.name
          }
        }
      }
    });
  } catch (error) {
    console.error('Break-glass login error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process break-glass login'
    });
  }
};

/**
 * Setup break-glass admin account
 */
exports.setupBreakGlassAdmin = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { email, password } = req.body;

    // Check if user has admin access to this organization
    if (req.user.organization._id.toString() !== organizationId || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required to setup break-glass admin'
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update SSO configuration
    await SSOConfig.findOneAndUpdate(
      { organization: organizationId },
      {
        $set: {
          'breakGlassAdmin.email': email,
          'breakGlassAdmin.password': hashedPassword,
          'breakGlassAdmin.enabled': true
        }
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message: 'Break-glass admin account setup successfully'
    });
  } catch (error) {
    console.error('Setup break-glass admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup break-glass admin account'
    });
  }
};







