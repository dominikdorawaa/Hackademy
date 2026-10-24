import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BattleScene } from './BattleScene';
import { FINISHERS, perspective } from './battleView';
import { danceFrames, TURNS, turnedDance } from '../avatar/fighters';
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
const scene = (session: GameSession, reducedMotion = false, serverNow = session.serverTime) => <BattleScene session={session} {...perspective(session, 1)} reducedMotion={reducedMotion} serverNow={serverNow}>
  <p>Runda {session.round}</p>
</BattleScene>;
const fighter = (side = 'me') => document.querySelector(`.battle-fighter.is-${side}`)!;
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

it('animates independently scaled damage and actual remaining health for each fighter', () => {
  render(scene(exchange({ 1: 7, 2: 19 })));
  expect(screen.getByRole('meter', { name: 'HP: tester' })).toHaveAttribute('aria-valuenow', '100');
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '100');
  advance(900);
  expect(screen.getByTestId('shot-me')).toHaveTextContent('-19');
  expect(screen.getByTestId('shot-rival')).toHaveTextContent('-7');
  expect(screen.getByRole('meter', { name: 'HP: tester' })).toHaveAttribute('aria-valuenow', '93');
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '81');
});

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
  const loader = screen.getByRole('status', { name: 'Przygotowuję postacie' });
  expect(loader).toHaveClass('arena-loader', 'battle-stage-loading');
  expect(loader.querySelector('.avatar-sprite image')).toHaveAttribute('href', '/assets/arena/avatar-v1/fighter.png');
  expect(screen.queryByRole('img', { name: 'Twój awatar, tester' })).not.toBeInTheDocument();
  expect(screen.queryByTestId('shot-me')).not.toBeInTheDocument();
  advance(2000);
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '100');
  assets.ready = true;
  view.rerender(scene(session));
  expect(screen.getByRole('region', { name: 'Arena walki' })).toHaveAttribute('aria-busy', 'false');
  expect(screen.queryByRole('status', { name: 'Przygotowuję postacie' })).not.toBeInTheDocument();
  expect(fighter()).toHaveAttribute('data-frames', '10,11,12,13,14,15,16,17');
  advance(900);
  expect(fighter('rival')).toHaveAttribute('data-frames', '37,38,39,40');
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '80');
});

it('plays the finisher before victory and defeat after a knockout', () => {
  render(scene({ ...exchange({ 1: 0, 2: 20 }), status: 'FINISHED', finishReason: 'KNOCKOUT', winnerId: 1, hp: { 1: 100, 2: 0 } }));
  const rivalHp = () => screen.getByRole('meter', { name: 'HP: opponent' });
  expect(fighter()).toHaveAttribute('data-frames', FINISHERS.beam.frames.join(','));
  expect(screen.getByTestId('finisher-beam')).toHaveTextContent('Cios kończącyPrzeciążenie');
  expect(screen.getByTestId('finisher-beam')).toHaveClass('from-me');
  expect(screen.queryByTestId('shot-me')).not.toBeInTheDocument();
  expect(fighter('rival')).toHaveAttribute('data-finished-by', 'beam');
  expect(fighter()).not.toHaveAttribute('data-finished-by');
  advance(899);
  expect(fighter('rival')).toHaveAttribute('data-frames', '0');
  expect(rivalHp()).toHaveAttribute('aria-valuenow', '20');
  advance(1);
  expect(fighter('rival')).toHaveAttribute('data-frames', '37,38,39,40');
  expect(rivalHp()).toHaveAttribute('aria-valuenow', '0');
  advance(440);
  expect(fighter('rival')).toHaveAttribute('data-frames', '46,47,48,49,50,51,52,53');
  expect(fighter()).toHaveAttribute('data-frames', FINISHERS.beam.frames.join(','));
  advance(760);
  expect(fighter()).toHaveAttribute('data-frames', '55,56,57,58,59,60,61,62,64,65,66,67,68,69,70,71');
});

it('shows the rival finisher after my last hit lands', () => {
  render(scene({ ...exchange(), id: 'game1', status: 'FINISHED', finishReason: 'KNOCKOUT', winnerId: 2, hp: { 1: 0, 2: 20 },
    player2Avatar: { outfit: 'baza', hair: 'brak', hat: 'brak', skin: 'jasna', hairColor: 'czarne', topColor: 'granatowy', bottomColor: 'piaskowy', shoesColor: 'grafitowy', hatColor: 'czerwony', finisher: 'combo' } }));
  const myHp = () => screen.getByRole('meter', { name: 'HP: tester' }), rivalHp = () => screen.getByRole('meter', { name: 'HP: opponent' });
  expect(screen.getByTestId('shot-me')).toHaveTextContent('-20');
  expect(screen.getByTestId('finisher-combo')).toHaveClass('from-rival');
  expect(fighter()).toHaveAttribute('data-finished-by', 'combo');
  advance(900);
  expect(rivalHp()).toHaveAttribute('aria-valuenow', '20');
  expect(myHp()).toHaveAttribute('aria-valuenow', '20');
  advance(440);
  expect(fighter('rival')).toHaveAttribute('data-frames', FINISHERS.combo.frames.join(','));
  advance(999);
  expect(myHp()).toHaveAttribute('aria-valuenow', '20');
  advance(1);
  expect(myHp()).toHaveAttribute('aria-valuenow', '0');
  expect(fighter()).toHaveAttribute('data-frames', '37,38,39,40');
});

it('skips the finisher with reduced motion', () => {
  render(scene({ ...exchange({ 1: 0, 2: 20 }), status: 'FINISHED', finishReason: 'KNOCKOUT', winnerId: 1, hp: { 1: 100, 2: 0 } }, true));
  expect(screen.queryByTestId('finisher-beam')).not.toBeInTheDocument();
  expect(fighter('rival')).not.toHaveAttribute('data-finished-by');
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

const reacted = (reaction: string, senderId: number, overrides: Partial<GameSession> = {}) => createGameSession({
  reactions: [{ id: 4, senderId, reaction, sentAt: 999_000 }], ...overrides,
});

it('shows a rival reaction above their fighter and plays 67 while they stand idle', () => {
  render(scene(reacted('67', 2)));
  expect(fighter('rival')).toHaveAttribute('data-frames', turnedDance(8, TURNS.sixseven).join(','));
  expect(fighter('rival')).toHaveAttribute('data-idle', 'false');
  expect(document.querySelector('.battle-reaction')).toBeNull();
  expect(screen.getByText('opponent: Six-seven')).toHaveAttribute('role', 'status');
  expect(fighter()).toHaveAttribute('data-idle', 'true');
});

it('lets a blow play before a reaction animation and never changes HP', () => {
  const session = { ...exchange({ 1: 0, 2: 20 }), reactions: [{ id: 5, senderId: 1, reaction: 'groove', sentAt: 999_500 }] };
  render(scene(session));
  expect(fighter()).toHaveAttribute('data-frames', '10,11,12,13,14,15,16,17');
  expect(document.querySelector('.battle-reaction')).toBeNull();
  expect(screen.getByText('Ty: Taniec Luz')).toBeInTheDocument();
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '100');
  advance(720);
  expect(fighter()).toHaveAttribute('data-frames', danceFrames(6).join(','));
  advance(500);
  expect(screen.getByRole('meter', { name: 'HP: opponent' })).toHaveAttribute('aria-valuenow', '80');
});

it('keeps the finished pose and shows only the bubble after the match ends', () => {
  render(scene(reacted('67', 1, { status: 'FINISHED', winnerId: 2, finishReason: 'SURRENDER', phase: 'QUESTION' })));
  expect(fighter()).not.toHaveAttribute('data-frames', turnedDance(8, TURNS.sixseven).join(','));
  expect(document.querySelector('.battle-reaction')).toBeNull();
  expect(screen.getByText('Ty: Six-seven')).toBeInTheDocument();
});

it('shows reactions without dancing for reduced motion and drops old or unknown ones', () => {
  const view = render(scene(reacted('67', 2), true));
  expect(fighter('rival')).toHaveAttribute('data-frames', '0');
  expect(document.querySelector('.battle-reaction')).toBeNull();
  expect(screen.getByText('opponent: Six-seven')).toBeInTheDocument();
  view.rerender(scene(reacted('laugh', 2), false, 1_002_000));
  expect(document.querySelector('.battle-reaction')).toBeNull();
  view.rerender(scene(reacted('hello', 2)));
  expect(document.querySelector('.battle-reaction')).toBeNull();
  view.rerender(scene(reacted('laugh', 2), false, 998_000));
  expect(document.querySelector('.battle-reaction')).toBeNull();
  view.rerender(scene(reacted('fire', 2)));
  expect(document.querySelector('.battle-reaction')).toBeNull();
});

it('keeps a turning dance on screen until its turn back has played', () => {
  render(scene(reacted('scuba', 2), false, 999_000 + 3_100));
  expect(fighter('rival')).toHaveAttribute('data-frames', turnedDance(13, TURNS.scuba).join(','));
  expect(turnedDance(13, TURNS.scuba).at(-1)).toBe(TURNS.scuba * 9);
});

it('drops the dance once it has played but keeps the bubble a little longer', () => {
  render(scene(reacted('67', 2), false, 999_000 + turnedDance(8, TURNS.sixseven).length * 110 + 500));
  expect(fighter('rival')).toHaveAttribute('data-frames', '0');
  expect(document.querySelector('.battle-reaction')).toBeNull();
});

it('shows the animated PixelLab emote above the fighter', () => {
  const view = render(scene(reacted('gg', 2)));
  const bubble = document.querySelector('.battle-reaction.is-rival')!;
  expect(bubble).toHaveAttribute('data-reaction', 'gg');
  expect(bubble.querySelector('.pixel-sprite')).toHaveAttribute('data-still', 'false');
  expect(fighter('rival')).toHaveAttribute('data-frames', '0');
  view.rerender(scene(reacted('ez', 2), true));
  expect(document.querySelector('.battle-reaction .pixel-sprite')).toHaveAttribute('data-still', 'true');
});
