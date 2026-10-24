import { setClerkSession } from '../test/clerk';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../context/ThemeContext';
import { AuthProvider } from '../context/AuthContext';
import { PROFILE_UPDATED } from '../lib/profile';
import { createToken, createUser } from '../test/fixtures/auth';
import { currentUserUrl } from '../test/mocks/handlers';
import { server } from '../test/mocks/server';
import API_URL from '../apiConfig';
import { AVATAR_KEY } from '../components/arena/avatar/avatarModel';
import type { Avatar } from '../components/arena/avatar/avatarModel';

const atlas = vi.hoisted(() => ({ ready: true, front: 'blob:front' as string | null, last: null as null | Avatar }));
vi.mock('../components/arena/avatar/useAvatarAtlas', () => ({
  useAvatarAtlas: (avatar: Avatar) => { atlas.last = avatar; return atlas.ready ? { atlas: 'blob:atlas', front: atlas.front } : null; },
  useAvatarPortrait: (config: { pose?: string } | null) => config ? `blob:portrait-${config.pose}` : null,
}));

import ArenaAvatarPage from './ArenaAvatarPage';

beforeEach(() => { atlas.ready = true; atlas.front = 'blob:front'; atlas.last = null; });
const setup = () => render(<MemoryRouter><AuthProvider><ThemeProvider><ArenaAvatarPage /></ThemeProvider></AuthProvider></MemoryRouter>);
const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));

it('uses the same creator tabs as the onboarding', () => {
  setup();
  const tabs = within(screen.getByRole('tablist', { name: 'Kategorie' })).getAllByRole('tab');
  expect(tabs.map(tab => tab.textContent)).toEqual(['Strój', 'Fryzura i czapka', 'Kolory', 'Finisher', 'Taniec', 'Ikona profilu']);
  for (const name of ['Postawa', 'Atak', 'Trafienie', 'Upadek', 'Bieg', 'Przeciążenie', 'Ctrl+Alt+Del']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
});

it('waits for the recolored atlas before showing the preview', () => {
  atlas.ready = false;
  setup();
  const loader = screen.getByRole('status', { name: 'Przygotowuję postać' });
  expect(loader).not.toHaveAttribute('aria-busy');
  expect(loader.querySelector('.avatar-sprite image')).toHaveAttribute('href', '/assets/arena/avatar-v1/fighter.png');
  expect(screen.queryByRole('img', { name: 'Twój awatar, widok z przodu' })).not.toBeInTheDocument();
});

it('offers only outfits that support hairstyles and hats', () => {
  setup();
  const outfits = within(screen.getByRole('radiogroup', { name: 'Strój' })).getAllByRole('radio');
  expect(outfits).toHaveLength(3);
  expect(screen.getByRole('radio', { name: /Klasyczna/ })).toBeChecked();
  expect(screen.queryByText(/Sportowa|Loki/)).not.toBeInTheDocument();
});

it('customizes colors, previews the chosen finisher and dance and saves the avatar', () => {
  setup();
  expect(screen.getByRole('button', { name: 'Zapisano' })).toBeDisabled();
  openTab('Kolory');
  fireEvent.click(screen.getByRole('radio', { name: 'Skóra: Hebanowa' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Włosy: Rude' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Góra: Bordowy' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Dół: Biały' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Buty: Czerwony' }));
  expect(atlas.last!.colors).toMatchObject({ skin: 'heban', hair: 'rude', top: 'bordowy', bottom: 'bialy', shoes: 'czerwony' });
  expect(screen.getByText('Masz niezapisane zmiany.')).toBeInTheDocument();
  openTab('Finisher');
  expect(screen.getByRole('radio', { name: /^Przeciążenie/ })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: /^Ctrl\+Alt\+Del/ }));
  expect(screen.getByRole('img', { name: 'Twój finisher: Ctrl+Alt+Del' })).toHaveAttribute('data-frame', '100');
  openTab('Taniec');
  expect(screen.getByRole('radio', { name: /^Luz/ })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: /^Scuba/ }));
  expect(screen.getByRole('img', { name: 'Twój taniec zwycięstwa: Scuba' })).toHaveAttribute('data-frame', '145');
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  expect(JSON.parse(localStorage.getItem(AVATAR_KEY)!)).toMatchObject({ outfit: 'baza', finisher: 'combo', dance: 'scuba', colors: { skin: 'heban', hair: 'rude', top: 'bordowy', bottom: 'bialy', shoes: 'czerwony' } });
  expect(screen.getByRole('button', { name: 'Zapisano' })).toBeDisabled();
});

it('restores the saved avatar', () => {
  localStorage.setItem(AVATAR_KEY, JSON.stringify({ outfit: 'baza', hair: 'kucyk', hat: 'brak', dance: 'sixseven', colors: { skin: 'ciemna', hair: 'siwe', top: 'bialy', bottom: 'oliwkowy', shoes: 'bordowy', hat: 'czerwony' } }));
  setup();
  openTab('Fryzura i czapka');
  expect(screen.getByRole('radio', { name: 'Kucyk' })).toBeChecked();
  openTab('Kolory');
  expect(screen.getByRole('radio', { name: 'Włosy: Siwe' })).toBeChecked();
  openTab('Taniec');
  expect(screen.getByRole('radio', { name: /^Six-seven/ })).toBeChecked();
});

it('chooses a hairstyle and a hat, and hides the hair under the hat', () => {
  setup();
  openTab('Fryzura i czapka');
  expect(screen.getByRole('radio', { name: 'Krótkie' })).toBeChecked();
  fireEvent.click(screen.getByRole('radio', { name: 'Irokez' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Daszek' }));
  expect(screen.getByText('Pod czapką fryzura jest schowana. Zdejmij czapkę, żeby ją zobaczyć.')).toBeInTheDocument();
  openTab('Kolory');
  fireEvent.click(screen.getByRole('radio', { name: 'Kolor czapki: Bordowy' }));
  expect(atlas.last).toMatchObject({ outfit: 'baza', hair: 'irokez', hat: 'daszek', colors: { hat: 'bordowy' } });
  openTab('Fryzura i czapka');
  fireEvent.click(screen.getByRole('radio', { name: 'Bez czapki' }));
  expect(screen.queryByText(/Pod czapką/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Bez włosów' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Czapka zimowa' }));
  expect(screen.queryByText(/Pod czapką/)).not.toBeInTheDocument();
});

it('shows the avatar from the front by default and falls back to the side view', () => {
  const { unmount } = setup();
  expect(screen.getByRole('img', { name: 'Twój awatar, widok z przodu' })).toHaveAttribute('src', 'blob:front');
  fireEvent.click(screen.getByRole('button', { name: 'W walce' }));
  expect(screen.queryByRole('img', { name: 'Twój awatar, widok z przodu' })).not.toBeInTheDocument();
  unmount();
  atlas.front = null;
  setup();
  expect(screen.getByRole('img', { name: 'Twój awatar w walce' })).toHaveAttribute('data-frame', '0');
});

const accountAvatar = { outfit: 'dres', hair: 'kucyk', hat: 'brak', skin: 'ciemna', hairColor: 'rude', topColor: 'czerwony', bottomColor: 'bialy', shoesColor: 'granatowy', hatColor: 'turkusowy', finisher: 'combo', victoryDance: 'sixseven' };

it('loads the avatar from the account and saves changes there', async () => {
  setClerkSession(createToken());
  let saved: Record<string, string> | null = null;
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), avatar: accountAvatar })),
    http.put(`${API_URL}/api/user/me/avatar`, async ({ request }) => { saved = await request.json() as Record<string, string>; return HttpResponse.json(saved); }),
  );
  const updates: unknown[] = [];
  const listener = (event: Event) => updates.push((event as CustomEvent).detail);
  window.addEventListener(PROFILE_UPDATED, listener);
  setup();
  openTab('Fryzura i czapka');
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Kucyk' })).toBeChecked());
  expect(screen.getByText(/zapisany na Twoim koncie/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: 'Daszek' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Zapisano' })).toBeDisabled());
  const stored = { ...accountAvatar, hat: 'daszek', pose: 'przod' };
  expect(saved).toEqual(stored);
  expect(updates).toEqual([{ username: 'tester', avatar: stored }]);
  window.removeEventListener(PROFILE_UPDATED, listener);
});

it('keeps unsaved changes and explains when the account save fails', async () => {
  setClerkSession(createToken());
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), avatar: null })),
    http.put(`${API_URL}/api/user/me/avatar`, () => HttpResponse.json({ message: 'Błąd' }, { status: 500 })),
  );
  setup();
  expect(await screen.findByText('Ten awatar nie jest jeszcze zapisany na Twoim koncie.')).toBeInTheDocument();
  openTab('Fryzura i czapka');
  fireEvent.click(screen.getByRole('radio', { name: 'Irokez' }));
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  expect(await screen.findByText('Nie udało się zapisać awatara na koncie. Spróbuj ponownie.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Zapisz awatar' })).toBeEnabled();
});

it('tells guests that the avatar is saved only in this browser', () => {
  setup();
  expect(screen.getByText('Awatar jest zapisany w tej przeglądarce. Zaloguj się, żeby zapisać go na koncie.')).toBeInTheDocument();
});

it('blocks editing and saving until the account avatar has loaded', async () => {
  setClerkSession(createToken());
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get(currentUserUrl, async () => { await gate; return HttpResponse.json({ ...createUser(), avatar: accountAvatar }); }));
  setup();
  expect(await screen.findByText('Wczytuję awatar z Twojego konta…')).toBeInTheDocument();
  openTab('Fryzura i czapka');
  expect(screen.getByRole('radio', { name: 'Daszek' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Zapisano' })).toBeDisabled();
  release();
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Kucyk' })).toBeChecked());
  expect(screen.getByRole('radio', { name: 'Daszek' })).toBeEnabled();
});

it('does not fall back to a browser-only save when the account cannot be loaded', async () => {
  setClerkSession(createToken());
  let saves = 0;
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ message: 'Błąd' }, { status: 503 })),
    http.put(`${API_URL}/api/user/me/avatar`, () => { saves++; return HttpResponse.json({}); }),
  );
  setup();
  expect(await screen.findByText('Nie udało się wczytać awatara z konta. Odśwież stronę, żeby zapisać zmiany.')).toBeInTheDocument();
  openTab('Fryzura i czapka');
  fireEvent.click(screen.getByRole('radio', { name: 'Irokez' }));
  const button = screen.getByRole('button', { name: 'Zapisz awatar' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(saves).toBe(0);
  expect(localStorage.getItem(AVATAR_KEY)).toBeNull();
});

it('lets a player save the shown avatar when the account has none yet', async () => {
  setClerkSession(createToken());
  let saved: Record<string, string> | null = null;
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json({ ...createUser(), avatar: null })),
    http.put(`${API_URL}/api/user/me/avatar`, async ({ request }) => { saved = await request.json() as Record<string, string>; return HttpResponse.json(saved); }),
  );
  setup();
  expect(await screen.findByText('Ten awatar nie jest jeszcze zapisany na Twoim koncie.')).toBeInTheDocument();
  const button = screen.getByRole('button', { name: 'Zapisz awatar' });
  expect(button).toBeEnabled();
  fireEvent.click(button);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Zapisano' })).toBeDisabled());
  expect(saved).toMatchObject({ outfit: 'baza', finisher: 'beam', victoryDance: 'groove' });
  expect(screen.getByText(/zapisany na Twoim koncie i widoczny/)).toBeInTheDocument();
});

it('shows still move previews when the system asks for reduced motion', () => {
  const listeners: (() => void)[] = [];
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener), removeEventListener: vi.fn() }));
  vi.useFakeTimers();
  try {
    setup();
    openTab('Finisher');
    expect(screen.getByRole('img', { name: 'Twój finisher: Przeciążenie' })).toHaveAttribute('data-frame', '29');
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByRole('img', { name: 'Twój finisher: Przeciążenie' })).toHaveAttribute('data-frame', '29');
    expect(listeners).toHaveLength(1);
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it('chooses the portrait pose separately from the move preview and saves it', () => {
  setup();
  openTab('Ikona profilu');
  const poses = within(screen.getByRole('radiogroup', { name: 'Poza na ikonie profilu' })).getAllByRole('radio');
  expect(poses).toHaveLength(3);
  expect(screen.getByRole('radio', { name: 'Przód' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Profil' }).closest('label')!.querySelector('img')).toHaveAttribute('src', 'blob:portrait-profil');
  fireEvent.click(screen.getByRole('radio', { name: 'Profil' }));
  expect(screen.getByText('Ikona profilu, poza: Profil')).toBeInTheDocument();
  openTab('Taniec');
  fireEvent.click(screen.getByRole('radio', { name: /^Scuba/ }));
  openTab('Ikona profilu');
  expect(screen.getByRole('radio', { name: 'Profil' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Zapisz awatar' }));
  expect(JSON.parse(localStorage.getItem(AVATAR_KEY)!)).toMatchObject({ pose: 'profil', dance: 'scuba' });
});
