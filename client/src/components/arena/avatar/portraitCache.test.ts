import { expect, it, vi } from 'vitest';
import { createPortraitCache } from './portraitCache';

function setup(limit = 2) {
  const revoke = vi.fn();
  vi.stubGlobal('URL', { ...URL, revokeObjectURL: revoke });
  const load = vi.fn(async (key: string) => `blob:${key}`);
  return { cache: createPortraitCache(load, limit), load, revoke };
}

it('shares a portrait and never evicts it until all consumers release it', async () => {
  const { cache, load, revoke } = setup(0);
  const first = cache.acquire('shared');
  const second = cache.acquire('shared');
  expect(await first.promise).toBe('blob:shared');
  expect(await second.promise).toBe('blob:shared');
  expect(load).toHaveBeenCalledTimes(1);
  first.release();
  first.release();
  expect(revoke).not.toHaveBeenCalled();
  second.release();
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:shared');
  const next = cache.acquire('shared');
  await next.promise;
  expect(load).toHaveBeenCalledTimes(2);
  next.release();
});

it('bounds unused portraits and evicts the least recently used without revoking active URLs', async () => {
  const { cache, load, revoke } = setup();
  const active = cache.acquire('active');
  await active.promise;
  for (const key of ['old', 'recent']) {
    const portrait = cache.acquire(key);
    await portrait.promise;
    portrait.release();
  }
  const reused = cache.acquire('old');
  await reused.promise;
  reused.release();
  expect(load).toHaveBeenCalledTimes(3);
  const newest = cache.acquire('new');
  await newest.promise;
  newest.release();
  expect(revoke.mock.calls).toEqual([['blob:recent']]);
  active.release();
  expect(revoke).toHaveBeenCalledWith('blob:active');
  expect(revoke).not.toHaveBeenCalledWith('blob:old');
  expect(revoke).not.toHaveBeenCalledWith('blob:new');
});

it('revokes a URL that finishes loading after its unused entry was evicted', async () => {
  const revoke = vi.fn();
  vi.stubGlobal('URL', { ...URL, revokeObjectURL: revoke });
  let finish!: (url: string) => void;
  const cache = createPortraitCache(() => new Promise<string>(resolve => { finish = resolve; }), 0);
  const portrait = cache.acquire('pending');
  await Promise.resolve();
  portrait.release();
  expect(revoke).not.toHaveBeenCalled();
  finish('blob:late');
  expect(await portrait.promise).toBeNull();
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:late');
});

it('retries failed loads and keeps a replacement entry when an older request fails', async () => {
  const { revoke } = setup();
  let fail!: (error: Error) => void;
  const load = vi.fn().mockImplementationOnce(() => new Promise<string>((_, reject) => { fail = reject; }))
    .mockResolvedValue('blob:retry');
  const cache = createPortraitCache(load, 0);
  const old = cache.acquire('same');
  await Promise.resolve();
  old.release();
  const replacement = cache.acquire('same');
  expect(await replacement.promise).toBe('blob:retry');
  fail(new Error('network'));
  expect(await old.promise).toBeNull();
  const shared = cache.acquire('same');
  expect(await shared.promise).toBe('blob:retry');
  expect(load).toHaveBeenCalledTimes(2);
  replacement.release();
  shared.release();
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:retry');
});

it('removes failed entries so an active consumer can retry on remount', async () => {
  const load = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue('blob:ok');
  const cache = createPortraitCache(load);
  const failed = cache.acquire('retry');
  expect(await failed.promise).toBeNull();
  failed.release();
  const retry = cache.acquire('retry');
  expect(await retry.promise).toBe('blob:ok');
  expect(load).toHaveBeenCalledTimes(2);
  retry.release();
});
