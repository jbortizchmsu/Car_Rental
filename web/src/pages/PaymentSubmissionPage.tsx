import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paymentsApi, getApiErrorMessage } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CreditCard, Upload, AlertCircle, CheckCircle2, ChevronLeft, Info, Smartphone, Eye, RefreshCw, X, Check } from 'lucide-react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

const PaymentSubmissionPage: React.FC = () => {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [paymentType, setPaymentType] = useState<'FULL_GCASH' | 'DOWNPAYMENT_GCASH'>('FULL_GCASH');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [downpaymentAmount, setDownpaymentAmount] = useState<number>(0);

  // Receipt local preview state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useBodyScrollLock(previewOpen);

  useEffect(() => {
    if (proofFile) {
      const url = URL.createObjectURL(proofFile);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [proofFile]);

  const handleOpenPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (proofFile) {
      setPreviewOpen(true);
    }
  };

  const handleClosePreview = () => {
    setPreviewOpen(false);
  };

  const handleChangeReceipt = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  useEffect(() => {
    if (bookingId && user) {
      fetchBooking();
    }
  }, [bookingId, user]);

  const fetchBooking = async () => {
    try {
      setLoading(true);
      const { data } = await paymentsApi.getBookingForPayment(bookingId!);
      
      setBooking(data);
      // Default downpayment to 30% of total
      setDownpaymentAmount(Math.round(data.totalAmount * 0.3));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofFile) {
      setError('Please upload your GCash receipt photo.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('proof', proofFile);
      formData.append('amount', (paymentType === 'FULL_GCASH' ? booking.totalAmount : downpaymentAmount).toString());
      formData.append('paymentType', paymentType);
      formData.append('referenceNumber', referenceNumber);

      await paymentsApi.submit(booking.id, formData);

      setSuccess(true);
      setTimeout(() => navigate('/customer/my-bookings'), 3000);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to submit payment.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" />
      </div>
    );
  }

  if (!booking) return <div>Booking not found.</div>;

  const isAllowedToPay = booking.status === 'APPROVED_FOR_PAYMENT';

  return (
    <>
      <main style={{ flex: 1, padding: '4rem 0' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <button 
            onClick={() => navigate('/customer/my-bookings')}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', color: 'var(--muted-mauve)', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <ChevronLeft size={20} /> Back to My Bookings
          </button>

          {success ? (
            <div style={{ backgroundColor: 'white', padding: '4rem', borderRadius: '20px', textAlign: 'center', boxShadow: 'var(--shadow-soft)' }}>
              <CheckCircle2 size={64} color="#2E7D32" style={{ margin: '0 auto 1.5rem' }} />
              <h2 style={{ marginBottom: '1rem' }}>Payment Submitted!</h2>
              <p style={{ color: 'var(--muted-mauve)', fontSize: '1.1rem', marginBottom: '2rem' }}>
                We have received your GCash proof. Owner/Admin will verify it shortly.
              </p>
              <div style={{ backgroundColor: 'var(--soft-beige)', padding: '1.5rem', borderRadius: '12px' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--muted-mauve)' }}>
                  Once verified, your booking status will change to <strong>RESERVED</strong> or <strong>READY FOR PICKUP</strong>.
                </p>
              </div>
            </div>
          ) : (
            <div className="payment-submission-grid">
              {/* Left Column: Payment Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow-soft)' }}>
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <CreditCard size={20} color="var(--warm-taupe)" /> GCash Payment
                  </h3>

                  {!isAllowedToPay ? (
                    <div style={{ backgroundColor: '#FFF3E0', color: '#E65100', padding: '1.5rem', borderRadius: '12px', textAlign: 'center' }}>
                      <AlertCircle size={32} style={{ margin: '0 auto 0.5rem' }} />
                      <p style={{ fontWeight: 600 }}>Payment Locked</p>
                      <p style={{ fontSize: '0.85rem' }}>
                        {booking.status === 'PENDING_REVIEW' 
                          ? 'Waiting for Owner/Admin to approve your documents.' 
                          : 'This booking is not eligible for payment at this time.'}
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit}>
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 600 }}>Payment Option</label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <button 
                            type="button"
                            onClick={() => setPaymentType('FULL_GCASH')}
                            style={{ 
                              flex: 1, 
                              padding: '1rem', 
                              borderRadius: '12px', 
                              border: `2px solid ${paymentType === 'FULL_GCASH' ? 'var(--warm-taupe)' : '#eee'}`,
                              backgroundColor: paymentType === 'FULL_GCASH' ? 'var(--soft-beige)' : 'white',
                              textAlign: 'center'
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Full Payment</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)' }}>₱{booking.totalAmount.toLocaleString()}</div>
                          </button>
                          <button 
                            type="button"
                            onClick={() => setPaymentType('DOWNPAYMENT_GCASH')}
                            style={{ 
                              flex: 1, 
                              padding: '1rem', 
                              borderRadius: '12px', 
                              border: `2px solid ${paymentType === 'DOWNPAYMENT_GCASH' ? 'var(--warm-taupe)' : '#eee'}`,
                              backgroundColor: paymentType === 'DOWNPAYMENT_GCASH' ? 'var(--soft-beige)' : 'white',
                              textAlign: 'center'
                            }}
                          >
                            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Downpayment</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)' }}>₱{downpaymentAmount.toLocaleString()}</div>
                          </button>
                        </div>
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>GCash Reference Number (Optional)</label>
                        <input 
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          placeholder="13-digit number"
                          style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                        />
                      </div>

                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Upload Receipt/Proof</label>
                        <input 
                          ref={fileInputRef}
                          type="file" 
                          accept="image/*"
                          onChange={handleFileChange}
                          style={{ display: 'none' }}
                        />

                        {!proofFile ? (
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            style={{ 
                              border: '2px dashed #ddd', 
                              padding: '1.5rem', 
                              borderRadius: '12px', 
                              textAlign: 'center',
                              cursor: 'pointer',
                              backgroundColor: 'var(--gray-50)',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <Upload size={24} color="var(--muted-mauve)" style={{ margin: '0 auto 0.5rem' }} />
                            <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--black)', margin: 0 }}>
                              Click to upload GCash receipt
                            </p>
                            <p style={{ fontSize: '0.78rem', color: 'var(--muted-mauve)', marginTop: '0.25rem' }}>
                              JPG, PNG, and WEBP images accepted
                            </p>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              border: '2px dashed #bbf7d0',
                              backgroundColor: '#f0fdf4',
                              padding: '0.9rem 1rem',
                              borderRadius: '12px',
                              gap: '0.75rem',
                              minWidth: 0
                            }}
                          >
                            {/* Left: Thumbnail & File Info (Clickable for preview) */}
                            <div
                              onClick={handleOpenPreview}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                flex: 1,
                                cursor: 'pointer',
                                minWidth: 0,
                                overflow: 'hidden'
                              }}
                              title="Click to preview receipt"
                            >
                              {previewUrl ? (
                                <div style={{ width: '44px', height: '44px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid #86efac', backgroundColor: 'white' }}>
                                  <img src={previewUrl} alt="Receipt Thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              ) : (
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <CheckCircle2 color="#2E7D32" size={22} />
                                </div>
                              )}

                              <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', minWidth: 0 }}>
                                  <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--black)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                                    Payment Receipt
                                  </h5>
                                  <span
                                    style={{
                                      fontSize: '0.68rem',
                                      fontWeight: 700,
                                      color: '#15803d',
                                      backgroundColor: '#dcfce7',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      flexShrink: 0
                                    }}
                                  >
                                    <Eye size={11} /> Preview
                                  </span>
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    marginTop: '0.2rem',
                                    fontSize: '0.8rem',
                                    color: '#2E7D32',
                                    fontWeight: 600,
                                    minWidth: 0
                                  }}
                                >
                                  <Check size={13} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{proofFile.name}</span>
                                </div>
                              </div>
                            </div>

                            {/* Right: Change Button */}
                            <button
                              type="button"
                              onClick={handleChangeReceipt}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.45rem 0.75rem',
                                fontSize: '0.78rem',
                                fontWeight: 700,
                                color: 'var(--gray-700)',
                                backgroundColor: 'var(--white)',
                                border: '1px solid var(--gray-300)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                flexShrink: 0,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <RefreshCw size={12} /> Change
                            </button>
                          </div>
                        )}
                      </div>

                      {error && (
                        <div style={{ backgroundColor: '#FFEBEE', color: '#C62828', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                          <AlertCircle size={20} />
                          <span style={{ fontSize: '0.9rem' }}>{error}</span>
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={submitting}
                        className="btn-primary" 
                        style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                      >
                        {submitting ? <Loader2 className="animate-spin" size={24} /> : 'Submit Payment Proof'}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              {/* Right Column: Booking Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: 'var(--shadow-soft)' }}>
                  <h4 style={{ marginBottom: '1rem', fontWeight: 700 }}>Order Summary</h4>
                  <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '1rem', marginBottom: '1rem' }}>
                    <div style={{ fontWeight: 600 }}>{booking.vehicle.brand} {booking.vehicle.model}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>{booking.vehicle.licensePlate}</div>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--muted-mauve)' }}>Total Amount</span>
                      <span style={{ fontWeight: 600 }}>₱{booking.totalAmount.toLocaleString()}</span>
                    </div>
                    {paymentType === 'DOWNPAYMENT_GCASH' && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2E7D32' }}>
                          <span>Downpayment</span>
                          <span>-₱{downpaymentAmount.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f3f4f6', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                          <span style={{ fontWeight: 700 }}>Due at Pickup</span>
                          <span style={{ fontWeight: 800, color: '#C62828' }}>₱{(booking.totalAmount - downpaymentAmount).toLocaleString()}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--warm-taupe)' }}>
                      <Smartphone size={16} />
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>GCash Merchant Details</span>
                    </div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>JD CAR RENTAL</p>
                    <p style={{ fontSize: '1rem', letterSpacing: '1px', fontWeight: 800 }}>0912 345 6789</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', backgroundColor: '#E3F2FD', borderRadius: '12px', color: '#1565C0' }}>
                  <Info size={20} style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                    Please ensure the reference number matches your GCash receipt exactly. Duplicate or incorrect submissions will be rejected.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Payment Receipt Preview Modal */}
      {previewOpen && previewUrl && proofFile && (
        <div className="modal-overlay" style={{ zIndex: 2200 }} onClick={handleClosePreview}>
          <div
            className="modal-container"
            style={{
              maxWidth: '750px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--white)',
              borderRadius: '16px',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header" style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--gray-200)' }}>
              <div>
                <h3 className="modal-title" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Payment Receipt Preview</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted-mauve)', margin: '2px 0 0' }}>{proofFile.name}</p>
              </div>
              <button
                type="button"
                onClick={handleClosePreview}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', color: 'var(--gray-500)' }}
              >
                <X size={22} />
              </button>
            </div>
            <div
              className="modal-content"
              style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                backgroundColor: '#f8fafc',
                minHeight: '350px'
              }}
            >
              <img
                src={previewUrl}
                alt={proofFile.name}
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentSubmissionPage;
