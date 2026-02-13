import React from 'react';
import { useNavigate } from 'react-router-dom';

const CTFCard = ({ challenge }) => {
  const navigate = useNavigate();

  const difficultyClass = {
    'EASY': 'diff-easy',
    'MEDIUM': 'diff-medium',
    'HARD': 'diff-hard',
    'INSANE': 'diff-insane',
  }[challenge.difficulty] || 'diff-easy';

  const difficultyTranslations = {
    'EASY': 'Łatwy',
    'MEDIUM': 'Średni',
    'HARD': 'Trudny',
    'INSANE': 'Niemożliwy',
  };

  const handleCardClick = () => {
    if (!challenge.locked) {
        navigate(`/rooms/${challenge.id}`);
    }
  };

  // Determine lock message
  let lockMessage = 'Ukończ "Tutorial VM", aby odblokować.';
  if (challenge.requiresVpn) {
      lockMessage = 'Ukończ "Tutorial VPN", aby odblokować.';
  }

  return (
    <div 
        className={`room-card ${challenge.locked ? 'locked' : ''}`} 
        onClick={handleCardClick} 
        style={{ cursor: challenge.locked ? 'not-allowed' : 'pointer', opacity: challenge.locked ? 0.7 : 1 }}
    >
      {challenge.locked && (
          <div className="room-top-badge" style={{ backgroundColor: '#e74c3c' }}>
              <i className="fas fa-lock"></i>
          </div>
      )}
      
      <div className="room-description-tooltip">
         <p>{challenge.locked ? lockMessage : (challenge.shortDescription || challenge.description)}</p>
      </div>
      <div className="room-image-placeholder">
        <span className={`difficulty-badge ${difficultyClass}`}>{difficultyTranslations[challenge.difficulty]}</span>
        
        {/* VPN Badge */}
        <div 
            className="vpn-badge" 
            style={{ 
                position: 'absolute', 
                top: '10px', 
                left: '10px', 
                backgroundColor: 'rgba(0,0,0,0.6)', 
                padding: '4px 8px', 
                borderRadius: '4px',
                color: challenge.requiresVpn ? '#2ecc71' : '#e74c3c',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                border: `1px solid ${challenge.requiresVpn ? '#2ecc71' : '#e74c3c'}`,
                zIndex: 2
            }}
            title={challenge.requiresVpn ? "Wymaga połączenia VPN" : "Nie wymaga VPN"}
        >
            {challenge.requiresVpn ? (
                <>
                    <i className="fas fa-network-wired"></i> VPN
                </>
            ) : (
                <>
                    <i className="fas fa-ban"></i> VPN
                </>
            )}
        </div>
      </div>
      <div className="room-body">
        <h3 className="room-title">{challenge.title}</h3>
        <div className="room-tags">{challenge.category || 'Web'} • Security</div>

        <div className="room-locked-footer" style={{ color: 'var(--text-gray)'}}>
            <span>
                <i className="fas fa-check-circle"></i> {challenge.solutionsCount || 0} rozwiązań
            </span>
            {challenge.locked ? (
                <span className="btn" style={{ padding: '6px 16px', fontSize: '0.8rem', backgroundColor: '#555', color: '#aaa', border: '1px solid #444' }}>
                    Zablokowane
                </span>
            ) : (
                <span className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem' }}>
                    Start
                </span>
            )}
        </div>
      </div>
    </div>
  );
};

export default CTFCard;
