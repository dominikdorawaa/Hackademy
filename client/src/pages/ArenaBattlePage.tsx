import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import UserAvatar from '../components/UserAvatar';
import ArenaChat from '../components/ArenaChat';
import { BattleFighter } from '../components/arena/battle/BattleFighter';
import {
  eloChange, finishText, fighterFrames, MAX_HP, outcome, outcomeTitle, perspective, roundSummary, secondsLeft,
} from '../components/arena/battle/battleView';
import type { Fighter } from '../components/arena/battle/battleView';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useArenaSession } from '../hooks/useArenaSession';
import * as arenaApi from '../services/arenaApi';
import * as userApi from '../services/userApi';
import './UserDashboardPage.css';
import './ArenaBattlePage.css';

const LETTERS = ['A', 'B', 'C', 'D'];
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const subscribeReducedMotion = (onChange: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => undefined;
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const systemReducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches;
const appReducedMotion = () => {
  try { return localStorage.getItem('app-reduced-motion') === 'true'; } catch { return false; }
};

function Plate({ fighter, side }: { fighter: Fighter; side: 'me' | 'rival' }) {
  const percent = Math.round((fighter.hp / MAX_HP) * 100);
  return (
    <div className={`battle-plate is-${side}`}>
      <UserAvatar className="battle-plate-avatar" username={fighter.username} seed={fighter.seed} avatar={fighter.avatar} alt="" />
      <div className="battle-plate-info">
        <p className="battle-plate-name">{side === 'me' ? `${fighter.username} (Ty)` : fighter.username}</p>
        <p className="battle-plate-elo">Elo {fighter.elo}</p>
        <div className="battle-hp" role="meter" aria-label={`HP: ${fighter.username}`} aria-valuemin={0} aria-valuemax={MAX_HP} aria-valuenow={fighter.hp}>
          <span style={{ width: `${percent}%` }} data-low={fighter.hp <= 40} />
        </div>
        <p className="battle-plate-hp">{fighter.hp} HP</p>
      </div>
    </div>
  );
}

export default function ArenaBattlePage() {
  const { gameId = '' } = useParams();
  const { token } = useAuth();
  const { state: realtime } = useRealtime();
  const session = useArenaSession(gameId, token, realtime?.gameSession ?? null);
  const [meId, setMeId] = useState<number | null>(null);
  const [picked, setPicked] = useState<{ round: number; answer: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [clock, setClock] = useState({ serverTime: 0, receivedAt: 0, now: 0 });
  const systemReduced = useSyncExternalStore(subscribeReducedMotion, systemReducedMotion, () => false);
  const [appReduced] = useState(appReducedMotion);
  const reducedMotion = systemReduced || appReduced;
  const serverTime = session?.serverTime ?? 0;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    userApi.getCurrentUser({ Authorization: `Bearer ${token}` }, controller.signal)
      .then(response => response.ok ? response.json() : null)
      .then(user => { if (user?.id) setMeId(user.id); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    const update = () => setClock(previous => {
      const now = Date.now();
      return previous.serverTime === serverTime ? { ...previous, now } : { serverTime, receivedAt: now, now };
    });
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [serverTime]);

  if (!session || meId === null) {
    return (
      <div className="user-dashboard battle-page">
        <div className="battle-shell"><p role="status" className="ud-empty">Wczytuję walkę…</p><Link className="ud-link" to="/arena">Wróć do Areny</Link></div>
      </div>
    );
  }

  const { me, rival } = perspective(session, meId);
  const finished = session.status === 'FINISHED';
  const deadline = session.phase === 'QUESTION' ? session.roundEndsAt : session.nextRoundAt;
  const left = clock.serverTime === serverTime
    ? secondsLeft(deadline, serverTime, clock.receivedAt, clock.now)
    : Math.max(0, Math.ceil((deadline - serverTime) / 1000));
  const answered = session.answeredBy.includes(me.id);
  const rivalAnswered = session.answeredBy.includes(rival.id);
  const myPick = picked?.round === session.round ? picked.answer : null;
  const reveal = session.phase === 'REVEAL' ? session.lastRound : null;
  const myFrames = fighterFrames(session, me.id, rival.id);
  const rivalFrames = fighterFrames(session, rival.id, me.id);
  const motionKey = `${session.round}-${session.phase}-${session.status}`;
  const result = outcome(session, me.id);
  const change = eloChange(session, me.id);
  const headers = { Authorization: `Bearer ${token}` };

  const answer = async (choice: number) => {
    setPicked({ round: session.round, answer: choice });
    setError(null);
    try {
      const response = await arenaApi.answerQuestion(session.id, choice, headers);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setPicked(null);
        setError(body?.message ?? 'Nie udało się wysłać odpowiedzi.');
      }
    } catch {
      setPicked(null);
      setError('Błąd sieci. Spróbuj jeszcze raz.');
    }
  };

  const surrender = async () => {
    setConfirmSurrender(false);
    const response = await arenaApi.surrender(session.id, headers).catch(() => null);
    if (!response?.ok) setError('Nie udało się poddać walki.');
  };

  return (
    <div className="user-dashboard battle-page">
      <div className="battle-shell">
        <header className="battle-hud">
          <Plate fighter={me} side="me" />
          <div className="battle-round">
            <p className="battle-round-label">Runda {session.round}/{session.totalRounds}</p>
            {!finished && <p className="battle-timer" role="timer" aria-label={session.phase === 'QUESTION' ? 'Czas na odpowiedź' : 'Następna runda za'}>{left}</p>}
          </div>
          <Plate fighter={rival} side="rival" />
        </header>

        <section className="battle-stage" aria-label="Arena walki">
          <BattleFighter look={me.look} frames={myFrames.frames} loop={myFrames.loop} reducedMotion={reducedMotion}
            label={`Twój awatar, ${me.username}`} side="me" motionKey={motionKey} />
          <BattleFighter look={rival.look} frames={rivalFrames.frames} loop={rivalFrames.loop} reducedMotion={reducedMotion}
            label={`Awatar rywala, ${rival.username}`} side="rival" motionKey={motionKey} />
        </section>

        {finished ? (
          <section className={`battle-result is-${result}`} aria-labelledby="battle-result-title">
            <h1 id="battle-result-title">{outcomeTitle(result)}</h1>
            <p>{finishText(session, me.id)}</p>
            <p className="battle-result-elo">{change > 0 ? `+${change}` : change} Elo</p>
            <Link className="ud-btn ud-btn-solid" to="/arena">Wróć do Areny</Link>
          </section>
        ) : reveal ? (
          <section className="battle-card" aria-labelledby="battle-question">
            <p className="battle-card-meta">Wynik rundy {reveal.round}</p>
            <h1 id="battle-question" className="battle-question">{reveal.content}</h1>
            <ol className="battle-answers is-reveal">
              {reveal.answers.map((text, index) => {
                const correct = index === reveal.correctAnswer;
                const mine = reveal.choices[me.id] === index;
                const theirs = reveal.choices[rival.id] === index;
                return (
                  <li key={index} className={`battle-answer${correct ? ' is-correct' : ''}${mine && !correct ? ' is-wrong' : ''}`}>
                    <span className="battle-answer-letter">{LETTERS[index]}</span>
                    <span className="battle-answer-text">{text}</span>
                    <span className="battle-answer-tags">
                      {correct && <span>Poprawna</span>}
                      {mine && <span>Ty</span>}
                      {theirs && <span>{rival.username}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="battle-summary" role="status" aria-live="polite">{roundSummary(reveal, me.id, rival.id)}</p>
          </section>
        ) : session.question ? (
          <section className="battle-card" aria-labelledby="battle-question">
            <p className="battle-card-meta">{session.question.category}</p>
            <h1 id="battle-question" className="battle-question">{session.question.content}</h1>
            <div className="battle-answers" role="group" aria-label="Odpowiedzi">
              {session.question.answers.map((text, index) => (
                <button key={index} type="button" className={`battle-answer${myPick === index ? ' is-picked' : ''}`}
                  onClick={() => void answer(index)} disabled={answered || myPick !== null} aria-pressed={myPick === index}>
                  <span className="battle-answer-letter">{LETTERS[index]}</span>
                  <span className="battle-answer-text">{text}</span>
                </button>
              ))}
            </div>
            <p className="battle-summary" role="status" aria-live="polite">
              {answered || myPick !== null
                ? (rivalAnswered ? 'Oboje odpowiedzieliście. Za chwilę wynik rundy.' : 'Odpowiedź wysłana. Czekamy na rywala.')
                : (rivalAnswered ? 'Rywal już odpowiedział.' : 'Wybierz jedną odpowiedź.')}
            </p>
            {error && <p role="alert" className="battle-error">{error}</p>}
          </section>
        ) : null}

        {!finished && (
          <div className="battle-actions">
            {confirmSurrender ? (
              <>
                <span>Poddanie oznacza porażkę.</span>
                <button type="button" className="ud-btn ud-btn-small battle-surrender" onClick={() => void surrender()}>Tak, poddaję walkę</button>
                <button type="button" className="ud-btn ud-btn-small" onClick={() => setConfirmSurrender(false)}>Walczę dalej</button>
              </>
            ) : (
              <button type="button" className="ud-btn ud-btn-small" onClick={() => setConfirmSurrender(true)}>Poddaj walkę</button>
            )}
          </div>
        )}
      </div>
      <ArenaChat gameId={session.id} isOpen={chatOpen} toggleChat={() => setChatOpen(open => !open)} />
    </div>
  );
}
