import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface OrganizationData {
  _id: string;
  name: string;
}

interface UserData {
  _id: string;
  email: string;
  fullName: string;
  role: string;
  department?: string;
  organization: OrganizationData;
}

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

interface AuthContextType {
  user: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const isValidUserData = (data: any): data is UserData => {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data._id === 'string' &&
      typeof data.email === 'string' &&
      typeof data.fullName === 'string' &&
      typeof data.role === 'string' &&
      typeof data.organization === 'object' &&
      data.organization !== null &&
      typeof data.organization._id === 'string' &&
      typeof data.organization.name === 'string'
    );
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const response = await api.get('/auth/me');
      if (response.data.success && response.data.data?.user) {
        const userData = response.data.data.user;
        if (isValidUserData(userData)) {
          setUser(userData);
        } else {
          throw new Error('Invalid user data structure');
        }
      } else {
        throw new Error('Invalid user data received');
      }
    } catch (error: any) {
      // Only clear token and logout on 401/403
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('token');
        localStorage.removeItem('organizationId');
        setUser(null);
      } else {
        // For 404 or other errors, do not clear token, just log
        console.error('Auth check error:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const loginData = response.data;
      
      console.log('Login response:', loginData);
      
      if (!loginData.success) {
        throw new Error(loginData.message || 'Login failed');
      }

      if (!loginData.token || !isValidUserData(loginData.user)) {
        console.log('Invalid user data:', loginData.user);
        throw new Error('Invalid login response structure');
      }

      // Store both token and organization ID
      localStorage.setItem('token', loginData.token);
      if (loginData.user.organization?._id) {
        localStorage.setItem('organizationId', loginData.user.organization._id);
      }
      setUser(loginData.user);
    } catch (error: any) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.message || 'An error occurred during login';
      localStorage.removeItem('token');
      localStorage.removeItem('organizationId');
      setUser(null);
      throw new Error(errorMessage);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('organizationId');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      isAuthenticated: !!user,
      isAdmin: user?.role === 'admin'
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 