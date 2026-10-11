import UserAvatar from '../components/UserAvatar';
import * as userApi from '../services/userApi';
import * as arenaApi from '../services/arenaApi';
import * as friendApi from '../services/friendApi';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import type { DashboardUser, FriendDto } from '../types/api';

type ArenaStatus = 'IDLE' | 'QUEUE' | 'GAME' | 'FINISHED' | 'CHALLENGING';

const ArenaPage = () => {
    const { token } = useAuth();
    const [userData, setUserData] = useState<DashboardUser | null>(null);
    const { state: realtime, connected, synchronize } = useRealtime();
    const [joiningQueue, setJoiningQueue] = useState(false);
    const gameSession = realtime?.gameSession ?? null;
    const challenges = realtime?.challenges ?? [];
    const status: ArenaStatus = gameSession && gameSession.status !== 'FINISHED' ? 'GAME'
        : realtime?.queued ? 'QUEUE' : realtime?.outgoingChallenges.length ? 'CHALLENGING' : 'IDLE';
    const [error, setError] = useState<string | null>(null);

    // Friend Selection Modal State
    const [showFriendModal, setShowFriendModal] = useState(false);
    const [friends, setFriends] = useState<FriendDto[]>([]);
    const [friendsLoading, setFriendsLoading] = useState(false);
    const challengedFriends = (realtime?.outgoingChallenges ?? []).map(challenge => challenge.targetUsername);

    // Error Modal State
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    // Processing state to prevent double clicks
    const [processingChallengeId, setProcessingChallengeId] = useState<string | null>(null);
    const [acceptedChallenges, setAcceptedChallenges] = useState<string[]>([]);

    // VPN Preference
    const [vpnEnabled, setVpnEnabled] = useState(false);


    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const response = await userApi.getCurrentUser({ 'Authorization': `Bearer ${token}` });
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

    const fetchFriends = async () => {
        setFriendsLoading(true);
        try {
            const response = await friendApi.getFriends({ 'Authorization': `Bearer ${token}` });
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

    const handleChallengeFriend = async (username: string) => {
        try {
            const response = await arenaApi.createChallenge({
                    targetUsername: username,
                    vpnEnabled: vpnEnabled // Send vpnEnabled status
                }, {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                });

            if (response.ok) {
                setShowFriendModal(false);
                await synchronize();
            } else {
                const data = await response.json();
                // Close friend modal and show error modal
                setShowFriendModal(false);
                setErrorMessage(data.message ?? 'Błąd');
                setShowErrorModal(true);
            }
        } catch (err) {
            console.error("Failed to send challenge", err);
            setShowFriendModal(false);
            setErrorMessage("Błąd sieci.");
            setShowErrorModal(true);
        }
    };

    const handleJoinQueue = async () => {
        if (joiningQueue || !connected || !realtime) return;
        setJoiningQueue(true);
        setError(null);
        try {
            const response = await arenaApi.joinQueue({ vpnEnabled }, {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                });

            if (response.ok) {
                setError(null);
                await synchronize();
            } else {
                const data = await response.json();
                setError(data.message ?? 'Błąd');
            }
        } catch {
            setError("Błąd sieci");
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
            console.error("Error leaving queue", err);
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
        if (processingChallengeId === challengeId || acceptedChallenges.includes(challengeId)) return; // Prevent double click
        setProcessingChallengeId(challengeId);

        try {
            const response = await arenaApi.acceptChallenge(challengeId, { 'Authorization': `Bearer ${token}` });

            if (response.ok) {
                setAcceptedChallenges(prev => [...prev, challengeId]);
                await synchronize();

            } else {
                const data = await response.json();
                console.error("Accept failed:", data);
                alert(data.message);
            }
        } catch (err) {
            console.error("Error accepting challenge", err);
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
            console.error("Error rejecting challenge", err);
        } finally {
            setProcessingChallengeId(null);
        }
    };

    if (!userData) return <div className="hackademy-container" style={{ paddingTop: '40px' }}>Ładowanie...</div>;

    const userLevel = Math.floor(userData.points / 100) + 1;
    const canPlay = userLevel >= 5;

    return (
        <section className="arena-section" id="arena" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: 'calc(100vh - 170px)', paddingTop: '40px'}}>

            {/* Challenges Section */}
            {challenges.length > 0 && (
                <div className="hackademy-container" style={{ maxWidth: '600px', marginBottom: '30px', width: '100%' }}>
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
                                        backgroundColor: 'var(--bg-panel)',
                                        padding: '15px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <UserAvatar username={challenge.challengerUsername} seed={challenge.challengerAvatarSeed} alt="Avatar" style={{ width: '40px', borderRadius: '50%' }} />
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-light)' }}>{challenge.challengerUsername}</span>
                                            <span style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>wyzywa Cię!</span>
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

            <div className="hackademy-container" style={{ maxWidth: '600px' }}>
                <div className="elo-card-wrapper">
                    <div className="elo-card">
                        <span className="elo-badge">TRYB RANKINGOWY</span>

                        <h3 style={{ marginBottom: '10px', color: 'var(--text-light)' }}>Pojedynki 1v1</h3>
                        {(!connected || !realtime) && <p role="status">Łączenie z Areną. Poczekaj na połączenie z serwerem.</p>}
                        <p style={{ color: 'var(--text-gray)', fontSize: '0.9rem', marginBottom: '30px' }}>
                            Pnij się w drabinie rankingowej. System dobierze Ci przeciwnika o równym poziomie – wygrywa ten, kto szybciej przełamie zabezpieczenia systemu.
                        </p>

                        {status === 'QUEUE' || joiningQueue ? (
                            <div role="status" aria-live="polite" style={{ textAlign: 'center', margin: '40px 0' }}>
                                <div className="spinner" style={{
                                    width: '50px', height: '50px', border: '5px solid rgba(255,255,255,0.1)',
                                    borderTop: '5px solid var(--primary-blue)', borderRadius: '50%',
                                    animation: 'spin 1s linear infinite', margin: '0 auto 20px'
                                }}></div>
                                <p style={{ color: 'var(--text-light)' }}>{joiningQueue ? 'Dołączanie do kolejki...' : 'Szukanie przeciwnika...'}</p>
                                <button onClick={handleLeaveQueue} disabled={joiningQueue} className="btn btn-outline" style={{ marginTop: '20px', borderColor: '#e74c3c', color: '#e74c3c' }}>
                                    Anuluj
                                </button>
                                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                            </div>
                        ) : status === 'CHALLENGING' ? (
                            <div style={{ textAlign: 'center', margin: '40px 0' }}>
                                <div className="spinner" style={{
                                    width: '50px', height: '50px', border: '5px solid rgba(255,152,0,0.1)',
                                    borderTop: '5px solid #ff9800', borderRadius: '50%',
                                    animation: 'spin 1s linear infinite', margin: '0 auto 20px'
                                }}></div>
                                <p style={{ color: 'var(--text-light)' }}>Oczekiwanie na akceptację wyzwania...</p>
                                <button onClick={handleCancelChallenges} className="btn btn-outline" style={{ marginTop: '20px', borderColor: '#e74c3c', color: '#e74c3c' }}>
                                    Anuluj
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="matchup-visual">
                                    <div className="player-av p-blue">
                                        <UserAvatar username={userData.username} seed={userData.avatarSeed} alt="Ty" />
                                    </div>
                                    <div className="vs-icon">VS</div>
                                    <div className="player-av p-red">
                                        <div style={{ width: '100%', height: '100%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: '2rem' }}>?</div>
                                    </div>
                                </div>

                                {canPlay ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                                            <label style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                cursor: userData.hasVpnAccess ? 'pointer' : 'not-allowed',
                                                color: userData.hasVpnAccess ? 'var(--text-gray)' : '#555',
                                                fontSize: '0.9rem'
                                            }}
                                            title={!userData.hasVpnAccess ? 'Ukończ "Tutorial VPN", aby odblokować.' : ''}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={vpnEnabled}
                                                    onChange={(e) => setVpnEnabled(e.target.checked)}
                                                    disabled={!userData.hasVpnAccess}
                                                    style={{ width: '18px', height: '18px', cursor: userData.hasVpnAccess ? 'pointer' : 'not-allowed' }}
                                                />
                                                Uwzględnij zadania VPN
                                                {!userData.hasVpnAccess && <i className="fas fa-lock" style={{ fontSize: '0.8rem', marginLeft: '5px' }}></i>}
                                            </label>
                                        </div>

                                        <button onClick={handleJoinQueue} disabled={!connected || !realtime} className="elo-btn">
                                            <i className="fas fa-search"></i> Znajdź Przeciwnika
                                        </button>
                                        <button onClick={handleOpenFriendModal} disabled={!connected || !realtime} className="elo-btn elo-btn-outline">
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

            {/* Friend Selection Modal */}
            {showFriendModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px',
                        border: '1px solid var(--border-color)', maxHeight: '80vh', overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, color: 'var(--text-light)' }}>Wybierz Znajomego</h2>
                            <button onClick={() => setShowFriendModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-gray)', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                        </div>

                        {friendsLoading ? (
                            <p style={{ color: 'var(--text-light)' }}>Ładowanie znajomych...</p>
                        ) : friends.length === 0 ? (
                            <p style={{ color: 'var(--text-gray)' }}>Nie masz jeszcze znajomych.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {friends.map(friend => (
                                    <div key={friend.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '15px', backgroundColor: 'var(--bg-panel-lighter)', borderRadius: '8px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <UserAvatar username={friend.username} seed={friend.avatarSeed} alt="Avatar" style={{ width: '40px', borderRadius: '50%' }} />
                                            <span style={{ fontWeight: 'bold', color: 'var(--text-light)' }}>{friend.username}</span>
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

            {/* Error Modal */}
            {showErrorModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100
                }}>
                    <div style={{
                        backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '400px',
                        border: '1px solid #e74c3c', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '3rem', color: '#e74c3c', marginBottom: '20px' }}>
                            <i className="fas fa-exclamation-circle"></i>
                        </div>
                        <h2 style={{ margin: '0 0 15px 0', color: 'var(--text-light)' }}>Błąd</h2>
                        <p style={{ color: 'var(--text-gray)', marginBottom: '25px' }}>{errorMessage}</p>
                        <button
                            onClick={() => setShowErrorModal(false)}
                            className="btn btn-primary"
                            style={{ padding: '10px 30px' }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ArenaPage;
