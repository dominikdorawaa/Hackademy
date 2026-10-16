import { DEFAULT_AVATAR, fromAvatarConfig } from '../avatar/avatarModel';
import type { Avatar } from '../avatar/avatarModel';
import { danceFrames } from '../avatar/fighters';
import type { GameSession, RoundResult } from '../../../types/api';

export interface Fighter {
  id: number
  username: string
  elo: number
  hp: number
  seed?: string
  look: Avatar
  avatar: GameSession['player1Avatar']
}

export type Outcome = 'win' | 'loss' | 'draw';

const row = (index: number, count = 8) => Array.from({ length: count }, (_, column) => index * 9 + column + 1);
const ATTACK = row(1);
const HURT = row(4, 4);
const DEFEAT = row(5);
const VICTORY = danceFrames(6);

export const MAX_HP = 100;

function fighter(session: GameSession, slot: 1 | 2): Fighter {
  const id = slot === 1 ? session.player1Id : session.player2Id;
  const avatar = slot === 1 ? session.player1Avatar : session.player2Avatar;
  return {
    id,
    username: slot === 1 ? session.player1Username : session.player2Username,
    elo: (slot === 1 ? session.player1Elo : session.player2Elo) ?? 500,
    hp: session.hp?.[id] ?? MAX_HP,
    seed: slot === 1 ? session.player1AvatarSeed : session.player2AvatarSeed,
    look: fromAvatarConfig(avatar) ?? DEFAULT_AVATAR,
    avatar,
  };
}

export function perspective(session: GameSession, meId: number) {
  const mine = session.player2Id === meId ? 2 : 1;
  return { me: fighter(session, mine), rival: fighter(session, mine === 1 ? 2 : 1) };
}

export function outcome(session: GameSession, meId: number): Outcome {
  if (session.winnerId == null) return 'draw';
  return session.winnerId === meId ? 'win' : 'loss';
}

export function outcomeTitle(result: Outcome) {
  return result === 'win' ? 'Zwycięstwo' : result === 'loss' ? 'Porażka' : 'Remis';
}

export function finishText(session: GameSession, meId: number) {
  const won = session.winnerId === meId;
  switch (session.finishReason) {
    case 'KNOCKOUT': return won ? 'Rywal padł po Twoim ciosie.' : 'Twój awatar został znokautowany.';
    case 'SURRENDER': return won ? 'Rywal się poddał.' : 'Poddałeś walkę.';
    case 'DISCONNECT': return won ? 'Rywal stracił połączenie na dłużej niż 30 sekund.' : 'Straciłeś połączenie na dłużej niż 30 sekund.';
    default: return session.winnerId == null ? 'Po 10 rundach macie tyle samo HP. Elo się nie zmienia.' : won ? 'Po 10 rundach masz więcej HP.' : 'Po 10 rundach rywal ma więcej HP.';
  }
}

export function eloChange(session: GameSession, meId: number) {
  return (session.player2Id === meId ? session.player2EloChange : session.player1EloChange) ?? 0;
}

export function roundSummary(result: RoundResult, meId: number, rivalId: number) {
  const iHit = (result.damage[rivalId] ?? 0) > 0;
  const rivalHit = (result.damage[meId] ?? 0) > 0;
  if (iHit && rivalHit) return 'Oboje trafiliście. Każdy traci 20 HP.';
  if (iHit) return 'Trafiasz! Rywal traci 20 HP.';
  if (rivalHit) return 'Rywal trafia. Tracisz 20 HP.';
  return 'Nikt nie trafił w tej rundzie.';
}

export function fighterFrames(session: GameSession, fighterId: number, opponentId: number): { frames: number[]; loop: boolean } {
  if (session.status === 'FINISHED') {
    if (session.winnerId === fighterId) return { frames: VICTORY, loop: true };
    if (session.winnerId === opponentId) return { frames: DEFEAT, loop: false };
    return { frames: [0], loop: true };
  }
  if (session.phase === 'REVEAL' && session.lastRound) {
    const attacks = (session.lastRound.damage[opponentId] ?? 0) > 0;
    const hurt = (session.lastRound.damage[fighterId] ?? 0) > 0;
    const frames = [...(attacks ? ATTACK : []), ...(hurt ? HURT : [])];
    if (frames.length) return { frames: [...frames, 0], loop: false };
  }
  return { frames: [0], loop: true };
}

export function secondsLeft(deadline: number, serverTime: number, receivedAt: number, now: number) {
  const serverNow = now + (serverTime - receivedAt);
  return Math.max(0, Math.ceil((deadline - serverNow) / 1000));
}
