import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import API_URL from '../apiConfig';

const FriendsPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // Challenge state
    const [challengedFriends, setChallengedFriends] = useState([]);

    useEffect(() => {
        fetchData();
    }, [token]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [friendsRes, requestsRes] = await Promise.all([
                fetch(`${API_URL}/api/friends`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/api/friends/requests`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);

            if (friendsRes.ok && requestsRes.ok) {
                const friendsData = await friendsRes.json();
                const requestsData = await requestsRes.json();
                setFriends(friendsData);
                setRequests(requestsData);
            } else {
                setError('Nie udało się pobrać listy znajomych.');
            }
        } catch (err) {
            setError('Błąd sieci.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        try {
            const response = await fetch(`${API_URL}/api/user/search?query=${searchQuery}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
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

    const handleSendRequest = async (username) => {
        try {
            const response = await fetch(`${API_URL}/api/friends/request/${username}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
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

    const handleAccept = async (requestId) => {
        try {
            const response = await fetch(`${API_URL}/api/friends/accept/${requestId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                fetchData(); // Refresh lists
            }
        } catch (err) {
            console.error("Error accepting request", err);
        }
    };

    const handleReject = async (requestId) => {
        try {
            const response = await fetch(`${API_URL}/api/friends/reject/${requestId}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setRequests(requests.filter(req => req.id !== requestId));
            }
        } catch (err) {
            console.error("Error rejecting request", err);
        }
    };

    const handleRemove = async (friendId) => {
        if (!window.confirm("Czy na pewno chcesz usunąć tego użytkownika ze znajomych?")) return;

        try {
            const response = await fetch(`${API_URL}/api/friends/${friendId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setFriends(friends.filter(f => f.id !== friendId));
            }
        } catch (err) {
            console.error("Error removing friend", err);
        }
    };

    const handleChallenge = async (username) => {
        try {
            const response = await fetch(`${API_URL}/api/arena/challenge/create`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ targetUsername: username })
            });
            
            if (response.ok) {
                setChallengedFriends(prev => [...prev, username]);
            } else {
                const data = await response.json();
                alert(`Błąd: ${data.message}`);
            }
        } catch (err) {
            console.error("Failed to send challenge", err);
            alert("Błąd sieci podczas wysyłania wyzwania.");
        }
    };

    const calculateRankColor = (points) => {
        const level = Math.floor(points / 100) + 1;
        if (level >= 1 && level <= 3) return '#4CAF50';
        if (level >= 4 && level <= 6) return '#2196F3';
        if (level >= 7 && level <= 10) return '#9C27B0';
        if (level >= 11 && level <= 15) return '#FF9800';
        if (level >= 16 && level <= 20) return '#F44336';
        if (level >= 21) return '#FFD700';
        return '#4CAF50';
    };

    if (loading) return <div className="container" style={{ paddingTop: '40px' }}><h1>Ładowanie...</h1></div>;
    if (error) return <div className="container" style={{ paddingTop: '40px' }}><h1>Błąd: {error}</h1></div>;

    return (
        <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '30px' }}>Znajomi</h1>

            {/* Search Section */}
            <div style={{ marginBottom: '40px', backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                <h2 style={{ fontSize: '1.2rem', marginBottom: '15px' }}>Znajdź znajomych</h2>
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
                            border: '1px solid #444', 
                            backgroundColor: '#2d2d2d', 
                            color: 'white' 
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
                                backgroundColor: '#2d2d2d',
                                borderRadius: '8px'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <img 
                                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.username}`}
                                        alt="Avatar"
                                        style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#333' }}
                                    />
                                    <Link to={`/profile/${user.username}`} style={{ textDecoration: 'none', color: 'white', fontWeight: 'bold' }}>
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
                                        <span style={{ color: '#aaa', fontSize: '0.9rem' }}>Wysłano</span>
                                    )}
                                    {user.friendshipStatus === 'FRIENDS' && (
                                        <span style={{ color: '#2ecc71', fontSize: '0.9rem' }}>Znajomi</span>
                                    )}
                                    {user.friendshipStatus === 'SELF' && (
                                        <span style={{ color: '#aaa', fontSize: '0.9rem' }}>Ty</span>
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
                                backgroundColor: '#1e1e1e', 
                                padding: '20px', 
                                borderRadius: '12px', 
                                border: '1px solid #ffd700',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <img 
                                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${req.requesterUsername}`}
                                        alt="Avatar"
                                        style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#333' }}
                                    />
                                    <div>
                                        <Link to={`/profile/${req.requesterUsername}`} style={{ textDecoration: 'none', color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {req.requesterUsername}
                                        </Link>
                                        <div style={{ fontSize: '0.8rem', color: '#aaa' }}>Chce dodać Cię do znajomych</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => handleAccept(req.id)} className="btn" style={{ backgroundColor: '#2ecc71', color: 'white', padding: '8px', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <i className="fas fa-check"></i>
                                    </button>
                                    <button onClick={() => handleReject(req.id)} className="btn" style={{ backgroundColor: '#e74c3c', color: 'white', padding: '8px', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>
                    <i className="fas fa-users" style={{ marginRight: '10px' }}></i>
                    Twoi Znajomi ({friends.length})
                </h2>
                
                {friends.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#aaa', backgroundColor: '#1e1e1e', borderRadius: '12px' }}>
                        <p>Nie masz jeszcze żadnych znajomych.</p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                        {friends.map(friend => (
                            <div key={friend.id} style={{ 
                                backgroundColor: '#1e1e1e', 
                                padding: '20px', 
                                borderRadius: '12px', 
                                border: '1px solid #333',
                                position: 'relative'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                                    <img 
                                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${friend.username}`}
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
                                    <Link to={`/profile/${friend.username}`} style={{ textDecoration: 'none', color: 'white', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '5px' }}>
                                        {friend.username}
                                    </Link>
                                    <div style={{ fontSize: '0.9rem', color: '#aaa', marginBottom: '15px' }}>
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
                                                backgroundColor: '#333',
                                                color: '#fff',
                                                border: '1px solid #555',
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
                                            onClick={() => handleRemove(friend.id)} 
                                            className="btn btn-outline" 
                                            style={{ borderColor: '#e74c3c', color: '#e74c3c', padding: '8px 12px' }}
                                            title="Usuń ze znajomych"
                                        >
                                            <i className="fas fa-user-minus"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FriendsPage;
