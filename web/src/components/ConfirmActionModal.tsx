import React, { type ReactNode } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2, X } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'warning' | 'success' | 'default';

export interface ReasonInputConfig {
  label: string;
  placeholder?: string;
  minLength?: number;
  value: string;
  onChange: (val: string) => void;
}

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string | ReactNode;
  details?: ReactNode; // Optional detailed summary box
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  reasonInput?: ReasonInputConfig; // Optional mandatory reason textarea
}

const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  isOpen,
  title,
  message,
  details,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  error = null,
  onConfirm,
  onCancel,
  reasonInput
}) => {
  if (!isOpen) return null;

  // Map variant to styles and icons
  let icon = <Info size={28} color="#0284C7" />;
  let iconBg = '#E0F2FE';
  let confirmBtnClass = 'btn-primary';
  let confirmBtnStyle: React.CSSProperties = {};

  switch (variant) {
    case 'danger':
      icon = <AlertCircle size={28} color="#DC2626" />;
      iconBg = '#FEE2E2';
      confirmBtnClass = 'btn-danger';
      break;
    case 'warning':
      icon = <AlertTriangle size={28} color="#D97706" />;
      iconBg = '#FEF3C7';
      confirmBtnClass = 'btn-primary'; // Still black/dark for warnings, just distinct icon
      confirmBtnStyle = { backgroundColor: '#B45309' };
      break;
    case 'success':
      icon = <CheckCircle2 size={28} color="#16A34A" />;
      iconBg = '#DCFCE7';
      confirmBtnClass = 'btn-primary';
      confirmBtnStyle = { backgroundColor: '#16A34A' };
      break;
    default:
      icon = <Info size={28} color="var(--black)" />;
      iconBg = 'var(--gray-100)';
      confirmBtnClass = 'btn-primary';
      break;
  }

  // Handle escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [loading, onCancel]);

  return (
    <div className="confirm-modal-backdrop" onClick={!loading ? onCancel : undefined}>
      <div 
        className="confirm-modal" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <button 
          className="confirm-modal-close" 
          onClick={!loading ? onCancel : undefined}
          disabled={loading}
          aria-label="Close modal"
        >
          <X size={20} />
        </button>

        <div className="confirm-modal-content">
          <div className="confirm-modal-icon" style={{ backgroundColor: iconBg }}>
            {icon}
          </div>
          <div className="confirm-modal-text">
            <h3 id="confirm-modal-title" className="confirm-modal-title">{title}</h3>
            <div className="confirm-modal-message">{message}</div>
          </div>
        </div>

        {details && (
          <div className="confirm-modal-details">
            {details}
          </div>
        )}

        {reasonInput && (
          <div style={{ padding: '0 1.5rem 0.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {reasonInput.label}
            </label>
            <textarea
              value={reasonInput.value}
              onChange={(e) => reasonInput.onChange(e.target.value)}
              placeholder={reasonInput.placeholder}
              rows={3}
              disabled={loading}
              style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--gray-200)', padding: '0.75rem', fontSize: '0.875rem', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
            />
            {reasonInput.minLength && (
              <p style={{ fontSize: '0.75rem', color: reasonInput.value.trim().length < reasonInput.minLength ? '#DC2626' : 'var(--gray-400)', marginTop: '0.3rem' }}>
                {reasonInput.value.trim().length} / {reasonInput.minLength} characters minimum
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="confirm-modal-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className="confirm-modal-footer">
          <button 
            type="button"
            className="confirm-modal-cancel" 
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-modal-confirm ${confirmBtnClass}`}
            style={confirmBtnStyle}
            onClick={onConfirm}
            disabled={loading || (reasonInput ? reasonInput.value.trim().length < (reasonInput.minLength ?? 1) : false)}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" style={{ marginRight: '0.5rem' }} />
                Processing...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
