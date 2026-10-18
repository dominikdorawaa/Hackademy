import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { server } from '../test/mocks/server';
import { useRoomReturn } from './useRoomReturn';

describe('useRoomReturn', () => {
  it('falls back to learning when the path cannot be loaded', async () => {
    server.use(http.get(`${API_URL}/api/paths/3`, () => HttpResponse.error()));
    const { result } = renderHook(() => useRoomReturn('7', '?pathId=3', 'token'));
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(result.current).toEqual({ to: '/learn', label: 'Wróć do nauki', pending: false });
  });

  it('checks the path again for a different session', async () => {
    let calls = 0;
    server.use(http.get(`${API_URL}/api/paths/3`, () => { calls++; return HttpResponse.json({ message: 'brak' }, { status: 404 }); }));
    const { result, rerender } = renderHook(({ token }) => useRoomReturn('7', '?pathId=3', token), { initialProps: { token: 'a' } });
    await waitFor(() => expect(result.current.pending).toBe(false));
    rerender({ token: 'b' });
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(calls).toBe(2);
  });
});
