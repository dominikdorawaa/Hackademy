import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { profileActivityFacts } from '../../lib/activity';
import ProfileLearningStats from './ProfileLearningStats';

afterEach(() => vi.useRealTimers());

describe('learning statistics', () => {
  it('finds the busiest date, counts only active days and excludes activity outside the period', () => {
    const facts = profileActivityFacts([
      { date: '2026-10-02', count: 3 },
      { date: '2026-10-08', count: 4 },
      { date: '2026-10-09', count: 2 },
      { date: '2026-10-07', count: 0 },
      { date: '2026-01-01', count: 999 },
      { date: '2026-10-10', count: 999 },
    ], new Date(2026, 9, 9));
    expect(facts.bestDay?.date).toEqual(new Date(2026, 9, 8, 12));
    expect(facts.averagePerActiveDay).toBe(3);
    expect(facts.activeDays).toBe(3);
    expect(facts.longestStreak).toBe(2);
    expect(facts.bestDay?.count).toBe(4);
  });

  it('shows personal records with their period without dashboard scores', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 12));
    render(<ProfileLearningStats loading={false} activity={[
      { date: '2026-10-08', count: 3 }, { date: '2026-10-09', count: 2 },
    ]} />);
    expect(screen.getByText('Ostatnie 12 tygodni')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('dni')).toBeInTheDocument();
    expect(screen.getByText('na aktywny dzień')).toBeInTheDocument();
    expect(screen.getByText('2,5')).toBeInTheDocument();
    expect(screen.getByText('8 października 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Elo|XP|poziom|podpowiedzi/)).not.toBeInTheDocument();
  });

  it('distinguishes no activity, unavailable data and loading without inventing records', () => {
    const { rerender } = render(<ProfileLearningStats activity={[]} loading={false} />);
    expect(screen.getByText(/po pierwszym rozwiązanym pokoju/)).toBeInTheDocument();
    expect(screen.queryByText('Rekord dnia')).not.toBeInTheDocument();
    rerender(<ProfileLearningStats activity={null} loading={false} />);
    expect(screen.getByText(/Statystyki są niedostępne/)).toBeInTheDocument();
    rerender(<ProfileLearningStats activity={null} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Ładowanie statystyk');
  });

  it('uses the latest tied date and preserves large values and singular streak units', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 9, 12));
    const activity = [{ date: '2026-10-01', count: 1234567 }, { date: '2026-10-08', count: 1234567 }];
    expect(profileActivityFacts(activity, new Date()).bestDay?.date).toEqual(new Date(2026, 9, 8, 12));
    render(<ProfileLearningStats activity={activity} loading={false} />);
    expect(screen.getAllByText(/1\s234\s567/)).toHaveLength(2);
    expect(screen.getByText('dzień')).toBeInTheDocument();
    expect(screen.getByText('8 października 2026')).toHaveAttribute('datetime', '2026-10-08');
  });
});
