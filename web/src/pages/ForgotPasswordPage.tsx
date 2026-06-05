import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Car, Loader2, AlertCircle, CheckCircle2, Mail } from 'lucide-react';
import { authApi } from '../services/api';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    setIsRateLimited(false);
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      const code = err?.response?.data?.code;
      if (httpStatus === 429) {
        setIsRateLimited(true);
        setError(
          code === 'RESET_RATE_LIMITED'
            ? "You've reached the reset limit (3 per 15 minutes). Please wait before requesting another reset link."
            : 'Too many attempts. Please wait before trying again.'
        );
      } else {
        setError('Something went wrong. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
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
          {submitted ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#EFF6FF', padding: '1rem', borderRadius: '50%' }}>
                  <CheckCircle2 size={48} color="#3B82F6" />
                </div>
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Check your email</h2>
              <p style={{ color: 'var(--muted-mauve)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                If an account exists for
              </p>
              <p style={{ fontWeight: 700, color: 'var(--black)', marginBottom: '1rem', wordBreak: 'break-word' }}>
                {email}
              </p>
              <p style={{ color: 'var(--muted-mauve)', fontSize: '0.875rem', marginBottom: '2rem' }}>
                you'll receive a reset link shortly. The link expires in 1 hour.
              </p>
              <Link to="/login" style={{ color: 'var(--warm-taupe)', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}>
                ← Back to Login
              </Link>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#F3F4F6', padding: '1rem', borderRadius: '50%' }}>
                  <Mail size={36} color="var(--warm-taupe)" />
                </div>
              </div>
              <h2 style={{ marginBottom: '0.5rem' }}>Forgot your password?</h2>
              <p style={{ color: 'var(--muted-mauve)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div style={{
                  backgroundColor: isRateLimited ? '#FFFBEB' : '#FFEBEE',
                  color: isRateLimited ? '#92400E' : '#C62828',
                  border: `1px solid ${isRateLimited ? '#FDE68A' : '#FECACA'}`,
                  padding: '1rem',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  textAlign: 'left',
                  fontSize: '0.9rem'
                }}>
                  <span style={{ flexShrink: 0 }}>{isRateLimited ? '⏳' : <AlertCircle size={18} />}</span>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #ddd',
                      fontSize: '1rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Reset Link'}
                </button>
                <p style={{ marginTop: '0.5rem', color: '#9CA3AF', fontSize: '0.75rem', textAlign: 'center' }}>
                  Up to 3 reset requests allowed per 15 minutes.
                </p>
              </form>

              <p style={{ marginTop: '2rem', color: 'var(--muted-mauve)', fontSize: '0.875rem' }}>
                Remember your password?{' '}
                <Link to="/login" style={{ color: 'var(--warm-taupe)', fontWeight: 600, textDecoration: 'none' }}>
                  Back to Login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
