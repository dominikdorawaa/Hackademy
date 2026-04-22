import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';
import './UserDashboardPage.css';

const clamp01 = (n) => Math.min(1, Math.max(0, n));

const pad2 = (n) => String(n).padStart(2, '0');

const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${pad2(m)}m`;
};

const formatRelativeTimePL = (isoDateTime) => {
  if (!isoDateTime) return '';
  const t = new Date(isoDateTime).getTime();
  if (Number.isNaN(t)) return '';

  const now = Date.now();
  const diffSec = Math.floor((now - t) / 1000);
  if (diffSec < 60) return 'przed chwilą';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h temu`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'wczoraj';
  return `${diffDay} dni temu`;
};

const difficultyBadge = (difficulty) => {
  switch (difficulty) {
    case 'EASY':
      return { label: 'Łatwy', cls: 'easy' };
    case 'MEDIUM':
      return { label: 'Średni', cls: 'medium' };
    case 'HARD':
      return { label: 'Trudny', cls: 'hard' };
    case 'INSANE':
      return { label: 'Insane', cls: 'insane' };
    default:
      return { label: String(difficulty || ''), cls: 'easy' };
  }
};

const rankTitleFromPoints = (points) => {
  const p = Number(points) || 0;
  const level = Math.floor(p / 100) + 1;
  if (level >= 1 && level <= 3) return 'Freshman';
  if (level >= 4 && level <= 6) return 'Junior';
  if (level >= 7 && level <= 10) return 'Apprentice';
  if (level >= 11 && level <= 15) return 'Developer';
  if (level >= 16 && level <= 20) return 'Senior';
  if (level >= 21) return 'Architect';
  return 'Freshman';
};

const UserDashboardPage = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [recentSolved, setRecentSolved] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [activeSecondsThisWeek, setActiveSecondsThisWeek] = useState(0);
  const [badgesEarnedCount, setBadgesEarnedCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isCancelled = false;
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers = {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const fetchRecentSolved = () =>
          fetch(`${API_URL}/api/user/me/recent-solved?limit=3`, { headers }).then((res) => {
            if (!res.ok) return [];
            return res.json();
          });

        const userPromise = fetch(`${API_URL}/api/user/me`, { headers }).then((res) => {
          if (res.status === 401 || res.status === 403) return null;
          if (!res.ok) throw new Error('Failed to fetch user');
          return res.json();
        });

        const roomsPromise = fetch(`${API_URL}/api/rooms`, { headers }).then((res) => {
          if (!res.ok) throw new Error('Failed to fetch rooms');
          return res.json();
        });

        const rankingPromise = fetch(`${API_URL}/api/user/ranking`, { headers }).then((res) => {
          if (!res.ok) return [];
          return res.json();
        });

        const myRankPromise = fetch(`${API_URL}/api/user/me/rank`, { headers }).then((res) => {
          if (!res.ok) return null;
          return res.json();
        });

        const activeTimePromise = fetch(`${API_URL}/api/user/me/active-time`, { headers }).then((res) => {
          if (!res.ok) return { secondsThisWeek: 0 };
          return res.json();
        });

        const badgesPromise = fetch(`${API_URL}/api/badges/all`, { headers }).then((res) => {
          if (!res.ok) return [];
          return res.json();
        });

        const friendsPromise = fetch(`${API_URL}/api/friends`, { headers }).then((res) => {
          if (!res.ok) return [];
          return res.json();
        });

        const recentSolvedPromise = fetchRecentSolved();

        const [u, r, rk, mr, recent, activeTime, badges, friends] = await Promise.all([
          userPromise,
          roomsPromise,
          rankingPromise,
          myRankPromise,
          recentSolvedPromise,
          activeTimePromise,
          badgesPromise,
          friendsPromise,
        ]);

        if (!u) {
          logout();
          navigate('/login');
          return;
        }

        if (isCancelled) return;
        setUserData(u);
        setRooms(Array.isArray(r) ? r : []);
        setRanking(Array.isArray(rk) ? rk : []);
        setMyRank(mr);
        setRecentSolved(Array.isArray(recent) ? recent : []);
        setActiveSecondsThisWeek(Number(activeTime?.secondsThisWeek) || 0);
        setBadgesEarnedCount(Array.isArray(badges) ? badges.filter((b) => b?.earned).length : 0);
        setFriendsCount(Array.isArray(friends) ? friends.length : 0);
      } catch (e) {
        console.error(e);
        setError('Nie udało się wczytać dashboardu. Sprawdź połączenie z backendem.');
      } finally {
        setLoading(false);
      }
    };

    if (!token) {
      logout();
      navigate('/login');
      return;
    }

    fetchAll();
    return () => {
      isCancelled = true;
    };
  }, [token, logout, navigate]);

  useEffect(() => {
    if (!token) return;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const refreshRecentSolved = async () => {
      try {
        const res = await fetch(`${API_URL}/api/user/me/recent-solved?limit=3`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        setRecentSolved(Array.isArray(data) ? data : []);
      } catch {
        // ignore background refresh errors
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshRecentSolved();
    };
    const onFocus = () => refreshRecentSolved();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    // Light polling to pick up "just solved" quickly.
    const interval = window.setInterval(refreshRecentSolved, 15000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    let inFlight = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await fetch(`${API_URL}/api/user/me/active-time`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ deltaSeconds: 15 }),
        });
        if (res.ok) {
          const data = await res.json();
          setActiveSecondsThisWeek(Number(data?.secondsThisWeek) || 0);
        }
      } finally {
        inFlight = false;
      }
    };

    const interval = window.setInterval(tick, 15000);
    return () => window.clearInterval(interval);
  }, [token]);

  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const solvedRooms = rooms.filter((x) => x?.solved).length;
    const globalProgress = totalRooms > 0 ? solvedRooms / totalRooms : 0;

    const username = userData?.username || 'Użytkowniku';
    const points = userData?.points ?? userData?.xp ?? 0;
    const safePoints = Number(points) || 0;
    const level = Math.floor(safePoints / 100) + 1;
    const nextLevelPoints = level * 100;
    const levelProgress = safePoints <= 0 ? 0 : (safePoints % 100) / 100;
    const rankTitle = rankTitleFromPoints(safePoints);
    const streak = userData?.streak ?? 0;
    const badges = badgesEarnedCount;

    const myRankingEntry = userData?.username ? ranking.find((x) => x?.username === userData.username) : null;
    const elo = myRankingEntry?.elo ?? 500;

    return {
      username,
      totalRooms,
      solvedRooms,
      globalProgress: clamp01(globalProgress),
      points,
      level,
      nextLevelPoints,
      levelProgress: clamp01(levelProgress),
      rankTitle,
      streak,
      badges,
      elo,
    };
  }, [rooms, userData, badgesEarnedCount, ranking]);

  const rankingWindow = useMemo(() => {
    const sorted = [...ranking].sort((a, b) => (b?.points || 0) - (a?.points || 0));
    const me = userData?.username;
    const idx = me ? sorted.findIndex((x) => x?.username === me) : -1;
    if (idx < 0) return sorted.slice(0, 5).map((x, i) => ({ ...x, _pos: i + 1 }));

    const start = Math.max(0, idx - 2);
    const end = Math.min(sorted.length, idx + 3);
    return sorted.slice(start, end).map((x, i) => ({ ...x, _pos: start + i + 1 }));
  }, [ranking, userData?.username]);

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1 style={{ margin: 0 }}>Ładowanie dashboardu...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
        <h1 style={{ margin: 0, marginBottom: '10px' }}>Błąd</h1>
        <p style={{ color: 'var(--text-gray)' }}>{error}</p>
        <button className="btn btn-outline" onClick={() => navigate('/learn')}>
          Przejdź do „Ucz się”
        </button>
      </div>
    );
  }

  return (
    <div className="container user-dashboard" style={{ paddingTop: '35px', paddingBottom: '40px' }}>
      <div className="ud-header">
        <div className="ud-greeting">
          <h1 className="ud-title">
            Cześć, <span className="ud-username">{stats.username}</span>
          </h1>
          <p className="ud-subtitle">Gotowy na kolejne wyzwanie?</p>
        </div>
        <div className="ud-actions">
          <button className="btn btn-primary ud-btn" onClick={() => navigate('/learn')}>
            Kontynuuj ścieżkę <i className="fas fa-arrow-right" style={{ marginLeft: '8px' }} />
          </button>
          <button className="btn btn-outline ud-btn" onClick={() => navigate('/learn')}>
            Znajdź pokój <i className="fas fa-search" style={{ marginLeft: '8px' }} />
          </button>
        </div>
      </div>

      <div className="ud-grid">
        <div className="ud-left">
          <section className="ud-card">
            <div className="ud-card-header">
              <h2>Aktualny postęp</h2>
              <div className="ud-mini-icon">
                <i className="fas fa-chart-line" />
              </div>
            </div>

            <div className="ud-progress-row">
              <div className="ud-progress-meta">
                <span>Progres globalny</span>
                <span className="ud-progress-value">{Math.round(stats.globalProgress * 100)}%</span>
              </div>
              <div className="ud-progress-bar">
                <div className="ud-progress-fill" style={{ width: `${Math.round(stats.globalProgress * 100)}%` }} />
              </div>
            </div>

            <div className="ud-stats-2col">
              <div className="ud-mini-card">
                <div className="ud-mini-label">Ukończone pokoje</div>
                <div className="ud-mini-big">
                  {stats.solvedRooms} <span className="ud-mini-muted">/ {stats.totalRooms}</span>
                </div>
              </div>
              <div className="ud-mini-card">
                <div className="ud-mini-label">Czas w tym tygodniu</div>
                <div className="ud-mini-big">{formatDuration(activeSecondsThisWeek)}</div>
              </div>
            </div>
          </section>

          <section className="ud-card">
            <div className="ud-card-header">
              <h2>
                Ścieżka nauki: <span className="ud-accent">Web Fundamentals</span>
              </h2>
            </div>

            <div className="ud-progress-row" style={{ marginTop: 0 }}>
              <div className="ud-progress-bar">
                <div className="ud-progress-fill" style={{ width: '45%' }} />
              </div>
            </div>

            <div className="ud-path-list">
              <div className="ud-path-item done">
                <div className="ud-path-icon">
                  <i className="fas fa-check" />
                </div>
                <div className="ud-path-text">
                  <div className="ud-path-title">Intro to Web</div>
                </div>
                <div className="ud-path-status">Ukończone</div>
              </div>
              <div className="ud-path-item done">
                <div className="ud-path-icon">
                  <i className="fas fa-check" />
                </div>
                <div className="ud-path-text">
                  <div className="ud-path-title">HTTP Protocol</div>
                </div>
                <div className="ud-path-status">Ukończone</div>
              </div>
              <div className="ud-path-item inprogress">
                <div className="ud-path-icon">
                  <i className="fas fa-play" />
                </div>
                <div className="ud-path-text">
                  <div className="ud-path-title">Burp Suite Basics</div>
                </div>
                <div className="ud-path-status">W trakcie</div>
              </div>
              <div className="ud-path-item locked">
                <div className="ud-path-icon">
                  <i className="fas fa-lock" />
                </div>
                <div className="ud-path-text">
                  <div className="ud-path-title">SQL Injection</div>
                </div>
                <div className="ud-path-status">Zablokowane</div>
              </div>
              <div className="ud-path-item locked">
                <div className="ud-path-icon">
                  <i className="fas fa-lock" />
                </div>
                <div className="ud-path-text">
                  <div className="ud-path-title">XSS Attacks</div>
                </div>
                <div className="ud-path-status">Zablokowane</div>
              </div>
            </div>
          </section>

          <section className="ud-card">
            <div className="ud-card-header">
              <h2>Ostatnia aktywność</h2>
            </div>

            <div className="ud-activity-grid">
              {recentSolved.length === 0 ? (
                <div className="ud-empty">
                  Brak aktywności. Ukończ pierwszy pokój w Learn, a pojawi się tutaj.
                </div>
              ) : (
                recentSolved.map((x) => {
                  const diff = difficultyBadge(x?.difficulty);
                  return (
                    <div
                      key={x?.roomId}
                      className="ud-activity-card ud-activity-btn"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/rooms/${x.roomId}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/rooms/${x.roomId}`);
                        }
                      }}
                    >
                      <div className={`ud-activity-badge ${diff.cls}`}>{diff.label}</div>
                      <div className="ud-activity-title">{x?.title}</div>
                      <div className="ud-activity-meta">+{x?.points ?? 0} XP</div>
                      <div className="ud-activity-time">{formatRelativeTimePL(x?.solvedAt)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside className="ud-right">
          <section className="ud-card">
            <div className="ud-card-header">
              <h2>Statystyki</h2>
            </div>

            <div className="ud-profile-mini">
              <img
                className="ud-profile-avatar"
                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(stats.username)}`}
                alt="Avatar"
              />
              <div className="ud-profile-meta">
                <div className="ud-profile-name">
                  {stats.username} <span className="ud-profile-rank">[{stats.rankTitle}]</span>
                </div>
                <div className="ud-profile-level">
                  <div className="ud-profile-level-row">
                    <span>Poziom {stats.level}</span>
                    <span className="ud-profile-level-points">
                      {stats.points?.toLocaleString?.('pl-PL') ?? stats.points} / {stats.nextLevelPoints} XP
                    </span>
                  </div>
                  <div className="ud-profile-level-bar" aria-label="Postęp levelu">
                    <div
                      className="ud-profile-level-fill"
                      style={{ width: `${Math.round(stats.levelProgress * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="ud-mini-metrics">
              <div className="ud-metric">
                <div className="ud-metric-label">ELO</div>
                <div className="ud-metric-value">{stats.elo}</div>
              </div>
              <div className="ud-metric">
                <div className="ud-metric-label">ODZNAKI</div>
                <div className="ud-metric-value">{stats.badges}</div>
              </div>
              <div className="ud-metric">
                <div className="ud-metric-label">ZNAJOMI</div>
                <div className="ud-metric-value">{friendsCount}</div>
              </div>
            </div>
          </section>

          <section className="ud-card">
            <div className="ud-card-header">
              <h2>Ranking</h2>
              <div className="ud-rank-pill">{typeof myRank === 'number' ? `#${myRank}` : myRank?.rank ? `#${myRank.rank}` : ''}</div>
            </div>

            <div className="ud-ranking-list">
              {rankingWindow.map((p) => {
                const isMe = p?.username && p.username === userData?.username;
                return (
                  <div key={`${p?._pos}-${p?.username}`} className={`ud-ranking-item ${isMe ? 'me' : ''}`}>
                    <div className="ud-ranking-pos">{p?._pos}</div>
                    <div className="ud-ranking-name">{p?.username || '—'}</div>
                    <div className="ud-ranking-score">{(p?.points || 0).toLocaleString?.('pl-PL') ?? p?.points} XP</div>
                  </div>
                );
              })}
            </div>

            <button className="ud-link" onClick={() => navigate('/ranking')}>
              Zobacz pełny ranking
            </button>
          </section>

          <section className="ud-card">
            <div className="ud-card-header">
              <h2>Rekomendowane</h2>
            </div>
            <div className="ud-reco-title">Buffer Overflow</div>
            <p className="ud-reco-desc">
              Naucz się podstaw przepełnienia bufora i jak wykorzystać tę podatność w prostych aplikacjach.
            </p>
            <button className="btn btn-outline ud-reco-btn" onClick={() => navigate('/learn')}>
              Start <i className="fas fa-play" style={{ marginLeft: '8px' }} />
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default UserDashboardPage;

