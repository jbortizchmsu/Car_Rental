import React from 'react';

const sectionStyle: React.CSSProperties = { marginBottom: '2rem' };
const headingStyle: React.CSSProperties = { fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem' };
const paraStyle: React.CSSProperties = { color: '#4B5563', lineHeight: 1.8, marginBottom: '0.75rem' };

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Privacy Policy</h1>
      <p style={{ color: '#9CA3AF', marginBottom: '2.5rem', fontSize: '0.9rem' }}>Last updated: September 14, 2026</p>

      <div style={sectionStyle}>
        <p style={paraStyle}>
          JD Car Rental ("we", "us", "our") operates a self-drive vehicle rental booking platform.
          This Privacy Policy explains what personal information we collect when you use our
          website and mobile app, why we collect it, how we use and protect it, and the choices
          and rights you have regarding your data.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. Information We Collect</h2>
        <p style={paraStyle}>When you register an account, book a vehicle, or complete a rental with us, we collect:</p>
        <ul style={{ color: '#4B5563', lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li><strong>Account information:</strong> full name, email address, phone number, and home address, provided when you register.</li>
          <li><strong>Booking details:</strong> your contact number, address, emergency contact name and phone number, and (where applicable) your intended destination, provided when you request a rental.</li>
          <li><strong>Identity and license documents:</strong> a valid government-issued ID and a driver's license, including your license number and expiry date, uploaded to verify your eligibility to rent and drive.</li>
          <li><strong>Payment proof:</strong> images or reference numbers you submit to confirm GCash or other payments (we do not collect or store your card or bank account numbers — payment proof is a receipt/screenshot you upload).</li>
          <li><strong>GPS location data:</strong> collected from the rented vehicle (via the renter's device during an active rental) only while a rental is active — from vehicle release until return — used for trip tracking, geofence/boundary enforcement, and safety monitoring.</li>
          <li><strong>Sign-in method:</strong> if you use "Sign in with Google," we receive your verified Google email address and name from Google; we never receive or store your Google password.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. How We Use Your Information</h2>
        <p style={paraStyle}>We use the information above to:</p>
        <ul style={{ color: '#4B5563', lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Create and manage your account, and verify your identity and driving eligibility before approving a booking.</li>
          <li>Process bookings, payments, and vehicle pickup/return.</li>
          <li>Track vehicle location during an active rental for safety, boundary/geofence enforcement, and trip records.</li>
          <li>Send booking-related notifications (approvals, pickup reminders, payment confirmations, return notices) by email or in-app notification.</li>
          <li>Investigate damage reports, disputes, or misuse of a rented vehicle.</li>
          <li>Comply with legal, insurance, and law-enforcement obligations where required.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. Data Retention & Security</h2>
        <p style={paraStyle}>
          We retain booking, document, and payment records for as long as needed to support your
          account, resolve disputes, and meet our legal/accounting obligations. GPS location data
          is retained as part of your trip history and is only actively collected while a rental
          is in progress.
        </p>
        <p style={paraStyle}>
          Identity documents and payment proof images are stored in access-controlled, private
          cloud storage — they are not publicly accessible by URL, and are only retrievable through
          authenticated requests by you or authorized JD Car Rental staff. Passwords are never
          stored in plain text (they are hashed); if you use Google Sign-In, we never receive or
          store your Google password at all.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. Who Can Access Your Information</h2>
        <p style={paraStyle}>
          Your information is accessible only to you and to authorized JD Car Rental administrative
          staff who need it to process your booking, verify documents, confirm payments, or provide
          support. We do not sell your personal information to third parties. We may share limited
          information with payment processors, our email delivery provider, or law enforcement
          where legally required.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. Your Rights</h2>
        <p style={paraStyle}>You may:</p>
        <ul style={{ color: '#4B5563', lineHeight: 1.8, paddingLeft: '1.5rem' }}>
          <li>Access and update your profile information (name, phone, address) at any time from your account.</li>
          <li>Request a copy of the personal information we hold about you.</li>
          <li>Request correction or deletion of your account and associated data, subject to any records we must legally retain (e.g. completed booking/payment history).</li>
          <li>Withdraw consent to future GPS tracking by not proceeding with an active rental; note that GPS tracking during an active rental is required for vehicle safety and boundary enforcement and cannot be disabled while a rental is in progress.</li>
        </ul>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. Contact Us</h2>
        <p style={paraStyle}>
          For any questions about this Privacy Policy or to exercise your data rights, contact us at{' '}
          <a href="mailto:info@jdcarrental.com" style={{ color: 'var(--warm-taupe)' }}>info@jdcarrental.com</a>.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
