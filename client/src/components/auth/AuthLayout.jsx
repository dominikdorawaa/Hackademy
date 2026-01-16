import React from 'react';
import '../../pages/Auth.css';

const AuthLayout = ({ children, title }) => {
  return (
    <div className="auth-container">
      <div className="auth-terminal">
        <div className="auth-terminal-header">
          <div className="dot red"></div>
          <div className="dot yellow"></div>
          <div className="dot green"></div>
          <div className="title">{title}</div>
        </div>
        <div className="auth-terminal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
