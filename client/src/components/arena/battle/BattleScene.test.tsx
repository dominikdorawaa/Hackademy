import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BattleScene } from './BattleScene';
import { perspective } from './battleView';
import { createGameSession } from '../../../test/fixtures/arena';
import type { GameSession } from '../../../types/api';

const assets = vi.hoisted(() => ({ ready: true }));
vi.mock('../avatar/useAvatarAtlas', () => ({
  useAvatarAtlas: () => assets.ready ? { atlas: 'blob:atlas', front: null } : null,
  useAvatarPortrait: () => null,
}));

beforeEach(() => { assets.ready = true; vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

const exchange = (damage = { 1: 20, 2: 20 }) => createGameSession({
  phase: 'REVEAL', question: null, hp: { 1: 100 - damage[1], 2: 100 - damage[2] },
  lastRound: { round: 1, questionId: 11, content: 'Pytanie', answers: ['A', 'B', 'C', 'D'], correctAnswer: 1,
    choices: { 1: 1, 2: 0 }, damage },
});
const scene = (session: GameSession, reducedMotion = false) => <BattleScene session={session} {...perspective(session, 1)} reducedMotion={reducedMotion}>
  <p>Runda {session.round}</p>
</BattleScene>;
const fighter = (side = 'me') => document.querySelector(`.battle-fighter.is-${side}`)!;
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

it('plays cast, flight, impact and recovery without restarting on session updates', () => {
  const session = exchange();
  const view = render(scene(session));
  expect(fighter()).toHaveAttribute('data-frames', '10,11,12,13,14,15,16,17');
  expect(screen.getByRole('img', { name: 'Twój awatar, tester' })).toHaveAttribute('data-frame', '10');
  advance(90);
  expect(screen.getByRole('img', { name: 'Twój awatar, tester' })).toHaveAttribute('data-frame', '11');
  advance(410);
  view.rerender(scene({ ...session, serverTime: session.serverTime + 500 }));
  advance(219);
  expect(fighter()).toHaveAttribute('data-idle', 'false');
  advance(1);
  expect(fighter()).toHaveAttribute('data-idle', 'true');
  advance(179);
  expect(screen.getByRole('meter', { name: 'HP: tester' })).toHaveAttribute('aria-valuenow', '100');
  advance(1);
  expect(fighter()).toHaveAttribute('data-frames', '37,38,39,40');
  expect(screen.getByRole('meter', { name: 'HP: tester' })).toHaveAttribute('aria-valuenow', '80');
  expect(screen.getByTestId('shot-me')).toHaveTextContent('-20');
  expect(screen.getByTestId('shot-rival')).toHaveTextContent('-20');
  expect([...screen.getByTestId('shot-me').querySelectorAll('img')].map(image => image.getAttribute('src'))).toEqual(['/assets/arena/effects/data-packet.png', '/assets/arena/effects/data-burst.png']);
  advance(440);
  expect(fighter()).toHaveAttribute('data-frames', '0');
  expect(vi.getTimerCount()).toBe(0);
});

it('waits for both atlases before starting the exchange and HP loss', () => {
  assets.ready = false;
  const session = exchange({ 1: 0, 2: 20 });
  const view = render(scene(session));
  expect(screen.getByRole('region', { name: 'Arena walki' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.queryByTestId('shot-me')).not.toBeInTheDocument();
  advance(2000);
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '100');
  assets.ready = true;
  view.rerender(scene(session));
  expect(screen.getByRole('region', { name: 'Arena walki' })).toHaveAttribute('aria-busy', 'false');
  expect(fighter()).toHaveAttribute('data-frames', '10,11,12,13,14,15,16,17');
  advance(900);
  expect(fighter('rival')).toHaveAttribute('data-frames', '37,38,39,40');
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '80');
});

it('starts victory and defeat only after the last projectile lands', () => {
  render(scene({ ...exchange({ 1: 0, 2: 20 }), status: 'FINISHED', finishReason: 'KNOCKOUT', winnerId: 1, hp: { 1: 100, 2: 0 } }));
  advance(720);
  expect(fighter()).toHaveAttribute('data-frames', '0');
  expect(fighter('rival')).toHaveAttribute('data-frames', '0');
  advance(180);
  expect(fighter('rival')).toHaveAttribute('data-frames', '37,38,39,40');
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '0');
  advance(440);
  expect(fighter()).toHaveAttribute('data-frames', '55,56,57,58,59,60,61,62,64,65,66,67,68,69,70,71');
  expect(fighter('rival')).toHaveAttribute('data-frames', '46,47,48,49,50,51,52,53');
});

it('cancels the old sequence when the next round begins', () => {
  const view = render(scene(exchange()));
  advance(500);
  view.rerender(scene(createGameSession({ round: 2, hp: { 1: 80, 2: 80 } })));
  advance(1500);
  expect(fighter()).toHaveAttribute('data-frames', '0');
  expect(screen.queryByTestId('shot-me')).not.toBeInTheDocument();
  expect(screen.getByRole('meter', { name: 'HP: tester' })).toHaveAttribute('aria-valuenow', '80');
  expect(vi.getTimerCount()).toBe(0);
});

it('keeps damage feedback immediate and still with reduced motion', () => {
  const view = render(scene(exchange(), true));
  expect(screen.queryByTestId('shot-me')).not.toBeInTheDocument();
  expect(fighter()).toHaveAttribute('data-frames', '0');
  expect(screen.getByRole('meter', { name: 'HP: tester' })).toHaveAttribute('aria-valuenow', '80');
  expect(vi.getTimerCount()).toBe(0);
  view.rerender(scene({ ...exchange(), status: 'FINISHED', finishReason: 'KNOCKOUT', winnerId: 2 }, true));
  expect(screen.getByRole('img', { name: 'Twój awatar, tester' })).toHaveAttribute('data-frame', '53');
  expect(vi.getTimerCount()).toBe(0);
});

it('does not launch projectiles when neither player deals damage', () => {
  render(scene(exchange({ 1: 0, 2: 0 })));
  expect(screen.queryByTestId('shot-me')).not.toBeInTheDocument();
  expect(screen.queryByTestId('shot-rival')).not.toBeInTheDocument();
  expect(fighter()).toHaveAttribute('data-frames', '0');
});
