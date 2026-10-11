import type { Challenge, FriendDto, FriendRequestDto, GameSession } from './api';

export interface RealtimeState {
  streamId: string;
  revision: number;
  friendRequests: FriendRequestDto[];
  friends: FriendDto[];
  challenges: Challenge[];
  outgoingChallenges: Challenge[];
  gameSession: GameSession | null;
  queued: boolean;
}

export type RealtimeEnvelope = { type: 'READY'; state: null } | { type: 'STATE'; state: RealtimeState };
