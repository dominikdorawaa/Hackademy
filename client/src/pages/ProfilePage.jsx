import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_URL from '../apiConfig';
import ActivityCalendar from '../components/ActivityCalendar';

const ProfilePage = () => {
    const { token, logout } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [badges, setBadges] = useState([]);
    const [activityData, setActivityData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // UI State
    const [showAllBadges, setShowAllBadges] = useState(false);
    const BADGES_LIMIT = 6;

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                setError(null);

                const [userRes, badgesRes, activityRes] = await Promise.all([
                    fetch(`${API_URL}/api/user/me`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    }),
                    fetch(`${API_URL}/api/badges/all`, { // Fetch ALL badges with status
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    }),
                    fetch(`${API_URL}/api/user/me/activity`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                    })
                ]);

                if (userRes.ok && badgesRes.ok && activityRes.ok) {
                    const userData = await userRes.json();
                    const badgesData = await badgesRes.json();
                    const activityData = await activityRes.json();
                    setUserData(userData);
                    setBadges(badgesData);
                    setActivityData(activityData);
                } else if (userRes.status === 401 || userRes.status === 403) {
                    logout();
                    navigate('/login');
                } else {
                    const errorMessage = await userRes.text();
                    setError(`Failed to fetch user data: ${errorMessage}`);
                }
            } catch (err) {
                setError('Network error: Could not connect to the server.');
            } finally {
                setLoading(false);
            }
        };

        if (token) {
            fetchUserData();
        } else {
            logout();
            navigate('/login');
        }
    }, [token, logout, navigate]);

    const calculateRank = (points) => {
        const level = Math.floor(points / 100) + 1;
        
        if (level >= 1 && level <= 3) return { name: 'Freshman', color: '#4CAF50' }; // Green
        if (level >= 4 && level <= 6) return { name: 'Junior', color: '#2196F3' }; // Blue
        if (level >= 7 && level <= 10) return { name: 'Apprentice', color: '#9C27B0' }; // Purple
        if (level >= 11 && level <= 15) return { name: 'Developer', color: '#FF9800' }; // Orange
        if (level >= 16 && level <= 20) return { name: 'Senior', color: '#F44336' }; // Red
        if (level >= 21) return { name: 'Architect', color: '#FFD700' }; // Gold
        
        return { name: 'Freshman', color: '#4CAF50' };
    };

    if (loading) return <div className="container" style={{ paddingTop: '40px' }}><h1>Ładowanie...</h1></div>;
    if (error) return <div className="container" style={{ paddingTop: '40px' }}><h1>Błąd: {error}</h1></div>;

    const userPoints = userData?.points || 0;
    const userLevel = Math.floor(userPoints / 100) + 1;
    const rank = calculateRank(userPoints);
    const nextLevelPoints = userLevel * 100;
    const progress = ((userPoints % 100) / 100) * 100;

    const visibleBadges = showAllBadges ? badges : badges.slice(0, BADGES_LIMIT);

    return (
        <div className="container" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', textAlign: 'center', color: 'var(--text-light)' }}>Twój Profil</h1>

            <div style={{ 
                display: 'flex', 
                flexDirection: 'row', 
                gap: '30px', 
                maxWidth: '1000px', 
                margin: '0 auto',
                alignItems: 'flex-start'
            }}>
                {/* Left Column: User Info & Rank */}
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
                    {/* Avatar from API */}
                    <img 
                        src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${userData?.username}`}
                        alt="User Avatar"
                        style={{
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            backgroundColor: '#333',
                            marginBottom: '15px',
                            border: `3px solid ${rank.color}`
                        }}
                    />
                    
                    <h2 style={{ margin: '0 0 5px 0', fontSize: '1.8rem', color: 'var(--text-light)' }}>{userData?.username}</h2>
                    <p style={{ color: 'var(--text-gray)', margin: '0 0 20px 0' }}>{userData?.email}</p>
                    
                    {/* Streak Info */}
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
                            {userData?.streak || 0} dni z rzędu
                        </span>
                    </div>

                    {/* Rank Info */}
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
                            <span>{userPoints} XP</span>
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
                                backgroundColor: rank.color,
                                transition: 'width 0.5s ease-in-out'
                            }}></div>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-gray)' }}>
                            Do awansu: {nextLevelPoints - userPoints} XP
                        </p>
                    </div>
                    
                    <div style={{ marginTop: '20px', color: 'var(--text-gray)', fontSize: '0.9rem' }}>
                        Dołączył: {new Date(userData?.createdAt).toLocaleDateString()}
                    </div>
                </div>

                {/* Right Column: Bio, Badges & Activity */}
                <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    
                    {/* Bio Section */}
                    <div style={{ backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-light)' }}>
                            O mnie
                        </h2>
                        
                        {userData?.bio ? (
                            <p style={{ whiteSpace: 'pre-line', lineHeight: '1.6', color: 'var(--text-light)' }}>{userData.bio}</p>
                        ) : (
                            <p style={{ color: 'var(--text-gray)', fontStyle: 'italic' }}>Nie napisałeś jeszcze nic o sobie. Przejdź do ustawień, aby dodać opis.</p>
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
                            Odznaki ({badges.filter(b => b.earned).length}/{badges.length})
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

export default ProfilePage;
