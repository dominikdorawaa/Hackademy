import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AvatarSprite } from './AvatarSprite';
import { DEFAULT_AVATAR, toAvatarConfig } from './avatarModel';
import { useAvatarAtlas, useAvatarPortrait } from './useAvatarAtlas';
import { atlasViewBox } from './fighters';

const RealURL = URL;
let decode: () => Promise<void>;
beforeEach(() => {
  decode = () => Promise.resolve();
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: () => decode() });
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({
    drawImage: vi.fn(), putImageData: vi.fn(),
    getImageData: () => ({ data: new Uint8ClampedArray([0x43, 0x4c, 0x60, 255, 0, 0, 0, 0]) }),
  })) as never);
  Object.defineProperty(HTMLImageElement.prototype, 'width', { configurable: true, get: () => 2 });
  Object.defineProperty(HTMLImageElement.prototype, 'height', { configurable: true, get: () => 1 });
  let counter = 0;
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) { callback(new Blob(['png'])); });
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ center: [0, 0], cells: { 0: { angle: 0, x: 0, y: 0 } } }) })));
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => `blob:avatar-${++counter}`), revokeObjectURL: vi.fn() });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode');
  Reflect.deleteProperty(HTMLImageElement.prototype, 'width');
  Reflect.deleteProperty(HTMLImageElement.prototype, 'height');
});

it('creates a recolored atlas and portrait and releases them when the avatar changes', async () => {
  const { result, rerender, unmount } = renderHook(({ avatar }) => useAvatarAtlas(avatar), { initialProps: { avatar: DEFAULT_AVATAR } });
  await waitFor(() => expect(result.current).toEqual({ atlas: expect.stringMatching(/^blob:/), front: expect.stringMatching(/^blob:/) }));
  const first = result.current!;
  rerender({ avatar: { ...DEFAULT_AVATAR, colors: { ...DEFAULT_AVATAR.colors, top: 'czerwony' } } });
  expect(result.current).toBeNull();
  await waitFor(() => expect(result.current?.atlas).not.toBe(first.atlas));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(first.atlas);
  unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(result.current!.front);
});

it('stays empty when the atlas cannot be read and retries on the next request', async () => {
  decode = () => Promise.reject(new Error('missing'));
  const avatar = { ...DEFAULT_AVATAR, outfit: 'dres' as const };
  const { result, unmount } = renderHook(() => useAvatarAtlas(avatar));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(result.current).toBeNull();
  unmount();
  decode = () => Promise.resolve();
  const retry = renderHook(() => useAvatarAtlas(avatar));
  await waitFor(() => expect(retry.result.current).not.toBeNull());
});

it('ignores a result that arrives after unmount', async () => {
  let release!: () => void;
  decode = () => new Promise(resolve => { release = () => resolve(); });
  const avatar = { ...DEFAULT_AVATAR, outfit: 'bluza' as const };
  const { unmount } = renderHook(() => useAvatarAtlas(avatar));
  await waitFor(() => expect(release).toBeTypeOf('function'));
  unmount();
  decode = () => Promise.resolve();
  await act(async () => { release(); await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(URL.revokeObjectURL).toHaveBeenCalled();
});

it('loads only the head overlays a portrait can show', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ center: [0, 0], danceCenter: [0, 0], cells: { 0: { angle: 0, x: 0, y: 0 }, 135: { angle: 0, x: 0, y: 0, view: 'dance' } } }) })));
  const sources: string[] = [];
  const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!;
  Object.defineProperty(HTMLImageElement.prototype, 'src', { configurable: true, get() { return descriptor.get!.call(this); }, set(value: string) { sources.push(value); descriptor.set!.call(this, value); } });
  try {
    vi.stubGlobal('URL', Object.assign(class extends RealURL {}, { createObjectURL: vi.fn(() => 'blob:fresh'), revokeObjectURL: vi.fn() }));
    vi.resetModules();
    const fresh = await import('./useAvatarAtlas');
    const look = { ...DEFAULT_AVATAR, outfit: 'bluza' as const, hair: 'irokez' as const, pose: 'postawa' as const, colors: { ...DEFAULT_AVATAR.colors, top: 'oliwkowy' } };
    const { result } = renderHook(() => fresh.useAvatarPortrait(toAvatarConfig(look)));
    await waitFor(() => expect(result.current).toMatch(/^blob:/));
    expect(sources).toContain('/assets/arena/avatar-v1/hair-mohawk.png');
    expect(sources.filter(source => source.includes('/dance/'))).toEqual([]);
  } finally {
    Object.defineProperty(HTMLImageElement.prototype, 'src', descriptor);
  }
});

it('plays looping and one-shot frame sequences and shows a still frame with reduced motion', () => {
  vi.useFakeTimers();
  const { rerender } = render(<AvatarSprite atlas="a.png" atlasHeight={384} frames={[1, 2, 3]} label="Podgląd" />);
  const sprite = () => screen.getByRole('img', { name: 'Podgląd' });
  expect(sprite()).toHaveAttribute('viewBox', atlasViewBox(1));
  for (let frame = 0; frame < 4; frame++) act(() => vi.advanceTimersByTime(110));
  expect(sprite()).toHaveAttribute('viewBox', atlasViewBox(2));
  rerender(<AvatarSprite atlas="a.png" atlasHeight={384} frames={[4, 5]} loop={false} label="Podgląd" />);
  expect(sprite()).toHaveAttribute('viewBox', atlasViewBox(4));
  act(() => vi.advanceTimersByTime(110 * 5));
  expect(sprite()).toHaveAttribute('viewBox', atlasViewBox(5));
  expect(vi.getTimerCount()).toBe(0);
  rerender(<AvatarSprite atlas="a.png" atlasHeight={384} frames={[4, 5]} loop={false} reducedMotion label="Podgląd" />);
  expect(sprite()).toHaveAttribute('viewBox', atlasViewBox(5));
  rerender(<AvatarSprite atlas="a.png" atlasHeight={384} frames={[6, 7]} reducedMotion label="Podgląd" />);
  act(() => vi.advanceTimersByTime(1000));
  expect(sprite()).toHaveAttribute('viewBox', atlasViewBox(6));
  expect(vi.getTimerCount()).toBe(0);
});

it('does not schedule a timer for a single frame or a completed animation', () => {
  vi.useFakeTimers();
  const { rerender, unmount } = render(<AvatarSprite atlas="a.png" atlasHeight={384} frames={[8]} label="Still" />);
  expect(vi.getTimerCount()).toBe(0);
  rerender(<AvatarSprite atlas="a.png" atlasHeight={384} frames={[8]} loop={false} label="Still" />);
  expect(vi.getTimerCount()).toBe(0);
  rerender(<AvatarSprite atlas="a.png" atlasHeight={384} frames={[1, 2, 3]} loop={false} label="Still" />);
  act(() => vi.advanceTimersByTime(110));
  expect(screen.getByRole('img', { name: 'Still' })).toHaveAttribute('data-frame', '2');
  act(() => vi.advanceTimersByTime(110));
  expect(screen.getByRole('img', { name: 'Still' })).toHaveAttribute('data-frame', '3');
  expect(vi.getTimerCount()).toBe(0);
  act(() => vi.advanceTimersByTime(1100));
  expect(vi.getTimerCount()).toBe(0);
  expect(screen.getByRole('img', { name: 'Still' })).toHaveAttribute('data-frame', '3');
  rerender(<AvatarSprite atlas="a.png" atlasHeight={384} frames={[4, 5]} loop={false} label="Still" />);
  expect(vi.getTimerCount()).toBe(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('builds one portrait per avatar and shows none for unknown values', async () => {
  const config = { outfit: 'baza', hair: 'irokez', hat: 'brak', skin: 'heban', hairColor: 'rude', topColor: 'bialy', bottomColor: 'granatowy', shoesColor: 'czerwony', hatColor: 'bialy' };
  const { result, rerender } = renderHook(({ value }) => useAvatarPortrait(value), { initialProps: { value: config as typeof config | null } });
  await waitFor(() => expect(result.current).toMatch(/^blob:/));
  const first = result.current;
  const other = renderHook(() => useAvatarPortrait(config));
  await waitFor(() => expect(other.result.current).toBe(first));
  rerender({ value: { ...config, outfit: 'pirat' } });
  expect(result.current).toBeNull();
  rerender({ value: null });
  expect(result.current).toBeNull();
  expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(first);
  other.unmount();
});

it('returns no portrait when the front view cannot be built', async () => {
  decode = () => Promise.reject(new Error('missing'));
  const config = toAvatarConfig({ ...DEFAULT_AVATAR, outfit: 'dres', hair: 'brak', hat: 'czapka' });
  const { result } = renderHook(() => useAvatarPortrait(config));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(result.current).toBeNull();
});

it('builds a separate portrait for each pose', async () => {
  const base = toAvatarConfig({ ...DEFAULT_AVATAR, outfit: 'bluza', hair: 'kucyk' });
  const front = renderHook(() => useAvatarPortrait(base));
  const stance = renderHook(() => useAvatarPortrait({ ...base, pose: 'postawa' }));
  const side = renderHook(() => useAvatarPortrait({ ...base, pose: 'profil' }));
  await waitFor(() => [front, stance, side].forEach(hook => expect(hook.result.current).toMatch(/^blob:/)));
  expect(new Set([front.result.current, stance.result.current, side.result.current]).size).toBe(3);
  expect(fetch).toHaveBeenCalledWith('/assets/arena/avatar-v1/profile/anchors-bluza.json');
});
