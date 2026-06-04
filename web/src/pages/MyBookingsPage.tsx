import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Loader2, Calendar, MapPin, ChevronRight, CreditCard, CheckCircle2, Navigation, RotateCcw, Info, X, ExternalLink, FileText, User, ShieldCheck, Clock, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { bookingsApi, getApiErrorMessage } from '../services/api';
import { useToast } from '../components/ToastProvider';
import ConfirmActionModal from '../components/ConfirmActionModal';

const MyBookingsPage: React.FC = () => {
  const toast = useToast();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await bookingsApi.getMyBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      setError('Unable to load your bookings. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

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

  const formatDate = (dateStr: string | Date) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancelBooking = async () => {
    if (!cancelTargetId) return;
    setCancelLoading(true);
    setCancelError(null);
    try {
      await bookingsApi.cancel(cancelTargetId);
      setBookings(prev => prev.map(b =>
        b.id === cancelTargetId ? { ...b, status: 'CANCELLED' } : b
      ));
      toast.success('Booking cancelled', 'Your booking has been successfully cancelled.');
      setCancelTargetId(null);
    } catch (error: any) {
      const msg = getApiErrorMessage(error);
      setCancelError(msg);
      toast.error('Cancellation failed', msg);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleViewDetails = async (id: string) => {
    setSelectedBookingId(id);
    setDetailsLoading(true);
    try {
      const { data } = await bookingsApi.getCustomerBookingDetails(id);
      setDetails(data);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load details', getApiErrorMessage(error));
    } finally {
      setDetailsLoading(false);
    }
  };



  return (
    <>
      <main style={{ flex: 1, padding: '4rem 0' }}>
        <div className="container" style={{ maxWidth: '1000px' }}>
          <div style={{ marginBottom: '3rem' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>My Bookings</h1>
            <p style={{ color: 'var(--muted-mauve)' }}>Track your booking requests and active journeys.</p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem' }}>
              <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" />
              <p style={{ marginTop: '1rem', color: 'var(--muted-mauve)' }}>Loading your bookings...</p>
            </div>
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
              <button onClick={fetchBookings} className="btn-primary">Try Again</button>
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
              <h2 style={{ marginBottom: '1rem' }}>No bookings found</h2>
              <p style={{ color: 'var(--muted-mauve)', marginBottom: '2rem' }}>You haven't booked any vehicles yet.</p>
              <Link to="/vehicles" className="btn-primary">Browse Vehicles</Link>
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
                      {/* Vehicle Image Placeholder */}
                      <div style={{ 
                        width: '150px', 
                        height: '100px', 
                        backgroundColor: 'var(--soft-beige)', 
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {booking.vehicle.imageUrl ? (
                          <img src={booking.vehicle.imageUrl} alt={booking.vehicle.model} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px' }} />
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)' }}>{booking.vehicle.brand}</span>
                        )}
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
                            <span>{formatDate(booking.startDate)} - {formatDate(booking.endDate)}</span>
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
                            onClick={() => { setCancelTargetId(booking.id); setCancelError(null); }}
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
                      </div>
                    </div>

                    {/* Timeline / Additional Info */}
                    {(booking.releasedAt || booking.returnedAt) && (
                      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        {booking.releasedAt && (
                          <div style={{ fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--muted-mauve)' }}>Released: </span>
                            <span style={{ fontWeight: 600 }}>{formatDate(booking.releasedAt)}</span>
                          </div>
                        )}
                        {booking.returnedAt && (
                          <div style={{ fontSize: '0.85rem' }}>
                            <span style={{ color: 'var(--muted-mauve)' }}>Returned: </span>
                            <span style={{ fontWeight: 600 }}>{formatDate(booking.returnedAt)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <span style={{ fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>
                         Booking ID: {booking.id.split('-')[0].toUpperCase()} • {new Date(booking.createdAt).toLocaleDateString()}
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
            </div>
          )}
        </div>
      </main>

      <ConfirmActionModal
        isOpen={cancelTargetId !== null}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmLabel="Yes, Cancel Booking"
        cancelLabel="Keep Booking"
        variant="danger"
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
                          <div style={{ fontWeight: 600 }}>{formatDate(details.startDate)}</div>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'block' }}>Return</label>
                          <div style={{ fontWeight: 600 }}>{formatDate(details.endDate)}</div>
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
                        <div style={{ width: '100px', height: '70px', backgroundColor: 'var(--soft-beige)', borderRadius: '8px', flexShrink: 0 }}>
                           {details.vehicle.imageUrl && <img src={details.vehicle.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />}
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
                            <a 
                              key={doc.id} 
                              href={`http://localhost:4000/api/files/${doc.id}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem', 
                                padding: '0.75rem', 
                                backgroundColor: 'var(--gray-50)', 
                                borderRadius: '10px',
                                border: '1px solid var(--gray-100)',
                                transition: 'all 0.2s'
                              }}
                            >
                              <FileText size={18} color="var(--warm-taupe)" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, flex: 1 }}>{doc.documentType === 'valid_id' ? 'Valid ID' : 'Driver\'s License'}</span>
                              <ExternalLink size={14} color="var(--gray-400)" />
                            </a>
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
                              <span style={{ fontWeight: 600 }}>Vehicle Released:</span> {formatDate(details.releasedAt)}
                            </div>
                          </div>
                        )}
                        {details.returnedAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--warm-taupe)' }}></div>
                            <div style={{ fontSize: '0.9rem' }}>
                              <span style={{ fontWeight: 600 }}>Vehicle Returned:</span> {formatDate(details.returnedAt)}
                            </div>
                          </div>
                        )}
                        {details.completedAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--status-available)' }}></div>
                            <div style={{ fontSize: '0.9rem' }}>
                              <span style={{ fontWeight: 600 }}>Transaction Completed:</span> {formatDate(details.completedAt)}
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
              {details?.status === 'APPROVED_FOR_PAYMENT' && (
                <Link to={`/customer/payment/${details.id}`} className="btn-primary">
                  Proceed to Payment
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MyBookingsPage;
