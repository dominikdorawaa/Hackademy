import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer>
      <div className="hackademy-container">
        <div className="footer-content">
          <div className="footer-logo">
            <span className="footer-wordmark">
              Hackademy<span>_</span>
            </span>
            <span style={{ display: 'block', marginTop: '5px' }}>
              &copy; 2025 Hackademy Polska.
            </span>
          </div>
          <div className="footer-links">
            <a href="#">O nas</a>
            <Link to="/regulamin">Regulamin</Link>
            <Link to="/prywatnosc">Prywatność</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
