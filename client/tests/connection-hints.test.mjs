import assert from 'node:assert/strict';
import test from 'node:test';
import { connectionHints } from '../build/connectionHints.mjs';

test('preconnects only to the configured API and validated Clerk public domain', () => {
  const key = 'pk_test_' + Buffer.from('example.clerk.accounts.dev$').toString('base64');
  assert.deepEqual(connectionHints({ VITE_API_URL: 'https://api.example.test/base', VITE_CLERK_PUBLISHABLE_KEY: key }).map(tag => tag.attrs.href),
    ['https://api.example.test', 'https://example.clerk.accounts.dev']);
  assert.deepEqual(connectionHints({}), []);
  assert.deepEqual(connectionHints({ VITE_API_URL: 'bad', VITE_CLERK_PUBLISHABLE_KEY: 'bad' }), []);
  assert.deepEqual(connectionHints({ VITE_API_URL: 'javascript:alert(1)', VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_' + Buffer.from('<bad>$').toString('base64') }), []);
});
