import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const SettingsPage = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div>
            <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-light)' }}>Profil</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-gray)' }}>Nazwa użytkownika</label>
                <input 
                  type="text" 
                  value={user?.sub || ''} 
                  disabled 
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: 'var(--input-bg)', 
                    border: '1px solid var(--input-border)', 
                    borderRadius: '6px',
                    color: 'var(--text-light)',
                    cursor: 'not-allowed'
                  }} 
                />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-gray)', marginTop: '5px' }}>Nazwy użytkownika nie można zmienić.</p>
              </div>
              
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-gray)' }}>Bio</label>
                <textarea 
                  placeholder="Opowiedz coś o sobie..."
                  rows="4"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: 'var(--input-bg)', 
                    border: '1px solid var(--input-border)', 
                    borderRadius: '6px',
                    color: 'var(--text-light)'
                  }} 
                ></textarea>
                <button className="btn btn-primary" style={{ marginTop: '10px' }}>Zapisz zmiany</button>
              </div>
            </div>
          </div>
        );
      case 'appearance':
        return (
          <div>
            <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-light)' }}>Wygląd</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '15px', color: 'var(--text-gray)' }}>Motyw aplikacji</label>
                <div style={{ display: 'flex', gap: '20px' }}>
                  <button 
                    onClick={() => theme !== 'dark' && toggleTheme()}
                    style={{ 
                      flex: 1,
                      padding: '20px', 
                      backgroundColor: 'var(--bg-dark)', 
                      border: theme === 'dark' ? '2px solid var(--primary-blue)' : '1px solid var(--border-color)', 
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      color: 'var(--text-light)'
                    }}
                  >
                    <i className="fas fa-moon" style={{ fontSize: '1.5rem' }}></i>
                    <span>Ciemny</span>
                  </button>
                  <button 
                    onClick={() => theme !== 'light' && toggleTheme()}
                    style={{ 
                      flex: 1,
                      padding: '20px', 
                      backgroundColor: '#f3f4f6', 
                      border: theme === 'light' ? '2px solid var(--primary-blue)' : '1px solid var(--border-color)', 
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      color: '#1f2937'
                    }}
                  >
                    <i className="fas fa-sun" style={{ fontSize: '1.5rem', color: '#f59e0b' }}></i>
                    <span>Jasny</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div>
            <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-light)' }}>Bezpieczeństwo</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-gray)' }}>Zmiana hasła</label>
                <input 
                  type="password" 
                  placeholder="Obecne hasło"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: 'var(--input-bg)', 
                    border: '1px solid var(--input-border)', 
                    borderRadius: '6px',
                    color: 'var(--text-light)',
                    marginBottom: '10px'
                  }} 
                />
                <input 
                  type="password" 
                  placeholder="Nowe hasło"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: 'var(--input-bg)', 
                    border: '1px solid var(--input-border)', 
                    borderRadius: '6px',
                    color: 'var(--text-light)',
                    marginBottom: '10px'
                  }} 
                />
                <input 
                  type="password" 
                  placeholder="Potwierdź nowe hasło"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: 'var(--input-bg)', 
                    border: '1px solid var(--input-border)', 
                    borderRadius: '6px',
                    color: 'var(--text-light)'
                  }} 
                />
                <button className="btn btn-primary" style={{ marginTop: '15px' }}>Zmień hasło</button>
              </div>
            </div>
          </div>
        );
      case 'notifications':
        return (
          <div>
            <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-light)' }}>Powiadomienia</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', color: 'var(--text-light)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
                <span>Powiadomienia o wyzwaniach</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
                <span>Zaproszenia do znajomych</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: '18px', height: '18px' }} />
                <span>Newsletter</span>
              </label>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', color: 'var(--text-light)' }}>Ustawienia</h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '250px 1fr', 
        gap: '30px',
        minHeight: '500px'
      }}>
        {/* Sidebar */}
        <div style={{ 
          backgroundColor: 'var(--bg-panel)', 
          borderRadius: '12px',
          padding: '20px',
          height: 'fit-content',
          border: '1px solid var(--border-color)'
        }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: '10px' }}>
              <button 
                onClick={() => setActiveTab('profile')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 15px', 
                  backgroundColor: activeTab === 'profile' ? 'rgba(52, 152, 219, 0.1)' : 'transparent', 
                  color: activeTab === 'profile' ? 'var(--primary-blue)' : 'var(--text-gray)', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'profile' ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s'
                }}
              >
                <i className="fas fa-user"></i> Profil
              </button>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <button 
                onClick={() => setActiveTab('appearance')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 15px', 
                  backgroundColor: activeTab === 'appearance' ? 'rgba(52, 152, 219, 0.1)' : 'transparent', 
                  color: activeTab === 'appearance' ? 'var(--primary-blue)' : 'var(--text-gray)', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'appearance' ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s'
                }}
              >
                <i className="fas fa-paint-brush"></i> Wygląd
              </button>
            </li>
            <li style={{ marginBottom: '10px' }}>
              <button 
                onClick={() => setActiveTab('security')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 15px', 
                  backgroundColor: activeTab === 'security' ? 'rgba(52, 152, 219, 0.1)' : 'transparent', 
                  color: activeTab === 'security' ? 'var(--primary-blue)' : 'var(--text-gray)', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'security' ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s'
                }}
              >
                <i className="fas fa-lock"></i> Bezpieczeństwo
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('notifications')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 15px', 
                  backgroundColor: activeTab === 'notifications' ? 'rgba(52, 152, 219, 0.1)' : 'transparent', 
                  color: activeTab === 'notifications' ? 'var(--primary-blue)' : 'var(--text-gray)', 
                  border: 'none', 
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'notifications' ? 'bold' : 'normal',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.2s'
                }}
              >
                <i className="fas fa-bell"></i> Powiadomienia
              </button>
            </li>
          </ul>
        </div>

        {/* Content Area */}
        <div style={{ 
          backgroundColor: 'var(--bg-panel)', 
          borderRadius: '12px',
          padding: '30px',
          border: '1px solid var(--border-color)'
        }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
