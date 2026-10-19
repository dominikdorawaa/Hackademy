import UserAvatar from '../components/UserAvatar';
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

const FriendsPage = () => {
    const { token } = useAuth();
    const { state, error, synchronize } = useRealtime();
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
            const response = await userApi.searchUsers(searchQuery, { 'Authorization': `Bearer ${token}` });
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
            const response = await friendApi.sendRequest(username, { 'Authorization': `Bearer ${token}` });
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
            const response = await friendApi.acceptRequest(requestId, { 'Authorization': `Bearer ${token}` });
            if (response.ok) {
                await synchronize();
            }
        } catch (err) {
            console.error("Error accepting request", err);
        }
    };

    const handleReject = async (requestId: number) => {
        try {
            const response = await friendApi.rejectRequest(requestId, { 'Authorization': `Bearer ${token}` });
            if (response.ok) {
                await synchronize();
            }
        } catch (err) {
            console.error("Error rejecting request", err);
        }
    };

    const handleRemove = async (friend: FriendDto) => {
        const response = await friendApi.removeFriend(friend.id, { 'Authorization': `Bearer ${token}` });
        if (!response.ok) throw new Error('Nie udało się usunąć znajomego. Spróbuj ponownie.');
        void synchronize();
    };

    const handleChallenge = async (username: string) => {
        try {
            const response = await arenaApi.createChallenge({ targetUsername: username }, {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
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

    const calculateRankColor = (points: number) => {
        const level = Math.floor(points / 100) + 1;
        if (level >= 1 && level <= 3) return '#4CAF50';
        if (level >= 4 && level <= 6) return '#2196F3';
        if (level >= 7 && level <= 10) return '#9C27B0';
        if (level >= 11 && level <= 15) return '#FF9800';
        if (level >= 16 && level <= 20) return '#F44336';
        if (level >= 21) return '#FFD700';
        return '#4CAF50';
    };

    if (loading && error) return <div className="hackademy-container" style={{ paddingTop: '40px' }}>
        <p role="alert">{error}</p>
        <button className="btn-primary" onClick={() => void synchronize()}>Spróbuj ponownie</button>
    </div>;
    return (
        <div className="hackademy-container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', color: 'var(--text-light)' }}>Znajomi</h1>
            {loading ? <LoadingSkeleton label="Wczytuję znajomych" className="hk-skeleton-stack is-loose">
                <Skeleton height={124} radius={12} />
                <div className="hk-skeleton-stack">
                    <Skeleton width={180} height={24} />
                    {[0, 1, 2].map(row => <Skeleton key={row} height={72} radius={8} />)}
                </div>
            </LoadingSkeleton> : <>

            {/* Search Section */}
            <div style={{ marginBottom: '40px', backgroundColor: 'var(--bg-panel)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '15px', color: 'var(--text-light)' }}>Znajdź znajomych</h2>
                <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px' }}>
                    <input
                        type="text"
                        placeholder="Wpisz nazwę użytkownika..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '6px',
                            border: '1px solid var(--input-border)',
                            backgroundColor: 'var(--input-bg)',
                            color: 'var(--text-light)'
                        }}
                    />
                    <button type="submit" className="btn btn-primary" disabled={isSearching}>
                        {isSearching ? 'Szukanie...' : 'Szukaj'}
                    </button>
                </form>

                {searchResults.length > 0 && (
                    <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {searchResults.map(user => (
                            <div key={user.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px',
                                backgroundColor: 'var(--bg-panel-lighter)',
                                borderRadius: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <UserAvatar username={user.username} avatar={user.avatar}
                                        alt="Avatar"
                                        style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#333' }}
                                    />
                                    <Link to={`/profile/${user.username}`} style={{ textDecoration: 'none', color: 'var(--text-light)', fontWeight: 'bold' }}>
                                        {user.username}
                                    </Link>
                                </div>
                                <div>
                                    {user.friendshipStatus === 'NONE' && (
                                        <button onClick={() => handleSendRequest(user.username)} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '5px 10px' }}>
                                            Dodaj
                                        </button>
                                    )}
                                    {user.friendshipStatus === 'REQUEST_SENT' && (
                                        <span style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>Wysłano</span>
                                    )}
                                    {user.friendshipStatus === 'FRIENDS' && (
                                        <span style={{ color: '#2ecc71', fontSize: '0.9rem' }}>Znajomi</span>
                                    )}
                                    {user.friendshipStatus === 'SELF' && (
                                        <span style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>Ty</span>
                                    )}
                                    {user.friendshipStatus === 'REQUEST_RECEIVED' && (
                                        <span style={{ color: '#ffd700', fontSize: '0.9rem' }}>Oczekuje</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pending Requests Section */}
            {requests.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: '#ffd700' }}>
                        <i className="fas fa-envelope" style={{ marginRight: '10px' }}></i>
                        Oczekujące Zaproszenia ({requests.length})
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                        {requests.map(req => (
                            <div key={req.id} style={{
                                backgroundColor: 'var(--bg-panel)',
                                padding: '20px',
                                borderRadius: '12px',
                                border: '1px solid #ffd700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <UserAvatar username={req.requesterUsername} avatar={req.avatar}
                                        alt="Avatar"
                                        style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#333' }}
                                    />
                                    <div>
                                        <Link to={`/profile/${req.requesterUsername}`} style={{ textDecoration: 'none', color: 'var(--text-light)', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {req.requesterUsername}
                                        </Link>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>Chce dodać Cię do znajomych</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => handleAccept(req.id)} aria-label={`Przyjmij zaproszenie od ${req.requesterUsername}`} className="btn" style={{ backgroundColor: '#2ecc71', color: 'white', padding: '8px', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fas fa-check"></i>
                                    </button>
                                    <button onClick={() => handleReject(req.id)} aria-label={`Odrzuć zaproszenie od ${req.requesterUsername}`} className="btn" style={{ backgroundColor: '#e74c3c', color: 'white', padding: '8px', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fas fa-times"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Friends List Section */}
            <div>
                <h2 ref={friendsHeading} tabIndex={-1} style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--text-light)' }}>
                    <i className="fas fa-users" style={{ marginRight: '10px' }}></i>
                    Twoi Znajomi ({friends.length})
                </h2>

                {friends.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-gray)', backgroundColor: 'var(--bg-panel)', borderRadius: '12px' }}>
                        <p>Nie masz jeszcze żadnych znajomych.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                        {friends.map(friend => (
                            <div key={friend.id} style={{
                                backgroundColor: 'var(--bg-panel)',
                                padding: '20px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-color)',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                    <UserAvatar username={friend.username} avatar={friend.avatar}
                                        alt="Avatar"
                                        style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: '50%',
                                            backgroundColor: '#333',
                                            marginBottom: '15px',
                                            border: `3px solid ${calculateRankColor(friend.points)}`
                                        }}
                                    />
                                    <Link to={`/profile/${friend.username}`} style={{ textDecoration: 'none', color: 'var(--text-light)', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '5px' }}>
                                        {friend.username}
                                    </Link>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-gray)', marginBottom: '5px' }}>
                                        <span aria-hidden="true" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: friend.online ? '#2ecc71' : 'var(--text-gray)', opacity: friend.online ? 1 : 0.5 }} />
                                        {friend.online ? 'Online' : 'Offline'}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-gray)', marginBottom: '15px' }}>
                                        {friend.points} XP • {friend.streak} dni 🔥
                                    </div>

                                    <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                        <Link
                                            to={`/profile/${friend.username}`}
                                            className="btn"
                                            style={{
                                                flex: 1,
                                                fontSize: '0.8rem',
                                                padding: '8px',
                                                backgroundColor: 'var(--bg-panel-lighter)',
                                                color: 'var(--text-light)',
                                                border: '1px solid var(--border-color)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '5px'
                                            }}
                                        >
                                            <i className="fas fa-user"></i> Profil
                                        </Link>
                                        <button
                                            onClick={() => handleChallenge(friend.username)}
                                            className="btn btn-outline"
                                            style={{ flex: 1, fontSize: '0.8rem', padding: '8px', borderColor: '#ff2d55', color: '#ff2d55' }}
                                            title="Wyzwij na pojedynek"
                                            disabled={challengedFriends.includes(friend.username)}
                                        >
                                            {challengedFriends.includes(friend.username) ? 'Wyzwano' : (
                                                <>
                                                    <i className="fas fa-swords"></i> Wyzwij
                                                </>
                                            )}
                                        </button>
                                        <button
                                            ref={button => {
                                                if (button) removeButtons.current.set(friend.id, button);
                                                else removeButtons.current.delete(friend.id);
                                            }}
                                            onClick={() => { setRemoving(friend); setRemoveOpen(true); }}
                                            className="btn btn-outline"
                                            style={{ borderColor: '#e74c3c', color: '#e74c3c', padding: '8px 12px' }}
                                            title="Usuń ze znajomych"
                                            aria-label={`Usuń ${friend.username} ze znajomych`}
                                        >
                                            <i className="fas fa-user-minus" aria-hidden="true"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <ConfirmAction
                open={removeOpen}
                onOpenChange={setRemoveOpen}
                title="Usunąć ze znajomych?"
                description={removing ? <><strong className="text-base font-bold text-foreground">{removing.username}</strong> zniknie z Twojej listy znajomych. Możesz wysłać nowe zaproszenie w dowolnym momencie.</> : ''}
                confirmLabel="Usuń"
                onConfirm={() => removing ? handleRemove(removing) : undefined}
                returnFocus={confirmed => (!confirmed && removing ? removeButtons.current.get(removing.id) : null) ?? friendsHeading.current}
            />
            </>}
        </div>
    );
};

export default FriendsPage;
