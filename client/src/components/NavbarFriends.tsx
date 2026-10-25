import { useEffect, useRef, useState } from 'react';
import { friendActivity } from '../lib/friendStatus';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown, Search, Undo2, UserPlus, Users, X } from 'lucide-react';
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

const PLAYER_SEARCH_DELAY_MS = 300;
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
  status?: string | null;
  onNavigate: () => void;
  children?: ReactNode;
}

function PersonRow({ username, avatar, online, status, onNavigate, children }: PersonRowProps) {
  return (
    <li className="nav-friends-row">
      <Link className="nav-friends-person" to={`/profile/${encodeURIComponent(username)}`} onClick={onNavigate}>
        <span className="nav-friends-avatar" data-online={online}>
          <UserAvatar username={username} avatar={avatar} alt="" />
          {online && <span className="presence-dot" aria-hidden="true" />}
        </span>
        <span className="nav-friends-who">
          <span className="nav-friends-name">{username}</span>
          {status && <>{' '}<span className="nav-friends-status">{status}</span></>}
        </span>
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
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  // On touch screens focusing the field would throw the keyboard over the list on every open.
  const focusSearch = typeof window.matchMedia !== 'function' || !window.matchMedia('(pointer: coarse)').matches;

  const friends = state?.friends ?? [];
  const requests = state?.friendRequests ?? [];
  const challenged = new Map((state?.outgoingChallenges ?? []).map(challenge => [challenge.targetUsername, challenge.id]));
  // Pending challenges and the queue run side by side; the server lets the first game to start win.
  const challengeBlocked = state?.gameSession && state.gameSession.status !== 'FINISHED'
    ? 'Trwa Twój pojedynek. Wyzwania wrócą po nim.' : null;
  const needle = query.trim().toLocaleLowerCase('pl');
  const matching = friends.filter(friend => friend.username.toLocaleLowerCase('pl').includes(needle));
  const online = matching.filter(friend => friend.online).sort(byName);
  const offline = matching.filter(friend => !friend.online).sort(byName);
  const onlineTotal = friends.filter(friend => friend.online).length;
  const searching = needle.length >= PLAYER_SEARCH_MIN_LENGTH;
  const receivedFrom = new Map(requests.map(request => [request.requesterUsername, request.id]));
  const friendNames = new Set(friends.map(friend => friend.username));
  const otherPlayers = players && players.query === needle
    ? players.results
      .filter(player => !friendNames.has(player.username) && player.username !== user?.username)
      // Requests arrive live while the results stay put, so the live list wins over the searched status.
      .map(player => receivedFrom.has(player.username) ? { ...player, friendshipStatus: 'REQUEST_RECEIVED' as const }
        : player.friendshipStatus === 'REQUEST_RECEIVED' ? { ...player, friendshipStatus: 'NONE' as const } : player)
    : null;

  // A friend may go offline while the challenge waits; it can be taken back from either list.
  const sentChallenge = (username: string) => (
    <>
      <span className="nav-friends-state">Wysłano</span>
      <button type="button" className="nav-friends-action" disabled={busy.includes(`cancel:${username}`)}
        aria-label={`Cofnij wyzwanie dla ${username}`} onClick={() => cancelChallenge(username, challenged.get(username)!)}>
        <Undo2 aria-hidden="true" />Cofnij
      </button>
    </>
  );

  const close = () => {
    setOpen(false);
    setQuery('');
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      toggleRef.current?.focus();
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
        setError(response.ok ? null : 'Nie udało się wyszukać graczy.');
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
  const cancelChallenge = (username: string, id: string) => run(`cancel:${username}`,
    () => arenaApi.cancelChallenge(id, { sessionKey }), 'Nie udało się cofnąć wyzwania.');
  const accept = (id: number) => run(`request:${id}`, () => friendApi.acceptRequest(id, { sessionKey }),
    'Nie udało się przyjąć zaproszenia.');
  const reject = (id: number) => run(`request:${id}`, () => friendApi.rejectRequest(id, { sessionKey }),
    'Nie udało się odrzucić zaproszenia.');
  const invite = (username: string) => run(`invite:${username}`, () => friendApi.sendRequest(username, { sessionKey }),
    'Nie udało się wysłać zaproszenia.', () => setPlayers(current => current && {
      ...current,
      results: current.results.map(player => player.username === username ? { ...player, friendshipStatus: 'REQUEST_SENT' } : player),
    }));

  const label = onlineTotal ? `Znajomi online: ${onlineTotal}` : 'Znajomi, nikt nie jest online';
  const showOffline = offlineOpen || needle.length > 0;

  return (
    <div ref={rootRef} className="nav-friends">
      <NavIconButton data-slot="nav-friends" className="nav-friends-toggle" ref={toggleRef} aria-label={label}
        aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>
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
              placeholder="Szukaj znajomych lub graczy" aria-label="Szukaj znajomych lub graczy" autoFocus={focusSearch} />
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
                        <button type="button" className="nav-friends-action is-accept" disabled={pending}
                          aria-label={`Przyjmij zaproszenie od ${request.requesterUsername}`}
                          onClick={() => accept(request.id)}><Check aria-hidden="true" />Przyjmij</button>
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
              {challengeBlocked && online.length > 0 && <p className="nav-friends-note">{challengeBlocked}</p>}
              {online.length === 0 ? (
                <p className="nav-friends-empty">
                  {needle ? 'Nikt z pasujących znajomych nie jest online.'
                    : friends.length ? 'Nikt z Twoich znajomych nie jest teraz online.' : 'Nie masz jeszcze znajomych. Wyszukaj graczy powyżej.'}
                </p>
              ) : (
                <ul className="nav-friends-list">
                  {online.map(friend => (
                    <PersonRow key={friend.id} username={friend.username} avatar={friend.avatar} online status={friendActivity(friend)} onNavigate={close}>
                      {challenged.has(friend.username) ? (
                        sentChallenge(friend.username)
                      ) : challengeBlocked ? null : (
                        <button type="button" className="nav-friends-action is-challenge"
                          disabled={busy.includes(`challenge:${friend.username}`)}
                          aria-label={`Wyzwij ${friend.username} na pojedynek`}
                          onClick={() => challenge(friend.username)}>Wyzwij</button>
                      )}
                    </PersonRow>
                  ))}
                </ul>
              )}
            </section>

            {offline.length > 0 && (
              <section aria-label="Znajomi offline">
                {needle ? (
                  <h3 className="nav-friends-section">Offline ({offline.length})</h3>
                ) : (
                  <h3 className="nav-friends-heading">
                    <button type="button" className="nav-friends-section is-toggle" aria-expanded={offlineOpen}
                      onClick={() => setOfflineOpen(!offlineOpen)}>
                      Offline ({offline.length})
                      <ChevronDown aria-hidden="true" />
                    </button>
                  </h3>
                )}
                {showOffline && (
                  <ul className="nav-friends-list">
                    {offline.map(friend => (
                      <PersonRow key={friend.id} username={friend.username} avatar={friend.avatar} online={false} status={friendActivity(friend)} onNavigate={close}>
                        {challenged.has(friend.username) && sentChallenge(friend.username)}
                      </PersonRow>
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
                          receivedFrom.get(player.username) !== undefined ? (
                            <button type="button" className="nav-friends-action is-accept"
                              disabled={busy.includes(`request:${receivedFrom.get(player.username)}`)}
                              aria-label={`Przyjmij zaproszenie od ${player.username}`}
                              onClick={() => accept(receivedFrom.get(player.username)!)}><Check aria-hidden="true" />Przyjmij</button>
                          ) : <span className="nav-friends-state">Zaprasza Cię</span>
                        ) : (
                          <button type="button" className="nav-friends-action"
                            disabled={busy.includes(`invite:${player.username}`)}
                            aria-label={`Dodaj ${player.username} do znajomych`}
                            onClick={() => invite(player.username)}><UserPlus aria-hidden="true" />Dodaj</button>
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
