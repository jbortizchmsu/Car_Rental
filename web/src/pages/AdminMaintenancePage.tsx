import React, { useEffect, useState } from 'react';
import { Wrench, AlertTriangle, CheckCircle2, ClipboardList, Plus, Check, Search, Filter, DollarSign } from 'lucide-react';
import { maintenanceApi } from '../services/api';

const AdminMaintenancePage: React.FC = () => {
  const [summary, setSummary] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [damageReports, setDamageReports] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    action: 'SHOP' | 'AVAILABLE';
    vehicleId: string;
    vehicleName: string;
    vehiclePlate: string;
    vehicleStatus: string;
  }>({ isOpen: false, action: 'SHOP', vehicleId: '', vehicleName: '', vehiclePlate: '', vehicleStatus: '' });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [newLog, setNewLog] = useState({
    serviceType: 'ROUTINE',
    description: '',
    cost: '',
    serviceDate: new Date().toISOString().split('T')[0],
    nextServiceDate: '',
    status: 'COMPLETED',
    odometerKm: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, vehiclesRes, damageRes, logsRes] = await Promise.all([
        maintenanceApi.getSummary(),
        maintenanceApi.getVehicles(),
        maintenanceApi.getDamageReports(),
        maintenanceApi.getLogs()
      ]);
      setSummary(summaryRes.data);
      setVehicles(vehiclesRes.data);
      setDamageReports(damageRes.data);
      setLogs(logsRes.data);
    } catch (error) {
      console.error('Error fetching maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await maintenanceApi.createLog({
        ...newLog,
        vehicleId: selectedVehicleId
      });
      setShowLogModal(false);
      fetchData();
    } catch (error) {
      alert('Failed to create maintenance log');
    }
  };

  const openConfirmModal = (vehicle: any, action: 'SHOP' | 'AVAILABLE') => {
    setConfirmModal({
      isOpen: true,
      action,
      vehicleId: vehicle.id,
      vehicleName: `${vehicle.brand} ${vehicle.model}`,
      vehiclePlate: vehicle.plateNumber,
      vehicleStatus: vehicle.status === 'UNDER_MAINTENANCE' ? 'In Shop' : 'Available',
    });
    setConfirmError('');
  };

  const executeConfirmAction = async () => {
    setConfirmLoading(true);
    setConfirmError('');
    try {
      if (confirmModal.action === 'SHOP') {
        await maintenanceApi.markUnderMaintenance(confirmModal.vehicleId);
      } else {
        await maintenanceApi.markAvailable(confirmModal.vehicleId);
      }
      setConfirmModal({ ...confirmModal, isOpen: false });
      fetchData();
    } catch (error: any) {
      setConfirmError(error.response?.data?.error || 'Failed to update vehicle status. Please try again.');
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading maintenance data...</div>;
  }

  const underMaintenanceCount = vehicles.filter(v => v.status === 'UNDER_MAINTENANCE').length;

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          v.brand.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          v.model.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'UNDER_MAINTENANCE') return matchesSearch && v.status === 'UNDER_MAINTENANCE';
    if (statusFilter === 'OIL_CHANGE_DUE') return matchesSearch && v.oilChangeStatus === 'DUE_NOW';
    if (statusFilter === 'DUE_SOON') return matchesSearch && v.oilChangeStatus === 'DUE_SOON';
    if (statusFilter === 'HEALTHY') return matchesSearch && v.oilChangeStatus === 'HEALTHY' && v.status !== 'UNDER_MAINTENANCE';
    
    return matchesSearch;
  });

  return (
    <div className="maintenance-page" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <header className="maintenance-header">
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--black)', marginBottom: '0.5rem' }}>Maintenance & Fleet Health</h1>
          <p style={{ color: 'var(--gray-600)', fontWeight: 600 }}>Monitor vehicle condition, service schedules, repair costs, and maintenance readiness.</p>
        </div>
      </header>

      {/* Grouped Summary KPI Section */}
      <div className="bookings-summary-group">
        <div className="bookings-summary-compact" style={{ flex: 2 }}>
          <h3><Wrench size={20} color="var(--warm-taupe)" /> Service Status Summary</h3>
          <div className="booking-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Oil Change Due</span>
              <span className="booking-stat-value" style={{ color: '#DC2626' }}>{summary?.oilChangeDueCount || 0}</span>
            </div>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Due Soon</span>
              <span className="booking-stat-value" style={{ color: '#D97706' }}>{summary?.oilChangeSoonCount || 0}</span>
            </div>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Fleet Healthy</span>
              <span className="booking-stat-value" style={{ color: '#16A34A' }}>{summary?.healthyFleetCount || 0}</span>
            </div>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Under Maint.</span>
              <span className="booking-stat-value" style={{ color: '#2563EB' }}>{underMaintenanceCount}</span>
            </div>
          </div>
        </div>
        
        <div className="bookings-summary-compact" style={{ flex: 1, minWidth: '350px' }}>
          <h3><DollarSign size={20} color="var(--warm-taupe)" /> Cost Summary</h3>
          <div className="booking-stat-grid">
            <div className="booking-stat-item">
              <span className="booking-stat-label">Pending Repairs</span>
              <span className="booking-stat-value" style={{ color: '#DC2626' }}>{damageReports.length}</span>
            </div>
            <div className="booking-stat-item">
              <span className="booking-stat-label">Total Estimate</span>
              <span className="booking-stat-value" style={{ color: 'var(--black)' }}>₱{summary?.totalEstimatedRepairCost?.toLocaleString() || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        {/* Recent Damage Reports */}
        <div className="maintenance-table-card">
          <div className="table-header">
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--black)' }}>
              <AlertTriangle size={22} color="#EF4444" /> Recent Damage Reports
            </h3>
          </div>
          <div className="table-container" style={{ flex: 1, maxHeight: '400px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Damage Info</th>
                  <th>Severity</th>
                  <th>Estimate</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {damageReports.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="maintenance-empty-state">
                        <AlertTriangle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <h4>No damage reports found</h4>
                        <p>Returned vehicle damage reports will appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  damageReports.map(report => (
                    <tr key={report.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--black)' }}>{report.booking.vehicle.brand} {report.booking.vehicle.model}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontFamily: 'monospace' }}>{report.booking.vehicle.licensePlate}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{report.damageType || 'General'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{report.description}</div>
                      </td>
                      <td>
                        <span className="maintenance-status-badge" style={{ 
                          backgroundColor: report.severity === 'CRITICAL' ? '#FEF2F2' : report.severity === 'HIGH' ? '#FFFBEB' : '#F3F4F6',
                          color: report.severity === 'CRITICAL' ? '#DC2626' : report.severity === 'HIGH' ? '#D97706' : '#374151'
                        }}>
                          {report.severity || 'LOW'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 800, color: 'var(--black)' }}>{report.estimatedCost ? `₱${report.estimatedCost.toLocaleString()}` : <span style={{ color: 'var(--gray-400)' }}>No estimate</span>}</td>
                      <td>
                        <button 
                          className="btn-outline" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px' }}
                          onClick={() => {
                            setSelectedVehicleId(report.booking.vehicleId);
                            setNewLog({ ...newLog, serviceType: 'REPAIR', description: `Repair for: ${report.description}`, cost: report.estimatedCost || '' });
                            setShowLogModal(true);
                          }}
                        >
                          Create Log
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Service Logs Summary */}
        <div className="maintenance-table-card">
          <div className="table-header">
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--black)' }}>
              <ClipboardList size={22} color="var(--warm-taupe)" /> Service History
            </h3>
          </div>
          <div className="table-container" style={{ flex: 1, maxHeight: '400px', overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Service Type</th>
                  <th>Cost</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="maintenance-empty-state">
                        <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <h4>No service logs yet</h4>
                        <p>Maintenance records will appear after you add a service log.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.slice(0, 10).map(log => (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--black)' }}>{log.vehicle.brand}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontFamily: 'monospace' }}>{log.vehicle.plateNumber}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--gray-600)' }}>{log.serviceType.replace('_', ' ')}</div>
                      </td>
                      <td style={{ fontWeight: 800, color: 'var(--black)' }}>
                        ₱{log.cost?.toLocaleString() || 0}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                        {new Date(log.serviceDate).toLocaleDateString()}
                      </td>
                      <td>
                        <span className="maintenance-status-badge" style={{ 
                          backgroundColor: log.status === 'COMPLETED' ? '#F0FDF4' : '#FEF3C7',
                          color: log.status === 'COMPLETED' ? '#16A34A' : '#D97706'
                        }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="maintenance-toolbar">
        <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
          <div style={{ position: 'relative', maxWidth: '300px', width: '100%' }}>
            <Search size={18} color="var(--gray-400)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              className="input" 
              placeholder="Search vehicle or plate..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: '100%', paddingLeft: '2.5rem', borderRadius: '12px', border: '1px solid var(--gray-200)' }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <Filter size={18} color="var(--gray-400)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <select 
              className="input" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ paddingLeft: '2.5rem', borderRadius: '12px', border: '1px solid var(--gray-200)', appearance: 'none', paddingRight: '2.5rem', fontWeight: 600, color: 'var(--gray-600)' }}
            >
              <option value="ALL">All Statuses</option>
              <option value="OIL_CHANGE_DUE">Oil Change Due</option>
              <option value="DUE_SOON">Due Soon</option>
              <option value="HEALTHY">Healthy</option>
              <option value="UNDER_MAINTENANCE">Under Maintenance</option>
            </select>
          </div>
        </div>
        <button 
          className="btn-brand" 
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', borderRadius: '12px' }} 
          onClick={() => { setSelectedVehicleId(''); setShowLogModal(true); }}
        >
          <Plus size={18} /> Add Maintenance Log
        </button>
      </div>

      {/* Vehicle Maintenance Management */}
      <div className="maintenance-table-card">
        <div className="table-header">
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--black)' }}>Vehicle Maintenance Status</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Vehicle</th>
                <th>Current Odometer</th>
                <th>Last Oil Change</th>
                <th>Status</th>
                <th>Next Service</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="maintenance-empty-state">
                      <Wrench size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <h4>No vehicles match your search</h4>
                      <p>Try adjusting your search filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredVehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--black)' }}>{vehicle.brand} {vehicle.model}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', fontFamily: 'monospace' }}>{vehicle.plateNumber}</div>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--gray-600)' }}>{vehicle.currentOdometerKm?.toLocaleString()} km</td>
                    <td style={{ fontWeight: 600, color: 'var(--gray-500)' }}>{vehicle.lastOilChangeOdometerKm?.toLocaleString() || '--'} km</td>
                    <td>
                      <span className="maintenance-status-badge" style={{ 
                        backgroundColor: vehicle.status === 'UNDER_MAINTENANCE' ? '#EFF6FF' : vehicle.oilChangeStatus === 'DUE_NOW' ? '#FEF2F2' : vehicle.oilChangeStatus === 'DUE_SOON' ? '#FFFBEB' : '#ECFDF5',
                        color: vehicle.status === 'UNDER_MAINTENANCE' ? '#1D4ED8' : vehicle.oilChangeStatus === 'DUE_NOW' ? '#DC2626' : vehicle.oilChangeStatus === 'DUE_SOON' ? '#D97706' : '#16A34A'
                      }}>
                        {vehicle.status === 'UNDER_MAINTENANCE' ? 'IN SHOP' : vehicle.oilChangeStatus === 'DUE_NOW' ? 'OIL DUE' : vehicle.oilChangeStatus === 'DUE_SOON' ? 'DUE SOON' : 'HEALTHY'}
                      </span>
                    </td>
                    <td style={{ color: vehicle.oilChangeStatus === 'DUE_NOW' ? '#DC2626' : 'var(--gray-500)', fontWeight: 600, fontSize: '0.85rem' }}>
                      {vehicle.nextOilChangeDueKm ? `at ${vehicle.nextOilChangeDueKm.toLocaleString()} km` : '--'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {vehicle.status !== 'UNDER_MAINTENANCE' ? (
                          <button 
                            className="maintenance-action-button" 
                            style={{ color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
                            onClick={() => openConfirmModal(vehicle, 'SHOP')}
                          >
                            Send to Shop
                          </button>
                        ) : (
                          <button 
                            className="maintenance-action-button" 
                            style={{ color: '#16A34A', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
                            onClick={() => openConfirmModal(vehicle, 'AVAILABLE')}
                          >
                            Mark Ready
                          </button>
                        )}
                          <button 
                          className="btn-outline" 
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '8px' }}
                          onClick={() => {
                            setSelectedVehicleId(vehicle.id);
                            setNewLog({
                              ...newLog,
                              serviceType: 'OIL_CHANGE',
                              description: `Routine oil change at ${vehicle.currentOdometerKm} km`,
                              odometerKm: vehicle.currentOdometerKm.toString()
                            });
                            setShowLogModal(true);
                          }}
                        >
                          <Plus size={14} /> Log
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Maintenance Log Modal */}
      {showLogModal && (
        <div 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            backgroundColor: 'rgba(15, 23, 42, 0.6)', 
            backdropFilter: 'blur(4px)',
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 1100,
            padding: '1.5rem'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLogModal(false);
          }}
        >
          <div 
            className="card" 
            style={{ 
              width: '100%', 
              maxWidth: '720px', 
              padding: 0, 
              border: 'none', 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              animation: 'modalSlideUp 0.3s ease-out'
            }}
          >
            {/* Modal Header */}
            <div style={{ 
              padding: '1.5rem 2rem', 
              borderBottom: '1px solid var(--gray-100)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-start',
              backgroundColor: '#fff'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--black)' }}>
                  {selectedVehicleId ? 'Log Vehicle Maintenance' : 'General Maintenance Entry'}
                </h3>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
                  Record service activity, repair details, and associated costs for the fleet.
                </p>
              </div>
              <button 
                onClick={() => setShowLogModal(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  cursor: 'pointer', 
                  color: 'var(--gray-400)',
                  padding: '0.5rem',
                  display: 'flex',
                  borderRadius: '8px',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--gray-100)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>

            <form onSubmit={handleCreateLog}>
              <div style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {/* Left Column Group: Vehicle & Service */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <section>
                      <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-mauve)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                        Service Details
                      </h5>
                      <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--black)' }}>Target Vehicle</label>
                        <select 
                          className="input" 
                          required 
                          value={selectedVehicleId} 
                          onChange={(e) => setSelectedVehicleId(e.target.value)}
                          disabled={!!selectedVehicleId && selectedVehicleId !== ''}
                          style={{ width: '100%', height: '48px', borderRadius: '10px', backgroundColor: selectedVehicleId ? '#f8fafc' : '#fff' }}
                        >
                          <option value="">Select a vehicle from fleet...</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.brand} {v.model} — {v.plateNumber}
                            </option>
                          ))}
                        </select>
                        {selectedVehicleId && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <Check size={14} color="#10B981" /> Selected: {vehicles.find(v => v.id === selectedVehicleId)?.brand} {vehicles.find(v => v.id === selectedVehicleId)?.model}
                          </div>
                        )}
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--black)' }}>Type of Service</label>
                        <select 
                          className="input" 
                          value={newLog.serviceType} 
                          onChange={e => setNewLog({...newLog, serviceType: e.target.value})}
                          style={{ width: '100%', height: '48px', borderRadius: '10px' }}
                        >
                          <option value="ROUTINE">Routine Maintenance</option>
                          <option value="REPAIR">Repair / Part Replacement</option>
                          <option value="OIL_CHANGE">Oil & Filter Change</option>
                          <option value="TIRES">Tire Rotation / Replacement</option>
                          <option value="BRAKES">Brake System Service</option>
                          <option value="CLEANING">Professional Deep Cleaning</option>
                        </select>
                      </div>
                    </section>
                  </div>

                  {/* Right Column Group: Schedule & Cost */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <section>
                      <h5 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted-mauve)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                        Financial & Schedule
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--black)' }}>Service Cost (₱)</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)', fontWeight: 600 }}>₱</span>
                            <input 
                              type="number" 
                              className="input" 
                              value={newLog.cost} 
                              onChange={e => setNewLog({...newLog, cost: e.target.value})} 
                              placeholder="0.00" 
                              style={{ width: '100%', height: '48px', borderRadius: '10px', paddingLeft: '2.25rem' }} 
                            />
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--black)' }}>Service Odometer (km)</label>
                          <input 
                            type="number" 
                            className="input" 
                            value={newLog.odometerKm} 
                            onChange={e => setNewLog({...newLog, odometerKm: e.target.value})} 
                            placeholder="Current mileage" 
                            style={{ width: '100%', height: '48px', borderRadius: '10px' }} 
                          />
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--black)' }}>Service Status</label>
                          <select 
                            className="input" 
                            value={newLog.status} 
                            onChange={e => setNewLog({...newLog, status: e.target.value})}
                            style={{ width: '100%', height: '48px', borderRadius: '10px' }}
                          >
                            <option value="COMPLETED">Completed</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="SCHEDULED">Scheduled</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--black)' }}>Date Performed</label>
                          <input 
                            type="date" 
                            className="input" 
                            value={newLog.serviceDate} 
                            onChange={e => setNewLog({...newLog, serviceDate: e.target.value})} 
                            style={{ width: '100%', height: '48px', borderRadius: '10px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--black)' }}>Next Due Date</label>
                          <input 
                            type="date" 
                            className="input" 
                            value={newLog.nextServiceDate} 
                            onChange={e => setNewLog({...newLog, nextServiceDate: e.target.value})} 
                            style={{ width: '100%', height: '48px', borderRadius: '10px' }}
                          />
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                {/* Full Width Section: Description */}
                <div style={{ marginTop: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--black)' }}>
                    Detailed Description / Work Performed
                  </label>
                  <textarea 
                    className="input" 
                    required 
                    style={{ minHeight: '120px', borderRadius: '12px', padding: '1rem', lineHeight: 1.6, resize: 'vertical' }} 
                    value={newLog.description} 
                    onChange={e => setNewLog({...newLog, description: e.target.value})} 
                    placeholder="Describe the maintenance activity, parts used, or issues found during inspection..." 
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ 
                padding: '1.5rem 2rem', 
                backgroundColor: '#f8fafc', 
                borderTop: '1px solid var(--gray-100)', 
                display: 'flex', 
                justifyContent: 'flex-end', 
                gap: '1rem' 
              }}>
                <button 
                  type="button" 
                  className="btn-outline" 
                  style={{ 
                    padding: '0.75rem 1.5rem', 
                    borderRadius: '10px', 
                    fontWeight: 700,
                    backgroundColor: '#fff'
                  }} 
                  onClick={() => setShowLogModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-brand" 
                  style={{ 
                    padding: '0.75rem 2rem', 
                    borderRadius: '10px', 
                    fontWeight: 700,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                  }}
                >
                  Save Maintenance Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div 
          className="confirm-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !confirmLoading) setConfirmModal({ ...confirmModal, isOpen: false });
          }}
        >
          <div className="confirm-modal">
            <div className="confirm-modal-header">
              <div style={{ flex: 1 }}>
                <div className="confirm-modal-icon" style={{ backgroundColor: confirmModal.action === 'SHOP' ? '#FEF2F2' : '#F0FDF4' }}>
                  {confirmModal.action === 'SHOP' ? <AlertTriangle color="#EF4444" size={24} /> : <CheckCircle2 color="#10B981" size={24} />}
                </div>
                <h3 className="confirm-modal-title">
                  {confirmModal.action === 'SHOP' ? 'Send Vehicle to Maintenance?' : 'Mark Vehicle Available?'}
                </h3>
                <p className="confirm-modal-message">
                  {confirmModal.action === 'SHOP' 
                    ? 'This will mark the selected vehicle as Under Maintenance and remove it from available rentals until it is marked available again.'
                    : 'This will mark the selected vehicle as Available and allow it to be booked by customers again. Please ensure all repairs are completed.'}
                </p>
                {confirmModal.action === 'SHOP' && (
                  <p style={{ fontSize: '0.8rem', color: '#DC2626', fontWeight: 600, marginTop: '0.5rem', marginBottom: '1rem' }}>
                    Vehicles under maintenance cannot be booked by customers.
                  </p>
                )}
                
                <div className="confirm-modal-vehicle-box">
                  <div style={{ fontWeight: 800, color: 'var(--black)', fontSize: '1.1rem' }}>{confirmModal.vehicleName}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gray-500)', fontFamily: 'monospace', marginTop: '0.2rem' }}>Plate: {confirmModal.vehiclePlate}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)', marginTop: '0.5rem', textTransform: 'uppercase' }}>Current Status: {confirmModal.vehicleStatus}</div>
                </div>

                {confirmError && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', color: '#DC2626', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
                    {confirmError}
                  </div>
                )}
              </div>
            </div>
            <div className="confirm-modal-footer">
              <button 
                type="button" 
                className="confirm-modal-cancel" 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                disabled={confirmLoading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="confirm-modal-confirm" 
                style={{ 
                  backgroundColor: confirmModal.action === 'SHOP' ? '#DC2626' : '#16A34A',
                  color: 'white'
                }}
                onClick={executeConfirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? 'Processing...' : (confirmModal.action === 'SHOP' ? 'Confirm Send to Shop' : 'Confirm Mark Available')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMaintenancePage;
