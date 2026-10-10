import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProfileBadges from './ProfileBadges';
import { profileBadges } from '../../test/fixtures/profile';

describe('achievement showcase', () => {
  it('shows completion, unlocked and locked icons, and the selected requirement', () => {
    render(<ProfileBadges badges={profileBadges} />);
    expect(screen.getByText('7/8')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    const locked = screen.getByRole('group', { name: 'Zablokowane odznaki' });
    fireEvent.click(within(locked).getByRole('button', { name: 'Odznaka 8 - zablokowana' }));
    expect(screen.getByText('Opis odznaki 8')).toBeInTheDocument();
    expect(screen.getByText('Do zdobycia')).toBeInTheDocument();
    expect(within(locked).getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the matching collection from +N and resets pagination when filtering', () => {
    const locked = Array.from({ length: 20 }, (_, index) => ({
      ...profileBadges[7], id: 100 + index, name: `Locked ${index}`, earned: false,
    }));
    render(<ProfileBadges badges={[...profileBadges.slice(0, 7), ...locked]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Zobacz zablokowane odznaki - pozostało 14' }));
    expect(screen.getByRole('combobox', { name: 'Filtr odznak' })).toHaveValue('locked');
    expect(within(screen.getByRole('list', { name: 'Lista odznak' })).getAllByRole('listitem')).toHaveLength(6);
    fireEvent.click(screen.getByRole('button', { name: 'Następna strona odznak' }));
    expect(screen.getByRole('combobox', { name: 'Strona odznak' })).toHaveValue('1');
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtr odznak' }), { target: { value: 'earned' } });
    expect(screen.getByRole('combobox', { name: 'Strona odznak' })).toHaveValue('0');
    expect(within(screen.getByRole('dialog')).getByText('Odznaka 7')).toBeInTheDocument();
    expect(screen.queryByText('Locked 0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zamknij osiągnięcia' }));
    expect(screen.getByText('Zablokowane osiągnięcia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zobacz zablokowane odznaki - pozostało 14' })).toHaveFocus();
  });

  it('offers locked achievements even when none have been earned', () => {
    render(<ProfileBadges badges={profileBadges.map(badge => ({ ...badge, earned: false, earnedAt: null }))} />);
    expect(screen.getByText('0/8')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Zablokowane odznaki' })).toBeInTheDocument();
    expect(screen.getByText('Do zdobycia')).toBeInTheDocument();
  });

  it('shows progress only in the full collection, separately from global rarity', () => {
    render(<ProfileBadges badges={[{ ...profileBadges[7], name: 'Script Kiddie',
      progress: { current: 30, target: 100, conditionType: 'POINTS' } }]} />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Script Kiddie - zablokowana' }));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Zobacz wszystkie odznaki' }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByText('30 / 100 punktów')).toBeInTheDocument();
    expect(within(modal).getByRole('progressbar', { name: 'Postęp osiągnięcia: Script Kiddie' })).toHaveAttribute('value', '30');
    fireEvent.click(within(modal).getByRole('tab', { name: 'Osiągnięcia globalne' }));
    expect(within(modal).queryByRole('progressbar', { name: 'Postęp osiągnięcia: Script Kiddie' })).not.toBeInTheDocument();
    expect(within(modal).getByRole('progressbar', { name: 'Popularność: Script Kiddie' })).toHaveAttribute('value', '12.5');
  });

  it('opens a modal with search, global rarity, and restores the profile on Escape', () => {
    render(<ProfileBadges badges={profileBadges} />);
    const trigger = screen.getByRole('button', { name: 'Zobacz wszystkie odznaki' });
    fireEvent.click(trigger);
    const modal = screen.getByRole('dialog', { name: 'Osiągnięcia Hackademy' });
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(modal).getByRole('tab', { name: 'Moje osiągnięcia' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(within(modal).getByRole('searchbox', { name: 'Szukaj osiągnięć' }), { target: { value: 'Odznaka 8' } });
    expect(within(modal).getAllByRole('listitem')).toHaveLength(1);
    expect(within(modal).getByText('Opis odznaki 8')).toBeVisible();
    expect(within(modal).getByText('Do zdobycia')).toBeInTheDocument();
    fireEvent.change(within(modal).getByRole('searchbox'), { target: { value: 'nonexistent' } });
    expect(within(modal).getByRole('status')).toHaveTextContent('Brak osiągnięć');
    fireEvent.change(within(modal).getByRole('searchbox'), { target: { value: '' } });
    fireEvent.click(within(modal).getByRole('tab', { name: 'Osiągnięcia globalne' }));
    expect(within(modal).queryByRole('combobox', { name: 'Filtr odznak' })).not.toBeInTheDocument();
    expect(within(modal).getByRole('progressbar', { name: 'Popularność: Odznaka 1' })).toHaveAttribute('value', '12.5');
    fireEvent(modal, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(screen.getByRole('button', { name: 'Zobacz wszystkie odznaki' })).toHaveFocus();
  });
});
