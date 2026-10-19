import { registerSession } from '../services/http';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { useArenaSession } from './useArenaSession';
import { server } from '../test/mocks/server';
import API_URL from '../apiConfig';
import type { GameSession } from '../types/api';
import { createGameSession } from '../test/fixtures/arena';

const game = (id = 'a', status: GameSession['status'] = 'ACTIVE'): GameSession => createGameSession({ id, status });

beforeEach(() => { registerSession({ sessionKey: 'sessionKey', getToken: async () => 'session-token', expired: () => {} }); });

describe('displayed arena game', () => {
  it('retains the finished battle when realtime moves to a newer match', async () => {
    server.use(http.get(`${API_URL}/api/arena/game/a`, () => HttpResponse.json(game())));
    const { result, rerender } = renderHook(({ live }) => useArenaSession('a', 'sessionKey', live),
      { initialProps: { live: game() } });
    const finished = { ...game('a', 'FINISHED'), winnerId: 1, finishReason: 'KNOCKOUT' as const, hp: { 1: 60, 2: 0 } };
    rerender({ live: finished });
    rerender({ live: game('b') });
    await waitFor(() => expect(result.current.session).toEqual(finished));
    rerender({ live: game('c') });
    expect(result.current.session).toEqual(finished);
  });

  it('never overwrites live state with a delayed initial HTTP snapshot', async () => {
    let release: (() => void) | undefined;
    server.use(http.get(`${API_URL}/api/arena/game/a`, async () => {
      await new Promise<void>(resolve => { release = resolve; });
      return HttpResponse.json(game());
    }));
    const { result, rerender } = renderHook(({ live }) => useArenaSession('a', 'sessionKey', live),
      { initialProps: { live: game() } });
    await waitFor(() => expect(release).toBeDefined());
    const finished = game('a', 'FINISHED');
    rerender({ live: finished });
    rerender({ live: game('b') });
    await act(async () => release?.());
    expect(result.current.session).toEqual(finished);
  });

  it('loads historical games and hides data from the previous account', async () => {
    server.use(http.get(`${API_URL}/api/arena/game/a`, () => HttpResponse.json(game('a', 'FINISHED'))));
    const { result, rerender } = renderHook(({ sessionKey }) => useArenaSession('a', sessionKey, null),
      { initialProps: { sessionKey: 'sessionKey' as string | null } });
    await waitFor(() => expect(result.current.session?.status).toBe('FINISHED'));
    rerender({ sessionKey: null });
    expect(result.current.session).toBeNull();
    registerSession({ sessionKey: 'second', getToken: async () => 'second', expired: () => {} });
    rerender({ sessionKey: 'second' });
    expect(result.current.session).toBeNull();
    await waitFor(() => expect(result.current.session?.status).toBe('FINISHED'));
  });

  it('reports a missing game instead of waiting forever', async () => {
    server.use(http.get(`${API_URL}/api/arena/game/a`, () => HttpResponse.json({ message: 'brak' }, { status: 404 })));
    const { result } = renderHook(() => useArenaSession('a', 'sessionKey', null));
    await waitFor(() => expect(result.current).toEqual({ session: null, missing: true }));
  });

  it('notices a game that disappeared while the player was reconnecting', async () => {
    let status = 200;
    server.use(http.get(`${API_URL}/api/arena/game/a`, () => status === 200
      ? HttpResponse.json(game()) : HttpResponse.json({ message: 'brak' }, { status })));
    const { result, rerender } = renderHook(({ live }) => useArenaSession('a', 'sessionKey', live),
      { initialProps: { live: game() as GameSession | null } });
    expect(result.current).toEqual({ session: game(), missing: false });
    status = 404;
    rerender({ live: null });
    await waitFor(() => expect(result.current.missing).toBe(true));
    expect(result.current.session).toBeNull();
    rerender({ live: game() });
    expect(result.current).toEqual({ session: game(), missing: false });
  });

  it('shows the game again when the server finds it after a miss', async () => {
    let status = 404;
    server.use(http.get(`${API_URL}/api/arena/game/a`, () => status === 200
      ? HttpResponse.json(game('a', 'FINISHED')) : HttpResponse.json({ message: 'brak' }, { status })));
    const { result, rerender } = renderHook(({ sessionKey }) => useArenaSession('a', sessionKey, null),
      { initialProps: { sessionKey: 'sessionKey' } });
    await waitFor(() => expect(result.current.missing).toBe(true));
    status = 200;
    registerSession({ sessionKey: 'second', getToken: async () => 'second', expired: () => {} });
    rerender({ sessionKey: 'second' });
    await waitFor(() => expect(result.current.session?.status).toBe('FINISHED'));
    expect(result.current.missing).toBe(false);
  });

  it('keeps the last state when the server is temporarily unavailable', async () => {
    server.use(http.get(`${API_URL}/api/arena/game/a`, () => HttpResponse.json({ message: 'awaria' }, { status: 503 })));
    const { result, rerender } = renderHook(({ live }) => useArenaSession('a', 'sessionKey', live),
      { initialProps: { live: game() as GameSession | null } });
    rerender({ live: null });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(result.current).toEqual({ session: game(), missing: false });
  });
});
