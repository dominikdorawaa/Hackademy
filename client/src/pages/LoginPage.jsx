import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/auth/AuthLayout';
import API_URL from '../apiConfig';

// Helper function to add delay
const delay = (ms) => new Promise(res => setTimeout(res, ms));

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginSequence, setLoginSequence] = useState([]);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.search.includes('registered=true')) {
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000); // Hide message after 3 seconds
    }
  }, [location]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setLoginSequence([]);

    try {
      setLoginSequence(prev => [...prev, '[INFO] Łączenie z serwerem uwierzytelniania...']);
      await delay(500);
      setLoginSequence(prev => [...prev, '[INFO] Weryfikacja poświadczeń...']);

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json(); // { "token": "..." }
        setLoginSequence(prev => [...prev, '[SUCCESS] Dostęp przyznany. Przekierowywanie...']);
        login(data.token); // Use the real token from the backend
        await delay(1000);
        navigate('/dashboard');
      } else {
        const errorMessage = await response.text();
        setLoginSequence(prev => [...prev, `[ERROR] ${errorMessage}`]);
        await delay(2000);
        setIsSubmitting(false);
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setLoginSequence(prev => [...prev, '[ERROR] Nie można połączyć z serwerem.']);
      await delay(2000);
      setIsSubmitting(false);
      setEmail('');
      setPassword('');
    }
  };

  return (
    <AuthLayout title="hackademy-login">
      {showSuccessMessage && (
        <div className="auth-success-message">
          Rejestracja pomyślna! Możesz się teraz zalogować.
        </div>
      )}
      {!isSubmitting ? (
        <form onSubmit={handleLoginSubmit}>
          <div className="auth-line">
            <span className="prompt">&gt; email:</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="auth-line">
            <span className="prompt">&gt; hasło:</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: 'fit-content', alignSelf: 'center' }}>
            Zaloguj
          </button>
          <div style={{textAlign: "center", marginTop: "1rem"}}> 
            <p>Nie masz konta? <Link to="/register" style={{color: "var(--primary-blue)"}}>Zarejestruj się</Link></p>
          </div>
        </form>
      ) : (
        <div>
          {loginSequence.map((line, index) => (
            <div key={index} className="auth-info-line">
              <span className={line.includes('SUCCESS') ? 'keyword-success' : line.includes('ERROR') ? 'keyword-error' : ''}>
                {line}
              </span>
            </div>
          ))}
        </div>
      )}
    </AuthLayout>
  );
};

export default LoginPage;