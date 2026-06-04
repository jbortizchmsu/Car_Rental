// Frontend notification type definitions and utilities

export const NotificationType = {
  BOOKING_PICKUP_DUE: 'BOOKING_PICKUP_DUE',
  BOOKING_RETURN_OVERDUE: 'BOOKING_RETURN_OVERDUE',
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
  NEW_BOOKING_REQUEST: 'NEW_BOOKING_REQUEST',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  MAINTENANCE_DUE_CONFLICT: 'MAINTENANCE_DUE_CONFLICT',
  MAINTENANCE_DUE_SOON: 'MAINTENANCE_DUE_SOON',
  GEOFENCE_BREACH: 'GEOFENCE_BREACH',
  GPS_SIGNAL_LOST: 'GPS_SIGNAL_LOST',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  GENERAL: 'GENERAL',
} as const;

export const notificationTypeColors: Record<string, string> = {
  [NotificationType.BOOKING_RETURN_OVERDUE]: '#DC2626',
  [NotificationType.BOOKING_PICKUP_DUE]: '#F59E0B',
  [NotificationType.PAYMENT_SUBMITTED]: '#0284C7',
  [NotificationType.GEOFENCE_BREACH]: '#DC2626',
  [NotificationType.GPS_SIGNAL_LOST]: '#DC2626',
  [NotificationType.MAINTENANCE_DUE_SOON]: '#EAB308',
  [NotificationType.NEW_BOOKING_REQUEST]: '#16A34A',
  [NotificationType.DOCUMENT_UPLOADED]: '#0284C7',
  [NotificationType.BOOKING_EXPIRED]: '#DC2626',
  [NotificationType.PAYMENT_REJECTED]: '#DC2626',
  [NotificationType.MAINTENANCE_DUE_CONFLICT]: '#DC2626',
  [NotificationType.GENERAL]: 'var(--warm-taupe)',
};

export function getRelativeTime(date: string | Date): string {
  const createdAt = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return createdAt.toLocaleDateString();
}
