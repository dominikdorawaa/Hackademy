import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BattleResult, ELO_COUNT_MS } from './BattleResult';
import type { Outcome } from './battleView';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

const result = (outcome: Outcome, change: number, still = false) => render(<MemoryRouter>
  <BattleResult result={outcome} title="Wynik" text="Opis" change={change} still={still} />
</MemoryRouter>);

it('counts the Elo gain up while announcing only the final value, and throws confetti for a win', () => {
  result('win', 16);
  expect(document.querySelectorAll('.battle-confetti span').length).toBeGreaterThan(20);
  expect(document.querySelector('.battle-result-elo')).toHaveClass('is-counting');
  expect(screen.getByText('+16 Elo')).toHaveClass('sr-only');
  act(() => { vi.advanceTimersByTime(ELO_COUNT_MS + 100); });
  expect(document.querySelector('.battle-result-elo')).not.toHaveClass('is-counting');
  expect(screen.getByText('+16 Elo')).not.toHaveClass('sr-only');
  expect(screen.getByRole('link', { name: 'Wróć do Areny' })).toHaveAttribute('href', '/arena');
});

it('shows a loss without confetti and skips the counter without motion', () => {
  result('loss', -16, true);
  expect(document.querySelector('.battle-confetti')).toBeNull();
  expect(document.querySelector('.battle-result-elo')).not.toHaveClass('is-counting');
  expect(screen.getByText('-16 Elo')).toBeInTheDocument();
});
