import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RoomTypeChoice, RoomTypeIcon, roomTypeLabel } from './RoomTypeChoice';
import type { RoomType } from '../../types/api';

function Choice({ compact = false }: { compact?: boolean }) {
  const [value, setValue] = useState<RoomType | null>(null);
  return <><RoomTypeChoice label="Typ pokoju" value={value} onChange={setValue} compact={compact} /><output>{value ?? 'brak'}</output></>;
}

describe('room type choice', () => {
  it('offers both types as tiles and moves the choice with arrow keys', async () => {
    const user = userEvent.setup(); render(<Choice />);
    const group = screen.getByRole('radiogroup', { name: 'Typ pokoju' });
    const [theory, ctf] = screen.getAllByRole('radio');
    expect(group).toBeInTheDocument();
    expect(theory).toHaveAttribute('tabindex', '0');
    expect(ctf).toHaveAttribute('tabindex', '-1');
    expect(screen.getByText('Opcjonalnie VPN i plik do pobrania')).toBeInTheDocument();
    await user.click(ctf);
    expect(ctf).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('CTF');
    await user.keyboard('{ArrowRight}');
    expect(theory).toBeChecked();
    expect(theory).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(ctf).toBeChecked();
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowLeft}');
    expect(ctf).toBeChecked();
  });

  it('keeps the compact switch to the type names', () => {
    render(<Choice compact />);
    expect(screen.getByRole('radio', { name: 'Teoria' })).toBeInTheDocument();
    expect(screen.queryByText('Pytanie i odpowiedź')).toBeNull();
  });

  it('names a type for icons and defaults to theory', () => {
    render(<><RoomTypeIcon type="CTF" labelled /><RoomTypeIcon type={undefined} /></>);
    expect(screen.getByRole('img', { name: 'CTF' })).toBeInTheDocument();
    expect(roomTypeLabel(undefined)).toBe('Teoria');
  });
});
