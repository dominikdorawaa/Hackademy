import { screen } from '@testing-library/react';
import { expect } from 'vitest';

export async function findToast(message: string | RegExp, live: 'polite' | 'assertive' = 'polite') {
  const element = await screen.findByText(message, { selector: '.px-toast-message' });
  expect(element.closest('[aria-live]')).toHaveAttribute('aria-live', live);
  return element;
}

export function queryToast(message: string | RegExp) {
  return screen.queryByText(message, { selector: '.px-toast-message' });
}
