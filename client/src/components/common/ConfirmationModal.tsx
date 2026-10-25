import React from 'react';
import './ConfirmationModal.css';

const ConfirmationModal = ({ message, isOpen, onConfirm, onCancel, confirmText = "Tak, odblokuj" }: { message: string; isOpen: boolean; onConfirm: () => void; onCancel: () => void; confirmText?: string }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content px-panel">
        <p>{message}</p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel} className="px-button">Anuluj</button>
          <button type="button" onClick={onConfirm} className="px-button px-button--primary">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
