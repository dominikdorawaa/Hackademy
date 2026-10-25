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

const availabilityUrl = `${API_URL}/api/user/me/username/availability`;
const usernameUrl = `${API_URL}/api/user/me/username`;

const openName = async () => {
  renderWithAuth(routes, '/witaj');
  expect(await screen.findByRole('heading', { name: 'Witaj w Hackademy, nowy!' })).toHaveFocus();
  expect(screen.getByText('Krok 1 z 3')).toBeInTheDocument();
  expect(screen.getByText('Cześć! Jestem Bit.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Wybierz swoją nazwę' }));
  expect(await screen.findByRole('heading', { name: 'Jak mamy Cię nazywać?' })).toHaveFocus();
  expect(screen.getByText('Krok 2 z 3')).toBeInTheDocument();
};

const openStudio = async () => {
  await openName();
  expect(screen.getByRole('textbox', { name: 'Nazwa profilu' })).toHaveValue('nowy');
  fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
  expect(await screen.findByRole('heading', { name: 'Stwórz swojego awatara' })).toHaveFocus();
  expect(screen.getByText('Krok 3 z 3')).toBeInTheDocument();
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
  fireEvent.click(screen.getByRole('tab', { name: 'Finisher' }));
  expect(screen.getByText(/Wybierz cios/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /^Ctrl\+Alt\+Del/ }));
  fireEvent.click(screen.getByRole('tab', { name: 'Taniec' }));
  expect(screen.getByText(/Wybierz taniec/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /^Scuba/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Zatwierdzam mój awatar' }));
  expect(await screen.findByText('Dashboard')).toBeInTheDocument();
  expect(location()).toBe('/dashboard');
  const start = toAvatarConfig(avatarFromUsername('nowy'));
  expect(body).toEqual({ ...start, outfit: 'dres', topColor: 'czerwony', pose: 'profil', finisher: 'combo', victoryDance: 'scuba' });
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
  server.use(http.get(currentUserUrl, () => (++calls <= 1
    ? HttpResponse.json({}, { status: 500 })
    : HttpResponse.json({ ...createUser(), username: 'nowy', avatar: { outfit: 'bluza', hair: 'kucyk', hat: 'brak', skin: 'jasna', hairColor: 'rude', topColor: 'bialy', bottomColor: 'granatowy', shoesColor: 'czerwony', hatColor: 'bialy', pose: 'postawa' } }))));
  renderWithAuth(routes, '/witaj');
  fireEvent.click(await screen.findByRole('button', { name: 'Wybierz swoją nazwę' }));
  expect(screen.getByRole('textbox', { name: 'Nazwa profilu' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
  fireEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Nazwa profilu' })).toHaveValue('nowy'));
  fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /Bluza/ })).toBeChecked());
  const tabs = within(screen.getByRole('tablist', { name: 'Kategorie' }));
  fireEvent.click(tabs.getByRole('tab', { name: 'Fryzura i czapka' }));
  expect(screen.getByRole('radio', { name: 'Kucyk' })).toBeChecked();
});

it('requires a valid free profile name and saves a new one before the avatar', async () => {
  const checked: string[] = [];
  let renamed: unknown = null;
  server.use(
    http.get(availabilityUrl, ({ request }) => {
      const name = new URL(request.url).searchParams.get('name')!;
      checked.push(name);
      return HttpResponse.json(name.toLowerCase() === 'zajety' ? { available: false, reason: 'taken', message: 'Ta nazwa jest zajęta' } : { available: true, reason: null, message: null });
    }),
    http.patch(usernameUrl, async ({ request }) => {
      renamed = await request.json();
      return HttpResponse.json({ username: 'Haker_1' });
    }),
  );
  const updated: unknown[] = [];
  const listener = (event: Event) => updated.push((event as CustomEvent).detail);
  window.addEventListener(PROFILE_UPDATED, listener);
  await openName();
  const input = screen.getByRole('textbox', { name: 'Nazwa profilu' });
  const next = screen.getByRole('button', { name: 'Dalej' });
  fireEvent.change(input, { target: { value: 'ab' } });
  expect(document.getElementById('onboarding-username-status')).toHaveTextContent('Nazwa użytkownika musi mieć od 3 do 20 znaków');
  expect(next).toBeDisabled();
  fireEvent.change(input, { target: { value: 'zła nazwa' } });
  expect(document.getElementById('onboarding-username-status')).toHaveTextContent('Nazwa może zawierać tylko litery, cyfry, _ i -');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  fireEvent.change(input, { target: { value: 'Zajety' } });
  expect(document.getElementById('onboarding-username-status')).toHaveTextContent('Sprawdzam, czy nazwa jest wolna');
  expect(await screen.findByText('Ta nazwa jest zajęta')).toBeInTheDocument();
  expect(next).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Haker_1' } });
  expect(await screen.findByText('Ta nazwa jest wolna.')).toBeInTheDocument();
  expect(checked).toEqual(['Zajety', 'Haker_1']);
  fireEvent.click(next);
  expect(await screen.findByRole('heading', { name: 'Stwórz swojego awatara' })).toBeInTheDocument();
  expect(renamed).toEqual({ newUsername: 'Haker_1' });
  expect(updated).toEqual([{ username: 'Haker_1', previousUsername: 'nowy' }]);
  window.removeEventListener(PROFILE_UPDATED, listener);
});

it('keeps the player on the name step when someone takes the name first', async () => {
  server.use(
    http.get(availabilityUrl, () => HttpResponse.json({ available: true, reason: null, message: null })),
    http.patch(usernameUrl, () => HttpResponse.json({ message: 'Ta nazwa jest zajęta' }, { status: 409 })),
  );
  await openName();
  fireEvent.change(screen.getByRole('textbox', { name: 'Nazwa profilu' }), { target: { value: 'wyscig' } });
  expect(await screen.findByText('Ta nazwa jest wolna.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
  expect(await screen.findByText('Ta nazwa jest zajęta')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Jak mamy Cię nazywać?' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
});

it('shows the rule the server refused the name with', async () => {
  server.use(
    http.get(availabilityUrl, () => HttpResponse.json({ available: true, reason: null, message: null })),
    http.patch(usernameUrl, () => HttpResponse.json({ message: 'Validation failed', newUsername: 'Nazwa użytkownika jest wymagana' }, { status: 400 })),
  );
  await openName();
  fireEvent.change(screen.getByRole('textbox', { name: 'Nazwa profilu' }), { target: { value: 'poprawna' } });
  expect(await screen.findByText('Ta nazwa jest wolna.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
  expect(await screen.findByText('Nazwa użytkownika jest wymagana')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Nazwa profilu' })).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
});

it('explains a failed rename and lets the player try again', async () => {
  let attempts = 0;
  server.use(
    http.get(availabilityUrl, () => HttpResponse.error()),
    http.patch(usernameUrl, () => (++attempts === 1 ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json({ username: 'nowa_nazwa' }))),
  );
  await openName();
  fireEvent.change(screen.getByRole('textbox', { name: 'Nazwa profilu' }), { target: { value: 'nowa_nazwa' } });
  expect(await screen.findByText(/Nie udało się sprawdzić nazwy/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
  expect(await screen.findByText('Nie udało się zapisać nazwy. Spróbuj ponownie.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
  expect(await screen.findByRole('heading', { name: 'Stwórz swojego awatara' })).toBeInTheDocument();
  expect(attempts).toBe(2);
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
