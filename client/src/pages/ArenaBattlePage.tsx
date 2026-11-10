import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BattleIntro, BattleIntroLoading } from '../components/arena/battle/BattleIntro';
import { BattlePause } from '../components/arena/battle/BattlePause';
import { BattlePodium } from '../components/arena/battle/BattlePodium';
import { BattleResult } from '../components/arena/battle/BattleResult';
import { BattleScene } from '../components/arena/battle/BattleScene';
import { reactionRefusal } from '../components/arena/battle/quickChat';
import {
  absenceNotice, eloChange, finishText, frozenSecondsLeft, INTRO_EXIT_MS, LOW_HP, ROUND_MS, outcome, outcomeTitle, pauseNotice, perspective, podiumDelay, roundBanner, roundSummary, secondsLeft,
} from '../components/arena/battle/battleView';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useArenaClock } from '../hooks/useArenaClock';
import { useArenaSession } from '../hooks/useArenaSession';
import { useBattlePresence } from '../hooks/useBattlePresence';
import { useBattleSounds } from '../hooks/useBattleSounds';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { arenaCategoryLabel } from '../components/arena/arenaCategory';
import { BugReportButton } from '../components/bugReport/BugReportButton';
import RoomFooterBar from '../components/room/RoomFooterBar';
import UserAvatar from '../components/UserAvatar';
import RoomFrame from '../components/room/RoomFrame';
import * as arenaApi from '../services/arenaApi';
import * as userApi from '../services/userApi';
import type { AvatarConfig } from '../types/api';
import './UserDashboardPage.css';
import './ArenaBattlePage.css';

const LETTERS = ['A', 'B', 'C', 'D'];
const NOTICE_MS = 4000;

export default function ArenaBattlePage() {
  const { gameId = '' } = useParams();
  const { sessionKey } = useAuth();
  const { state: realtime } = useRealtime();
  const { session, missing } = useArenaSession(gameId, sessionKey, realtime?.gameSession ?? null);
  const [identity, setIdentity] = useState<{ sessionKey: string; id: number; avatar: AvatarConfig | null } | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [identityAttempt, setIdentityAttempt] = useState(0);
  const meId = identity?.sessionKey === sessionKey ? identity?.id ?? null : null;
  const [picked, setPicked] = useState<{ round: number; answer: number } | null>(null);
  const [error, setError] = useState<{ round: number | null; message: string } | null>(null);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [verdict, setVerdict] = useState<{ game: string; round: number; damage: number } | null>(null);
  const [reactionNotice, setReactionNotice] = useState<string | null>(null);
  const [introGame, setIntroGame] = useState<{ id: string; leaving: boolean } | null>(null);
  const [watched, setWatched] = useState<string | null>(null);
  const [podiumFor, setPodiumFor] = useState<string | null>(null);
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const serverTime = session?.serverTime ?? 0;
  const clock = useArenaClock(serverTime, session?.status === 'ACTIVE');
  useBattlePresence(gameId, sessionKey);
  const deadline = session ? (session.phase === 'QUESTION' ? session.roundEndsAt : session.nextRoundAt) : 0;
  const left = session ? frozenSecondsLeft(session, deadline) ?? (clock.serverTime === serverTime
    ? secondsLeft(deadline, serverTime, clock.receivedAt, clock.now)
    : Math.max(0, Math.ceil((deadline - serverTime) / 1000))) : 0;
  useBattleSounds(session, meId, left, !!session && meId !== null
    && (session.answeredBy.includes(meId) || picked?.round === session.round));

  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    userApi.getCurrentUser({ sessionKey }, controller.signal)
      .then(response => {
        if (!response.ok) throw new Error('User request failed');
        return response.json();
      })
      .then(user => {
        if (!Number.isInteger(user?.id) || user.id <= 0) throw new Error('Invalid user');
        if (!controller.signal.aborted) setIdentity({ sessionKey, id: user.id, avatar: user.avatar ?? null });
      })
      .catch(() => { if (!controller.signal.aborted) setIdentityError(sessionKey); });
    return () => controller.abort();
  }, [sessionKey, identityAttempt]);

  const introPhase = session?.phase === 'INTRO' && session.status === 'ACTIVE';
  if (session && introPhase && introGame?.id !== session.id) setIntroGame({ id: session.id, leaving: true });
  const introLeaving = !!session && session.status === 'ACTIVE' && !introPhase && introGame?.id === session.id && introGame.leaving && !reducedMotion;
  if (session?.status === 'ACTIVE' && watched !== session.id) setWatched(session.id);
  const finishedId = session?.status === 'FINISHED' ? session.id : null;
  const celebrateIn = session && finishedId ? podiumDelay(session, watched === finishedId, reducedMotion) : 0;
  useEffect(() => {
    if (!finishedId || podiumFor === finishedId) return;
    const timer = setTimeout(() => setPodiumFor(finishedId), celebrateIn);
    return () => clearTimeout(timer);
  }, [finishedId, celebrateIn, podiumFor]);

  useEffect(() => {
    if (!introLeaving) return;
    const timer = setTimeout(() => setIntroGame(shown => shown && { ...shown, leaving: false }), INTRO_EXIT_MS);
    return () => clearTimeout(timer);
  }, [introLeaving]);

  useEffect(() => {
    if (!reactionNotice) return;
    const timer = setTimeout(() => setReactionNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [reactionNotice]);


  if (!session || meId === null) {
    const failed = identityError === sessionKey && sessionKey !== null;
    return (
      <RoomFrame label="Pojedynek na arenie" className="room-frame--panels battle-frame"
        nav={{ back: { title: 'Arena', label: 'Arena', to: '/arena' }, title: 'Pojedynek' }}>
        <div className="user-dashboard battle-page">
          <div className="battle-shell">
            {missing ? <p role="status" className="ud-empty">Tej walki nie ma już na serwerze. Jeśli trwała podczas restartu serwera, została anulowana, a Elo się nie zmieniło.</p> : failed ? <>
              <p role="alert" className="battle-error">Nie udało się pobrać Twojego konta. Walka trwa dalej. Spróbuj ponownie.</p>
              <button type="button" className="ud-btn ud-btn-solid" onClick={() => { setIdentityError(null); setIdentityAttempt(attempt => attempt + 1); }}>Spróbuj ponownie</button>
            </> : <BattleIntroLoading label="Wczytuję walkę" avatar={identity?.sessionKey === sessionKey ? identity.avatar : null} />}
            <Link className="ud-link battle-loading-back" to="/arena">Wróć do Areny</Link>
          </div>
        </div>
      </RoomFrame>
    );
  }

  const { me, rival } = perspective(session, meId);
  const finished = session.status === 'FINISHED';
  const answered = session.answeredBy.includes(me.id);
  const rivalAnswered = session.answeredBy.includes(rival.id);
  const myPick = picked?.round === session.round ? picked.answer : null;
  const reveal = !finished && session.phase === 'REVEAL' ? session.lastRound : null;
  const result = outcome(session, me.id);
  const change = eloChange(session, me.id);
  const currentVerdict = verdict?.game === session.id && verdict.round === session.round ? verdict : null;
  const visibleError = error && (error.round === null || error.round === session.round) ? error.message : null;
  const headers = { sessionKey };
  const serverNow = clock.serverTime === serverTime ? clock.now + (serverTime - clock.receivedAt) : serverTime;
  const pause = pauseNotice(session, me.id, serverNow);
  const absence = absenceNotice(session, me.id, serverNow);
  const banner = roundBanner(session, serverNow);

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
        return;
      }
      const body = await response.json().catch(() => null);
      if (typeof body?.correct !== 'boolean') return;
      const damage = body.correct ? body.damage ?? 0 : 0;
      if (Number.isInteger(damage) && damage >= 0) setVerdict({ game: session.id, round, damage });
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

  const next = finished
    ? { label: 'Wróć do Areny', primary: true, onClick: () => navigate('/arena') }
    : confirmSurrender
      ? { label: 'Tak, poddaję walkę', primary: true, onClick: () => void surrender() }
      : { label: 'Poddaj walkę', onClick: () => setConfirmSurrender(true) };

  return (
    <RoomFrame
      label="Pojedynek na arenie"
      className="room-frame--panels battle-frame"
      nav={{
        back: finished
          ? { title: 'Arena', label: 'Arena', to: '/arena' }
          : { title: 'Arena', label: 'Wyjdź z walki', onClick: () => setConfirmSurrender(true) },
        title: `${me.username} vs ${rival.username}`,
        action: <BugReportButton className="room-nav-report" context={{ source: 'ARENA', gameId: session.id }} />,
      }}
      footer={
        <RoomFooterBar
          title={finished ? undefined : confirmSurrender ? 'Poddanie oznacza porażkę.' : `Walka z ${rival.username}`}
          mascot={false}
          back={confirmSurrender && !finished ? { label: 'Walczę dalej', onClick: () => setConfirmSurrender(false) } : undefined}
          next={next}
        />
      }>
      <section className="room-pane battle-pane" aria-label="Pojedynek">
        <div className="user-dashboard battle-page" data-still={reducedMotion} data-result={finished ? result : undefined}>
          <div className="battle-shell">
            <div className="battle-arena" data-paused={pause !== null} data-danger={!finished && me.hp > 0 && me.hp < LOW_HP}>
              {(introPhase || introLeaving) && <BattleIntro me={me} rival={rival} cards={session.intro} secondsLeft={left} totalRounds={session.totalRounds}
                roundSeconds={Math.round((session.roundMillis ?? ROUND_MS) / 1000)} leaving={introLeaving} reducedMotion={reducedMotion} />}
              {banner && !reducedMotion && <p key={`banner-${session.round}`} className="battle-banner" aria-hidden="true"><strong>{banner}</strong></p>}
              <BattleScene session={session} me={me} rival={rival} reducedMotion={reducedMotion} serverNow={serverNow} afterIntro={introGame?.id === session.id && !reducedMotion}
                strike={currentVerdict && currentVerdict.damage > 0 ? currentVerdict.damage : null} miss={currentVerdict?.damage === 0}
                quickChat={{ onPick: reaction => void react(reaction), notice: reactionNotice }}>
                <div className="battle-round">
                  <p className="battle-round-label">Runda {session.round}/{session.totalRounds}</p>
                  {!finished && <p className={`battle-timer${pause ? ' is-paused' : ''}`} role="timer" aria-label={session.phase === 'QUESTION' ? 'Czas na odpowiedź' : 'Następna runda za'}>{left}</p>}
                </div>
              </BattleScene>

              {finished && result === 'cancelled' && <BattleResult result={result} title={outcomeTitle(result)} text={finishText(session, me.id)} change={change} still={reducedMotion} />}
              {finished && result !== 'cancelled' && podiumFor === session.id && <BattlePodium me={me} rival={rival} result={result} title={outcomeTitle(result)} change={change} still={reducedMotion} />}
              {absence && <p className="battle-absence" role="status">{absence}</p>}
              {pause ? (
                <BattlePause pause={pause} me={me} rival={rival} />
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
                          {correct && <span className="sr-only">Poprawna</span>}
                          {(mine || theirs) && <span className="battle-pickers">
                            {mine && <UserAvatar className="battle-picker is-me" username={me.username} avatar={me.avatar} alt="Ty" />}
                            {theirs && <UserAvatar className="battle-picker is-rival" username={rival.username} avatar={rival.avatar} alt={rival.username} />}
                          </span>}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="battle-summary" role="status" aria-live="polite">{roundSummary(reveal, me.id, rival.id)}</p>
                </section>
              ) : !finished && session.question ? (
                <section className="battle-card" aria-labelledby="battle-question">
                  <p className="battle-card-meta">{arenaCategoryLabel(session.question.category)}</p>
                  <h1 id="battle-question" className="battle-question">{session.question.content}</h1>
                  <div className="battle-answers" role="group" aria-label="Odpowiedzi">
                    {session.question.answers.map((text, index) => (
                      <button key={index} type="button" className={`battle-answer${myPick === index ? ' is-picked' : ''}`}
                        data-verdict={myPick === index && currentVerdict ? (currentVerdict.damage > 0 ? 'hit' : 'miss') : undefined}
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
          </div>
        </div>
      </section>
    </RoomFrame>
  );
}
