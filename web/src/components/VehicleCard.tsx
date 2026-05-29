import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Fuel, Shield } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { useAuth } from '../contexts/AuthContext';
import { vehiclesApi } from '../services/api';

interface VehicleCardProps {
  id: string;
  model: string;
  brand: string;
  price: number;
  seats: number;
  fuel: string;
  status: string;
  imageUrl?: string;
  mileage?: number;
  onBookNow?: (vehicle: any) => void;
}

const VehicleCard: React.FC<VehicleCardProps> = ({ id, model, brand, price, seats, fuel, status, imageUrl, mileage, onBookNow }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const displayImageUrl = imageUrl 
    ? (imageUrl.startsWith('http') ? imageUrl : vehiclesApi.getImageUrl(id))
    : null;

  const handleBookNow = () => {
    if (!user) {
      navigate('/login', { state: { message: 'Please log in or create an account to book a vehicle.', from: '/vehicles' } });
      return;
    }
    
    if (onBookNow) {
      onBookNow({ id, model, brand, dailyRate: price, seats, fuelType: fuel, status, imageUrl: displayImageUrl, category: '' });
    } else {
      // Fallback
      navigate('/vehicles');
    }
  };

  return (
    <div style={{
      backgroundColor: 'var(--white)',
      borderRadius: 'var(--border-radius)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-soft)',
      border: '1px solid #f0f0f0',
      transition: 'transform 0.3s ease'
    }}>
      <div style={{ 
        height: '220px', 
        backgroundColor: 'var(--soft-beige)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative'
      }}>
        {displayImageUrl ? (
          <img src={displayImageUrl} alt={model} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ color: 'var(--muted-mauve)', fontWeight: 500 }}>{brand} {model}</span>
        )}
        <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
          <StatusBadge status={status} />
        </div>
      </div>
      
      <div style={{ padding: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{brand} {model}</h3>
          <p style={{ color: 'var(--muted-mauve)', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Self-Drive Rental</span>
            {mileage !== undefined && <span style={{ fontWeight: 600 }}>{mileage.toLocaleString()} km</span>}
          </p>
        </div>

        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          marginBottom: '1.5rem',
          padding: '0.75rem',
          backgroundColor: '#f9f9f9',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>
            <Users size={16} />
            <span>{seats} Seats</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>
            <Fuel size={16} />
            <span>{fuel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--muted-mauve)' }}>
            <Shield size={16} />
            <span>Insured</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>₱{price.toLocaleString()}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--muted-mauve)', marginLeft: '4px' }}>/day</span>
          </div>
          <button 
            className="btn-primary" 
            style={{ padding: '0.6rem 1.2rem' }}
            disabled={status !== 'AVAILABLE'}
            onClick={handleBookNow}
          >
            {status === 'AVAILABLE' ? 'Book Now' : status.replace('_', ' ')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VehicleCard;
