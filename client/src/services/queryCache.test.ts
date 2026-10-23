import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cachedRequest, invalidateReads, registerSession, request } from './http';
import { getCurrentUser, getNotificationPreferences } from './userApi';
import { getOnboarding } from './onboardingApi';

const auth = { sessionKey: 'cache-session' };
const transport = vi.fn<typeof fetch>();
let unregister: () => void;

beforeEach(() => {
  transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ value: 1 }), { status: 200 }));
  vi.stubGlobal('fetch', transport);
  unregister = registerSession({ ...auth, getToken: async () => 'token', expired: () => {} });
});
afterEach(() => { unregister(); vi.useRealTimers(); });

it('shares bootstrap across account, onboarding and preference consumers', async () => {
  transport.mockImplementation(async () => new Response(JSON.stringify({ id: 1,
    onboarding: { avatarConfirmed: true }, notificationPreferences: { sound: false } }), { status: 200 }));
  const responses = await Promise.all([getCurrentUser(auth), getOnboarding(auth), getNotificationPreferences(auth)]);
  expect(await responses[0].json()).toMatchObject({ id: 1 });
  expect(await responses[1].json()).toEqual({ avatarConfirmed: true });
  expect(await responses[2].json()).toEqual({ sound: false });
  expect(transport).toHaveBeenCalledOnce();
});

it('deduplicates pending reads and returns separately consumable bodies', async () => {
  const [a, b] = await Promise.all([cachedRequest('/api/data', auth, 1000), cachedRequest('/api/data', auth, 1000)]);
  expect(await a.json()).toEqual({ value: 1 });
  expect(await b.json()).toEqual({ value: 1 });
  expect(transport).toHaveBeenCalledOnce();
});

it('expires reads and invalidates them after successful actions', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(1000);
  await cachedRequest('/api/data', auth, 100);
  vi.mocked(Date.now).mockReturnValue(1101);
  await cachedRequest('/api/data', auth, 100);
  await request('/api/action', { method: 'POST', auth, body: '{}' });
  await cachedRequest('/api/data', auth, 100);
  expect(transport).toHaveBeenCalledTimes(4);
});

it('does not cache errors or reject another consumer when one is cancelled', async () => {
  const controller = new AbortController();
  const cancelled = cachedRequest('/api/data', auth, 100, controller.signal);
  const other = cachedRequest('/api/data', auth, 100);
  controller.abort();
  await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  expect((await other).status).toBe(200);
  invalidateReads();
  transport.mockResolvedValue(new Response(null, { status: 503 }));
  await cachedRequest('/api/data', auth, 100);
  await cachedRequest('/api/data', auth, 100);
  expect(transport).toHaveBeenCalledTimes(3);
});

it('separates accounts and bounds the number of remembered reads', async () => {
  await cachedRequest('/api/data', auth, 1000);
  unregister();
  unregister = registerSession({ sessionKey: 'next', getToken: async () => 'next-token', expired: () => {} });
  await cachedRequest('/api/data', { sessionKey: 'next' }, 1000);
  for (let i = 0; i < 65; i++) await cachedRequest(`/api/data/${i}`, { sessionKey: 'next' }, 1000);
  await cachedRequest('/api/data', { sessionKey: 'next' }, 1000);
  expect(transport).toHaveBeenCalledTimes(68);
});
