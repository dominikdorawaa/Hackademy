import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import {
  ConfirmAction,
  DifficultyBadge,
  EmptyState,
  FilePicker,
  LoadingRows,
  PageHeader,
  Section,
  StatusMessage,
} from './AdminUi';
import { errorText, plural } from './adminFormat';

describe('admin formatting helpers', () => {
  it.each([
    [0, 'pokoi'],
    [1, 'pokój'],
    [2, 'pokoje'],
    [4, 'pokoje'],
    [5, 'pokoi'],
    [12, 'pokoi'],
    [14, 'pokoi'],
    [22, 'pokoje'],
    [112, 'pokoi'],
  ])('uses the Polish plural form for %i', (count, expected) => {
    expect(plural(count, ['pokój', 'pokoje', 'pokoi'])).toBe(expected);
  });

  it('prefers the error message and falls back otherwise', () => {
    expect(errorText(new Error('Brak dostępu'), 'Błąd')).toBe('Brak dostępu');
    expect(errorText(new Error(''), 'Błąd')).toBe('Błąd');
    expect(errorText('nie błąd', 'Błąd')).toBe('Błąd');
  });
});

describe('admin UI building blocks', () => {
  it('renders page headers, sections, states and difficulty labels', () => {
    render(<>
      <PageHeader title="Ścieżki" description="Opis strony" actions={<Button>Nowa</Button>} />
      <Section title="Rozdziały" description="Opis sekcji"><p>treść</p></Section>
      <StatusMessage kind="error">Nie udało się</StatusMessage>
      <StatusMessage kind="warning">Uwaga</StatusMessage>
      <StatusMessage kind="success">Zapisano</StatusMessage>
      <EmptyState title="Pusto" description="Dodaj coś" />
      <LoadingRows rows={2} label="Ładowanie listy" />
      <DifficultyBadge difficulty="INSANE" />
    </>);

    expect(screen.getByRole('heading', { level: 1, name: 'Ścieżki' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Rozdziały' })).toHaveTextContent('treść');
    expect(screen.getAllByRole('alert').map((alert) => alert.textContent)).toEqual(['Nie udało się', 'Uwaga']);
    expect(screen.getByRole('status', { name: 'Ładowanie listy' })).toBeInTheDocument();
    expect(screen.getByText('Zapisano')).toBeInTheDocument();
    expect(screen.getByText('Pusto')).toBeInTheDocument();
    expect(screen.getByText('Niemożliwy')).toBeInTheDocument();
  });

  it('runs a confirmed action only after confirmation', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmAction
      title="Usunąć pokój?"
      description="Tej operacji nie można cofnąć."
      confirmLabel="Usuń pokój"
      onConfirm={onConfirm}
      trigger={<Button>Usuń</Button>}
    />);

    await user.click(screen.getByRole('button', { name: 'Usuń' }));
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Usuń' }));
    expect(screen.getByRole('alertdialog', { name: 'Usunąć pokój?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usuń pokój' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('picks and clears a file', async () => {
    function Picker() {
      const [file, setFile] = useState<File | null>(null);
      return <FilePicker id="banner" file={file} onChange={setFile} accept="image/*" />;
    }
    const user = userEvent.setup();
    render(<Picker />);

    expect(screen.getByText('Nie wybrano pliku')).toBeInTheDocument();
    await user.upload(document.getElementById('banner') as HTMLInputElement, new File(['x'], 'baner.png', { type: 'image/png' }));
    expect(screen.getByText('baner.png')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Usuń wybrany plik' }));
    expect(screen.getByText('Nie wybrano pliku')).toBeInTheDocument();
  });
});
