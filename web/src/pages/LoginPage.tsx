import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Car, Loader2, AlertCircle, Eye, EyeOff, Info, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendRateLimited, setResendRateLimited] = useState(false);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, signIn, loading: authLoading } = useAuth();

  const message = location.state?.message;

  React.useEffect(() => {
    if (user && !authLoading) {
      if (profile?.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        // Only redirect if not already on the login page by choice (or go to intended)
        const from = (location.state as any)?.from?.pathname || '/customer/my-bookings';
        if (from !== '/login') {
          navigate(from, { replace: true });
        }
      }
    }
  }, [user, profile, authLoading, navigate, location.state]);

  if (authLoading) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await signIn({ email, password });
      
      // Admin check for redirection
      const storedUser = JSON.parse(localStorage.getItem('jd_user') || '{}');
      if (storedUser.role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message);
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        setShowResend(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    setResendRateLimited(false);
    try {
      await authApi.resendVerification(email);
      setResendSent(true);
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      const code = err?.response?.data?.code;
      if (code === 'ALREADY_VERIFIED') {
        setIsAlreadyVerified(true);
      } else if (httpStatus === 429) {
        setResendRateLimited(true);
      } else {
        setResendSent(true); // other errors: show success to avoid enumeration
      }
    } finally {
      setResendLoading(false);
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
      <div style={{
        maxWidth: '450px',
        width: '100%',
        backgroundColor: 'var(--white)',
        padding: '3rem',
        borderRadius: 'var(--border-radius)',
        boxShadow: 'var(--shadow-soft)',
        textAlign: 'center'
      }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
          <Car size={40} color="var(--warm-taupe)" />
          <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>JD <span style={{ color: 'var(--warm-taupe)' }}>CAR RENTAL</span></span>
        </Link>
        
        <h2 style={{ marginBottom: '0.5rem' }}>Welcome Back</h2>
        <p style={{ color: 'var(--muted-mauve)', marginBottom: '2.5rem' }}>Login to manage your rentals</p>

        {message && (
          <div style={{ 
            backgroundColor: 'rgba(173, 155, 141, 0.1)', 
            color: 'var(--warm-taupe)', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textAlign: 'left',
            fontSize: '0.9rem',
            border: '1px solid rgba(173, 155, 141, 0.2)'
          }}>
            <Info size={18} />
            {message}
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#FFEBEE',
            color: '#C62828',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: showResend ? '0.75rem' : '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textAlign: 'left',
            fontSize: '0.9rem'
          }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {showResend && (
          <div style={{ backgroundColor: isAlreadyVerified ? '#EFF6FF' : resendRateLimited ? '#FFFBEB' : '#EFF6FF', border: `1px solid ${isAlreadyVerified ? '#BFDBFE' : resendRateLimited ? '#FDE68A' : '#BFDBFE'}`, borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            {resendSent ? (
              <p style={{ color: '#1D4ED8', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Mail size={16} /> Verification email sent — check your inbox.
              </p>
            ) : isAlreadyVerified ? (
              <p style={{ color: '#1D4ED8', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>ℹ️</span> This email is already verified. Please enter your password to log in.
              </p>
            ) : resendRateLimited ? (
              <div>
                <p style={{ color: '#92400E', margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>⏳</span> You've reached the resend limit (3 per hour). Please wait before requesting another link.
                </p>
                <p style={{ color: '#A16207', margin: 0, fontSize: '0.8rem' }}>Up to 3 resend requests allowed per hour.</p>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <p style={{ color: '#1D4ED8', margin: 0 }}>Please verify your email before logging in.</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendLoading}
                    style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', whiteSpace: 'nowrap', padding: 0 }}
                  >
                    {resendLoading ? 'Sending…' : 'Resend link'}
                  </button>
                </div>
                <p style={{ color: '#6B7280', margin: '0.35rem 0 0', fontSize: '0.8rem' }}>Up to 3 resend requests allowed per hour.</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com" 
              style={{
                width: '100%',
                padding: '0.8rem 1rem',
                borderRadius: '8px',
                border: '1px solid #ddd',
                fontSize: '1rem'
              }} 
            />
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 500 }}>Password</label>
              <Link to="/forgot-password" style={{ color: 'var(--warm-taupe)', fontSize: '0.9rem', textDecoration: 'none', fontWeight: 500 }}>Forgot password?</Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                style={{
                  width: '100%',
                  padding: '0.8rem 2.5rem 0.8rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  fontSize: '1rem'
                }} 
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
                  color: 'var(--muted-mauve)',
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
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Login'}
          </button>
        </form>

        <p style={{ marginTop: '2rem', color: 'var(--muted-mauve)' }}>
          Don't have an account? <Link to="/register" style={{ color: 'var(--warm-taupe)', fontWeight: 600 }}>Register here</Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
