import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

interface VehicleImageProps {
  vehicleId: string;
  brand: string;
  model: string;
  className?: string;
}

const VehicleImage = ({ vehicleId, brand, model, className }: VehicleImageProps) => {
  const [error, setError] = useState(false);
  const imageUrl = `${API_BASE}/vehicles/${vehicleId}/image`;

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className ?? ''}`}>
        <span className="text-gray-400 text-xs text-center px-2">{brand} {model}</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={`${brand} ${model}`}
      className={`object-cover ${className ?? ''}`}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      onError={() => setError(true)}
    />
  );
};

export default VehicleImage;
