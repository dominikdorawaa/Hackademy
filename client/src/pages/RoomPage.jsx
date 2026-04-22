import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmationModal from '../components/common/ConfirmationModal';
import ToastNotification from '../components/common/ToastNotification';
import SuccessModal from '../components/common/SuccessModal';
import ArenaResultModal from '../components/common/ArenaResultModal';
import ArenaChat from '../components/ArenaChat';
import API_URL from '../apiConfig';
import './RoomPage.css';

const RoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();
  
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unlockedHints, setUnlockedHints] = useState([]);
  const [potentialPoints, setPotentialPoints] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hintToUnlock, setHintToUnlock] = useState(null);
  
  const [flag, setFlag] = useState('');
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', null
  const [submitMessage, setSubmitMessage] = useState('');
  
  // Success Modal State (Normal Mode)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');

  // Arena Result Modal State
  const [showArenaResultModal, setShowArenaResultModal] = useState(false);

  // Surrender Modal State
  const [showSurrenderModal, setShowSurrenderModal] = useState(false);

  // Arena specific state
  const [arenaSession, setArenaSession] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [penaltyTime, setPenaltyTime] = useState(0);
  const [userData, setUserData] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Training Mode State
  const [isTrainingMode, setIsTrainingMode] = useState(false);

  // Toast state
  const [toast, setToast] = useState(null);

  // Arena Mode
  const queryParams = new URLSearchParams(location.search);
  const arenaGameId = queryParams.get('arena');
  const isArenaMode = !!arenaGameId;

  // Fetch user data to know current user ID
  useEffect(() => {
      if (token) {
          fetch(`${API_URL}/api/user/me`, {
              headers: { 'Authorization': `Bearer ${token}` }
          })
          .then(res => res.json())
          .then(data => setUserData(data))
          .catch(err => console.error(err));
      }
  }, [token]);

  // Timer for Arena
  useEffect(() => {
    let timer;
    // Timer should run if game is ACTIVE OR WAITING_FOR_OPPONENT
    if (isArenaMode && arenaSession && userData) {
        const startTime = new Date(arenaSession.startTime).getTime();
        
        // Check if current user has finished
        const userFinishTime = arenaSession.finishTimes && arenaSession.finishTimes[userData.id];
        
        if (userFinishTime) {
            // User finished, time is fixed
            const finishTime = new Date(userFinishTime).getTime();
            setElapsedTime(Math.floor((finishTime - startTime) / 1000));
        } else if (arenaSession.status === 'ACTIVE' || arenaSession.status === 'WAITING_FOR_OPPONENT') {
            // User still playing, time ticks
            timer = setInterval(() => {
                const now = new Date().getTime();
                setElapsedTime(Math.floor((now - startTime) / 1000));
            }, 1000);
        }
    }
    return () => clearInterval(timer);
  }, [isArenaMode, arenaSession, userData]);

  // Polling for Arena Game Status
  useEffect(() => {
    let interval;
    if (isArenaMode && token && userData) {
        // Initial fetch
        fetch(`${API_URL}/api/arena/game/${arenaGameId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(res => res.json()).then(data => {
            setArenaSession(data);
            // Sync unlocked hints from session
            if (data.hintsUsed && data.hintsUsed[userData.id]) {
                setUnlockedHints(data.hintsUsed[userData.id]);
                setPenaltyTime(data.hintsUsed[userData.id].length * 120);
            } else {
                setUnlockedHints([]);
                setPenaltyTime(0);
            }
        });

        interval = setInterval(async () => {
            try {
                const response = await fetch(`${API_URL}/api/arena/game/${arenaGameId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const session = await response.json();
                    setArenaSession(session);
                    
                    // Sync unlocked hints from session (in case of refresh)
                    if (session.hintsUsed && session.hintsUsed[userData.id]) {
                        setUnlockedHints(session.hintsUsed[userData.id]);
                        setPenaltyTime(session.hintsUsed[userData.id].length * 120);
                    }
                    
                    if (session.status === 'FINISHED') {
                        setShowArenaResultModal(true);
                    }
                }
            } catch (err) {
                console.error("Polling error", err);
            }
        }, 2000); 
    }
    return () => clearInterval(interval);
  }, [isArenaMode, arenaGameId, token, navigate, userData]);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await fetch(`${API_URL}/api/rooms/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch room details');
        }
        
        const data = await response.json();
        setRoom(data);
        
        // Only set unlocked hints from room data if NOT in Arena mode
        if (!isArenaMode) {
            if (data.unlockedHintIds) {
              setUnlockedHints(data.unlockedHintIds);
              const unlockedCount = data.unlockedHintIds.length;
              setPotentialPoints(Math.max(0, data.points * (1 - unlockedCount * 0.25)));
            } else {
              setPotentialPoints(data.points);
            }
        } else {
            // In Arena mode, hints are managed via arenaSession state (see above useEffect)
            setPotentialPoints(0); // Points don't matter in Arena
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (token) {
      fetchRoom();
    }
  }, [id, token, isArenaMode]);

  const handleUnlockHint = (hintId) => {
    setHintToUnlock(hintId);
    setIsModalOpen(true);
  };

  const confirmUnlockHint = async () => {
    setIsModalOpen(false); 
    if (!hintToUnlock) return; 

    try {
        // If Arena Mode, call arena hint endpoint
        if (isArenaMode) {
            const response = await fetch(`${API_URL}/api/arena/game/${arenaGameId}/hint`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ hintId: hintToUnlock })
            });
            if (!response.ok) throw new Error("Failed to use hint in arena");
            
            setPenaltyTime(prev => prev + 120); // +2 minutes locally
            setUnlockedHints(prev => [...prev, hintToUnlock]);
            setSubmitMessage('Podpowiedź odblokowana! +2 minuty kary.');
            setSubmitStatus('warning');
        } else {
            // Normal mode
            const response = await fetch(`${API_URL}/api/rooms/${id}/hints/${hintToUnlock}/unlock`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to unlock hint');
            }

            setUnlockedHints([...unlockedHints, hintToUnlock]);
            setPotentialPoints(Math.max(0, room.points * (1 - (unlockedHints.length + 1) * 0.25)));
            setSubmitMessage('Podpowiedź odblokowana!');
            setSubmitStatus('success');
        }

    } catch (err) {
        setSubmitMessage(err.message);
        setSubmitStatus('error');
    } finally {
        setHintToUnlock(null);
    }
  };

  const cancelUnlockHint = () => {
    setIsModalOpen(false);
    setHintToUnlock(null);
  };

  const handleDownloadFile = async () => {
      try {
          const response = await fetch(`${API_URL}/api/rooms/${id}/file`, {
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              // Try to get filename from Content-Disposition header
              const contentDisposition = response.headers.get('Content-Disposition');
              let fileName = 'plik_do_pobrania';
              if (contentDisposition) {
                  const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                  if (fileNameMatch && fileNameMatch.length === 2)
                      fileName = fileNameMatch[1];
              } else if (room.fileName) {
                  fileName = room.fileName;
              }
              
              a.download = fileName;
              document.body.appendChild(a);
              a.click();
              a.remove();
              window.URL.revokeObjectURL(url);
          } else {
              setSubmitMessage("Błąd pobierania pliku.");
              setSubmitStatus('error');
          }
      } catch (err) {
          console.error("Download error", err);
          setSubmitMessage("Błąd sieci podczas pobierania.");
          setSubmitStatus('error');
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitStatus(null);
    setSubmitMessage('');

    try {
      let url = `${API_URL}/api/rooms/${id}/solve`;
      if (isArenaMode) {
          url = `${API_URL}/api/arena/game/${arenaGameId}/solve`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ flag })
      });

      const data = await response.json();

      if (response.ok) { 
        setSubmitStatus('success');
        setSubmitMessage(data.message);
        
        if (!isArenaMode) {
            if (!isTrainingMode) {
                setRoom(prev => ({ ...prev, solved: true, solutionsCount: prev.solutionsCount + 1 }));
                
                // Show Success Modal
                setEarnedPoints(data.pointsEarned || 0);
                setSuccessMessage("Misja zakończona sukcesem!");
                setShowSuccessModal(true);

                if (data.newBadges && data.newBadges.length > 0) {
                    data.newBadges.forEach((badge, index) => {
                        setTimeout(() => {
                            setToast({
                                message: `Zdobyłeś odznakę: ${badge.name}`,
                                type: 'success'
                            });
                        }, index * 5500);
                    });
                }
            } else {
                // Training mode success
                setSubmitMessage("Poprawna flaga! (Tryb treningowy - 0 pkt)");
                setEarnedPoints(0);
                setSuccessMessage("Trening ukończony pomyślnie!");
                setShowSuccessModal(true);
            }
        } else {
            // Arena logic
            if (data.status === 'WAITING') {
                setSubmitMessage("Poprawna flaga! Czekanie na wynik przeciwnika (z powodu Twoich kar czasowych)...");
            } else {
                // Instant win (or loss if opponent finished faster)
                if (data.status === 'FINISHED') {
                     setShowArenaResultModal(true);
                }
            }
        }
        
      } else {
        setSubmitStatus('error');
        setSubmitMessage(data.message || 'Niepoprawna flaga'); // Changed default message to Polish
      }
    } catch (err) {
      setSubmitStatus('error');
      setSubmitMessage('Błąd sieci'); // Changed to Polish
    }
  };

  const handleSurrender = () => {
      setShowSurrenderModal(true);
  };

  const confirmSurrender = async () => {
      setShowSurrenderModal(false);
      try {
          const response = await fetch(`${API_URL}/api/arena/game/${arenaGameId}/surrender`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
              setSubmitMessage("Poddano grę.");
          } else {
              setSubmitMessage("Błąd podczas poddawania gry.");
          }
      } catch (err) {
          console.error("Surrender error", err);
      }
  };

  const handleCloseSuccessModal = () => {
      setShowSuccessModal(false);
      if (isArenaMode) {
          navigate('/arena');
      }
  };
  
  const handleCloseArenaResultModal = () => {
      setShowArenaResultModal(false);
      navigate('/arena');
  };

  const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) return <div className="container" style={{paddingTop: '40px'}}>Ładowanie pokoju...</div>;
  if (error) return <div className="container" style={{paddingTop: '40px'}}>Błąd: {error}</div>;
  if (!room) return <div className="container" style={{paddingTop: '40px'}}>Nie znaleziono pokoju</div>;

  const pointsToDeduct = room.points * 0.25;
  const isSolved = isArenaMode ? false : room.solved; 
  
  // Show content if not solved OR if in training mode OR if in Arena mode (always show content until game over)
  const showContent = !isSolved || isTrainingMode || isArenaMode;

  return (
    <div className="room-page-container container">
      {isArenaMode && (
          <ArenaChat 
              gameId={arenaGameId} 
              isOpen={isChatOpen} 
              toggleChat={() => setIsChatOpen(!isChatOpen)} 
          />
      )}
      <div className="room-header">
        <button onClick={() => navigate(isArenaMode ? '/arena' : '/learn')} className="back-btn">
            &larr; Powrót
        </button>
        <div className="room-meta-top">
             {isArenaMode && (
                 <>
                    <span className="elo-badge" style={{marginRight: '10px', background: '#ff2d55', borderColor: '#ff2d55', color: 'white'}}>TRYB ARENY</span>
                    <span className="elo-badge" style={{marginRight: '10px', background: '#333', borderColor: '#555', color: '#fff'}}>
                        <i className="fas fa-clock"></i> {formatTime(elapsedTime + penaltyTime)}
                        {penaltyTime > 0 && <span style={{color: '#ff2d55', marginLeft: '5px'}}>(+{formatTime(penaltyTime)})</span>}
                    </span>
                 </>
             )}
             <span className={`difficulty-badge ${room.difficulty.toLowerCase()}`}>{room.difficulty}</span>
             <span className="points-badge">{room.points} pkt</span>
        </div>
        <h1>{room.title}</h1>
        {room.shortDescription && <p className="room-category">{room.shortDescription}</p>}
      </div>

      <div className="room-content">
        <div className="room-description">
            <h3>Opis Wyzwania</h3>
            <p style={{ whiteSpace: 'pre-line' }}>{room.description}</p>
            
            {/* Download Button */}
            {room.fileName && (
                <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1e1e1e', borderRadius: '8px', border: '1px solid #333' }}>
                    <h4 style={{ marginTop: 0 }}>Materiały do misji</h4>
                    <p style={{ fontSize: '0.9rem', color: '#aaa' }}>Pobierz plik: {room.fileName}</p>
                    <button onClick={handleDownloadFile} className="btn btn-outline" style={{ fontSize: '0.9rem' }}>
                        <i className="fas fa-download" style={{ marginRight: '8px' }}></i>
                        Pobierz Plik
                    </button>
                </div>
            )}
        </div>

        <div className="room-actions">
            <div className={`status-card ${isSolved ? 'solved' : ''}`}>
                <p>Rozwiązania: <strong>{room.solutionsCount}</strong></p>
                {isSolved ? (
                    <div className="solved-badge">
                        <i className="fas fa-check-circle"></i> Rozwiązane
                    </div>
                ) : (
                    <div className="unsolved-badge">
                        <i className="fas fa-lock-open"></i> Do zrobienia
                    </div>
                )}
            </div>

            {/* HINTS SECTION */}
            {showContent && room.hints && room.hints.length > 0 && (
                <div className="hints-section">
                    <h3>Podpowiedzi</h3>
                    {!isArenaMode && !isTrainingMode && <div className="potential-points">Punkty do zdobycia: <strong>{Math.round(potentialPoints)}</strong></div>}
                    {isTrainingMode && <div className="potential-points" style={{color: '#aaa'}}>Tryb treningowy (0 pkt)</div>}
                    {isArenaMode && <div className="potential-points" style={{color: '#ff9800'}}>Uwaga: Każda podpowiedź to +2 minuty kary czasowej!</div>}
                    
                    {room.hints.map((hint, index) => {
                        const isUnlocked = unlockedHints.includes(hint.id);
                        const isPreviousUnlocked = index === 0 || unlockedHints.includes(room.hints[index - 1].id);
                        const canUnlock = !isUnlocked && isPreviousUnlocked;

                        return (
                            <div key={hint.id} className="hint-container">
                                <h4>Podpowiedź {index + 1}</h4>
                                {isUnlocked ? (
                                    <div className="unlocked-hint">
                                        <p>{hint.description}</p>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => handleUnlockHint(hint.id)} 
                                        className="btn-unlock-hint"
                                        disabled={!canUnlock}
                                        style={{ opacity: canUnlock ? 1 : 0.5, cursor: canUnlock ? 'pointer' : 'not-allowed' }}
                                    >
                                        {canUnlock ? (isArenaMode ? 'Odblokuj (+2 min kary)' : (isTrainingMode ? 'Odblokuj (Trening)' : `Odblokuj podpowiedź (-${pointsToDeduct} pkt)`)) : 'Zablokowane (odblokuj poprzednią)'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showContent ? (
                <form onSubmit={handleSubmit} className="flag-form">
                    <h3>Zgłoś Flagę</h3>
                    <input 
                        type="text" 
                        placeholder="Wklej flagę tutaj..." 
                        value={flag}
                        onChange={(e) => setFlag(e.target.value)}
                        className={submitStatus === 'error' ? 'input-error' : ''}
                    />
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Zatwierdź</button>
                        {isArenaMode && (
                            <button 
                                type="button" 
                                onClick={handleSurrender} 
                                className="btn btn-outline" 
                                style={{ borderColor: '#e74c3c', color: '#e74c3c', flex: 1 }}
                            >
                                <i className="fas fa-flag" style={{ marginRight: '5px' }}></i> Poddaj się
                            </button>
                        )}
                    </div>
                    {submitMessage && (
                        <p className={`submit-message ${submitStatus}`}>
                            {submitMessage}
                        </p>
                    )}
                </form>
            ) : (
                <div className="solved-message">
                    <h3>Gratulacje!</h3>
                    <p>Ukończyłeś to wyzwanie i zdobyłeś {room.points} punktów.</p>
                    <button 
                        onClick={() => setIsTrainingMode(true)} 
                        className="btn btn-outline" 
                        style={{marginTop: '15px'}}
                    >
                        <i className="fas fa-redo" style={{marginRight: '8px'}}></i>
                        Rozwiąż ponownie (Trening)
                    </button>
                </div>
            )}
        </div>
      </div>
      <ConfirmationModal 
        isOpen={isModalOpen}
        message={isArenaMode 
            ? "Czy na pewno chcesz odblokować podpowiedź? Zostanie doliczone 2 minuty kary do Twojego czasu!" 
            : (isTrainingMode ? "Odkryć podpowiedź? (Tryb treningowy - brak kosztu punktowego)" : `Czy na pewno chcesz odblokować tę podpowiedź? To odejmie ${pointsToDeduct} punktów.`)}
        onConfirm={confirmUnlockHint}
        onCancel={cancelUnlockHint}
      />
      <ConfirmationModal 
        isOpen={showSurrenderModal}
        message="Czy na pewno chcesz się poddać? To zostanie uznane za przegraną i stracisz punkty ELO."
        confirmText="Poddaj się"
        onConfirm={confirmSurrender}
        onCancel={() => setShowSurrenderModal(false)}
      />
      <SuccessModal 
        isOpen={showSuccessModal}
        onClose={handleCloseSuccessModal}
        points={earnedPoints}
        message={successMessage}
      />
      <ArenaResultModal 
        isOpen={showArenaResultModal}
        onClose={handleCloseArenaResultModal}
        session={arenaSession}
        currentUserId={userData ? userData.id : null}
      />
      {toast && (
        <ToastNotification 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
};

export default RoomPage;
