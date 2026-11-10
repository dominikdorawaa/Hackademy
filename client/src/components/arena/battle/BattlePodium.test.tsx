import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { BattlePodium, FALL, FALL_DELAY_MS, STANDING } from './BattlePodium';
import { podiumDelay, perspective } from './battleView';
import { createGameSession } from '../../../test/fixtures/arena';

vi.mock('../avatar/useAvatarAtlas', () => ({
  useAvatarAtlas: () => ({ atlas: 'blob:atlas', front: null }),
  useAvatarPortrait: () => null,
}));

const { me, rival } = perspective(createGameSession(), 1);

it('lets the winner dance on the podium while the loser falls down at the back', () => {
  vi.useFakeTimers();
  render(<BattlePodium me={me} rival={rival} result="win" title="Zwycięstwo" change={16} still={false} />);
  expect(screen.getByRole('heading', { name: 'Zwycięstwo' })).toBeInTheDocument();
  const winner = document.querySelector('.battle-podium-winner') as HTMLElement;
  expect(within(winner).getByRole('img', { name: `${me.username} tańczy` })).toBeInTheDocument();
  expect(within(winner).getByText('Ty')).toBeInTheDocument();
  const loser = document.querySelector('.battle-podium-loser') as HTMLElement;
  expect(within(loser).getByRole('img', { name: `${rival.username} przegrywa` })).toHaveAttribute('data-frame', '0');
  act(() => { vi.advanceTimersByTime(FALL_DELAY_MS); });
  for (let step = 0; step < FALL.length; step++) act(() => { vi.advanceTimersByTime(120); });
  expect(within(loser).getByRole('img', { name: `${rival.username} przegrywa` })).toHaveAttribute('data-frame', String(FALL.at(-1)));
  vi.useRealTimers();
});

it('puts the rival on the podium after a loss', () => {
  render(<BattlePodium me={me} rival={rival} result="loss" title="Porażka" change={-16} still={false} />);
  expect(within(document.querySelector('.battle-podium-winner') as HTMLElement).getByRole('img', { name: `${rival.username} tańczy` })).toBeInTheDocument();
  expect(within(document.querySelector('.battle-podium-loser') as HTMLElement).getByRole('img', { name: `${me.username} przegrywa` })).toBeInTheDocument();
});

it('stands both fighters side by side after a draw', () => {
  render(<BattlePodium me={me} rival={rival} result="draw" title="Remis" change={0} still />);
  const tied = document.querySelectorAll('.battle-podium-tie');
  expect(tied).toHaveLength(2);
  expect(within(tied[0] as HTMLElement).getByRole('img')).toHaveAttribute('data-frame', String(STANDING));
  expect(document.querySelector('.battle-podium-loser')).toBeNull();
});

it('waits for the last blow before the podium only when the fight was watched live', () => {
  const knockout = createGameSession({ status: 'FINISHED', finishReason: 'KNOCKOUT', winnerId: 1, phase: 'REVEAL', hp: { 1: 100, 2: 0 },
    lastRound: { round: 4, questionId: 1, content: 'P', answers: ['A', 'B', 'C', 'D'], correctAnswer: 0, choices: {}, damage: { 1: 0, 2: 20 } } });
  expect(podiumDelay(knockout, false, false)).toBe(0);
  expect(podiumDelay(knockout, true, true)).toBe(0);
  expect(podiumDelay(knockout, true, false)).toBeGreaterThan(2000);
  expect(podiumDelay({ ...knockout, finishReason: 'SURRENDER' }, true, false)).toBe(900);
});
