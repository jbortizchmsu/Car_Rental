import React, { useEffect, useState } from 'react';
import { Bell, Check, CheckCircle2, Clock, Info, Loader2, X } from 'lucide-react';
import { notificationsApi } from '../services/api';

const CustomerNotificationsPage: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await notificationsApi.getNotifications();
      setNotifications(data);
    } catch (err) {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleNotificationClick = async (notification: any) => {
    setSelectedNotification(notification);
    
    if (!notification.isRead) {
      try {
        await notificationsApi.markAsRead(notification.id);
        setNotifications(notifications.map(n => n.id === notification.id ? { ...n, isRead: true } : n));
        window.dispatchEvent(new CustomEvent('notifications-updated'));
      } catch (err) {
        console.error('Failed to mark as read', err);
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
        <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Notifications</h1>
          <p style={{ color: 'var(--gray-50)' }}>
            {unreadCount > 0 ? `You have ${unreadCount} unread messages` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={markAllAsRead}
            className="btn-outline" 
            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
          >
            <CheckCircle2 size={18} />
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ backgroundColor: 'var(--gray-50)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <Bell size={32} color="var(--gray-300)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No notifications yet</h3>
          <p style={{ color: 'var(--gray-500)' }}>We'll notify you when there are updates on your bookings.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {notifications.map((notification) => (
            <button 
              key={notification.id} 
              onClick={() => handleNotificationClick(notification)}
              className="card" 
              aria-label="View notification details"
              style={{ 
                padding: '1.25rem',
                borderLeft: notification.isRead ? '1px solid var(--gray-200)' : '4px solid var(--warm-taupe)',
                backgroundColor: notification.isRead ? 'var(--white)' : 'rgba(173, 155, 141, 0.03)',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-start',
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer'
              }}
            >
              <div style={{ 
                backgroundColor: notification.isRead ? 'var(--gray-50)' : 'var(--soft-beige)', 
                padding: '0.75rem', 
                borderRadius: '12px',
                color: notification.isRead ? 'var(--gray-400)' : 'var(--white)'
              }}>
                {notification.title.toLowerCase().includes('payment') ? <Check size={20} /> : <Info size={20} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>{notification.title}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} />
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ 
                  color: 'var(--gray-600)', 
                  margin: 0, 
                  fontSize: '0.95rem', 
                  lineHeight: 1.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}>
                  {notification.message}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '2rem'
        }}>
          <div className="card" style={{
            maxWidth: '500px',
            width: '100%',
            padding: '2rem',
            position: 'relative',
            animation: 'dropdownFade 0.2s ease-out'
          }}>
            <button 
              onClick={() => setSelectedNotification(null)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                color: 'var(--gray-400)',
                padding: '0.25rem'
              }}
            >
              <X size={24} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ 
                backgroundColor: 'var(--soft-beige)', 
                padding: '0.75rem', 
                borderRadius: '12px',
                color: 'var(--white)'
              }}>
                {selectedNotification.title.toLowerCase().includes('payment') ? <Check size={24} /> : <Info size={24} />}
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Notification Details</h2>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{selectedNotification.title}</h3>
              <p style={{ color: 'var(--gray-600)', fontSize: '1rem', lineHeight: 1.6, margin: 0 }}>
                {selectedNotification.message}
              </p>
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              color: 'var(--gray-400)', 
              fontSize: '0.85rem',
              borderTop: '1px solid var(--gray-100)',
              paddingTop: '1.5rem'
            }}>
              <Clock size={16} />
              Received on {new Date(selectedNotification.createdAt).toLocaleString()}
            </div>

            <button 
              onClick={() => setSelectedNotification(null)}
              className="btn-primary" 
              style={{ width: '100%', marginTop: '2rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerNotificationsPage;
