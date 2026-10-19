import API_URL from '../apiConfig';
import type { ApiError } from '../types/api';

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

export function registerSession(provider: SessionProvider) {
  session = provider;
  return () => { if (session === provider) session = null; };
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

export interface RequestOptions extends RequestInit { auth?: SessionScope }

export async function request<T, E = ApiError>(path: string, options: RequestOptions = {}): Promise<ApiResponse<T, E>> {
  const { auth, ...init } = options;
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
  if (auth?.sessionKey && session !== current) throw new DOMException('Sesja została zmieniona.', 'AbortError');
  return response as ApiResponse<T, E>;
}
