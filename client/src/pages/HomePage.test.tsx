import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { rememberAccountDeleted } from '../lib/accountDeletion';
import HomePage from './HomePage';

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe('home page', () => {
  it('confirms a deleted account once after the redirect', async () => {
    rememberAccountDeleted();
    render(<MemoryRouter><AuthProvider><HomePage /></AuthProvider></MemoryRouter>);
    expect(await screen.findByText('Konto zostało trwale usunięte. Dziękujemy za wspólną naukę.')).toBeInTheDocument();
    expect(sessionStorage.getItem('hackademy.account-deleted')).toBeNull();
  });
});
