import { registerSession } from '../services/http';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { LEAVE_DELAY_MS, useBattlePresence } from './useBattlePresence';

const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  registerSession({ sessionKey: 'sessionKey', getToken: async () => 'session-token', expired: () => {} });
  server.use(
    http.post(`${API_URL}/api/arena/game/:id/return`, ({ params }) => { calls.push(`return:${params.id}`); return new HttpResponse(null, { status: 204 }); }),
    http.post(`${API_URL}/api/arena/game/:id/leave`, ({ params }) => { calls.push(`leave:${params.id}`); return new HttpResponse(null, { status: 204 }); }),
  );
});

afterEach(() => { vi.useRealTimers(); });

it('reports returning to the battle and leaving it after a short delay', async () => {
  const { unmount } = renderHook(() => useBattlePresence('a', 'sessionKey'));
  await waitFor(() => expect(calls).toEqual(['return:a']));
  unmount();
  await waitFor(() => expect(calls).toEqual(['return:a', 'leave:a']));
});

it('ignores a remount of the same battle view', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const first = renderHook(() => useBattlePresence('b', 'sessionKey'));
  first.unmount();
  renderHook(() => useBattlePresence('b', 'sessionKey'));
  vi.advanceTimersByTime(LEAVE_DELAY_MS * 2);
  vi.useRealTimers();
  await waitFor(() => expect(calls).toEqual(['return:b', 'return:b']));
});

it('does nothing without a game or a signed in player', () => {
  renderHook(() => useBattlePresence('', 'sessionKey')).unmount();
  renderHook(() => useBattlePresence('c', null)).unmount();
  expect(calls).toEqual([]);
});
