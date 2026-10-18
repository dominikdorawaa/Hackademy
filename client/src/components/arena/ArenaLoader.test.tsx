import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ArenaLoader } from './ArenaLoader';
import { AVATAR_KEY, DEFAULT_AVATAR, toAvatarConfig } from './avatar/avatarModel';
import { AVATAR_ATLASES, RUN_FRAME_TIME, runFrames } from './avatar/fighters';
import { ThemeProvider } from '../../context/ThemeContext';

const atlas = vi.hoisted(() => ({ value: null as { atlas: string; front: string | null } | null, last: null as unknown }));
vi.mock('./avatar/useAvatarAtlas', () => ({ useAvatarAtlas: (avatar: unknown) => { atlas.last = avatar; return atlas.value; } }));

beforeEach(() => { atlas.value = null; atlas.last = null; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const loader = (label = 'Wczytuję walkę') => screen.getByRole('status', { name: label });
const sprite = () => loader().querySelector('.avatar-sprite')!;
const href = () => sprite().querySelector('image')!.getAttribute('href');
const firstRunFrame = String(runFrames(AVATAR_ATLASES.baza.run)[0]);

it('announces loading and keeps the running figure decorative and out of the tab order', () => {
  render(<ArenaLoader label="Wczytuję walkę" className="extra" />);
  expect(loader()).not.toHaveAttribute('aria-busy');
  expect(loader()).toHaveClass('arena-loader', 'extra');
  expect(loader()).toHaveTextContent('Wczytuję walkę');
  expect(sprite().closest('[aria-hidden="true"]')).not.toBeNull();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(loader().querySelectorAll('a, button, [tabindex]')).toHaveLength(0);
});

it('runs the default character from the plain atlas while no avatar is known', () => {
  vi.useFakeTimers();
  render(<ArenaLoader label="Wczytuję walkę" />);
  expect(atlas.last).toEqual(DEFAULT_AVATAR);
  expect(href()).toBe(AVATAR_ATLASES.baza.atlas);
  expect(sprite()).toHaveAttribute('data-frame', firstRunFrame);
  act(() => vi.advanceTimersByTime(RUN_FRAME_TIME));
  expect(sprite()).not.toHaveAttribute('data-frame', firstRunFrame);
  expect(loader()).toHaveAttribute('data-still', 'false');
});

it('runs the avatar saved in the creator, and the recolored atlas once it is ready', () => {
  localStorage.setItem(AVATAR_KEY, JSON.stringify({ ...DEFAULT_AVATAR, outfit: 'bluza', hat: 'czapka' }));
  const view = render(<ArenaLoader label="Ładowanie Areny" />);
  expect(atlas.last).toMatchObject({ outfit: 'bluza', hat: 'czapka' });
  expect(loader('Ładowanie Areny').querySelector('image')).toHaveAttribute('href', AVATAR_ATLASES.bluza.atlas);
  atlas.value = { atlas: 'blob:run', front: null };
  view.rerender(<ArenaLoader label="Ładowanie Areny" />);
  expect(loader('Ładowanie Areny').querySelector('image')).toHaveAttribute('href', 'blob:run');
});

it('prefers the account avatar and ignores an unusable one', () => {
  localStorage.setItem(AVATAR_KEY, JSON.stringify({ ...DEFAULT_AVATAR, outfit: 'bluza' }));
  const view = render(<ArenaLoader label="Wczytuję walkę" avatar={toAvatarConfig({ ...DEFAULT_AVATAR, outfit: 'dres' })} />);
  expect(atlas.last).toMatchObject({ outfit: 'dres' });
  expect(href()).toBe(AVATAR_ATLASES.dres.atlas);
  view.rerender(<ArenaLoader label="Wczytuję walkę" avatar={{ ...toAvatarConfig(DEFAULT_AVATAR), outfit: 'pirat' }} />);
  expect(atlas.last).toMatchObject({ outfit: 'bluza' });
});

it('shows a still figure when the in-app setting reduces motion', () => {
  vi.useFakeTimers();
  localStorage.setItem('app-reduced-motion', 'true');
  render(<ThemeProvider><ArenaLoader label="Wczytuję walkę" /></ThemeProvider>);
  expect(loader()).toHaveAttribute('data-still', 'true');
  act(() => vi.advanceTimersByTime(RUN_FRAME_TIME * 4));
  expect(sprite()).toHaveAttribute('data-frame', firstRunFrame);
  expect(vi.getTimerCount()).toBe(0);
});

it('stops running as soon as the system asks for reduced motion', () => {
  vi.useFakeTimers();
  let matches = false;
  const listeners: (() => void)[] = [];
  vi.stubGlobal('matchMedia', (query: string) => ({ get matches() { return matches && query.includes('reduce'); }, media: query,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener), removeEventListener: vi.fn() }));
  render(<ArenaLoader label="Wczytuję walkę" />);
  expect(loader()).toHaveAttribute('data-still', 'false');
  matches = true;
  act(() => listeners.forEach(listener => listener()));
  expect(loader()).toHaveAttribute('data-still', 'true');
  expect(sprite()).toHaveAttribute('data-frame', firstRunFrame);
  expect(vi.getTimerCount()).toBe(0);
});
