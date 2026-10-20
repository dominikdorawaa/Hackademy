import { setClerkSession } from '../test/clerk';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { avatarFromUsername, toAvatarConfig } from '../components/arena/avatar/avatarModel';
import { createToken, createUser } from '../test/fixtures/auth';
import { currentUserUrl, onboardingUrl } from '../test/mocks/handlers';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';
import OnboardingPage from './OnboardingPage';
import { PROFILE_UPDATED } from '../lib/profile';
import { DANCE_MS } from '../components/mascot/Mascot';

vi.mock('../components/arena/avatar/useAvatarAtlas', () => ({
  useAvatarAtlas: () => ({ atlas: 'blob:atlas', front: 'blob:front' }),
  useAvatarPortrait: () => 'blob:portrait',
}));

const routes = <>
  <Route path="/witaj" element={<ProtectedRoute onboarding><OnboardingPage /></ProtectedRoute>} />
  <Route path="/dashboard" element={<ProtectedRoute><p>Dashboard</p></ProtectedRoute>} />
</>;
const location = () => screen.getByTestId('location').textContent?.split(':')[0];

beforeEach(() => {
  setClerkSession(createToken());
  server.use(
    http.get(onboardingUrl, () => HttpResponse.json({ avatarConfirmed: false, tourStatus: 'PENDING' })),
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), username: 'nowy', avatar: null })),
  );
});

const openStudio = async () => {
  renderWithAuth(routes, '/witaj');
  expect(await screen.findByRole('heading', { name: 'Witaj w Hackademy, nowy!' })).toHaveFocus();
  expect(screen.getByText('Cześć! Jestem Bit.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Stwórzmy Twojego awatara' }));
  expect(await screen.findByRole('heading', { name: 'Stwórz swojego awatara' })).toHaveFocus();
};

it('greets a new account, requires a confirmed avatar and saves the chosen look', async () => {
  let body: unknown = null;
  server.use(http.post(`${onboardingUrl}/avatar`, async ({ request }) => {
    body = await request.json();
    return HttpResponse.json({ avatarConfirmed: true, tourStatus: 'PENDING' });
  }));
  const updated = vi.fn();
  window.addEventListener(PROFILE_UPDATED, updated);
  await openStudio();
  expect(screen.getByRole('img', { name: 'Twój awatar, widok z przodu' })).toHaveAttribute('src', 'blob:front');
  fireEvent.click(screen.getByRole('radio', { name: /Dres/ }));
  fireEvent.click(screen.getByRole('tab', { name: 'Kolory' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Góra: Czerwony' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Ikona profilu' }));
  fireEvent.click(screen.getByRole('radio', { name: /Profil/ }));
  expect(screen.getByText(/Wybierz pozę ikony/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Zatwierdzam mój awatar' }));
  expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  expect(location()).toBe('/dashboard');
  const start = toAvatarConfig(avatarFromUsername('nowy'));
  expect(body).toEqual({ ...start, outfit: 'dres', topColor: 'czerwony', pose: 'profil' });
  expect(updated).toHaveBeenCalledTimes(1);
  window.removeEventListener(PROFILE_UPDATED, updated);
});

it('keeps the choices after a failed save and only finishes after a successful retry', async () => {
  let attempts = 0;
  server.use(http.post(`${onboardingUrl}/avatar`, () => (++attempts === 1
    ? HttpResponse.json({ message: 'Błąd' }, { status: 500 })
    : HttpResponse.json({ avatarConfirmed: true, tourStatus: 'PENDING' }))));
  await openStudio();
  fireEvent.click(screen.getByRole('radio', { name: /Bluza/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Zatwierdzam mój awatar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Twój awatar nie został zapisany na koncie.');
  expect(location()).toBe('/witaj');
  expect(screen.getByRole('radio', { name: /Bluza/ })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  expect(attempts).toBe(2);
});

it('does not treat a reply without confirmation as done', async () => {
  server.use(http.post(`${onboardingUrl}/avatar`, () => HttpResponse.json({ avatarConfirmed: false, tourStatus: 'PENDING' })));
  await openStudio();
  fireEvent.click(screen.getByRole('button', { name: 'Zatwierdzam mój awatar' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(location()).toBe('/witaj');
});

it('starts from the saved account avatar and offers a retry when the account cannot load', async () => {
  let calls = 0;
  server.use(http.get(currentUserUrl, () => (++calls <= 2
    ? HttpResponse.json({}, { status: 500 })
    : HttpResponse.json({ ...createUser(), username: 'nowy', avatar: { outfit: 'bluza', hair: 'kucyk', hat: 'brak', skin: 'jasna', hairColor: 'rude', topColor: 'bialy', bottomColor: 'granatowy', shoesColor: 'czerwony', hatColor: 'bialy', pose: 'postawa' } }))));
  renderWithAuth(routes, '/witaj');
  fireEvent.click(await screen.findByRole('button', { name: 'Stwórzmy Twojego awatara' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /Bluza/ })).toBeChecked());
  const tabs = within(screen.getByRole('tablist', { name: 'Kategorie' }));
  fireEvent.click(tabs.getByRole('tab', { name: 'Fryzura i czapka' }));
  expect(screen.getByRole('radio', { name: 'Kucyk' })).toBeChecked();
});

it('is reachable from the API helper for the tour too', async () => {
  let status: unknown = null;
  server.use(http.post(`${API_URL}/api/user/me/onboarding/tour`, async ({ request }) => { status = await request.json(); return HttpResponse.json({ avatarConfirmed: true, tourStatus: 'SKIPPED' }); }));
  const { finishTour } = await import('../services/onboardingApi');
  const response = await finishTour('SKIPPED', { sessionKey: null });
  expect(await response.json()).toEqual({ avatarConfirmed: true, tourStatus: 'SKIPPED' });
  expect(status).toEqual({ status: 'SKIPPED' });
});

it('lets Bit dance the Scuba on the welcome screen and then calm down again', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  try {
    renderWithAuth(routes, '/witaj');
    const bit = await screen.findByRole('button', { name: 'Pingwin Bit, zatańcz' });
    const mood = () => bit.querySelector('.mascot')?.getAttribute('data-mood');
    expect(mood()).toBe('calm');
    expect(screen.queryByText(/Kliknij Bita/)).toBeNull();
    fireEvent.click(bit);
    expect(mood()).toBe('scuba');
    await act(async () => { await vi.advanceTimersByTimeAsync(DANCE_MS + 100); });
    expect(mood()).toBe('calm');
  } finally {
    vi.useRealTimers();
  }
});
