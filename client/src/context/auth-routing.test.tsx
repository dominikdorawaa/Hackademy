import { setClerkSession } from '../test/clerk';
import type { ComponentType, PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import type { Role } from '../types/api';
import { server } from '../test/mocks/server';
import { currentUserHandler, currentUserUrl } from '../test/mocks/handlers';
import { createUser } from '../test/fixtures/auth';
import { renderWithAuth } from '../test/renderWithAuth';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { AdminAccessRoute as AdminRoute } from '../pages/admin/adminAccess';

const validExpiration = Math.floor(Date.now() / 1000) + 3600;

function jwt(roles: string[] = ['ROLE_USER'], exp = validExpiration) {

  return `${btoa('{}')}.${btoa(JSON.stringify({ sub: 'tester', roles, exp }))}.signature`;
}

function Session() {
  const auth = useAuth();
  return <><output data-testid="session">{JSON.stringify(auth)}</output><button onClick={() => void auth.logout()}>logout</button></>;
}

afterEach(() => vi.useRealTimers());

describe('Clerk session lifecycle', () => {
  it('ignores and removes legacy tokens from local storage', () => {
    localStorage.setItem('token', jwt());
    render(<AuthProvider><Session /></AuthProvider>);
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('session')).toHaveTextContent('"isAuthenticated":false');
  });
  it('uses Clerk state and clears protected access on logout', async () => {
    setClerkSession(jwt());
    render(<AuthProvider><Session /></AuthProvider>);
    expect(screen.getByTestId('session')).toHaveTextContent('"isAuthenticated":true');
    fireEvent.click(screen.getByText('logout'));
    await waitFor(() => expect(screen.getByTestId('session')).toHaveTextContent('"isAuthenticated":false'));
    expect(localStorage.getItem('token')).toBeNull();
  });
});

const guards: [string, ComponentType<PropsWithChildren>, string, string][] = [
  ['protected', ProtectedRoute, '/login', 'REPLACE'],
  ['admin panel', AdminRoute, '/login', 'REPLACE'],
];

describe.each(guards)('%s route', (_, Guard, guestDestination, guestNavigation) => {
  function mount() {
    return renderWithAuth(<>
      <Route path="/private" element={<Guard><div>private content</div></Guard>} />
      <Route path="*" element={<div>redirected</div>} />
    </>, '/private');
  }

  it('redirects a guest to the same location with the same history action', () => {
    mount();
    expect(screen.queryByText('private content')).toBeNull();
    expect(screen.getByTestId('location').textContent).toBe(`${guestDestination}:${guestNavigation}`);
  });

  it.each(['ROLE_USER', 'ROLE_EXPERT', 'ROLE_ADMIN'])('checks %s permissions after restoring the session', async role => {
    server.use(currentUserHandler(role.replace('ROLE_', '') as Role));
    setClerkSession(jwt([role]));
    mount();
    const allowed = Guard === ProtectedRoute || role !== 'ROLE_USER';
    await waitFor(() => expect(screen.queryByText(/Wczytuję…|Sprawdzanie uprawnień/)).toBeNull());
    expect(screen.queryByText('private content') !== null).toBe(allowed);
    if (!allowed) {
      await waitFor(() => {
        expect(screen.getByTestId('location').textContent).toBe('/:REPLACE');
      });
    }
  });

  it('waits until Clerk has loaded before allowing protected content', () => {
    setClerkSession(null, false);
    mount();
    expect(screen.queryByText('private content')).toBeNull();
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
  });

  if (Guard === AdminRoute) {
    it.each([
      ['ROLE_ADMIN', 'USER', false],
      ['ROLE_USER', 'ADMIN', true],
    ])('uses the server role %s -> %s', async (jwtRole, serverRole, allowed) => {
      setClerkSession(jwt([jwtRole]));
      server.use(currentUserHandler(serverRole as Role));
      mount();
      await waitFor(() => expect(screen.queryByText(/Sprawdzanie uprawnień/)).toBeNull());
      expect(screen.queryByText('private content') !== null).toBe(allowed);
    });

    it('shows the existing error when the permission request fails', async () => {
      setClerkSession(jwt(['ROLE_ADMIN']));
      server.use(http.get(currentUserUrl, () => new HttpResponse(null, { status: 403 })));
      mount();
      expect(await screen.findByText('Nie udało się sprawdzić uprawnień. Odśwież stronę i spróbuj ponownie.')).toBeTruthy();
      expect(screen.queryByText('private content')).toBeNull();
      expect(screen.getByTestId('location').textContent).toBe('/private:POP');
    });

    it('sends the restored sessionKey when checking permissions', async () => {
      const sessionKey = jwt(['ROLE_ADMIN']);
      setClerkSession(sessionKey);
      let authorization: string | null = null;
      server.use(http.get(currentUserUrl, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json(createUser('ADMIN'));
      }));
      mount();
      expect(await screen.findByText('private content')).toBeInTheDocument();
      expect(authorization).toBe('Bearer ' + sessionKey);
    });

    it('aborts the permission request when unmounted', async () => {
      setClerkSession(jwt(['ROLE_ADMIN']));
      let signal: AbortSignal | undefined;
      server.use(http.get(currentUserUrl, ({ request }) => {
        signal = request.signal;
        return new Promise<Response>(resolve => {
          request.signal.addEventListener('abort', () => resolve(new HttpResponse(null, { status: 499 })), { once: true });
        });
      }));
      const mounted = mount();
      await waitFor(() => expect(signal).toBeDefined());
      expect(signal?.aborted).toBe(false);
      mounted.unmount();
      await waitFor(() => expect(signal?.aborted).toBe(true));
    });
  }
});
