import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Outlet, Route } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import Navbar from '../components/Navbar';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { setClerkSession } from '../test/clerk';
import { createToken } from '../test/fixtures/auth';
import { profileUser, publicProfile } from '../test/fixtures/profile';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';
import type { AvatarConfig } from '../types/api';
import ProfilePage from './ProfilePage';
import PublicProfilePage from './PublicProfilePage';
import ArenaAvatarPage from './ArenaAvatarPage';
import ArenaPage from './ArenaPage';

vi.mock('../components/arena/avatar/useAvatarAtlas', () => ({
  useAvatarAtlas: () => ({ atlas: 'blob:atlas', front: 'blob:front' }),
  useAvatarPortrait: (config: AvatarConfig | null) => config ? `/portrait-${config.hat}-${config.pose}.png` : null,
}));

const initialAvatar: AvatarConfig = { outfit: 'dres', hair: 'kucyk', hat: 'brak', skin: 'ciemna', hairColor: 'rude', topColor: 'czerwony', bottomColor: 'bialy', shoesColor: 'granatowy', hatColor: 'turkusowy', pose: 'profil', finisher: 'combo', victoryDance: 'scuba' };
let avatar: AvatarConfig;
let writes: AvatarConfig[];
let fail: boolean;

beforeEach(() => {
  setClerkSession(createToken());
  avatar = { ...initialAvatar };
  writes = [];
  fail = false;
  server.use(
    http.get(`${API_URL}/api/user/me`, () => HttpResponse.json({ ...profileUser, avatar })),
    http.get(`${API_URL}/api/user/me/activity`, () => HttpResponse.json([])),
    http.get(`${API_URL}/api/user/me/recent-solved`, () => HttpResponse.json([])),
    http.get(`${API_URL}/api/badges/all`, () => HttpResponse.json([])),
    http.get(`${API_URL}/api/user/friend`, () => HttpResponse.json({ ...publicProfile, avatar: initialAvatar })),
    http.get(`${API_URL}/api/user/friend/activity`, () => HttpResponse.json([])),
    http.get(`${API_URL}/api/user/friend/recent-solved`, () => HttpResponse.json([])),
    http.get(`${API_URL}/api/friends/status/friend`, () => HttpResponse.json({ status: 'NONE' })),
    http.put(`${API_URL}/api/user/me/avatar`, async ({ request }) => {
      const config = await request.json() as AvatarConfig;
      writes.push(config);
      if (fail) return HttpResponse.json({}, { status: 500 });
      avatar = config;
      return HttpResponse.json(config);
    }),
  );
});

function mount(path = '/profile') {
  return renderWithAuth(<Route element={<ProtectedRoute><Navbar /><Outlet /></ProtectedRoute>}>
    <Route path="/profile" element={<ProfilePage />} />
    <Route path="/profile/:username" element={<PublicProfilePage />} />
    <Route path="/arena/avatar" element={<ArenaAvatarPage />} />
    <Route path="/arena" element={<ArenaPage />} />
  </Route>, path);
}

const openHead = async () => {
  fireEvent.click(await screen.findByRole('tab', { name: 'Fryzura i czapka' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Kucyk' })).toBeChecked());
};

it('opens the account configuration from the own portrait using the keyboard and updates navigation and profile after saving', async () => {
  mount();
  const user = userEvent.setup();
  const edit = await screen.findByRole('link', { name: 'Zmień swój awatar' });
  expect(edit).toHaveAttribute('href', '/arena/avatar?from=profile');
  expect(edit.textContent).toBe('');
  expect(within(edit).getByRole('img', { name: 'Avatar tester' })).toBeVisible();
  edit.focus();
  expect(edit).toHaveFocus();
  await user.keyboard('{Enter}');
  fireEvent.click(await screen.findByRole('tab', { name: 'Ikona profilu' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Profil' })).toBeChecked());
  await openHead();
  await user.click(screen.getByRole('radio', { name: 'Daszek' }));
  await user.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Zapisano' })).toBeDisabled());
  expect(writes).toEqual([{ ...initialAvatar, hat: 'daszek' }]);
  const nav = screen.getByRole('navigation', { name: 'Nawigacja główna' });
  expect(nav.querySelector('img[data-avatar="custom"]')).toHaveAttribute('src', '/portrait-daszek-profil.png');
  await user.click(screen.getByRole('link', { name: 'Wróć do profilu' }));
  const portrait = await screen.findByRole('link', { name: 'Zmień swój awatar' });
  expect(within(portrait).getByRole('img')).toHaveAttribute('src', '/portrait-daszek-profil.png');
});

it('supports pointer navigation and keeps the selected configuration ready for retry after an account save fails', async () => {
  mount();
  const user = userEvent.setup();
  await user.click(await screen.findByRole('link', { name: 'Zmień swój awatar' }));
  await openHead();
  await user.click(screen.getByRole('radio', { name: 'Daszek' }));
  fail = true;
  await user.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  expect(await screen.findByText('Nie udało się zapisać awatara na koncie. Spróbuj ponownie.')).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Daszek' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Zapisz awatar' })).toBeEnabled();
  expect(screen.getByRole('navigation', { name: 'Nawigacja główna' }).querySelector('img[data-avatar="custom"]')).toHaveAttribute('src', '/portrait-brak-profil.png');
  fail = false;
  await user.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Zapisano' })).toBeDisabled());
  expect(writes).toEqual([{ ...initialAvatar, hat: 'daszek' }, { ...initialAvatar, hat: 'daszek' }]);
});

it('keeps another person’s portrait noninteractive and never offers saving their configuration', async () => {
  mount('/profile/friend');
  const portrait = await screen.findByRole('img', { name: 'Avatar friend' });
  expect(portrait.closest('a, button')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Zmień swój awatar' })).not.toBeInTheDocument();
  fireEvent.pointerDown(portrait, { pointerType: 'touch' });
  fireEvent.click(portrait);
  expect(screen.getByTestId('location')).toHaveTextContent('/profile/friend');
  expect(writes).toEqual([]);
});

it('ignores another username and an external return URL when entering the account editor directly', async () => {
  mount('/arena/avatar?username=friend&from=https://example.com');
  await openHead();
  expect(screen.getByRole('link', { name: 'Wróć do Areny' })).toHaveAttribute('href', '/arena');
  fireEvent.click(screen.getByRole('radio', { name: 'Daszek' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toEqual({ ...initialAvatar, hat: 'daszek' });
});

it('opens the editor by touch and treats the public address of the signed-in player as their own profile', async () => {
  mount('/profile/tester');
  const edit = await screen.findByRole('link', { name: 'Zmień swój awatar' });
  expect(screen.getByTestId('location')).toHaveTextContent('/profile:REPLACE');
  const user = userEvent.setup();
  await user.pointer([{ keys: '[TouchA>]', target: edit }, { keys: '[/TouchA]' }]);
  await openHead();
  expect(screen.getByRole('link', { name: 'Wróć do profilu' })).toHaveAttribute('href', '/profile');
});

it.each(['keyboard', 'touch'] as const)('opens the ranked Arena portrait with %s and shows the saved portrait on return', async method => {
  mount('/arena');
  const edit = await screen.findByRole('link', { name: 'Zmień swój awatar' });
  expect(edit).toHaveAttribute('href', '/arena/avatar');
  expect(edit.textContent).toBe('');
  expect(screen.queryByText('Edytuj awatar')).not.toBeInTheDocument();
  expect(screen.queryByText('Stwórz awatar')).not.toBeInTheDocument();
  const user = userEvent.setup();
  if (method === 'keyboard') {
    edit.focus();
    await user.keyboard('{Enter}');
  } else await user.pointer([{ keys: '[TouchA>]', target: edit }, { keys: '[/TouchA]' }]);
  await openHead();
  await user.click(screen.getByRole('radio', { name: 'Daszek' }));
  await user.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Zapisano' })).toBeDisabled());
  await user.click(screen.getByRole('link', { name: 'Wróć do Areny' }));
  const portrait = await screen.findByRole('link', { name: 'Zmień swój awatar' });
  expect(portrait.querySelector('img')).toHaveAttribute('src', '/portrait-daszek-profil.png');
});
