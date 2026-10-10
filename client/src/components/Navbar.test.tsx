import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route } from 'react-router-dom';
import { expect, it } from 'vitest';
import Navbar from './Navbar';
import API_URL from '../apiConfig';
import { createToken } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';
import type { Challenge, FriendRequestDto } from '../types/api';

it('opens navigation, closes it with Escape and restores focus, then closes after following a link', async () => {
  localStorage.setItem('token', createToken());
  server.use(
    http.get(`${API_URL}/api/friends/requests`, () => HttpResponse.json<FriendRequestDto[]>([])),
    http.get(`${API_URL}/api/arena/challenges`, () => HttpResponse.json<Challenge[]>([])),
  );
  renderWithAuth(<Route path="*" element={<Navbar />} />, '/profile');
  await screen.findByRole('button', { name: 'Menu konta' });
  const user = userEvent.setup();
  const menu = screen.getByRole('button', { name: /^Menu$/ });
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  await user.click(menu);
  expect(menu).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById('main-nav-links')).toHaveClass('mobile-nav-open');
  await user.keyboard('{Escape}');
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  expect(menu).toHaveFocus();
  await user.click(menu);
  await user.click(screen.getByRole('link', { name: 'Ucz się' }));
  expect(screen.getByTestId('location')).toHaveTextContent('/learn:PUSH');
  expect(menu).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByRole('button', { name: 'Menu konta' }));
  expect(screen.getByRole('link', { name: 'Profil' })).toBeInTheDocument();
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('link', { name: 'Profil' })).not.toBeInTheDocument(),
  );
});
