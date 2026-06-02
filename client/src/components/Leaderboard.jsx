import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

const Leaderboard = ({ players, showTitle = true, type = 'points', title = 'Top Hakerzy', currentUsername, myRank, guestLanding = false }) => {
  const cardsRef = useRef(null);
  const [cardsInView, setCardsInView] = useState(false);

  useEffect(() => {
    if (!guestLanding) return;
    const el = cardsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCardsInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [guestLanding]);

  const rankClasses = ['rank-1', 'rank-2', 'rank-3', 'rank-4'];

  // Check if current user is in the top list
  const isCurrentUserInTop = players.some(p => (p.username || p.name) === currentUsername);

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

        <div
          ref={cardsRef}
          className={`leaderboard-cards${guestLanding ? ` lb-stagger${cardsInView ? ' lb-stagger--inview' : ''}` : ''}`}
        >
          {players.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-gray)' }}>Brak graczy w rankingu.</p>
          ) : (
            players.map((player, index) => {
              const playerName = player.username || player.name;
              const isMe = currentUsername && playerName === currentUsername;
              const profileLink = guestLanding ? '/register' : (isMe ? '/profile' : `/profile/${playerName}`);

              return (
                <div key={index} className={`leaderboard-card ${isMe ? 'highlight-me' : ''}`} style={isMe ? { border: '1px solid var(--primary-blue)' } : {}}>
                  <div className="card-left">
                    <div className={`rank-badge ${rankClasses[index] || rankClasses[3]}`}>{index + 1}</div>
                    <div
                      className="player-info"
                      style={{ display: 'flex', alignItems: 'center' }}
                    >
                      <div className="player-avatar">
                        <img
                          src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${player.avatarSeed || playerName}`}
                          alt="Avatar"
                        />
                      </div>
                      <div className="player-details">
                        <Link to={profileLink} style={{ textDecoration: 'none', color: 'inherit' }}>
                          <h3 style={{ cursor: 'pointer' }}>
                            {playerName} {isMe && <span style={{ fontSize: '0.8rem', color: 'var(--primary-blue)', marginLeft: '5px' }}>(Ty)</span>}
                          </h3>
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
              );
            })
          )}

          {/* Show current user rank if not in top list and myRank is available */}
          {!isCurrentUserInTop && myRank && (
            <>
              <div style={{ textAlign: 'center', margin: '10px 0', color: '#666' }}>...</div>
              <div className="leaderboard-card highlight-me" style={{ border: '1px solid var(--primary-blue)', marginTop: '0' }}>
                <div className="card-left">
                  <div className="rank-badge rank-4" style={{ backgroundColor: '#333', color: '#aaa' }}>
                      {type === 'points' ? myRank.rankPoints : myRank.rankElo}
                  </div>
                  <div className="player-info" style={{ display: 'flex', alignItems: 'center' }}>
                    <div className="player-avatar">
                      <img
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${currentUsername}`}
                        alt="Avatar"
                      />
                    </div>
                    <div className="player-details">
                      <Link to="/profile" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <h3 style={{ cursor: 'pointer' }}>
                          {currentUsername} <span style={{ fontSize: '0.8rem', color: 'var(--primary-blue)', marginLeft: '5px' }}>(Ty)</span>
                        </h3>
                      </Link>
                      <p>Gracz</p>
                    </div>
                  </div>
                </div>
                <div className="player-score">
                  <span>
                      {type === 'points' 
                          ? myRank.points.toLocaleString() 
                          : myRank.elo.toLocaleString()}
                  </span>
                  <small>{type === 'points' ? 'punktów' : 'ELO'}</small>
                </div>
              </div>
            </>
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
