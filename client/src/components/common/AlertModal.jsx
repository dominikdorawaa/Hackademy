import React from 'react';
import './AlertModal.css';

const AlertModal = ({ isOpen, onClose, message, type = 'success', subMessage }) => {
    if (!isOpen) return null;

    return (
        <div className="alert-modal-overlay">
            <div className={`alert-modal-content ${type}`}>
                <div className="alert-icon">
                    {type === 'success' && <i className="fas fa-check-circle"></i>}
                    {type === 'danger' && <i className="fas fa-ban"></i>}
                    {type === 'info' && <i className="fas fa-info-circle"></i>}
                </div>
                <div className="alert-body">
                    <h3>{message}</h3>
                    {subMessage && <p>{subMessage}</p>}
                </div>
                <button onClick={onClose} className="alert-close-btn">
                    <i className="fas fa-times"></i>
                </button>
            </div>
        </div>
    );
};

export default AlertModal;
