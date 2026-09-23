import React, { useEffect, useState } from 'react';
import { 
  Bell, CheckCircle2, Clock, Info, Loader2, X, AlertTriangle, 
  CreditCard, AlertCircle, Wrench, Calendar, FileText 
} from 'lucide-react';
import { notificationsApi } from '../services/api';
import { connectAuthedSocket } from '../utils/socket';
import { useInitialLoad } from '../utils/useInitialLoad';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { SkeletonGroup, SkeletonListRow } from '../components/Skeleton';
import { formatDate } from '../utils/formatDate';
import { getRelativeTime, notificationTypeColors } from '../lib/notification-types';

const PAGE_SIZE = 20;

const extractList = (responseData: any): any[] => 
  (Array.isArray(responseData) ? responseData : responseData?.data || []);

const extractHasMore = (responseData: any): boolean => 
  (Array.isArray(responseData) ? false : !!responseData?.hasMore);

const IconMap: Record<string, React.ReactNode> = {
  AlertTriangle: <AlertTriangle size={20} />,
  Clock: <Clock size={20} />,
  CreditCard: <CreditCard size={20} />,
  AlertCircle: <AlertCircle size={20} />,
  Wrench: <Wrench size={20} />,
  Calendar: <Calendar size={20} />,
  FileText: <FileText size={20} />,
  Info: <Info size={20} />,
};

const getIconForType = (type?: string): React.ReactNode => {
  const typeMap: Record<string, string> = {
    BOOKING_RETURN_OVERDUE: 'AlertTriangle',
    BOOKING_PICKUP_DUE: 'Clock',
    PAYMENT_SUBMITTED: 'CreditCard',
    GEOFENCE_BREACH: 'AlertTriangle',
    GPS_SIGNAL_LOST: 'AlertCircle',
    MAINTENANCE_DUE_SOON: 'Wrench',
    NEW_BOOKING_REQUEST: 'Calendar',
    DOCUMENT_UPLOADED: 'FileText',
    BOOKING_EXPIRED: 'AlertTriangle',
    PAYMENT_REJECTED: 'AlertTriangle',
    MAINTENANCE_DUE_CONFLICT: 'AlertTriangle',
    GENERAL: 'Info',
  };
  const iconName = type ? typeMap[type] || 'Info' : 'Info';
  return IconMap[iconName] || <Info size={20} />;
};

const isAlertNotification = (type?: string): boolean => {
  if (!type) return false;
  return [
    'BOOKING_RETURN_OVERDUE',
    'GEOFENCE_BREACH',
    'GPS_SIGNAL_LOST',
    'PAYMENT_REJECTED',
    'MAINTENANCE_DUE_CONFLICT',
    'BOOKING_EXPIRED'
  ].includes(type);
};

const AdminNotificationsPage: React.FC = () => {
  const { setPageHeader } = usePageHeader();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | 'ALERTS'>('ALL');
  const [selectedNotification, setSelectedNotification] = useState<any | null>(null);

  const isInitialLoad = useInitialLoad(loading);
  useBodyScrollLock(selectedNotification !== null);

  useEffect(() => {
    setPageHeader({
      title: 'Notifications',
      subtitle: 'System alerts, booking updates, and administrative activities'
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  useEffect(() => {
    fetchNotifications();

    const socket = connectAuthedSocket();

    socket.on('notification-created', (newNotif: any) => {
      setNotifications(prev => [newNotif, ...prev]);
    });

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
  }, []);

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

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await notificationsApi.getNotifications({ skip: 0, take: PAGE_SIZE });
      setNotifications(extractList(data));
      setHasMore(extractHasMore(data));
    } catch (err) {
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data } = await notificationsApi.getNotifications({
        skip: notifications.length,
        take: PAGE_SIZE
      });
      setNotifications(prev => [...prev, ...extractList(data)]);
      setHasMore(extractHasMore(data));
    } catch (err) {
      setError('Failed to load more notifications');
    } finally {
      setLoadingMore(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      window.dispatchEvent(new CustomEvent('notifications-updated'));
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleNotificationClick = (notification: any) => {
    setSelectedNotification(notification);
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const alertCount = notifications.filter(n => isAlertNotification(n.type)).length;

  const filteredNotifications = notifications.filter(n => {
    if (activeFilter === 'UNREAD') return !n.isRead;
    if (activeFilter === 'ALERTS') return isAlertNotification(n.type);
    return true;
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Toolbar & Filter Tabs */}
      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setActiveFilter('ALL')}
            className={`btn-outline ${activeFilter === 'ALL' ? 'active' : ''}`}
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '20px',
              backgroundColor: activeFilter === 'ALL' ? 'var(--black)' : 'transparent',
              color: activeFilter === 'ALL' ? 'var(--white)' : 'var(--gray-600)',
              borderColor: activeFilter === 'ALL' ? 'var(--black)' : 'var(--gray-200)'
            }}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter('UNREAD')}
            className={`btn-outline ${activeFilter === 'UNREAD' ? 'active' : ''}`}
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '20px',
              backgroundColor: activeFilter === 'UNREAD' ? 'var(--black)' : 'transparent',
              color: activeFilter === 'UNREAD' ? 'var(--white)' : 'var(--gray-600)',
              borderColor: activeFilter === 'UNREAD' ? 'var(--black)' : 'var(--gray-200)'
            }}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setActiveFilter('ALERTS')}
            className={`btn-outline ${activeFilter === 'ALERTS' ? 'active' : ''}`}
            style={{
              padding: '0.4rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '20px',
              backgroundColor: activeFilter === 'ALERTS' ? 'var(--black)' : 'transparent',
              color: activeFilter === 'ALERTS' ? 'var(--white)' : 'var(--gray-600)',
              borderColor: activeFilter === 'ALERTS' ? 'var(--black)' : 'var(--gray-200)'
            }}
          >
            Alerts ({alertCount})
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn-outline"
            style={{ fontSize: '0.85rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <CheckCircle2 size={16} />
            Mark all as read
          </button>
        )}
      </div>

      {error && (
        <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {/* Notifications List */}
      {isInitialLoad ? (
        <div className="card" style={{ padding: '1.5rem' }}>
          <SkeletonGroup>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonListRow key={i} />
            ))}
          </SkeletonGroup>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ backgroundColor: 'var(--gray-50)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <Bell size={32} color="var(--gray-300)" />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>
            {activeFilter === 'UNREAD' ? 'No unread notifications' : activeFilter === 'ALERTS' ? 'No active alerts' : 'No notifications yet'}
          </h3>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem' }}>
            {activeFilter === 'UNREAD' ? 'You are all caught up!' : 'System and booking notifications will appear here in real-time.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredNotifications.map(notification => {
            const accentColor = notification.type && notificationTypeColors[notification.type] 
              ? notificationTypeColors[notification.type] 
              : 'var(--warm-taupe)';

            return (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="card"
                style={{
                  padding: '1.25rem 1.5rem',
                  borderLeft: notification.isRead ? '1px solid var(--gray-200)' : `4px solid ${accentColor}`,
                  backgroundColor: notification.isRead ? 'var(--white)' : 'rgba(173, 155, 141, 0.03)',
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                <div style={{
                  padding: '0.6rem',
                  borderRadius: '12px',
                  backgroundColor: notification.isRead ? 'var(--gray-50)' : 'var(--soft-beige)',
                  color: notification.isRead ? 'var(--gray-500)' : accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getIconForType(notification.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.35rem' }}>
                    <h4 style={{ margin: 0, fontWeight: notification.isRead ? 700 : 800, fontSize: '1rem', color: 'var(--black)' }}>
                      {notification.title}
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                      <Clock size={12} />
                      {getRelativeTime(notification.createdAt)}
                    </span>
                  </div>
                  <p style={{ color: 'var(--gray-600)', margin: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>
                    {notification.message}
                  </p>
                </div>

                {!notification.isRead && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: accentColor, marginTop: '6px', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Load More */}
      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-outline"
            style={{ fontSize: '0.9rem', padding: '0.6rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
            {loadingMore ? 'Loading more...' : 'Load More Notifications'}
          </button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedNotification && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '1.5rem'
          }}
          onClick={() => setSelectedNotification(null)}
        >
          <div 
            className="card" 
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '2rem',
              position: 'relative',
              animation: 'modalFadeUp 0.25s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setSelectedNotification(null)}
              style={{
                position: 'absolute',
                top: '1.25rem',
                right: '1.25rem',
                background: 'none',
                border: 'none',
                color: 'var(--gray-400)',
                cursor: 'pointer',
                padding: '0.25rem'
              }}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{
                padding: '0.75rem',
                borderRadius: '12px',
                backgroundColor: 'var(--soft-beige)',
                color: selectedNotification.type && notificationTypeColors[selectedNotification.type] 
                  ? notificationTypeColors[selectedNotification.type] 
                  : 'var(--black)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {getIconForType(selectedNotification.type)}
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                  {selectedNotification.title}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
                  {selectedNotification.type || 'SYSTEM'}
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: 'var(--gray-50)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid var(--gray-200)' }}>
              <p style={{ color: 'var(--gray-800)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                {selectedNotification.message}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gray-400)', fontSize: '0.8rem', borderTop: '1px solid var(--gray-100)', paddingTop: '1rem' }}>
              <Clock size={14} />
              Received on {formatDate(selectedNotification.createdAt, 'datetime')}
            </div>

            <button
              onClick={() => setSelectedNotification(null)}
              className="btn-primary"
              style={{ width: '100%', marginTop: '1.5rem' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotificationsPage;
