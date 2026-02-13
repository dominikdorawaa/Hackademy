import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import API_URL from '../apiConfig';
import ActivityCalendar from '../components/ActivityCalendar';
import './ProfilePage.css';

const PublicProfilePage = () => {
    const { username } = useParams();
    const { token } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [friendshipStatus, setFriendshipStatus] = useState('NONE'); // NONE, FRIENDS, REQUEST_SENT, REQUEST_RECEIVED
    const [friendshipStats, setFriendshipStats] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [activityData, setActivityData] = useState([]);
    
    // UI State
    const [showAllBadges, setShowAllBadges] = useState(false);
    const BADGES_LIMIT = 6;

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                const response = await fetch(`${API_URL}/api/user/${username}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setProfile(data);
                    fetchFriendshipStatus(data.username);
                    fetchFriendshipStats(data.username);
                    fetchActivityData(data.username);
                } else {
                    setError('Nie znaleziono użytkownika');
                }
            } catch (err) {
                setError('Błąd sieci');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchProfile();
        }
    }, [username, token]);

    const fetchFriendshipStatus = async (targetUsername) => {
        try {
            const response = await fetch(`${API_URL}/api/friends/status/${targetUsername}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setFriendshipStatus(data.status);
            }
        } catch (err) {
            console.error("Failed to fetch friendship status", err);
        }
    };

    const fetchFriendshipStats = async (targetUsername) => {
        try {
            const response = await fetch(`${API_URL}/api/friends/stats/${targetUsername}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setFriendshipStats(data);
            }
        } catch (err) {
            console.error("Failed to fetch friendship stats", err);
        }
    };

    const fetchActivityData = async (targetUsername) => {
        try {
            const response = await fetch(`${API_URL}/api/user/${targetUsername}/activity`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setActivityData(data);
            }
        } catch (err) {
            console.error("Failed to fetch activity data", err);
        }
    };

    const handleSendRequest = async () => {
        setActionLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/friends/request/${profile.username}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.ok) {
                setFriendshipStatus('REQUEST_SENT');
            }
        } catch (err) {
            console.error("Failed to send friend request", err);
        } finally {
            setActionLoading(false);
        }
    };

    const calculateRank = (points) => {
        const level = Math.floor(points / 100) + 1;
        
        if (level >= 1 && level <= 3) return { name: 'Freshman', color: '#4CAF50' };
        if (level >= 4 && level <= 6) return { name: 'Junior', color: '#2196F3' };
        if (level >= 7 && level <= 10) return { name: 'Apprentice', color: '#9C27B0' };
        if (level >= 11 && level <= 15) return { name: 'Developer', color: '#FF9800' };
        if (level >= 16 && level <= 20) return { name: 'Senior', color: '#F44336' };
        if (level >= 21) return { name: 'Architect', color: '#FFD700' };
        
        return { name: 'Freshman', color: '#4CAF50' };
    };

    if (loading) return <div className="container" style={{ paddingTop: '40px' }}><h1>Ładowanie...</h1></div>;
    if (error) return <div className="container" style={{ paddingTop: '40px' }}><h1>{error}</h1><button onClick={() => navigate(-1)} className="btn btn-outline">Wróć</button></div>;

    const rank = calculateRank(profile.points);
    const userLevel = Math.floor(profile.points / 100) + 1;
    const nextLevelPoints = userLevel * 100;
    const progress = ((profile.points % 100) / 100) * 100;
    const badges = profile.badges || []; // Use badges from profile DTO
    
    const visibleBadges = showAllBadges ? badges : badges.slice(0, BADGES_LIMIT);

    return (
        <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
            <button onClick={() => navigate(-1)} className="back-btn" style={{ marginBottom: '20px' }}>&larr; Wróć</button>
            
            <div style={{ 
                display: 'flex', 
                flexDirection: 'row', 
                gap: '30px', 
                maxWidth: '1000px', 
                margin: '0 auto',
                alignItems: 'flex-start'
            }}>
                {/* Left Column: User Info */}
                <div style={{ 
                    flex: '1.2', // Increased width
                    minWidth: '300px', // Ensure minimum width
                    backgroundColor: 'var(--bg-panel)',
                    padding: '30px', 
                    borderRadius: '12px', 
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center'
                }}>
                    <img 
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${profile.username}`}
                        alt="User Avatar"
                        style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            backgroundColor: '#333',
                            marginBottom: '20px',
                            border: `3px solid ${rank.color}`
                        }}
                    />
                    
                    <h1 style={{ margin: '0 0 10px 0', fontSize: '2rem', color: 'var(--text-light)' }}>{profile.username}</h1>
                    
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        marginBottom: '20px',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 152, 0, 0.3)',
                        whiteSpace: 'nowrap' // Prevent wrapping
                    }}>
                        <i className="fas fa-fire" style={{ color: '#ff9800', fontSize: '1.2rem' }}></i>
                        <span style={{ color: '#ff9800', fontWeight: 'bold', fontSize: '1.1rem' }}>
                            {profile.streak} dni z rzędu
                        </span>
                    </div>

                    {/* Friend Button & Stats */}
                    <div style={{ marginBottom: '20px', width: '100%' }}>
                        {friendshipStatus === 'NONE' && (
                            <button 
                                onClick={handleSendRequest} 
                                disabled={actionLoading}
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                            >
                                {actionLoading ? 'Wysyłanie...' : 'Dodaj do znajomych'}
                            </button>
                        )}
                        {friendshipStatus === 'REQUEST_SENT' && (
                            <button disabled className="btn btn-outline" style={{ width: '100%', cursor: 'default' }}>
                                Zaproszenie wysłane
                            </button>
                        )}
                        {friendshipStatus === 'FRIENDS' && (
                            <>
                                <button disabled className="btn btn-outline" style={{ width: '100%', borderColor: '#2ecc71', color: '#2ecc71', cursor: 'default', marginBottom: '10px' }}>
                                    <i className="fas fa-check" style={{ marginRight: '5px' }}></i> Znajomi
                                </button>
                                {friendshipStats && (
                                    <div style={{ 
                                        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                                        padding: '10px', 
                                        borderRadius: '8px', 
                                        fontSize: '0.9rem',
                                        textAlign: 'center'
                                    }}>
                                        <div style={{ color: '#aaa', marginBottom: '5px' }}>Bilans pojedynków</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            <span style={{ color: '#2ecc71' }}>Ty {friendshipStats.winsAgainst}</span>
                                            <span style={{ margin: '0 5px', color: '#666' }}>:</span>
                                            <span style={{ color: '#e74c3c' }}>{friendshipStats.lossesAgainst} {profile.username}</span>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        {friendshipStatus === 'REQUEST_RECEIVED' && (
                            <button onClick={() => navigate('/friends')} className="btn btn-primary" style={{ width: '100%' }}>
                                Odpowiedz na zaproszenie
                            </button>
                        )}
                    </div>

                    <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                        <div style={{ 
                            fontSize: '1.4rem', 
                            fontWeight: 'bold', 
                            color: rank.color,
                            marginBottom: '5px'
                        }}>
                            {rank.name}
                        </div>
                        <div style={{ fontSize: '1rem', color: 'var(--text-light)', marginBottom: '15px' }}>
                            Poziom {userLevel}
                        </div>
                        
                        <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                            <span>{profile.points} XP</span>
                            <span>{nextLevelPoints} XP</span>
                        </div>
                        <div style={{ 
                            width: '100%', 
                            height: '8px', 
                            backgroundColor: 'var(--bg-panel-lighter)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '5px'
                        }}>
                            <div style={{ 
                                width: `${progress}%`, 
                                height: '100%', 
                                backgroundColor: rank.color
                            }}></div>
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '20px', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
                        Dołączył: {new Date(profile.createdAt).toLocaleDateString()}
                    </div>
                </div>

                {/* Right Column: Bio & Badges */}
                <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Bio Section */}
                    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-light)' }}>
                            O mnie
                        </h2>
                        
                        {profile.bio ? (
                            <p style={{ whiteSpace: 'pre-line', lineHeight: '1.6', color: 'var(--text-light)' }}>{profile.bio}</p>
                        ) : (
                            <p style={{ color: 'var(--text-gray)', fontStyle: 'italic' }}>Ten użytkownik nie napisał jeszcze nic o sobie.</p>
                        )}
                    </div>

                    {/* Activity Calendar */}
                    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-light)' }}>
                            Aktywność (ostatni rok)
                        </h2>
                        <div style={{ overflowX: 'auto' }}>
                            <ActivityCalendar data={activityData} />
                        </div>
                    </div>

                    {/* Badges Section */}
                    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-light)' }}>
                            Odznaki ({badges.length})
                        </h2>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                            {badges.length === 0 ? (
                                <p style={{ color: 'var(--text-gray)' }}>Brak odznak</p>
                            ) : (
                                visibleBadges.map(badge => (
                                    <div key={badge.id} className="badge-container" style={{ 
                                        width: '60px', 
                                        height: '60px', 
                                        backgroundColor: badge.earned ? 'var(--bg-panel-lighter)' : 'var(--bg-dark)',
                                        borderRadius: '50%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: badge.earned ? '#ffd700' : 'var(--text-gray)',
                                        border: badge.earned ? '2px solid #444' : '2px dashed var(--border-color)',
                                        fontSize: '1.5rem',
                                        cursor: 'pointer',
                                        position: 'relative' // Ensure tooltip positioning context
                                    }}>
                                        <i className={badge.icon} style={{
                                            opacity: badge.earned ? 1 : 0.3, // Apply opacity only to icon
                                            filter: badge.earned ? 'none' : 'grayscale(100%)'
                                        }}></i>
                                        <div className="badge-tooltip">
                                            <span className="badge-name">{badge.name}</span>
                                            <span className="badge-desc">{badge.description}</span>
                                            <span className="badge-rarity" style={{ display: 'block', marginTop: '5px', fontSize: '0.8rem', color: '#aaa' }}>
                                                Posiada: {badge.rarityPercentage ? badge.rarityPercentage.toFixed(1) : 0}% graczy
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        {/* Show More / Show Less Button */}
                        {badges.length > BADGES_LIMIT && (
                            <button 
                                onClick={() => setShowAllBadges(!showAllBadges)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary-blue)',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    marginTop: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '100%',
                                    gap: '5px'
                                }}
                            >
                                {showAllBadges ? (
                                    <>
                                        <i className="fas fa-chevron-up"></i> Zwiń
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-chevron-down"></i> Pokaż więcej ({badges.length - BADGES_LIMIT})
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicProfilePage;
