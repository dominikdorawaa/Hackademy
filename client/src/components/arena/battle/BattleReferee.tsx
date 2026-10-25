import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { HURT_MS, IMPACT_MS, KNOCKBACK_MS } from './battleView';
import type { Finisher } from './battleView';
import type { GameSession } from '../../../types/api';

const BASE = '/assets/arena/referee/';
export const REFEREE_FRAME_MS = 110;
export const REFEREE_FRAME = { width: 56, height: 57 };
export const REFEREE_SHEETS = {
  idle: { src: `${BASE}referee-idle.png`, frames: 1 },
  start: { src: `${BASE}referee-start.png`, frames: 13 },
  winner: { src: `${BASE}referee-winner.png`, frames: 10 },
} as const;
export const DEFAULT_ROUND_MS = 15_000;
export const START_WINDOW_MS = 4_000;
export const VERDICT_PAUSE_MS = 400;
export const START_MS = REFEREE_SHEETS.start.frames * REFEREE_FRAME_MS;

export type RefereeMove = keyof typeof REFEREE_SHEETS;
export interface RefereeCall { move: RefereeMove; key: string; delay: number; toward: 'me' | 'rival' | null }

function verdictDelay(session: GameSession, finish: Finisher | null) {
  if (session.finishReason !== 'KNOCKOUT' && session.finishReason !== 'ROUNDS') return 0;
  if (!finish) return IMPACT_MS + HURT_MS + VERDICT_PAUSE_MS;
  return Math.max(finish.end, finish.move === 'combo' ? finish.impact + KNOCKBACK_MS : 0) + VERDICT_PAUSE_MS;
}

export function refereeCall(session: GameSession, meId: number, serverNow: number, finish: Finisher | null): RefereeCall {
  if (session.status === 'FINISHED') {
    if (session.winnerId == null || session.finishReason === 'CANCELLED' || session.finishReason === 'ABANDONED') return { move: 'idle', key: 'idle', delay: 0, toward: null };
    return { move: 'winner', key: `winner-${session.id}`, delay: verdictDelay(session, finish), toward: session.winnerId === meId ? 'me' : 'rival' };
  }
  const roundMs = session.roundMillis ?? DEFAULT_ROUND_MS;
  if (session.round === 1 && session.phase === 'QUESTION' && !session.pause && session.roundEndsAt - serverNow > roundMs - START_WINDOW_MS) return { move: 'start', key: `start-${session.id}`, delay: 0, toward: null };
  return { move: 'idle', key: 'idle', delay: 0, toward: null };
}

export function BattleReferee({ session, meId, serverNow, reducedMotion, finish }: {
  session: GameSession; meId: number; serverNow: number; reducedMotion: boolean; finish: Finisher | null;
}) {
  const call = refereeCall(session, meId, serverNow, finish);
  const played = useRef(new Set<string>());
  const [current, setCurrent] = useState<{ key: string; move: RefereeMove } | null>(null);
  useEffect(() => {
    if (call.move === 'idle' || reducedMotion || played.current.has(call.key)) return;
    const begin = setTimeout(() => { played.current.add(call.key); setCurrent({ key: call.key, move: call.move }); }, call.delay);
    return () => clearTimeout(begin);
  }, [call.key, call.move, call.delay, reducedMotion]);
  useEffect(() => {
    if (current?.move !== 'start') return;
    const end = setTimeout(() => setCurrent(shown => shown === current ? null : shown), START_MS);
    return () => clearTimeout(end);
  }, [current]);

  const starting = current?.move === 'start' && current.key === `start-${session.id}` && !reducedMotion;
  const verdict = call.move === 'winner' && (reducedMotion || current?.key === call.key);
  const move: RefereeMove = verdict ? 'winner' : starting ? 'start' : 'idle';
  const sheet = REFEREE_SHEETS[move];
  const style = {
    '--referee-src': `url(${sheet.src})`, '--referee-frames': sheet.frames,
    animation: move === 'idle' || reducedMotion ? undefined : `battle-referee-play ${sheet.frames * REFEREE_FRAME_MS}ms steps(${sheet.frames}, jump-none) both`,
  } as CSSProperties;
  const frame = { '--referee-width': REFEREE_FRAME.width, '--referee-height': REFEREE_FRAME.height, '--referee-call': `${START_MS}ms` } as CSSProperties;
  return <div className="battle-referee" style={frame} data-move={move} data-toward={move === 'winner' ? call.toward : undefined} aria-hidden="true">
    {move === 'start' && <p className="battle-referee-call">Walka!</p>}
    <span key={`${move}-${current?.key ?? call.key}`} className="battle-referee-sprite" data-still={reducedMotion} style={style} />
  </div>;
}
