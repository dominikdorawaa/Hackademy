import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { ARRIVE_AT_MS, ARRIVE_MS, BattlePodium, FALL, FALL_DELAY_MS, GRAB_MS, STANDING } from './BattlePodium';
import { AVATAR_ATLASES, KNOCKED_OUT, victoryDance } from '../avatar/fighters';
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

it('sends Bit to drag the knocked out loser off the stage by the ankles', () => {
  vi.useFakeTimers();
  render(<BattlePodium me={me} rival={rival} result="win" title="Zwycięstwo" change={16} still={false} />);
  const loser = document.querySelector('.battle-podium-loser') as HTMLElement;
  expect(screen.queryByRole('img', { name: 'Bit wyciąga przegranego z areny' })).not.toBeInTheDocument();
  act(() => { vi.advanceTimersByTime(ARRIVE_AT_MS); });
  expect(loser).toHaveAttribute('data-phase', 'arrive');
  expect(screen.getByRole('img', { name: 'Bit wyciąga przegranego z areny' })).toBeInTheDocument();
  expect(within(loser).getByRole('img', { name: `${rival.username} przegrywa` })).toHaveAttribute('data-frame', String(KNOCKED_OUT));
  act(() => { vi.advanceTimersByTime(ARRIVE_MS + GRAB_MS); });
  expect(loser).toHaveAttribute('data-phase', 'drag');
  expect(within(loser).getByRole('img', { name: `${rival.username} przegrywa` })).toHaveAttribute('data-frame', String(AVATAR_ATLASES[rival.look.outfit].dragged));
  vi.useRealTimers();
});

it('leaves the loser lying still without Bit when motion is reduced', () => {
  render(<BattlePodium me={me} rival={rival} result="loss" title="Porażka" change={-16} still />);
  expect(within(document.querySelector('.battle-podium-loser') as HTMLElement).getByRole('img', { name: `${me.username} przegrywa` })).toHaveAttribute('data-frame', String(KNOCKED_OUT));
  expect(screen.queryByRole('img', { name: 'Bit wyciąga przegranego z areny' })).not.toBeInTheDocument();
});

const stage = (overrides: Partial<ReturnType<typeof createGameSession>> = {}) => createGameSession({ status: 'FINISHED', winnerId: 1, finishedAt: 1_000_000, reactions: [], ...overrides });

it('lets the winner switch their podium dance and shows it to both players', () => {
  const onReact = vi.fn();
  const view = render(<BattlePodium me={me} rival={rival} result="win" title="Zwycięstwo" change={16} still session={stage()} serverNow={1_001_000} onReact={onReact} />);
  const dances = screen.getByRole('group', { name: 'Twój taniec' });
  expect(within(dances).getByRole('button', { name: 'Luz' })).toHaveAttribute('aria-pressed', String(me.look.dance === 'groove'));
  fireEvent.click(within(dances).getByRole('button', { name: 'Scuba' }));
  expect(onReact).toHaveBeenCalledWith('scuba');
  view.rerender(<BattlePodium me={me} rival={rival} result="win" title="Zwycięstwo" change={16} still
    session={stage({ reactions: [{ id: 3, senderId: 1, reaction: 'scuba', sentAt: 1_000_500 }] })} serverNow={1_001_000} onReact={onReact} />);
  expect(within(dances).getByRole('button', { name: 'Scuba' })).toHaveAttribute('aria-pressed', 'true');
  expect(within(document.querySelector('.battle-podium-winner') as HTMLElement).getByRole('img', { name: `${me.username} tańczy` }).getAttribute('data-frame')).toBe(String(victoryDance('scuba').loop[0]));
});

it('ignores dances sent during the fight and hides the dance choice from the loser', () => {
  render(<BattlePodium me={me} rival={rival} result="loss" title="Porażka" change={-16} still
    session={stage({ winnerId: 2, reactions: [{ id: 1, senderId: 1, reaction: 'scuba', sentAt: 999_000 }] })} serverNow={1_001_000} onReact={vi.fn()} />);
  expect(screen.queryByRole('group', { name: 'Twój taniec' })).not.toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Szybki czat' })).toBeInTheDocument();
});

it('shows quick chat emotes sent on the victory stage above the sender', () => {
  const onReact = vi.fn();
  render(<BattlePodium me={me} rival={rival} result="loss" title="Porażka" change={-16} still
    session={stage({ winnerId: 2, reactions: [{ id: 4, senderId: 2, reaction: 'gg', sentAt: 1_000_800 }, { id: 2, senderId: 1, reaction: 'ez', sentAt: 998_000 }] })} serverNow={1_001_000} onReact={onReact} />);
  expect(screen.getByRole('img', { name: `${rival.username}: GG` })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: `${me.username}: EZ` })).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('group', { name: 'Szybki czat' })).getByRole('button', { name: 'GG' }));
  expect(onReact).toHaveBeenCalledWith('gg');
});
