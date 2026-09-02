import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Car, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../services/api';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // No token in URL — show error immediately, no API call
  if (!token) {
    return (
      <PageShell>
        <IconBox color="#FEF2F2" icon={<AlertCircle size={48} color="#EF4444" />} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Invalid reset link</h2>
        <p style={{ color: 'var(--muted-mauve)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          This password reset link is missing or malformed. Please request a new one.
        </p>
        <Link to="/forgot-password" className="btn-primary" style={{ display: 'inline-block', padding: '0.875rem 2rem', textDecoration: 'none', borderRadius: '8px' }}>
          Request New Reset Link
        </Link>
      </PageShell>
    );
  }

  if (success) {
    return (
      <PageShell>
        <IconBox color="#F0FDF4" icon={<CheckCircle2 size={48} color="#22C55E" />} />
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Password reset!</h2>
        <p style={{ color: 'var(--muted-mauve)', marginBottom: '2rem', fontSize: '0.95rem' }}>
          Your password has been reset successfully. You can now log in with your new password.
        </p>
        <Link to="/login" className="btn-primary" style={{ display: 'inline-block', padding: '0.875rem 2rem', textDecoration: 'none', borderRadius: '8px' }}>
          Go to Login
        </Link>
      </PageShell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <h2 style={{ marginBottom: '0.5rem' }}>Set a new password</h2>
      <p style={{ color: 'var(--muted-mauve)', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Choose a strong password for your account.
      </p>

      {error && (
        <div style={{
          backgroundColor: '#FFEBEE',
          color: '#C62828',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          textAlign: 'left',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '1px' }} />
          <span>
            {error}
            {error.toLowerCase().includes('expired') && (
              <>{' '}<Link to="/forgot-password" style={{ color: '#C62828', fontWeight: 700 }}>Request a new link →</Link></>
            )}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>New Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              placeholder="Min. 8 characters"
              style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} aria-label="Toggle password"
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted-mauve)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}>
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Confirm New Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
              placeholder="Repeat your password"
              style={{ width: '100%', padding: '0.8rem 2.5rem 0.8rem 1rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)} aria-label="Toggle confirm password"
              style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted-mauve)', cursor: 'pointer', display: 'flex', padding: '0.25rem' }}>
              {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className="btn-primary"
          style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Reset Password'}
        </button>
      </form>

      <p style={{ marginTop: '2rem', color: 'var(--muted-mauve)', fontSize: '0.875rem', textAlign: 'center' }}>
        <Link to="/login" style={{ color: 'var(--warm-taupe)', fontWeight: 600, textDecoration: 'none' }}>← Back to Login</Link>
      </p>
    </PageShell>
  );
};

// Shared layout shell — keeps both states consistent
const PageShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--primary-bg)',
    padding: '2rem'
  }}>
    <div style={{ maxWidth: '450px', width: '100%' }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '2rem', textDecoration: 'none' }}>
        <Car size={36} color="var(--warm-taupe)" />
        <span style={{ fontSize: '1.75rem', fontWeight: 800 }}>JD <span style={{ color: 'var(--warm-taupe)' }}>CAR RENTAL</span></span>
      </Link>
      <div style={{
        backgroundColor: 'var(--white)',
        padding: '3rem',
        borderRadius: 'var(--border-radius)',
        boxShadow: 'var(--shadow-soft)',
        textAlign: 'center'
      }}>
        {children}
      </div>
    </div>
  </div>
);

const IconBox: React.FC<{ color: string; icon: React.ReactNode }> = ({ color, icon }) => (
  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
    <div style={{ backgroundColor: color, padding: '1rem', borderRadius: '50%' }}>{icon}</div>
  </div>
);

export default ResetPasswordPage;
