import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Car, User, LogOut, Bookmark, Bell, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationsApi } from '../services/api';
import { io } from 'socket.io-client';

const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    if (user && profile?.role === 'customer') {
      try {
        const { data } = await notificationsApi.getUnreadCount();
        setUnreadCount(data.unreadCount || 0);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    } else if (!user) {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    fetchUnreadCount();

    // Socket.io connection for real-time updates
    const socket = io(import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:4000');
    
    if (user && profile?.role === 'customer') {
      socket.emit('join-room', user.id);
      
      socket.on('notification-created', (notification) => {
        console.log('🔔 New notification received:', notification);
        fetchUnreadCount();
      });
    }

    // Polling fallback (every 30 seconds)
    const interval = setInterval(() => {
      if (user && profile?.role === 'customer') {
        fetchUnreadCount();
      }
    }, 30000);

    // Refresh when tab gets focus
    window.addEventListener('focus', fetchUnreadCount);
    
    // Listen for custom event when notifications are read/changed in other pages
    window.addEventListener('notifications-updated', fetchUnreadCount);

    return () => {
      socket.disconnect();
      clearInterval(interval);
      window.removeEventListener('focus', fetchUnreadCount);
      window.removeEventListener('notifications-updated', fetchUnreadCount);
    };
  }, [user, profile]);

  // Also refresh on location changes
  useEffect(() => {
    if (user) {
      fetchUnreadCount();
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    setDropdownOpen(false);
    navigate('/login');
  };

  const closeDropdown = () => setDropdownOpen(false);

  return (
    <nav style={{
      padding: '1rem 0',
      backgroundColor: 'var(--white)',
      borderBottom: '1px solid #eee',
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      boxShadow: 'var(--shadow-soft)'
    }}>
      <div className="container" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Car size={28} color="var(--warm-taupe)" />
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px' }}>
            JD <span style={{ color: 'var(--warm-taupe)' }}>CAR RENTAL</span>
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          {(!user || profile?.role === 'customer') && (
            <>
              <Link to="/" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Home</Link>
              <Link to="/vehicles" style={{ fontWeight: 500, fontSize: '0.95rem' }}>Vehicles</Link>
              <a href="/#how-it-works" style={{ fontWeight: 500, fontSize: '0.95rem' }}>How It Works</a>
            </>
          )}
          
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginLeft: '1rem' }}>
              {profile?.role === 'customer' ? (
                <>
                  <Link to="/customer/request-rental" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Book Now</Link>
                  
                  <div className="dropdown-container" ref={dropdownRef}>
                    <button 
                      type="button"
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        borderLeft: '1px solid #eee', 
                        paddingLeft: '1.5rem',
                        background: 'none',
                        padding: '0.25rem'
                      }}
                    >
                      <div className="profile-avatar-wrapper">
                        <div style={{ 
                          width: '36px', 
                          height: '36px', 
                          borderRadius: '50%', 
                          backgroundColor: 'var(--soft-beige)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                          color: 'var(--white)'
                        }}>
                          {profile?.full_name?.charAt(0) || <User size={20} />}
                        </div>
                        {unreadCount > 0 && <div className="profile-notification-dot"></div>}
                      </div>
                    </button>

                    {dropdownOpen && (
                      <div className="dropdown-menu">
                        <div className="dropdown-header">
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{profile?.full_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{profile?.email}</div>
                        </div>
                        
                        <Link to="/customer/my-bookings" className="dropdown-item" onClick={closeDropdown}>
                          <Bookmark size={18} />
                          My Bookings
                        </Link>
                        
                        <Link to="/customer/notifications" className="dropdown-item" onClick={closeDropdown}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                            <Bell size={18} />
                            Notifications
                          </div>
                          {unreadCount > 0 && (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              backgroundColor: 'var(--status-error)', 
                              color: 'white', 
                              padding: '0.1rem 0.4rem', 
                              borderRadius: '99px',
                              fontWeight: 700
                            }}>
                              {unreadCount}
                            </span>
                          )}
                        </Link>
                        
                        <Link to="/customer/profile" className="dropdown-item" onClick={closeDropdown}>
                          <Settings size={18} />
                          Profile Settings
                        </Link>
                        
                        <div style={{ borderTop: '1px solid var(--gray-100)', margin: '0.5rem 0' }}></div>
                        
                        <button onClick={handleSignOut} className="dropdown-item danger">
                          <LogOut size={18} />
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  <Link to="/admin/dashboard" className="btn-brand" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Admin Dashboard</Link>
                  <button 
                    onClick={handleSignOut} 
                    title="Logout"
                    style={{ color: 'var(--muted-mauve)', background: 'none', display: 'flex', alignItems: 'center' }}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '1rem', marginLeft: '1rem' }}>
              <Link to="/login" className="btn-outline" style={{ padding: '0.4rem 1.2rem', fontSize: '0.9rem' }}>Login</Link>
              <Link to="/register" className="btn-primary" style={{ padding: '0.4rem 1.2rem', fontSize: '0.9rem' }}>Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
