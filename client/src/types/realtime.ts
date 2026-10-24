import type { Challenge, FriendDto, FriendRequestDto, GameSession } from './api';

export interface RealtimeState {
  streamId: string;
  revision: number;
  friendRequests: FriendRequestDto[];
  friends: FriendDto[];
  challenges: Challenge[];
  outgoingChallenges: Challenge[];
  expiredChallenges: Challenge[];
  rejectedChallenges: Challenge[];
  gameSession: GameSession | null;
  queued: boolean;
  serverTime: number;
}

export type RealtimeEnvelope = { type: 'READY'; state: null } | { type: 'STATE'; state: RealtimeState };
