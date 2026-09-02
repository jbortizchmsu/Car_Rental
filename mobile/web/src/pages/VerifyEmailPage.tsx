import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Car, CheckCircle2, AlertCircle, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { authApi } from '../services/api';

type Status = 'idle' | 'verifying' | 'success' | 'error';

const cardStyle: React.CSSProperties = {
  maxWidth: '480px',
  width: '100%',
  backgroundColor: 'white',
  padding: '3rem',
  borderRadius: '24px',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)',
  textAlign: 'center',
  border: '1px solid #F3F4F6',
};

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>(token ? 'idle' : 'error');
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendRateLimited, setResendRateLimited] = useState(false);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);

  // Auto-redirect to login when account is already verified
  useEffect(() => {
    if (!isAlreadyVerified) return;
    const timer = setTimeout(() => navigate('/login'), 2500);
    return () => clearTimeout(timer);
  }, [isAlreadyVerified, navigate]);

  // No useEffect — API is never called on mount.
  // The token is read from the URL and held in state until the user clicks the button.

  const handleVerify = async () => {
    if (!token) return;
    setStatus('verifying');
    try {
      await authApi.verifyEmail(token);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail) return;
    setResendLoading(true);
    setResendError(null);
    setResendRateLimited(false);
    try {
      await authApi.resendVerification(resendEmail);
      setResendSent(true);
    } catch (err: any) {
      const httpStatus = err?.response?.status;
      const code = err?.response?.data?.code;
      if (code === 'ALREADY_VERIFIED') {
        setIsAlreadyVerified(true);
        setResendError('This email is already verified. Redirecting you to login…');
      } else if (httpStatus === 429) {
        setResendRateLimited(true);
        setResendError(
          code === 'RESEND_RATE_LIMITED'
            ? "You've reached the resend limit (3 per hour). Please wait before requesting another verification email."
            : 'Too many attempts. Please wait before trying again.'
        );
      } else {
        setResendSent(true); // other errors: show success to avoid user enumeration
      }
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDFDFD', padding: '2rem' }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem', textDecoration: 'none' }}>
        <div style={{ backgroundColor: 'black', color: 'white', padding: '0.5rem', borderRadius: '12px' }}>
          <Car size={28} />
        </div>
        <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'black' }}>JD <span style={{ color: '#6B7280' }}>CAR RENTAL</span></span>
      </Link>

      {/* IDLE — user must click to trigger verification */}
      {status === 'idle' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#EFF6FF', padding: '1rem', borderRadius: '50%' }}>
              <ShieldCheck size={48} color="#3B82F6" />
            </div>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Verify Your Email Address</h2>
          <p style={{ color: '#6B7280', marginBottom: '2rem' }}>
            Click the button below to verify your email and activate your account.
          </p>
          <button
            onClick={handleVerify}
            className="btn-primary"
            style={{ padding: '0.875rem 2rem', fontSize: '1rem', borderRadius: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Verify My Email
          </button>
        </div>
      )}

      {/* VERIFYING — in-flight */}
      {status === 'verifying' && (
        <div style={cardStyle}>
          <Loader2 className="animate-spin" size={48} color="#3B82F6" style={{ margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Verifying…</h2>
          <p style={{ color: '#6B7280' }}>Please wait a moment.</p>
        </div>
      )}

      {/* SUCCESS */}
      {status === 'success' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#F0FDF4', padding: '1rem', borderRadius: '50%' }}>
              <CheckCircle2 size={48} color="#22C55E" />
            </div>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Email verified!</h2>
          <p style={{ color: '#6B7280', marginBottom: '2rem' }}>Your account is now active. You can log in.</p>
          <Link
            to="/login"
            className="btn-primary"
            style={{ display: 'inline-block', padding: '0.875rem 2rem', textDecoration: 'none', borderRadius: '12px' }}
          >
            Go to Login
          </Link>
        </div>
      )}

      {/* ERROR — invalid/expired token or no token in URL */}
      {status === 'error' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <div style={{ backgroundColor: '#FEF2F2', padding: '1rem', borderRadius: '50%' }}>
              <AlertCircle size={48} color="#EF4444" />
            </div>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.75rem' }}>Link invalid or expired</h2>
          <p style={{ color: '#6B7280', marginBottom: '2rem' }}>
            This verification link is invalid or has expired.<br />
            Request a new one below.
          </p>

          {resendSent ? (
            <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '1rem', color: '#166534', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
              <Mail size={18} /> Check your inbox — a new link has been sent.
            </div>
          ) : (
            <form onSubmit={handleResend} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {resendError && (
                <div style={{ backgroundColor: isAlreadyVerified ? '#EFF6FF' : resendRateLimited ? '#FFFBEB' : '#FEF2F2', border: `1px solid ${isAlreadyVerified ? '#BFDBFE' : resendRateLimited ? '#FDE68A' : '#FECACA'}`, borderRadius: '12px', padding: '0.875rem 1rem', color: isAlreadyVerified ? '#1D4ED8' : resendRateLimited ? '#92400E' : '#B91C1C', fontSize: '0.875rem', textAlign: 'left', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span>{isAlreadyVerified ? 'ℹ️' : resendRateLimited ? '⏳' : '⚠'}</span>
                  <span>{resendError}</span>
                </div>
              )}
              <input
                type="email"
                required
                placeholder="Enter your email address"
                value={resendEmail}
                onChange={e => setResendEmail(e.target.value)}
                style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid #E5E7EB', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }}
              />
              <button
                type="submit"
                disabled={resendLoading || isAlreadyVerified}
                className="btn-primary"
                style={{ padding: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
              >
                {resendLoading ? <Loader2 className="animate-spin" size={18} /> : 'Resend verification email'}
              </button>
              <p style={{ margin: '0.25rem 0 0', color: '#9CA3AF', fontSize: '0.75rem', textAlign: 'center' }}>
                You can request up to 3 verification emails per hour.
              </p>
            </form>
          )}

          <p style={{ marginTop: '1.5rem', color: '#9CA3AF', fontSize: '0.875rem' }}>
            <Link to="/login" style={{ color: '#6B7280', textDecoration: 'none', fontWeight: 600 }}>Back to login</Link>
          </p>
        </div>
      )}
    </div>
  );
};

export default VerifyEmailPage;
