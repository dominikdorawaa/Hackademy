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
import AdminRoute from '../components/auth/AdminRoute';
import ExpertRoute from '../components/auth/ExpertRoute';

const validExpiration = Math.floor(Date.now() / 1000) + 3600;

function jwt(roles: string[] = ['ROLE_USER'], exp = validExpiration) {

  return `${btoa('{}')}.${btoa(JSON.stringify({ sub: 'tester', roles, exp }))}.signature`;
}

function Session() {
  const auth = useAuth();
  return <>
    <output data-testid="session">{JSON.stringify(auth)}</output>
    <button onClick={() => auth.login(jwt())}>login</button>
    <button onClick={() => auth.login('broken')}>invalid login</button>
    <button onClick={auth.logout}>logout</button>
  </>;
}

afterEach(() => vi.useRealTimers());

describe('auth persistence', () => {
  it('logs in, restores the token after remount, and logs out', async () => {
    const mounted = render(<AuthProvider><Session /></AuthProvider>);
    expect(screen.getByTestId('session').textContent).toContain('"isAuthenticated":false');
    fireEvent.click(screen.getByText('login'));
    expect(localStorage.getItem('token')).toBe(jwt());
    expect(screen.getByTestId('session').textContent).toContain('"sub":"tester"');
    mounted.unmount();
    render(<AuthProvider><Session /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('session').textContent).toContain('"isAuthenticated":true'));
    fireEvent.click(screen.getByText('logout'));
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('session').textContent).toContain('"user":null');
    expect(screen.getByTestId('session').textContent).toContain('"token":null');
  });

  it('restores an expired token because the client only decodes it', () => {
    const expiredToken = jwt(['ROLE_USER'], 1);
    localStorage.setItem('token', expiredToken);
    render(<AuthProvider><Session /></AuthProvider>);
    expect(localStorage.getItem('token')).toBe(expiredToken);
    expect(screen.getByTestId('session').textContent).toContain('"isAuthenticated":true');
    expect(screen.getByTestId('session').textContent).toContain('"exp":1');
  });

  it('clears an undecodable stored token and completes loading', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('token', 'broken');
    render(<AuthProvider><Session /></AuthProvider>);
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('session').textContent).toContain('"loading":false');
    expect(screen.getByTestId('session').textContent).toContain('"isAuthenticated":false');
  });

  it('keeps the current session when a subsequent login cannot decode its token', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('token', jwt());
    render(<AuthProvider><Session /></AuthProvider>);
    fireEvent.click(screen.getByText('invalid login'));
    expect(localStorage.getItem('token')).toBe(jwt());
    expect(screen.getByTestId('session').textContent).toContain('"isAuthenticated":true');
  });

  it('preserves the session if removing its token from storage throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('token', jwt());
    render(<AuthProvider><Session /></AuthProvider>);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    fireEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('session').textContent).toContain('"isAuthenticated":true');
  });
});

const guards: [string, ComponentType<PropsWithChildren>, string, string][] = [
  ['protected', ProtectedRoute, '/login', 'REPLACE'],
  ['admin', AdminRoute, '/login', 'REPLACE'],
  ['expert', ExpertRoute, '/', 'PUSH'],
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
    localStorage.setItem('token', jwt([role]));
    mount();
    const allowed = Guard === ProtectedRoute || role === 'ROLE_ADMIN' || (Guard === ExpertRoute && role === 'ROLE_EXPERT');
    await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
    expect(screen.queryByText('private content') !== null).toBe(allowed);
    if (!allowed) {
      await waitFor(() => {
        expect(screen.getByTestId('location').textContent).toBe(Guard === AdminRoute ? '/dashboard:REPLACE' : '/:PUSH');
      });
    }
  });

  it('renders the existing loading indicator before storage restoration', () => {
    let initialMarkup = '';
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      initialMarkup = document.body.textContent || '';
      return null;
    });
    mount();
    expect(initialMarkup).toContain('Loading...');
    expect(initialMarkup).not.toContain('private content');
  });

  if (Guard === AdminRoute) {
    it.each([
      ['ROLE_ADMIN', 'USER', false],
      ['ROLE_USER', 'ADMIN', true],
    ])('uses the server role %s -> %s', async (jwtRole, serverRole, allowed) => {
      localStorage.setItem('token', jwt([jwtRole]));
      server.use(currentUserHandler(serverRole as Role));
      mount();
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      expect(screen.queryByText('private content') !== null).toBe(allowed);
    });

    it('shows the existing error when the permission request fails', async () => {
      localStorage.setItem('token', jwt(['ROLE_ADMIN']));
      server.use(http.get(currentUserUrl, () => new HttpResponse(null, { status: 403 })));
      mount();
      expect(await screen.findByText('Nie udało się sprawdzić uprawnień. Odśwież stronę i spróbuj ponownie.')).toBeTruthy();
      expect(screen.queryByText('private content')).toBeNull();
      expect(screen.getByTestId('location').textContent).toBe('/private:POP');
    });

    it('sends the restored token when checking permissions', async () => {
      const token = jwt(['ROLE_ADMIN']);
      localStorage.setItem('token', token);
      let authorization: string | null = null;
      server.use(http.get(currentUserUrl, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json(createUser('ADMIN'));
      }));
      mount();
      expect(await screen.findByText('private content')).toBeInTheDocument();
      expect(authorization).toBe('Bearer ' + token);
    });

    it('aborts the permission request when unmounted', async () => {
      localStorage.setItem('token', jwt(['ROLE_ADMIN']));
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
