import React from 'react';

interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, { bg: string, text: string, label?: string }> = {
  // Booking Statuses
  'PENDING_REVIEW': { bg: '#FFF3E0', text: '#E65100', label: 'Waiting for Review' },
  'APPROVED_FOR_PAYMENT': { bg: '#E3F2FD', text: '#1565C0', label: 'Approved' },
  'REJECTED': { bg: '#FFEBEE', text: '#C62828', label: 'Rejected' },
  'FULL_PAYMENT_SUBMITTED': { bg: '#FFFDE7', text: '#F57F17', label: 'Payment Verification' },
  'DOWNPAYMENT_SUBMITTED': { bg: '#FFFDE7', text: '#F57F17', label: 'Downpayment Verification' },
  'RESERVED': { bg: '#E3F2FD', text: '#1565C0', label: 'Reserved' },
  'READY_FOR_PICKUP': { bg: '#E8F5E9', text: '#2E7D32', label: 'Ready for Pickup' },
  'ACTIVE': { bg: '#F3E5F5', text: '#7B1FA2', label: 'Rental Active' },
  'RETURNED': { bg: '#E0F2F1', text: '#00695C', label: 'Returned' },
  'COMPLETED': { bg: '#E8F5E9', text: '#2E7D32', label: 'Completed' },
  'CANCELLED': { bg: '#FFEBEE', text: '#C62828', label: 'Cancelled' },
  
  // Payment Statuses
  'PENDING': { bg: '#F5F5F5', text: '#616161', label: 'Pending' },
  'SUBMITTED': { bg: '#FFFDE7', text: '#F57F17', label: 'Submitted' },
  'VERIFIED': { bg: '#E8F5E9', text: '#2E7D32', label: 'Verified' },
  'PAID_IN_PERSON': { bg: '#E0F7FA', text: '#00796B', label: 'Paid in Person' },

  // Vehicle Statuses
  'AVAILABLE': { bg: '#E8F5E9', text: '#2E7D32', label: 'Available' },
  'RESERVED_VEHICLE': { bg: '#E3F2FD', text: '#1565C0', label: 'Reserved' },
  'RENTED': { bg: '#F3E5F5', text: '#7B1FA2', label: 'Rented' },
  'UNDER_MAINTENANCE': { bg: '#FFF3E0', text: '#E65100', label: 'Maintenance' },
  'RETIRED': { bg: '#BDBDBD', text: '#212121', label: 'Retired' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const style = statusStyles[status] || { bg: '#F5F5F5', text: '#616161' };
  
  return (
    <span style={{
      padding: '0.35rem 0.8rem',
      borderRadius: '20px',
      fontSize: '0.75rem',
      fontWeight: 700,
      backgroundColor: style.bg,
      color: style.text,
      display: 'inline-block',
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      {style.label || status.replace(/_/g, ' ')}
    </span>
  );
};

export default StatusBadge;
