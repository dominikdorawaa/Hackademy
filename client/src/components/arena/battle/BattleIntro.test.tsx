import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { BattleIntro } from './BattleIntro';
import { perspective } from './battleView';
import { createGameSession } from '../../../test/fixtures/arena';

vi.mock('../avatar/useAvatarAtlas', () => ({
  useAvatarAtlas: () => ({ atlas: 'blob:atlas', front: null }),
  useAvatarPortrait: () => null,
}));

const { me, rival } = perspective(createGameSession(), 1);
const cards = {
  1: { games: 8, wins: 6, losses: 2, streak: 3, recent: ['WIN', 'WIN', 'WIN', 'LOSS', 'DRAW'] as const, rank: 12 },
  2: { games: 0, wins: 0, losses: 0, streak: 0, recent: [], rank: 40 },
};
const intro = (props: Partial<Parameters<typeof BattleIntro>[0]> = {}) => <BattleIntro me={me} rival={rival}
  cards={{ 1: { ...cards[1], recent: [...cards[1].recent] }, 2: cards[2] }} secondsLeft={6} totalRounds={10} roundSeconds={15}
  leaving={false} reducedMotion={false} {...props} />;

it('introduces both fighters with their records before the duel', () => {
  render(intro());
  const mine = screen.getByRole('region', { name: `Ty, ${me.username}` });
  expect(within(mine).getByText('Elo').nextSibling).toHaveTextContent('500');
  expect(within(mine).getByText('#12')).toBeInTheDocument();
  expect(within(mine).getByText('75%')).toBeInTheDocument();
  expect(within(mine).getByText('Seria wygranych: 3')).toBeInTheDocument();
  expect(within(mine).getByRole('list', { name: 'Ostatnie walki: wygrana, wygrana, wygrana, porażka, remis' })).toBeInTheDocument();
  const theirs = screen.getByRole('region', { name: `Rywal, ${rival.username}` });
  expect(within(theirs).getByText('Debiut na arenie')).toBeInTheDocument();
  expect(within(theirs).getByText('–')).toBeInTheDocument();
  expect(screen.getByText('10 rund · 15 s na odpowiedź')).toBeInTheDocument();
  expect(screen.getByRole('timer', { name: 'Walka zaczyna się za' })).toHaveTextContent('6');
  expect(screen.getByRole('timer', { name: 'Walka zaczyna się za' })).not.toHaveAttribute('data-counting');
});

it('counts the last seconds down and calls the fight while it opens the arena', () => {
  const view = render(intro({ secondsLeft: 2 }));
  expect(screen.getByRole('timer', { name: 'Walka zaczyna się za' })).toHaveAttribute('data-counting', 'true');
  view.rerender(intro({ secondsLeft: 0, leaving: true }));
  expect(screen.getByRole('timer', { name: 'Walka zaczyna się za' })).toHaveTextContent('Walka!');
  expect(document.querySelector('.battle-intro')).toHaveAttribute('data-leaving', 'true');
});

it('shows only Elo when the server sends no records', () => {
  render(intro({ cards: undefined }));
  expect(screen.getAllByText('Debiut na arenie')).toHaveLength(2);
});
