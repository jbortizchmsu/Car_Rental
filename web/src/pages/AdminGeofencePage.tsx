import React, { useEffect, useState } from 'react';
import { adminApi, vehiclesApi } from '../services/api';
import {
  Shield, Trash2, Pencil, Plus,
  Car, Info, Loader2, MapPin,
  X
} from 'lucide-react';
import { useToast } from '../components/ToastProvider';
import { usePageHeader } from '../contexts/PageHeaderContext';
import ConfirmActionModal from '../components/ConfirmActionModal';
import { getApiErrorMessage } from '../services/api';

interface Geofence {
  id: string;
  name: string;
  isActive: boolean;
  // Raw from the API — a JSON-stringified array (see server/prisma/schema.prisma:
  // GeofenceZone.polygonCoordinates), never a parsed array. Parse defensively with
  // parsePolygonPoints() wherever the actual point list/count is needed.
  polygonCoordinates: string;
  vehicleId: string | null;
  bookingId: string | null;
  // Set only on the 56 destination-template zones imported via
  // scripts/import-destination-geofences.ts — never set on a manually-created zone.
  destinationName: string | null;
}

/** Safely parses a zone's polygonCoordinates JSON string. Never throws — returns null
 * for anything malformed, so a bad existing row can't crash the card or the edit modal. */
function parsePolygonPoints(raw: string): Array<{ lat: number; lng: number }> | null {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

interface AdminGeofencePageProps {
  /** When true (e.g. rendered inline inside AdminSettingsPage), skips setting the
   * top-level admin page header — otherwise this component's own "Geofence
   * Management" title would overwrite whichever page it's embedded in (both read/write
   * the same shared PageHeaderContext). The component is otherwise fully self-contained
   * (no route params, no router dependency) and safe to render as a plain child. */
  embedded?: boolean;
}

const AdminGeofencePage: React.FC<AdminGeofencePageProps> = ({ embedded = false }) => {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state — shared by create and edit. `editingId` is null for create.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [coordsJson, setCoordsJson] = useState('[\n  {"lat": 14.5995, "lng": 120.9842},\n  {"lat": 14.6760, "lng": 121.0437},\n  {"lat": 14.5547, "lng": 121.0244}\n]');
  const [saving, setSaving] = useState(false);

  const toast = useToast();
  const { setPageHeader } = usePageHeader();

  // Delete/deactivate confirmation — shared for both ordinary zones (unchanged
  // behavior) and destination-template zones (extra warning text appended).
  const [actionModal, setActionModal] = useState<{
    isOpen: boolean;
    type: 'DELETE' | 'DEACTIVATE' | null;
    zone: Geofence | null;
  }>({ isOpen: false, type: null, zone: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (embedded) return;
    setPageHeader({
      title: 'Geofence Management',
      subtitle: 'Define operational zones and location boundaries'
    });
    return () => setPageHeader({});
  }, [setPageHeader, embedded]);

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

  const openCreateModal = () => {
    setEditingId(null);
    setName('');
    setSelectedVehicle('');
    setCoordsJson('[\n  {"lat": 14.5995, "lng": 120.9842},\n  {"lat": 14.6760, "lng": 121.0437},\n  {"lat": 14.5547, "lng": 121.0244}\n]');
    setIsModalOpen(true);
  };

  const openEditModal = (zone: Geofence) => {
    const points = parsePolygonPoints(zone.polygonCoordinates);
    setEditingId(zone.id);
    setName(zone.name);
    setSelectedVehicle(zone.vehicleId || '');
    setCoordsJson(
      points
        ? JSON.stringify(points, null, 2)
        : ''
    );
    if (!points) {
      toast.warning('Could not read existing shape', 'This zone\'s saved coordinates are malformed — the field has been left empty. Enter a new polygon before saving.');
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let coords;
      try {
        coords = JSON.parse(coordsJson);
      } catch {
        toast.warning('Invalid Zone', 'Polygon Coordinates must be valid JSON.');
        return;
      }

      if (!Array.isArray(coords) || coords.length < 3) {
        toast.warning('Invalid Zone', 'Polygon must have at least 3 coordinates.');
        return;
      }

      if (editingId) {
        await adminApi.updateGeofence(editingId, {
          name,
          vehicleId: selectedVehicle || null,
          polygonCoordinates: coords,
        });
        toast.success('Geofence Updated', `Zone "${name}" has been saved.`);
      } else {
        await adminApi.saveGeofence({
          name,
          vehicleId: selectedVehicle || null,
          polygonCoordinates: coords,
          isActive: true
        });
        toast.success('Geofence Created', `Zone "${name}" has been saved.`);
      }

      setIsModalOpen(false);
      setEditingId(null);
      setName('');
      setSelectedVehicle('');
      fetchData();
    } catch (error: any) {
      toast.error(editingId ? 'Error Saving Changes' : 'Error Saving Geofence', getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  // Ordinary zones: deactivate/reactivate instantly, exactly as before. Destination
  // templates: reactivating is always instant (safe); DEactivating goes through the
  // warning-confirmation modal instead, since it silently drops that destination back
  // to the generic circle for future bookings.
  const requestToggle = (zone: Geofence) => {
    if (zone.destinationName && zone.isActive) {
      setActionError(null);
      setActionModal({ isOpen: true, type: 'DEACTIVATE', zone });
      return;
    }
    executeToggle(zone);
  };

  const executeToggle = async (zone: Geofence) => {
    try {
      await adminApi.toggleGeofence(zone.id, !zone.isActive);
      toast.success('Geofence Updated', `Zone is now ${!zone.isActive ? 'active' : 'inactive'}.`);
      fetchData();
    } catch (error) {
      toast.error('Failed to update status', getApiErrorMessage(error));
    }
  };

  // Ordinary zones: same confirm-delete flow as before. Destination templates: same
  // modal, with the destination-specific warning appended to the message.
  const requestDelete = (zone: Geofence) => {
    setActionError(null);
    setActionModal({ isOpen: true, type: 'DELETE', zone });
  };

  const closeActionModal = () => {
    if (actionLoading) return;
    setActionModal({ isOpen: false, type: null, zone: null });
    setActionError(null);
  };

  const executeAction = async () => {
    const { type, zone } = actionModal;
    if (!type || !zone) return;
    setActionLoading(true);
    setActionError(null);

    try {
      if (type === 'DELETE') {
        await adminApi.deleteGeofence(zone.id);
        toast.success('Geofence Deleted', 'The operational zone has been removed.');
      } else {
        await adminApi.toggleGeofence(zone.id, false);
        toast.success('Geofence Updated', 'Zone is now inactive.');
      }
      fetchData();
      closeActionModal();
    } catch (error: any) {
      setActionError(getApiErrorMessage(error));
      toast.error(type === 'DELETE' ? 'Deletion failed' : 'Failed to update status', getApiErrorMessage(error));
    } finally {
      setActionLoading(false);
    }
  };

  const TEMPLATE_WARNING = 'This zone is used for automatic destination-based geofencing — deactivating or deleting it will cause future bookings to this destination to fall back to a generic shop-centered circle instead of the real municipal boundary.';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {!loading && geofences.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={openCreateModal} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Create New Zone
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
          <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" />
        </div>
      ) : geofences.length === 0 ? (
        <div style={{ backgroundColor: 'white', padding: '5rem', borderRadius: '24px', textAlign: 'center', border: '1px solid #E5E7EB' }}>
          <Shield size={64} color="#E5E7EB" style={{ margin: '0 auto 1.5rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No geofences defined</h3>
          <p style={{ color: '#6B7280', marginBottom: '2rem' }}>Protect your fleet by defining allowed boundaries.</p>
          <button onClick={openCreateModal} className="btn-primary">Set Up First Zone</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {geofences.map(gf => {
            const points = parsePolygonPoints(gf.polygonCoordinates);
            return (
              <div key={gf.id} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '20px', border: gf.destinationName ? '1px solid #C4B5FD' : '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ padding: '0.5rem', backgroundColor: gf.isActive ? '#DCFCE7' : '#F3F4F6', borderRadius: '10px' }}>
                      <Shield size={20} color={gf.isActive ? '#16A34A' : '#6B7280'} />
                    </div>
                    <div>
                      <h4 style={{ fontWeight: 700 }}>{gf.name}</h4>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                        {points ? `${points.length} coordinates` : 'Unreadable shape'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => openEditModal(gf)} style={{ padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#6B7280' }} title="Edit zone">
                      <Pencil size={18} />
                    </button>
                    <button onClick={() => requestDelete(gf)} style={{ padding: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF' }} title="Delete zone">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {gf.destinationName && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: '20px', backgroundColor: '#EDE9FE', color: '#6D28D9', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '1rem' }}>
                    <MapPin size={12} /> Destination Template — {gf.destinationName}
                  </div>
                )}

                <div style={{ backgroundColor: '#F9FAFB', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#4B5563' }}>
                     <Car size={16} />
                    <span>Assigned to: {gf.vehicleId ? 'Specific Vehicle' : 'Global (All Vehicles)'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => requestToggle(gf)}
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
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '600px', padding: '2.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{editingId ? 'Edit Zone' : 'Create Zone'}</h2>
              <button onClick={closeModal} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X /></button>
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
                <button onClick={closeModal} style={{ flex: 1, padding: '1rem', borderRadius: '12px', border: '1px solid #DDD', backgroundColor: 'white', fontWeight: 700 }}>Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                  style={{ flex: 2, padding: '1rem', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : (editingId ? 'Save Changes' : 'Create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={actionModal.isOpen}
        title={actionModal.type === 'DELETE' ? 'Delete Geofence Zone?' : 'Deactivate Geofence Zone?'}
        message={
          actionModal.type === 'DELETE'
            ? `Are you sure you want to delete this operational boundary? Vehicles currently assigned to this zone will lose tracking restrictions.${actionModal.zone?.destinationName ? ` ${TEMPLATE_WARNING}` : ''}`
            : `This will deactivate the zone.${actionModal.zone?.destinationName ? ` ${TEMPLATE_WARNING}` : ''}`
        }
        variant="danger"
        confirmLabel={actionModal.type === 'DELETE' ? 'Delete Zone' : 'Deactivate Zone'}
        loading={actionLoading}
        error={actionError}
        onConfirm={executeAction}
        onCancel={closeActionModal}
      />
    </div>
  );
};

export default AdminGeofencePage;
