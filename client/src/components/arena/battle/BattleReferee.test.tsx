import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleReferee, REFEREE_FRAME_MS, REFEREE_SHEETS, refereeCall, VERDICT_PAUSE_MS } from './BattleReferee';
import { finisher, HURT_MS, IMPACT_MS } from './battleView';
import { createGameSession } from '../../../test/fixtures/arena';
import type { GameSession } from '../../../types/api';

const NOW = 1_000_000;
const opening = (overrides: Partial<GameSession> = {}) => createGameSession({ roundEndsAt: NOW + 15_000, serverTime: NOW, ...overrides });
const won = (winnerId: number, overrides: Partial<GameSession> = {}) => createGameSession({ status: 'FINISHED', winnerId, finishReason: 'SURRENDER', serverTime: NOW, ...overrides });
const knockout = createGameSession({
  status: 'FINISHED', winnerId: 2, finishReason: 'KNOCKOUT', serverTime: NOW, hp: { 1: 0, 2: 20 },
  lastRound: { round: 4, questionId: 11, content: 'Pytanie', answers: ['A', 'B', 'C', 'D'], correctAnswer: 1, choices: { 1: 0, 2: 1 }, damage: { 1: 20, 2: 0 } },
});
const referee = () => document.querySelector('.battle-referee')!;
const sprite = () => document.querySelector<HTMLElement>('.battle-referee-sprite')!;

describe('referee calls', () => {
  it('blows the whistle only in the first seconds of the first question', () => {
    expect(refereeCall(opening(), 1, NOW)).toMatchObject({ move: 'start', delay: 0 });
    expect(refereeCall(opening(), 1, NOW + 3_999)).toMatchObject({ move: 'start' });
    expect(refereeCall(opening(), 1, NOW + 4_000)).toMatchObject({ move: 'idle' });
    expect(refereeCall(opening({ round: 2 }), 1, NOW)).toMatchObject({ move: 'idle' });
    expect(refereeCall(opening({ phase: 'REVEAL' }), 1, NOW)).toMatchObject({ move: 'idle' });
    expect(refereeCall(opening({ pause: { players: [2], startedAt: NOW, endsAt: NOW + 10_000 } }), 1, NOW)).toMatchObject({ move: 'idle' });
  });

  it('points at the winner after the last blow and stays calm after a draw or a cancelled match', () => {
    expect(refereeCall(won(1), 1, NOW)).toEqual({ move: 'winner', key: 'winner-game', delay: 0, toward: 'me' });
    expect(refereeCall(won(2), 1, NOW)).toMatchObject({ move: 'winner', toward: 'rival' });
    expect(refereeCall(knockout, 1, NOW)).toMatchObject({ move: 'winner', toward: 'rival', delay: finisher(knockout)!.end + VERDICT_PAUSE_MS });
    expect(refereeCall({ ...knockout, finishReason: 'ROUNDS' }, 1, NOW).delay).toBe(IMPACT_MS + HURT_MS + VERDICT_PAUSE_MS);
    expect(refereeCall(won(1, { winnerId: null, finishReason: 'ROUNDS' }), 1, NOW)).toMatchObject({ move: 'idle' });
    expect(refereeCall(won(1, { finishReason: 'CANCELLED' }), 1, NOW)).toMatchObject({ move: 'idle' });
    expect(refereeCall(won(1, { finishReason: 'ABANDONED' }), 1, NOW)).toMatchObject({ move: 'idle' });
    expect(refereeCall(createGameSession({ round: 3 }), 1, NOW)).toMatchObject({ move: 'idle' });
  });
});

describe('referee on the stage', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts the fight with the whistle once and then stands by', () => {
    render(<BattleReferee session={opening()} meId={1} serverNow={NOW} reducedMotion={false} />);
    expect(referee()).toHaveAttribute('data-move', 'start');
    expect(screen.getByText('Walka!')).toBeInTheDocument();
    expect(sprite().style.animation).toContain(`steps(${REFEREE_SHEETS.start.frames}, jump-none)`);
    act(() => { vi.advanceTimersByTime(REFEREE_SHEETS.start.frames * REFEREE_FRAME_MS); });
    expect(referee()).toHaveAttribute('data-move', 'idle');
    expect(screen.queryByText('Walka!')).toBeNull();
  });

  it('waits for the knockout to land before pointing at the winner, mirrored toward my side', () => {
    const { rerender } = render(<BattleReferee session={knockout} meId={1} serverNow={NOW} reducedMotion={false} />);
    expect(referee()).toHaveAttribute('data-move', 'idle');
    act(() => { vi.advanceTimersByTime(finisher(knockout)!.end + VERDICT_PAUSE_MS); });
    expect(referee()).toHaveAttribute('data-move', 'winner');
    expect(referee()).toHaveAttribute('data-toward', 'rival');
    rerender(<BattleReferee session={won(1)} meId={1} serverNow={NOW} reducedMotion={false} />);
    act(() => { vi.advanceTimersByTime(0); });
    expect(referee()).toHaveAttribute('data-toward', 'me');
  });

  it('shows the final pose without moving when motion is reduced', () => {
    const { rerender } = render(<BattleReferee session={opening()} meId={1} serverNow={NOW} reducedMotion />);
    expect(referee()).toHaveAttribute('data-move', 'idle');
    expect(screen.queryByText('Walka!')).toBeNull();
    rerender(<BattleReferee session={won(2)} meId={1} serverNow={NOW} reducedMotion />);
    expect(referee()).toHaveAttribute('data-move', 'winner');
    expect(sprite()).toHaveAttribute('data-still', 'true');
    expect(sprite().style.animation).toBe('');
  });
});
