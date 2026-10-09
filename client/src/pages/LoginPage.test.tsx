import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LoginPage from './LoginPage';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import type { AuthResponse, LoginRequest, Role } from '../types/api';
import { credentials, createToken } from '../test/fixtures/auth';
import { loginUrl } from '../test/mocks/handlers';
import { server } from '../test/mocks/server';
import { renderWithAuth } from '../test/renderWithAuth';

function Dashboard() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  return <>
    <h1>Dashboard</h1>
    <output data-testid="roles">{user?.roles.join(',')}</output>
    <button onClick={() => { logout(); navigate('/dashboard'); }}>End session</button>
  </>;
}

function mount(initialEntry = '/login') {
  return renderWithAuth(<>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
  </>, initialEntry);
}

async function submit(password = credentials.password) {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox'), credentials.email);
  await user.type(document.querySelector('input[type=password]')!, password);
  await user.click(screen.getByRole('button', { name: 'Zaloguj' }));
  return user;
}

describe('login page integration', () => {
  it.each<Role>(['USER', 'EXPERT', 'ADMIN'])('logs in as %s and loses protected access on logout', async role => {
    const token = createToken(role);
    let submitted: LoginRequest | undefined;
    server.use(http.post<never, LoginRequest>(loginUrl, async ({ request }) => {
      submitted = await request.json();
      return HttpResponse.json<AuthResponse>({ token });
    }));
    mount();
    const user = await submit();
    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 3500 })).toBeInTheDocument();
    expect(submitted).toEqual(credentials);
    expect(screen.getByTestId('roles')).toHaveTextContent(`ROLE_${role}`);
    expect(screen.getByTestId('location')).toHaveTextContent('/dashboard:PUSH');
    expect(localStorage.getItem('token')).toBe(token);
    await user.click(screen.getByText('End session'));
    expect(screen.getByTestId('location')).toHaveTextContent('/login:REPLACE');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('shows rejected credentials and allows a successful retry', async () => {
    mount();
    await submit('wrong-password');
    expect(await screen.findByText('[ERROR] Invalid credentials', {}, { timeout: 3500 })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/login:POP');
    await screen.findByRole('button', { name: 'Zaloguj' }, { timeout: 3000 });
    expect(screen.getByRole('textbox')).toHaveValue('');
    expect(document.querySelector('input[type=password]')).toHaveValue('');
    await submit();
    expect(await screen.findByRole('heading', { name: 'Dashboard' }, { timeout: 3500 })).toBeInTheDocument();
  }, 10000);

  it('shows a connection failure without creating a session', async () => {
    server.use(http.post(loginUrl, () => HttpResponse.error()));
    mount();
    await submit();
    expect(await screen.findByText(/\[ERROR\]/, {}, { timeout: 3500 })).toHaveTextContent('Nie można połączyć z serwerem.');
    expect(localStorage.getItem('token')).toBeNull();
    expect(screen.getByTestId('location')).toHaveTextContent('/login:POP');
    expect(await screen.findByRole('button', { name: 'Zaloguj' }, { timeout: 3000 })).toBeInTheDocument();
  });

  it('redirects a guest from the protected route to the real login page', () => {
    mount('/dashboard');
    expect(screen.getByRole('button', { name: 'Zaloguj' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login:REPLACE');
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
});
