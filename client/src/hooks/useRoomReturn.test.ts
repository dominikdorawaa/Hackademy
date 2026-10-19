import { registerSession } from '../services/http';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { useRoomReturn } from './useRoomReturn';

beforeEach(() => { registerSession({ sessionKey: 'sessionKey', getToken: async () => 'session-token', expired: () => {} }); });

describe('useRoomReturn', () => {
  it('falls back to learning when the path cannot be loaded', async () => {
    server.use(http.get(`${API_URL}/api/paths/3`, () => HttpResponse.error()));
    const { result } = renderHook(() => useRoomReturn('7', '?pathId=3', 'sessionKey'));
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current).toEqual({ to: '/learn', label: 'Wróć do nauki', pending: false });
  });

  it('checks the path again for a different session', async () => {
    let calls = 0;
    server.use(http.get(`${API_URL}/api/paths/3`, () => { calls++; return HttpResponse.json({ message: 'brak' }, { status: 404 }); }));
    const { result, rerender } = renderHook(({ sessionKey }) => useRoomReturn('7', '?pathId=3', sessionKey), { initialProps: { sessionKey: 'sessionKey' } });
    await waitFor(() => expect(result.current.pending).toBe(false));
    registerSession({ sessionKey: 'b', getToken: async () => 'b', expired: () => {} });
    rerender({ sessionKey: 'b' });
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(calls).toBe(2);
  });
});
