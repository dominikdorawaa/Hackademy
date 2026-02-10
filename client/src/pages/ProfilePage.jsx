import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import API_URL from '../apiConfig';

const ProfilePage = () => {
    const { token, login, logout } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [badges, setBadges] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    // UI State
    const [showAllBadges, setShowAllBadges] = useState(false);
    const BADGES_LIMIT = 6;

    // Form states
    const [newUsername, setNewUsername] = useState('');
    const [bio, setBio] = useState('');
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [formMessage, setFormMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                setError(null);

                const [userRes, badgesRes] = await Promise.all([
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
                    })
                ]);

                if (userRes.ok && badgesRes.ok) {
                    const userData = await userRes.json();
                    const badgesData = await badgesRes.json();
                    setUserData(userData);
                    setBadges(badgesData);
                    setNewUsername(userData.username);
                    setBio(userData.bio || '');
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

    const handleUpdateUsername = async (e) => {
        e.preventDefault();
        setFormMessage({ type: '', text: '' });

        try {
            const response = await fetch(`${API_URL}/api/user/me/username`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newUsername })
            });

            if (response.ok) {
                const data = await response.json();
                login(data.token);
                setUserData({ ...userData, username: newUsername });
                setFormMessage({ type: 'success', text: 'Nazwa użytkownika została zaktualizowana!' });
            } else {
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    const msg = errorJson.message || Object.values(errorJson).join(', ');
                    setFormMessage({ type: 'error', text: msg || 'Nie udało się zaktualizować nazwy użytkownika' });
                } catch {
                    setFormMessage({ type: 'error', text: errorText || 'Nie udało się zaktualizować nazwy użytkownika' });
                }
            }
        } catch (err) {
            setFormMessage({ type: 'error', text: 'Wystąpił błąd sieci.' });
        }
    };

    const handleUpdateBio = async (e) => {
        e.preventDefault();
        setFormMessage({ type: '', text: '' });

        try {
            const response = await fetch(`${API_URL}/api/user/me/bio`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ bio })
            });

            if (response.ok) {
                setUserData({ ...userData, bio: bio });
                setFormMessage({ type: 'success', text: 'Opis "O mnie" został zaktualizowany!' });
            } else {
                const errorText = await response.text();
                setFormMessage({ type: 'error', text: 'Nie udało się zaktualizować opisu.' });
            }
        } catch (err) {
            setFormMessage({ type: 'error', text: 'Wystąpił błąd sieci.' });
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setFormMessage({ type: '', text: '' });

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setFormMessage({ type: 'error', text: 'Nowe hasła nie są identyczne.' });
            return;
        }

        try {
            const response = await fetch(`${API_URL}/api/user/me/password`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });

            if (response.ok) {
                setFormMessage({ type: 'success', text: 'Hasło zostało zmienione!' });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                const errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    const msg = errorJson.message || Object.values(errorJson).join(', ');
                    setFormMessage({ type: 'error', text: msg || 'Nie udało się zmienić hasła' });
                } catch {
                    setFormMessage({ type: 'error', text: errorText || 'Nie udało się zmienić hasła' });
                }
            }
        } catch (err) {
            setFormMessage({ type: 'error', text: 'Wystąpił błąd sieci.' });
        }
    };

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
            <h1 style={{ fontSize: '2.5rem', marginBottom: '30px', textAlign: 'center' }}>Twój Profil</h1>

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
                    flex: '1', 
                    backgroundColor: '#1e1e1e', 
                    padding: '30px', 
                    borderRadius: '12px', 
                    border: '1px solid #333',
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
                            width: '100px',
                            height: '100px',
                            borderRadius: '50%',
                            backgroundColor: '#333',
                            marginBottom: '15px',
                            border: `2px solid ${rank.color}`
                        }}
                    />
                    
                    <h2 style={{ margin: '0 0 5px 0', fontSize: '1.8rem' }}>{userData?.username}</h2>
                    <p style={{ color: '#aaa', margin: '0 0 20px 0' }}>{userData?.email}</p>

                    {/* Streak Info */}
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        marginBottom: '20px',
                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                        padding: '8px 16px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255, 152, 0, 0.3)'
                    }}>
                        <i className="fas fa-fire" style={{ color: '#ff9800', fontSize: '1.2rem' }}></i>
                        <span style={{ color: '#ff9800', fontWeight: 'bold', fontSize: '1.1rem' }}>
                            {userData?.streak || 0} dni z rzędu
                        </span>
                    </div>

                    {/* Badges Section */}
                    <div style={{ width: '100%', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '10px', color: '#aaa' }}>Odznaki ({badges.filter(b => b.earned).length}/{badges.length})</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px' }}>
                            {badges.length === 0 ? (
                                <p style={{ fontSize: '0.8rem', color: '#666' }}>Brak odznak</p>
                            ) : (
                                visibleBadges.map(badge => (
                                    <div key={badge.id} className="badge-container" style={{ 
                                        width: '40px', 
                                        height: '40px', 
                                        backgroundColor: badge.earned ? '#333' : '#222', 
                                        borderRadius: '50%', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: badge.earned ? '#ffd700' : '#555',
                                        border: badge.earned ? '1px solid #444' : '1px dashed #333',
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
                                    color: 'var(--primary-blue, #3498db)',
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

                    {/* Rank Info */}
                    <div style={{ width: '100%', borderTop: '1px solid #333', paddingTop: '20px' }}>
                        <div style={{ 
                            fontSize: '1.2rem', 
                            fontWeight: 'bold', 
                            color: rank.color,
                            marginBottom: '5px'
                        }}>
                            {rank.name}
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '15px' }}>
                            Poziom {userLevel}
                        </div>
                        
                        <div style={{ marginBottom: '5px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#aaa' }}>
                            <span>{userPoints} XP</span>
                            <span>{nextLevelPoints} XP</span>
                        </div>
                        <div style={{ 
                            width: '100%', 
                            height: '6px', 
                            backgroundColor: '#333', 
                            borderRadius: '3px',
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
                        <p style={{ fontSize: '0.8rem', color: '#666' }}>
                            Do awansu: {nextLevelPoints - userPoints} XP
                        </p>
                    </div>
                </div>

                {/* Right Column: Forms */}
                <div style={{ flex: '2', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {formMessage.text && (
                        <div style={{
                            padding: '15px',
                            backgroundColor: formMessage.type === 'error' ? 'rgba(255, 77, 77, 0.1)' : 'rgba(77, 255, 77, 0.1)',
                            border: `1px solid ${formMessage.type === 'error' ? '#ff4d4d' : '#4dff4d'}`,
                            borderRadius: '8px',
                            color: formMessage.type === 'error' ? '#ff4d4d' : '#4dff4d',
                            textAlign: 'center'
                        }}>
                            {formMessage.text}
                        </div>
                    )}

                    <div style={{ backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '12px', border: '1px solid #333' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.3rem', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                            Edytuj Profil
                        </h3>
                        <form onSubmit={handleUpdateUsername}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Nazwa użytkownika</label>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        type="text"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        style={{
                                            flex: '1',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid #444',
                                            backgroundColor: '#2d2d2d',
                                            color: 'white'
                                        }}
                                    />
                                    <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>Zapisz</button>
                                </div>
                            </div>
                        </form>

                        <form onSubmit={handleUpdateBio}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>O mnie (Bio)</label>
                                <textarea
                                    value={bio}
                                    onChange={(e) => setBio(e.target.value)}
                                    rows="4"
                                    placeholder="Napisz coś o sobie..."
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #444',
                                        backgroundColor: '#2d2d2d',
                                        color: 'white',
                                        resize: 'vertical'
                                    }}
                                />
                                <div style={{ textAlign: 'right', marginTop: '10px' }}>
                                    <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>Zapisz Bio</button>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div style={{ backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '12px', border: '1px solid #333' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.3rem', borderBottom: '1px solid #333', paddingBottom: '10px' }}>
                            Bezpieczeństwo
                        </h3>
                        <form onSubmit={handleChangePassword}>
                            <div style={{ marginBottom: '15px' }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Obecne hasło</label>
                                <input
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #444',
                                        backgroundColor: '#2d2d2d',
                                        color: 'white'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div style={{ flex: 1, marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Nowe hasło</label>
                                    <input
                                        type="password"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid #444',
                                            backgroundColor: '#2d2d2d',
                                            color: 'white'
                                        }}
                                    />
                                </div>
                                <div style={{ flex: 1, marginBottom: '15px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', color: '#aaa' }}>Potwierdź hasło</label>
                                    <input
                                        type="password"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid #444',
                                            backgroundColor: '#2d2d2d',
                                            color: 'white'
                                        }}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>Zmień Hasło</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
