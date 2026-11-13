import { setClerkSession } from '../test/clerk';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { ShopProvider } from '../context/ShopContext';
import { createToken, createUser } from '../test/fixtures/auth';
import { createShop } from '../test/fixtures/shop';
import { currentUserUrl } from '../test/mocks/handlers';
import { server } from '../test/mocks/server';
import type { ShopItem, ShopState } from '../types/api';
import ShopPage, { describeItem } from './ShopPage';

vi.mock('../components/arena/avatar/useAvatarAtlas', () => ({ useAvatarAtlas: () => ({ atlas: 'blob:atlas', front: null }), useAvatarPortrait: () => null }));

const shopUrl = `${API_URL}/api/shop`;
const mount = () => render(<MemoryRouter><AuthProvider><ShopProvider><ShopPage /></ShopProvider></AuthProvider></MemoryRouter>);
const serve = (state: ShopState) => server.use(http.get(shopUrl, () => HttpResponse.json(state)));

beforeEach(() => {
  setClerkSession(createToken());
  server.use(http.get(currentUserUrl, () => HttpResponse.json(createUser())));
});

it('shows the balance, the dances and the quick chat lines with their prices', async () => {
  serve(createShop(['chat-rip'], 420));
  mount();
  expect(await screen.findByRole('heading', { name: 'Sklep', level: 1 })).toBeInTheDocument();
  expect(await screen.findByText('420 Bajtów')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Tańce' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('heading', { name: 'Taniec Scuba' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Podgląd tańca Scuba na Twoim awatarze' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Kup Taniec Scuba za 400 Bajtów' })).toBeEnabled();

  fireEvent.click(screen.getByRole('tab', { name: 'Ubrania' }));
  expect(screen.getByRole('heading', { name: 'Płaszcz netrunnera' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Podgląd stroju Płaszcz netrunnera na Twoim awatarze' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Kup Płaszcz netrunnera za 800 Bajtów' })).toBeDisabled();

  fireEvent.keyDown(screen.getByRole('tab', { name: 'Ubrania' }), { key: 'ArrowRight' });
  const panel = screen.getByRole('tabpanel');
  expect(screen.getByRole('tab', { name: 'Teksty do czatu' })).toHaveFocus();
  expect(within(panel).getAllByRole('listitem')).toHaveLength(4);
  expect(within(panel).getByRole('heading', { name: 'RIP' }).closest('li')).toHaveTextContent('Kupione');
  expect(within(panel).getByRole('button', { name: 'Kup WP za 150 Bajtów' })).toBeEnabled();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Teksty do czatu' }), { key: 'End' });
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Teksty do czatu' }), { key: 'Home' });
  expect(screen.getByRole('tab', { name: 'Tańce' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Tańce' }), { key: 'ArrowLeft' });
  expect(screen.getByRole('tab', { name: 'Teksty do czatu' })).toHaveAttribute('aria-selected', 'true');
  fireEvent.keyDown(screen.getByRole('tab', { name: 'Teksty do czatu' }), { key: 'a' });
});

it('buys an item after confirming and updates the balance everywhere', async () => {
  serve(createShop([], 500));
  let bought = '';
  server.use(http.post(`${shopUrl}/items/:id/purchase`, ({ params }) => { bought = String(params.id); return HttpResponse.json(createShop(['dance-scuba'], 100)); }));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Kup Taniec Scuba za 400 Bajtów' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('Zapłacisz 400 Bajtów. Po zakupie zostanie Ci 100 Bajtów.');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Kup' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Kupione: Taniec Scuba.');
  expect(bought).toBe('dance-scuba');
  expect(screen.getByText('100 Bajtów')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ustaw w kreatorze' })).toHaveAttribute('href', '/arena/avatar');
});

it('explains a refused purchase and refreshes the shop', async () => {
  let loads = 0;
  server.use(
    http.get(shopUrl, () => { loads += 1; return HttpResponse.json(createShop([], 400)); }),
    http.post(`${shopUrl}/items/:id/purchase`, () => HttpResponse.json({ message: 'Masz już ten przedmiot.' }, { status: 409 })),
  );
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Kup Taniec Scuba za 400 Bajtów' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Kup' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Masz już ten przedmiot.');
  await waitFor(() => expect(loads).toBe(2));
});

it('disables items the player cannot afford yet', async () => {
  serve(createShop([], 120));
  mount();
  expect(await screen.findByRole('button', { name: 'Kup Taniec Scuba za 400 Bajtów' })).toBeDisabled();
  expect(screen.getAllByText('Za mało Bajtów')).toHaveLength(2);
  expect(screen.getAllByRole('link', { name: 'Doładuj' })[0]).toHaveAttribute('href', '/shop/top-up');
  expect(screen.getByRole('link', { name: 'Doładuj Bajty' })).toHaveAttribute('href', '/shop/top-up');
});

it('offers a retry when the shop cannot be loaded', async () => {
  let fail = true;
  server.use(http.get(shopUrl, () => fail ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json(createShop([], 7))));
  mount();
  expect(await screen.findByText('Sklep jest chwilowo niedostępny.')).toBeInTheDocument();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Spróbuj ponownie' }));
  expect(await screen.findByText('7 Bajtów')).toBeInTheDocument();
});

it('names every kind of item', () => {
  const item = (category: ShopItem['category'], reference: string): ShopItem => ({ id: reference, category, reference, price: 1, owned: false });
  expect(describeItem(item('OUTFIT', 'dres')).name).toBe('Dres');
  expect(describeItem(item('OUTFIT', 'kimono'))).toEqual({ name: 'kimono', description: '' });
  expect(describeItem(item('QUICK_CHAT', 'unknown')).name).toBe('unknown');
  expect(describeItem(item('DANCE', 'walc')).name).toBe('Taniec walc');
});

it('previews the quick chat lines with their animated stickers', async () => {
  serve(createShop([], 0));
  mount();
  fireEvent.click(await screen.findByRole('tab', { name: 'Teksty do czatu' }));
  const panel = screen.getByRole('tabpanel');
  expect(panel.querySelectorAll('.pixel-sprite')).toHaveLength(4);
  expect(within(panel).getByRole('heading', { name: 'RIP' }).closest('li')).toHaveTextContent('Gdy ktoś poległ z hukiem, RIP z nagrobkiem.');
});
