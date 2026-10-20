import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Navbar from '../Navbar';
import { renderWithAuth } from '../../test/renderWithAuth';
import RoomChromeProvider from './RoomChromeProvider';
import RoomFooterBar from './RoomFooterBar';
import RoomFrame from './RoomFrame';
import RoomSplit from './RoomSplit';

const nav = {
  back: { title: 'Linux', label: 'Wróć do ścieżki: Linux', to: '/learn/paths/1' },
  title: 'Terminal',
  progress: { value: 1, max: 4, label: 'Postęp pokoju' },
};

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <RoomChromeProvider>
      <Navbar />
      {open && <RoomFrame label="Pokój" nav={nav}><p>Treść pokoju</p></RoomFrame>}
      <button type="button" onClick={() => setOpen(false)}>Zamknij pokój</button>
    </RoomChromeProvider>
  );
}

describe('room frame', () => {
  it('moves the room trail and progress into the navbar and restores the site links after leaving', async () => {
    renderWithAuth(<Route path="*" element={<Harness />} />, '/rooms/1');
    const navbar = screen.getByRole('navigation', { name: 'Nawigacja główna' });
    expect(await within(navbar).findByRole('link', { name: 'Wróć do ścieżki: Linux' })).toHaveAttribute('href', '/learn/paths/1');
    expect(within(navbar).getByRole('progressbar', { name: 'Postęp pokoju' })).toHaveAttribute('aria-valuetext', '25%');
    expect(within(navbar).getByText('Terminal')).toBeInTheDocument();
    expect(within(navbar).queryByRole('link', { name: 'Ranking' })).not.toBeInTheDocument();
    expect(navbar).toHaveClass('navbar--room');
    await userEvent.click(screen.getByRole('button', { name: 'Zamknij pokój' }));
    expect(within(navbar).queryByRole('progressbar')).not.toBeInTheDocument();
    expect(within(navbar).getByRole('link', { name: 'Ranking' })).toBeInTheDocument();
    expect(navbar).not.toHaveClass('navbar--room');
  });

  it('shows its own bar outside the site layout', async () => {
    const back = vi.fn();
    render(
      <MemoryRouter>
        <RoomFrame label="Podgląd" nav={{ ...nav, back: { title: 'Edycja', label: 'Powrót', onClick: back }, progress: { value: 0, max: 0, label: 'Postęp' } }}>
          <p>Treść</p>
        </RoomFrame>
      </MemoryRouter>,
    );
    expect(screen.getByRole('progressbar', { name: 'Postęp' })).toHaveAttribute('aria-valuetext', '0%');
    await userEvent.click(screen.getByRole('button', { name: 'Powrót' }));
    expect(back).toHaveBeenCalled();
  });
});

describe('room split', () => {
  it('resizes the panes with the keyboard and by dragging', () => {
    render(<RoomSplit start={<p>Lewy</p>} end={<p>Prawy</p>} initial={0.42} />);
    const handle = screen.getByRole('separator', { name: 'Szerokość paneli' });
    fireEvent.keyDown(handle, { key: 'ArrowRight' });
    expect(handle).toHaveAttribute('aria-valuenow', '44');
    fireEvent.keyDown(handle, { key: 'End' });
    expect(handle).toHaveAttribute('aria-valuenow', '72');
    fireEvent.keyDown(handle, { key: 'Home' });
    expect(handle).toHaveAttribute('aria-valuenow', '28');
    fireEvent.keyDown(handle, { key: 'Enter' });
    expect(handle).toHaveAttribute('aria-valuenow', '28');
    const box = handle.parentElement as HTMLElement;
    box.getBoundingClientRect = () => ({ left: 100, width: 1000, top: 0, right: 1100, bottom: 0, height: 0, x: 100, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(handle, { clientX: 700 });
    expect(handle).toHaveAttribute('aria-valuenow', '28');
    fireEvent.pointerDown(handle, { pointerId: 1 });
    expect(box).toHaveClass('is-dragging');
    fireEvent.pointerMove(handle, { clientX: 700 });
    expect(handle).toHaveAttribute('aria-valuenow', '60');
    fireEvent.pointerMove(handle, { clientX: 1100 });
    expect(handle).toHaveAttribute('aria-valuenow', '72');
    fireEvent.pointerUp(handle, { pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 300 });
    expect(handle).toHaveAttribute('aria-valuenow', '72');
    fireEvent.pointerDown(handle, { pointerId: 2 });
    fireEvent.pointerCancel(handle);
    expect(box).not.toHaveClass('is-dragging');
  });
});

describe('room footer', () => {
  const steps = [
    { key: 1, title: 'Pierwszy', done: true },
    { key: 2, title: 'Drugi', done: false },
    { key: 3, title: 'Trzeci', done: false, locked: true },
  ];

  it('lists steps, closes the list with Escape or an outside click and moves between steps', async () => {
    const user = userEvent.setup();
    const select = vi.fn();
    const back = vi.fn();
    const next = vi.fn();
    render(
      <>
        <RoomFooterBar steps={steps} current={1} unit="Krok" listLabel="Kroki" title="Drugi" onSelect={select}
          center={<span>Środek</span>}
          back={{ label: 'Wstecz', onClick: back }} next={{ label: 'Dalej', onClick: next, primary: true }} />
        <p>Poza listą</p>
      </>,
    );
    expect(screen.getByText('Krok 2 / 3')).toBeInTheDocument();
    expect(screen.getByText('Środek')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Kroki' });
    await user.click(toggle);
    const list = screen.getByRole('navigation', { name: 'Kroki' });
    expect(within(list).getByRole('button', { name: /Drugi/ })).toHaveAttribute('aria-current', 'step');
    expect(within(list).getByRole('button', { name: /Trzeci/ })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('navigation', { name: 'Kroki' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
    await user.click(toggle);
    await user.keyboard('a');
    expect(screen.getByRole('navigation', { name: 'Kroki' })).toBeInTheDocument();
    await user.click(screen.getByText('Poza listą'));
    expect(screen.queryByRole('navigation', { name: 'Kroki' })).not.toBeInTheDocument();
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Pierwszy, ukończone' }));
    expect(select).toHaveBeenCalledWith(0);
    await user.click(screen.getByRole('button', { name: 'Wstecz' }));
    await user.click(screen.getByRole('button', { name: 'Dalej' }));
    expect(back).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
