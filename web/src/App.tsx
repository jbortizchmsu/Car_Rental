import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import VehiclesPage from './pages/VehiclesPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import AdminDashboard from './pages/AdminDashboard';
import VehicleManagement from './pages/VehicleManagement';
import RequestRentalPage from './pages/RequestRentalPage';
import MyBookingsPage from './pages/MyBookingsPage';
import CustomerNotificationsPage from './pages/CustomerNotificationsPage';
import CustomerProfilePage from './pages/CustomerProfilePage';
import BookingRequestsPage from './pages/BookingRequestsPage';
import PaymentSubmissionPage from './pages/PaymentSubmissionPage';
import AdminPaymentVerificationPage from './pages/AdminPaymentVerificationPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminLiveMapPage from './pages/AdminLiveMapPage';
import AdminMaintenancePage from './pages/AdminMaintenancePage';
import AdminDynamicPricingPage from './pages/AdminDynamicPricingPage';
import AdminGpsTrackingPage from './pages/AdminGpsTrackingPage';
import AdminUserRolesPage from './pages/AdminUserRolesPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import PublicLayout from './components/PublicLayout';
import AdminLayout from './components/AdminLayout';

import { ToastProvider } from './components/ToastProvider';
import { PageHeaderProvider } from './contexts/PageHeaderContext';

function App() {
  return (
    <PageHeaderProvider>
      <ToastProvider>
        <Router>
        <Routes>
          {/* Public Routes with Navbar/Footer */}
          <Route element={<PublicLayout><Outlet /></PublicLayout>}>
            <Route path="/" element={<HomePage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            {/* Customer Routes (also use PublicLayout) */}
            <Route 
              path="/customer/*" 
              element={
                <ProtectedRoute allowedRole="customer">
                  <Routes>
                    <Route path="dashboard" element={<div>Customer Dashboard Placeholder</div>} />
                    <Route path="request-rental" element={<RequestRentalPage />} />
                    <Route path="my-bookings" element={<MyBookingsPage />} />
                    <Route path="notifications" element={<CustomerNotificationsPage />} />
                    <Route path="profile" element={<CustomerProfilePage />} />
                    <Route path="payment/:bookingId" element={<PaymentSubmissionPage />} />
                    <Route path="*" element={<MyBookingsPage />} />
                  </Routes>
                </ProtectedRoute>
              } 
            />
          </Route>
          
          {/* Admin Routes with Sidebar only */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            } 
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="fleet" element={<VehicleManagement />} />
            <Route path="bookings" element={<BookingRequestsPage />} />
            <Route path="maintenance" element={<AdminMaintenancePage />} />
            <Route path="dynamic-pricing" element={<AdminDynamicPricingPage />} />
            <Route path="gps-tracking" element={<AdminGpsTrackingPage />} />
            <Route path="map-dashboard" element={<AdminLiveMapPage />} />
            <Route path="payments" element={<AdminPaymentVerificationPage />} />
            <Route path="reports" element={<AdminReportsPage />} />
            <Route path="user-roles" element={<AdminUserRolesPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />

            {/* Redirects for backward compatibility */}
            <Route path="vehicles" element={<Navigate to="/admin/fleet" replace />} />
            <Route path="booking-requests" element={<Navigate to="/admin/bookings" replace />} />
            <Route path="payment-verification" element={<Navigate to="/admin/payments" replace />} />
            <Route path="live-map" element={<Navigate to="/admin/map-dashboard" replace />} />
            <Route path="pickup" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="active-rentals" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="geofences" element={<Navigate to="/admin/map-dashboard" replace />} />
            
            <Route index element={<AdminDashboard />} />
            <Route path="*" element={<AdminDashboard />} />
          </Route>
        </Routes>
      </Router>
    </ToastProvider>
    </PageHeaderProvider>
  );
}

export default App;
