import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { Link, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import ProfilePage from './ProfilePage';
import PublicProfilePage from './PublicProfilePage';
import SettingsPage from './SettingsPage';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { ThemeProvider } from '../context/ThemeContext';
import { createToken } from '../test/fixtures/auth';
import {
  profileActivity,
  profileBadges,
  profileUser,
  publicProfile,
  recentSolved,
} from '../test/fixtures/profile';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';
import type {
  ActivityDto,
  BadgeDto,
  DashboardUser,
  FriendshipStatus,
  RecentSolvedRoomDto,
  UserProfileDto,
  UserSearchDto,
} from '../types/api';


const url = (path: string) => `${API_URL}/api${path}`;

function mount(path = '/profile') {
  return renderWithAuth(
    <>
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/:username"
        element={
          <ProtectedRoute>
            <PublicProfilePage />
            <Link to="/profile/second">Drugi profil</Link>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <ThemeProvider>
              <SettingsPage />
            </ThemeProvider>
          </ProtectedRoute>
        }
      />
      <Route path="/login" element={<h1>Logowanie</h1>} />
    </>,
    path,
  );
}

beforeEach(() => {
  localStorage.setItem('token', createToken());
  server.use(
    http.get<never, never, DashboardUser>(url('/user/me'), () =>
      HttpResponse.json(profileUser),
    ),
    http.get<never, never, BadgeDto[]>(url('/badges/all'), () =>
      HttpResponse.json(profileBadges),
    ),
    http.get<never, never, ActivityDto[]>(url('/user/me/activity'), () =>
      HttpResponse.json(profileActivity),
    ),
    http.get<never, never, RecentSolvedRoomDto[]>(
      url('/user/me/recent-solved'),
      () => HttpResponse.json(recentSolved),
    ),
    http.get<{ username: string }, never, UserProfileDto>(
      url('/user/:username'),
      ({ params }) =>
        HttpResponse.json({ ...publicProfile, username: params.username }),
    ),
    http.get(url('/user/:username/activity'), () =>
      HttpResponse.json<ActivityDto[]>(profileActivity),
    ),
    http.get(url('/user/:username/recent-solved'), () =>
      HttpResponse.json<RecentSolvedRoomDto[]>(recentSolved),
    ),
    http.get(url('/friends/status/:username'), () =>
      HttpResponse.json<{ status: FriendshipStatus }>({ status: 'NONE' }),
    ),
    http.get(url('/friends/stats/:username'), () =>
      HttpResponse.json<UserSearchDto>({
        id: 2,
        username: 'friend',
        points: 250,
        friendshipStatus: 'FRIENDS',
        winsAgainst: 3,
        lossesAgainst: 1,
      }),
    ),
  );
});

describe('user profile integration', () => {
  it('saves avatar, bio, interests and ordered showcase selections and retains them after reloading', async () => {
    let persisted = { ...profileUser, tagline: '', avatarSeed: 'original-avatar', interests: [] as string[], featuredBadgeIds: [] as number[] };
    const updates: unknown[] = [];
    server.use(
      http.get(url('/user/me'), () => HttpResponse.json(persisted)),
      http.patch(url('/user/me/profile'), async ({ request }) => {
        const body = await request.json() as typeof persisted;
        updates.push(body);
        persisted = { ...persisted, ...body };
        return HttpResponse.json(body);
      }),
    );
    const rendered = mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    expect(screen.queryByRole('button', { name: 'Udostępnij profil' })).not.toBeInTheDocument();
    const editor = within(screen.getByRole('dialog', { name: 'Edytuj profil' }));
    expect(editor.queryByRole('textbox', { name: 'Krótkie hasło' })).not.toBeInTheDocument();
    await user.clear(editor.getByRole('textbox', { name: 'O mnie' }));
    await user.type(editor.getByRole('textbox', { name: 'O mnie' }), 'Odkrywam cyberbezpieczeństwo');
    await user.click(editor.getByRole('checkbox', { name: 'Linux' }));
    await user.click(editor.getByRole('checkbox', { name: 'Sieci' }));
    await user.click(editor.getByRole('radio', { name: 'Avatar 2' }));
    const chosenSeed = new URL(editor.getByRole('radio', { name: 'Avatar 2' }).parentElement!.querySelector('img')!.src).searchParams.get('seed');
    await user.click(editor.getByRole('checkbox', { name: 'Odznaka 6' }));
    await user.click(editor.getByRole('checkbox', { name: 'Odznaka 7' }));
    await user.click(editor.getByRole('button', { name: 'Zapisz profil' }));
    expect(await screen.findByText('Profil zapisany')).toBeInTheDocument();
    expect(updates).toEqual([expect.objectContaining({ avatarSeed: chosenSeed, bio: 'Odkrywam cyberbezpieczeństwo', interests: ['LINUX', 'NETWORKS'], featuredBadgeIds: [6, 7] })]);
    expect(screen.getByRole('img', { name: 'Avatar tester' })).toHaveAttribute('src', expect.stringContaining(chosenSeed!));
    const showcase = within(screen.getByRole('region', { name: 'Wyróżnione osiągnięcia' }));
    expect(showcase.getAllByRole('heading', { level: 3 }).map(heading => heading.textContent)).toEqual(['Odznaka 6', 'Odznaka 7']);
    rendered.unmount();
    mount();
    expect(await screen.findByText('Odkrywam cyberbezpieczeństwo')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Avatar tester' })).toHaveAttribute('src', expect.stringContaining(chosenSeed!));
  });

  it('limits interests and featured badges and cancels all personalization changes', async () => {
    const save = vi.fn();
    server.use(http.patch(url('/user/me/profile'), save));
    mount();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    const editor = within(screen.getByRole('dialog'));
    for (const name of ['Linux', 'Windows', 'Sieci', 'Pentesting', 'Obrona i SOC']) await user.click(editor.getByRole('checkbox', { name }));
    expect(editor.getByRole('checkbox', { name: 'Kryptografia' })).toBeDisabled();
    for (const name of ['Odznaka 7', 'Odznaka 6', 'Odznaka 5']) await user.click(editor.getByRole('checkbox', { name }));
    expect(editor.getByRole('checkbox', { name: 'Odznaka 4' })).toBeDisabled();
    await user.click(editor.getByRole('radio', { name: 'Avatar 2' }));
    await user.click(editor.getByRole('button', { name: 'Losuj kolejne' }));
    expect(editor.getByRole('radio', { name: 'Avatar 1' })).toBeChecked();
    await user.click(editor.getByRole('button', { name: 'Anuluj' }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edytuj profil' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('');
  });

  it('offers one setup prompt to an empty owner and omits empty portfolio panels', async () => {
    server.use(
      http.get(url('/user/me'), () => HttpResponse.json({ ...profileUser, bio: '' })),
      http.get(url('/badges/all'), () => HttpResponse.json(profileBadges.map(badge => ({ ...badge, earned: false, earnedAt: null })))),
    );
    mount();
    expect(await screen.findByRole('heading', { name: 'Nadaj profilowi swój charakter' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Doświadczenie w Hackademy' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Wyróżnione osiągnięcia' })).not.toBeInTheDocument();
    expect(screen.queryByText(profileUser.email)).not.toBeInTheDocument();
    expect(await screen.findByText('0/8')).toBeInTheDocument();
  });

  it('replaces experience with learning statistics without requesting the portfolio', async () => {
    const request = vi.fn(() => HttpResponse.json({ practiceAreas: [], completedPaths: [] }));
    server.use(http.get(url('/user/me/portfolio'), request));
    mount();
    expect(await screen.findByRole('heading', { name: 'Statystyki nauki' })).toBeInTheDocument();
    expect(await screen.findByText('Rekord jednego dnia')).toBeInTheDocument();
    expect(screen.getByText('Najdłuższa seria')).toBeInTheDocument();
    expect(screen.getByText('Najaktywniejszy dzień')).toBeInTheDocument();
    expect(screen.getByText('Średnia w aktywnym dniu')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Doświadczenie w Hackademy' })).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
  it('limits a collection of 1000 badges to six entries and allows jumping to its last page', async () => {
    const manyBadges = Array.from({ length: 1000 }, (_, index) => ({
      ...profileBadges[0], id: index + 1, name: `Duża kolekcja ${index + 1}`,
      earned: true, earnedAt: '2026-01-01T00:00:00Z',
    }));
    server.use(http.get(url('/badges/all'), () => HttpResponse.json(manyBadges)));
    mount();
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Zobacz wszystkie odznaki' }));
    const list = await screen.findByRole('list', { name: 'Lista odznak' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('1–6 z 1000 odznak')).toBeInTheDocument();
    await userEvent.setup().click(within(list).getByText('Duża kolekcja 1'));
    fireEvent.change(screen.getByRole('combobox', { name: 'Strona odznak' }), { target: { value: '166' } });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(screen.getByText('997–1000 z 1000 odznak')).toBeInTheDocument();
    expect(screen.getByText('Duża kolekcja 1000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Następna strona odznak' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Strona odznak' }), { target: { value: '0' } });
    expect(within(list).getAllByRole('listitem')).toHaveLength(6);
    expect(within(list).getByText('Duża kolekcja 1')).toBeInTheDocument();
  });

  it('shows learning records instead of dashboard panels and keeps earned badge details', async () => {
    const recentRequest = vi.fn(() => HttpResponse.json(recentSolved));
    server.use(http.get(url('/user/me/recent-solved'), recentRequest));
    mount();
    expect(await screen.findByRole('heading', { name: 'tester' })).toBeInTheDocument();
    expect(await screen.findByText('Rekord jednego dnia')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Statystyki nauki' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Postęp do następnego poziomu' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Ostatnio rozwiązane pokoje' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Do awansu/)).not.toBeInTheDocument();
    expect(screen.queryByText('Ranking Elo')).not.toBeInTheDocument();
    expect(recentRequest).not.toHaveBeenCalled();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Zobacz wszystkie odznaki' }));
    const catalog = within(screen.getByRole('dialog'));
    expect(await catalog.findByText('Odznaka 7')).toBeInTheDocument();
    expect(catalog.queryByText('Odznaka 1')).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Następna strona odznak' }),
    );
    expect(catalog.getByText('Odznaka 1')).toBeInTheDocument();
    expect(catalog.getByText('Odznaka 8')).toBeInTheDocument();
    expect(catalog.getByText('Do zdobycia')).toBeInTheDocument();
    expect(catalog.queryByText('Odznaka 7')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Następna strona odznak' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Poprzednia strona odznak' }));
    expect(catalog.getByText('Opis odznaki 7')).toBeVisible();
    expect(catalog.getByText('Opis odznaki 6')).toBeVisible();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('saves, cancels and clears the owner bio through the API', async () => {
    const saved: string[] = [];
    server.use(
      http.patch<never, { bio: string }>(
        url('/user/me/profile'),
        async ({ request }) => {
          expect(request.headers.get('Content-Type')).toContain(
            'application/json',
          );
          const body = await request.json();
          saved.push(body.bio);
          return HttpResponse.json(body);
        },
      ),
    );
    mount();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Edytuj profil' }),
    );
    const field = screen.getByRole('textbox', { name: 'O mnie' });
    expect(field).toHaveValue(profileUser.bio);
    await user.clear(field);
    await user.type(field, 'Nowy opis');
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));
    expect(saved).toEqual([]);
    expect(screen.getByText(profileUser.bio)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edytuj profil' }));
    await user.clear(screen.getByRole('textbox', { name: 'O mnie' }));
    await user.type(
      screen.getByRole('textbox', { name: 'O mnie' }),
      'Nowy opis',
    );
    await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
    expect(await screen.findByText('Nowy opis')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edytuj profil' }));
    await user.clear(screen.getByRole('textbox', { name: 'O mnie' }));
    await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
    expect(
      await screen.findByRole('button', { name: 'Edytuj profil' }),
    ).toBeInTheDocument();
    expect(saved).toEqual(['Nowy opis', '']);
  });

  it.each(['server', 'network'])(
    'keeps the bio draft after a %s failure and allows a retry',
    async (failure) => {
      server.use(
        http.patch(url('/user/me/profile'), () =>
          failure === 'network'
            ? HttpResponse.error()
            : new HttpResponse(null, { status: 500 }),
        ),
      );
      mount();
      const user = userEvent.setup();
      await user.click(
        await screen.findByRole('button', { name: 'Edytuj profil' }),
      );
      fireEvent.change(screen.getByRole('textbox', { name: 'O mnie' }), {
        target: { value: 'Zachowaj ten opis' },
      });
      await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Nie udało się',
      );
      expect(screen.getByRole('textbox', { name: 'O mnie' })).toHaveValue('Zachowaj ten opis');
      server.use(
        http.patch(
          url('/user/me/profile'),
          async ({ request }) => HttpResponse.json(await request.json()),
        ),
      );
      await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
      expect(await screen.findByText('Zachowaj ten opis')).toBeInTheDocument();
    },
  );

  it('enforces the bio limit in the profile editor', async () => {
    mount('/profile');
    await userEvent
      .setup()
      .click(await screen.findByRole('button', { name: 'Edytuj profil' }));
    const field = await screen.findByRole('textbox', { name: 'O mnie' });
    expect(field).toHaveValue(profileUser.bio);
    expect(field).toHaveAttribute('maxlength', '500');
    fireEvent.change(field, { target: { value: 'x'.repeat(500) } });
    expect(screen.getByText('500/500')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapisz profil' })).toBeEnabled();
    fireEvent.change(field, { target: { value: 'x'.repeat(501) } });
    expect(screen.getByRole('button', { name: 'Zapisz profil' })).toBeDisabled();
  });

  it('keeps bio editing out of settings', () => {
    mount('/settings');
    expect(
      screen.queryByRole('textbox', { name: 'O mnie' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Zapisz profil' }),
    ).not.toBeInTheDocument();
  });

  it('retains the bio on server validation failure and redirects on an expired save session', async () => {
    server.use(
      http.patch(url('/user/me/profile'), () =>
        HttpResponse.json({ bio: 'Too long' }, { status: 400 }),
      ),
    );
    mount();
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Edytuj profil' }),
    );
    await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('500 znaków');
    expect(screen.getByRole('textbox', { name: 'O mnie' })).toHaveValue(profileUser.bio);
    server.use(
      http.patch(
        url('/user/me/profile'),
        () => new HttpResponse(null, { status: 401 }),
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Zapisz profil' }));
    expect(
      await screen.findByRole('heading', { name: 'Logowanie' }),
    ).toBeInTheDocument();
  });

  it('shows useful empty states without inventing achievements', async () => {
    server.use(
      http.get(url('/badges/all'), () => HttpResponse.json<BadgeDto[]>([])),
      http.get(url('/user/me/activity'), () =>
        HttpResponse.json<ActivityDto[]>([]),
      ),
    );
    mount();
    expect(
      await screen.findByRole('heading', { name: 'tester' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Brak dostępnych odznak.'),
    ).toBeInTheDocument();
    expect(await screen.findByText(/0 dni aktywności/)).toBeInTheDocument();
  });

  it.each([
    '/badges/all',
    '/user/me/activity',
  ])(
    'keeps the profile visible when %s fails and retries that section',
    async (path) => {
      server.use(
        http.get(url(path), () => new HttpResponse(null, { status: 500 })),
      );
      mount();
      expect(
        await screen.findByRole('heading', { name: 'tester' }),
      ).toBeInTheDocument();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Nie udało się pobrać danych.',
      );
      server.use(
        http.get(url(path), () =>
          HttpResponse.json(
            [],
          ),
        ),
      );
      await userEvent
        .setup()
        .click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
      await waitFor(() =>
        expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
      );
    },
  );

  it.each([401, 403])(
    'returns to login when the profile API returns %s',
    async (status) => {
      server.use(
        http.get(
          url('/user/me/activity'),
          () => new HttpResponse(null, { status }),
        ),
      );
      mount();
      expect(
        await screen.findByRole('heading', { name: 'Logowanie' }),
      ).toBeInTheDocument();
      expect(localStorage.getItem('token')).toBeNull();
    },
  );

  it('shows another user learning statistics without private owner data or editing controls', async () => {
    mount('/profile/friend');
    expect(
      await screen.findByRole('heading', { name: 'friend' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Statystyki nauki' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(profileUser.email)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edytuj profil' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(publicProfile.bio!)).toBeInTheDocument();
  });

  it('does not mistake a failed friendship lookup for an invitation opportunity', async () => {
    server.use(
      http.get(
        url('/friends/status/friend'),
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    mount('/profile/friend');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dodaj do znajomych' }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { name: 'Statystyki nauki' }),
    ).toBeInTheDocument();
  });

  it('handles failed and successful invitations without optimistic false success', async () => {
    server.use(
      http.post(
        url('/friends/request/friend'),
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    mount('/profile/friend');
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'Dodaj do znajomych' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się wysłać zaproszenia',
    );
    expect(screen.queryByText('Zaproszenie wysłane')).not.toBeInTheDocument();
    server.use(
      http.post(url('/friends/request/friend'), () =>
        HttpResponse.json({ message: 'Request sent' }),
      ),
    );
    await user.click(
      screen.getByRole('button', { name: 'Dodaj do znajomych' }),
    );
    expect(await screen.findByText('Zaproszenie wysłane')).toBeInTheDocument();
  });

  it.each<FriendshipStatus>(['FRIENDS', 'REQUEST_SENT', 'REQUEST_RECEIVED'])(
    'preserves the %s relationship state',
    async (status) => {
      server.use(
        http.get(url('/friends/status/friend'), () =>
          HttpResponse.json({ status }),
        ),
      );
      mount('/profile/friend');
      if (status === 'FRIENDS') {
        expect(
          await screen.findByText('Jesteście znajomymi'),
        ).toBeInTheDocument();
        const section = await screen.findByRole('heading', {
          name: 'Bilans pojedynków',
        });
        expect(
          await within(section.parentElement!).findByText('3'),
        ).toBeInTheDocument();
      } else if (status === 'REQUEST_SENT')
        expect(
          await screen.findByText('Zaproszenie wysłane'),
        ).toBeInTheDocument();
      else
        expect(
          await screen.findByRole('link', { name: 'Odpowiedz na zaproszenie' }),
        ).toHaveAttribute('href', '/friends');
    },
  );

  it('redirects the owner username to the editable profile', async () => {
    mount('/profile/tester');
    expect(
      await screen.findByRole('button', { name: 'Edytuj profil' }),
    ).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/profile:REPLACE',
    );
  });

  it('discards late activity statistics when navigating to another profile', async () => {
    server.use(http.get(url('/user/friend/activity'), async () => {
      await delay(200);
      return HttpResponse.json([{ ...profileActivity[0], count: 99 }]);
    }));
    mount('/profile/friend');
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Drugi profil' }));
    expect(await screen.findByRole('heading', { name: 'second' })).toBeInTheDocument();
    expect(await screen.findByText('Rekord jednego dnia')).toBeInTheDocument();
    await new Promise(resolve => setTimeout(resolve, 250));
    expect(within(screen.getByRole('region', { name: 'Statystyki nauki' })).queryByText('99')).not.toBeInTheDocument();
  });

  it('reports a missing profile and permits retry', async () => {
    server.use(
      http.get(
        url('/user/friend'),
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    mount('/profile/friend');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie znaleziono użytkownika.',
    );
    server.use(
      http.get(url('/user/friend'), () =>
        HttpResponse.json<UserProfileDto>(publicProfile),
      ),
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
    expect(
      await screen.findByRole('heading', { name: 'friend' }),
    ).toBeInTheDocument();
  });

  it('resets the badge page for the next user', async () => {
    mount('/profile/friend');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Zobacz wszystkie odznaki' }));
    await user.click(screen.getByRole('button', { name: 'Następna strona odznak' }));
    await user.click(screen.getByRole('link', { name: 'Drugi profil' }));
    expect(await screen.findByRole('heading', { name: 'second' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Zobacz wszystkie odznaki' }));
    expect(screen.getByRole('combobox', { name: 'Strona odznak' })).toHaveValue('0');
    expect(screen.getByRole('button', { name: 'Poprzednia strona odznak' })).toBeDisabled();
    expect(document.querySelectorAll('[data-slot="activity-day"]')).toHaveLength(84);
  });
});
