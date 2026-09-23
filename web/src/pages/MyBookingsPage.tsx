import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Loader2, Calendar, MapPin, ChevronRight, CreditCard, CheckCircle2, Navigation, RotateCcw, Info, X, ExternalLink, FileText, User, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { bookingsApi, filesApi, getApiErrorMessage } from '../services/api';
import { useNotificationRefresh } from '../utils/socket';
import { SkeletonGroup, SkeletonCard } from '../components/Skeleton';
import VehicleImage from '../components/VehicleImage';
import { useToast } from '../components/ToastProvider';
import ConfirmActionModal from '../components/ConfirmActionModal';
import FilePreviewModal from '../components/FilePreviewModal';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { formatDate } from '../utils/formatDate';

const PAGE_SIZE = 10;

const ACTIVE_STATUSES = ['PENDING_REVIEW', 'APPROVED_FOR_PAYMENT', 'FULL_PAYMENT_SUBMITTED', 'DOWNPAYMENT_SUBMITTED', 'RESERVED', 'READY_FOR_PICKUP', 'ACTIVE'];
const PAST_STATUSES = ['RETURNED', 'COMPLETED', 'REJECTED', 'CANCELLED'];

const extractList = (responseData: any): any[] => 
  (Array.isArray(responseData) ? responseData : responseData?.data || []);

const extractHasMore = (responseData: any): boolean => 
  (Array.isArray(responseData) ? false : !!responseData?.hasMore);

interface TabState {
  list: any[];
  hasMore: boolean;
  loaded: boolean;
}

const MyBookingsPage: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [tabData, setTabData] = useState<{
    ACTIVE: TabState;
    PAST: TabState;
  }>({
    ACTIVE: { list: [], hasMore: false, loaded: false },
    PAST: { list: [], hasMore: false, loaded: false },
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tabCounts, setTabCounts] = useState<{ active: number; past: number }>({ active: 0, past: 0 });
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'PAST'>('ACTIVE');

  const currentTab = tabData[activeTab];
  const bookings = currentTab.list;
  const hasMore = currentTab.hasMore;
  // Tab skeleton shows immediately whenever the active tab has not yet loaded and a fetch is in progress
  const isTabLoading = !currentTab.loaded && loading;

  const fetchBookings = async (tab: 'ACTIVE' | 'PAST' = activeTab, skip: number = 0, isAppend: boolean = false) => {
    try {
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const { data } = await bookingsApi.getMyBookings({ skip, take: PAGE_SIZE, tab });
      const list = extractList(data);
      const more = extractHasMore(data);

      setTabData(prev => ({
        ...prev,
        [tab]: {
          list: isAppend ? [...prev[tab].list, ...list] : list,
          hasMore: more,
          loaded: true,
        },
      }));

      if (data?.counts) {
        setTabCounts({
          active: data.counts.active ?? 0,
          past: data.counts.past ?? 0,
        });
      } else if (Array.isArray(data)) {
        const act = data.filter((b: any) => ACTIVE_STATUSES.includes(b.status)).length;
        setTabCounts({
          active: act,
          past: data.length - act,
        });
      }
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      setError('Unable to load your bookings. Please check your connection and try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (loadingMore || !currentTab.hasMore) return;
    fetchBookings(activeTab, currentTab.list.length, true);
  };

  const handleTabChange = (newTab: 'ACTIVE' | 'PAST') => {
    if (newTab === activeTab) return;
    setActiveTab(newTab);
    // Instant 0ms transition if tab was already loaded; fetch only on first visit
    if (!tabData[newTab].loaded) {
      fetchBookings(newTab, 0, false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBookings(activeTab, 0, false);
    }
  }, [user]);

  // Live refresh when this customer's booking status changes elsewhere
  useNotificationRefresh(() => {
    fetchBookings(activeTab, 0, false);
    setTabData(prev => {
      const otherTab: 'ACTIVE' | 'PAST' = activeTab === 'ACTIVE' ? 'PAST' : 'ACTIVE';
      return {
        ...prev,
        [otherTab]: {
          ...prev[otherTab],
          loaded: false,
        },
      };
    });
  }, !!user);

  const getStatusDescription = (booking: any) => {
    switch (booking.status) {
      case 'PENDING_REVIEW': return 'Waiting for admin review';
      case 'APPROVED_FOR_PAYMENT': return 'Approved — Please proceed to payment';
      case 'FULL_PAYMENT_SUBMITTED': return 'Full payment submitted — Waiting for verification';
      case 'DOWNPAYMENT_SUBMITTED': return 'Downpayment submitted — Waiting for verification';
      case 'RESERVED': return 'Downpayment verified — Remaining balance due at pickup';
      case 'READY_FOR_PICKUP': return 'Ready for pickup — Please visit the shop, pay any remaining balance, and sign the agreement';
      case 'ACTIVE': return 'Rental active — GPS tracking is active';
      case 'RETURNED': return 'Vehicle returned — Waiting for admin completion';
      case 'COMPLETED': return 'Rental completed';
      case 'REJECTED': return 'Booking rejected';
      default: return '';
    }
  };

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ id: string; title: string } | null>(null);

  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelTargetStatus, setCancelTargetStatus] = useState<string>('');
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useBodyScrollLock(selectedBookingId !== null);

  const handleCancelBooking = async () => {
    if (!cancelTargetId) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      await bookingsApi.cancel(cancelTargetId);
      if (activeTab === 'ACTIVE') {
        setTabData(prev => ({
          ...prev,
          ACTIVE: {
            ...prev.ACTIVE,
            list: prev.ACTIVE.list.filter(b => b.id !== cancelTargetId),
          },
          PAST: {
            ...prev.PAST,
            loaded: false,
          },
        }));
      } else {
        setTabData(prev => ({
          ...prev,
          PAST: {
            ...prev.PAST,
            list: prev.PAST.list.map(b =>
              b.id === cancelTargetId ? { ...b, status: 'CANCELLED' } : b
            ),
          },
        }));
      }
      setTabCounts(prev => ({
        active: Math.max(0, prev.active - 1),
        past: prev.past + 1
      }));
      if (cancelTargetStatus === 'READY_FOR_PICKUP') {
        toast.success('Cancellation request submitted', 'The admin will review your request and contact you regarding the refund.');
      } else {
        toast.success('Booking cancelled', 'Your booking has been successfully cancelled.');
      }
      setCancelTargetId(null);
    } catch (error: any) {
      const msg = getApiErrorMessage(error);
      setCancelError(msg);
      toast.error('Cancellation failed', msg);
    } finally {
      setCancelLoading(false);
    }
  };

  const [searchParams] = useSearchParams();
  const [openedFromUrl, setOpenedFromUrl] = useState<string | null>(null);

  const handleViewDetails = async (id: string) => {
    setSelectedBookingId(id);
    setDetailsLoading(true);
    try {
      const { data } = await bookingsApi.getCustomerBookingDetails(id);
      setDetails(data);
      if (data?.status && PAST_STATUSES.includes(data.status) && activeTab !== 'PAST') {
        setActiveTab('PAST');
        setTabData(prev => {
          if (!prev.PAST.loaded) {
            fetchBookings('PAST', 0, false);
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load details', getApiErrorMessage(error));
    } finally {
      setDetailsLoading(false);
    }
  };

  // Auto-open booking details if ?id= or ?bookingId= is present in URL
  useEffect(() => {
    const targetBookingId = searchParams.get('id') || searchParams.get('bookingId');
    if (targetBookingId && openedFromUrl !== targetBookingId) {
      setOpenedFromUrl(targetBookingId);
      handleViewDetails(targetBookingId);
    }
  }, [searchParams, openedFromUrl]);

  return (
    <>
      <main style={{ flex: 1, padding: '4rem 0' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <div style={{ marginBottom: '3rem' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Bookings</h1>
            <p style={{ color: 'var(--muted-mauve)' }}>Track your booking requests and active journeys.</p>
          </div>

          {!error && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid #eee' }}>
              {[
                { id: 'ACTIVE' as const, label: 'Active & Upcoming', count: tabCounts.active },
                { id: 'PAST' as const, label: 'Past', count: tabCounts.past },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === tab.id ? '2px solid var(--black)' : '2px solid transparent',
                    fontWeight: activeTab === tab.id ? 800 : 600,
                    color: activeTab === tab.id ? 'var(--black)' : 'var(--muted-mauve)',
                    cursor: 'pointer',
                    fontSize: '0.95rem',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {tab.label}{(tabData.ACTIVE.loaded || tabData.PAST.loaded) ? ` (${tab.count})` : ''}
                </button>
              ))}
            </div>
          )}

          {isTabLoading ? (
            <SkeletonGroup style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </SkeletonGroup>
          ) : error ? (
            <div style={{ 
              backgroundColor: '#FFF2F2', 
              padding: '3rem', 
              borderRadius: '20px', 
              textAlign: 'center',
              border: '1px solid #FFDADA'
            }}>
              <AlertCircle size={48} color="#C62828" style={{ margin: '0 auto 1.5rem' }} />
              <h2 style={{ color: '#852D2D', marginBottom: '1rem' }}>Oops! Something went wrong</h2>
              <p style={{ color: '#852D2D', marginBottom: '2rem' }}>{error}</p>
              <button onClick={() => fetchBookings(activeTab, 0, false)} className="btn-primary">Try Again</button>
            </div>
          ) : (!loading && tabCounts.active === 0 && tabCounts.past === 0 && bookings.length === 0) ? (
            <div style={{
              backgroundColor: 'white',
              padding: '5rem',
              borderRadius: '20px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-soft)'
            }}>
              <Calendar size={48} color="#ddd" style={{ margin: '0 auto 1.5rem' }} />
              <h2 style={{ marginBottom: '1rem' }}>No bookings found</h2>
              <p style={{ color: 'var(--muted-mauve)', marginBottom: '2rem' }}>You haven't booked any vehicles yet.</p>
              <Link to="/vehicles" className="btn-primary">Browse Vehicles</Link>
            </div>
          ) : bookings.length === 0 ? (
            <div style={{
              backgroundColor: 'white',
              padding: '5rem',
              borderRadius: '20px',
              textAlign: 'center',
              boxShadow: 'var(--shadow-soft)'
            }}>
              <Calendar size={48} color="#ddd" style={{ margin: '0 auto 1.5rem' }} />
              <h2 style={{ marginBottom: '1rem' }}>
                {activeTab === 'ACTIVE' ? 'No active or upcoming bookings' : 'No past bookings yet'}
              </h2>
              <p style={{ color: 'var(--muted-mauve)', marginBottom: '2rem' }}>
                {activeTab === 'ACTIVE'
                  ? "You don't have any bookings in progress right now."
                  : "Your completed, returned, rejected, or cancelled bookings will show up here."}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {bookings.map((booking) => {
                return (
                  <div key={booking.id} style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    boxShadow: 'var(--shadow-soft)',
                    border: '1px solid #eee',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}>
                    <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {/* Vehicle Image */}
                      <div style={{
                        width: '150px',
                        height: '100px',
                        backgroundColor: 'var(--soft-beige)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        <VehicleImage
                          vehicleId={booking.vehicle.id}
                          brand={booking.vehicle.brand}
                          model={booking.vehicle.model}
                          imageUrl={booking.vehicle.imageUrl}
                          className="w-full h-full rounded"
                        />
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                          <h3 style={{ fontSize: '1.25rem' }}>{booking.vehicle.brand} {booking.vehicle.model}</h3>
                          <StatusBadge status={booking.status} />
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-mauve)', fontSize: '0.9rem' }}>
                            <Calendar size={14} />
                            <span>{formatDate(booking.startDate, 'datetime')} - {formatDate(booking.endDate, 'datetime')}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-mauve)', fontSize: '0.9rem' }}>
                            <MapPin size={14} />
                            <span>{booking.pickupLocation}</span>
                          </div>
                          {getStatusDescription(booking) && (
                            <div style={{ 
                              marginTop: '0.5rem', 
                              fontSize: '0.85rem', 
                              color: booking.status === 'REJECTED' ? '#C62828' : 'var(--warm-taupe)',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}>
                              <Info size={14} />
                              {getStatusDescription(booking)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status & Action */}
                      <div style={{ textAlign: 'right', minWidth: '150px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>₱{booking.totalAmount.toLocaleString()}</div>
                        
                        {booking.status === 'APPROVED_FOR_PAYMENT' && (
                          <Link to={`/customer/payment/${booking.id}`} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CreditCard size={16} /> Pay Now
                          </Link>
                        )}

                        {booking.status === 'ACTIVE' && (
                          <div style={{ color: '#7B1FA2', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <Navigation size={20} className="animate-pulse" /> RENTAL ACTIVE
                          </div>
                        )}

                        {booking.status === 'RETURNED' && (
                          <div style={{ color: '#00796B', fontSize: '0.9rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <RotateCcw size={18} /> Awaiting Inspection
                          </div>
                        )}

                        {booking.status === 'COMPLETED' && (
                          <div style={{ color: '#2E7D32', fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <CheckCircle2 size={22} /> COMPLETED
                          </div>
                        )}

                        {booking.status === 'READY_FOR_PICKUP' && (
                          <div style={{ color: '#2E7D32', fontSize: '1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <CheckCircle2 size={20} /> READY FOR PICKUP
                          </div>
                        )}

                        {['PENDING_REVIEW', 'APPROVED_FOR_PAYMENT'].includes(booking.status) && (
                          <button
                            onClick={() => { setCancelTargetId(booking.id); setCancelTargetStatus(booking.status); setCancelError(null); }}
                            style={{
                              marginTop: '0.5rem',
                              background: 'none',
                              border: '1px solid #DC2626',
                              color: '#DC2626',
                              borderRadius: '8px',
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              justifyContent: 'center',
                              width: '100%',
                            }}
                          >
                            <X size={13} /> Cancel Booking
                          </button>
                        )}

                        {booking.status === 'READY_FOR_PICKUP' && (
                          <button
                            onClick={() => { setCancelTargetId(booking.id); setCancelTargetStatus(booking.status); setCancelError(null); }}
                            style={{
                              marginTop: '0.5rem',
                              background: 'none',
                              border: '1px solid #D97706',
                              color: '#D97706',
                              borderRadius: '8px',
                              padding: '0.4rem 0.75rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              justifyContent: 'center',
                              width: '100%',
                            }}
                          >
                            <X size={13} /> Request Cancellation
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Timeline / Additional Info */}
                    {(booking.releasedAt || booking.returnedAt) && (
                      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        {booking.releasedAt && (
                          <div style={{ fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--muted-mauve)' }}>Released: </span>
                            <span style={{ fontWeight: 600 }}>{formatDate(booking.releasedAt, 'datetime')}</span>
                          </div>
                        )}
                        {booking.returnedAt && (
                          <div style={{ fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--muted-mauve)' }}>Returned: </span>
                            <span style={{ fontWeight: 600 }}>{formatDate(booking.returnedAt, 'datetime')}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>
                         Booking ID: {booking.id.split('-')[0].toUpperCase()} • {formatDate(booking.createdAt, 'short')}
                       </span>
                       <button 
                         onClick={() => handleViewDetails(booking.id)}
                         style={{ background: 'none', border: 'none', color: 'var(--warm-taupe)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                       >
                         View Details <ChevronRight size={16} />
                       </button>
                    </div>
                  </div>
                );
              })}
              {hasMore && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="btn-outline"
                    style={{ fontSize: '0.9rem', padding: '0.65rem 1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
                  >
                    {loadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
                    {loadingMore ? 'Loading more bookings...' : 'Load More Bookings'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <ConfirmActionModal
        isOpen={cancelTargetId !== null}
        title={cancelTargetStatus === 'READY_FOR_PICKUP' ? 'Request Cancellation' : 'Cancel Booking'}
        message={cancelTargetStatus === 'READY_FOR_PICKUP'
          ? 'You have already made a payment for this booking and the vehicle is ready for release. Submitting a cancellation request will notify the admin for review. Refunds are subject to admin approval and business policy. Do you want to proceed?'
          : 'Are you sure you want to cancel this booking? This action cannot be undone.'
        }
        confirmLabel={cancelTargetStatus === 'READY_FOR_PICKUP' ? 'Submit Request' : 'Yes, Cancel Booking'}
        cancelLabel="Keep Booking"
        variant={cancelTargetStatus === 'READY_FOR_PICKUP' ? 'warning' : 'danger'}
        loading={cancelLoading}
        error={cancelError}
        onConfirm={handleCancelBooking}
        onCancel={() => { if (!cancelLoading) { setCancelTargetId(null); setCancelError(null); } }}
      />

      {/* Booking Details Modal */}
      {selectedBookingId && (
        <div className="modal-overlay" onClick={() => setSelectedBookingId(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Booking Details</h2>
              <button onClick={() => setSelectedBookingId(null)} style={{ background: 'none', padding: '0.5rem' }}>
                <X size={24} />
              </button>
            </div>

            <div className="modal-content">
              {detailsLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <Loader2 className="animate-spin" size={40} color="var(--warm-taupe)" />
                  <p style={{ marginTop: '1rem', color: 'var(--muted-mauve)' }}>Loading details...</p>
                </div>
              ) : details ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                  
                  {/* Status Banner */}
                  <div style={{ 
                    backgroundColor: 'var(--gray-50)', 
                    padding: '1.5rem', 
                    borderRadius: '16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    border: '1px solid var(--gray-100)'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Current Status</div>
                      <StatusBadge status={details.status} />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>₱{Number(details.totalAmount).toLocaleString()}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)' }}>Total Estimated Amount</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Schedule */}
                    <section>
                      <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--muted-mauve)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={18} /> Rental Schedule
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>Pickup</label>
                          <div style={{ fontWeight: 600 }}>{formatDate(details.startDate, 'datetime')}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>Return</label>
                          <div style={{ fontWeight: 600 }}>{formatDate(details.endDate, 'datetime')}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>Pickup Location</label>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <MapPin size={14} /> {details.pickupLocation}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* Vehicle */}
                    <section>
                      <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--muted-mauve)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShieldCheck size={18} /> Vehicle Details
                      </h3>
                      <div style={{ display: 'flex', gap: '1.5rem' }}>
                        <div style={{ width: '100px', height: '70px', backgroundColor: 'var(--soft-beige)', borderRadius: '8px', flexShrink: 0, overflow: 'hidden' }}>
                          <VehicleImage
                            vehicleId={details.vehicle.id}
                            brand={details.vehicle.brand}
                            model={details.vehicle.model}
                            imageUrl={details.vehicle.imageUrl}
                            className="w-full h-full rounded"
                          />
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{details.vehicle.brand} {details.vehicle.model}</div>
                          <div style={{ color: 'var(--muted-mauve)', fontSize: '0.85rem' }}>Plate: {details.vehicle.licensePlate}</div>
                          <div style={{ color: 'var(--muted-mauve)', fontSize: '0.85rem' }}>{details.vehicle.category} • {details.vehicle.transmission}</div>
                        </div>
                      </div>
                    </section>
                  </div>

                  {/* Customer Info */}
                  <section style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '2rem' }}>
                    <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--muted-mauve)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <User size={18} /> Submitted Requirements
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>Full Name</label>
                        <div style={{ fontWeight: 600 }}>{details.fullName || details.customer.fullName}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>Contact Number</label>
                        <div style={{ fontWeight: 600 }}>{details.contactNumber || details.customer.phoneNumber || 'N/A'}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>License Number</label>
                        <div style={{ fontWeight: 600 }}>{details.licenseNumber || 'Verified via Document'}</div>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>Address</label>
                        <div style={{ fontWeight: 600 }}>{details.address || details.customer.address || 'N/A'}</div>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>License Expiry</label>
                        <div style={{ fontWeight: 600 }}>{details.licenseExpiry || 'N/A'}</div>
                      </div>
                    </div>
                  </section>

                  {/* Documents & Payments */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', borderTop: '1px solid var(--gray-100)', paddingTop: '2rem' }}>
                    {/* Documents */}
                    <section>
                      <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--muted-mauve)', marginBottom: '1.25rem' }}>Documents</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {details.documents && details.documents.length > 0 ? (
                          details.documents.map((doc: any) => (
                            <button 
                              key={doc.id} 
                              type="button"
                              onClick={() => setPreviewFile({
                                id: doc.id,
                                title: doc.documentType === 'valid_id' ? 'Valid ID' : 'Driver\'s License'
                              })}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.75rem', 
                                backgroundColor: 'var(--gray-50)', 
                                borderRadius: '10px',
                                border: '1px solid var(--gray-100)',
                                transition: 'all 0.2s',
                                cursor: 'pointer',
                                width: '100%',
                                textAlign: 'left'
                              }}
                            >
                              <FileText size={18} color="var(--warm-taupe)" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>{doc.documentType === 'valid_id' ? 'Valid ID' : 'Driver\'s License'}</span>
                              <ExternalLink size={14} color="var(--gray-400)" />
                            </button>
                          ))
                        ) : (
                          <div style={{ fontSize: '0.85rem', color: 'var(--status-error)' }}>No documents found.</div>
                        )}
                      </div>
                    </section>

                    {/* Payment Info */}
                    <section>
                      <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--muted-mauve)', marginBottom: '1.25rem' }}>Payment Status</h3>
                      {details.payments && details.payments.length > 0 ? (
                        <div style={{ backgroundColor: 'var(--gray-50)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--gray-100)' }}>
                          {details.payments.map((payment: any) => (
                            <div key={payment.id} style={{ marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)' }}>{payment.paymentType.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>₱{Number(payment.amount).toLocaleString()}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: payment.status === 'VERIFIED' ? 'var(--status-available)' : 'var(--status-pending)' }}>{payment.status}</span>
                                {payment.proofs?.[0]?.referenceNumber && (
                                  <span style={{ fontSize: '0.7rem', color: 'var(--muted-mauve)' }}>Ref: {payment.proofs[0].referenceNumber}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>Awaiting payment submission.</div>
                      )}
                    </section>
                  </div>

                  {/* Admin Feedback */}
                  {details.rejectionReason && (
                    <div style={{ backgroundColor: '#FFF2F2', padding: '1.5rem', borderRadius: '12px', border: '1px solid #FFDADA' }}>
                      <h4 style={{ color: 'var(--status-error)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Info size={16} /> Administrative Feedback
                      </h4>
                      <p style={{ fontSize: '0.9rem', color: '#852D2D' }}>{details.rejectionReason}</p>
                    </div>
                  )}

                  {/* Lifecycle Timeline */}
                  {(details.releasedAt || details.returnedAt || details.completedAt) && (
                    <section style={{ borderTop: '1px solid var(--gray-100)', paddingTop: '2rem' }}>
                       <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--muted-mauve)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={18} /> Rental Timeline
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {details.releasedAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--warm-taupe)' }}></div>
                            <div style={{ fontSize: '0.9rem' }}>
                              <span style={{ fontWeight: 600 }}>Vehicle Released:</span> {formatDate(details.releasedAt, 'datetime')}
                            </div>
                          </div>
                        )}
                        {details.returnedAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--warm-taupe)' }}></div>
                            <div style={{ fontSize: '0.9rem' }}>
                              <span style={{ fontWeight: 600 }}>Vehicle Returned:</span> {formatDate(details.returnedAt, 'datetime')}
                            </div>
                          </div>
                        )}
                        {details.completedAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--status-available)' }}></div>
                            <div style={{ fontSize: '0.9rem' }}>
                              <span style={{ fontWeight: 600 }}>Transaction Completed:</span> {formatDate(details.completedAt, 'datetime')}
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                </div>
              ) : null}
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setSelectedBookingId(null)}>Close</button>
              {['PENDING_REVIEW', 'APPROVED_FOR_PAYMENT'].includes(details?.status) && (
                <button
                  onClick={() => {
                    setSelectedBookingId(null);
                    setCancelTargetId(details.id);
                    setCancelTargetStatus(details.status);
                    setCancelError(null);
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #DC2626',
                    color: '#DC2626',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <X size={14} /> Cancel Booking
                </button>
              )}
              {details?.status === 'READY_FOR_PICKUP' && (
                <button
                  onClick={() => {
                    setSelectedBookingId(null);
                    setCancelTargetId(details.id);
                    setCancelTargetStatus(details.status);
                    setCancelError(null);
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #D97706',
                    color: '#D97706',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <X size={14} /> Request Cancellation
                </button>
              )}
              {details?.status === 'APPROVED_FOR_PAYMENT' && (
                <Link to={`/customer/payment/${details.id}`} className="btn-primary">
                  Proceed to Payment
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          fileId={previewFile.id}
          title={previewFile.title}
          onClose={() => setPreviewFile(null)}
          fetchFileBlob={filesApi.getProtectedFileBlob}
        />
      )}
    </>
  );
};

export default MyBookingsPage;
