import { registerSession } from '../services/http';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { LEAVE_DELAY_MS, useBattlePresence } from './useBattlePresence';

const calls: string[] = [];
const of = (id: string) => calls.filter(call => call.endsWith(`:${id}`));

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
  await waitFor(() => expect(of('a')).toEqual(['return:a']));
  unmount();
  await waitFor(() => expect(of('a')).toEqual(['return:a', 'leave:a']));
});

it('ignores a remount of the same battle view', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const first = renderHook(() => useBattlePresence('b', 'sessionKey'));
  first.unmount();
  renderHook(() => useBattlePresence('b', 'sessionKey'));
  vi.advanceTimersByTime(LEAVE_DELAY_MS * 2);
  vi.useRealTimers();
  await waitFor(() => expect(of('b')).toEqual(['return:b', 'return:b']));
});

it('sends a return only after a leave that is still on its way', async () => {
  let release: (() => void) | undefined;
  server.use(http.post(`${API_URL}/api/arena/game/:id/leave`, async ({ params }) => {
    calls.push(`leave-start:${params.id}`);
    await new Promise<void>(resolve => { release = resolve; });
    calls.push(`leave:${params.id}`);
    return new HttpResponse(null, { status: 204 });
  }));
  const first = renderHook(() => useBattlePresence('d', 'sessionKey'));
  await waitFor(() => expect(of('d')).toEqual(['return:d']));
  first.unmount();
  await waitFor(() => expect(of('d')).toEqual(['return:d', 'leave-start:d']));
  renderHook(() => useBattlePresence('d', 'sessionKey'));
  await new Promise(resolve => setTimeout(resolve, 50));
  expect(of('d')).toEqual(['return:d', 'leave-start:d']);
  release?.();
  await waitFor(() => expect(of('d')).toEqual(['return:d', 'leave-start:d', 'leave:d', 'return:d']));
});

it('keeps going after a failed request', async () => {
  server.use(http.post(`${API_URL}/api/arena/game/:id/return`, ({ params }) => {
    calls.push(`return:${params.id}`);
    return HttpResponse.error();
  }));
  const first = renderHook(() => useBattlePresence('e', 'sessionKey'));
  await waitFor(() => expect(of('e')).toEqual(['return:e']));
  first.unmount();
  await waitFor(() => expect(of('e')).toEqual(['return:e', 'leave:e']));
});

it('does nothing without a game or a signed in player', () => {
  renderHook(() => useBattlePresence('', 'sessionKey')).unmount();
  renderHook(() => useBattlePresence('c', null)).unmount();
  expect([...of('c'), ...of('')]).toEqual([]);
});
