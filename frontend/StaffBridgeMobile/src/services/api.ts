import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// API Configuration
const API_BASE_URL = 'http://10.0.2.2:5000/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        const token = await SecureStore.getItemAsync('auth_token');
        console.log('Using token:', token); // Debug log
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = await SecureStore.getItemAsync('refresh_token');
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken,
              });

              const { token, refreshToken: newRefreshToken } = response.data;
              await Promise.all([
                SecureStore.setItemAsync('auth_token', token),
                SecureStore.setItemAsync('refresh_token', newRefreshToken),
              ]);

              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.api(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            await this.logout();
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async logout() {
    await Promise.all([
      SecureStore.deleteItemAsync('auth_token'),
      SecureStore.deleteItemAsync('refresh_token'),
      AsyncStorage.removeItem('user_data'),
    ]);
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.api.post('/mobile/login', { email, password });
    return response.data;
  }

  async logoutUser() {
    await this.api.post('/auth/logout');
    await this.logout();
  }

  async getProfile() {
    const response = await this.api.get('/auth/profile');
    return response.data;
  }

  async updateProfile(data: any) {
    const response = await this.api.put('/auth/profile', data);
    return response.data;
  }

  // Attendance endpoints
  async checkIn(location: { latitude: number; longitude: number }) {
    try {
      const response = await this.api.post('/attendance/checkin', location);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Check-in failed');
    }
  }

  async checkOut() {
    try {
      const response = await this.api.post('/attendance/checkout');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Check-out failed');
    }
  }

  async getTodayAttendance() {
    try {
      const response = await this.api.get('/attendance/today');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch today\'s attendance');
    }
  }

  async getAttendanceHistory(params?: { startDate?: string; endDate?: string }) {
    const response = await this.api.get('/attendance/history', { params });
    return response.data;
  }

  async getAttendanceReport(params?: { month?: string; year?: string }) {
    const response = await this.api.get('/attendance/report', { params });
    return response.data;
  }

  // Leave endpoints
  async requestLeave(data: {
    type: string;
    startDate: string;
    endDate: string;
    reason: string;
    documents?: string[];
  }) {
    const response = await this.api.post('/leave/request', data);
    return response.data;
  }

  async getLeaveRequests(params?: { status?: string }) {
    const response = await this.api.get('/leave/requests', { params });
    return response.data;
  }

  async getLeaveHistory() {
    const response = await this.api.get('/leave/my');
    return response.data;
  }

  async cancelLeaveRequest(id: string) {
    const response = await this.api.delete(`/leave/requests/${id}`);
    return response.data;
  }

  // Payroll endpoints
  async getPayslips(params?: { month?: string; year?: string }) {
    const response = await this.api.get('/payroll/payslips', { params });
    return response.data;
  }

  async getPayslip(id: string) {
    const response = await this.api.get(`/payroll/payslips/${id}`);
    return response.data;
  }

  async getPayrollSummary(params?: { year?: string }) {
    const response = await this.api.get('/payroll/summary', { params });
    return response.data;
  }

  // Bulletin endpoints
  async getBulletins(params?: { page?: number; limit?: number }) {
    const response = await this.api.get('/bulletin', { params });
    return response.data;
  }

  async getBulletin(id: string) {
    const response = await this.api.get(`/bulletin/${id}`);
    return response.data;
  }

  // Document endpoints
  async getDocuments(params?: { type?: string; page?: number; limit?: number }) {
    const response = await this.api.get('/documents', { params });
    return response.data;
  }

  async uploadDocument(data: FormData) {
    const response = await this.api.post('/documents/upload', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async downloadDocument(id: string) {
    const response = await this.api.get(`/documents/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  }

  async deleteDocument(id: string) {
    const response = await this.api.delete(`/documents/${id}`);
    return response.data;
  }

  // Training endpoints
  async getTrainingRequests(params?: { status?: string }) {
    const response = await this.api.get('/training-requests', { params });
    return response.data;
  }

  async submitTrainingRequest(data: {
    title: string;
    description: string;
    type: string;
    priority: string;
    expectedDate: string;
  }) {
    const response = await this.api.post('/training-requests', data);
    return response.data;
  }

  async updateTrainingRequest(id: string, data: any) {
    const response = await this.api.put(`/training-requests/${id}`, data);
    return response.data;
  }

  // Performance endpoints
  async getPerformanceEvaluations(params?: { year?: string }) {
    const response = await this.api.get('/performance-evaluations', { params });
    return response.data;
  }

  async getPerformanceEvaluation(id: string) {
    const response = await this.api.get(`/performance-evaluations/${id}`);
    return response.data;
  }

  async submitPerformanceReflection(id: string, data: { reflection: string }) {
    const response = await this.api.post(`/performance-evaluations/${id}/reflection`, data);
    return response.data;
  }

  // Notification endpoints
  async getNotifications(params?: { page?: number; limit?: number }) {
    const response = await this.api.get('/notifications', { params });
    return response.data;
  }

  async markNotificationAsRead(id: string) {
    const response = await this.api.put(`/notifications/${id}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.api.put('/notifications/read-all');
    return response.data;
  }

  async getNotificationCount() {
    const response = await this.api.get('/notifications/count');
    return response.data;
  }

  // File upload helper
  async uploadFile(file: any, type: 'document' | 'profile' | 'attendance') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    const response = await this.api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // Peer Recognitions endpoints
  async getPeerRecognitions(limit: number = 3) {
    const response = await this.api.get('/recognitions', { params: { status: 'approved' } });
    // Sort and limit client-side in case backend does not support limit param
    return Array.isArray(response.data)
      ? response.data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit)
      : [];
  }
}

export default new ApiService(); 