import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const SettingsPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div>
            <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Profil</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Nazwa użytkownika</label>
                <input 
                  type="text" 
                  value={user?.sub || ''} 
                  disabled 
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: '#2d2d2d', 
                    border: '1px solid #444', 
                    borderRadius: '6px',
                    color: '#fff',
                    cursor: 'not-allowed'
                  }} 
                />
                <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '5px' }}>Nazwy użytkownika nie można zmienić.</p>
              </div>
              
              {/* Placeholder for Bio update - functionality exists in ProfilePage but could be moved here */}
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Bio</label>
                <textarea 
                  placeholder="Opowiedz coś o sobie..."
                  rows="4"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: '#0a0e1a', 
                    border: '1px solid #444', 
                    borderRadius: '6px',
                    color: '#fff'
                  }} 
                ></textarea>
                <button className="btn btn-primary" style={{ marginTop: '10px' }}>Zapisz zmiany</button>
              </div>
            </div>
          </div>
        );
      case 'security':
        return (
          <div>
            <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Bezpieczeństwo</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Zmiana hasła</label>
                <input 
                  type="password" 
                  placeholder="Obecne hasło"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: '#0a0e1a', 
                    border: '1px solid #444', 
                    borderRadius: '6px',
                    color: '#fff',
                    marginBottom: '10px'
                  }} 
                />
                <input 
                  type="password" 
                  placeholder="Nowe hasło"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: '#0a0e1a', 
                    border: '1px solid #444', 
                    borderRadius: '6px',
                    color: '#fff',
                    marginBottom: '10px'
                  }} 
                />
                <input 
                  type="password" 
                  placeholder="Potwierdź nowe hasło"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    backgroundColor: '#0a0e1a', 
                    border: '1px solid #444', 
                    borderRadius: '6px',
                    color: '#fff'
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
            <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid #333', paddingBottom: '10px' }}>Powiadomienia</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
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
      <h1 style={{ fontSize: '2.5rem', marginBottom: '30px' }}>Ustawienia</h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '250px 1fr', 
        gap: '30px',
        minHeight: '500px'
      }}>
        {/* Sidebar */}
        <div style={{ 
          backgroundColor: '#1e1e1e', 
          borderRadius: '12px',
          padding: '20px',
          height: 'fit-content',
          border: '1px solid #333'
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
                  color: activeTab === 'profile' ? '#3498db' : '#aaa', 
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
                onClick={() => setActiveTab('security')}
                style={{ 
                  width: '100%', 
                  textAlign: 'left', 
                  padding: '12px 15px', 
                  backgroundColor: activeTab === 'security' ? 'rgba(52, 152, 219, 0.1)' : 'transparent', 
                  color: activeTab === 'security' ? '#3498db' : '#aaa', 
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
                  color: activeTab === 'notifications' ? '#3498db' : '#aaa', 
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
          backgroundColor: '#1e1e1e', 
          borderRadius: '12px',
          padding: '30px',
          border: '1px solid #333'
        }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
