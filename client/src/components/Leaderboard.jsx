import React from 'react';
import { Link } from 'react-router-dom';

const Leaderboard = ({ players, showTitle = true, type = 'points', title = 'Top Hakerzy' }) => {
  const rankClasses = ['rank-1', 'rank-2', 'rank-3', 'rank-4'];

  return (
    <section className="leaderboard-section" id="leaderboard" style={{ padding: showTitle ? '80px 0' : '0' }}>
      <div className="container">
        {showTitle && (
          <>
            <h2 className="section-title" dangerouslySetInnerHTML={{ __html: title }}></h2>
            <p className="section-subtitle">
              Sprawdź, gdzie plasujesz się wśród elity cyberbezpieczeństwa.
            </p>
          </>
        )}
        
        {!showTitle && <h3 style={{ textAlign: 'center', marginBottom: '20px', color: type === 'elo' ? '#ff9800' : '#3498db' }}>{title}</h3>}

        <div className="leaderboard-cards">
          {players.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-gray)' }}>Brak graczy w rankingu.</p>
          ) : (
            players.map((player, index) => (
              <div key={index} className="leaderboard-card">
                <div className="card-left">
                  <div className={`rank-badge ${rankClasses[index] || rankClasses[3]}`}>{index + 1}</div>
                  <div
                    className="player-info"
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <div className="player-avatar">
                      <img
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.avatarSeed || player.username}`}
                        alt="Avatar"
                      />
                    </div>
                    <div className="player-details">
                      <Link to={`/profile/${player.username || player.name}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <h3 style={{ cursor: 'pointer' }}>{player.username || player.name}</h3>
                      </Link>
                      <p>{player.title || 'Gracz'}</p>
                    </div>
                  </div>
                </div>
                <div className="player-score">
                  <span>
                      {type === 'points' 
                          ? (player.points || player.score || 0).toLocaleString() 
                          : (player.elo || 500).toLocaleString()}
                  </span>
                  <small>{type === 'points' ? 'punktów' : 'ELO'}</small>
                </div>
              </div>
            ))
          )}
        </div>

        {showTitle && (
          <div style={{ textAlign: 'center' }}>
            <Link to="/register" className="btn btn-primary">Dołącz do Rankingu</Link>
          </div>
        )}
      </div>
    </section>
  );
};

export default Leaderboard;
