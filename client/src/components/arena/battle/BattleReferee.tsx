import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { finisher, HURT_MS, IMPACT_MS } from './battleView';
import type { GameSession } from '../../../types/api';

const BASE = '/assets/arena/referee/';
export const REFEREE_FRAME_MS = 110;
export const REFEREE_FRAME = { width: 56, height: 57 };
export const REFEREE_SHEETS = {
  idle: { src: `${BASE}referee-idle.png`, frames: 1 },
  start: { src: `${BASE}referee-start.png`, frames: 13 },
  winner: { src: `${BASE}referee-winner.png`, frames: 10 },
} as const;
export const ROUND_MS = 15_000;
export const START_WINDOW_MS = 4_000;
export const VERDICT_PAUSE_MS = 400;

export type RefereeMove = keyof typeof REFEREE_SHEETS;
export interface RefereeCall { move: RefereeMove; key: string; delay: number; toward: 'me' | 'rival' | null }

export function refereeCall(session: GameSession, meId: number, serverNow: number): RefereeCall {
  if (session.status === 'FINISHED') {
    if (session.winnerId == null || session.finishReason === 'CANCELLED' || session.finishReason === 'ABANDONED') return { move: 'idle', key: 'idle', delay: 0, toward: null };
    const finish = finisher(session);
    const animated = session.finishReason === 'KNOCKOUT' || session.finishReason === 'ROUNDS';
    const delay = !animated ? 0 : (finish ? finish.end : IMPACT_MS + HURT_MS) + VERDICT_PAUSE_MS;
    return { move: 'winner', key: `winner-${session.id}`, delay, toward: session.winnerId === meId ? 'me' : 'rival' };
  }
  if (session.round === 1 && session.phase === 'QUESTION' && !session.pause && session.roundEndsAt - serverNow > ROUND_MS - START_WINDOW_MS) return { move: 'start', key: `start-${session.id}`, delay: 0, toward: null };
  return { move: 'idle', key: 'idle', delay: 0, toward: null };
}

export function BattleReferee({ session, meId, serverNow, reducedMotion }: { session: GameSession; meId: number; serverNow: number; reducedMotion: boolean }) {
  const call = refereeCall(session, meId, serverNow);
  const [shown, setShown] = useState<{ key: string; playing: boolean }>({ key: '', playing: false });
  const playing = shown.key === call.key ? shown.playing : call.delay === 0 && call.move !== 'idle';
  useEffect(() => {
    if (call.move === 'idle' || reducedMotion) return;
    const begin = setTimeout(() => setShown({ key: call.key, playing: true }), call.delay);
    return () => clearTimeout(begin);
  }, [call.key, call.move, call.delay, reducedMotion]);
  useEffect(() => {
    if (call.move !== 'start' || reducedMotion) return;
    const end = setTimeout(() => setShown({ key: call.key, playing: false }), call.delay + REFEREE_SHEETS.start.frames * REFEREE_FRAME_MS);
    return () => clearTimeout(end);
  }, [call.key, call.move, call.delay, reducedMotion]);

  const move: RefereeMove = call.move === 'winner' ? (playing || reducedMotion ? 'winner' : 'idle') : call.move === 'start' && playing && !reducedMotion ? 'start' : 'idle';
  const sheet = REFEREE_SHEETS[move];
  const style = {
    '--referee-src': `url(${sheet.src})`, '--referee-frames': sheet.frames,
    animation: move === 'idle' || reducedMotion ? undefined : `battle-referee-play ${sheet.frames * REFEREE_FRAME_MS}ms steps(${sheet.frames}, jump-none) both`,
  } as CSSProperties;
  const frame = { '--referee-width': REFEREE_FRAME.width, '--referee-height': REFEREE_FRAME.height } as CSSProperties;
  return <div className="battle-referee" style={frame} data-move={move} data-toward={move === 'winner' ? call.toward : undefined} aria-hidden="true">
    {move === 'start' && <p className="battle-referee-call">Walka!</p>}
    <span key={`${move}-${call.key}`} className="battle-referee-sprite" data-still={reducedMotion} style={style} />
  </div>;
}
