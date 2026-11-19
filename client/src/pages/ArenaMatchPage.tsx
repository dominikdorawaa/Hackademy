import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as arenaApi from '../services/arenaApi';
import * as userApi from '../services/userApi';
import type { ArenaMatchDetail, ArenaMatchRound, AvatarConfig } from '../types/api';
import UserAvatar from '../components/UserAvatar';
import { LeagueIcon } from '../components/arena/LeagueIcon';
import { leagueFor } from '../components/arena/leagues';
import { arenaCategoryLabel } from '../components/arena/arenaCategory';
import { arenaDifficultyLabels } from '../components/arena/arenaDifficulty';
import { ArenaLoader } from '../components/arena/ArenaLoader';
import {
  correctCount, finishLine, formatAnswerTime, formatBattleDate, formatDuration, leagueNote, resultLabel, resultTone,
} from '../components/arena/history/battleHistory';
import { formatEloChange, formatNumberPL } from '../lib/units';
import type { ArenaQuestionDifficulty } from '../types/api';
import '../components/arena/history/BattleHistory.css';
import './UserDashboardPage.css';

type Me = { username: string; avatar?: AvatarConfig | null };
type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; detail: ArenaMatchDetail };

export default function ArenaMatchPage() {
  const { matchId, gameId } = useParams();
  const { sessionKey } = useAuth();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    const auth = { sessionKey };
    const call = gameId ? arenaApi.getMatchOfGame(gameId, auth) : arenaApi.getMatch(matchId ?? '', auth);
    call
      .then(async response => {
        if (cancelled) return;
        if (response.status === 404) return setState({ status: 'missing' });
        if (!response.ok) throw new Error('match');
        setState({ status: 'ready', detail: await response.json() });
      })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [matchId, gameId, sessionKey]);

  useEffect(() => {
    let cancelled = false;
    userApi.getCurrentUser({ sessionKey })
      .then(response => (response.ok ? response.json() : null))
      .then(user => { if (!cancelled && user) setMe({ username: user.username, avatar: user.avatar }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sessionKey]);

  return (
    <div className="user-dashboard bh-history-page">
      <div className="bh-history-shell">
        <Link className="bh-back" to="/arena/history"><i className="fas fa-chevron-left" aria-hidden="true"></i> Wszystkie bitwy</Link>
        {state.status === 'loading' ? (
          <ArenaLoader label="Wczytuję bitwę" />
        ) : state.status === 'missing' ? (
          <section className="ud-panel"><h1 className="bh-history-title">Nie ma takiej bitwy</h1><p className="ud-empty">Ta bitwa nie istnieje albo nie należy do Twojej historii.</p></section>
        ) : state.status === 'error' ? (
          <section className="ud-panel"><h1 className="bh-history-title">Nie udało się wczytać bitwy</h1><p className="ud-empty">Odśwież stronę, żeby spróbować ponownie.</p></section>
        ) : (
          <MatchView detail={state.detail} me={me} />
        )}
      </div>
    </div>
  );
}

function MatchView({ detail, me }: { detail: ArenaMatchDetail; me: Me | null }) {
  const { summary, rounds } = detail;
  const tone = resultTone(summary.result);
  const finish = finishLine(detail);
  const eloAfter = detail.eloBefore != null ? detail.eloBefore + summary.eloChange : null;
  const myLeague = detail.eloBefore != null ? leagueFor(detail.eloBefore).league : null;
  const rivalLeague = detail.opponentElo != null ? leagueFor(detail.opponentElo).league : null;
  const note = detail.eloBefore != null ? leagueNote(detail.eloBefore, summary.eloChange) : null;
  const hasHp = detail.hp != null && detail.opponentHp != null;
  const myName = me?.username ?? 'Ty';

  return (
    <>
      <section className={`bh-sum bh-sum-${tone}`} aria-labelledby="bh-sum-title">
        <div className="bh-sum-top">
          <p className="bh-sum-meta">{[formatBattleDate(summary.finishedAt), finish].filter(Boolean).join(' · ')}</p>
          <div className="bh-sum-verdict">
            <h1 id="bh-sum-title"><span className={`bh-tone-${tone}`}>{resultLabel(summary.result)}</span> z {summary.opponentName}</h1>
            <span className={`bh-sum-elo bh-tone-${tone}`}>{formatEloChange(summary.eloChange)}</span>
          </div>
        </div>
        <div className="bh-duel">
          <Fighter side="me" name="Ty" username={myName} avatar={me?.avatar} league={myLeague} hp={hasHp ? detail.hp! : null} />
          <Fighter side="rival" name={summary.opponentName} username={summary.opponentName} avatar={summary.opponentAvatar} league={rivalLeague} hp={hasHp ? detail.opponentHp! : null} />
        </div>
        <dl className="bh-stats">
          {rounds.length > 0 && <div><dt>Dobre odpowiedzi</dt><dd>{correctCount(rounds, 'me')} : {correctCount(rounds, 'opponent')}</dd></div>}
          {detail.eloBefore != null && eloAfter != null && <div><dt>Twoje Elo</dt><dd>{formatNumberPL(detail.eloBefore)} <i className="fas fa-arrow-right" aria-hidden="true"></i><span className="sr-only">do</span> {formatNumberPL(eloAfter)}</dd></div>}
          {detail.durationSeconds != null && <div><dt>Czas bitwy</dt><dd>{formatDuration(detail.durationSeconds)}</dd></div>}
        </dl>
        {note && (
          <p className={`bh-league-note bh-league-${note.kind}`}>
            <LeagueIcon league={note.league} className="bh-league-icon" />
            <span>{note.text}</span>
          </p>
        )}
      </section>
      {rounds.length > 0 ? <Rounds rounds={rounds} /> : (
        <section className="ud-panel bh-rounds-empty">
          <p className="ud-empty">Przebieg rund zapisujemy od niedawna. Ta bitwa odbyła się wcześniej, więc nie ma zapisanych pytań.</p>
        </section>
      )}
    </>
  );
}

function Fighter({ side, name, username, avatar, league, hp }: {
  side: 'me' | 'rival'; name: string; username: string; avatar?: AvatarConfig | null;
  league: ReturnType<typeof leagueFor>['league'] | null; hp: number | null;
}) {
  return (
    <div className={`bh-fighter bh-fighter-${side}`}>
      <UserAvatar className="bh-fighter-avatar" username={username} avatar={avatar} alt="" />
      <span className="bh-fighter-who">
        <span className="bh-fighter-name">{name}</span>
        {league && <span className="bh-fighter-league"><LeagueIcon league={league} className="bh-fighter-league-icon" />Liga {league.name}</span>}
      </span>
      {hp != null && (
        <>
          <span className="bh-fighter-hp">{hp} HP</span>
          <span className="bh-fighter-bar" role="img" aria-label={`${name}: zostało ${hp} z 100 HP`}>
            <span style={{ '--bh-hp': `${Math.max(0, Math.min(100, hp))}%` } as CSSProperties} />
          </span>
        </>
      )}
    </div>
  );
}

function Rounds({ rounds }: { rounds: ArenaMatchRound[] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const items = useRef<(HTMLElement | null)[]>([]);
  const allOpen = open.size === rounds.length;

  const toggle = (number: number) => setOpen(previous => {
    const next = new Set(previous);
    if (next.has(number)) next.delete(number); else next.add(number);
    return next;
  });

  const go = (index: number) => {
    setOpen(new Set([rounds[index].round]));
    requestAnimationFrame(() => items.current[index]?.querySelector('summary')?.focus());
  };

  return (
    <section className="bh-rounds" aria-labelledby="bh-rounds-title">
      <div className="bh-rounds-head">
        <h2 id="bh-rounds-title">Pytania</h2>
        <button type="button" className="bh-text-button" onClick={() => setOpen(allOpen ? new Set() : new Set(rounds.map(round => round.round)))}>
          {allOpen ? 'Zwiń wszystkie' : 'Rozwiń wszystkie'}
        </button>
      </div>
      <ol className="bh-round-list">
        {rounds.map((round, index) => {
          const state = round.choice === round.correctAnswer ? 'good' : 'wrong';
          return (
            <li key={round.round}>
              <details ref={element => { items.current[index] = element; }} className={`bh-round bh-round-${state}`} open={open.has(round.round)}>
                <summary onClick={event => { event.preventDefault(); toggle(round.round); }}>
                  <span className="bh-round-number">{round.round}</span>
                  <span className="bh-round-question">{round.content}</span>
                  <span className="sr-only">{state === 'good' ? 'Twoja odpowiedź była poprawna.' : round.choice == null ? 'Brak Twojej odpowiedzi.' : 'Twoja odpowiedź była błędna.'}</span>
                  <i className="fas fa-chevron-right bh-round-chevron" aria-hidden="true"></i>
                </summary>
                <div className="bh-round-body">
                  <p className="bh-round-meta">
                    {[arenaCategoryLabel(round.category), round.difficulty ? arenaDifficultyLabels[round.difficulty as ArenaQuestionDifficulty] ?? round.difficulty : null].filter(Boolean).join(' · ')}
                  </p>
                  <ul className="bh-answers">
                    {round.answers.map((answer, answerIndex) => {
                      const correct = answerIndex === round.correctAnswer;
                      const mine = round.choice === answerIndex;
                      const theirs = round.opponentChoice === answerIndex;
                      const kind = correct ? 'right' : mine || theirs ? 'wrong' : 'plain';
                      return (
                        <li key={answerIndex} className={`bh-answer bh-answer-${kind}`}>
                          <span className="bh-answer-mark">
                            {kind === 'right' && <i className="fas fa-check" role="img" aria-label="Poprawna odpowiedź"></i>}
                            {kind === 'wrong' && <i className="fas fa-times" role="img" aria-label="Błędna odpowiedź"></i>}
                          </span>
                          <span className="bh-answer-text">{answer}</span>
                          <span className="bh-answer-tags">
                            {mine && <span className="bh-tag bh-tag-me">Ty{round.answerMillis != null ? `, ${formatAnswerTime(round.answerMillis)}` : ''}</span>}
                            {theirs && <span className="bh-tag bh-tag-rival">rywal{round.opponentAnswerMillis != null ? `, ${formatAnswerTime(round.opponentAnswerMillis)}` : ''}</span>}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {(round.choice == null || round.opponentChoice == null) && (
                    <p className="bh-round-note">
                      {round.choice == null && round.opponentChoice == null ? 'Nikt nie odpowiedział w 15 sekund.'
                        : round.choice == null ? 'Brak Twojej odpowiedzi w 15 sekund.' : 'Rywal nie odpowiedział w 15 sekund.'}
                    </p>
                  )}
                  <p className="bh-round-hp">Po rundzie: Ty {round.hpAfter} HP, rywal {round.opponentHpAfter} HP.</p>
                  <div className="bh-round-nav">
                    <button type="button" className="bh-text-button" disabled={index === 0} onClick={() => go(index - 1)}>
                      <i className="fas fa-chevron-left" aria-hidden="true"></i> Poprzednie
                    </button>
                    <button type="button" className="bh-text-button" disabled={index === rounds.length - 1} onClick={() => go(index + 1)}>
                      Następne <i className="fas fa-chevron-right" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

