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
    navigate(`/rooms/${challenge.id}`);
  };

  return (
    <div className="room-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <div className="room-description-tooltip">
         <p>{challenge.shortDescription || challenge.description}</p>
      </div>
      <div className="room-image-placeholder">
        <span className={`difficulty-badge ${difficultyClass}`}>{difficultyTranslations[challenge.difficulty]}</span>
      </div>
      <div className="room-body">
        <h3 className="room-title">{challenge.title}</h3>
        <div className="room-tags">Web • Security</div>

        <div className="room-locked-footer" style={{ color: 'var(--text-gray)'}}>
            <span>
                <i className="fas fa-check-circle"></i> {challenge.solutionsCount || 0} rozwiązań
            </span>
            <span className="btn btn-primary" style={{ padding: '6px 16px', fontSize: '0.8rem' }}>
                Start
            </span>
        </div>
      </div>
    </div>
  );
};

export default CTFCard;
