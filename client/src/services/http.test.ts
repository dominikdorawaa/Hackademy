import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSession, request, sessionToken } from './http';
import { onRateLimit } from './rateLimit';

const transport = vi.fn<typeof fetch>();
const expired = vi.fn();
let unregister: () => void;
const auth = { sessionKey: 'session-a' };

beforeEach(() => {
  expired.mockReset();
  transport.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', transport);
  unregister = registerSession({ ...auth, getToken: async () => 'fresh-token', expired });
});
afterEach(() => unregister());

describe('Clerk API transport', () => {
  it('gets a new token for each request and excludes cookies', async () => {
    const getToken = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    unregister();
    unregister = registerSession({ ...auth, getToken, expired });
    await request('/api/user/me', { auth });
    await request('/api/user/me', { auth });
    expect(transport.mock.calls.map(([, options]) => new Headers(options?.headers).get('Authorization'))).toEqual(['Bearer first', 'Bearer second']);
    expect(transport.mock.calls[0][1]).toMatchObject({ credentials: 'omit', redirect: 'error' });
  });
  it('does not send credentials on public requests', async () => {
    await request('/api/user/ranking', { headers: { Authorization: 'Bearer old-token' } });
    expect(new Headers(transport.mock.calls[0][1]?.headers).has('Authorization')).toBe(false);
  });
  it('refreshes once after 401 and expires only if the refreshed token is rejected', async () => {
    const getToken = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');
    unregister();
    unregister = registerSession({ ...auth, getToken, expired });
    transport.mockResolvedValue(new Response(null, { status: 401 }));
    const response = await request('/api/user/me', { auth });
    expect(response.status).toBe(401);
    expect(getToken.mock.calls).toEqual([[{ skipCache: false }], [{ skipCache: true }]]);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledOnce();
  });
  it('keeps the session after successful refresh or a forbidden response', async () => {
    transport.mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect((await request('/api/user/me', { auth })).status).toBe(200);
    transport.mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect((await request('/api/admin/users', { auth })).status).toBe(403);
    expect(expired).not.toHaveBeenCalled();
  });
  it.each([null, new Error('refresh failed')])('expires when Clerk cannot provide a token: %s', async result => {
    unregister();
    unregister = registerSession({ ...auth, getToken: async () => { if (result instanceof Error) throw result; return result; }, expired });
    await expect(request('/api/user/me', { auth })).rejects.toThrow();
    expect(expired).toHaveBeenCalledOnce();
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects stale account scopes before requesting a token', async () => {
    await expect(request('/api/user/me', { auth: { sessionKey: 'old-session' } })).rejects.toThrow();
    expect(expired).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
  });
  it('does not send an old action with the next account credentials', async () => {
    let release!: (token: string) => void;
    unregister();
    unregister = registerSession({ ...auth, getToken: () => new Promise(resolve => { release = resolve; }), expired });
    const pending = request('/api/user/me/profile', { method: 'PATCH', body: '{}', auth });
    unregister();
    unregister = registerSession({ sessionKey: 'session-b', getToken: async () => 'other-token', expired });
    release('old-token');
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('discards an old response after switching accounts', async () => {
    let release!: (response: Response) => void;
    transport.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const pending = request('/api/user/me', { auth });
    await vi.waitFor(() => expect(transport).toHaveBeenCalledOnce());
    unregister();
    unregister = registerSession({ sessionKey: 'session-b', getToken: async () => 'other-token', expired });
    release(new Response(null, { status: 401 }));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(expired).not.toHaveBeenCalled();
  });
  it('stops aborted calls before fetching', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(request('/api/user/me', { auth, signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['https://outside.example/api/user/me', '/outside', '//outside.example/api/user/me'])('rejects credential destinations outside the API: %s', async path => {
    await expect(request(path, { auth })).rejects.toThrow('Nieprawidłowy adres API.');
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])('keeps the session and does not repeat a rate limited %s request', async method => {
    const limits = vi.fn();
    const stop = onRateLimit(limits);
    transport.mockResolvedValue(Response.json({ message: 'Zbyt wiele żądań. Spróbuj ponownie za 9 s.', retryAfter: 9 }, { status: 429, headers: { 'Retry-After': '9' } }));
    const response = await request('/api/user/me', { method, auth, body: method === 'GET' ? undefined : '{}' });
    stop();
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ retryAfter: 9 });
    expect(transport).toHaveBeenCalledOnce();
    expect(expired).not.toHaveBeenCalled();
    expect(limits.mock.calls).toEqual([[9]]);
  });
  it('lets a caller show its own rate limit message instead of the shared notice', async () => {
    const limits = vi.fn();
    const stop = onRateLimit(limits);
    transport.mockResolvedValue(new Response(null, { status: 429, headers: { 'Retry-After': '3' } }));
    await request('/api/arena/game/1/reaction', { method: 'POST', auth, rateLimitNotice: false });
    await request('/api/user/ranking');
    stop();
    expect(limits.mock.calls).toEqual([[3]]);
  });
  it('retains the newer registration when older cleanup runs', async () => {
    const newer = registerSession({ ...auth, getToken: async () => 'newer', expired });
    unregister();
    expect(await sessionToken(auth)).toBe('newer');
    newer();
    await expect(sessionToken(auth)).rejects.toThrow();
  });
});
