import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Car, User, LogOut, Bell, Settings, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { notificationsApi } from '../services/api';
import { connectAuthedSocket } from '../utils/socket';

const Navbar: React.FC = () => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      // The hamburger button itself is excluded from the "outside" check — otherwise
      // its own mousedown (which fires before its click handler toggles the menu)
      // would close the menu here first, and the click's toggle would immediately
      // reopen it.
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Close the mobile menu on navigation, same as it closes on a link tap — covers
  // back/forward navigation and any programmatic redirect too.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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

    // Socket.io connection for real-time updates — joins this user's room on
    // connect/reconnect; only customers act on it (fetchUnreadCount already
    // no-ops for non-customers, but skip the socket work entirely otherwise).
    const socket = user && profile?.role === 'customer' ? connectAuthedSocket() : null;

    if (socket) {
      socket.on('notification-created', (notification) => {
        console.log('🔔 New notification received:', notification);
        fetchUnreadCount();
      });
      // A reconnect may have missed events while disconnected — resync fully.
      let hadDisconnected = false;
      socket.on('disconnect', () => { hadDisconnected = true; });
      socket.on('connect', () => {
        if (hadDisconnected) {
          hadDisconnected = false;
          fetchUnreadCount();
        }
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
      socket?.disconnect();
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
  const closeMobileMenu = () => setMobileMenuOpen(false);

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
      <div className="container navbar-shell" style={{
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
            <div className="navbar-desktop-only" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <Link
                to="/"
                className={`nav-link${location.pathname === '/' ? ' nav-link-current' : ''}`}
                style={{ fontWeight: 500, fontSize: '0.95rem' }}
              >
                Home
              </Link>
              <Link
                to="/vehicles"
                className={`nav-link${location.pathname === '/vehicles' ? ' nav-link-current' : ''}`}
                style={{ fontWeight: 500, fontSize: '0.95rem' }}
              >
                Vehicles
              </Link>
              {user && profile?.role === 'customer' && (
                <Link
                  to="/customer/my-bookings"
                  className={`nav-link${location.pathname.startsWith('/customer/my-bookings') ? ' nav-link-current' : ''}`}
                  style={{ fontWeight: 500, fontSize: '0.95rem' }}
                >
                  My Bookings
                </Link>
              )}
            </div>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginLeft: '1rem' }}>
              {profile?.role === 'customer' ? (
                <>
                  <Link to="/vehicles" className="btn-primary navbar-desktop-only" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Book Now</Link>

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
                  <Link to="/admin/dashboard" className="btn-brand navbar-desktop-only" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Admin Dashboard</Link>
                  <button
                    onClick={handleSignOut}
                    title="Logout"
                    className="navbar-tap-target"
                    style={{ color: 'var(--muted-mauve)', background: 'none', display: 'flex', alignItems: 'center' }}
                  >
                    <LogOut size={18} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="navbar-desktop-only" style={{ display: 'flex', gap: '1rem', marginLeft: '1rem' }}>
                <Link to="/login" className="btn-outline" style={{ padding: '0.4rem 1.2rem', fontSize: '0.9rem' }}>Login</Link>
                <Link to="/register" className="btn-primary" style={{ padding: '0.4rem 1.2rem', fontSize: '0.9rem' }}>Register</Link>
              </div>
              {/* Compact top-bar equivalent for logged-out visitors on mobile — Register
                  moves into the hamburger panel below instead. */}
              <Link
                to="/login"
                className="btn-outline navbar-mobile-only navbar-tap-target"
                style={{ padding: '0.4rem 1.2rem', fontSize: '0.9rem', marginLeft: '1rem' }}
              >
                Login
              </Link>
            </>
          )}

          <button
            type="button"
            ref={hamburgerRef}
            className="navbar-hamburger navbar-tap-target"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="navbar-mobile-panel"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div id="navbar-mobile-panel" className="navbar-mobile-panel container" ref={mobileMenuRef}>
          {(!user || profile?.role === 'customer') && (
            <>
              <Link to="/" className="navbar-mobile-panel-link" onClick={closeMobileMenu}>Home</Link>
              <Link to="/vehicles" className="navbar-mobile-panel-link" onClick={closeMobileMenu}>Vehicles</Link>
              {user && profile?.role === 'customer' && (
                <Link to="/customer/my-bookings" className="navbar-mobile-panel-link" onClick={closeMobileMenu}>My Bookings</Link>
              )}
            </>
          )}
          {user && profile?.role === 'customer' && (
            <Link to="/vehicles" className="navbar-mobile-panel-link" onClick={closeMobileMenu}>Book Now</Link>
          )}
          {user && profile?.role !== 'customer' && (
            <Link to="/admin/dashboard" className="navbar-mobile-panel-link" onClick={closeMobileMenu}>Admin Dashboard</Link>
          )}
          {!user && (
            <>
              <Link to="/login" className="navbar-mobile-panel-link" onClick={closeMobileMenu}>Login</Link>
              <Link to="/register" className="navbar-mobile-panel-link" onClick={closeMobileMenu}>Register</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
