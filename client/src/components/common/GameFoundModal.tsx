import UserAvatar from '../UserAvatar';
import React from 'react';
import './SuccessModal.css'; // Reuse styles for consistency
import type { DashboardUser, GameSession } from '../../types/api';

const GameFoundModal = ({ isOpen, gameSession, userData, onAccept }: { isOpen: boolean; gameSession: GameSession | null; userData: DashboardUser | null; onAccept: () => void }) => {
    if (!isOpen || !gameSession || !userData) return null;

    const isPlayer1 = gameSession.player1Id === userData.id;
    const opponentName = isPlayer1 ? gameSession.player2Username : gameSession.player1Username;
    
    const myElo = isPlayer1 ? gameSession.player1Elo : gameSession.player2Elo;
    const opponentElo = isPlayer1 ? gameSession.player2Elo : gameSession.player1Elo;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '600px', textAlign: 'center', padding: '40px', background: 'var(--bg-panel)', border: '1px solid var(--border-color)' }}>
                <h1 style={{ fontSize: '2.5rem', color: 'var(--text-light)', marginBottom: '20px', marginTop: 0 }}>
                    Mecz Znaleziony!
                </h1>
                
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '40px', margin: '40px 0' }}>
                    <div style={{ textAlign: 'center' }}>
                        <UserAvatar username={userData.username} seed={isPlayer1 ? gameSession.player1AvatarSeed : gameSession.player2AvatarSeed} alt="Ty" style={{ width: '100px', borderRadius: '50%', border: '3px solid #3498db' }} />
                        <h3 style={{ marginTop: '10px', marginBottom: '5px', color: 'var(--text-light)' }}>Ty</h3>
                        <span style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>ELO: {myElo}</span>
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ff2d55' }}>VS</div>
                    <div style={{ textAlign: 'center' }}>
                        <UserAvatar username={opponentName} seed={isPlayer1 ? gameSession.player2AvatarSeed : gameSession.player1AvatarSeed} alt="Rywal" style={{ width: '100px', borderRadius: '50%', border: '3px solid #e74c3c' }} />
                        <h3 style={{ marginTop: '10px', marginBottom: '5px', color: 'var(--text-light)' }}>{opponentName}</h3>
                        <span style={{ color: 'var(--text-gray)', fontSize: '0.9rem' }}>ELO: {opponentElo}</span>
                    </div>
                </div>

                <button 
                    onClick={onAccept} 
                    className="btn btn-primary"
                    style={{ fontSize: '1.2rem', padding: '15px 40px', width: '100%' }}
                >
                    WEJDŹ DO GRY
                </button>
            </div>
        </div>
    );
};

export default GameFoundModal;
