import { request } from './http';
import type { ApiId, MessageResponse, ChallengeRequest, Challenge, GameSession, ArenaSolveResponse } from '../types/api';

export function getStatus(headers: HeadersInit) {
  return request<GameSession>(`/api/arena/status`, {
    method: 'GET',
    headers,
  });
}

export function getChallenges(headers: HeadersInit) {
  return request<Challenge[]>(`/api/arena/challenges`, {
    method: 'GET',
    headers,
  });
}

export function createChallenge(data: ChallengeRequest, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/challenge/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function joinQueue(data: { vpnEnabled: boolean }, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/join`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function leaveQueue(headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/leave`, {
    method: 'POST',
    headers,
  });
}

export function acceptChallenge(id: ApiId, headers: HeadersInit) {
  return request<GameSession>(`/api/arena/challenge/${id}/accept`, {
    method: 'POST',
    headers,
  });
}

export function rejectChallenge(id: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/challenge/${id}/reject`, {
    method: 'POST',
    headers,
  });
}

export function getGame(id: ApiId, headers: HeadersInit) {
  return request<GameSession>(`/api/arena/game/${id}`, {
    method: 'GET',
    headers,
  });
}

export function useHint(id: ApiId, data: { hintId: number }, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/game/${id}/hint`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

export function surrender(id: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/game/${id}/surrender`, {
    method: 'POST',
    headers,
  });
}

export function solveGame(id: ApiId, data: { flag: string }, headers: HeadersInit) {
  return request<ArenaSolveResponse>(`/api/arena/game/${id}/solve`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

