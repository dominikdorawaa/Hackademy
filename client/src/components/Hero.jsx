import React from 'react';
import { Link } from 'react-router-dom';

const Hero = () => {
  return (
    <header className="hero">
      <div className="container">
        <div className="hero-grid">
          <div className="hero-content">
            <h1>Zdobywaj flagi.<br />Ucz się. Rywalizuj.</h1>
            <p>
              Platforma inspirowana CTF. Trenuj w realistycznych pokojach,
              rozwiązuj wyzwania i pnij się w rankingu. Dołącz do społeczności
              hakerów.
            </p>

            <div className="hero-buttons">
              <Link to="/register" className="btn btn-primary">Zacznij Naukę Za Darmo</Link>
            </div>

            <div className="stats-bar">
              <div className="stat-item">
                <span>1,200+</span>
                <small>Pokoi</small>
              </div>
              <div className="stat-item">
                <span>50k+</span>
                <small>Hakerów</small>
              </div>
              <div className="stat-item">
                <span>Codzienne</span>
                <small>Wyzwania</small>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="terminal-window">
              <div className="terminal-header">
                <div className="dot red"></div>
                <div className="dot yellow"></div>
                <div className="dot green"></div>
              </div>
              <div className="terminal-body">
                <p>&gt; init_hackademy.sh</p>
                <p>&gt; Łączenie z serwerem...</p>
                <p>
                  &gt; Access Granted
                  <span style={{ color: 'var(--primary-blue)' }}>[SECURE]</span>
                </p>
                <p>&gt; Wykryto nowego użytkownika.</p>
                <p>&gt; Gotowy do hackowania. <span className="cursor"></span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Hero;
