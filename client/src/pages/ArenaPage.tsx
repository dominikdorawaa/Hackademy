import UserAvatar from '../components/UserAvatar';
import ProfilePeek from '../components/ProfilePeek';
import * as userApi from '../services/userApi';
import * as arenaApi from '../services/arenaApi';
import * as rankingApi from '../services/rankingApi';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { Link } from 'react-router-dom';
import { levelFromPoints } from '../lib/level';
import { LEAGUES, leagueFor, leagueProgress } from '../components/arena/leagues';
import { LeagueIcon } from '../components/arena/LeagueIcon';
import { EloHelp } from '../components/arena/EloHelp';
import { ArenaLoader, ArenaRunner } from '../components/arena/ArenaLoader';
import { FriendRowsSkeleton } from '../components/FriendRowsSkeleton';
import type { DashboardUser, RankingEntry } from '../types/api';
import './UserDashboardPage.css';
import './ArenaPage.css';

type ArenaStatus = 'IDLE' | 'QUEUE' | 'GAME' | 'FINISHED';
type FriendChallenge = 'sending' | { error: string };

const FRIENDS_SHOWN = 6;
const formatNumberPL = (n: number) => (Number(n) || 0).toLocaleString('pl-PL');

const ArenaPage = () => {
    const { sessionKey } = useAuth();
    const [userData, setUserData] = useState<DashboardUser | null>(null);
    const [userFailed, setUserFailed] = useState(false);
    const [userAttempt, setUserAttempt] = useState(0);
    const [rank, setRank] = useState<{ status: 'loading' | 'ready' | 'error'; entry: RankingEntry | null }>({ status: 'loading', entry: null });
    const { state: realtime, connected, synchronize, error: realtimeError } = useRealtime();
    const [joiningQueue, setJoiningQueue] = useState(false);
    const gameSession = realtime?.gameSession ?? null;
    const challenges = realtime?.challenges ?? [];
    const status: ArenaStatus = gameSession && gameSession.status !== 'FINISHED' ? 'GAME'
        : realtime?.queued ? 'QUEUE' : 'IDLE';
    const [error, setError] = useState<string | null>(null);
    const friends = realtime?.friends ?? null;
    const friendsFailed = !!realtimeError;
    const headToHead = Object.fromEntries((friends ?? []).map(friend => [friend.username, friend]));
    const statsLoading = !realtime;
    const [friendChallenges, setFriendChallenges] = useState<Record<string, FriendChallenge>>({});
    const outgoing = realtime?.outgoingChallenges ?? [];
    const challengedFriends = outgoing.map(challenge => challenge.targetUsername);
    const [processingChallengeId, setProcessingChallengeId] = useState<string | null>(null);
    const [acceptedChallenges, setAcceptedChallenges] = useState<string[]>([]);
    const [challengeError, setChallengeError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setUserFailed(false);
        setUserData(null);
        userApi.getCurrentUser({ sessionKey })
            .then(response => { if (!response.ok) throw new Error('user'); return response.json(); })
            .then(data => { if (!data) throw new Error('user'); if (!cancelled) setUserData(data); })
            .catch(() => { if (!cancelled) setUserFailed(true); });
        return () => { cancelled = true; };
    }, [sessionKey, userAttempt]);

    useEffect(() => {
        const headers = { sessionKey };
        rankingApi.getMyRank(headers)
            .then(response => { if (!response.ok) throw new Error('ranking'); return response.json(); })
            .then(data => setRank(data ? { status: 'ready', entry: data } : { status: 'error', entry: null }))
            .catch(() => setRank({ status: 'error', entry: null }));

    }, [sessionKey]);

    const handleChallengeFriend = async (username: string) => {
        setFriendChallenges(previous => ({ ...previous, [username]: 'sending' }));
        try {
            const response = await arenaApi.createChallenge({ targetUsername: username }, {sessionKey
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
            const response = await arenaApi.joinQueue({ sessionKey });
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
            const response = await arenaApi.leaveQueue({ sessionKey });
            if (!response.ok) throw new Error('Cannot leave queue');
            await synchronize();
        } catch (err) {
            console.error('Error leaving queue', err);
        }
    };

    const handleCancelChallenge = async (challengeId: string) => {
        try {
            const response = await arenaApi.cancelChallenge(challengeId, { sessionKey });
            if (!response.ok) throw new Error('Cannot cancel challenge');
            await synchronize();
        } catch {
            setError('Nie udało się cofnąć wyzwania.');
        }
    };

    const handleAcceptChallenge = async (challengeId: string) => {
        if (processingChallengeId === challengeId || acceptedChallenges.includes(challengeId)) return;
        setProcessingChallengeId(challengeId);
        setChallengeError(null);
        try {
            const response = await arenaApi.acceptChallenge(challengeId, { sessionKey });
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
            const response = await arenaApi.rejectChallenge(challengeId, { sessionKey });
            if (!response.ok) throw new Error('Cannot reject challenge');
            await synchronize();
        } catch (err) {
            console.error('Error rejecting challenge', err);
        } finally {
            setProcessingChallengeId(null);
        }
    };

    if (!userData) return <div className="user-dashboard"><div className="ud-shell arena-pending">{userFailed ? <div className="arena-pending-error">
        <p role="alert" className="arena-error">Nie udało się wczytać Twojego konta.</p>
        <button type="button" className="ud-btn ud-btn-solid" onClick={() => setUserAttempt(attempt => attempt + 1)}>Spróbuj ponownie</button>
    </div> : <ArenaLoader label="Ładowanie Areny" />}</div></div>;

    const offline = !connected || !realtime;
    const myRank = rank.entry;
    const known = rank.status === 'ready' && myRank !== null;
    const elo = myRank?.elo ?? 0;
    const opponent = gameSession ? (gameSession.player1Id === userData.id ? gameSession.player2Username : gameSession.player1Username) : '';
    const searching = status === 'QUEUE' || joiningQueue;
    const { league, next } = leagueFor(elo);
    const rankLabel = !known ? (rank.status === 'loading' ? 'Wczytuję Elo…' : 'Nie udało się wczytać Elo') : myRank.rankElo ? `#${myRank.rankElo} w rankingu Elo` : 'Poza rankingiem Elo';
    const headline = status === 'GAME' ? 'Walka trwa' : searching ? 'Szukamy rywala' : 'Wejdź na arenę';

    return (
        <div className="user-dashboard arena-page" id="arena">
            <div className="ud-shell">
                <div className="ud-main">
                    <section className="arena-hero" aria-labelledby="arena-title" style={{ '--league': known ? league.color : 'var(--ud-track)' } as React.CSSProperties}>
                        <div className="arena-card" data-tour="arena-card">
                            <div className="arena-card-top">
                                {known && <span className="arena-league"><LeagueIcon league={league} glint />Liga {league.name}</span>}
                                <span className="arena-card-rank" role={known ? undefined : "status"}>{rankLabel}</span>
                            </div>
                            <Link className="arena-card-portrait-edit" to="/arena/avatar" aria-label="Zmień swój awatar">
                                <UserAvatar className="arena-card-portrait" username={userData.username} avatar={userData.avatar} alt="" />
                            </Link>
                            <p className="arena-card-name">{userData.username}</p>
                            <p className="arena-card-elo">
                                <span className="arena-card-number">{known ? elo : '–'}</span>
                                <EloHelp />
                            </p>
                            {!known ? (
                                <p className="arena-card-next">{rank.status === 'loading' ? 'Za chwilę zobaczysz swoją ligę.' : 'Odśwież stronę, żeby spróbować ponownie.'}</p>
                            ) : next ? (
                                <div className="arena-card-next">
                                    <div className="ud-meter" role="progressbar" aria-label={`Postęp do ligi ${next.name}`} aria-valuemin={league.min} aria-valuemax={next.min} aria-valuenow={elo}>
                                        <span style={{ '--ud-fill': leagueProgress(elo) } as React.CSSProperties} />
                                    </div>
                                    <p>Do ligi {next.name} brakuje Ci {formatNumberPL(next.min - elo)} Elo.</p>
                                </div>
                            ) : (
                                <p className="arena-card-next">Najwyższa liga. Broń swojego miejsca.</p>
                            )}
                        </div>
                        <div className="arena-hero-main">
                        <div className="arena-console-copy" data-tour="arena-play">
                            <p className="arena-kicker">Tryb rankingowy</p>
                            <h1 id="arena-title" className="arena-title">{headline}</h1>
                            {status === 'GAME' && gameSession ? (
                                <p role="status">Masz trwający mecz z {opponent}.</p>
                            ) : searching ? (
                                <div className="arena-search">
                                    <ArenaRunner avatar={userData.avatar} className="arena-search-runner" />
                                    <p role="status" aria-live="polite" className="arena-waiting">
                                        {joiningQueue && status !== 'QUEUE' ? 'Dołączanie do kolejki...' : 'Szukanie przeciwnika...'}
                                    </p>
                                </div>
                            ) : (
                                <p>Twój awatar staje do walki na pytania z cyberbezpieczeństwa. Każda dobra odpowiedź to cios w rywala, a wygrana zabiera mu punkty Elo.</p>
                            )}
                            {status !== 'GAME' && outgoing.length > 0 && (
                                <ul className="arena-sent" aria-label="Wysłane wyzwania">
                                    {outgoing.map(challenge => (
                                        <li key={challenge.id}>
                                            <span className="arena-pulse" aria-hidden="true" />
                                            Czekasz na odpowiedź od <strong>{challenge.targetUsername}</strong>
                                            <button type="button" className="ud-link" onClick={() => handleCancelChallenge(challenge.id)}>Cofnij</button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {offline && <p role="status" className="arena-note">Łączenie z Areną. Poczekaj na połączenie z serwerem.</p>}
                            {error && <p role="alert" className="arena-error">{error}</p>}
                        </div>
                        <ol className="arena-ladder" aria-label="Ligi Areny" data-tour="arena-ladder">
                            {LEAGUES.map(item => (
                                <li key={item.name} className={!known ? undefined : item === league ? "is-current" : elo >= item.min ? "is-reached" : undefined} style={{ '--tier': item.color } as React.CSSProperties} aria-current={known && item === league ? "true" : undefined}>
                                    <LeagueIcon league={item} className="arena-ladder-icon" glint={known && item === league} />
                                    <span className="arena-ladder-bar" aria-hidden="true" />
                                    <span className="arena-ladder-name">{item.name}</span>
                                    <span className="arena-ladder-min">{item.min === 0 ? "start" : `od ${item.min} Elo`}</span>
                                </li>
                            ))}
                        </ol>
                        <div className="arena-console-actions">
                            {status === 'GAME' && gameSession ? (
                                <Link className="ud-btn arena-go" to={`/arena/battle/${gameSession.id}`}>Wróć do walki</Link>
                            ) : status === 'QUEUE' || joiningQueue ? (
                                <button type="button" className="ud-btn ud-btn-quiet" onClick={handleLeaveQueue} disabled={joiningQueue && status !== 'QUEUE'}>Anuluj</button>
                            ) : (
                                <button type="button" className="ud-btn arena-go" onClick={handleJoinQueue} disabled={offline}>Znajdź przeciwnika</button>
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
                                            <UserAvatar className="ud-friend-avatar" username={challenge.challengerUsername} avatar={challenge.challengerAvatar} alt="" />
                                            <span className="ud-friend-who">
                                                <ProfilePeek className="ud-friend-name" username={challenge.challengerUsername} sessionKey={sessionKey} />
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
                    <section className="arena-board-friends" aria-labelledby="arena-friends-title" data-tour="arena-friends">
                        <div className="ud-section-head">
                            <h2 id="arena-friends-title">Wyzwij znajomego</h2>
                            {friends && friends.length > 0 && <Link className="ud-link" to="/friends">Wszyscy znajomi ({friends.length})</Link>}
                        </div>
                        {friendsFailed ? (
                            <p className="ud-empty">Nie udało się wczytać znajomych. Odśwież stronę, żeby spróbować ponownie.</p>
                        ) : friends === null ? (
                            <FriendRowsSkeleton />
                        ) : friends.length === 0 ? (
                            <p className="ud-empty">Nie masz jeszcze znajomych. Dodaj kogoś z rankingu, a potem wyzwij go tutaj na pojedynek.</p>
                        ) : (
                            <ul className="ud-friend-list">
                                {friends.slice(0, FRIENDS_SHOWN).map(friend => {
                                    const h2h = headToHead[friend.username];
                                    const record = h2h && h2h.winsAgainst !== undefined ? h2h : null;
                                    const played = record ? (record.winsAgainst ?? 0) + (record.lossesAgainst ?? 0) : 0;
                                    const state = friendChallenges[friend.username];
                                    const sent = challengedFriends.includes(friend.username);
                                    return (
                                        <li key={friend.id} className="ud-friend">
                                            <UserAvatar className="ud-friend-avatar" username={friend.username} avatar={friend.avatar} alt="" />
                                            <span className="ud-friend-who">
                                                <ProfilePeek className="ud-friend-name" username={friend.username} sessionKey={sessionKey} />
                                                <span className="ud-friend-xp">{formatNumberPL(friend.points)} XP, poziom {levelFromPoints(friend.points)}</span>
                                            </span>
                                            <span className="ud-friend-h2h">
                                                {record ? (played > 0 ? <>Bilans <strong>{record.winsAgainst}:{record.lossesAgainst}</strong></> : 'Jeszcze bez pojedynku') : h2h === undefined && statsLoading ? 'Wczytuję bilans…' : 'Bilans niedostępny'}
                                            </span>
                                            <span className="ud-friend-act">
                                                {sent ? (
                                                    <span className="ud-friend-sent">Wyzwanie wysłane</span>
                                                ) : (
                                                    <button type="button" className="ud-btn ud-btn-small" onClick={() => handleChallengeFriend(friend.username)}
                                                        disabled={offline || status === 'GAME' || state === 'sending'}>
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
                    <section aria-labelledby="arena-rules-title" data-tour="arena-rules">
                        <h2 id="arena-rules-title" className="arena-board-title">Zasady pojedynków rankingowych</h2>
                        <ol className="arena-rules">
                            <li>Twój awatar staje do walki z rywalem z kolejki albo z wyzwanym znajomym. Każdy zaczyna ze 100 HP.</li>
                            <li>W każdej z 10 rund oboje dostajecie to samo pytanie z cyberbezpieczeństwa i wybieracie jedną z czterech odpowiedzi w 15 sekund.</li>
                            <li>Poprawna odpowiedź zadaje 20 HP przed pierwszą sekundą i o 1 HP mniej za każdą pełną sekundę. Zła odpowiedź nie zadaje obrażeń.</li>
                            <li>Wygrywa nokaut albo więcej HP po 10 rundach. Remis nie zmienia Elo, a poddanie lub 30 sekund nieobecności w walce to porażka.</li>
                            <li>Gdy ktoś opuści walkę lub straci połączenie, pojedynek staje na maksymalnie 10 sekund. Każdy gracz ma jedną pauzę na mecz, a jej czas wlicza się do tych 30 sekund. Gdy oboje są nieobecni przez 30 sekund, mecz jest anulowany bez zmiany Elo.</li>
                        </ol>
                        <Link className="ud-link" to="/ranking">Pełny ranking</Link>
                    </section>
                </aside>
            </div>
        </div>
    );
};

export default ArenaPage;
