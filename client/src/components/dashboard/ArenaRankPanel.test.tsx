import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import type { RankingEntry } from '../../types/api';
import { ArenaRankPanel } from './ArenaRankPanel';

const entry = (overrides: Partial<RankingEntry> = {}): RankingEntry => ({
  username: 'tester', points: 1400, rankPoints: 4, rankElo: 12, elo: 857, ...overrides,
});
const mount = (rank: RankingEntry | null) => render(<MemoryRouter><ArenaRankPanel rank={rank} /></MemoryRouter>);
const fact = (label: string) => screen.getByText(label).nextElementSibling;

it('shows the league, Elo, progress to the next league and the place in the Elo ranking', () => {
  mount(entry());
  expect(screen.getByRole('heading', { name: 'Arena' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Graj' })).toHaveAttribute('href', '/arena');
  expect(screen.getByText('Liga Exploit')).toBeInTheDocument();
  expect(screen.getByText('857')).toBeInTheDocument();
  expect(screen.getByRole('tooltip')).toHaveTextContent('Elo to Twoja siła w pojedynkach.');
  const meter = screen.getByRole('progressbar', { name: 'Postęp do ligi Root' });
  expect(meter).toHaveAttribute('aria-valuemin', '800');
  expect(meter).toHaveAttribute('aria-valuemax', '1000');
  expect(meter).toHaveAttribute('aria-valuenow', '857');
  expect(meter.querySelector('span')).toHaveStyle({ '--ud-fill': '0.285' });
  expect([...document.querySelectorAll('.ud-arena-span .league-icon')].map((icon) => icon.getAttribute('data-league'))).toEqual(['exploit', 'root']);
  expect(document.querySelector('.ud-arena-badge')).toHaveAttribute('data-league', 'exploit');
  expect(fact('Miejsce w arenie')).toHaveTextContent('#12');
  expect(fact('Do awansu')).toHaveTextContent('143 Elo');
});

it('takes the place from the Elo ranking, not the XP ranking', () => {
  mount(entry({ rankPoints: 1, rankElo: 37 }));
  expect(fact('Miejsce w arenie')).toHaveTextContent('#37');
});

it('shows a new player in the first league with their place', () => {
  mount(entry({ elo: 500, rankElo: 54 }));
  expect(screen.getByText('Liga Script Kiddie')).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: 'Postęp do ligi Skaner' })).toHaveAttribute('aria-valuenow', '500');
  expect(fact('Miejsce w arenie')).toHaveTextContent('#54');
  expect(fact('Do awansu')).toHaveTextContent('100 Elo');
});

it('does not invent a next league above the top one', () => {
  mount(entry({ elo: 1350, rankElo: 1 }));
  expect(screen.getByText('Liga Zero-day')).toBeInTheDocument();
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(screen.queryByText('Do awansu')).not.toBeInTheDocument();
  expect(fact('Liga')).toHaveTextContent('Najwyższa');
});

it('shows a dash when the player has no place yet', () => {
  mount(entry({ rankElo: null }));
  expect(fact('Miejsce w arenie')).toHaveTextContent('–');
});

it('says the rank could not be loaded instead of making one up', () => {
  mount(null);
  expect(screen.getByRole('status')).toHaveTextContent('Nie udało się wczytać rangi areny.');
  expect(screen.queryByText(/^Liga /)).not.toBeInTheDocument();
  expect(screen.queryByText('Miejsce w arenie')).not.toBeInTheDocument();
  expect(document.querySelector('.league-icon')).not.toBeInTheDocument();
});
