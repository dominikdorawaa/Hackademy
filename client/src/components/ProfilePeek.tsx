import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import UserAvatar from './UserAvatar';
import { LoadingSkeleton, Skeleton } from './common/Skeleton';
import * as userApi from '../services/userApi';
import * as friendApi from '../services/friendApi';
import { levelFromPoints, rankTitleFromPoints } from '../lib/level';
import type { FriendshipStatus, UserProfileDto, UserSearchDto } from '../types/api';

interface PeekData {
  profile: UserProfileDto;
  stats: UserSearchDto | null;
}

// Profiles change rarely while a dashboard is open; one fetch per username is enough.
// The friendship part depends on who is signed in, so the cache belongs to one token and is dropped when it changes.
const peekCache = new Map<string, PeekData>();
let peekCacheToken: string | null = null;

const cacheFor = (token: string | null) => {
  if (token !== peekCacheToken) {
    peekCache.clear();
    peekCacheToken = token;
  }
  return peekCache;
};

const OPEN_DELAY_MS = 250;
const CLOSE_DELAY_MS = 150;

interface ProfilePeekProps {
  username: string;
  token: string | null;
  isMe?: boolean;
  className?: string;
}

const ProfilePeek = ({ username, token, isMe = false, className }: ProfilePeekProps) => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PeekData | null>(() => cacheFor(token).get(username) ?? null);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Once the visitor acts inside the card it stays open until they click elsewhere or press Escape.
  const [pinned, setPinned] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const rootRef = useRef<HTMLSpanElement>(null);
  const cardId = useId();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (!pinned) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pinned]);

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const load = async () => {
    const cached = cacheFor(token).get(username);
    if (cached) {
      setData(cached);
      return;
    }
    try {
      const [profileRes, statsRes] = await Promise.all([
        userApi.getProfile(username, headers),
        isMe ? Promise.resolve(null) : friendApi.getStats(username, headers),
      ]);
      if (!profileRes.ok) throw new Error('profile');
      const profile = await profileRes.json();
      const stats = statsRes && statsRes.ok ? await statsRes.json() : null;
      const next = { profile, stats };
      cacheFor(token).set(username, next);
      setData(next);
    } catch {
      setFailed(true);
    }
  };

  const show = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setOpen(true);
      if (!data) load();
    }, OPEN_DELAY_MS);
  };

  const hide = () => {
    window.clearTimeout(timer.current);
    if (pinned) return;
    timer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  const close = () => {
    window.clearTimeout(timer.current);
    setPinned(false);
    setOpen(false);
  };

  const setStatus = (status: FriendshipStatus) => {
    if (!data?.stats) return;
    const next = { ...data, stats: { ...data.stats, friendshipStatus: status } };
    cacheFor(token).set(username, next);
    setData(next);
  };

  const addFriend = async () => {
    setPinned(true);
    setSending(true);
    setSendError(null);
    try {
      const res = await friendApi.sendRequest(username, headers);
      if (res.ok) {
        setStatus('REQUEST_SENT');
      } else {
        const body = await res.json();
        setSendError(body?.message || 'Nie udało się wysłać zaproszenia.');
      }
    } catch {
      setSendError('Brak połączenia. Spróbuj ponownie.');
    } finally {
      setSending(false);
    }
  };

  const profile = data?.profile;
  const stats = data?.stats;
  const earnedBadges = (profile?.badges ?? []).filter((b) => b.earned).slice(0, 3);

  const action = () => {
    if (isMe || !stats) return null;
    switch (stats.friendshipStatus) {
      case 'NONE':
        return (
          <button type="button" className="ud-peek-action" onClick={addFriend} disabled={sending}>
            {sending ? 'Wysyłam…' : 'Dodaj do znajomych'}
          </button>
        );
      case 'REQUEST_SENT':
        return (
          <span className="ud-peek-state" role="status">
            <i className="fas fa-check" aria-hidden="true" /> Zaproszenie wysłane
          </span>
        );
      case 'REQUEST_RECEIVED':
        return (
          <Link className="ud-peek-action" to="/friends">
            Odpowiedz na zaproszenie
          </Link>
        );
      case 'FRIENDS':
        return <span className="ud-peek-state">Jesteście znajomymi</span>;
      default:
        return null;
    }
  };

  const profilePath = isMe ? '/profile' : `/profile/${encodeURIComponent(username)}`;

  return (
    <span
      ref={rootRef}
      className={`ud-peek ${className ?? ''}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') close();
      }}
    >
      <Link
        className="ud-peek-link"
        to={profilePath}
        aria-describedby={open ? cardId : undefined}
      >
        {username}
      </Link>
      {open && (
        <span className="ud-peek-card" id={cardId} role="group" aria-label={`Podgląd profilu ${username}`}>
          {!profile && !failed && <LoadingSkeleton as="span" label="Wczytuję profil" className="ud-peek-head">
            <Skeleton className="ud-peek-avatar" radius="50%" />
            <span className="ud-peek-who hk-skeleton-pair"><Skeleton width={120} height={16} /><Skeleton width={160} height={12} /></span>
          </LoadingSkeleton>}
          {failed && <span className="ud-peek-loading">Nie udało się wczytać profilu.</span>}
          {profile && (
            <>
              <span className="ud-peek-head">
                <UserAvatar className="ud-peek-avatar" username={profile.username} seed={profile.avatarSeed} alt="" />
                <span className="ud-peek-who">
                  <span className="ud-peek-name">{profile.username}</span>
                  <span className="ud-peek-level">
                    Poziom {levelFromPoints(profile.points)}, {rankTitleFromPoints(profile.points)}
                  </span>
                </span>
              </span>
              {profile.tagline && <span className="ud-peek-tagline">{profile.tagline}</span>}
              <span className="ud-peek-facts">
                <span>
                  <strong>{(Number(profile.points) || 0).toLocaleString('pl-PL')}</strong> XP
                </span>
                <span className="ud-peek-streak">
                  <i className="fas fa-fire" aria-hidden="true" />
                  Seria <strong>{profile.streak ?? 0}</strong> {(profile.streak ?? 0) === 1 ? 'dzień' : 'dni'}
                </span>
                {stats?.friendshipStatus === 'FRIENDS' && (
                  <span>
                    Bilans <strong>{stats.winsAgainst}:{stats.lossesAgainst}</strong>
                  </span>
                )}
              </span>
              {earnedBadges.length > 0 && (
                <span className="ud-peek-badges">
                  {earnedBadges.map((b) => (
                    <span key={b.id} className="ud-peek-badge">
                      {b.name}
                    </span>
                  ))}
                </span>
              )}
              <span className="ud-peek-actions">
                {action()}
                <Link className="ud-peek-secondary" to={profilePath}>
                  <i className="fas fa-user" aria-hidden="true" />
                  Zobacz profil
                </Link>
              </span>
              {sendError && <span className="ud-peek-error">{sendError}</span>}
            </>
          )}
        </span>
      )}
    </span>
  );
};

export default ProfilePeek;
