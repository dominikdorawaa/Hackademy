import React, { useEffect } from 'react';
import './SuccessModal.css';

const SuccessModal = ({ isOpen, onClose, points, message }) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
