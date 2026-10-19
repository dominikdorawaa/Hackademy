import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route } from 'react-router-dom';
import { beforeEach, expect, it } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import { createToken } from '../../test/fixtures/auth';
import { onboardingUrl } from '../../test/mocks/handlers';
import { server } from '../../test/mocks/server';
import { renderWithAuth } from '../../test/renderWithAuth';

const routes = <>
  <Route path="/login" element={<p>Logowanie</p>} />
  <Route path="/witaj" element={<ProtectedRoute onboarding><p>Powitanie</p></ProtectedRoute>} />
  <Route path="/dashboard" element={<ProtectedRoute><p>Dashboard</p></ProtectedRoute>} />
  <Route path="/arena" element={<ProtectedRoute><p>Arena</p></ProtectedRoute>} />
</>;
const location = () => screen.getByTestId('location').textContent?.split(':')[0];

beforeEach(() => localStorage.setItem('token', createToken()));

it('sends a new account to the welcome step from any protected address', async () => {
  server.use(http.get(onboardingUrl, () => HttpResponse.json({ avatarConfirmed: false, tourStatus: 'PENDING' })));
  renderWithAuth(routes, '/arena');
  expect(await screen.findByText('Powitanie')).toBeInTheDocument();
  expect(location()).toBe('/witaj');
  expect(screen.queryByText('Arena')).toBeNull();
});

it('lets a confirmed account in and keeps it away from the welcome step', async () => {
  renderWithAuth(routes, '/witaj');
  expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  expect(location()).toBe('/dashboard');
});

it('does not open the app when the account state cannot be read, and retries', async () => {
  let calls = 0;
  server.use(http.get(onboardingUrl, () => (++calls === 1 ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json({ avatarConfirmed: false, tourStatus: 'PENDING' }))));
  renderWithAuth(routes, '/dashboard');
  expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się sprawdzić Twojego konta.');
  expect(screen.queryByText('Dashboard')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  await waitFor(() => expect(location()).toBe('/witaj'));
});

it('still sends guests to the login page', async () => {
  localStorage.removeItem('token');
  renderWithAuth(routes, '/witaj');
  expect(await screen.findByText('Logowanie')).toBeInTheDocument();
});
