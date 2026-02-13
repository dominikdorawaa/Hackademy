import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, logout, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [userData, setUserData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [processedNotifications, setProcessedNotifications] = useState([]); // Track processed IDs
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (isAuthenticated && token) {
        try {
          const response = await fetch(`${API_URL}/api/user/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setUserData(data);
          } else {
            logout();
          }
        } catch (error) {
          console.error("Failed to fetch user data", error);
          logout();
        }
      }
    };
    fetchUserData();
  }, [isAuthenticated, token, logout, location.pathname]);

  // Fetch notifications (friend requests and challenges)
  useEffect(() => {
    const fetchNotifications = async () => {
      if (isAuthenticated && token) {
        try {
          // Fetch friend requests
          const friendsRes = await fetch(`${API_URL}/api/friends/requests`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const friendRequests = await friendsRes.json();

          // Fetch challenges
          const challengesRes = await fetch(`${API_URL}/api/arena/challenges`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const challenges = await challengesRes.json();

          // Combine and format notifications
          const formattedFriendReqs = friendRequests.map(req => ({
            id: req.id,
            type: 'FRIEND_REQUEST',
            from: req.requesterUsername,
            timestamp: new Date().toISOString(), 
            data: req
          }));

          const formattedChallenges = challenges.map(ch => ({
            id: ch.id,
            type: 'CHALLENGE',
            from: ch.challengerUsername,
            timestamp: ch.createdAt,
            data: ch
          }));

          const allNotifications = [...formattedFriendReqs, ...formattedChallenges];
          setNotifications(allNotifications);
          setUnreadCount(allNotifications.length);

        } catch (error) {
          console.error("Failed to fetch notifications", error);
        }
      }
    };

    if (isAuthenticated && token) {
      fetchNotifications();
      // Poll every 10 seconds
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
    navigate('/');
  };

  const handleAcceptFriend = async (requestId) => {
    if (processedNotifications.includes(`FRIEND_REQUEST-${requestId}`)) return;
    setProcessedNotifications(prev => [...prev, `FRIEND_REQUEST-${requestId}`]);

    try {
        await fetch(`${API_URL}/api/friends/accept/${requestId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Remove from list after success
        setNotifications(prev => prev.filter(n => !(n.type === 'FRIEND_REQUEST' && n.id === requestId)));
        setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
        console.error(err);
        // Remove from processed if failed to allow retry? Or keep it to prevent spam?
        // Keeping it processed for now to update UI state
    }
  };

  const handleRejectFriend = async (requestId) => {
    if (processedNotifications.includes(`FRIEND_REQUEST-${requestId}`)) return;
    setProcessedNotifications(prev => [...prev, `FRIEND_REQUEST-${requestId}`]);

    try {
        await fetch(`${API_URL}/api/friends/reject/${requestId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setNotifications(prev => prev.filter(n => !(n.type === 'FRIEND_REQUEST' && n.id === requestId)));
        setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
        console.error(err);
    }
  };

  const handleAcceptChallenge = async (challengeId) => {
    if (processedNotifications.includes(`CHALLENGE-${challengeId}`)) return;
    setProcessedNotifications(prev => [...prev, `CHALLENGE-${challengeId}`]);

    try {
        const res = await fetch(`${API_URL}/api/arena/challenge/${challengeId}/accept`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const session = await res.json();
            
            setIsNotificationsOpen(false);
            // Remove from list
            setNotifications(prev => prev.filter(n => !(n.type === 'CHALLENGE' && n.id === challengeId)));
            setUnreadCount(prev => Math.max(0, prev - 1));
            
            // Force full page reload to ensure clean state and navigation
            window.location.href = `/rooms/${session.roomId}?arena=${session.id}`;
        }
    } catch (err) {
        console.error(err);
    }
  };

  const handleRejectChallenge = async (challengeId) => {
    if (processedNotifications.includes(`CHALLENGE-${challengeId}`)) return;
    setProcessedNotifications(prev => [...prev, `CHALLENGE-${challengeId}`]);

    try {
        await fetch(`${API_URL}/api/arena/challenge/${challengeId}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        setNotifications(prev => prev.filter(n => !(n.type === 'CHALLENGE' && n.id === challengeId)));
        setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
        console.error(err);
    }
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  return (
    <nav className="navbar">
      <div className="container">
        <div className="nav-content">
          <Link to="/" className="logo" onClick={() => window.scrollTo(0, 0)}>
            <img
              src="/biale_hackademy_logo.png"
              alt="Hackademy Logo"
              style={{ height: '40px', width: 'auto' }}
            />
          </Link>
          {!isAuthPage && (
            <div className="nav-links">
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard">Pokoje CTF</Link>
                  <Link to="/arena">Tryb Rankingowy</Link>
                  <Link to="/ranking">Ranking</Link>
                  <Link to="/vpn" style={{ color: '#3498db' }}>VPN</Link>
                </>
              ) : (
                <>
                  <Link to="/" className="active" onClick={() => window.scrollTo(0, 0)}>Start</Link>
                  <a href="/#rooms">Pokoje</a>
                  <a href="/#arena">Tryb Rankingowy</a>
                  <a href="/#leaderboard">Ranking</a>
                </>
              )}
            </div>
          )}
          <div className="nav-auth">
            {isAuthenticated && userData ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                
                {/* Notifications Bell */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <div 
                        className="nav-icon-wrapper"
                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    >
                        <i className="fas fa-bell"></i>
                        {unreadCount > 0 && <span className="notification-badge"></span>}
                    </div>

                    {isNotificationsOpen && (
                        <div className="notifications-dropdown">
                            <div className="notifications-header">
                                <h3>Powiadomienia</h3>
                                {unreadCount > 0 && (
                                    <span className="notifications-count-badge">{unreadCount} nowe</span>
                                )}
                            </div>
                            
                            {notifications.length === 0 ? (
                                <div className="notifications-empty">
                                    <i className="far fa-bell-slash"></i>
                                    <span>Brak nowych powiadomień</span>
                                </div>
                            ) : (
                                <ul className="notifications-list">
                                    {notifications.map(notif => {
                                        const isProcessed = processedNotifications.includes(`${notif.type}-${notif.id}`);
                                        return (
                                            <li key={`${notif.type}-${notif.id}`} className="notification-item">
                                                <div className="notification-content">
                                                    <div className="notification-avatar">
                                                        <img 
                                                            src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${notif.from}`} 
                                                            alt="Avatar" 
                                                            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #333' }} 
                                                        />
                                                    </div>
                                                    <div className="notification-text-wrapper">
                                                        <p className="notification-message">
                                                            <strong>{notif.from}</strong>
                                                            {notif.type === 'CHALLENGE' ? ' wyzywa Cię na pojedynek!' : ' wysłał zaproszenie.'}
                                                        </p>
                                                        <span className="notification-type">
                                                            {notif.type === 'CHALLENGE' ? 'Tryb Rankingowy' : 'Znajomi'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="notification-actions">
                                                    {isProcessed ? (
                                                        <span style={{ color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic' }}>Przetwarzanie...</span>
                                                    ) : (
                                                        <>
                                                            <button 
                                                                onClick={() => notif.type === 'CHALLENGE' ? handleAcceptChallenge(notif.id) : handleAcceptFriend(notif.id)}
                                                                className="btn-notif btn-notif-accept"
                                                            >
                                                                <i className="fas fa-check"></i> Akceptuj
                                                            </button>
                                                            <button 
                                                                onClick={() => notif.type === 'CHALLENGE' ? handleRejectChallenge(notif.id) : handleRejectFriend(notif.id)}
                                                                className="btn-notif btn-notif-reject"
                                                            >
                                                                <i className="fas fa-times"></i> Odrzuć
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                {/* Streak Counter */}
                <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '5px', 
                    color: '#ff9800', 
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    padding: '5px 10px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 152, 0, 0.3)'
                }} title="Dni z rzędu">
                    <i className="fas fa-fire"></i>
                    <span>{userData.streak || 0}</span>
                </div>

                <div ref={menuRef} style={{ position: 'relative' }}>
                  <img 
                    src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${userData.username}`}
                    alt="User Avatar"
                    className="avatar" 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      border: '2px solid var(--primary-blue)'
                    }}
                  />
                  {isMenuOpen && (
                    <div className="profile-dropdown" style={{
                      position: 'absolute',
                      top: '55px',
                      right: 0,
                      backgroundColor: 'var(--bg-panel)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      width: '220px',
                      padding: '8px',
                      zIndex: 100,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}>
                      <div className="dropdown-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
                        <p style={{ margin: 0, fontWeight: 'bold', color: 'white' }}>{userData.username}</p>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-gray)' }}>{userData.email}</p>
                      </div>
                      <ul style={{ listStyle: 'none', padding: '8px 0 0 0', margin: 0 }}>
                        <li className="dropdown-item">
                          <Link to="/profile" onClick={() => setIsMenuOpen(false)}>
                            <i className="fas fa-user-circle" style={{ marginRight: '10px', width: '15px' }}></i>
                            <span>Profil</span>
                          </Link>
                        </li>
                        <li className="dropdown-item">
                          <Link to="/friends" onClick={() => setIsMenuOpen(false)}>
                            <i className="fas fa-users" style={{ marginRight: '10px', width: '15px' }}></i>
                            <span>Znajomi</span>
                          </Link>
                        </li>
                        {userData.role === 'ADMIN' && (
                          <li className="dropdown-item">
                            <Link to="/admin" onClick={() => setIsMenuOpen(false)}>
                              <i className="fas fa-user-shield" style={{ marginRight: '10px', width: '15px' }}></i>
                              <span>Panel Admina</span>
                            </Link>
                          </li>
                        )}
                        {userData.role === 'EXPERT' && (
                          <li className="dropdown-item">
                            <Link to="/expert" onClick={() => setIsMenuOpen(false)}>
                              <i className="fas fa-user-graduate" style={{ marginRight: '10px', width: '15px' }}></i>
                              <span>Panel Eksperta</span>
                            </Link>
                          </li>
                        )}
                        <li className="dropdown-item">
                          <button onClick={handleLogout}>
                            <i className="fas fa-sign-out-alt" style={{ marginRight: '10px', width: '15px' }}></i>
                            <span>Wyloguj</span>
                          </button>
                        </li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : isAuthenticated ? (
              <div className="avatar-placeholder" style={{width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#333'}}></div>
            ) : (
              <>
                <Link to="/login" className="btn btn-text">Zaloguj</Link>
                <Link
                  to="/register"
                  className="btn btn-primary"
                  style={{ padding: '8px 20px', fontSize: '0.9rem' }}
                >
                  Dołącz
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
