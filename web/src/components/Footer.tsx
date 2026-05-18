import { Mail, Phone, MapPin, Globe, MessageCircle } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer style={{
      backgroundColor: 'var(--black)',
      color: 'var(--white)',
      padding: '4rem 0 2rem'
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '3rem',
          marginBottom: '3rem'
        }}>
          <div>
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--white)' }}>JD CAR RENTAL</h3>
            <p style={{ color: 'var(--muted-mauve)', lineHeight: '1.8' }}>
              Experience the freedom of self-drive with our premium fleet. 
              Safe, reliable, and luxury rentals for every journey.
            </p>
          </div>

          <div>
            <h4 style={{ marginBottom: '1.5rem' }}>Quick Links</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <li><a href="#" style={{ color: 'var(--muted-mauve)' }}>About Us</a></li>
              <li><a href="#" style={{ color: 'var(--muted-mauve)' }}>Our Fleet</a></li>
              <li><a href="#" style={{ color: 'var(--muted-mauve)' }}>Terms of Service</a></li>
              <li><a href="#" style={{ color: 'var(--muted-mauve)' }}>Privacy Policy</a></li>
            </ul>
          </div>

          <div>
            <h4 style={{ marginBottom: '1.5rem' }}>Contact Us</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--muted-mauve)' }}>
                <Phone size={18} />
                <span>+63 912 345 6789</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--muted-mauve)' }}>
                <Mail size={18} />
                <span>info@jdcarrental.com</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--muted-mauve)' }}>
                <MapPin size={18} />
                <span>123 Luxury Drive, Metro Manila, PH</span>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ marginBottom: '1.5rem' }}>Follow Us</h4>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <a href="#" style={{ color: 'var(--warm-taupe)' }}><Globe /></a>
              <a href="#" style={{ color: 'var(--warm-taupe)' }}><MessageCircle /></a>
            </div>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.1)',
          paddingTop: '2rem',
          textAlign: 'center',
          color: 'var(--muted-mauve)',
          fontSize: '0.9rem'
        }}>
          &copy; {new Date().getFullYear()} JD Car Rental Management System. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
