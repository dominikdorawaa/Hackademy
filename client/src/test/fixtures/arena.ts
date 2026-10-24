import type { GameSession } from '../../types/api';

export function createGameSession(overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: 'game',
    player1Id: 1,
    player1Username: 'tester',
    player1Elo: 500,
    player2Id: 2,
    player2Username: 'opponent',
    player2Elo: 500,
    startTime: '2026-10-11T12:00:00',
    status: 'ACTIVE',
    winnerId: null,
    finishReason: null,
    player1EloChange: null,
    player2EloChange: null,
    round: 1,
    totalRounds: 10,
    phase: 'QUESTION',
    roundEndsAt: 1_015_000,
    nextRoundAt: 0,
    serverTime: 1_000_000,
    hp: { 1: 100, 2: 100 },
    answeredBy: [],
    question: { id: 11, content: 'Na którym porcie domyślnie działa SSH?', category: 'SIECI', difficulty: 'VERY_EASY', answers: ['21', '22', '23', '25'] },
    lastRound: null,
    reactions: [],
    ...overrides,
  };
}
