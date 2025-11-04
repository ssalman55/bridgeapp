import axios, { AxiosInstance, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// API Configuration
const API_BASE_URL = 'https://sbapp.onrender.com/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // Increased to 30 seconds for slow connections
      headers: {
        'Content-Type': 'application/json',
      },
      // Add adapter configuration for better network error handling
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        // Don't add token to public endpoints (login, register, SSO discovery/initiate)
        const url = config.url || '';
        const isPublicEndpoint = 
          url.includes('/mobile/login') || 
          url.includes('/auth/login') || 
          url.includes('/auth/register') ||
          url.includes('/sso/discover') ||
          url.includes('/sso/initiate') ||
          url.includes('/sso/callback') ||
          url.includes('/sso/break-glass-login');
        
        console.log('[API Interceptor] Request URL:', url, '| Is Public:', isPublicEndpoint);
        
        if (!isPublicEndpoint) {
          const token = await SecureStore.getItemAsync('auth_token');
          console.log('[API Interceptor] Using token:', token ? 'YES' : 'NO');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } else {
          console.log('[API Interceptor] Public endpoint - not adding token');
          // Explicitly remove Authorization header if present
          delete config.headers.Authorization;
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
        
        // Don't attempt token refresh for public endpoints (login/register/SSO)
        const isPublicEndpoint = 
          originalRequest.url?.includes('/mobile/login') || 
          originalRequest.url?.includes('/auth/login') || 
          originalRequest.url?.includes('/auth/register') ||
          originalRequest.url?.includes('/sso/discover') ||
          originalRequest.url?.includes('/sso/initiate') ||
          originalRequest.url?.includes('/sso/callback');

        if (error.response?.status === 401 && !originalRequest._retry && !isPublicEndpoint) {
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
            } else {
              // No refresh token, clear auth but don't auto-logout (let the UI handle it)
              await this.logout();
            }
          } catch (refreshError) {
            // Refresh failed, clear auth but don't auto-logout on public endpoints
            console.error('Token refresh failed:', refreshError);
            if (!isPublicEndpoint) {
              await this.logout();
            }
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

  // Test backend connectivity
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple health check or get endpoint
      await this.api.get('/auth/profile', { timeout: 5000 });
      return true;
    } catch (error: any) {
      // Even if auth fails, if we get a 401, the server is reachable
      return error.response?.status === 401 || error.response?.status === 403;
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    try {
      console.log('Login request:', { email, passwordLength: password?.length });
      console.log('API Base URL:', API_BASE_URL);
      
      // Try the request with extended timeout
      const response = await this.api.post('/mobile/login', { email, password }, {
        timeout: 30000,
      });
      console.log('Login response success:', response.data);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const errorCode = error.code;
      
      // Enhanced error details for network issues
      const errorDetails = {
        status: status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: errorCode, // 'ECONNABORTED', 'ERR_NETWORK', etc.
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        timeout: error.config?.timeout
      };
      
      // Check for network-specific errors
      if (errorCode === 'ERR_NETWORK' || errorCode === 'ECONNABORTED' || !status) {
        console.error('Login error (network issue):', errorDetails);
        // Create a more helpful error message
        const networkError = new Error('Unable to connect to server. Please check your internet connection and try again.');
        (networkError as any).isNetworkError = true;
        (networkError as any).code = errorCode;
        throw networkError;
      }
      
      // Use console.warn for expected client errors (4xx), console.error only for server errors (5xx)
      if (status && status >= 500) {
        console.error('Login error (server error):', errorDetails);
      } else {
        console.warn('Login error (client error):', errorDetails);
      }
      throw error;
    }
  }

  async logoutUser() {
    await this.api.post('/auth/logout');
    await this.logout();
  }

  async getProfile() {
    // Use /auth/me endpoint which returns signed URLs for profile images
    const response = await this.api.get('/auth/me');
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
      const errorMessage = error.response?.data?.message || error.message || 'Check-out failed';
      console.error('Check-out error:', {
        message: errorMessage,
        status: error.response?.status,
        data: error.response?.data
      });
      throw new Error(errorMessage);
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

  async getAttendanceStatus() {
    try {
      const response = await this.api.get('/attendance/status');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch attendance status');
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
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    documents?: string[];
    user?: string;
    organization?: string;
    status?: string;
  }) {
    const response = await this.api.post('/leave', data);
    return response.data;
  }

  async getLeaveRequests(params?: { status?: string }) {
    const response = await this.api.get('/leave/requests', { params });
    return response.data;
  }

  async getLeaveHistory() {
    const response = await this.api.get('/leave/my');
    // Backend populates leaveType as an object with { name, color, icon, documentThreshold }
    // Map to string for mobile compatibility
    const leaves = Array.isArray(response.data) ? response.data : [];
    return leaves.map((leave: any) => ({
      ...leave,
      leaveType: typeof leave.leaveType === 'object' && leave.leaveType?.name 
        ? leave.leaveType.name 
        : leave.leaveType || 'Unknown'
    }));
  }

  async cancelLeaveRequest(id: string) {
    const response = await this.api.delete(`/leave/requests/${id}`);
    return response.data;
  }

  // Leave Types endpoints
  async getActiveLeaveTypes() {
    const response = await this.api.get('/leave-types/active');
    return response.data;
  }

  async getUserLeaveBalances() {
    const response = await this.api.get('/leave-types/user-balances');
    return response.data;
  }

  // Payroll endpoints
  async getPayslips(params?: { month?: string; year?: string }) {
    const response = await this.api.get('/payroll/my', { params });
    // Map backend field names to mobile-compatible format
    // Backend salaryStructure: { basic, transport, housing, utility, bonus, reimbursements }
    // Mobile expects: { basicPay, travelAllowance, housingAllowance, utilityAllowance }
    const payslips = Array.isArray(response.data) ? response.data : [];
    return payslips.map((payslip: any) => ({
      ...payslip,
      salaryStructure: payslip.salaryStructure ? {
        ...payslip.salaryStructure,
        basicPay: payslip.salaryStructure.basic || payslip.salaryStructure.basicPay,
        travelAllowance: payslip.salaryStructure.transport || payslip.salaryStructure.travelAllowance,
        housingAllowance: payslip.salaryStructure.housing || payslip.salaryStructure.housingAllowance,
        utilityAllowance: payslip.salaryStructure.utility || payslip.salaryStructure.utilityAllowance,
        bonus: payslip.salaryStructure.bonus || payslip.bonuses || payslip.bonus,
        reimbursements: payslip.salaryStructure.reimbursements || payslip.reimbursements
      } : payslip.salaryStructure
    }));
  }

  async getPayslip(id: string) {
    const response = await this.api.get(`/payroll/${id}/payslip`);
    // Map backend field names to mobile-compatible format
    const payslip = response.data;
    if (payslip && payslip.salaryStructure) {
      return {
        ...payslip,
        salaryStructure: {
          ...payslip.salaryStructure,
          basicPay: payslip.salaryStructure.basic || payslip.salaryStructure.basicPay,
          travelAllowance: payslip.salaryStructure.transport || payslip.salaryStructure.travelAllowance,
          housingAllowance: payslip.salaryStructure.housing || payslip.salaryStructure.housingAllowance,
          utilityAllowance: payslip.salaryStructure.utility || payslip.salaryStructure.utilityAllowance,
          bonus: payslip.salaryStructure.bonus || payslip.bonuses || payslip.bonus,
          reimbursements: payslip.salaryStructure.reimbursements || payslip.reimbursements
        }
      };
    }
    return response.data;
  }

  async getPayrollSummary(params?: { year?: string }) {
    const response = await this.api.get('/payroll/summary', { params });
    return response.data;
  }

  // Bulletin endpoints
  async getBulletins(params?: { page?: number; limit?: number }) {
    const response = await this.api.get('/bulletin', { params });
    // Backend returns array directly with createdAt field and populated createdBy
    // Map fields for mobile compatibility:
    // - createdAt -> postedDate
    // - createdBy.fullName -> postedBy (string)
    // - body -> content
    const bulletins = Array.isArray(response.data) ? response.data : [];
    return bulletins.map((bulletin: any) => ({
      ...bulletin,
      postedDate: bulletin.createdAt || bulletin.postedDate,
      postedBy: bulletin.createdBy?.fullName || (typeof bulletin.createdBy === 'object' && bulletin.createdBy ? bulletin.createdBy.fullName : null) || bulletin.postedBy || 'Admin',
      content: bulletin.body || bulletin.content // Backend uses 'body', mobile expects 'content'
    }));
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
    const response = await this.api.get(`/documents/${id}/download`);
    return response.data;
  }

  async deleteDocument(id: string) {
    const response = await this.api.delete(`/documents/${id}`);
    return response.data;
  }

  async getDocumentDownloadUrl(id: string) {
    const response = await this.api.get(`/documents/${id}/download`);
    return response.data.url;
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

  async getMyTrainingRequests(params?: { status?: string; startDate?: string; endDate?: string }) {
    const response = await this.api.get('/training-requests/my', { params });
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

  async updatePerformanceEvaluation(id: string, data: any) {
    const response = await this.api.put(`/performance-evaluations/${id}`, data);
    return response.data;
  }

  // Notification endpoints
  async getNotifications(params?: { page?: number; limit?: number }) {
    try {
      // Don't pass limit to backend if not specified, or use a high limit
      // Backend defaults to 20, but we want all notifications
      const requestParams = params?.limit ? params : { ...params, limit: 100 };
      const response = await this.api.get('/notifications', { params: requestParams });
      // Ensure we return an array
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      } else if (data && Array.isArray(data.notifications)) {
        return data.notifications;
      } else {
        return [];
      }
    } catch (error: any) {
      console.warn('Error fetching notifications:', error);
      return [];
    }
  }

  async markNotificationAsRead(id: string) {
    const response = await this.api.post(`/notifications/read/${id}`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await this.api.post('/notifications/read-all');
    return response.data;
  }

  async getNotificationCount() {
    try {
      const response = await this.api.get('/notifications/count');
      const data = response.data;
      // Return count as number
      if (typeof data === 'number') {
        return data;
      } else if (data && typeof data.count === 'number') {
        return data.count;
      } else {
        return 0;
      }
    } catch (error: any) {
      console.warn('Error fetching notification count:', error);
      return 0;
    }
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
    const response = await this.api.get('/recognitions', { params: { status: 'approved', limit: limit } });
    // Backend returns { recognitions: [...], total, page, limit, pages }
    // Extract recognitions array from response
    const recognitions = response.data?.recognitions || response.data || [];
    // Ensure we have an array and sort by createdAt descending
    return Array.isArray(recognitions)
      ? recognitions.sort((a: any, b: any) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        }).slice(0, limit)
      : [];
  }

  // Peer Recognition endpoints
  async getActivePeers() {
    const response = await this.api.get('/staff/active-peers');
    return response.data;
  }

  async getMyExpenseClaims() {
    const response = await this.api.get('/expense-claims/my');
    return response.data;
  }

  async createExpenseClaim(data: any) {
    const response = await this.api.post('/expense-claims', data);
    return response.data;
  }

  // Inventory endpoints
  async getMyInventory() {
    const response = await this.api.get('/inventory/my');
    return response.data;
  }

  async submitInventoryRequest(data: any) {
    const response = await this.api.post('/inventory/requests', data);
    return response.data;
  }

  async getInventoryItemNames() {
    const response = await this.api.get('/inventory/item-names');
    return response.data;
  }

  // Task endpoints
  async getMyTasks() {
    const response = await this.api.get('/tasks/staff');
    return response.data;
  }

  async updateTaskStatus(id: string, data: { status: string; note?: string }) {
    const response = await this.api.patch(`/tasks/${id}/status`, data);
    return response.data;
  }

  // Event endpoints
  async getEvents() {
    const response = await this.api.get('/events');
    // Backend returns { events: [...], pagination: {...} }
    // Extract events array and map date fields for mobile compatibility
    // Backend uses startsAt/endsAt, mobile expects start/end
    const events = response.data?.events || response.data || [];
    return Array.isArray(events) 
      ? events.map((event: any) => ({
          ...event,
          start: event.startsAt || event.start,
          end: event.endsAt || event.end
        }))
      : [];
  }

  // Staff Directory endpoint
  async getStaffDirectory() {
    const response = await this.api.get('/users');
    return response.data;
  }

  // Get all staff with attendance status
  async getAllStaffAttendanceStatus() {
    try {
      const response = await this.api.get('/attendance/all-staff-status');
      return response.data;
    } catch (error: any) {
      console.warn('Error fetching staff attendance status:', error);
      // Fallback to regular staff directory if attendance endpoint fails
      return await this.getStaffDirectory();
    }
  }

  async getSystemSettings() {
    const response = await this.api.get('/settings');
    return response.data;
  }

  async createPeerRecognition(data: { submitter?: string; recognized: string; comment: string; organization?: string; }) {
    // Backend gets submitter from req.user._id automatically, so we only need to send recognized and comment
    const payload = {
      recognized: data.recognized,
      comment: data.comment
    };
    const response = await this.api.post('/recognitions', payload);
    return response.data;
  }

  // Helpdesk endpoints
  async getHelpdeskTickets(params?: { status?: string; priority?: string; category?: string; search?: string; page?: number; limit?: number }) {
    const response = await this.api.get('/helpdesk/tickets', { params });
    // Backend returns { tickets: [...], total, page, limit, pages }
    return response.data;
  }

  async getHelpdeskTicket(id: string) {
    const response = await this.api.get(`/helpdesk/tickets/${id}`);
    return response.data;
  }

  async createHelpdeskTicket(data: { title: string; description: string; category: string; subcategory?: string; priority?: string; tags?: string[] }, attachments?: any[]) {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    formData.append('category', data.category);
    if (data.subcategory) formData.append('subcategory', data.subcategory);
    if (data.priority) formData.append('priority', data.priority);
    if (data.tags && data.tags.length > 0) {
      formData.append('tags', JSON.stringify(data.tags));
    }
    if (attachments && attachments.length > 0) {
      attachments.forEach((file, index) => {
        // React Native FormData expects file objects with uri, type, and name
        formData.append('attachments', {
          uri: file.uri,
          type: file.type || 'application/octet-stream',
          name: file.name || `attachment_${index}.${file.uri.split('.').pop()}`
        } as any);
      });
    }
    // For React Native, don't set Content-Type header - let the network layer handle it with boundary
    const response = await this.api.post('/helpdesk/tickets', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      transformRequest: () => formData, // Prevent Axios from transforming FormData
    });
    return response.data;
  }

  async addTicketComment(ticketId: string, comment: string, isInternal: boolean = false) {
    const response = await this.api.post(`/helpdesk/tickets/${ticketId}/comments`, { content: comment, isInternal });
    return response.data;
  }

  async closeTicket(ticketId: string) {
    const response = await this.api.patch(`/helpdesk/tickets/${ticketId}/close`);
    return response.data;
  }

  async getHelpdeskCategories() {
    const response = await this.api.get('/helpdesk/categories');
    return response.data;
  }

  // Knowledge Base endpoints
  async getKnowledgeArticles(params?: { category?: string; type?: string; search?: string; featured?: boolean; page?: number; limit?: number }) {
    const response = await this.api.get('/helpdesk/knowledge', { params });
    // Backend returns { articles: [...], total, page, limit, pages }
    return response.data;
  }

  async getKnowledgeArticle(id: string) {
    const response = await this.api.get(`/helpdesk/knowledge/${id}`);
    return response.data;
  }

  async getFeaturedKnowledgeArticles() {
    const response = await this.api.get('/helpdesk/knowledge/featured');
    return response.data;
  }

  async searchKnowledgeArticles(searchQuery: string) {
    const response = await this.api.get('/helpdesk/knowledge/search', { params: { search: searchQuery } });
    return response.data;
  }

  async rateKnowledgeArticle(articleId: string, helpful: boolean) {
    const response = await this.api.post(`/helpdesk/knowledge/${articleId}/rate`, { helpful });
    return response.data;
  }

  // Official Letters endpoints
  async getLetterTemplates(params?: { category?: string }) {
    const response = await this.api.get('/letter-templates', { params });
    return response.data;
  }

  async getMyLetterRequests(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.api.get('/letter-requests/my', { params });
    // Backend returns { requests, pagination }
    return response.data?.requests || response.data || [];
  }

  async createLetterRequest(data: {
    template: string;
    employee?: string;
    requestMessage?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    isUrgent?: boolean;
    dueDate?: string;
    customData?: any;
  }) {
    try {
      console.log('[API] Creating letter request:', data);
      const response = await this.api.post('/letter-requests', data);
      console.log('[API] Letter request created successfully:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[API] Error creating letter request:', error.response?.data || error.message);
      throw error;
    }
  }

  async downloadLetterDocument(requestId: string) {
    const response = await this.api.get(`/letter-requests/${requestId}/download`);
    return response.data; // Returns { downloadUrl, fileName, fileSize, mimeType }
  }

  // Profile image signed URL endpoint
  async getProfileImageSignedUrl(s3Key: string) {
    try {
      // URL encode the S3 key to handle special characters
      const encodedS3Key = encodeURIComponent(s3Key);
      const response = await this.api.get(`/auth/profile-image/${encodedS3Key}`);
      return response.data?.signedUrl || null;
    } catch (error: any) {
      console.warn('Error fetching profile image signed URL:', error);
      return null;
    }
  }

  // Organization Documents endpoints
  async getOrganizationDocuments(params?: { 
    category?: string; 
    status?: string; 
    search?: string; 
    page?: number; 
    limit?: number 
  }) {
    const response = await this.api.get('/organization-documents', { params });
    // Backend returns { documents: [...], pagination: { page, limit, total, pages } }
    return response.data;
  }

  async getOrganizationDocument(id: string) {
    const response = await this.api.get(`/organization-documents/${id}`);
    return response.data;
  }

  async downloadOrganizationDocument(id: string) {
    const response = await this.api.get(`/organization-documents/${id}/download`);
    return response.data; // Returns { downloadUrl, fileName, fileSize, mimeType }
  }

  async getOrganizationDocumentStats() {
    const response = await this.api.get('/organization-documents/stats');
    return response.data;
  }

  async getOrganizationDocumentCategories() {
    const response = await this.api.get('/organization-documents/categories');
    return response.data;
  }

  // SSO endpoints
  /**
   * Discover organization by email domain for SSO
   */
  async discoverSSOOrganization(email: string) {
    try {
      const response = await this.api.post('/sso/discover', { email });
      console.log('[API] SSO Discovery response status:', response.status);
      console.log('[API] SSO Discovery response data:', JSON.stringify(response.data, null, 2));
      
      // Check if response is an error (404, etc.)
      // Note: axios is configured with validateStatus: (status) => status < 500
      // So 4xx errors don't throw, they return a response with error status
      if (response.status === 404 || (response.data && !response.data.success)) {
        const errorMessage = response.data?.message || 'No SSO configuration found for this email domain';
        console.log('[API] SSO Discovery returned error:', errorMessage);
        return {
          success: false,
          message: errorMessage,
          error: errorMessage
        };
      }
      
      // Success case
      if (response.data && response.data.success) {
        console.log('[API] SSO Discovery successful:', response.data);
        return response.data;
      }
      
      // Unexpected response format
      console.warn('[API] SSO Discovery unexpected response format:', response.data);
      return {
        success: false,
        message: 'Unexpected response format from server',
        error: 'Unexpected response format from server'
      };
    } catch (error: any) {
      console.error('[API] SSO Discovery exception:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        fullError: error
      });
      
      // Handle network errors or 5xx errors
      if (error.response?.data) {
        return {
          success: false,
          message: error.response.data.message || error.response.data.error || 'Failed to discover SSO configuration',
          error: error.response.data.message || error.response.data.error || 'Failed to discover SSO configuration'
        };
      }
      
      // Network error
      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
        error: 'Network error. Please check your connection and try again.'
      };
    }
  }

  /**
   * Initiate SSO login flow
   */
  async initiateSSO(email: string, provider: 'microsoft' | 'google', organizationId: string) {
    try {
      const response = await this.api.post('/sso/initiate', {
        email,
        provider,
        organizationId,
        platform: 'mobile' // Indicate this is a mobile app request
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to initiate SSO login');
    }
  }

  /**
   * Complete SSO login by exchanging callback token
   * This is called after the OAuth callback redirects back to the app
   */
  async completeSSOLogin(token: string) {
    try {
      // The token is already a JWT from the backend callback
      // We just need to verify it and get user profile
      const response = await this.api.get('/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return {
        success: true,
        token,
        user: response.data.user || response.data
      };
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to complete SSO login');
    }
  }
}

export default new ApiService(); 