import { act, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import LandingDuel, { DUEL_FIGHTERS } from './LandingDuel';

vi.mock('./arena/avatar/useAvatarAtlas', () => ({ useAvatarAtlas: () => ({ atlas: 'blob:atlas', front: null }) }));

const tick = (frames: number) => { for (let i = 0; i < frames; i++) act(() => { vi.advanceTimersByTime(110); }); };
const fighter = (name: string) => screen.getByRole('img', { name, hidden: true });

function mockSystemMotion(reduce: boolean) {
  const listeners = new Set<() => void>();
  const query = { matches: reduce, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  return (next: boolean) => { query.matches = next; listeners.forEach(listener => listener()); };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.reducedMotion;
});

it('shows two pixel fighters trading a blow in step', () => {
  render(<LandingDuel />);
  expect(fighter('Twój awatar wyprowadza cios')).toHaveAttribute('data-frame', '0');
  expect(fighter('Awatar rywala przyjmuje cios')).toBeInTheDocument();
  expect(screen.getByText('VS')).toBeInTheDocument();
  const [me, rival] = DUEL_FIGHTERS;
  expect(me.frames).toHaveLength(rival.frames.length);
  expect(me.frames.indexOf(10)).toBeLessThan(rival.frames.indexOf(37));
  expect(document.querySelector('.landing-fighter.is-rival')).toHaveAttribute('data-ready', 'true');
});

it('keeps the decorative duel away from screen readers', () => {
  render(<LandingDuel />);
  expect(document.querySelector('.landing-duel')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.queryAllByRole('img')).toHaveLength(0);
});

it('stops the duel when the system asks for reduced motion mid view', () => {
  vi.useFakeTimers();
  const setReduce = mockSystemMotion(false);
  render(<LandingDuel />);
  const rival = fighter('Awatar rywala przyjmuje cios');
  tick(16);
  expect(rival).not.toHaveAttribute('data-frame', '0');
  act(() => setReduce(true));
  expect(rival).toHaveAttribute('data-frame', '0');
  tick(10);
  expect(rival).toHaveAttribute('data-frame', '0');
});

it('stops the duel when the app motion setting changes', async () => {
  vi.useFakeTimers();
  mockSystemMotion(false);
  render(<LandingDuel />);
  const me = fighter('Twój awatar wyprowadza cios');
  tick(11);
  expect(me).not.toHaveAttribute('data-frame', '0');
  await act(async () => { document.documentElement.dataset.reducedMotion = 'true'; await Promise.resolve(); });
  expect(me).toHaveAttribute('data-frame', '0');
});
