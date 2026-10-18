import { sanitizeTaskContent } from '../lib/taskContent';
import * as roomApi from '../services/roomApi';
import { request } from '../services/http';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ConfirmationModal from '../components/common/ConfirmationModal';
import ToastNotification from '../components/common/ToastNotification';
import SuccessModal from '../components/common/SuccessModal';
import './RoomPage.css';
import { LoadingSkeleton, Skeleton } from '../components/common/Skeleton';
import type { RoomDetailDto } from '../types/api';

const RoomContent = ({ preview = false }: { preview?: boolean }) => {
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

  // Training Mode State
  const [isTrainingMode, setIsTrainingMode] = useState(false);

  // Tasks State
  const [taskAnswers, setTaskAnswers] = useState<Record<number, string>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<number, boolean>>({});
  const [pendingTask, setPendingTask] = useState<number | null>(null);
  const [finishingRoom, setFinishingRoom] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const queryParams = new URLSearchParams(location.search);

  const handleUnlockHint = (hintId: number) => {
    if (preview) { setUnlockedHints(current => [...current, hintId]); return; }
    setHintToUnlock(hintId);
    setIsModalOpen(true);
  };

  const confirmUnlockHint = async () => {
    setIsModalOpen(false);
    if (!hintToUnlock) return;

    try {
        const response = await roomApi.unlockHint(id ?? '', hintToUnlock, { 'Authorization': `Bearer ${token}` });
        if (!response.ok) throw new Error('Failed to unlock hint');
        setUnlockedHints([...unlockedHints, hintToUnlock]);
        setPotentialPoints(Math.max(0, (room?.points ?? 0) * (1 - (unlockedHints.length + 1) * 0.25)));
        setToast({ message: 'Podpowiedź odblokowana!', type: 'success' });
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
          const response = await (preview ? request<Blob>(`/api/admin/content/rooms/${id}/file`, { headers: { Authorization: `Bearer ${token}` } }) : roomApi.downloadFile(id ?? '', { 'Authorization': `Bearer ${token}` }));
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
    if (preview) { setSubmitStatus('success'); setSubmitMessage('Tryb podglądu: wynik nie jest zapisywany.'); return; }
    setSubmitStatus(null);
    setSubmitMessage('');

    try {
      const response = await roomApi.solveRoom(id ?? '', { flag }, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      });

      const data = await response.json();
      if (response.ok) {
        setSubmitStatus('success');
        setSubmitMessage(data.message ?? '');
        setRoom(prev => prev ? { ...prev, solved: true, solutionsCount: prev.solutionsCount + 1 } : null);
        setEarnedPoints(Number('pointsEarned' in data ? data.pointsEarned : 0) || 0);
        setSuccessMessage("Misja zakończona sukcesem!");
        setShowSuccessModal(true);
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
  };

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await (preview ? request<RoomDetailDto>(`/api/admin/content/rooms/${id}/preview`, { headers: { Authorization: `Bearer ${token}` } }) : roomApi.getRoom(id ?? '', { 'Authorization': `Bearer ${token}` }));
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || 'Failed to fetch room details');
        }
        const data = await response.json();
        setRoom(data);
        if (data.tasks && data.tasks.length > 0) {
            const firstIncomplete = data.tasks.find(t => !t.completed);
            setExpandedTasks({ [firstIncomplete ? firstIncomplete.id : data.tasks[0].id]: true });
        }
        if (data.unlockedHintIds) {
          setUnlockedHints(data.unlockedHintIds);
          setPotentialPoints(Math.max(0, data.points * (1 - data.unlockedHintIds.length * 0.25)));
        } else {
          setPotentialPoints(data.points);
        }
      } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
      finally { setLoading(false); }
    };
    if (token) fetchRoom();
  }, [id, token, preview]);

  const toggleTask = (taskId: number) => {
    setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleTaskSubmit = async (e: React.FormEvent, taskId: number) => {
    e.preventDefault();
    if (preview) { setRoom(current => current ? { ...current, tasks: current.tasks.map(t => t.id === taskId ? { ...t, completed: true } : t) } : null); return; }
    const answer = taskAnswers[taskId] || '';
    const task = room?.tasks.find((item) => item.id === taskId);
    if (!task || task.completed || pendingTask !== null || (task.question && !answer)) return;

    setPendingTask(taskId);
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
    finally { setPendingTask(null); }
  };

  const handleCompleteRoom = async () => {
    if (preview) { setToast({ message: 'Podgląd: postęp i punkty nie są zapisywane.', type: 'success' }); return; }
    if (finishingRoom) return;
    setFinishingRoom(true);
    try {
      const response = await roomApi.completeTaskRoom(id ?? '', { 'Authorization': `Bearer ${token}` });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setToast({ message: data.message || 'Nie udało się ukończyć pokoju', type: 'error' });
        return;
      }
      setRoom((previous) => previous ? { ...previous, solved: true } : null);
      setEarnedPoints(Number('pointsEarned' in data ? data.pointsEarned : 0) || 0);
      setSuccessMessage('Wszystkie zadania wykonane! Pokój ukończony.');
      setShowSuccessModal(true);
    } catch {
      setToast({ message: 'Błąd połączenia', type: 'error' });
    } finally {
      setFinishingRoom(false);
    }
  };

  if (loading) return <div className="room-page-container hackademy-container">
    <LoadingSkeleton label="Ładowanie pokoju" className="hk-skeleton-stack is-loose">
      <Skeleton height={8} radius={4} />
      <div className="hk-skeleton-stack">
        <Skeleton width={110} height={20} />
        <div className="hk-skeleton-row"><Skeleton width={70} height={24} radius={999} /><Skeleton width={70} height={24} radius={999} /></div>
        <Skeleton width="min(520px, 80%)" height={36} />
        <Skeleton width="min(360px, 60%)" height={16} />
      </div>
      <div className="hk-skeleton-stack">
        <Skeleton height={180} radius={12} />
        {[0, 1, 2].map(row => <Skeleton key={row} height={64} radius={12} />)}
      </div>
    </LoadingSkeleton>
  </div>;
  if (error) return <div className="hackademy-container" style={{paddingTop: '40px'}}>Błąd: {error}</div>;
  if (!room) return <div className="hackademy-container" style={{paddingTop: '40px'}}>Nie znaleziono pokoju</div>;

  const pointsToDeduct = room.points * 0.25;
  const isSolved = room.solved;
  const showContent = !isSolved || isTrainingMode;

  const tasks = room.tasks || [];
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : (isSolved ? 100 : 0);

  return (
    <div className="room-page-container hackademy-container">
      {preview && <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm"><span>Podgląd administracyjny: postęp i punkty nie są zapisywane.</span><button type="button" className="btn btn-outline" onClick={() => navigate(`/admin/${queryParams.get('kind') === 'PATH' ? 'paths/rooms' : 'ctf'}/${id}`)}>Wróć do edycji pokoju</button></div>}
      {tasks.length > 0 && (
          <div className="room-progress-container">
            <div className="room-progress-bar">
                <div className="room-progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
            <div className="room-progress-text">Postęp pokoju: {progressPercent}%</div>
          </div>
      )}

      <div className="room-header">
        <button onClick={() => navigate(preview ? (queryParams.get('pathId') ? `/admin/preview/paths/${queryParams.get('pathId')}` : `/admin/${queryParams.get('kind') === 'PATH' ? 'paths/rooms' : 'ctf'}/${id}`) : '/learn')} className="back-btn">
            &larr; Powrót
        </button>
        <div className="room-meta-top">
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
                                    <div className="task-content" dangerouslySetInnerHTML={{ __html: sanitizeTaskContent(task.content) }} />
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
                                                    disabled={task.completed || pendingTask !== null}
                                                />
                                                <button
                                                    type="submit"
                                                    className={`btn-task-submit ${task.completed ? 'completed' : ''}`}
                                                    disabled={task.completed || pendingTask !== null}
                                                >
                                                    {task.completed ? 'Poprawne' : 'Wyślij'}
                                                    {!task.completed && <i className="fas fa-paper-plane" />}
                                                </button>
                                            </form>
                                        </div>
                                    )}
                                    {!task.question && (
                                        <form onSubmit={(event) => void handleTaskSubmit(event, task.id)}>
                                            <button type="submit" className="btn-task-submit"
                                                disabled={task.completed || pendingTask !== null}>
                                                {task.completed ? 'Przeczytano' : 'Oznacz jako przeczytane'}
                                            </button>
                                        </form>
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

            {!isSolved && tasks.length > 0 && completedTasksCount === tasks.length && (
                <button type="button" className="btn btn-primary" disabled={finishingRoom}
                    onClick={() => void handleCompleteRoom()}>
                    {finishingRoom ? 'Kończenie pokoju…' : 'Ukończ pokój'}
                </button>
            )}

            {/* HINTS SECTION */}
            {showContent && room.hints && room.hints.length > 0 && (
                <div className="hints-section">
                    <h3>Podpowiedzi</h3>
                    {!isTrainingMode && <div className="potential-points">Punkty do zdobycia: <strong>{Math.round(potentialPoints)}</strong></div>}
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
                                        {canUnlock ? (isTrainingMode ? 'Odblokuj (Trening)' : `Odblokuj podpowiedź (-${pointsToDeduct} pkt)`) : 'Zablokowane (odblokuj poprzednią)'}
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
        message={isTrainingMode ? "Odkryć podpowiedź? (Tryb treningowy - brak kosztu punktowego)" : `Czy na pewno chcesz odblokować tę podpowiedź? To odejmie ${pointsToDeduct} punktów.`}
        onConfirm={confirmUnlockHint}
        onCancel={cancelUnlockHint}
      />
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleCloseSuccessModal}
        points={earnedPoints}
        message={successMessage}
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

export default function RoomPage({ preview = false }: { preview?: boolean }) {
  const { id } = useParams();
  const { token } = useAuth();
  return <RoomContent preview={preview} key={JSON.stringify([id, token])} />;
}
