import * as userApi from '../services/userApi';
import * as arenaApi from '../services/arenaApi';
import * as roomApi from '../services/roomApi';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmationModal from '../components/common/ConfirmationModal';
import ToastNotification from '../components/common/ToastNotification';
import SuccessModal from '../components/common/SuccessModal';
import ArenaResultModal from '../components/common/ArenaResultModal';
import ArenaChat from '../components/ArenaChat';
import './RoomPage.css';
import type { DashboardUser, GameSession, RoomDetailDto } from '../types/api';

const RoomPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = useAuth();

  const [room, setRoom] = useState<RoomDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlockedHints, setUnlockedHints] = useState<number[]>([]);
  const [potentialPoints, setPotentialPoints] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hintToUnlock, setHintToUnlock] = useState<number | null>(null);

  const [flag, setFlag] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null); // 'success', 'error', null
  const [submitMessage, setSubmitMessage] = useState('');

  // Success Modal State (Normal Mode)
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');

  // Arena Result Modal State
  const [showArenaResultModal, setShowArenaResultModal] = useState(false);

  // Arena specific state
  const [arenaSession, setArenaSession] = useState<GameSession | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [penaltyTime, setPenaltyTime] = useState(0);
  const [userData, setUserData] = useState<DashboardUser | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Training Mode State
  const [isTrainingMode, setIsTrainingMode] = useState(false);

  // Tasks State
  const [taskAnswers, setTaskAnswers] = useState<Record<number, string>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  // Arena Mode
  const queryParams = new URLSearchParams(location.search);
  const arenaGameId = queryParams.get('arena');
  const isArenaMode = !!arenaGameId;

  // Fetch user data to know current user ID
  useEffect(() => {
      if (token) {
          userApi.getCurrentUser({ 'Authorization': `Bearer ${token}` })
          .then(res => res.json() as Promise<DashboardUser>)
          .then(data => setUserData(data))
          .catch(err => console.error(err));
      }
  }, [token]);

  // Timer for Arena
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isArenaMode && arenaSession && userData) {
        const startTime = new Date(arenaSession.startTime).getTime();
        const userFinishTime = arenaSession.finishTimes && arenaSession.finishTimes[userData.id];

        if (userFinishTime) {
            const finishTime = new Date(userFinishTime).getTime();
            setElapsedTime(Math.floor((finishTime - startTime) / 1000));
        } else if (arenaSession.status === 'ACTIVE' || arenaSession.status === 'WAITING_FOR_OPPONENT') {
            timer = setInterval(() => {
                const now = new Date().getTime();
                setElapsedTime(Math.floor((now - startTime) / 1000));
            }, 1000);
        }
    }
    return () => clearInterval(timer);
  }, [isArenaMode, arenaSession, userData]);

  // Polling for Arena
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isArenaMode && token && userData) {
        arenaApi.getGame(arenaGameId ?? '', { 'Authorization': `Bearer ${token}` }).then(res => res.json() as Promise<GameSession>).then(data => {
            setArenaSession(data);
            if (data.hintsUsed && data.hintsUsed[userData.id]) {
                setUnlockedHints(data.hintsUsed[userData.id]);
                setPenaltyTime(data.hintsUsed[userData.id].length * 120);
            }
        });

        interval = setInterval(async () => {
            try {
                const response = await arenaApi.getGame(arenaGameId ?? '', { 'Authorization': `Bearer ${token}` });
                if (response.ok) {
                    const session = await response.json();
                    setArenaSession(session);
                    if (session.hintsUsed && session.hintsUsed[userData.id]) {
                        setUnlockedHints(session.hintsUsed[userData.id]);
                        setPenaltyTime(session.hintsUsed[userData.id].length * 120);
                    }
                    if (session.status === 'FINISHED') setShowArenaResultModal(true);
                }
            } catch (err) { console.error(err); }
        }, 2000);
    }
    return () => clearInterval(interval);
  }, [isArenaMode, arenaGameId, token, userData]);

  const handleUnlockHint = (hintId: number) => {
    setHintToUnlock(hintId);
    setIsModalOpen(true);
  };

  const confirmUnlockHint = async () => {
    setIsModalOpen(false);
    if (!hintToUnlock) return;

    try {
        if (isArenaMode) {
            const response = await arenaApi.useHint(arenaGameId ?? '', { hintId: hintToUnlock }, {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                });
            if (!response.ok) throw new Error("Failed to use hint in arena");
            setPenaltyTime(prev => prev + 120);
            setUnlockedHints(prev => [...prev, hintToUnlock]);
            setToast({ message: 'Podpowiedź odblokowana! +2 minuty kary.', type: 'warning' });
        } else {
            const response = await roomApi.unlockHint(id ?? '', hintToUnlock, { 'Authorization': `Bearer ${token}` });
            if (!response.ok) throw new Error('Failed to unlock hint');
            setUnlockedHints([...unlockedHints, hintToUnlock]);
            setPotentialPoints(Math.max(0, (room?.points ?? 0) * (1 - (unlockedHints.length + 1) * 0.25)));
            setToast({ message: 'Podpowiedź odblokowana!', type: 'success' });
        }
    } catch (err) {
        setToast({ message: err instanceof Error ? err.message : String(err), type: 'error' });
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
          const response = await roomApi.downloadFile(id ?? '', { 'Authorization': `Bearer ${token}` });
          if (response.ok) {
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = room?.fileName || 'plik';
              document.body.appendChild(a);
              a.click();
              a.remove();
          }
      } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus(null);
    setSubmitMessage('');

    try {
      const response = await (isArenaMode
        ? arenaApi.solveGame(arenaGameId ?? '', { flag }, {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        })
        : roomApi.solveRoom(id ?? '', { flag }, {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }));

      const data = await response.json();
      if (response.ok) {
        setSubmitStatus('success');
        setSubmitMessage(data.message ?? '');
        if (!isArenaMode) {
            setRoom(prev => prev ? { ...prev, solved: true, solutionsCount: prev.solutionsCount + 1 } : null);
            setEarnedPoints(Number('pointsEarned' in data ? data.pointsEarned : 0) || 0);
            setSuccessMessage("Misja zakończona sukcesem!");
            setShowSuccessModal(true);
        } else if ('status' in data && data.status === 'FINISHED') {
            setShowArenaResultModal(true);
        }
      } else {
        setSubmitStatus('error');
        setSubmitMessage(data.message || 'Niepoprawna flaga');
      }
    } catch {
      setSubmitStatus('error');
      setSubmitMessage('Błąd sieci');
    }
  };

  const handleCloseSuccessModal = () => {
      setShowSuccessModal(false);
      if (isArenaMode) navigate('/arena');
  };

  const handleCloseArenaResultModal = () => {
      setShowArenaResultModal(false);
      navigate('/arena');
  };

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await roomApi.getRoom(id ?? '', { 'Authorization': `Bearer ${token}` });
        if (!response.ok) throw new Error('Failed to fetch room details');
        const data = await response.json();
        setRoom(data);
        if (data.tasks && data.tasks.length > 0) {
            const firstIncomplete = data.tasks.find(t => !t.completed);
            setExpandedTasks({ [firstIncomplete ? firstIncomplete.id : data.tasks[0].id]: true });
        }
        if (!isArenaMode) {
            if (data.unlockedHintIds) {
              setUnlockedHints(data.unlockedHintIds);
              setPotentialPoints(Math.max(0, data.points * (1 - data.unlockedHintIds.length * 0.25)));
            } else {
              setPotentialPoints(data.points);
            }
        }
      } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
      finally { setLoading(false); }
    };
    if (token) fetchRoom();
  }, [id, token, isArenaMode]);

  const toggleTask = (taskId: number) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleTaskSubmit = async (e: React.FormEvent, taskId: number) => {
    e.preventDefault();
    const answer = taskAnswers[taskId] || '';
    if (!answer) return;

    try {
        const response = await roomApi.solveTask(id ?? '', taskId, { answer }, {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            });
        const data = await response.json();
        if (response.ok) {
            setToast({ message: data.message ?? '', type: 'success' });
            setRoom(prev => prev ? ({
                ...prev,
                tasks: prev.tasks.map(t => t.id === taskId ? { ...t, completed: true } : t),
                solved: data.message?.includes('Pokój ukończony') ? true : prev.solved
            }) : null);
            if (data.message?.includes('Pokój ukończony')) {
                setEarnedPoints(Number('pointsEarned' in data ? data.pointsEarned : 0) || 0);
                setSuccessMessage("Wszystkie zadania wykonane! Pokój ukończony.");
                setShowSuccessModal(true);
            }
        } else {
            setToast({ message: data.message || 'Niepoprawna odpowiedź', type: 'error' });
        }
    } catch { setToast({ message: 'Błąd połączenia', type: 'error' }); }
  };


  if (loading) return <div className="container" style={{paddingTop: '40px'}}>Ładowanie pokoju...</div>;
  if (error) return <div className="container" style={{paddingTop: '40px'}}>Błąd: {error}</div>;
  if (!room) return <div className="container" style={{paddingTop: '40px'}}>Nie znaleziono pokoju</div>;

  const pointsToDeduct = room.points * 0.25;
  const isSolved = isArenaMode ? false : room.solved;
  const showContent = !isSolved || isTrainingMode || isArenaMode;

  const tasks = room.tasks || [];
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : (isSolved ? 100 : 0);

  return (
    <div className="room-page-container container">
      {tasks.length > 0 && (
          <div className="room-progress-container">
            <div className="room-progress-bar">
                <div className="room-progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="room-progress-text">Postęp pokoju: {progressPercent}%</div>
          </div>
      )}

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

            {tasks.length > 0 && (
                <div className="tasks-list">
                    {tasks.map((task, idx) => (
                        <div key={task.id} className={`task-card ${task.completed ? 'completed' : ''}`}>
                            <div className="task-header" onClick={() => toggleTask(task.id)}>
                                <div className="task-title-wrap">
                                    <span className="task-number">TASK {idx + 1}</span>
                                    {task.completed && <i className="fas fa-check-circle task-check" />}
                                    <span className="task-title">{task.title}</span>
                                </div>
                                <i className={`fas fa-chevron-${expandedTasks[task.id] ? 'up' : 'down'}`} style={{ color: '#aaa' }} />
                            </div>
                            {expandedTasks[task.id] && (
                                <div className="task-body">
                                    <div className="task-content" dangerouslySetInnerHTML={{ __html: task.content.replace(/\n/g, '<br/>') }} />
                                    {task.question && (
                                        <div className="task-question-box">
                                            <div className="task-question-text">{task.question}</div>
                                            <form className="task-input-group" onSubmit={(e) => handleTaskSubmit(e, task.id)}>
                                                <input
                                                    type="text"
                                                    className={`task-input ${task.completed ? 'success' : ''}`}
                                                    placeholder={task.completed ? 'Ukończono' : 'Twoja odpowiedź...'}
                                                    value={task.completed ? '' : (taskAnswers[task.id] || '')}
                                                    onChange={(e) => setTaskAnswers(prev => ({ ...prev, [task.id]: e.target.value }))}
                                                    disabled={task.completed}
                                                />
                                                <button
                                                    type="submit"
                                                    className={`btn-task-submit ${task.completed ? 'completed' : ''}`}
                                                    disabled={task.completed}
                                                >
                                                    {task.completed ? 'Poprawne' : 'Wyślij'}
                                                    {!task.completed && <i className="fas fa-paper-plane" />}
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
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

            {tasks.length === 0 && (
                showContent ? (
                    <form onSubmit={handleSubmit} className="flag-form">
                        <h3>Zgłoś Flagę</h3>
                        <input
                            type="text"
                            placeholder="Wklej flagę tutaj..."
                            value={flag}
                            onChange={(e) => setFlag(e.target.value)}
                            className={submitStatus === 'error' ? 'input-error' : ''}
                        />
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>Zatwierdź</button>
                        {submitMessage && <p className={`submit-message ${submitStatus}`}>{submitMessage}</p>}
                    </form>
                ) : (
                    <div className="solved-message">
                        <h3>Gratulacje!</h3>
                        <p>Ukończyłeś to wyzwanie i zdobyłeś {room.points} punktów.</p>
                        <button onClick={() => setIsTrainingMode(true)} className="btn btn-outline" style={{marginTop: '15px'}}>
                            <i className="fas fa-redo" style={{marginRight: '8px'}}></i>
                            Rozwiąż ponownie (Trening)
                        </button>
                    </div>
                )
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
