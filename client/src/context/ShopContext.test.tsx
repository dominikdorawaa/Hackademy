import { setClerkSession } from '../test/clerk';
import { fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it } from 'vitest';
import API_URL from '../apiConfig';
import { AuthProvider } from './AuthContext';
import { ShopProvider, useShop } from './ShopContext';
import { createToken, createUser } from '../test/fixtures/auth';
import { createShop } from '../test/fixtures/shop';
import { currentUserUrl } from '../test/mocks/handlers';
import { server } from '../test/mocks/server';

function Probe() {
  const { shop, status, refresh, replace } = useShop();
  return <div>
    <p>status:{status}</p>
    <p>balance:{shop?.balance ?? 'none'}</p>
    <button type="button" onClick={refresh}>refresh</button>
    <button type="button" onClick={() => replace(createShop([], 99))}>replace</button>
  </div>;
}

beforeEach(() => server.use(http.get(currentUserUrl, () => HttpResponse.json(createUser()))));

it('loads the wallet for a signed in player and lets screens refresh or replace it', async () => {
  setClerkSession(createToken());
  let balance = 10;
  server.use(http.get(`${API_URL}/api/shop`, () => HttpResponse.json(createShop([], balance))));
  render(<MemoryRouter><AuthProvider><ShopProvider><Probe /></ShopProvider></AuthProvider></MemoryRouter>);
  expect(await screen.findByText('balance:10')).toBeInTheDocument();
  expect(screen.getByText('status:ready')).toBeInTheDocument();
  balance = 20;
  fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
  expect(await screen.findByText('balance:20')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'replace' }));
  expect(screen.getByText('balance:99')).toBeInTheDocument();
});

it('reports errors and stays idle without a session or provider', async () => {
  setClerkSession(createToken());
  server.use(http.get(`${API_URL}/api/shop`, () => HttpResponse.json({}, { status: 500 })));
  const view = render(<MemoryRouter><AuthProvider><ShopProvider><Probe /></ShopProvider></AuthProvider></MemoryRouter>);
  expect(await screen.findByText('status:error')).toBeInTheDocument();
  server.use(http.get(`${API_URL}/api/shop`, () => HttpResponse.error()));
  fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
  expect(await screen.findByText('status:error')).toBeInTheDocument();
  view.unmount();

  render(<Probe />);
  expect(screen.getByText('status:idle')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
  fireEvent.click(screen.getByRole('button', { name: 'replace' }));
  expect(screen.getByText('balance:none')).toBeInTheDocument();
});

it('stays idle for signed out visitors', () => {
  setClerkSession(null);
  render(<MemoryRouter><AuthProvider><ShopProvider><Probe /></ShopProvider></AuthProvider></MemoryRouter>);
  expect(screen.getByText('status:idle')).toBeInTheDocument();
});
