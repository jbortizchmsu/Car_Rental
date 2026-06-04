import React, { useEffect } from 'react';
import { History, Clock, FileText } from 'lucide-react';
import { usePageHeader } from '../contexts/PageHeaderContext';

const AdminGpsTrackingPage: React.FC = () => {
  const { setPageHeader } = usePageHeader();

  useEffect(() => {
    setPageHeader({
      title: 'GPS Tracking',
      subtitle: 'Historical GPS location logs and vehicle movement data'
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <History color="var(--warm-taupe)" size={20} />
            <h4 style={{ margin: 0, fontWeight: 700 }}>Total Logs Stored</h4>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--black)' }}>Archive</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: 0 }}>Compressed historical GPS data</p>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Clock color="var(--warm-taupe)" size={20} />
            <h4 style={{ margin: 0, fontWeight: 700 }}>Retention Period</h4>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--black)' }}>90 Days</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: 0 }}>Standard telemetry storage policy</p>
        </div>

        <div className="card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <FileText color="var(--warm-taupe)" size={20} />
            <h4 style={{ margin: 0, fontWeight: 700 }}>Session Reports</h4>
          </div>
          <p style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0.5rem 0', color: 'var(--black)' }}>Ready</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: 0 }}>Exportable PDF/CSV rental journeys</p>
        </div>
      </div>

      <div className="card" style={{ padding: '4rem', textAlign: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' }}>
        <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <History size={40} color="var(--gray-300)" />
        </div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>Historical Replay Coming Soon</h2>
        <p style={{ color: 'var(--gray-600)', maxWidth: '500px', margin: '0 auto 2.5rem', lineHeight: 1.6, fontWeight: 500 }}>
          The GPS Tracking page is being upgraded to support journey movement replays and comprehensive telemetry export. For live monitoring, please use the Map Dashboard.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem 2rem', borderRadius: '16px', border: '1.5px solid var(--gray-200)', color: 'var(--gray-400)', fontSize: '0.85rem', fontWeight: 700 }}>
            Session Movement Playback
          </div>
          <div style={{ padding: '1rem 2rem', borderRadius: '16px', border: '1.5px solid var(--gray-200)', color: 'var(--gray-400)', fontSize: '0.85rem', fontWeight: 700 }}>
            Location History Export
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminGpsTrackingPage;
