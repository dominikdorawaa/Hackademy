import type { ComponentType, PropsWithChildren } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import AdminRoute from '../components/auth/AdminRoute';
import ExpertRoute from '../components/auth/ExpertRoute';
import LoginPage from '../pages/LoginPage';

const validExpiration = Math.floor(Date.now() / 1000) + 3600;

function jwt(roles: string[] = ['ROLE_USER'], exp = validExpiration) {

  return `${btoa('{}')}.${btoa(JSON.stringify({ sub: 'tester', roles, exp }))}.signature`;
}

function Location() {
  const location = useLocation();
  const navigation = useNavigationType();
  return <output data-testid="location">{location.pathname}:{navigation}</output>;
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
    return render(<MemoryRouter initialEntries={['/private']}>
      <AuthProvider>
        <Location />
        <Routes>
          <Route path="/private" element={<Guard><div>private content</div></Guard>} />
          <Route path="*" element={<div>redirected</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>);
  }

  it('redirects a guest to the same location with the same history action', () => {
    mount();
    expect(screen.queryByText('private content')).toBeNull();
    expect(screen.getByTestId('location').textContent).toBe(`${guestDestination}:${guestNavigation}`);
  });

  it.each(['ROLE_USER', 'ROLE_EXPERT', 'ROLE_ADMIN'])('checks %s permissions after restoring the session', async role => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(Response.json({ role: role.replace('ROLE_', '') })));
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
      vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(Response.json({ role: serverRole })));
      mount();
      await waitFor(() => expect(screen.queryByText('Loading...')).toBeNull());
      expect(screen.queryByText('private content') !== null).toBe(allowed);
    });

    it('shows the existing error when the permission request fails', async () => {
      localStorage.setItem('token', jwt(['ROLE_ADMIN']));
      vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })));
      mount();
      expect(await screen.findByText('Nie udało się sprawdzić uprawnień. Odśwież stronę i spróbuj ponownie.')).toBeTruthy();
      expect(screen.queryByText('private content')).toBeNull();
      expect(screen.getByTestId('location').textContent).toBe('/private:POP');
    });

    it('aborts the permission request when unmounted', () => {
      localStorage.setItem('token', jwt(['ROLE_ADMIN']));
      const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
      vi.stubGlobal('fetch', fetchMock);
      const mounted = mount();
      const signal = fetchMock.mock.calls[0][1]?.signal;
      expect(signal?.aborted).toBe(false);
      mounted.unmount();
      expect(signal?.aborted).toBe(true);
    });
  }
});

describe('login page integration', () => {
  function Dashboard() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    return <button onClick={() => { logout(); navigate('/dashboard'); }}>End session</button>;
  }

  it('submits credentials, enters a protected page and loses access on logout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ token: jwt() }));
    vi.stubGlobal('fetch', fetchMock);
    render(<MemoryRouter initialEntries={['/login']}><AuthProvider>
      <Location />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      </Routes>
    </AuthProvider></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test@example.com' } });
    fireEvent.change(document.querySelector('input[type=password]')!, { target: { value: 'secret' } });
    fireEvent.submit(document.querySelector('form')!);
    await act(async () => { await vi.advanceTimersByTimeAsync(1600); });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/auth\/login$/), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'secret' }),
    });
    expect(screen.getByTestId('location').textContent).toBe('/dashboard:PUSH');
    expect(localStorage.getItem('token')).toBe(jwt());
    fireEvent.click(screen.getByText('End session'));
    expect(screen.getByTestId('location').textContent).toBe('/login:REPLACE');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
