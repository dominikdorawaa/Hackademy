import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { EloHelp } from './EloHelp';

it('opens on keyboard focus outside a clipping ancestor and closes on Escape', async () => {
  render(<div data-testid="card" style={{ overflow: 'hidden' }}><EloHelp /></div>);
  const button = screen.getByRole('button', { name: 'Co oznacza Elo?' });
  act(() => button.focus());
  const help = await screen.findByRole('dialog', { name: 'Jak działa Elo' });
  expect(help).toHaveTextContent('Każdy zaczyna z 500.');
  expect(screen.getByTestId('card')).not.toContainElement(help);
  expect(button).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(button).toHaveFocus();
});

it('opens on click and closes after clicking outside', async () => {
  const user = userEvent.setup();
  render(<><EloHelp /><button>Poza podpowiedzią</button></>);
  await user.click(screen.getByRole('button', { name: 'Co oznacza Elo?' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Poza podpowiedzią' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

it('stays open while moving from the trigger to the explanation', async () => {
  render(<EloHelp />);
  const button = screen.getByRole('button', { name: 'Co oznacza Elo?' });
  fireEvent.pointerEnter(button);
  const help = await screen.findByRole('dialog');
  vi.useFakeTimers();
  try {
    fireEvent.pointerLeave(button);
    fireEvent.pointerEnter(help);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerLeave(help);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
