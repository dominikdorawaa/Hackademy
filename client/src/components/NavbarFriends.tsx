import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Search, Swords, UserPlus, Users, X } from 'lucide-react';
import UserAvatar from './UserAvatar';
import NavIconButton from './NavIconButton';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import * as friendApi from '../services/friendApi';
import * as arenaApi from '../services/arenaApi';
import * as userApi from '../services/userApi';
import type { AvatarConfig, UserSearchDto } from '../types/api';
import '../styles/presence.css';
import './NavbarFriends.css';

export const PLAYER_SEARCH_DELAY_MS = 300;
const PLAYER_SEARCH_MIN_LENGTH = 2;

const byName = (a: { username: string }, b: { username: string }) => a.username.localeCompare(b.username, 'pl');

async function failureMessage(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return body?.message || fallback;
  } catch {
    return fallback;
  }
}

interface PersonRowProps {
  username: string;
  avatar?: AvatarConfig | null;
  online?: boolean;
  onNavigate: () => void;
  children?: ReactNode;
}

function PersonRow({ username, avatar, online, onNavigate, children }: PersonRowProps) {
  return (
    <li className="nav-friends-row">
      <Link className="nav-friends-person" to={`/profile/${encodeURIComponent(username)}`} onClick={onNavigate}>
        <span className="nav-friends-avatar" data-online={online}>
          <UserAvatar username={username} avatar={avatar} alt="" />
          {online && <span className="presence-dot" aria-hidden="true" />}
        </span>
        <span className="nav-friends-name">{username}</span>
      </Link>
      {children && <span className="nav-friends-row-actions">{children}</span>}
    </li>
  );
}

// Quick access to everyday friend actions; /friends stays the place to manage the list.
export default function NavbarFriends() {
  const { sessionKey, user } = useAuth();
  const { state, synchronize } = useRealtime();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [players, setPlayers] = useState<{ query: string; results: UserSearchDto[] } | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const friends = state?.friends ?? [];
  const requests = state?.friendRequests ?? [];
  const challenged = new Set((state?.outgoingChallenges ?? []).map(challenge => challenge.targetUsername));
  const needle = query.trim().toLocaleLowerCase('pl');
  const matching = friends.filter(friend => friend.username.toLocaleLowerCase('pl').includes(needle));
  const online = matching.filter(friend => friend.online).sort(byName);
  const offline = matching.filter(friend => !friend.online).sort(byName);
  const onlineTotal = friends.filter(friend => friend.online).length;
  const searching = needle.length >= PLAYER_SEARCH_MIN_LENGTH;
  const friendNames = new Set(friends.map(friend => friend.username));
  const otherPlayers = players && players.query === needle
    ? players.results.filter(player => !friendNames.has(player.username) && player.username !== user?.username)
    : null;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !searching || !sessionKey) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await userApi.searchUsers(encodeURIComponent(needle), { sessionKey });
        const results: UserSearchDto[] = response.ok ? await response.json() : [];
        if (cancelled) return;
        setPlayers({ query: needle, results });
        if (!response.ok) setError('Nie udało się wyszukać graczy.');
      } catch {
        if (cancelled) return;
        setPlayers({ query: needle, results: [] });
        setError('Nie udało się wyszukać graczy.');
      }
    }, PLAYER_SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, searching, needle, sessionKey]);

  const run = async (key: string, action: () => Promise<Response>, fallback: string, after?: () => void) => {
    if (busy.includes(key)) return;
    setBusy(current => [...current, key]);
    setError(null);
    try {
      const response = await action();
      if (!response.ok) {
        setError(await failureMessage(response, fallback));
        return;
      }
      after?.();
      await synchronize();
    } catch {
      setError('Brak połączenia. Spróbuj ponownie.');
    } finally {
      setBusy(current => current.filter(item => item !== key));
    }
  };

  const challenge = (username: string) => run(`challenge:${username}`,
    () => arenaApi.createChallenge({ targetUsername: username }, { sessionKey }), 'Nie udało się wysłać wyzwania.');
  const accept = (id: number) => run(`request:${id}`, () => friendApi.acceptRequest(id, { sessionKey }),
    'Nie udało się przyjąć zaproszenia.');
  const reject = (id: number) => run(`request:${id}`, () => friendApi.rejectRequest(id, { sessionKey }),
    'Nie udało się odrzucić zaproszenia.');
  const invite = (username: string) => run(`invite:${username}`, () => friendApi.sendRequest(username, { sessionKey }),
    'Nie udało się wysłać zaproszenia.', () => setPlayers(current => current && {
      ...current,
      results: current.results.map(player => player.username === username ? { ...player, friendshipStatus: 'REQUEST_SENT' } : player),
    }));

  const close = () => setOpen(false);
  const label = onlineTotal ? `Znajomi online: ${onlineTotal}` : 'Znajomi, nikt nie jest online';
  const showOffline = offlineOpen || needle.length > 0;

  return (
    <div ref={rootRef} className="nav-friends">
      <NavIconButton data-slot="nav-friends" className="nav-friends-toggle" aria-label={label} aria-expanded={open}
        onClick={() => setOpen(!open)}>
        <Users aria-hidden="true" />
        {onlineTotal > 0 && (
          <span className="nav-friends-count" aria-hidden="true">
            <span className="presence-dot" />
            {onlineTotal}
          </span>
        )}
      </NavIconButton>
      {open && (
        <div className="nav-friends-dropdown" role="dialog" aria-label="Znajomi">
          <label className="nav-friends-search">
            <Search aria-hidden="true" />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Szukaj znajomych lub graczy" aria-label="Szukaj znajomych lub graczy" autoFocus />
          </label>
          {error && <p className="nav-friends-error" role="alert">{error}</p>}

          <div className="nav-friends-body">
            {!needle && requests.length > 0 && (
              <section aria-label="Zaproszenia">
                <h3 className="nav-friends-section">Zaproszenia ({requests.length})</h3>
                <ul className="nav-friends-list">
                  {requests.map(request => {
                    const pending = busy.includes(`request:${request.id}`);
                    return (
                      <PersonRow key={request.id} username={request.requesterUsername} avatar={request.avatar} onNavigate={close}>
                        <button type="button" className="nav-friends-icon is-accept" disabled={pending}
                          aria-label={`Przyjmij zaproszenie od ${request.requesterUsername}`} title="Przyjmij"
                          onClick={() => accept(request.id)}><Check aria-hidden="true" /></button>
                        <button type="button" className="nav-friends-icon" disabled={pending}
                          aria-label={`Odrzuć zaproszenie od ${request.requesterUsername}`} title="Odrzuć"
                          onClick={() => reject(request.id)}><X aria-hidden="true" /></button>
                      </PersonRow>
                    );
                  })}
                </ul>
              </section>
            )}

            <section aria-label="Znajomi online">
              <h3 className="nav-friends-section">Online ({online.length})</h3>
              {online.length === 0 ? (
                <p className="nav-friends-empty">
                  {needle ? 'Nikt z pasujących znajomych nie jest online.'
                    : friends.length ? 'Nikt z Twoich znajomych nie jest teraz online.' : 'Nie masz jeszcze znajomych. Wyszukaj graczy powyżej.'}
                </p>
              ) : (
                <ul className="nav-friends-list">
                  {online.map(friend => (
                    <PersonRow key={friend.id} username={friend.username} avatar={friend.avatar} online onNavigate={close}>
                      {challenged.has(friend.username) ? (
                        <span className="nav-friends-state">Wysłano</span>
                      ) : (
                        <button type="button" className="nav-friends-icon is-challenge"
                          disabled={busy.includes(`challenge:${friend.username}`)}
                          aria-label={`Wyzwij ${friend.username} na pojedynek`} title="Wyzwij na pojedynek"
                          onClick={() => challenge(friend.username)}><Swords aria-hidden="true" /></button>
                      )}
                    </PersonRow>
                  ))}
                </ul>
              )}
            </section>

            {offline.length > 0 && (
              <section aria-label="Znajomi offline">
                <button type="button" className="nav-friends-section is-toggle" aria-expanded={showOffline}
                  disabled={needle.length > 0} onClick={() => setOfflineOpen(!offlineOpen)}>
                  Offline ({offline.length})
                  <ChevronDown aria-hidden="true" />
                </button>
                {showOffline && (
                  <ul className="nav-friends-list">
                    {offline.map(friend => (
                      <PersonRow key={friend.id} username={friend.username} avatar={friend.avatar} online={false} onNavigate={close} />
                    ))}
                  </ul>
                )}
              </section>
            )}

            {searching && (
              <section aria-label="Inni gracze">
                <h3 className="nav-friends-section">Inni gracze</h3>
                {otherPlayers === null ? (
                  <p className="nav-friends-empty">Szukam…</p>
                ) : otherPlayers.length === 0 ? (
                  <p className="nav-friends-empty">Brak innych graczy o tej nazwie.</p>
                ) : (
                  <ul className="nav-friends-list">
                    {otherPlayers.map(player => (
                      <PersonRow key={player.id} username={player.username} avatar={player.avatar} onNavigate={close}>
                        {player.friendshipStatus === 'REQUEST_SENT' ? (
                          <span className="nav-friends-state">Wysłano</span>
                        ) : player.friendshipStatus === 'REQUEST_RECEIVED' ? (
                          <span className="nav-friends-state">Zaprasza Cię</span>
                        ) : (
                          <button type="button" className="nav-friends-icon"
                            disabled={busy.includes(`invite:${player.username}`)}
                            aria-label={`Dodaj ${player.username} do znajomych`} title="Dodaj do znajomych"
                            onClick={() => invite(player.username)}><UserPlus aria-hidden="true" /></button>
                        )}
                      </PersonRow>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          <Link to="/friends" className="nav-friends-all" onClick={close}>
            Zarządzaj znajomymi
          </Link>
        </div>
      )}
    </div>
  );
}
