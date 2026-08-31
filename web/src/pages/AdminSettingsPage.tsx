import React, { useEffect, useState } from 'react';
import { Settings, Shield, Bell, Save, Loader2, CreditCard } from 'lucide-react';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { settingsApi, getApiErrorMessage } from '../services/api';
import { useToast } from '../components/ToastProvider';

// Default settings values
const DEFAULT_SETTINGS = {
  general: {
    companyName: 'JD Car Rental',
    companyAddress: '',
    contactNumber: '',
    contactEmail: 'admin@jdcarrental.com',
    bookingWindowDays: 30,
    lateReturnGracePeriodHours: 1,
    defaultCurrency: 'PHP',
    businessHoursOpen: '08:00',
    businessHoursClose: '18:00',
    businessDays: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: false }
  },
  payments: {
    gcashNumber: ''
  },
  notifications: {
    enableOverdueAlerts: true,
    overdueAlertThresholdHours: 1,
    enablePickupDueAlerts: true,
    pickupDueAlertWindowHours: 24,
    enablePaymentSubmissionAlerts: true,
    enableGeofenceBreachAlerts: true,
    enableMaintenanceDueAlerts: true,
    maintenanceAlertThresholdKm: 500,
    enableGpsSignalLostAlerts: true,
    gpsSignalTimeoutMinutes: 15
  },
  security: {
    sessionTimeoutMinutes: 240, // 4 hours
    maxLoginAttempts: 5,
    requireStrongPasswords: true,
    allowMultipleAdminSessions: false
  }
};

type SettingsKey = keyof typeof DEFAULT_SETTINGS;

const AdminSettingsPage: React.FC = () => {
  const { setPageHeader } = usePageHeader();
  const toast = useToast();

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [gcashError, setGcashError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState<Record<SettingsKey, boolean>>({
    general: false,
    payments: false,
    notifications: false,
    security: false
  });

  useEffect(() => {
    setPageHeader({
      title: 'Settings',
      subtitle: 'Manage application configuration and company profile.',
    });
    return () => setPageHeader({});
  }, [setPageHeader]);

  const validateGcashNumber = (val: string) => {
    if (!val) return null;
    const phPhoneRegex = /^09\d{9}$/;
    if (!phPhoneRegex.test(val)) {
      return 'Invalid Philippine phone number format (must be 11 digits starting with 09, e.g. 09171234567)';
    }
    return null;
  };

  // Load settings from API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await settingsApi.getAll();
        const loadedSettings = response.data;

        // Merge loaded settings with defaults
        setSettings((prev) => {
          const merged = { ...prev };
          Object.entries(loadedSettings).forEach(([category, values]: any) => {
            if (merged[category as SettingsKey]) {
              merged[category as SettingsKey] = {
                ...merged[category as SettingsKey],
                ...values
              };
            }
          });
          return merged;
        });

        if (loadedSettings.payments?.gcashNumber) {
          setGcashError(validateGcashNumber(loadedSettings.payments.gcashNumber));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
        // Use defaults if load fails
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleGeneralSettingsChange = (field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, [field]: value }
    }));
    setHasChanges((prev) => ({ ...prev, general: true }));
  };

  const handlePaymentSettingsChange = (field: string, value: any) => {
    if (field === 'gcashNumber') {
      const err = validateGcashNumber(value);
      setGcashError(err);
    }
    setSettings((prev) => ({
      ...prev,
      payments: { ...prev.payments, [field]: value }
    }));
    setHasChanges((prev) => ({ ...prev, payments: true }));
  };

  const handleNotificationsChange = (field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [field]: value }
    }));
    setHasChanges((prev) => ({ ...prev, notifications: true }));
  };

  const handleSecurityChange = (field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      security: { ...prev.security, [field]: value }
    }));
    setHasChanges((prev) => ({ ...prev, security: true }));
  };

  const saveSection = async (section: SettingsKey) => {
    setSaving(section);
    try {
      const sectionSettings = settings[section];
      const keysToSave = Object.entries(sectionSettings).map(([key, value]) => ({
        key: `${section}.${key}`,
        value
      }));

      await settingsApi.updateSettings(keysToSave);
      setHasChanges((prev) => ({ ...prev, [section]: false }));
      toast.success('Settings saved', `${section} settings have been updated.`);
    } catch (error) {
      toast.error('Save failed', getApiErrorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  const handleBusinessDayToggle = (day: string) => {
    setSettings((prev) => ({
      ...prev,
      general: {
        ...prev.general,
        businessDays: {
          ...prev.general.businessDays,
          [day]: !prev.general.businessDays[day as keyof typeof prev.general.businessDays]
        }
      }
    }));
    setHasChanges((prev) => ({ ...prev, general: true }));
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Loader2 style={{ animation: 'spin 1s linear infinite', marginBottom: '1rem' }} size={40} />
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* General Settings */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'var(--soft-beige)', padding: '0.75rem', borderRadius: '12px' }}>
            <Settings size={24} color="var(--warm-taupe)" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>General Settings</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Company Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Company Name
            </label>
            <input
              type="text"
              className="form-input"
              value={settings.general.companyName}
              onChange={(e) => handleGeneralSettingsChange('companyName', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Contact Number -->
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Contact Number
            </label>
            <input
              type="tel"
              className="form-input"
              value={settings.general.contactNumber}
              onChange={(e) => handleGeneralSettingsChange('contactNumber', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Contact Email */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Contact Email
            </label>
            <input
              type="email"
              className="form-input"
              value={settings.general.contactEmail}
              onChange={(e) => handleGeneralSettingsChange('contactEmail', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Currency */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Default Currency
            </label>
            <select
              className="form-input"
              value={settings.general.defaultCurrency}
              onChange={(e) => handleGeneralSettingsChange('defaultCurrency', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            >
              <option value="PHP">Philippine Peso (PHP)</option>
              <option value="USD">US Dollar (USD)</option>
              <option value="EUR">Euro (EUR)</option>
            </select>
          </div>

          {/* Booking Window */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Booking Window (days)
            </label>
            <input
              type="number"
              className="form-input"
              value={settings.general.bookingWindowDays}
              onChange={(e) => handleGeneralSettingsChange('bookingWindowDays', Math.max(1, parseInt(e.target.value) || 0))}
              min="1"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Late Return Grace Period */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Late Return Grace Period (hours)
            </label>
            <input
              type="number"
              className="form-input"
              value={settings.general.lateReturnGracePeriodHours}
              onChange={(e) => handleGeneralSettingsChange('lateReturnGracePeriodHours', Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Business Hours Open */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Business Hours Open
            </label>
            <input
              type="time"
              className="form-input"
              value={settings.general.businessHoursOpen}
              onChange={(e) => handleGeneralSettingsChange('businessHoursOpen', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Business Hours Close */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Business Hours Close
            </label>
            <input
              type="time"
              className="form-input"
              value={settings.general.businessHoursClose}
              onChange={(e) => handleGeneralSettingsChange('businessHoursClose', e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>
        </div>

        {/* Company Address */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Company Address
          </label>
          <textarea
            className="form-input"
            value={settings.general.companyAddress}
            onChange={(e) => handleGeneralSettingsChange('companyAddress', e.target.value)}
            rows={4}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
          />
        </div>

        {/* Business Days */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>
            Business Days
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem' }}>
            {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
              <label key={day} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.general.businessDays[day as keyof typeof settings.general.businessDays]}
                  onChange={() => handleBusinessDayToggle(day)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>{day}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          className="btn btn-brand"
          onClick={() => saveSection('general')}
          disabled={!hasChanges.general || saving === 'general'}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: !hasChanges.general ? 0.5 : 1,
            cursor: !hasChanges.general ? 'not-allowed' : 'pointer'
          }}
        >
          {saving === 'general' ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
          Save Changes
        </button>
      </div>

      {/* Payment Settings */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'var(--soft-beige)', padding: '0.75rem', borderRadius: '12px' }}>
            <CreditCard size={24} color="var(--warm-taupe)" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Payment Settings</h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--gray-500)' }}>
              Configure payment account numbers and merchant credentials.
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '2rem', maxWidth: '480px' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            GCash Merchant / Payment Number
          </label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. 09171234567"
            value={settings.payments.gcashNumber}
            onChange={(e) => handlePaymentSettingsChange('gcashNumber', e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              borderRadius: '8px', 
              border: gcashError ? '1px solid #DC2626' : '1px solid var(--gray-200)',
              outline: gcashError ? '1px solid #DC2626' : undefined
            }}
          />
          {gcashError ? (
            <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: '0.4rem', fontWeight: 600 }}>
              {gcashError}
            </p>
          ) : (
            <p style={{ color: 'var(--gray-500)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
              Must be an 11-digit Philippine mobile number starting with 09.
            </p>
          )}
        </div>

        <button
          className="btn btn-brand"
          onClick={() => saveSection('payments')}
          disabled={!hasChanges.payments || saving === 'payments' || Boolean(gcashError)}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: (!hasChanges.payments || Boolean(gcashError)) ? 0.5 : 1,
            cursor: (!hasChanges.payments || Boolean(gcashError)) ? 'not-allowed' : 'pointer'
          }}
        >
          {saving === 'payments' ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
          Save Changes
        </button>
      </div>

      {/* Notifications Settings */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'var(--soft-beige)', padding: '0.75rem', borderRadius: '12px' }}>
            <Bell size={24} color="var(--warm-taupe)" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Notifications</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Toggle: Overdue Return Alerts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable Overdue Return Alerts</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>Alert when rental is overdue</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.enableOverdueAlerts}
              onChange={(e) => handleNotificationsChange('enableOverdueAlerts', e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            />
          </div>

          {/* Overdue Threshold */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Overdue Alert Threshold (hours)
            </label>
            <input
              type="number"
              value={settings.notifications.overdueAlertThresholdHours}
              onChange={(e) => handleNotificationsChange('overdueAlertThresholdHours', Math.max(0, parseInt(e.target.value) || 0))}
              min="0"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Toggle: Pickup Due Alerts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable Pickup Due Alerts</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>Alert before pickup</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.enablePickupDueAlerts}
              onChange={(e) => handleNotificationsChange('enablePickupDueAlerts', e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            />
          </div>

          {/* Pickup Window */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Pickup Due Alert Window (hours)
            </label>
            <input
              type="number"
              value={settings.notifications.pickupDueAlertWindowHours}
              onChange={(e) => handleNotificationsChange('pickupDueAlertWindowHours', Math.max(1, parseInt(e.target.value) || 0))}
              min="1"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Toggle: Payment Submission Alerts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable Payment Submission Alerts</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>Alert on payment submissions</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.enablePaymentSubmissionAlerts}
              onChange={(e) => handleNotificationsChange('enablePaymentSubmissionAlerts', e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            />
          </div>

          {/* Toggle: Geofence Breach Alerts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable Geofence Breach Alerts</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>Alert on zone violations</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.enableGeofenceBreachAlerts}
              onChange={(e) => handleNotificationsChange('enableGeofenceBreachAlerts', e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            />
          </div>

          {/* Toggle: Maintenance Due Alerts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable Maintenance Due Alerts</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>Alert when service is due</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.enableMaintenanceDueAlerts}
              onChange={(e) => handleNotificationsChange('enableMaintenanceDueAlerts', e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            />
          </div>

          {/* Maintenance Alert Threshold */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Maintenance Alert Threshold (km)
            </label>
            <input
              type="number"
              value={settings.notifications.maintenanceAlertThresholdKm}
              onChange={(e) => handleNotificationsChange('maintenanceAlertThresholdKm', Math.max(1, parseInt(e.target.value) || 0))}
              min="1"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Toggle: GPS Signal Lost Alerts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable GPS Signal Lost Alerts</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>Alert on signal loss</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications.enableGpsSignalLostAlerts}
              onChange={(e) => handleNotificationsChange('enableGpsSignalLostAlerts', e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            />
          </div>

          {/* GPS Signal Timeout */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              GPS Signal Timeout (minutes)
            </label>
            <input
              type="number"
              value={settings.notifications.gpsSignalTimeoutMinutes}
              onChange={(e) => handleNotificationsChange('gpsSignalTimeoutMinutes', Math.max(1, parseInt(e.target.value) || 0))}
              min="1"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>
        </div>

        <button
          className="btn btn-brand"
          onClick={() => saveSection('notifications')}
          disabled={!hasChanges.notifications || saving === 'notifications'}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: !hasChanges.notifications ? 0.5 : 1,
            cursor: !hasChanges.notifications ? 'not-allowed' : 'pointer'
          }}
        >
          {saving === 'notifications' ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
          Save Changes
        </button>
      </div>

      {/* Security & Access */}
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'var(--soft-beige)', padding: '0.75rem', borderRadius: '12px' }}>
            <Shield size={24} color="var(--warm-taupe)" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Security & Access</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          {/* Session Timeout */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Session Timeout
            </label>
            <select
              value={settings.security.sessionTimeoutMinutes}
              onChange={(e) => handleSecurityChange('sessionTimeoutMinutes', parseInt(e.target.value))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            >
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={240}>4 hours</option>
              <option value={480}>8 hours</option>
              <option value={999999}>Never</option>
            </select>
          </div>

          {/* Max Login Attempts */}
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Max Login Attempts
            </label>
            <input
              type="number"
              value={settings.security.maxLoginAttempts}
              onChange={(e) => handleSecurityChange('maxLoginAttempts', Math.max(1, parseInt(e.target.value) || 0))}
              min="1"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--gray-200)' }}
            />
          </div>

          {/* Toggle: Strong Passwords */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Require Strong Passwords</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>Min 8 chars, mixed case, numbers</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.requireStrongPasswords}
              onChange={(e) => handleSecurityChange('requireStrongPasswords', e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            />
          </div>

          {/* Toggle: Multiple Admin Sessions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Allow Multiple Admin Sessions</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--gray-500)', margin: '0.25rem 0 0 0' }}>One session per admin if disabled</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.allowMultipleAdminSessions}
              onChange={(e) => handleSecurityChange('allowMultipleAdminSessions', e.target.checked)}
              style={{ cursor: 'pointer', width: '20px', height: '20px' }}
            />
          </div>
        </div>

        <button
          className="btn btn-brand"
          onClick={() => saveSection('security')}
          disabled={!hasChanges.security || saving === 'security'}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: !hasChanges.security ? 0.5 : 1,
            cursor: !hasChanges.security ? 'not-allowed' : 'pointer'
          }}
        >
          {saving === 'security' ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={18} />}
          Save Changes
        </button>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
