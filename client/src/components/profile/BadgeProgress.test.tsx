import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BadgeProgress from './BadgeProgress';
import { profileBadges } from '../../test/fixtures/profile';

describe('badge goal progress', () => {
  it('shows actual points and percentage below a threshold', () => {
    render(<BadgeProgress badge={{ ...profileBadges[7], name: '100 punktów',
      progress: { current: 30, target: 100, conditionType: 'POINTS' } }} />);
    expect(screen.getByText('30 / 100 punktów')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '30');
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '100');
  });

  it('keeps awarded achievements completed even if a streak or friend count decreases', () => {
    render(<BadgeProgress badge={{ ...profileBadges[0],
      progress: { current: 0, target: 7, conditionType: 'STREAK' } }} />);
    expect(screen.getByText('7 / 7 dni z rzędu')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('caps progress at the goal and avoids invalid zero-target percentages', () => {
    const { rerender } = render(<BadgeProgress badge={{ ...profileBadges[7],
      progress: { current: 200, target: 100, conditionType: 'POINTS' } }} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100');
    rerender(<BadgeProgress badge={{ ...profileBadges[7],
      progress: { current: 0, target: 0, conditionType: 'POINTS' } }} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '1');
  });

  it('omits a progress bar when the API provides no numeric condition', () => {
    render(<BadgeProgress badge={profileBadges[0]} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
