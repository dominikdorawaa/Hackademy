import { request } from './http';
import type { SessionScope } from './http';
import type { ApiId, MessageResponse, ChallengeRequest, Challenge, GameSession } from '../types/api';

export function getStatus(auth: SessionScope) {
  return request<GameSession>(`/api/arena/status`, {
    method: 'GET',
    auth,
  });
}

export function getChallenges(auth: SessionScope) {
  return request<Challenge[]>(`/api/arena/challenges`, {
    method: 'GET',
    auth,
  });
}

export function createChallenge(data: ChallengeRequest, auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/challenge/create`, {
    method: 'POST',
    auth,
    body: JSON.stringify(data),
  });
}

export function joinQueue(auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/join`, {
    method: 'POST',
    auth,
  });
}

export function leaveQueue(auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/leave`, {
    method: 'POST',
    auth,
  });
}

export function acceptChallenge(id: ApiId, auth: SessionScope) {
  return request<GameSession>(`/api/arena/challenge/${id}/accept`, {
    method: 'POST',
    auth,
  });
}

export function rejectChallenge(id: ApiId, auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/challenge/${id}/reject`, {
    method: 'POST',
    auth,
  });
}

export function cancelChallenge(id: ApiId, auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/challenge/${id}/cancel`, { method: 'POST', auth });
}

export function dismissChallengeNotice(id: ApiId, auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/challenge/${id}/dismiss`, { method: 'POST', auth });
}

export function getGame(id: ApiId, auth: SessionScope) {
  return request<GameSession>(`/api/arena/game/${id}`, {
    method: 'GET',
    auth,
  });
}

export function answerQuestion(id: ApiId, round: number, answer: number, auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/game/${id}/answer`, {
    method: 'POST',
    auth, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ round, answer }),
  });
}

export function leaveBattle(id: ApiId, auth: SessionScope) {
  return request<void>(`/api/arena/game/${id}/leave`, { method: 'POST', auth, rateLimitNotice: false });
}

export function returnToBattle(id: ApiId, auth: SessionScope) {
  return request<void>(`/api/arena/game/${id}/return`, { method: 'POST', auth, rateLimitNotice: false });
}

export function sendReaction(id: ApiId, reaction: string, auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/game/${id}/reaction`, {
    method: 'POST',
    auth, headers: { 'Content-Type': 'application/json' }, rateLimitNotice: false,
    body: JSON.stringify({ reaction }),
  });
}

export function surrender(id: ApiId, auth: SessionScope) {
  return request<MessageResponse>(`/api/arena/game/${id}/surrender`, {
    method: 'POST',
    auth,
  });
}

