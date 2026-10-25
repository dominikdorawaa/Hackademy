import UserAvatar from '../components/UserAvatar';
import { friendStatus } from '../lib/friendStatus';
import { useMinuteClock } from '../hooks/useMinuteClock';
import * as friendApi from '../services/friendApi';
import * as userApi from '../services/userApi';
import * as arenaApi from '../services/arenaApi';
import React, { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { Link } from 'react-router-dom';
import type { FriendDto, UserSearchDto } from '../types/api';
import { ConfirmAction } from '../components/common/ConfirmAction';
import { LoadingSkeleton, Skeleton } from '../components/common/Skeleton';
import { PixelSprite, SPRITES } from '../components/PixelSprite';
import { levelFromPoints } from '../lib/level';
import { Check, Mail, Search, Swords, User, UserMinus, UserPlus, Users, X } from 'lucide-react';
import '../components/room/room.css';
import '../components/learn/learn.css';
import './FriendsPage.css';

const FriendsPage = () => {
    const { sessionKey } = useAuth();
    const { state, error, synchronize } = useRealtime();
    const now = useMinuteClock();
    const friends = state?.friends ?? [];
    const requests = state?.friendRequests ?? [];
    const loading = !state;

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<UserSearchDto[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [removing, setRemoving] = useState<FriendDto | null>(null);
    const [removeOpen, setRemoveOpen] = useState(false);
    const friendsHeading = useRef<HTMLHeadingElement>(null);
    const removeButtons = useRef(new Map<number, HTMLButtonElement>());

    // Challenge state
    const challengedFriends = state?.outgoingChallenges.map(challenge => challenge.targetUsername) ?? [];

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await userApi.searchUsers(searchQuery, { sessionKey });
            if (response.ok) {
                const data = await response.json();
                setSearchResults(data);
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSendRequest = async (username: string) => {
        try {
            const response = await friendApi.sendRequest(username, { sessionKey });
            if (response.ok) {
                // Update search results to reflect sent request
                setSearchResults(prev => prev.map(user =>
                    user.username === username ? { ...user, friendshipStatus: 'REQUEST_SENT' } : user
                ));
            }
        } catch (err) {
            console.error("Failed to send request", err);
        }
    };

    const handleAccept = async (requestId: number) => {
        try {
            const response = await friendApi.acceptRequest(requestId, { sessionKey });
            if (response.ok) {
                await synchronize();
            }
        } catch (err) {
            console.error("Error accepting request", err);
        }
    };

    const handleReject = async (requestId: number) => {
        try {
            const response = await friendApi.rejectRequest(requestId, { sessionKey });
            if (response.ok) {
                await synchronize();
            }
        } catch (err) {
            console.error("Error rejecting request", err);
        }
    };

    const handleRemove = async (friend: FriendDto) => {
        const response = await friendApi.removeFriend(friend.id, { sessionKey });
        if (!response.ok) throw new Error('Nie udało się usunąć znajomego. Spróbuj ponownie.');
        void synchronize();
    };

    const handleChallenge = async (username: string) => {
        try {
            const response = await arenaApi.createChallenge({ targetUsername: username }, {sessionKey
                });

            if (response.ok) {
                await synchronize();
            } else {
                const data = await response.json();
                alert(`Błąd: ${data.message}`);
            }
        } catch (err) {
            console.error("Failed to send challenge", err);
            alert("Błąd sieci podczas wysyłania wyzwania.");
        }
    };

    const rankTier = (points: number) => {
        const level = levelFromPoints(points);
        if (level >= 21) return 'legend';
        if (level >= 16) return 'red';
        if (level >= 11) return 'orange';
        if (level >= 7) return 'violet';
        if (level >= 4) return 'blue';
        return 'green';
    };

    if (loading && error) return <div className="room-tokens friends-page">
        <div className="friends-shell">
            <p role="alert" className="friends-error">{error}</p>
            <button type="button" className="room-btn room-btn--primary" onClick={() => void synchronize()}>Spróbuj ponownie</button>
        </div>
    </div>;
    return (
        <div className="room-tokens friends-page">
            <div className="friends-shell">
            <h1 className="friends-title">Znajomi</h1>
            {loading ? <LoadingSkeleton label="Wczytuję znajomych" className="hk-skeleton-stack is-loose">
                <Skeleton height={124} radius={4} />
                <div className="hk-skeleton-stack">
                    <Skeleton width={180} height={24} />
                    {[0, 1, 2].map(row => <Skeleton key={row} height={72} radius={4} />)}
                </div>
            </LoadingSkeleton> : <>

            <section className="friends-search" aria-labelledby="friends-search-title">
                <h2 id="friends-search-title" className="friends-heading">Znajdź znajomych</h2>
                <form onSubmit={handleSearch} className="room-field">
                    <span className="friends-search-field">
                        <Search aria-hidden="true" />
                        <input
                            type="text"
                            className="room-input"
                            placeholder="Wpisz nazwę użytkownika..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </span>
                    <button type="submit" className="room-btn room-btn--primary" disabled={isSearching}>
                        {isSearching ? 'Szukanie...' : 'Szukaj'}
                    </button>
                </form>

                {searchResults.length > 0 && (
                    <ul className="friends-results">
                        {searchResults.map(user => (
                            <li key={user.id} className="friends-result">
                                <UserAvatar className="friends-portrait" username={user.username} avatar={user.avatar} alt="" />
                                <Link to={`/profile/${user.username}`} className="friends-name">{user.username}</Link>
                                <span className="friends-result-state">
                                    {user.friendshipStatus === 'NONE' && (
                                        <button type="button" onClick={() => handleSendRequest(user.username)} className="room-btn room-btn--primary room-btn--small">
                                            <UserPlus aria-hidden="true" />Dodaj
                                        </button>
                                    )}
                                    {user.friendshipStatus === 'REQUEST_SENT' && <span className="friends-state">Wysłano</span>}
                                    {user.friendshipStatus === 'FRIENDS' && <span className="friends-state is-friends">Znajomi</span>}
                                    {user.friendshipStatus === 'SELF' && <span className="friends-state">Ty</span>}
                                    {user.friendshipStatus === 'REQUEST_RECEIVED' && <span className="friends-state is-waiting">Oczekuje</span>}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {requests.length > 0 && (
                <section className="friends-group" aria-labelledby="friends-requests-title">
                    <h2 id="friends-requests-title" className="friends-heading is-requests">
                        <Mail aria-hidden="true" />
                        Oczekujące Zaproszenia ({requests.length})
                    </h2>
                    <ul className="friends-requests">
                        {requests.map(req => (
                            <li key={req.id} className="friends-request">
                                <UserAvatar className="friends-portrait" username={req.requesterUsername} avatar={req.avatar} alt="" />
                                <div className="friends-request-who">
                                    <Link to={`/profile/${req.requesterUsername}`} className="friends-name">{req.requesterUsername}</Link>
                                    <span className="friends-muted">Chce dodać Cię do znajomych</span>
                                </div>
                                <div className="friends-request-actions">
                                    <button type="button" onClick={() => handleAccept(req.id)} aria-label={`Przyjmij zaproszenie od ${req.requesterUsername}`} className="room-btn room-btn--icon friends-accept">
                                        <Check aria-hidden="true" />
                                    </button>
                                    <button type="button" onClick={() => handleReject(req.id)} aria-label={`Odrzuć zaproszenie od ${req.requesterUsername}`} className="room-btn room-btn--icon friends-danger">
                                        <X aria-hidden="true" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="friends-group" aria-labelledby="friends-list-title">
                <h2 id="friends-list-title" ref={friendsHeading} tabIndex={-1} className="friends-heading">
                    <Users aria-hidden="true" />
                    Twoi Znajomi ({friends.length})
                </h2>

                {friends.length === 0 ? (
                    <div className="friends-empty">
                        <p>Nie masz jeszcze żadnych znajomych.</p>
                    </div>
                ) : (
                    <ul className="friends-grid">
                        {friends.map(friend => {
                            const challenged = challengedFriends.includes(friend.username);
                            return (
                                <li key={friend.id} className="friends-card">
                                    <div className="friends-card-stage">
                                        <UserAvatar className="friends-card-portrait" data-tier={rankTier(friend.points)} username={friend.username} avatar={friend.avatar} alt="" />
                                    </div>
                                    <div className="friends-card-body">
                                        <Link to={`/profile/${friend.username}`} className="friends-card-name">{friend.username}</Link>
                                        <span className={friend.online ? 'friends-presence is-online' : 'friends-presence'}>
                                            <span className="friends-presence-dot" aria-hidden="true" />
                                            <span className="friends-presence-text">{friendStatus(friend, now).replace(/^./, letter => letter.toUpperCase())}</span>
                                        </span>
                                    </div>
                                    <p className="friends-card-stats">
                                        <span className="room-chip room-chip--points">{friend.points} XP</span>
                                        <span className="room-chip"><PixelSprite sprite={SPRITES.flame} still={!friend.streak} className="friends-flame" />{friend.streak} dni</span>
                                    </p>
                                    <div className="friends-card-actions">
                                        <Link to={`/profile/${friend.username}`} className="room-btn room-btn--small">
                                            <User aria-hidden="true" />Profil
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => handleChallenge(friend.username)}
                                            className="room-btn room-btn--small friends-challenge"
                                            title="Wyzwij na pojedynek"
                                            disabled={challenged}
                                        >
                                            <Swords aria-hidden="true" />{challenged ? 'Wyzwano' : 'Wyzwij'}
                                        </button>
                                        <button
                                            type="button"
                                            ref={button => {
                                                if (button) removeButtons.current.set(friend.id, button);
                                                else removeButtons.current.delete(friend.id);
                                            }}
                                            onClick={() => { setRemoving(friend); setRemoveOpen(true); }}
                                            className="room-btn room-btn--small room-btn--icon friends-danger"
                                            title="Usuń ze znajomych"
                                            aria-label={`Usuń ${friend.username} ze znajomych`}
                                        >
                                            <UserMinus aria-hidden="true" />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
            <ConfirmAction
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                title="Usunąć ze znajomych?"
                description={removing ? <><strong className="text-base font-bold text-foreground">{removing.username}</strong> zniknie z Twojej listy znajomych. Możesz wysłać nowe zaproszenie w dowolnym momencie.</> : ''}
                confirmLabel="Usuń"
                onConfirm={() => removing ? handleRemove(removing) : undefined}
                returnFocus={confirmed => (!confirmed && removing ? removeButtons.current.get(removing.id) : null) ?? friendsHeading.current}
                pixel
            />
            </>}
            </div>
        </div>
    );
};

export default FriendsPage;
