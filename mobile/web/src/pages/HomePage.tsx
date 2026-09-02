import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Clock, MapPin, ChevronRight, Loader2 } from 'lucide-react';
import VehicleCard from '../components/VehicleCard';
import { vehiclesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const HomePage: React.FC = () => {
  const [featuredVehicles, setFeaturedVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If admin opens homepage, redirect to dashboard
    if (user && profile?.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    }

    const fetchVehicles = async () => {
      try {
        setLoading(true);
        const { data } = await vehiclesApi.getAvailable();
        setFeaturedVehicles(data.slice(0, 3));
      } catch (err) {
        console.error('Error fetching vehicles:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, [user, profile, navigate]);

  const handleBookNow = () => {
    if (!user) {
      // Redirect to login with message
      navigate('/login', { state: { message: 'Please log in or create an account to book a vehicle.' } });
    } else {
      // If customer, go to vehicles selection or requests
      navigate('/vehicles');
    }
  };

  return (
    <>
      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section style={{ 
          padding: '6rem 0', 
          background: 'linear-gradient(135deg, #fdfdfd 0%, #f5f5f5 100%)',
          textAlign: 'center'
        }}>
          <div className="container">
            <span style={{ 
              backgroundColor: '#F3F4F6', 
              color: '#6B7280', 
              padding: '0.5rem 1rem', 
              borderRadius: '9999px', 
              fontSize: '0.875rem', 
              fontWeight: 600,
              display: 'inline-block',
              marginBottom: '1.5rem'
            }}>
              Premium Self-Drive Rentals
            </span>
            <h1 style={{ fontSize: '4rem', fontWeight: 900, marginBottom: '1.5rem', letterSpacing: '-0.025em' }}>
              Your Journey, <span style={{ color: '#6B7280' }}>Your Rules.</span>
            </h1>
            <p style={{ fontSize: '1.25rem', color: '#6B7280', maxWidth: '600px', margin: '0 auto 2.5rem', lineHeight: 1.6 }}>
              Experience the freedom of the open road with JD Car Rental's premium fleet. Simple, secure, and self-driven.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Link to="/vehicles" className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem', textDecoration: 'none' }}>
                Browse Fleet
              </Link>
              <button 
                onClick={handleBookNow}
                className="btn-outline" 
                style={{ padding: '1rem 2rem', fontSize: '1.1rem', cursor: 'pointer' }}
              >
                Book Now
              </button>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ padding: '5rem 0', backgroundColor: 'white' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '3rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ backgroundColor: '#F9FAFB', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <Shield size={32} color="#6B7280" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>Secure & Reliable</h3>
                <p style={{ color: '#6B7280' }}>Fully insured vehicles and verified drivers for your peace of mind.</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ backgroundColor: '#F9FAFB', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <Clock size={32} color="#6B7280" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>24/7 Support</h3>
                <p style={{ color: '#6B7280' }}>Round-the-clock assistance whenever you need help on the road.</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ backgroundColor: '#F9FAFB', width: '64px', height: '64px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <MapPin size={32} color="#6B7280" />
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem' }}>GPS Tracking</h3>
                <p style={{ color: '#6B7280' }}>Real-time location monitoring for safety and easy navigation.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Fleet */}
        <section style={{ padding: '5rem 0', backgroundColor: '#F9FAFB' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '3rem' }}>
              <div>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Featured Fleet</h2>
                <p style={{ color: '#6B7280' }}>Check out our most popular self-drive vehicles.</p>
              </div>
              <Link to="/vehicles" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'black', fontWeight: 600, textDecoration: 'none' }}>
                View All <ChevronRight size={20} />
              </Link>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
                <Loader2 className="animate-spin" size={48} color="#6B7280" />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
                {featuredVehicles.map((vehicle) => (
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
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default HomePage;
