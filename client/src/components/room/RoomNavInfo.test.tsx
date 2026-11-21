import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RoomNavInfo from './RoomNavInfo';

const back = { title: 'Web od środka', label: 'Wróć do ścieżki', onClick: vi.fn() };
const path = {
  title: 'Web od środka',
  currentId: 3,
  chapters: [
    { title: 'Jak działa web', rooms: [{ id: 1, title: 'HTTP', solved: true }, { id: 2, title: 'Nagłówki', solved: true }, { id: 3, title: 'Kodowanie', solved: false }] },
    { title: 'Sesje', rooms: [{ id: 4, title: 'Hasła', solved: false }] },
  ],
};

describe('RoomNavInfo path progress', () => {
  it('shows where the room sits in the path instead of the room bar', () => {
    render(<RoomNavInfo back={back} title="Kodowanie" path={path} progress={{ value: 1, max: 3, label: 'Postęp pokoju' }}
      steps={{ items: [], current: 0, onSelect: vi.fn() }} />);

    const bar = screen.getByRole('progressbar', { name: 'Postęp ścieżki' });
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuetext', 'Pokój 3 z 4. Ukończone pokoje: 2 z 4.');
    expect(screen.getByText('Ścieżka: pokój 3 z 4')).toBeInTheDocument();
    expect(screen.getByText('Jak działa web')).toBeInTheDocument();
    expect([...bar.querySelectorAll('ol')].map(chapter => chapter.children.length)).toEqual([3, 1]);
    expect([...bar.querySelectorAll('li')].map(room => room.className)).toEqual(['is-done', 'is-done', 'is-current', '']);
    expect(screen.queryByRole('progressbar', { name: 'Postęp pokoju' })).not.toBeInTheDocument();
    expect(document.querySelector('.room-nav-steps')).toBeNull();
  });

  it('renders nothing for a room missing from the path', () => {
    render(<RoomNavInfo back={back} title="Inny" path={{ ...path, currentId: 99 }} />);
    expect(screen.queryByRole('progressbar', { name: 'Postęp ścieżki' })).not.toBeInTheDocument();
  });
});
