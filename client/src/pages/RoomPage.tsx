import { sanitizeTaskContent } from '../lib/taskContent';
import * as roomApi from '../services/roomApi';
import { request } from '../services/http';
import { rateLimitMessage, retryAfterSeconds, TOO_MANY_REQUESTS } from '../services/rateLimit';
import React, { useState, useEffect, useId, useRef } from 'react';
import { BookOpen, Check, Download, HelpCircle, Lightbulb, Lock, RotateCcw, Users } from 'lucide-react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import ConfirmationModal from '../components/common/ConfirmationModal';
import ToastNotification from '../components/common/ToastNotification';
import SuccessModal from '../components/common/SuccessModal';
import './RoomPage.css';
import { LoadingSkeleton, Skeleton } from '../components/common/Skeleton';
import type { RoomDetailDto } from '../types/api';
import { useRoomReturn } from '../hooks/useRoomReturn';
import RoomFrame from '../components/room/RoomFrame';
import RoomFooterBar from '../components/room/RoomFooterBar';
import RoomSplit from '../components/room/RoomSplit';
import { PixelSprite, SPRITES } from '../components/PixelSprite';
import { BugReportButton } from '../components/bugReport/BugReportButton';
import { closeRoomActivity, openRoomActivity } from '../services/presenceApi';

const RoomContent = ({ preview = false }: { preview?: boolean }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionKey } = useAuth();

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
  const [activeTask, setActiveTask] = useState(0);
  const [pendingTask, setPendingTask] = useState<number | null>(null);
  const [finishingRoom, setFinishingRoom] = useState(false);
  const [mascotSuccessCount, setMascotSuccessCount] = useState(0);
  const celebrated = useRef(new Set<string>());
  const pendingFlag = useRef(false);
  const celebrate = (key: string) => {
    if (celebrated.current.has(key)) return;
    celebrated.current.add(key);
    setMascotSuccessCount(count => count + 1);
  };

  const [answersBlockedUntil, setAnswersBlockedUntil] = useState(0);
  const [wrongAnswersBlock, setWrongAnswersBlock] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const retryIn = Math.max(0, Math.ceil((answersBlockedUntil - now) / 1000));
  const answersBlocked = retryIn > 0;
  const blockAnswers = async (response: Response) => {
    const body: unknown = await response.json().catch(() => null);
    const seconds = retryAfterSeconds(response.headers, body);
    setWrongAnswersBlock(!!body && typeof body === 'object' && (body as { reason?: unknown }).reason === 'room-answer');
    const current = Date.now();
    setNow(current);
    setAnswersBlockedUntil(current + seconds * 1000);
  };
  useEffect(() => {
    if (answersBlockedUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= answersBlockedUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [answersBlockedUntil]);
  const retryNotice = answersBlocked && (
    <p className="room-message is-error" role="status">
      {wrongAnswersBlock ? `Zbyt wiele błędnych odpowiedzi. Spróbuj ponownie za ${retryIn} s.` : rateLimitMessage(retryIn)}
    </p>
  );

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  const titleId = useId();
  const readerRef = useRef<HTMLDivElement>(null);

  const queryParams = new URLSearchParams(location.search);
  const roomReturn = useRoomReturn(preview ? undefined : id, location.search, sessionKey, room?.solved ?? false);

  const handleUnlockHint = (hintId: number) => {
    if (preview) { setUnlockedHints(current => [...current, hintId]); return; }
    setHintToUnlock(hintId);
    setIsModalOpen(true);
  };

  const confirmUnlockHint = async () => {
    setIsModalOpen(false);
    if (!hintToUnlock) return;

    try {
        const response = await roomApi.unlockHint(id ?? '', hintToUnlock, { sessionKey });
        if (!response.ok) throw new Error('Failed to unlock hint');
        const unlocked = await response.json();
        setRoom(prev => prev ? { ...prev, hints: prev.hints.map(h => h.id === unlocked.id ? unlocked : h) } : null);
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
          const response = await (preview ? request<Blob>(`/api/admin/content/rooms/${id}/file`, { auth: { sessionKey } }) : roomApi.downloadFile(id ?? '', { sessionKey }));
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
    if (pendingFlag.current || answersBlocked) return;
    pendingFlag.current = true;
    setSubmitStatus(null);
    setSubmitMessage('');

    try {
      const response = await roomApi.solveRoom(id ?? '', { flag }, {sessionKey
      });
      if (response.status === TOO_MANY_REQUESTS) {
        await blockAnswers(response);
        return;
      }

      const data = await response.json();
      if (response.ok && data.success) {
        if (!room?.solved) celebrate('room');
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
    } finally {
      pendingFlag.current = false;
    }
  };

  const handleCloseSuccessModal = () => {
      setShowSuccessModal(false);
  };

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await (preview ? request<RoomDetailDto>(`/api/admin/content/rooms/${id}/preview`, { auth: { sessionKey } }) : roomApi.getRoom(id ?? '', { sessionKey }));
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || 'Failed to fetch room details');
        }
        const data = await response.json();
        setRoom(data);
        if (data.tasks && data.tasks.length > 0) {
            setActiveTask(Math.max(0, data.tasks.findIndex(t => !t.completed)));
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
    if (sessionKey) fetchRoom();
  }, [id, sessionKey, preview]);

  const roomId = room?.id;
  const { connected } = useRealtime();
  useEffect(() => {
    if (preview || !roomId || !sessionKey || !connected) return;
    const auth = { sessionKey };
    void openRoomActivity(roomId, auth).catch(() => undefined);
    return () => { void closeRoomActivity(roomId, auth).catch(() => undefined); };
  }, [preview, roomId, sessionKey, connected]);

  useEffect(() => {
    readerRef.current?.scrollTo?.({ top: 0 });
  }, [activeTask]);

  const handleTaskSubmit = async (e: React.FormEvent, taskId: number) => {
    e.preventDefault();
    if (preview) { setRoom(current => current ? { ...current, tasks: current.tasks.map(t => t.id === taskId ? { ...t, completed: true } : t) } : null); return; }
    const answer = taskAnswers[taskId] || '';
    const task = room?.tasks.find((item) => item.id === taskId);
    if (!task || task.completed || pendingTask !== null || (task.question && (answersBlocked || !answer))) return;

    setPendingTask(taskId);
    try {
        const response = await roomApi.solveTask(id ?? '', taskId, { answer }, {sessionKey
            });
        if (response.status === TOO_MANY_REQUESTS) {
            await blockAnswers(response);
            return;
        }
        const data = await response.json();
        if (response.ok && data.success) {
            celebrate(`task:${taskId}`);
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
      const response = await roomApi.completeTaskRoom(id ?? '', { sessionKey });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setToast({ message: data.message || 'Nie udało się ukończyć pokoju', type: 'error' });
        return;
      }
      if (!room?.solved) celebrate('room');
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
  const backTo = preview ? (queryParams.get('pathId') ? `/admin/preview/paths/${queryParams.get('pathId')}` : `/admin/${queryParams.get('kind') === 'PATH' ? 'paths/rooms' : 'ctf'}/${id}`) : roomReturn.to;
  const nextRoom = preview ? null : roomReturn.next;
  const reportedTask = tasks.length > 0 ? tasks[Math.min(activeTask, tasks.length - 1)].id : undefined;

  const nav = {
    back: {
      title: preview ? (queryParams.get('pathId') ? 'Podgląd ścieżki' : 'Edycja pokoju') : roomReturn.title,
      label: preview ? 'Powrót' : roomReturn.label,
      disabled: !preview && roomReturn.pending,
      onClick: () => navigate(backTo),
    },
    title: room.title,
    progress: tasks.length > 0
      ? { value: completedTasksCount, max: tasks.length, label: 'Postęp pokoju' }
      : { value: isSolved ? 1 : 0, max: 1, label: 'Postęp pokoju' },
    action: preview ? undefined : <BugReportButton className="room-nav-report" context={{ source: 'ROOM', roomId: room.id, taskId: reportedTask }} />,
  };

  const previewBanner = preview && (
    <div role="status" className="room-preview">
      <span>Podgląd administracyjny: postęp i punkty nie są zapisywane.</span>
      <button type="button" className="room-btn room-btn--small" onClick={() => navigate(`/admin/${queryParams.get('kind') === 'PATH' ? 'paths/rooms' : 'ctf'}/${id}`)}>Wróć do edycji pokoju</button>
    </div>
  );

  const fileBlock = room.fileName && (
    <div className="room-file">
      <p><strong>Materiały do misji</strong>Pobierz plik: {room.fileName}</p>
      <button type="button" onClick={handleDownloadFile} className="room-btn room-btn--small">
        <Download aria-hidden="true" />
        Pobierz plik
      </button>
    </div>
  );

  const hintsBlock = showContent && room.hints && room.hints.length > 0 && (
    <section className="room-hints" aria-labelledby={`${titleId}-hints`}>
      <h2 className="room-section-title" id={`${titleId}-hints`}>Podpowiedzi</h2>
      {!isTrainingMode && <p className="room-hints-points">Punkty do zdobycia: <strong>{Math.round(potentialPoints)}</strong></p>}
      <ol>
        {room.hints.map((hint, index) => {
          const isUnlocked = unlockedHints.includes(hint.id);
          const isPreviousUnlocked = index === 0 || unlockedHints.includes(room.hints[index - 1].id);
          const canUnlock = !isUnlocked && isPreviousUnlocked;
          return (
            <li key={hint.id} className="room-hint">
              <span className="room-hint-mark" aria-hidden="true">{isUnlocked ? <Lightbulb size={18} /> : <Lock size={16} />}</span>
              <h4>Podpowiedź {index + 1}</h4>
              {isUnlocked ? (
                <p>{hint.description}</p>
              ) : (
                <button type="button" onClick={() => handleUnlockHint(hint.id)} className="room-btn room-btn--small" disabled={!canUnlock}>
                  {canUnlock ? (isTrainingMode ? 'Odblokuj (Trening)' : `Odblokuj podpowiedź (-${pointsToDeduct} pkt)`) : 'Zablokowane (odblokuj poprzednią)'}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );

  const chips = (
    <div className="room-chips">
      <span className={`room-chip room-chip--${room.difficulty.toLowerCase()}`}>{room.difficulty}</span>
      <span className="room-chip room-chip--points">{room.points} pkt</span>
      {isSolved && <span className="room-chip room-chip--done"><Check aria-hidden="true" />Rozwiązany</span>}
    </div>
  );

  const finish = isSolved && nextRoom
    ? { label: 'Następny pokój', primary: true, onClick: () => navigate(nextRoom.to) }
    : { label: 'Zakończ', disabled: !isSolved && !preview, primary: isSolved, onClick: () => navigate(backTo) };

  const modals = (
    <>
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
    </>
  );

  if (tasks.length === 0) {
    const descriptionPane = (
      <section className="room-pane" aria-labelledby={titleId}>
        <div className="room-pane-scroll">
          {chips}
          <h1 className="room-title" id={titleId}>{room.title}</h1>
          {room.shortDescription && <p className="room-lead">{room.shortDescription}</p>}
          <div className="room-prose"><p style={{ whiteSpace: 'pre-line' }}>{room.description}</p></div>
          {fileBlock}
        </div>
      </section>
    );

    const solvePane = (
      <section className="room-pane" aria-label="Rozwiązanie">
        <div className="room-pane-scroll room-solve">
          <div className="room-solve-status">
            <PixelSprite sprite={SPRITES.flag} scale={2} still={!isSolved} className="room-solve-flag" />
            <div>
              <p className="room-kicker">{isSolved ? 'Flaga zdobyta' : 'Zdobądź flagę'}</p>
              <p className="room-solve-count">Rozwiązania: <strong>{room.solutionsCount}</strong></p>
            </div>
          </div>
          {showContent ? (
            <form onSubmit={handleSubmit} className="room-flag">
              <h2 className="room-section-title"><label htmlFor={`${titleId}-flag`}>Zgłoś flagę</label></h2>
              <p className="room-note">Wklej znalezioną flagę dokładnie tak, jak ją widzisz.</p>
              <div className="room-field">
                <input
                  id={`${titleId}-flag`}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Wklej flagę tutaj..."
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  className={`room-input${submitStatus === 'error' ? ' is-error' : ''}`}
                />
                <button type="submit" className="room-btn room-btn--primary" disabled={answersBlocked}>Zatwierdź</button>
              </div>
              {retryNotice || (submitMessage && <p className={`room-message is-${submitStatus}`} role="status">{submitMessage}</p>)}
            </form>
          ) : (
            <div className="room-solved">
              <h2 className="room-section-title">Gratulacje!</h2>
              <p>Ukończyłeś to wyzwanie i zdobyłeś {room.points} punktów.</p>
              <div className="room-solved-actions">
                <button type="button" onClick={() => setIsTrainingMode(true)} className="room-btn">
                  <RotateCcw aria-hidden="true" />
                  Rozwiąż ponownie (Trening)
                </button>
              </div>
            </div>
          )}
          {hintsBlock}
        </div>
      </section>
    );

    return (
      <RoomFrame nav={nav} label="Pokój z flagą" className="room-frame--split" mascot={{ successCount: mascotSuccessCount, paused: isModalOpen || showSuccessModal }}
        footer={<RoomFooterBar title={room.title} badge={<span className="room-chip room-chip--points">{room.points} pkt</span>} next={finish} />}>
        {previewBanner}
        <RoomSplit variant="flat" start={descriptionPane} end={solvePane} initial={0.56} />
        {modals}
      </RoomFrame>
    );
  }

  const taskIndex = Math.min(activeTask, tasks.length - 1);
  const task = tasks[taskIndex];
  const lastTask = taskIndex === tasks.length - 1;
  const allTasksDone = completedTasksCount === tasks.length;
  const firstOpenTask = tasks.findIndex(t => !t.completed);
  const answerId = `${titleId}-answer`;

  const next = !isSolved && allTasksDone
    ? { label: finishingRoom ? 'Kończenie pokoju…' : 'Ukończ pokój', disabled: finishingRoom, primary: true, onClick: () => void handleCompleteRoom() }
    : !lastTask
      ? { label: 'Dalej', disabled: !task.completed && !preview, primary: task.completed, onClick: () => setActiveTask(taskIndex + 1) }
      : finish;

  return (
    <RoomFrame nav={nav} label="Pokój z zadaniami" className="room-frame--reader" mascot={{ successCount: mascotSuccessCount, paused: isModalOpen || showSuccessModal }}
      footer={
        <RoomFooterBar
          progress={{
            steps: tasks.map((t, index) => ({ key: t.id, title: t.title, done: t.completed, locked: !preview && !t.completed && firstOpenTask >= 0 && index > firstOpenTask })),
            current: taskIndex,
            unit: 'Zadanie',
            listLabel: 'Lista zadań',
            onSelect: setActiveTask,
          }}
          title={task.title}
          badge={<span className="room-chip room-chip--points">{room.points} pkt</span>}
          back={{ label: 'Wstecz', disabled: taskIndex === 0, onClick: () => setActiveTask(taskIndex - 1) }}
          next={next}
        />
      }>
      {previewBanner}
      <div className="room-reader" ref={readerRef}>
        <div className="room-reader-bar">
          <div className="room-reader-where"><h1>{room.title}</h1><span>Zadanie {taskIndex + 1} z {tasks.length}</span></div>
          <span><Users aria-hidden="true" />Ukończyło: {room.solutionsCount}</span>
        </div>
        <article key={task.id} className="room-reader-article" aria-labelledby={titleId}>
          {taskIndex === 0 && chips}
          <h2 className="room-title" id={titleId}>{String(taskIndex + 1).padStart(2, '0')}. {task.title}</h2>
          {taskIndex === 0 && room.description && (
            <div className="room-prose room-intro"><p style={{ whiteSpace: 'pre-line' }}>{room.description}</p></div>
          )}
          {taskIndex === 0 && fileBlock}
          <div className="room-prose task-content" dangerouslySetInnerHTML={{ __html: sanitizeTaskContent(task.content) }} />
          {task.question ? (
            <form className={`room-question${task.completed ? ' is-done' : ''}`} onSubmit={(e) => handleTaskSubmit(e, task.id)}>
              <p className="room-question-label">
                {task.completed ? <Check aria-hidden="true" /> : <HelpCircle aria-hidden="true" />}
                {task.completed ? 'Zaliczone' : 'Pytanie'}
              </p>
              <label className="room-question-text" htmlFor={answerId}>{task.question}</label>
              <div className="room-field">
                <input
                  id={answerId}
                  type="text"
                  autoComplete="off"
                  className={`room-input${task.completed ? ' is-done' : ''}`}
                  placeholder={task.completed ? 'Ukończono' : 'Twoja odpowiedź...'}
                  value={task.completed ? '' : (taskAnswers[task.id] || '')}
                  onChange={(e) => setTaskAnswers(prev => ({ ...prev, [task.id]: e.target.value }))}
                  disabled={task.completed || pendingTask !== null || answersBlocked}
                />
                <button type="submit" className="room-btn room-btn--primary" disabled={task.completed || pendingTask !== null || answersBlocked}>
                  {task.completed ? 'Poprawne' : 'Sprawdź'}
                </button>
              </div>
              {!task.completed && retryNotice}
            </form>
          ) : (
            <form className={`room-question${task.completed ? ' is-done' : ''}`} onSubmit={(event) => void handleTaskSubmit(event, task.id)}>
              <p className="room-question-label">
                {task.completed ? <Check aria-hidden="true" /> : <BookOpen aria-hidden="true" />}
                {task.completed ? 'Zaliczone' : 'Do przeczytania'}
              </p>
              <p className="room-note">Gdy skończysz czytać, oznacz zadanie jako przeczytane.</p>
              <button type="submit" className="room-btn room-btn--primary" disabled={task.completed || pendingTask !== null}>
                {task.completed ? 'Przeczytano' : 'Oznacz jako przeczytane'}
              </button>
            </form>
          )}
        </article>
        {hintsBlock}
      </div>
      {modals}
    </RoomFrame>
  );
};

export default function RoomPage({ preview = false }: { preview?: boolean }) {
  const { id } = useParams();
  const { sessionKey } = useAuth();
  return <RoomContent preview={preview} key={JSON.stringify([id, sessionKey])} />;
}
