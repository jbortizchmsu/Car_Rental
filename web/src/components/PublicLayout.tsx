import React from 'react';
import Navbar from './Navbar';
import Footer from './Footer';

interface PublicLayoutProps {
  children: React.ReactNode;
}

const PublicLayout: React.FC<PublicLayoutProps> = ({ children }) => {
  return (
    <div className="public-layout">
      <Navbar />
      <main className="public-main">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
