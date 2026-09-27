import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, MapPin, Loader2, Save, CheckCircle2, AlertCircle, Eye, EyeOff, Lock } from 'lucide-react';
import { customerApi, authApi } from '../services/api';

// Mirrors server/src/lib/validation.ts's profileUpdateSchema — kept in sync manually,
// same as RegisterPage.tsx does for its own fields (no shared web/server validation module).
const FULL_NAME_MAX_LENGTH = 100;
const ADDRESS_MAX_LENGTH = 200;
const isValidPhoneNumber = (phone: string) => /^09\d{9}$/.test(phone);

const CustomerProfilePage: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    address: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Google-only accounts have no password yet (hasPassword: false) and get an "Add
  // Password" form instead of "Change Password". undefined (missing from an older
  // backend response, or if this were ever read from cached data) falls back to the
  // normal Change Password form, matching every account that already has a password.
  const [hasPassword, setHasPassword] = useState<boolean | undefined>(undefined);
  const [newPasswordToAdd, setNewPasswordToAdd] = useState('');
  const [confirmPasswordToAdd, setConfirmPasswordToAdd] = useState('');
  const [showNewPasswordToAdd, setShowNewPasswordToAdd] = useState(false);
  const [showConfirmPasswordToAdd, setShowConfirmPasswordToAdd] = useState(false);
  const [addPasswordError, setAddPasswordError] = useState('');
  const [addPasswordSuccess, setAddPasswordSuccess] = useState('');
  const [isAddingPassword, setIsAddingPassword] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const { data } = await customerApi.getProfile();
        setFormData({
          fullName: data.fullName || '',
          email: data.email || '',
          phoneNumber: data.phoneNumber || '',
          address: data.address || ''
        });
        setHasPassword(data.hasPassword);
      } catch (err) {
        setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmedFullName = formData.fullName.trim();
    const trimmedAddress = formData.address.trim();

    if (!isValidPhoneNumber(formData.phoneNumber)) {
      setError('Phone number must be 11 digits starting with 09 (e.g., 09123456789).');
      return;
    }

    try {
      setSaving(true);
      await customerApi.updateProfile({
        fullName: trimmedFullName,
        phoneNumber: formData.phoneNumber,
        address: trimmedAddress
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      setPasswordSuccess('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 5000);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      if (code === 'WRONG_CURRENT_PASSWORD') {
        setPasswordError('Your current password is incorrect.');
      } else {
        setPasswordError(err?.response?.data?.error || 'Failed to change password. Please try again.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleAddPassword = async () => {
    setAddPasswordError('');
    setAddPasswordSuccess('');

    if (!newPasswordToAdd || !confirmPasswordToAdd) {
      setAddPasswordError('New password and confirm password are required.');
      return;
    }
    if (!newPasswordToAdd.trim()) {
      setAddPasswordError('Password cannot be blank or whitespace only.');
      return;
    }
    if (newPasswordToAdd.length < 8) {
      setAddPasswordError('New password must be at least 8 characters.');
      return;
    }
    if (newPasswordToAdd.length > 72) {
      setAddPasswordError('New password must be at most 72 characters.');
      return;
    }
    if (newPasswordToAdd !== confirmPasswordToAdd) {
      setAddPasswordError('New passwords do not match.');
      return;
    }

    setIsAddingPassword(true);
    try {
      await authApi.setPassword({ newPassword: newPasswordToAdd, confirmPassword: confirmPasswordToAdd });
      setAddPasswordSuccess('Password added successfully. You can now also log in with your email and password.');
      setHasPassword(true);
      setNewPasswordToAdd('');
      setConfirmPasswordToAdd('');
      setTimeout(() => setAddPasswordSuccess(''), 5000);
    } catch (err: any) {
      setAddPasswordError(err?.response?.data?.error || 'Failed to add password. Please try again.');
    } finally {
      setIsAddingPassword(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '5rem' }}>
        <Loader2 className="animate-spin" size={48} color="var(--warm-taupe)" />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 0', maxWidth: '800px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Profile Settings</h1>
        <p style={{ color: 'var(--gray-500)' }}>Manage your personal information and contact details.</p>
      </div>

      <div className="card" style={{ padding: '2.5rem' }}>
        {error && (
          <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div style={{ backgroundColor: '#DCFCE7', color: '#16A34A', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 size={20} />
            Profile updated successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={16} /> Full Name
            </label>
            <input
              className="form-input"
              autoComplete="name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
              maxLength={FULL_NAME_MAX_LENGTH}
              placeholder="Enter your full name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={16} /> Email Address (Read-only)
            </label>
            <input
              className="form-input"
              autoComplete="email"
              value={formData.email}
              readOnly
              style={{ backgroundColor: 'var(--gray-50)', color: 'var(--gray-400)', cursor: 'not-allowed' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>Email cannot be changed for security reasons.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Phone size={16} /> Phone Number
              </label>
              <input
                type="tel"
                className="form-input"
                autoComplete="tel"
                value={formData.phoneNumber}
                inputMode="numeric"
                pattern="[0-9]{11}"
                maxLength={11}
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 11);
                  setFormData({ ...formData, phoneNumber: digitsOnly });
                }}
                required
                placeholder="09123456789"
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={16} /> Location
              </label>
              <input
                className="form-input"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                maxLength={ADDRESS_MAX_LENGTH}
                placeholder="City, Province"
              />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: '1rem', paddingTop: '2rem' }}>
            <h4 style={{ marginBottom: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lock size={16} /> Security
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {hasPassword === false ? (
                <>
                  {/* Google-only account: no password set yet */}
                  <p style={{ fontSize: '0.875rem', color: 'var(--gray-500)', margin: 0 }}>
                    You signed in with Google. Add a password so you can also log in with your email.
                  </p>

                  {/* New Password (Add) */}
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPasswordToAdd ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="form-input"
                        value={newPasswordToAdd}
                        onChange={(e) => setNewPasswordToAdd(e.target.value)}
                        placeholder="Enter new password (min 8 characters)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPasswordToAdd(!showNewPasswordToAdd)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}
                      >
                        {showNewPasswordToAdd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password (Add) */}
                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPasswordToAdd ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="form-input"
                        value={confirmPasswordToAdd}
                        onChange={(e) => setConfirmPasswordToAdd(e.target.value)}
                        placeholder="Re-enter new password"
                        style={confirmPasswordToAdd && newPasswordToAdd !== confirmPasswordToAdd ? { borderColor: '#DC2626', backgroundColor: '#FEF2F2' } : {}}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPasswordToAdd(!showConfirmPasswordToAdd)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}
                      >
                        {showConfirmPasswordToAdd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPasswordToAdd && newPasswordToAdd !== confirmPasswordToAdd && (
                      <span style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.25rem', display: 'block' }}>
                        Passwords do not match.
                      </span>
                    )}
                  </div>

                  {/* Add Password Error */}
                  {addPasswordError && (
                    <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '0.875rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', border: '1px solid #FECACA' }}>
                      <AlertCircle size={16} />
                      {addPasswordError}
                    </div>
                  )}

                  {/* Add Password Success */}
                  {addPasswordSuccess && (
                    <div style={{ backgroundColor: '#DCFCE7', color: '#16A34A', padding: '0.875rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', border: '1px solid #BBF7D0' }}>
                      <CheckCircle2 size={16} />
                      {addPasswordSuccess}
                    </div>
                  )}

                  {/* Add Password Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleAddPassword}
                      disabled={isAddingPassword || !newPasswordToAdd || !confirmPasswordToAdd}
                      style={{
                        padding: '0.7rem 1.5rem',
                        backgroundColor: 'var(--gray-800, #1f2937)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: isAddingPassword || !newPasswordToAdd || !confirmPasswordToAdd ? 'not-allowed' : 'pointer',
                        opacity: isAddingPassword || !newPasswordToAdd || !confirmPasswordToAdd ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {isAddingPassword ? (
                        <><Loader2 className="animate-spin" size={16} /> Adding...</>
                      ) : (
                        <><Lock size={16} /> Add Password</>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Current Password */}
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showCurrentPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="form-input"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter your current password"
                        style={passwordError && !currentPassword ? { borderColor: '#DC2626', backgroundColor: '#FEF2F2' } : {}}
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}
                      >
                        {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="form-input"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min 8 characters)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div className="form-group">
                    <label className="form-label">Confirm New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        className="form-input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter new password"
                        style={confirmPassword && newPassword !== confirmPassword ? { borderColor: '#DC2626', backgroundColor: '#FEF2F2' } : {}}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', display: 'flex', alignItems: 'center' }}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <span style={{ fontSize: '0.75rem', color: '#DC2626', marginTop: '0.25rem', display: 'block' }}>
                        Passwords do not match.
                      </span>
                    )}
                  </div>

                  {/* Password Error */}
                  {passwordError && (
                    <div style={{ backgroundColor: '#FEF2F2', color: '#DC2626', padding: '0.875rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', border: '1px solid #FECACA' }}>
                      <AlertCircle size={16} />
                      {passwordError}
                    </div>
                  )}

                  {/* Password Success */}
                  {passwordSuccess && (
                    <div style={{ backgroundColor: '#DCFCE7', color: '#16A34A', padding: '0.875rem 1rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', border: '1px solid #BBF7D0' }}>
                      <CheckCircle2 size={16} />
                      {passwordSuccess}
                    </div>
                  )}

                  {/* Change Password Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                      style={{
                        padding: '0.7rem 1.5rem',
                        backgroundColor: 'var(--gray-800, #1f2937)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: isChangingPassword || !currentPassword || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
                        opacity: isChangingPassword || !currentPassword || !newPassword || !confirmPassword ? 0.5 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {isChangingPassword ? (
                        <><Loader2 className="animate-spin" size={16} /> Changing...</>
                      ) : (
                        <><Lock size={16} /> Change Password</>
                      )}
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button 
              type="submit" 
              className="btn-brand" 
              disabled={saving}
              style={{ padding: '0.8rem 2rem' }}
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerProfilePage;
