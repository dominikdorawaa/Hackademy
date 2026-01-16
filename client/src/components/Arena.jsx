import React from 'react';

const Arena = () => {
  return (
    <section className="arena-section" id="arena">
      <div className="container">
        <div className="arena-grid">
          <div className="arena-content">
            <h2>Wejdź na <span>Arenę</span></h2>
            <p style={{ color: 'var(--text-gray)', fontSize: '1.1rem' }}>
              Hackademy to nie tylko nauka, to rywalizacja. Sprawdź swoje
              umiejętności w bezpośrednich starciach z innymi graczami.
            </p>

            <div className="arena-features">
              <div className="arena-feature-item">
                <div className="af-icon"><i className="fas fa-users"></i></div>
                <div>
                  <h4>Rywalizuj przeciwko znajomym</h4>
                  <p>
                    Stwórz prywatne lobby i wyzwij przyjaciół na pojedynek. Kto
                    pierwszy znajdzie lukę w zabezpieczeniach i zdobędzie flagę
                    – wygrywa.
                  </p>
                </div>
              </div>

              <div className="arena-feature-item">
                <div className="af-icon"><i className="fas fa-medal"></i></div>
                <div>
                  <h4>Rankingi i Odznaki</h4>
                  <p>
                    Każde zwycięstwo przybliża Cię do awansu. Zbieraj unikalne
                    odznaki bojowe widoczne w Twoim profilu publicznym.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="elo-card-wrapper">
            <div className="elo-card">
              <span className="elo-badge">NOWOŚĆ: TRYB RANKINGOWY</span>

              <h3 style={{ marginBottom: '10px' }}>Pojedynki 1v1</h3>
              <p
                style={{
                  color: 'var(--text-gray)',
                  fontSize: '0.9rem',
                  marginBottom: '30px',
                }}
              >
                Pnij się w drabinie rankingowej ELO. System dobierze Ci
                przeciwnika o równym poziomie – wygrywa ten, kto szybciej
                przełamie zabezpieczenia systemu.
              </p>

              <div className="elo-stats">
                <span style={{ color: 'var(--primary-blue)' }}>TY (1240 ELO)</span>
                <span style={{ color: 'var(--primary-red)' }}>RIVAL (1255 ELO)</span>
              </div>

              <div className="matchup-visual">
                <div className="player-av p-blue">
                  <img
                    src="https://api.dicebear.com/7.x/pixel-art/svg?seed=You"
                    alt="Ty"
                  />
                </div>
                <div className="vs-icon">VS</div>
                <div className="player-av p-red">
                  <img
                    src="https://api.dicebear.com/7.x/pixel-art/svg?seed=Opponent"
                    alt="Rywal"
                  />
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  padding: '10px',
                  borderRadius: '6px',
                  marginBottom: '20px',
                }}
              >
                <p
                  style={{
                    fontSize: '0.8rem',
                    color: '#ccc',
                    fontFamily: "'JetBrains Mono'",
                  }}
                >
                  <i className="fas fa-terminal" style={{ marginRight: '5px' }}></i>
                  Mapa: Linux Privilege Esc.
                </p>
              </div>

              <button className="elo-btn">
                <i className="fas fa-search"></i> Znajdź Przeciwnika
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Arena;
