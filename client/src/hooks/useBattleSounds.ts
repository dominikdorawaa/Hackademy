import { useEffect, useRef } from 'react';
import { outcome } from '../components/arena/battle/battleView';
import type { Outcome } from '../components/arena/battle/battleView';
import type { GameSoundEvent } from '../lib/notificationSounds';
import type { GameSession } from '../types/api';
import { useGameSound } from './useGameSound';

export const COUNTDOWN_SECONDS = 3;

type Snapshot = Pick<GameSession, 'status' | 'phase' | 'round'>;
const resultSounds: Record<Outcome, GameSoundEvent | null> = { win: 'arenaWin', loss: 'arenaLoss', draw: 'arenaDraw', cancelled: null };

export function battleSound(previous: Snapshot | null, session: GameSession, meId: number): GameSoundEvent | null {
  if (!previous) return null;
  if (session.status === 'FINISHED') {
    return previous.status === 'FINISHED' ? null : resultSounds[outcome(session, meId)];
  }
  if (session.phase !== 'REVEAL' || !session.lastRound || (previous.phase === 'REVEAL' && previous.round === session.round)) return null;
  return session.lastRound.choices[meId] === session.lastRound.correctAnswer ? 'arenaCorrect' : 'arenaWrong';
}

export function useBattleSounds(session: GameSession | null, meId: number | null, secondsLeft: number | null, answered: boolean) {
  const play = useGameSound();
  const previous = useRef<{ id: string; snapshot: Snapshot } | null>(null);
  const lastTick = useRef<{ round: string; second: number } | null>(null);

  useEffect(() => {
    if (!session || meId === null) return;
    const before = previous.current?.id === session.id ? previous.current.snapshot : null;
    previous.current = { id: session.id, snapshot: { status: session.status, phase: session.phase, round: session.round } };
    const sound = battleSound(before, session, meId);
    if (sound) play(sound);
  }, [session, meId, play]);

  const ticking = session?.status === 'ACTIVE' && session.phase === 'QUESTION' && !session.pause && !answered
    && secondsLeft !== null && secondsLeft >= 1 && secondsLeft <= COUNTDOWN_SECONDS;
  const round = ticking ? `${session.id}:${session.round}` : null;
  const second = ticking ? secondsLeft : null;
  useEffect(() => {
    if (round === null || second === null) return;
    if (lastTick.current?.round === round && lastTick.current.second <= second) return;
    lastTick.current = { round, second };
    play('arenaTick');
  }, [round, second, play]);
}
