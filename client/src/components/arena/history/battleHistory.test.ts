import { describe, expect, it } from 'vitest';
import type { ArenaMatchDetail } from '../../../types/api';
import { correctCount, finishLine, formatAnswerTime, formatBattleDate, formatDuration, leagueNote, resultLabel, resultTone } from './battleHistory';

const detail = (overrides: Partial<ArenaMatchDetail> = {}, result: 'WIN' | 'LOSS' | 'DRAW' = 'LOSS'): ArenaMatchDetail => ({
  summary: { id: 1, opponentName: 'nullbyte', result, eloChange: -14, finishedAt: '2026-11-18T21:14:00' },
  finishReason: 'ROUNDS',
  rounds: [],
  ...overrides,
});

describe('battle history labels', () => {
  it('names the result and its colour', () => {
    expect(resultLabel('WIN')).toBe('Wygrana');
    expect(resultLabel('LOSS')).toBe('Przegrana');
    expect(resultLabel('DRAW')).toBe('Remis');
    expect(resultTone('LOSS')).toBe('loss');
  });

  it('dates a battle relative to today', () => {
    const now = new Date(2026, 10, 19, 12, 0);
    expect(formatBattleDate('2026-11-19T09:05:00', now)).toBe('dziś, 9:05');
    expect(formatBattleDate('2026-11-18T21:14:00', now)).toBe('wczoraj, 21:14');
    expect(formatBattleDate('2026-11-02T08:30:00', now)).toBe('2 listopada, 8:30');
    expect(formatBattleDate('2025-12-31T23:59:00', now)).toBe('31 grudnia 2025, 23:59');
    expect(formatBattleDate('nie data', now)).toBe('');
  });

  it('formats answer times and the length of the battle', () => {
    expect(formatAnswerTime(2_840)).toBe('2,8 s');
    expect(formatAnswerTime(11_200)).toBe('11,2 s');
    expect(formatDuration(220)).toBe('3 min 40 s');
    expect(formatDuration(120)).toBe('2 min');
    expect(formatDuration(45)).toBe('45 s');
  });

  it('explains how the battle ended from the player side', () => {
    const played = Array.from({ length: 7 }, (_, index) => ({ round: index + 1, content: 'q', category: 'WEB', answers: ['a', 'b', 'c', 'd'], correctAnswer: 0, choice: 0, answerMillis: 1, opponentChoice: 0, opponentAnswerMillis: 1, hpAfter: 1, opponentHpAfter: 1 }));
    expect(finishLine(detail({ rounds: played }))).toBe('koniec po 7 rundach, rywal ma więcej HP');
    expect(finishLine(detail({}, 'DRAW'))).toBe('koniec rund, tyle samo HP');
    expect(finishLine(detail({ finishReason: 'KNOCKOUT', rounds: played }, 'WIN'))).toBe('nokaut w 7. rundzie');
    expect(finishLine(detail({ finishReason: 'SURRENDER' }, 'WIN'))).toBe('rywal się poddał');
    expect(finishLine(detail({ finishReason: 'DISCONNECT' }))).toBe('nieobecność przez 30 sekund');
    expect(finishLine(detail({ finishReason: null }))).toBeNull();
  });

  it('counts correct answers for each side', () => {
    const round = { round: 1, content: 'q', category: 'WEB', answers: ['a', 'b', 'c', 'd'], hpAfter: 100, opponentHpAfter: 100, answerMillis: null, opponentAnswerMillis: null };
    const rounds = [
      { ...round, correctAnswer: 1, choice: 1, opponentChoice: 0 },
      { ...round, correctAnswer: 2, choice: null, opponentChoice: 2 },
      { ...round, correctAnswer: 0, choice: 0, opponentChoice: 0 },
    ];
    expect(correctCount(rounds, 'me')).toBe(2);
    expect(correctCount(rounds, 'opponent')).toBe(2);
  });

  it('says how far the next league is or which league the battle changed', () => {
    expect(leagueNote(1198, -14)).toMatchObject({ kind: 'gap', text: 'Do ligi Zero-day brakuje Ci teraz 16 Elo. Przed bitwą brakowało 2 Elo.' });
    expect(leagueNote(1190, 16)).toMatchObject({ kind: 'up', text: 'Awans do ligi Zero-day.' });
    expect(leagueNote(1005, -12)).toMatchObject({ kind: 'down', text: 'Spadek do ligi Exploit.' });
    expect(leagueNote(1300, 10)).toMatchObject({ kind: 'top' });
    expect(leagueNote(700, 0).text).toBe('Do ligi Exploit brakuje Ci teraz 100 Elo.');
  });
});
