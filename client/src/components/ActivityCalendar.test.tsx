import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import ActivityCalendar from './ActivityCalendar';
import { activityDays, activitySummary, localDateKey } from '../lib/activity';

describe('activity calendar', () => {
  it('keeps local dates at month, year and daylight saving boundaries', () => {
    const dates = activityDays(new Date(2026, 0, 2));
    expect(dates).toHaveLength(84);
    expect(localDateKey(dates.at(-1)!)).toBe('2026-01-02');
    expect(dates.map(localDateKey)).toContain('2025-12-31');
    expect(localDateKey(new Date(2026, 2, 29, 0, 30))).toBe('2026-03-29');
  });

  it('summarizes only the selected period without treating it as lifetime totals', () => {
    const dates = activityDays(new Date(2026, 0, 2));
    expect(
      activitySummary(
        [
          { date: '2026-01-02', count: 3 },
          { date: '2025-12-31', count: 1 },
          { date: '2024-01-01', count: 100 },
          { date: '2026-01-03', count: 100 },
        ],
        dates,
      ),
    ).toEqual({ solved: 4, activeDays: 2 });
  });

  it('keeps the calendar compact and limits totals to twelve weeks', () => {
    const today = new Date();
    const old = new Date(today);
    old.setDate(old.getDate() - 100);
    render(
      <ActivityCalendar
        data={[
          { date: localDateKey(today), count: 2 },
          { date: localDateKey(old), count: 3 },
        ]}
      />,
    );
    expect(
      document.querySelectorAll('[data-slot="activity-day"]'),
    ).toHaveLength(84);
    expect(
      screen.getByText('2', { selector: '.activity-calendar-summary strong' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /kalendarz/ }),
    ).not.toBeInTheDocument();
  });

  it('supports keyboard movement and makes counts available without hovering', async () => {
    render(<ActivityCalendar data={[]} />);
    const days = document.querySelectorAll<HTMLButtonElement>(
      '[data-slot="activity-day"]',
    );
    days[83].focus();
    const user = userEvent.setup();
    await user.keyboard('{ArrowLeft}');
    expect(days[76]).toHaveFocus();
    expect(
      screen.getByText(days[76].getAttribute('aria-label')!, {
        selector: '.activity-calendar-detail',
      }),
    ).toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    expect(days[75]).toHaveFocus();
  });
});
