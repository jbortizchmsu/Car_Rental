import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Use your computer's local IP address for physical phone testing
const API_BASE_URL = 'http://192.168.1.100:4000/api'; 

const api = axios.create({
  baseURL: API_BASE_URL,
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
      // In a real app, you'd trigger a navigation to Login here
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
};

export const bookingsApi = {
  getMyBookings: () => api.get('/bookings/my'),
  uploadDocument: (bookingId: string, formData: FormData) => api.post(`/bookings/${bookingId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

export const notificationsApi = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all'),
};

export const gpsApi = {
  sendLocation: (data: any) => api.post('/gps/location', data),
};
