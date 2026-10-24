import { describe, expect, it } from 'vitest';
import { createGameSession } from '../../../test/fixtures/arena';
import {
  absenceNotice, animatedRound, CAST_MS, choreography, eloChange, finisher, FINISHER_FRAME_MS, FINISHERS, finishText, frozenSecondsLeft, IMPACT_MS, impactAt, outcome, outcomeTitle,
  pauseNotice, perspective, roundSummary, secondsLeft,
} from './battleView';
import { danceFrames, turnedDance, victoryDance } from '../avatar/fighters';
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
    expect(finishText({ ...won, finishReason: 'DISCONNECT' }, 1)).toBe('Rywal był nieobecny przez 30 sekund.');
    expect(finishText({ ...won, finishReason: 'DISCONNECT' }, 2)).toBe('Byłeś nieobecny przez 30 sekund.');
    expect(finishText({ ...won, finishReason: 'ROUNDS' }, 1)).toBe('Po 10 rundach masz więcej HP.');
    expect(finishText({ ...won, finishReason: 'ROUNDS' }, 2)).toBe('Po 10 rundach rywal ma więcej HP.');
    const draw = createGameSession({ status: 'FINISHED', winnerId: null, finishReason: 'ROUNDS' });
    expect(outcome(draw, 1)).toBe('draw');
    expect(finishText(draw, 1)).toContain('tyle samo HP');
    const cancelled = createGameSession({ status: 'FINISHED', winnerId: null, finishReason: 'CANCELLED', player1EloChange: 0, player2EloChange: 0 });
    expect(outcome(cancelled, 1)).toBe('cancelled');
    expect(outcomeTitle('cancelled')).toBe('Mecz anulowany');
    expect(finishText(cancelled, 2)).toBe('Serwer został zrestartowany w trakcie walki, więc mecz anulowano. Elo się nie zmienia.');
    expect(eloChange(cancelled, 1)).toBe(0);
    const abandoned = createGameSession({ status: 'FINISHED', winnerId: null, finishReason: 'ABANDONED', player1EloChange: 0, player2EloChange: 0 });
    expect(outcome(abandoned, 1)).toBe('cancelled');
    expect(finishText(abandoned, 1)).toBe('Oboje byliście nieobecni przez 30 sekund, więc mecz anulowano. Elo się nie zmienia.');
    expect(eloChange(draw, 1)).toBe(0);
  });

  it('explains the pause, its time left and who still has one', () => {
    const paused = createGameSession({
      pause: { players: [2], startedAt: 1_005_000, endsAt: 1_015_000 }, pausesUsed: [2],
      absences: { 2: { reason: 'DISCONNECTED', since: 1_005_000 } },
    });
    expect(pauseNotice(paused, 1, 1_008_100)).toEqual({
      reason: 'Rywal stracił połączenie.', secondsLeft: 7, cause: 'rival',
      me: { paused: false, used: false, status: null },
      rival: { paused: true, used: true, status: 'Brak połączenia' },
    });
    expect(pauseNotice(paused, 2, 1_016_000)).toMatchObject({ reason: 'Straciłeś połączenie.', secondsLeft: 0, cause: 'me' });
    expect(pauseNotice(paused, 1, 990_000)?.secondsLeft).toBe(10);
    expect(pauseNotice({ ...paused, pausesUsed: undefined }, 1, 1_008_100)?.rival.used).toBe(false);
    const both = { ...paused, pause: { players: [2, 1], startedAt: 1_005_000, endsAt: 1_015_000 }, pausesUsed: [2, 1],
      absences: { 1: { reason: 'LEFT' as const, since: 1_006_000 } } };
    expect(pauseNotice(both, 1, 1_006_000)).toMatchObject({
      reason: 'Rywal wrócił do walki. Opuściłeś widok walki.', cause: 'both',
      me: { paused: true, used: true, status: 'Poza widokiem walki' }, rival: { paused: true, status: null },
    });
    expect(pauseNotice(both, 2, 1_006_000)?.reason).toBe('Rywal opuścił widok walki. Wróciłeś do walki.');
    expect(pauseNotice(createGameSession(), 1, 1_000_000)).toBeNull();
    expect(pauseNotice({ ...paused, status: 'FINISHED' }, 1, 1_000_000)).toBeNull();
    expect(frozenSecondsLeft(paused, paused.roundEndsAt)).toBe(10);
    expect(frozenSecondsLeft(createGameSession(), 1_015_000)).toBeNull();
  });

  it('warns how long an absent rival has before losing once their pause is used', () => {
    const away = createGameSession({ pausesUsed: [2], absences: { 2: { reason: 'LEFT', since: 990_000 } } });
    expect(absenceNotice(away, 1, 1_000_500)).toBe('Rywal opuścił widok walki. Pauza rywala jest już wykorzystana. Jeśli nie wróci w ciągu 20 s, przegra walkę.');
    expect(absenceNotice(away, 1, 1_030_000)).toContain('w ciągu 0 s');
    expect(absenceNotice(away, 2, 1_000_000)).toBeNull();
    expect(absenceNotice({ ...away, pause: { players: [1], startedAt: 0, endsAt: 1 } }, 1, 1_000_000)).toBeNull();
    expect(absenceNotice({ ...away, status: 'FINISHED' }, 1, 1_000_000)).toBeNull();
    expect(absenceNotice(createGameSession(), 1, 1_000_000)).toBeNull();
  });

  it('summarises who hit in a round', () => {
    expect(roundSummary(result({ 1: 20, 2: 20 }), 1, 2)).toBe('Oboje trafiliście. Tracisz 20 HP, rywal traci 20 HP.');
    expect(roundSummary(result({ 1: 0, 2: 20 }), 1, 2)).toBe('Trafiasz! Rywal traci 20 HP.');
    expect(roundSummary(result({ 1: 20, 2: 0 }), 1, 2)).toBe('Rywal trafia. Tracisz 20 HP.');
    expect(roundSummary(result({}), 1, 2)).toBe('Nikt nie trafił w tej rundzie.');
    expect(roundSummary(result({ 1: 7, 2: 19 }), 1, 2)).toBe('Oboje trafiliście. Tracisz 7 HP, rywal traci 19 HP.');
    expect(roundSummary(result({ 1: 0, 2: 6 }), 1, 2)).toBe('Trafiasz! Rywal traci 6 HP.');
    expect(roundSummary(result({ 1: 3, 2: 0 }), 1, 2)).toBe('Rywal trafia. Tracisz 3 HP.');
  });

  it('casts, waits for the fireball to land and flinches during the reveal', () => {
    const reveal = createGameSession({ phase: 'REVEAL', lastRound: result({ 1: 20, 2: 20 }) });
    const both = choreography(reveal, 1, 2);
    expect(both.map(segment => segment.ms)).toEqual([CAST_MS, IMPACT_MS - CAST_MS, 440, undefined]);
    expect(both[0].frames).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
    expect(both[2].frames).toEqual([37, 38, 39, 40]);
    expect(both[3]).toMatchObject({ frames: [0], loop: true });
    const onlyHurt = choreography({ ...reveal, lastRound: result({ 1: 20, 2: 0 }) }, 1, 2);
    expect(onlyHurt.map(segment => segment.ms)).toEqual([IMPACT_MS, 440, undefined]);
    const onlyAttack = choreography({ ...reveal, lastRound: result({ 1: 0, 2: 20 }) }, 1, 2);
    expect(onlyAttack.map(segment => segment.ms)).toEqual([CAST_MS, undefined]);
    expect(choreography({ ...reveal, lastRound: result({}) }, 1, 2)).toHaveLength(1);
    expect(choreography(createGameSession(), 1, 2)).toEqual([{ frames: [0], loop: true, frameTime: 110 }]);
  });

  it('ends a knockout with a finisher, then a dance for the winner and a fall for the loser', () => {
    const knockout = createGameSession({ status: 'FINISHED', winnerId: 1, finishReason: 'KNOCKOUT', lastRound: result({ 1: 0, 2: 20 }) });
    expect(finisher(knockout)).toEqual({ move: 'beam', winnerId: 1, loserId: 2, start: 0, impact: 900, end: 2100 });
    const winner = choreography(knockout, 1, 2);
    expect(winner[0]).toEqual({ frames: FINISHERS.beam.frames, loop: false, frameTime: FINISHER_FRAME_MS, ms: 2100 });
    expect(FINISHERS.beam.frames.slice(10, 18)).toEqual([30, 31, 31, 31, 31, 31, 31, 32]);
    expect(winner.at(-1)).toMatchObject({ loop: true, frames: expect.arrayContaining([55, 64]) });
    const loser = choreography(knockout, 2, 1);
    expect(loser.at(-1)).toEqual({ frames: [46, 47, 48, 49, 50, 51, 52, 53], loop: false, frameTime: 120 });
    expect(loser.map(segment => segment.ms)).toEqual([900, 440, undefined]);
    expect(impactAt(knockout, 2)).toBe(900);
    expect(finishText(knockout, 1)).toBe('Rywal padł po Twoim ciosie kończącym: Przeciążenie.');
    expect(finishText(knockout, 2)).toBe('Twój awatar padł po ciosie kończącym: Przeciążenie.');
    const surrendered = { ...knockout, finishReason: 'SURRENDER' as const };
    expect(animatedRound(surrendered)).toBeNull();
    expect(choreography(surrendered, 1, 2)).toHaveLength(1);
    expect(choreography({ ...knockout, winnerId: null, finishReason: 'ROUNDS', lastRound: result({}) }, 1, 2))
      .toEqual([{ frames: [0], loop: true, frameTime: 110 }]);
    expect(animatedRound(createGameSession({ phase: 'QUESTION', lastRound: result({ 1: 20 }) }))).toBeNull();
    expect(animatedRound(createGameSession({ phase: 'REVEAL' }))).toBeNull();
  });

  it('lets the loser land a last hit before the finisher and skips finishers without a knockout blow', () => {
    const trade = createGameSession({ id: 'game1', status: 'FINISHED', winnerId: 1, finishReason: 'KNOCKOUT', lastRound: result({ 1: 20, 2: 20 }),
      player1Avatar: { outfit: 'baza', hair: 'brak', hat: 'brak', skin: 'jasna', hairColor: 'czarne', topColor: 'granatowy', bottomColor: 'piaskowy', shoesColor: 'grafitowy', hatColor: 'czerwony', finisher: 'combo' } });
    expect(finisher(trade)).toEqual({ move: 'combo', winnerId: 1, loserId: 2, start: 1340, impact: 2340, end: 3240 });
    expect(choreography(trade, 1, 2).map(segment => segment.ms)).toEqual([IMPACT_MS, 440, 1900, undefined]);
    expect(choreography(trade, 1, 2)[2].frames).toEqual(FINISHERS.combo.frames);
    const loser = choreography(trade, 2, 1);
    expect(loser.map(segment => segment.ms)).toEqual([CAST_MS, 2340 - CAST_MS, 440, undefined]);
    expect(loser[0].frames).toEqual([10, 11, 12, 13, 14, 15, 16, 17]);
    expect(impactAt(trade, 1)).toBe(IMPACT_MS);
    expect(impactAt(trade, 2)).toBe(2340);
    expect(finishText(trade, 2)).toBe('Twój awatar padł po ciosie kończącym: Ctrl+Alt+Del.');
    expect(finisher({ ...trade, winnerId: null })).toBeNull();
    expect(finisher({ ...trade, finishReason: 'ROUNDS' })).toBeNull();
    expect(finisher({ ...trade, lastRound: result({ 1: 20, 2: 0 }) })).toBeNull();
    expect(finisher({ ...trade, lastRound: null })).toBeNull();
    expect(finisher({ ...trade, status: 'ACTIVE' })).toBeNull();
  });

  it('plays the finisher and the victory dance the winner chose, with defaults for older avatars', () => {
    const base = { outfit: 'baza', hair: 'brak', hat: 'brak', skin: 'jasna', hairColor: 'czarne', topColor: 'granatowy', bottomColor: 'piaskowy', shoesColor: 'grafitowy', hatColor: 'czerwony' };
    const won = (avatar: typeof base & { finisher?: string; victoryDance?: string } | null) => createGameSession({ id: 'game1', status: 'FINISHED', winnerId: 1, finishReason: 'KNOCKOUT', lastRound: result({ 1: 0, 2: 20 }), player1Avatar: avatar });
    expect(finisher(won({ ...base, finisher: 'combo' }))?.move).toBe('combo');
    expect(finisher(won({ ...base, finisher: 'beam' }))?.move).toBe('beam');
    expect(finisher(won(base))?.move).toBe('beam');
    expect(finisher(won(null))?.move).toBe('beam');
    expect(choreography(won(base), 1, 2).at(-1)).toEqual({ frames: danceFrames(6), loop: true, frameTime: 110 });
    const scuba = choreography(won({ ...base, victoryDance: 'scuba' }), 1, 2);
    expect(scuba.at(-2)).toEqual({ frames: [145, 146, 147, 148], loop: false, frameTime: 110, ms: 440 });
    expect(scuba.at(-1)).toEqual({ frames: danceFrames(13), loop: true, frameTime: 110 });
    const rounds = createGameSession({ status: 'FINISHED', winnerId: 2, finishReason: 'SURRENDER', lastRound: null, player2Avatar: { ...base, victoryDance: 'sixseven' } });
    expect(choreography(rounds, 2, 1)).toEqual([{ frames: [136, 137, 138, 139], loop: false, frameTime: 110, ms: 440 }, { frames: danceFrames(8), loop: true, frameTime: 110 }]);
    expect(choreography(rounds, 1, 2)).toEqual([{ frames: [46, 47, 48, 49, 50, 51, 52, 53], loop: false, frameTime: 120 }]);
  });

  it('builds the quick chat dances from the same frames as the victory dances', () => {
    expect(turnedDance('groove')).toEqual(victoryDance('groove').loop);
    for (const dance of ['sixseven', 'scuba'] as const) {
      const { turn, loop } = victoryDance(dance);
      expect(turnedDance(dance)).toEqual([...turn, ...loop, ...[...turn].reverse(), turnedDance(dance).at(-1)]);
    }
  });

  it('counts down against the server clock', () => {
    expect(secondsLeft(16_000, 1_000, 5_000, 5_000)).toBe(15);
    expect(secondsLeft(16_000, 1_000, 5_000, 10_500)).toBe(10);
    expect(secondsLeft(16_000, 1_000, 5_000, 30_000)).toBe(0);
  });
});
