import React, { useEffect, useState } from 'react';
import { bookingsApi, filesApi, paymentsApi } from '../services/api';
import { 
  Loader2, X, FileText, User, 
  Phone, MapPin, ExternalLink,
  Smartphone, CreditCard, Clock, Search,
  ArrowUpDown, CheckCircle2,
  AlertTriangle, History, ShieldCheck, Mail, Navigation, Banknote
} from 'lucide-react';
import FilePreviewModal from '../components/FilePreviewModal';
import StatusBadge from '../components/StatusBadge';

type BookingTab = 'PENDING_REVIEW' | 'WAITING_FOR_PAYMENT' | 'PAYMENT_SUBMITTED' | 'READY_FOR_PICKUP' | 'ACTIVE_RENTALS' | 'RETURNED' | 'COMPLETED' | 'REJECTED';

interface StatusCounts {
  PENDING_REVIEW: number;
  WAITING_FOR_PAYMENT: number;
  PAYMENT_SUBMITTED: number;
  READY_FOR_PICKUP: number;
  ACTIVE_RENTALS: number;
  RETURNED: number;
  COMPLETED: number;
  REJECTED: number;
}

const BookingRequestsPage: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<BookingTab>('PENDING_REVIEW');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: string; title: string } | null>(null);
  
  // New States
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [counts, setCounts] = useState<StatusCounts>({
    PENDING_REVIEW: 0,
    WAITING_FOR_PAYMENT: 0,
    PAYMENT_SUBMITTED: 0,
    READY_FOR_PICKUP: 0,
    ACTIVE_RENTALS: 0,
    RETURNED: 0,
    COMPLETED: 0,
    REJECTED: 0
  });

  // Release Workflow State
  const [releaseOdometer, setReleaseOdometer] = useState('');
  const [checklistConfirmed, setChecklistConfirmed] = useState(false);
  const [agreementSigned, setAgreementSigned] = useState(false);

  // Return Workflow State
  const [returnOdometer, setReturnOdometer] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  const [damageFound, setDamageFound] = useState(false);
  const [damageDetails, setDamageDetails] = useState({ type: 'GENERAL', severity: 'LOW', cost: '', desc: '' });

  // Modal State
  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);
  const [cashConfirmError, setCashConfirmError] = useState<string | null>(null);

  useEffect(() => {
    fetchBookings();
    fetchSummaryCounts();
  }, [activeTab]);

  const fetchSummaryCounts = async () => {
    try {
      // Fetching all relevant statuses to calculate counts
      const statuses = [
        'PENDING_REVIEW', 
        'APPROVED_FOR_PAYMENT', 
        'FULL_PAYMENT_SUBMITTED', 
        'DOWNPAYMENT_SUBMITTED', 
        'RESERVED', 
        'READY_FOR_PICKUP', 
        'REJECTED', 
        'COMPLETED', 
        'CANCELLED', 
        'RETURNED', 
        'ACTIVE'
      ];
      const { data } = await bookingsApi.getActiveList(statuses);
      
      const newCounts: StatusCounts = {
        PENDING_REVIEW: 0,
        WAITING_FOR_PAYMENT: 0,
        PAYMENT_SUBMITTED: 0,
        READY_FOR_PICKUP: 0,
        ACTIVE_RENTALS: 0,
        RETURNED: 0,
        COMPLETED: 0,
        REJECTED: 0
      };

      data.forEach((b: any) => {
        if (b.status === 'PENDING_REVIEW') newCounts.PENDING_REVIEW++;
        else if (b.status === 'APPROVED_FOR_PAYMENT') newCounts.WAITING_FOR_PAYMENT++;
        else if (['FULL_PAYMENT_SUBMITTED', 'DOWNPAYMENT_SUBMITTED'].includes(b.status)) newCounts.PAYMENT_SUBMITTED++;
        else if (['RESERVED', 'READY_FOR_PICKUP'].includes(b.status)) newCounts.READY_FOR_PICKUP++;
        else if (b.status === 'ACTIVE') newCounts.ACTIVE_RENTALS++;
        else if (b.status === 'RETURNED') newCounts.RETURNED++;
        else if (b.status === 'COMPLETED') newCounts.COMPLETED++;
        else if (b.status === 'REJECTED') newCounts.REJECTED++;
      });

      setCounts(newCounts);
    } catch (error) {
      console.error('Error fetching summary counts:', error);
    }
  };

  const getStatusQuery = (tab: BookingTab): string | string[] => {
    switch (tab) {
      case 'PENDING_REVIEW': return 'PENDING_REVIEW';
      case 'WAITING_FOR_PAYMENT': return 'APPROVED_FOR_PAYMENT';
      case 'PAYMENT_SUBMITTED': return ['FULL_PAYMENT_SUBMITTED', 'DOWNPAYMENT_SUBMITTED'];
      case 'READY_FOR_PICKUP': return ['RESERVED', 'READY_FOR_PICKUP'];
      case 'ACTIVE_RENTALS': return 'ACTIVE';
      case 'RETURNED': return 'RETURNED';
      case 'COMPLETED': return 'COMPLETED';
      case 'REJECTED': return 'REJECTED';
      default: return 'PENDING_REVIEW';
    }
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data } = await bookingsApi.getActiveList(getStatusQuery(activeTab));
      setBookings(data || []);
      
      // If selected booking is in the list, refresh its data
      if (selectedBooking) {
        const updated = data.find((b: any) => b.id === selectedBooking.id);
        if (updated) setSelectedBooking(updated);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingAction = async (status: 'APPROVED_FOR_PAYMENT' | 'REJECTED') => {
    if (!selectedBooking) return;
    if (status === 'REJECTED' && !remarks) {
      alert('Please provide a reason for rejection.');
      return;
    }

    setActionLoading(true);
    try {
      if (status === 'APPROVED_FOR_PAYMENT') {
        await bookingsApi.approve(selectedBooking.id);
      } else {
        await bookingsApi.reject(selectedBooking.id, remarks);
      }

      setRemarks('');
      // If it moved out of the current tab, deselect it
      if (activeTab === 'PENDING_REVIEW') setSelectedBooking(null);
      fetchBookings();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update booking status.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaymentAction = async (paymentId: string, action: 'VERIFY' | 'REJECT') => {
    if (action === 'REJECT' && !remarks) {
      alert('Please provide a reason for payment rejection.');
      return;
    }

    setActionLoading(true);
    try {
      if (action === 'VERIFY') {
        await paymentsApi.verify(paymentId);
      } else {
        await paymentsApi.reject(paymentId, remarks);
      }
      setRemarks('');
      fetchBookings();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to process payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCashClick = () => {
    setCashConfirmError(null);
    setShowCashConfirmModal(true);
  };

  const submitCashConfirm = async () => {
    if (!selectedBooking) return;
    const paidAmount = selectedBooking.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0;
    const remaining = Number(selectedBooking.totalAmount) - paidAmount;

    setActionLoading(true);
    setCashConfirmError(null);
    try {
      await paymentsApi.confirmCash(selectedBooking.id, remaining);
      setShowCashConfirmModal(false);
      fetchBookings();
    } catch (error: any) {
      setCashConfirmError(error.response?.data?.error || 'Failed to confirm cash payment.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReleaseVehicle = async () => {
    if (!selectedBooking) return;
    if (!agreementSigned && !selectedBooking.agreementSignedAt) return alert('Rental agreement must be signed before release.');
    if (!checklistConfirmed) return alert('Release checklist must be confirmed.');
    if (!releaseOdometer) return alert('Release odometer is required.');

    setActionLoading(true);
    try {
      if (!selectedBooking.agreementSignedAt && agreementSigned) {
        await bookingsApi.signAgreement(selectedBooking.id, selectedBooking.customer?.fullName || 'Customer');
      }
      await bookingsApi.releaseVehicle(selectedBooking.id, {
        odometer: releaseOdometer,
        notes: 'Released via centralized dashboard',
        checklistConfirmed: true
      });
      setReleaseOdometer('');
      setChecklistConfirmed(false);
      setAgreementSigned(false);
      fetchBookings();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to release vehicle.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnVehicle = async () => {
    if (!selectedBooking) return;
    if (!returnOdometer) return alert('Return odometer is required.');

    setActionLoading(true);
    try {
      await bookingsApi.markReturned(selectedBooking.id, {
        odometer: returnOdometer,
        notes: returnNotes,
        damageFound,
        damageDetails: damageFound ? damageDetails : null
      });
      setReturnOdometer('');
      setReturnNotes('');
      setDamageFound(false);
      setDamageDetails({ type: 'GENERAL', severity: 'LOW', cost: '', desc: '' });
      fetchBookings();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to return vehicle.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRental = async () => {
    if (!selectedBooking) return;
    setActionLoading(true);
    try {
      await bookingsApi.completeRental(selectedBooking.id, { maintenance: false });
      fetchBookings();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to complete rental.');
    } finally {
      setActionLoading(false);
    }
  };

  const renderTimeline = (booking: any) => {
    const steps = [
      { label: 'Request Submitted', done: true, time: booking.createdAt },
      { label: 'Admin Approved', done: booking.status !== 'PENDING_REVIEW' && booking.status !== 'REJECTED', time: booking.approvedAt },
      { label: 'Payment Submitted', done: ['FULL_PAYMENT_SUBMITTED', 'DOWNPAYMENT_SUBMITTED', 'RESERVED', 'READY_FOR_PICKUP', 'ACTIVE', 'RETURNED', 'COMPLETED'].includes(booking.status), time: booking.payments?.[0]?.createdAt },
      { label: 'Payment Verified', done: ['RESERVED', 'READY_FOR_PICKUP', 'ACTIVE', 'RETURNED', 'COMPLETED'].includes(booking.status), time: booking.payments?.find((p: any) => p.status === 'VERIFIED')?.verifiedAt },
      { label: 'Ready for Pickup', done: ['READY_FOR_PICKUP', 'ACTIVE', 'RETURNED', 'COMPLETED'].includes(booking.status), time: booking.remainingBalancePaidAt || booking.payments?.find((p: any) => p.status === 'VERIFIED')?.verifiedAt },
      { label: 'Vehicle Released', done: ['ACTIVE', 'RETURNED', 'COMPLETED'].includes(booking.status), time: booking.releasedAt },
      { label: 'Returned', done: ['RETURNED', 'COMPLETED'].includes(booking.status), time: booking.returnedAt },
      { label: 'Completed', done: booking.status === 'COMPLETED', time: booking.completedAt }
    ];

    return (
      <div className="booking-timeline">
        {steps.map((step, idx) => (
          <div key={idx} className={`timeline-step ${step.done ? 'completed' : ''}`}>
            <div className="timeline-dot"></div>
            <div className="timeline-label">{step.label}</div>
            {step.done && step.time && (
              <div className="timeline-time">{new Date(step.time).toLocaleString()}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const filteredBookings = bookings.filter(b => {
    const searchLower = searchQuery.toLowerCase();
    return (
      b.customer?.fullName?.toLowerCase().includes(searchLower) ||
      b.customer?.email?.toLowerCase().includes(searchLower) ||
      b.vehicle.brand.toLowerCase().includes(searchLower) ||
      b.vehicle.model.toLowerCase().includes(searchLower) ||
      b.vehicle.licensePlate.toLowerCase().includes(searchLower) ||
      b.id.toLowerCase().includes(searchLower)
    );
  }).sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    if (sortBy === 'price_high') return Number(b.totalAmount) - Number(a.totalAmount);
    if (sortBy === 'price_low') return Number(a.totalAmount) - Number(b.totalAmount);
    return 0;
  });

  const renderEmptyState = () => {
    const configs: Record<BookingTab, { title: string, subtitle: string, icon: any }> = {
      PENDING_REVIEW: { 
        title: 'No pending requests', 
        subtitle: 'New customer requests will appear here for document review.',
        icon: <Clock size={40} />
      },
      WAITING_FOR_PAYMENT: { 
        title: 'No bookings waiting for payment', 
        subtitle: 'Approved bookings will appear here until the customer submits payment.',
        icon: <CreditCard size={40} />
      },
      PAYMENT_SUBMITTED: { 
        title: 'No payments pending verification', 
        subtitle: 'Submitted GCash receipts will appear here for review.',
        icon: <Smartphone size={40} />
      },
      READY_FOR_PICKUP: { 
        title: 'No vehicles ready for pickup', 
        subtitle: 'Verified payments and completed balances will appear here.',
        icon: <CheckCircle2 size={40} />
      },
      REJECTED: { 
        title: 'No rejected bookings', 
        subtitle: 'Bookings that were not approved or had payment issues will be listed here.',
        icon: <AlertTriangle size={40} />
      },
      ACTIVE_RENTALS: { 
        title: 'No active rentals', 
        subtitle: 'Vehicles currently on the road will appear here for GPS tracking.',
        icon: <Navigation size={40} />
      },
      RETURNED: { 
        title: 'No returned vehicles pending completion', 
        subtitle: 'Vehicles returned by customers waiting for final admin sign-off.',
        icon: <ArrowUpDown size={40} />
      },
      COMPLETED: { 
        title: 'No completed rentals', 
        subtitle: 'Finished rental journeys will be archived here.',
        icon: <History size={40} />
      }
    };

    const config = configs[activeTab];

    return (
      <div className="booking-empty-state-new">
        <div style={{ color: 'var(--gray-300)', marginBottom: '1.5rem' }}>{config.icon}</div>
        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--black)', marginBottom: '0.5rem' }}>{config.title}</div>
        <div style={{ fontSize: '0.9rem', color: 'var(--gray-500)', maxWidth: '300px' }}>{config.subtitle}</div>
      </div>
    );
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING_REVIEW': return 'Pending Review';
      case 'APPROVED_FOR_PAYMENT': return 'Waiting for Payment';
      case 'FULL_PAYMENT_SUBMITTED': return 'Full Payment Submitted';
      case 'DOWNPAYMENT_SUBMITTED': return 'Downpayment Submitted';
      case 'RESERVED': return 'Balance Due';
      case 'READY_FOR_PICKUP': return 'Ready for Pickup';
      case 'ACTIVE': return 'Active Rental';
      case 'RETURNED': return 'Returned';
      case 'COMPLETED': return 'Completed';
      case 'REJECTED': return 'Rejected';
      default: return status.replace(/_/g, ' ');
    }
  };

  const renderPaymentSection = () => {
    if (!selectedBooking?.payments || selectedBooking.payments.length === 0) {
      if (selectedBooking?.status === 'APPROVED_FOR_PAYMENT') {
        return (
          <div style={{ padding: '1.5rem', backgroundColor: '#F0F9FF', borderRadius: '16px', border: '1px dashed #0EA5E9', textAlign: 'center' }}>
            <Clock size={32} color="#0EA5E9" style={{ margin: '0 auto 1rem' }} />
            <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 800, color: '#0369A1' }}>Awaiting Customer Payment</h4>
            <p style={{ fontSize: '0.85rem', color: '#0EA5E9', margin: 0 }}>The customer has not yet submitted their GCash proof of payment.</p>
          </div>
        );
      }
      return null;
    }

    const latestPayment = selectedBooking.payments[selectedBooking.payments.length - 1];
    const proof = latestPayment.proofs?.[0];
    const paidAmount = selectedBooking.payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
    const balance = Number(selectedBooking.totalAmount) - paidAmount;

    return (
      <section>
        <div className="detail-section-header">
          <CreditCard size={18} color="var(--warm-taupe)" />
          <h4>Payment Details</h4>
        </div>
        
        <div style={{ backgroundColor: 'white', border: '1px solid var(--gray-200)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '1.25rem', backgroundColor: 'var(--gray-50)', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{latestPayment.status === 'VERIFIED' ? 'Verified Payment' : 'Submitted Proof'}</span>
            </div>
            <StatusBadge status={latestPayment.status} />
          </div>

          <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 700 }}>Amount Paid</label>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>₱{Number(latestPayment.amount).toLocaleString()}</div>
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: 'var(--gray-400)', textTransform: 'uppercase', fontWeight: 700 }}>Reference #</label>
                <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'monospace' }}>{proof?.referenceNumber || 'N/A'}</div>
              </div>
            </div>

            {proof?.id && (
              <button 
                onClick={() => setPreviewFile({ id: proof.id, title: 'GCash Receipt' })}
                style={{ 
                  backgroundColor: 'var(--gray-50)', 
                  borderRadius: '12px', 
                  padding: '1rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem',
                  cursor: 'pointer',
                  border: '1px solid var(--gray-200)',
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <Smartphone size={24} color="var(--warm-taupe)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800 }}>View GCash Receipt</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Click to open secure preview</div>
                </div>
                <ExternalLink size={16} color="var(--gray-400)" />
              </button>
            )}

            {latestPayment.status === 'SUBMITTED' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <textarea 
                  className="form-textarea"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Payment remarks (required for rejection)..."
                  style={{ minHeight: '80px', fontSize: '0.85rem' }}
                />
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    onClick={() => handlePaymentAction(latestPayment.id, 'REJECT')}
                    disabled={actionLoading}
                    className="btn-outline"
                    style={{ flex: 1, color: '#C62828', borderColor: '#C62828' }}
                  >
                    Reject
                  </button>
                  <button 
                    onClick={() => handlePaymentAction(latestPayment.id, 'VERIFY')}
                    disabled={actionLoading}
                    className="btn-brand"
                    style={{ flex: 1 }}
                  >
                    Verify Payment
                  </button>
                </div>
              </div>
            )}

            {latestPayment.status === 'VERIFIED' && balance > 0 && (selectedBooking.status === 'RESERVED' || selectedBooking.status === 'READY_FOR_PICKUP') && (
              <div style={{ backgroundColor: '#F0FDF4', padding: '1.25rem', borderRadius: '16px', border: '1px solid #BBF7D0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#166534' }}>Balance Due at Pickup:</span>
                  <span style={{ fontWeight: 900, fontSize: '1.25rem', color: '#166534' }}>₱{balance.toLocaleString()}</span>
                </div>
                {selectedBooking.status === 'RESERVED' && (
                  <button 
                    onClick={handleConfirmCashClick}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{ width: '100%', backgroundColor: '#166534' }}
                  >
                    Confirm Cash Payment
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="bookings-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.5rem', color: 'var(--black)' }}>Bookings</h1>
          <p style={{ color: 'var(--gray-500)', fontWeight: 600 }}>Manage the complete rental lifecycle and customer journeys.</p>
        </div>
      </div>

      {/* Grouped Summary KPI Section */}
      <div className="bookings-summary-group">
        <div className="bookings-summary-compact">
          <h3><Clock size={20} color="var(--warm-taupe)" /> Workflow Status Summary</h3>
          <div className="booking-stat-grid">
            <div className="booking-stat-item">
              <span className="booking-stat-label">Pending</span>
              <span className="booking-stat-value" style={{ color: '#EA580C' }}>{counts.PENDING_REVIEW}</span>
            </div>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Wait Pay</span>
              <span className="booking-stat-value" style={{ color: '#0284C7' }}>{counts.WAITING_FOR_PAYMENT}</span>
            </div>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Submitted</span>
              <span className="booking-stat-value" style={{ color: '#7C3AED' }}>{counts.PAYMENT_SUBMITTED}</span>
            </div>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Ready</span>
              <span className="booking-stat-value" style={{ color: '#16A34A' }}>{counts.READY_FOR_PICKUP}</span>
            </div>
          </div>
        </div>
        
        <div className="bookings-summary-compact" style={{ flex: '0 1 400px' }}>
          <h3><CheckCircle2 size={20} color="var(--warm-taupe)" /> Outcome Summary</h3>
          <div className="booking-stat-grid">
            <div className="booking-stat-item">
              <span className="booking-stat-label">Rejected</span>
              <span className="booking-stat-value" style={{ color: '#DC2626' }}>{counts.REJECTED}</span>
            </div>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Completed</span>
              <span className="booking-stat-value" style={{ color: '#4B5563' }}>{counts.COMPLETED}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Tabs */}
      <div className="bookings-tabs-compact">
        {[
          { id: 'PENDING_REVIEW', label: 'Pending Review', count: counts.PENDING_REVIEW },
          { id: 'WAITING_FOR_PAYMENT', label: 'Waiting for Payment', count: counts.WAITING_FOR_PAYMENT },
          { id: 'PAYMENT_SUBMITTED', label: 'Payment Submitted', count: counts.PAYMENT_SUBMITTED },
          { id: 'READY_FOR_PICKUP', label: 'Ready for Pickup', count: counts.READY_FOR_PICKUP },
          { id: 'ACTIVE_RENTALS', label: 'Active Rentals', count: counts.ACTIVE_RENTALS },
          { id: 'RETURNED', label: 'Returned', count: counts.RETURNED },
          { id: 'COMPLETED', label: 'Completed', count: counts.COMPLETED },
          { id: 'REJECTED', label: 'Rejected', count: counts.REJECTED }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSelectedBooking(null); }}
            className={`booking-tab-compact ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
            <span className="booking-tab-count">{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="booking-toolbar">
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} color="var(--gray-400)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            className="input"
            placeholder="Search by customer, vehicle, plate, or ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: '2.5rem', borderRadius: '12px', border: '1px solid var(--gray-200)', height: '42px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <ArrowUpDown size={18} color="var(--gray-400)" />
          <select 
            className="input" 
            style={{ padding: '0 1rem', fontSize: '0.85rem', height: '42px', borderRadius: '12px', border: '1px solid var(--gray-200)', fontWeight: 600, color: 'var(--gray-600)' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="price_high">Price: High to Low</option>
            <option value="price_low">Price: Low to High</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedBooking ? '1fr 500px' : '1fr', gap: '2rem', transition: 'all 0.3s' }}>
        {/* Requests List */}
        <div className="booking-list">
          {loading ? (
            <div className="card" style={{ padding: '5rem', textAlign: 'center' }}>
              <Loader2 className="animate-spin" size={48} style={{ margin: '0 auto', color: 'var(--warm-taupe)' }} />
              <p style={{ marginTop: '1rem', color: 'var(--gray-500)', fontWeight: 600 }}>Loading bookings...</p>
            </div>
          ) : filteredBookings.length === 0 ? (
            renderEmptyState()
          ) : (
            filteredBookings.map((booking) => (
              <div 
                key={booking.id} 
                className={`booking-list-item ${selectedBooking?.id === booking.id ? 'selected' : ''}`}
                onClick={() => setSelectedBooking(booking)}
                style={{ cursor: 'pointer' }}
              >
                {/* Left: Customer & ID */}
                <div className="booking-list-main">
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--gray-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--gray-200)' }}>
                    {booking.vehicle.imageUrl ? (
                      <img src={booking.vehicle.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <User size={20} color="var(--gray-400)" />
                    )}
                  </div>
                  <div className="booking-list-meta">
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Customer</span>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--black)' }}>{booking.customer?.fullName}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontFamily: 'monospace' }}>#{booking.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                </div>

                {/* Middle: Vehicle & Dates */}
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div className="booking-list-meta">
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Vehicle</span>
                    <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--black)' }}>{booking.vehicle.brand} {booking.vehicle.model}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontFamily: 'monospace' }}>{booking.vehicle.licensePlate}</span>
                  </div>
                  <div className="booking-list-meta">
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Schedule</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--black)' }}>{new Date(booking.startDate).toLocaleDateString()}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>to {new Date(booking.endDate).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Right: Amount & Status */}
                <div className="booking-list-status">
                  {booking.status === 'REJECTED' && booking.rejectionReason && (
                    <div style={{ marginRight: 'auto', fontSize: '0.8rem', color: '#DC2626', backgroundColor: '#FEF2F2', padding: '0.25rem 0.5rem', borderRadius: '6px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {booking.rejectionReason}
                    </div>
                  )}
                  <div className="booking-list-meta" style={{ alignItems: 'flex-end', marginRight: '1rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase' }}>Amount</span>
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: 'var(--black)' }}>₱{Number(booking.totalAmount).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                    <StatusBadge status={booking.status} />
                    <button className="booking-list-action">View Details</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Details/Lifecycle Panel */}
        {selectedBooking && (
          <div className="card" style={{ 
            padding: '2.5rem', 
            position: 'sticky',
            top: '20px',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            boxShadow: 'var(--shadow-soft)',
            border: '1px solid var(--gray-200)',
            display: 'flex',
            flexDirection: 'column',
            gap: '2.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Booking Overview</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)', fontWeight: 700, marginTop: '0.25rem', textTransform: 'uppercase' }}>
                  Transaction ID: {selectedBooking.id.toUpperCase()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedBooking(null)}
                className="btn-outline"
                style={{ padding: '0.5rem', borderRadius: '50%', width: '40px', height: '40px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="booking-detail-panel">
              <section>
                <div className="detail-section-header">
                  <User size={18} color="var(--warm-taupe)" />
                  <h4>Customer Profile</h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', backgroundColor: 'var(--gray-50)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--gray-100)' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase' }}>Full Name</label>
                    <div style={{ fontWeight: 800 }}>{selectedBooking.customer?.fullName}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase' }}>Contact Number</label>
                    <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Phone size={14} /> {selectedBooking.customer?.phoneNumber || 'N/A'}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase' }}>Email Address</label>
                    <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Mail size={14} /> {selectedBooking.customer?.email}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="detail-section-header">
                  <Clock size={18} color="var(--warm-taupe)" />
                  <h4>Workflow Timeline</h4>
                </div>
                {renderTimeline(selectedBooking)}
              </section>

              <section>
                <div className="detail-section-header">
                  <ShieldCheck size={18} color="var(--warm-taupe)" />
                  <h4>Rental Specification</h4>
                </div>
                <div style={{ backgroundColor: 'white', border: '1px solid var(--gray-200)', borderRadius: '20px', padding: '1.5rem', display: 'flex', gap: '1.5rem' }}>
                  <div className="booking-vehicle-thumb" style={{ width: '100px', height: '80px', flexShrink: 0 }}>
                    {selectedBooking.vehicle.imageUrl && <img src={selectedBooking.vehicle.imageUrl} alt="" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.1rem' }}>{selectedBooking.vehicle.brand} {selectedBooking.vehicle.model}</div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--gray-400)', fontWeight: 700 }}>PLATE:</span>
                        <span style={{ fontWeight: 800, marginLeft: '0.4rem', fontFamily: 'monospace' }}>{selectedBooking.vehicle.licensePlate}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--gray-400)', fontWeight: 700 }}>CATEGORY:</span>
                        <span style={{ fontWeight: 800, marginLeft: '0.4rem' }}>{selectedBooking.vehicle.category}</span>
                      </div>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--gray-500)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <MapPin size={14} /> {selectedBooking.pickupLocation || 'Main Rental Office'}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="detail-section-header">
                  <FileText size={18} color="var(--warm-taupe)" />
                  <h4>Verified Documents</h4>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {(selectedBooking.documents || []).map((doc: any) => (
                    <button 
                      key={doc.id} 
                      onClick={() => setPreviewFile({ id: doc.id, title: doc.documentType.replace(/_/g, ' ') })}
                      style={{ 
                        padding: '1rem', 
                        backgroundColor: 'var(--gray-50)', 
                        borderRadius: '14px',
                        border: '1px solid var(--gray-200)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ backgroundColor: 'white', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--gray-100)' }}>
                        <FileText size={16} color="var(--warm-taupe)" />
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase' }}>{doc.documentType.split('_')[1] || 'ID'}</span>
                    </button>
                  ))}
                  {(selectedBooking.documents || []).length === 0 && (
                    <div style={{ gridColumn: 'span 2', padding: '1.25rem', backgroundColor: '#FEF2F2', borderRadius: '16px', border: '1px solid #FECACA', display: 'flex', gap: '0.75rem', alignItems: 'center', color: '#B91C1C' }}>
                      <AlertTriangle size={20} />
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>No documents uploaded by customer.</div>
                    </div>
                  )}
                </div>
              </section>

              <section>
                <div className="detail-section-header">
                  <ArrowUpDown size={18} color="var(--warm-taupe)" />
                  <h4>Financial Summary</h4>
                </div>
                <div style={{ backgroundColor: 'var(--black)', color: 'white', padding: '1.75rem', borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                      <span>Base Daily Rate:</span>
                      <span>₱{Number(selectedBooking.baseDailyRate).toLocaleString()}</span>
                    </div>
                    {selectedBooking.pricingMultiplier > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>
                        <span>Demand Multiplier:</span>
                        <span style={{ color: '#FCD34D' }}>{selectedBooking.pricingMultiplier}x</span>
                      </div>
                    )}
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '1rem 0' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <span style={{ fontWeight: 700 }}>Grand Total</span>
                      <span style={{ fontWeight: 900, fontSize: '1.75rem' }}>₱{Number(selectedBooking.totalAmount).toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', right: '-20px', bottom: '-20px', opacity: 0.05 }}>
                    <ShieldCheck size={120} />
                  </div>
                </div>
              </section>

              {renderPaymentSection()}

              <section style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '2rem' }}>
                <div className="detail-section-header">
                  <Search size={18} color="var(--warm-taupe)" />
                  <h4>Administrative Action</h4>
                </div>
                
                {selectedBooking.status === 'PENDING_REVIEW' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <textarea 
                      className="form-textarea"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter review notes or rejection reason..."
                      style={{ minHeight: '100px', fontSize: '0.9rem' }}
                    />
                    <div style={{ display: 'flex', gap: '1rem' }}>
                      <button 
                        onClick={() => handleBookingAction('REJECTED')}
                        disabled={actionLoading}
                        className="btn-outline"
                        style={{ flex: 1, color: '#C62828', borderColor: '#C62828', height: '50px' }}
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => handleBookingAction('APPROVED_FOR_PAYMENT')}
                        disabled={actionLoading || (selectedBooking.documents?.length || 0) === 0}
                        className="btn-brand"
                        style={{ flex: 2, height: '50px' }}
                      >
                        Approve for Payment
                      </button>
                    </div>
                  </div>
                ) : selectedBooking.status === 'READY_FOR_PICKUP' ? (
                  <div style={{ backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
                    <h5 style={{ margin: '0 0 1rem 0', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={18} color="#10B981" /> Release Vehicle
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={selectedBooking.agreementSignedAt || agreementSigned} onChange={(e) => setAgreementSigned(e.target.checked)} disabled={!!selectedBooking.agreementSignedAt} style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Rental Agreement Signed</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={checklistConfirmed} onChange={(e) => setChecklistConfirmed(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Release Checklist Confirmed</span>
                      </label>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '0.25rem', display: 'block' }}>Release Odometer (km)</label>
                        <input type="number" className="input" placeholder="e.g., 15200" value={releaseOdometer} onChange={(e) => setReleaseOdometer(e.target.value)} style={{ width: '100%', borderRadius: '12px' }} />
                      </div>
                      <button onClick={handleReleaseVehicle} disabled={actionLoading || !checklistConfirmed || (!agreementSigned && !selectedBooking.agreementSignedAt) || !releaseOdometer} className="btn-brand" style={{ width: '100%', padding: '1rem', marginTop: '0.5rem', backgroundColor: '#10B981' }}>
                        Release Vehicle & Start GPS Tracking
                      </button>
                    </div>
                  </div>
                ) : selectedBooking.status === 'ACTIVE' ? (
                  <div style={{ backgroundColor: '#EFF6FF', padding: '1.5rem', borderRadius: '20px', border: '1px solid #BFDBFE' }}>
                    <h5 style={{ margin: '0 0 1rem 0', fontWeight: 800, color: '#1E3A8A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Navigation size={18} color="#3B82F6" /> Return Vehicle
                    </h5>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1E40AF', marginBottom: '0.25rem', display: 'block' }}>Return Odometer (km)</label>
                        <input type="number" className="input" placeholder="e.g., 15400" value={returnOdometer} onChange={(e) => setReturnOdometer(e.target.value)} style={{ width: '100%', borderRadius: '12px', border: '1px solid #93C5FD' }} />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                        <input type="checkbox" checked={damageFound} onChange={(e) => setDamageFound(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#991B1B' }}>Report Damage Found</span>
                      </label>
                      {damageFound && (
                        <div style={{ backgroundColor: '#FEF2F2', padding: '1rem', borderRadius: '12px', border: '1px solid #FECACA', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <input type="text" className="input" placeholder="Damage Description" value={damageDetails.desc} onChange={(e) => setDamageDetails({...damageDetails, desc: e.target.value})} />
                          <input type="number" className="input" placeholder="Estimated Cost (₱)" value={damageDetails.cost} onChange={(e) => setDamageDetails({...damageDetails, cost: e.target.value})} />
                        </div>
                      )}
                      <textarea className="form-textarea" placeholder="General return notes (fuel, cleanliness, etc.)..." value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} style={{ minHeight: '60px' }} />
                      <button onClick={handleReturnVehicle} disabled={actionLoading || !returnOdometer} className="btn-brand" style={{ width: '100%', padding: '1rem', backgroundColor: '#3B82F6' }}>
                        Mark as Returned & Stop Tracking
                      </button>
                    </div>
                  </div>
                ) : selectedBooking.status === 'RETURNED' ? (
                  <div style={{ backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '20px', border: '1px solid #E2E8F0' }}>
                     <h5 style={{ margin: '0 0 1rem 0', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={18} color="#475569" /> Complete Rental
                    </h5>
                    <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginBottom: '1rem', lineHeight: 1.5 }}>
                      Vehicle has been returned. Total trip distance: <strong>{selectedBooking.tripDistanceKm} km</strong>. 
                      {selectedBooking.damageReports?.length > 0 ? (
                         <span style={{ color: '#DC2626', display: 'block', marginTop: '0.5rem' }}>⚠️ Damage reported. Vehicle will be marked as Under Maintenance upon completion.</span>
                      ) : (
                         <span style={{ color: '#16A34A', display: 'block', marginTop: '0.5rem' }}>Vehicle condition is clear. Will be marked Available upon completion.</span>
                      )}
                    </div>
                    <button onClick={handleCompleteRental} disabled={actionLoading} className="btn-brand" style={{ width: '100%', padding: '1rem', backgroundColor: '#475569' }}>
                      Complete Rental Journey
                    </button>
                  </div>
                ) : (
                  <div style={{ backgroundColor: 'var(--gray-50)', padding: '1.5rem', borderRadius: '20px', border: '1px solid var(--gray-100)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: selectedBooking.rejectionReason ? '1rem' : 0 }}>
                      <div style={{ backgroundColor: 'white', padding: '0.5rem', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
                        <StatusBadge status={selectedBooking.status} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{getStatusLabel(selectedBooking.status)}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--gray-400)', fontWeight: 700, textTransform: 'uppercase' }}>Lifecycle Milestone</span>
                      </div>
                    </div>
                    {selectedBooking.rejectionReason && (
                      <div style={{ padding: '1rem', backgroundColor: '#FEF2F2', borderRadius: '12px', border: '1px solid #FECACA', marginTop: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#991B1B', marginBottom: '0.25rem', textTransform: 'uppercase' }}>Rejection Reason</div>
                        <p style={{ fontSize: '0.85rem', color: '#B91C1C', margin: 0 }}>{selectedBooking.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </div>

      {previewFile && (
        <FilePreviewModal 
          fileId={previewFile.id}
          title={previewFile.title}
          onClose={() => setPreviewFile(null)}
          fetchFileBlob={filesApi.getProtectedFileBlob}
        />
      )}

      {showCashConfirmModal && selectedBooking && (
        <div className="cash-confirm-backdrop">
          <div className="cash-confirm-modal">
            <div className="cash-confirm-header">
              <Banknote size={24} color="#16A34A" />
              <h3 className="cash-confirm-title">Confirm Cash Payment</h3>
            </div>
            
            <div className="cash-confirm-message">
              Please confirm that the customer has paid the remaining balance in person.
              This action will record the cash payment and move the booking to <strong>Ready for Pickup</strong>.
            </div>

            <div className="cash-confirm-summary">
              <div className="cash-confirm-row">
                <span>Customer</span>
                <span>{selectedBooking.customer?.fullName}</span>
              </div>
              <div className="cash-confirm-row">
                <span>Vehicle</span>
                <span>{selectedBooking.vehicle.brand} {selectedBooking.vehicle.model}</span>
              </div>
              <div className="cash-confirm-row">
                <span>Booking ID</span>
                <span style={{ fontFamily: 'monospace' }}>#{selectedBooking.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="cash-confirm-row">
                <span>Method</span>
                <span>Cash at Pickup</span>
              </div>
              
              <div className="cash-confirm-amount">
                <span>Remaining Balance</span>
                <span>
                  ₱{(
                    Number(selectedBooking.totalAmount) - 
                    (selectedBooking.payments?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0)
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            {cashConfirmError && (
              <div className="cash-confirm-error">
                <AlertTriangle size={18} />
                <span>{cashConfirmError}</span>
              </div>
            )}

            <div className="cash-confirm-footer">
              <button 
                onClick={() => setShowCashConfirmModal(false)} 
                disabled={actionLoading}
                className="cash-confirm-cancel"
              >
                Cancel
              </button>
              <button 
                onClick={submitCashConfirm} 
                disabled={actionLoading}
                className="cash-confirm-submit"
              >
                {actionLoading ? 'Confirming...' : 'Confirm Cash Received'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingRequestsPage;
