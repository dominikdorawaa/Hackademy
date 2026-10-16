import UserAvatar from '../components/UserAvatar';
import ProfilePeek from '../components/ProfilePeek';
import * as userApi from '../services/userApi';
import * as arenaApi from '../services/arenaApi';
import * as friendApi from '../services/friendApi';
import * as rankingApi from '../services/rankingApi';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { Link } from 'react-router-dom';
import { levelFromPoints } from '../lib/level';
import { LEAGUES, leagueFor } from '../components/arena/leagues';
import type { DashboardUser, FriendDto, RankingEntry, UserSearchDto } from '../types/api';
import './UserDashboardPage.css';
import './ArenaPage.css';

type ArenaStatus = 'IDLE' | 'QUEUE' | 'GAME' | 'FINISHED' | 'CHALLENGING';
type FriendChallenge = 'sending' | { error: string };

const UNLOCK_LEVEL = 5;
const UNLOCK_POINTS = (UNLOCK_LEVEL - 1) * 100;
const FRIENDS_SHOWN = 6;
const formatNumberPL = (n: number) => (Number(n) || 0).toLocaleString('pl-PL');

const ArenaPage = () => {
    const { token } = useAuth();
    const [userData, setUserData] = useState<DashboardUser | null>(null);
    const [myRank, setMyRank] = useState<RankingEntry | null>(null);
    const { state: realtime, connected, synchronize } = useRealtime();
    const [joiningQueue, setJoiningQueue] = useState(false);
    const gameSession = realtime?.gameSession ?? null;
    const challenges = realtime?.challenges ?? [];
    const status: ArenaStatus = gameSession && gameSession.status !== 'FINISHED' ? 'GAME'
        : realtime?.queued ? 'QUEUE' : realtime?.outgoingChallenges.length ? 'CHALLENGING' : 'IDLE';
    const [error, setError] = useState<string | null>(null);
    const [friends, setFriends] = useState<FriendDto[] | null>(null);
    const [friendsFailed, setFriendsFailed] = useState(false);
    const [headToHead, setHeadToHead] = useState<Record<string, UserSearchDto>>({});
    const [friendChallenges, setFriendChallenges] = useState<Record<string, FriendChallenge>>({});
    const challengedFriends = (realtime?.outgoingChallenges ?? []).map(challenge => challenge.targetUsername);
    const [processingChallengeId, setProcessingChallengeId] = useState<string | null>(null);
    const [acceptedChallenges, setAcceptedChallenges] = useState<string[]>([]);
    const [challengeError, setChallengeError] = useState<string | null>(null);

    useEffect(() => {
        const headers = { Authorization: `Bearer ${token}` };
        userApi.getCurrentUser(headers)
            .then(response => response.ok ? response.json() : null)
            .then(data => { if (data) setUserData(data); })
            .catch(err => console.error('Failed to fetch user data', err));
        rankingApi.getSummary(headers)
            .then(response => response.ok ? response.json() : null)
            .then(data => setMyRank(data?.myRank ?? null))
            .catch(() => undefined);
        friendApi.getFriends(headers)
            .then(async response => {
                if (!response.ok) throw new Error('friends');
                const list: FriendDto[] = await response.json();
                setFriends(list);
                const stats = await Promise.all(list.slice(0, FRIENDS_SHOWN).map(async friend => {
                    try {
                        const r = await friendApi.getStats(friend.username, headers);
                        return r.ok ? [friend.username, await r.json()] as const : null;
                    } catch { return null; }
                }));
                setHeadToHead(Object.fromEntries(stats.filter(item => item !== null)));
            })
            .catch(() => setFriendsFailed(true));
    }, [token]);

    const handleChallengeFriend = async (username: string) => {
        setFriendChallenges(previous => ({ ...previous, [username]: 'sending' }));
        try {
            const response = await arenaApi.createChallenge({ targetUsername: username, vpnEnabled: false }, {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            });
            if (response.ok) {
                setFriendChallenges(previous => { const next = { ...previous }; delete next[username]; return next; });
                await synchronize();
            } else {
                const data = await response.json();
                setFriendChallenges(previous => ({ ...previous, [username]: { error: data.message ?? 'Nie udało się wysłać wyzwania.' } }));
            }
        } catch {
            setFriendChallenges(previous => ({ ...previous, [username]: { error: 'Błąd sieci. Spróbuj ponownie.' } }));
        }
    };

    const handleJoinQueue = async () => {
        if (joiningQueue || !connected || !realtime) return;
        setJoiningQueue(true);
        setError(null);
        try {
            const response = await arenaApi.joinQueue({ vpnEnabled: false }, {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            });
            if (response.ok) {
                setJoiningQueue(false);
                void synchronize();
            } else {
                const data = await response.json();
                setError(data.message ?? 'Nie udało się dołączyć do kolejki.');
            }
        } catch {
            setError('Błąd sieci. Spróbuj ponownie.');
        } finally {
            setJoiningQueue(false);
        }
    };

    const handleLeaveQueue = async () => {
        try {
            const response = await arenaApi.leaveQueue({ 'Authorization': `Bearer ${token}` });
            if (!response.ok) throw new Error('Cannot leave queue');
            await synchronize();
        } catch (err) {
            console.error('Error leaving queue', err);
        }
    };

    const handleCancelChallenges = async () => {
        try {
            for (const challenge of realtime?.outgoingChallenges ?? []) {
                const response = await arenaApi.cancelChallenge(challenge.id, { Authorization: `Bearer ${token}` });
                if (!response.ok) throw new Error('Cannot cancel challenge');
            }
            await synchronize();
        } catch {
            setError('Nie udało się anulować wyzwania.');
        }
    };

    const handleAcceptChallenge = async (challengeId: string) => {
        if (processingChallengeId === challengeId || acceptedChallenges.includes(challengeId)) return;
        setProcessingChallengeId(challengeId);
        setChallengeError(null);
        try {
            const response = await arenaApi.acceptChallenge(challengeId, { 'Authorization': `Bearer ${token}` });
            if (response.ok) {
                setAcceptedChallenges(prev => [...prev, challengeId]);
                await synchronize();
            } else {
                const data = await response.json();
                setChallengeError(data.message ?? 'Nie udało się przyjąć wyzwania.');
            }
        } catch {
            setChallengeError('Błąd sieci. Spróbuj ponownie.');
        } finally {
            setProcessingChallengeId(null);
        }
    };

    const handleRejectChallenge = async (challengeId: string) => {
        if (processingChallengeId === challengeId) return;
        setProcessingChallengeId(challengeId);
        try {
            const response = await arenaApi.rejectChallenge(challengeId, { 'Authorization': `Bearer ${token}` });
            if (!response.ok) throw new Error('Cannot reject challenge');
            await synchronize();
        } catch (err) {
            console.error('Error rejecting challenge', err);
        } finally {
            setProcessingChallengeId(null);
        }
    };

    if (!userData) return <div className="user-dashboard"><div className="ud-shell"><p role="status" className="ud-empty">Ładowanie Areny…</p></div></div>;

    const level = levelFromPoints(userData.points);
    const canPlay = level >= UNLOCK_LEVEL;
    const missing = Math.max(0, UNLOCK_POINTS - userData.points);
    const offline = !connected || !realtime;
    const elo = myRank?.elo ?? 500;
    const opponent = gameSession ? (gameSession.player1Id === userData.id ? gameSession.player2Username : gameSession.player1Username) : '';
    const searching = status === 'QUEUE' || joiningQueue;
    const { league, next } = leagueFor(elo);
    const headline = status === 'GAME' ? 'Walka trwa' : searching ? 'Szukamy rywala' : status === 'CHALLENGING' ? 'Czekamy na odpowiedź' : canPlay ? 'Wejdź na arenę' : 'Arena od poziomu 5';

    return (
        <div className="user-dashboard arena-page" id="arena">
            <div className="ud-shell">
                <div className="ud-main">
                    <section className="arena-hero" aria-labelledby="arena-title" style={{ '--league': league.color } as React.CSSProperties}>
                        <div className="arena-card">
                            <div className="arena-card-top">
                                <span className="arena-league">Liga {league.name}</span>
                                <span className="arena-card-rank">{myRank?.rankElo ? `#${myRank.rankElo} w rankingu Elo` : 'Poza rankingiem Elo'}</span>
                            </div>
                            <UserAvatar className="arena-card-portrait" username={userData.username} seed={userData.avatarSeed} avatar={userData.avatar} alt="" />
                            <p className="arena-card-name">{userData.username}</p>
                            <p className="arena-card-elo">
                                <span className="arena-card-number">{elo}</span>
                                <span className="ud-term">
                                    <button type="button" className="ud-term-btn" aria-describedby="arena-elo-tip">
                                        Elo
                                        <i className="fas fa-circle-info" aria-hidden="true" />
                                    </button>
                                    <span role="tooltip" id="arena-elo-tip" className="ud-tip">
                                        <strong>Elo to Twoja siła w pojedynkach.</strong> Wygrywasz, to rośnie, przegrywasz, to spada.
                                        Pokonanie mocniejszego gracza daje więcej punktów. Każdy zaczyna z 500.
                                    </span>
                                </span>
                            </p>
                            {next ? (
                                <div className="arena-card-next">
                                    <div className="ud-meter" role="progressbar" aria-label={`Postęp do ligi ${next.name}`} aria-valuemin={league.min} aria-valuemax={next.min} aria-valuenow={elo}>
                                        <span style={{ '--ud-fill': Math.min(1, Math.max(0, (elo - league.min) / (next.min - league.min))) } as React.CSSProperties} />
                                    </div>
                                    <p>Do ligi {next.name} brakuje Ci {formatNumberPL(next.min - elo)} Elo.</p>
                                </div>
                            ) : (
                                <p className="arena-card-next">Najwyższa liga. Broń swojego miejsca.</p>
                            )}
                            <Link className="arena-card-edit" to="/arena/avatar">{userData.avatar ? 'Edytuj awatar' : 'Stwórz awatar'}</Link>
                        </div>
                        <div className="arena-hero-main">
                        <div className="arena-console-copy">
                            <p className="arena-kicker">Tryb rankingowy</p>
                            <h1 id="arena-title" className="arena-title">{headline}</h1>
                            {status === 'GAME' && gameSession ? (
                                <p role="status">Masz trwający mecz z {opponent}.</p>
                            ) : status === 'QUEUE' || joiningQueue ? (
                                <p role="status" aria-live="polite" className="arena-waiting">
                                    <span className="arena-pulse" aria-hidden="true" />
                                    {joiningQueue && status !== 'QUEUE' ? 'Dołączanie do kolejki...' : 'Szukanie przeciwnika...'}
                                </p>
                            ) : status === 'CHALLENGING' ? (
                                <p role="status" aria-live="polite" className="arena-waiting">
                                    <span className="arena-pulse" aria-hidden="true" />
                                    Oczekiwanie na akceptację wyzwania...
                                </p>
                            ) : canPlay ? (
                                <p>Rywal dostaje ten sam pokój co Ty. Szybsza flaga wygrywa i zabiera mu punkty Elo.</p>
                            ) : (
                                <>
                                    <p>Pojedynki odblokujesz na poziomie {UNLOCK_LEVEL}. Brakuje Ci {formatNumberPL(missing)} XP.</p>
                                    <div className="ud-meter arena-unlock" role="progressbar" aria-label="Postęp do odblokowania Areny" aria-valuemin={0} aria-valuemax={UNLOCK_POINTS} aria-valuenow={Math.min(userData.points, UNLOCK_POINTS)}>
                                        <span style={{ '--ud-fill': Math.min(1, userData.points / UNLOCK_POINTS) } as React.CSSProperties} />
                                    </div>
                                </>
                            )}
                            {offline && <p role="status" className="arena-note">Łączenie z Areną. Poczekaj na połączenie z serwerem.</p>}
                            {error && <p role="alert" className="arena-error">{error}</p>}
                        </div>
                        <ol className="arena-ladder" aria-label="Ligi Areny">
                            {LEAGUES.map(item => (
                                <li key={item.name} className={item === league ? "is-current" : elo >= item.min ? "is-reached" : undefined} style={{ '--tier': item.color } as React.CSSProperties} aria-current={item === league ? "true" : undefined}>
                                    <span className="arena-ladder-bar" aria-hidden="true" />
                                    <span className="arena-ladder-name">{item.name}</span>
                                    <span className="arena-ladder-min">{item.min === 0 ? "start" : `od ${item.min}`}</span>
                                </li>
                            ))}
                        </ol>
                        <div className="arena-console-actions">
                            {status === 'GAME' && gameSession ? (
                                <Link className="ud-btn arena-go" to={`/rooms/${gameSession.roomId}?arena=${gameSession.id}`}>Wróć do meczu</Link>
                            ) : status === 'QUEUE' || joiningQueue ? (
                                <button type="button" className="ud-btn ud-btn-quiet" onClick={handleLeaveQueue} disabled={joiningQueue && status !== 'QUEUE'}>Anuluj</button>
                            ) : status === 'CHALLENGING' ? (
                                <button type="button" className="ud-btn ud-btn-quiet" onClick={handleCancelChallenges}>Anuluj</button>
                            ) : canPlay ? (
                                <button type="button" className="ud-btn arena-go" onClick={handleJoinQueue} disabled={offline}>Znajdź przeciwnika</button>
                            ) : (
                                <Link className="ud-btn arena-go" to="/learn">Rozwiązuj pokoje</Link>
                            )}
                        </div>
                        </div>
                    </section>

                    {challenges.length > 0 && (
                        <section className="ud-panel" aria-labelledby="arena-challenges-title">
                            <div className="ud-section-head">
                                <h2 id="arena-challenges-title">Otrzymane wyzwania ({challenges.length})</h2>
                            </div>
                            <ul className="ud-friend-list">
                                {challenges.map(challenge => {
                                    const accepted = acceptedChallenges.includes(challenge.id);
                                    const busy = processingChallengeId === challenge.id;
                                    return (
                                        <li key={challenge.id} className="ud-friend arena-challenge">
                                            <UserAvatar className="ud-friend-avatar" username={challenge.challengerUsername} seed={challenge.challengerAvatarSeed} alt="" />
                                            <span className="ud-friend-who">
                                                <ProfilePeek className="ud-friend-name" username={challenge.challengerUsername} token={token} />
                                                <span className="ud-friend-xp">Wyzywa Cię na pojedynek</span>
                                            </span>
                                            <span className="ud-friend-act arena-challenge-act">
                                                {!accepted && (
                                                    <button type="button" className="ud-btn ud-btn-small arena-reject" onClick={() => handleRejectChallenge(challenge.id)} disabled={busy}>Odrzuć</button>
                                                )}
                                                <button type="button" className="ud-btn ud-btn-small ud-btn-solid" onClick={() => handleAcceptChallenge(challenge.id)} disabled={busy || accepted}>
                                                    {accepted ? 'Zaakceptowano' : 'Akceptuj'}
                                                </button>
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                            {challengeError && <p role="alert" className="arena-error">{challengeError}</p>}
                        </section>
                    )}
                </div>

                <aside className="ud-board arena-board" aria-label="Znajomi i zasady">
                    <section className="arena-board-friends" aria-labelledby="arena-friends-title">
                        <div className="ud-section-head">
                            <h2 id="arena-friends-title">Wyzwij znajomego</h2>
                            {friends && friends.length > 0 && <Link className="ud-link" to="/friends">Wszyscy znajomi ({friends.length})</Link>}
                        </div>
                        {friendsFailed ? (
                            <p className="ud-empty">Nie udało się wczytać znajomych. Odśwież stronę, żeby spróbować ponownie.</p>
                        ) : friends === null ? (
                            <p className="ud-empty">Wczytuję znajomych…</p>
                        ) : friends.length === 0 ? (
                            <p className="ud-empty">Nie masz jeszcze znajomych. Dodaj kogoś z rankingu, a potem wyzwij go tutaj na pojedynek.</p>
                        ) : (
                            <ul className="ud-friend-list">
                                {friends.slice(0, FRIENDS_SHOWN).map(friend => {
                                    const h2h = headToHead[friend.username];
                                    const played = h2h ? h2h.winsAgainst + h2h.lossesAgainst : 0;
                                    const state = friendChallenges[friend.username];
                                    const sent = challengedFriends.includes(friend.username);
                                    return (
                                        <li key={friend.id} className="ud-friend">
                                            <UserAvatar className="ud-friend-avatar" username={friend.username} seed={friend.avatarSeed} avatar={friend.avatar} alt="" />
                                            <span className="ud-friend-who">
                                                <ProfilePeek className="ud-friend-name" username={friend.username} token={token} />
                                                <span className="ud-friend-xp">{formatNumberPL(friend.points)} XP, poziom {levelFromPoints(friend.points)}</span>
                                            </span>
                                            <span className="ud-friend-h2h">
                                                {h2h && played > 0 ? <>Bilans <strong>{h2h.winsAgainst}:{h2h.lossesAgainst}</strong></> : 'Jeszcze bez pojedynku'}
                                            </span>
                                            <span className="ud-friend-act">
                                                {sent ? (
                                                    <span className="ud-friend-sent">Wyzwanie wysłane</span>
                                                ) : (
                                                    <button type="button" className="ud-btn ud-btn-small" onClick={() => handleChallengeFriend(friend.username)}
                                                        disabled={!canPlay || offline || status !== 'IDLE' || state === 'sending'}>
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
                    <section aria-labelledby="arena-rules-title">
                        <h2 id="arena-rules-title" className="arena-board-title">Zasady pojedynków rankingowych</h2>
                        <ol className="arena-rules">
                            <li>Kolejka łączy Cię z kolejnym czekającym graczem albo grasz z wyzwanym znajomym.</li>
                            <li>Oboje dostajecie ten sam pokój i startujecie w tej samej chwili.</li>
                            <li>Wygrywa krótszy czas zdobycia flagi. Każda podpowiedź dolicza 2 minuty.</li>
                            <li>Poddanie meczu oznacza porażkę. Elo zmienia się po każdym rozstrzygniętym meczu.</li>
                        </ol>
                        <Link className="ud-link" to="/ranking">Pełny ranking</Link>
                    </section>
                </aside>
            </div>
        </div>
    );
};

export default ArenaPage;
