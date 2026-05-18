import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add Auth Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jd_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor for Error Handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Auto logout on unauthorized
      localStorage.removeItem('jd_token');
      localStorage.removeItem('jd_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authApi = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  register: (data: any) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

// Vehicles API
export const vehiclesApi = {
  getAll: () => api.get('/vehicles'),
  getAvailable: (pickupDate?: string, returnDate?: string) => {
    const params = new URLSearchParams();
    if (pickupDate) params.append('pickupDate', pickupDate);
    if (returnDate) params.append('returnDate', returnDate);
    return api.get(`/vehicles/available${params.toString() ? `?${params.toString()}` : ''}`);
  },
  create: (data: any) => api.post('/vehicles', data),
  update: (id: string, data: any) => api.put(`/vehicles/${id}`, data),
  retire: (id: string) => api.post(`/vehicles/${id}/retire`),
  getImageUrl: (id: string) => `${API_BASE_URL}/vehicles/${id}/image`,
};

// Bookings API
export const bookingsApi = {
  request: (data: any) => api.post('/customer/bookings', data),
  uploadDocument: (bookingId: string, type: string, file: File) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('bookingId', bookingId);
    formData.append('file', file);
    return api.post(`/customer/bookings/${bookingId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  getCustomerBookingDetails: (id: string) => api.get(`/customer/bookings/${id}`),
  getMyBookings: () => api.get('/customer/bookings/my'),
  getPending: () => api.get('/customer/bookings/pending'),
  approve: (id: string) => api.post(`/customer/bookings/${id}/approve`),
  reject: (id: string, reason: string) => api.post(`/customer/bookings/${id}/reject`, { reason }),
  getActiveList: (status: string | string[]) => {
    const params = new URLSearchParams();
    if (Array.isArray(status)) {
      status.forEach(s => params.append('status', s));
    } else {
      params.append('status', status);
    }
    return api.get(`/customer/bookings/active-list?${params.toString()}`);
  },
  releaseVehicle: (id: string, data: any) => api.post(`/customer/bookings/${id}/release`, data),
  markReturned: (id: string, data: any) => api.post(`/customer/bookings/${id}/return`, data),
  completeRental: (id: string, data: any) => api.post(`/customer/bookings/${id}/complete`, data),
  getDetails: (id: string) => api.get(`/customer/bookings/${id}`),
  signAgreement: (id: string, signerName: string) => api.post(`/customer/bookings/${id}/sign-agreement`, { signerName }),
  confirmCashPayment: (id: string, amount: number) => api.post(`/payments/booking/${id}/confirm-cash`, { amount }),
};

// Payments API
export const paymentsApi = {
  submit: (bookingId: string, formData: FormData) => api.post(`/payments/${bookingId}/submit`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getSubmitted: () => api.get('/payments/list?status=SUBMITTED'),
  getPaymentsByStatus: (status: string) => api.get(`/payments/list?status=${status}`),
  getCashAtPickup: () => api.get('/payments/cash-at-pickup'),
  confirmCash: (bookingId: string, amount: number) => api.post(`/payments/booking/${bookingId}/confirm-cash`, { amount }),
  verify: (id: string) => api.post(`/payments/${id}/verify`),
  reject: (id: string, reason: string) => api.post(`/payments/${id}/reject`, { reason }),
  getBookingForPayment: (id: string) => api.get(`/payments/booking/${id}`),
  getPaymentSummary: () => api.get('/payments/summary'),
};

// Admin Reports API
export const adminApi = {
  getSummaryReport: () => api.get('/admin/reports/summary'),
  getRevenueReport: (params: any) => api.get('/admin/reports/revenue', { params }),
  getBookingReport: (params: any) => api.get('/admin/reports/bookings', { params }),
  getVehicleReport: (params?: any) => api.get('/admin/reports/vehicles', { params }),
  getPaymentReport: (params: any) => api.get('/admin/reports/payments', { params }),
  getMaintenanceReport: (params?: any) => api.get('/admin/reports/maintenance', { params }),
  getGeofenceAlertReport: (params?: any) => api.get('/admin/reports/geofence-alerts', { params }),
  getLiveLocations: () => api.get('/gps/live'),
  resolveGeofenceAlert: (id: string) => api.post(`/gps/alerts/${id}/resolve`),
  getGeofences: () => api.get('/gps/geofences'),
  saveGeofence: (data: any) => api.post('/gps/geofences', data),
  deleteGeofence: (id: string) => api.delete(`/gps/geofences/${id}`),
  toggleGeofence: (id: string, active: boolean) => api.patch(`/gps/geofences/${id}/toggle`, { active }),
};

// Notifications API
export const notificationsApi = {
  getNotifications: () => api.get('/customer/notifications'),
  getUnreadCount: () => api.get('/customer/notifications/unread-count'),
  markAsRead: (id: string) => api.post(`/customer/notifications/${id}/read`),
  markAllAsRead: () => api.post('/customer/notifications/read-all'),
};

// Customer Profile API
export const customerApi = {
  getProfile: () => api.get('/customer/profile'),
  updateProfile: (data: any) => api.put('/customer/profile', data),
};

// Files API
export const filesApi = {
  getProtectedFileBlob: (fileId: string) => api.get(`/files/${fileId}`, { responseType: 'blob' }),
};

// Maintenance API
export const maintenanceApi = {
  getSummary: () => api.get('/admin/maintenance/summary'),
  getVehicles: () => api.get('/admin/maintenance/vehicles'),
  getDamageReports: () => api.get('/admin/maintenance/damage-reports'),
  getLogs: () => api.get('/admin/maintenance/logs'),
  createLog: (data: any) => api.post('/admin/maintenance/logs', data),
  updateLog: (id: string, data: any) => api.put(`/admin/maintenance/logs/${id}`, data),
  markUnderMaintenance: (vehicleId: string) => api.post(`/admin/maintenance/vehicles/${vehicleId}/mark-maintenance`),
  markAvailable: (vehicleId: string) => api.post(`/admin/maintenance/vehicles/${vehicleId}/mark-available`),
};

// Pricing API
export const pricingApi = {
  getQuote: (data: { vehicleId: string, startDate: string, endDate: string }) => api.post('/pricing/quote', data),
  getRules: () => api.get('/admin/pricing/admin/rules'),
  createRule: (data: any) => api.post('/admin/pricing/admin/rules', data),
  updateRule: (id: string, data: any) => api.put(`/admin/pricing/admin/rules/${id}`, data),
  deleteRule: (id: string) => api.delete(`/admin/pricing/admin/rules/${id}`),
  toggleRule: (id: string) => api.patch(`/admin/pricing/admin/rules/${id}/toggle`),
};
