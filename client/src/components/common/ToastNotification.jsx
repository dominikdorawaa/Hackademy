import React, { useEffect } from 'react';

const ToastNotification = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000); // Auto close after 5 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? '#2ecc71' : '#e74c3c';
  const icon = type === 'success' ? 'fas fa-trophy' : 'fas fa-exclamation-circle';

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#1e1e1e',
      borderLeft: `5px solid ${bgColor}`,
      borderRadius: '4px',
      padding: '15px 20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      zIndex: 1000,
      animation: 'slideIn 0.3s ease-out'
    }}>
      <div style={{ 
        width: '30px', 
        height: '30px', 
        borderRadius: '50%', 
        backgroundColor: bgColor, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'white'
      }}>
        <i className={icon}></i>
      </div>
      <div>
        <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', color: 'white' }}>Nowa Odznaka!</h4>
        <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc' }}>{message}</p>
      </div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: '1rem' }}>
        <i className="fas fa-times"></i>
      </button>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default ToastNotification;
