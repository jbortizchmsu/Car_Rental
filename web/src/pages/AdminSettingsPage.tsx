import React from 'react';
import { Settings, Shield, Bell } from 'lucide-react';

const AdminSettingsPage: React.FC = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--black)', marginBottom: '0.5rem' }}>Settings</h1>
        <p style={{ color: 'var(--gray-600)' }}>Manage application configuration and company profile.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--soft-beige)', padding: '0.75rem', borderRadius: '12px' }}>
              <Settings size={24} color="var(--warm-taupe)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>General Settings</h3>
          </div>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.95rem', margin: 0 }}>
            This module will allow you to configure company contact information, business hours, and operational preferences.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--gray-100)', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
            Coming Soon: Company Profile Management
          </div>
        </div>

        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--soft-beige)', padding: '0.75rem', borderRadius: '12px' }}>
              <Shield size={24} color="var(--warm-taupe)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Security & Access</h3>
          </div>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.95rem', margin: 0 }}>
            Configure password policies, session timeouts, and two-factor authentication settings for administrative accounts.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--gray-100)', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
            Coming Soon: Advanced RBAC Controls
          </div>
        </div>

        <div className="card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ backgroundColor: 'var(--soft-beige)', padding: '0.75rem', borderRadius: '12px' }}>
              <Bell size={24} color="var(--warm-taupe)" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Notifications</h3>
          </div>
          <p style={{ color: 'var(--gray-600)', fontSize: '0.95rem', margin: 0 }}>
            Manage automated email alerts for booking requests, payment confirmations, and system maintenance tasks.
          </p>
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--gray-100)', color: 'var(--gray-400)', fontSize: '0.85rem' }}>
            Coming Soon: Custom Alert Templates
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
