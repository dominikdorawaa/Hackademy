import React from 'react';
import './ConfirmationModal.css'; // We will create this CSS file

const ConfirmationModal = ({ message, isOpen, onConfirm, onCancel, confirmText = "Tak, odblokuj" }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <p>{message}</p>
        <div className="modal-actions">
          <button onClick={onConfirm} className="btn-confirm">{confirmText}</button>
          <button onClick={onCancel} className="btn-cancel">Anuluj</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;