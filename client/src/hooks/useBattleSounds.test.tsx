import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSession } from '../types/api';
import { battleSound, useBattleSounds } from './useBattleSounds';

const sounds = vi.hoisted(() => ({ play: vi.fn(() => true), enabled: true }));
vi.mock('../lib/notificationSounds', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/notificationSounds')>(), playGameSound: sounds.play }));
vi.mock('../context/NotificationPreferencesContext', async () => {
  const { defaultNotificationPreferences } = await import('../services/userApi');
  return { useNotificationPreferences: () => ({ preferences: { ...defaultNotificationPreferences, gameSounds: sounds.enabled }, loaded: true }) };
});

const ME = 1;
const RIVAL = 2;

function battle(change: Partial<GameSession> = {}): GameSession {
  return {
    id: 'g1', player1Id: ME, player1Username: 'me', player1Elo: 1000, player2Id: RIVAL, player2Username: 'rival', player2Elo: 1000,
    startTime: '2026-11-01T10:00:00', status: 'ACTIVE', winnerId: null, finishReason: null, player1EloChange: null, player2EloChange: null,
    round: 1, totalRounds: 5, phase: 'QUESTION', roundEndsAt: 0, nextRoundAt: 0, serverTime: 0, hp: {}, answeredBy: [],
    question: null, lastRound: null, ...change,
  };
}
const reveal = (myChoice: number | undefined, round = 1) => battle({ round, phase: 'REVEAL', lastRound: {
  round, questionId: 1, content: 'Q', answers: ['a', 'b'], correctAnswer: 0, choices: myChoice === undefined ? {} : { [ME]: myChoice }, damage: {} } });
const finished = (winnerId: number | null, finishReason: GameSession['finishReason'] = 'ROUNDS') => battle({ status: 'FINISHED', winnerId, finishReason });

beforeEach(() => { sounds.play.mockClear(); sounds.enabled = true; });

describe('battle sounds', () => {
  it('stays silent on the first snapshot, also when opening an already finished battle', () => {
    expect(battleSound(null, reveal(0), ME)).toBeNull();
    expect(battleSound(null, finished(ME), ME)).toBeNull();
  });

  it('judges my answer once when the round is revealed, treating no answer as wrong', () => {
    const question = battle();
    expect(battleSound(question, reveal(0), ME)).toBe('arenaCorrect');
    expect(battleSound(question, reveal(1), ME)).toBe('arenaWrong');
    expect(battleSound(question, reveal(undefined), ME)).toBe('arenaWrong');
    expect(battleSound(reveal(0), reveal(0), ME)).toBeNull();
    expect(battleSound(reveal(0, 1), reveal(1, 2), ME)).toBe('arenaWrong');
  });

  it('plays only the result when the battle ends, and nothing for a cancelled one', () => {
    const active = battle();
    expect(battleSound(active, finished(ME), ME)).toBe('arenaWin');
    expect(battleSound(active, finished(RIVAL, 'SURRENDER'), ME)).toBe('arenaLoss');
    expect(battleSound(active, finished(null), ME)).toBe('arenaDraw');
    expect(battleSound(active, finished(null, 'CANCELLED'), ME)).toBeNull();
    expect(battleSound(finished(ME), finished(ME), ME)).toBeNull();
  });

  it('ticks once per second in the last seconds until I answer', () => {
    const session = battle();
    const { rerender } = renderHook(({ left, answered }) => useBattleSounds(session, ME, left, answered),
      { initialProps: { left: 5, answered: false } });
    rerender({ left: 3, answered: false });
    rerender({ left: 3, answered: false });
    rerender({ left: 2, answered: false });
    rerender({ left: 1, answered: true });
    expect(sounds.play.mock.calls).toEqual([['arenaTick'], ['arenaTick']]);
  });

  it('plays the reveal sound through the hook and stays silent when game sounds are off', () => {
    const { rerender } = renderHook(({ session }) => useBattleSounds(session, ME, 0, true), { initialProps: { session: battle() } });
    rerender({ session: reveal(0) });
    expect(sounds.play.mock.calls).toEqual([['arenaCorrect']]);
    sounds.enabled = false;
    rerender({ session: battle({ round: 2 }) });
    rerender({ session: reveal(1, 2) });
    expect(sounds.play.mock.calls).toEqual([['arenaCorrect']]);
  });
});
