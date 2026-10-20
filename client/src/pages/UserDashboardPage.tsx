import UserAvatar from '../components/UserAvatar';
import ProfilePeek from '../components/ProfilePeek';
import * as arenaApi from '../services/arenaApi';
import * as dashboardApi from '../services/dashboardApi';
import * as friendApi from '../services/friendApi';
import * as userApi from '../services/userApi';
import { levelFromPoints, rankTitleFromPoints } from '../lib/level';
import { formatRelativeTimePL } from '../lib/relativeTime';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roomHref } from '../lib/roomReturn';
import './UserDashboardPage.css';
import { PixelSprite, SPRITES } from '../components/PixelSprite';
import { LoadingSkeleton, Skeleton } from '../components/common/Skeleton';
import { FriendRowsSkeleton } from '../components/FriendRowsSkeleton';
import type { DashboardUser, FriendDto, UserSearchDto, RankingEntry, RecentSolvedRoomDto, PathSummaryDto, PathProgressDto, PathRoomMiniDto } from '../types/api';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const pad2 = (n: number) => String(n).padStart(2, '0');

const formatDuration = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${pad2(m)}m`;
};

const formatRelativeTimeFromIso = (isoDateTime: string) =>
  isoDateTime ? formatRelativeTimePL(new Date(isoDateTime).getTime()) : '';

const formatNumberPL = (n: number) => (Number(n) || 0).toLocaleString('pl-PL');

const flagsLabelPL = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return '1 flaga';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} flagi`;
  return `${n} flag`;
};

const isToday = (isoDateTime: string) => {
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
};

// The recent-solved endpoint returns at most this many rooms; enough to sum up a day.
const TODAY_WINDOW = 20;

const badgesLabelPL = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return '1 odznaka';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} odznaki`;
  return `${n} odznak`;
};

// How many friends the dashboard lists before pointing to the friends page.
const FRIENDS_SHOWN = 5;

type ChallengeState = 'sending' | 'sent' | { error: string };

const roomsLabelPL = (n: number) => {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return '1 pokój';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} pokoje`;
  return `${n} pokoi`;
};

const difficultyBadge = (difficulty: string) => {
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

// How many rooms of the current path the dashboard lists, starting just before the next one.
const ROOMS_SHOWN = 5;

// Above this many rooms the path rail switches from one segment per room to a continuous bar.
const MAX_RAIL_SEGMENTS = 24;

const DashboardSkeleton = () => (
  <div className="user-dashboard">
    <LoadingSkeleton label="Ładowanie dashboardu" className="ud-shell">
      <div className="ud-main">
        <Skeleton className="ud-skel-next" tone="wash" />
        <Skeleton className="ud-skel-block" />
        <div className="ud-pair">
          <Skeleton className="ud-skel-block" />
          <Skeleton className="ud-skel-block" />
        </div>
      </div>
      <div className="ud-board">
        <Skeleton className="ud-skel-rank" tone="raised" />
        <Skeleton className="ud-skel-block" />
      </div>
    </LoadingSkeleton>
  </div>
);

const UserDashboardPage = () => {
  const { sessionKey, logout } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState<(DashboardUser & { xp?: number }) | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [recentSolved, setRecentSolved] = useState<RecentSolvedRoomDto[]>([]);
  const [recentWindow, setRecentWindow] = useState<RecentSolvedRoomDto[]>([]);
  const [myRank, setMyRank] = useState<RankingEntry | null>(null);
  const [activeSecondsThisWeek, setActiveSecondsThisWeek] = useState(0);
  const [badgesEarnedCount, setBadgesEarnedCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friends, setFriends] = useState<FriendDto[] | null>(null);
  const [friendsFailed, setFriendsFailed] = useState(false);
  const [headToHead, setHeadToHead] = useState<Record<string, UserSearchDto>>({});
  const [challenges, setChallenges] = useState<Record<string, ChallengeState>>({});
  const [recommendedPath, setRecommendedPath] = useState<PathSummaryDto | null>(null);
  const [pathsProgress, setPathsProgress] = useState<PathProgressDto[]>([]);
  const [currentPath, setCurrentPath] = useState<PathProgressDto | null>(null);
  const [currentPathRoomsMini, setCurrentPathRoomsMini] = useState<PathRoomMiniDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError(null);

        const headers = {sessionKey,
        };

        const res = await dashboardApi.getSummary(headers);
        if (res.status === 401 || res.status === 403) {
          logout();
          navigate('/login');
          return;
        }
        if (!res.ok) {
          throw new Error('Failed to fetch dashboard summary');
        }
        const data = await res.json();

        if (isCancelled) return;
        setUserData(data?.user ?? null);
        setRanking(Array.isArray(data?.ranking) ? data.ranking : []);
        setMyRank(data?.myRank ?? null);
        setRecentSolved(Array.isArray(data?.recentSolved) ? data.recentSolved : []);
        setActiveSecondsThisWeek(Number(data?.activeSecondsThisWeek) || 0);
        setBadgesEarnedCount(Number(data?.badgesEarnedCount) || 0);
        setFriendsCount(Number(data?.friendsCount) || 0);
        setRecommendedPath(data?.recommendedPath ?? null);

        const safeProgress = Array.isArray(data?.pathsProgress) ? data.pathsProgress : [];
        setPathsProgress(safeProgress);
        setCurrentPath(data?.currentPath ?? (safeProgress[0] || null));
        setCurrentPathRoomsMini(Array.isArray(data?.currentPathRoomsMini) ? data.currentPathRoomsMini : []);
      } catch (e) {
        console.error(e);
        setError('Nie udało się wczytać dashboardu. Sprawdź połączenie z internetem i spróbuj ponownie.');
      } finally {
        setLoading(false);
      }
    };

    if (!sessionKey) {
      logout();
      navigate('/login');
      return;
    }

    fetchAll();
    return () => {
      isCancelled = true;
    };
  }, [sessionKey, logout, navigate, reloadKey]);

  useEffect(() => {
    if (!sessionKey) return;

    const headers = {sessionKey,
    };

    const refreshRecentSolved = async () => {
      try {
        const res = await userApi.getRecentSolved(TODAY_WINDOW, headers);
        if (!res.ok) return;
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setRecentWindow(list);
        setRecentSolved(list.slice(0, 3));
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

    refreshRecentSolved();

    // Light polling to pick up "just solved" quickly.
    const interval = window.setInterval(refreshRecentSolved, 15000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;

    const headers = {sessionKey,
    };

    let inFlight = false;
    let disabled = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      if (disabled) return;
      if (inFlight) return;
      inFlight = true;
      try {
        const res = await userApi.addActiveTime({ deltaSeconds: 15 }, headers);
        if (res.ok) {
          const data = await res.json();
          setActiveSecondsThisWeek(Number(data?.secondsThisWeek) || 0);
        } else {
          // If backend can't persist yet (e.g. missing table), stop spamming.
          disabled = true;
        }
      } catch {
        disabled = true;
      } finally {
        inFlight = false;
      }
    };

    const interval = window.setInterval(tick, 15000);
    return () => window.clearInterval(interval);
  }, [sessionKey]);

  useEffect(() => {
    if (!sessionKey) return;
    let cancelled = false;
    const headers = {sessionKey,
    };

    const loadFriends = async () => {
      try {
        const res = await friendApi.getFriends(headers);
        if (!res.ok) throw new Error('friends');
        const data = await res.json();
        const list = (Array.isArray(data) ? data : []).sort((a, b) => (b?.points || 0) - (a?.points || 0));
        if (cancelled) return;
        setFriends(list);

        const shown = list.slice(0, FRIENDS_SHOWN);
        const results = await Promise.all(
          shown.map(async (f) => {
            try {
              const r = await friendApi.getStats(f.username, headers);
              return r.ok ? await r.json() : null;
            } catch {
              return null;
            }
          }),
        );
        if (cancelled) return;
        const map: Record<string, UserSearchDto> = {};
        results.forEach((r) => {
          if (r) map[r.username] = r;
        });
        setHeadToHead(map);
      } catch {
        if (!cancelled) setFriendsFailed(true);
      }
    };

    loadFriends();
    return () => {
      cancelled = true;
    };
  }, [sessionKey]);

  const challenge = async (username: string) => {
    setChallenges((c) => ({ ...c, [username]: 'sending' }));
    try {
      const res = await arenaApi.createChallenge(
        { targetUsername: username },
        {sessionKey },
      );
      if (res.ok) {
        setChallenges((c) => ({ ...c, [username]: 'sent' }));
      } else {
        const body = await res.json();
        setChallenges((c) => ({ ...c, [username]: { error: body?.message || 'Nie udało się wysłać wyzwania.' } }));
      }
    } catch {
      setChallenges((c) => ({ ...c, [username]: { error: 'Brak połączenia. Spróbuj ponownie.' } }));
    }
  };

  const stats = useMemo(() => {
    const totalPaths = pathsProgress.length;
    const completedPaths = pathsProgress.filter((p) => p?.completed).length;

    const username = userData?.username || 'Użytkowniku';
    const points = Number(userData?.points ?? userData?.xp ?? 0) || 0;
    const level = levelFromPoints(points);
    const nextLevelPoints = level * 100;
    const levelProgress = points <= 0 ? 0 : (points % 100) / 100;
    const rankTitle = rankTitleFromPoints(points);

    const myRankingEntry = userData?.username ? ranking.find((x) => x?.username === userData.username) : null;
    const elo = myRankingEntry?.elo ?? myRank?.elo ?? 500;

    return {
      username,
      totalPaths,
      completedPaths,
      points,
      level,
      nextLevelPoints,
      levelProgress: clamp01(levelProgress),
      rankTitle,
      elo,
    };
  }, [pathsProgress, userData, ranking, myRank]);

  const board = useMemo(() => {
    const sorted = [...ranking].sort((a, b) => (b?.points || 0) - (a?.points || 0));
    const me = userData?.username;
    const idx = me ? sorted.findIndex((x) => x?.username === me) : -1;
    // Same rule as the server's rankPoints: tied scores share a place, the next score skips past them.
    // The list is the top of the ranking, so counting higher scores inside it gives the exact place.
    const rankOf = (points: number) => 1 + sorted.filter((x) => (x?.points || 0) > points).length;

    const start = idx < 0 ? 0 : Math.max(0, idx - 2);
    const end = idx < 0 ? Math.min(sorted.length, 5) : Math.min(sorted.length, idx + 3);
    const visible = sorted.slice(start, end).map((x) => ({ ...x, pos: rankOf(x?.points || 0) }));

    const myPoints = idx >= 0 ? sorted[idx]?.points || 0 : stats.points;
    const position = idx >= 0 ? rankOf(myPoints) : myRank?.rankPoints || null;
    // Neighbours are the nearest strictly higher and lower scores, so a tie never reads as a gap of 0 XP.
    const above = idx >= 0 ? ([...sorted].reverse().find((x) => (x?.points || 0) > myPoints) ?? null) : null;
    const below = idx >= 0 ? (sorted.find((x) => (x?.points || 0) < myPoints) ?? null) : null;

    return {
      window: visible,
      position,
      above,
      below,
      aboveRank: above ? rankOf(above.points || 0) : null,
      belowRank: below ? rankOf(below.points || 0) : null,
      gapUp: above ? Math.max(0, (above.points || 0) - myPoints) : 0,
      leadDown: below ? Math.max(0, myPoints - (below.points || 0)) : 0,
      myPoints,
      // Position of the user's XP on the scale between the place below (or 0) and the place above.
      scaleLow: below ? below.points || 0 : 0,
      scaleRatio: above
        ? clamp01((myPoints - (below ? below.points || 0 : 0)) / Math.max(1, (above.points || 0) - (below ? below.points || 0 : 0)))
        : 0,
    };
  }, [ranking, userData?.username, myRank, stats.points]);

  const today = useMemo(() => {
    const solved = recentWindow.filter((x) => isToday(x?.solvedAt));
    return {
      flags: solved.length,
      // `points` is the XP actually awarded for the solve, after hint penalties.
      xp: solved.reduce((sum, x) => sum + (Number(x?.points) || 0), 0),
      // A full window of today's solves may hide older ones from today, so both totals are lower bounds.
      capped: recentWindow.length >= TODAY_WINDOW && solved.length === recentWindow.length,
    };
  }, [recentWindow]);

  // The fresh recent-solved fetch wins over the (possibly cached) dashboard summary.
  const recentList = recentWindow.length > 0 ? recentWindow.slice(0, 3) : recentSolved;

  const todayStats = (
    <p className="ud-today">
      {today.flags > 0 ? (
        <>
          <span className="ud-today-label">{today.capped ? 'Dzisiaj, co najmniej' : 'Dzisiaj'}</span>
          <span className="ud-today-xp">+{formatNumberPL(today.xp)} XP</span>
          <span className="ud-today-flags">{flagsLabelPL(today.flags)}</span>
        </>
      ) : (
        <span className="ud-today-label">Dzisiaj jeszcze bez flagi. Jeden pokój wystarczy, żeby to zmienić.</span>
      )}
    </p>
  );

  if (loading) return <DashboardSkeleton />;

  if (error) {
    return (
      <div className="user-dashboard">
        <div className="ud-state">
          <h1>Dashboard się nie wczytał</h1>
          <p>{error}</p>
          <div className="ud-state-actions">
            <button type="button" className="ud-btn ud-btn-solid" onClick={() => setReloadKey((k) => k + 1)}>
              Spróbuj ponownie
            </button>
            <Link className="ud-btn ud-btn-quiet" to="/learn">
              Przejdź do ścieżek
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const totalRooms = currentPath?.totalRooms ?? 0;
  const solvedRooms = currentPath?.solvedRooms ?? 0;
  const pathRatio = totalRooms > 0 ? clamp01(solvedRooms / totalRooms) : 0;
  // The summary carries every room of the current path, in path order.
  const nextRoomIdx = currentPathRoomsMini.findIndex((r) => !r.solved && !r.locked);
  const nextRoom = nextRoomIdx >= 0 ? currentPathRoomsMini[nextRoomIdx] : null;
  const railSegments = totalRooms > 0 && totalRooms <= MAX_RAIL_SEGMENTS ? Array.from({ length: totalRooms }, (_, i) => i) : null;
  // Open paths can be solved out of order; mark the rail per room when the room list covers the whole path.
  const railFromRooms = currentPathRoomsMini.length === totalRooms;
  const segmentClass = (i: number) => {
    if (railFromRooms) return currentPathRoomsMini[i].solved ? 'is-done' : i === nextRoomIdx ? 'is-current' : '';
    return i < solvedRooms ? 'is-done' : i === solvedRooms ? 'is-current' : '';
  };
  const roomsStart = Math.max(0, Math.min(nextRoomIdx - 1, currentPathRoomsMini.length - ROOMS_SHOWN));
  const roomsShown = currentPathRoomsMini.slice(roomsStart, roomsStart + ROOMS_SHOWN);
  const xpToNext = Math.max(0, stats.nextLevelPoints - stats.points);

  return (
    <div className="user-dashboard">
      <div className="ud-shell">
        <div className="ud-main">
          {nextRoom && currentPath ? (
            <section className="ud-next" aria-labelledby="ud-next-title" data-tour="dashboard-next">
              <div className="ud-next-copy">
                <h1 className="ud-greet">
                  Cześć, {stats.username}.{' '}
                  {solvedRooms > 0
                    ? `Wracasz do ścieżki ${currentPath.title}, następny pokój to:`
                    : `Zaczynasz ścieżkę ${currentPath.title} od pokoju:`}
                </h1>
                <h2 id="ud-next-title">{nextRoom.title}</h2>
                <p>
                  Pokój {nextRoomIdx + 1} z {Math.max(totalRooms, currentPathRoomsMini.length)}
                  {nextRoom.requiresVpn ? '. Wymaga połączenia VPN.' : ''}
                </p>
              </div>
              <Link className="ud-btn ud-btn-inverse" to={roomHref(nextRoom.id, { kind: 'path', pathId: currentPath.id })}>
                Wejdź do pokoju
              </Link>
            </section>
          ) : (
            <section className="ud-next" aria-labelledby="ud-next-title" data-tour="dashboard-next">
              <div className="ud-next-copy">
                <h1 className="ud-greet">Cześć, {stats.username}.</h1>
                <h2 id="ud-next-title">{currentPath ? 'Ścieżka czeka na Ciebie' : 'Zacznij pierwszą ścieżkę'}</h2>
                <p>
                  {currentPath
                    ? 'Otwórz ścieżkę, żeby zobaczyć, który pokój jest dostępny jako następny.'
                    : 'Ścieżki prowadzą od podstaw do pierwszych prawdziwych flag, pokój po pokoju.'}
                </p>
              </div>
              <Link
                className="ud-btn ud-btn-inverse"
                to={currentPath?.id ? `/learn/paths/${currentPath.id}` : '/learn'}
              >
                {currentPath ? 'Otwórz ścieżkę' : 'Przeglądaj ścieżki'}
              </Link>
            </section>
          )}

          {board.position && (
            <a className="ud-rank-strip" href="#ud-board">
              <strong>#{board.position}</strong> w rankingu. Zobacz, kto jest obok Ciebie.
            </a>
          )}

          {currentPath && (
            <section className="ud-path" aria-labelledby="ud-path-title" data-tour="dashboard-path">
              <div className="ud-section-head">
                <h2 id="ud-path-title">{currentPath.title}</h2>
                <Link className="ud-link" to={`/learn/paths/${currentPath.id}`}>
                  Cała ścieżka
                </Link>
              </div>
              <p className="ud-path-count">
                <strong>{solvedRooms}</strong> z {totalRooms} pokoi ukończonych
              </p>

              {railSegments ? (
                <div className="ud-rail" role="img" aria-label={`Ukończono ${solvedRooms} z ${totalRooms} pokoi`}>
                  {railSegments.map((i) => (
                    <span key={i} className={segmentClass(i)} />
                  ))}
                </div>
              ) : (
                <div className="ud-meter" role="img" aria-label={`Ukończono ${solvedRooms} z ${totalRooms} pokoi`}>
                  <span style={{ '--ud-fill': pathRatio } as React.CSSProperties} />
                </div>
              )}

              {roomsShown.length > 0 && (
                <ul className="ud-rooms">
                  {roomsShown.map((r) => {
                    const status = r.locked ? 'locked' : r.solved ? 'done' : 'open';
                    const statusLabel = r.locked ? 'Zablokowany' : r.solved ? 'Ukończony' : 'Dostępny';
                    const icon = r.locked ? 'fa-lock' : r.solved ? 'fa-check' : 'fa-play';
                    const content = (
                      <>
                        <i className={`fas ${icon}`} aria-hidden="true" />
                        <span className="ud-room-title">{r.title}</span>
                        <span className="ud-room-status">{statusLabel}</span>
                      </>
                    );
                    return (
                      <li key={r.id} className={`ud-room is-${status}`}>
                        {r.locked ? (
                          <div className="ud-room-row">{content}</div>
                        ) : (
                          <Link className="ud-room-row" to={roomHref(r.id, currentPath ? { kind: 'path', pathId: currentPath.id } : { kind: 'dashboard' })}>
                            {content}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}

          <div className="ud-pair">
            <section className="ud-panel ud-level" aria-labelledby="ud-level-title" data-tour="dashboard-level">
              <h2 id="ud-level-title">
                Poziom {stats.level}, {stats.rankTitle}
              </h2>
              <p className="ud-level-xp">
                <strong>{formatNumberPL(stats.points)}</strong> XP
              </p>
              <div
                className="ud-meter"
                role="progressbar"
                aria-label="Postęp poziomu"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(stats.levelProgress * 100)}
              >
                <span style={{ '--ud-fill': stats.levelProgress } as React.CSSProperties} />
              </div>
              <p className="ud-muted">
                {xpToNext} XP do poziomu {stats.level + 1}
              </p>
              <dl className="ud-facts">
                <div>
                  <dt>Nauka w tym tygodniu</dt>
                  <dd>{formatDuration(activeSecondsThisWeek)}</dd>
                </div>
                <div>
                  <dt>Ukończone ścieżki</dt>
                  <dd>
                    {stats.completedPaths} z {stats.totalPaths}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="ud-panel ud-flags" aria-labelledby="ud-flags-title" data-tour="dashboard-flags">
              <h2 id="ud-flags-title">Ostatnio zdobyte flagi</h2>
              {recentList.length === 0 ? (
                <div className="ud-flags-empty">
                  <PixelSprite sprite={SPRITES.flag} scale={2} duration={900} className="ud-flags-sprite" />
                  <p className="ud-empty">
                    Tu pojawią się rozwiązane pokoje. Pierwszą flagę zdobędziesz w dowolnej ścieżce.
                  </p>
                </div>
              ) : (
                <ul className="ud-flag-list">
                  {recentList.map((x) => {
                    const diff = difficultyBadge(x?.difficulty);
                    return (
                      <li key={x?.roomId}>
                        <Link className="ud-flag" to={roomHref(x.roomId, { kind: 'dashboard' })}>
                          <span className="ud-flag-title">{x?.title}</span>
                          <span className={`ud-diff is-${diff.cls}`}>{diff.label}</span>
                          <span className="ud-flag-xp">+{x?.points ?? 0} XP</span>
                          <span className="ud-flag-time">{formatRelativeTimeFromIso(x?.solvedAt)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          <section className="ud-panel ud-friends" aria-labelledby="ud-friends-title" data-tour="dashboard-friends">
            <div className="ud-section-head">
              <h2 id="ud-friends-title">Twoi znajomi</h2>
              {(friends?.length ?? friendsCount) > 0 && (
                <Link className="ud-link" to="/friends">
                  Wszyscy znajomi ({friends?.length ?? friendsCount})
                </Link>
              )}
            </div>
            {friendsFailed ? (
              <p className="ud-empty">Nie udało się wczytać znajomych. Odśwież stronę, żeby spróbować ponownie.</p>
            ) : friends === null ? (
              <FriendRowsSkeleton />
            ) : friends.length === 0 ? (
              <p className="ud-empty">
                Nie masz jeszcze znajomych. Najedź na kogoś w rankingu obok i dodaj go jednym kliknięciem, a potem
                wyzwij go na pojedynek.
              </p>
            ) : (
              <ul className="ud-friend-list">
                {friends.slice(0, FRIENDS_SHOWN).map((f) => {
                  const h2h = headToHead[f.username];
                  const played = h2h ? h2h.winsAgainst + h2h.lossesAgainst : 0;
                  const state = challenges[f.username];
                  return (
                    <li key={f.id} className="ud-friend">
                      <UserAvatar className="ud-friend-avatar" username={f.username} avatar={f.avatar} alt="" />
                      <span className="ud-friend-who">
                        <ProfilePeek className="ud-friend-name" username={f.username} sessionKey={sessionKey} />
                        <span className="ud-friend-xp">
                          {formatNumberPL(f.points)} XP, poziom {levelFromPoints(f.points)}
                        </span>
                      </span>
                      <span className="ud-friend-h2h">
                        {h2h && played > 0 ? (
                          <>
                            Bilans <strong>{h2h.winsAgainst}:{h2h.lossesAgainst}</strong>
                          </>
                        ) : (
                          'Jeszcze bez pojedynku'
                        )}
                      </span>
                      <span className="ud-friend-act">
                        {state === 'sent' ? (
                          <span className="ud-friend-sent">Wyzwanie wysłane</span>
                        ) : (
                          <button
                            type="button"
                            className="ud-btn ud-btn-small"
                            onClick={() => challenge(f.username)}
                            disabled={state === 'sending'}
                          >
                            {state === 'sending' ? 'Wysyłam…' : 'Wyzwij'}
                          </button>
                        )}
                      </span>
                      {state && typeof state === 'object' && <p className="ud-friend-error">{state.error}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="ud-board" id="ud-board" aria-labelledby="ud-board-title" data-tour="dashboard-board">
          <Link className="ud-profile" to="/profile">
            <UserAvatar className="ud-avatar" username={stats.username} avatar={userData?.avatar} alt="" />
            <span className="ud-profile-who">
              <span className="ud-profile-name">{stats.username}</span>
              <span className="ud-profile-sub">
                Poziom {stats.level}, {badgesLabelPL(badgesEarnedCount)}
              </span>
            </span>
            <span className="ud-profile-cta">Profil</span>
          </Link>

          <section className="ud-board-rank">
            <div className="ud-board-head">
              <h2 id="ud-board-title" className="ud-sr-only">
                Twoje miejsce w rankingu
              </h2>
              <p className="ud-rank">{board.position ? `#${board.position}` : '–'}</p>
              <p className="ud-elo">
                {board.position ? 'w rankingu XP, ' : 'Poza rankingiem XP, '}
                <span className="ud-term">
                  <button type="button" className="ud-term-btn" aria-describedby="ud-elo-tip">
                    Elo {formatNumberPL(stats.elo)}
                    <i className="fas fa-circle-info" aria-hidden="true" />
                  </button>
                  <span role="tooltip" id="ud-elo-tip" className="ud-tip">
                    <strong>Elo to Twoja siła w pojedynkach.</strong> Grasz w Trybie rankingowym: wygrywasz, to rośnie,
                    przegrywasz, to spada. Pokonanie mocniejszego gracza daje więcej punktów. Każdy zaczyna z 500.
                    <span className="ud-tip-note">Miejsce #{board.position ?? '–'} liczymy z XP za pokoje, nie z Elo.</span>
                  </span>
                </span>
              </p>
              {todayStats}

              <p className="ud-gap">
                {board.above
                  ? `Do miejsca #${board.aboveRank} brakuje Ci ${formatNumberPL(board.gapUp)} XP.`
                  : board.below
                    ? `Prowadzisz. Przewaga nad miejscem #${board.belowRank}: ${formatNumberPL(board.leadDown)} XP.`
                    : 'Rozwiąż pokój, żeby pojawić się w rankingu.'}
              </p>
              {board.above && board.position && (
                <div className="ud-scale">
                  <div className="ud-scale-track" aria-hidden="true">
                    <span className="ud-scale-fill" style={{ '--ud-fill': board.scaleRatio } as React.CSSProperties} />
                  </div>
                  <div className="ud-scale-ends">
                    <span className="ud-scale-end">
                      <span className="ud-place">{board.below ? `#${board.belowRank}` : 'Start'}</span>
                      <span>{formatNumberPL(board.scaleLow)} XP</span>
                    </span>
                    <span className="ud-scale-end">
                      <span>{formatNumberPL(board.above.points || 0)} XP</span>
                      <span className="ud-place">#{board.aboveRank}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="ud-board-list">
              {board.window.length > 0 && (
                <ol className="ud-standings" aria-label="Ranking wokół Twojej pozycji">
                  {board.window.map((p) => {
                    const isMe = p?.username && p.username === userData?.username;
                    return (
                      <li key={`${p.pos}-${p?.username}`} className={isMe ? 'is-me' : undefined} aria-current={isMe ? 'true' : undefined}>
                        <span className="ud-pos">{p.pos}</span>
                        {p?.username ? (
                          <ProfilePeek className="ud-name" username={p.username} sessionKey={sessionKey} isMe={Boolean(isMe)} />
                        ) : (
                          <span className="ud-name">–</span>
                        )}
                        <span className="ud-pts">{formatNumberPL(p?.points || 0)} XP</span>
                      </li>
                    );
                  })}
                </ol>
              )}
              <Link className="ud-link" to="/ranking">
                Pełny ranking
              </Link>
            </div>
          </section>

          {recommendedPath && (
            <Link className="ud-reco" to={`/learn/paths/${recommendedPath.id}`}>
              <span className="ud-reco-title">{recommendedPath.title}</span>
              {recommendedPath.description && <span className="ud-reco-desc">{recommendedPath.description}</span>}
              <span className="ud-reco-foot">
                <span className="ud-reco-meta">
                  Polecana{recommendedPath.roomsCount > 0 ? `, ${roomsLabelPL(recommendedPath.roomsCount)}` : ''}
                </span>
                <span className="ud-reco-cta">Zobacz ścieżkę</span>
              </span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
};

export default UserDashboardPage;
