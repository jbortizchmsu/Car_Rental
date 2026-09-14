import React from 'react';

const sectionStyle: React.CSSProperties = { marginBottom: '2rem' };
const headingStyle: React.CSSProperties = { fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.75rem' };
const paraStyle: React.CSSProperties = { color: '#4B5563', lineHeight: 1.8, marginBottom: '0.75rem' };

const TermsOfServicePage: React.FC = () => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 2rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Terms of Service</h1>
      <p style={{ color: '#9CA3AF', marginBottom: '2.5rem', fontSize: '0.9rem' }}>Last updated: September 14, 2026</p>

      <div style={sectionStyle}>
        <p style={paraStyle}>
          These Terms of Service ("Terms") govern your use of the JD Car Rental website and mobile
          app to browse, book, and manage self-drive vehicle rentals. By creating an account or
          submitting a booking request, you agree to these Terms.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>1. Eligibility & Account Registration</h2>
        <p style={paraStyle}>
          You must provide accurate, current information when registering, including your full
          name, email, phone number, and address, and verify your email before logging in. You are
          responsible for keeping your account credentials confidential and for all activity under
          your account.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>2. Booking, Documents & Approval</h2>
        <p style={paraStyle}>
          To request a rental, you must submit a valid government-issued ID and driver's license
          (including license number and expiry date), which our staff reviews before approving your
          booking. We reserve the right to reject a booking if submitted documents are invalid,
          expired, illegible, or cannot be verified.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>3. Payments</h2>
        <p style={paraStyle}>
          Bookings may require a downpayment or full payment via GCash or cash, with proof of
          payment (screenshot/reference number) uploaded for verification. Any remaining balance is
          settled per the payment method confirmed at booking. Payments are subject to review and
          confirmation by our staff before a vehicle is released to you.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>4. Vehicle Use & GPS Monitoring</h2>
        <p style={paraStyle}>
          Once a vehicle is released to you, it is tracked via GPS for the duration of the active
          rental, for safety and to confirm the vehicle remains within its permitted operating area
          (geofence). Leaving an approved area may trigger an alert reviewed by our staff. You agree
          to operate the vehicle safely, in compliance with all applicable traffic laws, and to
          return it by the agreed date in the condition it was released, less normal wear.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>5. Damage, Loss & Liability</h2>
        <p style={paraStyle}>
          You are responsible for any damage to the vehicle occurring during your rental period
          beyond normal wear and tear, and for reporting any accident, damage, or mechanical issue
          promptly. Estimated repair or replacement costs may be charged to you following an
          inspection at return.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>6. Cancellations</h2>
        <p style={paraStyle}>
          You may cancel a pending booking request before it is approved and released. Cancellation
          terms for an already-confirmed or paid booking, including any applicable refund, will be
          communicated to you directly by our staff.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>7. Account Suspension</h2>
        <p style={paraStyle}>
          We may suspend or disable an account that provides false information, misuses a rented
          vehicle, fails to return a vehicle as agreed, or violates these Terms.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>8. Changes to These Terms</h2>
        <p style={paraStyle}>
          We may update these Terms from time to time. Continued use of the platform after an
          update constitutes acceptance of the revised Terms.
        </p>
      </div>

      <div style={sectionStyle}>
        <h2 style={headingStyle}>9. Contact Us</h2>
        <p style={paraStyle}>
          For questions about these Terms, contact us at{' '}
          <a href="mailto:info@jdcarrental.com" style={{ color: 'var(--warm-taupe)' }}>info@jdcarrental.com</a>.
        </p>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
