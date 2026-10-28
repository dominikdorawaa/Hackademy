import { reverify, setClerkPassword, setClerkSession, openUserProfile, signOut } from '../test/clerk';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ClerkRuntimeError } from '@clerk/react/errors';
import { describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
  setClerkSession(createToken());
  render(<MemoryRouter initialEntries={[`/settings?section=${section}`]}><AuthProvider><ThemeProvider><NotificationPreferencesProvider><SettingsPage /></NotificationPreferencesProvider></ThemeProvider></AuthProvider></MemoryRouter>);
}

describe('settings', () => {
  it('switches the theme and reduced motion from the appearance section', async () => {
    mount('appearance');
    const theme = screen.getByRole('radiogroup', { name: 'Motyw interfejsu' });
    expect(screen.getByRole('radio', { name: 'Ciemny' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Jasny' }));
    expect(theme).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Jasny' })).toBeChecked();
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem('app-theme')).toBe('light');
    fireEvent.click(screen.getByRole('switch', { name: 'Ogranicz animacje' }));
    expect(document.documentElement).toHaveAttribute('data-reduced-motion', 'true');
    expect(localStorage.getItem('app-reduced-motion')).toBe('true');
    expect(screen.getByText('Awatary i maskotki stoją w miejscu')).toBeInTheDocument();
    expect(screen.getByText('Podgląd: stoi')).toBeInTheDocument();
  });

  it('groups every section into labelled panels', () => {
    mount('security');
    expect(screen.getByRole('region', { name: 'Hasło i logowanie' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Bieżąca sesja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bezpieczeństwo' })).toHaveAttribute('aria-current', 'page');
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

  it('lets the player hide their activity from friends', async () => {
    let shared = true;
    server.use(
      http.get(`${API_URL}/api/presence/sharing`, () => HttpResponse.json({ enabled: shared })),
      http.put(`${API_URL}/api/presence/sharing`, async ({ request }) => {
        shared = (await request.json() as { enabled: boolean }).enabled;
        return HttpResponse.json({ enabled: shared });
      }),
    );
    mount();
    const toggle = await screen.findByRole('switch', { name: 'Pokazuj znajomym, co robię' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await screen.findByText('Znajomi widzą już tylko, czy jesteś online.');
    expect(shared).toBe(false);
    expect(screen.getByRole('switch', { name: 'Pokazuj znajomym, co robię' })).toHaveAttribute('aria-checked', 'false');
  });

  it('offers a retry when the privacy setting cannot be read', async () => {
    let attempts = 0;
    server.use(http.get(`${API_URL}/api/presence/sharing`, () => {
      attempts += 1;
      return attempts === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json({ enabled: false });
    }));
    mount();
    expect(await screen.findByText('Nie udało się wczytać ustawienia prywatności.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Pokazuj znajomym, co robię' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Pokazuj znajomym, co robię' })).toHaveAttribute('aria-checked', 'false'));
    expect(screen.getByRole('switch', { name: 'Pokazuj znajomym, co robię' })).toBeEnabled();
    expect(screen.queryByText('Nie udało się wczytać ustawienia prywatności.')).toBeNull();
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
    const toggle = await screen.findByRole('switch', { name: 'Komunikat o znajomych online' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(toggle);
    await screen.findByText('Preferencje zostały zapisane.');
    expect(screen.getByRole('switch', { name: 'Komunikat o znajomych online' })).toHaveAttribute('aria-checked', 'false');
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

  it('renames the local profile without rotating the Clerk session', async () => {
    server.use(
      http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(defaultNotificationPreferences)),
      http.patch(`${API_URL}/api/user/me/username`, async ({ request }) => {
        expect(await request.json()).toEqual({ newUsername: 'newtester' });
        return HttpResponse.json({ username: 'newtester' });
      }),
    );
    mount();
    const field = await screen.findByLabelText('Nazwa użytkownika');
    fireEvent.change(field, { target: { value: 'newtester' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }));
    await screen.findByText('Nazwa użytkownika została zmieniona.');
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByRole('button', { name: 'Zapisz nazwę' })).toBeDisabled();
  });

  it('explains how to change the e-mail and opens Clerk to do it', async () => {
    mount();
    expect(await screen.findByText(/potwierdź go kodem i ustaw jako główny/)).toBeInTheDocument();
    openUserProfile.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Zmień adres' }));
    expect(openUserProfile).toHaveBeenCalledOnce();
  });

  it('keeps the naming rules hidden until the typed name breaks them', async () => {
    mount();
    const field = await screen.findByLabelText('Nazwa użytkownika');
    expect(screen.queryByText(/litery, cyfry/)).not.toBeInTheDocument();
    fireEvent.change(field, { target: { value: 'ab' } });
    expect(screen.getByRole('alert')).toHaveTextContent('od 3 do 20 znaków');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Zapisz nazwę' })).toBeDisabled();
    fireEvent.change(field, { target: { value: 'zła nazwa' } });
    expect(screen.getByRole('alert')).toHaveTextContent('litery, cyfry, _ i -');
    fireEvent.change(field, { target: { value: 'dobra_nazwa' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapisz nazwę' })).toBeEnabled();
  });

  it('shows a taken username as an error and keeps the typed name', async () => {
    server.use(http.patch(`${API_URL}/api/user/me/username`, () => HttpResponse.json({ message: 'Username already taken' }, { status: 409 })));
    mount();
    const field = await screen.findByLabelText('Nazwa użytkownika');
    fireEvent.change(field, { target: { value: 'taken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ta nazwa jest już zajęta. Wybierz inną.');
    expect(field).toHaveValue('taken');
  });

  it('explains a taken name and checks the allowed characters before and after sending', async () => {
    let attempts = 0;
    server.use(
      http.get(`${API_URL}/api/user/me/notification-preferences`, () => HttpResponse.json(defaultNotificationPreferences)),
      http.patch(`${API_URL}/api/user/me/username`, () => (++attempts === 1
        ? HttpResponse.json({ message: 'Ta nazwa jest zajęta' }, { status: 409 })
        : HttpResponse.json({ message: 'Validation failed', newUsername: 'Nazwa może zawierać tylko litery, cyfry, _ i -' }, { status: 400 }))),
    );
    mount();
    const field = await screen.findByLabelText('Nazwa użytkownika');
    fireEvent.change(field, { target: { value: 'zajeta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }));
    await screen.findByText('Ta nazwa jest już zajęta. Wybierz inną.');
    fireEvent.change(field, { target: { value: 'zła nazwa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }));
    await screen.findByText('Nazwa może zawierać tylko litery, cyfry, _ i -.');
    expect(attempts).toBe(1);
    fireEvent.change(field, { target: { value: 'dobra_nazwa' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zapisz nazwę' }));
    await screen.findByText('Nazwa może zawierać tylko litery, cyfry, _ i -.');
    expect(attempts).toBe(2);
  });

  it('opens Clerk account security for password and connected account changes', () => {
    mount('security');
    fireEvent.click(screen.getByRole('button', { name: 'Zarządzaj dostępem' }));
    expect(openUserProfile).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Obecne hasło')).toBeNull();
  });

  it('deletes the account only after the password is confirmed, then signs out', async () => {
    const attempts: unknown[] = [];
    server.use(http.delete(`${API_URL}/api/user/me`, async ({ request }) => {
      const body = await request.json() as { password?: string };
      attempts.push(body);
      return body.password === 'dobre-haslo'
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json({ message: 'Hasło jest nieprawidłowe.' }, { status: 400 });
    }));
    setClerkSession(createToken());
    render(<MemoryRouter initialEntries={['/settings?section=security']}><AuthProvider><ThemeProvider><NotificationPreferencesProvider>
      <Routes><Route path="/settings" element={<SettingsPage />} /><Route path="/" element={<p>Strona główna</p>} /></Routes>
    </NotificationPreferencesProvider></ThemeProvider></AuthProvider></MemoryRouter>);
    const zone = screen.getByRole('region', { name: 'Strefa niebezpieczna' });
    fireEvent.click(within(zone).getByRole('button', { name: 'Usuń konto' }));
    const dialog = await screen.findByRole('dialog', { name: 'Usunąć konto na zawsze?' });
    const confirm = within(dialog).getByRole('button', { name: 'Usuń konto na zawsze' });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Obecne hasło'), { target: { value: 'zle-haslo' } });
    fireEvent.click(confirm);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Hasło jest nieprawidłowe.');
    expect(signOut).not.toHaveBeenCalled();
    expect(screen.queryByText('Strona główna')).toBeNull();

    fireEvent.change(within(dialog).getByLabelText('Obecne hasło'), { target: { value: 'dobre-haslo' } });
    fireEvent.click(confirm);
    await screen.findByText('Strona główna');
    expect(attempts).toEqual([{ password: 'zle-haslo' }, { password: 'dobre-haslo' }]);
    expect(signOut).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem('hackademy.account-deleted')).toBe('1');
  });

  it('confirms an account without a password through the emailed code', async () => {
    const sent: unknown[] = [];
    server.use(http.delete(`${API_URL}/api/user/me`, async ({ request }) => {
      sent.push(await request.json());
      return sent.length === 1
        ? HttpResponse.json({ clerk_error: { type: 'forbidden', reason: 'reverification-error' } }, { status: 403 })
        : new HttpResponse(null, { status: 204 });
    }));
    setClerkPassword(false);
    mount('security');
    fireEvent.click(await screen.findByRole('button', { name: 'Usuń konto' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent('wyślemy na Twój adres e-mail kod');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń konto na zawsze' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(reverify).toHaveBeenCalledOnce();
    expect(sent).toEqual([{}, {}]);
  });

  it('keeps the account when the emailed code is cancelled', async () => {
    let calls = 0;
    server.use(http.delete(`${API_URL}/api/user/me`, () => {
      calls += 1;
      return HttpResponse.json({ clerk_error: { type: 'forbidden', reason: 'reverification-error' } }, { status: 403 });
    }));
    reverify.mockRejectedValueOnce(new ClerkRuntimeError('User cancelled attempted verification', { code: 'reverification_cancelled' }));
    setClerkPassword(false);
    mount('security');
    fireEvent.click(await screen.findByRole('button', { name: 'Usuń konto' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Usuń konto na zawsze' }));
    await waitFor(() => expect(reverify).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Usuń konto' })).toBeEnabled());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(calls).toBe(1);
    expect(signOut).not.toHaveBeenCalled();
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
    const channels = (row: string) => {
      const list = screen.getByRole('switch', { name: row }).closest('.settings-row')!.querySelector('ul')!;
      return within(list).getAllByRole('listitem').map(item => item.textContent);
    };
    await waitFor(() => expect(channels('Zaproszenia do znajomych')).toEqual(['Dzwonek', 'Komunikat', 'Dźwięk', 'Systemowe (wyłączone)']));
    expect(channels('Znaleziony mecz')).toEqual(['Dźwięk', 'Systemowe (wyłączone)']);
    expect(channels('Komunikat o znajomych online')).toEqual(['Komunikat', 'Dźwięk', 'Systemowe (wyłączone)']);
    expect(screen.getByRole('region', { name: 'Tak to wygląda' })).toHaveTextContent('ola_secchce dodać Cię do znajomych');

    fireEvent.click(screen.getByRole('switch', { name: 'Dźwięk powiadomień' }));
    await screen.findByText('Preferencje zostały zapisane.');
    expect(channels('Zaproszenia do znajomych')).toEqual(['Dzwonek', 'Komunikat', 'Dźwięk (wyłączone)', 'Systemowe (wyłączone)']);
    expect(screen.getByRole('switch', { name: 'Znaleziony mecz' })).toBeDisabled();
    expect(screen.getByText(/aby ta opcja miała efekt/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Zaproszenia do znajomych' }));
    await screen.findByText('Wyłączone: zobaczysz je tylko na stronie Znajomi.');
    expect(channels('Zaproszenia do znajomych')).toEqual(['Dzwonek (wyłączone)', 'Komunikat (wyłączone)', 'Dźwięk (wyłączone)', 'Systemowe (wyłączone)']);
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
    const created: FakeNotification[] = [];
    class FakeNotification {
      static permission = 'default';
      static requestPermission = permission;
      onerror: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) { shown(title, options?.tag); created.push(this); }
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
      expect(shown).toHaveBeenCalledWith('Próbne powiadomienie Hackademy', undefined);
      act(() => created[0].onerror?.());
      expect(await screen.findByText(/System nie wyświetlił powiadomienia/)).toBeInTheDocument();

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
