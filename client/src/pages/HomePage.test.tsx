import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { rememberAccountDeleted } from '../lib/accountDeletion';
import HomePage from './HomePage';
import Toaster from '../components/common/Toaster';
import { findToast } from '../test/toasts';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('home page', () => {
  it('confirms a deleted account once after the redirect', async () => {
    rememberAccountDeleted();
    render(<MemoryRouter><AuthProvider><HomePage /><Toaster /></AuthProvider></MemoryRouter>);
    await findToast('Konto zostało trwale usunięte. Dziękujemy za wspólną naukę.');
    expect(screen.getAllByText('Konto zostało trwale usunięte. Dziękujemy za wspólną naukę.')).toHaveLength(1);
    expect(sessionStorage.getItem('hackademy.account-deleted')).toBeNull();
  });
});
