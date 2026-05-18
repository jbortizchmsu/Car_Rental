import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Car, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  Navigation, 
  Map as MapIcon, 
  Shield, 
  BarChart3, 
  LogOut,
  Wrench,
  Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Sidebar: React.FC = () => {
  const location = useLocation();
  const { signOut } = useAuth();

  const isItemActive = (path: string, alternates: string[] = []) => {
    const currentPath = location.pathname;
    return currentPath === path || alternates.includes(currentPath);
  };

  const menuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview' },
    { path: '/admin/fleet', icon: Car, label: 'Fleet Management', alternates: ['/admin/vehicles'] },
    { path: '/admin/bookings', icon: Calendar, label: 'Bookings', alternates: ['/admin/booking-requests'] },
    { path: '/admin/maintenance', icon: Wrench, label: 'Maintenance' },
    { path: '/admin/dynamic-pricing', icon: DollarSign, label: 'Dynamic Pricing' },
    { path: '/admin/gps-tracking', icon: Navigation, label: 'GPS Tracking' },
    { path: '/admin/map-dashboard', icon: MapIcon, label: 'Map Dashboard', alternates: ['/admin/live-map'] },
    { path: '/admin/payments', icon: CreditCard, label: 'Payments Ledger', alternates: ['/admin/payment-verification'] },
    { path: '/admin/reports', icon: BarChart3, label: 'Reports & Analytics' },
    { path: '/admin/user-roles', icon: Shield, label: 'User Roles' },
    { path: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="admin-sidebar">
      <Link to="/admin/dashboard" className="admin-sidebar-brand">
        <Car size={32} color="var(--soft-beige)" />
        <span>JD ADMIN</span>
      </Link>

      <nav className="admin-sidebar-menu">
        {menuItems.map((item) => {
          const active = isItemActive(item.path, item.alternates);
          return (
            <Link 
              key={item.path}
              to={item.path} 
              className={`admin-sidebar-link ${active ? 'admin-sidebar-link-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <item.icon size={18} className="admin-sidebar-icon" strokeWidth={active ? 2.5 : 2} /> 
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <button 
        onClick={() => signOut()}
        className="admin-sidebar-logout"
      >
        <LogOut size={18} /> 
        <span>Logout</span>
      </button>
    </aside>
  );
};

export default Sidebar;
