import React, { useEffect, useRef, useState } from 'react';
import VehicleCard from '../components/VehicleCard';
import BookingRequestModal from '../components/BookingRequestModal';
import { vehiclesApi } from '../services/api';
import { Loader2, Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  dailyRate: number;
  seats: number;
  fuelType: string;
  status: string;
  imageUrl?: string;
  category: string;
  currentOdometerKm: number;
}

const VehiclesPage: React.FC = () => {
  const location = useLocation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Guard so auto-open from navigation state only fires once
  const autoOpenedRef = useRef(false);

  const fetchVehicles = async (pickup = '', returnD = '') => {
    try {
      setLoading(true);
      const { data } = await vehiclesApi.getAvailable(
        pickup || undefined,
        returnD || undefined
      );
      setVehicles(data);

      // Auto-open modal if navigated from somewhere with a pre-selected vehicle
      if (!autoOpenedRef.current && location.state?.vehicle) {
        const preSelected = data.find((v: any) => v.id === location.state.vehicle.id);
        if (preSelected) {
          setSelectedVehicle(preSelected);
          setIsModalOpen(true);
          autoOpenedRef.current = true;
        }
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles(pickupDate, returnDate);
  }, [pickupDate, returnDate]);

  const filteredVehicles = vehicles.filter(v => 
    v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (vehicle: Vehicle) => {
    // If the vehicle doesn't have a category from the card, find it in our main list
    const fullVehicleData = vehicles.find(v => v.id === vehicle.id) || vehicle;
    setSelectedVehicle(fullVehicleData);
    setIsModalOpen(true);
  };

  return (
    <>
      <main style={{ flex: 1, padding: '4rem 0' }}>
        <div className="container">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '3rem',
            flexWrap: 'wrap',
            gap: '1.5rem'
          }}>
            <div>
              <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Our Premium Fleet</h1>
              <p style={{ color: 'var(--muted-mauve)' }}>Select a vehicle for your next self-drive journey.</p>
            </div>
            
            <div style={{ position: 'relative', maxWidth: '400px', width: '100%' }}>
              <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={20} />
              <input 
                type="text" 
                placeholder="Search by make, model, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem 0.8rem 3rem',
                  borderRadius: '12px',
                  border: '1px solid #ddd',
                  fontSize: '1rem',
                  outline: 'none',
                  boxShadow: 'var(--shadow-soft)'
                }}
              />
            </div>
          </div>

          {/* Date availability filter */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '2rem', padding: '1.25rem 1.5rem', backgroundColor: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-soft)', border: '1px solid #eee' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted-mauve)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pickup Date</label>
              <input
                type="date"
                value={pickupDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                  setPickupDate(e.target.value);
                  if (!e.target.value) setReturnDate('');
                }}
                style={{ padding: '0.6rem 0.9rem', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none', cursor: 'pointer' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted-mauve)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Return Date</label>
              <input
                type="date"
                value={returnDate}
                min={pickupDate || new Date().toISOString().split('T')[0]}
                disabled={!pickupDate}
                onChange={(e) => setReturnDate(e.target.value)}
                style={{ padding: '0.6rem 0.9rem', borderRadius: '10px', border: '1px solid #ddd', fontSize: '0.95rem', outline: 'none', cursor: pickupDate ? 'pointer' : 'not-allowed', opacity: pickupDate ? 1 : 0.5 }}
              />
            </div>
            {(pickupDate || returnDate) && (
              <button
                onClick={() => { setPickupDate(''); setReturnDate(''); }}
                style={{ padding: '0.6rem 1rem', borderRadius: '10px', border: '1px solid #ddd', backgroundColor: 'white', fontSize: '0.85rem', fontWeight: 600, color: 'var(--muted-mauve)', cursor: 'pointer' }}
              >
                Clear dates
              </button>
            )}
            {pickupDate && returnDate ? (
              <span style={{ fontSize: '0.85rem', color: 'var(--warm-taupe)', fontWeight: 600 }}>
                Showing vehicles available {new Date(pickupDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {new Date(returnDate + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'var(--gray-400)' }}>Select dates to see real-time availability</span>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
              <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '5rem', 
              backgroundColor: '#f9f9f9', 
              borderRadius: '20px',
              border: '2px dashed #eee'
            }}>
              <h3 style={{ marginBottom: '1rem' }}>No vehicles available</h3>
              <p style={{ color: 'var(--muted-mauve)' }}>We couldn't find any vehicles matching your search or current availability.</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '2.5rem'
            }}>
              {filteredVehicles.map((vehicle) => (
                <VehicleCard 
                  key={vehicle.id}
                  id={vehicle.id}
                  brand={vehicle.brand}
                  model={vehicle.model}
                  price={vehicle.dailyRate}
                  seats={vehicle.seats}
                  fuel={vehicle.fuelType}
                  status={vehicle.status}
                  imageUrl={vehicle.imageUrl}
                  mileage={vehicle.currentOdometerKm}
                  onBookNow={handleOpenModal}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <BookingRequestModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedVehicle(null); }}
        vehicle={selectedVehicle}
      />
    </>
  );
};

export default VehiclesPage;
