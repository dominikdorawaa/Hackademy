import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  configurable: true,
  value() { this.setAttribute('open', ''); },
});
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  configurable: true,
  value() { this.removeAttribute('open'); },
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  server.resetHandlers();
});

afterAll(() => server.close());
