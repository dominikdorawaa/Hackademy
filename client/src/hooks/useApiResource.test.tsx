import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ApiResponse } from '../services/http';
import { useApiResource } from './useApiResource';

type Loader = (signal: AbortSignal) => Promise<ApiResponse<{ name: string }>>;
const reply = (body: BodyInit | null, init: ResponseInit) => async () => new Response(body, init) as ApiResponse<{ name: string }>;

describe('useApiResource', () => {
  it('shows when to try again after a rate limit and waits for a manual retry', async () => {
    const onUnauthorized = vi.fn();
    const load = vi.fn<Loader>()
      .mockImplementationOnce(reply(JSON.stringify({ message: 'Zbyt wiele żądań.', retryAfter: 6 }), { status: 429, headers: { 'Retry-After': '60' } }))
      .mockImplementationOnce(reply(JSON.stringify({ name: 'alice' }), { status: 200 }));
    const { result } = renderHook(() => useApiResource(load, onUnauthorized));
    await waitFor(() => expect(result.current.error).toBe('Zbyt wiele żądań. Spróbuj ponownie za 6 s.'));
    expect(result.current).toMatchObject({ data: null, loading: false });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(load).toHaveBeenCalledOnce();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.data).toEqual({ name: 'alice' }));
    expect(load).toHaveBeenCalledTimes(2);
  });
  it('uses the header or a default wait when the body has no time', async () => {
    const headerLoad = reply('busy', { status: 429, headers: { 'Retry-After': '14' } });
    const fallbackLoad = reply(null, { status: 429 });
    const ignore = vi.fn();
    const header = renderHook(() => useApiResource(headerLoad, ignore));
    await waitFor(() => expect(header.result.current.error).toBe('Zbyt wiele żądań. Spróbuj ponownie za 14 s.'));
    const fallback = renderHook(() => useApiResource(fallbackLoad, ignore));
    await waitFor(() => expect(fallback.result.current.error).toBe('Zbyt wiele żądań. Spróbuj ponownie za 30 s.'));
  });
  it.each([401, 403])('still treats %s as an expired session', async status => {
    const onUnauthorized = vi.fn();
    const load = reply(null, { status });
    renderHook(() => useApiResource(load, onUnauthorized));
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce());
  });
  it.each([[404, 'Nie znaleziono użytkownika.'], [500, 'Nie udało się pobrać danych.']])('keeps the message for %s', async (status, message) => {
    const load = reply(null, { status });
    const ignore = vi.fn();
    const { result } = renderHook(() => useApiResource(load, ignore));
    await waitFor(() => expect(result.current.error).toBe(message));
  });
  it('reports a connection failure', async () => {
    const load = async () => { throw new TypeError('Failed to fetch'); };
    const ignore = vi.fn();
    const { result } = renderHook(() => useApiResource(load, ignore));
    await waitFor(() => expect(result.current.error).toBe('Nie udało się połączyć z serwerem.'));
  });
  it('ignores a rate limit that arrives after the component is gone', async () => {
    let release!: (response: Response) => void;
    const load = vi.fn<Loader>(() => new Promise(resolve => { release = response => resolve(response as ApiResponse<{ name: string }>); }));
    const ignore = vi.fn();
    const { result, unmount } = renderHook(() => useApiResource(load, ignore));
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    unmount();
    release(new Response(null, { status: 429 }));
    await Promise.resolve();
    expect(result.current.error).toBeNull();
  });
});
