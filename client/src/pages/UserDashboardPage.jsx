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

const toWeekKey = (d = new Date()) => {
  // ISO week key: YYYY-Www
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${pad2(weekNo)}`;
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

const UserDashboardPage = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [recentSolved, setRecentSolved] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [activeSecondsThisWeek, setActiveSecondsThisWeek] = useState(0);
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

        const recentSolvedPromise = fetchRecentSolved();

        const [u, r, rk, mr, recent] = await Promise.all([
          userPromise,
          roomsPromise,
          rankingPromise,
          myRankPromise,
          recentSolvedPromise,
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
    const userId = userData?.id;
    if (!userId) return;

    const weekKey = toWeekKey(new Date());
    const storageKey = `hackademy_active_${userId}_${weekKey}`;
    const readSeconds = () => {
      const raw = localStorage.getItem(storageKey);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
    };

    setActiveSecondsThisWeek(readSeconds());

    let interval = null;
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      const next = readSeconds() + 15;
      localStorage.setItem(storageKey, String(next));
      setActiveSecondsThisWeek(next);
    };

    interval = window.setInterval(tick, 15000);
    return () => {
      if (interval) window.clearInterval(interval);
    };
  }, [userData?.id]);

  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    const solvedRooms = rooms.filter((x) => x?.solved).length;
    const globalProgress = totalRooms > 0 ? solvedRooms / totalRooms : 0;

    const username = userData?.username || 'Użytkowniku';
    const points = userData?.points ?? userData?.xp ?? 0;
    const level = userData?.level ?? 1;
    const streak = userData?.streak ?? 0;
    const badges = userData?.badgesCount ?? userData?.badges?.length ?? 0;

    return {
      username,
      totalRooms,
      solvedRooms,
      globalProgress: clamp01(globalProgress),
      points,
      level,
      streak,
      badges,
    };
  }, [rooms, userData]);

  const topRanking = useMemo(() => {
    const sorted = [...ranking].sort((a, b) => (b?.points || 0) - (a?.points || 0));
    return sorted.slice(0, 5);
  }, [ranking]);

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
          Przejdź do Learn
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

            <div className="ud-kpi-grid">
              <div className="ud-kpi">
                <div className="ud-kpi-label">XP</div>
                <div className="ud-kpi-value">{stats.points?.toLocaleString?.('pl-PL') ?? stats.points}</div>
              </div>
              <div className="ud-kpi">
                <div className="ud-kpi-label">LEVEL</div>
                <div className="ud-kpi-value">{stats.level}</div>
              </div>
              <div className="ud-kpi">
                <div className="ud-kpi-label">STREAK</div>
                <div className="ud-kpi-value">
                  {stats.streak} <i className="fas fa-fire" style={{ color: '#ff9800', marginLeft: '6px' }} />
                </div>
              </div>
              <div className="ud-kpi">
                <div className="ud-kpi-label">ODZNAKI</div>
                <div className="ud-kpi-value">
                  {stats.badges} <i className="fas fa-award" style={{ color: '#ffd700', marginLeft: '6px' }} />
                </div>
              </div>
            </div>
          </section>

          <section className="ud-card">
            <div className="ud-card-header">
              <h2>Ranking</h2>
              <div className="ud-rank-pill">{typeof myRank === 'number' ? `#${myRank}` : myRank?.rank ? `#${myRank.rank}` : ''}</div>
            </div>

            <div className="ud-ranking-list">
              {topRanking.map((p, idx) => {
                const isMe = p?.username && p.username === userData?.username;
                return (
                  <div key={`${p?.username || idx}`} className={`ud-ranking-item ${isMe ? 'me' : ''}`}>
                    <div className="ud-ranking-pos">{idx + 1}</div>
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

