import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { bookingsApi } from '../services/api';
import {
  Loader2, Key,
  RotateCcw, CheckCircle2, AlertTriangle,
  Car, ClipboardCheck,
  ShieldAlert, X
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { usePageHeader } from '../contexts/PageHeaderContext';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { getApiErrorMessage } from '../services/api';

const AdminActiveRentalsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PICKUP' | 'ACTIVE' | 'RETURNED'>('PICKUP');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [odometer, setOdometer] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [checklistConfirmed, setChecklistConfirmed] = useState(false);
  const [agreementSigned, setAgreementSigned] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [damageFound, setDamageFound] = useState(false);
  const [damageDetails, setDamageDetails] = useState({ type: 'Scratch', severity: 'LOW', desc: '', cost: '' });

  const toast = useToast();
  const { setPageHeader } = usePageHeader();
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'CONFIRM_CASH' | 'RELEASE' | 'RETURN' | 'COMPLETE' | null;
  }>({ isOpen: false, type: null });
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    setPageHeader({
      title: 'Fleet Operations',
      subtitle: 'Monitor and manage active vehicle rentals'
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  useEffect(() => {
    fetchBookings();
  }, [activeTab]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      let status = '';
      if (activeTab === 'PICKUP') status = 'READY_FOR_PICKUP';
      else if (activeTab === 'ACTIVE') status = 'ACTIVE';
      else if (activeTab === 'RETURNED') status = 'RETURNED';

      const { data } = await bookingsApi.getActiveList(status);
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type: typeof modalConfig.type) => {
    setModalError(null);
    setModalConfig({ isOpen: true, type });
  };

  const closeModal = () => {
    if (actionLoading) return;
    setModalConfig({ isOpen: false, type: null });
    setModalError(null);
  };

  const executeModalAction = async () => {
    if (!selectedBooking || !modalConfig.type) return;
    
    setModalError(null);
    setActionLoading(true);

    try {
      if (modalConfig.type === 'CONFIRM_CASH') {
        const amount = calculateRemainingBalance(selectedBooking);
        await bookingsApi.confirmCashPayment(selectedBooking.id, amount);
        toast.success('Cash payment confirmed', 'The balance has been recorded.');
        const { data } = await bookingsApi.getDetails(selectedBooking.id);
        setSelectedBooking(data);
        fetchBookings();
      } else if (modalConfig.type === 'RELEASE') {
        await bookingsApi.releaseVehicle(selectedBooking.id, {
          odometer: parseFloat(odometer),
          notes,
          checklistConfirmed: true
        });
        toast.success('Vehicle released', 'Rental is now active.');
        resetForm();
        fetchBookings();
      } else if (modalConfig.type === 'RETURN') {
        await bookingsApi.markReturned(selectedBooking.id, {
          odometer: parseFloat(odometer),
          notes,
          damageFound,
          damageDetails: damageFound ? damageDetails : null
        });
        toast.success('Vehicle returned', 'The return has been recorded.');
        resetForm();
        fetchBookings();
      } else if (modalConfig.type === 'COMPLETE') {
        await bookingsApi.completeRental(selectedBooking.id, { maintenance: false });
        toast.success('Rental completed', 'The vehicle is available again.');
        resetForm();
        fetchBookings();
      }
      
      closeModal();
    } catch (error: any) {
      setModalError(getApiErrorMessage(error));
      toast.error('Action failed', getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSignAgreement = async () => {
    if (!selectedBooking || !signerName) return;
    setActionLoading(true);
    try {
      await bookingsApi.signAgreement(selectedBooking.id, signerName);
      setAgreementSigned(true);
      toast.success('Agreement Signed', 'Digital signature recorded.');
      const { data } = await bookingsApi.getDetails(selectedBooking.id);
      setSelectedBooking(data);
    } catch (error: any) {
      toast.error('Failed to sign agreement', getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCash = () => openModal('CONFIRM_CASH');

  const handleRelease = () => {
    if (!odometer) return toast.warning('Odometer Required', 'Please enter the release odometer reading.');
    if (!checklistConfirmed) return toast.warning('Checklist Required', 'Please confirm the pre-release checklist.');
    if (!agreementSigned) return toast.warning('Agreement Required', 'The rental agreement must be signed.');
    openModal('RELEASE');
  };

  const handleReturn = () => {
    if (!odometer) return toast.warning('Odometer Required', 'Please enter the return odometer reading.');
    openModal('RETURN');
  };

  const handleComplete = () => openModal('COMPLETE');

  const resetForm = () => {
    setSelectedBooking(null);
    setOdometer('');
    setNotes('');
    setChecklistConfirmed(false);
    setAgreementSigned(false);
    setSignerName('');
    setDamageFound(false);
    setDamageDetails({ type: 'Scratch', severity: 'LOW', desc: '', cost: '' });
  };

  const calculateRemainingBalance = (booking: any) => {
    const total = Number(booking.totalAmount);
    const paid = (booking.payments || []).reduce((acc: number, p: any) => {
      if (p.status === 'VERIFIED' || p.status === 'PAID_IN_PERSON') return acc + Number(p.amount);
      return acc;
    }, 0);
    return Math.max(0, total - paid);
  };

  const isFullyPaid = (booking: any) => {
    return calculateRemainingBalance(booking) === 0;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e5e7eb' }}>
        <button 
          onClick={() => setActiveTab('PICKUP')}
          style={{ 
            padding: '1rem 2rem', 
            backgroundColor: 'transparent', 
            border: 'none', 
            borderBottom: activeTab === 'PICKUP' ? '3px solid var(--warm-taupe)' : '3px solid transparent',
            color: activeTab === 'PICKUP' ? 'var(--warm-taupe)' : '#6b7280',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Pickups (Ready)
        </button>
        <button 
          onClick={() => setActiveTab('ACTIVE')}
          style={{ 
            padding: '1rem 2rem', 
            backgroundColor: 'transparent', 
            border: 'none', 
            borderBottom: activeTab === 'ACTIVE' ? '3px solid var(--warm-taupe)' : '3px solid transparent',
            color: activeTab === 'ACTIVE' ? 'var(--warm-taupe)' : '#6b7280',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Active Rentals
        </button>
        <button 
          onClick={() => setActiveTab('RETURNED')}
          style={{ 
            padding: '1rem 2rem', 
            backgroundColor: 'transparent', 
            border: 'none', 
            borderBottom: activeTab === 'RETURNED' ? '3px solid var(--warm-taupe)' : '3px solid transparent',
            color: activeTab === 'RETURNED' ? 'var(--warm-taupe)' : '#6b7280',
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Returns for Inspection
        </button>
      </div>

      {/* List */}
      <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th style={{ padding: '1rem', color: '#6b7280', fontWeight: 600 }}>Customer</th>
              <th style={{ padding: '1rem', color: '#6b7280', fontWeight: 600 }}>Vehicle</th>
              <th style={{ padding: '1rem', color: '#6b7280', fontWeight: 600 }}>Schedule</th>
              <th style={{ padding: '1rem', color: '#6b7280', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '1rem', color: '#6b7280', fontWeight: 600 }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center' }}>
                  <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto', color: 'var(--warm-taupe)' }} />
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
                  No bookings found for this stage.
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 600 }}>{booking.customer?.fullName || booking.fullName}</div>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{booking.customer?.phoneNumber || booking.contactNumber}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: 500 }}>{booking.vehicle.brand} {booking.vehicle.model}</div>
                    <div style={{ fontSize: '0.85rem', color: '#9ca3af' }}>{booking.vehicle.licensePlate}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontSize: '0.875rem' }}>{new Date(booking.startDate).toLocaleDateString()}</div>
                    <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>{new Date(booking.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <StatusBadge status={booking.status} />
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {activeTab === 'PICKUP' && (
                      <button 
                        onClick={() => {
                          setSelectedBooking(booking);
                          setOdometer(booking.vehicle.currentOdometerKm.toString());
                          setAgreementSigned(!!booking.agreementSignedAt);
                          setSignerName(booking.fullName || '');
                        }}
                        className="btn-primary"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Key size={16} /> Process Pickup
                      </button>
                    )}
                    {activeTab === 'ACTIVE' && (
                      <button 
                        onClick={() => setSelectedBooking(booking)}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        <RotateCcw size={16} /> Mark Returned
                      </button>
                    )}
                    {activeTab === 'RETURNED' && (
                      <button 
                        onClick={() => setSelectedBooking(booking)}
                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#2E7D32', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                      >
                        <CheckCircle2 size={16} /> Inspect & Complete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Action Modals */}
      {selectedBooking && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', width: '100%', maxWidth: '600px', padding: '2.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                {activeTab === 'PICKUP' ? 'Release Checklist' : activeTab === 'ACTIVE' ? 'Return Checklist' : 'Final Inspection'}
              </h2>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Summary */}
              <div style={{ backgroundColor: '#F9FAFB', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--soft-beige)', borderRadius: '10px' }}>
                    <Car size={24} color="var(--warm-taupe)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{selectedBooking.vehicle.brand} {selectedBooking.vehicle.model}</div>
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Plate: {selectedBooking.vehicle.licensePlate}</div>
                  </div>
                </div>
                <div style={{ borderLeft: '1px solid #e5e7eb', paddingLeft: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isFullyPaid(selectedBooking) ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16A34A', fontWeight: 700 }}>
                      <CheckCircle2 size={20} /> Fully Paid
                    </div>
                  ) : (
                    <div style={{ color: '#D97706', fontWeight: 700 }}>
                      <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#9ca3af' }}>Balance Due</div>
                      ₱{calculateRemainingBalance(selectedBooking).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              {activeTab === 'PICKUP' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  
                  {/* Step 1: Payment */}
                  <section style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: isFullyPaid(selectedBooking) ? '#16A34A' : '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>1</span>
                      Payment Settlement
                    </h3>
                    {!isFullyPaid(selectedBooking) ? (
                      <div style={{ padding: '1rem', backgroundColor: '#FFFBEB', borderRadius: '12px', border: '1px solid #FEF3C7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#92400E' }}>Customer must pay ₱{calculateRemainingBalance(selectedBooking).toLocaleString()} in cash.</p>
                        <button 
                          onClick={handleConfirmCash}
                          disabled={actionLoading}
                          style={{ padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#D97706', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Confirm Cash
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16A34A', fontSize: '0.9rem', fontWeight: 600 }}>
                        <CheckCircle2 size={18} /> Financial clearance granted.
                      </div>
                    )}
                  </section>

                  {/* Step 2: Agreement */}
                  <section style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: agreementSigned ? '#16A34A' : '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>2</span>
                      Rental Agreement
                    </h3>
                    {!agreementSigned ? (
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <input 
                          placeholder="Signer Full Name"
                          value={signerName}
                          onChange={(e) => setSignerName(e.target.value)}
                          style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                        />
                        <button 
                          onClick={handleSignAgreement}
                          disabled={actionLoading || !signerName}
                          style={{ padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: '#000', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer' }}
                        >
                          Confirm Signing
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16A34A', fontSize: '0.9rem', fontWeight: 600 }}>
                        <CheckCircle2 size={18} /> Agreement signed by {selectedBooking.agreementSignedBy || signerName}.
                      </div>
                    )}
                  </section>

                  {/* Step 3: Vehicle Checklist */}
                  <section>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: checklistConfirmed && odometer ? '#16A34A' : '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>3</span>
                      Vehicle Inspection
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>Release Odometer (km)</label>
                          <input 
                            type="number" 
                            value={odometer}
                            onChange={(e) => setOdometer(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>Current System Km</label>
                          <div style={{ padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 600 }}>
                            {selectedBooking.vehicle.currentOdometerKm} km
                          </div>
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.25rem' }}>Pickup Notes</label>
                        <textarea 
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="e.g. Clean interior, Full tank, etc."
                          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px' }}
                        />
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '12px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={checklistConfirmed}
                          onChange={(e) => setChecklistConfirmed(e.target.checked)}
                          style={{ width: '18px', height: '18px' }}
                        />
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Vehicle inspected and ready for release.</span>
                      </label>
                    </div>
                  </section>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button 
                      onClick={resetForm} 
                      style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid #ddd', backgroundColor: 'white', fontWeight: 700 }}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleRelease} 
                      disabled={actionLoading || !isFullyPaid(selectedBooking) || !agreementSigned || !checklistConfirmed || !odometer}
                      className="btn-primary" 
                      style={{ flex: 2, padding: '1rem', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Complete Release'}
                    </button>
                  </div>
                </div>
              ) : activeTab === 'ACTIVE' ? (
                <>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Return Odometer (km)</label>
                    <input 
                      type="number" 
                      value={odometer}
                      onChange={(e) => setOdometer(e.target.value)}
                      placeholder="e.g. 12500"
                      style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #ddd', fontSize: '1.1rem' }}
                    />
                    <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.5rem', fontWeight: 500 }}>
                      Release Odometer: <span style={{ fontWeight: 700, color: 'var(--black)' }}>{selectedBooking.releaseOdometerKm || selectedBooking.vehicle.currentOdometerKm} km</span>
                    </p>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Notes / Observations</label>
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Note any issues during return"
                      style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #ddd', minHeight: '100px' }}
                    />
                  </div>

                  {activeTab === 'ACTIVE' && (
                    <div style={{ padding: '1.5rem', backgroundColor: damageFound ? '#FFF5F5' : '#F9FAFB', borderRadius: '12px', border: `1px solid ${damageFound ? '#FEB2B2' : '#e5e7eb'}` }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 700 }}>
                        <input 
                          type="checkbox" 
                          checked={damageFound} 
                          onChange={(e) => setDamageFound(e.target.checked)} 
                          style={{ width: '20px', height: '20px' }}
                        />
                        <ShieldAlert size={20} color={damageFound ? '#C53030' : '#6b7280'} />
                        Damage Found?
                      </label>

                      {damageFound && (
                        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                              <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Type</label>
                              <select 
                                value={damageDetails.type}
                                onChange={(e) => setDamageDetails({...damageDetails, type: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                              >
                                <option>Scratch</option>
                                <option>Dent</option>
                                <option>Mechanical</option>
                                <option>Glass</option>
                                <option>Tire</option>
                                <option>Interior</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Severity</label>
                              <select 
                                value={damageDetails.severity}
                                onChange={(e) => setDamageDetails({...damageDetails, severity: e.target.value})}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                              >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                                <option value="CRITICAL">Critical</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Description</label>
                            <textarea 
                              value={damageDetails.desc}
                              onChange={(e) => setDamageDetails({...damageDetails, desc: e.target.value})}
                              placeholder="Describe the damage..."
                              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>Estimated Cost (₱)</label>
                            <input 
                              type="number" 
                              value={damageDetails.cost}
                              onChange={(e) => setDamageDetails({...damageDetails, cost: e.target.value})}
                              placeholder="0.00"
                              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ddd' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button 
                      onClick={resetForm} 
                      style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid #ddd', backgroundColor: 'white', fontWeight: 700 }}
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleReturn} 
                      disabled={actionLoading}
                      className="btn-primary" 
                      style={{ flex: 2, padding: '1rem', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      {actionLoading ? <Loader2 className="animate-spin" size={20} /> : 'Confirm Return'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ backgroundColor: '#F0F9FF', padding: '1.25rem', borderRadius: '12px', color: '#0369A1' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <ClipboardCheck size={20} />
                      <div>
                        <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Inspection Required</p>
                        <p style={{ fontSize: '0.85rem' }}>Review the returned vehicle condition and odometer before completing the rental.</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <button 
                      onClick={() => handleComplete()}
                      disabled={actionLoading}
                      style={{ width: '100%', padding: '1.25rem', borderRadius: '12px', backgroundColor: '#2E7D32', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={20} /> Mark as Completed & Available</>}
                    </button>
                    <button 
                      onClick={() => handleComplete()}
                      disabled={actionLoading}
                      style={{ width: '100%', padding: '1.25rem', borderRadius: '12px', backgroundColor: '#D97706', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      {actionLoading ? <Loader2 className="animate-spin" size={20} /> : <><AlertTriangle size={20} /> Complete & Send to Maintenance</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {(() => {
        if (!modalConfig.isOpen || !selectedBooking) return null;

        let title = '';
        let message = '';
        let variant: 'default' | 'danger' | 'warning' | 'success' = 'default';
        let confirmLabel = 'Confirm';
        let details: React.ReactNode = null;

        if (modalConfig.type === 'CONFIRM_CASH') {
          const amount = calculateRemainingBalance(selectedBooking);
          title = 'Confirm Cash Payment?';
          message = 'Please confirm that the customer has paid the remaining balance in person.';
          confirmLabel = 'Confirm Cash Received';
          variant = 'success';
          details = (
            <ul>
              <li><strong>Customer:</strong> <span>{selectedBooking.customer?.fullName}</span></li>
              <li><strong>Booking ID:</strong> <span style={{ fontFamily: 'monospace' }}>#{selectedBooking.id.slice(0, 8).toUpperCase()}</span></li>
              <li><strong>Amount Due:</strong> <span>₱{amount.toLocaleString()}</span></li>
            </ul>
          );
        } else if (modalConfig.type === 'RELEASE') {
          title = 'Release Vehicle?';
          message = 'You are about to release the vehicle. GPS tracking will begin immediately.';
          confirmLabel = 'Release Vehicle';
          variant = 'success';
          details = (
            <ul>
              <li><strong>Vehicle:</strong> <span>{selectedBooking.vehicle.brand} {selectedBooking.vehicle.model}</span></li>
              <li><strong>Release Odometer:</strong> <span>{odometer} km</span></li>
            </ul>
          );
        } else if (modalConfig.type === 'RETURN') {
          title = 'Return Vehicle?';
          message = 'You are processing the return of this vehicle. GPS tracking will stop.';
          confirmLabel = 'Return Vehicle';
          variant = 'warning';
          details = (
            <ul>
              <li><strong>Vehicle:</strong> <span>{selectedBooking.vehicle.brand} {selectedBooking.vehicle.model}</span></li>
              <li><strong>Return Odometer:</strong> <span>{odometer} km</span></li>
              <li><strong>Damage Found:</strong> <span style={{ color: damageFound ? '#DC2626' : '#16A34A' }}>{damageFound ? 'Yes' : 'No'}</span></li>
            </ul>
          );
        } else if (modalConfig.type === 'COMPLETE') {
          title = 'Complete Rental?';
          message = 'Are you sure you want to finalize this rental? The vehicle will become available for new bookings.';
          confirmLabel = 'Complete Rental';
          variant = 'success';
        }

        return (
          <ConfirmActionModal
            isOpen={modalConfig.isOpen}
            title={title}
            message={message}
            details={details}
            variant={variant}
            confirmLabel={confirmLabel}
            loading={actionLoading}
            error={modalError}
            onConfirm={executeModalAction}
            onCancel={closeModal}
          />
        );
      })()}
    </div>
  );
};

export default AdminActiveRentalsPage;
