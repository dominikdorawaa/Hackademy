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

  it('saves the friend online preference', async () => {
    let saved = { ...defaultNotificationPreferences };
    server.use(
      http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(saved)),
      http.patch(`${API_URL}/api/user/me/notification-preferences`, async ({ request }) => {
        const change = await request.json() as { preference: 'friendOnline'; enabled: boolean };
        expect(change).toEqual({ preference: 'friendOnline', enabled: false });
        saved = { ...saved, [change.preference]: change.enabled };
        return HttpResponse.json(saved);
      }),
    );
    mount('notifications');
    const toggle = await screen.findByRole('switch', { name: 'Znajomi online' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await screen.findByText('Preferencje zostały zapisane.');
    expect(screen.getByRole('switch', { name: 'Znajomi online' })).toHaveAttribute('aria-checked', 'false');
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
      const toggle = await screen.findByRole('switch', { name: 'Powiadomienia przeglądarkowe' });
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
});
