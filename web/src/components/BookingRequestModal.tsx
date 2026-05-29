import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Upload, Calendar, MapPin, User, ShieldCheck, AlertCircle, X, CheckCircle2, Calculator, Car, FileText, ChevronRight, ChevronLeft, Check, Tag } from 'lucide-react';
import { bookingsApi, pricingApi, vehiclesApi } from '../services/api';

interface BookingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicle: any;
}

const BookingRequestModal: React.FC<BookingRequestModalProps> = ({ isOpen, onClose, vehicle }) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    start_date: '',
    end_date: '',
    pickup_location: 'JD Car Rental Main Shop',
    destinationName: '',
    destinationAddress: '',
    destinationNotes: '',
    customer_full_name: profile?.full_name || '',
    contact_number: profile?.phone_number || '',
    address: profile?.address || '',
    drivers_license_number: '',
    drivers_license_expiry: '',
    emergency_contact_name: '',
    emergency_contact_number: '',
    notes: ''
  });

  const [files, setFiles] = useState<{ valid_id: File | null; drivers_license: File | null }>({
    valid_id: null,
    drivers_license: null
  });

  const [error, setError] = useState<string | null>(null);
  const [pricingQuote, setPricingQuote] = useState<any>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Reset state when modal opens/closes or profile changes
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setFormData(prev => ({
        ...prev,
        customer_full_name: profile?.full_name || prev.customer_full_name,
        contact_number: profile?.phone_number || prev.contact_number,
        address: profile?.address || prev.address
      }));
      setSuccess(false);
      setError(null);
      setPricingQuote(null);
      setConfirmed(false);
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (isOpen && vehicle && formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (start < end) {
        fetchPricingQuote();
      } else {
        setPricingQuote(null);
      }
    }
  }, [vehicle, formData.start_date, formData.end_date, isOpen]);

  const fetchPricingQuote = async () => {
    try {
      const { data } = await pricingApi.getQuote({
        vehicleId: vehicle.id,
        startDate: formData.start_date,
        endDate: formData.end_date
      });
      setPricingQuote(data);
      setError(null);
    } catch (err: any) {
      console.error('Pricing quote error:', err);
      if (err.response?.status === 409) {
        setError('This vehicle is already booked for the selected dates.');
      }
      setPricingQuote(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'valid_id' | 'drivers_license') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const validateStep = (step: number) => {
    const now = new Date();
    
    if (step === 1) {
      if (!vehicle) return 'Please select a vehicle.';
      if (!formData.start_date) return 'Please select a pickup date.';
      if (!formData.end_date) return 'Please select a return date.';
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (start < now) return 'Pickup date cannot be in the past.';
      if (start >= end) return 'Return date must be after pickup date.';
      if (!formData.destinationName) return 'Please provide your intended travel area or destination.';
      if (error === 'This vehicle is already booked for the selected dates.') return error;
      if (!pricingQuote) return 'Please wait for price estimation or fix your dates.';
    }
    
    if (step === 2) {
      if (!formData.customer_full_name) return 'Full name is required.';
      if (!formData.contact_number) return 'Contact number is required.';
      if (!formData.drivers_license_number) return 'License number is required.';
      if (!formData.drivers_license_expiry) return 'License expiry date is required.';
      const expiry = new Date(formData.drivers_license_expiry);
      if (expiry < now) return 'Your driver\'s license is expired.';
      if (!formData.address) return 'Current address is required.';
      if (!formData.emergency_contact_name) return 'Emergency contact name is required.';
      if (!formData.emergency_contact_number) return 'Emergency contact phone is required.';
    }

    if (step === 3) {
      if (!files.valid_id) return 'Please upload a Valid ID.';
      if (!files.drivers_license) return 'Please upload your Driver\'s License.';
    }

    return null;
  };

  const handleNext = () => {
    const stepError = validateStep(currentStep);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setError('Please confirm that the information is accurate.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const bookingRequest = {
        vehicleId: vehicle.id,
        startDate: formData.start_date,
        endDate: formData.end_date,
        pickupLocation: formData.pickup_location,
        destinationName: formData.destinationName,
        destinationAddress: formData.destinationAddress,
        destinationNotes: formData.destinationNotes,
        fullName: formData.customer_full_name,
        contactNumber: formData.contact_number,
        address: formData.address,
        licenseNumber: formData.drivers_license_number,
        licenseExpiry: formData.drivers_license_expiry,
        emergencyContact: formData.emergency_contact_name,
        emergencyPhone: formData.emergency_contact_number,
        notes: formData.notes
      };

      let bookingResponse;
      try {
        bookingResponse = await bookingsApi.request(bookingRequest);
      } catch (err: any) {
        if (!err.response) throw new Error('Backend server is not reachable.');
        if (err.response.status === 401) throw new Error('Your session expired. Please log in again.');
        if (err.response.status === 409) throw new Error('This vehicle is already booked for the selected dates. Please choose another vehicle or date.');
        throw new Error(err.response.data?.error || 'Booking submission failed.');
      }

      const booking = bookingResponse.data;

      try {
        if (files.valid_id) await bookingsApi.uploadDocument(booking.id, 'valid_id', files.valid_id);
        if (files.drivers_license) await bookingsApi.uploadDocument(booking.id, 'drivers_license', files.drivers_license);
      } catch (err: any) {
        throw new Error('Booking created, but document upload failed. Please contact support.');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate('/customer/my-bookings');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit rental request.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="booking-modal-backdrop">
      <div className="booking-modal booking-modal-shell">
        <button onClick={onClose} className="booking-modal-close" type="button" disabled={loading}>
          <X size={24} />
        </button>

        {success ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <CheckCircle2 size={72} color="#2E7D32" style={{ margin: '0 auto 1.5rem' }} />
            <h2 style={{ marginBottom: '1rem', fontSize: '2rem', fontWeight: 900 }}>Booking request submitted</h2>
            <p style={{ color: 'var(--muted-mauve)', fontSize: '1.1rem', marginBottom: '2.5rem' }}>
              Your booking request has been sent to JD Car Rental.<br/>
              Please wait for admin review.
            </p>
            <div style={{ backgroundColor: 'var(--soft-beige)', padding: '1.5rem', borderRadius: '12px', maxWidth: '400px', margin: '0 auto' }}>
              <p style={{ fontWeight: 700, color: 'var(--black)' }}>What's next?</p>
              <p style={{ fontSize: '0.95rem', color: 'var(--gray-600)', marginTop: '0.5rem' }}>
                Once approved, the "Pay Now" button will be unlocked in your "My Bookings" page.
              </p>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-400)', marginTop: '2.5rem' }}>Redirecting to My Bookings...</p>
          </div>
        ) : (
          <>
            <div className="booking-modal-header">
              <h2>Request Booking</h2>
              <p>Complete the steps below to secure your vehicle.</p>
            </div>

            <div className="booking-modal-body">
              {/* Stepper */}
              <div className="booking-stepper">
                <div className={`booking-step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'complete' : ''}`}>
                  <div className="booking-step-circle">{currentStep > 1 ? <Check size={16} /> : '1'}</div>
                  <span className="booking-step-label">Schedule</span>
                </div>
                <div className={`booking-step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'complete' : ''}`}>
                  <div className="booking-step-circle">{currentStep > 2 ? <Check size={16} /> : '2'}</div>
                  <span className="booking-step-label">Information</span>
                </div>
                <div className={`booking-step ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'complete' : ''}`}>
                  <div className="booking-step-circle">{currentStep > 3 ? <Check size={16} /> : '3'}</div>
                  <span className="booking-step-label">Documents</span>
                </div>
                <div className={`booking-step ${currentStep === 4 ? 'active' : ''}`}>
                  <div className="booking-step-circle">4</div>
                  <span className="booking-step-label">Review</span>
                </div>
              </div>

              <form id="step-booking-form" onSubmit={handleSubmit}>
                {/* STEP 1: SCHEDULE */}
                {currentStep === 1 && (
                  <div className="booking-form-section animate-fade-in">
                    {vehicle && (
                      <div className="booking-review-card" style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ width: '100px', height: '75px', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'var(--gray-100)' }}>
                          {vehicle.imageUrl ? (
                            <img src={vehicle.imageUrl.startsWith('http') ? vehicle.imageUrl : vehiclesApi.getImageUrl(vehicle.id)} alt={vehicle.model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <Car size={36} color="var(--gray-400)" style={{ margin: '20px auto', display: 'block' }} />
                          )}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem' }}>{vehicle.brand} {vehicle.model}</h3>
                          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem', color: 'var(--gray-500)', flexWrap: 'wrap' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Tag size={14} /> {vehicle.category}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><User size={14} /> {vehicle.seats} Seats</span>
                            <span style={{ fontWeight: 800, color: 'var(--black)' }}>₱{Number(vehicle.dailyRate).toLocaleString()} / day</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="booking-form-grid">
                      <div className="booking-modal-column">
                        <div className="booking-modal-field">
                          <label><Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Pickup Date & Time</label>
                          <input 
                            type="datetime-local"
                            value={formData.start_date}
                            onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                          />
                        </div>
                        <div className="booking-modal-field">
                          <label><Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Return Date & Time</label>
                          <input 
                            type="datetime-local"
                            value={formData.end_date}
                            onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                          />
                        </div>
                        <div className="booking-modal-field">
                          <label><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Pickup Location</label>
                          <div className="location-box">
                            <MapPin size={16} />
                            <span>{formData.pickup_location}</span>
                          </div>
                        </div>

                        <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>Destination & Travel Area</h4>
                        <div className="booking-modal-field">
                          <label>Intended Travel Area (Required)</label>
                          <input 
                            required
                            placeholder="e.g. Bacolod, Silay, Kabankalan"
                            value={formData.destinationName}
                            onChange={(e) => setFormData({...formData, destinationName: e.target.value})}
                          />
                        </div>
                        <div className="booking-modal-field">
                          <label>Destination Address / Specifics (Optional)</label>
                          <input 
                            placeholder="e.g. Campuestohan Highland Resort"
                            value={formData.destinationAddress}
                            onChange={(e) => setFormData({...formData, destinationAddress: e.target.value})}
                          />
                        </div>
                        <div className="booking-modal-field">
                          <label>Travel Notes (Optional)</label>
                          <textarea 
                            rows={2}
                            placeholder="Any details about your trip?"
                            value={formData.destinationNotes}
                            onChange={(e) => setFormData({...formData, destinationNotes: e.target.value})}
                          />
                        </div>
                        
                        <div style={{ backgroundColor: '#F3F4F6', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #9CA3AF', marginTop: '1rem', fontSize: '0.85rem', color: '#4B5563' }}>
                          <strong>Privacy Notice:</strong> GPS and geofence monitoring will be active only during an active rental for vehicle safety and rental policy compliance.
                        </div>

                      </div>

                      <div className="booking-modal-column">
                        {pricingQuote ? (
                          <div className="booking-modal-price-summary" style={{ height: '100%' }}>
                            <h4><Calculator size={16} /> Estimated Price</h4>
                            <div className="price-row">
                              <span>Base Daily Rate</span>
                              <strong>₱{pricingQuote.baseDailyRate.toLocaleString()}</strong>
                            </div>
                            <div className="price-row">
                              <span>Rental Duration</span>
                              <strong>{pricingQuote.rentalDays} {pricingQuote.rentalDays === 1 ? 'Day' : 'Days'}</strong>
                            </div>
                            <div className={`price-row ${pricingQuote.multiplier > 1 ? 'highlight' : ''}`}>
                              <span>Pricing Multiplier</span>
                              <strong>{pricingQuote.multiplier}x</strong>
                            </div>
                            <div className="price-total">
                              <span>Total Amount</span>
                              <strong>₱{pricingQuote.totalPrice.toLocaleString()}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="booking-modal-price-summary empty" style={{ height: '100%', minHeight: '200px' }}>
                            {formData.start_date && formData.end_date && !error ? (
                              <><Loader2 className="animate-spin" size={18} /> Calculating...</>
                            ) : (
                              <div style={{ textAlign: 'center', color: 'var(--gray-400)' }}>
                                <Calculator size={32} style={{ margin: '0 auto 0.5rem' }} />
                                <p>Select dates to calculate estimate</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 2: INFORMATION */}
                {currentStep === 2 && (
                  <div className="booking-form-section animate-fade-in">
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>Personal Information</h3>
                    <div className="booking-form-grid">
                      <div className="booking-modal-field">
                        <label>Full Name (as per ID)</label>
                        <input value={formData.customer_full_name} onChange={(e) => setFormData({...formData, customer_full_name: e.target.value})} placeholder="Juan Dela Cruz" />
                      </div>
                      <div className="booking-modal-field">
                        <label>Contact Number</label>
                        <input value={formData.contact_number} onChange={(e) => setFormData({...formData, contact_number: e.target.value})} placeholder="09XX XXX XXXX" />
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '1rem 0', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>License Details</h3>
                    <div className="booking-form-grid">
                      <div className="booking-modal-field">
                        <label>Driver's License Number</label>
                        <input value={formData.drivers_license_number} onChange={(e) => setFormData({...formData, drivers_license_number: e.target.value})} placeholder="e.g. N01-23-456789" />
                      </div>
                      <div className="booking-modal-field">
                        <label>License Expiry Date</label>
                        <input type="date" value={formData.drivers_license_expiry} onChange={(e) => setFormData({...formData, drivers_license_expiry: e.target.value})} />
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '1rem 0', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>Address & Emergency</h3>
                    <div className="booking-modal-field">
                      <label>Current Address</label>
                      <input value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} placeholder="Complete Residential Address" />
                    </div>
                    <div className="booking-form-grid">
                      <div className="booking-modal-field">
                        <label>Emergency Contact Name</label>
                        <input value={formData.emergency_contact_name} onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})} placeholder="Name" />
                      </div>
                      <div className="booking-modal-field">
                        <label>Emergency Contact Phone</label>
                        <input value={formData.emergency_contact_number} onChange={(e) => setFormData({...formData, emergency_contact_number: e.target.value})} placeholder="Phone" />
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3: DOCUMENTS */}
                {currentStep === 3 && (
                  <div className="booking-form-section animate-fade-in">
                    <div style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1rem', display: 'flex', gap: '0.75rem' }}>
                      <ShieldCheck size={24} color="#0284C7" />
                      <div>
                        <h4 style={{ color: '#0369A1', margin: '0 0 0.25rem', fontWeight: 700 }}>Document Verification</h4>
                        <p style={{ color: '#0C4A6E', fontSize: '0.9rem', margin: 0 }}>Please upload clear, readable images of your requirements. PDF, JPG, and PNG are accepted.</p>
                      </div>
                    </div>

                    <div className="booking-form-grid">
                      <div className="booking-modal-field">
                        <label>1. Valid ID (Passport / Gov ID)</label>
                        <div className="booking-upload-card">
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => handleFileChange(e, 'valid_id')} />
                          <div className="booking-upload-icon">
                            {files.valid_id ? <CheckCircle2 color="#2E7D32" /> : <Upload />}
                          </div>
                          <div className="booking-upload-info">
                            <h5>Upload Valid ID</h5>
                            {files.valid_id ? (
                              <div className="booking-upload-filename"><Check size={14}/> {files.valid_id.name}</div>
                            ) : (
                              <p>Click to browse or drag file</p>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="booking-modal-field">
                        <label>2. Driver's License</label>
                        <div className="booking-upload-card">
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => handleFileChange(e, 'drivers_license')} />
                          <div className="booking-upload-icon">
                            {files.drivers_license ? <CheckCircle2 color="#2E7D32" /> : <Upload />}
                          </div>
                          <div className="booking-upload-info">
                            <h5>Upload Driver's License</h5>
                            {files.drivers_license ? (
                              <div className="booking-upload-filename"><Check size={14}/> {files.drivers_license.name}</div>
                            ) : (
                              <p>Click to browse or drag file</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: REVIEW */}
                {currentStep === 4 && (
                  <div className="booking-form-section animate-fade-in">
                    <div className="booking-review-card">
                      <div className="booking-review-header"><FileText size={18}/> Booking Summary</div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Vehicle</span>
                        <span className="booking-review-value">{vehicle?.brand} {vehicle?.model}</span>
                      </div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Schedule</span>
                        <span className="booking-review-value">
                          {new Date(formData.start_date).toLocaleString()} <br/>
                          to {new Date(formData.end_date).toLocaleString()}
                        </span>
                      </div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Destination</span>
                        <span className="booking-review-value">{formData.destinationName} {formData.destinationAddress ? `(${formData.destinationAddress})` : ''}</span>
                      </div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Total Estimate</span>
                        <span className="booking-review-value" style={{ color: '#2E7D32', fontSize: '1.1rem' }}>
                          ₱{pricingQuote?.totalPrice?.toLocaleString() || 'N/A'}
                        </span>
                      </div>
                    </div>

                    <div className="booking-review-card">
                      <div className="booking-review-header"><User size={18}/> Customer Details</div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Name</span>
                        <span className="booking-review-value">{formData.customer_full_name}</span>
                      </div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">License No.</span>
                        <span className="booking-review-value">{formData.drivers_license_number}</span>
                      </div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Contact</span>
                        <span className="booking-review-value">{formData.contact_number}</span>
                      </div>
                    </div>

                    <div className="booking-review-card" style={{ marginBottom: '1rem' }}>
                      <div className="booking-review-header"><ShieldCheck size={18}/> Uploaded Documents</div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Valid ID</span>
                        <span className="booking-review-value" style={{ color: '#2E7D32' }}><Check size={14}/> {files.valid_id?.name}</span>
                      </div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Driver's License</span>
                        <span className="booking-review-value" style={{ color: '#2E7D32' }}><Check size={14}/> {files.drivers_license?.name}</span>
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: '#F9FAFB', borderRadius: '8px', border: '1px solid #E5E7EB', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={confirmed} 
                        onChange={(e) => setConfirmed(e.target.checked)}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--black)' }}>
                        I confirm that the information and uploaded documents are accurate.
                      </span>
                    </label>
                  </div>
                )}
              </form>

              {error && (
                <div className="booking-modal-error" style={{ marginTop: '1.5rem' }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <div className="booking-modal-footer">
              {currentStep > 1 ? (
                <button type="button" onClick={handleBack} className="btn-outline" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ChevronLeft size={18} /> Back
                </button>
              ) : (
                <button type="button" onClick={onClose} className="btn-outline" disabled={loading}>
                  Cancel
                </button>
              )}
              
              {currentStep < 4 ? (
                <button type="button" onClick={handleNext} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Next <ChevronRight size={18} />
                </button>
              ) : (
                <button type="submit" form="step-booking-form" className="btn-primary" disabled={loading || !confirmed} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Submit Booking Request'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BookingRequestModal;
