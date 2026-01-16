import React, { useEffect } from 'react';
import './SuccessModal.css';

const SuccessModal = ({ isOpen, onClose, points, message }) => {
  if (!isOpen) return null;

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="success-modal-overlay" onClick={onClose}>
      <div className="success-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="success-icon-wrapper">
          <i className="fas fa-trophy success-icon"></i>
        </div>
        
        <h2 className="success-title">Gratulacje!</h2>
        <p className="success-message">{message || "Ukończyłeś wyzwanie!"}</p>
        
        <div className="points-display">
          <span className="points-label">Zdobyte Punkty</span>
          <div className="points-value">+{points}</div>
        </div>
        
        <button className="success-btn" onClick={onClose}>
          Kontynuuj
        </button>
      </div>
    </div>
  );
};

export default SuccessModal;
