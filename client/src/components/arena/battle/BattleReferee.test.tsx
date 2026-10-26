import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BattleReferee, REFEREE_SHEETS, refereeCall, START_MS, VERDICT_PAUSE_MS } from './BattleReferee';
import { finisher, HURT_MS, IMPACT_MS, KNOCKBACK_MS } from './battleView';
import type { Finisher } from './battleView';
import { createGameSession } from '../../../test/fixtures/arena';
import type { GameSession } from '../../../types/api';

const NOW = 1_000_000;
const opening = (overrides: Partial<GameSession> = {}) => createGameSession({ roundEndsAt: NOW + 15_000, serverTime: NOW, ...overrides });
const won = (winnerId: number, overrides: Partial<GameSession> = {}) => createGameSession({ status: 'FINISHED', winnerId, finishReason: 'SURRENDER', serverTime: NOW, ...overrides });
const lastRound = { round: 4, questionId: 11, content: 'Pytanie', answers: ['A', 'B', 'C', 'D'], correctAnswer: 1, choices: { 1: 0, 2: 1 }, damage: { 1: 20, 2: 0 } };
const avatar = (finisherMove: string) => ({ outfit: 'baza', hair: 'brak', hat: 'brak', skin: 'jasna', hairColor: 'czarne', topColor: 'granatowy', bottomColor: 'piaskowy', shoesColor: 'grafitowy', hatColor: 'czerwony', finisher: finisherMove });
const knockout = (move: string) => createGameSession({
  status: 'FINISHED', winnerId: 2, finishReason: 'KNOCKOUT', serverTime: NOW, hp: { 1: 0, 2: 20 }, lastRound, player2Avatar: avatar(move),
});
const referee = () => document.querySelector('.battle-referee')!;
const sprite = () => document.querySelector<HTMLElement>('.battle-referee-sprite')!;
const show = (session: GameSession, serverNow = NOW, reducedMotion = false, finish: Finisher | null = finisher(session)) =>
  <BattleReferee session={session} meId={1} serverNow={serverNow} reducedMotion={reducedMotion} finish={finish} />;
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('referee calls', () => {
  it('blows the whistle only in the first seconds of the first question', () => {
    expect(refereeCall(opening(), 1, NOW, null)).toMatchObject({ move: 'start', delay: 0 });
    expect(refereeCall(opening(), 1, NOW + 3_999, null)).toMatchObject({ move: 'start' });
    expect(refereeCall(opening(), 1, NOW + 4_000, null)).toMatchObject({ move: 'idle' });
    expect(refereeCall(opening({ round: 2 }), 1, NOW, null)).toMatchObject({ move: 'idle' });
    expect(refereeCall(opening({ phase: 'REVEAL' }), 1, NOW, null)).toMatchObject({ move: 'idle' });
    expect(refereeCall(opening({ pause: { players: [2], startedAt: NOW, endsAt: NOW + 10_000 } }), 1, NOW, null)).toMatchObject({ move: 'idle' });
  });

  it('measures the whistle window with the round length the server sends', () => {
    const long = opening({ roundMillis: 20_000, roundEndsAt: NOW + 20_000 });
    expect(refereeCall(long, 1, NOW + 3_999, null)).toMatchObject({ move: 'start' });
    expect(refereeCall(long, 1, NOW + 4_000, null)).toMatchObject({ move: 'idle' });
  });

  it('points at the winner once the last blow and the knockback are over', () => {
    expect(refereeCall(won(1), 1, NOW, null)).toEqual({ move: 'winner', key: 'winner-game', delay: 0, toward: 'me' });
    expect(refereeCall(won(2), 1, NOW, null)).toMatchObject({ move: 'winner', toward: 'rival' });
    const beam = knockout('beam'), combo = knockout('combo');
    expect(refereeCall(beam, 1, NOW, finisher(beam))).toMatchObject({ toward: 'rival', delay: finisher(beam)!.end + VERDICT_PAUSE_MS });
    const blow = finisher(combo)!;
    expect(refereeCall(combo, 1, NOW, blow).delay).toBe(Math.max(blow.end, blow.impact + KNOCKBACK_MS) + VERDICT_PAUSE_MS);
    expect(refereeCall({ ...beam, finishReason: 'ROUNDS' }, 1, NOW, null).delay).toBe(IMPACT_MS + HURT_MS + VERDICT_PAUSE_MS);
  });

  it('stays calm after a draw, a cancelled or an abandoned match', () => {
    expect(refereeCall(won(1, { winnerId: null, finishReason: 'ROUNDS' }), 1, NOW, null)).toMatchObject({ move: 'idle' });
    expect(refereeCall(won(1, { finishReason: 'CANCELLED' }), 1, NOW, null)).toMatchObject({ move: 'idle' });
    expect(refereeCall(won(1, { finishReason: 'ABANDONED' }), 1, NOW, null)).toMatchObject({ move: 'idle' });
    expect(refereeCall(createGameSession({ round: 3 }), 1, NOW, null)).toMatchObject({ move: 'idle' });
  });
});

describe('referee on the stage', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('starts the fight with the whistle once and then stands by', () => {
    render(show(opening()));
    advance(0);
    expect(referee()).toHaveAttribute('data-move', 'start');
    expect(screen.getByText('Walka!')).toBeInTheDocument();
    expect(sprite().style.animation).toContain(`steps(${REFEREE_SHEETS.start.frames}, jump-none)`);
    expect((referee() as HTMLElement).style.getPropertyValue('--referee-call')).toBe(`${START_MS}ms`);
    advance(START_MS);
    expect(referee()).toHaveAttribute('data-move', 'idle');
    expect(screen.queryByText('Walka!')).toBeNull();
    expect([...document.querySelectorAll('.battle-referee-sprite')].map(part => part.className)).toEqual(['battle-referee-sprite is-legs', 'battle-referee-sprite is-body']);
    expect((referee() as HTMLElement).style.getPropertyValue('--referee-knee')).toBe('50');
  });

  it('finishes a whistle that began just before the window closed', () => {
    const { rerender } = render(show(opening(), NOW + 3_500));
    advance(0);
    expect(referee()).toHaveAttribute('data-move', 'start');
    rerender(show(opening(), NOW + 4_200));
    advance(500);
    expect(referee()).toHaveAttribute('data-move', 'start');
    advance(START_MS);
    expect(referee()).toHaveAttribute('data-move', 'idle');
  });

  it('does not blow the whistle again after a pause in the first round', () => {
    const { rerender } = render(show(opening()));
    advance(0);
    rerender(show(opening({ pause: { players: [2], startedAt: NOW + 500, endsAt: NOW + 10_500 } }), NOW + 500));
    advance(START_MS);
    expect(referee()).toHaveAttribute('data-move', 'idle');
    rerender(show(opening({ roundEndsAt: NOW + 25_000 }), NOW + 10_600));
    advance(START_MS);
    expect(referee()).toHaveAttribute('data-move', 'idle');
    expect(screen.queryByText('Walka!')).toBeNull();
  });

  it('waits for the knockout to land before pointing at the winner, mirrored toward my side', () => {
    const combo = knockout('combo'), blow = finisher(combo)!;
    const { rerender } = render(show(combo));
    expect(referee()).toHaveAttribute('data-move', 'idle');
    advance(Math.max(blow.end, blow.impact + KNOCKBACK_MS) + VERDICT_PAUSE_MS - 1);
    expect(referee()).toHaveAttribute('data-move', 'idle');
    advance(1);
    expect(referee()).toHaveAttribute('data-move', 'winner');
    expect(referee()).toHaveAttribute('data-toward', 'rival');
    rerender(show(won(1, { id: 'next' })));
    advance(0);
    expect(referee()).toHaveAttribute('data-toward', 'me');
  });

  it('shows the final pose without moving when motion is reduced', () => {
    const { rerender } = render(show(opening(), NOW, true));
    advance(0);
    expect(referee()).toHaveAttribute('data-move', 'idle');
    expect(screen.queryByText('Walka!')).toBeNull();
    rerender(show(won(2), NOW, true));
    expect(referee()).toHaveAttribute('data-move', 'winner');
    expect(sprite()).toHaveAttribute('data-still', 'true');
    expect(sprite().style.animation).toBe('');
  });
});
