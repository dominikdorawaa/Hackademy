import { setClerkSession } from '../test/clerk';
import { screen } from '@testing-library/react';
import { Route } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { renderWithAuth } from '../test/renderWithAuth';

function mount(initialEntry = '/login') {
  return renderWithAuth(<>
    <Route path="/login/*" element={<LoginPage />} />
    <Route path="/register/*" element={<RegisterPage />} />
    <Route path="/dashboard" element={<ProtectedRoute><h1>Dashboard</h1></ProtectedRoute>} />
  </>, initialEntry);
}

describe('Clerk authentication pages', () => {
  it.each(['/login', '/login/factor-one', '/login/reset-password'])('keeps Clerk in control of sign-in steps at %s', path => {
    mount(path);
    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it.each(['/register', '/register/verify-email-address'])('renders Clerk sign-up at %s', path => {
    mount(path);
    expect(screen.getByTestId('clerk-sign-up')).toBeInTheDocument();
  });
  it('redirects guests from protected routes to sign-in', () => {
    mount('/dashboard');
    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
  });
  it('redirects signed-in users to their dashboard', async () => {
    setClerkSession('clerk-token');
    mount();
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
