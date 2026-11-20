import { setClerkSession } from '../../test/clerk';
import { render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import API_URL from '../../apiConfig';
import { AuthProvider } from '../../context/AuthContext';
import { createToken } from '../../test/fixtures/auth';
import { createSubscription } from '../../test/fixtures/subscription';
import { server } from '../../test/mocks/server';
import { formatUntil } from '../../lib/premium';
import type { SubscriptionState } from '../../types/api';
import { PremiumBanner } from './PremiumBanner';

const mount = () => render(<MemoryRouter><AuthProvider><PremiumBanner /></AuthProvider></MemoryRouter>);
const serve = (state: SubscriptionState) => server.use(http.get(`${API_URL}/api/subscription`, () => HttpResponse.json(state)));

beforeEach(() => setClerkSession(createToken()));

it('invites a free player to buy Premium with its price and perks', async () => {
  serve(createSubscription());
  mount();
  const banner = await screen.findByRole('region', { name: 'Hackademy Premium' });
  expect(within(banner).getByText('Subskrypcja')).toBeInTheDocument();
  expect(banner).toHaveTextContent('29,99');
  expect(banner).toHaveTextContent('za 30 dni');
  expect(banner).toHaveTextContent('1000 Bajtów przy każdym zakupie');
  expect(within(banner).getByRole('img', { name: 'Premium' })).toBeInTheDocument();
  expect(within(banner).getByRole('link', { name: 'Kup Premium' })).toHaveAttribute('href', '/premium');
});

it('shows how long Premium lasts and offers to extend it', async () => {
  serve(createSubscription({ active: true, activeUntil: '2026-12-17T10:00:00' }));
  mount();
  const banner = await screen.findByRole('region', { name: 'Hackademy Premium' });
  expect(banner).toHaveAttribute('data-active', 'true');
  expect(within(banner).getByText(`Masz Premium do ${formatUntil('2026-12-17T10:00:00')}`)).toBeInTheDocument();
  expect(within(banner).getByRole('link', { name: 'Przedłuż Premium' })).toHaveAttribute('href', '/premium');
});

it('stays hidden for staff', async () => {
  let loaded = false;
  server.use(http.get(`${API_URL}/api/subscription`, () => { loaded = true; return HttpResponse.json(createSubscription({ staff: true })); }));
  mount();
  await vi.waitFor(() => expect(loaded).toBe(true));
  expect(screen.queryByRole('region', { name: 'Hackademy Premium' })).toBeNull();
});
