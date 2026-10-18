import { PixelSprite, SPRITES } from './PixelSprite';
import UserAvatar from '../components/UserAvatar';
import * as userApi from '../services/userApi';
import * as friendApi from '../services/friendApi';
import * as arenaApi from '../services/arenaApi';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import { useLandingScrollSpy } from '../hooks/useLandingScrollSpy';
import type { Challenge, DashboardUser, FriendRequestDto } from '../types/api';
import './Navbar.css';
import { Button } from './ui/button';
import ThemeSwitcher from './ThemeSwitcher';
import NavIconButton from './NavIconButton';
import { Bell } from 'lucide-react';
import { PROFILE_UPDATED } from '../lib/profile';
import type { ProfilePersonalization } from '../lib/profile';

type Notification =
  | { id: number; type: 'FRIEND_REQUEST'; from: string; timestamp: string; data: FriendRequestDto }
  | { id: string; type: 'CHALLENGE'; from: string; timestamp: string; data: Challenge };

const Navbar = () => {
  const { isAuthenticated, logout, token, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === location.pathname;
  const navRef = useRef<HTMLElement | null>(null);
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [userData, setUserData] = useState<DashboardUser | null>(null);
  const { state: realtime, synchronize } = useRealtime();
  const { preferences } = useNotificationPreferences();
  const notifications = useMemo<Notification[]>(() => [
    ...(preferences.friendRequests ? realtime?.friendRequests ?? [] : []).map(req => ({
      id: req.id, type: 'FRIEND_REQUEST' as const, from: req.requesterUsername,
      timestamp: req.createdAt, data: req,
    })),
    ...(preferences.challenges ? realtime?.challenges ?? [] : []).map(ch => ({
      id: ch.id, type: 'CHALLENGE' as const, from: ch.challengerUsername,
      timestamp: ch.createdAt, data: ch,
    })),
  ], [realtime, preferences.friendRequests, preferences.challenges]);
  const unreadCount = notifications.length;
  const [processedNotifications, setProcessedNotifications] = useState<string[]>([]); // Track processed IDs
  const menuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const refresh = (event: Event) => {
      const changed = (event as CustomEvent<ProfilePersonalization & { username: string }>).detail;
      setUserData(previous => previous?.username === changed.username ? { ...previous, ...changed } : previous);
    };
    window.addEventListener(PROFILE_UPDATED, refresh);
    return () => window.removeEventListener(PROFILE_UPDATED, refresh);
  }, []);

  useEffect(() => {
    const closeMenus = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileMenuPath(null);
      setIsMenuOpen(false);
      setIsNotificationsOpen(false);
      if (mobileMenuOpen) mobileToggleRef.current?.focus();
    };
    const closeMobileOutside = (event: MouseEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setMobileMenuPath(null);
    };
    document.addEventListener('keydown', closeMenus);
    document.addEventListener('mousedown', closeMobileOutside);
    return () => {
      document.removeEventListener('keydown', closeMenus);
      document.removeEventListener('mousedown', closeMobileOutside);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (isAuthenticated && token) {
        try {
          const response = await userApi.getCurrentUser({
              'Authorization': `Bearer ${token}`
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
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

  const handleAcceptFriend = async (requestId: number) => {
    if (processedNotifications.includes(`FRIEND_REQUEST-${requestId}`)) return;
    setProcessedNotifications(prev => [...prev, `FRIEND_REQUEST-${requestId}`]);

    try {
        const response = await friendApi.acceptRequest(requestId, { 'Authorization': `Bearer ${token}` });
        if (!response.ok) throw new Error("Notification action failed");
        await synchronize();
    } catch (err) {
        console.error(err);
    } finally {
        setProcessedNotifications(previous => previous.filter(id => id !== `FRIEND_REQUEST-${requestId}`));
    }
  };

  const handleRejectFriend = async (requestId: number) => {
    if (processedNotifications.includes(`FRIEND_REQUEST-${requestId}`)) return;
    setProcessedNotifications(prev => [...prev, `FRIEND_REQUEST-${requestId}`]);

    try {
        const response = await friendApi.rejectRequest(requestId, { 'Authorization': `Bearer ${token}` });
        if (!response.ok) throw new Error("Notification action failed");
        await synchronize();
    } catch (err) {
        console.error(err);
    } finally {
        setProcessedNotifications(previous => previous.filter(id => id !== `FRIEND_REQUEST-${requestId}`));
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    if (processedNotifications.includes(`CHALLENGE-${challengeId}`)) return;
    setProcessedNotifications(prev => [...prev, `CHALLENGE-${challengeId}`]);

    try {
        const res = await arenaApi.acceptChallenge(challengeId, { 'Authorization': `Bearer ${token}` });
        if (res.ok) {
            setIsNotificationsOpen(false);
            await synchronize();
        }
    } catch (err) {
        console.error(err);
    } finally {
        setProcessedNotifications(previous => previous.filter(id => id !== `CHALLENGE-${challengeId}`));
    }
  };

  const handleRejectChallenge = async (challengeId: string) => {
    if (processedNotifications.includes(`CHALLENGE-${challengeId}`)) return;
    setProcessedNotifications(prev => [...prev, `CHALLENGE-${challengeId}`]);

    try {
        const response = await arenaApi.rejectChallenge(challengeId, { 'Authorization': `Bearer ${token}` });
        if (!response.ok) throw new Error("Notification action failed");
        await synchronize();
    } catch (err) {
        console.error(err);
    } finally {
        setProcessedNotifications(previous => previous.filter(id => id !== `CHALLENGE-${challengeId}`));
    }
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isActivePrefix = (prefix: string) => location.pathname === prefix || location.pathname.startsWith(`${prefix}/`);

  const landingScrollEnabled =
    !isAuthPage && !loading && !isAuthenticated && location.pathname === '/';
  const landingActiveSection = useLandingScrollSpy(landingScrollEnabled);

  const landingHashHref = useCallback(
    (id: string) => (location.pathname === '/' ? `#${id}` : `/#${id}`),
    [location.pathname]
  );

  return (
    <nav className="navbar" ref={navRef} aria-label="Nawigacja główna">
      <div className="hackademy-container">
        <div className="nav-content">
          <Link
            to="/"
            className="logo"
            onClick={(e) => {
              if (location.pathname === '/') {
                e.preventDefault();
                window.history.replaceState(null, '', '#start');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
          >
            <img
              src="/biale_hackademy_logo.png"
              alt="Hackademy Logo"
              style={{ height: '40px', width: 'auto' }}
            />
          </Link>
          {!isAuthPage && (
            <Button type="button" variant="outline" size="sm" className="mobile-nav-toggle md:hidden" ref={mobileToggleRef}
              aria-expanded={mobileMenuOpen} aria-controls="main-nav-links"
              onClick={() => setMobileMenuPath(mobileMenuOpen ? null : location.pathname)}>Menu</Button>
          )}
          {!isAuthPage && (
            <div id="main-nav-links" className={`nav-links ${mobileMenuOpen ? 'mobile-nav-open' : ''}`}
              onClick={event => { if ((event.target as HTMLElement).closest('a')) setMobileMenuPath(null); }}>
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className={isActivePrefix('/dashboard') ? 'active' : ''}>Dashboard</Link>
                  <Link to="/learn" className={isActivePrefix('/learn') ? 'active' : ''}>Ucz się</Link>
                  <Link to="/arena" className={isActivePrefix('/arena') ? 'active' : ''}>Tryb Rankingowy</Link>
                  <Link to="/ranking" className={isActivePrefix('/ranking') ? 'active' : ''}>Ranking</Link>
                  <Link to="/vpn" className={isActivePrefix('/vpn') ? 'active' : ''} style={{ color: '#3498db' }}>VPN</Link>
                </>
              ) : (
                <>
                  <a
                    href={landingHashHref('start')}
                    className={landingActiveSection === 'start' ? 'active' : ''}
                    onClick={(e) => {
                      if (location.pathname === '/') {
                        e.preventDefault();
                        window.history.replaceState(null, '', '#start');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }
                    }}
                  >
                    Start
                  </a>
                  <a
                    href={landingHashHref('arena')}
                    className={landingActiveSection === 'arena' ? 'active' : ''}
                  >
                    Tryb Rankingowy
                  </a>
                  <a
                    href={landingHashHref('rooms')}
                    className={landingActiveSection === 'rooms' ? 'active' : ''}
                  >
                    Pokoje
                  </a>
                  <a
                    href={landingHashHref('leaderboard')}
                    className={landingActiveSection === 'leaderboard' ? 'active' : ''}
                  >
                    Ranking
                  </a>
                </>
              )}
            </div>
          )}
          <div className="nav-auth">
            <ThemeSwitcher />
            {isAuthenticated && userData ? (
              <div className="nav-user-controls">
                
                {/* Notifications Bell */}
                <div ref={notifRef} style={{ position: 'relative' }}>
                    <NavIconButton
                        data-slot="nav-notifications"
                        aria-label="Powiadomienia"
                        aria-expanded={isNotificationsOpen}
                        onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    >
                        <Bell aria-hidden="true" />
                        {unreadCount > 0 && <span className="notification-badge"></span>}
                    </NavIconButton>

                    {isNotificationsOpen && (
                        <div className="notifications-dropdown" style={{ backgroundColor: 'var(--bg-panel)', border: '1px solid var(--border-color)' }}>
                            <div className="notifications-header" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <h3 style={{ color: 'var(--text-light)' }}>Powiadomienia</h3>
                                {unreadCount > 0 && (
                                    <span className="notifications-count-badge">{unreadCount} nowe</span>
                                )}
                            </div>
                            
                            {notifications.length === 0 ? (
                                <div className="notifications-empty" style={{ color: 'var(--text-gray)' }}>
                                    <i className="far fa-bell-slash"></i>
                                    <span>Brak nowych powiadomień</span>
                                </div>
                            ) : (
                                <ul className="notifications-list">
                                    {notifications.map(notif => {
                                        const isProcessed = processedNotifications.includes(`${notif.type}-${notif.id}`);
                                        return (
                                            <li key={`${notif.type}-${notif.id}`} className="notification-item" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <div className="notification-content">
                                                    <div className="notification-avatar">
                                                        <UserAvatar username={notif.from} seed={notif.type === 'FRIEND_REQUEST' ? notif.data.avatarSeed : notif.data.challengerAvatarSeed}
                                                            alt="Avatar" 
                                                            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--border-color)' }} 
                                                        />
                                                    </div>
                                                    <div className="notification-text-wrapper">
                                                        <p className="notification-message" style={{ color: 'var(--text-light)' }}>
                                                            <strong>{notif.from}</strong>
                                                            {notif.type === 'CHALLENGE' ? ' wyzywa Cię na pojedynek!' : ' wysłał zaproszenie.'}
                                                        </p>
                                                        <span className="notification-type" style={{ color: 'var(--text-gray)' }}>
                                                            {notif.type === 'CHALLENGE' ? 'Tryb Rankingowy' : 'Znajomi'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="notification-actions">
                                                    {isProcessed ? (
                                                        <span style={{ color: 'var(--text-gray)', fontSize: '0.9rem', fontStyle: 'italic' }}>Przetwarzanie...</span>
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
                <div className="nav-streak" style={{
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
                    <PixelSprite sprite={SPRITES.flame} still={!userData.streak} className={userData.streak ? 'nav-streak-flame' : 'nav-streak-flame is-out'} />
                    <span>{userData.streak || 0}</span>
                </div>

                <div ref={menuRef} style={{ position: 'relative' }}>
                  <button type="button" className="nav-account-toggle" data-slot="nav-account"
                    aria-label="Menu konta" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  <UserAvatar username={userData.username} seed={userData.avatarSeed} avatar={userData.avatar}
                    alt="User Avatar"
                    className="avatar" 
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      border: '2px solid var(--primary-blue)'
                    }}
                  />
                  </button>
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
                        <p style={{ margin: 0, fontWeight: 'bold', color: 'var(--text-light)' }}>{userData.username}</p>
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
                            <Link to="/admin/paths" onClick={() => setIsMenuOpen(false)}>
                              <i className="fas fa-user-graduate" style={{ marginRight: '10px', width: '15px' }}></i>
                              <span>Panel Eksperta</span>
                            </Link>
                          </li>
                        )}
                        <li className="dropdown-item">
                          <Link to="/settings" onClick={() => setIsMenuOpen(false)}>
                            <i className="fas fa-cog" style={{ marginRight: '10px', width: '15px' }}></i>
                            <span>Ustawienia</span>
                          </Link>
                        </li>
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
