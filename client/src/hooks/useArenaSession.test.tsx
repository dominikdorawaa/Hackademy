import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useArenaSession } from './useArenaSession';
import { server } from '../test/mocks/server';
import API_URL from '../apiConfig';
import type { GameSession } from '../types/api';

const game = (id = 'a', status: GameSession['status'] = 'ACTIVE'): GameSession => ({
  id, status, player1Id: 1, player1Username: 'tester', player1Elo: 500,
  player2Id: 2, player2Username: 'opponent', player2Elo: 500, roomId: 7,
  startTime: '2026-10-11T12:00:00', winnerId: null, player1EloChange: null, player2EloChange: null,
  hintsUsed: {}, finishTimes: {}, penaltiesInSeconds: {},
});

describe('displayed arena game', () => {
  it('retains finished state and hints when realtime moves to a newer match', async () => {
    server.use(http.get(`${API_URL}/api/arena/game/a`, () => HttpResponse.json(game())));
    const { result, rerender } = renderHook(({ live }) => useArenaSession('a', 'token', live),
      { initialProps: { live: game() } });
    const finished = { ...game('a', 'FINISHED'), winnerId: 1, hintsUsed: { 1: [9] },
      finishTimes: { 1: '2026-10-11T12:01:00' }, penaltiesInSeconds: { 1: 120 } };
    rerender({ live: finished });
    rerender({ live: game('b') });
    await waitFor(() => expect(result.current).toEqual(finished));
    rerender({ live: game('c') });
    expect(result.current).toEqual(finished);
  });

  it('never overwrites live state with a delayed initial HTTP snapshot', async () => {
    let release: (() => void) | undefined;
    server.use(http.get(`${API_URL}/api/arena/game/a`, async () => {
      await new Promise<void>(resolve => { release = resolve; });
      return HttpResponse.json(game());
    }));
    const { result, rerender } = renderHook(({ live }) => useArenaSession('a', 'token', live),
      { initialProps: { live: game() } });
    await waitFor(() => expect(release).toBeDefined());
    const finished = game('a', 'FINISHED');
    rerender({ live: finished });
    rerender({ live: game('b') });
    await act(async () => release?.());
    expect(result.current).toEqual(finished);
  });

  it('loads historical games and hides data from the previous account', async () => {
    server.use(http.get(`${API_URL}/api/arena/game/a`, () => HttpResponse.json(game('a', 'FINISHED'))));
    const { result, rerender } = renderHook(({ token }) => useArenaSession('a', token, null),
      { initialProps: { token: 'first' as string | null } });
    await waitFor(() => expect(result.current?.status).toBe('FINISHED'));
    rerender({ token: null });
    expect(result.current).toBeNull();
    rerender({ token: 'second' });
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current?.status).toBe('FINISHED'));
  });
});
