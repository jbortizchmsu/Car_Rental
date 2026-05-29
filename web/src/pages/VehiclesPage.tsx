import React, { useEffect, useState } from 'react';
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
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const { data } = await vehiclesApi.getAvailable();
      setVehicles(data);
      
      // Auto-open modal if navigated from somewhere with a pre-selected vehicle
      if (location.state?.vehicle) {
        const preSelected = data.find((v: any) => v.id === location.state.vehicle.id);
        if (preSelected) {
          setSelectedVehicle(preSelected);
          setIsModalOpen(true);
        }
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

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
