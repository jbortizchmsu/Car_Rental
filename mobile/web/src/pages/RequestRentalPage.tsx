import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const RequestRentalPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect to vehicles page, preserving any selected vehicle state if present
    navigate('/vehicles', { 
      replace: true,
      state: location.state
    });
  }, [navigate, location]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem' }}>
      <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" style={{ marginBottom: '1rem' }} />
      <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Redirecting...</h2>
      <p style={{ color: 'var(--muted-mauve)' }}>Please choose a vehicle first to start your booking.</p>
    </div>
  );
};

export default RequestRentalPage;
