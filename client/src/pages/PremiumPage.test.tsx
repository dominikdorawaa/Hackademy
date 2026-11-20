import { setClerkSession } from '../test/clerk';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from '../context/AuthContext';
import { ShopProvider } from '../context/ShopContext';
import { createToken, createUser } from '../test/fixtures/auth';
import { createShop } from '../test/fixtures/shop';
import { createSubscription } from '../test/fixtures/subscription';
import { currentUserUrl } from '../test/mocks/handlers';
import { server } from '../test/mocks/server';
import { findToast } from '../test/toasts';
import Toaster from '../components/common/Toaster';
import type { SubscriptionState } from '../types/api';
import PremiumPage from './PremiumPage';
import { formatUntil } from '../lib/premium';

const url = `${API_URL}/api/subscription`;
const mount = () => render(<MemoryRouter><AuthProvider><ShopProvider><PremiumPage /><Toaster /></ShopProvider></AuthProvider></MemoryRouter>);
const serve = (state: SubscriptionState) => server.use(http.get(url, () => HttpResponse.json(state)));

let shopLoads = 0;

beforeEach(() => {
  shopLoads = 0;
  setClerkSession(createToken());
  server.use(
    http.get(currentUserUrl, () => HttpResponse.json(createUser())),
    http.get(`${API_URL}/api/shop`, () => { shopLoads += 1; return HttpResponse.json(createShop([], shopLoads > 1 ? 1000 : 0)); }),
  );
});

it('compares plans and buys Premium with the test payment', async () => {
  serve(createSubscription({ arena: { dailyLimit: 5, playedToday: 2, remaining: 3 } }));
  const calls: string[] = [];
  server.use(
    http.post(`${url}/orders`, async ({ request }) => {
      const { planId } = await request.json() as { planId: string };
      calls.push(`order:${planId}`);
      return HttpResponse.json({ id: 7, planId, days: 30, coins: 1000, priceMinor: 2999, currency: 'PLN', status: 'PENDING', redirectUrl: null, test: true }, { status: 201 });
    }),
    http.post(`${url}/orders/:id/test-payment`, ({ params }) => {
      calls.push(`pay:${params.id}`);
      return HttpResponse.json(createSubscription({ active: true, activeUntil: '2026-12-17T10:00:00', arena: { dailyLimit: 5, playedToday: 2, remaining: null } }));
    }),
  );
  mount();

  expect(await screen.findByRole('button', { name: 'Kup Premium' })).toBeInTheDocument();
  expect(screen.queryByText(/Grasz w wersji darmowej/)).toBeNull();
  expect(screen.getByText('Tryb testowy: żadne pieniądze nie zostaną pobrane.')).toBeInTheDocument();
  const plans = screen.getByRole('list', { name: 'Porównanie planów' });
  expect(plans).toHaveTextContent('Pierwszy rozdział każdej ścieżki');
  expect(plans).toHaveTextContent('Wszystkie rozdziały każdej ścieżki');
  expect(plans).toHaveTextContent('1000 Bajtów do Sklepu przy każdym zakupie');

  fireEvent.click(screen.getByRole('button', { name: 'Kup Premium' }));
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog).toHaveTextContent('Premium na 30 dni za 29,99');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Zapłać testowo' }));

  await findToast('Premium aktywne. Na Twoje konto trafiło 1000 Bajtów.');
  expect(await screen.findByText(`Premium aktywne do ${formatUntil('2026-12-17T10:00:00')}.`)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Przedłuż o 30 dni' })).toBeInTheDocument();
  expect(calls).toEqual(['order:monthly', 'pay:7']);
  await waitFor(() => expect(shopLoads).toBeGreaterThan(1));
});

it('cancels a pending order and reports failures', async () => {
  serve(createSubscription());
  const calls: string[] = [];
  let orders = 0;
  server.use(
    http.post(`${url}/orders`, () => {
      orders += 1;
      if (orders === 2) return HttpResponse.json({ message: 'Subskrypcję będzie można kupić wkrótce.' }, { status: 503 });
      return HttpResponse.json({ id: orders, planId: 'monthly', days: 30, coins: 1000, priceMinor: 2999, currency: 'PLN', status: 'PENDING', redirectUrl: null, test: true }, { status: 201 });
    }),
    http.post(`${url}/orders/:id/cancel`, ({ params }) => { calls.push(`cancel:${params.id}`); return HttpResponse.json({ message: 'Nie znaleziono zamówienia.' }, { status: 404 }); }),
    http.post(`${url}/orders/:id/test-payment`, () => HttpResponse.json({ message: 'To zamówienie nie czeka już na płatność.' }, { status: 409 })),
  );
  mount();

  fireEvent.click(await screen.findByRole('button', { name: 'Kup Premium' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Anuluj zamówienie' }));
  await findToast('Nie znaleziono zamówienia.', 'assertive');
  expect(calls).toEqual(['cancel:1']);

  fireEvent.click(screen.getByRole('button', { name: 'Kup Premium' }));
  await findToast('Subskrypcję będzie można kupić wkrótce.', 'assertive');

  fireEvent.click(screen.getByRole('button', { name: 'Kup Premium' }));
  fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Zapłać testowo' }));
  await findToast('To zamówienie nie czeka już na płatność.', 'assertive');
});

it('shows staff access without a purchase button', async () => {
  serve(createSubscription({ staff: true, arena: { dailyLimit: 5, playedToday: 0, remaining: null } }));
  mount();
  expect(await screen.findByText('Jako członek zespołu masz pełny dostęp bez subskrypcji.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Kup Premium' })).toBeNull();
});

it('keeps the purchase closed until payments are connected', async () => {
  serve(createSubscription({ payments: 'off' }));
  mount();
  expect(await screen.findByText('Płatności uruchomimy wkrótce.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Kup Premium' })).toBeDisabled();
});

it('lets the player retry after a failed load', async () => {
  let attempts = 0;
  server.use(http.get(url, () => {
    attempts += 1;
    return attempts === 1 ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(createSubscription());
  }));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Spróbuj ponownie' }));
  expect(await screen.findByRole('button', { name: 'Kup Premium' })).toBeInTheDocument();
});

it('reports a network failure', async () => {
  serve(createSubscription());
  server.use(http.post(`${url}/orders`, () => HttpResponse.error()));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Kup Premium' }));
  await findToast('Nie udało się połączyć z serwerem.', 'assertive');
});

it('keeps the payment dialog open after a server error so the player can retry', async () => {
  serve(createSubscription());
  let attempts = 0;
  server.use(
    http.post(`${url}/orders`, () => HttpResponse.json({ id: 3, planId: 'monthly', days: 30, coins: 1000, priceMinor: 2999, currency: 'PLN', status: 'PENDING', redirectUrl: null, test: true }, { status: 201 })),
    http.post(`${url}/orders/:id/test-payment`, () => {
      attempts += 1;
      return attempts === 1 ? new HttpResponse(null, { status: 500 })
        : HttpResponse.json(createSubscription({ active: true, activeUntil: '2026-12-17T10:00:00', arena: { dailyLimit: 5, playedToday: 0, remaining: null } }));
    }),
  );
  mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Kup Premium' }));
  const dialog = await screen.findByRole('alertdialog');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Zapłać testowo' }));
  await findToast('Płatność się nie udała. Spróbuj ponownie albo anuluj zamówienie.', 'assertive');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Zapłać testowo' }));
  await findToast('Premium aktywne. Na Twoje konto trafiło 1000 Bajtów.');
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
});
