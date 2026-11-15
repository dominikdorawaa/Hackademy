import { setClerkSession } from '../../test/clerk';
import { Route } from 'react-router-dom';
import { configure, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import API_URL from '../../apiConfig';
import { server } from '../../test/mocks/server';
import { currentUserHandler } from '../../test/mocks/handlers';
import { createToken } from '../../test/fixtures/auth';
import { renderWithAuth } from '../../test/renderWithAuth';
import type { UserAdminView, WalletAdmin, WalletTransaction } from '../../types/api';
import adminRoutes from './adminRoutes';
import { transactionLabel } from './WalletDialog';

const player: UserAdminView = { id: 7, username: 'gracz', email: 'gracz@example.com', role: 'USER', createdAt: '2026-01-01T10:00:00' } as UserAdminView;
const entry = (patch: Partial<WalletTransaction>): WalletTransaction => ({
  id: 1, amount: 100, balanceAfter: 100, kind: 'ADMIN', itemId: null, orderId: null, reason: 'Nagroda', adminUsername: 'admin', createdAt: '2026-11-13T12:00:00', ...patch,
});
const wallet = (balance: number, transactions: WalletTransaction[] = []): WalletAdmin => ({ userId: 7, username: 'gracz', balance, transactions });
const walletUrl = `${API_URL}/api/admin/users/7/wallet`;

beforeAll(() => {
  configure({ asyncUtilTimeout: 3000 });
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.scrollIntoView = () => {};
  window.matchMedia = ((query: string) => ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as unknown as typeof window.matchMedia;
});

afterAll(() => configure({ asyncUtilTimeout: 1000 }));

beforeEach(() => {
  setClerkSession(createToken('ADMIN'));
  server.use(currentUserHandler('ADMIN'), http.get(`${API_URL}/api/admin/users`, () => HttpResponse.json({ items: [player], page: 0, size: 50, hasNext: false })));
});

const open = async () => {
  renderWithAuth(<>{adminRoutes}<Route path="/" element={<div>start</div>} /></>, '/admin/users');
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Bajty użytkownika gracz' }));
  return { user, dialog: await screen.findByRole('dialog', { name: 'Bajty: gracz' }) };
};

it('shows the balance with the history and grants Bytes with a reason', async () => {
  let sent: unknown = null;
  server.use(
    http.get(walletUrl, () => HttpResponse.json(wallet(250, [entry({ id: 2, kind: 'PURCHASE', amount: -400, itemId: 'dance-scuba', reason: null, adminUsername: null }), entry({ id: 1, kind: 'TOP_UP', amount: 500, orderId: 3 })]))),
    http.post(walletUrl, async ({ request }) => { sent = await request.json(); return HttpResponse.json(wallet(750, [entry({ id: 3, amount: 500, reason: 'Turniej' })])); }),
  );
  const { user, dialog } = await open();
  expect(await within(dialog).findByText(/Saldo: 250 Bajtów\./)).toBeInTheDocument();
  expect(within(dialog).getByText('Zakup: dance-scuba')).toBeInTheDocument();
  expect(within(dialog).getByText('Doładowanie #3')).toBeInTheDocument();
  expect(within(dialog).getByText('-400')).toBeInTheDocument();

  await user.type(within(dialog).getByLabelText('Liczba Bajtów'), '500');
  await user.type(within(dialog).getByLabelText('Powód'), '  Turniej ');
  await user.click(within(dialog).getByRole('button', { name: 'Zmień saldo' }));
  await waitFor(() => expect(sent).toEqual({ amount: 500, reason: 'Turniej' }));
  expect(await within(dialog).findByText(/Saldo: 750 Bajtów\./)).toBeInTheDocument();
  expect(within(dialog).getByText('admin: Turniej')).toBeInTheDocument();
  expect(within(dialog).getByText('+500')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Liczba Bajtów')).toHaveValue(null);

  await user.click(within(dialog).getByRole('button', { name: 'Zamknij' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('checks the amount and the reason before sending and shows refusals', async () => {
  let posts = 0;
  server.use(
    http.get(walletUrl, () => HttpResponse.json(wallet(10))),
    http.post(walletUrl, () => { posts += 1; return HttpResponse.json({ message: 'Saldo nie może spaść poniżej zera. Obecne saldo: 10.' }, { status: 409 }); }),
  );
  const { user, dialog } = await open();
  expect(await within(dialog).findByText('Brak operacji.')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Zmień saldo' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Podaj liczbę całkowitą różną od zera');
  await user.type(within(dialog).getByLabelText('Liczba Bajtów'), '-50');
  await user.click(within(dialog).getByRole('button', { name: 'Zmień saldo' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Podaj powód.');
  expect(posts).toBe(0);
  await user.type(within(dialog).getByLabelText('Powód'), 'Korekta');
  await user.click(within(dialog).getByRole('button', { name: 'Zmień saldo' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Saldo nie może spaść poniżej zera. Obecne saldo: 10.');
  server.use(http.post(walletUrl, () => HttpResponse.error()));
  await user.click(within(dialog).getByRole('button', { name: 'Zmień saldo' }));
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Nie udało się połączyć z serwerem.');
});

it('explains when the wallet cannot be loaded', async () => {
  server.use(http.get(walletUrl, () => HttpResponse.json({ message: 'Nie znaleziono użytkownika.' }, { status: 404 })));
  const { dialog } = await open();
  expect(await within(dialog).findByText('Nie znaleziono użytkownika.')).toBeInTheDocument();
  expect(within(dialog).getByRole('button', { name: 'Zmień saldo' })).toBeDisabled();
});

it('explains a lost connection while loading the wallet', async () => {
  server.use(http.get(walletUrl, () => HttpResponse.error()));
  const { dialog } = await open();
  expect(await within(dialog).findByText('Nie udało się połączyć z serwerem.')).toBeInTheDocument();
});

it('labels history entries without optional details', () => {
  expect(transactionLabel(entry({ kind: 'PURCHASE', itemId: null }))).toBe('Zakup: przedmiot');
  expect(transactionLabel(entry({ kind: 'TOP_UP', orderId: null }))).toBe('Doładowanie');
  expect(transactionLabel(entry({ adminUsername: null, reason: null }))).toBe('Administrator: ');
});
