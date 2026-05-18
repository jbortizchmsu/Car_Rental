import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Upload, Calendar, MapPin, User, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { vehiclesApi, bookingsApi, pricingApi } from '../services/api';
import { Tag, Calculator } from 'lucide-react';

const RequestRentalPage: React.FC = () => {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(location.state?.vehicle || null);
  
  // Form State
  const [formData, setFormData] = useState({
    vehicle_id: selectedVehicle?.id || '',
    start_date: '',
    end_date: '',
    pickup_location: 'JD Car Rental Main Shop',
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
  const [success, setSuccess] = useState(false);
  const [pricingQuote, setPricingQuote] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: location } });
    }
    
    if (!selectedVehicle) {
      fetchAvailableVehicles();
    }
  }, [user, selectedVehicle]);

  useEffect(() => {
    if (formData.vehicle_id && formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (start < end) {
        fetchPricingQuote();
      }
    }
  }, [formData.vehicle_id, formData.start_date, formData.end_date]);

  const fetchPricingQuote = async () => {
    try {
      const { data } = await pricingApi.getQuote({
        vehicleId: formData.vehicle_id,
        startDate: formData.start_date,
        endDate: formData.end_date
      });
      setPricingQuote(data);
    } catch (err) {
      console.error('Pricing quote error:', err);
    }
  };

  const fetchAvailableVehicles = async (start?: string, end?: string) => {
    try {
      const { data } = await vehiclesApi.getAvailable(start, end);
      setVehicles(data || []);
    } catch (err: any) {
      console.error('Error fetching vehicles:', err);
      setError('Unable to reach the server. Please ensure the backend is running.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'valid_id' | 'drivers_license') => {
    if (e.target.files && e.target.files[0]) {
      setFiles({ ...files, [type]: e.target.files[0] });
    }
  };

  const validateForm = () => {
    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    const now = new Date();
    const expiry = new Date(formData.drivers_license_expiry);

    if (!formData.vehicle_id) return 'Please select a vehicle.';
    if (start < now) return 'Pickup date cannot be in the past.';
    if (start >= end) return 'Return date must be after pickup date.';
    if (expiry < now) return 'Your driver\'s license is expired.';
    if (!files.valid_id || !files.drivers_license) return 'Please upload all required documents.';
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Create Booking
      const bookingRequest = {
        vehicleId: formData.vehicle_id,
        startDate: formData.start_date,
        endDate: formData.end_date,
        pickupLocation: formData.pickup_location,
        // Include extra fields for backend validation even if they aren't in schema yet
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
        if (!err.response) {
          throw new Error('Backend server is not reachable. Make sure the server is running on http://localhost:4000.');
        }
        if (err.response.status === 401) {
          throw new Error('Your session expired. Please log in again.');
        }
        throw new Error(err.response.data?.error || 'Booking submission failed.');
      }

      const booking = bookingResponse.data;

      // 2. Upload Documents sequentially
      try {
        if (files.valid_id) {
          await bookingsApi.uploadDocument(booking.id, 'valid_id', files.valid_id);
        }
        if (files.drivers_license) {
          await bookingsApi.uploadDocument(booking.id, 'drivers_license', files.drivers_license);
        }
      } catch (err: any) {
        throw new Error('Booking created, but document upload failed. Please contact support.');
      }

      setSuccess(true);
      setTimeout(() => navigate('/customer/my-bookings'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit rental request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main style={{ flex: 1, padding: '4rem 0' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Book a Vehicle</h1>
            <p style={{ color: 'var(--muted-mauve)' }}>Complete the form below to start your self-drive journey.</p>
          </div>

          {success ? (
            <div style={{ 
              backgroundColor: 'white', 
              padding: '4rem', 
              borderRadius: '20px', 
              textAlign: 'center',
              boxShadow: 'var(--shadow-soft)'
            }}>
              <CheckCircle2 size={64} color="#2E7D32" style={{ margin: '0 auto 1.5rem' }} />
              <h2 style={{ marginBottom: '1rem' }}>Booking Request Submitted!</h2>
              <p style={{ color: 'var(--muted-mauve)', fontSize: '1.1rem', marginBottom: '2rem' }}>
                Your booking request has been sent to JD Car Rental. 
                Owner/Admin will review your documents shortly.
              </p>
              <div style={{ backgroundColor: 'var(--soft-beige)', padding: '1.5rem', borderRadius: '12px' }}>
                <p style={{ fontWeight: 600, color: 'var(--black)' }}>What's next?</p>
                <p style={{ fontSize: '0.9rem', color: 'var(--muted-mauve)' }}>
                  Once approved, the "Pay Now" button will be unlocked in your "My Bookings" page.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              {/* Left Column: Booking Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow-soft)' }}>
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={20} color="var(--warm-taupe)" /> Rental Details
                  </h3>
                  
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Select Vehicle</label>
                    <select 
                      required
                      value={formData.vehicle_id}
                      onChange={(e) => {
                        setFormData({...formData, vehicle_id: e.target.value});
                        setSelectedVehicle(vehicles.find(v => v.id === e.target.value));
                      }}
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                    >
                      <option value="">-- Select a Vehicle --</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model} (₱{Number(v.dailyRate).toLocaleString()}/day)</option>
                      ))}
                      {selectedVehicle && !vehicles.find(v => v.id === selectedVehicle.id) && (
                        <option value={selectedVehicle.id}>{selectedVehicle.brand} {selectedVehicle.model} (Selected)</option>
                      )}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Pickup Date</label>
                      <input 
                         type="datetime-local"
                         required
                         value={formData.start_date}
                         onChange={(e) => {
                           const newDate = e.target.value;
                           setFormData({...formData, start_date: newDate});
                           if (formData.end_date && newDate) {
                             fetchAvailableVehicles(newDate, formData.end_date);
                           }
                         }}
                         style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Return Date</label>
                      <input 
                         type="datetime-local"
                         required
                         value={formData.end_date}
                         onChange={(e) => {
                           const newDate = e.target.value;
                           setFormData({...formData, end_date: newDate});
                           if (formData.start_date && newDate) {
                             fetchAvailableVehicles(formData.start_date, newDate);
                           }
                         }}
                         style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Pickup Location</label>
                    <div style={{ padding: '0.8rem', borderRadius: '8px', backgroundColor: '#f9f9f9', border: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <MapPin size={18} color="var(--muted-mauve)" />
                      <span>{formData.pickup_location}</span>
                    </div>
                  </div>
                </div>

                <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow-soft)' }}>
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldCheck size={20} color="var(--warm-taupe)" /> Required Documents
                  </h3>
                  
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Valid ID (Passport/Gov ID)</label>
                    <div style={{ 
                      border: '2px dashed #ddd', 
                      padding: '1.5rem', 
                      borderRadius: '12px', 
                      textAlign: 'center',
                      position: 'relative',
                      cursor: 'pointer'
                    }}>
                      <input 
                        type="file" 
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, 'valid_id')}
                        style={{ position: 'absolute', opacity: 0, top: 0, left: 0, right: 0, bottom: 0, cursor: 'pointer' }}
                      />
                      <Upload size={24} color="var(--muted-mauve)" style={{ marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>
                        {files.valid_id ? files.valid_id.name : 'Click to upload or drag and drop'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Driver's License</label>
                    <div style={{ 
                      border: '2px dashed #ddd', 
                      padding: '1.5rem', 
                      borderRadius: '12px', 
                      textAlign: 'center',
                      position: 'relative',
                      cursor: 'pointer'
                    }}>
                      <input 
                        type="file" 
                        accept="image/*,.pdf"
                        onChange={(e) => handleFileChange(e, 'drivers_license')}
                        style={{ position: 'absolute', opacity: 0, top: 0, left: 0, right: 0, bottom: 0, cursor: 'pointer' }}
                      />
                      <Upload size={24} color="var(--muted-mauve)" style={{ marginBottom: '0.5rem' }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>
                        {files.drivers_license ? files.drivers_license.name : 'Click to upload or drag and drop'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Customer Info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow-soft)' }}>
                  <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={20} color="var(--warm-taupe)" /> Personal Information
                  </h3>
                  
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Full Name (as per ID)</label>
                    <input 
                      required
                      value={formData.customer_full_name}
                      onChange={(e) => setFormData({...formData, customer_full_name: e.target.value})}
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Contact Number</label>
                      <input 
                        required
                        value={formData.contact_number}
                        onChange={(e) => setFormData({...formData, contact_number: e.target.value})}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>License Expiry</label>
                      <input 
                        type="date"
                        required
                        value={formData.drivers_license_expiry}
                        onChange={(e) => setFormData({...formData, drivers_license_expiry: e.target.value})}
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>License Number</label>
                    <input 
                      required
                      value={formData.drivers_license_number}
                      onChange={(e) => setFormData({...formData, drivers_license_number: e.target.value})}
                      placeholder="e.g. N01-23-456789"
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                    />
                  </div>

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Current Address</label>
                    <textarea 
                      required
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Emergency Contact</label>
                      <input 
                        required
                        value={formData.emergency_contact_name}
                        onChange={(e) => setFormData({...formData, emergency_contact_name: e.target.value})}
                        placeholder="Name"
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Emergency Phone</label>
                      <input 
                        required
                        value={formData.emergency_contact_number}
                        onChange={(e) => setFormData({...formData, emergency_contact_number: e.target.value})}
                        placeholder="Phone"
                        style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ddd' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Price Breakdown Card */}
                {pricingQuote && (
                  <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: 'var(--shadow-soft)', border: '2px solid var(--soft-beige)' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calculator size={20} color="var(--warm-taupe)" /> Estimated Total
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-mauve)' }}>Base Daily Rate</span>
                        <span style={{ fontWeight: 600 }}>₱{pricingQuote.baseDailyRate.toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--muted-mauve)' }}>Rental Duration</span>
                        <span style={{ fontWeight: 600 }}>{pricingQuote.rentalDays} {pricingQuote.rentalDays === 1 ? 'Day' : 'Days'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: pricingQuote.multiplier > 1 ? '#C62828' : 'inherit' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted-mauve)' }}>
                          <Tag size={16} /> Pricing Multiplier
                        </span>
                        <span style={{ fontWeight: 700 }}>{pricingQuote.multiplier}x</span>
                      </div>
                      {pricingQuote.appliedRuleName && (
                        <div style={{ fontSize: '0.75rem', color: '#C62828', fontStyle: 'italic', textAlign: 'right', marginTop: '-0.4rem' }}>
                          Applied: {pricingQuote.appliedRuleName}
                        </div>
                      )}
                      
                      <div style={{ marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Total Amount</span>
                        <span style={{ fontWeight: 900, fontSize: '1.5rem', color: 'var(--black)' }}>₱{pricingQuote.totalPrice.toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--muted-mauve)', textAlign: 'right', margin: 0 }}>
                        Includes all applicable taxes and adjustments.
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div style={{ backgroundColor: '#FFEBEE', color: '#C62828', padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <AlertCircle size={20} />
                    <span style={{ fontSize: '0.9rem' }}>{error}</span>
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn-primary" 
                  style={{ width: '100%', padding: '1.25rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
                >
                  {loading ? <Loader2 className="animate-spin" size={24} /> : 'Submit Booking Request'}
                </button>
                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>
                  By submitting, you agree to our terms of service and verify that all information is accurate.
                </p>
              </div>
            </form>
          )}
        </div>
      </main>
    </>
  );
};

export default RequestRentalPage;
