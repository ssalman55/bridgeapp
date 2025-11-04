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
  const [isDiscoveringSSO, setIsDiscoveringSSO] = useState(false);
  const [ssoDiscovery, setSsoDiscovery] = useState<SSODiscovery | null>(null);
  const [isSSOLoading, setIsSSOLoading] = useState(false);

  const { login, loginWithSSO } = useAuth();
  const { theme } = useTheme();

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Discover SSO providers when email changes
  const discoverSSO = useCallback(async (emailValue: string) => {
    if (!emailValue || !validateEmail(emailValue)) {
      setSsoDiscovery(null);
      return;
    }

    setIsDiscoveringSSO(true);
    try {
      console.log('[SSO Discovery] Checking SSO for email:', emailValue);
      const discovery = await apiService.discoverSSOOrganization(emailValue);
      console.log('[SSO Discovery] Response:', discovery);
      
      if (discovery?.success && discovery?.data?.availableProviders?.length > 0) {
        console.log('[SSO Discovery] Found providers:', discovery.data.availableProviders);
        setSsoDiscovery(discovery.data);
      } else {
        console.log('[SSO Discovery] No providers found or SSO not configured');
        setSsoDiscovery(null);
      }
    } catch (error: any) {
      // SSO not configured for this organization, which is fine
      console.log('[SSO Discovery] Error (this is normal if SSO not configured):', 
        error.response?.status, 
        error.response?.data?.message || error.message
      );
      setSsoDiscovery(null);
    } finally {
      setIsDiscoveringSSO(false);
    }
  }, []);

  // Debounce SSO discovery
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (email.trim()) {
        discoverSSO(email.trim());
      } else {
        setSsoDiscovery(null);
      }
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [email, discoverSSO]);

  const validateForm = () => {
    let isValid = true;

    // Validate email
    if (!email.trim()) {
      setEmailError('Email is required');
      isValid = false;
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      isValid = false;
    } else {
      setEmailError('');
    }

    // Validate password
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

  const handleSSOLogin = async (provider: 'microsoft' | 'google') => {
    if (!email.trim() || !validateEmail(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address first.');
      return;
    }

    if (!ssoDiscovery?.organization?.id) {
      Alert.alert('Error', 'Unable to determine organization. Please try again.');
      return;
    }

    setIsSSOLoading(true);
    try {
      await loginWithSSO(email.trim(), provider, ssoDiscovery.organization.id);
    } catch (error) {
      // Error is already handled in AuthContext
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
              right={
                isDiscoveringSSO ? (
                  <TextInput.Icon icon={() => <ActivityIndicator size="small" color={theme.colors.primary} />} />
                ) : undefined
              }
            />
            <HelperText type="error" visible={!!emailError}>
              {emailError}
            </HelperText>

            {/* SSO Providers Section */}
            {ssoDiscovery && ssoDiscovery.availableProviders.length > 0 && (
              <View style={styles.ssoSection}>
                {ssoDiscovery.availableProviders.map((provider) => (
                  <Button
                    key={provider.provider}
                    mode="outlined"
                    onPress={() => handleSSOLogin(provider.provider)}
                    disabled={isSSOLoading || isLoading}
                    loading={isSSOLoading && provider.provider === ssoDiscovery.availableProviders[0]?.provider}
                    style={styles.ssoButton}
                    contentStyle={styles.ssoButtonContent}
                    icon={getProviderIcon(provider.provider)}
                    theme={theme}
                  >
                    Sign in with {getProviderName(provider.provider)}
                  </Button>
                ))}
                {!ssoDiscovery.ssoOnly && (
                  <>
                    <View style={styles.dividerContainer}>
                      <Divider style={styles.divider} />
                      <Text style={[styles.dividerText, { color: theme.colors.textSecondary }]}>
                        Or continue with email
                      </Text>
                      <Divider style={styles.divider} />
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Debug info - Remove in production */}
            {__DEV__ && email.trim() && (
              <HelperText type="info" visible={true} style={styles.debugInfo}>
                {isDiscoveringSSO 
                  ? 'Checking for SSO...' 
                  : ssoDiscovery 
                    ? `SSO found: ${ssoDiscovery.availableProviders.length} provider(s)` 
                    : 'No SSO configured for this email domain'}
              </HelperText>
            )}

            {(!ssoDiscovery || !ssoDiscovery.ssoOnly) && (
              <>
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
                  disabled={isLoading || isSSOLoading}
                  style={styles.loginButton}
                  contentStyle={styles.loginButtonContent}
                  theme={theme}
                >
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Button>
              </>
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
    borderRadius: 16, // More rounded corners for elegant look
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
    borderRadius: 12, // More rounded button
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
  ssoSection: {
    marginBottom: 16,
  },
  ssoButton: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  ssoButtonContent: {
    paddingVertical: 8,
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
  debugInfo: {
    marginTop: 8,
    fontSize: 12,
  },
});

export default LoginScreen; 