import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Car, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { authApi } from '../services/api';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../contexts/AuthContext';

const RegisterPage: React.FC = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  React.useEffect(() => {
    if (user && !authLoading) {
      if (profile?.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/customer/my-bookings', { replace: true });
      }
    }
  }, [user, profile, authLoading, navigate]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendRateLimited, setResendRateLimited] = useState(false);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);

  // Auto-redirect to login when already verified — cleanup on unmount
  useEffect(() => {
    if (!isAlreadyVerified) return;
    const timer = setTimeout(() => navigate('/login'), 2500);
    return () => clearTimeout(timer);
  }, [isAlreadyVerified, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      if (password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }

      setLoading(true);
      setError(null);

      await authApi.register({
        email,
        password,
        confirmPassword,
        fullName,
        phoneNumber,
        address
      });

      setRegisteredEmail(email);
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    const handleResend = async () => {
      setResendLoading(true);
      setResendError(null);
      setResendRateLimited(false);
      try {
        await authApi.resendVerification(registeredEmail);
        setResendSent(true);
        toast.success('Email sent', 'A new verification link has been sent to your inbox.');
      } catch (err: any) {
        const httpStatus = err?.response?.status;
        const code = err?.response?.data?.code;
        if (code === 'ALREADY_VERIFIED') {
          setIsAlreadyVerified(true);
          setResendError('Your email is already verified. Taking you to login…');
        } else if (httpStatus === 429) {
          setResendRateLimited(true);
          setResendError(
            code === 'RESEND_RATE_LIMITED'
              ? "You've reached the resend limit (3 per hour). Please wait before requesting another link."
              : 'Too many attempts. Please wait before trying again.'
          );
        } else {
          setResendSent(true);
          toast.success('Email sent', 'If that address is registered, a new link has been sent.');
        }
      } finally {
        setResendLoading(false);
      }
    };

    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDFDFD', padding: '2rem' }}>
        <div style={{ maxWidth: '500px', width: '100%', textAlign: 'center', padding: '3rem', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#EFF6FF', padding: '1rem', borderRadius: '50%' }}>
              <CheckCircle2 color="#3B82F6" size={48} />
            </div>
          </div>
          <h2 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '1rem' }}>Check your email</h2>
          <p style={{ color: '#6B7280', marginBottom: '0.5rem' }}>
            We've sent a verification link to
          </p>
          <p style={{ color: '#111827', fontWeight: 700, marginBottom: '1.5rem', wordBreak: 'break-word' }}>
            {registeredEmail}
          </p>
          <p style={{ color: '#6B7280', fontSize: '0.875rem', marginBottom: '2rem' }}>
            Click the link in the email to activate your account. The link expires in 24 hours.
          </p>
          {resendSent ? (
            <p style={{ color: '#22C55E', fontSize: '0.875rem', fontWeight: 600 }}>✓ A new link has been sent!</p>
          ) : resendError ? (
            <div style={{ backgroundColor: isAlreadyVerified ? '#EFF6FF' : resendRateLimited ? '#FFFBEB' : '#FEF2F2', border: `1px solid ${isAlreadyVerified ? '#BFDBFE' : resendRateLimited ? '#FDE68A' : '#FECACA'}`, borderRadius: '12px', padding: '0.875rem 1rem', color: isAlreadyVerified ? '#1D4ED8' : resendRateLimited ? '#92400E' : '#B91C1C', fontSize: '0.875rem', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
              <span>{isAlreadyVerified ? 'ℹ️' : resendRateLimited ? '⏳' : '⚠'}</span>
              <span>{resendError}</span>
            </div>
          ) : (
            <>
              <p style={{ color: '#9CA3AF', fontSize: '0.875rem' }}>
                Didn't receive it?{' '}
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  style={{ background: 'none', border: 'none', color: '#3B82F6', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', padding: 0 }}
                >
                  {resendLoading ? 'Sending…' : 'Resend verification email'}
                </button>
              </p>
              <p style={{ color: '#9CA3AF', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                Up to 3 resend requests allowed per hour.
              </p>
            </>
          )}
          <p style={{ marginTop: '2rem', color: '#9CA3AF', fontSize: '0.875rem' }}>
            <Link to="/login" style={{ color: '#6B7280', textDecoration: 'none', fontWeight: 600 }}>Back to login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDFDFD', padding: '2rem' }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '2.5rem', textDecoration: 'none' }}>
          <div style={{ backgroundColor: 'black', color: 'white', padding: '0.5rem', borderRadius: '12px' }}>
            <Car size={32} />
          </div>
          <span style={{ fontSize: '1.75rem', fontWeight: 900, color: 'black', letterSpacing: '-0.025em' }}>JD <span style={{ color: '#6B7280' }}>CAR RENTAL</span></span>
        </Link>

        <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05)', border: '1px solid #F3F4F6' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Create your account</h1>
          <p style={{ color: '#6B7280', marginBottom: '2rem' }}>Join us for premium self-drive car rentals.</p>

          {error && (
            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#B91C1C', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <AlertCircle size={20} />
              <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Dela Cruz"
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '1rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@example.com"
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '1rem', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Phone Number</label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="09123456789"
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '1rem', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '0.875rem 2.5rem 0.875rem 1rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '1rem', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#6B7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.25rem'
                    }}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '0.875rem 2.5rem 0.875rem 1rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '1rem', outline: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#6B7280',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0.25rem'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>Address</label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="City, Province"
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '1rem', outline: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Create Account'}
            </button>
          </form>

          <p style={{ marginTop: '2rem', textAlign: 'center', color: '#6B7280', fontSize: '0.875rem' }}>
            Already have an account? <Link to="/login" style={{ color: 'black', fontWeight: 600, textDecoration: 'none' }}>Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
