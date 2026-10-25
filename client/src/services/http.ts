import API_URL from '../apiConfig';
import type { ApiError } from '../types/api';
import { TOO_MANY_REQUESTS, readRetryAfter, reportRateLimit } from './rateLimit';

type ResponseBody<T, E> =
  | { readonly ok: true; json(): Promise<T> }
  | { readonly ok: false; json(): Promise<E> };

export type ApiResponse<T, E = ApiError> = Omit<Response, 'ok' | 'json' | 'clone'> &
  ResponseBody<T, E> & { clone(): ApiResponse<T, E> };

export interface SessionScope { sessionKey: string | null }
export interface SessionProvider {
  sessionKey: string;
  getToken: (options?: { skipCache?: boolean }) => Promise<string | null>;
  expired: () => void;
}
let session: SessionProvider | null = null;
const reads = new Map<string, { expires: number; pending: Promise<Response>; controller: AbortController }>();
let cacheGeneration = 0;

export function invalidateReads(cancel = false) {
  if (cancel) for (const entry of reads.values()) entry.controller.abort();
  cacheGeneration += 1;
  reads.clear();
}

export async function cachedRequest<T>(path: string, auth: SessionScope, ttl: number, signal?: AbortSignal): Promise<ApiResponse<T>> {
  signal?.throwIfAborted();
  const key = JSON.stringify([auth.sessionKey, path]);
  let entry = reads.get(key);
  if (!entry || entry.expires <= Date.now()) {
    const generation = cacheGeneration;
    const controller = new AbortController();
    const next = { expires: Infinity, controller, pending: Promise.resolve(new Response()) };
    next.pending = request<T>(path, { method: 'GET', auth, signal: controller.signal }).then(response => {
      if (!response.ok || generation !== cacheGeneration) {
        if (reads.get(key) === next) reads.delete(key);
      } else next.expires = Date.now() + ttl;
      return response;
    }).catch(error => { if (reads.get(key) === next) reads.delete(key); throw error; });
    while (reads.size >= 64) reads.delete(reads.keys().next().value!);
    reads.set(key, next);
    entry = next;
  }
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    signal?.addEventListener('abort', abort, { once: true });
    entry.pending.then(response => {
      if (signal?.aborted) abort(); else resolve(response.clone() as ApiResponse<T>);
    }, reject).finally(() => signal?.removeEventListener('abort', abort));
  });
}

export function registerSession(provider: SessionProvider) {
  if (session?.sessionKey !== provider.sessionKey) invalidateReads(true);
  session = provider;
  return () => { if (session === provider) { session = null; invalidateReads(true); } };
}

export async function sessionToken(scope: SessionScope, skipCache = false) {
  const current = session;
  if (!current || !scope.sessionKey || current.sessionKey !== scope.sessionKey) throw new Error('Sesja wygasła. Zaloguj się ponownie.');
  let token: string | null;
  try { token = await current.getToken({ skipCache }); }
  catch (error) { if (session === current) current.expired(); throw error; }
  if (session !== current) throw new DOMException('Sesja została zmieniona.', 'AbortError');
  if (!token) { current.expired(); throw new Error('Sesja wygasła. Zaloguj się ponownie.'); }
  return token;
}

export interface RequestOptions extends RequestInit { auth?: SessionScope; rateLimitNotice?: boolean }

export async function request<T, E = ApiError>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T, E>> {
  const { auth, rateLimitNotice = true, ...init } = options;
  const url = new URL(path, `${API_URL || window.location.origin}/`);
  const api = new URL(API_URL || window.location.origin);
  if (url.origin !== api.origin || !url.pathname.startsWith('/api/')) throw new Error('Nieprawidłowy adres API.');
  const current = session;
  const headers = new Headers(init.headers);
  headers.delete('Authorization');
  if (typeof init.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const send = async (skipCache: boolean) => {
    init.signal?.throwIfAborted();
    if (auth?.sessionKey) headers.set('Authorization', `Bearer ${await sessionToken(auth, skipCache)}`);
    init.signal?.throwIfAborted();
    return fetch(url.href, { ...init, headers, credentials: 'omit', redirect: 'error' });
  };
  let response = await send(false);
  if (auth?.sessionKey && response.status === 401 && session === current) {
    response = await send(true);
    if (response.status === 401 && session === current) current?.expired();
  }
  if (response.status === TOO_MANY_REQUESTS && rateLimitNotice) reportRateLimit(await readRetryAfter(response));
  if (auth?.sessionKey && session !== current) throw new DOMException('Sesja została zmieniona.', 'AbortError');
  if (response.ok && !['GET', 'HEAD'].includes(init.method ?? 'GET') && !url.pathname.endsWith('/active-time') && !url.pathname.startsWith('/api/presence/room/')) {
    invalidateReads();
    if (url.pathname.startsWith('/api/rooms/') && (url.pathname.endsWith('/solve') || url.pathname.endsWith('/complete'))) {
      const result = await response.clone().json().catch(() => null);
      if (result?.success) window.dispatchEvent(new Event('hackademy:room-progress'));
    }
  }
  return response as ApiResponse<T, E>;
}
