import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { User, AuthState, AuthAction } from '../types/auth';
import apiService from '../services/api';
import { Alert } from 'react-native';

interface AuthContextType {
  state: AuthState;
  login: (email: string, password: string) => Promise<void>;
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
        console.log('AuthContext: Dispatching AUTH_SUCCESS');
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, token },
        });
      } else {
        console.log('AuthContext: Dispatching AUTH_LOGOUT (no token or userData)');
        dispatch({ type: 'AUTH_LOGOUT' });
      }
    } catch (error) {
      console.error('AuthContext: Error loading stored auth:', error);
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'AUTH_START' });
      console.log('AuthContext: Attempting login for:', email);
      const data = await apiService.login(email, password);
      console.log('AuthContext: Login response:', data);
      if (data.success) {
        const user = data.user;
        // Map fullName to firstName and lastName if needed
        if (user.fullName && (!user.firstName || !user.lastName)) {
          const [firstName, ...rest] = user.fullName.split(' ');
          user.firstName = firstName;
          user.lastName = rest.join(' ');
        }
        await Promise.all([
          SecureStore.setItemAsync('auth_token', data.token),
          AsyncStorage.setItem('user_data', JSON.stringify(user)),
        ]);
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, token: data.token },
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
      const errorMessage = error.response?.data?.message || error.message || 'Login failed';
      console.error('AuthContext: Login error:', {
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data,
        fullError: error
      });
      dispatch({
        type: 'AUTH_FAILURE',
        payload: errorMessage,
      });
      Alert.alert('Login Failed', errorMessage);
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