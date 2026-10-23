import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RateLimitNotice, { RATE_LIMIT_TICK_MS } from './RateLimitNotice';
import { reportRateLimit } from '../services/rateLimit';

const countdown = () => document.querySelector('.rate-limit-notice-text')?.textContent;

describe('RateLimitNotice', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-23T10:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('tells the user when they can try again and hides once the wait is over', () => {
    render(<RateLimitNotice />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    act(() => reportRateLimit(3));
    expect(screen.getByRole('status')).toHaveTextContent('Zbyt wiele żądań. Spróbuj ponownie za 3 s.');
    act(() => vi.advanceTimersByTime(RATE_LIMIT_TICK_MS));
    expect(countdown()).toBe('Zbyt wiele żądań. Spróbuj ponownie za 2 s.');
    act(() => vi.advanceTimersByTime(2 * RATE_LIMIT_TICK_MS));
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
  it('keeps the longest wait when several requests are limited', () => {
    render(<RateLimitNotice />);
    act(() => reportRateLimit(10));
    act(() => reportRateLimit(2));
    expect(countdown()).toBe('Zbyt wiele żądań. Spróbuj ponownie za 10 s.');
  });
  it('can be dismissed', () => {
    render(<RateLimitNotice />);
    act(() => reportRateLimit(5));
    act(() => screen.getByRole('button', { name: 'Zamknij komunikat o limicie żądań' }).click());
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});
