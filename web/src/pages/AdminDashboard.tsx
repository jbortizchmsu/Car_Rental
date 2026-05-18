import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../services/api';
import { 
  CheckCircle2, 
  DollarSign, 
  Calendar, 
  Car, 
  Navigation, 
  Key, 
  Map as MapIcon
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data } = await adminApi.getSummaryReport();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Overview</h1>
          <p style={{ color: 'var(--gray-500)', fontWeight: 500 }}>Here's what's happening with JD Car Rental today.</p>
        </div>
        <div className="flex items-center gap-4">
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontWeight: 700 }}>{profile?.full_name}</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)' }}>System Administrator</p>
          </div>
          <div style={{ 
            width: '48px', height: '48px', borderRadius: '50%', 
            backgroundColor: 'var(--soft-beige)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', fontWeight: 900 
          }}>
            {profile?.full_name?.charAt(0)}
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        <div className="card flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div style={{ padding: '0.75rem', backgroundColor: '#DCFCE7', borderRadius: '12px' }}>
              <CheckCircle2 size={24} color="#16A34A" />
            </div>
            <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>{loading ? '...' : stats?.bookings?.active || 0}</span>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', fontWeight: 600 }}>Active Rentals</p>
        </div>

        <div className="card flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div style={{ padding: '0.75rem', backgroundColor: '#F3E8FF', borderRadius: '12px' }}>
              <DollarSign size={24} color="#7B1FA2" />
            </div>
            <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>₱{loading ? '...' : (stats?.revenue?.totalVerified || 0).toLocaleString()}</span>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', fontWeight: 600 }}>Verified Revenue</p>
        </div>

        <div className="card flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div style={{ padding: '0.75rem', backgroundColor: '#FEF3C7', borderRadius: '12px' }}>
              <Calendar size={24} color="#D97706" />
            </div>
            <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>{loading ? '...' : stats?.bookings?.pending || 0}</span>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', fontWeight: 600 }}>Pending Review</p>
        </div>

        <div className="card flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <div style={{ padding: '0.75rem', backgroundColor: '#E0F2FE', borderRadius: '12px' }}>
              <Car size={24} color="#0284C7" />
            </div>
            <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>{loading ? '...' : stats?.vehicles?.available || 0}</span>
          </div>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.9rem', fontWeight: 600 }}>Available Fleet</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <h2 className="card-title">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-6">
          <button 
            onClick={() => navigate('/admin/pickup')}
            className="btn-brand"
            style={{ padding: '2.5rem', borderRadius: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', height: 'auto' }}
          >
            <Key size={32} style={{ marginBottom: '1.5rem' }} />
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Release Vehicle</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 500 }}>Process pickups and active drive starts.</p>
          </button>

          <button 
            onClick={() => navigate('/admin/active-rentals')}
            className="btn-brand"
            style={{ padding: '2.5rem', borderRadius: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', height: 'auto' }}
          >
            <Navigation size={32} style={{ marginBottom: '1.5rem' }} />
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Track & Returns</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 500 }}>Monitor GPS and process vehicle returns.</p>
          </button>

          <button 
            onClick={() => navigate('/admin/live-map')}
            className="btn-brand"
            style={{ padding: '2.5rem', borderRadius: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', height: 'auto' }}
          >
            <MapIcon size={32} style={{ marginBottom: '1.5rem' }} />
            <h3 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>Live Vehicle Map</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.8, fontWeight: 500 }}>Real-time GPS tracking and geofence monitoring.</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
