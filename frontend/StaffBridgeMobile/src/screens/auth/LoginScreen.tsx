import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Title,
  Paragraph,
  HelperText,
  Divider,
} from 'react-native-paper';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import apiService from '../../services/api';

interface SSOProvider {
  provider: 'microsoft' | 'google';
  name: string;
}

interface SSODiscovery {
  organization: {
    id: string;
    name: string;
    plan?: string;
  };
  availableProviders: SSOProvider[];
  ssoOnly: boolean;
}

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // SSO state
  const [showSSOFlow, setShowSSOFlow] = useState(false);
  const [ssoEmail, setSsoEmail] = useState('');
  const [isDiscoveringSSO, setIsDiscoveringSSO] = useState(false);
  const [ssoDiscovery, setSsoDiscovery] = useState<SSODiscovery | null>(null);
  const [isSSOLoading, setIsSSOLoading] = useState(false);
  const [ssoError, setSsoError] = useState('');

  const { login, loginWithSSO } = useAuth();
  const { theme } = useTheme();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Discover SSO providers when SSO email changes
  const discoverSSO = useCallback(async (emailValue: string) => {
    if (!emailValue || !validateEmail(emailValue)) {
      setSsoDiscovery(null);
      setSsoError('');
      return;
    }

    setIsDiscoveringSSO(true);
    setSsoError('');
    try {
      console.log('[SSO Discovery] Checking SSO for email:', emailValue);
      const discovery = await apiService.discoverSSOOrganization(emailValue);
      console.log('[SSO Discovery] Full Response:', JSON.stringify(discovery, null, 2));
      
      // Check if discovery was successful
      if (discovery?.success === true && discovery?.data?.availableProviders?.length > 0) {
        console.log('[SSO Discovery] ✅ Found providers:', discovery.data.availableProviders);
        setSsoDiscovery(discovery.data);
        setSsoError('');
      } else {
        // Handle failed discovery
        console.log('[SSO Discovery] ❌ Failed:', {
          success: discovery?.success,
          message: discovery?.message,
          error: discovery?.error,
          hasData: !!discovery?.data,
          providersCount: discovery?.data?.availableProviders?.length
        });
        setSsoDiscovery(null);
        // Show the actual error message from backend
        let errorMsg = discovery?.message || discovery?.error || 'No SSO configured for this email domain';
        
        // Special handling for authentication errors (backend misconfiguration)
        if (errorMsg.includes('Not authorized') || errorMsg.includes('no token provided')) {
          errorMsg = 'SSO discovery endpoint requires authentication. Please contact your administrator to fix the backend configuration.';
        }
        
        setSsoError(errorMsg);
      }
    } catch (error: any) {
      console.error('[SSO Discovery] Exception:', error);
      setSsoDiscovery(null);
      const errorMsg = error?.message || error.response?.data?.message || 'Unable to check SSO configuration. Please try again.';
      setSsoError(errorMsg);
    } finally {
      setIsDiscoveringSSO(false);
    }
  }, []);

  // Debounce SSO discovery
  useEffect(() => {
    if (!showSSOFlow) return;
    
    const timeoutId = setTimeout(() => {
      if (ssoEmail.trim()) {
        discoverSSO(ssoEmail.trim());
      } else {
        setSsoDiscovery(null);
        setSsoError('');
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [ssoEmail, showSSOFlow, discoverSSO]);

  const validateForm = () => {
    let isValid = true;

    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    } else {
      setEmailError('');
    }

    if (!password.trim()) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    } else {
      setPasswordError('');
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
    } catch (error) {
      Alert.alert(
        'Login Failed',
        error instanceof Error ? error.message : 'Please check your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSOFlowStart = () => {
    setShowSSOFlow(true);
    setSsoEmail('');
    setSsoDiscovery(null);
    setSsoError('');
  };

  const handleSSOFlowCancel = () => {
    setShowSSOFlow(false);
    setSsoEmail('');
    setSsoDiscovery(null);
    setSsoError('');
  };

  const handleSSOLogin = async (provider: 'microsoft' | 'google') => {
    if (!ssoEmail.trim() || !validateEmail(ssoEmail.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!ssoDiscovery?.organization?.id) {
      Alert.alert('Error', 'Unable to determine organization. Please try again.');
      return;
    }

    setIsSSOLoading(true);
    try {
      await loginWithSSO(ssoEmail.trim(), provider, ssoDiscovery.organization.id);
      // Reset SSO flow on success
      handleSSOFlowCancel();
    } catch (error) {
      console.error('SSO login error:', error);
    } finally {
      setIsSSOLoading(false);
    }
  };

  const getProviderIcon = (provider: 'microsoft' | 'google') => {
    return provider === 'microsoft' ? 'microsoft' : 'google';
  };

  const getProviderName = (provider: 'microsoft' | 'google') => {
    return provider === 'microsoft' ? 'Microsoft Entra ID' : 'Google Workspace';
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={{ uri: 'https://www.stfbridge.com/assets/sb-icon-gradient-BVLAXyhA.png' }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Title style={[styles.title, { color: theme.colors.primary }]}>
            Welcome Back
          </Title>
          <Paragraph style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Sign in to your StaffBridge account
          </Paragraph>
        </View>

        <Card style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Card.Content style={styles.cardContent}>
            {/* SSO Flow */}
            {showSSOFlow ? (
              <View>
                <Text style={[styles.ssoTitle, { color: theme.colors.primary }]}>
                  Sign in with SSO
                </Text>
                <Paragraph style={[styles.ssoSubtitle, { color: theme.colors.textSecondary }]}>
                  Enter your work email to continue
                </Paragraph>

                <TextInput
                  label="Email Address"
                  value={ssoEmail}
                  onChangeText={(text) => {
                    setSsoEmail(text);
                    setSsoError('');
                  }}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  theme={theme}
                  right={
                    isDiscoveringSSO ? (
                      <TextInput.Icon icon={() => <ActivityIndicator size="small" color={theme.colors.primary} />} />
                    ) : undefined
                  }
                />

                {ssoError && (
                  <HelperText type="error" visible={!!ssoError}>
                    {ssoError}
                  </HelperText>
                )}

                {/* SSO Providers */}
                {ssoDiscovery && ssoDiscovery.availableProviders.length > 0 && (
                  <View style={styles.ssoProvidersContainer}>
                    {ssoDiscovery.availableProviders.map((provider) => (
                      <Button
                        key={provider.provider}
                        mode="contained"
                        onPress={() => handleSSOLogin(provider.provider)}
                        disabled={isSSOLoading || isDiscoveringSSO}
                        loading={isSSOLoading}
                        style={[styles.ssoProviderButton, { backgroundColor: theme.colors.primary }]}
                        contentStyle={styles.ssoProviderButtonContent}
                        icon={getProviderIcon(provider.provider)}
                        theme={theme}
                      >
                        Continue with {getProviderName(provider.provider)}
                      </Button>
                    ))}
                  </View>
                )}

                {/* Back button */}
                <Button
                  mode="text"
                  onPress={handleSSOFlowCancel}
                  style={styles.backButton}
                  theme={theme}
                >
                  Back to email/password login
                </Button>
              </View>
            ) : (
              /* Regular Login Flow */
              <View>
                {/* SSO Button - Prominent */}
                <Button
                  mode="contained"
                  onPress={handleSSOFlowStart}
                  style={[styles.ssoMainButton, { backgroundColor: theme.colors.primary }]}
                  contentStyle={styles.ssoMainButtonContent}
                  icon="shield-check"
                  theme={theme}
                >
                  Sign in with SSO
                </Button>

                <View style={styles.dividerContainer}>
                  <Divider style={styles.divider} />
                  <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>
                    Or continue with email
                  </Text>
                  <Divider style={styles.divider} />
                </View>

                <TextInput
                  label="Email Address"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError('');
                  }}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={!!emailError}
                  style={styles.input}
                  theme={theme}
                />
                <HelperText type="error" visible={!!emailError}>
                  {emailError}
                </HelperText>

                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError('');
                  }}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  error={!!passwordError}
                  style={styles.input}
                  theme={theme}
                />
                <HelperText type="error" visible={!!passwordError}>
                  {passwordError}
                </HelperText>

                <Button
                  mode="contained"
                  onPress={handleLogin}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.loginButton}
                  contentStyle={styles.loginButtonContent}
                  theme={theme}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textSecondary }]}>
            Having trouble signing in?
          </Text>
          <Text style={[styles.contactText, { color: theme.colors.primary }]}>
            Contact your administrator
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    marginBottom: 24,
    borderRadius: 16,
    elevation: 3,
    shadowColor: '#1A202C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardContent: {
    padding: 24,
  },
  input: {
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  loginButton: {
    marginTop: 16,
    borderRadius: 12,
    elevation: 2,
  },
  loginButtonContent: {
    paddingVertical: 8,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    marginBottom: 4,
  },
  contactText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // SSO Styles
  ssoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  ssoSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
  },
  ssoMainButton: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  ssoMainButtonContent: {
    paddingVertical: 8,
  },
  ssoProvidersContainer: {
    marginTop: 24,
    marginBottom: 16,
  },
  ssoProviderButton: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  ssoProviderButtonContent: {
    paddingVertical: 8,
  },
  backButton: {
    marginTop: 16,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  divider: {
    flex: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
  },
});

export default LoginScreen;
