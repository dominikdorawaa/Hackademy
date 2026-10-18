import { request } from './http';
import type { ApiId, MessageResponse, ChallengeRequest, Challenge, GameSession } from '../types/api';

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

export function joinQueue(headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/join`, {
    method: 'POST',
    headers,
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

export function cancelChallenge(id: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/challenge/${id}/cancel`, { method: 'POST', headers });
}

export function getGame(id: ApiId, headers: HeadersInit) {
  return request<GameSession>(`/api/arena/game/${id}`, {
    method: 'GET',
    headers,
  });
}

export function answerQuestion(id: ApiId, round: number, answer: number, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/game/${id}/answer`, {
    method: 'POST',
    headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
    body: JSON.stringify({ round, answer }),
  });
}

export function sendReaction(id: ApiId, reaction: string, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/game/${id}/reaction`, {
    method: 'POST',
    headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction }),
  });
}

export function surrender(id: ApiId, headers: HeadersInit) {
  return request<MessageResponse>(`/api/arena/game/${id}/surrender`, {
    method: 'POST',
    headers,
  });
}

