import { registerSession } from '../services/http';
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { LEAVE_DELAY_MS, RETRY_MS, useBattlePresence } from './useBattlePresence';

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
  await waitFor(() => expect(of('b')).toEqual(['return:b']));
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

it('retries a failed return without a remount until the server has it', async () => {
  let returns = 0;
  server.use(http.post(`${API_URL}/api/arena/game/:id/return`, ({ params }) => {
    if (params.id === 'f') returns += 1;
    if (params.id === 'f' && returns === 2) { calls.push(`return-failed:${params.id}`); return HttpResponse.error(); }
    calls.push(`return:${params.id}`);
    return new HttpResponse(null, { status: 204 });
  }));
  const first = renderHook(() => useBattlePresence('f', 'sessionKey'));
  await waitFor(() => expect(of('f')).toEqual(['return:f']));
  first.unmount();
  await waitFor(() => expect(of('f')).toEqual(['return:f', 'leave:f']));
  renderHook(() => useBattlePresence('f', 'sessionKey'));
  await waitFor(() => expect(of('f')).toEqual(['return:f', 'leave:f', 'return-failed:f']));
  await waitFor(() => expect(of('f')).toEqual(['return:f', 'leave:f', 'return-failed:f', 'return:f']), { timeout: RETRY_MS * 3 });
});

it('retries a failed leave and stops once the server answers', async () => {
  let leaves = 0;
  server.use(http.post(`${API_URL}/api/arena/game/:id/leave`, ({ params }) => {
    if (params.id !== 'g') return new HttpResponse(null, { status: 204 });
    leaves += 1;
    calls.push(`leave-${leaves === 1 ? 'failed' : 'refused'}:${params.id}`);
    return leaves === 1 ? new HttpResponse(null, { status: 503 }) : new HttpResponse(null, { status: 404 });
  }));
  const first = renderHook(() => useBattlePresence('g', 'sessionKey'));
  await waitFor(() => expect(of('g')).toEqual(['return:g']));
  first.unmount();
  await waitFor(() => expect(of('g')).toEqual(['return:g', 'leave-failed:g', 'leave-refused:g']), { timeout: RETRY_MS * 3 });
  await new Promise(resolve => setTimeout(resolve, RETRY_MS + 200));
  expect(of('g')).toEqual(['return:g', 'leave-failed:g', 'leave-refused:g']);
});

it('retries a rate limited return and leave after the server says to', async () => {
  const limited = new Set<string>();
  const limit = (kind: string) => ({ params }: { params: Record<string, string | readonly string[]> }) => {
    if (params.id !== 'h') return new HttpResponse(null, { status: 204 });
    if (!limited.has(kind)) {
      limited.add(kind);
      calls.push(`${kind}-limited:h`);
      return HttpResponse.json({ message: 'Za dużo żądań' }, { status: 429, headers: { 'Retry-After': '1' } });
    }
    calls.push(`${kind}:h`);
    return new HttpResponse(null, { status: 204 });
  };
  server.use(
    http.post(`${API_URL}/api/arena/game/:id/return`, limit('return')),
    http.post(`${API_URL}/api/arena/game/:id/leave`, limit('leave')),
  );
  const first = renderHook(() => useBattlePresence('h', 'sessionKey'));
  await waitFor(() => expect(of('h')).toEqual(['return-limited:h']));
  await waitFor(() => expect(of('h')).toEqual(['return-limited:h', 'return:h']), { timeout: RETRY_MS * 3 });
  first.unmount();
  await waitFor(() => expect(of('h')).toEqual(['return-limited:h', 'return:h', 'leave-limited:h']));
  await waitFor(() => expect(of('h')).toEqual(['return-limited:h', 'return:h', 'leave-limited:h', 'leave:h']), { timeout: RETRY_MS * 3 });
});

it('retries a request timeout', async () => {
  let timedOut = false;
  server.use(http.post(`${API_URL}/api/arena/game/:id/return`, ({ params }) => {
    if (params.id !== 'i') return new HttpResponse(null, { status: 204 });
    calls.push(`return-${timedOut ? 'ok' : 'timeout'}:i`);
    if (timedOut) return new HttpResponse(null, { status: 204 });
    timedOut = true;
    return new HttpResponse(null, { status: 408 });
  }));
  renderHook(() => useBattlePresence('i', 'sessionKey'));
  await waitFor(() => expect(of('i')).toEqual(['return-timeout:i', 'return-ok:i']), { timeout: RETRY_MS * 3 });
});

it('sends the newest view instead of retrying a stale one', async () => {
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
