import { describe, expect, it } from 'vitest';
import { createGameSession } from '../../../test/fixtures/arena';
import { eloChange, fighterFrames, finishText, outcome, outcomeTitle, perspective, roundSummary, secondsLeft } from './battleView';
import type { RoundResult } from '../../../types/api';

const result = (damage: Record<string, number>): RoundResult => ({
  round: 1, questionId: 11, content: 'Pytanie', answers: ['A', 'B', 'C', 'D'], correctAnswer: 1, choices: { 1: 1, 2: 3 }, damage,
});

describe('battle view', () => {
  it('puts the current player on the left and uses the default look without a saved avatar', () => {
    const session = createGameSession({
      hp: { 1: 60, 2: 80 }, player1Avatar: { outfit: 'dres', hair: 'kucyk', hat: 'brak', skin: 'jasna', hairColor: 'rude', topColor: 'bialy', bottomColor: 'granatowy', shoesColor: 'czerwony', hatColor: 'bialy' },
      player2Elo: null,
    });
    const { me, rival } = perspective(session, 2);
    expect(me).toMatchObject({ id: 2, username: 'opponent', hp: 80, elo: 500 });
    expect(me.look.outfit).toBe('baza');
    expect(rival).toMatchObject({ id: 1, hp: 60 });
    expect(rival.look.outfit).toBe('dres');
    expect(perspective(createGameSession({ hp: {} }), 1).me.hp).toBe(100);
  });

  it('describes wins, losses and draws with their reasons and Elo', () => {
    const won = createGameSession({ status: 'FINISHED', winnerId: 1, finishReason: 'KNOCKOUT', player1EloChange: 16, player2EloChange: -16 });
    expect(outcome(won, 1)).toBe('win');
    expect(outcome(won, 2)).toBe('loss');
    expect(outcomeTitle('win')).toBe('Zwycięstwo');
    expect(outcomeTitle('loss')).toBe('Porażka');
    expect(outcomeTitle('draw')).toBe('Remis');
    expect(eloChange(won, 1)).toBe(16);
    expect(eloChange(won, 2)).toBe(-16);
    expect(finishText(won, 1)).toBe('Rywal padł po Twoim ciosie.');
    expect(finishText(won, 2)).toBe('Twój awatar został znokautowany.');
    expect(finishText({ ...won, finishReason: 'SURRENDER' }, 1)).toBe('Rywal się poddał.');
    expect(finishText({ ...won, finishReason: 'SURRENDER' }, 2)).toBe('Poddałeś walkę.');
    expect(finishText({ ...won, finishReason: 'DISCONNECT' }, 1)).toContain('Rywal stracił połączenie');
    expect(finishText({ ...won, finishReason: 'DISCONNECT' }, 2)).toContain('Straciłeś połączenie');
    expect(finishText({ ...won, finishReason: 'ROUNDS' }, 1)).toBe('Po 10 rundach masz więcej HP.');
    expect(finishText({ ...won, finishReason: 'ROUNDS' }, 2)).toBe('Po 10 rundach rywal ma więcej HP.');
    const draw = createGameSession({ status: 'FINISHED', winnerId: null, finishReason: 'ROUNDS' });
    expect(outcome(draw, 1)).toBe('draw');
    expect(finishText(draw, 1)).toContain('tyle samo HP');
    expect(eloChange(draw, 1)).toBe(0);
  });

  it('summarises who hit in a round', () => {
    expect(roundSummary(result({ 1: 20, 2: 20 }), 1, 2)).toBe('Oboje trafiliście. Każdy traci 20 HP.');
    expect(roundSummary(result({ 1: 0, 2: 20 }), 1, 2)).toBe('Trafiasz! Rywal traci 20 HP.');
    expect(roundSummary(result({ 1: 20, 2: 0 }), 1, 2)).toBe('Rywal trafia. Tracisz 20 HP.');
    expect(roundSummary(result({}), 1, 2)).toBe('Nikt nie trafił w tej rundzie.');
  });

  it('animates attacks and hits during the reveal and dances or falls at the end', () => {
    const reveal = createGameSession({ phase: 'REVEAL', lastRound: result({ 1: 20, 2: 20 }) });
    const both = fighterFrames(reveal, 1, 2);
    expect(both.loop).toBe(false);
    expect(both.frames).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 37, 38, 39, 40, 0]);
    expect(fighterFrames({ ...reveal, lastRound: result({}) }, 1, 2)).toEqual({ frames: [0], loop: true });
    expect(fighterFrames(createGameSession(), 1, 2)).toEqual({ frames: [0], loop: true });
    const finished = createGameSession({ status: 'FINISHED', winnerId: 1 });
    expect(fighterFrames(finished, 1, 2)).toMatchObject({ loop: true, frames: expect.arrayContaining([55, 64]) });
    expect(fighterFrames(finished, 2, 1)).toEqual({ frames: [46, 47, 48, 49, 50, 51, 52, 53], loop: false });
    expect(fighterFrames({ ...finished, winnerId: null }, 1, 2)).toEqual({ frames: [0], loop: true });
  });

  it('counts down against the server clock', () => {
    expect(secondsLeft(16_000, 1_000, 5_000, 5_000)).toBe(15);
    expect(secondsLeft(16_000, 1_000, 5_000, 10_500)).toBe(10);
    expect(secondsLeft(16_000, 1_000, 5_000, 30_000)).toBe(0);
  });
});
