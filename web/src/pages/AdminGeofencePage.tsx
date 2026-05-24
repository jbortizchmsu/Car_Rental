import React, { useEffect, useState } from 'react';
import { adminApi, vehiclesApi } from '../services/api';
import { 
  Shield, Plus, Trash2, 
  Car, Info, Loader2,
  X
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { getApiErrorMessage } from '../services/api';

interface Geofence {
  id: string;
  name: string;
  isActive: boolean;
  polygonCoordinates: any[];
  vehicleId: string | null;
  bookingId: string | null;
}

const AdminGeofencePage: React.FC = () => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [coordsJson, setCoordsJson] = useState('[\n  {"lat": 14.5995, "lng": 120.9842},\n  {"lat": 14.6760, "lng": 121.0437},\n  {"lat": 14.5547, "lng": 121.0244}\n]');
  const [saving, setSaving] = useState(false);

  const toast = useToast();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [gfRes, vRes] = await Promise.all([
        adminApi.getGeofences(),
        vehiclesApi.getAvailable()
      ]);

      setGeofences(gfRes.data || []);
      setVehicles(vRes.data || []);
    } catch (error) {
      console.error('Error fetching geofences:', error);
      toast.error('Failed to load data', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const coords = JSON.parse(coordsJson);
      
      if (!Array.isArray(coords) || coords.length < 3) {
        toast.warning('Invalid Zone', 'Polygon must have at least 3 coordinates.');
        return;
      }

      await adminApi.saveGeofence({
        name,
        vehicleId: selectedVehicle || null,
        polygonCoordinates: coords,
        isActive: true
      });

      toast.success('Geofence Created', `Zone "${name}" has been saved.`);
      setIsModalOpen(false);
      setName('');
      setSelectedVehicle('');
      fetchData();
    } catch (error: any) {
      toast.error('Error Saving Geofence', 'Invalid JSON or ' + getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    try {
      await adminApi.toggleGeofence(id, !current);
      toast.success('Geofence Updated', `Zone is now ${!current ? 'active' : 'inactive'}.`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status', getApiErrorMessage(error));
    }
  };

  const openDeleteModal = (id: string) => {
    setDeleteId(id);
    setDeleteError(null);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setDeleteId(null);
    setDeleteError(null);
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    setDeleteError(null);

    try {
      await adminApi.deleteGeofence(deleteId);
      toast.success('Geofence Deleted', 'The operational zone has been removed.');
      fetchData();
      closeDeleteModal();
    } catch (error: any) {
      setDeleteError(getApiErrorMessage(error));
      toast.error('Deletion failed', getApiErrorMessage(error));
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>Geofence Management</h1>
          <p style={{ color: '#6B7280' }}>Define allowed operational zones for your fleet.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={20} /> Create New Zone
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
          <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" />
        </div>
      ) : geofences.length === 0 ? (
        <div style={{ backgroundColor: 'white', padding: '5rem', borderRadius: '24px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
          <Shield size={64} color="#E5E7EB" style={{ margin: '0 auto 1.5rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No geofences defined</h3>
          <p style={{ color: '#6B7280', marginBottom: '2rem' }}>Protect your fleet by defining allowed boundaries.</p>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">Set Up First Zone</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {geofences.map(gf => (
            <div key={gf.id} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '20px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ padding: '0.5rem', backgroundColor: gf.isActive ? '#DCFCE7' : '#F3F4F6', borderRadius: '10px' }}>
                    <Shield size={20} color={gf.isActive ? '#16A34A' : '#6B7280'} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 700 }}>{gf.name}</h4>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{gf.polygonCoordinates.length} coordinates</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => openDeleteModal(gf.id)} style={{ padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#4B5563' }}>
                   <Car size={16} />
                  <span>Assigned to: {gf.vehicleId ? 'Specific Vehicle' : 'Global (All Vehicles)'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  onClick={() => toggleStatus(gf.id, gf.isActive)}
                  style={{ 
                    padding: '0.4rem 0.8rem', 
                    borderRadius: '8px', 
                    border: 'none', 
                    backgroundColor: gf.isActive ? '#DCFCE7' : '#F3F4F6',
                    color: gf.isActive ? '#16A34A' : '#6B7280',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {gf.isActive ? 'ACTIVE' : 'INACTIVE'}
                </button>
                <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>ID: {gf.id.split('-')[0].toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '600px', padding: '2.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Define Geofence Zone</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Zone Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Metro Manila Bounds"
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #DDD' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Assign to Vehicle (Optional)</label>
                <select 
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #DDD' }}
                >
                  <option value="">Global (All Vehicles)</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.licensePlate})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 700 }}>Polygon Coordinates (JSON)</label>
                <div style={{ backgroundColor: '#F8F9FA', padding: '1rem', borderRadius: '10px', marginBottom: '0.5rem', border: '1px solid #E5E7EB' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: '#6B7280' }}>
                    <Info size={14} />
                    <span>Enter an array of latitude/longitude objects.</span>
                  </div>
                </div>
                <textarea 
                  value={coordsJson}
                  onChange={(e) => setCoordsJson(e.target.value)}
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid #DDD', minHeight: '150px', fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid #DDD', backgroundColor: 'white', fontWeight: 700 }}>Cancel</button>
                <button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="btn-primary" 
                  style={{ flex: 2, padding: '1rem', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : 'Save Geofence'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={deleteModalOpen}
        title="Delete Geofence Zone?"
        message="Are you sure you want to delete this operational boundary? Vehicles currently assigned to this zone will lose tracking restrictions."
        variant="danger"
        confirmLabel="Delete Zone"
        loading={deleteLoading}
        error={deleteError}
        onConfirm={executeDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
};

export default AdminGeofencePage;
