import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.error("Mobile API URL is missing. Set EXPO_PUBLIC_API_URL in mobile/.env.");
} else {
  console.log(`API Base URL: ${API_BASE_URL}`);
}

const api = axios.create({
  baseURL: API_BASE_URL || 'http://localhost:4000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to add Auth Token
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('jd_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor for Error Handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem('jd_token');
      await AsyncStorage.removeItem('jd_user');
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  register: (data: any) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
};

export const vehiclesApi = {
  getAvailable: () => api.get('/vehicles/available'),
  getAvailableWithDates: (pickupDate?: string, returnDate?: string) => {
    const params = new URLSearchParams();
    if (pickupDate) params.append('pickupDate', pickupDate);
    if (returnDate) params.append('returnDate', returnDate);
    const query = params.toString();
    return api.get(`/vehicles/available${query ? `?${query}` : ''}`);
  },
  getImageUrl: (id: string) =>
    `${API_BASE_URL || 'http://localhost:4000/api'}/vehicles/${id}/image`,
};

export const filesApi = {
  getFileUrl: (fileId: string) => `${API_BASE_URL || 'http://localhost:4000/api'}/files/${fileId}`,
  getSignedUrl: async (fileId: string) => {
    const res = await api.get(`/files/${fileId}?json=true`);
    const url = res.data?.url || res.data?.signedUrl;
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return `${API_BASE_URL || 'http://localhost:4000/api'}/files/${fileId}`;
    }
    return url;
  },
};

export const bookingsApi = {
  // Existing — do not modify
  getMyBookings: () => api.get('/customer/bookings/my'),
  uploadDocument: (bookingId: string, formData: FormData) =>
    api.post(`/customer/bookings/${bookingId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  // New
  createBooking: (data: any) => api.post('/customer/bookings', data),
  getBookingDetail: (id: string) => api.get(`/customer/bookings/${id}`),
  cancelBooking: (id: string) => api.patch(`/customer/bookings/${id}/cancel`),
  getVehicleBookedDates: (vehicleId: string) =>
    api.get(`/customer/bookings/vehicle/${vehicleId}/booked-dates`),
};

export const paymentsApi = {
  submit: (bookingId: string, formData: FormData) =>
    api.post(`/payments/${bookingId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getBookingPayments: (bookingId: string) =>
    api.get(`/payments/booking/${bookingId}`),
};

export const notificationsApi = {
  getNotifications: () => api.get('/customer/notifications'),
  markAsRead: (id: string) => api.post(`/customer/notifications/${id}/read`),
  markAllAsRead: () => api.post('/customer/notifications/read-all'),
};

export const gpsApi = {
  sendLocation: (data: any) => api.post('/gps/location', data),
};

export const customerApi = {
  getActiveRental: () => api.get('/customer/active-rental'),
};

export const pricingApi = {
  getQuote: (data: { vehicleId: string; startDate: string; endDate: string }) =>
    api.post('/pricing/quote', data),
};

