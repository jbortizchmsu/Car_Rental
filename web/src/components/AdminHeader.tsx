import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageHeader } from '../contexts/PageHeaderContext';

const AdminHeader: React.FC = () => {
  const location = useLocation();
  const { profile } = useAuth();
  const { title: contextTitle, subtitle } = usePageHeader();

  // Map routes to page titles (fallback if no context title)
  const routeTitle = useMemo(() => {
    const pathMap: { [key: string]: string } = {
      '/admin': 'Overview',
      '/admin/dashboard': 'Overview',
      '/admin/fleet': 'Fleet Management',
      '/admin/bookings': 'Bookings',
      '/admin/maintenance': 'Maintenance',
      '/admin/payments': 'Payments',
      '/admin/reports': 'Reports & Analytics',
      '/admin/user-roles': 'User Roles',
      '/admin/settings': 'Settings',
      '/admin/gps-tracking': 'GPS Tracking',
      '/admin/map-dashboard': 'Live Vehicle Map',
      '/admin/geofence': 'Geofence Management',
      '/admin/dynamic-pricing': 'Dynamic Pricing',
    };

    return pathMap[location.pathname] || 'Dashboard';
  }, [location.pathname]);

  // Use context title if provided, fallback to route-based title
  const pageTitle = contextTitle || routeTitle;

  // Get user initials
  const initials = useMemo(() => {
    if (!profile?.full_name) return '?';
    return profile.full_name
      .split(' ')
      .map((n) => n.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }, [profile?.full_name]);

  // Get role display name
  const roleDisplay = useMemo(() => {
    if (!profile?.role) return 'User';
    const roleMap: { [key: string]: string } = {
      admin: 'Administrator',
      system_admin: 'System Administrator',
      staff: 'Staff Member',
      customer: 'Customer',
    };
    return roleMap[profile.role] || profile.role;
  }, [profile?.role]);

  return (
    <div className="flex items-center justify-between w-full h-full gap-4">
      {/* Title & Subtitle */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
        {subtitle && (
          <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">
            {subtitle}
          </p>
        )}
      </div>

      {/* User Info Block - Right Side */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <p className="text-sm font-medium text-gray-900">
            {profile?.full_name || 'User'}
          </p>
          <p className="text-xs text-gray-500">{roleDisplay}</p>
        </div>

        {/* Avatar Circle */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: 'var(--soft-beige)', color: 'var(--black)' }}
        >
          {initials}
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
