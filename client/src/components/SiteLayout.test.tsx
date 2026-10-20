import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, Route } from 'react-router-dom';
import { expect, it } from 'vitest';
import { renderWithAuth } from '../test/renderWithAuth';
import SiteLayout from './SiteLayout';
import RoomFrame from './room/RoomFrame';

const nav = {
  back: { title: 'Nauka', label: 'Wróć do nauki', to: '/info' },
  title: 'Terminal',
  progress: { value: 0, max: 1, label: 'Postęp pokoju' },
};

it('fills the screen with a room and brings the site footer back on other pages', async () => {
  const { container } = renderWithAuth(
    <Route element={<SiteLayout />}>
      <Route path="/room" element={<RoomFrame label="Pokój" nav={nav}><p>Treść pokoju</p></RoomFrame>} />
      <Route path="/info" element={<Link to="/room">Do pokoju</Link>} />
    </Route>,
    '/room',
  );
  expect(await screen.findByRole('link', { name: 'Wróć do nauki' })).toBeInTheDocument();
  expect(container.querySelector('.site-shell--room')).not.toBeNull();
  expect(screen.queryByText('Regulamin')).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'Wróć do nauki' }));
  expect(await screen.findByText('Regulamin')).toBeInTheDocument();
  expect(container.querySelector('.site-shell--room')).toBeNull();
  await userEvent.click(screen.getByRole('link', { name: 'Do pokoju' }));
  expect(await screen.findByRole('link', { name: 'Wróć do nauki' })).toBeInTheDocument();
});
