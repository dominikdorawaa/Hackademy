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
    expect(result.current).toEqual({ to: '/learn', label: 'Wróć do nauki', title: 'Nauka', pending: false });
  });

  it('names the path and points to the next room in chapter order', async () => {
    const room = (id: number, title: string) => ({ id, title });
    server.use(http.get(`${API_URL}/api/paths/3`, () => HttpResponse.json({
      id: 3, title: 'Linux', rooms: [room(9, 'Bez rozdziału')],
      chapters: [{ id: 1, rooms: [room(7, 'Terminal')] }, { id: 2, rooms: [room(8, 'Flaga'), room(9, 'Bez rozdziału')] }],
    })));
    const { result, rerender } = renderHook(({ id }) => useRoomReturn(id, '?pathId=3', 'sessionKey'), { initialProps: { id: '7' } });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current).toEqual({
      to: '/learn/paths/3', label: 'Wróć do ścieżki: Linux', title: 'Linux', pending: false,
      next: { to: '/rooms/8?pathId=3', title: 'Flaga' },
    });
    rerender({ id: '9' });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current.next).toBeNull();
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
