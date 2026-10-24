import { PixelSprite, SPRITES } from './PixelSprite';
import UserAvatar from '../components/UserAvatar';
import * as friendApi from '../services/friendApi';
import * as arenaApi from '../services/arenaApi';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useNotificationPreferences } from '../context/NotificationPreferencesContext';
import { useLandingScrollSpy } from '../hooks/useLandingScrollSpy';
import { useFriendOnlineFeed } from '../context/FriendOnlineFeedContext';
import { formatRelativeTimePL } from '../lib/relativeTime';
import type { Challenge, FriendRequestDto } from '../types/api';
import './Navbar.css';
import '../styles/presence.css';
import { Button } from './ui/button';
import ThemeSwitcher from './ThemeSwitcher';
import NavIconButton from './NavIconButton';
import NavbarFriends from './NavbarFriends';
import { Bell } from 'lucide-react';
import { useRoomChrome } from './room/roomChrome';
import { useArenaClock } from '../hooks/useArenaClock';
import { secondsLeft } from './arena/battle/battleView';

type Notification =
  | { id: number; type: 'FRIEND_REQUEST'; from: string; timestamp: string; data: FriendRequestDto }
  | { id: string; type: 'CHALLENGE'; from: string; timestamp: string; data: Challenge };


const Navbar = () => {
  const { isAuthenticated, logout, sessionKey, loading, user: userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const roomChrome = useRoomChrome();
  const roomMode = Boolean(roomChrome?.active);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const mobileMenuOpen = mobileMenuPath === location.pathname;
  const mobileToggleRef = useRef<HTMLButtonElement | null>(null);
  const mobileLinksRef = useRef<HTMLDivElement | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
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
  const rejectedChallenges = useMemo(() => preferences.challenges ? realtime?.rejectedChallenges ?? [] : [],
    [realtime, preferences.challenges]);
  const [readRejections, setReadRejections] = useState<ReadonlySet<string>>(() => new Set());
  const onlineFeed = useFriendOnlineFeed();
  const { markAllRead } = onlineFeed;
  const unreadCount = notifications.length + rejectedChallenges.filter(challenge => !readRejections.has(challenge.id)).length
    + onlineFeed.entries.filter(entry => !entry.read).length;
  const [processedNotifications, setProcessedNotifications] = useState<string[]>([]); // Track processed IDs
  const menuRef = useRef<HTMLDivElement | null>(null);
  const notifRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const closeMenus = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMobileMenuPath(null);
      setIsMenuOpen(false);
      setIsNotificationsOpen(false);
      if (mobileMenuOpen) mobileToggleRef.current?.focus();
    };
    // Any press outside the menu and its toggle closes it, the navbar's own panels included,
    // so a panel never opens below the expanded links and runs off the screen.
    const closeMobileOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!mobileLinksRef.current?.contains(target) && !mobileToggleRef.current?.contains(target)) setMobileMenuPath(null);
    };
    document.addEventListener('keydown', closeMenus);
    document.addEventListener('mousedown', closeMobileOutside);
    return () => {
      document.removeEventListener('keydown', closeMenus);
      document.removeEventListener('mousedown', closeMobileOutside);
    };
  }, [mobileMenuOpen]);

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

  // Online entries count as read once the visitor has seen the open bell.
  const wasNotificationsOpen = useRef(false);
  // "5 min temu" has to keep counting while the bell stays open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isNotificationsOpen) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, [isNotificationsOpen]);
  // Pending duels count down to their expiry on the server clock, like the arena's own list.
  const serverTime = realtime?.serverTime ?? 0;
  const clock = useArenaClock(serverTime, isNotificationsOpen && notifications.some(notif => notif.type === 'CHALLENGE'));
  const challengeSecondsLeft = (expiresAt: number) => clock.serverTime === serverTime
    ? secondsLeft(expiresAt, serverTime, clock.receivedAt, clock.now)
    : Math.max(0, Math.ceil((expiresAt - serverTime) / 1000));
  useEffect(() => {
    if (wasNotificationsOpen.current && !isNotificationsOpen) {
      markAllRead();
      setReadRejections(read => rejectedChallenges.every(challenge => read.has(challenge.id))
        ? read : new Set([...read, ...rejectedChallenges.map(challenge => challenge.id)]));
    }
    wasNotificationsOpen.current = isNotificationsOpen;
  }, [isNotificationsOpen, markAllRead, rejectedChallenges]);

  const handleLogout = () => {
    setIsMenuOpen(false);
    logout();
    navigate('/');
  };

  const handleAcceptFriend = async (requestId: number) => {
    if (processedNotifications.includes(`FRIEND_REQUEST-${requestId}`)) return;
    setProcessedNotifications(prev => [...prev, `FRIEND_REQUEST-${requestId}`]);

    try {
        const response = await friendApi.acceptRequest(requestId, { sessionKey });
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
        const response = await friendApi.rejectRequest(requestId, { sessionKey });
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
        const res = await arenaApi.acceptChallenge(challengeId, { sessionKey });
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
        const response = await arenaApi.rejectChallenge(challengeId, { sessionKey });
        if (!response.ok) throw new Error("Notification action failed");
        await synchronize();
    } catch (err) {
        console.error(err);
    } finally {
        setProcessedNotifications(previous => previous.filter(id => id !== `CHALLENGE-${challengeId}`));
    }
  };

  const handleDismissRejection = async (challengeId: string) => {
    if (processedNotifications.includes(`REJECTED-${challengeId}`)) return;
    setProcessedNotifications(prev => [...prev, `REJECTED-${challengeId}`]);

    try {
        const response = await arenaApi.dismissChallengeNotice(challengeId, { sessionKey });
        if (!response.ok) throw new Error("Notification action failed");
        await synchronize();
    } catch (err) {
        console.error(err);
    } finally {
        setProcessedNotifications(previous => previous.filter(id => id !== `REJECTED-${challengeId}`));
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
    <nav className={roomMode ? 'navbar navbar--room' : 'navbar'} aria-label="Nawigacja główna">
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
              src="/brand-pixel/hackademy-logo-white.png"
              alt="Hackademy Logo"
            />
            <img className="logo-mark" src="/brand-pixel/hackademy-mark-white-web.png" alt="Hackademy Logo" />
          </Link>
          {roomMode && <div className="navbar-room-slot" ref={roomChrome?.setSlot} />}
          {!isAuthPage && !roomMode && (
            <Button type="button" variant="outline" size="sm" className="mobile-nav-toggle md:hidden" ref={mobileToggleRef}
              aria-expanded={mobileMenuOpen} aria-controls="main-nav-links"
              onClick={() => setMobileMenuPath(mobileMenuOpen ? null : location.pathname)}>Menu</Button>
          )}
          {!isAuthPage && !roomMode && (
            <div id="main-nav-links" ref={mobileLinksRef} className={`nav-links ${mobileMenuOpen ? 'mobile-nav-open' : ''}`}
              onClick={event => { if ((event.target as HTMLElement).closest('a')) setMobileMenuPath(null); }}>
              {isAuthenticated ? (
                <>
                  <Link to="/dashboard" className={isActivePrefix('/dashboard') ? 'active' : ''}>Dashboard</Link>
                  <Link to="/learn" className={isActivePrefix('/learn') ? 'active' : ''}>Ucz się</Link>
                  <Link to="/arena" className={isActivePrefix('/arena') ? 'active' : ''}>Tryb Rankingowy</Link>
                  <Link to="/ranking" className={isActivePrefix('/ranking') ? 'active' : ''}>Ranking</Link>
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
                
                <NavbarFriends />

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
                        <div className="notifications-dropdown">
                            <div className="notifications-header">
                                <h3>Powiadomienia</h3>
                                {unreadCount > 0 && (
                                    <span className="notifications-count-badge"><b>{unreadCount}</b> nowe</span>
                                )}
                            </div>

                            {notifications.length === 0 && rejectedChallenges.length === 0 && onlineFeed.entries.length === 0 ? (
                                <div className="notifications-empty">
                                    <span>Brak nowych powiadomień</span>
                                    <small>Zaproszenia i wyzwania od znajomych pojawią się tutaj.</small>
                                </div>
                            ) : (
                                <div className="notifications-scroll">
                                    {notifications.length > 0 && <>
                                        <p className="notifications-group">Czekają na odpowiedź</p>
                                        <ul className="notifications-list">
                                            {notifications.map(notif => {
                                                const isProcessed = processedNotifications.includes(`${notif.type}-${notif.id}`);
                                                const challenge = notif.type === 'CHALLENGE' ? notif.data : null;
                                                return (
                                                    <li key={`${notif.type}-${notif.id}`} className="notification-item" data-kind={challenge ? 'challenge' : 'friend'}>
                                                        <UserAvatar className="notification-portrait" username={notif.from}
                                                            avatar={challenge ? challenge.challengerAvatar : (notif.data as FriendRequestDto).avatar} alt="" />
                                                        <div className="notification-body">
                                                            <p className="notification-message">
                                                                <strong>{notif.from}</strong>
                                                                {challenge?.challengerElo != null && <span className="notification-elo"><b>{challenge.challengerElo}</b> Elo</span>}
                                                            </p>
                                                            <p className="notification-type">
                                                                {challenge
                                                                    ? <>wyzywa Cię na pojedynek · <span className="notification-expiry">wygasa za {challengeSecondsLeft(challenge.expiresAt)} s</span></>
                                                                    : <>chce dodać Cię do znajomych · {formatRelativeTimePL(Date.parse(notif.timestamp), now)}</>}
                                                            </p>
                                                            <div className="notification-actions">
                                                                <button type="button" disabled={isProcessed}
                                                                    onClick={() => challenge ? handleAcceptChallenge(challenge.id) : handleAcceptFriend(notif.id as number)}
                                                                    className="btn-notif btn-notif-accept">
                                                                    {isProcessed ? 'Zapisywanie…' : challenge ? 'Przyjmij pojedynek' : 'Akceptuj'}
                                                                </button>
                                                                <button type="button" disabled={isProcessed}
                                                                    onClick={() => challenge ? handleRejectChallenge(challenge.id) : handleRejectFriend(notif.id as number)}
                                                                    className="btn-notif btn-notif-reject">
                                                                    Odrzuć
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </>}
                                    {(rejectedChallenges.length > 0 || onlineFeed.entries.length > 0) && <>
                                        <p className="notifications-group">Wcześniej</p>
                                        <ul className="notifications-list">
                                            {rejectedChallenges.map(challenge => (
                                                <li key={`REJECTED-${challenge.id}`} className="notification-item notification-rejected"
                                                    data-unread={!readRejections.has(challenge.id)}>
                                                    <span className="notification-portrait-wrap">
                                                        <UserAvatar className="notification-portrait" username={challenge.targetUsername} avatar={challenge.targetAvatar} alt="" />
                                                        <span className="notification-rejected-mark" aria-hidden="true"><i className="fas fa-times"></i></span>
                                                    </span>
                                                    <div className="notification-body">
                                                        <p className="notification-message">
                                                            <strong>{challenge.targetUsername}</strong> odrzuca Twoje wyzwanie na pojedynek.
                                                        </p>
                                                        <p className="notification-type">Tryb Rankingowy</p>
                                                    </div>
                                                    <button type="button" className="notification-online-close"
                                                        aria-label={`Zamknij powiadomienie: ${challenge.targetUsername} odrzuca Twoje wyzwanie`}
                                                        disabled={processedNotifications.includes(`REJECTED-${challenge.id}`)}
                                                        onClick={() => handleDismissRejection(challenge.id)}>
                                                        <i className="fas fa-times" aria-hidden="true"></i>
                                                    </button>
                                                </li>
                                            ))}
                                            {onlineFeed.entries.map(entry => (
                                                <li key={entry.id} className="notification-online" data-unread={!entry.read}>
                                                    <span className="presence-dot" aria-hidden="true" />
                                                    <span className="notification-online-text">
                                                        <strong>{entry.username}</strong> jest online
                                                    </span>
                                                    <time className="notification-online-time" dateTime={new Date(entry.at).toISOString()}>{formatRelativeTimePL(entry.at, now)}</time>
                                                    <button type="button" className="notification-online-close"
                                                        aria-label={`Zamknij powiadomienie: ${entry.username} jest online`}
                                                        onClick={() => onlineFeed.dismiss(entry.id)}>
                                                        <i className="fas fa-times" aria-hidden="true"></i>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </>}
                                </div>
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

                <div ref={menuRef} className="nav-account">
                  <button type="button" className="nav-account-toggle" data-slot="nav-account"
                    aria-label="Menu konta" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)}>
                  <UserAvatar username={userData.username} avatar={userData.avatar}
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
                    <div className="profile-dropdown">
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
                  className="btn btn-primary nav-join"
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
