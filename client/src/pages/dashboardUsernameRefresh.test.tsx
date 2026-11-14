import { setClerkSession } from '../test/clerk';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { NotificationPreferencesProvider } from '../context/NotificationPreferencesContext';
import { createToken, createUser } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import UserDashboardPage from './UserDashboardPage';
import SettingsPage from './SettingsPage';

it('shows the new name on the dashboard after a rename in settings without signing in again', async () => {
  let username = 'gracz224448';
  let summaries = 0;
  server.use(
    http.get(`${API_URL}/api/user/me`, () => HttpResponse.json({ ...createUser(), username })),
    http.get(`${API_URL}/api/dashboard/summary`, () => {
      summaries++;
      return HttpResponse.json({ user: { ...createUser(), username, points: 120 }, ranking: [{ username, points: 120 }], myRank: null, recentSolved: [], pathsProgress: [] });
    }),
    http.patch(`${API_URL}/api/user/me/username`, async ({ request }) => {
      username = (await request.json() as { newUsername: string }).newUsername;
      return HttpResponse.json({ username });
    }),
    http.get(`${API_URL}/api/user/me/recent-solved`, () => HttpResponse.json([])),
    http.post(`${API_URL}/api/user/me/active-time`, () => HttpResponse.json({ secondsThisWeek: 0 })),
  );
  setClerkSession(createToken());
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthProvider><ThemeProvider><NotificationPreferencesProvider>
        <nav><Link to="/dashboard">Wróć do dashboardu</Link><Link to="/settings?section=account">Otwórz ustawienia</Link></nav>
        <Routes>
          <Route path="/dashboard" element={<UserDashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </NotificationPreferencesProvider></ThemeProvider></AuthProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByRole('heading', { name: 'Cześć, gracz224448.' })).toBeInTheDocument();
  expect(within(screen.getByRole('link', { name: /Poziom/ })).getByText('gracz224448')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('link', { name: 'Otwórz ustawienia' }));
  const field = await screen.findByLabelText('Nazwa użytkownika');
  expect(field).toHaveValue('gracz224448');
  fireEvent.change(field, { target: { value: 'nowy_gracz' } });
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }));
  await screen.findByText('Nazwa użytkownika została zmieniona.');

  fireEvent.click(screen.getByRole('link', { name: 'Wróć do dashboardu' }));
  expect(await screen.findByRole('heading', { name: 'Cześć, nowy_gracz.' })).toBeInTheDocument();
  expect(within(screen.getByRole('link', { name: /Poziom/ })).getByText('nowy_gracz')).toBeInTheDocument();
  expect(screen.queryByText(/gracz224448/)).not.toBeInTheDocument();
  expect(summaries).toBe(2);
});
