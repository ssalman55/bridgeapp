import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { User, AuthState, AuthAction } from '../types/auth';
import apiService from '../services/api';
import { Alert } from 'react-native';

interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
  loginWithSSO: (email: string, provider: 'microsoft' | 'google', organizationId: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (user: Partial<User>) => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      };
    case 'UPDATE_PROFILE':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  useEffect(() => {
    console.log('AuthContext: State changed', state);
  }, [state]);

  // Helper function to decode base64 in React Native
  const base64Decode = (str: string): string => {
    try {
      // React Native compatible base64 decode
      // Base64 characters to binary conversion
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
      let output = '';
      let i = 0;
      
      str = str.replace(/[^A-Za-z0-9\+\/\=]/g, '');
      
      while (i < str.length) {
        const enc1 = chars.indexOf(str.charAt(i++));
        const enc2 = chars.indexOf(str.charAt(i++));
        const enc3 = chars.indexOf(str.charAt(i++));
        const enc4 = chars.indexOf(str.charAt(i++));
        
        const bits = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;
        
        if (enc3 === 64) {
          output += String.fromCharCode((bits >> 16) & 255);
        } else if (enc4 === 64) {
          output += String.fromCharCode((bits >> 16) & 255, (bits >> 8) & 255);
        } else {
          output += String.fromCharCode((bits >> 16) & 255, (bits >> 8) & 255, bits & 255);
        }
      }
      
      return output;
    } catch (error) {
      throw new Error('Base64 decode error');
    }
  };

  // Helper function to check if JWT token is expired
  const isTokenExpired = (token: string): boolean => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return true; // Invalid token format
      }
      
      const payload = JSON.parse(base64Decode(parts[1]));
      if (!payload.exp) {
        return false; // No expiration, assume valid
      }
      
      const exp = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      const isExpired = exp < now;
      
      if (isExpired) {
        console.log('Token expired:', { exp: new Date(exp), now: new Date(now) });
      }
      
      return isExpired;
    } catch (error) {
      console.error('Error checking token expiration:', error);
      return true; // Assume expired if we can't parse it
    }
  };

  const loadStoredAuth = async () => {
    try {
      console.log('AuthContext: Loading stored auth...');
      const [token, userData] = await Promise.all([
        SecureStore.getItemAsync('auth_token'),
        AsyncStorage.getItem('user_data'),
      ]);
      console.log('AuthContext: Token:', token, 'UserData:', userData);

      if (token && userData) {
        // Check if token is expired
        if (isTokenExpired(token)) {
          console.log('AuthContext: Token expired, clearing auth');
          await Promise.all([
            SecureStore.deleteItemAsync('auth_token'),
            AsyncStorage.removeItem('user_data'),
          ]);
          dispatch({ type: 'AUTH_LOGOUT' });
          return;
        }
        
        const user = JSON.parse(userData);
        
        // Refresh user profile to get latest data including signed URLs for profile images
        try {
          const profileResponse = await apiService.getProfile();
          if (profileResponse?.success && profileResponse?.data?.user) {
            console.log('AuthContext: Refreshed user profile on load with signed URL:', profileResponse.data.user.profileImage?.substring(0, 50));
            const refreshedUser = normalizeUser(profileResponse.data.user);
            await AsyncStorage.setItem('user_data', JSON.stringify(refreshedUser));
            console.log('AuthContext: Dispatching AUTH_SUCCESS with refreshed user');
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: { user: refreshedUser, token },
            });
          } else {
            // Fallback to stored user if refresh fails
            console.log('AuthContext: Dispatching AUTH_SUCCESS with stored user');
            dispatch({
              type: 'AUTH_SUCCESS',
              payload: { user, token },
            });
          }
        } catch (profileError) {
          console.warn('AuthContext: Could not refresh profile on load, using stored user:', profileError);
          // Use stored user data if refresh fails
          console.log('AuthContext: Dispatching AUTH_SUCCESS with stored user (refresh failed)');
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { user, token },
          });
        }
      } else {
        console.log('AuthContext: Dispatching AUTH_LOGOUT (no token or userData)');
        dispatch({ type: 'AUTH_LOGOUT' });
      }
    } catch (error) {
      console.error('AuthContext: Error loading stored auth:', error);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  // Normalize user object from backend to match mobile app format
  const normalizeUser = (backendUser: any): User => {
    // Handle id - backend may return 'id' or '_id'
    const userId = backendUser.id || backendUser._id || '';
    
    // Handle name fields
    let firstName = backendUser.firstName || '';
    let lastName = backendUser.lastName || '';
    
    // If we have fullName but not firstName/lastName, parse it
    if (backendUser.fullName && (!firstName || !lastName)) {
      const nameParts = backendUser.fullName.trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    
    // Handle organization - backend returns object, mobile expects string or object
    const organization = backendUser.organization?._id 
      ? backendUser.organization._id.toString()
      : backendUser.organization || '';
    
    // Normalize user object
    return {
      id: userId.toString(),
      _id: userId.toString(), // Keep _id for compatibility
      email: backendUser.email || '',
      firstName: firstName,
      lastName: lastName,
      role: backendUser.role || 'staff',
      department: backendUser.department || '',
      position: backendUser.position || '',
      employeeId: backendUser.employeeId || '',
      phoneNumber: backendUser.phoneNumber || backendUser.phone,
      profilePicture: backendUser.profileImage || backendUser.profilePicture,
      permissions: backendUser.permissions || [],
      isActive: backendUser.status === 'active' || backendUser.isActive || true,
      createdAt: backendUser.createdAt || new Date().toISOString(),
      updatedAt: backendUser.updatedAt || new Date().toISOString(),
      organization: organization,
      // Include raw organization object for reference
      organizationObj: backendUser.organization
    } as User;
  };

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'AUTH_START' });
      console.log('AuthContext: Attempting login for:', email);
      
      // Test connectivity first
      console.log('AuthContext: Testing backend connectivity...');
      const isReachable = await apiService.testConnection();
      if (!isReachable) {
        console.warn('AuthContext: Backend server appears unreachable');
      } else {
        console.log('AuthContext: Backend server is reachable');
      }
      
      const data = await apiService.login(email, password);
      console.log('AuthContext: Login response:', data);
      if (data.success) {
        // After login, fetch full user profile to get signed URL for profile image
        let userWithSignedUrl = data.user;
        try {
          const profileResponse = await apiService.getProfile();
          if (profileResponse?.success && profileResponse?.data?.user) {
            console.log('AuthContext: Fetched user profile with signed URL:', profileResponse.data.user);
            userWithSignedUrl = profileResponse.data.user;
          }
        } catch (profileError) {
          console.warn('AuthContext: Could not fetch user profile, using login response:', profileError);
          // Continue with login response user data
        }
        
        // Normalize user object from backend response (may have signed URL now)
        const normalizedUser = normalizeUser(userWithSignedUrl);
        
        console.log('AuthContext: Normalized user:', normalizedUser);
        console.log('AuthContext: Profile image value:', normalizedUser.profilePicture || normalizedUser.profileImage);
        
        await Promise.all([
          SecureStore.setItemAsync('auth_token', data.token),
          AsyncStorage.setItem('user_data', JSON.stringify(normalizedUser)),
        ]);
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user: normalizedUser, token: data.token },
        });
        Alert.alert('Login Successful', 'Welcome back!');
      } else {
        dispatch({
          type: 'AUTH_FAILURE',
          payload: data.message || 'Login failed',
        });
        Alert.alert('Login Failed', data.message || 'Login failed');
      }
    } catch (error: any) {
      let errorMessage = error.response?.data?.message || error.message || 'Login failed';
      const status = error.response?.status;
      const isNetworkError = error.isNetworkError || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED' || !status;
      
      // Handle network errors with user-friendly messages
      if (isNetworkError) {
        errorMessage = 'Unable to connect to server. Please check your internet connection and try again. If the problem persists, the server may be temporarily unavailable.';
      }
      
      // Use console.warn for expected errors (401, 400) to avoid showing them as critical errors
      // Only use console.error for unexpected server errors (500+) and network errors
      if (status && status >= 500) {
        console.error('AuthContext: Server error during login:', {
          message: errorMessage,
          status: status,
          code: error.code,
        });
      } else if (isNetworkError) {
        console.error('AuthContext: Network error during login:', {
          message: errorMessage,
          code: error.code,
          url: error.config?.url,
          baseURL: error.config?.baseURL,
        });
      } else {
        console.warn('AuthContext: Login failed:', {
          message: errorMessage,
          status: status,
        });
      }
      
      dispatch({
        type: 'AUTH_FAILURE',
        payload: errorMessage,
      });
      Alert.alert('Login Failed', errorMessage);
    }
  };

  const loginWithSSO = async (email: string, provider: 'microsoft' | 'google', organizationId: string) => {
    try {
      dispatch({ type: 'AUTH_START' });
      console.log('AuthContext: Attempting SSO login for:', email, 'with provider:', provider);
      
      // Initiate SSO flow
      const ssoData = await apiService.initiateSSO(email, provider, organizationId);
      
      if (!ssoData.success || !ssoData.data?.authUrl) {
        throw new Error('Failed to initiate SSO login');
      }

      const { authUrl } = ssoData.data;
      
      // Configure redirect URI - backend should redirect to custom scheme
      // For mobile, we use custom URL scheme: staffbridge://sso-callback
      const redirectUri = 'staffbridge://sso-callback';
      
      // Open OAuth URL in browser
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectUri
      );

      console.log('AuthContext: SSO browser result:', result);

      if (result.type === 'success' && result.url) {
        // Extract token from callback URL
        // Handle both custom scheme (staffbridge://sso-callback?token=...) 
        // and web redirect (https://domain.com/sso-callback?token=...)
        let token: string | null = null;
        
        try {
          const url = new URL(result.url);
          token = url.searchParams.get('token');
        } catch (urlError) {
          // If URL parsing fails, try manual parsing for custom schemes
          const match = result.url.match(/[?&]token=([^&]+)/);
          if (match) {
            token = decodeURIComponent(match[1]);
          }
        }
        
        if (!token) {
          throw new Error('No token received from SSO callback');
        }

        // Complete login with token
        const loginData = await apiService.completeSSOLogin(token);
        
        if (loginData.success) {
          // Fetch full user profile to get signed URL for profile image
          let userWithSignedUrl = loginData.user;
          try {
            const profileResponse = await apiService.getProfile();
            if (profileResponse?.success && profileResponse?.data?.user) {
              console.log('AuthContext: Fetched user profile with signed URL:', profileResponse.data.user);
              userWithSignedUrl = profileResponse.data.user;
            }
          } catch (profileError) {
            console.warn('AuthContext: Could not fetch user profile, using SSO response:', profileError);
          }
          
          // Normalize user object
          const normalizedUser = normalizeUser(userWithSignedUrl);
          
          await Promise.all([
            SecureStore.setItemAsync('auth_token', loginData.token),
            AsyncStorage.setItem('user_data', JSON.stringify(normalizedUser)),
          ]);
          
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: { user: normalizedUser, token: loginData.token },
          });
          
          Alert.alert('Login Successful', 'Welcome back!');
        } else {
          throw new Error('Failed to complete SSO login');
        }
      } else if (result.type === 'cancel') {
        dispatch({ type: 'AUTH_FAILURE', payload: 'SSO login cancelled' });
        Alert.alert('Login Cancelled', 'You cancelled the SSO login process.');
      } else {
        throw new Error('SSO authentication failed');
      }
    } catch (error: any) {
      console.error('AuthContext: SSO login error:', error);
      const errorMessage = error.message || 'SSO login failed. Please try again.';
      dispatch({
        type: 'AUTH_FAILURE',
        payload: errorMessage,
      });
      Alert.alert('SSO Login Failed', errorMessage);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('auth_token'),
        AsyncStorage.removeItem('user_data'),
      ]);
      dispatch({ type: 'AUTH_LOGOUT' });
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const updateProfile = (user: Partial<User>) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: user });
  };

  const refreshToken = async () => {
    try {
      // TODO: Implement token refresh logic
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        await SecureStore.setItemAsync('auth_token', data.token);
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user: state.user!, token: data.token },
        });
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      await logout();
    }
  };

  const value: AuthContextType = {
    state,
    login,
    loginWithSSO,
    logout,
    updateProfile,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 