import { setClerkSession } from '../../test/clerk';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Outlet, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GuidedTour from './GuidedTour';
import { placeBubble, TOUR_STEPS } from '../../lib/tour';
import { TOUR_STEP_KEY } from '../../lib/onboarding';
import { createToken } from '../../test/fixtures/auth';
import { onboardingUrl } from '../../test/mocks/handlers';
import { server } from '../../test/mocks/server';
import { renderWithAuth } from '../../test/renderWithAuth';

const Layout = () => <><Outlet /><GuidedTour /></>;
const routes = <Route element={<Layout />}>
  {TOUR_STEPS.map(step => <Route key={step.path} path={step.path} element={<section data-tour={step.target}><h1>{step.title} strona</h1></section>} />)}
  <Route path="/witaj" element={<p>Powitanie</p>} />
</Route>;
const location = () => screen.getByTestId('location').textContent?.split(':')[0];
const dialog = () => screen.getByRole('dialog');

beforeEach(() => {
  setClerkSession(createToken());
  sessionStorage.clear();
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  server.use(http.get(onboardingUrl, () => HttpResponse.json({ avatarConfirmed: true, tourStatus: 'PENDING' })));
});
afterEach(() => sessionStorage.clear());

describe('guided tour', () => {
  it('walks through the five sections in order and saves the finished tour', async () => {
    let saved: unknown = null;
    server.use(http.post(`${onboardingUrl}/tour`, async ({ request }) => { saved = await request.json(); return HttpResponse.json({ avatarConfirmed: true, tourStatus: 'COMPLETED' }); }));
    renderWithAuth(routes, '/ranking');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    await waitFor(() => expect(location()).toBe('/dashboard'));
    expect(screen.getByRole('button', { name: 'Wstecz' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dalej' })).toHaveFocus());
    const visited = [location()];
    for (let index = 1; index < TOUR_STEPS.length; index++) {
      fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
      expect(await screen.findByRole('heading', { name: TOUR_STEPS[index].title, level: 2 })).toBeInTheDocument();
      visited.push(location());
      expect(screen.getByText(`${index + 1} z 5`)).toBeInTheDocument();
      expect(sessionStorage.getItem(TOUR_STEP_KEY)).toBe(String(index));
    }
    expect(visited).toEqual(['/dashboard', '/learn', '/arena', '/ranking', '/profile']);
    fireEvent.click(screen.getByRole('button', { name: 'Wstecz' }));
    expect(await screen.findByRole('heading', { name: 'Ranking', level: 2 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dalej' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Zakończ' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(saved).toEqual({ status: 'COMPLETED' });
    expect(sessionStorage.getItem(TOUR_STEP_KEY)).toBeNull();
    await waitFor(() => expect(document.documentElement.hasAttribute('data-tour-active')).toBe(false));
  });

  it('can be skipped at any step, and a failed save keeps it open for a retry', async () => {
    let calls = 0;
    const bodies: unknown[] = [];
    server.use(http.post(`${onboardingUrl}/tour`, async ({ request }) => {
      bodies.push(await request.json());
      return ++calls === 1 ? HttpResponse.json({}, { status: 500 }) : HttpResponse.json({ avatarConfirmed: true, tourStatus: 'SKIPPED' });
    }));
    sessionStorage.setItem(TOUR_STEP_KEY, '2');
    renderWithAuth(routes, '/dashboard');
    expect(await screen.findByRole('heading', { name: 'Tryb rankingowy', level: 2 })).toBeInTheDocument();
    await waitFor(() => expect(location()).toBe('/arena'));
    fireEvent.click(screen.getByRole('button', { name: 'Pomiń przewodnik' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Nie udało się zapisać przewodnika.');
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pomiń przewodnik' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(bodies).toEqual([{ status: 'SKIPPED' }, { status: 'SKIPPED' }]);
  });

  it('keeps keyboard focus inside the bubble', async () => {
    renderWithAuth(routes, '/dashboard');
    const next = await screen.findByRole('button', { name: 'Dalej' });
    await waitFor(() => expect(next).toHaveFocus());
    const skip = screen.getByRole('button', { name: 'Pomiń przewodnik' });
    fireEvent.keyDown(next, { key: 'Tab' });
    expect(skip).toHaveFocus();
    fireEvent.keyDown(skip, { key: 'Tab' });
    expect(next).toHaveFocus();
    fireEvent.keyDown(next, { key: 'Tab', shiftKey: true });
    expect(skip).toHaveFocus();
    next.focus();
    fireEvent.keyDown(next, { key: 'Escape' });
    expect(skip).toHaveFocus();
    expect(dialog()).toBeInTheDocument();
  });

  it('highlights the section and respects reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const rect = { top: 100, left: 40, width: 300, height: 120, bottom: 220, right: 340, x: 40, y: 100, toJSON: () => ({}) };
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () { return (this as Element).matches('[data-tour]') ? rect as DOMRect : original.call(this); };
    try {
      renderWithAuth(routes, '/dashboard');
      expect(await screen.findByTestId('tour-spotlight')).toHaveStyle({ top: '92px', left: '32px', width: '316px', height: '136px' });
      expect(document.querySelector('.guided-tour')).toHaveAttribute('data-reduced-motion', 'true');
      expect(document.querySelector('.guided-tour .pixel-sprite')).toHaveAttribute('data-still', 'true');
      expect(document.documentElement.hasAttribute('data-tour-active')).toBe(true);
    } finally {
      Element.prototype.getBoundingClientRect = original;
      vi.unstubAllGlobals();
    }
  });

  it('stays hidden once the tour is finished, before the avatar is confirmed and on the welcome step', async () => {
    server.use(http.get(onboardingUrl, () => HttpResponse.json({ avatarConfirmed: true, tourStatus: 'SKIPPED' })));
    const first = renderWithAuth(routes, '/learn');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(location()).toBe('/learn');
    first.unmount();
    server.use(http.get(onboardingUrl, () => HttpResponse.json({ avatarConfirmed: false, tourStatus: 'PENDING' })));
    renderWithAuth(routes, '/witaj');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Powitanie')).toBeInTheDocument();
  });
});

describe('bubble placement', () => {
  const view = { width: 1280, height: 800 }, bubble = { width: 400, height: 220 };
  it('goes below, above or beside the target without covering it', () => {
    expect(placeBubble({ top: 100, left: 100, width: 300, height: 100 }, bubble, view)).toEqual({ mode: 'float', top: 216, left: 50 });
    expect(placeBubble({ top: 500, left: 1000, width: 200, height: 200 }, bubble, view)).toEqual({ mode: 'float', top: 264, left: 864 });
    expect(placeBubble({ top: 80, left: 40, width: 700, height: 650 }, bubble, view)).toEqual({ mode: 'float', top: 80, left: 756 });
    expect(placeBubble({ top: 80, left: 600, width: 660, height: 650 }, bubble, view)).toEqual({ mode: 'float', top: 80, left: 184 });
  });
  it('docks at the bottom on phones, without a target or when nothing fits', () => {
    expect(placeBubble({ top: 100, left: 10, width: 300, height: 100 }, bubble, { width: 390, height: 844 }).mode).toBe('dock');
    expect(placeBubble(null, bubble, view)).toEqual({ mode: 'dock', top: 564, left: 16 });
    expect(placeBubble({ top: 40, left: 16, width: 1248, height: 740 }, bubble, view).mode).toBe('dock');
  });
});
