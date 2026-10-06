import API_URL from '../apiConfig';
import type { ApiError } from '../types/api';

type ResponseBody<T, E> =
  | { readonly ok: true; json(): Promise<T> }
  | { readonly ok: false; json(): Promise<E> };

export type ApiResponse<T, E = ApiError> = Omit<Response, 'ok' | 'json' | 'clone'> &
  ResponseBody<T, E> & { clone(): ApiResponse<T, E> };

export async function request<T, E = ApiError>(path: string, options: RequestInit): Promise<ApiResponse<T, E>> {
  return await fetch(`${API_URL}${path}`, options) as ApiResponse<T, E>;
}
