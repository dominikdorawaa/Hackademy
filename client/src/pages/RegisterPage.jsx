import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout';
import { useAuth } from '../context/AuthContext'; // Import useAuth

// Helper function to add delay
const delay = (ms) => new Promise(res => setTimeout(res, ms));

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registerSequence, setRegisterSequence] = useState([]);
  const navigate = useNavigate();
  const { login } = useAuth(); // Get login function from AuthContext

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setRegisterSequence([]);

    try {
      setRegisterSequence(prev => [...prev, '[INFO] Wysyłanie żądania do serwera...']);
      await delay(500);

      const response = await fetch('http://localhost:8080/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password }),
      });

      if (response.ok) {
        setRegisterSequence(prev => [...prev, '[INFO] Rejestrowanie w bazie danych...']);
        await delay(700);
        setRegisterSequence(prev => [...prev, '[SUCCESS] Konto pomyślnie utworzone.']);
        
        // Try to parse response as JSON (token)
        let responseData = null;
        try {
          responseData = await response.json();
        } catch {
          // Not JSON, continue without token
        }
        
        if (responseData && responseData.token) {
          // Auto-login with the token from registration
          setRegisterSequence(prev => [...prev, '[INFO] Automatyczne logowanie...']);
          await delay(500);
          login(responseData.token);
          await delay(500);
          navigate('/dashboard');
        } else {
          // Fallback: redirect to login page if no token
          await delay(1000);
          navigate('/login?registered=true');
        }
      } else {
        const errorMessage = await response.text();
        setRegisterSequence(prev => [...prev, `[ERROR] ${errorMessage}`]);
        await delay(3000);
        setIsSubmitting(false); // Reset form to allow user to try again
      }
    } catch (err) {
      setRegisterSequence(prev => [...prev, '[ERROR] Nie można połączyć z serwerem.']);
      await delay(3000);
      setIsSubmitting(false); // Reset form
    }
  };

  return (
    <AuthLayout title="hackademy-register">
      {!isSubmitting ? (
        <form onSubmit={handleRegisterSubmit}>
          <div className="auth-line">
            <span className="prompt">&gt; wpisz-nazwe:</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="auth-line">
            <span className="prompt">&gt; podaj-email:</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-line">
            <span className="prompt">&gt; ustaw-hasło:</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ marginTop: '1.5rem', width: 'fit-content', alignSelf: 'center' }}>
            Zarejestruj
          </button>
          <div style={{textAlign: "center", marginTop: "1rem"}}>
            <p>Masz już konto? <Link to="/login" style={{color: "var(--primary-blue)"}}>Zaloguj się</Link></p>
          </div>
        </form>
      ) : (
        <div>
          {registerSequence.map((line, index) => (
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

export default RegisterPage;