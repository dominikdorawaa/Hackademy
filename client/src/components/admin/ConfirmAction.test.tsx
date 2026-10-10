import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmAction } from './AdminUi';

function mount(onConfirm: () => Promise<void>) {
  render(<ConfirmAction trigger={<button>Usuń pokój</button>} title="Potwierdzenie"
    description="Usunąć pokój?" confirmLabel="Potwierdź" onConfirm={onConfirm} />);
}

describe('ConfirmAction', () => {
  it('keeps the dialog open and blocks repeated actions until the request finishes', async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    mount(onConfirm);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Usuń pokój' }));
    await user.click(screen.getByRole('button', { name: 'Potwierdź' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trwa wykonywanie…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Usuń pokój', hidden: true })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Trwa wykonywanie…' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuń pokój' })).toBeEnabled();
  });

  it('shows rejected actions and allows retrying', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('Błąd usuwania')).mockResolvedValueOnce(undefined);
    mount(onConfirm);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Usuń pokój' }));
    await user.click(screen.getByRole('button', { name: 'Potwierdź' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Błąd usuwania');
    await user.click(screen.getByRole('button', { name: 'Potwierdź' }));
    expect(onConfirm).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
