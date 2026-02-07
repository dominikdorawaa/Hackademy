import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import GameFoundModal from '../components/common/GameFoundModal';
import API_URL from '../apiConfig';

const ArenaPage = () => {
    const { token } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [status, setStatus] = useState('IDLE'); // IDLE, QUEUE, GAME, FINISHED
    const [gameSession, setGameSession] = useState(null);
    const [error, setError] = useState(null);
    const [challenges, setChallenges] = useState([]);
    
    // Friend Selection Modal State
    const [showFriendModal, setShowFriendModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const [challengedFriends, setChallengedFriends] = useState([]);
    
    // Processing state to prevent double clicks
    const [processingChallengeId, setProcessingChallengeId] = useState(null);
    const [acceptedChallenges, setAcceptedChallenges] = useState([]);

    // Ref to track if we have already shown the finished screen for a specific game
    const finishedGameIdRef = useRef(null);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await fetch(`${API_URL}/api/user/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUserData(data);
                }
            } catch (err) {
                console.error("Failed to fetch user data", err);
            }
        };
        fetchUserData();
    }, [token]);

    // Initial check for active game (only once on mount)
    useEffect(() => {
        const checkInitialStatus = async () => {
            if (token) {
                try {
                    const response = await fetch(`${API_URL}/api/arena/status`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    
                    if (response.status === 200) {
                        const session = await response.json();
                        if (session.status !== 'FINISHED') {
                            setGameSession(session);
                            setStatus('GAME');
                        }
                    }
                } catch (err) {
                    console.error("Initial status check error", err);
                }
            }
        };
        checkInitialStatus();
    }, [token]);

    // Polling for game status and challenges
    useEffect(() => {
        let interval;
        if (token) {
            interval = setInterval(async () => {
                try {
                    // Check game status ONLY if we are in QUEUE or GAME state
                    // If IDLE, we don't want to accidentally join a game we just cancelled
                    if (status === 'QUEUE' || status === 'GAME') {
                        const response = await fetch(`${API_URL}/api/arena/status`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        
                        if (response.status === 200) {
                            const session = await response.json();
                            
                            // Jeśli szukamy gry, interesują nas tylko aktywne sesje
                            if (status === 'QUEUE' && session.status === 'FINISHED') {
                                return; // Ignoruj stare zakończone gry
                            }

                            if (session.status === 'FINISHED') {
                                // If game is finished, we don't want to show the result screen here anymore
                                // because it's shown in the RoomPage modal.
                                // So we just reset to IDLE to allow starting a new game.
                                if (status !== 'IDLE') {
                                    setStatus('IDLE');
                                    setGameSession(null);
                                }
                            } else {
                                // Active game or other status
                                setGameSession(session);
                                setStatus('GAME');
                                // Reset finished ref if we are in a new game (though ID check above handles most cases)
                                if (finishedGameIdRef.current !== null && finishedGameIdRef.current !== session.id) {
                                     finishedGameIdRef.current = null;
                                }
                            }
                        } else if (status === 'GAME') {
                             // If we were in GAME but now no content (204), it means game might have ended or invalid
                             // We switch to IDLE
                             setStatus('IDLE');
                             setGameSession(null);
                        }
                    }

                    // Check challenges (always check for challenges)
                    const challengesRes = await fetch(`${API_URL}/api/arena/challenges`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (challengesRes.ok) {
                        const data = await challengesRes.json();
                        setChallenges(data);
                    }

                } catch (err) {
                    console.error("Polling error", err);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [status, token]);

    const fetchFriends = async () => {
        setFriendsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/friends`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFriends(data);
            }
        } catch (err) {
            console.error("Failed to fetch friends", err);
        } finally {
            setFriendsLoading(false);
        }
    };

    const handleOpenFriendModal = () => {
        setShowFriendModal(true);
        fetchFriends();
    };

    const handleChallengeFriend = async (username) => {
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
                setShowFriendModal(false); // Close modal after successful challenge
                
                // Remove from challenged list after 10 seconds to allow re-challenge if rejected
                setTimeout(() => {
                    setChallengedFriends(prev => prev.filter(name => name !== username));
                }, 10000);
            } else {
                const data = await response.json();
                alert(`Błąd: ${data.message}`);
            }
        } catch (err) {
            console.error("Failed to send challenge", err);
            alert("Błąd sieci.");
        }
    };

    const handleJoinQueue = async () => {
        try {
            const response = await fetch(`${API_URL}/api/arena/join`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                setStatus('QUEUE');
                setError(null);
                // finishedGameIdRef.current = null; // Don't reset here to avoid showing old game on cancel
                setGameSession(null); // Clear previous session
            } else {
                const data = await response.json();
                setError(data.message);
            }
        } catch (err) {
            setError("Błąd sieci");
        }
    };

    const handleLeaveQueue = async () => {
        // Immediately update UI state to prevent race conditions
        setStatus('IDLE');
        setGameSession(null);
        
        try {
            await fetch(`${API_URL}/api/arena/leave`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.error("Error leaving queue", err);
        }
    };

    const handleAcceptChallenge = async (challengeId) => {
        if (processingChallengeId === challengeId || acceptedChallenges.includes(challengeId)) return; // Prevent double click
        setProcessingChallengeId(challengeId);

        try {
            const response = await fetch(`${API_URL}/api/arena/challenge/${challengeId}/accept`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const session = await response.json();
                setAcceptedChallenges(prev => [...prev, challengeId]);
                setGameSession(session);
                setStatus('GAME');
                finishedGameIdRef.current = null;
                // Remove accepted challenge from list
                setChallenges(prev => prev.filter(c => c.id !== challengeId));
            } else {
                const data = await response.json();
                alert(data.message);
            }
        } catch (err) {
            console.error("Error accepting challenge", err);
        } finally {
            setProcessingChallengeId(null);
        }
    };

    const handleRejectChallenge = async (challengeId) => {
        if (processingChallengeId === challengeId) return;
        setProcessingChallengeId(challengeId);

        try {
            await fetch(`${API_URL}/api/arena/challenge/${challengeId}/reject`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setChallenges(challenges.filter(c => c.id !== challengeId));
        } catch (err) {
            console.error("Error rejecting challenge", err);
        } finally {
            setProcessingChallengeId(null);
        }
    };

    const handleBackToArena = () => {
        setStatus('IDLE');
        setGameSession(null);
        // finishedGameIdRef.current is already set for this game, so polling won't show it again
        // But if we want to be sure, we keep it set until a new game starts
    };

    if (!userData) return <div className="container" style={{ paddingTop: '40px' }}>Ładowanie...</div>;

    const userLevel = Math.floor(userData.points / 100) + 1;
    const canPlay = userLevel >= 5;

    return (
        <section className="arena-section" id="arena" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 'calc(100vh - 170px)', paddingTop: '40px'}}>
            
            {/* Challenges Section */}
            {challenges.length > 0 && (
                <div className="container" style={{ maxWidth: '600px', marginBottom: '30px', width: '100%' }}>
                    <div style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', border: '1px solid #ff9800', borderRadius: '12px', padding: '20px' }}>
                        <h3 style={{ color: '#ff9800', marginTop: 0, marginBottom: '15px', fontSize: '1.2rem' }}>
                            <i className="fas fa-swords" style={{ marginRight: '10px' }}></i>
                            Otrzymane Wyzwania ({challenges.length})
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {challenges.map(challenge => {
                                const isAccepted = acceptedChallenges.includes(challenge.id);
                                return (
                                    <div key={challenge.id} style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        backgroundColor: '#1e1e1e',
                                        padding: '15px',
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${challenge.challengerUsername}`} alt="Avatar" style={{ width: '40px', borderRadius: '50%' }} />
                                            <span style={{ fontWeight: 'bold' }}>{challenge.challengerUsername}</span>
                                            <span style={{ color: '#aaa', fontSize: '0.9rem' }}>wyzywa Cię!</span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                onClick={() => handleAcceptChallenge(challenge.id)} 
                                                className="btn btn-primary" 
                                                style={{ 
                                                    padding: '5px 15px', 
                                                    fontSize: '0.9rem', 
                                                    opacity: (processingChallengeId === challenge.id || isAccepted) ? 0.5 : 1,
                                                    cursor: (processingChallengeId === challenge.id || isAccepted) ? 'default' : 'pointer'
                                                }}
                                                disabled={processingChallengeId === challenge.id || isAccepted}
                                            >
                                                {isAccepted ? 'Zaakceptowano' : 'Akceptuj'}
                                            </button>
                                            {!isAccepted && (
                                                <button 
                                                    onClick={() => handleRejectChallenge(challenge.id)} 
                                                    className="btn btn-outline" 
                                                    style={{ padding: '5px 15px', fontSize: '0.9rem', borderColor: '#e74c3c', color: '#e74c3c', opacity: processingChallengeId === challenge.id ? 0.5 : 1 }}
                                                    disabled={processingChallengeId === challenge.id}
                                                >
                                                    Odrzuć
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div className="container" style={{ maxWidth: '600px' }}>
                <div className="elo-card-wrapper">
                    <div className="elo-card">
                        <span className="elo-badge">TRYB RANKINGOWY</span>

                        <h3 style={{ marginBottom: '10px' }}>Pojedynki 1v1</h3>
                        <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '30px' }}>
                            Pnij się w drabinie rankingowej. System dobierze Ci przeciwnika o równym poziomie – wygrywa ten, kto szybciej przełamie zabezpieczenia systemu.
                        </p>

                        {status === 'QUEUE' ? (
                            <div style={{ textAlign: 'center', margin: '40px 0' }}>
                                <div className="spinner" style={{ 
                                    width: '50px', height: '50px', border: '5px solid rgba(255,255,255,0.1)', 
                                    borderTop: '5px solid var(--primary-blue)', borderRadius: '50%', 
                                    animation: 'spin 1s linear infinite', margin: '0 auto 20px' 
                                }}></div>
                                <p>Szukanie przeciwnika...</p>
                                <button onClick={handleLeaveQueue} className="btn btn-outline" style={{ marginTop: '20px', borderColor: '#e74c3c', color: '#e74c3c' }}>
                                    Anuluj
                                </button>
                                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                            </div>
                        ) : (
                            <>
                                <div className="matchup-visual">
                                    <div className="player-av p-blue">
                                        <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${userData.username}`} alt="Ty" />
                                    </div>
                                    <div className="vs-icon">VS</div>
                                    <div className="player-av p-red">
                                        <div style={{ width: '100%', height: '100%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '2rem' }}>?</div>
                                    </div>
                                </div>
                                
                                {canPlay ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <button onClick={handleJoinQueue} className="elo-btn">
                                            <i className="fas fa-search"></i> Znajdź Przeciwnika
                                        </button>
                                        <button onClick={handleOpenFriendModal} className="elo-btn" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
                                            <i className="fas fa-swords"></i> Wyzwij Znajomego
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <button className="elo-btn" disabled style={{ cursor: 'not-allowed', opacity: 0.5 }}>
                                            <i className="fas fa-lock"></i> Zablokowane
                                        </button>
                                        <p style={{ color: 'var(--primary-red)', marginTop: '15px', fontSize: '0.9rem' }}>
                                            <i className="fas fa-lock" style={{ marginRight: '8px' }}></i>
                                            Wymagany poziom 5 (500 pkt)
                                        </p>
                                    </>
                                )}
                                {error && <p style={{ color: '#e74c3c', marginTop: '10px' }}>{error}</p>}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Game Found Modal */}
            <GameFoundModal 
                isOpen={status === 'GAME' && gameSession}
                gameSession={gameSession}
                userData={userData}
                onAccept={() => navigate(`/rooms/${gameSession.roomId}?arena=${gameSession.id}`)}
            />

            {/* Friend Selection Modal */}
            {showFriendModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: '#1e1e1e', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px',
                        border: '1px solid #333', maxHeight: '80vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0 }}>Wybierz Znajomego</h2>
                            <button onClick={() => setShowFriendModal(false)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                        </div>

                        {friendsLoading ? (
                            <p>Ładowanie znajomych...</p>
                        ) : friends.length === 0 ? (
                            <p style={{ color: '#aaa' }}>Nie masz jeszcze znajomych.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {friends.map(friend => (
                                    <div key={friend.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '15px', backgroundColor: '#2d2d2d', borderRadius: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${friend.username}`} alt="Avatar" style={{ width: '40px', borderRadius: '50%' }} />
                                            <span style={{ fontWeight: 'bold' }}>{friend.username}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleChallengeFriend(friend.username)}
                                            className="btn btn-primary"
                                         disabled={challengedFriends.includes(friend.username)}
                                            style={{
                                                padding: '5px 15px',
                                                fontSize: '0.9rem',
                                                opacity: challengedFriends.includes(friend.username) ? 0.6 : 1,
                                            }}
                                        >
                                            {challengedFriends.includes(friend.username) ? 'Wyzwano' : 'Wyzwij'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
};

export default ArenaPage;