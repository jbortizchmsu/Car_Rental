import React, { useEffect, useState, useRef, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, Loader2, X, AlertCircle, Upload, 
  Image as ImageIcon, Search, Filter, ArrowUpDown, 
  Car, CheckCircle, Clock, Wrench, ChevronRight, Info
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { vehiclesApi, getApiErrorMessage } from '../services/api';
import { useToast } from '../components/ToastProvider';
import ConfirmActionModal from '../components/ConfirmActionModal';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string;
  category: string;
  status: 'AVAILABLE' | 'RESERVED' | 'RENTED' | 'UNDER_MAINTENANCE' | 'RETIRED';
  dailyRate: number;
  seats: number;
  transmission: string;
  fuelType: string;
  imageUrl?: string;
  currentOdometerKm: number;
  lastOilChangeOdometerKm: number;
  oilChangeIntervalKm: number;
}

const VehicleManagement: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Toolbar State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('brand');

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    category: 'Sedan',
    status: 'AVAILABLE',
    dailyRate: 0,
    seats: 4,
    transmission: 'Automatic',
    fuelType: 'Gasoline',
    imageUrl: '',
    currentOdometerKm: 0,
    lastOilChangeOdometerKm: 0,
    oilChangeIntervalKm: 5000
  });

  useEffect(() => {
    fetchVehicles();
  }, []);

  const toast = useToast();
  const [retireModalOpen, setRetireModalOpen] = useState(false);
  const [retireVehicleId, setRetireVehicleId] = useState<string | null>(null);
  const [retireLoading, setRetireLoading] = useState(false);
  const [retireError, setRetireError] = useState<string | null>(null);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const { data } = await vehiclesApi.getAll();
      setVehicles(data);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load fleet data', getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    return {
      total: vehicles.length,
      available: vehicles.filter(v => v.status === 'AVAILABLE').length,
      rented: vehicles.filter(v => v.status === 'RENTED' || v.status === 'RESERVED').length,
      maintenance: vehicles.filter(v => v.status === 'UNDER_MAINTENANCE').length,
      dueService: vehicles.filter(v => v.currentOdometerKm >= (v.lastOilChangeOdometerKm + v.oilChangeIntervalKm)).length
    };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles
      .filter(v => {
        const matchesSearch = 
          v.brand.toLowerCase().includes(searchTerm.toLowerCase()) || 
          v.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
          v.licensePlate.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Exclude RETIRED by default in ALL view
        const matchesStatus = statusFilter === 'ALL' 
          ? v.status !== 'RETIRED' 
          : v.status === statusFilter;
        const matchesCategory = categoryFilter === 'ALL' || v.category === categoryFilter;
        
        return matchesSearch && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        if (sortBy === 'dailyRate') return b.dailyRate - a.dailyRate;
        if (sortBy === 'mileage') return b.currentOdometerKm - a.currentOdometerKm;
        return a.brand.localeCompare(b.brand);
      });
  }, [vehicles, searchTerm, statusFilter, categoryFilter, sortBy]);

  const handleOpenModal = (vehicle?: Vehicle) => {
    setSelectedFile(null);
    if (vehicle) {
      setEditingVehicle(vehicle);
      setFormData({
        brand: vehicle.brand,
        model: vehicle.model,
        year: vehicle.year,
        licensePlate: vehicle.licensePlate,
        category: vehicle.category,
        status: vehicle.status,
        dailyRate: vehicle.dailyRate,
        seats: vehicle.seats,
        transmission: vehicle.transmission,
        fuelType: vehicle.fuelType,
        imageUrl: vehicle.imageUrl || '',
        currentOdometerKm: vehicle.currentOdometerKm || 0,
        lastOilChangeOdometerKm: vehicle.lastOilChangeOdometerKm || 0,
        oilChangeIntervalKm: vehicle.oilChangeIntervalKm || 5000
      });
      setPreviewUrl(vehicle.imageUrl ? (vehicle.imageUrl.startsWith('http') ? vehicle.imageUrl : vehiclesApi.getImageUrl(vehicle.id)) : null);
    } else {
      setEditingVehicle(null);
      setFormData({
        brand: '',
        model: '',
        year: new Date().getFullYear(),
        licensePlate: '',
        category: 'Sedan',
        status: 'AVAILABLE',
        dailyRate: 0,
        seats: 4,
        transmission: 'Automatic',
        fuelType: 'Gasoline',
        imageUrl: '',
        currentOdometerKm: 0,
        lastOilChangeOdometerKm: 0,
        oilChangeIntervalKm: 5000
      });
      setPreviewUrl(null);
    }
    setShowModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('File too large', 'Maximum image size allowed is 5MB.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value.toString());
      });
      
      if (selectedFile) {
        data.append('vehicleImage', selectedFile);
      }

      if (editingVehicle) {
        await vehiclesApi.update(editingVehicle.id, data);
        toast.success('Vehicle updated', 'The vehicle details have been saved successfully.');
      } else {
        await vehiclesApi.create(data);
        toast.success('Vehicle created', 'The new vehicle has been added to your fleet.');
      }

      setShowModal(false);
      fetchVehicles();
    } catch (error: any) {
      toast.error('Failed to save vehicle', getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const openRetireModal = (id: string) => {
    setRetireVehicleId(id);
    setRetireError(null);
    setRetireModalOpen(true);
  };

  const closeRetireModal = () => {
    if (retireLoading) return;
    setRetireModalOpen(false);
    setRetireVehicleId(null);
    setRetireError(null);
  };

  const executeRetire = async () => {
    if (!retireVehicleId) return;
    setRetireLoading(true);
    setRetireError(null);

    try {
      await vehiclesApi.retire(retireVehicleId);
      toast.success('Vehicle retired', 'The vehicle has been removed from active fleet.');
      fetchVehicles();
      closeRetireModal();
    } catch (error: any) {
      setRetireError(getApiErrorMessage(error));
      toast.error('Retirement failed', getApiErrorMessage(error));
    } finally {
      setRetireLoading(false);
    }
  };

  const getMaintenanceInfo = (v: Vehicle) => {
    const dueAt = v.lastOilChangeOdometerKm + v.oilChangeIntervalKm;
    const remaining = dueAt - v.currentOdometerKm;
    
    if (remaining <= 0) return { label: 'Service Due', color: '#DC2626', icon: <AlertCircle size={14} /> };
    if (remaining <= 500) return { label: 'Due Soon', color: '#D97706', icon: <Clock size={14} /> };
    return { label: 'Healthy', color: '#16A34A', icon: <CheckCircle size={14} /> };
  };

  return (
    <div className="space-y-8" style={{ paddingBottom: '4rem' }}>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black text-black mb-1">Fleet Management</h1>
          <p className="text-gray-500 font-medium">Manage vehicles, pricing, availability, odometer, and maintenance readiness.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="btn btn-brand"
          style={{ padding: '0.75rem 1.5rem', borderRadius: '14px', boxShadow: '0 4px 12px rgba(173, 155, 141, 0.3)' }}
        >
          <Plus size={20} /> Add New Vehicle
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', border: 'none', background: 'white' }}>
          <div style={{ backgroundColor: 'var(--gray-50)', padding: '1rem', borderRadius: '16px' }}>
            <Car size={24} color="var(--black)" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Total Fleet</div>
            <div className="text-2xl font-black">{stats.total}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', border: 'none', background: 'white' }}>
          <div style={{ backgroundColor: 'var(--status-available-bg)', padding: '1rem', borderRadius: '16px' }}>
            <CheckCircle size={24} color="var(--status-available)" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Available</div>
            <div className="text-2xl font-black" style={{ color: 'var(--status-available)' }}>{stats.available}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', border: 'none', background: 'white' }}>
          <div style={{ backgroundColor: 'var(--status-rented-bg)', padding: '1rem', borderRadius: '16px' }}>
            <Clock size={24} color="var(--status-rented)" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Rented / Reserved</div>
            <div className="text-2xl font-black" style={{ color: 'var(--status-rented)' }}>{stats.rented}</div>
          </div>
        </div>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.5rem', border: 'none', background: 'white' }}>
          <div style={{ backgroundColor: 'var(--status-error-bg)', padding: '1rem', borderRadius: '16px' }}>
            <Wrench size={24} color="var(--status-error)" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Service Due</div>
            <div className="text-2xl font-black" style={{ color: 'var(--status-error)' }}>{stats.dueService}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ padding: '1.25rem', border: 'none', background: 'white', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} color="var(--gray-400)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input 
            className="form-input" 
            placeholder="Search brand, model, or plate..." 
            style={{ paddingLeft: '3rem', borderRadius: '12px', border: '1.5px solid var(--gray-100)' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} color="var(--gray-400)" />
          <select 
            className="form-select" 
            style={{ width: '160px', borderRadius: '12px', border: '1.5px solid var(--gray-100)' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Active Fleet</option>
            <option value="AVAILABLE">Available</option>
            <option value="RENTED">Rented</option>
            <option value="RESERVED">Reserved</option>
            <option value="UNDER_MAINTENANCE">Maintenance</option>
          </select>
          <select 
            className="form-select" 
            style={{ width: '160px', borderRadius: '12px', border: '1.5px solid var(--gray-100)' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            <option value="Sedan">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="Luxury">Luxury</option>
            <option value="Van">Van</option>
            <option value="Pickup">Pickup</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={18} color="var(--gray-400)" />
          <select 
            className="form-select" 
            style={{ width: '160px', borderRadius: '12px', border: '1.5px solid var(--gray-100)' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="brand">Sort by Brand</option>
            <option value="dailyRate">Sort by Rate</option>
            <option value="mileage">Sort by Mileage</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedVehicle ? '1fr 400px' : '1fr', gap: '2rem', transition: 'all 0.3s ease' }}>
        {/* Table List */}
        <div className="table-container" style={{ border: 'none', background: 'white', boxShadow: 'var(--shadow-soft)', borderRadius: '24px' }}>
          <table className="table">
            <thead style={{ background: 'var(--gray-50)' }}>
              <tr>
                <th style={{ padding: '1.25rem' }}>Vehicle Info</th>
                <th>Plate & Category</th>
                <th>Pricing & ODO</th>
                <th>Maintenance</th>
                <th>Status</th>
                <th style={{ textAlign: 'right', paddingRight: '2rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ padding: '6rem', textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={40} style={{ margin: '0 auto', color: 'var(--warm-taupe)' }} />
                    <p style={{ marginTop: '1rem', color: 'var(--gray-400)', fontWeight: 600 }}>Syncing Fleet Data...</p>
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '6rem', textAlign: 'center' }}>
                    <div style={{ backgroundColor: 'var(--gray-50)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                      <Car size={32} color="var(--gray-300)" />
                    </div>
                    <h3 style={{ color: 'var(--gray-600)' }}>No vehicles matching your criteria</h3>
                    <p style={{ color: 'var(--gray-400)', marginBottom: '1.5rem' }}>Start by adding a new vehicle to your fleet.</p>
                    <button onClick={() => handleOpenModal()} className="btn btn-brand">Add First Vehicle</button>
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const mnt = getMaintenanceInfo(vehicle);
                  return (
                    <tr 
                      key={vehicle.id} 
                      style={{ cursor: 'pointer', backgroundColor: selectedVehicle?.id === vehicle.id ? 'var(--gray-50)' : 'transparent' }}
                      onClick={() => setSelectedVehicle(vehicle)}
                    >
                      <td style={{ padding: '1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <div style={{ width: '80px', height: '54px', borderRadius: '12px', backgroundColor: 'var(--gray-100)', overflow: 'hidden', flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}>
                            {vehicle.imageUrl ? (
                              <img 
                                src={vehicle.imageUrl.startsWith('http') ? vehicle.imageUrl : vehiclesApi.getImageUrl(vehicle.id)} 
                                alt={vehicle.model}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80x54?text=No+Img'; }}
                              />
                            ) : (
                              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)' }}>
                                <ImageIcon size={20} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-black text-black">{vehicle.brand} {vehicle.model}</div>
                            <div className="text-xs text-gray-400 font-bold">{vehicle.year}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="font-bold text-sm" style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{vehicle.licensePlate}</div>
                        <div className="text-xs text-gray-500">{vehicle.category}</div>
                      </td>
                      <td>
                        <div className="font-black text-sm">₱{vehicle.dailyRate.toLocaleString()} <span className="text-xs text-gray-400 font-medium">/day</span></div>
                        <div className="text-xs text-gray-500 font-semibold">{vehicle.currentOdometerKm.toLocaleString()} km</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', fontWeight: 800, color: mnt.color }}>
                          {mnt.icon} {mnt.label}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)', marginTop: '0.2rem' }}>
                          Next: {(vehicle.lastOilChangeOdometerKm + vehicle.oilChangeIntervalKm).toLocaleString()} km
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={vehicle.status} />
                      </td>
                      <td style={{ paddingRight: '2rem' }}>
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenModal(vehicle); }}
                            className="p-2 rounded-lg transition-all hover:bg-gray-100"
                            style={{ color: 'var(--gray-500)' }}
                            title="Edit Vehicle"
                          >
                            <Edit2 size={18} />
                          </button>
                          {vehicle.status !== 'RETIRED' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); openRetireModal(vehicle.id); }}
                              className="p-2 rounded-lg transition-all hover:bg-status-error-bg"
                              style={{ color: 'var(--status-error)' }}
                              title="Retire Vehicle"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                          <div className="p-2 text-gray-300">
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Vehicle Detail Side Panel */}
        {selectedVehicle && (
          <div className="card" style={{ padding: '0', border: 'none', background: 'white', borderRadius: '24px', overflow: 'hidden', height: 'fit-content', position: 'sticky', top: '2rem' }}>
            <div style={{ height: '200px', backgroundColor: 'var(--gray-100)', position: 'relative' }}>
              {selectedVehicle.imageUrl ? (
                <img 
                  src={selectedVehicle.imageUrl.startsWith('http') ? selectedVehicle.imageUrl : vehiclesApi.getImageUrl(selectedVehicle.id)} 
                  alt={selectedVehicle.model}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-300)' }}>
                  <ImageIcon size={48} />
                </div>
              )}
              <button 
                onClick={() => setSelectedVehicle(null)}
                style={{ position: 'absolute', top: '1rem', right: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
              <div style={{ position: 'absolute', bottom: '1rem', left: '1rem' }}>
                <StatusBadge status={selectedVehicle.status} />
              </div>
            </div>

            <div style={{ padding: '2rem' }}>
              <div style={{ marginBottom: '2rem' }}>
                <h2 className="text-2xl font-black mb-1">{selectedVehicle.brand} {selectedVehicle.model}</h2>
                <div className="flex items-center gap-3 text-sm text-gray-500 font-semibold">
                  <span>{selectedVehicle.year}</span>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--gray-300)' }}></span>
                  <span style={{ fontFamily: 'monospace' }}>{selectedVehicle.licensePlate}</span>
                  <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: 'var(--gray-300)' }}></span>
                  <span>{selectedVehicle.category}</span>
                </div>
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Pricing & Specs</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="text-xs text-gray-400 font-bold mb-1">Base Rate</div>
                      <div className="text-lg font-black">₱{selectedVehicle.dailyRate.toLocaleString()}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="text-xs text-gray-400 font-bold mb-1">Capacity</div>
                      <div className="text-lg font-black">{selectedVehicle.seats} Seats</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="text-xs text-gray-400 font-bold mb-1">Transmission</div>
                      <div className="text-lg font-black">{selectedVehicle.transmission}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <div className="text-xs text-gray-400 font-bold mb-1">Fuel Type</div>
                      <div className="text-lg font-black">{selectedVehicle.fuelType}</div>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Maintenance Overview</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 border-b border-gray-100">
                      <span className="text-sm text-gray-500 font-semibold">Current Mileage</span>
                      <span className="font-bold">{selectedVehicle.currentOdometerKm.toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border-b border-gray-100">
                      <span className="text-sm text-gray-500 font-semibold">Last Oil Change</span>
                      <span className="font-bold">{selectedVehicle.lastOilChangeOdometerKm.toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between items-center p-3 border-b border-gray-100">
                      <span className="text-sm text-gray-500 font-semibold">Service Interval</span>
                      <span className="font-bold">{selectedVehicle.oilChangeIntervalKm.toLocaleString()} km</span>
                    </div>
                    <div className="flex justify-between items-center p-3">
                      <span className="text-sm text-gray-500 font-semibold">Status Health</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800, fontSize: '0.85rem', color: getMaintenanceInfo(selectedVehicle).color }}>
                        {getMaintenanceInfo(selectedVehicle).icon} {getMaintenanceInfo(selectedVehicle).label}
                      </div>
                    </div>
                  </div>
                </section>

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => handleOpenModal(selectedVehicle)}
                    className="btn btn-brand w-full"
                    style={{ borderRadius: '14px' }}
                  >
                    Edit Vehicle
                  </button>
                  <button 
                    onClick={() => setSelectedVehicle(null)}
                    className="btn btn-outline"
                    style={{ borderRadius: '14px', padding: '0.75rem' }}
                  >
                    <Info size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-container" style={{ maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-2xl font-black">{editingVehicle ? 'Update Vehicle' : 'Add New Vehicle'}</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 rounded-full hover:bg-gray-50"
              >
                <X size={24} color="var(--gray-400)" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-content" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '3rem' }}>
                
                <div className="space-y-8">
                  <section>
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">A. Vehicle Identity</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="form-group">
                        <label className="form-label">Brand</label>
                        <input required className="form-input" value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} placeholder="e.g. Toyota" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Model</label>
                        <input required className="form-input" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} placeholder="e.g. Camry" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Year</label>
                        <input type="number" required className="form-input" value={formData.year} onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">License Plate</label>
                        <input required className="form-input" value={formData.licensePlate} onChange={(e) => setFormData({...formData, licensePlate: e.target.value})} placeholder="ABC 1234" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category</label>
                        <select className="form-select" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}>
                          <option>Sedan</option>
                          <option>SUV</option>
                          <option>Luxury</option>
                          <option>Van</option>
                          <option>Pickup</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Capacity (Seats)</label>
                        <input type="number" required min="1" className="form-input" value={formData.seats} onChange={(e) => setFormData({...formData, seats: parseInt(e.target.value)})} />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">B. Pricing & Availability</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="form-group">
                        <label className="form-label">Daily Base Rate (₱)</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: 'var(--gray-400)' }}>₱</span>
                          <input type="number" required min="1" className="form-input" style={{ paddingLeft: '2.5rem' }} value={formData.dailyRate} onChange={(e) => setFormData({...formData, dailyRate: parseFloat(e.target.value)})} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Status</label>
                        <select 
                          className="form-select" 
                          value={formData.status} 
                          onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                          disabled={Boolean(editingVehicle && (editingVehicle.status === 'RESERVED' || editingVehicle.status === 'RENTED'))}
                        >
                          <option value="AVAILABLE">Available</option>
                          <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                          {editingVehicle?.status === 'RESERVED' && <option value="RESERVED">Reserved (System)</option>}
                          {editingVehicle?.status === 'RENTED' && <option value="RENTED">Rented (System)</option>}
                        </select>
                      </div>
                    </div>
                  </section>
                </div>

                <div className="space-y-8">
                  <section>
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">C. Vehicle Image</h3>
                    <div className="p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center">
                      <div style={{ width: '100%', height: '160px', borderRadius: '12px', overflow: 'hidden', backgroundColor: 'white', marginBottom: '1.5rem', boxShadow: 'var(--shadow-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {previewUrl ? (
                          <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ color: 'var(--gray-200)' }}>
                            <ImageIcon size={48} />
                          </div>
                        )}
                      </div>
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-outline w-full mb-3"
                        style={{ background: 'white', border: '1.5px solid var(--gray-200)' }}
                      >
                        <Upload size={18} /> {previewUrl ? 'Replace Photo' : 'Upload Photo'}
                      </button>
                      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                      <p className="text-xs text-gray-400 font-semibold">JPG, PNG, WEBP (Max 5MB)</p>
                      
                      <div style={{ marginTop: '1.5rem', textAlign: 'left' }}>
                        <label className="text-xs font-black text-gray-400 uppercase mb-2 block">Fallback URL</label>
                        <input className="form-input text-sm" value={formData.imageUrl} onChange={(e) => setFormData({...formData, imageUrl: e.target.value})} placeholder="https://..." />
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6">D. Maintenance & ODO</h3>
                    <div className="space-y-4">
                      <div className="form-group">
                        <label className="form-label">Current Odometer (km)</label>
                        <input type="number" required min="0" className="form-input" value={formData.currentOdometerKm} onChange={(e) => setFormData({...formData, currentOdometerKm: parseFloat(e.target.value)})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Last Oil Change (km)</label>
                        <input type="number" required min="0" className="form-input" value={formData.lastOilChangeOdometerKm} onChange={(e) => setFormData({...formData, lastOilChangeOdometerKm: parseFloat(e.target.value)})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Service Interval (km)</label>
                        <input type="number" required min="100" className="form-input" value={formData.oilChangeIntervalKm} onChange={(e) => setFormData({...formData, oilChangeIntervalKm: parseFloat(e.target.value)})} />
                      </div>
                    </div>
                  </section>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline" style={{ padding: '0.8rem 2rem' }}>Cancel</button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="btn btn-brand" 
                  style={{ padding: '0.8rem 3rem', boxShadow: '0 4px 12px rgba(173, 155, 141, 0.3)' }}
                >
                  {submitting ? <Loader2 className="animate-spin" size={20} /> : (editingVehicle ? 'Update Vehicle' : 'Add Vehicle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionModal
        isOpen={retireModalOpen}
        title="Retire Vehicle?"
        message="Are you sure you want to RETIRE this vehicle? Retired vehicles will not be bookable but will remain in historical records and reports."
        variant="danger"
        confirmLabel="Retire Vehicle"
        loading={retireLoading}
        error={retireError}
        onConfirm={executeRetire}
        onCancel={closeRetireModal}
      />
    </div>
  );
};

export default VehicleManagement;
