import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell, Info, AlertTriangle, X, Clock, CreditCard,
  AlertCircle, Wrench, Calendar, FileText, ChevronRight
} from 'lucide-react';
import { notificationsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { connectAuthedSocket } from '../utils/socket';
import { getRelativeTime, notificationTypeColors, getNotificationRedirectUrl } from '../lib/notification-types';

const IconMap: Record<string, React.ReactNode> = {
  'AlertTriangle': <AlertTriangle size={18} />,
  'Clock': <Clock size={18} />,
  'CreditCard': <CreditCard size={18} />,
  'AlertCircle': <AlertCircle size={18} />,
  'Wrench': <Wrench size={18} />,
  'Calendar': <Calendar size={18} />,
  'FileText': <FileText size={18} />,
  'Info': <Info size={18} />,
};

const NotificationPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth();
  const navigate = useNavigate();
  const panelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Socket.io connection — joins this user's authenticated room(s) on connect
    // and again on every reconnect (see connectAuthedSocket).
    const socket = connectAuthedSocket();

    socket.on('notification-created', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // A reconnect may have missed events while disconnected — do one full refetch
    // to resync (skip the very first 'connect', which fetchNotifications already covers).
    let hadDisconnected = false;
    socket.on('disconnect', () => { hadDisconnected = true; });
    socket.on('connect', () => {
      if (hadDisconnected) {
        hadDisconnected = false;
        fetchNotifications();
      }
    });

    return () => {
      socket.off('notification-created');
      socket.off('disconnect');
      socket.off('connect');
      socket.disconnect();
    };
  }, [user]);

  // Synchronize across components when notifications are updated anywhere in the app
  useEffect(() => {
    const handleUpdate = () => {
      fetchNotifications();
    };
    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPanel]);

  const fetchNotifications = async () => {
    try {
      const response = await notificationsApi.getNotifications();
      const notifList = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setNotifications(notifList);
      setUnreadCount(notifList.filter((n: any) => !n.isRead).length);
    } catch (error) {
      console.error('Failed to fetch notifications');
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (error) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (error) {
      console.error('Failed to mark all as read');
    }
  };

  const getIconForNotification = (notification: any) => {
    const iconName = notification.type ? getIconNameForType(notification.type) : 'Info';
    return IconMap[iconName] || <Info size={18} />;
  };

  const getIconNameForType = (type: string): string => {
    const typeMap: Record<string, string> = {
      'BOOKING_RETURN_OVERDUE': 'AlertTriangle',
      'BOOKING_PICKUP_DUE': 'Clock',
      'PAYMENT_SUBMITTED': 'CreditCard',
      'GEOFENCE_BREACH': 'AlertTriangle',
      'GPS_SIGNAL_LOST': 'AlertCircle',
      'MAINTENANCE_DUE_SOON': 'Wrench',
      'NEW_BOOKING_REQUEST': 'Calendar',
      'DOCUMENT_UPLOADED': 'FileText',
      'BOOKING_EXPIRED': 'AlertTriangle',
      'PAYMENT_REJECTED': 'AlertTriangle',
      'MAINTENANCE_DUE_CONFLICT': 'AlertTriangle',
      'GENERAL': 'Info',
    };
    return typeMap[type] || 'Info';
  };

  const getColorForNotification = (notification: any): string => {
    if (notification.type && notificationTypeColors[notification.type]) {
      return notificationTypeColors[notification.type];
    }
    return 'var(--warm-taupe)';
  };

  const handleItemClick = (n: any) => {
    if (!n.isRead) {
      markAsRead(n.id);
    }
    const redirectUrl = getNotificationRedirectUrl(n, user?.role);
    if (redirectUrl) {
      setShowPanel(false);
      navigate(redirectUrl);
    }
  };

  return (
    <div className="notification-wrapper" ref={panelRef} style={{ position: 'relative' }}>
      <button
        className="notification-trigger"
        onClick={() => {
          const next = !showPanel;
          setShowPanel(next);
          if (next) {
            fetchNotifications();
          }
        }}
        style={{
          background: 'none',
          border: 'none',
          padding: '8px',
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        <Bell size={24} color="var(--black)" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: 'var(--brand-black)',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            border: '2px solid white'
          }}>
            {unreadCount}
          </span>
        )}
      </button>

      {showPanel && (
        <div className="card" style={{
          position: 'absolute',
          top: '50px',
          right: '0',
          width: '350px',
          maxHeight: '500px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          padding: '0',
          overflow: 'hidden'
        }}>
          <div className="card-header" style={{
            padding: '1.25rem',
            borderBottom: '1px solid var(--gray-100)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 className="card-title" style={{ margin: 0, fontSize: '1rem' }}>Notifications</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={markAllAsRead}
                style={{ background: 'none', border: 'none', fontSize: '0.75rem', color: 'var(--warm-taupe)', cursor: 'pointer' }}
              >
                Mark all as read
              </button>
              <button onClick={() => setShowPanel(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="var(--gray-400)" />
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                <Info size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                <p style={{ fontSize: '0.875rem' }}>No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => {
                const redirectUrl = getNotificationRedirectUrl(n, user?.role);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleItemClick(n)}
                    style={{
                      padding: '1rem 1.25rem',
                      borderBottom: '1px solid var(--gray-100)',
                      backgroundColor: n.isRead ? 'transparent' : 'rgba(173, 155, 141, 0.05)',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'flex-start',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(173, 155, 141, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = n.isRead ? 'transparent' : 'rgba(173, 155, 141, 0.05)';
                    }}
                  >
                    <div style={{ marginTop: '3px', color: getColorForNotification(n), flexShrink: 0 }}>
                      {getIconForNotification(n)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.875rem',
                        fontWeight: n.isRead ? 500 : 700,
                        margin: '0 0 4px 0',
                        color: 'var(--black)'
                      }}>
                        {n.title}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', margin: '0 0 4px 0', lineHeight: 1.4, wordBreak: 'break-word' }}>
                        {n.message}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>
                          {getRelativeTime(n.createdAt)}
                        </span>
                        {redirectUrl && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--warm-taupe)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            View <ChevronRight size={12} />
                          </span>
                        )}
                      </div>
                    </div>
                    {!n.isRead && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warm-taupe)', marginTop: '6px', flexShrink: 0 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid var(--gray-100)',
            textAlign: 'center'
          }}>
            <Link 
              to={user?.role === 'admin' ? "/admin/notifications" : "/customer/notifications"} 
              onClick={() => setShowPanel(false)}
              style={{
                fontSize: '0.875rem',
                color: 'var(--warm-taupe)',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'block'
              }}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
