import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RunningAvatar } from './RunningAvatar';
import { DEFAULT_AVATAR, toAvatarConfig } from './avatarModel';
import { AVATAR_ATLASES, RUN_FRAME_TIME, runFrames } from './fighters';

const atlas = vi.hoisted(() => ({ value: null as { atlas: string; front: string | null } | null, last: null as unknown }));
vi.mock('./useAvatarAtlas', () => ({ useAvatarAtlas: (avatar: unknown) => { atlas.last = avatar; return atlas.value; } }));

beforeEach(() => { atlas.value = null; atlas.last = null; });
afterEach(() => vi.useRealTimers());

const image = () => screen.getByRole('img', { name: 'Biegnąca postać' });
const href = () => image().querySelector('image')!.getAttribute('href');

it('runs the default avatar from the plain atlas until the recolored one is ready', () => {
  vi.useFakeTimers();
  const { rerender } = render(<RunningAvatar />);
  expect(atlas.last).toEqual(DEFAULT_AVATAR);
  expect(href()).toBe(AVATAR_ATLASES.baza.atlas);
  expect(image()).toHaveAttribute('data-frame', '91');
  act(() => vi.advanceTimersByTime(RUN_FRAME_TIME));
  expect(image()).toHaveAttribute('data-frame', '92');
  atlas.value = { atlas: 'blob:run', front: null };
  rerender(<RunningAvatar />);
  expect(href()).toBe('blob:run');
});

it('uses the saved outfit and shows a still runner with reduced motion', () => {
  vi.useFakeTimers();
  const config = toAvatarConfig({ ...DEFAULT_AVATAR, outfit: 'dres', hat: 'daszek' });
  render(<RunningAvatar avatar={config} reducedMotion label="Ładowanie" />);
  const runner = screen.getByRole('img', { name: 'Ładowanie' });
  expect(atlas.last).toMatchObject({ outfit: 'dres', hat: 'daszek' });
  expect(runner.querySelector('image')).toHaveAttribute('href', AVATAR_ATLASES.dres.atlas);
  expect(runner.querySelector('image')).toHaveAttribute('height', '704');
  act(() => vi.advanceTimersByTime(RUN_FRAME_TIME * 4));
  expect(runner).toHaveAttribute('data-frame', String(runFrames(AVATAR_ATLASES.dres.run)[0]));
  expect(vi.getTimerCount()).toBe(0);
});

it('falls back to the default avatar for unknown saved values', () => {
  render(<RunningAvatar avatar={{ ...toAvatarConfig(DEFAULT_AVATAR), outfit: 'pirat' }} />);
  expect(atlas.last).toEqual(DEFAULT_AVATAR);
});
