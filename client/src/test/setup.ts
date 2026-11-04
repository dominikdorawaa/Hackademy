import { reverify, setClerkPassword, setClerkSession } from './clerk';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';

Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value() { this.setAttribute('open', ''); },
});
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value() { this.removeAttribute('open'); },
});

vi.mock('@clerk/react', async () => {
  const mock = await import('./clerk');
  return { useAuth: mock.useMockAuth, useClerk: mock.useMockClerk, useUser: mock.useMockUser, useReverification: mock.useMockReverification, SignIn: mock.MockSignIn, SignUp: mock.MockSignUp };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  setClerkSession(null);
  setClerkPassword(true);
  reverify.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  server.resetHandlers();
});

afterAll(() => server.close());
