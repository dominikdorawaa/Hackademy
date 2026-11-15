import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setClerkSession, signOut } from '../test/clerk';
import { createToken } from '../test/fixtures/auth';
import { findToast, queryToast } from '../test/toasts';
import Toaster from '../components/common/Toaster';
import { toast } from '../components/common/toast';
import { rememberAccountDeleted } from '../lib/accountDeletion';
import HomePage from '../pages/HomePage';
import { AuthProvider, useAuth } from './AuthContext';

function LogoutButton() {
  const { logout } = useAuth();
  return <button type="button" onClick={() => void logout()}>Wyloguj</button>;
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
  return () => vi.unstubAllGlobals();
});

describe('toasts and the session', () => {
  it('clears action toasts when the player signs out', async () => {
    setClerkSession(createToken());
    render(<MemoryRouter><AuthProvider><LogoutButton /><Toaster /></AuthProvider></MemoryRouter>);
    act(() => { toast.success('Zapisano szkic.'); });
    await findToast('Zapisano szkic.');
    await act(async () => { screen.getByRole('button', { name: 'Wyloguj' }).click(); });
    expect(signOut).toHaveBeenCalled();
    expect(queryToast('Zapisano szkic.')).toBeNull();
  });

  it('clears action toasts when the session ends on its own and keeps toasts shown while signed out', async () => {
    setClerkSession(createToken());
    render(<MemoryRouter><AuthProvider><Toaster /></AuthProvider></MemoryRouter>);
    act(() => { toast.error('Nie udało się zapisać.'); });
    await findToast('Nie udało się zapisać.', 'assertive');
    act(() => setClerkSession(null));
    expect(queryToast('Nie udało się zapisać.')).toBeNull();
    act(() => { toast.info('Gość widzi komunikat.'); });
    await findToast('Gość widzi komunikat.');
  });

  it('confirms a deleted account on the home page only after the session ended', async () => {
    setClerkSession(createToken());
    rememberAccountDeleted();
    render(<MemoryRouter><AuthProvider><HomePage /><LogoutButton /><Toaster /></AuthProvider></MemoryRouter>);
    await screen.findByRole('button', { name: 'Wyloguj' });
    expect(queryToast(/Konto zostało trwale usunięte/)).toBeNull();
    await act(async () => { screen.getByRole('button', { name: 'Wyloguj' }).click(); });
    await findToast('Konto zostało trwale usunięte. Dziękujemy za wspólną naukę.');
    expect(sessionStorage.getItem('hackademy.account-deleted')).toBeNull();
  });
});
