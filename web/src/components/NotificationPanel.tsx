import React, { useEffect, useState } from 'react';
import {
  Bell, Info, AlertTriangle, X, Clock, CreditCard,
  AlertCircle, Wrench, Calendar, FileText
} from 'lucide-react';
import { notificationsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';
import { getRelativeTime, notificationTypeColors } from '../lib/notification-types';

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

  useEffect(() => {
    fetchNotifications();

    // Socket.io connection
    const socket = io('http://localhost:4000');

    if (user) {
      socket.emit('join-room', user.id);
    }

    socket.on('notification-created', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const fetchNotifications = async () => {
    try {
      const response = await notificationsApi.getNotifications();
      const notifList = Array.isArray(response.data) ? response.data :  response.data?.data || [];
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
    } catch (error) {
      console.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
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

  return (
    <div className="notification-wrapper" style={{ position: 'relative' }}>
      <button
        className="notification-trigger"
        onClick={() => setShowPanel(!showPanel)}
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
              notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markAsRead(n.id)}
                  style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid var(--gray-100)',
                    backgroundColor: n.isRead ? 'transparent' : 'rgba(173, 155, 141, 0.05)',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: '12px'
                  }}
                >
                  <div style={{ marginTop: '3px', color: getColorForNotification(n) }}>
                    {getIconForNotification(n)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontSize: '0.875rem',
                      fontWeight: n.isRead ? 500 : 700,
                      margin: '0 0 4px 0',
                      color: 'var(--black)'
                    }}>
                      {n.title}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--gray-600)', margin: '0 0 4px 0', lineHeight: 1.4 }}>
                      {n.message}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--gray-400)', margin: 0 }}>
                      {getRelativeTime(n.createdAt)}
                    </p>
                  </div>
                  {!n.isRead && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warm-taupe)', marginTop: '6px' }} />}
                </div>
              ))
            )}
          </div>

          {notifications.length > 10 && (
            <div style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid var(--gray-100)',
              textAlign: 'center'
            }}>
              <a href="/admin/notifications" style={{
                fontSize: '0.875rem',
                color: 'var(--warm-taupe)',
                textDecoration: 'none',
                fontWeight: 600
              }}>
                View all notifications
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
