export const TOO_MANY_REQUESTS = 429;
export const DEFAULT_RETRY_AFTER_SECONDS = 30;

type RateLimitListener = (retryAfter: number) => void;
const listeners = new Set<RateLimitListener>();

interface LimitedResponse {
  status: number;
  headers?: Headers;
  clone(): { json(): Promise<unknown> };
}

export function onRateLimit(listener: RateLimitListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function reportRateLimit(retryAfter: number) {
  listeners.forEach(listener => listener(retryAfter));
}

function positiveSeconds(value: unknown) {
  const seconds = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
}

export function retryAfterSeconds(headers: Headers | null | undefined, body?: unknown, now = Date.now()) {
  const fromBody = body && typeof body === 'object' ? positiveSeconds((body as { retryAfter?: unknown }).retryAfter) : null;
  if (fromBody) return fromBody;
  const header = headers?.get('Retry-After') ?? null;
  const fromHeader = positiveSeconds(header);
  if (fromHeader) return fromHeader;
  const date = header ? Date.parse(header) : Number.NaN;
  if (date > now) return Math.ceil((date - now) / 1000);
  return DEFAULT_RETRY_AFTER_SECONDS;
}

export function rateLimitMessage(retryAfter: number) {
  return `Zbyt wiele żądań. Spróbuj ponownie za ${retryAfter} s.`;
}

export async function readRetryAfter(response: LimitedResponse) {
  let body: unknown = null;
  try { body = await response.clone().json(); } catch { body = null; }
  return retryAfterSeconds(response.headers, body);
}

export async function rateLimitText(response: LimitedResponse) {
  return response.status === TOO_MANY_REQUESTS ? rateLimitMessage(await readRetryAfter(response)) : null;
}
