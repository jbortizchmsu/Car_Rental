import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Upload, Calendar, MapPin, User, ShieldCheck, AlertCircle, X, CheckCircle2, Calculator, Car, FileText, ChevronRight, ChevronLeft, Check, Tag, Eye, RefreshCw } from 'lucide-react';
import { bookingsApi, pricingApi, vehiclesApi } from '../services/api';
import { NEGROS_LOCATIONS, NEGROS_OCC, NEGROS_OR } from '../utils/negros-locations';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import ConfirmActionModal from './ConfirmActionModal';

interface DocumentUploadCardProps {
  title: string;
  file: File | null;
  accept?: string;
  hasError?: boolean;
  onChange: (file: File) => void;
  onClearError?: () => void;
}

const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  title,
  file,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  hasError,
  onChange,
  onClearError
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleCardClick = () => {
    if (!file) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files[0]);
      if (onClearError) onClearError();
    }
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleClosePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const handleChangeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {!file ? (
        <div
          className="booking-upload-card"
          style={hasError ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
          onClick={handleCardClick}
        >
          <div className="booking-upload-icon">
            <Upload />
          </div>
          <div className="booking-upload-info" style={{ flex: 1 }}>
            <h5>{title}</h5>
            <p>Click to browse or drag file</p>
          </div>
        </div>
      ) : (
        <div
          className="booking-upload-card"
          style={{
            cursor: 'default',
            justifyContent: 'space-between',
            borderColor: '#bbf7d0',
            backgroundColor: '#f0fdf4',
            padding: '0.9rem 0.85rem',
            gap: '0.65rem',
            overflow: 'hidden',
            ...(hasError ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : {})
          }}
        >
          {/* Zone 1: Preview Zone (Clickable) */}
          <div
            onClick={handlePreviewClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              flex: 1,
              cursor: 'pointer',
              minWidth: 0,
              overflow: 'hidden'
            }}
            title="Click to preview file"
          >
            <div className="booking-upload-icon" style={{ backgroundColor: '#dcfce7', flexShrink: 0, width: '40px', height: '40px' }}>
              <CheckCircle2 color="#2E7D32" size={22} />
            </div>
            <div className="booking-upload-info" style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', minWidth: 0 }}>
                <h5 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--black)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {title}
                </h5>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: '#15803d',
                    backgroundColor: '#dcfce7',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    flexShrink: 0
                  }}
                >
                  <Eye size={11} /> Preview
                </span>
              </div>
              <div
                className="booking-upload-filename"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: '0.2rem',
                  fontSize: '0.8rem',
                  minWidth: 0
                }}
              >
                <Check size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              </div>
            </div>
          </div>

          {/* Zone 2: Change Button */}
          <button
            type="button"
            onClick={handleChangeClick}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.4rem 0.65rem',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--gray-700)',
              backgroundColor: 'var(--white)',
              border: '1px solid var(--gray-300)',
              borderRadius: '8px',
              cursor: 'pointer',
              flexShrink: 0,
              marginLeft: '0.25rem',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={12} /> Change
          </button>
        </div>
      )}

      {/* Local Preview Modal */}
      {previewUrl && file && (
        <div className="modal-overlay" style={{ zIndex: 2200 }} onClick={handleClosePreview}>
          <div
            className="modal-container"
            style={{
              maxWidth: '800px',
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
                <h3 className="modal-title" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Document Preview</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--muted-mauve)', margin: '2px 0 0' }}>{file.name}</p>
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
              {file.type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={file.name}
                  style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
              ) : file.type === 'application/pdf' ? (
                <iframe
                  src={previewUrl}
                  title={file.name}
                  style={{ width: '100%', height: '65vh', border: 'none', borderRadius: '8px' }}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <FileText size={56} color="var(--muted-mauve)" style={{ margin: '0 auto 1rem' }} />
                  <p style={{ fontWeight: 600 }}>{file.name}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', marginTop: '0.25rem' }}>
                    Preview is available for JPG, PNG, WEBP, and PDF files.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

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
  const [checkboxError, setCheckboxError] = useState(false);
  const [showCheckboxAlertModal, setShowCheckboxAlertModal] = useState(false);
  const checkboxRef = useRef<HTMLLabelElement | null>(null);
  const [bookedRanges, setBookedRanges] = useState<Array<{ startDate: string; endDate: string }>>([]);
  const [bookedDatesLoading, setBookedDatesLoading] = useState(false);
  const [bookedDatesFailed, setBookedDatesFailed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const step4MountedAtRef = useRef<number>(0);

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
      setCheckboxError(false);
      setShowCheckboxAlertModal(false);
    }
  }, [isOpen, profile]);

  useEffect(() => {
    if (currentStep === 4) {
      step4MountedAtRef.current = Date.now();
    }
    setCheckboxError(false);
    setShowCheckboxAlertModal(false);
  }, [currentStep]);

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

      if (!formData.destinationName || formData.destinationName.trim() === '') {
        errors.destinationName = 'Please select your intended travel area.';
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
    if (currentStep < 4) {
      handleNext();
      return;
    }

    if (Date.now() - step4MountedAtRef.current < 400) {
      return;
    }

    if (!confirmed) {
      setCheckboxError(true);
      setShowCheckboxAlertModal(true);
      setTimeout(() => {
        checkboxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
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
              Your booking request has been sent to JD Car Rental.<br />
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

                        {/* Destination Name (required) — municipality dropdown */}
                        <div ref={el => { fieldRefs.current['destinationName'] = el; }} className="booking-modal-field">
                          <label>Intended Travel Area (Required)</label>
                          <select
                            value={formData.destinationName}
                            style={fieldErrors.destinationName ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                            onChange={(e) => {
                              const selected = NEGROS_LOCATIONS.find(l => l.municipality === e.target.value);
                              setFormData(prev => ({
                                ...prev,
                                destinationName: e.target.value,
                                destinationAddress: selected
                                  ? `${e.target.value}, ${selected.province}, Negros Island, Philippines`
                                  : '',
                              }));
                              clearFieldError('destinationName');
                            }}
                          >
                            <option value="">Select destination municipality...</option>
                            <optgroup label="— Negros Occidental —">
                              {NEGROS_OCC.map(loc => (
                                <option key={loc.municipality} value={loc.municipality}>
                                  {loc.municipality} ({loc.type})
                                </option>
                              ))}
                            </optgroup>
                            <optgroup label="— Negros Oriental —">
                              {NEGROS_OR.map(loc => (
                                <option key={loc.municipality} value={loc.municipality}>
                                  {loc.municipality} ({loc.type})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                          {fieldErrors.destinationName && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                              ⚠ {fieldErrors.destinationName}
                            </p>
                          )}
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>
                            Travel is restricted to Negros Island municipalities only.
                          </p>
                        </div>

                        <div className="booking-modal-field">
                          <label>Specific Destination / Landmark <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(Optional)</span></label>
                          <input
                            placeholder="e.g. Campuestohan Highland Resort, Barangay Mansilingan"
                            value={formData.destinationAddress}
                            onChange={(e) => setFormData(prev => ({ ...prev, destinationAddress: e.target.value }))}
                          />
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#9CA3AF' }}>
                            Add a specific landmark or barangay within your selected municipality.
                          </p>
                        </div>
                        <div className="booking-modal-field">
                          <label>Travel Notes (Optional)</label>
                          <textarea
                            rows={2}
                            placeholder="Any details about your trip?"
                            value={formData.destinationNotes}
                            onChange={(e) => setFormData({ ...formData, destinationNotes: e.target.value })}
                          />
                        </div>

                        <div style={{ backgroundColor: '#F3F4F6', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #9CA3AF', marginTop: '1rem', fontSize: '0.85rem', color: '#4B5563' }}>
                          <strong>Privacy Notice:</strong> GPS and geofence monitoring will be active only during an active rental for vehicle safety and rental policy compliance.
                        </div>
                      </div>

                      <div className="booking-modal-column sticky-price-column">
                        {pricingQuote ? (
                          <div className="booking-modal-price-summary">
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
                              <strong style={{ color: pricingQuote.multiplier > 1 ? '#EA580C' : undefined }}>
                                {pricingQuote.multiplier}x
                              </strong>
                            </div>

                            {/* Active rule badge */}
                            {pricingQuote.appliedRuleName && pricingQuote.multiplier > 1 ? (
                              <div style={{ marginTop: '0.4rem', backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: '8px', padding: '0.55rem 0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                                  <span style={{ color: '#EA580C', fontSize: '0.75rem', lineHeight: '1.4' }}>⚡</span>
                                  <div>
                                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9A3412', margin: 0 }}>
                                      {pricingQuote.appliedRuleName} pricing active
                                    </p>
                                    {pricingQuote.appliedRuleDescription && (
                                      <p style={{ fontSize: '0.7rem', color: '#C2410C', margin: '2px 0 0' }}>
                                        {pricingQuote.appliedRuleDescription}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ marginTop: '0.4rem', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '0.55rem 0.75rem' }}>
                                <p style={{ fontSize: '0.75rem', color: '#15803D', margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                  <span>✓</span> Standard rate — no surcharge for selected dates
                                </p>
                              </div>
                            )}
                            <div className="price-total">
                              <span>Total Amount</span>
                              <strong>₱{pricingQuote.totalPrice.toLocaleString()}</strong>
                            </div>
                          </div>
                        ) : (
                          <div className="booking-modal-price-summary empty">
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
                          onChange={(e) => { setFormData({ ...formData, customer_full_name: e.target.value }); clearFieldError('customer_full_name'); }}
                          placeholder="Juan Dela Cruz"
                        />
                        {fieldErrors.customer_full_name && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.customer_full_name}</p>}
                      </div>
                      <div ref={el => { fieldRefs.current['contact_number'] = el; }} className="booking-modal-field">
                        <label>Contact Number</label>
                        <input
                          value={formData.contact_number}
                          style={fieldErrors.contact_number ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => { setFormData({ ...formData, contact_number: e.target.value }); clearFieldError('contact_number'); }}
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
                          onChange={(e) => { setFormData({ ...formData, drivers_license_number: e.target.value }); clearFieldError('drivers_license_number'); }}
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
                          onChange={(e) => { setFormData({ ...formData, drivers_license_expiry: e.target.value }); clearFieldError('drivers_license_expiry'); }}
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
                        onChange={(e) => { setFormData({ ...formData, address: e.target.value }); clearFieldError('address'); }}
                        placeholder="Complete Residential Address"
                        maxLength={100}
                      />
                      {fieldErrors.address && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.address}</p>}
                    </div>
                    <div className="booking-form-grid">
                      <div ref={el => { fieldRefs.current['emergency_contact_name'] = el; }} className="booking-modal-field">
                        <label>Emergency Contact Name</label>
                        <input
                          value={formData.emergency_contact_name}
                          style={fieldErrors.emergency_contact_name ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => { setFormData({ ...formData, emergency_contact_name: e.target.value }); clearFieldError('emergency_contact_name'); }}
                          placeholder="Name"
                          maxLength={50}
                        />
                        {fieldErrors.emergency_contact_name && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.emergency_contact_name}</p>}
                      </div>
                      <div ref={el => { fieldRefs.current['emergency_contact_number'] = el; }} className="booking-modal-field">
                        <label>Emergency Contact Phone</label>
                        <input
                          value={formData.emergency_contact_number}
                          style={fieldErrors.emergency_contact_number ? { borderColor: '#f87171', backgroundColor: '#fef2f2' } : undefined}
                          onChange={(e) => {
                            const digitsOnly = e.target.value.replace(/[^0-9]/g, '');
                            setFormData({ ...formData, emergency_contact_number: digitsOnly });
                            clearFieldError('emergency_contact_number');
                          }}
                          placeholder="Phone"
                          inputMode="numeric"
                          maxLength={11}
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
                        <DocumentUploadCard
                          title="Upload Valid ID"
                          file={files.valid_id}
                          hasError={!!fieldErrors.valid_id}
                          onChange={(file) => setFiles(prev => ({ ...prev, valid_id: file }))}
                          onClearError={() => clearFieldError('valid_id')}
                        />
                        {fieldErrors.valid_id && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.valid_id}</p>}
                      </div>

                      <div ref={el => { fieldRefs.current['drivers_license'] = el; }} className="booking-modal-field">
                        <label>2. Driver's License</label>
                        <DocumentUploadCard
                          title="Upload Driver's License"
                          file={files.drivers_license}
                          hasError={!!fieldErrors.drivers_license}
                          onChange={(file) => setFiles(prev => ({ ...prev, drivers_license: file }))}
                          onClearError={() => clearFieldError('drivers_license')}
                        />
                        {fieldErrors.drivers_license && <p style={{ margin: '0.25rem 0 0', fontSize: '0.78rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>⚠ {fieldErrors.drivers_license}</p>}
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 4: REVIEW */}
                {currentStep === 4 && (
                  <div className="booking-form-section animate-fade-in">
                    <div className="booking-review-card">
                      <div className="booking-review-header"><FileText size={18} /> Booking Summary</div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Vehicle</span>
                        <span className="booking-review-value">{vehicle?.brand} {vehicle?.model}</span>
                      </div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Schedule</span>
                        <span className="booking-review-value">
                          {new Date(formData.start_date).toLocaleString()} <br />
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
                      <div className="booking-review-header"><User size={18} /> Customer Details</div>
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
                      <div className="booking-review-header"><ShieldCheck size={18} /> Uploaded Documents</div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Valid ID</span>
                        <span className="booking-review-value" style={{ color: '#2E7D32' }}><Check size={14} /> {files.valid_id?.name}</span>
                      </div>
                      <div className="booking-review-row">
                        <span className="booking-review-label">Driver's License</span>
                        <span className="booking-review-value" style={{ color: '#2E7D32' }}><Check size={14} /> {files.drivers_license?.name}</span>
                      </div>
                    </div>

                    <label
                      ref={checkboxRef}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '1rem',
                        backgroundColor: checkboxError ? '#FEF2F2' : '#F9FAFB',
                        borderRadius: '8px',
                        border: checkboxError ? '2px solid #DC2626' : '1px solid #E5E7EB',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(e) => {
                          setConfirmed(e.target.checked);
                          if (e.target.checked) {
                            setCheckboxError(false);
                          }
                        }}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--black)' }}>
                        I confirm that the information and uploaded documents are accurate.
                      </span>
                    </label>
                    {checkboxError && (
                      <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}>
                        ⚠ Please check the box to proceed.
                      </p>
                    )}
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
                <button type="submit" form="step-booking-form" className="btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Submit Booking Request'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <ConfirmActionModal
        isOpen={showCheckboxAlertModal}
        title="Confirmation Required"
        message="Please check the box to proceed."
        variant="warning"
        confirmLabel="OK"
        cancelLabel="Close"
        onConfirm={() => setShowCheckboxAlertModal(false)}
        onCancel={() => setShowCheckboxAlertModal(false)}
      />
    </div>
  );
};

export default BookingRequestModal;
