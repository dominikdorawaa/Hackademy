import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { NotificationPreferencesProvider } from '../context/NotificationPreferencesContext';
import { createToken } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import API_URL from '../apiConfig';
import { defaultNotificationPreferences } from '../services/userApi';
import SettingsPage from './SettingsPage';

const sounds = vi.hoisted(() => ({ play: vi.fn(() => true), unlock: vi.fn(async () => true) }));
vi.mock('../lib/notificationSounds', async importOriginal => ({
  ...await importOriginal<typeof import('../lib/notificationSounds')>(), playSound: sounds.play, unlockAudio: sounds.unlock }));

function mount(section = 'account') {
  localStorage.setItem('token', createToken());
  render(<MemoryRouter initialEntries={[`/settings?section=${section}`]}><AuthProvider><ThemeProvider><NotificationPreferencesProvider><SettingsPage /></NotificationPreferencesProvider></ThemeProvider></AuthProvider></MemoryRouter>);
}

describe('settings', () => {
  it('keeps reduced motion in settings without duplicating the theme selector', async () => {
    mount('appearance');
    expect(screen.getByRole('switch', { name: 'Ogranicz animacje' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Motyw aplikacji' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Jasny|Ciemny|Systemowy|Włącz .* motyw/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Ogranicz animacje' }));
    expect(document.documentElement).toHaveAttribute('data-reduced-motion', 'true');
    expect(localStorage.getItem('app-reduced-motion')).toBe('true');
  });
  it('saves notification preferences and restores them after switching sections', async () => {
    let saved = { ...defaultNotificationPreferences };
    server.use(
      http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(saved)),
      http.patch(`${API_URL}/api/user/me/notification-preferences`, async ({ request }) => {
        const change = await request.json() as { preference: 'friendRequests'; enabled: boolean };
        expect(change).toEqual({ preference: 'friendRequests', enabled: false });
        saved = { ...saved, [change.preference]: change.enabled };
        return HttpResponse.json(saved);
      }),
    );
    mount('notifications');
    const toggle = await screen.findByRole('switch', { name: 'Zaproszenia do znajomych' });
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);
    await screen.findByText('Preferencje zostały zapisane.');
    expect(saved.friendRequests).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Wygląd' }));
    fireEvent.click(screen.getByRole('button', { name: 'Powiadomienia' }));
    expect(screen.getByRole('switch', { name: 'Zaproszenia do znajomych' })).toHaveAttribute('aria-checked', 'false');
  });

  it('keeps the previous preference when saving fails', async () => {
    server.use(
      http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(defaultNotificationPreferences)),
      http.patch(`${API_URL}/api/user/me/notification-preferences`, () => new HttpResponse(null, { status: 500 })),
    );
    mount('notifications');
    expect(screen.getByRole('status', { name: 'Ładowanie preferencji' })).toBeInTheDocument();
    const toggle = await screen.findByRole('switch', { name: 'Zaproszenia do znajomych' });
    expect(screen.queryByRole('status', { name: 'Ładowanie preferencji' })).not.toBeInTheDocument();
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);
    await screen.findByText(/Poprzednie ustawienie zostało zachowane/);
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('does not enable browser notifications when permission is denied', async () => {
    const permission = vi.fn(async () => 'denied');
    let saves = 0;
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: permission });
    server.use(http.patch(`${API_URL}/api/user/me/notification-preferences`, () => {
      saves += 1;
      return HttpResponse.json({ ...defaultNotificationPreferences, browserNotifications: true });
    }));
    try {
      mount('notifications');
      const toggle = await screen.findByRole('switch', { name: 'Powiadomienia systemowe' });
      await waitFor(() => expect(toggle).toBeEnabled());
      fireEvent.click(toggle);
      await screen.findByText(/Przeglądarka nie udzieliła zgody/);
      expect(permission).toHaveBeenCalledTimes(1);
      expect(saves).toBe(0);
      expect(toggle).toHaveAttribute('aria-checked', 'false');
    } finally { vi.unstubAllGlobals(); }
  });

  it('rotates the auth token after renaming the account', async () => {
    const payload = btoa(JSON.stringify({ sub: 'newtester', roles: ['ROLE_USER'], exp: 2000000000 }));
    const nextToken = `header.${payload}.signature`;
    server.use(
      http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(defaultNotificationPreferences)),
      http.patch(`${API_URL}/api/user/me/username`, async ({ request }) => {
        expect(await request.json()).toEqual({ newUsername: 'newtester' });
        return HttpResponse.json({ token: nextToken });
      }),
    );
    mount();
    const field = await screen.findByLabelText('Nazwa użytkownika');
    fireEvent.change(field, { target: { value: 'newtester' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }));
    await screen.findByText('Nazwa użytkownika została zmieniona.');
    expect(localStorage.getItem('token')).toBe(nextToken);
  });

  it('validates password confirmation and clears fields after a successful change', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(defaultNotificationPreferences)),
      http.patch(`${API_URL}/api/user/me/password`, async ({ request }) => {
        calls += 1;
        expect(await request.json()).toEqual({ currentPassword: 'old-password', newPassword: 'new-password' });
        return new HttpResponse(null, { status: 200 });
      }),
    );
    mount('security');
    fireEvent.change(screen.getByLabelText('Obecne hasło'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('Nowe hasło'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Powtórz nowe hasło'), { target: { value: 'different' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zmień hasło' }));
    expect(screen.getByText('Nowe hasła muszą być identyczne.')).toBeInTheDocument();
    expect(calls).toBe(0);
    fireEvent.change(screen.getByLabelText('Powtórz nowe hasło'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zmień hasło' }));
    await screen.findByText('Hasło zostało zmienione.');
    expect(screen.getByLabelText('Obecne hasło')).toHaveValue('');
    expect(screen.getByLabelText('Nowe hasło')).toHaveValue('');
  });

  it('explains what each event triggers and updates the summary live', async () => {
    let saved = { ...defaultNotificationPreferences };
    server.use(
      http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(saved)),
      http.patch(`${API_URL}/api/user/me/notification-preferences`, async ({ request }) => {
        const change = await request.json() as { preference: keyof typeof saved; enabled: boolean };
        saved = { ...saved, [change.preference]: change.enabled };
        return HttpResponse.json(saved);
      }),
    );
    mount('notifications');
    const summary = await screen.findByText('Zaproszenie do znajomych', { selector: 'dt' });
    const outcome = (name: string) => screen.getByText(name, { selector: 'dt' }).nextElementSibling;
    await waitFor(() => expect(outcome('Zaproszenie do znajomych')).toHaveTextContent('dzwonek w górnym pasku, dźwięk'));
    expect(summary).toBeInTheDocument();
    expect(outcome('Znaleziony mecz')).toHaveTextContent('dźwięk');
    expect(screen.getAllByText(/dzwonku w górnym pasku/)).toHaveLength(2);

    fireEvent.click(screen.getByRole('switch', { name: 'Dźwięk powiadomień' }));
    await screen.findByText('Preferencje zostały zapisane.');
    expect(outcome('Zaproszenie do znajomych')).toHaveTextContent(/^dzwonek w górnym pasku$/);
    expect(outcome('Znaleziony mecz')).toHaveTextContent('mecz otworzy się bez sygnału');
    expect(screen.getByRole('switch', { name: 'Znaleziony mecz' })).toBeDisabled();
    expect(screen.getByText(/aby ta opcja miała efekt/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Zaproszenia do znajomych' }));
    await waitFor(() => expect(outcome('Zaproszenie do znajomych')).toHaveTextContent('tylko na stronie Znajomi'));
  });

  it('previews every sound right away, even with sound switched off', async () => {
    server.use(http.get(`${API_URL}/api/user/me/notification-preferences`,
      () => HttpResponse.json({ ...defaultNotificationPreferences, sound: false })));
    mount('notifications');
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Dźwięk powiadomień' })).toHaveAttribute('aria-checked', 'false'));
    fireEvent.click(screen.getByRole('button', { name: 'Odtwórz próbnie: Wyzwanie w Arenie' }));
    await waitFor(() => expect(sounds.play).toHaveBeenCalledWith('challenges'));
    expect(await screen.findByText(/Włącz „Dźwięk”/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Wariant sygnału: Znaleziony mecz' }), { target: { value: 'alarm' } });
    await waitFor(() => expect(sounds.play).toHaveBeenCalledWith('matchFound'));
    expect(localStorage.getItem('sound-variant:matchFound')).toBe('alarm');

    sounds.unlock.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Odtwórz próbnie: Zaproszenie do znajomych' }));
    expect(await screen.findByText('Ta przeglądarka nie odtwarza dźwięków na tej stronie.')).toBeInTheDocument();
  });

  it('sends a test system notification or says what is missing', async () => {
    const shown = vi.fn();
    const permission = vi.fn(async () => 'granted');
    class FakeNotification {
      static permission = 'default';
      static requestPermission = permission;
      constructor(title: string) { shown(title); }
    }
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('Notification', FakeNotification);
    server.use(http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(defaultNotificationPreferences)));
    try {
      mount('notifications');
      const preview = await screen.findByRole('button', { name: 'Wyślij próbne' });
      fireEvent.click(preview);
      await screen.findByText(/Wysłano próbne powiadomienie/);
      expect(permission).toHaveBeenCalledTimes(1);
      expect(shown).toHaveBeenCalledWith('Próbne powiadomienie Hackademy');

      FakeNotification.permission = 'denied';
      fireEvent.click(preview);
      await screen.findByText(/Przeglądarka blokuje powiadomienia/);
      expect(shown).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it('treats system notifications without browser permission as no signal for a found match', async () => {
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission: vi.fn() });
    server.use(http.get(`${API_URL}/api/user/me/notification-preferences`,
      () => HttpResponse.json({ ...defaultNotificationPreferences, sound: false, browserNotifications: true })));
    try {
      mount('notifications');
      await waitFor(() => expect(screen.getByRole('switch', { name: 'Znaleziony mecz' })).toBeDisabled());
      expect(screen.getByText(/ta przeglądarka nie ma zgody/)).toBeInTheDocument();
    } finally { vi.unstubAllGlobals(); }
  });
});
