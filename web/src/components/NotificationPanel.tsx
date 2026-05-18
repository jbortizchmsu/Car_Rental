import React, { useEffect, useState } from 'react';
import { Bell, Info, AlertTriangle, X } from 'lucide-react';
import { notificationsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { io } from 'socket.io-client';

const NotificationPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { user } = useAuth(); // Keeping for room join but removing if not used else where? Wait, let's just remove the warning.

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
      setNotifications(response.data);
      setUnreadCount(response.data.filter((n: any) => !n.isRead).length);
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
              notifications.map((n) => (
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
                  <div style={{ marginTop: '3px' }}>
                    {n.title.toLowerCase().includes('critical') || n.title.toLowerCase().includes('breach') ? (
                      <AlertTriangle size={18} color="var(--status-rented)" />
                    ) : (
                      <Info size={18} color="var(--warm-taupe)" />
                    )}
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
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {!n.isRead && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--warm-taupe)', marginTop: '6px' }} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
