import axios, { AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';

// Types for API responses
interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  token: string;
  user: UserData;
}

interface OrganizationData {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

interface UserData {
  _id: string;
  email: string;
  fullName: string;
  role: string;
  organization: OrganizationData;
}

// Add error response type
interface ApiErrorResponse {
  success: boolean;
  message: string;
  error?: any;
}

// Add specific interface for staff import response
interface StaffImportResponse {
  success: boolean;
  message: string;
  importedCount?: number;
  errors?: Array<{
    row: number;
    message: string;
  }>;
}

// Use environment variable for API base URL, fallback to '/api' for local development
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000, // Increased timeout to 30 seconds for regular requests
  withCredentials: true,
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const organizationId = localStorage.getItem('organizationId');
    if (organizationId) {
      config.headers['X-Organization-ID'] = organizationId;
    }

    // Set longer timeout for file uploads
    if (config.data instanceof FormData) {
      config.timeout = 120000; // 2 minutes timeout for file uploads
      // Remove Content-Type header to let the browser set it with the boundary
      delete config.headers['Content-Type'];
    }

    // Log request details in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Request details:', {
        url: config.url,
        method: config.method,
        headers: config.headers,
        timeout: config.timeout,
        isFileUpload: config.data instanceof FormData
      });
    }
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse | LoginResponse | StaffImportResponse>) => {
    // Log successful responses in development
    if (process.env.NODE_ENV === 'development') {
      console.log('API Response:', {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        data: response.data,
        headers: response.headers,
        isStaffImport: response.config.url?.includes('/staff/import')
      });

      // Special handling for staff import
      if (response.config.url?.includes('/staff/import')) {
        const importData = response.data as StaffImportResponse;
        if (importData.importedCount !== undefined) {
          console.log(`Staff Import Summary:`, {
            importedCount: importData.importedCount,
            hasErrors: importData.errors && importData.errors.length > 0,
            errorCount: importData.errors?.length || 0
          });
        }
      }
    }
    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    // Log the error for debugging
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      isNetworkError: !error.response,
      isTimeout: error.code === 'ECONNABORTED',
      isStaffImport: error.config?.url?.includes('/staff/import')
    });

    // Special handling for staff import errors
    if (error.config?.url?.includes('/staff/import')) {
      const errorData = error.response?.data as ApiErrorResponse;
      if (errorData?.message) {
        console.error('Staff Import Error:', {
          message: errorData.message,
          details: errorData.error,
          status: error.response?.status
        });
      }
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      const isFileUpload = error.config?.data instanceof FormData;
      return Promise.reject({
        message: isFileUpload 
          ? 'File upload is taking longer than expected. Please try again or upload a smaller file.'
          : 'Request timed out. Please try again.',
        status: 408,
        data: undefined,
        isTimeout: true,
        isNetworkError: false
      });
    }

    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      const errorMessage = error.response.data?.message || 'Session expired';
      
      if (window.location.pathname !== '/login' && 
          !errorMessage.includes('token expired')) {
        localStorage.removeItem('token');
        localStorage.removeItem('organizationId');
        window.location.href = '/login';
      }
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        message: 'Network error occurred. Please check your connection and try again.',
        status: undefined,
        data: undefined,
        isNetworkError: true
      });
    }

    // Handle other errors
    return Promise.reject({
      message: error.response.data?.message || 'An unexpected error occurred',
      status: error.response.status,
      data: error.response.data,
      isNetworkError: false
    });
  }
);

// Organization-related utility functions
export const setOrganizationContext = (organizationId: string) => {
  localStorage.setItem('organizationId', organizationId);
};

export const clearOrganizationContext = () => {
  localStorage.removeItem('organizationId');
};

export const getOrganizationId = (): string | null => {
  return localStorage.getItem('organizationId');
};

// Export methods individually for better type safety
export const get = async (url: string, config = {}) => {
  return api.get(url, config);
};

export const post = async (url: string, data = {}, config = {}) => {
  return api.post(url, data, config);
};

export const put = async (url: string, data = {}, config = {}) => {
  return api.put(url, data, config);
};

export const patch = async (url: string, data = {}, config = {}) => {
  return api.patch(url, data, config);
};

export const del = async (url: string, config = {}) => {
  return api.delete(url, config);
};

// Performance Evaluation API
export const createEvaluation = (data: any) => api.post('/performance-evaluations', data);
export const updateEvaluation = (id: string, data: any) => api.put(`/performance-evaluations/${id}`, data);
export const getEvaluations = (params = {}) => api.get('/performance-evaluations', { params });
export const getEvaluationById = (id: string) => api.get(`/performance-evaluations/${id}`);
export const addStaffComment = (id: string, comment: string, goalIndex?: number) => 
  api.post(`/performance-evaluations/${id}/comment`, { comment, goalIndex });

// Peer Recognition API
export const submitRecognition = (data: { comment: string; recognized?: string }) => api.post('/recognitions', data);
export const getRecognitions = () => api.get('/recognitions');
export const approveRecognition = (id: string) => api.put(`/recognitions/${id}/approve`);
export const rejectRecognition = (id: string, adminNote?: string) => api.put(`/recognitions/${id}/reject`, { adminNote });

// Add specific staff import method
export const importStaff = async (formData: FormData) => {
  return api.post<StaffImportResponse>('/staff/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 120000, // 2 minutes timeout for file upload
  });
};

export const sendStaffResetLink = async (staffId: string) => {
  return api.post(`/staff/${staffId}/send-reset-link`);
};

export const resetPasswordWithToken = async (token: string, newPassword: string) => {
  return api.post('/auth/reset-password', { token, newPassword });
};

// Export the configured instance as default
export default {
  get,
  post,
  put,
  patch,
  delete: del,
  interceptors: api.interceptors
}; 