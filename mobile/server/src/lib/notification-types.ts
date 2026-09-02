// Notification Type Definitions and Utilities

export enum NotificationType {
  // Booking notifications
  BOOKING_PICKUP_DUE = 'BOOKING_PICKUP_DUE',                     // Pickup in ≤24 hrs, no confirmed payment
  BOOKING_RETURN_OVERDUE = 'BOOKING_RETURN_OVERDUE',             // Past return date, rental still active (legacy)
  BOOKING_RETURN_OVERDUE_T1 = 'BOOKING_RETURN_OVERDUE_T1',       // 30 min – 3 hrs overdue
  BOOKING_RETURN_OVERDUE_T2 = 'BOOKING_RETURN_OVERDUE_T2',       // 3 hrs – 24 hrs overdue
  BOOKING_RETURN_OVERDUE_T3 = 'BOOKING_RETURN_OVERDUE_T3',       // 24+ hrs overdue
  BOOKING_EXPIRED = 'BOOKING_EXPIRED',                           // Booking auto-cancelled due to no payment
  NEW_BOOKING_REQUEST = 'NEW_BOOKING_REQUEST',                   // Customer submitted new booking

  // Payment notifications
  PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',           // Customer submitted payment proof
  PAYMENT_REJECTED = 'PAYMENT_REJECTED',             // Admin rejected payment, customer notified

  // Maintenance notifications
  MAINTENANCE_DUE_CONFLICT = 'MAINTENANCE_DUE_CONFLICT',   // Vehicle due for service has upcoming booking
  MAINTENANCE_DUE_SOON = 'MAINTENANCE_DUE_SOON',           // Vehicle within 500km of service threshold

  // GPS & Location notifications
  GEOFENCE_BREACH = 'GEOFENCE_BREACH',                    // Vehicle GPS exited declared zone
  GPS_SIGNAL_LOST = 'GPS_SIGNAL_LOST',                    // No GPS ping from active rental vehicle >15 min

  // Document notifications
  DOCUMENT_UPLOADED = 'DOCUMENT_UPLOADED',                // Customer uploaded required documents
}

// Type to icon mapping (for frontend)
export const notificationTypeIcons: Record<NotificationType, string> = {
  [NotificationType.BOOKING_RETURN_OVERDUE]: 'AlertTriangle',
  [NotificationType.BOOKING_RETURN_OVERDUE_T1]: 'AlertTriangle',
  [NotificationType.BOOKING_RETURN_OVERDUE_T2]: 'AlertTriangle',
  [NotificationType.BOOKING_RETURN_OVERDUE_T3]: 'AlertTriangle',
  [NotificationType.BOOKING_PICKUP_DUE]: 'Clock',
  [NotificationType.PAYMENT_SUBMITTED]: 'CreditCard',
  [NotificationType.GEOFENCE_BREACH]: 'AlertTriangle',
  [NotificationType.GPS_SIGNAL_LOST]: 'Signal',
  [NotificationType.MAINTENANCE_DUE_SOON]: 'Wrench',
  [NotificationType.NEW_BOOKING_REQUEST]: 'Calendar',
  [NotificationType.DOCUMENT_UPLOADED]: 'FileText',
  [NotificationType.BOOKING_EXPIRED]: 'X',
  [NotificationType.PAYMENT_REJECTED]: 'AlertTriangle',
  [NotificationType.MAINTENANCE_DUE_CONFLICT]: 'AlertTriangle',
};

// Type to color mapping (Bootstrap color classes or hex)
export const notificationTypeColors: Record<NotificationType, string> = {
  [NotificationType.BOOKING_RETURN_OVERDUE]: '#DC2626',   // red (legacy)
  [NotificationType.BOOKING_RETURN_OVERDUE_T1]: '#F59E0B', // amber — warning
  [NotificationType.BOOKING_RETURN_OVERDUE_T2]: '#EA580C', // orange-red — urgent
  [NotificationType.BOOKING_RETURN_OVERDUE_T3]: '#DC2626', // red — critical
  [NotificationType.BOOKING_PICKUP_DUE]: '#F59E0B',        // amber/orange
  [NotificationType.PAYMENT_SUBMITTED]: '#0284C7',      // blue
  [NotificationType.GEOFENCE_BREACH]: '#DC2626',        // red
  [NotificationType.GPS_SIGNAL_LOST]: '#DC2626',        // red
  [NotificationType.MAINTENANCE_DUE_SOON]: '#EAB308',   // yellow
  [NotificationType.NEW_BOOKING_REQUEST]: '#16A34A',    // green
  [NotificationType.DOCUMENT_UPLOADED]: '#0284C7',      // blue
  [NotificationType.BOOKING_EXPIRED]: '#DC2626',        // red
  [NotificationType.PAYMENT_REJECTED]: '#DC2626',       // red
  [NotificationType.MAINTENANCE_DUE_CONFLICT]: '#DC2626', // red
};

// Generate human-readable message templates
export function generateNotificationMessage(
  type: NotificationType,
  context: Record<string, any>
): { title: string; message: string } {
  switch (type) {
    case NotificationType.BOOKING_RETURN_OVERDUE:
      return {
        title: 'Rental Overdue',
        message: `Rental #${context.bookingId} — Customer is ${context.hoursOverdue} hours overdue. Vehicle: ${context.licensePlate}`
      };

    case NotificationType.BOOKING_RETURN_OVERDUE_T1:
      return {
        title: 'Rental Overdue',
        message: `Rental #${context.bookingId} — ${context.customerName} is ${context.hoursOverdue} hour(s) overdue. Vehicle: ${context.licensePlate}.`
      };

    case NotificationType.BOOKING_RETURN_OVERDUE_T2:
      return {
        title: 'Urgent: Rental Overdue',
        message: `URGENT: Rental #${context.bookingId} — ${context.customerName} is ${context.hoursOverdue} hours overdue. Vehicle: ${context.licensePlate}. Immediate action required.`
      };

    case NotificationType.BOOKING_RETURN_OVERDUE_T3:
      return {
        title: 'Critical: Rental Overdue',
        message: `CRITICAL: Rental #${context.bookingId} — ${context.customerName} is MORE THAN 24 HOURS overdue. Vehicle: ${context.licensePlate}. Immediate escalation required.`
      };

    case NotificationType.BOOKING_PICKUP_DUE:
      return {
        title: 'Pickup Due Soon',
        message: `Booking #${context.bookingId} — Pickup in ${context.hoursUntilPickup} hours. No payment verified yet.`
      };

    case NotificationType.PAYMENT_SUBMITTED:
      return {
        title: 'Payment Submitted',
        message: `Payment for Booking #${context.bookingId} by ${context.customerName}. Awaiting verification.`
      };

    case NotificationType.GEOFENCE_BREACH:
      return {
        title: 'Geofence Breach',
        message: `Vehicle ${context.licensePlate} exited geofence zone for Rental #${context.bookingId}.`
      };

    case NotificationType.GPS_SIGNAL_LOST:
      return {
        title: 'GPS Signal Lost',
        message: `No GPS signal from Vehicle ${context.licensePlate} (Rental #${context.bookingId}) for ${context.minutesLost} minutes.`
      };

    case NotificationType.MAINTENANCE_DUE_SOON:
      return {
        title: 'Service Due Soon',
        message: `${context.vehicleName} (${context.licensePlate}) is ${context.kmUntilService} km from service threshold.`
      };

    case NotificationType.NEW_BOOKING_REQUEST:
      return {
        title: 'New Booking Request',
        message: `${context.customerName} submitted a booking for ${context.vehicleModel}. Booking: #${context.bookingId}`
      };

    case NotificationType.DOCUMENT_UPLOADED:
      return {
        title: 'Documents Uploaded',
        message: `${context.customerName} uploaded documents for Booking #${context.bookingId}.`
      };

    case NotificationType.BOOKING_EXPIRED:
      return {
        title: 'Booking Expired',
        message: `Booking #${context.bookingId} expired due to no payment confirmation.`
      };

    case NotificationType.PAYMENT_REJECTED:
      return {
        title: 'Payment Rejected',
        message: `Payment for Booking #${context.bookingId} was rejected. Customer notified.`
      };

    case NotificationType.MAINTENANCE_DUE_CONFLICT:
      return {
        title: 'Maintenance Conflict',
        message: `${context.vehicleName} is due for service but has an upcoming booking on ${context.bookingDate}.`
      };

    default:
      return { title: 'Notification', message: context.message || 'New activity' };
  }
}
