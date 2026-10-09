import React from 'react';

const Footer = () => {
  return (
    <footer>
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <span
              style={{
                fontFamily: "'JetBrains Mono'",
                fontWeight: 'bold',
                color: 'white',
              }}
            >
              Hackademy_
            </span>
            <span style={{ display: 'block', marginTop: '5px' }}>
              &copy; 2025 Hackademy Polska.
            </span>
          </div>
          <div className="footer-links">
            <a href="#">O nas</a>
            <a href="#">Regulamin</a>
            <a href="#">Prywatność</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
