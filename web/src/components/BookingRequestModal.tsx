import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Upload, Calendar, MapPin, User, ShieldCheck, AlertCircle, X, CheckCircle2, Calculator, Car, FileText, ChevronRight, ChevronLeft, Check, Tag } from 'lucide-react';
import { bookingsApi, pricingApi, vehiclesApi } from '../services/api';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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
  const [bookedRanges, setBookedRanges] = useState<Array<{startDate: string; endDate: string}>>([]);
  const [bookedDatesLoading, setBookedDatesLoading] = useState(false);
  const [bookedDatesFailed, setBookedDatesFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
      setFieldErrors({});
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

  // Fetch booked date ranges when modal opens or vehicle changes
  useEffect(() => {
    if (isOpen && vehicle?.id) {
      setBookedRanges([]);
      setBookedDatesFailed(false);
      setFormData(prev => ({ ...prev, start_date: '', end_date: '' }));
      setPricingQuote(null);
      setBookedDatesLoading(true);
      bookingsApi.getVehicleBookedDates(vehicle.id)
        .then(({ data }) => setBookedRanges(data))
        .catch(() => setBookedDatesFailed(true))
        .finally(() => setBookedDatesLoading(false));
    }
  }, [isOpen, vehicle?.id]);

  // Real-time overlap validation as dates change — shows inline below the pickup field
  useEffect(() => {
    if (!formData.start_date || !formData.end_date) return;
    const s = new Date(formData.start_date).getTime();
    const e = new Date(formData.end_date).getTime();
    const overlaps = bookedRanges.some(r => s < new Date(r.endDate).getTime() && e > new Date(r.startDate).getTime());
    if (overlaps) {
      setFieldErrors(prev => ({ ...prev, start_date: 'These dates overlap with an existing booking. Please select different dates.' }));
    } else {
      setFieldErrors(prev => {
        if (prev.start_date === 'These dates overlap with an existing booking. Please select different dates.') {
          const { start_date, ...rest } = prev;
          return rest;
        }
        return prev;
      });
    }
  }, [formData.start_date, formData.end_date, bookedRanges]);

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
        setFieldErrors(prev => ({ ...prev, start_date: 'This vehicle is already booked for the selected dates.' }));
      }
      setPricingQuote(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'valid_id' | 'drivers_license') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const clearFieldError = (field: string) => {
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  };

  const getLocalStartOfToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const validateStep = (step: number): boolean => {
    const now = new Date();
    const errors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.start_date) {
        errors.start_date = 'Please select a pickup date.';
      } else if (new Date(formData.start_date) < getLocalStartOfToday()) {
        errors.start_date = 'Pickup date cannot be in the past.';
      }

      if (!formData.end_date) {
        errors.end_date = 'Please select a return date.';
      } else if (formData.start_date && new Date(formData.end_date) <= new Date(formData.start_date)) {
        errors.end_date = 'Return date must be after pickup date.';
      }

      // Overlap/conflict check (only when both dates are otherwise valid)
      if (formData.start_date && formData.end_date && !errors.start_date && !errors.end_date) {
        const s = new Date(formData.start_date).getTime();
        const e = new Date(formData.end_date).getTime();
        if (bookedRanges.some(r => s < new Date(r.endDate).getTime() && e > new Date(r.startDate).getTime())) {
          errors.start_date = 'These dates overlap with an existing booking. Please select different dates.';
        }
        // Carry through any server-side 409 conflict already set in fieldErrors
        if (!errors.start_date && fieldErrors.start_date) {
          errors.start_date = fieldErrors.start_date;
        }
        if (!errors.start_date && !pricingQuote) {
          errors.start_date = 'Price estimate is still loading — please wait a moment, then try again.';
        }
      }

      if (!formData.destinationName) {
        errors.destinationName = 'Please provide your intended travel area.';
      }
    }

    if (step === 2) {
      if (!formData.customer_full_name) errors.customer_full_name = 'Full name is required.';
      if (!formData.contact_number) errors.contact_number = 'Contact number is required.';
      if (!formData.drivers_license_number) errors.drivers_license_number = 'License number is required.';
      if (!formData.drivers_license_expiry) {
        errors.drivers_license_expiry = 'License expiry date is required.';
      } else if (new Date(formData.drivers_license_expiry) < now) {
        errors.drivers_license_expiry = "Your driver's license is expired.";
      }
      if (!formData.address) errors.address = 'Current address is required.';
      if (!formData.emergency_contact_name) errors.emergency_contact_name = 'Emergency contact name is required.';
      if (!formData.emergency_contact_number) errors.emergency_contact_number = 'Emergency contact phone is required.';
    }

    if (step === 3) {
      if (!files.valid_id) errors.valid_id = 'Please upload a Valid ID.';
      if (!files.drivers_license) errors.drivers_license = "Please upload your Driver's License.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstKey = Object.keys(errors)[0];
      setTimeout(() => {
        fieldRefs.current[firstKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 0);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setFieldErrors({});
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

  // Recomputed each render — used by DatePicker props
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const pickupDateObj = formData.start_date ? new Date(formData.start_date) : null;

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
                        {/* Pickup Date */}
                        <div ref={el => { fieldRefs.current['start_date'] = el; }} className="booking-modal-field">
                          <label><Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Pickup Date & Time</label>
                          <div style={fieldErrors.start_date ? { borderRadius: '6px', outline: '2px solid #f87171' } : undefined}>
                            <DatePicker
                              selected={pickupDateObj}
                              onChange={(date: Date | null) => {
                                setFormData(prev => ({
                                  ...prev,
                                  start_date: date ? date.toISOString() : '',
                                  end_date: ''
                                }));
                                clearFieldError('start_date');
                                clearFieldError('end_date');
                              }}
                              showTimeSelect
                              timeFormat="HH:mm"
                              timeIntervals={30}
                              dateFormat="MMMM d, yyyy h:mm aa"
                              minDate={new Date()}
                              minTime={isToday(pickupDateObj) ? new Date() : startOfDay}
                              maxTime={endOfDay}
                              excludeDateIntervals={bookedRanges.map(r => ({
                                start: new Date(r.startDate),
                                end: new Date(r.endDate)
                              }))}
                              placeholderText="Select pickup date & time"
                              popperPlacement="bottom-start"
                              disabled={!vehicle}
                            />
                          </div>
                          {fieldErrors.start_date && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                              ⚠ {fieldErrors.start_date}
                            </p>
                          )}
                        </div>

                        {/* Return Date */}
                        <div ref={el => { fieldRefs.current['end_date'] = el; }} className="booking-modal-field">
                          <label><Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Return Date & Time</label>
                          <div style={fieldErrors.end_date ? { borderRadius: '6px', outline: '2px solid #f87171' } : undefined}>
                            <DatePicker
                              selected={formData.end_date ? new Date(formData.end_date) : null}
                              onChange={(date: Date | null) => {
                                setFormData(prev => ({
                                  ...prev,
                                  end_date: date ? date.toISOString() : ''
                                }));
                                clearFieldError('end_date');
                              }}
                              showTimeSelect
                              timeFormat="HH:mm"
                              timeIntervals={30}
                              dateFormat="MMMM d, yyyy h:mm aa"
                              minDate={pickupDateObj ?? new Date()}
                              excludeDateIntervals={bookedRanges.map(r => ({
                                start: new Date(r.startDate),
                                end: new Date(r.endDate)
                              }))}
                              placeholderText="Select return date & time"
                              popperPlacement="bottom-start"
                              disabled={!formData.start_date}
                            />
                          </div>
                          {fieldErrors.end_date && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                              ⚠ {fieldErrors.end_date}
                            </p>
                          )}
                        </div>

                        {bookedDatesLoading && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted-mauve)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
                            <Loader2 className="animate-spin" size={13} /> Checking availability...
                          </div>
                        )}
                        {!bookedDatesLoading && bookedDatesFailed && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                            ⚠️ Couldn't load availability — conflicts will be caught on submission.
                          </div>
                        )}

                        <div className="booking-modal-field">
                          <label><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> Pickup Location</label>
                          <div className="location-box">
                            <MapPin size={16} />
                            <span>{formData.pickup_location}</span>
                          </div>
                        </div>

                        <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '1.5rem 0 0.5rem' }}>Destination & Travel Area</h4>

                        {/* Destination Name (required) */}
                        <div ref={el => { fieldRefs.current['destinationName'] = el; }} className="booking-modal-field">
                          <label>Intended Travel Area (Required)</label>
                          <input
                            required
                            placeholder="e.g. Bacolod, Silay, Kabankalan"
                            value={formData.destinationName}
                            style={fieldErrors.destinationName ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                            onChange={(e) => {
                              setFormData({...formData, destinationName: e.target.value});
                              clearFieldError('destinationName');
                            }}
                          />
                          {fieldErrors.destinationName && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                              ⚠ {fieldErrors.destinationName}
                            </p>
                          )}
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
                      <div ref={el => { fieldRefs.current['customer_full_name'] = el; }} className="booking-modal-field">
                        <label>Full Name (as per ID)</label>
                        <input
                          value={formData.customer_full_name}
                          style={fieldErrors.customer_full_name ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => { setFormData({...formData, customer_full_name: e.target.value}); clearFieldError('customer_full_name'); }}
                          placeholder="Juan Dela Cruz"
                        />
                        {fieldErrors.customer_full_name && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.customer_full_name}</p>}
                      </div>
                      <div ref={el => { fieldRefs.current['contact_number'] = el; }} className="booking-modal-field">
                        <label>Contact Number</label>
                        <input
                          value={formData.contact_number}
                          style={fieldErrors.contact_number ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => { setFormData({...formData, contact_number: e.target.value}); clearFieldError('contact_number'); }}
                          placeholder="09XX XXX XXXX"
                        />
                        {fieldErrors.contact_number && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.contact_number}</p>}
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '1rem 0', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>License Details</h3>
                    <div className="booking-form-grid">
                      <div ref={el => { fieldRefs.current['drivers_license_number'] = el; }} className="booking-modal-field">
                        <label>Driver's License Number</label>
                        <input
                          value={formData.drivers_license_number}
                          style={fieldErrors.drivers_license_number ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => { setFormData({...formData, drivers_license_number: e.target.value}); clearFieldError('drivers_license_number'); }}
                          placeholder="e.g. N01-23-456789"
                        />
                        {fieldErrors.drivers_license_number && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.drivers_license_number}</p>}
                      </div>
                      <div ref={el => { fieldRefs.current['drivers_license_expiry'] = el; }} className="booking-modal-field">
                        <label>License Expiry Date</label>
                        <input
                          type="date"
                          value={formData.drivers_license_expiry}
                          style={fieldErrors.drivers_license_expiry ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => { setFormData({...formData, drivers_license_expiry: e.target.value}); clearFieldError('drivers_license_expiry'); }}
                        />
                        {fieldErrors.drivers_license_expiry && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.drivers_license_expiry}</p>}
                      </div>
                    </div>

                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: '1rem 0', borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.5rem' }}>Address & Emergency</h3>
                    <div ref={el => { fieldRefs.current['address'] = el; }} className="booking-modal-field">
                      <label>Current Address</label>
                      <input
                        value={formData.address}
                        style={fieldErrors.address ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                        onChange={(e) => { setFormData({...formData, address: e.target.value}); clearFieldError('address'); }}
                        placeholder="Complete Residential Address"
                      />
                      {fieldErrors.address && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.address}</p>}
                    </div>
                    <div className="booking-form-grid">
                      <div ref={el => { fieldRefs.current['emergency_contact_name'] = el; }} className="booking-modal-field">
                        <label>Emergency Contact Name</label>
                        <input
                          value={formData.emergency_contact_name}
                          style={fieldErrors.emergency_contact_name ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => { setFormData({...formData, emergency_contact_name: e.target.value}); clearFieldError('emergency_contact_name'); }}
                          placeholder="Name"
                        />
                        {fieldErrors.emergency_contact_name && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.emergency_contact_name}</p>}
                      </div>
                      <div ref={el => { fieldRefs.current['emergency_contact_number'] = el; }} className="booking-modal-field">
                        <label>Emergency Contact Phone</label>
                        <input
                          value={formData.emergency_contact_number}
                          style={fieldErrors.emergency_contact_number ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => { setFormData({...formData, emergency_contact_number: e.target.value}); clearFieldError('emergency_contact_number'); }}
                          placeholder="Phone"
                        />
                        {fieldErrors.emergency_contact_number && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.emergency_contact_number}</p>}
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
                      <div ref={el => { fieldRefs.current['valid_id'] = el; }} className="booking-modal-field">
                        <label>1. Valid ID (Passport / Gov ID)</label>
                        <div className="booking-upload-card" style={fieldErrors.valid_id ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}>
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { handleFileChange(e, 'valid_id'); clearFieldError('valid_id'); }} />
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
                        {fieldErrors.valid_id && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.valid_id}</p>}
                      </div>

                      <div ref={el => { fieldRefs.current['drivers_license'] = el; }} className="booking-modal-field">
                        <label>2. Driver's License</label>
                        <div className="booking-upload-card" style={fieldErrors.drivers_license ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}>
                          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { handleFileChange(e, 'drivers_license'); clearFieldError('drivers_license'); }} />
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
                        {fieldErrors.drivers_license && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.drivers_license}</p>}
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
