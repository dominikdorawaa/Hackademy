import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RETRY_AFTER_SECONDS, onRateLimit, rateLimitMessage, rateLimitText, readRetryAfter, reportRateLimit, retryAfterSeconds } from './rateLimit';

const limited = (body: BodyInit | null, headers: HeadersInit = {}) => new Response(body, { status: 429, headers });

describe('rate limit helper', () => {
  it('prefers the seconds from the response body', () => {
    expect(retryAfterSeconds(new Headers({ 'Retry-After': '90' }), { retryAfter: 12 })).toBe(12);
    expect(retryAfterSeconds(null, { retryAfter: '7' })).toBe(7);
    expect(retryAfterSeconds(null, { retryAfter: 2.2 })).toBe(3);
  });
  it('falls back to the Retry-After header in seconds or as a date', () => {
    expect(retryAfterSeconds(new Headers({ 'Retry-After': '45' }), { retryAfter: 0 })).toBe(45);
    const now = Date.parse('2026-10-23T10:00:00Z');
    expect(retryAfterSeconds(new Headers({ 'Retry-After': 'Fri, 23 Oct 2026 10:01:30 GMT' }), null, now)).toBe(90);
  });
  it.each([
    [new Headers(), null],
    [new Headers({ 'Retry-After': '0' }), { retryAfter: -4 }],
    [new Headers({ 'Retry-After': 'soon' }), 'text'],
    [new Headers({ 'Retry-After': 'Fri, 23 Oct 2026 09:00:00 GMT' }), { retryAfter: 'never' }],
    [undefined, undefined],
  ])('uses a default wait when the server gives no usable time: %#', (headers, body) => {
    expect(retryAfterSeconds(headers, body, Date.parse('2026-10-23T10:00:00Z'))).toBe(DEFAULT_RETRY_AFTER_SECONDS);
  });
  it('builds a Polish message with the waiting time', () => {
    expect(rateLimitMessage(5)).toBe('Zbyt wiele żądań. Spróbuj ponownie za 5 s.');
  });
  it('reads the wait from a response without consuming its body', async () => {
    const response = limited(JSON.stringify({ message: 'Zbyt wiele żądań.', retryAfter: 8 }), { 'Retry-After': '60' });
    expect(await readRetryAfter(response)).toBe(8);
    expect(await response.json()).toEqual({ message: 'Zbyt wiele żądań.', retryAfter: 8 });
    expect(await readRetryAfter(limited('not JSON', { 'Retry-After': '15' }))).toBe(15);
  });
  it('describes only rate limited responses', async () => {
    expect(await rateLimitText(limited(JSON.stringify({ retryAfter: 4 })))).toBe('Zbyt wiele żądań. Spróbuj ponownie za 4 s.');
    expect(await rateLimitText(new Response(null, { status: 500 }))).toBeNull();
    expect(await rateLimitText(new Response(null, { status: 401 }))).toBeNull();
  });
  it('notifies listeners until they unsubscribe', () => {
    const listener = vi.fn();
    const stop = onRateLimit(listener);
    reportRateLimit(10);
    stop();
    reportRateLimit(20);
    expect(listener.mock.calls).toEqual([[10]]);
  });
});
