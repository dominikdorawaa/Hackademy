import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { RoomTypeHelp, RoomTypeIcon, RoomTypeSwitch, roomTypeLabel } from './RoomType';
import type { RoomType } from '../../types/api';

function Switch() {
  const [value, setValue] = useState<RoomType>('PATH');
  return <><RoomTypeSwitch label="Typ pokoju" value={value} onChange={setValue} /><output>{value}</output></>;
}

describe('room type', () => {
  it('switches the type with clicks and arrow keys', async () => {
    const user = userEvent.setup(); render(<Switch />);
    expect(screen.getByRole('radiogroup', { name: 'Typ pokoju' })).toBeInTheDocument();
    const theory = screen.getByRole('radio', { name: 'Teoria' });
    const ctf = screen.getByRole('radio', { name: 'CTF' });
    expect(theory).toBeChecked();
    expect(ctf).toHaveAttribute('tabindex', '-1');
    await user.click(ctf);
    expect(screen.getByRole('status')).toHaveTextContent('CTF');
    await user.keyboard('{ArrowRight}');
    expect(theory).toBeChecked();
    expect(theory).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(ctf).toBeChecked();
  });

  it('explains both types on keyboard focus and on tap', async () => {
    render(<RoomTypeHelp />);
    const button = screen.getByRole('button', { name: 'Czym różnią się typy pokoi?' });
    act(() => button.focus());
    const help = await screen.findByRole('dialog', { name: 'Typy pokoi' });
    expect(help).toHaveTextContent('Dobre do nauki pojęć.');
    expect(help).toHaveTextContent('HACK{...}');
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    act(() => button.blur());
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('names a type for icons and defaults to theory', () => {
    render(<><RoomTypeIcon type="CTF" labelled /><RoomTypeIcon type={undefined} /></>);
    expect(screen.getByRole('img', { name: 'CTF' })).toBeInTheDocument();
    expect(roomTypeLabel(undefined)).toBe('Teoria');
  });
});
