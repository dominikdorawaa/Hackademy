import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import API_URL from '../apiConfig';
import { createToken } from '../test/fixtures/auth';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';
import PathsPage from './PathsPage';

const path = (id: number, enrolled: boolean) => ({ id, title: `Ścieżka ${id}`, description: '', bannerUrl: '/banner.png', hasBanner: true, enrolled, roomsCount: 3 });

beforeEach(() => {
  localStorage.setItem('token', createToken());
  vi.stubGlobal('IntersectionObserver', class {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe() { this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
    disconnect() {}
  });
});

const mount = () => renderWithAuth(<>
  <Route path="/learn" element={<PathsPage />} />
  <Route path="/learn/paths/:id" element={<h1>Szczegóły</h1>} />
</>, '/learn');

it('lists paths, loads banners in view and enrolls without opening the path', async () => {
  let enrolled = 0;
  server.use(
    http.get(`${API_URL}/api/paths`, () => HttpResponse.json([path(1, false), path(2, true)])),
    http.post(`${API_URL}/api/paths/1/enroll`, () => { enrolled++; return new HttpResponse(null, { status: 200 }); }),
  );
  mount();
  expect(await screen.findByText('Dostępne: 2')).toBeInTheDocument();
  await waitFor(() => expect(document.querySelector('.path-card-media img')).toHaveAttribute('src', `${API_URL}/banner.png`));
  fireEvent.click(screen.getByRole('button', { name: 'Dołącz' }));
  await waitFor(() => expect(screen.getAllByText('Zapisany')).toHaveLength(2));
  expect(enrolled).toBe(1);
  fireEvent.keyDown(screen.getByText('Ścieżka 2').closest('.path-card')!, { key: 'Enter' });
  expect(await screen.findByRole('heading', { name: 'Szczegóły' })).toBeInTheDocument();
});

it('ends loading with an error message', async () => {
  server.use(http.get(`${API_URL}/api/paths`, () => new HttpResponse(null, { status: 500 })));
  mount();
  expect(await screen.findByText('Nie udało się pobrać ścieżek.')).toBeInTheDocument();
  expect(screen.queryByRole('status', { name: 'Ładowanie ścieżek' })).not.toBeInTheDocument();
});
