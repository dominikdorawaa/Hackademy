import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BattleScene } from '../components/arena/battle/BattleScene';
import { reactionRefusal } from '../components/arena/battle/quickChat';
import {
  eloChange, finishText, outcome, outcomeTitle, perspective, roundSummary, secondsLeft,
} from '../components/arena/battle/battleView';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useArenaSession } from '../hooks/useArenaSession';
import * as arenaApi from '../services/arenaApi';
import * as userApi from '../services/userApi';
import './UserDashboardPage.css';
import './ArenaBattlePage.css';

const LETTERS = ['A', 'B', 'C', 'D'];
const NOTICE_MS = 4000;
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

export default function ArenaBattlePage() {
  const { gameId = '' } = useParams();
  const { token } = useAuth();
  const { state: realtime } = useRealtime();
  const session = useArenaSession(gameId, token, realtime?.gameSession ?? null);
  const [identity, setIdentity] = useState<{ token: string; id: number } | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityAttempt, setIdentityAttempt] = useState(0);
  const meId = identity?.token === token ? identity?.id ?? null : null;
  const [picked, setPicked] = useState<{ round: number; answer: number } | null>(null);
  const [error, setError] = useState<{ round: number | null; message: string } | null>(null);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [reactionNotice, setReactionNotice] = useState<string | null>(null);
  const [clock, setClock] = useState({ serverTime: 0, receivedAt: 0, now: 0 });
  const systemReduced = useSyncExternalStore(subscribeReducedMotion, systemReducedMotion, () => false);
  const [appReduced] = useState(appReducedMotion);
  const reducedMotion = systemReduced || appReduced;
  const serverTime = session?.serverTime ?? 0;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    userApi.getCurrentUser({ Authorization: `Bearer ${token}` }, controller.signal)
      .then(response => {
        if (!response.ok) throw new Error('User request failed');
        return response.json();
      })
      .then(user => {
        if (!Number.isInteger(user?.id) || user.id <= 0) throw new Error('Invalid user');
        if (!controller.signal.aborted) setIdentity({ token, id: user.id });
      })
      .catch(() => { if (!controller.signal.aborted) setIdentityError(token); });
    return () => controller.abort();
  }, [token, identityAttempt]);

  useEffect(() => {
    if (!reactionNotice) return;
    const timer = setTimeout(() => setReactionNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [reactionNotice]);

  useEffect(() => {
    const update = () => setClock(previous => {
      const now = Date.now();
      return previous.serverTime === serverTime ? { ...previous, now } : { serverTime, receivedAt: now, now };
    });
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [serverTime]);

  if (!session || meId === null) {
    const failed = identityError === token && token !== null;
    return (
      <div className="user-dashboard battle-page">
        <div className="battle-shell">
          {failed ? <>
            <p role="alert" className="battle-error">Nie udało się pobrać Twojego konta. Walka trwa dalej. Spróbuj ponownie.</p>
            <button type="button" className="ud-btn ud-btn-solid" onClick={() => { setIdentityError(null); setIdentityAttempt(attempt => attempt + 1); }}>Spróbuj ponownie</button>
          </> : <p role="status" className="ud-empty">Wczytuję walkę…</p>}
          <Link className="ud-link" to="/arena">Wróć do Areny</Link>
        </div>
      </div>
    );
  }

  const { me, rival } = perspective(session, meId);
  const finished = session.status === 'FINISHED';
  const RevealHeading = finished ? 'h2' : 'h1';
  const deadline = session.phase === 'QUESTION' ? session.roundEndsAt : session.nextRoundAt;
  const left = clock.serverTime === serverTime
    ? secondsLeft(deadline, serverTime, clock.receivedAt, clock.now)
    : Math.max(0, Math.ceil((deadline - serverTime) / 1000));
  const answered = session.answeredBy.includes(me.id);
  const rivalAnswered = session.answeredBy.includes(rival.id);
  const myPick = picked?.round === session.round ? picked.answer : null;
  const reveal = session.phase === 'REVEAL' ? session.lastRound : null;
  const result = outcome(session, me.id);
  const change = eloChange(session, me.id);
  const visibleError = error && (error.round === null || error.round === session.round) ? error.message : null;
  const headers = { Authorization: `Bearer ${token}` };
  const serverNow = clock.serverTime === serverTime ? clock.now + (serverTime - clock.receivedAt) : serverTime;

  const answer = async (choice: number) => {
    const round = session.round;
    setPicked({ round, answer: choice });
    setError(null);
    try {
      const response = await arenaApi.answerQuestion(session.id, round, choice, headers);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setPicked(previous => previous?.round === round ? null : previous);
        setError({ round, message: body?.message ?? 'Nie udało się wysłać odpowiedzi.' });
      }
    } catch {
      setPicked(previous => previous?.round === round ? null : previous);
      setError({ round, message: 'Błąd sieci. Spróbuj jeszcze raz.' });
    }
  };

  const react = async (reaction: string) => {
    setReactionNotice(null);
    try {
      const response = await arenaApi.sendReaction(session.id, reaction, headers);
      if (!response.ok) setReactionNotice(reactionRefusal(response.status, await response.json().catch(() => null)));
    } catch {
      setReactionNotice('Błąd sieci. Spróbuj jeszcze raz.');
    }
  };

  const surrender = async () => {
    setConfirmSurrender(false);
    const response = await arenaApi.surrender(session.id, headers).catch(() => null);
    if (!response?.ok) setError({ round: null, message: 'Nie udało się poddać walki.' });
  };

  return (
    <div className="user-dashboard battle-page" data-still={reducedMotion}>
      <div className="battle-shell">
        <div className="battle-arena">
          <BattleScene session={session} me={me} rival={rival} reducedMotion={reducedMotion} serverNow={serverNow}
            quickChat={{ onPick: reaction => void react(reaction), notice: reactionNotice }}>
            <div className="battle-round">
              <p className="battle-round-label">Runda {session.round}/{session.totalRounds}</p>
              {!finished && <p className="battle-timer" role="timer" aria-label={session.phase === 'QUESTION' ? 'Czas na odpowiedź' : 'Następna runda za'}>{left}</p>}
            </div>
          </BattleScene>

          {finished && (
            <section className={`battle-result is-${result}`} aria-labelledby="battle-result-title">
              <h1 id="battle-result-title">{outcomeTitle(result)}</h1>
              <p>{finishText(session, me.id)}</p>
              <p className="battle-result-elo">{change > 0 ? `+${change}` : change} Elo</p>
              <Link className="ud-btn ud-btn-solid" to="/arena">Wróć do Areny</Link>
            </section>
          )}
          {reveal ? (
            <section className="battle-card" aria-labelledby="battle-question">
              <p className="battle-card-meta">Wynik rundy {reveal.round}</p>
              <RevealHeading id="battle-question" className="battle-question">{reveal.content}</RevealHeading>
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
          ) : !finished && session.question ? (
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
              {visibleError && <p role="alert" className="battle-error">{visibleError}</p>}
            </section>
          ) : null}
        </div>

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
    </div>
  );
}
