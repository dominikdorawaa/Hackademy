import React from 'react';
import './SuccessModal.css'; // Reuse styles or create new ones

const ArenaResultModal = ({ isOpen, onClose, session, currentUserId }) => {
    if (!isOpen || !session) return null;

    const isWinner = session.winnerId === currentUserId;
    const isPlayer1 = session.player1Id === currentUserId;
    
    const opponentName = isPlayer1 ? session.player2Username : session.player1Username;
    const currentUserName = isPlayer1 ? session.player1Username : session.player2Username;
    
    const myEloChange = isPlayer1 ? session.player1EloChange : session.player2EloChange;
    const opponentEloChange = isPlayer1 ? session.player2EloChange : session.player1EloChange;

    // Calculate current ELO (initial + change)
    const myInitialElo = isPlayer1 ? session.player1Elo : session.player2Elo;
    const opponentInitialElo = isPlayer1 ? session.player2Elo : session.player1Elo;
    
    const myCurrentElo = (myInitialElo || 500) + (myEloChange || 0);
    const opponentCurrentElo = (opponentInitialElo || 500) + (opponentEloChange || 0);

    // Determine winner/loser data for display
    const winnerName = isWinner ? currentUserName : opponentName;
    const loserName = !isWinner ? currentUserName : opponentName;
    
    const winnerElo = isWinner ? myCurrentElo : opponentCurrentElo;
    const loserElo = !isWinner ? myCurrentElo : opponentCurrentElo;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ width: '600px', maxWidth: '90vw', textAlign: 'center', padding: '40px', background: '#1e1e1e', border: '1px solid #333' }}>
                <h1 style={{ fontSize: '3rem', color: isWinner ? '#2ecc71' : '#e74c3c', marginBottom: '10px', marginTop: 0 }}>
                    {isWinner ? 'ZWYCIĘSTWO!' : 'PORAŻKA'}
                </h1>
                <p style={{ color: '#aaa', marginBottom: '20px' }}>
                    {isWinner ? 'Gratulacje! Pokonałeś przeciwnika.' : 'Niestety, tym razem się nie udało.'}
                </p>
                
                {/* ELO Change Display */}
                {myEloChange !== undefined && myEloChange !== null && (
                    <div style={{ 
                        fontSize: '1.5rem', 
                        fontWeight: 'bold', 
                        color: myEloChange >= 0 ? '#2ecc71' : '#e74c3c',
                        marginBottom: '40px',
                        padding: '10px',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        borderRadius: '8px',
                        display: 'inline-block'
                    }}>
                        {myEloChange >= 0 ? '+' : ''}{myEloChange} ELO
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', marginBottom: '40px' }}>
                    {/* Winner */}
                    <div style={{ textAlign: 'center', width: '150px' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                            <img 
                                src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${winnerName}`} 
                                alt="Winner" 
                                style={{ width: '100px', borderRadius: '50%', border: '4px solid #ffd700', boxShadow: '0 0 20px rgba(255, 215, 0, 0.5)' }} 
                            />
                            <i className="fas fa-crown" style={{ position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)', color: '#ffd700', fontSize: '2rem' }}></i>
                        </div>
                        <h3 style={{ marginTop: '15px', color: '#ffd700', fontSize: '1.2rem', marginBottom: '5px' }}>ZWYCIĘZCA</h3>
                        <p style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>{winnerName}</p>
                        <p style={{ fontSize: '0.9rem', color: '#aaa', marginTop: '5px' }}>ELO: {winnerElo}</p>
                    </div>

                    {/* Loser */}
                    <div style={{ textAlign: 'center', width: '150px' }}>
                        <img 
                            src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${loserName}`} 
                            alt="Loser" 
                            style={{ width: '80px', borderRadius: '50%', border: '4px solid #e74c3c', filter: 'grayscale(50%)' }} 
                        />
                        <h3 style={{ marginTop: '15px', color: '#e74c3c', fontSize: '1.2rem', marginBottom: '5px' }}>PRZEGRANY</h3>
                        <p style={{ fontSize: '1rem', fontWeight: 'bold', margin: 0 }}>{loserName}</p>
                        <p style={{ fontSize: '0.9rem', color: '#aaa', marginTop: '5px' }}>ELO: {loserElo}</p>
                    </div>
                </div>

                <button 
                    onClick={onClose} 
                    className="btn btn-primary"
                    style={{ fontSize: '1.1rem', padding: '12px 30px' }}
                >
                    Wróć do Areny
                </button>
            </div>
        </div>
    );
};

export default ArenaResultModal;
