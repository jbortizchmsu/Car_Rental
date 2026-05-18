import React from 'react';
import { Users, ShieldAlert, UserCheck, Shield } from 'lucide-react';

const AdminUserRolesPage: React.FC = () => {
  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--black)', marginBottom: '0.5rem' }}>User Roles</h1>
        <p style={{ color: 'var(--gray-600)' }}>Manage administrative access and customer account permissions.</p>
      </header>

      <div style={{ backgroundColor: 'var(--white)', padding: '2rem', borderRadius: 'var(--border-radius)', boxShadow: 'var(--shadow-soft)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <Shield color="var(--warm-taupe)" size={28} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Access Control Overview</h2>
        </div>
        <p style={{ color: 'var(--gray-700)', lineHeight: 1.6, marginBottom: '2rem' }}>
          The JD Car Rental system uses a strict Role-Based Access Control (RBAC) model. For security and simplicity, the system currently supports two primary roles:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ padding: '1.5rem', backgroundColor: 'var(--primary-bg)', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <ShieldAlert color="var(--warm-taupe)" size={20} />
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Administrator</h4>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', margin: 0 }}>
              Full access to all management modules including Fleet, Payments, and Reports. Can manage all bookings and system settings.
            </p>
          </div>

          <div style={{ padding: '1.5rem', backgroundColor: 'var(--primary-bg)', borderRadius: '16px', border: '1px solid var(--gray-200)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <UserCheck color="var(--warm-taupe)" size={20} />
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Customer</h4>
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--gray-600)', margin: 0 }}>
              Can browse vehicles, request rentals, and manage their own bookings/payments. No access to administrative modules.
            </p>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-500)' }}>
        <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--gray-700)', marginBottom: '0.5rem' }}>User Management Coming Soon</h3>
        <p style={{ maxWidth: '500px', margin: '0 auto' }}>
          This module will soon allow you to search, view, and manage individual user accounts and their respective permissions.
        </p>
      </div>
    </div>
  );
};

export default AdminUserRolesPage;
